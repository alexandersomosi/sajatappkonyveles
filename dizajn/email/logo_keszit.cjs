// A kék fejléc logója: fehér Adó + sárga zz + fehér .hu + sárga lendület, átlátszó háttér, 2x (340x92).
// A feliratot nagyban kirajzolja, levágja az átlátszó szélt, és BALRA igazítva teszi a 340x92-es vászonra,
// hogy a levélben a logó bal széle egy vonalba essen a szöveggel.
const path = require('path'), fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../../kod/panel/node_modules/puppeteer-core'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const W = 340, H = 92, BAL = 2; // vászon és bal belső margó (px, 2x-es képen)
// A Poppins 800 (latin) betűt a Node tölti le és data: URL-ként ágyazza be (a Chrome-nak így nem kell hálózat).
let FONT = '';
async function betoltFont() {
  const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' };
  const css = await (await fetch('https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=block', { headers: UA })).text();
  const url = css.split('/* latin */')[1].match(/url\((https:[^)]+\.woff2)\)/)[1];
  const b64 = Buffer.from(await (await fetch(url, { headers: UA })).arrayBuffer()).toString('base64');
  FONT = `<style>@font-face{font-family:'Poppins';font-weight:800;font-style:normal;font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}</style>`;
}
const WM = m => `<span id="wm" style="font-family:Poppins;font-weight:800;letter-spacing:-.02em;line-height:1;position:relative;display:inline-block;padding-bottom:.2em;white-space:nowrap;color:#fff;font-size:${m}px">Adó<span style="color:#FFC93C">zz</span>.hu<svg viewBox="0 0 300 26" preserveAspectRatio="none" style="position:absolute;left:.02em;bottom:-.02em;width:calc(100% - .04em);height:.26em"><path d="M6 18 C 90 6, 210 2, 294 10" fill="none" stroke="#FFC93C" stroke-width="11" stroke-linecap="round"/></svg></span>`;

async function rajzol(p, meret) {
  await p.setViewport({ width: 900, height: 300, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT}</head><body style="margin:0;background:transparent;padding:40px">${WM(meret)}</body></html>`, { waitUntil: 'load' });
  await p.evaluate(async () => { await document.fonts.load('800 40px Poppins'); await document.fonts.ready; });
  if (!(await p.evaluate(() => document.fonts.check('800 40px Poppins')))) throw new Error('A Poppins nem töltődött be');
  const png = await p.screenshot({ omitBackground: true, encoding: 'base64' });
  // a festett (nem átlátszó) képpontok határa
  return p.evaluate(async src => {
    const img = new Image(); img.src = 'data:image/png;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 8) {
      if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { src, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }, png);
}

(async () => {
  await betoltFont();
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const p = await b.newPage();
  // betűméret: a felirat töltse ki a vászon szélességét (BAL margóval mindkét oldalon), de férjen bele a magasságba is
  const proba = await rajzol(p, 100);
  const meret = Math.floor(100 * Math.min((W - 2 * BAL) / proba.w, (H - 4) / proba.h) * 10) / 10;
  const k = await rajzol(p, meret);
  const kesz = await p.evaluate(async (k, W, H, BAL) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + k.src; await img.decode();
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, k.x0, k.y0, k.w, k.h, BAL, Math.round((H - k.h) / 2), k.w, k.h);
    return c.toDataURL('image/png').split(',')[1];
  }, k, W, H, BAL);
  fs.writeFileSync(path.join(__dirname, 'logo_feher@2x.png'), Buffer.from(kesz, 'base64'));
  await b.close();
  console.log('kész, betűméret', meret, 'felirat', k.w + 'x' + k.h);
})();
