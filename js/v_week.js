/* Неделя: сетка галочек по делам и счётчикам. */
import { esc, fmt, pl, DN, human, parse, addD, wkStart, key, todayDate } from './util.js';
import { W, nav } from './ctx.js';
import { S } from './store.js';
import { pick, tgl } from './ui.js';

function wkDays() {
  const ws = addD(wkStart(todayDate()), nav.WOFF), a = [];
  for (let i = 0; i < 7; i++) { if (!S.ui.wk.weekend && i > 4) continue; a.push(key(addD(ws, i))); }
  return a;
}
const gridTpl = n => 'minmax(0,1fr) repeat(' + n + ',1.9rem)' + (S.ui.wk.tot ? ' 2.6rem' : '');

function wkCell(t, k) {
  if (!W.onDate(t, k)) return '<span class="cbx off">·</span>';
  const s = W.st(t, k), fut = k > W.today, c = W.circleById[t.c];
  const cls = s === 'done' ? 'on' : s === 'ins' ? 'ins' : s === 'fail' ? 'no' : (fut ? 'fut' : '');
  const mark = s === 'done' || s === 'ins' ? '✓' : s === 'fail' ? '✕' : '';
  if (c && c._ro) return '<span class="cbx ' + cls + '">' + mark + '</span>';
  return '<button class="cbx ' + cls + '" data-a="wc" data-id="' + esc(t.id) + '" data-k="' + k + '" aria-label="' + esc(t.n) + '">' + mark + '</button>';
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
  const F = S.ui.wk, days = wkDays(), ws = addD(wkStart(todayDate()), nav.WOFF);
  const head = '<div class="wkh" style="grid-template-columns:' + gridTpl(days.length) + '"><span></span>' +
    days.map(k => { const d = parse(k); return '<span class="' + (k === W.today ? 'td' : '') + '">' + DN[(d.getDay() + 6) % 7] + '<br>' + d.getDate() + '</span>'; }).join('') +
    (F.tot ? '<span class="tot">итог</span>' : '') + '</div>';
  const list = visibleTasks(days);
  const sortT = ts => {
    if (F.sort === 'fail') ts.sort((a, b) => { const x = rowScore(a, days), y = rowScore(b, days); return x.d / (x.a || 1) - y.d / (y.a || 1); });
    if (F.sort === 'abc') ts.sort((a, b) => a.n.localeCompare(b.n));
    return ts;
  };
  const rowHTML = t => {
    const sc = rowScore(t, days), c = W.circleById[t.c], pct = sc.a ? sc.d / sc.a : 0, doer = W.doerOf(t);
    const bg = F.heat && pct ? ';background:rgba(29,143,91,' + (pct * 0.16).toFixed(2) + ')' : '';
    const who = doer === 'both' ? 'оба' : doer === W.me ? 'я' : W.name(doer);
    return '<div class="wkr" style="grid-template-columns:' + gridTpl(days.length) + bg + '"><div class="tn">' + esc(t.n) + '<small>' +
      esc(F.group === 'circle' ? who : (c ? c.i + ' ' + c.n : '')) + (t.prv ? ' · 🔒' : '') + '</small></div>' +
      days.map(k => wkCell(t, k)).join('') + (F.tot ? '<span class="totc"><b>' + sc.d + '</b>/' + sc.a + '</span>' : '') + '</div>';
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
        body += title + '<div class="wkr" style="grid-template-columns:' + gridTpl(days.length) + '"><div class="tn">' + esc(c.n) + '<small>' +
          (c.k === 'mood' ? 'настроение' : (c.per === 'week' ? 'в неделю ' : 'цель ') + fmt(c.g) + ' ' + esc(c.u)) + '</small></div>' +
          days.map(k => {
            const v = W.cval(c, k);
            if (c.k === 'mood') return '<span class="cbx off" style="color:var(--ink);font-size:1rem">' + (v ? ['😣', '😕', '😐', '🙂', '😄'][v - 1] : '·') + '</span>';
            const p = c.per === 'week' ? (v ? 1 : 0) : Math.min(1, v / c.g);
            return '<span class="cbx ' + (p >= 1 ? 'on' : '') + '" title="' + fmt(v) + '" style="' + (p > 0 && p < 1 ? 'background:linear-gradient(to top,' + esc(c.col) + ' ' +
              Math.round(p * 100) + '%,transparent 0);border-color:' + esc(c.col) : '') + '">' + (p >= 1 ? (c.per === 'week' ? v : '✓') : '') + '</span>';
          }).join('') +
          (F.tot ? '<span class="totc"><b>' + (c.k === 'mood' ? days.filter(k => W.cval(c, k)).length : c.per === 'week' ? fmt(W.cweek(c, days[0])) : days.filter(k => W.cval(c, k) >= c.g).length) +
            '</b>/' + (c.per === 'week' ? fmt(c.g) : days.length) + '</span>' : '') + '</div>';
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
  return '<div class="hd"><div><div class="dt">' + esc(lab).toUpperCase() + '</div><h1>Галочки недели</h1></div><div class="rowbtns">' +
    '<button class="ghost" data-a="wshift" data-v="-7" aria-label="Назад">‹</button>' + (nav.WOFF ? '<button class="ghost" data-a="wshift" data-v="0">эта</button>' : '') +
    '<button class="ghost" data-a="wshift" data-v="7" aria-label="Вперёд">›</button><button class="ghost" data-a="wkset">вид</button></div></div>' +
    '<div class="sec">' + sum + '<div class="wk" style="overflow-x:auto">' + head + body +
    '<div class="wkf">Тап по клетке: сделано → сдался → пусто. Точка — в этот день дело не стоит, пунктир — будущее. Показано ' + list.length + ' ' +
    pl(list.length, ['дело', 'дела', 'дел']) + ' из ' + W.tasks.length + '.</div></div></div>';
}

export function sheetWkSet() {
  const F = S.ui.wk;
  return '<div class="sn">Вид недели</div>' +
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
    tgl('wkt', 'tot', F.tot, 'Колонка итога', 'Сколько из скольких за неделю') +
    tgl('wkt', 'heat', F.heat, 'Подсветка строк', 'Чем лучше неделя, тем зеленее фон') +
    tgl('wkt', 'sum', F.sum, 'Сводка сверху', 'Четыре цифры по неделе') + '</div>' +
    '<div class="fld"><label>Плотность строк</label>' + pick('dens', S.ui.dens, [['compact', 'плотно'], ['normal', 'обычно'], ['roomy', 'просторно']]) + '</div>' +
    '<div class="srow"><button data-a="close" class="k">Готово</button></div>';
}
