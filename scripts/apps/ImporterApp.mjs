/**
 * Compendium Importer — Simplified one-click import UI.
 * Search → Results with import buttons. That's it.
 */

import { Open5eScraper } from "../scrapers/open5e.mjs";
import { DDBScraper } from "../scrapers/ddb.mjs";
import { Roll20Scraper } from "../scrapers/roll20.mjs";
import { WikidotScraper } from "../scrapers/wikidot.mjs";
import { importResult } from "../importer.mjs";

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
      width: 620,
      height: 500,
    },
    classes: ["compendium-importer-app"],
    actions: {
      search: ImporterApp.#onSearch,
      importResult: ImporterApp.#onImport,
    },
  };

  static PARTS = {
    main: {
      template: `modules/${MODULE_ID}/templates/importer.hbs`,
    },
  };

  #scrapers = [];
  #results = [];
  #loading = false;
  #searchQuery = "";
  /** @type {Set<number>} indices currently importing */
  #importing = new Set();

  constructor(options = {}) {
    super(options);
    this.#scrapers = [new Open5eScraper(), new WikidotScraper(), new DDBScraper(), new Roll20Scraper()];
  }

  _onRender(context, options) {
    // Attach Enter key handler to search input
    const input = this.element.querySelector('input[name="query"]');
    if (input) {
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          this.doSearch(input.value);
        }
      });
      // Re-focus and set cursor to end after re-render
      if (this.#searchQuery) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }

  async _prepareContext() {
    return {
      results: this.#results.map((r, i) => ({
        ...r,
        index: i,
        importing: this.#importing.has(i),
        typeBadge: this.#typeBadge(r),
        metaInfo: this.#metaInfo(r),
      })),
      loading: this.#loading,
      searchQuery: this.#searchQuery,
      hasResults: this.#results.length > 0,
      noResults: !this.#loading && this.#searchQuery && this.#results.length === 0,
    };
  }

  #typeBadge(result) {
    switch (result.type) {
      case "monster": return "Monster";
      case "spell": return "Spell";
      case "weapon": return "Weapon";
      case "armor": return "Armor";
      case "magicitem": return "Magic Item";
      default: return "Item";
    }
  }

  #metaInfo(result) {
    const parts = [];
    if (result.type === "monster" && result.cr) parts.push(`CR ${result.cr}`);
    if (result.type === "spell" && result.level) parts.push(`Lvl ${result.level}`);
    if (result.type === "spell" && result.school) parts.push(result.school);
    if (result.rarity) parts.push(result.rarity);
    return parts.join(" · ");
  }

  #autoType(result) {
    return result.type === "monster" ? "actor" : "item";
  }

  async doSearch(query) {
    if (!query?.trim()) return;

    this.#searchQuery = query.trim();
    this.#loading = true;
    this.#results = [];
    this.#importing.clear();
    this.render();

    const enabledScrapers = this.#scrapers.filter((s) => s.isEnabled());

    try {
      const searches = enabledScrapers.map((s) =>
        s.search(this.#searchQuery).catch((err) => {
          console.warn(`${MODULE_ID} | Scraper ${s.constructor.id} failed:`, err);
          return [];
        })
      );

      const resultArrays = await Promise.all(searches);
      this.#results = resultArrays.flat();

      // Sort: exact matches first, then alphabetical
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
    // Handle both button click and Enter key on input
    const container = this.element.querySelector(".ci-search-bar");
    const input = container?.querySelector('input[name="query"]');
    const query = input?.value ?? "";
    await this.doSearch(query);
  }

  static async #onImport(event, target) {
    const index = parseInt(target.dataset.index);
    const result = this.#results[index];
    if (!result) return;

    this.#importing.add(index);
    this.render();

    try {
      const scraper = this.#scrapers.find((s) => s.constructor.id === result.source);
      const resolvedType = this.#autoType(result);
      const doc = await importResult(result, resolvedType, scraper);

      // Toast with link to open the document
      const typeName = resolvedType === "actor" ? "Actor" : "Item";
      ui.notifications.info(
        `Imported <strong>${doc.name}</strong> as ${typeName}. <a onclick="game.${resolvedType === 'actor' ? 'actors' : 'items'}.get('${doc.id}')?.sheet?.render(true)">Open</a>`,
        { permanent: false }
      );
    } catch (err) {
      console.error(`${MODULE_ID} | Import failed:`, err);
      ui.notifications.error(`Import failed: ${err.message}`);
    } finally {
      this.#importing.delete(index);
      this.render();
    }
  }

  /* ------------------------------ Public API ------------------------------ */

  static async openWithSearch(query) {
    const app = new ImporterApp();
    app.render(true);
    if (query) {
      setTimeout(() => app.doSearch(query), 100);
    }
    return app;
  }
}
