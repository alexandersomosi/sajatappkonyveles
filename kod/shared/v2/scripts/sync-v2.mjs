#!/usr/bin/env node
// Adózz.hu v2 – a közös dizájn-alap MÁSOLÁSA egy fogyasztóba (ALAP-D / D8), mint a ../scripts/sync-shared.mjs:
// a Metro (app) és a Vite (panel) a csomagon kívülre nem lát jól, ezért a fogyasztó saját másolatot kap.
//   node ../shared/v2/scripts/sync-v2.mjs src/_shared/v2 --rn    (kod/app-ból:   közös rész + rn/)
//   node ../shared/v2/scripts/sync-v2.mjs src/_shared/v2 --web   (kod/panel-ből: közös rész + web/)
// Mit visz: index.ts, tokenek.ts, ikon/*.ts, logo/ (png + meret.ts), LICENCEK.md + licencek/, és az rn/ VAGY a web/ mappát.
// A .ts/.tsx/.css fájlok elejére „GENERATED from kod/shared/v2” fejléc kerül. A másolatot ne szerkeszd: a forrást
// (kod/shared/v2) javítsd, és futtasd újra. A célban semmit nem töröl (a régi, már nem létező fájl ott marad – ritka eset).
// Csak fájlt másol, .ts-t nem futtat – bármely Node 18+ elviszi.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cel = args.find((a) => !a.startsWith('--'));
const platform = args.includes('--rn') ? 'rn' : args.includes('--web') ? 'web' : null;
if (!cel || !platform) {
  console.error('Használat: node sync-v2.mjs <célmappa> --rn|--web');
  process.exit(2);
}
const CEL = resolve(process.cwd(), cel);
if (CEL === V2 || CEL.startsWith(V2 + (process.platform === 'win32' ? '\\' : '/'))) {
  console.error('A cél nem lehet a kod/shared/v2 maga.');
  process.exit(2);
}

const FEJ_TS = '// GENERATED from kod/shared/v2 – do not edit here. Edit kod/shared/v2 and re-run sync-v2.\n';
const FEJ_CSS = '/* GENERATED from kod/shared/v2 – do not edit here. Edit kod/shared/v2 and re-run sync-v2. */\n';

let db = 0;
function masol(rel) {
  const forras = join(V2, rel);
  const ide = join(CEL, rel);
  mkdirSync(dirname(ide), { recursive: true });
  if (/\.(ts|tsx)$/.test(rel)) writeFileSync(ide, FEJ_TS + readFileSync(forras, 'utf8'));
  else if (/\.css$/.test(rel)) writeFileSync(ide, FEJ_CSS + readFileSync(forras, 'utf8'));
  else writeFileSync(ide, readFileSync(forras));
  db++;
}
function mappa(rel, szuro) {
  const m = join(V2, rel);
  if (!existsSync(m)) return;
  for (const f of readdirSync(m, { withFileTypes: true })) {
    if (f.isFile() && szuro(f.name)) masol(join(rel, f.name));
  }
}

masol('index.ts');
masol('tokenek.ts');
masol('LICENCEK.md');
mappa('licencek', (n) => n.endsWith('.txt'));
mappa('ikon', (n) => n.endsWith('.ts'));
mappa('logo', (n) => n.endsWith('.png') || n.endsWith('.ts'));
mappa(platform, (n) => /\.(ts|tsx|css)$/.test(n));

console.log(`shared/v2 (${platform}) -> ${relative(process.cwd(), CEL) || '.'}: ${db} fájl`);
