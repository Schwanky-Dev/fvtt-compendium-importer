# Compendium Importer for Foundry VTT

[![Foundry v12-v13](https://img.shields.io/badge/Foundry-v12--v13-informational)](https://foundryvtt.com) [![dnd5e v3+](https://img.shields.io/badge/dnd5e-v3%2B-informational)](https://github.com/foundryvtt/dnd5e) [![Version 1.5.0](https://img.shields.io/badge/version-1.5.0-green)](https://github.com/Schwanky-Dev/fvtt-compendium-importer/releases)

Search and import monsters, spells, and items from multiple D&D 5e sources — Open5e, dnd5e.wikidot.com, D&D Beyond, and Roll20 — directly into your Foundry VTT world with one click. Results are automatically mapped to fully functional dnd5e system Actors and Items with parsed attacks, damage, spells, Active Effects, and more.

## Features

- **Multi-source search** — Query Open5e API, Wikidot, D&D Beyond, and Roll20 simultaneously
- **One-click import** — Auto-detects type: monsters become Actors (NPC), spells and items become Items
- **Click-to-preview** — Inline stat block preview in the search results before importing
- **Source tier badges** — 🟢 Green (official WotC), 🟡 Yellow (Unearthed Arcana), 🔴 Red (third-party)
- **Source filter setting** — Restrict results to official-only, official + UA, or all sources
- **Full attack parsing** — To-hit bonuses, damage dice + type, versatile damage, reach/range, save DCs, AoE targets
- **Spellcaster spell resolution** — Parses spellcasting blocks and resolves each spell from the dnd5e system compendium (falls back to Open5e API)
- **Magic item effect parsing** — Charges & recovery, attunement requirements, +X magical bonuses, Active Effects for damage resistance/immunity, stat overrides, AC bonuses, spell save DC bonuses, and spell attack bonuses
- **Auto-assign weapon icons** — 50+ mapped weapon/attack names to Foundry core icons (bite, claw, longsword, breath weapons, etc.)
- **`/import` chat command** — Type `/import goblin` in chat to search instantly
- **Quick Import macro** — Auto-created macro with a dialog prompt for fast searching
- **CORS proxy support** — Built-in proxy server for scraping DDB, Wikidot, and Roll20

## Installation

### Manifest URL (recommended)

In Foundry VTT, go to **Settings → Add-on Modules → Install Module** and paste:

```
https://github.com/Schwanky-Dev/fvtt-compendium-importer/releases/latest/download/module.json
```

### Manual Install

Download the [latest release zip](https://github.com/Schwanky-Dev/fvtt-compendium-importer/releases) and extract it to your `Data/modules/fvtt-compendium-importer/` directory.

## Usage

### Search UI

1. Open the **Actors** sidebar tab
2. Click the **Import** button in the directory header
3. Type a search query and press Enter or click Search
4. Click any result to preview its stat block inline
5. Click the **Import** button on a result to create it in your world

Monsters are imported as NPC Actors with fully parsed actions, features, legendary actions, reactions, saving throws, skills, and spells. Spells and items are imported as Items.

### `/import` Chat Command

Type in the chat box:

```
/import ancient red dragon
```

This opens the Importer UI and immediately searches for the query.

### Quick Import Macro

On first load (if enabled), a **Quick Import** macro is created in a "Compendium Importer" folder. Run it from the hotbar to get a dialog prompt, type your query, and the Importer opens with results.

## CORS Proxy

D&D Beyond, Wikidot, and Roll20 block cross-origin requests. To use these sources, run the included CORS proxy:

```bash
cd modules/fvtt-compendium-importer/proxy
node server.mjs
```

Options:

```bash
node server.mjs --port 8081 --allowed-origins http://localhost:30000
```

Then set the **CORS Proxy URL** in module settings to `http://localhost:8081`.

The proxy only allows requests to a hardcoded allowlist of hosts (dndbeyond.com, roll20.net, dnd5e.wikidot.com, api.open5e.com).

**Note:** Open5e works without a proxy — it has proper CORS headers.

## Settings

| Setting | Default | Description |
|---|---|---|
| **Enable Open5e** | ✅ On | Search the Open5e SRD API |
| **Enable Wikidot** | ✅ On | Scrape dnd5e.wikidot.com (requires CORS proxy) |
| **Enable D&D Beyond** | ❌ Off | Scrape D&D Beyond pages (requires CORS proxy) |
| **Enable Roll20** | ❌ Off | Scrape Roll20 compendium (requires CORS proxy) |
| **Source Filter** | All | Filter results: All Sources / Official WotC Only / Official + UA |
| **CORS Proxy URL** | *(empty)* | URL of proxy server (e.g. `http://localhost:8081`) |
| **Auto-Create Macros** | ✅ On | Create Quick Import macro on first load |

## Compatibility

- **Foundry VTT:** v12 – v13 (verified on v13)
- **System:** dnd5e v3.0.0+
- **Browsers:** Any modern browser supported by Foundry

## Screenshots

*Coming soon.*

## Contributing

Contributions welcome! Fork the repo, make your changes, and open a PR. Please keep changes focused and test with both Foundry v12 and v13.

## License

[MIT](LICENSE)
