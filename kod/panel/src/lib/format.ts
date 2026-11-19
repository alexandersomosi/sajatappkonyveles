// Hungarian formatting (SPEC §3.5). Money is integer forint; grouping uses U+00A0 (Geist lacks U+202F).
const NBSP = ' ';
const nf = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions);
const TZ = 'Europe/Budapest';

export function szam(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '–';
  return nf.format(Math.round(n)).replace(/[   ]/g, NBSP).replace(/-/g, '−');
}
export function ft(n: number | null | undefined): string {
  if (n === null || n === undefined) return '–';
  return `${szam(n)}${NBSP}Ft`;
}
export function szazalek(ratio: number, digits = 0): string {
  const v = ratio * 100;
  return `${v.toLocaleString('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${NBSP}%`;
}
/** "1 240 000", "1240000", "1.240.000 Ft" → 1240000; null when not a whole number. */
export function parseFt(s: string): number | null {
  const t = s.replace(/[\s  .]|Ft/gi, '').replace('−', '-');
  if (!/^-?\d{1,12}$/.test(t)) return null;
  return Number(t);
}

import { today } from './today';

export const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
export const HONAPOK_ROVID = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
const NAP_IG = ['vasárnapig', 'hétfőig', 'keddig', 'szerdáig', 'csütörtökig', 'péntekig', 'szombatig'];
const NAPOK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];

function parts(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return { y: y!, m: m!, d: d! };
}
export function nagybetu(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
/** "2026-10-12" → "október 12." (with year if different from `ev`) */
export function datum(iso: string | null | undefined, opts: { ev?: boolean; nap?: boolean } = {}): string {
  if (!iso) return '–';
  const { y, m, d } = parts(iso);
  const base = `${HONAPOK[m - 1]} ${d}.`;
  const withYear = opts.ev ? `${y}. ${base}` : base;
  if (opts.nap) {
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return `${withYear}, ${NAPOK[wd]}`;
  }
  return withYear;
}
/** "2026-11-18" → "november 18-ig": the final period of the date is dropped before a suffix. */
export function datumIg(iso: string | null | undefined, opts: { ev?: boolean } = {}): string {
  if (!iso) return '–';
  return `${datum(iso, { ev: opts.ev })}`.replace(/\.$/, '') + '-ig';
}
const HONAP_ROVID = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
/** Tables: "2026-10-12" → "okt. 12." this year, "2025. okt. 12." otherwise (same words as everywhere else, just shorter). */
export function datumRovid(iso: string | null | undefined): string {
  if (!iso) return '–';
  const { y, m, d } = parts(iso);
  const base = `${HONAP_ROVID[m - 1]} ${d}.`;
  return y === Number(today().slice(0, 4)) ? base : `${y}. ${base}`;
}
export function honapNev(month: string): string {
  const { m } = parts(`${month}-01`);
  return nagybetu(HONAPOK[m - 1]!);
}
export function honapEv(month: string): string {
  const { y, m } = parts(`${month}-01`);
  return `${y}. ${HONAPOK[m - 1]}`;
}

const dtf = new Intl.DateTimeFormat('hu-HU', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
function bpParts(ts: string): { date: string; time: string } {
  const p = Object.fromEntries(dtf.formatToParts(new Date(ts)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
/** Budapest calendar date of a timestamp. */
export function bpDate(ts: string): string {
  return bpParts(ts).date;
}
/** "ma 9:02", "tegnap 16:40", "november 12., 10:24" */
export function idopont(ts: string | null | undefined, today: string): string {
  if (!ts) return '–';
  const { date, time } = bpParts(ts);
  const t = time.replace(/^0/, '');
  const diff = napKulonbseg(date, today);
  if (diff === 0) return `ma ${t}`;
  if (diff === -1) return `tegnap ${t}`;
  const { y } = parts(date);
  const { y: ty } = parts(today);
  return `${datum(date, { ev: y !== ty })} ${t}`;
}
export function napKulonbseg(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d)) / 86_400_000);
}
/** "még 3 nap" / "ma" / "holnap" / "2 napja lejárt" */
export function hatridoSzoveg(due: string, today: string): string {
  const d = napKulonbseg(due, today);
  if (d === 0) return 'ma';
  if (d === 1) return 'holnap';
  if (d > 1) return `még ${d} nap`;
  if (d === -1) return 'tegnap lejárt';
  return `${-d} napja lejárt`;
}
export function negyedevNev(periodKey: string): string {
  const m = periodKey.match(/^(\d{4})-Q([1-4])$/);
  if (m) return `${m[1]}. ${['I.', 'II.', 'III.', 'IV.'][Number(m[2]) - 1]} negyedév`;
  const h = periodKey.match(/^(\d{4})-HIPA-([12])$/);
  if (h) return `${h[1]}. iparűzési adóelőleg (${h[2]}. részlet)`;
  const ha = periodKey.match(/^(\d{4})-HIPA$/);
  if (ha) return `${ha[1]}. iparűzési adó, éves bevallás`;
  return periodKey;
}
export function adoazonositoMaszk(v: string | null | undefined): string {
  if (!v) return '–';
  return `${'•'.repeat(Math.max(0, v.length - 3))}${v.slice(-3)}`;
}
export function fajlMeret(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} MB`;
}
/** Design 03: "Október 12-ig, hétfőig" */
export function hataridoMondat(iso: string): string {
  const { y, m, d } = parts(iso);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${nagybetu(HONAPOK[m - 1]!)} ${d}-ig, ${NAP_IG[wd]}`;
}

/** "+36301234567" → "+36 30 123 4567"; Budapest "+3612345678" → "+36 1 234 5678"; anything else unchanged. */
export function telefonFormaz(t: string): string {
  const d = t.replace(/[^\d+]/g, '');
  let m = /^\+36(1)(\d{3})(\d{4})$/.exec(d);
  if (m) return `+36 ${m[1]} ${m[2]} ${m[3]}`;
  m = /^\+36(\d{2})(\d{3})(\d{3,4})$/.exec(d);
  if (m) return `+36 ${m[1]} ${m[2]} ${m[3]}`;
  return t;
}

/** Névelő a következő szóhoz: „az I. negyedév” (első), „a II. negyedév”, „az 5.”, „az e-mail”, „a 2026.” */
export function nevelo(szo: string): 'a' | 'az' {
  const w = szo.trim();
  const romai = /^([IVXLCDM]+)\./.exec(w);
  if (romai) return /^(I|V|L|D|M)$/.test(romai[1]!) ? 'az' : 'a';
  const szam = /^(\d+)/.exec(w);
  if (szam) {
    const n = szam[1]!;
    if (n.startsWith('5')) return 'az';
    return n.startsWith('1') && (n.length === 1 || n.length === 4) ? 'az' : 'a';
  }
  return /^[aáeéiíoóöőuúüű]/i.test(w) ? 'az' : 'a';
}

// Hungarian syllable hyphenation for long words (soft hyphens), so narrow cells break with a visible
// hyphen even where the browser has no Hungarian hyphenation dictionary (CSS hyphens:auto then does nothing).
const MAGANHANGZO = 'aáeéiíoóöőuúüűAÁEÉIÍOÓÖŐUÚÜŰ';
const KETJEGYU = ['dzs', 'cs', 'dz', 'gy', 'ly', 'ny', 'sz', 'ty', 'zs'];
function betuk(szo: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < szo.length; ) {
    const t = KETJEGYU.find((d) => szo.slice(i, i + d.length).toLowerCase() === d);
    const len = t ? t.length : 1;
    out.push(szo.slice(i, i + len));
    i += len;
  }
  return out;
}
// Word parts of the domain's compounds: a break never crosses them wrongly ("jövedelem|igazolás", not "jövedele-mi…").
const SZOTOVEK = [
  'bankszámla', 'számlaszám', 'számla', 'kivonat', 'jövedelem', 'igazolás', 'köztartozás', 'tartozás', 'mentesség', 'bevallás',
  'járulék', 'előleg', 'határidő', 'befizetés', 'fizetés', 'meghatalmazás', 'felhasználó', 'technikai', 'nyilatkozat', 'változás',
  'tevékenység', 'biztosítás', 'hozzájárulás', 'költség', 'bizonylat', 'feltöltés', 'figyelő',
];
export function elvalasztSzo(szo: string, min = 11): string {
  if (szo.length < min || /[^A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]/.test(szo)) return szo;
  const b = betuk(szo);
  const mgh = b.map((x) => x.length === 1 && MAGANHANGZO.includes(x));
  // letter index -> char offset, to place the compound boundaries
  const kezd: number[] = [];
  b.reduce((o, x, i) => ((kezd[i] = o), o + x.length), 0);
  const kicsi = szo.toLowerCase();
  const kotelezo = new Set<number>();
  for (const tov of SZOTOVEK) {
    for (let o = kicsi.indexOf(tov, 1); o > 0; o = kicsi.indexOf(tov, o + 1)) {
      const i = kezd.indexOf(o);
      if (i > 1 && i < b.length - 1) kotelezo.add(i);
    }
  }
  const szotag = new Set<number>();
  let elozo = -1;
  for (let i = 0; i < b.length; i++) {
    if (!mgh[i]) continue;
    if (elozo >= 0) {
      const massalhangzok = i - elozo - 1;
      // one consonant goes to the next syllable; of a cluster, only the last one does; two vowels split
      szotag.add(massalhangzok === 0 ? i : i - 1);
    }
    elozo = i;
  }
  // never a single letter at either end, never a syllable break right next to a compound boundary
  const hatarok = [...new Set([...kotelezo, ...szotag])].sort((x, y) => x - y).filter((i) => {
    if (i < 2 || i > b.length - 2) return false;
    if (kotelezo.has(i)) return true;
    return ![...kotelezo].some((k) => Math.abs(k - i) <= 1);
  });
  const vegso: number[] = [];
  for (const i of hatarok) if (!vegso.length || i - vegso[vegso.length - 1]! >= 2 || kotelezo.has(i)) vegso.push(i);
  const jel = new Set(vegso);
  return b.map((x, i) => (jel.has(i) ? `­${x}` : x)).join('');
}
export function elvalaszt(szoveg: string, min = 11): string {
  return szoveg.replace(/[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű]+/g, (w) => elvalasztSzo(w, min));
}

/**
 * The quarterly contribution return of a year: two-digit year + "58" ("2658" for 2026, "2758" for 2027 – round-2 tax
 * finding 8; the backend/engine side is B4's).
 */
export function jarulekNyomtatvany(ev: number): string {
  return `${String(ev).slice(-2)}58`;
}
