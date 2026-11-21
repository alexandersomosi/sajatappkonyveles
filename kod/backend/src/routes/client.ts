// /client – role client, own data only (SPEC §12.4). The client id always comes from the session.
import { and, asc, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { ClientHome, ClientProfile, Deadline, DocumentListItem, Hero } from '../_shared/api.js';
import { ACTIVITY_ANSWERS, CERTIFICATE_TYPES, DOCUMENT_CATEGORIES, MEGHATALMAZAS_METHODS, PAYMENT_ITEM_KINDS, REQUEST_TYPES_BEFORE_ACTIVATION, REQUEST_TYPES_FROM_CLIENT, TAX_STATUSES } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import {
  accountants,
  appointments,
  availabilitySlots,
  certificateRequests,
  clients,
  clientTaxProfiles,
  documents,
  feeInvoices,
  files,
  kycRecords,
  messageAttachments,
  messages,
  navInvoices,
  requests,
  taxPeriods,
} from '../db/schema.js';
import { auditC } from '../audit.js';
import { requireAuth } from '../auth/middleware.js';
import { checkFile, collectFiles, looksSignedPdf, MAX_REQUEST_BYTES } from '../files/upload.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { hmacHex } from '../lib/crypto.js';
import { addDays, capitalize, huDayMonthAn, isIsoDate, isMonthKey, MONTHS_ADJ_HU, todayBudapest, WEEKDAYS_ON_HU, weekdayOf } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { icsFor } from '../lib/ics.js';
import { isValidAdoazonositoJel, isValidAdoszam, isValidPhone, normalizePhone } from '../lib/validators.js';
import { accountantParams, notify } from '../notify/notify.js';
import { costRatioForActivity } from '../tax/engine.js';
import { clientDeadlines, computeFlags } from '../services/flags.js';
import { accountantPublic, clientName, clientOfUser, type ClientRow } from '../services/people.js';
import { afterProfileSubmitted, allDone, assertStepOpen, notifyAccountantReview, onboardingState, pathOf, setStep, steps, stepStatus } from '../services/onboarding.js';
import { assertFeature, documentAlwaysOpen, isOpenAccountantRequest, isRestricted, restrictedMode } from '../services/access.js';
import { registerBekotesRoutes } from './client-bekotes.js';
import { assertUploadQuota } from '../files/quota.js';
import { assistsOfClient, clientApproved, openAssistOf, requestAssist } from '../services/assist.js';
import { isValidHuZip, normalizeHuPhone } from '../_shared/bekotes.js';
import { notifyTeamOfClientMessage } from '../services/team.js';
import { addVersion, createDocument, documentDetail, dossierMonths, dossierView, listItems } from '../services/documents.js';
import { messageDtos, messagePage, openRequestsFromAccountant, postRequestNote, REQUEST_TYPE_TITLES, requestSummary } from '../services/requests.js';
import { computeYear, daysLeft, ensurePeriods, heroPeriod, letterFor, markPaid, paymentItemDto, activeItems, periodDetail, periodSummary, unmarkPaid, recalcYear, periodLabel, periodVisible } from '../services/tax.js';
import { cancelSubscription, deleteCard, resumeSubscription, serviceNotice, startRegistration, subscriptionView } from '../services/subscription.js';
import { clientLegalPdf, filledLegalText } from '../services/contracts.js';
import { markdownToPdf } from '../lib/pdf.js';
import { pepAad } from '../services/kyc.js';
import { augmentHome, invoiceReserves, registerClientK28Routes } from './client-k28.js';
import { registerClientPaymentsK29 } from './payments-k29.js';
import { registerClientK29gRoutes } from './client-k29g.js';
import { registerClientK29fRoutes } from './client-k29f.js';
import { clientServiceLock } from '../services/zarolas.js';
import { blocksActivation, employerRow } from '../services/alkalmazott.js';

async function client(c: C, deps: Deps): Promise<ClientRow> {
  return clientOfUser(deps.db, auth(c).userId);
}

async function accFor(deps: Deps, cl: ClientRow) {
  const [a] = cl.accountantId ? await deps.db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
  return a ?? null;
}

function uploadLimit(deps: Deps, c: C) {
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > MAX_REQUEST_BYTES) throw E.tooLarge('Egyszerre legfeljebb 60 MB-ot küldhetsz.');
  // A new client catching up on a year of receipts uploads a lot at once: 600 per hour.
  const h = deps.limiter.hit(`upload:${auth(c).userId}`, 600, 3600_000);
  if (!h.ok) throw E.rateLimited(h.retryAfterSec, `Ebben az órában már nagyon sok iratot feltöltöttél. Próbáld újra kb. ${Math.max(1, Math.ceil(h.retryAfterSec / 60))} perc múlva.`);
}

const ROMAN_Q = ['I', 'II', 'III', 'IV'];
/** "Mióta vagy egyéni vállalkozó?" – the EV register in its present form starts in 1990. */
const EV_SINCE_MIN = '1990-01-01';

export function clientRoutes(deps: Deps) {
  const r = new Hono<Env>();
  r.use('*', requireAuth(deps, { roles: ['client'] }));
  // Nothing reaches the accountant (identity papers, documents, messages, bookings) from an address
  // that was never confirmed: every write needs a verified e-mail (the app sends the user to the
  // code screen first, so this only stops scripted or stale clients).
  r.use('*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && !auth(c).emailVerified) {
      throw new ApiError(409, 'email_not_verified', 'Előbb erősítsd meg az e-mail-címedet. A kódot a regisztrációkor küldtük el.');
    }
    await next();
  });
  // SPEC §27.11 S9: a client whose service ended ('megszunt') keeps read access (dossier, export under /me) but
  // writes nothing any more; a disabled account is refused at sign-in and by requireAuth (users.status).
  r.use('*', async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const [cl] = await deps.db.select({ lifecycle: clients.lifecycle }).from(clients).where(eq(clients.userId, auth(c).userId)).limit(1);
      if (cl?.lifecycle === 'megszunt') throw new ApiError(403, 'megszunt', 'A szolgáltatásod megszűnt, ezért itt már nem tudsz módosítani. Az irataidat továbbra is látod és letöltheted.');
    }
    await next();
  });
  // SPEC §26.5: restricted mode before activation, enforced here (403 locked_until_active + feature).
  r.use('*', restrictedMode(deps));
  // SPEC §28.K.5: the service lock for an unpaid fee (403 service_locked on the listed writes).
  r.use('*', clientServiceLock(deps));
  // SPEC §28 / §28.K routes (change kinds of /guides and /assist first; the rest falls through).
  // SPEC §29.1 / §29.4.4 (B1): Stripe / DEMO card flows, fees with the saved card, taxpayer lookup (legacy bodies fall through).
  registerClientPaymentsK29(r, deps);
  registerClientK28Routes(r, deps);
  // SPEC §29.10 G: the guided first run (GET/POST /client/guided).
  registerClientK29gRoutes(r, deps);
  // SPEC §29 F1/F2/F4: certificates, income statement, calendar (+ the label-only /deadlines/:id/ics).
  registerClientK29fRoutes(r, deps);
  // SPEC §26: branch question, new-business registration, guides, explainers, access matrix, callbacks.
  registerBekotesRoutes(r, deps);

  // ================= onboarding =================
  r.get('/onboarding', async (c) => {
    const cl = await client(c, deps);
    return c.json(await onboardingState(deps, deps.db, cl.id));
  });

  const profileSchema = z.object({
    firstName: z.string().trim().min(1, { error: 'Kötelező.' }).max(60),
    lastName: z.string().trim().min(1, { error: 'Kötelező.' }).max(60),
    birthName: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(30).optional(),
    adoazonositoJel: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s/g, ''))
      .refine((v) => v === '' || /^\d{10}$/.test(v), { error: '10 számjegy.' })
      .refine((v) => v === '' || isValidAdoazonositoJel(v), { error: 'Ez az adóazonosító jel nem stimmel. Nézd meg a kártyán.' })
      .optional(),
    // SPEC §28.K.9 / §29.10: '' is accepted only when the client chose "Most nem tudom" (adoszamPending) – checked below
    adoszam: z.string().trim().refine((v) => v === '' || isValidAdoszam(v), { error: 'Ez az adószám nem stimmel (formátum: 12345678-1-23).' }),
    evNyilvantartasiSzam: z.string().trim().max(20).optional(),
    // Same rules as the new-business form (SPEC §26.1.3): a Hungarian postcode never starts with 0.
    address: z.object({
      zip: z.string().trim().refine(isValidHuZip, { error: 'Négyjegyű irányítószám kell (például 1136).' }),
      city: z.string().trim().min(1, { error: 'Írd be a települést.' }).max(60),
      line: z.string().trim().min(3, { error: 'Írd be az utcát és a házszámot.' }).max(120),
    }),
    hqMunicipality: z.string().trim().min(1).max(60),
    activityText: z.string().trim().min(1).max(200),
    activityAnswer: z.enum(ACTIVITY_ANSWERS),
    taxStatus: z.enum(TAX_STATUSES),
    evSince: z.string().refine(isIsoDate, { error: 'Dátum kell (ÉÉÉÉ-HH-NN).' }),
    previousAccountant: z.string().trim().max(120).optional(),
    hasSeparateBusinessAccount: z.boolean(),
    /** "Jár-e valamilyen SZJA-kedvezmény?" (optional questionnaire answer; the accountant confirms it). */
    allowances: z.array(z.object({ kind: z.enum(['csaladi', 'fiatal_25', 'anyak', 'egyeb']), note: z.string().trim().max(200).optional() })).max(6).optional(),
  });

  async function profileDto(cl: ClientRow): Promise<ClientProfile> {
    const year = Number(todayBudapest(deps.now()).slice(0, 4));
    const [tp] = await deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
    return {
      firstName: cl.firstName,
      lastName: cl.lastName,
      phone: cl.phoneEnc ? deps.data.dec(cl.phoneEnc, 'clients.phone') : undefined,
      adoszam: cl.adoszam ?? '',
      evNyilvantartasiSzam: cl.evNyilvantartasiSzam ?? undefined,
      address: { zip: cl.addressZip ?? '', city: cl.addressCity ?? '', line: cl.addressLine ?? '' },
      hqMunicipality: cl.hqMunicipality ?? '',
      activityText: cl.activityText ?? '',
      activityAnswer: cl.activityAnswer ?? null,
      taxStatus: tp?.status ?? null,
      evSince: cl.evSince ?? '',
      previousAccountant: cl.previousAccountant ?? undefined,
      hasSeparateBusinessAccount: cl.hasSeparateBusinessAccount ?? null,
      adoazonositoJelMasked: cl.adoazonositoLast3 ? `•••••••${cl.adoazonositoLast3}` : '',
      suggestedCostRatio: costRatioForActivity(cl.activityAnswer ?? 'egyeb'),
      confirmedCostRatio: tp?.costRatioSource === 'konyvelo_megerositette' ? (tp.costRatio as 45 | 80 | 90) : null,
      // §28.K.9 / §29.10: the Adataid form skips the adószám after "Most nem tudom"
      ...(cl.adoszamPending ? { adoszamPending: true } : {}),
    };
  }

  r.get('/profile', async (c) => c.json(await profileDto(await client(c, deps))));

  // SPEC §26.1.2: on the new-business path only the "Rólad" page is asked; the business fields come from the
  // registration when it reaches 'kesz'.
  const startProfileSchema = z.object({
    firstName: z.string().trim().min(1, { error: 'Kötelező.' }).max(60),
    lastName: z.string().trim().min(1, { error: 'Kötelező.' }).max(60),
    phone: z.string().trim().max(30),
    adoazonositoJel: profileSchema.shape.adoazonositoJel,
    address: profileSchema.shape.address,
  });

  r.put('/profile', async (c) => {
    const cl = await client(c, deps);
    if (pathOf(cl) === 'inditas') {
      const b = await readJson(c, startProfileSchema);
      const adoJel = b.adoazonositoJel || null;
      if (!adoJel && !cl.adoazonositoJelEnc) throw E.validation({ adoazonositoJel: 'Add meg az adóazonosító jeledet (10 számjegy, a kártyán van).' });
      const phone = normalizeHuPhone(b.phone);
      if (!phone) throw E.validation({ phone: 'Magyar telefonszámot adj meg, például +36 30 123 4567.' });
      await deps.db.transaction(async (tx) => {
        await tx
          .update(clients)
          .set({
            firstName: b.firstName,
            lastName: b.lastName,
            phoneEnc: deps.data.enc(phone, 'clients.phone'),
            ...(adoJel ? { adoazonositoJelEnc: deps.data.enc(adoJel, 'clients.adoazonosito_jel'), adoazonositoHmac: hmacHex(deps.lookupKey, adoJel), adoazonositoLast3: adoJel.slice(-3) } : {}),
            addressZip: b.address.zip,
            addressCity: b.address.city,
            addressLine: b.address.line,
            updatedAt: deps.now(),
          })
          .where(eq(clients.id, cl.id));
        const wasDone = (await stepStatus(tx, cl.id, 'adatok')) === 'kesz';
        await setStep(deps, tx, cl.id, 'adatok', 'kesz');
        if (!wasDone) await afterProfileSubmitted(deps, tx, cl.id);
        await auditC(c, tx, 'client.profile_updated', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { first: !wasDone, path: 'inditas' } });
      });
      return c.json(await profileDto(await client(c, deps)));
    }
    // SPEC §27.2.2: the full data form of an existing business never sets the branch silently (walkthrough problem 3).
    if (!cl.businessStatus && cl.lifecycle === 'bekotes_alatt') throw new ApiError(409, 'path_required', await deps.content.render('bekotes.ut.path_required', {}));
    const b = await readJson(c, profileSchema);
    // Once stored, the adóazonosító jel may be left empty (the app only shows the masked value).
    const adoJel = b.adoazonositoJel || null;
    if (!adoJel && !cl.adoazonositoJelEnc) throw E.validation({ adoazonositoJel: 'Add meg az adóazonosító jeledet (10 számjegy, a kártyán van).' });
    if (b.phone && !isValidPhone(b.phone)) throw E.validation({ phone: 'Ez nem tűnik telefonszámnak.' });
    if (b.evSince > todayBudapest(deps.now())) throw E.validation({ evSince: 'Nem lehet a jövőben.' });
    if (b.evSince < EV_SINCE_MIN) throw E.validation({ evSince: 'Nézd meg az évszámot: 1990 előtti dátumot nem tudunk elfogadni.' });
    // §28.K.9 "Most nem tudom": onboarding is never blocked on the adószám – the accountant fills it from ONYA later
    if (!b.adoszam && !cl.adoszamPending && !cl.adoszam) throw E.validation({ adoszam: 'Add meg az adószámodat (formátum: 12345678-1-23).' });
    // The service is for alanyi ÁFA-mentes sole traders only: the middle digit of the adószám (ÁFA-kód) must be 1.
    // 2 = ÁFA-körös, 3 = EVA, 4/5 = csoportos. Before round 1 (2026-11-19) such a client could go on, sign and pay.
    if (b.adoszam && b.adoszam.split('-')[1] !== '1') {
      await auditC(c, deps.db, 'client.profile_refused', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { reason: 'afa_kod', afaKod: b.adoszam.split('-')[1] } });
      throw new ApiError(400, 'validation_failed', await deps.content.render('adatok.stop.nem_afamentes', {}), { adoszam: await deps.content.render('adatok.stop.nem_afamentes', {}) }, { stop: 'nem_afamentes' });
    }
    const now = deps.now();
    const year = Number(todayBudapest(now).slice(0, 4));
    const firstSubmit = (await stepStatus(deps.db, cl.id, 'adatok')) !== 'kesz';
    await deps.db.transaction(async (tx) => {
      await tx
        .update(clients)
        .set({
          firstName: b.firstName,
          lastName: b.lastName,
          birthName: b.birthName ?? null,
          phoneEnc: b.phone ? deps.data.enc(normalizePhone(b.phone), 'clients.phone') : null,
          ...(adoJel
            ? {
                adoazonositoJelEnc: deps.data.enc(adoJel, 'clients.adoazonosito_jel'),
                adoazonositoHmac: hmacHex(deps.lookupKey, adoJel),
                adoazonositoLast3: adoJel.slice(-3),
              }
            : {}),
          ...(b.adoszam ? { adoszam: b.adoszam } : {}),
          evNyilvantartasiSzam: b.evNyilvantartasiSzam ?? null,
          // An already active legacy client without an answer is an existing business (only onboarding asks first).
          ...(cl.businessStatus ? {} : { businessStatus: 'van' as const }),
          addressZip: b.address.zip,
          addressCity: b.address.city,
          addressLine: b.address.line,
          hqMunicipality: b.hqMunicipality,
          activityText: b.activityText,
          activityAnswer: b.activityAnswer,
          evSince: b.evSince,
          previousAccountant: b.previousAccountant ?? null,
          hasSeparateBusinessAccount: b.hasSeparateBusinessAccount,
          updatedAt: now,
        })
        .where(eq(clients.id, cl.id));
      const [tp] = await tx.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
      const evStartYear = Number(b.evSince.slice(0, 4));
      if (!tp) {
        await tx.insert(clientTaxProfiles).values({
          clientId: cl.id,
          year,
          costRatio: costRatioForActivity(b.activityAnswer),
          costRatioSource: 'ugyfel_javaslat',
          status: b.taxStatus,
          retail: b.activityAnswer === 'kiskereskedelem',
          atalanyFrom: evStartYear === year ? b.evSince : null,
          ...(b.allowances?.length ? { allowances: b.allowances } : {}),
        });
      } else if (tp.costRatioSource !== 'konyvelo_megerositette') {
        await tx.update(clientTaxProfiles).set({ costRatio: costRatioForActivity(b.activityAnswer), status: b.taxStatus, retail: b.activityAnswer === 'kiskereskedelem', updatedAt: now }).where(eq(clientTaxProfiles.id, tp.id));
      }
      if (tp && b.allowances !== undefined) await tx.update(clientTaxProfiles).set({ allowances: b.allowances.length ? b.allowances : null, updatedAt: now }).where(eq(clientTaxProfiles.id, tp.id));
      const wasDone = (await stepStatus(tx, cl.id, 'adatok')) === 'kesz';
      await setStep(deps, tx, cl.id, 'adatok', 'kesz');
      if (!wasDone) await afterProfileSubmitted(deps, tx, cl.id);
      await auditC(c, tx, 'client.profile_updated', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { first: !wasDone } });
    });
    if (firstSubmit) await notifyAccountantReview(deps, deps.db, cl.id, 'Adatok kitöltve – erősítsd meg a költséghányadot').catch(() => undefined);
    await recalcYear(deps, deps.db, cl.id, year).catch(() => undefined);
    return c.json(await profileDto(await client(c, deps)));
  });

  // 11-19 javítás (owner order 2/4): the 3-page data form of an existing business saves each page on "Tovább" – and
  // page 1 before a branch change – so nothing typed is lost when the client leaves to find his adóigazolvány or switches
  // to "Még nincs, most indítanám". A draft never changes a step, never stores the adószám (that would block the switch,
  // SPEC §27.2.1) and never touches the tax profile; invalid values are simply not stored (the final "Mentés" validates
  // everything). Only during onboarding.
  r.put('/profile/draft', async (c) => {
    const cl = await client(c, deps);
    if (cl.lifecycle !== 'bekotes_alatt') throw E.conflict('A profilodat az Adataid lapon mentheted.');
    const raw = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw E.validation({ body: 'Hibás kérés.' });
    const str = (k: string, max: number) => (typeof raw[k] === 'string' && (raw[k] as string).trim() && (raw[k] as string).trim().length <= max ? (raw[k] as string).trim() : null);
    const set: Partial<typeof clients.$inferInsert> = {};
    const saved: string[] = [];
    const fn = str('firstName', 60);
    const ln = str('lastName', 60);
    if (fn) (set.firstName = fn), saved.push('firstName');
    if (ln) (set.lastName = ln), saved.push('lastName');
    const phone = typeof raw.phone === 'string' ? normalizeHuPhone(raw.phone) : null;
    if (phone) (set.phoneEnc = deps.data.enc(phone, 'clients.phone')), saved.push('phone');
    const adoJel = typeof raw.adoazonositoJel === 'string' ? raw.adoazonositoJel.replace(/\s/g, '') : '';
    if (/^\d{10}$/.test(adoJel) && isValidAdoazonositoJel(adoJel)) {
      Object.assign(set, { adoazonositoJelEnc: deps.data.enc(adoJel, 'clients.adoazonosito_jel'), adoazonositoHmac: hmacHex(deps.lookupKey, adoJel), adoazonositoLast3: adoJel.slice(-3) });
      saved.push('adoazonositoJel');
    }
    const addr = raw.address as { zip?: unknown; city?: unknown; line?: unknown } | undefined;
    if (addr && typeof addr === 'object') {
      const zip = typeof addr.zip === 'string' ? addr.zip.trim() : '';
      const city = typeof addr.city === 'string' ? addr.city.trim() : '';
      const line = typeof addr.line === 'string' ? addr.line.trim() : '';
      if (isValidHuZip(zip) && city && city.length <= 60 && line.length >= 3 && line.length <= 120) Object.assign(set, { addressZip: zip, addressCity: city, addressLine: line }), saved.push('address');
    }
    const ev = str('evNyilvantartasiSzam', 20);
    if (ev) (set.evNyilvantartasiSzam = ev), saved.push('evNyilvantartasiSzam');
    const hq = str('hqMunicipality', 60);
    if (hq) (set.hqMunicipality = hq), saved.push('hqMunicipality');
    const act = str('activityText', 200);
    if (act) (set.activityText = act), saved.push('activityText');
    if (typeof raw.activityAnswer === 'string' && (ACTIVITY_ANSWERS as readonly string[]).includes(raw.activityAnswer)) (set.activityAnswer = raw.activityAnswer as (typeof ACTIVITY_ANSWERS)[number]), saved.push('activityAnswer');
    if (typeof raw.evSince === 'string' && isIsoDate(raw.evSince) && raw.evSince <= todayBudapest(deps.now()) && raw.evSince >= EV_SINCE_MIN) (set.evSince = raw.evSince), saved.push('evSince');
    const prev = str('previousAccountant', 120);
    if (prev) (set.previousAccountant = prev), saved.push('previousAccountant');
    if (typeof raw.hasSeparateBusinessAccount === 'boolean') (set.hasSeparateBusinessAccount = raw.hasSeparateBusinessAccount), saved.push('hasSeparateBusinessAccount');
    if (saved.length) {
      await deps.db.update(clients).set({ ...set, updatedAt: deps.now() }).where(eq(clients.id, cl.id));
      await auditC(c, deps.db, 'client.profile_draft_saved', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { fields: saved } });
    }
    return c.json(await profileDto(await client(c, deps)));
  });

  r.get('/legal-pdf/:docType', async (c) => {
    const cl = await client(c, deps);
    const t = c.req.param('docType');
    let pdf: Buffer;
    if (t === 'megbizasi_szerzodes' || t === 'nav_meghatalmazas') pdf = await clientLegalPdf(deps, cl.id, t);
    else if (t === 'aszf' || t === 'adatkezeles') {
      // The same text the client accepts (filled with brand/company data), as a PDF.
      const f = await filledLegalText(deps, t, cl.id);
      pdf = await markdownToPdf(deps.cfg.fontDir, deps.legal.current(t).title, f.text);
    } else throw E.notFound();
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `inline; filename="${t}.pdf"`);
    return c.body(new Uint8Array(pdf));
  });

  r.post('/onboarding/meghatalmazas', async (c) => {
    const cl = await client(c, deps);
    const b = await readJson(c, z.object({ method: z.enum(MEGHATALMAZAS_METHODS), fileId: z.string().uuid().optional(), approved: z.boolean().optional() }));
    if (b.method === 'alairt_pdf' && !cl.alairtPdfAllowed) throw E.forbidden('Ezt a módot a könyvelőd kapcsolhatja be neked.');
    // SPEC §27.3.2 compatibility (old app builds): "onya_konyvelo" = the assisted meghatalmazás request; with
    // `approved` = the client's "Jóváhagytam" on the open request.
    if (b.method === 'onya_konyvelo') {
      if (b.approved) {
        const open = (await assistsOfClient(deps.db, cl.id)).find((x) => x.status === 'meghatalmazas_bekuldve' || x.status === 'meghatalmazas_lejart' || x.status === 'meghatalmazas_jovahagyva');
        if (open) {
          await deps.db.transaction((tx) => clientApproved(deps, tx, cl, open.id, auth(c).userId));
          return c.json(await onboardingState(deps, deps.db, cl.id));
        }
        // No assist in the approval state (the accountant used the older step page): the step-based flow as before –
        // but only when the accountant really filed it for this client (step data says so) and the step is open.
        const cur0 = (await steps(deps.db, cl.id)).get('meghatalmazas');
        if (cur0?.status === 'kesz') throw E.conflict('A meghatalmazás már rendben van.');
        try {
          await assertStepOpen(deps, deps.db, cl, 'meghatalmazas');
        } catch (e) {
          // the contract lock alone does not stop an approval the client already gave in ONYA
          if (!(e instanceof ApiError && e.code === 'step_locked' && /szerz[őo]d/i.test(e.message))) throw e;
        }
        const d0 = (cur0?.data ?? {}) as { method?: string; submittedBy?: string; byAccountant?: boolean };
        if (d0.method !== 'onya_konyvelo') throw E.conflict('Most nincs mit jóváhagynod: a könyvelőd még nem küldte be a meghatalmazást. Ha beküldte, értesítünk.');
        const data0 = { ...((cur0?.data ?? {}) as Record<string, unknown>), method: 'onya_konyvelo', submittedAt: deps.now().toISOString(), clientApprovedAt: deps.now().toISOString() };
        await setStep(deps, deps.db, cl.id, 'meghatalmazas', 'konyvelore_var', { data: data0, note: null });
        await auditC(c, deps.db, 'onboarding.meghatalmazas_submitted', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { method: 'onya_konyvelo', approved: true } });
        await notifyAccountantReview(deps, deps.db, cl.id, 'Jóváhagyta a meghatalmazást az ONYA-ban – ellenőrizd a NAV-nál');
      } else {
        const existing = await openAssistOf(deps.db, cl.id, 'meghatalmazas');
        if (!existing && !(await openAssistOf(deps.db, cl.id, 'vallalkozas_bejelentes')))
          await deps.db.transaction((tx) => requestAssist(deps, tx, { cl, kind: 'meghatalmazas', source: 'meghatalmazas_utmutato', by: { userId: auth(c).userId, role: 'client' }, callbackOptional: true }));
      }
      return c.json(await onboardingState(deps, deps.db, cl.id));
    }
    await assertStepOpen(deps, deps.db, cl, 'meghatalmazas');
    const cur = (await steps(deps.db, cl.id)).get('meghatalmazas');
    if (cur?.status === 'kesz') throw E.conflict('A meghatalmazás már rendben van.');
    let fileId: string | null = null;
    if (b.fileId) {
      const [f] = await deps.db.select().from(files).where(and(eq(files.id, b.fileId), eq(files.ownerClientId, cl.id), isNull(files.deletedAt))).limit(1);
      if (!f) throw E.validation({ fileId: 'Nem találjuk a feltöltött fájlt.' });
      if (b.method === 'alairt_pdf') {
        const data = await deps.storage.read(f);
        if (!looksSignedPdf(data)) throw E.validation({ fileId: 'Ebben a PDF-ben nem találunk elektronikus aláírást. Írd alá a DÁP appal, és az aláírt fájlt töltsd fel.' });
      }
      fileId = f.id;
    } else if (b.method === 'alairt_pdf') throw E.validation({ fileId: 'Töltsd fel az aláírt PDF-et.' });
    const data = { method: b.method, submittedAt: deps.now().toISOString(), ...(fileId ? { fileId } : {}), ...(b.approved ? { clientApprovedAt: deps.now().toISOString() } : {}) };
    await setStep(deps, deps.db, cl.id, 'meghatalmazas', 'konyvelore_var', { data, note: null });
    await auditC(c, deps.db, 'onboarding.meghatalmazas_submitted', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { method: b.method, withFile: Boolean(fileId), approved: Boolean(b.approved) } });
    await notifyAccountantReview(deps, deps.db, cl.id, 'Meghatalmazás beküldve – ellenőrizd a NAV-nál');
    return c.json(await onboardingState(deps, deps.db, cl.id));
  });

  r.post('/kyc', async (c) => {
    const cl = await client(c, deps);
    await assertStepOpen(deps, deps.db, cl, 'azonositas');
    uploadLimit(deps, c);
    await assertUploadQuota(deps, deps.db, cl, Number(c.req.header('content-length') ?? '0'));
    const body = await c.req.parseBody({ all: true });
    const get = async (k: string) => (await collectFiles(body, k))[0];
    const parts = { idFront: await get('idFront'), idBack: await get('idBack'), addressFront: await get('addressFront') };
    await assertUploadQuota(deps, deps.db, cl, Object.values(parts).reduce((a, f) => a + (f?.data.length ?? 0), 0));
    if (!parts.idFront) throw E.validation({ idFront: 'Fotózd le az okmányod elejét.' });
    if (!parts.addressFront) throw E.validation({ addressFront: 'Fotózd le a lakcímkártyád címoldalát.' });
    let data: unknown;
    let decl: unknown;
    try {
      data = JSON.parse(String(body.data ?? '{}'));
      decl = JSON.parse(String(body.declarations ?? '{}'));
    } catch {
      throw E.validation(undefined, 'Hibás adatok.');
    }
    // Accepts both the SPEC field names and the app's (name / mothersBirthName / szemelyi / notifyChanges).
    const raw = (data ?? {}) as Record<string, unknown>;
    const rawDecl = (decl ?? {}) as Record<string, unknown>;
    const fullName = typeof raw.name === 'string' ? raw.name.trim() : '';
    const normalized = {
      familyName: raw.familyName ?? (fullName ? fullName.split(/\s+/)[0] : undefined),
      givenName: raw.givenName ?? (fullName ? fullName.split(/\s+/).slice(1).join(' ') || fullName : undefined),
      birthName: raw.birthName ?? fullName,
      motherBirthName: raw.motherBirthName ?? raw.mothersBirthName,
      birthPlace: raw.birthPlace,
      birthDate: raw.birthDate,
      citizenship: raw.citizenship,
      address: raw.address,
      documentType: raw.documentType === 'szemelyi' ? 'szemelyi_igazolvany' : raw.documentType,
      documentNumber: raw.documentNumber,
      documentExpiry: raw.documentExpiry,
    };
    const d = z
      .object({
        familyName: z.string().trim().min(1).max(60),
        givenName: z.string().trim().min(1).max(60),
        birthName: z.string().trim().min(1).max(120),
        motherBirthName: z.string().trim().min(1).max(120),
        birthPlace: z.string().trim().min(1).max(60),
        birthDate: z.string().refine(isIsoDate),
        citizenship: z.string().trim().min(1).max(40),
        address: z.string().trim().min(1).max(200),
        documentType: z.enum(['szemelyi_igazolvany', 'utlevel', 'jogositvany']),
        documentNumber: z.string().trim().min(5).max(20),
        documentExpiry: z.string().refine(isIsoDate),
      })
      .safeParse(normalized);
    // SPEC §27.4.4 S18: client wording says "anyukád" (the legal field name stays "anyja születési neve").
    const KYC_MSG: Record<string, string> = { motherBirthName: 'Írd be anyukád születési nevét.', birthName: 'Írd be a születési neved.', documentNumber: 'Írd be az igazolvány számát.', documentExpiry: 'Írd be, meddig érvényes az igazolvány.' };
    if (!d.success) throw E.validation(Object.fromEntries(d.error.issues.map((i) => [`data.${i.path.join('.')}`, KYC_MSG[String(i.path[0])] ?? 'Kötelező vagy hibás.'])));
    {
      // Born in the past, at least 18 (an egyéni vállalkozó is of age), at most 110 years old.
      const todayK = todayBudapest(deps.now());
      const yearsBefore = (n: number) => `${Number(todayK.slice(0, 4)) - n}${todayK.slice(4)}`;
      if (d.data.birthDate > todayK) throw E.validation({ 'data.birthDate': 'A születési idő nem lehet a jövőben.' });
      if (d.data.birthDate > yearsBefore(18)) throw E.validation({ 'data.birthDate': 'Egyéni vállalkozó csak nagykorú lehet. Nézd meg a születési időt.' });
      if (d.data.birthDate < yearsBefore(110)) throw E.validation({ 'data.birthDate': 'Nézd meg az évszámot a születési időnél.' });
    }
    const dc = z
      .object({ ownBehalf: z.literal(true, { error: 'Ezt el kell fogadnod.' }), pep: z.boolean(), pepDetails: z.string().max(500).optional(), truthful: z.literal(true), changeDuty: z.literal(true) })
      .safeParse({ ownBehalf: rawDecl.ownBehalf, pep: rawDecl.pep, pepDetails: rawDecl.pepDetails, truthful: rawDecl.truthful, changeDuty: rawDecl.changeDuty ?? rawDecl.notifyChanges });
    if (!dc.success) throw E.validation(Object.fromEntries(dc.error.issues.map((i) => [`declarations.${i.path.join('.')}`, 'Ezt el kell fogadnod.'])));
    if (dc.data.pep && !dc.data.pepDetails?.trim()) throw E.validation({ 'declarations.pepDetails': 'Írd le röviden, milyen közszereplő vagy.' });
    if (d.data.documentType !== 'utlevel' && !parts.idBack) throw E.validation({ idBack: 'Fotózd le az okmányod hátoldalát is.' });
    if (d.data.documentExpiry < todayBudapest(deps.now())) throw E.validation({ 'data.documentExpiry': 'Ez az okmány lejárt.' });
    const stored: Record<string, string> = {};
    // Legal hold while the relationship lasts; the 8-year clock starts when it ends (services/kyc.ts).
    const kycUntil = null;
    await deps.db.transaction(async (tx) => {
      for (const [k, f] of Object.entries(parts)) {
        if (!f) continue;
        const ok = checkFile(f);
        const row = await deps.storage.put(tx, { ownerClientId: cl.id, kind: 'kyc', mime: ok.mime, displayName: `${k}${ok.mime === 'application/pdf' ? '.pdf' : '.jpg'}`, data: ok.data, createdBy: auth(c).userId, retentionUntil: kycUntil, now: deps.now() });
        stored[k] = row.id;
      }
      await tx.insert(kycRecords).values({
        clientId: cl.id,
        status: 'bekuldve',
        dataEnc: deps.data.encJson(d.data, `kyc_records:${cl.id}`),
        declarations: { ownBehalf: dc.data.ownBehalf, truthful: dc.data.truthful, changeDuty: dc.data.changeDuty, signedAt: deps.now().toISOString() },
        declarationsEnc: deps.data.encJson({ pep: dc.data.pep, ...(dc.data.pep && dc.data.pepDetails?.trim() ? { pepDetails: dc.data.pepDetails.trim() } : {}) }, pepAad(cl.id)),
        files: { idFront: stored.idFront!, ...(stored.idBack ? { idBack: stored.idBack } : {}), addressFront: stored.addressFront! },
      });
      await setStep(deps, tx, cl.id, 'azonositas', 'konyvelore_var', { note: null });
      await auditC(c, tx, 'kyc.submitted', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { documentType: d.data.documentType } });
    });
    await notifyAccountantReview(deps, deps.db, cl.id, 'Azonosítás beküldve – nézd át az okmányokat');
    return c.json({ status: 'bekuldve' }, 201);
  });

  r.get('/kyc', async (c) => {
    const cl = await client(c, deps);
    const [k] = await deps.db.select().from(kycRecords).where(eq(kycRecords.clientId, cl.id)).orderBy(desc(kycRecords.submittedAt)).limit(1);
    if (!k) return c.json({ status: null });
    return c.json({ status: k.status, ...(k.reviewNote && k.status === 'hianyos' ? { reviewNote: k.reviewNote } : {}) });
  });

  // ================= home, tax, revenue =================
  r.get('/home', async (c) => {
    const cl = await client(c, deps);
    const acc = await accFor(deps, cl);
    const ap = accountantPublic(acc);
    const today = todayBudapest(deps.now());
    const year = Number(today.slice(0, 4));
    const st = await steps(deps.db, cl.id);
    const onboardingComplete = st.size > 0 && allDone(st, pathOf(cl));
    const comp = await computeYear(deps.db, cl.id, year, today);
    let hero: Hero = { state: 'bekotes_alatt' };
    let letter: ClientHome['letter'] = null;
    let paymentItems: ClientHome['paymentItems'] = [];
    if (cl.lifecycle !== 'bekotes_alatt') {
      const hp = await heroPeriod(deps.db, cl.id, today);
      if (hp) {
        const p = hp.period;
        const items = p.calcStatus === 'jovahagyva' ? await activeItems(deps.db, p.id) : [];
        // A closed quarter (hp.closed) carries its own estimate, computed in the quarter's year (it may be last year's).
        const total = p.calcStatus === 'jovahagyva' ? items.reduce((a, b) => a + b.amountHuf, 0) : (hp.estimateHuf ?? comp?.result.quarters.find((q) => q.periodKey === p.periodKey)?.totalHuf ?? 0);
        // "Befizetted …, november 18-án": the day the LAST transfer was made (the payment was complete then).
        const paidDates = items.map((i) => i.markedPaidOn).filter((d): d is string => Boolean(d)).sort();
        const paidOn = paidDates.at(-1) ?? undefined;
        // k6c2: the running quarter's estimate already holds the fixed járulék of its months still to come (főfoglalkozású):
        // the band must not call that "eddig ennyi gyűlt össze"
        const hq = hp.state === 'becsles' && !hp.closed ? comp?.result.quarters.find((q) => q.periodKey === p.periodKey) : undefined;
        const futureFixedMonths = hq ? hq.months.filter((l) => l.future && l.insured && (l.minimumHuf ?? 0) > 0).map((l) => l.month) : [];
        const futureAdj = futureFixedMonths.map((m) => MONTHS_ADJ_HU[m - 1] ?? '');
        const honapok = futureAdj.length <= 1 ? (futureAdj[0] ?? '') : `${futureAdj.slice(0, -1).join(', ')} és ${futureAdj.at(-1)}`;
        hero = {
          state: hp.state,
          periodId: p.id,
          periodKey: p.periodKey,
          periodLabel: periodLabel(p),
          amountHuf: total,
          dueDate: p.dueDate,
          daysLeft: daysLeft(today, p.dueDate),
          ...(paidOn ? { paidOn } : {}),
          verified: p.paymentStatus === 'ellenorizve',
          ...(hp.state === 'becsles'
            ? { note: await deps.content.render(hp.closed ? 'ui.hero.veglegesites_note' : futureFixedMonths.length ? 'ui.hero.becsles_note_fix' : 'ui.hero.becsles_note', { firstName: ap.firstName, honapok }) }
            : {}),
          ...(futureFixedMonths.length ? { futureFixedMonths } : {}),
          ...(p.paymentStatus === 'elteres' ? { note: `${ap.firstName} eltérést látott a befizetésnél. Nézd meg az üzeneteidet.` } : {}),
        };
        if (hp.state === 'jovahagyva' || hp.state === 'befizetve') {
          paymentItems = items.map(paymentItemDto);
          letter = await letterFor(deps.db, p, cl.firstName, acc);
        } else if (hp.state === 'becsles') {
          letter = {
            greeting: `Kedves ${cl.firstName}!`,
            body: await deps.content.render(hp.closed ? 'ui.home.letter_veglegesites' : hero.futureFixedMonths?.length ? 'ui.home.letter_becsles_fix' : 'ui.home.letter_becsles', { firstName: ap.firstName }),
            signedBy: ap.displayName,
            signedRole: 'könyvelőd',
            date: today,
          };
        }
      }
    }
    const curMonth = today.slice(0, 7);
    const docs = await deps.db
      .select()
      .from(documents)
      .where(and(eq(documents.clientId, cl.id), eq(documents.dossierMonth, curMonth), isNull(documents.deletedAt), eq(documents.visibility, 'kozos')))
      .orderBy(desc(documents.createdAt));
    const items = await listItems(deps.db, docs.slice(0, 4), { firstName: ap.firstName, staff: false });
    const [navCount] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(navInvoices).where(and(eq(navInvoices.clientId, cl.id), eq(navInvoices.dossierMonth, curMonth)));
    const reqs = await openRequestsFromAccountant(deps.db, cl.id);
    const deadlines = (await clientDeadlines(deps, deps.db, cl.id, today, addDays(today, 400))).filter((d) => d.status !== 'kesz');
    const emptyMeter = { usedHuf: 0, limitHuf: 0, projectedHuf: 0, ratio: 0, warning: false, sentence: '' };
    const m = comp?.result.meters;
    const home: ClientHome = {
      today,
      demo: deps.cfg.appEnv === 'demo',
      client: { id: cl.id, firstName: cl.firstName, lifecycle: cl.lifecycle, onboardingComplete },
      accountant: ap,
      hero,
      letter,
      paymentItems,
      requestsFromAccountant: await Promise.all(reqs.map((x) => requestSummary(deps.db, x, ap.firstName))),
      limits: {
        afa: m?.afa ?? emptyMeter,
        atalanyCap: m?.atalanyCap ?? emptyMeter,
        adomentes: m ? { reached: m.adomentes.reached, reachedMonth: m.adomentes.reachedMonth, limitHuf: m.adomentes.limitHuf, sentence: m.adomentes.sentence } : { reached: false, reachedMonth: null, limitHuf: 1_936_800, sentence: '' },
      },
      revenueByMonth: comp?.result.revenueByMonth ?? [],
      currentDossier: { month: curMonth, label: `${capitalize(MONTHS_ADJ_HU[Number(curMonth.slice(5, 7)) - 1] ?? '')} dosszié`, items, totalCount: docs.length + Number(navCount?.n ?? 0) },
      nextDeadline: deadlines[0] ?? null,
    };
    const notice = await serviceNotice(deps, deps.db, cl.id);
    if (notice) home.serviceNotice = notice;
    // SPEC §26.5.2: before activation the home carries no tax, revenue, deadline or dossier data of locked features.
    if (isRestricted(cl)) {
      home.limits = { afa: emptyMeter, atalanyCap: emptyMeter, adomentes: { reached: false, reachedMonth: null, limitHuf: home.limits.adomentes.limitHuf, sentence: '' } };
      home.revenueByMonth = [];
      home.nextDeadline = null;
      const open = docs.filter((d) => documentAlwaysOpen(d));
      home.currentDossier = { ...home.currentDossier, items: await listItems(deps.db, open.slice(0, 4), { firstName: ap.firstName, staff: false }), totalCount: open.length };
    }
    await augmentHome(deps, cl, home, today);
    // k7c2 (SPEC §28.K.11): the Főoldal card of a KATA client's business-customer invoices (not while restricted)
    if (!isRestricted(cl)) {
      const { kataRisksOf } = await import('../services/szamla-ertesites.js');
      const risks = await kataRisksOf(deps, cl, { limit: 3 });
      if (risks.length) home.kataRisk = risks;
    }
    return c.json(home);
  });

  r.get('/tax-periods', async (c) => {
    const cl = await client(c, deps);
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }));
    const year = q.year ?? Number(todayBudapest(deps.now()).slice(0, 4));
    // SPEC §32: never a hidden row; a backfilled KATA month only once the accountant verified it
    const rows = (await deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.year, year), periodVisible)).orderBy(asc(taxPeriods.dueDate))).filter((p) => !p.backfilled || p.paymentStatus === 'ellenorizve');
    return c.json({ items: await Promise.all(rows.map((p) => periodSummary(deps.db, p))) });
  });

  async function docsById(cl: ClientRow, ids: string[]): Promise<DocumentListItem[]> {
    if (!ids.length) return [];
    const ap = accountantPublic(await accFor(deps, cl));
    const rows = await deps.db.select().from(documents).where(and(eq(documents.clientId, cl.id), inArray(documents.id, ids), isNull(documents.deletedAt), eq(documents.visibility, 'kozos')));
    return listItems(deps.db, rows, { firstName: ap.firstName, staff: false });
  }

  r.get('/tax-periods/:id', async (c) => {
    const cl = await client(c, deps);
    const [p] = await deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.id, param(c, 'id')), eq(taxPeriods.clientId, cl.id), periodVisible)).limit(1);
    if (!p || (p.backfilled && p.paymentStatus !== 'ellenorizve')) throw E.notFound();
    return c.json(await periodDetail(deps.db, p, cl.firstName, cl.accountantId, (ids) => docsById(cl, ids)));
  });

  r.post('/tax-periods/:id/mark-paid', async (c) => {
    const cl = await client(c, deps);
    const b = await readJson(c, z.object({ kinds: z.array(z.enum(PAYMENT_ITEM_KINDS)).max(5).optional(), paidOn: z.string().refine(isIsoDate, { error: 'Dátum kell.' }) }));
    const p = await deps.db.transaction((tx) => markPaid(deps, tx, cl.id, param(c, 'id'), b.kinds, b.paidOn, auth(c).userId));
    return c.json(await periodDetail(deps.db, p, cl.firstName, cl.accountantId, (ids) => docsById(cl, ids)));
  });

  r.post('/tax-periods/:id/unmark-paid', async (c) => {
    const cl = await client(c, deps);
    const b = await readJson(c, z.object({ kinds: z.array(z.enum(PAYMENT_ITEM_KINDS)).max(5).optional() }));
    const p = await deps.db.transaction((tx) => unmarkPaid(deps, tx, cl.id, param(c, 'id'), b.kinds, auth(c).userId));
    return c.json(await periodDetail(deps.db, p, cl.firstName, cl.accountantId, (ids) => docsById(cl, ids)));
  });

  r.get('/revenue', async (c) => {
    const cl = await client(c, deps);
    const today = todayBudapest(deps.now());
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }));
    const year = q.year ?? Number(today.slice(0, 4));
    const comp = await computeYear(deps.db, cl.id, year, year < Number(today.slice(0, 4)) ? `${year}-12-31` : today);
    if (!comp) return c.json({ year, byMonth: [], totalHuf: 0, meters: null });
    const estimatedMonths = new Set(comp.input.revenue.filter((r0) => r0.estimated && r0.receivedOn.startsWith(String(year))).map((r0) => Number(r0.receivedOn.slice(5, 7))));
    const byMonth = comp.result.revenueByMonth.map((x) => ({ month: x.month, amountHuf: x.amountHuf, estimated: estimatedMonths.has(x.month) }));
    return c.json({ year, byMonth, totalHuf: byMonth.reduce((a, b) => a + b.amountHuf, 0), meters: comp.result.meters });
  });

  // ================= dossier and documents =================
  r.get('/dossiers', async (c) => {
    const cl = await client(c, deps);
    const today = todayBudapest(deps.now());
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }));
    return c.json({ months: await dossierMonths(deps.db, cl.id, q.year ?? Number(today.slice(0, 4)), false, today) });
  });

  r.get('/dossiers/:month', async (c) => {
    const cl = await client(c, deps);
    const month = c.req.param('month');
    if (!isMonthKey(month)) throw E.notFound();
    return c.json(await dossierView(deps, deps.db, cl.id, month, await accFor(deps, cl)));
  });

  r.get('/documents/:id', async (c) => {
    const cl = await client(c, deps);
    const [doc] = await deps.db
      .select()
      .from(documents)
      .where(and(eq(documents.id, param(c, 'id')), eq(documents.clientId, cl.id), isNull(documents.deletedAt), eq(documents.visibility, 'kozos')))
      .limit(1);
    if (!doc) throw E.notFound();
    // SPEC §26.5.2: before activation only own uploads and the contract-like papers open; the rest is the Dosszié.
    if (isRestricted(cl) && !documentAlwaysOpen(doc)) await assertFeature(deps, deps.db, cl, 'dosszie');
    return c.json(await documentDetail(deps.db, doc, accountantPublic(await accFor(deps, cl)).firstName, false));
  });

  r.post('/documents', async (c) => {
    const cl = await client(c, deps);
    uploadLimit(deps, c);
    await assertUploadQuota(deps, deps.db, cl, Number(c.req.header('content-length') ?? '0'));
    const body = await c.req.parseBody({ all: true });
    const meta = z
      .object({
        category: z.enum(DOCUMENT_CATEGORIES),
        dossierMonth: z.string().refine(isMonthKey, { error: 'Hónap kell (ÉÉÉÉ-HH).' }),
        title: z.string().trim().max(120).optional(),
        note: z.string().trim().max(1000).optional(),
        requestId: z.string().uuid().optional(),
      })
      .safeParse({ category: body.category, dossierMonth: body.dossierMonth, title: body.title || undefined, note: body.note || undefined, requestId: body.requestId || undefined });
    if (!meta.success) throw E.validation(Object.fromEntries(meta.error.issues.map((i) => [i.path.join('.'), 'Hibás vagy hiányzó érték.'])));
    if (['bevallas', 'nav_visszaigazolas', 'szerzodes_alairt'].includes(meta.data.category)) throw E.validation({ category: 'Ezt a típust a könyvelőd tölti fel.' });
    if (meta.data.category === 'ev_bejelentes') throw E.validation({ category: 'A NAV-os igazolást a vállalkozás bejelentésénél töltsd fel.' });
    // SPEC §26.5.2 'feltoltes' = only inside an open request of the accountant before activation.
    await assertFeature(deps, deps.db, cl, 'feltoltes', { allowedByRequest: await isOpenAccountantRequest(deps.db, cl.id, meta.data.requestId) });
    // A dossier month from the start of last year (the annual return) up to this month – never the future,
    // never years before the client could have had business with us.
    {
      const thisMonth = todayBudapest(deps.now()).slice(0, 7);
      const lastYearStart = `${Number(thisMonth.slice(0, 4)) - 1}-01`;
      const evMonth = cl.evSince ? cl.evSince.slice(0, 7) : null;
      const earliest = evMonth && evMonth > lastYearStart ? evMonth : lastYearStart;
      if (meta.data.dossierMonth > thisMonth) throw E.validation({ dossierMonth: 'Jövőbeli hónapba nem tölthetsz fel.' });
      if (meta.data.dossierMonth < earliest) throw E.validation({ dossierMonth: `Ennél régebbi hónapba (${earliest} előtt) nem tölthetsz fel. Írj a könyvelődnek, ha mégis kell.` });
    }
    if (meta.data.requestId) {
      const [rq] = await deps.db.select({ id: requests.id }).from(requests).where(and(eq(requests.id, meta.data.requestId), eq(requests.clientId, cl.id))).limit(1);
      if (!rq) throw E.validation({ requestId: 'Nincs ilyen kérés.' });
    }
    const filesIn = await collectFiles(body, 'file');
    const pagesIn = await collectFiles(body, 'pages');
    await assertUploadQuota(deps, deps.db, cl, [...filesIn, ...pagesIn].reduce((a, f) => a + f.data.length, 0));
    const created = await deps.db.transaction((tx) =>
      createDocument(deps, tx, {
        clientId: cl.id,
        source: 'ugyfel',
        category: meta.data.category,
        dossierMonth: meta.data.dossierMonth,
        title: meta.data.title,
        note: meta.data.note,
        relatedRequestId: meta.data.requestId ?? null,
        createdBy: auth(c).userId,
        files: filesIn,
        pages: pagesIn,
        actorRole: 'client',
      }),
    );
    const acc = await accFor(deps, cl);
    // A document for a quarter that was already filed: the accountant must see it (önellenőrzés?).
    const q = Math.floor((Number(meta.data.dossierMonth.slice(5, 7)) - 1) / 3) + 1;
    const [filedQ] = await deps.db
      .select({ id: taxPeriods.id })
      .from(taxPeriods)
      .where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.periodKey, `${meta.data.dossierMonth.slice(0, 4)}-Q${q}`), eq(taxPeriods.filingStatus, 'beadva'), periodVisible))
      .limit(1);
    if (filedQ) await auditC(c, deps.db, 'document.after_filing', { targetType: 'document', targetId: created.id, clientId: cl.id, details: { dossierMonth: meta.data.dossierMonth } });
    if (acc)
      await notify(deps, deps.db, {
        userId: acc.userId,
        kind: 'client_document_uploaded',
        params: { clientName: clientName(cl), title: filedQ ? `${created.title} – a beadás után érkezett (${ROMAN_Q[q - 1]}. negyedév)` : created.title },
        link: `/ugyfelek/${cl.id}/dosszie`,
        data: { clientId: cl.id, documentId: created.id, ...(filedQ ? { afterFiling: true } : {}) },
      });
    return c.json(await documentDetail(deps.db, created, accountantPublic(acc).firstName, false), 201);
  });

  r.post('/documents/:id/versions', async (c) => {
    const cl = await client(c, deps);
    uploadLimit(deps, c);
    await assertUploadQuota(deps, deps.db, cl, Number(c.req.header('content-length') ?? '0'));
    const [doc] = await deps.db.select().from(documents).where(and(eq(documents.id, param(c, 'id')), eq(documents.clientId, cl.id), isNull(documents.deletedAt), eq(documents.visibility, 'kozos'))).limit(1);
    if (!doc) throw E.notFound();
    if (doc.source !== 'ugyfel') throw E.forbidden('Ezt az iratot a könyvelőd töltötte fel.');
    await assertFeature(deps, deps.db, cl, 'feltoltes', { allowedByRequest: await isOpenAccountantRequest(deps.db, cl.id, doc.relatedRequestId) });
    // The evidence behind a filed return must not change afterwards; a processed one neither (the
    // accountant already booked it). A correction comes as a new document, which the accountant sees.
    if (doc.status === 'beadva') throw E.conflict('Ez az irat már egy beadott bevallás része, ezért nem cserélheted le. Ha javítani kell, töltsd fel új iratként, és írj a könyvelődnek.');
    if (doc.status === 'feldolgozva') throw E.conflict('Ezt az iratot a könyvelőd már feldolgozta, ezért nem cserélheted le. Töltsd fel a javítottat új iratként, és írj neki.');
    const body = await c.req.parseBody({ all: true });
    const vFiles = await collectFiles(body, 'file');
    const vPages = await collectFiles(body, 'pages');
    await assertUploadQuota(deps, deps.db, cl, [...vFiles, ...vPages].reduce((a, f) => a + f.data.length, 0));
    const updated = await deps.db.transaction(async (tx) => addVersion(deps, tx, doc, vFiles, vPages, auth(c).userId, 'client', typeof body.note === 'string' ? body.note : null));
    const acc = await accFor(deps, cl);
    if (acc) await notify(deps, deps.db, { userId: acc.userId, kind: 'client_document_uploaded', params: { clientName: clientName(cl), title: `${doc.title} (új változat)` }, link: `/ugyfelek/${cl.id}/dosszie`, data: { clientId: cl.id, documentId: doc.id } });
    return c.json(await documentDetail(deps.db, updated, accountantPublic(acc).firstName, false));
  });

  r.delete('/documents/:id', async (c) => {
    const cl = await client(c, deps);
    const [doc] = await deps.db.select().from(documents).where(and(eq(documents.id, param(c, 'id')), eq(documents.clientId, cl.id), isNull(documents.deletedAt), eq(documents.visibility, 'kozos'))).limit(1);
    if (!doc) throw E.notFound();
    if (doc.source !== 'ugyfel' || doc.status !== 'feltoltve') throw E.conflict('Ezt már látta a könyvelőd, ezért nem törölheted. Tölts fel új változatot, vagy írj neki.');
    await deps.db.update(documents).set({ deletedAt: deps.now() }).where(eq(documents.id, doc.id));
    await auditC(c, deps.db, 'document.deleted', { targetType: 'document', targetId: doc.id, clientId: cl.id });
    return c.body(null, 204);
  });

  r.get('/nav-invoices', async (c) => {
    const cl = await client(c, deps);
    const q = parseQuery(c, z.object({ month: z.string().refine(isMonthKey).optional() }));
    const rows = await deps.db
      .select()
      .from(navInvoices)
      .where(and(eq(navInvoices.clientId, cl.id), q.month ? eq(navInvoices.dossierMonth, q.month) : sql`true`))
      .orderBy(desc(navInvoices.issueDate));
    const reserves = await invoiceReserves(deps, cl, rows.map((i) => i.id));
    return c.json({ items: rows.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, issueDate: i.issueDate, customerName: i.customerName, grossAmountHuf: i.grossHuf, status: i.status, demo: i.demo, ...(reserves.get(i.id) ? { reserve: reserves.get(i.id) } : {}) })) });
  });

  r.get('/nav-invoices/:id', async (c) => {
    const cl = await client(c, deps);
    const [i] = await deps.db.select().from(navInvoices).where(and(eq(navInvoices.id, param(c, 'id')), eq(navInvoices.clientId, cl.id))).limit(1);
    if (!i) throw E.notFound();
    const reserve = (await invoiceReserves(deps, cl, [i.id])).get(i.id);
    // k7c2 (SPEC §28.K.11): a KATA client's invoice to a business customer carries the red warning line
    const { kataRisksOf } = await import('../services/szamla-ertesites.js');
    const [kataRisk] = await kataRisksOf(deps, cl, { ids: [i.id] });
    return c.json({ id: i.id, invoiceNumber: i.invoiceNumber, issueDate: i.issueDate, customerName: i.customerName, grossAmountHuf: i.grossHuf, status: i.status, demo: i.demo, invoice: i.data, ...(reserve ? { reserve } : {}), ...(kataRisk ? { kataRisk } : {}) });
  });

  // ================= messages, requests =================
  r.get('/messages', async (c) => {
    const cl = await client(c, deps);
    const q = parseQuery(c, z.object({ cursor: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }));
    const page = await messagePage(deps.db, cl.id, q.cursor, q.limit);
    const ap = accountantPublic(await accFor(deps, cl));
    return c.json({ items: await messageDtos(deps.db, page.rows, 'client', ap.firstName), nextCursor: page.nextCursor });
  });

  r.post('/attachments', async (c) => {
    const cl = await client(c, deps);
    uploadLimit(deps, c);
    await assertUploadQuota(deps, deps.db, cl, Number(c.req.header('content-length') ?? '0'));
    const body = await c.req.parseBody({ all: true });
    const f = (await collectFiles(body, 'file'))[0];
    if (f) await assertUploadQuota(deps, deps.db, cl, f.data.length);
    if (!f) throw E.validation({ file: 'Nincs csatolt fájl.' });
    const ok = checkFile(f);
    const row = await deps.storage.put(deps.db, { ownerClientId: cl.id, kind: 'uzenet_csatolmany', mime: ok.mime, displayName: ok.displayName, data: ok.data, createdBy: auth(c).userId, now: deps.now() });
    return c.json({ fileId: row.id }, 201);
  });

  r.post('/messages', async (c) => {
    const cl = await client(c, deps);
    const h = deps.limiter.hit(`msg:${auth(c).userId}`, 60, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const b = await readJson(c, z.object({ body: z.string().trim().max(4000).default(''), fileIds: z.array(z.string().uuid()).max(10).optional(), documentId: z.string().uuid().optional() }));
    if (!b.body && !b.fileIds?.length) throw E.validation({ body: 'Írj valamit, vagy csatolj fájlt.' });
    const msg = await deps.db.transaction(async (tx) => {
      if (b.documentId) {
        const [d] = await tx.select({ id: documents.id }).from(documents).where(and(eq(documents.id, b.documentId), eq(documents.clientId, cl.id), eq(documents.visibility, 'kozos'))).limit(1);
        if (!d) throw E.validation({ documentId: 'Nincs ilyen irat.' });
      }
      const [m] = await tx.insert(messages).values({ clientId: cl.id, senderUserId: auth(c).userId, senderRole: 'client', kind: 'szoveg', body: b.body, documentId: b.documentId ?? null, readByClientAt: deps.now() }).returning();
      for (const fid of b.fileIds ?? []) {
        const [f] = await tx.select().from(files).where(and(eq(files.id, fid), eq(files.ownerClientId, cl.id), eq(files.kind, 'uzenet_csatolmany'))).limit(1);
        if (!f) throw E.validation({ fileIds: 'Ismeretlen csatolmány.' });
        await tx.insert(messageAttachments).values({ messageId: m!.id, fileId: f.id, displayName: f.displayName });
      }
      await auditC(c, tx, 'message.sent', { targetType: 'message', targetId: m!.id, clientId: cl.id, details: { attachments: b.fileIds?.length ?? 0 } });
      return m!;
    });
    const acc = await accFor(deps, cl);
    if (acc) await notify(deps, deps.db, { userId: acc.userId, kind: 'client_message_new', params: { clientName: clientName(cl) }, link: `/ugyfelek/${cl.id}/uzenetek`, data: { clientId: cl.id } });
    // SPEC §26.4: during onboarding the service team answers too.
    if (cl.lifecycle === 'bekotes_alatt') await notifyTeamOfClientMessage(deps, deps.db, cl);
    const [dto] = await messageDtos(deps.db, [msg], 'client', accountantPublic(acc).firstName);
    return c.json(dto, 201);
  });

  r.post('/messages/read', async (c) => {
    const cl = await client(c, deps);
    const b = await readJson(c, z.object({ upToId: z.string().uuid() }));
    const [m] = await deps.db.select({ at: messages.createdAt }).from(messages).where(and(eq(messages.id, b.upToId), eq(messages.clientId, cl.id))).limit(1);
    if (m) await deps.db.update(messages).set({ readByClientAt: deps.now() }).where(and(eq(messages.clientId, cl.id), isNull(messages.readByClientAt), sql`${messages.createdAt} <= ${m.at}`));
    return c.body(null, 204);
  });

  r.get('/requests', async (c) => {
    const cl = await client(c, deps);
    const q = parseQuery(c, z.object({ status: z.string().max(60).optional() }));
    const statuses = q.status ? q.status.split(',').filter((s) => ['nyitott', 'folyamatban', 'teljesitve', 'elutasitva', 'visszavonva'].includes(s)) : [];
    const rows = await deps.db
      .select()
      .from(requests)
      .where(and(eq(requests.clientId, cl.id), statuses.length ? inArray(requests.status, statuses as never[]) : sql`true`))
      .orderBy(desc(requests.createdAt));
    const ap = accountantPublic(await accFor(deps, cl));
    return c.json({ items: await Promise.all(rows.map((x) => requestSummary(deps.db, x, ap.firstName))) });
  });

  r.post('/requests', async (c) => {
    const cl = await client(c, deps);
    const b = await readJson(
      c,
      z.object({
        type: z.enum(REQUEST_TYPES_FROM_CLIENT),
        body: z.string().trim().max(4000).default(''),
        title: z.string().trim().max(120).optional(),
        certificate: z
          .object({ certificateType: z.enum(CERTIFICATE_TYPES), year: z.number().int().min(2000).max(2100).optional(), purpose: z.string().trim().min(1).max(200), language: z.enum(['hu', 'en']).default('hu') })
          .optional(),
      }),
    );
    if (!(REQUEST_TYPES_BEFORE_ACTIVATION as readonly string[]).includes(b.type)) await assertFeature(deps, deps.db, cl, 'igazolas_keres');
    const isCert = (CERTIFICATE_TYPES as readonly string[]).includes(b.type);
    if (isCert && !b.certificate) throw E.validation({ 'certificate.purpose': 'Írd meg, mire kell az igazolás.' });
    const ap = accountantPublic(await accFor(deps, cl));
    const title = b.title || (isCert && b.certificate?.year ? `${REQUEST_TYPE_TITLES[b.type]} ${b.certificate.year}` : REQUEST_TYPE_TITLES[b.type]!);
    const row = await deps.db.transaction(async (tx) => {
      const [rq] = await tx.insert(requests).values({ clientId: cl.id, direction: 'ugyfeltol', type: b.type, title, body: b.body, createdBy: auth(c).userId }).returning();
      if (isCert && b.certificate) await tx.insert(certificateRequests).values({ requestId: rq!.id, certificateType: b.certificate.certificateType, year: b.certificate.year ?? null, purpose: b.certificate.purpose, language: b.certificate.language });
      await tx.insert(messages).values({ clientId: cl.id, senderUserId: auth(c).userId, senderRole: 'client', kind: 'keres_kartya', body: title, requestId: rq!.id, readByClientAt: deps.now() });
      await auditC(c, tx, 'request.created', { targetType: 'request', targetId: rq!.id, clientId: cl.id, details: { type: b.type } });
      return rq!;
    });
    const acc = await accFor(deps, cl);
    if (acc) await notify(deps, deps.db, { userId: acc.userId, kind: 'client_request_new', params: { clientName: clientName(cl), title }, link: `/keresek`, data: { clientId: cl.id, requestId: row.id } });
    return c.json(await requestSummary(deps.db, row, ap.firstName), 201);
  });

  r.post('/requests/:id/complete', async (c) => {
    const cl = await client(c, deps);
    const b = await readJson(c, z.object({ documentIds: z.array(z.string().uuid()).max(20).optional(), note: z.string().trim().max(1000).optional() }));
    const [rq] = await deps.db.select().from(requests).where(and(eq(requests.id, param(c, 'id')), eq(requests.clientId, cl.id))).limit(1);
    if (!rq || rq.direction !== 'konyvelotol') throw E.notFound();
    if (!['nyitott', 'folyamatban'].includes(rq.status)) throw E.conflict('Ez a kérés már le van zárva.');
    const now = deps.now();
    if (b.documentIds?.length) {
      const own = await deps.db.select({ id: documents.id }).from(documents).where(and(eq(documents.clientId, cl.id), inArray(documents.id, b.documentIds)));
      if (own.length !== b.documentIds.length) throw E.validation({ documentIds: 'Ismeretlen irat.' });
      await deps.db.update(documents).set({ relatedRequestId: rq.id }).where(inArray(documents.id, b.documentIds));
    }
    // Conditional update: the accountant may have withdrawn it meanwhile (last write must not win).
    const [u] = await deps.db
      .update(requests)
      .set({ status: 'teljesitve', completedAt: now, completedBy: auth(c).userId, statusNote: b.note || null, resultDocumentId: b.documentIds?.[0] ?? rq.resultDocumentId, updatedAt: now })
      .where(and(eq(requests.id, rq.id), inArray(requests.status, ['nyitott', 'folyamatban'])))
      .returning();
    if (!u) throw E.conflict('Ez a kérés közben megváltozott. Frissítsd az oldalt.');
    if (b.note) await postRequestNote(deps.db, { clientId: cl.id, requestId: rq.id, senderUserId: auth(c).userId, senderRole: 'client', title: rq.title, note: b.note, now });
    await auditC(c, deps.db, 'request.completed', { targetType: 'request', targetId: rq.id, clientId: cl.id });
    const acc = await accFor(deps, cl);
    if (acc) await notify(deps, deps.db, { userId: acc.userId, kind: 'client_request_new', params: { clientName: clientName(cl), title: `Kész: ${rq.title}` }, link: `/ugyfelek/${cl.id}/keresek`, data: { clientId: cl.id, requestId: rq.id } });
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await requestSummary(deps.db, u!, accountantPublic(acc).firstName));
  });

  r.post('/requests/:id/cancel', async (c) => {
    const cl = await client(c, deps);
    const [rq] = await deps.db.select().from(requests).where(and(eq(requests.id, param(c, 'id')), eq(requests.clientId, cl.id))).limit(1);
    if (!rq || rq.direction !== 'ugyfeltol') throw E.notFound();
    if (rq.status !== 'nyitott') throw E.conflict('Ezt már elkezdte a könyvelőd; írj neki, ha mégsem kell.');
    const now = deps.now();
    const [u] = await deps.db
      .update(requests)
      .set({ status: 'visszavonva', completedAt: now, completedBy: auth(c).userId, updatedAt: now })
      .where(and(eq(requests.id, rq.id), eq(requests.status, 'nyitott')))
      .returning();
    if (!u) throw E.conflict('Ezt közben már elkezdte a könyvelőd; írj neki, ha mégsem kell.');
    await auditC(c, deps.db, 'request.cancelled', { targetType: 'request', targetId: rq.id, clientId: cl.id });
    return c.json(await requestSummary(deps.db, u!, accountantPublic(await accFor(deps, cl)).firstName));
  });

  // ================= deadlines, appointments =================
  r.get('/deadlines', async (c) => {
    const cl = await client(c, deps);
    const today = todayBudapest(deps.now());
    const q = parseQuery(c, z.object({ from: z.string().refine(isIsoDate).optional(), to: z.string().refine(isIsoDate).optional() }));
    return c.json({ items: await clientDeadlines(deps, deps.db, cl.id, q.from ?? addDays(today, -31), q.to ?? addDays(today, 400)) });
  });

  r.get('/deadlines/:id/ics', async (c) => {
    const cl = await client(c, deps);
    const id = c.req.param('id');
    const today = todayBudapest(deps.now());
    const all: Deadline[] = await clientDeadlines(deps, deps.db, cl.id, addDays(today, -400), addDays(today, 800));
    const d = all.find((x) => x.id === id);
    if (!d) throw E.notFound();
    c.header('Content-Type', 'text/calendar; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="hatarido.ics"');
    return c.body(icsFor({ uid: `${d.id}@kezjegy`, title: d.title, date: d.dueDate, description: d.amountHuf ? `${new Intl.NumberFormat('hu-HU').format(d.amountHuf)} Ft` : undefined, now: deps.now() }));
  });

  // ---- appointments: RETIRED (SPEC §26.2.9). Old rows stay readable; booking answers 410 megszunt_funkcio. ----
  r.get('/appointments/slots', async (c) => {
    await client(c, deps);
    return c.json({ enabled: false, slots: [] });
  });

  r.get('/appointments', async (c) => {
    const cl = await client(c, deps);
    const rows = await deps.db.select().from(appointments).where(eq(appointments.clientId, cl.id)).orderBy(desc(appointments.startsAt));
    return c.json({
      items: rows.map((a) => ({ id: a.id, startsAt: a.startsAt.toISOString(), endsAt: a.endsAt.toISOString(), channel: a.channel, status: a.status, ...(a.videoLink ? { videoLink: a.videoLink } : {}), ...(a.topic ? { topic: a.topic } : {}) })),
    });
  });

  r.post('/appointments', () => {
    throw E.retired();
  });
  r.post('/appointments/:id/cancel', () => {
    throw E.retired();
  });
  r.get('/appointments/:id/ics', () => {
    throw E.retired();
  });

  // ================= subscription and fees =================
  r.get('/subscription', async (c) => {
    const cl = await client(c, deps);
    return c.json(await subscriptionView(deps, deps.db, cl.id));
  });

  r.post('/subscription/start', async (c) => {
    const cl = await client(c, deps);
    const b = await readJson(c, z.object({ platform: z.enum(['app', 'web']), acceptedDeclarations: z.literal(true, { error: 'A két nyilatkozatot el kell fogadnod.' }), purpose: z.enum(['subscribe', 'card_update']).default('subscribe') }));
    await assertStepOpen(deps, deps.db, cl, 'elofizetes');
    // SPEC §28.K.7: with employees / EFO no card is charged before the accountant's decision.
    if (b.purpose === 'subscribe' && blocksActivation(await employerRow(deps.db, cl.id)))
      throw E.stepLocked(await deps.content.render('alkalmazott.subscription_lock', await accountantParams(deps.db, cl.accountantId)));
    const h = deps.limiter.hit(`substart:${cl.id}`, 10, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const res = await startRegistration(deps, cl.id, b.platform, c.get('ipHmac'), c.get('ua'), b.purpose);
    await auditC(c, deps.db, 'consent.accepted', { targetType: 'legal_document', targetId: 'simplepay', details: { docs: ['simplepay_adattovabbitas', 'simplepay_ismetlodo'] } });
    return c.json(res);
  });

  r.post('/subscription/cancel', async (c) => {
    const cl = await client(c, deps);
    await cancelSubscription(deps, cl.id, auth(c).userId);
    return c.json(await subscriptionView(deps, deps.db, cl.id));
  });

  r.post('/subscription/resume', async (c) => {
    const cl = await client(c, deps);
    await resumeSubscription(deps, cl.id, auth(c).userId);
    return c.json(await subscriptionView(deps, deps.db, cl.id));
  });

  r.post('/subscription/card/delete', async (c) => {
    const cl = await client(c, deps);
    await deleteCard(deps, cl.id, { userId: auth(c).userId, role: 'client' });
    return c.json(await subscriptionView(deps, deps.db, cl.id));
  });

  r.get('/fee-invoices', async (c) => {
    const cl = await client(c, deps);
    const rows = await deps.db.select().from(feeInvoices).where(and(eq(feeInvoices.clientId, cl.id), eq(feeInvoices.status, 'kiallitva'))).orderBy(desc(feeInvoices.issuedOn));
    return c.json({ items: rows.map((f) => ({ id: f.id, number: f.number ?? '', issuedOn: f.issuedOn ?? '', amountHuf: f.amountHuf, demo: f.demo, fileId: f.pdfFileId ?? '' })) });
  });

  return r;
}

