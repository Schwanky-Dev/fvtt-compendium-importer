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
  // Detect "(hover)" in speed string — used by monster mapper's parseSpeed()
  if (/\(hover\)/i.test(str)) speed.hover = true;
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
 * Strip HTML tags from a string.
 * Converts <strong>/<b>/<em> to markdown equivalents BEFORE stripping other tags,
 * so parseEntries() can still detect bold entry names in HTML content blobs.
 */
function stripHtml(str) {
  return String(str)
    .replace(/<\/?br\s*\/?>/gi, "\n")               // Preserve line breaks as newlines
    .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")   // <strong> → **bold**
    .replace(/<b>(.*?)<\/b>/gi, "**$1**")             // <b> → **bold**
    .replace(/<em>(.*?)<\/em>/gi, "*$1*")             // <em> → *italic*
    .replace(/<li>(.*?)<\/li>/gi, "• $1\n")           // <li> → bullet
    .replace(/<[^>]*>/g, " ")                         // Strip remaining tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")                          // Collapse horizontal whitespace only
    .replace(/\n /g, "\n")                            // Clean up space after newlines
    .trim();
}

/**
 * Parse a content-only blob (HTML/markdown) into a flat object
 * matching the structured Roll20 data fields.
 * Returns an object with keys like AC, HP, STR, etc.
 */
function parseContentBlob(content) {
  const text = stripHtml(content);
  const parsed = {};

  // --- Core stats ---
  const acMatch = text.match(/Armor\s+Class[\s:*]*(\d+)\s*(?:\(([^)]+)\))?/i);
  if (acMatch) parsed.AC = acMatch[2] ? `${acMatch[1]} (${acMatch[2].trim()})` : acMatch[1];

  const hpMatch = text.match(/Hit\s+Points[\s:*]*(\d+)\s*(?:\(([^)]+)\))?/i);
  if (hpMatch) parsed.HP = hpMatch[2] ? `${hpMatch[1]} (${hpMatch[2].trim()})` : hpMatch[1];

  const speedMatch = text.match(/Speed[\s:*]*([\d].*?)(?:\*\*|$)/im);
  if (speedMatch) parsed.Speed = speedMatch[1].replace(/\s+/g, " ").trim();

  // --- Ability scores: handle "STR 11 (+0)" or "**STR**: 11 (+0)" or "**STR** 11" ---
  for (const stat of ["STR", "DEX", "CON", "INT", "WIS", "CHA"]) {
    const re = new RegExp(`${stat}[\\s:*]*(\\d+)`, "i");
    const m = text.match(re);
    if (m) parsed[stat] = m[1];
  }

  // --- Saving throws ---
  const savesMatch = text.match(/Saving\s+Throws[\s:*]*(.+?)(?:\*\*|Skills|Damage|Condition|Senses|Languages|Challenge|$)/is);
  if (savesMatch) parsed["Saving Throws"] = savesMatch[1].replace(/\s+/g, " ").trim().replace(/\*+/g, "");

  // --- Skills ---
  const skillsMatch = text.match(/Skills[\s:*]*(.+?)(?:\*\*|Damage|Condition|Senses|Languages|Challenge|$)/is);
  if (skillsMatch) parsed.Skills = skillsMatch[1].replace(/\s+/g, " ").trim().replace(/\*+/g, "");

  // --- Damage vulnerabilities ---
  const vulnMatch = text.match(/Damage\s+Vulnerabilities[\s:*]*(.+?)(?:\*\*|Damage\s+Resist|Damage\s+Immun|Condition|Senses|Languages|Challenge|$)/is);
  if (vulnMatch) parsed["Damage Vulnerabilities"] = vulnMatch[1].replace(/\s+/g, " ").trim().replace(/\*+/g, "");

  // --- Damage resistances ---
  const resMatch = text.match(/Damage\s+Resistances?[\s:*]*(.+?)(?:\*\*|Damage\s+Immun|Condition|Senses|Languages|Challenge|$)/is);
  if (resMatch) parsed["Damage Resistances"] = resMatch[1].replace(/\s+/g, " ").trim().replace(/\*+/g, "");

  // --- Damage immunities ---
  const dimmMatch = text.match(/Damage\s+Immunities[\s:*]*(.+?)(?:\*\*|Condition|Senses|Languages|Challenge|$)/is);
  if (dimmMatch) parsed["Damage Immunities"] = dimmMatch[1].replace(/\s+/g, " ").trim().replace(/\*+/g, "");

  // --- Condition immunities ---
  const cimmMatch = text.match(/Condition\s+Immunities[\s:*]*(.+?)(?:\*\*|Senses|Languages|Challenge|$)/is);
  if (cimmMatch) parsed["Condition Immunities"] = cimmMatch[1].replace(/\s+/g, " ").trim().replace(/\*+/g, "");

  // --- Senses ---
  const sensesMatch = text.match(/Senses[\s:*]*(.+?)(?:\*\*|Languages|Challenge|$)/is);
  if (sensesMatch) parsed.Senses = sensesMatch[1].replace(/\s+/g, " ").trim().replace(/\*+/g, "");

  // --- Languages ---
  const langMatch = text.match(/Languages[\s:*]*(.+?)(?:\*\*|Challenge|$)/is);
  if (langMatch) parsed.Languages = langMatch[1].replace(/\s+/g, " ").trim().replace(/\*+/g, "");

  // --- Challenge Rating ---
  const crMatch = text.match(/Challenge[\s:*]*([\d/]+)\s*(?:\(([^)]+)\))?/i);
  if (crMatch) parsed["Challenge Rating"] = crMatch[1].trim();

  // --- Size / Type / Alignment from the subheading line ---
  // Typically: "Medium undead, lawful evil" or "*Medium undead, lawful evil*"
  const sizeTypeMatch = text.match(/\b(Tiny|Small|Medium|Large|Huge|Gargantuan)\b\s+(\w[\w\s]*?)(?:,\s*(.+?))?(?:\*\*|Armor\s+Class)/is);
  if (sizeTypeMatch) {
    parsed.Size = sizeTypeMatch[1].trim();
    parsed.Type = sizeTypeMatch[2].trim();
    if (sizeTypeMatch[3]) parsed.Alignment = sizeTypeMatch[3].trim().replace(/\*+/g, "");
  }

  // --- Sections: Traits, Actions, Reactions, Legendary Actions ---
  // We extract these as JSON arrays of {Name, Desc} to match the data-* format
  const extractSection = (startPattern, endPatterns) => {
    const startRe = new RegExp(startPattern, "i");
    const startIdx = text.search(startRe);
    if (startIdx === -1) return null;
    const afterStart = text.slice(startIdx).replace(startRe, "").trim();

    let endIdx = afterStart.length;
    for (const ep of endPatterns) {
      const eRe = new RegExp(ep, "i");
      const eIdx = afterStart.search(eRe);
      if (eIdx !== -1 && eIdx < endIdx) endIdx = eIdx;
    }
    return afterStart.slice(0, endIdx).trim();
  };

  const parseEntries = (sectionText) => {
    if (!sectionText) return [];
    const entries = [];

    // Strategy 1: Match bold entry names: "**Name.** Desc" or "**Name:** Desc"
    const parts = sectionText.split(/\*{2,3}([^*]+?)[.:]?\*{2,3}\s*/);
    if (parts.length > 1) {
      // parts[0] is before first entry (usually empty), then alternating name, desc
      for (let i = 1; i < parts.length; i += 2) {
        const entryName = parts[i]?.trim();
        const entryDesc = (parts[i + 1] || "").trim();
        if (entryName) entries.push({ Name: entryName, Desc: entryDesc });
      }
    }

    // Strategy 2: If no markdown bold found, try "Name. Description" or "Name: Description"
    // patterns on newline-separated text (common in plain-text content blobs).
    if (entries.length === 0) {
      const lines = sectionText.split(/\n/).map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        // "Legendary Resistance (3/Day). If the lich fails..."
        // "Paralyzing Touch. Melee Spell Attack: +12 to hit..."
        const m = line.match(/^([A-Z][\w\s()'/,-]+?)[.:]\s+(.+)/);
        if (m && m[1].length < 80) {
          entries.push({ Name: m[1].trim(), Desc: m[2].trim() });
        }
      }
    }

    return entries;
  };

  // Traits: between CR line and "Actions" heading
  // Match bare "Actions" text too (plain-text content blobs without markdown markers)
  const traitsText = extractSection(
    "Challenge[\\s:*]*[\\d/]+\\s*(?:\\([^)]*\\))?\\s*",
    ["#{1,3}\\s*Actions", "\\*{2,3}Actions\\*{2,3}", "\\nActions\\s*\\n"]
  );
  if (traitsText) parsed["data-Traits"] = JSON.stringify(parseEntries(traitsText));

  // Actions — match markdown, HTML-converted, or bare text "Actions" headers
  const actionsText = extractSection(
    "(?:#{1,3}\\s*|\\*{2,3})?Actions\\*{0,3}\\s*",
    ["#{1,3}\\s*Reactions", "\\*{2,3}Reactions\\*{2,3}", "\\nReactions\\s*\\n",
     "#{1,3}\\s*Legendary\\s+Actions", "\\*{2,3}Legendary\\s+Actions\\*{2,3}", "\\nLegendary\\s+Actions\\s*\\n"]
  );
  if (actionsText) parsed["data-Actions"] = JSON.stringify(parseEntries(actionsText));

  // Reactions
  const reactionsText = extractSection(
    "(?:#{1,3}\\s*|\\*{2,3})?Reactions\\*{0,3}\\s*",
    ["#{1,3}\\s*Legendary\\s+Actions", "\\*{2,3}Legendary\\s+Actions\\*{2,3}", "\\nLegendary\\s+Actions\\s*\\n"]
  );
  if (reactionsText) parsed["data-Reactions"] = JSON.stringify(parseEntries(reactionsText));

  // Legendary Actions
  const legendaryText = extractSection(
    "(?:#{1,3}\\s*|\\*{2,3})?Legendary\\s+Actions\\*{0,3}\\s*",
    ["#{1,3}\\s*Lair\\s+Actions", "\\*{2,3}Lair\\s+Actions\\*{2,3}", "\\nLair\\s+Actions\\s*\\n"]
  );
  if (legendaryText) parsed["data-Legendary-Actions"] = JSON.stringify(parseEntries(legendaryText));

  return parsed;
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
  // Roll20 response wraps stats under .data — detect by Category OR known stat fields
  const hasDataObj = raw?.data && typeof raw.data === "object";
  let d = hasDataObj && (raw.data.Category || raw.data.STR || raw.data.HP) ? raw.data : raw;

  // Fallback: if no structured stats but content blob exists, parse it
  if (!d.HP && !d.STR && raw?.content) {
    const contentParsed = parseContentBlob(raw.content);
    // Merge parsed content as the data source, keeping any existing fields from d
    d = { ...contentParsed, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v != null && v !== "")) };
  }

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
    // Token art
    img_main: d.Token || d.avatar || null,
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
  const hasDataObj = raw?.data && typeof raw.data === "object";
  let d = hasDataObj && (raw.data.Category || raw.data.Level || raw.data.School) ? raw.data : raw;

  // Fallback: if no structured spell fields but content blob exists, parse basic fields
  if (!d.Level && !d.School && raw?.content) {
    const text = stripHtml(raw.content);
    const parsed = {};
    const levelMatch = text.match(/(\d+)\w{0,2}[-\s]*level\s+(\w+)/i) || text.match(/(cantrip)\s+(\w+)/i) || text.match(/(\w+)\s+cantrip/i);
    if (levelMatch) {
      if (levelMatch[1].toLowerCase() === "cantrip" || levelMatch[2]?.toLowerCase() === "cantrip") {
        parsed.Level = "0";
        parsed.School = (levelMatch[1].toLowerCase() === "cantrip" ? levelMatch[2] : levelMatch[1]) || "";
      } else {
        parsed.Level = levelMatch[1];
        parsed.School = levelMatch[2] || "";
      }
    }
    const ctMatch = text.match(/Casting\s+Time[\s:*]*(.+?)(?:\*\*|Range|$)/is);
    if (ctMatch) parsed["Casting Time"] = ctMatch[1].trim().replace(/\*+/g, "");
    const rangeMatch = text.match(/Range[\s:*]*(.+?)(?:\*\*|Components|$)/is);
    if (rangeMatch) parsed.Range = rangeMatch[1].trim().replace(/\*+/g, "");
    const compMatch = text.match(/Components[\s:*]*(.+?)(?:\*\*|Duration|$)/is);
    if (compMatch) parsed.Components = compMatch[1].trim().replace(/\*+/g, "");
    const durMatch = text.match(/Duration[\s:*]*(.+?)(?:\*\*|$)/im);
    if (durMatch) parsed.Duration = durMatch[1].trim().replace(/\*+/g, "");
    const ritMatch = text.match(/\britual\b/i);
    if (ritMatch) parsed["filter-Ritual"] = "yes";
    d = { ...parsed, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v != null && v !== "")) };
  }

  const name = d.Name || raw?.name || "Unknown";

  // Parse components string "V S M" into boolean fields
  const compStr = (d.Components || "").toUpperCase();
  const components = compStr;

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
    requires_verbal_components: compStr.includes("V"),
    requires_somatic_components: compStr.includes("S"),
    requires_material_components: compStr.includes("M"),
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
