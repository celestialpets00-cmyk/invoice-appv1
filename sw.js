// Simple offline cache
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("invoice-cache-v2").then((cache) =>
      cache.addAll([
        "./",
        "index.html",
        "style.css",
        "app.js",
        "manifest.json",
        "icons/icon-192.png",
        "icons/icon-512.png"
      ])
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((resp) => resp || fetch(e.request))
  );
});
