import { VERSION } from './src/config.js';

const CACHE = `plushie-${VERSION}`;
const FILES = [
  './',
  './index.html',
  './game.css',
  './manifest.json',
  './src/config.js',
  './src/physics.js',
  './src/audio.js',
  './src/renderer.js',
  './src/input.js',
  './src/ui.js',
  './src/main.js',
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
  './Sprites/app_icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.clients.matchAll())
      .then(clients => clients.forEach(c => c.postMessage({ type: 'SW_UPDATED' })))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request))
  );
});