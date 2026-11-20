// SPEC §29.18 (B2): F1 certificates, F2 income statement, F3 closing, F4 calendar feed, F9 owner console.
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  assistRequests,
  auditLog,
  calendarFeeds,
  certificateRequests,
  clientTaxProfiles,
  clients,
  feeCharges,
  feeInvoices,
  feeSettings,
  notifications,
  payments,
  plans,
  requests,
  revenueItems,
  sessions,
  subscriptions,
  users,
} from '../src/db/schema.js';
import { base32Decode, base32Encode, totp } from '../src/lib/totp.js';
import { statementData } from '../src/services/kimutatas.js';
import { jobTerminationEffective } from '../src/services/konzol-muveletek.js';
import { anonymizeClient } from '../src/services/anonimizalas.js';
import { ICAL_LABELS } from '../src/_shared/k29f.js';
import { newClient, pdfBytes, PW, setup, staff, type Harness } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let mari: Awaited<ReturnType<typeof staff>>;
let csapat: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;
const SECRET = base32Encode(Buffer.from('12345678901234567890'));

async function aktiv(email: string, first = 'Kata', last = 'Szabó', o: { regime?: 'atalany' | 'kata'; acc?: string | null } = {}) {
  const c = await newClient(h, email, { active: true, first, last });
  await h.deps.db.update(clients).set({ accountantId: o.acc === undefined ? bence.accountantId : o.acc, addressZip: '1136', addressCity: 'Budapest', addressLine: 'Példa utca 1.', adoszam: '12345676-1-41' }).where(eq(clients.id, c.clientId));
  for (const y of [2025, 2026]) await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: y, costRatio: 45, regime: o.regime ?? 'atalany', status: 'fofoglalkozasu' }).onConflictDoNothing();
  return c;
}

/** admin's TOTP on + a fresh code for the step-up */
function kod(offsetSteps = 0): string {
  return totp(base32Decode(SECRET), h.clock.now().getTime() + offsetSteps * 30_000);
}

/** Access tokens live 10 minutes: after a clock jump the staff sign in again (the admin with his TOTP). */
async function relogin() {
  const login = async (email: string) => (await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'panel' } })).body;
  bence.token = (await login('bence.k29f@demo.kezjegy.test')).accessToken;
  mari.token = (await login('mari.k29f@demo.kezjegy.test')).accessToken;
  csapat.token = (await login('anna.k29f@demo.kezjegy.test')).accessToken;
  const a = await login('admin.k29f@demo.kezjegy.test');
  h.clock.advance(31_000);
  const t = await h.json('POST', '/auth/login/totp', { body: { mfaToken: a.mfaToken, code: kod() } });
  admin.token = t.body.accessToken;
}

beforeAll(async () => {
  h = await setup({ now: '2026-11-20T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.k29f@demo.kezjegy.test', { firstName: 'Bence' });
  mari = await staff(h, 'accountant', 'mari.k29f@demo.kezjegy.test', { firstName: 'Mari' });
  csapat = await staff(h, 'csapat', 'anna.k29f@demo.kezjegy.test', { firstName: 'Anna' });
  admin = await staff(h, 'admin', 'admin.k29f@demo.kezjegy.test');
  await h.deps.db.update(users).set({ totpSecretEnc: h.deps.data.enc(SECRET, 'users.totp_secret'), totpEnabledAt: h.clock.now() }).where(eq(users.id, admin.userId));
  // re-login so the session cache sees TOTP enabled
  h.deps.sessionCache.clear();
  await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
});
afterAll(async () => h.close());

// =====================================================================================================================
describe('F1 – Igazolást kérek', () => {
  it('form: the current year is refused with the text; required fields per type', async () => {
    const c = await aktiv('f1a@demo.kezjegy.test');
    const f = await h.json('GET', '/client/certificates/form', { token: c.token });
    expect(f.status).toBe(200);
    const cur = f.body.years.find((y: { year: number }) => y.year === 2026);
    expect(cur.ok).toBe(false);
    expect(cur.reason).toContain('Erre az évre még nincs bevallás');
    expect(f.body.years.find((y: { year: number }) => y.year === 2025).ok).toBe(true);
    const r1 = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'jovedelemigazolas', year: 2026, purposeKind: 'bank', userName: 'OTP Bank' } });
    expect(r1.status).toBe(400);
    expect(r1.body.error.fields.year).toContain('Erre az évre');
    const r2 = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'adoigazolas', purposeKind: 'bank' } });
    expect(r2.status).toBe(400);
    expect(Object.keys(r2.body.error.fields)).toEqual(expect.arrayContaining(['userName', 'extended']));
    const r3 = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'egyeb', purposeKind: 'mas' } });
    expect(Object.keys(r3.body.error.fields)).toEqual(expect.arrayContaining(['purposeText', 'otherText']));
  });

  it('timeline: beerkezett → navnal → kesz with the original PDF; the accountant is notified; other accountants get 404', async () => {
    const c = await aktiv('f1b@demo.kezjegy.test');
    const r = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'jovedelemigazolas', year: 2025, purposeKind: 'szechenyi', neededBy: '2026-11-24', paperCopy: true, paperTo: 'lakcim', englishRequested: true } });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('beerkezett');
    expect(r.body.userName).toBe('KAVOSZ Zrt.');
    expect(r.body.neededByWarn).toBe(true);
    expect(r.body.statusText).toContain('Bence hamarosan beadja');
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, bence.userId), eq(notifications.kind, 'certificate_requested' as never)));
    expect(n?.title).toContain('Szabó Kata');
    expect((await h.json('GET', `/acc/certificates/${r.body.id}`, { token: mari.token })).status).toBe(404);
    const q = await h.json('GET', '/acc/certificates', { token: bence.token });
    expect(q.body.items.map((x: { id: string }) => x.id)).toContain(r.body.id);
    const d = await h.json('GET', `/acc/certificates/${r.body.id}`, { token: bence.token });
    expect(d.body.delivery).toContain('postán');
    expect(d.body.englishRequested).toBe(true);
    const sub = await h.json('POST', `/acc/certificates/${r.body.id}/submitted`, { token: bence.token, body: { date: '2026-11-20', iktatoszam: 'IK-1' } });
    expect(sub.status).toBe(200);
    expect(sub.body.status).toBe('navnal');
    // overdue after 6 days at NAV (the filing day moved back a week)
    const { certificateEvents } = await import('../src/db/schema.js');
    await h.deps.db.update(certificateEvents).set({ at: new Date('2026-11-13T09:00:00Z') }).where(and(eq(certificateEvents.requestId, r.body.id), eq(certificateEvents.status, 'navnal')));
    expect((await h.json('GET', '/acc/certificates', { token: bence.token })).body.items.find((x: { id: string }) => x.id === r.body.id).overdue).toBe(true);
    // a JPEG is refused; the original PDF goes through the documents upload, then the result binds it
    const fd = new FormData();
    fd.append('category', 'igazolas');
    fd.append('dossierMonth', '2026-11');
    fd.append('file', new Blob([pdfBytes() as BlobPart], { type: 'application/pdf' }), 'igazolas.pdf');
    const up = await h.json('POST', `/acc/clients/${c.clientId}/documents`, { token: bence.token, form: fd });
    expect(up.status).toBe(201);
    const done = await h.json('POST', `/acc/certificates/${r.body.id}/result`, { token: bence.token, body: { documentId: up.body.id } });
    expect(done.status).toBe(200);
    expect(done.body.status).toBe('kesz');
    const v = await h.json('GET', `/client/certificates/${r.body.id}`, { token: c.token });
    expect(v.body.resultDocumentId).toBe(up.body.id);
    expect(v.body.timeline.map((t: { status: string }) => t.status).sort()).toEqual(['beerkezett', 'kesz', 'navnal']);
    const [kesz] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'certificate_status' as never), eq(notifications.title, 'Kész az igazolásod')));
    expect(kesz?.wantEmail).toBe(true);
    // the old /client/requests list still shows it (mirrored request status)
    const [rq] = await h.deps.db.select().from(requests).where(eq(requests.id, r.body.id));
    expect(rq!.status).toBe('teljesitve');
  });

  it('fee > 0 → dijra_var until paid; cancel withdraws the open fee; reject needs a reason', async () => {
    await h.deps.db.insert(feeSettings).values({ kind: 'igazolas_ado' as never, amountHuf: 1_500, unit: 'alkalom', confirmedAt: h.clock.now() }).onConflictDoUpdate({ target: feeSettings.kind, set: { amountHuf: 1_500 } });
    const c = await aktiv('f1c@demo.kezjegy.test');
    const r = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'adoigazolas', purposeKind: 'palyazat', userName: 'MVM', extended: 'nem_tudom' } });
    expect(r.status).toBe(201);
    expect(r.body.status).toBe('dijra_var');
    expect(r.body.feeHuf).toBe(1_500);
    const [ch] = await h.deps.db.select().from(feeCharges).where(eq(feeCharges.id, r.body.feeChargeId));
    expect((ch!.purpose as { type: string }).type).toBe('igazolas');
    const cancel = await h.json('POST', `/client/certificates/${r.body.id}/cancel`, { token: c.token });
    expect(cancel.body.status).toBe('visszavonva');
    const [ch2] = await h.deps.db.select().from(feeCharges).where(eq(feeCharges.id, r.body.feeChargeId));
    expect(ch2!.status).toBe('visszavonva');
    await h.deps.db.update(feeSettings).set({ amountHuf: 0 }).where(eq(feeSettings.kind, 'igazolas_ado' as never));
    const r2 = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'koma', purposeKind: 'bank' } });
    expect((await h.json('POST', `/acc/certificates/${r2.body.id}/reject`, { token: bence.token, body: { reason: '' } })).status).toBe(400);
    const rej = await h.json('POST', `/acc/certificates/${r2.body.id}/reject`, { token: bence.token, body: { reason: 'Tartozás miatt nem nullás' } });
    expect(rej.body.status).toBe('elutasitva');
    expect((await h.json('GET', `/client/certificates/${r2.body.id}`, { token: c.token })).body.statusText).toBe('Nem adható ki: Tartozás miatt nem nullás');
  });

  it('KOMA may finish without a file; lock rule: requesting is locked, downloading stays open', async () => {
    const c = await aktiv('f1d@demo.kezjegy.test');
    const r = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'koma', purposeKind: 'bank' } });
    const k = await h.json('POST', `/acc/certificates/${r.body.id}/result`, { token: bence.token, body: { komaOutcome: 'felvetel_kerve', komaMonth: '2026-12' } });
    expect(k.status).toBe(200);
    expect((await h.json('GET', `/client/certificates/${r.body.id}`, { token: c.token })).body.statusText).toContain('2026. december 10-én kerülsz be');
    await h.deps.db.update(clients).set({ serviceLock: { reasons: ['havidij'], since: '2026-11-20', amountHuf: 19_999 } }).where(eq(clients.id, c.clientId));
    const locked = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'koma', purposeKind: 'bank' } });
    expect(locked.status).toBe(403);
    expect(locked.body.error.code).toBe('service_locked');
    expect((await h.json('GET', `/client/certificates/${r.body.id}`, { token: c.token })).status).toBe(200);
    await h.deps.db.update(clients).set({ serviceLock: null }).where(eq(clients.id, c.clientId));
    // before activation: locked_until_active
    const uj = await newClient(h, 'f1e@demo.kezjegy.test');
    expect((await h.json('POST', '/client/certificates', { token: uj.token, body: { type: 'koma', purposeKind: 'bank' } })).body.error.code).toBe('locked_until_active');
  });
});

// =====================================================================================================================
describe('F2 – Bevételi kimutatás', () => {
  async function bevetel(clientId: string, d: string, amount: number, o: { source?: 'nav_szamla' | 'kezi'; atalany?: boolean; est?: boolean } = {}) {
    await h.deps.db.insert(revenueItems).values({ clientId, source: o.source ?? 'kezi', receivedOn: d, receivedOnEstimated: o.est ?? false, deliveryDate: d, amountHuf: amount, description: 'x', countsForAtalany: o.atalany ?? true });
  }
  it('monthly totals = Σ revenue_items by received_on (átalány, KATA, a mixed year); stamp only with the same hash', async () => {
    const a = await aktiv('f2a@demo.kezjegy.test');
    await bevetel(a.clientId, '2026-01-15', 100_000, { source: 'nav_szamla' });
    await bevetel(a.clientId, '2026-01-20', 50_000);
    await bevetel(a.clientId, '2026-03-02', 30_000, { atalany: false }); // not átalány revenue
    await bevetel(a.clientId, '2026-03-31', 20_000, { source: 'nav_szamla', est: true });
    const d = await statementData(h.deps.db, a.clientId, '2026-01', '2026-03');
    expect(d.months.map((m) => m.revenueHuf)).toEqual([150_000, 0, 20_000]);
    expect(d.totalHuf).toBe(170_000);
    expect(d.months[2]!.estimated).toBe(true);
    const k = await aktiv('f2b@demo.kezjegy.test', 'Réka', 'Varga', { regime: 'kata' });
    await bevetel(k.clientId, '2026-02-10', 30_000, { atalany: false });
    expect((await statementData(h.deps.db, k.clientId, '2026-02', '2026-02')).totalHuf).toBe(30_000);
    expect((await statementData(h.deps.db, k.clientId, '2026-02', '2026-02')).regimeLines[0]).toContain('kata');
    const mix = await aktiv('f2c@demo.kezjegy.test', 'Péter', 'Németh');
    await h.deps.db.update(clientTaxProfiles).set({ regime: 'kata' }).where(and(eq(clientTaxProfiles.clientId, mix.clientId), eq(clientTaxProfiles.year, 2025)));
    await bevetel(mix.clientId, '2025-12-05', 10_000, { atalany: false });
    await bevetel(mix.clientId, '2026-01-05', 20_000);
    const md = await statementData(h.deps.db, mix.clientId, '2025-12', '2026-01');
    expect(md.totalHuf).toBe(30_000);
    expect(md.regimeLines).toHaveLength(2);
    // approval + stamp
    const meta = await h.json('GET', '/client/income-statement/meta?from=2026-01&to=2026-03', { token: a.token });
    expect(meta.body.approved).toBeNull();
    const rev = await h.json('POST', '/client/income-statement/review', { token: a.token, body: { from: '2026-01', to: '2026-03' } });
    expect(rev.body.reviewRequested).toBe(true);
    const ap = await h.json('POST', `/acc/clients/${a.clientId}/income-statement/approve`, { token: bence.token, body: { from: '2026-01', to: '2026-03', dataSha256: meta.body.dataSha256 } });
    expect(ap.status).toBe(200);
    expect(ap.body.approved.byName).toContain('Bence');
    const pdf = await h.req('GET', '/client/income-statement?from=2026-01&to=2026-03', { token: a.token });
    expect(pdf.status).toBe(200);
    expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe('%PDF-');
    // data change → no stamp
    await bevetel(a.clientId, '2026-02-01', 1_000);
    expect((await h.json('GET', '/client/income-statement/meta?from=2026-01&to=2026-03', { token: a.token })).body.approved).toBeNull();
    // stale hash → 409
    expect((await h.json('POST', `/acc/clients/${a.clientId}/income-statement/approve`, { token: bence.token, body: { from: '2026-01', to: '2026-03', dataSha256: meta.body.dataSha256 } })).status).toBe(409);
    // limits
    expect((await h.json('GET', '/client/income-statement/meta?from=2024-01&to=2026-03', { token: a.token })).status).toBe(400);
  });
});

// =====================================================================================================================
describe('F3 – Megszüntetés', () => {
  it('guide, prepaid assisted closing (7 999 Ft), follow-up → subscription ends at the period end', async () => {
    const c = await aktiv('f3a@demo.kezjegy.test', 'Zsófia', 'Halmi');
    const g = await h.json('GET', '/client/guides/valtozas_megszuntetes', { token: c.token });
    expect(g.status).toBe(200);
    expect(g.body.steps.map((s: { key: string }) => s.key)).toEqual(expect.arrayContaining(['elotte', 'megszuntetes_datum', 'utana', 'megorzes']));
    const hub = await h.json('GET', '/client/change-guides', { token: c.token });
    expect(hub.body.items.find((i: { kind: string }) => i.kind === 'valtozas_megszuntetes').title).toBe('A vállalkozás megszüntetése');
    const { setStep } = await import('../src/services/onboarding.js');
    await setStep(h.deps, h.deps.db, c.clientId, 'szerzodes', 'kesz');
    const bad = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'valtozas_megszuntetes', source: 'helyettunk_valtozas', change: { kind: 'valtozas_megszuntetes', closingOn: '2026-11-20', hadEmployees: false } } });
    expect(bad.status).toBe(400);
    const ok = await h.json('POST', '/client/assist', { token: c.token, body: { kind: 'valtozas_megszuntetes', source: 'helyettunk_valtozas', change: { kind: 'valtozas_megszuntetes', closingOn: '2026-12-31', hadEmployees: false } } });
    expect(ok.status).toBe(201);
    expect(ok.body.feeCharge.amountHuf).toBe(7_999);
    const [row] = await h.deps.db.select().from(assistRequests).where(eq(assistRequests.clientId, c.clientId));
    expect(row!.status).toBe('dijra_var');
    expect(row!.changeEffectiveOn).toBe('2026-12-31');
    // straight to change-done (the staff steps are tested in §28); then the follow-ups
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', currentPeriodStart: '2026-11-15', currentPeriodEnd: '2026-12-14', nextChargeAt: new Date('2026-12-15T08:00:00Z'), mode: 'demo', provider: 'demo' });
    await h.deps.db.update(assistRequests).set({ status: 'kesz' }).where(eq(assistRequests.id, row!.id));
    const fu = await h.json('PATCH', `/acc/assists/${row!.id}/followups`, { token: bence.token, body: { key: 'elofizetes_lezaras', done: true } });
    expect([200, 404]).toContain(fu.status);
    if (fu.status === 404) {
      const t2 = await h.json('PATCH', `/team/assists/${row!.id}/followups`, { token: admin.token, body: { key: 'elofizetes_lezaras', done: true } });
      expect(t2.status).toBe(200);
    }
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(sub!.cancelAtPeriodEnd).toBe(true);
    expect(sub!.status).toBe('active');
  });
});

// =====================================================================================================================
describe('F4 – naptár', () => {
  it('feed has no amount / name / adószám, rotate invalidates, revoked 404, UID stable', async () => {
    const c = await aktiv('f4a@demo.kezjegy.test', 'Dávid', 'Fendrik');
    const { ensurePeriods } = await import('../src/services/tax.js');
    await ensurePeriods(h.deps, h.deps.db, c.clientId, 2026).catch(() => undefined);
    await h.deps.db.insert(requests).values({ clientId: c.clientId, direction: 'konyvelotol', type: 'dokumentum', title: 'Fendrik Dávid: küldd el a szerződést (12 345 Ft)', status: 'nyitott', dueDate: '2026-12-05' });
    const on = await h.json('POST', '/client/calendar', { token: c.token });
    expect(on.body.enabled).toBe(true);
    expect(on.body.googleUrl).toContain('calendar.google.com');
    const token = /naptar\/([^.]+)\.ics/.exec(on.body.httpsUrl)![1]!;
    const f = await h.req('GET', `/naptar/${token}.ics`);
    expect(f.status).toBe(200);
    expect(f.headers.get('content-type')).toContain('text/calendar');
    const body = await f.text();
    expect(body).toContain('X-WR-CALNAME:');
    expect(body).not.toMatch(/Fendrik|Dávid|12345676|\d{1,3}[ .]\d{3} ?Ft|Bence/);
    const summaries = [...body.matchAll(/^SUMMARY:(.*)$/gm)].map((m) => m[1]!.replace(/\\,/g, ',').trim());
    expect(summaries.length).toBeGreaterThan(0);
    for (const s of summaries) expect(ICAL_LABELS as readonly string[]).toContain(s);
    const uid1 = [...body.matchAll(/^UID:(.*)$/gm)].map((m) => m[1]);
    const again = await (await h.req('GET', `/naptar/${token}.ics`)).text();
    expect([...again.matchAll(/^UID:(.*)$/gm)].map((m) => m[1])).toEqual(uid1);
    const etag = f.headers.get('etag')!;
    expect((await h.req('GET', `/naptar/${token}.ics`, { headers: { 'if-none-match': etag } })).status).toBe(304);
    const rot = await h.json('POST', '/client/calendar', { token: c.token });
    expect(rot.body.httpsUrl).not.toBe(on.body.httpsUrl);
    expect((await h.req('GET', `/naptar/${token}.ics`)).status).toBe(404);
    await h.json('DELETE', '/client/calendar', { token: c.token });
    const token2 = /naptar\/([^.]+)\.ics/.exec(rot.body.httpsUrl)![1]!;
    expect((await h.req('GET', `/naptar/${token2}.ics`)).status).toBe(404);
    expect((await h.req('GET', '/naptar/nincs-ilyen-token-ilyen-hosszu-xx.ics')).status).toBe(404);
    // the single-event file carries a label too
    const one = await h.req('GET', `/client/deadlines/${encodeURIComponent((await h.json('GET', '/client/deadlines', { token: c.token })).body.items[0].id)}/ics`, { token: c.token });
    expect(await one.text()).not.toMatch(/Fendrik|Ft/);
  });
});

// =====================================================================================================================
describe('F9 – tulaj-konzol', () => {
  const stepUp = async () => {
    h.clock.advance(31_000);
    const r = await h.json('POST', '/admin/console/step-up', { token: admin.token, body: { code: kod() } });
    expect(r.status).toBe(200);
  };

  it('non-admins get 404 on every console route; admin without TOTP 403; writes need a step-up', async () => {
    await relogin();
    const c = await aktiv('f9a@demo.kezjegy.test', 'Anna', 'Kerekes');
    for (const tok of [bence.token, csapat.token, c.token]) {
      expect((await h.json('GET', '/admin/console/overview', { token: tok })).status).toBe(404);
      expect((await h.json('POST', `/admin/console/clients/${c.clientId}/lock`, { token: tok, body: { mode: 'zarolva', reason: 'teszt ok' } })).status).toBe(404);
    }
    const admin2 = await staff(h, 'admin', 'admin2.k29f@demo.kezjegy.test');
    const no = await h.json('GET', '/admin/console/overview', { token: admin2.token });
    expect(no.status).toBe(403);
    expect(no.body.error.code).toBe('mfa_setup_required');
    const w = await h.json('POST', `/admin/console/clients/${c.clientId}/lock`, { token: admin.token, body: { mode: 'zarolva', reason: 'teszt ok' } });
    expect(w.status).toBe(403);
    expect(w.body.error.code).toBe('step_up_required');
    expect((await h.json('POST', '/admin/console/step-up', { token: admin.token, body: { code: '000000' } })).status).toBe(400);
    await stepUp();
    const noReason = await h.json('POST', `/admin/console/clients/${c.clientId}/lock`, { token: admin.token, body: { mode: 'zarolva', reason: 'x' } });
    expect(noReason.status).toBe(422);
    const ok = await h.json('POST', `/admin/console/clients/${c.clientId}/lock`, { token: admin.token, body: { mode: 'zarolva', reason: 'Visszaélés gyanúja' } });
    expect(ok.status).toBe(200);
    const [a] = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, c.clientId), eq(auditLog.action, 'admin.lock.zarolva')));
    expect((a!.details as { reason: string }).reason).toBe('Visszaélés gyanúja');
    expect((a!.details as { after: { mode: string } }).after.mode).toBe('zarolva');
    // the step-up expires after 10 minutes (a new sign-in of the same session family is a new session anyway)
    const { adminStepUps } = await import('../src/db/schema.js');
    await h.deps.db.update(adminStepUps).set({ verifiedAt: new Date(h.clock.now().getTime() - 11 * 60_000) });
    expect((await h.json('DELETE', `/admin/console/clients/${c.clientId}/lock`, { token: admin.token, body: { reason: 'Rendben van' } })).body.error.code).toBe('step_up_required');
  });

  it('profile edit: validators, masked before/after in the audit, NAV-field override needs the flag', async () => {
    const c = await aktiv('f9b@demo.kezjegy.test', 'Márk', 'Fodor');
    await relogin();
    await stepUp();
    const bad = await h.json('PATCH', `/admin/console/clients/${c.clientId}/profile`, { token: admin.token, body: { fields: { adoszam: '12345678-1-41' } } });
    expect(bad.status).toBe(400);
    const ok = await h.json('PATCH', `/admin/console/clients/${c.clientId}/profile`, { token: admin.token, body: { fields: { addressCity: 'Szeged', phone: '+36 30 123 4567' }, reason: 'Ügyfél kérte telefonon' } });
    expect(ok.status).toBe(200);
    const [a] = await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, c.clientId), eq(auditLog.action, 'admin.client.profile_changed')));
    const det = a!.details as { after: Record<string, string>; before: Record<string, string> };
    expect(det.after.addressCity).toBe('Szeged');
    expect(det.after.phone).toMatch(/^•••\d{3}$/);
    await h.deps.db.update(clients).set({ businessIdentity: { name: 'Fodor Márk e.v.', seat: null, alanyiMentes: 'igen', afaWarning: false, demo: true, savedAt: '2026-11-20' } }).where(eq(clients.id, c.clientId));
    const nav = await h.json('PATCH', `/admin/console/clients/${c.clientId}/profile`, { token: admin.token, body: { fields: { addressZip: '6720' } } });
    expect(nav.status).toBe(409);
    expect(nav.body.error.code).toBe('nav_override_needed');
    expect((await h.json('PATCH', `/admin/console/clients/${c.clientId}/profile`, { token: admin.token, body: { fields: { addressZip: '6720' }, confirmNavOverride: true, reason: 'ONYA-ban ellenőriztem' } })).status).toBe(200);
  });

  it('terminate: the 30-day rule of azonnali_dij, rendes = 30 days, effective job; reactivate', async () => {
    const c = await aktiv('f9c@demo.kezjegy.test', 'Ödön', 'Teszt');
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', currentPeriodStart: '2026-11-10', currentPeriodEnd: '2026-12-09', nextChargeAt: new Date('2026-12-10T08:00:00Z'), mode: 'demo', provider: 'demo' });
    await relogin();
    await stepUp();
    const dij = await h.json('POST', `/admin/console/clients/${c.clientId}/terminate`, { token: admin.token, body: { kind: 'azonnali_dij', reason: 'Nem fizet régóta' } });
    expect(dij.status).toBe(409);
    expect(dij.body.error.message).toContain('30 napnál régebbi');
    const mas = await h.json('POST', `/admin/console/clients/${c.clientId}/terminate`, { token: admin.token, body: { kind: 'azonnali_mas', reason: 'Fenyegető levelek' } });
    expect(mas.status).toBe(400);
    const r = await h.json('POST', `/admin/console/clients/${c.clientId}/terminate`, { token: admin.token, body: { kind: 'rendes', reason: 'Üzleti döntés' } });
    expect(r.status).toBe(200);
    expect(r.body.effectiveOn).toBe('2026-12-20');
    expect(r.body.documentId).toBeTruthy();
    const [sub] = await h.deps.db.select().from(subscriptions).where(eq(subscriptions.clientId, c.clientId));
    expect(sub!.cancelAtPeriodEnd).toBe(true);
    const [n] = await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, c.userId), eq(notifications.kind, 'contract_terminated' as never)));
    expect(n!.title).toBe('Felmondtuk a szerződésedet');
    expect(n!.wantEmail).toBe(true);
    expect((await h.json('POST', `/admin/console/clients/${c.clientId}/terminate`, { token: admin.token, body: { kind: 'rendes', reason: 'Üzleti döntés' } })).status).toBe(409);
    // effectiveOn reached (moved to today instead of moving the clock: tokens and TOTP steps stay valid)
    const [t0] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    await h.deps.db.update(clients).set({ terminated: { ...t0!.terminated!, effectiveOn: '2026-11-20' } }).where(eq(clients.id, c.clientId));
    expect(await jobTerminationEffective(h.deps)).toBeGreaterThanOrEqual(1);
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.lifecycle).toBe('megszunt');
    await stepUp();
    expect((await h.json('POST', `/admin/console/clients/${c.clientId}/reactivate`, { token: admin.token, body: { reason: 'Visszajött' } })).status).toBe(200);
    const [cl2] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl2!.lifecycle).toBe('bekotes_alatt');
    expect(cl2!.terminated).toBeNull();
  });

  it('anonymise: refuses while the subscription lives; keeps fee invoices, payments and the audit; never DELETEs', async () => {
    const c = await aktiv('f9d@demo.kezjegy.test', 'Gizi', 'Törlendő');
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', currentPeriodStart: '2026-11-01', currentPeriodEnd: '2026-11-30', mode: 'demo', provider: 'demo' });
    await h.deps.db.insert(feeInvoices).values({ clientId: c.clientId, provider: 'demo', number: 'DEMO-1', issuedOn: '2026-11-01', amountHuf: 19_999, status: 'kiallitva', demo: true });
    await h.deps.db.insert(payments).values({ clientId: c.clientId, kind: 'havi', provider: 'demo', mode: 'demo', amountHuf: 19_999, status: 'sikeres', initiated: 'utemezo', offSession: true, idempotencyKey: `t-${c.clientId}`, periodStart: '2026-11-01', periodEnd: '2026-11-30', succeededAt: new Date('2026-11-01T08:00:00Z') } as never);
    await relogin();
    await stepUp();
    const blocked = await h.json('POST', `/admin/console/clients/${c.clientId}/anonymize`, { token: admin.token, body: { reason: 'GDPR kérés', confirmName: 'Törlendő Gizi' } });
    expect(blocked.status).toBe(409);
    await h.deps.db.update(subscriptions).set({ status: 'canceled' }).where(eq(subscriptions.clientId, c.clientId));
    expect((await h.json('POST', `/admin/console/clients/${c.clientId}/anonymize`, { token: admin.token, body: { reason: 'GDPR kérés', confirmName: 'Rossz Név' } })).status).toBe(400);
    const spy = vi.spyOn(h.deps.db, 'delete');
    const ok = await h.json('POST', `/admin/console/clients/${c.clientId}/anonymize`, { token: admin.token, body: { reason: 'GDPR kérés', confirmName: 'Törlendő Gizi' } });
    expect(ok.status).toBe(200);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    const [cl] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    expect(cl!.lastName).toBe('Törölt');
    expect(cl!.anonymizedAt).not.toBeNull();
    const [u] = await h.deps.db.select().from(users).where(eq(users.id, c.userId));
    expect(u!.email).toMatch(/@deleted\.invalid$/);
    expect((await h.deps.db.select().from(feeInvoices).where(eq(feeInvoices.clientId, c.clientId))).length).toBe(1);
    expect((await h.deps.db.select().from(payments).where(eq(payments.clientId, c.clientId))).length).toBe(1);
    expect((await h.deps.db.select().from(sessions).where(eq(sessions.userId, c.userId))).every((s) => s.revokedAt)).toBe(true);
    expect((await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, c.clientId), eq(auditLog.action, 'admin.client.anonymized')))).length).toBe(1);
    await expect(anonymizeClient(h.deps, c.clientId, { by: admin.userId, reason: 'újra' })).rejects.toThrow();
  });

  it('overview numbers = direct counts; the client card, sections and the preview work', async () => {
    await relogin();
    const o = await h.json('GET', '/admin/console/overview', { token: admin.token });
    expect(o.status).toBe(200);
    const all = (await h.deps.db.select().from(clients)).filter((c) => !c.isTest);
    expect(o.body.clients.active).toBe(all.filter((c) => c.lifecycle === 'aktiv' && !c.anonymizedAt).length);
    expect(o.body.clients.onboarding).toBe(all.filter((c) => c.lifecycle === 'bekotes_alatt').length);
    const subs = await h.deps.db.select().from(subscriptions);
    expect(o.body.money.overdue.count).toBe(subs.filter((s) => s.status === 'past_due' || s.status === 'suspended').length);
    const ok = (await h.deps.db.select().from(payments)).filter((p) => p.status === 'sikeres' && p.succeededAt && p.succeededAt.toISOString().slice(0, 7) === '2026-11');
    expect(o.body.money.collectedPerMonth.find((m: { month: string }) => m.month === '2026-11').havidijHuf).toBe(ok.filter((p) => p.kind !== 'egyszeri').reduce((s, p) => s + p.amountHuf, 0));
    const list = await h.json('GET', '/admin/console/clients?q=Szab', { token: admin.token });
    expect(list.body.items.length).toBeGreaterThan(0);
    const id = list.body.items[0].id;
    const card = await h.json('GET', `/admin/console/clients/${id}`, { token: admin.token });
    expect(card.body.sections.length).toBe(15);
    for (const s of ['profil', 'fizetesek', 'igazolasok', 'naplo', 'belepesek']) expect((await h.json('GET', `/admin/console/clients/${id}/${s}`, { token: admin.token })).status).toBe(200);
    const pv = await h.json('GET', `/admin/console/clients/${id}/preview`, { token: admin.token });
    expect(pv.body.screens.map((s: { key: string }) => s.key)).toEqual(['fooldal', 'bekotes', 'elofizetes', 'dijak']);
    const rv = await h.json('GET', `/admin/console/clients/${id}/reveal?field=phone`, { token: admin.token });
    expect(rv.status).toBe(200);
    expect((await h.deps.db.select().from(auditLog).where(and(eq(auditLog.clientId, id), eq(auditLog.action, 'admin.client.field_revealed')))).length).toBe(1);
  });

  it('announcement: dry run counts, the send must echo it; price override; admin fee', async () => {
    await relogin();
    await stepUp();
    const dry = await h.json('POST', '/admin/console/announcements', { token: admin.token, body: { title: 'Ünnepi nyitva tartás', body: 'December 24–26. között 48 órán belül válaszolunk.', channels: { inApp: true, push: false, email: false }, filter: { lifecycle: ['aktiv'] } } });
    expect(dry.status).toBe(200);
    expect(dry.body.sent).toBe(false);
    const wrong = await h.json('POST', '/admin/console/announcements', { token: admin.token, body: { title: 'Ünnepi nyitva tartás', body: 'December 24–26. között 48 órán belül válaszolunk.', channels: { inApp: true, push: false, email: false }, filter: { lifecycle: ['aktiv'] }, expectedCount: dry.body.count + 1 } });
    expect(wrong.status).toBe(409);
    const sent = await h.json('POST', '/admin/console/announcements', { token: admin.token, body: { title: 'Ünnepi nyitva tartás', body: 'December 24–26. között 48 órán belül válaszolunk.', channels: { inApp: true, push: false, email: false }, filter: { lifecycle: ['aktiv'] }, expectedCount: dry.body.count } });
    expect(sent.body.sent).toBe(true);
    const c = await aktiv('f9e@demo.kezjegy.test', 'Péter', 'Ár');
    const rise = await h.json('POST', `/admin/console/clients/${c.clientId}/price`, { token: admin.token, body: { kind: 'egyedi_ar', amountHuf: 24_999, fromPeriod: '2026-12-01', reason: 'Nagy forgalom' } });
    expect(rise.status).toBe(400);
    const free = await h.json('POST', `/admin/console/clients/${c.clientId}/price`, { token: admin.token, body: { kind: 'ingyenes_honap', months: 1, fromPeriod: '2026-12-01', reason: 'Kárpótlás' } });
    expect(free.status).toBe(201);
    const { effectiveMonthlyAmount } = await import('../src/services/payments.js');
    expect((await effectiveMonthlyAmount(h.deps, h.deps.db, c.clientId, '2026-12-01')).amountHuf).toBe(0);
    const fee = await h.json('POST', `/admin/console/clients/${c.clientId}/fees`, { token: admin.token, body: { kind: 'eves_zaras', note: 'Tavalyi zárás', reason: 'Elmaradt díj' } });
    expect(fee.status).toBe(201);
    const [ch] = await h.deps.db.select().from(feeCharges).where(eq(feeCharges.id, fee.body.chargeId));
    expect((ch!.purpose as { type: string }).type).toBe('admin');
    const now = await h.json('POST', `/admin/console/clients/${c.clientId}/fees/${fee.body.chargeId}/charge-now`, { token: admin.token, body: { reason: 'Levonom most' } });
    expect(now.status).toBe(409);
  });
});

void certificateRequests;
void calendarFeeds;
