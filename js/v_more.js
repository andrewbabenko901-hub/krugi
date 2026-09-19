/* Ещё: статистика, достижения, настройки, синхронизация, справка. */
import { esc, fmt, pl, DN, addK, range, parse, wkStartK, key, relTime } from './util.js';
import { W, nav } from './ctx.js';
import { S } from './store.js';
import { pick, tgl, av } from './ui.js';
import { BADGES, levelOf, xpFor } from './model.js';
import { header, circleSub } from './parts.js';
import { sync, getCfg, getKey, ready, DEFAULT_CFG, TOKEN_URL, makeSetupLink } from './sync.js';
import { qrSvg } from './qr.js';
import { cryptoOk } from './crypto.js';
import { WIDGETS } from './v_main.js';

const back = '<button class="ghost" data-a="more" data-v="menu">‹ назад</button>';

export function vMore() {
  const sub = nav.more;
  if (sub === 'stat') return vStat();
  if (sub === 'badges') return vBadges();
  if (sub === 'set') return vSet();
  if (sub === 'sync') return vSync();
  if (sub === 'help') return vHelp();
  const L = W.lvl();
  const items = [
    ['stat', '📊', 'Статистика', 'Периоды, круги, дни недели, что срывается'],
    ['badges', '🏅', 'Достижения', 'Уровень ' + L.L + ' · ' + W.sum().badges.length + ' из ' + BADGES.length + ' значков'],
    ['set', '⚙️', 'Настройки', 'Круги, главный экран, тема, профиль, данные'],
    ['sync', '🔄', 'Синхронизация', ready() ? (sync.st === 'err' ? 'ошибка: ' + sync.msg : 'подключено · ' + relTime(sync.pulledAt)) : 'не подключено — только этот телефон'],
    ['help', '💡', 'Как этим пользоваться', 'Круги, печать, страховки, обещания'],
  ];
  return header('ещё', 'Меню') + '<div class="menu">' + items.map(([v, e, n, d]) =>
    '<button data-a="more" data-v="' + v + '"><span class="e">' + e + '</span><b>' + esc(n) + '</b><small>' + esc(d) + '</small></button>').join('') + '</div>';
}

/* ---------------- статистика ---------------- */
const PERIODS = [['week', 'эта неделя'], ['prev', 'прошлая'], ['m1', 'месяц'], ['m3', 'три месяца']];
function daysIn(p) {
  const t = W.today;
  if (p === 'week') return range(wkStartK(t), t);
  if (p === 'prev') { const a = addK(wkStartK(t), -7); return range(a, addK(a, 6)); }
  if (p === 'm1') return range(addK(t, -29), t);
  return range(addK(t, -89), t);
}
function vStat() {
  const F = S.ui.stat, days = daysIn(F.per);
  let done = 0, fail = 0, ins = 0, tot = 0;
  const perCircle = {}, perDow = [0, 0, 0, 0, 0, 0, 0], dowTot = [0, 0, 0, 0, 0, 0, 0], perTask = {}, heat = [];
  for (const k of days) {
    let dd = 0, da = 0;
    for (const t of W.tasks) {
      if (!W.onDate(t, k) || !W.isMineToDo(t)) continue;
      if (F.fc !== 'all' && t.c !== F.fc) continue;
      const s = W.st(t, k); tot++; da++;
      const pc = perCircle[t.c] || (perCircle[t.c] = { d: 0, a: 0 }); pc.a++;
      const pt = perTask[t.id] || (perTask[t.id] = { n: t.n, d: 0, a: 0 }); pt.a++;
      if (s === 'done' || s === 'ins') { done++; dd++; pc.d++; pt.d++; if (s === 'ins') ins++; } else if (s === 'fail') fail++;
    }
    if (F.fc === 'all') for (const c of W.myCircles) {
      if ((c.k !== 'count' && c.k !== 'mood') || c.per === 'week' || c.off) continue;
      tot++; da++;
      const pc = perCircle[c.id] || (perCircle[c.id] = { d: 0, a: 0 }); pc.a++;
      if (W.prog(c, k).p >= 1) { done++; dd++; pc.d++; }
    }
    const i = (parse(k).getDay() + 6) % 7; dowTot[i] += da; perDow[i] += dd;
    heat.push({ k, p: da ? dd / da : 0, y: W.hasPartner ? W.dayPct(W.you, k) : null });
  }
  const pct = tot ? Math.round(done / tot * 100) : 0, fullDays = heat.filter(x => x.p >= 1).length;
  const duoDays = W.hasPartner ? days.filter(k => W.duoFull(k)).length : 0;
  const worst = Object.values(perTask).map(x => ({ n: x.n, p: x.a ? x.d / x.a : 1, a: x.a })).filter(x => x.a >= 2).sort((a, b) => a.p - b.p).slice(0, 5);
  const best = perDow.map((d, i) => ({ i, p: dowTot[i] ? d / dowTot[i] : 0 })).sort((a, b) => b.p - a.p);
  const counters = W.myCircles.filter(c => c.k === 'count').map(c => {
    const sum = days.reduce((a, k) => a + W.cval(c, k), 0);
    if (c.per === 'week') {
      const wk = [...new Set(days.map(wkStartK))], hit = wk.filter(w => W.cweek(c, w) >= c.g).length;
      return '<div class="brow"><div class="bl"><span>' + esc(c.i + ' ' + c.n) + '</span><span>' + fmt(sum) + ' ' + esc(c.u) + ' · недель с целью ' + hit + ' из ' + wk.length + '</span></div>' +
        '<div class="bar"><i style="width:' + Math.round(hit / wk.length * 100) + '%;background:' + esc(c.col) + '"></i></div></div>';
    }
    const hit = days.filter(k => W.cval(c, k) >= c.g).length;
    return '<div class="brow"><div class="bl"><span>' + esc(c.i + ' ' + c.n) + '</span><span>' + fmt(Math.round(sum / days.length)) + ' ' + esc(c.u) + ' в день · цель ' + hit + ' из ' + days.length + '</span></div>' +
      '<div class="bar"><i style="width:' + Math.round(hit / days.length * 100) + '%;background:' + esc(c.col) + '"></i></div></div>';
  }).join('');
  const moods = W.myCircles.filter(c => c.k === 'mood' && c._mine).map(c => {
    const vals = days.map(k => W.cval(c, k)).filter(Boolean);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return '<div class="brow"><div class="bl"><span>' + esc(c.i + ' ' + c.n) + '</span><span>' + (vals.length ? 'среднее ' + avg.toFixed(1) + ' из 5 · ' + vals.length + ' ' + pl(vals.length, ['отметка', 'отметки', 'отметок']) : 'нет отметок') + '</span></div>' +
      '<div class="heat">' + days.slice(-28).map(k => { const v = W.cval(c, k); return '<i title="' + k + '" style="background:' + (v ? ['#C8452F', '#E08A5A', '#C9B26A', '#7DBE8F', '#1D8F5B'][v - 1] : 'var(--track)') + '"></i>'; }).join('') + '</div></div>';
  }).join('');
  const col = p => p >= 1 ? '#1D8F5B' : p >= .7 ? '#67B98F' : p >= .4 ? '#A9D6BF' : p > 0 ? '#DCEBE3' : 'var(--track)';
  const heatHTML = '<div class="heat">' + heat.map(x => '<i title="' + x.k + ' · ' + Math.round(x.p * 100) + '%" style="background:' + col(x.p) + '"></i>').join('') + '</div>';
  const duoHTML = W.hasPartner && F.duo ? '<div class="card sec"><h3>Вы вдвоём</h3><div class="sub">Верхняя строка — ты, нижняя — ' + esc(W.name(W.you)) + '. Дней, закрытых обоими: <b>' + duoDays + '</b>.</div>' +
    heatHTML + '<div class="heat">' + heat.map(x => '<i style="background:' + (x.y == null ? 'var(--track)' : col(x.y)) + '"></i>').join('') + '</div></div>' : '';
  return header('статистика', PERIODS.find(p => p[0] === F.per)[1], back) +
    pick('sper', F.per, PERIODS) + pick('sfc', F.fc, [['all', 'все круги']].concat(W.myCircles.map(c => [c.id, c.i + ' ' + c.n])), 'acc') +
    '<div class="kpi sec"><div class="k"><b>' + pct + '%</b><span>закрыто</span></div><div class="k"><b>' + fmt(done) + '</b><span>сделано</span></div>' +
    '<div class="k"><b>' + fail + '</b><span>сдался</span></div><div class="k"><b>' + fullDays + '</b><span>полных дней из ' + days.length + '</span></div></div>' +
    '<div class="card sec"><h3>Дни периода</h3><div class="sub">Чем темнее, тем больше закрыто.</div>' + heatHTML + '</div>' + duoHTML +
    '<div class="card sec"><h3>По кругам</h3>' + (Object.keys(perCircle).length ? Object.keys(perCircle).map(id => {
      const c = W.circleById[id], x = perCircle[id]; if (!c) return '';
      return '<div class="brow"><div class="bl"><span>' + esc(c.i + ' ' + c.n) + '</span><span>' + Math.round(x.d / x.a * 100) + '% · ' + x.d + ' из ' + x.a + '</span></div>' +
        '<div class="bar"><i style="width:' + Math.round(x.d / x.a * 100) + '%;background:' + esc(c.col) + '"></i></div></div>';
    }).join('') : '<div class="sub">За период данных нет.</div>') + '</div>' +
    (counters ? '<div class="card sec"><h3>Счётчики</h3>' + counters + '</div>' : '') +
    (moods ? '<div class="card sec"><h3>Настроение</h3>' + moods + '</div>' : '') +
    '<div class="card sec"><h3>По дням недели</h3><div class="cols7">' + perDow.map((d, i) => {
      const p = dowTot[i] ? d / dowTot[i] : 0; return '<i class="' + (p >= .8 ? '' : 'low') + '" style="height:' + Math.max(4, Math.round(p * 100)) + '%"></i>';
    }).join('') + '</div><div class="clab">' + DN.map(d => '<span>' + d + '</span>').join('') + '</div>' +
    '<div class="sub">Лучший день — ' + DN[best[0].i] + ' (' + Math.round(best[0].p * 100) + '%), худший — ' + DN[best[6].i] + ' (' + Math.round(best[6].p * 100) + '%).</div></div>' +
    '<div class="card sec"><h3>Чаще всего срывается</h3>' + (worst.length ? worst.map(x => '<div class="brow"><div class="bl"><span>' + esc(x.n) + '</span><span>' +
      Math.round(x.p * 100) + '%</span></div><div class="bar"><i style="width:' + Math.round(x.p * 100) + '%;background:var(--warn)"></i></div></div>').join('') : '<div class="sub">Пока нечего показать.</div>') + '</div>' +
    '<div class="card sec"><h3>Страховки</h3><div class="sub">За период использовано ' + ins + '. На эту неделю осталось ' + W.insLeft(W.today) + ' из ' + S.prefs.ins + '.</div></div>';
}

/* ---------------- достижения ---------------- */
function vBadges() {
  const s = W.sum(), st = s.stats, L = levelOf(s.xp);
  const lv = '<div class="card sec"><div class="stop"><div class="big">Уровень ' + L.L + ' · ' + esc(L.name) + '</div><div class="sm">' + fmt(s.xp) + ' опыта</div></div>' +
    '<div class="xpbar" style="height:.7rem"><i style="width:' + Math.round(L.p * 100) + '%"></i></div><div class="sub">До уровня ' + (L.L + 1) + ' — ' + fmt(L.to - s.xp) + ' опыта.</div>' +
    '<div class="sub">Опыт: +10 за дело, +10 за цель счётчика, +5 за настроение, +25 за полный день, +30 за недельную цель, +15 за состоявшийся план, +50 за выигранное обещание, +2 за каждую поддержку от пары.</div></div>';
  const you = W.hasPartner && W.sumYou ? '<div class="card sec"><div class="ph">' + av(W.name(W.you), W.col(W.you)) + '<b>' + esc(W.name(W.you)) + '</b><span class="s">уровень ' +
    W.sumYou.lvl + ' · ' + esc(W.sumYou.lvlName || '') + '</span></div><div class="sub" style="margin-top:0">Значков ' + (W.sumYou.badges || []).length + ' из ' + BADGES.length +
    ' · серия ' + W.sumYou.streak + ' · лучшая ' + W.sumYou.best + '</div></div>' : '';
  const nums = '<div class="kpi sec"><div class="k"><b>' + fmt(st.tasksDone) + '</b><span>дел сделано</span></div><div class="k"><b>' + st.fullDays + '</b><span>полных дней</span></div>' +
    '<div class="k"><b>' + s.best + '</b><span>лучшая серия</span></div><div class="k"><b>' + st.duoDays + '</b><span>дней закрыли оба</span></div></div>';
  const ladder = '<div class="card sec"><h3>Лестница уровней</h3>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => {
    const lv = levelOf(xpFor(n));
    return '<div class="brow"><div class="bl"><span>' + (n <= L.L ? '✓ ' : '') + n + ' · ' + esc(lv.name) + '</span><span>' + fmt(xpFor(n)) + '</span></div></div>';
  }).join('') + '</div>';
  return header('достижения', 'Значки и уровень', back) + lv + nums + you +
    '<div class="bdg">' + BADGES.map(b => {
      const v = b.v(st), on = v >= b.need;
      return '<div class="bd1' + (on ? ' on' : '') + '"><div class="e">' + b.e + '</div><b>' + esc(b.n) + '</b><small>' + esc(b.d) + '</small>' +
        (on ? '' : '<div class="bar"><i style="width:' + Math.round(Math.min(1, v / b.need) * 100) + '%"></i></div><small>' + fmt(v) + ' / ' + fmt(b.need) + '</small>') + '</div>';
    }).join('') + '</div>' + ladder;
}

/* ---------------- настройки ---------------- */
function vSet() {
  const me = W.people[W.me];
  const circles = W.circles.filter(c => c._mine || c._shared).map((c, i, arr) =>
    '<div class="crow' + (c.off ? ' off' : '') + '"><div class="ic" style="background:' + esc(c.col) + '1f">' + esc(c.i) + '</div><div class="cn"><b>' + esc(c.n) + '</b><div>' +
    esc(circleSub(c)) + (c.off ? ' · на паузе' : '') + '</div></div><button class="del" data-a="csetup" data-id="' + esc(c.id) + '" aria-label="Настроить">✎</button>' +
    '<div class="ord"><button data-a="cup" data-id="' + esc(c.id) + '" ' + (i ? '' : 'disabled') + ' aria-label="Выше">▲</button><button data-a="cdown" data-id="' + esc(c.id) + '" ' +
    (i < arr.length - 1 ? '' : 'disabled') + ' aria-label="Ниже">▼</button></div></div>').join('');
  return header('настройка', 'Настройки', back) +
    '<div class="card sec"><h3>Кто я</h3><div class="ph" style="margin-top:.5rem">' + av(me.name, me.col, 'lg') + '<div><b>' + esc(me.name) + '</b><div class="sub" style="margin-top:0">' +
    'этот телефон — ' + esc(me.name) + '; пара — ' + esc(W.name(W.you)) + '</div></div></div>' +
    '<div class="two"><div class="fld"><label>Имя</label><input type="text" id="pname" value="' + esc(me.name) + '"></div>' +
    '<div class="fld"><label>День рождения</label><input type="date" id="pbday" value="' + (me.bday ? '2000-' + me.bday : '') + '"></div></div>' +
    '<div class="fld"><label>Имя пары (пока не подключена)</label><input type="text" id="pyou" value="' + esc(W.people[W.you].name) + '"></div>' +
    '<div class="fld"><label>Мой цвет</label><div class="cols8">' + ['#2F5BD0', '#1D8F5B', '#C98A12', '#8A55C4', '#C8452F', '#0E8C96', '#B0517E', '#15161A'].map(c =>
      '<button data-a="pcol" data-v="' + c + '" style="background:' + c + '" aria-pressed="' + (me.col === c) + '" aria-label="' + c + '"></button>').join('') + '</div></div>' +
    '<div class="fld"><label>Как обо мне писать</label>' + pick('pg', me.g || 'm', [['m', 'он: «закрыл»'], ['f', 'она: «закрыла»']]) + '</div>' +
    '<div class="srow"><button class="k" data-a="psave">Сохранить профиль</button></div></div>' +

    '<div class="card sec"><div class="ch"><h3>Круги</h3><button class="lnk" data-a="cnew">＋ круг</button></div><div style="margin-top:.5rem">' +
    (circles || '<div class="sub">Кругов нет.</div>') + '</div><div class="srow"><button data-a="quick">Добавить набор для старта</button></div></div>' +

    '<div class="card sec"><h3>Главный экран</h3><div class="sub">Что показывать и в каком порядке. У каждого свой.</div>' +
    '<div class="srow"><button class="k" data-a="dashset">Настроить виджеты</button><button data-a="wkset">Вид недели</button></div></div>' +

    '<div class="card sec"><h3>Оформление</h3><div class="fld"><label>Тема</label>' + pick('theme', S.ui.theme, [['auto', 'как в системе'], ['light', 'светлая'], ['dark', 'тёмная']]) + '</div>' +
    '<div class="fld"><label>Размер текста</label><div class="sizes">' + [[0.88, 's1'], [1, 's2'], [1.14, 's3'], [1.3, 's4']].map(([v, c]) =>
      '<button class="' + c + '" data-a="scale" data-v="' + v + '" aria-pressed="' + (S.ui.scale === v) + '">Аа</button>').join('') + '</div></div>' +
    '<div class="fld"><label>Плотность</label>' + pick('dens', S.ui.dens, [['compact', 'плотно'], ['normal', 'обычно'], ['roomy', 'просторно']]) + '</div></div>' +

    '<div class="card sec"><h3>Правила</h3><div class="fld"><label>Страховок в неделю</label>' + pick('insn', S.prefs.ins, [[0, '0'], [1, '1'], [2, '2'], [3, '3']]) + '</div>' +
    '<div class="sub">Страховка закрывает круг целиком в тяжёлый день и не рвёт серию. Ноль — строгий режим. День переключается в 04:00.</div></div>' +

    (W.tpls.some(t => t._mine) ? '<div class="card sec"><h3>Мои шаблоны дня</h3>' + W.tpls.filter(t => t._mine).map(t =>
      '<div class="shoprow"><span class="nm2">' + esc(t.n) + '<span class="mini"><span class="tagi">' + t.items.length + ' ' + pl(t.items.length, ['дело', 'дела', 'дел']) + '</span></span></span>' +
      '<button class="del" data-a="tpldel" data-id="' + esc(t.id) + '" aria-label="Удалить">✕</button></div>').join('') + '</div>' : '') +

    '<div class="card sec"><h3>Данные</h3><div class="sub">Всё хранится на этом телефоне' + (ready() ? ' и в приватном репозитории GitHub' : '') + '. Выгрузка — полный файл со всем, включая личное.</div>' +
    '<div class="srow"><button data-a="export">Выгрузить файл</button><label class="ghost" style="flex:1;text-align:center;padding:.65rem;border-radius:.6rem;cursor:pointer">Загрузить файл' +
    '<input type="file" accept="application/json" data-a="import" hidden></label></div>' +
    '<div class="srow"><button data-a="switchme">Это телефон ' + esc(W.gen(W.you)) + '</button><button class="w" data-a="reset">Стереть всё на телефоне</button></div></div>';
}

export function sheetDash() {
  const d = S.ui.dash;
  return '<div class="sn">Главный экран</div><div class="sub">Включай, выключай и переставляй. На широком экране виджеты про пару уходят вправо.</div>' +
    '<div style="margin-top:.7rem">' + d.map((x, i) => {
      const w = WIDGETS[x.id]; if (!w) return '';
      return '<div class="crow' + (x.on ? '' : ' off') + '"><div class="cn"><b>' + esc(w.t) + '</b><div>' + esc(w.d || '') + '</div></div>' +
        '<button class="tgl" data-a="dtog" data-v="' + x.id + '" aria-pressed="' + !!x.on + '" aria-label="' + esc(w.t) + '"><i></i></button>' +
        '<div class="ord"><button data-a="dup" data-v="' + i + '" ' + (i ? '' : 'disabled') + ' aria-label="Выше">▲</button><button data-a="ddown" data-v="' + i + '" ' +
        (i < d.length - 1 ? '' : 'disabled') + ' aria-label="Ниже">▼</button></div></div>';
    }).join('') + '</div>' +
    '<div class="fld"><label>Кругов в ряд</label>' + pick('dcol', S.ui.cols, [[0, 'авто'], [2, '2'], [3, '3'], [4, '4'], [5, '5']]) + '</div>' +
    '<div class="srow"><button data-a="dreset">Как было по умолчанию</button><button class="k" data-a="close">Готово</button></div>';
}

/* ---------------- синхронизация ---------------- */
/* Код привязки: QR плюс та же ссылка текстом. */
function linkBox() {
  if (!nav.link) return '';
  const mine = nav.link === 'mine';
  const link = makeSetupLink({ withKey: mine, who: mine ? W.me : W.you });
  if (!link) return '';
  let qr = '';
  try { qr = qrSvg(link); } catch { qr = ''; }
  return '<div class="sub" style="margin-top:.7rem">' +
    (mine ? 'Код для своего устройства — с ключом личного' : 'Код для ' + esc(W.gen(W.you)) + ' — без ключа личного') + ':</div>' +
    (qr ? '<div class="qr">' + qr + '</div>' : '') +
    '<div class="code">' + esc(link) + '</div>' +
    '<div class="srow"><button data-a="linkcopy" data-v="' + nav.link + '">Скопировать ссылку</button>' +
    '<button data-a="linkhide">Скрыть код</button></div>' +
    '<div class="sub">Наведи камеру нового устройства на код — откроется приложение, останется нажать одну кнопку. ' +
    'Ссылку можно и переслать, но открывать её надо в обычном браузере (Safari, Chrome), а не внутри мессенджера. ' +
    'Это как пароль: после подключения сообщение лучше удалить.</div>';
}

function vSync() {
  const c = getCfg() || {}, key = getKey();
  const owner = c.owner || DEFAULT_CFG.owner, repo = c.repo || DEFAULT_CFG.repo;
  const st = !ready()
    ? '<div class="infobox">Сейчас всё живёт только на этом телефоне. Подключи общую базу — и ' + esc(W.name(W.you)) +
      ' увидит общие круги, просьбы, обещания и планы.</div>'
    : sync.st === 'err' ? '<div class="alert"><b>!</b><div>' + esc(sync.msg) + '</div></div>'
    : '<div class="okbox">Подключено к ' + esc(owner + '/' + repo) + '. Последняя сверка: ' + esc(relTime(sync.pulledAt)) + '.' +
      (W.hasPartner ? ' Данные ' + esc(W.gen(W.you)) + ' получены.' : ' ' + esc(W.name(W.you)) + ' ещё не подключилась.') + '</div>';

  const setup = ready()
    ? '<div class="card sec"><h3>📲 Добавить устройство</h3><div class="sub">Телефон, планшет или компьютер: наводишь камеру на код — ' +
      'открывается приложение и подключается само, вводить ничего не надо.</div>' +
      '<div class="srow"><button class="k" data-a="mklink" data-v="partner">Для ' + esc(W.gen(W.you)) + '</button>' +
      '<button class="k" data-a="mklink" data-v="mine">Для моего устройства</button></div>' +
      linkBox() +
      '<div class="sub">Для ' + esc(W.gen(W.you)) + ' ключ личного не передаётся — у ' + W.say(W.you, 'него', 'неё') +
      ' будет свой. Для своих устройств ключ едет вместе с кодом, иначе личное там не откроется.</div></div>'
    : '';

  const keyBox = !cryptoOk
    ? '<div class="alert"><b>!</b><div>Браузер не даёт шифровать (страница открыта не по https). Личное не будет уходить в общую базу вовсе.</div></div>'
    : ready() ? '<div class="card sec"><h3>🔑 Ключ личного</h3><div class="sub">Всё с замком шифруется этим ключом перед отправкой. У ' +
      esc(W.gen(W.you)) + ' его нет, поэтому личное не прочитать даже через GitHub.</div>' +
      (key ? '<div class="code" id="keyshow" style="margin-top:.5rem">••••••••••••••••••••••••</div>' +
             '<div class="srow"><button data-a="keyshow">Показать</button><button data-a="keycopy">Скопировать</button></div>'
           : '<div class="srow"><button class="k" data-a="keynew">Создать ключ</button></div>') +
      (sync.needKey ? '<div class="alert"><b>!</b><div>В базе есть личное, зашифрованное другим ключом — обычно так бывает, ' +
        'если первый вход случайно сделали во встроенном браузере мессенджера. Возьми код «Для моего устройства» на том устройстве, ' +
        'где приложение уже работает, — он принесёт нужный ключ. Если там ничего ценного не было, начни личное заново.</div></div>' +
        '<div class="srow"><button class="w" data-a="keyreset">Начать личное заново</button></div>' : '') +
      '</div>' : '';

  return header('общая база', 'Синхронизация', back) + st + setup +
    '<div class="card sec"><h3>Подключение вручную</h3>' +
    '<div class="sub" style="margin-top:0">Нужно один раз на первом телефоне или на компьютере. Дальше — ссылкой.</div>' +
    '<ol class="steps"><li>Нажми «Создать токен» — откроется GitHub с уже заполненной формой. ' +
    'Там остаётся выбрать <b>Only select repositories → ' + esc(repo) + '</b> и нажать зелёную <b>Generate token</b>.</li>' +
    '<li>Скопируй показанный токен (его показывают один раз) и вставь сюда.</li></ol>' +
    '<div class="srow"><a href="' + TOKEN_URL + '" target="_blank" rel="noopener noreferrer">Создать токен на GitHub ↗</a></div>' +
    '<div class="fld"><label>Токен</label><input type="password" id="gtoken" value="' + esc(c.token || '') + '" placeholder="github_pat_…" autocomplete="off"></div>' +
    '<div class="srow"><button class="k" data-a="gsave">Подключить</button>' + (ready() ? '<button data-a="gnow">Сверить сейчас</button>' : '') + '</div>' +
    '<details style="margin-top:.6rem"><summary class="sub">Другой репозиторий</summary>' +
    '<div class="two"><div class="fld"><label>Владелец</label><input type="text" id="gowner" value="' + esc(owner) + '" autocapitalize="off"></div>' +
    '<div class="fld"><label>Репозиторий</label><input type="text" id="grepo" value="' + esc(repo) + '" autocapitalize="off"></div></div></details>' +
    (ready() ? '<div class="srow"><button class="w" data-a="goff">Отключить этот телефон</button></div>' : '') +
    '<div id="gmsg"></div></div>' + keyBox +
    '<div class="card sec"><h3>Что где лежит</h3><div class="sub">Приложение — публичный репозиторий <b>krugi</b>, там только код. ' +
    'Данные — приватный <b>' + esc(repo) + '</b>: ' + esc(DEFAULT_CFG.dir) + '/andrey.json и ' + esc(DEFAULT_CFG.dir) +
    '/diana.json. Каждый пишет только свой файл, поэтому два телефона не могут перетереть друг друга. ' +
    'Токен и ключ хранятся только в браузере телефона.</div></div>';
}

function vHelp() {
  const p = (t, d) => '<div class="card sec"><h3>' + t + '</h3><div class="sub">' + d + '</div></div>';
  return header('справка', 'Как пользоваться', back) +
    p('⭕ Круги', 'Круг — это папка дел («Дом», «Работа»), счётчик с целью (шаги, вода, «ответить на 5 задач по работе»), список покупок или настроение. Кольцо заполняется по мере закрытия. Счётчик может считать за день или за неделю — «три прогулки в неделю».') +
    p('🔒 Видимость', 'У каждого круга три режима: только я (шифруется, пара не видит вовсе), видно паре (видит кольцо и дела, но править не может), общий (оба добавляют и закрывают). Отдельное дело в видимом круге можно пометить личным.') +
    p('📅 День и серия', 'День закрыт, когда закрыто всё, что на него стоит. Полные дни подряд — серия. Пустые дни серию не рвут, но больше трёх пустых подряд — уже перерыв. День меняется в 04:00.') +
    p('🔒 Печать', 'Вечером составь план на завтра и запечатай: удалить дела запечатанного дня нельзя. Не вышло — честно «сдаться» (крестик) или закрыть круг страховкой.') +
    p('🤝 Обещания', 'Пообещай паре награду за цель: «закроешь „Шаги“ 5 дней до воскресенья — дарю кроссовки». Прогресс считается сам. Можно и наоборот — предложить: «если я… — подаришь…?». Наградой может быть карточка из «Покупок».') +
    p('🛍 Покупки', 'Карточки со ссылкой, фото, ценой, магазином, для кого и к какому поводу. Доски: по дому, подарки, хочу, крупное и свои. Подарок-сюрприз шифруется и паре не виден. «Я подарю» на хотелке пары видишь только ты.') +
    p('📍 Планы', 'Прогулки, свидания, поездки с датой, временем и местом. Пара отвечает «иду / может / не смогу». Состоявшийся план даёт опыт.') +
    p('🏅 Опыт и значки', 'Каждое закрытое дело, цель и полный день дают опыт, опыт — уровни. Двадцать значков за серии, шаги, воду, прогулки вдвоём и выполненные обещания.') +
    p('📱 На телефон', 'Android (Chrome): меню ⋮ → «Добавить на главный экран». iPhone (Safari): «Поделиться» → «На экран Домой». Работает и без сети — сверится, когда сеть появится.');
}
