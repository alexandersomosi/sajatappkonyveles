// Minden példalevélről asztali (680 px) és mobil (390 px) PNG, teljes magasság, 2x. A logót a helyi fájlból tölti.
const path = require('path'), fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../../kod/panel/node_modules/puppeteer-core'));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const logo = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'logo_feher@2x.png')).toString('base64');
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  for (const f of fs.readdirSync(__dirname).filter(f => /^\d\d_.*\.html$/.test(f))) {
    const html = fs.readFileSync(path.join(__dirname, f), 'utf8').split('https://adozz.hu/email/logo_feher@2x.png').join(logo);
    for (const [nev, w] of [['asztali', 680], ['mobil', 390]]) {
      const p = await b.newPage();
      await p.setViewport({ width: w, height: 100, deviceScaleFactor: 2 });
      await p.setContent(html, { waitUntil: 'load' });
      await p.screenshot({ path: path.join(__dirname, f.replace('.html', `_${nev}.png`)), fullPage: true });
      await p.close();
    }
  }
  await b.close(); console.log('képek kész');
})();
