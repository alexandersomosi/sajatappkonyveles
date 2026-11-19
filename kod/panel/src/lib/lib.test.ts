import { describe, expect, it } from 'vitest';
import { datum, ft, hataridoMondat, hatridoSzoveg, idopont, negyedevNev, parseFt, szam } from './format';
import { adoazonositoOk, adoszamOk, ajanloKodOk, fajlHiba, ismeretlenHelyorzok, torzsszamOk } from './validate';
import { isoWeek } from './today';
import fixtures from '../_shared/demo/fixtures.json';

describe('format', () => {
  it('money uses no-break space grouping and Ft', () => {
    expect(szam(510471)).toBe('510 471');
    expect(ft(20000)).toBe('20 000 Ft');
    expect(szam(-1500)).toBe('−1 500');
    expect(ft(null)).toBe('–');
  });
  it('parses forint input', () => {
    expect(parseFt('1 240 000')).toBe(1240000);
    expect(parseFt('1.240.000 Ft')).toBe(1240000);
    expect(parseFt('-18000')).toBe(-18000);
    expect(parseFt('12,5')).toBeNull();
    expect(parseFt('')).toBeNull();
  });
  it('Hungarian dates', () => {
    expect(datum('2026-10-12')).toBe('október 12.');
    expect(datum('2027-01-12', { ev: true, nap: true })).toBe('2027. január 12., kedd');
    expect(hataridoMondat('2026-10-12')).toBe('Október 12-ig, hétfőig');
    expect(hataridoMondat('2027-01-12')).toBe('Január 12-ig, keddig');
    expect(hatridoSzoveg('2026-11-20', '2026-11-17')).toBe('még 3 nap');
    expect(hatridoSzoveg('2026-11-10', '2026-11-17')).toBe('7 napja lejárt');
    expect(hatridoSzoveg('2026-11-18', '2026-11-17')).toBe('holnap');
  });
  it('relative timestamps in Europe/Budapest', () => {
    expect(idopont('2026-11-17T08:02:00Z', '2026-11-17')).toBe('ma 9:02');
    expect(idopont('2026-11-16T19:31:00Z', '2026-11-17')).toBe('tegnap 20:31');
    expect(idopont('2026-10-02T14:40:00Z', '2026-11-17')).toBe('október 2. 16:40');
  });
  it('period names', () => {
    expect(negyedevNev('2026-Q3')).toBe('2026. III. negyedév');
    expect(negyedevNev('2026-HIPA-1')).toBe('2026. iparűzési adóelőleg (1. részlet)');
  });
  it('ISO weeks', () => {
    expect(isoWeek('2026-11-17')).toBe('2026-W47');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
  });
});

describe('validate', () => {
  it('accepts the fictional demo tax ids (formally valid) and rejects broken ones', () => {
    for (const k of ['kata', 'reka', 'peter'] as const) {
      expect(adoszamOk(fixtures.taxIds[k].adoszam)).toBe(true);
      expect(adoazonositoOk(fixtures.taxIds[k].adoazonositoJel)).toBe(true);
    }
    expect(adoazonositoOk(fixtures.taxIds.bence.adoazonositoJel)).toBe(true);
    expect(adoszamOk('68801234-1-4')).toBe(false);
    expect(torzsszamOk('68801235')).toBe(false);
    expect(adoazonositoOk('8417104568')).toBe(false);
    expect(adoazonositoOk('7417104569')).toBe(false);
  });
  it('placeholder check', () => {
    expect(ismeretlenHelyorzok('{firstName} kiszámolta: {amount}', ['firstName', 'amount'])).toEqual([]);
    expect(ismeretlenHelyorzok('{firstname} {osszeg}', ['firstName'])).toEqual(['firstname', 'osszeg']);
  });
  it('referral codes', () => {
    expect(ajanloKodOk('KATA7Q2X')).toBe(true);
    expect(ajanloKodOk('kata7q2x')).toBe(false);
    expect(ajanloKodOk('ABC')).toBe(false);
  });
  it('upload rules (type, 25 MB)', () => {
    const f = (name: string, type: string, size: number) => new File([new Uint8Array(Math.min(size, 10))], name, { type }) as File & { size: number };
    expect(fajlHiba(f('a.pdf', 'application/pdf', 10))).toBeNull();
    expect(fajlHiba(f('a.exe', 'application/x-msdownload', 10))).toMatch(/csak PDF/);
    const big = f('b.pdf', 'application/pdf', 10);
    Object.defineProperty(big, 'size', { value: 26 * 1024 * 1024 });
    expect(fajlHiba(big)).toMatch(/25 MB/);
  });
});
