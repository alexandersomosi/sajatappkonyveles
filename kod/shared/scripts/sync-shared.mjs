#!/usr/bin/env node
// Copies kod/shared (src/*.ts, brand.json, demo/fixtures.json) into <targetDir> (e.g. src/_shared)
// with a "GENERATED" header. Usage from a package folder:  node ../shared/scripts/sync-shared.mjs src/_shared
// Never edit the copies; edit kod/shared and re-run. (SPEC §3.2)
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const target = resolve(process.cwd(), process.argv[2] ?? 'src/_shared');
const header = '// GENERATED from kod/shared – do not edit here. Edit kod/shared and re-run sync-shared.\n';

mkdirSync(target, { recursive: true });
mkdirSync(join(target, 'demo'), { recursive: true });
for (const f of readdirSync(join(root, 'src'))) {
  if (!f.endsWith('.ts')) continue;
  writeFileSync(join(target, f), header + readFileSync(join(root, 'src', f), 'utf8'));
}
writeFileSync(join(target, 'brand.json'), readFileSync(join(root, 'brand.json')));
writeFileSync(join(target, 'demo', 'fixtures.json'), readFileSync(join(root, 'demo', 'fixtures.json')));
console.log(`shared -> ${target}`);
