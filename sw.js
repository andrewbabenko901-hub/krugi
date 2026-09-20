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

/* ---------- уведомления ----------
   Пуш приходит даже когда приложение закрыто и телефон заблокирован:
   здесь его показывают, а по нажатию открывают нужный экран. */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch { d = { t: 'Круги', b: e.data ? e.data.text() : '' }; }
  const tab = d.tab || 'today';
  e.waitUntil((async () => {
    await self.registration.showNotification(d.t || 'Круги', {
      body: d.b || '',
      icon: './icons/icon-180.png',
      badge: './icons/icon-180.png',
      tag: d.tag || 'krugi',
      renotify: true,
      timestamp: d.at || Date.now(),
      data: { tab },
    });
    // приложение открыто — пусть сразу сходит за свежими данными
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) c.postMessage({ krugi: 'push', tab });
  })());
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = (e.notification.data || {}).tab || 'today';
  e.waitUntil((async () => {
    const cs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of cs) {
      if (c.url.startsWith(self.registration.scope)) { c.postMessage({ krugi: 'open', tab }); return c.focus(); }
    }
    return self.clients.openWindow('./?tab=' + encodeURIComponent(tab));
  })());
});
