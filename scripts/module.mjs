/**
 * Compendium Importer — Entry point.
 * Registers hooks, settings, sidebar button, and chat command.
 */

import { ImporterApp } from "./apps/ImporterApp.mjs";
import { createMacros } from "./macros.mjs";

const MODULE_ID = "fvtt-compendium-importer";

/* ---------------------------------- Init ---------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Compendium Importer`);

  // Register Handlebars helpers
  Handlebars.registerHelper("eq", function (a, b) {
    return a === b;
  });

  Handlebars.registerHelper("ifCond", function (v1, operator, v2, options) {
    switch (operator) {
      case "===": return v1 === v2 ? options.fn(this) : options.inverse(this);
      case "!==": return v1 !== v2 ? options.fn(this) : options.inverse(this);
      case "&&": return v1 && v2 ? options.fn(this) : options.inverse(this);
      case "||": return v1 || v2 ? options.fn(this) : options.inverse(this);
      default: return options.inverse(this);
    }
  });

  // Register module settings
  game.settings.register(MODULE_ID, "enableOpen5e", {
    name: "COMPIMPORTER.Settings.EnableOpen5e",
    hint: "COMPIMPORTER.Settings.EnableOpen5eHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "enableDDB", {
    name: "COMPIMPORTER.Settings.EnableDDB",
    hint: "COMPIMPORTER.Settings.EnableDDBHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "enableWikidot", {
    name: "COMPIMPORTER.Settings.EnableWikidot",
    hint: "COMPIMPORTER.Settings.EnableWikidotHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "enableRoll20", {
    name: "COMPIMPORTER.Settings.EnableRoll20",
    hint: "COMPIMPORTER.Settings.EnableRoll20Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "enableWikidot", {
    name: "COMPIMPORTER.Settings.EnableWikidot",
    hint: "COMPIMPORTER.Settings.EnableWikidotHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, "defaultImportType", {
    name: "COMPIMPORTER.Settings.DefaultImportType",
    hint: "COMPIMPORTER.Settings.DefaultImportTypeHint",
    scope: "world",
    config: true,
    type: String,
    default: "auto",
    choices: {
      auto: "Auto (Monster→Actor, Spell/Item→Item)",
      actor: "Always Actor",
      item: "Always Item",
      journal: "Always Journal Entry",
    },
  });

  game.settings.register(MODULE_ID, "autoCreateMacros", {
    name: "COMPIMPORTER.Settings.AutoCreateMacros",
    hint: "COMPIMPORTER.Settings.AutoCreateMacrosHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
  });
});

/* --------------------------------- Ready ---------------------------------- */

Hooks.on("ready", async () => {
  console.log(`${MODULE_ID} | Ready`);

  // Create macros on first load
  await createMacros();

  // Register chat command
  registerChatCommand();
});

/* ----------------------------- Sidebar Button ----------------------------- */

Hooks.on("renderSidebarTab", (app, html) => {
  // Add button to Actors sidebar
  if (app.tabName !== "actors") return;

  const header = html[0]?.querySelector?.(".directory-header .action-buttons") ??
                 html.find?.(".directory-header .action-buttons")?.[0];
  if (!header) return;

  // Don't add if already exists
  if (header.querySelector(".ci-import-btn")) return;

  const btn = document.createElement("button");
  btn.classList.add("ci-import-btn");
  btn.type = "button";
  btn.innerHTML = `<i class="fas fa-file-import"></i> ${game.i18n.localize("COMPIMPORTER.SidebarButton")}`;
  btn.addEventListener("click", (ev) => {
    ev.preventDefault();
    new ImporterApp().render(true);
  });

  header.appendChild(btn);
});

/* ------------------------------ Chat Command ------------------------------ */

function registerChatCommand() {
  Hooks.on("chatMessage", (chatLog, message, chatData) => {
    if (!message.startsWith("/import")) return;

    const query = message.replace(/^\/import\s*/, "").trim();

    if (!query) {
      ui.notifications.info(game.i18n.localize("COMPIMPORTER.ChatCommand"));
      return false;
    }

    ImporterApp.openWithSearch(query);
    return false; // Prevent message from being posted
  });
}
