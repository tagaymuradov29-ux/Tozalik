// Oddiy service worker: ilovani "o'rnatiladigan" qiladi va ikonka/manifestni keshlaydi.
// Sahifalar va API har doim tarmoqdan olinadi (ma'lumot doim yangi).
const CACHE = "darsda-v1";
const ASSETS = ["/icon-192.png", "/icon-512.png", "/apple-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "GET" && ASSETS.includes(url.pathname)) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
  }
});
