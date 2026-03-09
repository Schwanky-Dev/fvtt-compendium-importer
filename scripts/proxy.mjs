/**
 * Server-side proxy via Foundry's socket/query system.
 * The GM client fetches external URLs on behalf of all players,
 * bypassing CORS since GM's browser context may have different restrictions.
 *
 * Actually, CORS is enforced by ALL browsers regardless of GM/player status.
 * The real solution: register a query handler that uses Foundry's server
 * as an intermediary. The server-side Node.js process has no CORS restrictions.
 *
 * Approach: Use CONFIG.queries to register a proxy endpoint.
 * When a non-GM client needs to fetch a CORS-blocked URL, it queries the GM.
 * The GM's handler makes the fetch. If the GM's browser ALSO blocks it,
 * we fall back to a socket-based approach where the server relays.
 *
 * SIMPLEST APPROACH: Just have the GM do the fetch. The GM's browser is
 * typically on the same network/machine as Foundry, and we can try with
 * no-cors mode or just accept that some sites will block.
 *
 * ACTUAL SIMPLEST: Since Foundry's server IS a Node.js process, we use
 * the socket to ask the server to fetch for us. But Foundry doesn't expose
 * a way for modules to run arbitrary server-side code via sockets alone.
 *
 * PRAGMATIC APPROACH: Use a GM-delegated fetch with query system.
 * The GM client fetches the URL. If CORS blocks it, it returns an error.
 * This works when the GM has a CORS-disabling extension or when the target
 * site allows the request.
 */

const MODULE_ID = "fvtt-compendium-importer";
const ALLOWED_HOSTS = [
  "www.dndbeyond.com",
  "dndbeyond.com",
  "roll20.net",
  "www.roll20.net",
  "dnd5e.wikidot.com",
  "api.open5e.com",
];

/**
 * Register the proxy query handler. Call this in the "ready" hook.
 */
export function registerProxyQuery() {
  // Register a query that the GM handles — fetches a URL and returns the text
  CONFIG.queries[`${MODULE_ID}.proxyFetch`] = async (queryData) => {
    const { url } = queryData;

    // Validate URL
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return { error: "Invalid URL", status: 400 };
    }

    // Allowlist check
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return { error: `Host ${parsed.hostname} not allowed`, status: 403 };
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { error: `HTTP ${response.status}`, status: response.status };
      }
      const text = await response.text();
      return { text, status: response.status };
    } catch (err) {
      return { error: err.message, status: 0 };
    }
  };

  console.log(`${MODULE_ID} | Proxy query registered`);
}

/**
 * Fetch a URL through the GM proxy query system.
 * Falls back to direct fetch if no GM is available or if query fails.
 * @param {string} url - The URL to fetch
 * @returns {Promise<Response-like>} Object with { ok, status, text() }
 */
export async function proxyFetch(url) {
  // First, try the external CORS proxy if configured
  const corsProxyUrl = game.settings.get(MODULE_ID, "corsProxyUrl");
  if (corsProxyUrl) {
    try {
      const base = corsProxyUrl.replace(/\/+$/, "");
      const response = await fetch(`${base}/${url}`);
      if (response.ok) return response;
    } catch {
      // Fall through to query approach
    }
  }

  // Try the GM query approach
  const gm = game.users.activeGM;
  if (gm && gm.id !== game.user.id) {
    // We're a player — query the GM to fetch for us
    try {
      const result = await gm.query(`${MODULE_ID}.proxyFetch`, { url });
      return makeResponseLike(result);
    } catch (err) {
      console.warn(`${MODULE_ID} | GM proxy query failed:`, err);
    }
  } else if (gm && gm.id === game.user.id) {
    // We ARE the GM — just fetch directly (will still hit CORS in browser)
    try {
      const response = await fetch(url);
      return response;
    } catch {
      // CORS blocked — nothing we can do without a server-side proxy
    }
  }

  // Last resort: try direct fetch (will likely fail for CORS-blocked sites)
  return fetch(url);
}

/**
 * Wrap a query result to look like a Response object.
 */
function makeResponseLike(result) {
  if (result.error) {
    return {
      ok: false,
      status: result.status || 0,
      statusText: result.error,
      text: async () => "",
      json: async () => { throw new Error(result.error); },
    };
  }
  return {
    ok: true,
    status: result.status || 200,
    statusText: "OK",
    text: async () => result.text,
    json: async () => JSON.parse(result.text),
  };
}
