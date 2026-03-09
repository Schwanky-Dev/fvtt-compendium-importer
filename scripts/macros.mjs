/**
 * Creates a single "Quick Import" macro on first load.
 */

const MODULE_ID = "fvtt-compendium-importer";
const FOLDER_NAME = "Compendium Importer";

const MACRO = {
  name: "Quick Import",
  icon: "icons/tools/scribal/magnifying-glass.webp",
  command: `
const query = await Dialog.prompt({
  title: "Quick Import",
  content: '<input type="text" name="query" placeholder="Search for monsters, spells, items..." autofocus>',
  callback: (html) => html.querySelector ? html.querySelector('input[name="query"]')?.value : html[0]?.querySelector('input[name="query"]')?.value,
  rejectClose: false,
});
if (query) {
  const { ImporterApp } = await import("/modules/fvtt-compendium-importer/scripts/apps/ImporterApp.mjs");
  ImporterApp.openWithSearch(query);
}
`.trim(),
};

/**
 * Create macro folder and macro idempotently.
 */
export async function createMacros() {
  if (!game.settings.get(MODULE_ID, "autoCreateMacros")) return;
  if (!game.user.isGM) return;

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

  // Delete old macros from previous versions
  const oldNames = ["Quick Monster Import", "Quick Spell Import", "Quick Item Import", "Search Open5e", "Import by URL"];
  for (const name of oldNames) {
    const old = game.macros.find((m) => m.name === name && m.folder?.id === folder.id);
    if (old) await old.delete();
  }

  // Create if not exists
  const existing = game.macros.find(
    (m) => m.name === MACRO.name && m.folder?.id === folder.id
  );
  if (existing) return;

  await Macro.create({
    name: MACRO.name,
    type: "script",
    img: MACRO.icon,
    command: MACRO.command,
    folder: folder.id,
    ownership: { default: 3 },
  });

  console.log(`${MODULE_ID} | Quick Import macro created`);
}
