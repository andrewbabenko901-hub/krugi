/* ============================================================
   QR-код: свой генератор, без библиотек и без сети.

   Нужен ровно для одного: привязать новое устройство (планшет,
   компьютер, второй телефон) — навёл камеру, открылась ссылка,
   одно нажатие. Ссылка длинная, поэтому режим байтовый, уровень
   коррекции L (данных больше всего), версия подбирается по длине.

   Таблицы блоков и координат выравнивающих узоров — из стандарта
   ISO/IEC 18004; всё остальное считается здесь.
   ============================================================ */

/* версия: [всего кодовых слов данных, EC на блок, блоков в группе 1,
   данных в блоке группы 1, блоков в группе 2, данных в блоке группы 2] */
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

/* ---------- поле Галуа GF(256), примитивный многочлен 0x11D ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function () {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11D; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;

function genPoly(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const ng = new Array(g.length + 1).fill(0);
    // (…)·(x + α^i): сдвиг на разряд вверх и умножение на α^i разрядом ниже
    for (let j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= mul(g[j], EXP[i]); }
    g = ng;
  }
  return g;
}
/** Контрольные слова Рида — Соломона для блока данных. */
export function ecBytes(data, n) {
  const g = genPoly(n), res = new Uint8Array(data.length + n);
  res.set(data);
  for (let i = 0; i < data.length; i++) {
    const c = res[i]; if (!c) continue;
    for (let j = 0; j < g.length; j++) res[i + j] ^= mul(g[j], c);
  }
  return res.slice(data.length);
}

/* ---------- служебные последовательности ---------- */
function bch(data, gen, bits) {              // остаток от деления, как в стандарте
  let d = data << bits;
  const glen = gen.toString(2).length;
  while (d.toString(2).length >= glen) d ^= gen << (d.toString(2).length - glen);
  return d;
}
export const formatBits = (ec, mask) => (((ec << 3 | mask) << 10) | bch(ec << 3 | mask, 0x537, 10)) ^ 0x5412;
export const versionBits = v => (v << 12) | bch(v, 0x1F25, 12);

/* ---------- сборка ---------- */
function newMatrix(size) {
  const m = [], fixed = [];
  for (let i = 0; i < size; i++) { m.push(new Int8Array(size).fill(-1)); fixed.push(new Uint8Array(size)); }
  return { m, fixed, size };
}
function put(M, x, y, v, fix) { if (x < 0 || y < 0 || x >= M.size || y >= M.size) return; M.m[y][x] = v ? 1 : 0; if (fix) M.fixed[y][x] = 1; }

function finder(M, x0, y0) {
  for (let dy = -1; dy <= 7; dy++) for (let dx = -1; dx <= 7; dx++) {
    const x = x0 + dx, y = y0 + dy;
    if (x < 0 || y < 0 || x >= M.size || y >= M.size) continue;
    const inRing = (dx >= 0 && dx <= 6 && (dy === 0 || dy === 6)) || (dy >= 0 && dy <= 6 && (dx === 0 || dx === 6));
    const inCore = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
    put(M, x, y, inRing || inCore, true);
  }
}
function alignment(M, cx, cy) {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
    put(M, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1, true);
}

function skeleton(v) {
  const size = 17 + 4 * v, M = newMatrix(size);
  finder(M, 0, 0); finder(M, size - 7, 0); finder(M, 0, size - 7);
  for (let i = 8; i < size - 8; i++) { put(M, i, 6, i % 2 === 0, true); put(M, 6, i, i % 2 === 0, true); }
  const a = ALIGN[v];
  for (const cy of a) for (const cx of a) {
    if ((cx < 9 && cy < 9) || (cx > size - 10 && cy < 9) || (cx < 9 && cy > size - 10)) continue;
    alignment(M, cx, cy);
  }
  put(M, 8, size - 8, 1, true);                          // тёмный модуль
  for (let i = 0; i <= 8; i++) {                          // место под формат
    if (i !== 6) { put(M, i, 8, 0, true); put(M, 8, i, 0, true); }
  }
  for (let i = 0; i < 8; i++) { put(M, size - 1 - i, 8, 0, true); put(M, 8, size - 1 - i, 0, true); }
  if (v >= 7) for (let i = 0; i < 18; i++) {              // место под версию
    const a1 = Math.floor(i / 3), b1 = i % 3;
    put(M, a1, size - 11 + b1, 0, true); put(M, size - 11 + b1, a1, 0, true);
  }
  return M;
}

function placeData(M, bits) {
  const size = M.size; let i = 0, up = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let n = 0; n < size; n++) {
      const row = up ? size - 1 - n : n;
      for (const c of [col, col - 1]) {
        if (M.fixed[row][c]) continue;
        M.m[row][c] = i < bits.length ? bits[i] : 0;
        i++;
      }
    }
    up = !up;
  }
}
const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
  (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
  (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
];
function applyMask(M, k) {
  const f = MASKS[k], out = { size: M.size, m: M.m.map(r => Int8Array.from(r)), fixed: M.fixed };
  for (let r = 0; r < M.size; r++) for (let c = 0; c < M.size; c++)
    if (!M.fixed[r][c] && f(r, c)) out.m[r][c] ^= 1;
  return out;
}
function penalty(M) {
  const n = M.size, m = M.m; let p = 0;
  const run = line => {
    let s = 0, prev = -1;
    for (let i = 0; i < n; i++) {
      if (line[i] === prev) { s++; if (s === 5) p += 3; else if (s > 5) p += 1; }
      else { prev = line[i]; s = 1; }
    }
  };
  for (let r = 0; r < n; r++) run(m[r]);
  for (let c = 0; c < n; c++) run(m.map(r => r[c]));
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++)
    if (m[r][c] === m[r][c + 1] && m[r][c] === m[r + 1][c] && m[r][c] === m[r + 1][c + 1]) p += 3;
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const scan = line => {
    for (let i = 0; i + 11 <= n; i++) {
      let a = true, b = true;
      for (let j = 0; j < 11; j++) { if (line[i + j] !== pat[j]) a = false; if (line[i + j] !== pat2[j]) b = false; }
      if (a) p += 40; if (b) p += 40;
    }
  };
  for (let r = 0; r < n; r++) scan(m[r]);
  for (let c = 0; c < n; c++) scan(m.map(r => r[c]));
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += m[r][c];
  p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
  return p;
}
function writeFormat(M, mask) {
  const bits = formatBits(1, mask), size = M.size;          // 1 = уровень L
  const bit = i => (bits >> i) & 1;
  // первая копия: вокруг левого верхнего узора
  for (let i = 0; i <= 5; i++) put(M, 8, i, bit(i), true);
  put(M, 8, 7, bit(6), true); put(M, 8, 8, bit(7), true); put(M, 7, 8, bit(8), true);
  for (let i = 9; i <= 14; i++) put(M, 14 - i, 8, bit(i), true);
  // вторая копия: справа сверху и слева снизу
  for (let i = 0; i <= 7; i++) put(M, size - 1 - i, 8, bit(i), true);
  for (let i = 8; i <= 14; i++) put(M, 8, size - 15 + i, bit(i), true);
  put(M, 8, size - 8, 1, true);                             // тёмный модуль
}
function writeVersion(M, v) {
  if (v < 7) return;
  const bits = versionBits(v), size = M.size;
  for (let i = 0; i < 18; i++) {
    const b = (bits >> i) & 1, a = Math.floor(i / 3), c = i % 3;
    put(M, a, size - 11 + c, b, true); put(M, size - 11 + c, a, b, true);
  }
}

/** Матрица QR для строки: [[0|1,…],…]. Уровень коррекции L. */
export function qrMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  let v = 0;
  for (let i = 1; i <= 20; i++) {
    const cci = i < 10 ? 8 : 16, need = Math.ceil((4 + cci + bytes.length * 8) / 8);
    if (need <= TABLE_L[i][0]) { v = i; break; }
  }
  if (!v) throw new Error('слишком длинная строка для QR');
  const [total, ecPer, g1, d1, g2, d2] = TABLE_L[v];
  const cci = v < 10 ? 8 : 16;

  // поток бит -> кодовые слова данных
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4); push(bytes.length, cci);
  for (const b of bytes) push(b, 8);
  for (let i = 0; i < 4 && bits.length < total * 8; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  const PAD = [0xEC, 0x11];
  while (data.length < total) data.push(PAD[(data.length - bits.length / 8) % 2]);

  // блоки и коррекция
  const blocks = [], ecs = [];
  let at = 0;
  for (let i = 0; i < g1; i++) { const b = data.slice(at, at + d1); at += d1; blocks.push(b); ecs.push(ecBytes(b, ecPer)); }
  for (let i = 0; i < g2; i++) { const b = data.slice(at, at + d2); at += d2; blocks.push(b); ecs.push(ecBytes(b, ecPer)); }

  // перемежение
  const out = [];
  for (let i = 0; i < Math.max(d1, d2); i++) for (const b of blocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecPer; i++) for (const e of ecs) out.push(e[i]);
  const stream = [];
  for (const b of out) for (let i = 7; i >= 0; i--) stream.push((b >> i) & 1);

  const base = skeleton(v);
  placeData(base, stream);
  writeVersion(base, v);
  let best = null, bestP = Infinity;
  for (let k = 0; k < 8; k++) {
    const M = applyMask(base, k);
    writeFormat(M, k);
    const p = penalty(M);
    if (p < bestP) { bestP = p; best = M; }
  }
  return best.m.map(r => Array.from(r));
}

/** Готовая картинка: SVG-строка, размер в модулях плюс поля. */
export function qrSvg(text, opts = {}) {
  const m = qrMatrix(text), n = m.length, q = opts.quiet == null ? 4 : opts.quiet, size = n + q * 2;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" width="100%" ' +
    'shape-rendering="crispEdges" role="img" aria-label="QR-код со ссылкой">' +
    '<rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
