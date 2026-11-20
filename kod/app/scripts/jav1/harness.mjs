// Round-1 fixer: local harness. ONE in-memory backend (PGlite, DEMO mode, demo seed + 11-18 addition) from a SNAPSHOT
// of the compiled backend, the app's production web export and the panel's production build on two local ports.
// Only on 127.0.0.1. No password is ever printed; logins go through /__helyi/belep.
//   BACKEND_KOD=<snapshot> APP_PORT=8841 PANEL_PORT=8842 node harness.mjs
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';

const KOD = 'C:/Users/UpgradePC/konyvelo_app/kod';
const backend = join(KOD, 'backend');
const backendKod = process.env.BACKEND_KOD || backend;
const appDist = join(KOD, 'app', process.env.APP_DIST || 'dist');
const panelDist = join(KOD, 'panel', process.env.PANEL_DIST || 'dist');
const mediaDir = join(KOD, 'media');
const breq = createRequire(join(backend, 'package.json'));
const { sql } = await import(pathToFileURL(breq.resolve('drizzle-orm')).href);
const { mediaKiszolgal } = await import(pathToFileURL(join(KOD, 'app', 'scripts', 'media-kiszolgalo.mjs')).href);
const APP_PORT = Number(process.env.APP_PORT || 8841);
const PANEL_PORT = Number(process.env.PANEL_PORT || 8842);
const APP = `http://127.0.0.1:${APP_PORT}`;
const PANEL = `http://127.0.0.1:${PANEL_PORT}`;

const k = () => randomBytes(32).toString('base64');
const munka = mkdtempSync(join(tmpdir(), 'kj-jav1-'));
Object.assign(process.env, {
  APP_ENV: 'demo', NODE_ENV: 'production', LOG_LEVEL: 'warn', STAFF_TOTP_REQUIRED: 'false',
  JWT_SECRET: k(), CODE_HMAC_SECRET: k(), FILE_LINK_SECRET: k(), AUDIT_IP_SALT: k(),
  FILE_ENC_KEY: k(), APP_DATA_KEY: k(), NAV_CRED_KEY: k(), SIMPLEPAY_DEMO_SECRET: randomBytes(24).toString('hex'),
  FILES_DIR: join(munka, 'files'), LEGAL_DIR: join(KOD, 'jogi'), FONT_DIR: join(backend, 'fonts'),
  APP_PUBLIC_URL: APP, API_PUBLIC_URL: APP, PANEL_PUBLIC_URL: PANEL,
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
let eltolasMs = 0; // /__helyi/ido?perc=N moves the server clock forward
const clock = makeClock(() => new Date(Date.now() + eltolasMs));
const deps = buildDeps(cfg, h.db, { now: clock.now, dispatchInline: true });
await deps.legal.load(h.db);
const api = createApp(deps);
const cred = join(munka, 'demo_belepesek.txt');
console.log('seed:', JSON.stringify(await seedDemo(deps, clock, { credentialsFile: cred })).slice(0, 200));
try {
  await deps.content?.reload?.();
  const { runDataStepTulaj1118 } = await imp('dist/services/datastep.js');
  console.log('adatlépés:', JSON.stringify(await runDataStepTulaj1118(deps)));
  const { seedTulaj1118 } = await imp('dist/seed/tulaj1118.js');
  console.log('seed 11-18:', (await seedTulaj1118(deps, { credentialsFile: cred })).status);
} catch (e) {
  console.log('11-18 kiegészítés kimaradt:', e.message);
}
const sorok = () => readFileSync(cred, 'utf8').split('\n').filter((s) => s && !s.startsWith('#'));
const ujak = new Map();
function fiok(ki) {
  if (ki.includes('@')) return ujak.has(ki) ? { email: ki, password: ujak.get(ki) } : null;
  const s = sorok().find((x) => x.startsWith(`${ki};`)) ?? sorok().find((x) => x.includes(`;${ki}.`));
  if (!s) return null;
  const [, email, password] = s.trim().split(';');
  return { email, password };
}
let ipN = 0;
async function hiv(base, method, path, { token, body } = {}) {
  const hd = { 'x-forwarded-for': `10.78.${(++ipN >> 8) & 255}.${ipN & 255}` };
  if (token) hd.authorization = `Bearer ${token}`;
  if (body !== undefined) hd['content-type'] = 'application/json';
  if (token && method !== 'GET') hd['x-kezjegy'] = '1';
  return api.fetch(new Request(`${base}/api/v1${path}`, { method, headers: hd, body: body !== undefined ? JSON.stringify(body) : undefined }));
}
async function belepAPI(base, ki, kind) {
  const f = fiok(ki);
  if (!f) throw new Error(`nincs ilyen fiók: ${ki}`);
  return hiv(base, 'POST', '/auth/login', { body: { ...f, clientKind: kind } });
}
async function token(ki) {
  const r = await belepAPI(APP, ki, 'native');
  const j = await r.json();
  if (!j.accessToken) throw new Error(`belépés: ${ki} → ${r.status}`);
  return j.accessToken;
}
async function ujUgyfel(email, lastName, firstName) {
  const password = `Pr0ba-${randomBytes(12).toString('base64url')}`;
  const r = await hiv(APP, 'POST', '/auth/register', { body: { email, password, firstName, lastName, platform: 'android' } });
  const j = await r.json();
  // k7b (S16): the sign-up answers 202 without a session; the code from the mail opens it
  if (r.status !== 202) throw new Error(`regisztráció ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  const sor = (await h.db.execute(sql`select body_text from demo_outbox where template = 'auth_email_code' order by created_at desc limit 1`)).rows[0];
  const kod = String(sor?.body_text ?? '').match(/\b(\d{6})\b/)?.[1];
  const v = await hiv(APP, 'POST', '/auth/register/verify', { body: { email, code: kod, platform: 'android' } });
  if (v.status !== 201) throw new Error(`e-mail-kód ${v.status}`);
  ujak.set(email, password);
}

const TIPUS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon' };
function szerver(base, dist, kind, media) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', base);
      const q = url.searchParams;
      if (url.pathname === '/__helyi/belep') {
        const r = await belepAPI(base, q.get('ki') || 'kata', kind);
        res.writeHead(302, { location: q.get('ide') || '/', 'set-cookie': r.headers.getSetCookie?.() ?? [] });
        return void res.end();
      }
      if (url.pathname === '/__helyi/uj') {
        // a fresh client (random in-memory password), then signed in
        const email = q.get('email');
        if (!ujak.has(email)) await ujUgyfel(email, q.get('vezetek') || 'Próba', q.get('kereszt') || 'Panna');
        const r = await belepAPI(base, email, kind);
        res.writeHead(302, { location: q.get('ide') || '/', 'set-cookie': r.headers.getSetCookie?.() ?? [] });
        return void res.end();
      }
      if (url.pathname === '/__helyi/ido') {
        eltolasMs += Number(q.get('perc') || 0) * 60_000;
        res.writeHead(200, { 'content-type': 'application/json' });
        return void res.end(JSON.stringify({ eltolasPerc: eltolasMs / 60000 }));
      }
      if (url.pathname === '/__helyi/api') {
        // an API call in the name of a seed/test user (test set-up only): ?ki=kata&m=POST&p=/client/…&b={json}
        const t = await token(q.get('ki'));
        const r = await hiv(APP, q.get('m') || 'GET', q.get('p'), { token: t, body: q.get('b') ? JSON.parse(q.get('b')) : undefined });
        res.writeHead(r.status, { 'content-type': 'application/json' });
        return void res.end(await r.text());
      }
      if (url.pathname === '/__helyi/jelszo') {
        // the TEST password of a seed/test account, for the local browser script only (typed into our own local app)
        const f = fiok(q.get('ki'));
        res.writeHead(f ? 200 : 404, { 'content-type': 'text/plain' });
        return void res.end(f ? f.password : '');
      }
      if (url.pathname === '/__helyi/sql') {
        const r = await h.db.execute(sql.raw(q.get('q')));
        res.writeHead(200, { 'content-type': 'application/json' });
        return void res.end(JSON.stringify(r.rows));
      }
      if (media && (await mediaKiszolgal(req, res, mediaDir))) return;
      if (url.pathname.startsWith('/api/')) {
        const d = [];
        for await (const x of req) d.push(x);
        const hd = new Headers();
        for (const [n, v] of Object.entries(req.headers)) if (v !== undefined) hd.set(n, Array.isArray(v) ? v.join(', ') : v);
        hd.set('x-forwarded-for', '127.0.0.1');
        const r = await api.fetch(new Request(url, { method: req.method, headers: hd, body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(d) }));
        const o = {};
        r.headers.forEach((v, n) => { if (n !== 'set-cookie') o[n] = v; });
        const ck = r.headers.getSetCookie?.() ?? [];
        if (ck.length) o['set-cookie'] = ck;
        res.writeHead(r.status, o);
        return void res.end(Buffer.from(await r.arrayBuffer()));
      }
      let p = join(dist, decodeURIComponent(url.pathname));
      if (!p.startsWith(dist) || !existsSync(p) || statSync(p).isDirectory()) p = extname(url.pathname) && !existsSync(p) ? null : join(dist, 'index.html');
      if (!p) return void res.writeHead(404).end('nincs');
      res.writeHead(200, { 'Content-Type': TIPUS[extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(readFileSync(p));
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(String(e?.message ?? e));
    }
  });
}
await new Promise((ok, no) => szerver(APP, appDist, 'web', true).once('error', no).listen(APP_PORT, '127.0.0.1', ok));
await new Promise((ok, no) => szerver(PANEL, panelDist, 'panel', false).once('error', no).listen(PANEL_PORT, '127.0.0.1', ok));
console.log(`KESZ app: ${APP}  panel: ${PANEL}`);
