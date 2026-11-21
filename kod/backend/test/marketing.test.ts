// SPEC §31 (marketing, 2026-11-20): the source of a sign-up (password, Google, Apple) and of a callback request, the owner's
// Marketing tab (funnel, money by channel, callbacks, campaigns, test clients left out, admin only), the statistics server
// (no made-up number when it is down; it never gets personal data), and the PREPARED-BUT-OFF ad measurement: switched off
// nothing is stored, queued or sent; switched on only with a granted consent, with the whitelisted payload only.
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { adConversionEvents, adSpend, callbackRequests, clients, marketingConsents, marketingTouches, payments, signupAttribution, subscriptions, users } from '../src/db/schema.js';
import { campaignLink, campaignSlug, channelOf, isPaidTouch, statisticsUrl } from '../src/_shared/marketing.js';
import { eraseSourceDetails, jobMarketingRetention } from '../src/services/marketing.js';
import { createDemoProvider } from '../src/payments/demo.js';
import { googleEmail, googlePhone, jobAdConversions, metaEmail, metaPhone, resetGoogleTokenCache, sha } from '../src/services/hirdetes.js';
import { createUmamiClient, UmamiUnavailable, type UmamiClient, type UmamiSummary } from '../src/services/umami.js';
import { FAKE_STRIPE_ENV, FakeStripe } from './fake-stripe.js';
import { lastCode, newClient, PW, setup, staff, type Harness } from './helpers.js';

const AD_HOSTS = /graph\.facebook\.com|googleapis\.com|google\.com|doubleclick|facebook\.net|googletagmanager/;

/** A fetch that records every call and answers the providers / Umami with canned answers. */
function spyFetch(answer?: (url: string, init?: RequestInit) => Response | undefined) {
  const calls: { url: string; body: string | null }[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : init?.body ? String(init.body) : null });
    const a = answer?.(url, init);
    if (a) return a;
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { f, calls };
}

let ipN = 0;
const ip = () => ({ 'x-forwarded-for': `10.77.${Math.floor(++ipN / 200)}.${ipN % 200}` });

/** Password sign-up through the API with a body extra (utm, forras, entry, hirdetes), then the code from the mail. */
async function signUp(h: Harness, email: string, extra: Record<string, unknown> = {}, platform = 'web') {
  const headers = ip();
  const r = await h.json('POST', '/auth/register', { body: { email, password: PW, firstName: 'Kata', lastName: 'Szabó', platform, ...extra }, headers });
  expect(r.status).toBe(202);
  const v = await h.json('POST', '/auth/register/verify', { body: { email, code: lastCode(h, email.toLowerCase()), platform }, headers: { ...headers, 'user-agent': 'Mozilla/5.0 (teszt bongeszo)' } });
  expect(v.status).toBe(201);
  const [cl] = await h.deps.db.select().from(clients).where(eq(clients.userId, v.body.user.id)).limit(1);
  return { token: v.body.accessToken as string, userId: v.body.user.id as string, clientId: cl!.id };
}

async function touchOf(h: Harness, userId: string, kind: 'regisztracio' | 'visszahivas' = 'regisztracio') {
  const rows = await h.deps.db.select().from(marketingTouches).where(and(eq(marketingTouches.userId, userId), eq(marketingTouches.kind, kind)));
  return rows;
}

describe('the channel rule (shared/src/marketing.ts)', () => {
  it('utm_source first, then the referring domain; none or our own site = közvetlen; anything else = egyéb', () => {
    expect(channelOf({ utmSource: 'YouTube' })).toBe('youtube');
    expect(channelOf({ utmSource: 'fb', referrerDomain: 'youtube.com' })).toBe('facebook');
    expect(channelOf({ utmSource: 'hirlevel' })).toBe('egyeb');
    expect(channelOf({ referrerDomain: 'm.youtube.com' })).toBe('youtube');
    expect(channelOf({ referrerDomain: 'youtu.be' })).toBe('youtube');
    expect(channelOf({ referrerDomain: 'https://www.google.hu/' })).toBe('google');
    expect(channelOf({ referrerDomain: 'google.co.uk' })).toBe('google');
    expect(channelOf({ referrerDomain: 'l.facebook.com' })).toBe('facebook');
    expect(channelOf({ referrerDomain: 'l.instagram.com' })).toBe('instagram');
    expect(channelOf({ referrerDomain: 'www.tiktok.com' })).toBe('tiktok');
    expect(channelOf({ referrerDomain: 'android-app://com.google.android.googlequicksearchbox/' })).toBe('google');
    // Android apps: the YouTube app is YouTube, Gmail is not Google, the Facebook / Instagram / TikTok apps are themselves
    expect(channelOf({ referrerDomain: 'android-app://com.google.android.youtube/' })).toBe('youtube');
    expect(channelOf({ referrerDomain: 'android-app://com.google.android.gm/' })).toBe('egyeb');
    expect(channelOf({ referrerDomain: 'android-app://com.facebook.katana/' })).toBe('facebook');
    expect(channelOf({ referrerDomain: 'android-app://com.instagram.android/' })).toBe('instagram');
    expect(channelOf({ referrerDomain: 'android-app://com.zhiliaoapp.musically/' })).toBe('tiktok');
    // paid = the paid mediums of the link builder or an ad click id
    expect(isPaidTouch({ utmMedium: 'cpc' })).toBe(true);
    expect(isPaidTouch({ utmMedium: 'paid_social' })).toBe(true);
    expect(isPaidTouch({ utmMedium: 'social' })).toBe(false);
    expect(isPaidTouch({ utmMedium: null, clickIds: { gclid: 'x' } })).toBe(true);
    expect(isPaidTouch({})).toBe(false);
    expect(channelOf({ referrerDomain: 'blog.example.com' })).toBe('egyeb');
    expect(channelOf({ referrerDomain: 'adozz.hu' })).toBe('kozvetlen');
    expect(channelOf({ referrerDomain: 'app.adozz.hu' })).toBe('kozvetlen');
    expect(channelOf({})).toBe('kozvetlen');
    // a look-alike is not Google
    expect(channelOf({ referrerDomain: 'notgoogle.com' })).toBe('egyeb');
  });
  it('campaign slug + link: lower case, no accents, the landing address from the config', () => {
    expect(campaignSlug('Hogyan adózik egy EV? (2. rész)')).toBe('hogyan-adozik-egy-ev-2-resz');
    expect(campaignLink({ base: 'https://adozz.hu', source: 'youtube', medium: 'video', campaign: 'Átalányadó 2027 – röviden' })).toBe('https://adozz.hu/?utm_source=youtube&utm_medium=video&utm_campaign=atalanyado-2027-roviden');
  });
  it('the statistics address keeps utm_* only (click ids and everything else go)', () => {
    expect(statisticsUrl('https://adozz.hu/?utm_source=youtube&gclid=abc&fbclid=x&ref=KATA1234&utm_campaign=v1#arak')).toBe('https://adozz.hu/?utm_source=youtube&utm_campaign=v1');
    expect(statisticsUrl('/?wbraid=1', 'https://adozz.hu/')).toBe('/');
  });
  it('hash normalisation per provider (Meta / Google)', () => {
    expect(metaEmail('  Kata.Szabo+x@GMail.com ')).toBe('kata.szabo+x@gmail.com');
    expect(googleEmail('  Kata.Szabo+x@GMail.com ')).toBe('kataszabo@gmail.com');
    expect(googleEmail('Kata.Szabo+x@freemail.hu')).toBe('kata.szabo+x@freemail.hu');
    expect(metaPhone('+36 30 123 4567')).toBe('36301234567');
    expect(metaPhone('06 30 123 4567')).toBe('36301234567');
    expect(googlePhone('06301234567')).toBe('+36301234567');
    expect(sha('a')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('ads OFF (default): sources stored, nothing for any ad partner', () => {
  let h: Harness;
  const spy = spyFetch();
  beforeAll(async () => {
    h = await setup({ now: '2026-11-20T09:00:00Z', env: { GOOGLE_CLIENT_IDS: 'web-test.apps.googleusercontent.com', APPLE_BUNDLE_ID: 'com.somosi.kezjegy' }, overrides: { fetch: spy.f, verifyIdToken: async (p, token) => ({ sub: `${p}-${token}`, email: `${token}@demo.kezjegy.test`, givenName: 'Gábor', familyName: 'Teszt' }) } });
  });
  afterAll(async () => h.close());

  it('config: ads off, no partner config, Umami not configured', () => {
    expect(h.deps.cfg.ads.enabled).toBe(false);
    expect(h.deps.cfg.ads.meta).toBeNull();
    expect(h.deps.cfg.ads.google).toBeNull();
    expect(h.deps.umami).toBeNull();
  });

  it('password sign-up: utm (incl. term), referring domain, landing path, entry; channel by the rule', async () => {
    const c = await signUp(h, 'utm1@demo.kezjegy.test', {
      utm: { source: 'youtube', medium: 'video', campaign: 'atalanyado-2027', content: 'leiras', term: 'ev' },
      forras: { hivatkozo: 'https://www.youtube.com/', erkezes: '/?utm_source=youtube' },
      entry: { forras: 'kalkulator', cel: 'visszahivas' },
    });
    const [t] = await touchOf(h, c.userId);
    expect(t).toMatchObject({ channel: 'youtube', utmSource: 'youtube', utmMedium: 'video', utmCampaign: 'atalanyado-2027', utmContent: 'leiras', utmTerm: 'ev', referrerDomain: 'youtube.com', landingPath: '/', platform: 'web', entrySource: 'kalkulator', entryGoal: 'visszahivas', clickIds: null, consentId: null });
    expect(t!.clientId).toBe(c.clientId);
  });

  it('referrer only → its platform; nothing → közvetlen; unknown source → egyéb; a bad landing path is dropped', async () => {
    const a = await signUp(h, 'ref1@demo.kezjegy.test', { forras: { hivatkozo: 'l.instagram.com' } });
    expect((await touchOf(h, a.userId))[0]!.channel).toBe('instagram');
    const b = await signUp(h, 'ref2@demo.kezjegy.test');
    expect((await touchOf(h, b.userId))[0]).toMatchObject({ channel: 'kozvetlen', referrerDomain: null, utmSource: null });
    const d = await signUp(h, 'ref3@demo.kezjegy.test', { utm: { source: 'partnerblog' }, forras: { erkezes: 'javascript:alert(1)' } });
    expect((await touchOf(h, d.userId))[0]).toMatchObject({ channel: 'egyeb', landingPath: null });
  });

  it('ads off: a consent id and click ids in the request are ignored (never stored), no outbox row, no call out', async () => {
    const c = await signUp(h, 'ads-off@demo.kezjegy.test', { utm: { source: 'facebook' }, hirdetes: { hid: '6a1f0d6e-2a7e-4a8e-9a39-6f3c1c8a1b11', fbclid: 'IwAR-abc', gclid: 'Cj0-xyz' } });
    const [t] = await touchOf(h, c.userId);
    expect(t).toMatchObject({ channel: 'facebook', clickIds: null, consentId: null });
    expect(await h.deps.db.select().from(adConversionEvents)).toHaveLength(0);
    expect(await h.deps.db.select().from(marketingConsents)).toHaveLength(0);
    expect(await jobAdConversions(h.deps)).toEqual({ sent: 0, failed: 0, dropped: 0 });
    expect(spy.calls.filter((x) => AD_HOSTS.test(x.url))).toEqual([]);
  });

  it('ads off: the public config says no, the consent endpoint does not exist, the job is not even registered', async () => {
    const cfg = await h.json('GET', '/public/marketing-config');
    expect(cfg.status).toBe(200);
    expect(cfg.body).toEqual({ ads: false });
    const post = await h.json('POST', '/public/hozzajarulas', { body: { meta: true, google: true } });
    expect(post.status).toBe(404);
    expect(await h.deps.db.select().from(marketingConsents)).toHaveLength(0);
    const { jobDefs } = await import('../src/jobs.js');
    expect(jobDefs(h.deps).map((j) => j.name)).not.toContain('ad_conversions');
    const me = await h.json('GET', '/me/hirdetesi-hozzajarulas', { token: (await newClient(h, 'me-ads@demo.kezjegy.test')).token });
    expect(me.body).toMatchObject({ enabled: false, given: false });
  });

  it('Google sign-up (new account) keeps utm + referrer; Apple accepts them too; the registration conversion stays off', async () => {
    const g = await h.json('POST', '/auth/google', { body: { idToken: 'gabor-google-1', clientKind: 'web', utm: { source: 'google', campaign: 'kereso' }, forras: { hivatkozo: 'www.google.hu' } }, headers: ip() });
    expect(g.status).toBe(201);
    expect((await touchOf(h, g.body.user.id))[0]).toMatchObject({ channel: 'google', utmCampaign: 'kereso', referrerDomain: 'google.hu', platform: 'web' });
    const a = await h.json('POST', '/auth/apple', { body: { identityToken: 'anna-apple-1', clientKind: 'native', utm: { source: 'tiktok' } }, headers: ip() });
    expect(a.status).toBe(201);
    expect((await touchOf(h, a.body.user.id))[0]).toMatchObject({ channel: 'tiktok', platform: 'ios' });
    expect(await h.deps.db.select().from(adConversionEvents)).toHaveLength(0);
  });

  it('an older app without the new fields still signs up (direct)', async () => {
    const c = await newClient(h, 'regi-app@demo.kezjegy.test');
    expect((await touchOf(h, c.userId))[0]).toMatchObject({ channel: 'kozvetlen', platform: 'android' });
  });

  it('callback request: its own source when it came with one, otherwise copied from the registration', async () => {
    const c = await signUp(h, 'cb1@demo.kezjegy.test', { utm: { source: 'instagram', campaign: 'reel-1' } });
    const r = await h.json('POST', '/client/callbacks', { token: c.token, body: { phone: '+36301234567', topic: 'egyeb', source: 'fiok' } });
    expect(r.status).toBe(201);
    const [t] = await touchOf(h, c.userId, 'visszahivas');
    expect(t).toMatchObject({ channel: 'instagram', utmCampaign: 'reel-1', inherited: true, callbackRequestId: r.body.id });
    const d = await signUp(h, 'cb2@demo.kezjegy.test');
    const r2 = await h.json('POST', '/client/callbacks', { token: d.token, body: { phone: '+36301234568', topic: 'egyeb', source: 'fiok', marketing: { utm: { source: 'youtube', campaign: 'video-3' } } } });
    expect(r2.status).toBe(201);
    expect((await touchOf(h, d.userId, 'visszahivas'))[0]).toMatchObject({ channel: 'youtube', utmCampaign: 'video-3', inherited: false });
  });

  it('the cookie notice is a legal document type; it is never something to accept', async () => {
    const r = await h.json('GET', '/legal/suti');
    expect(r.status).toBe(200);
    expect(r.body.docType).toBe('suti');
    const c = await newClient(h, 'suti@demo.kezjegy.test');
    const me = await h.json('GET', '/me', { token: c.token });
    expect(me.body.consentsNeeded).not.toContain('suti');
  });

  it('GDPR export lists the sources; erasure keeps only the channel', async () => {
    const c = await signUp(h, 'torol@demo.kezjegy.test', { utm: { source: 'youtube', campaign: 'v9' }, forras: { hivatkozo: 'youtube.com' } });
    const { touchesOfUser, anonymizeTouches } = await import('../src/services/marketing.js');
    expect((await touchesOfUser(h.deps.db, c.userId))[0]).toMatchObject({ csatorna: 'youtube', utmCampaign: 'v9', hivatkozo: 'youtube.com' });
    await anonymizeTouches(h.deps.db, c.userId);
    expect((await touchOf(h, c.userId))[0]).toMatchObject({ channel: 'youtube', utmSource: null, utmCampaign: null, referrerDomain: null });
  });
});

describe('the Marketing tab (GET /admin/marketing)', () => {
  let h: Harness;
  let fake: FakeStripe;
  let admin: { token: string };
  let umami: UmamiSummary | 'down' | null = null;
  const profile = {
    firstName: 'Kata',
    lastName: 'Szabó',
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
  const fakeUmami: UmamiClient = {
    async summary() {
      if (umami === 'down') throw new UmamiUnavailable('down');
      if (!umami) throw new UmamiUnavailable('none');
      return umami;
    },
  };
  beforeAll(async () => {
    fake = new FakeStripe();
    h = await setup({ now: '2026-11-20T09:00:00Z', env: FAKE_STRIPE_ENV, overrides: { umami: fakeUmami, payments: { stripe: fake, demo: createDemoProvider({ apiPublicUrl: 'https://api.test', now: () => new Date('2026-11-20T09:00:00Z') }) } } });
    admin = await staff(h, 'admin', 'admin-mkt@demo.kezjegy.test');
  });
  afterAll(async () => h.close());

  /** Signed up from a source, data + contract done, first month paid on the fake Stripe. */
  async function paying(email: string, extra: Record<string, unknown>) {
    const c = await signUp(h, email, extra);
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const { acceptContract } = await import('./helpers.js');
    await acceptContract(h, c.token);
    const cv = (await h.json('GET', '/client/subscription/consent?purpose=subscribe', { token: c.token })).body;
    const st = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    expect(st.status).toBe(200);
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, st.body.paymentId));
    fake.complete(p!.stripeCheckoutSessionId!, '4242');
    const res = await h.json('GET', `/client/payments/checkout/${p!.stripeCheckoutSessionId}`, { token: c.token });
    expect(res.body.status).toBe('sikeres');
    return c;
  }

  it('only the admin: a client, an accountant and a team member get no answer', async () => {
    const c = await newClient(h, 'nem-admin@demo.kezjegy.test');
    expect((await h.json('GET', '/admin/marketing', { token: c.token })).status).toBeGreaterThanOrEqual(403);
    const acc = await staff(h, 'accountant', 'konyv-mkt@demo.kezjegy.test');
    expect([403, 404]).toContain((await h.json('GET', '/admin/marketing', { token: acc.token })).status);
    const cs = await staff(h, 'csapat', 'csapat-mkt@demo.kezjegy.test');
    expect([403, 404]).toContain((await h.json('GET', '/admin/marketing', { token: cs.token })).status);
    expect([403, 404]).toContain((await h.json('POST', '/admin/marketing/koltes', { token: cs.token, body: { day: '2026-11-19', platform: 'meta', amountHuf: 1000 } })).status);
    expect((await h.json('GET', '/admin/marketing')).status).toBe(401);
  });

  it('funnel by channel, money by channel (= the per-subscription MRR), callbacks, campaigns; test clients left out', async () => {
    umami = null;
    await paying('fizeto-yt@demo.kezjegy.test', { utm: { source: 'youtube', medium: 'video', campaign: 'atalanyado-2027' } });
    await signUp(h, 'csak-reg-yt@demo.kezjegy.test', { utm: { source: 'youtube', medium: 'video', campaign: 'atalanyado-2027' } });
    const fb = await signUp(h, 'adatok-fb@demo.kezjegy.test', { utm: { source: 'facebook' } });
    expect((await h.json('PUT', '/client/profile', { token: fb.token, body: profile })).status).toBe(200);
    const cb = await h.json('POST', '/client/callbacks', { token: fb.token, body: { phone: '+36301234569', topic: 'egyeb', source: 'fiok' } });
    expect(cb.status).toBe(201);
    // our own QA script: utm_source qa_… on the DEMO server → is_test → left out everywhere
    await signUp(h, 'qa-proba@demo.kezjegy.test', { utm: { source: 'qa_proba' } });
    // an unconfirmed sign-up is not a registration yet
    expect((await h.json('POST', '/auth/register', { body: { email: 'felbe@demo.kezjegy.test', password: PW, firstName: 'F', lastName: 'B', platform: 'web', utm: { source: 'youtube' } }, headers: ip() })).status).toBe(202);

    const r = await h.json('GET', '/admin/marketing?nap=30', { token: admin.token });
    expect(r.status).toBe(200);
    const s = r.body;
    expect(s.demo).toBe(true);
    expect(s.stats).toMatchObject({ available: false, configured: true });
    expect(s.visitors).toBeNull();
    expect(s.channels).toBeNull();
    const yt = s.funnel.byChannel.find((x: { channel: string }) => x.channel === 'youtube');
    expect(yt).toMatchObject({ registered: 2, dataDone: 1, contractAccepted: 1, paying: 1, visitors: null });
    const fbRow = s.funnel.byChannel.find((x: { channel: string }) => x.channel === 'facebook');
    expect(fbRow).toMatchObject({ registered: 1, dataDone: 1, contractAccepted: 0, paying: 0 });
    expect(s.funnel.byChannel.find((x: { channel: string }) => x.channel === 'egyeb').registered).toBe(0);
    // + the direct client of the previous test (nem-admin@): the total is the sum of the channels
    expect(s.funnel.total).toMatchObject({ registered: 4, dataDone: 2, contractAccepted: 1, paying: 1 });
    expect(s.funnel.byChannel.reduce((a: number, x: { registered: number }) => a + x.registered, 0)).toBe(4);
    // money: the per-subscription amount, equal to the dashboard here (one plain subscription)
    const ytMoney = s.money.rows.find((x: { channel: string }) => x.channel === 'youtube');
    expect(ytMoney).toMatchObject({ payingNow: 1, everPaid: 1 });
    expect(ytMoney.mrrHuf).toBe(19_999);
    expect(s.money.mrrHuf).toBe(19_999);
    const dash = await h.json('GET', '/admin/dashboard', { token: admin.token });
    expect(s.money.dashboardMrrHuf).toBe(dash.body.mrrHuf);
    // callbacks by source
    expect(s.callbacks).toEqual({ total: 1, rows: [{ key: 'facebook', label: 'Facebook', n: 1 }] });
    // campaigns
    const camp = s.campaigns.find((x: { campaign: string }) => x.campaign === 'atalanyado-2027');
    expect(camp).toMatchObject({ source: 'youtube', medium: 'video', channel: 'youtube', registered: 2, paying: 1, mrrHuf: 19_999, visitors: null });
    expect(JSON.stringify(s)).not.toContain('qa_proba');
    // no personal data in the answer
    expect(JSON.stringify(s)).not.toMatch(/@demo\.kezjegy\.test|Szabó|\+3630/);
    expect(s.landingUrl).toBe(h.deps.cfg.landingPublicUrl);
  });

  it('own price: the tab shows the real monthly amount and explains the difference to the dashboard', async () => {
    const c = await paying('egyedi-ar@demo.kezjegy.test', { utm: { source: 'tiktok' } });
    const { clientPriceOverrides } = await import('../src/db/schema.js');
    await h.deps.db.insert(clientPriceOverrides).values({ clientId: c.clientId, kind: 'egyedi_ar', amountHuf: 9_999, fromPeriod: '2026-11-01', reason: 'teszt' });
    const s = (await h.json('GET', '/admin/marketing?nap=30', { token: admin.token })).body;
    expect(s.money.rows.find((x: { channel: string }) => x.channel === 'tiktok')).toMatchObject({ payingNow: 1, mrrHuf: 9_999 });
    expect(s.money.mrrHuf).toBe(19_999 + 9_999);
    expect(s.money.dashboardMrrHuf).toBe(2 * 19_999);
    expect(s.money.note).toContain('eltérhet');
  });

  it('Umami answers: visitors per channel (tag), devices, countries, cities, events, campaign visits', async () => {
    umami = {
      visitors: 120,
      visits: 150,
      pageviews: 210,
      tags: [{ x: 'youtube', y: 70 }, { x: 'google', y: 20 }, { x: 'kozvetlen', y: 25 }, { x: 'valami', y: 5 }],
      devices: [{ x: 'mobile', y: 80 }, { x: 'desktop', y: 25 }, { x: 'laptop', y: 10 }, { x: 'tablet', y: 5 }],
      countries: [{ x: 'HU', y: 110 }, { x: 'AT', y: 10 }],
      cities: [{ x: 'Budapest', y: 60 }, { x: 'Debrecen', y: 12 }],
      events: [{ x: 'regisztralok', y: 30 }, { x: 'arak-lathato', y: 55 }],
      campaigns: [{ x: 'atalanyado-2027', y: 64 }, { x: 'csak-latogatas', y: 3 }],
    };
    const s = (await h.json('GET', '/admin/marketing?nap=7', { token: admin.token })).body;
    expect(s.range.days).toBe(7);
    expect(s.stats.available).toBe(true);
    expect(s.visitors).toEqual({ visitors: 120, visits: 150, pageviews: 210 });
    expect(s.channels.find((x: { key: string }) => x.key === 'youtube').n).toBe(70);
    expect(s.channels.find((x: { key: string }) => x.key === 'egyeb').n).toBe(5);
    expect(s.devices).toEqual([{ key: 'Telefon', label: 'Telefon', n: 80 }, { key: 'Gép', label: 'Gép', n: 35 }, { key: 'Tablet', label: 'Tablet', n: 5 }]);
    expect(s.countries[0]).toEqual({ key: 'HU', label: 'Magyarország', n: 110 });
    expect(s.events.find((x: { key: string }) => x.key === 'arak-lathato').label).toBe('Görgetett az árakig');
    expect(s.funnel.total.visitors).toBe(120);
    expect(s.funnel.byChannel.find((x: { channel: string }) => x.channel === 'youtube').visitors).toBe(70);
    expect(s.campaigns.find((x: { campaign: string }) => x.campaign === 'atalanyado-2027').visitors).toBe(64);
    expect(s.campaigns.find((x: { campaign: string }) => x.campaign === 'csak-latogatas')).toMatchObject({ registered: 0, visitors: 3 });
  });

  it('Umami down: no visit number at all (never a guess), the database part still answers', async () => {
    umami = 'down';
    const s = (await h.json('GET', '/admin/marketing?nap=90', { token: admin.token })).body;
    expect(s.stats).toMatchObject({ available: false, configured: true });
    expect(s.stats.reason).toContain('nem érhető el');
    expect(s.visitors).toBeNull();
    for (const k of ['channels', 'devices', 'countries', 'cities', 'events']) expect(s[k]).toBeNull();
    expect(s.funnel.byChannel.every((x: { visitors: number | null }) => x.visitors === null)).toBe(true);
    expect(s.funnel.total.registered).toBeGreaterThan(0);
  });

  it('custom range and validation', async () => {
    expect((await h.json('GET', '/admin/marketing?tol=2026-11-01&ig=2026-11-20', { token: admin.token })).body.range).toMatchObject({ from: '2026-11-01', to: '2026-11-20', days: 20 });
    expect((await h.json('GET', '/admin/marketing?tol=2026-11-01', { token: admin.token })).status).toBe(400);
    expect((await h.json('GET', '/admin/marketing?nap=5', { token: admin.token })).status).toBe(400);
  });

  it('ad spend typed in by the owner: cost per registration / paying; a wrong row is revoked, not deleted', async () => {
    umami = null;
    const add = await h.json('POST', '/admin/marketing/koltes', { token: admin.token, body: { day: '2026-11-19', platform: 'meta', campaign: 'osz', amountHuf: 10_000 } });
    expect(add.status).toBe(201);
    expect((await h.json('POST', '/admin/marketing/koltes', { token: admin.token, body: { day: '2027-01-01', platform: 'meta', amountHuf: 10 } })).status).toBe(400);
    expect((await h.json('POST', '/admin/marketing/koltes', { token: admin.token, body: { day: '2026-11-19', platform: 'meta', amountHuf: 0 } })).status).toBe(400);
    let s = (await h.json('GET', '/admin/marketing?nap=30', { token: admin.token })).body;
    let meta = s.ads.rows.find((x: { platform: string }) => x.platform === 'meta');
    // the free Facebook post (utm_source=facebook, no paid medium) does not lower the cost of the ads
    expect(meta).toMatchObject({ spendHuf: 10_000, registered: 0, costPerRegistrationHuf: null, paying: 0, costPerPayingHuf: null });
    await signUp(h, 'hirdetesbol@demo.kezjegy.test', { utm: { source: 'meta', medium: 'paid_social', campaign: 'osz' } });
    s = (await h.json('GET', '/admin/marketing?nap=30', { token: admin.token })).body;
    meta = s.ads.rows.find((x: { platform: string }) => x.platform === 'meta');
    expect(meta).toMatchObject({ spendHuf: 10_000, registered: 1, costPerRegistrationHuf: 10_000, paying: 0, costPerPayingHuf: null });
    expect(s.ads).toMatchObject({ enabled: false, meta: false, google: false, spendHuf: 10_000, queued: 0, sent: 0 });
    const rv = await h.json('POST', `/admin/marketing/koltes/${add.body.id}/visszavonas`, { token: admin.token });
    expect(rv.status).toBe(200);
    expect((await h.json('POST', `/admin/marketing/koltes/${add.body.id}/visszavonas`, { token: admin.token })).status).toBe(404);
    s = (await h.json('GET', '/admin/marketing?nap=30', { token: admin.token })).body;
    expect(s.ads.spendHuf).toBe(0);
    expect(s.ads.spend).toHaveLength(1);
    expect(s.ads.spend[0].revokedAt).not.toBeNull();
    expect(await h.deps.db.select().from(adSpend)).toHaveLength(1);
  });

  it('a client from before the source was recorded is "Ismeretlen (a mérés előtt)", not "Közvetlen"', async () => {
    umami = null;
    const c = await signUp(h, 'regi-ugyfel@demo.kezjegy.test');
    // as the 0021 backfill writes it: no campaign link, before_tracking = true
    await h.deps.db.update(marketingTouches).set({ beforeTracking: true }).where(eq(marketingTouches.userId, c.userId));
    const s = (await h.json('GET', '/admin/marketing?nap=30', { token: admin.token })).body;
    const u = s.funnel.byChannel.find((x: { channel: string }) => x.channel === 'ismeretlen');
    expect(u).toMatchObject({ label: 'Ismeretlen (a mérés előtt)', registered: 1, visitors: null });
    expect(s.unknownClients).toBeGreaterThanOrEqual(1);
  });

  it('a campaign name used by two sources shows no visitor number (Umami counts by name only)', async () => {
    umami = {
      visitors: 50,
      visits: 60,
      pageviews: 70,
      tags: [],
      devices: [],
      countries: [],
      cities: [],
      events: [],
      campaigns: [{ x: 'kozos-nev', y: 40 }],
    } as unknown as UmamiSummary;
    await signUp(h, 'kozos-yt@demo.kezjegy.test', { utm: { source: 'youtube', medium: 'video', campaign: 'kozos-nev' } });
    await signUp(h, 'kozos-fb@demo.kezjegy.test', { utm: { source: 'facebook', medium: 'social', campaign: 'kozos-nev' } });
    const s = (await h.json('GET', '/admin/marketing?nap=30', { token: admin.token })).body;
    const rows = s.campaigns.filter((x: { campaign: string }) => x.campaign === 'kozos-nev');
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r).toMatchObject({ visitors: null, sharedName: true, registered: 1 });
    umami = null;
  });

  it('ads off: the first payment queued nothing', async () => {
    expect(await h.deps.db.select().from(adConversionEvents)).toHaveLength(0);
    expect(await h.deps.db.select({ n: subscriptions.id }).from(subscriptions)).not.toHaveLength(0);
  });
});

describe('the Umami reader sends nothing personal and gives up cleanly', () => {
  const cfg = { url: 'http://kezjegy-umami:3000', websiteId: '0b7a4a52-6c55-4a1e-9a0e-2a1b3c4d5e6f', user: 'kezjegy-pult', password: 'x'.repeat(24) };
  it('only the login and the aggregate endpoints, with dates and metric names; the token is reused; cached for 5 minutes', async () => {
    const spy = spyFetch((url) => {
      if (url.endsWith('/api/auth/login')) return Response.json({ token: 'tok-1', user: {} });
      if (url.includes('/stats?')) return Response.json({ pageviews: 10, visitors: '7', visits: 8, bounces: 1, totaltime: 9, comparison: {} });
      if (url.includes('/metrics?')) return Response.json([{ x: 'youtube', y: 3 }, { x: '', y: 0 }]);
      return undefined;
    });
    const c = createUmamiClient(cfg, spy.f, () => new Date('2026-11-20T09:00:00Z'));
    const s = await c.summary({ startAt: 1, endAt: 2 });
    expect(s).toMatchObject({ visitors: 7, visits: 8, pageviews: 10 });
    expect(s.tags).toEqual([{ x: 'youtube', y: 3 }]);
    await c.summary({ startAt: 1, endAt: 2 });
    expect(spy.calls.filter((x) => x.url.endsWith('/api/auth/login'))).toHaveLength(1);
    expect(spy.calls).toHaveLength(8);
    for (const call of spy.calls) {
      expect(call.url.startsWith('http://kezjegy-umami:3000/api/')).toBe(true);
      const u = new URL(call.url);
      for (const k of u.searchParams.keys()) expect(['startAt', 'endAt', 'timezone', 'type', 'limit']).toContain(k);
      expect(call.url).not.toMatch(/@|email|phone|telefon|adoszam/i);
    }
    expect(spy.calls.filter((x) => x.body).map((x) => Object.keys(JSON.parse(x.body!)).sort())).toEqual([['password', 'username']]);
  });
  it('a refused login or no answer → UmamiUnavailable (the caller shows "nem érhető el")', async () => {
    const refused = createUmamiClient(cfg, spyFetch(() => new Response('no', { status: 401 })).f);
    await expect(refused.summary({ startAt: 1, endAt: 2 })).rejects.toBeInstanceOf(UmamiUnavailable);
    const dead = createUmamiClient(cfg, (async () => {
      throw new Error('ECONNREFUSED');
    }) as typeof fetch);
    await expect(dead.summary({ startAt: 1, endAt: 2 })).rejects.toBeInstanceOf(UmamiUnavailable);
  });
});

describe('ads ON (prepared path): only with consent, only the whitelist, withdrawal stops it', () => {
  let h: Harness;
  let fake: FakeStripe;
  const dir = mkdtempSync(join(tmpdir(), 'kj-hirdetes-'));
  const saFile = join(dir, 'google.json');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  writeFileSync(saFile, JSON.stringify({ client_email: 'adozz-dm@teszt-projekt.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), token_uri: 'https://oauth2.googleapis.com/token' }));
  const spy = spyFetch((url) => {
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'g-access', expires_in: 3600 });
    return undefined;
  });
  const env = {
    ...FAKE_STRIPE_ENV,
    ADS_TRACKING_ENABLED: 'true',
    META_PIXEL_ID: '123456789012345',
    META_CAPI_TOKEN: ['teszt', 'token', 'nem', 'valodi', '0123456789'].join('_'),
    GOOGLE_TAG_ID: 'AW-1234567890',
    GOOGLE_ADS_CUSTOMER_ID: '123-456-7890',
    GOOGLE_CONVERSION_REGISTRATION: '111111',
    GOOGLE_CONVERSION_PAYMENT: '222222',
    GOOGLE_SERVICE_ACCOUNT_FILE: saFile,
  };
  beforeAll(async () => {
    resetGoogleTokenCache();
    fake = new FakeStripe();
    h = await setup({ now: '2026-11-20T09:00:00Z', env, overrides: { fetch: spy.f, payments: { stripe: fake, demo: createDemoProvider({ apiPublicUrl: 'https://api.test', now: () => new Date('2026-11-20T09:00:00Z') }) } } });
  });
  afterAll(async () => h.close());

  it('config on; the public config gives the public ids only', async () => {
    expect(h.deps.cfg.ads.enabled).toBe(true);
    const r = await h.json('GET', '/public/marketing-config');
    expect(r.body).toEqual({ ads: true, noticeVersion: '1', metaPixelId: '123456789012345', googleTagId: 'AW-1234567890' });
    expect(JSON.stringify(r.body)).not.toContain('token');
  });

  it('ADS_TRACKING_ENABLED=true without any partner key stays off', async () => {
    const { loadConfig } = await import('../src/config.js');
    expect(loadConfig({ ...process.env, ADS_TRACKING_ENABLED: 'true' }).ads.enabled).toBe(false);
    expect(() => loadConfig({ ...process.env, ADS_TRACKING_ENABLED: 'true', META_PIXEL_ID: 'abc' })).toThrow(/META_PIXEL_ID/);
  });

  it('no consent → no row (even with click ids in the link)', async () => {
    const c = await signUp(h, 'nincs-hj@demo.kezjegy.test', { utm: { source: 'facebook' }, hirdetes: { fbclid: 'IwAR-1' } });
    expect((await touchOf(h, c.userId))[0]).toMatchObject({ clickIds: null, consentId: null });
    expect(await h.deps.db.select().from(adConversionEvents).where(eq(adConversionEvents.userId, c.userId))).toHaveLength(0);
  });

  it('a refused banner stores nothing; an accepted one is linked at sign-up; rows hold the whitelist only; the job sends them', async () => {
    const no = await h.json('POST', '/public/hozzajarulas', { body: { meta: false, google: false } });
    expect(no.body).toEqual({ id: null });
    const yes = await h.json('POST', '/public/hozzajarulas', { body: { meta: true, google: true, personalization: false } });
    expect(yes.status).toBe(201);
    const hid = yes.body.id as string;
    const c = await signUp(h, 'Hozza.Jarult+x@demo.kezjegy.test', { utm: { source: 'facebook' }, hirdetes: { hid, fbclid: 'IwAR-xyz', gclid: 'Cj0KCQ-abc' } });
    const [t] = await touchOf(h, c.userId);
    expect(t).toMatchObject({ consentId: hid, clickIds: { fbclid: 'IwAR-xyz', gclid: 'Cj0KCQ-abc' } });
    const [consent] = await h.deps.db.select().from(marketingConsents).where(eq(marketingConsents.id, hid));
    expect(consent!.userId).toBe(c.userId);
    const rows = await h.deps.db.select().from(adConversionEvents).where(eq(adConversionEvents.userId, c.userId));
    expect(rows.map((r) => `${r.provider}:${r.event}:${r.eventId}`).sort()).toEqual([`google:regisztracio:reg_${c.userId}`, `meta:regisztracio:reg_${c.userId}`]);
    const allowed = ['emailSha256', 'emailSha256Google', 'phoneSha256', 'phoneSha256Google', 'valueHuf', 'clickIds', 'fbc', 'eventSourceUrl', 'clientUserAgent', 'personalization'];
    for (const r of rows) {
      for (const k of Object.keys(r.payload)) expect(allowed).toContain(k);
      expect(r.payload.emailSha256).toBe(sha('hozza.jarult+x@demo.kezjegy.test'));
      expect(r.payload.phoneSha256).toBeNull(); // ADS_SEND_PHONE is off
      expect(JSON.stringify(r.payload)).not.toMatch(/@|Szabó|Kata|adoszam|adoazonosito|8417104569|68801234/);
    }
    spy.calls.length = 0;
    const res = await jobAdConversions(h.deps);
    expect(res).toEqual({ sent: 2, failed: 0, dropped: 0 });
    const metaCall = spy.calls.find((x) => x.url.startsWith('https://graph.facebook.com/v27.0/123456789012345/events'))!;
    expect(metaCall.url).not.toContain('access_token');
    const mb = JSON.parse(metaCall.body!);
    expect(mb.data[0]).toMatchObject({ event_name: 'CompleteRegistration', event_id: `reg_${c.userId}`, action_source: 'website', user_data: { em: [sha('hozza.jarult+x@demo.kezjegy.test')], fbc: expect.stringMatching(/^fb\.1\.\d+\.IwAR-xyz$/), client_user_agent: 'Mozilla/5.0 (teszt bongeszo)' } });
    expect(Object.keys(mb.data[0].user_data).sort()).toEqual(['client_user_agent', 'em', 'fbc']);
    const gCall = spy.calls.find((x) => x.url === 'https://datamanager.googleapis.com/v1/events:ingest')!;
    const gb = JSON.parse(gCall.body!);
    expect(gb).toMatchObject({ encoding: 'HEX', consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' }, destinations: [{ operatingAccount: { accountType: 'GOOGLE_ADS', accountId: '1234567890' }, productDestinationId: '111111' }] });
    expect(gb.events[0]).toMatchObject({ transactionId: `reg_${c.userId}`, eventSource: 'WEB', adIdentifiers: { gclid: 'Cj0KCQ-abc' }, userData: { userIdentifiers: [{ emailAddress: sha('hozza.jarult+x@demo.kezjegy.test') }] } });
    expect((await h.deps.db.select().from(adConversionEvents).where(eq(adConversionEvents.userId, c.userId))).every((r) => r.status === 'elkuldve')).toBe(true);
    // a second run sends nothing again
    spy.calls.length = 0;
    expect(await jobAdConversions(h.deps)).toEqual({ sent: 0, failed: 0, dropped: 0 });
    expect(spy.calls).toHaveLength(0);
  });

  it('first payment → "fizetett" with the amount; withdrawal in the account drops what is not sent', async () => {
    const yes = await h.json('POST', '/public/hozzajarulas', { body: { meta: true, google: false } });
    const c = await signUp(h, 'fizet-hj@demo.kezjegy.test', { utm: { source: 'instagram' }, hirdetes: { hid: yes.body.id } });
    await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, c.clientId));
    const profile = { firstName: 'Kata', lastName: 'Szabó', adoazonositoJel: '8417104569', adoszam: '68801234-1-41', address: { zip: '1136', city: 'Budapest', line: 'Példa utca 7.' }, hqMunicipality: 'Budapest', activityText: 'Grafika', activityAnswer: 'egyeb', taxStatus: 'fofoglalkozasu', evSince: '2019-04-01', hasSeparateBusinessAccount: true };
    expect((await h.json('PUT', '/client/profile', { token: c.token, body: profile })).status).toBe(200);
    const cv = (await h.json('GET', '/client/subscription/consent?purpose=subscribe', { token: c.token })).body;
    const st = await h.json('POST', '/client/subscription/start', { token: c.token, body: { platform: 'web', purpose: 'subscribe', consentVersion: cv.version, consentSha256: cv.sha256 } });
    const [p] = await h.deps.db.select().from(payments).where(eq(payments.id, st.body.paymentId));
    fake.complete(p!.stripeCheckoutSessionId!, '4242');
    expect((await h.json('GET', `/client/payments/checkout/${p!.stripeCheckoutSessionId}`, { token: c.token })).body.status).toBe('sikeres');
    const rows = await h.deps.db.select().from(adConversionEvents).where(eq(adConversionEvents.userId, c.userId));
    // Meta only (Google was not accepted)
    expect(rows.map((r) => `${r.provider}:${r.event}`).sort()).toEqual(['meta:fizetes', 'meta:regisztracio']);
    expect(rows.find((r) => r.event === 'fizetes')!.payload.valueHuf).toBe(p!.amountHuf);
    const me = await h.json('GET', '/me/hirdetesi-hozzajarulas', { token: c.token });
    expect(me.body).toMatchObject({ enabled: true, given: true, meta: true, google: false });
    const w = await h.json('POST', '/me/hirdetesi-hozzajarulas/visszavonas', { token: c.token });
    expect(w.body).toEqual({ withdrawn: 1 });
    spy.calls.length = 0;
    await jobAdConversions(h.deps);
    expect((await h.deps.db.select().from(adConversionEvents).where(eq(adConversionEvents.userId, c.userId))).every((r) => r.status === 'elvetve')).toBe(true);
    expect(spy.calls.filter((x) => AD_HOSTS.test(x.url))).toHaveLength(0);
    // a later conversion of this account is not queued any more
    const { queueAdConversion } = await import('../src/services/hirdetes.js');
    expect(await queueAdConversion(h.deps, h.deps.db, { event: 'fizetes', userId: c.userId, ref: 'x2', valueHuf: 1 })).toBe(0);
  });

  it('a decision of another visitor cannot be reused after it is linked; an old decision version does not count', async () => {
    const yes = await h.json('POST', '/public/hozzajarulas', { body: { meta: true } });
    const a = await signUp(h, 'elso-hid@demo.kezjegy.test', { hirdetes: { hid: yes.body.id } });
    const b = await signUp(h, 'masodik-hid@demo.kezjegy.test', { hirdetes: { hid: yes.body.id } });
    expect((await touchOf(h, a.userId))[0]!.consentId).toBe(yes.body.id);
    expect((await touchOf(h, b.userId))[0]!.consentId).toBeNull();
    const old = await h.json('POST', '/public/hozzajarulas', { body: { meta: true } });
    await h.deps.db.update(marketingConsents).set({ noticeVersion: '0' }).where(eq(marketingConsents.id, old.body.id));
    const c = await signUp(h, 'regi-verzio@demo.kezjegy.test', { hirdetes: { hid: old.body.id } });
    expect((await touchOf(h, c.userId))[0]!.consentId).toBeNull();
    expect(await h.deps.db.select().from(adConversionEvents).where(eq(adConversionEvents.userId, c.userId))).toHaveLength(0);
  });

  it('personalised ads are never stored or sent; the Google consent is always "denied" for personalisation', async () => {
    const yes = await h.json('POST', '/public/hozzajarulas', { body: { meta: false, google: true, personalization: true } });
    const [row] = await h.deps.db.select().from(marketingConsents).where(eq(marketingConsents.id, yes.body.id));
    expect(row!.personalization).toBe(false);
    const c = await signUp(h, 'nincs-remarketing@demo.kezjegy.test', { utm: { source: 'google', medium: 'cpc' }, hirdetes: { hid: yes.body.id, gclid: 'Cj0-pers' } });
    const rows = await h.deps.db.select().from(adConversionEvents).where(eq(adConversionEvents.userId, c.userId));
    expect(rows.every((r) => r.payload.personalization === false)).toBe(true);
    spy.calls.length = 0;
    await jobAdConversions(h.deps);
    const g = spy.calls.find((x) => x.url === 'https://datamanager.googleapis.com/v1/events:ingest')!;
    expect(JSON.parse(g.body!).consent).toEqual({ adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' });
  });

  it('a new choice on the banner ends a decision that is already linked to an account; the landing check says so', async () => {
    const yes = await h.json('POST', '/public/hozzajarulas', { body: { meta: true } });
    const c = await signUp(h, 'banner-visszavon@demo.kezjegy.test', { hirdetes: { hid: yes.body.id } });
    expect((await h.json('GET', `/public/hozzajarulas/${yes.body.id}`)).body).toEqual({ ervenyes: true });
    const again = await h.json('POST', '/public/hozzajarulas', { body: { meta: false, google: false, previous: yes.body.id } });
    expect(again.body).toEqual({ id: null });
    const [row] = await h.deps.db.select().from(marketingConsents).where(eq(marketingConsents.id, yes.body.id));
    expect(row!.withdrawnAt).not.toBeNull();
    const { queueAdConversion } = await import('../src/services/hirdetes.js');
    expect(await queueAdConversion(h.deps, h.deps.db, { event: 'fizetes', userId: c.userId, ref: 'p-banner', valueHuf: 1 })).toBe(0);
    expect((await h.json('GET', `/public/hozzajarulas/${yes.body.id}`)).body).toEqual({ ervenyes: false });
    expect((await h.json('GET', '/public/hozzajarulas/nem-uuid')).body).toEqual({ ervenyes: false });
  });

  it('a decision older than 180 days does not count; only the FIRST payment is signalled', async () => {
    const yes = await h.json('POST', '/public/hozzajarulas', { body: { meta: true } });
    const c = await signUp(h, 'regi-dontes@demo.kezjegy.test', { hirdetes: { hid: yes.body.id } });
    const { queueAdConversion } = await import('../src/services/hirdetes.js');
    expect(await queueAdConversion(h.deps, h.deps.db, { event: 'fizetes', userId: c.userId, ref: 'p1', valueHuf: 19_999 })).toBe(1);
    // a restart after a cancellation: no second "fizetett"
    expect(await queueAdConversion(h.deps, h.deps.db, { event: 'fizetes', userId: c.userId, ref: 'p2', valueHuf: 19_999 })).toBe(0);
    await h.deps.db.update(marketingConsents).set({ createdAt: new Date('2026-05-01T00:00:00Z') }).where(eq(marketingConsents.id, yes.body.id));
    expect((await h.json('GET', `/public/hozzajarulas/${yes.body.id}`)).body).toEqual({ ervenyes: false });
    await h.deps.db.delete(adConversionEvents).where(eq(adConversionEvents.userId, c.userId));
    expect(await queueAdConversion(h.deps, h.deps.db, { event: 'fizetes', userId: c.userId, ref: 'p3', valueHuf: 19_999 })).toBe(0);
  });

  it('a failing conversion queue never undoes the transaction around it (own savepoint)', async () => {
    const { queueAdConversionSafe } = await import('../src/services/hirdetes.js');
    const c = await signUp(h, 'mentopont@demo.kezjegy.test');
    await h.deps.db.transaction(async (tx) => {
      await tx.update(users).set({ displayName: 'Mentopont' }).where(eq(users.id, c.userId));
      // a broken user id makes the insert fail inside the savepoint – logged, 0, the outer transaction goes on
      expect(await queueAdConversionSafe(h.deps, tx, { event: 'regisztracio', userId: 'nem-uuid', ref: 'x' })).toBe(0);
    });
    const [u] = await h.deps.db.select({ n: users.displayName }).from(users).where(eq(users.id, c.userId));
    expect(u!.n).toBe('Mentopont');
  });

  it('a banner withdrawal ("previous") ends the unlinked decision', async () => {
    const yes = await h.json('POST', '/public/hozzajarulas', { body: { meta: true } });
    const again = await h.json('POST', '/public/hozzajarulas', { body: { meta: false, previous: yes.body.id } });
    expect(again.body).toEqual({ id: null });
    const [row] = await h.deps.db.select().from(marketingConsents).where(eq(marketingConsents.id, yes.body.id));
    expect(row!.withdrawnAt).not.toBeNull();
    // the users table is untouched by all this
    expect((await h.deps.db.select().from(users)).length).toBeGreaterThan(0);
    expect(await h.deps.db.select().from(callbackRequests)).toBeDefined();
  });
});

describe('source data: objection / erasure and the retention promised in the privacy notice (2.11., 8.)', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await setup({ now: '2026-11-21T09:00:00Z' });
  });
  afterAll(async () => h.close());

  it('eraseSourceDetails keeps only the channel (marketing rows and the older signup_attribution)', async () => {
    const c = await signUp(h, 'tiltakozik@demo.kezjegy.test', { utm: { source: 'youtube', medium: 'video', campaign: 'v1', content: 'leiras', term: 'ev' }, forras: { hivatkozo: 'youtube.com', erkezes: '/arak' } });
    const before = (await touchOf(h, c.userId))[0]!;
    expect(before).toMatchObject({ channel: 'youtube', utmCampaign: 'v1' });
    const n = await eraseSourceDetails(h.deps.db, c.userId);
    expect(n.touches).toBe(1);
    const after = (await touchOf(h, c.userId))[0]!;
    expect(after).toMatchObject({ channel: 'youtube', utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null, utmTerm: null, referrerDomain: null, landingPath: null, clickIds: null });
    const [sa] = await h.deps.db.select().from(signupAttribution).where(eq(signupAttribution.userId, c.userId));
    if (sa) expect(sa).toMatchObject({ utmSource: null, utmMedium: null, utmCampaign: null, utmContent: null });
  });

  it('the daily job: click ids go after 90 days, the source details after 2 years; nothing younger changes', async () => {
    const c = await signUp(h, 'megorzes@demo.kezjegy.test', { utm: { source: 'facebook', medium: 'paid_social', campaign: 'regi' } });
    const fresh = await signUp(h, 'friss@demo.kezjegy.test', { utm: { source: 'tiktok', campaign: 'uj' } });
    await h.deps.db.update(marketingTouches).set({ clickIds: { fbclid: 'IwAR-regi' }, createdAt: new Date('2026-07-01T00:00:00Z') }).where(eq(marketingTouches.userId, c.userId));
    let r = await jobMarketingRetention(h.deps);
    expect(r.clickIds).toBe(1);
    let t = (await touchOf(h, c.userId))[0]!;
    expect(t).toMatchObject({ clickIds: null, utmCampaign: 'regi', channel: 'facebook' });
    await h.deps.db.update(marketingTouches).set({ createdAt: new Date('2024-10-01T00:00:00Z') }).where(eq(marketingTouches.userId, c.userId));
    r = await jobMarketingRetention(h.deps);
    expect(r.touches).toBe(1);
    t = (await touchOf(h, c.userId))[0]!;
    expect(t).toMatchObject({ channel: 'facebook', utmSource: null, utmMedium: null, utmCampaign: null });
    expect((await touchOf(h, fresh.userId))[0]).toMatchObject({ utmCampaign: 'uj' });
    // again: nothing more to do
    expect(await jobMarketingRetention(h.deps)).toEqual({ clickIds: 0, touches: 0, attribution: 0 });
  });

  it('the data export holds every source field and the two ad files', async () => {
    const { touchesOfUser, adConsentsOfUser, adSignalsOfUser } = await import('../src/services/marketing.js');
    const c = await signUp(h, 'export-forras@demo.kezjegy.test', { utm: { source: 'youtube', campaign: 'x' } });
    const rows = await touchesOfUser(h.deps.db, c.userId);
    expect(Object.keys(rows[0]!).sort()).toEqual(
      ['aMeresElottiRegisztracio', 'aRegisztraciobolOrokolt', 'belepesiForras', 'cel', 'csatorna', 'erkezes', 'hirdetesiKattintasAzonositok', 'hivatkozo', 'hozzajarulasAzonosito', 'ido', 'platform', 'tipus', 'utmCampaign', 'utmContent', 'utmMedium', 'utmSource', 'utmTerm'].sort(),
    );
    expect(await adConsentsOfUser(h.deps.db, c.userId)).toEqual([]);
    expect(await adSignalsOfUser(h.deps.db, c.userId)).toEqual([]);
  });
});
