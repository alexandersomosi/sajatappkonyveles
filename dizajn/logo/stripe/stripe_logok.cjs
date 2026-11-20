// Stripe arculati képek a jóváhagyott felirat-logóból (Poppins 800, Adó + sárga zz + .hu + lendület), 11-20.
// Futtatás: node stripe_logok.cjs  -> adozz_stripe_ikon_512.png (négyzet, kék), adozz_stripe_logo.png (fekvő, átlátszó háttér)
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=block" rel="stylesheet">';
const WM = (szin, zz, hu, meret) => `<span style="font-family:Poppins;font-weight:800;letter-spacing:-.02em;line-height:1;position:relative;display:inline-block;padding-bottom:.2em;white-space:nowrap;color:${szin};font-size:${meret}px">Adó<span style="color:${zz}">zz</span>${hu}<svg viewBox="0 0 300 26" preserveAspectRatio="none" style="position:absolute;left:.02em;bottom:-.02em;width:calc(100% - .04em);height:.26em"><path d="M6 18 C 90 6, 210 2, 294 10" fill="none" stroke="${zz}" stroke-width="11" stroke-linecap="round"/></svg></span>`;
const LAPOK = [
  { nev: 'adozz_stripe_ikon_512.png', w: 512, h: 512, atlatszo: false,
    html: `<body style="margin:0;width:512px;height:512px;background:#1428DB;display:grid;place-items:center">${WM('#fff', '#FFC93C', '', 118)}</body>` },
  { nev: 'adozz_stripe_logo.png', w: 1200, h: 340, atlatszo: true,
    html: `<body style="margin:0;width:1200px;height:340px;background:transparent;display:grid;place-items:center">${WM('#1428DB', '#F2B705', '<span style="color:#1428DB">.hu</span>', 200)}</body>` },
];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  for (const l of LAPOK) {
    const p = await b.newPage();
    await p.setViewport({ width: l.w, height: l.h, deviceScaleFactor: 1 });
    await p.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT}</head>${l.html}</html>`, { waitUntil: 'networkidle0' });
    await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(__dirname, l.nev), omitBackground: l.atlatszo });
    console.log(l.nev, fs.statSync(path.join(__dirname, l.nev)).size, 'bájt');
  }
  await b.close();
})();
