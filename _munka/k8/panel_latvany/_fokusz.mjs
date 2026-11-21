// Fókusz-gyűrű próba: Tab-bal végigmegy néhány elemen, a fókuszált elem környékét kivágja, és egy kontaktlapra rakja.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
const puppeteer = (await import('file:///C:/Users/UpgradePC/konyvelo_app/kod/panel/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default;
const dist = 'C:/Users/UpgradePC/konyvelo_app/kod/panel/dist-mock-k8p';
const out = 'C:/Users/UpgradePC/konyvelo_app/_munka/k8/panel_latvany';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = join(dist, decodeURIComponent(u.pathname));
  if (!existsSync(p) || statSync(p).isDirectory()) p = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(4389, '127.0.0.1', r));
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--hide-scrollbars', '--force-device-scale-factor=1'] });
const kepek = [];
for (const [path, role, n] of [['/admin/konzol/ugyfelek/cl-tr-2', 'admin', 40], ['/ugyfelek/c-kata/dosszie?ev=2026&honap=2026-10', 'accountant', 30], ['/admin/rendszer', 'admin', 40]]) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`http://127.0.0.1:4389${path}${path.includes('?') ? '&' : '?'}mock_role=${role}`, { waitUntil: 'load' });
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  const lattam = new Set();
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    await new Promise((r) => setTimeout(r, 60));
    const info = await page.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      const txt = (e.innerText || e.getAttribute('aria-label') || e.getAttribute('placeholder') || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 30);
      const ter = e.closest('.oldalsav') ? 'menu' : e.closest('.fejlec') ? 'hos' : 'kartya';
      return { x: r.x, y: r.y, w: r.width, h: r.height, txt, ter, outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, shadow: cs.boxShadow.slice(0, 60) };
    });
    if (!info || info.w === 0) continue;
    const kulcs = info.ter + (info.ter === 'menu' ? '' : info.txt);
    if (lattam.has(kulcs) && info.ter === 'menu') continue;
    lattam.add(kulcs);
    const pad = 14;
    const clip = { x: Math.max(0, info.x - pad), y: Math.max(0, info.y - pad), width: Math.min(info.w + 2 * pad, 600), height: Math.min(info.h + 2 * pad, 200) };
    if (clip.y + clip.height > 900 || clip.y < 0) continue;
    const b64 = await page.screenshot({ clip, encoding: 'base64' });
    kepek.push({ b64, cim: `${path.split('?')[0]} · ${info.ter} · ${info.txt} · ${info.outline}` });
  }
  await ctx.close();
}
const lap = await browser.newPage();
await lap.setViewport({ width: 1400, height: 900 });
await lap.setContent(`<body style="margin:10px;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:10px;background:#ddd">${kepek
  .slice(0, 48)
  .map((k) => `<figure style="margin:0;background:#fff;padding:4px;max-width:440px"><img src="data:image/png;base64,${k.b64}" style="max-width:430px"><figcaption>${k.cim.replace(/</g, '&lt;')}</figcaption></figure>`)
  .join('')}</body>`);
await lap.screenshot({ path: `${out}/_fokusz_kontaktlap.png`, fullPage: true });
await browser.close();
server.close();
console.log('kész', kepek.length);
