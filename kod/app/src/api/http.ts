// API-kliens: JSON, hibakezelés (SPEC §3.5), automatikus tokenfrissítés (§4.1), feltöltés folyamatjelzéssel.
// A szállítás cserélhető: valódi fetch, vagy MINTA módban a beépített minta-szerver (src/api/minta).
import { Platform } from 'react-native';
import { API_URL, MINTA_MOD } from '../config';

export class ApiHiba extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;
  data?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.data = data;
  }
}

export interface Valasz {
  status: number;
  fejlec(nev: string): string | null;
  json(): Promise<unknown>;
  blob(): Promise<Blob>;
}
export interface Keres {
  method: string;
  url: string; // API_URL-hez képest relatív útvonal: '/client/home'
  headers: Record<string, string>;
  body?: string | FormData;
}
export type Szallito = (k: Keres) => Promise<Valasz>;

const valodiSzallito: Szallito = async (k) => {
  const r = await fetch(API_URL + k.url, {
    method: k.method,
    headers: k.headers,
    body: k.body as BodyInit | undefined,
    // web: ugyanazon a hoston a frissítő süti (kj_rt, HttpOnly) csak így megy át; natívan nincs süti
    credentials: Platform.OS === 'web' ? 'same-origin' : 'omit',
  });
  return { status: r.status, fejlec: (n) => r.headers.get(n), json: () => r.json(), blob: () => r.blob() };
};

let szallito: Szallito = valodiSzallito;
let mintaBetoltes: Promise<void> | null = null;
async function mintaSzallito(): Promise<void> {
  if (!MINTA_MOD) return;
  if (!mintaBetoltes) {
    mintaBetoltes = import('./minta/szerver').then((m) => {
      szallito = m.mintaSzallito;
    });
  }
  await mintaBetoltes;
}

// ---------- token ----------
type Hozzaferes = { token: string; lejar: number };
let hozzaferes: Hozzaferes | null = null;
export interface TokenKezelo {
  frissitoToken(): Promise<string | null>; // natív: secure-store; web: null (süti)
  ujMunkamenet(eredmeny: unknown): Promise<void>; // AuthResult → tárolás
  kijelentkezett(): void;
}
let kezelo: TokenKezelo | null = null;
export function tokenKezelo(k: TokenKezelo) {
  kezelo = k;
}
export function hozzaferesBeallit(token: string | null, lejaratIso?: string) {
  hozzaferes = token ? { token, lejar: lejaratIso ? Date.parse(lejaratIso) : Date.now() + 9 * 60_000 } : null;
}
/** Natív letöltéshez (File.downloadFileAsync fejléccel); előtte frissít, ha kell. */
export async function hozzaferesFejlec(): Promise<Record<string, string>> {
  if (!hozzaferes || hozzaferes.lejar - Date.now() < 30_000) await frissit();
  return hozzaferes ? { Authorization: `Bearer ${hozzaferes.token}` } : {};
}
export function vanHozzaferes() {
  return !!hozzaferes;
}

let frissites: Promise<boolean> | null = null;
/** Egyszerre egy frissítés fut; a többi kérés megvárja (SPEC §4.1: forgó frissítő token). */
export function frissit(): Promise<boolean> {
  if (!frissites) {
    frissites = (async () => {
      try {
        await mintaSzallito();
        const rt = kezelo ? await kezelo.frissitoToken() : null;
        if (Platform.OS !== 'web' && !rt) return false;
        const v = await szallito({
          method: 'POST',
          url: '/auth/refresh',
          headers: { 'Content-Type': 'application/json', 'X-Kezjegy': '1' },
          body: JSON.stringify(Platform.OS === 'web' ? {} : { refreshToken: rt }),
        });
        if (v.status !== 200) {
          hozzaferes = null;
          return false;
        }
        const eredmeny = (await v.json()) as { accessToken: string; accessTokenExpiresAt: string };
        hozzaferesBeallit(eredmeny.accessToken, eredmeny.accessTokenExpiresAt);
        await kezelo?.ujMunkamenet(eredmeny);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (frissites = null), 0);
      }
    })();
  }
  return frissites;
}

function kerelemAzonosito() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function hibaBol(v: Valasz): Promise<ApiHiba> {
  let test: Record<string, unknown> | null = null;
  try {
    test = (await v.json()) as Record<string, unknown>;
  } catch {
    /* nem JSON */
  }
  const e = (test?.error ?? {}) as { code?: string; message?: string; fields?: Record<string, string>; feature?: string };
  const uzenet =
    e.message ||
    (v.status === 429
      ? 'Most túl sok próbálkozás volt. Várj egy kicsit, és próbáld újra.'
      : v.status >= 500
        ? 'Valami elromlott nálunk. Próbáld újra pár perc múlva.'
        : 'Nem sikerült. Próbáld újra.');
  const data = { ...(test ?? {}) };
  delete data.error;
  // SPEC §26.5: a 403 'locked_until_active' megmondja, melyik funkció zárt.
  if (e.feature) data.feature = e.feature;
  const retry = v.fejlec('Retry-After');
  if (retry) data.retryAfter = Number(retry);
  return new ApiHiba(v.status, e.code || (v.status === 404 ? 'not_found' : 'internal'), uzenet, e.fields, data);
}

export interface KeresOpciok {
  auth?: boolean; // alapból igen
  nyers?: boolean; // Valasz-t ad vissza (fájlletöltés)
}

async function kuld(method: string, ut: string, body: unknown, opt: KeresOpciok, ujra = true): Promise<Valasz> {
  await mintaSzallito();
  const auth = opt.auth !== false;
  if (auth && hozzaferes && hozzaferes.lejar - Date.now() < 30_000) await frissit();
  // X-Kezjegy: our own requests (the cookie CSRF guard on /auth/* checks it; harmless elsewhere).
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Request-Id': kerelemAzonosito(), 'X-Kezjegy': '1' };
  let test: string | FormData | undefined;
  if (body instanceof FormData) test = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    test = JSON.stringify(body);
  }
  if (auth && hozzaferes) headers.Authorization = `Bearer ${hozzaferes.token}`;
  let v: Valasz;
  try {
    v = await szallito({ method, url: ut, headers, body: test });
  } catch {
    throw new ApiHiba(0, 'halozat', 'Nem érjük el a szervert. Nézd meg, van-e internet, és próbáld újra.');
  }
  if (v.status === 401 && auth && ujra) {
    const h = await hibaBol(v);
    if (h.code === 'unauthenticated' && (await frissit())) return kuld(method, ut, body, opt, false);
    if (h.code === 'unauthenticated') kezelo?.kijelentkezett();
    throw h;
  }
  if (v.status >= 400) throw await hibaBol(v);
  return v;
}

export async function api<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', ut: string, body?: unknown, opt: KeresOpciok = {}): Promise<T> {
  const v = await kuld(method, ut, body, opt);
  if (v.status === 204 || v.status === 202) {
    try {
      return (await v.json()) as T;
    } catch {
      return undefined as T;
    }
  }
  return (await v.json()) as T;
}

export const get = <T>(ut: string, opt?: KeresOpciok) => api<T>('GET', ut, undefined, opt);
export const post = <T>(ut: string, body?: unknown, opt?: KeresOpciok) => api<T>('POST', ut, body ?? {}, opt);
export const put = <T>(ut: string, body?: unknown) => api<T>('PUT', ut, body ?? {});
export const patch = <T>(ut: string, body?: unknown) => api<T>('PATCH', ut, body ?? {});
export const del = <T>(ut: string) => api<T>('DELETE', ut);

export async function nyers(method: 'GET' | 'POST', ut: string): Promise<Valasz> {
  return kuld(method, ut, undefined, { nyers: true });
}

// ---------- feltöltés folyamatjelzéssel (XHR: a fetch nem ad feltöltési folyamatot) ----------
export function feltolt<T>(ut: string, form: FormData, folyamat?: (arany: number) => void): Promise<T> {
  if (MINTA_MOD) {
    return (async () => {
      await mintaSzallito();
      for (const a of [0.2, 0.55, 0.9]) {
        folyamat?.(a);
        await new Promise((r) => setTimeout(r, 120));
      }
      folyamat?.(1);
      return api<T>('POST', ut, form);
    })();
  }
  const egyszer = (masodszor: boolean): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', API_URL + ut);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('X-Request-Id', kerelemAzonosito());
      xhr.setRequestHeader('X-Kezjegy', '1');
      if (hozzaferes) xhr.setRequestHeader('Authorization', `Bearer ${hozzaferes.token}`);
      if (Platform.OS === 'web') xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && folyamat) folyamat(e.loaded / e.total);
      };
      xhr.onerror = () => reject(new ApiHiba(0, 'halozat', 'Megszakadt a feltöltés. Nézd meg az internetet, és próbáld újra.'));
      xhr.onload = async () => {
        const v: Valasz = {
          status: xhr.status,
          fejlec: (n) => xhr.getResponseHeader(n),
          json: async () => JSON.parse(xhr.responseText || 'null'),
          blob: async () => new Blob([xhr.response]),
        };
        if (xhr.status === 401 && !masodszor && (await frissit())) {
          egyszer(true).then(resolve, reject);
          return;
        }
        if (xhr.status >= 400) {
          const h = await hibaBol(v);
          // The session is gone (revoked on another device, refresh failed): log out like every other call does.
          if (h.status === 401 && h.code === 'unauthenticated') kezelo?.kijelentkezett();
          reject(h);
        } else resolve((await v.json()) as T);
      };
      xhr.send(form);
    });
  return egyszer(false);
}

/** Az API által adott (esetleg relatív) fájllinket abszolút címmé alakítja. */
export function abszolutUrl(url: string): string {
  if (/^(https?:|data:|blob:|file:)/.test(url) || typeof url !== 'string') return url;
  if (Platform.OS === 'web') return url;
  const origin = /^(https?:\/\/[^/]+)/.exec(API_URL)?.[1] ?? '';
  return origin + url;
}
