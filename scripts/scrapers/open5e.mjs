import { BaseScraper } from "./base.mjs";

const API_BASE = "https://api.open5e.com/v1";

/**
 * Source tier classification.
 * "official" = WotC published material
 * "ua" = Unearthed Arcana, playtest, semi-official
 * "thirdparty" = Kobold Press, Critical Role, community content
 */
const SOURCE_TIERS = {
  "wotc-srd": "official",
  // Open5e only carries the WotC SRD. All other sources are third-party publishers.
  // If Open5e adds more WotC sources in the future, add them here.
};

/**
 * Get the tier for a document slug. Anything not explicitly listed is third-party.
 */
export function getSourceTier(documentSlug) {
  return SOURCE_TIERS[documentSlug] || "thirdparty";
}

/**
 * Get badge color for a source tier.
 */
export function getSourceBadgeColor(tier) {
  switch (tier) {
    case "official": return "#4CAF50";   // Green — WotC official
    case "ua": return "#FFC107";         // Yellow — Unearthed Arcana / playtest
    case "thirdparty": return "#F44336"; // Red — third-party / homebrew
    default: return "#F44336";
  }
}

export class Open5eScraper extends BaseScraper {
  static id = "open5e";
  static label = "Open5e";
  static color = "#4CAF50";
  static requiresProxy = false;

  isEnabled() {
    return game.settings.get("fvtt-compendium-importer", "enableOpen5e");
  }

  async search(query, category) {
    if (!this.isEnabled()) return [];

    const endpoints = this._getEndpoints(category);
    const results = [];

    // Check source filter setting
    let sourceFilter;
    try {
      sourceFilter = game.settings.get("fvtt-compendium-importer", "sourceFilter");
    } catch {
      sourceFilter = "all";
    }

    const fetches = endpoints.map(async (ep) => {
      try {
        let url = `${API_BASE}${ep.path}?search=${encodeURIComponent(query)}&limit=20`;
        // If filtering to SRD only, add document__slug filter
        if (sourceFilter === "srd") {
          url += `&document__slug=wotc-srd`;
        }
        const response = await fetch(url);
        if (!response.ok) return;
        const data = await response.json();
        if (!data.results) return;

        for (const item of data.results) {
          const mapped = this._mapResult(item, ep.type);
          // Client-side filter for non-SRD if needed
          if (sourceFilter === "srd" && mapped.documentSlug !== "wotc-srd") continue;
          results.push(mapped);
        }
      } catch (err) {
        console.warn(`Compendium Importer | Open5e search failed for ${ep.path}:`, err);
      }
    });

    await Promise.all(fetches);
    return results;
  }

  async fetchDetails(result) {
    const epMap = {
      monster: "/monsters/",
      spell: "/spells/",
      magicitem: "/magicitems/",
      weapon: "/weapons/",
      armor: "/armor/",
    };
    const path = epMap[result.type] || "/monsters/";
    const url = `${API_BASE}${path}${encodeURIComponent(result.slug)}/`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open5e returned ${response.status}`);
    return response.json();
  }

  _getEndpoints(category) {
    const all = [
      { path: "/monsters/", type: "monster" },
      { path: "/spells/", type: "spell" },
      { path: "/magicitems/", type: "magicitem" },
      { path: "/weapons/", type: "weapon" },
      { path: "/armor/", type: "armor" },
    ];
    if (category === "monsters") return [all[0]];
    if (category === "spells") return [all[1]];
    if (category === "items") return all.slice(2);
    return all;
  }

  _mapResult(item, type) {
    const base = {
      name: item.name,
      slug: item.slug,
      type,
      source: Open5eScraper.id,
      sourceLabel: Open5eScraper.label,
      sourceColor: Open5eScraper.color,
      documentTitle: item.document__title ?? "",
      documentSlug: item.document__slug ?? "",
      sourceTier: getSourceTier(item.document__slug ?? ""),
      sourceBadgeColor: getSourceBadgeColor(getSourceTier(item.document__slug ?? "")),
      _raw: item,
    };

    if (type === "monster") {
      base.cr = String(item.challenge_rating ?? "");
      base.type_display = `${item.size ?? ""} ${item.type ?? ""}`.trim();
      base.url = `${API_BASE}/monsters/${item.slug}/`;
    } else if (type === "spell") {
      base.level = item.level_int != null ? String(item.level_int) : item.level;
      base.school = item.school ?? "";
      base.url = `${API_BASE}/spells/${item.slug}/`;
    } else {
      base.rarity = item.rarity ?? "";
      base.url = `${API_BASE}/${type === "magicitem" ? "magicitems" : type + "s"}/${item.slug}/`;
    }

    return base;
  }
}
