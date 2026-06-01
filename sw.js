const CACHE = 'plushie-v12';
const FILES = [
  './index.html',
  './manifest.json',
  './Sprites/level_1.png',
  './Sprites/level_2.png',
  './Sprites/level_3.png',
  './Sprites/level_4.png',
  './Sprites/level_5.png',
  './Sprites/level_6.png',
  './Sprites/level_7.png',
  './Sprites/level_8.png',
  './Sprites/level_9.png',
  './Sprites/level_10.png',
  './Sprites/level_11.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network-first: always try the network, fall back to cache if offline
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
