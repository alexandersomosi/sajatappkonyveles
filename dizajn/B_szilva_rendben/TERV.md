# B: Szilva (munkanév: Rendben), második kör

2026-11-17. Ez a „nyugodt privátbankos irány” legcsendesebb változata. Sötét felület nincs. A második kör a bírálatra válaszol. Az első kör baráti fogyasztói fintech-készletnek hatott lilában, egy giccses szárazpecséttel, és a „rád vár”, a „folyamatban” meg a „kész” ugyanúgy nézett ki benne.

Az irány ugyanaz maradt:
- szilva márkaszín;
- fehér lapok színes alapon;
- ami pirula, azt meg lehet nyomni, ami szögletes, az tartalom;
- a „Rendben” név;
- csendes szöveg.

Ami változott:
- **Hideg kőszürke alap.** A szilva így tintának hat, nem rózsaszínnek.
- **Talpas betű.** Ez kapja a szójelet, a képernyőcímeket és az összegeket.
- **Egy figyelemszín, az okker.** Egyetlen jelentése van: „rád vár”.
- **Kiment a pecsét és a szegmenssor.**

## Fájlok

| Fájl | Mi ez |
|---|---|
| `tokens.css` | Az összes token és komponens. Mind a hét képernyő ezt az egy fájlt használja. |
| `ikonok.js` | Kézzel rajzolt SVG-ikonok (24 px-es rács, 1,7 px-es vonal) és a könyvelő arcképének kézzel rajzolt helyőrzője (`#i-portre`). Itt van a „Másolás → Kimásolva” viselkedés is. |
| `fonts/` | Schibsted Grotesk 400/500/600/700 (`OFL.txt`) és Source Serif 4, változó betű, opsz 8–60, wght 200–900 (`OFL-SourceSerif4.txt`). Mindkettő SIL OFL 1.1, a Google Fonts gyűjteményéből, helyben. |
| `01_belepes` … `07_beadott_tetel` (.html + .png) | A képernyők 390×844 CSS px-en, @2x (780×1688). A `_teljes.png` a végiggörgetett hossz. |
| `_attekintes.png` | Mind a hét képernyő, alattuk a hunyorítás-próba. |
| `_hunyoritas/` | Minden képernyő GaussianBlur 6-tal. |
| `_eszkozok/` | `kep.py` (fej nélküli Chrome-fotó), `kontraszt.py` (WCAG-számítás, frissítve), `kontakt.py` (áttekintő lap). |
| `_proba/` | `betu_proba_2.png`: a talpas betű ő/Ő/ű/Ű-próbája. Az első körből ott maradt a pecsét- és az ujjlenyomat-próba. |
| `pecset.js` | **Nem használt.** Az első kör szárazpecsétje. Nem töröltem, a fejében megjegyzés jelzi, hogy kivezettük. |

## A mintahelyzet

A számok mintaszámok, nem adótanácsok. Szabó Kata főállású grafikus, átalányadós, 40%-os költséghányaddal. Könyvelője Kovács Bence. A „ma” 2026. december 2., szerda.

- **Idei bevétel novemberig:** 8 420 000 Ft. Az alanyi adómentesség 20 000 000 Ft-os határából még 11 580 000 Ft maradt (42%).
- **Adómentes rész:** a minimálbér éves összegének fele, 1 936 800 Ft jövedelem. Áprilisban elfogyott.
- **Fizetendő január 12-ig:** tb-járulék 219 780 Ft, szocho 154 440 Ft, szja-előleg 178 200 Ft, összesen 552 420 Ft. Ez a negyedik negyedév október–novemberi része.
  - Március 16-ig jön még az iparűzési adó első fele az önkormányzatnak: 60 600 Ft.
- **NAV-számlaszámok:** a nyilvános beszedési számlák formáját követik. Élesítés előtt a NAV hivatalos listájából kell átvenni őket.
- **November, 2 dolog vár Katára:**
  - a novemberi bankszámlakivonat (Bence december 1-jén kérte);
  - a 12-es sorszámú papírszámla újrafotózása, mert nem látszik rajta az összeg. Ez kiállított számla, tehát bevétel, és számít. A tankolási nyugtát kivettük, mert az 05-ön Bence épp azt mondja, hogy a vásárlások átalányadósnál nem számítanak.
- **Többi novemberi tétel:** 3 tétel Bencénél van, a többi kész.
- **Lezárt hónapok:** az október november 4-én zárult. A szeptembert és a korábbiakat a hónapválasztó pipája jelzi.
- **Bekötés (02):** szeptember 9-én látszik így. A videóhívás szeptember 10-én van.

## Színek

| Token | Érték | Szerep |
|---|---|---|
| `--szilva` | #4B1F45 | Márka. Elsődleges gomb, szójel, aktív fül, kiválasztott hónap, kész lépés pipája, mérő. |
| `--szilva-szoveg` | #6A2D61 | Szöveges gomb, vissza-link. |
| `--alap` | #DFE1E3 | **Hideg kőszürke háttér** (az első körben #E6E2E8 volt, az mályvának, „szépségszalonnak” hatott). A fehér laphoz képest 1,31:1. Nem krém, nem lila. |
| `--lap` | #FFFFFF | Lapok. |
| `--halvany` | #F3EAF1 | Kész lépés köre, saját üzenet, a „Kimásolva” gomb kitöltése. |
| `--tinta` | #241A23 | Minden törzsszöveg, számlaszám, összeg, a fizetési mondat. |
| `--masod` | #5E5B63 | Másodlagos szöveg (semlegesebb lett, nem szilvás szürke). |
| `--vonal` | #E3E4E7 | Hajszálvonal a lapon. |
| `--ures` | #CBCED3 | Mérő alja, a még nem kész lépés pöttye. |
| `--mezo-keret` | #858891 | Mező kerete, sor nyila, hónap-pirula kerete. |
| `--csempe` | #EEEFF1 | Ikoncsempe, az elmaradó lépés köre. |
| `--figyel` | #8A5A00 | **Okker, egyetlen jelentése: RÁD VÁR.** Pötty, állapotmondat, számjelvény a Dosszié fülön. Másra nem használjuk. |
| `--veszely` | #B42318 | Hiba, veszélyes művelet. |

Árnyék nincs sehol (a pecséttel együtt az egyetlen árnyék is kiment).

## Betű

Két család, világosan elkülönülő szereppel. Mindkettőnél kirajzoltam és megnéztem az ő, Ő, ű, Ű betűt (`_proba/betu_proba_2.png`). A Source Serif 4 a 400-as, 500-as és 600-as vastagságon is a helyes kettős ékezetet rajzolja. A cmap-ellenőrzés szerint megvan a U+202F (keskeny nem törő szóköz) és a U+2009 is. A Schibstedből ez a kettő hiányzik, ezért az összegek számcsoportjai most a talpas betűből jönnek, nem tartalék betűből.

**Source Serif 4** (talpas, visszafogott szövegbetű, optikai mérettel):
- **Szójel:** „Rendben.” 48/52, 600-as, opsz 60, szilva. A pont a név része. Ez az egyetlen hangos elem az appban.
- **Cím:** 32/38, 500-as. „Szia, Kata!” és „Dosszié”, így a két képernyő első ránézésre is különbözik.
- **Cím 2:** 26/32, 500-as. A tétel címe.
- **Fizetési mondat:** 24/30, 500-as, egészében tinta. Az összeg nincs kiemelve, mert az egy kiemelt szó a címben AI-jel.
- **Összeg a sorokban:** 18/23, 500-as, táblázatos és bélés számjegy.
- A „Ft” ugyanakkora és ugyanolyan színű, mint a szám, rendes (nem törő) szóközzel. A 0,76-os szürke „Ft” kiment.

**Schibsted Grotesk** (minden más):

| Szint | Méret | Vastagság |
|---|---|---|
| Alcím (pl. könyvelő neve) | 20/26 | 600 |
| Törzs | 17/24 | 400 |
| Szakaszcím az alapon | 17/22 | 600 |
| Állapotmondat, másodlagos | 15/20 | 400 (rád vár: 500, okker) |
| Fülfelirat | 13/16 | 500 (aktív: 600) |
| Gomb | 17 / 16 / 15 | **600** (az első körben 700 volt) |

## Formák

- **Lap:** 16 px-es sarok, fehér, keret és árnyék nélkül, 16 px-re a képernyő szélétől.
- **Lapon belül kisebb sarok:** mező 10 px, bélyegkép és ikoncsempe 6 px, buborék 16 px (a beszélő felőli alsó sarok 6 px). Nincs mindenhol ugyanaz a sarok.
- **Gomb:** mindig pirula. Az elsődleges 48 px (54 helyett), a másodlagos 44 px, a kis gomb a sorban 36 px (a lenyomható terület 44 px).

## Komponensek

**Állapotmondat (a szegmenssor helyett).** Egy jel és egy mondat, a lista minden során:
- **okker pötty + okker mondat** = rád vár („Bence kérte december 1-jén.”);
- **szürke óra + szürke mondat** = Bencénél van („Bencénél van, november 18-án látta.”);
- **szilva pipa + szürke mondat** = kész („Kész, beadni nem kell.”).

A kész állapot pipát kap, nem színt. A 4 szegmenses csík a listákból teljesen kiment. A négy lépés csak a tétel lapján (05, 07) látszik, idővonalként.

**Rád vár.** Ugyanazzal a névvel és ugyanazzal a két tétellel jelenik meg a főoldalon (03), a dossziéban (04) és a bekötésnél (02). A sorban:
- balra a hiányzó irat szaggatott helye, vagy az újrafotózandó kép bélyege;
- középen a cím és az okker állapotmondat;
- jobbra a művelet (40 px-es másodlagos pirula).

A Dosszié fülön okker számjelvény mutatja, hány dolog vár (2), a főoldal fejlécében pedig okker pötty áll a mondat előtt.

**Idővonal.** Csak valódi sorrendnél használjuk (bekötés, egy tétel útja). Egyik állapot sem hasonlít választógombra:

| Állapot | Jel |
|---|---|
| Kész | halvány kör, szilva pipa, alatta szilva összekötő |
| Most | kitöltött szilva kör, benne fehér óra |
| Később | kis szürke pötty, kör nélkül |
| Elmarad („Beadni nem kell”) | szürke csempe-kör „–” jellel, keret nélkül |

**Fizetési lap.**
- **Felül:** az első sor a címke („Ennyit kell fizetned”), alatta a talpas mondat, egészében tinta.
- **Egy rács, két oszlop:**
  - első sor: adónem és összeg;
  - második sor: számlaszám (tinta, 17 px, táblázatos) és a kis „Másolás” pirula másolás-ikonnal.
  - Az összegek és a gombok ugyanabban a jobb oszlopban, jobbra zárva állnak.
- **Másolás után:** halvány kitöltés, pipa és „Kimásolva”, 2 másodperc múlva visszaáll. A mintán a tb-járulék sora ebben az állapotban látszik.
- **Közlemény:** ugyanígy épül fel. Utána a „Befizettem” másodlagos pirula, mert decemberben még nem ez a fő teendő. Legalul egy mondat jelzi, mi jön még és kinek.

**Hónapválasztó (04).** Vízszintesen görgethető pirulák, a régebbi hónapok balra kilógnak a képből: ebből látszik, hogy van még. Ez váltja ki az első kör „Korábbi hónapok” lapját és a pecsétet.
- A lezárt hónap pirulájában kis szilva pipa áll.
- A kiválasztott hónap szilvával kitöltött.
- A rád váró hónapban okker pötty van, fehér gyűrűvel.

**Lezárva / beadva (a pecsét helyett).** Lapos, egyszínű szilva pipa körben (`#i-kor-pipa`) és egy mondat: „Beadva november 10-én / A NAV még aznap visszaigazolta.” Nem utánoz hivatalos bélyegzőt.

**A könyvelő arcképe.** Élesben Bence saját fényképe kerül ide (ő adja, nem generált). A mintában kézzel rajzolt, színtelen, szürke mellkép a helyőrző (`#i-portre`), hogy ne lehessen valódi embernek nézni. Monogram („KB”) nincs.

**Belépés (01).**
- Felül a szójel és egy rövid sor: „Saját könyvelő egyéni vállalkozóknak.” Az ár innen kiment, a regisztrációhoz tartozik.
- Utána a lap: e-mail, jelszó (a „Mutasd” helyett szem-ikonos gomb), „Elfelejtettem a jelszavam”, „Belépés”.
- Alatta két másodlagos pirula: „Belépés Apple-fiókkal”, „Belépés Google-fiókkal”. A „vagy” elválasztó kiment.
- Legalul balra zárva: „Még nincs fiókod? Regisztrálok”.
- Az ujjlenyomatos megjegyzés kiment. Az a belépés utáni kérdésbe tartozik.

**Szöveges gomb.** 600-as, 1 px-es aláhúzás, 4 px eltolással (az első körben 700-as és 1,5 px volt). Képernyőnként legfeljebb kettő van. A soron belüli műveletek (Másolás, Letöltés, Megnyitás) már kis pirulák, nem aláhúzott szövegek.

**Fejléc nélküli lapok.** Ahol a lap első sora megmondja, miről szól, nincs fölötte cím:
- fizetés: „Ennyit kell fizetned”;
- határok: „Idén még…”;
- könyvelő: „Kovács Bence, a könyvelőd”;
- videóhívás: „Videóhívás Bencével”;
- megjegyzés: „Bence megjegyzése”.

Szakaszcím ott maradt, ahol több sort fog össze (Rád vár, Számláid a NAV-ból, Feltöltötted, Bence intézte, Hol tart?, Iratok).

## Kontraszt (WCAG 2.x, `_eszkozok/kontraszt.py`)

| Előtér | Háttér | Arány | Követelmény |
|---|---|---|---|
| Tinta #241A23 | lap / alap | 16,84 / 12,84:1 | törzs ≥ 7 ✔ |
| Másodlagos #5E5B63 | lap / alap / csempe | 6,66 / 5,08 / 5,79:1 | ≥ 4,5 ✔ |
| Szilva szöveg #6A2D61 | lap / alap | 9,72 / 7,41:1 | ≥ 4,5 ✔ |
| Szilva #4B1F45 | lap / halvány (Kimásolva) | 13,28 / 11,29:1 | ≥ 4,5 ✔ |
| Fehér | szilva gomb | 13,28:1 | ≥ 4,5 ✔ |
| Okker #8A5A00 | lap / alap | 5,93 / 4,52:1 | ≥ 4,5 ✔ (az okker mondat mindig lapon áll) |
| Fehér | okker jelvény | 5,93:1 | ≥ 4,5 ✔ |
| Veszély #B42318 | lap | 6,57:1 | ≥ 4,5 ✔ |
| Mezőkeret, sornyíl #858891 | lap / alap | 3,54 / 2,70:1 | nem szöveg ≥ 3 a lapon ✔. Az alapon álló hónap-pirulát a felirata azonosítja. |
| Lap | alap | 1,31:1 | csoportosítás (az első körben 1,28) |

## Hunyorítás-próba (GaussianBlur 6, `_attekintes.png` alsó sora)

- A fehér lapok mind a hét képernyőn külön foltok a kőszürke alapon.
- Az elsődleges gomb mindenhol a legsötétebb, legnagyobb folt. A pirulák kerete elmosva is gyűrű, a sorokból nem lesz gomb.
- A „Rád vár” sorok okker pöttyei elmosva is kis meleg foltok maradnak a hideg szürkében. Ez az egyetlen meleg szín a képen, ezért magától odavonzza a szemet. A Dosszié fül jelvénye ugyanígy látszik.
- A szegmenscsíkok és a pecsét, vagyis a két „piszkos folt” eltűnt.

## Önkritika és nyitott kérdések

- **A kiválasztott hónap pirulája szilvával kitöltött.** A 04-en így két kitöltött szilva elem van (a hónap és a ragadós „Bizonylat feltöltése”). A méret és a hely elválasztja őket, de ha a tulaj szerint összekeverhetők, a kiválasztott hónap lehet fehér, szilva kerettel.
- **A „Rád vár” sorban az okker mondat két sorba törik,** mert jobbra ott a gomb. Rövidebb mondat („Kérte dec. 1-jén.”) elférne egy sorban, de kevésbé emberi.
- **A dátum logikája:** a főoldal decemberben a január 12-i befizetést mutatja. A negyedéves összeg valójában csak december 31. után végleges. Élesben novemberig „eddig összegyűlt” összeg kell, a „Befizettem” pedig januárban legyen elsődleges gomb. A mintában ezért másodlagos.
- **A csevegés teteje** a fejléc alatt levágott buborékkal indul. Ez görgetett beszélgetésnél természetes, de állóképen hibának tűnhet.
- **Az arckép-helyőrző** szándékosan szürke és jellegtelen. Bence valódi fotója nélkül a „valódi könyvelő” ígérete gyengébb, ezért élesítés előtt kötelező.
- **Apple és Google gomb:** márkalogó nélkül, csak felirattal készült. Élesben mindkét cég előírja a saját gombképét.
- **A talpas betű** 1,2 MB-os változó fájl. Élesben részhalmazolni kell (latin + Latin Extended-A), és woff2-ként betölteni.
- **Nem készült el:** a webes változat, a sötét mód, a Fiók fül, a regisztráció (ide költözik az ár), a veszélyes megerősítő lap és a 80%-os figyelmeztetés képe.

## Az első kör tanulsága (rövid napló)

1. A szárazpecsét giccses és hivatalos hatású volt, és elmosódott. Kiment, a helyén lapos pipa és egy mondat áll.
2. Csak szilva volt, nem volt „rád vár” jel. Bejött az okker, és csak ezt az egy dolgot jelenti.
3. A 4 szegmenses csík nem volt érthető, és ellentmondott a mondatnak. Kiment, a helyén jel és mondat áll.
4. A másolás volt a leggyengébb elem. Most tinta számlaszám, kis pirula, egy oszlop, „Kimásolva” visszajelzés.
5. A főoldal sorrendje fordított volt. Most az állapot jön a fejlécben, aztán a Rád vár, a fizetés, végül a többi.
6. A tankolási nyugta ellentmondott a 05-nek. Most a 12-es papírszámla szerepel a helyén.
7. A bekötés idővonala rádiógombnak látszott. Most kitöltött kör órával, a későbbi lépések szürke pöttyök.
8. SaaS-kártyakészlet volt. A 04-en 7 szakaszból 4 lett, mindenhol kevesebb a fejléc, és a sarkok hierarchiát követnek.
9. Sablonos elemek voltak benne. Kiment a monogram, a dátumcsempe, a „vagy” elválasztó, a szilva összeg a címben, a kicsi szürke „Ft” és a vesszővel fűzött meta-sorok („2025, PDF, 1 oldal”).
10. Nem hatott privátbanknak. Most kőszürke alap, talpas cím és összeg, 48 px-es gomb, 600-as felirat, 500-as cím és egy erős szójel van benne.
