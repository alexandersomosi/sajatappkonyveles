// Hungarian IBAN from a GIRO account number (ISO 13616 mod-97). Used to cross-check the IBANs
// published by NAV that are stored in the rules.

/** "10032000-06056353" → "HU16100320000605635300000000". 16-digit numbers are padded with 8 zeros. */
export function hungarianIban(accountNumber: string): string {
  const digits = accountNumber.replace(/[\s-]/g, '');
  if (!/^\d{16}(\d{8})?$/.test(digits)) throw new RangeError(`not a Hungarian account number: ${accountNumber}`);
  const bban = digits.padEnd(24, '0');
  // Move "HU00" to the end, letters → numbers (H = 17, U = 30), then 98 − (n mod 97).
  const numeric = `${bban}1730` + '00';
  let rem = 0;
  for (const ch of numeric) rem = (rem * 10 + Number(ch)) % 97;
  const check = 98 - rem;
  return `HU${String(check).padStart(2, '0')}${bban}`;
}

/** True when the IBAN's mod-97 check passes. */
export function isValidIban(iban: string): boolean {
  const s = iban.replace(/\s/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const code = ch.charCodeAt(0);
    const part = code >= 65 && code <= 90 ? String(code - 55) : ch;
    for (const c of part) rem = (rem * 10 + Number(c)) % 97;
  }
  return rem === 1;
}
