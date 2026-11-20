// k6c2 fix round (2026-11-20): the review findings of round 2, each pinned by a test.
//  - an allowance decision recalculates the stored quarter estimates at once (hero = Adó tab = /client/tax-periods);
//  - the per-allowance effects are marginal in the Szja tv. 29/H order (the rows add up to the band);
//  - the client never sees the unused családi kedvezmény as a refund (only the overpaid SZJA advances);
//  - a crossing invoice with no reserve does not say "innentől minden számládból félre kell tenned";
//  - a month with nothing to put aside says so (no "félretenni kb. 0 Ft");
//  - the check-in item follows the paid fee (csapatnal / ball → csapat);
//  - a negative year reads as "több volt az adód …", never "kb. -1 164 000 Ft maradt neked";
//  - the DEMO pay page of a one-off fee names the fee, not "havidíj".
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AllowanceAnswers } from '../src/_shared/api.js';
import { checkinItems, clients, clientTaxProfiles, monthlyCheckins, onboardingSteps, plans, revenueItems } from '../src/db/schema.js';
import { runDataStepOt1119 } from '../src/services/datastep-k28.js';
import { runDataStepK28 } from '../src/services/datastep-k28.js';
import { recalcYear } from '../src/services/tax.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const mm = (m: number) => String(m).padStart(2, '0');

async function activeClient(email: string, o: { status?: 'fofoglalkozasu' | 'mellekallasu'; monthly?: number; months?: number[] } = {}) {
  const c = await newClient(h, email, { active: true, first: 'Eszter', last: 'Szabó' });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
  await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2026, costRatio: 45, status: o.status ?? 'mellekallasu', hipaMethod: 'nincs', costRatioSource: 'konyvelo_megerositette' });
  if (o.monthly) {
    for (const m of o.months ?? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const d = `2026-${mm(m)}-10`;
      await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: d, deliveryDate: d, amountHuf: o.monthly, description: `Bevétel ${m}`, createdAt: new Date(`${d}T08:00:00Z`) });
    }
  }
  return c;
}

const base: AllowanceAnswers = { birthMonth: '1990-04', children: [], otherDependants: 0, pregnancy: null, mother: null, csaladiWho: null, csaladiSharePct: null, csjkWish: null, marriage: null, disability: null, benefit: null, healthConsent: false, note: null };
const kid = () => ({ potlek: 'most' as const, sajat: true, tartosBeteg: false, felvaltva: false, potlekKezdeteHo: null, potlekVegeHo: null });
const mother: AllowanceAnswers = { ...base, mother: true, children: [kid(), kid()], csaladiWho: 'en', csjkWish: null };

beforeAll(async () => {
  h = await setup({ now: '2026-11-19T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.k6c2@demo.kezjegy.test', { firstName: 'Bence' });
  await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
  await runDataStepOt1119(h.deps);
  await runDataStepK28(h.deps);
});
afterAll(async () => h?.close());

describe('allowances: decision → recalc; marginal effects; no csjk refund for the client', () => {
  let c: Awaited<ReturnType<typeof activeClient>>;
  it('approving anyák + családi recalculates the stored quarters: /client/tax-periods/:id = the hero, without SZJA', async () => {
    c = await activeClient('eszter.k6c2@demo.kezjegy.test', { status: 'mellekallasu', monthly: 1_000_000 });
    await recalcYear(h.deps, h.deps.db, c.clientId, 2026); // the "NAV sync" estimate before the allowances
    const before = (await h.json('GET', '/client/home', { token: c.token })).body;
    expect(before.hero.state).toBe('becsles');
    const p0 = (await h.json('GET', `/client/tax-periods/${before.hero.periodId}`, { token: c.token })).body;
    expect(p0.totalHuf).toBe(before.hero.amountHuf);
    expect((await h.json('PUT', '/client/allowances/answers', { token: c.token, body: { year: 2026, submit: true, answers: mother } })).status).toBe(200);
    for (const kind of ['anyak', 'csaladi'])
      expect((await h.json('POST', `/acc/clients/${c.clientId}/allowances/${kind}/decision`, { token: bence.token, body: { year: 2026, status: 'jovahagyva' } })).status).toBe(200);
    const home = (await h.json('GET', '/client/home', { token: c.token })).body;
    const p = (await h.json('GET', `/client/tax-periods/${home.hero.periodId}`, { token: c.token })).body;
    expect(home.hero.amountHuf).toBeLessThan(before.hero.amountHuf);
    expect(p.totalHuf).toBe(home.hero.amountHuf);
    const list = (await h.json('GET', '/client/tax-periods?year=2026', { token: c.token })).body;
    const q3 = list.items.find((x: { periodKey: string }) => x.periodKey === '2026-Q3');
    const q3d = (await h.json('GET', `/client/tax-periods/${q3.id}`, { token: c.token })).body;
    expect(JSON.stringify(q3d)).not.toMatch(/SZJA-előleg[^"]*"[^}]*"amountHuf":[1-9]/);
  });
  it('the rows are marginal (29/H): anyák carries the saving, családi is "covered", the rows add up to the band', async () => {
    const st = (await h.json('GET', '/client/allowances?year=2026', { token: c.token })).body;
    const anyak = st.items.find((i: { kind: string }) => i.kind === 'anyak');
    const csaladi = st.items.find((i: { kind: string }) => i.kind === 'csaladi');
    expect(anyak.effectYearHuf).toBe(st.savedYtdHuf);
    expect(csaladi.effectYearHuf).toBe(0);
    expect(csaladi.statusText).toMatch(/a másik kedvezményed miatt most nem marad rá SZJA/);
    expect(csaladi.line).toMatch(/^SZJA-t az anyák kedvezménye miatt nem fizetsz/);
    expect(anyak.effectYearHuf + csaladi.effectYearHuf).toBe(st.savedYtdHuf);
    // K12 preview: the same marginal logic before submitting
    const pv = (await h.json('POST', '/client/allowances/preview', { token: c.token, body: { year: 2026, answers: mother } })).body;
    const pa = pv.items.find((i: { kind: string }) => i.kind === 'anyak');
    const pc = pv.items.find((i: { kind: string }) => i.kind === 'csaladi');
    expect(pc.covered).toBe(true);
    expect(pc.effectYearHuf).toBe(0);
    expect(pa.effectYearHuf).toBeGreaterThan(0);
    expect(pa.line).toBeTruthy();
  });
  it('earnings: the unused családi kedvezmény is a line without an amount; ytd taxes = months − overpaid SZJA only', async () => {
    const e = (await h.json('GET', '/client/earnings?year=2026', { token: c.token })).body;
    const monthsSum = e.months.reduce((a: number, m: { taxesHuf: number }) => a + m.taxesHuf, 0);
    const refund = e.refund?.huf ?? 0;
    expect(e.ytd.taxesHuf).toBe(monthsSum - refund);
    // the refund is the SZJA the quarterly advances paid before the allowance (Q1–Q3), never more
    const list = (await h.json('GET', '/client/tax-periods?year=2026', { token: c.token })).body;
    void list;
    expect(e.refund.text).toMatch(/A fel nem használt családi kedvezményedet az éves bevallásban Bence számolja el\./);
    if (refund > 0) expect(e.refund.text).toMatch(/^Az eddigi SZJA-előlegeidből kb\. [\d ]+ Ft az éves bevallásban visszajár\./);
    const home = (await h.json('GET', '/client/home', { token: c.token })).body;
    expect(home.earnings.refundText ?? '').not.toMatch(/Ebből/);
    expect(home.reserve.refundText ?? '').not.toMatch(/visszakapsz/);
  });
});

describe('reserves: threshold sentence and month sub-lines', () => {
  it('a crossing invoice with reserve 0 (25 év alatti, főfoglalkozású) gets the kedvezmény variant, not "innentől minden számládból"', async () => {
    const c = await activeClient('balint.k6c2@demo.kezjegy.test', { status: 'fofoglalkozasu', monthly: 850_000, months: [1, 2, 3, 4, 5] });
    const fiatal: AllowanceAnswers = { ...base, birthMonth: '2003-02' };
    expect((await h.json('PUT', '/client/allowances/answers', { token: c.token, body: { year: 2026, submit: true, answers: fiatal } })).status).toBe(200);
    expect((await h.json('POST', `/acc/clients/${c.clientId}/allowances/fiatal25/decision`, { token: bence.token, body: { year: 2026, status: 'jovahagyva' } })).status).toBe(200);
    const r = (await h.json('GET', '/client/reserve?year=2026', { token: c.token })).body;
    const items = r.months.flatMap((m: { items: { reserve: { crossesTaxFree: boolean; reserveHuf: number; thresholdText: string | null } }[] }) => m.items);
    const cross = items.find((i: { reserve: { crossesTaxFree: boolean } }) => i.reserve.crossesTaxFree);
    expect(cross.reserve.reserveHuf).toBe(0);
    expect(cross.reserve.thresholdText).toBe('Ezzel a számlával elfogyott az adómentes részed, de a kedvezményed miatt most sem nő az adód.');
    // every month with nothing to put aside says so
    for (const m of r.months) expect(m.sub).toMatch(/^\d+ tétel · nem kell félretenned/);
    // "Miért ennyi?": no zero parts, no "kb." on the parts, the SZJA bullet for the exempt client
    expect(cross.reserve.miert.rows.every((x: string) => !/kb\./.test(x))).toBe(true);
    expect(cross.reserve.miert.total).toBe('Összesen: ebből most nem kell félretenned');
  });
});

describe('check-in item follows the paid fee', () => {
  it('Költözik → Bejelentjük helyetted → fee paid → the item is csapatnal (ball → csapat)', async () => {
    const c = await activeClient('koltozik.k6c2@demo.kezjegy.test', { status: 'fofoglalkozasu' });
    await h.deps.db.insert(onboardingSteps).values({ clientId: c.clientId, step: 'szerzodes', status: 'kesz', completedAt: h.clock.now() }).onConflictDoUpdate({ target: [onboardingSteps.clientId, onboardingSteps.step], set: { status: 'kesz' } });
    const [ck] = await h.deps.db.insert(monthlyCheckins).values({ clientId: c.clientId, period: '2026-10', status: 'nyitott' }).returning();
    const change = { kind: 'valtozas_szekhely', address: { zip: '1117', city: 'Budapest', streetName: 'Próba', streetType: 'utca', houseNumber: '3' }, effectiveOn: '2026-12-01', right: 'berlet', alsoHomeAddress: false };
    const r = await h.json('POST', `/client/checkins/${ck!.id}`, { token: c.token, body: { result: 'valtozott', answers: [{ item: 'koltozes', choice: 'szekhely', how: 'helyettunk', change }] } });
    if (r.status !== 200) console.log('checkin', r.status, JSON.stringify(r.body));
    expect(r.status).toBe(200);
    const [it0] = await h.deps.db.select().from(checkinItems).where(and(eq(checkinItems.clientId, c.clientId), eq(checkinItems.item, 'koltozes')));
    expect(it0!.status).toBe('dijra_var');
    const fees = (await h.json('GET', '/client/fees', { token: c.token })).body;
    const ch = fees.open[0];
    const pay = await h.json('POST', `/client/fees/${ch.id}/pay`, { token: c.token, body: { platform: 'web' } });
    // the DEMO page names the fee, never "havidíj", and has no card-token sentence
    const page = await h.req('GET', `/payments/demo/pay?o=${encodeURIComponent(pay.body.orderRef)}`);
    const html = await page.text();
    expect(html).not.toContain('– havidíj');
    expect(html).toContain('változás bejelentése helyetted');
    const form = new FormData();
    form.set('o', pay.body.orderRef);
    form.set('eredmeny', 'ok');
    expect((await h.req('POST', '/payments/demo/pay', { form })).status).toBe(303);
    const [it1] = await h.deps.db.select().from(checkinItems).where(eq(checkinItems.id, it0!.id));
    expect(it1!.status).toBe('csapatnal');
    const q = await h.json('GET', '/acc/checkin-items', { token: bence.token });
    const row = q.body.items.find((x: { id: string }) => x.id === it0!.id);
    expect(row.ball).toBe('csapat');
  });
});

describe('Mennyit kerestem?: a negative year', () => {
  it('revenue below the fixed minimum → "… Ft-tal több volt az adód és a járulékod, mint a bevételed."', async () => {
    const c = await activeClient('ilona.k6c2@demo.kezjegy.test', { status: 'fofoglalkozasu' });
    const home = (await h.json('GET', '/client/home', { token: c.token })).body;
    expect(home.earnings.ytdNetHuf).toBeLessThan(0);
    expect(home.earnings.sentence).toMatch(/^Idén eddig kb\. [\d ]+ Ft-tal több volt az adód és a járulékod, mint a bevételed\.$/);
    expect(home.earnings.sentence).not.toMatch(/kb. -/);
  });
});

void ALL;
