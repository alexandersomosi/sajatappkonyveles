#!/usr/bin/env node
// SPEC §27 K2.3 / K3 – végigkattintós próba a helyi próbán (valódi backend, demo seed; belépés /__helyi/belep, jelszó
// nélkül): Marika (indítás) → „Módosítom” → „Igen, már van” → „Visszavonom”; Péter (van adószáma) → zárolt;
// Levente (beküldve) → „Módosítom” → zárolt lap; Dávid → „Megcsináljuk helyetted” (már kérte: állapot).
// Képek: kod/_qa/k5_app_p*_390.png.   BASE=http://127.0.0.1:8832 node scripts/k5-ut-proba.mjs
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8832';
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const eredmeny = [];
const ok = (nev, felt, info = '') => {
  eredmeny.push(`${felt ? 'OK  ' : 'HIBA'} ${nev}${info ? ` – ${info}` : ''}`);
};

async function lap(nev, fn) {
  const prof = join(tmpdir(), `kezjegy_k5p_${process.pid}_${nev}`).replace(/\\/g, '/');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars'] });
  try {
    const p = await b.newPage();
    const hibak = [];
    p.on('pageerror', (e) => hibak.push(e.message));
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await fn(p);
    if (hibak.length) ok(`${nev}: oldalhiba nélkül`, false, hibak.join(' | ').slice(0, 200));
  } catch (e) {
    ok(nev, false, e.message);
  } finally {
    await b.close();
    try {
      rmSync(prof, { recursive: true, force: true });
    } catch {}
  }
}
const szoveg = (p) => p.evaluate(() => document.body.innerText);
async function kattint(p, s, n = 0) {
  const el = await p.$$(`::-p-text(${JSON.stringify(s)})`);
  if (!el.length) throw new Error(`nincs: ${s}`);
  // a fülsor alá lógó gombot előbb a képernyő közepére görgetjük (különben a fülsor fátyla kapná a koppintást)
  await el[Math.min(n, el.length - 1)].evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await var_(300);
  await el[Math.min(n, el.length - 1)].click();
  await var_(1200);
}
const kep = (p, nev) => p.screenshot({ path: join(ki, `${nev}_390.png`).replace(/\\/g, '/') });
const belep = async (p, kiki, ide) => {
  await p.goto(`${BASE}/__helyi/belep?ki=${kiki}&ide=${encodeURIComponent(ide)}`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await var_(1500);
};

await lap('marika', async (p) => {
  await belep(p, 'marika', '/bekotes/meghatalmazas/jovahagyas');
  let t = await szoveg(p);
  ok('Marika: jóváhagyás-útmutató határidővel', /-⁠?ig|utolsó nap/.test(t) && /Kezdjük|Folytatom/.test(t), t.slice(0, 300).replace(/\s+/g, ' '));
  await kep(p, 'k5_app_p01_marika_jovahagyas_0');
  await kattint(p, /Folytatom/.test(t) ? 'Folytatom' : 'Kezdjük');
  t = await szoveg(p);
  ok('Marika: lépésenként (…/6. lépés)', /\d\/6\. lépés/.test(t));
  await kep(p, 'k5_app_p02_marika_jovahagyas_lepes');
});

await lap('peter', async (p) => {
  await belep(p, 'peter', '/bekotes');
  let t = await szoveg(p);
  ok('Péter: egy lista, nincs „Hol tartunk”', t.includes('Így halad a bekötésed') && !t.includes('Hol tartunk'));
  const sav = /Még (\d+) dolog|Már csak 1 dolog/.exec(t);
  ok('Péter: sávszám', !!sav || /Most nincs teendőd/.test(t), sav?.[0] ?? 'nincs teendő');
  await kattint(p, 'Módosítom');
  t = await szoveg(p);
  ok('Péter (megadta az adószámát): a váltás visszahívással', t.includes('Már megadtad az adószámodat') && t.includes('Kérem a visszahívást'));
  await kep(p, 'k5_app_p03_peter_valtas_zarolt');
});

await lap('marika_ut', async (p) => {
  await belep(p, 'marika', '/bekotes');
  await kattint(p, 'Módosítom');
  let t = await szoveg(p);
  ok('Marika: váltó lap (indítás → van)', t.includes('Módosítod a válaszodat?') && t.includes('Igen, már van vállalkozásom'), t.slice(-300).replace(/\s+/g, ' '));
  await kep(p, 'k5_app_p04_marika_valtas');
  await kattint(p, 'Igen, már van vállalkozásom');
  await var_(800);
  t = await szoveg(p);
  ok('Marika: indítás → van 2 koppintással, jelzés „Visszavonom”-mal', t.includes('Rendben: már van vállalkozásod.') && t.includes('Visszavonom'));
  await kep(p, 'k5_app_p05_marika_van_utan');
  await kattint(p, 'Visszavonom');
  await var_(1800);
  t = await szoveg(p);
  ok('Marika: „Visszavonom” visszaállítja (Most indítom)', /Most indítom/.test(t) || t.includes('Hogyan jelentsük be'), t.slice(0, 200).replace(/\s+/g, ' '));
  await kep(p, 'k5_app_p06_marika_visszavonva');
});

await lap('levente', async (p) => {
  await belep(p, 'levente', '/bekotes');
  await kattint(p, 'Módosítom');
  const t = await szoveg(p);
  ok('Levente (beküldte): zárolt váltás, visszahívás', t.includes('Ezt itt már nem tudod módosítani') && t.includes('Kérem a visszahívást'));
  await kep(p, 'k5_app_p07_levente_zarolt');
});

await lap('david', async (p) => {
  await belep(p, 'david', '/bekotes/meghatalmazas');
  const t = await szoveg(p);
  ok('Dávid: a kérés állapota a meghatalmazás lépésen', /Beszéltünk|beküldi a meghatalmazást/.test(t), t.slice(0, 120).replace(/\s+/g, ' '));
  await kep(p, 'k5_app_p08_david_meghatalmazas');
});

console.log(eredmeny.join('\n'));
