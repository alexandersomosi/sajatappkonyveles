#!/usr/bin/env node
// Az éles webes buildben (dist/) nem lehet MINTA-adat: kitalált nevek, a minta-szerver, mintaképek. Ha van, hibával kilép.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const gyoker = resolve(process.argv[2] || 'dist');
const tiltott = [/minta-konyvelo-bence/, /kata\.szabo@/, /Szabó Kata/, /Kovács Bence/, /assets\/minta\//];
const hibak = [];
(function bejar(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) bejar(p);
    else if (/\.(js|html|json)$/.test(f)) {
      const s = readFileSync(p, 'utf8');
      for (const r of tiltott) if (r.test(s)) hibak.push(`${p}: ${r}`);
    }
  }
})(gyoker);
if (hibak.length) {
  console.error('MINTA-adat az éles buildben:\n' + hibak.join('\n'));
  process.exit(1);
}
console.log(`rendben: ${gyoker} nem tartalmaz MINTA-adatot`);
