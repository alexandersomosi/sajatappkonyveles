// Validators used in panel forms (SPEC §19.1, §12.7, §16).

/** Adószám "12345678-1-23": törzsszám check digit = (10 − (9d1+7d2+3d3+d4+9d5+7d6+3d7) mod 10) mod 10. */
export function adoszamOk(v: string): boolean {
  const m = v.trim().match(/^(\d{8})-([1-5])-(\d{2})$/);
  if (!m) return false;
  return torzsszamOk(m[1]!);
}
export function torzsszamOk(t: string): boolean {
  if (!/^\d{8}$/.test(t)) return false;
  const d = t.split('').map(Number);
  const w = [9, 7, 3, 1, 9, 7, 3];
  const s = w.reduce((acc, wi, i) => acc + wi * d[i]!, 0);
  return (10 - (s % 10)) % 10 === d[7];
}
/** Adóazonosító jel: 10 digits, starts with 8, check digit = Σ i·d_i (i=1..9) mod 11 (≠ 10). */
export function adoazonositoOk(v: string): boolean {
  if (!/^8\d{9}$/.test(v)) return false;
  const d = v.split('').map(Number);
  let s = 0;
  for (let i = 0; i < 9; i++) s += (i + 1) * d[i]!;
  const c = s % 11;
  return c !== 10 && c === d[9];
}
export function emailOk(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
/** Placeholders like {firstName} used in a text must all be allowed. Returns the unknown ones. */
export function ismeretlenHelyorzok(text: string, allowed: string[]): string[] {
  const used = new Set(Array.from(text.matchAll(/\{([a-zA-Z0-9_.]+)\}/g), (m) => m[1]!));
  return Array.from(used).filter((p) => !allowed.includes(p));
}
/** Referral code: A–Z0–9, 6–12 (SPEC §5.11). */
export function ajanloKodOk(v: string): boolean {
  return /^[A-Z0-9]{6,12}$/.test(v);
}
// HEIC-et a szerver nem tud megnyitni (415), ezért itt sem ajánljuk fel.
export const FELTOLTHETO_TIPUSOK = ['image/jpeg', 'image/png', 'application/pdf'];
export const MAX_FAJL_MERET = 25 * 1024 * 1024;
/** Returns a Hungarian error message, or null when the file can be uploaded. */
export function fajlHiba(f: File): string | null {
  const okType = FELTOLTHETO_TIPUSOK.includes(f.type) || /\.(jpe?g|png|pdf)$/i.test(f.name);
  if (!okType) return `${f.name}: csak PDF, JPG vagy PNG tölthető fel.`;
  if (f.size > MAX_FAJL_MERET) return `${f.name}: túl nagy (legfeljebb 25 MB).`;
  if (f.size === 0) return `${f.name}: üres fájl.`;
  return null;
}
