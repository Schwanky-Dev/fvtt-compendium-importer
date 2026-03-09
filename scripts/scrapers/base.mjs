/**
 * Base scraper interface. All scrapers extend this.
 */
export class BaseScraper {
  /** @type {string} Unique source identifier */
  static id = "base";
  /** @type {string} Human-readable name */
  static label = "Base";
  /** @type {string} CSS color for source badge */
  static color = "#888888";
  /** @type {boolean} Whether this source requires a CORS proxy */
  static requiresProxy = false;

  /**
   * @param {string} query - Search term
   * @param {string} [category] - Optional: "monsters", "spells", "items"
   * @returns {Promise<SearchResult[]>}
   */
  async search(query, category) {
    throw new Error("search() not implemented");
  }

  /**
   * Fetch full details for a single result.
   * @param {SearchResult} result
   * @returns {Promise<object>} Raw source data
   */
  async fetchDetails(result) {
    throw new Error("fetchDetails() not implemented");
  }

  /**
   * Check if this scraper is enabled in module settings.
   * @returns {boolean}
   */
  isEnabled() {
    return true;
  }
}

/**
 * @typedef {Object} SearchResult
 * @property {string} name - Display name
 * @property {string} slug - URL-safe identifier
 * @property {string} type - "monster" | "spell" | "magicitem" | "weapon" | "armor" | "item"
 * @property {string} source - Scraper id (e.g. "open5e")
 * @property {string} [sourceLabel] - Human-readable source
 * @property {string} [sourceColor] - Badge color
 * @property {string} [url] - Original URL
 * @property {string} [cr] - Challenge rating (monsters)
 * @property {string} [level] - Spell level
 * @property {string} [school] - Spell school
 * @property {string} [rarity] - Item rarity
 * @property {string} [type_display] - e.g. "Large beast"
 * @property {string} [documentTitle] - Source book name (e.g. "SRD 5.1", "Tome of Beasts")
 * @property {string} [documentSlug] - Source book slug (e.g. "wotc-srd")
 * @property {object} [_raw] - Raw API data for preview/import
 */
