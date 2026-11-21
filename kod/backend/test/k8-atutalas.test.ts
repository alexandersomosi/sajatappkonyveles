// k8 ALAP-B – bank transfer with a monthly díjbekérő: customer numbers; the díjbekérő XML (XSD order, dijbekero=true,
// fizetve=false, fizmod Átutalás, kelt + 8 nap, sendEmail=false) and the query answer (kifizetesek); the DEMO flow from
// the choice to the active client (manual mark with step-up → payment 'atutalas' → same success path → own invoice mail
// with PDF); monthly díjbekérő on the first day of the period, never twice, never charged by `billing`; late: day 1/4/8
// reminders once each, no lock unless kesesLeallit is ON; the switch (DEMO ON, OFF → 409, existing transfer clients keep
// getting díjbekérők); a Számlázz.hu (fake Agent) reconciliation incl. the final invoice with dijbekeroSzamlaszam; the
// card paying the first month withdraws the open díjbekérő; the callback offer before the payment (B5).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { and, desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { callbackRequests, clients, feeInvoices, notifications, onboardingSteps, payments, plans, subscriptions, systemState, transferRequests, users } from '../src/db/schema.js';
import { buildProformaXml } from '../src/payments/dijbekero.js';
import { buildInvoiceXml, parseDocDetails, SzamlazzError, type SzamlazzClient, type SzDocDetails } from '../src/payments/szamlazzhu.js';
import { jobTransferIssue, jobTransferReconcile, jobTransferReminders, periodSpace } from '../src/services/atutalas.js';
import { runBillingJob } from '../src/services/subscription.js';
import { jobInvoicesIssue } from '../src/payments/invoices.js';
import { computeServiceLock } from '../src/services/zarolas.js';
import { dispatchPending } from '../src/notify/notify.js';
import { base32Decode, base32Encode, totp } from '../src/lib/totp.js';
import { orderNoOf, kozlemenyOf } from '../src/_shared/k8.js';
import { acceptContract, newClient, PW, setup, staff, type Harness, type Mail } from './helpers.js';

const XSD = readFileSync(join(__dirname, 'fixtures', 'szamlazz', 'xmlszamla.xsd'), 'utf8');
const AGENT = ['agent', 'key', 'fake', 'k8'].join('-');
const SECRET = base32Encode(Buffer.from('12345678901234567890'));
const profile = {
  firstName: 'Zoé',
  lastName: 'Kiss',
  adoazonositoJel: '8417104569',
  adoszam: '68801234-1-41',
  address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' },
  hqMunicipality: 'Budapest',
  activityText: 'Grafika',
  activityAnswer: 'egyeb',
  taxStatus: 'fofoglalkozasu',
  evSince: '2019-04-01',
  hasSeparateBusinessAccount: true,
};

function sequence(src: string, typeName: string): string[] {
  const block = new RegExp(`<complexType name="${typeName}">([\\s\\S]*?)</complexType>`).exec(src)![1]!;
  return [...block.matchAll(/<element name="(\w+)"/g)].map((m) => m[1]!);
}
function childrenOf(xml: string, section: string, indent: number): string[] {
  const lines = xml.split('\n');
  const start = lines.findIndex((l) => l.trim() === `<${section}>`);
  const out: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]!;
    if (l.trim() === `</${section}>`) break;
    const m = /^(\s*)<(\w+)>/.exec(l);
    if (m && m[1]!.length === indent) out.push(m[2]!);
  }
  return out;
}
const inOrder = (ours: string[], seq: string[]) => ours.map((n) => seq.indexOf(n)).every((v, i, a) => v >= 0 && (i === 0 || v > a[i - 1]!));
const buyer = { name: 'Kiss Zoé e.v.', firstName: 'Zoé', zip: '1136', city: 'Budapest', address: 'Példa utca 7.', adoszam: '68801234-1-41', email: 'zoe@demo.kezjegy.test' };

describe('rules: order number, memo, XML, query answer', () => {
  it('order number unique per month (re-issue -2), memo by the switch', () => {
    expect(orderNoOf(10482, '2026-12-20')).toBe('ADZ-10482-2026-12');
    expect(orderNoOf(10482, '2026-12-20', 2)).toBe('ADZ-10482-2026-12-2');
    expect(kozlemenyOf(10482, 'ADZ-10482-2026-12', 'havi')).toBe('ADZ-10482-2026-12');
    expect(kozlemenyOf(10482, 'ADZ-10482-2026-12', 'allando')).toBe('ADZ-10482');
  });
  it('díjbekérő XML: XSD order, dijbekero=true, fizetve=false, Átutalás, due day, sendEmail=false, our key twice', () => {
    const x = buildProformaXml(AGENT, { orderNo: 'ADZ-10482-2026-12', kozlemeny: 'ADZ-10482-2026-12', issueDate: '2026-12-20', dueDate: '2026-12-28', buyer, line: { megnevezes: 'Könyvelési szolgáltatás – havidíj', unit: 'hó', grossHuf: 19_999 }, replyTo: null });
    expect(inOrder(childrenOf(x, 'fejlec', 4), sequence(XSD, 'fejlecTipus'))).toBe(true);
    expect(inOrder(childrenOf(x, 'vevo', 4), sequence(XSD, 'vevoTipus'))).toBe(true);
    expect(x).toContain('<dijbekero>true</dijbekero>');
    expect(x).toContain('<fizetve>false</fizetve>');
    expect(x).toContain('<fizmod>Átutalás</fizmod>');
    expect(x).toContain('<fizetesiHataridoDatum>2026-12-28</fizetesiHataridoDatum>');
    expect(x).toContain('<sendEmail>false</sendEmail>');
    expect(x).toContain('<rendelesSzam>ADZ-10482-2026-12</rendelesSzam>');
    expect(x).toContain('<szamlaKulsoAzon>ADZ-10482-2026-12</szamlaKulsoAzon>');
    expect(x).toContain('Közlemény: ADZ-10482-2026-12');
  });
  it('the card invoice XML is unchanged by the new fields (no dijbekeroSzamlaszam, Bankkártya, fizetve=true)', () => {
    const x = buildInvoiceXml(AGENT, { key: 'ADZ-0123456789abcdef0123', issueDate: '2026-11-20', paymentDate: '2026-11-20', buyer, line: { megnevezes: 'x', unit: 'hó', grossHuf: 19_999 }, replyTo: null, emailTargy: 't', emailSzoveg: 's', megjegyzes: 'm' });
    expect(x).not.toContain('dijbekeroSzamlaszam');
    expect(x).toContain('<fizmod>Bankkártya</fizmod>');
    expect(x).toContain('<dijbekero>false</dijbekero>');
    expect(x).toContain('<fizetve>true</fizetve>');
    const t = buildInvoiceXml(AGENT, { key: 'ADZ-1', issueDate: '2026-11-21', paymentDate: '2026-11-21', buyer, line: { megnevezes: 'x', unit: 'hó', grossHuf: 19_999 }, replyTo: null, emailTargy: 't', emailSzoveg: 's', megjegyzes: 'm', fizmod: 'Átutalás', dijbekeroSzamlaszam: 'D-2026-7', sendEmail: false });
    expect(inOrder(childrenOf(t, 'fejlec', 4), sequence(XSD, 'fejlecTipus'))).toBe(true);
    expect(t).toContain('<dijbekeroSzamlaszam>D-2026-7</dijbekeroSzamlaszam>');
  });
  it('query answer (docs.szamlazz.hu "Számla XML lekérdezése – válasz"): type, due day, payments, converted invoice', () => {
    const d = parseDocDetails(`<?xml version="1.0"?><szamla xmlns="http://www.szamlazz.hu/szamla"><alap><id>1</id><szamlaszam>D-2026-7</szamlaszam><tipus>D</tipus><fizh>2026-12-28</fizh></alap><osszegek><totalossz><netto>15747.24</netto><afa>4251.76</afa><brutto>19999</brutto></totalossz></osszegek><kifizetesek><kifizetes><datum>2026-12-23</datum><jogcim>átutalás</jogcim><osszeg>19999</osszeg></kifizetes></kifizetesek></szamla>`)!;
    expect(d).toMatchObject({ number: 'D-2026-7', tipus: 'D', dueOn: '2026-12-28', grossHuf: 19_999, paidHuf: 19_999 });
    expect(d.payments[0]).toMatchObject({ datum: '2026-12-23', osszeg: 19_999 });
    const s = parseDocDetails(`<szamla><alap><szamlaszam>E-2026-9</szamlaszam><tipus>SZ</tipus><hivdijbekszam>D-2026-7</hivdijbekszam></alap></szamla>`)!;
    expect(s).toMatchObject({ number: 'E-2026-9', tipus: 'SZ', refProforma: 'D-2026-7', paidHuf: 0 });
    expect(parseDocDetails('<xmlszamlavalasz><sikeres>false</sikeres></xmlszamlavalasz>')).toBeNull();
    expect(periodSpace('2026-11-20', '2026-12-20')).toBe('2026. 11. 20. – 12. 19.');
    expect(periodSpace('2026-12-20', '2027-01-20')).toBe('2026. 12. 20. – 2027. 01. 19.');
  });
});

// =====================================================================================================================
describe('DEMO: choose → díjbekérő → manual mark → active → monthly → late', () => {
  let h: Harness;
  let admin: { token: string; userId: string };
  const kod = () => totp(base32Decode(SECRET), h.clock.now().getTime());
  const stepUp = async () => {
    h.clock.advance(31_000);
    expect((await h.json('POST', '/admin/console/step-up', { token: admin.token, body: { code: kod() } })).status).toBe(200);
  };
  const adminLogin = async () => {
    const a = (await h.json('POST', '/auth/login', { body: { email: 'admin.k8@demo.kezjegy.test', password: PW, clientKind: 'panel' } })).body;
    h.clock.advance(31_000);
    admin.token = (await h.json('POST', '/auth/login/totp', { body: { mfaToken: a.mfaToken, code: kod() } })).body.accessToken;
  };
  let ipN = 0;
  const relogin = async (email: string) => (await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'native' }, headers: { 'x-forwarded-for': `10.77.0.${++ipN}` } })).body.accessToken as string;
  async function onboardingClient(email: string) {
    const c = await newClient(h, email, { first: 'Zoé', last: 'Kiss' });
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    await acceptContract(h, c.token);
    return c;
  }
  const mailsTo = (to: string, template?: string) => h.mails.filter((m: Mail) => m.to === to && (!template || m.template === template));

  beforeAll(async () => {
    h = await setup({ now: '2026-11-20T09:00:00Z' });
    await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
    const a = await staff(h, 'admin', 'admin.k8@demo.kezjegy.test');
    admin = { token: a.token, userId: a.userId };
    await h.deps.db.update(users).set({ totpSecretEnc: h.deps.data.enc(SECRET, 'users.totp_secret'), totpEnabledAt: h.clock.now() }).where(eq(users.id, a.userId));
    h.deps.sessionCache.clear();
    await adminLogin();
  });
  afterAll(async () => h.close());

  it('every client gets an increasing customer number from 10001', async () => {
    const a = await newClient(h, 'szam1@demo.kezjegy.test');
    const b = await newClient(h, 'szam2@demo.kezjegy.test');
    const [x] = await h.deps.db.select({ no: clients.customerNo }).from(clients).where(eq(clients.id, a.clientId));
    const [y] = await h.deps.db.select({ no: clients.customerNo }).from(clients).where(eq(clients.id, b.clientId));
    expect(x!.no).toBeGreaterThanOrEqual(10001);
    expect(y!.no).toBe(x!.no! + 1);
  });

  it('DEMO: the switch is ON by default and /config says so', async () => {
    expect((await h.json('GET', '/config')).body.fizetes).toEqual({ atutalas: true });
    const c = await onboardingClient('nezo@demo.kezjegy.test');
    const v = await h.json('GET', '/client/billing', { token: c.token });
    expect(v.status).toBe(200);
    expect(v.body).toMatchObject({ method: 'kartya', transferAvailable: true, open: [], kozlemenyMode: 'havi' });
  });

  let zoe: Awaited<ReturnType<typeof onboardingClient>>;
  let first: typeof transferRequests.$inferSelect;
  it('Bekötés → "Átutalással fizetek": the first díjbekérő now (DEMO PDF, own mail with the PDF, in-app row), once', async () => {
    zoe = await onboardingClient('zoe@demo.kezjegy.test');
    const r = await h.json('POST', '/client/billing/transfer', { token: zoe.token, body: { purpose: 'subscribe' } });
    expect(r.status).toBe(200);
    expect(r.body.method).toBe('atutalas');
    expect(r.body.open).toHaveLength(1);
    const o = r.body.open[0];
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, zoe.clientId));
    expect(o).toMatchObject({ kind: 'elso_havi', amountHuf: 19_999, status: 'kiallitva', issuedOn: '2026-11-20', dueOn: '2026-11-28', orderNo: `ADZ-${cl!.customerNo}-2026-11`, kozlemeny: `ADZ-${cl!.customerNo}-2026-11`, demo: true, period: null });
    expect(o.proformaNumber).toMatch(/^DEMO-D-2026-\d{6}$/);
    expect(o.pdfFileId).toBeTruthy();
    expect(o.payTo).toMatchObject({ beneficiary: 'Somosi Kft.', accountNo: '11600006-00000002-04741855', amountHuf: 19_999, dueOn: '2026-11-28' });
    const m = mailsTo('zoe@demo.kezjegy.test', 'transfer_request');
    expect(m).toHaveLength(1);
    expect(m[0]!.subject).toBe('Díjbekérő a havidíjról: 19 999 Ft');
    expect(m[0]!.text).toContain('Szia, Zoé!');
    expect(m[0]!.text).toContain(`Közlemény: ${o.kozlemeny}`);
    expect(m[0]!.text).not.toMatch(/a\(z\)/);
    expect((m[0] as Mail & { attachments?: { filename: string }[] }).attachments?.[0]?.filename).toMatch(/^dijbekero-DEMO-D-/);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, zoe.userId), eq(notifications.kind, 'transfer_request')));
    expect(n).toMatchObject({ wantEmail: false, wantPush: true, link: '/fiok/elofizetes' });
    // again: the same open díjbekérő, no second document
    const again = await h.json('POST', '/client/billing/transfer', { token: zoe.token, body: { purpose: 'subscribe' } });
    expect(again.body.open).toHaveLength(1);
    expect(await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, zoe.clientId))).toHaveLength(1);
    [first] = await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, zoe.clientId));
    // the card is not charged while the client waits; DEMO reconciliation leaves it open (no "utal+" address)
    expect((await jobTransferReconcile(h.deps)).fizetett).toBe(0);
  });

  it('console: list + tile; manual mark needs the step-up, the exact amount and a day; then the client is active', async () => {
    const list = await h.json('GET', '/admin/console/transfers?status=var', { token: admin.token });
    expect(list.status).toBe(200);
    expect(list.body.items.map((x: { id: string }) => x.id)).toContain(first.id);
    const tile = await h.json('GET', '/admin/console/transfers/summary', { token: admin.token });
    expect(tile.body).toMatchObject({ var: 1, kesik: 0, ugyfelek: 1 });
    const noStep = await h.json('POST', `/admin/console/transfers/${first.id}/paid`, { token: admin.token, body: { paidOn: '2026-11-22', amountHuf: 19_999, reason: 'Erste kivonat' } });
    expect(noStep.status).toBe(403);
    expect(noStep.body.error.code).toBe('step_up_required');
    h.clock.set('2026-11-22T10:00:00Z');
    await adminLogin();
    await stepUp();
    const wrong = await h.json('POST', `/admin/console/transfers/${first.id}/paid`, { token: admin.token, body: { paidOn: '2026-11-22', amountHuf: 19_000, reason: 'Erste kivonat' } });
    expect(wrong.status).toBe(409);
    expect(wrong.body.error.code).toBe('osszeg_elteres');
    const ok = await h.json('POST', `/admin/console/transfers/${first.id}/paid`, { token: admin.token, body: { paidOn: '2026-11-22', amountHuf: 19_999, reason: 'Erste kivonat' } });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'fizetve', paidOn: '2026-11-22', payTo: null });
    // the same success path as a card payment
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.clientId, zoe.clientId));
    expect(p).toMatchObject({ provider: 'atutalas', kind: 'elso_havi', status: 'sikeres', amountHuf: 19_999, periodStart: '2026-11-22', periodEnd: '2026-12-22', mode: 'demo', initiated: 'admin' });
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, zoe.clientId));
    expect(sub).toMatchObject({ status: 'active', billingMethod: 'atutalas', currentPeriodStart: '2026-11-22', currentPeriodEnd: '2026-12-22', nextChargeAt: null });
    const [step] = await h.deps.db.select().from(onboardingSteps).where(and(eq(onboardingSteps.clientId, zoe.clientId), eq(onboardingSteps.step, 'elofizetes')));
    expect(step!.status).toBe('kesz');
    // the DEMO fee invoice (final invoice) and our own mail with the PDF; the "Elindult az előfizetésed" letter once
    await jobInvoicesIssue(h.deps);
    const [inv] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.paymentId, p!.id));
    expect(inv).toMatchObject({ status: 'kiallitva', provider: 'demo' });
    const im = mailsTo('zoe@demo.kezjegy.test', 'fee_invoice');
    expect(im).toHaveLength(1);
    expect(im[0]!.subject).toBe('Számla a havidíjról (2026. 11. 22. – 12. 21.)');
    expect(im[0]!.text).toContain('Fizetés: Átutalással fizetve');
    expect((im[0] as Mail & { attachments?: { filename: string }[] }).attachments?.[0]?.filename).toMatch(/^szamla-DEMO-/);
    expect(mailsTo('zoe@demo.kezjegy.test', 'subscription_started')).toHaveLength(1);
    // marking again: idempotent
    await stepUp();
    expect((await h.json('POST', `/admin/console/transfers/${first.id}/paid`, { token: admin.token, body: { paidOn: '2026-11-22', amountHuf: 19_999, reason: 'x' } })).status).toBe(409);
  });

  let monthly: typeof transferRequests.$inferSelect;
  it('monthly: on the first day of the new period a díjbekérő with the period; never twice; `billing` never charges', async () => {
    h.clock.set('2026-12-21T07:00:00Z');
    expect((await jobTransferIssue(h.deps)).kiallitva).toBe(0);
    h.clock.set('2026-12-22T05:40:00Z');
    await runBillingJob(h.deps);
    expect(await h.deps.db.select().from(payments).where(eq(payments.clientId, zoe.clientId))).toHaveLength(1);
    expect((await jobTransferIssue(h.deps)).kiallitva).toBe(1);
    expect((await jobTransferIssue(h.deps)).kiallitva).toBe(0);
    [monthly] = await h.deps.db.select().from(transferRequests).where(and(eq(transferRequests.clientId, zoe.clientId), eq(transferRequests.kind, 'havi')));
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, zoe.clientId));
    expect(monthly).toMatchObject({ periodStart: '2026-12-22', periodEnd: '2027-01-22', orderNo: `ADZ-${cl!.customerNo}-2026-12`, dueOn: '2026-12-30', status: 'kiallitva', amountHuf: 19_999 });
    // a transfer client cannot move to the card while this month is open
    const t = await relogin('zoe@demo.kezjegy.test');
    const v = await h.json('GET', '/client/billing', { token: t });
    expect(v.body).toMatchObject({ method: 'atutalas', canSwitchToCard: false });
  });

  it('late: kesik from the day after; reminders on day 1, 4, 8 – each once; no lock while kesesLeallit is OFF', async () => {
    const reminders = async () => (await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, zoe.userId), eq(notifications.kind, 'transfer_reminder')))).length;
    h.clock.set('2026-12-30T09:00:00Z');
    await jobTransferReminders(h.deps);
    await dispatchPending(h.deps);
    expect(await reminders()).toBe(0);
    h.clock.set('2026-12-31T09:00:00Z');
    expect(await jobTransferReminders(h.deps)).toMatchObject({ kesik: 1, emlekezteto: 1 });
    await jobTransferReminders(h.deps);
    await dispatchPending(h.deps);
    expect(await reminders()).toBe(1);
    h.clock.set('2027-01-02T09:00:00Z');
    await jobTransferReminders(h.deps);
    await dispatchPending(h.deps);
    expect(await reminders()).toBe(1);
    h.clock.set('2027-01-03T09:00:00Z'); // day 4
    await jobTransferReminders(h.deps);
    await dispatchPending(h.deps);
    expect(await reminders()).toBe(2);
    h.clock.set('2027-01-06T09:00:00Z');
    await jobTransferReminders(h.deps);
    await dispatchPending(h.deps);
    expect(await reminders()).toBe(2);
    h.clock.set('2027-01-07T09:00:00Z'); // day 8
    await jobTransferReminders(h.deps);
    await dispatchPending(h.deps);
    expect(await reminders()).toBe(3);
    h.clock.set('2027-01-09T09:00:00Z');
    await jobTransferReminders(h.deps);
    await dispatchPending(h.deps);
    expect(await reminders()).toBe(3);
    await dispatchPending(h.deps);
    const rm = mailsTo('zoe@demo.kezjegy.test', 'transfer_reminder');
    expect(rm).toHaveLength(3);
    expect(rm[0]!.subject).toBe('Még nem érkezett meg a havidíjad');
    expect(rm[0]!.text).toContain('Ha már elutaltad, nincs teendőd');
    // the HTML part: the new template, the button, the explicit brand link (no half-linked "zz.hu")
    const html = (rm[0] as Mail & { level?: unknown }).level ? (await import('../src/notify/mailer.js')).htmlOfMail(rm[0] as never) : '';
    expect(html).toContain('Megnézem az utalási adatokat');
    expect(html).toContain('<a href="https://adozz.hu" style="color:#5B6478;text-decoration:none;">Adózz.hu</a>');
    expect(await computeServiceLock(h.deps, zoe.clientId)).toBeNull();
    const tile = await h.json('GET', '/admin/console/transfers/summary', { token: (await adminLogin(), admin.token) });
    expect(tile.body.kesik).toBe(1);
  });

  it('switch kesesLeallit ON (step-up, audit) → lock "atutalas_kesik"; paid → unlocked', async () => {
    await adminLogin();
    await stepUp();
    const s = await h.json('PUT', '/admin/console/switches/fizetes', { token: admin.token, body: { kesesLeallit: true, reason: 'próba' } });
    expect(s.status).toBe(200);
    expect(s.body).toEqual({ atutalas: true, kesesLeallit: true, kozlemeny: 'havi' });
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, zoe.clientId));
    expect(cl!.serviceLock?.reasons).toEqual(['atutalas_kesik']);
    await stepUp();
    expect((await h.json('POST', `/admin/console/transfers/${monthly.id}/paid`, { token: admin.token, body: { paidOn: '2027-01-08', amountHuf: 19_999, reason: 'Erste' } })).status).toBe(200);
    const [after] = await h.deps.db.select().from(clients).where(eq(clients.id, zoe.clientId));
    expect(after!.serviceLock).toBeNull();
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, zoe.clientId));
    expect(sub).toMatchObject({ currentPeriodStart: '2026-12-22', currentPeriodEnd: '2027-01-22', nextChargeAt: null });
    await stepUp();
    await h.json('PUT', '/admin/console/switches/fizetes', { token: admin.token, body: { kesesLeallit: false, reason: 'vissza' } });
  });

  it('switch atutalas OFF → a NEW choice is 409 atutalas_kikapcsolva; the transfer client keeps getting díjbekérők', async () => {
    await adminLogin();
    await stepUp();
    await h.json('PUT', '/admin/console/switches/fizetes', { token: admin.token, body: { atutalas: false, reason: 'ÁSZF' } });
    expect((await h.json('GET', '/config')).body.fizetes).toEqual({ atutalas: false });
    const c = await onboardingClient('uj.ki@demo.kezjegy.test');
    const r = await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'subscribe' } });
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('atutalas_kikapcsolva');
    h.clock.set('2027-01-22T05:45:00Z');
    expect((await jobTransferIssue(h.deps)).kiallitva).toBe(1);
    await adminLogin();
    await stepUp();
    await h.json('PUT', '/admin/console/switches/fizetes', { token: admin.token, body: { atutalas: true, reason: 'DEMO' } });
    const [st] = await h.deps.db.select().from(systemState).where(eq(systemState.key, 'kapcsolok.fizetes'));
    expect(st!.value).toMatchObject({ atutalas: true, kesesLeallit: false });
  });

  it('DEMO reconciliation: a "utal+…" client is paid at the next run', async () => {
    h.clock.set('2027-01-22T09:00:00Z');
    const c = await onboardingClient('utal+demo@demo.kezjegy.test');
    expect((await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'subscribe' } })).status).toBe(200);
    expect((await jobTransferReconcile(h.deps)).fizetett).toBe(1);
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(sub).toMatchObject({ status: 'active', currentPeriodStart: '2027-01-22' });
  });

  it('the card paying the first month withdraws the open first-month díjbekérő', async () => {
    const c = await onboardingClient('kartya.utana@demo.kezjegy.test');
    await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'subscribe' } });
    const cv = (await h.json('GET', '/client/subscription/consent?purpose=subscribe', { token: c.token })).body;
    const st = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    expect(st.status).toBe(200);
    const { applyDemoChoice } = await import('../src/services/payments.js');
    await applyDemoChoice(h.deps, st.body.paymentId, 'ok');
    const [tr] = await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, c.clientId));
    expect(tr!.status).toBe('visszavonva');
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(sub).toMatchObject({ status: 'active', billingMethod: 'kartya' });
    expect(sub!.nextChargeAt).not.toBeNull();
  });

  it('B5: an open callback during the onboarding waits the payment (card and transfer); the guided offer step', async () => {
    const c = await onboardingClient('visszahiv@demo.kezjegy.test');
    const g0 = await h.json('GET', '/client/guided', { token: c.token });
    const offer = g0.body.steps.find((s: { key: string }) => s.key === 'visszahivas_ajanlat');
    expect(offer).toMatchObject({ state: 'nyitva', route: '/bekotes/visszahivas-ajanlat' });
    const cb = await h.json('POST', '/client/callbacks', { token: c.token, body: { phone: '+36301234567', topic: 'elofizetes', source: 'bekotes' } });
    expect(cb.status).toBe(201);
    const t = await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'subscribe' } });
    expect(t.status).toBe(409);
    expect(t.body.error.code).toBe('step_locked');
    const cv = (await h.json('GET', '/client/subscription/consent?purpose=subscribe', { token: c.token })).body;
    const k = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    expect(k.status).toBe(409);
    expect(k.body.error.code).toBe('step_locked');
    expect((await h.json('GET', '/client/guided', { token: c.token })).body.steps.find((s: { key: string }) => s.key === 'visszahivas_ajanlat').state).toBe('var');
    // the call happened (closed) → open again
    await h.deps.db.update(callbackRequests).set({ status: 'teljesitve', closedAt: h.clock.now() }).where(eq(callbackRequests.clientId, c.clientId));
    expect((await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'subscribe' } })).status).toBe(200);
    // "Nem kell, mehetünk tovább"
    const d = await onboardingClient('nemkell@demo.kezjegy.test');
    const skip = await h.json('POST', '/client/guided', { token: d.token, body: { action: 'callback_offer_skip' } });
    expect(skip.status).toBe(200);
    expect(skip.body.steps.find((s: { key: string }) => s.key === 'visszahivas_ajanlat').state).toBe('kesz');
  });
});

// =====================================================================================================================
/** A fake Agent with díjbekérő state: issue / query by key / queryDetails with payments; a converted invoice. */
class FakeAgent implements SzamlazzClient {
  docs = new Map<string, { number: string; xml: string; tipus: string; paid: number; payDay: string | null; ref: string | null }>();
  byNumber = new Map<string, string>();
  calls: string[] = [];
  n = 0;
  private by(xml: string): string | null {
    return /<szamlaKulsoAzon>([^<]+)</.exec(xml)?.[1] ?? (/<szamlaszam>([^<]+)</.exec(xml)?.[1] ? this.byNumber.get(/<szamlaszam>([^<]+)</.exec(xml)![1]!) ?? null : null);
  }
  async issue(xml: string) {
    this.calls.push('issue');
    const k = /<szamlaKulsoAzon>([^<]+)</.exec(xml)![1]!;
    const proforma = xml.includes('<dijbekero>true</dijbekero>');
    const number = `${proforma ? 'D' : 'E'}-2026-${++this.n}`;
    this.docs.set(k, { number, xml, tipus: proforma ? 'D' : 'SZ', paid: 0, payDay: null, ref: null });
    this.byNumber.set(number, k);
    return { number, pdf: Buffer.from('%PDF-1.4 fake'), grossHuf: null };
  }
  async storno(): Promise<never> {
    throw new SzamlazzError('nem kell', 'x', false);
  }
  async query(xml: string) {
    this.calls.push('query');
    const k = this.by(xml);
    const d = k ? this.docs.get(k) : undefined;
    return d ? { number: d.number, pdf: Buffer.from('%PDF-1.4 again'), grossHuf: null } : null;
  }
  async queryDetails(xml: string): Promise<SzDocDetails | null> {
    this.calls.push('queryDetails');
    const k = this.by(xml);
    const d = k ? this.docs.get(k) : undefined;
    if (!d) return null;
    return { number: d.number, tipus: d.tipus, dueOn: null, refProforma: d.ref, grossHuf: 19_999, payments: d.paid ? [{ datum: d.payDay, jogcim: 'átutalás', osszeg: d.paid }] : [], paidHuf: d.paid, pdf: Buffer.alloc(0) };
  }
}

describe('Számlázz.hu Tesztüzem (fake Agent): díjbekérő, Autokassza payment, final invoice', () => {
  let h: Harness;
  const agent = new FakeAgent();
  beforeAll(async () => {
    h = await setup({ now: '2026-11-20T09:00:00Z', env: { INVOICE_MODE: 'szamlazzhu', SZAMLAZZHU_ACCOUNT: 'teszt', SZAMLAZZHU_TEST_AGENT_KEY: AGENT }, overrides: { szamlazz: agent } });
    await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
  });
  afterAll(async () => h.close());

  it('issue (query first), Autokassza payment found by the key → active; the final invoice refers to the díjbekérő, sendEmail=false', async () => {
    const c = await newClient(h, 'szamlazz.k8@demo.kezjegy.test', { first: 'Péter', last: 'Kovács' });
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, firstName: 'Péter', lastName: 'Kovács' } })).status).toBe(200);
    await acceptContract(h, c.token);
    const r = await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'subscribe' } });
    expect(r.status).toBe(200);
    expect(agent.calls).toEqual(['query', 'issue']);
    const [tr] = await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, c.clientId));
    expect(tr).toMatchObject({ mode: 'teszt', status: 'kiallitva', proformaNumber: 'D-2026-1' });
    const doc = agent.docs.get(tr!.orderNo)!;
    expect(doc.xml).toContain('<sendEmail>false</sendEmail>');
    // not paid yet
    expect((await jobTransferReconcile(h.deps)).fizetett).toBe(0);
    // Autokassza matched the money
    doc.paid = 19_999;
    doc.payDay = '2026-11-23';
    h.clock.set('2026-11-23T10:00:00Z');
    expect((await jobTransferReconcile(h.deps)).fizetett).toBe(1);
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.clientId, c.clientId));
    expect(p).toMatchObject({ provider: 'atutalas', mode: 'test', periodStart: '2026-11-23', status: 'sikeres' });
    await jobInvoicesIssue(h.deps);
    const [inv] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.paymentId, p!.id));
    expect(inv).toMatchObject({ status: 'kiallitva', provider: 'szamlazzhu', providerAccount: 'teszt' });
    const fin = [...agent.docs.values()].find((d) => d.number === inv!.number)!;
    expect(fin.xml).toContain('<dijbekeroSzamlaszam>D-2026-1</dijbekeroSzamlaszam>');
    expect(fin.xml).toContain('<fizmod>Átutalás</fizmod>');
    expect(fin.xml).toContain('<sendEmail>false</sendEmail>');
    expect(fin.xml).toContain('<teljesitesDatum>2026-11-23</teljesitesDatum>');
    expect(fin.xml).toContain('<fizetve>true</fizetve>');
  });

  it('Autokassza turned the díjbekérő into an invoice itself → paid and the invoice is adopted (no second invoice)', async () => {
    const c = await newClient(h, 'atalakitott@demo.kezjegy.test', { first: 'Anna', last: 'Tóth' });
    await h.json('PUT', '/client/profile', { token: c.token, body: { ...profile, firstName: 'Anna', lastName: 'Tóth' } });
    await acceptContract(h, c.token);
    await h.json('POST', '/client/billing/transfer', { token: c.token, body: { purpose: 'subscribe' } });
    const [tr] = await h.deps.db.select().from(transferRequests).where(eq(transferRequests.clientId, c.clientId));
    // the key now answers with the invoice Autokassza made of the paid díjbekérő
    const number = `E-2026-${++agent.n}`;
    agent.docs.set(tr!.orderNo, { number, xml: '<auto/>', tipus: 'SZ', paid: 19_999, payDay: '2026-11-24', ref: tr!.proformaNumber });
    agent.byNumber.set(number, tr!.orderNo);
    h.clock.set('2026-11-24T10:00:00Z');
    expect((await jobTransferReconcile(h.deps)).fizetett).toBe(1);
    const [after] = await h.deps.db.select().from(transferRequests).where(eq(transferRequests.id, tr!.id));
    expect(after).toMatchObject({ status: 'fizetve', paidSource: 'autokassza', adoptedInvoiceNumber: number });
    const issues = agent.calls.filter((x) => x === 'issue').length;
    await jobInvoicesIssue(h.deps);
    expect(agent.calls.filter((x) => x === 'issue').length).toBe(issues);
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.clientId, c.clientId)).orderBy(desc(payments.createdAt));
    const [inv] = await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.paymentId, p!.id));
    expect(inv).toMatchObject({ status: 'kiallitva', number });
  });
});
