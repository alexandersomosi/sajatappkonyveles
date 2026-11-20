// SPEC §31.3 – where the visitor came from, read from the web address the landing link opened (utm_*, hivatkozo,
// erkezes, forras, cel; ad click ids and the consent id only matter when ad measurement is on – the server decides).
// Nothing is stored on the device: the values travel in the address and in the sign-up request only.
// Pure functions (tests/marketing.test.ts); the screens call them with location.search on the web.
import { AD_CLICK_ID_PARAMS, SOURCE_PARAM_CONSENT, SOURCE_PARAM_LANDING, SOURCE_PARAM_REFERRER, UTM_KEYS, utmFromSearch, type Utm } from '../_shared/marketing';

export interface ForrasAdat {
  utm?: Utm;
  forras?: { hivatkozo?: string; erkezes?: string };
  entry?: { forras?: string; cel?: 'visszahivas' };
  hirdetes?: { hid?: string; gclid?: string; gbraid?: string; wbraid?: string; fbclid?: string };
}

const tiszta = (v: string | null, max: number, minta: RegExp): string | undefined => {
  const t = (v ?? '').trim().slice(0, max);
  return t && minta.test(t) ? t : undefined;
};

/** Everything the sign-up sends about the source; empty parts are left out (an old server ignores them anyway). */
export function forrasAdat(search: string): ForrasAdat {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return {};
  }
  const out: ForrasAdat = {};
  const utm = utmFromSearch(search);
  if (Object.keys(utm).length) out.utm = utm;
  const hivatkozo = tiszta(q.get(SOURCE_PARAM_REFERRER), 253, /^[A-Za-z0-9.:/-]+$/);
  const erkezes = tiszta(q.get(SOURCE_PARAM_LANDING), 200, /^\/[A-Za-z0-9/_.\-~%]*$/);
  if (hivatkozo || erkezes) out.forras = { ...(hivatkozo ? { hivatkozo } : {}), ...(erkezes ? { erkezes } : {}) };
  const belepo = tiszta(q.get('forras'), 40, /^[a-z0-9_-]+$/);
  const cel = q.get('cel') === 'visszahivas' ? ('visszahivas' as const) : undefined;
  if (belepo || cel) out.entry = { ...(belepo ? { forras: belepo } : {}), ...(cel ? { cel } : {}) };
  const h: NonNullable<ForrasAdat['hirdetes']> = {};
  const hid = tiszta(q.get(SOURCE_PARAM_CONSENT), 36, /^[0-9a-f-]{36}$/i);
  if (hid) h.hid = hid;
  for (const k of AD_CLICK_ID_PARAMS) {
    const v = tiszta(q.get(k), 500, /^[A-Za-z0-9_.\-~]+$/);
    if (v) h[k] = v;
  }
  if (Object.keys(h).length) out.hirdetes = h;
  return out;
}

/** The parameters to keep when one auth screen sends the visitor to the other (belépés → regisztráció). */
export function forrasTovabb(search: string): string {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(search);
  } catch {
    return '';
  }
  const keep = new URLSearchParams();
  const kulcsok = [...UTM_KEYS.map((k) => `utm_${k}`), SOURCE_PARAM_REFERRER, SOURCE_PARAM_LANDING, SOURCE_PARAM_CONSENT, 'forras', 'cel', 'ref', ...AD_CLICK_ID_PARAMS];
  for (const k of kulcsok) {
    const v = q.get(k);
    if (v) keep.set(k, v.slice(0, 500));
  }
  const s = keep.toString();
  return s ? `?${s}` : '';
}

/** location.search on the web, '' in the native app (an APK sign-up without a link = "Közvetlen"). */
export function webKereses(): string {
  try {
    return typeof location !== 'undefined' && typeof location.search === 'string' ? location.search : '';
  } catch {
    return '';
  }
}
