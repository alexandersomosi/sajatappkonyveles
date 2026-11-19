// Tevékenység-kereső az új vállalkozás adatlapján (SPEC §26.1.3): ékezet nélkül is talál („foto” → „Fotózás,
// képszerkesztés”), a címke és a kulcsszavak alapján, legfeljebb 8 találat. A költséghányad-javaslat csak tájékoztató:
// a szerver (ado-motor) számolja, ez a tartalék ugyanazzal a szabállyal (2026: 45 / 80 / 90%, ellenőrizendőnél nincs szám).
import { BUSINESS_ACTIVITIES, type BusinessActivity } from '../_shared/bekotes';
import type { WorkKind } from '../_shared/enums';
import { szam } from './format';

export const ekezetNelkul = (s: string) => s.toLocaleLowerCase('hu-HU').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

export function tevekenysegKeres(kerdes: string, max = 8): BusinessActivity[] {
  const q = ekezetNelkul(kerdes);
  if (!q) return [];
  const szavak = q.split(' ');
  const pont = (a: BusinessActivity) => {
    const cim = ekezetNelkul(a.label);
    const kulcs = a.keywords.map(ekezetNelkul);
    let p = 0;
    for (const sz of szavak) {
      if (cim.startsWith(sz)) p += 6;
      else if (cim.split(/[ ,]+/).some((w) => w.startsWith(sz))) p += 4;
      else if (cim.includes(sz)) p += 2;
      else if (kulcs.some((k) => k.startsWith(sz))) p += 3;
      else if (kulcs.some((k) => k.includes(sz))) p += 1;
      else return 0; // minden szónak illeszkednie kell valahol
    }
    return p;
  };
  return BUSINESS_ACTIVITIES.map((a) => ({ a, p: pont(a) }))
    .filter((x) => x.p > 0)
    .sort((x, y) => y.p - x.p || x.a.label.localeCompare(y.a.label, 'hu'))
    .slice(0, max)
    .map((x) => x.a);
}

const ARANY = { altalanos: 45, lista80: 80, kiskereskedelem: 90 } as const;

/** Tartalék-mondat a költséghányadról (ha a szerver még nem adott hints.costRatioText-et). */
export function koltseghanyadSzoveg(fo: { key: string | null } | undefined, fn: string): string | null {
  if (!fo) return null;
  const a = fo.key ? BUSINESS_ACTIVITIES.find((x) => x.key === fo.key) : undefined;
  if (!a || a.costClass === 'ellenorizendo') return `A költséghányadot ${fn} mondja meg.`;
  // The 2027 sentence (45 → 50%) is only about the general class; 80/90% stay.
  if (a.costClass !== 'altalanos') return `A tevékenységed alapján a költséghányadod várhatóan ${ARANY[a.costClass]}%. ${fn} megerősíti.`;
  return `A tevékenységed alapján a költséghányadod várhatóan ${ARANY[a.costClass]}%. 2027-től az általános költséghányad 50%. ${fn} megerősíti.`;
}

/** 2026: havi minimálbér 322 800 Ft; TB 18,5% + szocho 13% → 101 682 Ft (SPEC §26.1.3). */
export const MIN_JARULEK_2026 = Math.round(322_800 * 0.185) + Math.round(322_800 * 0.13);

/** 2026: garantált bérminimum 373 200 Ft; 31,5% → 117 558 Ft – ha a munkához szakképzettség kell (k3_kor2 adó 7). */
export const MIN_JARULEK_GARANTALT_2026 = Math.round(373_200 * 0.185) + Math.round(373_200 * 0.13);

export function jarulekSzoveg(w: WorkKind | null, kepesites = false): string | null {
  if (!w) return null;
  if (w === 'fofoglalkozas')
    return kepesites
      ? `Főállásban akkor is fizetsz havonta legalább ${szam(MIN_JARULEK_2026)} Ft járulékot (TB + szocho), ha kevés a bevételed. Ha a munkádhoz szakképzettség kell (például fodrász, kozmetikus), ez ${szam(MIN_JARULEK_GARANTALT_2026)} Ft. Negyedévente fizeted.`
      : `Főállásban akkor is fizetsz havonta legalább ${szam(MIN_JARULEK_2026)} Ft járulékot (TB + szocho), ha kevés a bevételed. Negyedévente fizeted.`;
  if (w === 'nyugdij_mellett') return 'Saját jogú nyugdíjasként nem fizetsz TB-járulékot és szochót, csak SZJA-t a tényleges jövedelmed után.';
  return 'Mellékállásban nincs legkisebb járulék: csak a tényleges jövedelmed után fizetsz.';
}
