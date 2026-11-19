// Űrlap-ellenőrzők (SPEC §19.1). Függőség nélkül, a node:test is futtatja.
// A szerver ugyanezt ellenőrzi; itt csak azért, hogy a hibát rögtön, magyarul lásd.

/** Adószám: 12345678-1-23, a törzsszám 8. jegye ellenőrző szám. */
export function adoszamHiba(ertek: string): string | null {
  const s = ertek.trim();
  if (!s) return 'Írd be az adószámodat.';
  const m = /^(\d{8})-?([1-5])-?(\d{2})$/.exec(s);
  if (!m) return 'Így néz ki: 12345678-1-23.';
  const d = m[1].split('').map(Number);
  const suly = [9, 7, 3, 1, 9, 7, 3];
  const osszeg = suly.reduce((a, w, i) => a + w * d[i], 0);
  const ell = (10 - (osszeg % 10)) % 10;
  if (ell !== d[7]) return 'Ez az adószám nem létezhet. Nézd meg még egyszer.';
  return null;
}
/** Adószám egységes alakra: 12345678-1-23. */
export function adoszamFormaz(ertek: string): string {
  const d = ertek.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 8) return d;
  if (d.length === 9) return `${d.slice(0, 8)}-${d.slice(8)}`;
  return `${d.slice(0, 8)}-${d.slice(8, 9)}-${d.slice(9)}`;
}

/** Adóazonosító jel: 10 jegy, 8-cal kezdődik, a 10. jegy = (Σ i·dᵢ, i=1..9) mod 11 (nem lehet 10). */
export function adoazonositoHiba(ertek: string): string | null {
  const s = ertek.replace(/\s/g, '');
  if (!s) return 'Írd be az adóazonosító jeledet.';
  if (!/^\d{10}$/.test(s)) return '10 számjegy, az adóigazolványodon találod.';
  if (s[0] !== '8') return 'Az adóazonosító jel 8-cal kezdődik.';
  const d = s.split('').map(Number);
  let osszeg = 0;
  for (let i = 0; i < 9; i++) osszeg += (i + 1) * d[i];
  const ell = osszeg % 11;
  if (ell === 10 || ell !== d[9]) return 'Ez az adóazonosító jel nem létezhet. Nézd meg még egyszer.';
  return null;
}

export function emailHiba(ertek: string): string | null {
  const s = ertek.trim();
  if (!s) return 'Írd be az e-mail-címedet.';
  if (s.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return 'Ez nem tűnik e-mail-címnek.';
  return null;
}

/** Jelszó: legalább 10, legfeljebb 128 karakter, nem lehet az e-mail-cím (SPEC §4.1). */
export function jelszoHiba(jelszo: string, email?: string): string | null {
  if (jelszo.length < 10) return 'Legalább 10 karakter legyen.';
  if (jelszo.length > 128) return 'Legfeljebb 128 karakter lehet.';
  if (email && jelszo.trim().toLowerCase() === email.trim().toLowerCase()) return 'Ne az e-mail-címed legyen a jelszavad.';
  return null;
}

/** Jelszóerősség 0–3 és szóban (a szerver a gyakori jelszavakat is elutasítja). */
export function jelszoEro(jelszo: string): { pont: 0 | 1 | 2 | 3; szo: string } {
  if (jelszo.length < 10) return { pont: 0, szo: 'Még rövid' };
  let p = 1;
  const fajtak = [/[a-záéíóöőúüű]/, /[A-ZÁÉÍÓÖŐÚÜŰ]/, /\d/, /[^\wáéíóöőúüűÁÉÍÓÖŐÚÜŰ]/].filter((r) => r.test(jelszo)).length;
  if (jelszo.length >= 14 || fajtak >= 3) p = 2;
  if (jelszo.length >= 16 && fajtak >= 3) p = 3;
  return { pont: p as 1 | 2 | 3, szo: p === 1 ? 'Elfogadható' : p === 2 ? 'Jó' : 'Erős' };
}

export function iranyitoszamHiba(ertek: string): string | null {
  return /^[1-9]\d{3}$/.test(ertek.trim()) ? null : '4 számjegy, például 1136.';
}

/** Magyar telefonszám, nem kötelező: +36 20 123 4567 vagy 06 20 123 4567. */
export function telefonHiba(ertek: string): string | null {
  const s = ertek.replace(/[\s()-]/g, '');
  if (!s) return null;
  return /^(\+36|06)\d{8,9}$/.test(s) ? null : 'Így írd: +36 20 123 4567.';
}

export function kodHiba(ertek: string): string | null {
  return /^\d{6}$/.test(ertek.trim()) ? null : 'A kód 6 számjegy.';
}

/** A magyar írásmódot is elfogadjuk: „2023. 03. 01.”, „2023.3.1”, „2023 03 01” → „2023-03-01”. */
export function datumNormal(ertek: string): string {
  const m = /^\s*(\d{4})\s*[-./ ]\s*(\d{1,2})\s*[-./ ]\s*(\d{1,2})\s*\.?\s*$/.exec(ertek);
  if (!m) return ertek.trim();
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
}

/** Létező dátum, ÉÉÉÉ-HH-NN vagy ÉÉÉÉ. HH. NN. formában. */
export function datumHiba(ertek: string): string | null {
  if (!ertek.trim()) return 'Add meg a dátumot.';
  const n = datumNormal(ertek);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(n)) return 'Év, hónap, nap legyen, pl. 2019-03-01.';
  const d = new Date(n + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== n) return 'Ilyen nap nincs.';
  return null;
}

/** Új vállalkozás adószáma: érvényes, és az ÁFA-kód (középső jegy) 1 = alanyi adómentes (SPEC §26.1.5). */
export function adoszamAfaMentesHiba(ertek: string): string | null {
  const h = adoszamHiba(ertek);
  if (h) return h;
  const kozep = adoszamFormaz(ertek).split('-')[1];
  return kozep === '1' ? null : 'Ez az adószám nem ÁFA-mentes vállalkozásé. Nézd meg még egyszer, vagy írj nekünk.';
}
