#!/usr/bin/env node
/**
 * Lightweight CORS proxy for Compendium Importer.
 * Run alongside Foundry to enable DDB, Roll20, and Wikidot scraping.
 *
 * Usage: node server.mjs [--port 8081] [--allowed-origins http://localhost:30000]
 *
 * Requests: GET http://localhost:8081/https://www.dndbeyond.com/monsters/goblin
 * The proxy strips its own URL prefix and fetches the target, returning with CORS headers.
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

const args = process.argv.slice(2);
const PORT = parseInt(getArg("--port", "8081"));
const ALLOWED_ORIGINS = getArg("--allowed-origins", "*").split(",");
const ALLOWED_HOSTS = [
  "www.dndbeyond.com",
  "dndbeyond.com",
  "roll20.net",
  "www.roll20.net",
  "dnd5e.wikidot.com",
  "api.open5e.com",
];

function getArg(name, fallback) {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    setCorsHeaders(res, req.headers.origin);
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === "/" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", allowedHosts: ALLOWED_HOSTS }));
    return;
  }

  // Extract target URL from path (strip leading /)
  const targetUrl = req.url.slice(1);
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid target URL" }));
    return;
  }

  // Allowlist check
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Host ${parsed.hostname} not in allowlist` }));
    return;
  }

  // Origin check
  if (ALLOWED_ORIGINS[0] !== "*") {
    const origin = req.headers.origin || "";
    if (!ALLOWED_ORIGINS.includes(origin)) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Origin not allowed" }));
      return;
    }
  }

  try {
    const proxyRes = await proxyFetch(parsed, req);
    setCorsHeaders(res, req.headers.origin);
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  } catch (err) {
    setCorsHeaders(res, req.headers.origin);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: err.message }));
  }
});

function proxyFetch(url, req) {
  return new Promise((resolve, reject) => {
    const mod = url.protocol === "https:" ? https : http;
    const proxyReq = mod.request(
      url,
      {
        method: req.method,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: req.headers.accept || "text/html,application/json,*/*",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 15000,
      },
      resolve
    );
    proxyReq.on("error", reject);
    proxyReq.on("timeout", () => {
      proxyReq.destroy();
      reject(new Error("Proxy request timed out"));
    });
    proxyReq.end();
  });
}

function setCorsHeaders(res, origin) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0] === "*" ? "*" : (origin || "*"));
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
}

server.listen(PORT, () => {
  console.log(`CORS proxy listening on http://localhost:${PORT}`);
  console.log(`Allowed hosts: ${ALLOWED_HOSTS.join(", ")}`);
  console.log(`Usage: GET http://localhost:${PORT}/https://www.dndbeyond.com/monsters/goblin`);
});
