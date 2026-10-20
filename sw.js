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
  './Sprites/characters/level_1.png',
  './Sprites/characters/level_2.png',
  './Sprites/characters/level_3.png',
  './Sprites/characters/level_4.png',
  './Sprites/characters/level_5.png',
  './Sprites/characters/level_6.png',
  './Sprites/characters/level_7.png',
  './Sprites/characters/level_8.png',
  './Sprites/characters/level_9.png',
  './Sprites/characters/level_10.png',
  './Sprites/characters/level_11.png',
  './Sprites/icons/app_icon.png',
  './Sprites/icons/app_install_icon.png',
  './Sprites/ui/joystick_released.png',
  './Sprites/ui/joystick_tilted.png',
  './Sprites/ui/button_released.png',
  './Sprites/ui/button_pressed.png',
  './Sprites/ui/checkbox_bg.png',
  './Sprites/ui/checkbox_tick.png',
  './Sprites/claw/claw_back.png',
  './Sprites/claw/claw_front.png',
  './Sprites/claw/claw_open.png',
  './Sprites/machine/claw_machine_top_tile.png',
  './Sprites/machine/claw_machine_middle_tile.png',
  './Sprites/machine/claw_machine_bottom_tile.png',
  './Sprites/machine/claw_machine_score_next_bg.png',
  './Sprites/machine/claw_machine_floor_tile.png',
  './Sprites/machine/claw_machine_top_left_reflection_cover.png',
  './Sprites/machine/claw_machine_bottom_left_reflection_cover.png',
  './Audio/Upbeat.mp3',
  './Audio/Names_Bap.mp3',
  './Audio/Names_Bong.mp3'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      await Promise.all(
        FILES.map(url =>
          cache.add(url).catch(err => {
            console.warn(`[SW] Failed to cache: ${url}`, err);
          })
        )
      );
    })
  );
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
  if (!e.request.url.startsWith('http')) return;
  if (e.request.method !== 'GET') return;
  if (e.request.headers.has('range')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});