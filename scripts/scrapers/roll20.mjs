import { BaseScraper } from "./base.mjs";

const ROLL20_BASE = "https://roll20.net/compendium/dnd5e";

/**
 * Roll20 compendium scraper. Like DDB, requires a CORS proxy.
 */
export class Roll20Scraper extends BaseScraper {
  static id = "roll20";
  static label = "Roll20";
  static color = "#EB1C24";
  static requiresProxy = true;

  isEnabled() {
    return game.settings.get("fvtt-compendium-importer", "enableRoll20");
  }

  async search(query, category) {
    if (!this.isEnabled()) return [];

    const slug = query.replace(/\s+/g, "%20");
    const categories = this._getCategories(category);
    const results = [];

    const fetches = categories.map(async (cat) => {
      try {
        const url = `${ROLL20_BASE}/${encodeURIComponent(query)}#content`;
        const response = await this.proxyFetch(url);
        if (!response.ok) return;

        const html = await response.text();
        const parsed = this._parseHTML(html, cat.type, query);
        if (parsed) results.push(parsed);
      } catch (err) {
        console.debug(`Compendium Importer | Roll20 fetch failed (CORS expected):`, err.message);
      }
    });

    await Promise.all(fetches);
    return results;
  }

  async fetchDetails(result) {
    const url = result.url || `${ROLL20_BASE}/${encodeURIComponent(result.name)}`;
    const response = await this.proxyFetch(url);
    if (!response.ok) throw new Error(`Roll20 returned ${response.status}`);
    const html = await response.text();
    return { html, type: result.type, slug: result.slug, source: "roll20" };
  }

  _getCategories(category) {
    const all = [
      { type: "monster" },
      { type: "spell" },
      { type: "magicitem" },
    ];
    if (category === "monsters") return [all[0]];
    if (category === "spells") return [all[1]];
    if (category === "items") return [all[2]];
    return all;
  }

  _parseHTML(html, type, query) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const entry = doc.querySelector(".compendium-entry, #content");
    if (!entry) return null;

    const name = doc.querySelector("h1.page-title, h1")?.textContent?.trim() || query;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return {
      name,
      slug,
      type,
      source: Roll20Scraper.id,
      sourceLabel: Roll20Scraper.label,
      sourceColor: Roll20Scraper.color,
      url: `${ROLL20_BASE}/${encodeURIComponent(name)}`,
      _raw: { html: entry.innerHTML, name },
    };
  }
}
