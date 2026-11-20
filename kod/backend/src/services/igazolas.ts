// SPEC §29.5 F1 – "Igazolást kérek". The client asks, the accountant files IGAZOL/KOMA at NAV with his OWN
// meghatalmazott access (we never log in anywhere), uploads the original PDF, the client downloads it.
// Storage: requests (direction 'ugyfeltol', type 'igazolas') + certificate_requests (+ the §29 columns) + certificate_events
// (the timeline). Fees per type in fee_settings (igazolas_*; 0 Ft by default) → a fee_charges row (purpose igazolas)
// created through the payment contract (§29.1.15); while unpaid the status is 'dijra_var'.
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  CERT_FEE_KIND,
  CERT_FORM_TEXTS,
  CERT_NOTIFICATION_TEXTS,
  CERT_OPEN_STATUSES,
  CERT_PANEL_TEXTS,
  CERT_PURPOSE_LABELS,
  CERT_RULES,
  CERT_STATUS_LABELS,
  CERT_STATUS_TEXTS,
  CERT_SZECHENYI_USER,
  CERT_TYPE_TEXTS,
  CERT_VALIDATION,
  CERTIFICATE_TYPES_K29,
  KOMA_OUTCOME_TEXTS,
  LEGACY_CERTIFICATE_TYPE_MAP,
  type AccCertificateDetail,
  type AccCertificateRow,
  type CertificateFormView,
  type CertificateRequestInput,
  type CertificateTypeK29,
  type CertificateView,
  type CertPurposeKind,
  type CertStatus,
  type KomaOutcome,
} from '../_shared/k29f.js';
import { fillPlaceholders } from '../_shared/bekotes.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, annualClosings, certificateEvents, certificateRequests, clients, documents, documentVersions, feeCharges, files, kycRecords, requests, users } from '../db/schema.js';
import { audit } from '../audit.js';
import { addDays, budapestLocalToUtc, daysBetween, huFullDate, isIsoDate, monthKeyOf, MONTHS_HU, todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { accountantParams, notify } from '../notify/notify.js';
import { accountantUserOf, type StaffActor } from './team.js';
import { clientName, type ClientRow } from './people.js';
import { assertFeature } from './access.js';
import { lockedError } from './zarolas.js';
import { createFeeChargeK29, feeSetting, registerFeePurposeHandler } from './dijak.js';
import { computeFlags } from './flags.js';

export type CertRow = typeof certificateRequests.$inferSelect;
type ReqRow = typeof requests.$inferSelect;

const fmt = (n: number) => new Intl.NumberFormat('hu-HU').format(n).replace(/ /g, ' ');

/** The §29 type of a row (legacy values mapped). */
export function certTypeOf(row: Pick<CertRow, 'certificateType'>): CertificateTypeK29 {
  return LEGACY_CERTIFICATE_TYPE_MAP[row.certificateType as string] ?? 'egyeb';
}
/** The §29 status of a row; legacy rows (status default 'beerkezett') are derived from the request. */
export function certStatusOf(row: CertRow, req: Pick<ReqRow, 'status'>): CertStatus {
  const s = (row as { status?: string }).status as CertStatus | undefined;
  if (s && s !== 'beerkezett') return s;
  if (req.status === 'teljesitve') return 'kesz';
  if (req.status === 'elutasitva') return 'elutasitva';
  if (req.status === 'visszavonva') return 'visszavonva';
  if (row.submittedToNavAt) return 'navnal';
  return s ?? 'beerkezett';
}
const REQUEST_STATUS_OF: Record<CertStatus, ReqRow['status']> = {
  dijra_var: 'nyitott',
  beerkezett: 'nyitott',
  navnal: 'folyamatban',
  kesz: 'teljesitve',
  elutasitva: 'elutasitva',
  visszavonva: 'visszavonva',
};

/** "2026. október" style month name for the KOMA entry text. */
function monthWord(mk: string): string {
  const m = Number(mk.slice(5, 7));
  return `${mk.slice(0, 4)}. ${MONTHS_HU[m - 1] ?? ''}`;
}

/** Years with a filed SZJA return (§29.5: no jövedelemigazolás for a year without a return). */
export async function certificateYears(deps: Deps, db: DbOrTx, clientId: string): Promise<CertificateFormView['years']> {
  const today = todayBudapest(deps.now());
  const cur = Number(today.slice(0, 4));
  const filed = await db
    .select({ year: annualClosings.taxYear })
    .from(annualClosings)
    .where(and(eq(annualClosings.clientId, clientId), inArray(annualClosings.status, ['beadva', 'kesz'])));
  const filedYears = new Set(filed.map((f) => f.year));
  const out: CertificateFormView['years'] = [];
  for (const y of [cur, cur - 1, cur - 2, cur - 3]) {
    if (y === cur) {
      out.push({ year: y, ok: false, reason: CERT_FORM_TEXTS.yearCurrent });
      continue;
    }
    // the return of year y is due on 20 May of y+1; after that we assume it was filed (by us or the earlier accountant)
    const deadlinePassed = today > `${y + 1}-05-20`;
    if (filedYears.has(y) || deadlinePassed) out.push({ year: y, ok: true, reason: null });
    else out.push({ year: y, ok: false, reason: fillPlaceholders(CERT_FORM_TEXTS.yearNotFiled, { ev: String(y), hatarido: `${y + 1}. május 20.` }) });
  }
  return out;
}

async function feesByType(db: DbOrTx): Promise<Record<CertificateTypeK29, number>> {
  const out = {} as Record<CertificateTypeK29, number>;
  for (const t of CERTIFICATE_TYPES_K29) {
    try {
      out[t] = (await feeSetting(db, CERT_FEE_KIND[t] as never)).amountHuf;
    } catch {
      out[t] = 0;
    }
  }
  return out;
}

export async function certificateFormView(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<CertificateFormView> {
  const p = await accountantParams(db, cl.accountantId);
  let locked: string | null = null;
  try {
    await assertFeature(deps, db, cl, 'igazolas_keres');
  } catch (e) {
    locked = (e as Error).message || CERT_FORM_TEXTS.locked;
  }
  if (!locked && cl.serviceLock) locked = (await lockedError(deps, cl)).message;
  return { years: await certificateYears(deps, db, cl.id), fees: await feesByType(db), firstName: String(p.firstName), hasAddress: Boolean(cl.addressZip && cl.addressCity && cl.addressLine), locked };
}

/** Validates the client's answers; returns the clean values. Throws 400 with field messages. */
export async function validateCertificateInput(deps: Deps, db: DbOrTx, clientId: string, b: CertificateRequestInput): Promise<Required<Pick<CertificateRequestInput, 'type' | 'purposeKind'>> & CertificateRequestInput & { purposeLabel: string }> {
  const f: Record<string, string> = {};
  const today = todayBudapest(deps.now());
  if (!CERTIFICATE_TYPES_K29.includes(b.type)) f.type = CERT_VALIDATION.type;
  if (!b.purposeKind || !(b.purposeKind in CERT_PURPOSE_LABELS)) f.purposeKind = CERT_VALIDATION.purpose;
  const purposeText = b.purposeText?.trim() ?? '';
  if (b.purposeKind === 'mas' && !purposeText) f.purposeText = CERT_VALIDATION.purposeText;
  if (purposeText.length > CERT_RULES.purposeTextMax) f.purposeText = `Legfeljebb ${CERT_RULES.purposeTextMax} karakter.`;
  let userName = b.userName?.trim() ?? '';
  if (!userName && b.purposeKind === 'szechenyi') userName = CERT_SZECHENYI_USER;
  if ((b.type === 'jovedelemigazolas' || b.type === 'adoigazolas') && !userName) f.userName = CERT_VALIDATION.userName;
  if (userName.length > CERT_RULES.userNameMax) f.userName = `Legfeljebb ${CERT_RULES.userNameMax} karakter.`;
  if (b.type === 'jovedelemigazolas') {
    if (!b.year || !Number.isInteger(b.year)) f.year = CERT_VALIDATION.year;
    else {
      const ys = await certificateYears(deps, db, clientId);
      const y = ys.find((x) => x.year === b.year);
      if (!y) f.year = CERT_VALIDATION.year;
      else if (!y.ok) f.year = y.reason ?? CERT_VALIDATION.yearCurrent;
    }
  }
  if (b.type === 'adoigazolas' && !b.extended) f.extended = CERT_VALIDATION.extended;
  if (b.type === 'ev_kivonat' && !b.official) f.official = CERT_VALIDATION.official;
  const otherText = b.otherText?.trim() ?? '';
  if (b.type === 'egyeb' && otherText.length < 3) f.otherText = CERT_VALIDATION.otherText;
  if (otherText.length > CERT_RULES.otherTextMax) f.otherText = `Legfeljebb ${CERT_RULES.otherTextMax} karakter.`;
  if (b.neededBy) {
    if (!isIsoDate(b.neededBy)) f.neededBy = CERT_VALIDATION.neededByPast;
    else if (b.neededBy < today) f.neededBy = CERT_VALIDATION.neededByPast;
    else if (b.neededBy > addDays(today, CERT_RULES.neededByMaxDays)) f.neededBy = CERT_VALIDATION.neededByFar;
  }
  const paperAddress = b.paperAddress?.trim() ?? '';
  if (b.paperCopy && b.paperTo === 'felhasznalo' && paperAddress.length < 5) f.paperAddress = CERT_VALIDATION.paperAddress;
  if (paperAddress.length > CERT_RULES.paperAddressMax) f.paperAddress = `Legfeljebb ${CERT_RULES.paperAddressMax} karakter.`;
  if (Object.keys(f).length) throw E.validation(f);
  const purposeLabel = b.purposeKind === 'mas' ? purposeText : CERT_PURPOSE_LABELS[b.purposeKind];
  return {
    ...b,
    type: b.type,
    purposeKind: b.purposeKind,
    purposeText: purposeText || undefined,
    userName: userName || undefined,
    otherText: otherText || undefined,
    paperAddress: paperAddress || undefined,
    purposeLabel,
  };
}

async function addEvent(db: DbOrTx, requestId: string, status: CertStatus, at: Date, by: string | null, note: string | null = null): Promise<void> {
  await db.insert(certificateEvents).values({ requestId, status, at, by, note });
}

/** POST /client/certificates – requests row + certificate_requests row + first event (+ fee charge) in one transaction. */
export async function createCertificateRequest(deps: Deps, cl: ClientRow, input: CertificateRequestInput, ctx: { userId: string; ipHmac?: string | null; requestId?: string | null }): Promise<CertificateView> {
  await assertFeature(deps, deps.db, cl, 'igazolas_keres');
  if (cl.serviceLock) throw await lockedError(deps, cl);
  const h = deps.limiter.hit(`cert:${cl.id}`, CERT_RULES.perDay, 86_400_000);
  if (!h.ok) throw E.rateLimited(h.retryAfterSec, 'Ma már sok igazolást kértél. Holnap újra kérhetsz.');
  const b = await validateCertificateInput(deps, deps.db, cl.id, input);
  const now = deps.now();
  const t = CERT_TYPE_TEXTS[b.type];
  const title = b.type === 'jovedelemigazolas' && b.year ? `${t.label} ${b.year}` : t.label;
  const fee = (await feesByType(deps.db))[b.type];
  const row = await deps.db.transaction(async (tx) => {
    const [rq] = await tx
      .insert(requests)
      .values({ clientId: cl.id, direction: 'ugyfeltol', type: 'igazolas', title, body: b.otherText ?? `Mire kell: ${b.purposeLabel}`, status: 'nyitott', createdBy: ctx.userId, createdAt: now, updatedAt: now })
      .returning();
    let charge: { id: string } | null = null;
    if (fee > 0) {
      charge = await createFeeChargeK29(deps, tx, { clientId: cl.id, kind: CERT_FEE_KIND[b.type] as never, purpose: { type: 'igazolas', requestId: rq!.id } as never, by: ctx.userId });
    }
    const status: CertStatus = charge ? 'dijra_var' : 'beerkezett';
    await tx.insert(certificateRequests).values({
      requestId: rq!.id,
      certificateType: b.type as never,
      year: b.type === 'jovedelemigazolas' ? (b.year ?? null) : null,
      purpose: b.purposeLabel.slice(0, 200),
      language: 'hu',
      status,
      userName: b.userName ?? null,
      purposeKind: b.purposeKind,
      purposeText: b.purposeText ?? null,
      neededBy: b.neededBy ?? null,
      paperCopy: Boolean(b.paperCopy),
      paperTo: b.paperCopy ? (b.paperTo === 'felhasznalo' ? 'felhasznalo' : 'lakcim') : null,
      paperAddress: b.paperCopy && b.paperTo === 'felhasznalo' ? (b.paperAddress ?? null) : null,
      extended: b.type === 'adoigazolas' ? (b.extended ?? null) : null,
      official: b.type === 'ev_kivonat' ? (b.official ?? null) : null,
      englishRequested: Boolean(b.englishRequested),
      otherText: b.otherText ?? null,
      feeChargeId: charge?.id ?? null,
      createdAt: now,
    });
    await addEvent(tx, rq!.id, status, now, ctx.userId);
    await audit(tx, { action: 'certificate.requested', actorUserId: ctx.userId, actorRole: 'client', targetType: 'request', targetId: rq!.id, clientId: cl.id, ipHmac: ctx.ipHmac ?? null, requestId: ctx.requestId ?? null, details: { type: b.type, year: b.year ?? null, fee, purposeKind: b.purposeKind } });
    return rq!;
  });
  if (fee <= 0) await notifyAccountantOfCertificate(deps, cl, row.id, b.type, b.purposeLabel);
  await computeFlags(deps, deps.db, cl.id).catch(() => undefined);
  return certificateViewById(deps, deps.db, cl, row.id);
}

async function notifyAccountantOfCertificate(deps: Deps, cl: ClientRow, requestId: string, type: CertificateTypeK29, purposeLabel: string): Promise<void> {
  const acc = await accountantUserOf(deps.db, cl);
  if (!acc) return;
  await notify(deps, deps.db, {
    userId: acc.userId,
    kind: 'certificate_requested' as never,
    params: { clientName: clientName(cl), tipus: CERT_TYPE_TEXTS[type].label, cel: purposeLabel },
    link: `/igazolasok/${requestId}`,
    data: { requestId, clientId: cl.id },
  });
}

/** Called by the payment flow (runPurpose, purpose 'igazolas') when the fee is paid: dijra_var → beerkezett. */
export async function onCertificateFeePaid(deps: Deps, requestId: string): Promise<void> {
  const [row] = await deps.db.select().from(certificateRequests).where(eq(certificateRequests.requestId, requestId)).limit(1);
  if (!row || row.status !== 'dijra_var') return;
  const now = deps.now();
  const upd = await deps.db
    .update(certificateRequests)
    .set({ status: 'beerkezett' })
    .where(and(eq(certificateRequests.requestId, requestId), sql`status = 'dijra_var'`))
    .returning();
  if (!upd.length) return;
  await addEvent(deps.db, requestId, 'beerkezett', now, null, 'díj kifizetve');
  const [rq] = await deps.db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  const [cl] = rq ? await deps.db.select().from(clients).where(eq(clients.id, rq.clientId)).limit(1) : [];
  if (cl) await notifyAccountantOfCertificate(deps, cl, requestId, certTypeOf(row), row.purpose);
}

async function rowsFor(db: DbOrTx, where: ReturnType<typeof and> | ReturnType<typeof eq>) {
  return db.select({ r: requests, c: certificateRequests }).from(certificateRequests).innerJoin(requests, eq(requests.id, certificateRequests.requestId)).where(where);
}

async function timelineOf(db: DbOrTx, requestId: string) {
  return db.select().from(certificateEvents).where(eq(certificateEvents.requestId, requestId)).orderBy(asc(certificateEvents.at));
}

function komaOfRow(c: CertRow): { outcome: KomaOutcome; date: string | null } | null {
  if (!c.komaOutcome) return null;
  const outcome = c.komaOutcome as KomaOutcome;
  // felvetel_kerve stores the 10th of the entry month
  return { outcome, date: c.komaDate ? (outcome === 'felvetel_kerve' ? c.komaDate.slice(0, 7) : c.komaDate) : null };
}

function statusText(status: CertStatus, p: { firstName: string; datum?: string; ok?: string; osszeg?: number; koma?: { outcome: KomaOutcome; date: string | null } | null }): string {
  if (status === 'kesz' && p.koma) {
    const t = KOMA_OUTCOME_TEXTS[p.koma.outcome];
    const d = p.koma.date ?? '';
    return fillPlaceholders(t, { datum: d.length === 10 ? huFullDate(d) : '', honap: d.length >= 7 ? monthWord(d.slice(0, 7)) : '' });
  }
  return fillPlaceholders(CERT_STATUS_TEXTS[status], { firstName: p.firstName, datum: p.datum ?? '', ok: p.ok ?? '', osszeg: p.osszeg !== undefined ? fmt(p.osszeg) : '' });
}

export async function certificateView(deps: Deps, db: DbOrTx, cl: ClientRow, r: ReqRow, c: CertRow, firstName?: string): Promise<CertificateView> {
  const fn = firstName ?? String((await accountantParams(db, cl.accountantId)).firstName);
  const type = certTypeOf(c);
  const status = certStatusOf(c, r);
  const ev = await timelineOf(db, r.id);
  const x = c as CertRow & Record<string, unknown>;
  const feeChargeId = (x.feeChargeId as string | null) ?? null;
  const [charge] = feeChargeId ? await db.select().from(feeCharges).where(eq(feeCharges.id, feeChargeId)).limit(1) : [];
  const navEv = [...ev].reverse().find((e) => e.status === 'navnal');
  const koma = type === 'koma' ? komaOfRow(c) : null;
  const submittedAt = navEv?.at ?? c.submittedToNavAt ?? null;
  const today = todayBudapest(deps.now());
  const neededBy = (x.neededBy as string | null) ?? null;
  const textFor = (s: CertStatus, at: Date | null) =>
    statusText(s, { firstName: fn, datum: at ? huFullDate(todayBudapest(at)) : '', ok: (x.rejectedReason as string | null) ?? r.statusNote ?? '', osszeg: charge?.amountHuf ?? 0, koma });
  const timeline = ev.length
    ? ev.map((e) => ({ status: e.status as CertStatus, at: e.at.toISOString(), text: textFor(e.status as CertStatus, e.status === 'navnal' ? e.at : null) }))
    : [{ status, at: r.createdAt.toISOString(), text: textFor(status, submittedAt) }];
  const resultDocumentId = r.resultDocumentId ?? c.documentId ?? null;
  return {
    id: r.id,
    type,
    typeLabel: CERT_TYPE_TEXTS[type].label,
    title: r.title,
    status,
    statusLabel: CERT_STATUS_LABELS[status],
    statusText: textFor(status, submittedAt),
    year: c.year ?? null,
    purposeKind: ((x.purposeKind as CertPurposeKind | null) ?? null),
    purposeLabel: c.purpose,
    userName: (x.userName as string | null) ?? null,
    neededBy,
    neededByWarn: Boolean(neededBy && CERT_OPEN_STATUSES.includes(status) && daysBetween(today, neededBy) < CERT_RULES.warnDays),
    paperCopy: Boolean(x.paperCopy),
    englishRequested: Boolean(x.englishRequested) || c.language === 'en',
    feeHuf: charge?.amountHuf ?? 0,
    feeChargeId,
    canPay: status === 'dijra_var' && charge?.status === 'nyitott',
    canCancel: status === 'dijra_var' || status === 'beerkezett',
    resultDocumentId: status === 'kesz' ? resultDocumentId : null,
    komaOutcome: koma?.outcome ?? null,
    rejectedReason: status === 'elutasitva' ? ((x.rejectedReason as string | null) ?? r.statusNote ?? null) : null,
    timeline,
    createdAt: r.createdAt.toISOString(),
    doneAt: (x.doneAt as Date | null)?.toISOString?.() ?? r.completedAt?.toISOString() ?? null,
  };
}

export async function certificateViewById(deps: Deps, db: DbOrTx, cl: ClientRow, id: string): Promise<CertificateView> {
  const [row] = await rowsFor(db, and(eq(requests.id, id), eq(requests.clientId, cl.id)));
  if (!row) throw E.notFound();
  return certificateView(deps, db, cl, row.r, row.c);
}

export async function clientCertificates(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<CertificateView[]> {
  const rows = await db
    .select({ r: requests, c: certificateRequests })
    .from(certificateRequests)
    .innerJoin(requests, eq(requests.id, certificateRequests.requestId))
    .where(eq(requests.clientId, cl.id))
    .orderBy(desc(requests.createdAt));
  const fn = String((await accountantParams(db, cl.accountantId)).firstName);
  const out: CertificateView[] = [];
  for (const x of rows) out.push(await certificateView(deps, db, cl, x.r, x.c, fn));
  return out;
}

/** Sets the certificate status + the mirrored request status + an event, conditionally (409 on a race). */
async function moveStatus(deps: Deps, db: DbOrTx, r: ReqRow, c: CertRow, from: CertStatus[], to: CertStatus, by: string | null, extra: Record<string, unknown> = {}, note: string | null = null): Promise<void> {
  const cur = certStatusOf(c, r);
  if (!from.includes(cur)) throw E.conflict('Ez az igazolás-kérés közben megváltozott. Frissítsd az oldalt.');
  const now = deps.now();
  const done = to === 'kesz' || to === 'elutasitva' || to === 'visszavonva';
  await db
    .update(certificateRequests)
    .set({ status: to, ...(done ? { doneAt: now } : {}), ...extra })
    .where(eq(certificateRequests.requestId, r.id));
  const [u] = await db
    .update(requests)
    .set({ status: REQUEST_STATUS_OF[to], updatedAt: now, ...(done ? { completedAt: now, completedBy: by } : {}) })
    .where(and(eq(requests.id, r.id), inArray(requests.status, ['nyitott', 'folyamatban'])))
    .returning({ id: requests.id });
  if (!u) throw E.conflict('Ez az igazolás-kérés közben lezárult. Frissítsd az oldalt.');
  await addEvent(db, r.id, to, now, by, note);
}

/** POST /client/certificates/:id/cancel – only before the accountant filed it (dijra_var / beerkezett). */
export async function cancelCertificate(deps: Deps, cl: ClientRow, id: string, userId: string): Promise<CertificateView> {
  const [row] = await rowsFor(deps.db, and(eq(requests.id, id), eq(requests.clientId, cl.id)));
  if (!row) throw E.notFound();
  await deps.db.transaction(async (tx) => {
    await moveStatus(deps, tx, row.r, row.c, ['dijra_var', 'beerkezett'], 'visszavonva', userId);
    const chargeId = (row.c as Record<string, unknown>).feeChargeId as string | null;
    if (chargeId) await tx.update(feeCharges).set({ status: 'visszavonva' }).where(and(eq(feeCharges.id, chargeId), eq(feeCharges.status, 'nyitott')));
    await audit(tx, { action: 'certificate.cancelled', actorUserId: userId, actorRole: 'client', targetType: 'request', targetId: id, clientId: cl.id });
  });
  return certificateViewById(deps, deps.db, cl, id);
}

// ---------------------------------------------------------------------------------------------------------------------
// panel (accountant: own clients; admin: all)
// ---------------------------------------------------------------------------------------------------------------------
async function staffRowOrThrow(db: DbOrTx, actor: StaffActor, id: string) {
  const [row] = await db
    .select({ r: requests, c: certificateRequests, cl: clients })
    .from(certificateRequests)
    .innerJoin(requests, eq(requests.id, certificateRequests.requestId))
    .innerJoin(clients, eq(clients.id, requests.clientId))
    .where(eq(requests.id, id))
    .limit(1);
  if (!row) throw E.notFound();
  if (actor.role !== 'admin' && row.cl.accountantId !== actor.accountantId) throw E.notFound();
  return row;
}

function rowView(deps: Deps, r: ReqRow, c: CertRow, cl: ClientRow, accName: string | null, submittedAt: Date | null): AccCertificateRow {
  const type = certTypeOf(c);
  const status = certStatusOf(c, r);
  const today = todayBudapest(deps.now());
  const x = c as CertRow & Record<string, unknown>;
  const sub = submittedAt ?? c.submittedToNavAt ?? null;
  return {
    id: r.id,
    clientId: cl.id,
    clientName: clientName(cl),
    accountantName: accName,
    type,
    typeLabel: CERT_TYPE_TEXTS[type].label,
    purposeLabel: c.purpose,
    userName: (x.userName as string | null) ?? null,
    year: c.year ?? null,
    neededBy: (x.neededBy as string | null) ?? null,
    status,
    statusLabel: CERT_STATUS_LABELS[status],
    ageDays: Math.max(0, daysBetween(todayBudapest(r.createdAt), today)),
    overdue: status === 'navnal' && Boolean(sub) && daysBetween(todayBudapest(sub!), today) > CERT_RULES.navDays,
    createdAt: r.createdAt.toISOString(),
    submittedAt: sub?.toISOString() ?? null,
  };
}

/** GET /acc/certificates?status=open|all|<status> */
export async function accCertificateRows(deps: Deps, db: DbOrTx, actor: StaffActor, filter: string = 'open'): Promise<AccCertificateRow[]> {
  const conds = [] as ReturnType<typeof eq>[];
  if (actor.role !== 'admin') {
    if (!actor.accountantId) return [];
    conds.push(eq(clients.accountantId, actor.accountantId));
  }
  const rows = await db
    .select({ r: requests, c: certificateRequests, cl: clients, accName: accountants.displayName })
    .from(certificateRequests)
    .innerJoin(requests, eq(requests.id, certificateRequests.requestId))
    .innerJoin(clients, eq(clients.id, requests.clientId))
    .leftJoin(accountants, eq(accountants.id, clients.accountantId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(requests.createdAt))
    .limit(500);
  const ids = rows.map((x) => x.r.id);
  const navEvents = ids.length ? await db.select().from(certificateEvents).where(and(inArray(certificateEvents.requestId, ids), eq(certificateEvents.status, 'navnal'))) : [];
  const navAt = new Map<string, Date>();
  for (const e of navEvents) if (!navAt.has(e.requestId) || navAt.get(e.requestId)! < e.at) navAt.set(e.requestId, e.at);
  const out = rows.map((x) => rowView(deps, x.r, x.c, x.cl, x.accName ?? null, navAt.get(x.r.id) ?? null));
  const keep = (s: CertStatus) => (filter === 'all' ? true : filter === 'open' ? CERT_OPEN_STATUSES.includes(s) : s === filter);
  // overdue first, then the oldest open
  return out.filter((x) => keep(x.status)).sort((a, b) => Number(b.overdue) - Number(a.overdue) || (filter === 'open' ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
}

function maskTaxId(v: string | null): string | null {
  if (!v) return null;
  return `•••••••${v.slice(-3)}`;
}

export async function accCertificateDetail(deps: Deps, db: DbOrTx, actor: StaffActor, id: string): Promise<AccCertificateDetail> {
  const { r, c, cl } = await staffRowOrThrow(db, actor, id);
  const [acc] = cl.accountantId ? await db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  const ev = await timelineOf(db, r.id);
  const navEv = [...ev].reverse().find((e) => e.status === 'navnal');
  const base = rowView(deps, r, c, cl, acc?.displayName ?? null, navEv?.at ?? null);
  const x = c as CertRow & Record<string, unknown>;
  const [kyc] = await db.select().from(kycRecords).where(eq(kycRecords.clientId, cl.id)).orderBy(desc(kycRecords.submittedAt)).limit(1);
  let kd: Record<string, string> = {};
  try {
    kd = kyc ? deps.data.decJson<Record<string, string>>(kyc.dataEnc, `kyc_records:${cl.id}`) : {};
  } catch {
    kd = {};
  }
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, cl.userId)).limit(1);
  const paperTo = c.paperTo ?? null;
  const paperAddress = c.paperAddress ?? (paperTo && paperTo !== 'lakcim' && paperTo !== 'felhasznalo' ? paperTo : null);
  const address = [cl.addressZip, cl.addressCity, cl.addressLine].filter(Boolean).join(' ') || kd.address || null;
  const chargeId = (x.feeChargeId as string | null) ?? null;
  const [charge] = chargeId ? await db.select().from(feeCharges).where(eq(feeCharges.id, chargeId)).limit(1) : [];
  const koma = base.type === 'koma' ? komaOfRow(c) : null;
  const names = new Map<string, string>();
  for (const e of ev) if (e.by && !names.has(e.by)) {
    const [uu] = await db.select({ n: users.displayName }).from(users).where(eq(users.id, e.by)).limit(1);
    names.set(e.by, uu?.n ?? '');
  }
  const fn = acc?.firstName ?? 'A könyvelő';
  return {
    ...base,
    client: {
      name: clientName(cl),
      birthName: cl.birthName ?? kd.birthName ?? null,
      birth: kd.birthPlace || kd.birthDate ? `${kd.birthPlace ?? ''}${kd.birthPlace && kd.birthDate ? ', ' : ''}${kd.birthDate ? huFullDate(kd.birthDate) : ''}` : null,
      motherName: kd.motherBirthName ?? null,
      adoazonositoMasked: cl.adoazonositoLast3 ? `•••••••${cl.adoazonositoLast3}` : cl.adoazonositoJelEnc ? maskTaxId('xxx') : null,
      adoszam: cl.adoszam ?? null,
      address,
      email: u?.email ?? null,
    },
    purposeText: c.purposeText ?? c.purpose,
    extended: base.type === 'adoigazolas' ? ((c.extended as AccCertificateDetail['extended']) ?? null) : null,
    official: base.type === 'ev_kivonat' ? ((c.official as AccCertificateDetail['official']) ?? null) : null,
    englishRequested: Boolean(x.englishRequested) || c.language === 'en',
    otherText: (x.otherText as string | null) ?? null,
    paperCopy: Boolean(x.paperCopy),
    paperTo: c.paperCopy ? (paperTo === 'lakcim' ? 'lakcim' : 'felhasznalo') : null,
    paperAddress: c.paperCopy ? paperAddress : null,
    delivery: c.paperCopy ? fillPlaceholders(CERT_PANEL_TEXTS.deliveryPaper, { cim: paperTo === 'lakcim' ? (address ?? 'lakcím') : (paperAddress ?? '') }) : CERT_PANEL_TEXTS.deliveryElectronic,
    copies: c.copies ?? 1,
    iktatoszam: c.iktatoszam ?? navEv?.note ?? null,
    feeHuf: charge?.amountHuf ?? 0,
    feeStatus: charge ? charge.status : null,
    komaOutcome: koma?.outcome ?? null,
    komaDate: koma?.date ?? null,
    rejectedReason: (x.rejectedReason as string | null) ?? null,
    resultDocumentId: r.resultDocumentId ?? c.documentId ?? null,
    timeline: ev.map((e) => ({
      status: e.status as CertStatus,
      at: e.at.toISOString(),
      // staff wording: the status label (+ the KOMA outcome / the reason), not the client's sentence
      text:
        e.status === 'kesz' && koma
          ? `${CERT_STATUS_LABELS.kesz} – ${statusText('kesz', { firstName: fn, koma })}`
          : e.status === 'elutasitva'
            ? `${CERT_STATUS_LABELS.elutasitva}: ${(x.rejectedReason as string | null) ?? ''}`
            : e.status === 'beerkezett' && e.note
              ? `${CERT_STATUS_LABELS.beerkezett} (${e.note})`
              : CERT_STATUS_LABELS[e.status as CertStatus] ?? e.status,
      by: e.by ? (names.get(e.by) || null) : null,
      note: e.status === 'beerkezett' ? null : (e.note ?? null),
    })),
    requestId: r.id,
  };
}

/** Accountant reveal of the adóazonosító jel (audited). */
export async function revealCertificateTaxId(deps: Deps, actor: StaffActor, id: string): Promise<string> {
  const { cl } = await staffRowOrThrow(deps.db, actor, id);
  if (!cl.adoazonositoJelEnc) throw E.notFound('Az ügyfél még nem adta meg az adóazonosító jelét.');
  const v = deps.data.dec(cl.adoazonositoJelEnc, 'clients.adoazonosito_jel');
  await audit(deps.db, { action: 'certificate.taxid_revealed', actorUserId: actor.userId, actorRole: actor.role, targetType: 'request', targetId: id, clientId: cl.id });
  return v;
}

async function notifyClientStatus(deps: Deps, cl: ClientRow, requestId: string, variant: 'navnal' | 'kesz' | 'elutasitva', type: CertificateTypeK29, ok = ''): Promise<void> {
  const p = await accountantParams(deps.db, cl.accountantId);
  await notify(deps, deps.db, {
    userId: cl.userId,
    kind: 'certificate_status' as never,
    variant,
    params: { ...p, tipus: CERT_TYPE_TEXTS[type].label, ok },
    link: `/igazolas/${requestId}`,
    data: { requestId },
    ...(variant === 'kesz' ? {} : { noEmail: true }),
  });
}

/** "Beadtam a NAV-nak" → navnal. */
export async function certificateSubmitted(deps: Deps, actor: StaffActor, id: string, b: { date: string; iktatoszam?: string }): Promise<AccCertificateDetail> {
  const today = todayBudapest(deps.now());
  if (!isIsoDate(b.date) || b.date > today || b.date < addDays(today, -60)) throw E.validation({ date: 'Adj meg egy napot az elmúlt 60 napból.' });
  const iktato = b.iktatoszam?.trim().slice(0, CERT_RULES.iktatoszamMax) || null;
  const { r, c, cl } = await staffRowOrThrow(deps.db, actor, id);
  await deps.db.transaction(async (tx) => {
    await moveStatus(deps, tx, r, c, ['beerkezett'], 'navnal', actor.userId, { submittedToNavAt: budapestLocalToUtc(b.date, '12:00'), iktatoszam: iktato }, iktato);
    // the event carries the filing day (not "now")
    await tx.execute(sql`update certificate_events set at = ${budapestLocalToUtc(b.date, '12:00')} where request_id = ${r.id} and status = 'navnal' and at >= ${deps.now()}`);
    await audit(tx, { action: 'certificate.submitted', actorUserId: actor.userId, actorRole: actor.role, targetType: 'request', targetId: id, clientId: cl.id, details: { date: b.date } });
  });
  await notifyClientStatus(deps, cl, id, 'navnal', certTypeOf(c));
  return accCertificateDetail(deps, deps.db, actor, id);
}

/** "Feltöltöm az igazolást" → kesz. The PDF was uploaded first with POST /acc/clients/:id/documents (category igazolas);
 *  here we check it is this client's, an unchanged PDF ≤ 15 MB, and bind it. KOMA may finish without a file. */
export async function certificateResult(
  deps: Deps,
  actor: StaffActor,
  id: string,
  b: { documentId?: string | null; komaOutcome?: KomaOutcome; komaDate?: string; komaMonth?: string },
): Promise<AccCertificateDetail> {
  const { r, c, cl } = await staffRowOrThrow(deps.db, actor, id);
  const type = certTypeOf(c);
  const note: string | null = null;
  const komaSet: Record<string, unknown> = {};
  if (type === 'koma') {
    if (!b.komaOutcome) throw E.validation({ komaOutcome: 'Válaszd ki az eredményt.' });
    if (b.komaOutcome === 'benne_van') {
      if (!b.komaDate || !isIsoDate(b.komaDate) || b.komaDate > todayBudapest(deps.now())) throw E.validation({ komaDate: 'Add meg, mióta szerepel.' });
      Object.assign(komaSet, { komaOutcome: 'benne_van', komaDate: b.komaDate });
    } else if (b.komaOutcome === 'felvetel_kerve') {
      if (!b.komaMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(b.komaMonth)) throw E.validation({ komaMonth: 'Add meg a hónapot.' });
      Object.assign(komaSet, { komaOutcome: 'felvetel_kerve', komaDate: `${b.komaMonth}-10` });
    } else Object.assign(komaSet, { komaOutcome: 'igazolas', komaDate: null });
  }
  const needsFile = type !== 'koma' || b.komaOutcome === 'igazolas';
  let docId: string | null = null;
  if (b.documentId) {
    const [d] = await deps.db.select().from(documents).where(and(eq(documents.id, b.documentId), eq(documents.clientId, cl.id))).limit(1);
    if (!d || d.category !== 'igazolas') throw E.validation({ documentId: 'Ezt az iratot nem találjuk az ügyfél igazolásai között.' });
    const [v] = d.currentVersionId ? await deps.db.select({ fileId: documentVersions.fileId }).from(documentVersions).where(eq(documentVersions.id, d.currentVersionId)).limit(1) : [];
    const [f] = v ? await deps.db.select().from(files).where(eq(files.id, v.fileId)).limit(1) : [];
    if (!f || f.mime !== 'application/pdf') throw E.unsupported('Csak az eredeti PDF tölthető fel (az elektronikus irat csak így hiteles).');
    if (Number(f.sizeBytes ?? 0) > CERT_RULES.resultPdfMaxBytes) throw E.tooLarge('Legfeljebb 15 MB lehet.');
    docId = d.id;
  } else if (needsFile) throw E.validation({ documentId: 'Töltsd fel az igazolás PDF-jét.' });
  await deps.db.transaction(async (tx) => {
    await moveStatus(deps, tx, r, c, ['beerkezett', 'navnal'], 'kesz', actor.userId, { ...(docId ? { documentId: docId } : {}), ...komaSet }, note);
    if (docId) await tx.update(requests).set({ resultDocumentId: docId }).where(eq(requests.id, r.id));
    await audit(tx, { action: 'certificate.done', actorUserId: actor.userId, actorRole: actor.role, targetType: 'request', targetId: id, clientId: cl.id, details: { documentId: docId, koma: b.komaOutcome ?? null } });
  });
  await notifyClientStatus(deps, cl, id, 'kesz', type);
  await computeFlags(deps, deps.db, cl.id).catch(() => undefined);
  return accCertificateDetail(deps, deps.db, actor, id);
}

/** "Nem adható ki" → elutasitva (reason required, ≤ 300). An unpaid fee is withdrawn; a paid one goes to refund-needed. */
export async function certificateReject(deps: Deps, actor: StaffActor, id: string, reason: string): Promise<AccCertificateDetail> {
  const ok = reason.trim();
  if (ok.length < 3) throw E.validation({ reason: 'Írd le röviden, miért nem.' });
  if (ok.length > CERT_RULES.rejectReasonMax) throw E.validation({ reason: `Legfeljebb ${CERT_RULES.rejectReasonMax} karakter.` });
  const { r, c, cl } = await staffRowOrThrow(deps.db, actor, id);
  await deps.db.transaction(async (tx) => {
    await moveStatus(deps, tx, r, c, ['dijra_var', 'beerkezett', 'navnal'], 'elutasitva', actor.userId, { rejectedReason: ok }, null);
    await tx.update(requests).set({ statusNote: ok }).where(eq(requests.id, r.id));
    const chargeId = (c as Record<string, unknown>).feeChargeId as string | null;
    if (chargeId) {
      await tx.update(feeCharges).set({ status: 'visszavonva' }).where(and(eq(feeCharges.id, chargeId), eq(feeCharges.status, 'nyitott')));
      await tx.update(feeCharges).set({ status: 'visszaterites_kell' }).where(and(eq(feeCharges.id, chargeId), eq(feeCharges.status, 'fizetve')));
    }
    await audit(tx, { action: 'certificate.rejected', actorUserId: actor.userId, actorRole: actor.role, targetType: 'request', targetId: id, clientId: cl.id });
  });
  await notifyClientStatus(deps, cl, id, 'elutasitva', certTypeOf(c), ok);
  return accCertificateDetail(deps, deps.db, actor, id);
}

/** Number of open certificate requests at the accountant (console overview). */
export async function openCertificateCount(db: DbOrTx, accountantId: string | null): Promise<{ n: number; oldest: Date | null }> {
  const rows = await db
    .select({ createdAt: requests.createdAt, status: requests.status })
    .from(certificateRequests)
    .innerJoin(requests, eq(requests.id, certificateRequests.requestId))
    .innerJoin(clients, eq(clients.id, requests.clientId))
    .where(and(accountantId ? eq(clients.accountantId, accountantId) : undefined, inArray(requests.status, ['nyitott', 'folyamatban'])));
  const oldest = rows.reduce<Date | null>((m, x) => (!m || x.createdAt < m ? x.createdAt : m), null);
  return { n: rows.length, oldest };
}

// SPEC §29.1.15: a paid certificate fee moves the request on (dijra_var → beerkezett) and tells the accountant.
registerFeePurposeHandler('igazolas', async (deps, _cl, ch) => {
  const p = ch.purpose as { type: string; requestId?: string };
  if (p.requestId) await onCertificateFeePaid(deps, p.requestId);
});

export { CERT_NOTIFICATION_TEXTS, monthKeyOf };
