// Money is integer forint everywhere (SPEC §3.5). NAV sends decimals with ≤ 2 fraction digits
// (MonetaryType); we round half away from zero on the decimal STRING, never through floats.
import { NavError } from './errors.js';

const DECIMAL_RE = /^([+-])?(\d+)(?:\.(\d*))?$/;

export function decimalToForint(value: string, field = 'amount'): number {
  const m = DECIMAL_RE.exec(value.trim());
  if (!m) throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: `bad decimal in ${field}` });
  const negative = m[1] === '-';
  const intPart = m[2] ?? '0';
  const frac = m[3] ?? '';
  let n = Number(intPart);
  if (frac.length > 0 && frac.charCodeAt(0) >= 53 /* '5' */) n += 1;
  if (!Number.isSafeInteger(n)) {
    throw new NavError({ code: 'DATA_DECODE_ERROR', navMessage: `amount out of range in ${field}` });
  }
  return negative && n !== 0 ? -n : n;
}

/** Optional variant: undefined/empty → undefined. */
export function optForint(value: string | undefined, field?: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  return decimalToForint(value, field);
}

/** Non-money decimals (exchange rate, quantity, VAT rate). */
export function decimalToNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === '') return undefined;
  const t = value.trim();
  if (!DECIMAL_RE.test(t)) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Integer forint → NAV decimal text ("167000", "-2200000"). */
export function forintToDecimal(n: number): string {
  if (!Number.isSafeInteger(n)) throw new RangeError('forint amount must be a safe integer');
  return String(n);
}
