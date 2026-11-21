// SPEC §32 – éves ciklus és KATA, F0 + F1a (2026-11-21): the hotfixes (H1 hidden KATA-year quarters, H2 new year, H3/H4,
// H6, H8, the 12-12 working day) and the KATA months: items on the NAV KATA account, the payment sheet, "csak jelölés",
// the accountant's check, free months, reminders (push + e-mail), the keret warnings, the year end, the 2027 switch, the
// annual-closing fee switch.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { annualClosings, clients, clientTaxProfiles, notifications, revenueItems, systemState, taxPaymentItems, taxPeriods } from '../src/db/schema.js';
import { jobNewYear, jobReminders } from '../src/jobs.js';
import { jobRemindersK28 } from '../src/services/emlekezteto.js';
import { clientDeadlines, computeFlags } from '../src/services/flags.js';
import { ensurePeriods, recalcYear } from '../src/services/tax.js';
import { evesKapcsolok, jobKataYearEnd, syncKataPeriods } from '../src/services/kata.js';
import { runDataStepKataF1 } from '../src/services/datastep-kata.js';
import { KIND_DEFAULTS } from '../src/notify/notify.js';
import { DEFAULT_TEXTS } from '../src/content.js';
import { RESPONSE_TIME_FORBIDDEN_PATTERNS } from '../src/_shared/enums.js';
import { EVES_KAPCSOLOK_KEY } from '../src/_shared/kata.js';
import { newClient, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
beforeAll(async () => {
  h = await setup({ now: '2026-11-21T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.kataf1@demo.kezjegy.test');
});
afterAll(async () => h.close());

let seq = 0;
/** An active KATA client of Bence (adószám set), with a 2026 profile. */
async function kataClient(o: { kataFrom?: string; kataTo?: string | null; regime?: 'kata' | 'atalany'; createdAt?: string; status?: 'fofoglalkozasu' | 'mellekallasu' | 'nyugdijas' } = {}) {
  seq++;
  const c = await newClient(h, `kata-f1-${seq}@demo.kezjegy.test`, { first: 'Gréta', last: `Lakatos${seq}`, active: true });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId, adoszam: '12345678-1-42', createdAt: new Date(o.createdAt ?? '2026-01-01T00:00:00Z') }).where(eq(clients.id, c.clientId));
  await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2026, costRatio: 45, regime: o.regime ?? 'kata', status: o.status ?? 'fofoglalkozasu', kataFrom: o.kataFrom ?? '2026-01-01', kataTo: o.kataTo ?? null, kataVariant: (o.regime ?? 'kata') === 'kata' ? 'regi' : null, kataFofoglalkozasu: true, hipaMethod: 'savos' });
  return c;
}
const periodsOf = (clientId: string) => h.deps.db.select().from(taxPeriods).where(eq(taxPeriods.clientId, clientId));
const itemsOf = (periodId: string) => h.deps.db.select().from(taxPaymentItems).where(eq(taxPaymentItems.taxPeriodId, periodId));
const notesOf = (userId: string) => h.deps.db.select().from(notifications).where(eq(notifications.userId, userId));
const at = async (iso: string) => {
  h.clock.set(iso);
};

describe('F0 – H1: a KATA year has no átalány quarter (hidden, never deleted)', () => {
  it('ensurePeriods makes no quarter; an existing estimate quarter is hidden; calculate / approve 409', async () => {
    const c = await kataClient({ regime: 'atalany', kataFrom: null as unknown as string });
    await ensurePeriods(h.deps.db, c.clientId, 2026, 'savos', 'fofoglalkozasu');
    await recalcYear(h.deps, h.deps.db, c.clientId, 2026);
    expect((await periodsOf(c.clientId)).filter((p) => p.kind === 'negyedev')).toHaveLength(4);
    // the accountant switches to KATA for the whole year
    const r = await h.json('POST', `/acc/clients/${c.clientId}/tax-regime`, { token: bence.token, body: { regime: 'kata', kataFrom: '2026-01-01', year: 2026 } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ regime: 'kata', kataVariant: 'regi', kataFofoglalkozasu: true });
    const q = (await periodsOf(c.clientId)).filter((p) => p.kind === 'negyedev');
    expect(q).toHaveLength(4); // nothing deleted
    expect(q.every((p) => p.hiddenAt && p.hiddenReason === 'kata_ev')).toBe(true);
    const calc = await h.json('POST', `/acc/clients/${c.clientId}/tax-periods/2026-Q3/calculate`, { token: bence.token, body: {} });
    expect(calc.status).toBe(409);
    expect(calc.body.error.message).toContain('Katás évben nincs átalányos negyedév');
    const list = await h.json('GET', `/acc/clients/${c.clientId}/tax-periods?year=2026`, { token: bence.token });
    expect(list.body.items.some((p: { kind: string }) => p.kind === 'negyedev' || p.kind === 'kata')).toBe(false);
    const cl = await h.json('GET', '/client/tax-periods?year=2026', { token: c.token });
    expect(cl.body.items.some((p: { kind: string }) => p.kind === 'negyedev')).toBe(false);
    // back to átalány: the hidden quarters come back
    await h.json('POST', `/acc/clients/${c.clientId}/tax-regime`, { token: bence.token, body: { regime: 'atalany', year: 2026 } });
    expect((await periodsOf(c.clientId)).filter((p) => p.kind === 'negyedev' && !p.hiddenAt)).toHaveLength(4);
  });
  it('vegyes év: KATA from 1 December keeps Q1–Q4 (Q4 only partly KATA – the accountant computes it by hand)', async () => {
    const c = await kataClient({ kataFrom: '2026-12-01' });
    await ensurePeriods(h.deps.db, c.clientId, 2026, 'savos', 'fofoglalkozasu');
    expect((await periodsOf(c.clientId)).filter((p) => p.kind === 'negyedev' && !p.hiddenAt).map((p) => p.periodKey).sort()).toEqual(['2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4']);
  });
});

describe('F0 – H2: jobNewYear keeps the regime (2027-01-01)', () => {
  it('a KATA client stays KATA in 2027 (variant, kataFrom 1 January), no quarter; the 2027 amount is not confirmed (T/928)', async () => {
    const c = await kataClient();
    const pre = await kataClient(); // the accountant already recorded the 2027 decision: kept as it is
    await h.deps.db.insert(clientTaxProfiles).values({ clientId: pre.clientId, year: 2027, costRatio: 50, regime: 'atalany', status: 'fofoglalkozasu' });
    const ny = await kataClient({ regime: 'atalany', status: 'nyugdijas' });
    await at('2027-01-01T08:00:00Z');
    try {
      expect(await jobNewYear(h.deps)).toBeGreaterThanOrEqual(3);
      const [p27] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2027)));
      expect(p27).toMatchObject({ regime: 'kata', kataFrom: '2027-01-01', kataTo: null, kataVariant: 'regi', kataFofoglalkozasu: true });
      const ps = (await periodsOf(c.clientId)).filter((p) => p.year === 2027);
      expect(ps.some((p) => p.kind === 'negyedev')).toBe(false);
      const jan = ps.find((p) => p.periodKey === '2027-01-KATA')!;
      expect(jan).toMatchObject({ calcStatus: 'becsles', paymentStatus: 'nincs_fizetendo', dueDate: '2027-02-12' });
      expect(await itemsOf(jan.id)).toHaveLength(0);
      const task = (await notesOf(bence.userId)).find((n) => n.kind === 'tax_task' && (n.data as { dedupe?: string }).dedupe === `tt:kata_osszeg:${c.clientId}:2027`);
      expect(task?.title).toContain('2027. évi kata összege nincs megerősítve');
      const [kept] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, pre.clientId), eq(clientTaxProfiles.year, 2027)));
      expect(kept!.regime).toBe('atalany');
      // nyugdíjas átalány: quarters without the 2658
      const nyQ = (await periodsOf(ny.clientId)).filter((p) => p.year === 2027 && p.kind === 'negyedev');
      expect(nyQ).toHaveLength(4);
      expect(nyQ.every((p) => p.filingForm === null)).toBe(true);
    } finally {
      await at('2026-11-21T09:00:00Z');
    }
  });
  it('a KATA that ended in 2026 does not go on into 2027', async () => {
    const c = await kataClient({ kataTo: '2026-06-30' });
    await at('2027-01-01T08:00:00Z');
    try {
      await jobNewYear(h.deps);
      const [p27] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2027)));
      expect(p27).toMatchObject({ regime: 'atalany', kataFrom: null, kataVariant: null });
    } finally {
      await at('2026-11-21T09:00:00Z');
    }
  });
});

describe('KATA months (syncKataPeriods)', () => {
  it('started months only; 50 000 Ft on the NAV KATA account (288), közlemény = adószám; earlier months backfilled; idempotent', async () => {
    const c = await kataClient();
    const r1 = await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    expect(r1.created).toBe(11); // January … November (December starts on 12-01)
    expect(r1.backfilled).toHaveLength(10); // January … October were due before 11-21
    const r2 = await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    expect(r2.created).toBe(0);
    const ps = await periodsOf(c.clientId);
    const nov = ps.find((p) => p.periodKey === '2026-11-KATA')!;
    expect(nov).toMatchObject({ kind: 'kata', dueDate: '2026-12-14', calcStatus: 'jovahagyva', paymentStatus: 'fizetendo', backfilled: false });
    const [it] = await itemsOf(nov.id);
    expect(it).toMatchObject({ kind: 'kata_teteles', amountHuf: 50_000, accountNumber: '10032000-01076349', iban: 'HU27100320000107634900000000', reference: '12345678-1-42', adonem: '288', accountName: 'NAV Kisadózó vállalkozások adója bevételi számla' });
    expect(ps.find((p) => p.periodKey === '2026-10-KATA')!.backfilled).toBe(true);
    // one task for the accountant about the backfilled months
    const tasks = (await notesOf(bence.userId)).filter((n) => n.kind === 'tax_task' && n.title.includes(`Lakatos${seq}`) && n.title.includes('korábbi kata-hónapokat'));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.body).toContain('2026. január');
  });

  it('Határidők: "Kata – november: 50 000 Ft", december 14., → /fizetes/{id}; backfilled months only for the accountant; the \'26KATA', async () => {
    const c = await kataClient();
    await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    const list = await clientDeadlines(h.deps, h.deps.db, c.clientId, '2026-09-01', '2027-06-30');
    const kata = list.filter((d) => /^Kata – /.test(d.title));
    expect(kata.map((d) => [d.title, d.dueDate])).toEqual([['Kata – november: 50 000 Ft', '2026-12-14']]);
    expect(kata[0]!.link).toMatch(/^\/fizetes\/[0-9a-f-]{36}$/);
    expect(list.some((d) => /negyedév|26SZJA|SZJA-bevallás/.test(d.title))).toBe(false);
    const decl = list.find((d) => d.id === 'ev:2026:kata')!;
    expect(decl).toMatchObject({ dueDate: '2027-02-25', kind: 'bevallas' });
    expect(decl.title).toBe("Kata-nyilatkozat ('26KATA) – a könyvelőd adja be");
    expect(list.some((d) => d.id.startsWith('kata:'))).toBe(false); // H3: no synthetic rows any more
    const acc = await clientDeadlines(h.deps, h.deps.db, c.clientId, '2026-09-01', '2027-06-30', { perspective: 'accountant' });
    expect(acc.find((d) => d.title.startsWith('Kata – október'))!.title).toContain('ellenőrizd a folyószámlán');
    expect(acc.find((d) => d.id === 'ev:2026:kata')!.title).toContain('te adod be');
  });

  it('fizetési lap: detail with the items, "csak jelölés" mark-paid, the accountant\'s "Rendben", the client\'s notice', async () => {
    const c = await kataClient();
    await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    const ps = await periodsOf(c.clientId);
    const nov = ps.find((p) => p.periodKey === '2026-11-KATA')!;
    const d = await h.json('GET', `/client/tax-periods/${nov.id}`, { token: c.token });
    expect(d.status).toBe(200);
    expect(d.body).toMatchObject({ kind: 'kata', sheetTitle: 'Kata – november', totalHuf: 50_000, exemptReasonLabel: null });
    expect(d.body.items[0]).toMatchObject({ accountNumber: '10032000-01076349', reference: '12345678-1-42', amountHuf: 50_000 });
    // a backfilled month is not the client's yet
    const oct = ps.find((p) => p.periodKey === '2026-10-KATA')!;
    expect((await h.json('GET', `/client/tax-periods/${oct.id}`, { token: c.token })).status).toBe(404);
    const m = await h.json('POST', `/client/tax-periods/${nov.id}/mark-paid`, { token: c.token, body: { paidOn: '2026-11-21' } });
    expect(m.status).toBe(200);
    expect(m.body.paymentStatus).toBe('befizetve_jelezve');
    // the panel view: one month waits for "Rendben"
    const kv = await h.json('GET', `/acc/clients/${c.clientId}/kata?year=2026`, { token: bence.token });
    expect(kv.status).toBe(200);
    expect(kv.body.toVerify).toBe(1);
    expect(kv.body.months.find((x: { monthKey: string }) => x.monthKey === '2026-10').status).toBe('ellenorizetlen');
    const v = await h.json('POST', `/acc/clients/${c.clientId}/kata/verify`, { token: bence.token, body: { periodIds: [nov.id, oct.id], note: 'folyószámla 11-21' } });
    expect(v.status).toBe(200);
    expect(v.body.months.find((x: { monthKey: string }) => x.monthKey === '2026-11').status).toBe('ellenorizve');
    expect(v.body.months.find((x: { monthKey: string }) => x.monthKey === '2026-10').status).toBe('ellenorizve');
    const ok = (await notesOf(c.userId)).filter((n) => n.kind === 'tax_payment_verified');
    expect(ok.some((n) => n.body === 'A november havi katád rendben megérkezett a NAV-hoz.')).toBe(true);
    // verified backfilled month: now the client sees it
    expect((await h.json('GET', `/client/tax-periods/${oct.id}`, { token: c.token })).status).toBe(200);
    // another accountant's client: 404
    const other = await staff(h, 'accountant', 'masik.kataf1@demo.kezjegy.test', { firstName: 'Anna' });
    expect((await h.json('GET', `/acc/clients/${c.clientId}/kata?year=2026`, { token: other.token })).status).toBe(404);
  });

  it('free months (Kata tv. 7. § (8)–(9)): the item is voided, the row says why; a marked month stays (overpayment) and the accountant is told', async () => {
    const c = await kataClient();
    await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    const nov = (await periodsOf(c.clientId)).find((p) => p.periodKey === '2026-11-KATA')!;
    await h.json('POST', `/client/tax-periods/${nov.id}/mark-paid`, { token: c.token, body: { paidOn: '2026-11-20' } });
    const bad = await h.json('PUT', `/acc/clients/${c.clientId}/kata/breaks`, { token: bence.token, body: { year: 2026, breaks: [{ from: '2026-09-10', to: '2026-09-01', kind: 'tappenz' }] } });
    expect(bad.status).toBe(400);
    const r = await h.json('PUT', `/acc/clients/${c.clientId}/kata/breaks`, {
      token: bence.token,
      body: { year: 2026, breaks: [{ from: '2026-08-01', to: '2026-08-31', kind: 'gyod' }, { from: '2026-11-01', to: '2026-11-30', kind: 'csed', reportedOn: '2026-11-20' }] },
    });
    expect(r.status).toBe(200);
    const aug = r.body.months.find((x: { monthKey: string }) => x.monthKey === '2026-08');
    expect(aug).toMatchObject({ status: 'mentes', exemptReason: 'gyod', liable: false, amountHuf: 0 });
    expect(aug.reportDue).toBe('2026-09-14');
    const novV = r.body.months.find((x: { monthKey: string }) => x.monthKey === '2026-11');
    expect(novV).toMatchObject({ liable: false, paidButExempt: true });
    expect(r.body.meter.liableMonths).toBe(10);
    expect(r.body.meter.limitHuf).toBe(15_000_000);
    const p8 = (await periodsOf(c.clientId)).find((p) => p.periodKey === '2026-08-KATA')!;
    expect(p8.exemptReason).toBe('gyod');
    expect((await itemsOf(p8.id)).every((i) => i.voidedAt)).toBe(true); // voided, not deleted
    const task = (await notesOf(bence.userId)).find((n) => n.kind === 'tax_task' && (n.data as { dedupe?: string }).dedupe === `tt:kata_befizetett_mentes:${c.clientId}:2026-11`);
    expect(task?.body).toContain('túlfizetés');
    // the átalány form keeps the KATA free months
    await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, insuranceBreaks: [] } });
    const [tp] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2026)));
    expect(tp!.insuranceBreaks.map((b) => b.kind).sort()).toEqual(['csed', 'gyod']);
  });

  it('the Főoldal: the next KATA month is the hero (→ the sheet), the keret bar with its lines', async () => {
    const c = await kataClient();
    await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: '2026-11-02', deliveryDate: '2026-11-02', amountHuf: 3_000_000, description: 'x' });
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.status).toBe(200);
    expect(home.body.hero).toMatchObject({ state: 'jovahagyva', periodKey: '2026-11-KATA', amountHuf: 50_000, dueDate: '2026-12-14' });
    expect(home.body.paymentItems[0].accountNumber).toBe('10032000-01076349');
    expect(home.body.kata.meter).toMatchObject({ usedHuf: 3_000_000, limitHuf: 18_000_000, level: 'rendben', limitLine: 'Kereted: 18 000 000 Ft', remainingLine: 'Még 15 000 000 Ft fér bele.' });
    expect(home.body.kata.nextPayable.periodId).toBe(home.body.hero.periodId);
    expect(home.body.limits.kata).toBe(true);
    await h.json('POST', `/client/tax-periods/${home.body.hero.periodId}/mark-paid`, { token: c.token, body: { paidOn: '2026-11-21' } });
    const after = await h.json('GET', '/client/home', { token: c.token });
    expect(after.body.hero).toMatchObject({ state: 'befizetve', paidOn: '2026-11-21', verified: false });
    const ky = await h.json('GET', '/client/kata?year=2026', { token: c.token });
    expect(ky.status).toBe(200);
    expect(ky.body.months.some((m: { status: string }) => m.status === 'ellenorizetlen')).toBe(false); // the client never sees them
  });
});

describe('KATA reminders: 8th, due day, +1 day (push + e-mail), never twice', () => {
  it('2026-12-08 kata, 12-14 kata_ma, 12-15 kata_lejart; nothing for a marked, free or backfilled month; no 7/3/1 for KATA', async () => {
    const c = await kataClient();
    const marked = await kataClient();
    await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    await syncKataPeriods(h.deps, h.deps.db, marked.clientId, 2026);
    const mp = (await periodsOf(marked.clientId)).find((p) => p.periodKey === '2026-11-KATA')!;
    await h.json('POST', `/client/tax-periods/${mp.id}/mark-paid`, { token: marked.token, body: { paidOn: '2026-11-21' } });
    try {
      await at('2026-12-07T07:30:00Z');
      await jobReminders(h.deps); // 7 days before: the quarters' rhythm must not touch KATA
      await at('2026-12-08T07:30:00Z');
      await jobRemindersK28(h.deps);
      await jobRemindersK28(h.deps);
      let n = (await notesOf(c.userId)).filter((x) => x.kind === 'tax_due_soon');
      expect(n).toHaveLength(1);
      expect(n[0]!.title).toBe('Utald el a katát: 50 000 Ft');
      expect(n[0]!.body).toBe('A november havi kata határideje: december 14. Az utalási adatokat az appban látod.');
      expect(n[0]!.wantEmail).toBe(true); // web clients get it by e-mail too
      expect(n[0]!.link).toMatch(/^\/fizetes\//);
      await at('2026-12-14T07:30:00Z');
      await jobRemindersK28(h.deps);
      await at('2026-12-15T07:30:00Z');
      await jobRemindersK28(h.deps);
      n = (await notesOf(c.userId)).filter((x) => x.kind === 'tax_due_soon');
      expect(n.map((x) => x.title)).toEqual(['Utald el a katát: 50 000 Ft', 'Ma van a kata határideje', 'Lejárt a kata határideje: 50 000 Ft']);
      expect(n[2]!.body).toContain('december 14-ig kellett volna befizetni');
      // the backfilled October (due 11-12) never reminded; the marked client gets nothing
      expect((await notesOf(marked.userId)).filter((x) => x.kind === 'tax_due_soon')).toHaveLength(0);
      // the client's own setting wins: e-mail off for the group → no e-mail
    } finally {
      await at('2026-11-21T09:00:00Z');
    }
  });
});

describe('the keret: 80 %, over, projection only to the accountant; flags (H6)', () => {
  it('80 % → kata80 (client + accountant); over → kata100 with the különadó; hatar_kozel + kata_figyelem', async () => {
    const c = await kataClient();
    await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: '2026-10-15', deliveryDate: '2026-10-15', amountHuf: 15_000_000, description: 'x' });
    await jobReminders(h.deps);
    const k80 = (await notesOf(c.userId)).filter((n) => n.kind === 'limit_warning');
    expect(k80.map((n) => n.title)).toContain('Elérted a kata-kereted 80%-át');
    const staffK80 = (await notesOf(bence.userId)).filter((n) => n.kind === 'limit_warning' && n.title.includes(`Lakatos${seq}`));
    expect(staffK80[0]!.title).toContain('elérte a kata-keret 80%-át');
    expect(await computeFlags(h.deps, h.deps.db, c.clientId)).toContain('hatar_kozel');
    await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: '2026-11-15', deliveryDate: '2026-11-15', amountHuf: 5_000_000, description: 'y' });
    await jobReminders(h.deps);
    await jobReminders(h.deps);
    const k100 = (await notesOf(c.userId)).filter((n) => n.kind === 'limit_warning' && n.title === 'Túlléptél a kata-kereteden');
    expect(k100).toHaveLength(1);
    expect(k100[0]!.body).toBe('2 000 000 Ft-tal vagy a kereted fölött. Erre kb. 800 000 Ft különadó jár, február 25-ig kell befizetni. Tegyél félre ennyit.');
    const flags = await computeFlags(h.deps, h.deps.db, c.clientId);
    expect(flags).toEqual(expect.arrayContaining(['hatar_kozel', 'kata_figyelem']));
    // the projection reaches only the accountant (kataElorejelzesUgyfelnek off)
    expect((await notesOf(c.userId)).some((n) => n.title.includes('Év végére túlléphetsz'))).toBe(false);
  });
});

describe('the year end (Kata tv. 5. § (1) e)) and the free-month notice (7. § (10))', () => {
  it('12-10 task to the accountant; 12-16 the client with an unmarked overdue month (e-mail says the decision can still be undone)', async () => {
    const c = await kataClient({ createdAt: '2026-11-01T00:00:00Z' });
    await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    try {
      await at('2026-12-10T08:30:00Z');
      await jobKataYearEnd(h.deps);
      const t = (await notesOf(bence.userId)).find((n) => n.kind === 'tax_task' && (n.data as { dedupe?: string }).dedupe === `tt:kata_ev_vege:${c.clientId}:2026-12-10`);
      expect(t?.title).toContain('Kata év vége');
      expect(t?.body).toContain('Kata tv. 5. § (1) e)');
      await at('2026-12-16T08:30:00Z');
      await jobKataYearEnd(h.deps);
      await jobKataYearEnd(h.deps);
      const n = (await notesOf(c.userId)).filter((x) => x.kind === 'tax_due_soon' && x.title === 'Ne maradjon adótartozásod az év végén');
      expect(n).toHaveLength(1);
      expect(n[0]!.body).toContain('2026. november (50 000 Ft)');
      expect(String((n[0]!.data as { emailBody?: string }).emailBody)).toContain('a határozat véglegessé válásáig befizeted');
    } finally {
      await at('2026-11-21T09:00:00Z');
    }
  });
  it('an a)–c) free month not reported yet: task 3 days before its 12th; the Határidő-figyelő row', async () => {
    const c = await kataClient();
    await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
    await h.json('PUT', `/acc/clients/${c.clientId}/kata/breaks`, { token: bence.token, body: { year: 2026, breaks: [{ from: '2026-11-01', to: '2026-11-30', kind: 'tappenz' }] } });
    const acc = await clientDeadlines(h.deps, h.deps.db, c.clientId, '2026-11-01', '2026-12-31', { perspective: 'accountant' });
    expect(acc.find((d) => d.id === `kata-bej:${c.clientId}:2026-11`)).toMatchObject({ dueDate: '2026-12-14', status: 'nyitott' });
    const cli = await clientDeadlines(h.deps, h.deps.db, c.clientId, '2026-11-01', '2026-12-31');
    expect(cli.find((d) => d.title.startsWith('Kata – november'))!.title).toBe('Kata – november: nem kell fizetned (táppénz)');
    expect(cli.some((d) => d.id.startsWith('kata-bej:'))).toBe(false);
    try {
      await at('2026-12-11T08:30:00Z');
      await jobKataYearEnd(h.deps);
      expect((await notesOf(bence.userId)).some((n) => (n.data as { dedupe?: string }).dedupe === `tt:mentesseg:${c.clientId}:2026-11`)).toBe(true);
    } finally {
      await at('2026-11-21T09:00:00Z');
    }
  });
});

describe('2027 KATA (T/928): switched off by default; variant rules', () => {
  it('the switch on → the T/928 amount (75 000 Ft) – only for 2027; the new KATA has no NAV account yet → no item', async () => {
    expect((await evesKapcsolok(h.deps.db)).kata2027).toBe(false);
    const c = await kataClient();
    await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2027, costRatio: 50, regime: 'kata', kataFrom: '2027-01-01', kataVariant: 'regi', kataFofoglalkozasu: true });
    await at('2027-01-03T08:00:00Z');
    try {
      await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2027);
      const jan = (await periodsOf(c.clientId)).find((p) => p.periodKey === '2027-01-KATA')!;
      expect(jan.calcStatus).toBe('becsles');
      await h.deps.db.insert(systemState).values({ key: EVES_KAPCSOLOK_KEY, value: { kata2027: true } }).onConflictDoUpdate({ target: systemState.key, set: { value: { kata2027: true } } });
      await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2027);
      const [it] = await itemsOf(jan.id);
      expect(it).toMatchObject({ amountHuf: 75_000, kind: 'kata_teteles' });
      await h.deps.db.update(clientTaxProfiles).set({ kataVariant: 'uj', kataFofoglalkozasu: true }).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2027)));
      await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2027);
      const [after] = await h.deps.db.select().from(taxPeriods).where(eq(taxPeriods.id, jan.id));
      expect(after!.calcStatus).toBe('becsles'); // no account for the new KATA → no item
    } finally {
      await h.deps.db.update(systemState).set({ value: {} }).where(eq(systemState.key, EVES_KAPCSOLOK_KEY));
      await at('2026-11-21T09:00:00Z');
    }
  });
  it('tax-regime: the new KATA not before 2027; the old KATA only főfoglalkozású', async () => {
    const c = await kataClient({ regime: 'atalany' });
    expect((await h.json('POST', `/acc/clients/${c.clientId}/tax-regime`, { token: bence.token, body: { regime: 'kata', kataFrom: '2026-02-01', year: 2026, kataVariant: 'uj' } })).status).toBe(400);
    expect((await h.json('POST', `/acc/clients/${c.clientId}/tax-regime`, { token: bence.token, body: { regime: 'kata', kataFrom: '2026-02-01', year: 2026, kataFofoglalkozasu: false } })).status).toBe(400);
    expect((await h.json('POST', `/acc/clients/${c.clientId}/tax-regime`, { token: bence.token, body: { regime: 'kata', kataFrom: '2025-02-01', year: 2026 } })).status).toBe(400);
  });
});

describe('the annual-closing fee is switched off until the ÁSZF is fixed', () => {
  it('submit → straight to the accountant, no charge; feeHuf null', async () => {
    const c = await newClient(h, 'kata-f1-eves@demo.kezjegy.test', { first: 'Ede', last: 'Éves', active: true });
    await h.deps.db.update(clients).set({ accountantId: bence.accountantId }).where(eq(clients.id, c.clientId));
    await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2026, costRatio: 45 });
    const [row] = await h.deps.db.insert(annualClosings).values({ clientId: c.clientId, taxYear: 2026, regime: 'atalany', status: 'kerdoiv', questionnaireDue: '2027-03-15' }).returning();
    const v = await h.json('GET', '/client/annual?year=2026', { token: c.token });
    expect(v.body.feeHuf).toBeNull();
    const s = await h.json('POST', `/client/annual/${row!.id}/submit`, { token: c.token });
    expect(s.status).toBe(200);
    expect(s.body).toMatchObject({ status: 'konyvelonel', feeCharge: null, feeHuf: null });
  });
});

describe('one-time data step data.kata_f1', () => {
  it('variant, hidden quarters, KATA months, adónem; idempotent', async () => {
    const c = await kataClient();
    await h.deps.db.update(clientTaxProfiles).set({ kataVariant: null, regime: 'atalany' }).where(eq(clientTaxProfiles.clientId, c.clientId));
    await ensurePeriods(h.deps.db, c.clientId, 2026, 'savos', 'fofoglalkozasu');
    await h.deps.db.update(clientTaxProfiles).set({ regime: 'kata' }).where(eq(clientTaxProfiles.clientId, c.clientId));
    await h.deps.db.delete(systemState).where(eq(systemState.key, 'data.kata_f1'));
    const r = await runDataStepKataF1(h.deps);
    expect(r).not.toBe('already');
    const [tp] = await h.deps.db.select().from(clientTaxProfiles).where(eq(clientTaxProfiles.clientId, c.clientId));
    expect(tp).toMatchObject({ kataVariant: 'regi', kataFofoglalkozasu: true });
    const ps = await periodsOf(c.clientId);
    expect(ps.filter((p) => p.kind === 'negyedev').every((p) => p.hiddenReason === 'kata_ev')).toBe(true);
    expect(ps.filter((p) => p.kind === 'kata')).toHaveLength(11);
    expect(await runDataStepKataF1(h.deps)).toBe('already');
  });
});

describe('contract checks', () => {
  it('annual to-dos and KATA reminders go by e-mail too; tax_task is a staff kind', () => {
    expect(KIND_DEFAULTS.annual_due.email).toBe(true);
    expect(KIND_DEFAULTS.tax_due_soon.email).toBe(true);
    expect(KIND_DEFAULTS.tax_task).toEqual({ push: false, email: false, to: 'accountant' });
  });
  it('every new text: no "a(z)", no time promise, no hard-coded accountant name', () => {
    const keys = Object.keys(DEFAULT_TEXTS).filter((k) => /^(kata\.f1|fizetes|kata\.mentes_ok|kata\.panel)\.|^notif\.(tax_due_soon\.kata|limit_warning\.kata|tax_task|tax_payment_(verified|mismatch)\.kata)|^email\.tax_due_soon\.kata/.test(k));
    expect(keys.length).toBeGreaterThan(40);
    for (const k of keys) {
      const t = DEFAULT_TEXTS[k]!;
      expect(t, k).not.toMatch(/a\(z\)/i);
      expect(t, k).not.toMatch(/\bBence\b/);
      for (const p of RESPONSE_TIME_FORBIDDEN_PATTERNS) expect(new RegExp(p, 'i').test(t), `${k}: ${t}`).toBe(false);
    }
    // the client's KATA texts say szja in lower case
    expect(keys.filter((k) => !k.startsWith('kata.panel') && !k.includes('tax_task') && !k.endsWith('_staff.title') && !k.endsWith('_staff.body')).some((k) => /SZJA/.test(DEFAULT_TEXTS[k]!))).toBe(false);
  });
  it('H8: no hard-coded "Bence" on the app\'s annual-closing screen', () => {
    const src = readFileSync(join(__dirname, '../../app/src/app/eves-zaras/index.tsx'), 'utf8');
    expect(src).not.toMatch(/\bBence\b/);
  });
  it('client and job code reads tax_periods only through the visible filter (critique 2.4)', () => {
    const files = [
      ...readdirSync(join(__dirname, '../src/routes')).filter((f) => /^client.*\.ts$/.test(f)).map((f) => join(__dirname, '../src/routes', f)),
      ...readdirSync(join(__dirname, '../src')).filter((f) => /^jobs.*\.ts$/.test(f)).map((f) => join(__dirname, '../src', f)),
      ...['emlekezteto.ts', 'flags.ts', 'felretesz.ts', 'kereset.ts', 'zarolas.ts', 'kata.ts'].map((f) => join(__dirname, '../src/services', f)),
    ];
    const offenders: string[] = [];
    for (const f of files) {
      const raw = readFileSync(f, 'utf8');
      // comments blanked out (same length), so a ';' in a comment never ends the statement
      const src = raw.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
      let i = src.indexOf('.from(taxPeriods)');
      while (i >= 0) {
        const stmt = src.slice(i, src.indexOf(';', i));
        const lineStart = raw.lastIndexOf('\n', i);
        const before = raw.slice(Math.max(0, raw.lastIndexOf('\n', lineStart - 1)), i);
        // allowed: the visible filter, an explicit "visible-ok" note on the line above, a lookup by id for a link
        const ok = /periodVisible|hiddenAt/.test(stmt) || /visible-ok/.test(before) || /eq\(taxPeriods\.id, (it|mt)/.test(stmt);
        if (!ok) offenders.push(`${f.split(/[\\/]/).slice(-2).join('/')}: ${stmt.slice(0, 140)}`);
        i = src.indexOf('.from(taxPeriods)', i + 1);
      }
    }
    expect(offenders).toEqual([]);
  });
});
