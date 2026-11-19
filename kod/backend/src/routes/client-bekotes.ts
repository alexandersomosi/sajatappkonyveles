// /client additions of SPEC §26 (owner orders 11-18) and §27 (11-19), registered on the client router (same auth,
// e-mail check and restricted-mode middleware): the changeable branch question, the new-business registration
// (self-service and "Intézzük helyetted"), the guides, the explainers, the access matrix, the callback request, the
// assisted requests and the kamarai regisztráció tick.
import { and, eq, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { ClientAccess, Explainer } from '../_shared/api.js';
import { activityPending, ONBOARDING_EXPLAINERS } from '../_shared/bekotes.js';
import {
  ASSIST_KINDS,
  BUSINESS_STATUSES,
  CALLBACK_ASSIST_TOPIC,
  CALLBACK_RULES,
  CALLBACK_SOURCES,
  CALLBACK_TOPICS,
  CALLBACK_WINDOWS,
  CLIENT_FILING_CHANNELS,
  GUIDE_KINDS,
  GUIDE_STEP_KEYS,
  REGISTRATION_WITHDRAW_REASONS,
  type FilingChannel,
  type GuideKind,
} from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { accountants, businessRegistrations, callbackRequests, clients, documents, onboardingSteps } from '../db/schema.js';
import { audit, auditC } from '../audit.js';
import { collectFiles, MAX_REQUEST_BYTES } from '../files/upload.js';
import { assertUploadQuota } from '../files/quota.js';
import { auth, param, readJson, type C, type Env } from '../http/core.js';
import { addDays, huDayMonthIg, isIsoDate, todayBudapest } from '../lib/dates.js';
import { addWorkingDays } from '../lib/munkanap.js';
import { ApiError, E } from '../lib/errors.js';
import { notify } from '../notify/notify.js';
import { clientAccess } from '../services/access.js';
import {
  approvalInfo,
  assistErr,
  assistsOfClient,
  assistView,
  cancelByClient as cancelAssistByClient,
  clientApproved,
  clientUnapproved,
  consentSummary,
  giveConsent,
  onRegistrationDone,
  openAssistOf,
  requestAssist,
  revalidateConsent,
} from '../services/assist.js';
import { cancelByClient, callbackView, clientCallbacks, createCallback, noteLooksSecret, updateByClient } from '../services/callbacks.js';
import { addVersion, createDocument } from '../services/documents.js';
import { buildGuide } from '../services/guides.js';
import { accountantTaxIdForClient, afterProfileSubmitted, assertStepOpen, checkCompletion, journeyOf, notifyAccountantReview, onboardingState, pathOf, setStep, steps, stepStatus } from '../services/onboarding.js';
import { applyPathChange, blockedError, leaveInditas, notifyPathChanged, pathBlocker } from '../services/pathchange.js';
import { accountantPublic, clientName, clientOfUser, type ClientRow } from '../services/people.js';
import {
  answersOf,
  applyInput,
  checkRegistrationAdoszam,
  computeHints,
  currentRegistrationOf,
  fillProfileFromRegistration,
  missingFields,
  openRegistrationOf,
  registrationInputSchema,
  registrationView,
  transition,
  type RegRow,
  ACTIVITY_HOLD_STATUSES,
  registrationYears,
} from '../services/registration.js';
import { recalcYear } from '../services/tax.js';
import { notifyQueueOwners } from '../services/team.js';

/** EV nyilvántartási szám: exactly 8 digits (the app allows only digits; the API checks it too – review k3c2). */
const EV_SZAM = /^\d{8}$/;
const EV_SZAM_MSG = 'A nyilvántartási szám 8 számjegy.';

export function registerBekotesRoutes(r: Hono<Env>, deps: Deps): void {
  const client = (c: C) => clientOfUser(deps.db, auth(c).userId);
  async function acc(cl: ClientRow) {
    const [a] = cl.accountantId ? await deps.db.select().from(accountants).where(eq(accountants.id, cl.accountantId)).limit(1) : [];
    return a ?? null;
  }
  const firstName = async (cl: ClientRow) => accountantPublic(await acc(cl)).firstName;
  const adatokDone = async (cl: ClientRow) => (await stepStatus(deps.db, cl.id, 'adatok')) === 'kesz';
  async function view(cl: ClientRow, row: RegRow) {
    return registrationView(deps, deps.db, row, { accFirstName: await firstName(cl), adatokDone: await adatokDone(cl) });
  }
  const by = (c: C) => ({ userId: auth(c).userId, role: 'client' as const });

  // ================= access, explainers (SPEC §26.5, §26.8; numbers from the journey §27.4.2) =================
  async function accessOf(cl: ClientRow): Promise<ClientAccess> {
    const j = await journeyOf(deps, deps.db, cl);
    const a = await clientAccess(deps, deps.db, cl, j.remaining, j.todoCount);
    return a.mode === 'korlatozott' ? { ...a, activationHint: j.lockedSheetText } : a;
  }
  r.get('/access', async (c) => c.json(await accessOf(await client(c))));

  r.get('/explainers', async (c) => {
    const cl = await client(c);
    const params = { firstName: await firstName(cl), havidij: `${new Intl.NumberFormat('hu-HU').format(deps.cfg.planPriceHuf).replace(/ /g, ' ')} Ft` };
    const items: Explainer[] = [];
    for (const e of ONBOARDING_EXPLAINERS) {
      const k = `bekotes.magyarazat.${e.key}`;
      items.push({
        key: e.key,
        title: await deps.content.render(`${k}.cim`, params),
        what: await deps.content.render(`${k}.mi`, params),
        why: await deps.content.render(`${k}.miert`, params),
        where: await deps.content.render(`${k}.hol`, params),
        icon: e.icon,
        ...(e.illustration ? { illustration: e.illustration } : {}),
        ...(e.step ? { step: e.step } : {}),
        fields: e.fields,
      });
    }
    c.header('Cache-Control', 'private, max-age=300');
    return c.json({ items });
  });

  // ================= branch question – changeable (SPEC §27.2) =================
  r.put('/onboarding/business-status', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ businessStatus: z.enum(BUSINESS_STATUSES), mode: z.literal('onallo').optional(), undo: z.literal(true).optional() }));
    if (cl.lifecycle !== 'bekotes_alatt') throw await blockedError(deps, 'nem_bekotes_alatt');
    const from = cl.businessStatus ?? null;
    if (from !== b.businessStatus) {
      if (from !== null) {
        const blocker = await pathBlocker(deps.db, cl, b.businessStatus);
        if (blocker) throw await blockedError(deps, blocker);
      }
      const res = await deps.db.transaction((tx) => applyPathChange(deps, tx, cl, b.businessStatus, by(c), { undo: b.undo === true }));
      await notifyPathChanged(deps, deps.db, cl, res, null);
    }
    return c.json(await onboardingState(deps, deps.db, cl.id));
  });

  // ================= new-business registration (SPEC §26.1.3–§26.1.5, §27) =================
  r.get('/business-registration', async (c) => {
    const cl = await client(c);
    const row = await currentRegistrationOf(deps.db, cl.id);
    return c.json({ registration: row ? await view(cl, row) : null });
  });

  r.put('/business-registration', async (c) => {
    const cl = await client(c);
    if (pathOf(cl) !== 'inditas') throw E.stepLocked('Ezt akkor töltsd ki, ha most indítod a vállalkozásodat. Előbb válaszd: „Még nincs, most indítanám”.');
    const b = await readJson(c, registrationInputSchema);
    let row = await openRegistrationOf(deps.db, cl.id);
    if (!row) {
      const [created] = await deps.db.insert(businessRegistrations).values({ clientId: cl.id, status: 'kitoltes', answers: {}, statusChangedAt: deps.now(), createdAt: deps.now(), updatedAt: deps.now() }).returning();
      row = created!;
      await setStep(deps, deps.db, cl.id, 'vallalkozas_inditas', 'ugyfelre_var');
    }
    if (!(row.status === 'kitoltes' || row.status === 'utmutato' || row.status === 'javitas'))
      throw E.conflict('A bejelentésed már elment a NAV-hoz, ezért itt nem módosíthatod. Ha valami változott, írj nekünk.');
    const ev = await openAssistOf(deps.db, cl.id, 'vallalkozas_bejelentes');
    if (ev?.status === 'bejelentes_bekuldve') throw E.conflict('A bejelentésedet már beküldtük, ezért itt nem módosíthatod. Ha valami változott, írj nekünk.');
    const answers = applyInput(answersOf(row), b, { now: deps.now(), profileCity: cl.addressCity });
    const u = await deps.db.transaction(async (tx) => {
      const [u0] = await tx.update(businessRegistrations).set({ answers, updatedAt: deps.now() }).where(eq(businessRegistrations.id, row.id)).returning();
      await auditC(c, tx, 'registration.saved', { targetType: 'business_registration', targetId: row.id, clientId: cl.id, details: { fields: Object.keys(b), status: row.status } });
      // SPEC §27.3.3: any change after the final OK needs a new one.
      await revalidateConsent(deps, tx, cl.id, by(c));
      return u0!;
    });
    return c.json(await view(cl, u));
  });

  r.post('/business-registration/submit', async (c) => {
    const cl = await client(c);
    const row = await openRegistrationOf(deps.db, cl.id);
    if (!row || pathOf(cl) !== 'inditas') throw E.stepLocked('Előbb töltsd ki a kérdőívet.');
    if (row.status !== 'kitoltes') return c.json(await view(cl, row));
    const a = answersOf(row);
    const hints = await computeHints(deps, a, await firstName(cl));
    if (hints.stop) throw E.conflict(hints.stop.text);
    const missing = missingFields(a, { adatokDone: await adatokDone(cl) });
    if (missing.length) throw E.validation(Object.fromEntries(missing.map((m) => [m, m === 'adatok' ? 'Előbb add meg az adataidat (Rólad).' : 'Kötelező.'])), 'Még hiányzik néhány válasz. Nézd át a pirossal jelölt részeket.');
    const u = await deps.db.transaction((tx) =>
      transition(deps, tx, row, 'utmutato', { submittedAt: deps.now() }, { action: 'registration.submitted', actorUserId: auth(c).userId, actorRole: 'client', details: { mode: row.mode } }),
    );
    // The kérdőív promises "megírjuk, melyik sort válaszd": the team gets a task right away (SPEC §24 11-18 javító).
    if (activityPending(a)) {
      await notifyQueueOwners(deps, deps.db, {
        kind: 'registration_submitted',
        variant: 'tevekenyseg',
        params: { clientName: clientName(cl) },
        link: `/vallalkozas-inditas/${row.id}`,
        data: { clientId: cl.id, registrationId: row.id, activityPending: true },
      });
    }
    return c.json(await view(cl, u));
  });

  r.post('/business-registration/filed', async (c) => {
    const cl = await client(c);
    const len = Number(c.req.header('content-length') ?? '0');
    if (len > MAX_REQUEST_BYTES) throw E.tooLarge('Egyszerre legfeljebb 60 MB-ot küldhetsz.');
    const h = deps.limiter.hit(`upload:${auth(c).userId}`, 600, 3600_000);
    if (!h.ok) throw E.rateLimited(h.retryAfterSec);
    await assertUploadQuota(deps, deps.db, cl, len);
    const row = await openRegistrationOf(deps.db, cl.id);
    if (!row || (row.status !== 'utmutato' && row.status !== 'javitas')) throw E.conflict('Most nem tölthetsz fel értesítést. Előbb küldd el a kérdőívet, és kövesd az útmutatót.');
    // SPEC §27.9.1: while our accountant files it ("Intézzük helyetted"), the client does not upload his own.
    const ev = await openAssistOf(deps.db, cl.id, 'vallalkozas_bejelentes');
    if (ev && row.status !== 'javitas') throw assistErr.wrongStatus(await deps.content.render('helyettunk.hiba.bejelentes_ugyfel', { firstName: await firstName(cl) }));
    const body = await c.req.parseBody({ all: true });
    const today = todayBudapest(deps.now());
    const meta = z
      .strictObject({
        filedOn: z.string().refine((v) => isIsoDate(v) && v <= today && v >= addDays(today, -60), { error: 'Az elmúlt 60 nap egyik napja lehet.' }),
        channel: z.enum(CLIENT_FILING_CHANNELS as unknown as [FilingChannel, ...FilingChannel[]]),
        adoszam: z.string().trim().max(20).optional(),
        evNyilvantartasiSzam: z.string().trim().regex(EV_SZAM, { error: EV_SZAM_MSG }).optional(),
      })
      .safeParse({ filedOn: body.filedOn, channel: body.channel, adoszam: body.adoszam || undefined, evNyilvantartasiSzam: body.evNyilvantartasiSzam || undefined });
    if (!meta.success) throw E.validation(Object.fromEntries(meta.error.issues.map((i) => [i.path.join('.') || '_', i.message && !/^Invalid/.test(i.message) ? i.message : 'Hibás vagy hiányzó érték.'])));
    if (meta.data.adoszam) {
      const ck = checkRegistrationAdoszam(meta.data.adoszam);
      if (!ck.ok) throw E.validation({ adoszam: 'Ez az adószám nem stimmel (formátum: 12345678-1-23).' });
      if (!ck.afaMentes) throw E.validation({ adoszam: await deps.content.render('vallalkozas.adoszam.nem_afamentes', {}) });
    }
    const filesIn = await collectFiles(body, 'file');
    if (!filesIn.length) throw E.validation({ file: 'Töltsd fel a NAV-os értesítést (PDF), vagy egy fotót róla.' });
    await assertUploadQuota(deps, deps.db, cl, filesIn.reduce((x, f) => x + f.data.length, 0));
    const u = await deps.db.transaction(async (tx) => {
      let docId = row.filedDocumentId;
      const [existing] = docId ? await tx.select().from(documents).where(and(eq(documents.id, docId), eq(documents.clientId, cl.id))).limit(1) : [];
      if (existing) {
        await addVersion(deps, tx, existing, filesIn.slice(0, 1), [], auth(c).userId, 'client', 'Javított bejelentés');
      } else {
        const d = await createDocument(deps, tx, {
          clientId: cl.id,
          source: 'ugyfel',
          category: 'ev_bejelentes',
          dossierMonth: meta.data.filedOn.slice(0, 7),
          title: 'NAV-os értesítés a vállalkozás bejelentéséről',
          createdBy: auth(c).userId,
          files: filesIn.slice(0, 1),
          pages: [],
          actorRole: 'client',
        });
        docId = d.id;
      }
      return transition(
        deps,
        tx,
        row,
        'beadva',
        {
          filedOn: meta.data.filedOn,
          filedChannel: meta.data.channel,
          filedDocumentId: docId,
          filedAt: deps.now(),
          fixNote: null,
          ...(meta.data.adoszam ? { adoszam: meta.data.adoszam, adoszamSetBy: auth(c).userId } : {}),
          ...(meta.data.evNyilvantartasiSzam ? { evNyilvantartasiSzam: meta.data.evNyilvantartasiSzam } : {}),
        },
        { action: 'registration.filed', actorUserId: auth(c).userId, actorRole: 'client', details: { channel: meta.data.channel, reupload: Boolean(existing), withAdoszam: Boolean(meta.data.adoszam) } },
      );
    });
    await notifyQueueOwners(deps, deps.db, { kind: 'registration_submitted', params: { clientName: clientName(cl) }, link: `/vallalkozas-inditas/${row.id}`, data: { clientId: cl.id, registrationId: row.id } });
    return c.json(await view(cl, u));
  });

  r.post('/business-registration/adoszam', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ adoszam: z.string().trim().max(20), evNyilvantartasiSzam: z.string().trim().regex(EV_SZAM, { error: EV_SZAM_MSG }).optional(), registeredOn: z.string().refine(isIsoDate).optional() }));
    const row = await openRegistrationOf(deps.db, cl.id);
    if (!row || !['beadva', 'javitas', 'ellenorizve'].includes(row.status)) throw E.conflict('Az adószámot akkor írd be, ha már beküldted a bejelentést.');
    const ck = checkRegistrationAdoszam(b.adoszam);
    if (!ck.ok) throw E.validation({ adoszam: 'Ez az adószám nem stimmel (formátum: 12345678-1-23).' });
    if (!ck.afaMentes) throw E.validation({ adoszam: await deps.content.render('vallalkozas.adoszam.nem_afamentes', {}) });
    if (b.registeredOn && b.registeredOn > todayBudapest(deps.now())) throw E.validation({ registeredOn: 'Nem lehet a jövőben.' });
    const res = await deps.db.transaction(async (tx) => {
      const patch = { adoszam: b.adoszam, adoszamSetBy: auth(c).userId, ...(b.evNyilvantartasiSzam ? { evNyilvantartasiSzam: b.evNyilvantartasiSzam } : {}), ...(b.registeredOn ? { registeredOn: b.registeredOn } : {}) };
      if (row.status === 'ellenorizve') {
        const u = await transition(deps, tx, row, 'kesz', { ...patch, doneAt: deps.now() }, { action: 'registration.adoszam_set', actorUserId: auth(c).userId, actorRole: 'client', details: { by: 'client' } });
        return { u: await finishRegistration(deps, tx, u), done: true };
      }
      const [u] = await tx.update(businessRegistrations).set({ ...patch, updatedAt: deps.now() }).where(eq(businessRegistrations.id, row.id)).returning();
      await auditC(c, tx, 'registration.adoszam_set', { targetType: 'business_registration', targetId: row.id, clientId: cl.id, details: { by: 'client', status: row.status } });
      return { u: u!, done: false };
    });
    if (res.done) await afterRegistrationDone(deps, res.u);
    return c.json(await view(cl, res.u));
  });

  /**
   * SPEC §27.2.2: allowed only before anything is filed ('kitoltes', 'utmutato'); otherwise the client asks for a
   * callback (409 path_change_needs_callback). 'mar_van_vallalkozasa' = the same effect as the change inditas → van.
   */
  r.post('/business-registration/withdraw', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ reason: z.enum(REGISTRATION_WITHDRAW_REASONS), note: z.string().trim().max(500).optional() }));
    const row = await openRegistrationOf(deps.db, cl.id);
    if (!row) throw E.conflict('Nincs folyamatban lévő bejelentésed.');
    if (row.status !== 'kitoltes' && row.status !== 'utmutato') throw await blockedError(deps, 'bejelentes_bekuldve');
    const blocker = await pathBlocker(deps.db, cl, b.reason === 'mar_van_vallalkozasa' ? 'van' : null);
    if (blocker && blocker !== 'adoszam_megadva') throw await blockedError(deps, blocker);
    if (b.reason === 'mar_van_vallalkozasa') {
      const res = await deps.db.transaction((tx) => applyPathChange(deps, tx, cl, 'van', by(c)));
      await notifyPathChanged(deps, deps.db, cl, res, null);
    } else {
      await deps.db.transaction(async (tx) => {
        await leaveInditas(deps, tx, cl, by(c), { reason: b.reason, note: b.note ?? null });
        await tx.update(clients).set({ businessStatus: null, businessStatusChangedAt: deps.now(), updatedAt: deps.now() }).where(eq(clients.id, cl.id));
        await auditC(c, tx, 'business_status.changed', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { from: 'inditas', to: null, by: 'ugyfel', withdraw: b.reason } });
      });
    }
    const [u] = await deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.id, row.id)).limit(1);
    return c.json(await view(cl, u!));
  });

  /** SPEC §27.4.4 S12: "Megcsináltam" / "Mégsem csináltam meg" on the kamarai regisztráció row (only after 'kesz'). */
  r.post('/business-registration/chamber', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ done: z.boolean() }));
    const row = await currentRegistrationOf(deps.db, cl.id);
    if (!row || row.status !== 'kesz') throw E.conflict('A kamarai regisztráció az adószámod után jön.');
    const [u] = await deps.db.update(businessRegistrations).set({ chamberDoneAt: b.done ? deps.now() : null, updatedAt: deps.now() }).where(eq(businessRegistrations.id, row.id)).returning();
    await auditC(c, deps.db, b.done ? 'registration.chamber_done' : 'registration.chamber_undone', { targetType: 'business_registration', targetId: row.id, clientId: cl.id });
    return c.json(await view(cl, u!));
  });

  // ================= guides (SPEC §26.6, §27.3.6) =================
  const kindParam = (c: C): GuideKind => {
    const k = c.req.param('kind');
    if (!(GUIDE_KINDS as readonly string[]).includes(k ?? '')) throw E.notFound();
    return k as GuideKind;
  };

  async function meghatalmazasProgress(clientId: string, key: 'guideProgress' | 'approvalGuideProgress' = 'guideProgress'): Promise<string[]> {
    const [s] = await deps.db.select({ data: onboardingSteps.data }).from(onboardingSteps).where(and(eq(onboardingSteps.clientId, clientId), eq(onboardingSteps.step, 'meghatalmazas'))).limit(1);
    const p = (s?.data as Record<string, unknown> | null)?.[key];
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  }

  /** The assist whose UJEGYKE waits for the client's ONYA approval (approval guide only). */
  async function approvalAssist(cl: ClientRow) {
    const rows = await assistsOfClient(deps.db, cl.id);
    return rows.find((x) => x.status === 'meghatalmazas_bekuldve' || x.status === 'meghatalmazas_lejart' || x.status === 'meghatalmazas_jovahagyva') ?? null;
  }

  r.get('/guides/:kind', async (c) => {
    const kind = kindParam(c);
    const cl = await client(c);
    const a = await acc(cl);
    let row: RegRow | null = null;
    let approval: ReturnType<typeof approvalInfo> = null;
    if (kind === 'vallalkozas_bejelentes') {
      row = await currentRegistrationOf(deps.db, cl.id);
      if (pathOf(cl) !== 'inditas' || !row || row.status === 'kitoltes' || row.status === 'elallt') throw E.stepLocked('Előbb küldd el a kérdőívet, utána elkészül a személyre szabott útmutatód.');
      if (!row.guideOpenedAt) {
        await deps.db.update(businessRegistrations).set({ guideOpenedAt: deps.now() }).where(eq(businessRegistrations.id, row.id));
        await auditC(c, deps.db, 'registration.guide_opened', { targetType: 'business_registration', targetId: row.id, clientId: cl.id });
      }
    } else if (kind === 'meghatalmazas_jovahagyas') {
      const as = await approvalAssist(cl);
      if (!as) throw E.stepLocked('Ez akkor kell, ha a könyvelőd már beküldte a meghatalmazást. Értesítünk.');
      approval = approvalInfo(deps, as);
    } else {
      await assertStepOpen(deps, deps.db, cl, 'meghatalmazas');
      row = pathOf(cl) === 'inditas' ? await currentRegistrationOf(deps.db, cl.id) : null;
    }
    const ap = accountantPublic(a);
    const g = buildGuide(deps, kind, {
      cl,
      answers: row ? answersOf(row) : null,
      accountant: {
        firstName: ap.firstName,
        name: a?.displayName ?? null,
        taxId: kind === 'meghatalmazas' ? await accountantTaxIdForClient(deps, deps.db, cl.id, a) : null,
        registrationNumber: a?.registrationNumber ?? null,
      },
      progress:
        kind === 'vallalkozas_bejelentes' ? (row?.guideProgress ?? []) : await meghatalmazasProgress(cl.id, kind === 'meghatalmazas_jovahagyas' ? 'approvalGuideProgress' : 'guideProgress'),
      jovahagyasHatarido: approval ? (approval.lastDay ? 'ma' : approval.dueText) : null,
    });
    if (kind === 'meghatalmazas_jovahagyas') g.approvalDue = approval ? { dueOn: approval.dueOn, dueText: approval.dueText, daysLeft: approval.daysLeft, lastDay: approval.lastDay, afterDue: approval.afterDue } : null;
    // Once the bejelentés is filed nobody must read "még ne kezdd el / még ne küldd be": the exact-ÖVTJ hold (banner
    // and per-step notes) only matters before filing (round 1, 2026-11-19).
    if (kind === 'vallalkozas_bejelentes' && row && !ACTIVITY_HOLD_STATUSES.includes(row.status)) {
      g.activityPending = false;
      g.steps = g.steps.map((st) => {
        const { hold: _hold, ...rest } = st as typeof st & { hold?: string };
        void _hold;
        return rest as typeof st;
      });
    }
    if (g.outdated) g.outdatedText = await deps.content.render('vallalkozas.utmutato.elavult', {});
    return c.json(g);
  });

  r.put('/guides/:kind/progress', async (c) => {
    const kind = kindParam(c);
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ doneStepKeys: z.array(z.string().max(40)).max(40) }));
    const keys = GUIDE_STEP_KEYS[kind] as readonly string[];
    const done = [...new Set(b.doneStepKeys.filter((k) => keys.includes(k)))];
    if (kind === 'vallalkozas_bejelentes') {
      const row = await openRegistrationOf(deps.db, cl.id);
      if (!row || row.status === 'kitoltes') throw E.stepLocked('Előbb küldd el a kérdőívet.');
      await deps.db.update(businessRegistrations).set({ guideProgress: done, updatedAt: deps.now() }).where(eq(businessRegistrations.id, row.id));
    } else {
      if (kind === 'meghatalmazas_jovahagyas') {
        if (!(await approvalAssist(cl))) throw E.stepLocked('Ez akkor kell, ha a könyvelőd már beküldte a meghatalmazást.');
      } else await assertStepOpen(deps, deps.db, cl, 'meghatalmazas');
      const st = await steps(deps.db, cl.id);
      if (!st.get('meghatalmazas')) await setStep(deps, deps.db, cl.id, 'meghatalmazas', 'ugyfelre_var');
      const field = kind === 'meghatalmazas_jovahagyas' ? 'approvalGuideProgress' : 'guideProgress';
      await deps.db
        .update(onboardingSteps)
        .set({ data: sql`coalesce(${onboardingSteps.data}, '{}'::jsonb) || ${JSON.stringify({ [field]: done })}::jsonb` })
        .where(and(eq(onboardingSteps.clientId, cl.id), eq(onboardingSteps.step, 'meghatalmazas')));
    }
    return c.json({ doneStepKeys: done });
  });

  // ================= callbacks (SPEC §26.2; '…_helyettem' topics open an assist, §27.3.2) =================
  r.get('/callbacks', async (c) => {
    const cl = await client(c);
    return c.json(await clientCallbacks(deps, deps.db, cl, await firstName(cl)));
  });

  const callbackBody = z.strictObject({
    phone: z.string().trim().max(30).optional(),
    topic: z.enum(CALLBACK_TOPICS),
    window: z.enum(CALLBACK_WINDOWS).default('barmikor'),
    note: z.string().trim().max(CALLBACK_RULES.noteMaxChars, { error: `Legfeljebb ${CALLBACK_RULES.noteMaxChars} karakter.` }).optional(),
    source: z.enum(CALLBACK_SOURCES).refine((s) => s !== 'csapat' && s !== 'regi_idopont', { error: 'Hibás forrás.' }),
    savePhoneToProfile: z.boolean().optional(),
  });

  /** 11-19 javítás: a password / code / adóazonosító jel never reaches the team's list (400 on the note field). */
  async function refuseSecretNote(note: string | null | undefined) {
    if (noteLooksSecret(note)) {
      const msg = await deps.content.render('helyettunk.note_refused', {});
      throw E.validation({ note: msg }, msg);
    }
  }

  r.post('/callbacks', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, callbackBody);
    await refuseSecretNote(b.note);
    const assistKind = CALLBACK_ASSIST_TOPIC[b.topic];
    if (assistKind) {
      const res = await deps.db.transaction((tx) => requestAssist(deps, tx, { cl, kind: assistKind, source: b.source, phone: b.phone, window: b.window, note: b.note, savePhoneToProfile: b.savePhoneToProfile, by: by(c) }));
      const cb = res.callbackId ? await openCallbackRow(cl, res.callbackId) : null;
      if (!cb) throw E.internal();
      return c.json(await callbackView(deps, deps.db, cb), 201);
    }
    const row = await deps.db.transaction((tx) => createCallback(deps, tx, { cl, ...b, createdByRole: 'client', createdByUserId: auth(c).userId }));
    return c.json(await callbackView(deps, deps.db, row), 201);
  });

  async function openCallbackRow(cl: ClientRow, id: string) {
    const [cb] = await deps.db.select().from(callbackRequests).where(and(eq(callbackRequests.id, id), eq(callbackRequests.clientId, cl.id))).limit(1);
    return cb ?? null;
  }

  r.patch('/callbacks/:id', async (c) => {
    const cl = await client(c);
    const b = await readJson(
      c,
      z.strictObject({
        phone: z.string().trim().max(30).optional(),
        topic: z.enum(CALLBACK_TOPICS).optional(),
        window: z.enum(CALLBACK_WINDOWS).optional(),
        note: z.string().trim().max(CALLBACK_RULES.noteMaxChars).nullable().optional(),
      }),
    );
    await refuseSecretNote(b.note);
    const row = await deps.db.transaction(async (tx) => {
      const u = await updateByClient(deps, tx, cl, param(c, 'id'), b, auth(c).userId);
      // Switching the open callback to an "Intézzétek helyettem" topic opens (and links) the assist.
      const kind = b.topic ? CALLBACK_ASSIST_TOPIC[b.topic] : undefined;
      if (kind && !(await openAssistOf(tx, cl.id, kind))) await requestAssist(deps, tx, { cl, kind, source: u.source, by: by(c), noNewCallback: true });
      return u;
    });
    return c.json(await callbackView(deps, deps.db, row));
  });

  r.post('/callbacks/:id/cancel', async (c) => {
    const cl = await client(c);
    const row = await deps.db.transaction((tx) => cancelByClient(deps, tx, cl, param(c, 'id'), auth(c).userId));
    return c.json(await callbackView(deps, deps.db, row));
  });

  // ================= "Intézzük helyetted" (SPEC §27.3) =================
  r.get('/assist', async (c) => {
    const cl = await client(c);
    const fn = await firstName(cl);
    const rows = await assistsOfClient(deps.db, cl.id);
    return c.json({ items: await Promise.all(rows.map((x) => assistView(deps, deps.db, x, { accFirstName: fn }))) });
  });

  r.post('/assist', async (c) => {
    const cl = await client(c);
    const b = await readJson(
      c,
      z.strictObject({
        kind: z.enum(ASSIST_KINDS),
        source: z.enum(CALLBACK_SOURCES).refine((s) => s !== 'csapat' && s !== 'regi_idopont', { error: 'Hibás forrás.' }),
        phone: z.string().trim().max(30).optional(),
        window: z.enum(CALLBACK_WINDOWS).optional(),
        note: z.string().trim().max(CALLBACK_RULES.noteMaxChars, { error: `Legfeljebb ${CALLBACK_RULES.noteMaxChars} karakter.` }).optional(),
        savePhoneToProfile: z.boolean().optional(),
      }),
    );
    if (cl.lifecycle !== 'bekotes_alatt') throw E.conflict('A bekötésed már kész. Ha segítség kell, írj nekünk.');
    await refuseSecretNote(b.note);
    const res = await deps.db.transaction((tx) => requestAssist(deps, tx, { cl, ...b, by: by(c) }));
    const cb = res.callbackId ? await openCallbackRow(cl, res.callbackId) : null;
    return c.json({ assist: await assistView(deps, deps.db, res.row), callback: cb ? await callbackView(deps, deps.db, cb) : null }, 201);
  });

  r.post('/assist/:id/approved', async (c) => {
    const cl = await client(c);
    const row = await deps.db.transaction((tx) => clientApproved(deps, tx, cl, param(c, 'id'), auth(c).userId));
    return c.json(await assistView(deps, deps.db, row));
  });

  // 11-19 javítás: "Mégsem hagytam még jóvá" – the "Jóváhagytam" was tapped by mistake (no dead end any more).
  r.post('/assist/:id/not-approved', async (c) => {
    const cl = await client(c);
    const row = await deps.db.transaction((tx) => clientUnapproved(deps, tx, cl, param(c, 'id'), auth(c).userId));
    return c.json(await assistView(deps, deps.db, row));
  });

  r.get('/assist/:id/consent', async (c) => {
    const cl = await client(c);
    const row = (await assistsOfClient(deps.db, cl.id)).find((x) => x.id === param(c, 'id'));
    if (!row || row.kind !== 'vallalkozas_bejelentes') throw E.notFound();
    return c.json(await consentSummary(deps, deps.db, row));
  });

  r.post('/assist/:id/consent', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ hash: z.string().regex(/^[0-9a-f]{64}$/, { error: 'Hibás ellenőrző kód.' }), declaration: z.literal(true, { error: 'Ezt el kell fogadnod.' }), instruction: z.literal(true, { error: 'Ezt el kell fogadnod.' }) }));
    const row = await deps.db.transaction((tx) => giveConsent(deps, tx, cl, param(c, 'id'), b, { userId: auth(c).userId, ipHmac: c.get('ipHmac'), ua: c.get('ua') }));
    return c.json(await assistView(deps, deps.db, row));
  });

  r.post('/assist/:id/cancel', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ note: z.string().trim().max(500).optional() }));
    const row = await deps.db.transaction((tx) => cancelAssistByClient(deps, tx, cl, param(c, 'id'), auth(c).userId, b.note));
    return c.json(await assistView(deps, deps.db, row));
  });
}

/**
 * In the registration's transaction (SPEC §26.1.8, §27.4.4 S12): profile + tax profile filled, locked steps open, the
 * kamarai regisztráció deadline (registered/filed day + 5 working days) and the end of an "Intézzük helyetted" request.
 */
export async function finishRegistration(deps: Deps, tx: DbOrTx, row: RegRow): Promise<RegRow> {
  await fillProfileFromRegistration(deps, tx, row);
  // The "Rólad" page made 'adatok' kesz; the business data are complete now as well.
  await setStep(deps, tx, row.clientId, 'adatok', 'kesz');
  await afterProfileSubmitted(deps, tx, row.clientId);
  const base = row.registeredOn ?? row.filedOn ?? todayBudapest(deps.now());
  const [u] = await tx.update(businessRegistrations).set({ chamberDueOn: addWorkingDays(base, 5), updatedAt: deps.now() }).where(eq(businessRegistrations.id, row.id)).returning();
  await onRegistrationDone(deps, tx, row.clientId);
  return u ?? row;
}

/** After the transaction: notifications and the activation check. */
export async function afterRegistrationDone(deps: Deps, row: RegRow): Promise<void> {
  const [cl] = await deps.db.select().from(clients).where(eq(clients.id, row.clientId)).limit(1);
  if (!cl) return;
  await notify(deps, deps.db, row.chamberDueOn ? { userId: cl.userId, kind: 'registration_done', variant: 'kamara', params: { hatarido: huDayMonthIg(row.chamberDueOn) }, link: '/bekotes' } : { userId: cl.userId, kind: 'registration_done', link: '/bekotes' });
  await notifyAccountantReview(deps, deps.db, cl.id, `${clientName(cl)} vállalkozása elindult – nézd át a költséghányadot`, 'uj_vallalkozas');
  // Round-2 tax finding 4: the start year (and the current one) get their periods and estimates right away.
  for (const y of registrationYears(row, deps.now())) await recalcYear(deps, deps.db, cl.id, y).catch(() => undefined);
  await checkCompletion(deps, deps.db, cl.id);
  void audit;
  void ApiError;
}
