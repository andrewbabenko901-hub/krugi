/* План: дела на день, совместные планы и просьбы паре. */
import { esc, pln, DN, human, parse, addK, money, inDays } from './util.js';
import { W, nav } from './ctx.js';
import { pick, BIN_ICON } from './ui.js';
import { whoTag, eventRow, EVENT_KINDS, header, circleLabel } from './parts.js';

/* Черновики форм живут между перерисовками: пишешь, жмёшь чип — текст на месте. */
export const F = { n: '', c: null, w: null, q: '', pr: '', st: '', prv: 0, days: [0, 0, 0, 0, 0, 0, 0] };
export const E = { t: '', kind: 'walk', time: '', place: '', with: 'us', note: '', vis: 'pair', date: '' };
export const Q = { n: '', note: '', kind: 'task' };
export function bind(path, v) {
  const [o, k] = path.split('.');
  ({ F, E, Q })[o][k] = v;
}

export const BUILTIN_TPL = [
  { id: 'b-work', n: 'рабочий', items: ['Разобрать почту', 'Два часа без переписки', 'Собрать сумку на завтра'] },
  { id: 'b-off', n: 'выходной', items: ['Уборка', 'Позвонить родителям', 'Большая закупка', 'Прогулка'] },
  { id: 'b-sick', n: 'болею', items: ['Отлежаться', 'Лекарства по часам', 'Только посуда'] },
];

export const planDate = () => nav.plan.date || addK(W.today, 1);
export const listCircles = () => W.myCircles.filter(c => c.k === 'list' || c.k === 'shop');

export function vPlan() {
  const tk = planDate(), sealed = W.sealed(tk), mode = nav.plan.mode;
  const opts = [[W.today, 'сегодня'], [addK(W.today, 1), 'завтра'], [addK(W.today, 2), human(parse(addK(W.today, 2)))], [addK(W.today, 3), human(parse(addK(W.today, 3)))]];
  const dates = '<div class="pick" style="margin-top:.8rem">' + opts.map(([k, l]) =>
    '<button class="pb" data-a="pdate" data-v="' + k + '" aria-pressed="' + (tk === k) + '">' + esc(l) + '</button>').join('') +
    '<input type="date" class="pb" data-a="pdatein" value="' + tk + '" style="padding:.3rem .5rem" aria-label="Другая дата"></div>';
  const seg = '<div class="seg">' + [['task', 'Дело'], ['event', 'План вместе'], ['req', 'Попросить ' + W.acc(W.you)]].map(([v, l]) =>
    '<button data-a="pmode" data-v="' + v + '" aria-pressed="' + (mode === v) + '">' + esc(l) + '</button>').join('') + '</div>';

  const tasks = W.tasksOn(tk).filter(t => { const c = W.circleById[t.c]; return c && !c._ro; });
  const evs = W.events.filter(e => e.date === tk && (e._mine || e.with === 'us'));
  const list = (tasks.length ? '<ul>' + tasks.map(t => {
    const c = W.circleById[t.c];
    return '<li class="t"><span style="font-size:1rem">' + esc(c ? c.i : '•') + '</span><span class="nm2"><span class="ttl">' + esc(t.n) + '</span><span class="mini">' +
      (c && c._shared ? whoTag(W.doerOf(t)) : '') + '<span class="tagi">' + esc(c ? c.n : '') + '</span>' + (t.q ? '<span class="tagi">' + esc(t.q) + '</span>' : '') +
      (t.pr ? '<span class="tagi">' + esc(money(t.pr)) + '</span>' : '') + (t.prv || (c && c.vis === 'prv') ? '<span class="tagi prv">🔒</span>' : '') +
      (t.r ? '<span class="tagi">каждую неделю</span>' : '<span class="tagi">разово</span>') + '</span></span>' +
      '<button class="del" data-a="edit" data-id="' + esc(t.id) + '" aria-label="Изменить">✎</button>' +
      (sealed && !t.r ? '<span class="del" style="opacity:.3">🔒</span>' : '<button class="del" data-a="pdel" data-id="' + esc(t.id) + '" aria-label="Удалить">' + BIN_ICON + '</button>') + '</li>';
  }).join('') + '</ul>' : '<div class="card"><div class="sub" style="margin-top:0">На этот день дел нет. Регулярные подтянутся сами.</div></div>') +
    (evs.length ? '<div class="sec"><h3>Планы на этот день</h3>' + evs.map(e => eventRow(e, { rsvp: true })).join('') + '</div>' : '') +
    (sealed ? '<div class="locked-box"><span>🔒</span><div><b>Запечатано</b><div class="sub" style="margin-top:.1rem">Удалить нельзя, добавить можно. Не вышло — «сдаться» или страховка.</div></div></div>'
      : tasks.length ? '<button class="big-btn" data-a="seal" data-v="' + tk + '">Запечатать ' + pln(tasks.length, ['дело', 'дела', 'дел']) + '</button>' +
        '<div class="sub">Запечатанный план нельзя сократить задним числом. Это и есть обещание самому себе.</div>' : '');

  let form = '';
  if (mode === 'task') {
    const lc = listCircles();
    if (!lc.length) form = '<div class="card sec"><h3>Сначала нужен круг</h3><div class="sub">Дела живут внутри кругов — «Дом», «Работа», «Личное».</div><button class="big-btn" data-a="cnew">Создать круг</button></div>';
    else {
      if (!F.c || !lc.some(c => c.id === F.c)) F.c = lc[0].id;
      const c0 = W.circleById[F.c];
      if (!F.w) F.w = W.me;
      form = '<div class="card sec"><h3>Новое дело</h3>' +
        '<div class="fld"><label>Что сделать</label><input type="text" id="fn" data-bind="F.n" value="' + esc(F.n) + '" placeholder="Забрать бельё из химчистки"></div>' +
        '<div class="fld"><label>Круг</label>' + pick('fc', F.c, lc.map(c => [c.id, circleLabel(c)])) + '</div>' +
        (c0 && c0._shared ? '<div class="fld"><label>Кто делает</label>' + pick('fw', F.w, [[W.me, 'я'], [W.you, W.name(W.you)], ['both', 'оба']]) + '</div>' : '') +
        (c0 && c0.vis !== 'prv' ? '<div class="fld"><label>Видимость</label>' + pick('fprv', F.prv, [[0, 'как у круга'], [1, '🔒 только я']]) + '</div>' : '') +
        '<div class="fld"><label>Повтор по дням (пусто — разово)</label><div class="days">' + DN.map((d, i) =>
          '<button class="db2" data-a="fd" data-v="' + i + '" aria-pressed="' + !!F.days[i] + '">' + d + '</button>').join('') + '</div></div>' +
        (c0 && c0.k === 'shop'
          ? '<div class="two"><div class="fld"><label>Количество</label><input type="text" id="fq" data-bind="F.q" value="' + esc(F.q) + '" placeholder="2 шт"></div>' +
            '<div class="fld"><label>Цена, ₴</label><input type="number" id="fpr" data-bind="F.pr" value="' + esc(F.pr) + '" inputmode="decimal"></div></div>' +
            '<div class="fld"><label>Магазин</label><input type="text" id="fst" data-bind="F.st" value="' + esc(F.st) + '" placeholder="Сільпо"></div>'
          : '<div class="fld"><label>Уточнение</label><input type="text" id="fq" data-bind="F.q" value="' + esc(F.q) + '" placeholder="до 19:00"></div>') +
        '<button class="big-btn" data-a="fadd">Добавить на ' + esc(inDays(tk)) + '</button></div>';
    }
  } else if (mode === 'event') {
    form = '<div class="card sec"><h3>План</h3><div class="sub" style="margin-top:0">Прогулка, свидание, поездка, спорт — с датой, временем и местом. ' +
      esc(W.name(W.you)) + ' увидит приглашение и ответит «иду / может / не смогу».</div>' +
      '<div class="fld"><label>Что</label><input type="text" id="et" data-bind="E.t" value="' + esc(E.t) + '" placeholder="Прогулка по набережной"></div>' +
      '<div class="fld"><label>Какой</label>' + pick('ekind', E.kind, EVENT_KINDS.map(k => [k[0], k[1] + ' ' + k[2]])) + '</div>' +
      '<div class="two"><div class="fld"><label>Время</label><input type="time" id="etime" data-bind="E.time" value="' + esc(E.time) + '"></div>' +
      '<div class="fld"><label>Где</label><input type="text" id="eplace" data-bind="E.place" value="' + esc(E.place) + '" placeholder="Парк Шевченко"></div></div>' +
      '<div class="fld"><label>С кем</label>' + pick('ewith', E.with, [['us', 'вместе'], ['me', 'только я']]) + '</div>' +
      (E.with === 'me' ? '<div class="fld"><label>Видимость</label>' + pick('evis', E.vis, [['pair', '👀 видно паре'], ['prv', '🔒 только я']]) + '</div>' : '') +
      '<div class="fld"><label>Заметка</label><input type="text" id="enote" data-bind="E.note" value="' + esc(E.note) + '" placeholder="взять плед"></div>' +
      '<button class="big-btn" data-a="eadd">Запланировать на ' + esc(inDays(tk)) + '</button></div>';
  } else {
    const sent = W.requests.filter(r => r.own === W.me).sort((a, b) => (b.cr || 0) - (a.cr || 0)).slice(0, 6);
    form = '<div class="card sec"><h3>Попросить ' + esc(W.acc(W.you)) + '</h3><div class="sub" style="margin-top:0">Просьба не встаёт в чужой список молча: ' +
      esc(W.name(W.you)) + ' ' + W.say(W.you, 'сам', 'сама') + ' решит, брать ли, в какой круг положить и на какой день.</div>' +
      '<div class="fld"><label>Что это</label>' + pick('qkind', Q.kind, [['task', '📋 дело'], ['buy', '🛒 купить']]) + '</div>' +
      '<div class="fld"><label>' + (Q.kind === 'buy' ? 'Что купить' : 'О чём просишь') + '</label><input type="text" id="qn" data-bind="Q.n" value="' + esc(Q.n) +
      '" placeholder="' + (Q.kind === 'buy' ? 'Молоко, 2 штуки' : 'Забрать посылку с почты') + '"></div>' +
      '<div class="fld"><label>Уточнение</label><input type="text" id="qnote" data-bind="Q.note" value="' + esc(Q.note) + '" placeholder="номер 2045, до 18:00"></div>' +
      '<button class="big-btn" data-a="qadd">' + (Q.kind === 'buy' ? 'Попросить купить' : 'Отправить просьбу') + ' на ' + esc(inDays(tk)) + '</button>' +
      '<div class="sub">Придёт уведомлением. ' + esc(W.name(W.you)) + ' нажмёт «Взять» и выберет, в какой круг это положить' +
      (Q.kind === 'buy' ? ' — покупки предложатся сами' : '') + '.</div>' +
      (sent.length ? '<div class="sec"><h3>Отправленные</h3>' + sent.map(r => {
        const a = W.answersYou[r.id];
        return '<div class="shoprow"><span class="nm2">' + esc(r.n) + '<span class="mini"><span class="tagi' + (a ? (a.s === 'acc' ? ' g' : ' w') : '') + '">' +
          (a ? (a.s === 'acc' ? (a.done ? 'сделано ✓' : 'принято') : 'отказ') : 'ждёт ответа') + '</span>' + (r.d ? '<span class="tagi">' + esc(inDays(r.d)) + '</span>' : '') + '</span></span>' +
          (!a ? '<button class="del" data-a="qdel" data-id="' + esc(r.id) + '" aria-label="Отозвать">' + BIN_ICON + '</button>' : '') + '</div>';
      }).join('') + '</div>' : '') + '</div>';
  }

  const tpls = BUILTIN_TPL.concat(W.tpls.filter(t => t._mine));
  const side = '<div class="card sec"><h3>Шаблоны дня</h3><div class="sub">Набор дел одним нажатием — в выбранный круг на ' + esc(inDays(tk)) + '.</div>' +
    '<div class="pick">' + tpls.map(t => '<button class="pb" data-a="tmpl" data-id="' + esc(t.id) + '">' + esc(t.n) + '</button>').join('') + '</div>' +
    (tasks.some(t => !t.r && t.own === W.me) ? '<div class="srow"><button data-a="tplsave">Сохранить этот день как шаблон</button></div>' : '') + '</div>';

  return header(human(parse(tk)), 'Планирование', sealed ? '<span class="ghost">🔒 запечатан</span>' : '') + dates + seg +
    (nav.wide ? '<div class="two-col"><div class="sec">' + list + '</div><div class="side">' + form + side + '</div></div>'
              : form + '<div class="sec">' + list + '</div>' + side);
}
