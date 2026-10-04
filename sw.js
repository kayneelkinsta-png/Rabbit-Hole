// Rabbit Hole's service worker: always ask the network first for the app's own files, so updates show on the
// very next open (even from the home screen), and fall back to the last saved copy when there's no signal.
// Wikipedia, pictures and the 3D library are left alone and go straight to the network.
const CACHE = 'rh-v2';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/core.js', 'js/strings.js', 'js/wiki.js', 'js/topics.js', 'js/papers.js', 'js/draw.js', 'js/glass.js', 'js/fx.js', 'js/rabbit.js', 'js/hud.js', 'js/reader.js', 'js/input.js', 'js/tour.js', 'js/notebook.js', 'css/notebook.css', 'intro.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('index.html')))
  );
});
