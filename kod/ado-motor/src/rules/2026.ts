import type { NavAccount, TaxRules } from './types.js';

// 2026 rules for átalányadózó egyéni vállalkozók (alanyi ÁFA-mentes). Checked 2026-11-17/18.
// Each value names its source (ids refer to `sources` at the bottom; full list also in SPEC §25).

export const NAV_ACCOUNTS: { szja: NavAccount; tb: NavAccount; szocho: NavAccount } = {
  // Source: nav-iban (NAV "Adóztatási IBAN számlaszámok"), nav-szamlaszamok.
  szja: {
    name: 'NAV Személyi jövedelemadó magánszemélyt, őstermelőt, egyéni vállalkozót, kifizetőt terhelő kötelezettség beszedési számla',
    shortName: 'NAV SZJA beszedési számla',
    number: '10032000-06056353',
    iban: 'HU16100320000605635300000000',
  },
  tb: {
    name: 'NAV Társadalombiztosítási járulék magánszemélyt, őstermelőt, egyéni vállalkozót, kifizetőt terhelő kötelezettség beszedési számla',
    shortName: 'NAV TB-járulék beszedési számla',
    number: '10032000-06055802',
    iban: 'HU22100320000605580200000000',
  },
  szocho: {
    name: 'NAV Szociális hozzájárulási adó beszedési számla',
    shortName: 'NAV szocho beszedési számla',
    number: '10032000-06055912',
    iban: 'HU12100320000605591200000000',
  },
};

export const RULES_2026: TaxRules = {
  rulesVersion: '2026-01-01',
  year: 2026,
  validFrom: '2026-01-01',
  revision: 1,
  draft: false,
  checkedOn: '2026-11-18',

  // 426/2025. (XII. 23.) Korm. rendelet [korm-426-2025]
  minimumWageHuf: 322_800,
  guaranteedMinimumHuf: 373_200,
  // Tbj.: for a month not fully insured the minimum is 1/30 of the monthly amount per insured day [nav-100 6.1, worked example]
  minimumProrationDays: 30,
  // From 2026 the szocho minimum is 100 % of the minimum wage (was 112.5 %) [nav-szocho-alap]
  szochoMinimumPct: 100,

  // Szja tv. 53. § (2): 45 % general in 2026 (40 % until 2025, 50 % from 2027); 80 % listed activities; 90 % exclusively retail [nav-100 3., nav-kedvezo]
  costRatios: { general: 45, list80: 80, retail: 90 },
  legacyGeneralRatios: [40],

  // Szja tv. 1. sz. melléklet 4.48: half of the annual minimum wage = 1 936 800 Ft, not prorated [nav-100]
  taxFreeIncomeHuf: 1_936_800,
  szjaPermille: 150, // 15 % [nav-100 4.]
  tbPermille: 185, // 18.5 % Tbj. [nav-100 6.]
  szochoPermille: 130, // 13 % Szocho tv. [nav-100 6.]

  // Szja tv. 50. § (1): 10 × annual minimum wage; 52. § (1) exclusively retail: 50 × [nav-100]
  atalanyCapHuf: 38_736_000,
  atalanyCapRetailHuf: 193_680_000,
  // Áfa tv. 188. §: 20 M Ft in 2026 (22 M 2027, 24 M 2028), counted on consideration by delivery date [nav-igy-adozunk]
  afaLimitHuf: 20_000_000,

  warnRatio: 0.8,
  projectionMinDays: 60,

  // Quarterly járulék + szocho return (2658) and payment, and quarterly SZJA advance: 12th of the month after the quarter [nav-szocho-alap, nav-100 4.]
  quarterlyDueDay: 12,
  szjaAnnualReturn: { month: 5, day: 20 },
  // The annual return of an egyéni vállalkozó is the single "SZJA" return (the separate '53 form is gone):
  // NAV 100 (2026) calls the 2025 return 25SZJA, so the 2026 return is 26SZJA (due 20 May 2027).
  szjaAnnualReturnForm: '26SZJA',
  jarulekQuarterlyForm: '2658',

  hipa: {
    maxRatePct: 2, // Htv. 40. §
    // Htv. 39/A. § (1)–(3), in force 2026 [htv, szegvar-savos]
    smallBusinessLimitHuf: 25_000_000,
    smallBusinessLimitRetailHuf: 120_000_000,
    bands: [
      { band: 'a', upToHuf: 12_000_000, baseHuf: 2_500_000 },
      { band: 'b', upToHuf: 18_000_000, baseHuf: 6_000_000 },
      { band: 'c', upToHuf: null, baseHuf: 8_500_000 },
    ],
    // Htv. 39/A. § (9): advance = previous year's tax, by the last day of the 5th month; (7): tax by the last day of the 5th month of the next year
    savosAdvance: { month: 5, day: 31 },
    annualDue: { month: 5, day: 31 },
    // General method (Htv. 41. §): advances 15 March and 15 September – dates only, the amount is [KÖNYVELŐ]
    altalanosAdvances: [
      { month: 3, day: 15 },
      { month: 9, day: 15 },
    ],
  },

  accounts: NAV_ACCOUNTS,

  sources: [
    {
      id: 'nav-100',
      title: 'NAV 100. sz. információs füzet – Az egyéni vállalkozók átalányadózásának alapvető szabályai (2026.02.20)',
      url: 'https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/100.-Az-egyeni-vallalkozok-atalanyadozasanak-alapveto-szabalyai-2026.-02.-20',
    },
    {
      id: 'nav-3',
      title: 'NAV 3. sz. információs füzet – Az egyéni vállalkozók szja- és járulékkötelezettsége (2026.08.31)',
      url: 'https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/03.-Az-egyeni-vallalkozok-szja--es-jarulekkotelezettsege-2026.-08.-31.',
    },
    { id: 'nav-igy-adozunk', title: 'NAV: Így adózunk jövőre', url: 'https://nav.gov.hu/sajtoszoba/hirek/Igy_adozunk_jovore' },
    {
      id: 'nav-kedvezo',
      title: 'NAV: Kedvező változások az átalányadózásban',
      url: 'https://nav.gov.hu/szja/ujdonsagok-tudnivalok/Kedvezo_valtozasok_az_atalanyadozasban',
    },
    {
      id: 'nav-szocho-alap',
      title: 'NAV: Csökken a szocho alapja és változik az egyéni vállalkozók bevallási gyakorisága',
      url: 'https://nav.gov.hu/ado/szocialis_hozzajarulasi_ado/Csokken_a_szocialis_hozzajarulasi_ado_alapja_es_valtozik_az_egyeni_vallalkozok_bevallasi_gyakorisaga',
    },
    {
      id: 'korm-426-2025',
      title: '426/2025. (XII. 23.) Korm. rendelet (minimálbér, garantált bérminimum 2026)',
      url: 'https://njt.jog.gov.hu/jogszabaly/2025-426-20-22',
    },
    {
      id: 'nav-szamlaszamok',
      title: 'NAV: Ki, hogyan fizethet a NAV-nak?',
      url: 'https://nav.gov.hu/ugyfeliranytu/szamlaszamok/Ki_hogyan_fizethet_a_NAV-nak',
    },
    {
      id: 'nav-iban',
      title: 'NAV: Adóztatási IBAN számlaszámok',
      url: 'https://nav.gov.hu/ugyfeliranytu/szamlaszamok/iban/nav-adoztatasi-iban-szamlaszamok',
    },
    {
      id: 'htv',
      title: '1990. évi C. törvény a helyi adókról (Htv.) 39/A. § – kisvállalkozó sávos (tételes) adóalapja; 41. § előleg',
      url: 'https://njt.jog.gov.hu/jogszabaly/1990-100-00-00',
    },
    {
      id: 'szegvar-savos',
      title: 'Tájékoztató a kisvállalkozások egyszerűsített (sávos) iparűzési adózásáról (önkormányzati példa)',
      url: 'https://szegvar.hu/wp-content/uploads/2025/04/Tajekoztato-a-savos-adozasrol.pdf',
    },
    {
      id: 'ngm-10-2025',
      title: '10/2025. (IV. 30.) NGM rendelet a 2026. évi munkaszüneti napok körüli munkarendről',
      url: 'https://njt.jog.gov.hu/jogszabaly/2025-10-20-2X',
    },
  ],
};
