/* Проверка своего генератора QR: независимый декодер читает матрицу обратно.
   Декодер написан отдельно от кодировщика: заново строит карту служебных
   модулей, сам читает формат, сам снимает маску, сам проверяет синдромы
   Рида — Соломона. Совпал текст — значит кодировщик кладёт всё по местам. */
import { qrMatrix, qrSvg } from '../js/qr.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TABLE_L = {
  1: [19, 7, 1, 19, 0, 0], 2: [34, 10, 1, 34, 0, 0], 3: [55, 15, 1, 55, 0, 0],
  4: [80, 20, 1, 80, 0, 0], 5: [108, 26, 1, 108, 0, 0], 6: [136, 18, 2, 68, 0, 0],
  7: [156, 20, 2, 78, 0, 0], 8: [194, 24, 2, 97, 0, 0], 9: [232, 30, 2, 116, 0, 0],
  10: [274, 18, 2, 68, 2, 69], 11: [324, 20, 4, 81, 0, 0], 12: [370, 24, 2, 92, 2, 93],
  13: [428, 26, 4, 107, 0, 0], 14: [461, 30, 3, 115, 1, 116], 15: [523, 22, 5, 87, 1, 88],
  16: [589, 24, 5, 98, 1, 99], 17: [647, 28, 1, 107, 5, 108], 18: [721, 30, 5, 120, 1, 121],
  19: [795, 28, 3, 113, 4, 114], 20: [861, 28, 3, 107, 5, 108],
};
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34], 7: [6, 22, 38],
  8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50], 11: [6, 30, 54], 12: [6, 32, 58],
  13: [6, 34, 62], 14: [6, 26, 46, 66], 15: [6, 26, 48, 70], 16: [6, 26, 50, 74],
  17: [6, 30, 54, 78], 18: [6, 30, 56, 82], 19: [6, 30, 58, 86], 20: [6, 34, 62, 90],
};
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0, (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];
// поле Галуа заново
const E = new Uint8Array(512), L = new Uint8Array(256);
{ let x = 1; for (let i = 0; i < 255; i++) { E[i] = x; L[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; } for (let i = 255; i < 512; i++) E[i] = E[i - 255]; }
const mul = (a, b) => (a && b) ? E[L[a] + L[b]] : 0;

function fixedMap(v) {
  const size = 17 + 4 * v, F = Array.from({ length: size }, () => new Uint8Array(size));
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) F[y][x] = 1; };
  for (const [x0, y0] of [[0, 0], [size - 7, 0], [0, size - 7]])
    for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) mark(x0 + dx, y0 + dy);
  for (let i = 0; i < size; i++) { mark(i, 6); mark(6, i); }
  const a = ALIGN[v];
  for (const cy of a) for (const cx of a) {
    if ((cx < 9 && cy < 9) || (cx > size - 10 && cy < 9) || (cx < 9 && cy > size - 10)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(cx + dx, cy + dy);
  }
  for (let i = 0; i <= 8; i++) { mark(i, 8); mark(8, i); }
  for (let i = 0; i < 8; i++) { mark(size - 1 - i, 8); mark(8, size - 1 - i); }
  if (v >= 7) for (let i = 0; i < 18; i++) { const a1 = Math.floor(i / 3), b1 = i % 3; mark(a1, size - 11 + b1); mark(size - 11 + b1, a1); }
  return F;
}
function readFormat(m) {
  const size = m.length;
  let bits = 0;
  for (let i = 0; i <= 5; i++) bits |= m[i][8] << i;
  bits |= m[7][8] << 6; bits |= m[8][8] << 7; bits |= m[8][7] << 8;
  for (let i = 9; i <= 14; i++) bits |= m[8][14 - i] << i;
  const raw = bits ^ 0x5412;
  // проверка BCH: остаток должен быть нулевым
  let d = raw, glen = 11;
  while (d.toString(2).length >= glen) d ^= 0x537 << (d.toString(2).length - glen);
  return { ec: (raw >> 13) & 3, mask: (raw >> 10) & 7, ok: d === 0 };
}
function decode(m) {
  const size = m.length, v = (size - 17) / 4;
  const F = fixedMap(v), fmt = readFormat(m);
  if (!fmt.ok) throw new Error('формат не сошёлся по BCH');
  if (fmt.ec !== 1) throw new Error('не уровень L: ' + fmt.ec);
  const f = MASKS[fmt.mask];
  const bits = [];
  let up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let n = 0; n < size; n++) {
      const row = up ? size - 1 - n : n;
      for (const c of [col, col - 1]) {
        if (F[row][c]) continue;
        bits.push(m[row][c] ^ (f(row, c) ? 1 : 0));
      }
    }
    up = !up;
  }
  const words = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) words.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  const [total, ecPer, g1, d1, g2, d2] = TABLE_L[v];
  const nb = g1 + g2, lens = [];
  for (let i = 0; i < g1; i++) lens.push(d1);
  for (let i = 0; i < g2; i++) lens.push(d2);
  const blocks = lens.map(() => []), ecs = Array.from({ length: nb }, () => []);
  let at = 0;
  for (let i = 0; i < Math.max(d1, d2); i++) for (let b = 0; b < nb; b++) if (i < lens[b]) blocks[b].push(words[at++]);
  for (let i = 0; i < ecPer; i++) for (let b = 0; b < nb; b++) ecs[b].push(words[at++]);
  // синдромы: для верного кодового слова все нули
  for (let b = 0; b < nb; b++) {
    const code = blocks[b].concat(ecs[b]);
    for (let s = 0; s < ecPer; s++) {
      let acc = 0;
      for (const c of code) acc = mul(acc, E[s]) ^ c;
      if (acc !== 0) throw new Error('блок ' + b + ': синдром ' + s + ' не ноль');
    }
  }
  // данные
  const flat = [].concat(...blocks), db = [];
  for (const w of flat) for (let i = 7; i >= 0; i--) db.push((w >> i) & 1);
  const take = n => { let x = 0; for (let i = 0; i < n; i++) x = (x << 1) | db.shift(); return x; };
  const mode = take(4);
  if (mode !== 4) throw new Error('не байтовый режим: ' + mode);
  const len = take(v < 10 ? 8 : 16), out = [];
  for (let i = 0; i < len; i++) out.push(take(8));
  return { version: v, mask: fmt.mask, text: new TextDecoder().decode(Uint8Array.from(out)) };
}

const cases = [
  'HELLO',
  'https://andrewbabenko901-hub.github.io/krugi/',
  'https://andrewbabenko901-hub.github.io/krugi/#n=eyJvIjoiYW5kcmV3YmFiZW5rbzkwMS1odWIiLCJyIjoia3J1Z2ktZGF0YSIsImQiOiJkYXRhIiwidCI6ImdpdGh1Yl9wYXRfMTFBQUFBQUFBMHh4eHh4eHh4eHh4X3l5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eXl5eSIsInciOiJkaWFuYSJ9',
  'https://andrewbabenko901-hub.github.io/krugi/#n=' + 'A'.repeat(300),
  'Круги — ежедневка на двоих, проверка кириллицы',
];
let bad = 0;
for (const t of cases) {
  try {
    const m = qrMatrix(t), r = decode(m);
    const ok = r.text === t;
    if (!ok) bad++;
    console.log((ok ? 'OK  ' : 'FAIL') + ' v' + String(r.version).padStart(2) + ' маска ' + r.mask +
      ' · ' + m.length + '×' + m.length + ' · ' + t.length + ' симв.');
  } catch (e) { bad++; console.log('FAIL ' + t.slice(0, 40) + ' → ' + e.message); }
}
// картинка для глазной проверки
// картинку на посмотреть кладём во временную папку, а не в репозиторий
fs.writeFileSync(path.join(os.tmpdir(), 'krugi-qr.svg'), qrSvg(cases[2]), 'utf8');
console.log(bad ? 'ПРОВАЛОВ: ' + bad : 'все проверки пройдены');
