/**
 * Creates Foundry documents (Actors, Items, JournalEntries) from mapped data.
 */

import { mapMonster, parseSpellcasting, previewMonster } from "./mappers/monster.mjs";
import { mapSpell, previewSpell } from "./mappers/spell.mjs";
import { mapItem, previewItem } from "./mappers/item.mjs";
import { normalizeRoll20 } from "./mappers/roll20-normalize.mjs";

const MODULE_ID = "fvtt-compendium-importer";

/**
 * If the result came from Roll20, normalize its _raw data to Open5e format.
 * Mutates result._raw in place and returns the normalized data.
 */
function ensureNormalized(result) {
  if (result.source === "roll20" && result._raw && !result._raw._roll20Normalized) {
    result._raw = normalizeRoll20(result._raw, result.type);
    result._raw._roll20Normalized = true;
  }
  return result._raw;
}

/**
 * Get the appropriate mapper based on result type.
 */
function getMapper(result) {
  switch (result.type) {
    case "monster":
      return { map: mapMonster, preview: previewMonster };
    case "spell":
      return { map: mapSpell, preview: previewSpell };
    case "weapon":
    case "armor":
    case "magicitem":
      return {
        map: (data) => mapItem(data, result.type),
        preview: (data) => previewItem(data, result.type),
      };
    default:
      return {
        map: (data) => mapItem(data, "magicitem"),
        preview: (data) => previewItem(data, "magicitem"),
      };
  }
}

/**
 * Generate preview HTML for a search result.
 */
export function generatePreview(result) {
  // DDB results only have name + URL; no parseable stat data
  if (result.source === "ddb") {
    const url = result.url || "#";
    return `<div class="ci-stat-block">` +
      `<h2 class="ci-stat-name">${result.name}</h2>` +
      `<div class="ci-stat-divider"></div>` +
      `<p>Source: <strong>D&D Beyond</strong></p>` +
      `<p>Stat data is not available from D&D Beyond (pages are dynamically rendered).</p>` +
      `<p>Import will create a <strong>Journal Entry</strong> with a link to the D&D Beyond page.</p>` +
      `<p><a href="${url}" target="_blank" rel="noopener">${url}</a></p>` +
      `</div>`;
  }

  ensureNormalized(result);
  const data = result._raw;
  if (!data) return `<p>No data available for preview.</p>`;

  const { preview } = getMapper(result);
  try {
    return preview(data);
  } catch (err) {
    console.error(`${MODULE_ID} | Preview generation failed:`, err);
    return `<div class="ci-stat-block"><h2>${result.name}</h2><p>Preview generation failed: ${err.message}</p></div>`;
  }
}

/**
 * Import a search result as a specific document type.
 */
export async function importResult(result, importType, scraper) {
  let data = result._raw;
  if (scraper && (!data || Object.keys(data).length < 5)) {
    try {
      data = await scraper.fetchDetails(result);
      result._raw = data;
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not fetch full details, using search data:`, err);
    }
  }

  if (!data) throw new Error("No data available for import");

  // DDB results have no parseable stats — always create a Journal Entry
  if (result.source === "ddb") {
    return importAsJournal(result, { name: result.name, _ddbUrl: result.url });
  }

  // Normalize Roll20 data before passing to mappers
  ensureNormalized(result);
  data = result._raw;

  switch (importType) {
    case "actor":
      return importAsActor(result, data);
    case "item":
      return importAsItem(result, data);
    case "journal":
      return importAsJournal(result, data);
    default:
      return importDefault(result, data);
  }
}

/**
 * Resolve a spell name to a Foundry Item data object.
 * Tries dnd5e system compendiums first (multiple pack names), then Open5e API.
 */
async function resolveSpellItem(spellName, mode, uses) {
  // Common alternate names (Open5e name → compendium name)
  const SPELL_ALIASES = {
    "acid arrow": "melf's acid arrow",
    "melf's acid arrow": "acid arrow",
    "tiny hut": "leomund's tiny hut",
    "leomund's tiny hut": "tiny hut",
    "arcane hand": "bigby's hand",
    "bigby's hand": "arcane hand",
    "black tentacles": "evard's black tentacles",
    "evard's black tentacles": "black tentacles",
    "floating disk": "tenser's floating disk",
    "tenser's floating disk": "floating disk",
    "hideous laughter": "tasha's hideous laughter",
    "tasha's hideous laughter": "hideous laughter",
    "instant summons": "drawmij's instant summons",
    "arcanist's magic aura": "nystul's magic aura",
    "irresistible dance": "otto's irresistible dance",
    "secret chest": "leomund's secret chest",
    "faithful hound": "mordenkainen's faithful hound",
    "magnificent mansion": "mordenkainen's magnificent mansion",
    "private sanctum": "mordenkainen's private sanctum",
    "resilient sphere": "otiluke's resilient sphere",
    "freezing sphere": "otiluke's freezing sphere",
    "telepathic bond": "rary's telepathic bond",
    "sword": "mordenkainen's sword",
  };

  // Try multiple compendium pack names (dnd5e v3 may use different names)
  const PACK_NAMES = ["dnd5e.spells", "dnd5e.spells-2024", "dnd5e.items"];
  const namesToTry = [spellName.toLowerCase()];
  const alias = SPELL_ALIASES[spellName.toLowerCase()];
  if (alias) namesToTry.push(alias.toLowerCase());

  for (const packName of PACK_NAMES) {
    try {
      const pack = game.packs.get(packName);
      if (!pack) continue;
      await pack.getIndex();
      for (const tryName of namesToTry) {
        const entry = pack.index.find(i => i.name.toLowerCase() === tryName);
        if (entry) {
          const doc = await pack.getDocument(entry._id);
          const itemData = doc.toObject();
          applySpellPreparation(itemData, mode, uses);
          return itemData;
        }
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Pack "${packName}" lookup failed for "${spellName}":`, err);
    }
  }

  // Try Open5e API
  try {
    const slug = spellName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const response = await fetch(`https://api.open5e.com/v1/spells/${slug}/`);
    if (response.ok) {
      const spellData = await response.json();
      const itemData = mapSpell(spellData);
      applySpellPreparation(itemData, mode, uses);
      return itemData;
    }
  } catch (err) {
    console.warn(`${MODULE_ID} | Open5e lookup failed for "${spellName}":`, err);
  }

  console.warn(`${MODULE_ID} | Could not resolve spell: "${spellName}"`);
  return null;
}

/**
 * Apply preparation mode and uses to a spell item.
 */
function applySpellPreparation(itemData, mode, uses) {
  if (!itemData.system) itemData.system = {};
  if (!itemData.system.preparation) itemData.system.preparation = {};

  if (mode === "innate") {
    itemData.system.preparation.mode = "innate";
    itemData.system.preparation.prepared = true;
    if (uses) {
      itemData.system.uses = {
        value: uses,
        max: String(uses),
        per: "day",
        recovery: "",
      };
    }
  } else if (mode === "atwill") {
    itemData.system.preparation.mode = "atwill";
    itemData.system.preparation.prepared = true;
  } else {
    // Regular prepared spell
    itemData.system.preparation.mode = "prepared";
    itemData.system.preparation.prepared = true;
  }
}

/**
 * Download an external image via CORS proxy and upload to Foundry's filesystem.
 */
async function downloadAndUploadImage(url, filename) {
  try {
    const proxyUrl = game.settings.get(MODULE_ID, "corsProxyUrl");
    const fetchUrl = proxyUrl ? `${proxyUrl.replace(/\/+$/, "")}/proxy?url=${encodeURIComponent(url)}` : url;
    const response = await fetch(fetchUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type || "image/png" });
    const result = await FilePicker.upload("data", "compendomize-images", file);
    return result?.path || null;
  } catch (err) {
    console.warn(`${MODULE_ID} | Image download failed for ${url}:`, err);
    return null;
  }
}

/**
 * Import as Actor (NPC).
 */
async function importAsActor(result, data) {
  let actorData, spellcasting, externalImg;

  if (result.type === "monster") {
    const mapped = mapMonster(data);
    actorData = mapped.actorData;
    spellcasting = mapped.spellcasting;
    externalImg = mapped.externalImg;
  } else {
    actorData = {
      name: data.name ?? result.name,
      type: "npc",
      system: {
        details: {
          biography: { value: generatePreview(result) },
          source: { custom: result.sourceLabel ?? "Compendomize" },
        },
      },
    };
  }

  // Extract embedded items before creating
  const embeddedItems = actorData.items || [];
  delete actorData.items;

  const actor = await Actor.create(actorData);
  if (!actor) {
    throw new Error(`Failed to create Actor "${actorData.name}". Check the console for validation errors.`);
  }

  // Create embedded items (actions, features, etc.)
  if (embeddedItems.length > 0) {
    await actor.createEmbeddedDocuments("Item", embeddedItems);
  }

  // Download and localize external images (stored separately to avoid CORS on token render)
  if (externalImg) {
    const localPath = await downloadAndUploadImage(
      externalImg,
      `${(actorData.name || "monster").replace(/[^a-z0-9]/gi, "-")}.png`
    );
    if (localPath) {
      await actor.update({ img: localPath, "prototypeToken.texture.src": localPath });
    }
  }

  // Resolve and add spells asynchronously
  if (spellcasting && spellcasting.spellNames.length > 0) {
    // Deduplicate spell names (same name+mode = same spell)
    const seenSpells = new Set();
    const uniqueSpellNames = spellcasting.spellNames.filter(({ name, mode }) => {
      const key = `${name.toLowerCase()}::${mode}`;
      if (seenSpells.has(key)) return false;
      seenSpells.add(key);
      return true;
    });

    const spellItems = [];
    for (const { name, mode, uses } of uniqueSpellNames) {
      const item = await resolveSpellItem(name, mode, uses);
      if (item) {
        // Remove _id so Foundry generates a new one
        delete item._id;
        spellItems.push(item);
      }
    }
    if (spellItems.length > 0) {
      await actor.createEmbeddedDocuments("Item", spellItems);
    }

    // Also add a "Spellcasting" feature item with the full text for reference
    const scAbility = (data.special_abilities || []).find(a => /^(?:innate )?spellcasting$/i.test(a.name));
    if (scAbility) {
      await actor.createEmbeddedDocuments("Item", [{
        name: scAbility.name,
        type: "feat",
        img: "icons/magic/symbols/runes-star-pentagon-blue.webp",
        system: {
          description: { value: scAbility.desc },
          type: { value: "monster" },
          activation: { type: "special" },
        },
      }]);
    }
  }

  return actor;
}

/**
 * Import as Item.
 */
async function importAsItem(result, data) {
  const { map } = getMapper(result);
  let itemData;

  try {
    const mapped = map(data);
    // mapMonster now returns { actorData, spellcasting } — handle both shapes
    itemData = mapped.actorData || mapped;
  } catch (err) {
    itemData = {
      name: data.name ?? result.name,
      type: "loot",
      system: {
        description: { value: generatePreview(result) },
        source: { custom: result.sourceLabel ?? "Compendomize" },
      },
    };
  }

  if (result.type === "monster" && itemData.type === "npc") {
    itemData = {
      name: data.name ?? result.name,
      type: "feat",
      system: {
        description: { value: generatePreview(result) },
        source: { custom: result.sourceLabel ?? "Compendomize" },
      },
    };
  }

  delete itemData.items;
  const item = await Item.create(itemData);
  return item;
}

/**
 * Import as Journal Entry.
 */
async function importAsJournal(result, data) {
  let previewHTML = generatePreview(result);
  // For DDB results, include a direct link in the journal page
  if (data._ddbUrl) {
    previewHTML = `<h2>${data.name ?? result.name}</h2>` +
      `<p>Imported from <strong>D&D Beyond</strong>.</p>` +
      `<p><a href="${data._ddbUrl}" target="_blank" rel="noopener">View on D&D Beyond</a></p>`;
  }
  const journalData = {
    name: data.name ?? result.name,
    pages: [{
      name: data.name ?? result.name,
      type: "text",
      text: { content: previewHTML, format: 1 },
    }],
  };
  const journal = await JournalEntry.create(journalData);
  return journal;
}

/**
 * Import using the best default type for the content.
 */
async function importDefault(result, data) {
  const defaultType = game.settings.get(MODULE_ID, "defaultImportType") ?? "auto";
  if (defaultType === "actor" || (defaultType === "auto" && result.type === "monster")) {
    return importAsActor(result, data);
  } else if (defaultType === "journal") {
    return importAsJournal(result, data);
  } else {
    return importAsItem(result, data);
  }
}
