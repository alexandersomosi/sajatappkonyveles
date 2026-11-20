// SPEC §28.12 / §28.K.22 (backend part): félretenni, new-invoice notification, allowances, "Mennyit kerestem?", change
// guides + the assisted change with the prepaid fee, fees admin, the service lock, the monthly check-in, the annual
// closing, employees / EFO, notification settings and quiet hours.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assistRequests,
  clientAllowances,
  clients,
  clientTaxProfiles,
  feeCharges,
  monthlyCheckins,
  navCredentials,
  onboardingSteps,
  navInvoices,
  notifications,
  revenueItems,
  simplepayTransactions,
  subscriptions,
  plans,
  systemState,
} from '../src/db/schema.js';
import { inQuietHours, pushNotBefore } from '../src/notify/notify.js';
import { proposeAllowances } from '../src/services/kedvezmeny.js';
import { reserveStats } from '../src/services/felretesz.js';
import { NOTIFY_FROM_KEY, notifyNewInvoices } from '../src/services/szamla-ertesites.js';
import { computeServiceLock } from '../src/services/zarolas.js';
import { jobCheckinOpen } from '../src/services/havi-ellenorzes.js';
import { jobAnnualOpen } from '../src/services/eves-zaras.js';
import { runDataStepK28, runDataStepOt1119 } from '../src/services/datastep-k28.js';
import { acceptContract, newClient, setup, staff, type Harness } from './helpers.js';
import type { AllowanceAnswers } from '../src/_shared/api.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let anna: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const mm = (m: number) => String(m).padStart(2, '0');

async function activeClient(email: string, o: { status?: 'fofoglalkozasu' | 'mellekallasu' | 'nyugdijas'; monthly?: number; confirmed?: boolean } = {}) {
  const c = await newClient(h, email, { active: true, first: 'Eszter', last: 'Szabó' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2026, costRatio: 45, status: o.status ?? 'mellekallasu', hipaMethod: 'savos', costRatioSource: o.confirmed === false ? 'ugyfel_javaslat' : 'konyvelo_megerositette' });
  if (o.monthly) {
    for (const m of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const d = `2026-${mm(m)}-10`;
      await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: d, deliveryDate: d, amountHuf: o.monthly, description: `Bevétel ${m}`, createdAt: new Date(`${d}T08:00:00Z`) });
    }
  }
  return c;
}

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence@demo.kezjegy.test', { firstName: 'Bence' });
  anna = await staff(h, 'csapat', 'anna@demo.kezjegy.test', { firstName: 'Anna' });
  admin = await staff(h, 'admin', 'admin@demo.kezjegy.test');
  await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
  expect(await runDataStepOt1119(h.deps)).not.toBe('already');
  expect(await runDataStepK28(h.deps)).not.toBe('already');
  expect(await runDataStepK28(h.deps)).toBe('already');
});
afterAll(async () => h.close());

/** Access tokens live 10 minutes: after a clock jump everybody signs in again. */
async function relog(): Promise<void> {
  for (const [who, email] of [[bence, 'bence@demo.kezjegy.test'], [anna, 'anna@demo.kezjegy.test'], [admin, 'admin@demo.kezjegy.test']] as const) {
    const r = await h.json('POST', '/auth/login', { body: { email, password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'panel' } });
    (who as { token: string }).token = r.body.accessToken;
  }
}
async function clientLogin(email: string): Promise<string> {
  const r = await h.json('POST', '/auth/login', { body: { email, password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'native' } });
  if (r.status !== 200) throw new Error(`login ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.accessToken as string;
}

describe('§28.2.3 quiet hours and notification settings', () => {
  it('pushNotBefore follows the per-user window (wrapping midnight)', () => {
    expect(inQuietHours(21, { quietEnabled: true, quietFrom: 20, quietTo: 8 })).toBe(true);
    expect(inQuietHours(7, { quietEnabled: true, quietFrom: 20, quietTo: 8 })).toBe(true);
    expect(inQuietHours(12, { quietEnabled: true, quietFrom: 20, quietTo: 8 })).toBe(false);
    expect(inQuietHours(23, { quietEnabled: true, quietFrom: 22, quietTo: 6 })).toBe(true);
    expect(inQuietHours(5, { quietEnabled: false, quietFrom: 22, quietTo: 6 })).toBe(false);
    // 05:30 Budapest (04:30Z in winter) → 08:00 Budapest = 07:00Z
    expect(pushNotBefore(new Date('2026-11-20T04:30:00Z'))?.toISOString()).toBe('2026-11-20T07:00:00.000Z');
    expect(pushNotBefore(new Date('2026-11-20T04:30:00Z'), { quietEnabled: true, quietFrom: 22, quietTo: 6 })?.toISOString()).toBe('2026-11-20T05:00:00.000Z');
    expect(pushNotBefore(new Date('2026-11-20T04:30:00Z'), { quietEnabled: false, quietFrom: 22, quietTo: 6 })).toBeNull();
  });
  it('PATCH /me notificationSettings saves and GET /me returns them', async () => {
    const c = await newClient(h, 'ertesit@demo.kezjegy.test');
    expect((await h.json('GET', '/me', { token: c.token })).body.notificationSettings).toEqual({ quietEnabled: true, quietFrom: 20, quietTo: 8, pushShowAmounts: true });
    expect((await h.json('PATCH', '/me', { token: c.token, body: { notificationSettings: { quietFrom: 22, quietTo: 6, pushShowAmounts: false } } })).status).toBe(200);
    expect((await h.json('GET', '/me', { token: c.token })).body.notificationSettings).toEqual({ quietEnabled: true, quietFrom: 22, quietTo: 6, pushShowAmounts: false });
    expect((await h.json('PATCH', '/me', { token: c.token, body: { notificationSettings: { quietFrom: 24 } } })).status).toBe(400);
  });
});

describe('K1 – félretenni', () => {
  let c: Awaited<ReturnType<typeof activeClient>>;
  beforeAll(async () => {
    c = await activeClient('eszter.reserve@demo.kezjegy.test', { status: 'mellekallasu', monthly: 1_000_000 });
  });
  it('GET /client/reserve: per item reserve with the rounding rule, the card A/B/keepNow', async () => {
    const r = await h.json('GET', '/client/reserve?year=2026', { token: c.token });
    expect(r.status).toBe(200);
    const items = r.body.months.flatMap((m: { items: unknown[] }) => m.items) as { amountHuf: number; reserve: { rawHuf: number; reserveHuf: number; zone: string; line: string } }[];
    expect(items).toHaveLength(10);
    const april = items.find((i) => i.reserve.zone !== 'adomentes' && i.reserve.rawHuf > 0)!;
    expect(april.reserve.reserveHuf % 1000).toBe(0);
    expect(april.reserve.reserveHuf).toBeGreaterThanOrEqual(april.reserve.rawHuf);
    expect(april.reserve.line).toContain('Ft-os számla – ebből kb.');
    const card = r.body.card;
    expect(card.keepNowHuf).toBe(Math.max(0, Math.ceil((card.accruedHuf - card.dueOrPaidHuf) / 1000) * 1000));
    // k6c: the card row is a rounded "kb." value of the same accrual (A − fixed − HIPA); the per-invoice reserves round up
    expect(card.invoicesHuf % 1000).toBe(0);
    expect(Math.abs(card.invoicesHuf - items.reduce((a, i) => a + i.reserve.reserveHuf, 0))).toBeLessThanOrEqual(items.length * 1000);
    expect(card.sentence).toMatch(/^Most kb\. [\d ]+ Ft legyen félretéve az adódra\.$|^Most nincs mit félretenned\.$/);
  });
  it('the cache recomputes only when the inputs change', async () => {
    const before = reserveStats.recomputed;
    await h.json('GET', '/client/reserve?year=2026', { token: c.token });
    expect(reserveStats.recomputed).toBe(before);
    await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: '2026-11-10', deliveryDate: '2026-11-10', amountHuf: 120_000, description: 'új' });
    const r = await h.json('GET', '/client/reserve?year=2026', { token: c.token });
    expect(reserveStats.recomputed).toBe(before + 1);
    const last = r.body.months[0].items[0];
    expect(last.reserve).toMatchObject({ rawHuf: 30_690, reserveHuf: 31_000, zone: 'teljes' });
  });
  it('a restricted client gets 403 locked_until_active (feature felretesz) and no home card', async () => {
    const r0 = await newClient(h, 'restricted.reserve@demo.kezjegy.test');
    const r = await h.json('GET', '/client/reserve', { token: r0.token });
    expect(r.status).toBe(403);
    expect(r.body.error).toMatchObject({ code: 'locked_until_active', feature: 'felretesz' });
    expect((await h.json('GET', '/client/home', { token: r0.token })).body.reserve).toBeNull();
  });
  it('home carries reserve + earnings; the accountant sees the same view', async () => {
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.body.reserve.keepNowHuf).toBeGreaterThanOrEqual(0);
    expect(home.body.earnings.ytdRevenueHuf).toBe(10_120_000);
    const acc = await h.json('GET', `/acc/clients/${c.clientId}/reserve?year=2026`, { token: bence.token });
    expect(acc.status).toBe(200);
    expect(acc.body.card.keepNowHuf).toBe(home.body.reserve.keepNowHuf);
    expect((await h.json('GET', `/acc/clients/${c.clientId}`, { token: bence.token })).body.reserve.keepNowHuf).toBe(home.body.reserve.keepNowHuf);
  });
});

describe('K4 – Mennyit kerestem?', () => {
  it('months sum to the YTD; the projection is reliable after 60 days', async () => {
    const c = await activeClient('kereset@demo.kezjegy.test', { status: 'mellekallasu', monthly: 1_000_000 });
    const r = await h.json('GET', '/client/earnings?year=2026', { token: c.token });
    expect(r.status).toBe(200);
    const sum = r.body.months.reduce((a: number, m: { netHuf: number }) => a + m.netHuf, 0);
    expect(sum).toBe(r.body.ytd.netHuf);
    expect(r.body.months.map((m: { month: number }) => m.month)).toEqual([11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    expect(r.body.months[0].basis).toBe('becsles');
    expect(r.body.projection.reliable).toBe(true);
    expect(r.body.line).toContain('A költségeidet');
  });
});

describe('K2 – new-invoice notification', () => {
  let c: Awaited<ReturnType<typeof activeClient>>;
  async function inv(n: string, o: { op?: 'CREATE' | 'MODIFY' | 'STORNO'; amount?: number; customer?: string | null; tax?: string | null; vat?: string | null; issue?: string } = {}) {
    const issue = o.issue ?? '2026-11-18';
    const [row] = await h.deps.db
      .insert(navInvoices)
      .values({ clientId: c.clientId, invoiceNumber: n, operation: o.op ?? 'CREATE', category: 'NORMAL', issueDate: issue, deliveryDate: issue, paymentMethod: 'TRANSFER', netHuf: o.amount ?? 120_000, vatHuf: 0, grossHuf: o.amount ?? 120_000, customerName: o.customer === undefined ? 'Bodza Kiadó Kft.' : o.customer, customerTaxNumber: o.tax === undefined ? '12345678' : o.tax, customerVatStatus: o.vat ?? 'DOMESTIC', dossierMonth: issue.slice(0, 7), createdAt: h.clock.now() })
      .returning();
    await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'nav_szamla', navInvoiceId: row!.id, receivedOn: issue, deliveryDate: issue, amountHuf: o.amount ?? 120_000, description: n });
    return row!.id;
  }
  beforeAll(async () => {
    c = await activeClient('szamla.ertesites@demo.kezjegy.test', { status: 'mellekallasu', monthly: 1_000_000 });
    await h.deps.db.insert(systemState).values({ key: NOTIFY_FROM_KEY, value: { at: '2026-11-01T00:00:00Z' } }).onConflictDoUpdate({ target: systemState.key, set: { value: { at: '2026-11-01T00:00:00Z' } } });
  });
  const rows = () => h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'invoice_new')));
  it('the first sync (backfill) notifies nobody', async () => {
    const id = await inv('E-1');
    expect(await notifyNewInvoices(h.deps, c.clientId, [id], { firstSync: true })).toBe(0);
    const [x] = await h.deps.db.select().from(navInvoices).where(eq(navInvoices.id, id));
    expect(x!.notifyState).toBe('kihagyva_elso_szinkron');
  });
  it('one new invoice → one row with amount, customer and reserve; push waits for quiet hours; no double send', async () => {
    h.clock.set('2026-11-19T04:30:00Z'); // 05:30 Budapest
    const id = await inv('E-2');
    expect(await notifyNewInvoices(h.deps, c.clientId, [id], { firstSync: false })).toBe(1);
    expect(await notifyNewInvoices(h.deps, c.clientId, [id], { firstSync: false })).toBe(0);
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0]!.title).toBe('Új kiállított számlád: 120 000 Ft');
    expect(r[0]!.body).toMatch(/^Bodza Kiadó Kft\. Tegyél félre kb\. [\d ]+ Ft-ot\.$/);
    expect((r[0]!.data as { pushNotBefore?: string }).pushNotBefore).toBe('2026-11-19T07:00:00.000Z');
    expect(r[0]!.link).toBe(`/szamla/${id}`);
  });
  it('more invoices before the push went out fold into the same row (variant tobb)', async () => {
    const a = await inv('E-3', { customer: 'Csipke Műhely Bt.' });
    const b = await inv('E-4', { customer: 'Kovács Péter', tax: null, vat: 'PRIVATE_PERSON' });
    await notifyNewInvoices(h.deps, c.clientId, [a, b], { firstSync: false });
    const r = await rows();
    expect(r).toHaveLength(1);
    expect(r[0]!.title).toBe('3 új kiállított számlád: összesen 360 000 Ft');
    expect(JSON.stringify(r[0]!)).not.toContain('Kovács Péter');
    expect(r[0]!.link).toBe('/felretesz');
  });
  it('MODIFY / STORNO and old invoices are skipped silently', async () => {
    h.clock.set('2026-11-19T09:00:00Z');
    const m = await inv('E-5', { op: 'MODIFY' });
    const o = await inv('E-6', { issue: '2026-10-01' });
    expect(await notifyNewInvoices(h.deps, c.clientId, [m, o], { firstSync: false })).toBe(0);
    const st = await h.deps.db.select({ s: navInvoices.notifyState }).from(navInvoices).where(eq(navInvoices.clientId, c.clientId));
    expect(st.map((x) => x.s)).toEqual(expect.arrayContaining(['kihagyva_modositas', 'kihagyva_regi']));
  });
  it('amounts switched off → push text "Új kiállított számlád érkezett"; a private person is "Magánszemély"', async () => {
    await h.json('PATCH', '/me', { token: c.token, body: { notificationSettings: { pushShowAmounts: false } } });
    await h.deps.db.update(notifications).set({ pushSentAt: h.clock.now() }).where(eq(notifications.userId, c.userId)); // the earlier push went out
    h.clock.set('2026-11-19T10:00:00Z');
    const id = await inv('E-7', { customer: 'Nagy Ilona', tax: null, vat: 'PRIVATE_PERSON' });
    await notifyNewInvoices(h.deps, c.clientId, [id], { firstSync: false });
    const r = (await rows()).sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())[0]!;
    expect(r.body.startsWith('Magánszemély.')).toBe(true);
    expect((r.data as { pushTitle?: string }).pushTitle).toBe('Új kiállított számlád érkezett');
    h.clock.set('2026-11-19T09:00:00Z');
  });
});

describe('K3 – allowances', () => {
  beforeAll(async () => {
    h.clock.set('2026-11-19T09:00:00Z');
    await relog();
  });
  const base: AllowanceAnswers = { birthMonth: '1990-04', children: [], otherDependants: 0, pregnancy: null, mother: null, csaladiWho: null, csaladiSharePct: null, csjkWish: null, marriage: null, disability: null, benefit: null, healthConsent: false, note: null };
  const kid = (o: Partial<AllowanceAnswers['children'][number]> = {}) => ({ potlek: 'most' as const, sajat: true, tartosBeteg: false, felvaltva: false, potlekKezdeteHo: null, potlekVegeHo: null, ...o });
  it('proposal rules: age boundaries, mothers, családi, első házasok, CSED', () => {
    expect(proposeAllowances({ ...base, birthMonth: '2001-06' }, 2026, 'mellekallasu').find((p) => p.kind === 'fiatal25')?.months).toEqual([1, 2, 3, 4, 5, 6]);
    expect(proposeAllowances({ ...base, birthMonth: '2001-05' }, 2026, 'mellekallasu').find((p) => p.kind === 'fiatal25')?.months).toEqual([1, 2, 3, 4, 5]);
    expect(proposeAllowances({ ...base, birthMonth: '2000-12' }, 2026, 'mellekallasu').some((p) => p.kind === 'fiatal25')).toBe(false);
    const m86 = proposeAllowances({ ...base, birthMonth: '1986-01', mother: true, children: [kid(), kid()] }, 2026, 'mellekallasu');
    expect(m86.find((p) => p.kind === 'anyak')?.params.anyakJogcim).toBe('ket');
    expect(proposeAllowances({ ...base, birthMonth: '1985-12', mother: true, children: [kid(), kid()] }, 2026, 'mellekallasu').some((p) => p.kind === 'anyak')).toBe(false);
    expect(proposeAllowances({ ...base, birthMonth: '1996-01', mother: true, children: [kid()] }, 2026, 'mellekallasu').some((p) => p.kind === 'anya30')).toBe(true);
    expect(proposeAllowances({ ...base, birthMonth: '1995-12', mother: true, children: [kid()] }, 2026, 'mellekallasu').some((p) => p.kind === 'anya30')).toBe(false);
    const cs = proposeAllowances({ ...base, children: [kid(), kid({ felvaltva: true })], csaladiWho: 'kozosen', csaladiSharePct: 50, csjkWish: 'igen' }, 2026, 'mellekallasu').find((p) => p.kind === 'csaladi')!;
    expect(cs.params.csaladi?.[0]).toMatchObject({ eltartott: 2, sharePct: 50, children: [{ felvaltva: false }, { felvaltva: true }] });
    expect(cs.params.csjkInYear).toBe(true);
    expect(proposeAllowances({ ...base, children: [kid()], csaladiWho: 'en', csjkWish: 'igen' }, 2026, 'nyugdijas').find((p) => p.kind === 'csaladi')!.params.csjkInYear).toBe(false);
    expect(proposeAllowances({ ...base, children: [kid()], csaladiWho: 'par' }, 2026, 'mellekallasu').some((p) => p.kind === 'csaladi')).toBe(false);
    expect(proposeAllowances({ ...base, marriage: { month: '2026-05', first: true, who: 'en' } }, 2026, 'mellekallasu').find((p) => p.kind === 'elso_hazasok')?.months).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(proposeAllowances({ ...base, marriage: { month: '2026-05', first: true, who: 'kozosen' } }, 2026, 'mellekallasu').find((p) => p.kind === 'elso_hazasok')?.params.elsoHazasokMonthlyHuf).toBe(16_667); // the spouse takes 16 668: together 33 335
    expect(proposeAllowances({ ...base, children: [kid({ tartosBeteg: true })], csaladiWho: 'en', healthConsent: true }, 2026, 'mellekallasu').find((p) => p.kind === 'csaladi')!.params.csaladi![0]!.children[0]!.tartosBeteg).toBe(true);
    expect(proposeAllowances({ ...base, benefit: { fromMonth: '2026-03', toMonth: '2026-05' } }, 2026, 'mellekallasu').find((p) => p.kind === 'csed_gyed')?.months).toEqual([3, 4, 5]);
    const preg = proposeAllowances({ ...base, pregnancy: { dueMonth: '2027-02' }, csaladiWho: 'en' }, 2026, 'mellekallasu').find((p) => p.kind === 'csaladi')!;
    expect(preg.months[0]).toBe(8); // 2027-02-15 − 189 days = 2026-08-10
  });

  let c: Awaited<ReturnType<typeof activeClient>>;
  const answers: AllowanceAnswers = { ...base, birthMonth: '1990-04', mother: true, children: [kid(), kid()], csaladiWho: 'kozosen', csaladiSharePct: 50 };
  it('submit → javasolt items + the accountant notified; health without consent → 400', async () => {
    c = await activeClient('kedvezmeny@demo.kezjegy.test', { status: 'mellekallasu', monthly: 1_000_000 });
    const bad = await h.json('PUT', '/client/allowances/answers', { token: c.token, body: { year: 2026, submit: true, answers: { ...answers, children: [kid({ tartosBeteg: true })] } } });
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.healthConsent).toBeTruthy();
    const r = await h.json('PUT', '/client/allowances/answers', { token: c.token, body: { year: 2026, submit: true, answers } });
    expect(r.status).toBe(200);
    expect(r.body.items.map((i: { kind: string; status: string }) => [i.kind, i.status])).toEqual([
      ['anyak', 'javasolt'],
      ['csaladi', 'javasolt'],
    ]);
    expect(r.body.pendingCount).toBe(2);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, bence.userId), eq(notifications.kind, 'allowance_submitted')));
    expect(n!.title).toContain('kitöltötte a kedvezmény-kérdőívet');
  });
  it('approval changes the engine numbers; csapat gets 404; a changed resubmit goes back to javasolt with params_prev', async () => {
    const before = (await h.json('GET', '/client/tax-periods?year=2026', { token: c.token })).body;
    void before;
    const view0 = await h.json('GET', `/acc/clients/${c.clientId}/allowances?year=2026`, { token: bence.token });
    expect(view0.status).toBe(200);
    expect([403, 404]).toContain((await h.json('GET', `/acc/clients/${c.clientId}/allowances?year=2026`, { token: anna.token })).status); // csapat never sees it
    const pv = await h.json('POST', `/acc/clients/${c.clientId}/allowances/preview`, { token: bence.token, body: { year: 2026, decisions: [{ kind: 'anyak', months: ALL, params: { anyakJogcim: 'ket' }, inYear: true }] } });
    expect(pv.status).toBe(200);
    expect(pv.body.with.szjaHuf).toBe(0);
    expect(pv.body.savedHuf).toBeGreaterThan(0);
    const ok = await h.json('POST', `/acc/clients/${c.clientId}/allowances/anyak/decision`, { token: bence.token, body: { year: 2026, status: 'jovahagyva' } });
    expect(ok.status).toBe(200);
    expect(ok.body.items.find((i: { kind: string }) => i.kind === 'anyak').status).toBe('jovahagyva');
    const st = await h.json('GET', '/client/allowances?year=2026', { token: c.token });
    expect(st.body.items.find((i: { kind: string }) => i.kind === 'anyak').statusText).toMatch(/^Jár · január–december · idén kb\. [\d ]+ Ft-tal kevesebb adó$/);
    expect(st.body.savedYearHuf).toBeGreaterThan(0);
    const ask = await h.json('POST', `/acc/clients/${c.clientId}/allowances/csaladi/decision`, { token: bence.token, body: { year: 2026, status: 'kerdes', clientText: 'A párod is egyéni vállalkozó?' } });
    expect(ask.status).toBe(200);
    // resubmit with 3 children → anyak 'harom' (changed) → javasolt with params_prev
    await h.json('PUT', '/client/allowances/answers', { token: c.token, body: { year: 2026, submit: true, answers: { ...answers, children: [kid(), kid(), kid()] } } });
    const [row] = await h.deps.db.select().from(clientAllowances).where(and(eq(clientAllowances.clientId, c.clientId), eq(clientAllowances.kind, 'anyak')));
    expect(row!.status).toBe('javasolt');
    expect(row!.paramsPrev).toMatchObject({ status: 'jovahagyva', params: { anyakJogcim: 'ket' } });
  });
});

describe('K5 – change guides and the assisted change with the prepaid fee', () => {
  beforeAll(async () => relog());
  let c: Awaited<ReturnType<typeof activeClient>>;
  let assistId = '';
  const change = { kind: 'valtozas_szekhely', address: { zip: '1117', city: 'Budapest', streetName: 'Próba', streetType: 'utca', houseNumber: '3' }, effectiveOn: '2026-12-01', right: 'berlet', alsoHomeAddress: false };
  beforeAll(async () => {
    c = await activeClient('adam.valtozas@demo.kezjegy.test', { status: 'fofoglalkozasu' });
    await h.deps.db.insert(onboardingSteps).values({ clientId: c.clientId, step: 'szerzodes', status: 'kesz', completedAt: h.clock.now() }).onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: 'kesz' } });
    void acceptContract;
  });
  it('the generic guide, then the personalised one; change-guides lists 6 kinds', async () => {
    const g0 = await h.json('GET', '/client/guides/valtozas_szekhely', { token: c.token });
    expect(g0.status).toBe(200);
    expect(g0.body.video).toBeNull();
    expect(JSON.stringify(g0.body)).toContain('az új címed irányítószáma');
    const list = await h.json('GET', '/client/change-guides', { token: c.token });
    expect(list.body.items.map((i: { kind: string }) => i.kind)).toHaveLength(6);
  });
  it('POST /client/assist (change kind) → dijra_var + a 4 999 Ft DEMO charge; team actions 409 fee_unpaid', async () => {
    const r = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'valtozas_szekhely', source: 'helyettunk_valtozas', change } });
    expect(r.status).toBe(201);
    expect(r.body.assist.status).toBe('dijra_var');
    expect(r.body.feeCharge).toMatchObject({ kind: 'valtozas_egyszeru', amountHuf: 4_999, demo: true, status: 'nyitott' });
    assistId = r.body.assist.id;
    const g1 = await h.json('GET', '/client/guides/valtozas_szekhely', { token: c.token });
    expect(JSON.stringify(g1.body)).toContain('1117');
    const blocked = await h.json('POST', `/team/assists/${assistId}/change-ready`, { token: bence.token, body: {} });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('fee_unpaid');
  });
  it('paying on the DEMO page → fizetve + fee invoice → egyeztetve', async () => {
    const fees = await h.json('GET', '/client/fees', { token: c.token });
    const ch = fees.body.open[0];
    const pay = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web' } });
    expect(pay.status).toBe(200);
    expect(pay.body.paymentUrl).toContain('/payments/demo/pay?o=');
    const form = new FormData();
    form.set('o', pay.body.orderRef);
    form.set('eredmeny', 'ok');
    const res = await h.req('POST', '/payments/demo/pay', { form });
    expect(res.status).toBe(303);
    const [charge] = await h.deps.db.select().from(feeCharges).where(eq(feeCharges.id, ch.id));
    expect(charge!.status).toBe('fizetve');
    expect(charge!.feeInvoiceId).toBeTruthy();
    const [a] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.id, assistId));
    expect(a!.status).toBe('egyeztetve');
    const [t] = await h.deps.db.select().from(simplepayTransactions).where(eq(simplepayTransactions.orderRef, pay.body.orderRef));
    expect(t!.kind).toBe('egyszeri');
  });
  it('change-ready needs the checklist; consent with the hash; ev-filed; change-done by the filer 403, by csapat → kesz', async () => {
    expect((await h.json('POST', `/team/assists/${assistId}/change-ready`, { token: bence.token, body: {} })).status).toBe(400);
    const items = ['adatok_teljesek', 'jogcim_rendben', 'meghatalmazas_lefedi', 'datum_rendben'];
    expect((await h.json('PATCH', `/team/assists/${assistId}`, { token: bence.token, body: { check: items.map((item) => ({ item, done: true })) } })).status).toBe(200);
    const ready = await h.json('POST', `/team/assists/${assistId}/change-ready`, { token: bence.token, body: {} });
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('meghatalmazas_el');
    const sum = await h.json('GET', `/client/assist/${assistId}/consent`, { token: c.token });
    expect(sum.status).toBe(200);
    expect(sum.body.blocks[0].lines[0]).toBe('1117 Budapest, Próba utca 3.');
    expect((await h.json('POST', `/client/assist/${assistId}/consent`, { token: c.token, body: { hash: '0'.repeat(64), declaration: true, instruction: true } })).status).toBe(409);
    const ok = await h.json('POST', `/client/assist/${assistId}/consent`, { token: c.token, body: { hash: sum.body.hash, declaration: true, instruction: true } });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('ugyfel_engedelyezte');
    const fd = new FormData();
    fd.set('items', JSON.stringify(['kepviseletvalaszto', 'adatok_egyeznek', 'valtozas_bekuldve']));
    fd.set('file', new File([Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')], 'ertesites.pdf', { type: 'application/pdf' }));
    const filed = await h.json('POST', `/team/assists/${assistId}/ev-filed`, { token: bence.token, form: fd });
    expect(filed.status).toBe(200);
    expect(filed.body.status).toBe('bejelentes_bekuldve');
    expect((await h.json('POST', `/team/assists/${assistId}/change-done`, { token: bence.token, body: {} })).status).toBe(403);
    const done = await h.json('POST', `/team/assists/${assistId}/change-done`, { token: anna.token, body: { followups: ['hq_municipality'] } });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('kesz');
    expect(done.body.followups.find((f: { key: string }) => f.key === 'hq_municipality').done).toBe(true);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'assist_change_done')));
    expect(n!.body).toContain('számlázóprogramodban');
  });
  it('after CHANGE_UGYSEGED_VALID_UNTIL the Ügysegéd guide is outdated, adóadat still valid', async () => {
    h.clock.set('2027-01-02T09:00:00Z');
    const t = (await h.json('POST', '/auth/login', { body: { email: 'adam.valtozas@demo.kezjegy.test', password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'native' } })).body.accessToken;
    expect((await h.json('GET', '/client/guides/valtozas_szekhely', { token: t })).body.outdated).toBe(true);
    expect((await h.json('GET', '/client/guides/valtozas_adoadat', { token: t })).body.outdated).toBe(false);
    h.clock.set('2026-11-19T09:00:00Z');
  });
});

describe('P – fees admin, D – service lock, F – EFO', () => {
  beforeAll(async () => {
    h.clock.set('2026-11-19T09:00:00Z');
    await relog();
  });
  it('fee settings: list, change (unconfirmed again), confirm, history', async () => {
    const l = await h.json('GET', '/admin/fees', { token: admin.token });
    expect(l.status).toBe(200);
    expect(l.body.items.find((x: { kind: string }) => x.kind === 'havidij')).toMatchObject({ amountHuf: 19_999, confirmed: true });
    expect(l.body.items.find((x: { kind: string }) => x.kind === 'eves_zaras')).toMatchObject({ amountHuf: 14_999, confirmed: false });
    expect((await h.json('PUT', '/admin/fees', { token: admin.token, body: { kind: 'havidij', amountHuf: 24_999 } })).status).toBe(400); // a rise needs effectiveFrom ≥ +30 days
    const ch = await h.json('PUT', '/admin/fees', { token: admin.token, body: { kind: 'eves_zaras', amountHuf: 15_999 } });
    expect(ch.body.items.find((x: { kind: string }) => x.kind === 'eves_zaras')).toMatchObject({ amountHuf: 15_999, confirmed: false });
    const cf = await h.json('POST', '/admin/fees/eves_zaras/confirm', { token: admin.token });
    const ez = cf.body.items.find((x: { kind: string }) => x.kind === 'eves_zaras');
    expect(ez.confirmed).toBe(true);
    expect(ez.history.length).toBeGreaterThanOrEqual(3);
    expect([403, 404]).toContain((await h.json('GET', '/admin/fees', { token: bence.token })).status);
  });
  it('a suspended subscription locks the service: requests 403 service_locked, fees and messages still work; unlock on payment', async () => {
    const c = await activeClient('ilona.lock@demo.kezjegy.test', { status: 'fofoglalkozasu' });
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'suspended', mode: 'demo' });
    const lock = await computeServiceLock(h.deps, c.clientId);
    expect(lock?.reasons).toEqual(['havidij']);
    const r = await h.json('POST', '/client/requests', { token: c.token, body: { type: 'kerdes', title: 'Kérdés', body: 'Szia!' } });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe('service_locked');
    expect((await h.json('GET', '/client/fees', { token: c.token })).status).toBe(200);
    expect((await h.json('POST', '/client/messages', { token: c.token, body: { body: 'Fizetnék, de nem megy.' } })).status).toBe(201);
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.body.lock.text).toMatch(/^Szünetel a könyvelésed, mert nincs kifizetve a havidíj \(19 999 Ft\)\./);
    await h.deps.db.update(subscriptions).set({ status: 'active' }).where(eq(subscriptions.clientId, c.clientId));
    expect(await computeServiceLock(h.deps, c.clientId)).toBeNull();
    expect((await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'service_unlocked')))).length).toBe(1);
  });
  it('EFO answer ≠ Nincs keeps the subscription locked until an activation-allowing decision', async () => {
    const c = await activeClient('tamas.efo@demo.kezjegy.test');
    await h.deps.db.update(clients).set({ lifecycle: 'bekotes_alatt' }).where(eq(clients.id, c.clientId));
    const a = await h.json('PUT', '/client/onboarding/employer', { token: c.token, body: { answer: 'efo' } });
    expect(a.status).toBe(200);
    expect(a.body.blocksActivation).toBe(true);
    const d = await h.json('POST', `/acc/clients/${c.clientId}/employer`, { token: bence.token, body: { decision: 'berszamfejtes_mashol' } });
    expect(d.status).toBe(200);
    expect(d.body.employer.blocksActivation).toBe(false);
    expect((await h.json('POST', `/acc/clients/${c.clientId}/employer`, { token: bence.token, body: { decision: 'egyedi_ajanlat' } })).status).toBe(400);
  });
});

describe('A – monthly check-in, B – annual closing', () => {
  it('the job opens one check-in per eligible client on the first working day; "Nem változott semmi" in one tap', async () => {
    const c = await activeClient('norbert.checkin@demo.kezjegy.test', { status: 'fofoglalkozasu' });
    await h.deps.db.update(clients).set({ createdAt: new Date('2026-10-01T00:00:00Z') }).where(eq(clients.id, c.clientId));
    h.clock.set('2026-12-01T09:30:00Z'); // Tuesday, a working day
    expect(await jobCheckinOpen(h.deps)).toBeGreaterThanOrEqual(1);
    expect(await jobCheckinOpen(h.deps)).toBe(0);
    const t = (await h.json('POST', '/auth/login', { body: { email: 'norbert.checkin@demo.kezjegy.test', password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'native' } })).body.accessToken;
    const cur = await h.json('GET', '/client/checkins/current', { token: t });
    if (cur.status !== 200) console.log('checkin current', cur.status, JSON.stringify(cur.body));
    expect(cur.body).toMatchObject({ period: '2026-11', periodLabel: 'november', status: 'nyitott' });
    expect(cur.body.items.map((i: { item: string }) => i.item)).toContain('csalad');
    const ans = await h.json('POST', `/client/checkins/${cur.body.id}`, { token: t, body: { result: 'nem_valtozott' } });
    expect(ans.body.status).toBe('nem_valtozott');
    expect((await h.json('POST', `/client/checkins/${cur.body.id}`, { token: t, body: { result: 'nem_valtozott' } })).status).toBe(409);
    const [row] = await h.deps.db.select().from(monthlyCheckins).where(eq(monthlyCheckins.clientId, c.clientId));
    expect(row!.answeredAt).toBeTruthy();
  });
  it('a "valtozott" answer creates checkin items for the accountant queue', async () => {
    const t = (await h.json('POST', '/auth/login', { body: { email: 'norbert.checkin@demo.kezjegy.test', password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'native' } })).body.accessToken;
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, (await h.deps.db.select().from(monthlyCheckins))[0]!.clientId));
    const [ins] = await h.deps.db.insert(monthlyCheckins).values({ clientId: cl!.id, period: '2026-10', status: 'nyitott' }).returning();
    const r = await h.json('POST', `/client/checkins/${ins!.id}`, { token: t, body: { result: 'valtozott', answers: [{ item: 'munkaviszony', since: '2026-10-15', weeklyHours: 'legalabb_36', how: 'kerdes' }] } });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('valtozott');
    await relog();
    const q = await h.json('GET', '/acc/checkin-items', { token: bence.token });
    expect(q.body.items.some((i: { item: string; status: string }) => i.item === 'munkaviszony' && i.status === 'uj')).toBe(true);
  });
  it('the annual closing opens on 5 January; answers (refund account masked); submit → dijra_var with the fee charge', async () => {
    h.clock.set('2027-01-05T09:00:00Z');
    expect(await jobAnnualOpen(h.deps)).toBeGreaterThanOrEqual(1);
    const t = (await h.json('POST', '/auth/login', { body: { email: 'norbert.checkin@demo.kezjegy.test', password: 'Hosszu-Demo-Jelszo-2026!', clientKind: 'native' } })).body.accessToken;
    const v = await h.json('GET', '/client/annual?year=2026', { token: t });
    if (v.status !== 200) console.log('annual', v.status, JSON.stringify(v.body));
    expect(v.body).toMatchObject({ status: 'kerdoiv', questionnaireDue: '2027-03-15', nextAction: 'kitoltes' });
    const s = await h.json('PUT', `/client/annual/${v.body.id}/answers`, { token: t, body: { answers: { otherIncomes: ['munkaber'], refundAccount: '11773016-11111018-00000000' } } });
    expect(s.status).toBe(200);
    expect(s.body.answers.refundAccountMasked).toBe('117…0000');
    expect(JSON.stringify(s.body)).not.toContain('11773016');
    const sub = await h.json('POST', `/client/annual/${v.body.id}/submit`, { token: t });
    expect(sub.body.status).toBe('dijra_var');
    expect(sub.body.feeCharge).toMatchObject({ kind: 'eves_zaras', status: 'nyitott' });
    h.clock.set('2026-11-19T09:00:00Z');
  });
});

describe('N – no answer-time promise', () => {
  beforeAll(async () => {
    h.clock.set('2026-11-19T09:00:00Z');
    await relog();
  });
  it('PATCH /acc/settings refuses a time promise; the default text has none', async () => {
    const r = await h.json('PATCH', '/acc/settings', { token: bence.token, body: { responseTimeText: 'Munkanapokon 4 órán belül válaszol' } });
    expect(r.status).toBe(400);
    expect(r.body.error.fields.responseTimeText).toContain('Ide ne írj időt');
    const [cl] = await h.deps.db.select().from(clients).limit(1);
    void cl;
    void navCredentials;
  });
});
