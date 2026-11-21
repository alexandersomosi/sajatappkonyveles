#!/usr/bin/env node
// Adózz.hu v2 – a teljes ellenőrzés egy paranccsal (ALAP-D / D8):
//   1. a generált fájlok naprakészek (gen-ikonok, gen-css --ellenoriz)
//   2. node --test teszt/v2.test.mjs
//   3. típusellenőrzés RN-re (az app TypeScriptjével) és webre (a panel TypeScriptjével) – a node_modules-t csak olvassa
// Futtatás: node kod/shared/v2/scripts/ellenoriz.mjs        (kilépési kód: 0 = minden zöld)
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const V2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KOD = resolve(V2, '../..');
const lepesek = [
  ['gen-ikonok --ellenoriz', [join(V2, 'scripts/gen-ikonok.mjs'), '--ellenoriz']],
  ['gen-css --ellenoriz', [join(V2, 'scripts/gen-css.mjs'), '--ellenoriz']],
  ['node --test', ['--test', join(V2, 'teszt/v2.test.mjs')]],
];
const tscRn = join(KOD, 'app/node_modules/typescript/bin/tsc');
const tscWeb = join(KOD, 'panel/node_modules/typescript/bin/tsc');
if (existsSync(tscRn)) lepesek.push(['tsc (RN)', [tscRn, '-p', join(V2, 'tsconfig.rn.json')]]);
else console.warn('kimarad: tsc (RN) – nincs kod/app/node_modules');
if (existsSync(tscWeb)) lepesek.push(['tsc (web)', [tscWeb, '-p', join(V2, 'tsconfig.web.json')]]);
else console.warn('kimarad: tsc (web) – nincs kod/panel/node_modules');

let hiba = 0;
for (const [nev, args] of lepesek) {
  const r = spawnSync(process.execPath, args, { cwd: V2, stdio: 'inherit' });
  console.log(`${r.status === 0 ? 'OK  ' : 'HIBA'} ${nev}`);
  if (r.status !== 0) hiba++;
}
process.exit(hiba ? 1 : 0);
