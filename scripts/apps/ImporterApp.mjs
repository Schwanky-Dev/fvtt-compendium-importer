/**
 * Compendium Importer — Simplified one-click import UI.
 * Search → Results with import buttons. That's it.
 */

import { Open5eScraper } from "../scrapers/open5e.mjs";
import { DDBScraper } from "../scrapers/ddb.mjs";
import { Roll20Scraper } from "../scrapers/roll20.mjs";
import { WikidotScraper } from "../scrapers/wikidot.mjs";
import { AideDDScraper } from "../scrapers/aidedd.mjs";
import { importResult, generatePreview } from "../importer.mjs";

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
      previewResult: ImporterApp.#onPreview,
      closePreview: ImporterApp.#onClosePreview,
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
  #previewHtml = "";
  #previewIndex = -1;
  #searchPass = "standard";
  #exactMatch = false;
  #filterText = "";

  /** Search pass definitions: which scraper IDs are included in each pass */
  static SEARCH_PASSES = {
    quick: null, // uses primarySource setting
    standard: new Set(["open5e", "aidedd", "roll20"]),
    deep: null,  // all enabled
  };

  constructor(options = {}) {
    super(options);
    this.#scrapers = [new Open5eScraper(), new AideDDScraper(), new WikidotScraper(), new DDBScraper(), new Roll20Scraper()];
    try {
      this.#searchPass = game.settings.get("fvtt-compendium-importer", "defaultSearchPass");
    } catch { /* use default */ }
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

    // Search pass buttons
    for (const btn of this.element.querySelectorAll(".ci-pass-btn")) {
      btn.addEventListener("click", (ev) => {
        this.#searchPass = ev.currentTarget.dataset.pass;
        this.render();
      });
    }

    // Exact match toggle
    const exactToggle = this.element.querySelector('input[name="exactMatch"]');
    if (exactToggle) {
      exactToggle.addEventListener("change", (ev) => {
        this.#exactMatch = ev.currentTarget.checked;
        this.render();
      });
    }

    // Result filter input
    const filterInput = this.element.querySelector('input[name="resultFilter"]');
    if (filterInput) {
      filterInput.addEventListener("input", (ev) => {
        this.#filterText = ev.currentTarget.value.toLowerCase();
        // Client-side filter: show/hide rows
        const rows = this.element.querySelectorAll(".ci-row");
        for (const row of rows) {
          const name = row.querySelector(".ci-name")?.textContent?.toLowerCase() || "";
          row.style.display = name.includes(this.#filterText) ? "" : "none";
        }
      });
    }
  }

  async _prepareContext() {
    // Apply exact match filter
    let displayResults = this.#results;
    if (this.#exactMatch && this.#searchQuery) {
      const lq = this.#searchQuery.toLowerCase();
      displayResults = displayResults.filter((r) => r.name.toLowerCase() === lq);
    }

    return {
      results: displayResults.map((r, i) => ({
        ...r,
        index: i,
        importing: this.#importing.has(i),
        typeBadge: this.#typeBadge(r),
        metaInfo: this.#metaInfo(r),
        bookBadge: r.documentTitle || "",
        sourceBadgeColor: r.sourceBadgeColor || this.#getSourceBadgeColor(r),
      })),
      loading: this.#loading,
      searchQuery: this.#searchQuery,
      hasResults: displayResults.length > 0,
      noResults: !this.#loading && this.#searchQuery && displayResults.length === 0,
      previewHtml: this.#previewHtml,
      searchPass: this.#searchPass,
      exactMatch: this.#exactMatch,
      filterText: this.#filterText,
    };
  }

  /**
   * Source-aware badge color. Overrides the per-result sourceBadgeColor
   * for sources that are always official/third-party.
   */
  #getSourceBadgeColor(result) {
    // Source-level overrides
    switch (result.source) {
      case "roll20": return "#4CAF50";   // GREEN — official SRD
      case "ddb": return "#4CAF50";      // GREEN — official
      case "aidedd": return "#4CAF50";   // GREEN — official SRD
      case "wikidot": return "#FFC107";  // YELLOW — SRD reference
      case "open5e": {
        // Open5e: green for WotC SRD, red for third-party
        const slug = result.documentSlug || "";
        if (slug === "wotc-srd" || (result.documentTitle || "").includes("5e Core Rules")) {
          return "#4CAF50";
        }
        return "#F44336";
      }
      default: return "#F44336";
    }
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
    this.#previewHtml = "";
    this.#previewIndex = -1;
    this.render();

    const enabledScrapers = this.#scrapers.filter((s) => {
      if (!s.isEnabled()) return false;
      const pass = this.#searchPass;
      if (pass === "deep") return true;
      if (pass === "quick") {
        // Only the primary source (default: open5e)
        let primary;
        try { primary = game.settings.get("fvtt-compendium-importer", "primarySource"); } catch { primary = "open5e"; }
        return s.constructor.id === primary;
      }
      // standard
      const stdSet = ImporterApp.SEARCH_PASSES.standard;
      return stdSet.has(s.constructor.id);
    });

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

      // Deduplicate by name+type+source (keep one per source)
      const seen = new Set();
      this.#results = this.#results.filter((r) => {
        const key = `${r.name.toLowerCase()}::${r.type}::${r.source}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      // Assign source tiers for sources that don't set them
      for (const r of this.#results) {
        if (!r.sourceTier) {
          switch (r.source) {
            case "roll20": r.sourceTier = "official"; break;
            case "ddb": r.sourceTier = "official"; break;
            case "aidedd": r.sourceTier = "official"; break;
            case "wikidot": r.sourceTier = "ua"; break;
            default: r.sourceTier = "thirdparty"; break;
          }
        }
        r.sourceBadgeColor = this.#getSourceBadgeColor(r);
      }

      // Apply source filter
      const sourceFilter = game.settings.get(MODULE_ID, "sourceFilter");
      if (sourceFilter === "official") {
        this.#results = this.#results.filter((r) => r.sourceTier === "official");
      } else if (sourceFilter === "official+ua") {
        this.#results = this.#results.filter((r) => r.sourceTier === "official" || r.sourceTier === "ua");
      }
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

  static #onPreview(event, target) {
    // Don't trigger preview if clicking the import button
    if (event.target.closest('[data-action="importResult"]')) return;
    const index = parseInt(target.dataset.index);
    const result = this.#results[index];
    if (!result) return;
    if (this.#previewIndex === index) {
      // Toggle off
      this.#previewHtml = "";
      this.#previewIndex = -1;
    } else {
      this.#previewHtml = generatePreview(result);
      this.#previewIndex = index;
    }
    this.render();
  }

  static #onClosePreview() {
    this.#previewHtml = "";
    this.#previewIndex = -1;
    this.render();
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
