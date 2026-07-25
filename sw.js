/* Posti — service worker v1 */
"use strict";

const SHELL = "posti-shell-v13";
const TILES = "posti-tiles-v13";
const TILE_LIMIT = 300;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png?v=3",
  "./icon-512.png?v=3",
  "./icon-180.png?v=3",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(SHELL).then(c => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function trimCache(name, limit) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > limit) {
    await cache.delete(keys[0]);
    return trimCache(name, limit);
  }
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // geocoding: solo rete, mai cache
  if (url.hostname.includes("photon.komoot.io") || url.hostname.includes("nominatim")) return;

  // tile OSM: stale-while-revalidate con limite
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(
      caches.open(TILES).then(async cache => {
        const cached = await cache.match(e.request);
        const network = fetch(e.request).then(resp => {
          if (resp && resp.ok) {
            cache.put(e.request, resp.clone());
            trimCache(TILES, TILE_LIMIT);
          }
          return resp;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // shell e font: cache-first con aggiornamento in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(resp => {
        if (resp && resp.ok && (url.origin === location.origin || url.hostname.includes("fonts.g") || url.hostname.includes("unpkg.com"))) {
          const copy = resp.clone();
          caches.open(SHELL).then(c => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
