// k6c fix round (2026-11-20): the review findings of the five features + §28.K, each pinned by a test.
//  - one "eddig": the Félretenni card's A = the taxes of "Mennyit kerestem?" so far; the upcoming (estimated-date) items
//    are left out of the month sums;
//  - the new-invoice message carries the same reserve as the invoice page;
//  - the annual questionnaire saves the app's real payload (with the view-only refundAccountMasked);
//  - paying the missing monthly fee lifts the lock at once, /me carries the lock for the banner;
//  - a szüneteltetés stops the monthly minimum (insurance break), the date reads "október 1-jétől";
//  - a KATA client never sees átalány numbers;
//  - {firstNameWith} = "Bencével"; one formatter groups 4-digit amounts.
import { readFileSync } from 'node:fs';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clients, clientTaxProfiles, navInvoices, notifications, plans, revenueItems, simplepayTransactions, subscriptions } from '../src/db/schema.js';
import { fillPlaceholders, hunWith } from '../src/_shared/bekotes.js';
import { reservesForInvoices } from '../src/services/felretesz.js';
import { fmt } from '../src/services/kedvezmeny.js';
import { invoiceItems, invoiceNotificationContent } from '../src/services/szamla-ertesites.js';
import { applyFinished } from '../src/services/subscription.js';
import { computeServiceLock } from '../src/services/zarolas.js';
import { openPause } from '../src/services/szuneteltetes.js';
import { dayTol, huDayMonthTol } from '../src/lib/dates.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
const mm = (m: number) => String(m).padStart(2, '0');

async function activeClient(email: string, o: { status?: 'fofoglalkozasu' | 'mellekallasu'; monthly?: number; regime?: 'atalany' | 'kata' } = {}) {
  const c = await newClient(h, email, { active: true, first: 'Teszt', last: 'Elek' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2026, costRatio: 45, status: o.status ?? 'mellekallasu', hipaMethod: 'savos', costRatioSource: 'konyvelo_megerositette', regime: o.regime ?? 'atalany' });
  if (o.monthly) {
    for (const m of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) {
      const d = `2026-${mm(m)}-10`;
      await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: d, deliveryDate: d, amountHuf: o.monthly, description: `Bevétel ${m}`, createdAt: new Date(`${d}T08:00:00Z`) });
    }
  }
  return c;
}

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.k6c@demo.kezjegy.test', { firstName: 'Bence' });
  await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
});
afterAll(async () => {
  await h?.close();
});

describe('one "eddig" on the Főoldal (Félretenni card = Mennyit kerestem? = Eddigi adód)', () => {
  it('mellékállású: A = the earnings months so far (TB/szocho with the months that earned them); December carries nothing', async () => {
    const c = await activeClient('eddig.mellek@demo.kezjegy.test', { status: 'mellekallasu', monthly: 650_000 });
    const home = (await h.json('GET', '/client/home', { token: c.token })).body;
    const e = (await h.json('GET', '/client/earnings?year=2026', { token: c.token })).body;
    const monthsSum = e.months.reduce((a: number, m: { taxesHuf: number }) => a + m.taxesHuf, 0);
    expect(home.reserve.accruedHuf).toBe(monthsSum);
    expect(home.twoNumbers.taxesHuf).toBe(e.ytd.taxesHuf);
    // no refund here: the same number in all three places
    expect(e.ytd.taxesHuf).toBe(monthsSum);
    // the card's detail rounds to 1 000 with "kb."
    expect(home.reserve.detail).toContain(`kb. ${fmt(Math.ceil(monthsSum / 1000) * 1000)} Ft adóval`);
  });
  it('an upcoming (estimated-date) item is marked and left out of its month sum', async () => {
    const c = await activeClient('eddig.varhato@demo.kezjegy.test', { status: 'mellekallasu', monthly: 650_000 });
    await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: '2026-11-26', receivedOnEstimated: true, deliveryDate: '2026-11-12', amountHuf: 218_000, description: 'Várható' });
    const r = (await h.json('GET', '/client/reserve?year=2026', { token: c.token })).body;
    const nov = r.months.find((m: { month: number }) => m.month === 11);
    const up = nov.items.find((i: { upcoming?: boolean }) => i.upcoming);
    expect(up.upcomingText).toBe('Várható: november 26. Még nincs benne a fenti összegben.');
    const now = nov.items.filter((i: { upcoming?: boolean }) => !i.upcoming).reduce((a: number, i: { reserve: { reserveHuf: number } }) => a + Math.max(0, i.reserve.reserveHuf), 0);
    expect(nov.reserveHuf).toBe(now);
    expect(nov.sub).toMatch(/· 1 várható$/);
  });
});

describe('the new-invoice message = the invoice page', () => {
  it('felre in the message is the reserve the invoice page shows', async () => {
    const c = await activeClient('ertesites.k6c@demo.kezjegy.test', { status: 'mellekallasu', monthly: 1_000_000 });
    const [inv] = await h.deps.db
      .insert(navInvoices)
      .values({ clientId: c.clientId, invoiceNumber: 'K6C-1', operation: 'CREATE', category: 'NORMAL', issueDate: '2026-11-18', deliveryDate: '2026-11-18', paymentMethod: 'TRANSFER', netHuf: 120_000, vatHuf: 0, grossHuf: 120_000, customerName: 'Bodza Kiadó Kft.', customerTaxNumber: '12345678', customerVatStatus: 'DOMESTIC', dossierMonth: '2026-11' })
      .returning();
    await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'nav_szamla', navInvoiceId: inv!.id, receivedOn: '2026-11-18', deliveryDate: '2026-11-18', amountHuf: 120_000, description: 'K6C-1' });
    const items = await invoiceItems(h.deps, c.clientId, [inv!]);
    const msg = await invoiceNotificationContent(h.deps, items);
    const page = (await reservesForInvoices(h.deps, h.deps.db, c.clientId, [inv!.id])).get(inv!.id)!;
    expect(items[0]!.reserveHuf).toBe(page.reserveHuf);
    expect(msg.body).toBe(`Vevő: Bodza Kiadó Kft. Tegyél félre kb. ${fmt(page.reserveHuf)} Ft-ot.`); // k7b: „Vevő:” előtag
    expect(page.line).toContain(`kb. ${fmt(page.reserveHuf)} Ft-ot`);
  });
});

describe('annual questionnaire: the app payload', () => {
  it('the whole answers object with refundAccountMasked: null passes the schema (the strict schema refused it: "Ismeretlen mező.")', async () => {
    const { annualAnswersSchema } = await import('../src/services/eves-zaras.js');
    const app = { otherIncomes: ['nem_volt'], otherIncomeNote: null, allowancesOk: null, hipaPlace: null, hipaOtherTowns: [], municipalityLetter: null, onePercent: null, refundAccountMasked: null, missingDocuments: null, message: null };
    expect(annualAnswersSchema.safeParse(app).success).toBe(true);
    expect(annualAnswersSchema.safeParse({ ...app, refundAccountMasked: '117…0000' }).success).toBe(true);
    expect(annualAnswersSchema.safeParse({ ...app, valami: 1 }).success).toBe(false);
  });
  it('GET /client/annual without a year: this year when the client had no profile last year (no stale 2025 row)', async () => {
    const c = await activeClient('eves.uj@demo.kezjegy.test');
    const v = await h.json('GET', '/client/annual', { token: c.token });
    expect(v.status).toBe(200);
    expect(v.body.year).toBe(2026);
  });
});

describe('service lock: unlock at once on payment; /me carries it', () => {
  it('suspended → /me serviceLock; FINISHED → lock null, service_unlocked, POST /client/requests 201', async () => {
    const c = await activeClient('ilona.k6c@demo.kezjegy.test', { status: 'fofoglalkozasu' });
    const [sub] = await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'suspended', mode: 'demo', currentPeriodStart: '2026-10-01', currentPeriodEnd: '2026-11-01' }).returning();
    await computeServiceLock(h.deps, c.clientId);
    const me = await h.json('GET', '/me', { token: c.token });
    expect(me.body.client.serviceLock.text).toMatch(/^Szünetel a könyvelésed/);
    expect((await h.json('POST', '/client/requests', { token: c.token, body: { type: 'kerdes', title: 'Kérdés', body: 'Szia!' } })).status).toBe(403);
    const [tx] = await h.deps.db.insert(simplepayTransactions).values({ orderRef: 'K6C-UNLOCK-1', kind: 'ismetlodo', clientId: c.clientId, subscriptionId: sub!.id, amountHuf: 19_999, mode: 'demo', periodStart: '2026-11-01', periodEnd: '2026-12-01' }).returning();
    await applyFinished(h.deps, tx!.id, { transactionId: 501 });
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.serviceLock).toBeNull();
    expect((await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'service_unlocked')))).length).toBe(1);
    expect((await h.json('POST', '/client/requests', { token: c.token, body: { type: 'kerdes', title: 'Kérdés', body: 'Szia!' } })).status).toBe(201);
    expect((await h.json('GET', '/me', { token: c.token })).body.client.serviceLock).toBeNull();
  });
});

describe('szüneteltetés: no monthly minimum while suspended', () => {
  it('a pause from 1 October writes the szunetel break; the home shows no fixed járulék for the suspended months', async () => {
    const c = await activeClient('csilla.k6c@demo.kezjegy.test', { status: 'fofoglalkozasu' });
    await openPause(h.deps, h.deps.db, c.clientId, '2026-10-01', { source: 'konyvelo', by: null });
    const [tp] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2026)));
    expect(tp!.insuranceBreaks).toEqual([{ from: '2026-10-01', to: '2026-12-31', kind: 'szunetel' }]);
    const hr = await h.json('GET', '/client/home', { token: c.token });
    const home = hr.body;
    expect(home.reserve.fixedMonthlyHuf).toBe(0);
    expect(home.pause.text).toContain('október 1-jétől havi');
  });
  it('day suffixes: 1-jétől, 2-ától, 4-étől, 10-étől, 20-ától, 21-étől', () => {
    expect([1, 2, 4, 10, 20, 21].map(dayTol)).toEqual(['1-jétől', '2-ától', '4-étől', '10-étől', '20-ától', '21-étől']);
    expect(huDayMonthTol('2026-10-01')).toBe('október 1-jétől');
  });
});

describe('KATA: no átalány numbers', () => {
  it('home: no reserve card, no earnings, the taxes number hidden; /client/reserve and /client/earnings 404', async () => {
    const c = await activeClient('greta.k6c@demo.kezjegy.test', { status: 'fofoglalkozasu', monthly: 900_000, regime: 'kata' });
    const hr = await h.json('GET', '/client/home', { token: c.token });
    const home = hr.body;
    expect(home.reserve).toBeNull();
    expect(home.earnings).toBeNull();
    expect(home.twoNumbers.taxesHuf).toBeNull();
    expect(home.twoNumbers.taxesSub).toContain('minden megkezdett hónapra');
    expect(home.limits.kata).toBe(true);
    expect((await h.json('GET', '/client/reserve?year=2026', { token: c.token })).status).toBe(404);
    expect((await h.json('GET', '/client/earnings?year=2026', { token: c.token })).status).toBe(404);
  });
});

describe('texts', () => {
  it('{firstNameWith}: Bencével, Annával, Dáviddal, Péterrel, Gergellyel – never "Benceval"', () => {
    expect(['Bence', 'Anna', 'Dávid', 'Péter', 'Gergely', 'Kati'].map(hunWith)).toEqual(['Bencével', 'Annával', 'Dáviddal', 'Péterrel', 'Gergellyel', 'Katival']);
    expect(fillPlaceholders('beszéld meg {firstNameWith}.', { firstName: 'Bence' })).toBe('beszéld meg Bencével.');
    const src = readFileSync(new URL('../src/_shared/bekotes.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/\}va?l\b|\}vel\b/);
  });
  it('one formatter: 4-digit amounts are grouped too', () => {
    expect([1000, 2999, 4999, 19_999, 120_000, -1500].map(fmt)).toEqual(['1 000', '2 999', '4 999', '19 999', '120 000', '-1 500']);
  });
});
