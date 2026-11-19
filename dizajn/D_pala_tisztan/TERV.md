# Tisztán (D: Pala és kockás lap) – tervezési rendszer, 2. kör

2026-11-17. A „nyugodt privátbankos irány” D változata, hat (plusz egy) telefonképernyőn. Az ötlet változatlan: minden összeg mellett ott van, hogyan jött ki. A 2. kör a bírálat alapján csendesebb, melegebb és emberibb lett: egy világos rendszer mindenhol, színezett háttéren fehér lapokkal, kevesebb félkövérrel, egy kis sárgaréz árnyalattal és a könyvelő arcával.

A számok mintaszámok, nem adótanácsok. A NAV-számlaszámokat (SZJA 10032000-06056353, TB 10032000-06055912, szocho 10032000-06055802) élesítés előtt a NAV oldalán ellenőrizni kell. A 8412345678 adóazonosító szándékosan érvénytelen (rossz az ellenőrző számjegye).

## 2. kör: mi változott és miért

Az 1. kör teljes állapota (HTML, CSS, JS, PNG, TERV, hunyorítási kép) változatlanul megvan a `_elozo_v1/` mappában, hogy össze lehessen vetni.

**Rendszer**
- **Nincs több sötét képernyő.** A belépés, a bekötés és a befizetés megerősítése is világos lett. A teljes képernyős sötét pala volt a legjobban „neobankos” (Kontist/N26-közeli) döntés, és két külön appnak hatott a napi képernyők mellett.
- **Világos alsó sáv**: fehér, felül hajszálvonal, az aktív fül pala, alatta vonás. A navigáció már nem a leghangosabb elem, és a dosszié rögzített sötét feltöltés-gombja nem olvad bele.
- **Egy kevés melegség**: tompa sárgaréz (#9C7A3C jelnek, #7A5C24 szövegnek), csak három helyen: a befizetési határidő, a folyamatban lévő lépés, és „a könyvelőd” sor. A háttér nem változott (krém nincs, terrakotta nincs).
- **Különböző sarkok**: lap 16, gomb 10, mező 8 px. Az 1. körben minden 14 px volt, ezért a lap, a gomb és a mező egy kaptafára készültnek tűnt.
- **Kevesebb félkövér**: blokkonként egy kiemelt sor. A szakaszcím 15 px-es, normál vastagságú, szürke. A sorcímek normálak. A gombok 600-as, a szöveges gombok 500-as vastagságúak (az 1. körben minden 700 volt).
- **Szöveges gombok**: vékony, 1 px-es aláhúzás, és kevesebb van belőlük. A számlaszám másolása ikon és egy szó („Másolom”), aláhúzás nélkül, utána „Kimásoltad” pipával.
- **A gombok első személyben beszélnek**: Belépek, Megmutatom, Feltöltöm a kivonatot, Megnézem nagyban, Letöltöm, Másolom, Igazolást kérek, Változást jelentek, Másik időpontot kérek.
- **Címek**: Sofia Sans 600, 24–26 px, enyhén szűk betűközzel. A szűkített Sofia Sans Condensed csak pénzösszegre maradt (a fizetési mondat és a befizetett összeg). Az „Október”, „Dosszié”, „Szia, Kata!” már nem sportos szűkített fekete.
- **A dupla vonal csak a számolásban** szerepel (a végösszeg alatt, ahogy a könyvelésben is). A szóvédjegy és a 07-es összeg alól eltűnt.
- **A könyvelő arca**: a szürke „KB” monogram helyett álló, 4:5-ös fotókeret (8 px-es sarok, vékony belső keret). Élesben Bence valódi fotója kerül bele. A próbaképeken saját rajzú, egyszerű helykitöltő látszik (nem AI-kép, nem stockkép). Mellette a szerep: „Kovács Bence, a könyvelőd” vagy „mérlegképes könyvelő, 12 éve könyvel”. A neve a főoldal és a chat fejlécében is ott van.
- **Állapotsáv**: nagyobb szegmensek (18 × 5 px), az üres szegmens sötétebb (#A9B8BB), és mellette mindig ott a szó. Az állapotszöveg megmondja, ki csinálta: „Bence látta”, „Bence feldolgozta”, „Bence beadta”.
- **Legkisebb betű 15 px** mindenhol (időbélyeg, lábjegyzet, fül felirata is). Az 1. körben 12,5–14,5 px-es szövegek is voltak.
- **Kockás rács**: halványabb (#E2EAEC), 14 px-es kockák, egy számolási sor két kocka (28 px). Az 1. körben a 18 px-es sorok szűkek voltak egy 60 év feletti szemnek.

**Képernyőnként**
- **01 Belépés**: világos; a mező fehér, keretes, 8 px-es sarokkal, a „Belépek” az egyetlen kitöltött pala tömb, így nem keverhető a mezőkkel. Az ujjlenyomatos doboz kikerült (itt semmit nem csinált); az első belépés után kérdezünk rá: „Legközelebb beléphetsz ujjlenyomattal vagy arcfelismeréssel.” A külső belépés: „Belépek Google-fiókkal”, „Belépek Apple-fiókkal” (élesben a cégek saját gombjával). A „vagy” elválasztó eltűnt. Új szlogen: „Saját könyvelőd van, és minden befizetésnél látod, miből jött ki az összeg.”
- **02 Bekötés**: a teendő („Neked most ez a dolgod”) közvetlenül a cím alá került. A lépések azt mondják, ki mit csinált: Aláírtad a meghatalmazást, Igazoltad magad, Bence bejelent a NAV-nál (jobbra: „most intézi”), A számláid maguktól jönnek, Bence átveszi a könyvelést. A lépéssor vékony és világos: pipa, sárgaréz kör, üres kör, korongok és összekötő vonal nélkül. Alcím: „Ennyi van hátra, és Bence átveszi a könyvelésedet.” Videóhívás: Bence arcképével, „mire van szüksége tőled”, „Másik időpontot kérek”.
- **03 Főoldal**: az „Október” cím eltűnt, a fizetési mondat a képernyő legnagyobb szövege (32 px). Felül „Szia, Kata!”, alatta Bence arcképe, sárgaréz sorban a neve, mellette a hír. A határidő külön sárgaréz sor órával: „Hétfő a határidő, még 4 napod van.” Csak a befizetési lap kap különleges kezelést: pala árnyalatú árnyékot. A határmérők lap nélkül, közvetlenül a háttéren állnak. A „Bence kéri” lapról lekerült a „tegnap, 16:05”, a számolás fejlécéről a „július–szeptember” (helyette „Bevétel a negyedévben”), a „Fizetendő, forintban” rövidebb lett. Az alsó „A könyvelőd” lap kimaradt, mert Bence már a fejlécben ott van.
- **04 Dosszié**: világos alsó sáv, ezért a rögzített „Feltöltök egy fotót vagy fájlt” az egyetlen sötét tömb. A „maguktól jönnek” megjegyzés kikerült. A tételcímek normál vastagságúak, csak a hiányzó tétel kiemelt.
- **05 Tétel**: a fotón fényátmenet, a keret eltűnt, így inkább fénykép, mint rajz. „Megnézem nagyban”, „Letöltöm” (ikonnal), „Kérdezek erről”. A története vékony lépéssor: Feltöltötted, Bence látta, Bence feldolgozta, Bence beadja (januárban). Bence megjegyzése az arcképével.
- **06 Üzenetek**: fehér fejléc Bence arcképével, nevével, képesítésével és válaszidejével. A három kérésgomb helyett kettő, első személyben: „Igazolást kérek” (utána választható: jövedelemigazolás, nullás vagy köztartozásmentes igazolás) és „Változást jelentek”. A fejléc és az üzenetek között a háttér látszik, az üzenetlista teteje elhalványul, így fehér buborék sosem ér fehér panelhez. Az író sáv a háttéren ül, a mező fehér és keretes.
- **07 Befizetve**: világos. Az összeg aláhúzás nélkül. A „Felírtuk.” nem félkövér, Bence arcképe mellett áll.

## Fájlok

| Fájl | Mi ez |
|---|---|
| `tokens.css` | Közös tokenek és elemek, minden képernyő ezt tölti be |
| `kozos.js` | Kézzel rajzolt ikonkészlet (SVG), az arckép helykitöltője, állapotsor, világos alsó sáv, „Másolom” → „Kimásoltad” |
| `01_belepes.html/.png` | Belépés |
| `02_bekotes.html/.png` | Bekötés állapota regisztráció után |
| `03_fooldal.html/.png` + `03_fooldal_teljes.png` | Főoldal, a kockás számolással |
| `04_dosszie.html/.png` + `04_dosszie_teljes.png` | Októberi dosszié |
| `05_tetel.html/.png` + `05_tetel_teljes.png` | Egy tétel: lefotózott nyugtatömb, története, Bence megjegyzése |
| `06_uzenetek.html/.png` | Chat Bencével, két kérésgombbal |
| `07_befizetve.html/.png` | Ráadás: a „Befizettem” utáni megerősítés |
| `attekintes.png` | Mind a hét képernyő egymás mellett |
| `_proba/` | Betűpróbák (`betuproba2.png`: 400/500/600 és Condensed 600), arckép-próba (`portre_proba.png`), hunyorítási próba, a fotózó és a kézírás-rajzoló szkript |
| `_elozo_v1/` | Az 1. kör teljes állapota, összevetéshez |

A PNG-k 390×844 CSS px-es képernyők 2×-es felbontásban (780×1688), fejetlen Chrome-mal, lövésenként külön profillal. A `_teljes` képek a görgetett tartalom egészét mutatják.

## Időrend a képernyőkön (eltérés a feladattól)

A feladat novemberi dossziét és novemberi kivonatot kért, a D irány viszont a harmadik negyedéves, október 12-i befizetést mutatja. A kettő nem fér össze: átalányadónál a befizetés negyedéves, novemberben nincs mit fizetni. Ezért minden képernyő ugyanazt a pillanatot mutatja: **2026. október 8., csütörtök**.

- Bence október 7-én beadta a harmadik negyedéves bevallást, a fizetendő 820 260 Ft, határidő október 12. (hétfő, még 4 nap).
- Bence a **szeptemberi** bankszámlakivonatot kéri, csak ellenőrzésre.
- A dosszié az **októberi** mappa. A tétel feltöltése **10.03.**, a története: feltöltötted → Bence látta → Bence feldolgozta, a beadás januárban következik.
- A bekötés (02) szeptember végén történt, a videóhívás október 2-án volt.
- A 07 a befizetés napját (október 12.) mutatja.

Ha mégis november kell, csak a dátumokat és a hónapneveket kell átírni, a szerkezet ugyanaz.

## Tokenek

### Színek

| Token | Hex | Mire |
|---|---|---|
| `--pala` | #2A4E57 | Márka, elsődleges gomb, szöveges gomb, másodlagos gomb kerete, mérő kitöltése, aktív fül, pipa |
| `--pala-mely` | #1D373E | Megnyomott elsődleges gomb |
| `--alap` | #DAE3E5 | Háttér minden képernyőn (1,30:1 a fehérhez képest) |
| `--lap` | #FFFFFF | Fehér lap, alsó sáv, a chat fejléce |
| `--racs` | #E2EAEC | A kockás lap vonala |
| `--racslap` | #FCFDFD | A kockás lap alapja |
| `--tinta` | #132326 | Szöveg |
| `--masod` | #536569 | Másodlagos szöveg fehér lapon, inaktív fül |
| `--masod-alap` | #44575B | Másodlagos szöveg és szakaszcím a háttéren |
| `--hajszal` | #D3DDDF | Hajszálvonal a lapon |
| `--hajszal-alap` | #BCC9CC | Hajszálvonal a háttéren, az alsó sáv és a rögzített sávok teteje |
| `--halvany` | #E8EEF0 | Megnyomott sor |
| `--sajat` | #BFD1D6 | A saját üzeneted buboréka |
| `--ures` | #A9B8BB | Üres állapotszegmens, várakozó lépés köre |
| `--palya` / `--palya-alap` | #DCE5E7 / #B9C7CA | A mérő pályája lapon / a háttéren |
| `--rez` | #9C7A3C | Sárgaréz jel: a határidő órája, a folyamatban lévő lépés köre, olvasatlan-pont |
| `--rez-szoveg` | #7A5C24 | Sárgaréz szöveg: határidő, „most intézi”, „Kovács Bence, a könyvelőd” |
| `--hiba` | #B42318 | Veszélyes művelet, hiba |
| `--figy` | #8A5A00 | „Hiányzik, Bence kérte” |

Mezőkeret és nyíl: #7C8E92 (3,4:1 a fehérhez).

A sárgaréz szigorúan három helyen él: határidő, folyamatban lévő lépés, „a könyvelőd” sor. A „Hiányzik” barna (#8A5A00) a rokona, de mindig szóval és állapotsávval együtt jelenik meg.

### Betűk

Egy betűcsalád két szélességben, mindkettő OFL licencű, a Google Fontsról:

- **Sofia Sans** 400/500/600: minden szöveg, cím, gomb és a számolás számai. Összegnél listában és számolásban `tabular-nums lining-nums`, az ezreseket keskeny, nem törő szóköz (U+202F) választja el.
- **Sofia Sans Condensed** 600: csak pénzösszeg: a fizetési mondat a főoldalon és a befizetett összeg a 07-en. Ezekben arányos számjegy (`proportional-nums`), mert a táblázatos számjegy a szűkített betűben foghíjas.

Ellenőrzés: `_proba/betuproba2.png` (2026-11-17, 2. kör): az ő, Ő, ű, Ű kettős ékezete helyes 400-as, 500-as és 600-as Sofia Sans-ban és 600-as Condensedben, 64 px-en is megnézve. Mind a négy vastagság a saját betűből töltődött be (a lap alján a betöltött betűk listája). Az 1. kör ellenőrzése (`_proba/betuproba*.png`) az U+202F, −, ×, „ ” és › jelekre továbbra is érvényes.

### Típusskála

| Szerep | Betű | Méret / sorköz | Vastagság |
|---|---|---|---|
| Fizetési mondat (a legnagyobb szöveg a főoldalon) | Condensed | 32 px / 1,1 | 600 |
| Befizetett összeg (07) | Condensed | 46 px / 1,0 | 600 |
| Szóvédjegy (01) | Sans | 34 px / 1,0, −0,02 em | 600 |
| Képernyőcím („Dosszié”, „Befizetve”, „Szia, Kata!”) | Sans | 24–26 px / 1,15–1,2, −0,01 em | 600 |
| Hónap, időpont | Sans | 19–21 px | 600 |
| A lap fő sora (blokkonként egy) | Sans | 17 px / 1,35 | 600 |
| Szöveg, sorcím | Sans | 17 px / 1,3–1,45 | 400 |
| Gomb | Sans | 16–17 px | 600 |
| Szöveges gomb | Sans | 16 px | 500 |
| Szakaszcím a háttéren | Sans | 15 px / 1,3 | 400, szürke |
| Másodlagos szöveg, időbélyeg, fül felirata | Sans | 15–16 px | 400 |
| Számolás: szám / címke | Sans | 17 / 16 px, sor = 28 px | 400, végösszeg 600 |

A legkisebb betű 15 px.

### Térközök és formák

- Oldalmargó 16 px. A háttéren álló szöveg (cím, szakaszcím, mérők) a lap szélétől 4 px-re kezdődik.
- Lapon belüli margó 18 px. Ennek oka a rács: 18 + 23 × 14 + 18 = 358 px, így a számok jobb széle rácsvonalra esik.
- Sarkok: lap 16 px, gomb 10 px, mező 8 px, arckép 7–9 px.
- Szakaszok között 26 px, lapok között 10 px.
- Alsó sáv 86 px, a tartalom alján 120 px tartalék.

## Elemek szabályai

**Háttér és lapok.** Minden képernyőn hideg szürkéskék háttér (#DAE3E5), rajta árnyék nélküli fehér lapok. Egy lap egy összetartozó csoport. Nem minden kerül lapra: a lépéssor (02) és a határmérők (03) közvetlenül a háttéren állnak. Egyetlen lap kap árnyékot, a főoldali befizetési lap (pala árnyalatú, nem szürke).

**Gombok.** Négy szint, egymással és a sorokkal sem keverhetők:
- **Elsődleges:** kitöltött pala, 54 px magas, teljes szélességű, 10 px-es sarok, képernyőnként egy. Ez a képernyő egyetlen sötét, kitöltött tömbje.
- **Másodlagos:** fehér, 1,5 px-es pala keret, 46 px magas, csak akkora, amekkora a felirata (pl. „Feltöltöm a kivonatot”, „Kérdezek erről”, „Igazolást kérek”). A háttéren is fehér, a kerete különbözteti meg a laptól.
- **Szöveges:** pala, 500-as vastagság, 1 px-es aláhúzás (pl. „Elfelejtetted a jelszavad?”, „Naptárba teszem”, „Megnézem nagyban”). Képernyőnként legfeljebb kettő.
- **Másolás:** ikon és egy szó, aláhúzás nélkül: „Másolom” → „Kimásoltad” (az ikon pipára vált, 2,2 másodperc múlva visszaáll).
- **Veszélyes:** piros, aláhúzott szöveg. A megerősítő lapon kitöltött piros elsődleges gomb (`.gomb.veszely-tele`). Ezeken a képernyőkön nem szerepel.
- **Kivételek:** a chat küldés-gombja 46 × 46-os kitöltött pala négyzet, mert ott ez az elsődleges művelet. A „‹ Október” visszalépés navigáció, nem gomb: nyíllal jelölt, aláhúzás nélküli pala szöveg.

**Sorok.** Kitöltés és keret nélkül, a lapon belül hajszálvonal választja el őket (18 px-es behúzással), jobbra kis nyíl. Megnyomva halványkék (#E8EEF0) lesz.

**Mezők.** Fehér, 1,5 px-es #7C8E92 keret, 8 px-es sarok, 52 px magas. A címke 15 px-es, 500-as.

**A könyvelő.** Álló, 4:5-ös keretben az arcképe (36×45, 44×55 vagy 52×65 px). Mellette sárgarézzel a szerepe („Kovács Bence, a könyvelőd”, „mérlegképes könyvelő, 12 éve könyvel”). Ott jelenik meg, ahol Bence szól vagy cselekszik: főoldal fejléce, videóhívás, tétel megjegyzése, chat fejléce, befizetés megerősítése. Élesben valódi fotó (a könyvelő adja), a helykitöltő rajz csak a próbaképeken van.

**Állapot.** Mindig szóval és 4 szegmenssel (18 × 5 px): feltöltve → Bence látta → Bence feldolgozta → Bence beadta. A NAV-ból jövő számlánál az első lépés neve „Megjött a NAV-ból”. A NAV-levélnél nincs folyamat, ott csak mondat van („Bence elolvasta: nincs teendőd.”). Ami rád vár, az barna félkövér („Hiányzik, Bence kérte”), halvány barna szegmensekkel. Színes, gomb alakú címke nincs.

**Lépéssor (02, 05).** Valódi sorrend, ezért függőleges lista. Kész: pala pipa korong nélkül. Folyamatban: sárgaréz kör ponttal, a neve 600-as, jobbra sárgaréz szöveg („most intézi”). Hátra van: üres szürke kör, szürke név. Összekötő vonal nincs.

**Pénz.**
- Az összeg és a határidő egy mondatban: „Október 12-ig fizess be 820 260 Ft-ot.” A szám és a „Ft-ot” nem törhet el egymástól. Alatta külön sor: „Hétfő a határidő, még 4 napod van.” (sárgaréz, órával).
- Minden adónemhez saját számlaszám tartozik „Másolom” gombbal, a közlemény (adóazonosító jel) mindháromnál ugyanaz.
- Listában a „Ft” kisebb és halványabb, mint a szám.

**Kockás számolás (a merész elem).**
- Csak a befizetési lapon szerepel, sehol máshol. 14 px-es rács, #E2EAEC vonal #FCFDFD alapon, a lap teljes szélességében. Egy sor két kocka (28 px).
- Bal oldalt a műveleti jel (−, =, ×), utána a címke, jobbra a táblázatos számjegyekkel szedett, rácsvonalra zárt szám.
- A részeredmény fölé, csak a számok alá egyszeres vonal kerül (1,5 px tinta), a végeredmény alá dupla vonal. A két számolási blokk között egy üres kocka van. A dupla vonal az egész appban csak itt fordul elő.
- Sorok: bevétel a negyedévben 2 940 000; − 40% költséghányad 1 176 000; = jövedelem 1 764 000; × 15% SZJA-előleg 264 600; × 18,5% TB-járulék 326 340; × 13% szocho 229 320; = fizetendő 820 260. Csak a végösszeg 600-as.
- Lábjegyzet a rácson: „Az adómentes részed már elfogyott, ezért most a teljes jövedelmed után jár SZJA.” Ez köti össze a számolást a lenti határmérővel.

**Mozgás.** Az egyetlen kiemelt pillanat: a számolás első megnyitásakor a sorok balról jobbra „íródnak” (`clip-path`, soronként 80 ms), utána a vonalak is behúzódnak. Ez negyedévenként csak egyszer történik meg (`localStorage`, hibatűrően), és `prefers-reduced-motion` esetén elmarad. Ezen kívül csak a felhasználó műveletére van mozgás.

**Határmérő.** 10 px magas sáv, pala kitöltés. A háttéren a pálya #B9C7CA. A 80%-nál egy tinta színű függőleges jel van, és a szöveg megmondja, mit jelent („A jelnél, 16 millió forintnál szólunk, hogy figyelj.”). A mérő fölött mindig egy teljes mondat áll, nem százalék.

**Alsó sáv.** Fehér, felül #BCC9CC hajszálvonal: Főoldal, Dosszié, Üzenetek, Fiók. Saját rajzú vonalikonok, 15 px-es felirat. Az aktív fül pala, 600-as, alatta 22 px-es pala vonás, így nem csak a szín jelzi. Az olvasatlan üzenet pontja sárgaréz.

**Ikonok.** Mind saját rajz (`kozos.js`), 24 × 24, 1,8 px-es lekerekített vonal. Új: másolás. A nyugta a 05-ön kézzel rajzolt SVG, a kézírás generált vonal (`_proba/keziras.py`), nem betűtípus. A Google és az Apple gombon nincs logó, éles appban a cégek saját gombkiírását kell használni.

**Szöveg.** Tegeződés, mondatkezdő nagybetű, nincs angol maradvány és nincs „→”. A gombok első személyben beszélnek, és ugyanazt mondják, mint az eredményük: „Befizettem” → „Befizetve”, „Másolom” → „Kimásoltad”. Az állapot megmondja, ki csinálta. A hibaüzenet azt mondja meg, mi a teendő. A könyvelő emberként beszél („Köszi, mind a négy nyugta jól olvasható.”).

## Kontraszt (WCAG 2.x)

| Szöveg | Háttér | Arány | Hol |
|---|---|---|---|
| Tinta #132326 | Lap #FFFFFF | 16,2:1 | minden törzsszöveg |
| Tinta #132326 | Rácslap #FCFDFD | 15,9:1 | számolás |
| Tinta #132326 | Alap #DAE3E5 | 12,4:1 | címek, mérők, hír a főoldalon |
| Tinta #132326 | Saját buborék #BFD1D6 | 10,3:1 | a te üzeneted |
| Másod #536569 | Lap #FFFFFF | 6,1:1 | másodlagos szöveg, inaktív fül |
| Másod #536569 | Rácslap #FCFDFD | 6,0:1 | lábjegyzet, műveleti jel |
| Másod-alap #44575B | Alap #DAE3E5 | 5,8:1 | szakaszcím, alcím, mérő felirata |
| Másod-alap #44575B | Saját buborék #BFD1D6 | 4,8:1 | időbélyeg a saját üzeneten (15 px) |
| Pala #2A4E57 | Lap #FFFFFF | 9,0:1 | szöveges és másodlagos gomb, aktív fül |
| Pala #2A4E57 | Alap #DAE3E5 | 6,9:1 | „‹ Október” |
| Fehér | Pala #2A4E57 | 9,0:1 | elsődleges gomb |
| Sárgaréz szöveg #7A5C24 | Lap #FFFFFF | 6,2:1 | „mérlegképes könyvelő”, határidő |
| Sárgaréz szöveg #7A5C24 | Alap #DAE3E5 | 4,8:1 | „Kovács Bence, a könyvelőd”, „most intézi” |
| Figyelmeztetés #8A5A00 | Lap #FFFFFF | 5,9:1 | „Hiányzik, Bence kérte” |
| Hiba #B42318 | Lap #FFFFFF | 6,6:1 | veszélyes szöveges gomb |

Minden szöveg legalább 4,5:1. A leggyengébb a 4,8:1 (sárgaréz szöveg a háttéren és az időbélyeg a saját buborékon), mindkettő 15 px-es.

Nem szöveges elemek: sárgaréz jel #9C7A3C a fehéren 4,0:1, a háttéren 3,1:1; mezőkeret és nyíl #7C8E92 3,4:1; másodlagos gomb kerete 9,0:1 (a háttéren 6,9:1); a mérő kitöltése a pályához 5,2:1. Az üres állapotszegmens (#A9B8BB, 2,1:1) és a „Hiányzik” halvány szegmense a 3:1 alatt van, de jelentést nem egyedül hordoznak: mellettük mindig ott a szó. A háttér és a lap között 1,30:1, ez csoportosításra szolgál.

## Hunyorítási próba

`_proba/hunyoritas.png`: mind a hét képernyő 6-os Gauss-elmosással (az 1. körös kép: `_elozo_v1/hunyoritas.png`). Elmosva is egyértelmű:
- a fehér lapok külön foltok a szürkéskék háttéren, a csoportok nem folynak egybe;
- képernyőnként egyetlen sötét, kitöltött téglalap van (Belépek, Feltöltöm a bevallásokat, Befizettem, a dosszié rögzített feltöltése, a küldés négyzete, Vissza a főoldalra), és az már nem olvad össze az alsó sávval;
- a belépésnél a mezők fehér, keretes sávok, a gomb sötét tömb, nem keverhetők;
- a másodlagos gombok keretes „gyűrűk”, a sorok határ nélküliek;
- a világos alsó sáv nem nehezebb a tartalomnál, a főoldalon a befizetési lap (árnyékával) a legerősebb folt.

Gyenge pont: a kockás rács elmosva eltűnik, a számolás szürke szövegtömbnek látszik. Ez szándékos: a rács közelről hat, nem messziről.

## Amit menet közben megváltoztattam

1. kör:
- **Számjegy kockánként.** Kipróbáltam, hogy minden számjegy külön kockába kerüljön. A „2 940 000” szétesett, ezért elvetettem.
- **Vonal csak a számok alatt.** Ha a vonal a teljes sort aláhúzza, a „költséghányad” g és y betűjének szára beleér.
- **A számolás animációja levágta a dupla vonalat** (`clip-path: inset(0)`). A végállapot most kifelé is enged teret.
- **Mezőkeret.** #9DB0B5-ről #7C8E92-re sötétítettem a 3:1 miatt.

2. kör:
- **Arckép.** Először arc nélküli sziluettet rajzoltam, de az pont olyan volt, mint egy alapértelmezett „nincs kép” ikon. Szűkebb kivágás (igazolványkép-szerű) és visszafogott arcvonások kellettek ahhoz, hogy 36–44 px-en is embernek látsszon (`_proba/portre_proba.png`).
- **A lépéssor összekötő vonala** a kész lépések között rövid szaggatott vonásoknak látszott, ezért kivettem. A lista sorrendje magában is elég.
- **A 02 nem fért ki.** A teendő-lapról kikerült az e-mailes mondat, a folyamatban lévő lépés leírása egy sorra rövidült.
- **Chat.** A fehér fejléc alá, a háttérre tettem az üzeneteket, a lista teteje 22 px-en elhalványul. A beszélgetés rövidebb lett, hogy a próbaképen ne kezdődjön levágott buborékkal.
- **Szűkített betű és táblázatos számjegy.** A Condensed táblázatos számjegyei foghíjasak („8 2 0 2 6 0”), ezért a nagy, magányos összegek arányos számjegyet kaptak. A listákban és a számolásban maradt a táblázatos.
- **„megvan-e”** a sor végén kötőjelnél tört, ezért nem törhet.

## Önkritika, nyitott kérdések

- **A főoldal még mindig hosszú** (a befizetési lap kb. 900 px). A „Befizettem” gomb az első képernyőn nem látszik. Ha ez zavar: a számlaszámok egy „Utalás adatai” lépésbe kerülhetnek, vagy a számolás a második megnyitástól csak a „Hogyan jött ki?” sorra csukódhat össze.
- **A helykitöltő arckép rajz.** A próbaképeken egyszerű, saját rajzú figura áll Bence helyén. Éles appba csak valódi fotó mehet (a könyvelőtől, a hozzájárulásával), különben az egész „valódi ember” ígéret hamis lesz.
- **Két feltöltés-gomb a dosszién** (a hiányzó kivonat sorában és alul a rögzített elsődleges). Érthető, de egy idősebb felhasználónál kérdést vethet fel, melyiket nyomja.
- **A sárgaréz szöveg és a „Hiányzik” barna rokonok.** Ha a gyakorlatban összekeverednek, a „Hiányzik” mehet a pirosba (#B42318), de az ijesztőbb.
- **A Sofia Sans kissé „technikai”.** A melegséget most a sárgaréz, Bence arca és a szöveg hangja adja, nem a betű.
- **Az „Igazolást kérek” után** még nincs megrajzolva a választó (jövedelemigazolás, nullás, köztartozásmentes), sem az első belépés utáni ujjlenyomatos kérdés.
- **Nincs sötét mód és nincs webes nézet.** A rendszer 720 px-es oszlopba átvihető, de nem rajzoltam meg.
- **Kérdés a tulajnak:** maradjon-e a „Befizettem” önbevallás (a megerősítés őszintén „Felírtuk”-ot mond), vagy várjunk a bankszámla-kapcsolatig.
