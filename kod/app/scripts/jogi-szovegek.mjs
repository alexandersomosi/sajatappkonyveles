#!/usr/bin/env node
// A jogász által ellenőrzendő rövid app-szövegek (kod/jogi/app_szovegek.json) másolata az appba: src/_jogi/.
// Ne itt szerkeszd: kod/jogi a forrás. Ha a jogi mappa nincs meg, a meglévő másolat marad.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const forras = resolve(app, '../jogi/app_szovegek.json');
const cel = join(app, 'src/_jogi/app_szovegek.json');
if (!existsSync(forras)) {
  console.log('jogi: nincs kod/jogi/app_szovegek.json, a meglévő másolat marad');
  process.exit(0);
}
const adat = JSON.parse(readFileSync(forras, 'utf8'));
adat._generalt = 'GENERÁLT a kod/jogi/app_szovegek.json-ból (scripts/jogi-szovegek.mjs). Ne itt szerkeszd.';
mkdirSync(dirname(cel), { recursive: true });
writeFileSync(cel, JSON.stringify(adat, null, 1) + '\n');
console.log(`jogi -> ${cel}`);
