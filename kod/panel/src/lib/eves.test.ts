// SPEC §32.B – the annual cycle helpers of the panel.
import { describe, expect, it } from 'vitest';
import { attekintoCsv, csvCell, evesKulonbozet, folyoszamlaElteres, folyoszamlaJavaslat, lattamRendbenLehet, motorElteres } from './eves';
import type { YearOverviewRow } from '../_shared/eves';

describe('éves különbözet (A − B + C + Σ egyéb; kata: a különadó)', () => {
  it('átalány and KATA', () => {
    expect(evesKulonbozet('atalany', { szjaHuf: 150_000, advancesHuf: 120_000 })).toBe(30_000);
    expect(evesKulonbozet('atalany', { szjaHuf: 100_000, advancesHuf: 120_000, csjkHuf: -5_000, otherLines: [{ label: 'Munkabérből levont adó', amountHuf: -10_000 }] })).toBe(-35_000);
    expect(evesKulonbozet('kata', { kulonadoHuf: 800_000, szjaHuf: 1 })).toBe(800_000);
  });
  it('the engine comparison only above 1 000 Ft', () => {
    expect(motorElteres(30_000, 29_500)).toBeNull();
    expect(motorElteres(30_000, 20_000)).toBe(10_000);
    expect(motorElteres(30_000, null)).toBeNull();
  });
});

describe('folyószámla', () => {
  it('difference, suggested status; "rendben" only with the exact statement amount', () => {
    expect(folyoszamlaElteres(50_000, 0, 50_000)).toBe(0);
    expect(folyoszamlaElteres(15_000, 0, 0)).toBe(15_000);
    expect(folyoszamlaJavaslat([{ balanceHuf: 0, pendingHuf: 0, diffHuf: 0 }])).toBe('rendben');
    expect(folyoszamlaJavaslat([{ balanceHuf: -2_000, pendingHuf: 0, diffHuf: -2_000 }])).toBe('tulfizetes');
    expect(folyoszamlaJavaslat([{ balanceHuf: 50_000, pendingHuf: 0, diffHuf: 0 }])).toBe('hatralek');
    expect(folyoszamlaJavaslat([{ balanceHuf: 15_000, pendingHuf: 0, diffHuf: 15_000 }])).toBe('elteres');
    expect(lattamRendbenLehet(30_000, 30_000)).toBe(true);
    expect(lattamRendbenLehet(30_000, 29_000)).toBe(false);
    expect(lattamRendbenLehet(30_000, null)).toBe(false);
  });
});

describe('Éves áttekintő CSV', () => {
  it('";" separated, formula-like text guarded', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('a;b')).toBe('"a;b"');
    const row: YearOverviewRow = {
      clientId: 'c1',
      name: 'Évesné Éva',
      lifecycle: 'aktiv',
      regime: 'atalany',
      flags: [],
      quarters: [{ key: '2026-Q1', state: 'ellenorizve', filed: true, overdue: false }],
      kata: null,
      reconciliation: null,
      annual: { status: 'beadva', ball: 'konyvelo' },
      difference: { diffHuf: 50_000, settled: false, label: 'fizetendő' },
      hipa: { advance: 'ellenorizve', annual: 'nincs' },
      openCorrections: 0,
      missing: ['Nincs folyószámla-egyeztetés'],
      ball: 'konyvelo',
      overdue: false,
    };
    const csv = attekintoCsv([row]).split('\r\n');
    expect(csv[0]!.split(';')[0]).toBe('Ügyfél');
    // javító kör 11-21: words, not internal codes
    expect(csv[1]).toContain('Évesné Éva;Átalány;Q1: ellenőrizve (beadva);nincs;beadva;50000 (fizetendő);előleg: ellenőrizve, éves: nincs beadva');
  });
});
