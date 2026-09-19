/* Мелочи: даты, числа, склонения, экранирование. */

export const DN = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
export const DNL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
export const MN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа',
                   'сентября', 'октября', 'ноября', 'декабря'];
export const MNS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export const now = () => Date.now();
export const uid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
export const clone = o => JSON.parse(JSON.stringify(o));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- даты: ключ дня «ГГГГ-ММ-ДД» ---------- */
export function key(d) {
  const m = d.getMonth() + 1, x = d.getDate();
  return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (x < 10 ? '0' : '') + x;
}
export function parse(k) { const p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
export const di = d => (d.getDay() + 6) % 7;               // 0 = понедельник
export function addD(d, n) { const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
export const addK = (k, n) => key(addD(parse(k), n));
export const wkStart = d => addD(d, -di(d));
export const wkStartK = k => key(wkStart(parse(k)));
export function human(d) { return DN[di(d)] + ', ' + d.getDate() + ' ' + MN[d.getMonth()]; }
export const humanK = k => human(parse(k));
export function shortK(k) { const d = parse(k); return d.getDate() + ' ' + MNS[d.getMonth()]; }

/* День переключается в 04:00: дело, закрытое в час ночи, относится ко вчера. */
export function todayDate() {
  const d = new Date(Date.now() - 4 * 3600e3);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export const todayKey = () => key(todayDate());
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

/** Все ключи дней от a до b включительно. */
export function range(a, b) {
  const out = []; let d = parse(a); const end = parse(b);
  while (d <= end) { out.push(key(d)); d = addD(d, 1); }
  return out;
}

/** Ближайшая дата «ММ-ДД» (день рождения) начиная с сегодня. */
export function nextOccurrence(mmdd, from = todayKey()) {
  if (!mmdd) return null;
  const [m, d] = mmdd.split('-').map(Number);
  const f = parse(from);
  let x = new Date(f.getFullYear(), m - 1, d);
  if (x < f) x = new Date(f.getFullYear() + 1, m - 1, d);
  return key(x);
}

/* ---------- числа и слова ---------- */
export function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
export function pl(n, f) {
  n = Math.abs(n); const a = n % 10, b = n % 100;
  return (a === 1 && b !== 11) ? f[0] : (a >= 2 && a <= 4 && (b < 10 || b > 20)) ? f[1] : f[2];
}
export const pln = (n, f) => n + ' ' + pl(n, f);

export function relTime(ts) {
  if (!ts) return 'никогда';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 45) return 'только что';
  if (s < 3600) return pln(Math.round(s / 60), ['минуту', 'минуты', 'минут']) + ' назад';
  if (s < 86400) return pln(Math.round(s / 3600), ['час', 'часа', 'часов']) + ' назад';
  const d = Math.round(s / 86400);
  return d === 1 ? 'вчера' : pln(d, ['день', 'дня', 'дней']) + ' назад';
}

export function inDays(k, from = todayKey()) {
  const n = daysBetween(from, k);
  return n === 0 ? 'сегодня' : n === 1 ? 'завтра' : n === -1 ? 'вчера'
       : n > 0 ? 'через ' + pln(n, ['день', 'дня', 'дней']) : pln(-n, ['день', 'дня', 'дней']) + ' назад';
}

/* ---------- безопасность ----------
   Текст приходит и от пары: всё, что пишет человек, выводится только через esc.
   Ссылки — только http(s): иначе чужая карточка покупки могла бы выполнить код. */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);
export function safeUrl(u) {
  if (!u) return '';
  try { const x = new URL(String(u).trim()); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : ''; }
  catch { return ''; }
}
export function domainOf(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }

export function money(n, cur = '₴') { return n ? fmt(n) + ' ' + cur : ''; }

/* Падежи имени: «от Дианы», «Диане», «попросить Диану»; «Андрея», «Андрею».
   Женские имена на согласную и несклоняемые (на -о, -е, -и) не трогаем. */
export function declName(name, g, cs) {
  const n = String(name || '').trim(); if (!n || cs === 'nom') return n;
  const last = n.slice(-1).toLowerCase(), pre = n.slice(0, -1), hush = /[гкхжчшщ]$/i.test(pre);
  if (last === 'а') return pre + { gen: hush ? 'и' : 'ы', dat: 'е', acc: 'у' }[cs];
  if (last === 'я') return pre + (/ия$/i.test(n) ? { gen: 'и', dat: 'и', acc: 'ю' } : { gen: 'и', dat: 'е', acc: 'ю' })[cs];
  if (g === 'f') return n;
  if (last === 'й' || last === 'ь') return pre + { gen: 'я', dat: 'ю', acc: 'я' }[cs];
  if (/[бвгджзклмнпрстфхцчшщ]/.test(last)) return n + { gen: 'а', dat: 'у', acc: 'а' }[cs];
  return n;
}
