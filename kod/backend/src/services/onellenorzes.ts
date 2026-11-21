// SPEC §32.B – önellenőrzés (tax_corrections, terv 3.7 / 4.3, kritika 2.3). The original period and its calculation stay
// untouched; the correction is its own row. The accountant records the reason and the differences per tax; the app
// SUGGESTS the önellenőrzési pótlék (Art. 209. § (2), 211. § (3), 212. §; engine selfRevisionSurcharge), the accountant
// approves the final number (or overrides it with a reason). The client approves (hash over what he saw), the accountant
// files (date, NAV iktatószám, the return and the receipt), then a payment period "A beadással egy időben esedékes".
// Cautious points: the HIPA pótlék goes to the municipality, so the app never makes an item for it [DÁVID K7]; Art. 212.
// § (3) and (5) are entered by hand [DÁVID K6]; a correction of at most 1 000 Ft is refused [DÁVID D11]. Nothing is deleted.
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  CORRECTION_ADONEM_LABELS,
  CORRECTION_ADONEMEK,
  CORRECTION_CAUSES,
  CORRECTION_FORM_LABELS,
  CORRECTION_FORMS,
  EVES_TEXTS,
  EV_RULES,
  ONELL_PANEL_TEXTS,
  type AccTaxCorrection,
  type CorrectionDiff,
  type CorrectionListItem,
  type CorrectionPotlekFlags,
  type TaxCorrectionView,
} from '../_shared/eves.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { annualClosings, clients, clientTaxProfiles, taxCorrections, taxPeriods } from '../db/schema.js';
import { audit } from '../audit.js';
import { fill } from '../content.js';
import { huDayMonth, quarterLabel, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { accountantParams, notify } from '../notify/notify.js';
import { BASE_RATES, BASE_RATES_SOURCE, NAV_ACCOUNTS, NAV_ACCOUNTS_EV, selfRevisionSurcharge } from '../tax/engine.js';
import { canonical, evesText } from './eves-ciklus.js';
import { fmt } from './kedvezmeny.js';
import { clientName, type ClientRow } from './people.js';
import { accountantUserOf, staffRefs } from './team.js';
import { createManualPeriod, periodVisible, type ManualPeriodItem, type PeriodRow } from './tax.js';

export type CorrectionRow = typeof taxCorrections.$inferSelect;
interface Actor {
  userId: string;
  role: string;
}
const wrong = (m = 'Ez most nem lehetséges ebben az állapotban.') => new ApiError(409, 'correction_wrong_status', m);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'ÉÉÉÉ-HH-NN alakban.' });
const OPEN_STATUSES = ['tervezet', 'ugyfelre_var', 'jovahagyva', 'beadva'] as const;

export const correctionInputSchema = z.strictObject({
  form: z.enum(CORRECTION_FORMS),
  subjectKey: z.string().trim().min(1).max(40),
  originalPeriodId: z.string().uuid().nullish(),
  cause: z.enum(CORRECTION_CAUSES),
  reason: z.string().trim().min(5, { error: 'Írd le az ügyfélnek, miért javítunk.' }).max(EV_RULES.reasonMaxChars),
  internalNote: z.string().trim().max(2000).nullish(),
  diffs: z
    .array(z.strictObject({ adonem: z.enum(CORRECTION_ADONEMEK), label: z.string().trim().min(1).max(60), amountHuf: z.number().int().min(-1_000_000_000).max(1_000_000_000), originalDueDate: day }))
    .min(1)
    .max(8),
  certificateError: z.boolean().optional(),
  paidInFull: z.boolean().optional(),
  laterReturn: z.boolean().optional(),
  chained: z.boolean().optional(),
  plannedFiledOn: day.nullish(),
  potlekPayer: z.enum(['ugyfel', 'iroda']).optional(),
  onellbOn: day.nullish(),
  needsClientApproval: z.boolean().optional(),
  noApprovalNote: z.string().trim().max(500).nullish(),
});
export type CorrectionInputParsed = z.infer<typeof correctionInputSchema>;

/** NAV adónemek with a pótlék (HIPA and 'egyeb' never: [DÁVID K7]). */
const NAV_POTLEK_ADONEMEK = new Set(['103', '406', '258', '288']);

const pctHu = (n: number) => String(n).replace('.', ',');

/** The pótlék suggestion over the NAV lines to pay (+), with the human-readable basis lines. */
export function suggestPotlek(diffs: CorrectionDiff[], flags: CorrectionPotlekFlags, seq: number, filedOn: string): { huf: number | null; basis: string[]; reasons: string[] } {
  const lines = diffs.filter((d) => NAV_POTLEK_ADONEMEK.has(d.adonem) && d.amountHuf > 0);
  const basis: string[] = [];
  const reasons: string[] = [];
  let total = 0;
  let unknown = false;
  for (const d of lines) {
    const r = selfRevisionSurcharge({ amountHuf: d.amountHuf, dueDate: d.originalDueDate, filedOn, repeated: seq > 1, certificateError: flags.certificateError, laterReturn: flags.laterReturn, chained: flags.chained });
    if (r.huf === null) {
      unknown = true;
      if (r.reason) reasons.push(r.reason);
      continue;
    }
    total += r.huf;
    for (const row of r.rows) basis.push(`${d.label}: ${fmt(d.amountHuf)} Ft × ${pctHu(row.dailyPct)}%/nap × ${row.days} nap${r.repeated ? ' × 1,5' : ''} = ${fmt(Math.round(row.huf * (r.repeated ? 1.5 : 1)))} Ft`);
    if (r.reason) reasons.push(r.reason);
  }
  if (unknown) return { huf: null, basis, reasons: [...new Set(reasons)] };
  // Art. 212. § (2): tax originally paid in full → at most 5 000 Ft (for the whole correction)
  if (flags.paidInFull && total > 5_000) {
    basis.push(`Art. 212. § (2): legfeljebb 5 000 Ft (a számolt ${fmt(total)} Ft helyett)`);
    total = 5_000;
  }
  return { huf: total, basis, reasons: [...new Set(reasons)] };
}

/** The forms' own labels (26SZJA, '26KATA, 26HIPA, 2658) and the subject ("2026. III. negyedév", "2026"). */
async function resolveSubject(db: DbOrTx, cl: ClientRow, i: CorrectionInputParsed): Promise<{ formLabel: string; subjectKey: string; subjectLabel: string; originalPeriodId: string | null; annualClosingId: string | null }> {
  if (i.form === '2658') {
    if (!i.originalPeriodId) throw E.validation({ originalPeriodId: 'Válaszd ki a negyedévet.' });
    const [p] = await db.select().from(taxPeriods).where(and(eq(taxPeriods.id, i.originalPeriodId), eq(taxPeriods.clientId, cl.id), periodVisible)).limit(1);
    if (!p || p.kind !== 'negyedev' || !p.quarter) throw E.notFound();
    if (p.filingStatus !== 'beadva') throw wrong('Csak beadott bevallást lehet önellenőrzéssel javítani.');
    return { formLabel: p.filingForm ?? '2658', subjectKey: p.periodKey, subjectLabel: `${p.year}. ${quarterLabel(p.quarter)}`, originalPeriodId: p.id, annualClosingId: null };
  }
  if (i.form === 'egyeb') return { formLabel: 'egyéb', subjectKey: i.subjectKey, subjectLabel: i.subjectKey, originalPeriodId: null, annualClosingId: null };
  const y = Number(i.subjectKey.slice(0, 4));
  if (!Number.isInteger(y) || y < 2020) throw E.validation({ subjectKey: 'Az év kell (pl. 2026).' });
  const [a] = await db.select().from(annualClosings).where(and(eq(annualClosings.clientId, cl.id), eq(annualClosings.taxYear, y))).limit(1);
  const yy = String(y).slice(2);
  if (i.form === 'HIPA') {
    if (!a?.filedHipaAt) throw wrong('Csak beadott bevallást lehet önellenőrzéssel javítani: a HIPA-bevallás még nincs beadva.');
    return { formLabel: `${yy}HIPA`, subjectKey: String(y), subjectLabel: String(y), originalPeriodId: null, annualClosingId: a.id };
  }
  if (!a?.filedSzjaAt) throw wrong('Csak beadott bevallást lehet önellenőrzéssel javítani: az éves bevallás még nincs beadva.');
  if ((i.form === 'KATA') !== (a.regime === 'kata')) throw E.validation({ form: a.regime === 'kata' ? 'Ebben az évben kata-nyilatkozat volt.' : 'Ebben az évben szja-bevallás volt.' });
  return { formLabel: i.form === 'KATA' ? `'${yy}KATA` : `${yy}SZJA`, subjectKey: String(y), subjectLabel: String(y), originalPeriodId: null, annualClosingId: a.id };
}

/**
 * The lines the client has to pay. Art. 212. § (2) (javító kör 11-21): when the tax was paid in full originally (the
 * accountant's flag), the difference is NOT paid again – only the pótlék is due.
 */
function payableDiffs(diffs: CorrectionDiff[], paidInFull: boolean): CorrectionDiff[] {
  return paidInFull ? [] : diffs.filter((d) => d.amountHuf > 0 && d.adonem !== 'egyeb');
}

function totals(diffs: CorrectionDiff[], potlekHuf: number, payer: 'ugyfel' | 'iroda', paidInFull = false) {
  const toPay = payableDiffs(diffs, paidInFull).reduce((a, d) => a + d.amountHuf, 0) + (payer === 'ugyfel' ? potlekHuf : 0);
  const inFavour = diffs.filter((d) => d.amountHuf < 0).reduce((a, d) => a - d.amountHuf, 0);
  return { toPay, inFavour };
}

/** Art. 56. § (3): only a tax whose difference is more than 1 000 Ft can be corrected – per tax (javító kör 11-21). */
function checkThreshold(diffs: CorrectionDiff[]): void {
  if (diffs.some((d) => d.amountHuf !== 0 && Math.abs(d.amountHuf) <= EV_RULES.correctionMinHuf) || diffs.every((d) => d.amountHuf === 0)) throw E.validation({ diffs: ONELL_PANEL_TEXTS.kuszob });
}

async function nextSeq(db: DbOrTx, clientId: string, form: string, subjectKey: string, exceptId?: string): Promise<number> {
  const rows = await db
    .select({ id: taxCorrections.id })
    .from(taxCorrections)
    // javító kör 11-21: "ismételt" = an earlier correction of the same return was FILED (a draft not filed yet does not count)
    .where(and(eq(taxCorrections.clientId, clientId), eq(taxCorrections.form, form as CorrectionRow['form']), eq(taxCorrections.subjectKey, subjectKey), inArray(taxCorrections.status, ['beadva', 'rendezve'])));
  return rows.filter((r) => r.id !== exceptId).length + 1;
}

function flagsOf(i: CorrectionInputParsed): CorrectionPotlekFlags {
  return { certificateError: Boolean(i.certificateError), paidInFull: Boolean(i.paidInFull), laterReturn: Boolean(i.laterReturn), chained: Boolean(i.chained) };
}

/** POST /acc/clients/:id/corrections */
export async function createCorrection(deps: Deps, db: DbOrTx, cl: ClientRow, i: CorrectionInputParsed, actor: Actor): Promise<CorrectionRow> {
  checkThreshold(i.diffs);
  const s = await resolveSubject(db, cl, i);
  const seq = await nextSeq(db, cl.id, i.form, s.subjectKey);
  const today = todayBudapest(deps.now());
  const filedOn = i.plannedFiledOn && i.plannedFiledOn >= today ? i.plannedFiledOn : today;
  const flags = flagsOf(i);
  const sug = suggestPotlek(i.diffs, flags, seq, filedOn);
  const now = deps.now();
  const [row] = await db
    .insert(taxCorrections)
    .values({
      clientId: cl.id,
      form: i.form,
      formLabel: s.formLabel,
      subjectKey: s.subjectKey,
      subjectLabel: s.subjectLabel,
      originalPeriodId: s.originalPeriodId,
      annualClosingId: s.annualClosingId,
      seq,
      status: 'tervezet',
      cause: i.cause,
      reason: i.reason,
      internalNote: i.internalNote ?? null,
      diffs: i.diffs,
      potlekFlags: flags,
      potlekSuggestedHuf: sug.huf,
      potlekBasis: { lines: sug.basis, reasons: sug.reasons, filedOn, rates: BASE_RATES, source: BASE_RATES_SOURCE },
      potlekHuf: sug.huf ?? 0,
      potlekPayer: i.potlekPayer ?? 'ugyfel',
      plannedFiledOn: i.plannedFiledOn ?? null,
      onellbOn: i.onellbOn ?? null,
      needsClientApproval: i.needsClientApproval ?? true,
      noApprovalNote: i.noApprovalNote ?? null,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await audit(db, { action: 'correction.created', actorUserId: actor.userId, actorRole: actor.role, targetType: 'tax_correction', targetId: row!.id, clientId: cl.id, details: { form: i.form, seq, lines: i.diffs.length } });
  return row!;
}

/** PUT /acc/corrections/:id – while 'tervezet' or 'ugyfelre_var' (then it goes back to 'tervezet'; the pótlék approval resets). */
export async function updateCorrection(deps: Deps, db: DbOrTx, cl: ClientRow, row: CorrectionRow, i: CorrectionInputParsed, actor: Actor): Promise<CorrectionRow> {
  if (row.status !== 'tervezet' && row.status !== 'ugyfelre_var') throw wrong();
  checkThreshold(i.diffs);
  const s = await resolveSubject(db, cl, i);
  const seq = s.subjectKey === row.subjectKey && i.form === row.form ? row.seq : await nextSeq(db, cl.id, i.form, s.subjectKey, row.id);
  const today = todayBudapest(deps.now());
  const filedOn = i.plannedFiledOn && i.plannedFiledOn >= today ? i.plannedFiledOn : today;
  const flags = flagsOf(i);
  const sug = suggestPotlek(i.diffs, flags, seq, filedOn);
  const [u] = await db
    .update(taxCorrections)
    .set({
      form: i.form,
      formLabel: s.formLabel,
      subjectKey: s.subjectKey,
      subjectLabel: s.subjectLabel,
      originalPeriodId: s.originalPeriodId,
      annualClosingId: s.annualClosingId,
      seq,
      status: 'tervezet',
      cause: i.cause,
      reason: i.reason,
      internalNote: i.internalNote ?? null,
      diffs: i.diffs,
      potlekFlags: flags,
      potlekSuggestedHuf: sug.huf,
      potlekBasis: { lines: sug.basis, reasons: sug.reasons, filedOn, rates: BASE_RATES, source: BASE_RATES_SOURCE },
      potlekHuf: row.potlekApprovedAt ? row.potlekHuf : (sug.huf ?? 0),
      potlekApprovedAt: null,
      potlekApprovedBy: null,
      potlekPayer: i.potlekPayer ?? row.potlekPayer,
      plannedFiledOn: i.plannedFiledOn ?? null,
      onellbOn: i.onellbOn ?? null,
      needsClientApproval: i.needsClientApproval ?? row.needsClientApproval,
      noApprovalNote: i.noApprovalNote ?? null,
      approvalHash: null,
      approvedAt: null,
      approvedBy: null,
      updatedAt: deps.now(),
    })
    .where(eq(taxCorrections.id, row.id))
    .returning();
  await audit(db, { action: 'correction.updated', actorUserId: actor.userId, actorRole: actor.role, targetType: 'tax_correction', targetId: row.id, clientId: cl.id, details: { wasSent: row.status === 'ugyfelre_var' } });
  return u!;
}

/** POST /acc/corrections/:id/potlek { huf, reason } – the accountant approves the final pótlék (a different number needs a reason). */
export async function approvePotlek(deps: Deps, db: DbOrTx, cl: ClientRow, row: CorrectionRow, i: { huf: number; reason?: string | null; payer?: 'ugyfel' | 'iroda' }, actor: Actor): Promise<CorrectionRow> {
  if (row.status !== 'tervezet') throw wrong('A pótlékot a tervezetben hagyhatod jóvá.');
  // javító kör 11-21 (kritika 2.3, [DÁVID K7]): no NAV line to pay (e.g. a HIPA correction) → no pótlék in the app
  if (!needsPotlekApproval(row)) throw wrong(ONELL_PANEL_TEXTS.hipaPotlek);
  if (!Number.isSafeInteger(i.huf) || i.huf < 0 || i.huf > 100_000_000) throw E.validation({ huf: 'Nézd meg az összeget.' });
  const differs = row.potlekSuggestedHuf === null || row.potlekSuggestedHuf !== i.huf;
  if (differs && !i.reason?.trim()) throw E.validation({ reason: row.potlekSuggestedHuf === null ? 'Írd be, honnan van az összeg (pl. „NAV pótlékkalkulátor”).' : ONELL_PANEL_TEXTS.potlekIndok });
  const [u] = await db
    .update(taxCorrections)
    .set({ potlekHuf: i.huf, potlekOverrideReason: differs ? i.reason!.trim() : null, potlekApprovedAt: deps.now(), potlekApprovedBy: actor.userId, potlekPayer: i.payer ?? row.potlekPayer, updatedAt: deps.now() })
    .where(eq(taxCorrections.id, row.id))
    .returning();
  await audit(db, { action: 'correction.potlek_approved', actorUserId: actor.userId, actorRole: actor.role, targetType: 'tax_correction', targetId: row.id, clientId: cl.id, details: { huf: i.huf, suggested: row.potlekSuggestedHuf, payer: i.payer ?? row.potlekPayer } });
  return u!;
}

const needsPotlekApproval = (r: CorrectionRow) => r.diffs.some((d) => NAV_POTLEK_ADONEMEK.has(d.adonem) && d.amountHuf > 0);

/** What the client sees and approves (the hash covers it). */
function clientSummaryOf(r: CorrectionRow) {
  const t = totals(r.diffs, r.potlekHuf, r.potlekPayer, Boolean(r.potlekFlags?.paidInFull));
  return {
    id: r.id,
    form: r.formLabel,
    subject: r.subjectLabel,
    reason: r.reason,
    diffs: r.diffs.map((d) => ({ label: d.label, amountHuf: d.amountHuf })),
    potlekHuf: r.potlekHuf,
    payer: r.potlekPayer,
    toPay: t.toPay,
    inFavour: t.inFavour,
  };
}
export function correctionHash(r: CorrectionRow): string {
  return createHash('sha256').update(canonical(clientSummaryOf(r))).digest('hex');
}
function whatOf(r: Pick<CorrectionRow, 'form' | 'subjectLabel'>): string {
  return `${CORRECTION_FORM_LABELS[r.form]}, ${r.subjectLabel}`;
}

/** POST /acc/corrections/:id/send – to the client for approval (or straight 'jovahagyva' with the recorded phone agreement). */
export async function sendCorrection(deps: Deps, db: DbOrTx, cl: ClientRow, row: CorrectionRow, actor: Actor): Promise<CorrectionRow> {
  if (row.status !== 'tervezet') throw wrong();
  if (needsPotlekApproval(row) && !row.potlekApprovedAt) throw wrong('Előbb hagyd jóvá a pótlékot (a javaslatot, vagy a NAV-kalkulátor szerinti összeget).');
  const now = deps.now();
  if (!row.needsClientApproval) {
    if ((row.noApprovalNote ?? '').trim().length < 10) throw E.validation({ noApprovalNote: 'Jóváhagyás nélkül csak rögzített telefonos egyeztetés után: írd le, mikor és mit beszéltetek.' });
    const [u] = await db.update(taxCorrections).set({ status: 'jovahagyva', approvedSummary: clientSummaryOf(row), updatedAt: now }).where(eq(taxCorrections.id, row.id)).returning();
    await audit(db, { action: 'correction.approved_by_phone', actorUserId: actor.userId, actorRole: actor.role, targetType: 'tax_correction', targetId: row.id, clientId: cl.id });
    return u!;
  }
  const hash = correctionHash(row);
  const [u] = await db.update(taxCorrections).set({ status: 'ugyfelre_var', approvalHash: hash, updatedAt: now }).where(eq(taxCorrections.id, row.id)).returning();
  await audit(db, { action: 'correction.sent', actorUserId: actor.userId, actorRole: actor.role, targetType: 'tax_correction', targetId: row.id, clientId: cl.id });
  const t = totals(row.diffs, row.potlekHuf, row.potlekPayer, Boolean(row.potlekFlags?.paidInFull));
  const variant = t.toPay > 0 ? 'jovahagyasra_var' : 'jovahagyasra_var_javara';
  const emailKey = `email.correction_status.${variant}.body`;
  await notify(deps, db, { userId: cl.userId, kind: 'correction_status', variant, params: { ...(await accountantParams(db, cl.accountantId)), mit: whatOf(row) }, link: `/onellenorzes/${row.id}`, data: { correctionId: row.id }, ...((await deps.content.exists(emailKey)) ? { emailBodyKey: emailKey } : {}) });
  return u!;
}

/** POST /client/corrections/:id/approve { hash } */
export async function approveCorrection(deps: Deps, db: DbOrTx, cl: ClientRow, id: string, hash: string, userId: string): Promise<CorrectionRow> {
  const [r] = await db.select().from(taxCorrections).where(and(eq(taxCorrections.id, id), eq(taxCorrections.clientId, cl.id))).limit(1).for('update');
  if (!r || r.status === 'tervezet' || r.status === 'visszavonva') throw E.notFound();
  if (r.status !== 'ugyfelre_var') throw wrong('Ezt már jóváhagytad.');
  if (hash !== correctionHash(r) || hash !== r.approvalHash) throw new ApiError(409, 'assist_consent_stale', 'Az önellenőrzés változott. Nyisd meg újra, és nézd át.');
  const now = deps.now();
  const [u] = await db.update(taxCorrections).set({ status: 'jovahagyva', approvedAt: now, approvedBy: userId, approvedSummary: clientSummaryOf(r), updatedAt: now }).where(eq(taxCorrections.id, r.id)).returning();
  await audit(db, { action: 'correction.approved', actorUserId: userId, actorRole: 'client', targetType: 'tax_correction', targetId: r.id, clientId: cl.id });
  const acc = await accountantUserOf(db, cl);
  if (acc) await notify(deps, db, { userId: acc.userId, kind: 'tax_task', variant: 'onell_jovahagyva', params: { clientName: clientName(cl), mit: whatOf(r) }, link: `/ugyfelek/${cl.id}/onellenorzes`, data: { clientId: cl.id } });
  return u!;
}

/** The municipality account of the HIPA line (the subject year's profile, else the latest). */
async function hipaAccountOf(db: DbOrTx, cl: ClientRow, year: number): Promise<string | null> {
  const rows = await db.select({ year: clientTaxProfiles.year, acc: clientTaxProfiles.hipaAccountNumber }).from(clientTaxProfiles).where(eq(clientTaxProfiles.clientId, cl.id)).orderBy(desc(clientTaxProfiles.year));
  return rows.find((r) => r.year === year)?.acc ?? rows.find((r) => r.acc)?.acc ?? null;
}

/**
 * POST /acc/corrections/:id/filed – date, NAV iktatószám, the return and the receipt (required). The amounts to pay become
 * one 'onellenorzes' payment period, due on the filing day (Art. 54–57. §: due with the filing); the pótlék goes to the NAV
 * 215 account when the client pays it. Lines in the client's favour are no items (the folyószámla shows the credit).
 */
export async function fileCorrection(deps: Deps, db: DbOrTx, cl: ClientRow, row: CorrectionRow, f: { filedOn: string; filingRef: string; returnDocumentId: string | null; receiptDocumentId: string | null; accountNumber?: string | null }, actor: Actor): Promise<CorrectionRow> {
  if (row.status !== 'jovahagyva') throw wrong(row.status === 'ugyfelre_var' ? 'Az ügyfél még nem hagyta jóvá.' : undefined);
  const now = deps.now();
  const today = todayBudapest(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.filedOn) || f.filedOn > today) throw E.validation({ filedOn: 'Jövőbeli napot nem adhatsz meg.' });
  const ref = f.filingRef.trim();
  if (!ref) throw E.validation({ filingRef: 'Írd be a NAV-iktatószámot.' });
  if (ref.length > EV_RULES.filingRefMaxChars) throw E.validation({ filingRef: `Legfeljebb ${EV_RULES.filingRefMaxChars} karakter.` });
  if (!f.returnDocumentId) throw E.validation({ file: 'Töltsd fel a beadott önellenőrzést (PDF).' });
  if (!f.receiptDocumentId) throw E.validation({ receipt: 'Töltsd fel a NAV visszaigazolását.' });
  // javító kör 11-21 (Art. 212. § (1)): the pótlék runs to the FILING day. An app suggestion is recomputed for the real day;
  // a number the accountant entered by hand (with a reason) for another day has to be checked again.
  const basis = (row.potlekBasis ?? {}) as { filedOn?: string; lines?: string[]; reasons?: string[] };
  let potlekHuf = row.potlekHuf;
  if (needsPotlekApproval(row) && basis.filedOn && basis.filedOn !== f.filedOn) {
    if (row.potlekOverrideReason)
      throw wrong(`A pótlékot ${huDayMonth(basis.filedOn)} beadásra hagytad jóvá. A pótlék a beadás napjáig jár: nyisd meg (Módosítom), írd be a ${huDayMonth(f.filedOn)} napra járó összeget, és hagyd jóvá újra.`);
    const sug = suggestPotlek(row.diffs, row.potlekFlags, row.seq, f.filedOn);
    if (sug.huf === null) throw wrong(ONELL_PANEL_TEXTS.nincsKamat);
    if (sug.huf !== row.potlekHuf) {
      await db
        .update(taxCorrections)
        .set({ potlekHuf: sug.huf, potlekSuggestedHuf: sug.huf, potlekBasis: { ...basis, lines: sug.basis, reasons: sug.reasons, filedOn: f.filedOn, rates: BASE_RATES, source: BASE_RATES_SOURCE }, updatedAt: now })
        .where(eq(taxCorrections.id, row.id));
      await audit(db, { action: 'correction.potlek_recalculated', actorUserId: actor.userId, actorRole: actor.role, targetType: 'tax_correction', targetId: row.id, clientId: cl.id, details: { from: row.potlekHuf, to: sug.huf, plannedOn: basis.filedOn, filedOn: f.filedOn } });
      potlekHuf = sug.huf;
    }
  }
  const paidInFull = Boolean(row.potlekFlags?.paidInFull);
  const byAdonem = new Map<string, number>();
  for (const d of payableDiffs(row.diffs, paidInFull)) byAdonem.set(d.adonem, (byAdonem.get(d.adonem) ?? 0) + d.amountHuf);
  const items: ManualPeriodItem[] = [];
  const label = `önellenőrzés, ${row.formLabel} ${row.subjectLabel}`;
  const navLine = (adonem: string, kind: ManualPeriodItem['kind'], name: string, account: { name: string; number: string; iban?: string | null }) => {
    const amount = byAdonem.get(adonem);
    if (amount) items.push({ kind, label: name, sublabel: label, amountHuf: amount, account, adonem });
  };
  navLine('103', 'szja_kulonbozet', 'Szja', NAV_ACCOUNTS.szja);
  navLine('406', 'tb_jarulek', 'TB-járulék', NAV_ACCOUNTS.tb);
  navLine('258', 'szocho', 'Szocho', NAV_ACCOUNTS.szocho);
  navLine('288', 'kata_kulonado', 'Kata', NAV_ACCOUNTS.kata);
  const hipa = byAdonem.get('HIPA');
  if (hipa) {
    const number = (f.accountNumber ?? (await hipaAccountOf(db, cl, Number(row.subjectKey.slice(0, 4)))) ?? '').trim();
    if (!/^\d{8}-\d{8}(-\d{8})?$/.test(number)) throw E.validation({ accountNumber: 'Add meg az önkormányzat iparűzésiadó-számláját.' });
    const town = cl.hqMunicipality?.trim();
    items.push({ kind: 'hipa_kulonbozet', label: 'Iparűzési adó', sublabel: label, amountHuf: hipa, account: { name: town ? `${town} önkormányzata – iparűzési adó beszedési számla` : 'Önkormányzat – iparűzési adó beszedési számla', number }, adonem: null });
  }
  // the NAV 215 account only for the pótlék of NAV taxes – a HIPA pótlék is the municipality's [DÁVID K7]: no item
  if (row.potlekPayer === 'ugyfel' && potlekHuf > 0 && needsPotlekApproval(row)) items.push({ kind: 'onellenorzesi_potlek', label: 'Önellenőrzési pótlék', sublabel: label, amountHuf: potlekHuf, account: NAV_ACCOUNTS_EV.onellenorzes, adonem: '215' });
  let paymentPeriodId: string | null = null;
  if (items.length) {
    const p = await createManualPeriod(deps, db, {
      clientId: cl.id,
      kind: 'onellenorzes',
      periodKey: `ONELL-${row.id}`,
      year: Number(row.subjectKey.slice(0, 4)) || Number(today.slice(0, 4)),
      dueDate: f.filedOn,
      reference: cl.adoszam ?? '',
      filingForm: `${row.formLabel} – ${row.subjectLabel}`,
      filingRef: ref,
      correctionId: row.id,
      items,
    });
    paymentPeriodId = p.id;
  }
  const [u] = await db
    .update(taxCorrections)
    .set({ status: items.length ? 'beadva' : 'rendezve', filedOn: f.filedOn, filingRef: ref, returnDocumentId: f.returnDocumentId, receiptDocumentId: f.receiptDocumentId, filedBy: actor.userId, paymentPeriodId, updatedAt: now })
    .where(eq(taxCorrections.id, row.id))
    .returning();
  await audit(db, { action: 'correction.filed', actorUserId: actor.userId, actorRole: actor.role, targetType: 'tax_correction', targetId: row.id, clientId: cl.id, details: { items: items.length, totalHuf: items.reduce((a, b) => a + b.amountHuf, 0) } });
  const t = totals(row.diffs, potlekHuf, row.potlekPayer, paidInFull);
  const ap = await accountantParams(db, cl.accountantId);
  const toPay = items.reduce((a, b) => a + b.amountHuf, 0);
  // javító kör 11-21: "A pótlékot mi álljuk" only when the office really pays a pótlék; "csak a pótlék" when the tax was paid
  const variant =
    toPay > 0 ? (paidInFull ? 'beadva_potlek' : 'beadva_fizetendo') : t.inFavour > 0 ? 'beadva_javara' : row.potlekPayer === 'iroda' && potlekHuf > 0 ? 'beadva_iroda' : 'beadva';
  const emailKey = `email.correction_status.${variant}.body`;
  await notify(deps, db, {
    userId: cl.userId,
    kind: 'correction_status',
    variant,
    params: { ...ap, osszeg: fmt(toPay > 0 ? toPay : t.inFavour), mit: whatOf(row) },
    link: paymentPeriodId ? `/fizetes/${paymentPeriodId}` : `/onellenorzes/${row.id}`,
    data: { correctionId: row.id },
    ...((await deps.content.exists(emailKey)) ? { emailBodyKey: emailKey } : {}),
  });
  return u!;
}

/** 'beadva' → 'rendezve' once the payment period of the correction is verified ("Rendben"). */
export async function maybeSettleCorrection(deps: Deps, db: DbOrTx, p: PeriodRow): Promise<void> {
  if (!p.correctionId || p.paymentStatus !== 'ellenorizve') return;
  const [r] = await db.select().from(taxCorrections).where(eq(taxCorrections.id, p.correctionId)).limit(1);
  if (!r || r.status !== 'beadva') return;
  await db.update(taxCorrections).set({ status: 'rendezve', updatedAt: deps.now() }).where(eq(taxCorrections.id, r.id));
  await audit(db, { action: 'correction.settled', actorRole: 'system', targetType: 'tax_correction', targetId: r.id, clientId: r.clientId });
  const [cl] = await db.select().from(clients).where(eq(clients.id, r.clientId)).limit(1);
  if (cl) await notify(deps, db, { userId: cl.userId, kind: 'correction_status', variant: 'rendezve', params: await accountantParams(db, cl.accountantId), link: `/onellenorzes/${r.id}`, noEmail: true });
}

/** POST /acc/corrections/:id/cancel { reason } – never a delete. */
export async function cancelCorrection(deps: Deps, db: DbOrTx, cl: ClientRow, row: CorrectionRow, reason: string, actor: Actor): Promise<CorrectionRow> {
  if (row.status === 'beadva' || row.status === 'rendezve' || row.status === 'visszavonva') throw wrong('Beadott önellenőrzést nem lehet visszavonni: ha hibás, újabb önellenőrzés kell.');
  const [u] = await db.update(taxCorrections).set({ status: 'visszavonva', cancelledReason: reason.trim(), updatedAt: deps.now() }).where(eq(taxCorrections.id, row.id)).returning();
  await audit(db, { action: 'correction.cancelled', actorUserId: actor.userId, actorRole: actor.role, targetType: 'tax_correction', targetId: row.id, clientId: cl.id, details: { wasSent: row.status !== 'tervezet' } });
  return u!;
}

// ---------------------------------------------------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------------------------------------------------
export async function correctionOf(db: DbOrTx, id: string): Promise<CorrectionRow | null> {
  const [r] = await db.select().from(taxCorrections).where(eq(taxCorrections.id, id)).limit(1);
  return r ?? null;
}

export async function accCorrectionDto(deps: Deps, db: DbOrTx, r: CorrectionRow): Promise<AccTaxCorrection> {
  const refs = await staffRefs(db, [r.potlekApprovedBy]);
  const [p] = r.paymentPeriodId ? await db.select({ s: taxPeriods.paymentStatus }).from(taxPeriods).where(and(eq(taxPeriods.id, r.paymentPeriodId), periodVisible)).limit(1) : [];
  const t = totals(r.diffs, r.potlekHuf, r.potlekPayer, Boolean(r.potlekFlags?.paidInFull));
  const basis = (r.potlekBasis ?? {}) as { lines?: string[]; reasons?: string[]; filedOn?: string };
  const reasonText: Record<string, string> = { nincs_kamat: ONELL_PANEL_TEXTS.nincsKamat, kesobbi_bevallas: ONELL_PANEL_TEXTS.kesobbiBevallas, lancolt: ONELL_PANEL_TEXTS.lancolt, igazolas_hiba: ONELL_PANEL_TEXTS.igazolasHiba };
  const rate = BASE_RATES[BASE_RATES.length - 1]!;
  const warnings: string[] = [];
  if (r.seq > 1) warnings.push(ONELL_PANEL_TEXTS.ismetelt);
  if (r.diffs.some((d) => d.adonem === 'HIPA' && d.amountHuf > 0)) warnings.push(ONELL_PANEL_TEXTS.hipaPotlek);
  if (r.potlekFlags?.paidInFull) warnings.push(ONELL_PANEL_TEXTS.hianytalanSor);
  if (needsPotlekApproval(r) && basis.filedOn && (r.status === 'tervezet' || r.status === 'ugyfelre_var' || r.status === 'jovahagyva')) warnings.push(fill(ONELL_PANEL_TEXTS.potlekDatum, { datum: huDayMonth(basis.filedOn) }));
  warnings.push(ONELL_PANEL_TEXTS.eredetiErintetlen);
  return {
    id: r.id,
    clientId: r.clientId,
    form: r.form,
    formLabel: r.formLabel,
    subjectKey: r.subjectKey,
    subjectLabel: r.subjectLabel,
    originalPeriodId: r.originalPeriodId ?? null,
    seq: r.seq,
    status: r.status,
    cause: r.cause,
    reason: r.reason,
    internalNote: r.internalNote ?? null,
    diffs: r.diffs,
    flags: r.potlekFlags,
    potlek: {
      suggestedHuf: r.potlekSuggestedHuf ?? null,
      basis: [...(basis.lines ?? []), ...(basis.reasons ?? []).map((x) => reasonText[x]).filter((x): x is string => Boolean(x))],
      huf: r.potlekHuf,
      approvedAt: r.potlekApprovedAt?.toISOString() ?? null,
      approvedBy: r.potlekApprovedBy ? (refs.get(r.potlekApprovedBy) ?? null) : null,
      overrideReason: r.potlekOverrideReason ?? null,
      payer: r.potlekPayer,
      rateNote: fill(ONELL_PANEL_TEXTS.kamatForras, { szazalek: pctHu(rate.pct), tol: huDayMonth(rate.from), ellenorizve: BASE_RATES_SOURCE.checkedOn }),
    },
    totalToPayHuf: t.toPay,
    inFavourHuf: t.inFavour,
    needsClientApproval: r.needsClientApproval,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    filedOn: r.filedOn ?? null,
    filingRef: r.filingRef ?? null,
    paymentPeriodId: r.paymentPeriodId ?? null,
    paymentStatus: p?.s ?? null,
    cancelledReason: r.cancelledReason ?? null,
    createdAt: r.createdAt.toISOString(),
    warnings,
  };
}

export async function accCorrectionList(deps: Deps, db: DbOrTx, clientId: string): Promise<AccTaxCorrection[]> {
  const rows = await db.select().from(taxCorrections).where(eq(taxCorrections.clientId, clientId)).orderBy(desc(taxCorrections.createdAt));
  const out: AccTaxCorrection[] = [];
  for (const r of rows) out.push(await accCorrectionDto(deps, db, r));
  return out;
}

async function statusText(deps: Pick<Deps, 'content'>, r: CorrectionRow, fn: string): Promise<string> {
  return evesText(deps, `onell.allapot.${r.status}`, { firstName: fn });
}

export async function clientCorrectionView(deps: Deps, db: DbOrTx, cl: ClientRow, r: CorrectionRow): Promise<TaxCorrectionView> {
  const ap = await accountantParams(db, cl.accountantId);
  const t = totals(r.diffs, r.potlekHuf, r.potlekPayer, Boolean(r.potlekFlags?.paidInFull));
  return {
    id: r.id,
    status: r.status,
    statusText: await statusText(deps, r, String(ap.firstName)),
    what: `${r.subjectLabel}: ${CORRECTION_FORM_LABELS[r.form]}`,
    reason: r.reason,
    diffs: r.diffs.map((d) => ({ label: d.label || CORRECTION_ADONEM_LABELS[d.adonem], amountHuf: Math.abs(d.amountHuf), inFavour: d.amountHuf < 0 })),
    potlekHuf: r.potlekHuf,
    potlekPaidByUs: r.potlekPayer === 'iroda' && r.potlekHuf > 0,
    totalHuf: t.toPay,
    inFavourHuf: t.inFavour,
    canApprove: r.status === 'ugyfelre_var',
    approvalHash: r.status === 'ugyfelre_var' ? r.approvalHash : null,
    approvedAt: r.approvedAt?.toISOString() ?? null,
    filedOn: r.filedOn ?? null,
    paymentPeriodId: r.paymentPeriodId ?? null,
    diffsAlreadyPaid: Boolean(r.potlekFlags?.paidInFull) && r.diffs.some((d) => d.amountHuf > 0),
  };
}

/** The client's corrections he can see (never a draft or a cancelled one). */
export async function clientCorrections(db: DbOrTx, clientId: string): Promise<CorrectionRow[]> {
  return db
    .select()
    .from(taxCorrections)
    .where(and(eq(taxCorrections.clientId, clientId), inArray(taxCorrections.status, ['ugyfelre_var', 'jovahagyva', 'beadva', 'rendezve'])))
    .orderBy(desc(taxCorrections.createdAt));
}

/** The open ones for the annual screen ("Javítjuk egy beadott bevallásodat"). */
export async function clientCorrectionList(deps: Deps, db: DbOrTx, cl: ClientRow): Promise<CorrectionListItem[]> {
  const rows = (await clientCorrections(db, cl.id)).filter((r) => r.status !== 'rendezve');
  if (!rows.length) return [];
  const ap = await accountantParams(db, cl.accountantId);
  const out: CorrectionListItem[] = [];
  for (const r of rows) out.push({ id: r.id, status: r.status, title: `${EVES_TEXTS.onell.listaCim}: ${r.subjectLabel}, ${CORRECTION_FORM_LABELS[r.form]}`, statusText: await statusText(deps, r, String(ap.firstName)), needsAction: r.status === 'ugyfelre_var' });
  return out;
}

/** Open corrections of a client (flag onellenorzes_nyitott, the overview). */
export async function openCorrectionCount(db: DbOrTx, clientId: string): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(taxCorrections).where(and(eq(taxCorrections.clientId, clientId), inArray(taxCorrections.status, [...OPEN_STATUSES])));
  return Number(row?.n ?? 0);
}
