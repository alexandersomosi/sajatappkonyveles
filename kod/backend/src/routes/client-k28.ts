// /client routes of SPEC §28 (félretenni, allowances, "Mennyit kerestem?", change guides + assisted changes) and §28.K
// (fees, monthly check-in, annual closing, employees). Registered in clientRoutes BEFORE the §26/§27 routes, so the
// change kinds of /guides/:kind and /assist are answered here and everything else falls through (next()).
import { eq } from 'drizzle-orm';
import type { Hono } from 'hono';
import { z } from 'zod';
import type { AllowanceAnswers, ClientHome } from '../_shared/api.js';
import { ALLOWANCE_GATES, ALLOWANCE_LIMITS, CALLBACK_WINDOWS, CHECKIN_HOW, CHECKIN_ITEMS, CHECKIN_WEEKLY_HOURS, EMPLOYER_ANSWERS, type ChangeKind } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { assistRequests, clientTaxProfiles } from '../db/schema.js';
import { and } from 'drizzle-orm';
import { audit, auditC } from '../audit.js';
import { auth, param, parseQuery, readJson, type C, type Env } from '../http/core.js';
import { todayBudapest } from '../lib/dates.js';
import { E } from '../lib/errors.js';
import { accountantParams } from '../notify/notify.js';
import { clientOfUser, type ClientRow } from '../services/people.js';
import { isRestricted } from '../services/access.js';
import { reserveCard, reserveList, reservesForInvoices, setReserveMark } from '../services/felretesz.js';
import { earnings, earningsBasis, kb1000 } from '../services/kereset.js';
import { allowanceState, allowancesHint, answersRow, clientPreview, fmt, saveAnswers, setGate } from '../services/kedvezmeny.js';
import type { DbOrTx } from '../db/client.js';
import { engineInput } from '../services/tax.js';
import {
  buildChangeGuide,
  changeAssistView,
  changeConsentSummary,
  changeDataSchema,
  changeGuidesView,
  changeProgress,
  giveChangeConsent,
  isChangeKind,
  onChangeAssistEnded,
  requestChangeAssist,
  setChangeProgress,
  updateChangeData,
} from '../services/valtozas.js';
import { feesView, startFeePayment } from '../services/dijak.js';
import { answerCheckin, checkinView, currentCheckin } from '../services/havi-ellenorzes.js';
import { annualAnswersSchema, annualView, defaultAnnualYear, approveAnnual, saveAnnualAnswers, submitAnnual } from '../services/eves-zaras.js';
import { employerRow, employerView, setEmployerAnswer } from '../services/alkalmazott.js';
import { serviceLockView } from '../services/zarolas.js';
import { pauseView } from '../services/szuneteltetes.js';

const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: 'ÉÉÉÉ-HH alakban.' });

/** zod of AllowanceAnswers (SPEC §28.3.2; K3.4: no name, child birth date, TAJ or tax-id field exists). */
export const allowanceAnswersSchema = z.strictObject({
  birthMonth: monthKey
    .refine((v) => {
      const y = Number(v.slice(0, 4));
      return y >= ALLOWANCE_LIMITS.birthYearMin && y <= ALLOWANCE_LIMITS.birthYearMax;
    }, { error: 'Válaszd ki az évet és a hónapot.' })
    .nullable(),
  children: z
    .array(
      z.strictObject({
        potlek: z.enum(['most', 'tizenket_ev', 'elhunyt', 'nem']),
        sajat: z.boolean(),
        tartosBeteg: z.boolean(),
        felvaltva: z.boolean(),
        potlekKezdeteHo: monthKey.nullable(),
        potlekVegeHo: monthKey.nullable(),
      }),
    )
    .max(ALLOWANCE_LIMITS.childrenMax),
  otherDependants: z.number().int().min(0).max(ALLOWANCE_LIMITS.otherDependantsMax),
  pregnancy: z.strictObject({ dueMonth: monthKey }).nullable(),
  mother: z.boolean().nullable(),
  csaladiWho: z.enum(['en', 'par', 'kozosen']).nullable(),
  csaladiSharePct: z.number().int().min(ALLOWANCE_LIMITS.sharePctMin, { error: 'A megosztás 10 és 90% között lehet.' }).max(ALLOWANCE_LIMITS.sharePctMax, { error: 'A megosztás 10 és 90% között lehet.' }).nullable(),
  csjkWish: z.enum(['igen', 'konyvelo_donti']).nullable(),
  marriage: z.strictObject({ month: monthKey, first: z.boolean(), who: z.enum(['en', 'par', 'kozosen']) }).nullable(),
  disability: z.strictObject({ fromMonth: monthKey.nullable(), basis: z.enum(['orvosi_igazolas', 'rokkantsagi_jaradek', 'fogyatekossagi_tamogatas']) }).nullable(),
  benefit: z.strictObject({ fromMonth: monthKey, toMonth: monthKey.nullable() }).nullable(),
  healthConsent: z.boolean(),
  note: z.string().trim().max(ALLOWANCE_LIMITS.noteMaxChars).nullable(),
});

const yearQ = z.object({ year: z.coerce.number().int().min(2024).max(2100).optional() });

export function registerClientK28Routes(r: Hono<Env>, deps: Deps): void {
  const client = (c: C) => clientOfUser(deps.db, auth(c).userId);
  const thisYear = () => Number(todayBudapest(deps.now()).slice(0, 4));
  async function profileOf(cl: ClientRow, year: number) {
    const [tp] = await deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, cl.id), eq(clientTaxProfiles.year, year))).limit(1);
    return tp ?? null;
  }
  async function firstName(cl: ClientRow): Promise<string> {
    return String((await accountantParams(deps.db, cl.accountantId)).firstName);
  }

  // ================= §28.1 félretenni =================
  r.get('/reserve', async (c) => {
    const cl = await client(c);
    const year = parseQuery(c, yearQ).year ?? thisYear();
    if (await isKata(deps.db, cl.id, year)) throw E.notFound(`Katás vagy: a havi 50 000 Ft-ot és a keretedet ${await firstName(cl)} figyeli.`);
    const v = await reserveList(deps, deps.db, cl, year, todayBudapest(deps.now()));
    if (!v) throw E.notFound('Még nincs adózási profilod. Ha {firstName} beállította, itt látod.'.replace('{firstName}', await firstName(cl)));
    return c.json(v);
  });
  r.get('/reserve/mark', async (c) => {
    const cl = await client(c);
    const card = await reserveCard(deps, deps.db, cl, todayBudapest(deps.now()));
    if (!card) throw E.notFound();
    return c.json(card);
  });
  r.put('/reserve/mark', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ year: z.number().int().min(2024).max(2100), markedHuf: z.number().int().min(0).max(1_000_000_000) }));
    await setReserveMark(deps, deps.db, cl, b.year, b.markedHuf, auth(c).userId);
    const card = await reserveCard(deps, deps.db, cl, todayBudapest(deps.now()));
    if (!card) throw E.notFound();
    return c.json(card);
  });

  // ================= §28.4 "Mennyit kerestem?" =================
  r.get('/earnings', async (c) => {
    const cl = await client(c);
    const year = parseQuery(c, yearQ).year ?? thisYear();
    if (await isKata(deps.db, cl.id, year)) throw E.notFound(`Katás vagy: a kata mindent fedez, a havi 50 000 Ft-ot ${await firstName(cl)} számolja.`);
    const e = await earnings(deps, deps.db, cl, year, todayBudapest(deps.now()));
    if (!e) throw E.notFound('Még nincs adózási profilod.');
    return c.json(e.view);
  });

  // ================= §28.3 allowances =================
  async function stateOf(cl: ClientRow, year: number) {
    const tp = await profileOf(cl, year);
    const input = tp ? await engineInput(deps.db, cl.id, year, `${year}-12-31`) : null;
    return allowanceState(deps, deps.db, cl, year, { input, firstName: await firstName(cl), regime: tp?.regime ?? 'atalany' });
  }
  r.get('/allowances', async (c) => {
    const cl = await client(c);
    return c.json(await stateOf(cl, parseQuery(c, yearQ).year ?? thisYear()));
  });
  r.put('/allowances/answers', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ year: z.number().int().min(2024).max(2100), answers: allowanceAnswersSchema, submit: z.boolean() }));
    const tp = await profileOf(cl, b.year);
    if (tp?.regime === 'kata') throw E.conflict(await deps.content.get('kedvezmeny.kata'));
    if (b.answers.marriage && b.answers.marriage.month > todayBudapest(deps.now()).slice(0, 7)) throw E.validation({ 'answers.marriage.month': 'Az esküvő hónapja nem lehet a jövőben.' });
    if (b.answers.csaladiWho === 'kozosen' && b.answers.csaladiSharePct === null) throw E.validation({ 'answers.csaladiSharePct': 'A megosztás 10 és 90% között lehet.' });
    await deps.db.transaction((tx) => saveAnswers(deps, tx, cl, b.year, b.answers as AllowanceAnswers, b.submit, tp?.status ?? 'fofoglalkozasu', { userId: auth(c).userId }));
    return c.json(await stateOf(cl, b.year));
  });
  r.post('/allowances/gate', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ year: z.number().int().min(2024).max(2100), gate: z.enum(ALLOWANCE_GATES) }));
    await setGate(deps, deps.db, cl, b.year, b.gate, { userId: auth(c).userId });
    return c.json(await stateOf(cl, b.year));
  });
  r.post('/allowances/preview', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ year: z.number().int().min(2024).max(2100), answers: allowanceAnswersSchema }));
    const tp = await profileOf(cl, b.year);
    const input = tp ? await engineInput(deps.db, cl.id, b.year, `${b.year}-12-31`) : null;
    return c.json(clientPreview(input, b.answers as AllowanceAnswers, b.year, tp?.status ?? 'fofoglalkozasu'));
  });

  // ================= §28.5 change guides + assisted changes =================
  r.get('/change-guides', async (c) => c.json(await changeGuidesView(deps, deps.db, await client(c))));
  r.get('/guides/:kind', async (c, next) => {
    const kind = c.req.param('kind');
    if (!isChangeKind(kind)) return next();
    return c.json(await buildChangeGuide(deps, deps.db, await client(c), kind));
  });
  r.put('/guides/:kind/progress', async (c, next) => {
    const kind = c.req.param('kind');
    if (!isChangeKind(kind)) return next();
    const cl = await client(c);
    const b = await readJson(c, z.object({ doneStepKeys: z.array(z.string().max(60)).max(40) }).passthrough());
    const g = await buildChangeGuide(deps, deps.db, cl, kind as ChangeKind);
    const known = new Set(g.steps.map((s) => s.key));
    await setChangeProgress(deps, deps.db, cl.id, kind as ChangeKind, b.doneStepKeys.filter((k) => known.has(k)));
    return c.json({ doneStepKeys: await changeProgress(deps.db, cl.id, kind as ChangeKind) });
  });

  r.post('/assist', async (c, next) => {
    let raw: { kind?: unknown } = {};
    try {
      raw = JSON.parse((await c.req.text()) || '{}') as { kind?: unknown };
    } catch {
      return next();
    }
    if (!isChangeKind(String(raw.kind ?? ''))) return next();
    const cl = await client(c);
    const b = await readJson(
      c,
      z.strictObject({
        kind: z.string(),
        source: z.string().max(40),
        change: changeDataSchema,
        callback: z.boolean().optional(),
        phone: z.string().trim().max(30).optional(),
        window: z.enum(CALLBACK_WINDOWS).optional(),
        note: z.string().trim().max(500).optional(),
        savePhoneToProfile: z.boolean().optional(),
      }),
    );
    const res = await deps.db.transaction((tx) => requestChangeAssist(deps, tx, { cl, kind: b.kind as ChangeKind, change: b.change, callback: b.callback, phone: b.phone, window: b.window, note: b.note ?? null, source: b.source, by: { userId: auth(c).userId } }));
    return c.json({ assist: await changeAssistView(deps, deps.db, res.row), callback: null, feeCharge: res.feeCharge }, 201);
  });
  r.put('/assist/:id/change', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ change: changeDataSchema }));
    const row = await deps.db.transaction((tx) => updateChangeData(deps, tx, cl, param(c, 'id'), b.change, auth(c).userId));
    return c.json(await changeAssistView(deps, deps.db, row));
  });
  async function ownChange(cl: ClientRow, id: string) {
    const [row] = await deps.db.select().from(assistRequests).where(and(eq(assistRequests.id, id), eq(assistRequests.clientId, cl.id))).limit(1);
    return row && isChangeKind(row.kind) ? row : null;
  }
  r.get('/assist/:id/consent', async (c, next) => {
    const cl = await client(c);
    const row = await ownChange(cl, param(c, 'id'));
    if (!row) return next();
    return c.json(await changeConsentSummary(deps, deps.db, row));
  });
  r.post('/assist/:id/consent', async (c, next) => {
    const cl = await client(c);
    const row = await ownChange(cl, param(c, 'id'));
    if (!row) return next();
    const b = await readJson(c, z.strictObject({ hash: z.string().regex(/^[0-9a-f]{64}$/, { error: 'Hibás ellenőrző kód.' }), declaration: z.literal(true, { error: 'Ezt el kell fogadnod.' }), instruction: z.literal(true, { error: 'Ezt el kell fogadnod.' }) }));
    const u = await deps.db.transaction((tx) => giveChangeConsent(deps, tx, cl, row.id, b.hash, { userId: auth(c).userId, ipHmac: c.get('ipHmac'), ua: c.get('ua') }));
    return c.json(await changeAssistView(deps, deps.db, u));
  });
  r.post('/assist/:id/cancel', async (c, next) => {
    const cl = await client(c);
    const row = await ownChange(cl, param(c, 'id'));
    if (!row) return next();
    if (!['dijra_var', 'visszahivas_kerve', 'egyeztetve', 'meghatalmazas_el', 'ugyfel_engedelyezte'].includes(row.status)) throw E.conflict('Ezt már beküldtük, nem vonható vissza.');
    const u = await deps.db.transaction(async (tx) => {
      const [x] = await tx.update(assistRequests).set({ status: 'visszavonva', statusChangedAt: deps.now(), closedAt: deps.now(), updatedAt: deps.now() }).where(eq(assistRequests.id, row.id)).returning();
      await audit(tx, { action: 'assist.cancelled', actorUserId: auth(c).userId, actorRole: 'client', targetType: 'assist', targetId: row.id, clientId: cl.id, details: { kind: row.kind, from: row.status } });
      await onChangeAssistEnded(deps, tx, row);
      return x!;
    });
    return c.json(await changeAssistView(deps, deps.db, u));
  });

  // ================= §28.K.1 fees =================
  r.get('/fees', async (c) => c.json(await feesView(deps, deps.db, await client(c))));
  r.post('/fees/:id/pay', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ platform: z.enum(['web', 'android', 'ios']) }));
    return c.json(await startFeePayment(deps, cl, param(c, 'id'), b.platform));
  });

  // ================= §28.K.2 monthly check-in =================
  r.get('/checkins/current', async (c) => {
    const cl = await client(c);
    const row = await currentCheckin(deps.db, cl.id);
    return c.json(row ? await checkinView(deps, deps.db, cl, row) : null);
  });
  const checkinAnswer = z.strictObject({
    item: z.enum(CHECKIN_ITEMS),
    since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    weeklyHours: z.enum(CHECKIN_WEEKLY_HOURS).optional(),
    choice: z.enum(['szekhely', 'telephely']).optional(),
    how: z.enum(CHECKIN_HOW).optional(),
    employer: z.enum(EMPLOYER_ANSWERS).optional(),
    change: changeDataSchema.optional(),
    text: z.string().trim().max(500).optional(),
  });
  r.post('/checkins/:id', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.union([z.strictObject({ result: z.literal('nem_valtozott') }), z.strictObject({ result: z.literal('valtozott'), answers: z.array(checkinAnswer).min(1).max(10) })]));
    const row = await deps.db.transaction((tx) => answerCheckin(deps, tx, cl, param(c, 'id'), b, { userId: auth(c).userId }));
    return c.json(await checkinView(deps, deps.db, cl, row));
  });

  // ================= §28.K.3 annual closing =================
  r.get('/annual', async (c) => {
    const cl = await client(c);
    const year = parseQuery(c, yearQ).year ?? (await defaultAnnualYear(deps.db, cl.id, thisYear()));
    return c.json(await annualView(deps, deps.db, cl, year));
  });
  r.put('/annual/:id/answers', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ answers: annualAnswersSchema }));
    return c.json(await deps.db.transaction((tx) => saveAnnualAnswers(deps, tx, cl, param(c, 'id'), b.answers, auth(c).userId)));
  });
  r.post('/annual/:id/submit', async (c) => {
    const cl = await client(c);
    return c.json(await deps.db.transaction((tx) => submitAnnual(deps, tx, cl, param(c, 'id'), auth(c).userId)));
  });
  r.post('/annual/:id/approve', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ hash: z.string().regex(/^[0-9a-f]{64}$/) }));
    return c.json(await deps.db.transaction((tx) => approveAnnual(deps, tx, cl, param(c, 'id'), b.hash, { userId: auth(c).userId, ipHmac: c.get('ipHmac'), ua: c.get('ua') })));
  });

  // ================= §28.K.7 employees / EFO =================
  r.put('/onboarding/employer', async (c) => {
    const cl = await client(c);
    const b = await readJson(c, z.strictObject({ answer: z.enum(EMPLOYER_ANSWERS) }));
    await setEmployerAnswer(deps, deps.db, cl, b.answer, 'onboarding', auth(c).userId);
    await auditC(c, deps.db, 'employer.answered_route', { targetType: 'client', targetId: cl.id, clientId: cl.id });
    return c.json(employerView(await employerRow(deps.db, cl.id)));
  });
}

/** The client's regime this year is KATA (client_tax_profiles.regime). */
export async function isKata(db: DbOrTx, clientId: string, year: number): Promise<boolean> {
  const [tp] = await db.select({ regime: clientTaxProfiles.regime }).from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, clientId), eq(clientTaxProfiles.year, year))).limit(1);
  return tp?.regime === 'kata';
}

/** SPEC §28 / §28.K additions of GET /client/home (null while restricted or without a profile). */
export async function augmentHome(deps: Deps, cl: ClientRow, home: ClientHome, today: string): Promise<void> {
  const db = deps.db;
  const year = Number(today.slice(0, 4));
  home.lock = await serviceLockView(deps, cl);
  home.pause = await pauseView(deps, db, cl.id);
  if (isRestricted(cl)) {
    home.reserve = null;
    home.earnings = null;
    home.allowancesHint = null;
    return;
  }
  // KATA (SPEC §28.K.11): the KATA engine branch and views are not built yet – never show átalány numbers to a katás
  // client (k6c review: Gréta saw SZJA, "Havi fix járulék" and per-invoice reserves). A plain "{firstName} számolja" state.
  if (await isKata(db, cl.id, year)) {
    const params = await accountantParams(db, cl.accountantId);
    home.reserve = null;
    home.earnings = null;
    home.twoNumbers = {
      revenueHuf: home.revenueByMonth.reduce((a, m) => a + m.amountHuf, 0),
      revenueSub: '',
      taxesHuf: null,
      taxesSub: `${await deps.content.get('fooldal.kata_taxes')} · ${await deps.content.render('fooldal.kata_taxes_sub', params)}`,
    };
    // no átalány estimate: no "Hogyan jött ki?" (periodId) and no estimate letter
    if (home.hero.state === 'becsles') {
      home.hero = { state: 'nincs_fizetendo', note: await deps.content.render('fooldal.kata_hero_note', params) };
      home.letter = null;
      home.paymentItems = [];
    }
    home.limits.adomentes = { ...home.limits.adomentes, reached: false, sentence: '', afterText: null };
    home.limits.kata = true;
    home.allowancesHint = null;
  } else {
    try {
      home.reserve = await reserveCard(deps, db, cl, today, home.hero);
    } catch {
      home.reserve = null;
    }
    try {
      const e = await earnings(deps, db, cl, year, today);
      home.earnings = e?.card ?? null;
      if (e) {
        const refund = e.view.refund?.huf ?? 0;
        home.twoNumbers = {
          revenueHuf: e.card.ytdRevenueHuf,
          revenueSub: '',
          taxesHuf: e.card.ytdTaxesHuf,
          taxesSub: refund > 0 ? await deps.content.render('fooldal.taxes_sub_refund', { refund: fmt(kb1000(refund)) }) : await deps.content.get('fooldal.taxes_sub'),
        };
      }
    } catch {
      home.earnings = null;
    }
    // "Az adómentes részt … elérted. Azóta fizetsz SZJA-előleget" is not true with an approved 25 év alatti / anyák
    // allowance: say what the allowance does (k6c review, Bálint)
    try {
      const b = home.limits.adomentes.reached ? await earningsBasis(db, cl, year, today) : null;
      const al = b?.result.allowances;
      if (b && al && al.szjaSavedHuf > 0) {
        const szjaYtd = b.result.quarters.reduce((a, q) => a + q.szjaAdvanceHuf, 0);
        home.limits.adomentes.afterText = await deps.content.render(szjaYtd === 0 ? 'fooldal.adomentes_allowance_none' : 'fooldal.adomentes_allowance_less', { limit: fmt(home.limits.adomentes.limitHuf) });
      }
    } catch {
      /* the default line stays */
    }
    home.allowancesHint = await allowancesHint(db, cl, year);
  }
  const ch = await currentCheckin(db, cl.id);
  home.checkin = ch && ch.status === 'nyitott' ? await checkinView(deps, db, cl, ch) : null;
  if (today.slice(5) >= '01-05' && today.slice(5) <= '06-30' && (await defaultAnnualYear(db, cl.id, year)) === year - 1) {
    const ann = await annualView(deps, db, cl, year - 1).catch(() => null);
    home.annual = ann && ann.status !== 'nem_indult' && ann.status !== 'kesz' ? ann : null;
  }
  void answersRow;
}

/** SPEC §28.1.5: the reserve of each listed invoice (only for active clients). */
export async function invoiceReserves(deps: Deps, cl: ClientRow, ids: string[]) {
  if (isRestricted(cl)) return new Map();
  // KATA: no átalány reserve per invoice (k6c review) – the KATA invoice line comes with the KATA view
  if (await isKata(deps.db, cl.id, Number(todayBudapest(deps.now()).slice(0, 4)))) return new Map();
  return reservesForInvoices(deps, deps.db, cl.id, ids);
}
