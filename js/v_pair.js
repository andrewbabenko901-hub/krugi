/* Вместе: пара, обещания, цель недели, входящие, лента. */
import { esc, fmt, pl, pln, addK, inDays, money } from './util.js';
import { W, nav } from './ctx.js';
import { S } from './store.js';
import { av, miniRing, chk } from './ui.js';
import { pledgeProg, pledgeText, goalNow, inbox, feed } from './model.js';
import { whoTag, eventRow, header, MOODS } from './parts.js';

/** Дней подряд, когда закрыли оба. */
function duoStreak() {
  let s = 0, k = W.full(W.me, W.today) && W.full(W.you, W.today) ? W.today : addK(W.today, -1);
  for (let i = 0; i < 400; i++, k = addK(k, -1)) { if (W.duoFull(k)) s++; else break; }
  return s;
}

export function pledgeCard(p) {
  const x = pledgeProg(W, p), toMe = p.to === W.me, giver = p.giver, meGiver = giver === W.me;
  const status = p.st === 'proposed' ? 'предложено, ждёт ответа ' + W.gen(giver)
    : p.st === 'given' ? 'подарено ✓' + (W.thanksMine[p.id] || W.thanksYou[p.id] ? ' · спасибо сказано' : '')
    : p.st === 'cancel' ? 'отменено'
    : x.won ? 'условие выполнено!' : x.expired ? 'срок вышел' : x.left != null ? 'осталось ' + pln(Math.max(0, x.left), ['день', 'дня', 'дней']) : 'без срока';
  const acts = [];
  if (meGiver && p.st === 'active' && x.won) acts.push('<button class="ok" data-a="pgive" data-id="' + esc(p.id) + '">🎁 Подарено</button>');
  if (meGiver && p.st === 'active' && p.cond && p.cond.t === 'manual' && !p.ok) acts.push('<button class="ok" data-a="pok" data-id="' + esc(p.id) + '">Засчитать</button>');
  if (toMe && p.st === 'given' && !W.thanksMine[p.id]) acts.push('<button class="ok" data-a="pthanks" data-id="' + esc(p.id) + '">🥰 Спасибо</button>');
  if ((meGiver || p.own === W.me) && (p.st === 'active' || p.st === 'proposed')) acts.push('<button data-a="pedit" data-id="' + esc(p.id) + '">Изменить</button>');
  if (x.err) acts.push('<span class="sub">' + esc(x.err) + '</span>');
  return '<div class="pl' + (x.won && p.st !== 'cancel' ? ' won' : '') + '"><div class="pt"><span class="ic">' + (p.st === 'given' ? '🎁' : x.won ? '🏆' : '🤝') + '</span>' +
    '<div style="flex:1;min-width:0"><b>' + esc(p.reward || 'сюрприз') + '</b><small>' + (toMe ? esc(W.name(giver)) + ' → тебе' : 'ты → ' + esc(W.dat(p.to))) +
    ' · условие: ' + esc(pledgeText(W, p)) + (p.cond && p.cond.until ? ' до ' + esc(inDays(p.cond.until)) : '') + '</small>' +
    (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div></div>' +
    (p.st !== 'proposed' && p.st !== 'cancel' ? '<div class="gb au"><i style="width:' + Math.round(x.p * 100) + '%"></i></div>' : '') +
    '<div class="pr"><span>' + (p.cond && p.cond.t === 'manual' ? (x.won ? 'засчитано' : 'на слово ' + esc(W.gen(giver))) : fmt(x.have) + ' из ' + fmt(x.need)) +
    '</span><span>' + esc(status) + '</span></div>' + (acts.length ? '<div class="a">' + acts.join('') + '</div>' : '') + '</div>';
}

export function vPair() {
  const me = W.me, you = W.you, nmY = W.name(you);
  const dm = W.dayOf(me, W.today), dy = W.dayOf(you, W.today);
  const top = '<div class="card sec"><div class="duo"><div class="p">' + av(W.name(me), W.col(me), 'lg') + '<div><b>' + esc(W.name(me)) + '</b><div class="sub" style="margin-top:0">' +
    dm.d + '/' + dm.a + ' сегодня · ур. ' + W.lvl().L + '</div></div></div>' +
    '<div class="mid"><b class="osw">' + (W.hasPartner ? duoStreak() : '—') + '</b><span>дней вместе<br>подряд</span></div>' +
    '<div class="p r">' + av(nmY, W.col(you), 'lg') + '<div><b>' + esc(nmY) + '</b><div class="sub" style="margin-top:0">' +
    (W.hasPartner ? (dy.unknown ? '—' : dy.d + '/' + dy.a) + ' сегодня' + (W.sumYou ? ' · ур. ' + W.sumYou.lvl : '') : 'не подключена') + '</div></div></div></div>' +
    (W.hasPartner ? '<div class="kud" style="justify-content:center">' + ['❤️', '👏', '🔥', '💪', '🤗', '🌹'].map(e =>
      '<button data-a="kudos" data-v="' + e + '" aria-label="Поддержать ' + e + '">' + e + '</button>').join('') + '</div>'
      : '<div class="infobox">Чтобы видеть друг друга, подключи синхронизацию на обоих телефонах: <button data-a="more" data-v="sync" style="text-decoration:underline;color:inherit">как это сделать</button>.</div>') + '</div>';

  // входящие
  const ib = inbox(W);
  const ibHTML = ib.length ? ib.map(x => {
    if (x.kind === 'req') return '<div class="inb"><div>' + (x.x.kind === 'buy' ? '🛒 ' : '📨 ') + esc(x.x.n) + '</div><div class="mini"><span class="tagi">от ' + esc(W.gen(x.x.own)) + '</span>' +
      (x.x.d ? '<span class="tagi">на ' + esc(inDays(x.x.d)) + '</span>' : '') + (x.x.note ? '<span class="tagi">' + esc(x.x.note) + '</span>' : '') + '</div>' +
      '<div class="a"><button class="ok" data-a="reqacc" data-id="' + esc(x.x.id) + '">Взять</button>' +
      '<button data-a="reqdec" data-id="' + esc(x.x.id) + '">Отклонить</button></div></div>';
    if (x.kind === 'ev') return '<div class="inb">' + eventRow(x.x, { rsvp: true }) + '</div>';
    return '<div class="inb"><div>🤝 ' + esc(W.name(x.x.own)) + ' просит обещание: если ' + W.say(x.x.own, 'он', 'она') + ' — ' + esc(pledgeText(W, x.x)) +
      ', ты даришь: <b>' + esc(x.x.reward) + '</b></div><div class="a"><button class="ok" data-a="propacc" data-id="' + esc(x.x.id) + '">Обещаю</button>' +
      '<button data-a="propdec" data-id="' + esc(x.x.id) + '">Не сейчас</button></div></div>';
  }).join('') : '<div class="sub">Входящих нет. Просьба от ' + esc(W.gen(you)) + ' не встаёт в список молча — сначала появляется здесь.</div>';

  // обещания
  const tab = nav.pledgeTab;
  const pls = W.pledges.filter(p => p.st !== 'cancel' && (tab === 'me' ? p.to === me : p.giver === me))
    .sort((a, b) => (a.st === 'given') - (b.st === 'given') || (b.upd || 0) - (a.upd || 0));
  const plHTML = '<div class="card sec"><div class="ch"><h3>Обещания</h3><button class="lnk" data-a="pledgenew">+ новое</button></div>' +
    '<div class="sub" style="margin-top:0">«Если закроешь „Шаги“ пять дней до воскресенья — дарю кроссовки». Прогресс считается сам по вашим кругам.</div>' +
    '<div class="seg" style="margin-top:.6rem"><button data-a="ptab" data-v="me" aria-pressed="' + (tab === 'me') + '">Мне обещали</button>' +
    '<button data-a="ptab" data-v="you" aria-pressed="' + (tab === 'you') + '">Я обещал' + W.say(me, '', 'а') + '</button></div>' +
    (pls.length ? pls.map(pledgeCard).join('') : '<div class="sub" style="margin-top:.6rem">' + (tab === 'me'
      ? 'Пока ничего. Можно самому предложить: «если я… — подаришь…?» — кнопка «+ новое».'
      : 'Пообещай ' + esc(W.dat(you)) + ' награду за то, что для неё важно: шаги, чтение, спорт.') + '</div>') + '</div>';

  // цель недели
  const g = goalNow(W);
  const goalHTML = g ? '<div class="card sec"><div class="ch"><h3>🎯 ' + esc(g.g.n) + '</h3><button class="lnk" data-a="goalset">изменить</button></div>' +
    '<div class="gb"><i style="width:' + Math.round(g.p * 100) + '%"></i></div><div class="sub" style="margin-top:0">' + g.have + ' из ' + g.need + ' дней закрыли оба на этой неделе</div>' +
    (g.g.rw ? '<div style="margin-top:.4rem;font-size:.86rem">Награда: ' + esc(g.g.rw) + '</div>' : '') + '</div>'
    : '<div class="card sec"><h3>🎯 Цель недели</h3><div class="sub">Общая цель и живая награда: «пять дней закрываем оба — в субботу кино».</div>' +
      '<button class="big-btn alt" data-a="goalset">Задать цель</button></div>';

  // общие планы
  const evs = W.events.filter(e => e.with === 'us' && !e.done && e.date >= addK(W.today, -1))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''))).slice(0, 5);
  const evHTML = '<div class="card sec"><div class="ch"><h3>Планы вместе</h3><button class="lnk" data-a="evnew">+ план</button></div>' +
    (evs.length ? evs.map(e => eventRow(e, { rsvp: true })).join('') : '<div class="sub">Совместных планов нет. Прогулка? Кино? Выходные за городом?</div>') + '</div>';

  // общие круги сегодня
  const shared = W.myCircles.filter(c => c._shared && c.k !== 'count' && c.k !== 'mood');
  const shHTML = shared.map(c => {
    const ts = W.tasksOf(c.id, W.today);
    if (!ts.length) return '';
    const left = c.k === 'shop' ? ts.filter(t => !W.isDone(t, W.today)).reduce((a, t) => a + (t.pr || 0), 0) : 0;
    return '<div class="wkg" style="padding-left:0">' + esc(c.i + ' ' + c.n) + (left ? ' · ' + esc(money(left)) + ' осталось' : '') + '</div>' +
      ts.map(t => {
        const d = W.isDone(t, W.today), doer = W.doerOf(t);
        return '<div class="shoprow"><button class="bx' + (d ? ' on' : '') + '" data-a="tk" data-id="' + esc(t.id) + '" data-k="' + W.today + '">' + chk() + '</button>' +
          '<span class="nm2"><span style="' + (d ? 'text-decoration:line-through;color:var(--mut)' : '') + '">' + esc(t.n) + '</span><span class="mini">' + whoTag(doer) +
          (t.q ? '<span class="tagi">' + esc(t.q) + '</span>' : '') + '</span></span>' + (t.pr ? '<span class="q2">' + esc(money(t.pr)) + '</span>' : '') +
          (doer === you && !d ? '<button class="del" data-a="poke" data-id="' + esc(t.id) + '" aria-label="Напомнить">🔔</button>' : '') + '</div>';
      }).join('');
  }).join('');

  // лента
  const f = feed(W), seen = S.seen.feed || 0;
  const fHTML = '<div class="card sec"><h3>Лента</h3>' + (f.length ? '<div class="feed">' + f.slice(0, 15).map(x =>
    '<div class="fi' + (x.at > seen ? ' new' : '') + '"><span class="e">' + esc(x.e) + '</span><div class="x">' + esc(x.t) + '<small>' +
    esc(new Date(x.at).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) + '</small></div></div>').join('') + '</div>'
    : '<div class="sub">Здесь будет видно, что происходило у ' + esc(W.gen(you)) + ': закрытые дни, просьбы, обещания, поддержка.</div>') + '</div>';

  // круги пары
  const yc = W.yourCircles;
  const ycHTML = W.hasPartner ? '<div class="card sec"><div class="ph">' + av(nmY, W.col(you)) + '<b>Круги ' + esc(W.gen(you)) + '</b><span class="s">сегодня</span></div>' +
    (yc.length ? '<div class="mg">' + yc.map(c => {
      const x = W.prog(c, W.today);
      return '<button data-a="circle" data-id="' + esc(c.id) + '">' + miniRing(x.empty ? 0 : x.p, c.col, c.i + ' ' + c.n,
        c.k === 'mood' && W.cval(c, W.today) ? MOODS[W.cval(c, W.today) - 1][0] : null) + '</button>';
    }).join('') + '</div>' : '<div class="sub" style="margin-top:0">Все круги ' + esc(W.gen(you)) + ' личные.</div>') + '</div>' : '';

  const main = top + '<div class="card sec"><h3>Входящие' + (ib.length ? ' · ' + ib.length : '') + '</h3>' + ibHTML + '</div>' + plHTML +
    (shHTML ? '<div class="card sec"><h3>Общие круги сегодня</h3><div class="sub">Закрывает тот, кто сделал. Колокольчик — мягкое напоминание, одно в день.</div>' + shHTML + '</div>' : '');
  const side = goalHTML + evHTML + ycHTML + fHTML;
  return header('общий доступ', 'Вместе', '<button class="ghost" data-a="pmodego" data-v="req">попросить</button>') +
    (nav.wide ? '<div class="two-col"><div>' + main + '</div><div class="side" style="margin-top:1.1rem">' + side + '</div></div>' : main + side);
}
