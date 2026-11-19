// SPEC §7.6 C: the three demo clients as of 2026-11-17, from kod/shared/demo/fixtures.json.
// Checked twice: against the fixture's expectedTax2026 AND against the SPEC table typed in by hand.

import { describe, expect, it } from 'vitest';
import { calculateYear, DISCLAIMER } from '../src/index.js';
import { demoInput, fixtures, type Persona } from './helpers.js';

const PERSONAS: Persona[] = ['kata', 'reka', 'peter'];

// SPEC §7.6 C, typed from the table: [revenue, income, taxableYtd, base per month, TB, szocho, SZJA, total]
const SPEC_TABLE: Record<Persona, [number, number, number, number, number, number, number, number][]> = {
  kata: [
    [1_870_000, 1_028_500, 0, 322_800, 179_154, 125_892, 0, 305_046],
    [2_580_000, 1_419_000, 510_700, 322_800, 179_154, 125_892, 76_605, 381_651],
    [2_490_000, 1_369_500, 1_880_200, 322_800, 179_154, 125_892, 205_425, 510_471],
    [1_062_000, 584_100, 2_464_300, 322_800, 179_154, 125_892, 87_615, 392_661],
  ],
  reka: [
    [4_450_000, 890_000, 0, 373_200, 207_126, 145_548, 0, 352_674],
    [4_920_000, 984_000, 0, 373_200, 207_126, 145_548, 0, 352_674],
    [4_960_000, 992_000, 929_200, 373_200, 207_126, 145_548, 139_380, 492_054],
    [1_840_000, 368_000, 1_297_200, 373_200, 207_126, 145_548, 55_200, 407_874],
  ],
  peter: [
    [1_310_000, 720_500, 0, 0, 0, 0, 0, 0],
    [1_750_000, 962_500, 0, 0, 0, 0, 0, 0],
    [1_650_000, 907_500, 653_700, 217_900, 120_936, 84_981, 98_055, 303_972],
    [910_000, 500_500, 1_154_200, 166_833, 92_592, 65_064, 75_075, 232_731],
  ],
};

describe.each(PERSONAS)('%s', (who) => {
  const r = calculateYear(demoInput(who));

  it('revenue by received month matches the fixture', () => {
    expect(r.revenueByMonth.map((m) => m.amountHuf)).toEqual(fixtures.expectedReceivedByMonth[who]);
  });

  it('ÁFA meter (by delivery date) matches the fixture', () => {
    expect(r.meters.afa.usedHuf).toBe(fixtures.expectedAfaKeretUsedAsOfToday[who]);
  });

  it('quarters match fixtures.expectedTax2026', () => {
    const exp = fixtures.expectedTax2026[who];
    expect(r.quarters).toHaveLength(4);
    r.quarters.forEach((q, i) => {
      const e = exp[i]!;
      expect(q.quarter).toBe(e.q);
      expect(q.revenueHuf).toBe(e.revenue);
      expect(q.incomeHuf).toBe(e.income);
      expect(q.incomeYtdHuf).toBe(e.ytdIncome);
      expect(q.taxableYtdHuf).toBe(e.taxableYtd);
      expect(q.months.map((m) => m.baseHuf)).toEqual(e.monthlyBases.map((b) => b ?? 0));
      expect(q.cumulativeBasePerMonthHuf).toBe(Math.round(e.gongyoltBasePerMonth));
      expect([q.tbHuf, q.szochoHuf, q.szjaAdvanceHuf, q.totalHuf]).toEqual([e.tb, e.szocho, e.szjaAdvance, e.total]);
    });
  });

  it('quarters match the SPEC §7.6 C table', () => {
    r.quarters.forEach((q, i) => {
      const [rev, inc, tax, base, tb, sz, szja, total] = SPEC_TABLE[who][i]!;
      expect([q.revenueHuf, q.incomeHuf, q.taxableYtdHuf, q.tbHuf, q.szochoHuf, q.szjaAdvanceHuf, q.totalHuf]).toEqual([rev, inc, tax, tb, sz, szja, total]);
      expect(q.months.every((m) => m.baseHuf === base)).toBe(true);
    });
  });

  it('Q1–Q3 complete, Q4 still running (becslés) as of 2026-11-17', () => {
    expect(r.quarters.map((q) => q.complete)).toEqual([true, true, true, false]);
    expect(r.quarters[3]!.months.map((m) => m.future ?? false)).toEqual([false, false, true]);
    expect(r.quarters[3]!.explanation.result.startsWith('Eddig összesen:')).toBe(true);
  });

  it('every result says it is an estimate the accountant approves', () => {
    expect(r.disclaimer).toBe('Becslés. A végleges összeget a könyvelőd hagyja jóvá.');
    expect(DISCLAIMER).toBe(r.disclaimer);
    expect(r.estimate).toBe(true);
    for (const q of r.quarters) {
      expect(q.estimate).toBe(true);
      expect(q.disclaimer).toBe(r.disclaimer);
    }
  });

  it('payments add up to the total and point to the NAV accounts', () => {
    for (const q of r.quarters) {
      expect(q.payments.reduce((s, p) => s + p.amountHuf, 0)).toBe(q.totalHuf);
      for (const p of q.payments) {
        expect(p.amountHuf).toBeGreaterThan(0);
        expect(p.accountNumber).toMatch(/^10032000-0605\d{4}$/);
        expect(p.iban).toMatch(/^HU\d{26}$/);
      }
    }
  });
});

describe('meters as of 2026-11-17 (SPEC §7.6 C)', () => {
  it('Kata: ÁFA 8 242 000 Ft (41 %), no warning; adómentes reached in June', () => {
    const r = calculateYear(demoInput('kata'));
    expect(r.meters.afa).toMatchObject({ usedHuf: 8_242_000, limitHuf: 20_000_000, ratio: 0.4121, warning: false });
    expect(r.meters.afa.sentence).toBe('Még 11 758 000 Ft-ot számlázhatsz ÁFA nélkül.');
    // 1 028 500 + 484 000 (Apr) + 418 000 (May) = 1 930 500 < 1 936 800; + 517 000 (June) → reached
    expect(r.meters.adomentes).toMatchObject({ reached: true, reachedMonth: 6, usedIncomeHuf: 1_936_800 });
    expect(r.meters.adomentes.sentence).toBe('Az adómentes részt júniusban elérted.');
  });

  it('Réka: ÁFA 16 315 000 Ft = 81.6 % → warning (panel flag hatar_kozel)', () => {
    const r = calculateYear(demoInput('reka'));
    expect(r.meters.afa).toMatchObject({ usedHuf: 16_315_000, ratio: 0.8158, warning: true, remainingHuf: 3_685_000 });
    expect(r.warnings.map((w) => w.code)).toContain('afa_80');
    expect(r.warnings.find((w) => w.code === 'afa_80')?.text).toContain('(81,6%)');
    // Réka's 80 % ratio: listed activity, garantált bérminimum already set → no garantált check warning
    expect(r.warnings.map((w) => w.code)).not.toContain('garantalt_minimum_check');
  });

  it('Péter: ÁFA 5 620 000 Ft, mellékállás reminder for the accountant', () => {
    const r = calculateYear(demoInput('peter'));
    expect(r.meters.afa.usedHuf).toBe(5_620_000);
    expect(r.warnings.find((w) => w.code === 'mellekallas_condition')?.audience).toBe('konyvelo');
  });

  it('estimated received dates are flagged for the accountant', () => {
    const r = calculateYear(demoInput('kata'));
    const w = r.warnings.find((x) => x.code === 'received_on_estimated');
    expect(w?.audience).toBe('konyvelo');
  });

  it('HIPA (sávos, 2 %): Kata and Péter band a → 50 000 Ft; Réka annualised 18.4 M → band c → 170 000 Ft', () => {
    const k = calculateYear(demoInput('kata')).hipa!;
    const r = calculateYear(demoInput('reka')).hipa!;
    const p = calculateYear(demoInput('peter')).hipa!;
    expect([k.band, k.baseHuf, k.annualHuf]).toEqual(['a', 2_500_000, 50_000]);
    expect([p.band, p.baseHuf, p.annualHuf]).toEqual(['a', 2_500_000, 50_000]);
    // Réka: 16 170 000 received by 11-17 (day 321) → × 365 / 321 = 18 386 449 > 18 M
    expect(r.annualisedRevenueHuf).toBe(18_386_449);
    expect([r.band, r.baseHuf, r.annualHuf]).toEqual(['c', 8_500_000, 170_000]);
    // Htv. 39/A. § (9): the advance equals LAST year's tax – unknown here, so no amount is invented.
    expect(k.advances).toEqual([{ dueDate: '2026-06-01', amountHuf: null, label: 'Iparűzési adóelőleg (2026)' }]); // 31 May 2026 is a Sunday
    expect(k.annualDueDate).toBe('2027-05-31');
  });
});
