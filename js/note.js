/* ============================================================
   Полоска сверху: что пришло от пары прямо сейчас.

   Приложение открыто — человек не должен искать новое во «Входящих»:
   просьба, напоминание, поддержка или приглашение всплывают полоской
   поверх любого экрана, с одной кнопкой по делу.

   Ничего своего она не хранит: берёт те же входящие и ленту, что и
   остальные экраны, и показывает самое свежее из непросмотренного.
   ============================================================ */
import { S, saveLocal } from './store.js';
import { W } from './ctx.js';
import { inbox, feed } from './model.js';
import { esc } from './util.js';

export let cur = null;                       // что сейчас на полоске
const KINDS = ['kudos', 'poke', 'pledge', 'ans', 'wish', 'event', 'thanks'];

/** Найти самое свежее непросмотренное. Возвращает описание полоски или null. */
export function compute() {
  cur = null;
  if (!S || !W || !W.hasPartner) return null;
  const seen = S.seen.note || 0;
  const take = (at, o) => { if (at > seen && (!cur || at > cur.at)) cur = { at, ...o }; };

  for (const x of inbox(W)) {
    const at = x.x.cr || x.x.upd || 0, nm = W.name(x.x.own);
    if (x.kind === 'req') take(at, {
      e: x.x.kind === 'buy' ? '🛒' : '📨',
      t: nm + (x.x.kind === 'buy' ? ' просит купить' : ' просит') + ': ' + x.x.n,
      btn: 'Взять', a: 'reqacc', id: x.x.id,
    });
    else if (x.kind === 'prop') take(at, { e: '🤝', t: nm + ' предлагает обещание', btn: 'Открыть', a: 'tab', v: 'pair' });
    else take(at, { e: '📍', t: nm + ' зовёт: ' + x.x.t, btn: 'Открыть', a: 'tab', v: 'pair' });
  }
  for (const f of feed(W)) if (KINDS.includes(f.kind)) take(f.at || 0, { e: f.e, t: f.t, btn: 'Открыть', a: 'tab', v: 'pair' });
  return cur;
}

export function html() {
  if (!cur) return '';
  return '<div class="nrow">' +
    '<span class="ne">' + esc(cur.e) + '</span>' +
    '<span class="nt">' + esc(cur.t) + '</span>' +
    '<button class="nb2" data-a="notego">' + esc(cur.btn) + '</button>' +
    '<button class="nx" data-a="notex" aria-label="Убрать">✕</button></div>';
}

/** Больше не показывать то, что сейчас на полоске. */
export function markSeen() {
  if (!cur) return;
  S.seen.note = Math.max(S.seen.note || 0, cur.at);
  cur = null;
  saveLocal();
}
/** Всё входящее считается просмотренным (человек сам открыл «Вместе»). */
export function markAll() {
  compute();
  if (cur) { S.seen.note = cur.at; cur = null; saveLocal(); }
}
