/* ============================================================
   Живой список покупок.

   Одна и та же лента живёт в двух местах: виджетом на главном и
   разделом «Покупки». Правило простое: новое добавляется сверху,
   купленное уезжает вниз с галочкой и через пару дней исчезает само —
   список не надо разгребать руками.

   Позиции — это обычные дела в кругах вида «покупки», поэтому всё
   уже умеет синхронизироваться, делиться с парой и хранить цену,
   количество и магазин.
   ============================================================ */
import { esc, money, addK, fmt, pl } from './util.js';
import { W } from './ctx.js';
import { S } from './store.js';

/** Сколько дней купленное ещё висит внизу, прежде чем исчезнуть. */
export const KEEP_DAYS = 2;

export const shopCircles = () => W.myCircles.filter(c => c.k === 'shop');
export const myShopCircle = () => shopCircles().find(c => !c._ro && c._mine) || shopCircles().find(c => !c._ro) || null;

/** Когда куплено: последний день с отметкой. null — ещё не куплено. */
export function boughtAt(t) {
  const m = (W.log && W.log[t.id]) || {};
  let best = null;
  for (const k in m) {
    const s = m[k] && m[k].s;
    if ((s === 'done' || s === 'ins') && (!best || k > best)) best = k;
  }
  return best;
}

/** Позиции списка: разовые из кругов покупок плюс регулярные на сегодня. */
export function shopItems() {
  const ids = new Set(shopCircles().map(c => c.id)), out = [];
  for (const t of W.tasks) {
    if (!ids.has(t.c)) continue;
    if (t.r && !W.onDate(t, W.today)) continue;          // регулярное не в свой день
    const b = t.r ? (W.isDone(t, W.today) ? W.today : null) : boughtAt(t);
    out.push({ t, c: W.circleById[t.c], b });
  }
  // не купленное сверху (новое первым), купленное внизу (позже купленное выше)
  out.sort((a, z) => (a.b ? 1 : 0) - (z.b ? 1 : 0) ||
    (a.b ? (z.b || '').localeCompare(a.b) : (z.t.cr || 0) - (a.t.cr || 0)));
  return out;
}

/** Что пора убрать: куплено больше пары дней назад и не повторяется. */
export function staleShop() {
  const edge = addK(W.today, -KEEP_DAYS);
  return shopItems().filter(x => x.b && !x.t.r && x.b <= edge).map(x => x.t);
}

/* Значок по названию: список сразу читается глазами, а не буквами.
   Слева — кусочек названия, справа — что рисуем. Порядок важен:
   «сметана» должна найтись раньше «мета»-подобных обрывков, поэтому
   длинные куски идут первыми. */
const ICONS = [
  ['молок', '🥛'], ['кефир', '🥛'], ['сливк', '🥛'], ['сметан', '🥛'], ['творог', '🥛'], ['йогурт', '🥛'],
  ['ряженк', '🥛'], ['сыр', '🧀'], ['масл', '🧈'], ['яйц', '🥚'], ['яиц', '🥚'],
  ['хлеб', '🍞'], ['батон', '🥖'], ['багет', '🥖'], ['булк', '🥐'], ['круассан', '🥐'], ['лаваш', '🫓'],
  ['печень', '🍪'], ['торт', '🎂'], ['конфет', '🍬'], ['шокол', '🍫'], ['мармелад', '🍬'], ['мороже', '🍦'],
  ['мёд', '🍯'], ['мед', '🍯'], ['варень', '🍯'], ['сахар', '🍬'], ['соль', '🧂'], ['специ', '🧂'],
  ['мяс', '🥩'], ['говяд', '🥩'], ['свин', '🥓'], ['куриц', '🍗'], ['кур', '🍗'], ['фарш', '🥩'],
  ['колбас', '🥓'], ['сосиск', '🌭'], ['бекон', '🥓'], ['рыб', '🐟'], ['лосос', '🐟'], ['селёд', '🐟'],
  ['кревет', '🦐'], ['икр', '🐟'],
  ['яблок', '🍎'], ['банан', '🍌'], ['апельс', '🍊'], ['мандар', '🍊'], ['лимон', '🍋'], ['виноград', '🍇'],
  ['груш', '🍐'], ['персик', '🍑'], ['слив', '🍑'], ['клубник', '🍓'], ['вишн', '🍒'], ['черешн', '🍒'],
  ['арбуз', '🍉'], ['дын', '🍈'], ['киви', '🥝'], ['ананас', '🍍'], ['авокад', '🥑'], ['ягод', '🫐'],
  ['помидор', '🍅'], ['томат', '🍅'], ['огурц', '🥒'], ['огурец', '🥒'], ['картоф', '🥔'], ['картош', '🥔'],
  ['морков', '🥕'], ['лук', '🧅'], ['чеснок', '🧄'], ['капуст', '🥬'], ['салат', '🥬'], ['зелен', '🌿'],
  ['укроп', '🌿'], ['петруш', '🌿'], ['перец', '🌶'], ['баклаж', '🍆'], ['кабач', '🥒'], ['гриб', '🍄'],
  ['кукуруз', '🌽'], ['оливк', '🫒'], ['маслин', '🫒'], ['орех', '🥜'], ['семечк', '🌻'],
  ['рис', '🍚'], ['гречк', '🌾'], ['макарон', '🍝'], ['паст', '🍝'], ['мук', '🌾'], ['круп', '🌾'],
  ['овсян', '🥣'], ['хлопь', '🥣'], ['пельмен', '🥟'], ['пицц', '🍕'], ['суп', '🍲'], ['соус', '🥫'],
  ['кетчуп', '🍅'], ['майонез', '🥫'], ['консерв', '🥫'], ['чипс', '🍟'], ['попкорн', '🍿'], ['сухар', '🍞'],
  ['кофе', '☕'], ['чай', '🍵'], ['вод', '💧'], ['сок', '🧃'], ['лимонад', '🥤'], ['пив', '🍺'],
  ['вин', '🍷'], ['шампан', '🍾'], ['коньяк', '🥃'], ['виск', '🥃'],
  ['мыл', '🧼'], ['шампун', '🧴'], ['гель', '🧴'], ['бальзам', '🧴'], ['крем', '🧴'], ['паст', '🪥'],
  ['щётк', '🪥'], ['щетк', '🪥'], ['бумаг', '🧻'], ['салфет', '🧻'], ['губк', '🧽'], ['тряп', '🧽'],
  ['порош', '🧺'], ['кондицион', '🧺'], ['средств', '🧴'], ['памперс', '🍼'], ['подгуз', '🍼'],
  ['лампочк', '💡'], ['батарей', '🔋'], ['пакет', '🛍'], ['корм', '🐾'], ['наполнит', '🐾'],
  ['цвет', '💐'], ['подар', '🎁'], ['открытк', '💌'], ['лекарств', '💊'], ['таблет', '💊'], ['витамин', '💊'],
  ['бинт', '🩹'], ['пластыр', '🩹'], ['носк', '🧦'], ['футболк', '👕'], ['книг', '📖'], ['ручк', '🖊'],
  ['тетрад', '📓'], ['бенз', '⛽'], ['телефон', '📱'], ['зарядк', '🔌'],
];
export function guessIcon(name) {
  const n = String(name || '').toLowerCase();
  for (const [k, e] of ICONS) if (n.includes(k)) return e;
  return '';
}

/* Подсвечиваем только что отмеченное: строка уезжает вниз на глазах. */
export let justId = null;
export const markJust = id => { justId = id; };

/* ---------- разметка ---------- */
const SB = c => '<span class="sbi" style="--c:' + esc((c && c.col) || 'var(--mut)') + '"></span>';

const ico = t => { const e = guessIcon(t.n); return e ? '<i class="sic">' + e + '</i>' : ''; };

function row(x, opts) {
  const { t, c, b } = x;
  const ro = c && c._ro && !c._shared;
  const sub = [t.q, t.pr ? money(t.pr) : '', t.st, t.by ? 'от ' + W.gen(t.by) : '',
    b ? (b === W.today ? 'куплено сегодня' : 'куплено ' + b.slice(8) + '.' + b.slice(5, 7)) : ''].filter(Boolean).join(' · ');
  return '<div class="srow2' + (b ? ' done' : '') + (justId === t.id ? ' just' : '') + '" style="--c:' + esc((c && c.col) || '#7B7D85') + '">' +
    (ro ? '<span class="sbx' + (b ? ' on' : '') + '">' + (b ? '✓' : ico(t)) + '</span>'
        : '<button class="sbx' + (b ? ' on' : '') + '" data-a="shopbuy" data-id="' + esc(t.id) + '" aria-label="' +
          esc(b ? 'Вернуть в список' : 'Куплено') + '">' + (b ? '✓' : ico(t)) + '</button>') +
    '<span class="st2"><b>' + esc(t.n) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
    (opts.edit === false || ro ? '' : '<button class="sed" data-a="edit" data-id="' + esc(t.id) + '" aria-label="Изменить">✎</button>') +
    '</div>';
}

/* Пока не нужен — только плюсик. Нажал, и поле появилось прямо под списком. */
export let adding = 0;
export const setAdding = v => { adding = v || 0; };

/** Поле быстрого добавления: пишешь и оно встаёт сверху. */
function addBox(id) {
  if (adding !== id)
    return '<div class="sadd closed"><button class="splus" data-a="shopplus" data-v="' + id + '" aria-label="Добавить покупку">＋</button></div>';
  const cs = shopCircles();
  return '<div class="sadd"><input type="text" id="' + id + '" placeholder="Что купить" autocomplete="off">' +
    '<button class="k" data-a="shopadd" data-v="' + id + '" aria-label="Добавить">＋</button>' +
    '<button class="sx" data-a="shopclose" aria-label="Закрыть">✕</button></div>' +
    '<div class="sub">Можно сразу несколько через запятую' +
    (cs.length > 1 ? '. Встанет в «' + esc((myShopCircle() || cs[0]).n) + '»' : '') + '.</div>';
}

/** Частое: то, что уже покупали — одно нажатие, и снова в списке. */
function often(items) {
  const have = new Set(items.filter(x => !x.b).map(x => x.t.n.toLowerCase()));
  const list = (S.ui.shopOften || []).filter(n => !have.has(n.toLowerCase())).slice(0, 8);
  if (!list.length) return '';
  return '<div class="sub" style="margin-top:.6rem">Часто берём</div><div class="pick">' +
    list.map(n => '<button class="pb" data-a="shopq" data-v="' + esc(n) + '">＋ ' + esc(n) + '</button>').join('') + '</div>';
}

/**
 * Лента покупок.
 * opts: { widget } — на главном она складывается и прокручивается внутри,
 * в разделе «Покупки» показывается целиком.
 */
export function shopBox(opts = {}) {
  const items = shopItems(), left = items.filter(x => !x.b), done = items.filter(x => x.b);
  const sum = left.reduce((a, x) => a + (x.t.pr || 0), 0);
  const wide = opts.widget && S.ui.shopWide ? ' wide' : '';
  const open = !opts.widget || S.ui.shopOpen !== 0;
  const HS = [9.5, 15, 24];
  // по магазинам — когда их правда несколько: в магазине так удобнее
  const stores = [...new Set(left.map(x => x.t.st).filter(Boolean))];
  const byStore = !opts.widget && S.ui.shopGrp && stores.length > 1;
  const leftHTML = byStore
    ? [...stores, ''].map(s => {
        const part = left.filter(x => (x.t.st || '') === s);
        if (!part.length) return '';
        return '<div class="sdiv st">' + esc(s || 'без магазина') + ' · ' + part.length + '</div>' + part.map(x => row(x, opts)).join('');
      }).join('')
    : left.map(x => row(x, opts)).join('');
  const box = '<div class="sbox' + (opts.widget ? '' : ' full') + '"' +
    (opts.widget ? ' style="max-height:' + (HS[S.ui.shopH || 0] || HS[0]) + 'rem"' : '') + '>' +
    (items.length
      ? leftHTML +
        (done.length ? '<div class="sdiv">куплено · исчезнет через ' + KEEP_DAYS + ' ' + pl(KEEP_DAYS, ['день', 'дня', 'дней']) + '</div>' +
          done.map(x => row(x, opts)).join('') : '')
      : '<div class="sempty"><span>🧺</span>Список пуст. Напиши, что нужно купить — встанет сверху.</div>') + '</div>';

  const head = '<div class="ch"><h3>' + (opts.widget ? 'Что купить' : 'Список покупок') + '</h3>' +
    '<span class="scnt">' + (left.length ? left.length + ' ' + pl(left.length, ['позиция', 'позиции', 'позиций']) +
      (sum ? ' · ' + esc(money(sum)) : '') : 'всё куплено') + '</span>' +
    (opts.widget
      ? '<button class="lnk" data-a="shoph" aria-label="Размер списка">⇕</button>' +
        '<button class="lnk" data-a="shopfold">' + (open ? 'свернуть' : 'развернуть') + '</button>'
      : '') + '</div>';

  if (opts.widget && !open)
    return '<div class="card sec shopw' + wide + '">' + head +
      '<div class="sub">' + (left.length ? 'Ближайшее: ' + esc(left.slice(0, 3).map(x => x.t.n).join(', ')) +
        (left.length > 3 ? ' и ещё ' + (left.length - 3) : '') : 'Пока ничего не нужно.') + '</div></div>';

  return '<div class="card sec shopw' + wide + '">' + head +
    (!opts.widget && stores.length > 1
      ? '<div class="pick" style="margin-top:.5rem"><button class="pb" data-a="shopgrp" aria-pressed="' + !!S.ui.shopGrp + '">по магазинам</button></div>'
      : '') + box +
    addBox(opts.widget ? 'shopiw' : 'shopi') + often(items) +
    (opts.widget ? '' : '<div class="sub">Нажал кружок — куплено, позиция уехала вниз и через пару дней исчезнет сама. ' +
      'Цену, количество и магазин можно дописать карандашом.</div>') + '</div>';
}

/** Полоска «куплено столько-то из стольких» для шапки раздела. */
export function shopStat() {
  const items = shopItems(), d = items.filter(x => x.b).length;
  if (!items.length) return null;
  return { d, a: items.length, p: items.length ? d / items.length : 0, sum: items.filter(x => !x.b).reduce((a, x) => a + (x.t.pr || 0), 0) };
}
void fmt;
