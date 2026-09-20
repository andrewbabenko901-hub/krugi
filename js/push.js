/* ============================================================
   Уведомления на телефон: включение на этом устройстве и отправка паре.

   Каждое устройство подписывается само и кладёт свою подписку в свой же
   файл, рядом с ключами VAPID этой подписки. У Андрея может быть телефон и
   компьютер — подписок несколько, поэтому они лежат словарём по устройству,
   и сверка берёт по каждому устройству запись посвежее.

   Ключи лежат в приватном репозитории, куда ходят только два телефона с
   личными токенами. Тот, у кого есть подписка пары, может прислать ей
   уведомление — это ровно то, что нам и нужно.
   ============================================================ */
import { S, P, changed, saveLocal } from './store.js';
import { now } from './util.js';
import { newKeys, unb64u, b64u, pushTo } from './wpush.js';

const LS_DEV = 'krugi3.dev';
export function devId() {
  try {
    let d = localStorage.getItem(LS_DEV);
    if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem(LS_DEV, d); }
    return d;
  } catch { return 'dev'; }
}
function devName() {
  const u = navigator.userAgent || '';
  const os = /iPhone/.test(u) ? 'айфон' : /iPad/.test(u) ? 'айпад' : /Android/.test(u) ? 'андроид'
    : /Mac OS X/.test(u) ? 'мак' : /Windows/.test(u) ? 'компьютер' : 'устройство';
  const home = !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
  return os + (home ? ' (с рабочего стола)' : ' (браузер)');
}

export const supported = () => typeof window !== 'undefined' &&
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const permission = () => (typeof Notification === 'undefined' ? 'нет' : Notification.permission);
/** Подписка этого устройства, если она есть. */
export function mine() {
  const p = S && S.push;
  const m = p && p.subs && p.subs[devId()];
  return m && !m.off ? m : null;
}
export const onHere = () => !!mine();
/** Все живые подписки человека (свои или пары). */
export function subsOf(p) {
  const out = [];
  if (!p || !p.subs) return out;
  for (const id in p.subs) { const s = p.subs[id]; if (s && !s.off && s.sub && s.pub && s.prv) out.push({ id, ...s }); }
  return out;
}
export const partnerOn = () => subsOf(P && P.push).length > 0;

/** Почему уведомления недоступны — текстом, который можно показать. */
export function blocker() {
  const home = !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches);
  const ios = /iPhone|iPad/.test(navigator.userAgent || '');
  if (!supported()) {
    return ios && !home
      ? 'На айфоне уведомления работают, только если приложение добавлено на рабочий стол: «Поделиться» → «На экран Домой», и открывать уже оттуда.'
      : 'Этот браузер не умеет уведомления.';
  }
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
    return 'Уведомления работают только по https.';
  if (permission() === 'denied')
    return 'Уведомления для «Кругов» запрещены в настройках телефона. Разреши их там и вернись.';
  return '';
}

/* ---------- включить на этом устройстве ---------- */
export async function enable() {
  const stop = blocker();
  if (stop) throw new Error(stop);
  // Разрешение спрашиваем первым делом. В Safari на айфоне окно с вопросом
  // показывается, только пока «живо» нажатие пальца: любое ожидание до него —
  // и вопрос не появится вовсе.
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Разрешение не дано — уведомления приходить не будут.');
  const reg = await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;

  const old = (S.push && S.push.subs && S.push.subs[devId()]) || null;
  const k = old && old.pub && old.prv ? { pub: old.pub, prv: old.prv } : await newKeys();
  let sub = await reg.pushManager.getSubscription();
  if (sub) {                                   // подписка от другого ключа не подойдёт — переподписываемся
    let cur = '';
    try { cur = sub.options && sub.options.applicationServerKey ? b64u(sub.options.applicationServerKey) : ''; } catch {}
    if (cur !== k.pub) { try { await sub.unsubscribe(); } catch {} sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(k.pub) });

  const p = S.push || (S.push = { on: 1, subs: {} });
  p.on = 1; p.subs = p.subs || {};
  p.subs[devId()] = { pub: k.pub, prv: k.prv, sub: sub.toJSON(), at: now(), ua: devName() };
  changed('local');                            // сохранится и уедет в общую базу
  return true;
}

/* ---------- выключить ---------- */
export async function disable() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  } catch {}
  const p = S.push || (S.push = { on: 0, subs: {} });
  // Метка «выключено» вместо удаления: иначе при следующей сверке старая
  // подписка приедет обратно из базы и пара снова начнёт слать сюда.
  p.subs[devId()] = { at: now(), off: 1, ua: devName() };
  p.on = subsOf(p).length ? 1 : 0;
  changed('local');
  return true;
}

/* ---------- отправка ---------- */
/* Чем закончилась последняя отправка — чтобы на экране уведомлений было
   видно, дошло или нет, а не гадать по молчанию телефона. */
export const pushState = { at: 0, ok: 0, msg: '' };
function mark(rs) {
  const good = rs.find(r => r.ok), bad = rs.find(r => !r.ok);
  pushState.at = Date.now();
  pushState.ok = good ? 1 : 0;
  pushState.msg = good ? 'ушло' : (bad && bad.msg) || 'не ушло';
  return !!good;
}

/** Прислать паре уведомление. Тихо ничего не делает, если пара их не включила. */
export function notifyPartner(title, body, tab) {
  const list = subsOf(P && P.push);
  if (!list.length) return Promise.resolve(false);
  const data = { t: title, b: body, tab: tab || 'today', at: Date.now() };
  return Promise.all(list.map(t => pushTo(t, data).catch(e => ({ ok: false, msg: String(e && e.message || e) }))))
    .then(rs => {
      const dead = rs.filter(r => r.gone).length;
      if (dead) console.warn('подписки пары устарели:', dead);
      return mark(rs);
    });
}
/** Проверка: присылаем уведомление самому себе. */
export async function selfTest() {
  const list = subsOf(S.push);
  if (!list.length) return { ok: false, msg: 'на этом устройстве уведомления не включены' };
  const r = await pushTo(list[0], { t: '🔔 Круги', b: 'Проверка: уведомления доходят.', tab: 'today', at: Date.now() });
  if (!r.ok && r.gone) { S.push.subs[list[0].id] = { at: now(), off: 1 }; saveLocal(); }
  mark([r]);
  return r;
}
