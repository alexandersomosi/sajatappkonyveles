// A felirat-logó képként (kepek/logo.png kék, kepek/logo_feher.png fehér), hogy az oldal ne kérjen betűt a Google-tól.
// Élesben a CSP csak saját forrást enged, és a „nem használ sütit / nem küld adatot másnak” ígérethez is ez illik.
// A logót egyszer kirajzolja (Poppins 800, mint a dizajn/logo/stripe/stripe_logok.cjs), 3x felbontásban, átlátszó háttérrel,
// és szorosra vágja. Futtatás: node _eszkoz/logo_kep.cjs   (csak akkor kell, ha a logó változik)
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const KI = path.join(__dirname, '..', 'kepek');
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=block" rel="stylesheet">';
const MERET = 30; // CSS px betűméret; 3x-os képpel 25–40 px között is éles
const lendulet = szin => `<svg viewBox="0 0 300 26" preserveAspectRatio="none" style="position:absolute;left:.02em;bottom:-.02em;width:calc(100% - .04em);height:.26em"><path d="M6 18 C 90 6, 210 2, 294 10" fill="none" stroke="${szin}" stroke-width="11" stroke-linecap="round"/></svg>`;
const WM = (szin, zz) => `<span id="wm" style="font-family:Poppins;font-weight:800;letter-spacing:-.02em;line-height:1;position:relative;display:inline-block;padding-bottom:.2em;white-space:nowrap;color:${szin};font-size:${MERET}px">Adó<span style="color:${zz}">zz</span>.hu${lendulet(zz)}</span>`;
const LOGOK = [
  { nev: 'logo.png', html: WM('#1428DB', '#F2B705') },
  { nev: 'logo_feher.png', html: WM('#FFFFFF', '#FFC93C') },
];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await b.newPage();
  await p.setViewport({ width: 400, height: 120, deviceScaleFactor: 3 });
  for (const l of LOGOK) {
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT}</head><body style="margin:0;padding:20px;background:transparent">${l.html}</body></html>`, { waitUntil: 'load', timeout: 45000 });
    await p.evaluate(async () => { await document.fonts.load('800 30px Poppins'); await document.fonts.ready; });
    if (!(await p.evaluate(() => document.fonts.check('800 30px Poppins')))) throw new Error('A Poppins nem töltődött be');
    const r = await p.evaluate(() => { const b = document.getElementById('wm').getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; });
    const f = path.join(KI, l.nev);
    await p.screenshot({ path: f, omitBackground: true, clip: { x: r.x - 4, y: r.y - 4, width: r.width + 8, height: r.height + 8 } });
  }
  await b.close();
  // szorosra vágás + méret kiírása (CSS px = kép px / 3)
  require('child_process').execFileSync('python', ['-c', `
import sys
from PIL import Image
for f in sys.argv[1:]:
    im = Image.open(f).convert('RGBA')
    bb = im.getchannel('A').point(lambda a: 255 if a > 6 else 0).getbbox()
    im = im.crop((max(0, bb[0] - 2), max(0, bb[1] - 2), min(im.width, bb[2] + 2), min(im.height, bb[3] + 2)))
    im.save(f, optimize=True)
    print(f, im.size, 'CSS:', round(im.width / 3, 1), 'x', round(im.height / 3, 1))
`, ...LOGOK.map(l => path.join(KI, l.nev))], { stdio: 'inherit' });
})();
