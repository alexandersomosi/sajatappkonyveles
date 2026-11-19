// Magyar formázók: pénz, dátum, idő (Europe/Budapest), toldalékok. Függőség nélkül, hogy a node:test is futtassa.
// Ezres tagolás: nem törő szóköz (U+00A0); a keskeny U+202F a Geistből hiányzik (tokens.css megjegyzés).

export const NBSP = ' ';

/** 457380 → "457 380" (nem törő szóközzel). Negatívnál „−” (U+2212). */
export function szam(n: number): string {
  const r = Math.round(n);
  const s = Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return r < 0 ? '−' + s : s;
}

/** 457380 → "457 380 Ft". */
export function forint(n: number): string {
  return `${szam(n)}${NBSP}Ft`;
}

export const HONAPOK = ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'];
export const HONAPOK_ROVID = ['jan.', 'febr.', 'márc.', 'ápr.', 'máj.', 'jún.', 'júl.', 'aug.', 'szept.', 'okt.', 'nov.', 'dec.'];
const NAPOK = ['vasárnap', 'hétfő', 'kedd', 'szerda', 'csütörtök', 'péntek', 'szombat'];
const NAPOK_ON = ['vasárnap', 'hétfőn', 'kedden', 'szerdán', 'csütörtökön', 'pénteken', 'szombaton'];
const NAPOK_IG = ['vasárnapig', 'hétfőig', 'keddig', 'szerdáig', 'csütörtökig', 'péntekig', 'szombatig'];

export const nagybetu = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('hu-HU') + s.slice(1) : s);

/** A hónap napja „-án/-én/-jén” toldalékkal: 1 → "1-jén", 2 → "2-án", 9 → "9-én". */
export function napAnEn(nap: number): string {
  const veg = nap % 10;
  const tizes = Math.floor(nap / 10) % 10;
  if (nap === 1) return '1-jén'; // elsején; a 11, 21, 31 már „-én” (tizenegyedikén)
  if (veg === 1) return `${nap}-én`;
  if (nap === 2) return '2-án'; // másodikán; a 12 és a 22 már „-én” (tizenkettedikén)
  if (veg === 2) return `${nap}-én`;
  if (veg === 0) {
    // 10-én, 20-án, 30-án
    return tizes === 1 ? `${nap}-én` : `${nap}-án`;
  }
  // 3, 6, 8 → -án; 4, 5, 7, 9 → -én (az utolsó számjegy kiejtése szerint)
  return [3, 6, 8].includes(veg) ? `${nap}-án` : `${nap}-én`;
}

// ---------- Europe/Budapest idő (CET/CEST, determinisztikus, Intl nélkül) ----------
function utolsoVasarnap(ev: number, honap0: number): number {
  const utolso = new Date(Date.UTC(ev, honap0 + 1, 0));
  return utolso.getUTCDate() - utolso.getUTCDay();
}
/** Az adott UTC-időpont budapesti eltolása percben (60 vagy 120). */
export function budapestEltolas(d: Date): number {
  const ev = d.getUTCFullYear();
  const kezd = Date.UTC(ev, 2, utolsoVasarnap(ev, 2), 1, 0, 0); // márc. utolsó vasárnap 01:00 UTC
  const veg = Date.UTC(ev, 9, utolsoVasarnap(ev, 9), 1, 0, 0); // okt. utolsó vasárnap 01:00 UTC
  const t = d.getTime();
  return t >= kezd && t < veg ? 120 : 60;
}
export interface Reszek { ev: number; honap: number; nap: number; ora: number; perc: number; hetnap: number }
/** ISO időpont (UTC) vagy 'YYYY-MM-DD' → budapesti naptári részek. */
export function reszek(iso: string): Reszek {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ev, ho, nap] = iso.split('-').map(Number);
    const d = new Date(Date.UTC(ev, ho - 1, nap));
    return { ev, honap: ho, nap, ora: 0, perc: 0, hetnap: d.getUTCDay() };
  }
  const d = new Date(iso);
  const helyi = new Date(d.getTime() + budapestEltolas(d) * 60000);
  return {
    ev: helyi.getUTCFullYear(),
    honap: helyi.getUTCMonth() + 1,
    nap: helyi.getUTCDate(),
    ora: helyi.getUTCHours(),
    perc: helyi.getUTCMinutes(),
    hetnap: helyi.getUTCDay(),
  };
}
/** Budapesti naptári nap 'YYYY-MM-DD'-ként. */
export function budapestNap(iso: string): string {
  const r = reszek(iso);
  return `${r.ev}-${String(r.honap).padStart(2, '0')}-${String(r.nap).padStart(2, '0')}`;
}
/** A mai budapesti nap a megadott pillanatban. */
export function maiNap(most: Date = new Date()): string {
  return budapestNap(most.toISOString());
}
/** Két 'YYYY-MM-DD' nap különbsége napokban (b − a). */
export function napKulonbseg(a: string, b: string): number {
  const ta = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const tb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((tb - ta) / 86400000);
}
export function napHozzaad(nap: string, n: number): string {
  const d = new Date(Date.UTC(+nap.slice(0, 4), +nap.slice(5, 7) - 1, +nap.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

export const ido = (r: Reszek) => `${r.ora}:${String(r.perc).padStart(2, '0')}`;

/** "október 12." */
export function datum(iso: string): string {
  const r = reszek(iso);
  return `${HONAPOK[r.honap - 1]} ${r.nap}.`;
}
/** "2026. október 12." */
export function datumEvvel(iso: string): string {
  const r = reszek(iso);
  return `${r.ev}. ${HONAPOK[r.honap - 1]} ${r.nap}.`;
}
/** "2026. december 18-ig" */
export function datumEvvelIg(iso: string): string {
  const r = reszek(iso);
  return `${r.ev}. ${HONAPOK[r.honap - 1]} ${r.nap}-ig`;
}
/** "2026. december 18-án" */
export function datumEvvelAn(iso: string): string {
  const r = reszek(iso);
  return `${r.ev}. ${HONAPOK[r.honap - 1]} ${napAnEn(r.nap)}`;
}
/** "okt. 9." */
export function datumRovid(iso: string): string {
  const r = reszek(iso);
  return `${HONAPOK_ROVID[r.honap - 1]} ${r.nap}.`;
}
/** "október 12-ig" */
export function datumIg(iso: string): string {
  const r = reszek(iso);
  return `${HONAPOK[r.honap - 1]} ${r.nap}-ig`;
}
/** "október 9-én" */
export function datumAn(iso: string): string {
  const r = reszek(iso);
  return `${HONAPOK[r.honap - 1]} ${napAnEn(r.nap)}`;
}
/** A hónap napja birtokos raggal: 1 → "1-je", 2 → "2-a", 10 → "10-e", 12 → "12-e", 20 → "20-a". */
export function napE(nap: number): string {
  return napAnEn(nap).replace(/-jén$/, '-je').replace(/-án$/, '-a').replace(/-én$/, '-e');
}
/** "október 12-e" – a lejárt határidő mondatához: „A határidő október 12-e volt”. */
export function datumE(iso: string): string {
  const r = reszek(iso);
  return `${HONAPOK[r.honap - 1]} ${napE(r.nap)}`;
}
/** Hónapcím: az idei évben „November”, más évben magyar sorrendben „2027. január”. */
export function honapCim(month: string, ideiEv: string | number): string {
  const nev = HONAPOK[Number(month.slice(5, 7)) - 1] ?? month;
  return month.slice(0, 4) === String(ideiEv) ? nagybetu(nev) : `${month.slice(0, 4)}. ${nev}`;
}
/** "hétfőig" */
export function hetnapIg(iso: string): string {
  return NAPOK_IG[reszek(iso).hetnap];
}
/** "hétfő" */
export function hetnap(iso: string): string {
  return NAPOK[reszek(iso).hetnap];
}
/** "hétfőn" */
export function hetnapOn(iso: string): string {
  return NAPOK_ON[reszek(iso).hetnap];
}
/** "Október 12-ig, hétfőig" (a sáv határideje). */
export function hataridoSav(iso: string): string {
  return `${nagybetu(datumIg(iso))}, ${hetnapIg(iso)}`;
}

/**
 * Viszonylagos, beszélt nyelvi idő a „ma” naphoz képest (a design szavai):
 * ma → "ma", tegnap → "tegnap", az elmúlt 6 napban → "hétfőn", különben "október 2-án".
 */
export function mikor(iso: string, ma: string): string {
  const nap = budapestNap(iso);
  const k = napKulonbseg(nap, ma);
  if (k === 0) return 'ma';
  if (k === 1) return 'tegnap';
  if (k > 1 && k < 7) return hetnapOn(nap);
  return datumAn(nap);
}
/** Mint a mikor(), idővel: "tegnap 20:31", "ma 8:47", "hétfő 9:20", "október 3., 18:40". */
export function mikorIdovel(iso: string, ma: string): string {
  const r = reszek(iso);
  const nap = budapestNap(iso);
  const k = napKulonbseg(nap, ma);
  if (k === 0) return `ma ${ido(r)}`;
  if (k === 1) return `tegnap ${ido(r)}`;
  if (k > 1 && k < 7) return `${hetnap(nap)} ${ido(r)}`;
  return `${datum(nap)}, ${ido(r)}`;
}
/** "Szombat, október 3., 18:40" (idővonal). */
export function teljesIdo(iso: string): string {
  const r = reszek(iso);
  return `${nagybetu(NAPOK[r.hetnap])}, ${HONAPOK[r.honap - 1]} ${r.nap}., ${ido(r)}`;
}

/** "még 3 nap" / "ma jár le" / "lejárt" */
export function hatraVan(napok: number): string {
  if (napok < 0) return 'lejárt';
  if (napok === 0) return 'ma jár le';
  if (napok === 1) return 'holnap';
  return `még ${napok} nap`;
}

const ROMAI = ['I.', 'II.', 'III.', 'IV.'];
/** '2026-Q3' → "III. negyedév" */
export function negyedevNev(periodKey: string): string {
  const m = /Q([1-4])$/.exec(periodKey);
  return m ? `${ROMAI[Number(m[1]) - 1]} negyedév` : periodKey;
}
/** '2026-Q3' → "III. negyedévi" */
export function negyedeviNev(periodKey: string): string {
  const m = /Q([1-4])$/.exec(periodKey);
  return m ? `${ROMAI[Number(m[1]) - 1]} negyedévi` : periodKey;
}

/** '2026-10' → "Október"; melléknévként "októberi". */
export function honapNev(month: string): string {
  return nagybetu(HONAPOK[Number(month.slice(5, 7)) - 1] ?? month);
}
export function honapMelleknev(month: string): string {
  return `${HONAPOK[Number(month.slice(5, 7)) - 1] ?? month}i`;
}
/** Hónap a honapKulcs-tól n-nel eltolva: ('2026-01', -1) → '2025-12'. */
export function honapEltol(month: string, n: number): string {
  const ev = Number(month.slice(0, 4));
  const ho = Number(month.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(ev, ho, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Fájlméret magyarul: 1 536 000 → "1,5 MB". */
export function meret(bajt: number): string {
  if (bajt < 1024) return `${bajt} B`;
  if (bajt < 1024 * 1024) return `${Math.round(bajt / 1024)} kB`;
  return `${(bajt / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Százalék magyar tizedesvesszővel: 0.416 → "41,6%". */
export function szazalek(arany: number, tizedes = 0): string {
  return `${(arany * 100).toFixed(tizedes).replace('.', ',')}%`;
}

/** Határozott névelő: "az októberi", "a novemberi". */
export function nevelo(szo: string): 'a' | 'az' {
  return /^[aáeéiíoóöőuúüű]/i.test(szo.trim()) ? 'az' : 'a';
}

/** Összegek a szövegben (pl. a brand.json „havi 20 000 Ft” mondata): a szám és a Ft nem törhet szét. */
export function nemTor(s: string): string {
  return s.replace(/(\d) (?=\d{3}\b)/g, `$1${NBSP}`).replace(/(\d) Ft\b/g, `$1${NBSP}Ft`);
}

/** Névelő szám előtt a kiejtés szerint, az első számcsoportból: „az 510 471 Ft” (öt…), „az 1 200 Ft” (ezer…),
 *  „az 1 250 000 Ft” (egymillió…), de „a 159 302 Ft” (száz…), „a 12 000 Ft” (tizen…), „a 457 380 Ft”. */
export function neveloSzam(n: number): 'a' | 'az' {
  const s = String(Math.abs(Math.round(n)));
  const csoport = s.slice(0, s.length % 3 || 3);
  return csoport[0] === '5' || csoport === '1' ? 'az' : 'a';
}

const SZAMNEV = ['', 'egy', 'két', 'három', 'négy', 'öt', 'hat', 'hét', 'nyolc', 'kilenc'];
/** „Egy utalás a NAV-nak, egy számlaszámra” / „3 külön utalás a NAV-nak, 3 számlaszámra”.
 *  Több tételnél számjeggyel, mint a jóváhagyott 03-on: így 390 pt-on egy sorban marad (a betűvel írt
 *  „Három … három …” két sorba tört, és a gyorsműveleteket a fülsor alá tolta). */
export function utalasFej(n: number): string {
  if (n <= 1) return 'Egy utalás a NAV-nak, egy számlaszámra';
  return `${n} külön utalás a NAV-nak, ${n} számlaszámra`;
}
/** „Becslés: egy utalás lesz a NAV-nak” / „Becslés: két külön utalás lesz a NAV-nak”. */
export function becslesFej(n: number): string {
  return n <= 1 ? 'Becslés: egy utalás lesz a NAV-nak' : `Becslés: ${SZAMNEV[n] ?? n} külön utalás lesz a NAV-nak`;
}
/** Tárgyesetben: 1 → „Elutaltad”, 2 → „Mindkettőt elutaltad”, 3 → „Mind a hármat elutaltad”. */
export function mindElutaltad(n: number): string {
  if (n <= 1) return 'Elutaltad';
  if (n === 2) return 'Mindkettőt elutaltad';
  const targy: Record<number, string> = { 3: 'hármat', 4: 'négyet', 5: 'ötöt' };
  return `Mind a ${targy[n] ?? `${n} tételt`} elutaltad`;
}
/** A mondat végére: „elutaltad mindkettőt” helyett „elutaltad: mindkettőt” → „…, elutaltad mindkettőt.” */
export function mindTargy(n: number): string {
  if (n <= 1) return 'ezt';
  if (n === 2) return 'mindkettőt';
  const targy: Record<number, string> = { 3: 'mind a hármat', 4: 'mind a négyet', 5: 'mind az ötöt' };
  return targy[n] ?? `mind a ${n} tételt`;
}

/** Részes eset a -ra/-re (onto) alakból: „Bencére” → „Bencének”, „Pálra” → „Pálnak” (azonos tő és hangrend). */
export function dativ(onto: string): string {
  if (onto.endsWith('re')) return onto.slice(0, -2) + 'nek';
  if (onto.endsWith('ra')) return onto.slice(0, -2) + 'nak';
  return onto;
}

/** Video length "1:47": whole seconds rounded DOWN, like the player shows it (never "1:60"; review k3c2). */
export function videoHossz(mp?: number | null): string | null {
  if (!mp || mp <= 0) return null;
  const s = Math.floor(mp);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
