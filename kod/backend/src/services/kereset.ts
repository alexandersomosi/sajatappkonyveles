// SPEC §28.4 – "Mennyit kerestem?": net income of every month = revenue − (SZJA + TB after csjk + szocho + HIPA) attributed
// to the month (engine earningsByMonth), each quarter's parts as paid → approved → estimated; plus the year-end
// projection (engine projectYear). The átalány költséghányad is not deducted (a tax rule, not a cost).
import { and, asc, eq } from 'drizzle-orm';
import type { EarningsCard, EarningsMonthView, EarningsView } from '../_shared/api.js';
import { EARNINGS_RULES, type EarningsBasis } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { taxCalculations, taxPeriods } from '../db/schema.js';
import { capitalize, MONTHS_HU } from '../lib/dates.js';
import { accountantParams } from '../notify/notify.js';
import { calculateYear, earningsByMonth, projectYear } from '../tax/engine.js';
import { activeItems, engineInput, type CalcResultJson } from './tax.js';
import { fmt } from './kedvezmeny.js';
import type { ClientRow } from './people.js';

const RANK: Record<EarningsBasis, number> = { becsles: 0, jovahagyva: 1, befizetve: 2 };
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

export interface EarningsData {
  view: EarningsView;
  card: EarningsCard;
}

export async function earnings(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, today: string): Promise<EarningsData | null> {
  const curYear = Number(today.slice(0, 4));
  const asOf = year < curYear ? `${year}-12-31` : today;
  const input = await engineInput(db, cl.id, year, asOf);
  if (!input) return null;
  const result = calculateYear(input);
  // approved / paid quarters
  const periods = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.year, year), eq(taxPeriods.kind, 'negyedev'))).orderBy(asc(taxPeriods.dueDate));
  const approved: Record<string, { tbHuf: number; szochoHuf: number; szjaHuf: number }> = {};
  const basisOf: Record<string, EarningsBasis> = {};
  for (const p of periods) {
    basisOf[p.periodKey] = 'becsles';
    if (p.calcStatus !== 'jovahagyva' || !p.approvedCalculationId) continue;
    const [calc] = await db.select().from(taxCalculations).where(eq(taxCalculations.id, p.approvedCalculationId)).limit(1);
    const q = (calc?.result as CalcResultJson | undefined)?.quarter;
    if (!q) continue;
    const ov = calc?.overrides ?? null;
    approved[p.periodKey] = { tbHuf: ov?.tbHuf ?? q.tbHuf, szochoHuf: ov?.szochoHuf ?? q.szochoHuf, szjaHuf: ov?.szjaAdvanceHuf ?? q.szjaAdvanceHuf };
    const items = await activeItems(db, p.id);
    const paid = items.length > 0 && items.every((i) => i.markedPaidAt || i.verifiedAt);
    basisOf[p.periodKey] = paid ? 'befizetve' : 'jovahagyva';
  }
  const hipaAnnual = result.hipa && result.hipa.method === 'savos' ? (result.hipa.annualHuf ?? 0) : 0;
  const months = earningsByMonth(result, { hipaAnnualHuf: hipaAnnual, approved });
  const lastMonth = year < curYear ? 12 : Number(today.slice(5, 7));
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
  const ytd = views.reduce((a, v) => ({ revenueHuf: a.revenueHuf + v.revenueHuf, taxesHuf: a.taxesHuf + v.taxesHuf, netHuf: a.netHuf + v.netHuf }), { revenueHuf: 0, taxesHuf: 0, netHuf: 0 });
  // projection (only for the running year)
  let projection: EarningsView['projection'];
  if (year === curYear) {
    const pr = projectYear(input);
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
    months: views.sort((a, b) => b.month - a.month),
    ytd,
    projection,
    line: await deps.content.get('kereset.line'),
    disclaimer: await deps.content.render('kereset.disclaimer', params),
  };
  const card: EarningsCard = {
    ytdNetHuf: ytd.netHuf,
    ytdRevenueHuf: ytd.revenueHuf,
    ytdTaxesHuf: ytd.taxesHuf,
    sentence: await deps.content.render('kereset.card_sentence', { ytdNet: fmt(ytd.netHuf) }),
    sub: await deps.content.render('kereset.card_sub', { ytdRevenue: fmt(ytd.revenueHuf), ytdTaxes: fmt(ytd.taxesHuf) }),
    projectionText: projection.reliable && projection.netHuf !== null ? await deps.content.render('kereset.card_projection', { projNet: fmt(projection.netHuf) }) : null,
  };
  return { view, card };
}

/** Weakest basis of a set of months (used by tests and the panel). */
export function weakestBasis(xs: EarningsBasis[]): EarningsBasis {
  return xs.reduce<EarningsBasis>((a, b) => (RANK[b] < RANK[a] ? b : a), 'befizetve');
}
