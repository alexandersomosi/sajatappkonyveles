// Background jobs of SPEC §28 (allowances yearly / monthly check) and §28.K (check-in, reminders, annual closing, the
// service lock, pause reminders). Registered by ONE line in jobs.ts jobDefs(). The NAV-sync hook of §28.2 is not a job:
// it is the call at the end of syncClient.
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { ALLOWANCE_LABELS } from './_shared/bekotes.js';
import type { Deps } from './deps.js';
import { assistRequests, checkinItems, clientAllowances, clients, clientTaxProfiles, feeCharges, annualClosings, users } from './db/schema.js';
import { budapestParts, todayBudapest } from './lib/dates.js';
import { accountantParams, notify } from './notify/notify.js';
import type { JobDef } from './jobs.js';
import { fiatal25Months } from './tax/engine.js';
import { answersRow } from './services/kedvezmeny.js';
import { notifyOnce, jobRemindersK28, staffOverdueCount } from './services/emlekezteto.js';
import { firstWorkingDay, jobCheckinOpen } from './services/havi-ellenorzes.js';
import { jobAnnualOpen, jobAnnualReminders } from './services/eves-zaras.js';
import { jobServiceLockCheck } from './services/zarolas.js';
import { accountantUserOf } from './services/team.js';

/** 1 January 00:20: next year's rows (javasolt) for every client with approved items of the old year. */
export async function jobAllowancesNewYear(deps: Deps): Promise<number> {
  const db = deps.db;
  const year = Number(todayBudapest(deps.now()).slice(0, 4));
  const old = await db.select().from(clientAllowances).where(and(eq(clientAllowances.year, year - 1), eq(clientAllowances.status, 'jovahagyva')));
  let n = 0;
  for (const r of old) {
    let months = r.months;
    if (r.kind === 'fiatal25') {
      const ans = await answersRow(db, r.clientId, year - 1);
      months = fiatal25Months(ans?.answers?.birthMonth ?? undefined, year);
      if (!months.length) continue;
    } else if (r.kind === 'elso_hazasok') continue; // the 24 months are recomputed from the answers when resubmitted
    else months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const ins = await db
      .insert(clientAllowances)
      .values({ clientId: r.clientId, year, kind: r.kind, status: 'javasolt', months, params: r.params, inYear: r.inYear, proposal: { months, params: r.params, reasons: ['Az előző évi jóváhagyott kedvezmény alapján.'] }, createdAt: deps.now(), updatedAt: deps.now() })
      .onConflictDoNothing()
      .returning({ id: clientAllowances.id });
    n += ins.length;
  }
  return n;
}

/** 5 January 09:00: "Új év: nézd át a kedvezményeidet" to every client with allowances last year. */
export async function jobAllowanceCheckYearly(deps: Deps): Promise<number> {
  const db = deps.db;
  const year = Number(todayBudapest(deps.now()).slice(0, 4));
  const rows = await db.selectDistinct({ clientId: clientAllowances.clientId }).from(clientAllowances).where(and(eq(clientAllowances.year, year - 1), eq(clientAllowances.status, 'jovahagyva')));
  let n = 0;
  for (const r of rows) {
    const [cl] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
    if (!cl || cl.lifecycle !== 'aktiv') continue;
    if (await notifyOnce(deps, `rem:allowance_check:${cl.id}:ev_eleje:${year}`, { userId: cl.userId, kind: 'allowance_check', variant: 'ev_eleje', link: '/kedvezmenyek' })) n++;
  }
  return n;
}

/** Monthly 1st 09:00: an approved item ends this month (fiatal25 birthday month, anya30 last year, első házasok 24th month). */
export async function jobAllowanceCheckMonthly(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const rows = await db.select().from(clientAllowances).where(and(eq(clientAllowances.year, year), eq(clientAllowances.status, 'jovahagyva'), inArray(clientAllowances.kind, ['fiatal25', 'anya30', 'elso_hazasok'])));
  let n = 0;
  for (const r of rows) {
    const last = Math.max(...r.months);
    if (last !== month || last === 12) continue;
    const [cl] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
    if (!cl) continue;
    const params = { ...(await accountantParams(db, cl.accountantId)), label: ALLOWANCE_LABELS[r.kind] };
    if (await notifyOnce(deps, `rem:allowance_check:${r.id}:lejar:${today.slice(0, 7)}`, { userId: cl.userId, kind: 'allowance_check', variant: 'lejar', params, link: '/kedvezmenyek' })) n++;
    const acc = await accountantUserOf(db, cl);
    if (acc) await notifyOnce(deps, `rem:allowance_check:${r.id}:lejar_acc:${today.slice(0, 7)}`, { userId: acc.userId, kind: 'allowance_check', variant: 'lejar', params, link: `/ugyfelek/${cl.id}?tab=kedvezmenyek` });
  }
  return n;
}

/** Staff digest lines of §28 / §28.K for one staff member (null when nothing waits). */
export async function k28DigestLines(deps: Deps, p: { id: string; role: string }): Promise<string[]> {
  const db = deps.db;
  const lines: string[] = [];
  const [allow] = await db.select({ n: sql<number>`count(distinct ${clientAllowances.clientId})::int` }).from(clientAllowances).where(inArray(clientAllowances.status, ['javasolt', 'kerdes']));
  if (p.role === 'admin' && Number(allow?.n ?? 0)) lines.push(`- Kedvezmény vár: ${Number(allow!.n)} ügyfél`);
  const changes = await db.select({ id: assistRequests.id }).from(assistRequests).where(and(sql`${assistRequests.kind} like 'valtozas_%'`, eq(assistRequests.status, 'bejelentes_bekuldve')));
  if (changes.length) lines.push(`- Változásbejelentés vár rád: ${changes.length}`);
  const [chk] = await db.select({ n: sql<number>`count(distinct ${checkinItems.clientId})::int` }).from(checkinItems).where(eq(checkinItems.status, 'uj'));
  if (p.role === 'admin' && Number(chk?.n ?? 0)) lines.push(`- Havi változás: ${Number(chk!.n)} ügyfél`);
  const [ann] = await db.select({ n: sql<number>`count(*)::int` }).from(annualClosings).where(eq(annualClosings.status, 'konyvelonel'));
  if (p.role === 'admin' && Number(ann?.n ?? 0)) lines.push(`- Éves zárás vár rád: ${Number(ann!.n)}`);
  const locked = await db.select({ id: clients.id }).from(clients).where(sql`${clients.serviceLock} is not null`);
  if (p.role === 'admin' && locked.length) lines.push(`- Zárolt ügyfél: ${locked.length}`);
  const overdue = await staffOverdueCount(deps);
  if (p.role === 'admin' && overdue) lines.push(`- Ügyfélre vár 7 napja: ${overdue}`);
  const refunds = await db.select({ id: feeCharges.id }).from(feeCharges).where(eq(feeCharges.status, 'visszaterites_kell'));
  if (p.role === 'admin' && refunds.length) lines.push(`- Díj-visszatérítés vár: ${refunds.length}`);
  void users;
  void clientTaxProfiles;
  void lt;
  return lines;
}

const daily = (h: number, m: number) => (now: Date) => {
  const p = budapestParts(now);
  return p.hour * 60 + p.minute >= h * 60 + m ? p.date : null;
};

export function jobDefsK28(): JobDef[] {
  return [
    {
      name: 'allowances_new_year',
      slot: (now) => {
        const p = budapestParts(now);
        return p.month === 1 && p.day === 1 && p.hour * 60 + p.minute >= 20 ? p.date : null;
      },
      run: (d) => jobAllowancesNewYear(d),
    },
    {
      name: 'allowance_check_yearly',
      slot: (now) => {
        const p = budapestParts(now);
        return p.month === 1 && p.day === 5 && p.hour >= 9 ? p.date : null;
      },
      run: (d) => jobAllowanceCheckYearly(d),
    },
    {
      name: 'allowance_check_monthly',
      slot: (now) => {
        const p = budapestParts(now);
        return p.day === 1 && p.hour >= 9 ? p.date : null;
      },
      run: (d) => jobAllowanceCheckMonthly(d),
    },
    {
      name: 'checkin_open',
      slot: (now) => {
        const p = budapestParts(now);
        return p.date === firstWorkingDay(p.date) && p.hour >= 9 ? p.date : null;
      },
      run: (d) => jobCheckinOpen(d),
    },
    { name: 'reminders_k28', slot: daily(8, 0), run: (d) => jobRemindersK28(d) },
    {
      name: 'annual_open',
      slot: (now) => {
        const p = budapestParts(now);
        return p.month === 1 && p.day >= 5 && p.hour >= 9 ? `${p.date.slice(0, 4)}` : null;
      },
      run: (d) => jobAnnualOpen(d),
    },
    { name: 'annual_reminders', slot: daily(9, 0), run: (d) => jobAnnualReminders(d) },
    { name: 'service_lock_check', slot: daily(6, 20), run: (d) => jobServiceLockCheck(d) },
  ];
}
