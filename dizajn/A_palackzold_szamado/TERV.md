# Számadó: A változat, Palackzöld kivonat

2026-11-17, **2. kör** (a kritika után javítva). Ez a „nyugodt privátbankos” irány A változata kilenc telefonos képernyőn, egy közös `tokens.css`-szel. A számok mintaszámok, nem adótanácsok.

## Fájlok

Mappa: `C:/Users/UpgradePC/konyvelo_app/dizajn/A_palackzold_szamado/`

| Képernyő | HTML | Kép (390×844, @2x) | Teljes hosszú kép |
|---|---|---|---|
| Belépés | `01_belepes.html` | `01_belepes.png` | nem kell |
| Indulás (bekötés), Kata első hete | `02_bekotes.html` | `02_bekotes.png` | `02_bekotes_teljes.png` |
| Főoldal, fizetni kell | `03_fooldal.html` | `03_fooldal.png` | `03_fooldal_teljes.png` |
| Főoldal befizetés után | `03b_fooldal_befizetve.html` | `03b_fooldal_befizetve.png` | `03b_fooldal_befizetve_teljes.png` |
| **Új:** Utalás adatai (alsó lap) | `03c_utalas_adatai.html` | `03c_utalas_adatai.png` | nem kell |
| Dosszié, október | `04_dosszie.html` | `04_dosszie.png` | `04_dosszie_teljes.png` |
| Egy tétel | `05_tetel.html` | `05_tetel.png` | `05_tetel_teljes.png` |
| Üzenetek | `06_uzenetek.html` | `06_uzenetek.png` | nem kell |
| Elemek (gombok, sorok, állapotok, nem NAV-os címzett) | `00_elemek.html` | `00_elemek.png` | `00_elemek_teljes.png` |

Közös: `tokens.css` (színek, betűk, minden elem), `kozos.js` (kézzel írt SVG-ikonok, a gilos-keret képlete, az igazolványkép helye, állapotsor, alsó sáv). Kép nincs, minden rajz SVG.

Az előző kör fájljai összehasonlításhoz: `D:/Atvitel/Temp/claude/C--Users-UpgradePC/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/A_javit/elotte/`.

### A történet napja

Minden képernyő **2026. október 7-én, szerdán** játszódik (az állapotsor 9:41-et mutat, minden időpont ez előtt van). Egyetlen kivétel az Indulás (02): az Kata első hete szeptemberben (aláírás szeptember 7., videóhívás szeptember 10.). Így sorban végignézve időrendben halad: szeptemberben beköt, októberben fizet.

- Főoldal: a III. negyedévi befizetés október 12-ig (hétfő). Bence kéri a **szeptemberi** kivonat 2. oldalát.
- Befizetés után (03b): ugyanaz a nap, 9:38-kor jelölte befizetettnek. A következő befizetés január 12.
- Dosszié: október; benne ugyanaz a kérés („Rád vár”).
- Üzenetek: tegnap Kata megígérte a 2. oldalt; ma jövedelemigazolást kért (8:52, 9:20, 9:26).

**Miért nem november 17.?** A kritika ezt javasolta, de átalányadóban a TB, a szocho és az SZJA-előleg negyedéves. November 17-én nincs esedékes befizetés (a következő január 12., és az összege csak december végén dől el), így a főoldal nyitott „fizess be” kivonata hamis lenne. Október 7. a legközelebbi nap, amelyen minden képernyő igaz.

---

## 1. Színtokenek

| Token | Hex | Szerep |
|---|---|---|
| `--brand` palackzöld | #14402F | márka, a kivonat, elsődleges gomb, aktív fül, kész lépés |
| `--guil` gilosvonal | #4F8A70 | csak a kivonat gilos-kerete (2,88:1 a palackzöldön) |
| `--oncard` | #B8D0C5 | másodlagos szöveg és a „Ft” a kivonaton |
| `--cardline` | #2E5E4C | hajszálvonal a kivonaton |
| `--ground` alap | #DCE5E0 | minden képernyő háttere |
| `--sheet` lap | #FFFFFF | lapok, alsó sáv, chat fejléce, író sáv |
| `--ink` tinta | #16231E | szöveg |
| `--muted` | #56655F | másodlagos szöveg |
| `--link` | #1B5A43 | szöveges gomb, vissza-nyíl |
| `--line` hajszál | #D5DED9 | sorelválasztó, a mérő üres része |
| `--tint` halványzöld | #E3EEE8 | fókuszgyűrű, „Kimásolva” alapja, a „folyamatban” jel alapja |
| `--press` | #F0F5F2 | lenyomott sor, mellette 3 px-es palackzöld csík a bal szélen |
| `--danger` | #B42318 | veszélyes gomb, hibaüzenet |
| `--warn` | #8A5A00 | „Rád vár”, „Bence kéri…”, 80%-os határ |
| `--field` | #7D8E86 | beviteli mező kerete, sorvégi nyíl |
| `--off` | #CCD6D1 | hátralévő lépés szaggatott köre |
| `--mine` | #3B6E5A | a saját üzeneted buboréka, fehér szöveggel |
| `--mine-ido` | #DDEBE3 | időpont a saját buborékban |
| `--photo` | #C9D4CE | a könyvelő fotójának helye |

Kikerült: `--online` (a zöld pötty), `--seg-off` (a szegmensek), a régi `--mine` (#C3D7CC).

**Forma, szerep szerint eltérő sarkok** (az előző 16/14/12/10 gyakorlatilag egyforma volt):

| Elem | Sarok | Miért |
|---|---|---|
| Lap | 18 px | puha tartó |
| Gomb | 8 px | feszesebb, mint a lap, így nem olvad bele |
| Beviteli mező (a chaté is) | 6 px | űrlap-téglalap, nem kerek pirula |
| Kivonat | 4 px | papír, irat: nem kártya |
| Igazolványkép | 6 px (kicsiben 5 és 4) | álló téglalap, nem kör |
| Chat-buborék | 18 px, a „farok” sarka 4 px | |

Oldalsó margó 16 px, a lapon belül 20 px. Árnyék sehol (a nyugtafotón belüli árnyék a „fotó” része).

## 2. Betűk és méretskála

Három forrás, két hang:
- **Literata** (TypeTogether, OFL, Google Fonts, változó: opsz 7–72, wght 400–700): címek, a fizetési mondat és **minden összeg**, táblázatos bélés-számjegyekkel.
- **Atkinson Hyperlegible Next** (Braille Institute, OFL, 400/700): szöveg, gomb, címke, azonosító.
- **Figtree, csak a 0–9 számjegyek** (Erik Kennedy, OFL): a sans szövegben minden számjegy innen jön. Az Atkinson nullája áthúzott („2Ø25”, „9:4Ø”), és nincs kikapcsolható változata: 26 OpenType-beállítást (zero, salt, ss01–ss10, cv01–cv06 stb.) kipróbáltam, egyik sem adott sima nullát. 16 szabad betű számjegyét raktam az Atkinson betűi mellé; a Figtree illeszkedik legjobban (vastagság, magasság, kerekség).
  - Most: `fonts.googleapis.com/css2?family=Figtree:wght@400;700&text=0123456789`, ez csak a tíz számjegyet tölti le. A `--sans` sorrendje: `"Figtree", "Atkinson Hyperlegible Next", …`, így a böngésző betűnként választ: számjegy a Figtree-ből, minden más az Atkinsonból.
  - Élesben: saját kiszolgálású, csak számjegyes Figtree-részhalmaz `@font-face`-szel és `unicode-range: U+0030-0039` beállítással.

| Szerep | Betű | Méret / sorköz | Vastagság |
|---|---|---|---|
| Képernyőcím („Október”, „Indulás”) | Literata | 32 / 36 px | 500 |
| Tétel címe, „Utalás adatai”, „Belépés” | Literata | 26 / 31 px | 500 |
| Fizetési mondat a kivonaton | Literata | 27 / 32 px | 500 |
| Mondat a lapon (kérés, határ, időpont, „Befizetted”) | Literata | 19 / 25 px | 500 (időpont, befizetve 600) |
| Összeg sorban | Literata | 17–19 px | 500; a „Ft” 0,74 em, 400, halványabb |
| Összeg folyó szövegben | Literata | 1,03 em | 500 |
| Köszönő sor a főoldal tetején | Atkinson | 16 / 1,45 | 400, másodlagos szín |
| Törzsszöveg, sor címe | Atkinson | 17 / 1,45 | 400 |
| Másodlagos szöveg, állapot | Atkinson | 15 / 1,4 | 400; „rád vár” 700, borostyán |
| Szakaszcím az alapon | Atkinson | 15 / 1,3 | 700, mondatkezdő nagybetű |
| Elsődleges gomb | Atkinson | 17 | 700 |
| Másodlagos és szöveges gomb | Atkinson | 16 (a másolásé 15) | 700 |
| Alsó sáv felirata | Atkinson | 12,5 | 400, aktív 700 |
| Azonosító (számlaszám, közlemény) | Atkinson + Figtree-számjegy | 19–20 | 400, betűköz +0,03–0,05 em |

**Ékezetek.** Ránagyítva megnéztem a renderelt képeken: Literata és Atkinson is valódi kettős ékezetet rajzol (könyvelőd, Feltöltöm, Iparűzési, megszűnik, előfizetést). A Figtree csak számjegyet ad, ékezetes betűt nem, így az ő/ű mindig az Atkinsonból jön.

**Ezreselválasztó.** A U+202F egyik betűben sincs meg, ezért U+2009 (keskeny szóköz) kell nem törő dobozban: `820&thinsp;260`.

## 3. Elemszabályok

### Alap és lapok
- Hideg zöldesszürke alap, rajta fehér lapok, árnyék nélkül (alap és lap 1,29:1).
- Szakaszcím csak ott van, ahol több lapot vagy sort csoportosít, és új információt ad: „Rád vár”, „Kiállított számláid”, „Amit feltöltöttél”, „Hivatalos iratok”, „Mi történt vele”, „Most ennyi a dolgod”. Ha a lap első mondata elmondja ugyanazt, nincs cím („Határok idén”, „Bence kéri”, „Videóhívás Bencével”, „Bence megjegyzése” kikerült).
- A főoldalon nincs képernyőcím. Felül egy kis sor: „Szia, Kata! Ma október 7., szerda van.”

### Gombok (négy szint, a sorokkal nem keverhetők)
1. **Elsődleges:** kitöltött palackzöld, teljes szélesség, 54 px, 8 px-es sarok, fehér felirat. Képernyőnként legfeljebb egy. A kivonaton fordított: fehér kitöltés, zöld felirat.
2. **Másodlagos:** fehér, 1,5 px-es palackzöld keret, 44 px, csak akkora, amekkora a felirata. A kivonaton átlátszó, fehér kerettel („Utalás adatai”, „Másolás”).
   - **Másolás:** mindig másodlagos gomb, 44 px, kézzel rajzolt két lap ikonnal. Megnyomva 3 másodpercig „✓ Kimásolva”, halványzöld alapon, keret nélkül.
3. **Szöveges:** félkövér, aláhúzott #1B5A43, legalább 44 px magas érintési terület („Másik időpont”, „Mégsem fizettem be”, „Bezárás”).
4. **Veszélyes:** piros aláhúzott szöveg; a megerősítő lapon kitöltött piros elsődleges gomb.

A navigáció („‹ Október”, „‹ Szeptember”) zöld félkövér nyíl és szó, aláhúzás nélkül. A dossziéban a hónaplapozó csak visszafelé mutat („‹ Szeptember”); a jövő hónapnak nincs nyila, így nincs letiltott, gombnak látszó négyzet.

### Sorok
- Fehér lapon, kitöltés és keret nélkül, hajszálvonal választja el őket (20 px-ről indul). Jobb szélen szürke nyíl.
- Megnyomva #F0F5F2 alap és 3 px-es palackzöld csík a bal szélen.
- Első sor: megnevezés és jobbra az összeg (Literata). Alatta az állapot, **csak szóval**.

### Állapot
- A sorokban csak a szó: „Feltöltötted, október 2.”, „Bence látta, október 6.”, „Feldolgozva, október 5.”, „Beadva október 6-án, a NAV visszaigazolta.”
- Ha rád vár: borostyán és félkövér, pl. „Bence kéri a 2. oldalt.”
- Feltöltött irat lépései: feltöltve → Bence látta → feldolgozva → beadva. A lépések sora csak a tétel képernyőjén látszik (idővonal).
- **Bejövő NAV-levélnek saját sora van:** megérkezett → Bence elolvasta → „nincs vele teendőd” (ez a vége) vagy „teendőd van vele” (borostyán). „Beadva” lépése nincs, így sosem látszik befejezetlennek.

### Idővonal (bekötés, tétel)
- Kész lépés: palackzöld kör pipával, befejezett alak („Aláírva”, „Azonosítva”).
- Folyamatban: halványzöld kör palackzöld kerettel, benne **óra** (nem pötty, nem hasonlít kijelölt rádiógombra). A neve főnév, mellette a „folyamatban” szó: „Bejelentés a NAV-nál folyamatban”.
- Hátralévő: szaggatott szürke kör, szürke főnév („Számlák bekötése”, „Beadás a NAV-nak”).

### Pénz
- Összeg és határidő egy mondatban, a határidő egyszer: „Október 12-ig (hétfő) fizess be 820 260 Ft-ot.”
- Táblázatban jobbra zárt, táblázatos számjegyek; a „Ft” kisebb és halványabb.

### A merész elem: befizetési kivonat
- Csak a főoldalon, a képernyő egyetlen sötét felülete. **Papír, nem kártya:** 4 px-es sarok, körben gilos-keret, mint egy értékpapír vagy bankjegy szegélye.
- Tartalma ennyi: a mondat, egy sor arról, kinek és hányszor utalsz, a három összeg, a közlemény egy másológombbal, alul két gomb: „Utalás adatai” (keretes) és „Befizettem” (fehér, kitöltött). Számlaszám nincs rajta.
- **Gilos-keret** (`kozos.js`, `guillocheFrame`): a középvonal egy lekerekített téglalap, 10 px-re a széltől, 8 px-es sarokkal. Rajta 10 szál, i = 0…9:
  - eltérés_i(s) = A(s) · sin(2πs/p + i·2π/10), A(s) = 4,1 + 2,1 · cos(2πs/p), s a kerület mentén mért út;
  - p = kerület / N, ahol N egész (kb. 21 px-es hullám), így a minta körben megszakítás nélkül zár;
  - két 0,8 px-es keretvonal a középvonaltól ±7,6 px-re; a szálak 0,6 px-esek;
  - szín #4F8A70 a #14402F-on: **2,88:1**. Hunyorítva is látszik, világosabb, szövött szegélyként.
  - A keret a kivonat valódi méretéből rajzolódik, így bármilyen magas kivonatra illik.
- **Az egyetlen mozgás:** a „Befizettem” után a kivonat a helyén fehér lappá zsugorodik, zöld pipával („Befizetted, ma 9:38-kor.”).
  - Javasolt menet: a gomb felirata 150 ms-ra „✓ Befizettem”; a tartalom 120 ms alatt elhalványul; a lap 360 ms alatt (cubic-bezier(.2,.7,.2,1)) összemegy, a háttere palackzöldből fehérre vált, a keret elhalványul; a pipa és a mondat beúszik.
  - `prefers-reduced-motion` esetén azonnali csere.
  - A fehér lapon ott a „Mégsem fizettem be”, ha valaki véletlenül nyomta meg.

### Utalás adatai (alsó lap, `03c`)
- A kivonat „Utalás adatai” gombja nyitja. Fent: „Ezt írd be a bankod appjába.”
- Első lap: a kedvezményezett (Nemzeti Adó- és Vámhivatal) és a közlemény mindháromhoz.
- Második lap: utalásonként egy sor (a neve, az összege, a számlaszáma), mindegyik mellett 44 px-es „Másolás”.
- Alul: „Ha mindhárom utalás kész, nyomd meg a főoldalon a »Befizettem« gombot.”
- A 3×8 jegyű számlaszám a kötőjelnél törhet, így a gomb sosem csúszik rá.

### Nem a NAV-nak fizetsz (iparűzési adó)
Az `00_elemek` mutatja: az iparűzési adó előlege (március 16., szeptember 15.) jellemzően nem esik egybe a negyedéves NAV-befizetéssel, ezért saját kivonatot kap. A kivonat második sora kimondja: „Ez nem a NAV-nak megy, hanem a lakóhelyed önkormányzatának, külön utalással.” Az Utalás adatai lapon a kedvezményezett az önkormányzat neve, és saját közleménye van. Az önkormányzat neve („Mintaváros Önkormányzata”) és a számlaszám kitalált.

### Befizetés után (`03b`)
- A kivonat helyén fehér lap, zöld pipával: „Befizetted, ma 9:38-kor.” Alatta: „Mindhárom utalást, összesen 820 260 Ft-ot. Bence a NAV-nál is megnézi, hogy megérkezett-e. A következő befizetés január 12-én lesz.” Így nem állítja, hogy a pénz megérkezett; csak azt, amit Kata jelölt.
- Nincs sötét felület; az elsődleges gomb a „Bence kéri” lapra kerül („Feltöltöm a 2. oldalt”).

### Dosszié (`04`)
- Legfelül „Rád vár” (borostyán szakaszcím), benne a konkrét kérés és az elsődleges gomb: „Feltöltöm a 2. oldalt”.
- Az általános feltöltés másodlagos gomb a hónap neve mellett („Feltöltés”); a rögzített alsó sáv kikerült.

### A könyvelő
- Monogram és zöld pötty nincs. Helyette álló, igazolványkép-arányú hely (52×64, 6 px-es sarok) Bence **valódi fotójának**. Most egy szürke alak jelzi, élesben Bence adja a fotót (nem AI-kép, nem rajz).
- Mellette: teljes név, „Mérlegképes könyvelő”, „Nyilvántartási szám: 184205” (mintaszám).
- Válaszidő mindenhol ugyanazzal a mondattal: „Munkanapokon 4 órán belül válaszol.” A chat fejlécében elé kerül: „Ma 9–17-ig elérhető.”
- A főoldalon saját lap „Írok Bencének” gombbal.

### Üzenetek (`06`)
- A saját buborék #3B6E5A, fehér szöveggel (5,89:1); Bence buboréka fehér. Elmosva is egyértelmű, ki beszél.
- Kérések: egy 64 px-es sor két másodlagos gombbal a beviteli sáv fölött: „Igazolást kérek” (jövedelemigazolás, nullás/köztartozásmentes igazolás) és „Változást jelentek” (adat- vagy tevékenységváltozás). Mindkettő alsó lapot nyit a választható tételekkel. Az előző 300 px helyett 64 px.
- A kérés a beszélgetésben: „Jövedelemigazolást kértél (2025)”, alatta „Bence látta, ma 9:26”.
- Beviteli mező 6 px-es sarokkal, mint a többi mező. A „Küldés” 44 px-es gomb: üresen szürke lap szürke felirattal, szöveg után palackzöld, fehér felirattal.

### Ikonok és alsó sáv
- Kézzel írt SVG, 24-es rácson, 1,8 px-es vonal. Emoji nincs.
- Az alsó sáv ikonjai a témához igazodnak: házikó kéménnyel, mappa kilógó lappal, két buborék (két ember beszél), igazolvány fényképpel. Az aktív fül ikonja kitöltött.
- Új ikonok: másolás (két lap), óra (folyamatban).

## 4. Kontraszt (WCAG 2.2)

Szöveg (mind legalább 4,5:1):

| Szöveg | Háttér | Arány | Hol |
|---|---|---|---|
| tinta #16231E | lap #FFFFFF | **16,24** | törzsszöveg, sorok, mondatok |
| tinta #16231E | halványzöld #E3EEE8 | **13,66** | „Kimásolva” |
| tinta #16231E | alap #DCE5E0 | **12,62** | képernyőcím, szakaszcím |
| fehér | palackzöld #14402F | **11,64** | elsődleges gomb, a kivonat szövege |
| palackzöld #14402F | fehér | **11,64** | másodlagos gomb, a kivonat fehér gombja |
| link #1B5A43 | lap #FFFFFF | **8,11** | szöveges gombok |
| #B8D0C5 | palackzöld #14402F | **7,13** | másodlagos szöveg a kivonaton |
| piros #B42318 | lap #FFFFFF | 6,57 | veszélyes gomb, hibaüzenet |
| másodlagos #56655F | lap #FFFFFF | 6,14 | másodlagos szöveg a lapon |
| figyelmeztető #8A5A00 | lap #FFFFFF | 5,93 | „Bence kéri a 2. oldalt.” |
| fehér | saját buborék #3B6E5A | 5,89 | a te üzeneteid |
| #DDEBE3 | saját buborék #3B6E5A | 4,79 | időpont a saját buborékban |
| másodlagos #56655F | alap #DCE5E0 | 4,77 | köszönő sor, bevezető sorok |
| figyelmeztető #8A5A00 | alap #DCE5E0 | 4,61 | „Rád vár” szakaszcím (15 px félkövér) |

Nem szöveges elemek (WCAG 1.4.11):

| Elem | Arány | Megjegyzés |
|---|---|---|
| mezőkeret, sorvégi nyíl #7D8E86 a lapon | 3,45 | rendben |
| saját buborék az alapon | 4,58 | rendben |
| lenyomott sor csíkja #14402F | 10,56 | a #F0F5F2 alap önmagában 1,10, a jelet a csík hordozza |
| gilosvonal a kivonaton | 2,88 | díszítő, de hunyorítva is látszik |
| letiltott „Küldés” felirata | 2,88 | letiltott elem, nem kötelező |
| hátralévő lépés szaggatott köre | 1,49 | a jelentést a szürke felirat hordozza |
| alap és lap | 1,29 | csoportosítás |

## 5. Hunyorítási próba

Mind a nyolc képernyőt 6-os Gauss-elmosással is megnéztem (`scratchpad/A_javit/squint_osszes.png`):
- A lapok egyértelmű fehér tömbök az alapon.
- Minden képernyőn egy sötét téglalap viszi a fő műveletet: a főoldalon a kivonat, befizetés után és a dossziéban a „Feltöltöm a 2. oldalt”, az indulásnál a „Bevallás feltöltése”.
- A kivonat gilos-kerete elmosva is látszik, világosabb, szövött szegélyként: már nem tűnik el.
- A saját üzenet buborékai sötétzöld foltok jobbra, Bencéé fehér balra: nem olvadnak az alapba.
- A dossziéban nincs gombnak látszó letiltott négyzet; a lenyomott sor nem „lyukas”, mert a bal szélén ott a csík.

## 6. Tartalmi döntések

- **„Beadott” tétel a dossziéban:** átalányadóban a bevallás negyedéves, ezért a beadott tétel egy NAV-bejelentés („Új tevékenység bejelentése (fotózás)”, beadva október 6-án). A feldolgozott tételeknél a „Beadás a NAV-nak” lépés: „A negyedéves bevallással megy be, január 12-ig.”
- **A „fotózott bizonylat” kézi nyugta,** nem költségszámla. Átalányadóban a költséget a hányad fedezi; a papír nyugta bevétel, és számít a 20 milliós határba. A nyugtán a kelte 10.01., Kata október 2-án töltötte fel.
- **Google és Apple gomb:** csak felirat, logó nélkül. Élesben a két cég saját előírása szerinti jelet kell beletenni.
- **Rovásfa-jel:** a „Számadó” szóvédjegy mellé a kettéhasított rovásfa lenne jó logónak (mindkét fél őrzi a maga felét, ezért nem hamisítható), ez a közös dosszié ígérete. Még nincs megrajzolva.

**Ellenőrizni kell élesítés előtt** (mintaként szerepelnek):
- a három NAV-számlaszám (10032000-06055826 TB, -06055912 szocho, -06056353 SZJA) és a kedvezményezett pontos neve a NAV aktuális listájából;
- az iparűzési adó közleményének formája (önkormányzatonként eltérhet);
- a 2026-os minimálbér és az adómentes rész (itt 1 936 800 Ft);
- hogy a főállású átalányadós járulékai valóban negyedévesek-e minden ügyfélnél;
- Bence nyilvántartási száma (184205 kitalált).

## 7. Ami a 2. körben változott (a kritika pontjai szerint)

1. Áthúzott nulla: a sans szöveg számjegyei a Figtree-ből jönnek (sima nulla), az ő/ű az Atkinsonból marad.
2. Főoldal: nincs „Október” cím, csak egy kis köszönő sor; sorrend kivonat → Bence kérése → határok → könyvelő. A kérés gombja már az első képernyőn látszik.
3. Kivonat: számlaszám nincs rajta, a határidő egyszer szerepel, a másolás 44 px-es gomb. Új „Utalás adatai” alsó lap kedvezményezettel és utalásonként egy másológombbal. Az önkormányzatnak szóló befizetés megrajzolva (`00_elemek`).
4. Befizetés után: „Befizetted, ma 9:38-kor.”, fehér lap zöld pipával, a gilos-csík kikerült, az elsődleges gomb Bence kérésén.
5. Dosszié: legfelül „Rád vár” konkrét gombbal; az általános feltöltés másodlagos.
6. Hónaplapozó: csak „‹ Szeptember”, a jövő hónapnak nincs gombja.
7. Lenyomott sor: #F0F5F2 és 3 px-es palackzöld csík.
8. Saját buborék: #3B6E5A, fehér szöveg.
9. Gyorskérések: egy sor, két gomb („Igazolást kérek”, „Változást jelentek”), 64 px.
10. Küldés: 44 px-es gomb, üresen szürke lap; a mező 6 px-es sarkú, nem pirula.
11. Egy közös nap: október 7. (az Indulás Kata első hete, szeptember). Egységes válaszidő-mondat.
12. Gilos: teljes körbefutó keret 2,88:1-gyel; a kivonat 4 px-es sarkú papír. A sarkok szerep szerint eltérnek (18/8/6/4).
13. Felesleges szakaszcímek törölve.
14. Kettőspontos „címke: érték” mondatok átírva („Jövedelemigazolást kértél (2025)”, „Egyenlegértesítő a NAV-tól”, „Új tevékenység bejelentése (fotózás)”, „Bence elolvasta, nincs vele teendőd.”).
15. Monogram és pötty helyett igazolványkép-hely, teljes név, „mérlegképes könyvelő”, nyilvántartási szám, „Ma 9–17-ig elérhető”.
16. A szegmenses állapotjelző megszűnt; a sorokban szó áll, a NAV-levélnek saját állapotsora van.
17. Idővonal: a folyamatban lévő lépés óra-jelet kap, a neve főnév („Bejelentés a NAV-nál folyamatban”); a hátralévők szaggatott körrel.

Ezen felül: az alsó sáv ikonjai újra rajzolva; a nyugtafotón a dátum az új történethez igazítva; a chat időpontjai az állapotsor 9:41-e elé kerültek.

## 8. Önkritika

- **A kivonat még mindig magas** (kb. 470 px), mert a három összeg és a közlemény rajta maradt. Az első képernyőn Bence kérése a gombjával együtt látszik, a határ-mérők már nem.
- **A gilos-keret** most erős és egyedi, de sűrű. Ha soknak hat, a szálak száma 10-ről 8-ra vehető, a szín maradhat.
- **Az igazolványkép helye** most szürke alak, ami sablonosnak hat. Valódi fotóval lesz igazán más; amíg nincs, inkább maradjon üresen, mint hogy AI-arc kerüljön oda.
- **Egy színcsalád:** a kritika szerint minden zöld. A borostyán most csak a „rád vár” jelentést viszi; második márkaszínt szándékosan nem tettem be, mert a nyugalom ebből jön. Ha a tulaj szerint unalmas, ez a következő kérdés.
- **„Utalás adatai”:** öt 44 px-es keretes gomb egymás alatt. Ez egy segédlap, a pontos másolás itt fontosabb a csendnél, de sűrű.
- **A teljes kitöltésű adómentes-mérő** megijesztheti azt, aki a teli csíkot túllépésnek olvassa. A mondat megnyugtat, de lehet, hogy elég a mondat is.
- **Nincs megrajzolva:** a webes változat, a Fiók képernyő, az „Igazolást kérek” alsó lapja és a „Befizettem” mozgása (csak leírva).
- A betűket a Google Fontsról tölti; élesben magunknak kell kiszolgálni őket (OFL, megengedett).
