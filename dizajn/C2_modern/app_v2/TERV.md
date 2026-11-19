# Kézjegy C2: modern tintakék levélpapír (app_v2)

2026-11-17, **5. kör** (3D ikonok, rajzolt Bence), és 2026-11-18, **a szigorú átnézés javításai** (00. pont). Előtte a 4. kör: a tulaj a C („Kézjegy”) irányt választotta, és a 3. kör után ezt kérte: **„Alul a gomboknak lehetnének színei.”** A 4. kör erről, a design-kritika és a persona-próba (Szabó Kata, 45, fodrász) javításairól szólt (1–8. pont). Az 5. kör a 0. pontban van, és ahol a kettő ütközik, a 0. pont érvényes.

- **A 4. kör végállapota** (HTML, PNG, tokens.css, kozos.js a régi vonalas ikonokkal, TERV, eszközök): `_regi/kor4_vege_3d_ikonok_elott_2026-11-17/`.
- A 3. kör állapota változatlanul megvan: `_regi/kor3_elott_2026-11-17/`. A mappa neve félrevezető: a 3. kör **végeredménye** van benne, vagyis a 4. kör előtti állapot (HTML, PNG, tokens, TERV, eszközök). Bájtra egyezik azzal, ami a 4. kör előtt itt volt.
- A C eredetije érintetlen: `../../C_tintakek_kezjegy`.
- Törölt fájl nincs. A régi képelemek (fémes K-ikon, laptop, bélyegző-tárgy, teli mappa, S-hullámos guilloche-csempe) az `../assets/` alatt maradtak, csak a képernyők már nem használják őket.

A számok mintaszámok, nem adótanácsok. A nyilvántartási szám (123456) helykitöltő. A képernyők időpontja 2026. október 9., péntek, 10:24. Kivétel a 11-es: november 2., 8:12.

---

## 00. A szigorú átnézés javításai (2026-11-18, az 5. kör után)

Az 5. kör szigorú átnézése négy szabálysértést talált: a vonalas, KB-monogramos BEFIZETVE-bélyegzőt, a sötét ikonok alatti
halványkék fényfoltot (`.fenyben`), az író sor csatológombja mögötti fehér kört és a körvonalas lépésjeleket. Ezek és a
többi pont (A1–A9, B) javítva. **Ahol ez a szakasz és a 0. pont ütközik, ez érvényes.**

- **Előtte lévő állapot** (HTML, PNG, tokens.css, kozos.js, TERV, eszközök, illusztrációk): `_regi/kor5_vege_szigoru_atnezes_elott_2026-11-17/`. Törölt fájl nincs.
- **Költség:** 0 USD (egy új ikonlap az ingyenes Recraft-tal, lásd lent).

**Mindenhol (A):**

| Pont | Mi volt | Mi lett |
|---|---|---|
| A1 bélyegző | Vonalas tollkék bélyegző (gyűrűk, íves szöveg) a **KB** monogrammal a 08 lapján és a levél sarkán | A jóváhagyott 3D ibolya pecsét (B lap 4., „Befizetve/kész”). 08: 84 pt, középen, árnyék nélküli változat, alatta a `.targy` CSS-talpárnyéka, az „üt le” animáció megmaradt (1,15 → 1, 180 ms). Levél sarka (03_allapot): 44 pt, a megszólítás mellett. A `#monogram` szimbólum kikerült a `kozos.js`-ből; a monogram útvonala a `kezjegy_utak.js`-ben maradt, de semmi sem használja. |
| A2 fényfolt | `.fenyben`: 62%-os halványkék sugaras korong a sötét kamera/tálca alatt | A szabály és minden használata törölve. **Fotózás-gomb: fehér, 2 pt-os tintakék gyűrű, tinta felirat**, benne az árnyék nélküli kamera 34 pt-on. **Elsődleges (tintakék) gomb: csak szöveg** („Kivonatok feltöltése” 02, „Fotózás” 11). 09 „még egy oldal”: fehér csempe a kamerával (a szaggatott keret is kikerült). |
| A3 lépésjelek | Gyűrű ponttal, körvonalas „4”, üres karika (02, 05) | Tömör korongok, körvonal nincs, akkorák, mint a pecsét (22–24 pt): mostani lépés tintakék korong fehér számmal, hátralévő `#DDE3EC` korong tinta számmal. 02: pecsét, pecsét, „3”, „4”. 05: „Beadva” = „4”. |
| A4 árnyékok | A B lap ikonjainak talpárnyéka 40–44 pt-on szürke csíknak látszott (irat, csengő), az A lapéinak nincs | Árnyék nélküli vágás a B lap mind a 8 ikonjáról: `../assets/ikon3d/<név>_arnyektalan_24|28|36|44@2x|@3x.png` (`../assets/_eszkozok/vagas_kiegeszito.py`). Ezek vannak most kint (irat, nyugta, kamera, számológép). Az iratnál a fehér lap széle 1,5 px-en kicsit sötétebb, hogy fehér lapon is legyen széle. |
| A5 alsó fátyol | Átlátszó volt a fülsor magasságában: a fülkapszula és a Fotózás-gomb közti résen szöveg és nyugtaszél látszott (08_allapot, 11); a 03-on a gyorsgomb-lap a fülsorhoz ért | `.alj-fatyol`: a fülsor tetejétől (760) lefelé teljesen fed, fölötte 12 px átmenet. 03: a gyorsgomb-lap alja 742-n, alatta 18 pt tiszta alap (a levél, az utalás-lap és a gyorsgomb-lap pár pontot szorult). 08_allapot: a „Feljegyezve okt. 9., 10:24 · Mégsem fizettem be” egy sorba került, így a gyorsgomb-lap ott is teljesen a fülsor fölött áll (alja 740). 06: a fátyol az író sor fölött fed, a beszélgetés 52 px-szel rövidebb, a legutóbbi üzenet és az ideje teljesen látszik. |
| A6 optikai méret | Üzenetek a legkisebb, Fiók a legmagasabb; a gyorsgomboknál a zöld buborék a legnehezebb, a halvány oklevél szinte eltűnt | Fülsor: a doboz 28 pt marad (a feliratok egy vonalon), a tárgyat `scale` igazítja a terület (a `_56@3x` alfája) és a magasság szerint: Főoldal 28, Dosszié ≈27, Üzenetek ≈31, Fiók ≈26 pt; forrás a `_36` fájl. Gyorsgombok: Feltöltés 54, **Kérdezek 50**, **Igazolás 58** (a `_72` fájlból), Határidők 54 pt, **közös talpvonalon** (`.tg` doboz, a tárgy alatti átlátszó sáv negatív margóval levonva). |
| A7 két kész-szín | Ibolya pecsét a zöld „Feldolgozva” mellett, zöld „7 irat rendben”, ibolya pecsét halványzöld címkén (09) | **Egy kész-szín: az ibolya pecsét.** Az állapotszó minden állapotban félkövér tinta (`.allapot .szo`, 650). A 04 „rendben” tinta. A 09 tippje fehér címke tinta szöveggel és a pecséttel. A zöld tokenek (`--kesz`, `--kesz-alap`) és a `.cimke.kesz` törölve. |
| A8 halott vonalas CSS | `svg.i`, `.nyil`, `.m-kek/-turkiz/-ibolya/-borostyan`, `.cimke svg`, `.allapot svg`, `.szignal`, a 03 `.ellenoriz svg.i` | Mind törölve, a pasztell alap-tokenekkel együtt (`--kek-alap`, `--turkiz-alap`, `--ibolya-alap`, `--turkiz`, `--ibolya`). Így vonalas ikon vagy pasztell kör véletlenül sem kerülhet vissza. |
| A9 Bence fehér lapon | A karakter törtfehér korongja fehér lapon eltűnt, nem volt széle (04, 05, 07) | Fehér felületen 1 px `var(--hajszal)` gyűrű (`.lap img.arckep`, `.lap img.arc-kicsi`, `.sheet img.arc-kicsi`). A tintakék sávon (02, 06) és a kamerán (09) nincs. |
| 06 csatolás | Fehér kör a 3D tálca mögött az író sorban | A tálca (30 pt) a mező **belsejébe** került, balra; kör nincs mögötte. Egy lebegő mező: tálca · „Írj Bencének…” · „Küldés”. |
| Aktív fül | Halk szürke lencse a „Főoldal” ikon mögött (alak egy ikon mögött) | Tintakék félkövér felirat + 3 pt-os, 20 pt széles tintakék vonás a felirat alatt. Az ikon mögött nincs semmi. |
| Sorikonok | 40 pt, a kész-jel lent jobbra (a nyugta talpát takarta) | **44 pt**, a kész-jel a tárgy **jobb felső** sarkán (fehér peremmel, ami csak a tárgytól választja el). |

**Új tárgyak (B02.4, B04.1–3): ikonlap C.** Egy lapon, ugyanazzal a prompt-kerettel, mint az A és B lap (4 × 2, szemből, stúdiófény, ugyanaz a paletta), ingyenes Recraft (`recraft/recraft-v4.1-flash-v2:free`), 0 USD: `../assets/_nyers/ikonlap_c_v1.webp` (prompt: `../assets/_nyers/k25_ikonlap_c.json`, napló: `../assets/_naplo.md`). Vágás árnyék nélkül, FILL 0,86, mint az A lapon: `../assets/ikon3d/<név>_24…72@2x|@3x.png`, előnézet: `../assets/ikon3d/_elonezet_kiegeszito.png`.

| Tárgy | Hol |
|---|---|
| `boritek` (fehér boríték tintakék fedőlappal) | 04 „Levél a NAV-tól” (a csengő helyett, ami értesítést jelent, nem levelet) |
| `szamlak` (három számla legyezőben, kobaltkék fejléccel) | 04 „Kiállított számláid, 4 db”, 11 „A kiállított számláid maguktól jönnek” |
| `bevallas` (nyomtatvány tintakék fejléccel, ibolya pecséttel) | 04 „Bevallás a III. negyedévről” |
| `tepnaptar` (tépőnaptár tintakék fejléccel, két karikával, üres lapokkal) | 02 a bemutatkozó hívás nagy tárgya: `../assets/illusztraciok/tepnaptar_3d@2x|@3x.png`, 79 × 96 pt, a `.targy` dobozban, alapvonal 108. A lapon HTML-szöveg: „OKT. 15.” és „10:00”. A fejlécre nem került szöveg, mert a karikák belelógnak; a „csütörtök” a tárgy alatti mondatban áll. A kézzel rajzolt `illusztraciok/tepnaptar.svg` megmaradt, de nem használjuk. |
| `nyugta_uj`, `lakat`, `ora`, `kivonat` | **Tartalék, nincs kint.** A `nyugta_uj` nyomtatott sorokkal és cakkos széllel készült (lásd a nyitott kérdéseket). |

A 02 „Naptárba teszem” gombról a borostyán asztali naptár lekerült (két különböző naptár állt egymás alatt): szöveges másodlagos gomb.

**Képernyőnként még (B):**
- **02:** az elsődleges gomb csak szöveg; lépéssor pecsét, pecsét, „3”, „4”; 3D tépőnaptár; „Naptárba teszem” ikon nélkül.
- **03:** gyorsgombok optikai mérete és talpvonala; 18 pt levegő a fülsor fölött; fehér Fotózás-gomb; aktív fül vonással; nyugta 44 pt, jel jobb fent; irat árnyék nélkül, sötétebb lapszéllel; „Feldolgozva” tinta; befizetve: 3D pecsét a levél sarkán, a „Feljegyezve…” sor egy sorban.
- **04:** négy különböző tárgy a négy iratfajtára (nyugta, irat, számlák, boríték, bevallás); kész-jel jobb fent; „7 irat rendben” tinta; Bence hajszálgyűrűvel.
- **05:** a „Beadva” tömör „4”-es korong; a „Feldolgozva” melletti lebegő 30 pt-os Bence kikerült; a megjegyzés alatt 34 pt-os Bence mellett a neve is: „**Bence**, hétfő 9:20”.
- **06:** csatolás a mezőben, kör nélkül; a legutóbbi üzenet teljesen látszik.
- **07:** Bence hajszálgyűrűvel (más nem változott).
- **08:** 3D pecsét a vonalas bélyegző helyett.
- **09:** fehér tipp-címke; „még egy oldal” fehér csempe a kamerával.
- **11:** az elsődleges „Fotózás” csak szöveg; számlák-tárgy és árnyék nélküli nyugta; fehér Fotózás-gomb.
- **01, 10:** nem változott (a PNG bájtra azonos az előzővel).

**Új kontraszt-párok (WCAG):** Fotózás-gomb felirata tinta a fehéren 17,05:1, a gyűrű tintakék a fehéren 14,6:1; aktív fül tintakék a fülsoron 14,3:1, a vonás ugyanez; „3” fehér a tintakék korongon 14,6:1; „4” tinta a `#DDE3EC` korongon 13,2:1 (a korong maga a fehér lapon csak 1,3:1, de a jelentést a szám hordja); a naptárlapon „OKT. 15.” 6,6:1, „10:00” 11,3:1; a 09 tipp tinta a fehéren 17,05:1. A hajszálgyűrű (1,25:1) díszítés, nem hordoz jelentést.

**Nyitott kérdések a tulajnak (ebből a körből):**
- **Nyugta-ikon:** a jóváhagyott B lapos nyugta 44 pt-on is inkább felcsavarodó szürke szalagnak látszik, mint nyugtának. Készült egy új (`../assets/ikon3d/nyugta_uj_*`, nyomtatott sorok, cakkos alj, a C lapon), de nincs kint, mert a nyugta a jóváhagyott lapról jön. Cseréljük?
- **A C lap tárgyai** (boríték, számlák, bevallás, tépőnaptár) a szigorú átnézés kérésére készültek, a tulaj még nem látta őket. Ha nem tetszenek, a 04 visszaállítható az irat/csengő párosra (a régi HTML a `_regi/kor5_vege_szigoru_atnezes_elott_2026-11-17/`-ben).
- **A bélyegző:** a KB-s tollkék bélyegző helyett most a 3D pecsét áll. Ha a tulaj a régi gumibélyegző-hangulatot szerette, monogram nélkül visszahozható, de akkor az vonalrajz marad.

---

## 0. Az 5. kör: vonalas ikon sehol, jóváhagyott 3D ikonok, rajzolt Bence

**A tulaj döntései (11-17 éjjel):**
- a gyorsgombok mögötti pasztell színes körök „nagyon rosszak”;
- „vektor ikonok sehol ne legyenek”: vékony vonalas ikon egyik képernyőn sem maradhat;
- jóváhagyta a két színes, valószerű 3D ikonlapot (`../assets/_nyers/ikonlap_a_v2.webp`, `ikonlap_b_v1.webp`); szétvágva: `../assets/ikon3d/` (16 ikon, 24–72 pt, @2x/@3x, a vágó: `../assets/_eszkozok/vagas_ikon3d.py`);
- a KB monogram helyett Bence a rajzolt karakter: `../assets/avatar/karakter_1_lapos@2x/@3x.png` (a bal oldali, lapos stílus);
- a nagy tárgyképek maradnak.

**Szabályok, ahogy most a képernyőkön vannak:**

| Hol | Mi lett |
|---|---|
| Gyorsgombok (03) | Maga a 3D tárgy, 54 pt, a felirat fölött a fehér lapon. **Kör nincs mögötte.** Feltöltés = tálca, Kérdezek = zöld buborék, Igazolás = oklevél ibolya pecséttel, Határidők = borostyán asztali naptár. |
| Fülsor | 3D ikonok felirattal (ház, mappa, két buborék, alak), optikailag kiegyenlítve (00. pont, A6). Aktív fül: **tintakék, félkövér felirat** + 3 pt-os tintakék vonás alatta (11-18; a szürke lencse kikerült). Az ikon nem színeződik, pasztell nincs. |
| Fotózás-kör | 11-18: **fehér kör, 2 pt-os tintakék gyűrű**, tinta felirat, benne az árnyék nélküli 3D kamera (34 pt). A tintakék kör és alatta a fény kikerült. |
| Sorikonok (03, 04, 11) | 3D tárgy **44 pt-on** (11-18), kör nélkül: nyugta = papírtekercs, szerződés = irat, kiállított számlák = számlaköteg, NAV-levél = boríték, bevallás = nyomtatvány pecséttel, havi dosszié = mappa. A B lap ikonjai árnyék nélkül. |
| Kész-jel | Az ibolya pecsét (befizetve), **az egyetlen kész-szín** (11-18: a zöld állapotszó tinta lett). Sorikon jelvényeként 19 pt fehér peremmel a tárgy jobb felső sarkán, az idővonalon és az állapotsorban 22–24 pt, a levél sarkán 44 pt, a 08 lapján 84 pt. A kész lépéseket összekötő vonal ibolya (02, 05). |
| Várakozó jel (óra) | Nincs kint 3D óra: az állapotszó („Feltöltve”, „Bence látta”) mondja meg. Az idővonal hátralévő lépése 11-18 óta **tömör `#DDE3EC` korong a sorszámmal** (az üres karika vonalas ikonnak hatott). A C lapon van tartalék óra (`ora_*`). |
| Gombok ikonnal | Csak a **másodlagos** (világoskék) és a fehér gombokon, 3D ikon 26–28 pt-on: Kivonat/Fájl feltöltése = tálca, Válaszolok / Kérdezek róla = zöld buborék, Kész, feltöltöm = tálca. Az elsődleges tintakék gombon nincs ikon (11-18), a „Naptárba teszem” ikon nélküli. |
| „Hogyan jött ki?” (03, 08 sáv) | A nyíl helyett a borostyán számológép, balra. |
| Nyilak, X, plusz, villám, kapocs, küldés | **Nincs ikon, szöveg van.** Vissza-nyíl → „Vissza az októberi dossziéhoz” (05), „Vissza a főoldalra” (06), aláhúzott link. A sorok végéről a `›` kikerült (az egész sor koppintható, a bal oldali tárgy jelzi). Bezáró X → „Bezár” kapszula (07); a 08-on nincs, ott a „Rendben” zár. Kamera: „Mégse”, „Vaku: auto”. Küldés → „Küldés” kapszula. Plusz → 3D tálca (04) vagy 3D kamera (09). |
| Bence | Kerek rajzolt karakter, ugyanakkora, mint a KB-kör volt: 48 pt (02), 60 pt (06). A KB szignó helyén is ő van: 44 pt a 04-es kártya fejében, 34 pt a 05 megjegyzésénél („Bence, hétfő 9:20”) és a 07 aláírás-sorában, 28 pt a 09 „Bence kapja meg” előtt. Fehér lapon 1 px hajszálgyűrűvel (11-18). A 05 idővonaláról a lebegő kis arc kikerült. |
| Kérés-csempék (06) | Semleges szürke csempe (`#EEF1F6`, hajszálkeret), 24 pt-os 3D ikon: igazolás = oklevél, „Megváltozott egy adatom” = alak. A pasztell ibolya/türkiz alap kikerült, mert a szín most az ikonból jön. |
| Widget-kezdőképernyő (10) | A más appok helykitöltőiről a vonalas jelek lekerültek: csak a színes négyzet és a név maradt, így a Kézjegy widget és ikon emelkedik ki. A „Keresés” pirulán sincs nagyító. |

**Ami szándékosan maradt (nem UI-ikon):** a telefon állapotsora (térerő, akku), a Kézjegy app-ikon (K + kézvonás), a szóvédjegy kézvonása, a Google- és az Apple-logó a belépőgombokon (a cégek előírják), Bence kézzel írt aláírása a levélen, a nagy tárgyképek (3D tépőnaptár, üres mappa, nyugtafotó). **11-18: a tollkék BEFIZETVE-bélyegző a KB szignóval kikerült** (03_allapot, 08), helyén a 3D ibolya pecsét.

**Kis méret, élesség:**
- Minden ikon a nála nagyobb vagy egyenlő pt-méretű fájlból jön, @2x/@3x `srcset`-tel, tehát mindig lefelé méretezünk (pl. 54 pt → `_56@2x`, 40 pt → `_44@2x`, 19 pt → 20 pt-os jel).
- **A pecsét kis méretben:** a B lapon a pecsét lebeg, az árnyéka külön csíkban van alatta. 19–24 pt-on ez kóbor aláhúzásnak látszott, és a pecsét a jelvényben balra fent ült. Ezért külön, árnyék nélküli, középre tett változat készült: `../assets/ikon3d/befizetve_jel_20|24|28|44|84@2x|@3x.png` (11-18: a 44 és a 84 is), az `_eszkozok/ikon_jel.py` vágja a mesterből (a mester és a többi ikon érintetlen). A 84 pt @3x felskálázott (a mester tárgya 155 × 171 px); a @2x lövés ezt nem használja.
- **Sötétkék tárgy tintakék alapon:** az 5. körben a tárgy alá halk tollkék fény került (`.fenyben`). **11-18: ez is pasztell foltnak látszott, kikerült** (00. pont, A2): a Fotózás-gomb fehér lett, az elsődleges gombokon nincs ikon, a 09 csempéje fehér.
- Hunyorítás (`_hunyoritas.jpg`): a 03 gyorsgomb-lapja blur 6-nál négy külön színes tárgyként marad meg (kék, zöld, fehér-ibolya, borostyán); az elsődleges gombok, a Fotózás-kör és a fehér lapok ugyanúgy elválnak, mint a 4. körben.

**Új kontraszt-párok (WCAG):** aktív fül tintakék a lencsén 12,9:1; nem aktív fül 6,5:1; csempefelirat a szürke csempén 15,1:1; „Vissza az októberi dossziéhoz” 8,7:1; „Vissza a főoldalra” 14,6:1; a 09 „Bence kapja meg” (doboz nélkül, árnyékolt fehér szöveg) a kamerakép legvilágosabb pontján is 8,1:1. A letiltott „Küldés” 3,4:1 (letiltott vezérlő, a WCAG nem írja elő).

**Nyitott kérdések a tulajnak** (11-18: a „két kész-szín”, az „árnyék csak a B lapon” és a „sok irat-ikon” kérdést a szigorú átnézés eldöntötte, lásd a 00. pontot; az új kérdések ott vannak):
- **Vissza-linkek:** a nyíl helyett most szöveg áll. Ez hosszabb, de egy 45 éves felhasználónak egyértelműbb. Ha a tulaj a rövid „Október” formát kéri, a nyíl nélkül az kevésbé olvasható gombnak.

---

## 1. (4. kör) A tulaj kérése: színes gyorsgombok

> **Az 5. körben felülírva:** a pasztell körök, a csempék és ikonok műveletszínei kikerültek (lásd a 0. pontot). Ez a szakasz a 4. kör döntését írja le.

**Ami volt:** négy fehér kör az alapon, tintakék ikonnal. Revolut-szerű, egyforma sor volt, és a kritika szerint is „sablon”.

**Ami lett:** egy fehér lap, benne négy cella. Mindegyik cellában egy halk, színezett kör van, benne ugyanannak a színnek a mély árnyalatában az ikon. A felirat tinta színű, 13,5 pt, közepes súlyú. Mind a négy szín a tintakékhez van hangolva: tompa, nem neon.

| Művelet | Kör | Ikon | Ikon a körön | Miért ez a szín |
|---|---|---|---|---|
| Feltöltés | `#E1E9FB` | kék `#2A55B5` | 5,63:1 | a márka kékjének élénkebb rokona |
| Kérdezek | `#D7EEEC` | türkiz `#11686A` | 5,40:1 | beszélgetés; kékeszöld, hogy ne keveredjen a „kész” zöldjével (`#2B6744`) |
| Igazolás | `#E8E3F8` | ibolya `#5540A8` | 6,25:1 | hivatalos papír |
| Határidők | `#F7E8C6` | borostyán `#845300` | 5,38:1 | idő, figyelem |

A követelmény ≥ 3:1 volt. Mindegyik ≥ 5,3:1.

**Ugyanez a szín mindenhol, ahol a művelet megjelenik:**

- **Kék (Feltöltés):**
  - a feltöltés-ikon a „Kivonat feltöltése” és a „Fájl feltöltése” másodlagos gombon (03, 04, 11);
  - a dosszié szaggatott „+ Fájl hozzáadása” sora (04);
  - az Üzenetek csatoló gombja, ami kék kör (06).
- **Türkiz (Kérdezek):**
  - a „Kérdezek róla” (07) és a „Válaszolok” (05) ikonja;
  - a „Megváltozott egy adatom” kérés-csempe (06).
- **Ibolya (Igazolás):**
  - a „Jövedelemigazolás” és a „Nullás igazolás” csempe (06);
  - a beszélgetésben a „Kérésed: Jövedelemigazolás” kártya ikonköre (06).
- **Borostyán (Határidők):**
  - a „még 3 nap” címke a sávon (03) és a widgeten (10);
  - a „Legközelebb november 12-ig” ikonköre (08);
  - a „Naptárba teszem” ikonja (02).

A színezett gomboknál csak az ikon kapja a művelet színét. A gomb maga világoskék másodlagos gomb marad, így a gombfajták nem keverednek.

**A Fotózás-gomb tintakék marad**, mert az az elsődleges művelet.

**Aktív fül a lebegő fülsoron:** kobaltkék (`#2450C0`), félig kitöltött ikon és félkövér felirat, semleges szürke lencsén (`#EEF1F6`). Már nem a gombok világoskékje.

## 2. Ami a C-ből maradt (az identitás)

- A tintakék fejlécsáv a nagy számmal. A főoldalon ez a végösszeg és a határidő.
- A havi levél: 4 px-es sarkú papír, papírszál-textúra, megszólítás, Bence kék tollal írt aláírása.
- Az elefántcsont-fehér papír helyett továbbra is a színezett alap (`#DDE3EC`) fehér lapokkal.
- A tollkék bélyegző (BEFIZETVE · dátum · KB).
- A zöld csak a „kész” jele. A négy állapotszó változatlan: Feltöltve, Bence látta, Feldolgozva, Beadva.
- A tollkék szabálya: tollkék csak fehér papíron lehet. A sávon ugyanaz a toll világosabb árnyalatban jelenik meg: `#8FB0F4`, 6,7:1.
- A betű: **Geist**, egyetlen család mindenre (a 3. kör betűpróbája szerint, OFL, ő Ő ű Ű ellenőrizve, táblázatos számok). Kézírás csak az aláírás, a KB szignó, a bélyegző és az új kézvonás.

## 3. Globális javítások (G1–G7)

**G1. Egy alak, egy feladat. A világoskék csak a másodlagos gombé.**

Az alakok:

| Alak | Jelentés | Hol |
|---|---|---|
| Kapszula (999) | **csak gomb** | elsődleges, másodlagos, a sáv körvonalas gombja, a cégek belépőgombjai |
| 18 px-es lap | tartalom | minden fehér lap, a gyorsgomb-lap is |
| 4 px-es papír | a levél | csak a levél |
| 12 px | mező és kérés-csempe | beviteli mezők, az Üzenetek kérés-csempéi, a „+ Fájl hozzáadása” |
| 10 px | szegmens a sávon | hónapváltó (04, 11) |
| 6 px | állapotcímke | „még 3 nap”; a kamerán 8 px |
| Kör | gyorsművelet, Fotózás, bezárás, csatolás, fénykép helye | |

A kör-színek:
- A **bezáró gomb** semleges szürke.
- A **fénykép helye** elefántcsont (`#F4EFE4`) tintakék kezdőbetűkkel.
- A **saját buborék** tintakék fehér szöveggel. Ez lett a legjobb kontrasztú elem (14,6:1), korábban ez volt a leggyengébb.

Az állapot:
- **Sima szöveg pipával.** Az 05 zöld pirulája így lett „✓ Feldolgozva, hétfő 9:20”.
- **A befizetés:**
  - „Befizetted” a sávon;
  - óra ikon, mellette „Bence a kivonatodon ellenőrzi”;
  - nincs zöld „Befizetve” kapszula, mert az csak Kata saját állítása volt.

A vissza-gomb sima nyíl a hónap nevével (05), nincs kapszulája.

**G2. Árnyék csak a lebegő rétegeken.** Az elsődleges gombok alól eltűnt az árnyék (Belépés, Számlaszámok, Fotózás, Rendben). Árnyéka csak a fülsornak, a kerek Fotózás-gombnak, az alsó lapnak (sheet), az író sornak és a levélnek (papír) van.

**G3. Hierarchia.**

| Elem | Méret és súly |
|---|---|
| Szakaszcím | 19,5 pt, 600-as súly, 30 px levegő fölötte (korábban 15 pt, 650) |
| Gyorsgomb-felirat | 13,5 pt, 500-as súly |
| Szakasz-megjegyzés | 14,5 pt, halvány, közvetlenül a cím alatt („Ezeket neked nem kell feltöltened.”) |

**G4. Halkabb linkek.** Közepes (500-as) súly, 1 px-es aláhúzás, 4 px-re a szövegtől (korábban 650-es súly, 1,5 px).

**G5. Guilloche-rozetta a hullámtapéta helyett.** A `guilloche_rozetta.svg`-t az `_eszkozok/guilloche.py` rajzolja procedurálisan.
- Felépítése: egy epitrochoid-rózsa középen, és három, fázisban eltolt szinuszgyűrű-sáv.
- Vonalak: 0,5 px, egyenként 6,5%.
- Csak a nagy szám vagy a cím mögött áll, és kifelé elfakul. Nincs csempézés, ezért moiré sincs.
- A helye képernyőnként a `--roz-x` / `--roz-y` változóval állítható.
- A widgeten (10) kicsinyítve ugyanez.
- A kontraszt a kész PNG legvilágosabb háttérpontjából mérve: fehér 11,0:1, halvány sávszöveg 6,0:1.

**G6. Bence nem monogram-robot.** *(5. kör: a fénykép helye és a KB kör helyett a rajzolt karakter, lásd a 0. pontot.)*
- A levélből kikerült a „KB” kör. Ott aláírás, nyomtatott név és dátum áll.
- A fénykép helye két helyen maradt, elefántcsont körként:
  - a 02-n, a bemutatkozó sávban;
  - a 06 fejlécében.
- Ide élesben csak **valódi, megrendelt fénykép** kerülhet, generált arc soha.
- A 04-es kártyán a kör eltűnt. A KB szignó a lap jobb alsó sarkában áll, aláírásként.
- A 09-esen sincs kör: „Bence kapja meg”.

**G7. A levél hangja.** „Kedves Kata!”: 600-as súly, 26–27 pt. A törzsszöveg 16,5 pt, 1,62-es sorközzel. A többi UI-cím 700-as, így a levél elválik tőlük.

## 4. Illusztrációk: szemből, egy dobozban

**Generálás: ebben a körben nem volt lehetséges.** Az OpenRouter a képkimenetet csak 1,00 USD egyenleg fölött engedi. Az egyenleg 0,97 USD volt. A két hívás (tépőnaptár és üres mappa, zöld háttéren) 402-vel visszajött, költség nem keletkezett. Mindkettő be van írva az `../assets/_naplo.md`-be. A promptok készen állnak: `../assets/_nyers/k16_kor4_szembol.json`. Feltöltés után ezzel lehet újrafuttatni:

```
cd ../assets/_eszkozok && python gen.py ../_nyers/k16_kor4_szembol.json
```

**Amit helyette csináltunk.** A szemből nézett tárgyak lényegében síkok, ezért **SVG-ben rajzoltuk őket valószerűre**. Vonalrajz nincs, mert a tulaj azt túl rajzfilmesnek találta. Helyette:
- papírrost- és kartonzaj (`feTurbulence`);
- színátmenetes fény;
- fém szegecsek;
- tépett papírszél;
- egymásra fekvő lapélek;
- a karton hajtásvonala.

A háttér átlátszó. Beégetett árnyék és szürke padló nincs. A talajárnyékot a CSS rajzolja: egy vékony ellipszis közvetlenül a tárgy alatt (`.targy::after`).

**Egy doboz mindenhol:** 160 × 120 pt, a tárgy középen, kb. 96 pt magas, az alapvonala 108 pt-nál van (`.targy`).

| Hol | Tárgy | Ami változott |
|---|---|---|
| 02 | `illusztraciok/tepnaptar.svg`: tépőnaptár szemből | A laptop helyett. A laptop képernyőjén karusszel-pöttyök voltak, és Kata kérdése is ez volt: „Laptopom nincs, akkor ez nem nekem szól?” A lap üres. Az „OKT. 15.” / „CSÜT” / „10:00” valódi HTML-szöveg. |
| 08 | a levél tollkék **BEFIZETVE-bélyegzője**, nagyban, középen, −8°-ban | A „kártya pipával + bélyegzőgép” stockkép helyett. A bélyegző lapos tinta, tehát szemből van. Árnyéka nincs. Megjelenéskor 1,15-ről 1-re „üt le” (180 ms). Csökkentett mozgásnál nincs animáció. |
| 11 | `illusztraciok/ures_mappa.svg`: **üres** mappa szemből | A teli mappa helyett, amelyen papírok és gumiszalag voltak. A mappán hüvelykujj-bevágás és bordázás van. A fülön üres papírcímke, rajta a „NOVEMBER” HTML-szöveg. |

**Kettőzés nincs.** A 08-as lap mögött a levélen még nincs bélyegző (`?rejt=pecset`). Bezárás után kerül oda (08_allapot), a levél jobb felső sarkába, és már nem takarja a szöveget.

**App-ikon (01, 10):**
- lapos tintakék négyzet;
- benne a **Geist Black K**, ugyanaz a betű, mint a szóvédjegyben;
- alatta egy **kézvonás**, vagyis tollvonás: változó vastagságú, kitöltött körvonal, az `_eszkozok/kezvonas.py` adja.

Ugyanez a kézvonás áll a belépés „Kézjegy” szóvédjegye alatt. Fém, dombornyomás, árnyék nincs. Az ikon a `kozos.js` `#appikon` szimbóluma.

## 5. Képernyőnként

| Képernyő | Ami változott |
|---|---|
| **01 Belépés** | **Sáv:** tintakék sáv a rozettával; az ikon és a szóvédjegy alatt a kék tollvonás; a mondat: „**Saját könyvelő,** aki név szerint ismer. Egyéni vállalkozóknak, havi 20 000 Ft.” **Céges gombok:** a Google- és az Apple-gomb azonos (fehér, 1 px-es sötét keret, a cég saját logója); „vagy” elválasztó. **Lent:** a „Még nem vagy ügyfél?” lap valódi, másodlagos „Regisztrálok” gombbal, „15 perces hívással kezdünk”. Az alsó harmad így nem üres. |
| **02 Bekötés** | **Cím:** „Még 2 dolog kell tőled, / a többit Bence intézi.” **Bence a sávon:** a fénykép helye, „Kovács Bence, a könyvelőd”, mérlegképes, nyilvántartási szám. **1. teendő:** az idei bankszámlakivonatok, és „A tavalyi bevallásodat Bence maga tölti le a NAV-tól”. Ez Kata kérdésére felel: ha már meghatalmazta, miért kéri tőle? **Hívás:** tépőnaptár, „Bemutatkozó hívás Bencével, csütörtök, október 15., 10:00, telefonon vagy videón”. **Lépéssor:** „Titkosítva tároljuk, csak Bence látja” és „Bence bejelenti magát a NAV-nál könyvelődként”. **A `_teljes` kép:** a magasságát a lap maga méri, a kezdőjel üres helyre esik, nem ül rá a szövegre. |
| **03 Főoldal** | **Sáv:** a sávgomb fehér körvonalas, fehér szöveggel és nyíllal; a határidő mellett „még 3 nap” címke. **Levél:** „Ez már a végleges összeg.” **Utalás:** a lap fejléce „3 külön utalás a NAV-nak, 3 számlaszámra”; a szocho alatt ott a teljes neve; a gombok „**Számlaszámok**” (elsődleges) és „**Már befizettem**” (másodlagos). Ezzel a „Befizettem/Befizetem” csapda megszűnt. **Gyorsgombok:** színesek, egy lapon; az első képernyő a gyorsgomb-lap aljával zárul, nem félbevágott címmel. **„Bence kéri”:** „Csak ellenőrzéshez kell, a befizetendő összeg nem változik.” **„Idei kereteid”:** így hívják az „Idei határaid” helyett, mert Kata a „Határidők”-kel keverte; „csíkozott”; a magányos borostyán pálca kikerült; a végek tinta színűek, 14,5 pt; az adómentes rész pipa és mondat, a 100%-os tömör sáv helyett. |
| **04 Dosszié** | **Sáv:** a hónapváltó a sávba került, a cím összefoglal: „8 irat, ebből egy még Bencére vár.” **Bence kártyája:** a „7 irat rendben” egy alapvonalon áll; a kör kikerült, a szignó jobb alul van. **Lista:** a végén teljes szélességű, szaggatott „+ Fájl hozzáadása” sor. **Szakaszok:** „Amit te küldtél”, valamint „A NAV-tól kaptuk” + „Ezeket neked nem kell feltöltened.” |
| **05 Tétel** | **Fej:** sima vissza-nyíl; az állapot szöveg pipával. **Fotó:** a nyugta a sötét keretben egyenlő margóval áll (`nyugta_foto_keretben.svg`). **Bence megjegyzése:** a „vásár” helyett: „Ha máskor is kézzel adsz nyugtát, elég a hónap végén egyszerre lefotóznod a tömb lapjait.” |
| **06 Üzenetek** | **Képernyő:** saját képernyő vissza-nyíllal, fülsor nélkül, egyetlen lebegő sávval (az író sorral). **Fejléc:** az óra ikon a zöld „online” pötty helyett; a „Mérlegképes könyvelő” után nincs pont. **Kérés-csempék:** két sorba tördelnek, a művelet színében. **Beszélgetés:** a saját buborék tintakék. |
| **07 Hogyan jött ki?** | **Lap:** csak a bezáró X maradt, fogantyú nincs. **Bevezető:** megmondja, miért kétféle a bevétel („A járulékokat havonta, az SZJA-előleget negyedévente fizeted…”). **Sorok:** „Szeptemberi bevételed” / „Három havi bevételed”; a kulcsok sorai szöveggel: „TB-járulék: ennek 18,5%-a”. Az × bezáró gombnak látszott, a magyar szorzópont felsorolásjelnek. |
| **08 Befizettem (lap)** | **Bélyegző:** a nagy tollkék bélyegző, lásd a 4. pontot. **Szöveg:** „Feljegyeztük, hogy befizetted.” |
| **08 Befizettem (utána)** | **Sáv:** áthúzott szám nincs; a sávon „Befizetted”, alatta „457 380 Ft, október 9-én.” és „Bence a kivonatodon ellenőrzi.” A „Hogyan jött ki?” a saját sorában, margóval. **Bélyegző:** a levél sarkán. **Lap:** „Mind a hármat elutaltad”, pipás tételek, „Feljegyezve…”, alatta külön sorban: „**Mégsem fizettem be**” (a „Visszavonom” helyett). |
| **09 Fotózás** | **Felül:** „Bence kapja meg” (a „nézi át” helyett, kör nélkül). **Címkék:** a tipp és az oldalszám 8 px-es címke. **Bélyegképek:** a két oldal két különböző lap. **Gomb:** „Ezt újra”. |
| **10 Widget** | **Ikon:** lapos K-ikon. **Widget:** a rozetta a háttérben; a homályos idővonal és az „okt. 2. levél” helyett egy egyértelmű borostyán „még 3 nap” címke. |
| **11 Üres dosszié** | **Sáv:** a hónapváltó a sávban, „Még üres a novemberi dosszié.” **Fő lap:** üres mappa; „Fotózd le az első iratot”, „Bence ebből könyvel”. **Új sor:** „Pénztárgéppel adsz nyugtát? Elég a havi összesítőt lefotóznod a hónap végén.” Ez Kata fodrász-kérdésére felel. |

## 6. Mozgás (leírás; a PNG-k állóképek)

- **Alsó lap:** rugó, kb. 0,45 s, visszapattanás nélkül. A háttér 48%-ra sötétül. A 08-asnál 30%-ra.
- **Befizettem:** a lapon a bélyegző leüt (180 ms, sikerrezgés). Bezáráskor a levél sarkára kerül. A sávon a szám „Befizetted”-re vált (áttűnés, 240 ms). Csökkentett mozgásnál csak a végállapot jelenik meg.
- **Aláírás:** a havi levél első megnyitásakor tollsorrendben íródik ki, kb. 900 ms.
- **Kamera:** a sarokjelek a papír sarkaira ugranak, kb. 200 ms.
- **Fülsor:** fülváltáskor kiválasztás-rezgés.

## 7. Hunyorítás-próba (`_hunyoritas.jpg`)

GaussianBlur(6)-tal, és GaussianBlur(12)-vel is:
- a 03-ason a négy gyorsgomb **négy külön színfoltként** megmarad (kék, türkiz, ibolya, borostyán);
- a fehér gyorsgomb-lap elválik a fehér utalás-laptól.

Továbbra is külön marad:
- a tintakék sáv a nagy számmal;
- képernyőnként egy sötét kapszula (az elsődleges gomb) és a sötét Fotózás-kör;
- a világoskék másodlagos gombok;
- a fehér lapok, és a levél a papírárnyékával.

A 06-on a saját buborék most sötét folt, a kérés-csempék színes foltok. A rozetta GaussianBlur(6)-nál eltűnik, ez szándékos.

## 8. Kontraszt (WCAG 2.x)

Forrás: `_eszkozok/kontraszt.py`. A sáv hátterét a kész 03-as PNG-ből mérjük: a tintakékhez közeli képpontok 99,5. percentilise, benne a rozetta metszéspontjaival.
- A szöveg mindenhol ≥ 4,5:1.
- A grafika (ikon a körén, körvonal, kézvonás) mindenhol ≥ 3:1, valójában ≥ 5,3:1.

| Előtér | Háttér | Arány | Hol | Szint |
|---|---|---|---|---|
| Tinta #151C2A | Lap #FFFFFF | 17,05 | törzsszöveg, összegek, gyorsgomb-felirat | AAA |
| Tinta #151C2A | Levél papírszállal #F3F4F6 | 15,50 | a levél szövege | AAA |
| Tinta #151C2A | Alap #DDE3EC | 13,22 | szakaszcím | AAA |
| Fehér | Tintakék #17284A | 14,60 | saját buborék, elsődleges gomb, Fotózás, app-ikon K | AAA |
| Fehér | Sáv + rozetta (mért) #2C3C5B | 11,03 | végösszeg, cím, „Hogyan jött ki?” | AAA |
| Fejléc-halvány #B4C0D6 | Sáv + rozetta (mért) #2C3C5B | 6,01 | mondat a sávon, „Ft” | AA |
| Fehér 78% körvonal | Sáv | 7,43 | a sávgomb körvonala | grafika |
| Borostyán #5E3B00 | Borostyán-alap #F7E8C6 | 8,24 | „még 3 nap” (03, 10) | AAA |
| Kék #2A55B5 | Kék kör #E1E9FB | 5,63 | Feltöltés | grafika ≥ 3:1 |
| Türkiz #11686A | Türkiz kör #D7EEEC | 5,40 | Kérdezek | grafika ≥ 3:1 |
| Ibolya #5540A8 | Ibolya kör #E8E3F8 | 6,25 | Igazolás, igazolás-csempék | grafika ≥ 3:1 |
| Borostyán #845300 | Borostyán kör #F7E8C6 | 5,38 | Határidők, „Legközelebb” | grafika ≥ 3:1 |
| Kék / türkiz / borostyán ikon | Színezett gomb #D6E0F0 | 5,15 / 4,91 / 4,90 | ikon a másodlagos gombon | grafika ≥ 3:1 |
| Tinta | Ibolya / türkiz csempe | 13,62 / 14,07 | csempefelirat (06) | AAA |
| Kék #2A55B5 | Lap | 6,85 | „+ Fájl hozzáadása” | AA |
| Kobalt #2450C0 | Lencse #EEF1F6 | 6,22 | aktív fül | AA |
| Halvány #535D72 | Lap | 6,61 | másodlagos szöveg (4. kör: sötétebb) | AA |
| Halvány #535D72 | Fülsor #FCFDFD | 6,49 | nem aktív fül | AA |
| Szegmens-felirat #D0D8E6 | Szegmens a sávon #41506B | 5,67 | nem kiválasztott hónap | AA |
| Tintakék #17284A | Fehér | 14,60 | kiválasztott hónap, „Kész, feltöltöm” | AAA |
| Tintakék szöveg #22396A | Színezett gomb #D6E0F0 | 8,48 | másodlagos gomb | AAA |
| Tintakék szöveg #22396A | Elefántcsont #F4EFE4 | 9,84 | KB a fénykép helyén | AAA |
| Tollkék #2546A6 | Lap | 8,38 | aláírás, szignó, bélyegző | AAA |
| Tollkék a sávon #8FB0F4 | Tintakék | 6,73 | kézvonás (ikon, szóvédjegy) | grafika |
| Kész #2B6744 | Lap / Kész-alap | 6,72 / 5,67 | állapot, kamera-tipp | AA |
| Fehér | Kezdőképernyő #4F6586 | 5,94 | appnevek (10) | AA |

A teljes, géppel írt tábla 43 sor: `python _eszkozok/kontraszt.py`.

---

## Fájlok

| Fájl | Mi ez |
|---|---|
| `tokens.css` | Tokenek és közös elemek. Új benne: a műveletszínek (`.m-kek`, `.m-turkiz`, `.m-ibolya`, `.m-borostyan`), a `.gyors` lap, a `.csempe`, a `.cimke`, a `.targy` doboz, a `.gomb-sav`, a `.szegmens-sav` és a rozetta a `.fejlec`-en. |
| `kozos.js` | SVG-szimbólumok. **5. kör: a vonalas UI-ikonok (35 db) kikerültek**, csak az aláírás, a monogram (a bélyegzőhöz), a kézvonás, az app-ikon és az állapotsor maradt. Paraméterek: `?allapot=befizetve`, `?rejt=pecset`, és a `?meres=1` (a lap magasságát a lövéshez). A régi készlet: `_regi/kor4_vege_3d_ikonok_elott_2026-11-17/kozos.js`. |
| `../assets/ikon3d/` | A 16 jóváhagyott 3D ikon (`<név>_<pt>@2x|@3x.png`), a HTML-ben `<img class="i3">`; plusz a `befizetve_jel_*` jel (`_eszkozok/ikon_jel.py`), a B lap árnyék nélküli változatai (`<név>_arnyektalan_24…44`) és a C lap 8 tárgya (11-18, `../assets/_eszkozok/vagas_kiegeszito.py`, `_info_kiegeszito.json`, `_elonezet_kiegeszito.png`). |
| `../assets/illusztraciok/tepnaptar_3d@2x|@3x.png` | A 02 3D tépőnaptára (a C lapról, szorosan vágva, 96 pt magas). |
| `_sorrend.txt` | A végleges PNG-k sorrendje küldéshez: a 11 fő képernyő (03 elöl), utána a 08_allapot és a `_teljes` képek. |
| `_regi/kor5_vege_szigoru_atnezes_elott_2026-11-17/` | Az 5. kör vége, a szigorú átnézés javításai előtt (HTML, PNG, tokens, kozos.js, TERV, eszközök, illusztrációk). |
| `../assets/avatar/karakter_1_lapos@2x|@3x.png` | Bence rajzolt arca (`img.arckep`, `img.arc-kicsi`). |
| `_eszkozok/ikon_jel.py` | Az árnyék nélküli, középre tett kis pecsét a mesterből. |
| `guilloche_rozetta.svg` | A rozetta (`_eszkozok/guilloche.py`). |
| `illusztraciok/tepnaptar.svg`, `illusztraciok/ures_mappa.svg` | A szemből rajzolt tárgyak (kézzel írt SVG, átlátszó). 11-18: a tépőnaptárt a 02 már nem használja (helyette a 3D), az üres mappa a 11-en maradt. |
| `nyugta_foto_keretben.svg` | A nyugtafotó egyenlő margóval (05). Az eredeti `nyugta_foto.svg` változatlan. |
| `_eszkozok/lovesz.py` | Képernyőképek. A `_teljes` képek magasságát a lap méri (`--dump-dom`). A `08_befizettem_allapot` is benne van. |
| `_eszkozok/kezvonas.py` | A kézvonás. A `--beir` kapcsoló a `kozos.js`-be írja. |
| `_eszkozok/guilloche.py`, `kontraszt.py`, `hunyoritas.py` | A rozetta, a kontraszttábla, és a `_hunyoritas.jpg` / `_attekintes.jpg`. |
| `_regi/kor3_elott_2026-11-17/` | A 3. kör teljes állapota (a 4. kör előtt). |
| `_regi/kor4_vege_3d_ikonok_elott_2026-11-17/` | A 4. kör teljes állapota (az 5. kör előtt), a vonalas ikonokkal. |

Újrafuttatás, internet nélkül:

```
python ../assets/_eszkozok/vagas_kiegeszito.py && python _eszkozok/guilloche.py && python _eszkozok/kezvonas.py --beir && python _eszkozok/ikon_jel.py && python _eszkozok/lovesz.py && python _eszkozok/hunyoritas.py && python _eszkozok/kontraszt.py
```

## Mire figyelj (önkritika)

- **5. kör:** a `kontraszt.py` táblája még a 4. kör pasztell ikon-párjait és a zöld kész-színt is méri; ezek a képernyőkön már nincsenek (a 00. és a 0. pont kontraszt-sorai az érvényesek).
- **11-18:** a 11-es első képernyőjén a második tájékoztató sor („Pénztárgéppel adsz nyugtát?”) a fülsor fölötti átmenetben vágódik el. Ez görgetési állapot; a fülsor magasságában már semmi nem látszik át.
- **11-18:** a C lap tárgyai a jóváhagyott lapok mellé készültek, ugyanazzal a prompttal; a stílus egyezik, de a tulaj még nem hagyta jóvá őket (00. pont, nyitott kérdések).
- **5. kör:** a 09 felső sora (Mégse · Bence kapja meg · Vaku: auto) 390 pt-on kifér, de kisebb telefonon (375 pt) a „Vaku: auto” „Vaku”-ra rövidülhet.

- **A tárgyak SVG-ből vannak, nem generált fotók** (11-18: a tépőnaptár már a generált 3D; az üres mappa még SVG). A kreditküszöb miatt nem lehetett generálni. Valószerűek és szemből látszanak, de egy jó fotó gazdagabb lenne. Ha a tulaj feltölti az egyenleget, a kész promptokkal (`k16_kor4_szembol.json`) zöld háttéren generálható. A kivágás és a CSS-árnyék ugyanígy működik.
- **A mappa fülén a „NOVEMBER” kicsi** (6,4 pt), mert a 160 × 120-as doboz szabály. @2x-en olvasható. Ha nagyobb kell, a fül szélesebb lehet.
- **„Igazolás” felirat.** Kata „igazolvány”-nak olvashatja. Hosszabb felirat (pl. „Igazolást kérek”) két sorba törne a négy cellában. Ha a tulaj kéri, a cellák kétsoros feliratot kapnak.
- **Feltöltési belépők.** Négy út vezet a feltöltéshez: Fotózás-gomb, „Feltöltés” gyorsgomb, „+ Fájl hozzáadása”, „Kivonat feltöltése”. A szín (kék) most összeköti őket. A következő körben a „Feltöltés” gyorsgomb nyithatna egy választót: Fotózás / Fájl / Kivonat.
- **Bence fényképe még hiányzik.** A „valódi könyvelő” ígéret élesben csak a megrendelt, valódi fotóval teljes. A helye két képernyőn kész.
- **A pénztárgépes mondat (11)** gyakorlati javaslat, nem jogi állítás. Élesben Bence fogalmazza meg.
- **A 08_allapot-on** a gyorsgomb-lap 11-18 óta teljesen látszik a fülsor fölött (a „Feljegyezve…” sor egy sorba került).
- **Nincs megrajzolva:** a „Számlaszámok” lap (három számlaszám, közlemény, másológombok, lépésenként), a „Feltöltés” választó, a Fiók képernyő, a sötét mód.
