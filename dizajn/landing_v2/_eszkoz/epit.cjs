// Az adozz.hu értékesítő oldal (landing_v2) összeállítása: _eszkoz/index.sablon.html -> index.html
// A sablon jelölőit (logó, pipa, Fluent Emoji Flat ikonok) beégeti, hogy az oldal JS nélkül, egyetlen statikus HTML legyen.
// Futtatás: node _eszkoz/epit.cjs   (a landing_v2 mappából vagy bárhonnan)
const fs = require('fs'), path = require('path');
const GYOKER = path.join(__dirname, '..');

// Fluent Emoji Flat (MIT, github.com/microsoft/fluentui-emoji) – a C5_v2/v2.js-ből, mint az appban.
const v2 = fs.readFileSync(path.join(GYOKER, '../C5_v2/v2.js'), 'utf8');
const i = v2.indexOf('var EMOJI = ') + 12, j = v2.indexOf('\n', i);
let t = v2.slice(i, j).trim(); if (t.endsWith(';')) t = t.slice(0, -1);
const EMOJI = JSON.parse(t);
function ikon(n) {
  if (!EMOJI[n]) throw new Error('Nincs ilyen ikon: ' + n);
  let [vb, body] = EMOJI[n];
  body = body.replace(/id="([^"]+)"/g, (m, a) => `id="${n}-${a}"`).replace(/url\(#([^)]+)\)/g, (m, a) => `url(#${n}-${a})`);
  return `<svg class="ikon" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Felirat-logó képként (kepek/logo.png, kepek/logo_feher.png; _eszkoz/logo_kep.cjs készíti a jóváhagyott Poppins 800-as feliratból),
// hogy az oldal semmit ne kérjen idegen szervertől (élesben a CSP csak saját forrást enged).
const LOGO = `<a class="logo" href="#top"><img src="kepek/logo.png" width="138" height="38" alt="Adózz.hu – az oldal teteje"></a>`;
const LOGO_FEHER = `<a class="logo logo-feher" href="#top"><img src="kepek/logo_feher.png" width="138" height="38" loading="lazy" alt="Adózz.hu – az oldal teteje"></a>`;
// 2. kör (11-20 este): vékony, egyszínű pipa karika nélkül (a színes karikás pipa AI-sablon hatású volt).
const PIPA = '<svg class="pipa" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.3 8.5l2.9 2.9 6.5-6.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const NEM = '<svg class="pipa nem" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 8h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

let html = fs.readFileSync(path.join(__dirname, 'index.sablon.html'), 'utf8');
html = html
  .replace(/<!--logo-feher-->/g, LOGO_FEHER)
  .replace(/<!--logo-->/g, LOGO)
  .replace(/<!--pipa-->/g, PIPA)
  .replace(/<!--nem-->/g, NEM)
  .replace(/<!--ikon:([a-z-]+)-->/g, (m, n) => ikon(n));
const maradt = html.match(/<!--(logo|pipa|nem|ikon:)[^>]*-->/g);
if (maradt) throw new Error('Kimaradt jelölő: ' + maradt.join(', '));
html = html.replace('<head>', '<head>\n<!-- GENERÁLT: _eszkoz/index.sablon.html + _eszkoz/epit.cjs. Kézzel ne ezt írd át. -->');
fs.writeFileSync(path.join(GYOKER, 'index.html'), html);
console.log('index.html kész,', Math.round(html.length / 1024), 'KB');
