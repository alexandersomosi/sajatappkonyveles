// New business, SELF-SERVICE (SPEC §26.1): the client answers the short data form, gets a personalised guide, files the
// EV bejelentés himself in the NAV Vállalkozói Ügysegéd, uploads the NAV confirmation; the team only checks it and
// records the adószám. We never ask for or store TAJ, anyja neve, születési adatok (zod strict objects reject them).
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { BusinessActivityChoice, BusinessRegistrationAnswers, BusinessRegistrationHints, BusinessRegistrationInput, BusinessRegistrationView } from '../_shared/api.js';
import { ACTIVITY_QUALIFICATION_NOTE, activityPending, BUSINESS_ACTIVITIES, isValidHuZip } from '../_shared/bekotes.js';
import {
  COST_CLASS_ANSWER,
  EU_PARTNER_ANSWERS,
  REGISTRATION_OPEN_STATUSES,
  REGISTRATION_STEP_STATUS,
  REVENUE_BANDS,
  SEAT_KINDS,
  SEAT_RIGHTS,
  START_PLANS,
  WORK_KIND_TAX_STATUS,
  WORK_KINDS,
  type CostClass,
  type CostRatio,
  type RegistrationStatus,
} from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { businessRegistrations, clients, clientTaxProfiles, documents, documentVersions, files } from '../db/schema.js';
import { audit } from '../audit.js';
import { E } from '../lib/errors.js';
import { addDays, daysBetween, isIsoDate, todayBudapest } from '../lib/dates.js';
import { isValidAdoszam } from '../lib/validators.js';
import { costRatioForActivity, RULES_2026 } from '../tax/engine.js';
import { rulesForYear } from '@kezjegy/ado-motor';

/** The rules of the start year (round-2 tax finding 5: a 2027 start must not use the 2026 numbers). */
function rulesOf(year: number) {
  return rulesForYear(year) ?? RULES_2026;
}
import { setStep } from './onboarding.js';

export type RegRow = typeof businessRegistrations.$inferSelect;
export const OPEN_REG = [...REGISTRATION_OPEN_STATUSES] as RegistrationStatus[];
/** Filed or later: the bejelentés exists at NAV, the path cannot be switched any more. */
export const FILED_OR_LATER: RegistrationStatus[] = ['beadva', 'javitas', 'ellenorizve', 'kesz'];

/** The exact-ÖVTJ hold only matters before filing. */
export const ACTIVITY_HOLD_STATUSES: RegistrationStatus[] = ['kitoltes', 'utmutato', 'javitas'];

export function emptyAnswers(): BusinessRegistrationAnswers {
  return {
    declarations: null,
    revenueBand: null,
    activities: [],
    activityFreeText: null,
    seat: null,
    otherSites: [],
    workKind: null,
    euPartner: null,
    startPlan: null,
    startDate: null,
    hasSeparateBusinessAccount: null,
  };
}

export function answersOf(row: Pick<RegRow, 'answers'>): BusinessRegistrationAnswers {
  return { ...emptyAnswers(), ...(row.answers ?? {}) } as BusinessRegistrationAnswers;
}

// ---------------------------------------------------------------------------------------------------------------
// input validation (strict: unknown fields such as TAJ or anyja neve are refused)
// ---------------------------------------------------------------------------------------------------------------
const addressSchema = z.strictObject({
  zip: z
    .string()
    .trim()
    .refine(isValidHuZip, { error: 'Négyjegyű irányítószám kell.' }),
  city: z.string().trim().min(1, { error: 'Írd be a települést.' }).max(60),
  line: z.string().trim().min(3, { error: 'Írd be az utcát és a házszámot.' }).max(120),
});

export const registrationInputSchema = z.strictObject({
  declarations: z.strictObject({ noExclusion: z.boolean(), singleBusiness: z.boolean() }).optional(),
  revenueBand: z.enum(REVENUE_BANDS).optional(),
  activities: z
    .array(z.strictObject({ key: z.string().max(40).nullable(), label: z.string().trim().max(200).optional(), main: z.boolean() }))
    .max(5, { error: 'Legfeljebb 1 fő és 4 további tevékenységet adhatsz meg.' })
    .optional(),
  activityFreeText: z.string().trim().max(200).nullable().optional(),
  seat: z
    .strictObject({
      kind: z.enum(SEAT_KINDS),
      address: addressSchema.nullable().optional(),
      right: z.enum(SEAT_RIGHTS).nullable().optional(),
      provider: z.strictObject({ name: z.string().trim().min(2).max(120), adoszam: z.string().trim().max(20) }).nullable().optional(),
    })
    .optional(),
  otherSites: z.array(z.strictObject({ address: addressSchema })).max(3, { error: 'Legfeljebb 3 további címet adhatsz meg.' }).optional(),
  workKind: z.enum(WORK_KINDS).optional(),
  euPartner: z.enum(EU_PARTNER_ANSWERS).optional(),
  startPlan: z.enum(START_PLANS).optional(),
  startDate: z.string().nullable().optional(),
  hasSeparateBusinessAccount: z.boolean().nullable().optional(),
}) satisfies z.ZodType<BusinessRegistrationInput>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

export interface ApplyCtx {
  now: Date;
  /** The client's home city (seat 'lakcim' → telephely/fióktelep decision). */
  profileCity: string | null;
  /** Staff edits may keep / set ÖVTJ codes. */
  staff?: boolean;
}

/** Merges a (partial) input into the stored answers; validates each present field (400 with `fields`). */
export function applyInput(prev: BusinessRegistrationAnswers, b: BusinessRegistrationInput, ctx: ApplyCtx): BusinessRegistrationAnswers {
  const out: BusinessRegistrationAnswers = { ...prev };
  const fields: Record<string, string> = {};
  const today = todayBudapest(ctx.now);
  if (b.declarations) out.declarations = { ...b.declarations, acceptedAt: ctx.now.toISOString() };
  if (b.revenueBand) out.revenueBand = b.revenueBand;
  if (b.activities) {
    const seen = new Set<string>();
    const acts: BusinessActivityChoice[] = [];
    b.activities.forEach((a, i) => {
      if (a.key) {
        const def = BUSINESS_ACTIVITIES.find((x) => x.key === a.key);
        if (!def) {
          fields[`activities.${i}.key`] = 'Ismeretlen tevékenység. Válassz a listából, vagy írd le a saját szavaiddal.';
          return;
        }
        if (seen.has(def.key)) return;
        seen.add(def.key);
        const kept = prev.activities.find((p) => p.key === def.key);
        const ovtjKod = def.ovtjKod ?? kept?.ovtjKod ?? null;
        const ovtjNev = def.ovtjKod ? (def.ovtjNev ?? null) : (kept?.ovtjNev ?? null);
        acts.push({ key: def.key, label: def.label, main: a.main, ovtjKod, ...(ovtjNev ? { ovtjNev } : {}), navKereso: def.navKereso });
      } else {
        const label = (a.label ?? '').trim();
        if (!label) {
          fields[`activities.${i}.label`] = 'Írd le a saját szavaiddal, mit csinálsz.';
          return;
        }
        const kept = prev.activities.find((p) => !p.key && norm(p.label) === norm(label));
        acts.push({ key: null, label: label.slice(0, 200), main: a.main, ovtjKod: kept?.ovtjKod ?? null, ...(kept?.ovtjNev ? { ovtjNev: kept.ovtjNev } : {}), navKereso: null });
      }
    });
    if (acts.length && acts.filter((a) => a.main).length !== 1) fields.activities = 'Jelölj meg pontosan egy fő tevékenységet.';
    out.activities = acts;
  }
  if (b.activityFreeText !== undefined) out.activityFreeText = b.activityFreeText?.trim() ? b.activityFreeText.trim().slice(0, 200) : null;
  if (b.seat) {
    const s = b.seat;
    if (s.provider && !isValidAdoszam(s.provider.adoszam)) fields['seat.provider.adoszam'] = 'Ez az adószám nem stimmel (formátum: 12345678-1-23).';
    out.seat = {
      kind: s.kind,
      address: s.kind === 'lakcim' ? null : (s.address ?? null),
      right: s.kind === 'mas_cim' ? (s.right ?? null) : s.kind === 'szekhelyszolgaltato' ? 'szekhelyszolgaltatasi_szerzodes' : null,
      provider: s.kind === 'szekhelyszolgaltato' ? (s.provider ?? null) : null,
    };
  }
  if (b.otherSites) out.otherSites = b.otherSites.map((x) => ({ address: x.address, kind: 'telephely' as const }));
  // telephely = same settlement as the seat, fióktelep = elsewhere (recomputed whenever seat or sites change)
  const seatCity = out.seat ? (out.seat.kind === 'lakcim' ? ctx.profileCity : (out.seat.address?.city ?? null)) : ctx.profileCity;
  out.otherSites = out.otherSites.map((x) => ({ address: x.address, kind: seatCity && norm(seatCity) === norm(x.address.city) ? 'telephely' : 'fioktelep' }));
  if (b.workKind) out.workKind = b.workKind;
  if (b.euPartner) out.euPartner = b.euPartner;
  if (b.hasSeparateBusinessAccount !== undefined) out.hasSeparateBusinessAccount = b.hasSeparateBusinessAccount;
  if (b.startPlan) out.startPlan = b.startPlan;
  if (b.startDate !== undefined) out.startDate = b.startDate;
  if (out.startPlan === 'mielobb') out.startDate = null;
  if (out.startPlan === 'datum' && out.startDate) {
    if (!isIsoDate(out.startDate)) fields.startDate = 'Dátum kell (ÉÉÉÉ-HH-NN).';
    else if (out.startDate < today || out.startDate > addDays(today, 180)) fields.startDate = 'Mától legfeljebb fél évre előre adhatsz meg dátumot.';
  }
  if (Object.keys(fields).length) throw E.validation(fields);
  return out;
}

/** Field ids still missing before submit (SPEC §26.1.3). */
export function missingFields(a: BusinessRegistrationAnswers, ctx: { adatokDone: boolean }): string[] {
  const m: string[] = [];
  if (!ctx.adatokDone) m.push('adatok');
  if (!a.declarations?.noExclusion) m.push('declarations.noExclusion');
  if (!a.declarations?.singleBusiness) m.push('declarations.singleBusiness');
  if (!a.revenueBand) m.push('revenueBand');
  if ((!a.activities.length && !a.activityFreeText) || (a.activities.length && !a.activities.some((x) => x.main))) m.push('activities');
  if (!a.seat) m.push('seat');
  else {
    if (a.seat.kind !== 'lakcim' && !a.seat.address) m.push('seat.address');
    if (a.seat.kind === 'mas_cim' && !a.seat.right) m.push('seat.right');
    if (a.seat.kind === 'szekhelyszolgaltato' && !a.seat.provider) m.push('seat.provider');
  }
  if (!a.workKind) m.push('workKind');
  if (!a.euPartner) m.push('euPartner');
  if (!a.startPlan) m.push('startPlan');
  else if (a.startPlan === 'datum' && !a.startDate) m.push('startDate');
  return m;
}

const ft = (n: number) => `${new Intl.NumberFormat('hu-HU').format(n).replace(/ /g, ' ')} Ft`;

/**
 * Minimum monthly TB + szocho of a főállású EV (SPEC §26.1.3): 2026 minimálbér 59 718 + 41 964 = 101 682 Ft; with
 * `guaranteed` (the work needs a qualification, round-2 tax finding 7) the base is the garantált bérminimum:
 * 69 042 + 48 516 = 117 558 Ft.
 */
export function minimumMonthlyContribution(o: { guaranteed?: boolean; year?: number } = {}): number {
  const r = rulesOf(o.year ?? 2026);
  const w = o.guaranteed ? r.guaranteedMinimumHuf : r.minimumWageHuf;
  return Math.round((w * r.tbPermille) / 1000) + Math.round((((w * r.szochoMinimumPct) / 100) * r.szochoPermille) / 1000);
}

function mainActivity(a: BusinessRegistrationAnswers): BusinessActivityChoice | null {
  return a.activities.find((x) => x.main) ?? null;
}

export function costClassOf(a: BusinessRegistrationAnswers): CostClass | null {
  const main = mainActivity(a);
  if (!main) return a.activityFreeText ? 'ellenorizendo' : null;
  if (!main.key) return 'ellenorizendo';
  return BUSINESS_ACTIVITIES.find((x) => x.key === main.key)?.costClass ?? 'ellenorizendo';
}

export async function computeHints(deps: Deps, a: BusinessRegistrationAnswers, accFirstName: string): Promise<BusinessRegistrationHints> {
  const now = deps.now();
  const today = todayBudapest(now);
  const costClass = costClassOf(a);
  const answer = costClass ? COST_CLASS_ANSWER[costClass] : null;
  const costRatio: CostRatio | null = answer ? (costRatioForActivity(answer) as CostRatio) : null;
  // The "2027-től 50%" sentence is only about the general class (45 → 50%); 80/90% stay (SPEC §24 11-18 javító).
  const costRatioText = costClass
    ? costRatio
      ? await deps.content.render(costClass === 'altalanos' ? 'vallalkozas.hint.koltseghanyad' : 'vallalkozas.hint.koltseghanyad_kulonleges', { ratio: costRatio, firstName: accFirstName })
      : await deps.content.render('vallalkozas.hint.koltseghanyad_konyvelo', { firstName: accFirstName })
    : null;
  const start = a.startPlan === 'datum' && a.startDate && a.startDate > today ? a.startDate : today;
  const year = Number(start.slice(0, 4));
  const rules = rulesOf(year);
  const chosen = a.activities.map((x) => (x.key ? BUSINESS_ACTIVITIES.find((d) => d.key === x.key) : null)).filter(Boolean);
  const mainDef = a.activities.find((x) => x.main)?.key ? BUSINESS_ACTIVITIES.find((d) => d.key === a.activities.find((x) => x.main)?.key) : null;
  const minimum = a.workKind === 'fofoglalkozas' ? minimumMonthlyContribution({ year }) : null;
  // Round-2 tax finding 7: a work that needs a qualification (fodrász, kozmetikus…) pays on the garantált bérminimum.
  const minimumKepesites = a.workKind === 'fofoglalkozas' && mainDef?.kepesitesKellhet ? minimumMonthlyContribution({ year, guaranteed: true }) : null;
  // Saját jogú nyugdíjas (kiegészítő tevékenység): no TB-járulék and no szocho at all (ado-motor explanation.ts).
  const contributionText = a.workKind
    ? a.workKind === 'fofoglalkozas'
      ? minimumKepesites
        ? await deps.content.render('vallalkozas.hint.jarulek_fo_kepesites', { amount: ft(minimum!), amountKepesites: ft(minimumKepesites) })
        : await deps.content.render('vallalkozas.hint.jarulek_fo', { amount: ft(minimum!) })
      : a.workKind === 'nyugdij_mellett'
        ? await deps.content.render('vallalkozas.hint.jarulek_nyugdij', {})
        : await deps.content.render('vallalkozas.hint.jarulek_mellek', {})
    : null;
  const yearDays = daysBetween(`${year}-01-01`, `${year}-12-31`) + 1;
  const days = daysBetween(start, `${year}-12-31`) + 1;
  const retail = costClass ? COST_CLASS_ANSWER[costClass] === 'kiskereskedelem' : false;
  const atalanyCapHuf = Math.round(((retail ? rules.atalanyCapRetailHuf : rules.atalanyCapHuf) * days) / yearDays);
  let stop: BusinessRegistrationHints['stop'] = null;
  if (a.revenueBand === 'tobb_20m') stop = { code: 'tobb_20m', text: await deps.content.render('vallalkozas.stop.tobb_20m', {}) };
  else if (a.declarations && a.declarations.noExclusion === false) stop = { code: 'kizaro_ok', text: await deps.content.render('vallalkozas.stop.kizaro_ok', {}) };
  else if (a.declarations && a.declarations.singleBusiness === false) stop = { code: 'mar_van_vallalkozas', text: await deps.content.render('vallalkozas.stop.mar_van_vallalkozas', {}) };
  return {
    costClass,
    costRatio,
    costRatioText,
    minimumMonthlyContributionHuf: minimum,
    contributionText,
    // Áfa tv. 189. §: in the starting year the alanyi adómentesség limit is time-proportional, like the átalány cap
    // (same day count; the engine's meter uses the same rule). [KÖNYVELŐ] confirms the day count.
    afaLimitHuf: Math.round((rules.afaLimitHuf * days) / yearDays),
    atalanyCapHuf,
    qualificationNote: chosen.some((x) => x?.kepesitesKellhet) ? ACTIVITY_QUALIFICATION_NOTE : null,
    stop,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// rows and views
// ---------------------------------------------------------------------------------------------------------------
export async function openRegistrationOf(db: DbOrTx, clientId: string): Promise<RegRow | null> {
  const [r] = await db
    .select()
    .from(businessRegistrations)
    .where(and(eq(businessRegistrations.clientId, clientId), inArray(businessRegistrations.status, OPEN_REG)))
    .limit(1);
  return r ?? null;
}

/** The open registration, else the newest one (kesz / elallt). */
export async function currentRegistrationOf(db: DbOrTx, clientId: string): Promise<RegRow | null> {
  const open = await openRegistrationOf(db, clientId);
  if (open) return open;
  const [r] = await db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, clientId)).orderBy(desc(businessRegistrations.createdAt)).limit(1);
  return r ?? null;
}

export async function filedDoc(db: DbOrTx, row: RegRow): Promise<{ documentId: string; fileId: string; mime: string; uploadedAt: string } | null> {
  if (!row.filedDocumentId) return null;
  const [d] = await db
    .select({ id: documents.id, fileId: documentVersions.fileId, mime: files.mime, at: documentVersions.createdAt })
    .from(documents)
    .innerJoin(documentVersions, eq(documentVersions.id, documents.currentVersionId))
    .innerJoin(files, eq(files.id, documentVersions.fileId))
    .where(eq(documents.id, row.filedDocumentId))
    .limit(1);
  return d ? { documentId: d.id, fileId: d.fileId, mime: d.mime, uploadedAt: d.at.toISOString() } : null;
}

export async function registrationView(deps: Deps, db: DbOrTx, row: RegRow, ctx: { accFirstName: string; adatokDone: boolean }): Promise<BusinessRegistrationView> {
  const a = answersOf(row);
  const f = await filedDoc(db, row);
  return {
    id: row.id,
    status: row.status,
    // 11-19 javító kör 2: while the team still writes the ÖVTJ line the guide is NOT "ready" to file with.
    statusText: await deps.content.render(row.status === 'utmutato' && activityPending(a) ? 'vallalkozas.allapot.utmutato_varakozik' : `vallalkozas.allapot.${row.status}`, { firstName: ctx.accFirstName }),
    answers: a,
    hints: await computeHints(deps, a, ctx.accFirstName),
    missing: missingFields(a, { adatokDone: ctx.adatokDone }),
    canEdit: row.status === 'kitoltes' || row.status === 'utmutato' || row.status === 'javitas',
    canWithdraw: row.status === 'kitoltes' || row.status === 'utmutato',
    submittedAt: row.submittedAt?.toISOString() ?? null,
    guideOpenedAt: row.guideOpenedAt?.toISOString() ?? null,
    guideProgress: row.guideProgress ?? [],
    filed: row.filedOn && row.filedChannel && f ? { filedOn: row.filedOn, channel: row.filedChannel, documentId: f.documentId, fileId: f.fileId, uploadedAt: f.uploadedAt } : null,
    fixNote: row.status === 'javitas' ? row.fixNote : null,
    checkedAt: row.checkedAt?.toISOString() ?? null,
    adoszam: row.adoszam,
    evNyilvantartasiSzam: row.evNyilvantartasiSzam,
    registeredOn: row.registeredOn,
    doneAt: row.doneAt?.toISOString() ?? null,
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    withdrawReason: row.withdrawReason,
    updatedAt: row.updatedAt.toISOString(),
    // Only while the bejelentés is not filed yet: after 'beadva' nobody must read "még ne kezdd el" (round 1).
    activityPending: ACTIVITY_HOLD_STATUSES.includes(row.status) && activityPending(a),
    // SPEC §27.3 / §27.4.4 S12
    mode: row.mode,
    chamber: row.status === 'kesz' ? { dueOn: row.chamberDueOn, doneAt: row.chamberDoneAt?.toISOString() ?? null } : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// transitions
// ---------------------------------------------------------------------------------------------------------------
/** Updates the row's status (+ fields), the derived step row and writes the audit line. */
export async function transition(
  deps: Deps,
  db: DbOrTx,
  row: RegRow,
  to: RegistrationStatus,
  patch: Partial<RegRow>,
  a: { action: string; actorUserId: string | null; actorRole: string; details?: Record<string, unknown> },
): Promise<RegRow> {
  const now = deps.now();
  const [u] = await db
    .update(businessRegistrations)
    .set({ ...patch, status: to, ...(to !== row.status ? { statusChangedAt: now } : {}), updatedAt: now })
    .where(eq(businessRegistrations.id, row.id))
    .returning();
  await setStep(deps, db, row.clientId, 'vallalkozas_inditas', REGISTRATION_STEP_STATUS[to], { note: to === 'javitas' ? (patch.fixNote ?? row.fixNote ?? null) : null });
  await audit(db, { action: a.action, actorUserId: a.actorUserId, actorRole: a.actorRole, targetType: 'business_registration', targetId: row.id, clientId: row.clientId, details: { from: row.status, to, ...(a.details ?? {}) } });
  return u!;
}

/** Adószám with the §19.1 check digit; the middle digit must be 1 (alanyi adómentes ÁFA-kód). */
export function checkRegistrationAdoszam(adoszam: string): { ok: boolean; afaMentes: boolean } {
  const ok = isValidAdoszam(adoszam);
  return { ok, afaMentes: ok && adoszam.trim().split('-')[1] === '1' };
}

/**
 * SPEC §26.1.8: the registration reached 'kesz' → the client's profile and this year's tax profile are filled from
 * the answers (never overwriting a profile the accountant already confirmed), and the step becomes 'kesz'.
 */
export async function fillProfileFromRegistration(deps: Deps, db: DbOrTx, row: RegRow): Promise<void> {
  const a = answersOf(row);
  const [cl] = await db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
  if (!cl) return;
  const main = a.activities.find((x) => x.main);
  const others = a.activities.filter((x) => !x.main).map((x) => x.label);
  // Free text is kept next to list activities too (review k3c2: "Babaúszás-oktatás" was dropped at kesz).
  const free = a.activityFreeText?.trim() ?? '';
  const activityText = [main?.label ?? free, ...others, ...(main && free ? [free] : [])].filter(Boolean).join(', ').slice(0, 200);
  const costClass = costClassOf(a);
  const answer = costClass ? COST_CLASS_ANSWER[costClass] : null;
  const evSince = row.registeredOn ?? row.filedOn ?? todayBudapest(deps.now());
  const seatCity = a.seat?.kind === 'lakcim' || !a.seat ? cl.addressCity : (a.seat.address?.city ?? cl.addressCity);
  const now = deps.now();
  await db
    .update(clients)
    .set({
      adoszam: row.adoszam ?? cl.adoszam,
      evNyilvantartasiSzam: row.evNyilvantartasiSzam ?? cl.evNyilvantartasiSzam,
      evSince,
      hqMunicipality: seatCity ?? cl.hqMunicipality,
      activityText: activityText || cl.activityText,
      activityAnswer: answer ?? cl.activityAnswer,
      activityCode: main?.ovtjKod ?? cl.activityCode,
      hasSeparateBusinessAccount: a.hasSeparateBusinessAccount ?? cl.hasSeparateBusinessAccount,
      updatedAt: now,
    })
    .where(eq(clients.id, cl.id));
  // Round-2 tax finding 4: the profile belongs to the year the business STARTED (a December start recorded in January
  // must still get its year), and to the current year as well when that is later. The current-year cost ratio comes
  // from the current rules (2027: 50 % general).
  const startYear = Number(evSince.slice(0, 4));
  const thisYear = Number(todayBudapest(now).slice(0, 4));
  // Round-2 tax finding 7: a qualified trade starts as a suggestion on the garantált bérminimum (the accountant confirms).
  const mainDef = main?.key ? BUSINESS_ACTIVITIES.find((d) => d.key === main.key) : null;
  for (const year of [...new Set([startYear, thisYear])].sort()) {
    const [tp] = await db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
    if (tp) continue;
    await db.insert(clientTaxProfiles).values({
      clientId: cl.id,
      year,
      status: a.workKind ? WORK_KIND_TAX_STATUS[a.workKind] : 'fofoglalkozasu',
      costRatio: answer ? costRatioForActivity(answer) : 45,
      costRatioSource: 'ugyfel_javaslat',
      retail: answer === 'kiskereskedelem',
      atalanyFrom: evSince.startsWith(String(year)) ? evSince : null,
      guaranteedMinimum: Boolean(mainDef?.kepesitesKellhet && a.workKind === 'fofoglalkozas'),
    });
  }
}

/** The years whose tax profile finishRegistration may have created (recalculated after the transaction). */
export function registrationYears(row: Pick<RegRow, 'registeredOn' | 'filedOn'>, now: Date): number[] {
  const evSince = row.registeredOn ?? row.filedOn ?? todayBudapest(now);
  return [...new Set([Number(evSince.slice(0, 4)), Number(todayBudapest(now).slice(0, 4))])];
}
