/* ============================================================
   sw.js — Service Worker для Sqwid PWA
   ============================================================ */

const CACHE_NAME = "sqwid-v1";
const ASSETS = [
  "/",
  "/chat.html",
  "/index.html",
  "/chat.css",
  "/index.css",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png"
];

/* Установка — кэшируем основные ресурсы */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

/* Активация — удаляем старые кэши */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

/* Fetch — network-first, fallback на кэш */
self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // Пропускаем Firebase и внешние API
  if (
    url.includes("firebaseio.com") ||
    url.includes("googleapis.com") ||
    url.includes("gstatic.com") ||
    url.includes("qrserver.com") ||
    url.includes("microlink.io") ||
    url.includes("linkpreview.net")
  ) {
    return;
  }

  // Кэшируем только GET
  if (e.request.method !== "GET") return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, clone).catch(() => {});
          });
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

/* Обновление по команде */
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});