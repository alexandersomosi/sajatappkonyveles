// Hungarian identifiers (SPEC §19.1) and small input helpers.

/** Adószám "12345678-1-23": törzsszám check digit (10 − (9d1+7d2+3d3+d4+9d5+7d6+3d7) mod 10) mod 10. */
export function isValidAdoszam(s: string): boolean {
  const m = /^(\d{8})-([1-5])-(\d{2})$/.exec(s);
  if (!m) return false;
  const t = m[1]!;
  const w = [9, 7, 3, 1, 9, 7, 3];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(t[i]) * w[i]!;
  return (10 - (sum % 10)) % 10 === Number(t[7]);
}

/** Törzsszám (8 digits) check only – used for NAV technical-user tax numbers. */
export function isValidTorzsszam(t: string): boolean {
  return /^\d{8}$/.test(t) && isValidAdoszam(`${t}-1-01`);
}

/** Adóazonosító jel: 10 digits starting with 8, check digit = Σ i·d_i (i = 1..9) mod 11, ≠ 10. */
export function isValidAdoazonositoJel(s: string): boolean {
  if (!/^8\d{9}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += (i + 1) * Number(s[i]);
  const c = sum % 11;
  return c !== 10 && c === Number(s[9]);
}

export function maskAdoazonosito(last3: string | null | undefined): string {
  return last3 ? `•••••••${last3}` : '';
}

export function normalizeEmail(e: string): string {
  return e.trim().toLowerCase();
}

export function isPlausibleEmail(e: string): boolean {
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/** "ka…@demo.kezjegy.test" for demo outbox and admin views. */
export function maskEmail(e: string): string {
  const [local = '', domain = ''] = e.split('@');
  return `${local.slice(0, 2)}…@${domain}`;
}

/** Display names of uploads: no path characters, no control chars, ≤ 120 chars. */
export function sanitizeDisplayName(name: string | undefined | null, fallback = 'fajl'): string {
  const base = String(name ?? '')
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const s = base || fallback;
  return s.length > 120 ? s.slice(0, 120) : s;
}

export function normalizePhone(p: string): string {
  return p.replace(/[^\d+]/g, '');
}

export function isValidPhone(p: string): boolean {
  return /^\+?\d{8,15}$/.test(normalizePhone(p));
}
