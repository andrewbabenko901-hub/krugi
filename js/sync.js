/* ============================================================
   Синхронизация через приватный репозиторий GitHub.

   Приложение лежит в публичном репозитории (GitHub Pages бесплатно
   работает только с публичным), а ДАННЫЕ — в отдельном приватном:
     data/andrey.json   — пишет только Андрей
     data/diana.json     — пишет только Диана
   Каждый телефон ходит в GitHub API со своим токеном, у которого есть
   доступ только к этому приватному репозиторию. Токен живёт в памяти
   браузера на устройстве и в код не попадает.

   Файл человека — это { profile, pub, sec }:
     pub — то, что видит пара: общие и «видно паре» круги, дела,
           отметки, покупки, планы, обещания, ответы, сводка по дням;
     sec — всё личное, зашифрованное ключом, которого у пары нет.
   ============================================================ */
import { b64enc, b64dec, utf8enc, utf8dec, seal, open, cryptoOk, newKey } from './crypto.js';
import { S, P, LISTS, setPartner, changed, other, saveLocal } from './store.js';
import { now } from './util.js';

const API = 'https://api.github.com';

/* Куда подключаться по умолчанию. Это не секрет: имя владельца и репозитория
   видно всем, кто откроет приложение. Секрет — только токен. */
export const DEFAULT_CFG = { owner: 'andrewbabenko901-hub', repo: 'krugi-data', dir: 'data' };

/* Готовая форма токена на GitHub. Имя, срок и права проставляются прямо в
   адресе — человеку остаётся выбрать репозиторий и нажать «Generate token». */
export const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new' +
  '?name=krugi-telefon&description=Krugi&contents=write&expires_in=none&target_name=' + DEFAULT_CFG.owner;
const LS_CFG = 'krugi3.sync', LS_KEY = me => 'krugi3.key.' + me, LS_META = me => 'krugi3.meta.' + me;

export function getCfg() { try { return JSON.parse(localStorage.getItem(LS_CFG) || 'null'); } catch { return null; } }
export function setCfg(c) { try { c ? localStorage.setItem(LS_CFG, JSON.stringify(c)) : localStorage.removeItem(LS_CFG); } catch {} }
export function getKey() { try { return localStorage.getItem(LS_KEY(S.me)) || ''; } catch { return ''; } }
export function setKey(k) { try { k ? localStorage.setItem(LS_KEY(S.me), k) : localStorage.removeItem(LS_KEY(S.me)); } catch {} }

/* Состояние синхронизации для шапки и экрана настроек. */
export const sync = { st: 'off', msg: 'не подключено', pulledAt: 0, pushedAt: 0, busy: false, needKey: false };
let meta = { sha: null, psha: null };
// Шифр личного с другого моего устройства, который здесь нечем открыть (нет ключа).
// Его нельзя затирать при записи — иначе личное с того устройства пропадёт.
let foreignSec = null;
function loadMeta() { try { meta = JSON.parse(localStorage.getItem(LS_META(S.me)) || 'null') || { sha: null, psha: null }; } catch {} }
function saveMeta() { try { localStorage.setItem(LS_META(S.me), JSON.stringify(meta)); } catch {} }

let onUpdate = () => {};
export function onSync(fn) { onUpdate = fn; }
function status(st, msg) { sync.st = st; sync.msg = msg; onUpdate('status'); }

export const ready = () => { const c = getCfg(); return !!(c && c.owner && c.repo && c.token); };
const filePath = who => (getCfg().dir || 'data') + '/' + who + '.json';

async function gh(path, opts = {}) {
  const c = getCfg();
  const url = API + '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + path;
  const r = await fetch(url, {
    cache: 'no-cache', ...opts,
    headers: { Authorization: 'Bearer ' + c.token.trim(), Accept: 'application/vnd.github+json',
               'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
  });
  return r;
}
function why(r, j) {
  if (r.status === 401) return 'токен не подошёл (401) — проверь, что он скопирован целиком и не истёк';
  if (r.status === 403) return 'нет прав (403) — у токена должно быть «Contents: Read and write» на этот репозиторий';
  if (r.status === 404) return 'репозиторий не найден (404) — проверь владельца и имя, и что токен выдан на него';
  return 'GitHub ответил ' + r.status + (j && j.message ? ': ' + j.message : '');
}

async function getFile(path) {
  const c = getCfg();
  const r = await gh('/contents/' + path + (c.branch ? '?ref=' + encodeURIComponent(c.branch) : ''));
  if (r.status === 404) return null;
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(why(r, j));
  let text;
  if (j.content && j.encoding === 'base64') text = utf8dec(b64dec(j.content));
  else {                                                  // больше мегабайта: забираем сырой файл
    const r2 = await gh('/contents/' + path + (c.branch ? '?ref=' + encodeURIComponent(c.branch) : ''),
                        { headers: { Accept: 'application/vnd.github.raw+json' } });
    text = await r2.text();
  }
  return { sha: j.sha, json: JSON.parse(text) };
}
async function putFile(path, obj, sha) {
  const c = getCfg();
  const body = { message: 'Круги: ' + S.people[S.me].name + ' · ' + new Date().toLocaleString('ru'),
                 content: b64enc(utf8enc(JSON.stringify(obj))) };
  if (sha) body.sha = sha;
  if (c.branch) body.branch = c.branch;
  const r = await gh('/contents/' + path, { method: 'PUT', body: JSON.stringify(body) });
  const j = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, sha: j && j.content && j.content.sha, j, r };
}

/* ---------- что личное ---------- */
function privateCircles() { return new Set(S.data.circles.filter(c => c.vis === 'prv').map(c => c.id)); }
function isPrivate(list, x, pc) {
  if (x.vis === 'prv' || x.sur) return true;
  if (list === 'tasks' && (x.prv || pc.has(x.c))) return true;
  return false;
}

/** Собрать свой файл: публичное отдельно, личное — в шифр. */
export async function buildFile(sum) {
  const pc = privateCircles();
  const privTasks = new Set(S.data.tasks.filter(t => isPrivate('tasks', t, pc)).map(t => t.id));
  const pub = {}, sec = {};
  for (const l of LISTS) {
    pub[l] = []; sec[l] = [];
    for (const x of S.data[l]) {
      if (isPrivate(l, x, pc)) {
        sec[l].push(x);
        // если вещь когда-то была видна паре, оставляем пустую заглушку с новым
        // временем — иначе у пары навсегда осталась бы старая открытая копия
        if (x.pubd) pub[l].push({ id: x.id, own: x.own, upd: x.upd, vis: 'prv', stub: 1 });
      } else { x.pubd = 1; pub[l].push(x); }
    }
  }
  pub.log = {}; sec.log = {};
  for (const id in S.data.log) (privTasks.has(id) ? sec.log : pub.log)[id] = S.data.log[id];
  pub.counts = {}; sec.counts = {};
  for (const id in S.data.counts) (pc.has(id) ? sec.counts : pub.counts)[id] = S.data.counts[id];
  for (const m of ['answers', 'rsvp', 'thanks', 'sealed']) pub[m] = S.data[m];
  sec.claims = S.data.claims;                   // кто что взялся подарить — всегда тайна
  pub.sum = sum ? { days: sum.days, streak: sum.streak, best: sum.best, xp: sum.xp, lvl: sum.lvl,
                    lvlName: sum.lvlName, badges: sum.badges, at: now() } : null;
  pub.ui = S.ui; pub.uiAt = S.uiAt || 0; pub.prefs = S.prefs;
  const key = getKey();
  const file = { app: 'krugi', v: 3, who: S.me, at: now(), profile: S.people[S.me], profileAt: S.profileAt || 0, pub, sec: null };
  if (foreignSec && sync.needKey) {
    // В базе лежит личное, зашифрованное другим ключом. Молча затереть его
    // нельзя — там могут быть записи с другого устройства. Переносим как есть
    // и ждём решения человека: принести тот ключ или начать личное заново.
    file.sec = foreignSec; file.secLocal = 1;
  } else if (key && cryptoOk) file.sec = await seal(sec, key);
  else { file.sec = foreignSec; file.secLocal = 1; }   // своё личное остаётся на устройстве
  return file;
}

/* ---------- приём своего файла (с другого своего устройства) ---------- */
function absorbLists(src) {
  let n = 0;
  for (const l of LISTS) for (const x of src[l] || []) {
    const arr = S.data[l], i = arr.findIndex(y => y.id === x.id);
    if (i < 0) { arr.push(x); n++; }
    // заглушка личного уступает настоящей записи того же времени (она приходит из шифра)
    else if ((x.upd || 0) > (arr[i].upd || 0) ||
             (arr[i].stub && !x.stub && (x.upd || 0) >= (arr[i].upd || 0))) { arr[i] = x; n++; }
  }
  for (const m of ['log', 'counts']) for (const id in src[m] || {}) {
    const o = S.data[m][id] || (S.data[m][id] = {});
    for (const d in src[m][id]) if (!o[d] || (src[m][id][d].at || 0) > (o[d].at || 0)) { o[d] = src[m][id][d]; n++; }
  }
  for (const m of ['answers', 'rsvp', 'thanks', 'sealed', 'claims']) for (const id in src[m] || {}) {
    const a = S.data[m][id], b = src[m][id];
    if (!a || (b.at || 0) > (a.at || 0)) { S.data[m][id] = b; n++; }
  }
  return n;
}
async function absorbOwn(file) {
  if (!file || !file.pub) return 0;
  let n = absorbLists(file.pub);
  if (file.profile && (file.profileAt || 0) > (S.profileAt || 0)) { S.people[S.me] = { ...S.people[S.me], ...file.profile }; S.profileAt = file.profileAt; }
  // главный экран и прочий вид — с другого своего устройства, если там правили позже
  if (file.pub.ui && (file.pub.uiAt || 0) > (S.uiAt || 0)) {
    const corder = S.ui.corder;
    S.ui = Object.assign(S.ui, file.pub.ui); S.uiAt = file.pub.uiAt;
    if (!S.ui.corder || !S.ui.corder.length) S.ui.corder = corder;
    n++;
  }
  if (file.pub.prefs) S.prefs = Object.assign(S.prefs, file.pub.prefs);
  if (file.sec) {
    const key = getKey();
    if (key && cryptoOk) {
      try { n += absorbLists(await open(file.sec, key)); sync.needKey = false; foreignSec = null; }
      catch { sync.needKey = true; foreignSec = file.sec; }
    } else { sync.needKey = true; foreignSec = file.sec; }
  }
  return n;
}

/* ---------- основной цикл ---------- */
let sumFn = () => null;
export function setSummary(fn) { sumFn = fn; }

let pushTimer = null, dirty = false, running = null;
export function schedulePush(ms = 2500) {
  dirty = true;
  if (!ready()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => cycle('push'), ms);
}

export async function cycle(kind = 'pull') {
  if (!ready()) { status('off', 'не подключено'); return; }
  if (running) { if (kind === 'push') dirty = true; return running; }
  running = (async () => {
    status('busy', 'синхронизация…');
    try {
      await pullOwn();
      if (dirty || kind === 'push' || kind === 'first') await pushOwn();
      await pullPartner();
      sync.pulledAt = now();
      status('ok', 'синхронизировано');
    } catch (e) {
      status('err', e.message || String(e));
    } finally {
      running = null;
      onUpdate('data');
    }
  })();
  return running;
}

async function pullOwn() {
  const f = await getFile(filePath(S.me));
  if (!f) { meta.sha = null; dirty = true; saveMeta(); return; }
  if (f.sha !== meta.sha) {
    const n = await absorbOwn(f.json);
    meta.sha = f.sha; saveMeta();
    if (n) { saveLocal(); changed('remote'); dirty = true; }
  }
}
async function pushOwn() {
  for (let attempt = 0; attempt < 4; attempt++) {
    const file = await buildFile(sumFn());
    const r = await putFile(filePath(S.me), file, meta.sha);
    if (r.ok) { meta.sha = r.sha; saveMeta(); saveLocal(); dirty = false; sync.pushedAt = now(); return; }
    if (r.status === 409 || r.status === 422) {          // файл изменился на другом моём устройстве
      const f = await getFile(filePath(S.me));
      meta.sha = f ? f.sha : null;
      if (f) await absorbOwn(f.json);
      continue;
    }
    throw new Error(why(r.r, r.j));
  }
  throw new Error('не удалось записать: файл всё время меняется');
}
async function pullPartner() {
  const f = await getFile(filePath(other(S.me)));
  if (!f) return;                                        // пара ещё не подключилась
  if (f.sha === meta.psha && P) return;
  meta.psha = f.sha; saveMeta();
  const j = f.json;
  setPartner({ at: j.at, profile: j.profile, pub: j.pub, sha: f.sha });
  changed('partner');
}

/* ---------- проверка подключения ---------- */
export async function testConnection(c) {
  const old = getCfg(); setCfg(c);
  try {
    const r = await gh('');
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(why(r, j));
    if (!j.private) return { ok: true, warn: 'Репозиторий ПУБЛИЧНЫЙ — данные будут видны всем. Сделай его приватным.' };
    if (j.permissions && !j.permissions.push) return { ok: false, msg: 'Токен только читает — нужна запись (Contents: Read and write).' };
    return { ok: true, msg: 'Доступ есть: ' + j.full_name + ' (приватный).' };
  } catch (e) {
    return { ok: false, msg: e.message };
  } finally { if (!c.keep) setCfg(old); }
}

/* ============================================================
   Настройка второго телефона одной ссылкой.

   Ссылка вида .../krugi/#n=<данные>. Якорь (после #) браузер на сервер
   не отправляет, поэтому токен не попадает ни в логи GitHub Pages, ни в
   историю запросов. Приложение читает его один раз и тут же вычищает из
   адресной строки.
   ============================================================ */
export function makeSetupLink(opts = {}) {
  const c = getCfg(); if (!c) return '';
  const payload = { o: c.owner, r: c.repo, d: c.dir || 'data', t: c.token };
  if (opts.who) payload.w = opts.who;
  if (opts.withKey) payload.k = getKey();
  const b64 = b64enc(utf8enc(JSON.stringify(payload))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return location.origin + location.pathname + '#n=' + b64;
}
export function readSetupLink() {
  const m = (location.hash || '').match(/[#&]n=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    const s = m[1].replace(/-/g, '+').replace(/_/g, '/');
    const j = JSON.parse(utf8dec(b64dec(s + '==='.slice((s.length + 3) % 4))));
    return j && j.t ? { owner: j.o, repo: j.r, dir: j.d || 'data', token: j.t, key: j.k || '', who: j.w || '' } : null;
  } catch { return null; }
}
export function clearSetupLink() {
  try { history.replaceState(null, '', location.pathname + location.search); } catch {}
}
export function applySetup(p) {
  setCfg({ owner: p.owner, repo: p.repo, dir: p.dir, token: p.token });
  if (p.key) setKey(p.key);
  else if (!getKey() && cryptoOk) setKey(newKey());
  clearSetupLink();
  start();
}

/** Личное в базе зашифровано ключом, которого здесь нет (например, первый
    вход случайно сделали во встроенном браузере мессенджера). Начинаем
    личное заново: новый ключ, старый шифр выбрасывается. */
export function resetSecret() {
  foreignSec = null;
  setKey(newKey());
  sync.needKey = false;
  schedulePush(0);
}

/* ---------- фон: опрос пары ---------- */
let poll = null;
export function start() {
  loadMeta();
  if (!ready()) { status('off', 'не подключено'); return; }
  cycle('first');
  clearInterval(poll);
  poll = setInterval(() => { if (document.visibilityState === 'visible') cycle('pull'); }, 25000);
}
document.addEventListener('visibilitychange', () => {
  if (!S || !ready()) return;
  if (document.visibilityState === 'visible') cycle('pull');
  else if (dirty) cycle('push');
});
addEventListener('online', () => { if (S && ready()) cycle('push'); });
