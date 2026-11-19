// Minimal API client for the panel (SPEC §3.5, §4.1).
// - same-origin `/api/v1`, JSON, camelCase
// - access token only in memory; refresh with the HttpOnly `kj_rt` cookie + `X-Kezjegy: 1` (CSRF guard)
// - one retry after a transparent refresh on 401 `unauthenticated`
// - errors become ApiError with the server's plain Hungarian message (never internals)
import type { AuthResult, AuthUser } from '../_shared/api';

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  readonly retryAfter?: number;
  readonly body?: unknown;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>, retryAfter?: number, body?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.retryAfter = retryAfter;
    this.body = body;
  }
}

type Listener = (user: AuthUser | null) => void;

interface SessionState {
  accessToken: string | null;
  expiresAt: number; // ms
  user: AuthUser | null;
}
const session: SessionState = { accessToken: null, expiresAt: 0, user: null };
const listeners = new Set<Listener>();
let refreshInFlight: Promise<boolean> | null = null;

export function onAuthChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function currentUser(): AuthUser | null {
  return session.user;
}
export function setSession(r: AuthResult | null): void {
  if (r) {
    session.accessToken = r.accessToken;
    session.expiresAt = Date.parse(r.accessTokenExpiresAt) || Date.now() + 9 * 60_000;
    session.user = r.user;
  } else {
    session.accessToken = null;
    session.expiresAt = 0;
    session.user = null;
  }
  for (const l of listeners) l(session.user);
}
export function updateUser(patch: Partial<AuthUser>): void {
  if (!session.user) return;
  session.user = { ...session.user, ...patch };
  for (const l of listeners) l(session.user);
}

const GENERIC_MESSAGE = 'Valami nem sikerült. Próbáld újra egy perc múlva.';
const NETWORK_MESSAGE = 'Nem érem el a szervert. Nézd meg az internetkapcsolatot, és próbáld újra.';

async function toApiError(res: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  const e = (body as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
  const retryAfter = Number(res.headers.get('Retry-After')) || undefined;
  const code = e?.code ?? (res.status === 404 ? 'not_found' : res.status === 401 ? 'unauthenticated' : 'internal');
  let message = e?.message ?? GENERIC_MESSAGE;
  if (!e?.message && res.status === 404) message = 'Nincs ilyen, vagy nincs hozzá jogod.';
  return new ApiError(res.status, code, message, e?.fields, retryAfter, body);
}

/** Refresh the access token with the cookie. Returns false when there is no valid session. */
export function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'X-Kezjegy': '1', Accept: 'application/json' },
      });
      if (!res.ok) {
        // Drain the small error body: an unread fetch body keeps the request "pending" in Chrome.
        await res.text().catch(() => '');
        setSession(null);
        return false;
      }
      setSession((await res.json()) as AuthResult);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export interface RequestOptions {
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
  /** return the Response untouched (CSV, files) */
  raw?: boolean;
  /** do not try a refresh on 401 (login, refresh itself) */
  noRefresh?: boolean;
  headers?: Record<string, string>;
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  if (!opts.noRefresh && session.accessToken && session.expiresAt - Date.now() < 20_000) {
    await refreshSession();
  }
  const doFetch = () => {
    const headers: Record<string, string> = { Accept: 'application/json', ...(opts.headers ?? {}) };
    if (session.accessToken) headers.Authorization = `Bearer ${session.accessToken}`;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
    return fetch(`${API_BASE}${path}`, { method, headers, body, signal: opts.signal, credentials: 'same-origin' });
  };
  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', NETWORK_MESSAGE);
  }
  if (res.status === 401 && !opts.noRefresh) {
    const e = await toApiError(res.clone());
    if (e.code === 'unauthenticated' && (await refreshSession())) {
      res = await doFetch();
    } else {
      if (e.code === 'unauthenticated') setSession(null);
      throw e;
    }
  }
  if (!res.ok) throw await toApiError(res);
  if (opts.raw) return res as unknown as T;
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, o?: RequestOptions) => request<T>('GET', path, o),
  post: <T>(path: string, body?: unknown, o?: RequestOptions) => request<T>('POST', path, { ...o, body }),
  put: <T>(path: string, body?: unknown, o?: RequestOptions) => request<T>('PUT', path, { ...o, body }),
  patch: <T>(path: string, body?: unknown, o?: RequestOptions) => request<T>('PATCH', path, { ...o, body }),
  del: <T>(path: string, o?: RequestOptions) => request<T>('DELETE', path, o),
};

/** Multipart upload with progress (XHR); falls back to fetch where XHR is unavailable (tests, mock). */
export function upload<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  if (typeof XMLHttpRequest === 'undefined' || import.meta.env.VITE_MOCK_API === '1') {
    return request<T>('POST', path, { form }).then((r) => {
      onProgress?.(1);
      return r;
    });
  }
  const send = () =>
    new Promise<{ status: number; text: string; retryAfter: string | null }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}${path}`);
      xhr.withCredentials = true;
      xhr.setRequestHeader('Accept', 'application/json');
      if (session.accessToken) xhr.setRequestHeader('Authorization', `Bearer ${session.accessToken}`);
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) onProgress?.(ev.loaded / ev.total);
      };
      xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText, retryAfter: xhr.getResponseHeader('Retry-After') });
      xhr.onerror = () => reject(new ApiError(0, 'network', NETWORK_MESSAGE));
      xhr.send(form);
    });
  return (async () => {
    if (session.accessToken && session.expiresAt - Date.now() < 20_000) await refreshSession();
    let r = await send();
    if (r.status === 401 && (await refreshSession())) r = await send();
    if (r.status < 200 || r.status >= 300) {
      let body: { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null = null;
      try {
        body = JSON.parse(r.text);
      } catch {
        /* ignore */
      }
      const msg = r.status === 413 ? 'Túl nagy a fájl (legfeljebb 25 MB).' : body?.error?.message ?? GENERIC_MESSAGE;
      throw new ApiError(r.status, body?.error?.code ?? 'internal', msg, body?.error?.fields, Number(r.retryAfter) || undefined);
    }
    return (r.text ? JSON.parse(r.text) : undefined) as T;
  })();
}

/** Download a protected file or CSV through the API (Bearer), then hand it to the browser as a Blob. */
export async function downloadVia(path: string, fallbackName: string): Promise<void> {
  const res = await request<Response>('GET', path, { raw: true, headers: { Accept: '*/*' } });
  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = cd.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
  const name = m ? decodeURIComponent(m[1] ?? m[2] ?? fallbackName) : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
