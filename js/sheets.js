/* Шторки: круг, дело, настройка круга, обещание, план, карточка, даты. */
import { esc, fmt, pl, DN, human, parse, addK, wkStartK, money, domainOf, inDays, shortK } from './util.js';
import { W, nav } from './ctx.js';
import { S } from './store.js';
import { ring, pick, chk, tgl } from './ui.js';
import { taskLi, circleSub, circleLabel, MOODS, UNITS, EMO, PAL, EVENT_KINDS, VIS, whoTag } from './parts.js';
import { PLEDGE_TYPES } from './model.js';
import { EMOJI, EMOJI_KEYS } from './emoji.js';
import { FACES, FACE_NAMES, facePreview, faceOf } from './faces.js';

/* ---------- круг ---------- */
export const CS = { gw: null, prv: 0 };       // черновик: кто делает и личное ли новое дело
export function sheetCircle(cid) {
  const c = W.circleById[cid];
  if (!c) return '<div class="sn">Круг удалён</div><div class="srow"><button data-a="close">Закрыть</button></div>';
  const k = nav.VD, fut = k > W.today, x = W.prog(c, k);
  let body = '';
  if (c.k === 'count') {
    const v = W.cval(c, k), stp = c.stp || 1, ws = wkStartK(k);
    const head = c.per === 'week'
      ? '<div class="bigcnt"><div class="bv osw">' + fmt(W.cweek(c, k)) + '</div><div class="bu">из ' + fmt(c.g) + ' ' + esc(c.u) + ' за неделю · сегодня ' + fmt(v) + '</div></div>'
      : '<div class="bigcnt"><div class="bv osw">' + fmt(v) + '</div><div class="bu">из ' + fmt(c.g) + ' ' + esc(c.u) + ' · ' + esc(human(parse(k))) + '</div></div>';
    body = head + (c._ro || fut ? '' :
      (c.per === 'week' ? '' : '<input type="range" min="0" max="' + Math.max(c.g, v) + '" step="' + stp + '" value="' + v + '" data-a="crange" aria-label="Значение">') +
      '<div class="srow"><button data-a="cadd" data-v="-' + stp + '">−' + fmt(stp) + '</button><button data-a="cadd" data-v="' + stp + '">+' + fmt(stp) + '</button>' +
      (c.per === 'week' ? '' : '<button data-a="cfull" class="k">Цель взята</button>') + '</div>' +
      '<div class="add"><input id="cexact" type="number" inputmode="numeric" placeholder="точное число за день"><button data-a="cexact">Записать</button></div>') +
      '<div class="card sec"><h3>Неделя</h3><div class="cols7">' + DN.map((_, i) => {
        const kk = addK(ws, i), vv = W.cval(c, kk), h = c.per === 'week' ? Math.min(1, vv / Math.max(1, c.g / 3)) : Math.min(1, vv / c.g);
        return '<i class="' + (c.per === 'week' ? (vv ? '' : 'low') : vv >= c.g ? '' : 'low') + '" style="height:' + Math.max(4, Math.round(h * 100)) + '%;' + (vv >= c.g || (c.per === 'week' && vv) ? 'background:' + esc(c.col) : '') + '" title="' + fmt(vv) + '"></i>';
      }).join('') + '</div><div class="clab">' + DN.map(d => '<span>' + d + '</span>').join('') + '</div>' +
      '<div class="sub">За неделю: ' + fmt(W.cweek(c, k)) + ' ' + esc(c.u) + (c.per === 'week' ? '' : ', в среднем ' + fmt(Math.round(W.cweek(c, k) / 7)) + ' в день') + '.</div></div>';
  } else if (c.k === 'mood') {
    const v = W.cval(c, k), note = W.cnote(c, k);
    body = (c._ro ? '<div class="bigcnt"><div class="bv">' + (v ? MOODS[v - 1][0] : '·') + '</div><div class="bu">' + (v ? MOODS[v - 1][1] : 'не отмечено') + (note ? ' · ' + esc(note) : '') + '</div></div>'
      : '<div class="mood">' + MOODS.map((m, i) => '<button data-a="mood" data-id="' + esc(c.id) + '" data-v="' + (i + 1) + '" aria-pressed="' + (v === i + 1) + '">' + m[0] + '<small>' + m[1] + '</small></button>').join('') + '</div>' +
        '<div class="add"><input id="mnote" value="' + esc(note) + '" placeholder="одной строкой: почему так"><button data-a="mnote" data-id="' + esc(c.id) + '">Записать</button></div>') +
      '<div class="card sec"><h3>Две недели</h3><div class="heat" style="grid-template-columns:repeat(14,1fr)">' + Array.from({ length: 14 }, (_, i) => {
        const kk = addK(k, i - 13), vv = W.cval(c, kk);
        return '<i title="' + kk + '" style="display:grid;place-items:center;font-size:.8rem;font-style:normal;background:' + (vv ? 'transparent' : 'var(--track)') + '">' + (vv ? MOODS[vv - 1][0] : '') + '</i>';
      }).join('') + '</div></div>';
  } else if (c.k === 'shop') body = shopBody(c, k);
  else {
    const a = W.tasksOf(c.id, k);
    if (!CS.gw) CS.gw = W.me;
    body = (a.length ? '<ul>' + a.map(t => taskLi(t, k, { rep: true })).join('') + '</ul>' : '<div class="sub">В этот день здесь пусто.</div>') +
      (c._ro ? '' : '<div class="add"><input id="gi" placeholder="Добавить в «' + esc(c.n) + '»"><button data-a="gadd">Плюс</button></div>' +
        (c._shared ? pick('gw', CS.gw, [[W.me, 'я'], [W.you, W.name(W.you)], ['both', 'оба']]) : '') +
        (c.vis !== 'prv' ? pick('gprv', CS.prv, [[0, 'видно как круг'], [1, '🔒 личное']]) : '') +
        '<div class="sub">Закрыто ' + (x.d || 0) + ' из ' + (x.a || 0) + '. Крестик — «сдался». Карандаш — дни, исполнитель, приватность.</div>' +
        (fut || !a.length ? '' : '<div class="srow"><button data-a="ins" data-id="' + esc(c.id) + '" class="w">Закрыть круг страховкой (' + W.insLeft(k) + ')</button></div>'));
  }
  // История круга: две недели полосками, серия и рекорды
  const hist = (() => {
    const st = W.cstreak(c, k), best = W.cbest(c);
    const bars = Array.from({ length: 14 }, (_, i) => {
      const kk = addK(k, i - 13), xx = W.prog(c, kk), on = W.active(c, kk);
      const h = on && !xx.empty ? Math.max(8, Math.round(Math.min(1, xx.p) * 100)) : 0;
      const t = shortK(kk) + (on ? (xx.empty ? ': пусто' : ': ' + Math.round(xx.p * 100) + '%') : ': круг не работает');
      return '<i title="' + esc(t) + '"' + (kk === k ? ' class="td"' : '') + '><b style="height:' + h + '%;background:' +
        esc(c.col) + '"></b></i>';
    }).join('');
    return '<div class="card sec"><div class="ch"><h3>История</h3>' +
      (st > 1 ? '<span class="tagi">🔥 ' + st + ' ' + pl(st, ['день', 'дня', 'дней']) + ' подряд</span>' : '') + '</div>' +
      '<div class="hbars">' + bars + '</div>' +
      '<div class="sub">Две недели по сегодня. Лучшая серия: <b>' + best.streak + '</b> ' +
      pl(best.streak, ['день', 'дня', 'дней']) + (c.k === 'count' && best.top ? ', рекорд за день: <b>' + fmt(best.top) + '</b> ' + esc(c.u || '') : '') + '.</div></div>';
  })();

  const kudos = c._ro ? '<div class="kud">' + ['❤️', '👏', '🔥', '💪'].map(e => '<button data-a="kudos" data-v="' + e + '" data-about="' + esc(c.n) + '">' + e + '</button>').join('') + '</div>' : '';
  return '<div class="shead">' + ring(x.empty ? 0 : x.p, c.col, 3.6, .4) + '<div><div class="sn">' + esc(c.i + ' ' + c.n) + '</div><div class="ss">' + esc(circleSub(c)) + '</div></div></div>' +
    body + hist + kudos + '<div class="srow">' + (c._ro ? '' : '<button data-a="csetup" data-id="' + esc(c.id) + '">Настроить круг</button>') + '<button data-a="close">Закрыть</button></div>';
}

function shopBody(c, k) {
  const F = S.ui.shopF, all = W.tasksOf(c.id, k);
  const list = all.filter(t => {
    const w = W.doerOf(t);
    if (F.who === 'me' && w !== W.me) return false;
    if (F.who === 'you' && w !== W.you) return false;
    if (F.who === 'both' && w !== 'both') return false;
    if (F.left && W.isDone(t, k)) return false;
    if (F.store !== 'all' && (t.st || 'Без магазина') !== F.store) return false;
    return true;
  });
  const sum = list.reduce((a, t) => a + (t.pr || 0), 0), lsum = list.filter(t => !W.isDone(t, k)).reduce((a, t) => a + (t.pr || 0), 0);
  const stores = [...new Set(all.map(t => t.st || 'Без магазина'))];
  const by = {};
  for (const t of list) (by[t.st || 'Без магазина'] = by[t.st || 'Без магазина'] || []).push(t);
  if (!CS.gw) CS.gw = W.me;
  return (c._shared ? pick('sf', 'who:' + F.who, [['who:all', 'все'], ['who:me', 'мои'], ['who:you', W.name(W.you)], ['who:both', 'общие']], 'acc') : '') +
    '<div class="pick"><button class="pb acc" data-a="sf" data-v="left:' + (F.left ? 0 : 1) + '" aria-pressed="' + !!F.left + '">только осталось</button></div>' +
    (stores.length > 1 ? pick('sf', 'store:' + F.store, [['store:all', 'все магазины']].concat(stores.map(s => ['store:' + s, s]))) : '') +
    Object.keys(by).map(s => '<div class="wkg" style="padding-left:0">' + esc(s) + '</div>' + by[s].map(t => {
      const d = W.isDone(t, k);
      return '<div class="shoprow">' + (c._ro ? '<span class="bx' + (d ? ' on' : '') + '">' + chk() + '</span>' : '<button class="bx' + (d ? ' on' : '') + '" data-a="tk" data-id="' + esc(t.id) + '" data-k="' + k + '">' + chk() + '</button>') +
        '<span class="nm2"><span style="' + (d ? 'text-decoration:line-through;color:var(--mut)' : '') + '">' + esc(t.n) + '</span><span class="mini">' + (c._shared ? whoTag(W.doerOf(t)) : '') +
        (t.q ? '<span class="tagi">' + esc(t.q) + '</span>' : '') + (t.by ? '<span class="tagi">от ' + esc(W.gen(t.by)) + '</span>' : '') + (t.r ? '<span class="tagi">регулярно</span>' : '') + '</span></span>' +
        (t.pr ? '<span class="q2">' + esc(money(t.pr)) + '</span>' : '') + (c._ro ? '' : '<button class="del" data-a="edit" data-id="' + esc(t.id) + '" aria-label="Изменить">✎</button>') + '</div>';
    }).join('')).join('') +
    (!list.length ? '<div class="sub">Под фильтр ничего не попало.</div>' : '') +
    '<div class="sum"><span>Осталось купить на</span><b>' + esc(money(lsum) || '0 ₴') + '</b></div><div class="sum" style="border:0;padding-top:.2rem"><span>Весь список</span><b>' + esc(money(sum) || '0 ₴') + '</b></div>' +
    (c._ro ? '' : '<div class="add"><input id="gi" placeholder="Что купить"><button data-a="gadd">Плюс</button></div>' +
      (c._shared ? pick('gw', CS.gw, [[W.me, 'куплю я'], [W.you, 'купит ' + W.name(W.you)], ['both', 'кто первый']]) : '') +
      '<div class="sub">Цену, количество и магазин — карандашом. Большие покупки и подарки удобнее вести карточками во вкладке «Покупки».</div>' +
      '<div class="srow"><button data-a="carry" data-id="' + esc(c.id) + '">Перенести некупленное на завтра</button></div>');
}

/* ---------- дело ---------- */
export function sheetTask(t) {
  if (!t || !W.taskById[t.id]) return '<div class="sn">Дело удалено</div><div class="srow"><button data-a="close">Закрыть</button></div>';
  const c = W.circleById[t.c], cs = W.myCircles.filter(x => x.k === 'list' || x.k === 'shop');
  return '<div class="sn">Изменить дело</div>' +
    '<div class="fld"><label>Название</label><input type="text" id="en" value="' + esc(t.n) + '"></div>' +
    '<div class="fld"><label>Круг</label>' + pick('ec', t.c, cs.map(x => [x.id, x.i + ' ' + x.n])) + '</div>' +
    (c && c._shared ? '<div class="fld"><label>Кто делает</label>' + pick('ew', t.w || t.own, [[W.me, 'я'], [W.you, W.name(W.you)], ['both', 'оба']]) + '</div>' : '') +
    (c && c.vis !== 'prv' && t.own === W.me ? '<div class="fld"><label>Видимость</label>' + pick('eprv', t.prv ? 1 : 0, [[0, 'как у круга'], [1, '🔒 только я']]) + '</div>' : '') +
    '<div class="fld"><label>Дни недели (снять все — станет разовым на ' + esc(inDays(t.d || nav.VD)) + ')</label><div class="days">' + DN.map((d, i) =>
      '<button class="db2" data-a="ed" data-v="' + i + '" aria-pressed="' + !!(t.r && t.r[i]) + '">' + d + '</button>').join('') + '</div></div>' +
    (c && c.k === 'shop'
      ? '<div class="two"><div class="fld"><label>Количество</label><input type="text" id="eq" value="' + esc(t.q || '') + '"></div><div class="fld"><label>Цена, ₴</label><input type="number" id="epr" value="' + esc(t.pr || '') + '" inputmode="decimal"></div></div>' +
        '<div class="fld"><label>Магазин</label><input type="text" id="est" value="' + esc(t.st || '') + '"></div>'
      : '<div class="fld"><label>Уточнение</label><input type="text" id="eq" value="' + esc(t.q || '') + '"></div>') +
    '<div class="srow"><button data-a="esave" class="k">Сохранить</button><button data-a="emove">На завтра</button><button data-a="edup">Дублировать</button></div>' +
    '<div class="srow"><button data-a="edel" class="w">Удалить</button><button data-a="close">Закрыть</button></div>' +
    '<div class="sub">Регулярное дело при удалении уходит только из будущих дней — история остаётся как была.</div>';
}

/* ---------- вид кругов ----------
   Всё, что человек видит каждый день: форма круга, размер, подпись,
   движение и палитра. Сверху живой образец — меняешь и сразу видно. */
export const SKINS = [
  ['paper', 'Бумага', 'светлый спокойный, как сейчас'],
  ['mint', 'Мята', 'прохладный зелёный'],
  ['sunset', 'Закат', 'тёплый песочный с кирпичным'],
  ['ink', 'Графит', 'строгий серо-синий'],
  ['berry', 'Ягода', 'мягкий розово-лиловый'],
  ['neon', 'Неон', 'тёмный с электрическим светом'],
];
export function sheetLook() {
  const face = S.ui.face || 'ring', col = W.col(W.me);
  const sample = '<div class="pvrow">' +
    facePreview(face, 0.34, col, 3.4, 'начато') +
    facePreview(face, 0.72, col, 3.4, 'почти') +
    facePreview(face, 1, col, 3.4, 'закрыто') + '</div>';
  return '<div class="sn">Вид кругов</div>' +
    '<div class="sub" style="margin-top:0">Меняй — образец сверху перерисовывается сразу.</div>' +
    '<div class="card sec pvbox">' + sample + '</div>' +

    '<div class="fld"><label>Форма</label><div class="pick">' + FACES.map(([id, ic, nm]) =>
      '<button class="pb" data-a="uface" data-v="' + id + '" aria-pressed="' + (face === id) + '">' + ic + ' ' + esc(nm) + '</button>').join('') +
    '</div><div class="sub">' + esc((FACES.find(f => f[0] === face) || [])[3] || '') + '</div></div>' +

    '<div class="fld"><label>Размер</label>' + pick('usize', S.ui.csize, [[0, 'мелкие'], [1, 'средние'], [2, 'крупные']]) + '</div>' +
    (face === 'bar' || face === 'tile' ? '' :
      '<div class="fld"><label>Толщина</label>' + pick('uw', S.ui.cw, [[0, 'волосок'], [1, 'обычная'], [2, 'жирная'], [3, 'очень'] ]) + '</div>') +
    '<div class="fld"><label>Подпись под кругом</label>' + pick('ucap', S.ui.cap, [[0, 'только название'], [1, 'название и дело'], [2, 'без подписи']]) + '</div>' +
    '<div class="fld"><label>Кругов в ряд</label>' + pick('dcol', S.ui.cols, [[0, 'по размеру'], [2, '2'], [3, '3'], [4, '4'], [5, '5']]) + '</div>' +

    '<div class="card sec"><h3>Палитра</h3><div class="skins">' + SKINS.map(([id, nm, d]) =>
      '<button class="skin s-' + id + '" data-a="uskin" data-v="' + id + '" aria-pressed="' + ((S.ui.skin || 'paper') === id) + '">' +
      '<span class="sw"><i class="a"></i><i class="b"></i><i class="c"></i></span><b>' + esc(nm) + '</b><small>' + esc(d) + '</small></button>').join('') +
    '</div>' +
    '<div class="fld"><label>Тема</label>' + pick('theme', S.ui.theme, [['auto', 'как в системе'], ['light', 'светлая'], ['dark', 'тёмная']]) + '</div>' +
    '<div class="sub">Палитра ложится поверх светлой и тёмной темы. «Неон» всегда тёмный.</div></div>' +

    '<div class="card sec">' +
    tgl('ufx', '', S.ui.fx, 'Движение и свет', 'Кольца дорисовываются на глазах, закрытый круг подсвечивается, вода в «стакане» колышется') +
    tgl('uquick', '', S.ui.quick, 'Плюс прямо на круге', 'У счётчика в углу кнопка «+»: шаг добавляется без открытия круга') +
    tgl('ufire', '', S.ui.fire, 'Огонёк серии', 'На круге видно, сколько дней подряд он закрыт') +
    tgl('udens', '', S.ui.dens === 'roomy' ? 1 : 0, 'Просторнее', 'Больше воздуха между карточками') + '</div>' +

    '<div class="card sec"><h3>Главный экран</h3><div class="sub">Виджеты можно таскать пальцем прямо на экране.</div>' +
    '<div class="srow"><button class="k" data-a="dedit">Переставить виджеты</button><button data-a="dashset">Список виджетов</button></div></div>' +

    '<div class="srow"><button data-a="lookreset">Вернуть обычный вид</button><button class="k" data-a="close">Готово</button></div>';
}

/* ---------- выбор эмодзи ----------
   Полный набор по разделам плюс поиск по русским словам и недавние. */
export const emoSt = { tab: 0, q: '', on: null };   // on: что настраиваем — 'circle' | 'group'
export function sheetEmoji() {
  const q = emoSt.q.trim().toLowerCase();
  let list = null, title = '';
  if (q) {
    const hit = new Set();
    for (const key in EMOJI_KEYS) if (key.startsWith(q) || q.startsWith(key)) for (const e of EMOJI_KEYS[key]) hit.add(e);
    list = [...hit]; title = 'найдено по слову «' + esc(q) + '»';
    if (!list.length) { list = null; title = ''; }
  }
  const recent = (S.ui.recentEmo || []).slice(0, 16);
  const cat = EMOJI[emoSt.tab] || EMOJI[0];
  const grid = arr => '<div class="emos big">' + arr.map(e =>
    '<button data-a="emopick" data-v="' + esc(e) + '">' + e + '</button>').join('') + '</div>';
  return '<div class="sn">Иконка</div>' +
    '<div class="fld"><input type="text" id="emoq" value="' + esc(emoSt.q) + '" placeholder="поиск: дом, еда, спорт, шаги…" ' +
    'data-a="emoq" data-live="1" autocapitalize="off"></div>' +
    (list ? '<div class="sub">' + title + '</div>' + grid(list) : '') +
    (!q && recent.length ? '<div class="sub">Недавние</div>' + grid(recent) : '') +
    '<div class="pick" style="margin-top:.6rem">' + EMOJI.map((c, i) =>
      '<button class="pb" data-a="emotab" data-v="' + i + '" aria-pressed="' + (i === emoSt.tab) + '">' + c[0] + ' ' + esc(c[1]) + '</button>').join('') + '</div>' +
    grid(cat[2]) +
    '<div class="srow"><button data-a="emoclose" class="k">Готово</button></div>';
}

/* ---------- папка кругов ---------- */
export let GF = null;
export function newGF(id) {
  const g = id ? W.groupById[id] : null;
  GF = g ? JSON.parse(JSON.stringify(g)) : { n: '', i: '📂', col: PAL[0], vis: 'pair' };
  GF._new = !g;
}
export function sheetGroup() {
  const g = GF, inside = W.circles.filter(c => c.grp === g.id);
  return '<div class="sn">' + (g._new ? 'Новая папка' : 'Папка кругов') + '</div>' +
    '<div class="sub" style="margin-top:0">Папка собирает круги в одну группу на главном экране: «Дом», «Работа», «Здоровье».</div>' +
    '<div class="fld"><label>Название</label><input type="text" id="gn2" value="' + esc(g.n) + '" placeholder="Здоровье"></div>' +
    '<div class="fld"><label>Иконка</label><button class="big-btn alt" data-a="emoopen" data-v="group">' + esc(g.i) + '  выбрать</button></div>' +
    '<div class="fld"><label>Цвет</label><div class="cols8">' + PAL.map((p, i) =>
      '<button data-a="gcol" data-v="' + i + '" style="background:' + p + '" aria-pressed="' + (g.col === p) + '" aria-label="' + p + '"></button>').join('') + '</div></div>' +
    '<div class="fld"><label>Кто видит</label>' + pick('gvis', g.vis, VIS) + '</div>' +
    (inside.length ? '<div class="sub">Внутри: ' + inside.map(c => esc(c.i + ' ' + c.n)).join(', ') + '</div>' : '') +
    '<div class="srow"><button data-a="gsave2" class="k">Сохранить</button>' +
    (g._new ? '' : '<button data-a="gdel2" class="w">Удалить папку</button>') + '</div>' +
    '<div class="srow"><button data-a="close">Отмена</button></div>';
}

/* ---------- настройка круга ---------- */
export let CF = null;
export function newCF(cid) {
  const c = cid ? W.circleById[cid] : null;
  CF = c ? JSON.parse(JSON.stringify(c))
         : { n: '', i: '✨', col: PAL[S.data.circles.length % PAL.length], k: 'list', vis: 'pair',
             u: 'раз', g: 1, stp: 1, per: 'day', grp: '', note: '' };
  CF._new = !c;
}
export function sheetCircleSetup() {
  const c = CF, cnt = c.k === 'count';
  const days = c.days || [1, 1, 1, 1, 1, 1, 1];
  const units = ['раз', 'шагов', 'мл', 'мин', 'ч', 'стр', 'км', 'задач', 'ккал', 'подходов', 'страниц', 'рублей'];
  return '<div class="shead"><div style="width:3.6rem;height:3.6rem;border-radius:1rem;background:' + esc(c.col) +
    '22;display:grid;place-items:center;font-size:1.8rem">' + esc(c.i) + '</div>' +
    '<div><div class="sn">' + (c._new ? 'Новый круг' : esc(c.n || 'Круг')) + '</div><div class="ss">' +
    (c._new ? 'что это будет' : esc(circleSub(c))) + '</div></div></div>' +

    '<div class="fld"><label>Название</label><input type="text" id="cn" value="' + esc(c.n) + '" placeholder="Дом, Работа, Спорт"></div>' +

    '<div class="two"><div class="fld"><label>Иконка</label>' +
    '<button class="big-btn alt" style="margin-top:0;font-size:1.3rem" data-a="emoopen" data-v="circle">' + esc(c.i) + '</button></div>' +
    '<div class="fld"><label>Цвет</label><input type="color" id="ccol" value="' + esc(c.col) + '" data-a="ccolin" style="height:2.9rem;padding:.2rem"></div></div>' +
    '<div class="cols8">' + PAL.map((p, i) =>
      '<button data-a="cci" data-v="' + i + '" style="background:' + p + '" aria-pressed="' + (c.col === p) + '" aria-label="' + p + '"></button>').join('') + '</div>' +

    '<div class="fld"><label>Что это</label>' + pick('ck', c.k, [['list', '📋 дела'], ['count', '🔢 счётчик'], ['shop', '🛒 покупки'], ['mood', '🌤 настроение']]) +
    '<div class="sub">' + ({
      list: 'Папка с делами: галочки, повторы по дням, страховка.',
      count: 'Счётчик с целью: шаги, вода, минуты, «пять задач по работе». Считает за день или за неделю.',
      shop: 'Список покупок: количество, цена, магазин, сумма и перенос некупленного.',
      mood: 'Отметка дня от 😣 до 😄 с короткой заметкой — и график за две недели.',
    }[c.k] || '') + '</div></div>' +

    (cnt ? '<div class="card sec" style="padding:.7rem"><h3>Счётчик</h3>' +
      '<div class="fld"><label>В чём считаем</label>' + pick('cu', c.u, units.map(u => [u, u])) +
      '<input type="text" id="cuf" value="' + esc(c.u || '') + '" placeholder="своя единица: отжиманий, глав, вёдер" style="margin-top:.4rem"></div>' +
      '<div class="two"><div class="fld"><label>Цель</label><input type="number" id="cg" value="' + esc(c.g) + '" inputmode="decimal" step="any"></div>' +
      '<div class="fld"><label>Шаг кнопки</label><input type="number" id="cstp" value="' + esc(c.stp || 1) + '" inputmode="decimal" step="any"></div></div>' +
      '<div class="fld"><label>Цель считается</label>' + pick('cper', c.per || 'day', [['day', 'за день'], ['week', 'за неделю']]) +
      '<div class="sub">' + (c.per === 'week'
        ? 'Недельная цель не мешает закрывать день: «три прогулки в неделю» не станет ежедневным долгом.'
        : 'Дневная цель входит в состав дня: пока не набрано — день не закрыт.') + '</div></div>' +
      '<div class="sub">Быстрые кнопки в круге будут «−' + esc(c.stp || 1) + '» и «+' + esc(c.stp || 1) + '», а рядом поле для точного числа.</div></div>' : '') +

    '<div class="fld"><label>Вид этого круга</label>' +
    pick('cface', c.face || '', [['', 'как у всех (' + esc(FACE_NAMES[S.ui.face || 'ring'] || '') + ')']].concat(
      FACES.filter(f => f[0] !== 'bar').map(f => [f[0], f[1] + ' ' + f[2]]))) +
    '<div class="sub">Можно выделить важный круг отдельной формой.</div></div>' +

    '<div class="fld"><label>Папка</label>' +
    pick('cgrp', c.grp || '', [['', 'без папки']].concat(W.groups.map(g => [g.id, g.i + ' ' + g.n]))) +
    '<div class="srow"><button data-a="gnew2">＋ новая папка</button></div></div>' +

    '<div class="fld"><label>Кто видит</label>' + pick('cvis', c.vis, VIS) +
    '<div class="sub">' + (c.vis === 'prv' ? 'Шифруется. ' + esc(W.name(W.you)) + ' не видит ни круга, ни дел, ни отметок.' : c.vis === 'shared'
      ? 'Оба добавляют дела и закрывают их. У дела можно выбрать, кто делает: я, ' + esc(W.name(W.you)) + ' или оба.'
      : esc(W.name(W.you)) + ' видит кольцо и дела, может поддержать, но не правит. Отдельное дело можно пометить личным.') + '</div></div>' +

    '<div class="fld"><label>В какие дни круг работает</label><div class="days">' + DN.map((d, i) =>
      '<button class="db2" data-a="cday" data-v="' + i + '" aria-pressed="' + !!days[i] + '">' + d + '</button>').join('') + '</div>' +
    '<div class="sub">' + (days.every(Boolean) ? 'Каждый день. Снятый день — круг в этот день не считается совсем.'
      : 'Работает: ' + DN.filter((_, i) => days[i]).join(', ') + '. В остальные дни круг не показывается и не портит статистику.') + '</div></div>' +

    '<div class="fld"><label>Заметка</label><input type="text" id="cnote" value="' + esc(c.note || '') + '" placeholder="зачем этот круг, что считается сделанным"></div>' +

    (c._new ? '' : '<div class="fld"><label>Пауза</label>' + pick('coff', c.off ? 1 : 0, [[0, 'работает'], [1, '⏸ на паузе']]) +
      '<div class="sub">Круг на паузе не считается в дне и не рвёт серию, но история остаётся.</div></div>') +

    '<div class="srow"><button data-a="csave" class="k">Сохранить</button>' + (c._new ? '' : '<button data-a="cdel" class="w">Удалить круг</button>') + '</div>' +
    '<div class="srow"><button data-a="close">Отмена</button></div>';
}

/* ---------- просьба: куда её положить ----------
   Просьба не сваливается в случайный круг: тот, кого попросили, сам
   решает, в какой круг и на какой день она встанет. Для покупки
   сразу предлагается круг покупок. */
export let RF = null;
export const reqCircles = () => W.myCircles.filter(c => (c.k === 'list' || c.k === 'shop') && !c._ro);
export function newRF(id) {
  const r = W.requests.find(x => x.id === id);
  if (!r) { RF = null; return; }
  const mine = reqCircles(), shop = mine.find(c => c.k === 'shop');
  RF = { r, c: (r.kind === 'buy' && shop ? shop.id : (mine[0] || {}).id || ''), d: W.today };
}
export function sheetTakeReq() {
  if (!RF) return '<div class="sn">Просьбы уже нет</div><div class="srow"><button data-a="close">Закрыть</button></div>';
  const r = RF.r, mine = reqCircles();
  return '<div class="sn">' + (r.kind === 'buy' ? '🛒 Просьба купить' : '📨 Просьба') + '</div>' +
    '<div class="card sec" style="padding:.7rem"><b>' + esc(r.n) + '</b>' +
    '<div class="mini" style="margin-top:.35rem"><span class="tagi">от ' + esc(W.gen(r.own)) + '</span>' +
    (r.note ? '<span class="tagi">' + esc(r.note) + '</span>' : '') +
    (r.d ? '<span class="tagi">просит на ' + esc(inDays(r.d)) + '</span>' : '') + '</div></div>' +
    (mine.length
      ? '<div class="fld"><label>В какой круг</label>' + pick('rfc', RF.c, mine.map(c => [c.id, circleLabel(c)])) + '</div>'
      : '<div class="sub">Круга для дел пока нет — он создастся сам.</div>') +
    '<div class="fld"><label>На какой день</label>' +
    pick('rfd', RF.d, [[W.today, 'сегодня'], [addK(W.today, 1), 'завтра'], [addK(W.today, 2), 'послезавтра']]) + '</div>' +
    '<div class="srow"><button data-a="reqtake" class="k">Взять</button><button data-a="reqdec2" class="w">Отказаться</button></div>' +
    '<div class="srow"><button data-a="close">Позже</button></div>';
}

/* ---------- цель недели ---------- */
export function sheetGoal() {
  const w = wkStartK(W.today), g = W.goals.filter(x => x.week === w).sort((a, b) => (b.upd || 0) - (a.upd || 0))[0] || { n: '', need: 5, rw: '' };
  return '<div class="sn">Цель пары на неделю</div><div class="sub">Засчитывается день, который закрыли <b>оба</b>. Цель общая: её видит и может поменять любой из вас.</div>' +
    '<div class="fld"><label>Что делаем</label><input type="text" id="gn" value="' + esc(g.n) + '" placeholder="Неделя без провалов вдвоём"></div>' +
    '<div class="fld"><label>Сколько дней нужно закрыть обоим</label>' + pick('gneed', g.need, [[3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']]) + '</div>' +
    '<div class="fld"><label>Награда</label><input type="text" id="gr" value="' + esc(g.rw) + '" placeholder="в субботу кино и пицца"></div>' +
    '<div class="srow"><button data-a="goalsave" class="k" data-id="' + esc(g.id || '') + '">Сохранить</button>' + (g.id ? '<button data-a="goaldel" class="w" data-id="' + esc(g.id) + '">Убрать</button>' : '') + '</div>' +
    '<div class="srow"><button data-a="close">Отмена</button></div>';
}

/* ---------- обещание ---------- */
export let PF = null;
export function newPF(id, fromWish) {
  const p = id ? W.pledges.find(x => x.id === id) : null;
  if (p) { PF = JSON.parse(JSON.stringify(p)); PF.dir = p.giver === W.me ? 'give' : 'ask'; return; }
  const my = W.circles.filter(c => c.own === W.you || c._shared);
  PF = { dir: 'give', reward: '', note: '', wish: null, cond: { t: 'days', c: (my[0] || {}).id || null, n: 5, from: W.today, until: addK(W.today, 6) } };
  if (fromWish) {
    const w = W.wishes.find(x => x.id === fromWish);
    if (w) { PF.reward = w.t; PF.wish = w.id; PF.dir = w.for === W.me ? 'ask' : 'give'; }
  }
}
export function sheetPledge() {
  const p = PF, dir = p.dir, doer = dir === 'give' ? W.you : W.me;          // кто выполняет условие
  const circles = W.circles.filter(c => (c.own === doer || c._shared) && (c.k === 'count' || c.k === 'list' || c.k === 'mood' || c.k === 'shop'));
  const c = p.cond, t = PLEDGE_TYPES.find(x => x.t === c.t) || PLEDGE_TYPES[0];
  const needCircle = c.t === 'days' || c.t === 'sum';
  if (needCircle && !circles.some(x => x.id === c.c)) c.c = (circles[0] || {}).id || null;
  const circ = W.circleById[c.c];
  return '<div class="sn">' + (p.id ? 'Обещание' : 'Новое обещание') + '</div>' +
    (p.id ? '' : '<div class="seg"><button data-a="pfdir" data-v="give" aria-pressed="' + (dir === 'give') + '">Обещаю ' + esc(W.dat(W.you)) + '</button>' +
      '<button data-a="pfdir" data-v="ask" aria-pressed="' + (dir === 'ask') + '">Прошу у ' + esc(W.gen(W.you)) + '</button></div>') +
    '<div class="sub">' + (dir === 'give' ? 'Если ' + esc(W.name(W.you)) + ' выполнит условие — ты даришь награду. Прогресс считается сам по ' + W.say(W.you, 'его', 'её') + ' кругам.'
      : 'Предложи условие для себя и награду. ' + esc(W.name(W.you)) + ' увидит предложение и решит, обещать ли.') + '</div>' +
    '<div class="fld"><label>Награда</label><input type="text" id="pfr" value="' + esc(p.reward) + '" placeholder="' + (dir === 'give' ? 'кроссовки, ужин в ресторане, массаж' : 'новая книга') + '"></div>' +
    (p.wish ? '<div class="sub">Связано с карточкой из «Покупок».</div>' : '') +
    '<div class="fld"><label>Условие</label>' + pick('pft', c.t, PLEDGE_TYPES.map(x => [x.t, x.n])) + '</div>' +
    (needCircle ? '<div class="fld"><label>Круг ' + esc(doer === W.me ? '(твой)' : '(' + W.name(doer) + ')') + '</label>' +
      (circles.length ? pick('pfc', c.c, circles.filter(x => c.t !== 'sum' || x.k === 'count').map(x => [x.id, x.i + ' ' + x.n])) :
        '<div class="sub">У ' + esc(W.gen(doer)) + ' нет видимых кругов — такое условие не проверить. Выбери «на моё слово».</div>') + '</div>' : '') +
    (c.t !== 'manual' ? '<div class="fld"><label>' + (c.t === 'sum' && circ ? 'Сколько ' + esc(circ.u) : c.t === 'streak' ? 'Сколько дней подряд' : c.t === 'tasks' ? 'Сколько дел' :
      c.t === 'days' && circ && circ.per === 'week' ? 'Сколько недель' : 'Сколько дней') + '</label><input type="number" id="pfn" value="' + esc(c.n) + '" inputmode="numeric"></div>' : '') +
    '<div class="two"><div class="fld"><label>С какого дня</label><input type="date" id="pffrom" value="' + esc(c.from || W.today) + '"></div>' +
    '<div class="fld"><label>До какого</label><input type="date" id="pfuntil" value="' + esc(c.until || '') + '"></div></div>' +
    '<div class="fld"><label>Пара слов</label><input type="text" id="pfnote" value="' + esc(p.note || '') + '" placeholder="потому что ты давно хотела"></div>' +
    '<div class="srow"><button data-a="pfsave" class="k">' + (p.id ? 'Сохранить' : dir === 'give' ? 'Пообещать' : 'Предложить') + '</button>' +
    (p.id ? '<button data-a="pfcancel" class="w">Отменить обещание</button>' : '') + '</div><div class="srow"><button data-a="close">Закрыть</button></div>';
}

/* ---------- план (событие) ---------- */
export let EF = null;
export function newEF(id) {
  const e = id ? W.events.find(x => x.id === id) : null;
  EF = e ? JSON.parse(JSON.stringify(e)) : { t: '', kind: 'walk', date: nav.plan.date || W.today, time: '', place: '', with: 'us', note: '', vis: 'shared' };
}
export function sheetEvent() {
  const e = EF;
  return '<div class="sn">' + (e.id ? 'План' : 'Новый план') + '</div>' +
    '<div class="fld"><label>Что</label><input type="text" id="evt" value="' + esc(e.t) + '" placeholder="Прогулка по набережной"></div>' +
    '<div class="fld"><label>Какой</label>' + pick('efk', e.kind, EVENT_KINDS.map(k => [k[0], k[1] + ' ' + k[2]])) + '</div>' +
    '<div class="three"><div class="fld"><label>Дата</label><input type="date" id="evd" value="' + esc(e.date || '') + '"></div><div class="fld"><label>Время</label><input type="time" id="evtime" value="' + esc(e.time || '') + '"></div>' +
    '<div class="fld"><label>Где</label><input type="text" id="evp" value="' + esc(e.place || '') + '"></div></div>' +
    '<div class="fld"><label>С кем</label>' + pick('efw', e.with, [['us', 'вместе'], ['me', 'только я']]) + '</div>' +
    (e.with === 'me' ? '<div class="fld"><label>Видимость</label>' + pick('efv', e.vis === 'prv' ? 'prv' : 'pair', [['pair', '👀 видно паре'], ['prv', '🔒 только я']]) + '</div>' : '') +
    '<div class="fld"><label>Заметка</label><input type="text" id="evn" value="' + esc(e.note || '') + '"></div>' +
    '<div class="srow"><button data-a="evsave" class="k">Сохранить</button>' + (e.id && !e.done && e.date <= W.today ? '<button data-a="evdone" class="au">Состоялось ✓</button>' : '') + '</div>' +
    (e.id ? '<div class="srow"><button data-a="evdel" class="w">Удалить</button><button data-a="close">Закрыть</button></div>' : '<div class="srow"><button data-a="close">Отмена</button></div>');
}

/* ---------- карточка покупки ---------- */
export let WF = null;
export function newWF(id, preset = {}) {
  const w = id ? W.wishes.find(x => x.id === id) : null;
  WF = w ? JSON.parse(JSON.stringify(w)) : Object.assign({ t: '', url: '', img: '', pr: '', qty: 1, board: S.ui.wish.board !== 'all' ? S.ui.wish.board : 'want',
    for: W.me, forName: '', occ: '', date: '', pri: 2, st: 'idea', note: '', vis: 'pair', sur: 0, store: '' }, preset);
}
export function sheetWish() {
  const w = WF, forYou = w.for === W.you;
  return '<div class="sn">' + (w.id ? 'Карточка' : 'Новая карточка') + '</div>' +
    '<div class="fld"><label>Ссылка на товар</label><input type="url" id="wurl" value="' + esc(w.url) + '" placeholder="https://…" inputmode="url"></div>' +
    '<div class="fld"><label>Что это</label><input type="text" id="wt" value="' + esc(w.t) + '" placeholder="Кофемолка ручная"></div>' +
    '<div class="three"><div class="fld"><label>Цена, ₴</label><input type="number" id="wpr" value="' + esc(w.pr) + '" inputmode="decimal"></div>' +
    '<div class="fld"><label>Сколько</label><input type="number" id="wqty" value="' + esc(w.qty || 1) + '" inputmode="numeric"></div>' +
    '<div class="fld"><label>Магазин</label><input type="text" id="wstore" value="' + esc(w.store || domainOf(w.url)) + '"></div></div>' +
    '<div class="fld"><label>Картинка (ссылка на фото, необязательно)</label><input type="url" id="wimg" value="' + esc(w.img) + '" placeholder="https://…jpg"></div>' +
    '<div class="fld"><label>Доска</label>' + pick('wfb', w.board, W.boards.map(b => [b.id, b.i + ' ' + b.n])) + '</div>' +
    '<div class="fld"><label>Для кого</label>' + pick('wff', w.for, [[W.me, 'мне'], [W.you, W.name(W.you)], ['us', 'нам / в дом'], ['other', 'кому-то ещё']]) + '</div>' +
    (w.for === 'other' ? '<div class="fld"><label>Кому</label><input type="text" id="wforn" value="' + esc(w.forName) + '" placeholder="маме, Саше"></div>' : '') +
    (forYou ? '<div class="fld"><label>Сюрприз?</label>' + pick('wfs', w.sur ? 1 : 0, [[1, '🤫 да — ' + W.name(W.you) + ' не видит'], [0, 'нет, пусть видит']]) + '</div>' : '') +
    (!forYou || !w.sur ? '<div class="fld"><label>Кто видит</label>' + pick('wfv', w.vis, VIS) + '</div>' : '') +
    '<div class="two"><div class="fld"><label>Повод</label><input type="text" id="wocc" value="' + esc(w.occ) + '" placeholder="день рождения"></div>' +
    '<div class="fld"><label>К дате</label><input type="date" id="wdate" value="' + esc(w.date) + '"></div></div>' +
    '<div class="fld"><label>Важность</label>' + pick('wfp', w.pri, [[1, '★'], [2, '★★'], [3, '★★★']]) + '</div>' +
    '<div class="fld"><label>Статус</label>' + pick('wfst', w.st || 'idea', [['idea', 'идея'], ['plan', 'в плане'], ['bought', 'куплено']]) + '</div>' +
    '<div class="fld"><label>Заметка</label><input type="text" id="wnote" value="' + esc(w.note) + '" placeholder="размер 38, цвет синий"></div>' +
    '<div class="srow"><button data-a="wsave" class="k">Сохранить</button>' + (w.id ? '<button data-a="wdel" class="w">Удалить</button>' : '') + '</div>' +
    '<div class="srow"><button data-a="close">Закрыть</button></div>';
}

/* ---------- поводы ---------- */
export function sheetDates() {
  const list = W.dates.slice().sort((a, b) => (a.md || '').localeCompare(b.md || ''));
  return '<div class="sn">Поводы и даты</div><div class="sub">Дни рождения, годовщины, праздники. За две недели повод подсвечивается, к нему удобно цеплять подарки.</div>' +
    (list.length ? '<div style="margin-top:.6rem">' + list.map(d => '<div class="shoprow"><span style="font-size:1.1rem">' + (d.kind === 'anniv' ? '💍' : d.kind === 'bday' ? '🎂' : '📅') + '</span>' +
      '<span class="nm2">' + esc(d.n) + '<span class="mini"><span class="tagi">' + esc(shortK('2000-' + d.md)) + '</span>' + (d._mine ? '' : '<span class="tagi">от ' + esc(W.gen(d.own)) + '</span>') +
      (d.vis === 'prv' ? '<span class="tagi prv">🔒</span>' : '') + '</span></span><button class="del" data-a="datedel" data-id="' + esc(d.id) + '" aria-label="Удалить">✕</button></div>').join('') + '</div>'
      : '<div class="sub">Пока пусто. Свой день рождения ставится в Настройках → «Кто я».</div>') +
    '<div class="card sec"><h3>Добавить</h3><div class="fld"><label>Кто или что</label><input type="text" id="dn" placeholder="Мама, годовщина свадьбы"></div>' +
    '<div class="two"><div class="fld"><label>Дата</label><input type="date" id="dd"></div><div class="fld"><label>Тип</label><select id="dk"><option value="bday">день рождения</option>' +
    '<option value="anniv">годовщина</option><option value="other">другое</option></select></div></div>' +
    '<div class="fld"><label>Видимость</label><select id="dv"><option value="shared">🤝 общий</option><option value="prv">🔒 только я</option></select></div>' +
    '<div class="srow"><button class="k" data-a="dateadd">Добавить</button><button data-a="close">Закрыть</button></div></div>';
}

export function sheetBoard() {
  return '<div class="sn">Новая доска</div><div class="fld"><label>Название</label><input type="text" id="bn" placeholder="Ремонт кухни, Отпуск"></div>' +
    '<div class="fld"><label>Иконка</label><input type="text" id="bi" value="📋" maxlength="4"></div>' +
    '<div class="fld"><label>Кто видит</label><select id="bv"><option value="shared">🤝 общая</option><option value="pair">👀 видно паре</option><option value="prv">🔒 только я</option></select></div>' +
    '<div class="srow"><button class="k" data-a="boardadd">Создать</button><button data-a="close">Отмена</button></div>';
}

export function sheetTplSave(date) {
  return '<div class="sn">Шаблон дня</div><div class="sub">Разовые дела этого дня сохранятся набором — потом одним нажатием в любой день.</div>' +
    '<div class="fld"><label>Название</label><input type="text" id="tpn" placeholder="понедельник, дача"></div>' +
    '<div class="srow"><button class="k" data-a="tpladd" data-v="' + esc(date) + '">Сохранить</button><button data-a="close">Отмена</button></div>';
}

/** Блок «вставить код подключения». Нужен там, где ссылку открыть нельзя:
    приложение с домашнего экрана айфона живёт отдельно от Safari. */
export function pasteBlock(title) {
  return '<div class="card sec"><h3>' + (title || '🔗 Уже настроено на другом устройстве?') + '</h3>' +
    '<div class="sub" style="margin-top:0">Скопируй ссылку подключения (на настроенном устройстве: «Ещё → Синхронизация → Добавить устройство → Скопировать ссылку») и вставь сюда.</div>' +
    '<button class="big-btn" data-a="pastelink">Вставить из буфера</button>' +
    '<div class="fld"><label>или вставь вручную</label><input type="text" id="pastefield" placeholder="https://…/krugi/#n=…" autocapitalize="off" autocomplete="off" spellcheck="false"></div>' +
    '<button class="big-btn alt" data-a="pastego">Подключить</button></div>';
}

/* ---------- подключение по ссылке ----------
   Человек открыл ссылку, присланную со второго устройства: спрашиваем
   только одно — чей это телефон. Всё остальное уже в ссылке. */
export function vSetupLink(p, me) {
  const known = p.who || me;
  return '<div class="hd"><div><div class="dt">ПОДКЛЮЧЕНИЕ</div><h1>Общая база готова</h1></div></div>' +
    '<div class="card sec"><div class="sub" style="margin-top:0">Ссылка принесла доступ к общей базе ' +
    esc(p.owner + '/' + p.repo) + (p.key ? ' и ключ личного' : '') + '. Осталось сказать, чей это телефон.</div>' +
    (known
      ? '<button class="big-btn" data-a="setupgo" data-v="' + esc(known) + '">Это телефон: ' + esc(known === 'andrey' ? 'Андрей' : 'Диана') + '</button>' +
        '<button class="big-btn alt" data-a="setupgo" data-v="' + esc(known === 'andrey' ? 'diana' : 'andrey') + '">Нет, это телефон: ' +
        esc(known === 'andrey' ? 'Диана' : 'Андрей') + '</button>'
      : '<div class="who"><button data-a="setupgo" data-v="andrey"><span class="av" style="background:#2F5BD0">А</span><b>Андрей</b><small>мой телефон</small></button>' +
        '<button data-a="setupgo" data-v="diana"><span class="av" style="background:#B0517E">Д</span><b>Диана</b><small>мой телефон</small></button></div>') +
    '<button class="big-btn alt" data-a="setupno">Не подключать</button>' +
    '<div class="sub">Если это окно открылось внутри мессенджера, лучше перенести его в обычный браузер: ' +
    'меню ⋮ → «Открыть в Safari» (или в Chrome). Иначе приложение останется жить внутри мессенджера, и с домашнего экрана его не будет.</div>' +
    '<div class="srow"><button data-a="setupcopy">Скопировать ссылку для браузера</button></div>' +
    '<div class="sub">Ссылка — как пароль: после подключения удали сообщение. Из адреса она уберётся сама.</div></div>';
}

/* ---------- первый запуск ---------- */
export function vHello(old, opts) {
  return '<div class="hd"><div><div class="dt">ПЕРВЫЙ ЗАПУСК</div><h1>Чей это телефон?</h1></div></div>' +
    (opts && opts.standalone ? '<div class="infobox">Приложение открыто с домашнего экрана. На айфоне у него своё хранилище, ' +
      'отдельное от Safari, — поэтому настройки надо перенести сюда один раз: кнопка ниже.</div>' : '') +
    '<div class="card sec"><div class="sub" style="margin-top:0">У каждого свой клиент: свои круги, своё личное, свой главный экран. Общее видно обоим, когда подключите синхронизацию.</div>' +
    '<div class="who"><button data-a="hello" data-v="andrey"><span class="av" style="background:#2F5BD0">А</span><b>Андрей</b><small>мой телефон</small></button>' +
    '<button data-a="hello" data-v="diana"><span class="av" style="background:#B0517E">Д</span><b>Диана</b><small>мой телефон</small></button></div>' +
    (old ? '<div class="infobox">На этом телефоне есть данные прошлой версии («' + esc(old.me || '') + '»: ' + (old.circles || []).length + ' кругов, ' + (old.tasks || []).length +
      ' дел). Они перенесутся автоматически.</div>' : '') + '</div>' + pasteBlock() +
    '<div class="card sec"><h3>Что внутри</h3><div class="sub">⭕ круги дел, счётчиков, покупок и настроения · 📅 неделя с галочками · 🔒 печать плана и страховки · ' +
    '🤝 просьбы, обещания и награды друг другу · 🛍 карточки покупок и подарков · 📍 совместные планы · 🏅 опыт, уровни, значки · 🔐 личное шифруется.</div></div>';
}
export function vStart() {
  return '<div class="hd"><div><div class="dt">ГОТОВО</div><h1>С чего начнём?</h1></div></div>' +
    '<div class="card sec"><button class="big-btn" data-a="startquick">Набор для старта</button>' +
    '<div class="sub">Дом (общий), Покупки (общие), Вода, Шаги, Работа (5 задач в день), Настроение, Прогулки вместе (3 в неделю) и Личное с замком. Всё пустое, всё переименовывается.</div>' +
    '<button class="big-btn alt" data-a="startempty">С чистого листа</button></div>';
}
