/**
 * Normalizes Roll20 compendium JSON into Open5e-compatible format
 * so existing mappers (monster, spell) can consume it unchanged.
 */

/* ------------------------------------------------------------------ */
/*  Monster normalization                                             */
/* ------------------------------------------------------------------ */

/**
 * Parse "16 (Natural Armor)" → { ac: 16, armor_desc: "Natural Armor" }
 */
function parseAC(str) {
  if (!str) return { ac: 10, armor_desc: null };
  const m = String(str).match(/^(\d+)\s*(?:\((.+)\))?/);
  return m
    ? { ac: parseInt(m[1], 10), armor_desc: m[2]?.trim() || null }
    : { ac: 10, armor_desc: null };
}

/**
 * Parse "93 (11d10+33)" → { hp: 93, hit_dice: "11d10+33" }
 */
function parseHP(str) {
  if (!str) return { hp: 0, hit_dice: "" };
  const m = String(str).match(/^(\d+)\s*(?:\((.+)\))?/);
  return m
    ? { hp: parseInt(m[1], 10), hit_dice: m[2]?.trim() || "" }
    : { hp: 0, hit_dice: "" };
}

/**
 * Parse "30 ft., swim 30 ft., fly 60 ft. (hover)" → { walk: 30, swim: 30, fly: 60 }
 */
function parseSpeed(str) {
  if (!str) return { walk: 0 };
  const speed = {};
  // Match optional type prefix + number
  const re = /(?:(\w+)\s+)?(\d+)\s*ft\./gi;
  let m;
  while ((m = re.exec(str)) !== null) {
    const type = m[1] ? m[1].toLowerCase() : "walk";
    speed[type] = parseInt(m[2], 10);
  }
  if (Object.keys(speed).length === 0) speed.walk = 0;
  return speed;
}

/**
 * Parse "Perception +4, Stealth +6" → { perception: 4, stealth: 6 }
 */
function parseSkills(str) {
  if (!str) return {};
  const skills = {};
  const parts = String(str).split(",");
  for (const part of parts) {
    const m = part.trim().match(/^(\w[\w\s]*?)\s*([+-]?\d+)$/);
    if (m) skills[m[1].trim().toLowerCase()] = parseInt(m[2], 10);
  }
  return skills;
}

/**
 * Parse Roll20 JSON-string arrays (data-Traits, data-Actions, etc.)
 * into Open5e-style [{name, desc}] arrays.
 */
function parseDataArray(jsonStr) {
  if (!jsonStr) return [];
  try {
    const arr = JSON.parse(jsonStr);
    if (!Array.isArray(arr)) return [];
    return arr.map((entry) => {
      const out = { name: entry.Name || entry.name || "Unknown", desc: entry.Desc || entry.desc || "" };
      return out;
    });
  } catch {
    return [];
  }
}

/**
 * Parse saving throws string: "Dex +5, Wis +3" → { dexterity: 5, wisdom: 3 }
 */
function parseSaves(str) {
  if (!str) return {};
  const SHORT_TO_LONG = { str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" };
  const saves = {};
  for (const part of String(str).split(",")) {
    const m = part.trim().match(/^(\w+)\s*([+-]?\d+)$/);
    if (m) {
      const key = SHORT_TO_LONG[m[1].toLowerCase()] || m[1].toLowerCase();
      saves[key] = parseInt(m[2], 10);
    }
  }
  return saves;
}

/**
 * Normalize a Roll20 monster `_raw` object into Open5e format.
 * Accepts either the top-level roll20 response or just its `.data` sub-object.
 */
export function normalizeRoll20Monster(raw) {
  // Roll20 response may wrap data under .data
  const d = raw?.data && typeof raw.data === "object" && raw.data.Category ? raw.data : raw;
  const name = d.Name || raw?.name || "Unknown";

  const { ac, armor_desc } = parseAC(d.AC);
  const { hp, hit_dice } = parseHP(d.HP);

  const sensesParts = [];
  if (d.Senses) sensesParts.push(String(d.Senses).toLowerCase());
  if (d["Passive Perception"]) sensesParts.push(`passive Perception ${d["Passive Perception"]}`);
  const senses = sensesParts.join(", ") || "";

  return {
    name,
    armor_class: ac,
    armor_desc: armor_desc,
    hit_points: hp,
    hit_dice,
    strength: parseInt(d.STR, 10) || 10,
    dexterity: parseInt(d.DEX, 10) || 10,
    constitution: parseInt(d.CON, 10) || 10,
    intelligence: parseInt(d.INT, 10) || 10,
    wisdom: parseInt(d.WIS, 10) || 10,
    charisma: parseInt(d.CHA, 10) || 10,
    size: d.Size || "Medium",
    type: (d.Type || "").toLowerCase(),
    subtype: d.Subtype || "",
    alignment: (d.Alignment || "").toLowerCase(),
    speed: parseSpeed(d.Speed),
    senses,
    skills: parseSkills(d.Skills),
    strength_save: null,
    dexterity_save: null,
    constitution_save: null,
    intelligence_save: null,
    wisdom_save: null,
    charisma_save: null,
    ...(() => {
      const s = parseSaves(d["Saving Throws"] || d["Save"]);
      const out = {};
      for (const [k, v] of Object.entries(s)) out[`${k}_save`] = v;
      return out;
    })(),
    languages: d.Languages || "",
    damage_vulnerabilities: (d.Vulnerabilities || d["Damage Vulnerabilities"] || "").toLowerCase(),
    damage_resistances: (d.Resistances || d["Damage Resistances"] || "").toLowerCase(),
    damage_immunities: (d.Immunities || d["Damage Immunities"] || "").toLowerCase(),
    condition_immunities: (d["Condition Immunities"] || "").toLowerCase(),
    challenge_rating: d["Challenge Rating"] || "0",
    actions: parseDataArray(d["data-Actions"]),
    reactions: parseDataArray(d["data-Reactions"]),
    legendary_actions: parseDataArray(d["data-Legendary-Actions"]),
    special_abilities: parseDataArray(d["data-Traits"]),
    // Preserve source info
    document__license_url: "",
    document__title: d.Source || "Roll20",
  };
}

/* ------------------------------------------------------------------ */
/*  Spell normalization                                               */
/* ------------------------------------------------------------------ */

/**
 * Normalize a Roll20 spell `_raw` object into Open5e format.
 */
export function normalizeRoll20Spell(raw) {
  const d = raw?.data && typeof raw.data === "object" && raw.data.Category ? raw.data : raw;
  const name = d.Name || raw?.name || "Unknown";

  // Parse components string "V S M" → { V, S, M }
  const compStr = d.Components || "";
  const components = compStr.toUpperCase();

  // Parse level
  const level = d.Level || d["filter-Level"];
  const levelInt = parseInt(level, 10) || 0;
  const levelStr = levelInt === 0 ? "Cantrip" : `${levelInt}`;

  // Determine if ritual
  const isRitual = (d["filter-Ritual"] || "").toLowerCase() === "yes";

  // Higher level text
  const desc = raw?.content || d.Desc || d.Description || "";
  let higher_level = "";
  const hlMatch = desc.match(/At Higher Levels?[.:]\s*(.*?)$/is);
  if (hlMatch) higher_level = hlMatch[1].trim();

  return {
    name,
    desc: desc.replace(/\s+/g, " ").trim(),
    higher_level,
    level: levelStr,
    level_int: levelInt,
    school: (d.School || "").toLowerCase(),
    casting_time: d["Casting Time"] || "1 action",
    range: d.Range || "Self",
    duration: d.Duration || "Instantaneous",
    components: components,
    material: d.Material || "",
    concentration: (d.Duration || "").toLowerCase().includes("concentration"),
    ritual: isRitual ? "yes" : "no",
    dnd_class: d.Classes || "",
    document__title: d.Source || d.Expansion || "Roll20",
    document__license_url: "",
  };
}

/* ------------------------------------------------------------------ */
/*  Unified entry point                                               */
/* ------------------------------------------------------------------ */

/**
 * Normalize Roll20 raw data based on detected type.
 * @param {object} raw  - The Roll20 _raw object
 * @param {string} type - "monster", "spell", etc.
 * @returns {object} Open5e-compatible data
 */
export function normalizeRoll20(raw, type) {
  switch (type) {
    case "monster":
      return normalizeRoll20Monster(raw);
    case "spell":
      return normalizeRoll20Spell(raw);
    default:
      // For items etc., return raw as-is for now
      return raw;
  }
}
