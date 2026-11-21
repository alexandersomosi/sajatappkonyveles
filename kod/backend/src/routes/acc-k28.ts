// /acc, /admin and /team routes of SPEC §28 / §28.K (staff side). The accountant sees his own clients only (others 404);
// admin sees all; the csapat role never sees allowances or tax numbers (404 – §28.3.2).
import { and, desc, eq, gte, inArray, isNotNull, lt, notInArray } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AccClientDetailK28 } from '../_shared/api.js';
import { ALLOWANCE_KINDS, ALLOWANCE_REJECT_REASONS, ANNUAL_CHECK_ITEMS, ANYAK_JOGCIMEK, CHECKIN_ITEM_STATUSES, EMPLOYER_DECISIONS, FEE_KINDS, RESPONSE_TIME_FORBIDDEN_PATTERNS, type AllowanceKind } from '../_shared/enums.js';
import { RESPONSE_TIME_SETTINGS_ERROR } from '../_shared/bekotes.js';
import type { Deps } from '../deps.js';
import { accountants, assistRequests, checkinItems, clients, clientTaxProfiles, feeCharges, navInvoices, notificationPrefs, notifications } from '../db/schema.js';
import { addDays } from '../lib/dates.js';
import { notificationSettingsOf } from '../notify/notify.js';
import { checkRegistrationAdoszam } from '../services/registration.js';
import { clientName } from '../services/people.js';
import { FEE_CHARGE_STATUSES } from '../_shared/enums.js';
import { auditC } from '../audit.js';
import { collectFiles } from '../files/upload.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { todayBudapest } from '../lib/dates.js';
import { ApiError, E } from '../lib/errors.js';
import { accountantPublic, type ClientRow } from '../services/people.js';
import { clientForStaff, staffActor, staffRefs, type StaffActor } from '../services/team.js';
import { createDocument } from '../services/documents.js';
import { reserveCard, reserveList } from '../services/felretesz.js';
import { approvedQuarterParts, earnings } from '../services/kereset.js';
import { accAllowanceView, answersRow, decide, pendingAllowances, staffPreview } from '../services/kedvezmeny.js';
import { engineInput } from '../services/tax.js';
import { decideCheckinItem, teamCheckinItems } from '../services/havi-ellenorzes.js';
import { accAnnualView, annualCheck, annualOf, annualStep, annualView } from '../services/eves-zaras.js';
import { decideEmployer, employerRow, employerView } from '../services/alkalmazott.js';
import { confirmFeeSetting, feeSettingViews, markRefunded, updateFeeSetting, waiveCharge } from '../services/dijak.js';
import { serviceLockView, staffServiceLock } from '../services/zarolas.js';
import { pauseView } from '../services/szuneteltetes.js';
import { changeDone, changeFiled, changeReady, followupViews, isChangeKind, patchFollowup } from '../services/valtozas.js';
import { assistForStaff, teamAssistDetail } from '../services/assist.js';
import { chargeById, feeChargeView } from '../services/dijak.js';
import { currentCheckin } from '../services/havi-ellenorzes.js';
import { KATA_EXEMPT_KINDS, KATA_VARIANTS } from '../_shared/kata.js';
import { kataHomeView, kataYearView, setKataBreaks, syncKataPeriods } from '../services/kata.js';
import { ensurePeriods, verifyPayment } from '../services/tax.js';
import { computeFlags } from '../services/flags.js';
import { taxPeriods } from '../db/schema.js';
import { isNull as isNullOp } from 'drizzle-orm';

/** SPEC §28.K.15: no answer-time promise in the accountant's response text. */
export function hasResponseTimePromise(s: string): boolean {
  return RESPONSE_TIME_FORBIDDEN_PATTERNS.some((p) => new RegExp(p, 'i').test(s));
}

async function staffClient(deps: Deps, c: C): Promise<{ actor: StaffActor; cl: ClientRow }> {
  const actor = await staffActor(deps.db, auth(c).userId, auth(c).role);
  if (actor.role === 'csapat') throw E.notFound();
  const cl = await clientForStaff(deps, deps.db, actor, param(c, 'id'));
  return { actor, cl };
}

/** SPEC §28 / §28.K extra fields of GET /acc/clients/:id (AccClientDetailK28). */
export async function accDetailK28(deps: Deps, cl: ClientRow): Promise<AccClientDetailK28> {
  const today = todayBudapest(deps.now());
  const year = Number(today.slice(0, 4));
  const [tp] = await deps.db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
  const open = await deps.db.select({ id: checkinItems.id }).from(checkinItems).where(and(eq(checkinItems.clientId, cl.id), inArray(checkinItems.status, ['uj', 'dijra_var', 'csapatnal', 'ugyfel_intezi'])));
  const ann = await annualOf(deps.db, cl.id, year - 1);
  return {
    allowancesPending: await pendingAllowances(deps.db, cl.id, year),
    reserve: cl.lifecycle === 'bekotes_alatt' ? null : await reserveCard(deps, deps.db, cl, today).catch(() => null),
    earnings: cl.lifecycle === 'bekotes_alatt' ? null : ((await earnings(deps, deps.db, cl, year, today).catch(() => null))?.card ?? null),
    taxRegime: tp?.regime ?? 'atalany',
    serviceLock: await serviceLockView(deps, cl),
    pause: await pauseView(deps, deps.db, cl.id),
    employer: employerView(await employerRow(deps.db, cl.id)),
    annual: ann ? await annualView(deps, deps.db, cl, year - 1) : null,
    adoszamPending: cl.adoszamPending,
    checkinOpenItems: open.length,
    // SPEC §32: the KATA card (keret, months, business customers) – filled for a KATA year
    ...(tp?.regime === 'kata' && cl.lifecycle !== 'bekotes_alatt' ? { kata: await kataCardOf(deps, cl, year) } : {}),
  };
}

/** The panel KATA card: the client's KataHomeView with the staff meter (projection) and the business invoices. */
async function kataCardOf(deps: Deps, cl: ClientRow, year: number): Promise<AccClientDetailK28['kata']> {
  const v = await kataHomeView(deps, deps.db, cl, year).catch(() => null);
  if (!v) return null;
  const staff = await kataYearView(deps, deps.db, cl, year, { staff: true }).catch(() => null);
  const { kataRisksOf } = await import('../services/szamla-ertesites.js');
  const risks = await kataRisksOf(deps, cl, { limit: 10 }).catch(() => []);
  return {
    ...v,
    ...(staff ? { meter: staff.meter, draftNote: staff.draftNote } : {}),
    businessInvoices: risks.map((r) => ({ navInvoiceId: r.navInvoiceId, customerName: r.vevo || null, amountHuf: r.amountHuf ?? 0, payerKind: r.payerKind, endsOn: r.endsOn ?? null, reportBy: r.reportBy ?? null })),
  };
}

export function registerAccK28Routes(r: Hono<Env>, deps: Deps): void {
  r.use('*', staffServiceLock(deps, 'acc'));
  const yearQ = z.object({ year: z.coerce.number().int().min(2024).max(2100).optional() });
  const thisYear = () => Number(todayBudapest(deps.now()).slice(0, 4));

  r.get('/clients/:id/reserve', async (c) => {
    const { cl } = await staffClient(deps, c);
    const v = await reserveList(deps, deps.db, cl, parseQuery(c, yearQ).year ?? thisYear(), todayBudapest(deps.now()));
    if (!v) throw E.notFound('Nincs adózási profil.');
    return c.json(v);
  });
  r.get('/clients/:id/earnings', async (c) => {
    const { cl } = await staffClient(deps, c);
    const e = await earnings(deps, deps.db, cl, parseQuery(c, yearQ).year ?? thisYear(), todayBudapest(deps.now()));
    if (!e) throw E.notFound('Nincs adózási profil.');
    return c.json(e.view);
  });

  // ---- allowances (§28.3.6)
  async function accView(cl: ClientRow, year: number) {
    const [tp] = await deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
    const input = tp ? await engineInput(deps.db, cl.id, year, `${year}-12-31`) : null;
    const { approved } = await approvedQuarterParts(deps.db, cl.id, year);
    return accAllowanceView(deps, deps.db, cl, year, (tp?.allowances ?? []).map((a) => ({ kind: a.kind, ...(a.note ? { note: a.note } : {}) })), input, approved);
  }
  r.get('/clients/:id/allowances', async (c) => {
    const { cl } = await staffClient(deps, c);
    return c.json(await accView(cl, parseQuery(c, yearQ).year ?? thisYear()));
  });
  const params = z
    .object({
      anyakJogcim: z.enum(ANYAK_JOGCIMEK).optional(),
      elsoHazasokMonthlyHuf: z.number().int().min(0).max(33_335).optional(),
      csaladi: z.array(z.object({ month: z.number().int().min(1).max(12), eltartott: z.number().int().min(0).max(30), children: z.array(z.object({ felvaltva: z.boolean(), tartosBeteg: z.boolean() })).max(20), sharePct: z.number().int().min(0).max(100) })).max(12).optional(),
      csjkInYear: z.boolean().optional(),
    })
    .strict();
  r.post('/clients/:id/allowances/:kind/decision', async (c) => {
    const { actor, cl } = await staffClient(deps, c);
    const kind = c.req.param('kind') as AllowanceKind;
    if (!(ALLOWANCE_KINDS as readonly string[]).includes(kind)) throw E.notFound();
    const b = await readJson(
      c,
      z.strictObject({
        year: z.number().int().min(2024).max(2100).optional(),
        status: z.enum(['jovahagyva', 'kerdes', 'elutasitva']),
        months: z.array(z.number().int().min(1).max(12)).max(12).optional(),
        params: params.optional(),
        inYear: z.boolean().optional(),
        reason: z.enum(ALLOWANCE_REJECT_REASONS).optional(),
        clientText: z.string().trim().max(500).optional(),
        staffNote: z.string().trim().max(1000).optional(),
      }),
    );
    const year = b.year ?? thisYear();
    await deps.db.transaction((tx) => decide(deps, tx, cl, year, kind, b, { userId: actor.userId, role: actor.role }));
    return c.json(await accView(cl, year));
  });
  r.post('/clients/:id/allowances/preview', async (c) => {
    const { cl } = await staffClient(deps, c);
    const b = await readJson(c, z.strictObject({ year: z.number().int().min(2024).max(2100), decisions: z.array(z.object({ kind: z.enum(ALLOWANCE_KINDS), months: z.array(z.number().int().min(1).max(12)).max(12), params: params.optional(), inYear: z.boolean() })).max(7) }));
    const input = await engineInput(deps.db, cl.id, b.year, `${b.year}-12-31`);
    if (!input) throw E.notFound('Nincs adózási profil erre az évre.');
    const ans = await answersRow(deps.db, cl.id, b.year);
    return c.json(staffPreview(input, b.decisions, ans?.answers?.birthMonth ?? null));
  });

  // ---- monthly check-in queue (§28.K.2)
  r.get('/checkin-items', async (c) => {
    const actor = await staffActor(deps.db, auth(c).userId, auth(c).role);
    // panel: 'nyitott' (= the default open set) and 'mind' (every status, the panel filters locally) – integrator k6
    const q = parseQuery(c, z.object({ status: z.enum([...CHECKIN_ITEM_STATUSES, 'nyitott', 'mind']).optional() }));
    return c.json({ items: await teamCheckinItems(deps, deps.db, { accountantId: actor.accountantId, role: actor.role }, q.status === 'nyitott' ? undefined : q.status) });
  });
  r.post('/checkin-items/:id', async (c) => {
    const actor = await staffActor(deps.db, auth(c).userId, auth(c).role);
    const b = await readJson(c, z.strictObject({ status: z.enum(['nem_kell', 'kesz', 'csapatnal']), clientText: z.string().trim().max(300).optional(), staffNote: z.string().trim().max(1000).optional(), apply: z.array(z.enum(['adoprofil_statusz', 'szunetel', 'kedvezmeny_ujranezes', 'alkalmazott_dontes'])).max(4).optional() }));
    await decideCheckinItem(deps, deps.db, param(c, 'id'), b, actor);
    return c.json({ items: await teamCheckinItems(deps, deps.db, { accountantId: actor.accountantId, role: actor.role }) });
  });

  // ---- the client's notification log (panel contract addition 1, README §28 builder notes; integrator k6). Own client / admin;
  //      csapat 404 (staffClient). No push token, no e-mail address; reading it is not audited (the client's own data).
  r.get('/clients/:id/notifications', async (c) => {
    const { cl } = await staffClient(deps, c);
    const q = parseQuery(c, z.object({ cursor: z.string().datetime().optional() }));
    const LIMIT = 50;
    const rows = await deps.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, cl.userId), q.cursor ? lt(notifications.createdAt, new Date(q.cursor)) : undefined))
      .orderBy(desc(notifications.createdAt))
      .limit(LIMIT + 1);
    const prefs = await deps.db.select({ kind: notificationPrefs.kind, push: notificationPrefs.push }).from(notificationPrefs).where(eq(notificationPrefs.userId, cl.userId));
    const pushOff = new Set(prefs.filter((p) => !p.push).map((p) => p.kind as string));
    const now = deps.now().getTime();
    const items = rows.slice(0, LIMIT).map((n) => {
      const d = (n.data ?? {}) as { pushNotBefore?: string; pushTickets?: unknown[]; variant?: string; pushTitle?: string | null };
      const notBefore = typeof d.pushNotBefore === 'string' ? d.pushNotBefore : null;
      let skipped: 'csendes_ido' | 'napi_limit' | 'kikapcsolva' | 'nincs_eszkoz' | null = null;
      if (!n.wantPush) skipped = pushOff.has(n.kind) || n.kind !== 'invoice_new' ? 'kikapcsolva' : 'napi_limit';
      else if (!n.pushSentAt && notBefore && Date.parse(notBefore) > now) skipped = 'csendes_ido';
      else if (n.pushSentAt && !(Array.isArray(d.pushTickets) && d.pushTickets.length)) skipped = 'nincs_eszkoz';
      return {
        id: n.id,
        kind: n.kind,
        variant: typeof d.variant === 'string' ? d.variant : null,
        title: n.title,
        body: n.body,
        link: n.link,
        createdAt: n.createdAt.toISOString(),
        readAt: n.readAt?.toISOString() ?? null,
        push: { wanted: n.wantPush, sentAt: n.pushSentAt?.toISOString() ?? null, notBefore, skipped, amountsShown: n.wantPush && (n.kind === 'invoice_new' || n.kind === 'kata_business_invoice') && d.variant !== 'rejtett' },
        email: n.wantEmail ? { sentAt: n.emailSentAt?.toISOString() ?? null } : null,
      };
    });
    const since = addDays(todayBudapest(deps.now()), -30);
    const skippedInvoices = (
      await deps.db
        .select({ id: navInvoices.id, invoiceNumber: navInvoices.invoiceNumber, issueDate: navInvoices.issueDate, grossHuf: navInvoices.grossHuf, state: navInvoices.notifyState })
        .from(navInvoices)
        .where(and(eq(navInvoices.clientId, cl.id), isNotNull(navInvoices.notifyState), notInArray(navInvoices.notifyState, ['kuldve', 'osszevonva']), gte(navInvoices.issueDate, since)))
        .orderBy(desc(navInvoices.issueDate))
        .limit(100)
    ).map((r) => ({ navInvoiceId: r.id, invoiceNumber: r.invoiceNumber, issueDate: r.issueDate, grossAmountHuf: Number(r.grossHuf), state: r.state! }));
    return c.json({
      items,
      nextCursor: rows.length > LIMIT ? items[items.length - 1]!.createdAt : null,
      settings: await notificationSettingsOf(deps.db, cl.userId),
      skippedInvoices,
    });
  });

  // ---- adószám filled by the accountant from ONYA (§28.K.9 "Most nem tudom"; panel 'Adószám hiányzik'; integrator k6)
  r.post('/clients/:id/adoszam', async (c) => {
    const { actor, cl } = await staffClient(deps, c);
    const b = await readJson(c, z.strictObject({ adoszam: z.string().trim().max(20) }));
    const ck = checkRegistrationAdoszam(b.adoszam);
    if (!ck.ok) throw E.validation({ adoszam: 'Ez az adószám nem stimmel (formátum: 12345678-1-23).' });
    if (cl.adoszam && !cl.adoszamPending) throw E.conflict('Ennek az ügyfélnek már van adószáma.');
    await deps.db.update(clients).set({ adoszam: b.adoszam, adoszamPending: false, updatedAt: deps.now() }).where(eq(clients.id, cl.id));
    await auditC(c, deps.db, 'client.adoszam_set', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { by: actor.role, afaMentes: ck.afaMentes } });
    return c.json({ adoszam: b.adoszam, afaMentes: ck.afaMentes, adoszamPending: false });
  });

  // ---- annual closing (§28.K.3)
  r.get('/clients/:id/annual', async (c) => {
    const { actor, cl } = await staffClient(deps, c);
    const q = parseQuery(c, z.object({ year: z.coerce.number().int().min(2024).max(2100).optional(), reveal: z.enum(['1']).optional() }));
    return c.json(await accAnnualView(deps, deps.db, cl, q.year ?? thisYear() - 1, q.reveal === '1', actor));
  });
  r.post('/clients/:id/annual/:aid/check', async (c) => {
    const { actor, cl } = await staffClient(deps, c);
    const b = await readJson(c, z.strictObject({ item: z.enum(ANNUAL_CHECK_ITEMS), done: z.boolean() }));
    await annualCheck(deps, deps.db, cl, param(c, 'aid'), b.item, b.done, actor);
    const r0 = await annualOf(deps.db, cl.id, thisYear() - 1);
    return c.json(await accAnnualView(deps, deps.db, cl, r0?.taxYear ?? thisYear() - 1, false, actor));
  });
  for (const step of ['draft', 'filed-szja', 'filed-hipa'] as const) {
    r.post(`/clients/:id/annual/:aid/${step}`, async (c) => {
      const { actor, cl } = await staffClient(deps, c);
      const ct = (c.req.header('content-type') ?? '').toLowerCase();
      const row = await deps.db.transaction(async (tx) => {
        if (ct.startsWith('multipart/')) {
          const body = await c.req.parseBody({ all: true });
          const filesIn = await collectFiles(body, 'file');
          if (filesIn.length) {
            await createDocument(deps, tx, {
              clientId: cl.id,
              source: 'konyvelo',
              category: step === 'draft' ? 'bevallas' : 'nav_visszaigazolas',
              dossierMonth: todayBudapest(deps.now()).slice(0, 7),
              title: step === 'draft' ? 'Bevallás tervezete – jóváhagyásra' : step === 'filed-szja' ? 'Éves bevallás – NAV-visszaigazolás' : 'Iparűzési adó bevallás – visszaigazolás',
              createdBy: actor.userId,
              files: filesIn.slice(0, 1),
              pages: [],
              actorRole: actor.role,
              visibility: 'kozos',
            } as Parameters<typeof createDocument>[2]);
          } else if (step === 'draft') throw E.validation({ file: 'Töltsd fel a tervezetet (PDF).' });
        } else if (step === 'draft') throw E.validation({ file: 'Töltsd fel a tervezetet (PDF).' });
        return annualStep(deps, tx, cl, param(c, 'aid'), step, actor);
      });
      return c.json(await accAnnualView(deps, deps.db, cl, row.taxYear, false, actor));
    });
  }

  // ---- employees / EFO (§28.K.7)
  r.post('/clients/:id/employer', async (c) => {
    const { actor, cl } = await staffClient(deps, c);
    const b = await readJson(c, z.strictObject({ decision: z.enum(EMPLOYER_DECISIONS), clientText: z.string().trim().max(500).optional(), staffNote: z.string().trim().max(1000).optional(), offerAmountText: z.string().trim().max(120).optional() }));
    const row = await decideEmployer(deps, deps.db, cl, b, actor);
    return c.json({ employer: employerView(row) });
  });

  // ---- KATA regime (§28.K.11; the accountant sets it). SPEC §32: + the KATA variant and the főfoglalkozás flag; the
  // quarters (H1) and the KATA months follow at once. The app never suggests a regime or a KATA variant to the client.
  r.post('/clients/:id/tax-regime', async (c) => {
    const { cl } = await staffClient(deps, c);
    const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    const b = await readJson(
      c,
      z.strictObject({
        regime: z.enum(['atalany', 'kata']),
        kataFrom: day.nullish(),
        kataTo: day.nullish(),
        year: z.number().int().min(2024).max(2100).optional(),
        kataVariant: z.enum(KATA_VARIANTS).optional(),
        kataFofoglalkozasu: z.boolean().nullish(),
      }),
    );
    const year = b.year ?? thisYear();
    for (const d of [b.kataFrom, b.kataTo]) if (d && Number(d.slice(0, 4)) !== year) throw E.validation({ kataFrom: `A dátumnak ${year}-re kell esnie.` });
    if (b.kataFrom && b.kataTo && b.kataFrom > b.kataTo) throw E.validation({ kataTo: 'A kata vége nem lehet a kezdete előtt.' });
    const variant = b.regime === 'kata' ? (b.kataVariant ?? 'regi') : null;
    // the new KATA (T/928) exists only from 2027, and only once the law is published (the switch) – the data can be recorded
    if (variant === 'uj' && year < 2027) throw E.validation({ kataVariant: 'Az új kata (T/928) legkorábban 2027-től létezik.' });
    // the Kata tv. KATA is for a főfoglalkozású EV only (Kata tv. 3. §)
    if (variant === 'regi' && b.kataFofoglalkozasu === false) throw E.validation({ kataFofoglalkozasu: 'A (régi) kata csak főfoglalkozású egyéni vállalkozónak választható.' });
    const upd = await deps.db
      .update(clientTaxProfiles)
      .set({
        regime: b.regime,
        kataFrom: b.kataFrom ?? null,
        kataTo: b.kataTo ?? null,
        ...(b.regime === 'kata' ? { kataVariant: variant, kataFofoglalkozasu: variant === 'regi' ? true : (b.kataFofoglalkozasu ?? null) } : {}),
        updatedAt: deps.now(),
      })
      .where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year)))
      .returning();
    if (!upd.length) throw E.notFound('Nincs adózási profil erre az évre.');
    await auditC(c, deps.db, 'tax_regime.set', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { regime: b.regime, year, kataVariant: variant } });
    await ensurePeriods(deps.db, cl.id, year, upd[0]!.hipaMethod, upd[0]!.status);
    await syncKataPeriods(deps, deps.db, cl.id, year);
    await computeFlags(deps, deps.db, cl.id);
    return c.json({ regime: b.regime, kataFrom: b.kataFrom ?? null, kataTo: b.kataTo ?? null, kataVariant: upd[0]!.kataVariant ?? null, kataFofoglalkozasu: upd[0]!.kataFofoglalkozasu ?? null });
  });

  // ---- SPEC §32 KATA months, free months, group verification
  r.get('/clients/:id/kata', async (c) => {
    const { cl } = await staffClient(deps, c);
    const v = await kataYearView(deps, deps.db, cl, parseQuery(c, yearQ).year ?? thisYear(), { staff: true });
    if (!v) throw E.notFound('Ebben az évben az ügyfél nem katás.');
    return c.json(v);
  });
  const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'ÉÉÉÉ-HH-NN alakban.' });
  r.put('/clients/:id/kata/breaks', async (c) => {
    const { actor, cl } = await staffClient(deps, c);
    const b = await readJson(c, z.strictObject({ year: z.number().int().min(2024).max(2100), breaks: z.array(z.strictObject({ from: isoDay, to: isoDay, kind: z.enum(KATA_EXEMPT_KINDS), reportedOn: isoDay.nullish() })).max(24) }));
    // no transaction: the sync's staff notifications go through deps.db (PGlite has one connection)
    await setKataBreaks(deps, deps.db, cl, b.year, b.breaks.map((x) => ({ ...x, reportedOn: x.reportedOn ?? null })), actor.userId);
    await computeFlags(deps, deps.db, cl.id);
    const v = await kataYearView(deps, deps.db, cl, b.year, { staff: true });
    return c.json(v);
  });
  r.post('/clients/:id/kata/verify', async (c) => {
    const { actor, cl } = await staffClient(deps, c);
    if (!cl.accountantId) throw E.conflict('Az ügyfélnek nincs könyvelője.');
    const b = await readJson(c, z.strictObject({ periodIds: z.array(z.string().uuid()).min(1).max(24), note: z.string().trim().max(500).optional() }));
    const rows = await deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, cl.id), eq(taxPeriods.kind, 'kata'), isNullOp(taxPeriods.hiddenAt), inArray(taxPeriods.id, b.periodIds)));
    if (rows.length !== new Set(b.periodIds).size) throw E.notFound();
    let year = thisYear();
    await deps.db.transaction(async (tx) => {
      for (const p of rows) {
        year = p.year;
        await verifyPayment(deps, tx, p.id, actor.userId, cl.accountantId!, [{ kind: 'kata_teteles', verification: 'rendben', ...(b.note ? { note: b.note } : {}) }]);
      }
    });
    await auditC(c, deps.db, 'kata.verified', { targetType: 'client', targetId: cl.id, clientId: cl.id, details: { count: rows.length } });
    await computeFlags(deps, deps.db, cl.id);
    return c.json(await kataYearView(deps, deps.db, cl, year, { staff: true }));
  });
}

/** /admin/fees … (SPEC §28.K.1; admin only). */
export function registerAdminK28Routes(r: Hono<Env>, deps: Deps): void {
  r.get('/fees', async (c) => c.json({ items: await feeSettingViews(deps, deps.db) }));
  r.put('/fees', async (c) => {
    const b = await readJson(c, z.strictObject({ kind: z.enum(FEE_KINDS), amountHuf: z.number().int().min(0).max(1_000_000), effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), note: z.string().trim().max(300).optional() }));
    await updateFeeSetting(deps, deps.db, b.kind, b.amountHuf, { effectiveFrom: b.effectiveFrom, note: b.note, by: auth(c).userId });
    return c.json({ items: await feeSettingViews(deps, deps.db) });
  });
  r.post('/fees/:kind/confirm', async (c) => {
    const kind = c.req.param('kind');
    if (!(FEE_KINDS as readonly string[]).includes(kind)) throw E.notFound();
    await confirmFeeSetting(deps, deps.db, kind as (typeof FEE_KINDS)[number], auth(c).userId);
    return c.json({ items: await feeSettingViews(deps, deps.db) });
  });
  // panel contract addition 2 (integrator k6): the one-off charges, for the refund / waive work on /admin/dijak
  r.get('/fee-charges', async (c) => {
    const q = parseQuery(c, z.object({ status: z.enum(FEE_CHARGE_STATUSES).optional() }));
    const rows = await deps.db
      .select({ f: feeCharges, cl: { id: clients.id, firstName: clients.firstName, lastName: clients.lastName } })
      .from(feeCharges)
      .innerJoin(clients, eq(clients.id, feeCharges.clientId))
      .where(q.status ? eq(feeCharges.status, q.status) : undefined)
      .orderBy(desc(feeCharges.createdAt))
      .limit(500);
    const items = [];
    for (const r0 of rows) items.push({ ...(await feeChargeView(deps, deps.db, r0.f)), client: { id: r0.cl.id, name: clientName(r0.cl) } });
    return c.json({ items });
  });
  r.post('/fee-charges/:id/waive', async (c) => {
    const b = await readJson(c, z.strictObject({ reason: z.string().trim().min(3, { error: 'Írd be az indokot.' }).max(500) }));
    const row = await waiveCharge(deps, deps.db, param(c, 'id'), b.reason, auth(c).userId);
    return c.json(await feeChargeView(deps, deps.db, row));
  });
  r.post('/fee-charges/:id/refunded', async (c) => {
    const b = await readJson(c, z.strictObject({ note: z.string().trim().max(500).optional() }));
    const row = await markRefunded(deps, deps.db, param(c, 'id'), b.note, auth(c).userId);
    return c.json(await feeChargeView(deps, deps.db, row));
  });
}

/** /team/assists/:id/{change-ready, change-done, followups} and the change-kind branch of ev-filed / detail. */
export function registerTeamK28Routes(r: Hono<Env>, deps: Deps, card: (cl: ClientRow) => Promise<Parameters<typeof teamAssistDetail>[5]>): void {
  r.use('*', staffServiceLock(deps, 'team'));
  const actorOf = (c: C) => staffActor(deps.db, auth(c).userId, auth(c).role);
  async function detail(a: StaffActor, id: string) {
    const { row, cl, kind } = await assistForStaff(deps, deps.db, a, id);
    const base = await teamAssistDetail(deps, deps.db, a, row, kind, await card(cl));
    if (!isChangeKind(row.kind)) return base;
    const refs = await staffRefs(deps.db, Object.values(row.followups ?? {}).map((f) => f.by));
    const ch = await chargeById(deps.db, row.feeChargeId);
    return { ...base, change: row.changeData ?? null, followups: followupViews(row, refs), feeCharge: ch ? await feeChargeView(deps, deps.db, ch) : null, serviceLocked: Boolean(cl.serviceLock) };
  }
  // fee_unpaid: no team action while the client has not paid (SPEC §28.K.18)
  r.post('/assists/:id/:action', async (c, next) => {
    const id = c.req.param('id');
    if (!/^[0-9a-f-]{36}$/.test(id)) return next();
    const [row] = await deps.db.select({ status: assistRequests.status, kind: assistRequests.kind }).from(assistRequests).where(eq(assistRequests.id, id)).limit(1);
    if (row?.status === 'dijra_var' && c.req.param('action') !== 'close') throw new ApiError(409, 'fee_unpaid', 'Ehhez előbb ki kell fizetni a díjat.');
    return next();
  });
  r.get('/assists/:id', async (c, next) => {
    const id = param(c, 'id');
    const [row] = await deps.db.select({ kind: assistRequests.kind }).from(assistRequests).where(eq(assistRequests.id, id)).limit(1);
    if (!row || !isChangeKind(row.kind)) return next();
    return c.json(await detail(await actorOf(c), id));
  });
  r.post('/assists/:id/change-ready', async (c) => {
    const a = await actorOf(c);
    const id = param(c, 'id');
    await deps.db.transaction(async (tx) => {
      const { row, cl, kind } = await assistForStaff(deps, tx, a, id, true);
      if (!isChangeKind(row.kind)) throw E.notFound();
      await changeReady(deps, tx, a, row, cl, kind);
    });
    return c.json(await detail(a, id));
  });
  r.post('/assists/:id/ev-filed', async (c, next) => {
    const a = await actorOf(c);
    const id = param(c, 'id');
    const [r0] = await deps.db.select({ kind: assistRequests.kind }).from(assistRequests).where(eq(assistRequests.id, id)).limit(1);
    if (!r0 || !isChangeKind(r0.kind)) return next();
    const body = await c.req.parseBody({ all: true });
    const filesIn = await collectFiles(body, 'file');
    if (!filesIn.length) throw E.validation({ file: 'Töltsd fel a NAV-os értesítést (PDF vagy fotó).' });
    let items: unknown = body.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch {
        items = [items];
      }
    }
    const list = Array.isArray(items) ? items.filter((x): x is string => typeof x === 'string') : [];
    await deps.db.transaction(async (tx) => {
      const { row, cl, kind } = await assistForStaff(deps, tx, a, id, true);
      const now = deps.now().toISOString();
      const checklist = { ...(row.checklist ?? {}) };
      for (const it of list) if (['kepviseletvalaszto', 'adatok_egyeznek', 'valtozas_bekuldve', 'ertesites_letoltve'].includes(it)) checklist[it] = { at: now, by: a.userId };
      await tx.update(assistRequests).set({ checklist }).where(eq(assistRequests.id, row.id));
      const d = await createDocument(deps, tx, {
        clientId: cl.id,
        source: 'konyvelo',
        category: 'nav_visszaigazolas',
        dossierMonth: now.slice(0, 7),
        title: `Változásbejelentés – NAV-értesítés (${now.slice(0, 10)})`,
        createdBy: a.userId,
        files: filesIn.slice(0, 1),
        pages: [],
        actorRole: a.role,
        visibility: 'kozos',
      } as Parameters<typeof createDocument>[2]);
      void d;
      await changeFiled(deps, tx, a, { ...row, checklist }, cl, kind);
    });
    return c.json(await detail(a, id));
  });
  r.post('/assists/:id/change-done', async (c) => {
    const a = await actorOf(c);
    const id = param(c, 'id');
    const b = await readJson(c, z.strictObject({ followups: z.array(z.string().max(60)).max(10).optional() }));
    await deps.db.transaction(async (tx) => {
      const { row, cl, kind } = await assistForStaff(deps, tx, a, id, true);
      if (!isChangeKind(row.kind)) throw E.notFound();
      await changeDone(deps, tx, a, row, cl, kind, b.followups ?? []);
    });
    return c.json(await detail(a, id));
  });
  r.patch('/assists/:id/followups', async (c) => {
    const a = await actorOf(c);
    const id = param(c, 'id');
    const b = await readJson(c, z.strictObject({ key: z.string().max(60), done: z.boolean() }));
    await deps.db.transaction(async (tx) => {
      const { row, cl } = await assistForStaff(deps, tx, a, id, true);
      await patchFollowup(deps, tx, a, row, cl, b.key, b.done);
    });
    return c.json(await detail(a, id));
  });
}

export { accountantPublic, accountants, clients, currentCheckin, hasResponseTimePromise as responseTimeForbidden, RESPONSE_TIME_SETTINGS_ERROR };
