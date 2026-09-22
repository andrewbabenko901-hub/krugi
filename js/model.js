/* ============================================================
   Модель: сводит мои данные и публичные данные пары в один «мир»
   и считает всё производное — прогресс кругов, день, серию, опыт,
   уровни, достижения, обещания, ленту.

   Производное нигде не хранится, а считается из фактов. Прототип
   держал серию счётчиком, который только рос и никогда не сбрасывался;
   здесь серия — это просто взгляд на историю дней.
   ============================================================ */
import { di, parse, addK, todayKey, wkStartK, range, nextOccurrence, daysBetween, declName, inDays } from './util.js';
import { S, LISTS, other, BOARDS_BUILTIN } from './store.js';

/* ---------- сведение ---------- */
function mergeList(a, b) {
  const m = new Map();
  for (const x of a) m.set(x.id, x);
  for (const x of b) { const y = m.get(x.id); if (!y || (x.upd || 0) > (y.upd || 0)) m.set(x.id, x); }
  return [...m.values()];
}
function mergeDayMap(a, b) {
  const out = {};
  for (const src of [a, b]) for (const id in src || {}) {
    const o = out[id] || (out[id] = {}), s = src[id];
    for (const d in s) if (!o[d] || (s[d].at || 0) > (o[d].at || 0)) o[d] = s[d];
  }
  return out;
}

export const LEVELS = ['Росток', 'Первые шаги', 'В ритме', 'Упорный', 'Собранный', 'Железная воля',
                       'Мастер кругов', 'Хозяин дня', 'Легенда дома', 'Гуру привычек'];
export const xpFor = L => 25 * (L - 1) * (L + 2);          // сколько нужно для уровня L
export function levelOf(xp) {
  let L = 1; while (xpFor(L + 1) <= xp) L++;
  const a = xpFor(L), b = xpFor(L + 1);
  return { L, name: LEVELS[L - 1] || ('Уровень ' + L), xp, from: a, to: b, p: (xp - a) / (b - a) };
}

export function buildWorld(S, P) {
  const me = S.me, you = other(me);
  const pub = (P && P.pub) || {};
  const W = { me, you, today: todayKey(), S, P };
  W.people = {
    [me]: S.people[me],
    [you]: Object.assign({}, S.people[you], (P && P.profile) || {}),
  };
  W.name = id => id === 'both' ? 'оба' : id === 'us' ? 'вместе' : (W.people[id] && W.people[id].name) || '?';
  // глаголы в прошедшем времени зависят от рода: «добавил» / «добавила»
  W.say = (id, m, f) => ((W.people[id] && W.people[id].g) === 'f' ? f : m);
  const dcl = (id, cs) => declName(W.name(id), W.people[id] && W.people[id].g, cs);
  W.gen = id => dcl(id, 'gen'); W.dat = id => dcl(id, 'dat'); W.acc = id => dcl(id, 'acc');
  W.col = id => (W.people[id] && W.people[id].col) || '#7B7D85';
  W.hasPartner = !!(P && P.pub);

  // Чужое — только публичное. Заглушки личного (vis prv без содержимого) выкидываем.
  const theirs = l => (pub[l] || []).filter(x => x.vis !== 'prv' && !x.sur);
  for (const l of LISTS) {
    W[l] = mergeList(S.data[l] || [], theirs(l))
      .filter(x => !x.del && !x.stub && !(x.own !== me && (x.vis === 'prv' || x.sur)))
      .map(x => ({ ...x, _mine: x.own === me }));
  }
  W.log = mergeDayMap(S.data.log, pub.log);
  W.counts = mergeDayMap(S.data.counts, pub.counts);
  W.answersMine = S.data.answers; W.answersYou = pub.answers || {};
  W.rsvpMine = S.data.rsvp; W.rsvpYou = pub.rsvp || {};
  W.thanksMine = S.data.thanks; W.thanksYou = pub.thanks || {};
  W.sealed = k => !!(S.data.sealed[k] && S.data.sealed[k].on);
  W.sumYou = (P && P.pub && P.pub.sum) || null;

  /* круги: мои + общие (чьи угодно) + «видно паре» у пары (только смотреть) */
  const order = S.ui.corder || [];
  const pos = id => { const i = order.indexOf(id); return i < 0 ? 1e6 : i; };
  for (const c of W.circles) {
    c._shared = c.vis === 'shared';
    c._ro = !c._mine && !c._shared;
    c.per = c.per || 'day';
  }
  W.circles.sort((a, b) => pos(a.id) - pos(b.id) || (a.cr || 0) - (b.cr || 0));
  W.groups = W.groups.filter(g => g.own === me || g.vis !== 'prv');
  W.groupById = Object.fromEntries(W.groups.map(g => [g.id, g]));
  W.myCircles = W.circles.filter(c => c._mine || c._shared);          // сетка на главном
  W.yourCircles = W.circles.filter(c => c.own === you && !c._shared);  // «видно паре» у пары
  W.circleById = Object.fromEntries(W.circles.map(c => [c.id, c]));

  const vis = new Set(W.circles.map(c => c.id));
  W.tasks = W.tasks.filter(t => vis.has(t.c) && !(t.prv && t.own !== me));
  W.taskById = Object.fromEntries(W.tasks.map(t => [t.id, t]));
  W.boards = BOARDS_BUILTIN.concat(W.boards);

  /* ---------- дела ---------- */
  W.onDate = (t, k) => {
    if (t.from && k < t.from) return false;
    if (t.to && k >= t.to) return false;
    if (t.r) return !!t.r[di(parse(k))];
    return t.d === k;
  };
  W.st = (t, k) => { const e = W.log[t.id] && W.log[t.id][k]; return e ? e.s : 'open'; };
  W.markOf = (t, k) => (W.log[t.id] && W.log[t.id][k]) || null;
  W.isDone = (t, k) => { const s = W.st(t, k); return s === 'done' || s === 'ins'; };
  W.tasksOf = (cid, k) => W.tasks.filter(t => t.c === cid && W.onDate(t, k));
  W.tasksOn = k => W.tasks.filter(t => W.onDate(t, k));
  W.doerOf = t => t.w || t.own;
  W.isMineToDo = (t, person = me) => { const w = W.doerOf(t); return w === person || w === 'both'; };

  /* ---------- счётчики ---------- */
  W.cval = (c, k) => { const e = W.counts[c.id] && W.counts[c.id][k]; return (e && e.v) || 0; };
  W.cnote = (c, k) => { const e = W.counts[c.id] && W.counts[c.id][k]; return (e && e.note) || ''; };
  W.cweek = (c, k) => { const a = wkStartK(k); let s = 0; for (let i = 0; i < 7; i++) s += W.cval(c, addK(a, i)); return s; };

  /** Работает ли круг в этот день: у круга можно задать дни недели. */
  W.active = (c, k) => !c.off && (!c.days || !c.days.length || c.days[di(parse(k))]);

  /** Прогресс круга: p от 0 до 1, d/a для папок, empty — если на день ничего нет. */
  W.prog = (c, k) => {
    if (!W.active(c, k)) return { p: 0, d: 0, a: 0, empty: true, off: true };
    if (c.k === 'count') {
      const v = c.per === 'week' ? W.cweek(c, k) : W.cval(c, k);
      return { p: Math.min(1, v / (c.g || 1)), v, g: c.g || 1, empty: false };
    }
    if (c.k === 'mood') { const v = W.cval(c, k); return { p: v ? 1 : 0, v, empty: false }; }
    const a = W.tasksOf(c.id, k), d = a.filter(t => W.isDone(t, k)).length;
    return { p: a.length ? d / a.length : 0, d, a: a.length, empty: !a.length };
  };
  W.cdone = (c, k) => { const x = W.prog(c, k); return x.empty || x.p >= 1; };

  /* Серия круга: сколько дней подряд он закрыт. Сегодня не наказывает —
     если сегодня ещё не закрыт, считаем от вчера: день не кончился. */
  W.cstreak = (c, k) => {
    let n = 0, day = k || W.today;
    if (!W.active(c, day) || W.prog(c, day).empty || W.prog(c, day).p < 1) day = addK(day, -1);
    for (let i = 0; i < 400; i++) {
      if (!W.active(c, day)) { day = addK(day, -1); continue; }   // выходной круга серию не рвёт
      const x = W.prog(c, day);
      if (x.empty || x.p < 1) break;
      n++; day = addK(day, -1);
    }
    return n;
  };
  /* Лучшая серия и лучший день счётчика — за всю историю отметок. */
  W.cbest = c => {
    const days = [];
    if (c.k === 'count' || c.k === 'mood') { const m = S.data.counts[c.id] || {}; for (const d in m) days.push(d); }
    else for (const t of W.tasksAll(c.id)) { const m = S.data.log[t.id] || {}; for (const d in m) days.push(d); }
    if (!days.length) return { streak: 0, top: 0 };
    days.sort();
    let run = 0, best = 0, prev = null, top = 0;
    for (let day = days[0]; day <= W.today; day = addK(day, 1)) {
      if (!W.active(c, day)) continue;
      const x = W.prog(c, day);
      if (c.k === 'count') top = Math.max(top, x.v || 0);
      if (!x.empty && x.p >= 1) { run++; best = Math.max(best, run); } else run = 0;
      prev = day;
    }
    void prev;
    return { streak: best, top };
  };
  /** Все дела круга, включая другие дни: для истории и рекордов. */
  W.tasksAll = cid => W.tasks.filter(t => t.c === cid);

  /** День человека: сколько на нём всего и сколько закрыто. */
  W.dayOf = (person, k) => {
    if (person !== me) {
      const s = W.sumYou && W.sumYou.days && W.sumYou.days[k];
      return s ? { a: s[0], d: s[1] } : { a: 0, d: 0, unknown: true };
    }
    let a = 0, d = 0;
    for (const c of W.myCircles) {
      if (!W.active(c, k)) continue;
      if (c.k === 'count' || c.k === 'mood') {
        if (c.per === 'week') continue;                 // недельная цель — не про день
        if (!c._mine && !c._shared) continue;
        a++; if (W.prog(c, k).p >= 1) d++;
        continue;
      }
      for (const t of W.tasksOf(c.id, k)) {
        if (!W.isMineToDo(t, person)) continue;
        a++; if (W.isDone(t, k)) d++;
      }
    }
    return { a, d };
  };
  W.full = (person, k) => { const x = W.dayOf(person, k); return x.a > 0 && x.d >= x.a; };
  W.dayPct = (person, k) => { const x = W.dayOf(person, k); return x.a ? x.d / x.a : 0; };

  /* ---------- страховки ---------- */
  W.insUsed = k => {
    const a = wkStartK(k), seen = new Set();
    for (const id in S.data.log) for (const d in S.data.log[id]) {
      const e = S.data.log[id][d];
      if (e.s === 'ins' && e.by === me && d >= a && d <= addK(a, 6)) {
        const t = W.taskById[id]; seen.add(d + ':' + (t ? t.c : id));
      }
    }
    return seen.size;
  };
  W.insLeft = k => Math.max(0, (S.prefs.ins || 0) - W.insUsed(k));

  /* ---------- производное: лениво и один раз на сборку мира ---------- */
  let sumCache = null;
  W.sum = () => sumCache || (sumCache = summarize(W));
  W.lvl = () => levelOf(W.sum().xp);

  W.personStreak = person => person === me ? W.sum().streak : ((W.sumYou && W.sumYou.streak) || 0);
  W.duoFull = k => W.full(me, k) && W.full(you, k);

  return W;
}

/* ============================================================
   Сводка по себе: публикуется паре (только числа, без содержания).
   ============================================================ */
export function summarize(W) {
  const S = W.S, me = W.me, today = W.today;
  let first = S.firstDay || today;
  for (const id in S.data.log) for (const k in S.data.log[id]) if (k < first) first = k;
  if (daysBetween(first, today) > 730) first = addK(today, -730);
  const days = range(first, today);

  const dayMap = {}, pub = {};
  let tasksDone = 0, fullDays = 0, xp = 0, moodDays = 0, waterDays = 0, steps = 0, duoDays = 0;
  for (const k of days) {
    const x = W.dayOf(me, k); dayMap[k] = x;
    if (daysBetween(k, today) <= 120) pub[k] = [x.a, x.d];
    if (x.a && x.d >= x.a) { fullDays++; xp += 25; }
    if (x.a && x.d >= x.a && W.full(W.you, k)) duoDays++;
  }
  // дела и счётчики — по моим отметкам
  for (const t of W.tasks) {
    if (!W.isMineToDo(t)) continue;
    const lg = W.log[t.id]; if (!lg) continue;
    for (const k in lg) {
      if (k > today || !W.onDate(t, k)) continue;
      if (lg[k].s === 'done') { tasksDone++; xp += 10; }
      else if (lg[k].s === 'ins') xp += 3;
    }
  }
  const weeksHit = new Set();
  for (const c of W.myCircles) {
    if (!(c._mine || c._shared)) continue;
    const cm = W.counts[c.id]; if (!cm) continue;
    for (const k in cm) {
      if (k > today) continue;
      const v = cm[k].v || 0;
      if (c.k === 'mood') { if (v) { moodDays++; xp += 5; } continue; }
      if (c.k !== 'count') continue;
      if (c.u === 'шагов' && c._mine) steps += v;
      if (c.per === 'week') { const w = wkStartK(k); if (!weeksHit.has(c.id + w) && W.cweek(c, k) >= c.g) { weeksHit.add(c.id + w); xp += 30; } }
      else if (v >= c.g) { xp += 10; if (c.u === 'мл' && c._mine) waterDays++; }
    }
  }

  // серия: пустые дни не рвут, но больше трёх пустых подряд — уже перерыв
  const streakFrom = start => {
    let s = 0, empty = 0, k = start;
    for (let i = 0; i < 800 && k >= first; i++, k = addK(k, -1)) {
      const x = dayMap[k] || { a: 0, d: 0 };
      if (!x.a) { if (++empty > 3) break; continue; }
      empty = 0;
      if (x.d >= x.a) s++; else break;
    }
    return s;
  };
  const td = dayMap[today] || { a: 0, d: 0 };
  const streak = (td.a && td.d >= td.a) ? streakFrom(today) : streakFrom(addK(today, -1));
  let best = 0, run = 0, empty = 0, bestWeek = 0;
  for (const k of days) {
    const x = dayMap[k];
    if (!x.a) { if (++empty > 3) run = 0; continue; }
    empty = 0;
    if (x.d >= x.a) { run++; if (run > best) best = run; } else run = 0;
  }
  const byWeek = {};
  for (const k of days) { const x = dayMap[k]; if (x.a && x.d >= x.a) { const w = wkStartK(k); byWeek[w] = (byWeek[w] || 0) + 1; } }
  for (const w in byWeek) bestWeek = Math.max(bestWeek, byWeek[w]);

  const kudosIn = W.kudos.filter(x => x.to === me).length;
  const kudosOut = W.kudos.filter(x => x.own === me).length;
  xp += kudosIn * 2;
  let pledgesWon = 0, pledgesGiven = 0;
  for (const p of W.pledges) {
    if (p.to === me && p.st === 'given') { pledgesWon++; xp += 50; }
    else if (p.to === me && p.st === 'active' && pledgeProg(W, p, { dayMap, streak }).won) pledgesWon++;
    if (p.giver === me && p.st === 'given') pledgesGiven++;
  }
  let walks = 0;
  for (const e of W.events) if (e.done && (e.with === 'us' || e.own === me)) { xp += 15; if (e.kind === 'walk' && e.with === 'us') walks++; }
  const sealed = Object.values(S.data.sealed).filter(x => x.on).length;
  const bought = W.wishes.filter(w => w.st === 'bought' && (w.boughtBy || w.own) === me).length
    + W.tasks.filter(t => W.circleById[t.c] && W.circleById[t.c].k === 'shop' && Object.values(W.log[t.id] || {}).some(e => e.s === 'done' && e.by === me)).length;

  const L = levelOf(xp);
  const stats = { tasksDone, fullDays, best, bestWeek, steps, waterDays, moodDays, walks, kudosIn, kudosOut,
                  pledgesWon, pledgesGiven, sealed, bought, duoDays, streak };
  const badges = BADGES.filter(b => b.v(stats) >= b.need).map(b => b.id);
  return { days: pub, dayMap, streak, best, xp, lvl: L.L, lvlName: L.name, badges, stats };
}

/* ============================================================
   Достижения: условия считаются из тех же фактов.
   ============================================================ */
export const BADGES = [
  { id: 't1', e: '✅', n: 'Первое дело', d: 'Закрыть первое дело', v: s => s.tasksDone, need: 1 },
  { id: 'd1', e: '⭕', n: 'Круг замкнулся', d: 'Первый полный день', v: s => s.fullDays, need: 1 },
  { id: 's3', e: '🔥', n: 'Три дня подряд', d: 'Серия из трёх полных дней', v: s => s.best, need: 3 },
  { id: 's7', e: '📆', n: 'Неделя без пропусков', d: 'Серия из семи дней', v: s => s.best, need: 7 },
  { id: 'fw', e: '🗓', n: 'Идеальная неделя', d: 'Семь полных дней в одной календарной неделе', v: s => s.bestWeek, need: 7 },
  { id: 's30', e: '🏔', n: 'Месяц в ритме', d: 'Серия из 30 дней', v: s => s.best, need: 30 },
  { id: 's100', e: '💎', n: 'Сотня', d: 'Серия из 100 дней', v: s => s.best, need: 100 },
  { id: 't100', e: '💯', n: 'Сто дел', d: 'Закрыть сто дел', v: s => s.tasksDone, need: 100 },
  { id: 't500', e: '🏗', n: 'Пятьсот дел', d: 'Закрыть пятьсот дел', v: s => s.tasksDone, need: 500 },
  { id: 'steps', e: '👟', n: 'Миллион шагов', d: 'Сумма по счётчику шагов', v: s => s.steps, need: 1e6 },
  { id: 'water', e: '💧', n: 'Водный баланс', d: '30 дней с выпитой нормой', v: s => s.waterDays, need: 30 },
  { id: 'mood', e: '🌤', n: 'Слушаю себя', d: 'Отметить настроение 14 дней', v: s => s.moodDays, need: 14 },
  { id: 'walk', e: '🌳', n: 'Десять прогулок', d: 'Десять совместных прогулок', v: s => s.walks, need: 10 },
  { id: 'duo', e: '👫', n: 'Одна команда', d: 'Семь дней, закрытых обоими', v: s => s.duoDays, need: 7 },
  { id: 'kin', e: '💞', n: 'Тёплые слова', d: 'Получить 10 поддержек', v: s => s.kudosIn, need: 10 },
  { id: 'kout', e: '🤗', n: 'Группа поддержки', d: 'Поддержать пару 20 раз', v: s => s.kudosOut, need: 20 },
  { id: 'pw', e: '🏆', n: 'Слово сдержано', d: 'Выполнить условие обещания', v: s => s.pledgesWon, need: 1 },
  { id: 'pg', e: '🎁', n: 'Щедрость', d: 'Подарить по своему обещанию', v: s => s.pledgesGiven, need: 1 },
  { id: 'seal', e: '🔒', n: 'Железный план', d: 'Запечатать десять дней', v: s => s.sealed, need: 10 },
  { id: 'buy', e: '🛍', n: 'Хозяйственный', d: 'Отметить купленными 25 позиций', v: s => s.bought, need: 25 },
];

/* ============================================================
   Обещания: «если ты сделаешь вот это — я подарю вот то».
   Прогресс считается по данным того, кому обещано.
   ============================================================ */
export const PLEDGE_TYPES = [
  { t: 'days',   n: 'закрыть круг N дней', u: ['день', 'дня', 'дней'] },
  { t: 'full',   n: 'N полных дней', u: ['день', 'дня', 'дней'] },
  { t: 'streak', n: 'серия N дней подряд', u: ['день', 'дня', 'дней'] },
  { t: 'sum',    n: 'набрать N по счётчику', u: null },
  { t: 'tasks',  n: 'сделать N дел', u: ['дело', 'дела', 'дел'] },
  { t: 'manual', n: 'на моё слово', u: null },
];

export function pledgeProg(W, p, own) {
  const ownDayMap = own && own.dayMap;
  const c = p.cond || {};
  const from = c.from || (p.cr ? todayKeyOf(p.cr) : W.today), until = c.until || '9999-12-31';
  const end = W.today < until ? W.today : until;
  const to = p.to;
  const dayOf = k => (to === W.me && ownDayMap && ownDayMap[k]) || W.dayOf(to, k);
  const need = c.t === 'manual' ? 1 : Math.max(1, +c.n || 1);
  let have = 0, err = '';
  const days = from <= end ? range(from, end) : [];
  if (c.t === 'days') {
    const circ = W.circleById[c.c];
    if (!circ) err = 'круг скрыт или удалён — считается только на слово';
    else if (circ.k === 'count' && circ.per === 'week') {
      const seen = new Set();
      for (const k of days) { const w = wkStartK(k); if (!seen.has(w) && W.cweek(circ, k) >= circ.g) { seen.add(w); have++; } }
    } else for (const k of days) if (W.prog(circ, k).p >= 1 && !W.prog(circ, k).empty) have++;
  } else if (c.t === 'full') {
    for (const k of days) { const x = dayOf(k); if (x.a && x.d >= x.a) have++; }
  } else if (c.t === 'streak') {
    have = (to === W.me && own && own.streak != null) ? own.streak : W.personStreak(to);
  } else if (c.t === 'sum') {
    const circ = W.circleById[c.c];
    if (!circ) err = 'круг скрыт или удалён';
    else for (const k of days) have += W.cval(circ, k);
  } else if (c.t === 'tasks') {
    for (const k of days) have += dayOf(k).d;
  } else {
    have = p.ok ? 1 : 0;
  }
  const won = p.st === 'given' || p.ok || have >= need;
  const expired = !won && W.today > until;
  return { have, need, won, expired, err, p: Math.min(1, have / need), left: until < '9999' ? daysBetween(W.today, until) : null };
}
function todayKeyOf(ts) {
  const d = new Date(ts - 4 * 3600e3);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function pledgeText(W, p) {
  const c = p.cond || {}, circ = W.circleById[c.c];
  const cn = circ ? '«' + circ.n + '»' : 'круг';
  const n = +c.n || 1;
  switch (c.t) {
    case 'days':   return 'закрыть ' + cn + ' ' + n + ' ' + (circ && circ.per === 'week' ? plural(n, ['неделю', 'недели', 'недель']) : plural(n, ['день', 'дня', 'дней']));
    case 'full':   return n + ' ' + plural(n, ['полный день', 'полных дня', 'полных дней']);
    case 'streak': return 'серия ' + n + ' ' + plural(n, ['день', 'дня', 'дней']) + ' подряд';
    case 'sum':    return 'набрать ' + n.toLocaleString('ru') + ' ' + (circ ? circ.u : '') + ' в ' + cn;
    case 'tasks':  return 'сделать ' + n + ' ' + plural(n, ['дело', 'дела', 'дел']);
    default:       return p.t || 'условие на слово';
  }
}
function plural(n, f) { const a = n % 10, b = n % 100; return (a === 1 && b !== 11) ? f[0] : (a >= 2 && a <= 4 && (b < 10 || b > 20)) ? f[1] : f[2]; }

/* ============================================================
   Цель пары на неделю: дни, когда закрыли оба.
   ============================================================ */
export function goalNow(W) {
  const w = wkStartK(W.today);
  const g = W.goals.filter(x => x.week === w).sort((a, b) => (b.upd || 0) - (a.upd || 0))[0];
  if (!g) return null;
  let have = 0;
  for (let i = 0; i < 7; i++) { const k = addK(w, i); if (k <= W.today && W.duoFull(k)) have++; }
  return { g, have, need: g.need || 5, p: Math.min(1, have / (g.need || 5)) };
}

/* ============================================================
   Входящие: что ждёт моего ответа.
   ============================================================ */
export function inbox(W) {
  const me = W.me, out = [];
  for (const r of W.requests) if (r.to === me && r.own !== me && !W.answersMine[r.id]) out.push({ kind: 'req', x: r });
  for (const p of W.pledges) if (p.st === 'proposed' && p.giver === me && p.own !== me) out.push({ kind: 'prop', x: p });
  for (const e of W.events) if (e.own !== me && e.with === 'us' && !W.rsvpMine[e.id] && !e.done && e.date >= W.today) out.push({ kind: 'ev', x: e });
  return out;
}

/* ============================================================
   Отправленное: что я послал паре и что с этим стало.
   Входящие отвечают на вопрос «что от меня хотят», отправленные —
   «что я просил и чем это кончилось». Без второго половина переписки
   просто пропадала из виду.
   ============================================================ */
export function sent(W) {
  const me = W.me, you = W.you, out = [];
  const nm = W.name(you), sv = (m, f) => W.say(you, m, f);

  for (const r of W.requests) {
    if (r.own !== me || r.to !== you) continue;
    const a = W.answersYou[r.id];
    const st = !a ? { k: 'wait', t: 'ждёт ответа' }
      : a.s === 'acc' ? (a.done ? { k: 'done', t: 'сделано' } : { k: 'ok', t: sv('взял', 'взяла') })
      : { k: 'no', t: sv('отказался', 'отказалась') };
    out.push({ at: r.cr || r.upd || 0, kind: 'req', id: r.id, x: r,
               e: r.kind === 'buy' ? '🛒' : '📨',
               t: (r.kind === 'buy' ? 'Просил купить: ' : 'Просьба: ') + r.n,
               sub: [r.note, r.d ? 'на ' + inDays(r.d) : ''].filter(Boolean).join(' · '), st });
  }
  for (const e of W.events) {
    if (e.own !== me || e.with !== 'us') continue;
    const a = W.rsvpYou[e.id];
    const st = e.done ? { k: 'done', t: 'состоялось' }
      : !a || a.off ? { k: 'wait', t: 'ждёт ответа' }
      : a.s === 'yes' ? { k: 'ok', t: 'идёт' } : a.s === 'no' ? { k: 'no', t: 'не сможет' } : { k: 'wait', t: 'может быть' };
    out.push({ at: e.cr || e.upd || 0, kind: 'ev', id: e.id, x: e, e: '📍',
               t: 'Позвал' + W.say(me, '', 'а') + ': ' + e.t,
               sub: [inDays(e.date), e.time, e.place].filter(Boolean).join(' · '), st });
  }
  for (const p of W.pledges) {
    if (p.st === 'cancel') continue;
    const mine = p.own === me;
    if (!mine) continue;
    const iGive = p.giver === me;
    const st = p.st === 'given' ? { k: 'done', t: 'подарено' }
      : p.st === 'proposed' ? { k: 'wait', t: 'ждёт ответа ' + W.gen(p.giver) }
      : { k: 'ok', t: 'в силе' };
    out.push({ at: p.cr || p.upd || 0, kind: 'pledge', id: p.id, x: p, e: '🤝',
               t: (iGive ? 'Обещал' + W.say(me, '', 'а') + ': ' : 'Просил' + W.say(me, '', 'а') + ' обещание: ') + (p.reward || 'сюрприз'),
               sub: pledgeText(W, p), st });
  }
  for (const k of W.kudos) if (k.own === me && k.to === you)
    out.push({ at: k.upd || 0, kind: 'kudos', id: k.id, x: k, e: k.e || '❤️',
               t: 'Поддержка ' + W.dat(you), sub: k.about || '', st: { k: 'done', t: 'доставлено' } });
  for (const k of W.pokes) if (k.own === me && k.to === you)
    out.push({ at: k.upd || 0, kind: 'poke', id: k.id, x: k, e: '🔔',
               t: 'Напоминание: ' + (k.about || 'дело'), sub: '', st: { k: 'done', t: 'доставлено' } });

  void nm;
  return out.sort((a, b) => (a.st.k === 'wait' ? 0 : 1) - (b.st.k === 'wait' ? 0 : 1) || b.at - a.at);
}

/* ============================================================
   Лента пары: что происходило у неё, по времени.
   ============================================================ */
export function feed(W) {
  const me = W.me, you = W.you, out = [];
  const nm = W.name(you), sv = (m, f) => W.say(you, m, f);
  for (const k of W.kudos) if (k.to === me) out.push({ at: k.upd, e: k.e || '❤️', t: nm + ': ' + (k.e || '❤️') + (k.about ? ' — ' + k.about : ''), kind: 'kudos' });
  for (const k of W.pokes) if (k.to === me) out.push({ at: k.upd, e: '🔔', t: nm + ' напоминает: ' + (k.about || 'дело'), kind: 'poke' });
  for (const r of W.requests) if (r.to === me && r.own === you)
    out.push({ at: r.cr || r.upd, e: r.kind === 'buy' ? '🛍' : '📨',
               t: nm + (r.kind === 'buy' ? ' просит купить: ' : ' просит: ') + r.n, kind: 'req' });
  for (const p of W.pledges) if (p.giver === you && p.to === me && p.st !== 'proposed') out.push({ at: p.cr || p.upd, e: '🤝', t: nm + ' обещает: ' + (p.reward || 'сюрприз'), kind: 'pledge' });
  for (const e of W.events) if (e.own === you && e.with === 'us') out.push({ at: e.cr || e.upd, e: '📍', t: nm + ' зовёт: ' + e.t, kind: 'event' });
  for (const w of W.wishes) if (w.own === you && !w.sur && w.for !== me) out.push({ at: w.cr || w.upd, e: '🛍', t: nm + ' ' + sv('добавил', 'добавила') + ' в покупки: ' + w.t, kind: 'wish' });
  for (const id in W.answersYou) {
    const a = W.answersYou[id], r = W.requests.find(x => x.id === id);
    if (r && r.own === me) out.push({ at: a.at, e: a.s === 'acc' ? '👍' : '🙅', t: nm + ' ' + (a.s === 'acc' ? sv('принял', 'приняла') : sv('отказался', 'отказалась')) + ': ' + r.n + (a.done ? ' · уже сделано' : ''), kind: 'ans' });
  }
  for (const id in W.rsvpYou) {
    const a = W.rsvpYou[id], e = W.events.find(x => x.id === id);
    if (e && e.own === me && !a.off) out.push({ at: a.at, e: a.s === 'yes' ? '✅' : a.s === 'no' ? '❌' : '🤔', t: nm + ': ' + ({ yes: 'иду', no: 'не получится', maybe: 'может быть' }[a.s] || '') + ' — ' + e.t, kind: 'rsvp' });
  }
  for (const id in W.thanksYou) {
    const p = W.pledges.find(x => x.id === id);
    if (p && p.giver === me) out.push({ at: W.thanksYou[id].at, e: '🥰', t: nm + ' благодарит за: ' + (p.reward || 'подарок'), kind: 'thanks' });
  }
  if (W.sumYou && W.sumYou.days) {
    const ks = Object.keys(W.sumYou.days).sort().slice(-7);
    for (const k of ks) { const [a, d] = W.sumYou.days[k]; if (a && d >= a) out.push({ at: parse(k).getTime() + 20 * 3600e3, e: '⭕', t: nm + ' ' + sv('закрыл', 'закрыла') + ' день целиком', kind: 'full', k }); }
  }
  const hide = new Set(S.ui.feedHide || []);
  return out.filter(x => x.at).map(x => ({ ...x, key: x.kind + ':' + Math.round(x.at / 1000) }))
    .filter(x => !hide.has(x.key))
    .sort((a, b) => b.at - a.at).slice(0, 40);
}

/* Ближайшие поводы: дни рождения и памятные даты. */
export function upcomingDates(W, days = 60) {
  const out = [];
  const add = (n, mmdd, kind, who, id) => {
    const k = nextOccurrence(mmdd, W.today); if (!k) return;
    const left = daysBetween(W.today, k); if (left <= days) out.push({ n, k, left, kind, who, id });
  };
  for (const id of [W.me, W.you]) { const b = W.people[id] && W.people[id].bday; if (b) add(W.name(id), b, 'bday', id); }
  for (const d of W.dates) add(d.n, d.md, d.kind || 'bday', null, d.id);
  return out.sort((a, b) => a.left - b.left);
}
