// SPEC §26.14 O2 (owner order 2): "Kérj visszahívást" instead of booking. Client create/limits, the staff flow
// (claim, phone only for the holder, "Most hívom", 3 failed attempts, wrong number, summary as a message), the SLA job,
// the accountant's narrow view, and the one-time mapping of booked legacy appointments (idempotent).
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { appointments, auditLog, callbackRequests, clients, faqItems, messages, notifications, systemState } from '../src/db/schema.js';
import { jobCallbackSla, mapLegacyAppointments } from '../src/services/callbacks.js';
import { runDataStepTulaj1118 } from '../src/services/datastep.js';
import { newClient, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let other: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;
let bela: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;

beforeAll(async () => {
  h = await setup({ now: '2026-11-18T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  other = await staff(h, 'accountant', 'adam@demo.kezjegy.test', { firstName: 'Ádám' });
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
  bela = await staff(h, 'csapat', 'bela@demo.kezjegy.test', { firstName: 'Béla' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
});
afterAll(async () => h.close());

async function client(email: string) {
  const c = await newClient(h, email, { first: 'Kata', last: 'Minta' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId, phoneEnc: h.deps.data.enc('+36301234567', 'clients.phone') }).where(eq(clients.id, c.clientId));
  return c;
}
/** Access tokens live 10 minutes: after moving the clock, sign in again. */
async function relogin(s: { token: string }, email: string, clientKind = 'panel') {
  const r = await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind } });
  s.token = r.body.accessToken;
}
const ask = (token: string, body: Record<string, unknown> = {}) =>
  h.json('POST', '/client/callbacks', { token, body: { topic: 'bekotes', window: 'barmikor', source: 'bekotes', ...body } });

describe('O2.1 – client creates a callback', () => {
  it('profile phone or a new number; one open at a time (409 with it); 4th in 24 h → 429; bad phone → 400', async () => {
    const c = await client('cb1@demo.kezjegy.test');
    const promise = await h.json('GET', '/client/callbacks', { token: c.token });
    expect(promise.body.open).toBeNull();
    expect(promise.body.phoneOnFileMasked).toBe('+36 30 *** **67');
    expect(promise.body.promise.text).toContain('24–48 órán belül');
    expect(promise.body.promise.text).toContain('Nem feltétlenül Bence');
    expect(promise.body.promise.callerIdText).toBeNull();
    expect(promise.body.promise.fraudWarning).toContain('soha nem kérjük a jelszavadat');
    const bad = await ask(c.token, { phone: '1234' });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.phone).toContain('Magyar telefonszámot');
    const first = await ask(c.token, { note: 'Elakadtam a meghatalmazásnál.' });
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ status: 'uj', phoneMasked: '+36 30 *** **67', canCancel: true, overdue: false, callingNow: false });
    // k8 (k7b remnant, tulaj 11-20): no time promise; the one allowed callback sentence verbatim
    expect(first.body.statusText).toContain('A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. Ezen a számon hívunk: +36 30 *** **67.');
    const dup = await ask(c.token);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('callback_already_open');
    expect(dup.body.callback.id).toBe(first.body.id);
    await h.json('POST', `/client/callbacks/${first.body.id}/cancel`, { token: c.token });
    const second = await ask(c.token, { phone: '06-20/555-0101', savePhoneToProfile: true });
    expect(second.status).toBe(201);
    expect(second.body.phoneMasked).toBe('+36 20 *** **01');
    expect((await h.json('GET', '/client/callbacks', { token: c.token })).body.phoneOnFileMasked).toBe('+36 20 *** **01');
    await h.json('POST', `/client/callbacks/${second.body.id}/cancel`, { token: c.token });
    const third = await ask(c.token);
    expect(third.status).toBe(201);
    await h.json('POST', `/client/callbacks/${third.body.id}/cancel`, { token: c.token });
    const fourth = await ask(c.token);
    expect(fourth.status).toBe(429);
    // received notification + team notification
    const mine = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'callback_received')));
    expect(mine.length).toBe(3);
    expect(mine[0]!.body).toContain('soha nem kérjük a jelszavadat');
    const team = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'callback_new')));
    expect(team.length).toBeGreaterThanOrEqual(3);
    // audit never holds the number or the note
    const audits = await h.deps.db.select().from(auditLog).where(eq(auditLog.clientId, c.clientId));
    const s = JSON.stringify(audits.map((a) => a.details));
    expect(s).not.toContain('555');
    expect(s).not.toContain('Elakadtam');
  });
});

describe('O2.2 – staff flow', () => {
  it('claim, phone only for the holder, "Most hívom", 3 failed attempts → sikertelen', async () => {
    const c = await client('cb2@demo.kezjegy.test');
    const cb = (await ask(c.token)).body;
    const list = await h.json('GET', '/team/callbacks?filter=gazdatlan', { token: anna.token });
    expect(list.body.items.map((x: { id: string }) => x.id)).toContain(cb.id);
    const before = await h.json('GET', `/team/callbacks/${cb.id}`, { token: anna.token });
    expect(before.body.phone).toBeNull();
    const cl = await h.json('POST', `/team/callbacks/${cb.id}/claim`, { token: anna.token, body: {} });
    expect(cl.body.phone).toBe('+36301234567');
    expect(cl.body.assignee.firstName).toBe('Anna');
    const viewed = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.action, 'callback.phone_viewed'), eq(auditLog.targetId, cb.id)));
    expect(viewed.length).toBeGreaterThan(0);
    // somebody else: no phone, cannot claim, cannot log an attempt
    expect((await h.json('GET', `/team/callbacks/${cb.id}`, { token: bela.token })).body.phone).toBeNull();
    expect((await h.json('POST', `/team/callbacks/${cb.id}/claim`, { token: bela.token, body: {} })).status).toBe(409);
    expect((await h.json('POST', `/team/callbacks/${cb.id}/attempts`, { token: bela.token, body: { outcome: 'beszeltunk' } })).status).toBe(409);
    expect((await h.json('GET', `/team/callbacks/${cb.id}`, { token: admin.token })).body.phone).toBeNull();
    // "Most hívom"
    await h.json('POST', `/team/callbacks/${cb.id}/calling`, { token: anna.token });
    const st = await h.json('GET', '/client/callbacks', { token: c.token });
    expect(st.body.open.callingNow).toBe(true);
    expect(st.body.open.statusText).toContain('Most hív kollégánk, Anna');
    expect(st.body.open.staffFirstName).toBe('Anna');
    const calling = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'callback_calling')));
    expect(calling[0]!.title).toBe('Most hív kollégánk, Anna');
    expect(calling[0]!.wantPush).toBe(true);
    // three failed attempts
    for (let i = 0; i < 3; i++) {
      const r = await h.json('POST', `/team/callbacks/${cb.id}/attempts`, { token: anna.token, body: { outcome: i === 1 ? 'foglalt' : 'nem_vette_fel' } });
      expect(r.status).toBe(200);
    }
    const viewedBefore = (await h.deps.db.select().from(auditLog).where(and(eq(auditLog.action, 'callback.phone_viewed'), eq(auditLog.targetId, cb.id)))).length;
    const end = await h.json('GET', `/team/callbacks/${cb.id}`, { token: anna.token });
    expect(end.body.status).toBe('sikertelen');
    // closed: the former holder no longer gets the full number, and nothing is logged as viewed (review k3c2)
    expect(end.body.phone).toBeNull();
    expect((await h.deps.db.select().from(auditLog).where(and(eq(auditLog.action, 'callback.phone_viewed'), eq(auditLog.targetId, cb.id)))).length).toBe(viewedBefore);
    expect(end.body.attemptList).toHaveLength(3);
    expect(end.body.history.map((x: { text: string }) => x.text)).toEqual(expect.arrayContaining(['Beérkezett', 'Magára vette', 'Hívás: Nem vette fel', 'Hívás: Foglalt volt']));
    const kinds = (await h.deps.db.select().from(notifications).where(eq(notifications.userId, c.userId))).map((n) => n.kind);
    expect(kinds).toEqual(expect.arrayContaining(['callback_missed', 'callback_unreached']));
    const cl2 = await h.json('GET', '/client/callbacks', { token: c.token });
    expect(cl2.body.open).toBeNull();
    expect(cl2.body.recent[0].statusText).toContain('Háromszor kerestünk');
  });

  it('wrong number → client fixes it → holder notified; "Beszéltünk" + summary → message from "Anna · ügyfélszolgálat"', async () => {
    const c = await client('cb3@demo.kezjegy.test');
    const cb = (await ask(c.token)).body;
    await h.json('POST', `/team/callbacks/${cb.id}/claim`, { token: anna.token, body: {} });
    await h.json('POST', `/team/callbacks/${cb.id}/attempts`, { token: anna.token, body: { outcome: 'hibas_szam' } });
    const v = await h.json('GET', '/client/callbacks', { token: c.token });
    expect(v.body.open.needsNewPhone).toBe(true);
    expect(v.body.open.statusText).toContain('Írd be a jó számot');
    const fix = await h.json('PATCH', `/client/callbacks/${cb.id}`, { token: c.token, body: { phone: '+36 70 111 2233' } });
    expect(fix.body.needsNewPhone).toBe(false);
    const uj = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'callback_assigned')));
    expect(uj.some((n) => n.body.includes('Megadta az új számát'))).toBe(true);
    const later = await h.json('POST', `/team/callbacks/${cb.id}/attempts`, { token: anna.token, body: { outcome: 'kesobb_kerte', nextAttemptAfter: '2026-11-19T13:00:00.000Z' } });
    expect(later.body.status).toBe('folyamatban');
    expect((await h.json('GET', '/client/callbacks', { token: c.token })).body.open.statusText).toContain('körül hívunk újra');
    const talk = await h.json('POST', `/team/callbacks/${cb.id}/attempts`, { token: anna.token, body: { outcome: 'beszeltunk', note: 'belső', summaryForClient: 'Megbeszéltük, hogy holnap feltöltöd a személyid fotóját.' } });
    expect(talk.body.status).toBe('teljesitve');
    const thread = await h.json('GET', '/client/messages', { token: c.token });
    expect(thread.body.items[0]).toMatchObject({ sender: 'csapat', senderName: 'Anna · ügyfélszolgálat' });
    expect(thread.body.items[0].body).toBe('A hívásunk összefoglalója: Megbeszéltük, hogy holnap feltöltöd a személyid fotóját.');
    const accThread = await h.json('GET', `/acc/clients/${c.clientId}/messages`, { token: bence.token });
    expect(accThread.body.items[0].sender).toBe('csapat');
    const done = await h.json('GET', '/client/callbacks', { token: c.token });
    expect(done.body.recent[0].summary).toContain('személyid');
    expect(JSON.stringify(done.body)).not.toContain('belső');
  });

  it('close without a call (holder or admin) and hand-over rules', async () => {
    const c = await client('cb4@demo.kezjegy.test');
    const cb = (await ask(c.token)).body;
    // hand-over: only team, admins and the client's own accountant
    const wrong = await h.json('POST', `/team/callbacks/${cb.id}/assign`, { token: anna.token, body: { userId: other.userId } });
    expect(wrong.status).toBe(400);
    const det = await h.json('GET', `/team/callbacks/${cb.id}`, { token: anna.token });
    const names = det.body.assignable.map((x: { firstName: string }) => x.firstName);
    expect(names).toEqual(expect.arrayContaining(['Anna', 'Béla', 'Bence']));
    expect(names).not.toContain('Ádám');
    const close = await h.json('POST', `/team/callbacks/${cb.id}/close`, { token: admin.token, body: { reason: 'megoldva_uzenetben' } });
    expect(close.body.status).toBe('lezarva');
    const v = await h.json('GET', '/client/callbacks', { token: c.token });
    expect(v.body.recent[0].statusText).toBe('Lezártuk a kérésedet: üzenetben válaszoltunk.');
  });

  it('SLA job: overdue notice once (holder or the whole team + admins); expired "Most hívom" cleared', async () => {
    const c = await client('cb5@demo.kezjegy.test');
    const cb = (await ask(c.token)).body;
    h.clock.advance(49 * 3600_000);
    await relogin(c, 'cb5@demo.kezjegy.test', 'web');
    await relogin(anna, 'anna@demo.kezjegy.test');
    await relogin(admin, 'admin@demo.kezjegy.test');
    await relogin(bence, 'bence@demo.kezjegy.test');
    await relogin(bela, 'bela@demo.kezjegy.test');
    const r1 = await jobCallbackSla(h.deps);
    expect(r1.overdue).toBeGreaterThanOrEqual(1);
    const r2 = await jobCallbackSla(h.deps);
    expect(r2.overdue).toBe(0);
    const forAnna = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'callback_overdue'), sql`${notifications.data}->>'callbackId' = ${cb.id}`));
    const forAdmin = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, admin.userId), eq(notifications.kind, 'callback_overdue'), sql`${notifications.data}->>'callbackId' = ${cb.id}`));
    expect(forAnna.length).toBe(1);
    expect(forAdmin.length).toBe(1);
    const v = await h.json('GET', '/client/callbacks', { token: c.token });
    expect(v.body.open.overdue).toBe(true);
    expect(v.body.open.statusText).toContain('Sajnáljuk');
    const row = await h.json('GET', `/team/callbacks/${cb.id}`, { token: anna.token });
    expect(row.body.minutesToDue).toBeLessThan(0);
    // "Most hívom" expires after 15 minutes
    await h.json('POST', `/team/callbacks/${cb.id}/claim`, { token: anna.token, body: {} });
    await h.json('POST', `/team/callbacks/${cb.id}/calling`, { token: anna.token });
    await h.deps.db.update(callbackRequests).set({ callingNowUntil: new Date(h.clock.now().getTime() - 60_000) }).where(eq(callbackRequests.id, cb.id));
    const r3 = await jobCallbackSla(h.deps);
    expect(r3.cleared).toBe(1);
  });
});

describe('O2.3 – the accountant sees only callbacks assigned to him', () => {
  it('404 for others; csapat may hand it to the client’s accountant, who can log attempts and give it back', async () => {
    const c = await client('cb6@demo.kezjegy.test');
    const cb = (await ask(c.token)).body;
    expect((await h.json('GET', `/team/callbacks/${cb.id}`, { token: bence.token })).status).toBe(404);
    expect((await h.json('GET', '/team/callbacks?filter=mind', { token: bence.token })).body.items).toHaveLength(0);
    expect((await h.json('POST', `/team/callbacks/${cb.id}/claim`, { token: bence.token, body: {} })).status).toBe(404);
    const give = await h.json('POST', `/team/callbacks/${cb.id}/assign`, { token: anna.token, body: { userId: bence.userId } });
    expect(give.body.assignee.firstName).toBe('Bence');
    const mine = await h.json('GET', '/team/callbacks?filter=enyem', { token: bence.token });
    expect(mine.body.items.map((x: { id: string }) => x.id)).toEqual([cb.id]);
    const d = await h.json('GET', `/team/callbacks/${cb.id}`, { token: bence.token });
    expect(d.body.phone).toBe('+36301234567');
    expect((await h.json('POST', `/team/callbacks/${cb.id}/assign`, { token: bence.token, body: { userId: anna.userId } })).status).toBe(403);
    const att = await h.json('POST', `/team/callbacks/${cb.id}/attempts`, { token: bence.token, body: { outcome: 'nem_vette_fel' } });
    expect(att.status).toBe(200);
    const back = await h.json('POST', `/team/callbacks/${cb.id}/assign`, { token: bence.token, body: { userId: null } });
    expect(back.status).toBe(200);
    expect((await h.json('GET', `/team/callbacks/${cb.id}`, { token: bence.token })).status).toBe(404);
    const hist = await h.json('GET', `/acc/clients/${c.clientId}/callbacks`, { token: bence.token });
    expect(hist.body.items[0].id).toBe(cb.id);
    const sum = await h.json('GET', '/team/summary', { token: bence.token });
    expect(sum.body.callbacks.mine).toBe(0);
    expect(sum.body.unreadThreads).toBe(0);
  });
});

describe('O2.4 – legacy appointments → callbacks (one-time data step)', () => {
  it('a booked call becomes exactly one callback; a second run adds nothing; the appointment row is unchanged; booking is 410', async () => {
    const c = await client('peter@demo.kezjegy.test');
    await h.deps.db.update(clients).set({ adoszam: '12345676-1-41' }).where(eq(clients.id, c.clientId));
    const startsAt = new Date(h.clock.now().getTime() + 26 * 3600_000);
    const [apt] = await h.deps.db
      .insert(appointments)
      .values({ clientId: c.clientId, accountantId: bence.accountantId!, startsAt, endsAt: new Date(startsAt.getTime() + 30 * 60_000), channel: 'telefon', phoneEnc: h.deps.data.enc('+36701112233', 'appointments.phone'), topic: 'Átállás' })
      .returning();
    const old = await h.deps.db.select().from(appointments).where(eq(appointments.id, apt!.id));
    const faqBefore = (await h.deps.db.select().from(faqItems)).length;
    const res = await runDataStepTulaj1118(h.deps);
    expect(res).not.toBe('already');
    const rows = await h.deps.db.select().from(callbackRequests).where(eq(callbackRequests.legacyAppointmentId, apt!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'uj', source: 'regi_idopont', topic: 'bekotes', createdByRole: 'system', phoneMasked: '+36 70 *** **33' });
    expect(rows[0]!.dueAt.getTime()).toBe(startsAt.getTime() + 2 * 3600_000);
    expect(rows[0]!.note).toContain('Korábban egyeztetett hívás');
    const notif = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'callback_received')));
    expect(notif.some((n) => n.title === 'Időpont helyett visszahívás' && !n.wantEmail && !n.wantPush)).toBe(true);
    expect(await runDataStepTulaj1118(h.deps)).toBe('already');
    expect(await mapLegacyAppointments(h.deps)).toBe(0);
    expect(await h.deps.db.select().from(appointments).where(eq(appointments.id, apt!.id))).toEqual(old);
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.businessStatus).toBe('van');
    expect((await h.deps.db.select().from(faqItems)).length).toBe(faqBefore + 4);
    const [marker] = await h.deps.db.select().from(systemState).where(eq(systemState.key, 'data.tulaj1118'));
    expect(marker).toBeTruthy();
    expect((await h.json('POST', '/client/appointments', { token: c.token, body: {} })).status).toBe(410);
    expect((await h.json('POST', `/client/appointments/${apt!.id}/cancel`, { token: c.token })).status).toBe(410);
    expect((await h.json('GET', '/client/appointments', { token: c.token })).body.items[0].status).toBe('foglalt');
    const onb = await h.json('GET', '/client/onboarding', { token: c.token });
    expect(onb.body.callback.source).toBe('regi_idopont');
    // the status card keeps the agreed time (same promise as the one-time notice, review k3c2)
    const st = onb.body.callback.statusText as string;
    expect(st).toMatch(/^Kollégánk .+ \d{1,2}:\d{2} körül hív a \+36 70 \*\*\* \*\*33 számon, ahogy korábban egyeztettük\.$/);
    const when = st.replace(/^Kollégánk (.+) körül hív.*$/, '$1');
    expect(notif.find((n) => n.title === 'Időpont helyett visszahívás')!.body).toContain(when);
    expect((await h.deps.db.select().from(messages).where(eq(messages.clientId, c.clientId))).length).toBe(0);
  });

  it('the FAQ safety answer is updated once, only while it is still the old default text (review k3c2)', async () => {
    const { FAQ_SAFETY_OLD_ANSWER, runFaqSafetyFix } = await import('../src/services/datastep.js');
    const [old] = await h.deps.db.insert(faqItems).values({ question: 'Biztonságban vannak az adataim?', answer: FAQ_SAFETY_OLD_ANSWER, sort: 90 }).returning();
    const [edited] = await h.deps.db.insert(faqItems).values({ question: 'Biztonságban vannak az adataim?', answer: 'Az admin saját szövege.', sort: 91 }).returning();
    expect(await runFaqSafetyFix(h.deps)).toBe(1);
    const [a] = await h.deps.db.select().from(faqItems).where(eq(faqItems.id, old!.id));
    expect(a!.answer).toContain('ügyfélszolgálatunk csak azt');
    const [b] = await h.deps.db.select().from(faqItems).where(eq(faqItems.id, edited!.id));
    expect(b!.answer).toBe('Az admin saját szövege.');
    expect(await runFaqSafetyFix(h.deps)).toBe('already');
  });
});
