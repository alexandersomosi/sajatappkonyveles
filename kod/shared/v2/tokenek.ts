// Adózz.hu v2 – dizájn-tokenek (ALAP-D / D2). React nélkül: RN-ben, webes Reactben és Node-ban is fordul/fut.
// Forrás: dizajn/C5_v2/v2.css (:root és a komponensek) + dizajn/C5_v2/asztali/v2_asztali.css (gépes nézet).
// A tulaj 11-20/21-i döntései: kártyák szürke háttéren, semleges csempe #F1F3F9 34-es ikonnal, sárga főgomb sötét
// felirattal, színes alsó sáv kék felső csíkkal, finom árnyékok; nincs nagy, halvány pasztell doboz.
// Akadálymentesség: minden szöveg–háttér pár ≥ 4,5:1 (nagy szövegre ≥ 3:1) – lásd KONTRASZT_PAROK és a teszt.
// A v2.css `--halvany` #8A93A8 fehéren csak 3,08:1 → szövegre a `szurke` #5B6478 megy; a #8A93A8 csak
// `dekorHalvany` néven érhető el (ikon, nyíl, nem-szöveges elem).

/** Színek (hex). Szöveghez csak a `KONTRASZT_PAROK`-ban szereplő párosítások valók. */
export const szin = {
  // márka
  kek: '#1428DB',
  kekVil: '#E6EBFF', // kis címke (c-info), aktív menüelem alapja – nagy felületre nem
  kekIkon: '#1F3BE0',
  kekValasztott: '#F5F7FF', // kiválasztott választókártya alapja (keretes, fehérhez közeli)
  sarga: '#FFC93C', // főgomb, kiemelés a kék fejlécben
  sargaS: '#E9AE12', // a sárga gomb alsó éle (árnyék)
  sargaFeheren: '#F2B705', // a logó „zz”-je fehér alapon (csak a logóképben)
  // szöveg
  sotet: '#10152B', // fő szövegszín
  szoveg2: '#2A3247', // kártya-bekezdés
  szurke: '#5B6478', // másodlagos szöveg, szakaszcím, inaktív fül-felirat
  feher: '#FFFFFF',
  fejHalvany: '#D5DCFF', // másodlagos szöveg a kék fejlécen
  // felületek, vonalak
  hatter: '#F3F5FB', // a képernyő alapja
  kartya: '#FFFFFF',
  csempe: '#F1F3F9', // az ikon semleges csempéje
  szurkeAlap: '#EEF0F6', // szürke címke, lépésszám-kör
  vonal: '#ECEFF6', // sorok közti hajszálvonal
  keret: '#DCE2F0', // mező, másodlagos gomb, választó kerete
  hoverAlap: '#F5F7FC', // gépes menü és sor rámutatáskor
  csikAlap: '#E6E9F2', // haladás-csík alapja
  szegmensAlap: '#E9ECF5',
  kapcsoloKi: '#D5DAE6',
  jeloloKeret: '#C3CADB', // jelölőnégyzet / rádió kerete (nem-szöveges elem: ≥ 3:1 nem kell, mert a felirat jelöl)
  feltoltoKeret: '#C9D2EE',
  // jelzőszínek: telt szöveg-/sávszín + világos címkealap
  zold: '#157A3E',
  zoldVil: '#DFF5E8',
  narancs: '#9A5B00',
  narancsVil: '#FFF0DA',
  piros: '#B42318',
  pirosVil: '#FFE4E4',
  pirosKeret: '#F4C7C3', // veszély-gomb kerete
  hibaKeret: '#E5484D', // hibás mező kerete
  pont: '#EF3B3B', // olvasatlan-jelző pötty
  // letiltott vezérlő (WCAG 1.4.3 alól kivétel)
  letiltvaAlap: '#ECEEF4',
  letiltvaSzoveg: '#9AA2B5',
  // csak NEM szöveges díszítésre (ikon, nyíl): fehéren 3,08:1, illetve 2,5:1
  dekorHalvany: '#8A93A8',
  dekorNyil: '#9AA2B5',
} as const;

export type SzinNev = keyof typeof szin;

/** A kék fejléc / hős sáv színátmenete (160°). */
export const fejGradiens = {
  szog: 160,
  szinek: ['#1D35EC', '#1428DB', '#0F20BE'],
  helyek: [0, 0.55, 1],
  css: 'linear-gradient(160deg, #1D35EC 0%, #1428DB 55%, #0F20BE 100%)',
} as const;

/** Sarok-sugarak (pt/px). */
export const sugar = {
  kartya: 20,
  kartyaAsztali: 22,
  gomb: 14,
  kapszula: 999, // kis gomb, címke, pirula
  mezo: 14,
  csempeKicsi: 11,
  csempe: 13,
  csempeNagy: 20,
  fejlec: 26, // a nagy fejléc alsó sarkai
  fejlecKis: 24,
  hos: 24, // gépes hős sáv
  sav: 22, // alsó sáv, dokk, üzenetíró sáv felső sarkai
  valaszto: 16,
  buborek: 18,
  buborekCsucs: 6,
  menuElem: 12, // gépes bal menü eleme
  jelolo: 7,
  szegmens: 14,
  szegmensElem: 10,
  feltolto: 18,
} as const;

/** Térköz-skála (pt/px) és a visszatérő elrendezési értékek. */
export const ter = {
  t1: 4,
  t2: 6,
  t3: 8,
  t4: 10,
  t5: 12,
  t6: 14,
  t7: 16,
  t8: 18,
  t9: 22,
  t10: 28,
  t11: 36,
} as const;

export const elrendezes = {
  telefon: {
    oldalPadding: 12, // main.lap vízszintes
    fentPadding: 14,
    lentNavval: 112, // alsó sáv alatt
    lentDokkal: 116,
    lentDokkNavval: 196,
    lentSima: 28,
    fejlecVizszintes: 18,
    fejlecLent: 24,
    fejlecKisLent: 20,
  },
  asztali: {
    menuSzeles: 248,
    menuSzelesKisebb: 232, // 1360 px alatt
    tartalomFent: 28,
    tartalomOldal: 36,
    tartalomLent: 48,
    tartalomFentKisebb: 24,
    tartalomOldalKisebb: 28,
    tartalomLentKisebb: 40,
    racsKoz: 22, // a 2 oszlopos kártyarács hézaga
    hosFugg: 30,
    hosVizsz: 36,
    menuElemMagas: 50,
  },
  kartya: {
    fugg: 16, // belső függőleges
    vizsz: 14, // belső vízszintes
    koz: 12, // kártyák közt (margin-bottom)
    belsoKoz: 12, // csempe és szöveg közt
    asztaliFugg: 22,
    asztaliVizsz: 24,
    asztaliBelsoKoz: 16,
    tomorFugg: 6, // listakártya
  },
  szakaszCim: { fent: 18, oldal: 6, lent: 8 },
  erintesiCel: 44, // minimum érintési cél (pt)
  gombMagas: 52,
  gombMagasMasod: 50,
  gombMagasKis: 42,
  gombMagasAsztali: 50,
  mezoMagas: 52,
  mezoMagasAsztali: 50,
  listaSorMin: 60, // lsor
} as const;

/** Árnyékok: `css` (web, és RN ≥ 0.76 `boxShadow` – az app RN 0.88-on fut) + `rn` tartalék (shadowColor, shadowOpacity, shadowRadius, shadowOffset, elevation)
 *  ott, ahol a boxShadow nem hat (pl. régi Android). Egy elemre a kettő közül csak az egyiket tedd. */
export const arnyek = {
  kartya: {
    css: '0 1px 2px rgba(16,21,43,.04), 0 6px 20px rgba(16,21,43,.06)',
    rn: { shadowColor: '#10152B', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  },
  gomb: {
    css: '0 2px 0 #E9AE12, 0 6px 14px rgba(233,174,18,.25)',
    rn: { shadowColor: '#E9AE12', shadowOpacity: 0.35, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  },
  gombKis: {
    css: '0 2px 0 #E9AE12',
    rn: { shadowColor: '#E9AE12', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  },
  sav: {
    // alsó sáv, dokk, üzenetíró sáv (felfelé vetül)
    css: '0 -6px 22px rgba(16,21,43,.08)',
    rn: { shadowColor: '#10152B', shadowOpacity: 0.08, shadowRadius: 11, shadowOffset: { width: 0, height: -6 }, elevation: 8 },
  },
  fejlec: {
    css: '0 8px 24px rgba(20,40,219,.22)',
    rn: { shadowColor: '#1428DB', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  },
  hos: {
    css: '0 8px 24px rgba(20,40,219,.2)',
    rn: { shadowColor: '#1428DB', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  },
  szegmens: {
    css: '0 1px 3px rgba(16,21,43,.1)',
    rn: { shadowColor: '#10152B', shadowOpacity: 0.1, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  },
  mezoFokusz: {
    css: '0 0 0 3px rgba(20,40,219,.12)',
    rn: { shadowColor: '#1428DB', shadowOpacity: 0.12, shadowRadius: 0, shadowOffset: { width: 0, height: 0 }, elevation: 0 },
  },
} as const;

/** A Geist betű (SIL OFL 1.1). Az app a statikus példányokat tölti be `Geist-W<súly>` néven
 *  (kod/app/assets/fonts, expo-font); a panel a @fontsource-variable/geist csomag „Geist Variable” családját. */
export type Suly = 400 | 500 | 550 | 600 | 650 | 700 | 750 | 800 | 900;
export const betu = {
  web: '"Geist Variable", "Geist", "Segoe UI", Arial, sans-serif',
  /** RN: a súly a családnévben van (RN-ben a fontWeight egyedi betűnél nem megbízható). */
  rn: (suly: Suly = 400): string => `Geist-W${suly}`,
  sulyok: [400, 500, 550, 600, 650, 700, 750, 800, 900] as readonly Suly[],
} as const;

/** Egy szövegstílus: méret (pt/px), súly, sormagasság (arány), betűköz (em), nagybetűs-e. */
export interface SzovegStilus {
  readonly meret: number;
  readonly suly: Suly;
  readonly sor: number;
  readonly betukoz?: number;
  readonly nagybetu?: boolean;
}

export const tipo = {
  fejH1: { meret: 27, suly: 800, sor: 1.14, betukoz: -0.025 },
  fejH1Kis: { meret: 25, suly: 800, sor: 1.14, betukoz: -0.025 },
  fejSzoveg: { meret: 15.5, suly: 400, sor: 1.45 },
  kartyaCim: { meret: 18.5, suly: 750, sor: 1.25, betukoz: -0.015 },
  h3: { meret: 16, suly: 700, sor: 1.3 },
  alap: { meret: 16, suly: 400, sor: 1.45 },
  szoveg: { meret: 15, suly: 400, sor: 1.45 },
  szakaszCim: { meret: 14, suly: 700, sor: 1.3, betukoz: 0.04, nagybetu: true },
  megj: { meret: 14, suly: 400, sor: 1.45 },
  sorCim: { meret: 15.5, suly: 700, sor: 1.3 },
  sorAlcim: { meret: 14, suly: 400, sor: 1.35 },
  nagySzam: { meret: 25, suly: 800, sor: 1.2, betukoz: -0.02 },
  osszeg: { meret: 18, suly: 800, sor: 1.2, betukoz: -0.01 },
  gomb: { meret: 17, suly: 750, sor: 1.2 },
  gombMasod: { meret: 16, suly: 700, sor: 1.2 },
  gombKis: { meret: 15.5, suly: 750, sor: 1.2 },
  link: { meret: 15.5, suly: 650, sor: 1.3 },
  cimke: { meret: 13, suly: 700, sor: 1.2 },
  mezo: { meret: 16.5, suly: 400, sor: 1.3 },
  mezoCim: { meret: 15, suly: 650, sor: 1.3 },
  mezoSugo: { meret: 13.5, suly: 400, sor: 1.4 },
  nav: { meret: 13, suly: 600, sor: 1.2 },
  navAktiv: { meret: 13, suly: 750, sor: 1.2 },
  // gépes nézet
  asztaliHosH1: { meret: 36, suly: 800, sor: 1.15, betukoz: -0.025 },
  asztaliHosH1Kisebb: { meret: 33, suly: 800, sor: 1.15, betukoz: -0.025 }, // 1360 px alatt
  asztaliHosSzoveg: { meret: 17, suly: 400, sor: 1.45 },
  asztaliOldalcim: { meret: 28, suly: 800, sor: 1.2, betukoz: -0.02 },
  asztaliKartyaCim: { meret: 19, suly: 750, sor: 1.25, betukoz: -0.015 },
  asztaliH3: { meret: 17, suly: 700, sor: 1.3 },
  asztaliSzoveg: { meret: 15.5, suly: 400, sor: 1.45 },
  asztaliNagySzam: { meret: 30, suly: 800, sor: 1.2, betukoz: -0.02 },
  asztaliOsszeg: { meret: 20, suly: 800, sor: 1.2, betukoz: -0.01 },
  asztaliMenu: { meret: 16, suly: 600, sor: 1.2 },
  asztaliMenuAktiv: { meret: 16, suly: 750, sor: 1.2 },
  asztaliBelepoCim: { meret: 44, suly: 800, sor: 1.12, betukoz: -0.028 },
  asztaliUrlapCim: { meret: 26, suly: 800, sor: 1.2, betukoz: -0.02 },
} as const satisfies Readonly<Record<string, SzovegStilus>>;

/** RN-hez: sormagasság pontban (RN-ben a lineHeight abszolút). */
export const sorMagassag = (s: SzovegStilus): number => Math.round(s.meret * s.sor);
/** RN-hez: betűköz pontban (RN-ben a letterSpacing pont, nem em). */
export const betukozPt = (s: SzovegStilus): number => +((s.betukoz ?? 0) * s.meret).toFixed(3);

/** Ikon-csempe: semleges alap, nagy ikon (tulaj 11-20: 42-es csempében 34-es ikon). */
export const csempe = {
  hatter: '#F1F3F9',
  kicsi: { meret: 36, ikon: 29, sugar: 11 },
  alap: { meret: 42, ikon: 34, sugar: 13 },
  nagy: { meret: 64, ikon: 50, sugar: 20 },
} as const;
export type CsempeMeret = 'kicsi' | 'alap' | 'nagy';

/** Ikonméretek a csempén kívül. */
export const ikonMeret = {
  nav: 28, // alsó sáv és gépes menü
  vezerlo: 24,
  gombban: 18,
  masodGombban: 20,
  linkben: 16,
  cimkeben: 14,
  mezoben: 20,
  vissza: 22,
  chev: 18,
} as const;

/** Az alsó sáv (telefon). */
export const nav = {
  ikon: 28,
  csik: 3, // az aktív fül kék felső csíkja
  csikBehuzas: 0.2, // a csík a fül szélességének 20–80%-a közt
  felirat: 13,
  feliratSuly: 600,
  feliratSulyAktiv: 750,
  aktivSzin: '#1428DB',
  inaktivFelirat: '#5B6478', // a minta #8A93A8-a helyett (AA)
  fentPadding: 12,
  lentPadding: 22,
  pontMeret: 9,
  pontSzin: '#EF3B3B',
} as const;

/** Mozgás (csak az ügyfél-appban; a panelben és a konzolban nincs). Csak transform/opacity. */
export const mozgas = {
  rovid: 200,
  alap: 300,
  hosszu: 400,
  lenyomas: 100, // gomb benyomódása
  benyomodas: 0.97, // lenyomott gomb mérete
  konfettiMax: 1200,
  gorbe: [0.22, 1, 0.36, 1] as readonly [number, number, number, number], // cubic-bezier
  gorbeCss: 'cubic-bezier(0.22, 1, 0.36, 1)',
} as const;

/** Töréspontok (CSS px / RN dp, csak weben számít az asztali nézet). */
export const torespont = {
  asztali: 1024, // efölött gépes elrendezés
  szelesAsztali: 1360, // efölött a szélesebb menü és margó
  mobilMax: 480,
  tartalomMax: 1120,
} as const;

/** Látható fókusz (web): 2 px kék körvonal, 2 px eltolással. */
export const fokusz = { szin: '#1428DB', vastagsag: 2, eltolas: 2 } as const;

// ---------- kontraszt (WCAG 2.x) ----------

function csatorna(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relatív fénysűrűség (#RRGGBB). */
export function fenysuruseg(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * csatorna(r) + 0.7152 * csatorna(g) + 0.0722 * csatorna(b);
}

/** WCAG kontrasztarány két #RRGGBB szín közt (1–21). */
export function kontraszt(a: string, b: string): number {
  const la = fenysuruseg(a), lb = fenysuruseg(b);
  const [v, s] = la > lb ? [la, lb] : [lb, la];
  return (v + 0.05) / (s + 0.05);
}

/** A tervezett szöveg–háttér párok. `nagy`: ≥ 18,66 px félkövér / ≥ 24 px (elég a 3:1); `nemSzoveg`: ikon/keret (3:1). */
export const KONTRASZT_PAROK: readonly { readonly mi: string; readonly elo: string; readonly hat: string; readonly nagy?: true; readonly nemSzoveg?: true }[] = [
  { mi: 'fő szöveg kártyán', elo: szin.sotet, hat: szin.feher },
  { mi: 'fő szöveg háttéren', elo: szin.sotet, hat: szin.hatter },
  { mi: 'bekezdés kártyán', elo: szin.szoveg2, hat: szin.feher },
  { mi: 'másodlagos szöveg kártyán', elo: szin.szurke, hat: szin.feher },
  { mi: 'szakaszcím háttéren', elo: szin.szurke, hat: szin.hatter },
  { mi: 'másodlagos szöveg csempén', elo: szin.szurke, hat: szin.csempe },
  { mi: 'szürke címke', elo: szin.szurke, hat: szin.szurkeAlap },
  { mi: 'inaktív fül-felirat', elo: nav.inaktivFelirat, hat: szin.feher },
  { mi: 'aktív fül-felirat, link', elo: szin.kek, hat: szin.feher },
  { mi: 'link háttéren', elo: szin.kek, hat: szin.hatter },
  { mi: 'kék címke / aktív menü', elo: szin.kek, hat: szin.kekVil },
  { mi: 'fehér szöveg kéken (fejléc, saját buborék, kék gomb)', elo: szin.feher, hat: szin.kek },
  { mi: 'fehér szöveg a fejléc legvilágosabb pontján', elo: szin.feher, hat: fejGradiens.szinek[0] },
  { mi: 'halvány fejlécszöveg kéken', elo: szin.fejHalvany, hat: szin.kek },
  { mi: 'halvány fejlécszöveg a fejléc legvilágosabb pontján', elo: szin.fejHalvany, hat: fejGradiens.szinek[0] },
  { mi: 'sárga kiemelés a fejléc címében (27 px, 800)', elo: szin.sarga, hat: fejGradiens.szinek[0], nagy: true },
  { mi: 'sötét felirat sárga gombon', elo: szin.sotet, hat: szin.sarga },
  { mi: 'zöld címke', elo: szin.zold, hat: szin.zoldVil },
  { mi: 'narancs címke', elo: szin.narancs, hat: szin.narancsVil },
  { mi: 'piros címke', elo: szin.piros, hat: szin.pirosVil },
  { mi: 'piros szöveg kártyán (veszély-gomb, mezőhiba)', elo: szin.piros, hat: szin.feher },
  { mi: 'zöld szöveg kártyán', elo: szin.zold, hat: szin.feher },
  { mi: 'narancs szöveg kártyán', elo: szin.narancs, hat: szin.feher },
  { mi: 'díszítő ikon/nyíl kártyán', elo: szin.dekorHalvany, hat: szin.feher, nemSzoveg: true },
  { mi: 'mező kerete fókuszban', elo: szin.kek, hat: szin.feher, nemSzoveg: true },
  { mi: 'hibás mező kerete', elo: szin.hibaKeret, hat: szin.feher, nemSzoveg: true },
];
