/* Общие куски интерфейса: кольца, шторка, всплывашка, конфетти. */
import { esc } from './util.js';

export function chk(c) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="' + (c || 'var(--inv)') +
    '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5.5 5.5L20 7"/></svg>';
}
export const X_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';
export const BIN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13"/></svg>';

/** Кольцо прогресса. size в rem. */
export function ring(p, col, size = 4.6, sw = .45) {
  const w = sw / size * 100, r = (100 - w - 3) / 2, cc = 2 * Math.PI * r;
  return '<svg class="ring" viewBox="0 0 100 100" style="width:' + size + 'rem;height:' + size + 'rem">' +
    '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + w + '"/>' +
    '<circle class="prog" cx="50" cy="50" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + w +
    '" stroke-linecap="round" stroke-dasharray="' + cc + '" stroke-dashoffset="' + (cc * (1 - Math.max(0, Math.min(1, p)))) +
    '" transform="rotate(-90 50 50)"/></svg>';
}
export function miniRing(p, col, lab, center) {
  const cc = 2 * Math.PI * 40;
  return '<div><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="var(--track)" stroke-width="11"/>' +
    '<circle class="prog" cx="50" cy="50" r="40" fill="none" stroke="' + col + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + cc +
    '" stroke-dashoffset="' + (cc * (1 - Math.max(0, Math.min(1, p)))) + '" transform="rotate(-90 50 50)"/>' +
    '<text x="50" y="58" text-anchor="middle" font-size="' + (center && center.length > 3 ? 20 : 27) + '" font-weight="600" fill="var(--ink)" font-family="Golos Text">' +
    esc(center != null ? center : Math.round(p * 100)) + '</text></svg><span>' + esc(lab) + '</span></div>';
}
export function av(name, col, cls = '') {
  return '<span class="av ' + cls + '" style="background:' + esc(col) + '">' + esc((name || '?').slice(0, 1).toUpperCase()) + '</span>';
}

/* ---------- всплывашка ---------- */
let tmr;
export function toast(m) {
  const t = document.getElementById('toast');
  t.textContent = m; t.classList.add('on');
  clearTimeout(tmr); tmr = setTimeout(() => t.classList.remove('on'), 3000);
}
export function buzz(n) { try { navigator.vibrate && navigator.vibrate(n || 12); } catch {} }

/* ---------- шторка ----------
   Шторка помнит, чем она нарисована. «Живые» (круг, настройки вида)
   перерисовываются при каждом изменении данных; формы — нет, чтобы не
   стереть то, что человек сейчас набирает. */
export const sheet = { fn: null, args: null, live: false };
export function openSheet(fn, args = [], live = false) {
  sheet.fn = fn; sheet.args = args; sheet.live = live;
  document.getElementById('sc').innerHTML = fn(...args);
  document.getElementById('sheet').classList.add('on');
  document.getElementById('bd').classList.add('on');
}
export function refreshSheet(force) {
  if (!sheet.fn || !isSheetOpen()) return;
  if (!sheet.live && !force) return;
  const sc = document.getElementById('sheet'), top = sc.scrollTop;
  document.getElementById('sc').innerHTML = sheet.fn(...sheet.args);
  sc.scrollTop = top;
}
export function closeSheet() {
  document.getElementById('sheet').classList.remove('on');
  document.getElementById('bd').classList.remove('on');
  sheet.fn = null; sheet.args = null; sheet.live = false;
}
export const isSheetOpen = () => document.getElementById('sheet').classList.contains('on');

/* ---------- конфетти: день закрыт, обещание выполнено ---------- */
export function confetti(colors) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cv = document.getElementById('fx'), ctx = cv.getContext('2d');
  const W = cv.width = innerWidth * devicePixelRatio, H = cv.height = innerHeight * devicePixelRatio;
  const cols = colors || ['#2F5BD0', '#1D8F5B', '#C98A12', '#B0517E', '#8A55C4', '#0E8C96'];
  const bits = Array.from({ length: 120 }, () => ({
    x: W / 2 + (Math.random() - .5) * W * .3, y: H * .62, vx: (Math.random() - .5) * 18 * devicePixelRatio,
    vy: -(Math.random() * 16 + 10) * devicePixelRatio, r: (Math.random() * 5 + 3) * devicePixelRatio,
    c: cols[(Math.random() * cols.length) | 0], a: Math.random() * 6, va: (Math.random() - .5) * .3,
  }));
  let t = 0;
  (function f() {
    ctx.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.x += b.vx; b.y += b.vy; b.vy += .55 * devicePixelRatio; b.vx *= .99; b.a += b.va;
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.a); ctx.fillStyle = b.c;
      ctx.fillRect(-b.r, -b.r / 2, b.r * 2, b.r); ctx.restore();
    }
    if (++t < 110) requestAnimationFrame(f); else ctx.clearRect(0, 0, W, H);
  })();
}

/* ---------- мелкие построители ---------- */
export function pick(name, val, opts, cls = '') {
  return '<div class="pick">' + opts.map(([v, lab]) =>
    '<button class="pb ' + cls + '" data-a="' + name + '" data-v="' + esc(v) + '" aria-pressed="' + (String(val) === String(v)) + '">' + esc(lab) + '</button>').join('') + '</div>';
}
export function tgl(action, key, on, title, desc) {
  return '<div class="sw"><div class="swn">' + esc(title) + (desc ? '<small>' + esc(desc) + '</small>' : '') + '</div>' +
    '<button class="tgl" data-a="' + action + '" data-k="' + esc(key) + '" aria-pressed="' + !!on + '" aria-label="' + esc(title) + '"><i></i></button></div>';
}
export const val = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
