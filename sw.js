/* Сервис-воркер: приложение открывается и без сети.
   Сначала сеть (с проверкой свежести), кэш — только если сети нет.
   Запросы к GitHub API не трогаем вовсе: данные всегда живые. */
const CACHE = 'krugi-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname === 'api.github.com') return;
  const same = u.origin === location.origin, fonts = /fonts\.(googleapis|gstatic)\.com$/.test(u.hostname);
  if (!same && !fonts) return;
  e.respondWith(
    fetch(e.request, same ? { cache: 'no-cache' } : {}).then(r => {
      if (r.ok || r.type === 'opaque') { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: same }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./index.html', { ignoreSearch: true }) : undefined)))
  );
});
