// SPEC §31.6 – ad measurement, PREPARED BUT SWITCHED OFF. With ADS_TRACKING_ENABLED=false (the default) cfg.ads.enabled
// is false and cfg.ads.meta / cfg.ads.google are null: no consent is stored, no outbox row is written, the job sends
// nothing, the public endpoints answer { ads: false } / 404, and the landing build carries no ad code at all.
// Switched on: only for a visitor who said "Elfogadom" (per partner) on the landing banner, only the whitelisted payload
// (hashed e-mail, optionally the hashed phone, the event, its time and value, the click id) – never tax data, never a
// name or an address. The consent is checked again when the row is sent; a withdrawal stops everything not yet sent.
import { readFile } from 'node:fs/promises';
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { importPKCS8, SignJWT } from 'jose';
import type { Deps } from '../deps.js';
import type { DbOrTx } from '../db/client.js';
import { adConversionEvents, clients, marketingConsents, marketingTouches, users, type AdConversionPayload } from '../db/schema.js';
import { sha256Hex } from '../lib/crypto.js';
import { log, safeErr } from '../log.js';

export type AdEvent = 'regisztracio' | 'fizetes';
type ConsentRow = typeof marketingConsents.$inferSelect;
type OutboxRow = typeof adConversionEvents.$inferSelect;

// ---------------------------------------------------------------------------------------------------------------------
// normalisation + hashing (the providers' own rules differ, so both forms are kept)
// ---------------------------------------------------------------------------------------------------------------------
/** Meta: trim + lower case. */
export function metaEmail(e: string): string {
  return e.trim().toLowerCase();
}
/** Google: trim + lower case; for gmail.com / googlemail.com also without dots and without the +suffix. */
export function googleEmail(e: string): string {
  const v = e.trim().toLowerCase();
  const at = v.lastIndexOf('@');
  if (at < 1) return v;
  const local = v.slice(0, at);
  const domain = v.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return v;
  return `${local.split('+')[0]!.replace(/\./g, '')}@${domain}`;
}
/** "+36 30 123 4567" / "06301234567" → "36301234567" (Meta: digits with the country code, no + and no leading zero). */
export function metaPhone(p: string): string | null {
  let d = p.replace(/\D/g, '');
  if (d.startsWith('06')) d = `36${d.slice(2)}`;
  d = d.replace(/^0+/, '');
  return d.length >= 8 && d.length <= 15 ? d : null;
}
/** Google: E.164 with the plus sign. */
export function googlePhone(p: string): string | null {
  const d = metaPhone(p);
  return d ? `+${d}` : null;
}
export const sha = (s: string) => sha256Hex(s);

// ---------------------------------------------------------------------------------------------------------------------
// consent
// ---------------------------------------------------------------------------------------------------------------------
/** Süti-tájékoztató 6. pont: a decision is valid for 6 months (180 days), then we ask again. */
export const AD_CONSENT_MAX_AGE_DAYS = 180;

/**
 * The valid consent linked to the account, newest first: not withdrawn, of the current notice version, at most 180 days
 * old (then the landing asks again). Null when there is none or ads are off.
 */
export async function consentOfUser(deps: Deps, db: DbOrTx, userId: string): Promise<ConsentRow | null> {
  if (!deps.cfg.ads.enabled) return null;
  const since = new Date(deps.now().getTime() - AD_CONSENT_MAX_AGE_DAYS * 86_400_000);
  const [row] = await db
    .select()
    .from(marketingConsents)
    .where(
      and(
        eq(marketingConsents.userId, userId),
        isNull(marketingConsents.withdrawnAt),
        eq(marketingConsents.noticeVersion, deps.cfg.ads.noticeVersion),
        gte(marketingConsents.createdAt, since),
      ),
    )
    .orderBy(desc(marketingConsents.createdAt))
    .limit(1);
  return row ?? null;
}

/**
 * Sign-up with ?hid=<decision id> from the landing banner: the decision becomes the account's consent – only with ads on,
 * only a granted, not withdrawn, not yet linked decision of the current notice version, at most 7 days old.
 */
export async function linkLandingConsent(deps: Deps, db: DbOrTx, hid: string | undefined, userId: string): Promise<ConsentRow | null> {
  if (!deps.cfg.ads.enabled || !hid) return null;
  const since = new Date(deps.now().getTime() - 7 * 86_400_000);
  const [row] = await db
    .update(marketingConsents)
    .set({ userId, linkedAt: deps.now() })
    .where(
      and(
        eq(marketingConsents.id, hid),
        isNull(marketingConsents.userId),
        isNull(marketingConsents.withdrawnAt),
        eq(marketingConsents.noticeVersion, deps.cfg.ads.noticeVersion),
        sql`${marketingConsents.createdAt} >= ${since}`,
        sql`(${marketingConsents.meta} or ${marketingConsents.google})`,
      ),
    )
    .returning();
  return row ?? null;
}

/** "Visszavonom" in the app (Fiók) or on the banner: every consent of the account ends, nothing unsent goes out. */
export async function withdrawConsents(deps: Deps, db: DbOrTx, o: { userId?: string; consentId?: string }): Promise<number> {
  const now = deps.now();
  const where = o.userId ? eq(marketingConsents.userId, o.userId) : o.consentId ? eq(marketingConsents.id, o.consentId) : null;
  if (!where) return 0;
  const rows = await db.update(marketingConsents).set({ withdrawnAt: now }).where(and(where, isNull(marketingConsents.withdrawnAt))).returning({ id: marketingConsents.id });
  if (rows.length)
    await db
      .update(adConversionEvents)
      .set({ status: 'elvetve', lastError: 'hozzájárulás visszavonva' })
      .where(and(inArray(adConversionEvents.consentId, rows.map((r) => r.id)), inArray(adConversionEvents.status, ['var', 'hiba'])));
  return rows.length;
}

// ---------------------------------------------------------------------------------------------------------------------
// outbox
// ---------------------------------------------------------------------------------------------------------------------
export interface QueueInput {
  event: AdEvent;
  userId: string;
  /** reg: the user id; fizetes: the payment id – makes the event id stable (dedup + retries). */
  ref: string;
  valueHuf?: number | null;
  /** Only for a browser-side event (the sign-up request): Meta website events need it [TULAJ/JOGI]. */
  userAgent?: string | null;
}

/** Writes the outbox rows of one conversion. Ads off, no consent, or a provider without its server keys → nothing. */
export async function queueAdConversion(deps: Deps, db: DbOrTx, i: QueueInput): Promise<number> {
  const ads = deps.cfg.ads;
  if (!ads.enabled) return 0;
  const consent = await consentOfUser(deps, db, i.userId);
  if (!consent) return 0;
  const metaOn = Boolean(ads.meta && ads.meta.capiToken && consent.meta);
  const googleConv = i.event === 'regisztracio' ? ads.google?.conversionRegistration : ads.google?.conversionPayment;
  const googleOn = Boolean(ads.google && ads.google.serviceAccountFile && ads.google.customerId && googleConv && consent.google);
  if (!metaOn && !googleOn) return 0;
  // Adatkezelési tájékoztató 2.18.: only the FIRST payment is signalled (a restart after a cancellation is not)
  if (i.event === 'fizetes') {
    const [prev] = await db
      .select({ id: adConversionEvents.id })
      .from(adConversionEvents)
      .where(and(eq(adConversionEvents.userId, i.userId), eq(adConversionEvents.event, 'fizetes')))
      .limit(1);
    if (prev) return 0;
  }
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, i.userId)).limit(1);
  if (!u) return 0;
  const [cl] = await db.select({ phoneEnc: clients.phoneEnc }).from(clients).where(eq(clients.userId, i.userId)).limit(1);
  // the click ids are kept only when the registration itself came with this consent (§31.6)
  const [touch] = await db
    .select({ clickIds: marketingTouches.clickIds, consentId: marketingTouches.consentId, createdAt: marketingTouches.createdAt })
    .from(marketingTouches)
    .where(and(eq(marketingTouches.userId, i.userId), eq(marketingTouches.kind, 'regisztracio')))
    .orderBy(marketingTouches.createdAt)
    .limit(1);
  const clickIds = touch?.consentId ? (touch.clickIds ?? null) : null;
  let phone: string | null = null;
  if (ads.sendPhone && cl?.phoneEnc) {
    try {
      phone = deps.data.dec(cl.phoneEnc, 'clients.phone');
    } catch {
      phone = null;
    }
  }
  const mp = phone ? metaPhone(phone) : null;
  const gp = phone ? googlePhone(phone) : null;
  const payload: AdConversionPayload = {
    emailSha256: sha(metaEmail(u.email)),
    emailSha256Google: sha(googleEmail(u.email)),
    phoneSha256: mp ? sha(mp) : null,
    phoneSha256Google: gp ? sha(gp) : null,
    valueHuf: i.valueHuf ?? null,
    clickIds,
    fbc: clickIds?.fbclid && touch ? `fb.1.${touch.createdAt.getTime()}.${clickIds.fbclid}` : null,
    eventSourceUrl: `${deps.cfg.appPublicUrl}${i.event === 'regisztracio' ? '/regisztracio' : '/elofizetes'}`,
    clientUserAgent: i.userAgent ? i.userAgent.slice(0, 400) : null,
    // no remarketing / personalised ads (2.18.: "nem használunk") – never granted, whatever an old row says
    personalization: false,
  };
  const eventId = `${i.event === 'regisztracio' ? 'reg' : 'fiz'}_${i.ref}`;
  const providers: ('meta' | 'google')[] = [];
  if (metaOn) providers.push('meta');
  if (googleOn) providers.push('google');
  let n = 0;
  for (const provider of providers) {
    const res = await db
      .insert(adConversionEvents)
      .values({ provider, event: i.event, eventId, userId: i.userId, consentId: consent.id, eventTime: deps.now(), payload, createdAt: deps.now() })
      .onConflictDoNothing()
      .returning({ id: adConversionEvents.id });
    n += res.length;
  }
  return n;
}

/**
 * queueAdConversion inside the caller's transaction, but in its OWN savepoint: an error here (ads on) is logged and
 * rolled back alone – it never undoes the e-mail confirmation or the booking of a payment around it.
 */
export async function queueAdConversionSafe(deps: Deps, db: DbOrTx, i: QueueInput): Promise<number> {
  if (!deps.cfg.ads.enabled) return 0;
  try {
    return await db.transaction(async (sp) => queueAdConversion(deps, sp, i));
  } catch (e) {
    log().warn({ err: safeErr(e), event: i.event }, 'ad conversion not queued');
    return 0;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// adapters
// ---------------------------------------------------------------------------------------------------------------------
const META_EVENT: Record<AdEvent, string> = { regisztracio: 'CompleteRegistration', fizetes: 'Subscribe' };

/** The Meta Conversions API body of one row (exported for the payload test). */
export function metaEventOf(row: Pick<OutboxRow, 'event' | 'eventId' | 'eventTime' | 'payload'>): Record<string, unknown> {
  const p = row.payload;
  const userData: Record<string, unknown> = { em: [p.emailSha256] };
  if (p.phoneSha256) userData.ph = [p.phoneSha256];
  if (p.fbc) userData.fbc = p.fbc;
  if (p.clientUserAgent) userData.client_user_agent = p.clientUserAgent;
  const website = Boolean(p.clientUserAgent && p.eventSourceUrl);
  const ev: Record<string, unknown> = {
    event_name: META_EVENT[row.event],
    event_time: Math.floor(row.eventTime.getTime() / 1000),
    event_id: row.eventId,
    action_source: website ? 'website' : 'system_generated',
    user_data: userData,
  };
  if (website) ev.event_source_url = p.eventSourceUrl;
  if (row.event === 'fizetes' && p.valueHuf) ev.custom_data = { value: p.valueHuf, currency: 'HUF' };
  return ev;
}

/** The Google Data Manager API event of one row (exported for the payload test). */
export function googleEventOf(row: Pick<OutboxRow, 'event' | 'eventId' | 'eventTime' | 'payload'>): Record<string, unknown> {
  const p = row.payload;
  const ids: Record<string, string>[] = [{ emailAddress: p.emailSha256Google }];
  if (p.phoneSha256Google) ids.push({ phoneNumber: p.phoneSha256Google });
  const ad: Record<string, string> = {};
  if (p.clickIds?.gclid) ad.gclid = p.clickIds.gclid;
  else if (p.clickIds?.gbraid) ad.gbraid = p.clickIds.gbraid;
  else if (p.clickIds?.wbraid) ad.wbraid = p.clickIds.wbraid;
  const ev: Record<string, unknown> = {
    eventTimestamp: row.eventTime.toISOString(),
    eventSource: 'WEB',
    transactionId: row.eventId,
    userData: { userIdentifiers: ids },
  };
  if (Object.keys(ad).length) ev.adIdentifiers = ad;
  if (row.event === 'fizetes' && p.valueHuf) {
    ev.conversionValue = p.valueHuf;
    ev.currency = 'HUF';
  }
  return ev;
}

async function sendMeta(deps: Deps, row: OutboxRow): Promise<void> {
  const m = deps.cfg.ads.meta;
  if (!m || !m.capiToken) throw new Error('meta not configured');
  const body: Record<string, unknown> = { data: [metaEventOf(row)], access_token: m.capiToken };
  if (m.testEventCode) body.test_event_code = m.testEventCode;
  // the token goes in the body (never in the URL, so it never reaches a log line)
  const res = await deps.fetch(`https://graph.facebook.com/${m.graphVersion}/${m.pixelId}/events`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`meta ${res.status}`);
}

let googleToken: { value: string; until: number } | null = null;

async function googleAccessToken(deps: Deps): Promise<string> {
  const g = deps.cfg.ads.google!;
  if (googleToken && googleToken.until > Date.now() + 60_000) return googleToken.value;
  const sa = JSON.parse(await readFile(g.serviceAccountFile, 'utf8')) as { client_email?: string; private_key?: string; token_uri?: string };
  if (!sa.client_email || !sa.private_key) throw new Error('google service account file incomplete');
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const key = await importPKCS8(sa.private_key, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/datamanager' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(sa.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const res = await deps.fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  const b = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!b.access_token) throw new Error('google token missing');
  googleToken = { value: b.access_token, until: Date.now() + (b.expires_in ?? 3000) * 1000 };
  return b.access_token;
}

async function sendGoogle(deps: Deps, row: OutboxRow): Promise<void> {
  const g = deps.cfg.ads.google;
  const conv = row.event === 'regisztracio' ? g?.conversionRegistration : g?.conversionPayment;
  if (!g || !conv || !g.customerId) throw new Error('google not configured');
  const token = await googleAccessToken(deps);
  const destination: Record<string, unknown> = { operatingAccount: { accountType: 'GOOGLE_ADS', accountId: g.customerId }, productDestinationId: conv };
  if (g.loginCustomerId) destination.loginAccount = { accountType: 'GOOGLE_ADS', accountId: g.loginCustomerId };
  const body = {
    destinations: [destination],
    encoding: 'HEX',
    // no remarketing / personalised ads (Adatkezelési tájékoztató 2.18.) – always denied
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
    validateOnly: g.validateOnly,
    events: [googleEventOf(row)],
  };
  const res = await deps.fetch('https://datamanager.googleapis.com/v1/events:ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`google ${res.status}`);
}

/** Meta takes events of the last 7 days; Google click uploads 90 days (63 without a click id, to be safe). */
function tooOld(row: OutboxRow, now: Date): boolean {
  const ageDays = (now.getTime() - row.eventTime.getTime()) / 86_400_000;
  if (row.provider === 'meta') return ageDays > 6.5;
  return ageDays > (row.payload.clickIds?.gclid || row.payload.clickIds?.gbraid || row.payload.clickIds?.wbraid ? 89 : 62);
}

/** Worker job (every 5 minutes while ads are on): sends the waiting rows, checking the consent again. */
export async function jobAdConversions(deps: Deps): Promise<{ sent: number; failed: number; dropped: number }> {
  const out = { sent: 0, failed: 0, dropped: 0 };
  if (!deps.cfg.ads.enabled) return out;
  const now = deps.now();
  const rows = await deps.db
    .select()
    .from(adConversionEvents)
    .where(and(inArray(adConversionEvents.status, ['var', 'hiba']), lt(adConversionEvents.attempts, 6)))
    .orderBy(adConversionEvents.createdAt)
    .limit(100);
  for (const row of rows) {
    const [consent] = await deps.db.select().from(marketingConsents).where(eq(marketingConsents.id, row.consentId)).limit(1);
    const fresh = consent && consent.createdAt.getTime() >= now.getTime() - AD_CONSENT_MAX_AGE_DAYS * 86_400_000;
    const allowed = consent && fresh && !consent.withdrawnAt && consent.userId === row.userId && (row.provider === 'meta' ? consent.meta : consent.google);
    const configured = row.provider === 'meta' ? Boolean(deps.cfg.ads.meta?.capiToken) : Boolean(deps.cfg.ads.google);
    if (!allowed || !configured || tooOld(row, now)) {
      await deps.db.update(adConversionEvents).set({ status: 'elvetve', lastError: !allowed ? 'nincs érvényes hozzájárulás' : !configured ? 'a szolgáltató nincs beállítva' : 'túl régi esemény' }).where(eq(adConversionEvents.id, row.id));
      out.dropped++;
      continue;
    }
    try {
      if (row.provider === 'meta') await sendMeta(deps, row);
      else await sendGoogle(deps, row);
      await deps.db.update(adConversionEvents).set({ status: 'elkuldve', sentAt: deps.now(), attempts: row.attempts + 1, lastError: null }).where(eq(adConversionEvents.id, row.id));
      out.sent++;
    } catch (e) {
      // the message never holds a key or a hash: only the provider and the HTTP status
      const msg = (e as Error).message.slice(0, 120);
      await deps.db.update(adConversionEvents).set({ status: 'hiba', attempts: row.attempts + 1, lastError: msg }).where(eq(adConversionEvents.id, row.id));
      log().warn({ err: safeErr(e), provider: row.provider }, 'ad conversion send failed');
      out.failed++;
    }
  }
  return out;
}

/** For tests: forget the cached Google token. */
export function resetGoogleTokenCache(): void {
  googleToken = null;
}
