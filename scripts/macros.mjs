/**
 * Auto-creates a macro folder with 5 import macros on first load.
 */

import { ImporterApp } from "./apps/ImporterApp.mjs";

const MODULE_ID = "fvtt-compendium-importer";
const FOLDER_NAME = "Compendium Importer";

const MACROS = [
  {
    name: "Quick Monster Import",
    icon: "icons/creatures/mammals/wolf-howl-silhouette-grey.webp",
    command: `
const query = await Dialog.prompt({
  title: "Quick Monster Import",
  content: '<input type="text" name="query" placeholder="Monster name..." autofocus>',
  callback: (html) => html.querySelector('input[name="query"]').value,
  rejectClose: false,
});
if (query) {
  const { ImporterApp } = await import("./modules/${MODULE_ID}/scripts/apps/ImporterApp.mjs");
  ImporterApp.openWithSearch(query, "monsters");
}
`.trim(),
  },
  {
    name: "Quick Spell Import",
    icon: "icons/magic/symbols/runes-star-pentagon-orange-purple.webp",
    command: `
const query = await Dialog.prompt({
  title: "Quick Spell Import",
  content: '<input type="text" name="query" placeholder="Spell name..." autofocus>',
  callback: (html) => html.querySelector('input[name="query"]').value,
  rejectClose: false,
});
if (query) {
  const { ImporterApp } = await import("./modules/${MODULE_ID}/scripts/apps/ImporterApp.mjs");
  ImporterApp.openWithSearch(query, "spells");
}
`.trim(),
  },
  {
    name: "Quick Item Import",
    icon: "icons/equipment/chest/chest-reinforced-steel-red.webp",
    command: `
const query = await Dialog.prompt({
  title: "Quick Item Import",
  content: '<input type="text" name="query" placeholder="Item name..." autofocus>',
  callback: (html) => html.querySelector('input[name="query"]').value,
  rejectClose: false,
});
if (query) {
  const { ImporterApp } = await import("./modules/${MODULE_ID}/scripts/apps/ImporterApp.mjs");
  ImporterApp.openWithSearch(query, "items");
}
`.trim(),
  },
  {
    name: "Search Open5e",
    icon: "icons/tools/scribal/magnifying-glass.webp",
    command: `
const { ImporterApp } = await import("./modules/${MODULE_ID}/scripts/apps/ImporterApp.mjs");
new ImporterApp().render(true);
`.trim(),
  },
  {
    name: "Import by URL",
    icon: "icons/tools/scribal/ink-quill-yellow.webp",
    command: `
const url = await Dialog.prompt({
  title: "Import by URL",
  content: \`
    <p>Paste an Open5e, D&D Beyond, or Roll20 URL:</p>
    <input type="text" name="url" placeholder="https://api.open5e.com/v1/monsters/aboleth/" autofocus style="width:100%">
  \`,
  callback: (html) => html.querySelector('input[name="url"]').value,
  rejectClose: false,
});
if (!url) return;

try {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status);
  const data = await response.json();

  // Determine type from URL
  let type = "magicitem";
  if (url.includes("/monsters/")) type = "monster";
  else if (url.includes("/spells/")) type = "spell";
  else if (url.includes("/weapons/")) type = "weapon";
  else if (url.includes("/armor/")) type = "armor";

  const result = {
    name: data.name,
    slug: data.slug,
    type,
    source: "open5e",
    _raw: data,
  };

  const { importResult } = await import("./modules/${MODULE_ID}/scripts/importer.mjs");
  const importType = type === "monster" ? "actor" : "item";
  await importResult(result, importType);
} catch (err) {
  ui.notifications.error("Import failed: " + err.message);
  console.error(err);
}
`.trim(),
  },
];

/**
 * Create macro folder and macros idempotently.
 */
export async function createMacros() {
  if (!game.settings.get(MODULE_ID, "autoCreateMacros")) return;
  if (!game.user.isGM) return;

  // Check if folder exists
  let folder = game.folders.find(
    (f) => f.name === FOLDER_NAME && f.type === "Macro"
  );

  if (!folder) {
    folder = await Folder.create({
      name: FOLDER_NAME,
      type: "Macro",
      color: "#7B2D8B",
    });
  }

  // Create macros that don't exist yet
  for (const macroData of MACROS) {
    const existing = game.macros.find(
      (m) => m.name === macroData.name && m.folder?.id === folder.id
    );
    if (existing) continue;

    await Macro.create({
      name: macroData.name,
      type: "script",
      img: macroData.icon,
      command: macroData.command,
      folder: folder.id,
      ownership: { default: 3 },
    });
  }

  console.log(`${MODULE_ID} | Macros created in folder "${FOLDER_NAME}"`);
}
