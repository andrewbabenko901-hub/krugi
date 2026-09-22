/* Текущий «мир» и навигация — общие для всех экранов. */
import { S, P } from './store.js';
import { buildWorld } from './model.js';
import { todayKey } from './util.js';

export const nav = {
  tab: 'today',          // today | week | plan | pair | wish | more
  VD: todayKey(),        // просматриваемый день на главном
  WOFF: 0,               // сдвиг недели
  more: 'menu',          // menu | stat | badges | set | sync | help
  plan: { date: null, mode: 'task' },
  pledgeTab: 'me',
  mail: 'in',            // переписка: in — входящие, out — отправленные, feed — лента
  link: null,            // какой код привязки показан: 'partner' | 'mine'
  wide: false,
  edit: false,           // правка главного экрана: виджеты можно таскать
};

export let W = null;
export function rebuild() { W = buildWorld(S, P); return W; }
