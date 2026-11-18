/* Digital Evaluation PWA service worker (simple offline-first caching). */
const CACHE_NAME = "digital-evaluation-v9";

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
  assetUrl("./assets/js/ravenCNorms.js"),
  assetUrl("./assets/js/discrepante.js"),
  assetUrl("./assets/js/vendor/pdf-lib.min.js"),
  assetUrl("./assets/js/szondi.js"),
  assetUrl("./assets/data/Raven.csv"),
  assetUrl("./assets/data/RavenC.csv"),
  assetUrl("./assets/data/Discrepante.csv"),
  assetUrl("./assets/data/szondi-vectori.json"),
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

self.addEventListener("message", (event) => {
  if (event && event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

function isAppShellRequest(request) {
  // Network-first for app code + data so catalog/UI updates are not stuck
  // behind an aggressive cache-first shell.
  const dest = request.destination;
  if (dest === "script" || dest === "style" || dest === "document") return true;
  const url = new URL(request.url);
  return url.pathname.endsWith(".csv") || url.pathname.endsWith(".json");
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

  // Network-first for app code + data (avoids "stuck" updates on aggressive caches),
  // fallback to cache when offline.
  if (isAppShellRequest(request)) {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request, { cache: "no-store" });
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, res.clone());
          return res;
        } catch {
          const cached = await caches.match(request);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // Cache-first for other static assets (icons/images).
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
