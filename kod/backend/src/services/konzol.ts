// SPEC §29.9 F9 – the owner console (read side): access + step-up, overview numbers, the client list, the client card
// sections ("everything we store") and "Ügyfél szemével". Admin only; every route needs TOTP enabled; every write
// (konzol-muveletek.ts) needs a step-up younger than 10 minutes for the current session.
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { verify as argonVerify } from '@node-rs/argon2';
import { CLIENT_LIFECYCLES, FEE_CHARGE_STATUSES } from '../_shared/enums.js';
import { FEE_KIND_LABELS } from '../_shared/bekotes.js';
import {
  CONSOLE_MASKED_FIELDS,
  CONSOLE_NAV_FIELDS,
  CONSOLE_PROFILE_FIELDS,
  CONSOLE_PROFILE_LABELS,
  CONSOLE_RULES,
  CONSOLE_SECTION_LABELS,
  CONSOLE_SECTIONS,
  CERT_STATUS_LABELS,
  CERT_TYPE_TEXTS,
  TERMINATION_KIND_LABELS,
  type ConsoleClientHeader,
  type ConsoleClientQuery,
  type ConsoleClientRow,
  type ConsoleField,
  type ConsoleOverview,
  type ConsolePreview,
  type ConsoleProfileField,
  type ConsoleSection,
  type ConsoleSectionView,
  type TerminationKind,
} from '../_shared/k29f.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import {
  accountants,
  adminStepUps,
  annualClosings,
  assistRequests,
  auditLog,
  checkinItems,
  clientPriceOverrides,
  clients,
  clientTaxProfiles,
  consents,
  documents,
  feeCharges,
  feeInvoices,
  messages,
  navCredentials,
  navSyncRuns,
  notifications,
  paymentMethods,
  payments,
  requests,
  sessions,
  simplepayTransactions,
  subscriptionPauses,
  subscriptions,
  users,
} from '../db/schema.js';
import { audit } from '../audit.js';
import { auth, type C } from '../http/core.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { base32Decode, verifyTotp } from '../lib/totp.js';
import { clientName, type ClientRow } from './people.js';
import { anonymizeBlockers } from './anonimizalas.js';
import { certStatusOf, certTypeOf } from './igazolas.js';
import { effectiveMonthlyAmount } from './payments.js';
import { certificateRequests } from '../db/schema.js';
import { onboardingState } from './onboarding.js';
import { feesView } from './dijak.js';
import { serviceLockView } from './zarolas.js';
import { subscriptionView } from './subscription.js';

const fmt = (n: number) => `${new Intl.NumberFormat('hu-HU').format(n).replace(/ /g, ' ')} Ft`;
const dt = (d: Date | null | undefined) => (d ? d.toISOString().replace('T', ' ').slice(0, 16) : null);
const LIFECYCLE_LABELS: Record<string, string> = { bekotes_alatt: 'Bekötés alatt', aktiv: 'Aktív', felfuggesztve: 'Felfüggesztve', megszunt: 'Megszűnt' };

// ---------------------------------------------------------------------------------------------------------------------
// access + step-up (§29.9.1)
// ---------------------------------------------------------------------------------------------------------------------
/** The admin must have TOTP on (regardless of STAFF_TOTP_REQUIRED). The route group already answered 404 to non-admins. */
export function assertConsoleMfa(c: C): void {
  const a = auth(c);
  if (a.role !== 'admin') throw E.notFound();
  if (!a.totpEnabled) throw new ApiError(403, 'mfa_setup_required', 'A konzolhoz kapcsold be a kétlépcsős belépést.');
}

/** Verifies a TOTP (replay-safe) or a recovery code of the admin; on success stores the step-up of this session. */
export async function consoleStepUp(deps: Deps, c: C, code: string): Promise<{ verifiedAt: string; validUntil: string }> {
  assertConsoleMfa(c);
  const a = auth(c);
  const now = deps.now();
  const h = deps.limiter.hit(`stepup:${a.userId}`, 10, 15 * 60_000);
  if (!h.ok) throw E.rateLimited(h.retryAfterSec);
  const [u] = await deps.db.select().from(users).where(eq(users.id, a.userId)).limit(1);
  if (!u || !u.totpSecretEnc) throw new ApiError(403, 'mfa_setup_required', 'A konzolhoz kapcsold be a kétlépcsős belépést.');
  if (u.totpLockedUntil && u.totpLockedUntil > now) throw E.rateLimited((u.totpLockedUntil.getTime() - now.getTime()) / 1000);
  const ok = await checkTotpOrRecovery(deps, u, code);
  if (!ok) {
    const [r] = await deps.db.update(users).set({ totpFailures: sql`${users.totpFailures} + 1` }).where(eq(users.id, u.id)).returning({ n: users.totpFailures });
    if ((r?.n ?? 0) >= 5) await deps.db.update(users).set({ totpFailures: 0, totpLockedUntil: new Date(now.getTime() + 15 * 60_000) }).where(eq(users.id, u.id));
    await audit(deps.db, { action: 'admin.step_up_failed', actorUserId: u.id, actorRole: 'admin', targetType: 'user', targetId: u.id, ipHmac: c.get('ipHmac'), requestId: c.get('requestId') });
    throw E.validation({ code: 'Ez a kód nem jó.' }, 'Ez a kód nem jó.');
  }
  await deps.db.update(users).set({ totpFailures: 0 }).where(eq(users.id, u.id));
  await deps.db
    .insert(adminStepUps)
    .values({ sessionId: a.sessionId, userId: a.userId, verifiedAt: now })
    .onConflictDoUpdate({ target: adminStepUps.sessionId, set: { verifiedAt: now, userId: a.userId } });
  await audit(deps.db, { action: 'admin.step_up', actorUserId: u.id, actorRole: 'admin', targetType: 'user', targetId: u.id, ipHmac: c.get('ipHmac'), requestId: c.get('requestId'), details: { recovery: ok === 'recovery' } });
  return { verifiedAt: now.toISOString(), validUntil: new Date(now.getTime() + CONSOLE_RULES.stepUpMinutes * 60_000).toISOString() };
}

async function checkTotpOrRecovery(deps: Deps, u: typeof users.$inferSelect, code: string): Promise<false | 'totp' | 'recovery'> {
  if (!u.totpSecretEnc) return false;
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (/^\d{6}$/.test(clean)) {
    const secret = base32Decode(deps.data.dec(u.totpSecretEnc, 'users.totp_secret'));
    const step = verifyTotp(secret, clean, deps.now().getTime());
    if (step === null) return false;
    const fresh = await deps.db
      .update(users)
      .set({ totpLastStep: step })
      .where(and(eq(users.id, u.id), or(isNull(users.totpLastStep), lt(users.totpLastStep, step))))
      .returning({ id: users.id });
    return fresh.length ? 'totp' : false;
  }
  if (!/^[a-z0-9]{12}$/.test(clean)) return false;
  const canonical = `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
  return deps.db.transaction(async (tx) => {
    const [row] = await tx.select({ codes: users.recoveryCodes }).from(users).where(eq(users.id, u.id)).limit(1).for('update');
    const codes = row?.codes ?? [];
    for (let i = 0; i < codes.length; i++) {
      const rc = codes[i]!;
      if (rc.usedAt) continue;
      if (await argonVerify(rc.hash, canonical).catch(() => false)) {
        await tx.update(users).set({ recoveryCodes: codes.map((x, j) => (j === i ? { ...x, usedAt: deps.now().toISOString() } : x)) }).where(eq(users.id, u.id));
        return 'recovery' as const;
      }
    }
    return false as const;
  });
}

/** Every console write: 403 step_up_required unless this session verified a code within the last 10 minutes. */
export async function requireStepUp(deps: Deps, c: C): Promise<void> {
  assertConsoleMfa(c);
  const a = auth(c);
  const [s] = await deps.db.select().from(adminStepUps).where(eq(adminStepUps.sessionId, a.sessionId)).limit(1);
  const fresh = s && s.userId === a.userId && s.verifiedAt.getTime() >= deps.now().getTime() - CONSOLE_RULES.stepUpMinutes * 60_000;
  if (!fresh) throw new ApiError(403, 'step_up_required', 'Add meg a kétlépcsős kódodat a módosításhoz.');
}

export async function stepUpState(deps: Deps, c: C): Promise<{ valid: boolean; validUntil: string | null }> {
  const a = auth(c);
  const [s] = await deps.db.select().from(adminStepUps).where(eq(adminStepUps.sessionId, a.sessionId)).limit(1);
  if (!s || s.userId !== a.userId) return { valid: false, validUntil: null };
  const until = new Date(s.verifiedAt.getTime() + CONSOLE_RULES.stepUpMinutes * 60_000);
  return { valid: until > deps.now(), validUntil: until.toISOString() };
}

// ---------------------------------------------------------------------------------------------------------------------
// overview (§29.9.2)
// ---------------------------------------------------------------------------------------------------------------------
function lastMonths(today: string, n: number): string[] {
  const out: string[] = [];
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`);
    m--;
    if (m === 0) {
      m = 12;
      y--;
    }
  }
  return out;
}
const monthOf = (d: Date | null | undefined) => (d ? todayBudapest(d).slice(0, 7) : null);

async function regimeMap(db: DbOrTx, year: number): Promise<Map<string, 'atalany' | 'kata'>> {
  const rows = await db.select({ clientId: clientTaxProfiles.clientId, regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(eq(clientTaxProfiles.year, year));
  return new Map(rows.map((r) => [r.clientId, r.regime as 'atalany' | 'kata']));
}

/** The next period start of a subscription (the day after the paid period, or today when nothing is paid). */
function nextPeriodStart(sub: Pick<typeof subscriptions.$inferSelect, 'currentPeriodEnd'>, today: string): string {
  return sub.currentPeriodEnd ? addDays(sub.currentPeriodEnd, 1) : today;
}

async function amountOf(deps: Deps, db: DbOrTx, clientId: string, periodStart: string): Promise<number> {
  try {
    return (await effectiveMonthlyAmount(deps, db, clientId, periodStart)).amountHuf;
  } catch {
    return deps.cfg.planPriceHuf;
  }
}

export async function consoleOverview(deps: Deps): Promise<ConsoleOverview> {
  const db = deps.db;
  const now = deps.now();
  const today = todayBudapest(now);
  const year = Number(today.slice(0, 4));
  const months = lastMonths(today, 12);
  const allClients = await db.select().from(clients).where(eq(clients.isTest, false));
  const ids = new Set(allClients.map((c) => c.id));
  const reg = await regimeMap(db, year);
  const active = allClients.filter((c) => c.lifecycle === 'aktiv' && !c.anonymizedAt);
  const subs = (await db.select().from(subscriptions)).filter((s) => ids.has(s.clientId));
  const perMonth = months.map((m) => ({
    month: m,
    uj: allClients.filter((c) => monthOf(c.createdAt) === m).length,
    lemondott:
      subs.filter((s) => monthOf(s.canceledAt) === m).length +
      allClients.filter((c) => c.terminated && c.terminated.noticeAt.slice(0, 7) === m && !subs.some((s) => s.clientId === c.id && monthOf(s.canceledAt) === m)).length,
  }));
  // money
  let mrr = 0;
  let overdueSum = 0;
  let overdueCount = 0;
  const up7 = { count: 0, sumHuf: 0 };
  const up30 = { count: 0, sumHuf: 0 };
  for (const s of subs) {
    const amt = s.status === 'active' || s.status === 'past_due' || s.status === 'suspended' ? await amountOf(deps, db, s.clientId, nextPeriodStart(s, today)) : 0;
    if ((s.status === 'active' || s.status === 'past_due') && !s.cancelAtPeriodEnd) mrr += amt;
    if (s.status === 'past_due' || s.status === 'suspended') {
      overdueCount++;
      overdueSum += amt;
    }
    if (s.status === 'active' && !s.cancelAtPeriodEnd && s.nextChargeAt) {
      const d = todayBudapest(s.nextChargeAt);
      if (d >= today && d <= addDays(today, 7)) {
        up7.count++;
        up7.sumHuf += amt;
      }
      if (d >= today && d <= addDays(today, 30)) {
        up30.count++;
        up30.sumHuf += amt;
      }
    }
  }
  const pays = (await db.select().from(payments)).filter((p) => ids.has(p.clientId));
  // the SimplePay era (PAYMENT_PROVIDER=simplepay or the old demo rows) counts too: FINISHED transactions
  const legacy = (await db.select().from(simplepayTransactions).where(eq(simplepayTransactions.status, 'FINISHED'))).filter((t) => ids.has(t.clientId));
  const collectedPerMonth = months.map((m) => {
    const ok = pays.filter((p) => p.status === 'sikeres' && monthOf(p.succeededAt) === m);
    const lg = legacy.filter((t) => monthOf(t.finishedAt) === m);
    const havidijHuf = ok.filter((p) => p.kind !== 'egyszeri').reduce((s, p) => s + p.amountHuf, 0) + lg.filter((t) => t.kind === 'regisztracio' || t.kind === 'ismetlodo').reduce((s, t) => s + t.amountHuf, 0);
    const egyszeriHuf = ok.filter((p) => p.kind === 'egyszeri').reduce((s, p) => s + p.amountHuf, 0) + lg.filter((t) => t.kind === 'egyszeri').reduce((s, t) => s + t.amountHuf, 0);
    const visszaHuf =
      pays.reduce((s, p) => s + (p.refunds ?? []).filter((r) => r.status !== 'failed' && r.at.slice(0, 7) === m).reduce((a, r) => a + r.amountHuf, 0), 0) +
      lg.filter((t) => t.kind === 'visszaterites').reduce((s, t) => s + Math.abs(t.amountHuf), 0);
    return { month: m, havidijHuf, egyszeriHuf, visszaHuf, nettoHuf: havidijHuf + egyszeriHuf - visszaHuf };
  });
  const actionNeeded = pays.filter((p) => p.status === 'hitelesites_kell').length;
  const lockedClients = allClients.filter((c) => c.serviceLock);
  const reasons: Record<string, number> = {};
  for (const c of lockedClients) for (const r of c.serviceLock!.reasons) reasons[r] = (reasons[r] ?? 0) + 1;
  const charges = (await db.select().from(feeCharges)).filter((f) => ids.has(f.clientId));
  const feesByKind: ConsoleOverview['money']['feesByKind'] = [];
  for (const m of months.slice(-6)) {
    const inMonth = charges.filter((f) => monthOf(f.createdAt) === m);
    const kinds = [...new Set(inMonth.map((f) => f.kind))];
    for (const k of kinds) {
      const of = inMonth.filter((f) => f.kind === k);
      const purposeAdmin = of.some((f) => (f.purpose as { type?: string }).type === 'admin');
      feesByKind.push({
        kind: k,
        label: (FEE_KIND_LABELS as Record<string, string>)[k] ?? k + (purposeAdmin ? ' (admin)' : ''),
        month: m,
        paid: of.filter((f) => f.status === 'fizetve').length,
        paidHuf: of.filter((f) => f.status === 'fizetve').reduce((s, f) => s + f.amountHuf, 0),
        open: of.filter((f) => f.status === 'nyitott').length,
        waived: of.filter((f) => f.status === 'elengedve').length,
      });
    }
  }
  // accountants
  const accs = await db.select().from(accountants).where(eq(accountants.active, true)).orderBy(asc(accountants.displayName));
  const accRows: ConsoleOverview['accountants'] = [];
  for (const a of accs) {
    const own = allClients.filter((c) => c.accountantId === a.id && c.lifecycle !== 'megszunt');
    const ownIds = own.map((c) => c.id);
    const items: { kind: string; at: Date }[] = [];
    if (ownIds.length) {
      for (const r of await db.select({ type: requests.type, at: requests.createdAt, dir: requests.direction }).from(requests).where(and(inArray(requests.clientId, ownIds), inArray(requests.status, ['nyitott', 'folyamatban']))))
        items.push({ kind: r.dir === 'ugyfeltol' ? (r.type === 'igazolas' ? 'Igazolás' : 'Ügyfél kérése') : 'Kérés az ügyféltől', at: r.at });
      for (const r of await db.select({ at: assistRequests.statusChangedAt, status: assistRequests.status }).from(assistRequests).where(and(inArray(assistRequests.clientId, ownIds), inArray(assistRequests.status, ['egyeztetve', 'ugyfel_engedelyezte', 'bejelentes_bekuldve']))))
        items.push({ kind: 'Helyettünk-ügy', at: r.at });
      for (const r of await db
        .select({ at: checkinItems.createdAt })
        .from(checkinItems)
        .where(and(inArray(checkinItems.clientId, ownIds), isNull(checkinItems.decidedAt))))
        items.push({ kind: 'Havi ellenőrzés', at: r.at });
      for (const r of await db.select({ at: annualClosings.updatedAt }).from(annualClosings).where(and(inArray(annualClosings.clientId, ownIds), inArray(annualClosings.status, ['konyvelonel']))))
        items.push({ kind: 'Éves zárás', at: r.at });
    }
    const oldest = items.reduce<{ kind: string; at: Date } | null>((m, x) => (!m || x.at < m.at ? x : m), null);
    accRows.push({ id: a.id, name: a.displayName, clients: own.length, openTasks: items.length, oldest: oldest ? { kind: oldest.kind, ageDays: Math.max(0, Math.floor((now.getTime() - oldest.at.getTime()) / 86_400_000)) } : null });
  }
  return {
    generatedAt: now.toISOString(),
    demo: deps.cfg.appEnv === 'demo',
    clients: {
      active: active.length,
      activeAtalany: active.filter((c) => (reg.get(c.id) ?? 'atalany') === 'atalany').length,
      activeKata: active.filter((c) => reg.get(c.id) === 'kata').length,
      onboarding: allClients.filter((c) => c.lifecycle === 'bekotes_alatt').length,
      suspended: allClients.filter((c) => c.lifecycle === 'felfuggesztve').length,
      terminated: allClients.filter((c) => c.lifecycle === 'megszunt' || c.terminated).length,
      perMonth,
    },
    money: {
      mrrHuf: mrr,
      collectedPerMonth,
      overdue: { count: overdueCount, sumHuf: overdueSum },
      actionNeeded,
      locked: { count: lockedClients.length, reasons },
      upcoming7: up7,
      upcoming30: up30,
      feesByKind,
      demoPayments: pays.filter((p) => p.mode === 'demo').length + legacy.filter((t) => t.mode === 'demo').length,
    },
    accountants: accRows,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// client list (§29.9.3)
// ---------------------------------------------------------------------------------------------------------------------
export async function consoleClients(deps: Deps, q: ConsoleClientQuery): Promise<{ items: ConsoleClientRow[]; nextCursor: string | null; total: number }> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const year = Number(today.slice(0, 4));
  const conds = [] as ReturnType<typeof eq>[];
  if (q.status && (CLIENT_LIFECYCLES as readonly string[]).includes(q.status)) conds.push(eq(clients.lifecycle, q.status as (typeof CLIENT_LIFECYCLES)[number]));
  if (q.accountant) conds.push(eq(clients.accountantId, q.accountant));
  if (q.locked) conds.push(isNotNull(clients.serviceLock) as never);
  if (q.terminated) conds.push(isNotNull(clients.terminated) as never);
  const term = q.q?.trim();
  if (term) {
    const like = `%${term.replace(/[%_]/g, '')}%`;
    const digits = term.replace(/\D/g, '');
    const ors = [ilike(clients.lastName, like), ilike(clients.firstName, like), ilike(sql`${clients.lastName} || ' ' || ${clients.firstName}`, like), ilike(users.email, like)];
    if (digits.length >= 3) ors.push(ilike(clients.adoszam, `%${digits}%`));
    conds.push(or(...ors) as never);
  }
  const rows = await db
    .select({ cl: clients, email: users.email, accName: accountants.displayName, sub: subscriptions })
    .from(clients)
    .innerJoin(users, eq(users.id, clients.userId))
    .leftJoin(accountants, eq(accountants.id, clients.accountantId))
    .leftJoin(subscriptions, eq(subscriptions.clientId, clients.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(clients.createdAt));
  const reg = await regimeMap(db, year);
  const open = await db.select({ clientId: feeCharges.clientId, amt: feeCharges.amountHuf }).from(feeCharges).where(eq(feeCharges.status, 'nyitott'));
  const unpaidOf = new Map<string, number>();
  for (const o of open) unpaidOf.set(o.clientId, (unpaidOf.get(o.clientId) ?? 0) + o.amt);
  let items: ConsoleClientRow[] = [];
  for (const r of rows) {
    const subUnpaid = r.sub && (r.sub.status === 'past_due' || r.sub.status === 'suspended') ? await amountOf(deps, db, r.cl.id, nextPeriodStart(r.sub, today)) : 0;
    // phone search (last digits): decrypt only when the term is digits and nothing else matched cheaply
    items.push({
      id: r.cl.id,
      name: clientName(r.cl),
      email: r.email,
      regime: reg.get(r.cl.id) ?? (r.cl.lifecycle === 'bekotes_alatt' ? null : 'atalany'),
      accountantName: r.accName ?? null,
      lifecycle: r.cl.lifecycle,
      subscriptionStatus: r.sub?.status ?? null,
      nextChargeOn: r.sub?.nextChargeAt && !r.sub.cancelAtPeriodEnd ? todayBudapest(r.sub.nextChargeAt) : null,
      unpaidHuf: subUnpaid + (unpaidOf.get(r.cl.id) ?? 0),
      locked: Boolean(r.cl.serviceLock) || r.cl.serviceLockManual?.mode === 'zarolva',
      terminated: Boolean(r.cl.terminated),
      anonymized: Boolean(r.cl.anonymizedAt),
      isTest: r.cl.isTest,
      createdAt: r.cl.createdAt.toISOString(),
    });
  }
  // phone (last digits) – only the encrypted column has it
  if (term && /^\+?[\d\s-]{3,}$/.test(term) && items.length === 0) {
    const digits = term.replace(/\D/g, '').slice(-6);
    const all = await db.select({ id: clients.id, phoneEnc: clients.phoneEnc }).from(clients).where(isNotNull(clients.phoneEnc));
    const hit = new Set(all.filter((x) => {
      try {
        return deps.data.dec(x.phoneEnc!, 'clients.phone').replace(/\D/g, '').endsWith(digits);
      } catch {
        return false;
      }
    }).map((x) => x.id));
    if (hit.size) return consoleClients(deps, { ...q, q: undefined, cursor: q.cursor }).then((r) => ({ ...r, items: r.items.filter((i) => hit.has(i.id)), total: hit.size }));
  }
  if (q.regime) items = items.filter((i) => i.regime === q.regime);
  if (q.unpaid) items = items.filter((i) => i.unpaidHuf > 0);
  if (q.cancelled) items = items.filter((i) => rows.find((r) => r.cl.id === i.id)?.sub?.cancelAtPeriodEnd || i.subscriptionStatus === 'canceled');
  const total = items.length;
  const offset = q.cursor ? Math.max(0, Number(Buffer.from(q.cursor, 'base64url').toString()) || 0) : 0;
  const page = items.slice(offset, offset + 50);
  return { items: page, nextCursor: offset + 50 < total ? Buffer.from(String(offset + 50)).toString('base64url') : null, total };
}

// ---------------------------------------------------------------------------------------------------------------------
// client card (§29.9.3)
// ---------------------------------------------------------------------------------------------------------------------
export async function consoleClientRow(db: DbOrTx, id: string): Promise<ClientRow> {
  const [cl] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  if (!cl) throw E.notFound();
  return cl;
}

export async function consoleClientHeader(deps: Deps, id: string): Promise<ConsoleClientHeader> {
  const db = deps.db;
  const cl = await consoleClientRow(db, id);
  const [u] = await db.select().from(users).where(eq(users.id, cl.userId)).limit(1);
  const [acc] = cl.accountantId ? await db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, id)).limit(1);
  const year = Number(todayBudapest(deps.now()).slice(0, 4));
  const [tp] = await db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, id), eq(clientTaxProfiles.year, year))).limit(1);
  const t = cl.terminated;
  return {
    id: cl.id,
    name: clientName(cl),
    email: u?.email ?? '',
    lifecycle: cl.lifecycle,
    lifecycleLabel: LIFECYCLE_LABELS[cl.lifecycle] ?? cl.lifecycle,
    regime: (tp?.regime as 'atalany' | 'kata' | undefined) ?? null,
    accountant: acc ? { id: acc.id, name: acc.displayName } : null,
    subscriptionStatus: sub?.status ?? null,
    locked: [...new Set([...(cl.serviceLock?.reasons ?? []), ...(cl.serviceLockManual?.mode === 'zarolva' ? ['kezi'] : [])])].map((r) => ({ havidij: 'havidíj', eves_zaras: 'éves zárás', kezi: 'kézi' })[r] ?? r),
    manualLock: cl.serviceLockManual ? { mode: cl.serviceLockManual.mode, until: cl.serviceLockManual.until, reason: cl.serviceLockManual.reason } : null,
    terminated: t ? { kind: t.kind as TerminationKind, effectiveOn: t.effectiveOn, noticeAt: t.noticeAt, reasonShort: TERMINATION_KIND_LABELS[t.kind as TerminationKind] ?? t.kind } : null,
    anonymizedAt: cl.anonymizedAt?.toISOString() ?? null,
    userStatus: u?.status ?? 'active',
    sections: CONSOLE_SECTIONS.map((k) => ({ key: k, label: CONSOLE_SECTION_LABELS[k] })),
    canReactivate: Boolean(t) && !cl.anonymizedAt,
    canAnonymize: await anonymizeBlockers(db, id),
  };
}

function maskTail(v: string | null, keep = 3): string | null {
  if (!v) return null;
  return `${'•'.repeat(Math.max(3, v.length - keep))}${v.slice(-keep)}`;
}

export function profileValue(cl: ClientRow, email: string, k: ConsoleProfileField): string | null {
  switch (k) {
    case 'email':
      return email;
    case 'phone':
      return cl.phoneEnc ? '•••' : null;
    case 'adoazonositoJel':
      return cl.adoazonositoLast3 ? `•••••••${cl.adoazonositoLast3}` : cl.adoazonositoJelEnc ? '••••••••••' : null;
    default:
      return ((cl as Record<string, unknown>)[k] as string | null | undefined) ?? null;
  }
}

/** Decrypts one masked field on demand (audited admin.client.field_revealed). */
export async function revealField(deps: Deps, c: C, id: string, field: string): Promise<string | null> {
  assertConsoleMfa(c);
  const cl = await consoleClientRow(deps.db, id);
  let v: string | null = null;
  if (field === 'phone') v = cl.phoneEnc ? deps.data.dec(cl.phoneEnc, 'clients.phone') : null;
  else if (field === 'adoazonositoJel') v = cl.adoazonositoJelEnc ? deps.data.dec(cl.adoazonositoJelEnc, 'clients.adoazonosito_jel') : null;
  else throw E.validation({ field: 'Ez a mező nem titkosított.' });
  await audit(deps.db, { action: 'admin.client.field_revealed', actorUserId: auth(c).userId, actorRole: 'admin', targetType: 'client', targetId: id, clientId: id, ipHmac: c.get('ipHmac'), requestId: c.get('requestId'), details: { field } });
  return v;
}

export async function consoleSection(deps: Deps, id: string, key: ConsoleSection): Promise<ConsoleSectionView> {
  const db = deps.db;
  const cl = await consoleClientRow(db, id);
  const [u] = await db.select().from(users).where(eq(users.id, cl.userId)).limit(1);
  const title = CONSOLE_SECTION_LABELS[key];
  const navFields = cl.businessIdentity && !cl.businessIdentity.demo ? new Set<string>(CONSOLE_NAV_FIELDS) : cl.businessIdentity ? new Set<string>(CONSOLE_NAV_FIELDS) : new Set<string>();
  switch (key) {
    case 'profil': {
      const fields: ConsoleField[] = CONSOLE_PROFILE_FIELDS.map((k) => ({ key: k, label: CONSOLE_PROFILE_LABELS[k], value: profileValue(cl, u?.email ?? '', k), masked: CONSOLE_MASKED_FIELDS.includes(k) && Boolean(profileValue(cl, '', k)), nav: navFields.has(k), editable: true }));
      const profiles = await db.select().from(clientTaxProfiles).where(eq(clientTaxProfiles.clientId, id)).orderBy(desc(clientTaxProfiles.year));
      return {
        key,
        title,
        fields: [
          ...fields,
          { key: 'lifecycle', label: 'Állapot', value: LIFECYCLE_LABELS[cl.lifecycle] ?? cl.lifecycle },
          { key: 'businessStatus', label: 'Van már vállalkozása?', value: cl.businessStatus ?? null },
          { key: 'businessIdentity', label: 'Vállalkozás (NAV-ból)', value: cl.businessIdentity ? `${cl.businessIdentity.name}${cl.businessIdentity.demo ? ' (DEMO)' : ''}` : null, nav: Boolean(cl.businessIdentity) },
          { key: 'createdAt', label: 'Regisztrált', value: dt(cl.createdAt) },
        ],
        tables: [{ title: 'Adóprofil évenként', columns: ['Év', 'Adózás', 'Költséghányad', 'Státusz', 'Iparűzési adó'], rows: profiles.map((p) => ({ cells: [String(p.year), p.regime === 'kata' ? 'Kata' : 'Átalány', `${p.costRatio}%`, p.status, p.hipaMethod] })) }],
      };
    }
    case 'hozzajarulasok': {
      const rows = u ? await db.select().from(consents).where(eq(consents.userId, u.id)).orderBy(desc(consents.acceptedAt)) : [];
      return { key, title, tables: [{ title: 'Elfogadott dokumentumok', columns: ['Dokumentum', 'Verzió', 'Elfogadva', 'Visszavonva'], rows: rows.map((r) => ({ cells: [r.docType, r.version, dt(r.acceptedAt), dt(r.withdrawnAt)] })) }] };
    }
    case 'elofizetes': {
      const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, id)).limit(1);
      const today = todayBudapest(deps.now());
      let eff: { amountHuf: number; source: string } | null = null;
      try {
        eff = sub ? await effectiveMonthlyAmount(deps, db, id, nextPeriodStart(sub, today)) : null;
      } catch {
        eff = null;
      }
      const ov = await db.select().from(clientPriceOverrides).where(eq(clientPriceOverrides.clientId, id)).orderBy(desc(clientPriceOverrides.createdAt));
      const pauses = await db.select().from(subscriptionPauses).where(eq(subscriptionPauses.clientId, id)).orderBy(desc(subscriptionPauses.from));
      return {
        key,
        title,
        fields: [
          { key: 'status', label: 'Előfizetés', value: sub?.status ?? 'nincs' },
          { key: 'provider', label: 'Fizetés módja', value: sub ? `${sub.provider} (${sub.mode})` : null },
          { key: 'period', label: 'Kifizetett időszak', value: sub?.currentPeriodStart ? `${sub.currentPeriodStart} – ${sub.currentPeriodEnd}` : null },
          { key: 'next', label: 'Következő levonás', value: sub?.nextChargeAt && !sub.cancelAtPeriodEnd ? todayBudapest(sub.nextChargeAt) : sub?.cancelAtPeriodEnd ? `Lemondva – ${sub.currentPeriodEnd}-ig él` : null },
          { key: 'amount', label: 'Következő összeg', value: eff ? `${fmt(eff.amountHuf)} (${eff.source})` : null },
          { key: 'failures', label: 'Sikertelen próbák', value: sub ? `${sub.failedAttempts}${sub.lastFailureCode ? ` – ${sub.lastFailureCode}` : ''}` : null },
          { key: 'grace', label: 'Türelmi idő vége', value: sub?.graceUntil ?? null },
          { key: 'lock', label: 'Zárolás', value: cl.serviceLock ? `${cl.serviceLock.reasons.join(', ')} – ${fmt(cl.serviceLock.amountHuf)}` : cl.serviceLockManual ? `kézi: ${cl.serviceLockManual.mode}${cl.serviceLockManual.until ? ` ${cl.serviceLockManual.until}-ig` : ''}` : 'nincs' },
        ],
        tables: [
          {
            title: 'Egyedi ár, kedvezmény, ingyenes hónap',
            columns: ['Fajta', 'Érték', 'Ettől', 'Eddig', 'Indok', 'Visszavonva'],
            rows: ov.map((o) => ({ id: o.id, cells: [o.kind, o.amountHuf !== null ? fmt(o.amountHuf) : o.percent !== null ? `${o.percent}%` : `${o.months} hónap`, o.fromPeriod, o.untilPeriod, o.reason, dt(o.revokedAt)], actions: o.revokedAt ? [] : ['ar_visszavonas'] })),
          },
          { title: 'Szüneteltetés', columns: ['Ettől', 'Eddig', 'Forrás'], rows: pauses.map((p) => ({ cells: [p.from, p.to ?? 'nyitott', p.source] })) },
        ],
      };
    }
    case 'fizetesek': {
      const rows = await db.select().from(payments).where(eq(payments.clientId, id)).orderBy(desc(payments.createdAt));
      const regi = await db.select().from(simplepayTransactions).where(eq(simplepayTransactions.clientId, id)).orderBy(desc(simplepayTransactions.createdAt));
      return {
        key,
        title,
        tables: [
          ...(regi.length
            ? [{ title: 'Korábbi fizetések (SimplePay / DEMO)', columns: ['Idő', 'Fajta', 'Összeg', 'Állapot', 'Időszak', 'Mód'], rows: regi.map((t) => ({ cells: [dt(t.finishedAt ?? t.createdAt), t.kind, fmt(t.amountHuf), t.status, t.periodStart ? `${t.periodStart} – ${t.periodEnd ?? ''}` : null, t.mode] })) }]
            : []),
          {
            title: 'Fizetések',
            columns: ['Idő', 'Fajta', 'Összeg', 'Állapot', 'Kártya', 'Visszautalva', 'Szolgáltató'],
            rows: rows.map((p) => ({
              id: p.id,
              cells: [dt(p.createdAt), p.kind, fmt(p.amountHuf), p.status, p.cardLast4 ? `${p.cardBrand ?? ''} •••• ${p.cardLast4}` : null, p.refundedHuf ? fmt(p.refundedHuf) : null, `${p.provider}/${p.mode}`],
              chip: p.disputeStatus ? 'Vitatott terhelés' : null,
              actions: p.status === 'sikeres' && p.amountHuf - p.refundedHuf > 0 ? ['visszaterites'] : [],
            })),
          },
        ],
      };
    }
    case 'dijszamlak': {
      const rows = await db.select().from(feeInvoices).where(eq(feeInvoices.clientId, id)).orderBy(desc(feeInvoices.createdAt));
      return {
        key,
        title,
        tables: [
          {
            title: 'Díjszámlák',
            columns: ['Szám', 'Kelt', 'Összeg', 'Fajta', 'Állapot', 'Fiók', 'PDF'],
            rows: rows.map((f) => ({ id: f.id, cells: [f.number, f.issuedOn, fmt(f.amountHuf), f.kind, f.status, f.providerAccount ?? f.provider, f.pdfFileId ? `/files/${f.pdfFileId}` : null], actions: f.status === 'hiba' ? ['szamla_ujra'] : [] })),
          },
        ],
      };
    }
    case 'kartya': {
      const rows = await db.select().from(paymentMethods).where(eq(paymentMethods.clientId, id)).orderBy(desc(paymentMethods.createdAt));
      return { key, title, tables: [{ title: 'Kártyák', columns: ['Kártya', 'Lejárat', 'Állapot', 'Mentve', 'Szolgáltató'], rows: rows.map((m) => ({ cells: [`${m.brand ?? ''} •••• ${m.last4 ?? ''}`, m.expMonth ? `${String(m.expMonth).padStart(2, '0')}/${String(m.expYear ?? '').slice(-2)}` : null, m.status, dt(m.createdAt), `${m.provider}/${m.mode}`] })) }], note: 'Csak a márka, az utolsó 4 számjegy és a lejárat – a kártyaszámot soha nem látjuk.' };
    }
    case 'dijak': {
      const rows = await db.select().from(feeCharges).where(eq(feeCharges.clientId, id)).orderBy(desc(feeCharges.createdAt));
      return {
        key,
        title,
        tables: [
          {
            title: 'Díjak',
            columns: ['Létrehozva', 'Fajta', 'Összeg', 'Állapot', 'Cél', 'Fizetve'],
            rows: rows.map((f) => {
              const p = f.purpose as { type: string };
              const acts: string[] = [];
              if (f.status === 'nyitott') acts.push('elengedes');
              if (f.status === 'nyitott' && p.type !== 'admin') acts.push('levonas_most');
              return { id: f.id, cells: [dt(f.createdAt), (FEE_KIND_LABELS as Record<string, string>)[f.kind] ?? f.kind, fmt(f.amountHuf), f.status, p.type, dt(f.paidAt)], actions: acts };
            }),
          },
        ],
      };
    }
    case 'keresek': {
      const rows = await db.select().from(requests).where(eq(requests.clientId, id)).orderBy(desc(requests.createdAt)).limit(200);
      return { key, title, tables: [{ title: 'Kérések', columns: ['Idő', 'Irány', 'Fajta', 'Cím', 'Állapot'], rows: rows.map((r) => ({ cells: [dt(r.createdAt), r.direction === 'ugyfeltol' ? 'Ügyféltől' : 'Könyvelőtől', r.type, r.title, r.status] })) }] };
    }
    case 'uzenetek': {
      const rows = await db.select().from(messages).where(eq(messages.clientId, id)).orderBy(desc(messages.createdAt)).limit(100);
      return { key, title, tables: [{ title: 'Utolsó 100 üzenet', columns: ['Idő', 'Feladó', 'Szöveg'], rows: rows.map((m) => ({ cells: [dt(m.createdAt), m.senderRole, m.body.length > 160 ? `${m.body.slice(0, 160)}…` : m.body] })) }] };
    }
    case 'dokumentumok': {
      const rows = await db.select().from(documents).where(eq(documents.clientId, id)).orderBy(desc(documents.createdAt)).limit(300);
      return { key, title, tables: [{ title: 'Iratok', columns: ['Feltöltve', 'Hónap', 'Fajta', 'Cím', 'Állapot', 'Forrás'], rows: rows.map((d) => ({ id: d.id, cells: [dt(d.createdAt), d.dossierMonth, d.category, d.title, d.status, d.source], actions: ['megnyitas'] })) }], note: 'Egy irat megnyitása naplózva.' };
    }
    case 'igazolasok': {
      const rows = await db.select({ r: requests, c: certificateRequests }).from(certificateRequests).innerJoin(requests, eq(requests.id, certificateRequests.requestId)).where(eq(requests.clientId, id)).orderBy(desc(requests.createdAt));
      return {
        key,
        title,
        tables: [{ title: 'Igazolás-kérések', columns: ['Kérve', 'Igazolás', 'Mire', 'Állapot'], rows: rows.map((x) => ({ id: x.r.id, cells: [dt(x.r.createdAt), CERT_TYPE_TEXTS[certTypeOf(x.c)].label, x.c.purpose, CERT_STATUS_LABELS[certStatusOf(x.c, x.r)]] })) }],
      };
    }
    case 'nav': {
      const [cred] = await db.select().from(navCredentials).where(eq(navCredentials.clientId, id)).limit(1);
      const runs = await db.select().from(navSyncRuns).where(eq(navSyncRuns.clientId, id)).orderBy(desc(navSyncRuns.startedAt)).limit(20);
      return {
        key,
        title,
        fields: [
          { key: 'cred', label: 'Technikai felhasználó', value: cred ? `${cred.status} (${cred.environment})` : 'nincs megadva' },
          { key: 'lastSync', label: 'Utolsó lekérés', value: cred?.lastSyncAt ? `${dt(cred.lastSyncAt)} – ${cred.lastSyncStatus ?? ''}` : null },
          { key: 'lastError', label: 'Utolsó hiba', value: cred?.lastSyncError ?? cred?.lastTestError ?? null },
        ],
        tables: [{ title: 'Lekérések', columns: ['Indult', 'Állapot', 'Új számla', 'Hiba'], rows: runs.map((r) => ({ cells: [dt(r.startedAt), r.status, String(r.invoicesNew), r.errorCode] })) }],
      };
    }
    case 'ertesitesek': {
      const rows = u ? await db.select().from(notifications).where(eq(notifications.userId, u.id)).orderBy(desc(notifications.createdAt)).limit(100) : [];
      return { key, title, tables: [{ title: 'Utolsó 100 értesítés', columns: ['Idő', 'Fajta', 'Cím', 'Push', 'E-mail', 'Olvasva'], rows: rows.map((n) => ({ cells: [dt(n.createdAt), n.kind, n.title, n.wantPush ? (dt(n.pushSentAt) ?? 'vár') : '–', n.wantEmail ? (dt(n.emailSentAt) ?? 'vár') : '–', dt(n.readAt)] })) }] };
    }
    case 'belepesek': {
      const rows = u ? await db.select().from(sessions).where(eq(sessions.userId, u.id)).orderBy(desc(sessions.createdAt)).limit(50) : [];
      return {
        key,
        title,
        fields: [
          { key: 'lastLogin', label: 'Utolsó belépés', value: dt(u?.lastLoginAt) },
          { key: 'verified', label: 'E-mail megerősítve', value: u?.emailVerifiedAt ? dt(u.emailVerifiedAt) : 'nem' },
          { key: 'totp', label: 'Kétlépcsős belépés', value: u?.totpEnabledAt ? 'be' : 'ki' },
        ],
        tables: [{ title: 'Munkamenetek', columns: ['Létrehozva', 'Fajta', 'Utoljára', 'Visszavonva', 'Böngésző'], rows: rows.map((s) => ({ cells: [dt(s.createdAt), s.clientKind, dt(s.lastUsedAt), dt(s.revokedAt), (s.userAgent ?? '').slice(0, 40)] })) }],
      };
    }
    case 'naplo': {
      const rows = await db.select().from(auditLog).where(eq(auditLog.clientId, id)).orderBy(desc(auditLog.at)).limit(300);
      return {
        key,
        title,
        tables: [
          {
            title: 'Napló (legutóbbi 300)',
            columns: ['Idő', 'Művelet', 'Ki', 'Részletek'],
            rows: rows.map((a) => ({ cells: [dt(a.at), a.action, a.actorRole, a.details ? JSON.stringify(a.details).slice(0, 220) : null], chip: a.action.startsWith('admin.') ? 'Admin' : null })),
          },
        ],
      };
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// "Ügyfél szemével" (§29.9.3) – simplified client screens, nothing clickable, no client token minted
// ---------------------------------------------------------------------------------------------------------------------
export async function consolePreview(deps: Deps, c: C, id: string): Promise<ConsolePreview> {
  const db = deps.db;
  const cl = await consoleClientRow(db, id);
  const lines = (arr: [string, string | null | undefined, ('ok' | 'warn' | 'bad' | null)?][]) => arr.filter(([, v]) => v !== null && v !== undefined && v !== '').map(([label, value, tone]) => ({ label, value: String(value), tone: tone ?? null }));
  const st = await onboardingState(deps, db, id, 'client').catch(() => null);
  const sub = await subscriptionView(deps, db, id).catch(() => null);
  const fees = await feesView(deps, db, cl).catch(() => null);
  const lock = await serviceLockView(deps, cl).catch(() => null);
  const openReq = await db.select({ id: requests.id }).from(requests).where(and(eq(requests.clientId, id), eq(requests.direction, 'konyvelotol'), inArray(requests.status, ['nyitott', 'folyamatban'])));
  const journey = (st as { journey?: { steps?: { title?: string; label?: string; status?: string; done?: boolean }[] } } | null)?.journey;
  const sv = sub as (Record<string, unknown> & { status?: string }) | null;
  const screens: ConsolePreview['screens'] = [
    {
      key: 'fooldal',
      title: 'Főoldal',
      lines: lines([
        ['Állapot', LIFECYCLE_LABELS[cl.lifecycle] ?? cl.lifecycle, cl.lifecycle === 'aktiv' ? 'ok' : 'warn'],
        ['Zárolás', lock ? lock.text : null, 'bad'],
        ['Rá váró kérések', String(openReq.length), openReq.length ? 'warn' : 'ok'],
        ['Felmondás', cl.terminated ? `${TERMINATION_KIND_LABELS[cl.terminated.kind as TerminationKind] ?? cl.terminated.kind} – ${cl.terminated.effectiveOn}` : null, 'bad'],
      ]),
    },
    {
      key: 'bekotes',
      title: 'Bekötés',
      lines: journey?.steps?.length
        ? journey.steps.map((s) => ({ label: String(s.title ?? s.label ?? ''), value: s.done || s.status === 'kesz' ? 'Kész' : String(s.status ?? ''), tone: (s.done || s.status === 'kesz' ? 'ok' : 'warn') as 'ok' | 'warn' }))
        : lines([['Bekötés', cl.lifecycle === 'bekotes_alatt' ? 'folyamatban' : 'kész', cl.lifecycle === 'bekotes_alatt' ? 'warn' : 'ok']]),
    },
    {
      key: 'elofizetes',
      title: 'Előfizetés',
      lines: lines([
        ['Állapot', sv?.status ?? 'nincs', sv?.status === 'active' ? 'ok' : 'warn'],
        ['Havidíj', typeof sv?.monthlyHuf === 'number' ? fmt(sv.monthlyHuf as number) : typeof sv?.amountHuf === 'number' ? fmt(sv.amountHuf as number) : null],
        ['Következő levonás', (sv?.nextChargeOn as string | undefined) ?? (sv?.nextChargeAt as string | undefined)?.slice(0, 10) ?? null],
        ['Kártya', ((sv?.cardInfo as { label?: string } | null)?.label as string | undefined) ?? (sv?.cardMask as string | undefined) ?? null],
      ]),
    },
    {
      key: 'dijak',
      title: 'Díjak',
      lines: fees
        ? [...fees.open.map((f) => ({ label: `${f.label} – fizetésre vár`, value: fmt(f.amountHuf), tone: 'warn' as const })), ...fees.paid.slice(0, 5).map((f) => ({ label: `${f.label} – kifizetve`, value: fmt(f.amountHuf), tone: 'ok' as const }))]
        : [],
    },
  ];
  await audit(db, { action: 'admin.client.preview', actorUserId: auth(c).userId, actorRole: 'admin', targetType: 'client', targetId: id, clientId: id, ipHmac: c.get('ipHmac'), requestId: c.get('requestId') });
  return { clientName: clientName(cl), screens };
}

export { FEE_CHARGE_STATUSES, gte, lte };
