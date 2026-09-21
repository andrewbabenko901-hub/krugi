/* Неделя: сетка галочек по делам и счётчикам. */
import { esc, fmt, pl, DN, human, parse, addD, wkStart, key, todayDate } from './util.js';
import { W, nav } from './ctx.js';
import { S } from './store.js';
import { pick, tgl } from './ui.js';
import { weekRing, weekCircles } from './faces.js';

function wkDays() {
  const ws = addD(wkStart(todayDate()), nav.WOFF), a = [];
  for (let i = 0; i < 7; i++) { if (!S.ui.wk.weekend && i > 4) continue; a.push(key(addD(ws, i))); }
  return a;
}
const gridTpl = n => 'minmax(0,1fr) repeat(' + n + ',1.85rem)';

/* Виды галочек: у каждого своя подпись и образец для настройки. */
export const CHK = [
  ['fill', 'Цветные', 'закрашенный кружок с белой галочкой'],
  ['soft', 'Пастель', 'нежная заливка, галочка цветом строки'],
  ['ring', 'Контур', 'цветное колечко с галочкой внутри'],
  ['dot', 'Точки', 'без галочек — просто цветная точка'],
  ['emoji', 'Эмодзи', 'вместо галочки — значок круга'],
  ['box', 'Квадраты', 'строгие квадратики, как было'],
];

/* Цвет строки. У трекера привычек у каждой строки свой цвет — так глаз
   сразу находит нужную. Цвет берётся от дела, поэтому не прыгает. */
const ROWPAL = ['#4DA3F5', '#A67CE0', '#7FA36B', '#EFC93A', '#EE6A7C', 'ink', '#5DC794', '#6A5BD8', '#C99BD9', '#F29B4B', '#3FB8C9'];
function hueVars(col) {
  if (col === 'ink') return '--c:var(--ink);--cs:var(--line);--ck:var(--inv)';
  return '--c:' + col + ';--cs:' + col + '33;--ck:#fff';
}
/* Цвета идут по порядку строк: так соседние никогда не совпадают. */
let rowN = 0;
const nextCol = () => ROWPAL[rowN++ % ROWPAL.length];
const rowCol = (t, c) => (S.ui.wk.hue === 'circle' ? (c ? c.col : '#7B7D85') : nextCol());

/* Расписание строкой: «каждый день», «по будням», «Вт, Чт, Сб», «разово». */
function sched(t) {
  if (!t.r) return 'разово';
  const on = t.r.map(Boolean), n = on.filter(Boolean).length;
  if (n === 7) return 'каждый день';
  if (n === 5 && on.slice(0, 5).every(Boolean)) return 'по будням';
  if (n === 2 && on[5] && on[6]) return 'по выходным';
  return DN.filter((_, i) => on[i]).map(d => d[0].toUpperCase() + d.slice(1)).join(', ');
}

/* Одна галочка. state: done | ins | fail | open | fut | off. */
function bubble(state, today, inner, attrs) {
  const tag = attrs ? 'button' : 'span';
  return '<' + tag + ' class="bb ' + state + (today ? ' td' : '') + '"' + (attrs || '') + '>' + (inner || '') + '</' + tag + '>';
}
function wkCell(t, k, c, emo) {
  const today = k === W.today;
  if (!W.onDate(t, k)) return bubble('off', today, '');
  const s = W.st(t, k), fut = k > W.today;
  const state = s === 'done' ? 'done' : s === 'ins' ? 'ins' : s === 'fail' ? 'fail' : fut ? 'fut' : 'open';
  const inner = state === 'done' || state === 'ins'
    ? (S.ui.wk.chk === 'emoji' ? '<i class="em">' + esc(emo) + '</i>' : '<i class="ck">✓</i>')
    : state === 'fail' ? '<i class="ck">−</i>' : '';
  if (c && c._ro) return bubble(state, today, inner);
  return bubble(state, today, inner, ' data-a="wc" data-id="' + esc(t.id) + '" data-k="' + k + '" aria-label="' + esc(t.n) + '"');
}
function visibleTasks(days) {
  const F = S.ui.wk;
  return W.tasks.filter(t => {
    const c = W.circleById[t.c]; if (!c) return false;
    if (c._ro && !F.partner) return false;
    if (!F.once && !t.r) return false;
    const doer = W.doerOf(t);
    if (!F.partner && doer === W.you) return false;
    if (!F.priv && (t.prv || c.vis === 'prv')) return false;
    if (F.fc !== 'all' && t.c !== F.fc) return false;
    if (F.fw !== 'all' && doer !== (F.fw === 'me' ? W.me : F.fw === 'you' ? W.you : 'both')) return false;
    if (!days.some(k => W.onDate(t, k))) return false;
    if (!F.done) { const all = days.filter(k => W.onDate(t, k)); if (all.length && all.every(k => W.isDone(t, k))) return false; }
    return true;
  });
}
const rowScore = (t, days) => { const ap = days.filter(k => W.onDate(t, k)); return { d: ap.filter(k => W.isDone(t, k)).length, a: ap.length }; };

export function vWeek() {
  rowN = 0;
  const F = S.ui.wk, days = wkDays(), ws = addD(wkStart(todayDate()), nav.WOFF);
  const head = '<div class="wkh" style="grid-template-columns:' + gridTpl(days.length) + '"><span></span>' +
    days.map(k => { const d = parse(k); return '<span class="' + (k === W.today ? 'td' : '') + '">' + DN[(d.getDay() + 6) % 7] + '<br>' + d.getDate() + '</span>'; }).join('') +
    '</div>';
  const list = visibleTasks(days);
  const sortT = ts => {
    if (F.sort === 'fail') ts.sort((a, b) => { const x = rowScore(a, days), y = rowScore(b, days); return x.d / (x.a || 1) - y.d / (y.a || 1); });
    if (F.sort === 'abc') ts.sort((a, b) => a.n.localeCompare(b.n));
    return ts;
  };
  const rowHTML = t => {
    const sc = rowScore(t, days), c = W.circleById[t.c], pct = sc.a ? sc.d / sc.a : 0, doer = W.doerOf(t);
    const col = rowCol(t, c);
    const bg = F.heat && pct ? ';background:' + (col === 'ink' ? 'var(--line2)'
      : col + Math.round(8 + pct * 14).toString(16).padStart(2, '0')) : '';
    const who = doer === 'both' ? 'оба' : doer === W.me ? '' : W.name(doer);
    const sub = [sched(t), F.group === 'circle' ? '' : (c ? c.n : ''), who, t.prv ? '🔒' : '',
                 F.tot && sc.a ? sc.d + '/' + sc.a : ''].filter(Boolean).join(' · ');
    // значок круга у строки нужен, только когда строки не сгруппированы по кругу
    const te = F.group === 'circle' ? '' : '<span class="te">' + esc(c ? c.i : '•') + '</span>';
    return '<div class="wkr" style="grid-template-columns:' + gridTpl(days.length) + bg + ';' + hueVars(col) + '">' +
      '<div class="tn">' + te + '<span class="tt"><b>' + esc(t.n) + '</b>' +
      '<small>' + esc(sub) + '</small></span></div>' +
      days.map(k => wkCell(t, k, c, c ? c.i : '✓')).join('') + '</div>';
  };
  let body = '';
  if (F.group === 'circle') {
    for (const c of W.circles) {
      if (F.fc !== 'all' && c.id !== F.fc) continue;
      if (c._ro && !F.partner) continue;
      if (!F.priv && c.vis === 'prv') continue;
      const title = '<div class="wkg"><span style="color:' + esc(c.col) + '">●</span>' + esc(c.i + ' ' + c.n) + (c._ro ? ' · ' + esc(W.name(c.own)) : '') + '</div>';
      if (c.k === 'count' || c.k === 'mood') {
        if (!F.count) continue;
        const ccol = F.hue === 'circle' ? c.col : nextCol();
        body += title + '<div class="wkr" style="grid-template-columns:' + gridTpl(days.length) + ';' + hueVars(ccol) + '">' +
          '<div class="tn"><span class="tt"><b>' + esc(c.n) + '</b><small>' +
          (c.k === 'mood' ? 'настроение' : (c.per === 'week' ? 'в неделю ' : 'цель ') + fmt(c.g) + ' ' + esc(c.u)) +
          (F.tot ? ' · ' + (c.k === 'mood' ? days.filter(k => W.cval(c, k)).length + '/' + days.length
            : c.per === 'week' ? fmt(W.cweek(c, days[0])) + '/' + fmt(c.g)
            : days.filter(k => W.cval(c, k) >= c.g).length + '/' + days.length) : '') + '</small></span></div>' +
          days.map(k => {
            const v = W.cval(c, k), today = k === W.today, on = W.active(c, k);
            if (!on) return bubble('off', today, '');
            if (c.k === 'mood') return bubble(v ? 'mood' : (k > W.today ? 'fut' : 'open'), today, v ? '<i class="em">' + ['😣', '😕', '😐', '🙂', '😄'][v - 1] + '</i>' : '');
            const p = c.per === 'week' ? (v ? 1 : 0) : Math.min(1, v / c.g);
            if (p >= 1) return bubble('done', today, S.ui.wk.chk === 'emoji' ? '<i class="em">' + esc(c.i) + '</i>' : '<i class="ck">' + (c.per === 'week' ? fmt(v) : '✓') + '</i>');
            // недобор — кружок заполнен снизу ровно настолько, насколько набрано
            return '<span class="bb part' + (today ? ' td' : '') + '" title="' + esc(fmt(v)) + '" style="--p:' + Math.round(p * 100) + '%"></span>';
          }).join('') + '</div>';
        continue;
      }
      const ts = sortT(list.filter(t => t.c === c.id));
      if (ts.length) body += title + ts.map(rowHTML).join('');
    }
  } else if (F.group === 'who') {
    for (const [w, nm] of [[W.me, 'Мои'], ['both', 'Общие на двоих'], [W.you, W.name(W.you)]]) {
      const ts = sortT(list.filter(t => W.doerOf(t) === w));
      if (ts.length) body += '<div class="wkg">' + esc(nm) + '</div>' + ts.map(rowHTML).join('');
    }
  } else body += sortT(list.slice()).map(rowHTML).join('');
  if (!body) body = '<div class="wkr" style="grid-template-columns:1fr"><div class="tn">Под текущие фильтры ничего не попало.</div></div>';

  const past = days.filter(k => k <= W.today);
  const doneD = past.filter(k => W.full(W.me, k)).length;
  const tot = days.reduce((a, k) => a + W.dayOf(W.me, k).a, 0), dn = days.reduce((a, k) => a + W.dayOf(W.me, k).d, 0);
  const duo = W.hasPartner ? past.filter(k => W.duoFull(k)).length : null;
  const sum = F.sum ? '<div class="sumrow"><div class="sumcell"><b>' + (tot ? Math.round(dn / tot * 100) : 0) + '%</b><span>закрыто за неделю</span></div>' +
    '<div class="sumcell"><b>' + doneD + '</b><span>полных дней</span></div><div class="sumcell"><b>' + dn + '</b><span>дел закрыто</span></div>' +
    '<div class="sumcell"><b>' + (duo != null ? duo : tot - dn) + '</b><span>' + (duo != null ? 'дней закрыли оба' : 'осталось') + '</span></div></div>' : '';
  const lab = nav.WOFF === 0 ? 'эта неделя' : nav.WOFF === -7 ? 'прошлая неделя' : nav.WOFF === 7 ? 'следующая неделя' : human(ws) + ' — ' + human(addD(ws, 6));
  // Круги недели: то же, что на главном, но целиком и крупнее
  const wc = weekCircles();
  const rings = F.rings && wc.length
    ? '<div class="card sec"><div class="ch"><h3>Круги недели</h3><button class="lnk" data-a="wkt" data-k="rings">скрыть</button></div>' +
      '<div class="wkrings">' + wc.map(c => weekRing(c, key(ws), 6.2)).join('') + '</div></div>'
    : '';
  return '<div class="hd"><div><div class="dt">' + esc(lab).toUpperCase() + '</div><h1>Галочки недели</h1></div><div class="rowbtns">' +
    '<button class="ghost" data-a="wshift" data-v="-7" aria-label="Назад">‹</button>' + (nav.WOFF ? '<button class="ghost" data-a="wshift" data-v="0">эта</button>' : '') +
    '<button class="ghost" data-a="wshift" data-v="7" aria-label="Вперёд">›</button><button class="ghost" data-a="wkset">вид</button></div></div>' +
    rings + '<div class="sec">' + sum + '<div class="wk chk-' + esc(F.chk || 'fill') + '" style="overflow-x:auto">' + head + body +
    '<div class="wkf">Тап по кружку: сделано → пропущено → пусто. Маленькая точка — в этот день дело не стоит, обведённый — сегодня. Показано ' + list.length + ' ' +
    pl(list.length, ['дело', 'дела', 'дел']) + ' из ' + W.tasks.length + '.</div></div></div>';
}

export function sheetWkSet() {
  const F = S.ui.wk;
  const demo = (chk, col) => {
    const v = hueVars(col);
    return '<span class="wk chk-' + chk + ' demo" style="' + v + '">' +
      bubble('done', false, chk === 'emoji' ? '<i class="em">💧</i>' : '<i class="ck">✓</i>') +
      bubble('done', true, chk === 'emoji' ? '<i class="em">💧</i>' : '<i class="ck">✓</i>') +
      bubble('open', false, '') + bubble('fail', false, '<i class="ck">−</i>') + '</span>';
  };
  return '<div class="sn">Вид недели</div>' +
    '<div class="fld"><label>Галочки</label><div class="chks">' + CHK.map(([id, nm, d], i) =>
      '<button class="chkb" data-a="wkchk" data-v="' + id + '" aria-pressed="' + ((F.chk || 'fill') === id) + '">' +
      demo(id, ROWPAL[i % ROWPAL.length]) + '<b>' + esc(nm) + '</b><small>' + esc(d) + '</small></button>').join('') + '</div></div>' +
    '<div class="fld"><label>Цвет строк</label>' + pick('wkhue', F.hue || 'row', [['row', 'у каждого дела свой'], ['circle', 'цвет круга']]) + '</div>' +
    '<div class="fld"><label>Группировка</label>' + pick('wkg', F.group, [['circle', 'по кругам'], ['who', 'по людям'], ['flat', 'сплошной список']]) + '</div>' +
    '<div class="fld"><label>Сортировка внутри группы</label>' + pick('wks', F.sort, [['circle', 'как в списке'], ['fail', 'сначала проваленные'], ['abc', 'по алфавиту']]) + '</div>' +
    '<div class="fld"><label>Фильтр по кругу</label>' + pick('wkfc', F.fc, [['all', 'все']].concat(W.circles.map(c => [c.id, c.i + ' ' + c.n]))) + '</div>' +
    '<div class="fld"><label>Фильтр по человеку</label>' + pick('wkfw', F.fw, [['all', 'все'], ['me', 'я'], ['both', 'оба'], ['you', W.name(W.you)]]) + '</div>' +
    '<div class="card sec">' +
    tgl('wkt', 'weekend', F.weekend, 'Выходные', 'Без них остаётся рабочая пятидневка') +
    tgl('wkt', 'count', F.count, 'Счётчики и настроение', 'Вода, шаги, чтение — заливкой по проценту') +
    tgl('wkt', 'once', F.once, 'Разовые дела', 'Иначе только регулярные привычки') +
    tgl('wkt', 'done', F.done, 'Полностью закрытые', 'Спрятать то, что сделано всю неделю') +
    tgl('wkt', 'partner', F.partner, 'Дела и круги ' + W.gen(W.you), '') +
    tgl('wkt', 'priv', F.priv, 'Личное', 'Круги и дела с замком') +
    tgl('wkt', 'tot', F.tot, 'Итог в строке', 'Сколько из скольких за неделю — под названием') +
    tgl('wkt', 'heat', F.heat, 'Подсветка строк', 'Чем лучше неделя, тем зеленее фон') +
    tgl('wkt', 'sum', F.sum, 'Сводка сверху', 'Четыре цифры по неделе') +
    tgl('wkt', 'rings', F.rings, 'Круги недели', 'Большие круги с дольками по дням') + '</div>' +
    '<div class="fld"><label>Плотность строк</label>' + pick('dens', S.ui.dens, [['compact', 'плотно'], ['normal', 'обычно'], ['roomy', 'просторно']]) + '</div>' +
    '<div class="srow"><button data-a="close" class="k">Готово</button></div>';
}
