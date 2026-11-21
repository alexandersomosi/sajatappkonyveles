// SPEC §32 – a közös fizetési lap és a kata-keret sáv: állapot, fejléc, mondatok, másolandó értékek, sávszín.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { allapotMondat, fizetesAllapot, fizetesFej, keretSzin, masolando, nyitottTetelek, savKitoltes } from '../src/lib/kata.ts';
import type { PaymentItem, TaxPeriodDetail } from '../src/_shared/api.ts';
import { KATA_F1_TEXTS, PAYMENT_SHEET_TEXTS } from '../src/_shared/kata.ts';

const tetel = (o: Partial<PaymentItem> = {}): PaymentItem => ({
  id: 'i1',
  kind: 'kata_teteles',
  label: 'Kata',
  amountHuf: 50_000,
  dueDate: '2026-12-14',
  accountName: 'NAV Kisadózó vállalkozások adója bevételi számla',
  accountNumber: '10032000-01076349',
  iban: 'HU27100320000107634900000000',
  reference: '12345678-1-42',
  ...o,
});
const idoszak = (o: Partial<TaxPeriodDetail> = {}): TaxPeriodDetail => ({
  id: 'p1',
  periodKey: '2026-11-KATA',
  kind: 'kata',
  label: 'Kata – november',
  sheetTitle: 'Kata – november',
  dueDate: '2026-12-14',
  calcStatus: 'jovahagyva',
  paymentStatus: 'fizetendo',
  filingStatus: 'nincs',
  totalHuf: 50_000,
  items: [tetel()],
  explanation: null,
  disclaimer: null,
  letter: null,
  filed: null,
  exemptReasonLabel: null,
  ...o,
});

test('fizetési lap: az állapot a szerver adataiból', () => {
  assert.equal(fizetesAllapot(idoszak()), 'fizetendo');
  assert.equal(fizetesAllapot(idoszak({ paymentStatus: 'befizetve_jelezve' })), 'jelolve');
  assert.equal(fizetesAllapot(idoszak({ paymentStatus: 'ellenorizve' })), 'rendben');
  assert.equal(fizetesAllapot(idoszak({ paymentStatus: 'elteres' })), 'elteres');
  assert.equal(fizetesAllapot(idoszak({ items: [], exemptReasonLabel: 'táppénz', paymentStatus: 'nincs_fizetendo' })), 'mentes');
  assert.equal(fizetesAllapot(idoszak({ items: [], calcStatus: 'becsles', paymentStatus: 'nincs_fizetendo' })), 'nincs_osszeg');
  assert.equal(fizetesAllapot(idoszak({ kind: 'negyedev', items: [], calcStatus: 'becsles' })), 'nincs_jovahagyva');
});

test('fizetési lap: fejléc – határidő, lejárt, több számla', () => {
  assert.deepEqual(fizetesFej(idoszak(), '2026-11-21'), { cim: 'Kata – november', al: 'Utald el december 14-ig.', tobb: null });
  assert.equal(fizetesFej(idoszak(), '2026-12-15').al, 'Lejárt: december 14. volt a határidő. Utald el minél előbb.');
  const ketto = idoszak({ items: [tetel(), tetel({ id: 'i2', kind: 'szja_eloleg', label: 'SZJA-előleg' })] });
  assert.equal(fizetesFej(ketto, '2026-11-21').tobb, '2 külön tétel, 2 számlára. A bankodban külön utalásként add fel.');
  assert.equal(nyitottTetelek([tetel({ markedPaidAt: '2026-11-21T10:00:00Z' }), tetel({ id: 'i2' })]).length, 1);
});

test('fizetési lap: a mondatok a könyvelő nevével; csak jelölés', () => {
  assert.equal(allapotMondat('jelolve', 'Dávid'), 'Befizetted, Dávid ellenőrzi.');
  assert.equal(allapotMondat('rendben', 'Dávid'), 'Rendben: Dávid látta a befizetésedet.');
  assert.equal(allapotMondat('elteres', 'Dávid'), 'Dávid eltérést talált. Nézd meg az üzenetét.');
  assert.equal(allapotMondat('mentes', 'Dávid', 'táppénz'), 'Erre a hónapra nem kell katát fizetned (táppénz).');
  assert.equal(allapotMondat('nincs_osszeg', 'Dávid'), 'Az összeget Dávid még megerősíti.');
  assert.equal(allapotMondat('fizetendo', 'Dávid'), null);
  assert.equal(PAYMENT_SHEET_TEXTS.jelolesAl, 'Ez csak jelölés: pénzt nem vonunk le, nem utalunk.');
});

test('fizetési lap: másoláskor a számlaszám és az összeg szóköz nélkül, a közlemény az adószám', () => {
  const t = tetel({ accountNumber: '10032000-01076349' });
  assert.equal(masolando('szamlaszam', t), '10032000-01076349');
  assert.equal(masolando('osszeg', t), '50000');
  assert.equal(masolando('kozlemeny', t), '12345678-1-42');
});

test('kata-keret sáv: zöld, borostyán 80 %-tól, piros a keret fölött; a kitöltés 0–100', () => {
  assert.equal(keretSzin('rendben'), 'zold');
  assert.equal(keretSzin('figyelem'), 'borostyan');
  assert.equal(keretSzin('tullepve'), 'piros');
  assert.equal(savKitoltes(112), 100);
  assert.equal(savKitoltes(-3), 0);
  assert.equal(savKitoltes(Number.NaN), 0);
  assert.equal(savKitoltes(79.6), 80);
});

test('szövegek: tegező, nincs „a(z)”, nincs beégetett könyvelőnév, nincs időígéret', () => {
  for (const s of [...Object.values(KATA_F1_TEXTS), ...Object.values(PAYMENT_SHEET_TEXTS)]) {
    assert.doesNotMatch(s, /a\(z\)/i);
    assert.doesNotMatch(s, /\bBence\b/);
    assert.doesNotMatch(s, /órán belül|munkanapon belül|percen belül/);
  }
});

test('H8: az éves zárás képernyőjén nincs beégetett „Bence”', () => {
  const src = readFileSync(join(import.meta.dirname, '../src/app/eves-zaras/index.tsx'), 'utf8');
  assert.doesNotMatch(src, /\bBence\b/);
});

test('a fizetési lap képernyője létezik, és a jelölés gombja alatt ott a „csak jelölés” mondat', () => {
  const src = readFileSync(join(import.meta.dirname, '../src/app/fizetes/[id].tsx'), 'utf8');
  assert.match(src, /P\.jeloles\b/);
  assert.match(src, /P\.jelolesAl/);
  assert.match(src, /useBefizettem/);
});
