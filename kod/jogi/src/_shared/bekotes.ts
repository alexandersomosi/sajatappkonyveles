// GENERATED from kod/shared – do not edit here. Edit kod/shared and re-run sync-shared.
// SPEC §26 content contract for the onboarding page and the self-service guides:
//   - explainers "Mi ez? / Miért kell? / Hol találod?" for every onboarding item (order 5),
//   - the "Készítsd elő" list of the new-business guide (order 8),
//   - the common activities of our target group (search in the new-business form, order 1/7),
//   - the two guide templates "Mit hova jelölj" (orders 7 and 9; the pictures are the annotated NAV screenshots),
//   - tiny validators.
// NO imports on purpose: jogi and nav-kliens compile every _shared/*.ts with NodeNext (relative imports would need
// extensions), and index.ts re-exports this file next to enums.ts, so no name here may repeat a name of enums.ts.
// All texts are DEFAULTS. The backend serves them as editable content texts (SPEC §26.8); the app uses them only as an
// offline fallback. Placeholders: {firstName} = the accountant's first name, {havidij} = "20 000 Ft".
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
    where: 'Minden számládon rajta van, amit kiállítottál. A nyilvántartásba vételről kapott értesítésen is megtalálod. Ha most indítod a vállalkozásodat, a bejelentés után kapod meg.',
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
  adatok: 'adoazonosito_jel',
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
  | 'datumra_indul';
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

/** Our wording of the NAV "munkavégzés jellege" choice per WorkKind (keys repeated from enums WORK_KINDS). */
export const WORK_KIND_GUIDE_VALUE: Record<'fofoglalkozas' | 'munkaviszony_mellett' | 'tanulmany_mellett' | 'nyugdij_mellett', string> = {
  fofoglalkozas: 'főfoglalkozású egyéni vállalkozó',
  munkaviszony_mellett: 'mellékfoglalkozású: heti legalább 36 órás munkaviszony mellett',
  tanulmany_mellett: 'mellékfoglalkozású: nappali rendszerű tanulmányok mellett',
  nyugdij_mellett: 'kiegészítő tevékenységet folytató: saját jogú nyugdíj mellett',
};

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
        text: 'Ezt a lapot a NAV tölti ki a nyilvántartásból. Csak nézd át.',
        fields: [
          { label: 'Viselt név, születési név', action: 'ellenorizd', value: '{nev}' },
          { label: 'Anyja születési neve, születési idő és hely, állampolgárság', action: 'ellenorizd', why: 'Ez a NAV rovatának a neve: itt anyukád születési nevét látod.' },
          { label: 'Adóazonosító jel', action: 'ellenorizd', why: 'Ugyanaz, mint az adóigazolványodon.' },
        ],
        warning: 'Ha itt valami nem stimmel, ne itt javítsd: fordulj a NAV-hoz, és csak utána folytasd. Ha a lap TAJ-számot is kér, a TAJ-kártyádról írd be. Mi nem kérjük el.',
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
        text: 'Keress rá a tevékenységeidre, és jelöld meg, melyik a fő.',
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
        text: 'Ezt kötelező kitölteni.',
        fields: [{ label: 'A munkavégzés jellege', action: 'valaszd', value: '{munkavegzesJellege}', why: 'Ettől függ, mennyi járulékot fizetsz. Ha később változik, 15 napon belül be kell jelenteni.' }],
      },
      {
        key: 'adozas_kata_atalany',
        screenTitle: 'Adózási adatok (4/6) – kata és átalányadózás',
        text: 'Itt választod ki, hogyan adózol.',
        fields: [
          { label: 'A katával kapcsolatos nyilatkozat', action: 'ne_jelold', why: 'Szolgáltatásunk átalányadózóknak szól.' },
          { label: 'Az átalányadózás választásával kapcsolatos nyilatkozat', action: 'jelold', why: 'A bevételed egy részét a törvény eleve költségnek veszi, és nem kell számlákkal igazolnod a költségeidet.' },
        ],
        warning: 'Az átalányadózást a bejelentéssel együtt kell választanod. Nézd meg kétszer, hogy bejelölted.',
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
          { label: 'III. A megadott címek megfelelnek a feltételeknek', action: 'jelold', why: 'A címeket jogosan használhatod: a tiéd, bérled, vagy a tulajdonos megengedte.' },
          { label: 'IV. A kamara értesítését tudomásul veszem', action: 'jelold' },
        ],
      },
      {
        key: 'ellenorzes',
        screenTitle: 'Ellenőrzés (6/6)',
        text: 'Nézd át az összesítőt. Ha valamit javítanál, a „Vissza” gombbal léphetsz vissza. Ezeknek így kell lenniük:',
        fields: [
          { label: 'Munkavégzés jellege', action: 'ellenorizd', value: '{munkavegzesJellege}' },
          { label: 'Átalányadózás', action: 'ellenorizd', value: 'igen' },
          { label: 'Alanyi adómentesség (ÁFA)', action: 'ellenorizd', value: 'igen' },
          { label: 'Kata', action: 'ellenorizd', value: 'nem' },
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
        screenTitle: 'Itt, az alkalmazásban',
        text: 'Koppints a „Feltöltöm az értesítést” gombra, és töltsd fel a letöltött PDF-et. Írd be az adószámodat is az értesítésről.',
        fields: [{ label: 'Feltöltöm az értesítést', action: 'kattints' }],
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
        screenTitle: 'Itt, az alkalmazásban',
        text: 'Koppints a „Beküldtem” gombra. Ha elmentetted a visszaigazolást, töltsd fel.',
        fields: [{ label: 'Beküldtem', action: 'kattints' }],
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
        text: 'A menüben a Meghatalmazások mellett piros pötty jelzi, hogy valami vár rád. Az Értesítések között is megtalálod.',
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
        screenTitle: 'Itt, az alkalmazásban',
        text: 'Koppints a „Jóváhagytam” gombra. {firstName} ellenőrzi, és szól, ha él a meghatalmazás.',
        fields: [{ label: 'Jóváhagytam', action: 'kattints' }],
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
  return s;
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
      imageKey: st.key,
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
export function fillPlaceholders(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{([A-Za-z0-9_]+)\}/g, (m, k: string) => {
    const v = values[k];
    return v === undefined ? m : v;
  });
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
  | 'nav_bekotes',
  JourneyStepText
> = {
  ut: { title: 'Vállalkozásod', explainer: 'vallalkozas_van_e', route: '/bekotes', actionLabel: 'Válaszolok', time: '1 koppintás' },
  visszahivas: { title: 'Visszahívás', explainer: 'visszahivas', route: '/visszahivas', actionLabel: '', time: '24–48 órán belül' },
  adatok: { title: 'Adataid', explainer: 'adoazonosito_jel', route: '/bekotes/adatok', actionLabel: 'Kitöltöm', time: 'kb. 3 perc' },
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
    actionLabel: 'Megnézem, hogyan',
    time: 'kb. 5 perc',
    timeSegitett: 'jóváhagyás: kb. 3 perc',
    actionLabelSegitett: 'Megnyitom a jóváhagyás útmutatóját',
  },
  azonositas: { title: 'Igazolványok', explainer: 'szemelyi_foto', route: '/bekotes/azonositas', actionLabel: 'Lefotózom', time: 'kb. 5 perc' },
  elofizetes: { title: 'Előfizetés', explainer: 'elofizetes', route: '/bekotes/elofizetes', actionLabel: 'Megadom a kártyámat', time: 'kb. 2 perc' },
  nav_bekotes: { title: 'Kiállított számlák bekötése', explainer: 'nav_bekotes', route: '', actionLabel: '', time: 'általában 1–2 munkanap' },
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
  { kicker: string; title: string; body: string }
> = {
  tevekenyseg_sor: {
    kicker: 'Most mi dolgozunk',
    title: 'Megírjuk, melyik tevékenység-sort válaszd',
    body: 'Általában 1 munkanapon belül. Értesítünk, ha kész. Addig a NAV-os bejelentést még ne kezdd el.',
  },
  atnezes: { kicker: 'Most mi dolgozunk', title: 'Átnézzük a NAV-os értesítésedet', body: 'Általában 1 munkanapon belül. Értesítünk, ha rendben van.' },
  adoszam: {
    kicker: 'Most a NAV dolgozik',
    title: 'Várjuk az adószámodat',
    body: 'Ha nincs rajta az értesítésen, a NAV pár napon belül adja meg: a Vállalkozói Ügysegédben, a Bejelentéseim között látod. Ha megvan, írd be itt. Mi is figyeljük.',
  },
  meghatalmazas_ellenorzes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} ellenőrzi a meghatalmazásodat a NAV-nál',
    body: 'Általában 1 munkanapon belül. Értesítünk, ha él.',
  },
  azonositas_ellenorzes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} átnézi az igazolványaidat',
    body: 'Általában 1 munkanapon belül. Titkosítva tároljuk őket, csak ő látja.',
  },
  nav_bekotes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} beköti a kiállított számláidat',
    body: 'Általában 1–2 munkanap. Utána a kiállított számláid maguktól megjelennek itt, és minden megnyílik.',
  },
  helyettunk_hivas: {
    kicker: 'Most mi jövünk',
    title: 'Hamarosan hívunk',
    body: 'Kollégánk 24–48 órán belül hív a {phoneMasked} számon. Addig kitöltheted a kérdőívet.',
  },
  helyettunk_ujegyke: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} beküldi a meghatalmazást',
    body: 'Általában 1 munkanapon belül. Utána értesítést kapsz, és 4 napod lesz jóváhagyni az ONYA-ban.',
  },
  helyettunk_ellenorzes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} ellenőrzi, hogy él-e a meghatalmazás',
    body: 'A jóváhagyás után a NAV-nál kb. 20 perc, nálunk általában pár óra.',
  },
  helyettunk_bekuldes: {
    kicker: 'Most {firstName} dolgozik',
    title: '{firstName} beküldi a bejelentésedet',
    body: 'Általában 1 munkanapon belül, a saját belépésével, meghatalmazottként. A vállalkozásod azon a napon indul, amikor beküldi.',
  },
  helyettunk_adoszam: {
    kicker: 'Most mi dolgozunk',
    title: 'Rögzítjük az adószámodat',
    body: 'A bejelentés elment a NAV-hoz. Átnézzük az értesítést, és általában 1 munkanapon belül rögzítjük az adószámodat.',
  },
};
/** Under every waiting card. Content `bekotes.varakozas.eszkalacio`. */
export const WAITING_ESCALATE_TEXT = 'Ha {hatarido} nem történik semmi, kérj visszahívást.';
/** Under every waiting card when the client may do something meanwhile. Content `bekotes.varakozas.addig`. */
export const WAITING_MEANWHILE_TEXT = 'Addig: {title}';

/** SPEC §27.2 – the change sheet and its entry links. Content `bekotes.ut.valtas.<key>`. */
export const PATH_CHANGE_TEXTS = {
  sheetTitle: 'Módosítod a válaszodat?',
  toInditas: 'Most az áll itt: már van vállalkozásod. Ha mégsem, és most indítanád, átállunk erre. Amit eddig beírtál, megmarad.',
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
  segitettBody: 'Felhívunk, és {firstName} meghatalmazottként bejelenti a vállalkozásodat. Neked csak jóvá kell hagynod. Ehhez is kell Ügyfélkapu+ vagy DÁP.',
  segitettButton: 'Ezt kérem',
} as const;

/** SPEC §27.3 – "Intézzük helyetted" texts. Content `helyettunk.<key>`. */
export const ASSIST_TEXTS = {
  evCardBadge: 'Ha nem boldogulsz vele',
  evCardTitle: 'Nem boldogulsz vele? Intézzük helyetted.',
  evCardBody: 'Felhívunk, átnézzük veled az adataidat, és {firstName} a saját belépésével, meghatalmazottként bejelenti a vállalkozásodat. Neked csak jóvá kell hagynod.',
  mhCardBadge: 'Megcsináljuk helyetted',
  mhCardTitle: 'Megcsináljuk helyetted a meghatalmazást',
  mhCardBody: '{firstName} beküldi a NAV-nak, te csak jóváhagyod az ONYA-ban, 4 napon belül. Kb. 3 perc a részed.',
  cardButton: 'Ezt kérem',
  guideLink: 'Nem boldogulsz vele? Intézzük helyetted',
  sheetTitleEv: 'Intézzük helyetted – így megy',
  sheetTitleMh: 'Megcsináljuk a meghatalmazást – így megy',
  needs: 'Mire lesz szükséged: Ügyfélkapu+ vagy DÁP a jóváhagyáshoz. Ha nincs, a hívásban segítünk.',
  neverCredentials:
    'Soha nem kérjük el az Ügyfélkapu+- vagy DÁP-belépésedet, a jelszavadat vagy a kódjaidat, és nem lépünk be helyetted. {firstName} a saját belépésével, meghatalmazottként jár el. Amit kell, te hagyod jóvá a NAV oldalán.',
  /** [OWNER] the assisted path is part of the service, no separate fee. */
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
  approveGuideButton: 'Megnyitom az útmutatót',
  approvedButton: 'Jóváhagytam',
  approvedToast: 'Köszönjük! {firstName} ellenőrzi, és szól, ha él.',
  notApprovedYet: 'Még nem hagytam jóvá',
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
    { actor: 'te', text: 'Kitöltöd a kérdőívet, és elfogadod a szerződést.', time: 'kb. 10 perc' },
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
  egyeztetve: 'Beszéltünk. {firstName} hamarosan beküldi a meghatalmazást, utána jóváhagyod.',
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
