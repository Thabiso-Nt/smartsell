// Minimal service worker — just enough to make SmartSell installable.
// It doesn't cache anything yet (that's a future improvement for real
// offline support), it just needs to exist and handle the fetch event
// for browsers to consider the app installable.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Pass-through for now — no offline caching yet.
});
