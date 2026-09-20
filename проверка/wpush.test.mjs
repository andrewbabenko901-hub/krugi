/* Проверка шифрования пуша контрольным примером из RFC 8291 §5. */
import { encryptPayload, b64u, unb64u, vapidJwt, newKeys } from '../js/wpush.js';

const V = {
  text: 'When I grow up, I want to be a watermelon',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  uaPub: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  uaPrv: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
  asPub: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  asPrv: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  body: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
};
const jwk = (pub, d) => {
  const p = unb64u(pub);
  const o = { kty: 'EC', crv: 'P-256', x: b64u(p.slice(1, 33)), y: b64u(p.slice(33, 65)) };
  if (d) o.d = d;
  return o;
};
const alg = { name: 'ECDH', namedCurve: 'P-256' };
const kp = {
  privateKey: await crypto.subtle.importKey('jwk', jwk(V.asPub, V.asPrv), alg, false, ['deriveBits']),
  publicKey: await crypto.subtle.importKey('raw', unb64u(V.asPub), alg, true, []),
};
const got = b64u(await encryptPayload(V.text, V.uaPub, V.auth, { kp, salt: unb64u(V.salt) }));
console.log('длина совпала:', got.length === V.body.length, got.length, V.body.length);
console.log('ТЕЛО ИЗ RFC:', got === V.body ? 'СОВПАЛО' : 'РАЗОШЛОСЬ');
if (got !== V.body) { console.log('ждали:', V.body); console.log('вышло:', got); }

/* Обратный ход: расшифровать как это сделает телефон. */
const TD = new TextDecoder();
async function decrypt(bodyBytes, uaPrvJwk, auth) {
  const salt = bodyBytes.slice(0, 16), idlen = bodyBytes[20];
  const as = bodyBytes.slice(21, 21 + idlen), ct = bodyBytes.slice(21 + idlen);
  const uaPrv = await crypto.subtle.importKey('jwk', uaPrvJwk, alg, false, ['deriveBits']);
  const asKey = await crypto.subtle.importKey('raw', as, alg, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPrv, 256));
  const H = async (k, d) => new Uint8Array(await crypto.subtle.sign('HMAC',
    await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), d));
  const C = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
  const T = s => new TextEncoder().encode(s);
  const ikm = await H(await H(unb64u(auth), shared), C(T('WebPush: info\0'), unb64u(V.uaPub), as, new Uint8Array([1])));
  const prk = await H(salt, ikm);
  const cek = (await H(prk, C(T('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await H(prk, C(T('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const out = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  return TD.decode(out.slice(0, out.length - 1));
}
console.log('расшифровка примера:', JSON.stringify(await decrypt(unb64u(V.body), jwk(V.uaPub, V.uaPrv), V.auth)));
console.log('расшифровка своего :', JSON.stringify(await decrypt(unb64u(got), jwk(V.uaPub, V.uaPrv), V.auth)));

/* Случайный проход: свои ключи, своя соль, своё сообщение. */
const ua = await crypto.subtle.generateKey(alg, true, ['deriveBits']);
const uaPubB = b64u(await crypto.subtle.exportKey('raw', ua.publicKey));
const uaJwk = await crypto.subtle.exportKey('jwk', ua.privateKey);
const auth2 = b64u(crypto.getRandomValues(new Uint8Array(16)));
const msg = JSON.stringify({ t: '🛒 Просьба купить', b: 'Молоко, 2 шт · от Андрея' });
const raw = await encryptPayload(msg, uaPubB, auth2);
const back = await (async () => {
  const bodyBytes = raw, salt = bodyBytes.slice(0, 16), idlen = bodyBytes[20];
  const as = bodyBytes.slice(21, 21 + idlen), ct = bodyBytes.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', as, alg, false, []);
  const uaPrv = await crypto.subtle.importKey('jwk', uaJwk, alg, false, ['deriveBits']);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, uaPrv, 256));
  const H = async (k, d) => new Uint8Array(await crypto.subtle.sign('HMAC',
    await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), d));
  const C = (...a) => { const n = a.reduce((s, x) => s + x.length, 0), o = new Uint8Array(n); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
  const T = s => new TextEncoder().encode(s);
  const ikm = await H(await H(unb64u(auth2), shared), C(T('WebPush: info\0'), unb64u(uaPubB), as, new Uint8Array([1])));
  const prk = await H(salt, ikm);
  const cek = (await H(prk, C(T('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await H(prk, C(T('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const out = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ct));
  return new TextDecoder().decode(out.slice(0, out.length - 1));
})();
console.log('свой проход:', back === msg ? 'СОВПАЛО' : 'РАЗОШЛОСЬ', JSON.stringify(back.slice(0, 40)));

/* Подпись VAPID: проверяем чужим ключом, что подпись сходится. */
const k = await newKeys();
const jwt = await vapidJwt(k.prv, 'https://fcm.googleapis.com', 'mailto:a@b.c', 2000000000);
const [h, p, sg] = jwt.split('.');
const verKey = await crypto.subtle.importKey('raw', unb64u(k.pub), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
const okSig = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verKey, unb64u(sg), new TextEncoder().encode(h + '.' + p));
console.log('подпись VAPID:', okSig ? 'СХОДИТСЯ' : 'НЕ СХОДИТСЯ', 'заголовок:', new TextDecoder().decode(unb64u(h)), 'тело:', new TextDecoder().decode(unb64u(p)));
console.log('длина подписи (должно 64):', unb64u(sg).length, 'открытый ключ (65):', unb64u(k.pub).length);
