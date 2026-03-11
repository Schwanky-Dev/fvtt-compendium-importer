/**
 * Creates a single "Quick Import" macro on first load.
 */

const MODULE_ID = "fvtt-compendium-importer";
const FOLDER_NAME = "Compendium Importer";

const MACRO = {
  name: "Quick Import",
  icon: "icons/tools/scribal/magnifying-glass.webp",
  command: `
new Dialog({
  title: "Quick Import",
  content: '<div style="margin:10px 0"><input type="text" id="ci-query" placeholder="Search for monsters, spells, items..." style="width:100%" autofocus></div>',
  buttons: {
    search: {
      icon: '<i class="fas fa-search"></i>',
      label: "Search",
      callback: async (html) => {
        const query = html.find ? html.find('#ci-query').val() : html.querySelector('#ci-query')?.value;
        if (query) {
          const { ImporterApp } = await import("/modules/fvtt-compendium-importer/scripts/apps/ImporterApp.mjs");
          ImporterApp.openWithSearch(query);
        }
      }
    }
  },
  default: "search"
}).render(true);
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
