# Tisztán (D: Pala és kockás lap) – tervezési rendszer

2026-11-17. A „nyugodt privátbankos irány” D változata, hat (plusz egy) telefonképernyőn kidolgozva. Az ötlet: minden összeg mellett ott van, hogyan jött ki. A belépés, a bekötés és a befizetés megerősítése teljes képernyős sötét pala „előtér”, a napi képernyők világosak. A fizetendő összeg számolása kockás füzetlapon, iskolai írásbeli számolásként jelenik meg, így a „miért ennyi?” kérdésre már azelőtt választ kap a felhasználó, hogy a chatben megkérdezné.

A számok mintaszámok, nem adótanácsok. A NAV-számlaszámokat (SZJA 10032000-06056353, TB 10032000-06055912, szocho 10032000-06055802) élesítés előtt a NAV oldalán ellenőrizni kell. A 8412345678 adóazonosító szándékosan érvénytelen (rossz az ellenőrző számjegye).

## Fájlok

| Fájl | Mi ez |
|---|---|
| `tokens.css` | Közös tokenek és elemek, minden képernyő ezt tölti be |
| `kozos.js` | Kézzel rajzolt ikonkészlet (SVG), állapotsor, alsó sáv, „Másolás” → „Kimásolva” |
| `01_belepes.html/.png` | Belépés (előtér) |
| `02_bekotes.html/.png` | Bekötés állapota regisztráció után (előtér) |
| `03_fooldal.html/.png` + `03_fooldal_teljes.png` | Főoldal, a kockás számolással |
| `04_dosszie.html/.png` + `04_dosszie_teljes.png` | Októberi dosszié |
| `05_tetel.html/.png` + `05_tetel_teljes.png` | Egy tétel: lefotózott nyugtatömb, története, Bence megjegyzése |
| `06_uzenetek.html/.png` | Chat Bencével, gyors kérésekkel |
| `07_befizetve.html/.png` | Ráadás: a „Befizettem” utáni megerősítés (előtér) |
| `attekintes.png` | Mind a hét képernyő egymás mellett |
| `_proba/` | Betűpróba, rácspróba, hunyorítási próba, a fotózó és a kézírás-rajzoló szkript |

A PNG-k 390×844 CSS px-es képernyők 2×-es felbontásban (780×1688), fejetlen Chrome-mal, lövésenként külön profillal. A `_teljes` képek a görgetett tartalom egészét mutatják.

## Időrend a képernyőkön (eltérés a feladattól)

A feladat novemberi dossziét és novemberi kivonatot kért, a D irány viszont a harmadik negyedéves, október 12-i befizetést mutatja. A kettő nem fér össze: átalányadónál a befizetés negyedéves, novemberben nincs mit fizetni. Ezért minden képernyő ugyanazt a pillanatot mutatja: **2026. október 8., csütörtök**.

- Bence október 7-én beadta a harmadik negyedéves bevallást, a fizetendő 820 260 Ft, határidő október 12. (hétfő).
- Bence a **szeptemberi** bankszámlakivonatot kéri, csak ellenőrzésre.
- A dosszié az **októberi** mappa. A tétel feltöltése **10.03.** (a feladatban 11.03. volt), a története: feltöltve → Bence látta → feldolgozva, a „beadva” lépés januárban következik.
- A bekötés (02) szeptember végén történt, a videóhívás október 2-án volt.

Ha mégis november kell, csak a dátumokat és a hónapneveket kell átírni, a szerkezet ugyanaz.

## Tokenek

### Színek

| Token | Hex | Mire |
|---|---|---|
| `--pala` | #2A4E57 | Márka, elsődleges gomb, mérő kitöltése, szöveges gomb, másodlagos gomb kerete |
| `--eloter` | #1D373E | Előtér képernyők háttere, alsó sáv |
| `--eloter-lap` | #26464E | Panel az előtéren (pl. „Neked most ez a dolgod”) |
| `--eloter-vonal` | #3E5F67 | Panel kerete és elválasztó az előtéren |
| `--eloter-masod` | #C9D8DB | Másodlagos szöveg az előtéren |
| `--eloter-halvany` | #A9BFC4 | Inaktív fül felirata a sötét sávon |
| `--alap` | #DAE3E5 | A napi képernyők háttere (1,30:1 a fehérhez képest) |
| `--lap` | #FFFFFF | Fehér lap |
| `--racs` | #DCE8EA | A kockás lap vonala |
| `--racslap` | #FBFDFD | A kockás lap alapja |
| `--tinta` | #132326 | Szöveg |
| `--masod` | #536569 | Másodlagos szöveg fehér lapon |
| `--masod-alap` | #44575B | Másodlagos szöveg a háttéren (a #536569 ott csak 4,7:1 lenne) |
| `--hajszal` | #D3DDDF | Hajszálvonal, üres állapotszegmens |
| `--halvany` | #E3ECEE | Monogram alapja, megnyomott sor |
| `--sajat` | #BFD1D6 | A saját üzeneted buboréka |
| `--hiba` | #B42318 | Veszélyes művelet, hiba |
| `--figy` | #8A5A00 | Figyelmeztetés („Hiányzik”, 80%-os határ) – csak fehér lapon |

Mezőkeret és nyíl: #7C8E92 (3,4:1 a fehérhez, a nem szöveges elemekre vonatkozó 3:1 felett).

### Betűk

Egy betűcsalád két szélességben, mindkettő OFL licencű, a Google Fontsról:

- **Sofia Sans Condensed** 600/700 (Lettersoup): címek, a fizetési mondat, nagy összegek, monogram, szóvédjegy.
- **Sofia Sans** 400/700: szöveg, gombok, a számolás számai. Összegnél mindig `tabular-nums lining-nums`, az ezreseket keskeny, nem törő szóköz (U+202F) választja el.

Ellenőrzés (`_proba/betuproba*.png`): az ő, Ő, ű, Ű kettős ékezete 3×-os nagyításban helyes mind a négy vastagságban. A böngészőben mértem, hogy az U+202F, a −, a ×, a „ ” és a › jel a saját betűből jön, nem tartalékbetűből. A táblázatos számjegyek működnek (az „1111” és a „0000” ugyanolyan széles). Az l és az I hasonlít egymásra, de az azonosítók csak számjegyekből állnak.

### Típusskála

| Szerep | Betű | Méret / sorköz | Vastagság |
|---|---|---|---|
| Szóvédjegy (előtér) | Condensed | 46 px / 1,0 | 700 |
| Képernyőcím („Október”, „Dosszié”) | Condensed | 36 px / 1,05 | 700 |
| Tétel címe | Condensed | 30 px / 1,1 | 700 |
| Fizetési mondat | Condensed | 28 px / 1,12 | 600 |
| Hónapváltó, időpont | Condensed | 22–24 px / 1,1 | 600–700 |
| Szakaszcím a háttéren | Sans | 17 px / 1,3 | 700 |
| Szöveg, sorcím | Sans | 17 px / 1,3–1,45 | 400 |
| Gomb | Sans | 16–17,5 px | 700 |
| Másodlagos szöveg | Sans | 14,5–16 px / 1,35–1,45 | 400 |
| Számolás: összeg / címke | Sans | 17 / 15 px, sor = 18 px | 400, eredmény 700 |
| Legkisebb (időbélyeg) | Sans | 13,5 px | 400 |

### Térközök és formák

- Oldalmargó 16 px. A háttéren álló szöveg (cím, szakaszcím) a lap szélétől 4 px-re kezdődik.
- Lapon belüli margó 17 px. Ennek oka a rács: 17 + 18 × 18 + 17 = 358 px, így a számok jobb széle pontosan rácsvonalra esik.
- Sarkok: lap 14 px, gomb 14 px, mező 12 px, a chat író sávjában 12 px.
- Szakaszok között 24 px, lapok között 10 px.
- Alsó sáv 84 px, a tartalom alján 120 px tartalék.

## Elemek szabályai

**Háttér és lapok.** Napi képernyőn hideg szürkéskék háttér (#DAE3E5), rajta árnyék nélküli fehér lapok. Egy lap egy összetartozó csoport. A szakaszcím a lapon kívül, a háttéren áll, mondatkezdő nagybetűvel, nem csupa nagybetűs címke.

**Előtér.** A belépés, a bekötés és a befizetés megerősítése teljes képernyős #1D373E. A mezők fehérek, a panelek egy árnyalattal világosabbak (#26464E) és vékony keretet kapnak. A napi képernyőkön csak az alsó sáv sötét.

**Gombok.** Négy szint, egymással és a sorokkal sem keverhetők:
- **Elsődleges:** kitöltött pala, 54 px magas, teljes szélességű, 14 px-es sarok, képernyőnként egy. Az előtéren fordított: fehér kitöltés, sötét felirat. Ez az egyetlen kitöltött gomb a képernyőn.
- **Másodlagos:** fehér, 1,5 px-es pala keret, 42–44 px magas, csak akkora, amekkora a felirata (pl. „Feltöltés”, „Kérdezek erről”, a kérésgombok). Az előtéren átlátszó, fehér kerettel („Google-lel”, „Apple-lel”).
- **Szöveges:** félkövér, aláhúzott pala szöveg (pl. „Másolás” → „Kimásolva”, „Nagyítás”). Az előtéren fehér és aláhúzott.
- **Veszélyes:** piros, aláhúzott szöveg. A megerősítő lapon kitöltött piros elsődleges gomb (`.gomb.veszely-tele`). Ezeken a képernyőkön nem szerepel.
- **Kivételek:** a chat „Küldés” gombja 44 × 44-es kitöltött pala négyzet, mert ott ez az elsődleges művelet. A „‹ Október” visszalépés navigáció, nem gomb, ezért nyíllal jelölt, aláhúzás nélküli félkövér pala szöveg.

**Sorok.** Kitöltés és keret nélkül, a lapon belül hajszálvonal választja el őket (17 px-es behúzással), jobbra kis nyíl. Megnyomva halványkék (#E3ECEE) lesz. A gombokkal nem téveszthetők össze, mert nincs keretük és nincs kitöltésük.

**Állapot.** Mindig szóval és 4 szegmenssel: feltöltve → Bence látta → feldolgozva → beadva. A NAV-ból jövő számlánál az első lépés neve „Megjött a NAV-ból”. A NAV-levélnél nincs folyamat, ott csak mondat van („Bence elolvasta: nincs teendőd.”). Ami rád vár, az figyelmeztető barna félkövér („Hiányzik, Bence kérte”). Színes, gomb alakú címke nincs.

**Pénz.**
- Az összeg és a határidő egy mondatban: „Október 12-ig fizess be 820 260 Ft-ot.” A szám és a „Ft-ot” nem törhet el egymástól.
- Minden adónemhez saját számlaszám tartozik „Másolás” gombbal, a közlemény (adóazonosító jel) mindháromnál ugyanaz.
- Listában a „Ft” kisebb és halványabb, mint a szám.

**Kockás számolás (a merész elem).**
- Csak a befizetési lapon szerepel, sehol máshol. 18 px-es (5 mm-es) rács, #DCE8EA vonal #FBFDFD alapon, a lap teljes szélességében.
- Egy sor egy kocka magas. Bal oldalt a műveleti jel (−, =, ×), utána a címke, jobbra a táblázatos számjegyekkel szedett, rácsvonalra zárt szám.
- Ahogy az iskolában: a részeredmény fölé, csak a számok alá egyszeres vonal kerül (1,5 px tinta), a végeredmény alá dupla vonal. A két számolási blokk között egy üres kockasor van.
- Sorok: bevétel 2 940 000; − 40% költséghányad 1 176 000; = jövedelem 1 764 000; × 15% SZJA-előleg 264 600; × 18,5% TB-járulék 326 340; × 13% szocho 229 320; = fizetendő 820 260.
- Lábjegyzet a rácson: „Az adómentes részed már elfogyott, ezért most a teljes jövedelmed után jár SZJA.” Ez köti össze a számolást a lenti határmérővel.

**Mozgás.** Az egyetlen kiemelt pillanat: a számolás első megnyitásakor a sorok balról jobbra „íródnak” (`clip-path`, soronként 80 ms), utána a vonalak is behúzódnak. Ez negyedévenként csak egyszer történik meg (`localStorage`, hibatűrően), és `prefers-reduced-motion` esetén elmarad. Ezen kívül csak a felhasználó műveletére van mozgás.

**Határmérő.** 10 px magas sáv, pala kitöltés, halvány pálya. A 80%-nál egy függőleges jel van, és a szöveg megmondja, mit jelent („A jelnél, 16 millió forintnál szólunk”). A mérő fölött mindig egy teljes mondat áll, nem százalék.

**Monogram.** Kör alakú, betűkkel („KB”), Condensed 700. Fotó vagy rajzolt arc nincs.

**Alsó sáv.** Sötét pala: Főoldal, Dosszié, Üzenetek, Fiók. Saját rajzú vonalikonok. Az aktív fül fehér, félkövér, alatta egy 22 px-es fehér vonás, így nem csak a szín jelzi.

**Ikonok.** Mind saját rajz (`kozos.js`), 24 × 24, 1,8 px-es lekerekített vonal. A nyugta a 05-ön kézzel rajzolt SVG, a kézírás generált vonal (`_proba/keziras.py`), nem betűtípus. A Google és az Apple gombon nincs logó. Éles appban a cégek saját gombkiírását kell használni.

**Szöveg.** Tegeződés, mondatkezdő nagybetű, nincs angol maradvány és nincs „→”. A gomb ugyanazt mondja, mint az eredménye: „Befizettem” → „Befizetve”, „Másolás” → „Kimásolva”. A hibaüzenet azt mondja meg, mi a teendő. A könyvelő emberként beszél („Köszi, mind a négy nyugta jól olvasható.”).

## Kontraszt (WCAG 2.x)

| Szöveg | Háttér | Arány | Hol |
|---|---|---|---|
| Tinta #132326 | Lap #FFFFFF | 16,2:1 | minden törzsszöveg |
| Tinta #132326 | Rácslap #FBFDFD | 15,9:1 | számolás |
| Tinta #132326 | Alap #DAE3E5 | 12,4:1 | címek, szakaszcímek |
| Tinta #132326 | Saját buborék #BFD1D6 | 10,3:1 | a te üzeneted |
| Tinta #132326 | Halvány #E3ECEE | 13,5:1 | megnyomott sor |
| Másod #536569 | Lap #FFFFFF | 6,1:1 | másodlagos szöveg |
| Másod #536569 | Rácslap #FBFDFD | 6,0:1 | lábjegyzet, műveleti jel |
| Másod-alap #44575B | Alap #DAE3E5 | 5,8:1 | alcím, „tegnap, 16:05” |
| Másod-alap #44575B | Saját buborék #BFD1D6 | 4,8:1 | időbélyeg a saját üzeneten |
| Pala #2A4E57 | Lap #FFFFFF | 9,0:1 | szöveges és másodlagos gomb |
| Pala #2A4E57 | Halvány #E3ECEE | 7,5:1 | monogram |
| Fehér | Pala #2A4E57 | 9,0:1 | elsődleges gomb |
| Fehér | Előtér #1D373E | 12,6:1 | előtér szövege, aktív fül |
| Fehér | Előtér-lap #26464E | 10,2:1 | panel címe |
| Előtér-másod #C9D8DB | Előtér #1D373E | 8,6:1 | másodlagos szöveg az előtéren |
| Előtér-másod #C9D8DB | Előtér-lap #26464E | 6,9:1 | panel szövege |
| Halvány #A9BFC4 | Előtér #1D373E | 6,6:1 | inaktív fül |
| Előtér #1D373E | Fehér | 12,6:1 | fordított elsődleges gomb felirata |
| Figyelmeztetés #8A5A00 | Lap #FFFFFF | 5,9:1 | „Hiányzik, Bence kérte” |
| Hiba #B42318 | Lap #FFFFFF | 6,6:1 | veszélyes szöveges gomb |
| Fehér | Hiba #B42318 | 6,6:1 | piros megerősítő gomb |

Minden szöveg legalább 4,5:1. A 7:1 feletti arány a törzsszövegre teljesül (tinta mindenhol 10:1 felett). 7:1 alatt csak a másodlagos szöveg és az időbélyegek vannak. A leggyengébb a 4,8:1-es időbélyeg a saját buborékon, 13,5 px-en.

Nem szöveges elemek: mezőkeret és nyíl #7C8E92 3,4:1, másodlagos gomb kerete 9,0:1 (a háttéren 6,9:1), a háttér és a lap között 1,30:1. Ez csoportosításra szolgál, jelentést nem hordoz, ezért nem kell elérnie a 3:1-et.

## Hunyorítási próba

`_proba/hunyoritas.png`: mind a hét képernyő 6-os Gauss-elmosással. Elmosva is egyértelmű:
- a fehér lapok külön foltok a szürkéskék háttéren, a csoportok nem folynak egybe;
- képernyőnként egyetlen sötét, kitöltött téglalap van (Befizettem, Fotó vagy fájl feltöltése, a küldés négyzete), az előtéren egyetlen fehér;
- a másodlagos gombok keretes „gyűrűk”, nem keverhetők a sorokkal, amelyeknek nincs határuk;
- a sötét alsó sáv minden napi képernyőt lezár.

Gyenge pont: a kockás rács elmosva eltűnik, a számolás szürke szövegtömbnek látszik. Ez szándékos, mert a rács halvány, de a merész elem így közelről hat, nem messziről.

## Amit menet közben megváltoztattam

- **Számjegy kockánként.** Kipróbáltam, hogy minden számjegy külön kockába kerüljön, az ezres csoportok között üres kockával. Ez iskolásabb, de a „2 940 000” szétesett, nehezen olvasható lett, ezért elvetettem. A számok táblázatos számjegyekkel, rácsvonalra zárva állnak.
- **Sormagasság.** A 36 px-es (két kockás) sorok levegősek voltak, de a befizetési lap túl magas lett tőlük. Egy kocka, vagyis 18 px maradt, a két blokk között egy üres sorral.
- **Vonal csak a számok alatt.** Ha a vonal a teljes sort aláhúzza, a „költséghányad” g és y betűjének szára beleér. Az iskolában is csak a számokat húzzuk alá.
- **A számolás animációja levágta a dupla vonalat** (`clip-path: inset(0)`). A végállapot most kifelé is enged teret.
- **Aktív fül jelzése.** A sáv tetején lévő fehér csík összeolvadt a fölötte görgő fehér lappal, ezért a felirat alá került.
- **Chat.** Először minden egy oszlopban görgött, és a legfrissebb üzenetek nem látszottak. Most a fejléc és a kérésgombok rögzítettek, az üzenetek alulról töltődnek, ahogy egy csevegőben szokás.
- **Mezőkeret.** #9DB0B5-ről #7C8E92-re sötétítettem, mert 2,3:1-gyel a nem szöveges elemekre vonatkozó 3:1 alatt volt.

## Önkritika, nyitott kérdések

- **A főoldal hosszú.** A befizetési lap a kockás számolással és a három számlaszámmal kb. 720 px magas, ezért a „Befizettem” gomb és a határmérők az első képernyőn nem látszanak, görgetni kell. Ha ez zavar: a számlaszámok egy „Utalás adatai” lépésbe kerülhetnek, vagy a számolás a második megnyitástól csak a „Hogyan jött ki?” sorra csukódhat össze.
- **18 px-es sorok.** Fiatal szemnek jól olvasható, egy 60–70 éves felhasználónak szűkös lehet. Ha a próbák ezt mutatják, 27 px-es sorral és 13,5 px-es ráccsal ugyanez a hatás megmarad, csak az „5 mm” nem lesz szó szerint igaz.
- **Két feltöltés-gomb a dosszién** (a hiányzó kivonat sorában és alul a rögzített elsődleges). Érthető, de egy idősebb felhasználónál kérdést vethet fel, melyiket nyomja.
- **A pala közel áll a Kontist/N26 sötét kékeszöldjéhez.** Szürkébb és menta nélküli, de a sötét előtér-képernyőkön a rokonság érezhető.
- **A Sofia Sans kissé „technikai”.** A szűkített címek határozottak, de nem melegek. A melegséget most a szöveg és a könyvelő hangja adja, nem a betű.
- **Nincs sötét mód.** Az előtér sötét, a napi képernyőkhöz nem készült sötét változat.
- **Nincs webes nézet.** A rendszer 720 px-es oszlopba átvihető, de nem rajzoltam meg.
- **Kérdés a tulajnak:** maradjon-e a „Befizettem” önbevallás (a megerősítés őszintén „Felírtuk”-ot mond), vagy várjunk a bankszámla-kapcsolatig.
