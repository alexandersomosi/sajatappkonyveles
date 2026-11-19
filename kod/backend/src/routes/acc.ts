// /acc – role accountant; only clients assigned to this accountant (SPEC §12.5, panel shapes in
// SPEC §24 "panel" note). Unassigned client ids answer 404.
import { and, asc, desc, eq, gt, gte, ilike, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { AccClientRow, Deadline, RevenueItem } from '../_shared/api.js';
import { CLIENT_FLAGS, DOCUMENT_CATEGORIES, DOCUMENT_STATUSES, ONBOARDING_STEPS, PAYMENT_ITEM_KINDS, type ClientFlag, type Milestone } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import {
  accountants,
  appointments,
  auditLog,
  availabilitySlots,
  certificateRequests,
  clients,
  clientTaxProfiles,
  documents,
  documentVersions,
  dossiers,
  files,
  kycRecords,
  messageAttachments,
  messages,
  messageTemplates,
  navCredentials,
  navInvoices,
  navSyncRuns,
  internalNotes,
  onboardingSteps,
  requests,
  revenueItems,
  subscriptions,
  cardRegistrations,
  taxCalculations,
  taxPeriods,
  users,
} from '../db/schema.js';
import { auditC } from '../audit.js';
import { requireAuth } from '../auth/middleware.js';
import { checkFile, collectFiles, MAX_REQUEST_BYTES } from '../files/upload.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { addDays, budapestLocalToUtc, daysBetween, huDayMonth, isIsoDate, isMonthKey, isoWeekOf, monthLabel, mondayOfIsoWeek, MONTHS_ADJ_HU, todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { isValidTorzsszam } from '../lib/validators.js';
import { isNavError } from '../nav/types.js';
import { accountantParams, notify } from '../notify/notify.js';
import { accountantOfUser, accountantPublic, assignedClient, clientName, type AccountantRow, type ClientRow } from '../services/people.js';
import { checkCompletion, journeyOf, onboardingState, setStep, steps, stepStatus } from '../services/onboarding.js';
import { addVersion, createDocument, documentDetail, dossierMonths, listItems, setStatus, statusLabel } from '../services/documents.js';
import { messageDtos, messagePage, postRequestNote, requestSummary } from '../services/requests.js';
import { fullDeclarations } from '../services/kyc.js';
import {
  activeItems,
  approveCalculation,
  approveHipaManual,
  calculatePeriod,
  computeYear,
  ensurePeriods,
  filingCheck,
  letterFor,
  markFiled,
  paymentItemDto,
  periodSummary,
  recalcYear,
  reopenPeriod,
  updateLetter,
  verifyPayment,
  type CalcResultJson,
} from '../services/tax.js';
import { clientDeadlines, computeFlags } from '../services/flags.js';
import { credsFor, syncClient } from '../services/navsync.js';
import { pickAccountant } from '../services/accounts.js';
import { callbackRequests } from '../db/schema.js';
import { teamRows } from '../services/callbacks.js';
import { currentRegistrationOf } from '../services/registration.js';
import { teamViews } from './team.js';
import { openAssistOf } from '../services/assist.js';
import { accDetailK28, hasResponseTimePromise, registerAccK28Routes } from './acc-k28.js';
import { pendingAllowances } from '../services/kedvezmeny.js';
import { RESPONSE_TIME_SETTINGS_ERROR } from '../_shared/bekotes.js';

/**
 * One CSV cell for Excel (";" separated). Text from clients or NAV (customer names, descriptions) that starts
 * like a formula (=, +, -, @, tab, CR) gets a leading apostrophe, so Excel shows it as text instead of running it.
 * Plain numbers stay numbers.
 */
export function csvCell(s: string | number | null | undefined): string {
  let v = String(s ?? '');
  if (typeof s !== 'number' && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function accRoutes(deps: Deps) {
  const r = new Hono<Env>();
  // SPEC §28.K.2 + panel note 3 (integrator k6): the service team (csapat) may READ the check-in queue – teamCheckinItems shows it only
  // the items with an assist; every other /acc route stays accountant + admin.
  const accAuth = requireAuth(deps, { roles: ['accountant', 'admin'] });
  const queueAuth = requireAuth(deps, { roles: ['accountant', 'admin', 'csapat'] });
  r.use('*', (c, next) => (c.req.method === 'GET' && /\/acc\/checkin-items\/?$/.test(c.req.path) ? queueAuth : accAuth)(c, next));
  // SPEC §28 / §28.K (reserve, earnings, allowances, check-in queue, annual closing, EFO, regime) + the service lock
  registerAccK28Routes(r, deps);

  async function me(c: C): Promise<AccountantRow> {
    return accountantOfUser(deps.db, auth(c).userId);
  }
  async function own(c: C, clientId?: string): Promise<{ acc: AccountantRow; cl: ClientRow }> {
    const acc = await me(c);
    const cl = await assignedClient(deps.db, acc.id, clientId ?? param(c, 'id'));
    return { acc, cl };
  }

  // ================= clients =================
  async function milestoneOf(clientId: string): Promise<Milestone | null> {
    const st = await onboardingState(deps, deps.db, clientId, 'accountant');
    const cur = st.milestones.find((m) => m.current);
    return cur?.key ?? (st.milestones.every((m) => m.done) ? 'kesz' : null);
  }

  async function nextDeadlineOf(clientId: string): Promise<Deadline | undefined> {
    const today = todayBudapest(deps.now());
    const all = await clientDeadlines(deps, deps.db, clientId, addDays(today, -60), addDays(today, 200), { perspective: 'accountant' });
    return all.find((d) => d.status !== 'kesz');
  }

  /** The engine's meter sentences speak to the client ("számlázhatsz"); the panel says "számlázhat". */
  function accMeters<T extends { afa: { sentence: string; detail?: string; remainingHuf?: number; usedHuf: number; limitHuf: number }; atalanyCap: { sentence: string; detail?: string }; adomentes: { sentence: string; detail?: string; reached: boolean; reachedMonth: number | null; limitHuf: number; usedIncomeHuf?: number } }>(m: T | null | undefined): T | null {
    if (!m) return null;
    const ft = (n: number) => `${new Intl.NumberFormat('hu-HU').format(n).replace(/\u00a0/g, ' ')} Ft`;
    const afaOver = m.afa.usedHuf > m.afa.limitHuf;
    const afaSentence = afaOver ? `Átlépte az alanyi ÁFA-mentesség határát (${ft(m.afa.limitHuf)}).` : `Még ${ft(m.afa.remainingHuf ?? Math.max(0, m.afa.limitHuf - m.afa.usedHuf))}-ot számlázhat ÁFA nélkül.`;
    const third = (t: string | undefined) =>
      t
        ?.replace(/\bÁtlépted\b/g, 'Átlépte')
        .replace(/\bszámlázhatsz\b/g, 'számlázhat')
        .replace(/\bjövedelmed\b/g, 'jövedelme')
        .replace(/\bbevételed\b/g, 'bevétele')
        .replace(/\bszámláid\b/g, 'számlái')
        .replace(/\bhasználtad\b/g, 'használta')
        .replace(/\bközel vagy\b/gi, (x) => (x[0] === 'K' ? 'Közel van' : 'közel van'))
        .replace(/\belérted\b/g, 'elérte')
        .replace(/\bfizetsz\b/g, 'fizet')
        .replace(/\badózásodban\b/g, 'adózásában')
        .replace(/ – beszéld meg a könyvelőddel/g, '')
        .replace(/ Beszélj még ma a könyvelőddel\./g, ' Beszéljetek még ma.')
        .replace(/\bFigyeld együtt a könyvelőddel\./g, '');
    return {
      ...m,
      afa: { ...m.afa, sentence: afaSentence, ...(m.afa.detail ? { detail: third(m.afa.detail) } : {}) },
      atalanyCap: { ...m.atalanyCap, sentence: third(m.atalanyCap.sentence)!, ...(m.atalanyCap.detail ? { detail: third(m.atalanyCap.detail) } : {}) },
      adomentes: { ...m.adomentes, sentence: third(m.adomentes.sentence)!, ...(m.adomentes.detail ? { detail: third(m.adomentes.detail) } : {}) },
    };
  }

  /** 11-19 javítás: "Bekötés: 2/6 kész, következik: NAV-meghatalmazás" from the client's own journey (not the milestones). */
  async function journeyLine(cl: ClientRow): Promise<AccClientRow['onboardingJourney']> {
    try {
      const j = await journeyOf(deps, deps.db, cl);
      const rows = j.steps.filter((s) => s.key !== 'ut' && !s.optional);
      const cur = j.currentKey ? j.steps.find((s) => s.key === j.currentKey) : null;
      return {
        done: rows.filter((s) => s.state === 'kesz' || s.state === 'kihagyva').length,
        total: rows.length,
        next: cur?.title ?? null,
        nextActor: cur?.actorLabel ?? null,
        waiting: (() => {
          const v = j.steps.find((s) => s.state === 'var');
          return v ? `${v.title} (${v.actorLabel})` : null;
        })(),
      };
    } catch {
      return null;
    }
  }

  r.get('/clients', async (c) => {
    const acc = await me(c);
    const q = parseQuery(c, z.object({ filter: z.enum([...CLIENT_FLAGS, 'mind']).default('mind'), q: z.string().trim().max(80).optional() }));
    let cond = and(eq(clients.accountantId, acc.id), sql`${clients.lifecycle} <> 'megszunt'`);
    if (q.q) cond = and(cond, or(ilike(clients.lastName, `%${q.q}%`), ilike(clients.firstName, `%${q.q}%`), ilike(clients.adoszam, `%${q.q}%`)));
    const rows = await deps.db.select().from(clients).where(cond).orderBy(asc(clients.lastName), asc(clients.firstName));
    const counts: Record<string, number> = { mind: rows.length };
    for (const f of CLIENT_FLAGS) counts[f] = rows.filter((x) => (x.nextFlags ?? []).includes(f)).length;
    const picked = q.filter === 'mind' ? rows : rows.filter((x) => (x.nextFlags ?? []).includes(q.filter as ClientFlag));
    const today = todayBudapest(deps.now());
    const items: AccClientRow[] = [];
    for (const cl of picked) {
      const reqs = await deps.db.select({ direction: requests.direction }).from(requests).where(and(eq(requests.clientId, cl.id), inArray(requests.status, ['nyitott', 'folyamatban'])));
      const [waiting] = await deps.db.select({ n: sql<number>`count(*)::int`, last: sql<Date | null>`max(${documents.createdAt})` }).from(documents).where(and(eq(documents.clientId, cl.id), isNull(documents.deletedAt), eq(documents.status, 'feltoltve')));
      const [lastUp] = await deps.db.select({ last: sql<string | null>`max(${documents.createdAt})` }).from(documents).where(and(eq(documents.clientId, cl.id), eq(documents.source, 'ugyfel')));
      const [sub] = await deps.db.select({ status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.clientId, cl.id)).limit(1);
      const comp = await computeYear(deps.db, cl.id, Number(today.slice(0, 4)), today);
      const nd = await nextDeadlineOf(cl.id);
      items.push({
        id: cl.id,
        name: clientName(cl),
        lifecycle: cl.lifecycle,
        flags: (cl.nextFlags ?? []) as ClientFlag[],
        ...(nd ? { nextDeadline: nd } : {}),
        openRequestsFromClient: reqs.filter((x) => x.direction === 'ugyfeltol').length,
        openRequestsToClient: reqs.filter((x) => x.direction === 'konyvelotol').length,
        waitingDocuments: Number(waiting?.n ?? 0),
        ...(lastUp?.last ? { lastUploadAt: new Date(lastUp.last).toISOString() } : {}),
        afaRatio: comp?.result.meters.afa.ratio ?? 0,
        subscriptionStatus: sub?.status ?? null,
        onboardingMilestone: await milestoneOf(cl.id),
        onboardingJourney: cl.lifecycle === 'bekotes_alatt' ? await journeyLine(cl) : null,
        // SPEC §28.3.6 / §28.K
        allowancesPending: await pendingAllowances(deps.db, cl.id),
        serviceLocked: Boolean(cl.serviceLock),
        adoszamPending: cl.adoszamPending,
      });
    }
    return c.json({ items, counts });
  });

  async function taxProfileDto(clientId: string, year: number) {
    const [tp] = await deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, year))).limit(1);
    if (!tp) return null;
    return {
      year: tp.year,
      costRatio: tp.costRatio,
      costRatioSource: tp.costRatioSource,
      status: tp.status,
      guaranteedMinimum: tp.guaranteedMinimum,
      retail: tp.retail,
      ...(tp.atalanyFrom ? { atalanyFrom: tp.atalanyFrom } : {}),
      insuranceBreaks: tp.insuranceBreaks ?? [],
      hipa: { method: tp.hipaMethod, ratePct: Number(tp.hipaRatePct), ...(tp.hipaAccountNumber ? { accountNumber: tp.hipaAccountNumber } : {}) },
      ...(tp.priorOverrides ? { priorOverrides: tp.priorOverrides } : {}),
      allowances: tp.allowances ?? [],
      updatedAt: tp.updatedAt.toISOString(),
    };
  }

  async function navConnection(clientId: string) {
    const [n] = await deps.db.select().from(navCredentials).where(eq(navCredentials.clientId, clientId)).limit(1);
    if (!n) return { status: 'nincs' as const, environment: deps.cfg.nav.mode === 'disabled' ? 'prod' : deps.cfg.nav.mode, loginHint: null, taxNumber: null, savedAt: null, lastTestAt: null, lastTestError: null, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null };
    return {
      status: n.status,
      environment: n.environment,
      loginHint: n.loginHint,
      taxNumber: n.taxNumber,
      savedAt: n.savedAt.toISOString(),
      lastTestAt: n.lastTestAt?.toISOString() ?? null,
      lastTestError: n.lastTestError,
      lastSyncAt: n.lastSyncAt?.toISOString() ?? null,
      lastSyncStatus: n.lastSyncStatus,
      lastSyncError: n.lastSyncError,
    };
  }

  r.get('/clients/:id', async (c) => {
    const { cl } = await own(c);
    const [u] = await deps.db.select().from(users).where(eq(users.id, cl.userId)).limit(1);
    const today = todayBudapest(deps.now());
    const year = Number(today.slice(0, 4));
    const st = await onboardingState(deps, deps.db, cl.id, 'accountant');
    const rawSteps = await deps.db.select().from(onboardingSteps).where(eq(onboardingSteps.clientId, cl.id));
    const [kyc] = await deps.db.select({ status: kycRecords.status }).from(kycRecords).where(eq(kycRecords.clientId, cl.id)).orderBy(desc(kycRecords.submittedAt)).limit(1);
    const [sub] = await deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, cl.id)).limit(1);
    const [reg] = sub?.cardRegistrationId ? await deps.db.select().from(cardRegistrations).where(eq(cardRegistrations.id, sub.cardRegistrationId)).limit(1) : [];
    const reqs = await deps.db.select({ direction: requests.direction }).from(requests).where(and(eq(requests.clientId, cl.id), inArray(requests.status, ['nyitott', 'folyamatban'])));
    const [unread] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(messages).where(and(eq(messages.clientId, cl.id), eq(messages.senderRole, 'client'), isNull(messages.readByAccountantAt)));
    const comp = await computeYear(deps.db, cl.id, year, today);
    // Only the masked value here; the full one comes from POST …/adoazonosito/reveal ("Mutasd"), audited.
    const adoJelMasked = cl.adoazonositoLast3 ? `•••••••${cl.adoazonositoLast3}` : null;
    return c.json({
      id: cl.id,
      firstName: cl.firstName,
      lastName: cl.lastName,
      name: clientName(cl),
      email: u?.email ?? null,
      phone: cl.phoneEnc ? deps.data.dec(cl.phoneEnc, 'clients.phone') : null,
      lifecycle: cl.lifecycle,
      flags: cl.nextFlags ?? [],
      clientSince: cl.createdAt.toISOString(),
      adoazonositoJel: null,
      adoazonositoJelMasked: adoJelMasked,
      adoszam: cl.adoszam,
      evNyilvantartasiSzam: cl.evNyilvantartasiSzam,
      birthName: cl.birthName,
      address: cl.addressZip ? { zip: cl.addressZip, city: cl.addressCity, line: cl.addressLine } : null,
      hqMunicipality: cl.hqMunicipality,
      activityText: cl.activityText,
      activityAnswer: cl.activityAnswer,
      activityCode: cl.activityCode,
      evSince: cl.evSince,
      previousAccountant: cl.previousAccountant,
      hasSeparateBusinessAccount: cl.hasSeparateBusinessAccount,
      alairtPdfAllowed: cl.alairtPdfAllowed,
      taxProfile: await taxProfileDto(cl.id, year),
      onboarding: {
        steps: st.steps.map((s) => {
          const raw = rawSteps.find((x) => x.step === s.step);
          const d = (raw?.data ?? null) as { method?: string; submittedAt?: string; fileId?: string } | null;
          return { ...s, ...(raw?.note ? { note: raw.note } : {}), ...(d ? { data: { method: d.method, submittedAt: d.submittedAt, fileId: d.fileId } } : {}) };
        }),
        milestones: st.milestones,
      },
      kycStatus: kyc?.status ?? null,
      subscription: sub ? { status: sub.status, mode: sub.mode, priceHuf: deps.cfg.planPriceHuf, nextChargeAt: sub.nextChargeAt?.toISOString(), cardMask: reg?.status === 'aktiv' ? reg.cardMask : undefined, failedAttempts: sub.failedAttempts } : null,
      nav: await navConnection(cl.id),
      meters: accMeters(comp?.result.meters),
      warnings: comp?.result.warnings ?? [],
      nextDeadline: (await nextDeadlineOf(cl.id)) ?? null,
      openRequestsFromClient: reqs.filter((x) => x.direction === 'ugyfeltol').length,
      openRequestsToClient: reqs.filter((x) => x.direction === 'konyvelotol').length,
      unreadMessages: Number(unread?.n ?? 0),
      demo: deps.cfg.appEnv === 'demo',
      ...(await accDetailK28(deps, cl)),
    });
  });

  r.post('/clients/:id/adoazonosito/reveal', async (c) => {
    const { cl } = await own(c);
    const h = deps.limiter.hit(`reveal:${auth(c).userId}`, 60, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    if (!cl.adoazonositoJelEnc) throw E.notFound('Az ügyfél még nem adta meg az adóazonosító jelét.');
    const value = deps.data.dec(cl.adoazonositoJelEnc, 'clients.adoazonosito_jel');
    await auditC(c, deps.db, 'client.adoazonosito_viewed', { targetType: 'client', targetId: cl.id, clientId: cl.id });
    return c.json({ adoazonositoJel: value });
  });

  r.patch('/clients/:id/tax-profile', async (c) => {
    const { cl } = await own(c);
    const b = await readJson(
      c,
      z.object({
        year: z.number().int().min(2024).max(2100),
        costRatio: z.union([z.literal(45), z.literal(50), z.literal(80), z.literal(90)]).optional(),
        status: z.enum(['fofoglalkozasu', 'mellekallasu', 'nyugdijas']).optional(),
        guaranteedMinimum: z.boolean().optional(),
        retail: z.boolean().optional(),
        atalanyFrom: z.string().refine(isIsoDate).nullable().optional(),
        insuranceBreaks: z.array(z.object({ from: z.string().refine(isIsoDate), to: z.string().refine(isIsoDate), kind: z.enum(['szunetel', 'kieso']) })).max(24).optional(),
        hipa: z.object({ method: z.enum(['savos', 'altalanos', 'nincs']), ratePct: z.number().min(0).max(2), accountNumber: z.string().max(40).optional() }).optional(),
        priorOverrides: z.object({ throughQuarter: z.union([z.literal(1), z.literal(2), z.literal(3)]), priorActualBaseSum: z.number().int().min(0), priorSzjaAdvanceSum: z.number().int().min(0) }).nullable().optional(),
        // null / '' clears it: the questionnaire never asks for ÖVTJ, so most new clients have none yet.
        activityCode: z.string().trim().max(20).nullable().optional(),
        alairtPdfAllowed: z.boolean().optional(),
        expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
        allowances: z.array(z.object({ kind: z.enum(['csaladi', 'fiatal_25', 'anyak', 'egyeb']), note: z.string().trim().max(200).optional() })).max(6).nullable().optional(),
      }),
    );
    for (const br of b.insuranceBreaks ?? []) if (br.from > br.to) throw E.validation({ insuranceBreaks: 'A kezdet nem lehet a vég után.' });
    const [tp] = await deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, b.year))).limit(1);
    if (b.expectedUpdatedAt && tp && new Date(b.expectedUpdatedAt).getTime() !== tp.updatedAt.getTime())
      throw E.conflict('Az adóprofilt közben módosították (például az ügyfél kérdőíve). Frissítsd az oldalt.');
    const patch = {
      ...(b.costRatio !== undefined ? { costRatio: b.costRatio, costRatioSource: 'konyvelo_megerositette' as const } : {}),
      ...(b.status ? { status: b.status } : {}),
      ...(b.guaranteedMinimum !== undefined ? { guaranteedMinimum: b.guaranteedMinimum } : {}),
      ...(b.retail !== undefined ? { retail: b.retail } : {}),
      ...(b.atalanyFrom !== undefined ? { atalanyFrom: b.atalanyFrom } : {}),
      ...(b.insuranceBreaks ? { insuranceBreaks: b.insuranceBreaks } : {}),
      ...(b.hipa ? { hipaMethod: b.hipa.method, hipaRatePct: b.hipa.ratePct.toFixed(2), hipaAccountNumber: b.hipa.accountNumber ?? null } : {}),
      ...(b.priorOverrides !== undefined ? { priorOverrides: b.priorOverrides } : {}),
      ...(b.allowances !== undefined ? { allowances: b.allowances?.length ? b.allowances : null } : {}),
      updatedAt: deps.now(),
    };
    if (tp) await deps.db.update(clientTaxProfiles).set(patch).where(eq(clientTaxProfiles.id, tp.id));
    else await deps.db.insert(clientTaxProfiles).values({ clientId: cl.id, year: b.year, costRatio: b.costRatio ?? 45, costRatioSource: b.costRatio ? 'konyvelo_megerositette' : 'ugyfel_javaslat', ...patch });
    if (b.activityCode !== undefined || b.alairtPdfAllowed !== undefined)
      await deps.db.update(clients).set({ ...(b.activityCode !== undefined ? { activityCode: b.activityCode || null } : {}), ...(b.alairtPdfAllowed !== undefined ? { alairtPdfAllowed: b.alairtPdfAllowed } : {}) }).where(eq(clients.id, cl.id));
    await auditC(c, deps.db, 'client.tax_profile_updated', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { year: b.year, fields: Object.keys(b).filter((k) => k !== 'year') } });
    // The engine holds ONE jogállás per year (ado-motor README "One jogállás per year"). Changing it in a year that
    // already has an approved quarter recalculates the open quarters as if it had applied since January: leave a
    // pinned internal note so the accountant checks the göngyölítés (round 1, 2026-11-19).
    if (tp && b.status && b.status !== tp.status) {
      const [approved] = await deps.db.select({ id: taxPeriods.id }).from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.year, b.year), eq(taxPeriods.kind, 'negyedev'), eq(taxPeriods.calcStatus, 'jovahagyva'))).limit(1);
      if (approved) {
        const nev: Record<string, string> = { fofoglalkozasu: 'főfoglalkozású', mellekallasu: 'mellékállású', nyugdijas: 'nyugdíjas' };
        await deps.db.insert(internalNotes).values({
          clientId: cl.id,
          authorUserId: auth(c).userId,
          pinned: true,
          body: `Rendszerjegyzet: a ${b.year}. évi jogállás megváltozott (${nev[tp.status] ?? tp.status} → ${nev[b.status] ?? b.status}), pedig az évben már van jóváhagyott negyedév. A számolás a jogállást az egész évre veszi, ezért a még nyitott negyedévek göngyölítése hibás lehet. Ha a változás év közben történt: a korábbi hónapokat add meg kieső időszakként, vagy rögzítsd a már beadott negyedévek adatait („korábbi negyedévek kézzel”), és számolj újra.`,
        });
        await auditC(c, deps.db, 'client.tax_status_changed_midyear', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { year: b.year, from: tp.status, to: b.status } });
      }
    }
    await recalcYear(deps, deps.db, cl.id, b.year, { by: auth(c).userId });
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await taxProfileDto(cl.id, b.year));
  });

  r.post('/clients/:id/onboarding/:step', async (c) => {
    const { acc, cl } = await own(c);
    const step = c.req.param('step');
    if (!(ONBOARDING_STEPS as readonly string[]).includes(step)) throw E.notFound();
    // 'vallalkozas_inditas' follows the registration (team pipeline); 'idopont' is retired (SPEC §26.1.6, §26.2.9).
    if (step === 'vallalkozas_inditas') throw E.conflict('Ezt a lépést a vállalkozás bejelentése állítja (ügyfélszolgálat).');
    if (step === 'idopont') throw E.retired('Az időpont lépés megszűnt.');
    const b = await readJson(c, z.object({ status: z.enum(['kesz', 'hianyos', 'kihagyva', 'ugyfelre_var']), note: z.string().trim().max(1000).optional(), override: z.boolean().optional() }));
    if (b.status === 'hianyos' && !b.note) throw E.validation({ note: 'Írd le az ügyfélnek, mit kell pótolnia.' });
    if (b.status === 'ugyfelre_var' && step !== 'meghatalmazas') throw E.validation({ status: 'Ez az állapot csak a meghatalmazásnál választható (jóváhagyásra vár).' });
    // Round 1 (2026-11-19): a step can only be closed over a real record. Before this, three calls made a client
    // 'aktiv' without a KYC record or a submitted meghatalmazás.
    if (step === 'fiok' || step === 'adatok' || step === 'szerzodes' || step === 'elofizetes')
      throw E.conflict('Ezt a lépést csak az ügyfél teljesítheti (e-mail megerősítése, adatok, szerződés, előfizetés).');
    if (step === 'azonositas') throw E.conflict('Az azonosítást az okmányok átnézésénél bírálod el (Azonosítás → Megnézem és elbírálom).');
    if (step === 'meghatalmazas') {
      // SPEC §27.3: an "Intézzük helyette" request drives this step – one place for its state (the assist page).
      if (await openAssistOf(deps.db, cl.id)) throw E.conflict('Ennél az ügyfélnél a meghatalmazást az „Intézzük helyette” oldalon vezeted: ott jelöld, ha beküldted, és ha él.');
      const cur = (await steps(deps.db, cl.id)).get('meghatalmazas');
      const submitted = Boolean((cur?.data as { method?: string } | null)?.method);
      if (b.status === 'kihagyva') throw E.conflict('A meghatalmazás nem hagyható ki: enélkül nem járhatsz el az ügyfél nevében a NAV-nál.');
      if (b.status === 'kesz' && cur?.status !== 'konyvelore_var') {
        // Explicit override (e.g. the meghatalmazás was filed on paper): only with a written reason, audited apart.
        if (!b.override || (b.note ?? '').length < 10)
          throw E.conflict(submitted ? 'Az ügyfél még nem hagyta jóvá a meghatalmazást. Várd meg, amíg jelzi az appban.' : 'Az ügyfél még nem küldte be a meghatalmazást, ezért nincs mit ellenőrizni.');
        await auditC(c, deps.db, 'onboarding.step_override', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { step, status: b.status, reasonLength: (b.note ?? '').length } });
      }
      if ((b.status === 'hianyos' || b.status === 'ugyfelre_var') && !submitted) throw E.conflict('Az ügyfél még nem küldte be a meghatalmazást, ezért nincs mit visszaküldeni.');
    }
    if (step === 'nav_bekotes' && b.status === 'kesz') {
      const [nc] = await deps.db.select({ status: navCredentials.status }).from(navCredentials).where(eq(navCredentials.clientId, cl.id)).limit(1);
      if (nc?.status !== 'rendben') throw E.conflict('A számlák bekötése akkor kész, ha a NAV-kapcsolat próbája sikerült. Mentsd el a technikai felhasználót, és próbáld ki.');
    }
    const s = step as (typeof ONBOARDING_STEPS)[number];
    await setStep(deps, deps.db, cl.id, s, b.status, { note: b.note ?? null, by: auth(c).userId });
    if (s === 'meghatalmazas' && b.status === 'kesz' && (await stepStatus(deps.db, cl.id, 'nav_bekotes')) === 'nincs_kezdve') await setStep(deps, deps.db, cl.id, 'nav_bekotes', 'konyvelore_var');
    if (s === 'idopont' && b.status === 'kesz') {
      await deps.db.update(appointments).set({ status: 'megtortent' }).where(and(eq(appointments.clientId, cl.id), eq(appointments.status, 'foglalt'), lt(appointments.startsAt, deps.now())));
    }
    await auditC(c, deps.db, 'onboarding.step_reviewed', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { step, status: b.status } });
    const ap = await accountantParams(deps.db, acc.id);
    if (b.status === 'hianyos') await notify(deps, deps.db, { userId: cl.userId, kind: 'onboarding_needs_fix', params: { ...ap, note: b.note ?? '' }, link: '/bekotes' });
    if (b.status === 'ugyfelre_var' && s === 'meghatalmazas')
      await notify(deps, deps.db, { userId: cl.userId, kind: 'onboarding_needs_fix', variant: 'jovahagyas', params: { ...ap, note: b.note ?? `${ap.firstName} beadta a meghatalmazást. Hagyd jóvá az ONYA-ban 4 napon belül.` }, link: '/bekotes/meghatalmazas' });
    await checkCompletion(deps, deps.db, cl.id);
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await onboardingState(deps, deps.db, cl.id));
  });

  // ---------- KYC ----------
  r.get('/clients/:id/kyc', async (c) => {
    const { cl } = await own(c);
    const [k] = await deps.db.select().from(kycRecords).where(eq(kycRecords.clientId, cl.id)).orderBy(desc(kycRecords.submittedAt)).limit(1);
    if (!k) return c.json({ status: null });
    await auditC(c, deps.db, 'kyc.viewed', { targetType: 'kyc_record', targetId: k.id, clientId: cl.id });
    const f = k.files;
    const ids = Object.values(f).filter((x): x is string => Boolean(x));
    const mimes = ids.length ? await deps.db.select({ id: files.id, mime: files.mime }).from(files).where(inArray(files.id, ids)) : [];
    return c.json({
      fileMimes: Object.fromEntries(Object.entries(f).filter(([, v]) => v).map(([key, v]) => [key, mimes.find((m) => m.id === v)?.mime ?? 'application/octet-stream'])),
      status: k.status,
      submittedAt: k.submittedAt.toISOString(),
      reviewNote: k.reviewNote,
      data: deps.data.decJson<Record<string, string>>(k.dataEnc, `kyc_records:${cl.id}`),
      declarations: fullDeclarations(deps, k),
      files: { ...(f.idFront ? { idFront: f.idFront } : {}), ...(f.idBack ? { idBack: f.idBack } : {}), ...(f.addressFront ? { addressFront: f.addressFront } : {}), ...(f.addressBack ? { addressBack: f.addressBack } : {}) },
    });
  });

  r.post('/clients/:id/kyc/review', async (c) => {
    const { acc, cl } = await own(c);
    const b = await readJson(c, z.object({ status: z.enum(['elfogadva', 'hianyos']), note: z.string().trim().max(1000).optional() }));
    if (b.status === 'hianyos' && !b.note) throw E.validation({ note: 'Írd le, mit kell pótolni.' });
    const [k] = await deps.db.select().from(kycRecords).where(eq(kycRecords.clientId, cl.id)).orderBy(desc(kycRecords.submittedAt)).limit(1);
    if (!k) throw E.notFound();
    await deps.db.update(kycRecords).set({ status: b.status, reviewedBy: auth(c).userId, reviewedAt: deps.now(), reviewNote: b.note ?? null }).where(eq(kycRecords.id, k.id));
    await setStep(deps, deps.db, cl.id, 'azonositas', b.status === 'elfogadva' ? 'kesz' : 'hianyos', { note: b.note ?? null, by: auth(c).userId });
    await auditC(c, deps.db, 'kyc.reviewed', { targetType: 'kyc_record', targetId: k.id, clientId: cl.id, details: { status: b.status } });
    if (b.status === 'hianyos') await notify(deps, deps.db, { userId: cl.userId, kind: 'onboarding_needs_fix', params: { ...(await accountantParams(deps.db, acc.id)), note: b.note ?? '' }, link: '/bekotes/azonositas' });
    await checkCompletion(deps, deps.db, cl.id);
    await computeFlags(deps, deps.db, cl.id);
    return c.json({ status: b.status });
  });

  // ---------- NAV credentials (write-only) ----------
  r.put('/clients/:id/nav-credentials', async (c) => {
    const { cl } = await own(c);
    const b = await readJson(
      c,
      z.object({
        login: z
          .string()
          .trim()
          .regex(/^[A-Za-z0-9]{6,15}$/, { error: 'A technikai felhasználó neve 6–15 betű vagy szám lehet, szóköz és ékezet nélkül.' }),
        password: z.string().min(1, { error: 'Kötelező.' }).max(100),
        signatureKey: z.string().trim().min(8, { error: 'Túl rövid.' }).max(100),
        exchangeKey: z.string().trim().max(100).optional(),
        taxNumber: z.string().trim().regex(/^\d{8}$/, { error: '8 számjegy (törzsszám).' }).refine(isValidTorzsszam, { error: 'Ez a törzsszám nem stimmel.' }),
        environment: z.enum(['demo', 'test', 'prod']).optional(),
      }),
    );
    if (cl.adoszam && cl.adoszam.slice(0, 8) !== b.taxNumber) throw E.validation({ taxNumber: 'Nem egyezik az ügyfél adószámának első 8 jegyével.' });
    const env = b.environment ?? (deps.cfg.nav.mode === 'disabled' ? 'prod' : deps.cfg.nav.mode);
    if (deps.cfg.appEnv === 'production' && env === 'demo') throw E.validation({ environment: 'Éles módban nincs DEMO NAV.' });
    const secretEnc = deps.navKey.encJson({ login: b.login, password: b.password, signatureKey: b.signatureKey, ...(b.exchangeKey ? { exchangeKey: b.exchangeKey } : {}) }, `nav_credentials:${cl.id}`);
    const now = deps.now();
    const values = { clientId: cl.id, taxNumber: b.taxNumber, secretEnc, loginHint: `${b.login.slice(0, 3)}…`, environment: env, status: 'nincs_ellenorizve' as const, savedBy: auth(c).userId, savedAt: now, lastTestAt: null, lastTestError: null, syncCursorInsDate: null };
    await deps.db.insert(navCredentials).values(values).onConflictDoUpdate({ target: navCredentials.clientId, set: values });
    if ((await stepStatus(deps.db, cl.id, 'nav_bekotes')) !== 'kesz') await setStep(deps, deps.db, cl.id, 'nav_bekotes', 'konyvelore_var');
    await auditC(c, deps.db, 'nav_credentials.saved', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { environment: env } });
    return c.json({ status: 'nincs_ellenorizve', loginHint: values.loginHint, savedAt: now.toISOString() });
  });

  r.delete('/clients/:id/nav-credentials', async (c) => {
    const { cl } = await own(c);
    await deps.db.delete(navCredentials).where(eq(navCredentials.clientId, cl.id));
    await auditC(c, deps.db, 'nav_credentials.deleted', { targetType: 'client', targetId: cl.id, clientId: cl.id });
    return c.body(null, 204);
  });

  r.post('/clients/:id/nav-credentials/test', async (c) => {
    const { cl } = await own(c);
    const h = deps.limiter.hit(`navtest:${cl.id}`, 10, 15 * 60_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    const [n] = await deps.db.select().from(navCredentials).where(eq(navCredentials.clientId, cl.id)).limit(1);
    if (!n) throw E.notFound('Még nincs megadva NAV-kapcsolat.');
    let ok = false;
    let messageHu = 'A kapcsolat rendben.';
    let code: string | undefined;
    try {
      const client = deps.navClient(n.environment, credsFor(deps, n));
      const res = await client.checkConnection();
      ok = res.ok;
      messageHu = res.messageHu;
      code = res.code;
    } catch (err) {
      code = isNavError(err) ? err.code : 'INTERNAL';
      messageHu = isNavError(err) ? err.messageHu : 'Váratlan hiba.';
    }
    const authErr = code && ['INVALID_SECURITY_USER', 'INVALID_REQUEST_SIGNATURE', 'FORBIDDEN', 'NOT_REGISTERED_CUSTOMER', 'INVALID_CUSTOMER', 'INVALID_USER_RELATION'].includes(code);
    await deps.db
      .update(navCredentials)
      .set({ lastTestAt: deps.now(), lastTestError: ok ? null : messageHu, ...(ok ? { status: 'rendben' as const } : authErr ? { status: 'hibas' as const } : {}) })
      .where(eq(navCredentials.id, n.id));
    await auditC(c, deps.db, 'nav_credentials.tested', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { ok, code } });
    await computeFlags(deps, deps.db, cl.id);
    return c.json({ ok, messageHu, ...(code ? { code } : {}) });
  });

  r.post('/clients/:id/nav-sync', async (c) => {
    const { cl } = await own(c);
    const h = deps.limiter.hit(`navsync:${cl.id}`, 6, 15 * 60_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    try {
      const res = await syncClient(deps, cl.id, { by: auth(c).userId });
      return c.json(res);
    } catch (err) {
      if (isNavError(err)) throw new ApiError(409, 'nav_error', err.messageHu);
      throw err;
    }
  });

  r.get('/clients/:id/nav-sync-runs', async (c) => {
    const { cl } = await own(c);
    const rows = await deps.db.select().from(navSyncRuns).where(eq(navSyncRuns.clientId, cl.id)).orderBy(desc(navSyncRuns.startedAt)).limit(30);
    return c.json({ items: rows.map((x) => ({ id: x.id, startedAt: x.startedAt.toISOString(), finishedAt: x.finishedAt?.toISOString() ?? null, status: x.status, digestsSeen: x.digestsSeen, invoicesNew: x.invoicesNew, errorCode: x.errorCode })) });
  });

  // ================= dossier & documents =================
  async function accDocs(cl: ClientRow, firstName: string, rows: (typeof documents.$inferSelect)[]) {
    const items = await listItems(deps.db, rows, { firstName, staff: true });
    const verIds = rows.map((d) => d.currentVersionId).filter((x): x is string => Boolean(x));
    const vers = verIds.length ? await deps.db.select({ id: documentVersions.id, fileId: documentVersions.fileId, mime: files.mime }).from(documentVersions).innerJoin(files, eq(files.id, documentVersions.fileId)).where(inArray(documentVersions.id, verIds)) : [];
    const creators = rows.map((d) => d.createdBy).filter((x): x is string => Boolean(x));
    const roles = creators.length ? await deps.db.select({ id: users.id, role: users.role }).from(users).where(inArray(users.id, creators)) : [];
    return items.map((it, i) => {
      const d = rows[i]!;
      const v = vers.find((x) => x.id === d.currentVersionId);
      const role = roles.find((x) => x.id === d.createdBy)?.role;
      return {
        ...it,
        visibility: d.visibility,
        createdAt: d.createdAt.toISOString(),
        createdByRole: role === 'client' ? 'client' : role ? 'accountant' : 'system',
        ...(d.clientNote ? { clientNote: d.clientNote } : {}),
        ...(d.accountantComment ? { accountantComment: d.accountantComment } : {}),
        ...(v ? { fileId: v.fileId, mime: v.mime } : {}),
      };
    });
  }

  function revenueDto(x: typeof revenueItems.$inferSelect): RevenueItem & { deletedAt?: string } {
    return {
      id: x.id,
      source: x.source,
      ...(x.navInvoiceId ? { navInvoiceId: x.navInvoiceId } : {}),
      ...(x.documentId ? { documentId: x.documentId } : {}),
      receivedOn: x.receivedOn,
      receivedOnEstimated: x.receivedOnEstimated,
      deliveryDate: x.deliveryDate,
      amountHuf: x.amountHuf,
      description: x.description,
      countsForAtalany: x.countsForAtalany,
      countsForAfaLimit: x.countsForAfaLimit,
      ...(x.excludedReason ? { excludedReason: x.excludedReason } : {}),
      ...(x.deletedAt ? { deletedAt: x.deletedAt.toISOString() } : {}),
    };
  }

  r.get('/clients/:id/dossiers', async (c) => {
    const { cl } = await own(c);
    const today = todayBudapest(deps.now());
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }));
    return c.json({ months: await dossierMonths(deps.db, cl.id, q.year ?? Number(today.slice(0, 4)), true, today) });
  });

  r.get('/clients/:id/dossiers/:month', async (c) => {
    const { acc, cl } = await own(c);
    const month = c.req.param('month');
    if (!isMonthKey(month)) throw E.notFound();
    const docs = await deps.db.select().from(documents).where(and(eq(documents.clientId, cl.id), eq(documents.dossierMonth, month), isNull(documents.deletedAt))).orderBy(desc(documents.createdAt));
    const inv = await deps.db.select().from(navInvoices).where(and(eq(navInvoices.clientId, cl.id), eq(navInvoices.dossierMonth, month))).orderBy(asc(navInvoices.issueDate));
    const rev = await deps.db.select().from(revenueItems).where(and(eq(revenueItems.clientId, cl.id), sql`to_char(${revenueItems.receivedOn}, 'YYYY-MM') = ${month}`)).orderBy(asc(revenueItems.receivedOn));
    const [dos] = await deps.db.select().from(dossiers).where(and(eq(dossiers.clientId, cl.id), eq(dossiers.month, month))).limit(1);
    const openReq = await deps.db.select().from(requests).where(and(eq(requests.clientId, cl.id), eq(requests.dossierMonth, month), inArray(requests.status, ['nyitott', 'folyamatban'])));
    const minIdx = inv.length ? Math.min(...inv.map((i) => DOCUMENT_STATUSES.indexOf(i.status))) : -1;
    return c.json({
      month,
      label: monthLabel(month),
      documents: await accDocs(cl, acc.firstName, docs),
      navInvoices: {
        items: inv.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, issueDate: i.issueDate, customerName: i.customerName, grossAmountHuf: i.grossHuf, status: i.status, demo: i.demo })),
        totalHuf: inv.reduce((a, b) => a + b.grossHuf, 0),
        status: minIdx >= 0 ? DOCUMENT_STATUSES[minIdx] : null,
      },
      revenueItems: rev.map(revenueDto),
      review: dos?.reviewedAt ? { at: dos.reviewedAt.toISOString(), okCount: docs.filter((d) => d.status !== 'feltoltve').length, note: dos.summaryNote ?? undefined } : null,
      openRequests: await Promise.all(openReq.map((x) => requestSummary(deps.db, x, acc.firstName, 'accountant'))),
    });
  });

  r.post('/clients/:id/dossiers/:month/review', async (c) => {
    const { cl } = await own(c);
    const month = c.req.param('month');
    if (!isMonthKey(month)) throw E.notFound();
    const b = await readJson(c, z.object({ note: z.string().trim().max(500).optional() }));
    await deps.db
      .insert(dossiers)
      .values({ clientId: cl.id, month, reviewedAt: deps.now(), reviewedBy: auth(c).userId, summaryNote: b.note ?? null })
      .onConflictDoUpdate({ target: [dossiers.clientId, dossiers.month], set: { reviewedAt: deps.now(), reviewedBy: auth(c).userId, summaryNote: b.note ?? null } });
    await auditC(c, deps.db, 'dossier.reviewed', { targetType: 'dossier', targetId: `${cl.id}:${month}`, clientId: cl.id });
    return c.json({ ok: true });
  });

  async function accDoc(c: C, id: string) {
    const acc = await me(c);
    const [d] = await deps.db
      .select({ d: documents })
      .from(documents)
      .innerJoin(clients, eq(clients.id, documents.clientId))
      .where(and(eq(documents.id, id), eq(clients.accountantId, acc.id), isNull(documents.deletedAt)))
      .limit(1);
    if (!d) throw E.notFound();
    return { acc, doc: d.d };
  }

  r.get('/documents/:id', async (c) => {
    let { acc, doc } = await accDoc(c, param(c, 'id'));
    if (doc.status === 'feltoltve' && doc.source === 'ugyfel') doc = await setStatus(deps, deps.db, doc, 'konyvelo_latta', auth(c).userId);
    await auditC(c, deps.db, 'document.viewed', { targetType: 'document', targetId: doc.id, clientId: doc.clientId });
    const [cl] = await deps.db.select().from(clients).where(eq(clients.id, doc.clientId)).limit(1);
    const [full] = await accDocs(cl!, acc.firstName, [doc]);
    const detail = await documentDetail(deps.db, doc, acc.firstName, true);
    return c.json({ ...detail, ...full, versions: detail.versions, history: detail.history });
  });

  r.post('/clients/:id/documents', async (c) => {
    const { acc, cl } = await own(c);
    const len = Number(c.req.header('content-length') ?? '0');
    if (len > MAX_REQUEST_BYTES) throw E.tooLarge('Egyszerre legfeljebb 60 MB.');
    const body = await c.req.parseBody({ all: true });
    const meta = z
      .object({
        category: z.enum(DOCUMENT_CATEGORIES),
        dossierMonth: z.string().refine(isMonthKey),
        title: z.string().trim().min(1).max(120).optional(),
        visibility: z.enum(['kozos', 'csak_konyvelo']).default('kozos'),
        status: z.enum(DOCUMENT_STATUSES).optional(),
        note: z.string().trim().max(1000).optional(),
      })
      .safeParse({ category: body.category, dossierMonth: body.dossierMonth, title: body.title || undefined, visibility: body.visibility || undefined, status: body.status || undefined, note: body.note || undefined });
    if (!meta.success) throw E.validation(Object.fromEntries(meta.error.issues.map((i) => [i.path.join('.'), 'Hibás vagy hiányzó érték.'])));
    const doc = await deps.db.transaction(async (tx) =>
      createDocument(deps, tx, {
        clientId: cl.id,
        source: 'konyvelo',
        category: meta.data.category,
        dossierMonth: meta.data.dossierMonth,
        title: meta.data.title,
        note: meta.data.note,
        visibility: meta.data.visibility,
        status: meta.data.status ?? 'feldolgozva',
        createdBy: auth(c).userId,
        files: await collectFiles(body, 'file'),
        pages: await collectFiles(body, 'pages'),
        actorRole: 'accountant',
      }),
    );
    const [full] = await accDocs(cl, acc.firstName, [doc]);
    return c.json({ ...(await documentDetail(deps.db, doc, acc.firstName, true)), ...full }, 201);
  });

  r.post('/documents/:id/versions', async (c) => {
    const { acc, doc } = await accDoc(c, param(c, 'id'));
    const body = await c.req.parseBody({ all: true });
    const u = await deps.db.transaction(async (tx) => addVersion(deps, tx, doc, await collectFiles(body, 'file'), await collectFiles(body, 'pages'), auth(c).userId, 'accountant'));
    return c.json(await documentDetail(deps.db, u, acc.firstName, true));
  });

  r.patch('/documents/:id', async (c) => {
    const { acc, doc } = await accDoc(c, param(c, 'id'));
    const b = await readJson(
      c,
      z.object({
        status: z.enum(DOCUMENT_STATUSES).optional(),
        statusNote: z.string().trim().max(500).optional(),
        category: z.enum(DOCUMENT_CATEGORIES).optional(),
        title: z.string().trim().min(1).max(120).optional(),
        dossierMonth: z.string().refine(isMonthKey).optional(),
        amountHuf: z.number().int().nullable().optional(),
        documentDate: z.string().refine(isIsoDate).nullable().optional(),
        accountantComment: z.string().trim().max(1000).nullable().optional(),
        visibility: z.enum(['kozos', 'csak_konyvelo']).optional(),
        /** Optimistic concurrency: the updatedAt the panel loaded. A newer row → 409, the panel reloads. */
        expectedUpdatedAt: z.string().datetime({ offset: true }).optional(),
      }),
    );
    if (b.expectedUpdatedAt && new Date(b.expectedUpdatedAt).getTime() !== doc.updatedAt.getTime())
      throw E.conflict('Ezt az iratot közben valaki módosította (például az ügyfél új változatot töltött fel). Frissítsd az oldalt.');
    let d = doc;
    const patch = {
      ...(b.category ? { category: b.category } : {}),
      ...(b.title ? { title: b.title } : {}),
      ...(b.dossierMonth ? { dossierMonth: b.dossierMonth } : {}),
      ...(b.amountHuf !== undefined ? { amountHuf: b.amountHuf } : {}),
      ...(b.documentDate !== undefined ? { documentDate: b.documentDate } : {}),
      ...(b.accountantComment !== undefined ? { accountantComment: b.accountantComment } : {}),
      ...(b.visibility ? { visibility: b.visibility } : {}),
    };
    if (Object.keys(patch).length) [d] = (await deps.db.update(documents).set({ ...patch, updatedAt: deps.now() }).where(eq(documents.id, doc.id)).returning()) as [typeof doc];
    if (b.status && b.status !== d.status) {
      d = await setStatus(deps, deps.db, d, b.status, auth(c).userId, b.statusNote);
      const [cl] = await deps.db.select().from(clients).where(eq(clients.id, d.clientId)).limit(1);
      if (cl && d.visibility === 'kozos') {
        const ap = await accountantParams(deps.db, acc.id);
        if (b.status === 'feldolgozva') await notify(deps, deps.db, { userId: cl.userId, kind: 'document_processed', params: { ...ap, count: 1 }, link: `/dosszie?honap=${d.dossierMonth}` });
        if (b.status === 'beadva') await notify(deps, deps.db, { userId: cl.userId, kind: 'document_filed', params: { ...ap, count: 1 }, link: `/dosszie?honap=${d.dossierMonth}` });
      }
    }
    if (Object.keys(patch).length) await auditC(c, deps.db, 'document.updated', { targetType: 'document', targetId: d.id, clientId: d.clientId, details: { fields: Object.keys(patch) } });
    return c.json(await documentDetail(deps.db, d, acc.firstName, true));
  });

  r.post('/documents/bulk-status', async (c) => {
    const acc = await me(c);
    const b = await readJson(c, z.object({ ids: z.array(z.string().uuid()).min(1).max(200), status: z.enum(DOCUMENT_STATUSES), note: z.string().trim().max(500).optional() }));
    const rows = await deps.db
      .select({ d: documents })
      .from(documents)
      .innerJoin(clients, eq(clients.id, documents.clientId))
      .where(and(inArray(documents.id, b.ids), eq(clients.accountantId, acc.id), isNull(documents.deletedAt)));
    if (rows.length !== b.ids.length) throw E.notFound();
    const perClient = new Map<string, number>();
    for (const { d } of rows) {
      if (d.status === b.status) continue;
      await setStatus(deps, deps.db, d, b.status, auth(c).userId, b.note);
      if (d.visibility === 'kozos') perClient.set(d.clientId, (perClient.get(d.clientId) ?? 0) + 1);
    }
    if (b.status === 'feldolgozva' || b.status === 'beadva') {
      const ap = await accountantParams(deps.db, acc.id);
      for (const [clientId, n] of perClient) {
        const [cl] = await deps.db.select({ userId: clients.userId }).from(clients).where(eq(clients.id, clientId)).limit(1);
        if (cl) await notify(deps, deps.db, { userId: cl.userId, kind: b.status === 'feldolgozva' ? 'document_processed' : 'document_filed', params: { ...ap, count: n }, link: '/dosszie' });
      }
    }
    return c.json({ updated: rows.length });
  });

  // ---------- NAV invoices ----------
  r.get('/clients/:id/nav-invoices', async (c) => {
    const { cl } = await own(c);
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }));
    const year = q.year ?? Number(todayBudapest(deps.now()).slice(0, 4));
    const rows = await deps.db
      .select({ i: navInvoices, rv: revenueItems })
      .from(navInvoices)
      .leftJoin(revenueItems, and(eq(revenueItems.navInvoiceId, navInvoices.id), isNull(revenueItems.deletedAt)))
      .where(and(eq(navInvoices.clientId, cl.id), sql`${navInvoices.dossierMonth} like ${`${year}-%`}`))
      .orderBy(desc(navInvoices.issueDate));
    return c.json({ items: rows.map(({ i, rv }) => navRow(i, rv)) });
  });

  function navRow(i: typeof navInvoices.$inferSelect, rv: typeof revenueItems.$inferSelect | null) {
    return {
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      issueDate: i.issueDate,
      customerName: i.customerName,
      grossAmountHuf: i.grossHuf,
      status: i.status,
      demo: i.demo,
      operation: i.operation,
      deliveryDate: i.deliveryDate,
      paymentDate: i.paymentDate,
      paymentMethod: i.paymentMethod,
      customerTaxNumber: i.customerTaxNumber,
      revenueItemId: rv?.id ?? null,
      receivedOn: rv?.receivedOn ?? null,
      receivedOnEstimated: rv?.receivedOnEstimated ?? false,
    };
  }

  r.get('/nav-invoices/:id', async (c) => {
    const acc = await me(c);
    const [row] = await deps.db
      .select({ i: navInvoices, rv: revenueItems })
      .from(navInvoices)
      .innerJoin(clients, eq(clients.id, navInvoices.clientId))
      .leftJoin(revenueItems, and(eq(revenueItems.navInvoiceId, navInvoices.id), isNull(revenueItems.deletedAt)))
      .where(and(eq(navInvoices.id, param(c, 'id')), eq(clients.accountantId, acc.id)))
      .limit(1);
    if (!row) throw E.notFound();
    const data = (row.i.data ?? {}) as { vatExemption?: unknown; lines?: unknown[] };
    return c.json({ ...navRow(row.i, row.rv), currency: row.i.currency, netHuf: row.i.netHuf, vatHuf: row.i.vatHuf, vatExemption: data.vatExemption ?? null, lines: data.lines ?? [] });
  });

  r.patch('/nav-invoices/:id', async (c) => {
    const acc = await me(c);
    const b = await readJson(c, z.object({ status: z.enum(DOCUMENT_STATUSES) }));
    const [row] = await deps.db.select({ i: navInvoices }).from(navInvoices).innerJoin(clients, eq(clients.id, navInvoices.clientId)).where(and(eq(navInvoices.id, param(c, 'id')), eq(clients.accountantId, acc.id))).limit(1);
    if (!row) throw E.notFound();
    await deps.db.update(navInvoices).set({ status: b.status, statusChangedAt: deps.now() }).where(eq(navInvoices.id, row.i.id));
    await auditC(c, deps.db, 'nav_invoice.status_changed', { targetType: 'nav_invoice', targetId: row.i.id, clientId: row.i.clientId, details: { to: b.status } });
    return c.json({ ok: true });
  });

  r.post('/clients/:id/nav-invoices/bulk-status', async (c) => {
    const { cl } = await own(c);
    const b = await readJson(c, z.object({ month: z.string().refine(isMonthKey), status: z.enum(DOCUMENT_STATUSES) }));
    const res = await deps.db.update(navInvoices).set({ status: b.status, statusChangedAt: deps.now() }).where(and(eq(navInvoices.clientId, cl.id), eq(navInvoices.dossierMonth, b.month))).returning({ id: navInvoices.id });
    await auditC(c, deps.db, 'nav_invoice.status_changed', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { month: b.month, to: b.status, n: res.length } });
    return c.json({ updated: res.length });
  });

  // ---------- revenue ----------
  r.get('/clients/:id/revenue', async (c) => {
    const { cl } = await own(c);
    const today = todayBudapest(deps.now());
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }));
    const year = q.year ?? Number(today.slice(0, 4));
    const rows = await deps.db
      .select()
      .from(revenueItems)
      .where(and(eq(revenueItems.clientId, cl.id), sql`(${revenueItems.receivedOn} between ${`${year}-01-01`} and ${`${year}-12-31`} or ${revenueItems.deliveryDate} between ${`${year}-01-01`} and ${`${year}-12-31`})`))
      .orderBy(asc(revenueItems.receivedOn));
    const comp = await computeYear(deps.db, cl.id, year, year < Number(today.slice(0, 4)) ? `${year}-12-31` : today);
    const byMonth = comp?.result.revenueByMonth ?? [];
    // Same total as the client sees: the year's átalány revenue (sum of the months).
    return c.json({ items: rows.map(revenueDto), byMonth, totalHuf: byMonth.reduce((a, b) => a + b.amountHuf, 0), meters: accMeters(comp?.result.meters) });
  });

  const revSchema = z.object({
    receivedOn: z.string().refine(isIsoDate),
    deliveryDate: z.string().refine(isIsoDate).optional(),
    amountHuf: z.number().int().min(-1_000_000_000).max(1_000_000_000),
    description: z.string().trim().min(1).max(200),
    documentId: z.string().uuid().optional(),
    countsForAtalany: z.boolean().optional(),
    countsForAfaLimit: z.boolean().optional(),
    excludedReason: z.string().trim().max(200).optional(),
  });

  r.post('/clients/:id/revenue-items', async (c) => {
    const { cl } = await own(c);
    const b = await readJson(c, revSchema);
    if (b.documentId) {
      const [d] = await deps.db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, b.documentId), eq(documents.clientId, cl.id))).limit(1);
      if (!d) throw E.validation({ documentId: 'Nincs ilyen irat.' });
    }
    const [row] = await deps.db
      .insert(revenueItems)
      .values({ clientId: cl.id, source: 'kezi', documentId: b.documentId ?? null, receivedOn: b.receivedOn, deliveryDate: b.deliveryDate ?? b.receivedOn, amountHuf: b.amountHuf, description: b.description, countsForAtalany: b.countsForAtalany ?? true, countsForAfaLimit: b.countsForAfaLimit ?? true, excludedReason: b.excludedReason ?? null, createdBy: auth(c).userId })
      .returning();
    await auditC(c, deps.db, 'revenue.created', { targetType: 'revenue_item', targetId: row!.id, clientId: cl.id, details: { amountHuf: b.amountHuf } });
    await recalcYear(deps, deps.db, cl.id, Number(b.receivedOn.slice(0, 4)), { by: auth(c).userId });
    await computeFlags(deps, deps.db, cl.id);
    return c.json(revenueDto(row!), 201);
  });

  async function accRevenue(c: C) {
    const acc = await me(c);
    const [row] = await deps.db.select({ r: revenueItems }).from(revenueItems).innerJoin(clients, eq(clients.id, revenueItems.clientId)).where(and(eq(revenueItems.id, param(c, 'id')), eq(clients.accountantId, acc.id))).limit(1);
    if (!row) throw E.notFound();
    return row.r;
  }

  r.patch('/revenue-items/:id', async (c) => {
    const item = await accRevenue(c);
    const b = await readJson(c, revSchema.partial().extend({ restore: z.boolean().optional(), receivedOnEstimated: z.boolean().optional(), excludedReason: z.string().trim().max(200).nullable().optional() }));
    const [u] = await deps.db
      .update(revenueItems)
      .set({
        ...(b.receivedOn ? { receivedOn: b.receivedOn, receivedOnEstimated: false } : {}),
        ...(b.receivedOnEstimated !== undefined ? { receivedOnEstimated: b.receivedOnEstimated } : {}),
        ...(b.deliveryDate ? { deliveryDate: b.deliveryDate } : {}),
        ...(b.amountHuf !== undefined && item.source === 'kezi' ? { amountHuf: b.amountHuf } : {}),
        ...(b.description ? { description: b.description } : {}),
        ...(b.countsForAtalany !== undefined ? { countsForAtalany: b.countsForAtalany } : {}),
        ...(b.countsForAfaLimit !== undefined ? { countsForAfaLimit: b.countsForAfaLimit } : {}),
        ...(b.excludedReason !== undefined ? { excludedReason: b.excludedReason || null, ...(b.excludedReason === null && b.countsForAtalany === undefined ? { countsForAtalany: true, countsForAfaLimit: true } : {}) } : {}),
        ...(b.restore ? { deletedAt: null } : {}),
        updatedAt: deps.now(),
      })
      .where(eq(revenueItems.id, item.id))
      .returning();
    await auditC(c, deps.db, 'revenue.updated', { targetType: 'revenue_item', targetId: item.id, clientId: item.clientId, details: { fields: Object.keys(b) } });
    await recalcYear(deps, deps.db, item.clientId, Number(u!.receivedOn.slice(0, 4)), { by: auth(c).userId });
    await computeFlags(deps, deps.db, item.clientId);
    return c.json(revenueDto(u!));
  });

  r.delete('/revenue-items/:id', async (c) => {
    const item = await accRevenue(c);
    await deps.db.update(revenueItems).set({ deletedAt: deps.now() }).where(eq(revenueItems.id, item.id));
    await auditC(c, deps.db, 'revenue.deleted', { targetType: 'revenue_item', targetId: item.id, clientId: item.clientId });
    await recalcYear(deps, deps.db, item.clientId, Number(item.receivedOn.slice(0, 4)), { by: auth(c).userId });
    return c.body(null, 204);
  });

  // ================= tax =================
  function calcDto(x: typeof taxCalculations.$inferSelect | undefined) {
    if (!x) return null;
    const snap = x.result as CalcResultJson;
    return {
      id: x.id,
      taxPeriodId: x.taxPeriodId,
      version: x.version,
      engineVersion: x.engineVersion,
      rulesVersion: x.rulesVersion,
      asOf: x.asOf,
      result: snap.quarter,
      context: { meters: snap.meters, hipa: snap.hipa, warnings: snap.warnings, disclaimer: snap.disclaimer },
      overrides: x.overrides ?? null,
      letterText: x.letterText,
      approvedAt: x.approvedAt?.toISOString() ?? null,
      approvedBy: x.approvedBy,
      createdAt: x.createdAt.toISOString(),
    };
  }

  r.get('/clients/:id/tax-periods', async (c) => {
    const { acc, cl } = await own(c);
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2020).max(2100).optional() }));
    const year = q.year ?? Number(todayBudapest(deps.now()).slice(0, 4));
    const [tp] = await deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
    if (tp) await ensurePeriods(deps.db, cl.id, year, tp.hipaMethod, tp.status);
    const periods = await deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.year, year))).orderBy(asc(taxPeriods.dueDate));
    // The engine's iparűzési adó estimate (band, base, yearly tax, note) for the HIPA cards.
    const yearComp = tp ? await computeYear(deps.db, cl.id, year, todayBudapest(deps.now())) : null;
    const hipaEstimate = yearComp?.result.hipa ?? null;
    const items = [];
    for (const p of periods) {
      const [latest] = p.latestCalculationId ? await deps.db.select().from(taxCalculations).where(eq(taxCalculations.id, p.latestCalculationId)).limit(1) : [];
      const docIds = [p.returnDocumentId, p.receiptDocumentId].filter((x): x is string => Boolean(x));
      const docs = docIds.length ? await deps.db.select().from(documents).where(inArray(documents.id, docIds)) : [];
      items.push({
        ...(await periodSummary(deps.db, p)),
        year: p.year,
        quarter: p.quarter,
        items: (await activeItems(deps.db, p.id)).map(paymentItemDto),
        letter: await letterFor(deps.db, p, cl.firstName, acc),
        latestCalculation: calcDto(latest),
        approvedCalculationId: p.approvedCalculationId,
        filed: p.filingStatus === 'beadva' ? { filedOn: p.filedOn, form: p.filingForm, documents: await accDocs(cl, acc.firstName, docs) } : null,
        filing: p.filingStatus === 'beadva' ? null : await filingCheck(deps.db, p, todayBudapest(deps.now())),
        ...(p.kind === 'hipa'
          ? {
              hipa: {
                manual: true,
                estimate: hipaEstimate,
                accountNumber: tp?.hipaAccountNumber ?? null,
                hint: 'Az iparűzési adóelőleg az előző évi adóval egyezik meg. Add meg kézzel az összeget és az önkormányzat számlaszámát.',
              },
            }
          : {}),
      });
    }
    return c.json({ year, items, defaultLetterText: await deps.content.get('ui.home.letter_default') });
  });

  r.post('/clients/:id/tax-periods/:periodKey/calculate', async (c) => {
    const { cl } = await own(c);
    const b = await readJson(c, z.object({ asOf: z.string().refine(isIsoDate).optional() }));
    const calc = await calculatePeriod(deps, deps.db, cl.id, c.req.param('periodKey'), b.asOf ?? todayBudapest(deps.now()), auth(c).userId);
    return c.json(calcDto(calc));
  });

  /**
   * SPEC §26.5.2 (order 4): before activation the client cannot see tax amounts or mark them paid, so an approval
   * (which tells him "utald el …-ig") is refused with a reason; a draft calculation stays allowed (review k3c2).
   */
  async function assertActiveForTax(id: string, by: 'calc' | 'period') {
    const rows =
      by === 'calc'
        ? await deps.db.select({ lifecycle: clients.lifecycle }).from(taxCalculations).innerJoin(taxPeriods, eq(taxPeriods.id, taxCalculations.taxPeriodId)).innerJoin(clients, eq(clients.id, taxPeriods.clientId)).where(eq(taxCalculations.id, id)).limit(1)
        : await deps.db.select({ lifecycle: clients.lifecycle }).from(taxPeriods).innerJoin(clients, eq(clients.id, taxPeriods.clientId)).where(eq(taxPeriods.id, id)).limit(1);
    if (rows[0]?.lifecycle === 'bekotes_alatt')
      throw E.conflict('Az ügyfél még bekötés alatt van: a fizetendőt nem látná, és nem tudná befizetettnek jelölni. A bekötés után hagyd jóvá (a számolást már most elkészítheted).');
  }

  async function periodOwned(c: C, id: string) {
    const acc = await me(c);
    const [p] = await deps.db.select({ p: taxPeriods }).from(taxPeriods).innerJoin(clients, eq(clients.id, taxPeriods.clientId)).where(and(eq(taxPeriods.id, id), eq(clients.accountantId, acc.id))).limit(1);
    if (!p) throw E.notFound();
    return { acc, p: p.p };
  }

  r.post('/tax-calculations/:id/approve', async (c) => {
    const acc = await me(c);
    const b = await readJson(
      c,
      z.object({
        overrides: z.object({ tbHuf: z.number().int().min(0).optional(), szochoHuf: z.number().int().min(0).optional(), szjaAdvanceHuf: z.number().int().min(0).optional(), reason: z.string().trim().max(500).default('') }).nullable().optional(),
        letterText: z.string().trim().min(1, { error: 'Írj pár sort az ügyfélnek.' }).max(2000),
      }),
    );
    await assertActiveForTax(param(c, 'id'), 'calc');
    const p = await deps.db.transaction((tx) => approveCalculation(deps, tx, param(c, 'id'), auth(c).userId, acc.id, { overrides: b.overrides ?? null, letterText: b.letterText }));
    await computeFlags(deps, deps.db, p.clientId);
    return c.json(await periodSummary(deps.db, p));
  });

  /** Iparűzési adóelőleg by hand: the amount is last year's tax (not an engine result). */
  r.post('/tax-periods/:id/hipa-approve', async (c) => {
    const { acc, p } = await periodOwned(c, param(c, 'id'));
    const b = await readJson(
      c,
      z.object({
        amountHuf: z.number().int().min(0).max(50_000_000),
        accountNumber: z.string().trim().max(40).nullable().optional(),
      }),
    );
    await assertActiveForTax(p.id, 'period');
    const u = await deps.db.transaction((tx) => approveHipaManual(deps, tx, p.id, auth(c).userId, acc.id, b));
    await computeFlags(deps, deps.db, u.clientId);
    return c.json(await periodSummary(deps.db, u));
  });

  r.post('/tax-periods/:id/reopen', async (c) => {
    const { acc, p } = await periodOwned(c, param(c, 'id'));
    const b = await readJson(c, z.object({ reason: z.string().trim().min(1, { error: 'Írd le, miért nyitod újra.' }).max(500) }));
    await deps.db.transaction((tx) => reopenPeriod(deps, tx, p.id, auth(c).userId, acc.id, b.reason));
    return c.json({ ok: true });
  });

  /** Fix the letter of an approved quarter without touching the amounts (neutral notification). */
  r.post('/tax-periods/:id/letter', async (c) => {
    const { acc, p } = await periodOwned(c, param(c, 'id'));
    const b = await readJson(c, z.object({ letterText: z.string().trim().min(1, { error: 'Írj pár sort az ügyfélnek.' }).max(2000) }));
    await deps.db.transaction((tx) => updateLetter(deps, tx, p.id, auth(c).userId, acc.id, b.letterText));
    const [u] = await deps.db.select().from(taxPeriods).where(eq(taxPeriods.id, p.id)).limit(1);
    return c.json(await periodSummary(deps.db, u!));
  });

  r.post('/tax-periods/:id/verify-payment', async (c) => {
    const { acc, p } = await periodOwned(c, param(c, 'id'));
    const b = await readJson(c, z.object({ items: z.array(z.object({ kind: z.enum(PAYMENT_ITEM_KINDS), verification: z.enum(['rendben', 'elteres']), note: z.string().trim().max(500).optional() })).min(1).max(5) }));
    const u = await deps.db.transaction((tx) => verifyPayment(deps, tx, p.id, auth(c).userId, acc.id, b.items));
    if (u.paymentStatus === 'elteres') {
      const [cl] = await deps.db.select().from(clients).where(eq(clients.id, u.clientId)).limit(1);
      const note = b.items.find((i) => i.verification === 'elteres')?.note ?? '';
      if (cl) await deps.db.insert(requests).values({ clientId: cl.id, direction: 'konyvelotol', type: 'egyeb', title: 'Eltérés a befizetésnél', body: note || 'Nézzük meg együtt a befizetést. Küldd el az utalás igazolását.', createdBy: auth(c).userId });
    }
    await computeFlags(deps, deps.db, u.clientId);
    return c.json(await periodSummary(deps.db, u));
  });

  r.post('/tax-periods/:id/filed', async (c) => {
    const { acc, p } = await periodOwned(c, param(c, 'id'));
    const b = await readJson(
      c,
      z.object({
        filedOn: z.string().refine(isIsoDate),
        form: z.string().trim().max(10).default('2658'),
        returnDocumentId: z.string().uuid().optional(),
        receiptDocumentId: z.string().uuid().optional(),
        returnFileId: z.string().uuid().optional(),
        receiptFileId: z.string().uuid().optional(),
      }),
    );
    // The period rules first (ended, approved, not yet filed): the accountant gets the real reason, not a file error.
    const check = await filingCheck(deps.db, p, todayBudapest(deps.now()));
    if (!check.canFile) throw E.conflict(check.reason!);
    async function docFor(docId?: string, fileId?: string): Promise<string | null> {
      if (docId) {
        const [d] = await deps.db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, docId), eq(documents.clientId, p.clientId))).limit(1);
        if (d) return d.id;
      }
      if (fileId) {
        const [v] = await deps.db.select({ id: documents.id }).from(documentVersions).innerJoin(documents, eq(documents.id, documentVersions.documentId)).where(and(eq(documentVersions.fileId, fileId), eq(documents.clientId, p.clientId))).limit(1);
        if (v) return v.id;
      }
      return null;
    }
    const ret = await docFor(b.returnDocumentId, b.returnFileId);
    if (!ret) throw E.validation({ returnDocumentId: 'Töltsd fel a bevallás PDF-jét.' });
    const rec = await docFor(b.receiptDocumentId, b.receiptFileId);
    const u = await deps.db.transaction((tx) => markFiled(deps, tx, p.id, auth(c).userId, acc.id, { filedOn: b.filedOn, form: b.form, returnDocumentId: ret, receiptDocumentId: rec }));
    return c.json(await periodSummary(deps.db, u));
  });

  // ================= requests, messages, templates, notes =================
  r.get('/requests', async (c) => {
    const acc = await me(c);
    const q = parseQuery(c, z.object({ status: z.string().max(60).optional(), clientId: z.string().uuid().optional(), type: z.string().max(40).optional() }));
    const statuses = q.status === 'nyitott_mind' ? ['nyitott', 'folyamatban'] : q.status ? q.status.split(',').filter((s) => ['nyitott', 'folyamatban', 'teljesitve', 'elutasitva', 'visszavonva'].includes(s)) : [];
    const rows = await deps.db
      .select({ r: requests, c: clients })
      .from(requests)
      .innerJoin(clients, eq(clients.id, requests.clientId))
      .where(
        and(
          eq(clients.accountantId, acc.id),
          statuses.length ? inArray(requests.status, statuses as never[]) : sql`true`,
          q.clientId ? eq(requests.clientId, q.clientId) : sql`true`,
          q.type ? eq(requests.type, q.type) : sql`true`,
        ),
      )
      .orderBy(desc(requests.createdAt))
      .limit(300);
    return c.json({ items: await Promise.all(rows.map(async (x) => ({ ...(await requestSummary(deps.db, x.r, acc.firstName, 'accountant')), client: { id: x.c.id, name: clientName(x.c) }, updatedAt: x.r.updatedAt.toISOString() }))) });
  });

  r.get('/clients/:id/requests', async (c) => {
    const { acc, cl } = await own(c);
    const rows = await deps.db.select().from(requests).where(eq(requests.clientId, cl.id)).orderBy(desc(requests.createdAt));
    return c.json({ items: await Promise.all(rows.map((x) => requestSummary(deps.db, x, acc.firstName, 'accountant'))) });
  });

  r.post('/clients/:id/requests', async (c) => {
    const { acc, cl } = await own(c);
    const b = await readJson(c, z.object({ type: z.enum(['dokumentum', 'adat', 'egyeb']), title: z.string().trim().min(1).max(120), body: z.string().trim().max(4000).default(''), dueDate: z.string().refine(isIsoDate).optional(), dossierMonth: z.string().refine(isMonthKey).optional() }));
    if (b.dueDate && b.dueDate < todayBudapest(deps.now())) throw E.validation({ dueDate: 'A határidő nem lehet a múltban.' });
    const row = await deps.db.transaction(async (tx) => {
      const [rq] = await tx.insert(requests).values({ clientId: cl.id, direction: 'konyvelotol', type: b.type, title: b.title, body: b.body, dueDate: b.dueDate ?? null, dossierMonth: b.dossierMonth ?? null, createdBy: auth(c).userId }).returning();
      await tx.insert(messages).values({ clientId: cl.id, senderUserId: auth(c).userId, senderRole: 'accountant', kind: 'keres_kartya', body: b.title, requestId: rq!.id, readByAccountantAt: deps.now() });
      await auditC(c, tx, 'request.created', { targetType: 'request', targetId: rq!.id, clientId: cl.id, details: { type: b.type } });
      return rq!;
    });
    await notify(deps, deps.db, { userId: cl.userId, kind: 'request_new', params: { ...(await accountantParams(deps.db, acc.id)), title: b.title, body: b.body.slice(0, 200) }, link: '/keresek', data: { requestId: row.id } });
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await requestSummary(deps.db, row, acc.firstName, 'accountant'), 201);
  });

  r.patch('/requests/:id', async (c) => {
    const acc = await me(c);
    const b = await readJson(
      c,
      z.object({
        status: z.enum(['nyitott', 'folyamatban', 'teljesitve', 'elutasitva', 'visszavonva']),
        statusNote: z.string().trim().max(1000).optional(),
        resultDocumentId: z.string().uuid().optional(),
        submittedToNavAt: z.string().refine(isIsoDate, { error: 'Dátum kell (ÉÉÉÉ-HH-NN).' }).optional(),
      }),
    );
    const [row] = await deps.db.select({ r: requests, c: clients }).from(requests).innerJoin(clients, eq(clients.id, requests.clientId)).where(and(eq(requests.id, param(c, 'id')), eq(clients.accountantId, acc.id))).limit(1);
    if (!row) throw E.notFound();
    if (b.status === 'elutasitva' && !b.statusNote) throw E.validation({ statusNote: 'Írd le az okát.' });
    if (b.submittedToNavAt && (b.submittedToNavAt > todayBudapest(deps.now()) || b.submittedToNavAt < '2020-01-01')) throw E.validation({ submittedToNavAt: 'Ez a dátum nem lehet a jövőben.' });
    // SPEC §6.4: the creator may withdraw his own request while nobody has started on it.
    if (b.status === 'visszavonva') {
      if (row.r.direction !== 'konyvelotol') throw E.validation({ status: 'Az ügyfél kérését nem vonhatod vissza; elutasítani tudod.' });
      if (row.r.status !== 'nyitott') throw E.conflict('Ezt a kérést már elkezdte vagy lezárta az ügyfél, ezért nem vonhatod vissza.');
      const now = deps.now();
      const [w] = await deps.db.update(requests).set({ status: 'visszavonva', statusNote: b.statusNote ?? null, completedAt: now, completedBy: auth(c).userId, updatedAt: now }).where(and(eq(requests.id, row.r.id), eq(requests.status, 'nyitott'))).returning();
      if (!w) throw E.conflict('Ezt a kérést közben már elkezdte az ügyfél.');
      await auditC(c, deps.db, 'request.cancelled', { targetType: 'request', targetId: row.r.id, clientId: row.c.id, details: { by: 'accountant' } });
      await notify(deps, deps.db, { userId: row.c.userId, kind: 'request_done', variant: 'withdrawn', params: { ...(await accountantParams(deps.db, acc.id)), title: row.r.title }, link: '/keresek', data: { requestId: row.r.id } });
      await computeFlags(deps, deps.db, row.c.id);
      return c.json(await requestSummary(deps.db, w, acc.firstName, 'accountant'));
    }
    if (b.resultDocumentId) {
      const [d] = await deps.db.select({ id: documents.id }).from(documents).where(and(eq(documents.id, b.resultDocumentId), eq(documents.clientId, row.c.id))).limit(1);
      if (!d) throw E.validation({ resultDocumentId: 'Nincs ilyen irat.' });
    }
    const done = b.status === 'teljesitve' || b.status === 'elutasitva';
    // A closed request (done, refused, withdrawn by either side) is final. The conditional update also
    // catches a change made meanwhile from another screen: 409 instead of "last write wins".
    if (!['nyitott', 'folyamatban'].includes(row.r.status)) throw E.conflict('Ez a kérés közben lezárult vagy visszavonták. Frissítsd az oldalt.');
    const [u] = await deps.db
      .update(requests)
      .set({ status: b.status, statusNote: b.statusNote ?? row.r.statusNote, resultDocumentId: b.resultDocumentId ?? row.r.resultDocumentId, ...(done ? { completedAt: deps.now(), completedBy: auth(c).userId } : {}), updatedAt: deps.now() })
      .where(and(eq(requests.id, row.r.id), inArray(requests.status, ['nyitott', 'folyamatban'])))
      .returning();
    if (!u) throw E.conflict('Ez a kérés közben megváltozott. Frissítsd az oldalt.');
    if (done && b.statusNote)
      await postRequestNote(deps.db, { clientId: row.c.id, requestId: row.r.id, senderUserId: auth(c).userId, senderRole: 'accountant', title: row.r.title, note: b.statusNote, rejected: b.status === 'elutasitva', now: deps.now() });
    if (b.submittedToNavAt) await deps.db.update(certificateRequests).set({ submittedToNavAt: budapestLocalToUtc(b.submittedToNavAt, '12:00'), ...(b.resultDocumentId ? { documentId: b.resultDocumentId } : {}) }).where(eq(certificateRequests.requestId, row.r.id));
    else if (b.resultDocumentId) await deps.db.update(certificateRequests).set({ documentId: b.resultDocumentId }).where(eq(certificateRequests.requestId, row.r.id));
    await auditC(c, deps.db, 'request.status_changed', { targetType: 'request', targetId: row.r.id, clientId: row.c.id, details: { to: b.status } });
    if (row.r.direction === 'ugyfeltol' && done)
      await notify(deps, deps.db, {
        userId: row.c.userId,
        kind: 'request_done',
        // A refusal is never announced as "Elkészült".
        ...(b.status === 'elutasitva' ? { variant: 'rejected' } : b.statusNote ? { variant: 'with_note' } : {}),
        params: { ...(await accountantParams(deps.db, acc.id)), title: row.r.title, note: b.statusNote ?? '' },
        link: '/keresek',
        data: { requestId: row.r.id },
      });
    await computeFlags(deps, deps.db, row.c.id);
    return c.json(await requestSummary(deps.db, u!, acc.firstName, 'accountant'));
  });

  r.get('/clients/:id/messages', async (c) => {
    const { acc, cl } = await own(c);
    const q = parseQuery(c, z.object({ cursor: z.string().max(100).optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }));
    const page = await messagePage(deps.db, cl.id, q.cursor, q.limit);
    await deps.db.update(messages).set({ readByAccountantAt: deps.now() }).where(and(eq(messages.clientId, cl.id), isNull(messages.readByAccountantAt)));
    return c.json({ items: await messageDtos(deps.db, page.rows, 'accountant', acc.firstName), nextCursor: page.nextCursor });
  });

  // Attachment upload before the message exists. With a clientId it is owned by that client right
  // away; without one (the panel's form) it stays unowned until it is attached to a message.
  r.post('/attachments', async (c) => {
    const acc = await me(c);
    const body = await c.req.parseBody({ all: true });
    const clientId = typeof body.clientId === 'string' && z.string().uuid().safeParse(body.clientId).success ? body.clientId : null;
    const owner = clientId ? (await assignedClient(deps.db, acc.id, clientId)).id : null;
    const f = (await collectFiles(body, 'file'))[0];
    if (!f) throw E.validation({ file: 'Nincs csatolt fájl.' });
    const ok = checkFile(f);
    const row = await deps.storage.put(deps.db, { ownerClientId: owner, kind: 'uzenet_csatolmany', mime: ok.mime, displayName: ok.displayName, data: ok.data, createdBy: auth(c).userId, now: deps.now() });
    return c.json({ fileId: row.id }, 201);
  });

  r.post('/clients/:id/messages', async (c) => {
    const { acc, cl } = await own(c);
    const b = await readJson(c, z.object({ body: z.string().trim().max(4000).default(''), fileIds: z.array(z.string().uuid()).max(10).optional(), documentId: z.string().uuid().optional() }));
    if (!b.body && !b.fileIds?.length) throw E.validation({ body: 'Írj valamit, vagy csatolj fájlt.' });
    const msg = await deps.db.transaction(async (tx) => {
      // The linked document must be this client's, not deleted, and visible to the client (SPEC §22).
      if (b.documentId) {
        const [d] = await tx
          .select({ id: documents.id })
          .from(documents)
          .where(and(eq(documents.id, b.documentId), eq(documents.clientId, cl.id), isNull(documents.deletedAt), eq(documents.visibility, 'kozos')))
          .limit(1);
        if (!d) throw E.validation({ documentId: 'Nincs ilyen irat.' });
      }
      const [m] = await tx.insert(messages).values({ clientId: cl.id, senderUserId: auth(c).userId, senderRole: 'accountant', kind: 'szoveg', body: b.body, documentId: b.documentId ?? null, readByAccountantAt: deps.now() }).returning();
      for (const fid of b.fileIds ?? []) {
        const [f] = await tx
          .select()
          .from(files)
          .where(and(eq(files.id, fid), eq(files.kind, 'uzenet_csatolmany'), or(eq(files.ownerClientId, cl.id), and(isNull(files.ownerClientId), eq(files.createdBy, auth(c).userId)))))
          .limit(1);
        if (!f) throw E.validation({ fileIds: 'Ismeretlen csatolmány.' });
        if (!f.ownerClientId) await tx.update(files).set({ ownerClientId: cl.id }).where(eq(files.id, f.id));
        await tx.insert(messageAttachments).values({ messageId: m!.id, fileId: f.id, displayName: f.displayName });
      }
      await auditC(c, tx, 'message.sent', { targetType: 'message', targetId: m!.id, clientId: cl.id, details: { attachments: b.fileIds?.length ?? 0 } });
      return m!;
    });
    await notify(deps, deps.db, { userId: cl.userId, kind: 'message_new', params: await accountantParams(deps.db, acc.id), link: '/uzenetek' });
    const [dto] = await messageDtos(deps.db, [msg], 'accountant', acc.firstName);
    return c.json(dto, 201);
  });

  r.get('/message-templates', async (c) => {
    const acc = await me(c);
    const rows = await deps.db.select().from(messageTemplates).where(or(eq(messageTemplates.accountantId, acc.id), isNull(messageTemplates.accountantId))).orderBy(asc(messageTemplates.sort), asc(messageTemplates.title));
    return c.json({ items: rows.map((t) => ({ id: t.id, title: t.title, body: t.body, global: t.accountantId === null })) });
  });
  r.post('/message-templates', async (c) => {
    const acc = await me(c);
    const b = await readJson(c, z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().min(1).max(4000) }));
    const [t] = await deps.db.insert(messageTemplates).values({ accountantId: acc.id, title: b.title, body: b.body }).returning();
    return c.json({ id: t!.id, title: t!.title, body: t!.body, global: false }, 201);
  });
  r.patch('/message-templates/:id', async (c) => {
    const acc = await me(c);
    const b = await readJson(c, z.object({ title: z.string().trim().min(1).max(80).optional(), body: z.string().trim().min(1).max(4000).optional() }));
    const [t] = await deps.db.update(messageTemplates).set({ ...b, updatedAt: deps.now() }).where(and(eq(messageTemplates.id, param(c, 'id')), eq(messageTemplates.accountantId, acc.id))).returning();
    if (!t) throw E.notFound();
    return c.json({ id: t.id, title: t.title, body: t.body, global: false });
  });
  r.delete('/message-templates/:id', async (c) => {
    const acc = await me(c);
    const res = await deps.db.delete(messageTemplates).where(and(eq(messageTemplates.id, param(c, 'id')), eq(messageTemplates.accountantId, acc.id))).returning({ id: messageTemplates.id });
    if (!res.length) throw E.notFound();
    return c.body(null, 204);
  });

  r.get('/clients/:id/notes', async (c) => {
    const { cl } = await own(c);
    const rows = await deps.db.select({ n: internalNotes, name: users.displayName }).from(internalNotes).leftJoin(users, eq(users.id, internalNotes.authorUserId)).where(and(eq(internalNotes.clientId, cl.id), isNull(internalNotes.deletedAt))).orderBy(desc(internalNotes.pinned), desc(internalNotes.createdAt));
    return c.json({ items: rows.map((x) => ({ id: x.n.id, body: x.n.body, pinned: x.n.pinned, author: x.name ?? '', createdAt: x.n.createdAt.toISOString(), updatedAt: x.n.updatedAt.toISOString() })) });
  });
  r.post('/clients/:id/notes', async (c) => {
    const { cl } = await own(c);
    const b = await readJson(c, z.object({ body: z.string().trim().min(1).max(4000), pinned: z.boolean().default(false) }));
    const [n] = await deps.db.insert(internalNotes).values({ clientId: cl.id, authorUserId: auth(c).userId, body: b.body, pinned: b.pinned }).returning();
    await auditC(c, deps.db, 'note.created', { targetType: 'internal_note', targetId: n!.id, clientId: cl.id });
    return c.json({ id: n!.id, body: n!.body, pinned: n!.pinned, author: auth(c).displayName ?? '', createdAt: n!.createdAt.toISOString(), updatedAt: n!.updatedAt.toISOString() }, 201);
  });
  async function noteOwned(c: C) {
    const acc = await me(c);
    const [n] = await deps.db.select({ n: internalNotes }).from(internalNotes).innerJoin(clients, eq(clients.id, internalNotes.clientId)).where(and(eq(internalNotes.id, param(c, 'id')), eq(clients.accountantId, acc.id), isNull(internalNotes.deletedAt))).limit(1);
    if (!n) throw E.notFound();
    return n.n;
  }
  r.patch('/notes/:id', async (c) => {
    const n = await noteOwned(c);
    const b = await readJson(c, z.object({ body: z.string().trim().min(1).max(4000).optional(), pinned: z.boolean().optional() }));
    const [u] = await deps.db.update(internalNotes).set({ ...b, updatedAt: deps.now() }).where(eq(internalNotes.id, n.id)).returning();
    return c.json({ id: u!.id, body: u!.body, pinned: u!.pinned, createdAt: u!.createdAt.toISOString(), updatedAt: u!.updatedAt.toISOString() });
  });
  r.delete('/notes/:id', async (c) => {
    const n = await noteOwned(c);
    await deps.db.update(internalNotes).set({ deletedAt: deps.now() }).where(eq(internalNotes.id, n.id));
    return c.body(null, 204);
  });

  // ================= deadline board =================
  r.get('/deadline-board', async (c) => {
    const acc = await me(c);
    const today = todayBudapest(deps.now());
    const q = parseQuery(c, z.object({ week: z.string().regex(/^\d{4}-W\d{2}$/).optional() }));
    const monday = (q.week && mondayOfIsoWeek(q.week)) || isoWeekOf(today).monday;
    const week = isoWeekOf(monday).key;
    const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
    const cls = await deps.db.select().from(clients).where(and(eq(clients.accountantId, acc.id), sql`${clients.lifecycle} <> 'megszunt'`)).orderBy(asc(clients.lastName));
    const rows = [];
    const overdue = [];
    for (const cl of cls) {
      const all = await clientDeadlines(deps, deps.db, cl.id, addDays(today, -90), addDays(monday, 6), { perspective: 'accountant' });
      const inWeek = all.filter((d) => d.dueDate >= monday && d.dueDate <= days[6]!);
      const items = inWeek.map((d) => ({ id: d.id, kind: d.kind, title: d.title, dueDate: d.dueDate, status: d.status, overdue: d.status === 'lejart', ...(d.amountHuf !== undefined ? { amountHuf: d.amountHuf } : {}) }));
      if (items.length) rows.push({ client: { id: cl.id, name: clientName(cl) }, items });
      for (const d of all.filter((x) => x.status === 'lejart'))
        overdue.push({ id: d.id, kind: d.kind, title: d.title, dueDate: d.dueDate, status: d.status, overdue: true, ...(d.amountHuf !== undefined ? { amountHuf: d.amountHuf } : {}), client: { id: cl.id, name: clientName(cl) }, daysOverdue: daysBetween(d.dueDate, today) });
    }
    return c.json({ week, prevWeek: isoWeekOf(addDays(monday, -7)).key, nextWeek: isoWeekOf(addDays(monday, 7)).key, days, rows, overdue: overdue.sort((a, b) => b.daysOverdue - a.daysOverdue) });
  });

  // ================= appointments, settings =================
  r.get('/appointments', async (c) => {
    const acc = await me(c);
    const slots = await deps.db.select().from(availabilitySlots).where(and(eq(availabilitySlots.accountantId, acc.id), sql`${availabilitySlots.status} <> 'torolve'`, gte(availabilitySlots.endsAt, new Date(deps.now().getTime() - 7 * 86_400_000)))).orderBy(asc(availabilitySlots.startsAt));
    const apts = await deps.db.select({ a: appointments, c: clients }).from(appointments).innerJoin(clients, eq(clients.id, appointments.clientId)).where(eq(appointments.accountantId, acc.id)).orderBy(desc(appointments.startsAt)).limit(200);
    return c.json({
      enabled: false,
      slots: slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), channels: s.channels, status: s.status })),
      appointments: apts.map(({ a, c: cl }) => ({
        id: a.id,
        startsAt: a.startsAt.toISOString(),
        endsAt: a.endsAt.toISOString(),
        channel: a.channel,
        status: a.status,
        ...(a.videoLink ? { videoLink: a.videoLink } : {}),
        ...(a.topic ? { topic: a.topic } : {}),
        client: { id: cl.id, name: clientName(cl) },
        ...(a.phoneEnc ? { phone: deps.data.dec(a.phoneEnc, 'appointments.phone') } : {}),
      })),
    });
  });

  // SPEC §26.2.9: booking is retired. Old rows stay readable above; every write answers 410 megszunt_funkcio.
  r.post('/availability', () => {
    throw E.retired('Időpontokat már nem lehet meghirdetni. Az ügyfelek visszahívást kérnek.');
  });
  r.delete('/availability/:id', () => {
    throw E.retired('Időpontokat már nem lehet meghirdetni. Az ügyfelek visszahívást kérnek.');
  });
  r.patch('/appointments/:id', () => {
    throw E.retired('Időpontokat már nem lehet kezelni. Az ügyfelek visszahívást kérnek.');
  });

  // ---- SPEC §26: the client's callbacks (read-only unless assigned) and new-business registration (read-only) ----
  r.get('/clients/:id/callbacks', async (c) => {
    const { cl } = await own(c);
    const rows = await deps.db.select().from(callbackRequests).where(eq(callbackRequests.clientId, cl.id)).orderBy(desc(callbackRequests.createdAt)).limit(100);
    return c.json({ items: await teamRows(deps, deps.db, rows) });
  });

  r.get('/clients/:id/business-registration', async (c) => {
    const { cl } = await own(c);
    const row = await currentRegistrationOf(deps.db, cl.id);
    return c.json({ registration: row ? await teamViews(deps).regDetail(row) : null });
  });

  r.get('/settings', async (c) => {
    const acc = await me(c);
    return c.json({
      displayName: acc.displayName,
      firstName: acc.firstName,
      title: acc.title,
      registrationNumber: acc.registrationNumber,
      responseTimeText: acc.responseTimeText,
      appointmentsEnabled: false,
      monthlyStatementRequest: acc.monthlyStatementRequest,
      signatureSvgPath: acc.signatureSvgPath,
      avatarKey: acc.avatarKey,
      nameForms: accountantPublic(acc).nameForms,
    });
  });

  r.patch('/settings', async (c) => {
    const acc = await me(c);
    const raw = await readJson(c, z.object({ responseTimeText: z.string().trim().min(1).max(120).optional(), appointmentsEnabled: z.boolean().optional(), monthlyStatementRequest: z.boolean().optional() }));
    // appointmentsEnabled is accepted for old panels but ignored (SPEC §26.2.9).
    const { appointmentsEnabled: _ignored, ...b } = raw;
    // SPEC §28.K.15: no answer-time promise
    if (b.responseTimeText && hasResponseTimePromise(b.responseTimeText)) throw E.validation({ responseTimeText: RESPONSE_TIME_SETTINGS_ERROR });
    await deps.db.update(accountants).set({ ...b, updatedAt: deps.now() }).where(eq(accountants.id, acc.id));
    await auditC(c, deps.db, 'accountant.settings_updated', { targetType: 'accountant', targetId: acc.id, details: { fields: Object.keys(b) } });
    const [u] = await deps.db.select().from(accountants).where(eq(accountants.id, acc.id)).limit(1);
    return c.json({ displayName: u!.displayName, firstName: u!.firstName, title: u!.title, registrationNumber: u!.registrationNumber, responseTimeText: u!.responseTimeText, appointmentsEnabled: false, monthlyStatementRequest: u!.monthlyStatementRequest, signatureSvgPath: u!.signatureSvgPath, avatarKey: u!.avatarKey });
  });

  // ================= export, audit =================
  r.get('/export/revenue.csv', async (c) => {
    const acc = await me(c);
    const q = parseQuery(
      c,
      z.object({
        year: z.coerce.number().int().min(2020).max(2100),
        clientIds: z.string().max(4000).optional(),
        // Cash basis: only money that has arrived by the cut-off (default today) is revenue.
        upTo: z.string().refine(isIsoDate).optional(),
        includeExpected: z.enum(['0', '1', 'true', 'false']).optional(),
      }),
    );
    const ids = q.clientIds ? q.clientIds.split(',').filter((x) => /^[0-9a-f-]{36}$/.test(x)) : null;
    const cls = await deps.db.select().from(clients).where(and(eq(clients.accountantId, acc.id), ids ? inArray(clients.id, ids) : sql`true`));
    const esc = csvCell;
    const cutoff = q.upTo ?? todayBudapest(deps.now());
    const withExpected = q.includeExpected === '1' || q.includeExpected === 'true';
    const lines = ['ügyfél;adószám;sorszám;bevétel dátuma;teljesítés;számlaszám/bizonylat;vevő;összeg (Ft);forrás;becsült dátum;állapot'];
    for (const cl of cls) {
      const rows = await deps.db
        .select({ r: revenueItems, i: navInvoices })
        .from(revenueItems)
        .leftJoin(navInvoices, eq(navInvoices.id, revenueItems.navInvoiceId))
        .where(
          and(
            eq(revenueItems.clientId, cl.id),
            isNull(revenueItems.deletedAt),
            eq(revenueItems.countsForAtalany, true),
            sql`${revenueItems.receivedOn} between ${`${q.year}-01-01`} and ${`${q.year}-12-31`}`,
            withExpected ? sql`true` : sql`${revenueItems.receivedOn} <= ${cutoff}`,
          ),
        )
        .orderBy(asc(revenueItems.receivedOn));
      rows.forEach(({ r: rv, i }, n) => {
        const expected = rv.receivedOn > cutoff;
        lines.push(
          [clientName(cl), cl.adoszam, n + 1, rv.receivedOn, rv.deliveryDate, i?.invoiceNumber ?? rv.description, i?.customerName ?? '', rv.amountHuf, rv.source === 'nav_szamla' ? 'NAV' : 'kézi', rv.receivedOnEstimated ? 'igen' : 'nem', expected ? 'várható (még nem jött meg)' : 'megjött']
            .map(esc)
            .join(';'),
        );
      });
    }
    await auditC(c, deps.db, 'export.revenue_csv', { targetType: 'accountant', targetId: acc.id, details: { year: q.year, clients: cls.length, cutoff, withExpected } });
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="bevetelek_${q.year}.csv"`);
    return c.body(`﻿${lines.join('\r\n')}\r\n`);
  });

  r.get('/audit', async (c) => {
    const acc = await me(c);
    const q = parseQuery(c, z.object({ clientId: z.string().uuid().optional(), cursor: z.string().regex(/^\d+$/).optional(), limit: z.coerce.number().int().min(1).max(200).default(50) }));
    const own = deps.db.select({ id: clients.id }).from(clients).where(eq(clients.accountantId, acc.id));
    const rows = await deps.db
      .select({ a: auditLog, actorName: users.displayName, cFirst: clients.firstName, cLast: clients.lastName })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .leftJoin(clients, eq(clients.id, auditLog.clientId))
      .where(and(inArray(auditLog.clientId, own), q.clientId ? eq(auditLog.clientId, q.clientId) : sql`true`, q.cursor ? lt(auditLog.id, Number(q.cursor)) : sql`true`))
      .orderBy(desc(auditLog.id))
      .limit(q.limit + 1);
    const page = rows.slice(0, q.limit);
    return c.json({
      items: page.map((x) => ({
        id: x.a.id,
        at: x.a.at.toISOString(),
        actor: { id: x.a.actorUserId, name: x.a.actorRole === 'system' ? 'Rendszer' : (x.actorName ?? ''), role: x.a.actorRole },
        action: x.a.action,
        targetType: x.a.targetType,
        targetId: x.a.targetId,
        client: x.a.clientId ? { id: x.a.clientId, name: `${x.cLast ?? ''} ${x.cFirst ?? ''}`.trim() } : null,
        details: x.a.details,
      })),
      nextCursor: rows.length > q.limit ? String(page[page.length - 1]!.a.id) : null,
    });
  });

  return r;
}
