/**
 * Internal scraper — searches Foundry's own compendium packs.
 * Finds monsters, spells, and items from any installed system/module compendiums.
 */
import { BaseScraper } from "./base.mjs";

export class InternalScraper extends BaseScraper {
  static id = "internal";
  static label = "Internal";
  static color = "#9C27B0"; // Purple for internal/Foundry
  static requiresProxy = false;

  isEnabled() {
    return game.settings.get("fvtt-compendium-importer", "enableInternal");
  }

  async search(query, category) {
    if (!this.isEnabled()) return [];
    const results = [];
    const lowerQuery = query.toLowerCase();

    // Determine which compendium types to search
    const packTypes = [];
    if (!category || category === "monsters") packTypes.push("Actor");
    if (!category || category === "spells" || category === "items") packTypes.push("Item");

    for (const pack of game.packs) {
      if (!packTypes.includes(pack.documentName)) continue;

      try {
        const index = await pack.getIndex();
        for (const entry of index) {
          if (!entry.name.toLowerCase().includes(lowerQuery)) continue;

          // Determine result type from the pack/entry
          let type = "magicitem";
          if (pack.documentName === "Actor") type = "monster";
          else if (entry.type === "spell") type = "spell";
          else if (entry.type === "weapon") type = "weapon";
          else if (entry.type === "equipment" || entry.type === "armor") type = "armor";

          results.push({
            name: entry.name,
            slug: entry.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
            type,
            source: InternalScraper.id,
            sourceLabel: InternalScraper.label,
            sourceColor: InternalScraper.color,
            url: "",
            documentTitle: pack.metadata.label || pack.metadata.name,
            edition: pack.metadata.name?.includes("2024") ? "2024" : "2014",
            _raw: null,
            _packId: pack.collection,
            _entryId: entry._id,
          });
        }
      } catch (err) {
        console.warn(`fvtt-compendium-importer | Internal pack search failed for ${pack.collection}:`, err);
      }
    }

    return results;
  }

  async fetchDetails(result) {
    if (!result._packId || !result._entryId) throw new Error("Missing pack/entry ID");
    const pack = game.packs.get(result._packId);
    if (!pack) throw new Error(`Pack ${result._packId} not found`);
    const doc = await pack.getDocument(result._entryId);
    return doc;
  }
}
