/**
 * Maps Open5e item JSON → Foundry dnd5e Item data.
 * Handles magic items, weapons, armor, and generic equipment.
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

/**
 * Determine Foundry item type from Open5e data.
 */
function determineItemType(data, sourceType) {
  if (sourceType === "weapon") return "weapon";
  if (sourceType === "armor") return "equipment";

  // Magic items — try to infer
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

  // Parse damage
  const dmgMatch = data.damage_dice?.match(/(\d+d\d+)/);
  const dmgType = (data.damage_type ?? "bludgeoning").toLowerCase();

  return {
    name: data.name,
    type: "weapon",
    system: {
      description: { value: `<p>${data.desc ?? data.name}</p>` },
      source: { custom: "Open5e SRD" },
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
      source: { custom: "Open5e SRD" },
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
 */
function mapMagicItem(data) {
  const foundryType = determineItemType(data, "magicitem");
  const rarity = RARITY_MAP[(data.rarity ?? "").toLowerCase()] ?? "common";

  const itemData = {
    name: data.name,
    type: foundryType,
    system: {
      description: { value: `<p>${data.desc ?? ""}</p>` },
      source: { custom: data.document__slug ?? "Open5e SRD" },
      quantity: 1,
      weight: { value: 0, units: "lb" },
      rarity,
      attunement: "",
      equipped: false,
    },
  };

  // Check for attunement
  if (data.requires_attunement?.toLowerCase()?.includes("yes") ||
      data.requires_attunement === "requires attunement") {
    itemData.system.attunement = "required";
  }

  return itemData;
}

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

  html += `<div class="ci-stat-divider"></div>`;

  if (data.requires_attunement) {
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
