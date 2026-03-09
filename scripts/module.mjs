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
    default: true,
  });

  game.settings.register(MODULE_ID, "enableRoll20", {
    name: "COMPIMPORTER.Settings.EnableRoll20",
    hint: "COMPIMPORTER.Settings.EnableRoll20Hint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, "sourceFilter", {
    name: "COMPIMPORTER.Settings.SourceFilter",
    hint: "COMPIMPORTER.Settings.SourceFilterHint",
    scope: "world",
    config: true,
    type: String,
    default: "all",
    choices: {
      all: "All Sources",
      srd: "SRD Only (WotC)",
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
  await createMacros();
  registerChatCommand();
});

/* ----------------------------- Sidebar Button ----------------------------- */

Hooks.on("renderSidebarTab", (app, html) => {
  if (app.tabName !== "actors") return;

  // v13 ApplicationV2: html is an HTMLElement
  // v12 / older: html may be jQuery or an array-like
  let header;
  if (html instanceof HTMLElement) {
    header = html.querySelector(".directory-header .action-buttons");
  } else if (html?.[0] instanceof HTMLElement) {
    header = html[0].querySelector(".directory-header .action-buttons");
  } else if (typeof html?.find === "function") {
    header = html.find(".directory-header .action-buttons")?.[0];
  }
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
    return false;
  });
}
