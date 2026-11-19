#!/usr/bin/env node
// Real-browser check of the LIVE deployment over HTTPS (headless Chrome on the owner's PC), complementing
// https-proba.sh (curl). Looks for console errors and CSP violations, and walks the parts only a browser can prove:
//   1. app + panel login pages render (Geist, 3D icons, no CSP violation);
//   2. registration of a NEW fictional test client in the web app UI → e-mail verification screen;
//   3. the server (over ssh, test values via stdin, nothing printed) verifies the e-mail from the DEMO outbox,
//      fills the questionnaire + consents and starts the SimplePay DEMO registration → prints only the payment URL;
//   4. the browser opens the DEMO payment page on api., clicks "Sikeres fizetés", follows the cross-host
//      redirects (form-action CSP!) back to app./elofizetes/eredmeny with its own session; then home + bekötés.
// Screenshots → kod/_qa/eles_https/. Usage: node kod/deploy/bongeszo-proba.mjs
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

const require = createRequire('C:/Users/UpgradePC/konyvelo_app/kod/panel/package.json');
const puppeteer = require('puppeteer-core');
const D = '45-94-65-74.sslip.io';
const APP = `https://app.${D}`;
const PANEL = `https://konyvelo.${D}`;
const OUT = 'C:/Users/UpgradePC/konyvelo_app/kod/_qa/eles_https';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'kj-bongeszo-')).replace(/\\/g, '/');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const ok = (n) => (results.push(['OK  ', n]), console.log('OK   ', n));
const bad = (n, why) => (results.push(['HIBA', n]), console.log('HIBA ', n, why ?? ''));

async function browser(name, viewport) {
  return puppeteer.launch({
    executablePath: CHROME, headless: true, userDataDir: `${tmp}/udd_${name}_${Date.now()}`,
    args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--lang=hu-HU'],
    defaultViewport: viewport, protocolTimeout: 60000,
  });
}
function watch(page, errors) {
  page.on('pageerror', (e) => errors.push(`pageerror ${String(e).slice(0, 200)}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/status of 401/.test(t)) return; // the refresh probe on a logged-out page
    errors.push(`console ${t.slice(0, 200)}`);
  });
}
// CSP violations are reported to the page as events; collect them before any script of the page runs.
const cspHook = () => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
};
const byText = (page, text, sel = '[role=button], button, a, div') =>
  page.evaluate(
    (t, s) => {
      const els = [...document.querySelectorAll(s)].filter((e) => e.textContent && e.textContent.replace(/\s+/g, ' ').trim() === t);
      const el = els[els.length - 1];
      if (!el) return false;
      el.scrollIntoView({ block: 'center' });
      el.click();
      return true;
    },
    text,
    sel,
  );
async function shot(page, name, full = false) {
  await page.evaluate(() => document.fonts.ready);
  await wait(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
}

// ---------- 1. login pages ----------
for (const [name, url, vp] of [
  ['01_app_belepes', `${APP}/belepes`, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ['02_panel_belepes', `${PANEL}/belepes`, { width: 1440, height: 900, deviceScaleFactor: 1 }],
]) {
  const b = await browser(name, vp);
  try {
    const page = await b.newPage();
    const errors = [];
    watch(page, errors);
    await page.evaluateOnNewDocument(cspHook);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
    await wait(1500);
    await shot(page, name);
    const csp = await page.evaluate(() => window.__csp);
    const font = await page.evaluate(() => [...document.fonts].some((f) => /geist/i.test(f.family) && f.status === 'loaded'));
    if (csp.length) bad(`${name}: CSP`, csp.join(' | '));
    else ok(`${name}: nincs CSP-sértés`);
    if (errors.length) bad(`${name}: konzol`, errors.join(' | '));
    else ok(`${name}: nincs konzolhiba`);
    if (font) ok(`${name}: Geist betöltve`);
    else bad(`${name}: Geist nincs betöltve`);
  } catch (e) {
    bad(name, e.message);
  } finally {
    await b.close();
  }
}

// ---------- 2–4. new client in the web app ----------
const email = `bongeszo.${Date.now()}@demo.kezjegy.test`;
const password = randomBytes(18).toString('base64url'); // test value for a fictional account; never printed
const b64 = (v) => Buffer.from(v, 'utf8').toString('base64');
const b = await browser('app_uj', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
try {
  const page = await b.newPage();
  const errors = [];
  watch(page, errors);
  await page.evaluateOnNewDocument(cspHook);
  await page.goto(`${APP}/regisztracio?utm_source=bongeszo-proba`, { waitUntil: 'networkidle2', timeout: 45000 });
  await page.waitForFunction(() => document.querySelectorAll('input').length >= 4, { timeout: 20000 }).catch(() => {});
  await wait(500);
  const inputs = await page.$$('input');
  if (inputs.length < 4) {
    await shot(page, '03_HIBA_regisztracio');
    throw new Error(`regisztrációs űrlap nem jelent meg (${inputs.length} mező, ${await page.evaluate(() => location.pathname)})`);
  }
  const vals = ['Teszt', 'Böngésző', email, password];
  for (let i = 0; i < 4; i++) await inputs[i].type(vals[i], { delay: 5 });
  await shot(page, '03_app_regisztracio_kitoltve');
  if (!(await byText(page, 'Regisztrálok'))) throw new Error('nincs Regisztrálok gomb');
  await page.waitForFunction(() => location.pathname.includes('email-megerosites'), { timeout: 20000 });
  await wait(800);
  await shot(page, '04_app_email_megerosites');
  ok('regisztráció a webappban → e-mail megerősítés képernyő');

  // server side: verify + questionnaire + consents + SimplePay DEMO start (test values over stdin only)
  const remote = execFileSync('ssh', ['appok-1', 'bash -s'], {
    // `bash -s` reads its script from stdin, so the test values travel base64-encoded inside the script text
    // (never in argv, never printed).
    input: `NE=$(echo ${b64(email)} | base64 -d); NP=$(echo ${b64(password)} | base64 -d)\n` + String.raw`
set -euo pipefail
D=45-94-65-74.sslip.io; CRED=/srv/kezjegy/demo_belepesek.txt
j() { jq -nc "$@"; }
TOK=$(j --arg e "$NE" --arg p "$NP" '{email:$e,password:$p,clientKind:"native"}' | curl -fsS -H 'content-type: application/json' --data-binary @- https://api.$D/api/v1/auth/login | jq -r .accessToken)
AE=$(grep '^admin;' $CRED | cut -d';' -f2); AP=$(grep '^admin;' $CRED | cut -d';' -f3)
ATOK=$(j --arg e "$AE" --arg p "$AP" '{email:$e,password:$p,clientKind:"panel"}' | curl -fsS -H 'content-type: application/json' --data-binary @- https://konyvelo.$D/api/v1/auth/login | jq -r .accessToken)
CODE=$(printf 'Authorization: Bearer %s\n' "$ATOK" | curl -fsS -H @- https://konyvelo.$D/api/v1/admin/demo-outbox | jq -r '.items[0].bodyText' | grep -oE '\b[0-9]{6}\b' | head -1)
H() { printf 'Authorization: Bearer %s\n' "$TOK"; }
H | curl -fsS -o /dev/null -H @- -H 'content-type: application/json' --data "{\"code\":\"$CODE\"}" https://api.$D/api/v1/auth/email/verify
IDS=$(python3 -c '
import random
from datetime import date
r=random.Random()
while True:
    d="8"+f"{(date(1985,1,1)-date(1867,1,1)).days+r.randint(0,9000):05d}"+f"{r.randint(0,999):03d}"
    c=sum((i+1)*int(x) for i,x in enumerate(d))%11
    if c!=10: break
t="6"+f"{r.randint(0,999999):06d}"; w=[9,7,3,1,9,7,3]
print(d+str(c), t+str((10-sum(int(t[i])*w[i] for i in range(7))%10)%10))')
AJ=$(echo "$IDS" | cut -d' ' -f1); TSZ=$(echo "$IDS" | cut -d' ' -f2)
j --arg aj "$AJ" --arg asz "$TSZ-1-41" '{firstName:"Böngésző",lastName:"Teszt",adoazonositoJel:$aj,adoszam:$asz,address:{zip:"1136",city:"Budapest",line:"Példa utca 11."},hqMunicipality:"Budapest",activityText:"Kitalált böngészős próba",activityAnswer:"egyeb",taxStatus:"fofoglalkozasu",evSince:"2023-03-01",hasSeparateBusinessAccount:true}' > /dev/shm/kj_prof_$$
H | curl -fsS -o /dev/null -X PUT -H @- -H 'content-type: application/json' --data-binary @/dev/shm/kj_prof_$$ https://api.$D/api/v1/client/profile; rm -f /dev/shm/kj_prof_$$
ITEMS=$(curl -fsS https://api.$D/api/v1/config | jq -c '[.legal | to_entries[] | select(.key|test("^(aszf|adatkezeles|megbizasi_szerzodes)$")) | {docType:.key,version:.value}]')
H | curl -fsS -o /dev/null -H @- -H 'content-type: application/json' --data "{\"items\":$ITEMS}" https://api.$D/api/v1/me/consents
H | curl -fsS -H @- -H 'content-type: application/json' --data '{"platform":"web","acceptedDeclarations":true}' https://api.$D/api/v1/client/subscription/start | jq -r .paymentUrl
`,
    encoding: 'utf8',
  }).trim();
  const payUrl = remote.split('\n').pop();
  if (!payUrl.startsWith(`https://api.${D}/api/v1/payments/demo/pay?o=`)) throw new Error('nincs fizetési URL');
  ok('szerver: e-mail megerősítve (DEMO postafiók), kérdőív + szerződések, SimplePay DEMO indítva');

  await page.goto(payUrl, { waitUntil: 'networkidle2', timeout: 45000 });
  await shot(page, '05_demo_fizetooldal');
  const cspPay = await page.evaluate(() => window.__csp);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }), byText(page, 'Sikeres fizetés szimulálása', 'button')]);
  await page.waitForFunction(() => location.host.startsWith('app.') && location.pathname.includes('elofizetes'), { timeout: 20000 });
  await wait(2500);
  await shot(page, '06_app_fizetes_eredmeny');
  const txt = await page.evaluate(() => document.body.innerText);
  if (cspPay.length) bad('DEMO fizetőoldal CSP', cspPay.join(' | '));
  if (/sikeres|rendben|megvan|köszön/i.test(txt)) ok(`fizetés → vissza az appba (${await page.evaluate(() => location.pathname)}), sikeres eredmény`);
  else bad('fizetés eredménye', txt.slice(0, 200));

  await page.goto(`${APP}/bekotes`, { waitUntil: 'networkidle2', timeout: 45000 });
  await wait(1500);
  await shot(page, '07_app_bekotes', true);
  await page.goto(`${APP}/`, { waitUntil: 'networkidle2', timeout: 45000 });
  await wait(1500);
  await shot(page, '08_app_fooldal');
  const csp = await page.evaluate(() => window.__csp);
  if (csp.length) bad('app (bejelentkezve): CSP', csp.join(' | '));
  else ok('app (bejelentkezve): nincs CSP-sértés');
  if (errors.length) bad('app (bejelentkezve): konzol', [...new Set(errors)].join(' | '));
  else ok('app (bejelentkezve): nincs konzolhiba');
} catch (e) {
  bad('új ügyfél a böngészőben', e.message);
} finally {
  await b.close();
}
// Retire the fictional test client: GDPR deletion request with its own password, then admin status "megszunt"
// (keeps Bence's demo list clean; nothing is hard-deleted).
try {
  const out = execFileSync('ssh', ['appok-1', 'bash -s'], {
    input: `NE=$(echo ${b64(email)} | base64 -d); NP=$(echo ${b64(password)} | base64 -d)
` + String.raw`
D=45-94-65-74.sslip.io; CRED=/srv/kezjegy/demo_belepesek.txt
TOK=$(jq -nc --arg e "$NE" --arg p "$NP" '{email:$e,password:$p,clientKind:"native"}' | curl -sS -H 'content-type: application/json' --data-binary @- https://api.$D/api/v1/auth/login | jq -r .accessToken)
CID=$(printf 'Authorization: Bearer %s
' "$TOK" | curl -sS -H @- https://api.$D/api/v1/client/home | jq -r .client.id)
jq -nc --arg p "$NP" '{password:$p,reason:"bongeszo-proba"}' > /dev/shm/kj_del_$$
printf 'Authorization: Bearer %s
' "$TOK" | curl -sS -o /dev/null -w 'delete %{http_code} ' -H @- -H 'content-type: application/json' --data-binary @/dev/shm/kj_del_$$ https://api.$D/api/v1/me/delete
rm -f /dev/shm/kj_del_$$
AE=$(grep '^admin;' $CRED | cut -d';' -f2); AP=$(grep '^admin;' $CRED | cut -d';' -f3)
ATOK=$(jq -nc --arg e "$AE" --arg p "$AP" '{email:$e,password:$p,clientKind:"panel"}' | curl -sS -H 'content-type: application/json' --data-binary @- https://konyvelo.$D/api/v1/auth/login | jq -r .accessToken)
printf 'Authorization: Bearer %s
' "$ATOK" | curl -sS -o /dev/null -w 'megszunt %{http_code}' -X PATCH -H @- -H 'content-type: application/json' --data '{"lifecycle":"megszunt"}' https://konyvelo.$D/api/v1/admin/clients/$CID
`,
    encoding: 'utf8',
  }).trim();
  if (/delete 202 megszunt 200/.test(out)) ok('próbaügyfél: törlés kérve + lezárva (megszűnt)');
  else bad('próbaügyfél lezárása', out);
} catch (e) {
  bad('próbaügyfél lezárása', e.message);
}
console.log(`\n${results.filter((r) => r[0] === 'OK  ').length} OK, ${results.filter((r) => r[0] === 'HIBA').length} HIBA – képek: ${OUT}`);
process.exitCode = results.some((r) => r[0] === 'HIBA') ? 1 : 0;
