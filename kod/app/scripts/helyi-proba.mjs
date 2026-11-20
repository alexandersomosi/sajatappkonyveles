#!/usr/bin/env node
// Helyi integrációs próba: a VALÓDI backend (kod/backend/dist, DEMO mód, PGlite memóriában, demo seed) és az app éles
// webes exportja (dist/) egy szerveren, ugyanazon a hoston (/api/v1 → backend), mint a Caddy mögött élesben.
// Csak gépen belül: 127.0.0.1:8791. Előtte: kod/backend `npm run build`, itt `npm run export:web`.
// A seed jelszavai egy ideiglenes fájlba kerülnek (a konzolra nem írjuk ki).
import { createServer } from 'node:http';
import { mkdtempSync, existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { mediaKiszolgal } from './media-kiszolgalo.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = resolve(app, '../backend');
// BACKEND_KOD: egy másik mappában fordított backend (dist/ + drizzle/ + node_modules), hogy a backend saját dist/-jét
// ne írjuk felül, amíg ott más dolgozik. Alapból a kod/backend.
const backendKod = resolve(process.env.BACKEND_KOD || backend);
// APP_DIST: egy másik mappába exportált webes build (a párhuzamos munkák ne írják felül egymás dist/-jét)
const gyoker = resolve(process.env.APP_DIST || join(app, 'dist'));
const PORT = Number(process.env.PORT || 8791);
if (!existsSync(join(backendKod, 'dist/app.js'))) throw new Error('Előbb: kod/backend npm run build');
if (!existsSync(join(gyoker, 'index.html'))) throw new Error('Előbb: npm run export:web');

const k = () => randomBytes(32).toString('base64');
const munka = mkdtempSync(join(tmpdir(), 'kj-helyi-'));
Object.assign(process.env, {
  APP_ENV: 'demo', NODE_ENV: 'production', LOG_LEVEL: 'warn',
  JWT_SECRET: k(), CODE_HMAC_SECRET: k(), FILE_LINK_SECRET: k(), AUDIT_IP_SALT: k(),
  FILE_ENC_KEY: k(), APP_DATA_KEY: k(), NAV_CRED_KEY: k(), SIMPLEPAY_DEMO_SECRET: randomBytes(24).toString('hex'),
  FILES_DIR: join(munka, 'files'), LEGAL_DIR: resolve(app, '../jogi'), FONT_DIR: join(backend, 'fonts'),
  APP_PUBLIC_URL: `http://127.0.0.1:${PORT}`, API_PUBLIC_URL: `http://127.0.0.1:${PORT}`, PANEL_PUBLIC_URL: `http://127.0.0.1:${PORT}`,
});
process.chdir(backend);
const imp = (p) => import(pathToFileURL(join(backendKod, p)).href);
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
const cred = join(munka, 'demo_belepesek.txt');
console.log('seed:', await seedDemo(deps, clock, { credentialsFile: cred }));
// SPEC §26.13: a 11-18-as demó kiegészítés (Nagy Anna, Tóth Levente, Fehér Zsófia, visszahívások), ha a backend már tudja.
try {
  const { seedTulaj1118 } = await imp('dist/seed/tulaj1118.js');
  await deps.content?.reload?.();
  const r = await seedTulaj1118(deps, { credentialsFile: cred });
  console.log('seed 11-18:', r.status);
} catch (e) {
  console.log('seed 11-18 kimaradt:', e.message);
}
// SPEC §27.7.4: a 11-19-es demó kiegészítés (Kiss Marika, Molnár Dávid, Balogh Ilona), ha a backend már tudja.
try {
  const { seedTulaj1119 } = await imp('dist/seed/tulaj1119.js');
  const r = await seedTulaj1119(deps, { credentialsFile: cred });
  console.log('seed 11-19:', r?.status ?? 'kész');
} catch (e) {
  console.log('seed 11-19 kimaradt:', e.message);
}
// SPEC §28.11 + §28.K.21: a k6 demó-személyek (Eszter, Bálint, Ádám, Gréta, Norbert, Ilona, Tamás, Csilla), ha a backend
// már tudja (B1: dist/seed/ot1119.js, dist/seed/k28.js). Csak új, kitalált ügyfeleket ad hozzá.
for (const [fajl, fv, nev] of [['dist/seed/ot1119.js', 'seedOt1119', 'ot1119'], ['dist/seed/k28.js', 'seedK28', 'k28']]) {
  try {
    const m = await imp(fajl);
    const r = await m[fv](deps, { credentialsFile: cred });
    console.log(`seed ${nev}:`, r?.status ?? 'kész');
  } catch (e) {
    console.log(`seed ${nev} kimaradt:`, e.message);
  }
}
console.log('demo belépések (helyi, ideiglenes):', cred);

const tipus = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };
createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  // Csak ebben a helyi próbában: /__helyi/belep?ki=kata → a szerver belép a seed-felhasználóval (web módban),
  // a frissítő sütit a böngészőnek adja, és a főoldalra irányít. Így a képernyőképekhez nem kell jelszót gépelni.
  if (url.pathname === '/__helyi/belep') {
    const { readFileSync } = await import('node:fs');
    const ki = url.searchParams.get('ki') || 'kata';
    const sor = readFileSync(cred, 'utf8').split('\n').find((s) => s.includes(`;${ki}.`));
    if (!sor) return void res.writeHead(404).end('nincs ilyen demo felhasználó');
    const [, email, password] = sor.trim().split(';');
    const r = await api.fetch(new Request(`http://127.0.0.1:${PORT}/api/v1/auth/login`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
      body: JSON.stringify({ email, password, clientKind: 'web' }),
    }));
    res.writeHead(302, { location: url.searchParams.get('ide') || '/', 'set-cookie': r.headers.getSetCookie?.() ?? [] });
    return void res.end();
  }
  // SPEC §26.7.1: a videók és az útmutató-képek a kod/media mappából, mint élesben a Caddy /media/ útvonala.
  if (await mediaKiszolgal(req, res, process.env.MEDIA_DIR || resolve(app, '../media'))) return;
  if (url.pathname.startsWith('/api/')) {
    const darabok = [];
    for await (const d of req) darabok.push(d);
    const fej = new Headers();
    for (const [n, v] of Object.entries(req.headers)) if (v !== undefined) fej.set(n, Array.isArray(v) ? v.join(', ') : v);
    fej.set('x-forwarded-for', '127.0.0.1');
    const r = await api.fetch(new Request(url, { method: req.method, headers: fej, body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(darabok) }));
    const ki = {};
    r.headers.forEach((v, n) => {
      if (n !== 'set-cookie') ki[n] = v;
    });
    const sutik = r.headers.getSetCookie?.() ?? [];
    if (sutik.length) ki['set-cookie'] = sutik;
    res.writeHead(r.status, ki);
    res.end(Buffer.from(await r.arrayBuffer()));
    return;
  }
  let fajl = normalize(join(gyoker, decodeURIComponent(url.pathname)));
  if (!fajl.startsWith(gyoker)) return void res.writeHead(403).end();
  try {
    if ((await stat(fajl)).isDirectory()) fajl = join(fajl, 'index.html');
  } catch {
    fajl = extname(url.pathname) ? fajl : join(gyoker, 'index.html');
  }
  try {
    const adat = await readFile(fajl);
    res.writeHead(200, { 'Content-Type': tipus[extname(fajl)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(adat);
  } catch {
    res.writeHead(404).end('nincs ilyen');
  }
}).listen(PORT, '127.0.0.1', () => console.log(`helyi próba: http://127.0.0.1:${PORT}`));
