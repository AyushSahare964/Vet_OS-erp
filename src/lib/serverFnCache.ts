/**
 * Browser-side: identical server-function reads (GET) made at the same moment share ONE network call, and the
 * answer is reused for a few seconds. A page mounts several components that each ask for the same list, so this
 * turns N identical calls (each a separate serverless run + DB query) into one.
 *
 * Safe by construction: only GET /_serverFn/ reads are shared; any write (POST) invalidates everything before and
 * after it runs, so a change you just made is never hidden behind an old answer. Requests with an abort signal
 * are left alone. The data and the server code are untouched.
 */
const TTL_MS = 5_000;

interface Entry { at: number; gen: number; p: Promise<Response> }
const cache = new Map<string, Entry>();
let gen = 0; // bumped on every write; entries from an older generation are ignored

export function installServerFnCache(g: typeof globalThis = globalThis) {
  if ((g as any).__serverFnCache || typeof g.fetch !== "function") return;
  (g as any).__serverFnCache = true;
  const orig = g.fetch.bind(g);

  g.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.includes("/_serverFn/")) return orig(input, init);
    const method = (init?.method || (typeof input === "object" && "method" in input ? input.method : "GET") || "GET").toUpperCase();

    if (method !== "GET") {
      gen++;
      return orig(input, init).finally(() => { gen++; cache.clear(); });
    }
    if (init?.signal) return orig(input, init);

    const hit = cache.get(url);
    if (hit && hit.gen === gen && Date.now() - hit.at < TTL_MS) return hit.p.then((r) => r.clone());

    const p = orig(input, init);
    cache.set(url, { at: Date.now(), gen, p });
    p.then((r) => { if (!r.ok) cache.delete(url); }, () => cache.delete(url));
    return p.then((r) => r.clone());
  };
}

export function _resetServerFnCacheForTest() { cache.clear(); gen = 0; }
