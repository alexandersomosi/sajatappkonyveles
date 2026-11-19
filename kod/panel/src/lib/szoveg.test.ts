// SPEC §27.5.4 / §27.12 K4.4, K5.1 – wording checks over the panel sources (team-facing texts):
// one wording for the client's issued invoices (never "a NAV-tól jött számla"), "anyja (születési) neve" only, no
// "anyád" / "édesanyád", one name for the certificate, the product name only from brand.json, and the form number.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INVOICE_WORDING_FORBIDDEN_PATTERNS } from '../_shared/bekotes';
import { jarulekNyomtatvany } from './format';

const src = resolve(__dirname, '..');
function fajlok(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === '_shared' ? [] : fajlok(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}
/** Every line of every panel source, without comments that quote a forbidden form on purpose (`// szándékos`). */
const sorok = fajlok(src).flatMap((f) =>
  readFileSync(f, 'utf8')
    .split('\n')
    .map((l, i) => ({ hol: `${relative(src, f)}:${i + 1}`, l }))
    .filter((x) => !x.l.includes('szándékos')),
);

describe('panel wording (SPEC §27.5, §27.4)', () => {
  it('no forbidden invoice wording ("NAV-tól jött számla", "NAV-ból jövő számlák" …)', () => {
    const minták = INVOICE_WORDING_FORBIDDEN_PATTERNS.map((p) => new RegExp(p, 'iu'));
    const talalat = sorok.filter((x) => minták.some((m) => m.test(x.l))).map((x) => x.hol);
    expect(talalat).toEqual([]);
  });
  it('no "NAV-számla" / "NAV-számlák" as a name of the issued invoices', () => {
    const talalat = sorok.filter((x) => /NAV-száml/u.test(x.l)).map((x) => x.hol);
    expect(talalat).toEqual([]);
  });
  it('no "anyád" / "édesanyád" (the panel says "anyja születési neve")', () => {
    const talalat = sorok.filter((x) => /(?<!\p{L})(anyád|édesanyád)/iu.test(x.l)).map((x) => x.hol);
    expect(talalat).toEqual([]);
  });
  it('one name for the certificate: "Köztartozásmentességi igazolás"', () => {
    const talalat = sorok.filter((x) => /köztartozás-mentes|köztartozásmentes igazolás/iu.test(x.l)).map((x) => x.hol);
    expect(talalat).toEqual([]);
  });
  it('the product name is never hard-coded in UI text (brand.json)', () => {
    const talalat = sorok.filter((x) => /['"`>][^'"`<]*Kézjegy/u.test(x.l) && !x.l.trim().startsWith('//') && !x.l.trim().startsWith('*')).map((x) => x.hol);
    // the mock /config answer mirrors brand.json on purpose
    expect(talalat.filter((h) => !h.startsWith('mock'))).toEqual([]);
  });
  it('the quarterly contribution form follows the year (2658 → 2758)', () => {
    expect(jarulekNyomtatvany(2026)).toBe('2658');
    expect(jarulekNyomtatvany(2027)).toBe('2758');
  });
});
