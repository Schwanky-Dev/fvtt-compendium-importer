import { BaseScraper } from "./base.mjs";

const WIKIDOT_BASE = "https://dnd5e.wikidot.com";

/**
 * dnd5e.wikidot.com scraper. Major SRD wiki with monsters, spells, and items.
 * Like DDB/Roll20, requires a CORS proxy for browser-side fetches.
 */
export class WikidotScraper extends BaseScraper {
  static id = "wikidot";
  static label = "Wikidot (SRD)";
  static color = "#1E88E5";
  static requiresProxy = true;

  isEnabled() {
    return game.settings.get("fvtt-compendium-importer", "enableWikidot");
  }

  /**
   * Wikidot has no search API — we fetch by slug directly.
   * Slug format: monster:goblin, spell:fireball, or just the name in the path.
   */
  async search(query, category) {
    if (!this.isEnabled()) return [];

    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const endpoints = this._getEndpoints(category, slug);
    const results = [];

    const fetches = endpoints.map(async (ep) => {
      try {
        const response = await fetch(ep.url, { mode: "cors" });
        if (!response.ok) return;

        const html = await response.text();
        const parsed = this._parseResult(html, ep.type, slug, ep.url);
        if (parsed) results.push(parsed);
      } catch (err) {
        console.debug(`Compendium Importer | Wikidot fetch failed (CORS expected):`, err.message);
      }
    });

    await Promise.all(fetches);
    return results;
  }

  async fetchDetails(result) {
    const url = result.url || `${WIKIDOT_BASE}/${result.slug}`;
    const response = await this.proxyFetch(url);
    if (!response.ok) throw new Error(`Wikidot returned ${response.status}`);
    const html = await response.text();
    return this._parseFullPage(html, result.type, result.slug);
  }

  _getEndpoints(category, slug) {
    const all = [
      { url: `${WIKIDOT_BASE}/monster:${slug}`, type: "monster" },
      { url: `${WIKIDOT_BASE}/spell:${slug}`, type: "spell" },
      { url: `${WIKIDOT_BASE}/wondrous-items:${slug}`, type: "magicitem" },
      { url: `${WIKIDOT_BASE}/weapon:${slug}`, type: "weapon" },
      { url: `${WIKIDOT_BASE}/armor:${slug}`, type: "armor" },
    ];
    if (category === "monsters") return [all[0]];
    if (category === "spells") return [all[1]];
    if (category === "items") return all.slice(2);
    return all;
  }

  /**
   * Parse a Wikidot page to extract a search result stub.
   */
  _parseResult(html, type, slug, url) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Wikidot uses #page-title for the entry name
    const titleEl = doc.querySelector("#page-title");
    const name = titleEl?.textContent?.trim();
    if (!name) return null;

    // Check we actually got a content page, not a "page doesn't exist" result
    const content = doc.querySelector("#page-content");
    if (!content || content.textContent.includes("This page doesn't exist")) return null;

    const result = {
      name,
      slug,
      type,
      source: WikidotScraper.id,
      sourceLabel: WikidotScraper.label,
      sourceColor: WikidotScraper.color,
      url,
      _raw: this._parseFullPage(html, type, slug),
    };

    // Extract quick metadata
    if (type === "monster") {
      result.cr = this._extractField(content, "Challenge") ?? "";
      const meta = content.querySelector("em")?.textContent ?? "";
      result.type_display = meta;
    } else if (type === "spell") {
      result.school = this._extractSchool(content);
      result.level = this._extractLevel(content);
    } else {
      result.rarity = this._extractField(content, "Rarity") ?? "";
    }

    return result;
  }

  /**
   * Parse a full Wikidot page into structured data for mappers.
   */
  _parseFullPage(html, type, slug) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const content = doc.querySelector("#page-content");
    const name = doc.querySelector("#page-title")?.textContent?.trim() ?? slug;

    if (!content) return { name, html: "", type, source: "wikidot" };

    if (type === "monster") return this._parseMonster(content, name);
    if (type === "spell") return this._parseSpell(content, name);
    return this._parseItem(content, name, type);
  }

  /**
   * Parse a monster stat block from Wikidot HTML.
   * Wikidot monster pages typically have the stat block as plain text with bold labels.
   */
  _parseMonster(content, name) {
    const text = content.textContent;

    const data = {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      source: "wikidot",
    };

    // Size/type/alignment — first <em> or <p> with pattern "Medium humanoid, neutral evil"
    const metaEl = content.querySelector("em");
    if (metaEl) {
      const meta = metaEl.textContent.trim();
      const sizeMatch = meta.match(/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(.+?)(?:,\s*(.+))?$/i);
      if (sizeMatch) {
        data.size = sizeMatch[1];
        data.type = sizeMatch[2];
        data.alignment = sizeMatch[3] ?? "";
      }
    }

    // AC
    const acMatch = text.match(/Armor\s*Class\s*(\d+)\s*(?:\(([^)]+)\))?/i);
    if (acMatch) {
      data.armor_class = parseInt(acMatch[1]);
      data.armor_desc = acMatch[2] ?? "";
    }

    // HP
    const hpMatch = text.match(/Hit\s*Points\s*(\d+)\s*(?:\(([^)]+)\))?/i);
    if (hpMatch) {
      data.hit_points = parseInt(hpMatch[1]);
      data.hit_dice = hpMatch[2] ?? "";
    }

    // Speed
    const speedMatch = text.match(/Speed\s+(.+?)(?:\n|$)/i);
    if (speedMatch) {
      data.speed = this._parseSpeedString(speedMatch[1].trim());
    }

    // Abilities
    const abilityNames = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
    const statLine = text.match(/STR\s+DEX\s+CON\s+INT\s+WIS\s+CHA[\s\S]*?(\d+)\s*\([^)]*\)\s*(\d+)\s*\([^)]*\)\s*(\d+)\s*\([^)]*\)\s*(\d+)\s*\([^)]*\)\s*(\d+)\s*\([^)]*\)\s*(\d+)/i);
    if (statLine) {
      for (let i = 0; i < 6; i++) {
        data[abilityNames[i]] = parseInt(statLine[i + 1]);
      }
    }

    // CR
    const crMatch = text.match(/Challenge\s+([\d/]+)\s*(?:\(([^)]+)\s*XP\))?/i);
    if (crMatch) {
      data.challenge_rating = crMatch[1];
    }

    // Senses
    data.senses = this._extractField(content, "Senses") ?? "";
    data.languages = this._extractField(content, "Languages") ?? "";
    data.damage_resistances = this._extractField(content, "Damage Resistances") ?? "";
    data.damage_immunities = this._extractField(content, "Damage Immunities") ?? "";
    data.damage_vulnerabilities = this._extractField(content, "Damage Vulnerabilities") ?? "";
    data.condition_immunities = this._extractField(content, "Condition Immunities") ?? "";

    // Saving throws
    const savesStr = this._extractField(content, "Saving Throws");
    if (savesStr) {
      const saveMap = { str: "strength_save", dex: "dexterity_save", con: "constitution_save",
                        int: "intelligence_save", wis: "wisdom_save", cha: "charisma_save" };
      for (const [abbr, field] of Object.entries(saveMap)) {
        const m = savesStr.match(new RegExp(`${abbr}\\s*\\+(\\d+)`, "i"));
        if (m) data[field] = parseInt(m[1]);
      }
    }

    // Skills
    const skillsStr = this._extractField(content, "Skills");
    if (skillsStr) {
      data.skills = {};
      const skillPattern = /([A-Za-z ]+?)\s*\+(\d+)/g;
      let sm;
      while ((sm = skillPattern.exec(skillsStr)) !== null) {
        data.skills[sm[1].trim().toLowerCase()] = parseInt(sm[2]);
      }
    }

    // Actions — parse bold-titled paragraphs after "Actions" heading
    data.actions = this._parseSectionEntries(content, "Actions");
    data.legendary_actions = this._parseSectionEntries(content, "Legendary Actions");
    data.reactions = this._parseSectionEntries(content, "Reactions");
    data.special_abilities = this._parseTraits(content);

    return data;
  }

  /**
   * Parse a spell page.
   */
  _parseSpell(content, name) {
    const text = content.textContent;

    const data = {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      source: "wikidot",
    };

    // Level and school — e.g. "3rd-level evocation" or "Evocation cantrip"
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

    // Casting time
    const ctMatch = text.match(/Casting\s*Time[:\s]+(.+?)(?:\n|$)/i);
    if (ctMatch) data.casting_time = ctMatch[1].trim();

    // Range
    const rangeMatch = text.match(/Range[:\s]+(.+?)(?:\n|$)/i);
    if (rangeMatch) data.range = rangeMatch[1].trim();

    // Components
    const compMatch = text.match(/Components?[:\s]+(.+?)(?:\n|$)/i);
    if (compMatch) {
      const compStr = compMatch[1].trim();
      data.requires_verbal_components = compStr.includes("V");
      data.requires_somatic_components = compStr.includes("S");
      data.requires_material_components = compStr.includes("M");
      const matMatch = compStr.match(/M\s*\(([^)]+)\)/);
      if (matMatch) data.material = matMatch[1];
    }

    // Duration
    const durMatch = text.match(/Duration[:\s]+(.+?)(?:\n|$)/i);
    if (durMatch) {
      data.duration = durMatch[1].trim();
      data.concentration = data.duration.toLowerCase().includes("concentration") ? "yes" : "no";
    }

    // Ritual
    data.can_be_cast_as_ritual = /ritual/i.test(text);

    // Description — everything after the header fields
    const paragraphs = content.querySelectorAll("p");
    const descParts = [];
    let foundDesc = false;
    for (const p of paragraphs) {
      const t = p.textContent.trim();
      if (!foundDesc) {
        // Skip header paragraphs
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

    return data;
  }

  /**
   * Parse an item page.
   */
  _parseItem(content, name, type) {
    const text = content.textContent;

    const data = {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      source: "wikidot",
      type: type === "weapon" ? "Weapon" : type === "armor" ? "Armor" : "Wondrous item",
    };

    // Rarity
    const rarityMatch = text.match(/(common|uncommon|rare|very rare|legendary|artifact)/i);
    if (rarityMatch) data.rarity = rarityMatch[1];

    // Attunement
    if (/requires attunement/i.test(text)) {
      data.requires_attunement = "requires attunement";
    }

    // For weapons
    if (type === "weapon") {
      const dmgMatch = text.match(/(\d+d\d+)\s+(\w+)/);
      if (dmgMatch) {
        data.damage_dice = dmgMatch[1];
        data.damage_type = dmgMatch[2];
      }
      const weightMatch = text.match(/([\d.]+)\s*lb/i);
      if (weightMatch) data.weight = weightMatch[1];
      const costMatch = text.match(/([\d,]+)\s*(gp|sp|cp)/i);
      if (costMatch) data.cost = `${costMatch[1]} ${costMatch[2]}`;
    }

    // For armor
    if (type === "armor") {
      const acMatch = text.match(/(?:AC|Armor Class)\s*(\d+)/i);
      if (acMatch) data.base_ac = parseInt(acMatch[1]);
      const weightMatch = text.match(/([\d.]+)\s*lb/i);
      if (weightMatch) data.weight = weightMatch[1];
    }

    // Description — grab all paragraph text
    const paragraphs = content.querySelectorAll("p");
    const descParts = [];
    for (const p of paragraphs) {
      const t = p.textContent.trim();
      if (t && !/^(Wondrous item|Weapon|Armor)/i.test(t)) {
        descParts.push(t);
      }
    }
    data.desc = descParts.join("\n\n");

    return data;
  }

  /* ---- Helpers ---- */

  _extractField(content, label) {
    // Try to find "Label value" in the text with bold labels
    const strongs = content.querySelectorAll("strong, b");
    for (const el of strongs) {
      if (el.textContent.trim().toLowerCase().startsWith(label.toLowerCase())) {
        // Get the text content after the bold element within the same parent
        const parent = el.parentElement;
        if (parent) {
          const full = parent.textContent;
          const idx = full.toLowerCase().indexOf(label.toLowerCase());
          if (idx !== -1) {
            return full.substring(idx + label.length).replace(/^\s*[:.]?\s*/, "").trim();
          }
        }
      }
    }
    return null;
  }

  _extractSchool(content) {
    const text = content.textContent;
    const schools = ["Abjuration", "Conjuration", "Divination", "Enchantment",
                     "Evocation", "Illusion", "Necromancy", "Transmutation"];
    for (const s of schools) {
      if (text.includes(s) || text.includes(s.toLowerCase())) return s;
    }
    return "";
  }

  _extractLevel(content) {
    const text = content.textContent;
    const m = text.match(/(\d+)\w*-level/i);
    if (m) return m[1];
    if (/cantrip/i.test(text)) return "0";
    return "";
  }

  _parseSpeedString(str) {
    const result = {};
    // "30 ft., fly 60 ft., swim 30 ft."
    const walkMatch = str.match(/^(\d+)\s*ft/);
    if (walkMatch) result.walk = parseInt(walkMatch[1]);

    for (const type of ["fly", "swim", "climb", "burrow"]) {
      const m = str.match(new RegExp(`${type}\\s+(\\d+)`, "i"));
      if (m) result[type] = parseInt(m[1]);
    }
    if (str.toLowerCase().includes("hover")) result.hover = true;

    return result;
  }

  /**
   * Parse named entries (actions, legendary actions, etc.) from a section.
   */
  _parseSectionEntries(content, sectionName) {
    const entries = [];
    const headings = content.querySelectorAll("h3, h4, strong, b");
    let inSection = false;

    for (const el of headings) {
      const text = el.textContent.trim();

      if (text.toLowerCase().replace(/\s+/g, " ") === sectionName.toLowerCase()) {
        inSection = true;
        continue;
      }

      // If we hit another major section heading, stop
      if (inSection && (el.tagName === "H3" || el.tagName === "H4")) {
        const sectionNames = ["actions", "legendary actions", "reactions", "lair actions"];
        if (sectionNames.includes(text.toLowerCase())) break;
      }

      if (inSection && (el.tagName === "STRONG" || el.tagName === "B")) {
        const entryName = text.replace(/\.\s*$/, "");
        // Get description from following text
        const parent = el.parentElement;
        let desc = "";
        if (parent) {
          desc = parent.textContent.replace(text, "").trim();
        }
        if (entryName && entryName.length < 100) {
          entries.push({ name: entryName, desc });
        }
      }
    }

    return entries.length ? entries : undefined;
  }

  /**
   * Parse special abilities / traits (content between stat block header and "Actions").
   */
  _parseTraits(content) {
    const entries = [];
    const elements = content.querySelectorAll("p");
    let pastStats = false;
    let hitActions = false;

    for (const p of elements) {
      const text = p.textContent.trim();

      // Detect we're past the core stat lines
      if (/^Challenge\s/i.test(text)) {
        pastStats = true;
        continue;
      }
      if (/^Actions$/i.test(text)) {
        hitActions = true;
        break;
      }

      if (pastStats && !hitActions) {
        const strong = p.querySelector("strong, b, em strong, strong em");
        if (strong) {
          const name = strong.textContent.trim().replace(/\.\s*$/, "");
          const desc = text.replace(strong.textContent, "").trim();
          if (name && name.length < 100) {
            entries.push({ name, desc });
          }
        }
      }
    }

    return entries.length ? entries : undefined;
  }
}
