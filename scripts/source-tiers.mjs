/**
 * Content-aware source tier classification.
 *
 * Tiers:
 *   "official"   — WotC 2014 content (GREEN #4CAF50)
 *   "2024"       — WotC 2024 revised content (BLUE #2196F3)
 *   "ua"         — Unearthed Arcana / playtest (YELLOW #FFC107)
 *   "thirdparty" — Third-party / homebrew (RED #F44336)
 */

/* ------------------------------------------------------------------ */
/*  Badge colors                                                       */
/* ------------------------------------------------------------------ */

const TIER_COLORS = {
  official: "#4CAF50",   // Green — WotC 2014
  "2024": "#2196F3",     // Blue — WotC 2024
  ua: "#FFC107",         // Yellow — playtest
  thirdparty: "#F44336", // Red — third-party
};

export function getTierColor(tier) {
  return TIER_COLORS[tier] || TIER_COLORS.thirdparty;
}

/* ------------------------------------------------------------------ */
/*  Known source book classification                                   */
/* ------------------------------------------------------------------ */

/**
 * Canonical WotC 2014 source books.
 * Matched case-insensitively against document titles and source fields.
 */
const OFFICIAL_2014 = [
  "srd", "srd 5.1", "5th edition srd", "systems reference document",
  "monster manual", "player's handbook", "player's handbook",
  "dungeon master's guide", "dungeon master's guide",
  "volo's guide to monsters", "volo's guide",
  "mordenkainen's tome of foes", "mordenkainen's tome",
  "xanathar's guide to everything", "xanathar's guide",
  "tasha's cauldron of everything", "tasha's cauldron",
  "fizban's treasury of dragons", "fizban's treasury",
  "van richten's guide to ravenloft", "van richten's guide",
  "sword coast adventurer's guide", "sword coast",
  "curse of strahd", "tomb of annihilation", "storm king's thunder",
  "waterdeep: dragon heist", "waterdeep: dungeon of the mad mage",
  "out of the abyss", "princes of the apocalypse",
  "hoard of the dragon queen", "rise of tiamat",
  "tales from the yawning portal", "ghosts of saltmarsh",
  "descent into avernus", "rime of the frostmaiden",
  "candlekeep mysteries", "wild beyond the witchlight",
  "strixhaven", "spelljammer", "dragonlance",
  "monsters of the multiverse", "mordenkainen presents",
  "guild masters' guide to ravnica", "mythic odysseys of theros",
  "explorer's guide to wildemount",
  "eberron: rising from the last war",
  "acquisitions incorporated",
  "elemental evil",
  "basic rules",
  "5e core rules",
  // Open5e document slugs
  "wotc-srd",
];

/**
 * WotC 2024 revised content identifiers.
 */
const OFFICIAL_2024 = [
  "2024 player's handbook", "2024 phb", "phb 2024",
  "2024 monster manual", "2024 mm", "mm 2024",
  "2024 dungeon master's guide", "2024 dmg", "dmg 2024",
  "player's handbook (2024)", "monster manual (2024)", "dungeon master's guide (2024)",
  "free rules (2024)", "2024 free rules", "srd 5.2",
  // DDB 2024 indicators
  "revised",
];

/**
 * Unearthed Arcana / playtest identifiers.
 */
const UA_PATTERNS = [
  "unearthed arcana", "playtest", "ua:", "ua ",
];

/**
 * Known third-party publisher identifiers.
 */
const THIRD_PARTY_PATTERNS = [
  "kobold press", "tome of beasts", "creature codex",
  "deep magic", "midgard", "tal'dorei",
  "critical role", "mcdm", "nord games",
  "frog god", "en publishing", "green ronin",
  "third party", "homebrew",
];

/* ------------------------------------------------------------------ */
/*  Tier detection                                                     */
/* ------------------------------------------------------------------ */

/**
 * Classify a source title string into a tier.
 * @param {string} sourceTitle - The source book title / document title
 * @returns {"official"|"2024"|"ua"|"thirdparty"}
 */
export function classifySource(sourceTitle) {
  if (!sourceTitle) return "thirdparty";
  const lower = sourceTitle.toLowerCase().trim();

  // Check 2024 first (more specific)
  for (const pattern of OFFICIAL_2024) {
    if (lower.includes(pattern)) return "2024";
  }

  // Check UA
  for (const pattern of UA_PATTERNS) {
    if (lower.includes(pattern)) return "ua";
  }

  // Check third-party
  for (const pattern of THIRD_PARTY_PATTERNS) {
    if (lower.includes(pattern)) return "thirdparty";
  }

  // Check 2014 official
  for (const pattern of OFFICIAL_2014) {
    if (lower.includes(pattern) || lower === pattern) return "official";
  }

  // Unknown — default to thirdparty
  return "thirdparty";
}

/**
 * Classify from an Open5e document slug.
 * @param {string} slug - e.g. "wotc-srd", "tob", "cc"
 * @returns {"official"|"2024"|"ua"|"thirdparty"}
 */
export function classifyBySlug(slug) {
  if (!slug) return "thirdparty";
  const lower = slug.toLowerCase();

  // Known WotC slugs on Open5e
  const officialSlugs = new Set([
    "wotc-srd", "o5e", // Open5e's own SRD copy
  ]);

  if (officialSlugs.has(lower)) return "official";

  // Everything else on Open5e is third-party (Kobold Press, etc.)
  return "thirdparty";
}

/**
 * Classify a DDB result by URL path.
 * DDB 2024 content often has different URL patterns or higher source IDs.
 * @param {string} url - Full DDB URL
 * @param {string} [name] - Entry name (for heuristics)
 * @returns {"official"|"2024"|"thirdparty"}
 */
export function classifyDDB(url, name) {
  if (!url) return "official"; // DDB is all WotC

  const lower = url.toLowerCase();

  // 2024 content indicators in URL
  if (lower.includes("/sources/2024") || lower.includes("-2024")) return "2024";

  // DDB source IDs: 2024 content has sourceId >= 145 in some URL patterns
  // But this is fragile — default to official (2014) for now
  return "official";
}

/* ------------------------------------------------------------------ */
/*  Unified result tier assignment                                     */
/* ------------------------------------------------------------------ */

/**
 * Assign sourceTier, sourceBadgeColor, and documentTitle to a search result.
 * Call this on every result after scraping.
 * @param {object} result - SearchResult object (mutated in place)
 */
export function assignTier(result) {
  // Determine the content source title
  let contentSource = result.documentTitle || "";

  switch (result.source) {
    case "open5e": {
      // Use slug-based classification, fall back to title
      const slugTier = classifyBySlug(result.documentSlug);
      if (slugTier !== "thirdparty") {
        result.sourceTier = slugTier;
      } else {
        result.sourceTier = classifySource(result.documentTitle || result.documentSlug || "");
      }
      break;
    }

    case "roll20": {
      // Roll20 data.Source field (set by normalizer or scraper)
      contentSource = result.documentTitle || result._raw?.data?.Source || result._raw?.Source || "5th Edition SRD";
      result.documentTitle = contentSource;
      result.sourceTier = classifySource(contentSource);
      break;
    }

    case "ddb": {
      result.sourceTier = classifyDDB(result.url, result.name);
      if (!result.documentTitle) result.documentTitle = "D&D Beyond";
      break;
    }

    case "aidedd": {
      contentSource = result.documentTitle || "";
      result.sourceTier = classifySource(contentSource);
      // AideDD is primarily SRD content
      if (result.sourceTier === "thirdparty" && contentSource) {
        result.sourceTier = "official";
      }
      break;
    }

    case "wikidot": {
      // Wikidot is SRD reference
      result.sourceTier = "official";
      if (!result.documentTitle) result.documentTitle = "SRD 5.1";
      break;
    }

    default:
      result.sourceTier = classifySource(contentSource);
  }

  result.sourceBadgeColor = getTierColor(result.sourceTier);
}
