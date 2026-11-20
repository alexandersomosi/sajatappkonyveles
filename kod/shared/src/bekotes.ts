// SPEC §26 content contract for the onboarding page and the self-service guides:
//   - explainers "Mi ez? / Miért kell? / Hol találod?" for every onboarding item (order 5),
//   - the "Készítsd elő" list of the new-business guide (order 8),
//   - the common activities of our target group (search in the new-business form, order 1/7),
//   - the two guide templates "Mit hova jelölj" (orders 7 and 9; the pictures are the annotated NAV screenshots),
//   - tiny validators.
// NO imports on purpose: jogi and nav-kliens compile every _shared/*.ts with NodeNext (relative imports would need
// extensions), and index.ts re-exports this file next to enums.ts, so no name here may repeat a name of enums.ts.
// All texts are DEFAULTS. The backend serves them as editable content texts (SPEC §26.8); the app uses them only as an
// offline fallback. Placeholders: {firstName} = the accountant's first name, {havidij} = "19 999 Ft" (SPEC §28.K.1).
// [KÖNYVELŐ] reviews every text before go-live; [JOGI] reviews the ones marked in SPEC §26.12.

// ---------------------------------------------------------------------------------------------------------------------
// Explainers
// ---------------------------------------------------------------------------------------------------------------------
export const EXPLAINER_KEYS = [
  'vallalkozas_van_e',
  'adoazonosito_jel',
  'telefonszam',
  'lakcim',
  'adoszam',
  'ev_nyilvantartasi_szam',
  'tevekenyseg',
  'koltseghanyad',
  'jogallas',
  'vallalkozo_miota',
  'elozo_konyvelo',
  'kulon_bankszamla',
  'kizaro_okok',
  'varhato_bevetel',
  'szekhely',
  'szekhely_jogcim',
  'telephely',
  'kozossegi_adoszam',
  'kezdes_napja',
  'taj_szam',
  'szuletesi_adatok',
  'atalanyadozas',
  'alanyi_afa_mentesseg',
  'kata_penzforgalmi',
  'ugyfelkapu_dap',
  'vallalkozoi_ugyseged',
  'nav_igazolas_pdf',
  'szerzodes',
  'elofizetes',
  'nav_meghatalmazas',
  'szemelyi_foto',
  'lakcimkartya_foto',
  'pmt_nyilatkozatok',
  'nav_bekotes',
  'visszahivas',
  // SPEC §27 (owner orders 11-19)
  'fiok',
  'utvaltas',
  'kiallitott_szamlak',
  'helyettunk_vallalkozas',
  'helyettunk_meghatalmazas',
  'meghatalmazas_jovahagyas',
  'kamarai_regisztracio',
  'konyvelovaltas',
  'szuletesi_nev',
  'anyja_szuletesi_neve',
  'okmany_szama',
  'okmany_ervenyesseg',
  // 11-19 javítás: the journey row 'Adataid' has its own "Mi ez?"
  'adataid',
  // SPEC §28 (texts: EXPLAINERS_28 at the end of this file)
  'felretesz_miert',
  'kereset_miert',
  'kedvezmenyek',
  'csaladi_jarulekkedvezmeny',
  'valtozas_hub',
  'ugyseged_valtozas',
  'onya_t101e',
  // SPEC §28.K
  'heti_36_ora',
  'alkalmazott_efo',
  'kata',
  'kata_keret',
  'eves_zaras',
  'zarolas',
  'tovabbito_email',
  'rendelkezesre_allasi_dij',
] as const;
export type ExplainerKey = (typeof EXPLAINER_KEYS)[number];

/** Approved realistic 3D icons (enums ICON3D + ICON3D_EXTRA), repeated here because this file has no imports. */
export type ExplainerIcon =
  | 'fiok'
  | 'igazolas'
  | 'irat'
  | 'dosszie'
  | 'szamolo'
  | 'boritek'
  | 'tepnaptar'
  | 'bevallas'
  | 'kerdezek'
  | 'szamlaszam'
  | 'lakat'
  | 'fotozas'
  | 'szamlak'
  | 'ora'
  | 'uzenetek'
  | 'befizetve';
/** Approved front-view object pictures (assets/illusztraciok, 160×120 pt box). */
export type ExplainerIllustration = 'meghatalmazas_alairva' | 'tepnaptar_3d' | 'level_boritek' | 'dosszie_mappa' | 'befizetve_pecset';
/** Onboarding step names, repeated from enums (no imports). */
export type ExplainerStep = 'fiok' | 'adatok' | 'vallalkozas_inditas' | 'szerzodes' | 'elofizetes' | 'meghatalmazas' | 'azonositas' | 'nav_bekotes';

export interface ExplainerDefault {
  key: ExplainerKey;
  /** Sheet title. */
  title: string;
  /** "Mi ez?" */
  what: string;
  /** "Miért kell?" */
  why: string;
  /** "Hol találod?" – may hold numbered lines ("1. …\n2. …"); https:// URLs are rendered as links. */
  where: string;
  /** 3D icon shown at 44 pt next to the title (never a line icon, never a pastel circle). */
  icon: ExplainerIcon;
  /** Optional object picture shown above the three blocks. */
  illustration?: ExplainerIllustration;
  /** The step card whose "Mi ez?" link opens this sheet (one explainer per step card, SPEC §26.8.2). */
  step?: ExplainerStep;
  /** Form field ids (dot paths of the API input) that get a "Hol találom?" link opening this sheet. */
  fields: string[];
}

export const ONBOARDING_EXPLAINERS: readonly ExplainerDefault[] = [
  {
    key: 'vallalkozas_van_e',
    title: 'Van már egyéni vállalkozásod?',
    what: 'Azt kérdezzük, be vagy-e már jelentve egyéni vállalkozóként. Ha igen, van adószámod, és az a számláidon is szerepel.',
    why: 'Ha már van vállalkozásod, átvesszük a könyvelését. Ha még nincs, választhatsz: lépésről lépésre megmutatjuk, mit hova jelölj, és magad jelented be (kb. negyedóra), vagy kérheted, hogy intézzük helyetted.',
    where: 'Ha nem tudod biztosan, nézd meg egy korábbi számládat vagy a NAV leveleit. Ha rossz gombot nyomsz, később is módosíthatod. Ha így sem világos, kérj visszahívást, és megnézzük együtt.',
    icon: 'kerdezek',
    fields: ['businessStatus'],
  },
  {
    key: 'adataid',
    title: 'Adataid',
    what: 'Pár adat rólad: a neved, a telefonszámod, az adóazonosító jeled és a lakcímed. Ha már van vállalkozásod, az adószámod, a tevékenységed és az, hogy mellette dolgozol-e máshol. Kb. 3 perc.',
    why: 'Ezekkel azonosít a NAV, ezekkel köti meg {firstName} veled a szerződést, és ebből tudja, mennyi adót és járulékot fizetsz. A telefonszámodon hívunk, ha elakadsz.',
    where: 'Az adóazonosító jeled az adóigazolványodon van, a lakcímed a lakcímkártyádon. Amit egyszer beírtál, megmarad: ha félbehagyod, később ott folytatod.',
    icon: 'fiok',
    step: 'adatok',
    fields: [],
  },
  {
    key: 'adoazonosito_jel',
    title: 'Adóazonosító jel',
    what: 'Tízjegyű szám, 8-assal kezdődik. Ez a te személyes azonosítód a NAV-nál, egész életedre szól.',
    why: 'Ezzel azonosít a NAV. Enélkül {firstName} nem intézheti az adóügyeidet, és vállalkozást sem lehet bejelenteni.',
    where: 'Az adóigazolványodon (régi nevén adókártya). Ha nincs meg, rajta van a bérpapírodon, a NAV leveleiben és az SZJA-bevallásod tervezetén is.',
    icon: 'igazolas',
    fields: ['adoazonositoJel'],
  },
  {
    key: 'telefonszam',
    title: 'Telefonszám',
    what: 'Az a szám, amelyen el tudunk érni.',
    why: 'Ezen hív a csapatunk, ha visszahívást kérsz, vagy ha egyeztetni kell valamit.',
    where: 'A saját mobilszámod. Telefonon soha nem kérjük a jelszavadat, a belépési kódjaidat vagy a kártyaadataidat.',
    icon: 'kerdezek',
    fields: ['phone'],
  },
  {
    key: 'lakcim',
    title: 'Lakcím',
    what: 'A hivatalos lakcímed, ahogy a lakcímkártyádon szerepel.',
    why: 'Ez kell a szerződéshez, a meghatalmazáshoz és a NAV-os ügyekhez.',
    where: 'A lakcímkártyád lakcímes oldalán.',
    icon: 'boritek',
    fields: ['address.zip', 'address.city', 'address.line'],
  },
  {
    key: 'adoszam',
    title: 'Adószám',
    what: 'A vállalkozásod adószáma, így néz ki: 12345678-1-23. Nem ugyanaz, mint az adóazonosító jeled.',
    why: 'Ezen a számon fut a vállalkozásod a NAV-nál. Ezzel töltjük le a kiállított számláidat a NAV rendszeréből, és ezt írod a befizetéseid közleményébe.',
    // SPEC §28.K.9: the five places, plain words ("Most nem tudom" → the manual form; the accountant fills it later).
    where:
      '1. Bármelyik számlád tetején, amit kiállítottál: az eladó (te) adószáma.\n2. A számlázóprogramod beállításaiban (például Billingo, Számlázz.hu).\n3. A NAV leveleiben.\n4. A NAV Ügyfélportálon belépés után, a „Saját adatok” dobozban.\n5. Az egyéni vállalkozói nyilvántartásba vételről kapott értesítésen.\nHa most nem találod, koppints a „Most nem tudom” gombra: {firstName} később kitölti.',
    icon: 'irat',
    fields: ['adoszam'],
  },
  {
    key: 'ev_nyilvantartasi_szam',
    title: 'Nyilvántartási szám',
    what: 'Az egyéni vállalkozók nyilvántartásában ez a te számod.',
    why: 'Nem kötelező, de segít, hogy gyorsan megtaláljunk a nyilvántartásban.',
    where: 'A nyilvántartásba vételről kapott értesítésen. Ha nincs meg, hagyd üresen.',
    icon: 'irat',
    fields: ['evNyilvantartasiSzam'],
  },
  {
    key: 'tevekenyseg',
    title: 'Mivel foglalkozol (ÖVTJ)',
    what: 'Az ÖVTJ az egyéni vállalkozói tevékenységek hivatalos listája. Minden munkának van benne egy sora és egy kódja.',
    why: 'Ezzel kell bejelenteni a vállalkozást, és ebből derül ki, mennyi költséget vonhatsz le átalányban. Az egyik tevékenységed lesz a főtevékenység: amiből a legtöbb bevételed lesz.',
    where: 'Keresd meg a listánkban a saját szavaiddal, például „fotózás” vagy „programozás”. Ha nem találod, írd le, mit csinálsz, és segítünk. Ha már van vállalkozásod, a nyilvántartásba vételről kapott értesítésen is rajta van.',
    icon: 'dosszie',
    fields: ['activityText', 'activityAnswer', 'activities', 'activityFreeText'],
  },
  {
    key: 'koltseghanyad',
    title: 'Költséghányad',
    what: 'Átalányadónál nem kell számlákkal igazolnod a költségeidet. A bevételed egy részét a törvény eleve költségnek veszi: 2026-ban általában 45%-ot, egyes munkáknál 80 vagy 90%-ot. 2027-től az általános 50% lesz.',
    why: 'Ettől függ, mennyi adót és járulékot fizetsz. Minél nagyobb a költséghányad, annál kisebb az adód.',
    where: 'Nem kell keresned. A tevékenységed alapján javaslunk egyet, és {firstName} megerősíti.',
    icon: 'szamolo',
    fields: [],
  },
  {
    key: 'jogallas',
    title: 'Főállásban vagy mellékállásban',
    what: 'Az számít, hogy a vállalkozás mellett van-e más munkád, tanulsz-e nappalin, vagy nyugdíjas vagy. A NAV ezt a munkavégzés jellegének hívja.',
    why: 'Ettől függ, mennyi járulékot fizetsz. Főállásban akkor is van egy legkisebb összeg, ha kevés a bevételed. Mellékállásban és nyugdíj mellett ez nincs. GYED, CSED vagy táppénz mellett más a szabály: ezt {firstName} megnézi veled.',
    where: 'Mellékállású vagy, ha mellette legalább heti 36 órás munkaviszonyod van, vagy nappali tagozaton tanulsz. Nyugdíjasként akkor adózol, ha saját jogú nyugdíjat kapsz, például öregségi nyugdíjat. Minden más esetben főállású vagy.',
    icon: 'fiok',
    fields: ['taxStatus', 'workKind'],
  },
  {
    key: 'vallalkozo_miota',
    title: 'Mióta vagy vállalkozó',
    what: 'Az a nap, amikor a vállalkozásod elindult.',
    why: 'Ettől függ, melyik negyedévtől számolunk, és mit kell átvennünk az előző könyvelődtől.',
    where: 'A nyilvántartásba vételről kapott értesítésen. Ha nem tudod pontosan, elég a hónap.',
    icon: 'tepnaptar',
    fields: ['evSince'],
  },
  {
    key: 'elozo_konyvelo',
    title: 'Eddigi könyvelőd',
    what: 'Az a könyvelő vagy iroda, amelyik eddig intézte az adóidat.',
    why: 'Tőle kérjük át az idei adatokat, hogy semmi ne vesszen el, és ne fizess kétszer.',
    where: 'A vele kötött szerződésen vagy a számláin. Ha eddig magad intézted, hagyd üresen.',
    icon: 'irat',
    fields: ['previousAccountant'],
  },
  {
    key: 'kulon_bankszamla',
    title: 'Külön számla a vállalkozásnak',
    what: 'Egy bankszámla, amelyet csak a vállalkozásodra használsz.',
    why: 'Nem kötelező, de egyszerűbb: {firstName} könnyebben látja a bevételeidet a kivonaton.',
    where: 'A bankod alkalmazásában látod, milyen számláid vannak. Ha nincs külön, nem baj, később is nyithatsz.',
    icon: 'szamlaszam',
    fields: ['hasSeparateBusinessAccount'],
  },
  {
    key: 'kizaro_okok',
    title: 'Ki lehet egyéni vállalkozó?',
    what: 'Egyéni vállalkozó magyar vagy más EGT-országbeli állampolgár lehet, vagy akinek ehhez megfelelő tartózkodási joga van (például letelepedett vagy menekült). A törvény szerint nem lehet egyéni vállalkozó, aki kiskorú, gondnokság alatt áll, bizonyos bűncselekmény miatt még nem mentesült, betéti vagy közkereseti társaság beltagja, vagy egyéni cég tagja. Egyszerre csak egy egyéni vállalkozásod lehet.',
    why: 'A bejelentésben erről nyilatkoznod kell. Ha valamelyik rád igaz, a NAV elutasítja a bejelentést.',
    where: 'Nem kell keresned semmit. Ha bizonytalan vagy, ne pipáld be, hanem kérj visszahívást.',
    icon: 'irat',
    fields: ['declarations.noExclusion'],
  },
  {
    key: 'varhato_bevetel',
    title: 'Mennyi bevételre számítasz?',
    what: 'Egy becslés: nagyjából mennyit számlázol majd egy év alatt.',
    why: 'ÁFA nélkül, alanyi adómentesen évi 20 millió forintig dolgozhatsz (2026). Ha év közben indulsz, az indulás évében ez a határ arányosan kisebb: júliusi kezdésnél például kb. 10 millió. Szolgáltatásunk az ÁFA-mentes vállalkozóknak szól. Átalányadózóként 2026-ban legfeljebb 38 736 000 Ft lehet az éves bevételed; ez is arányosan kisebb, ha év közben indulsz.',
    where: 'Nem kell pontosnak lennie. Gondold végig, hány megbízásod lesz egy hónapban, és nagyjából mennyit kérsz egyért.',
    icon: 'szamolo',
    fields: ['revenueBand'],
  },
  {
    key: 'szekhely',
    title: 'Székhely',
    what: 'A vállalkozásod hivatalos címe. Ide jönnek a hivatalos levelek, és itt őrzöd az iratokat.',
    why: 'A bejelentéshez kötelező. Fontos: a székhely címe nyilvános lesz, bárki megnézheti a nyilvántartásban.',
    where: 'Legtöbbször a saját lakcímed. Ha nem szeretnéd, hogy az otthoni címed nyilvános legyen, választhatsz székhelyszolgáltatót.',
    icon: 'boritek',
    fields: ['seat.kind', 'seat.address'],
  },
  {
    key: 'szekhely_jogcim',
    title: 'Jogosan használhatod a címet?',
    what: 'Székhely csak olyan cím lehet, amely a tiéd, vagy amelyet jogosan használhatsz: például bérled, vagy a tulajdonos megengedte.',
    why: 'Ezt a törvény kéri. A bejelentéshez papírt nem kell csatolni, de ha kérdezik, igazolnod kell.',
    where: 'Ha bérled: a bérleti szerződésed. Ha a tulajdonos engedte meg: kérj tőle egy rövid, aláírt hozzájárulást, és tedd el. Székhelyszolgáltatónál a vele kötött szerződés.',
    icon: 'irat',
    fields: ['seat.right', 'seat.provider.name', 'seat.provider.adoszam'],
  },
  {
    key: 'telephely',
    title: 'Telephely, fióktelep',
    what: 'Ha a székhelyeden kívül másik címen is dolgozol állandóan, például üzletben vagy műhelyben, az telephely (ugyanazon a településen) vagy fióktelep (másik településen).',
    why: 'Ezeket is be kell jelenteni. Ha csak otthonról vagy az ügyfeleidnél dolgozol, nincs telephelyed.',
    where: 'Gondold végig, van-e saját üzleted, irodád vagy műhelyed. Ha nincs, válaszd a „Nincs” lehetőséget.',
    icon: 'boritek',
    fields: ['otherSites'],
  },
  {
    key: 'kozossegi_adoszam',
    title: 'Közösségi adószám',
    what: 'Külön szám ahhoz, hogy más EU-országbeli cégeknek dolgozz, vagy tőlük szolgáltatást vegyél, például online hirdetést.',
    why: 'Ha ilyet csinálsz, kell. Ilyenkor ÁFA-bevallást és összesítő nyilatkozatot is kell adni, ezt {firstName} külön megbeszéli veled.',
    where: 'Ha nem tudod, válaszd a „Nem tudom” lehetőséget. Ilyenkor most ne kérd, később is bármikor igényelheted.',
    icon: 'bevallas',
    fields: ['euPartner'],
  },
  {
    key: 'kezdes_napja',
    title: 'Mikor indulsz?',
    what: 'Az a nap, amikor a vállalkozásod hivatalosan elindul.',
    why: 'A vállalkozás azon a napon indul, amikor beküldöd a bejelentést. Előre dátumot nem lehet megadni. Számlát csak ettől a naptól adhatsz.',
    where: 'Te döntöd el. Azon a napon küldd be a bejelentést, amikor indulni szeretnél.',
    icon: 'tepnaptar',
    illustration: 'tepnaptar_3d',
    fields: ['startPlan', 'startDate'],
  },
  {
    key: 'taj_szam',
    title: 'TAJ-szám',
    what: 'Kilencjegyű szám, a társadalombiztosítási azonosítód. Ezzel jársz orvoshoz is.',
    why: 'Mi nem kérjük el és nem tároljuk. A NAV-os bejelentés Személyi adatok lapja általában nem kéri; ha mégis, a TAJ-kártyádról írd be.',
    where: 'A TAJ-kártyádon. Ha nincs kéznél, rajta van a bérpapírodon és az orvosi papírjaidon is.',
    icon: 'igazolas',
    fields: [],
  },
  {
    key: 'szuletesi_adatok',
    title: 'Születési adatok, anyukád neve',
    what: 'A születési neved, a születési helyed és időd, anyukád születési neve és az állampolgárságod.',
    why: 'A bejelentésben a törvény kéri. A NAV-os űrlap ezt a lapot a nyilvántartásból tölti ki, neked csak át kell nézned. Mi ezeket a bejelentéshez nem kérjük el.',
    where: 'A születési helyed és időd a személyi igazolványodon van, anyukád születési neve a születési anyakönyvi kivonatodon. Ha a NAV-os űrlapon valami nem stimmel, ne ott javítsd: fordulj a NAV-hoz.',
    icon: 'fiok',
    fields: [],
  },
  {
    key: 'atalanyadozas',
    title: 'Átalányadózás',
    what: 'Egyszerű adózási mód egyéni vállalkozóknak: a bevételed egy részét a törvény eleve költségnek veszi, a többi után fizetsz adót és járulékot.',
    why: 'Szolgáltatásunk erre épül. Nem kell számlákkal igazolnod a költségeidet, és sokszor ez a legolcsóbb.',
    where: 'A NAV-os bejelentés „Adózási adatok” lapján kell bejelölni. Az útmutatóban megmutatjuk, hol.',
    icon: 'szamolo',
    fields: [],
  },
  {
    key: 'alanyi_afa_mentesseg',
    title: 'Alanyi ÁFA-mentesség',
    what: 'Ha az éves bevételed nem éri el a 20 millió forintot (2026), nem kell ÁFÁ-t felszámolnod és ÁFA-bevallást adnod. Az indulás évében ez a határ arányosan kisebb.',
    why: 'Szolgáltatásunk ÁFA-mentes vállalkozóknak szól. Most, a bejelentéssel együtt kell választanod: ha kimarad, idén ÁFÁ-t kell felszámolnod, és legközelebb csak a következő évtől választhatod. Ezért nagyon fontos, hogy bejelöld.',
    where: 'A NAV-os bejelentés „Adózási adatok” lapján, az áfamentességnél. Az útmutatóban megmutatjuk, hol.',
    icon: 'bevallas',
    fields: [],
  },
  {
    key: 'kata_penzforgalmi',
    title: 'Kata és pénzforgalmi elszámolás',
    what: 'Két másik választási lehetőség a NAV-os űrlapon. A kata egy másik adózási mód, a pénzforgalmi elszámolás pedig egy ÁFA-szabály.',
    why: 'Neked egyik sem kell: átalányadózó és ÁFA-mentes leszel. Ha bejelölnéd, más szabályok szerint kellene adóznod.',
    where: 'A NAV-os bejelentés „Adózási adatok” lapján. Ezeket hagyd üresen.',
    icon: 'bevallas',
    fields: [],
  },
  {
    key: 'ugyfelkapu_dap',
    title: 'Ügyfélkapu+ vagy DÁP',
    what: 'A két állami belépés. Az Ügyfélkapu+ felhasználónév, jelszó és egy egyszer használatos kód. A DÁP (Digitális Állampolgárság) egy telefonos alkalmazás.',
    why: 'Ezzel lépsz be a NAV oldalaira: így jelentheted be a vállalkozásodat, és így adhatod meg vagy hagyhatod jóvá a meghatalmazást. Akkor is kell, ha mi intézzük helyetted: a jóváhagyás a te dolgod.',
    where: 'A DÁP alkalmazást az App Store-ból vagy a Google Play-ből töltheted le, és végigvezet a regisztráción. Ügyfélkapu+-hoz bármelyik kormányablakban is segítenek. Ha elakadsz a belépéssel, hívd az 1818-at, a Kormányzati Ügyfélvonalat.',
    icon: 'igazolas',
    fields: [],
  },
  {
    key: 'vallalkozoi_ugyseged',
    title: 'NAV Vállalkozói Ügysegéd',
    what: 'A NAV bejelentő oldala, ahol egyéni vállalkozást lehet bejelenteni. 2026 februárja óta itt kell intézni. Mobilon is jól használható.',
    why: 'Itt jelented be a vállalkozásodat, ingyen. Telefonhívással vagy postán nem lehet, csak itt vagy személyesen a NAV ügyfélszolgálatán.',
    where: 'https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main – Ügyfélkapu+-szal vagy DÁP-pal lépsz be.',
    icon: 'dosszie',
    fields: [],
  },
  {
    key: 'nav_igazolas_pdf',
    title: 'A NAV-os értesítés (PDF)',
    what: 'A bejelentés után a NAV értesítést ad arról, hogy nyilvántartásba vett. Ezen az adószámod is rajta van.',
    why: 'Ebből látjuk, hogy minden jól ment: átalányadó, ÁFA-mentesség, tevékenységek. Ha valami hiányzik, időben szólunk.',
    where: 'A Vállalkozói Ügysegédben, a „Bejelentéseim, kérelmeim” fülön: Megtekintés, majd Letöltés. Ha elmentetted a telefonodra, a letöltések között találod. Fotó is jó, ha minden olvasható rajta.',
    icon: 'irat',
    fields: ['file'],
  },
  {
    key: 'szerzodes',
    title: 'Szerződés',
    what: 'Három rövid irat: az általános feltételek, az adatkezelési tájékoztató és a megbízási szerződés.',
    why: 'Ezekben áll, mit vállalunk, mennyibe kerül, és hogyan vigyázunk az adataidra.',
    where: 'Itt olvashatod el őket az alkalmazásban, és PDF-ben is letöltheted.',
    icon: 'irat',
    step: 'szerzodes',
    fields: [],
  },
  {
    key: 'elofizetes',
    title: 'Előfizetés',
    what: 'A havidíj: {havidij} havonta, bankkártyával. Bármikor lemondhatod.',
    why: 'Ebből fizetjük a könyvelődet és a szolgáltatást. Ha most indítod a vállalkozásodat, csak akkor kérjük a kártyádat, amikor már megvan az adószámod.',
    where: 'A fizetés a SimplePay biztonságos oldalán történik. A kártyádat a Fiók oldalon bármikor törölheted.',
    icon: 'szamlaszam',
    step: 'elofizetes',
    fields: [],
  },
  {
    key: 'nav_meghatalmazas',
    title: 'NAV-meghatalmazás',
    what: 'Egy nyilatkozat a NAV felé, hogy {firstName} intézheti helyetted az adóügyeidet.',
    why: 'Enélkül {firstName} nem adhatja be a bevallásaidat, és nem láthatja a NAV-nál az adataidat. A meghatalmazás hozzád mint személyhez kötődik, ezért a vállalkozásodra is érvényes.',
    where: 'Kétféleképpen: magad adod meg az ONYA-ban (onya.nav.gov.hu, kb. 5 perc, lépésről lépésre megmutatjuk), vagy {firstName} küldi be, és te csak jóváhagyod. Mindkettőhöz Ügyfélkapu+ vagy DÁP kell.',
    icon: 'igazolas',
    illustration: 'meghatalmazas_alairva',
    step: 'meghatalmazas',
    fields: [],
  },
  {
    key: 'szemelyi_foto',
    title: 'Fotó az igazolványodról',
    what: 'A személyi igazolványod két oldala, vagy az útleveled adatoldala, vagy a kártyás jogosítványod két oldala.',
    why: 'A pénzmosás elleni törvény szerint {firstName} csak akkor vállalhatja a könyvelésedet, ha azonosított. Titkosítva tároljuk, csak ő látja.',
    where: 'Tedd az igazolványt egy sima, világos felületre, és fotózd le úgy, hogy mind a négy sarka látsszon, és ne csillogjon.',
    icon: 'fotozas',
    step: 'azonositas',
    fields: ['idFront', 'idBack'],
  },
  {
    key: 'lakcimkartya_foto',
    title: 'Fotó a lakcímkártyádról',
    what: 'A lakcímkártyádnak csak a lakcímes oldala.',
    why: 'Ebből látjuk a lakcímedet. A hátoldalát ne fotózd le: azon a személyi azonosítód van, amelyet a törvény szerint nem másolhatunk.',
    where: 'A lakcímkártyádon az az oldal, amelyiken a címed áll.',
    icon: 'fotozas',
    fields: ['addressFront'],
  },
  {
    key: 'pmt_nyilatkozatok',
    title: 'Nyilatkozatok',
    what: 'Pár rövid kérdés: a saját nevedben jársz-e el, és kiemelt közszereplő vagy-e (például politikus, magas rangú állami vezető).',
    why: 'A pénzmosás elleni törvény kéri minden könyvelőtől.',
    where: 'Nem kell keresned semmit, csak válaszolj őszintén. Ha valami változik, 5 munkanapon belül szólj.',
    icon: 'irat',
    fields: ['declarations'],
  },
  {
    key: 'nav_bekotes',
    title: 'Kiállított számlák bekötése',
    what: '{firstName} összeköti a fiókodat a NAV számlarendszerével (Online Számla). Utána a kiállított számláid maguktól megjelennek itt.',
    why: 'Minden számla, amit a számlázóprogramodban kiállítasz, bekerül a NAV rendszerébe. Mi onnan töltjük le, így nem kell feltöltened őket, és mindig látod, mennyi adót kell fizetned.',
    where: 'Neked ezzel nincs teendőd: {firstName} intézi, ha megvan a meghatalmazás. Általában 1–2 munkanap.',
    icon: 'szamlak',
    step: 'nav_bekotes',
    fields: [],
  },
  {
    key: 'visszahivas',
    title: 'Visszahívás',
    what: 'Ha elakadsz, kérj visszahívást, és a csapatunkból valaki 24–48 órán belül felhív.',
    why: 'Telefonon gyorsabb megbeszélni, ha valami nem világos. Nem feltétlenül {firstName} hív elsőként, hanem valaki a csapatunkból.',
    where: 'Minden lépésnél ott az „Elakadtál? Kérj visszahívást” gomb. Telefonon soha nem kérjük a jelszavadat, a kódjaidat vagy a kártyaadataidat.',
    icon: 'ora',
    fields: [],
  },
  // ---------- SPEC §27 ----------
  {
    key: 'fiok',
    title: 'Fiók',
    what: 'A belépésed az alkalmazásba: az e-mail-címed és a jelszavad.',
    why: 'Ezzel éred el a könyvelésedet, és ide küldjük az értesítéseket.',
    where: 'Ez már kész: akkor csináltad, amikor regisztráltál. A Fiók fülön bármikor módosíthatod.',
    icon: 'fiok',
    step: 'fiok',
    fields: [],
  },
  {
    key: 'utvaltas',
    title: 'Módosíthatod a válaszodat',
    what: 'Ha rossz gombot nyomtál, vagy kiderült, hogy mégis van vállalkozásod (vagy mégsincs), módosíthatod.',
    why: 'Ettől függ, milyen lépések jönnek. Amit eddig beírtál, megmarad.',
    where: 'A Főoldalon, a lépések tetején: „Módosítom”. Ha a bejelentésed már elment a NAV-hoz, vagy megadtad az adószámodat, kérj visszahívást, és segítünk.',
    icon: 'kerdezek',
    fields: [],
  },
  {
    key: 'kiallitott_szamlak',
    title: 'Kiállított számlák',
    what: 'Minden számla, amit a számlázóprogramodban kiállítasz (például Számlázz.hu, Billingo vagy a webshopod), automatikusan bekerül a NAV rendszerébe. Mi onnan töltjük le.',
    why: 'Így a kiállított számláidat nem kell feltöltened. Ezek a bevételeid: ebből számoljuk az adódat.',
    where: 'A Dosszié fülön, hónaponként, a „Kiállított számlák” résznél. Ami nincs benne: a számla nélküli eladás, például a nyugta. Ezt külön jelezd: a Fotózás gombbal töltsd fel. A költségeidről szóló számlák nem kellenek: átalányadónál a törvény a bevételed egy részét eleve költségnek veszi.',
    icon: 'szamlak',
    fields: [],
  },
  {
    key: 'helyettunk_vallalkozas',
    title: 'Intézzük helyetted: vállalkozás bejelentése',
    what: 'Ha nem boldogulsz a NAV oldalával, {firstName} bejelenti helyetted a vállalkozásodat. Meghatalmazottként, a saját belépésével teszi, a te engedélyeddel.',
    why: 'Így neked nem kell kitöltened a NAV-os űrlapot. A te dolgod csak ennyi: a rövid kérdőív, egy jóváhagyás a NAV oldalán, és a végső engedély itt az alkalmazásban.',
    where: 'Kérj visszahívást az „Ezt kérem” gombbal: 24–48 órán belül hívunk, és mindent elmondunk. A belépési adataidat soha nem kérjük el. A jóváhagyáshoz Ügyfélkapu+ vagy DÁP kell; ha nincs, a hívásban segítünk.',
    icon: 'bevallas',
    fields: [],
  },
  {
    key: 'helyettunk_meghatalmazas',
    title: 'Megcsináljuk helyetted a meghatalmazást',
    what: '{firstName} beküldi a NAV-nak a meghatalmazást. Te csak jóváhagyod az ONYA-ban, ez kb. 3 perc.',
    why: 'Így nem kell kitöltened a meghatalmazás űrlapját, és nem tudsz rossz rovatot jelölni.',
    where: 'Kérj visszahívást az „Ezt kérem” gombbal: elmondjuk, mi jön. Ha {firstName} beküldte, értesítést kapsz, és 4 napod van jóváhagyni. A jelszavadat vagy a kódjaidat soha nem kérjük el.',
    icon: 'igazolas',
    illustration: 'meghatalmazas_alairva',
    fields: [],
  },
  {
    key: 'meghatalmazas_jovahagyas',
    title: 'Jóváhagyás az ONYA-ban',
    what: 'Amikor {firstName} beküldi a meghatalmazást, a NAV megkérdezi tőled, hogy rendben van-e. Ezt az ONYA-ban hagyod jóvá.',
    why: 'A meghatalmazás csak a jóváhagyásod után él. Ha 4 napon belül nem hagyod jóvá, a NAV törli, és újra kell kezdeni.',
    where: '1. onya.nav.gov.hu, belépés Ügyfélkapu+-szal vagy DÁP-pal\n2. a saját profilod\n3. Meghatalmazások (piros pötty jelzi)\n4. a „Jóváhagyásra vár” csempe, Megtekintés\n5. Jóváhagyás, és még egyszer a felugró ablakban',
    icon: 'igazolas',
    fields: [],
  },
  {
    key: 'kamarai_regisztracio',
    title: 'Kamarai regisztráció',
    what: 'Minden új egyéni vállalkozónak regisztrálnia kell a területi gazdasági kamaránál, egy rövid űrlapon.',
    why: 'A törvény kéri, 5 munkanapon belül. A kamarai tagsággal évi 5 000 Ft kamarai hozzájárulás jár: ezt a kamara kéri, nem mi.',
    where: 'A kamara oldalán: https://mkik.hu/vallalkozoi-regisztracio. Kell hozzá az adószámod. Ha kész, jelöld itt: „Megcsináltam”.',
    icon: 'irat',
    fields: [],
  },
  {
    key: 'konyvelovaltas',
    title: 'Könyvelőt váltasz?',
    what: 'Ha eddig más könyvelő intézte az adóidat, a váltásnál pár dologra figyelni kell.',
    why: 'Így nem marad ki egy bevallás sem, és semmit nem adunk be kétszer.',
    where: 'Szólj az eddigi könyvelődnek, hogy váltasz. Hogy melyik negyedévtől visszük mi, azt {firstName} megbeszéli veled. A régi meghatalmazást csak akkor vond vissza az ONYA-ban, ha {firstName} szól.',
    icon: 'irat',
    fields: [],
  },
  {
    key: 'szuletesi_nev',
    title: 'Születési név',
    what: 'A neved úgy, ahogy születéskor anyakönyvezték. Ha azóta nem változott, ugyanaz, mint a mostani.',
    why: 'A pénzmosás elleni törvény kéri az azonosításhoz.',
    where: 'A születési anyakönyvi kivonatodon. Ha a neved változott, a személyi igazolványodon is szerepel.',
    icon: 'fiok',
    fields: ['kyc.birthName'],
  },
  {
    key: 'anyja_szuletesi_neve',
    title: 'Anyukád születési neve',
    what: 'Anyukád neve úgy, ahogy ő született (a lánykori neve).',
    why: 'A pénzmosás elleni törvény kéri az azonosításhoz. Titkosítva tároljuk, csak {firstName} látja.',
    where: 'A születési anyakönyvi kivonatodon.',
    icon: 'fiok',
    fields: ['kyc.mothersBirthName'],
  },
  {
    key: 'okmany_szama',
    title: 'Az igazolvány száma',
    what: 'Az igazolványod saját száma, számokból és betűkből áll.',
    why: 'A pénzmosás elleni törvény kéri az azonosításhoz.',
    where: 'Az igazolványod elején vagy az adatoldalán, általában a jobb felső részen.',
    icon: 'igazolas',
    fields: ['kyc.documentNumber'],
  },
  {
    key: 'okmany_ervenyesseg',
    title: 'Érvényes eddig',
    what: 'Az a nap, ameddig az igazolványod érvényes.',
    why: 'Csak érvényes igazolvánnyal lehet azonosítani.',
    where: 'Az igazolványod elején, az érvényességi időnél. Ha már lejárt, előbb újíttasd meg.',
    icon: 'tepnaptar',
    fields: ['kyc.documentValidUntil'],
  },
];

/**
 * SPEC §27.4: field help link wording. "Hol találom?" only where the answer is printed on a document; every other
 * question gets "Mi ez?" (the explainer sheet is the same).
 */
export const WHERE_TO_FIND_EXPLAINERS: readonly ExplainerKey[] = [
  'adoazonosito_jel',
  'lakcim',
  'adoszam',
  'ev_nyilvantartasi_szam',
  'vallalkozo_miota',
  'nav_igazolas_pdf',
  'szuletesi_nev',
  'anyja_szuletesi_neve',
  'okmany_szama',
  'okmany_ervenyesseg',
];

/** Step card → explainer opened by its "Mi ez?" link (SPEC §26.8.2). */
export const STEP_EXPLAINER: Record<ExplainerStep, ExplainerKey> = {
  fiok: 'fiok',
  adatok: 'adataid',
  vallalkozas_inditas: 'vallalkozoi_ugyseged',
  szerzodes: 'szerzodes',
  elofizetes: 'elofizetes',
  meghatalmazas: 'nav_meghatalmazas',
  azonositas: 'szemelyi_foto',
  nav_bekotes: 'nav_bekotes',
};

// ---------------------------------------------------------------------------------------------------------------------
// "Készítsd elő" – opens the new-business guide (order 8). Nothing marked stored:false is ever sent to us.
// ---------------------------------------------------------------------------------------------------------------------
export interface PrepareItem {
  key: string;
  label: string;
  note: string;
  explainer: ExplainerKey;
  /** false = the client types it into the NAV form himself; we never ask for it for the bejelentés. */
  storedByUs: boolean;
  /** The exact line under the item about what we ask for (shown instead of a generic sentence). */
  privacyNote: string | null;
}
export const PREPARE_ITEMS: readonly PrepareItem[] = [
  { key: 'belepes', label: 'Ügyfélkapu+ vagy DÁP a telefonodon', note: 'Ezzel lépsz be a NAV oldalára.', explainer: 'ugyfelkapu_dap', storedByUs: false, privacyNote: 'Ezt nem kérjük el: ezzel te lépsz be.' },
  { key: 'szemelyi', label: 'Személyi igazolvány', note: 'A neved és a születési adataid átnézéséhez.', explainer: 'szuletesi_adatok', storedByUs: false, privacyNote: 'A bejelentéshez nem kérjük el. Az azonosításnál a pénzmosás elleni törvény miatt lefotózod.' },
  { key: 'lakcimkartya', label: 'Lakcímkártya', note: 'A lakcímes oldala kell.', explainer: 'lakcim', storedByUs: false, privacyNote: 'A bejelentéshez nem kérjük el. Az azonosításnál csak a lakcímes oldalát fotózod le.' },
  { key: 'adoazonosito', label: 'Adóigazolvány (adóazonosító jel)', note: 'Tízjegyű, 8-assal kezdődik.', explainer: 'adoazonosito_jel', storedByUs: true, privacyNote: null },
  { key: 'taj', label: 'TAJ-kártya (ha kéri)', note: 'A NAV-os űrlap általában nem kéri.', explainer: 'taj_szam', storedByUs: false, privacyNote: 'Ezt nem kérjük el és nem tároljuk: a NAV-os űrlapba te írod be.' },
  { key: 'anyja_neve', label: 'Anyukád születési neve, a születési helyed és időd', note: 'A NAV tölti ki, te csak átnézed.', explainer: 'szuletesi_adatok', storedByUs: false, privacyNote: 'A bejelentéshez nem kérjük el. Az azonosításnál a pénzmosás elleni törvény miatt kell.' },
  { key: 'szekhely_jogcim', label: 'Mire alapozod a székhelyet', note: 'Saját, bérelt, a tulajdonos engedte, vagy székhelyszolgáltató.', explainer: 'szekhely_jogcim', storedByUs: false, privacyNote: 'Iratot nem kérünk, csak azt, hogy milyen jogon használod.' },
  { key: 'tevekenysegek', label: 'A tevékenységeid', note: 'Az útmutatóban ott lesznek a válaszaid alapján.', explainer: 'tevekenyseg', storedByUs: true, privacyNote: null },
];

// ---------------------------------------------------------------------------------------------------------------------
// Common activities of our target group (search list of the new-business form, SPEC §26.1.3).
// ÖVTJ codes are NOT filled in on purpose: [KÖNYVELŐ] fills `ovtjKod` from the official list before go-live (the NAV
// guide of 2026.03.19 points to KSH ÖVTJ'25: https://www.ksh.hu/osztalyozasok_ovtj25).
// Until then the guide shows `navKereso` (what to type into the NAV activity search), says "a pontos sort még
// egyeztetjük" and HOLDS the Tevékenységek and Bejelentés steps until the team writes the code in the pipeline
// (SPEC §24 11-18 javító): a wrong line can only be fixed after filing, with a változásbejelentés. costClass is only a SUGGESTION (Szja tv. 53. §); 'ellenorizendo' shows no number.
// ---------------------------------------------------------------------------------------------------------------------
export type ActivityCostClass = 'altalanos' | 'lista80' | 'kiskereskedelem' | 'ellenorizendo';
export interface BusinessActivity {
  key: string;
  /** Plain Hungarian label shown in our list. */
  label: string;
  /** Extra search words (lower case, without accents too). */
  keywords: string[];
  /** What to type into the activity search of the NAV Vállalkozói Ügysegéd. */
  navKereso: string;
  costClass: ActivityCostClass;
  /** True when the work may need a qualification or permit (shown as a short note; never blocks). */
  kepesitesKellhet: boolean;
  /** Official ÖVTJ'25 code (6 digits) – filled in by [KÖNYVELŐ]. */
  ovtjKod: string | null;
  /** The exact line label of that code in KSH ÖVTJ'25 – filled in by [KÖNYVELŐ] together with ovtjKod. */
  ovtjNev?: string | null;
}
export const BUSINESS_ACTIVITIES: readonly BusinessActivity[] = [
  { key: 'grafika', label: 'Grafikai tervezés, illusztráció', keywords: ['grafikus', 'grafika', 'design', 'illusztrator', 'logo'], navKereso: 'grafikai', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'web', label: 'Weboldal-készítés, webfejlesztés', keywords: ['web', 'honlap', 'weboldal', 'wordpress', 'frontend'], navKereso: 'programozás', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'szoftver', label: 'Szoftverfejlesztés, programozás', keywords: ['programozo', 'fejleszto', 'szoftver', 'app', 'developer'], navKereso: 'programozás', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'it_tanacsadas', label: 'Informatikai tanácsadás, rendszergazda', keywords: ['it', 'informatikus', 'rendszergazda', 'tanacsado'], navKereso: 'információtechnológiai', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'foto', label: 'Fotózás, képszerkesztés', keywords: ['fotos', 'fotografus', 'foto', 'kep'], navKereso: 'fotó', costClass: 'lista80', kepesitesKellhet: false, ovtjKod: null },
  { key: 'video', label: 'Videókészítés, vágás', keywords: ['video', 'vagas', 'film', 'operator'], navKereso: 'film', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'forditas', label: 'Fordítás, tolmácsolás', keywords: ['fordito', 'tolmacs', 'nyelv'], navKereso: 'fordítás', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'szovegiras', label: 'Szövegírás, újságírás, szerkesztés', keywords: ['szovegiro', 'ujsagiro', 'copywriter', 'blog', 'szerkeszto'], navKereso: 'újságírás', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'marketing', label: 'Online marketing, közösségi média kezelése', keywords: ['marketing', 'social', 'facebook', 'instagram', 'hirdetes'], navKereso: 'reklám', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'uzleti_tanacsadas', label: 'Üzleti tanácsadás, coaching', keywords: ['tanacsado', 'coach', 'mentor', 'consulting'], navKereso: 'tanácsadás', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'oktatas', label: 'Magántanítás, korrepetálás', keywords: ['tanar', 'korrepetalas', 'oktatas', 'magantanar'], navKereso: 'oktatás', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'nyelvoktatas', label: 'Nyelvoktatás', keywords: ['nyelvtanar', 'angol', 'nemet', 'nyelvoktatas'], navKereso: 'nyelvoktatás', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'zene', label: 'Zenetanítás, zenélés', keywords: ['zenetanar', 'zenesz', 'zongora', 'gitar', 'eneklés'], navKereso: 'zene', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'edzo', label: 'Személyi edzés, sportoktatás, jóga', keywords: ['edzo', 'fitness', 'joga', 'sport', 'trener'], navKereso: 'sport', costClass: 'ellenorizendo', kepesitesKellhet: true, ovtjKod: null },
  { key: 'masszazs', label: 'Masszázs', keywords: ['masszor', 'masszazs', 'wellness'], navKereso: 'fizikai közérzet', costClass: 'ellenorizendo', kepesitesKellhet: true, ovtjKod: null },
  { key: 'fodraszat', label: 'Fodrászat', keywords: ['fodrasz', 'haj', 'borbely'], navKereso: 'fodrász', costClass: 'lista80', kepesitesKellhet: true, ovtjKod: null },
  { key: 'kozmetika', label: 'Kozmetika, sminkelés', keywords: ['kozmetikus', 'smink', 'szepsegapolas', 'arc'], navKereso: 'szépségápolás', costClass: 'lista80', kepesitesKellhet: true, ovtjKod: null },
  { key: 'mukorom', label: 'Műköröm, kéz- és lábápolás', keywords: ['mukorom', 'manikur', 'pedikur', 'korom'], navKereso: 'szépségápolás', costClass: 'lista80', kepesitesKellhet: true, ovtjKod: null },
  { key: 'takaritas', label: 'Takarítás', keywords: ['takarito', 'takaritas', 'tisztitas'], navKereso: 'takarítás', costClass: 'ellenorizendo', kepesitesKellhet: false, ovtjKod: null },
  { key: 'kertgondozas', label: 'Kertgondozás', keywords: ['kertesz', 'kert', 'funyiras'], navKereso: 'zöldterület', costClass: 'ellenorizendo', kepesitesKellhet: false, ovtjKod: null },
  { key: 'epitoipar', label: 'Építőipari kivitelezés (épület, út)', keywords: ['epito', 'kivitelezo', 'komuves', 'epitkezes'], navKereso: 'épület', costClass: 'lista80', kepesitesKellhet: true, ovtjKod: null },
  { key: 'szakipar', label: 'Villany-, víz-, gáz- vagy fűtésszerelés', keywords: ['villanyszerelo', 'vizszerelo', 'gazszerelo', 'futes', 'szerelo'], navKereso: 'szerelés', costClass: 'ellenorizendo', kepesitesKellhet: true, ovtjKod: null },
  { key: 'festes_burkolas', label: 'Festés, burkolás, egyéb befejező építés', keywords: ['festo', 'mazolo', 'burkolo', 'gipszkarton'], navKereso: 'festés', costClass: 'ellenorizendo', kepesitesKellhet: false, ovtjKod: null },
  { key: 'gepjarmujavitas', label: 'Autószerelés, gépjárműjavítás', keywords: ['autoszerelo', 'szerviz', 'gumis'], navKereso: 'gépjárműjavítás', costClass: 'lista80', kepesitesKellhet: true, ovtjKod: null },
  { key: 'javitas', label: 'Számítógép, telefon vagy háztartási gép javítása', keywords: ['javitas', 'szerviz', 'telefonjavitas', 'gepjavitas'], navKereso: 'javítás', costClass: 'lista80', kepesitesKellhet: false, ovtjKod: null },
  { key: 'taxi', label: 'Taxi, személyszállítás', keywords: ['taxi', 'sofor', 'szemelyszallitas', 'uber', 'bolt'], navKereso: 'taxi', costClass: 'lista80', kepesitesKellhet: true, ovtjKod: null },
  { key: 'futar', label: 'Futár, áruszállítás', keywords: ['futar', 'szallitas', 'fuvar', 'csomag'], navKereso: 'közúti áruszállítás', costClass: 'ellenorizendo', kepesitesKellhet: true, ovtjKod: null },
  { key: 'jarmuvezeto_oktatas', label: 'Gépjárművezető-oktatás', keywords: ['oktato', 'kreszoktato', 'autosiskola'], navKereso: 'járművezető', costClass: 'lista80', kepesitesKellhet: true, ovtjKod: null },
  { key: 'vendeglatas', label: 'Vendéglátás, büfé, street food', keywords: ['bufe', 'etterem', 'kave', 'street food', 'catering'], navKereso: 'vendéglátás', costClass: 'lista80', kepesitesKellhet: true, ovtjKod: null },
  { key: 'rendezveny', label: 'Rendezvényszervezés', keywords: ['rendezveny', 'eskuvo', 'szervezo', 'event'], navKereso: 'rendezvény', costClass: 'altalanos', kepesitesKellhet: false, ovtjKod: null },
  { key: 'webshop', label: 'Webáruház, online kiskereskedelem', keywords: ['webshop', 'webaruhaz', 'online bolt', 'kiskereskedelem'], navKereso: 'csomagküldő', costClass: 'kiskereskedelem', kepesitesKellhet: false, ovtjKod: null },
  { key: 'piaci_arus', label: 'Piaci árusítás, bolt', keywords: ['piac', 'arus', 'bolt', 'kiskereskedelem'], navKereso: 'kiskereskedelem', costClass: 'kiskereskedelem', kepesitesKellhet: false, ovtjKod: null },
  { key: 'kezmuves', label: 'Kézműves termékek készítése', keywords: ['kezmuves', 'ekszer', 'kerámia', 'varras', 'handmade'], navKereso: 'kézműves', costClass: 'ellenorizendo', kepesitesKellhet: false, ovtjKod: null },
  { key: 'ingatlan', label: 'Ingatlanközvetítés', keywords: ['ingatlan', 'kozvetito', 'ingatlanos'], navKereso: 'ingatlanügynöki', costClass: 'altalanos', kepesitesKellhet: true, ovtjKod: null },
  { key: 'allatgondozas', label: 'Kisállat-kozmetika, kutyasétáltatás', keywords: ['kutya', 'macska', 'allat', 'setaltatas', 'kozmetika'], navKereso: 'állatgondozás', costClass: 'ellenorizendo', kepesitesKellhet: false, ovtjKod: null },
];
/** Shown under the list when the client cannot find his work. */
export const ACTIVITY_NOT_FOUND_TEXT = 'Nem találod? Írd le a saját szavaiddal, mit csinálsz. A bejelentés előtt megnézzük, és megírjuk, melyik sort válaszd.';
export const ACTIVITY_QUALIFICATION_NOTE = 'Ehhez a munkához képesítés vagy engedély kellhet. A bejelentésnél nem kérik, de legyen meg, mielőtt elkezded. A kamara KAVIR oldalán (https://kavir.mkik.hu) megnézheted.';

// ---------------------------------------------------------------------------------------------------------------------
// Guide templates "Mit hova jelölj" (orders 7 and 9). The backend fills the placeholders from the client's answers
// and drops rows whose `when` does not match (SPEC §26.6.2). Step keys = enums GUIDE_STEP_KEYS = image keys.
// Field labels follow the NAV guide (Vállalkozói Ügysegéd útmutató, 2026.03.19, III.3; NAV ÁNYK/ONYA GYIK);
// where the real screen uses a different word, the annotated screenshot shows it.
// ---------------------------------------------------------------------------------------------------------------------
export type GuideTemplateAction = 'jelold' | 'ne_jelold' | 'ird_be' | 'valaszd' | 'ellenorizd' | 'hagyd' | 'kattints';
export type GuideCondition =
  | 'szekhely_lakcim'
  | 'szekhely_mas_cim'
  | 'szekhely_szolgaltato'
  | 'szekhely_nem_lakcim'
  | 'telephely_van'
  | 'telephely_nincs'
  | 'eu_igen'
  | 'eu_nem'
  | 'egyeb_tevekenyseg_van'
  | 'sajat_szavakkal_is'
  | 'szekhely_nem_szolgaltato'
  | 'datumra_indul'
  // SPEC §28.K.13: the tax regime of the new-business questionnaire (answer `taxRegime`; 'nem_tudom' → átalány)
  | 'adozas_atalany'
  | 'adozas_kata'
  // SPEC §28.5.3: change guides
  | 'tevekenyseg_uj_fo'
  | 'tevekenyseg_uj_mellek'
  | 'tevekenyseg_torles';
export interface GuideTemplateField {
  /** The field / checkbox / button as the NAV screen names it. */
  label: string;
  action: GuideTemplateAction;
  /** What to choose or type; may hold placeholders. */
  value?: string;
  /** One short sentence: why. */
  why?: string;
  /** Show a copy button. */
  copy?: boolean;
  /** The copy button copies this placeholder's value instead of the shown value (e.g. only the ÖVTJ code or the
   *  search word, never a whole sentence). No button when that value is empty. */
  copyFrom?: string;
  when?: GuideCondition;
  /** Repeat the row for every other site / every other activity, with per-item placeholders
   *  (telephely: {tNev} {tIrsz} {tTelepules} {tCimSor} {tMiert}; egyeb_tevekenyseg: {aSor} {aMasol} {aRovid}). */
  each?: 'telephely' | 'egyeb_tevekenyseg';
}
export interface GuideTemplateStep {
  key: string;
  /** Screen title as NAV shows it (or our own app screen). */
  screenTitle: string;
  /** What to do on this screen, 1–2 short sentences. */
  text: string;
  fields: GuideTemplateField[];
  /** Amber box. */
  warning?: string;
  link?: { label: string; url: string };
  /** true = a screen of our own app (no NAV picture expected). */
  ownApp?: boolean;
  /** Whose screen it is (header of the step sheet): NAV (default), the chamber's site, or our app. */
  screenKind?: GuideScreenKind;
  /** While an activity has no ÖVTJ line yet, the step shows ACTIVITY_PENDING_HOLD[key] ("várd meg, amíg megírjuk"). */
  holdWhenActivityPending?: boolean;
  /** SPEC §28.K.13: another picture when a condition holds (e.g. adozas_kata → 'adozas_kata_atalany__kata'). */
  imageWhen?: Partial<Record<GuideCondition, string>>;
  /** SPEC §28.5.3: show the step only when this condition holds. */
  when?: GuideCondition;
}
export type GuideScreenKind = 'nav' | 'kamara' | 'app';
/** Hold texts of the steps that need the exact activity line (SPEC §24 11-18 javító). */
export const ACTIVITY_PENDING_HOLD: Record<string, string> = {
  tevekenysegek:
    'A pontos tevékenység-sort még egyeztetjük, általában 1 munkanapon belül. Várd meg, amíg megírjuk, melyiket válaszd: értesítést küldünk, és itt is látod. Rossz sort csak a bejelentés után, a Vállalkozói Ügysegédben, változásbejelentéssel lehet javítani.',
  ellenorzes: 'A tevékenységed sorát még megírjuk. Addig ne küldd be.',
  bekuldes: 'Még ne küldd be: előbb megírjuk, melyik tevékenység-sort válaszd (általában 1 munkanapon belül). Értesítést küldünk.',
};
/** The same hold, once, at the TOP of the guide and on the hub (review k3c2: before the client opens the NAV form). */
export const ACTIVITY_PENDING_BANNER =
  'Mielőtt elkezded: a tevékenységed pontos sorát még megírjuk, általában 1 munkanapon belül. Az útmutatót már átnézheted, de a NAV-os bejelentést még ne kezdd el. Értesítést küldünk, ha megírtuk.';
/** Team deadline for writing the ÖVTJ line of a waiting client (working days after the guide was requested). */
export const ACTIVITY_PENDING_DEADLINE_WORKDAYS = 1;
/**
 * Where a filed EV bejelentés can be corrected (NAV Ügysegéd-útmutató 2026.03.19, pp. 4–5, 12, 18): addresses and
 * activities in the Vállalkozói Ügysegéd (változásbejelentés); tax data (munkavégzés jellege, átalányadó, ÁFA,
 * kata, pénzforgalmi, közösségi adószám) only in ONYA → „Egyéni vállalkozó bejelentése” (T101E) or ÁNYK.
 */
export const REGISTRATION_FIX_CHANNEL_TEXT =
  'A címeket és a tevékenységeket a Vállalkozói Ügysegédben, változásbejelentéssel módosíthatod. Az adózási adatokat (munkavégzés jellege, átalányadózás, ÁFA, kata, pénzforgalmi elszámolás, közösségi adószám) nem ott, hanem az ONYA-ban, az „Egyéni vállalkozó bejelentése” résznél (T101E nyomtatvány).';
export interface GuideTemplate {
  title: string;
  intro: string;
  /** After this day the backend marks the guide outdated (SPEC §26.6.5). */
  validUntil: string;
  steps: GuideTemplateStep[];
  /** Shown after the last step. */
  outro: string;
}

export const UGYSEGED_URL = 'https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main';
export const ONYA_URL = 'https://onya.nav.gov.hu';
/** MKIK – vállalkozói regisztráció (NAV Ügysegéd-útmutató 2026.03.19, III.2 „Bejelentkezés a gazdasági kamarához”). */
export const KAMARA_URL = 'https://mkik.hu/vallalkozoi-regisztracio';

/**
 * The NAV row of "A munkavégzés jellege" per WorkKind (keys repeated from enums WORK_KINDS), with the NAV number, as the
 * real screen shows it (SPEC §28.K.13, capture 2026-11-19).
 */
export const WORK_KIND_GUIDE_VALUE: Record<'fofoglalkozas' | 'munkaviszony_mellett' | 'rovid_munkaviszony_mellett' | 'tanulmany_mellett' | 'nyugdij_mellett', string> = {
  fofoglalkozas: '[1] Főfoglalkozásként',
  munkaviszony_mellett: '[2] Heti 36 órát elérő munkaviszony mellett',
  rovid_munkaviszony_mellett: '[3] Heti 36 órát el nem érő munkaviszony mellett',
  nyugdij_mellett: '[4] Nyugdíj mellett',
  tanulmany_mellett: '[5] Nappali tagozaton folytatott tanulmányok mellett',
};
/** All 7 rows of the NAV list (SPEC §28.K.13); `workKind` null = not served by us → "kérj visszahívást". */
export const NAV_WORK_KIND_OPTIONS: readonly { navCode: string; label: string; workKind: keyof typeof WORK_KIND_GUIDE_VALUE | null }[] = [
  { navCode: '1', label: 'Főfoglalkozásként', workKind: 'fofoglalkozas' },
  { navCode: '2', label: 'Heti 36 órát elérő munkaviszony mellett', workKind: 'munkaviszony_mellett' },
  { navCode: '3', label: 'Heti 36 órát el nem érő munkaviszony mellett', workKind: 'rovid_munkaviszony_mellett' },
  { navCode: '4', label: 'Nyugdíj mellett', workKind: 'nyugdij_mellett' },
  { navCode: '5', label: 'Nappali tagozaton folytatott tanulmányok mellett', workKind: 'tanulmany_mellett' },
  { navCode: '8', label: 'Társas vállalkozási tagság mellett', workKind: null },
  {
    navCode: '0',
    label: 'Az EGT más tagállamában fennálló biztosítási jogviszony mellett vagy a Tbj. 17. § (1) bekezdése alapján belföldön nem biztosított',
    workKind: null,
  },
];

export const GUIDE_TEMPLATES: { vallalkozas_bejelentes: GuideTemplate; meghatalmazas: GuideTemplate; meghatalmazas_jovahagyas: GuideTemplate } = {
  vallalkozas_bejelentes: {
    title: 'Így jelentsd be a vállalkozásodat',
    intro: 'A válaszaid alapján összeírtuk, mit jelölj be. A NAV-os űrlap 6 lapból áll: Személyi adatok, Címadatok, Tevékenységek, Adózási adatok, Nyilatkozatok, Ellenőrzés. Kb. 10–15 perc, és ingyenes. A vállalkozásod azon a napon indul, amikor beküldöd.',
    validUntil: '2026-12-31',
    steps: [
      {
        key: 'belepes',
        screenTitle: 'Vállalkozói Ügysegéd – belépés',
        text: 'Nyisd meg a NAV bejelentő oldalát (Vállalkozói Ügysegéd), és lépj be. Telefonon is működik.',
        fields: [
          { label: 'Belépés', action: 'valaszd', value: 'Ügyfélkapu+ vagy DÁP' },
          { label: 'Saját ügyemben járok el', action: 'valaszd', why: 'Ha a képernyő megkérdezi, kinek az ügyében jársz el.' },
        ],
        link: { label: 'Megnyitom a Vállalkozói Ügysegédet', url: UGYSEGED_URL },
      },
      {
        key: 'ugyseged_inditas',
        screenTitle: 'Vállalkozói Ügysegéd – új bejelentés',
        text: 'Koppints az „Új bejelentés, kérelem benyújtása” fülre, és válaszd a vállalkozás elkezdését.',
        fields: [
          { label: 'Új bejelentés, kérelem benyújtása', action: 'kattints' },
          { label: 'Egyéni vállalkozói tevékenység elkezdése (vállalkozói bejelentkezés)', action: 'valaszd' },
        ],
        warning: 'Ha már van élő egyéni vállalkozásod, itt állj meg: egyszerre csak egy lehet. Kérj visszahívást.',
      },
      {
        key: 'szemelyi_adatok',
        screenTitle: 'Személyi adatok (1/6)',
        text: 'Ezt a lapot a NAV tölti ki a nyilvántartásból. Nézd át, és válaszd ki a születési országodat.',
        fields: [
          { label: 'Viselt név, születési név', action: 'ellenorizd', value: '{nev}' },
          { label: 'Anyja születési neve, születési idő és hely, állampolgárság', action: 'ellenorizd', why: 'Ez a NAV rovatának a neve: itt anyukád születési nevét látod.' },
          { label: 'Adóazonosító jel', action: 'ellenorizd', why: 'Ugyanaz, mint az adóigazolványodon.' },
          { label: 'Születési ország', action: 'valaszd', value: 'ahol születtél (például Magyarország)', why: 'Kötelező, nélküle nem enged tovább.' },
        ],
        warning: 'Ha itt valami nem stimmel, ne itt javítsd: fordulj a NAV-hoz, és csak utána folytasd.',
      },
      {
        key: 'cimadatok',
        screenTitle: 'Vállalkozói címadatok (2/6)',
        text: 'Add meg a székhelyedet. A székhely címe nyilvános lesz.',
        fields: [
          { label: 'Székhely', action: 'valaszd', value: 'a lakcímed: {szekhely}', when: 'szekhely_lakcim' },
          { label: 'Székhely – irányítószám', action: 'ird_be', value: '{szekhelyIrsz}', copy: true, when: 'szekhely_nem_lakcim' },
          { label: 'Székhely – település', action: 'ird_be', value: '{szekhelyTelepules}', copy: true, when: 'szekhely_nem_lakcim' },
          { label: 'Székhely – közterület és házszám', action: 'ird_be', value: '{szekhelyCimSor}', copy: true, when: 'szekhely_nem_lakcim', why: 'Ha a képernyő külön kéri a közterület nevét, jellegét (utca, út, tér) és a házszámot, bontsd szét.' },
          { label: 'Székhelyszolgáltató neve', action: 'ird_be', value: '{szolgaltatoNev}', copy: true, when: 'szekhely_szolgaltato' },
          { label: 'Székhelyszolgáltató adószáma', action: 'ird_be', value: '{szolgaltatoAdoszam}', copy: true, when: 'szekhely_szolgaltato', why: 'A NAV ellenőrzi, hogy szerepel-e a nyilvántartásban.' },
          { label: 'Az iratok őrzésének helye', action: 'ird_be', value: 'ahol a vállalkozásod iratait ténylegesen tartod, például a lakcímed', when: 'szekhely_szolgaltato', why: 'Székhelyszolgáltatónál ezt is meg kell adni, ha az iratokat nem nála tartod. Ha a képernyő nem kérdezi, hagyd.' },
          { label: 'Az iratok őrzésének helye', action: 'hagyd', value: 'hagyd üresen, ha a székhelyeden tartod őket', when: 'szekhely_nem_szolgaltato', why: 'Csak akkor kell megadni, ha az iratokat nem a székhelyeden tartod. Ha a képernyő az iratok elektronikus (online) őrzéséről kérdez, kérj visszahívást, és megmondjuk, mit jelölj.' },
          { label: 'Levelezési cím', action: 'hagyd', value: 'hagyd üresen, ha a leveleidet a székhelyedre kéred', why: 'Csak akkor add meg, ha a hivatalos leveleket máshová kéred. Ha a képernyő nem kérdezi, hagyd.' },
          { label: '{tNev} – irányítószám', action: 'ird_be', value: '{tIrsz}', copy: true, each: 'telephely', why: '{tMiert}' },
          { label: '{tNev} – település', action: 'ird_be', value: '{tTelepules}', copy: true, each: 'telephely' },
          { label: '{tNev} – közterület és házszám', action: 'ird_be', value: '{tCimSor}', copy: true, each: 'telephely' },
          { label: 'Telephely, fióktelep', action: 'hagyd', value: 'nincs, ne adj meg', when: 'telephely_nincs' },
        ],
      },
      {
        key: 'tevekenysegek',
        screenTitle: 'Tevékenységek (3/6)',
        text: 'Koppints az „Új főtevékenység” gombra, keresd ki a fő tevékenységed sorát, és válaszd ki. A többit az „Új tevékenység hozzáadása” gombbal veheted fel.',
        fields: [
          { label: 'Főtevékenység', action: 'valaszd', value: '{foTevekenyseg}', copy: true, copyFrom: 'foTevekenysegMasol', why: 'Ebből lesz a legtöbb bevételed. Ettől függ a költséghányadod is.' },
          { label: 'További tevékenység', action: 'valaszd', value: '{aSor}', copy: true, copyFrom: 'aMasol', each: 'egyeb_tevekenyseg' },
          { label: 'További tevékenység (a saját szavaiddal: „{sajatSzavakkal}”)', action: 'valaszd', value: 'a válaszod alapján megírjuk, melyik sort válaszd', when: 'sajat_szavakkal_is' },
        ],
        warning: 'Ha nem találod a megfelelő sort, ne válassz találomra: kérj visszahívást.',
        holdWhenActivityPending: true,
      },
      {
        key: 'adozas_munkavegzes',
        screenTitle: 'Adózási adatok (4/6) – munkavégzés jellege',
        text: 'Ezt kötelező kitölteni. A listában 7 sor van, ebből egyet választasz.',
        fields: [{ label: 'A munkavégzés jellege', action: 'valaszd', value: '{munkavegzesJellege}', why: 'Ettől függ, mennyi járulékot fizetsz. Ha később változik, 15 napon belül be kell jelenteni.' }],
        warning: 'Ha a „[8] Társas vállalkozási tagság mellett” vagy a „[0]” (más EGT-országban biztosított) sor illik rád, állj meg, és kérj visszahívást.',
      },
      {
        key: 'adozas_kata_atalany',
        screenTitle: 'Adózási adatok (4/6) – kata és átalányadózás',
        text: 'Itt választod ki, hogyan adózol. A NAV is kéri: csak azt jelöld, amit választasz.',
        fields: [
          {
            label: 'Az egyéni vállalkozói átalányadózás választása: „Egyéni vállalkozói tevékenységemre az átalányadózást választom.”',
            action: 'jelold',
            when: 'adozas_atalany',
            why: 'A bevételed egy részét a törvény eleve költségnek veszi, és nem kell számlákkal igazolnod a költségeidet.',
          },
          { label: 'A kataalanyiság választása', action: 'ne_jelold', when: 'adozas_atalany', why: 'Átalányadózást választasz, a kata sorát hagyd üresen.' },
          {
            label: 'A kataalanyiság választása: „Bejelentkezem a kisadózó vállalkozók tételes adója alá.”',
            action: 'jelold',
            when: 'adozas_kata',
            why: 'Havi 50 000 Ft-ot fizetsz, és ez lefedi az adót és a járulékokat. Csak akkor jó, ha kizárólag magánszemélyeknek számlázol.',
          },
          { label: 'Társadalombiztosítási azonosító jel', action: 'ird_be', value: 'a TAJ-számod (a TAJ-kártyádon van)', when: 'adozas_kata', why: 'A katához a NAV kéri. Mi nem kérjük el.' },
          { label: 'Az egyéni vállalkozói átalányadózás választása', action: 'ne_jelold', when: 'adozas_kata' },
        ],
        warning: 'Az adózási módot a bejelentéssel együtt kell választanod. Nézd meg kétszer, hogy a jó sort jelölted be.',
        imageWhen: { adozas_kata: 'adozas_kata_atalany__kata' },
      },
      {
        key: 'adozas_afa',
        screenTitle: 'Adózási adatok (4/6) – ÁFA',
        text: 'Itt választod ki, hogy nem kell ÁFÁ-t felszámolnod.',
        fields: [
          { label: 'Áfamentesség – 2. Az alanyi adómentesség választása', action: 'jelold', why: 'Így nem kell ÁFÁ-t felszámolnod, amíg az éves bevételed 20 millió forint alatt marad (2026). Az áfamentességnél csak ezt a pontot jelöld.' },
          { label: 'Az áfafizetési kötelezettség megállapításának módja', action: 'hagyd', value: 'hagyd üresen', why: 'Ez csak az ÁFA-fizetőknek kell.' },
          { label: 'A pénzforgalmi elszámolás választásával kapcsolatos nyilatkozat', action: 'ne_jelold' },
          { label: 'Közösségi adószám igénylése', action: 'jelold', when: 'eu_igen', why: 'Mert más EU-országbeli cégekkel is dolgozol. {firstName} megbeszéli veled, mi jár vele.' },
          { label: 'Közösségi adószám igénylése', action: 'ne_jelold', when: 'eu_nem', why: 'Ha később kell, bármikor kérheted.' },
          { label: 'MNB- vagy EKB-árfolyam, Áfa tv. 49/A., 89/A. és 96. § szerinti bejelentés', action: 'hagyd', value: 'hagyd üresen', why: 'Ha a képernyő mégis választást kér, állj meg, és kérj visszahívást.' },
        ],
        warning: 'Az alanyi ÁFA-mentességet most, a bejelentéssel együtt kell választanod: ha kimarad, idén ÁFÁ-t kell felszámolnod. Ez a legfontosabb pipa.',
      },
      {
        key: 'nyilatkozatok',
        screenTitle: 'Nyilatkozatok (5/6)',
        text: 'Négy nyilatkozat van. Mind a négyet jelöld be.',
        fields: [
          { label: 'I. Nincs kizáró ok', action: 'jelold', why: 'Csak akkor jelöld, ha igaz. A kérdőívben ezt már átnézted.' },
          { label: 'II. A főtevékenység feltételeit tudomásul veszem', action: 'jelold' },
          // 11-19 javító kör 2: the NAV checkbox's own words (11/13 real frames), explained underneath.
          { label: 'III. „A megadott ingatlanok megfelelnek a feltételeknek.”', action: 'jelold', why: 'Vagyis: a megadott címeket (székhely, telephely) jogosan használhatod – a tiéd, bérled, vagy a tulajdonos megengedte.' },
          { label: 'IV. A kamara értesítését tudomásul veszem', action: 'jelold' },
        ],
      },
      {
        key: 'ellenorzes',
        screenTitle: 'Ellenőrzés (6/6)',
        text: 'Nézd át az összesítőt. Ha valamit javítanál, a „Vissza” gombbal léphetsz vissza. Ezeknek így kell lenniük:',
        fields: [
          { label: 'Munkavégzés jellege', action: 'ellenorizd', value: '{munkavegzesJellege}' },
          { label: 'Átalányadózás', action: 'ellenorizd', value: 'igen', when: 'adozas_atalany' },
          { label: 'Átalányadózás', action: 'ellenorizd', value: 'nem', when: 'adozas_kata' },
          { label: 'Alanyi adómentesség (ÁFA)', action: 'ellenorizd', value: 'igen' },
          { label: 'Kata', action: 'ellenorizd', value: 'nem', when: 'adozas_atalany' },
          { label: 'Kata', action: 'ellenorizd', value: 'igen', when: 'adozas_kata' },
          { label: 'Pénzforgalmi elszámolás', action: 'ellenorizd', value: 'nem' },
          { label: 'Közösségi adószám', action: 'ellenorizd', value: 'igen, kérted', when: 'eu_igen' },
          { label: 'Közösségi adószám', action: 'ellenorizd', value: 'nem', when: 'eu_nem' },
          { label: 'Főtevékenység', action: 'ellenorizd', value: '{foTevekenysegRovid}' },
          { label: 'További tevékenység', action: 'ellenorizd', value: '{aRovid}', each: 'egyeb_tevekenyseg' },
          { label: 'További tevékenység', action: 'ellenorizd', value: 'amit a saját szavaiddal írtál („{sajatSzavakkal}”) – a sorát megírjuk', when: 'sajat_szavakkal_is' },
          { label: 'Székhely', action: 'ellenorizd', value: '{szekhely}' },
          { label: 'Székhelyszolgáltató', action: 'ellenorizd', value: '{szolgaltato}', when: 'szekhely_szolgaltato' },
          { label: 'Telephely, fióktelep', action: 'ellenorizd', value: '{telephely}', when: 'telephely_van' },
          { label: 'Telephely, fióktelep', action: 'ellenorizd', value: 'nincs', when: 'telephely_nincs' },
        ],
        warning: 'A következő gomb után a bejelentést már nem lehet módosítani vagy visszavonni.',
        holdWhenActivityPending: true,
      },
      {
        key: 'bekuldes',
        screenTitle: 'Ellenőrzés – Bejelentés megtétele',
        text: 'Ha minden stimmel, küldd be. A NAV még egyszer rákérdez.',
        fields: [
          { label: 'Bejelentés megtétele', action: 'kattints' },
          { label: 'Figyelem! – Bejelentés megtétele', action: 'kattints', why: 'A felugró ablakban még egyszer meg kell nyomnod.' },
          { label: 'Sikeres bejelentés – Rendben', action: 'kattints' },
        ],
        warning: 'A vállalkozásod azon a napon indul, amikor beküldöd. Előre dátumot nem lehet megadni.',
        holdWhenActivityPending: true,
      },
      {
        key: 'megtekintes_pdf',
        screenTitle: 'Bejelentéseim, kérelmeim – Megtekintés',
        text: 'Töltsd le a NAV értesítését PDF-ben, és mentsd el. Ezen az adószámod is rajta van.',
        fields: [
          { label: 'Bejelentéseim, kérelmeim', action: 'kattints' },
          { label: 'Megtekintés', action: 'kattints', why: 'Az ügyed kártyáján.' },
          { label: 'Letöltés', action: 'kattints', why: 'Ezt az értesítést töltöd fel nálunk.' },
        ],
      },
      {
        key: 'feltoltes_appban',
        screenTitle: 'Töltsd fel nálunk az értesítést',
        text: 'Koppints lent a „Feltöltöm az értesítést” gombra, és töltsd fel a letöltött PDF-et. Írd be az adószámodat is az értesítésről.',
        fields: [],
        ownApp: true,
        screenKind: 'app',
      },
      {
        key: 'kamarai_regisztracio',
        screenTitle: 'Még egy dolog: kamarai regisztráció',
        text: 'A NAV értesíti a kamarát, de a területi gazdasági kamaránál neked is regisztrálnod kell, külön űrlapon, 5 munkanapon belül. A NAV-os bejelentés ingyenes, a kamarai tagsággal viszont évi 5 000 Ft kamarai hozzájárulás jár: ezt a kamara kéri, nem mi.',
        fields: [{ label: 'Kamarai regisztráció', action: 'kattints', why: 'A törvény kéri minden új vállalkozótól.' }],
        link: { label: 'Megnyitom a kamara oldalát', url: KAMARA_URL },
        warning: 'Ezt ne felejtsd el: 5 munkanapod van rá.',
        screenKind: 'kamara',
      },
    ],
    outro: 'Ha feltöltötted, átnézzük, általában 1 munkanapon belül. Addig megadhatod a NAV-meghatalmazást, és lefotózhatod az igazolványaidat.',
  },
  meghatalmazas: {
    title: 'Így add meg a NAV-meghatalmazást',
    intro: 'Az ONYA-ban jelented be a NAV-nak, hogy {firstName} intézheti az adóügyeidet. Kb. 5 perc. A meghatalmazás hozzád mint személyhez kötődik, ezért akkor is jó, ha a vállalkozásod most indul.',
    validUntil: '2026-12-31',
    steps: [
      {
        key: 'onya_belepes',
        screenTitle: 'ONYA – belépés',
        text: 'Nyisd meg az ONYA-t (Online Nyomtatványkitöltő Alkalmazás), és lépj be.',
        fields: [{ label: 'Belépés', action: 'valaszd', value: 'Ügyfélkapu+ vagy DÁP' }],
        link: { label: 'Megnyitom az ONYA-t', url: ONYA_URL },
      },
      {
        key: 'onya_profil',
        screenTitle: 'Profil kiválasztása',
        text: 'A jobb felső sarokban válaszd a saját profilodat.',
        fields: [{ label: 'Profil', action: 'valaszd', value: 'a saját adóazonosító jeledhez tartozó profil', why: 'Egyéni vállalkozónál az adóügyek nem választhatók szét adószám és adóazonosító jel szerint, így a meghatalmazás a vállalkozásodra is érvényes.' }],
      },
      {
        key: 'onya_uj_nyomtatvany',
        screenTitle: 'Új nyomtatvány – Meghatalmazások – UJEGYKE',
        text: 'Indíts új nyomtatványt a meghatalmazások közül.',
        fields: [
          { label: 'Új nyomtatvány', action: 'kattints' },
          { label: 'Meghatalmazások', action: 'kattints' },
          { label: 'UJEGYKE', action: 'valaszd', why: 'Ez az állandó meghatalmazás nyomtatványa.' },
        ],
      },
      {
        key: 'onya_szerep',
        screenTitle: 'Meghatalmazói szerepkör – Új bejelentés',
        text: 'A felugró ablakban válaszd, hogy te adod a meghatalmazást, majd az oldal alján kezdj új bejelentést.',
        fields: [
          { label: 'Meghatalmazó', action: 'valaszd', why: 'Így a könyvelődnek nem kell külön jóváhagynia.' },
          { label: 'Új bejelentés', action: 'kattints' },
        ],
      },
      {
        key: 'onya_meghatalmazott',
        screenTitle: 'A meghatalmazott adatai',
        text: 'Írd be a könyvelőd adatait. A másolás gombbal átveheted őket.',
        fields: [
          { label: 'Név', action: 'ird_be', value: '{konyveloNev}', copy: true },
          { label: 'Adóazonosító jel', action: 'ird_be', value: '{konyveloAdoazonosito}', copy: true },
          { label: 'A képviselet jogcíme', action: 'valaszd', value: '9 – könyvelő' },
          { label: 'Nyilvántartási szám', action: 'ird_be', value: '{konyveloNyilvantartasiSzam}', copy: true },
        ],
      },
      {
        key: 'onya_ugykorok',
        screenTitle: 'Ügycsoportok',
        text: 'Jelöld be, miben járhat el a könyvelőd.',
        fields: [
          { label: 'Ezeket jelöld be', action: 'jelold', value: '{ugykorok}' },
          { label: 'Fizetési kedvezményi és végrehajtási ügyek, jövedéki és vámügyek, a többi vegyes ügy', action: 'ne_jelold', why: 'Ezekre nincs szükség. Ha egyszer részletfizetést kérnél, külön megbeszéljük.' },
          { label: 'Kezdete', action: 'ird_be', value: 'a mai nap' },
          { label: 'Vége', action: 'hagyd', value: 'hagyd üresen (visszavonásig érvényes)' },
        ],
      },
      {
        key: 'onya_bekuldes',
        screenTitle: 'Ellenőrzés és benyújtás',
        text: 'Kattints az „Ellenőrzés és benyújtás” gombra, majd a felugró ablakban a „Tovább” gombra. Az értesítést a sikeres benyújtásról elmentheted.',
        fields: [
          { label: 'Ellenőrzés és benyújtás', action: 'kattints' },
          { label: 'Tovább', action: 'kattints', why: 'Kb. 20 perc múlva él a meghatalmazás.' },
        ],
      },
      {
        key: 'app_bekuldtem',
        screenTitle: 'Szólj nekünk, hogy beküldted',
        text: 'Koppints lent a „Beküldtem” gombra. Ha elmentetted a visszaigazolást, töltsd fel.',
        fields: [],
        ownApp: true,
        screenKind: 'app',
      },
    ],
    outro: '{firstName} megnézi a NAV-nál, és szól, ha minden rendben.',
  },
  // SPEC §27.3.6 – the client APPROVES the UJEGYKE our accountant filed ("Intézzük helyetted"). Images:
  // utmutato_kepek/meghatalmazas_jovahagyas/ (01–03 reused from the meghatalmazás guide, the rest from NAV's segédlet
  // 2025.03.11 and ONYA bemutató 2026.01.23; the JÓVÁHAGYÁS button has no official image yet → drawn or owner's own shot).
  meghatalmazas_jovahagyas: {
    title: 'Így hagyd jóvá a meghatalmazást',
    intro: '{firstName} beküldte a NAV-nak a meghatalmazást. Most neked kell jóváhagynod az ONYA-ban, {jovahagyasHatarido}. Kb. 3 perc. A jelszavadat vagy a kódjaidat soha nem kérjük el: a jóváhagyás a te dolgod, a saját belépéseddel.',
    validUntil: '2027-12-31',
    steps: [
      {
        key: 'onya_belepes',
        screenTitle: 'ONYA – belépés',
        text: 'Nyisd meg az ONYA-t (a NAV nyomtatványkitöltője), és lépj be.',
        fields: [{ label: 'Belépés', action: 'valaszd', value: 'Ügyfélkapu+ vagy DÁP' }],
        link: { label: 'Megnyitom az ONYA-t', url: ONYA_URL },
      },
      {
        key: 'onya_profil',
        screenTitle: 'Profil kiválasztása',
        text: 'Válaszd a saját profilodat: a neved és az adóazonosító jeled áll rajta.',
        fields: [{ label: 'Profil', action: 'valaszd', value: 'a saját adóazonosító jeledhez tartozó profil' }],
      },
      {
        key: 'onya_ertesites',
        screenTitle: 'Meghatalmazások',
        text: 'A Főoldalon koppints a Meghatalmazások csempére. Ha valami jóváhagyásra vár, fent az Értesítések (harang) piros számmal is jelzi.',
        fields: [{ label: 'Meghatalmazások', action: 'kattints' }],
      },
      {
        key: 'onya_jovahagyasra_var',
        screenTitle: '„Jóváhagyásra vár”',
        text: 'Keresd meg a csempét, amelyiken a „Jóváhagyásra vár” felirat áll, és nyisd meg.',
        fields: [
          { label: 'Megtekintés', action: 'kattints' },
          { label: 'Meghatalmazott', action: 'ellenorizd', value: '{konyveloNev}' },
        ],
      },
      {
        key: 'onya_jovahagyas',
        screenTitle: 'Jóváhagyás',
        text: 'Nézd át, majd az oldal alján nyomd meg a Jóváhagyás gombot, és a felugró ablakban erősítsd meg.',
        fields: [
          { label: 'Jóváhagyás', action: 'kattints' },
          { label: 'Megerősítés a felugró ablakban', action: 'kattints' },
        ],
        warning: 'Ha nem {konyveloNev} neve áll rajta, ne hagyd jóvá, és írj nekünk.',
      },
      {
        key: 'app_jovahagytam',
        screenTitle: 'Szólj nekünk, hogy jóváhagytad',
        text: 'Koppints lent a „Jóváhagytam” gombra. {firstName} ellenőrzi, és szól, ha él a meghatalmazás.',
        fields: [],
        ownApp: true,
        screenKind: 'app',
      },
    ],
    outro: 'Ha jóváhagytad, kb. 20 perc múlva él a meghatalmazás. {firstName} ellenőrzi, és szól.',
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Personalisation of a guide template (pure; the backend serves it, the app uses it as an offline fallback, so both
// always show the same thing – SPEC §26.6.2 + §24 11-18 javító).
// ---------------------------------------------------------------------------------------------------------------------
export interface GuideAddress {
  zip: string;
  city: string;
  line: string;
}
export interface GuideActivityInput {
  key: string | null;
  label: string;
  main: boolean;
  ovtjKod: string | null;
  ovtjNev?: string | null;
  navKereso: string | null;
}
export interface GuideAnswersInput {
  activities: GuideActivityInput[];
  activityFreeText: string | null;
  seat: { kind: 'lakcim' | 'mas_cim' | 'szekhelyszolgaltato'; address: GuideAddress | null; provider: { name: string; adoszam: string } | null } | null;
  otherSites: { address: GuideAddress; kind: 'telephely' | 'fioktelep' }[];
  workKind: keyof typeof WORK_KIND_GUIDE_VALUE | null;
  euPartner: 'nem' | 'igen' | 'nem_tudom' | null;
  startPlan: 'mielobb' | 'datum' | null;
  /** SPEC §28.K.11: "Hogyan szeretnél adózni?" of the questionnaire; null / 'nem_tudom' → the átalány variant. */
  taxRegime?: 'atalany' | 'kata' | 'nem_tudom' | null;
}
export interface GuidePersonaliseInput {
  answers: GuideAnswersInput | null;
  /** "Vezetéknév Keresztnév" from the profile. */
  nev: string;
  lakcim: GuideAddress | null;
  konyvelo: { firstName: string; nev: string | null; adoazonosito: string | null; nyilvantartasiSzam: string | null };
  ugykorok: string[];
  /** Done step keys. */
  progress: string[];
  /** Only these step keys (GUIDE_STEP_KEYS[kind]); all when omitted. */
  stepKeys?: readonly string[];
  /** SPEC §27.3.6: approval guide only – the shown due date with "-ig", e.g. "november 22-ig". */
  jovahagyasHatarido?: string | null;
}
export interface PersonalisedGuideField {
  label: string;
  action: GuideTemplateAction;
  value?: string;
  why?: string;
  copyValue?: string;
}
export interface PersonalisedGuideStep {
  key: string;
  n: number;
  screenTitle: string;
  text: string;
  fields: PersonalisedGuideField[];
  warning?: string;
  /** "Várd meg, amíg megírjuk" – the step must not be done yet. */
  hold?: string;
  link?: { label: string; url: string };
  ownApp: boolean;
  screenKind: GuideScreenKind;
  imageKey: string;
  done: boolean;
}

/** The ÖVTJ code + official line of an activity: stored on the answer, else from our list (filled by [KÖNYVELŐ]). */
export function resolvedActivity(a: GuideActivityInput): { ovtjKod: string | null; ovtjNev: string | null } {
  const def = a.key ? BUSINESS_ACTIVITIES.find((x) => x.key === a.key) : undefined;
  const ovtjKod = a.ovtjKod ?? def?.ovtjKod ?? null;
  const ovtjNev = a.ovtjNev ?? (ovtjKod && def?.ovtjKod === ovtjKod ? (def.ovtjNev ?? null) : null);
  return { ovtjKod, ovtjNev };
}
/** What the guide says for one activity: "960201 – Fodrászat" once the line is known, else the search word. */
export function activityGuideLine(a: GuideActivityInput): string {
  const r = resolvedActivity(a);
  if (r.ovtjKod) return r.ovtjNev ? `${r.ovtjKod} – ${r.ovtjNev}` : `${r.ovtjKod} (${a.label})`;
  if (a.key && a.navKereso) return `írd a keresőbe: „${a.navKereso}”. A pontos sort még egyeztetjük, és megírjuk.`;
  return 'a válaszod alapján megírjuk, melyik sort válaszd';
}
/** Short form for the Ellenőrzés screen and summaries: "960201 – Fodrászat" once known, else our label. */
export function activityShortLine(a: GuideActivityInput): string {
  const r = resolvedActivity(a);
  if (r.ovtjKod) return r.ovtjNev ? `${r.ovtjKod} – ${r.ovtjNev}` : `${r.ovtjKod} (${a.label})`;
  return a.label;
}
/** What the copy button copies for one activity: only the code, or only the search word ('' = no button). */
export function activityCopyValue(a: GuideActivityInput): string {
  const r = resolvedActivity(a);
  if (r.ovtjKod) return r.ovtjKod;
  return a.key && a.navKereso ? a.navKereso : '';
}
/**
 * True while any activity still lacks its exact ÖVTJ line, or while there is free text ("Írd le a saját szavaiddal")
 * that the team has not turned into a coded line yet – also next to list activities (review k3c2: it was dropped).
 * The team resolves free text by adding it as an activity with a code and clearing the free-text field.
 */
export function activityPending(a: Pick<GuideAnswersInput, 'activities' | 'activityFreeText'> | null): boolean {
  if (!a) return false;
  if (a.activityFreeText?.trim()) return true;
  return a.activities.some((x) => !resolvedActivity(x).ovtjKod);
}

const guideAddress = (a: GuideAddress | null | undefined) => (a ? `${a.zip} ${a.city}, ${a.line}` : '');

function guideConditions(a: GuideAnswersInput | null): Set<GuideCondition> {
  const s = new Set<GuideCondition>();
  if (!a) return s;
  const kind = a.seat?.kind ?? 'lakcim';
  s.add(kind === 'lakcim' ? 'szekhely_lakcim' : kind === 'mas_cim' ? 'szekhely_mas_cim' : 'szekhely_szolgaltato');
  if (kind !== 'lakcim') s.add('szekhely_nem_lakcim');
  s.add(a.otherSites.length ? 'telephely_van' : 'telephely_nincs');
  s.add(a.euPartner === 'igen' ? 'eu_igen' : 'eu_nem');
  if (a.activities.some((x) => !x.main)) s.add('egyeb_tevekenyseg_van');
  if (a.activityFreeText?.trim() && a.activities.some((x) => x.main)) s.add('sajat_szavakkal_is');
  if (kind !== 'szekhelyszolgaltato') s.add('szekhely_nem_szolgaltato');
  if (a.startPlan === 'datum') s.add('datumra_indul');
  s.add(a.taxRegime === 'kata' ? 'adozas_kata' : 'adozas_atalany');
  return s;
}
/** The picture key of a step: its own key, or the variant of the first matching `imageWhen` condition. */
export function guideImageKey(st: Pick<GuideTemplateStep, 'key' | 'imageWhen'>, cond: ReadonlySet<GuideCondition>): string {
  for (const [c, key] of Object.entries(st.imageWhen ?? {}) as [GuideCondition, string][]) if (cond.has(c)) return key;
  return st.key;
}

export function personaliseGuide(
  kind: 'vallalkozas_bejelentes' | 'meghatalmazas' | 'meghatalmazas_jovahagyas',
  inp: GuidePersonaliseInput,
): { title: string; intro: string; outro: string; validUntil: string; steps: PersonalisedGuideStep[]; activityPending: boolean } {
  const t = GUIDE_TEMPLATES[kind];
  const a = inp.answers;
  const main = a?.activities.find((x) => x.main);
  const others = a?.activities.filter((x) => !x.main) ?? [];
  const seatAddr = a?.seat && a.seat.kind !== 'lakcim' ? a.seat.address : inp.lakcim;
  const pending = kind === 'vallalkozas_bejelentes' && activityPending(a);
  const kv = inp.konyvelo;
  const values: Record<string, string> = {
    nev: inp.nev,
    lakcim: guideAddress(inp.lakcim),
    szekhely: guideAddress(seatAddr),
    szekhelyIrsz: seatAddr?.zip ?? '',
    szekhelyTelepules: seatAddr?.city ?? '',
    szekhelyCimSor: seatAddr?.line ?? '',
    szolgaltato: a?.seat?.provider ? `${a.seat.provider.name}, adószám: ${a.seat.provider.adoszam}` : '',
    szolgaltatoNev: a?.seat?.provider?.name ?? '',
    szolgaltatoAdoszam: a?.seat?.provider?.adoszam ?? '',
    telephely: (a?.otherSites ?? []).map((x) => `${x.kind === 'telephely' ? 'Telephely' : 'Fióktelep'}: ${guideAddress(x.address)}`).join('\n'),
    foTevekenyseg: main ? activityGuideLine(main) : a?.activityFreeText ? 'a válaszod alapján megírjuk, melyik sort válaszd' : '',
    foTevekenysegMasol: main ? activityCopyValue(main) : '',
    foTevekenysegRovid: main ? activityShortLine(main) : a?.activityFreeText ? `amit a saját szavaiddal írtál („${a.activityFreeText.trim()}”) – a sorát megírjuk` : '',
    sajatSzavakkal: a?.activityFreeText?.trim() ?? '',
    egyebTevekenysegek: others.map(activityGuideLine).join('\n'),
    munkavegzesJellege: a?.workKind ? WORK_KIND_GUIDE_VALUE[a.workKind] : '',
    konyveloNev: kv.nev ?? 'a könyvelőd neve (üzenetben elküldjük)',
    konyveloAdoazonosito: kv.adoazonosito ?? 'a könyvelőd adóazonosító jele (üzenetben elküldjük)',
    konyveloNyilvantartasiSzam: kv.nyilvantartasiSzam || 'a könyvelőd nyilvántartási száma (üzenetben elküldjük)',
    ugykorok: inp.ugykorok.join('; '),
    firstName: kv.firstName,
    jovahagyasHatarido: inp.jovahagyasHatarido ?? '4 napon belül',
  };
  const cond = guideConditions(a);
  const fill = (s: string, extra?: Record<string, string>) => fillPlaceholders(s, extra ? { ...values, ...extra } : values);
  const field = (f: GuideTemplateField, extra?: Record<string, string>): PersonalisedGuideField => {
    const value = f.value !== undefined ? fill(f.value, extra) : undefined;
    const why = f.why ? fill(f.why, extra) : '';
    const copy = f.copy ? (f.copyFrom ? fill(`{${f.copyFrom}}`, extra) : (value ?? '')) : '';
    return {
      label: fill(f.label, extra),
      action: f.action,
      ...(value ? { value } : {}),
      ...(why ? { why } : {}),
      ...(copy && !/^\{.*\}$/.test(copy) ? { copyValue: copy } : {}),
    };
  };
  const sites = a?.otherSites ?? [];
  const steps: PersonalisedGuideStep[] = [];
  for (const st of t.steps) {
    if (inp.stepKeys && !inp.stepKeys.includes(st.key)) continue;
    if (st.when && !cond.has(st.when)) continue;
    const fields: PersonalisedGuideField[] = [];
    for (const f of st.fields) {
      if (f.when && !cond.has(f.when)) continue;
      if (f.each === 'telephely') {
        sites.forEach((x, i) => {
          const fajta = x.kind === 'telephely' ? 'Telephely' : 'Fióktelep';
          const n = sites.filter((y) => y.kind === x.kind).length > 1 ? ` (${sites.slice(0, i + 1).filter((y) => y.kind === x.kind).length}.)` : '';
          fields.push(
            field(f, {
              tNev: `${fajta}${n}`,
              tIrsz: x.address.zip,
              tTelepules: x.address.city,
              tCimSor: x.address.line,
              tMiert: x.kind === 'telephely' ? 'Telephely, mert ugyanazon a településen van, mint a székhelyed.' : 'Fióktelep, mert más településen van, mint a székhelyed.',
            }),
          );
        });
        continue;
      }
      if (f.each === 'egyeb_tevekenyseg') {
        for (const o of others) fields.push(field(f, { aSor: activityGuideLine(o), aMasol: activityCopyValue(o), aRovid: activityShortLine(o) }));
        continue;
      }
      fields.push(field(f));
    }
    const hold = pending && st.holdWhenActivityPending ? ACTIVITY_PENDING_HOLD[st.key] : undefined;
    steps.push({
      key: st.key,
      n: steps.length + 1,
      screenTitle: fill(st.screenTitle),
      text: fill(st.text),
      fields,
      ...(st.warning ? { warning: fill(st.warning) } : {}),
      ...(hold ? { hold } : {}),
      ...(st.link ? { link: st.link } : {}),
      ownApp: Boolean(st.ownApp),
      screenKind: st.screenKind ?? (st.ownApp ? 'app' : 'nav'),
      imageKey: guideImageKey(st, cond),
      done: inp.progress.includes(st.key),
    });
  }
  return { title: fill(t.title), intro: fill(t.intro), outro: fill(t.outro), validUntil: t.validUntil, steps, activityPending: pending };
}

// ---------------------------------------------------------------------------------------------------------------------
// Small helpers (pure; used by backend and app).
// ---------------------------------------------------------------------------------------------------------------------
/** "+36 30 123 4567", "06-30/123-4567", "0630 1234567" → "+36301234567"; null if not a Hungarian number. */
export function normalizeHuPhone(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, '');
  let rest: string;
  if (digits.startsWith('+36')) rest = digits.slice(3);
  else if (digits.startsWith('0036')) rest = digits.slice(4);
  else if (digits.startsWith('06')) rest = digits.slice(2);
  else return null;
  if (!/^\d{8,9}$/.test(rest)) return null;
  // Budapest (1) has 7 subscriber digits; mobile (20/30/31/50/70) and other areas have 2 + 6/7 digits.
  if (rest.startsWith('1') && rest.length !== 8) return null;
  if (/^(20|30|31|50|70)/.test(rest) && rest.length !== 9) return null;
  return `+36${rest}`;
}
/** "+36301234567" → "+36 30 *** **67" (lists, notifications, client status texts). */
export function maskHuPhone(e164: string): string {
  const rest = e164.startsWith('+36') ? e164.slice(3) : e164;
  const area = rest.startsWith('1') ? rest.slice(0, 1) : rest.slice(0, 2);
  return `+36 ${area} *** **${rest.slice(-2)}`;
}
export function isValidHuZip(zip: string): boolean {
  return /^[1-9]\d{3}$/.test(zip);
}
export function isValidOvtjKod(code: string): boolean {
  return /^\d{6}$/.test(code);
}
/** Replaces {name} placeholders; unknown ones stay as they are (so a missing value is visible in QA). */
/**
 * The instrumental ("-val/-vel") of a first name, for {firstNameWith} when the caller has no stored form
 * (accountants.name_with wins): Bence → Bencével, Anna → Annával, Dávid → Dáviddal, Péter → Péterrel,
 * Gergely → Gergellyel. Never "Benceval" (k6c review).
 */
export function hunWith(name: string): string {
  const n = name.trim();
  if (!n) return n;
  if (/^a könyvelőd/i.test(n)) return `${n.slice(0, 1)} könyvelőddel`;
  const back = /[aáoóuú]/i.test(n);
  const v = back ? 'a' : 'e';
  const last = n.slice(-1);
  if (/[aeiouáéíóúöőüű]/i.test(last)) {
    const stem = last === 'a' ? `${n.slice(0, -1)}á` : last === 'e' ? `${n.slice(0, -1)}é` : n;
    return `${stem}v${v}l`;
  }
  const di = /(cs|dz|gy|ly|ny|sz|ty|zs)$/i.exec(n);
  if (di) return `${n.slice(0, -2)}${di[1]!.slice(0, 1)}${di[1]}${v}l`;
  return `${n}${last}${v}l`;
}

export function fillPlaceholders(text: string, values: Record<string, string | undefined>): string {
  return text
    .replace(/\{([A-Za-z0-9_]+)\}/g, (m, k: string, at: number) => {
      let v = values[k];
      // {firstNameWith} without a stored form: built from {firstName} ("Bencével")
      if (v === undefined && k === 'firstNameWith' && values.firstName !== undefined) v = hunWith(values.firstName);
      if (v === undefined) return m;
      // The fallback name of a not-yet-assigned accountant ("A könyvelőd") is lower case inside a sentence (11-19 javítás:
      // "Felhívunk, és A könyvelőd …").
      if (/^A könyvelőd/.test(v) && at > 0 && !/[.!?:]\s*$/.test(text.slice(0, at))) return `a${v.slice(1)}`;
      return v;
    })
    // k7c2: a date value with its trailing dot before a suffix ("december 20.-ig") → "december 20-ig"
    .replace(/(\d)\.-(ig|tól|től|án|én|jén|ján)(?![\p{L}])/gu, '$1-$2');
}

// =====================================================================================================================
// SPEC §27 – owner orders of 2026-11-19. Default client texts (tegező, short words, never "AI"). The backend serves
// them as editable content texts (content key in each comment, SPEC §27.9); the app uses these only offline.
// Placeholders: {firstName} accountant's first name · {accountantName} his full name · {date} Budapest date
// ("november 22.") · {hatarido} the same date with the suffix "-ig", built by the server ("november 22-ig": the numeral
// takes the suffix directly, the period is dropped) · {days} whole days left · {n} a count · {phoneMasked}.
// Button rule (k3_kor2 language finding 11): every button is first person ("Kitöltöm", "Megnyitom", "Jóváhagytam").
// =====================================================================================================================

/** SPEC §27.5 – ONE wording for the client's issued invoices. Content keys `szamlak.<key>`. */
export const INVOICE_WORDING = {
  /** Section / tab / step name everywhere (app Dosszié, panel tab, notifications). */
  sectionTitle: 'Kiállított számlák',
  /** The one short sentence (Dosszié header row, Főoldal after activation, upload screen, explainers). */
  short: 'A kiállított számláid maguktól megjelennek itt – nem kell feltöltened őket.',
  /** The one-time "Mi ez?" text (explainer `kiallitott_szamlak` keeps the same meaning in three blocks). */
  miEz: 'Minden számla, amit a számlázóprogramodban kiállítasz, automatikusan bekerül a NAV rendszerébe. Mi onnan töltjük le. Ami nincs benne: a számla nélküli eladás (pl. nyugta) – azt külön jelezd.',
  /** Month summary part ("2 irat és 4 kiállított számla, mind rendben"). */
  countPart: '{n} kiállított számla',
  /** Month list sub-line. */
  monthSub: '{n} számla, összesen {sum} Ft. Naponta letöltjük őket a NAV rendszeréből.',
  monthEmpty: 'Ebben a hónapban még nincs kiállított számlád, vagy még nem töltöttük le.',
  /** Upload screen hint (Fotózás / Feltöltés). */
  uploadHint: 'A kiállított számláidat nem kell feltöltened: azokat a NAV rendszeréből töltjük le. Ide a nyugtákat, a pénztárgép-összesítőt és azt töltsd fel, amit a könyvelőd kér.',
  /** Milestone / journey sub-line after the connection. */
  afterConnect: 'Utána a kiállított számláid maguktól megjelennek itt.',
  /** Panel (accountant / team) wording. */
  staffSection: 'Kiállított számlák',
  staffSub: 'A NAV Online Számlából, naponta letöltve. Az ügyfélnek ezeket nem kell feltöltenie.',
  staffNoUpload: 'A kiállított számláit nem kell feltöltenie: naponta letöltjük őket a NAV Online Számlából.',
} as const;
/**
 * QA check (SPEC §27.5.4): client- or team-facing text must not match any of these (case-insensitive). Letters and
 * certificates FROM the NAV ("Levél a NAV-tól", "igazolást kérünk a NAV-tól") are correct and stay.
 */
/** Use with the flags 'iu' (new RegExp(p, 'iu')). */
export const INVOICE_WORDING_FORBIDDEN_PATTERNS: readonly string[] = [
  'száml\\p{L}*\\s+(?:[\\p{L}-]+\\s+){0,3}NAV-tól',
  'NAV-tól\\s+(?:jön|jött|jönnek|jöttek|kaptuk|érkez\\p{L}*|megérkez\\p{L}*)',
  'NAV-ból jövő számlá',
];

/** One canonical row text per journey step (keys = enums JOURNEY_STEP_KEYS). Content `bekotes.ut.lepes.<key>.*`. */
export interface JourneyStepText {
  /** The ONE name of this thing, everywhere (row, card kicker, notifications, panel). */
  title: string;
  /** "Mi ez?" of the row. */
  explainer: ExplainerKey;
  /** App route of the row's own screen ('' = none, e.g. our team's work). */
  route: string;
  /** First-person label of the primary button on the "Most ez jön" card ('' = no button). */
  actionLabel: string;
  /** Typical time on the row (self-service / existing business). */
  time: string | null;
  /** Assisted variant ("Intézzük helyetted"), when different. */
  timeSegitett?: string | null;
  actionLabelSegitett?: string;
}
export const JOURNEY_STEP_TEXTS: Record<
  | 'ut'
  | 'visszahivas'
  | 'adatok'
  | 'kerdoiv'
  | 'bejelentes'
  | 'ertesites'
  | 'atnezes'
  | 'vegso_jovahagyas'
  | 'kamara'
  | 'szerzodes'
  | 'meghatalmazas'
  | 'azonositas'
  | 'elofizetes'
  | 'nav_bekotes'
  | 'kedvezmenyek'
  | 'alkalmazottak',
  JourneyStepText
> = {
  ut: { title: 'Vállalkozásod', explainer: 'vallalkozas_van_e', route: '/bekotes', actionLabel: 'Válaszolok', time: '1 koppintás' },
  visszahivas: { title: 'Visszahívás', explainer: 'visszahivas', route: '/visszahivas', actionLabel: '', time: '24–48 órán belül' },
  adatok: { title: 'Adataid', explainer: 'adataid', route: '/bekotes/adatok', actionLabel: 'Kitöltöm', time: 'kb. 3 perc' },
  kerdoiv: { title: 'Kérdőív a vállalkozásodról', explainer: 'tevekenyseg', route: '/bekotes/vallalkozas/adatlap', actionLabel: 'Kitöltöm', time: 'kb. 5–8 perc' },
  bejelentes: {
    title: 'Bejelentés a NAV-nál',
    explainer: 'vallalkozoi_ugyseged',
    route: '/bekotes/vallalkozas/utmutato',
    actionLabel: 'Megnyitom az útmutatót',
    time: 'kb. 10–15 perc',
    timeSegitett: 'általában 1 munkanap',
    actionLabelSegitett: '',
  },
  ertesites: { title: 'NAV-os értesítés feltöltése', explainer: 'nav_igazolas_pdf', route: '/bekotes/vallalkozas/feltoltes', actionLabel: 'Feltöltöm az értesítést', time: 'kb. 2 perc' },
  atnezes: { title: 'Átnézzük', explainer: 'nav_igazolas_pdf', route: '/bekotes/vallalkozas', actionLabel: '', time: 'általában 1 munkanap' },
  vegso_jovahagyas: {
    title: 'Végső engedély',
    explainer: 'helyettunk_vallalkozas',
    route: '/bekotes/vallalkozas/engedely',
    actionLabel: 'Átnézem és engedélyezem',
    time: 'kb. 2 perc',
  },
  kamara: { title: 'Kamarai regisztráció', explainer: 'kamarai_regisztracio', route: '/bekotes/vallalkozas/kamara', actionLabel: 'Megnyitom', time: 'kb. 10 perc, 5 munkanapon belül' },
  szerzodes: { title: 'Szerződés', explainer: 'szerzodes', route: '/bekotes/szerzodes', actionLabel: 'Elolvasom', time: 'kb. 3 perc' },
  meghatalmazas: {
    title: 'NAV-meghatalmazás',
    explainer: 'nav_meghatalmazas',
    route: '/bekotes/meghatalmazas',
    // 11-19 javító kör 2: neutral – the screen it opens offers both (self-service and "Megcsináljuk helyetted").
    actionLabel: 'Megnézem a két lehetőséget',
    time: 'kb. 5 perc',
    timeSegitett: 'jóváhagyás: kb. 3 perc',
    actionLabelSegitett: 'Megnyitom a jóváhagyás útmutatóját',
  },
  azonositas: { title: 'Igazolványok', explainer: 'szemelyi_foto', route: '/bekotes/azonositas', actionLabel: 'Lefotózom', time: 'kb. 5 perc' },
  elofizetes: { title: 'Előfizetés', explainer: 'elofizetes', route: '/bekotes/elofizetes', actionLabel: 'Megadom a kártyámat', time: 'kb. 2 perc' },
  nav_bekotes: { title: 'Kiállított számlák bekötése', explainer: 'nav_bekotes', route: '', actionLabel: '', time: 'általában 1–2 munkanap' },
  // SPEC §28.3.4: optional, never 'most', never counted (sub "Te · kb. 3 perc · ha jár").
  kedvezmenyek: { title: 'Adókedvezmények', explainer: 'kedvezmenyek', route: '/kedvezmenyek', actionLabel: 'Megnézem', time: 'kb. 3 perc · ha jár' },
  // SPEC §28.K.7: only when the employer answer is not 'nincs'; the accountant decides (actor konyvelo, state var).
  alkalmazottak: { title: 'Alkalmazottak', explainer: 'alkalmazott_efo', route: '/bekotes/alkalmazottak', actionLabel: '', time: null },
};

/** Journey page texts (SPEC §27.4.2). Content `bekotes.ut.<key>`. */
export const JOURNEY_TEXTS = {
  bandStart: 'Kezdjük egy kérdéssel.',
  bandTodo: 'Még {n} dolog kell tőled, a többit {firstName} intézi.',
  bandTodoOne: 'Már csak 1 dolog kell tőled, a többit {firstName} intézi.',
  bandNone: 'Most nincs teendőd. {actor} dolgozik rajta.',
  current: 'Most ez jön',
  listTitle: 'Így halad a bekötésed',
  listSub: 'Minden sorban látod, ki lép, és nagyjából mennyi idő.',
  doneCollapsed: '{n} lépés kész',
  showAll: 'Mutasd',
  hideDone: 'Elrejtem',
  rowKesz: 'Kész',
  rowKeszWhen: 'Kész, {date}',
  rowMost: 'Most te jössz',
  rowNyitva: 'Ezt is megcsinálhatod már',
  rowVar: '{actor} dolgozik rajta',
  rowKesobb: 'Később',
  previewTitle: 'Utána ezek jönnek',
  previewLocked: 'Előbb válaszolj fent.',
  /** 11-19 javító kör 2: the preview lists the van path; a starter's road is longer – say so before he answers. */
  previewInditas: 'Ha most indítod a vállalkozásodat: előtte még a kérdőív, a bejelentés a NAV-nál, az értesítés feltöltése és a kamara jön (kb. +5 lépés).',
  lockedSheet: 'Még {remaining} lépés, és minden megnyílik. Ebből {n} a tiéd.',
  pathVan: 'Már van vállalkozásom',
  pathInditas: 'Most indítom',
  pathInditasSegitett: 'Most indítom – ti intézitek',
  pathChange: 'Módosítom',
  activeTitle: 'Kész a bekötés!',
  activeBody: '{firstName} átvette a könyvelésedet. A kiállított számláid maguktól megjelennek, neked csak a nyugtákat kell lefotóznod.',
  signupNewBusiness: 'Még nincs vállalkozásod? Segítünk elindítani – addig nem fizetsz.',
  signupNewBusinessAzonnal: 'Még nincs vállalkozásod? Segítünk elindítani.',
} as const;

/**
 * The waiting-card pattern (SPEC §27.4.3): who works now, what happens, how long, what the client may do meanwhile,
 * when to ask for a callback. Content `bekotes.varakozas.<key>.cim|szoveg`. `kicker` is shown in small caps.
 */
export const WAITING_TEXTS: Record<
  | 'tevekenyseg_sor'
  | 'atnezes'
  | 'adoszam'
  | 'meghatalmazas_ellenorzes'
  | 'azonositas_ellenorzes'
  | 'nav_bekotes'
  | 'helyettunk_hivas'
  | 'helyettunk_ujegyke'
  | 'helyettunk_ellenorzes'
  | 'helyettunk_bekuldes'
  | 'helyettunk_adoszam',
  /** `time` = how long the others usually need (content `.ido`): the row of a step someone else works on shows THIS, not
   * the client's own time estimate (11-19 javítás), and so does the "Közben: …" strip. */
  { kicker: string; title: string; body: string; time: string }
> = {
  tevekenyseg_sor: {
    kicker: 'Most mi dolgozunk',
    title: 'Megírjuk, melyik tevékenység-sort válaszd',
    body: 'Általában 1 munkanapon belül. Értesítünk, ha kész. Addig a NAV-os bejelentést még ne kezdd el.',
    time: 'általában 1 munkanap',
  },
  atnezes: { kicker: 'Most mi dolgozunk', title: 'Átnézzük a NAV-os értesítésedet', body: 'Általában 1 munkanapon belül. Értesítünk, ha rendben van.', time: 'általában 1 munkanap' },
  adoszam: {
    kicker: 'Most a NAV dolgozik',
    title: 'Várjuk az adószámodat',
    body: 'Ha nincs rajta az értesítésen, a NAV pár napon belül adja meg: a Vállalkozói Ügysegédben, a Bejelentéseim között látod. Ha megvan, írd be itt. Mi is figyeljük.',
    time: 'általában pár nap',
  },
  meghatalmazas_ellenorzes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} ellenőrzi a meghatalmazásodat a NAV-nál',
    body: 'Általában 1 munkanapon belül. Értesítünk, ha él.',
    time: 'általában 1 munkanap',
  },
  azonositas_ellenorzes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} átnézi az igazolványaidat',
    body: 'Általában 1 munkanapon belül. Titkosítva tároljuk őket, csak ő látja.',
    time: 'általában 1 munkanap',
  },
  nav_bekotes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} beköti a kiállított számláidat',
    body: 'Általában 1–2 munkanap. Utána a kiállított számláid maguktól megjelennek itt, és minden megnyílik.',
    time: 'általában 1–2 munkanap',
  },
  helyettunk_hivas: {
    kicker: 'Most mi jövünk',
    title: 'Hamarosan hívunk',
    body: 'Kollégánk 24–48 órán belül hív a {phoneMasked} számon.',
    time: '24–48 órán belül',
  },
  helyettunk_ujegyke: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} beküldi a meghatalmazást',
    body: 'Általában 1 munkanapon belül. Utána értesítést kapsz, és 4 napod lesz jóváhagyni az ONYA-ban.',
    time: 'általában 1 munkanap',
  },
  helyettunk_ellenorzes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} ellenőrzi, hogy él-e a meghatalmazás',
    body: 'A jóváhagyás után a NAV-nál kb. 20 perc, nálunk általában pár óra.',
    time: 'általában pár óra',
  },
  helyettunk_bekuldes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} beküldi a bejelentésedet',
    body: 'Általában 1 munkanapon belül, a saját belépésével, meghatalmazottként. A vállalkozásod azon a napon indul, amikor beküldi.',
    time: 'általában 1 munkanap',
  },
  helyettunk_adoszam: {
    kicker: 'Most mi dolgozunk',
    title: 'Rögzítjük az adószámodat',
    body: 'A bejelentés elment a NAV-hoz. Átnézzük az értesítést, és általában 1 munkanapon belül rögzítjük az adószámodat.',
    time: 'általában 1 munkanap',
  },
};
/** Under every waiting card. Content `bekotes.varakozas.eszkalacio`. */
export const WAITING_ESCALATE_TEXT = 'Ha {hatarido} nem történik semmi, kérj visszahívást.';
/** The same line while a callback is already open (no second callback): content `bekotes.varakozas.eszkalacio_hivas`. */
export const WAITING_ESCALATE_CALLBACK_TEXT = 'Ha {hatarido} sem hívtunk, írj nekünk az Üzenetekben.';
/** Any other wait while a callback is already open: content `bekotes.varakozas.eszkalacio_uzenet`. */
export const WAITING_ESCALATE_MESSAGE_TEXT = 'Ha {hatarido} nem történik semmi, írj nekünk az Üzenetekben.';
/**
 * 11-19 javító kör 2: the escalation day has passed (our side is late) – no past date. `{ki}` = the accountant's first
 * name or "A kollégáink". Content `bekotes.varakozas.kesunk[_uzenet|_hivas|_nav|_nav_uzenet]`.
 */
export const WAITING_LATE_TEXTS = {
  kesunk: 'Késünk vele, elnézést. {ki} már tud róla. Ha sürgős, kérj visszahívást.',
  kesunk_uzenet: 'Késünk vele, elnézést. {ki} már tud róla. Ha sürgős, írj nekünk az Üzenetekben.',
  kesunk_hivas: 'Késünk a hívással, elnézést. Ha sürgős, írj nekünk az Üzenetekben.',
  kesunk_nav: 'A NAV most lassabb a szokásosnál. Ha sürgős, kérj visszahívást.',
  kesunk_nav_uzenet: 'A NAV most lassabb a szokásosnál. Ha sürgős, írj nekünk az Üzenetekben.',
} as const;
/** Under every waiting card when the client may do something meanwhile. Content `bekotes.varakozas.addig`. */
export const WAITING_MEANWHILE_TEXT = 'Addig: {title}';

/** SPEC §27.2 – the change sheet and its entry links. Content `bekotes.ut.valtas.<key>`. */
export const PATH_CHANGE_TEXTS = {
  sheetTitle: 'Módosítod a válaszodat?',
  toInditas: 'Most az áll itt: már van vállalkozásod. Ha mégsem, és most indítanád, átállunk erre. A neved, a telefonszámod, az adóazonosító jeled és a lakcímed megmarad.',
  toInditasButton: 'Igen, még nincs vállalkozásom',
  toVan: 'Most az áll itt: most indítod a vállalkozásodat. Ha már van, átállunk erre. A kérdőívre adott válaszaid megmaradnak, ha mégis visszaváltanál.',
  toVanAssist: 'A bejelentést így nem kell intéznünk. Ha a meghatalmazást már beküldtük, azt jóváhagyhatod: az így is jó.',
  toVanButton: 'Igen, már van vállalkozásom',
  cancel: 'Mégse',
  blocked: 'Ezt itt már nem tudod módosítani. {reason} Kérj visszahívást, és segítünk.',
  blockedButton: 'Kérem a visszahívást',
  toastVan: 'Rendben: már van vállalkozásod.',
  toastInditas: 'Rendben: most indítod a vállalkozásodat.',
  undo: 'Visszavonom',
  /** After "Visszavonom": which answer is set now. */
  undoneVan: 'Visszaállítottuk: már van vállalkozásod.',
  undoneInditas: 'Visszaállítottuk: most indítod a vállalkozásodat.',
  roladLink: 'Rossz gombot nyomtam: már van vállalkozásom',
  adoszamNincsLink: 'Még nincs adószámom – most indítanám',
  kerdoivLink: 'Mégis van vállalkozásom',
  fiokRow: 'Vállalkozásod',
} as const;

/** SPEC §27.3.1 – the second question right after "Még nincs, most indítanám". Content `bekotes.ut.mod.<key>`. */
export const START_MODE_TEXTS = {
  title: 'Hogyan jelentsük be a vállalkozásodat?',
  sub: 'Bármelyiket választod, később módosíthatod.',
  onalloTitle: 'Magam jelentem be',
  onalloBody: 'Lépésről lépésre megmutatjuk, mit hova jelölj a NAV oldalán. Kb. 10–15 perc. Ügyfélkapu+ vagy DÁP kell hozzá.',
  onalloButton: 'Ezt választom',
  segitettBadge: 'Ha nem boldogulsz vele',
  segitettTitle: 'Intézzétek helyettem',
  segitettBody: 'Felhívunk, és {firstName} meghatalmazottként bejelenti a vállalkozásodat. Neked: pár adat, egy jóváhagyás az ONYA-ban (a NAV online nyomtatványkitöltője) és egy engedély itt. A kérdőívet a hívásban együtt is kitölthetjük. Ügyfélkapu+ vagy DÁP kell hozzá.',
  segitettButton: 'Ezt kérem',
} as const;

/** SPEC §27.3 – "Intézzük helyetted" texts. Content `helyettunk.<key>`. */
export const ASSIST_TEXTS = {
  evCardBadge: 'Ha nem boldogulsz vele',
  evCardTitle: 'Nem boldogulsz vele? Intézzük helyetted.',
  evCardBody: 'Felhívunk, átnézzük veled az adataidat, és {firstName} a saját belépésével, meghatalmazottként bejelenti a vállalkozásodat. Neked: pár adat, egy jóváhagyás az ONYA-ban (a NAV online nyomtatványkitöltője) és egy engedély itt – a kérdőívet a hívásban együtt is kitölthetjük.',
  mhCardBadge: 'Megcsináljuk helyetted',
  mhCardTitle: 'Megcsináljuk helyetted a meghatalmazást',
  mhCardBody: '{firstName} beküldi a NAV-nak, te csak jóváhagyod az ONYA-ban (a NAV online nyomtatványkitöltője), 4 napon belül. Kb. 3 perc a részed.',
  cardButton: 'Ezt kérem',
  guideLink: 'Nem boldogulsz vele? Intézzük helyetted',
  /** The strip inside the self-service meghatalmazás guide (owner order 3: "ki kell emelni"). */
  mhGuideLink: 'Nem boldogulsz vele? Megcsináljuk helyetted',
  guideStripBodyEv: '{firstName} meghatalmazottként bejelenti helyetted. Felhívunk, és megbeszéljük.',
  guideStripBodyMh: '{firstName} beküldi a NAV-nak, te csak jóváhagyod. Felhívunk, és megbeszéljük.',
  guideStripButton: 'Ezt kérem',
  /** Under the free-text note of the callback / assist request (the server also refuses passwords and codes). */
  noteHint: 'Ide ne írj jelszót, kódot vagy adóazonosítót – ezeket soha nem kérjük el.',
  noteRefused: 'Ide ne írj jelszót vagy belépési kódot: ezeket soha nem kérjük el. Töröld ki, és küldd újra.',
  /** The self-service EV guide while an EV assist is open: our accountant files it, the client must not. */
  guideAssistBanner: 'Ezt {firstName} küldi be helyetted, meghatalmazottként. A NAV-os űrlapot NE töltsd ki és NE küldd be: nézd át az adataidat, és engedélyezd a bejelentést.',
  guideAssistButton: 'Átnézem és engedélyezem',
  sheetTitleEv: 'Intézzük helyetted – így megy',
  sheetTitleMh: 'Megcsináljuk a meghatalmazást – így megy',
  needs: 'Mire lesz szükséged: Ügyfélkapu+ vagy DÁP a jóváhagyáshoz. Ha nincs, a hívásban segítünk.',
  neverCredentials:
    'Soha nem kérjük el az Ügyfélkapu+- vagy DÁP-belépésedet, a jelszavadat vagy a kódjaidat, és nem lépünk be helyetted. {firstName} a saját belépésével, meghatalmazottként jár el. Amit kell, te hagyod jóvá a NAV oldalán.',
  /** [OWNER] the EV registration and the meghatalmazás assists only. Assisted CHANGES are prepaid (SPEC §28.K.1, FEE_TEXTS). */
  free: 'Ezért nem fizetsz külön.',
  sendButton: 'Kérem a visszahívást',
  toast: 'Megkaptuk. Kollégánk 24–48 órán belül hív.',
  cancelLink: 'Mégis magam csinálom',
  cancelSheetTitle: 'Mégis magad intézed?',
  cancelSheetBody: 'Rendben. A visszahívást is lemondjuk. Ha a meghatalmazást már beküldtük, azt jóváhagyhatod: az így is jó.',
  cancelButton: 'Igen, magam intézem',
  approveTitle: 'Hagyd jóvá a meghatalmazást a NAV-nál',
  approveSub: '{hatarido} (még {days} nap). Kb. 3 perc az ONYA-ban.',
  approveLastDay: 'Ma van az utolsó nap: hagyd jóvá ma.',
  /** The day after the shown due day (NAV's real 4 × 24 hours are not over yet). */
  approveAfterDue: 'Ma még jóváhagyhatod, de siess: ha ma nem hagyod jóvá, a NAV törli.',
  approveGuideButton: 'Megnyitom az útmutatót',
  approvedButton: 'Jóváhagytam',
  approvedToast: 'Köszönjük! {firstName} ellenőrzi, és szól, ha él.',
  notApprovedYet: 'Mégsem hagytam még jóvá',
  notApprovedYetToast: 'Rendben. Hagyd jóvá az ONYA-ban, utána koppints a „Jóváhagytam” gombra.',
  expiredTitle: 'Lejárt a 4 nap',
  expiredBody: 'A NAV törölte a jóvá nem hagyott meghatalmazást. Semmi gond: {firstName} újra beküldi, és szólunk.',
  consentTitle: 'Nézd át, mit jelentünk be',
  consentSub: 'Ezekkel az adatokkal küldi be {firstName} a bejelentésedet. Ha valamit javítanál, koppints a „Módosítom” gombra.',
  consentBlockRolad: 'Rólad (a NAV tölti ki)',
  consentBlockSzekhely: 'Székhely',
  consentBlockTelephely: 'Telephely, fióktelep',
  consentBlockTevekenyseg: 'Tevékenységek',
  consentBlockMunkavegzes: 'Munkavégzés jellege',
  consentBlockAdozas: 'Adózás',
  consentBlockKezdes: 'Kezdés napja',
  consentAdozas: 'Átalányadózás: igen · Alanyi ÁFA-mentesség: igen · Kata: nem · Pénzforgalmi elszámolás: nem · Közösségi adószám: {kozossegi}',
  /** SPEC §28.K.11: the KATA variant of the same line (questionnaire answer taxRegime 'kata'). */
  consentAdozasKata: 'Kata: igen (havi 50 000 Ft) · Átalányadózás: nem · Alanyi ÁFA-mentesség: igen · Pénzforgalmi elszámolás: nem · Közösségi adószám: {kozossegi}',
  consentKezdes: 'A beküldés napja, várhatóan {date}. Előre dátumot nem lehet megadni.',
  consentPublic: 'A székhely címe nyilvános lesz: bárki megnézheti a nyilvántartásban.',
  consentEdit: 'Módosítom',
  /** The client's OWN declaration (Evectv. 3. §). Never ticked by us. */
  consentDeclaration: 'Rám nem vonatkozik egyik kizáró ok sem, és nincs másik élő egyéni vállalkozásom.',
  /** The written instruction [JOGI]; version = jogi `ev_bejelentes_utasitas` version. */
  consentInstruction:
    'Az adatokat én adtam meg és ellenőriztem. Kérem, hogy {accountantName} ezekkel az adatokkal, meghatalmazottként küldje be a vállalkozásom bejelentését. Tudom, hogy beküldés után nem lehet visszavonni, és a vállalkozásom a beküldés napján indul.',
  consentButton: 'Engedélyezem a bejelentést',
  consentToast: 'Megkaptuk. {firstName} általában 1 munkanapon belül beküldi.',
  consentStale: 'Módosítottad a kérdőívet, ezért engedélyezd újra.',
  filedTitle: 'Bejelentettük a vállalkozásodat!',
  filedBody: 'Elment a NAV-hoz ({date}). Az értesítést itt meg is nézheted.',
  filedButton: 'Megnézem az értesítést',
  disabled: 'A vállalkozás bejelentését most nem tudjuk helyetted intézni. Kérj visszahívást, és megbeszéljük, hogyan segíthetünk.',
} as const;
/** The numbered "így megy" list of the confirm sheet (actor = enums JourneyActor). Content `helyettunk.lepesek.<kind>.<i>`. */
export const ASSIST_STEP_LIST: Record<'vallalkozas_bejelentes' | 'meghatalmazas', readonly { actor: 'te' | 'konyvelo' | 'csapat' | 'nav'; text: string; time: string }[]> = {
  vallalkozas_bejelentes: [
    { actor: 'csapat', text: 'Felhívunk, és megbeszéljük.', time: '24–48 órán belül' },
    { actor: 'te', text: 'Kitöltöd a kérdőívet (a hívásban együtt is kitölthetjük), és elfogadod a szerződést.', time: 'kb. 10 perc' },
    { actor: 'konyvelo', text: '{firstName} beküldi a meghatalmazást.', time: 'általában 1 munkanap' },
    { actor: 'te', text: 'Jóváhagyod az ONYA-ban.', time: '4 napon belül, kb. 3 perc' },
    { actor: 'te', text: 'Átnézed az adataidat, és engedélyezed a bejelentést.', time: 'kb. 2 perc' },
    { actor: 'konyvelo', text: '{firstName} bejelenti a vállalkozásodat.', time: 'általában 1 munkanap' },
    { actor: 'nav', text: 'Megkapod az adószámodat.', time: 'általában azonnal' },
  ],
  meghatalmazas: [
    { actor: 'csapat', text: 'Felhívunk, és elmondjuk, mi jön.', time: '24–48 órán belül' },
    { actor: 'konyvelo', text: '{firstName} beküldi a meghatalmazást.', time: 'általában 1 munkanap' },
    { actor: 'te', text: 'Jóváhagyod az ONYA-ban.', time: '4 napon belül, kb. 3 perc' },
    { actor: 'konyvelo', text: '{firstName} ellenőrzi, hogy él.', time: 'pár óra' },
  ],
};
/** Client status line per assist status (content `helyettunk.allapot.<status>`; `…_mh` overrides for kind 'meghatalmazas'). */
export const ASSIST_STATUS_CLIENT_TEXT: Record<
  | 'visszahivas_kerve'
  | 'dijra_var'
  | 'egyeztetve'
  | 'meghatalmazas_bekuldve'
  | 'meghatalmazas_lejart'
  | 'meghatalmazas_jovahagyva'
  | 'meghatalmazas_el'
  | 'ugyfel_engedelyezte'
  | 'bejelentes_bekuldve'
  | 'kesz'
  | 'visszavonva'
  | 'lezarva',
  string
> = {
  visszahivas_kerve: 'Visszahívást kértél. Kollégánk 24–48 órán belül hív.',
  // SPEC §28.K.1: only change kinds use it ({dij} = "4 999").
  dijra_var: 'Megkaptuk az adataidat. Ha kifizeted a díjat ({dij} Ft), {firstName} nekilát.',
  egyeztetve: 'Beszéltünk. Ha megadtad az adataidat és elfogadtad a szerződést, {firstName} beküldi a meghatalmazást, utána jóváhagyod.',
  meghatalmazas_bekuldve: '{firstName} beküldte a meghatalmazást. Hagyd jóvá az ONYA-ban {hatarido}.',
  meghatalmazas_lejart: 'Lejárt a 4 nap. {firstName} újra beküldi a meghatalmazást, és szólunk.',
  meghatalmazas_jovahagyva: 'Jóváhagytad. {firstName} ellenőrzi, hogy él-e a meghatalmazás.',
  meghatalmazas_el: 'Él a meghatalmazás. Nézd át az adataidat, és engedélyezd a bejelentést.',
  ugyfel_engedelyezte: 'Engedélyezted. {firstName} általában 1 munkanapon belül beküldi a bejelentésedet.',
  bejelentes_bekuldve: 'Bejelentettük a vállalkozásodat. Rögzítjük az adószámodat.',
  kesz: 'Elindult a vállalkozásod. Jöhet a következő lépés.',
  visszavonva: 'Lemondtad. Ha mégis kéred, bármikor szólhatsz.',
  lezarva: 'Lezártuk a kérésedet: {reasonText}.',
};
export const ASSIST_STATUS_CLIENT_TEXT_MH: Partial<Record<keyof typeof ASSIST_STATUS_CLIENT_TEXT, string>> = {
  kesz: 'Él a meghatalmazás. {firstName} intézheti az adóügyeidet.',
};

/** SPEC §27.4.4 S12 – chamber registration row (content `vallalkozas.kamara.<key>`). */
export const KAMARA_TEXTS = {
  title: 'Regisztrálj a kamaránál',
  sub: '{hatarido} (5 munkanap). Kb. 10 perc a kamara oldalán.',
  body: 'A törvény kéri minden új vállalkozótól. Kell hozzá az adószámod. A kamarai tagsággal évi 5 000 Ft kamarai hozzájárulás jár: ezt a kamara kéri, nem mi.',
  openButton: 'Megnyitom a kamara oldalát',
  doneButton: 'Megcsináltam',
  doneToast: 'Köszönjük! Kipipáltuk.',
  undo: 'Mégsem csináltam meg',
  overdue: 'A határidő {date} volt. Ha még nem regisztráltál, tedd meg most.',
} as const;

/** SPEC §27.4.4 – questionnaire (was "adatlap") copy changes. Content `vallalkozas.kerdoiv.<key>`. */
export const KERDOIV_TEXTS = {
  title: 'Kérdőív a vállalkozásodról',
  gateTitle: 'Előbb pár adat rólad',
  page1Title: 'Mielőtt elkezded',
  declNoExclusion: 'Rám nem vonatkozik egyik kizáró ok sem',
  declSingle: 'Nincs másik élő egyéni vállalkozásom',
  afaLimitLine: 'Ha {startText} indulsz, idén {afaLimit} Ft bevételig lehetsz ÁFA-mentes (a 20 millió forint időarányos része).',
  submitButton: 'Kérem az útmutatót',
  submitButtonSegitett: 'Kész, elküldöm',
} as const;

/** SPEC §27.4.2 – default texts of the new step lock (content key = the object key). */
export const STEP_LOCK_DEFAULT_TEXTS: Record<string, string> = {
  'bekotes.zarolt.elofizetes_szerzodes_utan': 'Előbb fogadd el a szerződést. Utána megadhatod a kártyádat.',
};
/** SPEC §27.1.2 – one line under the guide intro while any picture is drawn (content `vallalkozas.utmutato.rajz_megjegyzes`). */
export const GUIDE_DRAWN_NOTE = 'Néhány képet rajzoltunk, mert arról a lapról nincs hivatalos NAV-kép. A valódi oldal kicsit eltérhet.';

/** SPEC §27.4 – the hub of the new-business step ("Vállalkozás bejelentése"). Content `vallalkozas.kozpont.<key>`. */
export const HUB_TEXTS = {
  prepareSummary: '{n} dolog kell hozzá: Ügyfélkapu+ vagy DÁP, személyi, lakcímkártya, adóigazolvány…',
  prepareShowAll: 'Mutasd mind',
  stopLink: 'Mégsem most?',
  stopSheetTitle: 'Mégsem most indítod?',
  stopMegisVan: 'Mégis van vállalkozásom',
  stopKesobb: 'Később indítom',
  stopMeggondoltam: 'Meggondoltam magam',
  guideOneStep: '{i}/{n}. lépés',
  guideNext: 'Megvan, tovább',
  guideBack: 'Vissza',
  guideAll: 'Mutasd egyben',
  guideHoldNavButton: 'Előbb megírjuk a tevékenységed sorát – értesítünk.',
} as const;

// =====================================================================================================================
// SPEC §28 – "Öt új funkció" (owner order 2026-11-19 12:25). Default client texts (tegező, short words, never "AI",
// "kiállított számláid", "anyukád"); the backend serves them as content texts (keys in SPEC §28.9; defaults generated by
// backend/src/content/ot1119.ts). Key unions are repeated here on purpose (this file has no imports); the names below
// never repeat a name of enums.ts. Placeholders as §27 plus {osszeg} {felre} {szja} {tb} {szocho} {havi} {vevo} {n}.
// =====================================================================================================================

type _ReserveZone = 'adomentes' | 'nem_novel' | 'csak_szja' | 'teljes' | 'kedvezmeny' | 'sztorno' | 'nincs_adat';
type _AllowanceKind = 'anya30' | 'anyak' | 'fiatal25' | 'szemelyi' | 'elso_hazasok' | 'csaladi' | 'csed_gyed';
type _ChangeKind = 'valtozas_szekhely' | 'valtozas_tevekenyseg' | 'valtozas_telephely' | 'valtozas_szuneteltetes' | 'valtozas_adoadat' | 'valtozas_folytatas';
type _JourneyActorKey = 'te' | 'konyvelo' | 'csapat' | 'nav';

// ---------- §28.1 "Ennyit tegyél félre" (content felretesz.*) ----------
export const RESERVE_TEXTS = {
  /** Invoice list: the second sub-line of a row (felretesz.lista.<key>); nincs_adat shows nothing. */
  lista: {
    felre: 'Tegyél félre kb. {felre} Ft-ot',
    adomentes: 'Ebből most nem kell félretenned',
    nem_novel: 'Nem növeli az adódat',
    sztorno: 'Kb. {felre} Ft-tal kevesebbet kell félretenned',
    /** Appended to the month header after INVOICE_WORDING.monthSub. */
    honapOsszeg: 'Ebből kb. {felre} Ft-ot tegyél félre.',
  },
  /** Invoice detail: the one-liner per zone (felretesz.sor.<zone>). */
  sor: {
    teljes: '{osszeg} Ft-os számla – ebből kb. {felre} Ft-ot tegyél félre.',
    csak_szja: '{osszeg} Ft-os számla – ebből kb. {felre} Ft-ot tegyél félre.',
    kedvezmeny: '{osszeg} Ft-os számla – ebből kb. {felre} Ft-ot tegyél félre.',
    adomentes: '{osszeg} Ft-os számla – ebből most nem kell félretenned: még az adómentes részben jársz.',
    nem_novel: '{osszeg} Ft-os számla – ez nem növeli az idei adódat.',
    sztorno: 'Sztornó: {osszeg} Ft. Kb. {felre} Ft-tal kevesebbet kell félretenned.',
    nincs_adat: 'Ehhez a számlához még nem tudjuk kiszámolni, mennyit tegyél félre.',
  } as Record<_ReserveZone, string>,
  /** Appended to any one-liner when the invoice is paid next year. */
  jovore: ' Ha jövőre fizetik ki, a jövő évi adódba számít.',
  /** The parts chip under the one-liner. */
  reszek: {
    csak_szja: 'SZJA',
    teljes: 'SZJA, TB-járulék, szocho',
    kedvezmeny: 'TB-járulék, szocho – SZJA-t a kedvezményed miatt nem fizetsz',
  },
  kuszob: 'Ezzel a számlával elfogyott az adómentes részed. Innentől minden számládból félre kell tenned.',
  /** k6c2: the crossing invoice adds nothing (an allowance / the minimum covers it): never "innentől minden számládból". */
  kuszobNemNovel: 'Ezzel a számlával elfogyott az adómentes részed, de ettől most sem nő az adód.',
  kuszobKedvezmeny: 'Ezzel a számlával elfogyott az adómentes részed, de a kedvezményed miatt most sem nő az adód.',
  haviFix: 'A havi fix járulékot ({havi} Ft) ettől függetlenül fizeted.',
  becslesSor: 'Becslés: a fizetési határidővel számoltunk. Ha később fizetnek, változhat.',
  blockTitle: 'Ennyit tegyél félre',
  miertLink: 'Miért ennyi?',
  miert: {
    title: 'Miért ennyi?',
    /** k6c2: the parts are exact (no "kb."), zero parts are left out. */
    szja: 'SZJA: {szja} Ft',
    tb: 'TB-járulék: {tb} Ft',
    szocho: 'Szocho: {szocho} Ft',
    osszesen: 'Összesen, ezresre felfelé kerekítve: {felre} Ft',
    osszesenSztorno: 'Összesen: kb. {felre} Ft-tal kevesebbet kell félretenned',
    osszesenNulla: 'Összesen: ebből most nem kell félretenned',
    /** k6c2: the explanation, picked by the client's status and the zone (felretesz.miert.pont.<key>). */
    pont: {
      bevezeto: 'Annyit mutatunk, amennyivel ez a számla megnöveli az idei adódat. Ezért nem mindig ugyanannyi:',
      adomentes: '• Az első 1 936 800 Ft jövedelmed adómentes. Amíg ebben jársz, a számláidból nem kell félretenned.',
      szja: '• Utána a számla {jovedelemArany}%-a számít jövedelemnek, ennek 15%-a SZJA.',
      szjaMentes: '• A jóváhagyott kedvezményed miatt a jövedelmed után most nem fizetsz SZJA-t.',
      minimum: '• Ha a jövedelmed már a havi minimum fölött van, TB-járulék (18,5%) és szocho (13%) is jár rá.',
      mellek: '• Mellékállásban nincs havi minimum: a jövedelmed után TB-járulék (18,5%) és szocho (13%) jár.',
      nyugdijas: '• Nyugdíjasként TB-járulékot és szochót nem fizetsz, csak SZJA-t.',
      negyedev: '• A járulékot negyedévente számoljuk, ezért az év elején egy nagy számla többe kerülhet, mint ugyanannyi bevétel elosztva.',
      fix: '• Főállásban a havi fix járulékot akkor is fizeted, ha nincs bevételed. Ezt a Főoldalon külön mutatjuk.',
      csjk: '• A családi járulékkedvezményed a bevételeddel együtt nő, ezért ez a számla most a járulékodat csökkenti. Ezt nem vonjuk le, hogy biztosan maradjon pénzed.',
      sztorno: '• Ez a számla egy korábbi bevételt vesz vissza, ezért kevesebb adóval kell számolnod.',
      zaras: 'Felfelé kerekítünk ezresre, hogy inkább maradjon pénzed, mint hogy hiányozzon. A befizetendő összeget negyedévente {firstName} hagyja jóvá.',
    },
    /** felretesz.miert.szoveg (final, SPEC §28.1.5). */
    szoveg:
      'Annyit mutatunk, amennyivel ez a számla megnöveli az idei adódat. Ezért nem mindig ugyanannyi:\n• Az első 1 936 800 Ft jövedelmed adómentes. Amíg ebben jársz, a számláidból nem kell félretenned.\n• Utána a számla {jovedelemArany}%-a számít jövedelemnek, ennek 15%-a SZJA.\n• Ha a jövedelmed már a havi minimum fölött van, TB-járulék (18,5%) és szocho (13%) is jár rá.\n• A járulékot negyedévente számoljuk, ezért az év elején egy nagy számla többe kerülhet, mint ugyanannyi bevétel elosztva.\n• Főállásban a havi fix járulékot akkor is fizeted, ha nincs bevételed. Ezt a Főoldalon külön mutatjuk.\nFelfelé kerekítünk ezresre, hogy inkább maradjon pénzed, mint hogy hiányozzon. A befizetendő összeget negyedévente {firstName} hagyja jóvá.',
  },
  /** felretesz.becsles.<reason> (SPEC §28.1.7). */
  becsles: {
    fizetesi_hatarido: 'A fizetési határidővel számoltunk. Ha később fizetnek, változhat.',
    profil_nincs_megerositve: '{firstName} még nem erősítette meg az adózási adataidat.',
    kedvezmeny_jovahagyasra_var: 'A kedvezményeidet {firstName} még nem hagyta jóvá, ezért ez még nem számol velük.',
    szabalyok_tervezet: 'A jövő évi szabályok még nem véglegesek.',
    elozo_konyvelo: 'Az év elejét az előző könyvelőd számolta. Ezzel együtt becsüljük.',
  },
  /** Home card "Félretenni" (felretesz.kartya.<key>, SPEC §28.1.6). */
  kartya: {
    title: 'Félretenni',
    sentence: 'Most kb. {keepNow} Ft legyen félretéve az adódra.',
    sentenceZero: 'Most nincs mit félretenned.',
    detail:
      'Az idei bevételed után eddig kb. {A} Ft adóval kell számolnod. Ebből {B} Ft a lezárt negyedévekre esik: azt már befizetted, vagy most kell befizetned.',
    /** Appended when the running quarter still has future months with a fixed járulék (the blue band counts them). */
    detailHero: ' Fent a kék sávban az egész negyedév van, itt csak az eddigi hónapok.',
    /** Round 2 of 11-19 (k6c2: overpaid SZJA advances only – the year-end csjk is the accountant's). */
    refund: 'Az eddigi SZJA-előlegeidből kb. {refund} Ft az éves bevallásban visszajár. Addig a befizetéshez ez is kell.',
    /** k6c2: the Főoldal line under the card when the blue band and "Most" differ (felretesz.kartya.hero_*). */
    heroFix: 'Fent a kék sávban a(z) {negyedev} becslése van, a {honapok} fix járulékkal együtt; itt csak az eddigi hónapok.',
    heroHipa: 'Itt az iparűzési adó is benne van (kb. {hipa} Ft), fent nincs.',
    heroLezart: 'Fent a kék sávban a lezárt {negyedev} összege van: itt a „Lezárt negyedévek” sorban szerepel.',
    heroNincs: 'Fent az áll, hogy most nincs mit befizetned: ez az összeg a következő negyedéves befizetésig gyűlik.',
    /** k6c2: the invoice row = Σ of the per-invoice amounts on /felretesz (each rounded up). */
    rowSzamlakSub: 'számlánként felfelé kerekítve',
    rowElteres: 'A lezárt negyedévek jóváhagyott összegéből',
    rowElteresSub: 'a mostani számításnál több (például egy később jóváhagyott kedvezmény miatt)',
    detailZero: 'Ami eddig összegyűlt, az a lezárt negyedévekre esik, és azt már befizetted, vagy most kell befizetned.',
    rowSzamlak: 'Az idei számláid után',
    rowFix: 'Havi fix járulék eddig',
    rowFixSub: '{fixedMonthly} Ft havonta, bevételtől függetlenül',
    rowHipa: 'Iparűzési adó eddig',
    rowHipaSub: 'évente kb. {hipaAnnual} Ft',
    rowHipaKonyvelo: '{firstName} számolja',
    rowLezart: 'Lezárt negyedévek',
    rowLezartSub: 'befizetted, vagy most fizeted',
    link: 'Számlánként megnézem',
    footnote: 'Becslés. A befizetendőt negyedévente {firstName} hagyja jóvá.',
  },
  /** The /felretesz screen. */
  kepernyo: {
    title: 'Ennyit tegyél félre',
    privatePerson: 'Magánszemély',
    manualItem: 'Kézi tétel: {description}',
    empty: 'Idén még nincs kiállított számlád. Ha lesz, itt látod, mennyit tegyél félre.',
    /** Round 2 of 11-19: an item whose money is expected later (the payment deadline). */
    upcoming: 'Várható: {datum} Még nincs benne a fenti összegben.',
    monthSub: '{n} tétel · félretenni kb. {felre} Ft',
    monthSubUpcoming: '{n} tétel · félretenni kb. {felre} Ft · {u} várható',
    /** k6c2: a month with nothing to put aside / a month that lowers the reserve. */
    monthSubNulla: '{n} tétel · nem kell félretenned',
    monthSubNullaUpcoming: '{n} tétel · nem kell félretenned · {u} várható',
    monthSubKevesebb: '{n} tétel · kb. {felre} Ft-tal kevesebbet kell félretenned',
    monthSubKevesebbUpcoming: '{n} tétel · kb. {felre} Ft-tal kevesebbet kell félretenned · {u} várható',
    /** k6c2: the total line at the top of /felretesz = the Főoldal row. */
    total: 'Az idei számláid után összesen kb. {felre} Ft',
    help: 'Elakadtál? Kérj visszahívást',
  },
} as const;
/** Panel tooltip words per zone (SPEC §28.1.9). */
export const RESERVE_ZONE_STAFF_LABELS: Record<_ReserveZone, string> = {
  adomentes: 'adómentes részben',
  nem_novel: 'nem növeli',
  csak_szja: 'csak SZJA',
  teljes: 'SZJA + járulék',
  kedvezmeny: 'kedvezmény fedi az SZJA-t',
  sztorno: 'sztornó',
  nincs_adat: 'nincs adat',
};
/** Panel Áttekintés mini card "Ezt látja az ügyfél" (SPEC §28.1.9). */
export const RESERVE_PANEL_TEXTS = {
  title: 'Ezt látja az ügyfél',
  keepNow: 'Félretenni most: kb. {keepNow} Ft',
  ytdNet: 'Idén eddig maradt neki: kb. {ytdNet} Ft',
  column: 'Félretenni',
  link: 'Havonta megnézem',
} as const;

// ---------- §28.2 new-invoice notification (content notif.invoice_new[.<variant>].title|body) ----------
export const NOTIFY_INVOICE_TEXTS = {
  alap: { title: 'Új kiállított számlád: {osszeg} Ft', body: '{vevo}. Tegyél félre kb. {felre} Ft-ot.' },
  kuszob: { title: 'Új kiállított számlád: {osszeg} Ft', body: '{vevo}. Tegyél félre kb. {felre} Ft-ot. Elfogyott az adómentes részed.' },
  adomentes: { title: 'Új kiállított számlád: {osszeg} Ft', body: '{vevo}. Ebből most nem kell félretenned.' },
  tobb: { title: '{n} új kiállított számlád: összesen {osszeg} Ft', body: 'Tegyél félre kb. {felre} Ft-ot. Megnézem, melyik mennyi.' },
  tobb_adomentes: { title: '{n} új kiállított számlád: összesen {osszeg} Ft', body: 'Ezekből most nem kell félretenned.' },
  /** Push only, when the client switched amounts off. */
  rejtett: { title: 'Új kiállított számlád érkezett', titleTobb: '{n} új kiállított számlád érkezett', body: 'Nézd meg, mennyit tegyél félre.' },
  /** {vevo} for a private person or an empty name. A private person's name is never put in a push. */
  privatePerson: 'Magánszemély',
  /** E-mail (off by default): subject = the title, body = the in-app body + this line. */
  emailFooter: 'Az összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz',
} as const;
/** Fiók → Értesítések additions (SPEC §28.2.3, §28.K.4). */
export const NOTIFY_SETTINGS_TEXTS = {
  quietTitle: 'Csendes idő',
  quietToggle: 'Éjjel ne szóljon a telefon',
  quietSub: '{from}:00 és {to}:00 között nem küldünk telefonos értesítést. Az appban ilyenkor is megjelenik.',
  quietFrom: 'Ettől',
  quietTo: 'Eddig',
  groupSzamlak: 'SZÁMLÁK',
  invoiceNewRow: 'Új kiállított számla',
  invoiceNewSub: 'Amikor letöltöttük a NAV rendszeréből, és megmutatjuk, mennyit tegyél félre.',
  amountsToggle: 'Összeg és vevő a telefonos értesítésben',
  amountsSub: 'Ha kikapcsolod, a zárolt képernyőn csak annyi látszik: új kiállított számlád érkezett.',
  groupKedvezmenyek: 'KEDVEZMÉNYEK',
  allowanceDecidedRow: 'Döntés a kedvezményeidről',
  allowanceCheckRow: 'Kedvezmény-emlékeztetők',
  assistChangeDoneRow: 'Kész a változásbejelentés',
} as const;

// ---------- §28.3 allowances (content kedvezmeny.*) ----------
export const ALLOWANCE_LABELS: Record<_AllowanceKind, string> = {
  anya30: '30 év alatti anyák kedvezménye',
  anyak: 'Két vagy több gyermeket nevelő anyák kedvezménye',
  fiatal25: '25 év alattiak kedvezménye',
  szemelyi: 'Személyi kedvezmény',
  elso_hazasok: 'Első házasok kedvezménye',
  csaladi: 'Családi kedvezmény',
  csed_gyed: 'Kieső idő (táppénz, CSED, GYED)',
};
/** The anyák label per jogcím (enums ANYAK_JOGCIMEK). */
export const ANYAK_LABELS: Record<'ket' | 'harom' | 'negyplusz', string> = {
  ket: 'Két gyermeket nevelő anyák kedvezménye',
  harom: 'Három gyermeket nevelő anyák kedvezménye',
  negyplusz: 'Négy vagy több gyermeket nevelő anyák kedvezménye',
};
/** The one-line effect per kind (`AllowanceItemView.line`, kedvezmeny.sor.<kind>). */
export const ALLOWANCE_CLIENT_LINES: Record<_AllowanceKind, string> = {
  anya30: '30 éves korodig nem fizetsz SZJA-t a vállalkozásod jövedelme után.',
  anyak: 'Nem fizetsz SZJA-t a vállalkozásod jövedelme után, egész életedben.',
  fiatal25: 'Idén az adómentes részen felül kb. 8,6 millió Ft jövedelemig nem fizetsz SZJA-t (havonta kb. 716 000 Ft gyűlik).',
  szemelyi: 'Havonta 16 140 Ft-tal kevesebb SZJA.',
  elso_hazasok: 'Havonta 5 000 Ft-tal kevesebb SZJA, 24 hónapig, kettőtöknek együtt.',
  csaladi: 'Gyerekenként havonta 20 001–66 000 Ft-tal kevesebb SZJA. Ha nem fogy el, a TB-járulékodból is.',
  csed_gyed: 'Ezekre a hónapokra nem kell minimum járulékot fizetned.',
};
export const ALLOWANCE_REJECT_REASON_LABELS: Record<'kor' | 'nem_jogosult' | 'mas_veszi_igenybe' | 'nincs_jovedelem' | 'igazolas_hianyzik' | 'egyeb', string> = {
  kor: 'Az életkora alapján nem jár',
  nem_jogosult: 'Nem jogosult',
  mas_veszi_igenybe: 'A párja veszi igénybe',
  nincs_jovedelem: 'Nincs olyan jövedelme, amire jár',
  igazolas_hianyzik: 'Hiányzik az igazolás',
  egyeb: 'Egyéb',
};
/** "Ezeket tartsd meg, {firstName} elkérheti:" – only the relevant ones are listed (SPEC §28.3.4 K12). */
export const ALLOWANCE_DOCUMENTS_TO_KEEP = {
  csaladi_potlek: 'a családi pótlékról szóló határozat',
  hazassagi_anyakonyvi: 'a házassági anyakönyvi kivonat',
  orvosi_igazolas: 'az orvosi igazolás',
  felvaltva_dontes: 'a felváltva gondozásról szóló bírósági döntés vagy megállapodás',
} as const;
export const ALLOWANCE_TEXTS = {
  /** Gate sheet (kedvezmeny.kapu.*). */
  kapu: {
    title: 'Jár neked adókedvezmény?',
    body: 'Például gyerekek után, 25 év alatt, édesanyáknak, friss házasoknak vagy súlyos betegség miatt. Ha jár, kevesebb adót fizetsz.',
    primary: 'Megnézem (kb. 3 perc)',
    nemJar: 'Nem jár',
    nemJarToast: 'Rendben. Ha változik valami, a Fiókban bármikor megadhatod.',
    kesobb: 'Később',
  },
  /** Főoldal hint (ClientHome.allowancesHint). */
  hint: { text: 'Jár neked adókedvezmény? Nézd meg, kb. 3 perc.', button: 'Megnézem', close: 'Most nem' },
  /** Journey row (§28.3.4). */
  journeySub: 'Te · kb. 3 perc · ha jár',
  /** Fiók → "Adózás" row and its status sub-line. */
  fiok: {
    section: 'Adózás',
    row: 'Adókedvezményeid',
    subNincs: 'Nem töltötted ki',
    subAtnezi: '{firstName} átnézi',
    subJovahagyva: '{n} jóváhagyva',
    subNemJar: 'Nem jár',
  },
  /** /kedvezmenyek status screen (§28.3.5). */
  allapot: {
    title: 'Adókedvezményeid',
    subSaved: 'Idén eddig kb. {savedYtd} Ft-tal kevesebb adót fizetsz',
    subPending: '{firstName} átnézi a válaszaidat.',
    subNone: 'Nézd meg, jár-e neked.',
    noneButton: 'Megnézem',
    javasolt: '{firstName} átnézi',
    kerdes: '{firstName} kérdezett: {question}',
    kerdesButton: 'Válaszolok',
    /** k6c2: the kind's MARGINAL share on the "idén eddig" basis of the band (the rows add up to it). */
    jovahagyva: 'Jár · {monthsText} · idén eddig kb. {effectYear} Ft-tal kevesebb adó',
    /** k6c2: another allowance already uses its base (29/H order). */
    jovahagyvaFedi: 'Jár · {monthsText} · most nem csökkenti tovább az adódat: a másik kedvezményed miatt nem marad rá adó.',
    jovahagyvaFediCsaladi: 'Jár · {monthsText} · a másik kedvezményed miatt most nem marad rá SZJA. A fel nem használt részt az éves bevallásban {firstName} számolja el.',
    /** k6c: approved, but no effect yet (no revenue above the adómentes rész): never "kb. 0 Ft-tal kevesebb". */
    jovahagyvaMegNincs: 'Jár · {monthsText} · ha lesz bevételed, kevesebb adót fizetsz miatta',
    jovahagyvaEvVegen: 'Jár · az éves bevallásban számoljuk el',
    elutasitva: 'Nem jár: {rejectText}',
    edit: 'Valami változott – módosítom',
    footer: 'A jóváhagyott kedvezményt a negyedéves adóelőlegedben számoljuk el. Ha év közben valami nem stimmel, az éves bevallásban rendezzük.',
  },

  /** k6c2: the családi line when an anyák / 30 év alatti exemption already covers the SZJA (kedvezmeny.sor_csaladi_anya). */
  sorCsaladiAnya: 'SZJA-t az anyák kedvezménye miatt nem fizetsz, ezért a családi kedvezmény a TB-járulékodat csökkentheti (családi járulékkedvezmény). Amit nem használsz fel, azt az éves bevallásban számoljuk el.',
  /** K12 when nothing applies. */
  semmi: { title: 'Most úgy tűnik, nem jár kedvezmény', body: 'Ha változik valami (például babát vártok), itt bármikor megadhatod.', button: 'Rendben' },
  sentToast: 'Elküldtük. {firstName} átnézi, és szól.',
  /** KATA clients: the gate sheet instead of the questionnaire (SPEC §28.K.11). */
  kata: 'A katádra az adókedvezmények nem hatnak. Ha munkabéred is van, arra igen: azt a munkáltatód vagy az éves bevallásod rendezi.',
  validation: {
    birth: 'Válaszd ki az évet és a hónapot.',
    childrenCount: 'Add meg, hány gyermekről van szó.',
    dueMonth: 'Mikorra várjátok? Válassz hónapot.',
    weddingFuture: 'Az esküvő hónapja nem lehet a jövőben.',
    share: 'A megosztás 10 és 90% között lehet.',
  },
  monthNames: ['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus', 'szeptember', 'október', 'november', 'december'],
} as const;
/** The questionnaire pages K0–K12 (content kedvezmeny.kerdoiv.<page>.<key>, SPEC §28.3.4); icons are approved 3D icons. */
export const ALLOWANCE_QUESTION_TEXTS = {
  K0: {
    icon: 'igazolas',
    title: 'Adókedvezményeid',
    text: 'Pár igen–nem kérdés. Neveket, TAJ-számot nem kérünk. A válaszaidat {firstName} nézi át, és ő dönti el, mi jár neked. Amit jóváhagy, azt beszámoljuk az adódba.',
    button: 'Kezdjük',
  },
  K1: {
    icon: 'tepnaptar',
    title: 'Mikor születtél?',
    why: 'A 25 és 30 év alattiak és a kétgyermekes anyák kedvezménye az életkortól függ. A napot nem kérjük.',
    year: 'Év',
    month: 'Hónap',
  },
  K2: {
    icon: 'fiok',
    title: 'Van gyermeked, akire családi pótlékot kapsz, vagy legalább 12 évig kaptál?',
    why: 'Gyerekek után jár a legtöbb kedvezmény.',
    igen: 'Igen',
    nem: 'Nem',
  },
  K3: {
    icon: 'fiok',
    title: 'Mesélj a gyerekeidről',
    why: 'Nevet nem kérünk, elég, ha sorban végigmész rajtuk.',
    count: 'Hány gyermekről van szó?',
    card: '{n}. gyermek',
    potlekMost: 'Most is kapok rá családi pótlékot',
    potlekTizenketEv: 'Már nem, de legalább 12 évig kaptam',
    potlekNem: 'Már nem kapok rá',
    elhunyt: 'A családi pótlék a gyermekem halála miatt szűnt meg',
    kezdete: 'Idén kezdtem kapni (pl. idén született)',
    vege: 'Idén megszűnik (pl. befejezi az iskolát)',
    sajat: 'Saját vagy örökbe fogadott gyermekem',
    tartosBeteg: 'Tartósan beteg vagy súlyosan fogyatékos',
    felvaltva: 'Felváltva gondozzuk a másik szülővel',
  },
  K4: {
    icon: 'fiok',
    title: 'Van más eltartottad is?',
    why: 'Például nappali tagozatos egyetemista gyermeked, akit a családi pótléknál beszámítanak. Ettől nő a gyerekenkénti kedvezmény.',
  },
  K5: {
    icon: 'tepnaptar',
    title: 'Babát vártok?',
    why: 'Ha te vagy a párod várandós, a 91. naptól már jár a családi kedvezmény. Az orvosi igazolást tartsd meg.',
    when: 'Mikorra várjátok?',
  },
  K6: { icon: 'fiok', title: 'Te vagy a gyerekek anyukája?', why: 'Az anyák 2026-ban sokszor egyáltalán nem fizetnek SZJA-t a vállalkozásuk után.' },
  K7: {
    icon: 'szamolo',
    title: 'Ki veszi igénybe a családi kedvezményt?',
    why: 'Egy hónapra a kedvezmény egyszer jár. Ha a párodnak munkabére van, lehet, hogy nála éri meg jobban – {firstName} megmondja.',
    en: 'Én',
    par: 'A házastársam vagy élettársam',
    kozosen: 'Megosztjuk',
    share: 'Kb. mennyit te?',
    csjk: 'Ha az SZJA-dból nem fogy el, csökkentse év közben a TB-járulékodat is?',
    csjkIgen: 'Igen',
    csjkKonyvelo: 'Döntse el {firstName}',
  },
  K8: {
    icon: 'igazolas',
    title: 'Az elmúlt két évben házasodtál, és legalább egyikőtöknek ez az első házassága?',
    why: 'Havonta 5 000 Ft-tal kevesebb SZJA, 24 hónapig, kettőtöknek együtt.',
    when: 'Mikor volt az esküvő?',
    who: 'Ki veszi igénybe?',
    en: 'Én',
    par: 'A párom',
    kozosen: 'Megosztjuk',
  },
  K9: {
    icon: 'irat',
    title: 'Súlyosan fogyatékos vagy, vagy rokkantsági járadékot, fogyatékossági támogatást kapsz?',
    why: 'Ilyenkor havonta 16 140 Ft-tal kevesebb SZJA jár. Az orvosi igazolást tartsd meg, nem kell feltöltened.',
    since: 'Mióta?',
    regebb: 'Régebb óta',
    basis: 'Mi alapján?',
    orvosi: 'Orvosi igazolás',
    jaradek: 'Rokkantsági járadék',
    tamogatas: 'Fogyatékossági támogatás',
  },
  K10: {
    icon: 'ora',
    title: 'Kapsz idén táppénzt, CSED-et vagy GYED-et?',
    why: 'Ezekre a hónapokra nem kell a havi minimum járulékot fizetned.',
    from: 'Mettől?',
    to: 'Meddig?',
    still: 'Még kapom',
  },
  K11: {
    icon: 'lakat',
    title: 'Egészségügyi adat',
    consent: 'Hozzájárulok, hogy ezt az egészségügyi adatot a kedvezményem kiszámításához kezeljétek. Csak {firstName} látja, és bármikor visszavonhatom.',
    noConsent: 'Ha nem jelölöd be, ezt nem mentjük el, és most nem tudjuk beszámolni. Az éves bevallásban akkor is érvényesítheted.',
  },
  K12: {
    icon: 'igazolas',
    title: 'Ezek járhatnak neked',
    effect: 'kb. {x} Ft-tal kevesebb adó idén',
    effectAnnual: 'Év végén számoljuk el',
    /** k6c2: another proposed allowance already uses the base. */
    effectCovered: 'A másik kedvezményed mellett most nem marad rá adó',
    effectCoveredCsaladi: 'Most nem marad rá SZJA – a maradékot év végén számoljuk el',
    /** k6c: an in-year allowance without an estimate yet (the next screen says the same). */
    effectQuarterly: 'A negyedéves adódban számoljuk el',
    note: 'Megjegyzés {firstName} számára (nem kötelező)',
    send: 'Elküldöm',
    sub: '{firstName} a lehető leggyorsabban átnézi.',
    keep: 'Ezeket tartsd meg, {firstName} elkérheti:',
  },
  progress: '{i}/{n}',
  back: 'Vissza',
  next: 'Tovább',
} as const;
/** Notifications (SPEC §28.3.9, §28.8): notif.allowance_*[.<variant>].title|body. */
export const ALLOWANCE_NOTIFICATION_TEXTS = {
  allowance_submitted: { title: '{clientName} kitöltötte a kedvezmény-kérdőívet', body: 'Nézd át: {n} kedvezmény vár döntésre.' },
  allowance_decided: {
    jovahagyva: { title: 'Jóváhagyta a kedvezményedet: {label}', body: 'Már az adóelőlegedben számolunk vele.' },
    reszben: { title: '{firstName} átnézte a kedvezményeidet', body: 'Nézd meg, mi jár.' },
    kerdes: { title: '{firstName} kérdezett a kedvezményedről', body: 'Válaszolj neki az Üzenetekben.' },
    elutasitva: { title: '{firstName} átnézte a kedvezményeidet', body: 'Egy kedvezmény most nem jár. Megnézem, miért.' },
  },
  allowance_check: {
    ev_eleje: { title: 'Új év: nézd át a kedvezményeidet', body: 'Változott valami a családodban? Kb. 1 perc.' },
    lejar: { title: 'Ebben a hónapban véget ér: {label}', body: 'Utána több SZJA-val számolunk. {firstName} tud róla.' },
  },
  digest: 'Kedvezmény vár: {n} ügyfél',
} as const;
/** Panel "Kedvezmények" tab (SPEC §28.3.6; staff wording). */
export const ALLOWANCE_PANEL_TEXTS = {
  tab: 'Kedvezmények',
  answersTitle: 'Az ügyfél válaszai',
  healthConsent: 'Egészségügyi adathoz hozzájárult: {at}',
  healthConsentNone: 'Egészségügyi adathoz hozzájárult: nincs',
  legacy: 'Régi jelzés',
  taxIdsLine: 'A gyermekek és a házastárs adóazonosító jele kell a bevalláshoz',
  taxIdsButton: 'Kérés küldése',
  taxIdsRequest: 'Kérlek, töltsd fel a gyermekeid (és ha megosztjátok, a párod) adóigazolványának képét. A bevalláshoz kell.',
  inYear: 'Év közben, az előlegben',
  csjkInYear: 'Családi járulékkedvezmény év közben',
  csjkHint: 'Ilyenkor az SZJA-előleget is a 2658-ban kell bevallani.',
  allMonths: 'Mind a 12 hónapra',
  preview: 'Idei hatás (becslés): SZJA −{x} Ft · TB −{y} Ft (családi járulékkedvezmény) · Szocho változatlan.',
  previewUnused: 'Fel nem használt családi kedvezmény: {u} Ft → az éves bevallásban kb. {c} Ft térülhet.',
  approve: 'Jóváhagyom',
  ask: 'Kérdezek',
  reject: 'Nem jár',
  kiesoButton: 'Kieső időként felveszem',
  filterChip: 'Kedvezmény vár ({n})',
  partnerTakes: 'A párod veszi igénybe',
} as const;

// ---------- §28.4 "Mennyit kerestem?" (content kereset.*) ----------
export const EARNINGS_TEXTS = {
  cardTitle: 'Mennyit kerestem?',
  cardSentence: 'Idén eddig kb. {ytdNet} Ft maradt neked',
  /** k6c2: revenue below the fixed costs – never "kb. -1 164 000 Ft maradt neked". */
  cardSentenceNegative: 'Idén eddig kb. {ytdNet} Ft-tal több volt az adód és a járulékod, mint a bevételed.',
  cardSub: '{ytdRevenue} Ft bevételből, kb. {ytdTaxes} Ft adó és járulék után.',
  cardProjection: 'Ha így folytatod, év végéig kb. {projNet} Ft marad.',
  cardProjectionNegative: 'Ha így folytatod, év végéig kb. {projNet} Ft-tal több lesz az adód és a járulékod, mint a bevételed.',
  cardLink: 'Havonta megnézem',
  screenTitle: 'Mennyit kerestem?',
  screenSub: '{year}. január–{honap}, adók és járulékok után',
  /** k6c2: the blue band when the year so far is negative. */
  screenSubNegative: '{year}. január–{honap}: ennyivel több volt az adód és a járulékod, mint a bevételed',
  projectionNegative: 'kb. {projNet} Ft-tal több adó és járulék, mint bevétel',
  /** kereset.line (final). */
  line: 'Ennyi marad a bevételedből, miután levontuk az SZJA-t, a TB-járulékot, a szochót és az iparűzési adót. A költségeidet (anyag, telefon, autó) ebből fizeted – ezeket nem látjuk.',
  monthSub: 'bevétel {rev} · adó {taxes}',
  basis: { becsles: 'becslés', jovahagyva: 'jóváhagyva', befizetve: 'befizetve ✓' },
  noRevenueNote: 'Nem volt bevételed, a havi fix járulékot ettől még fizeted.',
  partsTitle: '{honap}',
  partSzja: 'SZJA',
  partTb: 'TB-járulék',
  partSzocho: 'Szocho',
  partHipa: 'Iparűzési adó',
  projectionTitle: 'Év végéig várhatóan',
  projectionNet: 'kb. {projNet} Ft',
  projectionSub: 'Ha így folytatod: kb. {projRev} Ft bevételből, kb. {projTaxes} Ft adóval.',
  projectionNote: 'Ez csak előrejelzés: az eddigi bevételed tempójával számol.',
  projectionNotYet: 'Az év végi előrejelzést 2 hónap után mutatjuk.',
  /** k6c2: no year-end projection while the business is paused (no invoicing then). */
  projectionPaused: 'Amíg szünetel a vállalkozásod, nem mutatunk év végi előrejelzést.',
  howLink: 'Hogyan számoljuk?',
  disclaimer: 'Becslés. A végleges adót {firstName} hagyja jóvá.',
  /** Round 2 of 11-19 (k6c2): the SZJA advances never go below 0 – after a late allowance part of them comes back. Only
   *  the overpaid SZJA counts; the unused családi kedvezmény is the accountant's (a line without an amount). */
  refund: 'Az eddigi SZJA-előlegeidből kb. {refund} Ft az éves bevallásban visszajár. A fenti adóban ezt már levontuk.',
  cardRefund: 'Az eddigi SZJA-előlegeidből kb. {refund} Ft az éves bevallásban visszajár – a fenti adóban ezt már levontuk.',
  csaladiEvVegen: 'A fel nem használt családi kedvezményedet az éves bevallásban {firstName} számolja el.',
  /** KATA view (SPEC §28.K.11). */
  kataLine: 'A kata mindent fedez: nincs külön SZJA, TB és szocho.',
} as const;

// ---------- §28.5 change guides (content valtozas.*) ----------
export const CHANGE_TEXTS = {
  hub: {
    title: 'Változás a vállalkozásodban',
    sub: 'Költözöl, új munkába kezdesz vagy szünetet tartasz? Megmutatjuk, mit kell bejelentened – vagy intézzük helyetted.',
    other: 'Más változott (lakcím, telefonszám, bankszámla)?',
    help: 'Elakadtál? Kérj visszahívást',
    open: 'Folyamatban: {kindTitle} – {statusText}',
    fiokRow: 'Változás a vállalkozásodban',
    requestTile: 'Változás a vállalkozásodban',
    messagesTile: 'Megváltozott egy adatom',
  },
  /** Hub rows (title + one line). */
  sorok: {
    valtozas_szekhely: { title: 'Költözik a székhelyed', line: 'Új cím a NAV-nál. Kb. 10 perc.' },
    valtozas_tevekenyseg: { title: 'Új vagy más tevékenység', line: 'Új munka, új ÖVTJ-kód. Kb. 10 perc.' },
    valtozas_telephely: { title: 'Új telephely', line: 'Üzlet, műhely, iroda másik címen. Kb. 10 perc.' },
    valtozas_szuneteltetes: { title: 'Szüneteltetés', line: 'Szünetet tartasz a vállalkozásodban. Kb. 10 perc.' },
    valtozas_adoadat: { title: 'Adózási adat változik', line: 'Például munkaviszonyt kezdesz vagy befejezel. Ezt a könyvelőd intézi.' },
    valtozas_folytatas: { title: 'Újrakezdés szünetelés után', line: 'Újra dolgoznál a vállalkozásodban. Kb. 10 perc.' },
  } as Record<_ChangeKind, { title: string; line: string }>,
  /** Info pages /valtozas/[fajta]: "Mit jelent?" + "Mire figyelj?" (final unless marked [ELLENŐRIZENDŐ]). */
  info: {
    valtozas_szekhely: {
      mit: 'A székhelyed az a cím, ami a nyilvántartásban és a számláidon szerepel. Ha költözöl, ezt be kell jelentened.',
      figyelj: [
        'Az új cím nyilvános lesz: bárki megnézheti a nyilvántartásban.',
        'Kell hozzá jogcím: a lakás a tiéd, bérled, a tulajdonos hozzájárult, vagy székhelyszolgáltatóval szerződtél.',
        'Ha másik településre költözöl, az iparűzési adód is oda kerül. Ezt {firstName} intézi.',
        'Utána írd át a címedet a számlázóprogramodban is.',
      ],
    },
    valtozas_tevekenyseg: {
      mit: 'Ha új munkába kezdesz, vagy más lesz a fő munkád, a tevékenységeidet a hivatalos ÖVTJ-listából kell bejelentened.',
      figyelj: [
        'Csak olyan tevékenységet jelents be, aminek a feltételeit teljesíted. Ha képesítés kell hozzá, legyen meg.',
        'Ha nem tudod, melyik sor a jó, megírjuk.',
        'Más tevékenységnél más költséghányad járhat. Szólj, és {firstName} átállítja.',
      ],
    },
    valtozas_telephely: {
      mit: 'Telephely az üzlet, műhely vagy iroda, ahol rendszeresen dolgozol, és nem a székhelyed.',
      figyelj: ['Kell hozzá jogcím, mint a székhelynél.', 'Ha másik településen van, ott is iparűzési adót fizethetsz. {firstName} megnézi.'],
    },
    valtozas_szuneteltetes: {
      mit: 'Ha egy ideig nem dolgozol a vállalkozásodban, szüneteltetheted. Ezalatt nem kell járulékot fizetned.',
      figyelj: [
        'Szünetelés alatt nem dolgozhatsz a vállalkozásodban, és nem állíthatsz ki számlát.',
        'A kezdőnapot nem adhatod meg visszamenőleg, és később nem módosíthatod. Jól gondold meg.',
        'Ha újra kezdenéd, azt is be kell jelentened. Szólj nekünk előtte.',
        'Szünetelés alatt a havidíj helyett csak a szüneteltetési díjat fizeted: havi {pauseFee}.',
      ],
      /** [ELLENŐRIZENDŐ] – shown only after B4 confirmed it (SPEC §28.5.1 fact 3). */
      figyeljEllenorizendo: ['Legalább egy hónapig, legfeljebb két évig tarthat.'],
    },
    valtozas_adoadat: {
      mit: 'Ilyen például, ha munkaviszonyt kezdesz vagy befejezel (főállás vagy mellékállás), nyugdíjas leszel, kata és átalányadó között váltasz, vagy közösségi adószámot kérsz.',
      figyelj: [
        'Ezt nem a Vállalkozói Ügysegédben, hanem az ONYA-ban, a T101E nyomtatványon kell bejelenteni.',
        'Általában {firstName} intézi meghatalmazottként, neked csak szólnod kell.',
        'Ha kilépnél az átalányadózásból vagy az ÁFA-mentességből, előtte beszéljünk: erre most nem terjed ki a szolgáltatásunk.',
      ],
    },
    valtozas_folytatas: {
      mit: 'Ha a szünetelés után újra dolgoznál a vállalkozásodban, ezt be kell jelentened. Az újrakezdés napjától újra fizeted az adót és a járulékot.',
      figyelj: [
        'Számlát csak az újrakezdés napjától állíthatsz ki.',
        'Az újrakezdéstől újra a havidíj jár a szüneteltetési díj helyett.',
        'A NAV-os lap pontos feliratait még ellenőrizzük. Ha elakadsz, kérj visszahívást.',
      ],
    },
  } as Record<_ChangeKind, { mit: string; figyelj: readonly string[]; figyeljEllenorizendo?: readonly string[] }>,
  /** The highlighted assisted card (§27.3.1 pattern) – the fee line comes from FEE_TEXTS (SPEC §28.K.1). */
  helyettunk: {
    badge: 'Ha nem boldogulsz vele',
    badgeAdoadat: 'Ajánlott',
    title: 'Bejelentjük helyetted',
    body: 'Megadod az új adatokat, {firstName} meghatalmazottként beküldi. Te csak jóváhagyod az appban.',
    button: 'Ezt kérem',
  },
  selfButton: 'Megmutatod, hogyan csinálom magam?',
  selfFree: 'Magam jelentem be (ingyenes)',
  outdated: '2027-től a vállalkozói nyilvántartást a kamara vezeti. Ezt az útmutatót frissítjük; addig kérj visszahívást, és segítünk.',
  sheetTitle: 'Bejelentjük helyetted: {kindLabel}',
  callbackToggle: 'Hívjatok fel előtte',
  callbackForced: 'Erről előbb beszéljünk.',
  send: 'Elküldöm',
  toast: 'Megkaptuk. {firstName} átnézi, és szól.',
  pictureLabel: 'NAV-képernyő · Forrás: saját képernyőkép, 2026. november 19.',
  drawnLabel: 'Rajzolt vázlat – a valódi képernyő kicsit eltérhet',
} as const;
/** Facts every change text must keep (SPEC §28.5.1); `verified: false` = stays out of the app until B4 confirms it. */
export const CHANGE_FACTS: readonly { key: string; text: string; verified: boolean }[] = [
  { key: 'nem_vonhato_vissza', text: 'A beküldött bejelentést nem lehet visszavonni, ezért a későbbi változásokat is gondosan kell bejelenteni.', verified: true },
  { key: 'szunetel_kezdet', text: 'A szüneteltetés legkorábban ma kezdődhet, és a kezdőnapot később nem lehet módosítani; csak egy újabb, korábbi napot lehet bejelenteni.', verified: true },
  { key: 'szunetel_hossz', text: 'A szüneteltetés legalább 1 hónap, legfeljebb 2 év. Az újrakezdést be kell jelenteni, különben 2 év után törlik a vállalkozást.', verified: false },
  { key: 'szunetel_hatas', text: 'Szünetelés alatt nincs tevékenység, nincs számla és nincs járulék. Az ÁFA-keret nem csökken.', verified: true },
  { key: 'hatarido_15', text: 'A változást 15 napon belül kell bejelenteni.', verified: false },
  { key: 'szekhely_nyilvanos', text: 'Az új székhely címe nyilvános.', verified: true },
  { key: 'hipa_telepules', text: 'Másik településre költözéskor az iparűzési adó is oda kerül; egy másik településen lévő telephely ott is iparűzési adót hozhat.', verified: true },
  { key: 'koltseghanyad', text: 'Más tevékenységnél más költséghányad (45 / 80 / 90%) járhat.', verified: true },
  { key: 'kepesites', text: 'Képesítéshez kötött tevékenységet csak a képesítéssel lehet végezni.', verified: true },
  { key: 'szuletesi_orszag', text: 'A változásbejelentés első lapján a „Születési ország” kötelező.', verified: true },
];
/** "Így megy" list of the assisted change sheet (SPEC §28.5.5 + §28.K.1 prepayment; the 'dij' row only when a fee applies). */
export const CHANGE_STEP_LIST: readonly { actor: _JourneyActorKey; text: string; time: string; onlyWithFee?: boolean }[] = [
  { actor: 'te', text: 'Megadod az új adatokat.', time: 'kb. 3 perc' },
  { actor: 'te', text: 'Kifizeted a díjat ({dij} Ft).', time: 'kb. 1 perc', onlyWithFee: true },
  { actor: 'konyvelo', text: '{firstName} átnézi, és ha kell, kiegészíti.', time: 'általában 1 munkanap' },
  { actor: 'te', text: 'Jóváhagyod az appban.', time: 'kb. 1 perc' },
  { actor: 'konyvelo', text: '{firstName} meghatalmazottként beküldi.', time: 'általában 1 munkanap' },
  { actor: 'nav', text: 'A NAV elfogadja, és szólunk.', time: '' },
];
/** Client status line of a change assist (content valtozas.allapot.<status>); the others use ASSIST_STATUS_CLIENT_TEXT. */
export const CHANGE_STATUS_CLIENT_TEXT = {
  visszahivas_kerve: 'Visszahívást kértél. Kollégánk 24–48 órán belül hív.',
  dijra_var: 'Fizesd ki a díjat ({dij} Ft), és {firstName} nekilát.',
  egyeztetve: 'Megkaptuk. {firstName} átnézi az adataidat.',
  meghatalmazas_el: 'Nézd át, mit jelentünk be, és engedélyezd.',
  ugyfel_engedelyezte: 'Engedélyezted. {firstName} általában 1 munkanapon belül beküldi.',
  bejelentes_bekuldve: 'Beküldtük. Amint a NAV elfogadta, szólunk.',
  kesz: 'Kész: a NAV elfogadta. Az értesítést a dossziédban találod.',
} as const;
/** /valtozas/engedely (SPEC §28.5.5; jogi template `valtozas_utasitas`). */
export const CHANGE_CONSENT_TEXTS = {
  title: 'Nézd át, mit jelentünk be',
  sub: 'Ezekkel az adatokkal küldi be {firstName} a változást. Ha valamit javítanál, koppints a „Módosítom” gombra.',
  edit: 'Módosítom',
  declaration: 'Kijelentem, hogy az adatok igazak, és a változás {valtozasNapja} napjától érvényes.',
  instruction: 'Megbízom {konyveloNev} könyvelőt, hogy ezt a változást a nevemben, meghatalmazottként bejelentse a NAV-nál, pontosan ezekkel az adatokkal.',
  button: 'Engedélyezem a bejelentést',
  stale: 'Módosítottad az adatokat, ezért engedélyezd újra.',
} as const;
/** Panel /helyettunk handbook (SPEC §28.5.5; staff wording; content valtozas.kezikonyv.<key>). */
export const CHANGE_HANDBOOK = {
  title: 'Kézikönyv',
  ugyseged:
    'Ügyfélportál → Vállalkozói Ügysegéd → Képviseletválasztó „Más ügyében járok el” → az ügyfél → „Új bejelentés, kérelem benyújtása” → „Egyéni vállalkozással kapcsolatos adatváltozás bejelentése” → „Bejelentés kitöltése” → 1 Személyi adatok (Születési ország kötelező) → 2 Vállalkozói címadatok → 3 Tevékenységek → 4 Ellenőrzés → beküldés → Bejelentéseim, kérelmeim → Megtekintés → Letöltés → töltsd fel itt.',
  szunetel:
    'Ügyfélportál → Vállalkozói Ügysegéd → Képviseletválasztó „Más ügyében járok el” → az ügyfél → „Új bejelentés, kérelem benyújtása” → a szüneteltetés kártyája [ELLENŐRIZENDŐ: pontos név] → kezdőnap (nem múltbeli) → Ellenőrzés → beküldés → Megtekintés → Letöltés → töltsd fel itt.',
  folytatas:
    'Ügyfélportál → Vállalkozói Ügysegéd → Képviseletválasztó „Más ügyében járok el” → az ügyfél → „Új bejelentés, kérelem benyújtása” → a szüneteltetés befejezése [ELLENŐRIZENDŐ: pontos név] → az újrakezdés napja → Ellenőrzés → beküldés → Megtekintés → Letöltés → töltsd fel itt.',
  t101e:
    'onya.nav.gov.hu → a saját belépéseddel → a képviselt ügyfél kiválasztása → Új nyomtatvány → T101E „Egyéni vállalkozó bejelentése” → csak a változó blokk → Ellenőrzés → Beküldés → a visszaigazolás PDF-je → töltsd fel itt.',
  neverCredentials: 'Az ügyfél belépési adatait soha nem kérjük el, és nem lépünk be helyette. Mindig a saját belépéseddel, meghatalmazottként járj el.',
  changeReady: 'Adatok rendben – engedélyt kérek',
  evFiled: 'Beküldtem a változásbejelentést',
  changeDone: 'A NAV elfogadta – lezárom',
  documentTitle: 'Változásbejelentés – NAV-értesítés ({date})',
  filterChip: 'Változások',
} as const;
/** Panel follow-up checklist on change-done (enums CHANGE_FOLLOWUP_KEYS). */
export const CHANGE_FOLLOWUP_LABELS: Record<string, string> = {
  hq_municipality: 'Székhely települése frissítve',
  hipa_atnezes: 'Iparűzési adó (kulcs, település) átnézve',
  szamlazo_emlekezteto: 'Szóltunk: írja át a címét a számlázóprogramjában',
  tevekenyseg_frissites: 'Tevékenység és ÖVTJ-kód frissítve',
  koltseghanyad_megerosites: 'Költséghányad újra megerősítve',
  hipa_masik_telepules: 'A másik település iparűzési adója átnézve',
  szunetel_szakasz: 'Szünetelés felvéve az adóprofilba ({from} – {to})',
  szunetel_dij: 'Szüneteltetési díj indítva ({from})',
  folytatas_emlekezteto: 'Újrakezdési emlékeztető beállítva',
  adoprofil_statusz: 'Adóprofil (fő / mellék / nyugdíjas) frissítve ({date})',
  adozasi_mod: 'Adózási mód (átalány / kata) frissítve ({date})',
  szunetel_lezaras: 'Szünetelés lezárva az adóprofilban',
  szunetel_dij_lezaras: 'Szüneteltetési díj lezárva, újra havidíj',
};
/** In-app change form (SPEC §28.5.6; one field group per screen). */
export const CHANGE_FORM_TEXTS = {
  addressSzekhely: 'Hol lesz az új székhelyed?',
  addressTelephely: 'Hol van az új telephely?',
  zip: 'Irányítószám',
  city: 'Település',
  district: 'Kerület',
  streetName: 'Közterület neve',
  streetType: 'Közterület jellege',
  houseNumber: 'Házszám',
  building: 'Épület',
  staircase: 'Lépcsőház',
  floor: 'Emelet',
  door: 'Ajtó',
  dateTitle: 'Mikortól?',
  dateHintSzekhely: 'A költözés napja',
  dateHintTelephely: 'Ettől a naptól dolgozol ott',
  rightTitle: 'Milyen jogon használod?',
  providerName: 'A székhelyszolgáltató neve',
  providerAdoszam: 'A székhelyszolgáltató adószáma',
  alsoHome: 'Ez a lakcímem is',
  siteLabel: 'Mi van ott? (nem kötelező)',
  activityTitle: 'Mi változik?',
  activityUjFo: 'Más lesz a fő munkám',
  activityUjMellek: 'Egy újat kezdek a mostani mellett',
  activityTorles: 'Befejezek egyet',
  activityOwnWords: 'Írd le a saját szavaiddal',
  activityKeepOld: 'A régi fő munkámat is megtartom',
  szunetelFrom: 'Melyik naptól szünetelteted?',
  szunetelTo: 'Meddig? (nem kötelező)',
  folytatasFrom: 'Melyik naptól kezded újra?',
  adoadatTitle: 'Mi változik?',
  adoadatItems: {
    munkavegzes: 'Munkaviszonyt kezdek vagy befejezek',
    nyugdijba_vonulas: 'Nyugdíjas leszek',
    kozossegi_adoszam: 'Közösségi adószámot kérek',
    kata_belepes: 'Katás lennék',
    kata_kilepes: 'Kilépnék a katából',
    atalany_kilepes: 'Kilépnék az átalányadózásból',
    afa_kilepes: 'Kilépnék az ÁFA-mentességből',
    egyeb: 'Más',
  },
  workKindTitle: 'Mellette hogyan dolgozol?',
  note: 'Megjegyzés (nem kötelező)',
  summaryTitle: 'Ezt jelentjük be',
  validation: {
    zip: 'Négyjegyű irányítószám kell (például 1136).',
    city: 'Írd be a települést.',
    streetName: 'Írd be a közterület nevét.',
    streetType: 'Válaszd ki a közterület jellegét.',
    houseNumber: 'Írd be a házszámot vagy a helyrajzi számot.',
    szunetelPast: 'A szüneteltetés nem kezdődhet a múltban.',
    szunetelMax: 'Legfeljebb két évig tarthat.',
    activity: 'Válassz legalább egy tevékenységet, vagy írd le a saját szavaiddal.',
    items: 'Válaszd ki, mi változik.',
    folytatasPast: 'Az újrakezdés nem lehet a múltban.',
  },
} as const;
/** Notification variants of the change kinds (SPEC §28.5.5, §28.8). */
export const CHANGE_NOTIFICATION_TEXTS = {
  assist_consent_needed: { valtozas: { title: 'Nézd át, mit jelentünk be', body: 'Ha rendben van, engedélyezd. Kb. 1 perc.' } },
  assist_ev_filed: { valtozas: { title: 'Beküldtük a változásbejelentésedet', body: 'Amint a NAV elfogadta, szólunk.' } },
  assist_change_done: {
    title: 'Kész: {kindLabel}',
    body: 'A NAV elfogadta. Az értesítést a dossziédban találod.',
    bodySzekhelyExtra: ' Írd át a címedet a számlázóprogramodban is.',
  },
  assist_task: {
    valtozas_adatok: { title: 'Nézd át: {clientName} – {kindLabel}', body: 'Az ügyfél megadta az új adatokat.' },
    valtozas_bekuldes: { title: 'Beküldheted: {clientName} – {kindLabel}', body: 'Engedélyezte. Küldd be meghatalmazottként.' },
    valtozas_atnezes: { title: 'Nézd át: {clientName} változásbejelentése', body: '{firstName} beküldte. Nézd meg az értesítést, és zárd le.' },
  },
  digest: 'Változásbejelentés vár rád: {n}',
} as const;

// ---------- §28.5.3 change guide templates ----------
const UGYSEGED_BELEPES: GuideTemplateStep = {
  key: 'belepes',
  screenTitle: 'Belépés',
  text: 'Gépen nyisd meg a Vállalkozói Ügysegédet, és lépj be Ügyfélkapu+-szal vagy DÁP-pal.',
  fields: [{ label: 'Belépés', action: 'kattints', why: 'A saját belépéseddel. A jelszavadat senkinek ne add meg, nekünk se.' }],
  link: { label: 'Vállalkozói Ügysegéd megnyitása', url: UGYSEGED_URL },
};
const UGYSEGED_FOOLDAL: GuideTemplateStep = {
  key: 'ugyseged_fooldal',
  screenTitle: 'Bejelentéseim, kérelmeim',
  text: 'Ez az Ügysegéd kezdőlapja, itt látod a korábbi bejelentéseidet. Kattints a középső fülre.',
  fields: [{ label: 'Új bejelentés, kérelem benyújtása', action: 'kattints' }],
};
const VALTOZAS_INDITAS: GuideTemplateStep = {
  key: 'valtozas_inditas',
  screenTitle: 'Új bejelentés, kérelem benyújtása',
  text: 'Fent a mostani adataidat látod. Görgess le az „Egyéni vállalkozással kapcsolatos adatváltozás bejelentése” részhez.',
  fields: [{ label: 'Bejelentés kitöltése', action: 'kattints', why: 'Ezzel indul a változásbejelentés, 4 lépésből áll.' }],
};
const VALTOZAS_SZEMELYI: GuideTemplateStep = {
  key: 'valtozas_szemelyi',
  screenTitle: '1. Személyi adatok',
  text: 'Ezt a NAV kitölti a nyilvántartásból. Csak a születési országot kell kiválasztanod.',
  fields: [
    { label: 'Születési ország', action: 'valaszd', value: 'ahol születtél (például Magyarország)', why: 'Kötelező, nélküle nem enged tovább.' },
    { label: 'Tovább', action: 'kattints' },
  ],
  warning: 'Ha valamelyik adatod nem stimmel, itt nem tudod javítani. Kérj visszahívást, megmondjuk, hol kell.',
};
function valtozasCimadatok(text: string, button: string): GuideTemplateStep {
  return { key: 'valtozas_cimadatok', screenTitle: '2. Vállalkozói címadatok', text, fields: [{ label: button, action: 'kattints' }] };
}
const ADDRESS_FIELDS = (p: 'u' | 't', dateWhy: string): GuideTemplateField[] => [
  { label: 'Ország', action: 'valaszd', value: 'Magyarország' },
  { label: 'Irányítószám', action: 'valaszd', value: `{${p}Irsz}`, copy: true },
  { label: 'Település', action: 'valaszd', value: `{${p}Telepules}` },
  { label: 'Kerület', action: 'hagyd', value: 'Budapesten magától kitöltődik' },
  { label: 'Közterület neve', action: 'ird_be', value: `{${p}KozterNev}`, copy: true },
  { label: 'Közterület jellege', action: 'valaszd', value: `{${p}KozterJelleg}` },
  { label: 'Házszám/Helyrajzi szám', action: 'ird_be', value: `{${p}Hazszam}`, copy: true },
  { label: 'Épület, Lépcsőház, Szint, Ajtó', action: 'ird_be', value: `{${p}Tobbi}`, why: 'Csak ha van.' },
  { label: 'Változás napja', action: 'ird_be', value: '{valtozasNapja}', why: dateWhy },
];
function valtozasTevekenysegek(kind: 'valtozas_tevekenyseg' | 'mas'): GuideTemplateStep {
  return kind === 'valtozas_tevekenyseg'
    ? {
        key: 'valtozas_tevekenysegek',
        screenTitle: '3. Tevékenységek',
        text: 'Ha a fő munkád változik: „Új főtevékenység”. Ha csak egy újat kezdesz a mostani mellett: lent „Új tevékenység hozzáadása”.',
        fields: [
          { label: 'Új főtevékenység', action: 'kattints', when: 'tevekenyseg_uj_fo' },
          { label: 'Új tevékenység hozzáadása', action: 'kattints', when: 'tevekenyseg_uj_mellek' },
          { label: 'A befejezett tevékenység sora', action: 'kattints', when: 'tevekenyseg_torles', why: 'A sor végén töröld, vagy add meg a befejezés napját. Ha nem találod, kérj visszahívást.' },
        ],
        warning: 'Csak olyan tevékenységet jelents be, aminek a feltételeit teljesíted.',
      }
    : {
        key: 'valtozas_tevekenysegek',
        screenTitle: '3. Tevékenységek',
        text: 'A tevékenységeiden nem változtatsz. Kattints a „Tovább” gombra.',
        fields: [{ label: 'Tovább', action: 'kattints' }],
      };
}
const VALTOZAS_ELLENORZES: GuideTemplateStep = {
  key: 'valtozas_ellenorzes',
  screenTitle: '4. Ellenőrzés',
  text: 'Nézd át, hogy minden úgy szerepel-e, ahogy szeretnéd. Ha igen, küldd be. A beküldött bejelentést nem lehet visszavonni.',
  fields: [
    { label: 'Az új adatok', action: 'ellenorizd' },
    { label: 'A beküldés gombja a lap alján', action: 'kattints' },
  ],
};
const VALTOZAS_MEGTEKINTES: GuideTemplateStep = {
  key: 'valtozas_megtekintes',
  screenTitle: 'Bejelentéseim, kérelmeim',
  text: 'A beküldött bejelentésed itt jelenik meg. Nyisd meg, és töltsd le az értesítést.',
  fields: [
    { label: 'Megtekintés', action: 'kattints' },
    { label: 'Letöltés', action: 'kattints' },
  ],
};
const APP_FELTOLTES: GuideTemplateStep = {
  key: 'app_feltoltes',
  screenTitle: 'Töltsd fel nálunk',
  text: 'Az értesítést töltsd fel ide, hogy {firstName} lássa, és nálunk is átvezesse.',
  fields: [{ label: 'Feltöltöm az értesítést', action: 'kattints' }],
  ownApp: true,
  screenKind: 'app',
};
/** validUntil of the Ügysegéd change guides; the backend overrides it with env CHANGE_UGYSEGED_VALID_UNTIL. */
const UGYSEGED_GUIDE_VALID_UNTIL = '2026-12-31';
const CHANGE_GUIDE_OUTRO = 'Kész. Ha a NAV elfogadta, töltsd fel az értesítést, és {firstName} nálunk is átvezeti.';
/** SPEC §28.5.3 version of the change guides. */
export const CHANGE_GUIDE_VERSION = '2026-11-19.ot';
export const CHANGE_GUIDE_TEMPLATES: Record<_ChangeKind, GuideTemplate> = {
  valtozas_szekhely: {
    title: 'Így jelented be a költözést',
    intro: 'A Vállalkozói Ügysegédben 4 lépés: Személyi adatok, Vállalkozói címadatok, Tevékenységek, Ellenőrzés. Kb. 10 perc, gépen a legkényelmesebb.',
    validUntil: UGYSEGED_GUIDE_VALID_UNTIL,
    steps: [
      UGYSEGED_BELEPES,
      UGYSEGED_FOOLDAL,
      VALTOZAS_INDITAS,
      VALTOZAS_SZEMELYI,
      valtozasCimadatok('Itt látod az aktuális székhelyedet. Kattints az „Új székhely” gombra.', 'Új székhely'),
      {
        key: 'valtozas_uj_szekhely',
        screenTitle: 'Az új székhely címe',
        text: 'Írd be az új címet mezőnként. A dátum a költözés napja.',
        fields: ADDRESS_FIELDS('u', 'Ettől a naptól érvényes az új cím.'),
        warning: 'Az új székhely címe nyilvános lesz.',
      },
      {
        key: 'valtozas_szekhely_mentes',
        screenTitle: 'Mentés',
        text: 'Ha minden mezőt kitöltöttél, mentsd el az új címet, utána lépj tovább.',
        fields: [
          { label: 'Új székhely adatainak mentése', action: 'kattints' },
          { label: 'Tovább', action: 'kattints' },
        ],
      },
      valtozasTevekenysegek('mas'),
      VALTOZAS_ELLENORZES,
      VALTOZAS_MEGTEKINTES,
      APP_FELTOLTES,
    ],
    outro: CHANGE_GUIDE_OUTRO,
  },
  valtozas_tevekenyseg: {
    title: 'Így jelentesz be új tevékenységet',
    intro: 'A Vállalkozói Ügysegédben 4 lépés: Személyi adatok, Vállalkozói címadatok, Tevékenységek, Ellenőrzés. Kb. 10 perc.',
    validUntil: UGYSEGED_GUIDE_VALID_UNTIL,
    steps: [
      UGYSEGED_BELEPES,
      UGYSEGED_FOOLDAL,
      VALTOZAS_INDITAS,
      VALTOZAS_SZEMELYI,
      valtozasCimadatok('A címeiden nem változtatsz. Kattints a „Tovább” gombra.', 'Tovább'),
      valtozasTevekenysegek('valtozas_tevekenyseg'),
      {
        key: 'valtozas_ovtj_kereso',
        screenTitle: 'A tevékenység keresése',
        text: 'Írj be egy szót vagy a kódot, és válaszd ki a sort a listából. Alá azt a napot írd, amikortól végzed.',
        fields: [
          { label: 'Kereső', action: 'ird_be', value: '{aKereso}', copy: true },
          { label: 'A találat', action: 'valaszd', value: '{aSor}' },
          { label: 'Adatváltozás ideje', action: 'ird_be', value: '{valtozasNapja}' },
        ],
        holdWhenActivityPending: true,
      },
      VALTOZAS_ELLENORZES,
      VALTOZAS_MEGTEKINTES,
      APP_FELTOLTES,
    ],
    outro: CHANGE_GUIDE_OUTRO,
  },
  valtozas_telephely: {
    title: 'Így jelentesz be telephelyet',
    intro: 'A Vállalkozói Ügysegédben 4 lépés: Személyi adatok, Vállalkozói címadatok, Tevékenységek, Ellenőrzés. Kb. 10 perc.',
    validUntil: UGYSEGED_GUIDE_VALID_UNTIL,
    steps: [
      UGYSEGED_BELEPES,
      UGYSEGED_FOOLDAL,
      VALTOZAS_INDITAS,
      VALTOZAS_SZEMELYI,
      valtozasCimadatok('Lent, a „Telephely(ek)” résznél kattints az „Új telephely hozzáadása” gombra.', 'Új telephely hozzáadása'),
      {
        key: 'valtozas_uj_telephely',
        screenTitle: 'Az új telephely címe',
        text: 'Ugyanúgy, mint a székhelynél: mezőnként írd be a címet és a napot, amikortól ott dolgozol.',
        fields: [...ADDRESS_FIELDS('t', 'Ettől a naptól dolgozol ott.'), { label: 'A mentés gombja az űrlap alján', action: 'kattints' }],
      },
      valtozasTevekenysegek('mas'),
      VALTOZAS_ELLENORZES,
      VALTOZAS_MEGTEKINTES,
      APP_FELTOLTES,
    ],
    outro: CHANGE_GUIDE_OUTRO,
  },
  valtozas_szuneteltetes: {
    title: 'Így szünetelteted a vállalkozásodat',
    intro: 'A Vállalkozói Ügysegédben, kb. 10 perc. A kezdőnapot utólag nem lehet módosítani, ezért előbb beszéld meg {firstNameWith}. A szüneteltetés NAV-os lapjairól még nincs képünk, és a gombok pontos feliratát is ellenőrizzük: ha bizonytalan vagy, intézzük helyetted.',
    validUntil: UGYSEGED_GUIDE_VALID_UNTIL,
    steps: [
      UGYSEGED_BELEPES,
      UGYSEGED_FOOLDAL,
      {
        key: 'szunetel_inditas',
        screenTitle: 'Új bejelentés, kérelem benyújtása',
        text: 'Görgess le a szüneteltetésről szóló részhez, és indítsd el a bejelentést.',
        fields: [{ label: 'A szüneteltetés kártyájának gombja', action: 'kattints' }],
      },
      {
        key: 'szunetel_datum',
        screenTitle: 'A szünetelés kezdete',
        text: 'Add meg, melyik naptól szünetelteted a vállalkozásodat.',
        fields: [{ label: 'A szüneteltetés kezdő napja', action: 'ird_be', value: '{szunetelKezdet}' }],
        warning: 'A bejelentett napot utólag nem lehet módosítani, és visszamenőleg sem adhatod meg.',
      },
      {
        key: 'szunetel_ellenorzes',
        screenTitle: 'Ellenőrzés és beküldés',
        text: 'Nézd át, és küldd be. A beküldött bejelentést nem lehet visszavonni.',
        fields: [{ label: 'A beküldés gombja', action: 'kattints' }],
      },
      VALTOZAS_MEGTEKINTES,
      APP_FELTOLTES,
    ],
    outro: CHANGE_GUIDE_OUTRO,
  },
  valtozas_adoadat: {
    title: 'Így jelented be az adózási adatod változását',
    intro: 'Ezt az ONYA-ban, a T101E nyomtatványon kell bejelenteni, nem a Vállalkozói Ügysegédben. Általában {firstName} intézi; ha magad csinálod, kb. 15 perc.',
    validUntil: '2027-12-31',
    steps: [
      {
        key: 'onya_belepes',
        screenTitle: 'ONYA – belépés',
        text: 'Nyisd meg az ONYA-t (onya.nav.gov.hu), és lépj be Ügyfélkapu+-szal vagy DÁP-pal.',
        fields: [{ label: 'Belépés', action: 'kattints' }],
        link: { label: 'Megnyitom az ONYA-t', url: ONYA_URL },
      },
      { key: 'onya_profil', screenTitle: 'Profilválasztás', text: 'Válaszd a saját, magánszemély profilodat.', fields: [{ label: 'A saját profilod', action: 'valaszd' }] },
      {
        key: 't101e_kereses',
        screenTitle: 'Új nyomtatvány',
        text: 'Az „Új nyomtatvány” résznél írd a keresőbe: T101E. Válaszd: „Egyéni vállalkozó bejelentése”.',
        fields: [
          { label: 'Kereső', action: 'ird_be', value: 'T101E', copy: true },
          { label: 'Egyéni vállalkozó bejelentése', action: 'valaszd' },
        ],
      },
      {
        key: 't101e_blokk',
        screenTitle: 'Csak a változó rész',
        text: 'Csak azt a részt töltsd ki, ami változik (például a munkavégzés jellegét). A többit hagyd üresen.',
        fields: [
          { label: 'A változó rész', action: 'ird_be' },
          { label: 'Minden más rész', action: 'hagyd' },
        ],
        warning: 'Ha bizonytalan vagy, ne küldd be: kérd, hogy {firstName} intézze.',
      },
      {
        key: 't101e_bekuldes',
        screenTitle: 'Ellenőrzés és beküldés',
        text: 'Ellenőrizd, küldd be, és töltsd le a visszaigazolást.',
        fields: [
          { label: 'Ellenőrzés', action: 'kattints' },
          { label: 'Beküldés', action: 'kattints' },
        ],
      },
      APP_FELTOLTES,
    ],
    outro: CHANGE_GUIDE_OUTRO,
  },
  valtozas_folytatas: {
    title: 'Így kezded újra a vállalkozásodat',
    intro: 'A Vállalkozói Ügysegédben, kb. 10 perc. Az újrakezdés NAV-os lapjairól még nincs képünk, és a gombok pontos feliratát is ellenőrizzük: ha bizonytalan vagy, intézzük helyetted.',
    validUntil: UGYSEGED_GUIDE_VALID_UNTIL,
    steps: [
      UGYSEGED_BELEPES,
      UGYSEGED_FOOLDAL,
      {
        key: 'folytatas_inditas',
        screenTitle: 'Új bejelentés, kérelem benyújtása',
        text: 'Görgess le a szüneteltetés befejezéséről szóló részhez, és indítsd el a bejelentést.',
        fields: [{ label: 'A szüneteltetés befejezésének gombja', action: 'kattints' }],
      },
      {
        key: 'folytatas_datum',
        screenTitle: 'Az újrakezdés napja',
        text: 'Add meg, melyik naptól dolgozol újra.',
        fields: [{ label: 'Az újrakezdés napja', action: 'ird_be', value: '{folytatasNapja}' }],
        warning: 'Számlát csak ettől a naptól állíthatsz ki.',
      },
      {
        key: 'folytatas_ellenorzes',
        screenTitle: 'Ellenőrzés és beküldés',
        text: 'Nézd át, és küldd be. A beküldött bejelentést nem lehet visszavonni.',
        fields: [{ label: 'A beküldés gombja', action: 'kattints' }],
      },
      VALTOZAS_MEGTEKINTES,
      APP_FELTOLTES,
    ],
    outro: CHANGE_GUIDE_OUTRO,
  },
};
/** Every guide template by GuideKind (the three §26/§27 guides + the six change guides). */
export const ALL_GUIDE_TEMPLATES: Record<'vallalkozas_bejelentes' | 'meghatalmazas' | 'meghatalmazas_jovahagyas' | _ChangeKind, GuideTemplate> = {
  ...GUIDE_TEMPLATES,
  ...CHANGE_GUIDE_TEMPLATES,
};

/** Hungarian long date: "2026. december 1." (pure; no Intl dependency so the offline fallback matches the server). */
export function huLongDate(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '';
  return `${m[1]}. ${ALLOWANCE_TEXTS.monthNames[Number(m[2]) - 1] ?? ''} ${Number(m[3])}.`;
}

/** Structural copy of api ChangeData (no imports here); only the fields the guides use. */
export interface ChangeGuideData {
  kind: _ChangeKind;
  address?: {
    zip: string;
    city: string;
    district?: string | null;
    streetName: string;
    streetType: string;
    houseNumber: string;
    building?: string | null;
    staircase?: string | null;
    floor?: string | null;
    door?: string | null;
  };
  effectiveOn?: string;
  mode?: 'uj_fo' | 'uj_mellek' | 'torles';
  activities?: GuideActivityInput[];
  ownWords?: string | null;
  from?: string;
  to?: string | null;
}
export interface ChangeGuidePersonaliseInput {
  /** From the client's latest open change assist of this kind; null = generic texts. */
  change: ChangeGuideData | null;
  firstName: string;
  /** The stored instrumental form (accountants.name_with, "Bencével"); built from firstName when missing. */
  firstNameWith?: string;
  /** Done step keys. */
  progress: string[];
  /** env CHANGE_UGYSEGED_VALID_UNTIL for the Ügysegéd kinds. */
  ugysegedValidUntil?: string;
}
/** Personalises a change guide exactly like personaliseGuide does for the new-business guide (SPEC §28.5.3). */
export function personaliseChangeGuide(
  kind: _ChangeKind,
  inp: ChangeGuidePersonaliseInput,
): { title: string; intro: string; outro: string; validUntil: string; steps: PersonalisedGuideStep[]; activityPending: boolean; version: string } {
  const t = CHANGE_GUIDE_TEMPLATES[kind];
  const c = inp.change && inp.change.kind === kind ? inp.change : null;
  const a = c?.address;
  const tobbi = a ? [a.building, a.staircase, a.floor, a.door].filter((x) => x && String(x).trim()).join(', ') : '';
  const act = c?.activities?.find((x) => (c.mode === 'uj_fo' ? x.main : !x.main)) ?? c?.activities?.[0];
  const pending = kind === 'valtozas_tevekenyseg' && Boolean(c) && (Boolean(c?.ownWords?.trim()) || (c?.activities ?? []).some((x) => !resolvedActivity(x).ovtjKod));
  const addr = (p: 'u' | 't'): Record<string, string> => ({
    [`${p}Irsz`]: a?.zip ?? 'az új címed irányítószáma',
    [`${p}Telepules`]: a?.city ?? 'az új címed települése',
    [`${p}KozterNev`]: a?.streetName ?? 'a közterület neve (például Petőfi)',
    [`${p}KozterJelleg`]: a?.streetType ?? 'utca, út, tér…',
    [`${p}Hazszam`]: a?.houseNumber ?? 'a házszám',
    [`${p}Tobbi`]: tobbi || 'csak ha van',
  });
  const values: Record<string, string> = {
    ...addr('u'),
    ...addr('t'),
    valtozasNapja: huLongDate(c?.effectiveOn) || 'a változás napja',
    aKereso: act ? activityCopyValue(act) || act.label : 'egy szó a munkádról, vagy az ÖVTJ-kód',
    aSor: act ? activityGuideLine(act) : 'a megfelelő sor a listából',
    szunetelKezdet: huLongDate(c?.from) || 'a szünetelés első napja',
    szunetelVege: huLongDate(c?.to ?? null) || '',
    folytatasNapja: huLongDate(c?.from) || 'az újrakezdés napja',
    firstName: inp.firstName,
    firstNameWith: inp.firstNameWith ?? hunWith(inp.firstName),
  };
  const cond = new Set<GuideCondition>();
  if (c?.mode === 'uj_fo') cond.add('tevekenyseg_uj_fo');
  if (c?.mode === 'uj_mellek') cond.add('tevekenyseg_uj_mellek');
  if (c?.mode === 'torles') cond.add('tevekenyseg_torles');
  if (!c) {
    cond.add('tevekenyseg_uj_fo');
    cond.add('tevekenyseg_uj_mellek');
  }
  const fill = (s: string) => fillPlaceholders(s, values);
  const steps: PersonalisedGuideStep[] = [];
  for (const st of t.steps) {
    if (st.when && !cond.has(st.when)) continue;
    const fields: PersonalisedGuideField[] = [];
    for (const f of st.fields) {
      if (f.when && !cond.has(f.when)) continue;
      const value = f.value !== undefined ? fill(f.value) : undefined;
      const copy = f.copy && c ? (f.copyFrom ? fill(`{${f.copyFrom}}`) : (value ?? '')) : '';
      fields.push({ label: fill(f.label), action: f.action, ...(value ? { value } : {}), ...(f.why ? { why: fill(f.why) } : {}), ...(copy ? { copyValue: copy } : {}) });
    }
    const hold = pending && st.holdWhenActivityPending ? ACTIVITY_PENDING_HOLD.tevekenysegek : undefined;
    steps.push({
      key: st.key,
      n: steps.length + 1,
      screenTitle: fill(st.screenTitle),
      text: fill(st.text),
      fields,
      ...(st.warning ? { warning: fill(st.warning) } : {}),
      ...(hold ? { hold } : {}),
      ...(st.link ? { link: st.link } : {}),
      ownApp: Boolean(st.ownApp),
      screenKind: st.screenKind ?? (st.ownApp ? 'app' : 'nav'),
      imageKey: guideImageKey(st, cond),
      done: inp.progress.includes(st.key),
    });
  }
  const validUntil = kind === 'valtozas_adoadat' ? t.validUntil : (inp.ugysegedValidUntil ?? t.validUntil);
  return { title: fill(t.title), intro: fill(t.intro), outro: fill(t.outro), validUntil, steps, activityPending: pending, version: CHANGE_GUIDE_VERSION };
}

// ---------- §28 + §28.K explainers ("Mi ez?" sheets; same shape as ONBOARDING_EXPLAINERS) ----------
export const EXPLAINERS_28: readonly ExplainerDefault[] = [
  {
    key: 'felretesz_miert',
    title: 'Mennyit tegyél félre?',
    what: 'Minden kiállított számládnál megmutatjuk, kb. mennyivel nő miatta az idei adód. A Főoldalon azt is látod, most mennyi legyen félretéve.',
    why: 'Hogy a negyedéves befizetéskor meglegyen a pénz. Az első 1 936 800 Ft jövedelmed adómentes, főállásban pedig havonta egy minimum járulékot mindenképp fizetsz, ezért nem mindig ugyanannyi.',
    where: 'A számláidnál és a Főoldalon, a „Félretenni” résznél. Ez becslés: a befizetendő összeget negyedévente {firstName} hagyja jóvá.',
    icon: 'szamolo',
    fields: [],
  },
  {
    key: 'kereset_miert',
    title: 'Hogyan számoljuk?',
    what: 'A bevételed a pénz megérkezésének hónapjában számít. Az adót és a járulékot ahhoz a hónaphoz írjuk, amelyikben a bevétel keletkezett; főállásban a havi fix járulék minden hónapra jut. Az iparűzési adót napok szerint osztjuk el az évre.',
    why: 'Hogy lásd, mennyi marad neked. A költségeidet nem látjuk, ezeket ebből fizeted.',
    where: 'Ahol {firstName} már jóváhagyta vagy befizetted, azt az összeget használjuk, máshol becslést.',
    icon: 'szamolo',
    fields: [],
  },
  {
    key: 'kedvezmenyek',
    title: 'Adókedvezmények',
    what: 'Kedvezmény járhat gyerekek után, 25 év alatt, édesanyáknak, friss házasoknak vagy súlyos betegség miatt. Ha jár, kevesebb adót fizetsz.',
    why: 'Pár igen–nem kérdésből {firstName} megnézi, mi jár neked. Amit jóváhagy, azt beszámoljuk az adódba. Neveket, TAJ-számot nem kérünk.',
    where: 'A Fiókban, az „Adókedvezményeid” sorban, kb. 3 perc. Ha változik valami, bármikor módosíthatod.',
    icon: 'igazolas',
    fields: [],
  },
  {
    key: 'csaladi_jarulekkedvezmeny',
    title: 'Családi járulékkedvezmény',
    what: 'Ha a családi kedvezményed nem fogy el az SZJA-dból, a maradék 15%-ával a TB-járulékod is csökkenhet.',
    why: 'Így év közben is kevesebbet fizetsz, nem csak az éves bevallásban kapod vissza.',
    where: '{firstName} dönti el, hogy év közben vagy az éves bevallásban számoljuk el.',
    icon: 'szamolo',
    fields: [],
  },
  {
    key: 'valtozas_hub',
    title: 'Változás a vállalkozásodban',
    what: 'Ha költözöl, új munkába kezdesz, telephelyet nyitsz vagy szünetet tartasz, azt be kell jelenteni a NAV-nál.',
    why: 'Csak így lesznek rendben a számláid, az adód és a nyilvántartás.',
    where: 'Lépésről lépésre megmutatjuk (ingyenes), vagy {firstName} meghatalmazottként bejelenti helyetted (díjas, előre fizetve).',
    icon: 'irat',
    fields: [],
  },
  {
    key: 'ugyseged_valtozas',
    title: 'Vállalkozói Ügysegéd – változásbejelentés',
    what: 'A NAV oldala, ahol az egyéni vállalkozás adatait (székhely, telephely, tevékenység, szünetelés) bejelented.',
    why: 'A változásbejelentés 4 lépés: Személyi adatok, Vállalkozói címadatok, Tevékenységek, Ellenőrzés.',
    where: 'Az Ügyfélportálon, Ügyfélkapu+-szal vagy DÁP-pal: https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main',
    icon: 'irat',
    fields: [],
  },
  {
    key: 'onya_t101e',
    title: 'ONYA – T101E',
    what: 'Az adózási adataidat (munkavégzés jellege, kata, átalányadózás, ÁFA, közösségi adószám) nem az Ügysegédben, hanem az ONYA-ban, a T101E nyomtatványon jelented be.',
    why: 'Ez a NAV szabálya. Általában {firstName} intézi meghatalmazottként.',
    where: 'onya.nav.gov.hu → Új nyomtatvány → T101E „Egyéni vállalkozó bejelentése”.',
    icon: 'bevallas',
    fields: [],
  },
  {
    key: 'heti_36_ora',
    title: 'Heti 36 óra',
    what: 'Ha a munkahelyeden heti legalább 36 órában dolgozol, a vállalkozásod mellékállású. Ha kevesebben, főállású marad.',
    why: 'Mellékállásban nem kell a havi minimum járulékot fizetned, csak a valódi jövedelmed után. Katásként egy teljes hónapnyi 36 órás munkaviszony megszünteti a katát.',
    where: 'A munkaszerződésedben vagy a bérpapírodon látod, heti hány órában dolgozol.',
    icon: 'ora',
    fields: ['weeklyHours'],
  },
  {
    key: 'alkalmazott_efo',
    title: 'Alkalmazott és EFO',
    what: 'Alkalmazott az, akinek munkabért fizetsz. EFO: alkalmi munka vagy idénymunka, napi bejelentéssel. Mindkettőhöz bérszámfejtés és havi bevallás kell.',
    why: 'Bérszámfejtést most nem vállalunk, ezért {firstName} megnézi, mit tudunk ajánlani.',
    where: 'Ha bizonytalan vagy, kérj visszahívást.',
    icon: 'fiok',
    fields: ['employer'],
  },
  {
    key: 'kata',
    title: 'Kata',
    what: 'Havi 50 000 Ft tételes adó, ami lefedi az SZJA-t, a TB-járulékot és a szochót. Csak főállású egyéni vállalkozó választhatja.',
    why: 'Csak akkor jó, ha kizárólag magánszemélyeknek számlázol: ha egy cég vagy egyéni vállalkozó fizet neked, a katád a fizetés előtti nappal megszűnik.',
    where: 'Ha nem tudod, hogyan adózol, {firstName} megnézi a NAV-nál, amint él a meghatalmazás.',
    icon: 'bevallas',
    fields: ['taxRegime'],
  },
  {
    key: 'kata_keret',
    title: 'A kata kerete',
    what: 'Katásként évente 18 millió Ft bevételig fizetsz csak havi 50 000 Ft-ot. Ha nem egész évben vagy katás, a keret havonta 1,5 millió Ft.',
    why: 'A keret fölötti bevétel 40%-át különadóként kell befizetni, ezért figyeljük, mennyit használtál el.',
    where: 'A Főoldalon látod, a kereted hány százalékát használtad idén.',
    icon: 'szamolo',
    fields: [],
  },
  {
    key: 'eves_zaras',
    title: 'Éves zárás',
    what: 'Az év végén {firstName} elkészíti az éves SZJA-bevallásodat (katánál a kata-nyilatkozatot) és az iparűzési adó bevallását.',
    why: 'Ez a havidíjon felül külön díjas: a díjat a kérdőív beküldésekor fizeted, és előre látod, mennyi.',
    where: 'Januártól a Főoldalon és az „Éves zárás” oldalon. Kb. 5 perces kérdőívvel indul.',
    icon: 'bevallas',
    fields: [],
  },
  {
    key: 'zarolas',
    title: 'Miért szünetel a könyvelésed?',
    what: 'Amíg nincs kifizetve a díj, nem hagyunk jóvá adót, nem írunk levelet és nem adunk be semmit helyetted.',
    why: 'Amit eddig csináltunk, megmarad, és bármikor letöltheted az adataidat. A NAV-os határidők ettől nem állnak meg: ha sürgős, fizess most, vagy írj nekünk.',
    where: 'Fizetni a Fiókban, a „Díjak és számlák” résznél tudsz. A fizetés után azonnal újra minden működik.',
    icon: 'lakat',
    fields: [],
  },
  {
    key: 'tovabbito_email',
    title: 'Továbbító e-mail-cím',
    what: 'Egy saját e-mail-cím, ahová a nyugtáidat és a bankszámlakivonataidat továbbíthatod. A csatolmányok a dossziéd megfelelő hónapjába kerülnek.',
    why: 'Így nem kell mindent lefotóznod: ami e-mailben jön, egy továbbítással nálunk van.',
    where: 'A Fiókban, a „Továbbító e-mail-cím” sorban. Csak a saját címeidről fogadjuk a leveleket.',
    icon: 'boritek',
    fields: [],
  },
  {
    key: 'rendelkezesre_allasi_dij',
    title: 'Szüneteltetési díj',
    what: 'Amíg szünetel a vállalkozásod, a havidíj helyett csak ezt a kisebb díjat fizeted.',
    why: 'Ezért megőrizzük az irataidat, figyeljük a határidőidet, és segítünk újraindulni.',
    where: 'A Fiókban, a „Díjak és számlák” résznél látod. Amikor újrakezded, újra a havidíj jár.',
    icon: 'tepnaptar',
    fields: [],
  },
];

// =====================================================================================================================
// SPEC §28.K – owner orders 11-19 afternoon–evening. Default client texts (content keys in SPEC §28.K.19; defaults
// generated by backend/src/content/k28.ts). Placeholders as §27/§28 plus {dij} ("4 999"), {mit}, {honap}, {ev},
// {keret}, {pct}, {hatarido}. Prices are never written into a text: {dij} / {havidij} come from fee_settings.
// =====================================================================================================================

type _FeeKind =
  | 'havidij'
  | 'havidij_kata'
  | 'eves_zaras'
  | 'valtozas_egyszeru'
  | 'valtozas_jogallas'
  | 'szuneteltetesi_dij'
  | 'igazolas_jovedelem'
  | 'igazolas_ado'
  | 'igazolas_koma'
  | 'igazolas_ev_kivonat'
  | 'igazolas_egyeb'
  | 'megszuntetes';
type _CheckinItem = 'munkaviszony' | 'nyugdij' | 'koltozes' | 'tevekenyseg' | 'csalad' | 'alkalmazott' | 'szuneteltetes' | 'folytatas' | 'kata_ceges' | 'egyeb';
type _AnnualStatus = 'nem_indult' | 'kerdoiv' | 'dijra_var' | 'konyvelonel' | 'jovahagyasra_var' | 'beadva' | 'kesz';
type _EmployerAnswer = 'nincs' | 'alkalmazott' | 'efo' | 'mindketto' | 'hamarosan';
type _EmployerDecision = 'nincs_teendo' | 'berszamfejtes_mashol' | 'egyedi_ajanlat' | 'egyedi_elfogadva' | 'nem_vallaljuk';

// ---------- §28.K.1 fees (content dij.*) ----------
export const FEE_KIND_LABELS: Record<_FeeKind, string> = {
  havidij: 'Havidíj',
  havidij_kata: 'Havidíj (kata)',
  eves_zaras: 'Éves zárás',
  valtozas_egyszeru: 'Változás bejelentése helyetted',
  valtozas_jogallas: 'Jogállás-változás bejelentése helyetted',
  szuneteltetesi_dij: 'Szüneteltetési díj',
  // SPEC §29.5 / §29.7
  igazolas_jovedelem: 'Jövedelemigazolás intézése',
  igazolas_ado: 'Adóigazolás intézése',
  igazolas_koma: 'KOMA-ügyintézés',
  igazolas_ev_kivonat: 'EV-nyilvántartási kivonat intézése',
  igazolas_egyeb: 'Más igazolás intézése',
  megszuntetes: 'A vállalkozás megszüntetése helyetted',
};
export const FEE_UNIT_LABELS: Record<'ho' | 'ev' | 'alkalom', string> = { ho: '/ hó', ev: '/ év', alkalom: '/ alkalom' };
export const FEE_CHARGE_STATUS_LABELS: Record<'nyitott' | 'fizetve' | 'visszavonva' | 'visszaterites_kell' | 'visszaterites_megtortent' | 'elengedve', string> = {
  nyitott: 'Fizetésre vár',
  fizetve: 'Kifizetve',
  visszavonva: 'Visszavonva',
  visszaterites_kell: 'Visszatérítés folyamatban',
  visszaterites_megtortent: 'Visszatérítve',
  elengedve: 'Elengedve',
};
export const FEE_TEXTS = {
  screenTitle: 'Díjak és számlák',
  fiokRow: 'Díjak és számlák',
  inPlanTitle: 'Mi van a havidíjban?',
  inPlan:
    'Minden, amit az app tud: könyvelés, negyedéves adó, kiállított számláid letöltése, határidők, üzenetek. Külön díjas csak az éves zárás és az, ha a változást mi jelentjük be helyetted.',
  pauseLine: 'Ha szünetel a vállalkozásod, a havidíj helyett csak a kisebb szüneteltetési díjat fizeted.',
  selfFree: 'Ha a változást magad jelented be az útmutatónkkal, az ingyenes.',
  feeLine: '{label}: {dij} Ft {unit}',
  openTitle: 'Fizetésre vár',
  paidTitle: 'Kifizetve',
  invoicesTitle: 'Díjszámlák',
  payButton: 'Fizetek',
  payButtonAmount: 'Fizetek ({dij} Ft)',
  demoChip: 'DEMO',
  demoEmail: '(DEMO ár)',
  demoInvoice: 'DEMO DÍJBEKÉRŐ – NEM SZÁMLA',
  notPayable: 'Ezt most nem tudjuk elindítani: a díj még nincs véglegesítve. Kérj visszahívást.',
  payFailed: 'Nem sikerült a fizetés. Próbáld újra, vagy válassz másik kártyát.',
  paidToastChange: 'Kifizetted. {firstName} nekilát, és szól, ha jóvá kell hagynod valamit.',
  paidToastAnnual: 'Köszönjük! {firstName} nekilát. Szól, ha kérdése van, vagy ha jóvá kell hagynod a bevallást.',
  /** The "Hogyan intézzük?" choice of every NAV-filed change (§28.K.2, the §27.3.1 highlighted-card pattern). */
  choiceTitle: 'Hogyan intézzük?',
  choiceAssisted: {
    title: 'Bejelentjük helyetted',
    body: 'Megadod az adatokat, {firstName} meghatalmazottként beküldi. Díja: {dij} Ft, előre fizetve.',
    button: 'Ezt kérem (+ fizetés)',
  },
  choiceSelf: 'Magam jelentem be (ingyenes)',
  choiceTalk: 'Előbb beszéljük meg',
  adminLine: 'Mi változik nálad: {admin}',
  invoiceLinePause: 'Szüneteltetési díj ({honap})',
  /** /admin/dijak (staff wording). */
  admin: {
    title: 'Díjak',
    confirmed: 'Megerősítve · {date} · {admin}',
    unconfirmed: 'DEMO – még nincs megerősítve',
    edit: 'Módosítom',
    confirm: 'Megerősítem',
    effectiveFrom: 'Érvényes ettől',
    effectiveFromHint: 'Emelésnél legalább 30 nap múlva (ÁSZF-módosítás).',
    cardLimit: '{n} futó előfizetéshez új kártyaregisztráció kellene.',
    history: 'Előzmények',
    waive: 'Elengedem',
    waiveReason: 'Indok (kötelező)',
    refunded: 'Visszatérítettem',
    refundTask: 'Visszatérítés kell: {clientName} – {label}, {dij} Ft',
  },
} as const;

// ---------- §28.K.2 A – monthly check-in (content havi.*) ----------
export const CHECKIN_TEXTS = {
  title: 'Változott valami {honap} óta?',
  sub: 'Pár igen–nem kérdés, kb. 1 perc. Ha semmi nem változott, egy koppintás.',
  yes: 'Igen',
  noneButton: 'Nem változott semmi',
  nextButton: 'Tovább',
  noneToast: 'Köszönjük! Jövő hónapban újra rákérdezünk.',
  progress: '{i}/{n}',
  homeCard: { title: 'Változott valami?', body: 'Havonta egyszer rákérdezünk. Kb. 1 perc.', button: 'Megnézem' },
  egyebPlaceholder: 'Írd le pár szóban (nem kötelező)',
  /** Prefix of the message the 'egyeb' answer sends to the accountant. */
  egyebMessagePrefix: 'Havi ellenőrzés:',
  doneSent: 'Köszönjük! {firstName} megkapta, és szól, ha teendő van.',
  expired: 'Ezt a hónapot már lezártuk. Ha mégis változott valami, írj nekünk az Üzenetekben.',
  /** k6c: under the "Köszönjük!" title the sentence does not thank again. */
  noneBody: 'Jövő hónapban újra rákérdezünk.',
  doneBody: '{firstName} megkapta, és szól, ha teendő van.',
  /** k6c2: an assisted change whose fee is still unpaid – the team starts after the payment. */
  doneBodyFee: 'Fizesd ki a díjat, és {firstName} nekilát.',
  /** k6c: an item whose fee is paid (the assist is with the accountant). */
  itemPaid: 'Kifizetted a díjat. {firstName} nekilát.',
} as const;
/** One row per item; `questionAlt` = the mellékállású variant of 'munkaviszony'. */
export const CHECKIN_ITEM_TEXTS: Record<_CheckinItem, { question: string; questionAlt?: string }> = {
  munkaviszony: { question: 'Kezdtél munkaviszonyt?', questionAlt: 'Megszűnt vagy változott a munkaviszonyod?' },
  nyugdij: { question: 'Nyugdíjas lettél?' },
  koltozes: { question: 'Költözik a vállalkozásod, vagy új helyen is dolgozol?' },
  tevekenyseg: { question: 'Új munkába kezdesz, vagy más lesz a fő munkád?' },
  csalad: { question: 'Született gyermeked, babát vártok, vagy házasodtál?' },
  alkalmazott: { question: 'Lett alkalmazottad vagy egyszerűsített foglalkoztatottad (EFO)?' },
  szuneteltetes: { question: 'Szünetet tartanál a vállalkozásodban?' },
  folytatas: { question: 'Újrakezdenéd a vállalkozásodat?' },
  kata_ceges: { question: 'Számlázol, vagy fogsz számlázni cégnek vagy egyéni vállalkozónak?' },
  egyeb: { question: 'Más is változott?' },
};
/** Follow-up screens (one question per screen). */
export const CHECKIN_FOLLOWUP_TEXTS = {
  since: 'Mióta?',
  hours: 'Heti hány órában?',
  hours36: '36 óra vagy több',
  hoursLess: 'Kevesebb, mint 36 óra',
  pensionSince: 'Mióta kapod?',
  koltozesSzekhely: 'A székhelyem költözik',
  koltozesTelephely: 'Új telephelyem lesz',
  csalad: 'Ezt az adókedvezmény-kérdőívben adod meg, kb. 3 perc.',
  csaladButton: 'Megnyitom',
  kataCeges:
    'Ha egy cég vagy egyéni vállalkozó fizet neked, a katád a fizetés előtti nappal megszűnik. Előbb beszélj {firstNameWith}: lehet, hogy jobb, ha előtte átállsz átalányadózásra.',
  kataCegesCall: 'Kérek visszahívást',
  kataCegesChange: 'Átállnék átalányadózásra',
} as const;
/** What the answer means, in plain words (SPEC §28.K.2). */
export const CHECKIN_RESULT_TEXTS = {
  fo_mellek_36:
    'Akkor a vállalkozásod mellékállású lesz: nem kell a havi minimum járulékot fizetned, csak a valódi jövedelmed után. Ezt be kell jelenteni a NAV-nak, és nálunk is átállítjuk az adódat.',
  /** [KÖNYVELŐ: confirm the T101E duty for [1]→[3]] */
  fo_rovid: 'Heti 36 óra alatt a vállalkozásod főállású marad, a havi minimum járulék is marad. A munkavégzés jellegét be kell jelenteni a NAV-nak.',
  mellek_fo:
    'Ha megszűnt a munkaviszonyod, a vállalkozásod főállású lesz: havonta legalább kb. 101 682 Ft járulékot kell fizetned (2026). Ezt be kell jelenteni a NAV-nak, és nálunk is átállítjuk.',
  kata_36: 'Figyelem: ha egy teljes hónapig heti 36 órás munkaviszonyod van, megszűnik a katád, és 15 napon belül be kell jelenteni. {firstName} segít átállni átalányadózásra.',
  nyugdij: 'Nyugdíjasként a vállalkozásod után nem fizetsz TB-járulékot és szochót, csak SZJA-t. Ezt be kell jelenteni a NAV-nak, és nálunk is átállítjuk.',
  nyugdij_kata: 'Nyugdíjasként nem maradhatsz katás: {firstName} segít átállni átalányadózásra.',
} as const;
/** "Mi változik nálad: …" under the choice cards. */
export const CHECKIN_ADMIN_TEXTS: Record<_CheckinItem, string> = {
  munkaviszony: 'a NAV-nál be kell jelenteni a munkavégzés jellegét (T101E), nálunk pedig átállítjuk az adódat.',
  nyugdij: 'a NAV-nál be kell jelenteni (T101E), nálunk pedig átállítjuk az adódat.',
  koltozes: 'a NAV-nál be kell jelenteni az új címet; ha másik településre mész, az iparűzési adód is oda kerül.',
  tevekenyseg: 'a NAV-nál be kell jelenteni az új tevékenységet; lehet, hogy más költséghányad jár.',
  csalad: '{firstName} átnézi a kedvezményeidet, és ha jár, beszámolja az adódba. Ezért nem fizetsz külön.',
  alkalmazott: 'bérszámfejtést most nem vállalunk: {firstName} megnézi, mit tudunk ajánlani.',
  szuneteltetes: 'a NAV-nál be kell jelenteni; szünetelés alatt nincs járulék, és a havidíj helyett kisebb díjat fizetsz.',
  folytatas: 'a NAV-nál be kell jelenteni; az újrakezdéstől újra jár az adó, a járulék és a havidíj.',
  kata_ceges: 'előbb beszéljünk: egy céges fizetés megszünteti a katádat.',
  egyeb: '{firstName} elolvassa, és ha teendő van, szól.',
};
/** Panel queue "Havi változások" (staff wording). */
export const CHECKIN_PANEL_TEXTS = {
  title: 'Havi változások',
  colClient: 'Ügyfél',
  colWhat: 'Mi változott',
  colHow: 'Hogyan',
  colFee: 'Díj',
  colBall: 'Kinél a labda',
  colSince: 'Mióta',
  noAnswer: 'nem válaszolt',
  feePaid: 'fizetve',
  feeWaiting: 'vár',
  how: { helyettunk: 'Helyettünk', magatol: 'Magától', kerdes: 'Kérdés' },
  status: { uj: 'Új', dijra_var: 'Díjra vár', csapatnal: 'Csapatnál', ugyfel_intezi: 'Ügyfél intézi', kesz: 'Kész', nem_kell: 'Nem kell teendő' },
  noActionReason: 'Miért nem kell teendő? (az ügyfél látja)',
  applyStatus: 'Adóprofil átállítása ({status}, {date})',
  applyPause: 'Szünetelés felvétele',
  applyAllowances: 'Kedvezmények újranézése',
  applyEmployer: 'Döntés az alkalmazottakról',
  digest: 'Havi változás: {n} ügyfél',
} as const;

// ---------- §28.K.3 B – annual closing (content eves.*) ----------
export const ANNUAL_TEXTS = {
  E0: {
    title: 'Éves zárás {ev}',
    text: 'Pár kérdés az évedről, kb. 5 perc. Ebből készíti el {firstName} az SZJA-bevallásodat és az iparűzési adó bevallását. Díja: {dij} Ft, a végén fizeted.',
    textKata: 'Pár kérdés az évedről, kb. 5 perc. Ebből készíti el {firstName} a kata-nyilatkozatodat és az iparűzési adó bevallását. Díja: {dij} Ft, a végén fizeted.',
    button: 'Kezdjük',
  },
  E1: {
    title: 'Volt idén más jövedelmed is a vállalkozásodon kívül?',
    why: 'A bevallásban minden jövedelmed szerepel. A munkabéredet és a nyugdíjadat a NAV már ismeri.',
    followUp: '{firstName} megnézi, mit kell vele tenni. Lehet, hogy ehhez külön segítség kell – ezt előre megmondja.',
  },
  E2: {
    title: 'Ezek a kedvezményeid',
    ok: 'Rendben, ez így jó',
    changed: 'Valami változott – módosítom',
    kata: 'A katádra a kedvezmények nem hatnak. Ha munkabéred is volt, arra igen: {firstName} megnézi.',
  },
  E3: {
    title: 'Hol dolgoztál idén?',
    csakSzekhely: 'Csak a székhelyemen',
    masHol: 'Más településen is',
    where: 'Melyik településen? Kb. hány napot?',
    letter: 'Kaptál levelet vagy határozatot az önkormányzattól az iparűzési adóról?',
    letterDocTitle: 'Önkormányzati levél – iparűzési adó',
  },
  E4: {
    title: 'Rendelkezel az SZJA 1+1%-áról?',
    civil: 'Melyik civil szervezetnek? (adószám)',
    egyhaz: 'Melyik egyháznak? (technikai szám)',
    skip: 'Nem, most nem',
  },
  E5: { title: 'Ha adó jár vissza, melyik bankszámládra kéred?', field: 'Bankszámlaszám (nem kötelező)' },
  E6: { title: 'Van még iratod {ev}-ből, amit nem töltöttél fel?', hint: 'Például a decemberi bankszámlakivonat.' },
  E7: { title: 'Üzenet {firstName} számára (nem kötelező)' },
  E8: { title: 'Összefoglaló', feeRow: 'Éves zárás díja: {dij} Ft', button: 'Elküldöm és fizetek' },
  sentToast: 'Köszönjük! {firstName} nekilát. Szól, ha kérdése van, vagy ha jóvá kell hagynod a bevallást.',
  card: { title: 'Éves zárás {ev}', due: 'A kérdőívet {hatarido} töltsd ki.' },
  buttons: { kerdoiv: 'Kitöltöm', dijra_var: 'Fizetek', jovahagyasra_var: 'Átnézem és jóváhagyom' },
  approval: {
    title: 'Nézd át a bevallásodat',
    open: 'Megnyitom a tervezetet',
    approve: 'Jóváhagyom a bevallást',
    question: 'Kérdésem van',
    approvedToast: 'Köszönjük! {firstName} beadja, és szól.',
  },
  /** Panel tab "Éves zárás" (staff wording). */
  panel: {
    tab: 'Éves zárás',
    draftUpload: 'Tervezet feltöltése',
    filedSzja: 'Beadtam az SZJA-bevallást',
    filedKata: 'Beadtam a kata-nyilatkozatot',
    filedHipa: 'Beadtam a HIPA-bevallást',
    chip: 'Éves zárás: {n} vár rád',
    digest: 'Éves zárás vár rád: {n}',
  },
} as const;
export const OTHER_INCOME_LABELS: Record<'munkaber' | 'nyugdij' | 'ingatlan_berbeadas' | 'ingatlan_auto_eladas' | 'ertekpapir' | 'kulfold' | 'mas' | 'nem_volt', string> = {
  munkaber: 'Munkabér',
  nyugdij: 'Nyugdíj',
  ingatlan_berbeadas: 'Lakás vagy más ingatlan kiadása',
  ingatlan_auto_eladas: 'Ingatlant vagy autót adtam el',
  ertekpapir: 'Értékpapír, megtakarítás',
  kulfold: 'Külföldről',
  mas: 'Más',
  nem_volt: 'Nem volt',
};
export const ANNUAL_STATUS_CLIENT_TEXT: Record<_AnnualStatus, string> = {
  nem_indult: 'Január 5-én nyílik. Szólunk, ha kitöltheted.',
  kerdoiv: 'Töltsd ki a kérdőívet {hatarido}. Kb. 5 perc.',
  dijra_var: 'Elküldted a kérdőívet. Fizesd ki az éves zárás díját ({dij} Ft), és {firstName} nekilát.',
  konyvelonel: '{firstName} dolgozik rajta. Szól, ha kérdése van.',
  jovahagyasra_var: 'Kész a bevallásod tervezete. Nézd át, és hagyd jóvá.',
  beadva: 'Beadtuk a bevallásodat. Az iparűzési adó bevallása következik.',
  kesz: 'Kész: minden bevallásodat beadtuk. A visszaigazolásokat a dossziédban találod.',
};
export const ANNUAL_CHECK_LABELS: Record<
  'kerdoiv_atnezve' | 'jovedelmek_rendben' | 'kedvezmenyek_rendben' | 'hipa_adatok_rendben' | 'tervezet_feltoltve' | 'ugyfel_jovahagyta' | 'szja_beadva' | 'kata_beadva' | 'hipa_beadva' | 'visszaigazolas_feltoltve',
  string
> = {
  kerdoiv_atnezve: 'Kérdőív átnézve',
  jovedelmek_rendben: 'Más jövedelmek rendben',
  kedvezmenyek_rendben: 'Kedvezmények rendben',
  hipa_adatok_rendben: 'HIPA-adatok rendben',
  tervezet_feltoltve: 'Tervezet feltöltve',
  ugyfel_jovahagyta: 'Az ügyfél jóváhagyta',
  szja_beadva: 'SZJA-bevallás beadva',
  kata_beadva: 'Kata-nyilatkozat beadva',
  hipa_beadva: 'HIPA-bevallás beadva',
  visszaigazolas_feltoltve: 'NAV-visszaigazolás feltöltve',
};

// ---------- §28.K.4 C – reminders (content emlekezteto.*; notification variants notif.<kind>.<variant>.*) ----------
export const REMINDER_TEXTS = {
  groupTitle: 'EMLÉKEZTETŐK',
  groups: { befizetes: 'Befizetési határidők', feltoltes: 'Feltöltési emlékeztetők', ra_var: 'Ha valami rád vár' },
  groupSubs: {
    befizetes: 'Pár nappal előtte, a határidő napján, és ha lejárt.',
    feltoltes: 'Ha egy hónapból hiányzik a kivonat vagy a nyugta.',
    ra_var: 'Ha 3 és 7 nap után is rád vár valami.',
  },
  tax_due_soon: {
    ma: { title: 'Ma van a befizetés napja: {osszeg} Ft', body: 'Utald el ma. Ha már elutaltad, koppints az „Elutaltam” gombra.' },
    lejart: { title: 'Lejárt a befizetés: {osszeg} Ft', body: 'Tegnap volt a határidő. Utald el minél előbb. Ha már elutaltad, jelezd az appban.' },
    kata: { title: 'Utald el a katát: 50 000 Ft', body: 'A {honap} havi kata határideje: {hatarido}.' },
    kata_ma: { title: 'Ma van a kata határideje', body: 'Utald el ma az 50 000 Ft-ot a {honap} hónapra.' },
    hipa: { title: 'Közeleg az iparűzési adóelőleg: {osszeg} Ft', body: 'Határidő: {hatarido}. A számlaszámot az appban találod.' },
  },
  upload_reminder: {
    kivonat: { title: 'Töltsd fel a {honap} bankszámlakivonatot', body: 'Fotó vagy PDF, vagy továbbítsd e-mailben. Kb. 1 perc.' },
    nyugta: { title: 'Vannak {honap} nyugtáid?', body: 'Töltsd fel őket, vagy a pénztárgép havi összesítőjét.' },
  },
  request_reminder: {
    nap3: { title: '{firstName} vár valamire tőled', body: '{title} – 3 napja kérte. Kb. 1 perc.' },
    nap7: { title: '{firstName} még mindig vár: {title}', body: 'Egy hete kérte. Ha elakadtál, írj neki.' },
  },
  nudge: {
    egy: { title: '{mi} még rád vár', body: 'Pár perc az egész. Ha elakadtál, írj nekünk.' },
    tobb: { title: '{n} dolog vár rád', body: 'Nézd meg a Főoldalon.' },
    /** [ELLENŐRIZENDŐ Evectv.] – sent only after B4 confirmed the 2-year rule. */
    szunetel_ket_ev: { title: 'Hamarosan két éve szünetel a vállalkozásod', body: 'Ha {datum}-ig nem kezded újra, a NAV törölheti. Beszéljünk róla.' },
  },
  /** {mi} of a nudge row per subject. */
  nudgeSubjects: {
    havi_ellenorzes: 'A havi kérdés („Változott valami?”)',
    kedvezmeny_kerdes: '{firstName} kérdése a kedvezményedről',
    eves_kerdoiv: 'Az éves zárás kérdőíve',
    dij: 'Egy díj kifizetése',
    valtozas_engedely: 'A változásbejelentés engedélye',
    eves_jovahagyas: 'A bevallásod jóváhagyása',
  },
  annual_due: {
    kerdoiv: { title: 'Éves zárás: töltsd ki a kérdőívet {hatarido}', body: 'Kb. 5 perc. Ebből készül a bevallásod.' },
    fizetes: { title: 'Fizesd ki az éves zárás díját', body: '{dij} Ft. Utána {firstName} nekilát.' },
    jovahagyas: { title: 'Hagyd jóvá a bevallásodat {hatarido}', body: 'Kész a tervezet. Kb. 2 perc.' },
  },
  staffDigest: 'Ügyfélre vár 7 napja: {n}',
} as const;

// ---------- §28.K.5 D – unpaid fee lock (content zarolas.*) ----------
export const LOCK_TEXTS = {
  /** {mit} per reason. */
  mit: { havidij: 'havidíj', eves_zaras: 'éves zárás díja' },
  banner: 'Szünetel a könyvelésed, mert nincs kifizetve a {mit} ({osszeg} Ft). Fizess, és {firstName} folytatja.',
  bannerButton: 'Fizetek',
  bannerLink: 'Írok az ügyfélszolgálatnak',
  deadlineNotice: 'Közeleg egy határidő: {date}. Amíg a díj nincs rendezve, ezt nem tudjuk intézni helyetted.',
  lockedAction: 'Ez most szünetel, mert nincs kifizetve a {mit}. A fizetés után újra működik.',
  supportSender: 'Ügyfélszolgálat',
  /** k6c2: the messages header while locked (the banner link opens this thread). */
  supportLine: 'Ügyfélszolgálat: a díjról is itt írhatsz nekünk.',
  /** k6c2: the Főoldal blue band while locked – never "Most nincs mit fizetned" right above the unpaid-fee banner. */
  heroTitle: 'Adót most nem kell fizetned',
  heroNote: 'A könyvelésed viszont szünetel, amíg a {mit} nincs kifizetve.',
  /** Panel (staff wording). */
  panelChip: 'Zárolva: díj elmaradt ({since} óta, {osszeg} Ft)',
  panelDisabled: 'Zárolva: a díj nincs kifizetve. A fizetés után újra működik.',
  digest: 'Zárolt ügyfél: {n}',
} as const;

// ---------- §28.K.6 E – suspension (content szunetel.*) ----------
export const PAUSE_TEXTS = {
  cardTitle: 'Szünetel a vállalkozásod',
  cardBody: 'Szünetel a vállalkozásod, ezért {from} havi {dij} Ft szüneteltetési díjat fizetsz a {havidij} helyett. Ezért megőrizzük az irataidat, figyeljük a határidőidet, és segítünk újraindulni.',
  cardButton: 'Újrakezdeném',
  feeLine: 'Szüneteltetési díj: {dij} Ft / hó',
  ended: 'Újra dolgozol: {from} ismét a havidíj jár.',
  /** k6c2: the Idei kereteid card while paused (no invoicing during szüneteltetés). */
  limitsPaused: 'Amíg szünetel a vállalkozásod, nem állíthatsz ki számlát. Ha újrakezded, itt újra látod a kereteidet.',
} as const;

// ---------- §28.K.7 F – employees / EFO (content alkalmazott.*) ----------
export const EMPLOYER_ANSWER_LABELS: Record<_EmployerAnswer, string> = {
  nincs: 'Nincs',
  alkalmazott: 'Van alkalmazottam',
  efo: 'Van EFO-s foglalkoztatottam',
  mindketto: 'Mindkettő',
  hamarosan: 'Lesz hamarosan',
};
/** Panel decision labels (staff wording). */
export const EMPLOYER_DECISION_LABELS: Record<_EmployerDecision, string> = {
  nincs_teendo: 'Mégsem kell vele foglalkoznunk',
  berszamfejtes_mashol: 'A béreket más számfejti',
  egyedi_ajanlat: 'Egyedi ajánlatot küldök',
  egyedi_elfogadva: 'Az egyedi ajánlatot elfogadta',
  nem_vallaljuk: 'Nem vállaljuk',
};
/** Default client text per decision (the accountant may edit; required except nincs_teendo). */
export const EMPLOYER_DECISION_CLIENT_TEXTS: Record<_EmployerDecision, string> = {
  nincs_teendo: '',
  berszamfejtes_mashol: 'Rendben: a béreket a bérszámfejtőd intézi, mi a vállalkozásod többi részét.',
  egyedi_ajanlat: '',
  egyedi_elfogadva: 'Rendben, megállapodtunk. Indulhatunk.',
  nem_vallaljuk: '',
};
export const EMPLOYER_TEXTS = {
  question: 'Van alkalmazottad vagy egyszerűsített foglalkoztatottad (EFO)?',
  yes: 'Bérszámfejtést most nem vállalunk. {firstName} megnézi a helyzetedet, és megírja, mit tudunk ajánlani: lehet, hogy egyedi ajánlatot küld, vagy azt javasolja, hogy a béreket más számfejtse, és mi a vállalkozásod többi részét intézzük.',
  journeyTitle: 'Alkalmazottak',
  journeyWaiting: '{firstName} megnézi, mit tudunk vállalni.',
  subscriptionLock: 'Előbb {firstName} megnézi, mit tudunk vállalni az alkalmazottaid miatt.',
  offerButton: 'Megbeszélem {firstNameWith}',
  declinedTitle: 'Most nem tudunk segíteni',
  declinedCallback: 'Kérj visszahívást',
  panelCard: 'Alkalmazottak',
  panelClientText: 'Szöveg az ügyfélnek',
  panelNotify: '{clientName}: alkalmazott vagy EFO – dönts',
} as const;

// ---------- §28.K.8 G – public tax calculator (content kalkulator.*; no AI wording) ----------
export const CALCULATOR_TEXTS = {
  seoTitle: 'Mennyi adót fizetnél egyéni vállalkozóként? – adókalkulátor 2026',
  seoDescription:
    'Írd be, mennyi bevételre számítasz, és megmutatjuk, mennyi SZJA, TB-járulék, szocho és iparűzési adó jön ki egy évre és negyedévre, és mennyit tegyél félre havonta.',
  title: 'Mennyi adót fizetnél egyéni vállalkozóként?',
  sub: 'Átalányadóval, 2026-os szabályokkal. Semmit nem mentünk el.',
  revenue: 'Mennyi bevételre számítasz egy évben?',
  activity: 'Mivel foglalkozol?',
  activityNotFound: 'Nem találom',
  activityFallback: 'Az általános költséghányaddal számoltunk.',
  side: 'Mellette…',
  sideOptions: {
    csak_ez: 'Csak ezt csinálom',
    munkaviszony_36: 'Heti 36 órás munkahelyem is van',
    nyugdijas: 'Nyugdíjas vagyok',
    rovid_munkaviszony: 'Kevesebb órás munkahelyem van',
  },
  start: 'Mikor indulsz?',
  startExisting: 'Már működöm',
  startThisYear: 'Idén, {honap}-ban',
  allowances: 'Kedvezmények',
  allowanceFiatal: '25 évesnél fiatalabb vagy',
  allowanceAnya: 'Anya vagy 2 vagy több gyermekkel',
  allowanceAnya30: '30 évesnél fiatalabb vagy',
  allowanceChildren: 'Gyermekeid száma, akikre családi pótlékot kapsz',
  kataToggle: 'Kata is érdekel',
  kataColumn: 'Katával',
  kataNote: 'Havi 50 000 Ft, évi 18 millió Ft bevételig – csak ha kizárólag magánszemélyeknek számlázol.',
  perYear: 'Egy évre',
  perQuarter: 'Negyedévente',
  szja: 'SZJA',
  tb: 'TB-járulék',
  szocho: 'Szocho',
  hipa: 'Iparűzési adó',
  together: 'Összesen',
  net: 'Ennyi marad neked',
  monthlyReserve: 'Ennyit tegyél félre havonta',
  lines: {
    szja: 'A bevételed egy része jövedelem, ennek 15%-a. Az első kb. 1,9 millió Ft jövedelem adómentes.',
    tb: 'A jövedelmed 18,5%-a; főállásban legalább a havi minimum után.',
    szocho: 'A jövedelmed 13%-a; főállásban legalább a havi minimum után.',
    hipa: 'A települési kulcs 0–2%, mi 2%-kal számoltunk.',
    net: 'A valódi költségeid (anyag, telefon, autó) előtt.',
    monthlyReserve: 'Az évi adók elosztva a hónapokra, felfelé kerekítve.',
    kata: 'A kata mindent fedez: nincs külön SZJA, TB és szocho.',
  },
  afaNote: 'Évi 20 millió forint bevételig nem kell ÁFÁ-t felszámolnod (alanyi adómentesség).',
  footer: 'Becslés a 2026-os szabályokkal. Nem adótanácsadás: a pontos összeget a könyvelőd számolja ki.',
  ctaRegister: 'Regisztrálok',
  ctaCallback: 'Kérek visszahívást',
} as const;

// ---------- §28.K.9 H – auto-fill by adószám (content adoszam.*) ----------
export const TAXPAYER_LOOKUP_TEXTS = {
  title: 'Add meg az adószámodat',
  sub: 'Ebből kikeressük a vállalkozásod adatait, neked csak rá kell bólintanod.',
  field: 'Adószám',
  whereLink: 'Hol találom?',
  dontKnow: 'Most nem tudom',
  cardTitle: 'Ez a te vállalkozásod?',
  cardYes: 'Igen, ez az enyém',
  cardNo: 'Nem, ez nem az enyém',
  demo: 'DEMO – kitalált adatok',
  notFound: 'Ilyen adószámot nem találtunk. Nézd meg még egyszer, vagy add meg kézzel.',
  notEv: 'Ez nem egyéni vállalkozás adószáma. Mi most egyéni vállalkozókat könyvelünk.',
  notAlanyi: 'Ez az adószám nem ÁFA-mentes vállalkozásé. Nézd meg még egyszer, vagy írj nekünk.',
  unavailable: 'Most nem érjük el a NAV-ot. Add meg kézzel, vagy próbáld újra később.',
  rateLimited: 'Túl sokszor próbáltad. Add meg kézzel, vagy próbáld újra egy óra múlva.',
  confirmOk: 'Rendben',
  confirmFix: 'Javítom',
  confirmName: 'A vállalkozásod neve',
  confirmSeat: 'Székhely',
  confirmEv: 'Egyéni vállalkozó',
  confirmAfa: 'Alanyi ÁFA-mentes',
  /** Panel task (staff wording). */
  panelTask: 'Adószám hiányzik – töltsd ki az ONYA-ból',
  panelAfaWarning: 'Az ÁFA-kód nem 1: nem alanyi ÁFA-mentes. Beszélj az ügyféllel.',
  journeyNavWait: '{firstName} kitölti az adószámodat a NAV-nál',
} as const;
/** "Most nem tudom" → the manual form, one question per screen. */
export const BUSINESS_MANUAL_TEXTS = {
  name: 'Mi a vállalkozásod neve?',
  nameHint: 'Ha nem tudod pontosan, írd a saját neved – {firstName} javítja.',
  seat: 'Hol van a székhelyed?',
  activity: 'Mivel foglalkozol?',
  since: 'Mióta vagy egyéni vállalkozó?',
  alanyi: 'Alanyi ÁFA-mentes vagy?',
  alanyiYes: 'Igen',
  alanyiNo: 'Nem',
  alanyiDontKnow: 'Nem tudom',
} as const;

// ---------- §28.K.11 J – KATA (content kata.*) ----------
export const KATA_TEXTS = {
  regimeQuestion: 'Hogyan adózol most?',
  regimeAtalany: 'Átalányadó',
  regimeKata: 'Kata (havi 50 000 Ft)',
  regimeDontKnow: 'Nem tudom',
  regimeDontKnowText: 'Semmi gond: {firstName} megnézi a NAV-nál, amint él a meghatalmazás. Addig átalányadóként mutatjuk az adódat.',
  newQuestion: 'Hogyan szeretnél adózni?',
  newAtalany: 'Átalányadó (ha cégeknek is számlázol)',
  newKata: 'Kata (csak ha kizárólag magánszemélyeknek számlázol)',
  newDontKnow: 'Nem tudom – segítsetek',
  notMainJob: 'Mellette dolgozol, ezért nem lehetsz katás.',
  revenueTitle: 'Idei bevétel',
  meter: '{bevetel} / {keret} Ft',
  meterLine: 'Idén eddig a kereted {pct}%-át használtad.',
  payTitle: 'Utalj 50 000 Ft-ot {hatarido}',
  reserve: 'Havonta 50 000 Ft a kata. Ha a kereted fölé mennél, a fölötti rész 40%-át is félre kell tenned.',
  invoiceFits: 'Ez a számla belefér a havi 50 000 Ft-ba, nem kell külön félretenned.',
  invoiceOver: 'Ez a számla a kereted fölött van: tegyél félre kb. {felre} Ft-ot (40%).',
  businessInvoice: 'Cégnek számláztál – vigyázz a katádra',
  businessInvoiceLine: 'Ha {vevo} kifizeti, a katád a fizetés előtti nappal megszűnik. Beszélj {firstNameWith}, mielőtt fizet.',
  unknownCustomer: 'Nem tudjuk, cég-e a vevő. Ellenőrizd, és ha cég, beszélj {firstNameWith}.',
  infoCard: 'Katásként a nyugdíjad és a táppénzed alapja havi 108 000 Ft. Egy katás év kb. 122 nap szolgálati időt ér.',
  infoCardButton: 'Értem',
  switchRule: 'Kilépés után az év végéig és még 12 hónapig nem lehetsz újra katás.',
  accountRow: 'Kata (tételes adó)',
  earningsLine: 'A kata mindent fedez: nincs külön SZJA, TB és szocho.',
  panelChip: 'Kata',
} as const;

// ---------- §28.K.12 K – patterns from Accountable (content fooldal.*, postafiok.*, uzenetek.javaslat.*) ----------
export const HOME_K_TEXTS = {
  revenue: 'Idei bevételed',
  revenueSub: 'ebből {n} számla',
  taxes: 'Eddigi adód',
  taxesSub: 'SZJA, járulék, iparűzési adó',
  /** k6c: when part of the advances comes back in the annual return. */
  taxesSubRefund: 'SZJA, járulék, iparűzési adó; kb. {refund} Ft visszajár',
  /** k6c: the line under "Az adómentes részt … elérted." with an approved allowance. */
  adomentesAllowanceNone: 'Az első {limit} Ft jövedelmed adómentes volt. Azóta a kedvezményed miatt nem fizetsz SZJA-t.',
  adomentesAllowanceLess: 'Az első {limit} Ft jövedelmed adómentes volt. Azóta fizetsz SZJA-előleget, de a kedvezményed csökkenti.',
  /** k6c: KATA clients – until the KATA view is built no átalány number is shown. */
  kataTaxes: 'Kata',
  kataTaxesSub: 'havi 50 000 Ft, {firstName} számolja.',
  kataHeroTitle: '{firstName} számolja a katádat',
  kataHeroNote: 'Katás vagy: a havi 50 000 Ft-ot és a keretedet {firstName} figyeli. Szól, ha utalnod kell.',
  payTitle: 'Utalj {osszeg} Ft-ot {hatarido}',
  payPayee: 'Kedvezményezett',
  payAccount: 'Számlaszám',
  payReference: 'Közlemény',
  payAmount: 'Összeg',
  copy: 'Másolom',
  copied: 'Kimásoltuk',
  paidButton: 'Elutaltam',
  paidUndo: 'Mégsem utaltam el',
  ringCentre: 'Még {X} Ft',
  ringLine: 'Még {X} Ft-ot tegyél félre.',
  ringMark: 'Félretettem…',
  ringMarkTitle: 'Mennyit tettél már félre az adóra?',
  ringSubtracted: 'A félretett pénzedből levontuk a befizetett {osszeg} Ft-ot.',
  quarterRow: '{ev}. {q}. negyedév · {osszeg} Ft · {hatarido}',
  quarterPaid: 'Befizetve ✓',
  photoChecks: '{firstName} ellenőrzi.',
  photoAmount: 'Összeg',
  photoDate: 'Dátum',
} as const;
export const DOCUMENT_STATUS_TAB_LABELS: Record<'feltoltve' | 'latta' | 'kesz', string> = {
  feltoltve: 'Feltöltve',
  latta: '{firstName} látta',
  kesz: 'Kész',
};
export const MAILBOX_TEXTS = {
  fiokRow: 'Továbbító e-mail-cím',
  title: 'Továbbító e-mail-cím',
  body: 'Ide továbbíthatod a nyugtáidat és a bankszámlakivonataidat. A csatolmányok a dossziéd megfelelő hónapjába kerülnek.',
  copy: 'Másolom',
  rotate: 'Új címet kérek',
  rotateConfirm: 'A régi cím ezután nem működik. Kérsz újat?',
  senders: 'Ezekről a címekről fogadjuk a leveleidet',
  addSender: 'Másik címet adok hozzá',
  maxSenders: 'Legfeljebb 3 másik címet adhatsz meg.',
  demo: 'DEMO – a levelezés még nincs bekötve',
  limits: 'Legfeljebb 10 csatolmány, egyenként 15 MB: PDF, JPG, PNG, HEIC vagy XML.',
  received: 'Megkaptuk a leveledet: {n} csatolmány a {honap} dossziéban.',
  rejected: 'Egy levelet nem fogadtunk el, mert nem a te címedről jött: {maszkolt}. Ha a tiéd, add hozzá a Fiókban.',
  simulate: 'Levél szimulálása',
} as const;
/** Suggested questions in Üzenetek: a tap fills the input, the client sends it (no automatic answer). */
export const SUGGESTED_QUESTIONS: readonly string[] = [
  'Mennyit kell befizetnem, és mikorra?',
  'Mit töltsek fel ebben a hónapban?',
  'Mennyit tegyek félre?',
  'Hogyan kérek jövedelemigazolást?',
];

// ---------- §28.K.15 N – no response-time promise ----------
/** The only allowed line about answering (content uzenetek.valaszido). */
export const RESPONSE_TIME_DEFAULT_TEXT = '{firstName} a lehető leggyorsabban válaszol.';
/** PATCH /acc/settings rejects a response text matching RESPONSE_TIME_FORBIDDEN_PATTERNS with this (also the field hint). */
export const RESPONSE_TIME_SETTINGS_ERROR = 'Ide ne írj időt: a lehető leggyorsabban válaszolunk.';

// ---------- §28.K.17 notifications (content notif.<kind>[.<variant>].title|body) ----------
export const K28_NOTIFICATION_TEXTS = {
  checkin_due: { title: 'Változott valami {honap} óta?', body: 'Pár igen–nem kérdés, kb. 1 perc.' },
  fee_due: {
    valtozas: { title: 'Fizesd ki a bejelentés díját', body: '{dij} Ft. Utána {firstName} nekilát.' },
    eves_zaras: { title: 'Fizesd ki az éves zárás díját', body: '{dij} Ft. Utána {firstName} nekilát.' },
  },
  annual_status: {
    jovahagyasra_var: { title: 'Kész a bevallásod tervezete', body: 'Nézd át, és hagyd jóvá. Kb. 2 perc.' },
    beadva: { title: 'Beadtuk a bevallásodat', body: 'A visszaigazolást a dossziédban találod.' },
    kesz: { title: 'Kész az éves zárás', body: 'Minden bevallásodat beadtuk. Köszönjük!' },
  },
  service_locked: {
    title: 'Szünetel a könyvelésed',
    body: 'Nincs kifizetve a {mit}. Fizess, és {firstName} folytatja.',
    hatarido: { title: 'Közeleg egy határidő: {date}', body: 'Amíg a díj nincs rendezve, ezt nem tudjuk intézni helyetted.' },
  },
  service_unlocked: { title: 'Újra minden működik', body: 'Köszönjük a fizetést. {firstName} folytatja a munkát.' },
  kata_business_invoice: {
    title: 'Cégnek számláztál – vigyázz a katádra',
    body: '{vevo}, {osszeg} Ft. Ha kifizeti, megszűnik a katád. Beszélj {firstNameWith}, mielőtt fizet.',
    /** To the accountant (staff wording, in-app + digest). */
    staff: { title: 'Kata-kockázat: {clientName}', body: '{vevo}, {osszeg} Ft. Fizetés esetén a kata a fizetés előtti nappal megszűnik, bejelentés 15 napon belül.' },
  },
  mailbox_received: { title: 'Megkaptuk a leveledet', body: '{n} csatolmány a {honap} dossziéban.' },
  mailbox_rejected: { title: 'Egy levelet nem fogadtunk el', body: 'Nem a te címedről jött: {maszkolt}. Ha a tiéd, add hozzá a Fiókban.' },
  employer_decided: {
    berszamfejtes_mashol: { title: '{firstName} átnézte az alkalmazottaid ügyét', body: 'Mehetünk tovább. Nézd meg, mit írt.' },
    egyedi_ajanlat: { title: '{firstName} ajánlatot küldött', body: 'Nézd meg, és ha kérdésed van, beszéljétek meg.' },
    egyedi_elfogadva: { title: 'Megállapodtatok', body: 'Mehetünk tovább a bekötéssel.' },
    nincs_teendo: { title: '{firstName} átnézte az alkalmazottaid ügyét', body: 'Nincs vele teendő, mehetünk tovább.' },
    nem_vallaljuk: { title: 'Most nem tudunk segíteni', body: 'Nézd meg, mit írt {firstName}.' },
  },
  subscription_paused: {
    kezdet: { title: 'Szünetel a vállalkozásod', body: '{from} a havidíj helyett havi {dij} Ft-ot fizetsz.' },
    vege: { title: 'Újra dolgozol', body: '{from} ismét a havidíj jár.' },
  },
  /** Staff kinds (in-app badge + digest; staff wording). */
  checkin_change: { title: 'Havi változás: {clientName}', body: '{items}' },
  annual_submitted: { title: 'Éves zárás: {clientName} beküldte a kérdőívet', body: 'A díj: {feeState}.' },
  client_locked: { title: 'Zárolva: {clientName}', body: 'Elmaradt díj: {mit}, {osszeg} Ft.' },
  employer_reported: { title: 'Alkalmazott vagy EFO: {clientName}', body: 'Dönts: egyedi ajánlat, más számfejt, vagy nem vállaljuk.' },
  onboarding_task: {
    adoszam: { title: 'Adószám hiányzik: {clientName}', body: 'Töltsd ki az ONYA-ból, amint él a meghatalmazás.' },
    adozasi_mod: { title: 'Adózási mód kérdéses: {clientName}', body: 'Az ügyfél nem tudja, kata vagy átalány. Nézd meg a NAV-nál.' },
  },
} as const;
