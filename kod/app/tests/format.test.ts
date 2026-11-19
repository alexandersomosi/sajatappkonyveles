// node --test tests/  (Node ≥ 22.6 típuseltávolítással; a tesztelt modulok függőség nélküliek)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  szam, forint, napAnEn, datumAn, datumIg, hataridoSav, mikor, mikorIdovel, teljesIdo, budapestNap,
  negyedevNev, honapNev, honapMelleknev, honapEltol, hatraVan, napKulonbseg, reszek, szazalek, NBSP,
} from '../src/lib/format.ts';

test('pénz: nem törő szóközös ezres tagolás', () => {
  assert.equal(szam(457380), `457${NBSP}380`);
  assert.equal(szam(20000000), `20${NBSP}000${NBSP}000`);
  assert.equal(szam(999), '999');
  assert.equal(szam(-1500), `−1${NBSP}500`);
  assert.equal(forint(510471), `510${NBSP}471${NBSP}Ft`);
});

test('napok toldaléka (-án/-én/-jén)', () => {
  const vart: Record<number, string> = { 1: '1-jén', 2: '2-án', 3: '3-án', 4: '4-én', 5: '5-én', 6: '6-án', 7: '7-én', 8: '8-án', 9: '9-én',
    10: '10-én', 11: '11-én', 12: '12-én', 13: '13-án', 20: '20-án', 21: '21-én', 22: '22-én', 23: '23-án', 30: '30-án', 31: '31-én' };
  for (const [n, s] of Object.entries(vart)) assert.equal(napAnEn(Number(n)), s);
});

test('dátumok a dizájn szavaival', () => {
  assert.equal(datumAn('2026-10-09'), 'október 9-én');
  assert.equal(datumAn('2026-10-02'), 'október 2-án');
  assert.equal(datumIg('2026-10-12'), 'október 12-ig');
  assert.equal(hataridoSav('2026-10-12'), 'Október 12-ig, hétfőig');
  assert.equal(hataridoSav('2027-01-12'), 'Január 12-ig, keddig');
});

test('Budapest idő: nyári és téli eltolás', () => {
  assert.equal(budapestNap('2026-10-24T22:30:00Z'), '2026-10-25'); // CEST, +2
  assert.equal(budapestNap('2026-11-17T22:59:00Z'), '2026-11-17'); // CET, +1
  assert.equal(budapestNap('2026-11-17T23:00:00Z'), '2026-11-18');
  const r = reszek('2026-07-01T07:20:00Z');
  assert.equal(`${r.ora}:${r.perc}`, '9:20');
});

test('viszonylagos idő', () => {
  const ma = '2026-11-17'; // kedd
  assert.equal(mikor('2026-11-17T08:00:00Z', ma), 'ma');
  assert.equal(mikor('2026-11-16T15:40:00Z', ma), 'tegnap');
  assert.equal(mikor('2026-11-13T09:00:00Z', ma), 'pénteken');
  assert.equal(mikor('2026-10-02T09:00:00Z', ma), 'október 2-án');
  assert.equal(mikorIdovel('2026-11-16T19:31:00Z', ma), 'tegnap 20:31');
  assert.equal(mikorIdovel('2026-11-17T07:47:00Z', ma), 'ma 8:47');
  assert.equal(teljesIdo('2026-10-03T16:40:00Z'), 'Szombat, október 3., 18:40');
});

test('negyedév, hónap, hátralévő napok', () => {
  assert.equal(negyedevNev('2026-Q3'), 'III. negyedév');
  assert.equal(honapNev('2026-10'), 'Október');
  assert.equal(honapMelleknev('2026-11'), 'novemberi');
  assert.equal(honapEltol('2026-01', -1), '2025-12');
  assert.equal(honapEltol('2026-11', 2), '2027-01');
  assert.equal(hatraVan(3), 'még 3 nap');
  assert.equal(hatraVan(0), 'ma jár le');
  assert.equal(hatraVan(-1), 'lejárt');
  assert.equal(napKulonbseg('2026-10-09', '2026-10-12'), 3);
  assert.equal(szazalek(0.4121), '41%');
  assert.equal(szazalek(0.8157, 1), '81,6%');
});

import { neveloSzam, utalasFej, becslesFej, mindElutaltad, mindTargy } from '../src/lib/format.ts';
test('névelő szám előtt: az első számcsoport kiejtése szerint', () => {
  assert.equal(neveloSzam(510471), 'az');
  assert.equal(neveloSzam(1200), 'az');
  assert.equal(neveloSzam(1250000), 'az');
  assert.equal(neveloSzam(1), 'az');
  assert.equal(neveloSzam(159302), 'a');
  assert.equal(neveloSzam(121980), 'a');
  assert.equal(neveloSzam(12000), 'a');
  assert.equal(neveloSzam(19999), 'a');
  assert.equal(neveloSzam(457380), 'a');
  assert.equal(neveloSzam(50000), 'az');
});
test('utalások száma szóval, tárgyesetben is', () => {
  assert.equal(utalasFej(1), 'Egy utalás a NAV-nak, egy számlaszámra');
  assert.equal(utalasFej(2), '2 külön utalás a NAV-nak, 2 számlaszámra');
  assert.equal(utalasFej(3), '3 külön utalás a NAV-nak, 3 számlaszámra');
  assert.equal(becslesFej(2), 'Becslés: két külön utalás lesz a NAV-nak');
  assert.equal(mindElutaltad(1), 'Elutaltad');
  assert.equal(mindElutaltad(2), 'Mindkettőt elutaltad');
  assert.equal(mindElutaltad(3), 'Mind a hármat elutaltad');
  assert.equal(mindTargy(2), 'mindkettőt');
  assert.equal(mindTargy(3), 'mind a hármat');
});

import { datumE, napE, honapCim } from '../src/lib/format.ts';
test('birtokos ragos nap és más évi hónapcím', () => {
  assert.equal(napE(1), '1-je');
  assert.equal(napE(2), '2-a');
  assert.equal(napE(3), '3-a');
  assert.equal(napE(5), '5-e');
  assert.equal(napE(10), '10-e');
  assert.equal(napE(12), '12-e');
  assert.equal(napE(20), '20-a');
  assert.equal(napE(30), '30-a');
  assert.equal(napE(31), '31-e');
  assert.equal(datumE('2026-11-10'), 'november 10-e');
  assert.equal(datumE('2026-10-12'), 'október 12-e');
  assert.equal(honapCim('2026-11', 2026), 'November');
  assert.equal(honapCim('2027-01', '2026'), '2027. január');
  assert.equal(honapCim('2027-05', 2026), '2027. május');
});
