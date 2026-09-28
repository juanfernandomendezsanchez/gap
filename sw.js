// Gap service worker: abre al instante, con o sin internet.
// Estrategia: primero la copia guardada (inmediato) y en segundo plano busca la versión nueva.
const CACHE = 'gap-v2';
const FILES = ['./', './index.html', './styles.css', './app.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(cached => {
    const net = fetch(e.request).then(r => {
      if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return r;
    }).catch(() => cached || caches.match('./index.html'));
    if (cached) { e.waitUntil(net.catch(() => {})); return cached; }
    return net;
  }));
});
