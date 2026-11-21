// SPEC §32.B – az éves bevallás jóváhagyása, a különbözet, az idővonal és az önellenőrzés segédfüggvényei; és a képernyők
// szabályai (nincs beégetett könyvelőnév, nincs „a(z)”, a jóváhagyás a szerver hash-ével megy).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { idovonalCimke, jovahagyasUt, jovahagyhato, kulonbozetUt, onellEredmeny, osszegSor } from '../src/lib/eves.ts';
import { EVES_TEXTS } from '../src/_shared/eves.ts';

test('idővonal-címke: Kész, Most, Lejárt; a jövőbeli sor csak dátum', () => {
  assert.equal(idovonalCimke('kesz'), 'Kész');
  assert.equal(idovonalCimke('most'), 'Most');
  assert.equal(idovonalCimke('lejart'), 'Lejárt');
  assert.equal(idovonalCimke('kovetkezik'), '');
});

test('összesítő-sor: a levonás „−” előjelet kap, a szám pozitív', () => {
  assert.deepEqual(osszegSor({ label: 'Eddig befizetett szja-előleg', amountHuf: 120_000, sign: '−' }), { cim: 'Eddig befizetett szja-előleg', huf: 120_000, elotte: '−', al: null });
  assert.deepEqual(osszegSor({ label: 'Kereted', amountHuf: 15_000_000, note: '10 hónap × 1 500 000 Ft' }), { cim: 'Kereted', huf: 15_000_000, elotte: null, al: '10 hónap × 1 500 000 Ft' });
});

test('jóváhagyás: az összesítőre visz, ha a könyvelő beírta a számokat; különben a tervezet iratára', () => {
  const draft = { id: 'd1' } as never;
  assert.equal(jovahagyasUt({ status: 'jovahagyasra_var', summary: {} as never, draft }), '/eves-zaras/jovahagyas');
  assert.equal(jovahagyasUt({ status: 'jovahagyasra_var', summary: null, draft }), '/tetel/d1');
  assert.equal(jovahagyasUt({ status: 'konyvelonel', summary: null, draft }), null);
  assert.equal(jovahagyhato({ status: 'jovahagyasra_var', approvalHash: 'a'.repeat(64), approval: null }), true);
  assert.equal(jovahagyhato({ status: 'jovahagyasra_var', approvalHash: 'a'.repeat(64), approval: { at: '2027-04-20T09:00:00Z', hash: 'x' } }), false);
  assert.equal(jovahagyhato({ status: 'jovahagyasra_var', approvalHash: null, approval: null }), false);
});

test('különbözet: a nyitott befizetés a fizetési lapra visz; az ellenőrzött nem', () => {
  const s = { diffHuf: 50_000, filedOn: '2027-04-20', filingRef: 'IKT', periodId: 'p1', paymentStatus: 'fizetendo', refund: null, text: 'x' };
  assert.equal(kulonbozetUt({ settlement: s }), '/fizetes/p1');
  assert.equal(kulonbozetUt({ settlement: { ...s, paymentStatus: 'ellenorizve' } }), null);
  assert.equal(kulonbozetUt({ settlement: null }), null);
});

test('önellenőrzés: fizetendő, a javára, vagy egyik sem', () => {
  assert.equal(onellEredmeny({ totalHuf: 103_000, inFavourHuf: 0 }), 'fizetendo');
  assert.equal(onellEredmeny({ totalHuf: 0, inFavourHuf: 3_000 }), 'javara');
  assert.equal(onellEredmeny({ totalHuf: 0, inFavourHuf: 0 }), null);
});

test('a szövegek: nincs „a(z)”, nincs beégetett név; a visszajáró szabálya törvényi (Art. 64. § (1))', () => {
  const all = JSON.stringify(EVES_TEXTS);
  assert.doesNotMatch(all, /a\(z\)/i);
  assert.doesNotMatch(all, /\bBence\b/);
  assert.match(EVES_TEXTS.osszesito.visszajarSzabaly, /30 napon belül, de legkorábban \{ev\}\. március 1-jén/);
  for (const f of ['../src/app/eves-zaras/index.tsx', '../src/app/eves-zaras/jovahagyas.tsx', '../src/app/onellenorzes/[id].tsx']) {
    const src = readFileSync(join(import.meta.dirname, f), 'utf8');
    assert.doesNotMatch(src, /\bBence\b/, f);
    assert.doesNotMatch(src, /a\(z\)/, f);
  }
  // the approval sends the server's hash – the app never computes it
  const jsrc = readFileSync(join(import.meta.dirname, '../src/app/eves-zaras/jovahagyas.tsx'), 'utf8');
  assert.match(jsrc, /hash: z\.approvalHash/);
});
