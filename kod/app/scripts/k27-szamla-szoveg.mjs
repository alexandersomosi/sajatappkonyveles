#!/usr/bin/env node
// SPEC §27.5.4 / K5.1 – a kiállított számlák egységes szóhasználata: minden ügyfélnek vagy csapatnak szóló szöveget
// átfut az INVOICE_WORDING_FORBIDDEN_PATTERNS mintáin (kod/shared/src/bekotes.ts). Csak olvas, semmit nem ír.
// A szándékos idézeteket (megjegyzés, tesztadat) a sorban álló „szándékos” szó menti fel.
//
//   node scripts/k27-szamla-szoveg.mjs            # app, panel, backend content/notify/services, jogi, VTT
//   node scripts/k27-szamla-szoveg.mjs --csak app # egy terület (app | panel | backend | jogi | media)
// Kilépési kód: 0 = nincs találat, 1 = van.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const kod = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const forras = readFileSync(join(kod, 'shared', 'src', 'bekotes.ts'), 'utf8');
const blokk = /INVOICE_WORDING_FORBIDDEN_PATTERNS: readonly string\[\] = \[([\s\S]*?)\];/.exec(forras)?.[1];
if (!blokk) throw new Error('INVOICE_WORDING_FORBIDDEN_PATTERNS nem található');
// A TS-forrás egyszeres idézőjeles sztringjei: a \\ → \ csere után RegExp-forrás.
const mintak = [...blokk.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => new RegExp(m[1].replace(/\\\\/g, '\\'), 'iu'));

const TERULETEK = {
  app: [join(kod, 'app', 'src')],
  panel: [join(kod, 'panel', 'src')],
  backend: ['content', 'notify', 'services'].map((d) => join(kod, 'backend', 'src', d)),
  jogi: [join(kod, 'jogi')],
  media: [join(kod, 'media')],
};
const csak = process.argv.includes('--csak') ? process.argv[process.argv.indexOf('--csak') + 1] : null;
const KIHAGY = new Set(['node_modules', '_regi', 'dist', '_shared', '_jogi', 'pdf_minta', '_kepek', 'utmutato', 'test', 'tests']);
const KITERJESZTES = /\.(tsx?|mjs|json|md|vtt)$/;

const talalatok = [];
function bejar(d, mely, csakGyoker = false) {
  if (!existsSync(d)) return;
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (!KIHAGY.has(f) && !csakGyoker) bejar(p, mely + 1);
      continue;
    }
    // a régi szövegek listája (adatlépés) és a GYIK „elozo_*” mezői szándékosan a régi szöveget tartják (SPEC §27.7.3)
    if (/_regi\.ts$/.test(f)) continue;
    // a jogi mappában csak a gyökér .md/.json, a media mappában csak a .vtt
    if (d.endsWith('jogi') && !/\.(md|json)$/.test(f)) continue;
    if (d.endsWith('media') && !/\.vtt$/.test(f)) continue;
    if (!KITERJESZTES.test(f) || /\.test\.tsx?$/.test(f)) continue;
    readFileSync(p, 'utf8')
      .split('\n')
      .forEach((sor, i) => {
        if (/szándékos|"elozo_(kerdes|valasz)"/.test(sor)) return;
        for (const r of mintak) if (r.test(sor)) return void talalatok.push(`${relative(kod, p)}:${i + 1}: ${sor.trim().slice(0, 140)}`);
      });
  }
}
for (const [nev, mappak] of Object.entries(TERULETEK)) {
  if (csak && csak !== nev) continue;
  for (const m of mappak) bejar(m, 0, nev === 'jogi' || nev === 'media');
}
if (talalatok.length) {
  console.log(`${talalatok.length} tiltott fordulat (SPEC §27.5.2):`);
  for (const t of talalatok) console.log('  ' + t);
  process.exit(1);
}
console.log(`Rendben: nincs tiltott fordulat (${mintak.length} minta, ${csak ?? 'minden terület'}).`);
