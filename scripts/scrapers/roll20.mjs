import { BaseScraper } from "./base.mjs";

const ROLL20_BASE = "https://roll20.net/compendium/dnd5e";

/**
 * Roll20 compendium scraper. Uses Roll20's JSON API for structured data.
 * Requires a CORS proxy since Roll20 doesn't allow cross-origin requests.
 */
export class Roll20Scraper extends BaseScraper {
  static id = "roll20";
  static label = "Roll20";
  static color = "#EB1C24";
  static requiresProxy = true;

  isEnabled() {
    return game.settings.get("fvtt-compendium-importer", "enableRoll20");
  }

  /**
   * Capitalize each word for Roll20's case-sensitive URLs.
   * e.g. "giant boar" → "Giant Boar"
   */
  _titleCase(str) {
    return str.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  async search(query, category) {
    if (!this.isEnabled()) return [];

    const titleQuery = this._titleCase(query);
    const results = [];

    try {
      // Roll20 has a JSON API: /compendium/dnd5e/Name.json
      const url = `${ROLL20_BASE}/${encodeURIComponent(titleQuery)}.json`;
      const response = await this.proxyFetch(url);
      if (!response.ok) return [];

      const json = await response.json();
      if (!json.name) return [];

      const cat = (json.data?.Category || "").toLowerCase();
      // Filter by category if specified
      if (category === "monsters" && cat !== "monsters") return [];
      if (category === "spells" && cat !== "spells") return [];
      if (category === "items" && !["items", "magic items"].includes(cat)) return [];

      const type = cat === "monsters" ? "monster" : cat === "spells" ? "spell" : "magicitem";

      results.push({
        name: json.name,
        slug: json.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        type,
        source: Roll20Scraper.id,
        sourceLabel: Roll20Scraper.label,
        sourceColor: Roll20Scraper.color,
        url: `${ROLL20_BASE}/${encodeURIComponent(json.name)}`,
        _raw: json,
      });
    } catch (err) {
      console.warn(`Compendium Importer | Roll20 fetch failed:`, err.message);
    }

    return results;
  }

  async fetchDetails(result) {
    // If we already have the full JSON data from search, return it
    if (result._raw?.data) {
      return { json: result._raw, type: result.type, slug: result.slug, source: "roll20" };
    }

    const url = `${ROLL20_BASE}/${encodeURIComponent(result.name)}.json`;
    const response = await this.proxyFetch(url);
    if (!response.ok) throw new Error(`Roll20 returned ${response.status}`);
    const json = await response.json();
    return { json, type: result.type, slug: result.slug, source: "roll20" };
  }
}
