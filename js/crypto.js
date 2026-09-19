/* Шифрование личного.
 *
 * Общая база лежит в одном репозитории, и у обоих есть к нему доступ. Значит
 * «личное» нельзя просто прятать в интерфейсе — его надо шифровать. Ключ
 * создаётся на устройстве и НИКОГДА не уходит в репозиторий: у пары его нет,
 * и прочитать чужое личное нельзя даже руками через GitHub.
 *
 * AES-GCM 256 бит. Второе своё устройство подключается тем же ключом —
 * его можно скопировать в настройках синхронизации.
 */

export const cryptoOk = !!(globalThis.crypto && crypto.subtle);

export function b64enc(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
export function b64dec(str) {
  const s = atob(str.replace(/\s/g, '')); const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
export const utf8enc = s => new TextEncoder().encode(s);
export const utf8dec = b => new TextDecoder().decode(b);

export function newKey() {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return b64enc(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function keyBytes(k) {
  const s = k.trim().replace(/-/g, '+').replace(/_/g, '/');
  return b64dec(s + '==='.slice((s.length + 3) % 4));
}
export function keyLooksValid(k) {
  try { return keyBytes(k).length === 32; } catch { return false; }
}
const cache = new Map();
async function imp(k) {
  if (!cache.has(k)) cache.set(k, crypto.subtle.importKey('raw', keyBytes(k), 'AES-GCM', false, ['encrypt', 'decrypt']));
  return cache.get(k);
}

export async function seal(obj, k) {
  const iv = new Uint8Array(12); crypto.getRandomValues(iv);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await imp(k), utf8enc(JSON.stringify(obj)));
  return { iv: b64enc(iv), ct: b64enc(new Uint8Array(ct)) };
}
export async function open(box, k) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64dec(box.iv) }, await imp(k), b64dec(box.ct));
  return JSON.parse(utf8dec(new Uint8Array(pt)));
}
