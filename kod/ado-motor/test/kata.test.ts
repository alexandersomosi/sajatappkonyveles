// SPEC §32 – KATA engine (Kata tv. 2022. évi XIII. tv.; terv 8.1, kritika 2.3). Hand-computed values.
import { describe, expect, it } from 'vitest';
import {
  deadlinesFor,
  hungarianIban,
  isValidIban,
  isWorkingDay,
  kataDeclarationDue,
  kataDueDate,
  kataLimitMeter,
  kataMonthlyHuf,
  kataMonths,
  kataRulesFor,
  KATA_RULES_REGI_2026,
  MOVED_WORKING_DAYS,
  nextWorkingDay,
  NAV_ACCOUNTS,
  REPEALED_WORKING_DAYS,
  RULES_2026,
  RULES_2027,
  type KataMonthsInput,
} from '../src/index.js';

const R = KATA_RULES_REGI_2026;
const months = (i: Partial<KataMonthsInput> = {}) => kataMonths({ year: 2026, monthlyHuf: 50_000, ...i }, R);
const liableOf = (ms: ReturnType<typeof months>) => ms.filter((m) => m.liable).map((m) => m.month);

describe('munkarend 2026: a december 12-i szombat nem munkanap (4/2026. SZCSM r.)', () => {
  it('2026-12-12 is not a working day; the deadline moves to Monday 14 December', () => {
    expect(isWorkingDay('2026-12-12')).toBe(false);
    expect(nextWorkingDay('2026-12-12')).toBe('2026-12-14');
    expect(MOVED_WORKING_DAYS[2026]!.some((d) => d.date === '2026-12-12')).toBe(false);
    expect(REPEALED_WORKING_DAYS[2026]!.map((d) => d.date)).toEqual(['2026-12-12']);
    expect(RULES_2026.sources.some((s) => s.id === 'szcsm-4-2026')).toBe(true);
  });
  it('the other worked Saturdays of 2026 stay', () => {
    expect(isWorkingDay('2026-01-10')).toBe(true);
    expect(isWorkingDay('2026-08-08')).toBe(true);
  });
});

describe('KATA rules and account (NAV list from 2026-11-01)', () => {
  it('the KATA account: 10032000-01076349, adónem 288, IBAN matches the mod-97 computation', () => {
    expect(NAV_ACCOUNTS.kata.number).toBe('10032000-01076349');
    expect(NAV_ACCOUNTS.kata.name).toBe('NAV Kisadózó vállalkozások adója bevételi számla');
    expect(hungarianIban(NAV_ACCOUNTS.kata.number)).toBe(NAV_ACCOUNTS.kata.iban);
    expect(isValidIban(NAV_ACCOUNTS.kata.iban)).toBe(true);
    expect(R.adonem).toBe('288');
    expect(R).toMatchObject({ monthlyHuf: 50_000, yearlyLimitHuf: 18_000_000, limitPerMonthHuf: 1_500_000, kulonadoPermille: 400, dueDay: 12, exemptMinDays: 30, debtLimitHuf: 100_000, draft: false });
    for (const id of R.sources) expect(RULES_2026.sources.some((s) => s.id === id)).toBe(true);
  });
  it('2026: only the Kata tv. KATA exists', () => {
    expect(kataRulesFor(2026, 'regi')).toBe(R);
    expect(kataRulesFor(2026, 'uj')).toBeUndefined();
    expect(kataRulesFor(2025, 'regi')).toBeUndefined();
  });
  it('2027 (T/928, not law): both variants are drafts – no amount unless the caller allows draft rules', () => {
    const regi = kataRulesFor(2027, 'regi')!;
    const uj = kataRulesFor(2027, 'uj')!;
    expect(regi.draft).toBe(true);
    expect(uj.draft).toBe(true);
    expect(regi.sources).toContain('t928');
    expect(RULES_2027.sources.some((s) => s.id === 't928' && /parlament\.hu/.test(s.url))).toBe(true);
    expect(kataMonthlyHuf(regi)).toBeNull();
    expect(kataMonthlyHuf(regi, { allowDraft: true })).toBe(75_000);
    expect(kataMonthlyHuf(uj, { allowDraft: true, fofoglalkozasu: true })).toBeNull(); // no NAV account known yet
    expect(uj).toMatchObject({ monthlyHuf: 100_000, monthlyNotMainHuf: 50_000, yearlyLimitHuf: 22_000_000, limitPerMonthHuf: null, kiegeszitoPermille: 150, onlyMainJob: false });
    expect(kataMonthlyHuf(R)).toBe(50_000);
  });
});

describe('kataMonths – Kata tv. 7. § (1)–(3), (8), (9) (terv 8.1)', () => {
  it('a whole year: 12 liable months of 50 000 Ft, due the 12th of the next month (next working day)', () => {
    const ms = months();
    expect(ms).toHaveLength(12);
    expect(ms.every((m) => m.liable && m.amountHuf === 50_000)).toBe(true);
    expect(ms.find((m) => m.month === 11)!.dueDate).toBe('2026-12-14');
    expect(ms.find((m) => m.month === 12)!.dueDate).toBe('2027-01-12');
    expect(ms[0]!.periodKey).toBe('2026-01-KATA');
  });
  it('táppénz 01.19–03.24 → January liable, February and March free (March: the closing month, 13 + 24 days ≥ 30)', () => {
    const ms = months({ breaks: [{ from: '2026-01-19', to: '2026-03-24', kind: 'tappenz' }] });
    expect(liableOf(ms)).toEqual([1, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(ms.find((m) => m.month === 2)).toMatchObject({ liable: false, exemptReason: 'tappenz', closingMonthRule: false, amountHuf: 0 });
    expect(ms.find((m) => m.month === 3)).toMatchObject({ liable: false, exemptReason: 'tappenz', closingMonthRule: true });
  });
  it('táppénz 01.19–02.20 → January liable, February free (13 + 20 days ≥ 30)', () => {
    expect(liableOf(months({ breaks: [{ from: '2026-01-19', to: '2026-02-20', kind: 'tappenz' }] }))).toEqual([1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it('a short state (01.25–02.10, 17 days) frees no month', () => {
    expect(liableOf(months({ breaks: [{ from: '2026-01-25', to: '2026-02-10', kind: 'tappenz' }] }))).toHaveLength(12);
  });
  it('the days of a month already free under (8) do not count for the 30 days: CSED 01.01–02.10 → only January free', () => {
    const ms = months({ breaks: [{ from: '2026-01-01', to: '2026-02-10', kind: 'csed' }] });
    expect(liableOf(ms)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it('szünetelés 03.10–05.31 → March liable, April and May free; no 30-day rule for szünetelés', () => {
    expect(liableOf(months({ breaks: [{ from: '2026-03-10', to: '2026-05-31', kind: 'szunetel' }] }))).toEqual([1, 2, 3, 6, 7, 8, 9, 10, 11, 12]);
    // 30+ days of szünetelés ending mid-month: the closing month stays liable
    expect(liableOf(months({ breaks: [{ from: '2026-03-02', to: '2026-04-15', kind: 'szunetel' }] }))).toHaveLength(12);
  });
  it('revenue in a free month → liable after all (7. § (8) closing words)', () => {
    const ms = months({ breaks: [{ from: '2026-02-01', to: '2026-02-28', kind: 'gyed' }], revenue: [{ receivedOn: '2026-02-14', amountHuf: 30_000 }] });
    expect(ms.find((m) => m.month === 2)).toMatchObject({ liable: true, exemptReason: 'gyed', exemptLostByRevenue: true, amountHuf: 50_000 });
  });
  it('örökbefogadói díj, GYOD and baleseti táppénz (as táppénz) free a whole month (7. § (8) a))', () => {
    expect(liableOf(months({ breaks: [{ from: '2026-05-01', to: '2026-05-31', kind: 'orokbefogadoi_dij' }] }))).not.toContain(5);
    expect(liableOf(months({ breaks: [{ from: '2026-06-01', to: '2026-06-30', kind: 'gyod' }] }))).not.toContain(6);
  });
  it('kataFrom 2026-03-01 → 10 liable months; a KATA starting mid-month counts that month (started month)', () => {
    expect(months({ kataFrom: '2026-03-01' })).toHaveLength(10);
    expect(months({ kataFrom: '2026-03-15' }).map((m) => m.month)[0]).toBe(3);
    expect(months({ kataTo: '2026-04-10' }).map((m) => m.month)).toEqual([1, 2, 3, 4]);
  });
  it('monthlyHuf null (unconfirmed 2027 amount) → liable months without amount', () => {
    const ms = kataMonths({ year: 2027, monthlyHuf: null }, kataRulesFor(2027, 'regi')!);
    expect(ms.every((m) => m.liable && m.amountHuf === null)).toBe(true);
  });
});

describe('kataLimitMeter – keret 18 M / liable months × 1.5 M, 40 % különadó (7. § (4)–(5))', () => {
  const meter = (i: Partial<KataMonthsInput>, revenueHuf: number, asOf = '2026-12-31') => {
    const ms = months(i);
    return kataLimitMeter(ms, { year: 2026, kataFrom: i.kataFrom, kataTo: i.kataTo, revenue: [{ receivedOn: '2026-11-30', amountHuf: revenueHuf }], asOf }, R);
  };
  it('from 03.01, 17 M → keret 15 M, különadó 800 000 Ft', () => {
    const m = meter({ kataFrom: '2026-03-01' }, 17_000_000);
    expect(m).toMatchObject({ limitHuf: 15_000_000, overHuf: 2_000_000, kulonadoEstimateHuf: 800_000, level: 'tullepve', kulonadoDue: '2027-02-25' });
  });
  it('the whole year, 20 M → 800 000 Ft', () => {
    expect(meter({}, 20_000_000)).toMatchObject({ limitHuf: 18_000_000, kulonadoEstimateHuf: 800_000 });
  });
  it('2 free months + 17 M → keret 15 M, 800 000 Ft', () => {
    const m = meter({ breaks: [{ from: '2026-02-01', to: '2026-03-31', kind: 'csed' }] }, 17_000_000);
    expect(m).toMatchObject({ liableMonths: 10, limitHuf: 15_000_000, kulonadoEstimateHuf: 800_000 });
  });
  it('ratio 0.80 → figyelem; 1.01 → tullepve; below → rendben', () => {
    expect(meter({}, 14_400_000).level).toBe('figyelem');
    expect(meter({}, 14_399_999).level).toBe('rendben');
    expect(meter({}, 18_180_000).level).toBe('tullepve');
    expect(meter({}, 18_000_000).level).toBe('figyelem'); // exactly the keret is not over it
  });
  it('a KATA ending during the year: különadó due kataTo + 30 days (next working day)', () => {
    const m = meter({ kataTo: '2026-04-10' }, 7_000_000);
    expect(m.limitHuf).toBe(6_000_000);
    expect(m.kulonadoDue).toBe(nextWorkingDay('2026-05-10'));
    expect(kataDeclarationDue(2026, '2026-04-10', R)).toBe('2026-05-11');
    expect(kataDeclarationDue(2026, null, R)).toBe('2027-02-25');
  });
  it('the projection is used only after 60 days; future months are counted liable', () => {
    const early = kataLimitMeter(months(), { year: 2026, revenue: [{ receivedOn: '2026-01-20', amountHuf: 3_000_000 }], asOf: '2026-01-31' }, R);
    expect(early).toMatchObject({ projectionReliable: false, projectedOverHuf: 0, liableMonthsSoFar: 1, assumedFutureMonths: 11, limitHuf: 18_000_000 });
    const july = kataLimitMeter(months(), { year: 2026, revenue: [{ receivedOn: '2026-06-30', amountHuf: 10_000_000 }], asOf: '2026-06-30' }, R);
    expect(july.projectionReliable).toBe(true);
    expect(july.projectedHuf).toBe(Math.round((10_000_000 * 365) / 181));
    expect(july.projectedOverHuf).toBe(july.projectedHuf - 18_000_000);
    expect(july.level).toBe('rendben');
  });
  it('revenue outside the KATA months does not count', () => {
    const m = kataLimitMeter(months({ kataFrom: '2026-06-01' }), { year: 2026, kataFrom: '2026-06-01', revenue: [{ receivedOn: '2026-05-31', amountHuf: 5_000_000 }, { receivedOn: '2026-06-02', amountHuf: 1_000 }], asOf: '2026-12-31' }, R);
    expect(m.usedHuf).toBe(1_000);
  });
  it('the T/928 new KATA (draft): keret 22 M; a part year keret is not known → the yearly one, flagged', () => {
    const uj = kataRulesFor(2027, 'uj')!;
    const ms = kataMonths({ year: 2027, kataFrom: '2027-04-01', monthlyHuf: null }, uj);
    const m = kataLimitMeter(ms, { year: 2027, kataFrom: '2027-04-01', revenue: [], asOf: '2027-05-01' }, uj);
    expect(m).toMatchObject({ limitHuf: 22_000_000, limitProrationKnown: false, draft: true, kulonadoDue: null });
  });
});

describe('KATA deadlines (terv 8.1)', () => {
  it('2027 monthly due dates with the next-working-day rule', () => {
    const due = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => kataDueDate(2027, m, R));
    expect(due).toEqual(['2027-02-12', '2027-03-12', '2027-04-12', '2027-05-12', '2027-06-14', '2027-07-12', '2027-08-12', '2027-09-13', '2027-10-12', '2027-11-12', '2027-12-13', '2028-01-12']);
  });
  it("deadlinesFor a KATA year: no Q1–Q4, no 26SZJA; 12 monthly KATA rows, the '26KATA and the HIPA", () => {
    const d = deadlinesFor(2026, { regime: 'kata', hipaMethod: 'savos' });
    expect(d.some((x) => /^2026-Q/.test(x.periodKey ?? ''))).toBe(false);
    expect(d.some((x) => x.periodKey === '2026')).toBe(false);
    expect(d.filter((x) => /-KATA$/.test(x.periodKey ?? '') && x.kind === 'befizetes')).toHaveLength(12);
    expect(d.find((x) => x.periodKey === '2026-11-KATA')!.dueDate).toBe('2026-12-14');
    expect(d.find((x) => x.periodKey === '2026-KATA')).toMatchObject({ kind: 'bevallas', dueDate: '2027-02-25' });
    expect(d.find((x) => x.periodKey === '2026-KATA')!.title).toContain("'26KATA");
    expect(d.some((x) => x.periodKey === '2026-HIPA-1')).toBe(true);
    expect(d.some((x) => x.periodKey === '2026-HIPA')).toBe(true);
  });
  it('a KATA ending 2026-04-10: 4 monthly rows, the declaration 30 days later', () => {
    const d = deadlinesFor(2026, { regime: 'kata', kataTo: '2026-04-10', hipaMethod: 'nincs' });
    expect(d.filter((x) => x.kind === 'befizetes').map((x) => x.periodKey)).toEqual(['2026-01-KATA', '2026-02-KATA', '2026-03-KATA', '2026-04-KATA']);
    expect(d.find((x) => x.periodKey === '2026-KATA')!.dueDate).toBe('2026-05-11');
  });
  it('the átalány calendar is unchanged without regime', () => {
    const d = deadlinesFor(2026);
    expect(d.filter((x) => /^2026-Q/.test(x.periodKey ?? '')).length).toBe(8);
    expect(d.some((x) => /KATA/.test(x.periodKey ?? ''))).toBe(false);
  });
});
