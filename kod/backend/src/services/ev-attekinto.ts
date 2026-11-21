// SPEC §32.B – "Éves áttekintő" (terv 4.6): one row per client for a tax year – quarters or KATA months, the last NAV
// folyószámla check, the annual closing (status, whose turn), the difference, the HIPA, the open önellenőrzések, and a short
// "mi hiányzik" list. A few aggregate queries for all clients (never a full year calculation per client – HIANYLISTA 3.x).
// Read only: the accountant sees his own clients, the admin everybody (or one accountant's).
import { and, eq, inArray, sql } from 'drizzle-orm';
import { ANNUAL_BALL, type ClientFlag } from '../_shared/enums.js';
import type { YearOverview, YearOverviewFilter, YearOverviewRow } from '../_shared/eves.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { annualClosings, clients, clientTaxProfiles, taxCorrections, taxPaymentItems, taxPeriods } from '../db/schema.js';
import { huDayMonth, monthName, quarterLabel, todayBudapest } from '../lib/dates.js';
import { latestReconciliations } from './folyoszamla.js';
import { clientName } from './people.js';
import { periodVisible } from './tax.js';

type PeriodRow = typeof taxPeriods.$inferSelect;
type ItemRow = typeof taxPaymentItems.$inferSelect;

function payState(p: PeriodRow, items: ItemRow[]): YearOverviewRow['quarters'][number]['state'] {
  if (p.calcStatus !== 'jovahagyva') return p.calcStatus === 'becsles' ? 'becsles' : 'nincs';
  if (!items.length) return 'nincs_fizetendo';
  if (items.some((i) => i.verification === 'elteres')) return 'elteres';
  if (items.every((i) => i.verification === 'rendben')) return 'ellenorizve';
  if (items.every((i) => i.markedPaidAt || i.verification === 'rendben')) return 'jelolve';
  return 'jovahagyva';
}

export async function yearOverview(deps: Deps, db: DbOrTx, o: { accountantId: string | null; year: number; filter?: YearOverviewFilter }): Promise<YearOverview> {
  const today = todayBudapest(deps.now());
  const y = o.year;
  const base = await db
    .select()
    .from(clients)
    .where(and(o.accountantId ? eq(clients.accountantId, o.accountantId) : undefined, sql`${clients.lifecycle} <> 'bekotes_alatt'`));
  const ids = base.map((c) => c.id);
  const empty: YearOverview = { year: y, rows: [], counts: { mind: 0, hianyzik: 0, ram_var: 0, ugyfelre_var: 0, lejart: 0, kata: 0, atalany: 0 } };
  if (!ids.length) return empty;
  const profiles = await db.select().from(clientTaxProfiles).where(and(inArray(clientTaxProfiles.clientId, ids), eq(clientTaxProfiles.year, y)));
  const annuals = await db.select().from(annualClosings).where(and(inArray(annualClosings.clientId, ids), eq(annualClosings.taxYear, y)));
  // a former client only while his closing of this year is open
  const list = base.filter((c) => c.lifecycle !== 'megszunt' || annuals.some((a) => a.clientId === c.id && a.status !== 'nem_indult' && a.status !== 'kesz'));
  const periods = await db.select().from(taxPeriods).where(and(inArray(taxPeriods.clientId, ids), eq(taxPeriods.year, y), periodVisible));
  const periodIds = periods.map((p) => p.id);
  const items = periodIds.length ? await db.select().from(taxPaymentItems).where(and(inArray(taxPaymentItems.taxPeriodId, periodIds), sql`${taxPaymentItems.voidedAt} is null`)) : [];
  const itemsOf = new Map<string, ItemRow[]>();
  for (const i of items) itemsOf.set(i.taxPeriodId, [...(itemsOf.get(i.taxPeriodId) ?? []), i]);
  const recon = await latestReconciliations(db, ids);
  const corr = await db
    .select({ clientId: taxCorrections.clientId, status: taxCorrections.status })
    .from(taxCorrections)
    .where(and(inArray(taxCorrections.clientId, ids), inArray(taxCorrections.status, ['tervezet', 'ugyfelre_var', 'jovahagyva', 'beadva'])));
  const rows: YearOverviewRow[] = [];
  for (const c of list) {
    const prof = profiles.find((p) => p.clientId === c.id);
    const regime = prof?.regime ?? 'atalany';
    const ps = periods.filter((p) => p.clientId === c.id);
    const missing: string[] = [];
    let ramVar = false;
    let ugyfelreVar = false;
    let overdue = false;
    const quarters: YearOverviewRow['quarters'] = [];
    for (const p of ps.filter((x) => x.kind === 'negyedev').sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
      const st = payState(p, itemsOf.get(p.id) ?? []);
      const late = p.dueDate < today;
      const filed = p.filingStatus === 'beadva';
      const q = p.quarter ? quarterLabel(p.quarter) : p.periodKey;
      const qOverdue = late && (st === 'nincs' || st === 'becsles' || st === 'jovahagyva' || st === 'elteres' || (Boolean(p.filingForm) && !filed));
      quarters.push({ key: p.periodKey, state: st, filed, overdue: qOverdue });
      if (late && (st === 'nincs' || st === 'becsles')) {
        missing.push(`${q}: nincs jóváhagyva`);
        ramVar = true;
      } else if (late && st === 'jovahagyva') {
        missing.push(`${q}: a befizetés nincs jelölve`);
        ugyfelreVar = true;
      }
      if (st === 'jelolve') {
        missing.push(`${q}: ellenőrizetlen befizetés`);
        ramVar = true;
      }
      if (st === 'elteres') {
        missing.push(`${q}: eltérés a befizetésnél`);
        ramVar = true;
      }
      if (late && p.filingForm && !filed) {
        missing.push(`${q}: a ${p.filingForm} nincs beadva`);
        ramVar = true;
      }
      if (qOverdue) overdue = true;
    }
    let kata: YearOverviewRow['kata'] = null;
    const km = ps.filter((x) => x.kind === 'kata');
    if (km.length) {
      kata = { ok: 0, open: 0, unverified: 0, exempt: 0 };
      for (const p of km) {
        const st = payState(p, itemsOf.get(p.id) ?? []);
        if (p.exemptReason && st === 'nincs_fizetendo') kata.exempt++;
        else if (st === 'ellenorizve') kata.ok++;
        else if (st === 'jelolve') kata.unverified++;
        else if (st === 'jovahagyva' || st === 'elteres') {
          if (p.dueDate < today || p.backfilled) kata.open++;
        }
      }
      if (kata.open) {
        missing.push(`Kata: ${kata.open} hónap nincs rendben (${km.filter((p) => payState(p, itemsOf.get(p.id) ?? []) === 'jovahagyva' && p.dueDate < today).map((p) => monthName(Number(p.periodKey.slice(5, 7)))).join(', ') || 'app előtti hónapok'})`);
        ramVar = true;
        overdue = true;
      }
      if (kata.unverified) {
        missing.push(`Kata: ${kata.unverified} ellenőrizetlen befizetés`);
        ramVar = true;
      }
    }
    const r = recon.get(c.id);
    const reconRow = r ? { asOf: r.asOf, status: r.status, nextCheckOn: r.nextCheckOn ?? null, overdue: Boolean(r.nextCheckOn && r.nextCheckOn < today), resolved: Boolean(r.resolvedAt) } : null;
    if (!r) missing.push('Nincs folyószámla-egyeztetés');
    else {
      if (reconRow!.overdue) {
        missing.push(`Folyószámla-ellenőrzés esedékes: ${huDayMonth(r.nextCheckOn!)}`);
        ramVar = true;
        overdue = true;
      }
      if ((r.status === 'hatralek' || r.status === 'elteres') && !r.resolvedAt) {
        missing.push(r.status === 'hatralek' ? 'Folyószámla: hátralék' : 'Folyószámla: eltérés');
        ugyfelreVar = true;
      }
    }
    const a = annuals.find((x) => x.clientId === c.id);
    let annual: YearOverviewRow['annual'] = null;
    let difference: YearOverviewRow['difference'] = null;
    if (a) {
      annual = { status: a.status, ball: ANNUAL_BALL[a.status] };
      if (annual.ball === 'konyvelo') {
        missing.push('Éves zárás: rád vár');
        ramVar = true;
      } else if (annual.ball === 'ugyfel') ugyfelreVar = true;
      if (a.diffHuf != null && a.filedSzjaAt) {
        const sp = a.settlementPeriodId ? ps.find((p) => p.id === a.settlementPeriodId) : undefined;
        const spState = sp ? payState(sp, itemsOf.get(sp.id) ?? []) : null;
        const settled = a.diffHuf > 0 ? spState === 'ellenorizve' : a.diffHuf < 0 && a.regime === 'atalany' ? Boolean(a.refundStatus && a.refundStatus !== 'var') : true;
        difference = {
          diffHuf: a.diffHuf,
          settled,
          label: a.diffHuf > 0 ? (spState === 'ellenorizve' ? 'befizetve, ellenőrizve' : spState === 'jelolve' ? 'jelölte' : 'fizetendő') : a.diffHuf < 0 ? (a.refundStatus === 'var' ? 'visszajár, vár' : `visszajár: ${a.refundStatus}`) : 'nincs különbözet',
        };
        if (a.diffHuf > 0 && spState === 'jelolve') {
          missing.push('Különbözet: ellenőrizetlen befizetés');
          ramVar = true;
        }
        if (a.diffHuf > 0 && sp && sp.dueDate < today && spState === 'jovahagyva') {
          missing.push('Különbözet: lejárt, nincs jelölve');
          ugyfelreVar = true;
          overdue = true;
        }
        if (a.diffHuf < 0 && a.refundStatus === 'var' && a.refundExpectedBy && a.refundExpectedBy < today) {
          missing.push('A visszajáró adó késik');
          ramVar = true;
        }
      }
    }
    const adv = ps.filter((x) => x.kind === 'hipa');
    const advStates = adv.map((p) => payState(p, itemsOf.get(p.id) ?? []));
    const hipa: YearOverviewRow['hipa'] = {
      advance: prof?.hipaMethod === 'nincs' ? 'nem_kell' : !adv.length ? 'nincs' : advStates.every((s) => s === 'ellenorizve' || s === 'nincs_fizetendo') ? 'ellenorizve' : advStates.some((s) => s === 'jelolve') ? 'jelolve' : advStates.some((s) => s === 'jovahagyva') ? 'jovahagyva' : 'nincs',
      annual: prof?.hipaMethod === 'nincs' || a?.hipaNeeded === false ? 'nem_kell' : a?.filedHipaAt ? 'beadva' : 'nincs',
    };
    adv.forEach((p, i) => {
      if (p.dueDate < today && (advStates[i] === 'nincs' || advStates[i] === 'becsles')) {
        missing.push('HIPA-előleg: nincs jóváhagyva');
        ramVar = true;
      }
    });
    const openCorrections = corr.filter((x) => x.clientId === c.id).length;
    if (openCorrections) {
      missing.push(`Nyitott önellenőrzés: ${openCorrections}`);
      if (corr.some((x) => x.clientId === c.id && x.status === 'ugyfelre_var')) ugyfelreVar = true;
      if (corr.some((x) => x.clientId === c.id && (x.status === 'tervezet' || x.status === 'jovahagyva'))) ramVar = true;
    }
    rows.push({
      clientId: c.id,
      name: clientName(c),
      lifecycle: c.lifecycle,
      regime,
      flags: (c.nextFlags ?? []) as ClientFlag[],
      quarters,
      kata,
      reconciliation: reconRow,
      annual,
      difference,
      hipa,
      openCorrections,
      missing,
      ball: ramVar ? 'konyvelo' : ugyfelreVar ? 'ugyfel' : null,
      overdue,
    });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, 'hu'));
  const test = (r: YearOverviewRow, f: YearOverviewFilter) =>
    f === 'mind' || (f === 'hianyzik' && r.missing.length > 0) || (f === 'ram_var' && r.ball === 'konyvelo') || (f === 'ugyfelre_var' && r.ball === 'ugyfel') || (f === 'lejart' && r.overdue) || (f === 'kata' && r.regime === 'kata') || (f === 'atalany' && r.regime === 'atalany');
  const filters: YearOverviewFilter[] = ['mind', 'hianyzik', 'ram_var', 'ugyfelre_var', 'lejart', 'kata', 'atalany'];
  const counts = Object.fromEntries(filters.map((f) => [f, rows.filter((r) => test(r, f)).length])) as YearOverview['counts'];
  const f = o.filter ?? 'mind';
  return { year: y, rows: rows.filter((r) => test(r, f)), counts };
}
