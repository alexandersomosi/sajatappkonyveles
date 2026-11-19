import { describe, expect, it } from 'vitest';
import { datumIg, elvalaszt, elvalasztSzo } from './format';

const lathato = (s: string) => s.replace(/­/g, '-');

describe('elválasztás (lágy kötőjel)', () => {
  it('szótagolja a hosszú szavakat', () => {
    expect(lathato(elvalasztSzo('bankszámlakivonatodat'))).toBe('bank-szám-la-ki-vo-na-to-dat');
    expect(lathato(elvalasztSzo('Köztartozásmentességi'))).toBe('Köz-tar-to-zás-men-tes-sé-gi');
    expect(lathato(elvalasztSzo('Jövedelemigazolás'))).toBe('Jö-ve-de-lem-iga-zo-lás');
  });
  it('rövid szót, számot, vegyes szót nem bánt', () => {
    expect(elvalasztSzo('kérés')).toBe('kérés');
    expect(elvalaszt('2026-Q3 SZJA')).toBe('2026-Q3 SZJA');
    expect(elvalasztSzo('anna.toth@demo')).toBe('anna.toth@demo');
  });
});

describe('datumIg', () => {
  it('a dátum pontja elmarad a rag előtt', () => {
    expect(datumIg('2026-11-18')).toBe('november 18-ig');
    expect(datumIg('2026-10-12', { ev: true })).toBe('2026. október 12-ig');
  });
});

import { hetFelirat } from '../pages/acc/HataridoFigyelo';
describe('hetFelirat', () => {
  it('nem mutat nyers ISO-hetet', () => {
    expect(hetFelirat('2026-W47', '2026-11-18')).toBe('Ez a hét');
    expect(hetFelirat('2026-W48', '2026-11-18')).toBe('Jövő hét');
    expect(hetFelirat('2026-W46', '2026-11-18')).toBe('Múlt hét');
    expect(hetFelirat('2026-W50', '2026-11-18')).toBe('50. hét');
    expect(hetFelirat('2027-W01', '2026-12-30')).toBe('Jövő hét');
  });
});
