/**
 * Creates Foundry documents (Actors, Items, JournalEntries) from mapped data.
 */

import { mapMonster, previewMonster } from "./mappers/monster.mjs";
import { mapSpell, previewSpell } from "./mappers/spell.mjs";
import { mapItem, previewItem } from "./mappers/item.mjs";

const MODULE_ID = "fvtt-compendium-importer";

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
 * @param {object} result - SearchResult with _raw data
 * @returns {string} HTML string
 */
export function generatePreview(result) {
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
 * @param {object} result - SearchResult with _raw data
 * @param {"actor"|"item"|"journal"} importType - What to create
 * @param {object} [scraper] - Scraper instance for fetching full details
 * @returns {Promise<Document>} The created Foundry document
 */
export async function importResult(result, importType, scraper) {
  // If we need full details and have a scraper, fetch them
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
 * Import as Actor (NPC).
 */
async function importAsActor(result, data) {
  let actorData;

  if (result.type === "monster") {
    actorData = mapMonster(data);
  } else {
    // For non-monsters, create a basic NPC with the content as biography
    actorData = {
      name: data.name ?? result.name,
      type: "npc",
      system: {
        details: {
          biography: { value: generatePreview(result) },
          source: { custom: result.sourceLabel ?? "Compendium Importer" },
        },
      },
    };
  }

  // Extract embedded items before creating
  const embeddedItems = actorData.items || [];
  delete actorData.items;

  const actor = await Actor.create(actorData);

  // Create embedded items
  if (embeddedItems.length > 0) {
    await actor.createEmbeddedDocuments("Item", embeddedItems);
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
    itemData = map(data);
  } catch (err) {
    // Fallback: create a loot item with description
    itemData = {
      name: data.name ?? result.name,
      type: "loot",
      system: {
        description: { value: generatePreview(result) },
        source: { custom: result.sourceLabel ?? "Compendium Importer" },
      },
    };
  }

  // For monsters imported as items, make a feat
  if (result.type === "monster" && itemData.type === "npc") {
    itemData = {
      name: data.name ?? result.name,
      type: "feat",
      system: {
        description: { value: generatePreview(result) },
        source: { custom: result.sourceLabel ?? "Compendium Importer" },
      },
    };
  }

  // Remove items array if present (Actor-only)
  delete itemData.items;

  const item = await Item.create(itemData);
  return item;
}

/**
 * Import as Journal Entry.
 */
async function importAsJournal(result, data) {
  const previewHTML = generatePreview(result);

  const journalData = {
    name: data.name ?? result.name,
    pages: [
      {
        name: data.name ?? result.name,
        type: "text",
        text: {
          content: previewHTML,
          format: 1, // HTML
        },
      },
    ],
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
