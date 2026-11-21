// 11-19 javító kör (owner orders 2–5, round-2 findings): drafts of the van form survive a branch switch, switching back
// and forth keeps the done "Adataid", only the toast's "Visszavonom" is an undo, rows somebody else works on show THEIR
// time, the assisted path has no dead end after a mistaken "Jóváhagytam", the UJEGYKE waits for the client (contract +
// adóazonosító jel), the agreed call closes its callback, the assisted client is never sent into the self-filing guide,
// no rendered notification holds a raw {placeholder}, and a password never lands in the team's callback list.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ASSIST_CHECK_ITEMS } from '../src/_shared/enums.js';
import { assistRequests, auditLog, businessRegistrations, callbackRequests, clients, notifications, onboardingSteps } from '../src/db/schema.js';
import { jobAssistApprovals } from '../src/jobs-tulaj1119.js';
import { newClient, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;

const page1 = { firstName: 'Péter', lastName: 'Kovács', phone: '+36 30 555 0177', adoazonositoJel: '8123456786', address: { zip: '6720', city: 'Szeged', line: 'Minta utca 3.' } };
const pages = [
  { declarations: { noExclusion: true, singleBusiness: true }, revenueBand: 'max_12m' },
  { activities: [{ key: 'grafika', main: true }] },
  { seat: { kind: 'lakcim' } },
  { workKind: 'fofoglalkozas', euPartner: 'nem', hasSeparateBusinessAccount: true },
  { startPlan: 'mielobb' },
];
const HIVAS = [...ASSIST_CHECK_ITEMS.hivas];
const UJEGYKE = [...ASSIST_CHECK_ITEMS.ujegyke];

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
});
afterAll(async () => h.close());

async function client(email: string, first = 'Péter', last = 'Kovács') {
  const c = { ...(await newClient(h, email, { first, last })), email };
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  return c;
}
const step = async (clientId: string, s: string) =>
  (await h.deps.db.select().from(onboardingSteps).where(and(eq(onboardingSteps.clientId, clientId), eq(onboardingSteps.step, s as 'adatok'))))[0]?.status ?? null;
const status = (token: string, businessStatus: 'van' | 'inditas', extra: Record<string, unknown> = {}) =>
  h.json('PUT', '/client/onboarding/business-status', { token, body: { businessStatus, ...(businessStatus === 'inditas' ? { mode: 'onallo' } : {}), ...extra } });
async function contract(token: string) {
  const items = ['aszf', 'adatkezeles', 'megbizasi_szerzodes'].map((d) => ({ docType: d, version: h.deps.legal.current(d as 'aszf').version }));
  expect((await h.json('POST', '/me/consents', { token, body: { items } })).status).toBe(204);
}
async function relog(...cs: { token: string; email: string }[]) {
  for (const [who, email] of [[bence, 'bence@demo.kezjegy.test'], [anna, 'anna@demo.kezjegy.test']] as const) {
    (who as { token: string }).token = (await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'panel' } })).body.accessToken;
  }
  for (const c of cs) c.token = (await h.json('POST', '/auth/login', { body: { email: c.email, password: PW, clientKind: 'native' } })).body.accessToken;
}

describe('order 2 – switching branches never loses what was typed or done', () => {
  it('a page-1 draft of the van form is stored without a step change; after "Még nincs adószámom" the Rólad page has it and Adataid is done', async () => {
    const c = await client('draft@demo.kezjegy.test');
    expect((await status(c.token, 'van')).status).toBe(200);
    // page 1 "Tovább" (+ a half page 2: the adószám is never stored by a draft)
    const d = await h.json('PUT', '/client/profile/draft', { token: c.token, body: { ...page1, adoszam: '12345676-1-41', hqMunicipality: 'Szeged' } });
    expect(d.status).toBe(200);
    expect(d.body.phone).toBe('+36305550177');
    expect(d.body.address).toEqual(page1.address);
    expect(d.body.adoszam).toBe('');
    expect(d.body.hqMunicipality).toBe('Szeged');
    expect(await step(c.clientId, 'adatok')).not.toBe('kesz');
    // an invalid value is simply not stored
    expect((await h.json('PUT', '/client/profile/draft', { token: c.token, body: { phone: '123', evSince: '2099-01-01' } })).body.phone).toBe('+36305550177');
    // switch: allowed (no adószám stored), and the Rólad data are complete → Adataid done, next = kérdőív
    const sw = await status(c.token, 'inditas');
    expect(sw.status).toBe(200);
    expect(await step(c.clientId, 'adatok')).toBe('kesz');
    const adatok = sw.body.journey.steps.find((x: { key: string }) => x.key === 'adatok');
    expect(adatok.state).toBe('kesz');
    expect(sw.body.journey.currentKey).toBe('kerdoiv');
  });

  it('inditas → van → inditas keeps Adataid done and the questionnaire where it was', async () => {
    const c = await client('oda-vissza@demo.kezjegy.test');
    expect((await status(c.token, 'inditas')).status).toBe(200);
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: page1 })).status).toBe(200);
    for (const p of pages) expect((await h.json('PUT', '/client/business-registration', { token: c.token, body: p })).status).toBe(200);
    expect((await h.json('POST', '/client/business-registration/submit', { token: c.token })).status).toBe(200);
    expect((await status(c.token, 'van')).status).toBe(200);
    expect(await step(c.clientId, 'adatok')).toBe('ugyfelre_var'); // the van form needs more (adószám, …)
    const back = await status(c.token, 'inditas');
    expect(back.status).toBe(200);
    expect(await step(c.clientId, 'adatok')).toBe('kesz');
    const j = back.body.journey;
    expect(j.steps.find((x: { key: string }) => x.key === 'kerdoiv').state).toBe('kesz');
    expect(j.currentKey).not.toBe('kerdoiv');
    expect(j.currentKey).not.toBe('adatok');
  });

  it('only the toast\'s undo (undo: true) is an undo; a fast normal change is a real one and the staff are told', async () => {
    const c = await client('gyors@demo.kezjegy.test', 'Gyors', 'Géza');
    expect((await status(c.token, 'inditas')).status).toBe(200);
    h.clock.set('2026-11-19T09:00:20Z');
    expect((await status(c.token, 'van')).status).toBe(200); // a real change (notified)
    h.clock.set('2026-11-19T09:00:30Z');
    expect((await status(c.token, 'inditas')).status).toBe(200); // a real change within 30 s via the sheet (notified)
    h.clock.set('2026-11-19T09:00:35Z');
    expect((await status(c.token, 'van', { undo: true })).status).toBe(200); // the toast: undo, but it reverses a notified change
    const n = (await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, anna.userId), eq(notifications.kind, 'client_path_changed')))).filter((x) => x.title.startsWith('Géza Gyors') || x.title.startsWith('Gyors Géza'));
    expect(n.map((x) => x.body)).toEqual(['Van már vállalkozása? Eddig: „Most indítom”, most: „Már van vállalkozásom”.', 'Van már vállalkozása? Eddig: „Már van vállalkozásom”, most: „Most indítom”.', 'Van már vállalkozása? Eddig: „Most indítom”, most: „Már van vállalkozásom”.']);
    const a = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, c.clientId), eq(auditLog.action, 'business_status.changed')));
    expect(a.filter((x) => (x.details as { undo?: boolean }).undo).length).toBe(1);
    h.clock.set('2026-11-19T09:01:00Z');
  });
});

describe('order 4 – rows others work on show their time; the waiting card while a callback is open', () => {
  it('meghatalmazás assist waiting for the call: row time = 24–48 órán belül, card time + "írj nekünk", no "kérdőív" in the body', async () => {
    const c = await client('mh-hivas@demo.kezjegy.test', 'Dávid', 'Molnár');
    expect((await status(c.token, 'van')).status).toBe(200);
    const vanProfile = { ...page1, adoszam: '12345676-1-41', hqMunicipality: 'Szeged', activityText: 'Grafika', activityAnswer: 'egyeb', taxStatus: 'fofoglalkozasu', evSince: '2024-03-01', hasSeparateBusinessAccount: true };
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: vanProfile })).status).toBe(200);
    await contract(c.token); // the next client row (Igazolványok) comes after the meghatalmazás: the wait is the big card
    const r = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'meghatalmazas', source: 'helyettunk_meghatalmazas' } });
    expect(r.status).toBe(201);
    const j = (await h.json('GET', '/client/onboarding', { token: c.token })).body.journey;
    const row = j.steps.find((x: { key: string }) => x.key === 'meghatalmazas');
    expect(row.state).toBe('var');
    // k8 (k7b remnant, tulaj 11-20): no time promise; the one allowed callback sentence verbatim: no turnaround time on the row and the card
    expect(row.timeText).toBeNull();
    expect(j.waiting.key).toBe('helyettunk_hivas');
    expect(j.waiting.body).not.toContain('kérdőív');
    expect(j.waiting.body).toContain('A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.');
    expect(j.waiting.timeText).toBeNull();
    expect(j.waiting.escalateKind).toBe('uzenet');
    expect(j.waiting.escalateText).toMatch(/sem hívtunk, írj nekünk az Üzenetekben\.$/);
  });
});

describe('order 3 – the assisted path: client is the blocker before the UJEGYKE, no dead end, callback closed', () => {
  let c: Awaited<ReturnType<typeof client>>;
  let id: string;
  let cbId: string;
  it('agreed closes the linked callback ("Beszéltünk"); before the contract the ball is the client\'s and ujegyke is not allowed', async () => {
    c = await client('segitett@demo.kezjegy.test', 'Ilona', 'Balogh');
    expect((await status(c.token, 'inditas')).status).toBe(200);
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: { ...page1, firstName: 'Ilona', lastName: 'Balogh' } })).status).toBe(200);
    const r = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'vallalkozas_bejelentes', source: 'helyettunk_vallalkozas' } });
    expect(r.status).toBe(201);
    id = r.body.assist.id;
    cbId = r.body.callback.id;
    const ok = await h.json('POST', `/team/assists/${id}/agreed`, { token: anna.token, body: { items: HIVAS } });
    expect(ok.status).toBe(200);
    const [cb] = await h.deps.db.select().from(callbackRequests).where(eq(callbackRequests.id, cbId));
    expect(cb!.status).toBe('teljesitve');
    expect(cb!.lastOutcome).toBe('beszeltunk');
    const d = await h.json('GET', `/team/assists/${id}`, { token: bence.token });
    expect(d.body.readyForUjegyke).toBe(false);
    expect(d.body.notReadyReasons).toEqual(['szerződés elfogadása']);
    expect(d.body.allowedActions).not.toContain('ujegyke_bekuldve');
    expect(d.body.ball).toBe('ugyfel');
    expect(d.body.nextDue.what).toBe('Ügyfélre vár: szerződés / adatok');
    expect(d.body.nextDue.overdue).toBe(false);
    const v = (await h.json('GET', '/client/assist', { token: c.token })).body.items[0];
    expect(v.statusText).toBe('Beszéltünk. Ha megadtad az adataidat és elfogadtad a szerződést, Bence beküldi a meghatalmazást, utána jóváhagyod.');
    await contract(c.token);
    const d2 = await h.json('GET', `/team/assists/${id}`, { token: bence.token });
    expect(d2.body.readyForUjegyke).toBe(true);
    expect(d2.body.allowedActions).toContain('ujegyke_bekuldve');
    expect(d2.body.ball).toBe('konyvelo');
    expect((await h.json('GET', '/client/assist', { token: c.token })).body.items[0].statusText).toBe('Beszéltünk. Bence beküldi a meghatalmazást, utána jóváhagyod.'); // k8 integrator: "hamarosan" out (no time promise)
  });

  it('a mistaken "Jóváhagytam": the client can take it back; staff can say "Nem él" from jovahagyva; the worker alerts once after NAV\'s 4 days', async () => {
    expect((await h.json('POST', `/team/assists/${id}/ujegyke-filed`, { token: bence.token, body: { items: UJEGYKE, jogcim: '9' } })).status).toBe(200);
    expect((await h.json('POST', `/client/assist/${id}/approved`, { token: c.token })).body.status).toBe('meghatalmazas_jovahagyva');
    const back = await h.json('POST', `/client/assist/${id}/not-approved`, { token: c.token });
    expect(back.status).toBe(200);
    expect(back.body.status).toBe('meghatalmazas_bekuldve');
    expect(back.body.clientApprovedAt).toBeNull();
    expect((await h.json('POST', `/client/assist/${id}/approved`, { token: c.token })).body.status).toBe('meghatalmazas_jovahagyva');
    const d = await h.json('GET', `/team/assists/${id}`, { token: bence.token });
    expect(d.body.allowedActions).toEqual(['meghatalmazas_el', 'lejart', 'lezaras']);
    // NAV's 4 days + 2 h are over: one alert to the accountant, no automatic expiry
    h.clock.set('2026-11-23T12:00:00Z');
    await relog(c);
    const r1 = await jobAssistApprovals(h.deps);
    expect(r1.expired).toBe(0);
    expect((await jobAssistApprovals(h.deps)).staff).toBe(0);
    const alert = (await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, bence.userId), eq(notifications.kind, 'assist_task')))).filter((x) => x.title.startsWith('Nézd meg most'));
    expect(alert.length).toBe(1);
    const nem = await h.json('POST', `/team/assists/${id}/expired`, { token: bence.token, body: {} });
    expect(nem.status).toBe(200);
    expect(nem.body.status).toBe('meghatalmazas_lejart');
    const [row] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.id, id));
    expect(row!.clientApprovedAt).toBeNull();
  });

  it('the assisted client gets "nézd át és engedélyezd" (not the self-filing guide) when the team writes the ÖVTJ line', async () => {
    const d = await client('ovtj-seg@demo.kezjegy.test', 'Tamás', 'Horváth');
    expect((await status(d.token, 'inditas')).status).toBe(200);
    expect((await h.json('PUT', '/client/profile', { token: d.token, body: { ...page1, firstName: 'Tamás', lastName: 'Horváth' } })).status).toBe(200);
    expect((await h.json('POST', '/client/assist', { token: d.token, body: { kind: 'vallalkozas_bejelentes', source: 'helyettunk_vallalkozas' } })).status).toBe(201);
    for (const p of pages) expect((await h.json('PUT', '/client/business-registration', { token: d.token, body: p })).status).toBe(200);
    expect((await h.json('POST', '/client/business-registration/submit', { token: d.token })).status).toBe(200);
    const [reg] = await h.deps.db.select().from(businessRegistrations).where(eq(businessRegistrations.clientId, d.clientId));
    // while the line is pending, Végső engedély stays the client's (later) row with the reason
    const j = (await h.json('GET', '/client/onboarding', { token: d.token })).body.journey;
    const vegso = j.steps.find((x: { key: string }) => x.key === 'vegso_jovahagyas');
    expect(vegso.actor).toBe('te');
    expect(vegso.state).toBe('kesobb');
    expect(vegso.statusText).toBe('Előbb megírjuk a tevékenységed sorát.'); // k8 (k7b remnant, tulaj 11-20): no time promise; the one allowed callback sentence verbatim
    const patch = await h.json('PATCH', `/team/registrations/${reg!.id}`, {
      token: anna.token,
      body: { ovtjKodok: [{ index: 0, ovtjKod: '742001' }] },
    });
    expect(patch.status).toBe(200);
    const [n] = (await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, d.userId), eq(notifications.kind, 'registration_reminder')))).slice(-1);
    expect(n!.title).toBe('Kiválasztottuk a tevékenységed kódját');
    expect(n!.body).toContain('Bence beküldi');
    expect(n!.link).toBe('/bekotes/vallalkozas/engedely');
  });
});

describe('no raw placeholders, no passwords', () => {
  it('no rendered notification title or body (and no e-mail subject) of this file holds a "{"', async () => {
    const all = await h.deps.db.select().from(notifications);
    expect(all.length).toBeGreaterThan(5);
    for (const x of all) {
      expect(x.title, x.kind).not.toContain('{');
      expect(x.body, x.kind).not.toContain('{');
    }
    for (const m of h.mails) expect(m.subject).not.toContain('{');
  });

  it('a note with a password, a code or an adóazonosító jel is refused (400) on callbacks and assist requests', async () => {
    const c = await client('szabo.olga@demo.kezjegy.test', 'Olga', 'Szabó');
    expect((await status(c.token, 'van')).status).toBe(200);
    for (const note of ['A jelszavam: titok123', 'kód: 482913', 'az adóazonosítóm 8123456786']) {
      const r = await h.json('POST', '/client/callbacks', { token: c.token, body: { topic: 'bekotes', source: 'bekotes', note, phone: '+36 30 555 0100' } });
      expect(r.status, note).toBe(400);
      expect(r.body.error.fields.note).toContain('jelszót');
    }
    const ok = await h.json('POST', '/client/callbacks', { token: c.token, body: { topic: 'bekotes', source: 'bekotes', note: 'Elfelejtettem a jelszavamat, nem tudok belépni.', phone: '+36 30 555 0100' } });
    expect(ok.status).toBe(201);
  });

  it('the old onya_konyvelo "approved" call cannot fake an approval when nothing was filed (locked step / no filing)', async () => {
    const c = await client('olga@demo.kezjegy.test', 'Olga', 'Új');
    expect((await status(c.token, 'inditas')).status).toBe(200);
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: { ...page1, firstName: 'Olga', lastName: 'Új' } })).status).toBe(200);
    const r = await h.json('POST', '/client/onboarding/meghatalmazas', { token: c.token, body: { method: 'onya_konyvelo', approved: true } });
    expect(r.status).toBe(409);
    expect(await step(c.clientId, 'meghatalmazas')).not.toBe('konyvelore_var');
  });
});
