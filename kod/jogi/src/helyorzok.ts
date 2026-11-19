// A jogi szövegekben használható {{helyőrzők}} jegyzéke (SPEC §21 + a jogi-építő bővítései, §24).
// Minden *.md és az app_szovegek.json csak ezeket használhatja – az `npm run ellenoriz` ezt ellenőrzi.
//
// fajta:
//  - 'marka'   : brand.json (egyetlen hely a terméknévhez és a cégadatokhoz)
//  - 'dok'     : az index.json-ból, automatikusan (verzió, hatályosság, cím)
//  - 'konfig'  : rendszerbeállítás (env); ha a hívó nem adja meg, a `tartalek` érték kerül be
//  - 'ugyfel'  : személyes vagy ügyféladat; hiányzik → címke / üres vonal / hiba (lásd sablon.ts)
//  - 'futasi'  : a hívó adja meg az adott eseményhez (tranzakció, időpont…)

export type HelyorzoFajta = 'marka' | 'dok' | 'konfig' | 'ugyfel' | 'futasi';

export interface HelyorzoLeiras {
  fajta: HelyorzoFajta;
  /** Rövid magyar leírás – a hiányzó adat jelölésére is ([HIÁNYZÓ: …]). */
  cimke: string;
  /** Csak 'konfig': ha a hívó nem ad értéket. */
  tartalek?: string;
  /** Kitalált demóérték a mintákhoz (pdf_minta/). Valódi személyhez nem tartozik. */
  demo?: string;
}

export const HELYORZOK = {
  // márka és cég (brand.json)
  'brand.name': { fajta: 'marka', cimke: 'a szolgáltatás neve' },
  'ceg.nev': { fajta: 'marka', cimke: 'a szolgáltató cég neve' },
  'ceg.szekhely': { fajta: 'marka', cimke: 'a cég székhelye' },
  'ceg.adoszam': { fajta: 'marka', cimke: 'a cég adószáma' },
  'ceg.cegjegyzekszam': { fajta: 'marka', cimke: 'a cég cégjegyzékszáma' },
  'ceg.email': { fajta: 'marka', cimke: 'a cég ügyfélszolgálati e-mail-címe' },
  'ceg.kepviselo': { fajta: 'marka', cimke: 'a cég képviselője (ügyvezető)' },
  'dij.havi_brutto': { fajta: 'marka', cimke: 'a havidíj' },

  // dokumentum (index.json)
  'dok.verzio': { fajta: 'dok', cimke: 'a dokumentum verziója' },
  'dok.hatalyos': { fajta: 'dok', cimke: 'a hatálybalépés napja' },
  'dok.cim': { fajta: 'dok', cimke: 'a dokumentum címe' },

  // rendszerbeállítás
  'szolgaltatas.url': { fajta: 'konfig', cimke: 'a szolgáltatás webcíme', tartalek: '[CÉGADAT: a szolgáltatás webcíme]', demo: 'https://app.45-94-65-74.sslip.io' },
  'elofizetes.alkalom': { fajta: 'konfig', cimke: 'az ismétlődő levonások legnagyobb száma', tartalek: '12' },
  'elofizetes.honapok': { fajta: 'konfig', cimke: 'a kártyás engedély érvényessége hónapban', tartalek: '12' },
  'elofizetes.max_osszeg': { fajta: 'konfig', cimke: 'a levonás felső határa' },
  'datum.ma': { fajta: 'konfig', cimke: 'a mai nap' },

  // ügyfél
  'ugyfel.nev': { fajta: 'ugyfel', cimke: 'az ügyfél neve', demo: 'Szabó Kata' },
  'ugyfel.szuletesi_nev': { fajta: 'ugyfel', cimke: 'az ügyfél születési neve', demo: 'Szabó Katalin' },
  'ugyfel.lakcim': { fajta: 'ugyfel', cimke: 'az ügyfél lakcíme', demo: '1136 Budapest, Példa utca 7.' },
  'ugyfel.adoazonosito_jel': { fajta: 'ugyfel', cimke: 'az ügyfél adóazonosító jele', demo: '8417104569' },
  'ugyfel.adoszam': { fajta: 'ugyfel', cimke: 'az ügyfél adószáma', demo: '68801234-1-41' },
  'ugyfel.ev_nyilvantartasi_szam': { fajta: 'ugyfel', cimke: 'az egyéni vállalkozói nyilvántartási szám', demo: '51234567' },
  'ugyfel.email': { fajta: 'ugyfel', cimke: 'az ügyfél e-mail-címe', demo: 'kata.szabo@demo.kezjegy.test' },
  'szerzodes.kezdete': { fajta: 'ugyfel', cimke: 'a szerződés kezdete', demo: '2026. január 8.' },

  // könyvelő
  'konyvelo.nev': { fajta: 'ugyfel', cimke: 'a könyvelő neve', demo: 'Kovács Bence' },
  'konyvelo.keresztnev': { fajta: 'ugyfel', cimke: 'a könyvelő keresztneve', demo: 'Bence' },
  'konyvelo.adoazonosito_jel': { fajta: 'ugyfel', cimke: 'a könyvelő adóazonosító jele', demo: '8428621233' },
  'konyvelo.nyilvantartasi_szam': { fajta: 'ugyfel', cimke: 'a könyvelő nyilvántartási száma', demo: '123456 (minta)' },
  'konyvelo.cim': { fajta: 'ugyfel', cimke: 'a könyvelő címe', demo: '1111 Budapest, Minta körút 1.' },
  'konyvelo.adoszam': { fajta: 'ugyfel', cimke: 'a könyvelő adószáma', demo: '69990001-1-43' },

  // előfizetés (eseményhez)
  'elofizetes.lejarat_ig': { fajta: 'futasi', cimke: 'a kártyás engedély vége (…-ig)', demo: '2027. január 8-ig' },
  'elofizetes.kovetkezo_levonas': { fajta: 'futasi', cimke: 'a következő levonás napja', demo: '2026. december 8.' },
  'elofizetes.idoszak_vege_ig': { fajta: 'futasi', cimke: 'a kifizetett időszak vége (…-ig)', demo: '2026. december 8-ig' },
  'elofizetes.szunetel_datum_ig': { fajta: 'futasi', cimke: 'a szüneteltetés napja (…-ig)', demo: '2026. december 22-ig' },
  'simplepay.tranzakcio': { fajta: 'futasi', cimke: 'a SimplePay tranzakcióazonosító', demo: '500123456' },
  'hatarido.kovetkezo': { fajta: 'futasi', cimke: 'a következő határidő', demo: '2027. január 12., negyedéves befizetés' },
  'arvaltozas.datum_tol': { fajta: 'futasi', cimke: 'az új ár kezdete (…-tól/-től)', demo: '2027. február 1-jétől' },
  'arvaltozas.uj_ar': { fajta: 'futasi', cimke: 'az új havidíj', demo: '22 000 Ft' },

  // pénzmosás elleni adatlap (csak a könyvelőnek készülő PDF)
  'kyc.nev': { fajta: 'ugyfel', cimke: 'családi és utónév', demo: 'Szabó Kata' },
  'kyc.szuletesi_nev': { fajta: 'ugyfel', cimke: 'születési családi és utónév', demo: 'Szabó Katalin' },
  'kyc.anyja_neve': { fajta: 'ugyfel', cimke: 'anyja születési neve', demo: 'Minta Mária' },
  'kyc.szuletesi_hely_ido': { fajta: 'ugyfel', cimke: 'születési hely és idő', demo: 'Példafalva, 1981. március 4.' },
  'kyc.allampolgarsag': { fajta: 'ugyfel', cimke: 'állampolgárság', demo: 'magyar' },
  'kyc.lakcim': { fajta: 'ugyfel', cimke: 'lakcím', demo: '1136 Budapest, Példa utca 7.' },
  'kyc.okmany': { fajta: 'ugyfel', cimke: 'az azonosító okmány típusa és száma', demo: 'személyi igazolvány, DEMO000000' },
  'kyc.okmany_lejarat': { fajta: 'ugyfel', cimke: 'az okmány lejárata', demo: '2031. május 31.' },
  'kyc.lakcim_okmany': { fajta: 'ugyfel', cimke: 'a lakcímet igazoló okmány', demo: 'lakcímkártya, lakcímoldal (DEMO)' },
  'kyc.ellenorizte': { fajta: 'ugyfel', cimke: 'az ellenőrző neve', demo: 'Kovács Bence' },
  'kyc.ellenorzes_ideje': { fajta: 'ugyfel', cimke: 'az ellenőrzés ideje', demo: '2026. január 9., 9:40' },
  'kyc.eredmeny': { fajta: 'ugyfel', cimke: 'az ellenőrzés eredménye', demo: 'elfogadva' },
  'kyc.megjegyzes': { fajta: 'ugyfel', cimke: 'megjegyzés', demo: '–' },
  'nyilatkozat.sajat_nevben': { fajta: 'ugyfel', cimke: 'saját nevében jár el (x vagy szóköz)', demo: 'x' },
  'nyilatkozat.nem_kiemelt': { fajta: 'ugyfel', cimke: 'nem kiemelt közszereplő (x vagy szóköz)', demo: 'x' },
  'nyilatkozat.kiemelt': { fajta: 'ugyfel', cimke: 'kiemelt közszereplő (x vagy szóköz)', demo: ' ' },
  'nyilatkozat.kiemelt_reszletek': { fajta: 'ugyfel', cimke: 'a kiemelt közszereplői részletek', demo: '–' },
  'nyilatkozat.valosag': { fajta: 'ugyfel', cimke: 'valóságnyilatkozat (x vagy szóköz)', demo: 'x' },
  'nyilatkozat.valtozas': { fajta: 'ugyfel', cimke: 'változásbejelentési nyilatkozat (x vagy szóköz)', demo: 'x' },
  'nyilatkozat.ideje': { fajta: 'ugyfel', cimke: 'a nyilatkozat ideje', demo: '2026. január 8., 10:20' },

  // „Intézzük helyetted” – az ügyfél utasítása a vállalkozása bejelentésére (sablonok/ev_bejelentes_utasitas.md,
  // SPEC §27.3.3). Az értékeket a backend adja: a jóváhagyott adatok blokkjai (AssistConsentSummary.blocks) egy-egy sorban,
  // és az appban mutatott nyilatkozat- és utasításszöveg (declarationText / instructionText) – azt rögzítjük, amit az ügyfél látott.
  'utasitas.verzio': { fajta: 'futasi', cimke: 'az utasítás-sablon verziója', demo: '2026-11-19' },
  'utasitas.adoazonosito_jel_takart': { fajta: 'ugyfel', cimke: 'az ügyfél adóazonosító jele takarva', demo: '•••••••569' },
  'utasitas.szekhely': { fajta: 'ugyfel', cimke: 'a székhely', demo: '1136 Budapest, Példa utca 7. (a lakcímem)' },
  'utasitas.telephely': { fajta: 'ugyfel', cimke: 'a telephelyek és fióktelepek', demo: 'Nincs' },
  'utasitas.tevekenysegek': {
    fajta: 'ugyfel',
    cimke: 'a tevékenységek („kód – név”, a fő tevékenység elöl)',
    demo: 'fő: 000000 – Minta tevékenység (DEMO); 000001 – Másik minta tevékenység (DEMO)',
  },
  'utasitas.munkavegzes': { fajta: 'ugyfel', cimke: 'a munkavégzés jellege', demo: 'főfoglalkozású egyéni vállalkozó' },
  'utasitas.adozas': {
    fajta: 'ugyfel',
    cimke: 'az adózási választások',
    demo: 'Átalányadózás: igen · Alanyi ÁFA-mentesség: igen · Kata: nem · Pénzforgalmi elszámolás: nem · Közösségi adószám: nem',
  },
  'utasitas.kezdes': { fajta: 'ugyfel', cimke: 'a kezdés napja', demo: 'A beküldés napja, várhatóan november 20. Előre dátumot nem lehet megadni.' },
  'utasitas.nyilatkozat_szoveg': {
    fajta: 'futasi',
    cimke: 'az ügyfél nyilatkozata (az appban mutatott szöveg)',
    demo: 'Rám nem vonatkozik egyik kizáró ok sem, és nincs másik élő egyéni vállalkozásom.',
  },
  'utasitas.utasitas_szoveg': {
    fajta: 'futasi',
    cimke: 'az ügyfél utasítása (az appban mutatott szöveg)',
    demo: 'Az adatokat én adtam meg és ellenőriztem. Kérem, hogy Kovács Bence ezekkel az adatokkal, meghatalmazottként küldje be a vállalkozásom bejelentését. Tudom, hogy beküldés után nem lehet visszavonni, és a vállalkozásom a beküldés napján indul.',
  },
  'utasitas.idopont': { fajta: 'futasi', cimke: 'az elfogadás ideje (Europe/Budapest)', demo: '2026. november 19., 14:05' },
  'utasitas.ujjlenyomat': {
    fajta: 'futasi',
    cimke: 'a jóváhagyott adatok SHA-256 ujjlenyomata',
    demo: '3f6c0a5e2b9d4c71a8e0f2d6b5c9a1e7d4f8b2c6a0e9d3f7b1c5a8e2d6f0b4c9',
  },
} as const satisfies Record<string, HelyorzoLeiras>;

export type HelyorzoKulcs = keyof typeof HELYORZOK;

export function ismertHelyorzo(kulcs: string): kulcs is HelyorzoKulcs {
  return Object.prototype.hasOwnProperty.call(HELYORZOK, kulcs);
}

/** A {{kulcs}} minták – kis- és nagybetű, szám, pont, aláhúzás. */
export const HELYORZO_MINTA = /\{\{\s*([a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+)\s*\}\}/g;

/** Egy szövegben előforduló helyőrző-kulcsok (ismétlés nélkül, sorrendben). */
export function helyorzokBenne(szoveg: string): string[] {
  const kulcsok = new Set<string>();
  for (const m of szoveg.matchAll(HELYORZO_MINTA)) kulcsok.add(m[1]!);
  return [...kulcsok];
}
