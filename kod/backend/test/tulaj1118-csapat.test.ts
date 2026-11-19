// SPEC §26.4 / §26.14 S2: the service team role 'csapat' – strict permissions proved per row. A team member handles
// callbacks, registrations and the messages of clients still in onboarding; he can NOT approve taxes, read documents,
// KYC, NAV data, notes, exports, audit or admin pages, nor messages of active clients. Admin team management,
// deactivation (sessions end, callbacks back to the queue), the dashboard tiles and the audit trail.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditLog, callbackRequests, clients, notifications } from '../src/db/schema.js';
import { newClient, pdfBytes, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;
let onb: Awaited<ReturnType<typeof newClient>>; // in onboarding
let act: Awaited<ReturnType<typeof newClient>>; // active, no team contact
let actDocFile: string;
let actDocId: string;

beforeAll(async () => {
  h = await setup({ now: '2026-11-18T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
  onb = await newClient(h, 'bekotes@demo.kezjegy.test', { first: 'Olga' });
  act = await newClient(h, 'aktiv@demo.kezjegy.test', { first: 'Aladár', active: true });
  for (const c of [onb, act]) await h.deps.db.update(clients).set({ accountantId: bence.accountantId, phoneEnc: h.deps.data.enc('+36301112222', 'clients.phone') }).where(eq(clients.id, c.clientId));
  const fd = new FormData();
  fd.append('category', 'nyugta');
  fd.append('dossierMonth', '2026-11');
  fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'nyugta.pdf');
  const d = await h.json('POST', '/client/documents', { token: act.token, form: fd });
  expect(d.status).toBe(201);
  actDocFile = d.body.versions[0].fileId;
  actDocId = d.body.id;
});
afterAll(async () => h.close());

describe('csapat cannot reach other areas (404)', () => {
  it('accountant, admin and client route groups, tax approval, documents, KYC, NAV, notes, audit, exports', async () => {
    const id = act.clientId;
    const z = '00000000-0000-4000-8000-000000000000';
    const probes: [string, string, unknown?][] = [
      ['GET', '/acc/clients'],
      ['GET', `/acc/clients/${id}`],
      ['GET', `/acc/clients/${id}/kyc`],
      ['GET', `/acc/clients/${id}/dossiers`],
      ['GET', `/acc/clients/${id}/tax-periods?year=2026`],
      ['POST', `/acc/clients/${id}/tax-periods/2026-Q4/calculate`, {}],
      ['POST', `/acc/tax-calculations/${z}/approve`, {}],
      ['PUT', `/acc/clients/${id}/nav-credentials`, { login: 'x', password: 'y', signKey: 'z', exchangeKey: 'w', taxNumber: '12345678' }],
      ['GET', `/acc/clients/${id}/notes`],
      ['GET', `/acc/documents/${actDocId}`],
      ['GET', '/acc/export/revenue.csv?year=2026'],
      ['GET', '/acc/audit'],
      ['GET', `/acc/clients/${id}/business-registration`],
      ['GET', '/admin/dashboard'],
      ['GET', '/admin/clients'],
      ['GET', '/admin/team'],
      ['GET', '/admin/audit'],
      ['GET', '/admin/content-texts'],
      ['GET', '/client/home'],
      ['GET', '/client/onboarding'],
      ['GET', `/files/${actDocFile}`],
      ['POST', `/files/${actDocFile}/link`],
    ];
    for (const [m, path, body] of probes) {
      const r = await h.json(m, path, { token: anna.token, ...(body !== undefined ? { body } : {}) });
      expect(r.status, `${m} ${path}`).toBe(404);
    }
  });

  it('a real tax calculation cannot be approved, reopened or read by a team member', async () => {
    await h.json('PATCH', `/acc/clients/${act.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45 } });
    const calc = await h.json('POST', `/acc/clients/${act.clientId}/tax-periods/2026-Q3/calculate`, { token: bence.token, body: { asOf: '2026-10-02' } });
    expect(calc.status).toBe(200);
    const tries = [
      await h.json('POST', `/acc/tax-calculations/${calc.body.id}/approve`, { token: anna.token, body: { letterText: 'Jóváhagyom.' } }),
      await h.json('POST', `/acc/tax-periods/${calc.body.taxPeriodId ?? calc.body.periodId ?? calc.body.id}/reopen`, { token: anna.token, body: {} }),
      await h.json('GET', `/acc/clients/${act.clientId}/tax-periods?year=2026`, { token: anna.token }),
      await h.json('GET', '/client/tax-periods?year=2026', { token: anna.token }),
    ];
    for (const r of tries) expect(r.status).toBe(404);
    const still = await h.json('GET', `/acc/clients/${act.clientId}/tax-periods?year=2026`, { token: bence.token });
    expect(still.body.items.every((p: { calcStatus: string }) => p.calcStatus !== 'jovahagyva')).toBe(true);
  });

  it('messages: only clients in onboarding; an active client’s thread and card are 404', async () => {
    expect((await h.json('GET', `/team/clients/${act.clientId}/messages`, { token: anna.token })).status).toBe(404);
    expect((await h.json('POST', `/team/clients/${act.clientId}/messages`, { token: anna.token, body: { body: 'Szia!' } })).status).toBe(404);
    expect((await h.json('GET', `/team/clients/${act.clientId}`, { token: anna.token })).status).toBe(404);
    // onboarding client: thread, write, card
    await h.json('POST', '/client/messages', { token: onb.token, body: { body: 'Hol találom az adóazonosító jelemet?' } });
    const n = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'client_message_new')));
    expect(n.length).toBe(1);
    const threads = await h.json('GET', '/team/threads', { token: anna.token });
    const t = threads.body.items.find((x: { client: { id: string } }) => x.client.id === onb.clientId);
    expect(t.unread).toBe(1);
    const read = await h.json('GET', `/team/clients/${onb.clientId}/messages`, { token: anna.token });
    // (the test clock stands still: find messages by body, not by position)
    const byBody = (items: { body: string }[], b: string) => items.find((x) => x.body === b);
    expect(byBody(read.body.items, 'Hol találom az adóazonosító jelemet?')).toMatchObject({ sender: 'ugyfel' });
    const sent = await h.json('POST', `/team/clients/${onb.clientId}/messages`, { token: anna.token, body: { body: 'Az adóigazolványodon találod.' } });
    expect(sent.status).toBe(201);
    expect(sent.body.sender).toBe('en');
    const clientView = await h.json('GET', '/client/messages', { token: onb.token });
    expect(byBody(clientView.body.items, 'Az adóigazolványodon találod.')).toMatchObject({ sender: 'csapat', senderName: 'Anna · ügyfélszolgálat' });
    const accView = await h.json('GET', `/acc/clients/${onb.clientId}/messages`, { token: bence.token });
    expect(byBody(accView.body.items, 'Az adóigazolványodon találod.')).toMatchObject({ sender: 'csapat', senderName: 'Anna · ügyfélszolgálat' });
    const card = await h.json('GET', `/team/clients/${onb.clientId}`, { token: anna.token });
    expect(card.body).toMatchObject({ lifecycle: 'bekotes_alatt', canMessage: true, phoneMasked: '+36 30 *** **22' });
    expect(card.body.accountant.name).toContain('Bence');
    // after a callback the active client's card opens for 90 days, the thread stays closed
    const cb = await h.json('POST', '/client/callbacks', { token: act.token, body: { topic: 'egyeb', window: 'barmikor', source: 'fiok' } });
    expect(cb.status).toBe(201);
    expect((await h.json('GET', `/team/clients/${act.clientId}`, { token: anna.token })).status).toBe(200);
    expect((await h.json('GET', `/team/clients/${act.clientId}/messages`, { token: anna.token })).status).toBe(404);
    // the team never gets the client's files (except the EV bejelentés PDF and onboarding thread attachments)
    expect((await h.json('POST', `/files/${actDocFile}/link`, { token: anna.token })).status).toBe(404);
  });

  it('registrations are team + admin only; messages are team only; an accountant gets 404', async () => {
    expect((await h.json('GET', '/team/registrations', { token: bence.token })).status).toBe(404);
    expect((await h.json('GET', '/team/threads', { token: bence.token })).status).toBe(404);
    expect((await h.json('GET', '/team/threads', { token: admin.token })).status).toBe(404);
    expect((await h.json('GET', `/team/clients/${onb.clientId}/messages`, { token: admin.token })).status).toBe(404);
    expect((await h.json('GET', '/team/registrations', { token: admin.token })).status).toBe(200);
    expect((await h.json('GET', '/team/registrations', { token: anna.token })).status).toBe(200);
    const sum = await h.json('GET', '/team/summary', { token: anna.token });
    expect(sum.body.callbacks.open).toBeGreaterThanOrEqual(1);
    expect(Object.keys(sum.body.registrations)).toContain('beadva');
  });

  it('a team member can create a callback for a client in onboarding, not for a stranger', async () => {
    const ok = await h.json('POST', `/team/clients/${onb.clientId}/callbacks`, { token: anna.token, body: { topic: 'bekotes', note: 'Telefonon kérte.' } });
    expect(ok.status).toBe(201);
    expect(ok.body.source).toBe('csapat');
    const other = await newClient(h, 'idegen@demo.kezjegy.test', { active: true });
    expect((await h.json('POST', `/team/clients/${other.clientId}/callbacks`, { token: anna.token, body: { topic: 'egyeb' } })).status).toBe(404);
  });
});

describe('admin: team management, deactivation, dashboard, audit', () => {
  it('invite sends the staff code; deactivation ends the sessions and returns open callbacks to the queue', async () => {
    const inv = await h.json('POST', '/admin/team', { token: admin.token, body: { email: 'Uj.Kolléga@demo.kezjegy.test'.toLowerCase(), displayName: 'Kiss Csilla', firstName: 'Csilla' } });
    expect(inv.status).toBe(201);
    expect(inv.body).toMatchObject({ displayName: 'Kiss Csilla', firstName: 'Csilla', active: true, totpEnabled: false });
    expect(h.mails.some((m) => m.to === 'uj.kolléga@demo.kezjegy.test' && m.template === 'auth_staff_invite_csapat')).toBe(true);
    // Anna holds a callback
    const [open] = await h.deps.db.select().from(callbackRequests).where(eq(callbackRequests.clientId, act.clientId));
    await h.json('POST', `/team/callbacks/${open!.id}/claim`, { token: anna.token, body: {} });
    const list = await h.json('GET', '/admin/team', { token: admin.token });
    expect(list.body.items.find((x: { firstName: string }) => x.firstName === 'Anna').openCallbacks).toBe(1);
    const off = await h.json('PATCH', `/admin/team/${anna.userId}`, { token: admin.token, body: { active: false } });
    expect(off.body.active).toBe(false);
    expect((await h.json('GET', '/team/summary', { token: anna.token })).status).toBe(401);
    const [after] = await h.deps.db.select().from(callbackRequests).where(eq(callbackRequests.id, open!.id));
    expect(after!.assignedUserId).toBeNull();
    expect(after!.status).toBe('uj');
    const on = await h.json('PATCH', `/admin/team/${anna.userId}`, { token: admin.token, body: { active: true } });
    expect(on.body.active).toBe(true);
  });

  it('dashboard has the two service tiles; audit holds team actions without numbers or texts', async () => {
    const d = await h.json('GET', '/admin/dashboard', { token: admin.token });
    expect(d.body.service.callbacks.open).toBeGreaterThanOrEqual(1);
    expect(d.body.service.registrations).toMatchObject({ inPipeline: 0, doneThisMonth: 0 });
    const rows = await h.deps.db.select().from(auditLog);
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['callback.created', 'callback.claimed', 'team.member_invited', 'team.member_disabled', 'team.member_enabled', 'message.sent']) expect(actions.has(a), a).toBe(true);
    const s = JSON.stringify(rows.map((r) => r.details));
    expect(s).not.toContain('+36');
    expect(s).not.toContain('Telefonon kérte');
    expect(s).not.toContain('adóigazolványodon');
  });

  it('csapat logs in to the panel; Me carries teamMember', async () => {
    const me = await h.json('GET', '/me', { token: (await h.json('POST', '/auth/login', { body: { email: 'anna@demo.kezjegy.test', password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'panel' } })).body.accessToken });
    expect(me.body.user.role).toBe('csapat');
    expect(me.body.teamMember).toEqual({ firstName: 'Anna', displayName: 'Nagy Anna' });
    expect(me.body.notificationPrefs.map((p: { kind: string }) => p.kind)).toContain('callback_assigned');
    expect(me.body.notificationPrefs.map((p: { kind: string }) => p.kind)).not.toContain('appointment_booked');
  });

  it('old appointment notices stay in the DB but are not listed or counted as unread (SPEC §26.2.9)', async () => {
    await h.deps.db.insert(notifications).values({ userId: onb.userId, kind: 'appointment_booked', title: 'Időpont lefoglalva', body: 'Bence hív telefonon.', link: '/hataridok' });
    await h.deps.db.insert(notifications).values({ userId: onb.userId, kind: 'appointment_reminder', title: 'Holnap hív Bence', body: 'Ha nem jó, lemondhatod az appban.', link: '/hataridok' });
    const all = await h.deps.db.select().from(notifications).where(eq(notifications.userId, onb.userId));
    expect(all.some((x) => x.kind === 'appointment_booked')).toBe(true);
    const list = await h.json('GET', '/me/notifications', { token: onb.token });
    expect(list.body.items.map((x: { kind: string }) => x.kind)).not.toContain('appointment_booked');
    expect(list.body.items.map((x: { kind: string }) => x.kind)).not.toContain('appointment_reminder');
  });

  it('admin content texts mark the retired booking texts as legacy', async () => {
    const r = await h.json('GET', '/admin/content-texts', { token: admin.token });
    const legacy = r.body.items.filter((x: { legacy: boolean }) => x.legacy).map((x: { key: string }) => x.key);
    expect(legacy.length).toBeGreaterThan(3);
    expect(legacy.every((k: string) => /^(notif|email)\.appointment_/.test(k))).toBe(true);
    expect(r.body.items.find((x: { key: string }) => x.key === 'notif.callback_received.title').legacy).toBe(false);
  });
});
