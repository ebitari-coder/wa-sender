/* WA Sender service worker — offline-capable PWA shell. */
const VERSION = "wa-sender-v2";
const CORE_ASSETS = [
  "/",
  "/dashboard",
  "/login",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-192-maskable.png",
  "/icons/icon-512-maskable.png",
  "/icons/splash-logo.png",
  "/icons/apple-touch-icon.png",
  "/icons/mstile-150x150.png",
  "/manifest.webmanifest",
  "/browserconfig.xml",
  "/splash/apple-touch-startup-image-640x1136.png",
  "/splash/apple-touch-startup-image-750x1334.png",
  "/splash/apple-touch-startup-image-828x1792.png",
  "/splash/apple-touch-startup-image-1125x2436.png",
  "/splash/apple-touch-startup-image-1170x2532.png",
  "/splash/apple-touch-startup-image-1242x2688.png",
  "/splash/apple-touch-startup-image-1284x2778.png",
  "/splash/apple-touch-startup-image-1290x2796.png",
  "/splash/apple-touch-startup-image-1620x2160.png",
  "/splash/apple-touch-startup-image-1668x2388.png",
  "/splash/apple-touch-startup-image-2048x2732.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API routes.
  if (url.pathname.startsWith("/api")) {
    event.respondWith(fetch(request).then((res) => res).catch(() => new Response("", { status: 503 })));
    return;
  }

  // Navigation: network-first with cache fallback (offline shell).
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((cache) => cache.put("/", copy));
          return res;
        })
        .catch(() =>
          caches.match("/").then((cached) => cached || caches.match(request)),
        ),
    );
    return;
  }

  // Static assets: cache-first.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons") || url.pathname.startsWith("/splash"))) {
            const copy = res.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return res;
        }),
    ),
  );
});
