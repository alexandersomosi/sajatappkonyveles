#!/usr/bin/env node
// Copies the JSON files from src/_shared (made by `npm run sync-shared`) to dist/_shared so the built
// package can read brand.json and the demo fixtures at runtime. Never edit the copies.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const rel of ['brand.json', 'demo/fixtures.json']) {
  const from = join(root, 'src', '_shared', rel);
  const to = join(root, 'dist', '_shared', rel);
  if (!existsSync(from)) {
    console.error(`missing ${from} – run "npm run sync-shared" first`);
    process.exit(1);
  }
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
console.log('assets -> dist/_shared');
