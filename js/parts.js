/* Куски разметки, которые нужны на нескольких экранах. */
import { esc, fmt, DN, money, domainOf, safeUrl, shortK, inDays } from './util.js';
import { ring, chk, X_ICON } from './ui.js';
import { faceSvg, faceOf, movedSince } from './faces.js';
import { W } from './ctx.js';
import { S } from './store.js';

export const MOODS = [['😣', 'тяжело'], ['😕', 'так себе'], ['😐', 'ровно'], ['🙂', 'хорошо'], ['😄', 'отлично']];
export const UNITS = ['мл', 'мин', 'стр', 'шагов', 'раз', 'задач', 'ккал', 'км', 'ч'];
export const DEFG = { 'мл': 2000, 'мин': 30, 'стр': 30, 'шагов': 8000, 'раз': 1, 'задач': 5, 'ккал': 2000, 'км': 5, 'ч': 8 };
export const DEFS = { 'мл': 250, 'мин': 5, 'стр': 5, 'шагов': 500, 'раз': 1, 'задач': 1, 'ккал': 100, 'км': 1, 'ч': 1 };
export const EMO = ['🏠', '🛒', '💼', '🌙', '💧', '👟', '📕', '🧘', '🧽', '🧹', '🍳', '🐱', '🐶', '👶', '💊', '💳',
  '💰', '📞', '🚗', '🌱', '🧺', '🛠', '🎒', '🎵', '✏️', '📦', '🪥', '🛏', '☕', '🍎', '🏋️', '🚿', '📅', '🧾', '🎁',
  '🧴', '🌊', '🔧', '📬', '🧩', '🌳', '🚲', '🏊', '🎨', '📷', '🎮', '💻', '🗣', '🌤', '❤️', '🔒', '✨', '🏃', '🥗'];
export const PAL = ['#2F5BD0', '#1D8F5B', '#C98A12', '#8A55C4', '#C8452F', '#15161A', '#0E8C96', '#B0517E'];
export const EVENT_KINDS = [['walk', '🌳', 'прогулка'], ['date', '🍷', 'свидание'], ['trip', '🚗', 'поездка'],
  ['sport', '🏃', 'спорт'], ['home', '🏠', 'дом'], ['guests', '🎉', 'гости'], ['health', '🩺', 'здоровье'], ['other', '📌', 'другое']];
export const evKind = k => EVENT_KINDS.find(x => x[0] === k) || EVENT_KINDS[EVENT_KINDS.length - 1];
export const VIS = [['prv', '🔒 только я'], ['pair', '👀 видно паре'], ['shared', '🤝 общее']];

/** Метка исполнителя: «я», имя пары или «оба», в цвете человека. */
export function whoTag(w) {
  if (!w) return '';
  if (w === 'both' || w === 'us') return '<span class="tagi g">' + (w === 'us' ? 'вместе' : 'оба') + '</span>';
  const nm = w === W.me ? 'я' : W.name(w);
  return '<span class="tagi" style="border-color:' + esc(W.col(w)) + ';color:' + esc(W.col(w)) + '">' + esc(nm) + '</span>';
}
export function visTag(x) {
  if (x.vis === 'prv' || x.prv) return '<span class="tagi prv">🔒 личное</span>';
  if (x.vis === 'shared') return '<span class="tagi">🤝 общее</span>';
  return '';
}
/** Название круга для списков выбора: чужой круг подписан хозяином,
    иначе два «Дома» в одном списке не различить. */
export const circleLabel = c => c.i + ' ' + c.n + (c.own && c.own !== W.me ? ' · ' + W.gen(c.own) : '');

export function circleSub(c) {
  const kind = c.k === 'count' ? 'счётчик · ' + (c.per === 'week' ? 'в неделю ' : '') + fmt(c.g) + ' ' + c.u
    : c.k === 'shop' ? 'покупки' : c.k === 'mood' ? 'настроение' : 'папка дел';
  const vis = c.vis === 'prv' ? '🔒 только я' : c.vis === 'shared' ? '🤝 общий' : '👀 видно паре';
  return kind + ' · ' + vis + (c._mine ? '' : ' · ' + W.name(c.own));
}

export function nextOf(c, k) {
  const x = W.prog(c, k);
  if (c.k === 'count') {
    if (c.per === 'week') return fmt(x.v) + ' / ' + fmt(c.g) + ' ' + c.u + ' за неделю';
    return fmt(x.v) + ' / ' + fmt(c.g) + ' ' + c.u;
  }
  if (c.k === 'mood') { const v = W.cval(c, k); return v ? MOODS[v - 1][1] : 'как ты сегодня?'; }
  // в общем круге «дальше» — то, что делать мне; чужое — только если своего не осталось
  const a = W.tasksOf(c.id, k), open = a.filter(t => W.st(t, k) === 'open');
  const o = open.find(t => W.isMineToDo(t)) || open[0];
  if (!a.length) return 'здесь пусто';
  return o ? 'дальше: ' + o.n : 'всё закрыто';
}

/** Клетка круга на главном. */
/** Размер круга в ряду: мелкий, средний, крупный. */
export const CSIZE = [3.5, 4.6, 5.9];
export const cellSize = () => CSIZE[S.ui.csize] || CSIZE[1];

/** Что написано в середине круга. */
function centerOf(c, k, x, done) {
  if (c.k === 'mood') { const v = W.cval(c, k); return '<span class="em">' + (v ? MOODS[v - 1][0] : esc(c.i)) + '</span>'; }
  if (done) return '<span class="em">✓</span>';
  if (c.k !== 'count' && x.a) return '<span class="cnt">' + x.d + '/' + x.a + '</span>';
  if (c.k === 'count' && x.v) return '<span class="cnt">' + Math.round(x.p * 100) + '%</span>';
  return '<span class="em">' + esc(c.i) + '</span>';
}
const cBadges = c => (c.vis === 'prv' ? '<span class="badge2">🔒</span>'
    : c._shared ? '<span class="badge2">' + (c._mine ? 'общий' : esc(W.name(c.own))) + '</span>' : '') +
  (c.off ? '<span class="badge2 l">пауза</span>' : c.per === 'week' ? '<span class="badge2 l">нед</span>' : '');

/** Подпись под кругом: только название, название с ближайшим делом, или ничего. */
function capOf(c, k) {
  const cap = S.ui.cap;
  if (cap === 2) return '';
  const fire = S.ui.fire === 0 ? 0 : W.cstreak(c, k);
  const nm = '<div class="nm">' + esc(c.i) + ' ' + esc(c.n) +
    (fire > 1 ? ' <span class="fire">🔥' + fire + '</span>' : '') + '</div>';
  return cap === 0 ? nm : nm + '<div class="nx">' + esc(nextOf(c, k)) + '</div>';
}

export function cellHTML(c, k, size) {
  const x = W.prog(c, k), fut = k > W.today, done = !x.empty && x.p >= 1;
  const face = faceOf(c), p = x.empty ? 0 : x.p;
  // быстрый плюс у счётчика: самое частое действие не должно стоить шторки
  const quick = c.k === 'count' && !c._ro && !fut && !c.off && W.active(c, k) && S.ui.quick !== 0;
  const fire = S.ui.fire === 0 ? 0 : W.cstreak(c, k);
  // кольцо оживает только там, где доля изменилась с прошлой отрисовки
  const moved = S.ui.fx && movedSince(c.id + '|' + k, p) ? ' grow' : '';
  const cls = 'cell f-' + face + (done ? ' done' : '') + (fut ? ' locked' : '') + moved;
  const open = '<button class="' + cls + '" data-a="circle" data-id="' + esc(c.id) + '">' + cBadges(c) +
    (fire > 1 && S.ui.cap === 2 ? '<span class="fire corner">🔥' + fire + '</span>' : '');
  // ячейка со «своими» кнопками живёт в обёртке: кнопку в кнопку не вложить
  const wrap = h => quick
    ? '<div class="cellw qw">' + h + '<button class="qplus" data-a="cquick" data-id="' + esc(c.id) +
      '" aria-label="Добавить ' + esc(fmt(c.stp || 1)) + ' ' + esc(c.u || '') + '">+</button></div>'
    : h;

  if (face === 'bar') {
    const val = c.k === 'count' ? Math.round(p * 100) + '%'
      : c.k === 'mood' ? (x.v ? MOODS[x.v - 1][0] : '—')
      : x.a ? x.d + ' / ' + x.a : '—';
    return wrap('<button class="' + cls + '" data-a="circle" data-id="' + esc(c.id) + '">' +
      '<span class="bi" style="background:' + esc(c.col) + '22">' + esc(c.i) + '</span>' +
      '<span class="bn"><b>' + esc(c.n) + '</b><small>' + esc(nextOf(c, k)) + '</small></span>' +
      '<span class="bp"><i style="width:' + Math.round(p * 100) + '%;background:' + esc(c.col) + '"></i></span>' +
      '<span class="bv">' + esc(val) + '</span>' +
      (fire > 1 ? '<span class="bf">🔥' + fire + '</span>' : '') +
      (done ? '<span class="bd">✓</span>' : '') + '</button>');
  }
  if (face === 'tile') {
    const sz = size || cellSize();
    return wrap(open + '<span class="tl" style="min-height:' + sz + 'rem;background:' + esc(c.col) +
      (done ? '2E' : '14') + ';border-color:' + esc(c.col) + (done ? '' : '33') + '">' +
      '<span class="tv">' + centerOf(c, k, x, done) + '</span>' +
      '<span class="tb"><i style="width:' + Math.round(p * 100) + '%;background:' + esc(c.col) + '"></i></span></span>' +
      capOf(c, k) + '</button>');
  }
  return wrap(open + faceSvg(c, x, size || cellSize()) +
    '<div class="cen">' + centerOf(c, k, x, done) + '</div>' + capOf(c, k) + '</button>');
}

/** Строка дела в списке. */
export function taskLi(t, k, opts = {}) {
  const s = W.st(t, k), cls = s === 'done' || s === 'ins' ? 'done' : s === 'fail' ? 'fail' : '';
  const c = W.circleById[t.c], m = W.markOf(t, k);
  const tag = s === 'fail' ? '<span class="tagi w">сдался</span>' : s === 'ins' ? '<span class="tagi">страховка</span>' : '';
  const by = m && m.by && m.by !== W.me && (s === 'done' || s === 'ins') ? '<span class="tagi g">закрыл' + (W.say(m.by, '', 'а') ) + ' ' + esc(W.name(m.by)) + '</span>' : '';
  const ro = c && c._ro;
  const rep = t.r ? t.r.map((x, i) => x ? DN[i] : '').filter(Boolean).join(' ') : 'разово';
  return '<li class="t ' + cls + '">' +
    (ro ? '<span class="bx' + (cls === 'done' ? ' on' : '') + '">' + chk() + '</span>'
        : '<button class="bx" data-a="tk" data-id="' + esc(t.id) + '" data-k="' + k + '" aria-label="Отметить">' + chk() + '</button>') +
    '<span class="nm2"><span class="ttl">' + esc(t.n) + '</span><span class="mini">' +
    (opts.circle && c ? '<span class="tagi">' + esc(c.i + ' ' + c.n) + '</span>' : '') +
    (c && c._shared ? whoTag(W.doerOf(t)) : '') + (t.prv ? '<span class="tagi prv">🔒</span>' : '') +
    (t.q ? '<span class="tagi">' + esc(t.q) + '</span>' : '') + (t.pr ? '<span class="tagi">' + esc(money(t.pr)) + '</span>' : '') +
    (opts.rep !== false ? '<span class="tagi">' + rep + '</span>' : '') +
    (t.by ? '<span class="tagi">от ' + esc(W.gen(t.by)) + '</span>' : '') + tag + by + '</span></span>' +
    (ro ? '' : '<button class="del" data-a="edit" data-id="' + esc(t.id) + '" aria-label="Изменить">✎</button>' +
      (s === 'open' && k <= W.today ? '<button class="del" data-a="fail" data-id="' + esc(t.id) + '" data-k="' + k + '" aria-label="Сдаться">' + X_ICON + '</button>' : '')) +
    '</li>';
}

export function segs(k) {
  return '<div class="segs">' + W.myCircles.filter(c => !c.off).map(c => {
    const x = W.prog(c, k);
    return '<i title="' + esc(c.n) + '"><b style="background:' + esc(c.col) + ';transform:scaleX(' + (x.empty ? 0 : x.p).toFixed(3) + ')"></b></i>';
  }).join('') + '</div>';
}

/** Карточка покупки/хотелки. */
export function wishCard(w) {
  const url = safeUrl(w.url), img = safeUrl(w.img);
  const b = W.boards.find(x => x.id === w.board);
  const mineClaim = W.S.data.claims[w.id] && !W.S.data.claims[w.id].off;
  const forTxt = w.for === 'us' ? 'нам' : w.for === W.me ? 'мне' : w.for === 'other' ? (w.forName || 'другому') : W.name(w.for);
  const corner = [];
  if (w.sur) corner.push('<span class="sur">🤫 сюрприз</span>');
  if (w.vis === 'prv' && !w.sur) corner.push('<span>🔒</span>');
  if (mineClaim) corner.push('<span class="sur">🎁 дарю я</span>');
  if (w.st === 'plan') corner.push('<span>в плане</span>');
  if (w.st === 'bought') corner.push('<span>куплено</span>');
  const occ = w.date ? ' · ' + (w.occ ? esc(w.occ) + ' ' : '') + esc(shortK(w.date)) + ' (' + esc(inDays(w.date)) + ')' : '';
  const acts = [];
  if (url) acts.push('<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">↗ открыть</a>');
  if (w.st !== 'bought') acts.push('<button class="ok" data-a="wbought" data-id="' + esc(w.id) + '">куплено</button>');
  else acts.push('<button data-a="wunbought" data-id="' + esc(w.id) + '">вернуть</button>');
  if (!w._mine && w.for === w.own) acts.push('<button data-a="wclaim" data-id="' + esc(w.id) + '">' + (mineClaim ? 'не дарю' : 'я подарю') + '</button>');
  if (w.st !== 'bought') acts.push('<button data-a="wpledge" data-id="' + esc(w.id) + '">наградой</button>');
  if (w.st !== 'bought' && W.myCircles.some(c => c.k === 'shop')) acts.push('<button data-a="wtoday" data-id="' + esc(w.id) + '">в список</button>');
  acts.push('<button data-a="wedit" data-id="' + esc(w.id) + '">✎</button>');
  return '<div class="wc' + (w.st === 'bought' ? ' bought' : '') + '">' +
    '<div class="im">' + (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" referrerpolicy="no-referrer">' : esc((b && b.i) || '🛍')) + '</div>' +
    (corner.length ? '<div class="corner">' + corner.join('') + '</div>' : '') +
    '<div class="bd"><div class="tt">' + esc(w.t) + '</div>' +
    (w.pr ? '<div class="pr">' + esc(money(w.pr * (w.qty > 1 ? w.qty : 1), w.cur || '₴')) + (w.qty > 1 ? ' <span class="pri">×' + w.qty + '</span>' : '') + '</div>' : '') +
    '<div class="ds">' + (w.pri ? '<span class="pri">' + '★'.repeat(w.pri) + '</span> ' : '') + 'для: ' + esc(forTxt) +
    (w.store || url ? ' · ' + esc(w.store || domainOf(url)) : '') + occ + (w._mine ? '' : ' · от ' + esc(W.gen(w.own))) + '</div>' +
    (w.note ? '<div class="ds">' + esc(w.note) + '</div>' : '') +
    '<div class="ft">' + acts.join('') + '</div></div></div>';
}

export function eventRow(e, opts = {}) {
  const [, ico, kn] = evKind(e.kind);
  const d = e.date ? new Date(e.date + 'T00:00') : null;
  const mineAns = W.rsvpMine[e.id], yourAns = W.rsvpYou[e.id];
  const ans = a => a && !a.off ? ({ yes: '✅', no: '❌', maybe: '🤔' }[a.s] || '') : '·';
  const other = e._mine ? yourAns : mineAns;
  return '<div class="ev' + (e.done ? ' done' : '') + '">' +
    '<div class="dt2"><b class="osw">' + (d ? d.getDate() : '—') + '</b><span>' + (d ? DN[(d.getDay() + 6) % 7] : '') + '</span></div>' +
    '<div class="x"><b>' + ico + ' ' + esc(e.t) + '</b><small>' + esc(kn) + (e.time ? ' · ' + esc(e.time) : '') +
    (e.place ? ' · ' + esc(e.place) : '') + (e.date ? ' · ' + esc(inDays(e.date)) : '') + '</small>' +
    '<small>' + (e.with === 'us' ? 'вместе · ' + (e._mine ? esc(W.name(W.you)) + ': ' + ans(other) : 'зовёт ' + esc(W.name(e.own))) : 'только ' + (e._mine ? 'я' : esc(W.name(e.own)))) +
    (e.vis === 'prv' ? ' · 🔒' : '') + '</small>' +
    (opts.rsvp && e.with === 'us' && !e._mine && !e.done ? '<div class="rsvp">' + [['yes', 'иду'], ['maybe', 'может'], ['no', 'не смогу']].map(([v, l]) =>
      '<button data-a="rsvp" data-id="' + esc(e.id) + '" data-v="' + v + '" aria-pressed="' + !!(mineAns && !mineAns.off && mineAns.s === v) + '">' + l + '</button>').join('') + '</div>' : '') +
    '</div>' +
    (e._mine || e.with === 'us' ? '<button class="del" data-a="evedit" data-id="' + esc(e.id) + '" aria-label="Изменить">✎</button>' : '') +
    '</div>';
}

export function header(dt, title, right = '') {
  return '<div class="hd"><div><div class="dt">' + esc(dt).toUpperCase() + '</div><h1>' + esc(title) + '</h1></div>' +
    '<div class="rowbtns">' + right + '</div></div>';
}

export function syncPill(sync) {
  if (sync.st === 'off') return '<button class="sync" data-a="more" data-v="sync"><i></i>локально</button>';
  const cls = sync.st === 'ok' ? 'ok' : sync.st === 'err' ? 'err' : 'busy';
  const lab = sync.st === 'err' ? 'ошибка' : sync.st === 'busy' ? 'синхр…' : 'в сети';
  return '<button class="sync ' + cls + '" data-a="more" data-v="sync" title="' + esc(sync.msg) + '"><i></i>' + lab + '</button>';
}

