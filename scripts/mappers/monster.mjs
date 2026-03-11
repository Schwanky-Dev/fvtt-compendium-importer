/**
 * Maps Open5e monster JSON → Foundry dnd5e Actor (NPC) data.
 */

const DEFAULT_ICON = "icons/svg/mystery-man.svg";

const ABILITY_MAP = {
  strength: "str",
  dexterity: "dex",
  constitution: "con",
  intelligence: "int",
  wisdom: "wis",
  charisma: "cha",
};

const ABILITY_NAME_TO_SHORT = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
  str: "str", dex: "dex", con: "con", int: "int", wis: "wis", cha: "cha",
};

const SIZE_MAP = {
  Tiny: "tiny", Small: "sm", Medium: "med",
  Large: "lg", Huge: "huge", Gargantuan: "grg",
};

const ALIGNMENT_MAP = {
  "lawful good": "lg", "neutral good": "ng", "chaotic good": "cg",
  "lawful neutral": "ln", "neutral": "tn", "true neutral": "tn",
  "chaotic neutral": "cn", "lawful evil": "le", "neutral evil": "ne",
  "chaotic evil": "ce", "unaligned": "un", "any alignment": "any",
};

// ─── Speed ────────────────────────────────────────────────────────────────────

function parseSpeed(speedObj) {
  if (!speedObj) return { value: 30, units: "ft" };
  if (typeof speedObj === "string") {
    const match = speedObj.match(/(\d+)/);
    return { value: match ? parseInt(match[1]) : 30, units: "ft" };
  }
  const result = {
    value: speedObj.walk !== undefined
      ? (typeof speedObj.walk === "number" ? speedObj.walk : parseInt(speedObj.walk) || 30)
      : 30,
    units: "ft",
  };
  for (const [key, val] of Object.entries(speedObj)) {
    if (key === "walk" || key === "hover" || key === "notes") continue;
    const num = typeof val === "number" ? val : parseInt(val);
    if (!isNaN(num) && num > 0) result[key] = num;
  }
  if (speedObj.hover) result.hover = true;
  return result;
}

// ─── AC ───────────────────────────────────────────────────────────────────────

function parseAC(monster) {
  let raw = monster.armor_class ?? 10;
  if (typeof raw === "string") {
    const m = raw.match(/(\d+)/);
    raw = m ? parseInt(m[1]) : 10;
  }
  return { flat: typeof raw === "number" ? raw : parseInt(raw) || 10, calc: "flat", formula: "" };
}

// ─── Senses ───────────────────────────────────────────────────────────────────

function parseSenses(sensesStr) {
  const senses = { darkvision: 0, blindsight: 0, tremorsense: 0, truesight: 0, units: "ft", special: "" };
  if (!sensesStr) return senses;
  for (const part of sensesStr.split(",").map(s => s.trim())) {
    const lower = part.toLowerCase();
    for (const sense of ["darkvision", "blindsight", "tremorsense", "truesight"]) {
      if (lower.startsWith(sense)) {
        const m = part.match(/(\d+)/);
        if (m) senses[sense] = parseInt(m[1]);
      }
    }
  }
  return senses;
}

// ─── CR helpers ───────────────────────────────────────────────────────────────

function parseCR(cr) {
  if (cr === "1/8") return 0.125;
  if (cr === "1/4") return 0.25;
  if (cr === "1/2") return 0.5;
  return parseFloat(cr) || 0;
}

// ─── Icon resolution ──────────────────────────────────────────────────────────

/**
 * Returns the preferred path if it starts with "icons/" (Foundry core, always exists).
 * Falls back through alternatives, ultimately to DEFAULT_ICON.
 */
function resolveIcon(preferredPath, ...fallbacks) {
  for (const p of [preferredPath, ...fallbacks]) {
    if (p && typeof p === "string" && p.startsWith("icons/")) return p;
  }
  return DEFAULT_ICON;
}

/** All paths below MUST start with "icons/" (Foundry core). */
const ICON_MAP = {
  bite: "icons/skills/melee/mouth-bite-fangs-red.webp",
  claw: "icons/skills/melee/strike-claw-red.webp",
  claws: "icons/skills/melee/strike-claw-red.webp",
  tail: "icons/skills/melee/strike-chain-yellow.webp",
  slam: "icons/skills/melee/unarmed-punch-fist.webp",
  fist: "icons/skills/melee/unarmed-punch-fist.webp",
  gore: "icons/skills/melee/strike-polearm-light.webp",
  sting: "icons/skills/melee/strike-dagger-red.webp",
  tentacle: "icons/skills/melee/strike-whip-gray.webp",
  tentacles: "icons/skills/melee/strike-whip-gray.webp",
  shortsword: "icons/weapons/swords/shortsword-guard-worn.webp",
  longsword: "icons/weapons/swords/longsword-guard-broad.webp",
  greatsword: "icons/weapons/swords/greatsword-crossguard-steel.webp",
  scimitar: "icons/weapons/swords/scimitar-worn.webp",
  dagger: "icons/weapons/daggers/dagger-broad-bronze.webp",
  greataxe: "icons/weapons/axes/axe-broad-brown.webp",
  handaxe: "icons/weapons/axes/hatchet-broad-brown.webp",
  battleaxe: "icons/weapons/axes/axe-broad-brown.webp",
  mace: "icons/weapons/maces/mace-round-spiked-black.webp",
  morningstar: "icons/weapons/maces/mace-round-spiked-black.webp",
  warhammer: "icons/weapons/hammers/hammer-war-spiked.webp",
  maul: "icons/weapons/hammers/hammer-war-spiked.webp",
  club: "icons/weapons/clubs/club-heavy-barbed-brown.webp",
  greatclub: "icons/weapons/clubs/club-heavy-barbed-brown.webp",
  quarterstaff: "icons/weapons/staves/staff-simple.webp",
  staff: "icons/weapons/staves/staff-simple.webp",
  spear: "icons/weapons/polearms/spear-simple.webp",
  javelin: "icons/weapons/polearms/javelin-simple.webp",
  pike: "icons/weapons/polearms/pike-flared.webp",
  halberd: "icons/weapons/polearms/halberd-crescent.webp",
  glaive: "icons/weapons/polearms/glaive-winged.webp",
  trident: "icons/weapons/polearms/trident-silver.webp",
  lance: "icons/weapons/polearms/lance-simple.webp",
  whip: "icons/weapons/misc/whip-pointed-brown.webp",
  longbow: "icons/weapons/bows/longbow-recurve.webp",
  shortbow: "icons/weapons/bows/shortbow-recurve.webp",
  "light crossbow": "icons/weapons/crossbows/crossbow-simple-brown.webp",
  "heavy crossbow": "icons/weapons/crossbows/crossbow-heavy-brown.webp",
  crossbow: "icons/weapons/crossbows/crossbow-simple-brown.webp",
  sling: "icons/weapons/slings/sling-simple-leather.webp",
  rock: "icons/weapons/ammunition/rock-smooth.webp",
  "breath weapon": "icons/magic/fire/beam-jet-stream-embers.webp",
  "fire breath": "icons/magic/fire/beam-jet-stream-embers.webp",
  "cold breath": "icons/magic/water/projectile-icecicle.webp",
  "lightning breath": "icons/magic/lightning/bolt-strike-blue.webp",
  "acid breath": "icons/magic/acid/projectile-faceted-glob.webp",
  "poison breath": "icons/magic/acid/projectile-faceted-glob.webp",
  "frightful presence": "icons/magic/control/fear-fright-shadow-monster.webp",
  "eye rays": "icons/magic/perception/eye-ringed-glow-angry-small.webp",
};

const DAMAGE_TYPE_ICONS = {
  fire: "icons/magic/fire/beam-jet-stream-embers.webp",
  cold: "icons/magic/water/projectile-icecicle.webp",
  lightning: "icons/magic/lightning/bolt-strike-blue.webp",
  thunder: "icons/magic/sonic/explosion-shock-wave-silhouette.webp",
  acid: "icons/magic/acid/projectile-faceted-glob.webp",
  poison: "icons/magic/acid/projectile-faceted-glob.webp",
  necrotic: "icons/magic/unholy/strike-body-life-soul.webp",
  radiant: "icons/magic/holy/projectiles-blades-702702.webp",
  psychic: "icons/magic/control/fear-fright-shadow-monster.webp",
  force: "icons/magic/sonic/explosion-shock-wave-silhouette.webp",
  bludgeoning: "icons/skills/melee/unarmed-punch-fist.webp",
  piercing: "icons/skills/melee/strike-dagger-red.webp",
  slashing: "icons/skills/melee/strike-claw-red.webp",
};

const DEFAULT_MELEE_ICON = "icons/skills/melee/unarmed-punch-fist.webp";
const DEFAULT_RANGED_ICON = "icons/weapons/bows/shortbow-recurve.webp";
const DEFAULT_SPELL_ICON = "icons/magic/symbols/runes-star-pentagon-blue.webp";
const DEFAULT_FEAT_ICON = "icons/skills/targeting/target-strike-triple-blue.webp";

function pickActionIcon(action) {
  const name = (action.name ?? "").toLowerCase().trim();
  const desc = (action.desc ?? "").toLowerCase();

  if (ICON_MAP[name]) return resolveIcon(ICON_MAP[name]);
  for (const [key, icon] of Object.entries(ICON_MAP)) {
    if (name.includes(key)) return resolveIcon(icon);
  }
  const dmgMatch = desc.match(/(\w+)\s+damage/i);
  if (dmgMatch) {
    const dt = dmgMatch[1].toLowerCase();
    if (DAMAGE_TYPE_ICONS[dt]) return resolveIcon(DAMAGE_TYPE_ICONS[dt]);
  }
  if (/melee.*attack/i.test(desc)) return DEFAULT_MELEE_ICON;
  if (/ranged.*attack/i.test(desc)) return DEFAULT_RANGED_ICON;
  if (/spell|spellcasting/i.test(desc)) return DEFAULT_SPELL_ICON;
  return DEFAULT_FEAT_ICON;
}

// ─── Action / Attack Parsing ──────────────────────────────────────────────────

/**
 * Determine the dnd5e action type from a description string.
 */
function parseActionType(desc) {
  if (!desc) return null;
  if (/Melee or Ranged Weapon Attack/i.test(desc)) return "mwak";
  if (/Melee Weapon Attack/i.test(desc)) return "mwak";
  if (/Ranged Weapon Attack/i.test(desc)) return "rwak";
  if (/Melee Spell Attack/i.test(desc)) return "msak";
  if (/Ranged Spell Attack/i.test(desc)) return "rsak";
  if (/DC\s*\d+\s*\w+\s*saving throw/i.test(desc)) return "save";
  return null;
}

/**
 * Parse attack bonus from description.
 */
function parseAttackBonus(desc) {
  const m = desc?.match(/\+(\d+) to hit/i);
  return m ? m[1] : null;
}

/**
 * Parse primary and additional damage from a Hit: line.
 */
function parseDamage(desc) {
  if (!desc) return { parts: [], versatile: "" };
  const parts = [];
  let versatile = "";

  // Primary damage: "Hit: 6 (1d8 + 2) slashing damage"
  const primary = desc.match(/Hit:\s*\d+\s*\((\d+d\d+(?:\s*[+\-]\s*\d+)?)\)\s*(\w+)\s*damage/i);
  if (primary) {
    parts.push([primary[1].replace(/\s+/g, ""), primary[2].toLowerCase()]);
  }

  // Versatile: "or 7 (1d10 + 2) slashing damage if used with two hands"
  const vers = desc.match(/or\s+\d+\s*\((\d+d\d+(?:\s*[+\-]\s*\d+)?)\)\s*\w+\s*damage\s+if used with two hands/i);
  if (vers) {
    versatile = vers[1].replace(/\s+/g, "");
  }

  // Additional damage: "plus 3 (1d6) fire damage"
  const addlRe = /plus\s+\d+\s*\((\d+d\d+(?:\s*[+\-]\s*\d+)?)\)\s*(\w+)\s*damage/gi;
  let addl;
  while ((addl = addlRe.exec(desc)) !== null) {
    parts.push([addl[1].replace(/\s+/g, ""), addl[2].toLowerCase()]);
  }

  // For save-based abilities without "Hit:" line, parse "take X (dice) type damage"
  if (parts.length === 0) {
    const saveDmg = desc.match(/(?:takes?|taking|deals?)\s+\d+\s*\((\d+d\d+(?:\s*[+\-]\s*\d+)?)\)\s*(\w+)\s*damage/i);
    if (saveDmg) {
      parts.push([saveDmg[1].replace(/\s+/g, ""), saveDmg[2].toLowerCase()]);
    }
  }

  return { parts, versatile };
}

/**
 * Parse range from description.
 */
function parseRange(desc) {
  if (!desc) return null;
  const ranged = desc.match(/range\s+(\d+)\/(\d+)\s*ft/i);
  if (ranged) return { value: parseInt(ranged[1]), long: parseInt(ranged[2]), units: "ft" };
  const rangedSimple = desc.match(/range\s+(\d+)\s*ft/i);
  if (rangedSimple) return { value: parseInt(rangedSimple[1]), units: "ft" };
  const reach = desc.match(/reach\s+(\d+)\s*ft/i);
  if (reach) return { value: parseInt(reach[1]), units: "ft" };
  return null;
}

/**
 * Parse save DC from description.
 */
function parseSaveDC(desc) {
  if (!desc) return null;
  const m = desc.match(/DC\s*(\d+)\s*(\w+)\s*saving throw/i);
  if (!m) return null;
  const ability = ABILITY_NAME_TO_SHORT[m[2].toLowerCase()];
  return ability ? { ability, dc: parseInt(m[1]), scaling: "flat" } : null;
}

/**
 * Parse area-of-effect target from description.
 */
function parseAoETarget(desc) {
  if (!desc) return null;
  const m = desc.match(/(\d+)-foot[- ]?(cone|line|cube|sphere|radius)/i);
  if (!m) return null;
  return { value: parseInt(m[1]), type: m[2].toLowerCase(), units: "ft" };
}

/**
 * Build a fully-populated action item for a monster.
 */
function buildActionItem(action, type = "natural") {
  const desc = action.desc || "";
  const actionType = parseActionType(desc);
  const isWeaponAttack = actionType === "mwak" || actionType === "rwak";
  const isSave = actionType === "save";

  const item = {
    name: action.name,
    type: isWeaponAttack ? "weapon" : "feat",
    img: pickActionIcon(action),
    system: {
      description: { value: desc },
      source: { custom: "Compendium Importer" },
      activation: {
        type: type === "legendary" ? "legendary" : type === "lair" ? "lair" : "action",
        cost: 1,
      },
    },
  };

  // For feat-type items, set the subtype
  if (item.type === "feat") {
    item.system.type = {
      value: type === "legendary" ? "legendary" : type === "lair" ? "lair" : "monster",
    };
  }

  // Legendary action cost
  if (type === "legendary") {
    const costMatch = desc.match(/costs?\s+(\d+)\s+actions?/i);
    if (costMatch) item.system.activation.cost = parseInt(costMatch[1]);
  }

  // Action type
  if (actionType) {
    item.system.actionType = actionType;
  }

  // Attack bonus (weapon and spell attacks)
  if (isWeaponAttack || actionType === "msak" || actionType === "rsak") {
    const bonus = parseAttackBonus(desc);
    if (bonus) {
      item.system.attack = { bonus, flat: true };
      item.system.ability = ""; // flat bonus, don't derive from ability
    }
  }

  // Damage
  const { parts, versatile } = parseDamage(desc);
  if (parts.length > 0) {
    item.system.damage = { parts };
    if (versatile) item.system.damage.versatile = versatile;
  }

  // Range
  const range = parseRange(desc);
  if (range) item.system.range = range;

  // Target
  if (isWeaponAttack || actionType === "msak" || actionType === "rsak") {
    item.system.target = { value: 1, type: "creature" };
  }

  // Save DC
  if (isSave) {
    const save = parseSaveDC(desc);
    if (save) item.system.save = save;
    // AoE target
    const aoe = parseAoETarget(desc);
    if (aoe) item.system.target = aoe;
  }

  return item;
}

// ─── Skills ───────────────────────────────────────────────────────────────────

function parseSkills(skills) {
  if (!skills) return {};
  const SKILL_MAP = {
    acrobatics: "acr", "animal handling": "ani", arcana: "arc",
    athletics: "ath", deception: "dec", history: "his",
    insight: "ins", intimidation: "itm", investigation: "inv",
    medicine: "med", nature: "nat", perception: "prc",
    performance: "prf", persuasion: "per", religion: "rel",
    "sleight of hand": "slt", stealth: "ste", survival: "sur",
  };
  const result = {};
  for (const [name, val] of Object.entries(skills)) {
    const key = SKILL_MAP[name.toLowerCase()];
    if (key) result[key] = { value: 1, bonus: val };
  }
  return result;
}

// ─── Spellcasting Parser ──────────────────────────────────────────────────────

/**
 * Parse spellcasting from special_abilities and spell_list.
 * Returns { spellcastingAbility, spellDC, spellAttackBonus, spellSlots, spellNames }
 * where spellNames is an array of { name, mode, uses } objects.
 *   mode: "prepared" (regular slots), "innate" (innate), "atwill" (at-will/cantrip)
 *   uses: null for prepared/cantrip, number for innate (X/day)
 */
export function parseSpellcasting(specialAbilities) {
  if (!specialAbilities || !specialAbilities.length) return null;

  const scAbilities = specialAbilities.filter(a =>
    /spellcasting|innate spellcasting/i.test(a.name)
  );
  if (scAbilities.length === 0) return null;

  let spellcastingAbility = null;
  let spellDC = null;
  let spellAttackBonus = null;
  const spellSlots = {}; // { spell1: { value: N, max: N }, ... }
  const spellNames = [];

  for (const ab of scAbilities) {
    const desc = ab.desc || "";
    const isInnate = /innate/i.test(ab.name);

    // Parse spellcasting ability
    let abMatch = desc.match(/(\w+)\s+is\s+(?:their|its|his|her)\s+spellcasting ability/i);
    if (!abMatch) abMatch = desc.match(/spellcasting ability is (\w+)/i);
    if (abMatch && !spellcastingAbility) {
      spellcastingAbility = ABILITY_NAME_TO_SHORT[abMatch[1].toLowerCase()] || null;
    }

    // Parse spell save DC
    const dcMatch = desc.match(/spell save DC\s*(\d+)/i);
    if (dcMatch && !spellDC) spellDC = parseInt(dcMatch[1]);

    // Parse spell attack bonus
    const atkMatch = desc.match(/\+(\d+)\s+to hit with spell attacks/i);
    if (atkMatch && !spellAttackBonus) spellAttackBonus = parseInt(atkMatch[1]);

    if (isInnate) {
      // "At will: detect magic, mage hand"
      const atWillMatch = desc.match(/At will:\s*(.+)/im);
      if (atWillMatch) {
        for (const name of splitSpellList(atWillMatch[1])) {
          spellNames.push({ name, mode: "atwill", uses: null });
        }
      }
      // "3/day each: counterspell, fireball"
      const dailyRe = /(\d+)\/day(?:\s+each)?:\s*(.+)/gim;
      let dailyMatch;
      while ((dailyMatch = dailyRe.exec(desc)) !== null) {
        const uses = parseInt(dailyMatch[1]);
        for (const name of splitSpellList(dailyMatch[2])) {
          spellNames.push({ name, mode: "innate", uses });
        }
      }
    } else {
      // Regular spellcasting
      // "Cantrips (at will): fire bolt, light, mage hand"
      const cantripMatch = desc.match(/Cantrips\s*\(at will\):\s*(.+)/im);
      if (cantripMatch) {
        for (const name of splitSpellList(cantripMatch[1])) {
          spellNames.push({ name, mode: "atwill", uses: null });
        }
      }

      // "1st level (4 slots): detect magic, mage armor"
      const slotRe = /(\d+)(?:st|nd|rd|th) level \((\d+) slots?\):\s*(.+)/gim;
      let slotMatch;
      while ((slotMatch = slotRe.exec(desc)) !== null) {
        const level = parseInt(slotMatch[1]);
        const slots = parseInt(slotMatch[2]);
        spellSlots[`spell${level}`] = { value: slots, max: slots };
        for (const name of splitSpellList(slotMatch[3])) {
          spellNames.push({ name, mode: "prepared", uses: null, level });
        }
      }
    }
  }

  if (spellNames.length === 0) return null;

  return { spellcastingAbility, spellDC, spellAttackBonus, spellSlots, spellNames };
}

/**
 * Split a comma-separated spell list, stopping at newlines or next section headers.
 */
function splitSpellList(str) {
  // Strip leading bullet markers ("* ") and cut at first newline
  let cut = str.replace(/^[\s*•]+/, "").split(/[\n\r]/)[0];
  return cut.split(",")
    .map(s => s
      .replace(/\*+/g, "")           // remove asterisks (material component markers)
      .replace(/\([^)]*\)/g, "")     // remove parenthetical notes like (ritual)
      .trim()
      .toLowerCase()
    )
    .filter(s =>
      s.length > 0 &&
      s.length <= 50 &&              // real spell names are short
      !s.match(/^\d/) &&             // filter stray numbers
      !s.includes("•") &&            // no bullet separators
      !/\d+\s*(st|nd|rd|th)\s+level/i.test(s) && // no level headers
      !/\bslots?\b/i.test(s)         // no slot references
    );
}

// ─── Main Mapper ──────────────────────────────────────────────────────────────

/**
 * Main mapper: Open5e monster → dnd5e Actor data.
 * Returns { actorData, spellcasting } where spellcasting may be null.
 * The importer uses spellcasting for async spell lookups.
 */
export function mapMonster(data) {
  const cr = parseCR(data.challenge_rating);

  // Build abilities
  const abilities = {};
  for (const [long, short] of Object.entries(ABILITY_MAP)) {
    abilities[short] = { value: data[long] ?? 10 };
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
      // Skip spellcasting entries — they'll be handled separately
      if (/^(?:innate )?spellcasting$/i.test(ability.name)) continue;
      items.push({
        name: ability.name,
        type: "feat",
        img: pickActionIcon(ability),
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
        img: pickActionIcon(reaction),
        system: {
          description: { value: reaction.desc || "" },
          type: { value: "monster" },
          activation: { type: "reaction", cost: 1 },
        },
      });
    }
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
    if (data[field] != null) saves[short] = { value: 1, bonus: data[field] };
  }

  // Parse spellcasting
  const spellcasting = parseSpellcasting(data.special_abilities);

  // Build base actor data
  const actorData = {
    name: data.name,
    type: "npc",
    img: DEFAULT_ICON,
    prototypeToken: { texture: { src: DEFAULT_ICON } },
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
        biography: { value: buildBiography(data) },
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
  };

  // Apply spellcasting attributes to actor data
  if (spellcasting) {
    if (spellcasting.spellcastingAbility) {
      actorData.system.attributes.spellcasting = spellcasting.spellcastingAbility;
    }
    if (Object.keys(spellcasting.spellSlots).length > 0) {
      actorData.system.spells = spellcasting.spellSlots;
    }
  }

  return { actorData, spellcasting };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildBiography(data) {
  const parts = [];
  if (data.size || data.type) {
    parts.push(`<p><em>${data.size ?? ""} ${data.type ?? ""}${data.subtype ? ` (${data.subtype})` : ""}, ${data.alignment ?? ""}</em></p>`);
  }
  if (data.armor_desc) parts.push(`<p><strong>Armor:</strong> ${data.armor_desc}</p>`);
  if (data.legendary_desc) parts.push(`<h3>Legendary Actions</h3><p>${data.legendary_desc}</p>`);
  if (data.lair_desc) parts.push(`<h3>Lair Actions</h3><p>${data.lair_desc}</p>`);
  if (data.desc) parts.push(`<h3>Description</h3><p>${data.desc}</p>`);
  return parts.join("\n");
}

function parseLanguages(langStr) {
  if (!langStr) return [];
  const known = [
    "common", "dwarvish", "elvish", "giant", "gnomish", "goblin", "halfling",
    "orc", "abyssal", "celestial", "draconic", "deep speech", "infernal",
    "primordial", "sylvan", "undercommon", "auran", "aquan", "ignan", "terran",
  ];
  const lower = langStr.toLowerCase();
  return known.filter(l => lower.includes(l));
}

function parseDamageTypes(str) {
  if (!str) return [];
  const types = [
    "acid", "bludgeoning", "cold", "fire", "force", "lightning",
    "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
  ];
  const lower = str.toLowerCase();
  return types.filter(t => lower.includes(t));
}

function parseConditions(str) {
  if (!str) return [];
  const conditions = [
    "blinded", "charmed", "deafened", "exhaustion", "frightened",
    "grappled", "incapacitated", "invisible", "paralyzed", "petrified",
    "poisoned", "prone", "restrained", "stunned", "unconscious",
  ];
  const lower = str.toLowerCase();
  return conditions.filter(c => lower.includes(c));
}

// ─── Preview (unchanged from original) ───────────────────────────────────────

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

  html += `<table class="ci-stat-abilities"><thead><tr>`;
  for (const ab of ["STR", "DEX", "CON", "INT", "WIS", "CHA"]) html += `<th>${ab}</th>`;
  html += `</tr></thead><tbody><tr>`;
  for (const ab of ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"]) {
    const val = data[ab] ?? 10;
    const mod = Math.floor((val - 10) / 2);
    html += `<td>${val} (${mod >= 0 ? "+" : ""}${mod})</td>`;
  }
  html += `</tr></tbody></table>`;
  html += `<div class="ci-stat-divider"></div>`;

  if (data.strength_save != null || data.dexterity_save != null) {
    const saves = [];
    for (const [field, label] of [["strength_save","Str"],["dexterity_save","Dex"],["constitution_save","Con"],["intelligence_save","Int"],["wisdom_save","Wis"],["charisma_save","Cha"]]) {
      if (data[field] != null) saves.push(`${label} +${data[field]}`);
    }
    if (saves.length) html += `<p><strong>Saving Throws</strong> ${saves.join(", ")}</p>`;
  }
  if (data.skills && Object.keys(data.skills).length) {
    html += `<p><strong>Skills</strong> ${Object.entries(data.skills).map(([k, v]) => `${k} +${v}`).join(", ")}</p>`;
  }
  if (data.damage_resistances) html += `<p><strong>Damage Resistances</strong> ${data.damage_resistances}</p>`;
  if (data.damage_immunities) html += `<p><strong>Damage Immunities</strong> ${data.damage_immunities}</p>`;
  if (data.damage_vulnerabilities) html += `<p><strong>Damage Vulnerabilities</strong> ${data.damage_vulnerabilities}</p>`;
  if (data.condition_immunities) html += `<p><strong>Condition Immunities</strong> ${data.condition_immunities}</p>`;
  if (data.senses) html += `<p><strong>Senses</strong> ${data.senses}</p>`;
  if (data.languages) html += `<p><strong>Languages</strong> ${data.languages}</p>`;
  html += `<p><strong>Challenge</strong> ${data.challenge_rating ?? "?"} (${xpByCR(parseCR(data.challenge_rating))} XP)</p>`;
  html += `<div class="ci-stat-divider"></div>`;

  if (data.special_abilities?.length) {
    for (const ab of data.special_abilities) html += `<p><strong><em>${ab.name}.</em></strong> ${ab.desc}</p>`;
  }
  if (data.actions?.length) {
    html += `<h3>Actions</h3>`;
    for (const act of data.actions) html += `<p><strong><em>${act.name}.</em></strong> ${act.desc}</p>`;
  }
  if (data.reactions?.length) {
    html += `<h3>Reactions</h3>`;
    for (const r of data.reactions) html += `<p><strong><em>${r.name}.</em></strong> ${r.desc}</p>`;
  }
  if (data.legendary_actions?.length) {
    html += `<h3>Legendary Actions</h3>`;
    if (data.legendary_desc) html += `<p>${data.legendary_desc}</p>`;
    for (const la of data.legendary_actions) html += `<p><strong><em>${la.name}.</em></strong> ${la.desc}</p>`;
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
