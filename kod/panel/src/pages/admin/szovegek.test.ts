// Every backend content text (backend/src/content/defaults.hu.json) gets a human description and a sample preview
// with no "[placeholder]" left in it.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { minta, szovegLeiras } from './Szovegek';

const defaults = JSON.parse(readFileSync(resolve(__dirname, '../../../../backend/src/content/defaults.hu.json'), 'utf8')) as Record<string, string>;

describe('GYIK és szövegek: értesítés/e-mail szövegek', () => {
  it('minden kulcsnak van emberi leírása', () => {
    const nincs = Object.keys(defaults).filter((k) => !szovegLeiras(k));
    expect(nincs).toEqual([]);
  });
  it('az előnézet minden kitöltendő részt mintaadattal tölt ki', () => {
    const marad = Object.entries(defaults).filter(([, v]) => /\[[a-zA-Z]+\]/.test(minta(v))).map(([k]) => k);
    expect(marad).toEqual([]);
  });
});
