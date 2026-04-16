/* Digital Raven PWA service worker (simple offline-first caching). */
const CACHE_NAME = "digital-raven-v6";

function assetUrl(path) {
  return new URL(path, self.location).toString();
}

const CORE_ASSETS = [
  assetUrl("./"),
  assetUrl("./index.html"),
  assetUrl("./manifest.json"),
  assetUrl("./assets/styles/main.css"),
  assetUrl("./assets/js/data.js"),
  assetUrl("./assets/js/app.js"),
  assetUrl("./assets/js/ravenNorms.js"),
  assetUrl("./assets/data/Raven.csv"),
  assetUrl("./assets/images/logo.png"),
  assetUrl("./assets/icons/icon-192.png"),
  assetUrl("./assets/icons/icon-512.png")
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(CORE_ASSETS);
      } catch (err) {
        // If any asset fails to cache, still allow install to complete.
      }
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
          return Promise.resolve();
        })
      );
    })()
  );
  self.clients.claim();
});

function isNavigationRequest(request) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle same-origin GET requests for caching.
  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;

  if (isNavigationRequest(request)) {
    // Network-first for navigations, fallback to cache.
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, res.clone());
          return res;
        } catch (e) {
          const cached = await caches.match(assetUrl("./index.html"));
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const res = await fetch(request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, res.clone());
      return res;
    })()
  );
});

