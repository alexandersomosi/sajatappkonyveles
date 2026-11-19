// Kör 3 javítások: jogi helyőrzők, meghatalmazás-jóváhagyás, kérés-megjegyzések és ütközések, értesítések,
// iparűzési adó kézi jóváhagyása, határidők, nyugdíjas, demo-postafiók, IPN végleges állapot után,
// push-token, admin átsorolás, feltöltési korlátok, CSV, 2FA bekapcsolás.
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LEGAL_DOC_TYPES } from '../src/_shared/enums.js';
import { auditLog, clients, demoOutbox, documents, notifications, onboardingSteps, pushTokens, revenueItems, simplepayTransactions, taxPeriods } from '../src/db/schema.js';
import { spSign } from '../src/payments/simplepay.js';
import { filledLegalText } from '../src/services/contracts.js';
import { newClient, pdfBytes, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
beforeAll(async () => {
  h = await setup({ now: '2026-11-18T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence3@demo.kezjegy.test');
});
afterAll(async () => h.close());

const profile = {
  firstName: 'Dóra',
  lastName: 'Minta',
  adoazonositoJel: '8417104569',
  adoszam: '68801234-1-41',
  address: { zip: '1136', city: 'Budapest', line: 'Példa utca 12.' },
  hqMunicipality: 'Budapest',
  activityText: 'Grafika',
  activityAnswer: 'egyeb',
  taxStatus: 'fofoglalkozasu',
  evSince: '2019-04-01',
  hasSeparateBusinessAccount: true,
};

async function assigned(email: string, first = 'Dóra', o: { status?: string; profile?: boolean } = {}) {
  // Active clients: these suites test the tax, dossier and request features (locked before activation, SPEC §26.5).
  const c = await newClient(h, email, { first, active: true });
  if (o.profile !== false) await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, firstName: first, ...(o.status ? { taxStatus: o.status } : {}) } });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  return c;
}

let ipN = 0;
const ip = () => ({ 'x-forwarded-for': `10.33.${Math.floor(++ipN / 200)}.${ipN % 200}` });

describe('jogi szövegek: nincs kitöltetlen {{…}}', () => {
  it('egyik kiszolgált dokumentumban sincs {{, és az ismétlődő fizetés paraméterei kitöltve', async () => {
    for (const t of LEGAL_DOC_TYPES) {
      if (t === 'adatfeldolgozoi') continue;
      const r = await h.json('GET', `/legal/${t}`);
      expect(r.status, t).toBe(200);
      expect(r.body.markdown, t).not.toContain('{{');
    }
    const ism = (await h.json('GET', '/legal/simplepay_ismetlodo')).body.markdown as string;
    const nb = (s: string) => s.replace(/[  ]/g, ' ');
    expect(nb(ism)).toContain('alkalmanként legfeljebb 20 000 Ft');
    expect(ism).toContain('legfeljebb 12 alkalommal');
    expect(ism).toContain('2027. november 18-ig');
    const aszf = (await h.json('GET', '/legal/aszf')).body.markdown as string;
    expect(aszf).toContain('legfeljebb 12 levonásra');
    const meg = (await h.json('GET', '/legal/megbizasi_szerzodes')).body.markdown as string;
    expect(meg).toContain('(a neved)');
    expect(meg).toMatch(/A könyvelőd végzi személyesen|a könyvelőd végzi személyesen/);
  });

  it('az ügyfél által elfogadott (hash-elt) SimplePay-szöveg is kitöltött', async () => {
    const c = await assigned('jogi3@demo.kezjegy.test');
    for (const t of ['simplepay_ismetlodo', 'simplepay_adattovabbitas', 'aszf', 'megbizasi_szerzodes'] as const) {
      const f = await filledLegalText(h.deps, t, c.clientId);
      expect(f.text, t).not.toContain('{{');
    }
  });
});

describe('meghatalmazás: „Bence küldi be, én jóváhagyom” végig', () => {
  it('kér → könyvelő ugyfelre_var + megjegyzés → az app látja a módot és a megjegyzést → jóváhagy', async () => {
    const c = await assigned('peter3@demo.kezjegy.test', 'Péter');
    // SPEC §27.3.2 (11-19): "onya_konyvelo" is now an "Intézzük helyetted" request; it may come before the contract
    // (only the UJEGYKE filing waits for the contract), so it opens an assist instead of answering step_locked.
    const early = await h.json('POST', '/client/onboarding/meghatalmazas', { token: c.token, body: { method: 'onya_konyvelo' } });
    expect(early.status).toBe(200);
    expect(early.body.assists[0]).toMatchObject({ kind: 'meghatalmazas', status: 'visszahivas_kerve' });
    await h.deps.db.update(onboardingSteps).set({ status: 'kesz' }).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, 'szerzodes')));
    const ask = await h.json('POST', '/client/onboarding/meghatalmazas', { token: c.token, body: { method: 'onya_konyvelo' } });
    expect(ask.status).toBe(200);
    // the old step page now points to the assist page (one place for the state)
    const old = await h.json('POST', `/acc/clients/${c.clientId}/onboarding/meghatalmazas`, { token: bence.token, body: { status: 'ugyfelre_var', note: 'x' } });
    expect(old.status).toBe(409);
    const id = ask.body.assists[0].id as string;
    const { ASSIST_CHECK_ITEMS, ASSIST_CHECK_NOT_FOR_MH } = await import('../src/_shared/enums.js');
    const hivas = ASSIST_CHECK_ITEMS.hivas.filter((i) => !ASSIST_CHECK_NOT_FOR_MH.includes(i));
    const ujegyke = ASSIST_CHECK_ITEMS.ujegyke.filter((i) => !ASSIST_CHECK_NOT_FOR_MH.includes(i));
    expect((await h.json('POST', `/team/assists/${id}/agreed`, { token: bence.token, body: { items: hivas } })).status).toBe(200);
    expect((await h.json('POST', `/team/assists/${id}/ujegyke-filed`, { token: bence.token, body: { items: ujegyke, jogcim: '9' } })).status).toBe(200);
    const st = await h.json('GET', '/client/onboarding', { token: c.token });
    const step = st.body.steps.find((s: { step: string }) => s.step === 'meghatalmazas');
    expect(step).toMatchObject({ status: 'ugyfelre_var', data: { method: 'onya_konyvelo' } });
    expect(st.body.meghatalmazasMethod).toBe('onya_konyvelo');
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'assist_mh_filed')));
    expect(n!.title).toMatch(/^Hagyd jóvá a meghatalmazást /);
    const ok = await h.json('POST', '/client/onboarding/meghatalmazas', { token: c.token, body: { method: 'onya_konyvelo', approved: true } });
    expect(ok.status).toBe(200);
    const [row] = await h.deps.db.select().from(onboardingSteps).where(and(eq(onboardingSteps.clientId, c.clientId), eq(onboardingSteps.step, 'meghatalmazas')));
    expect(row!.status).toBe('konyvelore_var');
    expect((row!.data as { clientApprovedAt?: string }).clientApprovedAt).toBeTruthy();
  });
});

describe('kérések: a lezáró megjegyzés átér, az elutasítás nem „Elkészült”, ütközésnél 409', () => {
  it('az ügyfél válasza megjelenik a könyvelőnél (összegzés + üzenet)', async () => {
    const c = await assigned('valasz3@demo.kezjegy.test');
    const rq = await h.json('POST', `/acc/clients/${c.clientId}/requests`, { token: bence.token, body: { type: 'adat', title: 'Mikor kezdted a tevékenységet?', body: 'Kell a bejelentéshez.', dueDate: '2026-11-25' } });
    expect(rq.status).toBe(201);
    const done = await h.json('POST', `/client/requests/${rq.body.id}/complete`, { token: c.token, body: { note: 'Október 3-án kezdtem.' } });
    expect(done.status).toBe(200);
    const list = await h.json('GET', `/acc/clients/${c.clientId}/requests`, { token: bence.token });
    const mine = (list.body.items as { id: string; statusNote?: string; completedAt?: string }[]).find((x) => x.id === rq.body.id)!;
    expect(mine.statusNote).toBe('Október 3-án kezdtem.');
    expect(mine.completedAt).toBeTruthy();
    const msgs = await h.json('GET', `/acc/clients/${c.clientId}/messages`, { token: bence.token });
    expect(JSON.stringify(msgs.body.items)).toContain('Október 3-án kezdtem.');
  });

  it('„Nem lehet”: az ügyfél látja az okát, az értesítés nem „Elkészült”', async () => {
    const c = await assigned('elutasit3@demo.kezjegy.test');
    const rq = await h.json('POST', '/client/requests', { token: c.token, body: { type: 'nullas_igazolas', body: '', certificate: { certificateType: 'nullas_igazolas', purpose: 'pályázat', language: 'hu' } } });
    expect(rq.status).toBe(201);
    const no = await h.json('PATCH', `/acc/requests/${rq.body.id}`, { token: bence.token, body: { status: 'elutasitva', statusNote: 'Van nyitott tartozásod, előbb azt rendezzük.' } });
    expect(no.status).toBe(200);
    const mine = (await h.json('GET', '/client/requests', { token: c.token })).body.items.find((x: { id: string }) => x.id === rq.body.id);
    expect(mine).toMatchObject({ status: 'elutasitva', statusNote: 'Van nyitott tartozásod, előbb azt rendezzük.' });
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'request_done')));
    expect(n!.title).toBe('Bence nem tudja teljesíteni: Nullás igazolás');
    expect(n!.title).not.toContain('Elkészült');
    expect(n!.body).toContain('Van nyitott tartozásod');
    const msgs = await h.json('GET', '/client/messages', { token: c.token });
    expect(JSON.stringify(msgs.body.items)).toContain('Nem tudom teljesíteni (Nullás igazolás): Van nyitott tartozásod');
  });

  it('visszavont kérésre a könyvelő régi oldalról nem tud „Kész”-t mondani (409)', async () => {
    const c = await assigned('utkozes3@demo.kezjegy.test');
    const rq = await h.json('POST', '/client/requests', { token: c.token, body: { type: 'kerdes', body: 'Le kell adnom valamit?' } });
    expect((await h.json('POST', `/client/requests/${rq.body.id}/cancel`, { token: c.token })).status).toBe(200);
    const a = await h.json('PATCH', `/acc/requests/${rq.body.id}`, { token: bence.token, body: { status: 'folyamatban' } });
    expect(a.status).toBe(409);
    const b = await h.json('PATCH', `/acc/requests/${rq.body.id}`, { token: bence.token, body: { status: 'teljesitve' } });
    expect(b.status).toBe(409);
    const mine = (await h.json('GET', '/client/requests', { token: c.token })).body.items.find((x: { id: string }) => x.id === rq.body.id);
    expect(mine.status).toBe('visszavonva');
  });
});

describe('értesítések ideje és szövege', () => {
  it('az értesítés az alkalmazás órája szerinti időt kapja', async () => {
    const c = await assigned('ido3@demo.kezjegy.test');
    h.clock.set('2026-04-08T09:00:00Z');
    const rq = await h.json('POST', `/acc/clients/${c.clientId}/requests`, { token: bence.token, body: { type: 'egyeb', title: 'Teszt', body: 'x', dueDate: '2026-04-20' } });
    h.clock.set('2026-11-18T09:00:00Z');
    expect(rq.status).toBe(201);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'request_new')));
    expect(n!.createdAt.toISOString()).toBe('2026-04-08T09:00:00.000Z');
  });

  it('jóváhagyás: valódi utalásszám, 0 Ft-nál „nincs fizetendőd”', async () => {
    const { transfersText } = await import('../src/services/tax.js');
    expect([transfersText(1), transfersText(2), transfersText(3)]).toEqual(['egy utalással', 'két külön utalással', 'három külön utalással']);
    // mellékállás, no revenue → Q1 = 0 Ft
    const c = await assigned('nulla3@demo.kezjegy.test', 'Péter', { status: 'mellekallasu' });
    await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45, status: 'mellekallasu' } });
    const calc = await h.json('POST', `/acc/clients/${c.clientId}/tax-periods/2026-Q1/calculate`, { token: bence.token, body: { asOf: '2026-04-05' } });
    expect(calc.status).toBe(200);
    expect(calc.body.result.totalHuf).toBe(0);
    expect((await h.json('POST', `/acc/tax-calculations/${calc.body.id}/approve`, { token: bence.token, body: { letterText: 'Nincs fizetendő.' } })).status).toBe(200);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'tax_approved')));
    expect(n!.title).toBe('Nincs fizetendőd az I. negyedévben');
    expect(n!.body).not.toContain('külön utalással');
    expect(n!.body).toContain('nem kell utalnod');
    // főfoglalkozású below the tax-free part: TB + szocho only → "két külön utalással"
    const k = await assigned('ketto3@demo.kezjegy.test', 'Kata');
    await h.json('PATCH', `/acc/clients/${k.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45 } });
    const c2 = await h.json('POST', `/acc/clients/${k.clientId}/tax-periods/2026-Q1/calculate`, { token: bence.token, body: { asOf: '2026-04-05' } });
    await h.json('POST', `/acc/tax-calculations/${c2.body.id}/approve`, { token: bence.token, body: { letterText: 'Rendben.' } });
    const [n2] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, k.userId), eq(notifications.kind, 'tax_approved')));
    expect(n2!.title.replace(/[  ]/g, ' ')).toBe('Megvan az I. negyedévi összeg: 305 046 Ft');
    expect(n2!.body).toContain('két külön utalással');
  });
});

describe('iparűzési adó, éves határidők, nyugdíjas', () => {
  it('HIPA-kulcs számolása érthető 409; kézi jóváhagyás → tétel az önkormányzat számlájára, határidő az appban', async () => {
    const c = await assigned('hipa3@demo.kezjegy.test', 'Kata');
    await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45, hipa: { method: 'savos', ratePct: 2 } } });
    const list = await h.json('GET', `/acc/clients/${c.clientId}/tax-periods?year=2026`, { token: bence.token });
    const hp = list.body.items.find((p: { periodKey: string }) => p.periodKey === '2026-HIPA-1');
    expect(hp.label).toBe('2026. évi iparűzési adóelőleg');
    expect(hp.hipa.manual).toBe(true);
    expect(hp.hipa.estimate.annualHuf).toBeGreaterThan(0);
    expect(hp.filing.reason).toContain('nincs külön bevallás');
    const calc = await h.json('POST', `/acc/clients/${c.clientId}/tax-periods/2026-HIPA-1/calculate`, { token: bence.token, body: {} });
    expect(calc.status).toBe(409);
    expect(calc.body.error.message).toContain('kézzel');
    const noAcc = await h.json('POST', `/acc/tax-periods/${hp.id}/hipa-approve`, { token: bence.token, body: { amountHuf: 50_000 } });
    expect(noAcc.status).toBe(400);
    const ok = await h.json('POST', `/acc/tax-periods/${hp.id}/hipa-approve`, { token: bence.token, body: { amountHuf: 50_000, accountNumber: '11784009-15490012' } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ calcStatus: 'jovahagyva', paymentStatus: 'fizetendo', totalHuf: 50_000 });
    const det = await h.json('GET', `/client/tax-periods/${hp.id}`, { token: c.token });
    expect(det.body.items[0]).toMatchObject({ kind: 'hipa_eloleg', amountHuf: 50_000, accountNumber: '11784009-15490012' });
    expect(det.body.items[0].iban).toMatch(/^HU\d{26}$/);
    const dl = await h.json('GET', '/client/deadlines?from=2026-01-01&to=2027-12-31', { token: c.token });
    const titles = (dl.body.items as { title: string; dueDate: string }[]).map((d) => `${d.dueDate} ${d.title}`);
    expect(titles).toContain('2026-06-01 2026. évi iparűzési adóelőleg');
    expect(titles.some((t) => t.startsWith('2027-05-20 Éves SZJA-bevallás (26SZJA) a 2026-os évről'))).toBe(true);
    expect(titles.some((t) => t.startsWith('2027-05-31 Iparűzési adó 2026'))).toBe(true);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'tax_approved')));
    expect(n!.title.replace(/[  ]/g, ' ')).toBe('Megvan az iparűzési adóelőleg: 50 000 Ft');
  });

  it('nyugdíjas: csak SZJA-előleg, nincs negyedéves bevallás, nem jelölhető beadottnak', async () => {
    const c = await assigned('nyugdij3@demo.kezjegy.test', 'Teréz', { status: 'nyugdijas' });
    await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45, status: 'nyugdijas' } });
    const list = await h.json('GET', `/acc/clients/${c.clientId}/tax-periods?year=2026`, { token: bence.token });
    const q3 = list.body.items.find((p: { periodKey: string }) => p.periodKey === '2026-Q3');
    expect(q3.filing.canFile).toBe(false);
    expect(q3.filing.reason).toContain('Nyugdíjas');
    const [row] = await h.deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, c.clientId), eq(taxPeriods.periodKey, '2026-Q3')));
    expect(row!.filingForm).toBeNull();
    const dl = await h.json('GET', '/client/deadlines?from=2026-11-01&to=2027-02-01', { token: c.token });
    const titles = (dl.body.items as { title: string }[]).map((d) => d.title);
    expect(titles).toContain('IV. negyedév: SZJA-előleg');
    expect(titles.some((t) => t.includes('bevallás (a könyvelőd adja be)') && t.startsWith('IV.'))).toBe(false);
  });

  it('a még tartó negyedév beadási oka magyar dátummal', async () => {
    const c = await assigned('datum3@demo.kezjegy.test');
    await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45 } });
    const list = await h.json('GET', `/acc/clients/${c.clientId}/tax-periods?year=2026`, { token: bence.token });
    const q4 = list.body.items.find((p: { periodKey: string }) => p.periodKey === '2026-Q4');
    expect(q4.filing.reason).toBe('Az időszak még tart (2026. december 31. a vége), ezért még nem adható be.');
  });

  it('kedvezmény a profilban → figyelmeztetés az ügyfélnek és a könyvelőnek', async () => {
    const c = await assigned('kedv3@demo.kezjegy.test');
    const r = await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45, allowances: [{ kind: 'fiatal_25' }] } });
    expect(r.status).toBe(200);
    expect(r.body.allowances).toEqual([{ kind: 'fiatal_25' }]);
    const list = await h.json('GET', `/acc/clients/${c.clientId}/tax-periods?year=2026`, { token: bence.token });
    const q3 = list.body.items.find((p: { periodKey: string }) => p.periodKey === '2026-Q3');
    expect(JSON.stringify(q3.latestCalculation.context.warnings)).toContain('kedvezmeny_nem_modellezett');
  });
});

describe('demo-postafiók és szövegek: más munkatárs belépési kódja nem olvasható', () => {
  it('a belépési levelek sablonja nem szerkeszthető, a másik munkatárs kódja rejtve', async () => {
    const admin = await staff(h, 'admin', 'admin3@demo.kezjegy.test');
    const edit = await h.json('PUT', '/admin/content-texts/email.auth_password_reset_code.subject', { token: admin.token, body: { body: 'Belépési kód: X{code}X' } });
    expect(edit.status).toBe(403);
    const okEdit = await h.json('PUT', '/admin/content-texts/notif.request_done.title', { token: admin.token, body: { body: 'Elkészült: {title}' } });
    expect(okEdit.status).toBe(200);
    // the mailer stores the template; the harness mailer is a stub, so write rows the way the demo mailer does
    const { createMailer } = await import('../src/notify/mailer.js');
    const real = createMailer({ ...h.deps.cfg, mail: { ...h.deps.cfg.mail, mode: 'demo' } }, h.deps.db);
    await real.send({ to: 'bence3@demo.kezjegy.test', subject: 'Kód X123456X', text: 'X123456X', template: 'auth_password_reset_code' });
    await real.send({ to: 'bence3@demo.kezjegy.test', subject: 'Új üzenet', text: 'Nyisd meg.', template: 'message_new' });
    const ob = await h.json('GET', '/admin/demo-outbox', { token: admin.token });
    expect(ob.status).toBe(200);
    expect(JSON.stringify(ob.body.items)).not.toContain('123456');
    expect(JSON.stringify(ob.body.items)).toContain('Nyisd meg.');
    const [row] = await h.deps.db.select().from(demoOutbox).where(sql`${demoOutbox.template} = 'auth_password_reset_code'`);
    expect(row!.bodyText).toBe('X123456X');
  });

  it('jelszó-visszaállítás után a tulajdonos értesítő levelet kap', async () => {
    await newClient(h, 'reset3@demo.kezjegy.test');
    await h.json('POST', '/auth/password/forgot', { body: { email: 'reset3@demo.kezjegy.test' }, headers: ip() });
    const code = [...h.mails].reverse().find((m) => m.to === 'reset3@demo.kezjegy.test' && m.template === 'auth_password_reset_code')!.text.match(/\b(\d{6})\b/)![1];
    const r = await h.json('POST', '/auth/password/reset', { body: { email: 'reset3@demo.kezjegy.test', code, newPassword: 'Uj-Hosszu-Jelszo-2026!' }, headers: ip() });
    expect(r.status).toBe(204);
    expect(h.mails.some((m) => m.to === 'reset3@demo.kezjegy.test' && m.template === 'auth_password_changed')).toBe(true);
  });
});

describe('admin átsorolás: senki nem kerül át csendben', () => {
  it('az ügyfél üzenetet és értesítést kap, mindkét könyvelő levelet', async () => {
    const admin = await staff(h, 'admin', 'admin4@demo.kezjegy.test');
    const anna = await staff(h, 'accountant', 'anna3@demo.kezjegy.test', { firstName: 'Anna' });
    const c = await assigned('atsorol3@demo.kezjegy.test');
    const r = await h.json('PATCH', `/admin/clients/${c.clientId}`, { token: admin.token, body: { accountantId: anna.accountantId } });
    expect(r.status).toBe(200);
    const msgs = await h.json('GET', '/client/messages', { token: c.token });
    expect(JSON.stringify(msgs.body.items)).toContain('Mostantól Kovács Anna a könyvelőd.');
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'message_new')));
    expect(n!.title).toBe('Új könyvelőd van: Kovács Anna');
    const sys = await h.json('GET', '/admin/system', { token: admin.token });
    expect(sys.body.recentStaffChanges.some((x: { action: string }) => x.action === 'admin.client_reassigned')).toBe(true);
  });

  it('kötelező 2FA mellett 2FA nélküli könyvelő nem kaphat ügyfelet', async () => {
    const h2 = await setup({ now: '2026-11-18T09:00:00Z', env: { STAFF_TOTP_REQUIRED: 'true' } });
    try {
      const { users, accountants } = await import('../src/db/schema.js');
      const { hashPassword } = await import('../src/lib/password.js');
      const [u] = await h2.deps.db.insert(users).values({ email: 'adm@demo.kezjegy.test', role: 'admin', displayName: 'Admin', passwordHash: await hashPassword(PW), emailVerifiedAt: h2.clock.now() }).returning();
      const [ua] = await h2.deps.db.insert(users).values({ email: 'acc@demo.kezjegy.test', role: 'accountant', displayName: 'Új Könyvelő', emailVerifiedAt: h2.clock.now() }).returning();
      const [a] = await h2.deps.db.insert(accountants).values({ userId: ua!.id, displayName: 'Új Könyvelő', firstName: 'Új' }).returning();
      const { pickAccountant } = await import('../src/services/accounts.js');
      expect(await pickAccountant(h2.deps.db, { requireTotp: true })).toBeNull();
      // admin token without TOTP: use the service-level check through the route's validation instead
      const { signAccess, createSession } = await import('../src/auth/tokens.js');
      await h2.deps.db.update(users).set({ totpEnabledAt: h2.clock.now() }).where(eq(users.id, u!.id));
      const s = await createSession(h2.deps, h2.deps.db, { userId: u!.id, clientKind: 'panel', userAgent: 't', ipHmac: 'x', staff: true });
      const tok = (await signAccess(h2.deps, { userId: u!.id, role: 'admin', sessionId: s.sessionId })).token;
      const cl = await newClient(h2, 'kliens@demo.kezjegy.test');
      const r = await h2.json('PATCH', `/admin/clients/${cl.clientId}`, { token: tok, body: { accountantId: a!.id } });
      expect(r.status).toBe(400);
      expect(r.body.error.fields.accountantId).toContain('kétlépcsős');
    } finally {
      await h2.close();
    }
  });
});

describe('SimplePay: későbbi IPN nem írja felül a végleges állapotot', () => {
  it('REVERSED a FINISHED után: a státusz marad, külön rögzítve, admin-riasztás', async () => {
    const c = await assigned('ipn3@demo.kezjegy.test', 'Kata');
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const start = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', acceptedDeclarations: true } });
    expect(start.status).toBe(200);
    const orderRef = start.body.orderRef as string;
    await h.req('POST', '/payments/demo/pay', { raw: `o=${encodeURIComponent(orderRef)}&eredmeny=ok`, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    const [tx] = await h.deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, orderRef));
    expect(tx!.status).toBe('FINISHED');
    const body = JSON.stringify({ salt: 'abc', orderRef, method: 'CARD', merchant: 'DEMO', transactionId: tx!.simplepayTransactionId, status: 'REVERSED' });
    const r = await h.req('POST', '/webhooks/simplepay/ipn', { raw: body, headers: { 'content-type': 'application/json', signature: spSign(h.deps.cfg.simplepay.demoSecret, body) } });
    expect(r.status).toBe(200);
    const [after] = await h.deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, orderRef));
    expect(after!.status).toBe('FINISHED');
    expect(after!.afterFinalStatus).toBe('REVERSED');
    const al = await h.deps.db.select().from(auditLog).where(eq(auditLog.action, 'payment.after_final'));
    expect(al.length).toBe(1);
  });
});

describe('push-token: nem vehető át egy másik telepítésről', () => {
  it('más telepítésről nem költözik; ugyanarról igen', async () => {
    const a = await newClient(h, 'pusha3@demo.kezjegy.test');
    const b = await newClient(h, 'pushb3@demo.kezjegy.test');
    const token = 'ExponentPushToken[abcdefghijklmnop]';
    expect((await h.json('POST', '/me/push-tokens', { token: a.token, body: { token, platform: 'android', installationId: 'telepites-A-1234' } })).status).toBe(204);
    expect((await h.json('POST', '/me/push-tokens', { token: b.token, body: { token, platform: 'android', installationId: 'telepites-B-9999' } })).status).toBe(204);
    let [row] = await h.deps.db.select().from(pushTokens).where(eq(pushTokens.token, token));
    expect(row!.userId).toBe(a.userId);
    expect((await h.json('POST', '/me/push-tokens', { token: b.token, body: { token, platform: 'android', installationId: 'telepites-A-1234' } })).status).toBe(204);
    [row] = await h.deps.db.select().from(pushTokens).where(eq(pushTokens.token, token));
    expect(row!.userId).toBe(b.userId);
  });
});

describe('feltöltés: beadott irat nem cserélhető, hónap-határok, PNG-korlát', () => {
  it('beadva / feldolgozva státuszú iratra nincs új változat (409)', async () => {
    const c = await assigned('verzio3@demo.kezjegy.test');
    const fd = new FormData();
    fd.append('category', 'bankszamlakivonat');
    fd.append('dossierMonth', '2026-09');
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'k.pdf');
    const d = await h.json('POST', '/client/documents', { token: c.token, form: fd });
    expect(d.status).toBe(201);
    for (const st of ['beadva', 'feldolgozva'] as const) {
      await h.deps.db.update(documents).set({ status: st }).where(eq(documents.id, d.body.id));
      const v = new FormData();
      v.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'k2.pdf');
      const r = await h.json('POST', `/client/documents/${d.body.id}/versions`, { token: c.token, form: v });
      expect(r.status, st).toBe(409);
    }
  });

  it('jövőbeli és túl régi hónap elutasítva; beadott negyedévbe érkező irat jelölve', async () => {
    const c = await assigned('honap3@demo.kezjegy.test');
    const up = (month: string) => {
      const fd = new FormData();
      fd.append('category', 'nyugta');
      fd.append('dossierMonth', month);
      fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'n.pdf');
      return h.json('POST', '/client/documents', { token: c.token, form: fd });
    };
    expect((await up('2031-05')).status).toBe(400);
    expect((await up('2019-01')).status).toBe(400);
    expect((await up('2025-01')).status).toBe(201);
    await h.deps.db.insert(taxPeriods).values({ clientId: c.clientId, kind: 'negyedev', periodKey: '2026-Q3', year: 2026, quarter: 3, dueDate: '2026-10-12' }).onConflictDoNothing();
    await h.deps.db
      .update(taxPeriods)
      .set({ filingStatus: 'beadva', filedAt: new Date('2026-10-12T10:00:00Z'), filedOn: '2026-10-12' })
      .where(and(eq(taxPeriods.clientId, c.clientId), eq(taxPeriods.periodKey, '2026-Q3')));
    const late = await up('2026-09');
    expect(late.status).toBe(201);
    const docs = await h.json('GET', `/acc/clients/${c.clientId}/dossiers/2026-09`, { token: bence.token });
    const item = JSON.stringify(docs.body);
    expect(item).toContain('"afterFiling":true');
    const [n] = await h.deps.db.select().from(notifications).where(sql`${notifications.body} like '%a beadás után érkezett%'`);
    expect(n).toBeTruthy();
  });

  it('nagy vásznú PNG-oldalak nem dekódolódnak (413)', async () => {
    const c = await assigned('png3@demo.kezjegy.test');
    // A PNG header that declares 3000×3000 px (9 MP > 8 MP per page): refused before any decoding.
    const head = Buffer.alloc(33);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0);
    head.writeUInt32BE(13, 8);
    head.write('IHDR', 12, 'latin1');
    head.writeUInt32BE(3000, 16);
    head.writeUInt32BE(3000, 20);
    const fd = new FormData();
    fd.append('category', 'nyugta');
    fd.append('dossierMonth', '2026-11');
    for (let i = 0; i < 2; i++) fd.append('pages', new Blob([new Uint8Array(head) as BlobPart], { type: 'image/png' }), `p${i}.png`);
    const r = await h.json('POST', '/client/documents', { token: c.token, form: fd });
    expect(r.status).toBe(413);
  });
});

describe('CSV: a még meg nem érkezett bevétel nincs benne', () => {
  it('a jövőbeli beérkezésű sor kimarad, kérésre „várható” jelöléssel jön', async () => {
    const c = await assigned('csv3@demo.kezjegy.test');
    await h.deps.db.insert(revenueItems).values([
      { clientId: c.clientId, source: 'kezi', receivedOn: '2026-11-10', deliveryDate: '2026-11-10', amountHuf: 100_000, description: 'Megjött' },
      { clientId: c.clientId, source: 'kezi', receivedOn: '2026-11-26', deliveryDate: '2026-11-20', amountHuf: 200_000, description: 'Várható', receivedOnEstimated: true },
    ]);
    const r = await h.req('GET', `/acc/export/revenue.csv?year=2026&clientIds=${c.clientId}`, { token: bence.token });
    const text = await r.text();
    expect(text).toContain('Megjött');
    expect(text).not.toContain('Várható');
    const r2 = await h.req('GET', `/acc/export/revenue.csv?year=2026&clientIds=${c.clientId}&includeExpected=1`, { token: bence.token });
    expect(await r2.text()).toContain('várható (még nem jött meg)');
  });
});

describe('2FA bekapcsolása lopott munkamenettel', () => {
  it('10 perc után jelszó kell; bekapcsoláskor a többi munkamenet véget ér, levél megy', async () => {
    const c = await newClient(h, 'totp3@demo.kezjegy.test');
    const other = await h.json('POST', '/auth/login', { body: { email: 'totp3@demo.kezjegy.test', password: PW, clientKind: 'native' }, headers: ip() });
    h.clock.advance(11 * 60_000);
    // the first session is old now (an access token refreshed by a thief would look the same)
    const ref = await h.json('POST', '/auth/refresh', { body: { refreshToken: c.refreshToken } });
    expect(ref.status).toBe(200);
    const no = await h.json('POST', '/auth/totp/setup', { token: ref.body.accessToken, body: {} });
    expect(no.status).toBe(403);
    expect(no.body.error.code).toBe('reauth_required');
    const bad = await h.json('POST', '/auth/totp/setup', { token: ref.body.accessToken, body: { currentPassword: 'nem-ez' } });
    expect(bad.status).toBe(400);
    const st = await h.json('POST', '/auth/totp/setup', { token: ref.body.accessToken, body: { currentPassword: PW } });
    expect(st.status).toBe(200);
    const { base32Decode, totp } = await import('../src/lib/totp.js');
    const en = await h.json('POST', '/auth/totp/enable', { token: ref.body.accessToken, body: { code: totp(base32Decode(st.body.secret), h.clock.now().getTime()), currentPassword: PW } });
    expect(en.status).toBe(200);
    expect((await h.json('POST', '/auth/refresh', { body: { refreshToken: other.body.refreshToken } })).status).toBe(401);
    expect(h.mails.some((m) => m.to === 'totp3@demo.kezjegy.test' && m.template === 'auth_totp_changed')).toBe(true);
    h.clock.set('2026-11-18T09:00:00Z');
  });
});

describe('befizetés napja: az utolsó utalásé', () => {
  it('két külön napon jelzett tételnél a későbbi nap', async () => {
    const c = await assigned('fizet3@demo.kezjegy.test', 'Réka');
    await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45 } });
    await h.deps.db.update(onboardingSteps).set({ status: 'kesz' }).where(eq(onboardingSteps.clientId, c.clientId));
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const calc = await h.json('POST', `/acc/clients/${c.clientId}/tax-periods/2026-Q3/calculate`, { token: bence.token, body: { asOf: '2026-10-02' } });
    await h.json('POST', `/acc/tax-calculations/${calc.body.id}/approve`, { token: bence.token, body: { letterText: 'Rendben.' } });
    const [p] = await h.deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, c.clientId), eq(taxPeriods.periodKey, '2026-Q3')));
    expect((await h.json('POST', `/client/tax-periods/${p!.id}/mark-paid`, { token: c.token, body: { kinds: ['tb_jarulek'], paidOn: '2026-11-16' } })).status).toBe(200);
    expect((await h.json('POST', `/client/tax-periods/${p!.id}/mark-paid`, { token: c.token, body: { kinds: ['szocho'], paidOn: '2026-11-18' } })).status).toBe(200);
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.body.hero.paidOn).toBe('2026-11-18');
  });
});
