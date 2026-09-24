const ASSETS = "gl-tcg-assets";
const SHELL = "gl-tcg-shell-v14";
const ASSET_RE = /^\/(cards-fr|cards|boosters|cosmetics|combat|don|audio|playmat|social)\//;
const ASSET_FILE = /^\/(card-back|logo-|favicon|icon-|apple-touch|don\.jpg)/i;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((k) => {
          if (k === ASSETS || k === SHELL) return Promise.resolve();
          if (k.startsWith("gl-tcg-assets")) return Promise.resolve();
          return caches.delete(k);
        }),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
  if (event.data && event.data.type === "purge-catalog") {
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(ASSETS);
          const keys = await cache.keys();
          await Promise.all(
            keys
              .filter((k) => {
                try {
                  return new URL(k.url).pathname === "/data/catalog.json";
                } catch {
                  return false;
                }
              })
              .map((k) => cache.delete(k)),
          );
        } catch {
          /* ignore */
        }
      })(),
    );
  }
});

function isAsset(url) {
  const path = url.pathname;
  return ASSET_RE.test(path) || ASSET_FILE.test(path);
}

function isLive(req, url) {
  return (
    req.mode === "navigate" ||
    /\.(css|js|mjs|html)(\?|$)/i.test(url.pathname) ||
    url.pathname.startsWith("/src/") ||
    url.pathname.startsWith("/@")
  );
}

function applyCardOverrides(base, overrides) {
  if (!base || !Array.isArray(base.cards) || !Array.isArray(overrides)) return base;
  const byId = new Map(base.cards.map((c) => [c.id, c]));
  for (const o of overrides) {
    if (!o || !o.id) continue;
    if (o.action === "delete") byId.delete(o.id);
    else if (o.card && typeof o.card === "object") {
      const prev = byId.get(o.id) || {};
      byId.set(o.id, { ...prev, ...o.card, id: o.id });
    }
  }
  base.cards = Array.from(byId.values());
  return base;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isLive(req, url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            var ctype = (res.headers.get("content-type") || "").toLowerCase();
            var isJs = /\.(js|mjs)(\?|$)/i.test(url.pathname);
            if (isJs && ctype.includes("text/html")) return res;
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy).catch(() => undefined));
          }
          return res;
        })
        .catch(async () => (await caches.match(req)) || Response.error()),
    );
    return;
  }

  // Never cache the admin override feed — edits must show up immediately.
  if (url.pathname === "/api/card-overrides" || url.pathname === "/api/catalog" || url.pathname === "/api/progress") {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => Response.error()));
    return;
  }

  // Admin-added/edited/removed cards, merged over the static catalog on the
  // fly. Prefer the server-merged payload; if that is just the static file,
  // still layer /api/card-overrides on top.
  if (url.pathname === "/data/catalog.json") {
    event.respondWith(
      (async () => {
        try {
          const [baseRes, overridesRes] = await Promise.all([
            fetch(req, { cache: "no-store" }),
            fetch("/api/card-overrides", { cache: "no-store" }).catch(() => null),
          ]);
          if (!baseRes || !baseRes.ok) throw new Error("base catalog fetch failed");
          if (!overridesRes || !overridesRes.ok) return baseRes;
          const overrides = await overridesRes.json();
          if (!Array.isArray(overrides) || !overrides.length) return baseRes;
          const base = await baseRes.json();
          applyCardOverrides(base, overrides);
          return new Response(JSON.stringify(base), {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          });
        } catch {
          const cache = await caches.open(ASSETS);
          return (
            (await cache.match(req)) ||
            (await cache.match(new URL(req.url).pathname)) ||
            fetch(req).catch(() => Response.error())
          );
        }
      })(),
    );
    return;
  }

  if (isAsset(url) || url.pathname.startsWith("/data/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = (await cache.match(req)) || (await cache.match(url.pathname));
        if (hit) return hit;
        try {
          const res = await fetch(req);
          if (res && res.ok) cache.put(req, res.clone()).catch(() => undefined);
          return res;
        } catch {
          return (await caches.match(req)) || Response.error();
        }
      }),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(req, copy).catch(() => undefined));
        }
        return res;
      })
      .catch(async () => (await caches.match(req)) || Response.error()),
  );
});
