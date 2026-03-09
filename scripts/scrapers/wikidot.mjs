import { BaseScraper } from "./base.mjs";

const WIKIDOT_BASE = "https://dnd5e.wikidot.com";

/**
 * dnd5e.wikidot.com scraper — large SRD wiki with monsters, spells, and items.
 * Requires CORS proxy since Wikidot doesn't set Access-Control-Allow-Origin.
 */
export class WikidotScraper extends BaseScraper {
  static id = "wikidot";
  static label = "5e Wikidot";
  static color = "#7B68EE";
  static requiresProxy = true;

  isEnabled() {
    return game.settings.get("fvtt-compendium-importer", "enableWikidot");
  }

  /**
   * Wikidot has no search API. We try common page patterns by slug.
   * Pages follow predictable URL structures:
   *   Monsters: /monster:slug
   *   Spells:   /spell:slug
   *   Items:    /items:slug or /wondrous-items:slug
   */
  async search(query, category) {
    if (!this.isEnabled()) return [];

    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const endpoints = this._getEndpoints(category, slug);
    const results = [];

    const fetches = endpoints.map(async (ep) => {
      try {
        const url = `${WIKIDOT_BASE}${ep.path}`;
        const response = await fetch(url, { mode: "cors" });
        if (!response.ok) return;

        const html = await response.text();
        const parsed = this._parseHTML(html, ep.type, slug, url);
        if (parsed) results.push(parsed);
      } catch (err) {
        console.debug(`Compendium Importer | Wikidot fetch failed (CORS expected):`, err.message);
      }
    });

    await Promise.all(fetches);
    return results;
  }

  async fetchDetails(result) {
    const url = result.url || `${WIKIDOT_BASE}/monster:${result.slug}`;
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`Wikidot returned ${response.status}`);
    const html = await response.text();
    return { html, type: result.type, slug: result.slug, source: "wikidot" };
  }

  _getEndpoints(category, slug) {
    const all = [
      { path: `/monster:${slug}`, type: "monster" },
      { path: `/spell:${slug}`, type: "spell" },
      { path: `/items:${slug}`, type: "magicitem" },
      { path: `/wondrous-items:${slug}`, type: "magicitem" },
    ];
    if (category === "monsters") return [all[0]];
    if (category === "spells") return [all[1]];
    if (category === "items") return all.slice(2);
    return all;
  }

  /**
   * Parse Wikidot HTML stat blocks. The site uses a fairly consistent structure
   * with content inside #page-content, stat blocks in <table> elements or
   * structured <p> / <ul> elements.
   */
  _parseHTML(html, type, slug, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const content = doc.querySelector("#page-content");
    if (!content) return null;

    // Page title is usually the first h1 or the breadcrumb
    let name = doc.querySelector("#page-title")?.textContent?.trim()
            || doc.querySelector("h1")?.textContent?.trim();

    if (!name || name.toLowerCase().includes("page does not exist")) return null;

    // Clean up name
    name = name.replace(/^\s*Monster:\s*/i, "")
               .replace(/^\s*Spell:\s*/i, "")
               .replace(/^\s*Items?:\s*/i, "")
               .trim();

    if (!name) return null;

    const result = {
      name,
      slug,
      type,
      source: WikidotScraper.id,
      sourceLabel: WikidotScraper.label,
      sourceColor: WikidotScraper.color,
      url,
      _raw: { html: content.innerHTML, name },
    };

    // Try to extract metadata for display
    if (type === "monster") {
      result.cr = this._extractField(content, /Challenge\s*(\d+[\d/]*)/i);
      result.type_display = this._extractField(content, /^((?:Tiny|Small|Medium|Large|Huge|Gargantuan)\s+\w+)/im) || "";
    } else if (type === "spell") {
      result.level = this._extractSpellLevel(content);
      result.school = this._extractField(content, /(abjuration|conjuration|divination|enchantment|evocation|illusion|necromancy|transmutation)/i) || "";
    } else {
      result.rarity = this._extractField(content, /(common|uncommon|rare|very rare|legendary|artifact)/i) || "";
    }

    return result;
  }

  _extractField(el, regex) {
    const text = el.textContent || "";
    const match = text.match(regex);
    return match?.[1] ?? null;
  }

  _extractSpellLevel(el) {
    const text = el.textContent || "";
    const cantripMatch = text.match(/\bcantrip\b/i);
    if (cantripMatch) return "0";
    const levelMatch = text.match(/(\d)\w{2}[\s-]*level/i);
    return levelMatch?.[1] ?? null;
  }
}
