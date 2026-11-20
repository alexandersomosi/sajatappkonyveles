// Client flags for the panel filters (SPEC §6.10) and the client deadline list (SPEC §5.6, §12.4).
import { and, asc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Deadline } from '../_shared/api.js';
import type { ClientFlag } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { appointments, clients, clientTaxProfiles, deadlines, navCredentials, onboardingSteps, requests, subscriptions, taxPaymentItems, taxPeriods } from '../db/schema.js';
import { daysBetween, lastDayOfMonth, MONTHS_HU, todayBudapest } from '../lib/dates.js';
import { nextWorkingDay } from '../lib/munkanap.js';
import { KATA_RULES_2026 } from '../_shared/enums.js';
import { deadlinesFor } from '../tax/engine.js';
import { computeYear, periodLabel, periodTotal } from './tax.js';

export async function computeFlags(deps: Deps, db: DbOrTx, clientId: string): Promise<ClientFlag[]> {
  const today = todayBudapest(deps.now());
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl) return [];
  const flags = new Set<ClientFlag>();
  if (cl.lifecycle === 'bekotes_alatt') flags.add('bekotes_alatt');

  const overdueReq = await db
    .select({ id: requests.id })
    .from(requests)
    .where(and(eq(requests.clientId, clientId), eq(requests.direction, 'konyvelotol'), inArray(requests.status, ['nyitott', 'folyamatban']), lt(requests.dueDate, today)))
    .limit(1);
  const hianyos = await db.select({ s: onboardingSteps.step }).from(onboardingSteps).where(and(eq(onboardingSteps.clientId, clientId), eq(onboardingSteps.status, 'hianyos'))).limit(1);
  const overdueTax = await db
    .select({ id: taxPaymentItems.id })
    .from(taxPaymentItems)
    .innerJoin(taxPeriods, eq(taxPeriods.id, taxPaymentItems.taxPeriodId))
    .where(and(eq(taxPeriods.clientId, clientId), isNull(taxPaymentItems.voidedAt), isNull(taxPaymentItems.markedPaidAt), lt(taxPaymentItems.dueDate, today)))
    .limit(1);
  const [nav] = await db.select({ status: navCredentials.status }).from(navCredentials).where(eq(navCredentials.clientId, clientId)).limit(1);
  if (overdueReq.length || hianyos.length || overdueTax.length || nav?.status === 'hibas') flags.add('hianyzik_valami');

  const comp = await computeYear(db, clientId, Number(today.slice(0, 4)), today);
  if (comp) {
    const m = comp.result.meters;
    if (m.afa.ratio >= 0.8 || m.afa.projectedHuf >= m.afa.limitHuf || m.atalanyCap.ratio >= 0.8) flags.add('hatar_kozel');
  }
  const [sub] = await db.select({ status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (sub && (sub.status === 'past_due' || sub.status === 'suspended')) flags.add('dij_elmaradt');
  if (flags.size === 0 && cl.lifecycle === 'aktiv') flags.add('rendben');
  const list = [...flags];
  await db.update(clients).set({ nextFlags: list }).where(eq(clients.id, clientId));
  return list;
}

export async function recomputeAllFlags(deps: Deps): Promise<number> {
  const rows = await deps.db.select({ id: clients.id }).from(clients).where(sql`${clients.lifecycle} <> 'megszunt'`);
  for (const r of rows) await computeFlags(deps, deps.db, r.id);
  return rows.length;
}

function dl(today: string, id: string, kind: Deadline['kind'], title: string, dueDate: string, done: boolean, link: string, amountHuf?: number, verified?: boolean, estimate?: boolean): Deadline {
  const daysLeft = daysBetween(today, dueDate);
  return { id, kind, title, dueDate, daysLeft, ...(amountHuf !== undefined ? { amountHuf } : {}), status: done ? 'kesz' : daysLeft < 0 ? 'lejart' : 'nyitott', ...(verified !== undefined ? { verified } : {}), ...(estimate !== undefined ? { estimate } : {}), link };
}

export interface DeadlineView {
  /** Wording for whom: the client ("a könyvelőd adja be") or the accountant ("te adod be"). */
  perspective?: 'client' | 'accountant';
}

/**
 * The client's deadlines, composed from tax periods, requests, appointments and custom rows.
 * Ids are stable composite keys: per:<periodId>:befizetes|bevallas, req:<id>, apt:<id>, dl:<id>.
 */
export async function clientDeadlines(deps: Deps, db: DbOrTx, clientId: string, from: string, to: string, view: DeadlineView = {}): Promise<Deadline[]> {
  const today = todayBudapest(deps.now());
  const acc = view.perspective === 'accountant';
  const out: Deadline[] = [];
  const [cl] = await db.select({ createdAt: clients.createdAt, firstName: clients.firstName, lastName: clients.lastName }).from(clients).where(eq(clients.id, clientId)).limit(1);
  // Deadlines that passed before the client joined belong to the previous accountant: they are not
  // shown as ours (and never as "lejárt"), unless we approved or filed that period ourselves.
  const serviceStart = cl ? todayBudapest(cl.createdAt) : '0000-01-01';
  const profiles = await db
    .select({ year: clientTaxProfiles.year, status: clientTaxProfiles.status, hipaMethod: clientTaxProfiles.hipaMethod, regime: clientTaxProfiles.regime, kataFrom: clientTaxProfiles.kataFrom, kataTo: clientTaxProfiles.kataTo })
    .from(clientTaxProfiles)
    .where(eq(clientTaxProfiles.clientId, clientId));
  const statusOf = (year: number) => profiles.find((x) => x.year === year)?.status;
  // k7c2: a KATA year has no átalány quarters, no '58 return and no 26SZJA – its own monthly 50 000 Ft instead
  const kataYear = (year: number) => profiles.find((x) => x.year === year)?.regime === 'kata';
  const periods = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), sql`${taxPeriods.dueDate} between ${from} and ${to}`));
  for (const p of periods) {
    if (p.dueDate < serviceStart && p.calcStatus !== 'jovahagyva' && p.filingStatus !== 'beadva') continue;
    if (p.kind === 'negyedev' && kataYear(p.year)) continue;
    const total = await periodTotal(db, p);
    const paid = p.paymentStatus === 'befizetve_jelezve' || p.paymentStatus === 'ellenorizve' || (p.calcStatus === 'jovahagyva' && p.paymentStatus === 'nincs_fizetendo');
    const verified = p.paymentStatus === 'befizetve_jelezve' ? false : paid ? true : undefined;
    if (p.kind === 'negyedev') {
      const nyugdijas = statusOf(p.year) === 'nyugdijas' || p.filingForm === null;
      out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', `${periodLabel(p)}: ${nyugdijas ? 'SZJA-előleg' : 'TB-járulék, szocho, SZJA-előleg'}`, p.dueDate, paid, '/', total ?? undefined, verified, p.calcStatus !== 'jovahagyva'));
      // NAV 100 ch. 6.3: no '58 return for a nyugdíjas átalányadózó.
      if (!nyugdijas) out.push(dl(today, `per:${p.id}:bevallas`, 'bevallas', `${periodLabel(p)}: bevallás (${acc ? 'te adod be' : 'a könyvelőd adja be'})`, p.dueDate, p.filingStatus === 'beadva', '/dosszie'));
    } else if (p.calcStatus === 'jovahagyva') {
      out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', periodLabel(p), p.dueDate, paid, '/', total ?? undefined, verified));
    } else if (acc || p.dueDate >= today) {
      // Not approved yet: the date is known, the amount (= last year's tax) comes from the accountant.
      // An overdue unapproved advance is the accountant's to-do, so only the panel shows it as lejárt.
      out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', `${periodLabel(p)} (${acc ? 'te számolod ki' : 'a könyvelőd kiszámolja'})`, p.dueDate, false, '/', undefined, undefined, true));
    }
  }
  // Yearly items from the §7.4 calendar (SPEC line "deadlines … generated yearly"): the annual SZJA
  // return + difference and the HIPA return of each tax year whose date falls in the window.
  const fromYear = Number(from.slice(0, 4)) - 1;
  const toYear = Number(to.slice(0, 4));
  for (let y = Math.max(fromYear, 2026); y <= toYear; y++) {
    const prof = profiles.find((x) => x.year === y);
    if (!prof) continue;
    for (const d of deadlinesFor(y, { hipaMethod: prof.hipaMethod })) {
      if (d.dueDate < from || d.dueDate > to || d.dueDate < serviceStart) continue;
      const who = acc ? 'te adod be' : 'a könyvelőd adja be';
      if (d.periodKey === String(y)) {
        if (prof.regime === 'kata') continue; // no 26SZJA for a KATA year (the '26KATA only above the keret)
        // "Éves SZJA-bevallás (26SZJA) a 2026-os évről" + what the client has to do about it
        out.push(dl(today, `ev:${y}:szja`, 'bevallas', `${d.title} és a különbözet befizetése (${who})`, d.dueDate, false, '/hataridok'));
      } else if (d.periodKey === `${y}-HIPA`) {
        out.push(dl(today, `ev:${y}:hipa`, 'bevallas', `Iparűzési adó ${y}: éves bevallás és különbözet (${who})`, d.dueDate, false, '/hataridok'));
      }
    }
  }
  // k7c2 (SPEC §28.K.11): the KATA months – 50 000 Ft per started month by the 12th of the next month (next working day).
  // We do not track the KATA transfers yet, so only the coming ones are listed (never a "lejárt" we cannot know).
  for (let y = Math.max(fromYear, 2026); y <= toYear; y++) {
    const prof = profiles.find((x) => x.year === y);
    if (!prof || prof.regime !== 'kata') continue;
    for (let m = 1; m <= 12; m++) {
      const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
      const monthEnd = lastDayOfMonth(monthStart.slice(0, 7));
      if (prof.kataFrom && monthEnd < prof.kataFrom) continue;
      if (prof.kataTo && monthStart > prof.kataTo) continue;
      const ny = m === 12 ? y + 1 : y;
      const nm = m === 12 ? 1 : m + 1;
      const due = nextWorkingDay(`${ny}-${String(nm).padStart(2, '0')}-${String(KATA_RULES_2026.dueDayOfNextMonth).padStart(2, '0')}`);
      if (due < from || due > to || due < today || due < serviceStart) continue;
      out.push(dl(today, `kata:${y}-${String(m).padStart(2, '0')}`, 'befizetes', `Kata – ${MONTHS_HU[m - 1]}: ${new Intl.NumberFormat('hu-HU').format(KATA_RULES_2026.monthlyHuf)} Ft`, due, false, '/', KATA_RULES_2026.monthlyHuf, undefined, false));
    }
  }
  const reqs = await db
    .select()
    .from(requests)
    .where(and(eq(requests.clientId, clientId), eq(requests.direction, 'konyvelotol'), sql`${requests.dueDate} between ${from} and ${to}`, inArray(requests.status, ['nyitott', 'folyamatban', 'teljesitve'])));
  for (const r of reqs) out.push(dl(today, `req:${r.id}`, 'keres', r.title, r.dueDate!, r.status === 'teljesitve', `/keresek`));
  // SPEC §26.2.9: appointment booking is retired – no 'apt:' deadlines any more (old rows are not shown).
  const custom = await db
    .select()
    .from(deadlines)
    .where(and(sql`(${deadlines.clientId} = ${clientId} or ${deadlines.clientId} is null)`, sql`${deadlines.dueDate} between ${from} and ${to}`))
    .orderBy(asc(deadlines.dueDate));
  for (const c of custom) out.push(dl(today, `dl:${c.id}`, c.kind, c.title, c.dueDate, false, '/hataridok'));
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.kind.localeCompare(b.kind));
}
