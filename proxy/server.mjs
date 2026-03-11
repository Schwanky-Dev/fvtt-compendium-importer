/**
 * Dead-simple CORS proxy for fvtt-compendium-importer.
 * No dependencies — just `node proxy/server.mjs` and go.
 *
 * Usage: GET http://localhost:3001/proxy?url=ENCODED_URL
 * Health: GET http://localhost:3001/health
 */

import http from "node:http";
import https from "node:https";

const PORT = parseInt(process.env.PORT || "3001", 10);

const ALLOWED_DOMAINS = new Set([
  "dnd5e.wikidot.com",
  "www.dndbeyond.com",
  "open5e.com",
  "roll20.net",
]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function respond(res, status, body, extraHeaders = {}) {
  const headers = { ...corsHeaders(), "Content-Type": "application/json", ...extraHeaders };
  res.writeHead(status, headers);
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function proxyFetch(targetUrl) {
  return new Promise((resolve, reject) => {
    const mod = targetUrl.startsWith("https") ? https : http;
    const req = mod.get(targetUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CORSProxy/1.0)" } }, (upstream) => {
      const chunks = [];
      upstream.on("data", (c) => chunks.push(c));
      upstream.on("end", () => {
        resolve({
          status: upstream.statusCode,
          headers: upstream.headers,
          body: Buffer.concat(chunks),
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error("timeout")); });
  });
}

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/health") {
    return respond(res, 200, { status: "ok" });
  }

  if (url.pathname === "/proxy" && req.method === "GET") {
    const target = url.searchParams.get("url");
    if (!target) return respond(res, 400, { error: "Missing ?url= parameter" });

    let parsed;
    try { parsed = new URL(target); } catch { return respond(res, 400, { error: "Invalid URL" }); }

    if (!ALLOWED_DOMAINS.has(parsed.hostname)) {
      return respond(res, 403, { error: `Domain not allowed: ${parsed.hostname}` });
    }

    try {
      const upstream = await proxyFetch(target);
      const ct = upstream.headers["content-type"] || "application/octet-stream";
      res.writeHead(upstream.status, {
        ...corsHeaders(),
        "Content-Type": ct,
      });
      res.end(upstream.body);
    } catch (err) {
      return respond(res, 502, { error: `Proxy error: ${err.message}` });
    }
    return;
  }

  respond(res, 404, { error: "Not found. Use /proxy?url= or /health" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`CORS proxy listening on http://0.0.0.0:${PORT}`);
  console.log(`Allowed domains: ${[...ALLOWED_DOMAINS].join(", ")}`);
});
