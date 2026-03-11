import { BaseScraper } from "./base.mjs";

const DDB_BASE = "https://www.dndbeyond.com";

/**
 * D&D Beyond scraper. Searches listing pages to find correct URLs
 * (which include numeric IDs), then fetches individual pages.
 * Requires a CORS proxy since DDB doesn't allow cross-origin requests.
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
   * Search DDB by fetching the listing/search pages and extracting links.
   * DDB URLs have numeric IDs (e.g. /monsters/16812-boar) so we can't
   * construct them from the name alone.
   */
  async search(query, category) {
    if (!this.isEnabled()) return [];

    const endpoints = this._getSearchEndpoints(category, query);
    const results = [];

    const fetches = endpoints.map(async (ep) => {
      try {
        // Step 1: Fetch the search/listing page
        const listUrl = `${DDB_BASE}${ep.listPath}?filter-search=${encodeURIComponent(query)}`;
        const listResponse = await this.proxyFetch(listUrl);
        if (!listResponse.ok) return;

        const listHtml = await listResponse.text();

        // Step 2: Extract matching links from listing page
        const linkPattern = new RegExp(`href="(${ep.linkPrefix}[^"]*)"`, "gi");
        const foundLinks = new Set();
        let match;
        while ((match = linkPattern.exec(listHtml)) !== null) {
          foundLinks.add(match[1]);
        }

        // Step 3: Fetch each found page and parse it
        const pagePromises = [...foundLinks].slice(0, 5).map(async (path) => {
          try {
            const pageUrl = `${DDB_BASE}${path}`;
            const pageResponse = await this.proxyFetch(pageUrl);
            if (!pageResponse.ok) return;

            const html = await pageResponse.text();
            const parsed = this._parseHTML(html, ep.type, path, pageUrl);
            if (parsed) results.push(parsed);
          } catch (err) {
            console.debug(`Compendium Importer | DDB page fetch failed:`, err.message);
          }
        });

        await Promise.all(pagePromises);
      } catch (err) {
        console.debug(`Compendium Importer | DDB search failed:`, err.message);
      }
    });

    await Promise.all(fetches);
    return results;
  }

  async fetchDetails(result) {
    const url = result.url;
    if (!url) throw new Error("No URL for DDB result");
    const response = await this.proxyFetch(url);
    if (!response.ok) throw new Error(`DDB returned ${response.status}`);
    const html = await response.text();
    return { html, type: result.type, slug: result.slug, source: "ddb" };
  }

  _getSearchEndpoints(category, query) {
    const all = [
      { listPath: "/monsters", linkPrefix: "/monsters/", type: "monster" },
      { listPath: "/spells", linkPrefix: "/spells/", type: "spell" },
      { listPath: "/magic-items", linkPrefix: "/magic-items/", type: "magicitem" },
    ];
    if (category === "monsters") return [all[0]];
    if (category === "spells") return [all[1]];
    if (category === "items") return [all[2]];
    return all;
  }

  _parseHTML(html, type, path, fullUrl) {
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

    const slug = path.split("/").pop() || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return {
      name,
      slug,
      type,
      source: DDBScraper.id,
      sourceLabel: DDBScraper.label,
      sourceColor: DDBScraper.color,
      url: fullUrl,
      _raw: { html, name },
    };
  }
}
