#!/usr/bin/env node
// Guards a production build: the local mock API and its fictional data must never be in dist/,
// and no source maps or env files may be shipped.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'dist';
const bad = [];
function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else {
      if (/\.map$|^\.env/.test(f)) bad.push(`${p}: should not be shipped`);
      if (/\.(js|html|css)$/.test(f)) {
        const s = readFileSync(p, 'utf8');
        for (const needle of ['installMock', 'MINTA: nincs ilyen végpont', 'mock_role', 'KSZ-2026-001']) if (s.includes(needle)) bad.push(`${p}: contains mock code (${needle})`);
      }
    }
  }
}
walk(dir);
if (bad.length) {
  console.error('check-dist FAILED:\n' + bad.join('\n'));
  process.exit(1);
}
console.log(`check-dist OK (${dir}: no mock code, no source maps)`);
