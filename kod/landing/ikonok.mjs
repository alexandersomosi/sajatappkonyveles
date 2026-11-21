#!/usr/bin/env node
// The Fluent Emoji Flat icons of the page (MIT, github.com/microsoft/fluentui-emoji; licence: vendor/) – the same set as the
// app design (dizajn/C5_v2/v2.js, var EMOJI). This writes ONLY the icons the template uses (<!--ikon:név--> in
// oldal.sablon.html) into ikonok.json, so the live build does not depend on the design folder. Run it again only when the
// template gets a new icon (build.mjs stops with a message if one is missing).
//   node kod/landing/ikonok.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITT = dirname(fileURLToPath(import.meta.url));
const FORRAS = resolve(ITT, '../../dizajn/C5_v2/v2.js');
const v2 = readFileSync(FORRAS, 'utf8');
const i = v2.indexOf('var EMOJI = ') + 12;
const j = v2.indexOf('\n', i);
let t = v2.slice(i, j).trim();
if (t.endsWith(';')) t = t.slice(0, -1);
const EMOJI = JSON.parse(t);
const sablon = readFileSync(join(ITT, 'oldal.sablon.html'), 'utf8');
const nevek = [...new Set([...sablon.matchAll(/<!--ikon:([a-z-]+)-->/g)].map((m) => m[1]))].sort();
const ikonok = {};
for (const n of nevek) {
  if (!EMOJI[n]) throw new Error(`Nincs ilyen ikon a dizajn/C5_v2/v2.js-ben: ${n}`);
  ikonok[n] = EMOJI[n];
}
writeFileSync(
  join(ITT, 'ikonok.json'),
  JSON.stringify({ _megjegyzes: 'GENERÁLT (kod/landing/ikonok.mjs) a dizajn/C5_v2/v2.js EMOJI-ból: Fluent Emoji Flat, MIT (vendor/LICENSE_fluentui-emoji_MIT.txt). [viewBox, SVG-tartalom].', ikonok }, null, 1) + '\n',
  'utf8',
);
console.log(`ikonok.json: ${nevek.length} ikon (${nevek.join(', ')})`);
