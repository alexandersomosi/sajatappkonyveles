// Round-1 fixer: targeted screenshots of the app MINTA build (dist-minta) with measurements.
//   node app_minta.mjs [filter]      PORT=8871
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const app = 'C:/Users/UpgradePC/konyvelo_app/kod/app';
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.PORT || 8871);
const ki = process.env.KI || 'C:/Users/UpgradePC/konyvelo_app/kod/_qa';
const ELO = process.env.ELO || 'jav1_app_';
mkdirSync(ki, { recursive: true });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
async function kattint(page, szoveg, n = 0) {
  const elemek = await page.$$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (!elemek.length) throw new Error(`nincs ilyen szöveg: ${szoveg}`);
  await elemek[Math.min(n, elemek.length - 1)].click();
  await var_(800);
}
async function gorget(page, szoveg) {
  const e = await page.$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (e) await e.evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await var_(400);
}
/** bottom/top (pt) of the first element containing the text */
async function mer(page, szoveg) {
  return page.evaluate((t) => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.textContent && n.textContent.trim().includes(t)) {
        const r = n.parentElement.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
      }
    }
    return null;
  }, szoveg);
}

// [name, path, height multiplier, action, [texts to measure]]
const LOVESEK = [
  ['bekotes_uj', '/bekotes?minta=uj', 1, null, ['Igen, van', 'Még nincs, most indítanám', 'Lépésről lépésre segítünk.', 'Főoldal', 'Lejátszás', 'Kinyitom']],
  ['bekotes_uj_teljes', '/bekotes?minta=uj', 3],
  ['bekotes_peter', '/bekotes?minta=peter', 1, null, ['Kinyitom', 'Lejátszás']],
  ['bekotes_indul', '/bekotes?minta=indul', 1, null, ['Lejátszás', 'Kinyitom']],
  ['bekotes_levente', '/bekotes?minta=levente', 1],
  ['fooldal_fizetendo', '/?minta=fizetendo', 1, null, ['Határidők', 'Feltöltés', '3 külön utalás', 'Kérdésed van?']],
  ['fooldal_fizetendo_teljes', '/?minta=fizetendo', 2.6],
  ['fooldal_befizetve', '/?minta=befizetve', 1, null, ['Határidők']],
  ['fooldal_becsles', '/?minta=kata', 1, null, ['Határidők', 'Kérdésed van?']],
  ['szamlaszamok', '/?minta=fizetendo&lap=szamlaszamok', 2.2],
  ['befizettem', '/?minta=fizetendo&lap=befizettem', 1.2],
  ['hogyan', '/?minta=fizetendo&lap=hogyan', 1.4],
  ['uzenetek', '/uzenetek?minta=fizetendo', 1, null, ['Kovács Bence', 'Jövedelemigazolás', 'Köztartozás-mentes', 'Küldés']],
  ['uzenetek_levente', '/uzenetek?minta=levente', 1],
  ['utmutato', '/bekotes/vallalkozas/utmutato?minta=utmutato', 1],
  ['utmutato_lepes', '/bekotes/vallalkozas/utmutato?minta=utmutato', 2.6, (p) => gorget(p, 'Adózási adatok – ÁFA')],
  ['utmutato_megvan', '/bekotes/vallalkozas/utmutato?minta=utmutato', 1.6, async (p) => { await gorget(p, 'Lépésről lépésre'); await kattint(p, 'Megvan'); }],
  ['kepnezo', '/bekotes/vallalkozas/utmutato?minta=utmutato', 1, async (p) => { await gorget(p, 'Adózási adatok – ÁFA'); await kattint(p, 'Nagyítom'); await var_(600); }],
  ['meghatalmazas', '/bekotes/meghatalmazas?minta=levente', 1],
  ['belepes', '/belepes?minta=kint', 1],
  ['hataridok', '/hataridok?minta=kata', 1.6],
  ['dosszie_korabbi', '/dosszie?minta=kata&honap=korabbiak', 1.4],
  ['elofizetes', '/fiok/elofizetes?minta=kata', 1.3],
  ['adatlap_kapu', '/bekotes/vallalkozas/adatlap?minta=indul&lap=1', 1],
  ['vallalkozas_kozpont', '/bekotes/vallalkozas?minta=indul', 2.4],
  ['adatok_rolad', '/bekotes/adatok?minta=indul&utana=adatlap', 1.5],
  ['ketlepcsos', '/fiok/ketlepcsos?minta=kata', 1],
  ['tetel', '/dosszie?minta=kata', 1],
];

async function egy(base, [nev, ut, szorzo, muvelet, meresek], szel, mag) {
  const prof = join(tmpdir(), `kezjegy_jav1_${process.pid}_${nev}_${szel}`).replace(/\\/g, '/');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    await page.setViewport({ width: szel, height: Math.round(mag * szorzo), deviceScaleFactor: 2 });
    await page.goto(`${base}${ut}${ut.includes('?') ? '&' : '?'}szelesseg=${szel}`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await var_(1300);
    if (muvelet) await muvelet(page);
    await var_(500);
    const cel = `${ki}/${ELO}${nev}_${szel}.png`;
    await page.screenshot({ path: cel });
    let m = '';
    if (meresek) {
      const r = {};
      for (const t of meresek) r[t] = await mer(page, t);
      m = ' ' + JSON.stringify(r);
    }
    const tul = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(`kész: ${nev}_${szel}${tul > 0 ? ` VÍZSZINTES TÚLCSORDULÁS ${tul}` : ''}${hibak.length ? ` (oldalhiba: ${hibak.join(' | ').slice(0, 300)})` : ''}${m}`);
  } catch (e) {
    console.log(`HIBA: ${nev}_${szel}: ${e.message}`);
  } finally {
    await b.close();
    try { rmSync(prof, { recursive: true, force: true }); } catch {}
  }
}

const szuro = process.argv.slice(2);
const lista = LOVESEK.filter(([n]) => !szuro.length || szuro.some((s) => n.startsWith(s)));
const meretek = (process.env.MERET || '390x844,360x780').split(',').map((x) => x.split('x').map(Number));
const srv = spawn(process.execPath, [join(app, 'scripts/kiszolgalo.mjs'), join(app, process.env.DIST || 'dist-minta'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
const indult = await new Promise((ok) => {
  const t = setTimeout(() => ok(false), 6000);
  srv.stdout.on('data', (d) => String(d).includes('kiszolgáló:') && (clearTimeout(t), ok(true)));
  srv.on('exit', () => (clearTimeout(t), ok(false)));
});
if (!indult) { console.error(`a ${PORT} port foglalt`); process.exit(1); }
try {
  const sor = lista.flatMap((l) => meretek.map(([w, h]) => [l, w, h]));
  const dolgozo = async () => { while (sor.length) { const [l, w, h] = sor.shift(); await egy(`http://127.0.0.1:${PORT}`, l, w, h); } };
  await Promise.all(Array.from({ length: 4 }, dolgozo));
} finally {
  srv.kill();
}
