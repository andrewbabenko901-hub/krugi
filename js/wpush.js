/* ============================================================
   Уведомления на телефон без своего сервера.

   Обычно пуш отправляет сервер приложения. Сервера у нас нет — и не надо:
   отправить пуш может любой, у кого есть три вещи от получателя:
     sub — адрес подписки в службе доставки (Apple, Google) и два ключа,
     pub — открытый ключ VAPID, с которым эта подписка была сделана,
     prv — закрытый ключ VAPID, которым подписывается каждая отправка.
   Всё это Диана и Андрей кладут каждый в свой файл в приватном репозитории:
   они и так видят файлы друг друга, а больше туда никто не ходит.

   Здесь — только чистая математика, без состояния приложения:
     vapidJwt     — подпись ES256 (RFC 8292),
     encryptPayload — шифрование тела aes128gcm (RFC 8291),
     pushTo       — собрать запрос и отправить.
   Поэтому всё это проверяется контрольным примером из RFC 8291 §5.
   ============================================================ */

const TE = new TextEncoder();

export function b64u(b) {
  const a = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function unb64u(s) {
  s = String(s).replace(/-/g, '+').replace(/_/g, '/');
  const t = atob(s + '='.repeat((4 - s.length % 4) % 4)), a = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) a[i] = t.charCodeAt(i);
  return a;
}
export function cat(...parts) {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
}
async function hmac(keyBytes, data) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}
/** HKDF на один блок: длиннее 32 байт нам ничего не нужно. */
async function hkdf(salt, ikm, info, len) {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, cat(info, new Uint8Array([1])))).slice(0, len);
}

/* ---------- ключи VAPID ---------- */
/** Новая пара ключей для подписи отправок. Закрытый храним как JWK. */
export async function newKeys() {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = b64u(await crypto.subtle.exportKey('raw', kp.publicKey));
  const prv = await crypto.subtle.exportKey('jwk', kp.privateKey);
  delete prv.key_ops; delete prv.ext;
  return { pub, prv };
}

/** Подпись запроса к службе доставки: кто отправляет и до какого часа годна. */
export async function vapidJwt(prv, aud, who, exp) {
  const head = b64u(TE.encode('{"typ":"JWT","alg":"ES256"}'));
  const body = b64u(TE.encode(JSON.stringify({
    aud, exp: exp || Math.floor(Date.now() / 1000) + 12 * 3600, sub: who,
  })));
  const key = await crypto.subtle.importKey('jwk', { ...prv, key_ops: ['sign'], ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, TE.encode(head + '.' + body));
  return head + '.' + body + '.' + b64u(sig);
}

/* ---------- шифрование тела (RFC 8291) ----------
   Тело читает только телефон получателя: ключ выводится из его подписки,
   служба доставки видит лишь набор байтов. */
export async function encryptPayload(text, p256dh, auth, opts = {}) {
  const ua = unb64u(p256dh), authSecret = unb64u(auth);
  const kp = opts.kp || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const as = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, kp.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, cat(TE.encode('WebPush: info\0'), ua, as), 32);
  const salt = opts.salt || crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, TE.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, TE.encode('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const plain = cat(typeof text === 'string' ? TE.encode(text) : text, new Uint8Array([2]));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plain));
  const rs = new Uint8Array([0, 0, 0x10, 0]);                       // размер записи 4096
  return cat(salt, rs, new Uint8Array([as.length]), as, ct);        // заголовок aes128gcm + шифр
}

/* ---------- отправка ---------- */
/** target: { pub, prv, sub }. Возвращает { ok, status, msg }. */
export async function pushTo(target, data, opts = {}) {
  const s = target && target.sub;
  if (!s || !s.endpoint || !s.keys || !target.pub || !target.prv) return { ok: false, status: 0, msg: 'нет подписки' };
  const aud = new URL(s.endpoint).origin;
  const jwt = await vapidJwt(target.prv, aud, opts.who || 'mailto:krugi@users.noreply.github.com');
  const body = await encryptPayload(typeof data === 'string' ? data : JSON.stringify(data), s.keys.p256dh, s.keys.auth);
  let r;
  try {
    r = await fetch(s.endpoint, {
      method: 'POST',
      headers: {
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(opts.ttl || 86400),
        Urgency: opts.urgency || 'normal',
        Authorization: 'vapid t=' + jwt + ', k=' + target.pub,
      },
      body,
    });
  } catch (e) {
    // Служба доставки (Apple, Google) принимает запрос, но ответ браузеру не
    // показывает: заголовков CORS в нём нет, и fetch падает уже ПОСЛЕ отправки.
    // Значит уведомление, скорее всего, ушло — просто подтверждения не видно.
    // Настоящая беда — только когда телефон не в сети.
    const off = typeof navigator !== 'undefined' && navigator.onLine === false;
    return off
      ? { ok: false, status: 0, net: 1, msg: 'телефон не в сети' }
      : { ok: false, blind: 1, status: 0,
          msg: 'отправлено, но ' + aud.replace(/^https:\/\//, '') + ' не показывает браузеру ответ' };
  }
  if (r.ok) return { ok: true, status: r.status, msg: 'отправлено' };
  const txt = await r.text().catch(() => '');
  return { ok: false, status: r.status, gone: r.status === 404 || r.status === 410, msg: 'служба доставки: ' + r.status + ' ' + txt.slice(0, 200) };
}
