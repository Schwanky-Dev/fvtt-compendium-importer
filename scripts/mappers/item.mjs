/**
 * Maps Open5e item JSON → Foundry dnd5e Item data.
 * Handles magic items, weapons, armor, and generic equipment.
 * Includes magic item effect parsing for dnd5e v3 schema.
 */

const RARITY_MAP = {
  common: "common",
  uncommon: "uncommon",
  rare: "rare",
  "very rare": "veryRare",
  legendary: "legendary",
  artifact: "artifact",
};

const WEAPON_PROPERTIES = {
  ammunition: "amm",
  finesse: "fin",
  heavy: "hvy",
  light: "lgt",
  loading: "lod",
  reach: "rch",
  special: "spc",
  thrown: "thr",
  "two-handed": "two",
  versatile: "ver",
};

const DAMAGE_TYPE_MAP = {
  bludgeoning: "bludgeoning",
  piercing: "piercing",
  slashing: "slashing",
  fire: "fire",
  cold: "cold",
  lightning: "lightning",
  thunder: "thunder",
  acid: "acid",
  poison: "poison",
  necrotic: "necrotic",
  radiant: "radiant",
  psychic: "psychic",
  force: "force",
};

const ABILITY_MAP = {
  strength: "str", str: "str",
  dexterity: "dex", dex: "dex",
  constitution: "con", con: "con",
  intelligence: "int", int: "int",
  wisdom: "wis", wis: "wis",
  charisma: "cha", cha: "cha",
};

/* ======================== Magic Item Description Parsing ======================== */

/**
 * Parse magic item description for charges, attunement, bonuses, etc.
 */
function parseMagicItemDescription(desc) {
  if (!desc) return {};
  const parsed = {};

  // Charges: "has X charges"
  const chargesMatch = desc.match(/has (\d+) charges/i);
  if (chargesMatch) {
    parsed.charges = parseInt(chargesMatch[1]);
  }

  // Recovery: "regains Xd6+Y charges at dawn"
  const recoveryMatch = desc.match(/regains\s+(\d+d\d+(?:\s*[+\-]\s*\d+)?)\s*(?:expended\s*)?charges?\s*(?:daily\s*)?at\s*dawn/i);
  if (recoveryMatch) {
    parsed.recovery = recoveryMatch[1].replace(/\s/g, "");
    parsed.recoveryPeriod = "dawn";
  } else if (parsed.charges) {
    // Check simpler "regains all" pattern
    const regainAllMatch = desc.match(/regains\s+all\s+(?:expended\s*)?charges?\s*(?:daily\s*)?at\s*dawn/i);
    if (regainAllMatch) {
      parsed.recovery = String(parsed.charges);
      parsed.recoveryPeriod = "dawn";
    }
  }

  // Attunement: "requires attunement by a wizard"
  const attunementMatch = desc.match(/requires attunement(?:\s+by\s+(?:a|an)\s+(.+?))?(?:\.|,|$)/i);
  if (attunementMatch) {
    parsed.requiresAttunement = true;
    parsed.attunementBy = attunementMatch[1]?.trim() ?? "";
  }

  // Magical bonus: "+X weapon/armor/shield"
  const bonusMatch = desc.match(/\+(\d+)\s+(?:bonus\s+to\s+)?(?:attack and damage rolls|attack rolls|weapon|armor|shield)/i);
  if (!bonusMatch) {
    // Try name-based: "+1 longsword", "+2 shield"
    const nameBonusMatch = desc.match(/^\+(\d+)\s+/i);
    // Don't set from name pattern here, we check the item name separately
  }
  if (bonusMatch) {
    parsed.magicalBonus = parseInt(bonusMatch[1]);
  }

  // Damage resistance: "resistance to fire damage"
  const resistances = [];
  const resistRegex = /resistance\s+to\s+(\w+)\s+damage/gi;
  let rMatch;
  while ((rMatch = resistRegex.exec(desc)) !== null) {
    const dmgType = rMatch[1].toLowerCase();
    if (DAMAGE_TYPE_MAP[dmgType]) resistances.push(dmgType);
  }
  if (resistances.length) parsed.resistances = resistances;

  // Damage immunity: "immune to poison damage" or "immunity to fire damage"
  const immunities = [];
  const immuneRegex = /(?:immune|immunity)\s+to\s+(\w+)(?:\s+damage)?/gi;
  let iMatch;
  while ((iMatch = immuneRegex.exec(desc)) !== null) {
    const dmgType = iMatch[1].toLowerCase();
    if (DAMAGE_TYPE_MAP[dmgType]) immunities.push(dmgType);
  }
  if (immunities.length) parsed.immunities = immunities;

  // Stat override: "increases your Strength to 19"
  const statMatch = desc.match(/(?:increases?\s+(?:your\s+)?|set(?:s)?\s+(?:your\s+)?)(\w+)\s+(?:score\s+)?to\s+(\d+)/i);
  if (statMatch) {
    const ability = ABILITY_MAP[statMatch[1].toLowerCase()];
    if (ability) {
      parsed.statOverride = { ability, value: parseInt(statMatch[2]) };
    }
  }

  // AC bonus: "grants +X to AC" or "+X bonus to AC"
  const acMatch = desc.match(/\+(\d+)\s+(?:bonus\s+)?to\s+(?:your\s+)?(?:AC|armor class)/i);
  if (acMatch) {
    parsed.acBonus = parseInt(acMatch[1]);
  }

  // Save DC bonus: "+X to spell save DC"
  const saveDCMatch = desc.match(/\+(\d+)\s+(?:bonus\s+)?to\s+(?:your\s+)?spell\s+save\s+DC/i);
  if (saveDCMatch) {
    parsed.spellSaveDCBonus = parseInt(saveDCMatch[1]);
  }

  // Spell attack bonus: "+X to spell attack rolls"
  const spellAtkMatch = desc.match(/\+(\d+)\s+(?:bonus\s+)?to\s+(?:your\s+)?spell\s+attack\s+rolls?/i);
  if (spellAtkMatch) {
    parsed.spellAttackBonus = parseInt(spellAtkMatch[1]);
  }

  // Spell casting: "you can cast X spell" / "you can use it to cast X"
  const spells = [];
  const spellRegex = /you\s+can\s+(?:use\s+(?:it\s+)?(?:to\s+)?)?cast\s+(?:the\s+)?([a-z][\w\s']+?)(?:\s+spell)?(?:\s+(?:from|at|using|as|,|\.))/gi;
  let sMatch;
  while ((sMatch = spellRegex.exec(desc)) !== null) {
    spells.push(sMatch[1].trim());
  }
  // Simpler pattern for single spell mentions
  if (!spells.length) {
    const simpleSpellMatch = desc.match(/you\s+can\s+(?:use\s+(?:it\s+)?(?:to\s+)?)?cast\s+(?:the\s+)?([a-z][\w\s']+?)(?:\s+spell)?(?:\.|,|$)/i);
    if (simpleSpellMatch) {
      spells.push(simpleSpellMatch[1].trim());
    }
  }
  if (spells.length) parsed.spells = spells;

  return parsed;
}

/**
 * Parse magical bonus from item name ("+1 longsword", "+3 plate armor")
 */
function parseBonusFromName(name) {
  const match = (name ?? "").match(/^\+(\d+)\s+/i);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Build Active Effects from parsed magic item properties.
 */
function buildActiveEffects(parsed, itemName, itemType) {
  const effects = [];

  // +X magical bonus for weapons
  const bonus = parsed.magicalBonus || parseBonusFromName(itemName);
  if (bonus && (itemType === "weapon")) {
    // For dnd5e v3, we use system.magicalBonus directly — no ActiveEffect needed
    // But we still create effects for attack/damage bonuses as a fallback
  }

  // Damage resistance
  if (parsed.resistances) {
    for (const dmgType of parsed.resistances) {
      effects.push({
        name: `Resistance: ${dmgType.charAt(0).toUpperCase() + dmgType.slice(1)}`,
        icon: "icons/svg/shield.svg",
        changes: [
          { key: "system.traits.dr.value", mode: 2, value: dmgType },
        ],
        transfer: true,
      });
    }
  }

  // Damage immunity
  if (parsed.immunities) {
    for (const dmgType of parsed.immunities) {
      effects.push({
        name: `Immunity: ${dmgType.charAt(0).toUpperCase() + dmgType.slice(1)}`,
        icon: "icons/svg/aura.svg",
        changes: [
          { key: "system.traits.di.value", mode: 2, value: dmgType },
        ],
        transfer: true,
      });
    }
  }

  // Stat override (e.g., "increases Strength to 19")
  if (parsed.statOverride) {
    const { ability, value } = parsed.statOverride;
    const abilityName = Object.entries(ABILITY_MAP).find(([k, v]) => v === ability && k.length > 3)?.[0] ?? ability;
    effects.push({
      name: `Set ${abilityName.charAt(0).toUpperCase() + abilityName.slice(1)} to ${value}`,
      icon: "icons/svg/upgrade.svg",
      changes: [
        { key: `system.abilities.${ability}.value`, mode: 5, value: String(value) }, // mode 5 = OVERRIDE
      ],
      transfer: true,
    });
  }

  // AC bonus
  if (parsed.acBonus) {
    effects.push({
      name: `+${parsed.acBonus} AC`,
      icon: "icons/svg/shield.svg",
      changes: [
        { key: "system.attributes.ac.bonus", mode: 2, value: String(parsed.acBonus) },
      ],
      transfer: true,
    });
  }

  // Spell save DC bonus
  if (parsed.spellSaveDCBonus) {
    effects.push({
      name: `+${parsed.spellSaveDCBonus} Spell Save DC`,
      icon: "icons/svg/daze.svg",
      changes: [
        { key: "system.bonuses.spell.dc", mode: 2, value: String(parsed.spellSaveDCBonus) },
      ],
      transfer: true,
    });
  }

  // Spell attack bonus
  if (parsed.spellAttackBonus) {
    effects.push({
      name: `+${parsed.spellAttackBonus} Spell Attack`,
      icon: "icons/svg/daze.svg",
      changes: [
        { key: "system.bonuses.rsak.attack", mode: 2, value: String(parsed.spellAttackBonus) },
        { key: "system.bonuses.msak.attack", mode: 2, value: String(parsed.spellAttackBonus) },
      ],
      transfer: true,
    });
  }

  return effects;
}

/* ======================== Item Type Determination ======================== */

/**
 * Determine Foundry item type from Open5e data.
 */
function determineItemType(data, sourceType) {
  if (sourceType === "weapon") return "weapon";
  if (sourceType === "armor") return "equipment";

  const name = (data.name ?? "").toLowerCase();
  const desc = (data.desc ?? "").toLowerCase();
  const type = (data.type ?? "").toLowerCase();

  if (type.includes("weapon") || type.includes("sword") || type.includes("bow") ||
      type.includes("axe") || type.includes("dagger") || type.includes("mace")) return "weapon";
  if (type.includes("armor") || type.includes("shield")) return "equipment";
  if (type.includes("potion")) return "consumable";
  if (type.includes("scroll")) return "consumable";
  if (type.includes("wand") || type.includes("rod") || type.includes("staff")) return "weapon";
  if (type.includes("ring") || type.includes("wondrous")) return "equipment";

  return "loot";
}

/* ======================== Mappers ======================== */

/**
 * Map a weapon from Open5e /weapons/ endpoint.
 */
function mapWeapon(data) {
  const properties = {};
  if (data.properties) {
    for (const prop of data.properties) {
      const lower = prop.toLowerCase();
      for (const [name, code] of Object.entries(WEAPON_PROPERTIES)) {
        if (lower.includes(name)) properties[code] = true;
      }
    }
  }

  const dmgMatch = data.damage_dice?.match(/(\d+d\d+)/);
  const dmgType = (data.damage_type ?? "bludgeoning").toLowerCase();

  return {
    name: data.name,
    type: "weapon",
    system: {
      description: { value: `<p>${data.desc ?? data.name}</p>` },
      source: { custom: data.document__title ?? "Open5e SRD" },
      quantity: 1,
      weight: { value: parseFloat(data.weight) || 0, units: "lb" },
      price: { value: parseGP(data.cost), denomination: "gp" },
      rarity: "common",
      properties,
      damage: {
        parts: dmgMatch ? [[dmgMatch[1], DAMAGE_TYPE_MAP[dmgType] ?? dmgType]] : [],
        versatile: data.damage_dice ?? "",
      },
      range: {
        value: data.range_normal ?? null,
        long: data.range_long ?? null,
        units: "ft",
      },
      actionType: properties.amm || data.range_normal ? "rwak" : "mwak",
      weaponType: data.category?.toLowerCase()?.includes("martial") ? "martialM" : "simpleM",
      proficient: true,
      equipped: false,
    },
  };
}

/**
 * Map armor from Open5e /armor/ endpoint.
 */
function mapArmor(data) {
  const armorType = (data.category ?? "").toLowerCase();
  let type = "medium";
  if (armorType.includes("light")) type = "light";
  else if (armorType.includes("heavy")) type = "heavy";
  else if (armorType.includes("shield")) type = "shield";

  return {
    name: data.name,
    type: "equipment",
    system: {
      description: { value: `<p>${data.desc ?? data.name}</p>` },
      source: { custom: data.document__title ?? "Open5e SRD" },
      quantity: 1,
      weight: { value: parseFloat(data.weight) || 0, units: "lb" },
      price: { value: parseGP(data.cost), denomination: "gp" },
      rarity: "common",
      armor: {
        value: data.base_ac ?? 10,
        dex: data.max_dex_modifier ?? null,
      },
      type: { value: type },
      strength: data.strength_requirement ?? 0,
      stealth: data.stealth_disadvantage ?? false,
      proficient: true,
      equipped: false,
    },
  };
}

/**
 * Map a magic item from Open5e /magicitems/ endpoint.
 * Populates dnd5e v3 schema fields including charges, attunement, effects, and activities.
 */
function mapMagicItem(data) {
  const foundryType = determineItemType(data, "magicitem");
  const rarity = RARITY_MAP[(data.rarity ?? "").toLowerCase()] ?? "common";
  const desc = data.desc ?? "";
  const parsed = parseMagicItemDescription(desc);
  const nameBonus = parseBonusFromName(data.name);
  const magicalBonus = parsed.magicalBonus || nameBonus;

  // Build description — append auto-parse notes for spells we detected but can't fully map
  let descHtml = `<p>${desc}</p>`;
  if (parsed.spells?.length) {
    descHtml += `<hr/><p><em>⚡ Auto-detected spells: ${parsed.spells.join(", ")}. Check Activities tab or manually configure spell casting.</em></p>`;
  }

  const itemData = {
    name: data.name,
    type: foundryType,
    system: {
      description: { value: descHtml },
      source: { custom: data.document__title ?? data.document__slug ?? "Open5e SRD" },
      quantity: 1,
      weight: { value: 0, units: "lb" },
      rarity,
      equipped: false,
      properties: new Set(["mgc"]), // All magic items get the magical property
    },
    effects: [],
  };

  // Attunement (dnd5e v3)
  if (parsed.requiresAttunement) {
    itemData.system.attunement = "required";
    if (parsed.attunementBy) {
      // Store attunement requirement details in the description context
      itemData.system.attuned = false;
    }
  } else {
    itemData.system.attunement = "";
  }

  // Charges / Uses
  if (parsed.charges) {
    itemData.system.uses = {
      max: parsed.charges,
      spent: 0,
      recovery: [],
    };
    if (parsed.recovery) {
      itemData.system.uses.recovery.push({
        period: parsed.recoveryPeriod === "dawn" ? "lr" : "sr",
        type: "formula",
        formula: parsed.recovery,
      });
    }
  }

  // Magical bonus (dnd5e v3 has system.magicalBonus for weapons/armor)
  if (magicalBonus) {
    itemData.system.magicalBonus = magicalBonus;
  }

  // Active Effects
  const effects = buildActiveEffects(parsed, data.name, foundryType);
  if (effects.length) {
    itemData.effects = effects;
  }

  // Activities — handle items that cast spells (basic support)
  if (parsed.spells?.length && parsed.charges) {
    const activities = {};
    for (let i = 0; i < parsed.spells.length; i++) {
      const spellName = parsed.spells[i];
      const actId = `cast${i}`;
      activities[actId] = {
        type: "utility",
        name: `Cast ${spellName}`,
        activation: {
          type: "action",
          value: 1,
        },
        uses: {
          spent: 0,
          max: "",
          recovery: [],
        },
        description: {
          value: `<p>Cast ${spellName} using charges from this item.</p>`,
        },
      };
    }
    itemData.system.activities = activities;
  }

  return itemData;
}

/* ======================== Public API ======================== */

/**
 * Main mapper: Open5e item → dnd5e Item data.
 * @param {object} data - Raw Open5e JSON
 * @param {string} sourceType - "weapon" | "armor" | "magicitem"
 */
export function mapItem(data, sourceType) {
  if (sourceType === "weapon") return mapWeapon(data);
  if (sourceType === "armor") return mapArmor(data);
  return mapMagicItem(data);
}

/**
 * Generate preview HTML for an item.
 */
export function previewItem(data, sourceType) {
  let html = `<div class="ci-stat-block ci-item-block">`;
  html += `<h2 class="ci-stat-name">${data.name}</h2>`;

  if (data.type) {
    html += `<p class="ci-stat-meta"><em>${data.type}${data.rarity ? `, ${data.rarity}` : ""}</em></p>`;
  } else if (sourceType === "weapon") {
    html += `<p class="ci-stat-meta"><em>Weapon${data.category ? ` (${data.category})` : ""}</em></p>`;
  } else if (sourceType === "armor") {
    html += `<p class="ci-stat-meta"><em>Armor${data.category ? ` (${data.category})` : ""}</em></p>`;
  }

  // Source book
  if (data.document__title) {
    const isOfficial = (data.document__title ?? "").includes("SRD");
    const badgeClass = isOfficial ? "ci-badge-book-official" : "ci-badge-book-3p";
    html += `<p class="ci-stat-source"><span class="ci-badge ${badgeClass}">📖 ${data.document__title}</span></p>`;
  }

  html += `<div class="ci-stat-divider"></div>`;

  // Magic item parsed properties
  if (sourceType === "magicitem" || sourceType === "magicitem") {
    const desc = data.desc ?? "";
    const parsed = parseMagicItemDescription(desc);
    const nameBonus = parseBonusFromName(data.name);
    const bonus = parsed.magicalBonus || nameBonus;

    const props = [];
    if (parsed.requiresAttunement) {
      props.push(`<strong>Attunement:</strong> Required${parsed.attunementBy ? ` (by ${parsed.attunementBy})` : ""}`);
    }
    if (bonus) {
      props.push(`<strong>Magical Bonus:</strong> +${bonus}`);
    }
    if (parsed.charges) {
      let chargeStr = `<strong>Charges:</strong> ${parsed.charges}`;
      if (parsed.recovery) chargeStr += ` (regains ${parsed.recovery} at dawn)`;
      props.push(chargeStr);
    }
    if (parsed.resistances?.length) {
      props.push(`<strong>Resistances:</strong> ${parsed.resistances.join(", ")}`);
    }
    if (parsed.immunities?.length) {
      props.push(`<strong>Immunities:</strong> ${parsed.immunities.join(", ")}`);
    }
    if (parsed.statOverride) {
      const abilityName = Object.entries(ABILITY_MAP).find(([k, v]) => v === parsed.statOverride.ability && k.length > 3)?.[0] ?? parsed.statOverride.ability;
      props.push(`<strong>${abilityName.charAt(0).toUpperCase() + abilityName.slice(1)}:</strong> Set to ${parsed.statOverride.value}`);
    }
    if (parsed.spells?.length) {
      props.push(`<strong>Spells:</strong> ${parsed.spells.join(", ")}`);
    }

    if (props.length) {
      html += props.map(p => `<p>${p}</p>`).join("");
      html += `<div class="ci-stat-divider"></div>`;
    }
  }

  if (data.requires_attunement && sourceType !== "magicitem") {
    html += `<p><em>${data.requires_attunement}</em></p>`;
  }

  if (sourceType === "weapon") {
    if (data.damage_dice) html += `<p><strong>Damage:</strong> ${data.damage_dice} ${data.damage_type ?? ""}</p>`;
    if (data.weight) html += `<p><strong>Weight:</strong> ${data.weight} lb.</p>`;
    if (data.cost) html += `<p><strong>Cost:</strong> ${data.cost}</p>`;
    if (data.properties?.length) html += `<p><strong>Properties:</strong> ${data.properties.join(", ")}</p>`;
  }

  if (sourceType === "armor") {
    if (data.base_ac) html += `<p><strong>AC:</strong> ${data.base_ac}${data.max_dex_modifier != null ? ` (max Dex ${data.max_dex_modifier})` : ""}</p>`;
    if (data.weight) html += `<p><strong>Weight:</strong> ${data.weight} lb.</p>`;
    if (data.cost) html += `<p><strong>Cost:</strong> ${data.cost}</p>`;
    if (data.strength_requirement) html += `<p><strong>Strength:</strong> ${data.strength_requirement}</p>`;
    if (data.stealth_disadvantage) html += `<p><strong>Stealth:</strong> Disadvantage</p>`;
  }

  html += `<div class="ci-stat-divider"></div>`;
  html += `<p>${data.desc ?? ""}</p>`;
  html += `</div>`;
  return html;
}

function parseGP(costStr) {
  if (!costStr) return 0;
  if (typeof costStr === "number") return costStr;
  const match = costStr.match(/([\d,]+)\s*gp/i);
  if (match) return parseInt(match[1].replace(/,/g, ""));
  const spMatch = costStr.match(/([\d,]+)\s*sp/i);
  if (spMatch) return parseInt(spMatch[1].replace(/,/g, "")) / 10;
  const cpMatch = costStr.match(/([\d,]+)\s*cp/i);
  if (cpMatch) return parseInt(cpMatch[1].replace(/,/g, "")) / 100;
  return 0;
}
