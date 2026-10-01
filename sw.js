// App-Shell: cache-first, Cache-Name enthält die App-Version (bei jeder Änderung erhöhen!).
// content/index.json: network-first mit Cache-Fallback; alle gelisteten Karten sind darin
// bereits enthalten (kein separater Abruf je Karte nötig).
const APP_VERSION = "1.15.1";
const SHELL_CACHE = `karteikarten-shell-${APP_VERSION}`;
const CONTENT_CACHE = "karteikarten-content";
const INDEX_URL = "content/index.json";

const SHELL_FILES = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/app.js",
  "js/begriffe.js",
  "js/cards.js",
  "js/quiz.js",
  "js/stats.js",
  "js/store.js",
  "js/sync.js",
  "js/tokens.js",
  "fonts/literata-latin-opsz-normal.woff2",
  "fonts/inter-latin-wght-normal.woff2",
  "icons/icon-180.png",
  "icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_FILES.map((url) => new Request(url, { cache: "reload" })));
    try {
      const res = await fetch(INDEX_URL, { cache: "no-store" });
      if (res.ok) await (await caches.open(CONTENT_CACHE)).put(INDEX_URL, res);
    } catch {
      // offline: der Kartenbestand wird beim nächsten Online-Start geladen
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== SHELL_CACHE && key !== CONTENT_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.endsWith("/" + INDEX_URL)) {
    event.respondWith(indexNetworkFirst(event));
  } else if (url.pathname.includes("/content/")) {
    event.respondWith(cacheFirst(CONTENT_CACHE, request));
  } else {
    event.respondWith(cacheFirst(SHELL_CACHE, request));
  }
});

async function indexNetworkFirst(event) {
  try {
    const res = await fetch(event.request, { cache: "no-store" });
    if (res.ok) {
      event.waitUntil((async () => (await caches.open(CONTENT_CACHE)).put(INDEX_URL, res.clone()))());
      return res;
    }
    throw new Error(String(res.status));
  } catch {
    const cached = await (await caches.open(CONTENT_CACHE)).match(INDEX_URL);
    return cached ?? Response.error();
  }
}

async function cacheFirst(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok && res.type === "basic") cache.put(request, res.clone());
    return res;
  } catch {
    if (request.mode === "navigate") {
      const shell = await cache.match("index.html");
      if (shell) return shell;
    }
    return Response.error();
  }
}
