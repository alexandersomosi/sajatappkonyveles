// Adózz.hu v2 – a felirat-logó képként (ALAP-D / D6): logo/logo.png (kék, fehér alapra) és logo/logo_feher.png
// (fehér, kék alapra), átlátszó háttérrel, szorosra vágva, + logo/meret.ts (méretadatok).
// A dizajn/landing_v2_proba4/_eszkoz/logo_kep.cjs módszere (Poppins 800, sárga „zz”, lendület-vonal – a jóváhagyott
// v2.js `wm8` felirata), csak 4× felbontásban (30 px-es betűre), hogy 22–38 px-es betűméretig 3×-os kijelzőn is éles legyen.
// Így az appba és a panelbe nem kell a Poppins betű.
// Futtatás (csak ha a logó változik): node kod/shared/v2/scripts/logo-kep.cjs
// Kell: kod/panel/node_modules/puppeteer-core, helyi Chrome, Python + Pillow; a Poppins betűt a Google Fonts adja (csak itt, gyártáskor).
const path = require('path');
const fs = require('fs');
const V2 = path.resolve(__dirname, '..');
const puppeteer = require(path.resolve(V2, '../../panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((f) => fs.existsSync(f));
const KI = path.join(V2, 'logo');
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=block" rel="stylesheet">';
const BETU = 30; // CSS px betűméret
const SKALA = 4; // a kép px / CSS px
const lendulet = (szin) => `<svg viewBox="0 0 300 26" preserveAspectRatio="none" style="position:absolute;left:.02em;bottom:-.02em;width:calc(100% - .04em);height:.26em"><path d="M6 18 C 90 6, 210 2, 294 10" fill="none" stroke="${szin}" stroke-width="11" stroke-linecap="round"/></svg>`;
const WM = (szin, zz) => `<span id="wm" style="font-family:Poppins;font-weight:800;letter-spacing:-.02em;line-height:1;position:relative;display:inline-block;padding-bottom:.2em;white-space:nowrap;color:${szin};font-size:${BETU}px">Adó<span style="color:${zz}">zz</span>.hu${lendulet(zz)}</span>`;
const LOGOK = [
  { nev: 'logo.png', html: WM('#1428DB', '#F2B705') }, // v2.css .wm8.feher (fehér alapra)
  { nev: 'logo_feher.png', html: WM('#FFFFFF', '#FFC93C') }, // v2.css .wm8 (kék alapra)
];
(async () => {
  if (!CHROME) throw new Error('Nem találok helyi Chrome-ot');
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 400, height: 120, deviceScaleFactor: SKALA });
  for (const l of LOGOK) {
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT}</head><body style="margin:0;padding:20px;background:transparent">${l.html}</body></html>`, { waitUntil: 'load', timeout: 45000 });
    await p.evaluate(async () => { await document.fonts.load('800 30px Poppins'); await document.fonts.ready; });
    if (!(await p.evaluate(() => document.fonts.check('800 30px Poppins')))) throw new Error('A Poppins nem töltődött be');
    const r = await p.evaluate(() => { const x = document.getElementById('wm').getBoundingClientRect(); return { x: x.x, y: x.y, width: x.width, height: x.height }; });
    await p.screenshot({ path: path.join(KI, l.nev), omitBackground: true, clip: { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 } });
  }
  await b.close();
  // szorosra vágás; a méret JSON-ként jön vissza
  const ki = require('child_process').execFileSync('python', ['-c', `
import sys, json
from PIL import Image
m = {}
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 6 else 0).getbbox()
    im = im.crop((max(0, bb[0] - 2), max(0, bb[1] - 2), min(im.width, bb[2] + 2), min(im.height, bb[3] + 2)))
    im.save(f, optimize=True)
    m[f] = im.size
print(json.dumps(m))
`, ...LOGOK.map((l) => path.join(KI, l.nev))], { encoding: 'utf8' });
  const meretek = JSON.parse(ki.trim().split('\n').pop());
  const kek = meretek[path.join(KI, 'logo.png')], feher = meretek[path.join(KI, 'logo_feher.png')];
  const ts = `// GENERÁLT – kézzel ne írd: node kod/shared/v2/scripts/logo-kep.cjs
// A logóképek pixelmérete és hogy mekkora betűméretre készültek. Megjelenítés \`meret\` px-es betűvel:
// szélesség = kep[0] / skala * meret / betu, magasság = kep[1] / skala * meret / betu.
export const LOGO_KEP = {
  betu: ${BETU},
  skala: ${SKALA},
  kek: [${kek[0]}, ${kek[1]}],
  feher: [${feher[0]}, ${feher[1]}],
} as const;

/** A logó mérete (pt/px) adott betűméretnél (a v2.js \`data-meret\`-je; fejlécben 26–30, gépes menüben 30). */
export function logoMeret(betuMeret: number, feher = false): { width: number; height: number } {
  const [w, h] = feher ? LOGO_KEP.feher : LOGO_KEP.kek;
  const k = betuMeret / LOGO_KEP.betu / LOGO_KEP.skala;
  return { width: Math.round(w * k * 10) / 10, height: Math.round(h * k * 10) / 10 };
}

/** A logó felolvasói neve. */
export const LOGO_ALT = 'Adózz.hu';
`;
  fs.writeFileSync(path.join(KI, 'meret.ts'), ts);
  console.log('logó kész:', JSON.stringify({ kek, feher }));
})().catch((e) => { console.error(e); process.exit(1); });
