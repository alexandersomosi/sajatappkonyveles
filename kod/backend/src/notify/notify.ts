// Notifications (SPEC §16): every event creates an in-app row; push and e-mail are sent by the
// dispatcher (API kicks it right after the request, the worker sweeps every 5 minutes). Each
// channel is claimed atomically (UPDATE … WHERE sent_at IS NULL) so API and worker never double-send.
import { and, eq, gte, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import brand from '../_shared/brand.json' with { type: 'json' };
import type { NotificationKind } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, clients, notificationPrefs, notifications, pushTokens, users } from '../db/schema.js';
import { log, safeErr } from '../log.js';
import { addDays, budapestLocalToUtc, budapestParts } from '../lib/dates.js';

export const KIND_DEFAULTS: Record<NotificationKind, { push: boolean; email: boolean; to: 'client' | 'accountant' | 'any' }> = {
  tax_approved: { push: true, email: true, to: 'client' },
  tax_due_soon: { push: true, email: true, to: 'client' },
  tax_reopened: { push: true, email: true, to: 'client' },
  tax_payment_verified: { push: true, email: false, to: 'client' },
  tax_payment_mismatch: { push: true, email: true, to: 'client' },
  tax_filed: { push: true, email: true, to: 'client' },
  document_processed: { push: true, email: false, to: 'client' },
  document_filed: { push: true, email: false, to: 'client' },
  request_new: { push: true, email: true, to: 'client' },
  request_reminder: { push: true, email: true, to: 'client' },
  request_done: { push: true, email: false, to: 'client' },
  message_new: { push: true, email: false, to: 'client' },
  client_message_new: { push: false, email: false, to: 'accountant' },
  client_request_new: { push: false, email: false, to: 'accountant' },
  client_document_uploaded: { push: false, email: false, to: 'accountant' },
  client_marked_paid: { push: false, email: false, to: 'accountant' },
  onboarding_needs_review: { push: false, email: false, to: 'accountant' },
  onboarding_needs_fix: { push: true, email: true, to: 'client' },
  onboarding_done: { push: true, email: true, to: 'client' },
  limit_warning: { push: true, email: true, to: 'any' },
  appointment_booked: { push: true, email: true, to: 'any' },
  appointment_reminder: { push: true, email: true, to: 'any' },
  appointment_cancelled: { push: true, email: true, to: 'any' },
  subscription_payment_failed: { push: true, email: true, to: 'client' },
  subscription_renewal_needed: { push: true, email: true, to: 'client' },
  subscription_canceled: { push: true, email: true, to: 'client' },
  fee_invoice_issued: { push: true, email: true, to: 'client' },
  auth_email_code: { push: false, email: true, to: 'any' },
  auth_password_reset_code: { push: false, email: true, to: 'any' },
  auth_staff_invite: { push: false, email: true, to: 'any' },
  gdpr_export_ready: { push: true, email: true, to: 'any' },
  // SPEC §26.11 – client. 'accountant' below means any staff role (accountant, admin, csapat).
  callback_received: { push: false, email: true, to: 'client' },
  callback_calling: { push: true, email: false, to: 'client' },
  callback_missed: { push: true, email: true, to: 'client' },
  callback_wrong_number: { push: true, email: true, to: 'client' },
  callback_done: { push: false, email: false, to: 'client' },
  callback_unreached: { push: true, email: true, to: 'client' },
  callback_closed: { push: false, email: false, to: 'client' },
  registration_reminder: { push: true, email: true, to: 'client' },
  registration_needs_fix: { push: true, email: true, to: 'client' },
  registration_checked: { push: true, email: true, to: 'client' },
  registration_done: { push: true, email: true, to: 'client' },
  // SPEC §26.11 – staff (csapat, admin, the assigned accountant). callback_new goes into the daily digest.
  callback_new: { push: false, email: false, to: 'accountant' },
  callback_assigned: { push: false, email: true, to: 'accountant' },
  callback_overdue: { push: false, email: true, to: 'accountant' },
  registration_submitted: { push: false, email: true, to: 'accountant' },
  // SPEC §27.8 – client ("Intézzük helyetted", kamara). Push only 8–20 h Budapest (pushNotBefore, see notify()).
  assist_started: { push: true, email: true, to: 'client' },
  assist_mh_filed: { push: true, email: true, to: 'client' },
  assist_mh_reminder: { push: true, email: true, to: 'client' },
  assist_mh_expired: { push: true, email: true, to: 'client' },
  assist_consent_needed: { push: true, email: true, to: 'client' },
  assist_ev_filed: { push: true, email: true, to: 'client' },
  kamara_reminder: { push: true, email: true, to: 'client' },
  // SPEC §27.8 – staff. client_path_changed is an in-panel badge only (and a line of the staff digest).
  assist_task: { push: false, email: true, to: 'accountant' },
  assist_approval_overdue: { push: false, email: true, to: 'accountant' },
  client_path_changed: { push: false, email: false, to: 'accountant' },
};

/** SPEC §27.3.5: client push of these kinds waits for 08:00 Budapest outside 8–20 h (in-app and e-mail go at once). */
const QUIET_PUSH_KINDS: readonly NotificationKind[] = ['assist_started', 'assist_mh_filed', 'assist_mh_reminder', 'assist_mh_expired', 'assist_consent_needed', 'assist_ev_filed', 'kamara_reminder'];
const PUSH_FROM_HOUR = 8;
const PUSH_TO_HOUR = 20;

/** The next moment push may go out for a quiet-hours kind, or null when it may go now. */
export function pushNotBefore(now: Date): Date | null {
  const p = budapestParts(now);
  if (p.hour >= PUSH_FROM_HOUR && p.hour < PUSH_TO_HOUR) return null;
  const day = p.hour >= PUSH_TO_HOUR ? addDays(p.date, 1) : p.date;
  return budapestLocalToUtc(day, `${String(PUSH_FROM_HOUR).padStart(2, '0')}:00`);
}

export type Params = Record<string, string | number | null | undefined>;

/** Name forms of the accountant for templates: {firstName}, {firstNameWith}, … */
export async function accountantParams(db: DbOrTx, accountantId: string | null | undefined): Promise<Params> {
  if (!accountantId) return { firstName: 'A könyvelőd', firstNameWith: 'a könyvelőddel', firstNameFrom: 'a könyvelődtől', firstNameOnto: 'a könyvelődre', firstNameAcc: 'a könyvelődet' };
  const [a] = await db.select().from(accountants).where(eq(accountants.id, accountantId)).limit(1);
  if (!a) return accountantParams(db, null);
  return {
    firstName: a.firstName,
    firstNameWith: a.nameWith ?? `${a.firstName}val`,
    firstNameFrom: a.nameFrom ?? `${a.firstName}tól`,
    firstNameOnto: a.nameOnto ?? `${a.firstName}ra`,
    firstNameAcc: a.nameAcc ?? `${a.firstName}t`,
    accountantName: a.displayName,
  };
}

export interface NotifyInput {
  userId: string;
  kind: NotificationKind;
  params?: Params;
  link?: string | null;
  data?: Record<string, unknown>;
  /** Optional text variant: notif.<kind>.<variant>.title/body, falling back to notif.<kind>.*. */
  variant?: string;
  /** Force a channel off for this one notification (e.g. the in-app-only legacy notice, SPEC §26.11). */
  noEmail?: boolean;
  noPush?: boolean;
  /** E-mail text instead of the in-app body (content key email.<kind>.body rendered with the same params). */
  emailBodyKey?: string;
}

/** Creates the in-app row (inside the caller's transaction if given) and schedules sending. */
export async function notify(deps: Deps, db: DbOrTx, n: NotifyInput): Promise<string> {
  // SPEC §26.5.2 (order 4): tax data is locked before activation, so no tax_* message (in-app, push or e-mail) may
  // reach a client in 'bekotes_alatt' – he could neither see the account numbers nor mark it paid (review k3c2).
  if (n.kind.startsWith('tax_')) {
    const [cl] = await db.select({ lifecycle: clients.lifecycle }).from(clients).where(eq(clients.userId, n.userId)).limit(1);
    if (cl?.lifecycle === 'bekotes_alatt') {
      log().info({ kind: n.kind }, 'notify suppressed before activation');
      return '';
    }
  }
  const params: Params = { brand: brand.name, ...(n.params ?? {}) };
  const key = async (part: 'title' | 'body') => {
    if (n.variant) {
      const k = `notif.${n.kind}.${n.variant}.${part}`;
      if (await deps.content.exists(k)) return k;
    }
    return `notif.${n.kind}.${part}`;
  };
  const title = await deps.content.render(await key('title'), params);
  const body = await deps.content.render(await key('body'), params);
  const def = KIND_DEFAULTS[n.kind];
  const [pref] = await db
    .select()
    .from(notificationPrefs)
    .where(and(eq(notificationPrefs.userId, n.userId), eq(notificationPrefs.kind, n.kind)))
    .limit(1);
  let wantPush = (pref ? pref.push : def.push) && !n.noPush;
  const quietUntil = wantPush && QUIET_PUSH_KINDS.includes(n.kind) ? pushNotBefore(deps.now()) : null;
  const wantEmail = (pref ? pref.email : def.email) && !n.noEmail;
  const emailBody = wantEmail && n.emailBodyKey && (await deps.content.exists(n.emailBodyKey)) ? await deps.content.render(n.emailBodyKey, params) : null;

  // document_processed: at most one push per day – fold into today's row instead.
  if (n.kind === 'document_processed') {
    const dayStart = new Date(deps.now().getTime() - 20 * 3600_000);
    const [existing] = await db
      .select({ id: notifications.id, data: notifications.data })
      .from(notifications)
      .where(and(eq(notifications.userId, n.userId), eq(notifications.kind, 'document_processed'), gte(notifications.createdAt, dayStart)))
      .limit(1);
    if (existing) {
      const count = Number((existing.data as { count?: number } | null)?.count ?? 1) + Number(n.params?.count ?? 1);
      const p2 = { ...params, count };
      await db
        .update(notifications)
        .set({
          title: await deps.content.render('notif.document_processed.title', p2),
          body: await deps.content.render('notif.document_processed.body', p2),
          data: { ...(existing.data ?? {}), count },
          readAt: null,
        })
        .where(eq(notifications.id, existing.id));
      return existing.id;
    }
    wantPush = wantPush && true;
  }

  const [row] = await db
    .insert(notifications)
    .values({
      userId: n.userId,
      kind: n.kind,
      title,
      body,
      link: n.link ?? null,
      data: {
        ...(n.data ?? {}),
        ...(n.kind === 'document_processed' ? { count: Number(n.params?.count ?? 1) } : {}),
        ...(emailBody ? { emailBody } : {}),
        ...(quietUntil ? { pushNotBefore: quietUntil.toISOString() } : {}),
      },
      wantPush,
      wantEmail,
      // The app clock, not the DB's now(): seeded history and tests get the time of the event.
      createdAt: deps.now(),
    })
    .returning({ id: notifications.id });
  deps.dispatcher.kick();
  return row!.id;
}

/** Code e-mails go out immediately (the user is waiting) and never create an in-app row. */
export async function sendCodeEmail(
  deps: Deps,
  to: string,
  kind: 'auth_email_code' | 'auth_password_reset_code' | 'auth_staff_invite' | 'auth_staff_invite_csapat' | 'auth_password_changed' | 'auth_totp_changed',
  code: string,
): Promise<'sent' | 'demo' | 'disabled'> {
  const params = { brand: brand.name, code, panelUrl: deps.cfg.panelPublicUrl, appUrl: deps.cfg.appPublicUrl };
  const subject = await deps.content.render(`email.${kind}.subject`, params);
  const text = await deps.content.render(`email.${kind}.body`, params);
  try {
    return await deps.mailer.send({ to, subject, text, template: kind });
  } catch (err) {
    log().error({ template: kind, err: safeErr(err) }, 'code mail failed');
    return 'disabled';
  }
}

/** Sends pending push/e-mail for recent notifications. Safe to run concurrently. */
export async function dispatchPending(deps: Deps, limit = 200): Promise<{ push: number; email: number }> {
  const db = deps.db;
  const since = new Date(deps.now().getTime() - 3 * 86_400_000);
  const pending = await db
    .select({ id: notifications.id, userId: notifications.userId, data: notifications.data })
    .from(notifications)
    .where(
      and(
        gte(notifications.createdAt, since),
        isNull(notifications.error),
        or(and(eq(notifications.wantPush, true), isNull(notifications.pushSentAt)), and(eq(notifications.wantEmail, true), isNull(notifications.emailSentAt))),
      ),
    )
    .limit(limit);
  let pushN = 0;
  let mailN = 0;
  for (const p of pending) {
    // push (SPEC §27.3.5 quiet hours: a row with data.pushNotBefore in the future keeps waiting for a later sweep)
    const notBefore = (p.data as { pushNotBefore?: string } | null)?.pushNotBefore;
    const pushLater = Boolean(notBefore && Date.parse(notBefore) > deps.now().getTime());
    const [claimP] = pushLater ? [] : await db
      .update(notifications)
      .set({ pushSentAt: deps.now() })
      .where(and(eq(notifications.id, p.id), eq(notifications.wantPush, true), isNull(notifications.pushSentAt)))
      .returning();
    if (claimP) {
      const tokens = await db
        .select({ token: pushTokens.token })
        .from(pushTokens)
        .where(and(eq(pushTokens.userId, p.userId), isNull(pushTokens.disabledAt)));
      if (tokens.length) {
        try {
          const tickets = await deps.push.send(
            tokens.map((t) => ({ to: t.token, title: claimP.title, body: claimP.body, data: { link: claimP.link, id: claimP.id } })),
          );
          const bad = tickets.filter((t) => t.error === 'DeviceNotRegistered').map((t) => t.token);
          if (bad.length) await db.update(pushTokens).set({ disabledAt: deps.now() }).where(inArray(pushTokens.token, bad));
          const ids = tickets.filter((t) => t.ok && t.id).map((t) => ({ id: t.id!, token: t.token }));
          if (ids.length) await db.update(notifications).set({ data: sql`coalesce(${notifications.data}, '{}'::jsonb) || ${JSON.stringify({ pushTickets: ids })}::jsonb` }).where(eq(notifications.id, p.id));
          pushN += tickets.filter((t) => t.ok).length;
        } catch (err) {
          log().warn({ err: safeErr(err) }, 'push send failed');
        }
      }
    }
    // e-mail
    const [claimE] = await db
      .update(notifications)
      .set({ emailSentAt: deps.now() })
      .where(and(eq(notifications.id, p.id), eq(notifications.wantEmail, true), isNull(notifications.emailSentAt)))
      .returning();
    if (claimE) {
      const [u] = await db.select({ email: users.email, status: users.status, role: users.role }).from(users).where(eq(users.id, p.userId)).limit(1);
      if (u && u.status === 'active') {
        try {
          const footer = await deps.content.render('email.generic.footer', { brand: brand.name });
          // Staff links open the panel, client links the app.
          const link = claimE.link ? `\n\n${u.role === 'client' ? deps.cfg.appPublicUrl : deps.cfg.panelPublicUrl}${claimE.link}` : '';
          const emailBody = typeof (claimE.data as { emailBody?: unknown } | null)?.emailBody === 'string' ? String((claimE.data as { emailBody: string }).emailBody) : claimE.body;
          const r = await deps.mailer.send({ to: u.email, subject: claimE.title, text: `${emailBody}${link}${footer}`, template: claimE.kind });
          if (r === 'disabled') await db.update(notifications).set({ error: 'mail_not_configured' }).where(eq(notifications.id, p.id));
          else mailN++;
        } catch (err) {
          await db.update(notifications).set({ emailSentAt: null }).where(eq(notifications.id, p.id));
          log().warn({ err: safeErr(err) }, 'notification mail failed');
        }
      }
    }
  }
  return { push: pushN, email: mailN };
}

/** Hourly: check Expo receipts of the last day; DeviceNotRegistered disables the token. */
export async function checkPushReceipts(deps: Deps): Promise<number> {
  if (deps.push.mode !== 'expo') return 0;
  const since = new Date(deps.now().getTime() - 86_400_000);
  const rows = await deps.db
    .select({ id: notifications.id, data: notifications.data })
    .from(notifications)
    .where(and(gte(notifications.pushSentAt, since), lt(notifications.pushSentAt, new Date(deps.now().getTime() - 15 * 60_000))));
  const tickets: { id: string; token: string; nid: string }[] = [];
  for (const r of rows) {
    const d = (r.data ?? {}) as { pushTickets?: { id: string; token: string }[]; receiptsChecked?: boolean };
    if (d.receiptsChecked || !d.pushTickets) continue;
    for (const t of d.pushTickets) tickets.push({ ...t, nid: r.id });
  }
  if (!tickets.length) return 0;
  const res = await deps.push.receipts(tickets.map((t) => t.id));
  const bad = tickets.filter((t) => res[t.id]?.error === 'DeviceNotRegistered').map((t) => t.token);
  if (bad.length) await deps.db.update(pushTokens).set({ disabledAt: deps.now() }).where(inArray(pushTokens.token, bad));
  const nids = [...new Set(tickets.map((t) => t.nid))];
  await deps.db
    .update(notifications)
    .set({ data: sql`coalesce(${notifications.data}, '{}'::jsonb) || '{"receiptsChecked":true}'::jsonb` })
    .where(inArray(notifications.id, nids));
  return bad.length;
}

/** Simple debounced kicker for the API process. */
export function createDispatcher(getDeps: () => Deps, enabled: boolean): { kick(): void; flush(): Promise<void> } {
  let timer: NodeJS.Timeout | null = null;
  let running: Promise<void> | null = null;
  const run = async () => {
    timer = null;
    try {
      await dispatchPending(getDeps());
    } catch (err) {
      log().warn({ err: safeErr(err) }, 'dispatch failed');
    }
  };
  return {
    kick() {
      if (!enabled || timer) return;
      timer = setTimeout(() => {
        running = run();
      }, 500);
      timer.unref?.();
    },
    async flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
        await run();
      }
      if (running) await running;
    },
  };
}
