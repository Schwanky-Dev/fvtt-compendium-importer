/**
 * Main Compendium Importer UI — extends ApplicationV2.
 * Provides search, preview, and import functionality.
 */

import { Open5eScraper } from "../scrapers/open5e.mjs";
import { DDBScraper } from "../scrapers/ddb.mjs";
import { Roll20Scraper } from "../scrapers/roll20.mjs";
import { WikidotScraper } from "../scrapers/wikidot.mjs";
import { generatePreview, importResult } from "../importer.mjs";

const MODULE_ID = "fvtt-compendium-importer";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ImporterApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "compendium-importer",
    tag: "div",
    window: {
      title: "COMPIMPORTER.Title",
      icon: "fas fa-file-import",
      resizable: true,
    },
    position: {
      width: 800,
      height: 650,
    },
    classes: ["compendium-importer-app"],
    actions: {
      search: ImporterApp.#onSearch,
      importResult: ImporterApp.#onImport,
      previewResult: ImporterApp.#onPreview,
      clearPreview: ImporterApp.#onClearPreview,
      changeCategory: ImporterApp.#onChangeCategory,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/importer.hbs`,
    },
  };

  /** @type {BaseScraper[]} */
  #scrapers = [];

  /** @type {SearchResult[]} */
  #results = [];

  /** @type {SearchResult|null} */
  #selectedResult = null;

  /** @type {string} */
  #previewHTML = "";

  /** @type {boolean} */
  #loading = false;

  /** @type {string} */
  #searchQuery = "";

  /** @type {string} */
  #category = "all";

  /** @type {string} */
  #importType = "auto";

  constructor(options = {}) {
    super(options);
    this.#scrapers = [new Open5eScraper(), new WikidotScraper(), new DDBScraper(), new Roll20Scraper()];
    this.#importType = game.settings.get(MODULE_ID, "defaultImportType") ?? "auto";
  }

  async _prepareContext() {
    return {
      results: this.#results,
      loading: this.#loading,
      searchQuery: this.#searchQuery,
      category: this.#category,
      importType: this.#importType,
      previewHTML: this.#previewHTML,
      selectedResult: this.#selectedResult,
      hasResults: this.#results.length > 0,
      noResults: !this.#loading && this.#searchQuery && this.#results.length === 0,
    };
  }

  /**
   * Perform a search across all enabled scrapers.
   */
  async doSearch(query, category) {
    if (!query?.trim()) return;

    this.#searchQuery = query.trim();
    this.#category = category || "all";
    this.#loading = true;
    this.#results = [];
    this.#selectedResult = null;
    this.#previewHTML = "";
    this.render();

    const enabledScrapers = this.#scrapers.filter((s) => s.isEnabled());
    const categoryMap = {
      all: undefined,
      monsters: "monsters",
      spells: "spells",
      items: "items",
    };

    try {
      const searches = enabledScrapers.map((s) =>
        s.search(this.#searchQuery, categoryMap[this.#category]).catch((err) => {
          console.warn(`${MODULE_ID} | Scraper ${s.constructor.id} failed:`, err);
          return [];
        })
      );

      const resultArrays = await Promise.all(searches);
      this.#results = resultArrays.flat();

      // Sort: exact matches first, then alphabetically
      const lowerQuery = this.#searchQuery.toLowerCase();
      this.#results.sort((a, b) => {
        const aExact = a.name.toLowerCase() === lowerQuery ? 0 : 1;
        const bExact = b.name.toLowerCase() === lowerQuery ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.name.localeCompare(b.name);
      });

      // Deduplicate by name+type (prefer open5e)
      const seen = new Set();
      this.#results = this.#results.filter((r) => {
        const key = `${r.name.toLowerCase()}::${r.type}`;
        if (seen.has(key) && r.source !== "open5e") return false;
        seen.add(key);
        return true;
      });
    } catch (err) {
      console.error(`${MODULE_ID} | Search failed:`, err);
      ui.notifications.error("Search failed. Check the console for details.");
    }

    this.#loading = false;
    this.render();
  }

  /* -------------------------------- Actions ------------------------------- */

  static async #onSearch(event, target) {
    const form = target.closest(".ci-search-bar");
    const input = form?.querySelector('input[name="query"]');
    const select = form?.querySelector('select[name="category"]');
    const query = input?.value ?? "";
    const category = select?.value ?? "all";
    await this.doSearch(query, category);
  }

  static async #onImport(event, target) {
    const index = parseInt(target.dataset.index);
    const importType = target.dataset.importType || this.#importType;
    const result = this.#results[index];
    if (!result) return;

    try {
      target.disabled = true;
      target.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

      const scraper = this.#scrapers.find((s) => s.constructor.id === result.source);
      const resolvedType = importType === "auto" ? this.#autoType(result) : importType;
      await importResult(result, resolvedType, scraper);
    } catch (err) {
      console.error(`${MODULE_ID} | Import failed:`, err);
      ui.notifications.error(game.i18n.format("COMPIMPORTER.ImportError", { error: err.message }));
    } finally {
      target.disabled = false;
      target.innerHTML = '<i class="fas fa-file-import"></i> Import';
    }
  }

  static #onPreview(event, target) {
    const index = parseInt(target.dataset.index);
    const result = this.#results[index];
    if (!result) return;

    this.#selectedResult = result;
    this.#previewHTML = generatePreview(result);
    this.render();
  }

  static #onClearPreview() {
    this.#selectedResult = null;
    this.#previewHTML = "";
    this.render();
  }

  static #onChangeCategory(event, target) {
    this.#category = target.value;
  }

  #autoType(result) {
    if (result.type === "monster") return "actor";
    return "item";
  }

  /* ------------------------------ Public API ------------------------------ */

  /**
   * Open the app and optionally run a search immediately.
   */
  static async openWithSearch(query, category) {
    const app = new ImporterApp();
    app.render(true);
    if (query) {
      // Small delay to ensure the app is rendered
      setTimeout(() => app.doSearch(query, category), 100);
    }
    return app;
  }
}
