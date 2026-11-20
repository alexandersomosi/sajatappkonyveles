// SPEC §28.4 – "Mennyit kerestem?": net income of every month = revenue − (SZJA + TB after csjk + szocho + HIPA) attributed
// to the month (engine earningsByMonth: every tax to the month whose own income caused it), each quarter's parts as
// paid → approved → estimated; plus the year-end projection (engine projectYear). The átalány költséghányad is not
// deducted (a tax rule, not a cost). Round 2 of 2026-11-19: the year-to-date total counts the year's real SZJA – what
// the quarterly advances overpaid (they never go below 0) comes back in the annual return and is shown as such.
// The same month figures are the "eddig" of the home Félretenni card (felretesz.ts reserveCard), so the two never differ.
import { and, asc, eq } from 'drizzle-orm';
import type { EarningsCard, EarningsMonthView, EarningsView } from '../_shared/api.js';
import { EARNINGS_RULES, type EarningsBasis } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { taxCalculations, taxPeriods } from '../db/schema.js';
import { capitalize, MONTHS_HU } from '../lib/dates.js';
import { accountantParams } from '../notify/notify.js';
import { calculateYear, earningsByMonth, projectYear, yearEndSettlement, type YearInput, type YearResult } from '../tax/engine.js';
import { activeItems, engineInput, type CalcResultJson } from './tax.js';
import { pauseOn } from './szuneteltetes.js';
import { fmt } from './kedvezmeny.js';
import type { ClientRow } from './people.js';

const RANK: Record<EarningsBasis, number> = { becsles: 0, jovahagyva: 1, befizetve: 2 };
const roundTo = (n: number, step: number) => Math.round(n / step) * step;
/** "kb." amounts: to 1 000 Ft (never 0 for a positive amount). */
export const kb1000 = (n: number) => (n > 0 ? Math.max(1_000, roundTo(n, 1_000)) : roundTo(n, 1_000));

export interface EarningsData {
  view: EarningsView;
  card: EarningsCard;
}

export interface EarningsBasisData {
  input: YearInput;
  result: YearResult;
  /** The engine months 1..12 (approved parts where approved), BEFORE the year-end settlement. */
  months: ReturnType<typeof earningsByMonth>;
  /** The last month that counts as "so far" (12 for a past year). */
  lastMonth: number;
  basisOf: Record<string, EarningsBasis>;
  /** The approved quarters' parts (k6c3: the projection and the allowance effects use the same). */
  approved: ApprovedParts;
  /** Comes back in the annual return: the overpaid SZJA advances only (k6c2), for the year so far. */
  refundHuf: number;
  /** k6c2: an unused családi kedvezmény the accountant settles in the annual return (said without an amount). */
  csaladiUnused: boolean;
}

/**
 * periodKey → the approved parts of an approved quarter: TB (after csjk), szocho, SZJA advance (overrides applied) and
 * the csjk that approval included (0 when the allowance came later).
 */
export type ApprovedParts = Record<string, { tbHuf: number; szochoHuf: number; szjaHuf: number; csjkHuf: number }>;

/**
 * k6c3: the approved quarters of a client-year – the one basis of "Mennyit kerestem?", its projection, the Félretenni
 * card and the allowance effects ("idén eddig kb. … Ft-tal kevesebb adó"). An allowance approved later never assumes
 * that the quarters already approved were recomputed with it; only the overpaid SZJA comes back.
 */
export async function approvedQuarterParts(db: DbOrTx, clientId: string, year: number): Promise<{ approved: ApprovedParts; basisOf: Record<string, EarningsBasis> }> {
  const periods = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'negyedev'))).orderBy(asc(taxPeriods.dueDate));
  const approved: ApprovedParts = {};
  const basisOf: Record<string, EarningsBasis> = {};
  for (const p of periods) {
    basisOf[p.periodKey] = 'becsles';
    if (p.calcStatus !== 'jovahagyva' || !p.approvedCalculationId) continue;
    const [calc] = await db.select().from(taxCalculations).where(eq(taxCalculations.id, p.approvedCalculationId)).limit(1);
    const q = (calc?.result as CalcResultJson | undefined)?.quarter;
    if (!q) continue;
    const ov = calc?.overrides ?? null;
    approved[p.periodKey] = { tbHuf: ov?.tbHuf ?? q.tbHuf, szochoHuf: ov?.szochoHuf ?? q.szochoHuf, szjaHuf: ov?.szjaAdvanceHuf ?? q.szjaAdvanceHuf, csjkHuf: q.csjkHuf ?? 0 };
    const items = await activeItems(db, p.id);
    const paid = items.length > 0 && items.every((i) => i.markedPaidAt || i.verifiedAt);
    basisOf[p.periodKey] = paid ? 'befizetve' : 'jovahagyva';
  }
  return { approved, basisOf };
}

/** The common basis of "Mennyit kerestem?" and the home Félretenni card. Null without a profile / rules. */
export async function earningsBasis(db: DbOrTx, cl: ClientRow, year: number, today: string): Promise<EarningsBasisData | null> {
  const curYear = Number(today.slice(0, 4));
  const asOf = year < curYear ? `${year}-12-31` : today;
  const input = await engineInput(db, cl.id, year, asOf);
  if (!input) return null;
  const result = calculateYear(input);
  // approved / paid quarters
  const { approved, basisOf } = await approvedQuarterParts(db, cl.id, year);
  const hipaAnnual = result.hipa && result.hipa.method === 'savos' ? (result.hipa.annualHuf ?? 0) : 0;
  const months = earningsByMonth(result, { hipaAnnualHuf: hipaAnnual, approved });
  const lastMonth = year < curYear ? 12 : Number(today.slice(5, 7));
  const refundHuf = yearEndSettlement(result, approved).szjaRefundHuf;
  const csaladiUnused = (result.allowances?.csaladiUnusedHuf ?? 0) > 0;
  return { input, result, months, lastMonth, basisOf, approved, refundHuf, csaladiUnused };
}

export async function earnings(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, today: string): Promise<EarningsData | null> {
  const curYear = Number(today.slice(0, 4));
  const b = await earningsBasis(db, cl, year, today);
  if (!b) return null;
  const { input, months, lastMonth, basisOf, approved, refundHuf, csaladiUnused } = b;
  const params = await accountantParams(db, cl.accountantId);
  const noteText = await deps.content.get('kereset.no_revenue_note');
  const views: EarningsMonthView[] = [];
  for (const m of months.filter((x) => x.month <= lastMonth)) {
    const q = Math.ceil(m.month / 3);
    const basis = basisOf[`${year}-Q${q}`] ?? 'becsles';
    const taxes = m.szjaHuf + m.tbHuf + m.szochoHuf + m.hipaHuf;
    views.push({
      month: m.month,
      label: capitalize(MONTHS_HU[m.month - 1] ?? ''),
      revenueHuf: m.revenueHuf,
      taxesHuf: taxes,
      parts: { szjaHuf: m.szjaHuf, tbHuf: m.tbHuf, szochoHuf: m.szochoHuf, hipaHuf: m.hipaHuf },
      netHuf: m.netHuf,
      basis,
      note: m.revenueHuf === 0 && m.netHuf < 0 ? noteText : null,
    });
  }
  const sum = views.reduce((a, v) => ({ revenueHuf: a.revenueHuf + v.revenueHuf, taxesHuf: a.taxesHuf + v.taxesHuf, netHuf: a.netHuf + v.netHuf }), { revenueHuf: 0, taxesHuf: 0, netHuf: 0 });
  // the year's real tax so far: what the advances overpaid comes back in the annual return
  const ytd = { revenueHuf: sum.revenueHuf, taxesHuf: sum.taxesHuf - refundHuf, netHuf: sum.netHuf + refundHuf };
  const refundParts: string[] = [];
  if (refundHuf > 0) refundParts.push(await deps.content.render('kereset.refund', { refund: fmt(kb1000(refundHuf)) }));
  if (csaladiUnused) refundParts.push(await deps.content.render('kereset.csaladi_ev_vegen', params));
  const refund = refundParts.length ? { huf: refundHuf, text: refundParts.join(' ') } : null;
  // projection (only for the running year)
  let projection: EarningsView['projection'];
  // k6c2: while paused (szüneteltetés) no invoicing is allowed – no "ha így folytatod" projection
  const paused = year === curYear && Boolean(await pauseOn(db, cl.id, today));
  if (paused) projection = { reliable: false, revenueHuf: null, taxesHuf: null, netHuf: null, text: await deps.content.get('kereset.projection_paused') };
  else if (year === curYear) {
    // k6c3: the approved quarters stay as approved (the same basis as the year-to-date figures above)
    const pr = projectYear(input, { approved });
    projection = pr.reliable
      ? {
          reliable: true,
          revenueHuf: roundTo(pr.revenueHuf, EARNINGS_RULES.projectionRoundHuf),
          taxesHuf: roundTo(pr.taxesHuf, EARNINGS_RULES.projectionRoundHuf),
          netHuf: roundTo(pr.netHuf, EARNINGS_RULES.projectionRoundHuf),
          text: await deps.content.render('kereset.projection_sub', {
            projRev: fmt(roundTo(pr.revenueHuf, EARNINGS_RULES.projectionRoundHuf)),
            projTaxes: fmt(roundTo(pr.taxesHuf, EARNINGS_RULES.projectionRoundHuf)),
          }),
        }
      : { reliable: false, revenueHuf: null, taxesHuf: null, netHuf: null, text: await deps.content.get('kereset.projection_not_yet') };
  } else projection = { reliable: false, revenueHuf: null, taxesHuf: null, netHuf: null, text: '' };
  const view: EarningsView = {
    year,
    months: views.sort((a, b2) => b2.month - a.month),
    ytd,
    projection,
    line: await deps.content.get('kereset.line'),
    disclaimer: await deps.content.render('kereset.disclaimer', params),
    refund,
  };
  // The card rounds to 1 000 with "kb." (an estimate never shows forint precision).
  const card: EarningsCard = {
    ytdNetHuf: ytd.netHuf,
    ytdRevenueHuf: ytd.revenueHuf,
    ytdTaxesHuf: ytd.taxesHuf,
    // k6c2: a negative year reads as "több volt az adód és a járulékod, mint a bevételed", never "kb. -1 164 000 Ft maradt"
    sentence: await deps.content.render(ytd.netHuf < 0 ? 'kereset.card_sentence_negative' : 'kereset.card_sentence', { ytdNet: fmt(kb1000(Math.abs(ytd.netHuf))) }),
    sub: await deps.content.render('kereset.card_sub', { ytdRevenue: fmt(ytd.revenueHuf), ytdTaxes: fmt(kb1000(ytd.taxesHuf)) }),
    projectionText:
      projection.reliable && projection.netHuf !== null
        ? await deps.content.render(projection.netHuf < 0 ? 'kereset.card_projection_negative' : 'kereset.card_projection', { projNet: fmt(Math.abs(projection.netHuf)) })
        : null,
    refundText: refundHuf > 0 ? await deps.content.render('kereset.card_refund', { refund: fmt(kb1000(refundHuf)) }) : null,
  };
  return { view, card };
}

/** Weakest basis of a set of months (used by tests and the panel). */
export function weakestBasis(xs: EarningsBasis[]): EarningsBasis {
  return xs.reduce<EarningsBasis>((a, b) => (RANK[b] < RANK[a] ? b : a), 'befizetve');
}
