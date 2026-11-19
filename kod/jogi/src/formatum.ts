// Magyar dátum- és pénzformázás a jogi szövegekhez (SPEC §3.5: Europe/Budapest, egész forint).

const HONAPOK = [
  'január', 'február', 'március', 'április', 'május', 'június',
  'július', 'augusztus', 'szeptember', 'október', 'november', 'december',
] as const;

/** Nem törő szóköz: a Geistben megvan (U+00A0), a keskeny U+202F nincs (tokens.css). */
export const NBSP = ' ';

/** "YYYY-MM-DD" vagy Date → { ev, ho, nap } Europe/Budapest szerint. */
function reszek(d: Date | string): { ev: number; ho: number; nap: number } {
  if (typeof d === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (m) return { ev: Number(m[1]), ho: Number(m[2]), nap: Number(m[3]) };
    d = new Date(d);
  }
  if (Number.isNaN(d.getTime())) throw new Error('Érvénytelen dátum');
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit' });
  const [ev, ho, nap] = f.format(d).split('-').map(Number) as [number, number, number];
  return { ev, ho, nap };
}

/** "2026. november 18." */
export function datumHu(d: Date | string): string {
  const { ev, ho, nap } = reszek(d);
  return `${ev}. ${HONAPOK[ho - 1]} ${nap}.`;
}

/** "2026. november 18-ig" – a záró pont helyére kerül a rag (a szám után kötőjellel). */
export function datumIg(d: Date | string): string {
  const { ev, ho, nap } = reszek(d);
  return `${ev}. ${HONAPOK[ho - 1]} ${nap}-ig`;
}

/** "2026. január 8., 10:12" Europe/Budapest – időpontokhoz (elfogadás). */
export function idopontHu(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) throw new Error('Érvénytelen időpont');
  const ido = new Intl.DateTimeFormat('hu-HU', { timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
  return `${datumHu(date)}, ${ido}`;
}

/** 20000 → "20 000 Ft" (nem törő szóközökkel, hogy sortöréskor ne szakadjon szét). */
export function forint(osszeg: number): string {
  if (!Number.isInteger(osszeg)) throw new Error('A forintösszeg egész szám kell legyen');
  const negativ = osszeg < 0;
  const s = String(Math.abs(osszeg)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${negativ ? '-' : ''}${s}${NBSP}Ft`;
}
