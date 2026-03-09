/**
 * Maps Open5e spell JSON → Foundry dnd5e Item (spell) data.
 */

const SCHOOL_MAP = {
  Abjuration: "abj",
  Conjuration: "con",
  Divination: "div",
  Enchantment: "enc",
  Evocation: "evo",
  Illusion: "ill",
  Necromancy: "nec",
  Transmutation: "trs",
};

/**
 * Parse casting time string like "1 action", "1 bonus action", "1 reaction", "1 minute"
 */
function parseActivation(castingTime) {
  if (!castingTime) return { type: "action", cost: 1 };

  const lower = castingTime.toLowerCase();
  const numMatch = lower.match(/^(\d+)\s+/);
  const cost = numMatch ? parseInt(numMatch[1]) : 1;

  if (lower.includes("bonus action")) return { type: "bonus", cost };
  if (lower.includes("reaction")) return { type: "reaction", cost };
  if (lower.includes("minute")) return { type: "minute", cost };
  if (lower.includes("hour")) return { type: "hour", cost };
  if (lower.includes("action")) return { type: "action", cost };
  // Ritual or special
  return { type: "action", cost: 1 };
}

/**
 * Parse range string: "120 feet", "Self", "Touch", "Self (30-foot radius)", "Unlimited"
 */
function parseRange(rangeStr) {
  if (!rangeStr) return { value: null, units: "", long: null };

  const lower = rangeStr.toLowerCase();
  if (lower === "self") return { value: null, units: "self", long: null };
  if (lower === "touch") return { value: null, units: "touch", long: null };
  if (lower === "unlimited" || lower === "sight") return { value: null, units: "any", long: null };
  if (lower === "special") return { value: null, units: "spec", long: null };

  // "Self (30-foot radius)" etc.
  if (lower.startsWith("self")) {
    return { value: null, units: "self", long: null };
  }

  const match = rangeStr.match(/(\d+)\s*(feet|foot|ft|miles?|mi)/i);
  if (match) {
    const units = match[2].toLowerCase().startsWith("mi") ? "mi" : "ft";
    return { value: parseInt(match[1]), units, long: null };
  }

  return { value: null, units: "", long: null };
}

/**
 * Parse area of effect from range or desc: "Self (30-foot radius)"
 */
function parseTarget(rangeStr, desc) {
  const result = { value: null, units: "ft", type: "", width: null };

  if (rangeStr) {
    const aoeMatch = rangeStr.match(/(\d+)-foot[- ](radius|cone|cube|line|sphere|cylinder)/i);
    if (aoeMatch) {
      result.value = parseInt(aoeMatch[1]);
      result.type = aoeMatch[2].toLowerCase();
      if (result.type === "radius") result.type = "sphere";
    }
  }

  return result;
}

/**
 * Parse duration: "Instantaneous", "1 minute", "Concentration, up to 1 hour", "Until dispelled"
 */
function parseDuration(durationStr) {
  if (!durationStr) return { value: null, units: "inst" };

  const lower = durationStr.toLowerCase();
  const concentration = lower.includes("concentration");

  if (lower.includes("instantaneous")) return { value: null, units: "inst", concentration };
  if (lower.includes("until dispelled")) return { value: null, units: "perm", concentration };
  if (lower.includes("special")) return { value: null, units: "spec", concentration };

  const match = durationStr.match(/(\d+)\s*(minute|hour|day|round|year|week|month)/i);
  if (match) {
    const unitMap = {
      minute: "minute", hour: "hour", day: "day",
      round: "round", year: "year", week: "week", month: "month",
    };
    return {
      value: parseInt(match[1]),
      units: unitMap[match[2].toLowerCase()] ?? "inst",
      concentration,
    };
  }

  return { value: null, units: "inst", concentration };
}

/**
 * Parse components from Open5e data.
 * Open5e provides: requires_verbal_components, requires_somatic_components,
 * requires_material_components, material
 */
function parseComponents(data) {
  return {
    vocal: !!data.requires_verbal_components,
    somatic: !!data.requires_somatic_components,
    material: !!data.requires_material_components,
    ritual: !!data.can_be_cast_as_ritual,
    concentration: !!data.concentration?.toLowerCase?.()?.includes("yes") || data.concentration === "yes",
  };
}

/**
 * Try to extract damage info from spell description.
 */
function parseDamage(desc, level) {
  if (!desc) return null;

  // Look for patterns like "Xd6 fire damage" or "Xd8 radiant damage"
  const dmgMatch = desc.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+(\w+)\s+damage/i);
  if (!dmgMatch) return null;

  const formula = dmgMatch[1].replace(/\s+/g, "");
  const type = dmgMatch[2].toLowerCase();
  const validTypes = [
    "acid", "bludgeoning", "cold", "fire", "force", "lightning",
    "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
  ];

  if (!validTypes.includes(type)) return null;

  return { parts: [[formula, type]] };
}

/**
 * Determine action type for spell.
 */
function parseActionType(desc) {
  if (!desc) return "util";
  const lower = desc.toLowerCase();
  if (lower.includes("make a ranged spell attack")) return "rsak";
  if (lower.includes("make a melee spell attack")) return "msak";
  if (lower.includes("saving throw") || lower.includes("must succeed")) return "save";
  if (lower.includes("damage")) return "rsak";
  if (lower.includes("heal") || lower.includes("regain")) return "heal";
  return "util";
}

/**
 * Parse save from description.
 */
function parseSave(desc) {
  if (!desc) return null;
  const match = desc.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving\s+throw/i);
  if (!match) return null;

  const map = {
    strength: "str", dexterity: "dex", constitution: "con",
    intelligence: "int", wisdom: "wis", charisma: "cha",
  };
  return { ability: map[match[1].toLowerCase()], dc: { calculation: "spellcasting" } };
}

/**
 * Main mapper: Open5e spell → dnd5e Item (spell) data.
 */
export function mapSpell(data) {
  const level = data.level_int ?? (data.level === "Cantrip" ? 0 : parseInt(data.level)) ?? 0;
  const school = SCHOOL_MAP[data.school] ?? "evo";
  const activation = parseActivation(data.casting_time);
  const range = parseRange(data.range);
  const duration = parseDuration(data.duration);
  const components = parseComponents(data);
  const damage = parseDamage(data.desc, level);
  const actionType = parseActionType(data.desc);
  const save = parseSave(data.desc);
  const target = parseTarget(data.range, data.desc);

  const itemData = {
    name: data.name,
    type: "spell",
    system: {
      description: {
        value: formatDescription(data),
      },
      source: { custom: data.document__slug ?? "Open5e SRD" },
      level: { value: level },
      school: { value: school },
      activation,
      duration,
      range,
      target,
      actionType,
      components: {
        vocal: components.vocal,
        somatic: components.somatic,
        material: components.material,
        ritual: components.ritual,
        concentration: components.concentration,
      },
      materials: {
        value: data.material ?? "",
        consumed: false,
        cost: 0,
        supply: 0,
      },
    },
  };

  if (damage) {
    itemData.system.damage = damage;
  }

  if (save) {
    itemData.system.save = save;
  }

  // Higher level scaling
  if (data.higher_level) {
    itemData.system.scaling = {
      mode: level === 0 ? "cantrip" : "level",
      formula: "",
    };
  }

  return itemData;
}

function formatDescription(data) {
  let html = `<p>${data.desc ?? ""}</p>`;
  if (data.higher_level) {
    html += `<p><strong>At Higher Levels.</strong> ${data.higher_level}</p>`;
  }
  return html;
}

/**
 * Generate preview HTML for a spell.
 */
export function previewSpell(data) {
  let html = `<div class="ci-stat-block ci-spell-block">`;
  html += `<h2 class="ci-stat-name">${data.name}</h2>`;

  const levelStr = data.level_int === 0 || data.level === "Cantrip"
    ? `${data.school} cantrip`
    : `${ordinal(data.level_int ?? parseInt(data.level) ?? 1)}-level ${(data.school ?? "").toLowerCase()}`;
  html += `<p class="ci-stat-meta"><em>${levelStr}${data.concentration === "yes" ? " (concentration)" : ""}${data.can_be_cast_as_ritual ? " (ritual)" : ""}</em></p>`;

  html += `<div class="ci-stat-divider"></div>`;
  html += `<p><strong>Casting Time:</strong> ${data.casting_time ?? "1 action"}</p>`;
  html += `<p><strong>Range:</strong> ${data.range ?? "Self"}</p>`;

  const comp = [];
  if (data.requires_verbal_components) comp.push("V");
  if (data.requires_somatic_components) comp.push("S");
  if (data.requires_material_components) comp.push(`M (${data.material ?? ""})`);
  html += `<p><strong>Components:</strong> ${comp.join(", ") || "None"}</p>`;
  html += `<p><strong>Duration:</strong> ${data.duration ?? "Instantaneous"}</p>`;

  html += `<div class="ci-stat-divider"></div>`;
  html += `<p>${data.desc ?? ""}</p>`;

  if (data.higher_level) {
    html += `<p><strong>At Higher Levels.</strong> ${data.higher_level}</p>`;
  }

  // Classes
  if (data.dnd_class) {
    html += `<p class="ci-spell-classes"><strong>Classes:</strong> ${data.dnd_class}</p>`;
  }

  html += `</div>`;
  return html;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
