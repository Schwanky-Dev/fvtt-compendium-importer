import { BaseScraper } from "./base.mjs";

const DDB_BASE = "https://www.dndbeyond.com";

/**
 * D&D Beyond scraper. Requires a CORS proxy since DDB doesn't allow
 * cross-origin requests from arbitrary origins.
 */
export class DDBScraper extends BaseScraper {
  static id = "ddb";
  static label = "D&D Beyond";
  static color = "#C53131";
  static requiresProxy = true;

  isEnabled() {
    return game.settings.get("fvtt-compendium-importer", "enableDDB");
  }

  /**
   * DDB has no public search API. We attempt to fetch by slug directly.
   * For real search, you'd need a proxy that can query DDB's internal API.
   * This implementation tries common slug patterns.
   */
  async search(query, category) {
    if (!this.isEnabled()) return [];

    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const endpoints = this._getEndpoints(category);
    const results = [];

    const fetches = endpoints.map(async (ep) => {
      try {
        const url = `${DDB_BASE}${ep.path}${slug}`;
        const response = await this.proxyFetch(url);
        if (!response.ok) return;

        const html = await response.text();
        const parsed = this._parseHTML(html, ep.type, slug);
        if (parsed) results.push(parsed);
      } catch (err) {
        // Expected to fail without proxy — CORS will block
        console.debug(`Compendium Importer | DDB fetch failed (CORS expected):`, err.message);
      }
    });

    await Promise.all(fetches);
    return results;
  }

  async fetchDetails(result) {
    const url = result.url || `${DDB_BASE}/monsters/${result.slug}`;
    const response = await this.proxyFetch(url);
    if (!response.ok) throw new Error(`DDB returned ${response.status}`);
    const html = await response.text();
    return { html, type: result.type, slug: result.slug, source: "ddb" };
  }

  _getEndpoints(category) {
    const all = [
      { path: "/monsters/", type: "monster" },
      { path: "/spells/", type: "spell" },
      { path: "/magic-items/", type: "magicitem" },
    ];
    if (category === "monsters") return [all[0]];
    if (category === "spells") return [all[1]];
    if (category === "items") return [all[2]];
    return all;
  }

  _parseHTML(html, type, slug) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    let name;
    if (type === "monster") {
      name = doc.querySelector(".mon-stat-block__name-link, .mon-stat-block h1")?.textContent?.trim();
    } else if (type === "spell") {
      name = doc.querySelector(".spell-name, .page-title")?.textContent?.trim();
    } else {
      name = doc.querySelector(".magic-item-heading .page-title, .page-title")?.textContent?.trim();
    }

    if (!name) return null;

    return {
      name,
      slug,
      type,
      source: DDBScraper.id,
      sourceLabel: DDBScraper.label,
      sourceColor: DDBScraper.color,
      url: `${DDB_BASE}/${type === "monster" ? "monsters" : type === "spell" ? "spells" : "magic-items"}/${slug}`,
      _raw: { html, name },
    };
  }
}
