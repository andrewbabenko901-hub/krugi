/* ============================================================
   Круги — точка входа: загрузка, перерисовка, события.
   ============================================================ */
import { S, P, deviceMe, loadState, onChange, oldPrototype, saveLocal, changed } from './store.js';
import { W, nav, rebuild } from './ctx.js';
import { refreshSheet, isSheetOpen, sheet, closeSheet } from './ui.js';
import { vToday } from './v_main.js';
import { vWeek } from './v_week.js';
import { vPlan, bind } from './v_plan.js';
import { vPair } from './v_pair.js';
import { vWish } from './v_wish.js';
import { vMore } from './v_more.js';
import { vHello, vStart, vSetupLink } from './sheets.js';
import A, { setRender, getPending } from './actions.js';
import { start as startSync, onSync, schedulePush, setSummary, cycle } from './sync.js';
import { inbox, feed } from './model.js';
import * as NOTE from './note.js';
import * as PUSH from './push.js';
import { todayKey } from './util.js';

const $v = () => document.getElementById('v');
/* Приложение открыто с домашнего экрана (у айфона это отдельное хранилище). */
const isStandalone = () => !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches);

/* ---------- оформление ---------- */
const darkMq = matchMedia('(prefers-color-scheme: dark)');
function applyUI() {
  const r = document.documentElement;
  if (!S) { r.dataset.theme = darkMq.matches ? 'dark' : 'light'; return; }
  r.style.setProperty('--z', S.ui.scale);
  r.style.setProperty('--pad', S.ui.dens === 'compact' ? .72 : S.ui.dens === 'roomy' ? 1.25 : 1);
  r.dataset.theme = S.ui.theme === 'auto' ? (darkMq.matches ? 'dark' : 'light') : S.ui.theme;
  r.dataset.skin = S.ui.skin || 'paper';
  r.dataset.fx = S.ui.fx ? '1' : '0';
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.content = r.dataset.theme === 'dark' ? '#111215' : '#F3F3F0';
}
darkMq.addEventListener && darkMq.addEventListener('change', () => { applyUI(); });

/* ---------- перерисовка ----------
   Если человек сейчас что-то набирает в поле на экране, перерисовка из-за
   пришедших с сервера данных откладывается до того, как поле потеряет фокус:
   иначе набранный текст исчезал бы посреди слова. */
let pending = false;
function typing() {
  const a = document.activeElement;
  return a && $v().contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.type !== 'range';
}
function render(force) {
  applyUI();
  const set = getPending();
  if (set) { $v().innerHTML = vSetupLink(set, S && S.me); navState(); return; }
  if (!S) { $v().innerHTML = vHello(oldPrototype(), { standalone: isStandalone() }); navState(); return; }
  if (!force && typing()) { pending = true; return; }
  pending = false;
  if (!W) rebuild();
  // Экран «с чего начнём» держим только на голом месте. Если файл пары уже
  // приехал, человек давно подключён: закрывать ему приложение этим экраном
  // нельзя — он не увидит ни просьб, ни общих кругов. Создать круги можно и
  // с главного экрана.
  if (!S.started && !S.data.circles.length && !S.migrated && !P) { $v().innerHTML = vStart(); navState(); return; }
  let html = '';
  try {
    html = nav.tab === 'today' ? vToday() : nav.tab === 'week' ? vWeek() : nav.tab === 'plan' ? vPlan()
      : nav.tab === 'pair' ? vPair() : nav.tab === 'wish' ? vWish() : vMore();
  } catch (e) {
    console.error(e);
    html = '<div class="card sec"><h3>Этот экран сломался</h3><div class="sub">' + String(e && e.message || e) +
      '</div><button class="big-btn alt" data-a="tab" data-v="today">На главный</button></div>';
  }
  $v().innerHTML = html;
  navState();
  noteState();
}

/* ---------- полоска «пришло от пары» ----------
   Живёт поверх экранов: перерисовка главного её не трогает, а новая
   весточка коротко подрагивает телефоном, если он в руках. */
let noteShown = 0;
function noteState() {
  const box = document.getElementById('note');
  if (!box) return;
  const n = S && W ? NOTE.compute() : null;
  box.innerHTML = n ? NOTE.html() : '';
  box.hidden = !n;
  document.body.classList.toggle('hasnote', !!n);
  if (n && n.at !== noteShown) { noteShown = n.at; try { navigator.vibrate && navigator.vibrate([10, 40, 10]); } catch {} }
  if (!n) noteShown = 0;
}
document.addEventListener('focusout', () => setTimeout(() => { if (pending && !typing()) render(); }, 60));

/* Пока человек печатает, нижнее меню убирается: на айфоне оно всплывает
   поверх клавиатуры и закрывает поле. */
const isField = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.type !== 'range' && el.type !== 'color';
document.addEventListener('focusin', e => { if (isField(e.target)) document.body.classList.add('kbd'); });
document.addEventListener('focusout', e => { if (isField(e.target)) setTimeout(() => { if (!isField(document.activeElement)) document.body.classList.remove('kbd'); }, 80); });

function navState() {
  const on = !!S;
  document.querySelector('nav').hidden = !on;
  for (const b of document.querySelectorAll('.tab')) b.setAttribute('aria-current', String(b.dataset.v === nav.tab));
  const nb = document.getElementById('nb');
  if (!on || !W) { nb.className = ''; nb.textContent = ''; return; }
  const n = inbox(W).length + feed(W).filter(x => x.at > (S.seen.feed || 0) && (x.kind === 'kudos' || x.kind === 'poke' || x.kind === 'thanks')).length;
  nb.className = n ? 'nbadge' : ''; nb.textContent = n ? String(n) : '';
}

/* ---------- изменения данных ---------- */
let lastDay = todayKey();
onChange(why => {
  rebuild();
  if (why !== 'remote' && why !== 'partner' && why !== 'ui') schedulePush();
  if (why === 'ui') schedulePush(8000);          // вид экрана тоже сохраняется, но без спешки
  render(why === 'local' || why === 'ui' || why === 'import');
  refreshSheet();
  noteState();
});
onSync(kind => {
  if (kind === 'status') {                      // только значок в шапке
    const pill = document.querySelector('.sync');
    if (pill && nav.tab !== 'more') render();
    else if (nav.tab === 'more') render();
    return;
  }
  rebuild(); render(); refreshSheet(); noteState();
});
setSummary(() => { try { return W ? W.sum() : null; } catch { return null; } });
setRender(render);

// полночь (точнее, 04:00): новый день — новый мир
setInterval(() => {
  const t = todayKey();
  if (t !== lastDay) { if (nav.VD === lastDay) nav.VD = t; lastDay = t; rebuild(); render(); }
}, 60000);

/* ---------- широкий экран ---------- */
const wideMq = matchMedia('(min-width: 64rem)');
nav.wide = wideMq.matches;
wideMq.addEventListener && wideMq.addEventListener('change', () => { nav.wide = wideMq.matches; render(); });

/* ---------- перетаскивание виджетов ----------
   Палец ведёт виджет, соседи расступаются: как только середина взятого
   переходит середину соседа, они меняются местами прямо в разметке.
   Отпустил — порядок читается из разметки и сохраняется. */
let drag = null;
function board() { return document.getElementById('board'); }
document.addEventListener('pointerdown', e => {
  if (!nav.edit || drag) return;
  const bar = e.target.closest('.wbar');
  if (!bar || e.target.closest('button')) return;      // кнопки на полоске — не перетаскивание
  const el = bar.closest('.wrapw'), box = board();
  if (!el || !box) return;
  e.preventDefault();
  drag = { el, box, y: e.clientY, id: e.pointerId };
  el.classList.add('dragging');
  el.setPointerCapture(e.pointerId);
  try { navigator.vibrate && navigator.vibrate(8); } catch {}
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.id) return;
  drag.el.style.transform = 'translateY(' + (e.clientY - drag.y) + 'px)';
  // Сравниваем с пальцем, а не с самим виджетом: резкий рывок через несколько
  // соседей переставляет столько раз, сколько нужно, а не один.
  for (let step = 0; step < 20; step++) {
    let moved = false;
    for (const s of drag.box.children) {
      if (s === drag.el) continue;
      const sr = s.getBoundingClientRect(), smid = sr.top + sr.height / 2;
      const below = !!(drag.el.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING);
      if ((below && e.clientY > smid) || (!below && e.clientY < smid)) {
        drag.box.insertBefore(drag.el, below ? s.nextSibling : s);
        drag.y = e.clientY;                            // встали на новое место — считаем заново
        drag.el.style.transform = '';
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
});
function dropDrag() {
  if (!drag) return;
  drag.el.classList.remove('dragging');
  drag.el.style.transform = '';
  const order = [...drag.box.children].map(x => x.dataset.w);
  const rest = S.ui.dash.filter(x => !order.includes(x.id));
  S.ui.dash = order.map(id => S.ui.dash.find(x => x.id === id)).concat(rest);
  drag = null;
  changed('ui');
}
document.addEventListener('pointerup', dropDrag);
document.addEventListener('pointercancel', dropDrag);

/* ---------- события ---------- */
document.addEventListener('click', e => {
  if (e.target.id === 'bd') { closeSheet(); return; }
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA') return;   // для них — change
  const fn = A[el.dataset.a]; if (!fn) return;
  e.preventDefault();
  try { fn(el.dataset, el, e); } catch (err) { console.error(err); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset && el.dataset.a && (el.tagName === 'INPUT' || el.tagName === 'SELECT')) {
    if (el.dataset.a === 'crange') { saveLocal(); rebuild(); render(true); refreshSheet(true); schedulePush(); return; }
    const fn = A[el.dataset.a]; if (fn) fn(el.dataset, el, e);
  }
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset && el.dataset.bind) bind(el.dataset.bind, el.value);
  // поля, которые должны отзываться на каждую букву (поиск эмодзи)
  if (el.dataset && el.dataset.a && el.dataset.live && A[el.dataset.a]) {
    try { A[el.dataset.a](el.dataset, el, e); } catch (err) { console.error(err); }
    return;
  }
  // ползунок счётчика: пишем значение сразу, а шторку не перерисовываем,
  // иначе ползунок пересоздаётся под пальцем и перетаскивание обрывается
  if (el.dataset && el.dataset.a === 'crange' && sheet.args) {
    const cid = sheet.args[0], m = S.data.counts[cid] || (S.data.counts[cid] = {});
    m[nav.VD] = { ...(m[nav.VD] || {}), v: +el.value, at: Date.now(), by: S.me };
    const bv = document.querySelector('#sheet .bv'); if (bv) bv.textContent = Number(el.value).toLocaleString('ru');
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && isSheetOpen()) { closeSheet(); return; }
  if (e.key !== 'Enter' || e.shiftKey) return;
  const id = e.target.id;
  const map = { gi: 'gadd', fn: 'fadd', fq: 'fadd', et: 'eadd', qn: 'qadd', cexact: 'cexact', mnote: 'mnote', keyin: 'keyset' };
  if (map[id]) { e.preventDefault(); const b = document.querySelector('[data-a="' + map[id] + '"]'); if (b) b.click(); }
});

/* ---------- запуск ---------- */
const who = new URLSearchParams(location.search).get('who');
const me = deviceMe() || (who === 'andrey' || who === 'diana' ? who : null);
if (me) { loadState(me); rebuild(); }
render(true);
if (S) { startSync(); PUSH.syncGot().catch(() => {}); }

const secure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator && secure) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  // пуш пришёл: сходить за свежими данными; нажали на уведомление — открыть экран
  navigator.serviceWorker.addEventListener('message', e => {
    const m = e.data || {};
    if (m.krugi !== 'push' && m.krugi !== 'open') return;
    if (m.krugi === 'open' && m.tab) { nav.tab = m.tab; nav.more = 'menu'; }
    PUSH.syncGot().catch(() => {});             // отметить, что уведомление дошло
    cycle('pull').catch(() => {});
    rebuild(); render(); noteState();
  });
}
// открыли по ссылке из уведомления
const wantTab = new URLSearchParams(location.search).get('tab');
if (S && wantTab && ['today', 'week', 'plan', 'pair', 'wish', 'more'].includes(wantTab)) { nav.tab = wantTab; render(true); }
