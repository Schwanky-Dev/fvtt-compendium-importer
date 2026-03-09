/**
 * Maps Open5e monster JSON → Foundry dnd5e Actor (NPC) data.
 */

const ABILITY_MAP = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

const SIZE_MAP = {
  Tiny: "tiny",
  Small: "sm",
  Medium: "med",
  Large: "lg",
  Huge: "huge",
  Gargantuan: "grg",
};

const ALIGNMENT_MAP = {
  "lawful good": "lg",
  "neutral good": "ng",
  "chaotic good": "cg",
  "lawful neutral": "ln",
  "neutral": "tn",
  "true neutral": "tn",
  "chaotic neutral": "cn",
  "lawful evil": "le",
  "neutral evil": "ne",
  "chaotic evil": "ce",
  "unaligned": "un",
  "any alignment": "any",
};

/**
 * Parse a speed string like "30 ft., fly 60 ft., swim 30 ft." into dnd5e format.
 */
function parseSpeed(speedObj) {
  if (!speedObj) return { value: 30, units: "ft" };

  if (typeof speedObj === "string") {
    const match = speedObj.match(/(\d+)/);
    return { value: match ? parseInt(match[1]) : 30, units: "ft" };
  }

  const result = {};
  if (speedObj.walk !== undefined) {
    result.value = typeof speedObj.walk === "number" ? speedObj.walk : parseInt(speedObj.walk) || 30;
  } else {
    result.value = 30;
  }
  result.units = "ft";

  for (const [key, val] of Object.entries(speedObj)) {
    if (key === "walk" || key === "hover" || key === "notes") continue;
    const num = typeof val === "number" ? val : parseInt(val);
    if (!isNaN(num) && num > 0) {
      result[key] = num;
    }
  }
  if (speedObj.hover) result.hover = true;

  return result;
}

/**
 * Parse AC — Open5e gives armor_class as a number and armor_desc as string.
 */
function parseAC(monster) {
  const ac = monster.armor_class ?? 10;
  const desc = monster.armor_desc ?? "";
  return {
    flat: ac,
    calc: "flat",
    formula: desc ? `${ac} (${desc})` : String(ac),
  };
}

/**
 * Parse senses string: "darkvision 60 ft., passive Perception 14"
 */
function parseSenses(sensesStr) {
  const senses = {
    darkvision: 0,
    blindsight: 0,
    tremorsense: 0,
    truesight: 0,
    units: "ft",
    special: "",
  };
  if (!sensesStr) return senses;

  const parts = sensesStr.split(",").map((s) => s.trim());
  for (const part of parts) {
    const lower = part.toLowerCase();
    for (const sense of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
      if (lower.startsWith(sense)) {
        const match = part.match(/(\d+)/);
        if (match) senses[sense] = parseInt(match[1]);
      }
    }
    if (lower.startsWith("passive perception")) {
      // handled elsewhere via skills
    }
  }
  return senses;
}

/**
 * Parse CR to proficiency bonus.
 */
function crToProf(cr) {
  const num = typeof cr === "string" ? eval(cr) : cr;
  if (num < 5) return 2;
  if (num < 9) return 3;
  if (num < 13) return 4;
  if (num < 17) return 5;
  if (num < 21) return 6;
  if (num < 25) return 7;
  if (num < 29) return 8;
  return 9;
}

/**
 * Parse CR string to numeric value.
 */
function parseCR(cr) {
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  return parseFloat(cr) || 0;
}

/**
 * Build an action item for the monster.
 */
function buildActionItem(action, type = "natural") {
  const item = {
    name: action.name,
    type: "feat",
    system: {
      description: { value: action.desc || "" },
      source: { custom: "Compendium Importer" },
      activation: { type: "action", cost: 1 },
      type: {
        value: type === "legendary" ? "legendary" : type === "lair" ? "lair" : "monster",
      },
    },
  };

  // Try to parse attack bonus and damage from desc
  const atkMatch = action.desc?.match(/\+(\d+) to hit/);
  if (atkMatch) {
    item.system.actionType = action.desc.match(/melee/i) ? "mwak" : "rwak";
    item.system.attack = { bonus: atkMatch[1], flat: true };
  }

  // Parse damage
  const dmgMatch = action.desc?.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+(\w+)\s+damage/i);
  if (dmgMatch) {
    const dmgFormula = dmgMatch[1].replace(/\s+/g, "");
    const dmgType = dmgMatch[2].toLowerCase();
    item.system.damage = {
      parts: [[dmgFormula, dmgType]],
    };
  }

  // Parse reach/range
  const reachMatch = action.desc?.match(/reach\s+(\d+)\s*ft/i);
  const rangeMatch = action.desc?.match(/range\s+(\d+)\/(\d+)\s*ft/i);
  if (reachMatch) {
    item.system.range = { value: parseInt(reachMatch[1]), units: "ft" };
  } else if (rangeMatch) {
    item.system.range = {
      value: parseInt(rangeMatch[1]),
      long: parseInt(rangeMatch[2]),
      units: "ft",
    };
  }

  return item;
}

/**
 * Parse skill proficiencies from Open5e skills object.
 */
function parseSkills(skills) {
  if (!skills) return {};
  const result = {};
  const SKILL_MAP = {
    acrobatics: "acr", "animal handling": "ani", arcana: "arc",
    athletics: "ath", deception: "dec", history: "his",
    insight: "ins", intimidation: "itm", investigation: "inv",
    medicine: "med", nature: "nat", perception: "prc",
    performance: "prf", persuasion: "per", religion: "rel",
    "sleight of hand": "slt", stealth: "ste", survival: "sur",
  };

  for (const [name, val] of Object.entries(skills)) {
    const key = SKILL_MAP[name.toLowerCase()];
    if (key) {
      result[key] = { value: 1, bonus: val };
    }
  }
  return result;
}

/**
 * Main mapper: Open5e monster → dnd5e Actor data.
 */
export function mapMonster(data) {
  const cr = parseCR(data.challenge_rating);

  // Build abilities
  const abilities = {};
  for (const [long, short] of Object.entries(ABILITY_MAP)) {
    abilities[short] = {
      value: data[long] ?? 10,
    };
  }

  // Build items from actions
  const items = [];

  if (data.actions) {
    for (const action of data.actions) {
      items.push(buildActionItem(action, "natural"));
    }
  }

  if (data.legendary_actions) {
    for (const action of data.legendary_actions) {
      items.push(buildActionItem(action, "legendary"));
    }
  }

  if (data.special_abilities) {
    for (const ability of data.special_abilities) {
      items.push({
        name: ability.name,
        type: "feat",
        system: {
          description: { value: ability.desc || "" },
          type: { value: "monster" },
          activation: { type: "special" },
        },
      });
    }
  }

  if (data.reactions) {
    for (const reaction of data.reactions) {
      items.push({
        name: reaction.name,
        type: "feat",
        system: {
          description: { value: reaction.desc || "" },
          type: { value: "monster" },
          activation: { type: "reaction", cost: 1 },
        },
      });
    }
  }

  // Build legendary action description
  let legendaryDesc = "";
  if (data.legendary_desc) {
    legendaryDesc = data.legendary_desc;
  }

  // Build lair actions description
  let lairDesc = "";
  if (data.lair_desc) {
    lairDesc = data.lair_desc;
  }
  if (data.lair_actions) {
    for (const action of data.lair_actions) {
      items.push(buildActionItem(action, "lair"));
    }
  }

  // Parse saving throws
  const saves = {};
  const saveFields = {
    strength_save: "str", dexterity_save: "dex", constitution_save: "con",
    intelligence_save: "int", wisdom_save: "wis", charisma_save: "cha",
  };
  for (const [field, short] of Object.entries(saveFields)) {
    if (data[field] != null) {
      saves[short] = { value: 1, bonus: data[field] };
    }
  }

  // Build the actor data
  const actorData = {
    name: data.name,
    type: "npc",
    system: {
      abilities,
      attributes: {
        ac: parseAC(data),
        hp: {
          value: data.hit_points ?? 10,
          max: data.hit_points ?? 10,
          formula: data.hit_dice ?? "",
        },
        movement: parseSpeed(data.speed),
        senses: parseSenses(data.senses ?? ""),
      },
      details: {
        biography: {
          value: buildBiography(data),
        },
        cr,
        type: {
          value: (data.type ?? "").toLowerCase(),
          subtype: data.subtype ?? "",
        },
        alignment: ALIGNMENT_MAP[(data.alignment ?? "").toLowerCase()] ?? "",
        source: { custom: data.document__slug ?? "Open5e SRD" },
      },
      traits: {
        size: SIZE_MAP[data.size] ?? "med",
        languages: {
          value: parseLanguages(data.languages ?? ""),
          custom: data.languages ?? "",
        },
        di: { value: parseDamageTypes(data.damage_immunities ?? "") },
        dr: { value: parseDamageTypes(data.damage_resistances ?? "") },
        dv: { value: parseDamageTypes(data.damage_vulnerabilities ?? "") },
        ci: { value: parseConditions(data.condition_immunities ?? "") },
      },
      skills: parseSkills(data.skills),
    },
    items,
    prpiority: {},
  };

  return actorData;
}

/**
 * Build biography HTML from monster data.
 */
function buildBiography(data) {
  const parts = [];

  if (data.size || data.type) {
    parts.push(`<p><em>${data.size ?? ""} ${data.type ?? ""}${data.subtype ? ` (${data.subtype})` : ""}, ${data.alignment ?? ""}</em></p>`);
  }

  if (data.legendary_desc) {
    parts.push(`<h3>Legendary Actions</h3><p>${data.legendary_desc}</p>`);
  }

  if (data.lair_desc) {
    parts.push(`<h3>Lair Actions</h3><p>${data.lair_desc}</p>`);
  }

  if (data.desc) {
    parts.push(`<h3>Description</h3><p>${data.desc}</p>`);
  }

  return parts.join("\n");
}

function parseLanguages(langStr) {
  if (!langStr) return [];
  const known = [
    "common", "dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling",
    "orc", "abyssal", "celestial", "draconic", "deep speech", "infernal",
    "primordial", "sylvan", "undercommon", "auran", "aquan", "ignan", "terran",
  ];
  const result = [];
  const lower = langStr.toLowerCase();
  for (const lang of known) {
    if (lower.includes(lang)) result.push(lang);
  }
  return result;
}

function parseDamageTypes(str) {
  if (!str) return [];
  const types = [
    "acid", "bludgeoning", "cold", "fire", "force", "lightning",
    "necrotic", "piercing", "poison", "psychic", "radiant",
    "slashing", "thunder",
  ];
  const result = [];
  const lower = str.toLowerCase();
  for (const t of types) {
    if (lower.includes(t)) result.push(t);
  }
  return result;
}

function parseConditions(str) {
  if (!str) return [];
  const conditions = [
    "blinded", "charmed", "deafened", "exhaustion", "frightened",
    "grappled", "incapacitated", "invisible", "paralyzed", "petrified",
    "poisoned", "prone", "restrained", "stunned", "unconscious",
  ];
  const result = [];
  const lower = str.toLowerCase();
  for (const c of conditions) {
    if (lower.includes(c)) result.push(c);
  }
  return result;
}

/**
 * Generate a preview HTML stat block.
 */
export function previewMonster(data) {
  const hp = data.hit_points ?? "?";
  const hd = data.hit_dice ?? "";
  const ac = data.armor_class ?? "?";
  const acDesc = data.armor_desc ? ` (${data.armor_desc})` : "";

  let html = `<div class="ci-stat-block">`;
  html += `<h2 class="ci-stat-name">${data.name}</h2>`;
  html += `<p class="ci-stat-meta"><em>${data.size ?? ""} ${data.type ?? ""}${data.subtype ? ` (${data.subtype})` : ""}, ${data.alignment ?? ""}</em></p>`;
  html += `<div class="ci-stat-divider"></div>`;
  html += `<p><strong>Armor Class</strong> ${ac}${acDesc}</p>`;
  html += `<p><strong>Hit Points</strong> ${hp}${hd ? ` (${hd})` : ""}</p>`;

  // Speed
  let speedStr = "";
  if (data.speed) {
    if (typeof data.speed === "object") {
      speedStr = Object.entries(data.speed)
        .filter(([k, v]) => k !== "hover" && k !== "notes" && v)
        .map(([k, v]) => (k === "walk" ? `${v} ft.` : `${k} ${v} ft.`))
        .join(", ");
      if (data.speed.hover) speedStr += " (hover)";
    } else {
      speedStr = data.speed;
    }
  }
  html += `<p><strong>Speed</strong> ${speedStr}</p>`;

  html += `<div class="ci-stat-divider"></div>`;

  // Abilities
  html += `<table class="ci-stat-abilities"><thead><tr>`;
  for (const ab of ["STR", "DEX", "CON", "INT", "WIS", "CHA"]) {
    html += `<th>${ab}</th>`;
  }
  html += `</tr></thead><tbody><tr>`;
  for (const ab of ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]) {
    const val = data[ab] ?? 10;
    const mod = Math.floor((val - 10) / 2);
    const sign = mod >= 0 ? "+" : "";
    html += `<td>${val} (${sign}${mod})</td>`;
  }
  html += `</tr></tbody></table>`;

  html += `<div class="ci-stat-divider"></div>`;

  // Saves, skills, senses, languages, CR
  if (data.strength_save != null || data.dexterity_save != null) {
    const saves = [];
    for (const [field, label] of [["strength_save","Str"],["dexterity_save","Dex"],["constitution_save","Con"],["intelligence_save","Int"],["wisdom_save","Wis"],["charisma_save","Cha"]]) {
      if (data[field] != null) saves.push(`${label} +${data[field]}`);
    }
    if (saves.length) html += `<p><strong>Saving Throws</strong> ${saves.join(", ")}</p>`;
  }

  if (data.skills && Object.keys(data.skills).length) {
    const skills = Object.entries(data.skills).map(([k, v]) => `${k} +${v}`).join(", ");
    html += `<p><strong>Skills</strong> ${skills}</p>`;
  }

  if (data.damage_resistances) html += `<p><strong>Damage Resistances</strong> ${data.damage_resistances}</p>`;
  if (data.damage_immunities) html += `<p><strong>Damage Immunities</strong> ${data.damage_immunities}</p>`;
  if (data.damage_vulnerabilities) html += `<p><strong>Damage Vulnerabilities</strong> ${data.damage_vulnerabilities}</p>`;
  if (data.condition_immunities) html += `<p><strong>Condition Immunities</strong> ${data.condition_immunities}</p>`;
  if (data.senses) html += `<p><strong>Senses</strong> ${data.senses}</p>`;
  if (data.languages) html += `<p><strong>Languages</strong> ${data.languages}</p>`;
  html += `<p><strong>Challenge</strong> ${data.challenge_rating ?? "?"} (${xpByCR(parseCR(data.challenge_rating))} XP)</p>`;

  html += `<div class="ci-stat-divider"></div>`;

  // Special abilities
  if (data.special_abilities?.length) {
    for (const ab of data.special_abilities) {
      html += `<p><strong><em>${ab.name}.</em></strong> ${ab.desc}</p>`;
    }
  }

  // Actions
  if (data.actions?.length) {
    html += `<h3>Actions</h3>`;
    for (const act of data.actions) {
      html += `<p><strong><em>${act.name}.</em></strong> ${act.desc}</p>`;
    }
  }

  // Reactions
  if (data.reactions?.length) {
    html += `<h3>Reactions</h3>`;
    for (const r of data.reactions) {
      html += `<p><strong><em>${r.name}.</em></strong> ${r.desc}</p>`;
    }
  }

  // Legendary actions
  if (data.legendary_actions?.length) {
    html += `<h3>Legendary Actions</h3>`;
    if (data.legendary_desc) html += `<p>${data.legendary_desc}</p>`;
    for (const la of data.legendary_actions) {
      html += `<p><strong><em>${la.name}.</em></strong> ${la.desc}</p>`;
    }
  }

  html += `</div>`;
  return html;
}

function xpByCR(cr) {
  const table = {
    0: "0 or 10", 0.125: "25", 0.25: "50", 0.5: "100",
    1: "200", 2: "450", 3: "700", 4: "1,100", 5: "1,800",
    6: "2,300", 7: "2,900", 8: "3,900", 9: "5,000", 10: "5,900",
    11: "7,200", 12: "8,400", 13: "10,000", 14: "11,500", 15: "13,000",
    16: "15,000", 17: "18,000", 18: "20,000", 19: "22,000", 20: "25,000",
    21: "33,000", 22: "41,000", 23: "50,000", 24: "62,000", 25: "75,000",
    26: "90,000", 27: "105,000", 28: "120,000", 29: "135,000", 30: "155,000",
  };
  return table[cr] ?? "?";
}
