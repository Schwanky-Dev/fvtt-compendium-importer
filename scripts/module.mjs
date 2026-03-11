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

  game.settings.register(MODULE_ID, "enableAidedd", {
    name: "COMPIMPORTER.Settings.EnableAidedd",
    hint: "COMPIMPORTER.Settings.EnableAideddHint",
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
      official: "Official WotC Only (green)",
      "official+ua": "Official + Unearthed Arcana (green + yellow)",
    },
  });

  game.settings.register(MODULE_ID, "defaultSearchPass", {
    name: "COMPIMPORTER.Settings.DefaultSearchPass",
    hint: "COMPIMPORTER.Settings.DefaultSearchPassHint",
    scope: "world",
    config: true,
    type: String,
    default: "standard",
    choices: {
      quick: "Quick (primary source only)",
      standard: "Standard (Open5e + AideDD + Roll20)",
      deep: "Deep (all enabled sources)",
    },
  });

  game.settings.register(MODULE_ID, "primarySource", {
    name: "COMPIMPORTER.Settings.PrimarySource",
    hint: "COMPIMPORTER.Settings.PrimarySourceHint",
    scope: "world",
    config: true,
    type: String,
    default: "open5e",
    choices: {
      open5e: "Open5e",
      aidedd: "AideDD",
      roll20: "Roll20",
      ddb: "D&D Beyond",
      wikidot: "Wikidot",
    },
  });

  game.settings.register(MODULE_ID, "corsProxyUrl", {
    name: "CORS Proxy URL",
    hint: "URL of a CORS proxy for DDB/Roll20/Wikidot scraping. Leave blank to fall back to direct fetch. Run: node proxy/server.mjs",
    scope: "world",
    config: true,
    type: String,
    default: "http://localhost:3001",
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
  checkProxyHealth();
});

/* ----------------------------- Proxy Health -------------------------------- */

async function checkProxyHealth() {
  if (!game.user.isGM) return;

  const proxyUrl = game.settings.get(MODULE_ID, "corsProxyUrl");
  if (!proxyUrl) return;

  try {
    const resp = await fetch(`${proxyUrl.replace(/\/+$/, "")}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    if (resp.ok) {
      console.log(`${MODULE_ID} | CORS proxy is running at ${proxyUrl}`);
      return;
    }
  } catch {
    // Proxy not reachable
  }

  ui.notifications.warn(
    `<b>Compendium Importer:</b> CORS proxy not running at <code>${proxyUrl}</code>. ` +
    `DDB, Wikidot, and Roll20 imports will not work. ` +
    `Run <code>proxy/setup.bat</code> (Windows) or <code>proxy/setup.sh</code> (Linux) on your Foundry server to install it as an auto-start service.`,
    { permanent: true }
  );
}

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
