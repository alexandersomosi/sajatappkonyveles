import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError, currentUser, refreshSession, setSession } from './client';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
const auth = (token: string) => ({
  accessToken: token,
  accessTokenExpiresAt: new Date(Date.now() + 600_000).toISOString(),
  user: { id: 'u1', email: 'bence.kovacs@demo.kezjegy.test', role: 'accountant', displayName: 'Kovács Bence', emailVerified: true, totpEnabled: false },
});

afterEach(() => {
  vi.unstubAllGlobals();
  setSession(null);
});

describe('api client', () => {
  it('sends the bearer token and parses JSON', async () => {
    setSession(auth('t1') as never);
    const f = vi.fn(async () => json(200, { ok: true }));
    vi.stubGlobal('fetch', f);
    await expect(api.get('/acc/clients')).resolves.toEqual({ ok: true });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/v1/acc/clients');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t1');
  });

  it('refreshes once on 401 unauthenticated with the CSRF header, then retries', async () => {
    setSession(auth('old') as never);
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push(`${init.method} ${url}`);
        if (url.endsWith('/auth/refresh')) {
          expect((init.headers as Record<string, string>)['X-Kezjegy']).toBe('1');
          return json(200, auth('new'));
        }
        const h = (init.headers as Record<string, string>).Authorization;
        return h === 'Bearer new' ? json(200, { items: [] }) : json(401, { error: { code: 'unauthenticated', message: 'Lépj be újra.' } });
      }),
    );
    await expect(api.get('/acc/requests')).resolves.toEqual({ items: [] });
    expect(calls).toEqual(['GET /api/v1/acc/requests', 'POST /api/v1/auth/refresh', 'GET /api/v1/acc/requests']);
  });

  it('maps API errors to ApiError with the plain Hungarian message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(429, { error: { code: 'rate_limited', message: 'Túl sok próbálkozás.' } }, { 'Retry-After': '60' })));
    const e = (await api.post('/auth/login', {}, { noRefresh: true }).catch((x) => x)) as ApiError;
    expect(e).toBeInstanceOf(ApiError);
    expect(e.code).toBe('rate_limited');
    expect(e.message).toBe('Túl sok próbálkozás.');
    expect(e.retryAfter).toBe(60);
  });

  it('keeps mfaToken from the 401 mfa_required body', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { error: { code: 'mfa_required', message: 'Kód kell.' }, mfaToken: 'abc' })));
    const e = (await api.post('/auth/login', {}, { noRefresh: true }).catch((x) => x)) as ApiError;
    expect(e.code).toBe('mfa_required');
    expect((e.body as { mfaToken: string }).mfaToken).toBe('abc');
  });

  it('a failed refresh clears the session', async () => {
    setSession(auth('x') as never);
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { error: { code: 'unauthenticated', message: 'Lépj be.' } })));
    await expect(refreshSession()).resolves.toBe(false);
    expect(currentUser()).toBeNull();
  });

  it('network failure becomes a friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    const e = (await api.get('/config', { noRefresh: true }).catch((x) => x)) as ApiError;
    expect(e.code).toBe('network');
    expect(e.message).toMatch(/Nem érem el/);
  });
});
