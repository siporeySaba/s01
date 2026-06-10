const CACHE_NAME = "saba-v4";

self.addEventListener("install", event => {
  self.skipWaiting(); // 🔥 מכריח הפעלה מיידית
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        "./",
        "./index.html",
        "./episode.html",
        "./style.css",
        "./script.js",
        "./manifest.json"
      ]);
    })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    ).then(() => self.clients.claim()) // 🔥 משתלט מיד על הדפים
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
