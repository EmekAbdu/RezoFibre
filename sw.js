/* REZO FIBRE Facturation — service worker
   HTML : network-first (version fraiche en ligne, cache en secours hors ligne)
   Statique : cache-first
   Cross-origin : jamais intercepte */
const CACHE = 'rezofibre-fact-v4';
const ASSETS = ['./', 'REZO_FIBRE.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let url; try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  const isDoc = req.mode === 'navigate' || req.destination === 'document';
  if (isDoc) {
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)).catch(()=>{}); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('./') || caches.match('REZO_FIBRE.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(k => k.put(req, c)).catch(()=>{}); return res; })));
});
