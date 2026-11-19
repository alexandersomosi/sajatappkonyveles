#!/usr/bin/env node
// Integration check of the REAL panel build (dist/) against the REAL backend (kod/backend/dist, DEMO mode,
// PGlite in memory, demo seed), served same-origin on 127.0.0.1:8792 exactly like Caddy does in production.
// For every panel page: screenshot 1440×900 into _kepek/eles_backend/, plus every console error and every
// /api/v1 answer with status >= 400 (the contract mismatches). Seed passwords go to a temp file, never printed.
// Before: kod/backend `npm run build`, here `npm run build`.   Usage: node scripts/eles-proba.mjs [filter]
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import puppeteer from 'puppeteer-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(root, '../backend');
const dist = join(root, 'dist');
const out = join(root, '_kepek', 'eles_backend');
const PORT = Number(process.env.PORT || 8792);
const BASE = `http://127.0.0.1:${PORT}`;
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const filter = process.argv[2] || '';
if (!existsSync(join(backend, 'dist/app.js'))) throw new Error('Előbb: kod/backend npm run build');
if (!existsSync(join(dist, 'index.html'))) throw new Error('Előbb: npm run build');
mkdirSync(out, { recursive: true });

const k = () => randomBytes(32).toString('base64');
const work = mkdtempSync(join(tmpdir(), 'kj-panel-'));
Object.assign(process.env, {
  APP_ENV: 'demo', NODE_ENV: 'production', LOG_LEVEL: 'warn',
  // Local harness only: the seeded staff have no TOTP yet (the mandatory-2FA flow has its own screenshot, 31_*).
  STAFF_TOTP_REQUIRED: process.env.STAFF_TOTP_REQUIRED ?? 'false',
  JWT_SECRET: k(), CODE_HMAC_SECRET: k(), FILE_LINK_SECRET: k(), AUDIT_IP_SALT: k(),
  FILE_ENC_KEY: k(), APP_DATA_KEY: k(), NAV_CRED_KEY: k(), SIMPLEPAY_DEMO_SECRET: randomBytes(24).toString('hex'),
  FILES_DIR: join(work, 'files'), LEGAL_DIR: resolve(root, '../jogi'), FONT_DIR: join(backend, 'fonts'),
  APP_PUBLIC_URL: BASE, API_PUBLIC_URL: BASE, PANEL_PUBLIC_URL: BASE,
});
process.chdir(backend);
const imp = (p) => import(pathToFileURL(join(backend, p)).href);
const { loadConfig } = await imp('dist/config.js');
const { openPglite } = await imp('dist/db/client.js');
const { buildDeps } = await imp('dist/deps.js');
const { createApp } = await imp('dist/app.js');
const { makeClock, seedDemo } = await imp('dist/seed/demo.js');
const cfg = loadConfig();
const h = await openPglite();
await h.migrate();
const clock = makeClock();
const deps = buildDeps(cfg, h.db, { now: clock.now, dispatchInline: true });
await deps.legal.load(h.db);
const api = createApp(deps);
const cred = join(work, 'demo_belepesek.txt');
console.log('seed:', await seedDemo(deps, clock, { credentialsFile: cred }));
// SPEC §26.13 demo addition (Nagy Anna = csapat, Tóth Levente, Fehér Zsófia, 4 callbacks) when the backend has it.
if (existsSync(join(backend, 'dist/seed/tulaj1118.js'))) {
  const { seedTulaj1118 } = await imp('dist/seed/tulaj1118.js');
  console.log('seed tulaj1118:', await seedTulaj1118(deps, { credentialsFile: cred }));
}
const lines = readFileSync(cred, 'utf8').split('\n').filter((s) => s && !s.startsWith('#'));
const account = (role) => {
  const [, email, password] = lines.find((s) => s.startsWith(`${role};`)).trim().split(';');
  return { email, password };
};

// Every screenshot logs in once; a distinct test IP per login keeps the real login rate limit (10 / 15 min
// per IP+e-mail) out of the way. The limit itself is covered by the backend tests.
let loginNo = 0;
async function apiLogin(role) {
  loginNo++;
  const r = await api.fetch(new Request(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.${loginNo >> 8}.${loginNo & 255}` },
    body: JSON.stringify({ ...account(role), clientKind: 'panel' }),
  }));
  return r;
}

// Client ids by family name (routes use real uuids).
const loginRes = await apiLogin('konyvelo');
const { accessToken } = await loginRes.json();
const list = await (await api.fetch(new Request(`${BASE}/api/v1/acc/clients`, { headers: { authorization: `Bearer ${accessToken}`, 'x-forwarded-for': '127.0.0.1' } }))).json();
const id = {};
for (const c of list.items ?? []) id[(c.lastName || c.name || '').toLowerCase().includes('szab') ? 'kata' : (c.name || '').includes('Varga') ? 'reka' : (c.name || '').includes('Németh') ? 'peter' : c.id] = c.id;
console.log('ügyfelek:', Object.keys(id).join(', '));
// §26 ids (registration and callback of Tóth Levente, Réka's callback) as the service team sees them.
const ids26 = {};
if (lines.some((s) => s.startsWith('csapat;'))) {
  const { accessToken: t2 } = await (await apiLogin('csapat')).json();
  const get = async (p) => (await api.fetch(new Request(`${BASE}/api/v1${p}`, { headers: { authorization: `Bearer ${t2}`, 'x-forwarded-for': '127.0.0.1' } }))).json();
  for (const r of (await get('/team/registrations?status=mind')).items ?? []) if (r.client.name.includes('Levente')) Object.assign(ids26, { reg: r.id, levente: r.client.id });
  for (const r of (await get('/team/callbacks?filter=mind')).items ?? []) {
    if (r.client.name.includes('Levente')) ids26.cbLevente = r.id;
    if (r.client.name.includes('Réka')) ids26.cbReka = r.id;
  }
  console.log('§26:', Object.keys(ids26).join(', '));
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', BASE);
  if (url.pathname === '/__helyi/belep') {
    if (url.searchParams.get('ki') === 'none') return void res.writeHead(302, { location: url.searchParams.get('ide') || '/' }).end();
    const r = await apiLogin(url.searchParams.get('ki') || 'konyvelo');
    res.writeHead(302, { location: url.searchParams.get('ide') || '/', 'set-cookie': r.headers.getSetCookie?.() ?? [] });
    return void res.end();
  }
  if (url.pathname.startsWith('/api/')) {
    const parts = [];
    for await (const d of req) parts.push(d);
    const hd = new Headers();
    for (const [n, v] of Object.entries(req.headers)) if (v !== undefined) hd.set(n, Array.isArray(v) ? v.join(', ') : v);
    hd.set('x-forwarded-for', '127.0.0.1');
    const r = await api.fetch(new Request(url, { method: req.method, headers: hd, body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(parts) }));
    const o = {};
    r.headers.forEach((v, n) => {
      if (n !== 'set-cookie') o[n] = v;
    });
    const ck = r.headers.getSetCookie?.() ?? [];
    if (ck.length) o['set-cookie'] = ck;
    res.writeHead(r.status, o);
    return void res.end(Buffer.from(await r.arrayBuffer()));
  }
  let p = join(dist, decodeURIComponent(url.pathname));
  if (!p.startsWith(dist) || !existsSync(p) || statSync(p).isDirectory()) p = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const tmpBase = join(work, 'udd').replace(/\\/g, '/');
mkdirSync(tmpBase, { recursive: true });
const samplePdf = join(work, 'minta_kivonat_oktober.pdf').replace(/\\/g, '/');
writeFileSync(samplePdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clickText = (text, sel = 'button, a, label, tr, [role=button]') => async (page) => {
  await page.evaluate(
    (t, s) => {
      const el = [...document.querySelectorAll(s)].find((e) => e.textContent && e.textContent.replace(/\s+/g, ' ').trim().includes(t));
      if (!el) throw new Error('nincs ilyen elem: ' + t);
      el.scrollIntoView({ block: 'center' });
      el.click();
    },
    text,
    sel,
  );
  await wait(700);
};
const upload = (sel, files) => async (page) => {
  const el = await page.$(sel);
  await el.uploadFile(...files);
  await wait(900);
};

const A = 'konyvelo';
const AD = 'admin';
const K = id.kata, R = id.reka, P = id.peter;
const SHOTS = [
  ['01_belepes', 'none', '/belepes'],
  ['02_ugyfelek', A, '/ugyfelek'],
  ['03_ugyfelek_hianyzik_valami', A, '/ugyfelek?szuro=hianyzik_valami'],
  ['04_kata_attekintes', A, `/ugyfelek/${K}`, [], true],
  ['05_peter_bekotes', A, `/ugyfelek/${P}/bekotes`, [], true],
  ['06_peter_azonositas', A, `/ugyfelek/${P}/bekotes`, [clickText('Megnézem')]],
  ['07_kata_dosszie_oktober', A, `/ugyfelek/${K}/dosszie?ev=2026&honap=2026-10`, [], true],
  ['08_kata_irat_reszlet', A, `/ugyfelek/${K}/dosszie?ev=2026&honap=2026-10`, [clickText('Nyugta', 'tr')]],
  ['09_kata_feltoltes', A, `/ugyfelek/${K}/dosszie?ev=2026&honap=2026-11`, [upload('.ejtozona input[type=file]', [samplePdf])]],
  ['10_kata_nav_szamlak', A, `/ugyfelek/${K}/nav`],
  ['11_kata_nav_szamla_reszlet', A, `/ugyfelek/${K}/nav`, [clickText('KSZ-2026-031', 'tr')]],
  ['12_kata_bevetelek', A, `/ugyfelek/${K}/bevetelek`, [], true],
  ['13_kata_ado_iv_negyedev', A, `/ugyfelek/${K}/ado?idoszak=2026-Q4`, [], true],
  ['14_kata_ado_jovahagyas_kerdes', A, `/ugyfelek/${K}/ado?idoszak=2026-Q4`, [clickText('Jóváhagyom és elküldöm')]],
  ['15_kata_ado_jovahagyva', A, `/ugyfelek/${K}/ado?idoszak=2026-Q4`, [clickText('Jóváhagyom és elküldöm'), clickText('Igen, jóváhagyom és elküldöm')], true],
  ['16_kata_ado_iii_beadva', A, `/ugyfelek/${K}/ado?idoszak=2026-Q3`, [], true],
  ['17_reka_ado', A, `/ugyfelek/${R}/ado`, [], true],
  ['18_kata_uzenetek', A, `/ugyfelek/${K}/uzenetek`],
  ['19_kata_keresek', A, `/ugyfelek/${K}/keresek`],
  ['21_kata_naplo', A, `/ugyfelek/${K}/naplo`],
  ['22_reka_attekintes', A, `/ugyfelek/${R}`],
  ['23_hatarido_figyelo', A, '/hatarido-figyelo'],
  ['24_keresek_sor', A, '/keresek'],
  ['26_sablonok', A, '/sablonok'],
  ['27_idopontok_atiranyitas', A, '/idopontok'],
  ['28_export', A, '/export'],
  ['29_naplo', A, '/naplo'],
  ['30_beallitasok', A, '/beallitasok', [], true],
  ['40_admin_attekintes', AD, '/admin', [], true],
  ['41_admin_ugyfelek', AD, '/admin/ugyfelek'],
  ['42_admin_elofizetesek', AD, '/admin/elofizetesek'],
  ['43_admin_fizetesek', AD, '/admin/fizetesek'],
  ['44_admin_konyvelok', AD, '/admin/konyvelok'],
  ['46_admin_forrasok', AD, '/admin/forrasok', [], true],
  ['47_admin_szovegek', AD, '/admin/szovegek'],
  ['49_admin_naplo', AD, '/admin/naplo'],
  ['50_admin_demo_postafiok', AD, '/admin/demo-postafiok'],
  ['51_admin_rendszer', AD, '/admin/rendszer'],
  // SPEC §26 against the real backend (only when the tulaj1118 demo addition exists)
  ...(ids26.reg
    ? [
        ['k3_01_csapat_visszahivasok', 'csapat', '/visszahivasok'],
        ['k3_02_csapat_visszahivas_magamra', 'csapat', `/visszahivasok?nyit=${ids26.cbLevente}`, [clickText('Magamra veszem', '.fiok-lap button')]],
        ['k3_03_csapat_hivas_eredmenye', 'csapat', `/visszahivasok?nyit=${ids26.cbReka}`, [clickText('Hívás eredménye', '.fiok-lap button'), clickText('Beszéltünk', '.fiok-lap label')]],
        ['k3_06_csapat_vallalkozas_inditas', 'csapat', '/vallalkozas-inditas', [], true],
        ['k3_07_csapat_levente_ellenorzes', 'csapat', `/vallalkozas-inditas/${ids26.reg}`, [], true],
        ['k3_13_csapat_uzenetek', 'csapat', `/uzenetek/${ids26.levente}`],
        ['k3_14_csapat_beallitasok', 'csapat', '/beallitasok'],
        ['k3_15_csapat_tiltott_ugyfelek', 'csapat', '/ugyfelek'],
        ['k3_20_admin_attekintes', AD, '/admin', [], true],
        ['k3_21_admin_csapat', AD, '/admin/csapat'],
        ['k3_23_admin_visszahivasok', AD, '/visszahivasok?szuro=mind'],
        ['k3_24_admin_vallalkozas_inditas', AD, '/vallalkozas-inditas'],
        ['k3_30_konyvelo_visszahivasok', A, '/visszahivasok'],
        ['k3_32_peter_visszahivasok_ful', A, `/ugyfelek/${P}/visszahivasok`],
        ['k3_33_levente_bekotes', A, `/ugyfelek/${ids26.levente}/bekotes`, [], true],
        ['k3_35_ugyfelek_bekotes_alatt', A, '/ugyfelek?szuro=bekotes_alatt'],
      ]
    : []),
];

let n = 0;
const fails = [];
for (const [name, role, path, steps = [], full = false] of SHOTS) {
  if (filter && !name.includes(filter)) continue;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true, userDataDir: `${tmpBase}/udd_${name}_${Date.now()}`,
    args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', '--lang=hu-HU'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 }, protocolTimeout: 60000,
  });
  const watchdog = setTimeout(() => {
    fails.push(`${name}: időtúllépés (90 s)`);
    browser.process()?.kill('SIGKILL');
  }, 90000);
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 300)}`));
    page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(`console ${m.text().slice(0, 300)}`));
    page.on('response', async (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/api/') && r.status() >= 400 && !(u.pathname === '/api/v1/auth/refresh' && r.status() === 401)) {
        let body = '';
        try {
          body = (await r.text()).slice(0, 200);
        } catch {}
        errors.push(`API ${r.request().method()} ${u.pathname}${u.search} → ${r.status()} ${body}`);
      }
    });
    await page.goto(`${BASE}/__helyi/belep?ki=${role}&ide=${encodeURIComponent(path)}`, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
    await wait(400);
    for (const s of steps) await s(page);
    await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await wait(300);
    await page.screenshot({ path: join(out, `${name}.png`).replace(/\\/g, '/') });
    if (full) await page.screenshot({ path: join(out, `${name}_teljes.png`).replace(/\\/g, '/'), fullPage: true });
    const visibleError = await page.evaluate(() => [...document.querySelectorAll('.uzenet-sav.hiba, .hiba-szoveg, [role=alert]')].map((e) => e.textContent?.trim()).filter(Boolean).join(' | '));
    if (visibleError) errors.push(`látható hiba: ${visibleError.slice(0, 300)}`);
    if (errors.length) fails.push(`${name}:\n   ${[...new Set(errors)].join('\n   ')}`);
    n++;
    console.log(errors.length ? 'HIBÁS' : 'ok', name);
  } catch (e) {
    fails.push(`${name}: ${e.message}`);
    console.log('HIBA', name, e.message);
  } finally {
    clearTimeout(watchdog);
    await browser.close().catch(() => {});
  }
}
server.close();
await h.close?.();
console.log(`${n} kép: ${out}`);
if (fails.length) {
  console.log('Hibák:\n' + fails.join('\n'));
  process.exitCode = 1;
}
process.exit();
