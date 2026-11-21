// SPEC §32 (éves ciklus, F3) – önellenőrzési pótlék suggestion and the refund date (terv 8.1, kritika 1. és 2.3).
// Hand-computed: 5,5 % / 365 = 0,01506…% → 0,015 %/nap (Art. 209. § (2)); 100 000 Ft × 0,015 % × 200 nap = 3 000 Ft.
import { describe, expect, it } from 'vitest';
import { baseRateOn, BASE_RATES, hungarianIban, isValidIban, NAV_ACCOUNTS_EV, refundExpectedBy, selfRevisionSurcharge, SELF_REVISION_CAP_HUF } from '../src/index.js';

describe('önellenőrzési pótlék (Art. 212. §)', () => {
  it('100 000 Ft, 200 days after 2026-08-26 → 3 000 Ft; repeated → 4 500 Ft (× 1,5)', () => {
    // due 2026-09-01, the days run 09-02 … 2027-03-20 = 200 days
    const r = selfRevisionSurcharge({ amountHuf: 100_000, dueDate: '2026-09-01', filedOn: '2027-03-20' });
    expect(r).toMatchObject({ huf: 3_000, days: 200, reason: null, repeated: false, capped: false });
    expect(r.rows).toEqual([{ from: '2026-09-02', to: '2027-03-20', days: 200, ratePct: 5.5, dailyPct: 0.015, huf: 3_000 }]);
    expect(selfRevisionSurcharge({ amountHuf: 100_000, dueDate: '2026-09-01', filedOn: '2027-03-20', repeated: true }).huf).toBe(4_500);
  });
  it('a day before the first known base rate → no suggestion (the accountant uses the NAV calculator)', () => {
    const r = selfRevisionSurcharge({ amountHuf: 100_000, dueDate: '2026-07-31', filedOn: '2026-10-01' });
    expect(r).toMatchObject({ huf: null, reason: 'nincs_kamat' });
    expect(baseRateOn('2026-08-25')).toBeNull();
    expect(baseRateOn('2026-08-26')).toBe(5.5);
  });
  it('Art. 212. § (2): paid in full → at most 5 000 Ft', () => {
    const big = selfRevisionSurcharge({ amountHuf: 1_000_000, dueDate: '2026-09-01', filedOn: '2027-03-20', paidInFull: true });
    expect(big).toMatchObject({ huf: SELF_REVISION_CAP_HUF, capped: true });
    expect(selfRevisionSurcharge({ amountHuf: 100_000, dueDate: '2026-09-01', filedOn: '2027-03-20', paidInFull: true })).toMatchObject({ huf: 3_000, capped: false });
  });
  it('Art. 211. § (3) a) → 0; 212. § (3) and (5) → by hand; in the client\'s favour → 0', () => {
    const b = { amountHuf: 100_000, dueDate: '2026-09-01', filedOn: '2027-03-20' };
    expect(selfRevisionSurcharge({ ...b, certificateError: true })).toMatchObject({ huf: 0, reason: 'igazolas_hiba' });
    expect(selfRevisionSurcharge({ ...b, laterReturn: true })).toMatchObject({ huf: null, reason: 'kesobbi_bevallas' });
    expect(selfRevisionSurcharge({ ...b, chained: true })).toMatchObject({ huf: null, reason: 'lancolt' });
    expect(selfRevisionSurcharge({ ...b, amountHuf: -20_000 })).toMatchObject({ huf: 0, reason: 'nincs_fizetendo' });
  });
  it('a rate change splits the days (each day with its own rate)', () => {
    const rates = [...BASE_RATES, { from: '2027-01-01', pct: 3.65 }];
    // 2026-12-02 … 12-31 = 30 days at 0,015 %; 2027-01-01 … 01-10 = 10 days at 0,010 %
    const r = selfRevisionSurcharge({ amountHuf: 1_000_000, dueDate: '2026-12-01', filedOn: '2027-01-10', rates });
    expect(r.rows.map((x) => [x.days, x.dailyPct])).toEqual([
      [30, 0.015],
      [10, 0.01],
    ]);
    expect(r.huf).toBe(4_500 + 1_000);
  });
});

describe('visszajáró szja (Art. 64. § (1))', () => {
  it('30 days after the return, at the earliest from 1 March of the next year', () => {
    expect(refundExpectedBy('2027-04-20', 2026)).toBe('2027-05-20');
    expect(refundExpectedBy('2027-01-10', 2026)).toBe('2027-03-31');
  });
});

describe('NAV accounts of the annual cycle', () => {
  it('215 (önellenőrzés, bírság) and 138 (késedelmi pótlék): valid IBANs', () => {
    for (const a of Object.values(NAV_ACCOUNTS_EV)) {
      expect(a.iban).toBe(hungarianIban(a.number));
      expect(isValidIban(a.iban)).toBe(true);
    }
    expect(NAV_ACCOUNTS_EV.onellenorzes.number).toBe('10032000-01076301');
    expect(NAV_ACCOUNTS_EV.kesedelmiPotlek.number).toBe('10032000-01076985');
  });
});
