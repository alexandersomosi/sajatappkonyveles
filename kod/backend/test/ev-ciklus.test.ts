// SPEC §32.B – éves ciklus (F2/F3, 2026-11-21): the amounts of the yearly return and the client's approval (the hash covers
// the numbers), the filing with the NAV iktatószám, the difference (payment on the NAV account / refund by Art. 64. § (1)),
// the yearly HIPA, the automatic "kész", the timeline, the önellenőrzés with the pótlék suggestion the accountant approves
// (Art. 211. § (3), 212. §; HIPA never on the 215 account), the NAV folyószámla check (never ticked by default; "rendben"
// only from a statement row; 224 / 226), the year overview, the former client's last year (switch, default off), the
// e-mails of the important steps, the texts.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accountReconciliations, annualClosings, clients, clientTaxProfiles, notifications, systemState, taxCorrections, taxPaymentItems, taxPeriods } from '../src/db/schema.js';
import { ensurePeriods } from '../src/services/tax.js';
import { clientDeadlines, computeFlags } from '../src/services/flags.js';
import { jobAnnualOpen, jobAnnualReminders } from '../src/services/eves-zaras.js';
import { jobRefundWatch } from '../src/services/eves-ciklus.js';
import { jobAccountChecks } from '../src/services/folyoszamla.js';
import { DEFAULT_TEXTS } from '../src/content.js';
import { RESPONSE_TIME_FORBIDDEN_PATTERNS } from '../src/_shared/enums.js';
import { EVES_KAPCSOLOK_KEY } from '../src/_shared/kata.js';
import { newClient, pdfBytes, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;
beforeAll(async () => {
  h = await setup({ now: '2027-04-20T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.ev@demo.kezjegy.test');
  admin = await staff(h, 'admin', 'admin.ev@demo.kezjegy.test');
});
afterAll(async () => h.close());

const at = (iso: string) => h.clock.set(iso);
let seq = 0;
async function client(o: { regime?: 'atalany' | 'kata'; hipaMethod?: 'savos' | 'nincs'; lifecycle?: 'aktiv' | 'megszunt' } = {}) {
  seq++;
  const c = await newClient(h, `ev-ciklus-${seq}@demo.kezjegy.test`, { first: 'Éva', last: `Évesné${seq}`, active: true });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId, adoszam: '12345678-1-42', hqMunicipality: 'Ózd', createdAt: new Date('2026-01-01T00:00:00Z'), ...(o.lifecycle ? { lifecycle: o.lifecycle } : {}) }).where(eq(clients.id, c.clientId));
  const regime = o.regime ?? 'atalany';
  await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2026, costRatio: 45, regime, status: 'fofoglalkozasu', hipaMethod: o.hipaMethod ?? 'savos', hipaAccountNumber: '11784009-15400017-03540000', ...(regime === 'kata' ? { kataFrom: '2026-01-01', kataVariant: 'regi' as const, kataFofoglalkozasu: true } : {}) });
  await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: 2027, costRatio: 50, regime: 'atalany', status: 'fofoglalkozasu', hipaMethod: o.hipaMethod ?? 'savos' });
  return c;
}
/** Q1–Q4 approved and paid (szja 30 000, TB 60 000, szocho 40 000 each); Q1–Q3 verified, Q4 only marked. */
async function quarters(clientId: string) {
  await ensurePeriods(h.deps.db, clientId, 2026, 'savos', 'fofoglalkozasu');
  const ps = (await h.deps.db.select().from(taxPeriods).where(and(eq(taxPeriods.clientId, clientId), eq(taxPeriods.kind, 'negyedev')))).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
  for (const p of ps) {
    const verified = p.quarter !== 4;
    await h.deps.db.update(taxPeriods).set({ calcStatus: 'jovahagyva', paymentStatus: verified ? 'ellenorizve' : 'befizetve_jelezve' }).where(eq(taxPeriods.id, p.id));
    for (const [kind, amountHuf, acc] of [
      ['szja_eloleg', 30_000, '10032000-06056353'],
      ['tb_jarulek', 60_000, '10032000-06055802'],
      ['szocho', 40_000, '10032000-06055912'],
    ] as const)
      await h.deps.db.insert(taxPaymentItems).values({ taxPeriodId: p.id, kind, label: kind, amountHuf, dueDate: p.dueDate, accountName: 'NAV', accountNumber: acc, iban: 'HU00', reference: '12345678-1-42', markedPaidAt: new Date('2026-12-01T00:00:00Z'), markedPaidOn: '2026-12-01', verification: verified ? 'rendben' : null, verifiedAt: verified ? new Date() : null });
  }
  return ps;
}
async function annual(clientId: string, o: { status?: 'konyvelonel' | 'jovahagyasra_var' | 'kerdoiv'; regime?: 'atalany' | 'kata'; year?: number } = {}) {
  const [row] = await h.deps.db
    .insert(annualClosings)
    .values({ clientId, taxYear: o.year ?? 2026, regime: o.regime ?? 'atalany', status: o.status ?? 'konyvelonel', questionnaireDue: (o.regime ?? 'atalany') === 'kata' ? '2027-02-05' : '2027-03-15', submittedAt: new Date('2027-02-01T00:00:00Z') })
    .returning();
  return row!;
}
const notesOf = (userId: string) => h.deps.db.select().from(notifications).where(eq(notifications.userId, userId));
const periodsOf = (clientId: string) => h.deps.db.select().from(taxPeriods).where(eq(taxPeriods.clientId, clientId));
const itemsOf = (periodId: string) => h.deps.db.select().from(taxPaymentItems).where(eq(taxPaymentItems.taxPeriodId, periodId));
function form(fields: Record<string, string>, files: Record<string, boolean> = {}): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const k of Object.keys(files)) f.append(k, new Blob([pdfBytes()], { type: 'application/pdf' }), `${k}.pdf`);
  return f;
}
async function draft(clientId: string, aid: string) {
  return h.json('POST', `/acc/clients/${clientId}/annual/${aid}/draft`, { token: bence.token, form: form({}, { file: true }) });
}
const amountsOk = { szjaHuf: 150_000, advancesHuf: 120_000, revenueHuf: 6_000_000, incomeHuf: 3_300_000, taxFreeHuf: 1_936_800, taxableHuf: 1_000_000, overrideReason: 'a NAV-tervezet szerint', letterText: 'Szia, itt a bevallásod.', matchesDraft: true };

describe('átalány: amounts → approval (hash covers the numbers) → filed (iktatószám) → difference → kész', () => {
  it('the whole way, with the e-mails of the important steps', async () => {
    const c = await client();
    await quarters(c.clientId);
    const a = await annual(c.clientId);
    // the panel view: the prefill (approved advances 120 000) and a warning (Q4 not verified)
    const v0 = await h.json('GET', `/acc/clients/${c.clientId}/annual?year=2026`, { token: bence.token });
    expect(v0.status).toBe(200);
    expect(v0.body.prefill.advancesHuf).toBe(120_000);
    expect(v0.body.warnings.join(' ')).toContain('egyeztesd a folyószámlát');
    // the draft cannot go out without the amounts
    expect((await draft(c.clientId, a.id)).status).toBe(409);
    // A is required; a changed prefilled number needs a reason
    expect((await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { matchesDraft: true } })).status).toBe(400);
    const noReason = await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { ...amountsOk, overrideReason: null } });
    expect(noReason.status).toBe(400);
    expect(JSON.stringify(noReason.body)).toContain('miért tér el');
    const s1 = await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { ...amountsOk, matchesDraft: false } });
    expect(s1.status).toBe(200);
    expect(s1.body.amounts.diffHuf).toBe(30_000);
    expect((await draft(c.clientId, a.id)).status).toBe(409); // "egyeznek" not ticked
    await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: amountsOk });
    const d = await draft(c.clientId, a.id);
    expect(d.status).toBe(200);
    expect(d.body.status).toBe('jovahagyasra_var');
    // the client sees the summary: income, szja, the advances by quarter, the result with the NAV szja account
    const cv = await h.json('GET', '/client/annual?year=2026', { token: c.token });
    expect(cv.status).toBe(200);
    const sum = cv.body.summary;
    expect(sum.formLabel).toBe('Szja-bevallás 2026 (26SZJA)');
    expect(sum.result).toMatchObject({ kind: 'fizetendo', amountHuf: 30_000, title: 'Fizetendő: 30 000 Ft', sub: 'Utald el május 20-ig a NAV szja-számlájára.' });
    expect(sum.payment).toMatchObject({ accountNumber: '10032000-06056353', reference: '12345678-1-42', amountHuf: 30_000, dueDate: '2027-05-20' });
    expect(sum.advancesByQuarter.map((q: { state: string }) => q.state)).toEqual(['ellenorizve', 'ellenorizve', 'ellenorizve', 'jelolve']);
    expect(sum.income.find((l: { label: string }) => l.label.startsWith('Költséghányad'))).toMatchObject({ amountHuf: 2_700_000, sign: '−' });
    expect(sum.contributions.lines.map((l: { amountHuf: number }) => l.amountHuf)).toEqual([240_000, 160_000]);
    expect(sum.letter).toBe('Szia, itt a bevallásod.');
    expect(cv.body.approvalHash).toMatch(/^[0-9a-f]{64}$/);
    expect(cv.body.timeline.find((t: { key: string }) => t.key === 'jovahagyas')).toMatchObject({ status: 'most', dateLabel: 'május 10.' });
    expect(cv.body.timelineNext).toBe('Következő: május 10. – Eddig hagyd jóvá a tervezetet');
    const draftNote = (await notesOf(c.userId)).find((n) => n.kind === 'annual_status');
    expect(draftNote).toMatchObject({ wantEmail: true, link: '/eves-zaras/jovahagyas' });
    // the accountant changes a number → the old hash is refused, the client is told (once a day)
    const oldHash = cv.body.approvalHash;
    await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { ...amountsOk, szjaHuf: 160_000 } });
    await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { ...amountsOk, szjaHuf: 170_000 } });
    expect((await h.json('POST', `/client/annual/${a.id}/approve`, { token: c.token, body: { hash: oldHash } })).status).toBe(409);
    expect((await notesOf(c.userId)).filter((n) => n.kind === 'annual_status' && n.title === 'Változott a bevallásod tervezete')).toHaveLength(1);
    const cv2 = await h.json('GET', '/client/annual?year=2026', { token: c.token });
    expect(cv2.body.summary.result.amountHuf).toBe(50_000);
    const ap = await h.json('POST', `/client/annual/${a.id}/approve`, { token: c.token, body: { hash: cv2.body.approvalHash } });
    expect(ap.status).toBe(200);
    expect(ap.body.approval).toBeTruthy();
    expect((await notesOf(bence.userId)).some((n) => n.kind === 'tax_task' && n.title.includes('jóváhagyta az éves bevallást'))).toBe(true);
    // filing: date, iktatószám, the return and the receipt are required
    const noRef = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-04-20' }, { file: true, receipt: true }) });
    expect(noRef.status).toBe(400);
    const noReceipt = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'IKT-2027-0001' }, { file: true }) });
    expect(noReceipt.status).toBe(400);
    const f = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'IKT-2027-0001' }, { file: true, receipt: true }) });
    expect(f.status).toBe(200);
    expect(f.body.status).toBe('beadva');
    expect(f.body.settlement).toMatchObject({ diffHuf: 50_000, filedOn: '2027-04-20', filingRef: 'IKT-2027-0001' });
    const sp = (await periodsOf(c.clientId)).find((p) => p.kind === 'eves_szja')!;
    expect(sp).toMatchObject({ periodKey: '2026-SZJA', dueDate: '2027-05-20', calcStatus: 'jovahagyva', paymentStatus: 'fizetendo', filingRef: 'IKT-2027-0001' });
    expect((await itemsOf(sp.id))[0]).toMatchObject({ kind: 'szja_kulonbozet', amountHuf: 50_000, accountNumber: '10032000-06056353', adonem: '103', reference: '12345678-1-42' });
    const filedNote = (await notesOf(c.userId)).find((n) => n.kind === 'annual_status' && n.title.startsWith('Beadtuk a bevallásodat'))!;
    expect(filedNote.title).toBe('Beadtuk a bevallásodat: 50 000 Ft-ot kell befizetned');
    expect(filedNote.wantEmail).toBe(true);
    expect(String((filedNote.data as { emailBody?: string }).emailBody)).toContain('A bevallás és a NAV visszaigazolása a dossziédban van.');
    expect(filedNote.link).toBe(`/fizetes/${sp.id}`);
    // Határidők: the difference is its own row; the return row is done for the client
    const dl = await clientDeadlines(h.deps, h.deps.db, c.clientId, '2027-04-01', '2027-06-30');
    // javító kör 11-21: the client's row has the exact amount in its own column (never "kb."); the return row says "beadtuk"
    expect(dl.find((x) => x.id === `per:${sp.id}:befizetes`)).toMatchObject({ title: 'Szja-különbözet 2026', amountHuf: 50_000, estimate: false, link: `/fizetes/${sp.id}`, status: 'nyitott' });
    expect(dl.find((x) => x.id === 'ev:2026:szja')).toMatchObject({ status: 'kesz', title: 'Éves szja-bevallás 2026 (26SZJA) – beadtuk' });
    // the payment sheet works for the new kind; mark → verify → still 'beadva' (HIPA open) → HIPA not needed → kész
    const sheet = await h.json('GET', `/client/tax-periods/${sp.id}`, { token: c.token });
    expect(sheet.body).toMatchObject({ kind: 'eves_szja', sheetTitle: 'Szja-különbözet 2026', totalHuf: 50_000 });
    await h.json('POST', `/client/tax-periods/${sp.id}/mark-paid`, { token: c.token, body: { paidOn: '2027-04-20' } });
    const ver = await h.json('POST', `/acc/tax-periods/${sp.id}/verify-payment`, { token: bence.token, body: { items: [{ kind: 'szja_kulonbozet', verification: 'rendben' }] } });
    expect(ver.status).toBe(200);
    expect((await notesOf(c.userId)).some((n) => n.kind === 'tax_payment_verified' && n.body === 'Az szja-különbözet rendben megérkezett a NAV-hoz.')).toBe(true);
    let [row] = await h.deps.db.select().from(annualClosings).where(eq(annualClosings.id, a.id));
    expect(row!.status).toBe('beadva');
    await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/hipa`, { token: bence.token, body: { notNeeded: true } });
    [row] = await h.deps.db.select().from(annualClosings).where(eq(annualClosings.id, a.id));
    expect(row!.status).toBe('kesz');
    expect(row!.approvedSummary).toBeTruthy();
  });

  it('refund (Art. 64. § (1)): max(filed, 1 March) + 30 days; the client marks it; then kész', async () => {
    const c = await client({ hipaMethod: 'nincs' });
    await quarters(c.clientId);
    const a = await annual(c.clientId);
    await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { ...amountsOk, szjaHuf: 100_000 } });
    await draft(c.clientId, a.id);
    const cv = await h.json('GET', '/client/annual?year=2026', { token: c.token });
    expect(cv.body.summary.result).toMatchObject({ kind: 'visszajar', amountHuf: 20_000 });
    expect(cv.body.summary.result.sub).toContain('legkorábban 2027. március 1-jén');
    await h.json('POST', `/client/annual/${a.id}/approve`, { token: c.token, body: { hash: cv.body.approvalHash } });
    const f = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'IKT-2' }, { file: true, receipt: true }) });
    expect(f.body.settlement.refund).toMatchObject({ expectedBy: '2027-05-20', status: 'var', canMark: true, title: 'Visszajár: 20 000 Ft' });
    expect(f.body.settlement.refund.text).toBe('A NAV utalja vissza a bankszámládra. Ha május 20. után sem érkezett meg, írj nekünk.');
    expect((await periodsOf(c.clientId)).some((p) => p.kind === 'eves_szja')).toBe(false);
    // the accountant's task once the expected date passed
    at('2027-05-25T09:00:00Z');
    try {
      expect(await jobRefundWatch(h.deps)).toBeGreaterThanOrEqual(1);
      expect(await jobRefundWatch(h.deps)).toBe(0);
    } finally {
      at('2027-04-20T09:00:00Z');
    }
    const r = await h.json('POST', `/client/annual/${a.id}/refund-received`, { token: c.token, body: { receivedOn: '2027-04-20', amountHuf: 20_000 } });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('kesz');
    expect(r.body.settlement.refund.text).toBe('Megérkezett: 20 000 Ft (április 20.).');
    expect((await h.json('POST', `/client/annual/${a.id}/refund-received`, { token: c.token, body: { receivedOn: '2027-04-20' } })).status).toBe(409);
    expect((await notesOf(bence.userId)).some((n) => n.kind === 'tax_task' && n.title.includes('megérkezett a visszajáró adó'))).toBe(true);
  });

  it('without the app approval only with the recorded phone agreement; a filed date before the year end is refused', async () => {
    const c = await client({ hipaMethod: 'nincs' });
    const a = await annual(c.clientId);
    await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { szjaHuf: 0, advancesHuf: 0, matchesDraft: true, overrideReason: 'x' } });
    const r1 = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'IKT-3' }, { file: true, receipt: true }) });
    expect(r1.status).toBe(409);
    const r2 = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2026-12-20', filingRef: 'IKT-3', noApprovalNote: 'Telefonon 04-19-én megbeszéltük.' }, { file: true, receipt: true }) });
    expect(r2.status).toBe(400);
    const r3 = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-04-19', filingRef: 'IKT-3', noApprovalNote: 'Telefonon 04-19-én megbeszéltük.' }, { file: true, receipt: true }) });
    expect(r3.status).toBe(200);
    expect(r3.body.status).toBe('kesz'); // nothing to settle, no HIPA (H8)
  });

  it('the yearly HIPA: H − E > 0 → a payment on the municipality account; next year\'s advance base', async () => {
    const c = await client({ hipaMethod: 'nincs' });
    await h.deps.db.update(clientTaxProfiles).set({ hipaMethod: 'savos' }).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2026)));
    const a = await annual(c.clientId);
    const hp = await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/hipa`, { token: bence.token, body: { taxHuf: 50_000, advancesHuf: 30_000, returnNeeded: true } });
    expect(hp.status).toBe(200);
    expect(hp.body.hipa).toMatchObject({ taxHuf: 50_000, diffHuf: 20_000 });
    const f = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-hipa`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'HIPA-1' }) });
    expect(f.status).toBe(200);
    const p = (await periodsOf(c.clientId)).find((x) => x.kind === 'hipa_eves')!;
    expect(p).toMatchObject({ periodKey: '2026-HIPA-EVES', dueDate: '2027-05-31' });
    expect((await itemsOf(p.id))[0]).toMatchObject({ kind: 'hipa_kulonbozet', amountHuf: 20_000, accountNumber: '11784009-15400017-03540000', adonem: null });
    const [p27] = await h.deps.db.select().from(clientTaxProfiles).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2027)));
    expect(p27).toMatchObject({ hipaPriorYearHuf: 50_000, hipaPriorYearSource: 'eves_zaras' });
    expect((await notesOf(c.userId)).some((n) => n.title === 'Iparűzési adó: 20 000 Ft különbözetet kell befizetned')).toBe(true);
  });

  it('KATA: the különadó on the NAV KATA account (288), due 25 February', async () => {
    at('2027-02-20T09:00:00Z');
    try {
      const c = await client({ regime: 'kata', hipaMethod: 'nincs' });
      const a = await annual(c.clientId, { regime: 'kata' });
      const s = await h.json('PUT', `/acc/clients/${c.clientId}/annual/${a.id}/amounts`, { token: bence.token, body: { kataRevenueHuf: 20_000_000, kataLiableMonths: 12, kataLimitHuf: 18_000_000, kulonadoHuf: 800_000, overrideReason: 'a NAV szerint', matchesDraft: true } });
      expect(s.status).toBe(200);
      await draft(c.clientId, a.id);
      const cv = await h.json('GET', '/client/annual?year=2026', { token: c.token });
      expect(cv.body.summary.formLabel).toBe("Kata-nyilatkozat 2026 ('26KATA)");
      expect(cv.body.summary.result).toMatchObject({ kind: 'fizetendo', amountHuf: 800_000, title: 'Fizetendő különadó: 800 000 Ft', sub: 'Utald el február 25-ig a NAV kata-számlájára.' });
      expect(cv.body.summary.income.find((l: { label: string }) => l.label === 'Kereten felüli bevétel').amountHuf).toBe(2_000_000);
      await h.json('POST', `/client/annual/${a.id}/approve`, { token: c.token, body: { hash: cv.body.approvalHash } });
      const f = await h.json('POST', `/acc/clients/${c.clientId}/annual/${a.id}/filed-szja`, { token: bence.token, form: form({ filedOn: '2027-02-20', filingRef: 'KATA-1' }, { file: true, receipt: true }) });
      expect(f.status).toBe(200);
      const p = (await periodsOf(c.clientId)).find((x) => x.kind === 'kata_eves')!;
      expect(p).toMatchObject({ periodKey: '2026-KATA', dueDate: '2027-02-25' });
      expect((await itemsOf(p.id))[0]).toMatchObject({ kind: 'kata_kulonado', amountHuf: 800_000, accountNumber: '10032000-01076349', adonem: '288' });
    } finally {
      at('2027-04-20T09:00:00Z');
    }
  });

  it('approval reminders: 7 / 3 / 1 days before 10 May, push + e-mail, once each', async () => {
    const c = await client();
    const a = await annual(c.clientId, { status: 'jovahagyasra_var' });
    at('2027-05-03T07:00:00Z');
    try {
      await jobAnnualReminders(h.deps);
      await jobAnnualReminders(h.deps);
      const n = (await notesOf(c.userId)).filter((x) => x.kind === 'annual_due');
      expect(n).toHaveLength(1);
      expect(n[0]).toMatchObject({ title: 'Hagyd jóvá a bevallásodat május 10-ig', wantEmail: true, link: '/eves-zaras/jovahagyas' });
      void a;
    } finally {
      at('2027-04-20T09:00:00Z');
    }
  });
});

describe('önellenőrzés (tax_corrections)', () => {
  it('only a filed return; ≤ 1000 Ft refused; pótlék suggestion approved by the accountant; client approval; filed → 215 item', async () => {
    const c = await client();
    const ps = await quarters(c.clientId);
    const q3 = ps.find((p) => p.quarter === 3)!;
    const body = { form: '2658', subjectKey: '2026-Q3', originalPeriodId: q3.id, cause: 'kesoi_irat', reason: 'Későn érkezett egy számla, ezért javítjuk a III. negyedévet.', diffs: [{ adonem: '103', label: 'Szja', amountHuf: 100_000, originalDueDate: '2026-09-01' }], plannedFiledOn: '2027-03-20' };
    // not filed yet
    expect((await h.json('POST', `/acc/clients/${c.clientId}/corrections`, { token: bence.token, body })).status).toBe(409);
    await h.deps.db.update(taxPeriods).set({ filingStatus: 'beadva', filedOn: '2026-10-10', filingForm: '2658' }).where(eq(taxPeriods.id, q3.id));
    const small = await h.json('POST', `/acc/clients/${c.clientId}/corrections`, { token: bence.token, body: { ...body, diffs: [{ adonem: '103', label: 'Szja', amountHuf: 900, originalDueDate: '2026-10-12' }] } });
    expect(small.status).toBe(400);
    expect(JSON.stringify(small.body)).toContain('1 000 Ft fölötti különbözet');
    at('2027-03-20T09:00:00Z');
    try {
      const cr = await h.json('POST', `/acc/clients/${c.clientId}/corrections`, { token: bence.token, body });
      expect(cr.status).toBe(201);
      expect(cr.body).toMatchObject({ seq: 1, status: 'tervezet', formLabel: '2658', subjectLabel: '2026. III. negyedév' });
      expect(cr.body.potlek).toMatchObject({ suggestedHuf: 3_000, approvedAt: null });
      expect(cr.body.potlek.basis[0]).toBe('Szja: 100 000 Ft × 0,015%/nap × 200 nap = 3 000 Ft');
      expect(cr.body.potlek.rateNote).toContain('5,5%');
      expect(await computeFlags(h.deps, h.deps.db, c.clientId)).toContain('onellenorzes_nyitott');
      // the pótlék must be approved first; a different number needs a reason
      expect((await h.json('POST', `/acc/corrections/${cr.body.id}/send`, { token: bence.token })).status).toBe(409);
      expect((await h.json('POST', `/acc/corrections/${cr.body.id}/potlek`, { token: bence.token, body: { huf: 2_500 } })).status).toBe(400);
      const pa = await h.json('POST', `/acc/corrections/${cr.body.id}/potlek`, { token: bence.token, body: { huf: 3_000 } });
      expect(pa.body.potlek.approvedAt).toBeTruthy();
      const sent = await h.json('POST', `/acc/corrections/${cr.body.id}/send`, { token: bence.token });
      expect(sent.body.status).toBe('ugyfelre_var');
      const note = (await notesOf(c.userId)).find((n) => n.kind === 'correction_status')!;
      expect(note).toMatchObject({ title: 'Javítani kell egy beadott bevallásodat', wantEmail: true, link: `/onellenorzes/${cr.body.id}` });
      expect(note.body).toContain('járulékbevallás (2658), 2026. III. negyedév');
      // the client: what, why, the pótlék, the total; a wrong hash is refused
      const cv = await h.json('GET', `/client/corrections/${cr.body.id}`, { token: c.token });
      expect(cv.body).toMatchObject({ canApprove: true, potlekHuf: 3_000, totalHuf: 103_000, reason: body.reason });
      expect((await h.json('POST', `/client/corrections/${cr.body.id}/approve`, { token: c.token, body: { hash: '0'.repeat(64) } })).status).toBe(409);
      const ok = await h.json('POST', `/client/corrections/${cr.body.id}/approve`, { token: c.token, body: { hash: cv.body.approvalHash } });
      expect(ok.body.status).toBe('jovahagyva');
      // the annual screen lists the open önellenőrzés
      const filed = await h.json('POST', `/acc/corrections/${cr.body.id}/filed`, { token: bence.token, form: form({ filedOn: '2027-03-20', filingRef: 'ONELL-1' }, { file: true, receipt: true }) });
      expect(filed.status).toBe(200);
      expect(filed.body.status).toBe('beadva');
      const pp = (await periodsOf(c.clientId)).find((p) => p.kind === 'onellenorzes')!;
      expect(pp).toMatchObject({ dueDate: '2027-03-20', correctionId: cr.body.id });
      const its = await itemsOf(pp.id);
      expect(its.map((i) => [i.kind, i.amountHuf, i.accountNumber, i.adonem]).sort()).toEqual([
        ['onellenorzesi_potlek', 3_000, '10032000-01076301', '215'],
        ['szja_kulonbozet', 100_000, '10032000-06056353', '103'],
      ]);
      // the original period is untouched
      const [orig] = await h.deps.db.select().from(taxPeriods).where(eq(taxPeriods.id, q3.id));
      expect(orig).toMatchObject({ filingStatus: 'beadva', calcStatus: 'jovahagyva', paymentStatus: 'ellenorizve' });
      // verified → rendezve
      await h.json('POST', `/acc/tax-periods/${pp.id}/verify-payment`, { token: bence.token, body: { items: [{ kind: 'szja_kulonbozet', verification: 'rendben' }, { kind: 'onellenorzesi_potlek', verification: 'rendben' }] } });
      const [cr2] = await h.deps.db.select().from(taxCorrections).where(eq(taxCorrections.id, cr.body.id));
      expect(cr2!.status).toBe('rendezve');
      // a second correction of the same return: × 1,5
      const again = await h.json('POST', `/acc/clients/${c.clientId}/corrections`, { token: bence.token, body });
      expect(again.body).toMatchObject({ seq: 2, potlek: { suggestedHuf: 4_500 } });
      expect(again.body.warnings.join(' ')).toContain('másfélszeres');
    } finally {
      at('2027-04-20T09:00:00Z');
    }
  });

  it('Art. 211. § (3) a) → 0; the office pays → no pótlék item; the HIPA line has no pótlék and goes to the municipality', async () => {
    const c = await client();
    const a = await annual(c.clientId);
    await h.deps.db.update(annualClosings).set({ status: 'kesz', filedSzjaAt: new Date('2027-04-01T00:00:00Z'), filedHipaAt: new Date('2027-04-01T00:00:00Z') }).where(eq(annualClosings.id, a.id));
    const cert = await h.json('POST', `/acc/clients/${c.clientId}/corrections`, { token: bence.token, body: { form: 'SZJA', subjectKey: '2026', cause: 'egyeb', reason: 'A munkáltató hibás igazolása miatt.', certificateError: true, diffs: [{ adonem: '103', label: 'Szja', amountHuf: 50_000, originalDueDate: '2027-05-20' }] } });
    expect(cert.body.potlek.suggestedHuf).toBe(0);
    const hipa = await h.json('POST', `/acc/clients/${c.clientId}/corrections`, { token: bence.token, body: { form: 'HIPA', subjectKey: '2026', cause: 'egyeb', reason: 'A székhely-település adómértéke változott.', diffs: [{ adonem: 'HIPA', label: 'Iparűzési adó', amountHuf: 20_000, originalDueDate: '2026-09-01' }], needsClientApproval: false, noApprovalNote: 'Telefonon megbeszéltük 04-19-én.', potlekPayer: 'iroda' } });
    expect(hipa.status).toBe(201);
    expect(hipa.body.potlek.suggestedHuf).toBe(0);
    expect(hipa.body.warnings.join(' ')).toContain('az önkormányzaté');
    const sent = await h.json('POST', `/acc/corrections/${hipa.body.id}/send`, { token: bence.token });
    expect(sent.body.status).toBe('jovahagyva'); // the recorded phone agreement
    const f = await h.json('POST', `/acc/corrections/${hipa.body.id}/filed`, { token: bence.token, form: form({ filedOn: '2027-04-20', filingRef: 'H-1' }, { file: true, receipt: true }) });
    expect(f.status).toBe(200);
    const pp = (await periodsOf(c.clientId)).find((p) => p.kind === 'onellenorzes')!;
    const its = await itemsOf(pp.id);
    expect(its.map((i) => [i.kind, i.accountNumber])).toEqual([['hipa_kulonbozet', '11784009-15400017-03540000']]);
    // the csapat role and another accountant: 404
    const other = await staff(h, 'accountant', `masik.ev${seq}@demo.kezjegy.test`, { firstName: 'Anna' });
    expect((await h.json('GET', `/acc/corrections/${hipa.body.id}`, { token: other.token })).status).toBe(404);
    expect((await h.json('GET', `/acc/clients/${c.clientId}/corrections`, { token: other.token })).status).toBe(404);
  });
});

describe('NAV folyószámla', () => {
  it('never ticked by default; "rendben" only with the exact statement amount; 224/226; backlog flag; request; next check task', async () => {
    const c = await client();
    const ps = await quarters(c.clientId);
    const q4 = ps.find((p) => p.quarter === 4)!;
    const exp = await h.json('GET', `/acc/clients/${c.clientId}/reconciliations/expected?asOf=2027-04-20`, { token: bence.token });
    expect(exp.status).toBe(200);
    const open = exp.body.openItems as { itemId: string; periodId: string; amountHuf: number; adonem: string }[];
    expect(open.filter((i) => i.periodId === q4.id)).toHaveLength(3); // Q4 marked, not verified
    expect(exp.body.adonemek.map((x: { adonem: string }) => x.adonem)).toEqual(['103', '406', '258', '138', '215', '224', '226']);
    // all balances 0: nothing is ticked by itself
    const plain = await h.json('POST', `/acc/clients/${c.clientId}/reconciliations`, { token: bence.token, body: { asOf: '2027-04-20', status: 'rendben', balances: [{ adonem: '103', balanceHuf: 0 }, { adonem: '406', balanceHuf: 0 }] } });
    expect(plain.status).toBe(201);
    expect(plain.body.verifiedItems).toBe(0);
    expect((await h.deps.db.select().from(taxPaymentItems).where(eq(taxPaymentItems.taxPeriodId, q4.id))).every((i) => i.verification === null)).toBe(true);
    const szja = open.find((i) => i.periodId === q4.id && i.adonem === '103')!;
    const wrongAmt = await h.json('POST', `/acc/clients/${c.clientId}/reconciliations`, { token: bence.token, body: { asOf: '2027-04-20', status: 'rendben', balances: [{ adonem: '103', balanceHuf: 0 }], seen: [{ itemId: szja.itemId, paidOn: '2027-01-10', amountHuf: 29_000, verification: 'rendben' }] } });
    expect(wrongAmt.status).toBe(400);
    expect(JSON.stringify(wrongAmt.body)).toContain('eltérésként');
    const good = await h.json('POST', `/acc/clients/${c.clientId}/reconciliations`, {
      token: bence.token,
      body: {
        asOf: '2027-04-20',
        status: 'hatralek',
        balances: [{ adonem: '103', balanceHuf: 0 }, { adonem: '224', balanceHuf: 10_000 }, { adonem: '226', balanceHuf: 5_000 }],
        seen: [{ itemId: szja.itemId, paidOn: '2027-01-10', amountHuf: 30_000, verification: 'rendben' }],
        followUp: 'befizetes_kerve',
        notifyClient: { message: 'A folyószámládon 15 000 Ft bírság áll. Utald el, kérlek.', dueOn: '2027-05-05' },
        nextCheckOn: '2027-05-10',
      },
    });
    expect(good.status).toBe(201);
    expect(good.body).toMatchObject({ verifiedItems: 1, totalDebtHuf: 15_000, status: 'hatralek' });
    expect(good.body.balances.find((b: { adonem: string }) => b.adonem === '224').label).toBe('Bírság');
    const [it] = await h.deps.db.select().from(taxPaymentItems).where(eq(taxPaymentItems.id, szja.itemId));
    expect(it).toMatchObject({ verification: 'rendben', reconciliationId: good.body.id });
    expect(await computeFlags(h.deps, h.deps.db, c.clientId)).toContain('folyoszamla_elteres');
    expect((await notesOf(c.userId)).some((n) => n.kind === 'request_new')).toBe(true);
    const acc = await clientDeadlines(h.deps, h.deps.db, c.clientId, '2027-04-01', '2027-06-30', { perspective: 'accountant' });
    expect(acc.find((d) => d.id === `fsz:${c.clientId}`)).toMatchObject({ dueDate: '2027-05-10' });
    const res = await h.json('POST', `/acc/reconciliations/${good.body.id}/resolve`, { token: bence.token, body: { note: 'befizette' } });
    expect(res.body.resolvedAt).toBeTruthy();
    expect(await computeFlags(h.deps, h.deps.db, c.clientId)).not.toContain('folyoszamla_elteres');
    at('2027-05-10T06:00:00Z');
    try {
      expect(await jobAccountChecks(h.deps)).toBeGreaterThanOrEqual(1);
      expect(await jobAccountChecks(h.deps)).toBe(0);
      expect((await notesOf(bence.userId)).some((n) => n.kind === 'tax_task' && n.title === `Folyószámla-egyeztetés: Évesné${seq} Éva`)).toBe(true);
    } finally {
      at('2027-04-20T09:00:00Z');
    }
    const list = await h.json('GET', `/acc/clients/${c.clientId}/reconciliations`, { token: bence.token });
    expect(list.body.items).toHaveLength(2);
    expect((await h.deps.db.select().from(accountReconciliations).where(eq(accountReconciliations.clientId, c.clientId))).length).toBe(2);
  });
});

describe('Éves áttekintő', () => {
  it('one row per client with "mi hiányzik"; filters; the admin sees everybody', async () => {
    const r = await h.json('GET', '/acc/overview/year?year=2026', { token: bence.token });
    expect(r.status).toBe(200);
    expect(r.body.rows.length).toBeGreaterThan(3);
    const row = r.body.rows.find((x: { missing: string[] }) => x.missing.includes('Nincs folyószámla-egyeztetés'));
    expect(row).toBeTruthy();
    expect(r.body.counts.mind).toBe(r.body.rows.length);
    const kata = await h.json('GET', '/acc/overview/year?year=2026&filter=kata', { token: bence.token });
    expect(kata.body.rows.every((x: { regime: string }) => x.regime === 'kata')).toBe(true);
    const ad = await h.json('GET', '/acc/overview/year?year=2026', { token: admin.token });
    expect(ad.body.rows.length).toBeGreaterThanOrEqual(r.body.rows.length);
    const other = await staff(h, 'accountant', 'harmadik.ev@demo.kezjegy.test', { firstName: 'Cili' });
    expect((await h.json('GET', '/acc/overview/year?year=2026', { token: other.token })).body.rows).toHaveLength(0);
  });
});

describe('the last year of a former client (switch lemondottEvesZaras, default off)', () => {
  it("'ki': nothing opens and the button refuses; 'kezi': the accountant opens it and the client may answer; 'automatikus': opens on 5 January", async () => {
    const c = await client({ lifecycle: 'megszunt' });
    at('2027-01-05T09:00:00Z');
    try {
      await jobAnnualOpen(h.deps);
      expect((await h.deps.db.select().from(annualClosings).where(eq(annualClosings.clientId, c.clientId))).filter((a) => a.status !== 'nem_indult')).toHaveLength(0);
      const view = await h.json('GET', `/acc/clients/${c.clientId}/annual?year=2026`, { token: bence.token });
      expect(view.body.manualOpen).toMatchObject({ allowed: false });
      expect((await h.json('POST', `/acc/clients/${c.clientId}/annual/open`, { token: bence.token, body: { year: 2026 } })).status).toBe(409);
      await h.deps.db.insert(systemState).values({ key: EVES_KAPCSOLOK_KEY, value: { lemondottEvesZaras: 'kezi' } }).onConflictDoUpdate({ target: systemState.key, set: { value: { lemondottEvesZaras: 'kezi' } } });
      const o = await h.json('POST', `/acc/clients/${c.clientId}/annual/open`, { token: bence.token, body: { year: 2026 } });
      expect(o.status).toBe(200);
      expect(o.body.status).toBe('kerdoiv');
      const ans = await h.json('PUT', `/client/annual/${o.body.id}/answers`, { token: c.token, body: { answers: { missingDocuments: false } } });
      expect(ans.status).toBe(200);
      // other writes stay closed for a former client
      expect((await h.json('POST', '/client/messages', { token: c.token, body: { body: 'szia' } })).status).toBe(403);
      // 'automatikus'
      const c2 = await client({ lifecycle: 'megszunt' });
      await h.deps.db.update(systemState).set({ value: { lemondottEvesZaras: 'automatikus' } }).where(eq(systemState.key, EVES_KAPCSOLOK_KEY));
      await h.deps.db.delete(systemState).where(eq(systemState.key, 'job.annual_open'));
      await jobAnnualOpen(h.deps);
      const [a2] = await h.deps.db.select().from(annualClosings).where(eq(annualClosings.clientId, c2.clientId));
      expect(a2!.status).toBe('kerdoiv');
    } finally {
      await h.deps.db.delete(systemState).where(eq(systemState.key, EVES_KAPCSOLOK_KEY));
      at('2027-04-20T09:00:00Z');
    }
  });
});

describe('texts and code rules', () => {
  it('the new texts: no "a(z)", no "Bence", no time promise; the client wording says szja in lower case', () => {
    const keys = Object.keys(DEFAULT_TEXTS).filter((k) => k.startsWith('eves.ciklus.') || /^notif\.(annual_status|correction_status)\./.test(k) || /^notif\.tax_due_soon\.(eves|kata_kulonado|hipa_eves|onell)\./.test(k) || /^email\.(annual_status|correction_status)\./.test(k));
    expect(keys.length).toBeGreaterThan(80);
    for (const k of keys) {
      const t = DEFAULT_TEXTS[k]!;
      expect(t, k).not.toMatch(/a\(z\)/i);
      expect(t, k).not.toMatch(/\bBence\b/);
      for (const p of RESPONSE_TIME_FORBIDDEN_PATTERNS) expect(new RegExp(p, 'i').test(t), `${k}: ${t}`).toBe(false);
      expect(t, k).not.toMatch(/SZJA/);
    }
  });
  it('the new service files read tax_periods only through the visible filter', () => {
    const files = ['eves-ciklus.ts', 'onellenorzes.ts', 'folyoszamla.ts', 'ev-attekinto.ts', 'eves-zaras.ts'].map((f) => join(__dirname, '../src/services', f));
    const offenders: string[] = [];
    for (const f of files) {
      const raw = readFileSync(f, 'utf8');
      const src = raw.replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
      let i = src.indexOf('.from(taxPeriods)');
      while (i >= 0) {
        const stmt = src.slice(i, src.indexOf(';', i));
        const lineStart = raw.lastIndexOf('\n', i);
        const before = raw.slice(Math.max(0, raw.lastIndexOf('\n', lineStart - 1)), i);
        if (!(/periodVisible|hiddenAt/.test(stmt) || /visible-ok/.test(before))) offenders.push(`${f.split(/[\\/]/).pop()}: ${stmt.slice(0, 120)}`);
        i = src.indexOf('.from(taxPeriods)', i + 1);
      }
    }
    expect(offenders).toEqual([]);
    void readdirSync;
  });
});
