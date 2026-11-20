// SPEC §27.12 K3 (owner order 3, 11-19): "Intézzük helyetted" – the assisted path. The client asks (a callback with a
// type), the team calls, our accountant files the UJEGYKE as the client's meghatalmazott with HIS OWN login, the client
// approves in ONYA within 4 days (reminders, staff alert, auto-expiry), gives the final OK in the app (consent + PDF),
// the accountant files the EV bejelentés, another person checks it (four eyes), the adószám ends the request.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ASSIST_CHECK_ITEMS, REGISTRATION_CHECK_ITEMS } from '../src/_shared/enums.js';
import { accountants, assistRequests, auditLog, businessRegistrations, callbackRequests, clients, documents, notifications, onboardingSteps } from '../src/db/schema.js';
import { jobAssistApprovals } from '../src/jobs-tulaj1119.js';
import { dispatchPending } from '../src/notify/notify.js';
import { newClient, pdfBytes, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let marta: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;

const rolad = { firstName: 'Marika', lastName: 'Kiss', phone: '+36 30 555 0199', adoazonositoJel: '8123456786', address: { zip: '3530', city: 'Miskolc', line: 'Próba utca 12.' } };
const pages = [
  { declarations: { noExclusion: true, singleBusiness: true }, revenueBand: 'max_12m' },
  { activities: [{ key: 'grafika', main: true }] },
  { seat: { kind: 'lakcim' } },
  { workKind: 'fofoglalkozas', euPartner: 'nem', hasSeparateBusinessAccount: true },
  { startPlan: 'mielobb' },
];
const HIVAS = [...ASSIST_CHECK_ITEMS.hivas];
const UJEGYKE = [...ASSIST_CHECK_ITEMS.ujegyke];
const BEJELENTES = [...ASSIST_CHECK_ITEMS.bejelentes];

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  marta = await staff(h, 'accountant', 'marta@demo.kezjegy.test', { firstName: 'Márta' });
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
});
afterAll(async () => h.close());

async function starter(email: string) {
  const c = { ...(await newClient(h, email, { first: 'Marika', last: 'Kiss' })), email };
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  expect((await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'inditas' } })).status).toBe(200);
  expect((await h.json('PUT', '/client/profile', { token: c.token, body: rolad })).status).toBe(200);
  return c;
}
async function contract(token: string) {
  const items = ['aszf', 'adatkezeles', 'megbizasi_szerzodes'].map((d) => ({ docType: d, version: h.deps.legal.current(d as 'aszf').version }));
  expect((await h.json('POST', '/me/consents', { token, body: { items } })).status).toBe(204);
}
async function questionnaire(token: string) {
  for (const p of pages) expect((await h.json('PUT', '/client/business-registration', { token, body: p })).status).toBe(200);
  expect((await h.json('POST', '/client/business-registration/submit', { token })).status).toBe(200);
}
/** After a clock jump the access tokens are expired: sign everybody in again. */
async function relog(...clientsToo: { token: string; email: string }[]) {
  for (const [who, email] of [[bence, 'bence@demo.kezjegy.test'], [marta, 'marta@demo.kezjegy.test'], [anna, 'anna@demo.kezjegy.test'], [admin, 'admin@demo.kezjegy.test']] as const) {
    const r = await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'panel' } });
    (who as { token: string }).token = r.body.accessToken;
  }
  for (const c of clientsToo) {
    const r = await h.json('POST', '/auth/login', { body: { email: c.email, password: PW, clientKind: 'native' } });
    c.token = r.body.accessToken;
  }
}
const notifs = async (userId: string, kind: string) => h.deps.db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.kind, kind as 'assist_task')));

describe('K3.1–K3.5 – the EV happy path', () => {
  let c: Awaited<ReturnType<typeof starter>>;
  let assistId: string;
  let regId: string;

  it('POST /client/assist creates the assist + a callback with the assisted topic; a second request is 409 assist_already_open', async () => {
    c = await starter('marika@demo.kezjegy.test');
    const r = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'vallalkozas_bejelentes', source: 'helyettunk_vallalkozas', note: 'Nem értek a számítógéphez.' } });
    expect(r.status).toBe(201);
    expect(r.body.assist.status).toBe('visszahivas_kerve');
    expect(r.body.assist.statusText).toBe('Visszahívást kértél. Kollégánk 24–48 órán belül hív.');
    expect(r.body.callback.topic).toBe('vallalkozas_bejelentes_helyettem');
    expect(r.body.callback.assistId).toBe(r.body.assist.id);
    assistId = r.body.assist.id;
    const again = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'vallalkozas_bejelentes', source: 'helyettunk_vallalkozas' } });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('assist_already_open');
    expect(again.body.assist.id).toBe(assistId);
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(st.body.registrationMode).toBe('segitett');
    expect(st.body.journey.variant).toBe('inditas_segitett');
    expect(st.body.journey.steps.map((x: { key: string }) => x.key)).toEqual(['ut', 'visszahivas', 'adatok', 'kedvezmenyek', 'kerdoiv', 'szerzodes', 'meghatalmazas', 'vegso_jovahagyas', 'bejelentes', 'kamara', 'azonositas', 'elofizetes', 'nav_bekotes']); // SPEC §28.3.4 row
    expect(st.body.steps.map((x: { step: string }) => x.step).slice(0, 5)).toEqual(['fiok', 'adatok', 'szerzodes', 'meghatalmazas', 'vallalkozas_inditas']);
    expect(st.body.assists[0].id).toBe(assistId);
    const [reg] = await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, c.clientId));
    regId = reg!.id;
  });

  it('agreed: a missing item → 400, all items → egyeztetve, the client and the accountant are told', async () => {
    const bad = await h.json('POST', `/team/assists/${assistId}/agreed`, { token: anna.token, body: { items: HIVAS.slice(1) } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('assist_checklist_incomplete');
    expect(Object.keys(bad.body.error.fields)).toEqual([HIVAS[0]]);
    const ok = await h.json('POST', `/team/assists/${assistId}/agreed`, { token: anna.token, body: { items: HIVAS } });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('egyeztetve');
    // 11-19 javítás: the contract is not accepted yet – the client is the blocker, not our accountant
    expect(ok.body.ball).toBe('ugyfel');
    expect(ok.body.allowedActions).toEqual(['lezaras']);
    expect((await notifs(c.userId, 'assist_started')).length).toBe(1);
    const task = await notifs(bence.userId, 'assist_task');
    expect(task[0]!.title).toBe('Küldd be a meghatalmazást: Kiss Marika');
    expect(task[0]!.body).toContain('Egyéni vállalkozói nyilvántartással kapcsolatos ügyek');
  });

  it('ujegyke-filed: csapat 403, before the contract 409, then meghatalmazas_bekuldve with due = filing + 3 days', async () => {
    const cs = await h.json('POST', `/team/assists/${assistId}/ujegyke-filed`, { token: anna.token, body: { items: UJEGYKE, jogcim: '9' } });
    expect(cs.status).toBe(403);
    // 11-19 javító kör 2: an admin who is not the client's accountant never records a NAV filing either
    const ad = await h.json('POST', `/team/assists/${assistId}/ujegyke-filed`, { token: admin.token, body: { items: UJEGYKE, jogcim: '9' } });
    expect(ad.status).toBe(403);
    expect(ad.body.error.message).toBe('Ezt csak Bence küldheti be, a saját belépésével.');
    const other = await h.json('POST', `/team/assists/${assistId}/ujegyke-filed`, { token: marta.token, body: { items: UJEGYKE, jogcim: '9' } });
    expect(other.status).toBe(404);
    const early = await h.json('POST', `/team/assists/${assistId}/ujegyke-filed`, { token: bence.token, body: { items: UJEGYKE, jogcim: '9' } });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe('assist_wrong_status');
    expect(early.body.error.message).toBe('Előbb az ügyfélnek el kell fogadnia a szerződést.');
    await contract(c.token);
    const r = await h.json('POST', `/team/assists/${assistId}/ujegyke-filed`, { token: bence.token, body: { items: UJEGYKE, jogcim: '9' } });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('meghatalmazas_bekuldve');
    expect(r.body.approvalDueOn).toBe('2026-11-22');
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(st.body.steps.find((x: { step: string }) => x.step === 'meghatalmazas').status).toBe('ugyfelre_var');
    const row = st.body.journey.steps.find((x: { key: string }) => x.key === 'meghatalmazas');
    expect(row.state).toBe('most');
    expect(row.dueText).toBe('november 22-ig (még 3 nap)');
    expect(row.action.route).toBe('/bekotes/meghatalmazas/jovahagyas');
    expect(st.body.journey.currentKey).toBe('meghatalmazas');
    const filed = await notifs(c.userId, 'assist_mh_filed');
    expect(filed[0]!.title).toBe('Hagyd jóvá a meghatalmazást november 22-ig');
    // the approval guide is open now (and only now)
    const g = await h.json('GET', '/client/guides/meghatalmazas_jovahagyas', { token: c.token });
    expect(g.status).toBe(200);
    expect(g.body.video).toBeNull();
    expect(g.body.approvalDue.dueText).toBe('november 22-ig');
  });

  it('K3.2 reminders: +24 h first, due day 09:00 last day, 12:00 staff once; push waits for 08:00', async () => {
    h.clock.set('2026-11-20T09:30:00Z'); // +24.5 h, 10:30 Budapest
    expect((await jobAssistApprovals(h.deps)).elso).toBe(1);
    expect((await jobAssistApprovals(h.deps)).elso).toBe(0);
    h.clock.set('2026-11-22T06:30:00Z'); // due day 07:30 Budapest: nothing yet
    let r = await jobAssistApprovals(h.deps);
    expect(r.utolsoNap + r.staff).toBe(0);
    h.clock.set('2026-11-22T08:05:00Z'); // 09:05 Budapest
    r = await jobAssistApprovals(h.deps);
    expect(r.utolsoNap).toBe(1);
    h.clock.set('2026-11-22T11:05:00Z'); // 12:05 Budapest
    r = await jobAssistApprovals(h.deps);
    expect(r.staff).toBe(1);
    expect((await jobAssistApprovals(h.deps)).staff).toBe(0);
    const rem = await notifs(c.userId, 'assist_mh_reminder');
    expect(rem.map((x) => x.title)).toEqual(['Még nem hagytad jóvá a meghatalmazást', 'Ma hagyd jóvá a meghatalmazást']);
    expect((await notifs(anna.userId, 'assist_approval_overdue')).length).toBe(1);
    expect((await notifs(bence.userId, 'assist_approval_overdue')).length).toBe(1);
    // a message created at night keeps its push until 08:00
    h.clock.set('2026-11-22T22:30:00Z');
    await h.deps.db.update(assistRequests).set({ approvalReminders: 2, lastReminderAt: new Date('2026-11-21T10:00:00Z') }).where(eq(assistRequests.id, assistId));
    r = await jobAssistApprovals(h.deps);
    const night = (await notifs(c.userId, 'assist_mh_reminder')).at(-1)!;
    expect((night.data as { pushNotBefore?: string }).pushNotBefore).toBe('2026-11-23T07:00:00.000Z');
    await dispatchPending(h.deps);
    const [after] = await h.deps.db.select().from(notifications).where(eq(notifications.id, night.id));
    expect(after!.pushSentAt).toBeNull();
    expect(after!.emailSentAt).not.toBeNull();
  });

  it('K3.2 expiry: filing + 4 days + 2 h without approval → lejart, client and accountant told; re-filing starts a new window', async () => {
    h.clock.set('2026-11-23T11:00:00Z');
    await relog(c);
    const r = await jobAssistApprovals(h.deps);
    expect(r.expired).toBe(1);
    const [row] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.id, assistId));
    expect(row!.status).toBe('meghatalmazas_lejart');
    expect(row!.expiredCount).toBe(1);
    expect((await notifs(c.userId, 'assist_mh_expired')).length).toBe(1);
    expect((await notifs(bence.userId, 'assist_task')).some((x) => x.title === 'Küldd be újra a meghatalmazást: Kiss Marika')).toBe(true);
    const again = await h.json('POST', `/team/assists/${assistId}/ujegyke-filed`, { token: bence.token, body: { items: UJEGYKE, jogcim: '9' } });
    expect(again.status).toBe(200);
    expect(again.body.approvalDueOn).toBe('2026-11-26');
  });

  it('K3.3 "Jóváhagytam" → jovahagyva; accountant mh-live → meghatalmazas_el and the step is kesz', async () => {
    const ap = await h.json('POST', `/client/assist/${assistId}/approved`, { token: c.token });
    expect(ap.status).toBe(200);
    expect(ap.body.status).toBe('meghatalmazas_jovahagyva');
    expect((await h.json('POST', `/team/assists/${assistId}/mh-live`, { token: anna.token, body: {} })).status).toBe(403);
    const live = await h.json('POST', `/team/assists/${assistId}/mh-live`, { token: bence.token, body: {} });
    expect(live.status).toBe(200);
    expect(live.body.status).toBe('meghatalmazas_el');
    const [s] = await h.deps.db.select().from(onboardingSteps).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, 'meghatalmazas')));
    expect(s!.status).toBe('kesz');
    expect((await notifs(c.userId, 'assist_consent_needed')).length).toBe(1);
  });

  it('K3.4 consent: stale hash 409, pending ÖVTJ 409, valid → ugyfel_engedelyezte + PDF; a later edit invalidates it', async () => {
    await questionnaire(c.token);
    // a free-text activity needs its ÖVTJ line first
    await h.json('PUT', '/client/business-registration', { token: c.token, body: { activities: [{ key: null, label: 'Babaúszás-oktatás', main: true }] } });
    let sum = await h.json('GET', `/client/assist/${assistId}/consent`, { token: c.token });
    expect(sum.status).toBe(200);
    const pend = await h.json('POST', `/client/assist/${assistId}/consent`, { token: c.token, body: { hash: sum.body.hash, declaration: true, instruction: true } });
    expect(pend.status).toBe(409);
    await h.json('PUT', '/client/business-registration', { token: c.token, body: { activities: [{ key: 'grafika', main: true }] } });
    sum = await h.json('GET', `/client/assist/${assistId}/consent`, { token: c.token });
    // the list activity has no exact ÖVTJ line yet: the team writes it, then the client may give the OK
    expect(sum.body.canConsent).toBe(false);
    expect((await h.json('PATCH', `/team/registrations/${regId}`, { token: anna.token, body: { ovtjKodok: [{ index: 0, ovtjKod: '741001', ovtjNev: 'Divat-, ipari formatervezés' }] } })).status).toBe(200);
    sum = await h.json('GET', `/client/assist/${assistId}/consent`, { token: c.token });
    expect(sum.body.canConsent).toBe(true);
    expect(sum.body.blocks[6].lines[0]).toMatch(/^A beküldés napja, várhatóan november \d+\. Előre/);
    expect(sum.body.blocks.map((b: { key: string }) => b.key)).toEqual(['rolad', 'szekhely', 'telephely', 'tevekenyseg', 'munkavegzes', 'adozas', 'kezdes']);
    expect(sum.body.blocks[0].lines[1]).toBe('Adóazonosító jel: •••••••786');
    expect(sum.body.instructionText).toContain('Kovács Bence');
    const stale = await h.json('POST', `/client/assist/${assistId}/consent`, { token: c.token, body: { hash: '0'.repeat(64), declaration: true, instruction: true } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('assist_consent_stale');
    const ok = await h.json('POST', `/client/assist/${assistId}/consent`, { token: c.token, body: { hash: sum.body.hash, declaration: true, instruction: true } });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('ugyfel_engedelyezte');
    expect(ok.body.consent.valid).toBe(true);
    const docs = await h.deps.db.select().from(documents).where(and(eq(documents.clientId, c.clientId), eq(documents.category, 'szerzodes_alairt')));
    expect(docs.some((d) => d.title.startsWith('Utasítás a vállalkozásod bejelentésére'))).toBe(true);
    // a team ÖVTJ edit after the OK needs a new OK
    const t = await h.json('PATCH', `/team/registrations/${regId}`, { token: anna.token, body: { ovtjKodok: [{ index: 0, ovtjKod: '741002', ovtjNev: 'Grafikai tervezés' }] } });
    expect(t.status).toBe(200);
    const [row] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.id, assistId));
    expect(row!.consentValid).toBe(false);
    expect(row!.status).toBe('meghatalmazas_el');
    expect((await notifs(c.userId, 'assist_consent_needed')).some((x) => x.title === 'Engedélyezd újra a bejelentést')).toBe(true);
    sum = await h.json('GET', `/client/assist/${assistId}/consent`, { token: c.token });
    expect((await h.json('POST', `/client/assist/${assistId}/consent`, { token: c.token, body: { hash: sum.body.hash, declaration: true, instruction: true } })).body.status).toBe('ugyfel_engedelyezte');
    // the client cannot upload his own NAV értesítés while we file it
    const fd = new FormData();
    fd.append('filedOn', '2026-11-23');
    fd.append('channel', 'dap');
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'e.pdf');
    const own = await h.json('POST', '/client/business-registration/filed', { token: c.token, form: fd });
    expect(own.status).toBe(409);
    expect(own.body.error.code).toBe('assist_wrong_status');
  });

  it('K3.5 ev-filed → beadva (channel meghatalmazott); the same accountant cannot check (403); csapat check + adószám → kesz', async () => {
    const fd = new FormData();
    fd.append('filedOn', '2026-11-23');
    fd.append('items', JSON.stringify(BEJELENTES));
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'ertesites.pdf');
    const r = await h.json('POST', `/team/assists/${assistId}/ev-filed`, { token: bence.token, form: fd });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('bejelentes_bekuldve');
    const [reg] = await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.id, regId));
    expect(reg!.status).toBe('beadva');
    expect(reg!.filedChannel).toBe('meghatalmazott');
    expect((await notifs(c.userId, 'assist_ev_filed')).length).toBe(1);
    expect((await notifs(anna.userId, 'assist_task')).some((x) => x.title === 'Nézd át: Kiss Marika bejelentése')).toBe(true);
    // the client may change nothing any more
    expect((await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } })).status).toBe(409);
    // four eyes: Bence filed it – he never checks it (an accountant has no check route at all: 404)
    const self = await h.json('POST', `/team/registrations/${regId}/check`, { token: bence.token, body: { items: [...REGISTRATION_CHECK_ITEMS] } });
    expect([403, 404]).toContain(self.status);
    const chk = await h.json('POST', `/team/registrations/${regId}/check`, { token: anna.token, body: { items: [...REGISTRATION_CHECK_ITEMS] } });
    expect(chk.status).toBe(200);
    const ad = await h.json('POST', `/team/registrations/${regId}/adoszam`, { token: anna.token, body: { adoszam: '12345676-1-41', registeredOn: '2026-11-23' } });
    expect(ad.status).toBe(200);
    expect(ad.body.status).toBe('kesz');
    const [row] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.id, assistId));
    expect(row!.status).toBe('kesz');
    const [reg2] = await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.id, regId));
    expect(reg2!.chamberDueOn).toBe('2026-11-30');
    const done = await notifs(c.userId, 'registration_done');
    expect(done[0]!.body).toBe('Rögzítettük az adószámodat. Jöhet a következő lépés. Ne felejtsd el a kamarai regisztrációt: november 30-ig.');
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    const kam = st.body.journey.steps.find((x: { key: string }) => x.key === 'kamara');
    expect(kam.state).toBe('most');
    // 11-19 javító kör 2: the finished request keeps its call row done – no "Visszahívás · Csapatunk · Később"
    expect(st.body.journey.steps.find((x: { key: string }) => x.key === 'visszahivas').state).toBe('kesz');
    expect(st.body.journey.steps.filter((x: { state: string; actor: string }) => x.state === 'kesobb' && x.actor === 'csapat')).toEqual([]);
    const ch = await h.json('POST', '/client/business-registration/chamber', { token: c.token, body: { done: true } });
    expect(ch.status).toBe(200);
    expect(ch.body.chamber.doneAt).toBeTruthy();
  });

  it('the ev_filed action is audited', async () => {
    const [x] = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.action, 'assist.ev_filed'), eq(auditLog.targetId, assistId)));
    expect(x).toBeTruthy();
  });
});

describe('K3.6–K3.8 – meghatalmazás only, cancel, roles', () => {
  it('K3.6 Dávid (van): the old app call onya_konyvelo creates the same assist; the approval guide is closed until filed', async () => {
    const c = await newClient(h, 'david@demo.kezjegy.test', { first: 'Dávid', last: 'Molnár' });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } });
    // before the contract the meghatalmazás is locked only by the contract – the request may come first
    const r = await h.json('POST', '/client/onboarding/meghatalmazas', { token: c.token, body: { method: 'onya_konyvelo' } });
    expect(r.status).toBe(200);
    expect(r.body.assists[0].kind).toBe('meghatalmazas');
    expect(r.body.assists[0].status).toBe('visszahivas_kerve');
    expect((await h.json('GET', '/client/guides/meghatalmazas_jovahagyas', { token: c.token })).status).toBe(409);
    const ev = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'vallalkozas_bejelentes', source: 'helyettunk_vallalkozas' } });
    expect(ev.status).toBe(409);
    expect(ev.body.error.code).toBe('path_required');
  });

  it('K3.7 cancel before the UJEGYKE → visszavonva, mode onallo, the callback is cancelled too', async () => {
    const c = await starter('ilona@demo.kezjegy.test');
    const r = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'vallalkozas_bejelentes', source: 'helyettunk_vallalkozas' } });
    const x = await h.json('POST', `/client/assist/${r.body.assist.id}/cancel`, { token: c.token, body: {} });
    expect(x.status).toBe(200);
    expect(x.body.status).toBe('visszavonva');
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(st.body.registrationMode).toBe('onallo');
    expect(st.body.journey.variant).toBe('inditas_onallo');
    const [cb] = await h.deps.db.select().from(callbackRequests).where(eq(callbackRequests.id, r.body.callback.id));
    expect(cb!.status).toBe('visszavonva');
  });

  it('K3.7 cancel after the UJEGYKE → converted to kind meghatalmazas; inditas → van with an open EV assist converts too', async () => {
    const c = await starter('convert@demo.kezjegy.test');
    await contract(c.token);
    const r = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'vallalkozas_bejelentes', source: 'helyettunk_vallalkozas' } });
    const id = r.body.assist.id;
    await h.json('POST', `/team/assists/${id}/agreed`, { token: bence.token, body: { items: HIVAS } });
    expect((await h.json('POST', `/team/assists/${id}/ujegyke-filed`, { token: bence.token, body: { items: UJEGYKE, jogcim: '9' } })).status).toBe(200);
    h.clock.advance(60_000);
    const sw = await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van' } });
    expect(sw.status).toBe(200);
    const [row] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.id, id));
    expect(row!.kind).toBe('meghatalmazas');
    expect(row!.status).toBe('meghatalmazas_bekuldve');
  });

  it('K3.8 roles: another accountant 404, csapat gets the masked tax id only, the accountant the full one (audited)', async () => {
    const [row] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.status, 'meghatalmazas_bekuldve')).limit(1);
    expect((await h.json('GET', `/team/assists/${row!.id}`, { token: marta.token })).status).toBe(404);
    const cs = await h.json('GET', `/team/assists/${row!.id}`, { token: anna.token });
    expect(cs.status).toBe(200);
    expect(cs.body.filingData.adoazonositoJel).toBeNull();
    expect(cs.body.filingData.adoazonositoJelMasked).toBe('•••••••786');
    const before = (await h.deps.db.select().from(auditLog).where(and(eq(auditLog.action, 'assist.data_viewed'), eq(auditLog.targetId, row!.id)))).length;
    const acc = await h.json('GET', `/team/assists/${row!.id}`, { token: bence.token });
    expect(acc.body.filingData.adoazonositoJel).toBe('8123456786');
    expect(acc.body.filingData.jogcim).toBe('9');
    const viewed = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.action, 'assist.data_viewed'), eq(auditLog.targetId, row!.id)));
    expect(viewed.length).toBe(before + 1);
    const list = await h.json('GET', '/team/assists?filter=mind', { token: marta.token });
    expect(list.body.items.length).toBe(0);
    const sum = await h.json('GET', '/team/summary', { token: anna.token });
    expect(sum.body.assists.open).toBeGreaterThan(0);
  });

  it('K3.8 ASSIST_EV_ENABLED=false: 409 assist_disabled with the disabled text', async () => {
    const h2 = await setup({ now: '2026-11-19T09:00:00Z', env: { ASSIST_EV_ENABLED: 'false' } });
    try {
      const c = await newClient(h2, 'off@demo.kezjegy.test');
      await h2.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'inditas' } });
      const r = await h2.json('POST', '/client/assist', { token: c.token, body: { kind: 'vallalkozas_bejelentes', source: 'helyettunk_vallalkozas', phone: '+36301112233' } });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe('assist_disabled');
      expect(r.body.error.message).toContain('most nem tudjuk helyetted intézni');
    } finally {
      await h2.close();
    }
  });
});

describe('K3.9 – never credentials', () => {
  it('no request schema, column or log line holds a client KAÜ username / password / code', () => {
    const hits: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (f !== '_shared') walk(p);
        } else if (p.endsWith('.ts')) {
          const s = readFileSync(p, 'utf8');
          if (/ugyfelkapu\w*\s*:\s*z\.|ugyfelkapu.*(jelszo|password)|dap.*(pin|kod)\s*:\s*z\.|ugyfelkapuJelszo|kauPassword|dapPin/i.test(s)) hits.push(p);
        }
      }
    };
    walk(join(__dirname, '..', 'src'));
    expect(hits).toEqual([]);
  });
});
