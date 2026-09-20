import { ecBytes } from '../js/qr.js';
// известный пример из учебника: данные v1-M «HELLO WORLD», 10 контрольных байт
const data = [0x40,0xd2,0x75,0x47,0x76,0x17,0x32,0x06,0x27,0x26,0x96,0xc6,0xc6,0x96,0x70,0xec];
const want = [0xbc,0x2a,0x90,0x13,0x6b,0xaf,0xef,0xfd,0x4b,0xe0];
const got = Array.from(ecBytes(data, 10));
console.log('RS:', got.map(x=>x.toString(16).padStart(2,'0')).join(' '));
console.log('ждали:', want.map(x=>x.toString(16).padStart(2,'0')).join(' '));
console.log(JSON.stringify(got) === JSON.stringify(want) ? 'СОВПАЛО' : 'РАЗОШЛОСЬ');
// проверка синдромов на этом же коде
const E = new Uint8Array(512), L = new Uint8Array(256);
{ let x=1; for (let i=0;i<255;i++){E[i]=x;L[x]=i;x<<=1;if(x&0x100)x^=0x11D;} for(let i=255;i<512;i++)E[i]=E[i-255]; }
const mul=(a,b)=>(a&&b)?E[L[a]+L[b]]:0;
const code = data.concat(want);
let bad=0;
for (let s=0;s<10;s++){ let acc=0; for (const c of code) acc = mul(acc,E[s]) ^ c; if (acc) bad++; }
console.log('синдромы ненулевые:', bad);
