# Compendomize — D&D 5e Compendium Importer for Foundry VTT

[![Foundry v12-v13](https://img.shields.io/badge/Foundry-v12--v13-informational)](https://foundryvtt.com) [![dnd5e v3+](https://img.shields.io/badge/dnd5e-v3%2B-informational)](https://github.com/foundryvtt/dnd5e) [![Version 2.0.0](https://img.shields.io/badge/version-2.0.0-green)](https://github.com/Schwanky-Dev/fvtt-compendium-importer/releases)

Search and import monsters, spells, and items from multiple D&D 5e sources directly into your Foundry VTT world with one click. Results are automatically mapped to fully functional dnd5e system Actors and Items with parsed attacks, damage, spells, and more.

## ⚠️ Legal Disclaimer

**Compendomize is a search and import tool. It does not include, bundle, or redistribute any copyrighted game content.**

This module fetches publicly accessible data from third-party websites (Open5e, AideDD, D&D Beyond, Roll20, Wikidot) at the user's direction. It is the **user's sole responsibility** to ensure they have the legal right to access and use any content imported through this tool. This includes but is not limited to:

- Content covered by the **Systems Reference Document (SRD)** under the Open Gaming License or Creative Commons license
- Content the user has **purchased or licensed** from the original publisher
- Content available under **fair use** or other applicable legal doctrines

**The authors and contributors of Compendomize:**
- Make no representations about the legality of scraping or importing any specific content
- Do not host, cache, or redistribute any game content
- Are not responsible for how users choose to use this tool
- Disclaim all liability for copyright infringement or Terms of Service violations by users
- Provide this software "as-is" with no warranty (see [LICENSE](LICENSE))

**If you are a content creator or rights holder** and believe this tool facilitates unauthorized access to your content, please [open an issue](https://github.com/Schwanky-Dev/fvtt-compendium-importer/issues) and we will work with you promptly.

By using Compendomize, you acknowledge that you are responsible for complying with all applicable laws and the Terms of Service of any third-party website accessed through this tool.

## Features

- **Multi-source search** — Query Open5e, AideDD, D&D Beyond, Roll20, and Wikidot simultaneously
- **Configurable search tiers** — Assign sources to Quick, Standard, or Deep search passes; customize via the ⚙️ gear button
- **One-click import** — Monsters become Actors (NPC), spells and items become Items
- **Click-to-preview** — Inline stat block preview before importing
- **Edition-aware source badges** — 🟢 2014 WotC official, 🔵 2024 WotC revised, 🟡 Unearthed Arcana/playtest, 🔴 Third-party
- **Source filter** — Restrict results by edition/tier
- **dnd5e v3+ Activities system** — Imported attacks have proper attack rolls, damage formulas, save DCs, and range (no empty columns)
- **Full attack parsing** — To-hit bonuses, damage dice + type, versatile damage, reach/range, save DCs, AoE targets
- **Spellcaster resolution** — Parses spellcasting blocks, resolves each spell from the dnd5e compendium (falls back to Open5e API)
- **Magic item parsing** — Charges, recovery, attunement, +X bonuses, Active Effects
- **Image import** — Token/portrait art downloaded through proxy and saved locally to Foundry
- **Auto-assign icons** — 50+ weapon/attack/spell types mapped to Foundry core icons
- **`/import` chat command** — `/import goblin` searches instantly
- **Quick Import macro** — Auto-created on first load
- **CORS proxy** — Built-in zero-dependency proxy for DDB, Roll20, Wikidot, and AideDD scraping
- **Fuzzy search toggle** — Exact match mode for precise lookups
- **Result filtering** — Filter within displayed results without re-searching

## Sources

| Source | Proxy Required | Content |
|---|---|---|
| **Open5e** | No | SRD monsters, spells, items (full API) |
| **AideDD** | Yes | Official SRD monsters & spells with book attribution |
| **Roll20** | Yes | Compendium monsters & spells (JSON API) |
| **D&D Beyond** | Yes | Monster/spell listings (creates Journal Entry with link — pages are JS-rendered) |
| **Wikidot** | Yes | SRD spells only (no monster pages) |

## Installation

### Manifest URL (recommended)

In Foundry VTT: **Settings → Add-on Modules → Install Module**, paste:

```
https://github.com/Schwanky-Dev/fvtt-compendium-importer/releases/latest/download/module.json
```

### Manual Install

Download the [latest release](https://github.com/Schwanky-Dev/fvtt-compendium-importer/releases), extract to `Data/modules/fvtt-compendium-importer/`.

## Usage

### Search UI

1. Open the **Actors** sidebar tab
2. Click **Compendomize** in the directory header
3. Select a search tier (Quick / Standard / Deep) — customize with ⚙️
4. Type a search query and press Enter
5. Click a result to preview, click **Import** to create it

### `/import` Chat Command

```
/import ancient red dragon
```

### Quick Import Macro

A **Compendomize: Quick Import** macro is auto-created in a "Compendomize" folder on first load.

## CORS Proxy

D&D Beyond, AideDD, Wikidot, and Roll20 require a CORS proxy. The included proxy is a single zero-dependency Node.js script with a hardcoded domain allowlist.

### Quick Setup

Run **once** on your Foundry server:

**Windows** (as Administrator):
```
cd modules\fvtt-compendium-importer\proxy
setup.bat
```

**Linux:**
```bash
cd modules/fvtt-compendium-importer/proxy
chmod +x setup.sh
./setup.sh
```

The proxy runs on port 3001. Set **CORS Proxy URL** in module settings to `http://<YOUR_SERVER_IP>:3001`.

### Manual Start

```bash
node modules/fvtt-compendium-importer/proxy/server.mjs
```

### Allowed Domains

The proxy only forwards requests to:
- `api.open5e.com`
- `www.dndbeyond.com`
- `roll20.net`
- `dnd5e.wikidot.com`
- `www.aidedd.org`

### Managing the Service

**Windows:** Task named `CompendiumImporterProxy` — manage via Task Scheduler.

**Linux:**
```bash
systemctl --user status compendium-importer-proxy
systemctl --user stop compendium-importer-proxy
```

## Settings

| Setting | Default | Description |
|---|---|---|
| Enable Open5e | ✅ | Open5e SRD API |
| Enable AideDD | ✅ | AideDD.org (proxy required) |
| Enable Wikidot | ✅ | dnd5e.wikidot.com (proxy required) |
| Enable D&D Beyond | ❌ | D&D Beyond (proxy required) |
| Enable Roll20 | ❌ | Roll20 compendium (proxy required) |
| Source Filter | All | All / 2014 Official / 2014+2024 / All WotC |
| Default Search Pass | Standard | Quick / Standard / Deep |
| Primary Source | Open5e | Source used for Quick tier |
| CORS Proxy URL | `http://localhost:3001` | Proxy server address |
| Auto-Create Macros | ✅ | Create Quick Import macro on load |

## Compatibility

- **Foundry VTT:** v12 – v13 (verified on v13)
- **System:** dnd5e v3.0.0+
- **Browser:** Any modern browser supported by Foundry

## Contributing

Contributions welcome. Fork, make changes, open a PR. Please test on Foundry v13 with dnd5e v3+.

## License

[MIT](LICENSE) — see also the [Legal Disclaimer](#%EF%B8%8F-legal-disclaimer) above.
