// /me – all roles (SPEC §12.3): profile, notification prefs, push tokens, inbox, consents, GDPR.
import { notificationSettingsOf } from '../notify/notify.js';
import { clientTaxProfiles, userNotificationSettings } from '../db/schema.js';
import { serviceLockView } from '../services/zarolas.js';
import { NOTIFICATION_PREFS_MAX } from '../_shared/enums.js';
import { and, desc, eq, inArray, isNull, lt, notInArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import brand from '../_shared/brand.json' with { type: 'json' };
import { huFullDateIg, todayBudapest } from '../lib/dates.js';
import { log, safeErr } from '../log.js';
import { z } from 'zod';
import type { Me } from '../_shared/api.js';
import { LEGAL_DOC_TYPES, NOTIFICATION_KINDS, type LegalDocType, type NotificationKind } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { accountants, clients, consents, files, gdprExports, notificationPrefs, notifications, pushTokens, users } from '../db/schema.js';
import { audit, auditC } from '../audit.js';
import { hmacHex } from '../lib/crypto.js';
import { requireAuth } from '../auth/middleware.js';
import { revokeAllSessions } from '../auth/tokens.js';
import { auth, param, parseQuery, readJson, type Env } from '../http/core.js';
import { ApiError, E } from '../lib/errors.js';
import { freshSignIn } from './auth.js';
import { verifyPassword } from '../lib/password.js';
import { base32Decode, verifyTotp } from '../lib/totp.js';
import { CONTRACT_DOCS } from '../legal.js';
import { KIND_DEFAULTS } from '../notify/notify.js';
import { accountantPublic } from '../services/people.js';
import { allDone, checkCompletion, clientTodoCount, journeyOf, pathOf, remainingSteps, setStep, steps } from '../services/onboarding.js';
import { clientAccess } from '../services/access.js';
import { openRequestsFromAccountant } from '../services/requests.js';
import { teamMembers } from '../db/schema.js';
import { LEGACY_NOTIFICATION_KINDS } from '../_shared/enums.js';
import { requestDeletion, cancelDeletion } from '../services/gdpr.js';
import { filledLegalText, storeSignedContract } from '../services/contracts.js';

export function meRoutes(deps: Deps) {
  const r = new Hono<Env>();
  r.use('*', requireAuth(deps, { allowWithoutStaffTotp: true }));

  async function consentsNeeded(userId: string, role: string): Promise<LegalDocType[]> {
    if (role !== 'client') return [];
    const rows = await deps.db.select().from(consents).where(and(eq(consents.userId, userId), isNull(consents.withdrawnAt)));
    const need: LegalDocType[] = [];
    for (const t of CONTRACT_DOCS) {
      const cur = deps.legal.current(t);
      const have = rows.filter((x) => x.docType === t);
      if (!have.length || (cur.requiresReconsent && !have.some((h) => h.version === cur.version))) need.push(t);
    }
    return need;
  }

  async function prefs(userId: string, role: string) {
    const rows = await deps.db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId));
    return NOTIFICATION_KINDS.filter((k) => !k.startsWith('auth_') && !LEGACY_NOTIFICATION_KINDS.includes(k))
      .filter((k) => (role === 'client' ? KIND_DEFAULTS[k].to !== 'accountant' : KIND_DEFAULTS[k].to !== 'client'))
      .map((kind) => {
        const p = rows.find((x) => x.kind === kind);
        return { kind, push: p ? p.push : KIND_DEFAULTS[kind].push, email: p ? p.email : KIND_DEFAULTS[kind].email };
      });
  }

  r.get('/', async (c) => {
    const a = auth(c);
    const [u] = await deps.db.select().from(users).where(eq(users.id, a.userId)).limit(1);
    if (!u) throw E.unauthenticated();
    const me: Me = {
      user: { id: u.id, email: u.email, role: u.role, displayName: u.displayName ?? '', emailVerified: Boolean(u.emailVerifiedAt), totpEnabled: Boolean(u.totpEnabledAt) },
      notificationPrefs: await prefs(u.id, u.role),
      consentsNeeded: await consentsNeeded(u.id, u.role),
      // SPEC §28.2.3: quiet hours + amounts in push
      notificationSettings: await notificationSettingsOf(deps.db, u.id),
    };
    if (u.role === 'client') {
      const [cl] = await deps.db.select().from(clients).where(eq(clients.userId, u.id)).limit(1);
      if (cl) {
        const st = await steps(deps.db, cl.id);
        me.client = { id: cl.id, firstName: cl.firstName, lastName: cl.lastName, lifecycle: cl.lifecycle, onboardingComplete: allDone(st, pathOf(cl)), personalReferralCode: cl.personalReferralCode };
        // SPEC §28.K.5: the lock banner of every main screen reads this (it was only in the MINTA mock – k6c review)
        me.client.serviceLock = await serviceLockView(deps, cl);
        const [tpNow] = await deps.db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, Number(todayBudapest(deps.now()).slice(0, 4))))).limit(1);
        if (tpNow) me.client.taxRegime = tpNow.regime;
        // SPEC §27.4.2: the same numbers as the journey (band = badge = locked sheet).
        const j = await journeyOf(deps, deps.db, cl);
        const acc0 = await clientAccess(deps, deps.db, cl, j.remaining, j.todoCount);
        me.access = acc0.mode === 'korlatozott' ? { ...acc0, activationHint: j.lockedSheetText } : acc0;
        void st;
        void remainingSteps;
        void pathOf;
        void clientTodoCount;
        void openRequestsFromAccountant;
        const [acc] = cl.accountantId ? await deps.db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
        me.accountant = accountantPublic(acc ?? null);
      }
    } else {
      const [acc] = await deps.db.select().from(accountants).where(eq(accountants.userId, u.id)).limit(1);
      if (acc) me.staffAccountantId = acc.id;
      const [tm] = await deps.db.select().from(teamMembers).where(eq(teamMembers.userId, u.id)).limit(1);
      if (tm && u.role === 'csapat') me.teamMember = { firstName: tm.firstName, displayName: tm.displayName };
    }
    return c.json({ ...me, staffTotpRequired: deps.cfg.staffTotpRequired && u.role !== 'client' });
  });

  r.patch('/', async (c) => {
    const a = auth(c);
    const b = await readJson(
      c,
      z.object({
        displayName: z.string().trim().min(1).max(80).optional(),
        notificationPrefs: z.array(z.object({ kind: z.enum(NOTIFICATION_KINDS), push: z.boolean(), email: z.boolean() })).max(NOTIFICATION_PREFS_MAX).optional(),
        notificationSettings: z
          .strictObject({ quietEnabled: z.boolean().optional(), quietFrom: z.number().int().min(0).max(23).optional(), quietTo: z.number().int().min(0).max(23).optional(), pushShowAmounts: z.boolean().optional() })
          .optional(),
      }),
    );
    if (b.notificationSettings && Object.keys(b.notificationSettings).length) {
      const cur = await notificationSettingsOf(deps.db, a.userId);
      const v = { ...cur, ...b.notificationSettings };
      const row = { quietEnabled: v.quietEnabled, quietFrom: v.quietFrom, quietTo: v.quietTo, pushShowAmounts: v.pushShowAmounts, updatedAt: deps.now() };
      await deps.db.insert(userNotificationSettings).values({ userId: a.userId, ...row }).onConflictDoUpdate({ target: userNotificationSettings.userId, set: row });
      await audit(deps.db, { action: 'me.notification_settings', actorUserId: a.userId, actorRole: a.role, targetType: 'user', targetId: a.userId, details: { fields: Object.keys(b.notificationSettings) } });
    }
    if (b.displayName) await deps.db.update(users).set({ displayName: b.displayName, updatedAt: deps.now() }).where(eq(users.id, a.userId));
    for (const p of b.notificationPrefs ?? []) {
      if ((p.kind as NotificationKind).startsWith('auth_')) continue;
      await deps.db
        .insert(notificationPrefs)
        .values({ userId: a.userId, kind: p.kind, push: p.push, email: p.email })
        .onConflictDoUpdate({ target: [notificationPrefs.userId, notificationPrefs.kind], set: { push: p.push, email: p.email } });
    }
    deps.sessionCache.clear();
    return c.json({ ok: true });
  });

  // ---------- push tokens ----------
  r.post('/push-tokens', async (c) => {
    const a = auth(c);
    const b = await readJson(c, z.object({ token: z.string().min(10).max(300), platform: z.enum(['android', 'ios', 'web']), installationId: z.string().min(8).max(100).optional() }));
    const inst = b.installationId ? hmacHex(deps.cfg.auditIpSalt, `inst:${b.installationId}`).slice(0, 32) : null;
    const [cur] = await deps.db.select().from(pushTokens).where(eq(pushTokens.token, b.token)).limit(1);
    if (cur && cur.userId !== a.userId) {
      // The same phone signed in with another account (shared device): the token moves – but only from the
      // same installation. Knowing someone's token is never enough to take their notifications over.
      const sameInstall = Boolean(inst && cur.installationHash && inst === cur.installationHash);
      const unknownInstall = !cur.installationHash;
      await audit(deps.db, { action: 'push.token_rebind', actorUserId: a.userId, actorRole: a.role, targetType: 'user', targetId: cur.userId, details: { allowed: sameInstall || unknownInstall, sameInstall } });
      if (!sameInstall && !unknownInstall) return c.body(null, 204);
      if (unknownInstall && !inst) {
        // Old app without an installation id: the old owner stops getting pushes on it, nobody takes it over.
        await deps.db.update(pushTokens).set({ disabledAt: deps.now() }).where(eq(pushTokens.id, cur.id));
        return c.body(null, 204);
      }
    }
    await deps.db
      .insert(pushTokens)
      .values({ userId: a.userId, token: b.token, platform: b.platform, installationHash: inst })
      .onConflictDoUpdate({ target: pushTokens.token, set: { userId: a.userId, platform: b.platform, lastSeenAt: deps.now(), disabledAt: null, ...(inst ? { installationHash: inst } : {}) } });
    return c.body(null, 204);
  });

  r.delete('/push-tokens/:token', async (c) => {
    const a = auth(c);
    await deps.db.delete(pushTokens).where(and(eq(pushTokens.token, c.req.param('token')), eq(pushTokens.userId, a.userId)));
    return c.body(null, 204);
  });

  // ---------- inbox ----------
  /** /me is open during the staff 2FA setup, but the inbox carries client names: it needs the second factor. */
  const staffNeeds2fa = (a: { role: string; totpEnabled: boolean }) => {
    if (deps.cfg.staffTotpRequired && a.role !== 'client' && !a.totpEnabled) throw E.mfaSetupRequired();
  };

  r.get('/notifications', async (c) => {
    const a = auth(c);
    staffNeeds2fa(a);
    const q = parseQuery(c, z.object({ cursor: z.string().max(80).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }));
    // SPEC §26.2.9: retired appointment notices (never sent any more) are not listed – the rows stay in the DB.
    const notLegacy = notInArray(notifications.kind, [...LEGACY_NOTIFICATION_KINDS]);
    let cond = and(eq(notifications.userId, a.userId), notLegacy)!;
    if (q.cursor) {
      const d = new Date(q.cursor.split('|')[0] ?? '');
      if (!Number.isNaN(d.getTime())) cond = and(cond, lt(notifications.createdAt, d))!;
    }
    const rows = await deps.db.select().from(notifications).where(cond).orderBy(desc(notifications.createdAt)).limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    const [unread] = await deps.db.select({ id: notifications.id }).from(notifications).where(and(eq(notifications.userId, a.userId), isNull(notifications.readAt), notLegacy)).limit(1);
    return c.json({
      items: page.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, createdAt: n.createdAt.toISOString(), readAt: n.readAt?.toISOString() ?? null })),
      nextCursor: rows.length > q.limit ? `${page[page.length - 1]!.createdAt.toISOString()}|${page[page.length - 1]!.id}` : null,
      hasUnread: Boolean(unread),
    });
  });

  r.post('/notifications/read', async (c) => {
    const a = auth(c);
    staffNeeds2fa(a);
    const b = await readJson(c, z.object({ ids: z.array(z.string().uuid()).max(200).optional(), all: z.boolean().optional() }));
    const cond = b.all ? eq(notifications.userId, a.userId) : and(eq(notifications.userId, a.userId), inArray(notifications.id, b.ids ?? []));
    if (b.all || (b.ids && b.ids.length)) await deps.db.update(notifications).set({ readAt: deps.now() }).where(and(cond, isNull(notifications.readAt)));
    return c.body(null, 204);
  });

  // ---------- consents ----------
  r.post('/consents', async (c) => {
    const a = auth(c);
    const b = await readJson(c, z.object({ items: z.array(z.object({ docType: z.enum(LEGAL_DOC_TYPES), version: z.string().max(40) })).min(1).max(10) }));
    for (const it of b.items) {
      const cur = deps.legal.current(it.docType);
      if (cur.version !== it.version) throw E.conflict('Közben frissült a szöveg. Töltsd újra, és olvasd el az új változatot.');
    }
    const now = deps.now();
    const [own] = a.role === 'client' ? await deps.db.select({ id: clients.id }).from(clients).where(eq(clients.userId, a.userId)).limit(1) : [];
    // SPEC §27.11 S4: a client accepts the contract only with a confirmed e-mail and his data form done (the contract
    // PDF is filled with that data and mailed to that address). The ÁSZF/adatkezelés alone may be accepted earlier.
    if (a.role === 'client') {
      if (!a.emailVerified) throw new ApiError(409, 'email_not_verified', 'Előbb erősítsd meg az e-mail-címedet. A kódot a regisztrációkor küldtük el.');
      if (own && b.items.some((x) => x.docType === 'megbizasi_szerzodes') && (await steps(deps.db, own.id)).get('adatok')?.status !== 'kesz')
        throw E.stepLocked('Előbb add meg az adataidat. A szerződésbe ezek kerülnek.');
    }
    for (const it of b.items) {
      const filled = await filledLegalText(deps, it.docType, own?.id ?? null);
      await deps.db.insert(consents).values({ userId: a.userId, docType: it.docType, version: it.version, acceptedAt: now, textSha256: filled.sha256, ipHmac: c.get('ipHmac'), userAgent: c.get('ua') });
      await auditC(c, deps.db, 'consent.accepted', { targetType: 'legal_document', targetId: `${it.docType}@${it.version}`, details: { docType: it.docType, version: it.version } });
    }
    if (a.role === 'client') {
      const [cl] = await deps.db.select().from(clients).where(eq(clients.userId, a.userId)).limit(1);
      if (cl) {
        const need = await consentsNeeded(a.userId, a.role);
        const st = await steps(deps.db, cl.id);
        if (need.length === 0 && st.get('szerzodes')?.status !== 'kesz') {
          await setStep(deps, deps.db, cl.id, 'szerzodes', 'kesz');
          await storeSignedContract(deps, cl.id, a.userId).catch(() => undefined);
          await checkCompletion(deps, deps.db, cl.id);
        }
      }
    }
    return c.body(null, 204);
  });

  // ---------- GDPR ----------
  /** A plain system mail to the signed-in user (no in-app row); a mail problem never fails the request. */
  async function securityMail(to: string, key: string, params: Record<string, string>): Promise<void> {
    if (deps.mailer.mode === 'disabled') return;
    try {
      const p = { brand: brand.name, ...params };
      await deps.mailer.send({ to, subject: await deps.content.render(`email.${key}.subject`, p), text: await deps.content.render(`email.${key}.body`, p), template: key });
    } catch (err) {
      log().warn({ template: key, err: safeErr(err) }, 'security mail failed');
    }
  }

  r.post('/export', async (c) => {
    const a = auth(c);
    // The copy contains everything (also the ID photos and the tax id): a session alone is not enough. It needs a
    // confirmed e-mail and the current password, a 2FA code or a sign-in within the last 10 minutes – the same
    // re-check as the account deletion – and the owner gets a mail about it (round 1, 2026-11-19).
    const b = await readJson(c, z.object({ password: z.string().max(128).optional(), totpCode: z.string().max(10).optional() }));
    if (!a.emailVerified) throw new ApiError(409, 'email_not_verified', 'Előbb erősítsd meg az e-mail-címedet.');
    const hc = deps.limiter.hit(`export-check:${a.userId}`, 10, 15 * 60_000);
    if (!hc.ok) throw E.rateLimited(hc.retryAfterSec);
    const [u] = await deps.db.select().from(users).where(eq(users.id, a.userId)).limit(1);
    if (!u) throw E.unauthenticated();
    let ok = await freshSignIn(deps, a.sessionId);
    if (!ok && u.passwordHash && b.password) {
      ok = await verifyPassword(u.passwordHash, b.password);
      if (!ok) throw E.validation({ password: 'Ez nem a mostani jelszavad.' });
    }
    if (!ok && u.totpSecretEnc && b.totpCode) {
      ok = verifyTotp(base32Decode(deps.data.dec(u.totpSecretEnc, 'users.totp_secret')), b.totpCode.replace(/\D/g, ''), deps.now().getTime()) !== null;
      if (!ok) throw E.validation({ totpCode: 'Ez a kód nem jó.' });
    }
    if (!ok) throw new ApiError(403, 'reauth_required', u.passwordHash ? 'Biztonsági okból add meg a jelszavadat is, vagy lépj ki és be újra, és 10 percen belül kérd a másolatot.' : 'Biztonsági okból lépj ki, majd be újra, és 10 percen belül kérd a másolatot.');
    const h = deps.limiter.hit(`export:${a.userId}`, 3, 24 * 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const [row] = await deps.db.insert(gdprExports).values({ userId: a.userId, status: 'keszul' }).returning({ id: gdprExports.id });
    await auditC(c, deps.db, 'gdpr.export_requested', { targetType: 'gdpr_export', targetId: row!.id });
    await securityMail(a.email, 'export_requested', {});
    return c.json({ exportId: row!.id }, 202);
  });

  r.get('/exports', async (c) => {
    const a = auth(c);
    const rows = await deps.db.select().from(gdprExports).where(eq(gdprExports.userId, a.userId)).orderBy(desc(gdprExports.createdAt)).limit(10);
    const now = deps.now();
    return c.json({
      items: rows.map((x) => ({ id: x.id, status: x.status === 'kesz' && x.expiresAt && x.expiresAt < now ? 'lejart' : x.status === 'folyamatban' ? 'keszul' : x.status, createdAt: x.createdAt.toISOString(), expiresAt: x.expiresAt?.toISOString() ?? null })),
    });
  });

  r.get('/exports/:id/download', async (c) => {
    const a = auth(c);
    const id = param(c, 'id');
    const [x] = await deps.db.select().from(gdprExports).where(and(eq(gdprExports.id, id), eq(gdprExports.userId, a.userId))).limit(1);
    if (!x || x.status !== 'kesz' || !x.fileId || !x.expiresAt || x.expiresAt < deps.now()) throw E.notFound('Ez a másolat már nem tölthető le. Kérj újat.');
    const [f] = await deps.db.select().from(files).where(eq(files.id, x.fileId)).limit(1);
    if (!f) throw E.notFound();
    // Decrypted as a stream: the ZIP can be hundreds of MB and must never sit in the API's memory.
    const src = await deps.storage.readStream(f);
    await auditC(c, deps.db, 'gdpr.export_downloaded', { targetType: 'gdpr_export', targetId: x.id });
    c.header('Content-Type', 'application/zip');
    c.header('Content-Length', String(src.size));
    c.header('Content-Disposition', `attachment; filename="adataim-${x.createdAt.toISOString().slice(0, 10)}.zip"`);
    return stream(c, async (s) => {
      s.onAbort(() => {
        src.stream.destroy();
      });
      for await (const chunk of src.stream) await s.write(chunk as Uint8Array);
    });
  });

  r.post('/delete', async (c) => {
    const a = auth(c);
    const b = await readJson(c, z.object({ password: z.string().max(128).optional(), totpCode: z.string().max(10).optional(), reason: z.string().max(500).optional() }));
    const h = deps.limiter.hit(`delete-check:${a.userId}`, 10, 15 * 60_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const [u] = await deps.db.select().from(users).where(eq(users.id, a.userId)).limit(1);
    if (!u) throw E.unauthenticated();
    if (u.role !== 'client') throw E.forbidden('Könyvelői és admin fiókot az admin tud megszüntetni.');
    let ok = false;
    if (u.passwordHash && b.password) ok = await verifyPassword(u.passwordHash, b.password);
    if (!ok && u.totpSecretEnc && b.totpCode) ok = verifyTotp(base32Decode(deps.data.dec(u.totpSecretEnc, 'users.totp_secret')), b.totpCode, deps.now().getTime()) !== null;
    // Social-only account without 2FA: only a fresh sign-in (≤ 10 min) counts as the re-check.
    if (!ok && !u.passwordHash && !u.totpSecretEnc) {
      if (!(await freshSignIn(deps, a.sessionId))) throw new ApiError(403, 'reauth_required', 'Biztonsági okból lépj ki, majd be újra (Google vagy Apple), és utána kérd a törlést.');
      ok = true;
    }
    if (!ok) throw E.validation({ password: 'A jelszó (vagy a kód) nem jó.' });
    const due = await requestDeletion(deps, u.id);
    await auditC(c, deps.db, 'gdpr.delete_requested', { targetType: 'user', targetId: u.id, details: { reasonGiven: Boolean(b.reason) } });
    // The owner gets it in writing: when the account goes, and that signing in within 30 days undoes it.
    await securityMail(u.email, 'account_deletion_requested', { dueDateText: huFullDateIg(todayBudapest(due)) });
    await revokeAllSessions(deps, deps.db, u.id);
    return c.json({ deletionDueAt: due.toISOString() }, 202);
  });

  r.post('/delete/cancel', async (c) => {
    const a = auth(c);
    await cancelDeletion(deps, a.userId);
    await auditC(c, deps.db, 'gdpr.delete_cancelled', { targetType: 'user', targetId: a.userId });
    return c.body(null, 204);
  });

  return r;
}
