// SPEC §28.K.3 – annual closing (the 26SZJA / '26KATA + the HIPA return) with its own fee, charged when the client sends
// the in-app questionnaire. Statuses: nem_indult → kerdoiv → dijra_var → konyvelonel → jovahagyasra_var → beadva → kesz.
// The app never files: the accountant files as meghatalmazott and uploads the NAV confirmation. The refund bank account
// is stored encrypted and masked in every client view.
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { AccAnnualView, AnnualAnswers, AnnualView } from '../_shared/api.js';
import { ANNUAL_CHECK_LABELS } from '../_shared/bekotes.js';
import { ANNUAL_CHECK_ITEMS, ANNUAL_HIPA_PLACES, ANNUAL_RULES, OTHER_INCOME_KINDS, type AnnualCheckItem, type AnnualStatus } from '../_shared/enums.js';
import { EV_RULES } from '../_shared/eves.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { annualClosings, clients, clientTaxProfiles, documents } from '../db/schema.js';
import { audit } from '../audit.js';
import { huDayMonthIg, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { accountantParams, notify } from '../notify/notify.js';
import { listItems } from './documents.js';
import { chargeById, createFeeCharge, feeChargeView, feeSetting } from './dijak.js';
import { accountantUserOf, staffRefs } from './team.js';
import { clientName, type ClientRow } from './people.js';
import { fmt } from './kedvezmeny.js';
import { evesKapcsolok } from './kata.js';
import { annualExtras, annualStaffExtras, approvalDueOf, approvalHashFor, buildSummary, draftOf, evesText, fileAnnual, fileAnnualHipa, type AnnualFilingInput } from './eves-ciklus.js';

export type AnnualRow = typeof annualClosings.$inferSelect;
const AAD = 'annual_closings.refund_account';

export const annualErr = { wrongStatus: (m = 'Ez most nem lehetséges ebben az állapotban.') => new ApiError(409, 'annual_wrong_status', m) };

export const annualAnswersSchema = z.strictObject({
  otherIncomes: z.array(z.enum(OTHER_INCOME_KINDS)).max(8).optional(),
  otherIncomeNote: z.string().trim().max(500).nullish(),
  allowancesOk: z.boolean().nullish(),
  hipaPlace: z.enum(ANNUAL_HIPA_PLACES).nullish(),
  hipaOtherTowns: z.array(z.object({ town: z.string().trim().min(1).max(60), days: z.number().int().min(0).max(366) })).max(20).optional(),
  municipalityLetter: z.boolean().nullish(),
  onePercent: z.object({ civilAdoszam: z.string().trim().max(13).nullable(), egyhazTechnikaiSzam: z.string().trim().max(10).nullable() }).nullish(),
  refundAccount: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => v === '' || /^\d{16}(\d{8})?$/.test(v), { error: 'Bankszámlaszám: 16 vagy 24 számjegy.' })
    .nullish(),
  missingDocuments: z.boolean().nullish(),
  message: z.string().trim().max(ANNUAL_RULES.messageMaxChars).nullish(),
  /** View-only (GET returns it); accepted and ignored so a client that echoes the view back is not refused (k6c). */
  refundAccountMasked: z.string().max(40).nullish(),
});

export function questionnaireDue(year: number, regime: 'atalany' | 'kata'): string {
  return `${year + 1}-${ANNUAL_RULES.questionnaireDue[regime]}`;
}

const mask = (acc: string) => (acc.length >= 8 ? `${acc.slice(0, 3)}…${acc.slice(-4)}` : '…');

async function view(deps: Deps, db: DbOrTx, cl: ClientRow, r: AnnualRow): Promise<AnnualView> {
  const params = await accountantParams(db, cl.accountantId);
  const ch = await chargeById(db, r.feeChargeId);
  const fee = await feeSetting(db, 'eves_zaras');
  // SPEC §32: the 14 999 Ft fee is switched off until the ÁSZF is fixed [T1, JOGI] (EVES_KAPCSOLOK.evesZarasDij)
  const feeOn = (await evesKapcsolok(db)).evesZarasDij;
  const answers = (r.answers ?? null) as AnnualAnswers | null;
  let refundMasked: string | null = null;
  if (r.refundAccountEnc) {
    try {
      refundMasked = mask(deps.data.dec(r.refundAccountEnc, AAD));
    } catch {
      refundMasked = '…';
    }
  }
  // javító kör 11-21: the draft the closing was sent with (never a later quarterly 'bevallas' document), not deleted
  const draft = r.status === 'jovahagyasra_var' ? await draftOf(db, cl.id, r) : null;
  const draftDto = draft ? (await listItems(db, [draft], { firstName: String(params.firstName), staff: false }))[0] ?? null : null;
  const y = r.taxYear;
  const approvedWaiting = r.status === 'jovahagyasra_var' && Boolean(r.approvedAt);
  const extras = await annualExtras(deps, db, cl, r);
  // the status line follows what the client really sees: approved → "Jóváhagytad…"; filed → the difference / refund line
  const statusText = approvedWaiting
    ? await evesText(deps, r.regime === 'kata' ? 'allapotJovahagyvaKata' : 'allapotJovahagyva', params)
    : r.status === 'beadva' && extras.settlement?.text
      ? extras.settlement.text
      : await deps.content.render(`eves.allapot.${r.status}`, { ...params, hatarido: huDayMonthIg(r.questionnaireDue), dij: fmt(ch?.amountHuf ?? fee.amountHuf) });
  return {
    id: r.id,
    year: y,
    regime: r.regime,
    status: r.status,
    statusText,
    questionnaireDue: r.questionnaireDue,
    legalDue: { szja: r.regime === 'atalany' ? `${y + 1}-${ANNUAL_RULES.legalDue.szja}` : null, kata: r.regime === 'kata' ? `${y + 1}-${ANNUAL_RULES.legalDue.kata}` : null, hipa: `${y + 1}-${ANNUAL_RULES.legalDue.hipa}` },
    answers: answers ? { ...answers, refundAccount: undefined, refundAccountMasked: refundMasked } : null,
    feeCharge: ch ? await feeChargeView(deps, db, ch) : null,
    draft: draftDto,
    approval: r.approvedAt && r.approvalHash ? { at: r.approvedAt.toISOString(), hash: r.approvalHash } : null,
    nextAction: r.status === 'kerdoiv' ? 'kitoltes' : r.status === 'dijra_var' ? 'fizetes' : r.status === 'jovahagyasra_var' && !approvedWaiting ? 'jovahagyas' : null,
    canEdit: r.status === 'kerdoiv' && !cl.serviceLock,
    feeHuf: feeOn ? fee.amountHuf : null,
    // SPEC §32.B: the numbers to approve (+ hash), the settlement after filing, the timeline, the HIPA, the önellenőrzések
    ...extras,
  };
}

export async function annualOf(db: DbOrTx, clientId: string, year: number): Promise<AnnualRow | null> {
  const [r] = await db.select().from(annualClosings).where(and(eq(annualClosings.clientId, clientId), eq(annualClosings.taxYear, year))).limit(1);
  return r ?? null;
}

/** GET /client/annual?year= – creates the 'nem_indult' row lazily so the card can say when it opens. */
/** The year whose closing the client sees by default: last year if he had a tax profile then, else this year. */
export async function defaultAnnualYear(db: DbOrTx, clientId: string, thisYear: number): Promise<number> {
  const [tp] = await db.select({ id: clientTaxProfiles.id }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, thisYear - 1))).limit(1);
  return tp ? thisYear - 1 : thisYear;
}

export async function annualView(deps: Deps, db: DbOrTx, cl: ClientRow, year: number): Promise<AnnualView> {
  let r = await annualOf(db, cl.id, year);
  if (!r) {
    const [tp] = await db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
    const regime = tp?.regime ?? 'atalany';
    const [ins] = await db.insert(annualClosings).values({ clientId: cl.id, taxYear: year, regime, status: 'nem_indult', questionnaireDue: questionnaireDue(year, regime), createdAt: deps.now(), updatedAt: deps.now() }).onConflictDoNothing().returning();
    r = ins ?? (await annualOf(db, cl.id, year))!;
  }
  return view(deps, db, cl, r);
}

async function own(db: DbOrTx, cl: ClientRow, id: string): Promise<AnnualRow> {
  const [r] = await db.select().from(annualClosings).where(and(eq(annualClosings.id, id), eq(annualClosings.clientId, cl.id))).limit(1).for('update');
  if (!r) throw E.notFound();
  return r;
}

export async function saveAnnualAnswers(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, a: z.infer<typeof annualAnswersSchema>, userId: string): Promise<AnnualView> {
  const r = await own(db, cl, id);
  if (r.status !== 'kerdoiv') throw annualErr.wrongStatus();
  const { refundAccount, refundAccountMasked: _viewOnly, ...rest } = a;
  const merged = { ...((r.answers ?? {}) as Partial<AnnualAnswers>), ...rest };
  const enc = refundAccount === undefined ? r.refundAccountEnc : refundAccount ? deps.data.enc(refundAccount, AAD) : null;
  const [u] = await db.update(annualClosings).set({ answers: merged, refundAccountEnc: enc, updatedAt: deps.now() }).where(eq(annualClosings.id, r.id)).returning();
  await audit(db, { action: 'annual.answers_saved', actorUserId: userId, actorRole: 'client', targetType: 'annual_closing', targetId: r.id, clientId: cl.id });
  return view(deps, db, cl, u!);
}

/** POST /client/annual/:id/submit – the fee charge (→ dijra_var), or straight to the accountant when the fee is 0. */
export async function submitAnnual(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, userId: string): Promise<AnnualView> {
  const r = await own(db, cl, id);
  if (r.status !== 'kerdoiv') throw annualErr.wrongStatus();
  const now = deps.now();
  // SPEC §32: no annual-closing fee while the switch is off (the ÁSZF says the yearly return is in the monthly fee) [T1, JOGI]
  const feeOn = (await evesKapcsolok(db)).evesZarasDij;
  const charge = feeOn ? await createFeeCharge(deps, db, cl, 'eves_zaras', { type: 'eves_zaras', annualId: r.id }, userId) : null;
  const status: AnnualStatus = charge ? 'dijra_var' : 'konyvelonel';
  const [u] = await db.update(annualClosings).set({ status, submittedAt: now, feeChargeId: charge?.id ?? null, updatedAt: now }).where(eq(annualClosings.id, r.id)).returning();
  await audit(db, { action: 'annual.submitted', actorUserId: userId, actorRole: 'client', targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { fee: Boolean(charge) } });
  const acc = await accountantUserOf(db, cl);
  if (acc) await notify(deps, db, { userId: acc.userId, kind: 'annual_submitted', params: { clientName: clientName(cl), feeState: charge ? 'fizetésre vár' : 'nincs díj' }, link: `/ugyfelek/${cl.id}?tab=eves-zaras` });
  return view(deps, db, cl, u!);
}

export function draftHash(docId: string, sha: string | null): string {
  return createHash('sha256').update(`${docId}:${sha ?? ''}`).digest('hex');
}

/** POST /client/annual/:id/approve { hash } – the client approves the draft return. */
export async function approveAnnual(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, hash: string, ctx: { userId: string; ipHmac: string; ua: string }): Promise<AnnualView> {
  const r = await own(db, cl, id);
  if (r.status !== 'jovahagyasra_var') throw annualErr.wrongStatus();
  const draft = await draftOf(db, cl.id, r);
  if (!draft) throw annualErr.wrongStatus('Még nincs feltöltött tervezet.');
  // a second tap on "Jóváhagyom" (the same hash) changes nothing
  if (r.approvedAt && r.approvalHash === hash) return view(deps, db, cl, r);
  // SPEC §32.B: the hash covers the draft AND the numbers the accountant entered (older closings: the draft only)
  const expect = r.amounts ? approvalHashFor(draft.id, r) : draftHash(draft.id, null);
  if (hash !== expect) throw new ApiError(409, 'assist_consent_stale', 'A tervezet változott. Nyisd meg újra, és nézd át.');
  const now = deps.now();
  const checklist = { ...(r.checklist ?? {}), ugyfel_jovahagyta: { at: now.toISOString(), by: ctx.userId } };
  const approvedSummary = r.amounts ? await buildSummary(deps, db, cl, r) : null;
  const [u] = await db.update(annualClosings).set({ approvedAt: now, approvalHash: hash, checklist, approvedSummary, updatedAt: now }).where(eq(annualClosings.id, r.id)).returning();
  await audit(db, { action: 'annual.approved', actorUserId: ctx.userId, actorRole: 'client', targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { ipHmac: ctx.ipHmac.slice(0, 12), withNumbers: Boolean(r.amounts) } });
  const acc = await accountantUserOf(db, cl);
  if (acc)
    await notify(deps, db, { userId: acc.userId, kind: 'tax_task', variant: 'eves_jovahagyva', params: { clientName: clientName(cl), form: r.regime === 'kata' ? `'${String(r.taxYear).slice(2)}KATA` : `${String(r.taxYear).slice(2)}SZJA` }, link: `/ugyfelek/${cl.id}/eves`, data: { clientId: cl.id } });
  return view(deps, db, cl, u!);
}

// ---------------------------------------------------------------------------------------------------------------------
// staff
// ---------------------------------------------------------------------------------------------------------------------
export async function accAnnualView(deps: Deps, db: DbOrTx, cl: ClientRow, year: number, revealRefund: boolean, actor: { userId: string; role: string }): Promise<AccAnnualView> {
  const base = await annualView(deps, db, cl, year);
  const r = (await annualOf(db, cl.id, year))!;
  const refs = await staffRefs(db, Object.values(r.checklist ?? {}).map((x) => x.by));
  const docs = await db.select().from(documents).where(and(eq(documents.clientId, cl.id), inArray(documents.category, ['bevallas', 'nav_visszaigazolas']))).orderBy(desc(documents.createdAt));
  let refund: string | null = null;
  if (revealRefund && r.refundAccountEnc) {
    try {
      refund = deps.data.dec(r.refundAccountEnc, AAD);
      await audit(db, { action: 'annual.refund_viewed', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id });
    } catch {
      refund = null;
    }
  }
  const items = ANNUAL_CHECK_ITEMS.filter((i) => (r.regime === 'kata' ? i !== 'szja_beadva' : i !== 'kata_beadva'));
  return {
    ...base,
    checklist: items.map((item) => ({ item, label: ANNUAL_CHECK_LABELS[item], done: Boolean(r.checklist?.[item]), doneAt: r.checklist?.[item]?.at ?? null, by: r.checklist?.[item] ? (refs.get(r.checklist[item]!.by) ?? null) : null })),
    documents: await listItems(db, docs.slice(0, 30), { firstName: '', staff: true }),
    refundAccount: refund,
    // SPEC §32.B: the amounts form, the engine comparison, the warnings, the manual open of a former client
    ...(await annualStaffExtras(deps, db, cl, r)),
  };
}

export async function annualCheck(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, item: AnnualCheckItem, done: boolean, actor: { userId: string; role: string }): Promise<void> {
  const [r] = await db.select().from(annualClosings).where(and(eq(annualClosings.id, id), eq(annualClosings.clientId, cl.id))).limit(1);
  if (!r) throw E.notFound();
  const cl2 = { ...(r.checklist ?? {}) };
  if (done) cl2[item] = { at: deps.now().toISOString(), by: actor.userId };
  else delete cl2[item];
  await db.update(annualClosings).set({ checklist: cl2, updatedAt: deps.now() }).where(eq(annualClosings.id, r.id));
  await audit(db, { action: 'annual.check', actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id, details: { item, done } });
}

/**
 * Status steps the panel buttons drive (the document upload happens in the route). SPEC §32.B: the draft goes to the
 * client only with the amounts saved and "Az összegek egyeznek a bevallás tervezetével" ticked; the filings are in
 * services/eves-ciklus.ts (iktatószám, the two documents, the difference / refund, the HIPA difference).
 */
export async function annualStep(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, step: 'draft' | 'filed-szja' | 'filed-hipa', actor: { userId: string; role: string }, filing?: AnnualFilingInput & { accountNumber?: string | null; draftDocumentId?: string | null }): Promise<AnnualRow> {
  if (step === 'filed-szja') return fileAnnual(deps, db, cl, id, filing ?? { filedOn: todayBudapest(deps.now()) }, actor);
  if (step === 'filed-hipa') return fileAnnualHipa(deps, db, cl, id, filing ?? { filedOn: todayBudapest(deps.now()) }, actor);
  const [r] = await db.select().from(annualClosings).where(and(eq(annualClosings.id, id), eq(annualClosings.clientId, cl.id))).limit(1);
  if (!r) throw E.notFound();
  const now = deps.now();
  const params = await accountantParams(db, cl.accountantId);
  if (r.status !== 'konyvelonel' && r.status !== 'jovahagyasra_var') throw annualErr.wrongStatus();
  if (!r.amounts) throw annualErr.wrongStatus('Előbb rögzítsd az összegeket az Összegek kártyán: az ügyfél ezeket hagyja jóvá.');
  if (!r.amounts.matchesDraft) throw annualErr.wrongStatus('Jelöld be: „Az összegek egyeznek a bevallás tervezetével.”');
  const checklist: NonNullable<AnnualRow['checklist']> = { ...(r.checklist ?? {}), tervezet_feltoltve: { at: now.toISOString(), by: actor.userId } };
  delete checklist.ugyfel_jovahagyta; // a new draft needs a new approval
  const patch: Partial<AnnualRow> = { status: 'jovahagyasra_var', approvedAt: null, approvalHash: null, approvedSummary: null, checklist, ...(filing?.draftDocumentId ? { draftDocumentId: filing.draftDocumentId } : {}) };
  const [u] = await db.update(annualClosings).set({ ...patch, updatedAt: now }).where(eq(annualClosings.id, r.id)).returning();
  await audit(db, { action: `annual.${step}`, actorUserId: actor.userId, actorRole: actor.role, targetType: 'annual_closing', targetId: r.id, clientId: cl.id });
  await notify(deps, db, { userId: cl.userId, kind: 'annual_status', variant: 'jovahagyasra_var', params, link: '/eves-zaras/jovahagyas' });
  return u!;
}

/** Job annual_open (5 January from 09:00): the previous year's closing opens for every active client. */
export async function jobAnnualOpen(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  if (today.slice(5) < ANNUAL_RULES.openMonthDay) return 0;
  const year = Number(today.slice(0, 4)) - 1;
  // SPEC §32.B (HIANYLISTA 1.7, TULAJ T4): a client whose service ended / is suspended gets his last year's closing only
  // with the switch lemondottEvesZaras = 'automatikus' (default 'ki': active clients only, the behaviour so far)
  const k = await evesKapcsolok(db);
  const rows = await db.select().from(clients).where(inArray(clients.lifecycle, k.lemondottEvesZaras === 'automatikus' ? ['aktiv', 'felfuggesztve', 'megszunt'] : ['aktiv']));
  let n = 0;
  for (const cl of rows) {
    const [tp] = await db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
    if (!tp) continue;
    const due = questionnaireDue(year, tp.regime);
    const existing = await annualOf(db, cl.id, year);
    if (existing && existing.status !== 'nem_indult') continue;
    if (existing) await db.update(annualClosings).set({ status: 'kerdoiv', questionnaireDue: due, updatedAt: deps.now() }).where(eq(annualClosings.id, existing.id));
    else await db.insert(annualClosings).values({ clientId: cl.id, taxYear: year, regime: tp.regime, status: 'kerdoiv', questionnaireDue: due, createdAt: deps.now(), updatedAt: deps.now() }).onConflictDoNothing();
    await notify(deps, db, { userId: cl.userId, kind: 'annual_due', variant: 'kerdoiv', params: { hatarido: huDayMonthIg(due) }, link: '/eves-zaras' });
    n++;
  }
  return n;
}

/** Job annual_reminders (daily 09:00): 14 / 3 / 1 days before the questionnaire due date while it is on the client. */
export async function jobAnnualReminders(deps: Deps): Promise<number> {
  const db = deps.db;
  const today = todayBudapest(deps.now());
  const rows = await db.select({ a: annualClosings, c: clients }).from(annualClosings).innerJoin(clients, eq(clients.id, annualClosings.clientId)).where(inArray(annualClosings.status, ['kerdoiv', 'dijra_var', 'jovahagyasra_var']));
  const { notifyOnce } = await import('./emlekezteto.js');
  let n = 0;
  for (const { a, c } of rows) {
    // SPEC §32.B: the approval has its own due date (EV_RULES.approvalDue [DÁVID D2]) and rhythm (7 / 3 / 1 days before)
    const approval = a.status === 'jovahagyasra_var';
    const due = approval ? approvalDueOf(a) : a.questionnaireDue;
    const days = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    const rhythm: readonly number[] = approval ? EV_RULES.approvalReminderDaysBefore : ANNUAL_RULES.reminderDaysBefore;
    if (!rhythm.includes(days)) continue;
    if (approval && a.approvedAt) continue;
    const variant = a.status === 'kerdoiv' ? 'kerdoiv' : a.status === 'dijra_var' ? 'fizetes' : 'jovahagyas';
    const fee = await feeSetting(db, 'eves_zaras');
    if (await notifyOnce(deps, `rem:annual_due:${a.id}:${variant}:${days}`, { userId: c.userId, kind: 'annual_due', variant, params: { ...(await accountantParams(db, c.accountantId)), hatarido: huDayMonthIg(due), dij: fmt(fee.amountHuf) }, link: approval ? '/eves-zaras/jovahagyas' : '/eves-zaras' })) n++;
  }
  return n;
}

export { todayBudapest };
