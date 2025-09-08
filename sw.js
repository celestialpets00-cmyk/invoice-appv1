// Simple offline cache (force refresh v3)
self.addEventListener("install", (e) => {
  self.skipWaiting(); // take over immediately
  e.waitUntil(
    caches.open("invoice-cache-v3").then((cache) =>
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

self.addEventListener("activate", (e) => {
  // delete old caches
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== "invoice-cache-v3").map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});


self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((resp) => resp || fetch(e.request))
  );
});
