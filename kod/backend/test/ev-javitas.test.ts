// Javító kör 2026-11-21 (éves ciklus + KATA): the fixes of the four reviews – the approved closing says so, the draft the
// client approves is the one sent (not a later quarterly return), the Főoldal hero shows an open yearly difference, the
// önellenőrzés (paid in full → only the pótlék; HIPA → no pótlék; the pótlék follows the filing day; 1 000 Ft per tax; a
// draft is no "ismételt"), the HIPA return rule (Htv. 39/A. § (8)), the tax-profile card of a KATA client, the upload
// limits, the next KATA month, the next year's mode, the data step, the fee switch, the group "Rendben" with its note.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { annualClosings, clients, clientTaxProfiles, documents, notificationPrefs, notifications, revenueItems, systemState, taxCorrections, taxPaymentItems, taxPeriods } from '../src/db/schema.js';
import { ensurePeriods } from '../src/services/tax.js';
import { syncKataPeriods } from '../src/services/kata.js';
import { runDataStepEvJavitas } from '../src/services/datastep-evjav.js';
import { bodyLimitFor } from '../src/app.js';
import { newClient, pdfBytes, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
beforeAll(async () => {
  h = await setup({ now: '2027-04-20T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.evjav@demo.kezjegy.test');
});
afterAll(async () => h.close());

const at = (iso: string) => h.clock.set(iso);
let seq = 0;
async function client(o: { regime?: 'atalany' | 'kata'; hipaMethod?: 'savos' | 'altalanos' } = {}) {
  seq++;
  const c = await newClient(h, `ev-javitas-${seq}@demo.kezjegy.test`, { first: 'Jutka', last: `Javító${seq}`, active: true });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId, adoszam: '12345678-1-42', hqMunicipality: 'Ózd', createdAt: new Date('2026-01-01T00:00:00Z') }).where(eq(clients.id, c.clientId));
  const regime = o.regime ?? 'atalany';
  await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2026, costRatio: 45, regime, status: 'fofoglalkozasu', hipaMethod: o.hipaMethod ?? 'savos', hipaAccountNumber: '11784009-15400017-03540000', ...(regime === 'kata' ? { kataFrom: '2026-01-01', kataVariant: 'regi' as const, kataFofoglalkozasu: true } : {}) });
  await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2027, costRatio: 50, regime: 'atalany', status: 'fofoglalkozasu', hipaMethod: o.hipaMethod ?? 'savos' });
  return c;
}
async function quarters(clientId: string) {
  await ensurePeriods(h.deps.db, clientId, 2026, 'savos', 'fofoglalkozasu');
  const ps = (await h.deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.kind, 'negyedev')))).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  for (const p of ps) {
    await h.deps.db.update(taxPeriods).set({ calcStatus: 'jovahagyva', paymentStatus: 'ellenorizve', filingStatus: 'beadva', filedOn: p.dueDate, filingForm: '2658' }).where(eq(taxPeriods.id, p.id));
    for (const [kind, amountHuf, acc] of [
      ['szja_eloleg', 30_000, '10032000-06056353'],
      ['tb_jarulek', 60_000, '10032000-06055802'],
      ['szocho', 40_000, '10032000-06055912'],
    ] as const)
      await h.deps.db.insert(taxPaymentItems).values({ taxPeriodId: p.id, kind, label: kind, amountHuf, dueDate: p.dueDate, accountName: 'NAV', accountNumber: acc, iban: 'HU00', reference: '12345678-1-42', markedPaidAt: new Date('2026-12-01T00:00:00Z'), markedPaidOn: '2026-12-01', verification: 'rendben', verifiedAt: new Date() });
  }
  return ps;
}
async function annual(clientId: string, o: { status?: 'konyvelonel' | 'kesz' } = {}) {
  const [row] = await h.deps.db.insert(annualClosings).values({ clientId, taxYear: 2026, regime: 'atalany', status: o.status ?? 'konyvelonel', questionnaireDue: '2027-03-15', submittedAt: new Date('2027-02-01T00:00:00Z') }).returning();
  return row!;
}
function form(fields: Record<string, string>, files: Record<string, boolean> = {}): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const k of Object.keys(files)) f.append(k, new Blob([pdfBytes()], { type: 'application/pdf' }), `${k}.pdf`);
  return f;
}
const notesOf = (userId: string) => h.deps.db.select().from(notifications).where(eq(notifications.userId, userId));
const periodsOf = (clientId: string) => h.deps.db.select().from(taxPeriods).where(eq(taxPeriods.clientId, clientId));
const itemsOf = (periodId: string) => h.deps.db.select().from(taxPaymentItems).where(eq(taxPaymentItems.taxPeriodId, periodId));
const amountsOk = { szjaHuf: 150_000, advancesHuf: 120_000, revenueHuf: 6_000_000, incomeHuf: 3_300_000, taxFreeHuf: 1_936_800, taxableHuf: 1_000_000, overrideReason: 'a NAV-tervezet szerint', matchesDraft: true };

describe('éves zárás: the approval and the draft', () => {
  it('approved → "Jóváhagytad…", no approve button; a later quarterly return is never the draft; the hero shows the difference', async () => {
    const c = await client();
    await quarters(c.clientId);
    const a = await annual(c.clientId);
    expect((await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: amountsOk })).status).toBe(200);
    const d = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/draft`, { token: bence.token, form: form({}, { file: true }) });
    expect(d.status).toBe(200);
    const [row] = await h.deps.db.select().from(annualClosings).where(eq(annualClosings.id, a.id));
    expect(row!.draftDocumentId).toBeTruthy();
    // a later 'bevallas' document of the client (e.g. the Q1 2658 in April) – the closing keeps its own draft
    await h.deps.db.insert(documents).values({ clientId: c.clientId, dossierMonth: '2027-04', source: 'konyvelo', category: 'bevallas', title: 'Bevallás az I. negyedévről', visibility: 'kozos', createdAt: new Date('2027-04-20T10:00:00Z') });
    const cv = await h.json('GET', '/client/annual?year=2026', { token: c.token });
    expect(cv.body.draft.title).toBe('Bevallás tervezete – jóváhagyásra');
    expect(cv.body.nextAction).toBe('jovahagyas');
    const ok = await h.json('POST', `/client/annual/${a.id}/approve`, { token: c.token, body: { hash: cv.body.approvalHash } });
    expect(ok.status).toBe(200);
    expect(ok.body.statusText).toContain('Jóváhagytad a bevallásodat.');
    expect(ok.body.nextAction).toBeNull();
    // a second tap: the same, no error
    expect((await h.json('POST', `/client/annual/${a.id}/approve`, { token: c.token, body: { hash: cv.body.approvalHash } })).status).toBe(200);
    const acc = await h.json('GET', `/acc/clients/${c.clientId}/annual?year=2026`, { token: bence.token });
    expect(acc.body.statusText).toContain('Jóváhagytad');
    expect(acc.body.checklist.find((x: { item: string }) => x.item === 'ugyfel_jovahagyta').done).toBe(true);
    // filed → the Főoldal hero is the difference, the timeline says what is left, the refund label is never "-ától"
    const f = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'IKT-1' }, { file: true, receipt: true }) });
    expect(f.status).toBe(200);
    expect(f.body.statusText).toBe('Beadtuk a bevallásodat. Utald el a különbözetet: 30 000 Ft, május 20-ig.');
    const home = await h.json('GET', '/client/home', { token: c.token });
    expect(home.body.hero).toMatchObject({ state: 'jovahagyva', amountHuf: 30_000, dueDate: '2027-05-20', periodLabel: 'Szja-különbözet 2026' });
    const cv2 = await h.json('GET', '/client/annual?year=2026', { token: c.token });
    expect(cv2.body.timeline.find((t: { key: string }) => t.key === 'beadas').title).toBe('Utald el a különbözetet');
  });

  it('a refund: the timeline row is "május 20-ig" (expected by), the summary prefill has the adómentes rész', async () => {
    const c = await client();
    await quarters(c.clientId);
    const a = await annual(c.clientId);
    const pre = await h.json('GET', `/acc/clients/${c.clientId}/annual?year=2026`, { token: bence.token });
    expect(pre.status).toBe(200);
    expect(pre.body.prefill).toHaveProperty('advancesHuf', 120_000);
    await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { ...amountsOk, szjaHuf: 100_000 } });
    await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/draft`, { token: bence.token, form: form({}, { file: true }) });
    const cv = await h.json('GET', '/client/annual?year=2026', { token: c.token });
    await h.json('POST', `/client/annual/${a.id}/approve`, { token: c.token, body: { hash: cv.body.approvalHash } });
    await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'IKT-2' }, { file: true, receipt: true }) });
    const cv2 = await h.json('GET', '/client/annual?year=2026', { token: c.token });
    expect(cv2.body.timeline.find((t: { key: string }) => t.key === 'visszajar').dateLabel).toBe('május 20-ig');
  });
});

describe('önellenőrzés fixes', () => {
  async function corr(c: { clientId: string }, body: Record<string, unknown>) {
    return h.json('POST', `/acc/clients/${c.clientId}/corrections`, { token: bence.token, body });
  }
  it('paid in full (Art. 212. § (2)): only the pótlék is an item; per-tax 1 000 Ft rule; a draft is no "ismételt"', async () => {
    const c = await client();
    const ps = await quarters(c.clientId);
    const q3 = ps.find((p) => p.quarter === 3)!;
    const base = { form: '2658', subjectKey: '2026-Q3', originalPeriodId: q3.id, cause: 'kesoi_irat', reason: 'Későn érkezett egy számla, ezért javítjuk.', plannedFiledOn: '2027-04-20' };
    // 5 000 Ft szja + 800 Ft szocho: the 800 Ft line is refused (per tax)
    const mixed = await corr(c, { ...base, diffs: [{ adonem: '103', label: 'Szja', amountHuf: 5_000, originalDueDate: '2026-10-12' }, { adonem: '258', label: 'Szocho', amountHuf: 800, originalDueDate: '2026-10-12' }] });
    expect(mixed.status).toBe(400);
    const cr = await corr(c, { ...base, paidInFull: true, diffs: [{ adonem: '103', label: 'Szja', amountHuf: 100_000, originalDueDate: '2026-10-12' }] });
    expect(cr.status).toBe(201);
    expect(cr.body.seq).toBe(1);
    // a second draft of the same return while the first is not filed: still seq 1 (no × 1,5)
    const cr2 = await corr(c, { ...base, diffs: [{ adonem: '103', label: 'Szja', amountHuf: 20_000, originalDueDate: '2026-10-12' }] });
    expect(cr2.body.seq).toBe(1);
    await h.json('POST', `/acc/corrections/${cr2.body.id}/cancel`, { token: bence.token, body: { reason: 'dupla' } });
    const sug = cr.body.potlek.suggestedHuf as number;
    expect(sug).toBeGreaterThan(0);
    expect(sug).toBeLessThanOrEqual(5_000);
    await h.json('POST', `/acc/corrections/${cr.body.id}/potlek`, { token: bence.token, body: { huf: sug } });
    await h.json('POST', `/acc/corrections/${cr.body.id}/send`, { token: bence.token });
    const cv = await h.json('GET', `/client/corrections/${cr.body.id}`, { token: c.token });
    expect(cv.body).toMatchObject({ totalHuf: sug, diffsAlreadyPaid: true });
    await h.json('POST', `/client/corrections/${cr.body.id}/approve`, { token: c.token, body: { hash: cv.body.approvalHash } });
    const filed = await h.json('POST', `/acc/corrections/${cr.body.id}/filed`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'O-1' }, { file: true, receipt: true }) });
    expect(filed.status).toBe(200);
    const pp = (await periodsOf(c.clientId)).find((p) => p.kind === 'onellenorzes')!;
    expect((await itemsOf(pp.id)).map((i) => [i.kind, i.amountHuf, i.adonem])).toEqual([['onellenorzesi_potlek', sug, '215']]);
    const note = (await notesOf(c.userId)).find((n) => n.kind === 'correction_status' && n.title.includes('pótlékot kell befizetned'));
    expect(note).toBeTruthy();
  });

  it('the pótlék follows the filing day (Art. 212. § (1)); a HIPA correction has no pótlék approval', async () => {
    const c = await client();
    const ps = await quarters(c.clientId);
    const q3 = ps.find((p) => p.quarter === 3)!;
    at('2027-04-10T09:00:00Z');
    let id = '';
    try {
      const cr = await corr(c, { form: '2658', subjectKey: '2026-Q3', originalPeriodId: q3.id, cause: 'kesoi_irat', reason: 'Későn érkezett egy számla, ezért javítjuk.', diffs: [{ adonem: '103', label: 'Szja', amountHuf: 100_000, originalDueDate: '2026-10-12' }] });
      id = cr.body.id;
      // planned for 04-10 (the creation day): 180 days × 0,015 % × 100 000 = 2 700
      expect(cr.body.potlek.suggestedHuf).toBe(2_700);
      await h.json('POST', `/acc/corrections/${id}/potlek`, { token: bence.token, body: { huf: 2_700 } });
      await h.json('POST', `/acc/corrections/${id}/send`, { token: bence.token });
      const cv = await h.json('GET', `/client/corrections/${id}`, { token: c.token });
      await h.json('POST', `/client/corrections/${id}/approve`, { token: c.token, body: { hash: cv.body.approvalHash } });
    } finally {
      at('2027-04-20T09:00:00Z');
    }
    // filed 10 days later: 190 days → 2 850, recomputed and audited
    const filed = await h.json('POST', `/acc/corrections/${id}/filed`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'O-2' }, { file: true, receipt: true }) });
    expect(filed.status).toBe(200);
    const [row] = await h.deps.db.select().from(taxCorrections).where(eq(taxCorrections.id, id));
    expect(row!.potlekHuf).toBe(2_850);
    const pp = (await periodsOf(c.clientId)).find((p) => p.kind === 'onellenorzes')!;
    expect((await itemsOf(pp.id)).find((i) => i.kind === 'onellenorzesi_potlek')!.amountHuf).toBe(2_850);
    // HIPA: no pótlék approval in the app
    const a = await annual(c.clientId, { status: 'kesz' });
    await h.deps.db.update(annualClosings).set({ filedSzjaAt: new Date('2027-04-01T00:00:00Z'), filedHipaAt: new Date('2027-04-01T00:00:00Z') }).where(eq(annualClosings.id, a.id));
    const hipa = await corr(c, { form: 'HIPA', subjectKey: '2026', cause: 'egyeb', reason: 'Változott az adómérték, javítjuk.', diffs: [{ adonem: 'HIPA', label: 'Iparűzési adó', amountHuf: 20_000, originalDueDate: '2026-09-01' }] });
    expect(hipa.status).toBe(201);
    const pa = await h.json('POST', `/acc/corrections/${hipa.body.id}/potlek`, { token: bence.token, body: { huf: 500, reason: 'kalkulátor' } });
    expect(pa.status).toBe(409);
  });
});

describe('HIPA (Htv. 39/A. § (8))', () => {
  it('no return only if H ≤ E (sávos); then next year’s base is the advance E; általános always needs a return', async () => {
    const c = await client();
    const a = await annual(c.clientId);
    const bad = await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/hipa`, { token: bence.token, body: { taxHuf: 150_000, advancesHuf: 120_000, returnNeeded: false } });
    expect(bad.status).toBe(400);
    const ok = await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/hipa`, { token: bence.token, body: { taxHuf: 100_000, advancesHuf: 120_000, returnNeeded: false } });
    expect(ok.status).toBe(200);
    const [np] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2027)));
    expect(np!.hipaPriorYearHuf).toBe(120_000);
    const c2 = await client({ hipaMethod: 'altalanos' });
    const a2 = await annual(c2.clientId);
    expect((await h.json('PUT', `/acc/clients/${c2.clientId}/annual/${a2.id}/hipa`, { token: bence.token, body: { taxHuf: 100_000, advancesHuf: 120_000, returnNeeded: false } })).status).toBe(400);
  });
});

describe('KATA client: the tax-profile card, the next month, the reserve, the next year', () => {
  it('the card can be saved with KATA free months (they are kept); the reserve says the KATA sentence', async () => {
    at('2026-11-21T09:00:00Z');
    try {
      const c = await client({ regime: 'kata' });
      const br = await h.json('PUT', `/acc/clients/${c.clientId}/kata/breaks`, { token: bence.token, body: { year: 2026, breaks: [{ from: '2026-03-01', to: '2026-04-30', kind: 'gyed' }] } });
      expect(br.status).toBe(200);
      const prof = await h.json('GET', `/acc/clients/${c.clientId}`, { token: bence.token });
      const breaks = (prof.body.taxProfile?.insuranceBreaks ?? [{ from: '2026-03-01', to: '2026-04-30', kind: 'gyed' }]) as unknown[];
      const save = await h.json('PATCH', `/acc/clients/${c.clientId}/tax-profile`, { token: bence.token, body: { year: 2026, costRatio: 45, insuranceBreaks: breaks } });
      expect(save.status).toBe(200);
      const [tp] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2026)));
      expect(tp!.insuranceBreaks.map((b) => b.kind)).toEqual(['gyed']);
      const res = await h.json('GET', '/client/reserve', { token: c.token });
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).toContain('Havonta 50 000 Ft a kata.');
      // the panel: no átalány reserve for a KATA client
      expect(prof.body.reserve ?? null).toBeNull();
    } finally {
      at('2027-04-20T09:00:00Z');
    }
  });

  it('after marking November, the next KATA month is December (due 12 January)', async () => {
    at('2026-11-21T09:00:00Z');
    try {
      const c = await client({ regime: 'kata' });
      await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
      await h.deps.db.insert(revenueItems).values({ clientId: c.clientId, source: 'kezi', receivedOn: '2026-11-02', deliveryDate: '2026-11-02', amountHuf: 1_000_000, description: 'x' });
      const home = await h.json('GET', '/client/home', { token: c.token });
      await h.json('POST', `/client/tax-periods/${home.body.hero.periodId}/mark-paid`, { token: c.token, body: { paidOn: '2026-11-21' } });
      const after = await h.json('GET', '/client/home', { token: c.token });
      expect(after.body.kata.nothingToPayLine).toBe('Most nincs mit fizetned. A következő kata: december, január 12-ig.');
    } finally {
      at('2027-04-20T09:00:00Z');
    }
  });

  it('the next year’s mode is recorded in advance and kept; the new KATA needs the főfoglalkozás answer', async () => {
    at('2026-12-02T09:00:00Z');
    try {
      const c = await client({ regime: 'kata' });
      await h.deps.db.delete(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2027)));
      const det0 = await h.json('GET', `/acc/clients/${c.clientId}`, { token: bence.token });
      expect(det0.body.nextYearRegime).toMatchObject({ year: 2027, recorded: false, newKataDraft: true });
      expect((await h.json('POST', `/acc/clients/${c.clientId}/next-year-regime`, { token: bence.token, body: { year: 2027, regime: 'kata', kataVariant: 'uj' } })).status).toBe(400);
      const r = await h.json('POST', `/acc/clients/${c.clientId}/next-year-regime`, { token: bence.token, body: { year: 2027, regime: 'kata', kataVariant: 'regi', filedOn: '2026-12-01', filedBy: 'konyvelo', note: 'marad a régi katában' } });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ recorded: true, regime: 'kata', kataVariant: 'regi', kataFofoglalkozasu: true, filedBy: 'konyvelo' });
      const [np] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2027)));
      expect(np).toMatchObject({ regime: 'kata', kataFrom: '2027-01-01', kataVariant: 'regi' });
      // no 2027 period before 1 January
      expect((await periodsOf(c.clientId)).some((p) => p.year === 2027)).toBe(false);
      expect((await h.json('POST', `/acc/clients/${c.clientId}/next-year-regime`, { token: bence.token, body: { year: 2028, regime: 'atalany' } })).status).toBe(400);
    } finally {
      at('2027-04-20T09:00:00Z');
    }
  });

  it('the group "Rendben" needs the statement row as a note, and tells the client once', async () => {
    at('2026-11-21T09:00:00Z');
    try {
      const c = await client({ regime: 'kata' });
      await syncKataPeriods(h.deps, h.deps.db, c.clientId, 2026);
      const ids = (await periodsOf(c.clientId)).filter((p) => p.kind === 'kata' && p.backfilled).map((p) => p.id);
      expect(ids.length).toBeGreaterThan(2);
      expect((await h.json('POST', `/acc/clients/${c.clientId}/kata/verify`, { token: bence.token, body: { periodIds: ids } })).status).toBe(400);
      const ok = await h.json('POST', `/acc/clients/${c.clientId}/kata/verify`, { token: bence.token, body: { periodIds: ids, note: 'folyószámla 2026.11.20., havi 50 000 Ft' } });
      expect(ok.status).toBe(200);
      expect((await notesOf(c.userId)).filter((n) => n.kind === 'tax_payment_verified')).toHaveLength(1);
    } finally {
      at('2027-04-20T09:00:00Z');
    }
  });
});

describe('platform', () => {
  it('the filings with documents may send up to 60 MB', () => {
    for (const p of ['/api/v1/acc/clients/x/annual/y/draft', '/api/v1/acc/clients/x/annual/y/filed-szja', '/api/v1/acc/clients/x/annual/y/filed-hipa', '/api/v1/acc/corrections/z/filed', '/api/v1/acc/clients/x/reconciliations'])
      expect(bodyLimitFor(p)).toBeGreaterThan(50 * 1024 * 1024);
    expect(bodyLimitFor('/api/v1/acc/clients/x/annual/y/amounts')).toBe(1024 * 1024);
  });

  it('data step: an annual_due pref with the old default gets the e-mail; a switched-off push stays; once', async () => {
    const c1 = await client();
    const c2 = await client();
    await h.deps.db.insert(notificationPrefs).values({ userId: c1.userId, kind: 'annual_due', push: true, email: false });
    await h.deps.db.insert(notificationPrefs).values({ userId: c2.userId, kind: 'annual_due', push: false, email: false });
    await h.deps.db.delete(systemState).where(eq(systemState.key, 'data.ev_javitas'));
    const r = await runDataStepEvJavitas(h.deps);
    expect(r).toMatchObject({ annualPrefs: 1 });
    expect(await runDataStepEvJavitas(h.deps)).toBe('already');
    const [p1] = await h.deps.db.select().from(notificationPrefs).where(and(eq(notificationPrefs.userId, c1.userId), eq(notificationPrefs.kind, 'annual_due')));
    const [p2] = await h.deps.db.select().from(notificationPrefs).where(and(eq(notificationPrefs.userId, c2.userId), eq(notificationPrefs.kind, 'annual_due')));
    expect(p1!.email).toBe(true);
    expect(p2!.email).toBe(false);
  });

  it('the fee list has no annual-closing fee while its switch is off', async () => {
    const c = await client();
    const f = await h.json('GET', '/client/fees', { token: c.token });
    expect(f.status).toBe(200);
    expect(f.body.table.some((x: { kind: string }) => x.kind === 'eves_zaras')).toBe(false);
  });
});
