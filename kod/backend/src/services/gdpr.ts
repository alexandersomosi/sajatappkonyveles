// GDPR export and deletion (SPEC §4.8) + retention purge.
import { and, eq, inArray, isNotNull, isNull, lt, lte, or, sql } from 'drizzle-orm';
import type { Deps } from '../deps.js';
import {
  appointments,
  auditLog,
  cardRegistrations,
  certificateRequests,
  clients,
  clientTaxProfiles,
  consents,
  demoOutbox,
  documents,
  documentVersions,
  emailCodes,
  feeInvoices,
  files,
  gdprExports,
  internalNotes,
  kycRecords,
  messageAttachments,
  messages,
  mfaChallenges,
  navInvoices,
  notificationPrefs,
  notifications,
  onboardingSteps,
  paymentTokens,
  pushTokens,
  requests,
  revenueItems,
  sessions,
  signupAttribution,
  subscriptions,
  taxCalculations,
  taxPaymentItems,
  taxPeriods,
  users, businessRegistrations, callbackRequests, annualClosings, taxCorrections, accountReconciliations } from '../db/schema.js';
import { addDays, todayBudapest } from '../lib/dates.js';
import { unlink } from 'node:fs/promises';
import { ZipFileWriter, type ZipEntry } from '../lib/zip.js';
import { log, safeErr } from '../log.js';
import { audit } from '../audit.js';
import { activeAdminEmails, notify, sendTemplateMail } from '../notify/notify.js';
import { huLongDate } from '../_shared/bekotes.js';
import { deleteCard, restoreAfterCancelledDeletion } from './subscription.js';
import { sanitizeDisplayName } from '../lib/validators.js';
import { fullDeclarations } from './kyc.js';

export async function requestDeletion(deps: Deps, userId: string): Promise<Date> {
  const now = deps.now();
  const due = new Date(now.getTime() + 30 * 86_400_000);
  await deps.db.update(users).set({ status: 'pending_deletion', deletionRequestedAt: now, deletionDueAt: due, updatedAt: now }).where(eq(users.id, userId));
  await deps.db.update(pushTokens).set({ disabledAt: now }).where(eq(pushTokens.userId, userId));
  const [cl] = await deps.db.select().from(clients).where(eq(clients.userId, userId)).limit(1);
  if (cl) {
    await deps.db
      .update(subscriptions)
      .set({ status: 'canceled', canceledAt: now, cancelAtPeriodEnd: true, nextChargeAt: null, nextRetryAt: null, updatedAt: now })
      .where(and(eq(subscriptions.clientId, cl.id), sql`${subscriptions.status} <> 'canceled'`));
    try {
      await deleteCard(deps, cl.id, { userId, role: 'client' });
    } catch (err) {
      // The account is closed anyway; tokens are revoked locally, SimplePay is retried by support.
      await deps.db
        .update(paymentTokens)
        .set({ status: 'visszavont' })
        .where(inArray(paymentTokens.cardRegistrationId, deps.db.select({ id: cardRegistrations.id }).from(cardRegistrations).where(eq(cardRegistrations.clientId, cl.id))));
      log().warn({ err: safeErr(err) }, 'card cancel at deletion failed');
    }
  }
  deps.sessionCache.clear();
  return due;
}

export async function cancelDeletion(deps: Deps, userId: string): Promise<void> {
  const res = await deps.db
    .update(users)
    .set({ status: 'active', deletionRequestedAt: null, deletionDueAt: null })
    .where(and(eq(users.id, userId), eq(users.status, 'pending_deletion')))
    .returning({ id: users.id, email: users.email });
  if (!res.length) return;
  const [cl] = await deps.db.select({ id: clients.id }).from(clients).where(eq(clients.userId, userId)).limit(1);
  // The paid period continues as "cancelled at period end"; the home screen shows the end date.
  if (cl) await restoreAfterCancelledDeletion(deps, deps.db, cl.id);
  // k7b (LEVEL_LEFEDETTSEG #60): the owner gets it in writing (only on the real transition above, so once per cancel);
  // the subscription sentence only when a paid period really runs on
  const [sub] = cl ? await deps.db.select({ status: subscriptions.status, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd }).from(subscriptions).where(eq(subscriptions.clientId, cl.id)).limit(1) : [];
  const runsOn = Boolean(sub && sub.status === 'active' && sub.cancelAtPeriodEnd);
  await sendTemplateMail(deps, { to: res[0]!.email, key: 'account_deletion_cancelled', ...(runsOn ? { variant: 'elofizetes' } : {}) });
}

/**
 * k7b (LEVEL_LEFEDETTSEG #63): an export that will not be retried ('hiba') – the client and the admins are told once
 * (the transition to 'hiba' happens once per export row).
 */
async function exportFailedMails(deps: Deps, exportId: string, userId: string): Promise<void> {
  const db = deps.db;
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const [x] = await db.select({ createdAt: gdprExports.createdAt }).from(gdprExports).where(eq(gdprExports.id, exportId)).limit(1);
  if (!u || u.status === 'deleted') return;
  await sendTemplateMail(deps, { to: u.email, key: 'export_failed' });
  const [cl] = await db.select({ firstName: clients.firstName, lastName: clients.lastName }).from(clients).where(eq(clients.userId, userId)).limit(1);
  const name = cl ? `${cl.lastName} ${cl.firstName}`.trim() : u.displayName || 'Egy felhasználó';
  for (const to of await activeAdminEmails(db)) await sendTemplateMail(deps, { to, key: 'export_failed_admin', params: { clientName: name, datum: huLongDate(todayBudapest(x?.createdAt ?? deps.now())) } });
  await audit(db, { action: 'mail.export_failed', actorRole: 'system', targetType: 'gdpr_export', targetId: exportId, details: {} }).catch(() => undefined);
}

function json(name: string, data: unknown): ZipEntry {
  return { name, data: Buffer.from(JSON.stringify(data, null, 2), 'utf8') };
}

/** A build may run this long before it counts as dead (worker killed mid-export). */
const EXPORT_STALE_MS = 15 * 60_000;
/** A dead build is started again once; after that the row becomes 'hiba' and the admin is alerted. */
export const EXPORT_MAX_ATTEMPTS = 2;

/**
 * Builds one export: JSON of the user's data + their files (decrypted), stored encrypted again.
 * Round 1 (2026-11-19): the ZIP is written to a scratch file entry by entry and encrypted as a stream (memory stays
 * around one uploaded file, whatever the size of the dossier); the row is CLAIMED first ('folyamatban' + attempt
 * counter), so a build that kills the worker is not started again every minute.
 */
export async function buildExport(deps: Deps, exportId: string): Promise<void> {
  const db = deps.db;
  const now0 = deps.now();
  // Claim: a fresh row, or a build that died (stale 'folyamatban') and still has an attempt left.
  const [x] = await db
    .update(gdprExports)
    .set({ status: 'folyamatban', attempts: sql`${gdprExports.attempts} + 1`, startedAt: now0 })
    .where(
      and(
        eq(gdprExports.id, exportId),
        lt(gdprExports.attempts, EXPORT_MAX_ATTEMPTS),
        or(eq(gdprExports.status, 'keszul'), and(eq(gdprExports.status, 'folyamatban'), lt(gdprExports.startedAt, new Date(now0.getTime() - EXPORT_STALE_MS)))),
      ),
    )
    .returning();
  if (!x) return;
  let tmpPath: string | null = null;
  let zw: ZipFileWriter | null = null;
  try {
    const [u] = await db.select().from(users).where(eq(users.id, x.userId)).limit(1);
    if (!u) throw new Error('user missing');
    tmpPath = await deps.storage.tmpFile(`export-${x.id}.zip`);
    zw = await ZipFileWriter.create(tmpPath);
    await zw.add({
      name: 'OLVASS_EL.txt',
      data: Buffer.from(
        'Ez a csomag a nálunk tárolt személyes adataid másolata (GDPR 15. és 20. cikk).\nA JSON-fájlok szöveges adatok, a fajlok/ mappában az általad feltöltött és a neked készített iratok vannak.\nKérdés esetén írj az ügyfélszolgálatnak.\n',
        'utf8',
      ),
    });
    const entries: ZipEntry[] = [];
    entries.push(
      json('fiok.json', {
        email: u.email,
        szerep: u.role,
        nev: u.displayName,
        regisztralt: u.createdAt,
        emailMegerositve: u.emailVerifiedAt,
        googleKapcsolat: Boolean(u.googleSub),
        appleKapcsolat: Boolean(u.appleSub),
        ketlepcsos: Boolean(u.totpEnabledAt),
        utolsoBelepes: u.lastLoginAt,
      }),
    );
    entries.push(json('hozzajarulasok.json', await db.select({ dokumentum: consents.docType, verzio: consents.version, elfogadva: consents.acceptedAt, visszavonva: consents.withdrawnAt }).from(consents).where(eq(consents.userId, u.id))));
    entries.push(json('ertesitesek.json', await db.select({ tipus: notifications.kind, cim: notifications.title, szoveg: notifications.body, ido: notifications.createdAt }).from(notifications).where(eq(notifications.userId, u.id))));
    entries.push(json('belepesek.json', await db.select({ eszkoz: sessions.clientKind, bongeszo: sessions.userAgent, letrehozva: sessions.createdAt, utoljara: sessions.lastUsedAt }).from(sessions).where(eq(sessions.userId, u.id))));
    entries.push(json('forras.json', await db.select().from(signupAttribution).where(eq(signupAttribution.userId, u.id))));
    // SPEC §31.3: the sources of the sign-up and of the callback requests
    const mk = await import('./marketing.js');
    entries.push(json('forras_reszletek.json', await mk.touchesOfUser(db, u.id)));
    // SPEC §31.6: the ad-measurement consents and the signals sent about the account (empty while ads are off)
    entries.push(json('hirdetesi_hozzajarulasok.json', await mk.adConsentsOfUser(db, u.id)));
    entries.push(json('hirdetesi_jelzesek.json', await mk.adSignalsOfUser(db, u.id)));
    const [cl] = await db.select().from(clients).where(eq(clients.userId, u.id)).limit(1);
    const fileIds = new Set<string>();
    if (cl) {
      const personal: Record<string, unknown> = {
        nev: `${cl.lastName} ${cl.firstName}`,
        szuletesiNev: cl.birthName,
        telefon: cl.phoneEnc ? deps.data.dec(cl.phoneEnc, 'clients.phone') : null,
        adoazonositoJel: cl.adoazonositoJelEnc ? deps.data.dec(cl.adoazonositoJelEnc, 'clients.adoazonosito_jel') : null,
        adoszam: cl.adoszam,
        evNyilvantartasiSzam: cl.evNyilvantartasiSzam,
        cim: { irsz: cl.addressZip, varos: cl.addressCity, utca: cl.addressLine },
        szekhelyTelepules: cl.hqMunicipality,
        tevekenyseg: cl.activityText,
        teaorOvtj: cl.activityCode,
        vallalkozoOta: cl.evSince,
        korabbiKonyvelo: cl.previousAccountant,
        allapot: cl.lifecycle,
        ajanloKod: cl.personalReferralCode,
      };
      entries.push(json('ugyfel/adataim.json', personal));
      entries.push(json('ugyfel/adoprofil.json', await db.select().from(clientTaxProfiles).where(eq(clientTaxProfiles.clientId, cl.id))));
      entries.push(json('ugyfel/bekotes.json', await db.select().from(onboardingSteps).where(eq(onboardingSteps.clientId, cl.id))));
      const kyc = await db.select().from(kycRecords).where(eq(kycRecords.clientId, cl.id));
      entries.push(
        json(
          'ugyfel/azonositas.json',
          kyc.map((k) => ({ allapot: k.status, adatok: deps.data.decJson(k.dataEnc, `kyc_records:${k.clientId}`), nyilatkozatok: fullDeclarations(deps, k), bekuldve: k.submittedAt })),
        ),
      );
      // Older rows store a missing side as '' – never pass an empty id to the uuid IN (...) query.
      for (const k of kyc) for (const f of Object.values(k.files)) if (typeof f === 'string' && f) fileIds.add(f);
      const docs = await db.select().from(documents).where(and(eq(documents.clientId, cl.id), isNull(documents.deletedAt)));
      entries.push(json('ugyfel/iratok.json', docs.filter((d) => d.visibility === 'kozos').map((d) => ({ id: d.id, cim: d.title, kategoria: d.category, honap: d.dossierMonth, allapot: d.status, megjegyzesem: d.clientNote, konyveloMegjegyzese: d.accountantComment }))));
      const vers = docs.length ? await db.select().from(documentVersions).where(inArray(documentVersions.documentId, docs.filter((d) => d.visibility === 'kozos').map((d) => d.id).concat(['00000000-0000-0000-0000-000000000000']))) : [];
      for (const v of vers) fileIds.add(v.fileId);
      entries.push(json('ugyfel/nav_szamlak.json', await db.select().from(navInvoices).where(eq(navInvoices.clientId, cl.id))));
      entries.push(json('ugyfel/bevetelek.json', await db.select().from(revenueItems).where(and(eq(revenueItems.clientId, cl.id), isNull(revenueItems.deletedAt)))));
      const periods = await db.select().from(taxPeriods).where(eq(taxPeriods.clientId, cl.id));
      const pids = periods.map((p) => p.id).concat(['00000000-0000-0000-0000-000000000000']);
      entries.push(json('ugyfel/adoszamolasok.json', { idoszakok: periods, szamolasok: await db.select().from(taxCalculations).where(inArray(taxCalculations.taxPeriodId, pids)), befizetendok: await db.select().from(taxPaymentItems).where(inArray(taxPaymentItems.taxPeriodId, pids)) }));
      // javító kör 11-21 (SPEC §32.B): the annual closings with their amounts (the refund account stays encrypted / out),
      // the önellenőrzések (without the staff's internal note) and the NAV folyószámla checks
      entries.push(
        json(
          'ugyfel/eves_zarasok.json',
          (await db.select().from(annualClosings).where(eq(annualClosings.clientId, cl.id))).map(({ refundAccountEnc: _r, ...a }) => a),
        ),
      );
      entries.push(json('ugyfel/onellenorzesek.json', (await db.select().from(taxCorrections).where(eq(taxCorrections.clientId, cl.id))).map(({ internalNote: _n, ...x }) => x)));
      entries.push(json('ugyfel/folyoszamla.json', await db.select().from(accountReconciliations).where(eq(accountReconciliations.clientId, cl.id))));
      const msgs = await db.select().from(messages).where(and(eq(messages.clientId, cl.id), isNull(messages.deletedAt)));
      entries.push(json('ugyfel/uzenetek.json', msgs.map((m) => ({ ido: m.createdAt, kuldo: m.senderRole, szoveg: m.body }))));
      const atts = msgs.length ? await db.select().from(messageAttachments).where(inArray(messageAttachments.messageId, msgs.map((m) => m.id))) : [];
      for (const a of atts) fileIds.add(a.fileId);
      const reqs = await db.select().from(requests).where(eq(requests.clientId, cl.id));
      entries.push(json('ugyfel/keresek.json', { keresek: reqs, igazolasok: reqs.length ? await db.select().from(certificateRequests).where(inArray(certificateRequests.requestId, reqs.map((r) => r.id))) : [] }));
      entries.push(json('ugyfel/idopontok.json', (await db.select().from(appointments).where(eq(appointments.clientId, cl.id))).map((a) => ({ kezdete: a.startsAt, csatorna: a.channel, tema: a.topic, allapot: a.status }))));
      // SPEC §26: callback requests (own number decrypted, never the staff's internal notes) and the new-business answers.
      entries.push(
        json(
          'ugyfel/visszahivasok.json',
          (await db.select().from(callbackRequests).where(eq(callbackRequests.clientId, cl.id))).map((x) => ({
            keres: x.createdAt,
            allapot: x.status,
            tema: x.topic,
            idosav: x.callWindow,
            megjegyzesem: x.note,
            telefon: x.phoneEnc ? (() => { try { return deps.data.dec(x.phoneEnc!, 'callback_requests.phone'); } catch { return null; } })() : null,
            kiserletek: x.attempts,
            osszefoglalo: x.summaryForClient,
            lezarva: x.closedAt,
          })),
        ),
      );
      entries.push(json('ugyfel/vallalkozas_bejelentes.json', (await db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, cl.id))).map((x) => ({ allapot: x.status, valaszaim: x.answers, bekuldve: x.filedOn, csatorna: x.filedChannel, adoszam: x.adoszam, nyilvantartasiSzam: x.evNyilvantartasiSzam, javitasiKeres: x.fixNote, letrehozva: x.createdAt }))));
      entries.push(json('ugyfel/elofizetes.json', await db.select().from(subscriptions).where(eq(subscriptions.clientId, cl.id))));
      const fees = await db.select().from(feeInvoices).where(eq(feeInvoices.clientId, cl.id));
      entries.push(json('ugyfel/dijszamlak.json', fees.map((f) => ({ szam: f.number, kelt: f.issuedOn, osszeg: f.amountHuf, demo: f.demo }))));
      for (const f of fees) if (f.pdfFileId) fileIds.add(f.pdfFileId);
      // [JOGI] internal notes are included as "könyvelői jegyzet" (SPEC §5.3).
      entries.push(json('ugyfel/konyveloi_jegyzetek.json', (await db.select().from(internalNotes).where(and(eq(internalNotes.clientId, cl.id), isNull(internalNotes.deletedAt)))).map((n) => ({ ido: n.createdAt, szoveg: n.body }))));
    }
    for (const e of entries) await zw.add(e);
    entries.length = 0;
    const uuids = [...fileIds].filter((x) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(x));
    const skipped: string[] = [];
    // The files one by one (ids in pages of 200): only one decrypted file is in memory at a time.
    for (let i = 0; i < uuids.length; i += 200) {
      const fileRows = await db.select().from(files).where(inArray(files.id, uuids.slice(i, i + 200)));
      for (const f of fileRows) {
        if (f.deletedAt) continue;
        const name = `fajlok/${f.kind}/${f.id.slice(0, 8)}_${sanitizeDisplayName(f.displayName).replace(/\s/g, '_')}`;
        if (!zw.fits(f.sizeBytes)) {
          skipped.push(name);
          continue;
        }
        try {
          const data = await deps.storage.read(f);
          // photos and PDFs are already compressed: store them (no second copy, no CPU)
          await zw.add({ name, data }, { store: f.mime !== 'text/plain' && f.mime !== 'application/json' && f.mime !== 'application/xml' && f.mime !== 'text/xml' });
        } catch (err) {
          log().warn({ fileId: f.id, err: safeErr(err) }, 'export: file unreadable');
        }
      }
    }
    if (skipped.length) {
      // classic ZIP limit (≈ 3,8 GB): say honestly what is missing and how to get it
      await zw.add({
        name: 'KIMARADT_FAJLOK.txt',
        data: Buffer.from(`Ez a csomag elérte a legnagyobb méretet, ezért ${skipped.length} fájl kimaradt belőle.\nÍrj az ügyfélszolgálatnak, és külön elküldjük őket.\n\n${skipped.slice(0, 5000).join('\n')}\n`, 'utf8'),
      }).catch(() => undefined);
      await audit(db, { action: 'gdpr.export_truncated', actorRole: 'system', targetType: 'gdpr_export', targetId: x.id, clientId: cl?.id ?? null, details: { skipped: skipped.length } });
    }
    await zw.finish();
    zw = null;
    const f = await deps.storage.putFromFile(db, { ownerClientId: cl?.id ?? null, kind: 'gdpr_export', mime: 'application/zip', displayName: 'adataim.zip', sourcePath: tmpPath, now: deps.now() });
    const expiresAt = new Date(deps.now().getTime() + 24 * 3600_000);
    await db.update(gdprExports).set({ status: 'kesz', fileId: f.id, expiresAt, error: null }).where(eq(gdprExports.id, x.id));
    await notify(deps, db, { userId: u.id, kind: 'gdpr_export_ready', link: '/fiok/adataim' });
  } catch (err) {
    log().error({ err: safeErr(err) }, 'gdpr export failed');
    const failed = await db
      .update(gdprExports)
      .set({ status: 'hiba', error: String((err as Error)?.message ?? err).slice(0, 200) })
      .where(and(eq(gdprExports.id, x.id), sql`${gdprExports.status} <> 'hiba'`))
      .returning({ id: gdprExports.id });
    await audit(db, { action: 'gdpr.export_failed', actorRole: 'system', targetType: 'gdpr_export', targetId: x.id, details: { attempts: x.attempts } }).catch(() => undefined);
    if (failed.length) await exportFailedMails(deps, x.id, x.userId).catch((e2: Error) => log().warn({ err: safeErr(e2) }, 'export failure mail failed'));
  } finally {
    if (zw) await zw.abort();
    if (tmpPath) await unlink(tmpPath).catch(() => undefined);
  }
}

/**
 * After 30 days: everything not under legal retention is deleted, the user row is pseudonymised,
 * retained records (tax, KYC, fee invoices, messages) move to legal hold until their retention date.
 */
export async function executeDeletion(deps: Deps, userId: string): Promise<void> {
  const db = deps.db;
  const now = deps.now();
  const today = todayBudapest(now);
  const year = Number(today.slice(0, 4));
  // k7b (LEVEL_LEFEDETTSEG #61): the real address is read BEFORE the pseudonymisation below; the mail goes once the
  // deletion has really happened (after the commit), so a failed run never says "töröltük".
  let deletedAddress: string | null = null;
  await db.transaction(async (tx) => {
    const [u] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!u || u.status !== 'pending_deletion') return;
    deletedAddress = u.email;
    const [cl] = await tx.select().from(clients).where(eq(clients.userId, userId)).limit(1);
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(mfaChallenges).where(eq(mfaChallenges.userId, userId));
    await tx.delete(pushTokens).where(eq(pushTokens.userId, userId));
    await tx.delete(notifications).where(eq(notifications.userId, userId));
    await tx.delete(notificationPrefs).where(eq(notificationPrefs.userId, userId));
    await tx.delete(emailCodes).where(eq(emailCodes.email, u.email));
    const exportsRows = await tx.select().from(gdprExports).where(eq(gdprExports.userId, userId));
    for (const e of exportsRows) {
      if (e.fileId) {
        const [f] = await tx.select().from(files).where(eq(files.id, e.fileId)).limit(1);
        if (f) {
          await deps.storage.purgeBlob(f);
          await tx.update(files).set({ deletedAt: now }).where(eq(files.id, f.id));
        }
      }
    }
    await tx.delete(gdprExports).where(eq(gdprExports.userId, userId));
    await tx.delete(signupAttribution).where(eq(signupAttribution.userId, userId));
    if (cl) {
      // Tax-law retention (Art. 202. §): 5 years after the end of the year the last return was due → end of year+6.
      const taxUntil = `${year + 6}-12-31`;
      const kycUntil = addDays(today, 8 * 365 + 2);
      await tx.update(files).set({ legalHold: true, retentionUntil: taxUntil }).where(and(eq(files.ownerClientId, cl.id), isNull(files.deletedAt), sql`${files.kind} not in ('kyc','dijszamla')`));
      await tx.update(files).set({ legalHold: true, retentionUntil: kycUntil }).where(and(eq(files.ownerClientId, cl.id), isNull(files.deletedAt), sql`${files.kind} in ('kyc','dijszamla')`));
      await tx.update(kycRecords).set({ relationshipEndedAt: now, retentionUntil: kycUntil }).where(eq(kycRecords.clientId, cl.id));
      await tx.update(appointments).set({ phoneEnc: null }).where(eq(appointments.clientId, cl.id));
      // Callback numbers and free texts go with the account (SPEC §26.12 retention is [JOGI]; the call log stays).
      await tx.update(callbackRequests).set({ phoneEnc: null, phoneMasked: null, note: null, needsNewPhone: false }).where(eq(callbackRequests.clientId, cl.id));
      // SPEC §29.9.6: the same anonymisation as the owner console's erasure (identity data gone, legal records kept)
      const { anonymizeClientCore } = await import('./anonimizalas.js');
      await anonymizeClientCore(deps, tx, cl.id);
    }
    await tx
      .update(users)
      .set({
        status: 'deleted',
        email: `torolt+${userId}@deleted.invalid`,
        passwordHash: null,
        googleSub: null,
        appleSub: null,
        totpSecretEnc: null,
        totpPendingEnc: null,
        recoveryCodes: null,
        displayName: 'Törölt felhasználó',
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
    await audit(tx, { action: 'gdpr.delete_executed', actorRole: 'system', targetType: 'user', targetId: userId, clientId: cl?.id ?? null });
  });
  if (deletedAddress) await sendTemplateMail(deps, { to: deletedAddress, key: 'account_deleted' });
}

/** Every worker tick (≈ every minute): pending data exports, so "export, then delete" works the same hour. */
export async function runGdprExports(deps: Deps): Promise<number> {
  const db = deps.db;
  const stale = new Date(deps.now().getTime() - EXPORT_STALE_MS);
  // A build that died twice (e.g. the worker was killed while building) is closed as 'hiba': never a crash loop.
  const dead = await db
    .update(gdprExports)
    .set({ status: 'hiba', error: 'A készítés kétszer megszakadt.' })
    .where(and(eq(gdprExports.status, 'folyamatban'), lt(gdprExports.startedAt, stale), sql`${gdprExports.attempts} >= ${EXPORT_MAX_ATTEMPTS}`))
    .returning({ id: gdprExports.id, userId: gdprExports.userId });
  for (const d of dead) {
    log().error({ exportId: d.id }, 'gdpr export gave up after repeated failures – admin alert');
    await audit(db, { action: 'gdpr.export_failed', actorRole: 'system', targetType: 'gdpr_export', targetId: d.id, details: { gaveUp: true } }).catch(() => undefined);
    await exportFailedMails(deps, d.id, d.userId).catch((err: Error) => log().warn({ err: safeErr(err) }, 'export failure mail failed'));
  }
  const pending = await db
    .select({ id: gdprExports.id })
    .from(gdprExports)
    .where(or(eq(gdprExports.status, 'keszul'), and(eq(gdprExports.status, 'folyamatban'), lt(gdprExports.startedAt, stale))))
    .limit(5);
  for (const p of pending) await buildExport(deps, p.id);
  return pending.length;
}

/** Daily 03:30 (SPEC §15): leftover exports, due deletions, expiry purges, retention purge. */
export async function runGdprJob(deps: Deps): Promise<Record<string, number>> {
  const db = deps.db;
  const now = deps.now();
  const out = { exports: 0, deletions: 0, expiredExports: 0, purgedFiles: 0, purgedRows: 0, callbacksWiped: 0 };
  out.exports = await runGdprExports(deps);
  // Callback data (number, notes, summary) one year after closing (adatkezelési tájékoztató 2.8 draft, [JOGI]): the
  // row and its call log stay (statistics), the personal data go. The summary message follows the message retention.
  const wiped = await db
    .update(callbackRequests)
    .set({ phoneEnc: null, phoneMasked: null, note: null, internalNote: null, summaryForClient: null, needsNewPhone: false })
    .where(and(isNotNull(callbackRequests.closedAt), lt(callbackRequests.closedAt, new Date(now.getTime() - 365 * 86_400_000)), or(isNotNull(callbackRequests.phoneEnc), isNotNull(callbackRequests.note), isNotNull(callbackRequests.internalNote))))
    .returning({ id: callbackRequests.id });
  out.callbacksWiped = wiped.length;
  const due = await db.select({ id: users.id }).from(users).where(and(eq(users.status, 'pending_deletion'), lte(users.deletionDueAt, now)));
  for (const d of due) {
    await executeDeletion(deps, d.id);
    out.deletions++;
  }
  const expired = await db.select().from(gdprExports).where(and(eq(gdprExports.status, 'kesz'), lt(gdprExports.expiresAt, now)));
  for (const e of expired) {
    if (e.fileId) {
      const [f] = await db.select().from(files).where(eq(files.id, e.fileId)).limit(1);
      if (f) {
        await deps.storage.purgeBlob(f);
        await db.update(files).set({ deletedAt: now }).where(eq(files.id, f.id));
      }
    }
    await db.update(gdprExports).set({ status: 'lejart' }).where(eq(gdprExports.id, e.id));
    out.expiredExports++;
  }
  const d90 = new Date(now.getTime() - 90 * 86_400_000);
  const d7 = new Date(now.getTime() - 7 * 86_400_000);
  out.purgedRows += (await db.delete(sessions).where(or(lt(sessions.expiresAt, d90), and(isNotNull(sessions.revokedAt), lt(sessions.revokedAt, d90)))).returning({ id: sessions.id })).length;
  out.purgedRows += (await db.delete(emailCodes).where(lt(emailCodes.createdAt, d90)).returning({ id: emailCodes.id })).length;
  out.purgedRows += (await db.delete(mfaChallenges).where(lt(mfaChallenges.expiresAt, new Date(now.getTime() - 86_400_000))).returning({ jti: mfaChallenges.jti })).length;
  out.purgedRows += (await db.delete(demoOutbox).where(lt(demoOutbox.createdAt, d7)).returning({ id: demoOutbox.id })).length;
  // Files past their retention date (legal hold ended).
  const today = todayBudapest(now);
  const old = await db.select().from(files).where(and(isNull(files.deletedAt), lt(files.retentionUntil, today))).limit(500);
  for (const f of old) {
    await deps.storage.purgeBlob(f);
    await db.update(files).set({ deletedAt: now }).where(eq(files.id, f.id));
    out.purgedFiles++;
  }
  // Audit log older than 5 years (only this job may delete from it).
  const auditCut = new Date(now);
  auditCut.setUTCFullYear(auditCut.getUTCFullYear() - 5);
  await db.transaction(async (tx) => {
    // SECURITY DEFINER function (migration 0006): the app role itself has no DELETE on audit_log.
    const res = await tx.execute(sql`select kezjegy_audit_purge(${auditCut.toISOString()}::timestamptz) as n`);
    const rows = (res as unknown as { rows?: { n: number }[] }).rows ?? (res as unknown as { n: number }[]);
    out.purgedRows += Number(rows[0]?.n ?? 0);
  });
  return out;
}
