import type { KataRules, NavAccount, TaxRules } from './types.js';

// 2026 rules for átalányadózó egyéni vállalkozók (alanyi ÁFA-mentes). Checked 2026-11-17/18.
// Each value names its source (ids refer to `sources` at the bottom; full list also in SPEC §25).

export const NAV_ACCOUNTS: { szja: NavAccount; tb: NavAccount; szocho: NavAccount; kata: NavAccount } = {
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
  // SPEC §32: adónem 288; the 40 % különadó goes here too. Name and number from the NAV list in force from
  // 2026-11-01 (checked 2026-11-21) [nav-szamlaszamok-2026, nav-99].
  kata: {
    name: 'NAV Kisadózó vállalkozások adója bevételi számla',
    shortName: 'NAV kata-számla',
    number: '10032000-01076349',
    iban: 'HU27100320000107634900000000',
  },
};

/**
 * SPEC §32 (éves ciklus, F3) – the two further NAV accounts of the annual cycle. NAV list in force from 2026-11-01 (checked
 * 2026-11-21 by the plan and the critique) [nav-szamlaszamok-2026]. The 215 account is a group account: the önellenőrzési
 * pótlék is booked on adónem 215, a bírság on 224, a mulasztási bírság on 226 (critique 1., row 3). The HIPA pótlék goes to
 * the municipality, never here [DÁVID K7].
 */
export const NAV_ACCOUNTS_EV: { onellenorzes: NavAccount; kesedelmiPotlek: NavAccount } = {
  onellenorzes: {
    name: 'NAV Bírság, mulasztási bírság és önellenőrzéssel kapcsolatos befizetések bevételi számla',
    shortName: 'NAV önellenőrzési számla',
    number: '10032000-01076301',
    iban: 'HU49100320000107630100000000',
  },
  kesedelmiPotlek: {
    name: 'NAV Késedelmi pótlék bevételi számla',
    shortName: 'NAV késedelmi pótlék számla',
    number: '10032000-01076985',
    iban: 'HU75100320000107698500000000',
  },
};

/**
 * SPEC §32 – KATA (Kata tv. = 2022. évi XIII. törvény), 2026. Checked 2026-11-21 against the njt text (7. § (8)–(10),
 * 5. § (1) e)) and the NAV 99. füzet; the critique of 2026-11-21 confirmed 7. § (4)–(10) and 10. § [katv, nav-99].
 */
export const KATA_RULES_REGI_2026: KataRules = {
  variant: 'regi',
  monthlyHuf: 50_000, // 7. § (1)–(3): per started month
  yearlyLimitHuf: 18_000_000, // 7. § (4)
  limitPerMonthHuf: 1_500_000, // 7. § (4): not the whole year → liable months × 1.5 M
  kulonadoPermille: 400, // 7. § (5)
  dueDay: 12, // 7. § (2): by the 12th of the next month
  exemptMinDays: 30, // 7. § (9)
  reportDays: 15, // 5. § (3a)
  debtLimitHuf: 100_000, // 5. § (1) e)
  declarationDue: { month: 2, day: 25 }, // 10. §
  declarationForm: '26KATA',
  terminationDays: 30, // 7. § (6), 10. § (2)
  onlyMainJob: true,
  account: NAV_ACCOUNTS.kata,
  adonem: '288',
  draft: false,
  sources: ['katv', 'nav-99', 'nav-szamlaszamok-2026'],
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

  // SPEC §28.3.1 / §28.3.7 b – personal allowances 2026 (research _munka/k6/kedvezmenyek_2026.md, checked 2026-11-19)
  allowances: {
    csaladiPerChildHuf: { one: 133_340, two: 266_660, threePlus: 440_000 }, // Szja tv. 29/A. § (2) [szja-tv, nav-73]
    csaladiTartosBetegExtraHuf: 133_340, // Szja tv. 29/A. § (2a) [szja-tv]
    felvaltvaPct: 50, // Szja tv. 29/B. § (1e) [szja-tv]
    fiatal25MonthlyCapHuf: 715_765, // 2025. július KSH bruttó átlagkereset (Hivatalos Értesítő 52/2025) [ksh-atlagkereset, nav-73]; per ELIGIBLE MONTH of an annual frame (29/F. § (2): 12 × = 8 589 180), applied cumulatively
    fiatal25AgeYears: 25, // Szja tv. 29/F. § [szja-tv]
    anya30AgeYears: 30, // 2025. évi XIII. tv. [tv-2025-13]
    ketgyermekesMinBirthYear: 1986, // 2025. évi XIV. tv. 4. §: 2026 – born 1986 or later [tv-2025-14]
    haromgyermekesFrom: '2025-10-01', // 2025. évi XV. tv. [tv-2025-15]
    szemelyiMonthlyHuf: 107_600, // Szja tv. 29/E. §: 1/3 of the minimum wage (322 800 / 3) [szja-tv, nav-73]
    elsoHazasokMonthlyHuf: 33_335, // Szja tv. 29/C. § [szja-tv, nav-73]
    elsoHazasokMaxMonths: 24,
    csjkPermille: 150, // Tbj. 34. § (3), 80. § (2) [tbj, nav-100 6.1]
    nyugdijasAnyaSzochoLimitHuf: 34_356_720, // Szocho tv. 5. § (1a) – guard only [szocho-tv]
  },

  // SPEC §32: only the Kata tv. KATA exists in 2026
  kata: { regi: KATA_RULES_REGI_2026 },

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
    { id: 'szja-tv', title: '1995. évi CXVII. törvény (Szja tv.) 29/A–29/H. §, 49. § (1), (1a), (6)–(8)', url: 'https://njt.hu/jogszabaly/1995-117-00-00' },
    { id: 'tv-2025-13', title: '2025. évi XIII. törvény – 30 év alatti anyák kedvezménye', url: 'https://njt.hu/jogszabaly/2025-13-00-00' },
    { id: 'tv-2025-14', title: '2025. évi XIV. törvény – két gyermeket nevelő anyák kedvezménye', url: 'https://njt.hu/jogszabaly/2025-14-00-00' },
    { id: 'tv-2025-15', title: '2025. évi XV. törvény – három gyermeket nevelő anyák kedvezménye', url: 'https://njt.hu/jogszabaly/2025-15-00-00' },
    { id: 'tbj', title: '2019. évi CXXII. törvény (Tbj.) 34–36. §, 40. §, 80–81. § – családi járulékkedvezmény', url: 'https://njt.hu/jogszabaly/2019-122-00-00' },
    { id: 'szocho-tv', title: '2018. évi LII. törvény (Szocho tv.) 5. § (1a)', url: 'https://njt.hu/jogszabaly/2018-52-00-00' },
    {
      id: 'nav-73',
      title: 'NAV 73. sz. információs füzet – Szja-adóalap-kedvezmények 2026 (2026.03.19)',
      url: 'https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/73.-Szja-adoalap-kedvezmenyek-2026.-03.19',
    },
    { id: 'ksh-atlagkereset', title: 'KSH bruttó átlagkereset 2025. július (Hivatalos Értesítő 52/2025)', url: 'https://www.ksh.hu' },
    {
      id: 'ngm-10-2025',
      title: '10/2025. (IV. 30.) NGM rendelet a 2026. évi munkaszüneti napok körüli munkarendről',
      url: 'https://njt.jog.gov.hu/jogszabaly/2025-10-20-2X',
    },
    {
      id: 'szcsm-4-2026',
      title: '4/2026. (XI. 13.) SZCSM rendelet – hatályon kívül helyezte a 10/2025. NGM r. 2. § c) pontját (2026.12.12. nem munkanap)',
      url: 'https://njt.jog.gov.hu/jogszabaly/2025-10-20-2X',
    },
    {
      id: 'katv',
      title: '2022. évi XIII. törvény a kisadózó vállalkozások tételes adójáról (Kata tv.) 5. § (1) e), g), (3a); 7. § (1)–(10); 10. §',
      url: 'https://njt.jog.gov.hu/jogszabaly/2022-13-00-00',
    },
    {
      id: 'nav-99',
      title: 'NAV 99. sz. információs füzet – Kisadózó vállalkozók tételes adója (kata), 2026.02.20',
      url: 'https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fnezzen-utana%2Finf_fuz%2F2026%2F99.-Kisadozo-vallalkozok-teteles-adoja-kata-2026.-02.-20',
    },
    {
      id: 'nav-szamlaszamok-2026',
      title: 'NAV adóztatási számlaszámok (2026.11.01-től) – 288 kata, 103 szja, 138 késedelmi pótlék, 215 bírság/önellenőrzés',
      url: 'https://nav.gov.hu/print/ugyfeliranytu/szamlaszamok/szamlaszamok/nav-adoztatasi-szamlaszamok',
    },
  ],
};
