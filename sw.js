/* Team Stat Tracker service worker: caches the whole app so it runs with no connection. */
const VERSION = "d205036f04";
const PRECACHE = "stat-tracker-app-" + VERSION;
const RUNTIME = "stat-tracker-fonts-v1";
const ASSETS = [
  "assets/app-2199F667.css",
  "assets/app-LBYLA7KI.js",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest"
];

const scopeUrl = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      await Promise.all(
        ASSETS.map(async (path) => {
          const res = await fetch(new Request(scopeUrl(path), { cache: "reload" }));
          if (!res.ok) throw new Error("Precache failed: " + path + " (" + res.status + ")");
          await cache.put(scopeUrl(path), res);
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = [PRECACHE, RUNTIME];
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith("stat-tracker-") && !keep.includes(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Web fonts: use the cached copy, refresh it in the background when online.
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || (await network) || Response.error();
      })()
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Opening / reloading the app: always serve the cached shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cached = await caches.match(scopeUrl("index.html"));
        if (cached) return cached;
        try {
          return await fetch(req);
        } catch (e) {
          return new Response("Offline and the app has not been cached yet. Open it once while online.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          });
        }
      })()
    );
    return;
  }

  // Everything else from our own origin: cache first, network as backup.
  event.respondWith(
    (async () => {
      const cached = await caches.match(req, { ignoreSearch: true });
      if (cached) return cached;
      return fetch(req);
    })()
  );
});
