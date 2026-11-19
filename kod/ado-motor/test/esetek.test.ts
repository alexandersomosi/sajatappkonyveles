// Edge cases: partial months, garantált bérminimum, kieső months, nyugdíjas, mid-year start,
// revenue caps, HIPA bands, overrides, legacy ratio, draft year, validation, determinism.

import { describe, expect, it } from 'vitest';
import { AdoMotorInputError, calculateYear, type RevenueItemInput, type TaxProfileInput, type YearInput } from '../src/index.js';
import { deepFreeze, demoInput, monthly } from './helpers.js';

const main = (extra: Partial<TaxProfileInput> = {}): TaxProfileInput => ({
  year: 2026,
  costRatio: 45,
  status: 'fofoglalkozasu',
  guaranteedMinimum: false,
  ...extra,
});

describe('partial months and minimums', () => {
  it('start on 16 March: Jan–Feb not insured, March minimum = 322 800 / 30 × 16 = 172 160', () => {
    const r = calculateYear({ profile: main({ atalanyFrom: '2026-03-16' }), revenue: monthly({ 3: 500_000 }, 2026, 20), asOf: '2026-04-30' });
    const q1 = r.quarters[0]!;
    expect(q1.months.map((m) => [m.insured, m.insuredDays, m.minimumHuf, m.baseHuf])).toEqual([
      [false, 0, null, 0],
      [false, 0, null, 0],
      [true, 16, 172_160, 172_160],
    ]);
    expect(q1.insuredMonths).toBe(1);
    // round(172 160 × 18.5 %) = round(31 849.6) = 31 850 ; round(172 160 × 13 %) = round(22 380.8) = 22 381
    expect([q1.tbHuf, q1.szochoHuf, q1.szjaAdvanceHuf, q1.totalHuf]).toEqual([31_850, 22_381, 0, 54_231]);
    expect(q1.revenueHuf).toBe(500_000);
    expect(q1.incomeHuf).toBe(275_000);
  });

  it('a quarter that ended before the start is not returned', () => {
    const r = calculateYear({ profile: main({ atalanyFrom: '2026-05-10' }), revenue: monthly({ 5: 400_000 }), asOf: '2026-08-01' });
    expect(r.quarters.map((q) => q.periodKey)).toEqual(['2026-Q2', '2026-Q3']);
    // May: 22 insured days → 322 800 / 30 × 22 = 236 720 ; April before the start
    expect(r.quarters[0]!.months.map((m) => m.baseHuf)).toEqual([0, 236_720, 322_800]);
  });

  it('revenue received before the start is excluded and flagged', () => {
    const revenue: RevenueItemInput[] = [...monthly({ 3: 500_000 }, 2026, 20), ...monthly({ 3: 99_000 }, 2026, 1)];
    const r = calculateYear({ profile: main({ atalanyFrom: '2026-03-16' }), revenue, asOf: '2026-04-30' });
    expect(r.quarters[0]!.revenueHuf).toBe(500_000);
    expect(r.warnings.find((w) => w.code === 'revenue_before_start')?.text).toContain('1 bevételi tétel');
  });

  it('garantált bérminimum 373 200 with 20 kieső days in June → 373 200 / 30 × 10 = 124 400', () => {
    const r = calculateYear({
      profile: main({ guaranteedMinimum: true, costRatio: 80, insuranceBreaks: [{ from: '2026-06-01', to: '2026-06-20', kind: 'kieso' }] }),
      revenue: monthly({ 4: 1_000_000, 5: 1_000_000, 6: 1_000_000 }),
      asOf: '2026-07-01',
    });
    const q2 = r.quarters[1]!;
    expect(q2.months.map((m) => [m.minimumHuf, m.baseHuf, m.minimumDays, m.insuredDays])).toEqual([
      [373_200, 373_200, 30, 30],
      [373_200, 373_200, 31, 31],
      [124_400, 124_400, 10, 30],
    ]);
    // 2 × 69 042 + round(23 014) ; 2 × 48 516 + round(16 172)
    expect([q2.tbHuf, q2.szochoHuf]).toEqual([161_098, 113_204]);
  });

  it('a fully kieső month is still insured, its minimum is 0, so the income-based base applies (mixed case)', () => {
    // 80 %: income = revenue / 5. Q1 revenue 12 684 000 → income 2 536 800 → taxable 600 000 → g = 200 000
    const r = calculateYear({
      profile: main({ costRatio: 80, insuranceBreaks: [{ from: '2026-03-01', to: '2026-03-31', kind: 'kieso' }] }),
      revenue: monthly({ 1: 4_228_000, 2: 4_228_000, 3: 4_228_000 }),
      asOf: '2026-04-01',
    });
    const q1 = r.quarters[0]!;
    expect(q1.taxableYtdHuf).toBe(600_000);
    expect(q1.insuredMonths).toBe(3);
    expect(q1.cumulativeBasePerMonthHuf).toBe(200_000);
    expect(q1.months.map((m) => [m.minimumHuf, m.baseHuf, m.minimumApplied])).toEqual([
      [322_800, 322_800, true],
      [322_800, 322_800, true],
      [0, 200_000, false],
    ]);
    expect([q1.tbHuf, q1.szochoHuf]).toEqual([156_436, 109_928]); // 2 × 59 718 + 37 000 ; 2 × 41 964 + 26 000
    const note = q1.explanation.lines.find((l) => l.label.startsWith('Járulékalap'))!.note!;
    expect(note).toContain('Havonta a nagyobbik számít');
    expect(note).toContain('Március egésze kieső idő volt (például táppénz), ezért arra a hónapra nincs minimum.');
  });

  it('a partly suspended month carries the FULL minimum (Tbj. 40. § (5), since 2024: no proration)', () => {
    const r = calculateYear({
      profile: main({ insuranceBreaks: [{ from: '2026-02-11', to: '2026-03-10', kind: 'szunetel' }] }),
      revenue: [],
      asOf: '2026-03-31',
    });
    // Neither February nor March is suspended on every day → both carry 322 800
    expect(r.quarters[0]!.months.map((m) => [m.insuredDays, m.minimumDays, m.baseHuf])).toEqual([
      [31, 31, 322_800],
      [28, 28, 322_800],
      [31, 31, 322_800],
    ]);
  });

  it('NAV 100 ch. 6.1 example: szünetelés 20 July – 20 September → July and September full, August out', () => {
    const r = calculateYear({
      profile: main({ insuranceBreaks: [{ from: '2026-07-20', to: '2026-09-20', kind: 'szunetel' }] }),
      revenue: [],
      asOf: '2026-10-01',
    });
    const q3 = r.quarters[2]!;
    expect(q3.months.map((m) => [m.insured, m.baseHuf])).toEqual([
      [true, 322_800],
      [false, 0],
      [true, 322_800],
    ]);
    // 2 × 59 718 ; 2 × 41 964
    expect([q3.tbHuf, q3.szochoHuf, q3.totalHuf]).toEqual([119_436, 83_928, 203_364]);
  });

  it('kieső days inside a partly suspended month still reduce the minimum; the start is still prorated', () => {
    const r = calculateYear({
      profile: main({
        atalanyFrom: '2026-03-16',
        insuranceBreaks: [
          { from: '2026-03-20', to: '2026-04-10', kind: 'szunetel' },
          { from: '2026-05-01', to: '2026-05-10', kind: 'kieso' },
        ],
      }),
      revenue: [],
      asOf: '2026-06-30',
    });
    // March: 16 days from the start (4 active + 12 suspended) → 322 800 / 30 × 16 = 172 160
    expect(r.quarters[0]!.months[2]).toMatchObject({ insuredDays: 16, minimumDays: 16, baseHuf: 172_160 });
    // April partly suspended → full ; May 10 kieső days → 21 days → 225 960
    expect(r.quarters[1]!.months.map((m) => m.baseHuf)).toEqual([322_800, 225_960, 322_800]);
  });

  it('a szünetelés that began before 2024 is flagged for the accountant (Tbj. 105/D. §)', () => {
    const codes = (from: string) =>
      calculateYear({ profile: main({ insuranceBreaks: [{ from, to: '2026-02-15', kind: 'szunetel' }] }), revenue: [], asOf: '2026-03-01' }).warnings.map((w) => w.code);
    expect(codes('2023-11-01')).toContain('szunetel_2024_elott');
    expect(codes('2026-01-10')).not.toContain('szunetel_2024_elott');
  });

  it('the revenue cap is prorated for suspended days too (NAV 100 ch. 2)', () => {
    const r = calculateYear({
      profile: main({ insuranceBreaks: [{ from: '2026-07-01', to: '2026-08-31', kind: 'szunetel' }] }),
      revenue: monthly({ 1: 1_000_000 }),
      asOf: '2026-12-31',
    });
    // 365 − 62 suspended days = 303 active days → 38 736 000 × 303 / 365 = 32 156 186.3 → 32 156 186
    expect(r.meters.atalanyCap.limitHuf).toBe(32_156_186);
    expect(r.meters.atalanyCap.detail).toContain('(a szünetelés miatt arányosan)');
  });
});

describe('statuses', () => {
  it('nyugdíjas: no TB, no szocho in any quarter; SZJA same as a főfoglalkozású', () => {
    const base = demoInput('kata');
    const ny = calculateYear({ ...base, profile: { ...base.profile, status: 'nyugdijas' } });
    const fo = calculateYear(base);
    for (const q of ny.quarters) {
      expect([q.tbHuf, q.szochoHuf]).toEqual([0, 0]);
      expect(q.months.every((m) => !m.insured && m.minimumHuf === null)).toBe(true);
      expect(q.payments.map((p) => p.kind)).toEqual(q.szjaAdvanceHuf > 0 ? ['szja_eloleg'] : []);
    }
    expect(ny.quarters.map((q) => q.szjaAdvanceHuf)).toEqual(fo.quarters.map((q) => q.szjaAdvanceHuf));
  });

  it('mellékállás: no minimum even with zero income', () => {
    const r = calculateYear({ profile: main({ status: 'mellekallasu' }), revenue: [], asOf: '2026-12-31' });
    for (const q of r.quarters) {
      expect(q.totalHuf).toBe(0);
      expect(q.months.every((m) => m.minimumHuf === null && m.baseHuf === 0)).toBe(true);
    }
  });

  it('főfoglalkozású with zero income still owes the minimum: 4 × 305 046 Ft a year', () => {
    const r = calculateYear({ profile: main(), revenue: [], asOf: '2027-01-15' });
    expect(r.quarters.map((q) => q.totalHuf)).toEqual([305_046, 305_046, 305_046, 305_046]);
  });

  it('garantált check warning only for 80 % főfoglalkozású without garantált minimum', () => {
    const codes = (p: TaxProfileInput) => calculateYear({ profile: p, revenue: [], asOf: '2026-02-01' }).warnings.map((w) => w.code);
    expect(codes(main({ costRatio: 80 }))).toContain('garantalt_minimum_check');
    expect(codes(main({ costRatio: 80, guaranteedMinimum: true }))).not.toContain('garantalt_minimum_check');
    expect(codes(main({ costRatio: 45 }))).not.toContain('garantalt_minimum_check');
  });
});

describe('quarters returned relative to asOf', () => {
  it('asOf in May → Q1 complete, Q2 running with June as future', () => {
    const r = calculateYear({ profile: main(), revenue: monthly({ 1: 100_000 }), asOf: '2026-05-10' });
    expect(r.quarters.map((q) => [q.periodKey, q.complete])).toEqual([
      ['2026-Q1', true],
      ['2026-Q2', false],
    ]);
    expect(r.quarters[1]!.months.map((m) => m.future ?? false)).toEqual([false, false, true]);
  });

  it('the last day of a quarter is not yet complete; the next day is', () => {
    expect(calculateYear({ profile: main(), revenue: [], asOf: '2026-03-31' }).quarters[0]!.complete).toBe(false);
    expect(calculateYear({ profile: main(), revenue: [], asOf: '2026-04-01' }).quarters[0]!.complete).toBe(true);
  });

  it('asOf before the year → no quarters, empty meters', () => {
    const r = calculateYear({ profile: main(), revenue: monthly({ 1: 100_000 }), asOf: '2025-12-31' });
    expect(r.quarters).toEqual([]);
    expect(r.meters.afa.usedHuf).toBe(0);
    expect(r.meters.adomentes.usedIncomeHuf).toBe(0);
  });

  it('revenue after asOf ("várható") and outside the year is ignored', () => {
    const revenue: RevenueItemInput[] = [
      ...monthly({ 2: 100_000 }),
      { receivedOn: '2026-11-20', deliveryDate: '2026-11-12', amountHuf: 240_000, countsForAtalany: true, countsForAfaLimit: true },
      { receivedOn: '2025-12-30', deliveryDate: '2025-12-20', amountHuf: 777_000, countsForAtalany: true, countsForAfaLimit: true },
      { receivedOn: '2027-01-05', deliveryDate: '2026-12-20', amountHuf: 555_000, countsForAtalany: true, countsForAfaLimit: true },
    ];
    const r = calculateYear({ profile: main(), revenue, asOf: '2026-11-17' });
    expect(r.meters.atalanyCap.usedHuf).toBe(100_000);
    // delivered 11-12 counts for ÁFA as of 11-17 even though the money arrives on 11-20
    expect(r.meters.afa.usedHuf).toBe(340_000);
    const later = calculateYear({ profile: main(), revenue, asOf: '2027-02-01' });
    expect(later.meters.atalanyCap.usedHuf).toBe(340_000); // the 2027 receipt belongs to 2027
    expect(later.meters.afa.usedHuf).toBe(895_000); // delivered in 2026
  });

  it('flags excluded via countsFor… are respected; a storno reduces the month', () => {
    const revenue: RevenueItemInput[] = [
      ...monthly({ 3: 1_000_000 }),
      { receivedOn: '2026-03-20', deliveryDate: '2026-03-20', amountHuf: -200_000, countsForAtalany: true, countsForAfaLimit: true },
      { receivedOn: '2026-03-21', deliveryDate: '2026-03-21', amountHuf: 5_000_000, countsForAtalany: false, countsForAfaLimit: false },
    ];
    const r = calculateYear({ profile: main(), revenue, asOf: '2026-04-30' });
    expect(r.revenueByMonth[2]!.amountHuf).toBe(800_000);
    expect(r.meters.afa.usedHuf).toBe(800_000);
    expect(r.quarters[0]!.incomeHuf).toBe(440_000);
  });
});

describe('meters', () => {
  it('ÁFA exactly at 80 % warns and shows 80%; one forint below does not', () => {
    const at = calculateYear({ profile: main(), revenue: monthly({ 1: 16_000_000 }), asOf: '2026-12-31' });
    expect(at.meters.afa.warning).toBe(true);
    expect(at.warnings.find((w) => w.code === 'afa_80')!.text).toContain('(80%)');
    const below = calculateYear({ profile: main(), revenue: monthly({ 1: 15_999_999 }), asOf: '2026-12-31' });
    expect(below.meters.afa.warning).toBe(false);
    expect(below.warnings.map((w) => w.code)).not.toContain('afa_80');
  });

  it('ÁFA over the limit', () => {
    const r = calculateYear({ profile: main(), revenue: monthly({ 1: 12_000_000, 2: 8_000_001 }), asOf: '2026-03-01' });
    expect(r.meters.afa).toMatchObject({ usedHuf: 20_000_001, warning: true, remainingHuf: 0 });
    expect(r.meters.afa.sentence).toBe('Átlépted az alanyi ÁFA-mentesség határát (20 000 000 Ft).');
    expect(r.warnings.map((w) => w.code)).toContain('afa_over');
  });

  it('projection: no alarm in the first 60 days, then a projected-over warning', () => {
    const early = calculateYear({ profile: main(), revenue: monthly({ 1: 5_000_000 }, 2026, 10), asOf: '2026-01-31' });
    // round 1 (2026-11-19): before projectionMinDays there is no projection at all (was 58 870 968 = 5 000 000 × 365 / 31)
    expect(early.meters.afa.projectedHuf).toBe(5_000_000);
    expect(early.meters.afa.detail).not.toContain('Ilyen tempóban');
    expect(early.meters.afa.warning).toBe(false);
    const later = calculateYear({ profile: main(), revenue: monthly({ 1: 5_000_000, 2: 1_000_000 }, 2026, 10), asOf: '2026-03-31' });
    // 6 000 000 × 365 / 90 = 24 333 333
    expect(later.meters.afa.projectedHuf).toBe(24_333_333);
    expect(later.meters.afa.warning).toBe(true);
    expect(later.warnings.map((w) => w.code)).toContain('afa_projected_over');
  });

  it('alanyi ÁFA limit is time-proportional in the starting year (Áfa tv. 189. §): 20 M × 43 / 365 = 2 356 164', () => {
    // started 2026-11-19 → 43 days to 31 Dec; 3 000 000 Ft invoiced by year end is ABOVE the prorated limit
    const r = calculateYear({ profile: main({ atalanyFrom: '2026-11-19' }), revenue: monthly({ 12: 3_000_000 }, 2026, 10), asOf: '2026-12-31' });
    expect(r.meters.afa.limitHuf).toBe(2_356_164);
    expect(r.meters.afa.warning).toBe(true);
    expect(r.meters.afa.sentence).toContain('Átlépted az alanyi ÁFA-mentesség határát');
    expect(r.meters.afa.sentence).toContain('arányosan');
    expect(r.warnings.map((w) => w.code)).toContain('afa_over');
    // below the prorated limit: the remaining amount is counted from it, and the detail says why
    const ok = calculateYear({ profile: main({ atalanyFrom: '2026-11-19' }), revenue: monthly({ 12: 1_000_000 }, 2026, 10), asOf: '2026-12-31' });
    expect(ok.meters.afa.remainingHuf).toBe(1_356_164);
    expect(ok.meters.afa.detail).toContain('időarányos');
    // a whole-year business keeps the full limit; a szünetelés does not reduce it
    const full = calculateYear({ profile: main({ insuranceBreaks: [{ kind: 'szunetel', from: '2026-02-01', to: '2026-03-31' }] }), revenue: [], asOf: '2026-06-30' });
    expect(full.meters.afa.limitHuf).toBe(20_000_000);
    expect(full.meters.afa.detail).not.toContain('időarányos');
  });

  it('ten days and one invoice: no "Ilyen tempóban" sentence and no HIPA band from a projection', () => {
    const r = calculateYear({ profile: main({ hipa: { method: 'savos', ratePct: 2 } }), revenue: monthly({ 1: 1_000_000 }, 2026, 5), asOf: '2026-01-10' });
    expect(r.meters.afa.projectedHuf).toBe(1_000_000);
    expect(r.meters.afa.detail).not.toContain('Ilyen tempóban');
    expect(r.hipa).toMatchObject({ band: 'a' });
    expect(r.warnings.map((w) => w.code)).not.toContain('hipa_savos_limit_over');
  });

  it('átalány cap prorated for a mid-year start: 38 736 000 × 291 / 365 = 30 882 674', () => {
    const r = calculateYear({ profile: main({ atalanyFrom: '2026-03-16' }), revenue: [], asOf: '2026-04-30' });
    expect(r.meters.atalanyCap.limitHuf).toBe(30_882_674);
    expect(r.meters.atalanyCap.detail).toContain('arányosan');
  });

  it('retail (90 %) uses the 193 680 000 Ft cap by default', () => {
    const r = calculateYear({ profile: main({ costRatio: 90 }), revenue: [], asOf: '2026-04-30' });
    expect(r.meters.atalanyCap.limitHuf).toBe(193_680_000);
    const m = calculateYear({ profile: main({ costRatio: 45, retail: true }), revenue: [], asOf: '2026-04-30' });
    expect(m.warnings.map((w) => w.code)).toContain('retail_ratio_mismatch');
  });

  it('átalány cap 80 % / over', () => {
    const near = calculateYear({ profile: main(), revenue: monthly({ 1: 31_000_000 }), asOf: '2026-12-31' });
    expect(near.warnings.map((w) => w.code)).toContain('atalany_cap_80');
    const over = calculateYear({ profile: main(), revenue: monthly({ 1: 38_736_001 }), asOf: '2026-12-31' });
    expect(over.warnings.map((w) => w.code)).toContain('atalany_cap_over');
  });

  it('adómentes not reached: remaining amount', () => {
    const r = calculateYear({ profile: main(), revenue: monthly({ 1: 1_000_000 }), asOf: '2026-02-01' });
    // income 550 000 → 1 936 800 − 550 000 = 1 386 800
    expect(r.meters.adomentes).toMatchObject({ reached: false, reachedMonth: null, usedIncomeHuf: 550_000 });
    expect(r.meters.adomentes.sentence).toBe('Még 1 386 800 Ft jövedelmed adómentes idén.');
  });
});

describe('HIPA (sávos, Htv. 39/A)', () => {
  const hipaFor = (revenue: number, ratePct = 2, extra: Partial<TaxProfileInput> = {}) =>
    calculateYear({ profile: main({ hipa: { method: 'savos', ratePct }, ...extra }), revenue: monthly({ 6: revenue }), asOf: '2027-01-10' }).hipa!;

  it.each([
    [12_000_000, 'a', 2_500_000, 50_000],
    [12_000_001, 'b', 6_000_000, 120_000],
    [18_000_000, 'b', 6_000_000, 120_000],
    [18_000_001, 'c', 8_500_000, 170_000],
    [25_000_000, 'c', 8_500_000, 170_000],
  ] as const)('revenue %i → band %s, base %i, tax %i (2 %%)', (rev, band, base, tax) => {
    const h = hipaFor(rev);
    expect([h.band, h.baseHuf, h.annualHuf]).toEqual([band, base, tax]);
  });

  it('above 25 M Ft → no sávos estimate, accountant warned', () => {
    const r = calculateYear({ profile: main({ hipa: { method: 'savos', ratePct: 2 } }), revenue: monthly({ 6: 25_000_001 }), asOf: '2027-01-10' });
    expect(r.hipa).toMatchObject({ baseHuf: null, annualHuf: null, band: null });
    expect(r.warnings.map((w) => w.code)).toContain('hipa_savos_limit_over');
  });

  it('retail átalányadózó: sávos up to 120 M Ft', () => {
    expect(hipaFor(60_000_000, 2, { costRatio: 90 }).band).toBe('c');
  });

  it('local rate 1.5 % → 2 500 000 × 1.5 % = 37 500', () => {
    expect(hipaFor(5_000_000, 1.5).annualHuf).toBe(37_500);
  });

  it('started this year: revenue annualised for the band, base prorated, no advance', () => {
    const r = calculateYear({
      profile: main({ atalanyFrom: '2026-03-16', hipa: { method: 'savos', ratePct: 2 } }),
      revenue: monthly({ 3: 500_000 }, 2026, 20),
      asOf: '2026-04-30',
    });
    // 46 active days < projectionMinDays: the ACTUAL revenue is annualised (round 1): 500 000 × 365 / 291 = 627 148 → band a
    // base = 2 500 000 × 291 / 365 = 1 993 151 ; tax = × 2 % = 39 863
    expect(r.hipa).toMatchObject({ band: 'a', annualisedRevenueHuf: 627_148, baseHuf: 1_993_151, annualHuf: 39_863, advances: [] });
    // after 60 active days the projection is used again: 1 500 000 × 291 / 138 = 3 163 043 ; × 365 / 291 = 3 967 391
    const later = calculateYear({
      profile: main({ atalanyFrom: '2026-03-16', hipa: { method: 'savos', ratePct: 2 } }),
      revenue: monthly({ 3: 500_000, 5: 500_000, 7: 500_000 }, 2026, 20),
      asOf: '2026-07-31',
    });
    expect(later.hipa).toMatchObject({ band: 'a', annualisedRevenueHuf: 3_967_391 });
    expect(r.hipa!.note).toContain('Mivel idén kezdted');
  });

  it("sávos advance = last year's tax when known (Htv. 39/A. § (9)), never this year's estimate", () => {
    const r = calculateYear({ profile: main({ hipa: { method: 'savos', ratePct: 2, priorYearHuf: 42_000 } }), revenue: monthly({ 1: 1_000_000 }), asOf: '2026-05-01' });
    expect(r.hipa!.advances).toEqual([{ dueDate: '2026-06-01', amountHuf: 42_000, label: 'Iparűzési adóelőleg (2026)' }]);
    expect(r.hipa!.note).toContain('az előző évi adóddal egyezik meg (42\u00a0000\u00a0Ft)');
  });

  it('általános method: not modelled, null amounts + warning; none: null amounts, no warning', () => {
    const alt = calculateYear({ profile: main({ hipa: { method: 'altalanos', ratePct: 2 } }), revenue: [], asOf: '2026-05-01' });
    expect(alt.hipa).toMatchObject({ method: 'altalanos', baseHuf: null, annualHuf: null, advances: [] });
    expect(alt.warnings.map((w) => w.code)).toContain('hipa_altalanos_not_modelled');
    const none = calculateYear({ profile: main({ hipa: { method: 'nincs', ratePct: 0 } }), revenue: [], asOf: '2026-05-01' });
    expect(none.hipa).toMatchObject({ method: 'nincs', baseHuf: null, annualHuf: null });
    expect(calculateYear({ profile: main(), revenue: [], asOf: '2026-05-01' }).hipa).toBeNull();
  });
});

describe('prior overrides (previous accountant)', () => {
  it('same sums as the engine → same results', () => {
    const base = demoInput('kata');
    const r = calculateYear({ ...base, profile: { ...base.profile, priorOverrides: { throughQuarter: 2, priorActualBaseSum: 1_936_800, priorSzjaAdvanceSum: 76_605 } } });
    expect(r.quarters.map((q) => q.totalHuf)).toEqual([305_046, 381_651, 510_471, 392_661]);
    expect(r.quarters.map((q) => q.coveredByPriorOverride)).toEqual([true, true, false, false]);
    expect(r.quarters[0]!.explanation.lines.some((l) => l.kind === 'megjegyzes' && l.label.includes('előző könyvelőd'))).toBe(true);
  });

  it('a higher earlier SZJA advance lowers Q3; Q4 is unchanged (cumulative)', () => {
    const base = demoInput('kata');
    const r = calculateYear({ ...base, profile: { ...base.profile, priorOverrides: { throughQuarter: 2, priorActualBaseSum: 1_936_800, priorSzjaAdvanceSum: 100_000 } } });
    expect(r.quarters[2]!.szjaAdvanceHuf).toBe(182_030); // 282 030 − 100 000
    expect(r.quarters[3]!.szjaAdvanceHuf).toBe(87_615); // 369 645 − 282 030
  });

  it('over-paid earlier advances → 0 now, never negative, accountant warned', () => {
    const base = demoInput('kata');
    const r = calculateYear({ ...base, profile: { ...base.profile, priorOverrides: { throughQuarter: 2, priorActualBaseSum: 1_936_800, priorSzjaAdvanceSum: 400_000 } } });
    expect(r.quarters[2]!.szjaAdvanceHuf).toBe(0);
    expect(r.quarters[3]!.szjaAdvanceHuf).toBe(0);
    expect(r.quarters[2]!.warnings[0]!.code).toBe('szja_tulfizetes');
    expect(r.quarters[2]!.explanation.lines.find((l) => l.label === 'SZJA-előleg most')!.note).toContain('A különbözetet az éves bevallás rendezi');
  });

  it('a higher earlier base lowers the cumulative base of later quarters (mellékállás)', () => {
    const base = demoInput('peter');
    const r = calculateYear({ ...base, profile: { ...base.profile, priorOverrides: { throughQuarter: 3, priorActualBaseSum: 900_000, priorSzjaAdvanceSum: 98_055 } } });
    // Q4: (1 154 200 − 900 000) / 3 = 84 733.3 → 84 733
    expect(r.quarters[3]!.cumulativeBasePerMonthHuf).toBe(84_733);
  });
});

describe('legacy and draft rules', () => {
  it('a legacy 40 % ratio is computed with 45 % and flagged', () => {
    const base = demoInput('kata');
    const r = calculateYear({ ...base, profile: { ...base.profile, costRatio: 40 as unknown as 45 } });
    expect(r.costRatioUsed).toBe(45);
    expect(r.quarters[2]!.totalHuf).toBe(510_471);
    const w = r.warnings.find((x) => x.code === 'cost_ratio_2026_changed')!;
    expect(w.audience).toBe('konyvelo');
    expect(w.text).toContain('40%');
  });

  it('2027 draft: general ratio 50 %, 22 M ÁFA limit, warning', () => {
    const r = calculateYear({
      profile: { year: 2027, costRatio: 45, status: 'fofoglalkozasu', guaranteedMinimum: false },
      revenue: monthly({ 1: 1_000_000 }, 2027),
      asOf: '2027-02-01',
    });
    expect(r.rulesVersion).toBe('2027-01-01-draft');
    expect(r.costRatioUsed).toBe(50);
    expect(r.quarters[0]!.incomeHuf).toBe(500_000);
    expect(r.meters.afa.limitHuf).toBe(22_000_000);
    expect(r.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['rules_draft', 'cost_ratio_2027_changed']));
    expect(r.warnings.find((w) => w.code === 'rules_draft')!.text).toBe('A 2027-es adószabályok még nem véglegesek, ez csak előzetes becslés.');
  });

  it('allowances are not modelled but announced', () => {
    const base = demoInput('kata');
    const r = calculateYear({ ...base, profile: { ...base.profile, allowances: [{ kind: 'csaladi' }] } });
    expect(r.quarters[2]!.totalHuf).toBe(510_471);
    expect(r.warnings.find((w) => w.code === 'kedvezmeny_nem_modellezett')?.audience).toBe('ugyfel');
  });
});

describe('validation', () => {
  const ok = (): YearInput => ({ profile: main({ hipa: { method: 'savos', ratePct: 2 } }), revenue: monthly({ 1: 1000 }), asOf: '2026-05-01' });
  const fields = (input: unknown): Record<string, string> => {
    try {
      calculateYear(input as YearInput);
    } catch (e) {
      expect(e).toBeInstanceOf(AdoMotorInputError);
      expect((e as AdoMotorInputError).code).toBe('validation_failed');
      return (e as AdoMotorInputError).fields;
    }
    throw new Error('expected AdoMotorInputError');
  };

  it('accepts a valid input', () => {
    expect(() => calculateYear(ok())).not.toThrow();
  });

  it('rejects bad dates, amounts, enums, rates and years with field paths', () => {
    expect(Object.keys(fields({ ...ok(), asOf: '2026-02-30' }))).toEqual(['asOf']);
    expect(Object.keys(fields({ ...ok(), profile: { ...ok().profile, year: 2025 } }))).toEqual(['profile.year']);
    expect(Object.keys(fields({ ...ok(), profile: { ...ok().profile, costRatio: 60 } }))).toEqual(['profile.costRatio']);
    expect(Object.keys(fields({ ...ok(), profile: { ...ok().profile, status: 'diak' } }))).toEqual(['profile.status']);
    expect(Object.keys(fields({ ...ok(), profile: { ...ok().profile, hipa: { method: 'savos', ratePct: 2.5 } } }))).toEqual(['profile.hipa.ratePct']);
    expect(Object.keys(fields({ ...ok(), profile: { ...ok().profile, hipa: { method: 'savos', ratePct: 1.234 } } }))).toEqual(['profile.hipa.ratePct']);
    expect(Object.keys(fields({ ...ok(), profile: { ...ok().profile, atalanyFrom: '2027-01-01' } }))).toEqual(['profile.atalanyFrom']);
    expect(Object.keys(fields({ ...ok(), profile: { ...ok().profile, insuranceBreaks: [{ from: '2026-05-01', to: '2026-04-01', kind: 'kieso' }] } }))).toEqual([
      'profile.insuranceBreaks[0]',
    ]);
    expect(Object.keys(fields({ ...ok(), profile: { ...ok().profile, priorOverrides: { throughQuarter: 4, priorActualBaseSum: -1, priorSzjaAdvanceSum: 0 } } }))).toEqual([
      'profile.priorOverrides.throughQuarter',
      'profile.priorOverrides.priorActualBaseSum',
    ]);
    const rev = fields({ ...ok(), revenue: [{ receivedOn: '2026-01-01', deliveryDate: 'x', amountHuf: 10.5, countsForAtalany: 'igen', countsForAfaLimit: true }] });
    expect(Object.keys(rev)).toEqual(['revenue[0].deliveryDate', 'revenue[0].amountHuf', 'revenue[0].countsForAtalany']);
    expect(Object.keys(fields(null))).toEqual(['input']);
    expect(Object.keys(fields({ revenue: [], asOf: '2026-01-01' }))).toEqual(['profile']);
  });

  it('messages are plain Hungarian', () => {
    expect(fields({ ...ok(), asOf: 'tegnap' })['asOf']).toBe('Dátum kell ÉÉÉÉ-HH-NN alakban.');
  });
});

describe('purity', () => {
  it('does not mutate a deeply frozen input and is deterministic', () => {
    const input = deepFreeze(demoInput('reka'));
    const a = calculateYear(input);
    const b = calculateYear(input);
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a); // plain JSON (stored as jsonb)
  });

  it('item order does not matter', () => {
    const input = demoInput('kata');
    const reversed = { ...input, revenue: [...input.revenue].reverse() };
    expect(calculateYear(reversed)).toEqual(calculateYear(input));
  });
});
