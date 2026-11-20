// Test harness: PGlite database with all migrations, a controllable clock, captured e-mails,
// temporary encrypted file store, and helpers to create users and call the API.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { openPglite } from '../src/db/client.js';
import { accountants, clients, teamMembers, users } from '../src/db/schema.js';
import { buildDeps, type Deps, type DepsOverrides } from '../src/deps.js';
import { hashPassword } from '../src/lib/password.js';
import { issueAuth } from '../src/services/accounts.js';
import type { Mailer } from '../src/notify/mailer.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  template: string;
}

export interface Harness {
  deps: Deps;
  app: ReturnType<typeof createApp>;
  mails: Mail[];
  clock: { now: () => Date; set(d: string | Date): void; advance(ms: number): void };
  req(method: string, path: string, o?: { body?: unknown; token?: string; headers?: Record<string, string>; form?: FormData; raw?: string }): Promise<Response>;
  json<T = any>(method: string, path: string, o?: { body?: unknown; token?: string; headers?: Record<string, string>; form?: FormData }): Promise<{ status: number; body: T; res: Response }>;
  close(): Promise<void>;
  filesDir: string;
}

export async function setup(o: { now?: string; env?: Record<string, string>; overrides?: DepsOverrides } = {}): Promise<Harness> {
  const handle = await openPglite();
  await handle.migrate();
  const filesDir = mkdtempSync(join(tmpdir(), 'kezjegy-files-'));
  const cfg = loadConfig({ ...process.env, FILES_DIR: filesDir, ...(o.env ?? {}) });
  let now = new Date(o.now ?? '2026-11-17T09:00:00Z');
  const clock = {
    now: () => new Date(now),
    set(d: string | Date) {
      now = new Date(d);
    },
    advance(ms: number) {
      now = new Date(now.getTime() + ms);
    },
  };
  const mails: Mail[] = [];
  const mailer: Mailer = {
    mode: 'demo',
    async send(m) {
      mails.push(m);
      return 'demo';
    },
  };
  const deps = buildDeps(cfg, handle.db, { now: clock.now, mailer, dispatchInline: false, ...(o.overrides ?? {}) });
  await deps.legal.load(handle.db);
  await deps.content.reload();
  const app = createApp(deps);
  const req: Harness['req'] = async (method, path, r = {}) => {
    const headers: Record<string, string> = { 'x-forwarded-for': '203.0.113.7', ...(r.headers ?? {}) };
    if (r.token) headers.authorization = `Bearer ${r.token}`;
    let body: BodyInit | undefined;
    if (r.form) body = r.form;
    else if (r.raw !== undefined) body = r.raw;
    else if (r.body !== undefined) {
      body = JSON.stringify(r.body);
      headers['content-type'] = 'application/json';
    }
    return app.request(`/api/v1${path}`, { method, headers, body });
  };
  const json: Harness['json'] = async (method, path, r = {}) => {
    // SPEC §27.2.2: the full data form of an existing business no longer answers the branch question silently
    // (409 path_required). Older suites send it to a fresh client: answer "van" first, as the app does. A test of the
    // refusal itself sends the header x-test-no-auto-van.
    if (method === 'PUT' && path === '/client/profile' && r.token && r.body && typeof r.body === 'object' && 'adoszam' in (r.body as object) && !r.headers?.['x-test-no-auto-van']) {
      const st = await req('GET', '/client/onboarding', { token: r.token, headers: r.headers });
      if (st.status === 200 && ((await st.json()) as { path: string | null }).path === null) await req('PUT', '/client/onboarding/business-status', { token: r.token, body: { businessStatus: 'van' }, headers: r.headers });
    }
    const res = await req(method, path, r);
    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: res.status, body: parsed, res };
  };
  return {
    deps,
    app,
    mails,
    clock,
    req,
    json,
    filesDir,
    async close() {
      await handle.close();
      rmSync(filesDir, { recursive: true, force: true });
    },
  };
}

export const PW = 'Hosszu-Demo-Jelszo-2026!';

export function lastCode(h: Harness, to: string): string {
  const m = [...h.mails].reverse().find((x) => x.to === to);
  const code = m?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no code mail for ${to}`);
  return code;
}

/**
 * Registers a client through the API, verifies the e-mail, returns its token and ids. `active: true` puts the client
 * straight into lifecycle 'aktiv' (SPEC §26.5: dossier, uploads, tax and requests are locked before activation).
 * k7b (S16): the sign-up answers 202 without a session; the code from the mail opens it (POST /auth/register/verify).
 */
export async function newClient(h: Harness, email: string, o: { first?: string; last?: string; active?: boolean } = {}) {
  const ip = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
  const r = await h.json('POST', '/auth/register', { body: { email, password: PW, firstName: o.first ?? 'Teszt', lastName: o.last ?? 'Ügyfél', platform: 'android' }, headers: { 'x-forwarded-for': ip } });
  if (r.status !== 202) throw new Error(`register failed ${r.status} ${JSON.stringify(r.body)}`);
  const v = await h.json('POST', '/auth/register/verify', { body: { email, code: lastCode(h, email.toLowerCase()), platform: 'android' }, headers: { 'x-forwarded-for': ip } });
  if (v.status !== 201) throw new Error(`verify failed ${v.status} ${JSON.stringify(v.body)}`);
  const token = v.body.accessToken as string;
  const [cl] = await h.deps.db.select().from(clients).where(eq(clients.userId, v.body.user.id)).limit(1);
  if (o.active) await h.deps.db.update(clients).set({ lifecycle: 'aktiv' }).where(eq(clients.id, cl!.id));
  return { token, userId: v.body.user.id as string, clientId: cl!.id, refreshToken: v.body.refreshToken as string };
}

/**
 * k7b: a signed-in client whose e-mail is NOT confirmed yet – the way an older sign-up (before k7b the registration
 * opened a session at once) still holds a session. Since k7b such an account cannot sign in with the password any more
 * (S16), so the session is issued directly. Returns a login-like answer { status: 200, body: AuthResult }.
 */
export async function registerUnverified(h: Harness, email: string, headers: Record<string, string>, o: { first?: string; last?: string } = {}) {
  const r = await h.json('POST', '/auth/register', { body: { email, password: PW, firstName: o.first ?? 'Teszt', lastName: o.last ?? 'Ügyfél', platform: 'android' }, headers });
  if (r.status !== 202) throw new Error(`register failed ${r.status} ${JSON.stringify(r.body)}`);
  const [u] = await h.deps.db.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!u) throw new Error('register made no account');
  const issued = await issueAuth(h.deps, h.deps.db, { userId: u.id, clientKind: 'native', ua: 'test', ipHmac: 'test' });
  return { status: 200, body: issued.result as unknown as Record<string, any> };
}

export async function staff(h: Harness, role: 'accountant' | 'admin' | 'csapat', email: string, o: { firstName?: string; appointmentsEnabled?: boolean } = {}) {
  const [u] = await h.deps.db
    .insert(users)
    .values({ email, role, displayName: role === 'admin' ? 'Admin Teszt' : role === 'csapat' ? `Nagy ${o.firstName ?? 'Anna'}` : `Könyvelő ${o.firstName ?? 'Bence'}`, passwordHash: await hashPassword(PW), emailVerifiedAt: h.clock.now() })
    .returning();
  if (role === 'csapat') await h.deps.db.insert(teamMembers).values({ userId: u!.id, displayName: `Nagy ${o.firstName ?? 'Anna'}`, firstName: o.firstName ?? 'Anna' });
  let accountantId: string | null = null;
  if (role === 'accountant') {
    const [a] = await h.deps.db
      .insert(accountants)
      .values({ userId: u!.id, displayName: `Kovács ${o.firstName ?? 'Bence'}`, firstName: o.firstName ?? 'Bence', nameWith: 'Bencével', nameFrom: 'Bencétől', nameOnto: 'Bencére', nameAcc: 'Bencét', appointmentsEnabled: o.appointmentsEnabled ?? false, registrationNumber: '123456' })
      .returning();
    accountantId = a!.id;
  }
  const login = await h.json('POST', '/auth/login', { body: { email, password: PW, clientKind: 'panel' } });
  if (login.status !== 200) throw new Error(`staff login failed ${JSON.stringify(login.body)}`);
  return { token: login.body.accessToken as string, userId: u!.id, accountantId };
}

export function pdfBytes(): Uint8Array {
  return new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
}

export function jpegBytes(): Uint8Array {
  // Minimal valid baseline JPEG (1x1 px).
  return Uint8Array.from(
    Buffer.from(
      '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=',
      'base64',
    ),
  );
}

/** SPEC §27.4.2: the card comes after the contract – accept the three documents as the app does. */
export async function acceptContract(h: Harness, token: string): Promise<void> {
  const items = (['aszf', 'adatkezeles', 'megbizasi_szerzodes'] as const).map((d) => ({ docType: d, version: h.deps.legal.current(d).version }));
  const r = await h.json('POST', '/me/consents', { token, body: { items } });
  if (r.status !== 204) throw new Error(`consents failed ${r.status} ${JSON.stringify(r.body)}`);
}
