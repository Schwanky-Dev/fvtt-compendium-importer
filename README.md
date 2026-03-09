# Compendium Importer for Foundry VTT v13

Import monsters, spells, and items from **Open5e**, **D&D Beyond**, and **Roll20** directly into your Foundry VTT world.

![Foundry v13](https://img.shields.io/badge/Foundry-v13-green)
![dnd5e](https://img.shields.io/badge/System-dnd5e%203.x-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## Features

- **Multi-Source Search** — Query Open5e, D&D Beyond, and Roll20 simultaneously
- **3-Layer Pipeline** — Scraper → Mapper → Importer for clean data transformation
- **Preview Before Import** — Full stat block preview styled like a D&D stat block
- **Import As Anything** — Same content can become an Actor, Item, or Journal Entry
- **Auto-Macros** — 5 ready-to-use macros created automatically on first load
- **Chat Command** — Type `/import goblin` to search instantly
- **Sidebar Button** — One-click access from the Actors tab
- **ApplicationV2** — Built with Foundry v13's modern application framework

## Scraper Status

| Source | Status | CORS | Notes |
|--------|--------|------|-------|
| Open5e (SRD) | ✅ Fully Working | No issues | Public REST API, primary data source |
| D&D Beyond | ⚠️ Experimental | Requires proxy | HTML scraping, CORS-blocked in browser |
| Roll20 | ⚠️ Experimental | Requires proxy | HTML scraping, CORS-blocked in browser |

## Installation

### Manual ZIP
1. Download the latest release ZIP from the [Releases](https://github.com/Schwanky-Dev/fvtt-compendium-importer/releases) page
2. Extract into your Foundry `Data/modules/` directory
3. Restart Foundry and enable the module in your world

### Manifest URL
Paste this URL into Foundry's **Install Module** dialog:
```
https://github.com/Schwanky-Dev/fvtt-compendium-importer/releases/latest/download/module.json
```

## Usage

### Search UI
1. Click the **Import from Compendium** button in the Actors sidebar tab
2. Type a search query (e.g., "goblin", "fireball", "longsword")
3. Select a category filter (All, Monsters, Spells, Items)
4. Click **Search**

### Preview
Click the 👁️ eye icon on any result to see a full stat block preview in the right panel.

### Import
- **Auto Import** (📥) — Monsters become Actors, spells/items become Items
- **As Actor** (👤) — Creates an NPC Actor with full abilities and action items
- **As Item** (💼) — Creates a dnd5e Item (spell, weapon, equipment, etc.)
- **As Journal** (📖) — Creates a Journal Entry with the formatted stat block

### Chat Command
```
/import ancient red dragon
/import fireball
/import +1 longsword
```

### Macros
On first load (with Auto-Create Macros enabled), a "Compendium Importer" macro folder is created with:
- **Quick Monster Import** — Prompts for a monster name, opens search
- **Quick Spell Import** — Same for spells
- **Quick Item Import** — Same for items
- **Search Open5e** — Opens the full search UI
- **Import by URL** — Paste an Open5e API URL to import directly

## Module Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Enable Open5e | ✅ On | Search the Open5e SRD API |
| Enable D&D Beyond | ❌ Off | Scrape DDB pages (needs CORS proxy) |
| Enable Roll20 | ❌ Off | Scrape Roll20 pages (needs CORS proxy) |
| Default Import Type | Auto | What document type to create by default |
| Auto-Create Macros | ✅ On | Create macro folder on first load |

## Screenshots

*Coming soon*

## Requirements

- Foundry VTT v12+ (verified on v13)
- dnd5e system v3.0+

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a PR

## License

MIT — see [LICENSE](LICENSE)
