// Test helpers: demo fixtures (kod/shared/demo/fixtures.json, read-only) → engine input,
// following SPEC §5.5: received_on = payment_date ?? issue_date (estimated) for transfers,
// issue_date for cash/card; manual items have delivery = received.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RevenueItemInput, TaxProfileInput, YearInput } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));

export interface FixtureInvoice {
  invoiceNumber: string;
  issueDate: string;
  deliveryDate: string;
  paymentDate?: string;
  paymentMethod?: string;
  grossAmountHuf: number;
}

export interface ExpectedQuarter {
  q: number;
  revenue: number;
  income: number;
  ytdIncome: number;
  taxableYtd: number;
  gongyoltBasePerMonth: number;
  monthlyBases: (number | null)[];
  tb: number;
  szocho: number;
  szjaAdvance: number;
  total: number;
}

export interface Fixtures {
  today: string;
  taxIds: Record<string, { adoszam?: string; adoazonositoJel: string }>;
  navInvoices: Record<string, FixtureInvoice[]>;
  manualRevenue: Record<'kata' | 'reka' | 'peter', { receivedOn: string; amountHuf: number; description: string }[]>;
  expectedReceivedByMonth: Record<'kata' | 'reka' | 'peter', number[]>;
  expectedAfaKeretUsedAsOfToday: Record<'kata' | 'reka' | 'peter', number>;
  expectedTax2026: Record<'kata' | 'reka' | 'peter', ExpectedQuarter[]>;
}

export const fixtures: Fixtures = JSON.parse(readFileSync(resolve(here, '../../shared/demo/fixtures.json'), 'utf8')) as Fixtures;

export type Persona = 'kata' | 'reka' | 'peter';

export function revenueFor(who: Persona): RevenueItemInput[] {
  const adoszam = fixtures.taxIds[who]!.adoszam!;
  const invoices = fixtures.navInvoices[adoszam.slice(0, 8)] ?? [];
  const items: RevenueItemInput[] = invoices.map((inv) => {
    const cashLike = inv.paymentMethod === 'CASH' || inv.paymentMethod === 'CARD' || inv.paymentMethod === 'VOUCHER';
    return {
      receivedOn: cashLike ? inv.issueDate : (inv.paymentDate ?? inv.issueDate),
      deliveryDate: inv.deliveryDate,
      amountHuf: inv.grossAmountHuf,
      countsForAtalany: true,
      countsForAfaLimit: true,
      estimated: !cashLike,
    };
  });
  for (const m of fixtures.manualRevenue[who]) {
    items.push({ receivedOn: m.receivedOn, deliveryDate: m.receivedOn, amountHuf: m.amountHuf, countsForAtalany: true, countsForAfaLimit: true });
  }
  return items;
}

/** SPEC §19: Kata 45 % főfogl. minimálbér; Réka 80 % főfogl. garantált; Péter 45 % mellékállású. */
export function profileFor(who: Persona): TaxProfileInput {
  switch (who) {
    case 'kata':
      return { year: 2026, costRatio: 45, status: 'fofoglalkozasu', guaranteedMinimum: false, hipa: { method: 'savos', ratePct: 2 } };
    case 'reka':
      return { year: 2026, costRatio: 80, status: 'fofoglalkozasu', guaranteedMinimum: true, hipa: { method: 'savos', ratePct: 2 } };
    case 'peter':
      return { year: 2026, costRatio: 45, status: 'mellekallasu', guaranteedMinimum: false, hipa: { method: 'savos', ratePct: 2 } };
  }
}

export function demoInput(who: Persona, asOf = fixtures.today): YearInput {
  return { profile: profileFor(who), revenue: revenueFor(who), asOf };
}

/** Revenue items: one per month on the 15th (received = delivery). */
export function monthly(amounts: Record<number, number>, year = 2026, day = 15): RevenueItemInput[] {
  return Object.entries(amounts).map(([m, amountHuf]) => {
    const d = `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { receivedOn: d, deliveryDate: d, amountHuf, countsForAtalany: true, countsForAfaLimit: true };
  });
}

/** Deterministic PRNG (mulberry32) for property tests. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}
