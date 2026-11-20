// SPEC §29.9.4–§29.9.5 F9 – owner console actions (write side). Every action: admin + TOTP + step-up (checked by the
// route), a reason where §29.9.1 requires it, and an audit row 'admin.<area>.<verb>' with before/after (secrets masked).
// Money actions go ONLY through the payment contract of §29.1.15 (services/payments.ts).
import { and, desc, eq, gte, inArray, isNull, ne, sql } from 'drizzle-orm';
import brand from '../_shared/brand.json' with { type: 'json' };
import { CLIENT_LIFECYCLES, FEE_KINDS, type FeeKind } from '../_shared/enums.js';
import { fillPlaceholders, FEE_KIND_LABELS, huLongDate } from '../_shared/bekotes.js';
import {
  CONSOLE_MASKED_FIELDS,
  CONSOLE_NAV_FIELDS,
  CONSOLE_PROFILE_FIELDS,
  CONSOLE_PROFILE_LABELS,
  CONSOLE_RULES,
  TERMINATION_LETTER,
  TERMINATION_RULES,
  TERMINATION_SUB_REASON_CLIENT,
  TERMINATION_TEXTS,
  type ConsoleAnnouncementInput,
  type ConsoleLockInput,
  type ConsolePriceInput,
  type ConsoleProfileField,
  type ConsoleTerminateInput,
  type TerminationKind,
} from '../_shared/k29f.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, announcements, assistRequests, clientPriceOverrides, clients, feeCharges, gdprExports, messages, payments, subscriptions, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { auth, type C } from '../http/core.js';
import { issueCode } from '../auth/codes.js';
import { addDays, addMonths, isIsoDate, todayBudapest } from '../lib/dates.js';
import { hmacHex } from '../lib/crypto.js';
import { ApiError, E } from '../lib/errors.js';
import { markdownToPdf } from '../lib/pdf.js';
import { isValidAdoazonositoJel, isValidAdoszam, normalizeEmail, isPlausibleEmail } from '../lib/validators.js';
import { isValidHuZip, normalizeHuPhone } from '../_shared/bekotes.js';
import { accountantParams, notify, sendCodeEmail } from '../notify/notify.js';
import { endRelationship } from './kyc.js';
import { clientName, type ClientRow } from './people.js';
import { consoleClientRow } from './konzol.js';
import { anonymizeClient } from './anonimizalas.js';
import { revokeFeed } from './naptar.js';
import { createDocumentFromBuffer } from './system-docs.js';
import { closePause, openPause } from './szuneteltetes.js';
import { computeServiceLock } from './zarolas.js';
import { setStep } from './onboarding.js';
import { waiveCharge } from './dijak.js';
import { cancelSubscriptionK29, chargeFeeOffSessionByAdmin, createFeeChargeK29, effectiveMonthlyAmount, refundPayment, retryInvoice } from './payments.js';

const fmtN = (n: number) => new Intl.NumberFormat('hu-HU').format(n).replace(/ /g, ' ');
const fmt = (n: number) => `${fmtN(n)} Ft`;

/** Audit with actor + request data; `before/after` masked (adóazonosító jel, phone, bank account → last 3 characters). */
export async function auditAdmin(c: C, db: DbOrTx, action: string, clientId: string | null, details: Record<string, unknown>): Promise<void> {
  const a = auth(c);
  await audit(db, { action, actorUserId: a.userId, actorRole: 'admin', targetType: clientId ? 'client' : 'console', targetId: clientId, clientId, ipHmac: c.get('ipHmac'), userAgent: c.get('ua'), requestId: c.get('requestId'), details: { ...details, requestId: c.get('requestId') } });
}

export function maskValue(field: string, v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  if (CONSOLE_MASKED_FIELDS.includes(field as ConsoleProfileField) || /bank|szamla|account/i.test(field)) return v.length > 3 ? `•••${v.slice(-3)}` : '•••';
  return v;
}

export function needReason(reason: string | undefined | null): string {
  const r = (reason ?? '').trim();
  if (r.length < CONSOLE_RULES.reasonMin) throw new ApiError(422, 'reason_required', 'Írd le az indokot (legalább 5 karakter).', { reason: 'Legalább 5 karakter.' });
  return r.slice(0, 1000);
}

// ---------------------------------------------------------------------------------------------------------------------
// profile
// ---------------------------------------------------------------------------------------------------------------------
export async function patchProfile(deps: Deps, c: C, id: string, b: { fields: Record<string, string | null>; confirmNavOverride?: boolean; reason?: string }): Promise<{ changed: string[] }> {
  const cl = await consoleClientRow(deps.db, id);
  if (cl.anonymizedAt) throw E.conflict('Anonimizált ügyfél adatai nem módosíthatók.');
  const [u] = await deps.db.select().from(users).where(eq(users.id, cl.userId)).limit(1);
  const errs: Record<string, string> = {};
  const set: Record<string, unknown> = {};
  const before: Record<string, string | null> = {};
  const after: Record<string, string | null> = {};
  let newEmail: string | null = null;
  const navTouched: string[] = [];
  for (const [k, raw] of Object.entries(b.fields ?? {})) {
    if (!(CONSOLE_PROFILE_FIELDS as readonly string[]).includes(k)) {
      errs[k] = 'Ismeretlen mező.';
      continue;
    }
    const f = k as ConsoleProfileField;
    const v = raw === null ? null : String(raw).trim();
    if (cl.businessIdentity && CONSOLE_NAV_FIELDS.includes(f)) navTouched.push(f);
    switch (f) {
      case 'lastName':
      case 'firstName':
        if (!v || v.length > 60) errs[f] = 'Kötelező, legfeljebb 60 karakter.';
        else set[f] = v;
        break;
      case 'birthName':
      case 'addressLine':
      case 'hqMunicipality':
      case 'addressCity':
      case 'activityText':
        if (v && v.length > 200) errs[f] = 'Legfeljebb 200 karakter.';
        else set[f] = v || null;
        break;
      case 'addressZip':
        if (v && !isValidHuZip(v)) errs[f] = 'Négyjegyű irányítószám kell.';
        else set[f] = v || null;
        break;
      case 'evSince':
        if (v && !isIsoDate(v)) errs[f] = 'ÉÉÉÉ-HH-NN alakban.';
        else set[f] = v || null;
        break;
      case 'evNyilvantartasiSzam':
        if (v && !/^\d{5,10}$/.test(v.replace(/\s/g, ''))) errs[f] = 'Csak számjegyek (5–10).';
        else set[f] = v ? v.replace(/\s/g, '') : null;
        break;
      case 'adoszam':
        if (v && !isValidAdoszam(v)) errs[f] = 'Hibás adószám (ellenőrző szám).';
        else set[f] = v || null;
        break;
      case 'adoazonositoJel':
        if (!v) {
          Object.assign(set, { adoazonositoJelEnc: null, adoazonositoHmac: null, adoazonositoLast3: null });
        } else if (!isValidAdoazonositoJel(v)) errs[f] = 'Hibás adóazonosító jel (ellenőrző szám).';
        else Object.assign(set, { adoazonositoJelEnc: deps.data.enc(v, 'clients.adoazonosito_jel'), adoazonositoHmac: hmacHex(deps.lookupKey, v), adoazonositoLast3: v.slice(-3) });
        break;
      case 'phone': {
        if (!v) set.phoneEnc = null;
        else {
          const n = normalizeHuPhone(v);
          if (!n) errs[f] = 'Hibás telefonszám.';
          else set.phoneEnc = deps.data.enc(n, 'clients.phone');
        }
        break;
      }
      case 'email': {
        const e = v ? normalizeEmail(v) : '';
        if (!e || !isPlausibleEmail(e)) errs[f] = 'Hibás e-mail-cím.';
        else if (e !== u?.email) {
          const [dup] = await deps.db.select({ id: users.id }).from(users).where(eq(users.email, e)).limit(1);
          if (dup) errs[f] = 'Ez a cím már egy másik fiókhoz tartozik.';
          else newEmail = e;
        }
        break;
      }
    }
    before[f] = maskValue(f, f === 'email' ? (u?.email ?? null) : f === 'phone' ? (cl.phoneEnc ? '***' : null) : f === 'adoazonositoJel' ? (cl.adoazonositoLast3 ?? null) : (((cl as Record<string, unknown>)[f] as string | null) ?? null));
    after[f] = maskValue(f, v);
  }
  if (Object.keys(errs).length) throw E.validation(errs);
  if (navTouched.length && !b.confirmNavOverride) throw new ApiError(409, 'nav_override_needed', 'Ezt a NAV-adatbázisból töltöttük ki. Ha átírod, nézd meg az ONYA-ban is.', undefined, { fields: navTouched });
  const reason = navTouched.length ? needReason(b.reason) : (b.reason?.trim() || null);
  const changed = Object.keys(after);
  if (!changed.length) return { changed: [] };
  await deps.db.transaction(async (tx) => {
    if (Object.keys(set).length) await tx.update(clients).set({ ...set, updatedAt: deps.now() }).where(eq(clients.id, id));
    if (newEmail && u) {
      await tx.update(users).set({ email: newEmail, emailVerifiedAt: null, updatedAt: deps.now() }).where(eq(users.id, u.id));
    }
    await auditAdmin(c, tx, 'admin.client.profile_changed', id, { reason, before, after, navOverride: navTouched.length > 0 });
  });
  if (newEmail && u) {
    // the client confirms the new address himself (code mail); the old address gets a notice
    const code = await issueCode(deps, deps.db, { email: newEmail, purpose: 'verify_email', userId: u.id });
    await sendCodeEmail(deps, newEmail, 'auth_email_code', code).catch(() => undefined);
    try {
      await deps.mailer.send({ to: u.email, subject: `${brand.name}: megváltozott az e-mail-címed`, text: `Az ${brand.name} fiókod e-mail-címét az ügyfélszolgálat módosította. Ha nem kérted, írj nekünk az appban.`, template: 'profile_email_changed' });
    } catch {
      /* the change stays; the notice is best effort */
    }
  }
  const labels = changed.map((k) => CONSOLE_PROFILE_LABELS[k as ConsoleProfileField] ?? k).join(', ');
  await notify(deps, deps.db, { userId: cl.userId, kind: 'profile_changed_by_admin' as never, params: { mezok: labels }, link: '/fiok/adataim', noPush: true });
  deps.sessionCache.clear();
  return { changed };
}

// ---------------------------------------------------------------------------------------------------------------------
// price / discount / free months (client_price_overrides)
// ---------------------------------------------------------------------------------------------------------------------
export async function addPriceOverride(deps: Deps, c: C, id: string, b: ConsolePriceInput): Promise<{ id: string }> {
  const cl = await consoleClientRow(deps.db, id);
  const reason = needReason(b.reason);
  const today = todayBudapest(deps.now());
  if (!isIsoDate(b.fromPeriod)) throw E.validation({ fromPeriod: 'ÉÉÉÉ-HH-NN alakban.' });
  if (b.untilPeriod && (!isIsoDate(b.untilPeriod) || b.untilPeriod < b.fromPeriod)) throw E.validation({ untilPeriod: 'A vége nem lehet a kezdete előtt.' });
  let amountHuf: number | null = null;
  let percent: number | null = null;
  let months: number | null = null;
  if (b.kind === 'egyedi_ar') {
    if (!Number.isInteger(b.amountHuf) || b.amountHuf! < 0 || (b.amountHuf! > 0 && b.amountHuf! < 200) || b.amountHuf! > 200_000) throw E.validation({ amountHuf: '0 Ft vagy legalább 200 Ft, egész forint.' });
    amountHuf = b.amountHuf!;
    // a rise applies only to periods starting ≥ today + 30 (ÁSZF 6.7)
    let current = deps.cfg.planPriceHuf;
    try {
      current = (await effectiveMonthlyAmount(deps, deps.db, id, b.fromPeriod)).amountHuf;
    } catch {
      /* the plan price */
    }
    if (amountHuf > current && b.fromPeriod < addDays(today, CONSOLE_RULES.priceRiseNoticeDays)) throw E.validation({ fromPeriod: `Áremelés legkorábban ${addDays(today, CONSOLE_RULES.priceRiseNoticeDays)}-tól (30 nappal előre szólunk).` });
  } else if (b.kind === 'kedvezmeny_szazalek') {
    if (!Number.isInteger(b.percent) || b.percent! < 1 || b.percent! > 100) throw E.validation({ percent: '1 és 100 közötti egész szám.' });
    percent = b.percent!;
  } else if (b.kind === 'ingyenes_honap') {
    if (!Number.isInteger(b.months) || b.months! < 1 || b.months! > 24) throw E.validation({ months: '1–24 hónap.' });
    months = b.months!;
  } else throw E.validation({ kind: 'Ismeretlen fajta.' });
  const [row] = await deps.db.transaction(async (tx) => {
    const r = await tx.insert(clientPriceOverrides).values({ clientId: id, kind: b.kind, amountHuf, percent, months, fromPeriod: b.fromPeriod, untilPeriod: b.untilPeriod ?? (months ? addMonths(b.fromPeriod, months) : null), reason, createdBy: auth(c).userId, createdAt: deps.now() }).returning();
    await auditAdmin(c, tx, 'admin.price.override_added', id, { reason, after: { kind: b.kind, amountHuf, percent, months, from: b.fromPeriod, until: b.untilPeriod ?? null } });
    return r;
  });
  if (b.kind === 'egyedi_ar' && amountHuf !== null && amountHuf > deps.cfg.planPriceHuf)
    await notify(deps, deps.db, { userId: cl.userId, kind: 'price_changed' as never, params: { datum: huLongDate(b.fromPeriod), osszeg: fmtN(amountHuf) }, link: '/fiok/elofizetes', noPush: true });
  else {
    const szoveg = b.kind === 'ingyenes_honap' ? `${months} hónapig nem vonunk le havidíjat (${huLongDate(b.fromPeriod)}-tól).` : b.kind === 'kedvezmeny_szazalek' ? `${percent}% kedvezmény a havidíjból ${huLongDate(b.fromPeriod)}-tól.` : `Havidíjad ${huLongDate(b.fromPeriod)}-tól ${fmt(amountHuf ?? 0)}.`;
    await notify(deps, deps.db, { userId: cl.userId, kind: 'price_changed' as never, variant: 'lower', params: { szoveg }, link: '/fiok/elofizetes', noPush: true });
  }
  return { id: row!.id };
}

export async function revokePriceOverride(deps: Deps, c: C, id: string, overrideId: string, reasonIn: string): Promise<void> {
  const reason = needReason(reasonIn);
  const r = await deps.db
    .update(clientPriceOverrides)
    .set({ revokedAt: deps.now(), revokedBy: auth(c).userId, revokeReason: reason })
    .where(and(eq(clientPriceOverrides.id, overrideId), eq(clientPriceOverrides.clientId, id), isNull(clientPriceOverrides.revokedAt)))
    .returning();
  if (!r.length) throw E.notFound();
  await auditAdmin(c, deps.db, 'admin.price.override_revoked', id, { reason, before: { kind: r[0]!.kind, amountHuf: r[0]!.amountHuf, percent: r[0]!.percent, months: r[0]!.months } });
}

// ---------------------------------------------------------------------------------------------------------------------
// fees
// ---------------------------------------------------------------------------------------------------------------------
export async function addAdminFee(deps: Deps, c: C, id: string, b: { kind: string; amountHuf?: number; note: string; reason: string }): Promise<{ chargeId: string | null }> {
  const cl = await consoleClientRow(deps.db, id);
  const reason = needReason(b.reason);
  if (!(FEE_KINDS as readonly string[]).includes(b.kind)) throw E.validation({ kind: 'Ismeretlen díjfajta.' });
  const note = (b.note ?? '').trim();
  if (note.length < 3 || note.length > 200) throw E.validation({ note: 'Írd le röviden, miért (3–200 karakter).' });
  if (b.amountHuf !== undefined && (!Number.isInteger(b.amountHuf) || (b.amountHuf > 0 && b.amountHuf < 200) || b.amountHuf < 0 || b.amountHuf > 500_000)) throw E.validation({ amountHuf: '0 Ft vagy legalább 200 Ft, egész forint.' });
  const row = await deps.db.transaction(async (tx) => {
    const ch = await createFeeChargeK29(deps, tx, { clientId: id, kind: b.kind as FeeKind, ...(b.amountHuf !== undefined ? { amountHuf: b.amountHuf } : {}), purpose: { type: 'admin', note } as never, by: auth(c).userId });
    await auditAdmin(c, tx, 'admin.fee.added', id, { reason, after: { kind: b.kind, amountHuf: ch?.amountHuf ?? 0, note } });
    return ch;
  });
  if (row) await notify(deps, deps.db, { userId: cl.userId, kind: 'fee_due', params: { ...(await accountantParams(deps.db, cl.accountantId)), dij: fmtN(row.amountHuf), label: (FEE_KIND_LABELS as Record<string, string>)[b.kind] ?? b.kind }, link: '/fiok/dijak', noPush: true });
  return { chargeId: row?.id ?? null };
}

export async function waiveFee(deps: Deps, c: C, id: string, chargeId: string, reasonIn: string): Promise<void> {
  const reason = needReason(reasonIn);
  const [ch] = await deps.db.select().from(feeCharges).where(and(eq(feeCharges.id, chargeId), eq(feeCharges.clientId, id))).limit(1);
  if (!ch) throw E.notFound();
  await waiveCharge(deps, deps.db, chargeId, reason, auth(c).userId);
  await auditAdmin(c, deps.db, 'admin.fee.waived', id, { reason, before: { status: ch.status, amountHuf: ch.amountHuf } });
}

/** "Levonom a mentett kártyáról": only charges the client ordered himself (not purpose admin), only with an active card. */
export async function chargeFeeNow(deps: Deps, c: C, id: string, chargeId: string, reasonIn: string): Promise<{ outcome: string; message: string }> {
  const reason = needReason(reasonIn);
  const [ch] = await deps.db.select().from(feeCharges).where(and(eq(feeCharges.id, chargeId), eq(feeCharges.clientId, id))).limit(1);
  if (!ch) throw E.notFound();
  if ((ch.purpose as { type?: string }).type === 'admin') throw E.conflict('Az admin által felvett díjat csak az ügyfél fizetheti ki az appban.');
  if (ch.status !== 'nyitott') throw E.conflict('Ez a díj már nem nyitott.');
  const out = await chargeFeeOffSessionByAdmin(deps, { chargeId, byUserId: auth(c).userId, reason });
  await auditAdmin(c, deps.db, 'admin.fee.charged_now', id, { reason, amountHuf: ch.amountHuf, outcome: (out as { kind: string }).kind });
  const k = (out as { kind: string }).kind;
  const message = k === 'succeeded' ? 'Levontuk.' : k === 'processing' ? 'Feldolgozás alatt – a Fizetéseknél látod az eredményt.' : k === 'requires_auth' ? 'A bank megerősítést kér – az ügyfélnek kell kifizetnie az appban.' : k === 'declined' ? 'A bank elutasította.' : 'Bizonytalan – az egyeztető feladat újrapróbálja.';
  return { outcome: k, message };
}

export async function refundConsole(deps: Deps, c: C, paymentId: string, b: { amountHuf: number; reason: string }): Promise<{ refundedHuf: number; invoiceAction: string }> {
  const reason = needReason(b.reason);
  const [p] = await deps.db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!p) throw E.notFound();
  if (!Number.isInteger(b.amountHuf) || b.amountHuf <= 0 || b.amountHuf > p.amountHuf - p.refundedHuf) throw E.validation({ amountHuf: `Legfeljebb ${fmt(p.amountHuf - p.refundedHuf)}.` });
  const r = await refundPayment(deps, { paymentId, amountHuf: b.amountHuf, reason, byUserId: auth(c).userId });
  await auditAdmin(c, deps.db, 'admin.payment_refunded', p.clientId, { reason, amountHuf: b.amountHuf, paymentId, invoiceAction: r.invoiceAction });
  return r;
}

export async function retryInvoiceConsole(deps: Deps, c: C, invoiceId: string): Promise<void> {
  await retryInvoice(deps, invoiceId, auth(c).userId);
  await auditAdmin(c, deps.db, 'admin.invoice.retried', null, { invoiceId });
}

// ---------------------------------------------------------------------------------------------------------------------
// lock / pause / accountant / codes / message / announcement / export
// ---------------------------------------------------------------------------------------------------------------------
export async function setManualLock(deps: Deps, c: C, id: string, b: ConsoleLockInput | null, reasonIn?: string): Promise<{ lock: unknown }> {
  const cl = await consoleClientRow(deps.db, id);
  const reason = needReason(b?.reason ?? reasonIn);
  const today = todayBudapest(deps.now());
  let next: ClientRow['serviceLockManual'] = null;
  if (b) {
    if (b.mode !== 'zarolva' && b.mode !== 'feloldva') throw E.validation({ mode: 'zarolva vagy feloldva.' });
    let until: string | null = b.until ?? null;
    if (b.mode === 'feloldva') {
      if (!until || !isIsoDate(until) || until < today || until > addDays(today, CONSOLE_RULES.lockFeloldvaMaxDays)) throw E.validation({ until: `Ma és ${addDays(today, CONSOLE_RULES.lockFeloldvaMaxDays)} között.` });
    } else if (until && (!isIsoDate(until) || until < today)) throw E.validation({ until: 'Nem lehet a múltban.' });
    else until = until ?? null;
    next = { mode: b.mode, until, reason, by: auth(c).userId, at: deps.now().toISOString() };
  }
  await deps.db.update(clients).set({ serviceLockManual: next, updatedAt: deps.now() }).where(eq(clients.id, id));
  await auditAdmin(c, deps.db, next ? `admin.lock.${next.mode}` : 'admin.lock.removed', id, { reason, before: cl.serviceLockManual ? { mode: cl.serviceLockManual.mode, until: cl.serviceLockManual.until } : null, after: next ? { mode: next.mode, until: next.until } : null });
  const lock = await computeServiceLock(deps, id);
  return { lock };
}

export async function consolePause(deps: Deps, c: C, id: string, b: { from: string; to?: string | null; reason: string }): Promise<void> {
  await consoleClientRow(deps.db, id);
  const reason = needReason(b.reason);
  if (!isIsoDate(b.from)) throw E.validation({ from: 'ÉÉÉÉ-HH-NN alakban.' });
  if (b.to && (!isIsoDate(b.to) || b.to < b.from)) throw E.validation({ to: 'A vége nem lehet a kezdete előtt.' });
  await openPause(deps, deps.db, id, b.from, { to: b.to ?? null, source: 'admin' as never, by: auth(c).userId });
  await auditAdmin(c, deps.db, 'admin.pause.opened', id, { reason, after: { from: b.from, to: b.to ?? null } });
}

export async function consolePauseClose(deps: Deps, c: C, id: string, b: { lastDay: string; reason: string }): Promise<void> {
  await consoleClientRow(deps.db, id);
  const reason = needReason(b.reason);
  if (!isIsoDate(b.lastDay)) throw E.validation({ lastDay: 'ÉÉÉÉ-HH-NN alakban.' });
  const r = await closePause(deps, deps.db, id, b.lastDay, auth(c).userId);
  if (!r) throw E.conflict('Nincs nyitott szüneteltetés.');
  await auditAdmin(c, deps.db, 'admin.pause.closed', id, { reason, after: { lastDay: b.lastDay } });
}

export async function reassignAccountant(deps: Deps, c: C, id: string, b: { accountantId: string; reason: string }): Promise<void> {
  const cl = await consoleClientRow(deps.db, id);
  const reason = needReason(b.reason);
  const [a] = await deps.db
    .select({ id: accountants.id, totpEnabledAt: users.totpEnabledAt })
    .from(accountants)
    .innerJoin(users, eq(users.id, accountants.userId))
    .where(and(eq(accountants.id, b.accountantId), eq(accountants.active, true)))
    .limit(1);
  if (!a) throw E.validation({ accountantId: 'Nincs ilyen aktív könyvelő.' });
  if (deps.cfg.staffTotpRequired && !a.totpEnabledAt) throw E.validation({ accountantId: 'Ennek a könyvelőnek még nincs bekapcsolva a kétlépcsős belépése.' });
  if (cl.accountantId === b.accountantId) return;
  await deps.db.update(clients).set({ accountantId: b.accountantId, updatedAt: deps.now() }).where(eq(clients.id, id));
  await auditAdmin(c, deps.db, 'admin.client.reassigned', id, { reason, before: { accountantId: cl.accountantId }, after: { accountantId: b.accountantId } });
  const { reassignmentNotices } = await import('../routes/admin.js');
  await reassignmentNotices(deps, cl, cl.accountantId, b.accountantId);
}

export async function sendClientCode(deps: Deps, c: C, id: string, purpose: 'verify_email' | 'password_reset'): Promise<void> {
  const cl = await consoleClientRow(deps.db, id);
  const [u] = await deps.db.select().from(users).where(eq(users.id, cl.userId)).limit(1);
  if (!u || u.status === 'deleted') throw E.conflict('Ennek az ügyfélnek nincs élő fiókja.');
  if (purpose === 'verify_email' && u.emailVerifiedAt) throw E.conflict('Az e-mail-cím már meg van erősítve.');
  const h = deps.limiter.hit(`console-code:${id}:${purpose}`, 5, 3600_000);
  if (!h.ok) throw E.rateLimited(h.retryAfterSec);
  // the admin never sees the code: it goes straight to the client's own address
  const code = await issueCode(deps, deps.db, { email: u.email, purpose, userId: u.id });
  await sendCodeEmail(deps, u.email, purpose === 'verify_email' ? 'auth_email_code' : 'auth_password_reset_code', code);
  await auditAdmin(c, deps.db, purpose === 'verify_email' ? 'admin.client.verification_sent' : 'admin.client.password_reset_sent', id, {});
}

export async function messageClient(deps: Deps, c: C, id: string, body: string): Promise<void> {
  const cl = await consoleClientRow(deps.db, id);
  const t = (body ?? '').trim();
  if (t.length < 2 || t.length > CONSOLE_RULES.messageMax) throw E.validation({ body: `2–${CONSOLE_RULES.messageMax} karakter.` });
  await deps.db.insert(messages).values({ clientId: id, senderUserId: auth(c).userId, senderRole: 'csapat', kind: 'szoveg', body: t, createdAt: deps.now() });
  await notify(deps, deps.db, { userId: cl.userId, kind: 'message_new', params: { ...(await accountantParams(deps.db, cl.accountantId)), firstName: 'Ügyfélszolgálat' }, link: '/uzenetek' });
  await auditAdmin(c, deps.db, 'admin.client.message_sent', id, { length: t.length });
}

async function announcementTargets(deps: Deps, f: ConsoleAnnouncementInput['filter']): Promise<ClientRow[]> {
  const year = Number(todayBudapest(deps.now()).slice(0, 4));
  let rows = await deps.db.select().from(clients).where(and(eq(clients.isTest, false), isNull(clients.anonymizedAt)));
  if (f?.lifecycle?.length) rows = rows.filter((r) => f.lifecycle!.includes(r.lifecycle));
  if (f?.accountantId) rows = rows.filter((r) => r.accountantId === f.accountantId);
  if (f?.clientIds?.length) rows = rows.filter((r) => f.clientIds!.includes(r.id));
  if (f?.regime) {
    const { clientTaxProfiles } = await import('../db/schema.js');
    const tp = await deps.db.select({ clientId: clientTaxProfiles.clientId, regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(eq(clientTaxProfiles.year, year));
    const reg = new Map(tp.map((x) => [x.clientId, x.regime]));
    rows = rows.filter((r) => (reg.get(r.id) ?? 'atalany') === f.regime);
  }
  return rows;
}

export async function announce(deps: Deps, c: C, b: ConsoleAnnouncementInput): Promise<{ count: number; sent: boolean; id?: string }> {
  const title = (b.title ?? '').trim();
  const body = (b.body ?? '').trim();
  if (title.length < 3 || title.length > CONSOLE_RULES.announcementTitleMax) throw E.validation({ title: `3–${CONSOLE_RULES.announcementTitleMax} karakter.` });
  if (body.length < 3 || body.length > CONSOLE_RULES.announcementBodyMax) throw E.validation({ body: `3–${CONSOLE_RULES.announcementBodyMax} karakter.` });
  if (b.filter?.lifecycle?.some((l) => !(CLIENT_LIFECYCLES as readonly string[]).includes(l))) throw E.validation({ filter: 'Ismeretlen állapot.' });
  const targets = await announcementTargets(deps, b.filter ?? {});
  if (b.expectedCount === undefined) return { count: targets.length, sent: false };
  if (b.expectedCount !== targets.length) throw E.conflict(`Közben változott a címzettek száma (${targets.length}). Nézd meg újra.`);
  if (targets.length > 1) needReason('tömeges közlemény'); // the dialog shows the count; > 1 client counts as destructive
  const since = new Date(deps.now().getTime() - 86_400_000);
  const [{ n }] = (await deps.db.select({ n: sql<number>`count(*)::int` }).from(announcements).where(gte(announcements.createdAt, since))) as [{ n: number }];
  if (n >= CONSOLE_RULES.announcementsPerDay) throw E.rateLimited(3600, 'Ma már 3 közleményt küldtél.');
  const [row] = await deps.db.insert(announcements).values({ title, body, channels: { inApp: true, push: Boolean(b.channels?.push), email: Boolean(b.channels?.email) }, filter: (b.filter ?? {}) as Record<string, unknown>, recipientCount: targets.length, createdBy: auth(c).userId, createdAt: deps.now() }).returning();
  for (const t of targets) await notify(deps, deps.db, { userId: t.userId, kind: 'announcement' as never, params: { cim: title, szoveg: body }, link: '/ertesitesek', data: { announcementId: row!.id }, noPush: !b.channels?.push, noEmail: !b.channels?.email });
  await auditAdmin(c, deps.db, 'admin.announcement.sent', null, { count: targets.length, channels: b.channels, announcementId: row!.id });
  return { count: targets.length, sent: true, id: row!.id };
}

export async function consoleExport(deps: Deps, c: C, id: string, reasonIn: string): Promise<{ exportId: string }> {
  const cl = await consoleClientRow(deps.db, id);
  const reason = needReason(reasonIn);
  const [row] = await deps.db.insert(gdprExports).values({ userId: cl.userId, status: 'keszul' }).returning({ id: gdprExports.id });
  await auditAdmin(c, deps.db, 'admin.client.export_requested', id, { reason, exportId: row!.id });
  return { exportId: row!.id };
}

// ---------------------------------------------------------------------------------------------------------------------
// termination (§29.9.5), reactivation, erasure
// ---------------------------------------------------------------------------------------------------------------------
/** The oldest unpaid fee in days (a past_due/suspended subscription counts from its first failure). */
export async function oldestUnpaidDays(deps: Deps, db: DbOrTx, clientId: string): Promise<number> {
  const now = deps.now();
  let oldest: Date | null = null;
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.clientId, clientId)).limit(1);
  if (sub && (sub.status === 'past_due' || sub.status === 'suspended') && sub.firstFailedAt) oldest = sub.firstFailedAt;
  const open = await db.select().from(feeCharges).where(and(eq(feeCharges.clientId, clientId), eq(feeCharges.status, 'nyitott')));
  for (const f of open) {
    const due = f.dueOn ? new Date(`${f.dueOn}T00:00:00Z`) : f.createdAt;
    if (!oldest || due < oldest) oldest = due;
  }
  return oldest ? Math.floor((now.getTime() - oldest.getTime()) / 86_400_000) : 0;
}

async function letterPdf(deps: Deps, cl: ClientRow, kind: TerminationKind, o: { subReason?: string | null; when?: string; effectiveOn: string; refundHuf: number; openFees: { label: string; amountHuf: number }[]; paidPeriod: string | null; annualText: string }): Promise<Buffer> {
  const L = TERMINATION_LETTER;
  const addr = [cl.addressZip, cl.addressCity, cl.addressLine].filter(Boolean).join(' ');
  const p: Record<string, string> = {
    szolgaltato: brand.provider.legalName,
    szolgaltatoCim: brand.provider.seat,
    brand: brand.name,
    ugyfelNev: clientName(cl),
    ugyfelCim: addr ? `, ${addr}` : '',
    kelt: huLongDate(todayBudapest(deps.now())),
    ugyfelKeresztnev: cl.firstName,
    hatalyNap: huLongDate(o.effectiveOn),
    ok: o.subReason ? (TERMINATION_SUB_REASON_CLIENT as Record<string, string>)[o.subReason] ?? '' : '',
  };
  const body = kind === 'rendes' ? L.rendes : kind === 'azonnali_dij' ? L.azonnali_dij : kind === 'azonnali_mas' ? L.azonnali_mas : o.when === 'azonnal' ? L.ugyfel_kerte_azonnal : L.ugyfel_kerte_idoszak_vege;
  const settlement = [
    L.settlementTitle,
    '',
    o.paidPeriod ? fillPlaceholders(L.settlementPaid, { idoszak: o.paidPeriod }) : L.settlementNone,
    ...(o.refundHuf > 0 ? [fillPlaceholders(L.settlementRefund, { osszeg: fmtN(o.refundHuf) })] : []),
    ...o.openFees.map((f) => fillPlaceholders(L.settlementOpen, { label: f.label, osszeg: fmtN(f.amountHuf) })),
    fillPlaceholders(L.settlementAnnual, { szoveg: o.annualText }),
    L.settlementNoCharge,
  ].join('\n');
  const md = [fillPlaceholders(L.head, p), '', fillPlaceholders(body, p), '', L.data, '', settlement, '', fillPlaceholders(L.close, p)].join('\n');
  return markdownToPdf(deps.cfg.fontDir, 'Felmondás', md);
}

export async function terminateClient(deps: Deps, c: C, id: string, b: ConsoleTerminateInput): Promise<{ effectiveOn: string; documentId: string | null }> {
  const cl = await consoleClientRow(deps.db, id);
  const reason = needReason(b.reason);
  if (cl.terminated) throw E.conflict(TERMINATION_TEXTS.alreadyTerminated);
  if (cl.anonymizedAt) throw E.conflict('Anonimizált ügyfél.');
  const today = todayBudapest(deps.now());
  const [sub] = await deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, id)).limit(1);
  const periodEnd = sub?.currentPeriodEnd && sub.status !== 'canceled' ? sub.currentPeriodEnd : null;
  let effectiveOn = today;
  let immediate = false;
  if (b.kind === 'rendes') {
    const notice = addDays(today, TERMINATION_RULES.noticeDays);
    effectiveOn = periodEnd && periodEnd > notice ? periodEnd : notice;
  } else if (b.kind === 'azonnali_dij') {
    if ((await oldestUnpaidDays(deps, deps.db, id)) <= TERMINATION_RULES.unpaidDays) throw E.conflict(TERMINATION_TEXTS.refusedUnpaid);
    immediate = true;
  } else if (b.kind === 'azonnali_mas') {
    if (!b.subReason) throw E.validation({ subReason: TERMINATION_TEXTS.needSubReason });
    immediate = true;
  } else if (b.kind === 'ugyfel_kerte') {
    if (b.when === 'azonnal') immediate = true;
    else effectiveOn = periodEnd ?? today;
  } else throw E.validation({ kind: 'Ismeretlen felmondási mód.' });
  // pro-rata refund of the remaining paid days (ÁSZF 8.3) for "ügyfél kérte – azonnal"
  let refundHuf = 0;
  let refundPaymentId: string | null = null;
  if (b.kind === 'ugyfel_kerte' && b.when === 'azonnal' && sub?.currentPeriodStart && sub.currentPeriodEnd && sub.currentPeriodEnd >= today) {
    const [last] = await deps.db
      .select()
      .from(payments)
      .where(and(eq(payments.clientId, id), eq(payments.status, 'sikeres'), inArray(payments.kind, ['elso_havi', 'havi', 'fizesd_ki']), eq(payments.periodStart, sub.currentPeriodStart)))
      .orderBy(desc(payments.succeededAt))
      .limit(1);
    if (last) {
      const total = Math.max(1, Math.round((Date.parse(`${sub.currentPeriodEnd}T00:00:00Z`) - Date.parse(`${sub.currentPeriodStart}T00:00:00Z`)) / 86_400_000) + 1);
      const left = Math.max(0, Math.round((Date.parse(`${sub.currentPeriodEnd}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000));
      refundHuf = Math.min(last.amountHuf - last.refundedHuf, Math.floor((last.amountHuf * left) / total));
      refundPaymentId = refundHuf >= 1 ? last.id : null;
    }
  }
  const now = deps.now();
  const actor = auth(c).userId;
  await deps.db.update(clients).set({ terminated: { kind: b.kind, subReason: b.subReason ?? null, reason, noticeAt: now.toISOString(), effectiveOn, by: actor, appliedAt: null }, updatedAt: now }).where(eq(clients.id, id));
  await cancelSubscriptionK29(deps, { clientId: id, when: immediate ? 'azonnal' : 'datum', ...(immediate ? {} : { date: effectiveOn }), byUserId: actor, reason: `felmondás: ${b.kind}` } as never);
  if (refundPaymentId && refundHuf > 0) await refundPayment(deps, { paymentId: refundPaymentId, amountHuf: refundHuf, reason: 'Időarányos visszatérítés (ÁSZF 8.3.)', byUserId: actor }).catch(() => undefined);
  const openFees = (await deps.db.select().from(feeCharges).where(and(eq(feeCharges.clientId, id), eq(feeCharges.status, 'nyitott')))).map((f) => ({ label: (FEE_KIND_LABELS as Record<string, string>)[f.kind] ?? f.kind, amountHuf: f.amountHuf }));
  const paidPeriod = sub?.currentPeriodStart && sub.currentPeriodEnd ? `${huLongDate(sub.currentPeriodStart)} – ${huLongDate(sub.currentPeriodEnd)}` : null;
  let documentId: string | null = null;
  try {
    const pdf = await letterPdf(deps, cl, b.kind, { subReason: b.subReason ?? null, when: b.when, effectiveOn, refundHuf, openFees, paidPeriod, annualText: 'ha az idei SZJA-bevallást is mi adjuk be, azt külön megrendelheted.' });
    documentId = await createDocumentFromBuffer(deps, deps.db, {
      clientId: id,
      category: 'szerzodes',
      title: fillPlaceholders(TERMINATION_TEXTS.documentTitle, { datum: huLongDate(today) }),
      month: today.slice(0, 7),
      data: pdf,
      mime: 'application/pdf',
      fileName: 'felmondas.pdf',
      source: 'rendszer',
      status: 'feldolgozva',
      by: actor,
      visibility: 'kozos',
    } as Parameters<typeof createDocumentFromBuffer>[2]);
  } catch {
    documentId = null;
  }
  const variant = b.kind === 'ugyfel_kerte' ? 'ugyfel_kerte' : immediate ? 'azonnali' : 'rendes';
  await notify(deps, deps.db, { userId: cl.userId, kind: 'contract_terminated' as never, variant, params: { datum: huLongDate(effectiveOn) }, link: '/dosszie', data: { documentId } });
  await auditAdmin(c, deps.db, 'admin.client.terminated', id, { reason, kind: b.kind, subReason: b.subReason ?? null, effectiveOn, refundHuf, documentId });
  if (immediate) await applyTerminationEffect(deps, id, actor);
  return { effectiveOn, documentId };
}

/** On effectiveOn (immediately for the immediate kinds; the 06:10 job for the others). */
export async function applyTerminationEffect(deps: Deps, clientId: string, by: string | null): Promise<boolean> {
  const db = deps.db;
  const [cl] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!cl?.terminated || cl.terminated.appliedAt) return false;
  const now = deps.now();
  await db.update(clients).set({ lifecycle: 'megszunt', terminated: { ...cl.terminated, appliedAt: now.toISOString() }, updatedAt: now }).where(eq(clients.id, clientId));
  await db.update(subscriptions).set({ status: 'canceled', canceledAt: now, nextChargeAt: null, nextRetryAt: null, updatedAt: now }).where(and(eq(subscriptions.clientId, clientId), ne(subscriptions.status, 'canceled')));
  await endRelationship(db, clientId, now);
  await revokeFeed(deps, db, clientId, { userId: by, role: by ? 'admin' : 'system', reason: 'felmondás' });
  // the saved card stops at the effective date
  const { paymentMethods } = await import('../db/schema.js');
  await db.update(paymentMethods).set({ status: 'torolve', detachedAt: now }).where(and(eq(paymentMethods.clientId, clientId), eq(paymentMethods.status, 'aktiv')));
  const mod = (await import('./payments.js').catch(() => null)) as Record<string, unknown> | null;
  const detach = mod?.['detachCardsK29'];
  if (typeof detach === 'function') await (detach as (d: Deps, id: string) => Promise<void>)(deps, clientId).catch(() => undefined);
  // the accountant's tasks (ÁSZF 8.6)
  if (cl.accountantId) {
    const [acc] = await db.select({ userId: accountants.userId }).from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1);
    if (acc) {
      await db.insert(messages).values({ clientId, senderUserId: null, senderRole: 'system', kind: 'rendszer', body: `${TERMINATION_TEXTS.accTaskMeghatalmazas}. ${TERMINATION_TEXTS.accTaskTechUser}.`, createdAt: now, readByClientAt: now });
      await notify(deps, db, { userId: acc.userId, kind: 'assist_task', variant: 'felmondas', params: { clientName: clientName(cl), kindLabel: 'Felmondás' }, link: `/ugyfelek/${clientId}`, pushText: { title: `Felmondás: ${clientName(cl)}`, body: `${TERMINATION_TEXTS.accTaskMeghatalmazas}; ${TERMINATION_TEXTS.accTaskTechUser.toLowerCase()}.` } });
    }
  }
  await audit(db, { action: 'termination.effective', actorUserId: by, actorRole: by ? 'admin' : 'system', targetType: 'client', targetId: clientId, clientId, details: { kind: cl.terminated.kind, effectiveOn: cl.terminated.effectiveOn } });
  return true;
}

/** Job termination_effective (06:10): applies every termination whose effectiveOn has come. */
export async function jobTerminationEffective(deps: Deps): Promise<number> {
  const today = todayBudapest(deps.now());
  const rows = await deps.db.select({ id: clients.id, t: clients.terminated }).from(clients).where(sql`${clients.terminated} is not null and (${clients.terminated}->>'appliedAt') is null`);
  let n = 0;
  for (const r of rows) if (r.t && r.t.effectiveOn <= today && (await applyTerminationEffect(deps, r.id, null))) n++;
  return n;
}

export async function reactivateClient(deps: Deps, c: C, id: string, reasonIn: string): Promise<void> {
  const cl = await consoleClientRow(deps.db, id);
  const reason = needReason(reasonIn);
  if (!cl.terminated) throw E.conflict('Ennek az ügyfélnek nincs felmondott szerződése.');
  if (cl.anonymizedAt) throw E.conflict('Anonimizált ügyfél nem állítható vissza.');
  const now = deps.now();
  await deps.db.transaction(async (tx) => {
    await tx.update(users).set({ status: 'active', updatedAt: now }).where(and(eq(users.id, cl.userId), ne(users.status, 'deleted')));
    await tx.update(clients).set({ lifecycle: 'bekotes_alatt', terminated: null, updatedAt: now }).where(eq(clients.id, id));
    await setStep(deps, tx, id, 'szerzodes', 'nincs_kezdve', { note: null });
    await setStep(deps, tx, id, 'elofizetes', 'nincs_kezdve', { note: null });
    // the guided first run resumes at the contract step
    if (cl.guided) await tx.update(clients).set({ guided: { ...cl.guided, finishedAt: null, pausedAt: null } }).where(eq(clients.id, id));
    await auditAdmin(c, tx, 'admin.client.reactivated', id, { reason, before: { kind: cl.terminated!.kind, effectiveOn: cl.terminated!.effectiveOn } });
  });
  await notify(deps, deps.db, { userId: cl.userId, kind: 'contract_reactivated' as never, params: {}, link: '/' });
  deps.sessionCache.clear();
}

export async function anonymizeFromConsole(deps: Deps, c: C, id: string, b: { reason: string; confirmName: string }): Promise<unknown> {
  const cl = await consoleClientRow(deps.db, id);
  const reason = needReason(b.reason);
  if ((b.confirmName ?? '').trim().replace(/\s+/g, ' ').toLowerCase() !== clientName(cl).toLowerCase()) throw E.validation({ confirmName: 'Írd be pontosan az ügyfél teljes nevét.' });
  return anonymizeClient(deps, id, { by: auth(c).userId, reason, requestId: c.get('requestId'), ipHmac: c.get('ipHmac') });
}

export { assistRequests };
