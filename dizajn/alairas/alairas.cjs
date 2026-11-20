// Kézi levelek aláírása (tulaj 11-20: "ha én írok manuálisan ügyfélnek") – Lark Mailhez.
// Készít: logo_alairas@2x.png (fehér háttérre, kék Adó + sárga zz + .hu + lendület, 2x), alairas_szemelyes.png, alairas_csapat.png (előnézet).
// Futtatás: node alairas.cjs
const path = require('path');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const FONT = '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=block" rel="stylesheet">';
const LOGO = `<span style="font-family:Poppins;font-weight:800;letter-spacing:-.02em;line-height:1;position:relative;display:inline-block;padding-bottom:.2em;white-space:nowrap;color:#1428DB;font-size:64px">Adó<span style="color:#F2B705">zz</span>.hu<svg viewBox="0 0 300 26" preserveAspectRatio="none" style="position:absolute;left:.02em;bottom:-.02em;width:calc(100% - .04em);height:.26em"><path d="M6 18 C 90 6, 210 2, 294 10" fill="none" stroke="#F2B705" stroke-width="11" stroke-linecap="round"/></svg></span>`;

let LW = 140, LH = 39;
const alairas = (nev, beosztas) => `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#10152B;border-collapse:collapse">
  <tr><td style="padding:0 0 10px 0;font-size:15px;line-height:1.4">
    <strong style="font-size:16px">${nev}</strong><br><span style="color:#5B6478">${beosztas}</span>
  </td></tr>
  <tr><td style="padding:10px 0 8px 0;border-top:2px solid #FFC93C">
    <img src="logo_alairas@2x.png" width="${LW}" height="${LH}" alt="Adózz.hu" style="display:block;border:0;width:${LW}px;height:${LH}px">
  </td></tr>
  <tr><td style="font-size:13.5px;line-height:1.55;color:#2A3247">
    Saját könyvelő egyéni vállalkozóknak<br>
    <a href="mailto:ugyfelszolgalat@adozz.hu" style="color:#1428DB;text-decoration:none">ugyfelszolgalat@adozz.hu</a> &nbsp;·&nbsp; <a href="https://adozz.hu" style="color:#1428DB;text-decoration:none">adozz.hu</a>
  </td></tr>
  <tr><td style="padding-top:8px;font-size:11.5px;line-height:1.5;color:#8A93A8">
    Somosi Kft. · 1123 Budapest, Nagyenyed utca 5. · Adószám: 32769678-2-43 · <span style="white-space:nowrap">Cégjegyzékszám: 01-09-441659</span>
  </td></tr>
</table>`;

const VALTOZAT = [
  ['alairas_szemelyes', 'Somosi Alexander', 'ügyvezető, Adózz.hu'],
  ['alairas_csapat', 'Az Adózz.hu csapata', 'Ügyfélszolgálat'],
];
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  // 1) logó (2x) – csak ha még nincs; a levágott méretet a PNG fejlécéből olvassuk
  let p;
  if (!fs.existsSync(path.join(__dirname, 'logo_alairas@2x.png'))) {
  p = await b.newPage();
  await p.setViewport({ width: 420, height: 120, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONT}</head><body style="margin:0;width:420px;height:120px;background:transparent;display:grid;place-items:center"><div style="transform:scale(1.04);transform-origin:center">${LOGO}</div></body></html>`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(__dirname, 'logo_alairas@2x.png'), omitBackground: true });
  await p.close();
  }
  const png = fs.readFileSync(path.join(__dirname, 'logo_alairas@2x.png')); LW = Math.round(png.readUInt32BE(16) / 2); LH = Math.round(png.readUInt32BE(20) / 2);
  // 2) aláírások HTML + előnézet egy levél aljára téve
  for (const [fajl, nev, beo] of VALTOZAT) {
    const html = alairas(nev, beo);
    fs.writeFileSync(path.join(__dirname, fajl + '.html'), `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Aláírás – ${nev}</title></head><body style="margin:24px;background:#fff">${html}</body></html>`);
    p = await b.newPage();
    await p.setViewport({ width: 640, height: 400, deviceScaleFactor: 2 });
    await p.goto('file:///' + path.join(__dirname, fajl + '.html').replace(/\\/g, '/'));
    await p.setContent(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><base href="file:///${__dirname.replace(/\\/g, '/')}/"></head><body style="margin:0;background:#F3F5FB;padding:24px;font-family:-apple-system,'Segoe UI',Roboto,Arial,sans-serif">
      <div style="background:#fff;border-radius:14px;padding:24px 28px;max-width:560px;box-shadow:0 1px 2px rgba(16,21,43,.05),0 4px 14px rgba(16,21,43,.06)">
        <div style="font-size:15px;line-height:1.55;color:#10152B">Szia Péter!<br><br>Megnéztük a novemberi számláidat, minden rendben van. A IV. negyedévi összeget január elején küldjük.<br><br>Üdvözlettel:</div>
        <div style="height:14px"></div>${html}</div></body></html>`, { waitUntil: 'load' });
    const h = await p.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    await p.setViewport({ width: 640, height: h, deviceScaleFactor: 2 });
    await p.screenshot({ path: path.join(__dirname, fajl + '.png') });
    await p.close();
    console.log(fajl, 'kész');
  }
  await b.close();
})();
