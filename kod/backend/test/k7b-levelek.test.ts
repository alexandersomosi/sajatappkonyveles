// k7b (tulaj 11-20, dizajn/email/LEVEL_LEFEDETTSEG.md 3. pont 1–13): the new e-mails – each goes out, never twice, and
// lands in the DEMO outbox; the 11-20 wording review (SZOVEG_JAVITAS_LEVELEK.md) and the two accountant bugs
// (KONYVELO_LEFEDETTSEG.md: the HIPA approval, the annual deadlines that never became "kész").
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  annualClosings,
  clientPriceOverrides,
  clients,
  clientTaxProfiles,
  contentTexts,
  demoOutbox,
  gdprExports,
  navCredentials,
  notificationPrefs,
  notifications,
  paymentMethods,
  plans,
  subscriptions,
  systemState,
  users,
} from '../src/db/schema.js';
import { base32Decode, base32Encode, totp } from '../src/lib/totp.js';
import { DEFAULT_TEXTS, fill } from '../src/content.js';
import { K7B_TEXTS } from '../src/content/k7b.js';
import { K7B_REGI } from '../src/content/k7b_regi.js';
import { dispatchPending, notify } from '../src/notify/notify.js';
import { jobTerminationEffective } from '../src/services/konzol-muveletek.js';
import { runBillingJob } from '../src/services/subscription.js';
import { executeDeletion, runGdprExports, buildExport } from '../src/services/gdpr.js';
import { navErrorPhrase, syncClient } from '../src/services/navsync.js';
import { clientDeadlines } from '../src/services/flags.js';
import { mitText } from '../src/services/zarolas.js';
import { runDataStepK7b, K7B_STEP_KEY } from '../src/services/datastep-k7b.js';
import { NavError } from '../src/nav/types.js';
import { huLongDate } from '../src/_shared/bekotes.js';
import { newClient, PW, setup, staff, type Harness, type Mail } from './helpers.js';

let h: Harness;
let bence: Awaited<ReturnType<typeof staff>>;
let admin: Awaited<ReturnType<typeof staff>>;
const SECRET = base32Encode(Buffer.from('k7b-levelek-titok-01'));
const kod = () => totp(base32Decode(SECRET), h.clock.now().getTime());

async function aktiv(email: string, first = 'Kata', last = 'Szabó') {
  const c = await newClient(h, email, { active: true, first, last });
  await h.deps.db.update(clients).set({ accountantId: bence.accountantId, addressZip: '1136', addressCity: 'Budapest', addressLine: 'Példa utca 1.', adoszam: '12345676-1-41' }).where(eq(clients.id, c.clientId));
  for (const y of [2026, 2027]) await h.deps.db.insert(clientTaxProfiles).values({ clientId: c.clientId, year: y, costRatio: 45, regime: 'atalany', status: 'fofoglalkozasu' }).onConflictDoNothing();
  return c;
}

/** The admin signs in again with the TOTP and opens a console step-up (access tokens live 10 minutes). */
async function konzol() {
  const a = (await h.json('POST', '/auth/login', { body: { email: 'admin.k7b@demo.kezjegy.test', password: PW, clientKind: 'panel' } })).body;
  h.clock.advance(31_000);
  admin.token = (await h.json('POST', '/auth/login/totp', { body: { mfaToken: a.mfaToken, code: kod() } })).body.accessToken;
  h.clock.advance(31_000);
  expect((await h.json('POST', '/admin/console/step-up', { token: admin.token, body: { code: kod() } })).status).toBe(200);
}

const mailsTo = (to: string, template?: string): Mail[] => h.mails.filter((m) => m.to === to && (!template || m.template === template));
const notifsOf = async (userId: string, kind: string) => (await h.deps.db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.kind, kind as never)))).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

beforeAll(async () => {
  h = await setup({ now: '2026-11-20T09:00:00Z' });
  bence = await staff(h, 'accountant', 'bence.k7b@demo.kezjegy.test', { firstName: 'Bence' });
  admin = await staff(h, 'admin', 'admin.k7b@demo.kezjegy.test');
  await h.deps.db.update(users).set({ totpSecretEnc: h.deps.data.enc(SECRET, 'users.totp_secret'), totpEnabledAt: h.clock.now() }).where(eq(users.id, admin.userId));
  h.deps.sessionCache.clear();
  await h.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
});
afterAll(async () => h.close());

// ---------------------------------------------------------------------------------------------------------------------
describe('1) + 6) felmondás: a levél a PDF-fel; a hatálybalépésről külön levél', () => {
  it('rendes: one e-mail WITH the PDF, the in-app row sends no second one; on effectiveOn the "Megszűnt" notice, once', async () => {
    const c = await aktiv('felmond.k7b@demo.kezjegy.test', 'Ödön', 'Teszt');
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', currentPeriodStart: '2026-11-10', currentPeriodEnd: '2026-12-09', nextChargeAt: new Date('2026-12-10T08:00:00Z'), mode: 'demo', provider: 'demo' });
    await konzol();
    const r = await h.json('POST', `/admin/console/clients/${c.clientId}/terminate`, { token: admin.token, body: { kind: 'rendes', reason: 'Üzleti döntés' } });
    expect(r.status).toBe(200);
    const letters = mailsTo('felmond.k7b@demo.kezjegy.test', 'contract_terminated');
    expect(letters).toHaveLength(1);
    const m = letters[0]! as Mail & { attachments?: { filename: string; contentType: string; content: Buffer }[] };
    expect(m.subject).toBe('Felmondtuk a szerződésedet');
    expect(m.text).toContain('Szia Ödön!');
    expect(m.text).toContain(`A szerződésed ${huLongDate(r.body.effectiveOn)} napjával megszűnik`);
    expect(m.text).toContain('A felmondó levelet csatoltuk');
    expect(m.text).not.toMatch(/\.-(ig|tól|n)\b/);
    expect(m.attachments?.[0]).toMatchObject({ filename: 'felmondas.pdf', contentType: 'application/pdf' });
    expect(m.attachments![0]!.content.subarray(0, 4).toString()).toBe('%PDF');
    // the Dosszié sentence once, never twice (the old content/k29f.ts:66 concatenation)
    expect(m.text.match(/Dossziéban/g)).toHaveLength(1);
    // the in-app row exists, but its e-mail is off – nothing more goes out for it
    const [n] = await notifsOf(c.userId, 'contract_terminated');
    expect(n!.wantEmail).toBe(false);
    expect(n!.body).toContain('napjával megszűnik');
    await dispatchPending(h.deps);
    expect(mailsTo('felmond.k7b@demo.kezjegy.test').filter((x) => x.template.startsWith('contract_terminated'))).toHaveLength(1);
    // effectiveOn reached → the notice, by e-mail too (contract_terminated is always on)
    const [t0] = await h.deps.db.select().from(clients).where(eq(clients.id, c.clientId));
    await h.deps.db.update(clients).set({ terminated: { ...t0!.terminated!, effectiveOn: '2026-11-20' } }).where(eq(clients.id, c.clientId));
    expect(await jobTerminationEffective(h.deps)).toBe(1);
    expect(await jobTerminationEffective(h.deps)).toBe(0);
    await dispatchPending(h.deps);
    await dispatchPending(h.deps);
    const eff = mailsTo('felmond.k7b@demo.kezjegy.test', 'contract_terminated_hatalyos');
    expect(eff).toHaveLength(1);
    expect(eff[0]!.subject).toBe('Megszűnt a szerződésed');
    expect(eff[0]!.text).toContain('A felmondás mai nappal hatályos');
    const rows = await notifsOf(c.userId, 'contract_terminated');
    expect(rows.map((x) => x.title)).toEqual(['Felmondtuk a szerződésedet', 'Megszűnt a szerződésed']);
    // the accountant's closing task (unchanged) – and no "megszűnt az előfizetés" notice next to the termination
    expect((await notifsOf(bence.userId, 'assist_task')).filter((x) => x.title === 'Felmondás: Teszt Ödön')).toHaveLength(1);
    expect((await notifsOf(c.userId, 'subscription_canceled')).filter((x) => x.title === 'Megszűnt az előfizetésed')).toHaveLength(0);
  });

  it('azonnali: its own subject line in the letter, and no separate "hatályba lépett" notice', async () => {
    const c = await aktiv('azonnal.k7b@demo.kezjegy.test', 'Elek', 'Teszt');
    await konzol();
    const r = await h.json('POST', `/admin/console/clients/${c.clientId}/terminate`, { token: admin.token, body: { kind: 'azonnali_mas', subReason: 'bantalmazo', reason: 'Fenyegető levelek' } });
    expect(r.status).toBe(200);
    const letters = mailsTo('azonnal.k7b@demo.kezjegy.test', 'contract_terminated');
    expect(letters).toHaveLength(1);
    expect(letters[0]!.text).toContain('A szerződésed ma megszűnt.');
    expect((letters[0] as unknown as { attachments?: unknown[] }).attachments).toHaveLength(1);
    expect((await notifsOf(c.userId, 'contract_terminated')).map((x) => x.title)).toEqual(['Felmondtuk a szerződésedet']);
    await dispatchPending(h.deps);
    expect(mailsTo('azonnal.k7b@demo.kezjegy.test', 'contract_terminated_hatalyos')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('2) új üzenet: e-mail alapból be, naponta legfeljebb egy', () => {
  it('the accountant writes twice → one e-mail ("Bence üzenetet küldött"); next day again one; a client who switched it off gets none', async () => {
    const c = await aktiv('uzenet.k7b@demo.kezjegy.test', 'Ubul', 'Teszt');
    const before = mailsTo('uzenet.k7b@demo.kezjegy.test').length;
    for (const body of ['Szia, megnéztem a számláidat.', 'Még egy dolog: a kivonat is kellene.']) expect((await h.json('POST', `/acc/clients/${c.clientId}/messages`, { token: bence.token, body: { body } })).status).toBe(201);
    const rows = await notifsOf(c.userId, 'message_new');
    expect(rows.map((x) => x.wantEmail)).toEqual([true, false]);
    expect((rows[1]!.data as { emailFolded?: boolean }).emailFolded).toBe(true);
    expect(rows.every((x) => x.wantPush)).toBe(true); // the push is not capped
    await dispatchPending(h.deps);
    const m = mailsTo('uzenet.k7b@demo.kezjegy.test').slice(before);
    expect(m.map((x) => x.template)).toEqual(['message_new']);
    expect(m[0]!.subject).toBe('Bence üzenetet küldött');
    expect(m[0]!.text).toContain('Az appban, az Üzenetek között olvashatod');
    expect(m[0]!.text).toContain('/uzenetek');
    // the next day (Budapest) one more
    h.clock.advance(24 * 3600_000);
    await notify(h.deps, h.deps.db, { userId: c.userId, kind: 'message_new', params: { firstName: 'Bence' }, link: '/uzenetek', emailKey: 'message_new' });
    await dispatchPending(h.deps);
    expect(mailsTo('uzenet.k7b@demo.kezjegy.test', 'message_new')).toHaveLength(2);
    // the support's message: its own subject; the same daily cap
    await notify(h.deps, h.deps.db, { userId: c.userId, kind: 'message_new', variant: 'csapat', params: { senderName: 'Anna · ügyfélszolgálat' }, link: '/uzenetek', emailKey: 'message_new_ugyfelszolgalat' });
    await dispatchPending(h.deps);
    expect(mailsTo('uzenet.k7b@demo.kezjegy.test', 'message_new_ugyfelszolgalat')).toHaveLength(0);
    h.clock.advance(-24 * 3600_000);
  });

  it('switched off by the client → no e-mail; saving the defaults stores no row (a later default reaches him)', async () => {
    const c = await newClient(h, 'kikapcs.k7b@demo.kezjegy.test');
    const me = await h.json('GET', '/me', { token: c.token });
    expect(me.body.notificationPrefs.find((p: { kind: string }) => p.kind === 'message_new')).toEqual({ kind: 'message_new', push: true, email: true });
    // an older app sends every switch on "Mentés": the untouched ones (= the defaults) leave no row behind
    expect((await h.json('PATCH', '/me', { token: c.token, body: { notificationPrefs: [{ kind: 'tax_approved', push: true, email: true }, { kind: 'message_new', push: true, email: false }] } })).status).toBe(200);
    const prefs = await h.deps.db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, c.userId));
    expect(prefs.map((p) => p.kind)).toEqual(['message_new']);
    await notify(h.deps, h.deps.db, { userId: c.userId, kind: 'message_new', params: { firstName: 'Bence' }, link: '/uzenetek', emailKey: 'message_new' });
    await dispatchPending(h.deps);
    expect(mailsTo('kikapcs.k7b@demo.kezjegy.test', 'message_new')).toHaveLength(0);
    // back to the default: the existing row is updated (never left behind)
    await h.json('PATCH', '/me', { token: c.token, body: { notificationPrefs: [{ kind: 'message_new', push: true, email: true }] } });
    const [p] = await h.deps.db.select().from(notificationPrefs).where(and(eq(notificationPrefs.userId, c.userId), eq(notificationPrefs.kind, 'message_new')));
    expect(p!.email).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('3) NAV-hiba: a könyvelő és az admin egyszer kap levelet', () => {
  it('working credentials break → one mail each; the same failure again → none; fixed and broken again → again', async () => {
    const c = await aktiv('nav.k7b@demo.kezjegy.test', 'Nándor', 'Teszt');
    await h.deps.db.insert(navCredentials).values({ clientId: c.clientId, taxNumber: '12345676', secretEnc: h.deps.navKey.encJson({ login: 'abcdefgh', password: 'x', signatureKey: '12345678' }, `nav_credentials:${c.clientId}`), loginHint: 'abc…', environment: 'demo', status: 'rendben' });
    const real = h.deps.navClient;
    h.deps.navClient = (() => ({
      // eslint-disable-next-line require-yield
      async *syncOutbound() {
        throw new NavError({ code: 'INVALID_SECURITY_USER' });
      },
    })) as never;
    try {
      const navMails = () => h.mails.filter((m) => m.template === 'nav_hiba');
      const n0 = navMails().length;
      expect((await syncClient(h.deps, c.clientId)).status).toBe('hiba');
      const first = navMails().slice(n0);
      expect(first.map((m) => m.to).sort()).toEqual(['admin.k7b@demo.kezjegy.test', 'bence.k7b@demo.kezjegy.test']);
      const toBence = first.find((m) => m.to === 'bence.k7b@demo.kezjegy.test')!;
      expect(toBence.subject).toBe('NAV-hiba: Teszt Nándor számlái nem jönnek');
      expect(toBence.text).toContain('Bekötés fülön');
      expect(toBence.text).not.toMatch(/\.\./);
      expect(first.find((m) => m.to === 'admin.k7b@demo.kezjegy.test')!.text).toContain('A könyvelőjének is szóltunk');
      const [cred] = await h.deps.db.select().from(navCredentials).where(eq(navCredentials.clientId, c.clientId));
      expect(cred!.status).toBe('hibas');
      // the same failure again (a manual retry, or a day later) → no new mail
      await syncClient(h.deps, c.clientId);
      expect(navMails().length).toBe(n0 + 2);
      // fixed (a good test sets 'rendben'), then broken again by the accountant's own "Lekérdezés most" → only the admin
      await h.deps.db.update(navCredentials).set({ status: 'rendben' }).where(eq(navCredentials.clientId, c.clientId));
      await syncClient(h.deps, c.clientId, { by: bence.userId });
      expect(navMails().slice(n0 + 2).map((m) => m.to)).toEqual(['admin.k7b@demo.kezjegy.test']);
    } finally {
      h.deps.navClient = real;
    }
    expect(navErrorPhrase('A technikai felhasználó neve vagy jelszava hibás.')).toBe('a technikai felhasználó neve vagy jelszava hibás');
    expect(navErrorPhrase('NAV oldali hiba.')).toBe('NAV oldali hiba');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('4) + 5) megszűnt az előfizetés: ügyfél-levél és könyvelői feladat', () => {
  it('the period end of a cancelled subscription → client e-mail + the accountant task e-mail, once', async () => {
    const h2 = await setup({ now: '2026-11-20T05:00:00Z' });
    try {
      const b2 = await staff(h2, 'accountant', 'bence2.k7b@demo.kezjegy.test', { firstName: 'Bence' });
      const c = await newClient(h2, 'lejar.k7b@demo.kezjegy.test', { active: true, first: 'Lili', last: 'Lejár' });
      await h2.deps.db.update(clients).set({ accountantId: b2.accountantId }).where(eq(clients.id, c.clientId));
      await h2.deps.db.insert(plans).values({ code: 'havi', name: 'Havi előfizetés', priceHuf: 19_999 }).onConflictDoNothing();
      await h2.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', cancelAtPeriodEnd: true, currentPeriodStart: '2026-10-20', currentPeriodEnd: '2026-11-20', mode: 'demo', provider: 'demo' });
      const out = await runBillingJob(h2.deps);
      expect(out.canceled).toBe(1);
      expect((await runBillingJob(h2.deps)).canceled).toBe(0);
      await dispatchPending(h2.deps);
      await dispatchPending(h2.deps);
      const toClient = h2.mails.filter((m) => m.to === 'lejar.k7b@demo.kezjegy.test' && m.template === 'subscription_ended');
      expect(toClient).toHaveLength(1);
      expect(toClient[0]!.subject).toBe('Megszűnt az előfizetésed');
      expect(toClient[0]!.text).toContain('2026. november 20. napjával megszűnt az Adózz-előfizetésed');
      const toAcc = h2.mails.filter((m) => m.to === 'bence2.k7b@demo.kezjegy.test' && m.template === 'subscription_ended_konyvelo');
      expect(toAcc).toHaveLength(1);
      expect(toAcc[0]!.subject).toBe('Megszűnt: Lejár Lili');
      expect(toAcc[0]!.text).toContain('Vond vissza a meghatalmazást a NAV-nál');
      expect(toAcc[0]!.text).toContain('tiltsd le a technikai felhasználót');
      const [task] = (await h2.deps.db.select().from(notifications).where(and(eq(notifications.userId, b2.userId), eq(notifications.kind, 'assist_task'))));
      expect(task!.link).toBe(`/ugyfelek/${c.clientId}`);
    } finally {
      await h2.close();
    }
  });

  it('the admin sets "megszűnt" → the same two notices (no card mail); setting it again sends nothing', async () => {
    const c = await aktiv('adminmegszunt.k7b@demo.kezjegy.test', 'Mihály', 'Megszűnt');
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', currentPeriodStart: '2026-11-01', currentPeriodEnd: '2026-12-01', mode: 'demo', provider: 'demo' });
    await h.deps.db.insert(paymentMethods).values({ clientId: c.clientId, provider: 'demo', mode: 'demo', brand: 'visa', last4: '4242', status: 'aktiv' });
    await konzol();
    expect((await h.json('PATCH', `/admin/clients/${c.clientId}`, { token: admin.token, body: { lifecycle: 'megszunt' } })).status).toBe(200);
    expect((await h.json('PATCH', `/admin/clients/${c.clientId}`, { token: admin.token, body: { lifecycle: 'megszunt' } })).status).toBe(200);
    await dispatchPending(h.deps);
    expect(mailsTo('adminmegszunt.k7b@demo.kezjegy.test', 'subscription_ended')).toHaveLength(1);
    expect(mailsTo('adminmegszunt.k7b@demo.kezjegy.test', 'card_deleted_by_admin')).toHaveLength(0);
    expect(h.mails.filter((m) => m.template === 'subscription_ended_konyvelo' && m.subject === 'Megszűnt: Megszűnt Mihály')).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('7) 8) 9) fióktörlés és adatmásolat', () => {
  it('7) cancelling the deletion by signing in → one mail; a later sign-in sends none', async () => {
    const c = await newClient(h, 'visszavon.k7b@demo.kezjegy.test');
    expect((await h.json('POST', '/me/delete', { token: c.token, body: { password: PW } })).status).toBe(202);
    const back = await h.json('POST', '/auth/login', { body: { email: 'visszavon.k7b@demo.kezjegy.test', password: PW, clientKind: 'native', cancelDeletion: true } });
    expect(back.status).toBe(200);
    expect((await h.json('POST', '/auth/login', { body: { email: 'visszavon.k7b@demo.kezjegy.test', password: PW, clientKind: 'native' } })).status).toBe(200);
    const m = mailsTo('visszavon.k7b@demo.kezjegy.test', 'account_deletion_cancelled');
    expect(m).toHaveLength(1);
    expect(m[0]!.subject).toBe('Visszavontad a fiókod törlését');
    expect(m[0]!.text).toContain('A fiókod megmarad');
    expect(m[0]!.text).not.toContain('előfizetésed'); // no paid period ran on for this one
  });

  it('8) the deletion after 30 days → the mail goes to the REAL address (read before the pseudonymisation), once', async () => {
    const c = await newClient(h, 'torol.k7b@demo.kezjegy.test');
    expect((await h.json('POST', '/me/delete', { token: c.token, body: { password: PW } })).status).toBe(202);
    await executeDeletion(h.deps, c.userId);
    await executeDeletion(h.deps, c.userId);
    const m = mailsTo('torol.k7b@demo.kezjegy.test', 'account_deleted');
    expect(m).toHaveLength(1);
    expect(m[0]!.subject).toBe('Töröltük az Adózz-fiókodat');
    const [u] = await h.deps.db.select().from(users).where(eq(users.id, c.userId));
    expect(u!.status).toBe('deleted');
    expect(u!.email).toMatch(/@deleted\.invalid$/);
    expect(h.mails.some((x) => x.to.endsWith('@deleted.invalid'))).toBe(false);
  });

  it('9) an export that gives up → the client and the admin are told once (both failure paths)', async () => {
    const c = await newClient(h, 'export.k7b@demo.kezjegy.test', { first: 'Ede', last: 'Export' });
    // (a) a build that died twice (worker killed) → 'hiba' by the sweep
    await h.deps.db.insert(gdprExports).values({ userId: c.userId, status: 'folyamatban', attempts: 2, startedAt: new Date(h.clock.now().getTime() - 3600_000) });
    await runGdprExports(h.deps);
    await runGdprExports(h.deps);
    expect(mailsTo('export.k7b@demo.kezjegy.test', 'export_failed')).toHaveLength(1);
    const adm = mailsTo('admin.k7b@demo.kezjegy.test', 'export_failed_admin');
    expect(adm).toHaveLength(1);
    expect(adm[0]!.subject).toBe('Adatmásolat hiba: Export Ede');
    expect(adm[0]!.text).toContain('egy hónapon belül');
    // (b) a build that throws → 'hiba' at once, the same two mails
    const [x] = await h.deps.db.insert(gdprExports).values({ userId: c.userId, status: 'keszul' }).returning();
    const tmp = h.deps.storage.tmpFile;
    h.deps.storage.tmpFile = async () => {
      throw new Error('lemez tele');
    };
    try {
      await buildExport(h.deps, x!.id);
    } finally {
      h.deps.storage.tmpFile = tmp;
    }
    const [row] = await h.deps.db.select().from(gdprExports).where(eq(gdprExports.id, x!.id));
    expect(row!.status).toBe('hiba');
    expect(mailsTo('export.k7b@demo.kezjegy.test', 'export_failed')).toHaveLength(2);
    expect(mailsTo('admin.k7b@demo.kezjegy.test', 'export_failed_admin')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('11) 12) 13) árkedvezmény, kártya, igazolás', () => {
  it('11) revoking a discount → "Változik a havidíjad" with the real date and amount; revoking a rise → nothing', async () => {
    const c = await aktiv('kedvezmeny.k7b@demo.kezjegy.test', 'Kornél', 'Teszt');
    await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', currentPeriodStart: '2026-11-15', currentPeriodEnd: '2026-12-15', mode: 'demo', provider: 'demo' });
    await konzol();
    const disc = await h.json('POST', `/admin/console/clients/${c.clientId}/price`, { token: admin.token, body: { kind: 'kedvezmeny_szazalek', percent: 50, fromPeriod: '2026-11-01', reason: 'Bevezető ár' } });
    expect(disc.status).toBe(201);
    const del = await h.json('DELETE', `/admin/console/clients/${c.clientId}/price/${disc.body.id}`, { token: admin.token, body: { reason: 'Lejárt az akció' } });
    expect(del.status).toBe(200);
    const [n] = (await notifsOf(c.userId, 'price_changed')).filter((x) => x.title === 'Változik a havidíjad');
    expect(n!.body).toMatch(/^2026\. december 15\. napjától a havidíjad 19.999 Ft, mert megszűnt a kedvezményed\. A részleteket a Fiók → Előfizetés alatt látod; ha kérdésed van, írj nekünk\.$/);
    expect(n!.wantPush).toBe(false);
    await dispatchPending(h.deps);
    const m = mailsTo('kedvezmeny.k7b@demo.kezjegy.test', 'price_discount_revoked');
    expect(m).toHaveLength(1);
    expect(m[0]!.subject).toBe('Változik a havidíjad');
    expect(m[0]!.text).toContain('2026. december 15. napjától');
    // a revoked RISE makes it cheaper: no "megszűnt a kedvezményed" mail
    const rise = await h.json('POST', `/admin/console/clients/${c.clientId}/price`, { token: admin.token, body: { kind: 'egyedi_ar', amountHuf: 24_999, fromPeriod: '2027-01-15', reason: 'Nagy forgalom' } });
    expect(rise.status).toBe(201);
    const [ov] = await h.deps.db.select().from(clientPriceOverrides).where(and(eq(clientPriceOverrides.clientId, c.clientId), eq(clientPriceOverrides.kind, 'egyedi_ar')));
    expect((await h.json('DELETE', `/admin/console/clients/${c.clientId}/price/${ov!.id}`, { token: admin.token, body: { reason: 'Mégsem' } })).status).toBe(200);
    expect((await notifsOf(c.userId, 'price_changed')).filter((x) => x.title === 'Változik a havidíjad')).toHaveLength(2); // the rise notice + the revoke notice, no third
  });

  it('12) the admin deletes the saved card → the client is told (once: a second delete finds no card)', async () => {
    const c = await aktiv('kartya.k7b@demo.kezjegy.test', 'Kálmán', 'Kártya');
    const [s] = await h.deps.db.insert(subscriptions).values({ clientId: c.clientId, planCode: 'havi', status: 'active', currentPeriodStart: '2026-11-01', currentPeriodEnd: '2026-12-01', mode: 'demo', provider: 'demo' }).returning();
    await h.deps.db.insert(paymentMethods).values({ clientId: c.clientId, provider: 'demo', mode: 'demo', brand: 'visa', last4: '4242', status: 'aktiv' });
    await konzol();
    expect((await h.json('POST', `/admin/subscriptions/${s!.id}/card/delete`, { token: admin.token })).status).toBe(200);
    expect((await h.json('POST', `/admin/subscriptions/${s!.id}/card/delete`, { token: admin.token })).status).toBe(200);
    const m = mailsTo('kartya.k7b@demo.kezjegy.test', 'card_deleted_by_admin');
    expect(m).toHaveLength(1);
    expect(m[0]!.subject).toBe('Töröltük a mentett kártyádat');
    expect(m[0]!.text).toContain('adj meg új kártyát a Fiók → Előfizetés alatt');
    expect(m[0]!.text).toContain('Ha nem tudsz róla, írj nekünk');
  });

  it('13) "Nem adható ki" → e-mail too (own text, no double full stop); "beadtuk a NAV-nak" stays without e-mail', async () => {
    const c = await aktiv('igazolas.k7b@demo.kezjegy.test', 'Ilona', 'Igaz');
    const r = await h.json('POST', '/client/certificates', { token: c.token, body: { type: 'koma', purposeKind: 'bank' } });
    expect(r.status).toBe(201);
    const rej = await h.json('POST', `/acc/certificates/${r.body.id}/reject`, { token: bence.token, body: { reason: 'Tartozás miatt nem nullás.' } });
    expect(rej.status).toBe(200);
    const [n] = (await notifsOf(c.userId, 'certificate_status')).filter((x) => x.title === 'Nem adható ki az igazolás');
    expect(n!.wantEmail).toBe(true);
    expect(n!.body).toContain('Tartozás miatt nem nullás. Ha kérdésed van, írj a könyvelődnek az Üzenetekben.');
    await dispatchPending(h.deps);
    const m = mailsTo('igazolas.k7b@demo.kezjegy.test', 'certificate_rejected');
    expect(m).toHaveLength(1);
    expect(m[0]!.subject).toBe('Nem tudjuk kiadni az igazolásodat');
    expect(m[0]!.text).toContain('Bence nem tudta kiadni ezt az igazolást:');
    expect(m[0]!.text).toContain('Az oka: Tartozás miatt nem nullás.');
    expect(m[0]!.text).not.toContain('..');
    expect(m[0]!.text).not.toContain('a(z)');
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('DEMO: az új levelek a demo-postafiókba kerülnek (semmi nem megy ki)', () => {
  it('a direct template mail and a notification mail both land in demo_outbox with their template key', async () => {
    const { createMailer } = await import('../src/notify/mailer.js');
    const c = await aktiv('demo.k7b@demo.kezjegy.test', 'Dénes', 'Demó');
    const stub = h.deps.mailer;
    h.deps.mailer = createMailer({ ...h.deps.cfg, mail: { ...h.deps.cfg.mail, mode: 'demo' } }, h.deps.db);
    try {
      // "Már van fiókod" (direct) – the sign-up with an existing address
      expect((await h.json('POST', '/auth/register', { body: { email: 'demo.k7b@demo.kezjegy.test', password: PW, firstName: 'D', lastName: 'D', platform: 'web' }, headers: { 'x-forwarded-for': '198.51.120.1' } })).status).toBe(202);
      // a notification e-mail with its own text (message_new)
      await notify(h.deps, h.deps.db, { userId: c.userId, kind: 'message_new', params: { firstName: 'Bence' }, link: '/uzenetek', emailKey: 'message_new' });
      await dispatchPending(h.deps);
      const rows = await h.deps.db.select().from(demoOutbox).where(sql`${demoOutbox.template} in ('account_exists', 'message_new')`);
      expect(rows.map((r) => r.template).sort()).toEqual(['account_exists', 'message_new']);
      const ex = rows.find((r) => r.template === 'account_exists')!;
      expect(ex.subject).toBe('Már van fiókod az Adózz-ban');
      expect(ex.toDisplay).not.toBe('demo.k7b@demo.kezjegy.test'); // masked
    } finally {
      h.deps.mailer = stub;
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('14) szövegek', () => {
  it('every new e-mail has a subject and a body; no "a(z)", no time promise but the allowed one, no suffix after a dot-date', async () => {
    const bases = new Set(Object.keys(K7B_TEXTS).filter((k) => k.startsWith('email.')).map((k) => k.replace(/\.(subject|body)$/, '').replace(/^(email\.[a-z_]+)\..*$/, '$1')));
    for (const b of bases) {
      expect(DEFAULT_TEXTS[`${b}.subject`], b).toBeTruthy();
      expect(DEFAULT_TEXTS[`${b}.body`], b).toBeTruthy();
    }
    for (const [k, v] of Object.entries(K7B_TEXTS)) {
      expect(v, k).not.toContain('a(z)');
      expect(v, k).not.toMatch(/\{datum\}-/);
      expect(DEFAULT_TEXTS[k], k).toBe(v);
    }
    // every changed default: no hyphenated suffix right after a date placeholder (SZOVEG_JAVITAS 4.1)
    for (const k of Object.keys(K7B_REGI)) expect(DEFAULT_TEXTS[k], k).not.toMatch(/\{(datum|dueDateText)\}-(ig|tól|től|n)\b/);
    expect(DEFAULT_TEXTS['notif.callback_received.body']).toContain('A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.');
    expect(DEFAULT_TEXTS['notif.price_changed.body']).toBe('{datum} napjától havi {osszeg} Ft. Ha nem szeretnéd, előtte lemondhatod: Fiók → Előfizetés.');
  });

  it('a jogi text that still equals the old default no longer hides the reworded default', () => {
    // kod/jogi/app_szovegek.json (LEGAL_DIR in the tests) still holds the old ONYA texts word for word
    expect(DEFAULT_TEXTS['notif.assist_mh_filed.body']).toContain('a NAV online felületén (ONYA)');
    expect(DEFAULT_TEXTS['notif.assist_mh_reminder.utolso_nap.title']).toBe('Ma hagyd jóvá a meghatalmazást');
    expect(DEFAULT_TEXTS['notif.assist_mh_expired.title']).toBe('Újra beküldjük a meghatalmazást');
    // a jogi text that differs from every default still wins (B4's own wording)
    expect(DEFAULT_TEXTS['notif.assist_ev_filed.title']).toBe('{firstName} beküldte a bejelentésedet!');
  });

  it('rendered: the long date before "napjával", the article before "éves zárás", the "Vevő:" prefix', async () => {
    expect(fill(DEFAULT_TEXTS['notif.contract_terminated.rendes.body']!, { datum: huLongDate('2026-12-31') })).toBe(
      'A szerződésed 2026. december 31. napjával megszűnik, addig minden a megszokott módon megy tovább. A felmondó levelet az appban, a Dossziéban találod.',
    );
    expect(fill(DEFAULT_TEXTS['notif.subscription_renewal_needed.nincs_kartya.body']!, { datum: 'november 25.' })).toBe('Lejár a kifizetett időszakod (november 25.). Adj meg kártyát, hogy minden menjen tovább: Fiók → Előfizetés.');
    // zarolas.ts:82 – "havidíj és a éves zárás díja" → "havidíj és az éves zárás díja"
    const mit = await mitText(h.deps, ['havidij', 'eves_zaras']);
    expect(mit).toBe('havidíj és az éves zárás díja');
    expect(fill(DEFAULT_TEXTS['zarolas.banner']!, { mit, osszeg: '34 998', firstName: 'Bence' })).toBe(
      'Szünetel a könyvelésed, mert nincs kifizetve a havidíj és az éves zárás díja (34 998 Ft). Amint rendezed, Bence folytatja a munkát.',
    );
    expect(fill(DEFAULT_TEXTS['email.invoice_new.body']!, { vevo: 'Magánszemély', felre: '12 000', appUrl: 'https://app.x' })).toBe(
      'Vevő: Magánszemély. Ebből tegyél félre kb. 12 000 Ft-ot adóra.\n\nAz összes számládat és a félreteendő összeget az alkalmazásban látod: https://app.x/felretesz',
    );
  });

  it('data.k7b: an unedited override of a changed text gets the new default, an edited one stays; message_new rows follow the new default', async () => {
    const h3 = await setup();
    try {
      const k = 'notif.onboarding_done.title';
      await h3.deps.db.insert(contentTexts).values({ key: k, body: K7B_REGI[k]! }).onConflictDoNothing();
      await h3.deps.db.insert(contentTexts).values({ key: 'notif.fee_invoice_issued.title', body: 'Saját admin-szöveg: {amount}' }).onConflictDoNothing();
      const a = await newClient(h3, 'pref1.k7b@demo.kezjegy.test');
      const b = await newClient(h3, 'pref2.k7b@demo.kezjegy.test');
      await h3.deps.db.insert(notificationPrefs).values([
        { userId: a.userId, kind: 'message_new', push: true, email: false },
        { userId: b.userId, kind: 'message_new', push: false, email: false },
      ]);
      const r = await runDataStepK7b(h3.deps);
      expect(r).toEqual({ content: 1, messagePrefs: 1 });
      expect(await runDataStepK7b(h3.deps)).toBe('already');
      const [t] = await h3.deps.db.select().from(contentTexts).where(eq(contentTexts.key, k));
      expect(t!.body).toBe('Minden kész, indul a könyvelésed');
      const [own] = await h3.deps.db.select().from(contentTexts).where(eq(contentTexts.key, 'notif.fee_invoice_issued.title'));
      expect(own!.body).toBe('Saját admin-szöveg: {amount}');
      const prefs = await h3.deps.db.select().from(notificationPrefs).where(eq(notificationPrefs.kind, 'message_new'));
      expect(prefs.find((p) => p.userId === a.userId)!.email).toBe(true);
      expect(prefs.find((p) => p.userId === b.userId)!.email).toBe(false);
      expect((await h3.deps.db.select().from(systemState).where(eq(systemState.key, K7B_STEP_KEY))).length).toBe(1);
    } finally {
      await h3.close();
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe('15) könyvelői hibák', () => {
  it('b) the annual SZJA / HIPA deadline is "kész" once the filing is recorded – never "lejárt" after that', async () => {
    const c = await aktiv('eves.k7b@demo.kezjegy.test', 'Éva', 'Éves');
    await h.deps.db.update(clientTaxProfiles).set({ hipaMethod: 'savos' }).where(and(eq(clientTaxProfiles.clientId, c.clientId), eq(clientTaxProfiles.year, 2026)));
    const nap = async () => (await clientDeadlines(h.deps, h.deps.db, c.clientId, '2027-05-01', '2027-06-30', { perspective: 'accountant' })).filter((d) => d.id.startsWith('ev:2026:'));
    h.clock.set('2027-06-15T09:00:00Z');
    try {
      expect((await nap()).map((d) => [d.id, d.status])).toEqual([
        ['ev:2026:szja', 'lejart'],
        ['ev:2026:hipa', 'lejart'],
      ]);
      await h.deps.db.insert(annualClosings).values({ clientId: c.clientId, taxYear: 2026, regime: 'atalany', status: 'beadva', questionnaireDue: '2027-03-15', filedSzjaAt: new Date('2027-05-10T10:00:00Z') });
      expect((await nap()).map((d) => [d.id, d.status])).toEqual([
        ['ev:2026:szja', 'kesz'],
        ['ev:2026:hipa', 'lejart'],
      ]);
      await h.deps.db.update(annualClosings).set({ status: 'kesz', filedHipaAt: new Date('2027-05-20T10:00:00Z') }).where(eq(annualClosings.clientId, c.clientId));
      expect((await nap()).every((d) => d.status === 'kesz')).toBe(true);
    } finally {
      h.clock.set('2026-11-20T09:00:00Z');
    }
  });
});
