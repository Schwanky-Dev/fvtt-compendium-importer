import { BaseScraper } from "./base.mjs";

const AIDEDD_BASE = "https://www.aidedd.org/dnd";

/**
 * AideDD scraper — excellent parseable HTML for monsters and spells.
 * Requires CORS proxy since aidedd.org doesn't serve CORS headers.
 */
export class AideDDScraper extends BaseScraper {
  static id = "aidedd";
  static label = "AideDD";
  static color = "#922610";
  static requiresProxy = true;

  isEnabled() {
    return game.settings.get("fvtt-compendium-importer", "enableAidedd");
  }

  /**
   * Build a slug from a query: lowercase, spaces → hyphens.
   */
  _toSlug(query) {
    return query.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async search(query, category) {
    if (!this.isEnabled()) return [];

    const slug = this._toSlug(query);
    const results = [];
    const endpoints = [];

    if (category !== "spells" && category !== "items") {
      endpoints.push({ url: `${AIDEDD_BASE}/monstres.php?vo=${slug}`, type: "monster" });
    }
    if (category !== "monsters" && category !== "items") {
      endpoints.push({ url: `${AIDEDD_BASE}/sorts.php?vo=${slug}`, type: "spell" });
    }

    const fetches = endpoints.map(async (ep) => {
      try {
        const response = await this.proxyFetch(ep.url);
        if (!response.ok) return;
        const html = await response.text();
        const parsed = ep.type === "monster"
          ? this._parseMonster(html, slug, ep.url)
          : this._parseSpell(html, slug, ep.url);
        if (parsed) results.push(parsed);
      } catch (err) {
        console.warn(`Compendium Importer | AideDD fetch failed for ${ep.url}:`, err.message);
      }
    });

    await Promise.all(fetches);
    return results;
  }

  async fetchDetails(result) {
    if (result._raw && Object.keys(result._raw).length > 5) return result._raw;
    const response = await this.proxyFetch(result.url);
    if (!response.ok) throw new Error(`AideDD returned ${response.status}`);
    const html = await response.text();
    if (result.type === "monster") {
      const parsed = this._parseMonster(html, result.slug, result.url);
      return parsed?._raw ?? result._raw;
    } else {
      const parsed = this._parseSpell(html, result.slug, result.url);
      return parsed?._raw ?? result._raw;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Monster parsing                                                    */
  /* ------------------------------------------------------------------ */

  _parseMonster(html, slug, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const h1 = doc.querySelector("h1");
    const name = h1?.textContent?.trim();
    if (!name) return null;

    // Type line: "Medium humanoid (any race), any alignment"
    const typeDiv = doc.querySelector(".type");
    const typeText = typeDiv?.textContent?.trim() || "";
    const typeMatch = typeText.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(.+?)(?:,\s*(.+))?$/i);

    const data = {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      source: "aidedd",
    };

    if (typeMatch) {
      data.size = typeMatch[1];
      data.type = typeMatch[2];
      data.alignment = (typeMatch[3] || "").trim();
    }

    // Stats from div.red
    const redDiv = doc.querySelector(".red");
    const redText = redDiv ? redDiv.innerHTML : "";

    // AC
    const acMatch = redText.match(/Armor\s*Class<\/strong>\s*(\d+)\s*(?:\(([^<)]+)\))?/i);
    if (acMatch) {
      data.armor_class = parseInt(acMatch[1]);
      data.armor_desc = acMatch[2]?.trim() || "";
    }

    // HP
    const hpMatch = redText.match(/Hit\s*Points<\/strong>\s*(\d+)\s*(?:\(([^<)]+)\))?/i);
    if (hpMatch) {
      data.hit_points = parseInt(hpMatch[1]);
      data.hit_dice = hpMatch[2]?.trim() || "";
    }

    // Speed
    const speedMatch = redText.match(/Speed<\/strong>\s*([^<]+)/i);
    if (speedMatch) {
      data.speed = this._parseSpeedString(speedMatch[1].trim());
    }

    // Abilities from div.carac
    const caracs = doc.querySelectorAll(".carac");
    const abilityNames = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
    caracs.forEach((el, i) => {
      if (i < 6) {
        const numMatch = el.textContent.match(/(\d+)\s*\(/);
        if (numMatch) data[abilityNames[i]] = parseInt(numMatch[1]);
      }
    });

    // Properties from strong labels in red div
    const fullText = doc.body?.innerHTML || html;

    // Saving Throws
    const savesMatch = fullText.match(/Saving\s*Throws<\/strong>\s*([^<]+)/i);
    if (savesMatch) {
      const saveMap = { str: "strength_save", dex: "dexterity_save", con: "constitution_save",
                        int: "intelligence_save", wis: "wisdom_save", cha: "charisma_save" };
      for (const [abbr, field] of Object.entries(saveMap)) {
        const m = savesMatch[1].match(new RegExp(`${abbr}\\s*\\+(\\d+)`, "i"));
        if (m) data[field] = parseInt(m[1]);
      }
    }

    // Skills
    const skillsMatch = fullText.match(/Skills<\/strong>\s*([^<]+)/i);
    if (skillsMatch) {
      data.skills = {};
      const skillPattern = /([A-Za-z ]+?)\s*\+(\d+)/g;
      let sm;
      while ((sm = skillPattern.exec(skillsMatch[1])) !== null) {
        data.skills[sm[1].trim().toLowerCase()] = parseInt(sm[2]);
      }
    }

    // Damage fields
    const drMatch = fullText.match(/Damage\s*Resistances?<\/strong>\s*([^<]+)/i);
    if (drMatch) data.damage_resistances = drMatch[1].trim().toLowerCase();

    const diMatch = fullText.match(/Damage\s*Immunities<\/strong>\s*([^<]+)/i);
    if (diMatch) data.damage_immunities = diMatch[1].trim().toLowerCase();

    const dvMatch = fullText.match(/Damage\s*Vulnerabilities<\/strong>\s*([^<]+)/i);
    if (dvMatch) data.damage_vulnerabilities = dvMatch[1].trim().toLowerCase();

    const ciMatch = fullText.match(/Condition\s*Immunities<\/strong>\s*([^<]+)/i);
    if (ciMatch) data.condition_immunities = ciMatch[1].trim().toLowerCase();

    // Senses, Languages, Challenge
    const sensesMatch = fullText.match(/Senses<\/strong>\s*([^<]+)/i);
    if (sensesMatch) data.senses = sensesMatch[1].trim();

    const langMatch = fullText.match(/Languages<\/strong>\s*([^<]+)/i);
    if (langMatch) data.languages = langMatch[1].trim();

    const crMatch = fullText.match(/Challenge<\/strong>\s*([\d/]+)/i);
    if (crMatch) data.challenge_rating = crMatch[1];

    // Source
    const sourceDiv = doc.querySelector(".source");
    if (sourceDiv) data.document__title = sourceDiv.textContent.trim();

    // Traits and actions
    data.special_abilities = this._parseSectionEntries(doc, null, "Actions");
    data.actions = this._parseSectionAfterRub(doc, "Actions");
    data.reactions = this._parseSectionAfterRub(doc, "Reactions");
    data.legendary_actions = this._parseSectionAfterRub(doc, "Legendary Actions");

    // Build search result
    return {
      name,
      slug: data.slug,
      type: "monster",
      source: AideDDScraper.id,
      sourceLabel: AideDDScraper.label,
      sourceColor: AideDDScraper.color,
      sourceTier: "official",
      sourceBadgeColor: "#4CAF50",
      url,
      cr: data.challenge_rating || "",
      type_display: `${data.size || ""} ${data.type || ""}`.trim(),
      documentTitle: data.document__title || "AideDD",
      _raw: data,
    };
  }

  /**
   * Parse entries (traits) before the first "rub" div (Actions heading).
   */
  _parseSectionEntries(doc, afterSection, beforeSection) {
    const entries = [];
    const paragraphs = doc.querySelectorAll("p");
    let inSection = afterSection === null; // if null, start from beginning

    for (const p of paragraphs) {
      // Check if we've hit a rub div before this paragraph
      const prevSib = p.previousElementSibling;
      if (prevSib?.classList?.contains("rub")) {
        const rubText = prevSib.textContent.trim();
        if (afterSection && rubText === afterSection) {
          inSection = true;
          continue;
        }
        if (beforeSection && rubText === beforeSection) break;
        if (inSection) break; // Hit next section
      }

      if (!inSection) continue;

      const strong = p.querySelector("strong");
      const em = p.querySelector("em");
      if (strong && em) {
        const name = (strong.textContent || em.textContent).trim().replace(/\.\s*$/, "");
        const desc = p.textContent.replace(name, "").replace(/^\.\s*/, "").trim();
        if (name && name.length < 100) entries.push({ name, desc });
      }
    }
    return entries.length ? entries : undefined;
  }

  /**
   * Parse entries after a specific div.rub heading.
   */
  _parseSectionAfterRub(doc, sectionName) {
    const entries = [];
    const rubs = doc.querySelectorAll(".rub");
    let targetRub = null;

    for (const rub of rubs) {
      if (rub.textContent.trim() === sectionName) {
        targetRub = rub;
        break;
      }
    }
    if (!targetRub) return undefined;

    let el = targetRub.nextElementSibling;
    while (el) {
      if (el.classList?.contains("rub")) break; // Next section
      if (el.tagName === "P") {
        const strong = el.querySelector("strong");
        if (strong) {
          const name = strong.textContent.trim().replace(/\.\s*$/, "");
          const desc = el.textContent.replace(strong.textContent, "").replace(/^\.\s*/, "").trim();
          if (name && name.length < 100) entries.push({ name, desc });
        }
      }
      el = el.nextElementSibling;
    }
    return entries.length ? entries : undefined;
  }

  /* ------------------------------------------------------------------ */
  /*  Spell parsing                                                      */
  /* ------------------------------------------------------------------ */

  _parseSpell(html, slug, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const h1 = doc.querySelector("h1");
    const name = h1?.textContent?.trim();
    if (!name) return null;

    const text = doc.body?.textContent || "";

    const data = {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      source: "aidedd",
    };

    // Level and school
    const levelSchoolMatch = text.match(/(\d+)\w*-level\s+(\w+)/i);
    const cantripMatch = text.match(/(\w+)\s+cantrip/i);
    if (levelSchoolMatch) {
      data.level_int = parseInt(levelSchoolMatch[1]);
      data.level = levelSchoolMatch[1];
      data.school = levelSchoolMatch[2];
    } else if (cantripMatch) {
      data.level_int = 0;
      data.level = "Cantrip";
      data.school = cantripMatch[1];
    }

    // Casting time, Range, Components, Duration
    const ctMatch = text.match(/Casting\s*Time[:\s]+(.+?)(?:\n|$)/i);
    if (ctMatch) data.casting_time = ctMatch[1].trim();

    const rangeMatch = text.match(/Range[:\s]+(.+?)(?:\n|$)/i);
    if (rangeMatch) data.range = rangeMatch[1].trim();

    const compMatch = text.match(/Components?[:\s]+(.+?)(?:\n|$)/i);
    if (compMatch) {
      const compStr = compMatch[1].trim();
      data.requires_verbal_components = compStr.includes("V");
      data.requires_somatic_components = compStr.includes("S");
      data.requires_material_components = compStr.includes("M");
      const matMatch = compStr.match(/M\s*\(([^)]+)\)/);
      if (matMatch) data.material = matMatch[1];
    }

    const durMatch = text.match(/Duration[:\s]+(.+?)(?:\n|$)/i);
    if (durMatch) {
      data.duration = durMatch[1].trim();
      data.concentration = data.duration.toLowerCase().includes("concentration") ? "yes" : "no";
    }

    data.can_be_cast_as_ritual = /ritual/i.test(text);

    // Description
    const paragraphs = doc.querySelectorAll("p");
    const descParts = [];
    let foundDesc = false;
    for (const p of paragraphs) {
      const t = p.textContent.trim();
      if (!foundDesc) {
        if (/^(casting time|range|components?|duration)/i.test(t)) continue;
        if (/^\d+\w*-level|cantrip/i.test(t)) continue;
        foundDesc = true;
      }
      if (foundDesc && t) {
        if (/^At Higher Levels/i.test(t)) {
          data.higher_level = t.replace(/^At Higher Levels\.?\s*/i, "");
        } else {
          descParts.push(t);
        }
      }
    }
    data.desc = descParts.join("\n\n");

    // Source
    const sourceDiv = doc.querySelector(".source");
    if (sourceDiv) data.document__title = sourceDiv.textContent.trim();

    return {
      name,
      slug: data.slug,
      type: "spell",
      source: AideDDScraper.id,
      sourceLabel: AideDDScraper.label,
      sourceColor: AideDDScraper.color,
      sourceTier: "official",
      sourceBadgeColor: "#4CAF50",
      url,
      level: data.level_int != null ? String(data.level_int) : data.level,
      school: data.school || "",
      documentTitle: data.document__title || "AideDD",
      _raw: data,
    };
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  _parseSpeedString(str) {
    const result = {};
    const walkMatch = str.match(/^(\d+)\s*ft/);
    if (walkMatch) result.walk = parseInt(walkMatch[1]);
    for (const type of ["fly", "swim", "climb", "burrow"]) {
      const m = str.match(new RegExp(`${type}\\s+(\\d+)`, "i"));
      if (m) result[type] = parseInt(m[1]);
    }
    if (str.toLowerCase().includes("hover")) result.hover = true;
    return result;
  }
}
