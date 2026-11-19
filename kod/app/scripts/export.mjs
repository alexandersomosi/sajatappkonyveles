#!/usr/bin/env node
// Webes export. `node scripts/export.mjs eles`  → dist/       (valódi API ugyanazon a hoston: /api/v1)
//              `node scripts/export.mjs minta` → dist-minta/ (beépített MINTA-adatok, szerver nélkül; képernyőképekhez)
import { spawnSync } from 'node:child_process';

const mod = process.argv[2] === 'minta' ? 'minta' : 'eles';
const env = { ...process.env };
if (mod === 'minta') env.EXPO_PUBLIC_API_MODE = 'minta';
else {
  delete env.EXPO_PUBLIC_API_MODE;
  env.EXPO_PUBLIC_API_URL = env.EXPO_PUBLIC_API_URL || '/api/v1';
}
const ki = mod === 'minta' ? 'dist-minta' : 'dist';
const r = spawnSync('npx', ['expo', 'export', '-p', 'web', '--output-dir', ki, '--clear'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
if (r.status === 0 && mod === 'eles') {
  const e = spawnSync(process.execPath, ['scripts/ellenoriz-dist.mjs', ki], { stdio: 'inherit' });
  process.exit(e.status ?? 1);
}
process.exit(r.status ?? 1);
