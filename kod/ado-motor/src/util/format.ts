// Hungarian number / text formatting for the engine's own sentences. Deterministic (does not
// depend on the host's ICU data): digits grouped by 3 with a no-break space, "Ft" after a
// no-break space – the same look as Intl.NumberFormat('hu-HU') in the apps (SPEC §3.5).

export const NBSP = ' ';
export const MINUS = '−';
export const EN_DASH = '–';

export function formatNumber(n: number): string {
  const neg = n < 0;
  const digits = String(Math.abs(Math.trunc(n)));
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += NBSP;
    out += digits[i];
  }
  return (neg ? MINUS : '') + out;
}

/** "1 880 200 Ft" (no-break spaces). */
export function formatHuf(n: number): string {
  return `${formatNumber(n)}${NBSP}Ft`;
}

/** Rounded amount for projections ("kb. …"): 8 910 761 → "8,9 millió Ft", 456 789 → "457 ezer Ft". */
export function formatHufApprox(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) {
    const m = (Math.round(n / 100_000) / 10).toFixed(1).replace(/\.0$/, '').replace('.', ',');
    return `${m}${NBSP}millió${NBSP}Ft`;
  }
  if (a >= 100_000) return `${formatNumber(Math.round(n / 1000))}${NBSP}ezer${NBSP}Ft`;
  return formatHuf(n);
}

/** Percent from a permille integer: 185 → "18,5%", 150 → "15%". */
export function formatPermilleAsPct(permille: number): string {
  const whole = Math.trunc(permille / 10);
  const frac = Math.abs(permille % 10);
  return frac === 0 ? `${whole}%` : `${whole},${frac}%`;
}

/** Percent with at most one decimal, Hungarian decimal comma: 0.81575 → "81,6%". */
export function formatRatioPct(r: number): string {
  const tenths = Math.round(r * 1000);
  return formatPermilleAsPct(tenths);
}

/** Number with Hungarian decimal comma and at most 2 decimals: 2 → "2", 1.5 → "1,5". */
export function formatDecimal(x: number): string {
  const s = (Math.round(x * 100) / 100).toString();
  return s.replace('.', ',');
}

export const MONTH_NAMES = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
] as const;

/** "-ban/-ben" form: "áprilisban". */
export const MONTH_INESSIVE = [
  'januárban',
  'februárban',
  'márciusban',
  'áprilisban',
  'májusban',
  'júniusban',
  'júliusban',
  'augusztusban',
  'szeptemberben',
  'októberben',
  'novemberben',
  'decemberben',
] as const;

export function monthName(m: number): string {
  return MONTH_NAMES[m - 1] ?? String(m);
}

export function monthInessive(m: number): string {
  return MONTH_INESSIVE[m - 1] ?? String(m);
}

/** Adjective form: "szeptemberi". */
export function monthAdjective(m: number): string {
  return `${monthName(m)}i`;
}

export function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toLocaleUpperCase('hu') + s.slice(1);
}

/** "július–szeptember" or "július" for a one-month range. */
export function monthRange(from: number, to: number): string {
  return from === to ? monthName(from) : `${monthName(from)}${EN_DASH}${monthName(to)}`;
}

/** "július–szeptemberi" or "júliusi". */
export function monthRangeAdjective(from: number, to: number): string {
  return from === to ? monthAdjective(from) : `${monthName(from)}${EN_DASH}${monthAdjective(to)}`;
}

const ROMAN = ['I', 'II', 'III', 'IV'] as const;

/** "III. negyedév" */
export function quarterLabel(q: number): string {
  return `${ROMAN[q - 1] ?? q}. negyedév`;
}

/** Year as an adjective with the right vowel harmony: 2026 → "2026-os", 2027 → "2027-es", 2030 → "2030-as". */
export function yearAdjective(year: number): string {
  const ones = ['', 'es', 'es', 'as', 'es', 'ös', 'os', 'es', 'as', 'es'];
  const tens = ['', 'es', 'as', 'as', 'es', 'es', 'as', 'es', 'as', 'es'];
  const d = year % 10;
  const t = Math.floor(year / 10) % 10;
  let suffix: string;
  if (d !== 0) suffix = ones[d]!;
  else if (t !== 0) suffix = tens[t]!;
  else suffix = year % 1000 === 0 ? 'es' : 'as'; // 2000 (kétezer) → -es, 2100 (száz) → -as
  return `${year}-${suffix}`;
}

/** Hungarian list: "a, b és c". */
export function joinHu(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} és ${items[items.length - 1]}`;
}
