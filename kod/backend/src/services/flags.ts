// Client flags for the panel filters (SPEC §6.10) and the client deadline list (SPEC §5.6, §12.4).
import { and, asc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Deadline } from '../_shared/api.js';
import type { ClientFlag } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { annualClosings, appointments, clients, clientTaxProfiles, deadlines, navCredentials, onboardingSteps, requests, subscriptions, taxPaymentItems, taxPeriods } from '../db/schema.js';
import { daysBetween, monthName, todayBudapest } from '../lib/dates.js';
import { KATA_EXEMPT_LABELS, kataExemptNeedsReport, type KataExemptKind } from '../_shared/kata.js';
import { deadlinesFor } from '../tax/engine.js';
import { fill } from '../content.js';
import { accountantParams } from '../notify/notify.js';
import { fmt } from './kedvezmeny.js';
import { computeYear, isAnnualPeriodKind, kataRangeOfProfile, periodLabel, periodTotal, periodVisible, quarterFullyKata } from './tax.js';

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
    .where(and(eq(taxPeriods.clientId, clientId), periodVisible, isNull(taxPaymentItems.voidedAt), isNull(taxPaymentItems.markedPaidAt), lt(taxPaymentItems.dueDate, today)))
    .limit(1);
  const [nav] = await db.select({ status: navCredentials.status }).from(navCredentials).where(eq(navCredentials.clientId, clientId)).limit(1);
  if (overdueReq.length || hianyos.length || overdueTax.length || nav?.status === 'hibas') flags.add('hianyzik_valami');

  const comp = await computeYear(db, clientId, Number(today.slice(0, 4)), today);
  // SPEC §32 H6: a KATA year has the KATA keret instead of the átalány cap; 'kata_figyelem' = business customer or over the keret
  const { kataCompute } = await import('./kata.js');
  const kata = cl.lifecycle === 'aktiv' ? await kataCompute(db, clientId, Number(today.slice(0, 4)), today) : null;
  if (comp) {
    const m = comp.result.meters;
    if (m.afa.ratio >= 0.8 || m.afa.projectedHuf >= m.afa.limitHuf || (!kata && m.atalanyCap.ratio >= 0.8)) flags.add('hatar_kozel');
  }
  if (kata && !kata.rules.draft) {
    if (kata.meter.level !== 'rendben' || kata.meter.projectedOverHuf > 0) flags.add('hatar_kozel');
    if (kata.meter.level === 'tullepve') flags.add('kata_figyelem');
    const { kataRisksOf } = await import('./szamla-ertesites.js');
    if ((await kataRisksOf(deps, cl, { limit: 1 })).length) flags.add('kata_figyelem');
  }
  // SPEC §32.B: an unsettled backlog on the last NAV folyószámla check; an open önellenőrzés
  const { reconFlag } = await import('./folyoszamla.js');
  if (await reconFlag(db, clientId)) flags.add('folyoszamla_elteres');
  const { openCorrectionCount } = await import('./onellenorzes.js');
  if ((await openCorrectionCount(db, clientId)) > 0) flags.add('onellenorzes_nyitott');
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
  const [cl] = await db.select({ createdAt: clients.createdAt, firstName: clients.firstName, lastName: clients.lastName, accountantId: clients.accountantId }).from(clients).where(eq(clients.id, clientId)).limit(1);
  // Deadlines that passed before the client joined belong to the previous accountant: they are not
  // shown as ours (and never as "lejárt"), unless we approved or filed that period ourselves.
  const serviceStart = cl ? todayBudapest(cl.createdAt) : '0000-01-01';
  const profiles = await db
    .select({ year: clientTaxProfiles.year, status: clientTaxProfiles.status, hipaMethod: clientTaxProfiles.hipaMethod, regime: clientTaxProfiles.regime, kataFrom: clientTaxProfiles.kataFrom, kataTo: clientTaxProfiles.kataTo, kataVariant: clientTaxProfiles.kataVariant })
    .from(clientTaxProfiles)
    .where(eq(clientTaxProfiles.clientId, clientId));
  const statusOf = (year: number) => profiles.find((x) => x.year === year)?.status;
  // k7c2 / SPEC §32: no átalány quarter for the months of a KATA (H1 hides the rows; this guards rows not hidden yet)
  const kataQuarter = (year: number, quarter: number | null) => quarterFullyKata(kataRangeOfProfile(profiles.find((x) => x.year === year) ? { ...profiles.find((x) => x.year === year)!, year } : null), year, quarter ?? 0);
  const periods = await db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), periodVisible, sql`${taxPeriods.dueDate} between ${from} and ${to}`));
  const content = deps.content;
  const ap = periods.some((p) => p.kind === 'kata') ? await accountantParams(db, cl?.accountantId ?? null) : {};
  for (const p of periods) {
    // SPEC §32: a KATA month. Before the app (backfilled): the client sees it only after the accountant verified it.
    if (p.kind === 'kata') {
      const items = await db.select().from(taxPaymentItems).where(and(eq(taxPaymentItems.taxPeriodId, p.id), isNull(taxPaymentItems.voidedAt)));
      const verifiedOk = items.length > 0 && items.every((i) => i.verification === 'rendben');
      if (p.backfilled && !verifiedOk && !acc) continue;
      const honap = monthName(Number(p.periodKey.slice(5, 7)));
      const amount = items.reduce((a, b) => a + b.amountHuf, 0);
      if (p.exemptReason && !items.length) {
        const ok = (await content.get(`kata.mentes_ok.${p.exemptReason}`)) || KATA_EXEMPT_LABELS[p.exemptReason as KataExemptKind] || p.exemptReason;
        out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', fill(await content.get('kata.f1.hatarido_mentes'), { honap, ok }), p.dueDate, true, `/fizetes/${p.id}`));
      } else if (p.calcStatus !== 'jovahagyva') {
        // 2027 (T/928): the amount is not confirmed – no amount, never "lejárt" for the client
        if (acc) out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', `Kata – ${honap}: a havi összeg nincs megerősítve (T/928)`, p.dueDate, false, `/ugyfelek/${clientId}/ado`, undefined, undefined, true));
        else if (p.dueDate >= today) out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', fill(await content.get('kata.f1.hatarido_nincs_osszeg'), { ...ap, honap }), p.dueDate, false, `/fizetes/${p.id}`, undefined, undefined, true));
      } else {
        const paid = p.paymentStatus === 'befizetve_jelezve' || p.paymentStatus === 'ellenorizve';
        const verified = p.paymentStatus === 'befizetve_jelezve' ? false : paid ? true : undefined;
        const title = acc && p.backfilled && !verifiedOk ? `Kata – ${honap}: ellenőrizd a folyószámlán (az app előtti hónap)` : fill(await content.get('kata.f1.hatarido_befizetes'), { honap, osszeg: fmt(amount) });
        out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', title, p.dueDate, paid, acc ? `/ugyfelek/${clientId}/ado` : `/fizetes/${p.id}`, amount, verified, false));
      }
      continue;
    }
    if (p.dueDate < serviceStart && p.calcStatus !== 'jovahagyva' && p.filingStatus !== 'beadva') continue;
    if (p.kind === 'negyedev' && kataQuarter(p.year, p.quarter)) continue;
    const total = await periodTotal(db, p);
    const paid = p.paymentStatus === 'befizetve_jelezve' || p.paymentStatus === 'ellenorizve' || (p.calcStatus === 'jovahagyva' && p.paymentStatus === 'nincs_fizetendo');
    const verified = p.paymentStatus === 'befizetve_jelezve' ? false : paid ? true : undefined;
    if (p.kind === 'negyedev') {
      const nyugdijas = statusOf(p.year) === 'nyugdijas' || p.filingForm === null;
      out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', `${periodLabel(p)}: ${nyugdijas ? 'SZJA-előleg' : 'TB-járulék, szocho, SZJA-előleg'}`, p.dueDate, paid, p.calcStatus === 'jovahagyva' && !acc ? `/fizetes/${p.id}` : '/', total ?? undefined, verified, p.calcStatus !== 'jovahagyva'));
      // NAV 100 ch. 6.3: no '58 return for a nyugdíjas átalányadózó.
      if (!nyugdijas) out.push(dl(today, `per:${p.id}:bevallas`, 'bevallas', `${periodLabel(p)}: bevallás (${acc ? 'te adod be' : 'a könyvelőd adja be'})`, p.dueDate, p.filingStatus === 'beadva', '/dosszie'));
    } else if (p.calcStatus === 'jovahagyva') {
      // SPEC §32: an approved payment opens the shared payment sheet
      // SPEC §32.B: the yearly differences and the önellenőrzés show their amount ("Szja-különbözet 2026: 120 000 Ft")
      if (isAnnualPeriodKind(p.kind)) {
        const accLink = p.kind === 'onellenorzes' ? `/ugyfelek/${clientId}/onellenorzes` : `/ugyfelek/${clientId}/eves`;
        out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', total ? `${periodLabel(p)}: ${fmt(total)} Ft` : periodLabel(p), p.dueDate, paid, acc ? accLink : `/fizetes/${p.id}`, total ?? undefined, verified));
      } else out.push(dl(today, `per:${p.id}:befizetes`, 'befizetes', periodLabel(p), p.dueDate, paid, acc ? '/' : `/fizetes/${p.id}`, total ?? undefined, verified));
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
  // k7b (KONYVELO_LEFEDETTSEG, 2. hiba): the annual returns are "kész" once the accountant recorded the filing on the
  // Éves zárás page (annual_closings.filed_szja_at / filed_hipa_at) – never "lejárt" in the Határidő-figyelő after that.
  const closings = await db
    .select({
      id: annualClosings.id,
      taxYear: annualClosings.taxYear,
      filedSzjaAt: annualClosings.filedSzjaAt,
      filedHipaAt: annualClosings.filedHipaAt,
      diffHuf: annualClosings.diffHuf,
      hipaNeeded: annualClosings.hipaNeeded,
      hipaAmounts: annualClosings.hipaAmounts,
      refundStatus: annualClosings.refundStatus,
      refundExpectedBy: annualClosings.refundExpectedBy,
    })
    .from(annualClosings)
    .where(eq(annualClosings.clientId, clientId));
  const closingOf = (year: number) => closings.find((x) => x.taxYear === year);
  // SPEC §32.B: once the accountant recorded the numbers, the difference is its own row (per:<id>) – the return row is
  // "kész" for the client as soon as it is filed; a HIPA that needs no return is "kész" too.
  const szjaDone = (year: number, due: string) => {
    const a = closingOf(year);
    return Boolean(a?.filedSzjaAt) && (acc || due < today || a?.diffHuf != null);
  };
  const hipaFiled = (year: number) => {
    const a = closingOf(year);
    return a && (a.hipaNeeded === false || a.hipaAmounts?.returnNeeded === false) ? new Date(0) : a?.filedHipaAt;
  };
  // The client's item also says "és a különbözet befizetése": we do not track that transfer, so for the client a filed
  // return stays open until its due date (the Főoldal keeps the payment reminder) and turns "kész" – not "lejárt" – after.
  const annualDone = (filedAt: Date | null | undefined, dueDate: string) => Boolean(filedAt) && (acc || dueDate < today);
  for (let y = Math.max(fromYear, 2026); y <= toYear; y++) {
    const prof = profiles.find((x) => x.year === y);
    if (!prof) continue;
    for (const d of deadlinesFor(y, { hipaMethod: prof.hipaMethod })) {
      if (d.dueDate < from || d.dueDate > to || d.dueDate < serviceStart) continue;
      const who = acc ? 'te adod be' : 'a könyvelőd adja be';
      if (d.periodKey === String(y)) {
        // no 26SZJA for a KATA year: EVERY KATA client files the yearly declaration instead ('26KATA, Kata tv. 10. §) – below
        if (prof.regime === 'kata') continue;
        // "Éves SZJA-bevallás (26SZJA) a 2026-os évről" + what the client has to do about it
        out.push(dl(today, `ev:${y}:szja`, 'bevallas', `${d.title} és a különbözet befizetése (${who})`, d.dueDate, szjaDone(y, d.dueDate), acc ? `/ugyfelek/${clientId}/eves` : '/eves-zaras'));
      } else if (d.periodKey === `${y}-HIPA`) {
        out.push(dl(today, `ev:${y}:hipa`, 'bevallas', `Iparűzési adó ${y}: éves bevallás és különbözet (${who})`, d.dueDate, annualDone(hipaFiled(y), d.dueDate), acc ? `/ugyfelek/${clientId}/eves` : '/eves-zaras'));
      }
    }
  }
  // SPEC §32 (H3): the KATA months are real tax_periods rows now (above); the synthetic k7c2 rows are gone. Listed here: the
  // yearly declaration (Kata tv. 10. §: EVERY KATA client – 25 February next year, or kataTo + 30 days) and, for the
  // accountant, the free-month notices (7. § (10): a)–c) states, by the 12th of the next month).
  for (let y = Math.max(fromYear, 2026); y <= toYear; y++) {
    const prof = profiles.find((x) => x.year === y);
    const kr = prof ? kataRangeOfProfile({ ...prof, year: y }) : null;
    if (!prof || !kr) continue;
    const decl = deadlinesFor(y, { regime: 'kata', kataFrom: kr.from, kataTo: kr.to, kataVariant: prof.kataVariant ?? 'regi', hipaMethod: 'nincs' }).find((d) => d.periodKey === `${y}-KATA`);
    if (decl && decl.dueDate >= from && decl.dueDate <= to && decl.dueDate >= serviceStart) {
      const form = `'${String(y).slice(2)}KATA`;
      out.push(dl(today, `ev:${y}:kata`, 'bevallas', fill(await content.get('kata.f1.hatarido_nyilatkozat'), { form, who: acc ? 'te adod be' : 'a könyvelőd adja be' }), decl.dueDate, szjaDone(y, decl.dueDate), acc ? `/ugyfelek/${clientId}/eves` : '/eves-zaras'));
    }
    if (acc) {
      const { kataCompute } = await import('./kata.js');
      const kc = await kataCompute(db, clientId, y, today < `${y}-12-31` ? today : `${y}-12-31`);
      for (const m of kc?.months ?? []) {
        if (m.liable || !m.exemptReason || !kataExemptNeedsReport(m.exemptReason as KataExemptKind)) continue;
        if (m.dueDate < from || m.dueDate > to) continue;
        const reported = (kc?.breaks ?? []).some((b) => b.reportedOn && b.from <= `${m.monthKey}-31` && b.to >= `${m.monthKey}-01`);
        out.push(dl(today, `kata-bej:${clientId}:${m.monthKey}`, 'egyeb', `Mentesség bejelentése: ${monthName(m.month)} (Kata tv. 7. § (10))`, m.dueDate, reported, `/ugyfelek/${clientId}/ado`));
      }
    }
  }
  // SPEC §32.B: the szja refund (Art. 64. § (1): 30 days after the return, not before 1 March) – the NAV pays it; for the
  // accountant it is "lejárt" once the expected date passed, the client sees it only until then (the card tells what to do).
  for (const a of closings) {
    if (!a.refundStatus || !a.refundExpectedBy || a.diffHuf == null || a.diffHuf >= 0) continue;
    if (a.refundExpectedBy < from || a.refundExpectedBy > to) continue;
    const done = a.refundStatus !== 'var';
    if (!acc && !done && a.refundExpectedBy < today) continue;
    out.push(dl(today, `refund:${a.id}`, 'egyeb', `Visszajáró szja: ${fmt(-a.diffHuf)} Ft – a NAV utalja`, a.refundExpectedBy, done, acc ? `/ugyfelek/${clientId}/eves` : '/eves-zaras'));
  }
  // SPEC §32.B: the next NAV folyószámla check (accountant only)
  if (acc) {
    const { latestReconciliations } = await import('./folyoszamla.js');
    const rec = (await latestReconciliations(db, [clientId])).get(clientId);
    if (rec?.nextCheckOn && rec.nextCheckOn >= from && rec.nextCheckOn <= to) out.push(dl(today, `fsz:${clientId}`, 'egyeb', 'NAV-folyószámla egyeztetése', rec.nextCheckOn, false, `/ugyfelek/${clientId}/folyoszamla`));
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
