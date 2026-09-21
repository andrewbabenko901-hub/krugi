/* ============================================================
   Виды кругов: одна и та же доля дня, нарисованная по-разному.

   Круг — главное, на что человек смотрит каждый день, поэтому вид
   выбирается: кольцо, точки по делам, наполняющийся стакан, шкала,
   плитка с цифрой или плотная строка. Вид можно задать сразу всем
   (в «виде кругов») и переопределить у отдельного круга.

   Каждый рисовальщик получает готовый прогресс из модели и ничего
   сам не считает: здесь только геометрия.
   ============================================================ */
import { esc, fmt, DN, parse, addK, wkStartK } from './util.js';
import { W } from './ctx.js';
import { S } from './store.js';

export const FACES = [
  ['ctile', '🟧', 'Цветная плитка', 'яркая плитка цвета круга с большим значком'],
  ['ring', '◍', 'Кольцо', 'тонкое кольцо по краю — привычное и спокойное'],
  ['grad', '🌈', 'Градиент', 'кольцо переливается цветом, значок и процент внутри'],
  ['orb', '🔮', 'Объём', 'стеклянный шар, внутри поднимается вода'],
  ['conc', '◎', 'Концентрические', 'три кольца: сегодня, неделя и серия'],
  ['wave', '〰', 'Волна', 'волнистое кольцо, как на циферблате часов'],
  ['spark', '✨', 'Искры', 'кольцо с искрами, которые загораются по мере дела'],
  ['dots', '◌', 'Точки', 'кольцо разбито по делам: видно, сколько осталось'],
  ['fill', '◕', 'Стакан', 'круг наполняется снизу, как стакан воды'],
  ['arc', '◔', 'Шкала', 'дуга как на приборе, с отметкой цели'],
  ['tile', '▣', 'Плитка', 'крупная цифра без кольца, самый плотный вид'],
  ['bar', '▤', 'Строки', 'список полосок вместо сетки — много кругов на экран'],
];
/* Формы, у которых в середине значок и процент — как в каталоге. */
export const RICH = new Set(['grad', 'orb', 'conc', 'wave', 'spark']);

/* Смешать цвет с белым: светлый край градиента из цвета самого круга. */
export function tint(hex, t) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16), mix = v => Math.round(v + (255 - v) * t);
  const r = mix(n >> 16), g = mix((n >> 8) & 255), b = mix(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
export const FACE_NAMES = Object.fromEntries(FACES.map(f => [f[0], f[2]]));

/* Вид конкретного круга: у круга своё может быть сильнее общего. */
export const faceOf = c => (c && c.face) || S.ui.face || 'ring';
const clamp = p => Math.max(0, Math.min(1, p || 0));

/* ---------- немного геометрии ---------- */
const pol = (r, deg) => {
  const a = (deg - 90) * Math.PI / 180;
  return [50 + r * Math.cos(a), 50 + r * Math.sin(a)];
};
function arcPath(r, a0, a1) {
  const [x0, y0] = pol(r, a0), [x1, y1] = pol(r, a1);
  const big = a1 - a0 > 180 ? 1 : 0;
  return 'M' + x0.toFixed(2) + ' ' + y0.toFixed(2) + 'A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2);
}

/* Толщина кольца в единицах картинки: человек выбирает от тонкого до жирного. */
const stroke = () => [7, 9, 12, 16][S.ui.cw || 1] || 9;

/* Заполнение анимируется только там, где оно изменилось с прошлой отрисовки —
   иначе кольца дёргались бы при каждом чихе. */
const lastP = new Map();
export function movedSince(id, p) {
  const was = lastP.get(id);
  lastP.set(id, p);
  return was !== undefined && Math.abs(was - p) > 0.001;
}
export const forgetMoves = () => lastP.clear();

/* ---------- рисовальщики ---------- */
/* Все получают (p, col, x, c) и возвращают содержимое квадратной картинки
   100×100; подпись в середине кладёт уже cellHTML. */

function ringSvg(p, col) {
  const w = stroke(), r = (100 - w - 3) / 2, cc = 2 * Math.PI * r;
  return '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + w + '"/>' +
    '<circle class="prog" cx="50" cy="50" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + w +
    '" stroke-linecap="round" stroke-dasharray="' + cc.toFixed(1) + '" style="--cc:' + cc.toFixed(1) + ';--off:' +
    (cc * (1 - clamp(p))).toFixed(1) + '" stroke-dashoffset="' + (cc * (1 - clamp(p))).toFixed(1) +
    '" transform="rotate(-90 50 50)"/>';
}

function dotsSvg(p, col, x, c) {
  const w = stroke(), r = (100 - w - 3) / 2;
  // сколько долек: по делам, по шагам счётчика или просто восемь
  let n = x && x.a ? x.a : 0;
  if (!n && c && c.k === 'count') n = Math.ceil((c.g || 1) / (c.stp || 1));
  n = Math.max(3, Math.min(14, n || 8));
  const gap = n > 10 ? 4 : n > 6 ? 6 : 8, step = 360 / n;
  const filled = clamp(p) * n;
  let out = '';
  for (let i = 0; i < n; i++) {
    const a0 = i * step + gap / 2, a1 = (i + 1) * step - gap / 2;
    const part = Math.max(0, Math.min(1, filled - i));
    out += '<path d="' + arcPath(r, a0, a1) + '" fill="none" stroke="var(--track)" stroke-width="' + w + '" stroke-linecap="round"/>';
    if (part > 0) {
      const a2 = a0 + (a1 - a0) * part;
      out += '<path class="prog" d="' + arcPath(r, a0, a2) + '" fill="none" stroke="' + col +
        '" stroke-width="' + w + '" stroke-linecap="round"/>';
    }
  }
  return out;
}

let uid = 0;
function fillSvg(p, col) {
  const id = 'f' + (++uid), v = clamp(p), y = 100 - v * 100;
  // волна сверху: два симметричных горба, чтобы «вода» не выглядела линейкой
  const wave = 'M-10 ' + y.toFixed(1) + ' q 15 -5 30 0 t 30 0 t 30 0 t 30 0 V110 H-10 Z';
  return '<defs><clipPath id="' + id + '"><circle cx="50" cy="50" r="46"/></clipPath></defs>' +
    '<circle cx="50" cy="50" r="46" fill="var(--track)" opacity=".55"/>' +
    '<g clip-path="url(#' + id + ')">' +
    (v > 0 ? '<path class="wave" d="' + wave + '" fill="' + col + '" opacity=".85"/>' : '') +
    '</g><circle cx="50" cy="50" r="46" fill="none" stroke="' + col + '" stroke-width="3" opacity=".5"/>';
}

function arcSvg(p, col) {
  const w = stroke(), r = (100 - w - 3) / 2, A = 260, start = 180 - (A - 180) / 2;
  const v = clamp(p);
  let out = '<path d="' + arcPath(r, start, start + A) + '" fill="none" stroke="var(--track)" stroke-width="' + w + '" stroke-linecap="round"/>';
  if (v > 0.001) out += '<path class="prog" d="' + arcPath(r, start, start + A * v) + '" fill="none" stroke="' + col +
    '" stroke-width="' + w + '" stroke-linecap="round"/>';
  const [tx, ty] = pol(r, start + A);
  out += '<circle cx="' + tx.toFixed(1) + '" cy="' + ty.toFixed(1) + '" r="' + (w / 2.6).toFixed(1) +
    '" fill="' + (v >= 1 ? col : 'var(--track)') + '"/>';
  return out;
}

/* градиент: кольцо переливается от светлого к насыщенному */
function gradSvg(p, col) {
  const w = stroke() + 2, r = (100 - w - 3) / 2, cc = 2 * Math.PI * r, id = 'g' + (++uid);
  return '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="' + tint(col, .55) + '"/><stop offset=".55" stop-color="' + col + '"/>' +
    '<stop offset="1" stop-color="' + tint(col, .15) + '"/></linearGradient></defs>' +
    '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + w + '"/>' +
    (p > 0 ? '<circle class="prog" cx="50" cy="50" r="' + r + '" fill="none" stroke="url(#' + id + ')" stroke-width="' + w +
      '" stroke-linecap="round" stroke-dasharray="' + cc.toFixed(1) + '" style="--cc:' + cc.toFixed(1) +
      '" stroke-dashoffset="' + (cc * (1 - clamp(p))).toFixed(1) + '" transform="rotate(-90 50 50)"/>' : '');
}

/* объём: стеклянный шар с водой и бликом */
function orbSvg(p, col) {
  const id = 'o' + (++uid), v = clamp(p), y = 96 - v * 92;
  const wave = 'M-10 ' + y.toFixed(1) + ' q 15 -4 30 0 t 30 0 t 30 0 t 30 0 V110 H-10 Z';
  return '<defs>' +
    '<radialGradient id="' + id + 'b" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".95"/>' +
    '<stop offset=".6" stop-color="var(--track)" stop-opacity=".6"/><stop offset="1" stop-color="var(--track)"/></radialGradient>' +
    '<linearGradient id="' + id + 'w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + tint(col, .35) + '"/>' +
    '<stop offset="1" stop-color="' + col + '"/></linearGradient>' +
    '<clipPath id="' + id + 'c"><circle cx="50" cy="50" r="44"/></clipPath></defs>' +
    '<circle cx="50" cy="52" r="46" fill="#000" opacity=".12"/>' +
    '<circle cx="50" cy="50" r="46" fill="url(#' + id + 'b)"/>' +
    '<g clip-path="url(#' + id + 'c)">' + (v > 0 ? '<path class="wave" d="' + wave + '" fill="url(#' + id + 'w)"/>' : '') + '</g>' +
    '<ellipse cx="36" cy="26" rx="16" ry="8" fill="#fff" opacity=".55" transform="rotate(-25 36 26)"/>' +
    '<circle cx="50" cy="50" r="46" fill="none" stroke="#fff" stroke-width="2" opacity=".7"/>';
}

/* концентрические: сегодня снаружи, неделя в середине, серия внутри */
function concSvg(p, col, c, k) {
  const ws = wkStartK(k || W.today);
  let wd = 0, wa = 0;
  for (let i = 0; i < 7; i++) {
    const d = addK(ws, i);
    if (d > (k || W.today) || !W.active(c, d)) continue;
    const xx = W.prog(c, d); if (xx.empty) continue;
    wa++; if (xx.p >= 1) wd++;
  }
  const wk = wa ? wd / wa : 0, st = Math.min(1, (W.cstreak ? W.cstreak(c, k) : 0) / 7);
  const ring = (r, w, v, op) => {
    const cc = 2 * Math.PI * r;
    return '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + w + '"/>' +
      (v > 0 ? '<circle class="prog" cx="50" cy="50" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + w +
        '" stroke-linecap="round" opacity="' + op + '" stroke-dasharray="' + cc.toFixed(1) + '" style="--cc:' + cc.toFixed(1) +
        '" stroke-dashoffset="' + (cc * (1 - clamp(v))).toFixed(1) + '" transform="rotate(-90 50 50)"/>' : '');
  };
  return ring(45, 7, p, 1) + ring(35, 6, wk, .65) + ring(26, 5, st, .4);
}

/* волна: радиус колеблется, как зубчатый край циферблата */
function waveSvg(p, col) {
  const N = 14, A = 3.2, R = 41, pts = [];
  for (let i = 0; i <= 280; i++) {
    const t = i / 280, a = t * 360, r = R + A * Math.sin(t * N * 2 * Math.PI), [x, y] = pol(r, a);
    pts.push([x, y, t]);
  }
  const line = arr => 'M' + arr.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L');
  const up = pts.filter(q => q[2] <= clamp(p));
  const w = Math.max(5, stroke() - 2);
  return '<path d="' + line(pts) + 'Z" fill="none" stroke="var(--track)" stroke-width="' + w + '" stroke-linejoin="round"/>' +
    (up.length > 1 ? '<path class="prog" d="' + line(up) + '" fill="none" stroke="' + col + '" stroke-width="' + w +
      '" stroke-linecap="round" stroke-linejoin="round"/>' : '');
}

/* искры: кольцо, вокруг которого загораются звёздочки */
function sparkSvg(p, col) {
  const n = 8, lit = Math.round(clamp(p) * n);
  let stars = '';
  for (let i = 0; i < n; i++) {
    const [x, y] = pol(48, i * 360 / n + 22.5), on = i < lit;
    stars += '<path class="spk' + (on ? ' on' : '') + '" style="--i:' + i + '" d="M' + x.toFixed(1) + ' ' + (y - 3.6).toFixed(1) +
      'L' + (x + 1).toFixed(1) + ' ' + (y - 1).toFixed(1) + 'L' + (x + 3.6).toFixed(1) + ' ' + y.toFixed(1) +
      'L' + (x + 1).toFixed(1) + ' ' + (y + 1).toFixed(1) + 'L' + x.toFixed(1) + ' ' + (y + 3.6).toFixed(1) +
      'L' + (x - 1).toFixed(1) + ' ' + (y + 1).toFixed(1) + 'L' + (x - 3.6).toFixed(1) + ' ' + y.toFixed(1) +
      'L' + (x - 1).toFixed(1) + ' ' + (y - 1).toFixed(1) + 'Z" fill="' + (on ? col : 'var(--track)') + '"/>';
  }
  const w = stroke(), r = 38, cc = 2 * Math.PI * r;
  return stars + '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + w + '"/>' +
    (p > 0 ? '<circle class="prog" cx="50" cy="50" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="' + w +
      '" stroke-linecap="round" stroke-dasharray="' + cc.toFixed(1) + '" style="--cc:' + cc.toFixed(1) +
      '" stroke-dashoffset="' + (cc * (1 - clamp(p))).toFixed(1) + '" transform="rotate(-90 50 50)"/>' : '');
}

/** Картинка круга выбранного вида. */
export function faceSvg(c, x, size, k) {
  const face = faceOf(c), p = x.empty ? 0 : x.p, col = c.col;
  const inner = face === 'dots' ? dotsSvg(p, col, x, c)
    : face === 'fill' ? fillSvg(p, col)
    : face === 'arc' ? arcSvg(p, col)
    : face === 'grad' ? gradSvg(p, col)
    : face === 'orb' ? orbSvg(p, col)
    : face === 'conc' ? concSvg(p, col, c, k)
    : face === 'wave' ? waveSvg(p, col)
    : face === 'spark' ? sparkSvg(p, col)
    : ringSvg(p, col);
  return '<svg class="ring f-' + face + '" viewBox="0 0 100 100" style="width:' + size + 'rem;height:' + size + 'rem">' + inner + '</svg>';
}

/** Образец круга для панели вида: рисуется в отрыве от настроек. */
export function facePreview(face, p, col, size = 3.4, label = '') {
  const c = { col, k: 'list', face, i: '●', n: '' };
  if (face === 'ctile')
    return '<span class="pv"><span class="pvct" style="--c:' + col + ';--c2:' + tint(col, .45) + ';width:' + (size + .4) + 'rem;height:' + (size + .4) + 'rem">' +
      '<span class="pe">💧</span><i style="width:' + Math.round(p * 100) + '%"></i>' + (p >= 1 ? '<b>✓</b>' : '') + '</span>' +
      (label ? '<small>' + esc(label) + '</small>' : '') + '</span>';
  const x = { p, d: Math.round(p * 5), a: 5, empty: false };
  const mid = p >= 1 ? '✓' : Math.round(p * 100) + '%';
  if (face === 'tile')
    return '<span class="pv"><span class="pvtile" style="width:' + size + 'rem;height:' + size + 'rem;background:' + col +
      (p >= 1 ? '2E' : '14') + ';border-color:' + col + (p >= 1 ? '' : '33') + '">' + mid +
      '<i style="width:' + Math.round(p * 100) + '%;background:' + col + '"></i></span>' +
      (label ? '<small>' + esc(label) + '</small>' : '') + '</span>';
  if (face === 'bar')
    return '<span class="pv wide"><span class="pvbar"><i style="width:' + Math.round(p * 100) + '%;background:' + col + '"></i></span>' +
      (label ? '<small>' + esc(label) + '</small>' : '') + '</span>';
  return '<span class="pv">' + faceSvg(c, x, size) + '<span class="pvm">' + mid + '</span>' +
    (label ? '<small>' + esc(label) + '</small>' : '') + '</span>';
}

/* ---------- недельный круг ----------
   Семь долек по дням: видно не только «сколько за неделю», но и какие
   именно дни просели. То, чего не скажет ни одна полоска. */
export function weekRing(c, ws, size = 6.4) {
  const days = [];
  for (let i = 0; i < 7; i++) days.push(addK(ws, i));
  const w = 13, r = 42, gap = 5, step = 360 / 7;
  let out = '', done = 0, some = 0;
  days.forEach((k, i) => {
    const a0 = i * step + gap / 2, a1 = (i + 1) * step - gap / 2;
    const x = W.prog(c, k), on = W.active(c, k), fut = k > W.today;
    const v = on && !x.empty ? clamp(x.p) : 0;
    if (v >= 1) done++;
    if (v > 0) some++;
    out += '<path d="' + arcPath(r, a0, a1) + '" fill="none" stroke="var(--track)" stroke-width="' + w +
      '" stroke-linecap="round" opacity="' + (on ? (fut ? .45 : 1) : .25) + '"/>';
    if (v > 0) out += '<path d="' + arcPath(r, a0, a0 + (a1 - a0) * v) + '" fill="none" stroke="' + c.col +
      '" stroke-width="' + w + '" stroke-linecap="round"/>';
  });
  const cnt = c.k === 'count' ? W.cweek(c, ws) : 0;
  const center = c.k === 'count'
    ? '<tspan class="big">' + esc(fmt(cnt)) + '</tspan>'
    : '<tspan class="big">' + done + '</tspan><tspan class="small">/7</tspan>';
  const sub = c.k === 'count' ? esc(c.u || '') : (done === 7 ? 'всю неделю' : done ? 'дней' : 'пока пусто');
  return '<div class="wkring" style="--col:' + esc(c.col) + '">' +
    '<svg viewBox="0 0 100 100" style="width:' + size + 'rem;height:' + size + 'rem">' + out +
    '<text x="50" y="52" text-anchor="middle" class="wc">' + center + '</text>' +
    '<text x="50" y="66" text-anchor="middle" class="ws">' + sub + '</text></svg>' +
    '<div class="wn">' + esc(c.i) + ' ' + esc(c.n) + '</div>' +
    '<div class="wd">' + days.map((k, i) => {
      const x = W.prog(c, k), on = W.active(c, k);
      const st = !on ? 'off' : x.empty ? 'no' : x.p >= 1 ? 'on' : x.p > 0 ? 'half' : 'no';
      return '<span class="' + st + (k === W.today ? ' td' : '') + '">' + DN[i] + '</span>';
    }).join('') + '</div></div>';
}

/** Круги, которые имеет смысл показывать неделей: свои и общие, не на паузе. */
export function weekCircles() {
  return W.myCircles.filter(c => !c.off && c.k !== 'mood');
}
export const weekStartOf = k => wkStartK(k || W.today);
export const dayName = k => DN[(parse(k).getDay() + 6) % 7];
