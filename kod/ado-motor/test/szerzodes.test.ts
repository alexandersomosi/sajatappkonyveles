// Contract check: SPEC §7.5 copied verbatim (namespace Spec). `npm run typecheck` fails if the
// package drifts from it: results must be assignable TO the SPEC shapes (consumers read them),
// and SPEC-shaped inputs must be accepted by the package (consumers build them).

import { describe, expect, it } from 'vitest';
import * as motor from '../src/index.js';
import { demoInput } from './helpers.js';

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Spec {
  export type CostRatio = 45 | 80 | 90;
  export type TaxStatus = 'fofoglalkozasu' | 'mellekallasu' | 'nyugdijas';
  export interface RevenueItemInput { receivedOn: string; deliveryDate: string; amountHuf: number;
    countsForAtalany: boolean; countsForAfaLimit: boolean; estimated?: boolean }
  export interface TaxProfileInput { year: number; costRatio: CostRatio; status: TaxStatus; guaranteedMinimum: boolean;
    atalanyFrom?: string; retail?: boolean;
    insuranceBreaks?: { from: string; to: string; kind: 'szunetel' | 'kieso' }[];
    hipa?: { method: 'savos' | 'altalanos' | 'nincs'; ratePct: number };
    priorOverrides?: { throughQuarter: 1|2|3; priorActualBaseSum: number; priorSzjaAdvanceSum: number } }
  export interface YearInput { profile: TaxProfileInput; revenue: RevenueItemInput[]; asOf: string }
  export interface MonthLine { month: number; revenueHuf: number; incomeHuf: number; insured: boolean;
    minimumHuf: number | null; baseHuf: number; tbHuf: number; szochoHuf: number }
  export interface QuarterResult { quarter: 1|2|3|4; periodKey: string; dueDate: string; complete: boolean;
    revenueHuf: number; incomeHuf: number; incomeYtdHuf: number; taxableYtdHuf: number; cumulativeBasePerMonthHuf: number;
    months: MonthLine[]; tbHuf: number; szochoHuf: number; szjaAdvanceHuf: number; totalHuf: number;
    payments: { kind: 'tb_jarulek'|'szocho'|'szja_eloleg'; label: string; sublabel?: string; amountHuf: number;
                accountName: string; accountNumber: string; iban: string }[];
    explanation: { intro: string; lines: { label: string; amountHuf?: number; op?: '+'|'−'|'='; note?: string }[]; result: string };
    warnings: { code: string; text: string }[] }
  export interface Meter { usedHuf: number; limitHuf: number; projectedHuf: number; ratio: number; warning: boolean; sentence: string }
  export interface YearResult { engineVersion: string; rulesVersion: string; asOf: string; quarters: QuarterResult[];
    meters: { afa: Meter; atalanyCap: Meter; adomentes: { limitHuf: number; usedIncomeHuf: number; reached: boolean; reachedMonth: number | null; sentence: string } };
    hipa: { method: string; baseHuf: number | null; annualHuf: number | null; advances: { dueDate: string; amountHuf: number | null }[]; note: string } | null;
    revenueByMonth: { month: number; amountHuf: number }[]; warnings: { code: string; text: string }[]; disclaimer: string }
  export type CalculateYear = (input: YearInput) => YearResult;
  export type DeadlinesFor = (year: number) => { kind: 'befizetes'|'bevallas'; title: string; dueDate: string; periodKey?: string }[];
  export type CostRatioForActivity = (answer: 'kiskereskedelem'|'lista80'|'egyeb') => CostRatio;
}

// Compile-time checks (assignments fail typecheck on drift).
const calc: Spec.CalculateYear = motor.calculateYear;
const deadlines: Spec.DeadlinesFor = motor.deadlinesFor;
const ratioFor: Spec.CostRatioForActivity = motor.costRatioForActivity;
const version: string = motor.ENGINE_VERSION;
const rules: { validFrom: string; sources: { url: string }[] } = motor.RULES_2026;
// The shared API types (kod/shared/src/api.ts) use the same Meter and ExplanationLine shapes.
type SharedMeter = { usedHuf: number; limitHuf: number; projectedHuf: number; ratio: number; warning: boolean; sentence: string };
const meterCheck = (m: motor.Meter): SharedMeter => m;

describe('SPEC §7.5 contract', () => {
  it('functions are callable through the SPEC signatures', () => {
    const r: Spec.YearResult = calc(demoInput('kata') as Spec.YearInput);
    expect(r.quarters[2]!.totalHuf).toBe(510_471);
    expect(deadlines(2026).length).toBeGreaterThan(8);
    expect(ratioFor('egyeb')).toBe(45);
    expect(version).toBe(motor.ENGINE_VERSION);
    expect(rules.validFrom).toBe('2026-01-01');
    expect(meterCheck(r.meters.afa as motor.Meter).limitHuf).toBe(20_000_000);
  });

  it('the explanation minus sign is U+2212, as in the SPEC union type', () => {
    const r = calc(demoInput('kata') as Spec.YearInput);
    const ops = new Set(r.quarters.flatMap((q) => q.explanation.lines.map((l) => l.op).filter(Boolean)));
    expect([...ops].sort()).toEqual(['=', '−']);
  });
});
