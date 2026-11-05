// Network-first לקבצי האתר עצמו, עם גיבוי מהמטמון כשאין אינטרנט.
// בקשות לשרתים חיצוניים (Firestore, יוטיוב, גוגל) לא עוברות דרך ה-SW בכלל.
const CACHE_NAME = "saba-v5";
const CORE = [
  "./",
  "./index.html",
  "./episode.html",
  "./style.css",
  "./script.js",
  "./data.js",
  "./firebase.js",
  "./episodes.json",
  "./manifest.json",
  "./img/hero.jpg",
  "./img/logo.jpg",
  "./img/coming-soon.jpg",
  "./img/icon-192.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // קבצי PDF גדולים - לא שומרים במטמון
  if (req.url.toLowerCase().endsWith(".pdf")) return;

  event.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: req.mode === "navigate" }))
  );
});
