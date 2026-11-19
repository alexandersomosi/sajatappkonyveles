# Kézjegy: tintakék levélpapír (C változat)

2026-11-17, 2. kör. A „Nyugodt privátbankos irány” C változata, hat telefonképernyőn és egy elemlapon kidolgozva (390 × 844 CSS px, a képek @2x, 780 × 1688 px).

**Ötlet.** A könyvelő minden hónapban rövid levelet ír, és kék tollal aláírja, a fényképe mellett. Így a „valódi könyvelő, nem robot” ígéret az első képernyőn látszik. A feldolgozott irat részletein a könyvelő kék monogramja áll, ahogy a papíron is szignálják az iratot.

A számok mintaszámok, nem adótanácsok.

---

## A 2. kör változásai (a kritika alapján)

**Főoldal (03)**
- **Ellentmondás megszüntetve.** A levél már nem azt írja, hogy „minden számlád megvan”, hanem: „Kiszámoltam, mennyit kell most befizetned. Szeptemberből csak a kivonatod hiányzik.” A kérés (szeptemberi kivonat) és a dosszié „Szeptember” sora („Bevallás beadva, a kivonat hiányzik”) ezzel egyezik.
- **Hierarchia megfordítva.** A fejlécsáv címe a végösszeg (457 380 Ft, Caslon 46, a képernyő legnagyobb betűje), a mondata a határidő: „Október 12-ig (hétfő) utald el a NAV-nak.” A „Bence október 2-án levelet írt neked” mondat és az „Október” cím kikerült.
- **Három utalás külön blokkban:** megnevezés, összeg, számlaszám és saját „Másolás” gomb. Alattuk a közös közlemény, saját gombbal. A „Számlaszámok tételenként ›” sor megszűnt.
- **A „Befizettem” görgetés nélkül látszik** (a 844 px-es képen a fülsor fölött).
- A levél rövid lett: megszólítás, két mondat, Bence fényképe, neve, a dátum és a kisebb aláírás. A tételtáblázat átkerült az utalásokhoz, így nincs kétszer.
- A „Befizetés” szakaszcím kikerült. „Határok idén” helyett „Idei határaid”. A mérők címe most a köznapi mondat („Még 11 580 000 Ft-ot számlázhatsz ÁFA nélkül.”), a szakszó alatta, kisebben.
- A „Kérdésem van” a befizetési lap aljára került, a „Befizettem” és az emlékeztető mondat alá.

**Gombok**
- **A másodlagos gomb színezett lett, keret nélkül:** #D6E0F0 alap, tintakék felirat, ahol van értelme, ikonnal. A keretes gomb megszűnt. Elmosva is kék tömb marad, nem olvad bele a szövegbe, és nem hasonlít a mezőre (a mezőnek szürke kerete van).
- **A „Másolás” valódi gomb lett** (40 px magas, másoló ikonnal), minden érték mellett külön. A gomb a számmal egy vonalban áll, nem a felirattal. Megnyomás után zöldes alapon „Kimásolva” lesz, pipával (07).
- **Egy kérés, egy gombszint.** A kivonat kérése a főoldalon és a dossziéban is ugyanaz a színezett „Kivonat feltöltése” gomb. A dosszié egyetlen kitöltött gombja az „Új irat feltöltése”.

**Állapotok**
- A négy szegmenses csík megszűnt. Elöl mindig a négy szó egyike áll: **Feltöltve, Bence látta, Feldolgozva, Beadva**, utána a dátum.
- Kész (Feldolgozva, Beadva): **tompa zöld** teli kör pipával, a szó is zöld. Várakozik (Feltöltve, Bence látta): szürke óra, a szó tintaszínű.
- Az állapotsorok rövidek, nem törnek: „Feldolgozva, hétfőn”, „Feltöltve, tegnap”, „Feldolgozva, nincs teendőd”, „Beadva, október 2-án”.

**Monogram és fénykép**
- A KB monogram csak két helyen maradt: a tétel-részlet (05) „Feldolgozva” lépésénél és Bence megjegyzése alatt. A listasorokból és az avatarokból kikerült.
- Avatar helyett Bence **fényképe** áll (levél, videóhívás, üzenetek). A mintán ez egy kézzel rajzolt SVG-helyőrző; élesben a könyvelő valódi fotója kerül ide.

**A levél**
- Nincs „Budapest,” és jobbra zárt keltezés; a dátum a név alatt áll („könyvelőd, október 2.”).
- Nincs belső keretvonal. A levél sarka 4 px (papír), a többi lapé 12 px, így a levél nem még egy kártya.
- Az aláírás kisebb (112 × 42 px a korábbi 150 × 56 helyett).

**Szerkezet**
- **Nincs rálógó lap** egyik képernyőn sem. A sötét sáv egyenesen ér véget, a lapok 12–14 px-szel alatta kezdődnek.

**Belépés (01)**
- Nincs sötét sáv és rálógó kártya: a „Kézjegy” szóvédjegy az alapon áll, alatta egy lap a mezőkkel.
- A „Belépés” lapcím kikerült (a gomb ugyanezt mondja). Az ár kikerült innen, a regisztrációhoz tartozik. Helyette: „Könyvelés egyéni vállalkozóknak”.
- A „— vagy —” elválasztó helyett egy mondat: „Ha Google- vagy Apple-fiókkal regisztráltál:”. A gombok: „Belépés Google-fiókkal”, „Belépés Apple-fiókkal”, a két cég világos gombstílusában (fehér, a Google-é szürke kerettel), az alapon.
- Az ujjlenyomat-mondat kikerült. Az első belépés után egyszeri kérdésként jön elő.

**Bekötés (02)**
- Cím: „Még 2 lépés, Bence intézi”. Mondat: „Addig ezt a kettőt kérjük tőled.”
- Sorrend: a feladat (bevallás feltöltése) áll felül, nagyobb Caslon címmel és az elsődleges gombbal, utána a videóhívás, végül a „Hol tartunk” lépéssor.
- Lépések: „Aláírtad a meghatalmazást” · „Elküldted az igazolványaidat” · „Bence bejelent a NAV-nál” · „A számláid maguktól jönnek”. A „Kész” lépés kikerült. A kész lépés halvány, csak a mostani erős.
- „Ügyfélkapu+-szal” helyett „Ügyfélkapuval”. „A könyvelőd” helyett mindenhol „Bence”. „ő megadja PDF-ben” helyett „tőle elkérheted PDF-ben”.
- **Az azonosítás logikája:** a FUNKCIOK.md 5. pontja szerint az azonosítás az igazolványok feltöltésével történik, ezért lehet a csütörtöki hívás előtt. A hívás bemutatkozó beszélgetés. Ha Bence videón akar azonosítani, a 2. lépés a hívás lesz, és a cím „Még 3 lépés”.

**Üzenetek (06)**
- A kérésgombok színezett gombok lettek, keret nélkül, két sorban. Elmosva sem néznek ki mezőnek.
- A beszélgetés úgy fér ki, hogy egyik buborék sem csúszik a lap alá.

---

## Fájlok

| Fájl | Mi ez |
|---|---|
| `tokens.css` | Közös tokenek és elemek. Mind a hét HTML ezt tölti be. |
| `ikonok.js` | Kézzel rajzolt SVG-ikonok és Bence fénykép-helyőrzője egy készletben, `<use href="#…">`-szel hivatkozva |
| `kezjegy_utak.js` | Az aláírás és a KB monogram útvonala (generált, lásd lent) |
| `nyugta_foto.svg` | A lefotózott nyugta rajza (SVG, nem fénykép és nem generált kép) |
| `01_belepes` … `06_uzenetek` (.html, .png) | A hat képernyő |
| `02_…`, `03_…`, `04_…`, `05_…_teljes.png` | Ugyanez teljes hosszban, végiggörgetve |
| `07_elemek.html/.png` | Gombszintek, a négy állapot, sorok és a veszélyes megerősítés egy lapon |
| `_hunyoritas.png`, `07_elemek_hunyoritas.png` | Hunyorítás-próba (6 CSS px-es elmosás) |
| `_eszkozok/kezjegy.py` | Aláírás és monogram: tollvonás, sebességfüggő vonalvastagsággal |
| `_eszkozok/nyugta.py` | A nyugta-rajz |
| `_eszkozok/lovesz.py` | Képernyőképek fej nélküli Chrome-mal; minden lövés saját `--user-data-dir`-rel. Név nélkül mind a hét lapot és a négy teljes hosszt elkészíti. |
| `_eszkozok/hunyoritas.py` | A két elmosott összesítő kép |

Újrafuttatás: `python _eszkozok/kezjegy.py`, `python _eszkozok/nyugta.py`, `python _eszkozok/lovesz.py`, `python _eszkozok/hunyoritas.py`. A betűk a Google Fontsról töltődnek, ezért a lövéshez internet kell.

---

## Az időpont, amikor a képernyők „játszódnak”

**2026. október 9., péntek, 10:24.** Minden képernyő ehhez igazodik (a bekötés egy új ügyfél pillanatképe ugyanebben az időben).

- Bence levele október 2-i, a határidő október 12. (hétfő).
- Átalányadós egyéni vállalkozónál a TB-járulékot és a szochót havonta kell fizetni, az SZJA-előleget negyedévente. Három tétel ezért csak a negyedév utáni hónapban esedékes (január, április, július, október 12.). Novemberben csak két tétel lenne.
- A dosszié az októberi (folyamatban lévő) hónap. A nyugta október 3-i, a III. negyedéves bevallás október 2-án ment be.
- Bence a **szeptemberi** bankszámlakivonatot kéri (az októberi október 9-én még nem létezik). Az adót a számlákból már ki tudta számolni, a kivonat az ellenőrzéshez kell. Ezért szerepel így mindhárom helyen: a levélben, a kérésben és a dosszié „Szeptember” sorában.

## A mintaszámok

Egy főállású grafikus, 40%-os költséghányaddal.
- Bevétel: július–szeptember 2 940 000 Ft, szeptemberben 1 020 000 Ft, idén szeptember végéig 8 420 000 Ft.
- **TB-járulék** (szeptember): 1 020 000 × 60% = 612 000 Ft jövedelem, ennek 18,5%-a **113 220 Ft**.
- **Szocho** (szeptember): 612 000 × 13% = **79 560 Ft**.
- **SZJA-előleg** (III. negyedév): 1 764 000 × 15% = **264 600 Ft**. Az adómentes rész ekkorra elfogyott.
- **Összesen: 457 380 Ft.**
- **Adómentes jövedelem:** a 2026-os minimálbér (322 800 Ft) éves összegének fele, 1 936 800 Ft. Áprilisban elfogyott.
- **Alanyi ÁFA-mentesség:** 20 000 000 Ft, a megbízás szerint. **Élesítés előtt ellenőrizni kell,** lehet, hogy 2026-ban más a határ.
- **NAV-számlaszámok** (a nav.gov.hu „NAV számlaszámok és IBAN-számlaszámok adónemenként” listája, 2026. november 1-jétől érvényes; 2026-11-17-én megnézve):
  - SZJA (103): 10032000-06056353
  - Szocho (258): 10032000-06055912
  - TB-járulék magánszemélyt, egyéni vállalkozót terhelő (406): 10032000-06055802

  Figyelem: az A és a D változatban a szocho és a TB számlaszáma fel van cserélve vagy régi. Élesben az app ezeket a NAV aktuális listájából vegye, ne kézzel beírva.
- A közlemény (8412345678) mintaszerű adóazonosító jel.

---

## Tokenek

### Szín

| Token | Érték | Szerep |
|---|---|---|
| `--tintakek` | #17284A | Márka: fejlécsáv, elsődleges gomb, aktív fül, a mostani lépés, a mérő sávja |
| `--tintakek-szoveg` | #22396A | Link, szöveges gomb, másodlagos gomb felirata |
| `--tollkek` | #2546A6 | **Csak** aláírás és monogram. Sötét felületre soha nem kerül. |
| `--alap` | #DDE3EC | Háttér. A fehér lappal 1,29:1. |
| `--lap` | #FFFFFF | Lap |
| `--tinta` | #151C2A | Szöveg |
| `--halvany` | #596379 | Másodlagos szöveg fehér lapon |
| `--halvany-alapon` | #4A5468 | Másodlagos szöveg az alapon |
| `--fejlec-halvany` | #AEBBD2 | Másodlagos szöveg a fejlécsávon |
| `--keret` | #C5CEDD | Várakozó idővonal |
| `--hajszal` | #D6DCE5 | Sorelválasztó, a mérő alja |
| `--mezo-keret` | #7D879B | Beviteli mező kerete, várakozó lépés köre |
| `--mezo-alap` | #F5F7FA | Beviteli mező belseje |
| `--nyomott` | #EEF1F6 | Megnyomott sor |
| `--gomb-m-alap` | #D6E0F0 | **Új.** Másodlagos gomb kitöltése (keret nincs) |
| `--gomb-m-nyomott` | #C3D0E8 | **Új.** Ugyanez megnyomva |
| `--kesz` | #2B6744 | **Új.** Kész állapot: Feldolgozva, Beadva, kész lépés, „Kimásolva” |
| `--kesz-alap` | #E2EFE6 | **Új.** A „Kimásolva” gomb alapja |
| `--sajat` | #C3CEE0 | A saját üzenet buboréka |
| `--veszely` | #B42318 | Veszélyes szöveges gomb, piros megerősítő gomb |
| `--figyelem` | #8A5A00 | 80%-os határ-figyelmeztetés |
| `--figyelem-alap` | #FBF3E2 | Ugyanennek a halvány alapja |

A zöld csak a „kész” jele, máshol nem jelenik meg. A NAV-tól tartó felhasználónak a zöld pipa nyugodtabb jel, mint a csupa tintakék.

### Forma

| Token | Érték |
|---|---|
| `--r-lap` | 12 px (lap; árnyék nincs) |
| `--r-level` | 4 px (a levél: papír) |
| `--r-gomb` | 8 px |
| `--r-mezo` | 6 px |
| buborék | 14 px, a feladó felőli felső sarok 4 px |
| `--margo` | 16 px oldalt |

### Betű

- **Libre Caslon Condensed** (Pablo Impallari, OFL, Google Fonts, 400–700). Ez szedi a címeket, a megszólítást és minden összeget, táblázatos számjegyekkel (`tnum`). Dőlt változata nincs, dőltet sehol nem használunk.
- **Archivo** (Omnibus-Type, OFL, Google Fonts), 96%-os szélességgel. Ez szedi a szöveget, a gombokat, a számlaszámokat és a címkéket.
- **Ékezetpróba (2026-11-17, a 2. körben újra kirajzolva és megnézve).** „Ő ő Ű ű Győző, Szűcs, fűtő, Előfizetés, tőled” Caslon Condensed 600-zal, és „… könyvelőd, tőle elkérheted / Feltöltve, előleg / Előfizetés lemondása” Archivo 400/600/700-zal, Courier New tartalékbetűvel. Minden jel a saját betűből jött, írógépbetű sehol nem jelent meg.
- **Figyelem.** A keskeny nem törő szóköz (U+202F) egyik betűben sincs benne, az ezres tagolásnál a rendszer tartalékbetűje rajzolja ki. Az appban vagy egy U+202F-et is tartalmazó részhalmazt kell beépíteni, vagy CSS-sel kell tagolni. A Caslon `tnum` beállítása a pontot is táblázatos szélességűvé teszi, ezért szöveg végi pontnál nem kapcsoljuk be.

### Méretskála

| Szint | Betű | Méret / sorköz | Hol |
|---|---|---|---|
| Végösszeg | Caslon Cond. 600 | 46 / 48, tnum | A főoldal fejlécsávja: a képernyő legnagyobb betűje |
| Szóvédjegy | Caslon Cond. 600 | 56 / 56 | Belépés |
| Hónapcím | Caslon Cond. 600 | 38 / 40 | Dosszié fejlécsávja |
| Képernyőcím | Caslon Cond. 600 | 30–34 | Bekötés, tétel-részlet, üzenetek |
| Megszólítás, feladat | Caslon Cond. 600 | 25–26 / 29–30 | „Kedves Kata!”, a bekötés feladata |
| Tételösszeg | Caslon Cond. 600 | 20, tnum | Az utalások, a tétel összege |
| Határidő a sávon | Archivo 400 | 17 / 23, fehér | „Október 12-ig (hétfő) utald el a NAV-nak.” |
| Kérés, mérő mondata | Archivo 700 | 17 / 24 | „Töltsd fel …”, „Még 11 580 000 Ft-ot …” |
| Számlaszám, közlemény | Archivo 400 | 17, tnum | Az utalásokban |
| Elsődleges gomb | Archivo 700 | 17 | |
| Szöveg | Archivo 400 | 16 / 23–24 | Levél, buborék, sor |
| Másodlagos gomb | Archivo 700 | 16 (15 a másoló- és a kérésgomboknál) | |
| Szöveges gomb | Archivo 700 | 15,5, aláhúzás 1,5 px | |
| Szakaszcím | Archivo 700 | 15 / 19,5 | Az alapon, a lapon kívül |
| Állapot | Archivo 600 (szó) + 400 | 14 / 19, 16 px-es jel | „Feldolgozva, hétfőn” |
| Időbélyeg | Archivo 400 | 13 | Csevegés |
| Fülcímke | Archivo 600 / aktív 700 | 12,5 | Alsó sáv |

Az „Ft” a számnál kisebb (0,7 em, a sávon 0,5 em) és halványabb.

---

## Elemszabályok

**Fejlécsáv.** Tintakék sáv a 02, 03, 04 és 06 tetején, az állapotsorral együtt.
- Benne csak a cím és egy mondat áll. Gomb soha nincs rajta.
- A lapok nem lógnak rá: a sáv egyenesen ér véget, alatta 12–14 px az alap.
- A főoldalon a cím a végösszeg, a mondat a határidő. A dossziéban a hónap, az üzenetekben Bence fényképe és neve.
- A belépésnek (01) és a tétel-részletnek (05) nincs sávja.

**Lap.** Fehér, 12 px-es sarok, árnyék és keret nélkül, az alapon. Egy lap egy dolgot fog össze. A szakaszcím a lapon kívül, felette áll, és csak ott, ahol a lap tartalmából nem derül ki, mi az.

**A levél (merész elem).** 4 px-es sarkú papír, keret és helységnév nélkül.
- Sorrend: megszólítás Caslonnal, legfeljebb két rövid mondat, alul balra Bence fényképe, neve és a dátum, jobbra a tollkék aláírás.
- Összeget és táblázatot nem tartalmaz: a „mennyit” a sávon, a „hogyan” az utalásoknál van.

**Utalások.** Egy lap, tételenként: megnevezés és összeg egy sorban, alatta a számlaszám és a „Másolás” gomb. A közös közlemény a végén, saját gombbal, majd a „Befizettem”, az emlékeztető mondat és a „Kérdésem van”.

**Aláírás és monogram.**
- Csak tollkék lehet, csak fehér vagy #EEF1F6 alapon.
- Élesben a könyvelő egyszer, érintőképernyőn adja le a sajátját, a hozzájárulásával. A mostani „Kovács B.” és „KB” a `kezjegy.py` helyőrzője.
- Az aláírás csak a levélen áll. A monogram csak a tétel-részlet „Feldolgozva” lépésénél és Bence megjegyzése alatt.

**Fénykép.** Kör alakú, 44 px (levél), 52 px (videóhívás), 60 px (üzenetek fejléce, vékony fehér gyűrűvel). A mostani rajz helyőrző, élesben Bence valódi fotója kerül ide.

**Gombok (négy szint).** Egyik sem néz ki sornak, és egymással sem keverhetők. A `07_elemek.png` egy lapon mutatja mindet.
1. **Elsődleges:** kitöltött tintakék, 54 px magas, teljes szélességű, 17 px-es félkövér felirattal. Képernyőnként legfeljebb egy.
2. **Másodlagos:** #D6E0F0 kitöltés, keret nélkül, tintakék félkövér felirat, ahol segít, ikonnal. 44 px magas (a másolás és a kérések 40 px), csak akkora, amekkora a felirata. Csak fehér lapon áll, az alapon soha (ott eltűnne).
3. **Szöveges:** félkövér, aláhúzott tintakék szöveg, csak harmadrangú dologra („Elfelejtettem a jelszavam”, „Másik időpont”, „Most kezdtem, nincs ilyenem”, „Regisztrálok”). Elmosva ez halványul el a legjobban, ezért gyakori műveletre nem használjuk.
4. **Veszélyes:** piros, aláhúzott szöveg. A megerősítő lapon kitöltött piros gomb („Lemondom”), alatta szöveges „Mégsem mondom le”.

Egy kérés mindenhol ugyanazon a szinten áll (a kivonat kérése mindkét helyen másodlagos).

**Másolás.** Minden érték mellett saját gomb, a számmal egy vonalban. A látható felirat „Másolás”, a felolvasott felirat a teljes név („A TB-járulék számlaszámának másolása”). A „Számlaszám másolása” felirat 390 px-en nem fér a szám mellé, és harmadik sorba csúszva a „Befizettem” a hajtás alá kerülne. Megnyomás után: „Kimásolva”, pipa, zöldes alap, 2 másodpercig.

**Sor.** Nincs kitöltése és kerete, a sorokat 16 px-ről induló hajszálvonal választja el. Bal oldalon ikon állhat, jobb oldalon mindig nyíl (›). Megnyomva #EEF1F6 lesz. Monogram a sorban nincs.

**Állapot.** Mindig a négy szó egyike elöl (Feltöltve, Bence látta, Feldolgozva, Beadva), utána vesszővel a dátum vagy egy rövid kiegészítés.
- Kész: zöld teli kör pipával, zöld szó. Várakozik: szürke óra, tintaszínű szó.
- A részletnézetben ugyanez a négy lépés függőleges idővonalon jelenik meg, ugyanezekkel a jelekkel.
- A hónapok sorában (Korábbi hónapok) „Lezárva” vagy a hiányzó irat neve áll.

**Lépéssor (bekötés).** Négy, valóban egymást követő lépés, ezért számozott.
- Kész: zöld pipás kör, halvány felirat.
- Folyamatban: fehér kör tintakék gyűrűvel és ponttal, félkövér, nagyobb felirat.
- Hátravan: szürke gyűrű a lépés számával.

**Mező.** Felirata fölötte, félkövéren. A doboz 52 px magas, 1 px-es #7D879B kerettel és #F5F7FA belsővel. Fókuszban 2 px-es tintakék keret.

**Határ-mérő.** A cím a köznapi mondat („Még 11 580 000 Ft-ot számlázhatsz ÁFA nélkül.”), alatta kisebben a szakszó vagy a magyarázat, majd egy 8 px-es sáv, a két végén a számokkal. 80% fölött a sáv és a mondat #8A5A00 lesz, a lap alapja #FBF3E2.

**Belépés.** Szóvédjegy az alapon, egy lap a mezőkkel és a „Belépés” gombbal. A Google- és az Apple-gomb a lapon kívül, az alapon, a két cég világos gombstílusában. A mintán a logójukat szándékosan nem rajzoltuk le; élesben a cégek hivatalos gombkészletéből kerül be, a gombszabályaik szerint.

**Alsó sáv.** Fülek: Főoldal, Dosszié, Üzenetek, Fiók. Fehér, felül hajszálvonallal. Az aktív fül tintakék, félkövér, vastagabb ikonvonallal. A bekötés alatt (02) nincs alsó sáv.

**Ikonok.** Kézzel rajzolt, 24-es rácsra illesztett SVG-k, 1,7-es vonallal, lekerekített végekkel. Az állapotjelek 16-os rácson. Emoji, márkalogó és képgenerált kép nincs.

**Csevegés.** Bence buboréka fehér és balra áll, a sajátod #C3CEE0 és jobbra. A kérésgombok eredménye egy keretes kéréskártya, rajta az állapot a megszokott formában („Bence látta, pár napon belül kész”).

---

## Kontraszt (WCAG 2.x)

| Előtér | Háttér | Arány | Hol | Szint |
|---|---|---|---|---|
| Tinta #151C2A | Lap #FFFFFF | 17,05 | Törzsszöveg, összegek, számlaszámok | AAA |
| Tinta #151C2A | Alap #DDE3EC | 13,22 | Szakaszcím, cím az alapon | AAA |
| Tinta #151C2A | Mező #F5F7FA | 15,89 | Beírt érték | AAA |
| Tinta #151C2A | Saját buborék #C3CEE0 | 10,74 | Saját üzenet | AAA |
| Fehér | Tintakék #17284A | 14,60 | Végösszeg, határidő, elsődleges gomb | AAA |
| Fejléc-halvány #AEBBD2 | Tintakék #17284A | 7,53 | Mondat a sávon, „Ft” a sávon | AAA |
| Tintakék szöveg #22396A | Lap #FFFFFF | 11,28 | Szöveges gomb | AAA |
| Tintakék szöveg #22396A | Másodlagos gomb #D6E0F0 | 8,48 | Másodlagos gomb felirata | AAA |
| Tintakék szöveg #22396A | Megnyomva #C3D0E8 | 7,27 | Ugyanez megnyomva | AAA |
| Tintakék #17284A | Alap #DDE3EC | 11,3 | Szóvédjegy a belépésen | AAA |
| Kész #2B6744 | Lap #FFFFFF | 6,70 | „Feldolgozva”, „Beadva” | AA |
| Kész #2B6744 | Kész-alap #E2EFE6 | 5,66 | „Kimásolva” | AA |
| Tollkék #2546A6 | Lap #FFFFFF | 8,38 | Aláírás, monogram | AAA |
| Halvány #596379 | Lap #FFFFFF | 6,02 | Másodlagos szöveg, dátumok | AA |
| Halvány az alapon #4A5468 | Alap #DDE3EC | 5,90 | Megjegyzés, időbélyeg, belépés alcíme | AA |
| #1F1F1F | Fehér | 16,5 | Google- és Apple-gomb | AAA |
| Veszély #B42318 | Lap #FFFFFF | 6,57 | Piros szöveges gomb | AA |
| Fehér | Veszély #B42318 | 6,57 | Piros megerősítő gomb | AA |
| Figyelem #8A5A00 | Lap #FFFFFF | 5,93 | 80%-os figyelmeztetés | AA |

**Nem szöveges elemek (legalább 3:1)**
- Mezőkeret #7D879B a lapon: 3,61.
- Kész jel (#2B6744) a lapon: 6,70. Várakozó óra (#596379): 6,02.
- Google-gomb kerete #747775 az alapon: 3,5.
- Mérősáv kitöltése a sáv alján: 10,58.

**Csak csoportosítás, nem kell 3:1**
- Az alap és a lap: 1,29.
- A másodlagos gomb kitöltése és a lap: 1,33. A gombot a kitöltés, a félkövér tintakék felirat és az ikon együtt jelzi.

---

## Hunyorítás-próba

A `_hunyoritas.png` alsó sora minden képernyőt 6 CSS px-es elmosással mutat (a @2x képen GaussianBlur 12; az 1. körben a próba csak 3 px-nek felelt meg, most szigorúbb).

Elmosva is megmarad:
- a sötét sáv, és a főoldalon benne a végösszeg mint a legnagyobb folt;
- a fehér lapok az alapon, a levél a többitől elkülönülve;
- egyetlen sötét tömb képernyőnként (az elsődleges gomb);
- a másodlagos gombok kék tömbként, a sorok szövegétől és a mezőktől eltérően;
- a zöld pipák a kész tételeknél.

Ami elmosva elhalványul, és ez így szándékos: a szöveges gombok (harmadrangúak), a várakozó óra és a „Kimásolva” zöldes alapja (két másodpercig látszik).

## Mire figyelj (önkritika)

- **A főoldal első képernyője most a pénzé.** A levél kisebb lett, a merész elem a fénykép, a megszólítás és az aláírás együtt. Ha a tulajnak a levél kevés, a második mondat helyére egy harmadik is fér, de akkor a „Befizettem” a hajtás alá csúszik.
- **A négy „Másolás” gomb egymás alatt** erős oszlopot ad. Szándékosan ilyen hangos, mert ez a leggyakoribb művelet, de egy pillantásra gomboszlopnak is látszhat.
- **Az arckép rajz, nem fotó.** A mintán sima, lapos rajz, mert képgenerált kép és fotóbank nem lehet. Élesben csak valódi fénykép kerülhet ide; rajzolt avatarral a „valódi könyvelő” ígéret gyengülne.
- **Sötétkék sok versenytársnál.** A levél, a Caslon, a fénykép és a kék toll különbözteti meg. A rálógó kártya megszűnésével kevésbé „banki sablon”, de a sötét sáv megmaradt.
- **A zöld új szín a rendszerben.** Csak a „kész” jele, máshol nem szabad használni, különben elveszti a jelentését.
- **A bekötés sorrendje** (feladat felül, lépések alul) azt feltételezi, hogy a lépéseket a sáv címe összefoglalja. Ha a tulaj a lépéseket akarja felül, a feladat-lap súlya akkor is maradjon nagyobb.
- **Képernyőn kívül hagytam:** az iparűzési adót (októberben ennél a példánál nem esedékes), a határidő-naptárt, a Fiók képernyőt, a regisztrációt az árral, az ujjlenyomatos belépés egyszeri kérdését és a webes változatot (ugyanez a rendszer egy 720 px-es oszlopban).
- **A lövésekhez internet kell,** mert a betűk a Google Fontsról jönnek. Az appba be kell építeni őket.
