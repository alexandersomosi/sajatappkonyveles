// Round-1 fixer: targeted panel screenshots from the mock build (dist-mock) at 1280×720 and 1440×900, with overflow checks.
//   node panel_mock.mjs [filter]     PORT=4329
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, rmSync } from 'node:fs';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';

const root = 'C:/Users/UpgradePC/konyvelo_app/kod/panel';
const puppeteer = createRequire(join(root, 'package.json'))('puppeteer-core');
const dist = join(root, process.env.DIST || 'dist-mock');
const out = process.env.KI || 'C:/Users/UpgradePC/konyvelo_app/kod/panel/_kepek';
const ELO = process.env.ELO || 'jav1_';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.PORT || 4329);
mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = join(dist, decodeURIComponent(u.pathname));
  if (!p.startsWith(dist) || !existsSync(p) || statSync(p).isDirectory()) p = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (text, sel = 'button, a, label, tr, [role=button]') => async (page) => {
  await page.evaluate((t, s) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent && e.textContent.replace(/\s+/g, ' ').trim().includes(t));
    if (!el) throw new Error('nincs ilyen elem: ' + t);
    el.scrollIntoView({ block: 'center' });
    el.click();
  }, text, sel);
  await var_(500);
};
const type = (sel, text) => async (page) => { await page.type(sel, text); await var_(250); };
const evalStep = (fn) => async (page) => { await page.evaluate(fn); await var_(450); };
const A = 'accountant', AD = 'admin', CS = 'csapat';
const SHOTS = [
  ['ugyfelek', A, '/ugyfelek'],
  ['kata_attekintes', A, '/ugyfelek/c-kata', [], true],
  ['kata_ado_q4', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q4', [], true],
  ['kata_ado_q3', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q3', [], true],
  ['kata_ado_kezi', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q4', [clickText('Kézzel módosítom az összeget', 'label'), type('.mezosor.k3 label:nth-child(3) input', '100000'), type('input[placeholder^="Pl. decemberi"]', 'decemberi táppénz, kieső napok'), clickText('Jóváhagyom és elküldöm'), clickText('Igen, jóváhagyom és elküldöm')], true],
  ['reka_ado', A, '/ugyfelek/c-reka/ado', [], true],
  ['reka_ado_elteres', A, '/ugyfelek/c-reka/ado', [clickText('Eltérés van'), evalStep(() => document.querySelector('.fiok-lap input[type=checkbox]')?.click()), type('.fiok-lap textarea', 'A szochót kevesebbel utaltad, a különbséget pótold.'), clickText('Elküldöm', '.fiok-lap button')], true],
  ['kata_uzenetek', A, '/ugyfelek/c-kata/uzenetek'],
  ['peter_bekotes', A, '/ugyfelek/c-peter/bekotes', [], true],
  ['levente_bekotes', A, '/ugyfelek/c-levente/bekotes', [], true],
  ['hatarido', A, '/hatarido-figyelo'],
  ['beallitasok_2fa', A, '/beallitasok', [clickText('Bekapcsolom', 'button')]],
  ['naplo', A, '/naplo'],
  ['admin_csapat', AD, '/admin/csapat'],
  ['admin_elofizetesek', AD, '/admin/elofizetesek'],
  ['admin_attekintes', AD, '/admin'],
  ['admin_fizetesek', AD, '/admin/fizetesek'],
  ['admin_szovegek', AD, '/admin/szovegek?ful=szovegek'],
  ['admin_naplo', AD, '/admin/naplo'],
  ['csapat_inditas', CS, '/vallalkozas-inditas'],
  ['csapat_uzenetek', CS, '/uzenetek/c-levente'],
  ['csapat_fiok_piszkos', CS, '/vallalkozas-inditas/reg-zsofia', [clickText('Javítom'), type('.fiok-lap input.doboz', 'x'), evalStep(() => document.querySelector('.fuggony')?.click())]],
];
const filter = process.argv[2] || '';
const meretek = (process.env.MERET || '1280x720,1440x900').split(',').map((x) => x.split('x').map(Number));
for (const [nev, role, path, steps = [], full = false] of SHOTS) {
  if (filter && !nev.includes(filter)) continue;
  for (const [w, h] of meretek) {
    const udd = join(tmpdir(), `kj_jav1_panel_${process.pid}_${nev}_${w}`).replace(/\\/g, '/');
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: udd, args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', '--lang=hu-HU'], defaultViewport: { width: w, height: h, deviceScaleFactor: 1 } });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}mock_role=${role}`, { waitUntil: 'networkidle0', timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
      await var_(400);
      for (const s of steps) await s(page);
      await var_(400);
      const m = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const tul = [];
        // tables wider than their sheet, the tab row, anything sticking out of the viewport
        document.querySelectorAll('.lap').forEach((l) => { const t = l.querySelector(':scope > .tabla'); if (t && t.scrollWidth > l.clientWidth + 1) tul.push(`tabla ${t.scrollWidth}>${l.clientWidth}`); });
        const f = document.querySelector('.fulek');
        if (f && f.scrollWidth > f.clientWidth + 1) tul.push(`fulek ${f.scrollWidth}>${f.clientWidth}`);
        if (document.documentElement.scrollWidth > vw) tul.push(`oldal ${document.documentElement.scrollWidth}>${vw}`);
        const iro = document.querySelector('.iro-sor');
        const nav = [...document.querySelectorAll('.nav-elem')].filter((e) => e.getBoundingClientRect().height > 46).map((e) => e.textContent);
        return { tul, iroAlja: iro ? Math.round(iro.getBoundingClientRect().bottom) : null, ablak: window.innerHeight, navTort: nav };
      });
      await page.screenshot({ path: `${out}/${ELO}${nev}_${w}.png` });
      if (full) await page.screenshot({ path: `${out}/${ELO}${nev}_${w}_teljes.png`, fullPage: true });
      console.log('ok', `${nev}_${w}`, JSON.stringify(m), errors.length ? `HIBA: ${errors.join(' | ').slice(0, 300)}` : '');
    } catch (e) {
      console.log('HIBA', `${nev}_${w}`, e.message);
    } finally {
      await browser.close().catch(() => {});
      try { rmSync(udd, { recursive: true, force: true }); } catch {}
    }
  }
}
server.close();
