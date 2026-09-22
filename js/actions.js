/* ============================================================
   Действия: что происходит по нажатию.
   Каждая кнопка несёт data-a="имя" и данные в data-*; здесь — таблица
   имя → обработчик. Изменения данных идут только через store (put,
   setMark, setCount, setMap), дальше всё само: сохранение, перерисовка,
   отправка в общую базу.
   ============================================================ */
import { uid, now, addK, wkStartK, domainOf, pln } from './util.js';
import { S, put, remove, setMark, setCount, setMap, changed, saveLocal, quickStart, defaultUI, exportJSON, importJSON, other, loadState, wipe, forgetDevice } from './store.js';
import { W, nav, rebuild } from './ctx.js';
import { toast, buzz, confetti, openSheet, closeSheet, refreshSheet, val, sheet } from './ui.js';
import * as SH from './sheets.js';
import { F, E, Q, BUILTIN_TPL, planDate, listCircles } from './v_plan.js';
import { sheetWkSet } from './v_week.js';
import { sheetDash } from './v_more.js';
import { WIDGETS } from './v_main.js';
import { sync, setCfg, getCfg, getKey, setKey, testConnection, cycle, start as startSync, ready,
         DEFAULT_CFG, makeSetupLink, readSetupLink, parseSetupText, clearSetupLink, applySetup, resetSecret } from './sync.js';
import { newKey, keyLooksValid, cryptoOk } from './crypto.js';
import { DEFG, DEFS, EMO, PAL } from './parts.js';
import { forgetMoves } from './faces.js';
import * as PUSH from './push.js';
import * as NOTE from './note.js';
import * as SHOP from './shop.js';

let render = () => {};
export function setRender(fn) { render = fn; }

const A = {};
export default A;

/* Настройка, пришедшая ссылкой: ждёт одного нажатия «чей это телефон». */
let pendingSetup = readSetupLink();
export const getPending = () => pendingSetup;

/* ---------- навигация ---------- */
A.tab = d => {
  closeSheet(); nav.tab = d.v;
  if (d.v !== 'today') nav.edit = false;               // ушёл с главного — правка кончилась
  if (d.v === 'more') nav.more = 'menu';               // «Ещё» всегда открывает меню
  if (d.v === 'pair') { S.seen.feed = now(); NOTE.markAll(); saveLocal(); }   // открыл «Вместе» — всё увидел
  render(); scrollTo(0, 0); buzz(8);
};
A.more = d => {
  closeSheet(); nav.tab = 'more'; nav.more = d.v; render(); scrollTo(0, 0); buzz(8);
  // Экран уведомлений всегда открывается со свежим файлом пары
  if (d.v === 'note' && ready()) cycle('pull').then(() => render()).catch(() => {});
};
A.day = d => { nav.VD = d.v; nav.tab = 'today'; render(); buzz(8); };
A.shift = d => { nav.VD = addK(nav.VD, +d.v); render(); buzz(8); };
A.close = () => closeSheet();

/* ---------- отметки дел ---------- */
function afterMark(t, k, wasFull) {
  // просьба пары, взятая в работу, — сказать ей, что сделано
  if (t.req && W.isDone(t, k) && S.data.answers[t.req] && !S.data.answers[t.req].done)
    setMap('answers', t.req, { ...S.data.answers[t.req], done: 1 });
  const c = W.circleById[t.c];
  if (c && W.isDone(t, k) && W.prog(c, k).p >= 1) {
    buzz([10, 40, 10]);
    if (S.ui.fx && k === W.today) confetti([c.col, c.col, W.col(W.me)]);   // круг закрыт — маленький салют
  }
  if (!wasFull && W.full(W.me, k) && k === W.today) {
    setTimeout(() => { confetti([W.col(W.me), '#1D8F5B', '#C98A12']); toast('День закрыт целиком. Серия: ' + W.sum().streak + '.'); buzz([12, 60, 20]); }, 250);
  }
}
A.tk = d => {
  const t = W.taskById[d.id], k = d.k || nav.VD; if (!t) return;
  if (k > W.today) { toast('Отметить можно в тот день, не раньше.'); return; }
  const wasFull = W.full(W.me, k), cur = W.st(t, k);
  setMark(t.id, k, cur === 'done' || cur === 'ins' ? 'open' : 'done');
  buzz(12); afterMark(W.taskById[d.id], k, wasFull);
};
A.wc = d => {
  const t = W.taskById[d.id]; if (!t) return;
  if (d.k > W.today) { toast('Отметить можно в тот день, не раньше.'); return; }
  const wasFull = W.full(W.me, d.k), cur = W.st(t, d.k);
  setMark(t.id, d.k, cur === 'open' ? 'done' : cur === 'done' ? 'fail' : 'open');
  buzz(10); afterMark(W.taskById[d.id], d.k, wasFull);
};
A.fail = d => { setMark(d.id, d.k || nav.VD, 'fail'); buzz(10); toast('Записано как «сдался». Честно — это тоже результат.'); };
A.ins = d => {
  const k = nav.VD, left = W.insLeft(k);
  if (!left) { toast('Страховки на эту неделю кончились.'); return; }
  const op = W.tasksOf(d.id, k).filter(t => !W.isDone(t, k) && W.isMineToDo(t));
  if (!op.length) { toast('В этом круге и так всё закрыто.'); return; }
  const wasFull = W.full(W.me, k);
  for (const t of op) { const m = S.data.log[t.id] || (S.data.log[t.id] = {}); m[k] = { s: 'ins', at: now(), by: S.me }; }
  changed(); buzz(14); toast('Круг закрыт страховкой. Осталось ' + (left - 1) + '.');
  afterMark(op[0], k, wasFull);
};

/* ---------- круг: шторка ---------- */
A.circle = d => { SH.CS.gw = null; SH.CS.prv = 0; openSheet(SH.sheetCircle, [d.id], true); buzz(10); };
const openCircle = () => sheet.args && sheet.args[0];
A.cadd = d => {
  const c = W.circleById[openCircle()]; if (!c) return;
  const wasFull = W.full(W.me, nav.VD);
  setCount(c.id, nav.VD, Math.max(0, W.cval(c, nav.VD) + +d.v)); buzz(10);
  if (W.cval(c, nav.VD) >= c.g && c.per !== 'week' && W.cval(c, nav.VD) - +d.v < c.g) toast(c.i + ' Цель «' + c.n + '» взята.');
  if (c.per === 'week' && W.cweek(c, nav.VD) >= c.g && W.cweek(c, nav.VD) - +d.v < c.g) { confetti([c.col]); toast(c.i + ' Недельная цель «' + c.n + '» взята!'); }
  checkFull(wasFull);
};
A.cfull = () => { const c = W.circleById[openCircle()]; if (!c) return; const wasFull = W.full(W.me, nav.VD); setCount(c.id, nav.VD, c.g); buzz(14); checkFull(wasFull); };
A.cexact = () => {
  const c = W.circleById[openCircle()], v = Number(val('cexact'));
  if (!c || !isFinite(v) || v < 0) { toast('Нужно число.'); return; }
  const wasFull = W.full(W.me, nav.VD); setCount(c.id, nav.VD, Math.round(v)); checkFull(wasFull);
};
function checkFull(wasFull) {
  if (!wasFull && W.full(W.me, nav.VD) && nav.VD === W.today)
    setTimeout(() => { confetti(); toast('День закрыт целиком. Серия: ' + W.sum().streak + '.'); }, 250);
}
/* Плюс прямо в ячейке: шаг счётчика, без шторки. */
A.cquick = (d, el) => {
  const c = W.circleById[d.id]; if (!c || c.k !== 'count') return;
  const wasFull = W.full(W.me, nav.VD), was = W.prog(c, nav.VD).p >= 1;
  setCount(c.id, nav.VD, Math.max(0, W.cval(c, nav.VD) + (+c.stp || 1)));
  buzz(10);
  const now2 = W.prog(c, nav.VD).p >= 1;
  if (!was && now2) { if (S.ui.fx) confetti([c.col, c.col, W.col(W.me)]); toast('«' + c.n + '» — цель взята.'); }
  checkFull(wasFull);
  void el;
};
A.mood = d => {
  const wasFull = W.full(W.me, nav.VD);
  const cur = W.cval(W.circleById[d.id], nav.VD);
  setCount(d.id, nav.VD, cur === +d.v ? 0 : +d.v); buzz(10); checkFull(wasFull);
};
A.mnote = d => { setCount(d.id, nav.VD, W.cval(W.circleById[d.id], nav.VD), val('mnote')); toast('Записано.'); };
A.gw = d => { SH.CS.gw = d.v; refreshSheet(true); };
A.gprv = d => { SH.CS.prv = +d.v; refreshSheet(true); };
A.gadd = () => {
  const cid = openCircle(), c = W.circleById[cid], n = val('gi');
  if (!n) { document.getElementById('gi').focus(); return; }
  const w = c._shared ? (SH.CS.gw || W.me) : W.me;
  put('tasks', { c: cid, n, w, r: null, d: nav.VD, q: '', pr: 0, st: '', prv: SH.CS.prv ? 1 : 0 });
  buzz(10); toast('Добавлено на ' + (nav.VD === W.today ? 'сегодня' : 'этот день') + '.');
  setTimeout(() => { const i = document.getElementById('gi'); if (i) i.focus(); }, 30);
};
A.sf = d => { const [k, ...r] = d.v.split(':'), v = r.join(':'); S.ui.shopF[k] = k === 'left' ? +v : v; changed('ui'); };
A.carry = d => {
  let moved = 0;
  for (const t of W.tasksOf(d.id, nav.VD)) if (!W.isDone(t, nav.VD) && !t.r) { put('tasks', { ...t, d: addK(nav.VD, 1) }, true); moved++; }
  changed(); toast(moved ? 'Перенесено на завтра: ' + moved + '.' : 'Нечего переносить.');
};

/* ---------- дело: редактор ---------- */
let TF = null;
A.edit = d => {
  const t = W.taskById[d.id]; if (!t) return;
  TF = JSON.parse(JSON.stringify(t));
  closeSheet(); openSheet(SH.sheetTask, [TF]); buzz(8);
};
function readTF() {
  const n = val('en'); if (n) TF.n = n;
  if (document.getElementById('eq')) TF.q = val('eq');
  if (document.getElementById('epr')) TF.pr = +val('epr') || 0;
  if (document.getElementById('est')) TF.st = val('est');
}
A.ec = d => { readTF(); TF.c = d.v; refreshSheet(true); };
A.ew = d => { readTF(); TF.w = d.v; refreshSheet(true); };
A.eprv = d => { readTF(); TF.prv = +d.v; refreshSheet(true); };
A.ed = d => {
  readTF(); TF.r = TF.r || [0, 0, 0, 0, 0, 0, 0]; TF.r[+d.v] = TF.r[+d.v] ? 0 : 1;
  if (TF.r.every(x => !x)) { TF.r = null; TF.from = null; if (!TF.d) TF.d = nav.VD; }
  else { TF.d = null; if (!TF.from) TF.from = W.today; }
  refreshSheet(true);
};
A.esave = () => { readTF(); put('tasks', TF); closeSheet(); buzz(12); toast('Сохранено.'); };
A.emove = () => { readTF(); TF.r = null; TF.d = addK(nav.VD, 1); put('tasks', TF); closeSheet(); toast('Перенесено на следующий день.'); };
A.edup = () => { readTF(); const c = { ...TF, id: uid(), n: TF.n + ' (копия)', cr: 0, own: S.me }; delete c.pubd; put('tasks', c); closeSheet(); toast('Дубликат создан.'); };
A.edel = () => {
  const t = W.taskById[TF.id]; if (!t) return closeSheet();
  if (!t.r && t.d && W.sealed(t.d)) { toast('Дело запечатанного дня удалить нельзя — только «сдаться».'); return; }
  if (t.r) put('tasks', { ...t, to: W.today }); else remove('tasks', t);
  closeSheet(); buzz(10); toast(t.r ? 'Убрано из будущих дней. История осталась.' : 'Удалено.');
};

/* ---------- настройка круга ---------- */
A.csetup = d => { SH.newCF(d.id); closeSheet(); openSheet(SH.sheetCircleSetup); };
/* ---------- эмодзи ---------- */
A.emoopen = d => {
  if (d.v === 'circle') readCF(); else readGF();
  SH.emoSt.on = d.v; SH.emoSt.q = '';
  openSheet(SH.sheetEmoji, [], true);
};
A.emotab = d => { SH.emoSt.tab = +d.v; SH.emoSt.q = ''; refreshSheet(true); const s = document.getElementById('sheet'); if (s) s.scrollTop = 0; };
A.emotone = d => { S.ui.tone = +d.v; changed('ui'); refreshSheet(true); buzz(6); };
A.emoq = (d, el) => { SH.emoSt.q = el.value; refreshSheet(true); const i = document.getElementById('emoq'); if (i) { i.focus(); i.selectionStart = i.value.length; } };
A.emopick = d => {
  const e = d.v;
  const r = (S.ui.recentEmo || []).filter(x => x !== e); r.unshift(e); S.ui.recentEmo = r.slice(0, 24);
  if (SH.emoSt.on === 'group') { SH.GF.i = e; closeSheet(); openSheet(SH.sheetGroup); }
  else { SH.CF.i = e; closeSheet(); openSheet(SH.sheetCircleSetup); }
  changed('ui'); buzz(8);
};
A.emoclose = () => {
  if (SH.emoSt.on === 'group') { closeSheet(); openSheet(SH.sheetGroup); }
  else { closeSheet(); openSheet(SH.sheetCircleSetup); }
};
/* ---------- папки кругов ---------- */
function readGF() {
  const g = SH.GF; if (!g) return;
  if (document.getElementById('gn2')) g.n = val('gn2');
}
A.gnew2 = () => { readCF(); SH.newGF(null); closeSheet(); openSheet(SH.sheetGroup); };
A.gedit = d => { SH.newGF(d.id); closeSheet(); openSheet(SH.sheetGroup); };
A.gcol = d => { readGF(); SH.GF.col = PAL[+d.v]; refreshSheet(true); };
A.gvis = d => { readGF(); SH.GF.vis = d.v; refreshSheet(true); };
A.gsave2 = () => {
  readGF(); const g = SH.GF;
  g.n = g.n || 'Папка';
  const isNew = g._new; delete g._new;
  const o = put('groups', g);
  closeSheet();
  if (isNew && SH.CF) { SH.CF.grp = o.id; openSheet(SH.sheetCircleSetup); }
  toast(isNew ? 'Папка «' + o.n + '» создана.' : 'Папка обновлена.');
};
A.gdel2 = (d, el) => {
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно удалить папку?'; return; }
  const g = W.groupById[SH.GF.id];
  if (g) { for (const c of W.circles) if (c.grp === g.id) put('circles', { ...c, grp: '' }, true); remove('groups', g); }
  closeSheet(); toast('Папка удалена, круги остались.');
};
A.cgrp = d => { readCF(); SH.CF.grp = d.v; refreshSheet(true); };
A.cper = d => { readCF(); SH.CF.per = d.v; refreshSheet(true); };
A.cday = d => {
  readCF(); const c = SH.CF;
  c.days = c.days || [1, 1, 1, 1, 1, 1, 1];
  c.days[+d.v] = c.days[+d.v] ? 0 : 1;
  if (!c.days.some(Boolean)) c.days[+d.v] = 1;         // хотя бы один день должен остаться
  refreshSheet(true);
};
A.ccolin = (d, el) => { readCF(); SH.CF.col = el.value; refreshSheet(true); };
A.cfold = d => {                                        // свернуть/развернуть папку на главном
  const list = S.ui.closed || (S.ui.closed = []);
  const i = list.indexOf(d.v);
  if (i < 0) list.push(d.v); else list.splice(i, 1);
  changed('ui');
};
A.cnew = () => { SH.newCF(null); closeSheet(); openSheet(SH.sheetCircleSetup); };
function readCF() {
  const CF = SH.CF; if (!CF) return;
  if (document.getElementById('cn')) CF.n = val('cn');
  if (document.getElementById('cg')) CF.g = Math.max(0.01, +val('cg') || 1);
  if (document.getElementById('cstp')) CF.stp = Math.max(0.01, +val('cstp') || 1);
  if (document.getElementById('cuf')) { const u = val('cuf'); if (u) CF.u = u; }
  if (document.getElementById('cnote')) CF.note = val('cnote');
  if (document.getElementById('ccol')) CF.col = document.getElementById('ccol').value;
}
A.ck = d => { readCF(); const CF = SH.CF; CF.k = d.v; if (d.v === 'count') { CF.u = CF.u || 'раз'; CF.g = CF.g > 1 ? CF.g : DEFG[CF.u]; CF.stp = CF.stp || DEFS[CF.u]; } refreshSheet(true); };
A.cu = d => { readCF(); const CF = SH.CF; CF.u = d.v; CF.g = DEFG[d.v]; CF.stp = DEFS[d.v]; refreshSheet(true); };
A.cci = d => { readCF(); SH.CF.col = PAL[+d.v]; refreshSheet(true); };
A.cvis = d => { readCF(); SH.CF.vis = d.v; refreshSheet(true); };
A.coff = d => { readCF(); SH.CF.off = +d.v; refreshSheet(true); };
A.csave = () => {
  readCF(); const CF = SH.CF;
  CF.n = CF.n || 'Без названия';
  if (CF.k === 'count') { CF.u = CF.u || 'раз'; CF.per = CF.per || 'day'; }
  if (CF.days && CF.days.every(Boolean)) delete CF.days;
  const isNew = CF._new; delete CF._new;
  const o = put('circles', CF);
  if (isNew && !S.ui.corder.includes(o.id)) S.ui.corder.push(o.id);
  closeSheet(); changed('ui'); buzz(14); toast(isNew ? 'Круг «' + o.n + '» создан.' : 'Круг обновлён.');
};
A.cdel = (d, el) => {
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно удалить круг?'; return; }
  const c = W.circleById[SH.CF.id]; if (c) remove('circles', c);
  closeSheet(); toast('Круг удалён.');
};
function moveCircle(id, dir) {
  const ids = W.circles.filter(c => c._mine || c._shared).map(c => c.id), i = ids.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]]; S.ui.corder = ids; changed('ui'); buzz(8);
}
A.cup = d => moveCircle(d.id, -1);
A.cdown = d => moveCircle(d.id, 1);
A.quick = () => { quickStart(); toast('Набор кругов создан. Переименуй и настрой под себя.'); };

/* ---------- неделя ---------- */
A.wshift = d => { nav.WOFF = +d.v === 0 ? 0 : nav.WOFF + +d.v; render(); buzz(8); };
A.wkset = () => { closeSheet(); openSheet(sheetWkSet, [], true); };
A.wkg = d => { S.ui.wk.group = d.v; changed('ui'); };
A.wks = d => { S.ui.wk.sort = d.v; changed('ui'); };
A.wkfc = d => { S.ui.wk.fc = d.v; changed('ui'); };
A.wkfw = d => { S.ui.wk.fw = d.v; changed('ui'); };
A.wkt = d => { S.ui.wk[d.k] = S.ui.wk[d.k] ? 0 : 1; changed('ui'); };
A.wkchk = d => { S.ui.wk.chk = d.v; changed('ui'); buzz(6); };
A.wkhue = d => { S.ui.wk.hue = d.v; changed('ui'); buzz(6); };
A.dens = d => { S.ui.dens = d.v; changed('ui'); };

/* ---------- главный экран ---------- */
A.dashset = () => { closeSheet(); openSheet(sheetDash, [], true); };
/* ---------- вид кругов ---------- */
A.look = () => { closeSheet(); openSheet(SH.sheetLook, [], true); };
const setUI = (k, v) => { S.ui[k] = v; forgetMoves(); changed('ui'); refreshSheet(true); buzz(6); };
A.uface = d => setUI('face', d.v);
A.usize = d => setUI('csize', +d.v);
A.uw = d => setUI('cw', +d.v);
A.ucap = d => setUI('cap', +d.v);
A.uskin = d => { setUI('skin', d.v); toast('Палитра: ' + ((SH.SKINS.find(s => s[0] === d.v) || [])[1] || d.v) + '.'); };
A.ufx = () => { setUI('fx', S.ui.fx ? 0 : 1); if (S.ui.fx) confetti([W.col(W.me)]); };
A.udens = () => setUI('dens', S.ui.dens === 'roomy' ? 'normal' : 'roomy');
A.uquick = () => setUI('quick', S.ui.quick ? 0 : 1);
A.ufire = () => setUI('fire', S.ui.fire ? 0 : 1);
A.cface = d => { readCF(); SH.CF.face = d.v; refreshSheet(true); };
A.wrn = d => { S.ui.wrn = +d.v; changed('ui'); };
A.upreset = d => {
  const p = SH.PRESETS.find(x => x[0] === d.v); if (!p) return;
  S.ui.skin = p[2]; S.ui.face = p[3]; S.ui.fx = 1;
  forgetMoves(); changed('ui'); refreshSheet(true);
  if (S.ui.fx) confetti();
  toast('Тема «' + p[1] + '».'); buzz([8, 30, 8]);
};
A.lookreset = () => {
  const u = defaultUI();
  Object.assign(S.ui, { face: u.face, csize: u.csize, cw: u.cw, cap: u.cap, fx: u.fx, skin: u.skin, cols: u.cols, dens: u.dens });
  forgetMoves(); changed('ui'); refreshSheet(true);
  toast('Вид — как по умолчанию.');
};
A.dedit = () => {
  nav.edit = !nav.edit;
  if (!nav.edit) toast('Главный экран сохранён.');
  render(); buzz(8); scrollTo(0, 0);
};
A.wside = d => {
  const x = S.ui.dash.find(y => y.id === d.v); if (!x) return;
  const cur = typeof x.side === 'number' ? !!x.side : !!WIDGETS[d.v].side;
  x.side = cur ? 0 : 1;
  changed('ui'); render();
};
A.dtog = d => { const x = S.ui.dash.find(y => y.id === d.v); if (x) x.on = !x.on; changed('ui'); };
A.dup = d => { const i = +d.v, a = S.ui.dash; if (i > 0) { [a[i - 1], a[i]] = [a[i], a[i - 1]]; changed('ui'); } };
A.ddown = d => { const i = +d.v, a = S.ui.dash; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; changed('ui'); } };
A.dcol = d => { S.ui.cols = +d.v; changed('ui'); };
A.dreset = () => { S.ui.dash = defaultUI().dash; changed('ui'); toast('Главный экран — как по умолчанию.'); };

/* ---------- живой список покупок ---------- */
function shopCircleFor() {
  const c = SHOP.myShopCircle();
  if (c) return c;
  return put('circles', { n: 'Покупки', i: '🛒', col: '#C98A12', k: 'shop', vis: 'shared', per: 'day' });
}
function addShop(name) {
  // «молоко, хлеб, яйца» — сразу три позиции
  const parts = String(name || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const c = shopCircleFor();
  let last = null;
  for (const n of parts) {
    last = put('tasks', { c: c.id, n, w: c._shared ? 'both' : W.me, r: null, d: W.today, q: '', pr: 0, st: '', prv: 0 }, true);
    SHOP.markJust(last.id);
  }
  changed('local'); buzz(10);
  if (parts.length > 1) toast('Добавлено ' + parts.length + '.');
  return last;
}
A.shopplus = d => {
  SHOP.setAdding(d.v); render();
  setTimeout(() => { const i = document.getElementById(d.v); if (i) i.focus(); }, 40);
};
A.shopclose = () => {
  // пока курсор в поле, перерисовка откладывается — сначала снимаем фокус
  const a = document.activeElement; if (a && a.blur) a.blur();
  SHOP.setAdding(0); render(true);
};
A.shopadd = (d, el) => {
  const id = d.v || 'shopi', inp = document.getElementById(id);
  if (!inp) return;
  const t = addShop(inp.value);
  if (!t) { inp.focus(); return; }
  inp.value = '';
  render();
  setTimeout(() => { const i = document.getElementById(id); if (i) i.focus(); }, 30);
  void el;
};
A.shopq = d => { addShop(d.v); render(); toast('«' + d.v + '» в списке.'); };
A.shopbuy = d => {
  const t = W.taskById[d.id]; if (!t) return;
  const was = SHOP.boughtAt(t);
  SHOP.markJust(t.id);
  if (was) { setMark(t.id, was, 'open'); buzz(8); return; }
  setMark(t.id, W.today, 'done'); buzz([10, 40, 10]);
  // запоминаем, что это уже покупали: потом подскажем в один тап
  const list = (S.ui.shopOften || []).filter(n => n.toLowerCase() !== t.n.toLowerCase());
  list.unshift(t.n); S.ui.shopOften = list.slice(0, 16); changed('ui');
  const left = SHOP.shopItems().filter(x => !x.b).length;
  if (!left) { if (S.ui.fx) confetti(); toast('Всё куплено. Красота.'); }
};
A.shopfold = () => { S.ui.shopOpen = S.ui.shopOpen === 0 ? 1 : 0; changed('ui'); buzz(8); };
A.shoph = () => { S.ui.shopH = ((S.ui.shopH || 0) + 1) % 3; changed('ui'); buzz(6); };
A.shopwide = () => { S.ui.shopWide = S.ui.shopWide ? 0 : 1; changed('ui'); render(); };
A.shopgrp = () => { S.ui.shopGrp = S.ui.shopGrp ? 0 : 1; changed('ui'); };

/* ---------- план ---------- */
A.pdate = d => { nav.plan.date = d.v; render(); };
A.pdatein = (d, el) => { if (el.value) { nav.plan.date = el.value; render(); } };
A.pmode = d => { nav.plan.mode = d.v; render(); };
A.pmodego = d => { nav.tab = 'plan'; nav.plan.mode = d.v; render(); scrollTo(0, 0); };
A.fc = d => { F.c = d.v; render(); };
A.fw = d => { F.w = d.v; render(); };
A.fprv = d => { F.prv = +d.v; render(); };
A.fd = d => { F.days[+d.v] = F.days[+d.v] ? 0 : 1; render(); };
A.fadd = () => {
  F.n = val('fn'); F.q = val('fq'); F.pr = val('fpr'); F.st = val('fst');
  if (!F.n) { toast('Напиши, что за дело.'); document.getElementById('fn').focus(); return; }
  const c = W.circleById[F.c], rep = F.days.some(Boolean) ? F.days.slice() : null, tk = planDate();
  put('tasks', { c: F.c, n: F.n, w: c && c._shared ? (F.w || W.me) : W.me, r: rep, d: rep ? null : tk, from: rep ? W.today : null,
                 q: F.q, pr: +F.pr || 0, st: F.st, prv: F.prv ? 1 : 0 });
  toast(rep ? 'Дело встало в выбранные дни каждую неделю.' : 'Добавлено в план.');
  Object.assign(F, { n: '', q: '', pr: '', st: '', days: [0, 0, 0, 0, 0, 0, 0] }); render(); buzz(12);
  setTimeout(() => { const i = document.getElementById('fn'); if (i) i.focus(); }, 30);
};
A.ekind = d => { E.kind = d.v; render(); };
A.ewith = d => { E.with = d.v; render(); };
A.evis = d => { E.vis = d.v; render(); };
A.eadd = () => {
  E.t = val('et'); E.time = val('etime'); E.place = val('eplace'); E.note = val('enote');
  if (!E.t) { toast('Напиши, что за план.'); return; }
  put('events', { t: E.t, kind: E.kind, date: planDate(), time: E.time, place: E.place, with: E.with, note: E.note,
                  vis: E.with === 'us' ? 'shared' : E.vis });
  if (E.with === 'us') PUSH.notifyPartner('📍 ' + W.name(W.me) + ' зовёт', E.t + ' · ' + pln(planDate()) + (E.time ? ', ' + E.time : ''), 'pair');
  toast(E.with === 'us' ? W.name(W.you) + ' увидит приглашение.' : 'Запланировано.');
  Object.assign(E, { t: '', time: '', place: '', note: '' }); render(); buzz(12);
};
A.qkind = d => { Q.kind = d.v; render(); };
A.qadd = () => {
  Q.n = val('qn'); Q.note = val('qnote');
  if (!Q.n) { toast('О чём просишь?'); return; }
  put('requests', { to: W.you, n: Q.n, note: Q.note, kind: Q.kind, d: planDate(), vis: 'shared' });
  PUSH.notifyPartner(Q.kind === 'buy' ? '🛒 ' + W.name(W.me) + ' просит купить' : '📨 Просьба от ' + W.gen(W.me),
                     Q.n + (Q.note ? ' · ' + Q.note : ''), 'pair');
  toast('Просьба отправлена' + (PUSH.partnerOn() ? ' — уведомление ушло.' : '. ' + W.name(W.you) + ' увидит её во «Входящих».'));
  Object.assign(Q, { n: '', note: '' }); render(); buzz(12);
};
A.qdel = d => { const r = W.requests.find(x => x.id === d.id); if (r) remove('requests', r); toast('Просьба отозвана.'); };
A.pdel = d => {
  const t = W.taskById[d.id]; if (!t) return;
  if (!t.r && W.sealed(t.d)) { toast('День запечатан — удалить нельзя.'); return; }
  if (t.r) put('tasks', { ...t, to: W.today }); else remove('tasks', t);
  buzz(8);
};
A.seal = d => {
  if (!W.tasksOn(d.v).length) { toast('Сначала набери хотя бы одно дело.'); return; }
  setMap('sealed', d.v, { on: 1 }); buzz([10, 40, 14]); toast('Запечатано. Убрать дела уже нельзя.');
};
A.tmpl = d => {
  const lc = listCircles(); if (!lc.length) { toast('Сначала создай круг.'); return; }
  const target = W.circleById[F.c] ? F.c : lc[0].id, tk = planDate();
  const b = BUILTIN_TPL.find(x => x.id === d.id), u = W.tpls.find(x => x.id === d.id);
  const items = b ? b.items.map(n => ({ n, c: target })) : u ? u.items : [];
  for (const it of items) put('tasks', { c: W.circleById[it.c] ? it.c : target, n: it.n, q: it.q || '', w: W.me, r: null, d: tk, pr: 0, st: '', prv: 0 }, true);
  changed(); buzz(12); toast('Шаблон добавлен: ' + pln(items.length, ['дело', 'дела', 'дел']) + '.');
};
A.tplsave = () => openSheet(SH.sheetTplSave, [planDate()]);
A.tpladd = d => {
  const items = W.tasksOn(d.v).filter(t => !t.r && t.own === W.me).map(t => ({ n: t.n, c: t.c, q: t.q || '' }));
  put('tpls', { n: val('tpn') || 'мой день', items, vis: 'prv' }); closeSheet(); toast('Шаблон сохранён.');
};
A.tpldel = d => { const t = W.tpls.find(x => x.id === d.id); if (t) remove('tpls', t); };

/* ---------- вместе: просьбы, приглашения, поддержка ---------- */
function circleForRequest() {
  const lc = W.myCircles.filter(c => c.k === 'list');
  return lc.find(c => c._mine && c.vis !== 'prv') || lc.find(c => c._shared) || lc[0] ||
    put('circles', { n: 'Просьбы', i: '📨', col: '#2F5BD0', k: 'list', vis: 'pair', per: 'day' });
}
A.reqacc = d => {
  NOTE.markSeen();
  SH.newRF(d.id);
  if (!SH.RF) { toast('Просьбы уже нет.'); render(); return; }
  closeSheet(); openSheet(SH.sheetTakeReq, [], true);
};
A.rfc = d => { if (SH.RF) { SH.RF.c = d.v; refreshSheet(true); } };
A.rfd = d => { if (SH.RF) { SH.RF.d = d.v; refreshSheet(true); } };
A.reqtake = () => {
  const F = SH.RF; if (!F) return;
  const c = W.circleById[F.c] || circleForRequest();
  const t = put('tasks', { c: c.id, n: F.r.n, q: F.r.note || '', w: W.me, r: null, d: F.d,
                           by: F.r.own, req: F.r.id, pr: 0, st: '', prv: 0 }, true);
  setMap('answers', F.r.id, { s: 'acc', task: t.id, c: c.id });
  const when = F.d === W.today ? 'на сегодня' : F.d === addK(W.today, 1) ? 'на завтра' : 'на ' + pln(F.d);
  PUSH.notifyPartner('👍 ' + W.name(W.me) + ' ' + W.say(W.me, 'взял', 'взяла'), F.r.n + ' · ' + c.n + ', ' + when, 'pair');
  closeSheet(); buzz(14); toast('Взято в «' + c.n + '» ' + when + '.');
};
A.reqdec2 = () => {
  if (!SH.RF) return;
  setMap('answers', SH.RF.r.id, { s: 'dec' });
  PUSH.notifyPartner('🙅 ' + W.name(W.me) + ' ' + W.say(W.me, 'отказался', 'отказалась'), SH.RF.r.n, 'pair');
  closeSheet(); buzz(8); toast('Отклонено.');
};
A.reqdec = d => {
  const r = W.requests.find(x => x.id === d.id);
  NOTE.markSeen(); setMap('answers', d.id, { s: 'dec' }); buzz(8);
  PUSH.notifyPartner('🙅 ' + W.name(W.me) + ' ' + W.say(W.me, 'отказался', 'отказалась'), (r && r.n) || 'просьба', 'pair');
  toast('Отклонено. ' + W.name(W.you) + ' увидит отказ.');
};

/* ---------- переписка ---------- */
A.mailtab = d => {
  nav.mail = d.v;
  if (d.v === 'feed') { S.seen.feed = now(); NOTE.markAll(); saveLocal(); }
  render(); buzz(6);
};
A.reqping = d => {
  const r = W.requests.find(x => x.id === d.id); if (!r) return;
  PUSH.notifyPartner('🔔 Напоминание от ' + W.gen(W.me), r.n, 'pair');
  buzz(10); toast(PUSH.partnerOn() ? 'Напомнил' + W.say(W.me, '', 'а') + '.' : W.name(W.you) + ' увидит просьбу при следующей сверке.');
};
A.reqcancel = (d, el) => {
  const r = W.requests.find(x => x.id === d.id); if (!r) return;
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно отменить?'; return; }
  remove('requests', r); toast('Просьба отменена.');
};
A.reqagain = d => {
  const r = W.requests.find(x => x.id === d.id); if (!r) return;
  put('requests', { to: r.to, n: r.n, note: r.note, kind: r.kind, d: W.today, vis: 'shared' });
  PUSH.notifyPartner(r.kind === 'buy' ? '🛒 ' + W.name(W.me) + ' просит купить' : '📨 Просьба от ' + W.gen(W.me), r.n, 'pair');
  toast('Отправлено снова.'); buzz(12);
};
A.reqedit = d => { SH.newQF(d.id); closeSheet(); openSheet(SH.sheetReqEdit, [], true); };
A.qfsave = () => {
  const F = SH.QF; if (!F) return;
  const n = val('qfn');
  if (!n) { toast('О чём просьба?'); return; }
  const r = W.requests.find(x => x.id === F.id); if (!r) return;
  put('requests', { ...r, n, note: val('qfnote'), d: F.d, kind: F.kind });
  closeSheet(); toast('Просьба изменена.'); buzz(10);
};
A.qfkind = d => { if (SH.QF) { SH.QF.kind = d.v; refreshSheet(true); } };
A.qfd = d => { if (SH.QF) { SH.QF.d = d.v; refreshSheet(true); } };
A.evcancel = (d, el) => {
  const e = W.events.find(x => x.id === d.id); if (!e) return;
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно отменить?'; return; }
  remove('events', e); toast('План отменён.');
};
A.pcancel = (d, el) => {
  const p = W.pledges.find(x => x.id === d.id); if (!p) return;
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно отменить?'; return; }
  put('pledges', { ...p, st: 'cancel' }); toast('Обещание отменено.');
};
A.feedhide = d => {
  const list = S.ui.feedHide || (S.ui.feedHide = []);
  if (!list.includes(d.v)) list.push(d.v);
  S.ui.feedHide = list.slice(-200);
  changed('ui'); buzz(6);
};
A.feedback = () => { S.ui.feedHide = []; changed('ui'); toast('Лента снова полная.'); };

/* ---------- полоска «пришло от пары» ---------- */
A.notego = () => {
  const n = NOTE.cur; if (!n) return;
  NOTE.markSeen();
  if (n.a === 'reqacc') A.reqacc({ id: n.id });
  else { nav.tab = n.v || 'pair'; nav.more = 'menu'; render(); }
};
A.notex = () => { NOTE.markSeen(); render(); };

/* ---------- уведомления на телефон ---------- */
A.pushon = async (d, el) => {
  const t = el.textContent;
  el.textContent = 'Спрашиваю разрешение…'; el.disabled = true;
  try {
    await PUSH.enable();
    toast('Уведомления включены на этом устройстве.');
    const r = await PUSH.selfTest();
    if (!r.ok) toast('Включено, но проверка не дошла: ' + r.msg);
  } catch (e) { toast(e.message || String(e)); }
  el.disabled = false; el.textContent = t; render(); refreshSheet(true);
};
A.pushoff = async () => { await PUSH.disable(); toast('Уведомления на этом устройстве выключены.'); render(); };
A.pushtest = async (d, el) => {
  el.disabled = true;
  const r = await PUSH.selfTest();
  toast(r.ok ? 'Отправлено — уведомление должно прийти через пару секунд.'
    : r.blind ? 'Отправлено. Apple не отвечает браузеру — смотри, пришло ли само уведомление.'
    : 'Не ушло: ' + r.msg);
  el.disabled = false; render();
};
A.pushping = async (d, el) => {
  el.disabled = true; const t = el.textContent; el.textContent = 'Сверяюсь…';
  // Подписка пары приезжает вместе с её файлом. Прежде чем говорить «у неё
  // не включено», надо этот файл перечитать — иначе судим по вчерашнему.
  if (ready()) { try { await cycle('pull'); } catch {} }
  el.textContent = t;
  if (!PUSH.partnerOn()) {
    toast('У ' + W.gen(W.you) + ' уведомления пока не включены — или её телефон ещё не отправил подписку в базу.');
    el.disabled = false; render(); return;
  }
  const ok = await PUSH.notifyPartner('🔔 ' + W.name(W.me), 'Проверка связи. Всё доходит.', 'pair');
  toast(ok ? 'Ушло ' + W.dat(W.you) + '. Спроси, пришло ли.' : 'Не ушло: ' + PUSH.pushState.msg);
  el.disabled = false; render();
};
A.pushsync = async (d, el) => {
  el.disabled = true; const t = el.textContent; el.textContent = 'Сверяюсь…';
  try { await cycle('pull'); } catch (e) { toast(e.message || String(e)); }
  el.textContent = t; el.disabled = false; render();
  toast(PUSH.partnerOn() ? 'Подписка ' + W.gen(W.you) + ' получена.' : 'В файле ' + W.gen(W.you) + ' подписки пока нет.');
};
A.propacc = d => {
  const p = W.pledges.find(x => x.id === d.id); if (!p) return;
  put('pledges', { ...p, st: 'active' }); setMap('answers', p.id, { s: 'acc' });
  confetti([W.col(W.you)]); toast('Обещание дано: ' + p.reward + '.');
};
A.propdec = d => { const p = W.pledges.find(x => x.id === d.id); if (p) put('pledges', { ...p, st: 'cancel' }); setMap('answers', d.id, { s: 'dec' }); };
A.rsvp = d => {
  const cur = W.rsvpMine[d.id];
  setMap('rsvp', d.id, cur && !cur.off && cur.s === d.v ? null : { s: d.v });
  buzz(10);
};
A.kudos = (d, el) => {
  if (!W.hasPartner) { toast('Поддержка дойдёт, когда подключите синхронизацию.'); }
  put('kudos', { to: W.you, e: d.v, about: el.dataset.about || '', vis: 'shared' });
  PUSH.notifyPartner(d.v + ' от ' + W.gen(W.me), el.dataset.about ? 'за: ' + el.dataset.about : 'просто так', 'pair');
  buzz([8, 30, 8]); toast(d.v + ' ' + W.name(W.you) + ' увидит.');
};
A.poke = d => {
  const t = W.taskById[d.id]; if (!t) return;
  const today = W.today;
  if (W.pokes.some(p => p.own === W.me && p.ref === t.id && p.day === today)) { toast('Сегодня уже напоминал' + W.say(W.me, '', 'а') + '. Дальше это уже нытьё.'); return; }
  put('pokes', { to: W.you, ref: t.id, about: t.n, day: today, vis: 'shared' });
  PUSH.notifyPartner('🔔 ' + W.name(W.me) + ' напоминает', t.n, 'today');
  toast('Напоминание отправлено.'); buzz(10);
};
A.ptab = d => { nav.pledgeTab = d.v; render(); };

/* ---------- обещания ---------- */
A.pledgenew = () => { SH.newPF(null); closeSheet(); openSheet(SH.sheetPledge); };
A.pedit = d => { SH.newPF(d.id); closeSheet(); openSheet(SH.sheetPledge); };
function readPF() {
  const P = SH.PF;
  if (document.getElementById('pfr')) P.reward = val('pfr');
  if (document.getElementById('pfn')) P.cond.n = Math.max(1, +val('pfn') || 1);
  if (document.getElementById('pffrom')) P.cond.from = val('pffrom') || W.today;
  if (document.getElementById('pfuntil')) P.cond.until = val('pfuntil') || '';
  if (document.getElementById('pfnote')) P.note = val('pfnote');
}
A.pfdir = d => { readPF(); SH.PF.dir = d.v; SH.PF.cond.c = null; refreshSheet(true); };
A.pft = d => { readPF(); SH.PF.cond.t = d.v; refreshSheet(true); };
A.pfc = d => { readPF(); SH.PF.cond.c = d.v; refreshSheet(true); };
A.pfsave = () => {
  readPF(); const P = SH.PF;
  if (!P.reward) { toast('Какая награда?'); return; }
  if ((P.cond.t === 'days' || P.cond.t === 'sum') && !P.cond.c) { toast('Выбери круг или условие «на моё слово».'); return; }
  const give = P.dir === 'give';
  const o = { ...P, giver: give ? W.me : W.you, to: give ? W.you : W.me, vis: 'shared',
              st: P.id ? P.st : (give ? 'active' : 'proposed') };
  delete o.dir;
  put('pledges', o); closeSheet(); buzz(14);
  PUSH.notifyPartner(give ? '🤝 ' + W.name(W.me) + ' обещает' : '🤝 Предложение от ' + W.gen(W.me), o.reward || 'сюрприз', 'pair');
  toast(P.id ? 'Сохранено.' : give ? 'Обещано. ' + W.name(W.you) + ' увидит прогресс.' : 'Предложение отправлено ' + W.dat(W.you) + '.');
};
A.pfcancel = (d, el) => {
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно отменить?'; return; }
  const p = W.pledges.find(x => x.id === SH.PF.id); if (p) put('pledges', { ...p, st: 'cancel' }); closeSheet();
};
A.pgive = d => {
  const p = W.pledges.find(x => x.id === d.id); if (!p) return;
  put('pledges', { ...p, st: 'given', givenAt: now() }, true);
  const w = p.wish && W.wishes.find(x => x.id === p.wish);
  if (w && w.st !== 'bought') put('wishes', { ...w, st: 'bought', boughtBy: W.me, boughtAt: now() }, true);
  changed(); confetti(['#C98A12', W.col(W.you)]); toast('Подарено! ' + W.name(W.you) + ' увидит.');
};
A.pok = d => { const p = W.pledges.find(x => x.id === d.id); if (p) put('pledges', { ...p, ok: 1 }); confetti(); };
A.pthanks = d => { setMap('thanks', d.id, { v: 1 }); confetti(); toast('Спасибо отправлено.'); };

/* ---------- цель недели ---------- */
let goalNeed = null;
A.goalset = () => { goalNeed = null; closeSheet(); openSheet(SH.sheetGoal); };
A.gneed = (d, el) => { goalNeed = +d.v; el.parentNode.querySelectorAll('.pb').forEach(b => b.setAttribute('aria-pressed', String(b === el))); };
A.goalsave = d => {
  const g = d.id ? W.goals.find(x => x.id === d.id) : null;
  put('goals', { ...(g || {}), n: val('gn') || 'Неделя вдвоём', need: goalNeed || (g && g.need) || 5, rw: val('gr'),
                 week: wkStartK(W.today), vis: 'shared' });
  closeSheet(); toast('Цель недели задана.');
};
A.goaldel = d => { const g = W.goals.find(x => x.id === d.id); if (g) remove('goals', g); closeSheet(); };

/* ---------- планы ---------- */
A.evnew = () => { SH.newEF(null); closeSheet(); openSheet(SH.sheetEvent); };
A.evedit = d => { SH.newEF(d.id); closeSheet(); openSheet(SH.sheetEvent); };
function readEF() {
  const e = SH.EF;
  for (const [id, k] of [['evt', 't'], ['evd', 'date'], ['evtime', 'time'], ['evp', 'place'], ['evn', 'note']])
    if (document.getElementById(id)) e[k] = val(id);
}
A.efk = d => { readEF(); SH.EF.kind = d.v; refreshSheet(true); };
A.efw = d => { readEF(); SH.EF.with = d.v; SH.EF.vis = d.v === 'us' ? 'shared' : 'pair'; refreshSheet(true); };
A.efv = d => { readEF(); SH.EF.vis = d.v; refreshSheet(true); };
A.evsave = () => {
  readEF(); const e = SH.EF;
  if (!e.t) { toast('Что за план?'); return; }
  if (!e.date) e.date = W.today;
  if (e.with === 'us') e.vis = 'shared';
  put('events', e); closeSheet(); buzz(12); toast('План сохранён.');
};
A.evdone = () => { readEF(); put('events', { ...SH.EF, done: W.today }); closeSheet(); confetti(); toast('Состоялось. +15 опыта.'); };
A.evdel = (d, el) => {
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно удалить?'; return; }
  const e = W.events.find(x => x.id === SH.EF.id); if (e) remove('events', e); closeSheet();
};

/* ---------- покупки ---------- */
A.wnew = () => { SH.newWF(null); closeSheet(); openSheet(SH.sheetWish); };
A.wedit = d => { SH.newWF(d.id); closeSheet(); openSheet(SH.sheetWish); };
A.occ = d => { SH.newWF(null, { board: 'gift', occ: d.n, date: d.v, st: 'idea' }); closeSheet(); openSheet(SH.sheetWish); };
function readWF() {
  const w = SH.WF;
  for (const [id, k] of [['wurl', 'url'], ['wt', 't'], ['wstore', 'store'], ['wimg', 'img'], ['wforn', 'forName'], ['wocc', 'occ'], ['wdate', 'date'], ['wnote', 'note']])
    if (document.getElementById(id)) w[k] = val(id);
  if (document.getElementById('wpr')) w.pr = +val('wpr') || 0;
  if (document.getElementById('wqty')) w.qty = Math.max(1, +val('wqty') || 1);
}
A.wfb = d => { readWF(); SH.WF.board = d.v; refreshSheet(true); };
A.wff = d => { readWF(); SH.WF.for = d.v; if (d.v !== W.you) SH.WF.sur = 0; else if (!SH.WF.id) SH.WF.sur = 1; refreshSheet(true); };
A.wfs = d => { readWF(); SH.WF.sur = +d.v; refreshSheet(true); };
A.wfv = d => { readWF(); SH.WF.vis = d.v; refreshSheet(true); };
A.wfp = d => { readWF(); SH.WF.pri = +d.v; refreshSheet(true); };
A.wfst = d => { readWF(); SH.WF.st = d.v; refreshSheet(true); };
A.wsave = () => {
  readWF(); const w = SH.WF;
  if (!w.t && w.url) w.t = domainOf(w.url) || 'Покупка';
  if (!w.t) { toast('Что это за покупка?'); return; }
  if (!w.store && w.url) w.store = domainOf(w.url);
  if (w.for === W.you && w.sur) w.vis = 'prv';
  if (w.st === 'bought' && !w.boughtBy) { w.boughtBy = W.me; w.boughtAt = now(); }
  put('wishes', w); closeSheet(); buzz(12);
  toast(w.sur ? 'Сюрприз сохранён — ' + W.name(W.you) + ' его не увидит.' : 'Карточка сохранена.');
};
A.wdel = (d, el) => {
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно удалить?'; return; }
  const w = W.wishes.find(x => x.id === SH.WF.id); if (w) remove('wishes', w); closeSheet();
};
A.wbought = d => { const w = W.wishes.find(x => x.id === d.id); if (!w) return; put('wishes', { ...w, st: 'bought', boughtBy: W.me, boughtAt: now() }); buzz(12); toast('Куплено ✓'); };
A.wunbought = d => { const w = W.wishes.find(x => x.id === d.id); if (w) put('wishes', { ...w, st: 'plan' }); };
A.wclaim = d => {
  const cur = S.data.claims[d.id], on = !(cur && !cur.off);
  setMap('claims', d.id, on ? { on: 1 } : null);
  toast(on ? 'Отмечено: даришь ты. ' + W.name(W.you) + ' этого не видит.' : 'Снято.');
};
A.wpledge = d => { SH.newPF(null, d.id); closeSheet(); openSheet(SH.sheetPledge); };
A.wtoday = d => {
  const w = W.wishes.find(x => x.id === d.id), c = W.myCircles.find(x => x.k === 'shop' && x._shared) || W.myCircles.find(x => x.k === 'shop');
  if (!w || !c) return;
  put('tasks', { c: c.id, n: w.t, q: w.qty > 1 ? w.qty + ' шт' : '', pr: (w.pr || 0) * (w.qty > 1 ? w.qty : 1), st: w.store || '', w: W.me, r: null, d: W.today, prv: 0, wish: w.id });
  toast('В списке «' + c.n + '» на сегодня.');
};
A.wboard = d => { S.ui.wish.board = d.v; changed('ui'); };
A.wwho = d => { S.ui.wish.who = d.v; changed('ui'); };
A.wst = d => { S.ui.wish.st = d.v; changed('ui'); };
A.wsort = d => { S.ui.wish.sort = d.v; changed('ui'); };
A.boardnew = () => openSheet(SH.sheetBoard);
A.boardadd = () => {
  const n = val('bn'); if (!n) { toast('Как назвать доску?'); return; }
  const b = put('boards', { n, i: val('bi') || '📋', vis: document.getElementById('bv').value });
  S.ui.wish.board = b.id; closeSheet(); changed('ui');
};
A.datesheet = () => { closeSheet(); openSheet(SH.sheetDates, [], true); };
A.dateadd = () => {
  const n = val('dn'), dd = val('dd');
  if (!n || !dd) { toast('Нужны имя и дата.'); return; }
  put('dates', { n, md: dd.slice(5), year: +dd.slice(0, 4) || null, kind: document.getElementById('dk').value, vis: document.getElementById('dv').value });
  toast('Дата добавлена.');
};
A.datedel = d => { const x = W.dates.find(y => y.id === d.id); if (x) remove('dates', x); };

/* ---------- ещё: статистика и настройки ---------- */
A.sper = d => { S.ui.stat.per = d.v; changed('ui'); };
A.sfc = d => { S.ui.stat.fc = d.v; changed('ui'); };
A.psave = () => {
  const me = S.people[S.me];
  me.name = val('pname') || me.name;
  const b = val('pbday'); me.bday = b ? b.slice(5) : '';
  const y = val('pyou'); if (y) S.people[other(S.me)].name = y;
  S.profileAt = now(); changed(); toast('Профиль сохранён.');
};
A.pcol = d => { S.people[S.me].col = d.v; S.profileAt = now(); changed(); };
A.pg = d => { S.people[S.me].g = d.v; S.profileAt = now(); changed(); };
A.theme = d => { S.ui.theme = d.v; changed('ui'); };
A.scale = d => { S.ui.scale = +d.v; changed('ui'); };
A.insn = d => { S.prefs.ins = +d.v; changed(); };
A.export = () => {
  const b = new Blob([exportJSON()], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = 'krugi-' + S.me + '-' + W.today + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
A.import = (d, el) => {
  const f = el.files && el.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { importJSON(r.result); toast('Загружено.'); } catch (e) { toast('Не загрузилось: ' + e.message); } };
  r.readAsText(f);
};
A.switchme = () => {
  const o = other(S.me);
  if (!confirm('Переключить этот телефон на ' + W.acc(o) + '? Данные ' + W.gen(S.me) + ' останутся на телефоне, но откроется профиль ' + W.gen(o) + '.')) return;
  localStorage.setItem('krugi3.me', o); location.reload();
};
A.reset = () => {
  if (!confirm('Стереть все данные ' + W.gen(S.me) + ' на этом телефоне? В общей базе они останутся и вернутся при подключении.')) return;
  wipe(S.me); forgetDevice(); location.reload();
};

/* ---------- синхронизация ---------- */
function formCfg() {
  return { owner: val('gowner') || DEFAULT_CFG.owner, repo: val('grepo') || DEFAULT_CFG.repo,
           token: val('gtoken'), dir: DEFAULT_CFG.dir };
}
function gmsg(html) { const m = document.getElementById('gmsg'); if (m) m.innerHTML = html; }
/* ---------- настройка другого телефона одной ссылкой ---------- */
A.mklink = d => {
  if (!ready()) { toast('Сначала подключись сам.'); return; }
  nav.link = d.v; render(); buzz(8);
};
A.linkhide = () => { nav.link = null; render(); };
A.linkcopy = async d => {
  const link = makeSetupLink({ withKey: d.v === 'mine', who: d.v === 'mine' ? S.me : other(S.me) });
  try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована. Она как пароль — не оставляй её в переписке.'); }
  catch { toast('Скопируй ссылку вручную из рамки.'); }
};
A.setupgo = d => {
  const p = pendingSetup; if (!p) return;
  if (!S || S.me !== d.v) loadState(d.v);
  applySetup(p);
  pendingSetup = null;
  S.started = 1;
  rebuild(); changed('local'); render(); toast('Подключено. Забираю общие данные…');
};
A.setupno = () => { pendingSetup = null; clearSetupLink(); render(); };
/* Вставка кода подключения — для айфона с домашнего экрана и для случая,
   когда ссылка пришла текстом. */
function takeSetup(text, where) {
  const p = parseSetupText(text);
  if (!p) { toast('Это не похоже на код подключения. Скопируй ссылку целиком.'); return; }
  pendingSetup = p;
  if (S) { render(); toast('Код принят — скажи, чей это телефон.'); }
  else render();
  void where;
}
A.pastelink = async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (t) return takeSetup(t);
    toast('В буфере пусто. Скопируй ссылку и нажми ещё раз.');
  } catch {
    toast('Браузер не дал прочитать буфер — вставь ссылку в поле ниже.');
    const f = document.getElementById('pastefield'); if (f) f.focus();
  }
};
A.pastego = () => {
  const f = document.getElementById('pastefield');
  takeSetup(f ? f.value : '');
};

A.setupcopy = async () => {
  try { await navigator.clipboard.writeText(location.href); toast('Ссылка скопирована — открой её в Safari или Chrome.'); }
  catch { toast('Скопируй адрес из адресной строки и открой его в обычном браузере.'); }
};
A.keyreset = (d, el) => {
  if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = 'Точно? Старое личное пропадёт'; return; }
  resetSecret(); toast('Личное начато заново.'); render();
};

A.gsave = async () => {
  const c = formCfg(); if (!c.owner || !c.token) { gmsg('<div class="alert"><b>!</b><div>Нужны логин и токен.</div></div>'); return; }
  gmsg('<div class="sub">Проверяю…</div>');
  const r = await testConnection(c);
  if (!r.ok) { gmsg('<div class="alert"><b>!</b><div>' + r.msg + '</div></div>'); return; }
  setCfg(c);
  if (!getKey() && cryptoOk) setKey(newKey());
  startSync(); render(); toast('Подключено. Идёт первая сверка.');
};
A.gnow = () => { cycle('push'); toast('Сверяю…'); };
A.goff = () => {
  if (!confirm('Отключить синхронизацию на этом телефоне? Данные останутся здесь и в базе.')) return;
  setCfg(null); sync.st = 'off'; sync.msg = 'не подключено'; render();
};
A.keyshow = () => { const e = document.getElementById('keyshow'); if (e) e.textContent = getKey(); };
A.keycopy = async () => { try { await navigator.clipboard.writeText(getKey()); toast('Ключ скопирован. Храни его как пароль.'); } catch { A.keyshow(); toast('Скопируй ключ вручную.'); } };
A.keynew = () => { setKey(newKey()); render(); toast('Ключ создан. Перенеси его на второй свой телефон, если он есть.'); if (ready()) cycle('push'); };

/* ---------- первый запуск ---------- */
A.hello = d => { loadState(d.v); rebuild(); startSync(); render(); };
A.startquick = () => { S.started = 1; quickStart(); };
A.startempty = () => { S.started = 1; changed(); };

