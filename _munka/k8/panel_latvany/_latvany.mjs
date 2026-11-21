// PANEL-LÁTVÁNY: képek + DOM-mérések a mock buildből (dist-mock-k8p), 1440 és 1280 px. Csak olvas, a projektben nem ír semmit
// a kimeneti mappán kívül.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
const puppeteer = (await import('file:///C:/Users/UpgradePC/konyvelo_app/kod/panel/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default;

const dist = 'C:/Users/UpgradePC/konyvelo_app/kod/panel/dist-mock-k8p';
const out = process.env.KI || 'C:/Users/UpgradePC/konyvelo_app/_munka/k8/panel_latvany';
const SZELEK = (process.env.SZELEK || '1440,1280').split(',').map(Number);
const filter = process.argv[2] || '';
mkdirSync(out, { recursive: true });
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.webp': 'image/webp' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = join(dist, decodeURIComponent(u.pathname));
  if (!p.startsWith(join(dist)) || !existsSync(p) || statSync(p).isDirectory()) p = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
const PORT = 4388;
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;
const varj = (ms) => new Promise((r) => setTimeout(r, ms));

const A = 'accountant', AD = 'admin', CS = 'csapat';
const SHOTS = [
  ['a00_belepes', 'none', '/belepes'],
  ['a01_ugyfelek', A, '/ugyfelek'],
  ['a02_ugyfel_attekintes', A, '/ugyfelek/c-kata'],
  ['a03_ugyfel_bekotes', A, '/ugyfelek/c-peter/bekotes'],
  ['a04_ugyfel_dosszie', A, '/ugyfelek/c-kata/dosszie?ev=2026&honap=2026-10'],
  ['a05_ugyfel_szamlak', A, '/ugyfelek/c-kata/nav'],
  ['a06_ugyfel_bevetelek', A, '/ugyfelek/c-kata/bevetelek'],
  ['a07_ugyfel_kimutatas', A, '/ugyfelek/c-kata/kimutatas'],
  ['a08_ugyfel_ado', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q4'],
  ['a09_ugyfel_ado_kata', A, '/ugyfelek/c-lakatos-greta/ado'],
  ['a10_ugyfel_kedvezmenyek', A, '/ugyfelek/c-szabo-eszter/kedvezmenyek'],
  ['a11_ugyfel_eves', A, '/ugyfelek/c-kata/eves?mock_today=2027-03-20'],
  ['a12_ugyfel_folyoszamla', A, '/ugyfelek/c-kata/folyoszamla'],
  ['a13_ugyfel_onellenorzes', A, '/ugyfelek/c-kata/onellenorzes'],
  ['a14_ugyfel_uzenetek', A, '/ugyfelek/c-kata/uzenetek'],
  ['a15_ugyfel_keresek', A, '/ugyfelek/c-kata/keresek'],
  ['a16_ugyfel_visszahivasok', A, '/ugyfelek/c-kata/visszahivasok'],
  ['a17_ugyfel_naplo', A, '/ugyfelek/c-kata/naplo'],
  ['a20_hatarido', A, '/hatarido-figyelo'],
  ['a21_eves_attekinto', A, '/eves-attekinto'],
  ['a22_keresek', A, '/keresek'],
  ['a23_visszahivasok', A, '/visszahivasok'],
  ['a24_helyettunk', A, '/helyettunk'],
  ['a25_havi_valtozasok', A, '/havi-valtozasok'],
  ['a26_sablonok', A, '/sablonok'],
  ['a27_export', A, '/export'],
  ['a28_naplo', A, '/naplo'],
  ['a29_beallitasok', A, '/beallitasok'],
  ['a30_igazolasok', A, '/igazolasok'],
  ['c01_visszahivasok', CS, '/visszahivasok'],
  ['c02_vallalkozas_inditas', CS, '/vallalkozas-inditas'],
  ['c03_regisztracio', CS, '/vallalkozas-inditas/reg-levente'],
  ['c04_uzenetek', CS, '/uzenetek/c-levente'],
  ['c05_helyettunk_reszlet', CS, '/helyettunk/as-david'],
  ['k01_attekintes', AD, '/admin'],
  ['k02_ugyfelek', AD, '/admin/ugyfelek'],
  ['k03_elofizetesek', AD, '/admin/elofizetesek'],
  ['k04_fizetesek', AD, '/admin/fizetesek?szuro=mind'],
  ['k05_fizetesek_atutalas', AD, '/admin/fizetesek?szuro=atutalas'],
  ['k06_dijszamlak', AD, '/admin/dijszamlak'],
  ['k07_dijak', AD, '/admin/dijak'],
  ['k08_konyvelok', AD, '/admin/konyvelok'],
  ['k09_csapat', AD, '/admin/csapat'],
  ['k10_marketing', AD, '/admin/marketing'],
  ['k11_forrasok', AD, '/admin/forrasok'],
  ['k12_szovegek', AD, '/admin/szovegek'],
  ['k13_naplo', AD, '/admin/naplo'],
  ['k14_demo_posta', AD, '/admin/demo-postafiok'],
  ['k15_rendszer', AD, '/admin/rendszer'],
  ['k16_igazolasok', AD, '/igazolasok'],
  ['k20_konzol', AD, '/admin/konzol'],
  ['k21_konzol_ugyfelek', AD, '/admin/konzol/ugyfelek'],
  ['k22_konzol_ugyfelkartya', AD, '/admin/konzol/ugyfelek/cl-tr-2'],
];

// a lapon futó mérés
function meres() {
  const W = innerWidth;
  const parse = (c) => {
    const m = c && c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const arany = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hsl = ({ r, g, b }) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const s = mx === mn ? 0 : l > 0.5 ? (mx - mn) / (2 - mx - mn) : (mx - mn) / (mx + mn);
    return { s, l };
  };
  const nev = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.classList.length) s += '.' + [...el.classList].slice(0, 3).join('.');
    return s;
  };
  const ut = (el) => { const r = []; let e = el; for (let i = 0; e && i < 3; i++, e = e.parentElement) r.unshift(nev(e)); return r.join(' > '); };
  const szoveg = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const lathato = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0.05; };
  // tényleges háttér (rétegezve), gradiensnél az első szín
  const hatter = (el) => {
    const retegek = [];
    let e = el;
    let gradiens = false;
    while (e) {
      const cs = getComputedStyle(e);
      const bi = cs.backgroundImage;
      if (bi && bi !== 'none' && bi.includes('gradient')) {
        const m = bi.match(/rgba?\([^)]+\)/g);
        if (m) { retegek.push(parse(m[m.length - 1])); gradiens = true; break; }
      }
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { retegek.push(c); if (c.a >= 0.99) break; }
      e = e.parentElement;
    }
    let base = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = retegek.length - 1; i >= 0; i--) {
      const c = retegek[i];
      base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a), a: 1 };
    }
    return { c: base, gradiens };
  };
  const res = { vizszintes: document.documentElement.scrollWidth - W, magassag: document.documentElement.scrollHeight, levagott: [], kilogo: [], pasztell: [], kontraszt: [], nevtelen: [], kepHiba: [], szovegGond: [], emoji: [], ikon3d: [], betu: {}, tablak: [], toresek: [] };
  const all = [...document.querySelectorAll('body *')];
  const seen = new Set();
  for (const el of all) {
    if (!lathato(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    // levágott szöveg
    const ox = cs.overflowX, tov = cs.textOverflow;
    if (el.clientWidth > 2 && (ox === 'hidden' || ox === 'clip' || tov === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && szoveg(el) && !['svg', 'path'].includes(el.tagName.toLowerCase())) {
      res.levagott.push({ el: ut(el), szoveg: szoveg(el), sw: el.scrollWidth, cw: el.clientWidth });
    }
    const oy = cs.overflowY;
    if ((oy === 'hidden' || oy === 'clip') && el.scrollHeight > el.clientHeight + 2 && szoveg(el) && el.clientHeight > 2 && el.clientWidth > 2 && cs.webkitLineClamp === 'none') {
      res.levagott.push({ el: ut(el), szoveg: szoveg(el), sh: el.scrollHeight, ch: el.clientHeight, fuggoleges: true });
    }
    // képernyőn kívülre lógó elem
    if (r.right > W + 1 && r.width < W * 2 && cs.position !== 'fixed') res.kilogo.push({ el: ut(el), right: Math.round(r.right), szoveg: szoveg(el) });
    // nagy halvány pasztell doboz
    if (r.width >= 220 && r.height >= 70 && !el.classList.contains('keret')) {
      const c = parse(cs.backgroundColor);
      let jel = null;
      if (c && c.a > 0) {
        const h = hsl(c);
        const effL = c.a < 1 ? 1 - (1 - h.l) * c.a : h.l;
        if (effL > 0.84 && effL < 0.995 && h.s > 0.2) jel = { szin: cs.backgroundColor };
      }
      const bi = cs.backgroundImage;
      if (bi && bi.includes('gradient')) {
        const m = bi.match(/rgba?\([^)]+\)/g) || [];
        const pas = m.map(parse).filter((x) => x && (() => { const h = hsl(x); const eL = x.a < 1 ? 1 - (1 - h.l) * x.a : h.l; return eL > 0.84 && eL < 0.995 && h.s > 0.2; })());
        if (pas.length) jel = { gradiens: bi.slice(0, 120) };
      }
      if (jel) res.pasztell.push({ el: ut(el), w: Math.round(r.width), h: Math.round(r.height), ...jel, szoveg: szoveg(el).slice(0, 50) });
    }
    // névtelen ikon-gomb / link
    if ((el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') && !szoveg(el) && !el.getAttribute('aria-label') && !el.getAttribute('title') && !el.querySelector('img[alt]:not([alt=""])') && !el.getAttribute('aria-labelledby')) {
      res.nevtelen.push(ut(el));
    }
    if (el.tagName === 'IMG') {
      if (!el.complete || el.naturalWidth === 0) res.kepHiba.push({ src: el.getAttribute('src'), el: ut(el) });
      if (!el.hasAttribute('alt')) res.kepHiba.push({ src: el.getAttribute('src'), nincsAlt: true });
      const src = el.getAttribute('src') || '';
      if (/ikon3d|3d\//i.test(src)) res.ikon3d.push(src);
    }
    if (el.tagName === 'TABLE') {
      const p = el.parentElement;
      res.tablak.push({ el: ut(el), w: Math.round(r.width), szulo: Math.round(p.getBoundingClientRect().width), gorget: p.scrollWidth > p.clientWidth + 1, sorok: el.rows.length });
    }
  }
  // szöveg-csomópontok: kontraszt, betűtípus, emoji, tiltott szövegek
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = tw.nextNode())) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || !lathato(el)) continue;
    const cs = getComputedStyle(el);
    if (el.closest('.sr-only, .rejtett, [aria-hidden="true"]') && cs.position === 'absolute' && el.getBoundingClientRect().width <= 1) continue;
    const fam = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim();
    res.betu[fam] = (res.betu[fam] || 0) + 1;
    if (/\p{Extended_Pictographic}/u.test(t)) res.emoji.push({ el: ut(el), t: t.slice(0, 60) });
    const fg = parse(cs.color);
    if (fg && !seen.has(el)) {
      seen.add(el);
      const { c: bg, gradiens } = hatter(el);
      const fgEff = fg.a < 1 ? { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) } : fg;
      const k = arany(fgEff, bg);
      const px = parseFloat(cs.fontSize), w = Number(cs.fontWeight);
      const nagy = px >= 24 || (px >= 18.66 && w >= 700);
      const min = nagy ? 3 : 4.5;
      if (k < min && !el.closest('[disabled], [aria-disabled="true"]')) res.kontraszt.push({ el: ut(el), t: t.slice(0, 50), arany: Math.round(k * 100) / 100, fg: cs.color, bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`, gradiens, px });
    }
    if (/\ba\(z\)|\baz?\s*\(z\)/i.test(t)) res.szovegGond.push({ tipus: 'a(z)', t: t.slice(0, 100) });
    if (/\b(AI|MI-alapú|mesterséges intelligencia|ChatGPT|Claude|GPT)\b/.test(t)) res.szovegGond.push({ tipus: 'AI', t: t.slice(0, 100) });
    if (/(perc(en)? (múlva|belül)|órán belül|napon belül|pár nap|pár perc|hamarosan|azonnal|egy perc)/i.test(t) && !t.includes('24–48 órán belül visszahív')) res.szovegGond.push({ tipus: 'idő', t: t.slice(0, 120) });
    // törés a szavak közepén (break-all / anywhere)
    if (cs.wordBreak === 'break-all' || cs.overflowWrap === 'anywhere') {
      const rr = el.getBoundingClientRect();
      const lh = parseFloat(cs.lineHeight) || px * 1.3;
      if (rr.height > lh * 1.6 && /\S{8,}/.test(t)) res.toresek.push({ el: ut(el), t: t.slice(0, 60), wb: cs.wordBreak, ow: cs.overflowWrap });
    }
  }
  // a fő tartalom szélessége és helye
  const main = document.querySelector('main') || document.querySelector('.tartalom');
  if (main) { const r = main.getBoundingClientRect(); res.main = { left: Math.round(r.left), width: Math.round(r.width) }; }
  res.cim = document.title;
  res.h1 = [...document.querySelectorAll('h1')].map((h) => szoveg(h));
  return res;
}

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', '--lang=hu-HU'],
  protocolTimeout: 180000,
});
const eredmeny = {};
for (const SZEL of SZELEK) {
  for (const [nev, role, path] of SHOTS) {
    if (filter && !filter.split(',').some((f) => nev.includes(f))) continue;
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    await page.setViewport({ width: SZEL, height: 900, deviceScaleFactor: 1 });
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(String(e).slice(0, 200)));
    page.on('console', (m) => m.type() === 'error' && hibak.push(m.text().slice(0, 200)));
    page.on('requestfailed', (r) => hibak.push('kérés: ' + r.url()));
    try {
      const sep = path.includes('?') ? '&' : '?';
      await page.goto(`${BASE}${path}${sep}mock_role=${role}`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 20000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
      await varj(500);
      const m = await page.evaluate(meres);
      m.url = page.url().replace(BASE, '');
      m.hibak = hibak;
      eredmeny[`${nev}_${SZEL}`] = m;
      const fajl = `${out}/${nev}_${SZEL}.png`;
      await page.screenshot({ path: fajl });
      // hosszú oldal: szeletek a viewport alatt (900 px-enként, max 5)
      const H = m.magassag;
      if (H > 960) {
        for (let i = 1, y = 900; y < H && i <= 5; i++, y += 900) {
          await page.evaluate((y) => window.scrollTo(0, y), y);
          await varj(250);
          await page.screenshot({ path: `${out}/${nev}_${SZEL}_s${i}.png` });
        }
        await page.evaluate(() => window.scrollTo(0, 0));
      }
      console.log('ok', nev, SZEL, 'H', H);
    } catch (e) {
      eredmeny[`${nev}_${SZEL}`] = { hiba: e.message, hibak };
      console.log('HIBA', nev, SZEL, e.message);
    } finally {
      await ctx.close().catch(() => {});
    }
  }
}
await browser.close();
server.close();
writeFileSync(`${out}/_meres${filter ? '_' + filter.replace(/[^a-z0-9]/gi, '') : ''}.json`, JSON.stringify(eredmeny, null, 1));
console.log('kész', Object.keys(eredmeny).length);
