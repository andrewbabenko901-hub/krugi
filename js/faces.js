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
  ['ring', '◍', 'Кольцо', 'тонкое кольцо по краю — привычное и спокойное'],
  ['dots', '◌', 'Точки', 'кольцо разбито по делам: видно, сколько осталось'],
  ['fill', '◕', 'Стакан', 'круг наполняется снизу, как стакан воды'],
  ['arc', '◔', 'Шкала', 'дуга как на приборе, с отметкой цели'],
  ['tile', '▣', 'Плитка', 'крупная цифра без кольца, самый плотный вид'],
  ['bar', '▤', 'Строки', 'список полосок вместо сетки — много кругов на экран'],
];
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

/** Картинка круга выбранного вида. */
export function faceSvg(c, x, size) {
  const face = faceOf(c), p = x.empty ? 0 : x.p, col = c.col;
  const inner = face === 'dots' ? dotsSvg(p, col, x, c)
    : face === 'fill' ? fillSvg(p, col)
    : face === 'arc' ? arcSvg(p, col)
    : ringSvg(p, col);
  return '<svg class="ring f-' + face + '" viewBox="0 0 100 100" style="width:' + size + 'rem;height:' + size + 'rem">' + inner + '</svg>';
}

/** Образец круга для панели вида: рисуется в отрыве от настроек. */
export function facePreview(face, p, col, size = 3.4, label = '') {
  const c = { col, k: 'list', face, i: '●', n: '' };
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
