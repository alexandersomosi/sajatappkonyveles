// Kiírja a v2.js Fluent Emoji Flat ikonjait (MIT, github.com/microsoft/fluentui-emoji) önálló <svg> kódként.
// node _eszkoz/ikonok.cjs nev1 nev2 ...  -> JSON {nev: '<svg ...>'}; --lap -> _eszkoz/ikonlap.html
const fs = require('fs'), path = require('path');
const s = fs.readFileSync(path.join(__dirname, '../../C5_v2/v2.js'), 'utf8');
const i = s.indexOf('var EMOJI = ') + 12, j = s.indexOf('\n', i);
let t = s.slice(i, j).trim(); if (t.endsWith(';')) t = t.slice(0, -1);
const E = JSON.parse(t);
const args = process.argv.slice(2);
// az id-k (gradiensek) ütközését elkerüljük: minden ikon id-jét előtaggal látjuk el
function svg(n) {
  let [vb, body] = E[n];
  body = body.replace(/id="([^"]+)"/g, (m, a) => `id="${n}-${a}"`).replace(/url\(#([^)]+)\)/g, (m, a) => `url(#${n}-${a})`);
  return `<svg class="ikon" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
}
if (args[0] === '--lap') {
  const html = '<!doctype html><meta charset=utf-8><style>body{font:14px sans-serif;display:flex;flex-wrap:wrap;gap:16px;padding:16px;width:900px}div{width:90px;text-align:center}svg{width:48px;height:48px}</style>' +
    Object.keys(E).map(n => `<div>${svg(n)}<br>${n}</div>`).join('');
  fs.writeFileSync(path.join(__dirname, 'ikonlap.html'), html);
} else {
  const o = {}; for (const n of args) o[n] = svg(n);
  process.stdout.write(JSON.stringify(o, null, 1));
}
