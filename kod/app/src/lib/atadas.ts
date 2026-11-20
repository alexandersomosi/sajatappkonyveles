// Képernyők közötti átadás MEMÓRIÁBAN (nem az URL-ben): az e-mail-cím és a 2FA belépési token ne kerüljön a
// böngésző előzményeibe, szinkronizált előzményekbe vagy megosztott linkbe. Újratöltés után üres: a képernyők
// ilyenkor visszaküldenek az előző lépésre, vagy bekérik az e-mail-címet. Kivétel: a regisztráció kódra váró címe
// weben a lap sessionStorage-ában is megmarad (k7b, lent).
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

/**
 * k7b: the address of a sign-up waiting for its code (regisztráció → postafiók, or belépés → postafiók when an unfinished
 * sign-up tried to sign in). On the web it is also kept in the tab's sessionStorage – never in the URL or the history –,
 * so a reload of the "Nézd meg a postafiókodat" screen does not lose it (ellenőr 11-20); the tab's closing clears it.
 */
export type RegHonnan = 'regisztracio' | 'belepes';
let regHonnan: RegHonnan = 'regisztracio';
const REG_KULCS = 'kj_reg_varakozo';

function lapTar(): Storage | null {
  try {
    return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
  } catch {
    return null;
  }
}

export function regEmailBeallit(e: string | null, honnan: RegHonnan = 'regisztracio'): void {
  regEmail = e?.trim() || null;
  regHonnan = honnan;
  try {
    const t = lapTar();
    if (!t) return;
    if (regEmail) t.setItem(REG_KULCS, JSON.stringify({ e: regEmail, h: honnan }));
    else t.removeItem(REG_KULCS);
  } catch {
    // private mode / blocked storage: memory only
  }
}

function regBetolt(): void {
  if (regEmail) return;
  try {
    const v = lapTar()?.getItem(REG_KULCS);
    if (!v) return;
    const o = JSON.parse(v) as { e?: unknown; h?: unknown };
    if (typeof o.e === 'string' && o.e) {
      regEmail = o.e;
      regHonnan = o.h === 'belepes' ? 'belepes' : 'regisztracio';
    }
  } catch {
    // unreadable: as if empty
  }
}

export function regEmailOlvas(): string {
  regBetolt();
  return regEmail ?? '';
}

export function regHonnanOlvas(): RegHonnan {
  regBetolt();
  return regHonnan;
}
