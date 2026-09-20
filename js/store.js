/* ============================================================
   Хранилище.

   У каждого человека свой файл данных. Андрей пишет только в свой,
   Диана — только в свой; читают оба. Поэтому двум телефонам нечего
   делить при записи и конфликтов записи не бывает.

   Общие вещи (общий круг, общее дело, совместная прогулка) могут
   править оба. Правка чужой общей вещи — это её копия в СВОЁМ файле
   с более свежей отметкой времени. При чтении обе стороны сводятся
   по правилу «кто позже, тот и прав» (LWW), и оба видят одно и то же.
   Удаление — тоже запись: пометка del с временем.
   ============================================================ */
import { uid, now, clone, todayKey, wkStartK } from './util.js';

export const PEOPLE = ['andrey', 'diana'];
export const PEOPLE_DEFAULT = {
  andrey: { name: 'Андрей', col: '#2F5BD0', g: 'm', bday: '' },
  diana:   { name: 'Диана',    col: '#B0517E', g: 'f', bday: '' },
};
export const other = id => id === 'andrey' ? 'diana' : 'andrey';

/* Списки сущностей: у каждой id, own (чья), upd (время правки), del, vis. */
export const LISTS = ['circles', 'groups', 'tasks', 'wishes', 'boards', 'events', 'dates',
                      'pledges', 'requests', 'goals', 'kudos', 'pokes', 'tpls'];
/* Карты по дням и ответы: у каждой записи своё время at. */
export const MAPS = ['log', 'counts', 'answers', 'rsvp', 'thanks', 'sealed', 'claims'];

/* Виджеты главного экрана: порядок и что включено по умолчанию. */
export const WIDGETS_DEFAULT = ['strip', 'hero', 'status', 'inbox', 'circles', 'wring', 'quick', 'pledges',
  'goal', 'partner', 'events', 'dates', 'shop', 'feed', 'badge', 'week', 'wish'];
const WIDGETS_OFF = ['week', 'wish'];

export const BOARDS_BUILTIN = [
  { id: 'home', n: 'По дому', i: '🧺' },
  { id: 'gift', n: 'Подарки', i: '🎁' },
  { id: 'want', n: 'Хочу', i: '✨' },
  { id: 'big',  n: 'Крупное', i: '🛋' },
];

function emptyData() {
  const d = {};
  for (const l of LISTS) d[l] = [];
  for (const m of MAPS) d[m] = {};
  return d;
}

export function defaultUI() {
  return {
    dash: WIDGETS_DEFAULT.map(id => ({ id, on: !WIDGETS_OFF.includes(id) })),
    cols: 0, scale: 1, dens: 'normal', theme: 'auto', corder: [], closed: [], recentEmo: [],
    face: 'ring',      // вид кругов: ring | dots | fill | arc | tile | bar
    wrn: 6,            // сколько недельных кругов показывать на главном
    csize: 1,          // размер круга: 0 мелкий, 1 средний, 2 крупный
    cw: 1,             // толщина кольца: 0..3
    cap: 1,            // подпись под кругом: 0 только название, 1 с делом, 2 без подписи
    fx: 1,             // движение и свет: 1 включено
    skin: 'paper',     // палитра оформления
    wk: { group: 'circle', heat: 1, tot: 1, weekend: 1, count: 1, once: 1, done: 1, partner: 1, priv: 1,
          sort: 'circle', fc: 'all', fw: 'all', sum: 1, rings: 1 },
    shopF: { who: 'all', left: 0, store: 'all' },
    stat: { per: 'week', fc: 'all', duo: 1 },
    wish: { board: 'all', who: 'all', st: 'open', sort: 'new' },
  };
}

export function seedState(me) {
  return {
    v: 3, me, people: clone(PEOPLE_DEFAULT), data: emptyData(),
    prefs: { ins: 2 }, ui: defaultUI(), seen: { feed: 0, note: 0 },
    push: { on: 0, subs: {} },          // подписки на уведомления, по устройствам
    firstDay: todayKey(), created: now(),
  };
}

/* ---------- состояние ---------- */
export let S = null;        // моё: всё, включая личное
export let P = null;        // файл пары: только её публичная часть

const K = {
  me: 'krugi3.me',
  st: me => 'krugi3.s.' + me,
  p: me => 'krugi3.p.' + me,
};

export function deviceMe() { try { return localStorage.getItem(K.me); } catch { return null; } }

export function loadState(me) {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(K.st(me)) || 'null'); } catch {}
  if (!s || s.v !== 3) {
    s = seedState(me);
    const old = migrateOld(me);
    if (old) Object.assign(s, old);
  }
  fixup(s);
  S = s;
  try { P = JSON.parse(localStorage.getItem(K.p(me)) || 'null'); } catch { P = null; }
  try { localStorage.setItem(K.me, me); } catch {}
  return S;
}

/* Поля, появившиеся позже: дополняем, ничего не теряя. */
function fixup(s) {
  const d = emptyData();
  for (const k in d) if (!s.data[k]) s.data[k] = d[k];
  // Вложенные наборы настроек собираем ДО общего слияния: иначе `u.wk` уже
  // заменён сохранённым объектом, и новые переключатели никогда не появятся
  // у того, у кого приложение стоит давно.
  const u = defaultUI(), nested = {};
  for (const k of ['wk', 'shopF', 'stat', 'wish']) nested[k] = Object.assign({}, u[k], (s.ui && s.ui[k]) || {});
  s.ui = Object.assign(u, s.ui || {});
  for (const k in nested) s.ui[k] = nested[k];
  // новые виджеты дописываются в конец выключенными — порядок человека не трогаем
  const have = new Set(s.ui.dash.map(x => x.id));
  // новое, что стоит показать, приходит включённым — порядок человека не трогаем
  for (const id of WIDGETS_DEFAULT) if (!have.has(id)) s.ui.dash.push({ id, on: !WIDGETS_OFF.includes(id) });
  s.ui.dash = s.ui.dash.filter(x => WIDGETS_DEFAULT.includes(x.id));
  const pp = s.people || {};
  s.people = {};
  for (const id of PEOPLE) s.people[id] = Object.assign(clone(PEOPLE_DEFAULT[id]), pp[id] || {});
  s.prefs = Object.assign({ ins: 2 }, s.prefs || {});
  s.seen = Object.assign({ feed: 0, note: 0 }, s.seen || {});
  s.push = Object.assign({ on: 0, subs: {} }, s.push || {});
  if (!s.push.subs || typeof s.push.subs !== 'object') s.push.subs = {};
}

export function saveLocal() {
  try { localStorage.setItem(K.st(S.me), JSON.stringify(S)); } catch {}
}
export function setPartner(file) {
  P = file;
  try { localStorage.setItem(K.p(S.me), JSON.stringify(file)); } catch {}
}
export function forgetDevice() {
  try { localStorage.removeItem(K.me); } catch {}
}
export function wipe(me) {
  try { localStorage.removeItem(K.st(me)); localStorage.removeItem(K.p(me)); } catch {}
}

/* ---------- изменения ---------- */
const listeners = [];
export function onChange(fn) { listeners.push(fn); }
export function changed(why = 'local') {
  S.rev = (S.rev || 0) + 1;
  if (why === 'ui') S.uiAt = now();          // вид экрана: кто правил позже, тот и прав
  saveLocal();
  for (const f of listeners) f(why);
}

/** Сохранить сущность (свою или копию общей). Служебные поля «_…» отбрасываются. */
export function put(list, obj, silent) {
  const o = {};
  for (const k in obj) if (k[0] !== '_') o[k] = obj[k];
  if (!o.id) o.id = uid();
  if (!o.own) o.own = S.me;
  o.upd = Math.max(now(), (obj.upd || 0) + 1);
  if (!o.cr) o.cr = o.upd;
  const arr = S.data[list];
  const i = arr.findIndex(x => x.id === o.id);
  if (i >= 0) arr[i] = o; else arr.push(o);
  if (!silent) changed();
  return o;
}
export function remove(list, obj) { return put(list, { ...obj, del: 1 }); }

export function setMark(tid, k, s) {
  const m = S.data.log[tid] || (S.data.log[tid] = {});
  m[k] = { s, at: now(), by: S.me };
  changed();
}
export function setCount(cid, k, v, note) {
  const m = S.data.counts[cid] || (S.data.counts[cid] = {});
  const e = { v, at: now(), by: S.me };
  if (note !== undefined) e.note = note; else if (m[k] && m[k].note) e.note = m[k].note;
  m[k] = e;
  changed();
}
export function setMap(map, id, val) {
  if (val === null) S.data[map][id] = { off: 1, at: now() };
  else S.data[map][id] = { ...val, at: now() };
  changed();
}

/* ---------- перенос из прототипа ----------
   Прототип хранил всё под ключом krugi-pro-v1. Если на телефоне уже что-то
   заполнено, забираем круги, дела, отметки, печати и настройки вида. */
export function oldPrototype() {
  try { const r = JSON.parse(localStorage.getItem('krugi-pro-v1') || 'null'); return r && r.circles ? r : null; }
  catch { return null; }
}
function migrateOld(me) {
  const o = oldPrototype();
  if (!o) return null;
  const you = other(me), t0 = now();
  const data = emptyData(), people = clone(PEOPLE_DEFAULT);
  if (o.me) people[me].name = o.me;
  if (o.you) people[you].name = o.you;
  const who = w => w === 'me' ? me : w === 'you' ? you : 'both';
  for (const c of o.circles || []) {
    data.circles.push({ id: c.id, own: me, n: c.n, i: c.i, col: c.col, k: c.k, u: c.u, g: c.g, stp: c.stp,
                        per: 'day', vis: c.sh ? 'shared' : 'pair', upd: t0, cr: t0 });
    if (c.log) for (const k in c.log) (data.counts[c.id] || (data.counts[c.id] = {}))[k] = { v: c.log[k], at: t0, by: me };
  }
  for (const t of o.tasks || []) {
    const days = Object.keys(t.log || {}).sort();
    const circ = (o.circles || []).find(c => c.id === t.c);
    // в личном круге «делает пара» смысла не имеет — такое дело остаётся своим
    const w = circ && !circ.sh && t.w === 'you' ? me : who(t.w);
    data.tasks.push({ id: t.id, own: me, c: t.c, n: t.n, w, r: t.r || null, d: t.d || null,
                      from: t.r ? (days[0] || todayKey()) : null, q: t.q || '', pr: t.pr || 0, st: t.st || '',
                      prv: t.prv ? 1 : 0, by: t.by || '', upd: t0, cr: t0 });
    for (const k of days) (data.log[t.id] || (data.log[t.id] = {}))[k] = { s: t.log[k], at: t0, by: me };
  }
  for (const k in o.sealed || {}) data.sealed[k] = { on: 1, at: t0 };
  if (o.goal) data.goals.push({ id: uid(), own: me, n: o.goal.n, need: o.goal.need, rw: o.goal.rw,
                                week: wkStartK(todayKey()), st: o.goal.done ? 'got' : 'active', vis: 'shared', upd: t0, cr: t0 });
  const ui = defaultUI();
  if (o.ui) {
    ui.scale = o.ui.scale || 1; ui.dens = o.ui.dens || 'normal';
    Object.assign(ui.wk, o.ui.wk || {}); Object.assign(ui.shopF, o.ui.shopF || {});
    ui.stat.per = (o.ui.stat && o.ui.stat.per) || 'week';
    if (o.ui.dash && o.ui.dash.cols) ui.cols = o.ui.dash.cols;
  }
  return { people, data, ui, prefs: { ins: typeof o.ins === 'number' ? Math.max(o.ins, 0) : 2 },
           migrated: t0, firstDay: firstKeyOf(data) || todayKey() };
}
function firstKeyOf(data) {
  let m = null;
  for (const id in data.log) for (const k in data.log[id]) if (!m || k < m) m = k;
  for (const id in data.counts) for (const k in data.counts[id]) if (!m || k < m) m = k;
  return m;
}

/* ---------- быстрый старт ---------- */
export function quickStart() {
  const mk = (n, i, col, k, extra) => put('circles', { id: uid(), n, i, col, k, vis: 'pair', per: 'day', ...extra }, true);
  mk('Дом', '🏠', '#2F5BD0', 'list', { vis: 'shared' });
  mk('Покупки', '🛒', '#C98A12', 'shop', { vis: 'shared' });
  mk('Вода', '💧', '#0E8C96', 'count', { u: 'мл', g: 2000, stp: 250 });
  mk('Шаги', '👟', '#1D8F5B', 'count', { u: 'шагов', g: 8000, stp: 500 });
  mk('Работа', '💼', '#8A55C4', 'count', { u: 'задач', g: 5, stp: 1 });
  mk('Настроение', '🌤', '#B0517E', 'mood', {});
  mk('Прогулки вместе', '🌳', '#1D8F5B', 'count', { u: 'раз', g: 3, stp: 1, per: 'week', vis: 'shared' });
  mk('Личное', '🔒', '#15161A', 'list', { vis: 'prv' });
  changed();
}

export function exportJSON() { return JSON.stringify({ app: 'krugi', v: 3, exported: now(), state: S }, null, 1); }
export function importJSON(text) {
  const j = JSON.parse(text);
  const s = j.state || j;
  if (!s || s.v !== 3 || !s.data) throw new Error('это не файл «Кругов»');
  if (s.me !== S.me) throw new Error('файл другого человека: ' + s.me);
  fixup(s); S = s; changed('import');
}
