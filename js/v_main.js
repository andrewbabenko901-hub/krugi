/* ============================================================
   Главный экран — набор виджетов.
   Какие виджеты показывать и в каком порядке, каждый решает сам
   (Настройки → Главный экран или кнопка «вид»). На телефоне всё
   идёт одной колонкой ровно в выбранном порядке; на широком экране
   виджеты «про пару и планы» уходят в правую колонку.
   ============================================================ */
import { esc, fmt, pl, pln, DN, human, parse, addD, wkStart, key, addK, wkStartK, money, safeUrl, inDays, shortK } from './util.js';
import { miniRing, chk, av } from './ui.js';
import { W, nav } from './ctx.js';
import { S } from './store.js';
import { sync } from './sync.js';
import { BADGES, pledgeProg, pledgeText, goalNow, inbox, feed, upcomingDates } from './model.js';
import { cellHTML, segs, whoTag, eventRow, syncPill, MOODS } from './parts.js';

export const WIDGETS = {
  strip:   { t: 'Лента дней', d: 'Дни недели с полосками закрытого' },
  hero:    { t: 'Серия и уровень', d: 'Дни подряд, опыт и уровень' },
  status:  { t: 'Статус дня', d: 'Сколько закрыто и что горит' },
  inbox:   { t: 'Входящие от пары', d: 'Просьбы, приглашения, предложения' },
  circles: { t: 'Сетка кругов', d: 'Все твои и общие круги' },
  quick:   { t: 'Быстрые отметки', d: 'Ближайшие открытые дела' },
  pledges: { t: 'Обещания', d: 'Награды за выполненное', side: 1 },
  goal:    { t: 'Цель пары', d: 'Общая цель недели', side: 1 },
  partner: { t: 'Круги пары', d: 'Как день у второй половины', side: 1 },
  events:  { t: 'Ближайшие планы', d: 'Прогулки, свидания, поездки', side: 1 },
  dates:   { t: 'Поводы', d: 'Дни рождения и важные даты', side: 1 },
  shop:    { t: 'Что купить', d: 'Открытые покупки на день', side: 1 },
  feed:    { t: 'Лента пары', d: 'Что происходило у второй половины', side: 1 },
  badge:   { t: 'Следующее достижение', d: 'Ближайший значок и сколько осталось', side: 1 },
  week:    { t: 'Мини-неделя', d: 'Столбики по дням: ты и пара' },
  wish:    { t: 'Идея подарка', d: 'Случайная хотелка пары', side: 1 },
};

const R = {};

R.strip = () => {
  const ws = wkStart(parse(nav.VD)); let o = '';
  for (let i = 0; i < 7; i++) {
    const d = addD(ws, i), k = key(d), p = Math.round(W.dayPct(W.me, k) * 100);
    o += '<button class="dbtn' + (k === nav.VD ? ' sel' : '') + (k === W.today ? ' now' : '') + (k > W.today ? ' fut' : '') +
      '" data-a="day" data-v="' + k + '"><div class="dw">' + DN[i] + '</div><div class="dd">' + d.getDate() + '</div>' +
      '<div class="db"><i style="width:' + p + '%"></i></div></button>';
  }
  return '<div class="strip"><button class="arr" data-a="shift" data-v="-7" aria-label="Неделя назад">‹</button><div class="dcol">' + o +
    '</div><button class="arr" data-a="shift" data-v="7" aria-label="Неделя вперёд">›</button></div>';
};

R.hero = () => {
  const s = W.sum(), L = W.lvl();
  return '<div class="card sec hero"><div class="streak"><div class="n osw">' + s.streak + '</div><div class="l"><b>' +
    pl(s.streak, ['день', 'дня', 'дней']) + ' подряд</b>лучшая ' + s.best + '</div></div>' +
    '<button class="lvl" data-a="more" data-v="badges"><div class="lt"><b>' + L.L + ' · ' + esc(L.name) + '</b><span>' +
    fmt(L.xp) + ' / ' + fmt(L.to) + ' оп.</span></div><div class="xpbar"><i style="width:' + Math.round(L.p * 100) + '%"></i></div>' +
    '<div class="sub" style="margin-top:.3rem">страховок на неделю: ' + W.insLeft(W.today) + ' · значков ' + s.badges.length + ' из ' + BADGES.length + '</div></button></div>';
};

R.status = () => {
  const k = nav.VD, A = W.dayOf(W.me, k), left = A.a - A.d, isT = k === W.today, fut = k > W.today;
  // считаем только круги, в которых на этот день что-то есть: пустая папка — не «закрытый круг»
  const live = W.myCircles.filter(c => !c.off && !W.prog(c, k).empty);
  const closed = live.filter(c => W.prog(c, k).p >= 1).length, all = live.length;
  const box = !A.a ? '<div class="infobox">На этот день ничего не стоит. Добавь дело в круг или во вкладке «План».</div>'
    : fut ? '<div class="infobox">День впереди. Отмечать можно будет в сам день.</div>'
    : left > 0 ? '<div class="alert"><b>!</b><div>' + (isT
      ? (W.sum().streak ? 'Пропуск сегодня обнулит серию из ' + pln(W.sum().streak, ['дня', 'дней', 'дней']) + '. ' : '') + 'Страховок на неделю: ' + W.insLeft(k) + '.'
      : 'В этот день осталось ' + pln(left, ['незакрытое', 'незакрытых', 'незакрытых']) + '. Дозакрыть можно прямо отсюда.') + '</div></div>'
    : '<div class="okbox">День закрыт целиком.' + (isT ? ' Серия: ' + W.sum().streak + '.' : '') + '</div>';
  return '<div class="card sec"><div class="stop"><div class="big">' + A.d + ' из ' + A.a + '</div>' +
    '<div class="sm">кругов закрыто ' + closed + ' из ' + all + '<br>' + (W.sealed(k) ? '🔒 план запечатан' : 'без печати') + '</div></div>' +
    segs(k) + '<div class="stat2">Осталось <b>' + Math.max(0, left) + '</b> ' + pl(Math.max(0, left), ['дело', 'дела', 'дел']) +
    '. Полоска — круг, закрашена настолько, насколько закрыт.</div>' + box + '</div>';
};

R.inbox = () => {
  const ib = inbox(W);
  if (!ib.length) return '';
  const it = ib.slice(0, 2).map(x => {
    if (x.kind === 'req') return '<div class="inb"><div>📨 ' + esc(x.x.n) + '</div><div class="mini"><span class="tagi">от ' + esc(W.gen(x.x.own)) +
      '</span>' + (x.x.d ? '<span class="tagi">' + esc(inDays(x.x.d)) + '</span>' : '') + (x.x.note ? '<span class="tagi">' + esc(x.x.note) + '</span>' : '') + '</div>' +
      '<div class="a"><button class="ok" data-a="reqacc" data-id="' + esc(x.x.id) + '" data-v="today">На сегодня</button><button data-a="reqacc" data-id="' + esc(x.x.id) +
      '" data-v="tom">На завтра</button><button data-a="reqdec" data-id="' + esc(x.x.id) + '">Нет</button></div></div>';
    if (x.kind === 'ev') return '<div class="inb">' + eventRow(x.x, { rsvp: true }) + '</div>';
    return '<div class="inb"><div>🤝 ' + esc(W.name(x.x.own)) + ' ' + W.say(x.x.own, 'предлагает', 'предлагает') + ' обещание: ' + esc(pledgeText(W, x.x)) +
      ' → ' + esc(x.x.reward) + '</div><div class="a"><button class="ok" data-a="propacc" data-id="' + esc(x.x.id) + '">Обещаю</button><button data-a="propdec" data-id="' +
      esc(x.x.id) + '">Не сейчас</button></div></div>';
  }).join('');
  return '<div class="card sec" style="border-color:var(--acc)"><div class="ch"><h3>Входящие · ' + ib.length + '</h3>' +
    '<button class="lnk" data-a="tab" data-v="pair">все во «Вместе» ›</button></div>' + it + '</div>';
};

R.circles = () => {
  const k = nav.VD, list = W.myCircles;
  if (!list.length) return '<div class="card sec"><h3>Кругов пока нет</h3><div class="sub">Круг — это папка дел, счётчик (шаги, вода, задачи по работе), список покупок или настроение. Создай первый.</div>' +
    '<button class="big-btn" data-a="cnew">Создать круг</button><button class="big-btn alt" data-a="quick">Или набор для старта</button></div>';
  const cols = S.ui.cols ? 'repeat(' + S.ui.cols + ',1fr)' : 'repeat(auto-fill,minmax(6.4rem,1fr))';
  return '<div class="grid sec" style="grid-template-columns:' + cols + '">' + list.map(c => cellHTML(c, k)).join('') +
    '<button class="addc" data-a="cnew">+ новый круг</button></div>';
};

R.quick = () => {
  const k = nav.VD;
  const open = W.tasksOn(k).filter(t => W.isMineToDo(t) && W.st(t, k) === 'open' && !(W.circleById[t.c] || {})._ro).slice(0, 5);
  const moods = W.myCircles.filter(c => c.k === 'mood' && c._mine && !W.cval(c, k));
  return '<div class="card sec"><h3>Быстрые отметки</h3>' +
    (moods.length && k <= W.today ? '<div class="mood" style="margin-top:.5rem">' + MOODS.map((m, i) =>
      '<button data-a="mood" data-id="' + esc(moods[0].id) + '" data-v="' + (i + 1) + '" aria-label="' + m[1] + '">' + m[0] + '</button>').join('') + '</div>' : '') +
    (open.length ? '<ul style="margin-top:.5rem">' + open.map(t => {
      const c = W.circleById[t.c];
      return '<li class="t"><button class="bx" data-a="tk" data-id="' + esc(t.id) + '" data-k="' + k + '">' + chk() + '</button><span class="nm2"><span class="ttl">' +
        esc(t.n) + '</span><span class="mini">' + (c ? '<span class="tagi">' + esc(c.i + ' ' + c.n) + '</span>' : '') + (c && c._shared ? whoTag(W.doerOf(t)) : '') +
        (t.q ? '<span class="tagi">' + esc(t.q) + '</span>' : '') + '</span></span></li>';
    }).join('') + '</ul>' : '<div class="sub">Открытых дел на этот день нет.</div>') + '</div>';
};

function pledgeMini(p) {
  const x = pledgeProg(W, p), toMe = p.to === W.me;
  return '<div class="pl' + (x.won ? ' won' : '') + '"><div class="pt"><span class="ic">' + (x.won ? '🏆' : '🎁') + '</span><div style="flex:1;min-width:0"><b>' +
    esc(p.reward || 'сюрприз') + '</b><small>' + (toMe ? esc(W.name(p.giver)) + ' ' + W.say(p.giver, 'обещал', 'обещала') + ' тебе' : 'ты → ' + esc(W.dat(p.to))) + ': ' +
    esc(pledgeText(W, p)) + '</small></div></div><div class="gb au"><i style="width:' + Math.round(x.p * 100) + '%"></i></div>' +
    '<div class="pr"><span>' + (p.cond && p.cond.t === 'manual' ? (x.won ? 'засчитано' : 'на слово') : x.have + ' из ' + x.need) + '</span><span>' +
    (x.won ? (p.st === 'given' ? 'подарено ✓' : 'выполнено!') : x.expired ? 'срок вышел' : x.left != null ? 'осталось ' + pln(Math.max(0, x.left), ['день', 'дня', 'дней']) : '') + '</span></div></div>';
}
R.pledges = () => {
  const act = W.pledges.filter(p => p.st === 'active' || (p.st === 'given' && !W.thanksMine[p.id] && p.to === W.me));
  const mine = act.filter(p => p.to === W.me), theirs = act.filter(p => p.giver === W.me);
  return '<div class="card sec"><div class="ch"><h3>Обещания</h3><button class="lnk" data-a="pledgenew">+ обещать</button></div>' +
    (mine.length ? mine.slice(0, 3).map(pledgeMini).join('') : '<div class="sub">Тебе пока ничего не обещано. Можно попросить: «если я… — подаришь…?»</div>') +
    (theirs.length ? '<div class="sub" style="margin-top:.7rem">Ты обещал' + W.say(W.me, '', 'а') + ':</div>' + theirs.slice(0, 3).map(pledgeMini).join('') : '') + '</div>';
};

R.goal = () => {
  const g = goalNow(W);
  if (!g) return '<div class="card sec"><h3>Цель пары</h3><div class="sub">Общая цель на неделю и живая награда держат лучше очков: «пять дней закрываем оба — в субботу кино».</div>' +
    '<button class="big-btn alt" data-a="goalset">Задать цель недели</button></div>';
  return '<div class="card sec"><div class="ch"><h3>' + esc(g.g.n) + '</h3><button class="lnk" data-a="goalset">изменить</button></div>' +
    '<div class="gb"><i style="width:' + Math.round(g.p * 100) + '%"></i></div><div class="sub" style="margin-top:0">' + g.have + ' из ' + g.need + ' дней закрыли оба</div>' +
    (g.g.rw ? '<div style="margin-top:.45rem;font-size:.86rem">Награда: ' + esc(g.g.rw) + '</div>' : '') +
    (g.have >= g.need ? '<div class="okbox">Цель недели взята — награда ваша.</div>' : '') + '</div>';
};

R.partner = () => {
  const you = W.you, nm = W.name(you);
  if (!W.hasPartner) return '<div class="card sec"><div class="ph">' + av(nm, W.col(you)) + '<b>' + esc(nm) + '</b></div>' +
    '<div class="sub" style="margin-top:0">Круги ' + esc(W.gen(you)) + ' появятся здесь, когда оба телефона подключатся к общей базе.</div>' +
    '<button class="big-btn alt" data-a="more" data-v="sync">Подключить синхронизацию</button></div>';
  const k = nav.VD, d = W.dayOf(you, k), cs = W.yourCircles.concat(W.myCircles.filter(c => c._shared)).slice(0, 8);
  const lvl = W.sumYou ? W.sumYou.lvl + ' · ' + (W.sumYou.lvlName || '') : '';
  return '<div class="card sec"><div class="ph">' + av(nm, W.col(you)) + '<div><b>' + esc(nm) + '</b><div class="sub" style="margin-top:0">' + esc(lvl) +
    (W.sumYou ? ' · серия ' + W.sumYou.streak : '') + '</div></div><span class="s">' + (d.unknown ? '—' : d.d + '/' + d.a) + '</span></div>' +
    (cs.length ? '<div class="mg">' + cs.map(c => {
      const x = W.prog(c, k);
      return '<button data-a="circle" data-id="' + esc(c.id) + '">' + miniRing(x.empty ? 0 : x.p, c.col, c.i + ' ' + c.n, c.k === 'mood' && W.cval(c, k) ? MOODS[W.cval(c, k) - 1][0] : null) + '</button>';
    }).join('') + '</div>' : '<div class="sub">Открытых кругов у ' + esc(W.gen(you)) + ' нет — всё личное.</div>') +
    '<div class="kud">' + ['❤️', '👏', '🔥', '💪', '🤗'].map(e => '<button data-a="kudos" data-v="' + e + '" aria-label="Поддержать ' + e + '">' + e + '</button>').join('') + '</div></div>';
};

R.events = () => {
  const up = W.events.filter(e => !e.done && e.date >= W.today && (e._mine || e.with === 'us'))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 3);
  return '<div class="card sec"><div class="ch"><h3>Ближайшие планы</h3><button class="lnk" data-a="evnew">+ план</button></div>' +
    (up.length ? up.map(e => eventRow(e, { rsvp: true })).join('') : '<div class="sub">Пусто. Прогулка в субботу, кино, поездка к родителям — всё сюда.</div>') + '</div>';
};

R.dates = () => {
  const up = upcomingDates(W, 60).slice(0, 6);
  return '<div class="card sec"><div class="ch"><h3>Поводы</h3><button class="lnk" data-a="datesheet">все даты</button></div>' +
    (up.length ? '<div class="occ">' + up.map(x => '<button class="oc' + (x.left <= 14 ? ' soon' : '') + '" data-a="occ" data-v="' + esc(x.k) + '" data-n="' + esc(x.n) + '">' +
      '<span>' + (x.kind === 'bday' ? '🎂' : x.kind === 'anniv' ? '💍' : '📅') + ' ' + esc(shortK(x.k)) + '</span><b>' + esc(x.n) + '</b><span class="osw dd">' +
      (x.left === 0 ? 'сегодня' : x.left + ' ' + pl(x.left, ['день', 'дня', 'дней'])) + '</span></button>').join('') + '</div>'
      : '<div class="sub">В ближайшие два месяца поводов нет. Дни рождения и годовщины добавляются в «Покупках» → «Поводы».</div>') + '</div>';
};

R.shop = () => {
  const k = nav.VD, shops = W.myCircles.filter(c => c.k === 'shop');
  const open = [];
  for (const c of shops) for (const t of W.tasksOf(c.id, k)) if (!W.isDone(t, k)) open.push({ t, c });
  const sum = open.reduce((a, x) => a + (x.t.pr || 0), 0);
  const plan = W.wishes.filter(w => w.st === 'plan');
  return '<div class="card sec"><div class="ch"><h3>Что купить</h3><button class="lnk" data-a="tab" data-v="wish">покупки ›</button></div>' +
    (open.length ? '<ul style="margin-top:.4rem">' + open.slice(0, 5).map(x => '<li class="t"><button class="bx" data-a="tk" data-id="' + esc(x.t.id) + '" data-k="' + k + '">' + chk() +
      '</button><span class="nm2"><span class="ttl">' + esc(x.t.n) + '</span><span class="mini">' + (x.t.q ? '<span class="tagi">' + esc(x.t.q) + '</span>' : '') +
      (x.t.st ? '<span class="tagi">' + esc(x.t.st) + '</span>' : '') + '</span></span>' + (x.t.pr ? '<span class="q2">' + esc(money(x.t.pr)) + '</span>' : '') + '</li>').join('') + '</ul>' +
      (open.length > 5 ? '<div class="sub">и ещё ' + (open.length - 5) + '</div>' : '') + (sum ? '<div class="sum"><span>Осталось на</span><b>' + esc(money(sum)) + '</b></div>' : '')
      : '<div class="sub">На сегодня всё куплено или список пуст.</div>') +
    (plan.length ? '<div class="sub">В плане покупок: ' + plan.length + ' ' + pl(plan.length, ['карточка', 'карточки', 'карточек']) + ' на ' +
      esc(money(plan.reduce((a, w) => a + (w.pr || 0) * (w.qty > 1 ? w.qty : 1), 0))) + '</div>' : '') + '</div>';
};

R.feed = () => {
  const f = feed(W).slice(0, 5), seen = S.seen.feed || 0;
  if (!W.hasPartner) return '';
  return '<div class="card sec"><div class="ch"><h3>Лента пары</h3><button class="lnk" data-a="tab" data-v="pair">вся ›</button></div>' +
    (f.length ? '<div class="feed">' + f.map(x => '<div class="fi' + (x.at > seen ? ' new' : '') + '"><span class="e">' + esc(x.e) + '</span><div class="x">' +
      esc(x.t) + '<small>' + esc(new Date(x.at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</small></div></div>').join('') + '</div>'
      : '<div class="sub">Пока тихо.</div>') + '</div>';
};

R.badge = () => {
  const st = W.sum().stats;
  const next = BADGES.filter(b => b.v(st) < b.need).map(b => ({ b, p: b.v(st) / b.need })).sort((a, b) => b.p - a.p)[0];
  if (!next) return '<div class="card sec"><h3>Все значки собраны</h3><div class="sub">Это было непросто.</div></div>';
  return '<button class="card sec" data-a="more" data-v="badges" style="display:block;width:100%"><div class="ch"><h3>Следующий значок</h3><span class="lnk">все ›</span></div>' +
    '<div style="display:flex;gap:.7rem;align-items:center;margin-top:.5rem"><span style="font-size:2rem">' + next.b.e + '</span><div style="flex:1"><b>' + esc(next.b.n) +
    '</b><div class="sub" style="margin-top:0">' + esc(next.b.d) + '</div><div class="bar"><i style="width:' + Math.round(next.p * 100) + '%;background:var(--gold)"></i></div>' +
    '<div class="sub">' + fmt(next.b.v(st)) + ' из ' + fmt(next.b.need) + '</div></div></div></button>';
};

R.week = () => {
  const ws = wkStartK(nav.VD);
  let o = '';
  for (let i = 0; i < 7; i++) {
    const k = addK(ws, i), a = W.dayPct(W.me, k), b = W.hasPartner ? W.dayPct(W.you, k) : null;
    o += '<span><i class="' + (a >= 1 ? '' : 'low') + '" style="height:' + Math.max(4, Math.round(a * 100)) + '%;background:' + (a >= 1 ? esc(W.col(W.me)) : '') + '"></i>' +
      (b != null ? '<i class="' + (b >= 1 ? '' : 'low') + '" style="height:' + Math.max(4, Math.round(b * 100)) + '%;background:' + (b >= 1 ? esc(W.col(W.you)) : '') + '"></i>' : '') + '</span>';
  }
  return '<div class="card sec"><h3>Неделя' + (W.hasPartner ? ': ты и ' + esc(W.name(W.you)) : '') + '</h3><div class="cols7 duo">' + o + '</div>' +
    '<div class="clab">' + DN.map(d => '<span>' + d + '</span>').join('') + '</div></div>';
};

R.wish = () => {
  const list = W.wishes.filter(w => w.own === W.you && w.for === W.you && w.st !== 'bought');
  if (!list.length) return '';
  const w = list[(new Date().getDate() + list.length) % list.length], url = safeUrl(w.url);
  return '<div class="card sec"><div class="ch"><h3>Идея подарка</h3><button class="lnk" data-a="tab" data-v="wish">все ›</button></div>' +
    '<div class="sub" style="margin-top:.3rem">' + esc(W.name(W.you)) + ' хочет:</div><div style="font-weight:500;margin-top:.2rem">' + esc(w.t) + '</div>' +
    (w.pr ? '<div class="sub" style="margin-top:0">' + esc(money(w.pr)) + '</div>' : '') +
    '<div class="srow">' + (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">↗ открыть</a>' : '') +
    '<button data-a="wclaim" data-id="' + esc(w.id) + '">я подарю</button></div></div>';
};

export function vToday() {
  const k = nav.VD, isT = k === W.today, fut = k > W.today;
  const hd = '<div class="hd"><div><div class="dt">' + esc(human(parse(k))).toUpperCase() + (isT ? ' · СЕГОДНЯ' : fut ? ' · ВПЕРЁД' : ' · ПРОШЛОЕ') + '</div>' +
    '<h1>' + (isT ? 'Привет, ' + esc(W.name(W.me)) : 'Круги дня') + '</h1></div><div class="rowbtns">' + syncPill(sync) +
    (isT ? '' : '<button class="ghost" data-a="day" data-v="' + W.today + '">сегодня</button>') +
    '<button class="ghost" data-a="dashset">вид</button></div></div>';
  const on = S.ui.dash.filter(x => x.on && WIDGETS[x.id]);
  const html = id => { try { return R[id] ? R[id]() : ''; } catch (e) { console.error(id, e); return ''; } };
  if (nav.wide) {
    const main = on.filter(x => !WIDGETS[x.id].side).map(x => html(x.id)).join('');
    const side = on.filter(x => WIDGETS[x.id].side).map(x => html(x.id)).join('');
    return hd + '<div class="two-col"><div>' + main + '</div><div class="side" style="margin-top:1.1rem">' + side + '</div></div>';
  }
  return hd + on.map(x => html(x.id)).join('');
}
