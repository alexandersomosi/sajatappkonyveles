#!/usr/bin/env node
// Adózz.hu v2 – web/v2.css a tokenek.ts-ből (ALAP-D / D7): CSS-változók (--v2-…) + néhány alaposztály
// (.v2-kartya, .v2-csempe, .v2-gomb…, .v2-cimke-…, .v2-fokusz). Globális reset NINCS – a panel app.css-ét nem írja felül
// (csak :root változók és v2- előtagú osztályok).
// Futtatás:  node kod/shared/v2/scripts/gen-css.mjs [--ellenoriz]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { szin, sugar, ter, arnyek, betu, csempe, mozgas, fokusz, fejGradiens, elrendezes, tipo, nav } from '../tokenek.ts';

const V2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CEL = join(V2, 'web/v2.css');
const ELLENORIZ = process.argv.includes('--ellenoriz');

/** kekVil → kek-vil, t10 → t10 */
export const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** A :root változók – a teszt ugyanezt a függvényt hívja, és a tokenekkel veti össze. */
export function valtozok() {
  const v = [];
  for (const [k, x] of Object.entries(szin)) v.push([`--v2-${kebab(k)}`, x]);
  v.push(['--v2-fej-gradiens', fejGradiens.css]);
  for (const [k, x] of Object.entries(sugar)) v.push([`--v2-r-${kebab(k)}`, `${x}px`]);
  for (const [k, x] of Object.entries(ter)) v.push([`--v2-${k}`, `${x}px`]);
  for (const [k, x] of Object.entries(arnyek)) v.push([`--v2-arnyek-${kebab(k)}`, x.css]);
  v.push(['--v2-betu', betu.web]);
  v.push(['--v2-mozgas-rovid', `${mozgas.rovid}ms`], ['--v2-mozgas-alap', `${mozgas.alap}ms`], ['--v2-mozgas-hosszu', `${mozgas.hosszu}ms`], ['--v2-gorbe', mozgas.gorbeCss]);
  return v;
}

const px = (n) => `${n}px`;
const t = (s) => `font-size: ${px(s.meret)}; font-weight: ${s.suly}; line-height: ${s.sor};${s.betukoz ? ` letter-spacing: ${s.betukoz}em;` : ''}${s.nagybetu ? ' text-transform: uppercase;' : ''}`;
const k = elrendezes.kartya;

export function css() {
  return `/* GENERÁLT – kézzel ne írd. Forrás: kod/shared/v2/tokenek.ts → node kod/shared/v2/scripts/gen-css.mjs
   Adózz.hu v2 dizájn-alap a webes felületekhez (panel, konzol). Globális reset nincs: csak :root változók és v2- osztályok.
   Betöltés egyszer, a saját stíluslap ELŐTT (panel: src/main.tsx). */

:root {
${valtozok().map(([n, x]) => `  ${n}: ${x};`).join('\n')}
}

/* ---------- kártya: tiszta fehér, r 20, finom árnyék (nem pasztell doboz) ---------- */
.v2-kartya { background: var(--v2-kartya); border-radius: var(--v2-r-kartya); padding: ${px(k.fugg)} ${px(k.vizsz)}; margin-bottom: ${px(k.koz)}; box-shadow: var(--v2-arnyek-kartya); color: var(--v2-sotet); }
.v2-kartya-sor { display: flex; align-items: flex-start; gap: ${px(k.belsoKoz)}; }
.v2-kartya-tomor { padding-top: ${px(k.tomorFugg)}; padding-bottom: ${px(k.tomorFugg)}; }
.v2-kartya-asztali { border-radius: var(--v2-r-kartya-asztali); padding: ${px(k.asztaliFugg)} ${px(k.asztaliVizsz)}; }
.v2-kartya-asztali.v2-kartya-sor { gap: ${px(k.asztaliBelsoKoz)}; }
.v2-kartya-asztali.v2-kartya-tomor { padding-top: ${px(k.tomorFugg)}; padding-bottom: ${px(k.tomorFugg)}; }
.v2-kartya-racsban { margin-bottom: 0; }

/* ---------- ikonok, csempe (#F1F3F9, 42/34 · 36/29 · 64/50) ---------- */
.v2-ikon, .v2-vezerlo { flex: none; display: inline-block; vertical-align: middle; }
.v2-csempe { flex: none; display: inline-grid; place-items: center; width: ${px(csempe.alap.meret)}; height: ${px(csempe.alap.meret)}; border-radius: ${px(csempe.alap.sugar)}; background: ${csempe.hatter}; }
.v2-csempe-kicsi { width: ${px(csempe.kicsi.meret)}; height: ${px(csempe.kicsi.meret)}; border-radius: ${px(csempe.kicsi.sugar)}; }
.v2-csempe-nagy { width: ${px(csempe.nagy.meret)}; height: ${px(csempe.nagy.meret)}; border-radius: ${px(csempe.nagy.sugar)}; }
.v2-csempe > svg { display: block; }
.v2-logo { display: block; }

/* ---------- gombok: képernyőnként legfeljebb EGY sárga főgomb ---------- */
.v2-gomb { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: ${px(elrendezes.gombMagas)}; padding: 0 20px; border: 0; border-radius: var(--v2-r-gomb);
  background: var(--v2-sarga); color: var(--v2-sotet); font-family: var(--v2-betu); ${t(tipo.gomb)} box-shadow: var(--v2-arnyek-gomb); text-decoration: none; cursor: pointer; }
.v2-gomb-masod { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: ${px(elrendezes.gombMagasMasod)}; padding: 0 18px; border-radius: var(--v2-r-gomb);
  background: var(--v2-feher); border: 1.5px solid var(--v2-keret); color: var(--v2-sotet); font-family: var(--v2-betu); ${t(tipo.gombMasod)} text-decoration: none; cursor: pointer; }
.v2-gomb-veszely { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: ${px(elrendezes.gombMagasMasod)}; padding: 0 18px; border-radius: var(--v2-r-gomb);
  background: var(--v2-feher); border: 1.5px solid var(--v2-piros-keret); color: var(--v2-piros); font-family: var(--v2-betu); ${t(tipo.gombMasod)} text-decoration: none; cursor: pointer; }
.v2-gomb-kis { display: inline-flex; align-items: center; gap: 7px; min-height: ${px(elrendezes.gombMagasKis)}; padding: 0 16px 0 13px; border: 0; border-radius: var(--v2-r-kapszula);
  background: var(--v2-sarga); color: var(--v2-sotet); font-family: var(--v2-betu); ${t(tipo.gombKis)} box-shadow: var(--v2-arnyek-gomb-kis); white-space: nowrap; text-decoration: none; cursor: pointer; }
.v2-gomb-kis.v2-gomb-kis-masod { background: var(--v2-kek-vil); color: var(--v2-kek); box-shadow: none; padding: 0 16px; }
.v2-gomb:disabled, .v2-gomb[aria-disabled="true"], .v2-gomb-kis:disabled, .v2-gomb-kis[aria-disabled="true"] { background: var(--v2-letiltva-alap); color: var(--v2-letiltva-szoveg); box-shadow: none; cursor: not-allowed; }
.v2-gomb-masod:disabled, .v2-gomb-veszely:disabled, .v2-gomb-masod[aria-disabled="true"], .v2-gomb-veszely[aria-disabled="true"] { color: var(--v2-letiltva-szoveg); border-color: var(--v2-keret); cursor: not-allowed; }
.v2-link { color: var(--v2-kek); font-weight: ${tipo.link.suly}; text-decoration: underline; text-underline-offset: 3px; }

/* ---------- állapotcímkék (kicsi, telt világos alapon – maradhat) ---------- */
.v2-cimke { display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: var(--v2-r-kapszula); font-family: var(--v2-betu); ${t(tipo.cimke)} white-space: nowrap; }
.v2-cimke-ok { background: var(--v2-zold-vil); color: var(--v2-zold); }
.v2-cimke-var { background: var(--v2-narancs-vil); color: var(--v2-narancs); }
.v2-cimke-hiba { background: var(--v2-piros-vil); color: var(--v2-piros); }
.v2-cimke-info { background: var(--v2-kek-vil); color: var(--v2-kek); }
.v2-cimke-szurke { background: var(--v2-szurke-alap); color: var(--v2-szurke); }

/* ---------- szöveg ---------- */
.v2-betu { font-family: var(--v2-betu); }
.v2-szakasz-cim { ${t(tipo.szakaszCim)} color: var(--v2-szurke); margin: ${px(elrendezes.szakaszCim.fent)} ${px(elrendezes.szakaszCim.oldal)} ${px(elrendezes.szakaszCim.lent)}; }
.v2-kartya-cim { ${t(tipo.kartyaCim)} color: var(--v2-sotet); }
.v2-szoveg2 { color: var(--v2-szoveg2); }
.v2-masodlagos { color: var(--v2-szurke); }

/* ---------- alsó sáv / menü jelzői ---------- */
.v2-pont { display: inline-block; width: ${px(nav.pontMeret)}; height: ${px(nav.pontMeret)}; border-radius: 50%; background: var(--v2-pont); }

/* ---------- látható fókusz (billentyűzet): 2 px kék körvonal, 2 px eltolással ---------- */
.v2-fokusz:focus-visible, .v2-gomb:focus-visible, .v2-gomb-masod:focus-visible, .v2-gomb-veszely:focus-visible, .v2-gomb-kis:focus-visible, .v2-link:focus-visible {
  outline: ${px(fokusz.vastagsag)} solid ${fokusz.szin}; outline-offset: ${px(fokusz.eltolas)}; }
`;
}

const ki = css();
if (ELLENORIZ) {
  const most = existsSync(CEL) ? readFileSync(CEL, 'utf8') : '';
  if (most !== ki) { console.error(`ELTÉR: ${CEL}`); process.exit(1); }
  console.log('gen-css: a web/v2.css naprakész');
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  writeFileSync(CEL, ki);
  console.log(`gen-css: ${valtozok().length} változó → web/v2.css`);
}
