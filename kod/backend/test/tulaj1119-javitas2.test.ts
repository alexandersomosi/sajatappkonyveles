// 11-19 javító kör 2 (round-2 findings of the owner-order checks): journey rows say who works on WHAT (the self-service
// filing stays "Te" while the team writes the ÖVTJ line; the adószám wait is the NAV's), the hub does not say "Kész az
// útmutatód" while the line is pending, an undo leaves no "Útvonalat váltott" ghost in the pipeline, the staff same-path
// call either clears the adószám or says 409, a late own step gets a no-date "Késünk vele" line and a daily reminder,
// claiming the request also claims its call, and the team's card shows the client's own next step.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ASSIST_ACTION_ROLES, ASSIST_CHECK_ITEMS } from '../src/_shared/enums.js';
import { assistRequests, auditLog, businessRegistrations, callbackRequests, clients, notifications, onboardingSteps } from '../src/db/schema.js';
import { jobAssistOverdueReminders } from '../src/jobs-tulaj1119.js';
import { newClient, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;

const rolad = { firstName: 'Gábor', lastName: 'Loop', phone: '+36 30 555 0142', adoazonositoJel: '8123456786', address: { zip: '6720', city: 'Szeged', line: 'Minta utca 3.' } };
const pages = [
  { declarations: { noExclusion: true, singleBusiness: true }, revenueBand: 'max_12m' },
  { activities: [{ key: 'grafika', main: true }] },
  { seat: { kind: 'lakcim' } },
  { workKind: 'fofoglalkozas', euPartner: 'nem', hasSeparateBusinessAccount: true },
  { startPlan: 'mielobb' },
];
type Row = { key: string; actor: string; state: string; statusText: string; title: string; action: { label: string; route: string } | null };

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
});
afterAll(async () => h.close());

async function client(email: string) {
  const c = { ...(await newClient(h, email, { first: 'Gábor', last: 'Loop' })), email };
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  return c;
}
const status = (token: string, businessStatus: 'van' | 'inditas', extra: Record<string, unknown> = {}) =>
  h.json('PUT', '/client/onboarding/business-status', { token, body: { businessStatus, ...(businessStatus === 'inditas' ? { mode: 'onallo' } : {}), ...extra } });
const row = (j: { steps: Row[] }, key: string) => j.steps.find((x) => x.key === key)!;
async function relog(...cs: { token: string; email: string }[]) {
  for (const [who, email] of [[bence, 'bence@demo.kezjegy.test'], [anna, 'anna@demo.kezjegy.test']] as const) {
    (who as { token: string }).token = (await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'panel' } })).body.accessToken;
  }
  for (const c of cs) c.token = (await h.json('POST', '/auth/login', { body: { email: c.email, password: PW, clientKind: 'native' } })).body.accessToken;
}

describe('journey rows: who waits for whom', () => {
  it('self-service starter after the kérdőív: the filing row stays "Te", names the team\'s work and opens the guide; the hub is not "Kész"', async () => {
    const c = await client('onallo@demo.kezjegy.test');
    expect((await status(c.token, 'inditas')).status).toBe(200);
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: rolad })).status).toBe(200);
    for (const p of pages) expect((await h.json('PUT', '/client/business-registration', { token: c.token, body: p })).status).toBe(200);
    const sub = await h.json('POST', '/client/business-registration/submit', { token: c.token });
    expect(sub.status).toBe(200);
    expect(sub.body.activityPending).toBe(true);
    expect(sub.body.statusText).toBe('Már átnézheted az útmutatót. A tevékenység-sorodat még megírjuk, utána bejelentheted.'); // k8 (k7b remnant, tulaj 11-20): no time promise; the one allowed callback sentence verbatim
    const j = (await h.json('GET', '/client/onboarding', { token: c.token })).body.journey;
    const b = row(j, 'bejelentes');
    expect(b.actor).toBe('te');
    expect(b.state).toBe('var');
    expect(b.statusText).toBe('Előbb megírjuk a tevékenység-sorodat (Csapatunk)');
    expect(b.action).toEqual({ label: 'Útmutató', route: '/bekotes/vallalkozas/utmutato' });
    // the waiting card still names the team
    expect(j.waiting.key).toBe('tevekenyseg_sor');
    expect(j.waiting.actor).toBe('csapat');
  });

  it('waiting for the adószám: the row is "Adószámod · NAV", not "Átnézzük"', async () => {
    const c = await client('adoszamra@demo.kezjegy.test');
    expect((await status(c.token, 'inditas')).status).toBe(200);
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: rolad })).status).toBe(200);
    for (const p of pages) expect((await h.json('PUT', '/client/business-registration', { token: c.token, body: p })).status).toBe(200);
    expect((await h.json('POST', '/client/business-registration/submit', { token: c.token })).status).toBe(200);
    await h.deps.db.update(businessRegistrations).set({ status: 'ellenorizve', filedAt: h.deps.now(), filedOn: '2026-11-19', checkedAt: h.deps.now() }).where(eq(businessRegistrations.clientId, c.clientId));
    const j = (await h.json('GET', '/client/onboarding', { token: c.token })).body.journey;
    const a = row(j, 'atnezes');
    expect(a.actor).toBe('nav');
    expect(a.title).toBe('Adószámod');
    expect(a.statusText).toBe('Átnéztük az értesítést. Most a NAV adja meg az adószámodat');
  });
});

describe('order 2 – an undo is no branch change for the team', () => {
  it('van → Még nincs → Visszavonom leaves no "Útvonalat váltott" row in the pipeline', async () => {
    const c = await client('undo@demo.kezjegy.test');
    expect((await status(c.token, 'van')).status).toBe(200);
    expect((await status(c.token, 'inditas')).status).toBe(200);
    const back = await h.json('PUT', '/client/onboarding/business-status', { token: c.token, body: { businessStatus: 'van', undo: true } });
    expect(back.status).toBe(200);
    const [reg] = await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, c.clientId));
    expect(reg!.status).toBe('elallt');
    expect(reg!.withdrawNote).toBe('visszavonta');
    const list = await h.json('GET', '/team/registrations?status=elallt', { token: anna.token });
    expect(list.status).toBe(200);
    expect(list.body.items.some((x: { client: { id: string } }) => x.client.id === c.clientId)).toBe(false);
    const card = await h.json('GET', `/team/clients/${c.clientId}`, { token: anna.token });
    expect(card.status).toBe(200);
    expect(card.body.registration).toBeNull();
    // the team sees the client's own next step (the app's "Most ez jön")
    expect(card.body.journeyNext.title).toBe('Adataid');
  });

  it('staff POST /team/clients/:id/path: the same path again is 409, unless an inditas client still has an adószám to clear', async () => {
    const c = await client('peti@demo.kezjegy.test');
    expect((await status(c.token, 'inditas')).status).toBe(200);
    await h.deps.db.update(clients).set({ adoszam: '70123452-1-05' }).where(eq(clients.id, c.clientId));
    const same = await h.json('POST', `/team/clients/${c.clientId}/path`, { token: anna.token, body: { businessStatus: 'inditas', note: 'Még egyszer' } });
    expect(same.status).toBe(409);
    expect(same.body.error.message).toBe('Már ezen az úton van.');
    const clear = await h.json('POST', `/team/clients/${c.clientId}/path`, { token: anna.token, body: { businessStatus: 'inditas', note: 'A régi adószám törlése', clearAdoszam: true } });
    expect(clear.status).toBe(200);
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.adoszam).toBeNull();
    const [a] = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, c.clientId), eq(auditLog.action, 'team.path_changed')));
    expect((a!.details as { clearedAdoszam?: string }).clearedAdoszam).toBe('70123452-1-05');
  });
});

describe('order 3 – our own side running late', () => {
  it('only the client\'s accountant files at NAV (admin is not in the filing roles)', () => {
    expect(ASSIST_ACTION_ROLES.ujegyke_bekuldve).toEqual(['konyvelo']);
    expect(ASSIST_ACTION_ROLES.bejelentes_bekuldve).toEqual(['konyvelo']);
    expect(ASSIST_ACTION_ROLES.meghatalmazas_el).toEqual(['konyvelo']);
  });

  it('claiming the request claims its call; late UJEGYKE → "Késünk vele" without a date and one reminder per working day', async () => {
    const c = await client('david@demo.kezjegy.test');
    expect((await status(c.token, 'van')).status).toBe(200);
    expect((await h.json('PUT', '/client/profile/draft', { token: c.token, body: rolad })).status).toBe(200);
    const r = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'meghatalmazas', source: 'helyettunk_meghatalmazas' } });
    expect(r.status).toBe(201);
    const id = r.body.assist.id;
    const as = await h.json('POST', `/team/assists/${id}/assign`, { token: anna.token, body: { userId: anna.userId } });
    expect(as.status).toBe(200);
    const [cb] = await h.deps.db.select().from(callbackRequests).where(eq(callbackRequests.id, r.body.callback.id));
    expect(cb!.assignedUserId).toBe(anna.userId);
    // the client gave everything (contract step done, adóazonosító jel from the draft): the ball is on Bence now
    for (const st of ['adatok', 'szerzodes'] as const)
      await h.deps.db.update(onboardingSteps).set({ status: 'kesz', completedAt: h.deps.now() }).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, st)));
    expect((await h.json('POST', `/team/assists/${id}/agreed`, { token: anna.token, body: { items: [...ASSIST_CHECK_ITEMS.hivas] } })).status).toBe(200);
    // 9 days later Bence still has not filed the UJEGYKE
    h.clock.set('2026-11-28T09:00:00Z');
    await relog(c);
    const j = (await h.json('GET', '/client/onboarding', { token: c.token })).body.journey;
    expect(j.waiting.key).toBe('helyettunk_ujegyke');
    expect(j.waiting.escalateText).toMatch(/^Késünk vele, elnézést\. Bence már tud róla\./);
    expect(j.waiting.escalateText).not.toMatch(/november/);
    // Friday 2026-11-27 is a working day; Saturday 11-28 is not → no reminder today
    expect(await jobAssistOverdueReminders(h.deps)).toBe(0);
    h.clock.set('2026-11-30T09:30:00Z'); // Monday
    expect(await jobAssistOverdueReminders(h.deps)).toBe(1);
    expect(await jobAssistOverdueReminders(h.deps)).toBe(0); // once per day
    const n = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, bence.userId), eq(notifications.kind, 'assist_task')));
    expect(n.some((x) => x.title === 'Késik: Loop Gábor – UJEGYKE beküldése')).toBe(true);
    const [row2] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.id, id));
    expect(row2!.status).toBe('egyeztetve');
  });
});
