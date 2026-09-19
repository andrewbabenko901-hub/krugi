/* Шторки: круг, дело, настройка круга, обещание, план, карточка, даты. */
import { esc, fmt, DN, human, parse, addK, wkStartK, money, domainOf, inDays, shortK } from './util.js';
import { W, nav } from './ctx.js';
import { S } from './store.js';
import { ring, pick, chk } from './ui.js';
import { taskLi, circleSub, MOODS, UNITS, EMO, PAL, EVENT_KINDS, VIS, whoTag } from './parts.js';
import { PLEDGE_TYPES } from './model.js';

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
  const kudos = c._ro ? '<div class="kud">' + ['❤️', '👏', '🔥', '💪'].map(e => '<button data-a="kudos" data-v="' + e + '" data-about="' + esc(c.n) + '">' + e + '</button>').join('') + '</div>' : '';
  return '<div class="shead">' + ring(x.empty ? 0 : x.p, c.col, 3.6, .4) + '<div><div class="sn">' + esc(c.i + ' ' + c.n) + '</div><div class="ss">' + esc(circleSub(c)) + '</div></div></div>' +
    body + kudos + '<div class="srow">' + (c._ro ? '' : '<button data-a="csetup" data-id="' + esc(c.id) + '">Настроить круг</button>') + '<button data-a="close">Закрыть</button></div>';
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

/* ---------- настройка круга ---------- */
export let CF = null;
export function newCF(cid) {
  const c = cid ? W.circleById[cid] : null;
  CF = c ? JSON.parse(JSON.stringify(c)) : { n: '', i: '✨', col: PAL[0], k: 'list', vis: 'pair', u: 'раз', g: 1, stp: 1, per: 'day' };
  CF._new = !c;
}
export function sheetCircleSetup() {
  const c = CF;
  return '<div class="shead"><div style="width:3.6rem;height:3.6rem;border-radius:1rem;background:' + esc(c.col) + '22;display:grid;place-items:center;font-size:1.6rem">' + esc(c.i) + '</div>' +
    '<div><div class="sn">' + (c._new ? 'Новый круг' : 'Настройка круга') + '</div><div class="ss">' + (c._new ? '' : esc(circleSub(c))) + '</div></div></div>' +
    '<div class="fld"><label>Название</label><input type="text" id="cn" value="' + esc(c.n) + '" placeholder="Дом, Работа, Спорт"></div>' +
    '<div class="fld"><label>Тип</label>' + pick('ck', c.k, [['list', 'папка дел'], ['count', 'счётчик'], ['shop', 'покупки'], ['mood', 'настроение']]) +
    '<div class="sub">Папка — галочки. Счётчик — цель в единицах: шаги, вода, минуты, «5 задач по работе». Покупки — список с ценами и магазинами. Настроение — отметка дня от 😣 до 😄.</div></div>' +
    (c.k === 'count' ? '<div class="fld"><label>Единица</label>' + pick('cu', c.u, UNITS.map(u => [u, u])) +
      '<div class="three" style="margin-top:.5rem"><div class="fld" style="margin:0"><label>цель</label><input type="number" id="cg" value="' + esc(c.g) + '" inputmode="numeric"></div>' +
      '<div class="fld" style="margin:0"><label>шаг кнопки</label><input type="number" id="cstp" value="' + esc(c.stp || 1) + '" inputmode="numeric"></div>' +
      '<div class="fld" style="margin:0"><label>за</label><select id="cper"><option value="day"' + (c.per !== 'week' ? ' selected' : '') + '>день</option><option value="week"' + (c.per === 'week' ? ' selected' : '') + '>неделю</option></select></div></div></div>' : '') +
    '<div class="fld"><label>Иконка</label><div class="emos">' + EMO.map((e, i) => '<button data-a="cie" data-v="' + i + '" aria-pressed="' + (c.i === e) + '">' + e + '</button>').join('') + '</div></div>' +
    '<div class="fld"><label>Цвет</label><div class="cols8">' + PAL.map((p, i) => '<button data-a="cci" data-v="' + i + '" style="background:' + p + '" aria-pressed="' + (c.col === p) + '" aria-label="' + p + '"></button>').join('') + '</div></div>' +
    '<div class="fld"><label>Кто видит</label>' + pick('cvis', c.vis, VIS) +
    '<div class="sub">' + (c.vis === 'prv' ? 'Шифруется. ' + esc(W.name(W.you)) + ' не видит ни круга, ни дел, ни отметок.' : c.vis === 'shared'
      ? 'Оба добавляют дела и закрывают их. У дела можно выбрать, кто делает: я, ' + esc(W.name(W.you)) + ' или оба.'
      : esc(W.name(W.you)) + ' видит кольцо и дела, может поддержать, но не правит. Отдельное дело можно пометить личным.') + '</div></div>' +
    (c._new ? '' : '<div class="fld"><label>Пауза</label>' + pick('coff', c.off ? 1 : 0, [[0, 'работает'], [1, 'на паузе — не считается в дне']]) + '</div>') +
    '<div class="srow"><button data-a="csave" class="k">Сохранить</button>' + (c._new ? '' : '<button data-a="cdel" class="w">Удалить круг</button>') + '</div>' +
    '<div class="srow"><button data-a="close">Отмена</button></div>';
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
    '<div class="sub">Ссылка — как пароль: после подключения удали её из переписки. Из адреса телефона она уберётся сама.</div></div>';
}

/* ---------- первый запуск ---------- */
export function vHello(old) {
  return '<div class="hd"><div><div class="dt">ПЕРВЫЙ ЗАПУСК</div><h1>Чей это телефон?</h1></div></div>' +
    '<div class="card sec"><div class="sub" style="margin-top:0">У каждого свой клиент: свои круги, своё личное, свой главный экран. Общее видно обоим, когда подключите синхронизацию.</div>' +
    '<div class="who"><button data-a="hello" data-v="andrey"><span class="av" style="background:#2F5BD0">А</span><b>Андрей</b><small>мой телефон</small></button>' +
    '<button data-a="hello" data-v="diana"><span class="av" style="background:#B0517E">Д</span><b>Диана</b><small>мой телефон</small></button></div>' +
    (old ? '<div class="infobox">На этом телефоне есть данные прошлой версии («' + esc(old.me || '') + '»: ' + (old.circles || []).length + ' кругов, ' + (old.tasks || []).length +
      ' дел). Они перенесутся автоматически.</div>' : '') + '</div>' +
    '<div class="card sec"><h3>Что внутри</h3><div class="sub">⭕ круги дел, счётчиков, покупок и настроения · 📅 неделя с галочками · 🔒 печать плана и страховки · ' +
    '🤝 просьбы, обещания и награды друг другу · 🛍 карточки покупок и подарков · 📍 совместные планы · 🏅 опыт, уровни, значки · 🔐 личное шифруется.</div></div>';
}
export function vStart() {
  return '<div class="hd"><div><div class="dt">ГОТОВО</div><h1>С чего начнём?</h1></div></div>' +
    '<div class="card sec"><button class="big-btn" data-a="startquick">Набор для старта</button>' +
    '<div class="sub">Дом (общий), Покупки (общие), Вода, Шаги, Работа (5 задач в день), Настроение, Прогулки вместе (3 в неделю) и Личное с замком. Всё пустое, всё переименовывается.</div>' +
    '<button class="big-btn alt" data-a="startempty">С чистого листа</button></div>';
}
