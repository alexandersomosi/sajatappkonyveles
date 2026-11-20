// Képernyők közötti átadás MEMÓRIÁBAN (nem az URL-ben): az e-mail-cím és a 2FA belépési token ne kerüljön a
// böngésző előzményeibe, szinkronizált előzményekbe vagy megosztott linkbe. Újratöltés után üres: a képernyők
// ilyenkor visszaküldenek az előző lépésre, vagy bekérik az e-mail-címet.
let mfaToken: string | null = null;
let mfaIdo = 0;
let jelszoEmail: string | null = null;
let regEmail: string | null = null;

const MFA_ELET_MS = 5 * 60_000;

export function mfaBeallit(t: string): void {
  mfaToken = t;
  mfaIdo = Date.now();
}

export function mfaOlvas(): string | null {
  if (mfaToken && Date.now() - mfaIdo > MFA_ELET_MS) mfaToken = null;
  return mfaToken;
}

export function mfaTorol(): void {
  mfaToken = null;
}

export function jelszoEmailBeallit(e: string | null): void {
  jelszoEmail = e?.trim() || null;
}

export function jelszoEmailOlvas(): string {
  return jelszoEmail ?? '';
}

/** k7b: the address of a sign-up waiting for its code (regisztráció → postafiók). */
export function regEmailBeallit(e: string | null): void {
  regEmail = e?.trim() || null;
}

export function regEmailOlvas(): string {
  return regEmail ?? '';
}
