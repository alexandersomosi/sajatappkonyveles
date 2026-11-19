// Rules config, NAV accounts, deadlines calendar (SPEC §7.1, §7.4), helpers.

import { describe, expect, it } from 'vitest';
import {
  costRatioForActivity,
  deadlinesFor,
  easterSunday,
  ENGINE_VERSION,
  formatHuf,
  hungarianIban,
  isValidIban,
  isWorkingDay,
  nextWorkingDay,
  quarterDueDate,
  RULES_2026,
  RULES_2027,
  rulesForYear,
  statutoryHolidays,
} from '../src/index.js';
import { yearAdjective } from '../src/util/format.js';
import { roundDiv } from '../src/util/math.js';

describe('RULES_2026', () => {
  it('holds the 2026 values of SPEC §7.1', () => {
    expect(RULES_2026).toMatchObject({
      rulesVersion: '2026-01-01',
      validFrom: '2026-01-01',
      draft: false,
      minimumWageHuf: 322_800,
      guaranteedMinimumHuf: 373_200,
      costRatios: { general: 45, list80: 80, retail: 90 },
      taxFreeIncomeHuf: 1_936_800,
      szjaPermille: 150,
      tbPermille: 185,
      szochoPermille: 130,
      szochoMinimumPct: 100,
      atalanyCapHuf: 38_736_000,
      atalanyCapRetailHuf: 193_680_000,
      afaLimitHuf: 20_000_000,
    });
  });

  it('derived values are consistent: tax-free part = 6 × minimum wage; caps = 10× / 50× the annual minimum wage', () => {
    const annual = 12 * RULES_2026.minimumWageHuf; // 3 873 600
    expect(RULES_2026.taxFreeIncomeHuf).toBe(annual / 2);
    expect(RULES_2026.atalanyCapHuf).toBe(10 * annual);
    expect(RULES_2026.atalanyCapRetailHuf).toBe(50 * annual);
  });

  it('every rule set lists sources with https URLs', () => {
    for (const r of [RULES_2026, RULES_2027]) {
      expect(r.sources.length).toBeGreaterThan(5);
      for (const s of r.sources) expect(s.url).toMatch(/^https:\/\//);
    }
  });

  it('NAV IBANs (as published) agree with our mod-97 computation from the account numbers', () => {
    for (const a of Object.values(RULES_2026.accounts)) {
      expect(hungarianIban(a.number)).toBe(a.iban);
      expect(isValidIban(a.iban)).toBe(true);
    }
    expect(RULES_2026.accounts.szja.iban).toBe('HU16100320000605635300000000');
    expect(RULES_2026.accounts.tb.iban).toBe('HU22100320000605580200000000');
    expect(RULES_2026.accounts.szocho.iban).toBe('HU12100320000605591200000000');
    expect(isValidIban('HU16100320000605635300000001')).toBe(false);
  });

  it('2027 is a marked draft with the enacted changes only', () => {
    expect(RULES_2027.draft).toBe(true);
    expect(RULES_2027.costRatios.general).toBe(50);
    expect(RULES_2027.afaLimitHuf).toBe(22_000_000);
    expect(rulesForYear(2025)).toBeUndefined();
  });

  it('engine version is semver', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('costRatioForActivity (questionnaire suggestion only)', () => {
  it.each([
    ['kiskereskedelem', 90],
    ['lista80', 80],
    ['egyeb', 45],
  ] as const)('%s → %i %%', (answer, ratio) => {
    expect(costRatioForActivity(answer)).toBe(ratio);
  });
});

describe('holidays and working days', () => {
  it('Easter dates', () => {
    expect(easterSunday(2026)).toEqual([4, 5]);
    expect(easterSunday(2027)).toEqual([3, 28]);
    expect(easterSunday(2024)).toEqual([3, 31]);
  });

  it('2026 statutory holidays incl. the movable feasts and 24 December', () => {
    const d = statutoryHolidays(2026).map((h) => h.date);
    expect(d).toEqual([
      '2026-01-01',
      '2026-03-15',
      '2026-04-03',
      '2026-04-05',
      '2026-04-06',
      '2026-05-01',
      '2026-05-24',
      '2026-05-25',
      '2026-08-20',
      '2026-10-23',
      '2026-11-01',
      '2026-12-24',
      '2026-12-25',
      '2026-12-26',
    ]);
    expect(statutoryHolidays(2025).map((h) => h.date)).not.toContain('2025-12-24');
  });

  it('weekends, holidays, bridge days and worked Saturdays', () => {
    expect(isWorkingDay('2026-04-12')).toBe(false); // Sunday
    expect(isWorkingDay('2026-04-06')).toBe(false); // Easter Monday
    expect(isWorkingDay('2026-01-02')).toBe(false); // bridge rest day (Friday)
    expect(isWorkingDay('2026-01-10')).toBe(true); // worked Saturday
    expect(isWorkingDay('2026-08-21')).toBe(false); // bridge rest day
    expect(isWorkingDay('2026-11-17')).toBe(true); // Tuesday
    expect(nextWorkingDay('2026-01-01')).toBe('2026-01-05'); // Thu holiday, Fri bridge, weekend
    expect(nextWorkingDay('2026-04-03')).toBe('2026-04-07'); // Good Friday … Easter Monday
    expect(nextWorkingDay('2026-12-24')).toBe('2026-12-28'); // 24–26 Dec + Sunday
    expect(nextWorkingDay('2026-11-18')).toBe('2026-11-18');
    expect(() => isWorkingDay('2026-02-30')).toThrow(RangeError);
  });
});

describe('deadlines (SPEC §7.4)', () => {
  it('quarterly due dates 2026: 13 Apr, 13 Jul, 12 Oct, 12 Jan 2027', () => {
    expect([1, 2, 3, 4].map((q) => quarterDueDate(2026, q as 1 | 2 | 3 | 4))).toEqual(['2026-04-13', '2026-07-13', '2026-10-12', '2027-01-12']);
  });

  it('full 2026 list with sávos HIPA (default)', () => {
    const d = deadlinesFor(2026);
    const pick = d.map((x) => [x.kind, x.dueDate, x.periodKey]);
    expect(pick).toEqual([
      ['befizetes', '2026-04-13', '2026-Q1'],
      ['bevallas', '2026-04-13', '2026-Q1'],
      ['befizetes', '2026-06-01', '2026-HIPA-1'], // 31 May 2026 is a Sunday
      ['befizetes', '2026-07-13', '2026-Q2'],
      ['bevallas', '2026-07-13', '2026-Q2'],
      ['befizetes', '2026-10-12', '2026-Q3'],
      ['bevallas', '2026-10-12', '2026-Q3'],
      ['befizetes', '2027-01-12', '2026-Q4'],
      ['bevallas', '2027-01-12', '2026-Q4'],
      ['bevallas', '2027-05-20', '2026'], // SZJA annual return
      ['bevallas', '2027-05-31', '2026-HIPA'],
    ]);
    expect(d.find((x) => x.periodKey === '2026')!.title).toBe('Éves SZJA-bevallás (26SZJA) a 2026-os évről');
    expect(deadlinesFor(2027).find((x) => x.periodKey === '2027')!.title).toBe('Éves SZJA-bevallás (27SZJA) a 2027-es évről');
    expect(d.find((x) => x.periodKey === '2026-Q3' && x.kind === 'bevallas')!.title).toBe('Járulékbevallás (2658) – III. negyedév');
  });

  it('general-method HIPA: 16 March (15th is a Sunday + holiday) and 15 September', () => {
    const h = deadlinesFor(2026, { hipaMethod: 'altalanos' }).filter((x) => x.periodKey?.startsWith('2026-HIPA'));
    expect(h.map((x) => [x.dueDate, x.periodKey])).toEqual([
      ['2026-03-16', '2026-HIPA-1'],
      ['2026-09-15', '2026-HIPA-2'],
      ['2027-05-31', '2026-HIPA'],
    ]);
    // 2027: 15 March is a Monday and a holiday → 16 March
    expect(deadlinesFor(2027, { hipaMethod: 'altalanos' }).find((x) => x.periodKey === '2027-HIPA-1')!.dueDate).toBe('2027-03-16');
  });

  it('no HIPA dates when there is no HIPA', () => {
    expect(deadlinesFor(2026, { hipaMethod: 'nincs' }).some((x) => x.periodKey?.includes('HIPA'))).toBe(false);
  });

  it('rejects absurd years', () => {
    expect(() => deadlinesFor(1999)).toThrow(RangeError);
  });
});

describe('helpers', () => {
  it('roundDiv rounds half away from zero, exactly', () => {
    expect(roundDiv(40_311_500, 1000)).toBe(40_312); // 217 900 × 18.5 % = 40 311.5 → 40 312
    expect(roundDiv(40_311_499, 1000)).toBe(40_311);
    expect(roundDiv(-1, 2)).toBe(-1);
    expect(roundDiv(1, 2)).toBe(1);
    expect(roundDiv(0, 7)).toBe(0);
    expect(() => roundDiv(1, 0)).toThrow(RangeError);
  });

  it('formatHuf uses no-break spaces and a real minus sign', () => {
    expect(formatHuf(510_471)).toBe('510 471 Ft');
    expect(formatHuf(1_936_800)).toBe('1 936 800 Ft');
    expect(formatHuf(0)).toBe('0 Ft');
    expect(formatHuf(-18_000)).toBe('−18 000 Ft');
  });

  it('year adjectives follow vowel harmony', () => {
    expect(['2026', '2027', '2028', '2030', '2035', '2040', '2000', '2023'].map((y) => yearAdjective(Number(y)))).toEqual([
      '2026-os',
      '2027-es',
      '2028-as',
      '2030-as',
      '2035-ös',
      '2040-es',
      '2000-es',
      '2023-as',
    ]);
  });
});
