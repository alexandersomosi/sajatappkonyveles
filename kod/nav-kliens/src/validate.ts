// Input checks done before anything is sent (so typos never reach NAV and never burn a requestId).
import { NavError } from './errors.js';
import type { NavCredentials, NavSoftware } from './types.js';

/** Hungarian törzsszám check digit: (10 − (9d1+7d2+3d3+d4+9d5+7d6+3d7) mod 10) mod 10. */
export function taxNumberCheckDigit(first7: string): number {
  const w = [9, 7, 3, 1, 9, 7, 3];
  let sum = 0;
  for (let i = 0; i < 7; i++) sum += Number(first7[i]) * (w[i] ?? 0);
  return (10 - (sum % 10)) % 10;
}

/** true for an 8-digit törzsszám with a correct check digit. */
export function isValidTaxNumber(taxNumber8: string): boolean {
  if (!/^\d{8}$/.test(taxNumber8)) return false;
  return taxNumberCheckDigit(taxNumber8.slice(0, 7)) === Number(taxNumber8[7]);
}

/**
 * "68801234", "68801234-1-41" or "68801234141" → "68801234".
 * Throws INVALID_INPUT if no 8-digit törzsszám with a valid check digit can be found.
 */
export function normalizeTaxNumber(input: string, field = 'taxNumber'): string {
  const t = input.trim();
  const m = /^(\d{8})(?:-?(\d)-?(\d{2}))?$/.exec(t);
  const base = m?.[1];
  if (!base || !isValidTaxNumber(base)) {
    throw new NavError({
      code: 'INVALID_INPUT',
      messageHu: 'Az adószám formátuma hibás (8 számjegy, pl. 12345676 vagy 12345676-1-41).',
      navMessage: `invalid ${field}`,
    });
  }
  return base;
}

/**
 * Format-only variant for tax numbers that come from NAV itself or are being looked up
 * (queryTaxpayer answers validity on its own): "12345678", "12345678-1-41" → "12345678".
 */
export function taxNumber8(input: string, field = 'taxNumber'): string {
  const m = /^(\d{8})(?:-?\d-?\d{2})?$/.exec(input.trim());
  if (!m?.[1]) {
    throw new NavError({ code: 'INVALID_INPUT', messageHu: 'Az adószám formátuma hibás (8 számjegy).', navMessage: `invalid ${field}` });
  }
  return m[1];
}

export const LOGIN_RE = /^[a-zA-Z0-9]{6,15}$/;
export const SOFTWARE_ID_RE = /^[0-9A-Z-]{18}$/;

function notBlank(v: string | undefined, max: number): boolean {
  return typeof v === 'string' && /\S/.test(v) && [...v].length <= max;
}

export function validateCredentials(c: NavCredentials): NavCredentials {
  if (!LOGIN_RE.test(c.login ?? '')) {
    throw new NavError({
      code: 'INVALID_INPUT',
      messageHu: 'A technikai felhasználó neve 6–15 betű vagy szám lehet, szóköz nélkül.',
      navMessage: 'invalid login format',
    });
  }
  if (typeof c.password !== 'string' || c.password.length === 0) {
    throw new NavError({ code: 'INVALID_INPUT', messageHu: 'Hiányzik a technikai felhasználó jelszava.' });
  }
  if (typeof c.signatureKey !== 'string' || !/\S/.test(c.signatureKey)) {
    throw new NavError({ code: 'INVALID_INPUT', messageHu: 'Hiányzik az XML aláírókulcs.' });
  }
  const taxNumber = normalizeTaxNumber(c.taxNumber);
  const out: NavCredentials = { login: c.login, password: c.password, signatureKey: c.signatureKey.trim(), taxNumber };
  if (c.exchangeKey !== undefined) out.exchangeKey = c.exchangeKey;
  return out;
}

export function validateSoftware(s: NavSoftware): NavSoftware {
  const problems: string[] = [];
  if (!SOFTWARE_ID_RE.test(s.softwareId ?? '')) problems.push('softwareId must match [0-9A-Z-]{18}');
  if (!notBlank(s.softwareName, 50)) problems.push('softwareName 1–50 chars');
  if (!notBlank(s.softwareMainVersion, 15)) problems.push('softwareMainVersion 1–15 chars');
  if (!notBlank(s.softwareDevName, 512)) problems.push('softwareDevName 1–512 chars');
  if (!notBlank(s.softwareDevContact, 200)) problems.push('softwareDevContact 1–200 chars');
  if (s.softwareDevCountryCode !== undefined && !/^[A-Z]{2}$/.test(s.softwareDevCountryCode)) {
    problems.push('softwareDevCountryCode must be 2 capital letters');
  }
  if (s.softwareDevTaxNumber !== undefined && !notBlank(s.softwareDevTaxNumber, 50)) {
    problems.push('softwareDevTaxNumber 1–50 chars');
  }
  if (problems.length > 0) {
    throw new NavError({
      code: 'NOT_CONFIGURED',
      messageHu: 'A NAV-kapcsolat szoftveradatai hiányosak (NAV_SOFTWARE_ID, NAV_DEV_…).',
      navMessage: problems.join('; '),
    });
  }
  return s;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(v: string, field: string): void {
  if (!DATE_RE.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) {
    throw new NavError({ code: 'INVALID_INPUT', navMessage: `${field} must be YYYY-MM-DD` });
  }
}

export function assertIsoTimestamp(v: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(v) || Number.isNaN(Date.parse(v))) {
    throw new NavError({ code: 'INVALID_INPUT', navMessage: `${field} must be UTC ISO-8601 (…Z)` });
  }
}

export function assertInvoiceNumber(v: string): void {
  if (typeof v !== 'string' || !/\S/.test(v) || [...v].length > 50) {
    throw new NavError({ code: 'INVALID_INPUT', navMessage: 'invoiceNumber must be 1–50 chars' });
  }
}
