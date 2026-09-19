/* Покупки и хотелки: карточки со ссылками, доски, поводы. */
import { esc, pl, money, shortK } from './util.js';
import { W } from './ctx.js';
import { S } from './store.js';
import { pick } from './ui.js';
import { wishCard, header } from './parts.js';
import { upcomingDates } from './model.js';

export function filteredWishes() {
  const F = S.ui.wish;
  let list = W.wishes.filter(w => {
    if (F.board !== 'all' && w.board !== F.board) return false;
    if (F.who === 'me' && w.for !== W.me) return false;
    if (F.who === 'you' && w.for !== W.you) return false;
    if (F.who === 'us' && w.for !== 'us') return false;
    if (F.who === 'other' && w.for !== 'other') return false;
    if (F.st === 'open' && w.st === 'bought') return false;
    if (F.st === 'idea' && w.st !== 'idea' && w.st) return false;
    if (F.st === 'plan' && w.st !== 'plan') return false;
    if (F.st === 'bought' && w.st !== 'bought') return false;
    return true;
  });
  const by = {
    new: (a, b) => (b.cr || 0) - (a.cr || 0),
    price: (a, b) => (b.pr || 0) - (a.pr || 0),
    pri: (a, b) => (b.pri || 0) - (a.pri || 0) || (b.cr || 0) - (a.cr || 0),
    date: (a, b) => (a.date || '9999').localeCompare(b.date || '9999'),
  }[F.sort] || ((a, b) => 0);
  return list.sort(by);
}

export function vWish() {
  const F = S.ui.wish;
  const up = upcomingDates(W, 90).slice(0, 8);
  const occ = up.length ? '<div class="occ">' + up.map(x => '<button class="oc' + (x.left <= 14 ? ' soon' : '') + '" data-a="occ" data-v="' + esc(x.k) + '" data-n="' + esc(x.n) + '">' +
    '<span>' + (x.kind === 'bday' ? '🎂' : x.kind === 'anniv' ? '💍' : '📅') + ' ' + esc(shortK(x.k)) + '</span><b>' + esc(x.n) + '</b><span class="osw dd">' +
    (x.left === 0 ? 'сегодня' : x.left + ' ' + pl(x.left, ['день', 'дня', 'дней'])) + '</span></button>').join('') +
    '<button class="oc" data-a="datesheet"><span>поводы</span><b>＋ дата</b><span>дни рождения</span></button></div>'
    : '<div class="occ"><button class="oc" data-a="datesheet"><span>поводов нет</span><b>＋ добавить дату</b><span>дни рождения, годовщины</span></button></div>';
  const counts = {};
  for (const w of W.wishes) if (w.st !== 'bought') counts[w.board] = (counts[w.board] || 0) + 1;
  const boards = '<div class="boards"><button class="pb" data-a="wboard" data-v="all" aria-pressed="' + (F.board === 'all') + '">Все</button>' +
    W.boards.map(b => '<button class="pb" data-a="wboard" data-v="' + esc(b.id) + '" aria-pressed="' + (F.board === b.id) + '">' + esc(b.i + ' ' + b.n) +
      (counts[b.id] ? ' · ' + counts[b.id] : '') + '</button>').join('') +
    '<button class="pb" data-a="boardnew">＋ доска</button></div>';
  const filt = pick('wwho', F.who, [['all', 'для всех'], ['me', 'мне'], ['you', W.name(W.you)], ['us', 'нам'], ['other', 'другим']], 'acc') +
    pick('wst', F.st, [['open', 'не куплено'], ['idea', 'идеи'], ['plan', 'в плане'], ['bought', 'куплено'], ['all', 'всё']], 'acc') +
    pick('wsort', F.sort, [['new', 'новые'], ['pri', 'важные'], ['price', 'дорогие'], ['date', 'по дате']]);
  const list = filteredWishes();
  const sum = list.filter(w => w.st !== 'bought').reduce((a, w) => a + (w.pr || 0) * (w.qty > 1 ? w.qty : 1), 0);
  const planSum = list.filter(w => w.st === 'plan').reduce((a, w) => a + (w.pr || 0) * (w.qty > 1 ? w.qty : 1), 0);
  const shops = W.myCircles.filter(c => c.k === 'shop');
  const shopLine = shops.length ? '<div class="sub">Список на день — в кругах: ' + shops.map(c =>
    '<button data-a="circle" data-id="' + esc(c.id) + '" style="text-decoration:underline;color:var(--acc)">' + esc(c.i + ' ' + c.n) + '</button>').join(', ') + '.</div>' : '';
  return header('карточки, ссылки, поводы', 'Покупки', '<button class="ghost" data-a="wnew">＋ карточка</button>') +
    occ + boards + filt +
    '<div class="card sec"><div class="stop"><div class="big">' + list.length + ' ' + pl(list.length, ['карточка', 'карточки', 'карточек']) + '</div>' +
    '<div class="sm">' + (sum ? 'на ' + esc(money(sum)) : '') + (planSum ? '<br>в плане ' + esc(money(planSum)) : '') + '</div></div>' +
    '<div class="sub">Ссылка, фото, цена, для кого и к какому поводу. Подарок-сюрприз для ' + esc(W.gen(W.you)) + ' ' + W.say(W.you, 'ему', 'ей') +
    ' не виден совсем — он шифруется. «Я подарю» на ' + W.say(W.you, 'его', 'её') + ' хотелке тоже видно только тебе.</div>' + shopLine + '</div>' +
    (list.length ? '<div class="wgrid">' + list.map(wishCard).join('') + '</div>'
      : '<div class="card sec"><h3>Пусто</h3><div class="sub">Вставь ссылку на товар — магазин подставится сам. Можно добавить фото ссылкой на картинку.</div>' +
        '<button class="big-btn" data-a="wnew">Добавить карточку</button></div>');
}
