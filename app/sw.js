/* ============================================================
   GhostFace Studio — service worker: offline app shell cache.

   Caches the client-side app (HTML/CSS/JS, fonts, sample
   photos) on first visit so the page keeps working offline
   after the first load. (Image generation itself needs the
   network — it calls the Gemini API.)
   Bump CACHE_NAME when shipping a new build.
   ============================================================ */

const CACHE_NAME = 'ghostface-v1';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './vendor/fonts/fonts.css',
  './vendor/fonts/jakarta-italic-400800.woff2',
  './vendor/fonts/jakarta-normal-400800.woff2',
  './assets/sample-1.jpg',
  './assets/sample-2.jpg',
  './assets/sample-3.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Never cache API calls — only our own static shell.
  if (!url.href.startsWith(self.location.origin)) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request))
  );
});
