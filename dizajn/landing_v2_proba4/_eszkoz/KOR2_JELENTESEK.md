## Gemini a mostani oldalról: tervezőként 8/10, vállalkozóként 6/10-re tűnik AI-sablonnak

Egy hívásban ment ki mind a 9 gépes kép, 1000 px szélesre kicsinyítve, JPEG-ben. A válasz hiba nélkül, teljesen megjött (finish: stop).

**Költség: 0,0259 $** (usage.cost). Bemenet 12 043 token, kimenet 4 511 token, a keret 0,05 $ volt. Második hívás nem volt.

**Mentve:**
- Válasz (a prompttal és a usage-dzsel együtt, képek nélkül): C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_ai_hatas_1.json
- Szkript (`--proba` kapcsolóval hívás nélkül fut): C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_ai_hatas.py
- Az elküldött képek: D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/gemini_ai_hatas/gep_01.jpg … gep_09.jpg

**Összkép:**
- **Tervező:** „tipikus v0/Lovable/Tailwind landing”. Túl sok a kis doboz, a szakaszok szivárványszerűen váltják a pasztell hátteret, a „Neked ebből” kiemelők pedig gépiesek.
- **Vállalkozó:** „csili-vili, startupos”. Inkább külföldről fordított szoftvernek hat, mint megbízható magyar cégnek.
- **A legerősebb AI-jel:** a hétszer ugyanúgy ismétlődő „Neked ebből” doboz és a pasztell háttérváltások.

## Mi tűnik AI-nak és miért (rangsorolva)

1. **„Neked ebből:” dobozok (2–5. kép).**
   - Miért: a színes bal szegélyű kiemelő doboz dokumentációkban és AI-összefoglalókban szokásos. Didaktikus, és megtöri az olvasást. A „Funkció → Neked ebből” gépies sablonmondat.
   - Javítás: a doboz, a szegély és a „Neked ebből:” címke is menjen. A mondat legyen a bekezdés utolsó mondata, legfeljebb kicsit vastagabb betűvel.
2. **Minden szakasznak más a háttere (sárgás, sötétkék, menta, levendula, fehér, vajsárga, kék).**
   - Miért: olyan, mintha szakaszonként promptolták volna. A menta és a levendula egy adós szolgáltatásnál „gyermeteg”, a vállalkozó szerint sem komoly.
   - Javítás: kéttónusú rend. A tartalom kb. 80%-a fehér vagy nagyon világos szürke (#F8FAFC). Sötét vagy kék csak a „Mit kapsz” blokk, a hős és a záró CTA. A menta és a levendula kimarad.
3. **„Mit kapsz” elrendezése.**
   - Miért: 7 szinte pixelre azonos ismétlés (számkör, cím, bekezdés, kiemelő doboz, telefon lekerekített panelben, mögötte színes ragyogás), mechanikus bal-jobb váltakozással. Ez a „2023-as AI SaaS-sablon védjegye”.
   - Javítás: a ragyogás és a telefonok körüli panel menjen, a telefon közvetlenül a sötét alapon álljon, árnyékkal. Gemini azt is javasolja, hogy a 7 lépés 3 csoportba olvadjon: számlák és félretenni; papír, fotó és Dosszié; könyvelő és keretek.
4. **Könyvelő-szakasz (6. kép).**
   - Az idővonal szürke függőleges vonallal és ikonokkal sablonos „How it works / roadmap” elem. A 3 doboz „egymás alá dobált” kis tárolónak hat.
   - Javítás: vonal és dobozok nélkül, levegős kéthasábos tipográfia. Havonta / Negyedévente / Évente tagolás, élő mondatokkal. A Somosi Kft. felelőssége finom kiemelést kapjon.
5. **3 kis kártya a „Mit kapsz” végén (5. kép).**
   - Miért: „töltelék”, kötelezően kitöltendő 3 oszlopos rácsnak hat.
   - Javítás: dobozok nélküli, vízszintes záró sor, vagy a mondatok kerüljenek át a Biztonság szakaszba.
6. **„Kinek szól” zöld/rózsaszín kártya (1. kép):** tankönyvi B2B-sablon, „óvodás” hangulat. Javítás: két hasáb színes kitöltés nélkül, vékony szürke elválasztóval, pipával és x-szel.
7. **Bizalmi kék sáv (1. kép):** 4 egyforma ikonos kártya, tipikus „feature grid”. Javítás: fehér alapon visszafogott lista, vagy beépítve a hősbe.
8. **„Hogyan működik” (2. kép):** szabványos 4 oszlopos lebegő kártyasor nyilakkal. Javítás: egyetlen vízszintes folyamatvonal vagy egyszerű számozott szöveg, dobozok nélkül.
9. **Záró CTA üveghatású doboza (9. kép):** elcsépelt Dribbble/AI-elem. Javítás: egyszerű tömör kártya.
10. **Ikonok:** a Fluent emojik a komoly szövegek mellett amatőrnek hatnak. Gemini vékony vonalas egyszínű ikonokat javasol (Lucide/Heroicons).
11. **Címkék és szöveg:**
    - A minden szakasz fölötti kis nagybetűs címke („MIT KAPSZ”, „BIZTONSÁG”) túlteng, elég a címsor.
    - Sablonszövegek: „Négy lépés, és a könyvelésed rendben van.” (formulacím), helyette: „Hogyan indul a közös munka?”.
    - „Nézd meg lépésről lépésre…” utasító narráció.

## Mi kelt bizalmat (Gemini szerint ezek maradjanak)

- Az ártábla (7. kép): bal oldalt a havidíj, jobbra a tételes külön díjak, nincs „kérj egyedi ajánlatot”.
- A hős bal oldala: cím, ár, gombok, pipák.
- Az összevető táblázat tartalma.
- Az impresszum: Somosi Kft., adószám, cégjegyzékszám, tárhely.
- Az app-képek valódi magyar adós kifejezései (szja-előleg, szocho, ÁFA-keret).

## Amit nem vennék át változtatás nélkül

- **Ikoncsere:** a Fluent Emoji Flat az arculat része. Inkább kevesebb ikon legyen az oldalon (dobozonként egy ne), mint teljes csere. Ha mégis vonalas ikon kell, az csak helyben, beágyazott SVG-vel menne, CDN nélkül, és a licencét is menteni kell. Ezt a tulaj döntse el.
- **„pontosan”:** Gemini két szövegjavaslata ezt ígéri („pontosan látod a fizetendő adódat”, „pontosan tudod, mennyi marad a zsebedben”), de az app „kb.” összeget mutat. A szó kimarad.
- **3 csoportba vonás:** a „Mit kapsz” 7 lépésének összevonása nagy szerkezeti változás, döntés kell róla. Minimum: a dobozok, a ragyogás és a panelek kivétele.
- **Egyéb:** Gemini nem javasolt sem kitalált véleményt, sem statisztikát, sem fotót.

=====

{"tetelek": [{"hol": "Egész oldal: szakaszhátterek (.hos, .bizalom, .szakasz-meleg / -sotet / -menta / -levendula / -kek, .zaro), gep_01–09 és tel_01–17", "mi_ai_hatasu": "12 szakasz 8 különböző háttérrel, egymás után: halványkék gradiens (hős), tömör kék (bizalmi sáv), fehér, krémsárga, sötét navy fényfoltokkal, menta, levendula, fehér, halványkék, fehér, krémsárga, kék gradiens fénykörrel, sötét lábléc. Minden szakasznak saját felcím-színe is van (kék, barna, menta, levendula).", "miert": "A generált landingok így választják el a szakaszokat, mert nincs tipográfiai és térközi ritmusuk. A „minden szakasz más pasztell” a v0/Lovable-sablonok ismertetőjele. A Billingo és a Számlázz.hu fehér alapon dolgozik, egy-két márkaszínű sávval. Könyvelésnél a cukorkaszínek komolytalanok.", "javitas": "Az egész oldalon 3 háttér legyen: fehér; egy semleges „papír” (a meglévő #F3F5FB vagy #F6F7F9), legfeljebb 2 szakaszban; és egyetlen sötét #10152B (Mit kapsz + lábléc). Tömör kék nagy felületként csak a záró CTA-ban. Törölni kell a --h-meleg, --h-menta, --h-levendula hátteret, valamint a .hos és .zaro gradiensét és radial fényeit. A szakaszokat konténerszélességű 1 px-es vonal (#E6E9F2) és nagy térköz (120 / 72 px) válassza el, ne a szín. A szakaszonkénti felcím-színek (.szakasz-menta .felcim stb.) megszűnnek.", "sulyossag": "nagy"}, {"hol": "Egész oldal: kiemelőszínek (.szin-egkek / -sarga / -kek / -menta / -levendula / -korall, .lepes-*, .pipa, .kinek-nem)", "mi_ai_hatasu": "Kilenc kiemelőszín van: kék, sárga, zöld (pipák), rózsa (mínuszok), menta, levendula, korall, égkék, barna. A Mit kapsz szakaszban lépésenként más szín jelenik meg (számkarika, címke, „Neked ebből” szó, ragyogás, kiemelő keret a képernyőn).", "miert": "A „minden funkciónak saját színe” szivárványhatást kelt, ez az AI-sablonok egyik jellemző vonása. Egy valódi márka kevés, határozott színnel dolgozik, ezért marad meg az emlékezetben.", "javitas": "Egy kék (#1428DB: link, kattintható elem, egyetlen nagy felület), egy sárga (#FFC93C: főgomb és márkajel-kiemelő) és a sötét (#10152B) maradjon. Zöld csak a „kész / rendben” állapotra az app képernyőin belül (Megjelölve, Kimásolva). A .szin-* változók törlendők. A .kiemeles keret a képernyőkön mindenhol sárga (sötét alapon is jól látszik), vagy mindenhol kék.", "sulyossag": "nagy"}, {"hol": "Egész oldal: .felcim és a szakaszfej-sablon (.szakasz-fej), belső nagybetűs címkék (.negyedev-cim, .ido-mikor, .blepes-cimke, .kiscim, mobilos táblázat td::before)", "mi_ai_hatasu": "Minden szakasz ugyanígy kezdődik: nagybetűs, ritkított, színes felcím, 46 px-es H2, szürke bevezető, ugyanabban a bal oldali 780 px-es blokkban. A szakaszokon belül még kb. 15 nagybetűs címke van (EGY NEGYEDÉV A KÖNYVELŐDDEL, MINDEN HÓNAPBAN, SZÁMLÁK, BENNE VAN, mobilon ADÓZZ / HAGYOMÁNYOS IRODA), összesen kb. 25 darab.", "miert": "A „felcím, cím, alcím” hármas a leggyakoribb AI-landing képlet. A Billingo, a Számlázz.hu és a Qonto törzsszövegében nincs nagybetűs felcím. Az egyforma szakaszfej monotonná teszi az oldalt, és sablonszagú.", "javitas": "A .felcim minden szakaszból törlendő, a hősből is, mert a H1 elmondja ugyanezt. A szakaszfej elrendezése változzon: néhol bal oldali sticky cím és jobb oldali tartalom (mint most a GYIK-ban), néhol csak egy H2 bevezető nélkül, néhol teljes szélességű cím. A belső címkék legyenek normál kisbetűsek, 15–17 px / 600, sötétek, betűritkítás és szín nélkül (pl. .ido-mikor). Nagybetűs címke csak a lábléc oszlopcímeiben maradjon.", "sulyossag": "nagy"}, {"hol": "Egész oldal: dobozok (.kartya, .lepesek li, .teny, .negyedev, .soha, .bemutato-tenyek li, .blepes-kep, .blepes-haszon, .zaro-kartya, .tabla-keret, .arkartya, .dij-fo) és @media (hover) translate", "mi_ai_hatasu": "Kb. 30 lekerekített (14–28 px) doboz vékony pasztell kerettel és színezett árnyékkal (barnás, zöld, kék rgba). A nem kattintható kártyák egérre 4 px-et emelkednek. Gyakorlatilag minden szöveg dobozban van.", "miert": "Ez a shadcn/Tailwind kártyanyelv: „mindent dobozba”, ezért az oldalnak nincs saját szerkezete. Az emelkedő, de nem kattintható kártya tipikus sablonhiba. Valódi cégoldalon a szöveg közvetlenül a háttéren áll, hasábokban.", "javitas": "Doboz-szabály: az oldalon legfeljebb 2 doboz legyen, az árkártya és a „Amit soha nem kérünk el” figyelmeztetés. Minden más keret és háttér nélkül, hasábokban álljon, 1 px-es vonalakkal elválasztva. Radius: gomb 10–12 px, árkártya 12 px, telefon a mockupé; 16 px feletti radius nincs. Színezett árnyék nincs; árnyék csak a telefonon. A .kartya:hover, .lepesek li:hover, .teny:hover, .bemutato-tenyek li:hover translate szabályt törölni kell.", "sulyossag": "nagy"}, {"hol": "Egész oldal: ikoncsempék (bizalmi sáv 4, Mit kapsz vége 3, könyvelő-tények 2, idővonal 5, záró kártya 1)", "mi_ai_hatasu": "Kb. 15-ször ugyanaz a modul: Fluent Emoji fehér vagy szürke lekerekített négyzetben, mellette félkövér cím és két sor szürke szöveg.", "miert": "Az „ikon + cím + két sor” rács az AI-generált landingok első számú jele. Az emoji a marketingoldalon, pénzügyi szolgáltatásnál gyerekes és komolytalan. Ugyanaz a háromsoros modul öt helyen is ismétlődik.", "javitas": "Ikon-szabály: Fluent Emoji csak az app képernyőin belül (és a képernyőre úszó app-értesítésekben) legyen. A marketingszövegben nincs ikon és nincs ikoncsempe, a hierarchiát a tipográfia adja. Ha jel kell, az egy tabular számjegy vagy a sárga kiemelő legyen. Az .ikon elemek a <!--ikon:...--> jelölésekkel együtt kikerülnek a bizalmi sávból, a .bemutato-tenyek, .teny, .idovonal és .zaro-kartya részekből.", "sulyossag": "nagy"}, {"hol": "Egész oldal: pipás listák (hős .mikro, Kinek .lista-pipa / .lista-nem, .blepes-meg, árkártya, .ar-tenyek)", "mi_ai_hatasu": "22 pipa és 3 mínusz, mind halvány zöld (vagy rózsa) karikában: a hős alatt 3, Kinek szól 4+3, lépés-megjegyzések 2, ár 10, ár alatt 3.", "miert": "A színes karikás pipa minden sorban az AI-sablon „értékajánlat-listája”. Ha minden pipás, a pipa semmit nem emel ki.", "javitas": "Pipa csak az árkártya „Benne van” listájában maradjon: egyszínű sötét (#10152B), vékony, karika nélkül, asztali nézetben 2 hasábban. A hős mikrosora egyetlen szövegsor legyen középponttal elválasztva: „Nem kell kártya a regisztrációhoz · Kártyával vagy átutalással fizethetsz · Nincs hűségidő”. Az ár alatti 3 tény egy bekezdés legyen. A .blepes-meg sorok beolvadnak a bekezdésbe.", "sulyossag": "kozepes"}, {"hol": "Hős: kép (.termek, .bongeszo, .termek::before, .hos-vezerlo, .hos-fulek, .hos-felirat, .hos radial gradiens), gep_01, tel_01–02", "mi_ai_hatasu": "A telefon mögött gépes böngészőkép, mögötte lila-kék lekerekített doboz és kék radial fény. A telefon alatt lejátszás-gomb, 5 fül és felirat. Mobilon a telefon lila dobozon ül, és csak a 2. képernyőn jelenik meg.", "miert": "Az „eszköz-kollázs dekordobozon, ragyogással” bevett sablonmegoldás. A vezérlősor felületi zaj, a tulaj is kérte, hogy kerüljön ki.", "javitas": "Egyetlen nagy telefon valósághű mockupban (asztali nézetben --w kb. 300–320 px, mobilon kb. 260 px). Mögötte csak semleges, kétrétegű árnyék, doboz és ragyogás nélkül, a hős háttere sima fehér. Törlendő: .bongeszo, .termek::before, .hos-vezerlo és a JS-ben a fülek, illetve a felirat kezelése. Képcsere: csak opacity crossfade (translateX csúszás nélkül), kb. 3,5 s. Megáll :hover, :focus-within esetén és rejtett fülön (visibilitychange); reduced-motion alatt és JS nélkül az első kép áll. Az „Az app képei bemutató adatokkal készültek.” felirat a telefon alatt marad, 13 px, középre zárva. Asztali nézetben a telefon alja lelóghat a hős aljáról (overflow: clip a hősön), ez valódi termékoldalakon „kézbe adott” hatást kelt. Mobilon a telefon közvetlenül a gombok után jöjjön.", "sulyossag": "nagy"}, {"hol": "Hős: szövegblokk (.felcim, h1, .bevezeto, .hos-ar, .gombsor, .mikro), gep_01, tel_01", "mi_ai_hatasu": "Nyolc elem egymás alatt: felcím, H1, bevezető, elválasztó vonal, ár, szürke ármagyarázat, két egyforma súlyú gomb, 3 pipa. Ez a startup-hős pontos képlete.", "miert": "Minden elem ugyanazzal a súllyal kér figyelmet. A „két gomb + 3 pipás mikrolista” a generált hősök alapsablonja.", "javitas": "H1, bevezető, majd egy sor: [Regisztrálok] sárga főgomb, mellette szöveglink: „vagy kérj visszahívást” (a második gomb doboza elmarad). Alatta egy tipográfiai sor: „19 999 Ft/hó bruttó, évente egyszer éves zárás: 14 999 Ft. Minden díj kiírva.”, majd az egysoros mikroszöveg. A H1 egyetlen kulcsszava (pl. „Saját könyvelő”) kapjon a logó sárga ívét idéző marker-aláhúzást. Ez legyen az oldal márkajele, képernyőnként legfeljebb egy.", "sulyossag": "kozepes"}, {"hol": "Egész oldal: tipográfia (h1, h2, h3, .bevezeto, kártyaszövegek), címek szövege", "mi_ai_hatasu": "Minden címsor Geist 700, -0.03…-0.035em, minden H2 46 px. A címek kétütemű „Állítás. Csattanó.” képletre épülnek: „Átalányadósoknak és katásoknak. Csak nekik.”, „Egy havidíj. Minden más díj előre kiírva.”, „Kiállítasz egy számlát. Az app már tudja.”, „Minden papírod egy helyen. És ember nézi át.” A bevezetők és a kártyaszövegek szürkék (#535C70).", "miert": "A nagyon szoros, nehéz grotesk és a kétütemű, pontra vágott címek a generált SaaS-oldalak hangja. A szürke törzsszöveg kitöltő hatású, és rontja az olvashatóságot.", "javitas": "H1 600 / -0.025em; H2 38–40 px / 600 / -0.02em (mobilon 28–30); H3 20 px / 600. Törzsszöveg 18 px / 1.6, #2A3247; szürke (#5F687D) csak meta- és lábjegyzetszövegre. Minden szám tabular-nums. A címek többsége egy mondat legyen, pl. „Csak átalányadósoknak és katásoknak dolgozunk.”, „Egy havidíj, a többi díj előre kiírva.”, „Kiállítasz egy számlát, és az app már tudja.” A címhossz változhat, néhány lehet hosszabb, szerkesztőségi hangú.", "sulyossag": "kozepes"}, {"hol": "Bizalmi sáv (.bizalom), gep_01, tel_02", "mi_ai_hatasu": "Tömör #1428DB sáv 4 emoji-ikoncsempével, mindegyik mellett cím és 2 sor; „Magyar cég” mint jelvény.", "miert": "Ez az ikonos „trust strip”, a Qonto és az AI-sablonok jellegzetes eleme. A tömör kék nagy felület a hős után olcsó, hirdetésszerű hatást kelt.", "javitas": "A sáv kerüljön a hős aljára, fehér alapra, felső 1 px-es vonallal. Négy rövid, ikon nélküli tény egy sorban, sötét 15 px-es szöveggel (mobilon kettesével). A cégadat valódi lábjegyzetként szerepeljen: „Somosi Kft. · Adószám: 32769678-2-43 · 1123 Budapest, Nagyenyed utca 5.”. A teljes cégadat kelt valódi cég hatást, nem a „Magyar cég” címke.", "sulyossag": "kozepes"}, {"hol": "Kinek szól (.kinek-racs, .kinek-igen, .kinek-nem), gep_01, tel_02–03", "mi_ai_hatasu": "Zöld hátterű „igen” kártya pipákkal és rózsaszín „nem” kártya piros mínuszkarikákkal.", "miert": "A színkódolt „Kinek szól / kinek nem” kártyapár sablonelem, a zöld-piros pedig túl harsány egy egyszerű tájékoztatáshoz.", "javitas": "Két hasáb keret és háttér nélkül, köztük függőleges 1 px-es vonal (mobilon vízszintes). Jel gondolatjel vagy semmi; színt legfeljebb a két H3 kap (sötét és szürke). Az „Ha év közben változik…” mondat sima lábjegyzet.", "sulyossag": "kozepes"}, {"hol": "Hogyan működik (.lepesek, .lepes-szam, .lepes-kek / -levendula / -menta / -sarga), gep_02, tel_03", "mi_ai_hatasu": "4 egyforma fehér kártya krémsárga alapon, 4 különböző színű számkarikával (kék, lila, zöld, sárga), chevron nyilakkal. Mobilon 4 egymás alatti kártya.", "miert": "A „színes számkarikás lépéskártya” az egyik legfelismerhetőbb AI-landing elem. A különböző színeknek nincs jelentésük.", "javitas": "Fehér alap, 4 hasáb keret nélkül, fölöttük egyetlen végigfutó 1 px-es vonal. A számok nagyok (56–64 px), vékonyak (300–400), tabular, egyszínűek (kék vagy sötét). A nyilak törlendők. Mobilon bal oldalt számoszlop, a sorok között vonal, kártya nélkül.", "sulyossag": "nagy"}, {"hol": "Mit kapsz: „Neked ebből:” dobozok (.blepes-haszon, 7 darab) és .blepes-meg, gep_02–05, tel_04–09", "mi_ai_hatasu": "Minden lépésben ugyanaz: bal oldali 3 px-es színes csík, 6%-os fehér háttér, 14 px radius, színes „Neked ebből:” felirat. Alatta több helyen egy zöld pipás harmadik szövegszint.", "miert": "A színes csíkos callout-doboz ugyanazzal a sablonszóval hétszer gépi képletet mutat, és csak megismétli a bekezdést. A tulaj ezt érezte a leginkább AI-nak.", "javitas": "A dobozok és a „Neked ebből:” felirat törlendők. A haszonmondat vagy a bekezdés végére olvad, vagy a H3 alatti első, nagyobb mondat lesz (20 px / 500, fehér) keret, háttér és színes szó nélkül. Egy-két kulcsszám (pl. „kb. 29 000 Ft”) kaphat sárga marker-aláhúzást, mert ez márkajel, nem doboz. A .blepes-meg sorok a bekezdésbe olvadnak, vagy 15 px-es szürke lábjegyzetek lesznek pipa nélkül.", "sulyossag": "nagy"}, {"hol": "Mit kapsz: telefonok mögötti panelek és fények (.blepes-kep, .szinpad-fenyek, .szakasz-sotet::before, .blepes-szam, .blepes-cimke), gep_02–05, tel_04–09", "mi_ai_hatasu": "Minden telefon egy #161D3B, 28 px radiusú, fehér keretes panelen ül, mögötte lépésenként más színű radial ragyogással (6 szín). A szakasz sarkaiban kék és lila fényfolt van; minden lépésnél színes számkarika és nagybetűs színes címke.", "miert": "A „sötét mód, ragyogó kártya, neonfolt” a Framer- és AI-sablonok tipikus látványa, és szivárványos. A panel kisebbnek és dísznek mutatja a terméket, nem valódinak.", "javitas": "Törlendő a .blepes-kep háttere, kerete és radiusa, a .szinpad-fenyek, a .szakasz-sotet::before és a .szin-*. A telefon közvetlenül a sötét háttéren áll, valódi mockupban, egyetlen semleges árnyékkal. Lépésjelölés: kicsi, 60%-os fehér tabular „01”, színes kör nélkül; a címke („Számlák”) kisbetűs és színtelen, vagy elhagyható, mert a H3 elmondja. A képernyőn belüli kiemelő keret egy színű legyen (sárga).", "sulyossag": "nagy"}, {"hol": "Mit kapsz: elrendezés (.blepesek, .blepes:nth-child(even)), gep_02–05, tel_04–09", "mi_ai_hatasu": "Hét egyforma 50/50-es modul, felváltva bal-jobb, azonos 112 px-es közzel és azonos telefonmérettel. Mobilon ez önmagában kb. 10 képernyő.", "miert": "A tökéletesen szabályos cikcakk gépi ritmus. A hetedik azonos modulnál az olvasó már csak görget.", "javitas": "Változó ritmus kell. Az 1–3. lépés (számla, félretenni, határidő: ez a fő történet) maradhat nagy; asztali nézetben a meglévő sticky színpad jó, megtartható. A 4–6. lépés (fotózás, dosszié, üzenetek) egy háromhasábos sorba kerüljön kisebb telefonokkal, rövid címmel és 1–2 mondattal. Mobilon ez egy saját overflow-x: auto, scroll-snap sor (az oldal nem lóg ki), vagy egymás alatt 200 px-es telefonok. A 7. lépés (keretek) lehet egy szélesebb sáv, ahol a képernyő keret-kártyája kinagyítva, tipográfiailag jelenik meg, alatta a bemutató adatokra utaló felirattal.", "sulyossag": "kozepes"}, {"hol": "Mit kapsz vége: 3 kis kártya (.bemutato-tenyek: Telefonon és gépen / A pénzed nálad marad / A NAV-hoz a könyvelőd fordul), gep_05, tel_09", "mi_ai_hatasu": "Áttetsző kártyák, bennük emoji-ikoncsempe, félkövér cím és két sor, hármas rácsban.", "miert": "A „feature trio” a legismertebb AI-landing elem. A tartalma ráadásul ismétlés: a „pénzed nálad marad” már a 2–3. lépésben szerepel, a „NAV-hoz a könyvelőd fordul” a Biztonság szakaszban és a GYIK-ban is.", "javitas": "A három kártya törlendő. A helyükre egy valódi, nagy gépes app-kép kerüljön (a hősből kikerülő kepek/app_asztali.webp) teljes konténerszélességben, egyszerű 1 px-es kerettel vagy vékony böngészősávval. Alatta egy mondat: „Telefonon és gépen ugyanazt látod, ugyanazzal a belépéssel.” Utána egyetlen lábjegyzetsor ikon nélkül: „Pénzt nem vonunk le, nem utalunk helyetted, és az app semmit nem küld a NAV-nak: a bevallást a könyvelőd adja be.” Ezután marad az „Az app képei bemutató adatokkal készültek.”", "sulyossag": "nagy"}, {"hol": "Könyvelő: idővonal (.negyedev, .idovonal, .ido-pont, .ido-mikor, idővonal-animáció), gep_05–06, tel_10", "mi_ai_hatasu": "Fehér kártya menta kerettel és zöld árnyékkal, benne nagybetűs zöld cím, függőleges zöld vonal 5 emoji-ikoncsempe ponttal. Minden tételnél nagybetűs zöld időcímke, félkövér cím és szürke leírás; a vonal görgetésre „rajzolódik”.", "miert": "Ez a shadcn timeline komponens: 3 tipográfiai szint × 5 sor, ikon, szín és animáció. Díszes, gyártott hatású, nem egy cég saját leírása.", "javitas": "A kártya, az ikonok, a függőleges vonal és az animáció törlendő. A helyén szerkesztőségi, kéthasábos definíciós lista (dl) álljon: bal oszlopban az időpont (17 px / 600, sötét, kisbetűs: „Minden hónapban”), jobb oszlopban a cím és 1–2 mondat, a sorok között 1 px-es vonal. H2: „Ezt csinálja a könyvelőd egy negyedévben.” Úgy nézzen ki, mint egy valódi szolgáltatásleírás vagy szerződésmelléklet, ez kelt bizalmat. A „Katásként…” mondat a lista utolsó sora. Háttér fehér, nem menta.", "sulyossag": "nagy"}, {"hol": "Könyvelő: 3 doboz (.teny-kiemelt „Név szerint ismered”, .teny „Egy szerződés, egy felelős”, .soha „Amit soha nem kérünk el”), gep_06, tel_10", "mi_ai_hatasu": "Három különböző dobozstílus egymás alatt: vastag menta keret zöld árnyékkal, vékony menta keret, és bal oldali 4 px-es kék csík. Kettőben emoji-ikoncsempe.", "miert": "Dobozba csomagolt tényállítások, eltérő keretekkel, kiemelés indok nélkül: tipikus AI-montázs. A „soha nem kérünk el” mondat a bizalmi sávban és a GYIK-ban is szerepel.", "javitas": "A két tény két rövid bekezdés legyen H3-mal, keret és ikon nélkül; asztali nézetben két hasábban a H2 alatt. Az „Amit soha nem kérünk el” az oldal egyetlen valódi figyelmeztetése: egyszer szerepeljen, a Biztonság szakaszban, és ott lehet a második megengedett doboz (1 px-es sötét #10152B keret, 8 px radius, ikon és csík nélkül). A bizalmi sávban és a GYIK-ban ezt elég röviden említeni.", "sulyossag": "nagy"}, {"hol": "Biztonság (.szakasz-levendula, .ket-kartya, .lista-pont, .nyil-link), gep_06, tel_11", "mi_ai_hatasu": "Levendula háttér, két egyforma fehér kártya levendula pöttyös listával és levendula nyíllinkkel.", "miert": "Ez a tematikus pasztellháttér + két egyforma kártya + pöttyös lista ismét kártyarács, csak más színben.", "javitas": "Fehér vagy papír alap, két hasáb keret nélkül. A pöttyös lista helyett rövid bekezdések vagy egyszerű kérdés-válasz („Mit enged a meghatalmazás?”, „Hogyan vonod vissza?”). A link a meglévő kék. Ide kerül az „Amit soha nem kérünk el” figyelmeztetés.", "sulyossag": "kozepes"}, {"hol": "Árak (.arkartya, .dij-fo, .ar-fo .lista, .ar-tenyek), gep_07, tel_12–13", "mi_ai_hatasu": "Az árkártyán 2 px-es kék keret, kék színezett árnyék és 24 px radius van. Az „Éves zárás” sárga dobozban áll bal oldali sárga csíkkal (ismét csíkos callout); 10 zöld karikás pipa, alatta 3 pipás tény.", "miert": "A kék kerettel ragyogó „pricing card” és a csíkos kiemelés SaaS-sablon. Közben a „Külön díjak” táblázat már most emberi, gondos munkának tűnik, ezt a nyelvet kellene kiterjeszteni.", "javitas": "Az árkártya 1 px-es #D5DBEA keretet és 12 px radiust kapjon, árnyék nélkül. Az „Éves zárás” sor csík és háttér nélkül álljon, csak a 14 999 Ft kap sárga markert. A pipák egyszínűek (lásd pipás listák). Az ár alatti 3 tény egy mondat legyen. Marad: a sárga marker a 19 999 Ft-on és a Külön díjak dl-táblázat a vonalakkal.", "sulyossag": "kozepes"}, {"hol": "Összevetés (.tabla-keret, .oszlop-adozz, mobilon .tabla tbody tr kártyák), gep_07–08, tel_14", "mi_ai_hatasu": "Halványkék háttér, 22 px-es keret kék színezett árnyékkal, az Adózz oszlop tetején kék csík és kék háttér. Mobilon 7 külön kártya nagybetűs „ADÓZZ / HAGYOMÁNYOS IRODA” címkékkel.", "miert": "A ragyogó „mi vs. ők” összehasonlító kártya SaaS-sablon. Mobilon a 7 kártya újabb dobozfal.", "javitas": "Fehér háttér, keret és árnyék nélküli táblázat, csak vízszintes 1 px-es vonalakkal. Az Adózz oszlop félkövér, sötét szöveg, legfeljebb nagyon halvány (#F5F7FF) háttérrel. Mobilon kártyák helyett vonallal elválasztott sorok: félkövér sorcím, alatta „Adózz:” és „Iroda:” kisbetűs, félkövér előtaggal.", "sulyossag": "kicsi"}, {"hol": "GYIK (.szakasz-meleg, .gyik-lista summary::after), gep_08–09, tel_15–16", "mi_ai_hatasu": "Krémsárga alap, kerek fehér +/− gombok, nyitva tömör kék kör.", "miert": "A kerek ikongombos harmonika sablonelem. A szerkezet (bal sticky cím, jobb vonalas lista) viszont jó, ez megtartandó.", "javitas": "Fehér vagy papír alap. A jel egyszerű, 14 px-es „+” / „–” vonal legyen kör és háttér nélkül; a nyitott kérdés félkövér marad, kék kör nélkül.", "sulyossag": "kicsi"}, {"hol": "Záró CTA (.zaro, .zaro::before, .zaro-kartya), gep_09, tel_16", "mi_ai_hatasu": "Kék gradiens, fehér radial fénykör, „üveg” kártya (8%-os fehér, fehér keret, 22 px radius), benne emoji-telefon fehér csempében.", "miert": "A glassmorphism és a gradiens fénykör a generált oldalak tipikus zárása.", "javitas": "Tömör #1428DB gradiens és fénykör nélkül; ez az oldal egyetlen nagy kék felülete. Bal oldalt H2, egy mondat és a sárga gomb. Jobb oldalt a visszahívás szövege kártya és ikon nélkül, bal oldalán 1 px-es, 20%-os fehér vonallal elválasztva. A 24–48 órás mondat egyszer, itt szerepeljen. Opcionálisan a telefonmockup kilóghat a sáv tetejéről (valódi termék, nem dísz).", "sulyossag": "kozepes"}, {"hol": "Mozgás (mozgas.js + .be / .be-sor, @media (hover) translate, .idovonal::after, .a-pop, data-szamlal)", "mi_ai_hatasu": "Minden szakaszfej és kártyasor beúszik (translateY 26 px, lépcsőzetes késleltetéssel). A kártyák emelkednek, az idővonal rajzolódik, a „pop” rugózik (cubic-bezier(.3,1.5,.5,1) túllendüléssel), több számláló pörög.", "miert": "A „minden mozog” Framer- és AI-sablonhatás. Komoly pénzügyi szolgáltatónál nyugtalanító, és lassítja az olvasást telefonon.", "javitas": "Mozgás-szabály: csak a termék mozog, azaz a hős képcseréje (crossfade) és a Mit kapsz telefonrétegei. Törlendő a .be / .be-sor beúszás, a hover-emelés és az idővonal-animáció. A pop helyett 200–250 ms opacity + scale(.96 → 1) ease-out, túllendülés nélkül. Számláló legfeljebb a félretenni-összegnél. Csak transform és opacity; reduced-motion és JS nélkül minden a végállapotában látszik.", "sulyossag": "kozepes"}, {"hol": "Az oldal összes telefonja (.telefon, .telefon::after, .bemutato .telefon, .szinpad .telefon)", "mi_ai_hatasu": "Saját CSS-ből rajzolt telefon: lapos sötét perem, rajzolt kapszula, oldalgombok és fémes él nélkül. A sötét szakaszban a #262E50 perem beleolvad a háttérbe, így a telefon rajzolt hatású.", "miert": "A „rajzolt” készülék olcsóbb és kevésbé valódi hatású, mint egy hiteles mockup. A tulaj kifejezetten valósághű keretet kért.", "javitas": "Minden telefonhoz ugyanaz a valósághű mockup kell, egy közös komponensként. Jelölt: devices.css (github.com/picturepan2/devices.css, MIT, tiszta CSS, iPhone 14 Pro peremmel, oldalgombokkal és Dynamic Islanddel; külső fájl nincs, CSP-barát). A licenc szövegét le kell ellenőrizni és menteni a kepek/LICENC_devices_css.txt fájlba. Alternatíva: licenctiszta SVG/PNG keret. A képernyőterület CSS-változókkal (bal, felső, szélesség, magasság %-ban) legyen megadva, hogy a .reteg rétegei pontosan a helyükre essenek. Ne legyen két sziget: a képernyőképek saját állapotsorát a mockup Dynamic Islandjével egyeztetni kell. Árnyék semleges és kétrétegű, színes ragyogás nélkül; a perem világos és sötét háttéren is látsszon (sötét titán + 1 px-es világos él).", "sulyossag": "nagy"}, {"hol": "Egész oldal: ismétlődő állítások", "mi_ai_hatasu": "Ugyanazok a mondatok 3–5-ször szerepelnek. „Ügyfélkapu+- / DÁP-belépésedet és jelszavadat soha nem kérjük el”: bizalmi sáv, könyvelő-doboz, GYIK. „Pénzt nem vonunk le, nem utalunk”: hős app-kép, 2. és 3. lépés, 3 kártya, GYIK. „A bevallást a könyvelőd adja be, miután átnézte”: 3 kártya, Biztonság. „Munkanapokon 9 és 17 óra között”: 3. lépés, összevetés, záró, lábléc.", "miert": "A generált oldalak minden blokkba újra beleírják a fő üzenetet, ezért az olvasó töltelékszöveget érez. Emiatt is ilyen hosszú az oldal.", "javitas": "Minden állítás egyszer szerepeljen, a legjobb helyén, teljes formában; máshol legfeljebb egy rövid utalás. A „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.” mondat csak egyszer, a záróban álljon; a 3. lépésben elég ennyi: „Visszahívunk, ha kéred.”", "sulyossag": "kozepes"}, {"hol": "Mobil (390 px) teljes hossz, tel_01–17", "mi_ai_hatasu": "390 px-en az oldal kb. 23 700 px magas, ez 812 px-es kijelzőn kb. 29 képernyő. Minden modul egyesével, kártyában, nagy telefonokkal kerül egymás alá; a hős telefonja csak a 2. képernyőn jelenik meg.", "miert": "A tulaj telefonon nézi. A végtelen, egyforma blokkokból álló görgetés a sablonoldalak érzetét erősíti, és a lényeg (termék, ár) elvész.", "javitas": "A fenti doboz-, pipa-, ikon- és ismétlés-törlések, a Mit kapsz 4–6. lépésének csoportosítása és a 3 kártya cseréje együtt nagyjából a felére csökkentse az oldalt. Mobilon a hős telefonja közvetlenül a gombok után jöjjön, a mikroszöveg és az ár egy-egy sorban álljon; a szakaszköz 72 helyett kb. 64 px legyen. Építés után 390 / 768 / 1280 / 1440 px-en ellenőrizni kell a vízszintes kilógást.", "sulyossag": "kozepes"}], "iranyelvek": "CÉL: rendes, gondos magyar cég hatása (Billingo / Számlázz.hu irány): fehér alap, erős tipográfia, nagy valódi termékképek, kevés, de határozott szín, sok levegő, kevés doboz.\n\nSZÍN: 3 háttér. Fehér; egy semleges papír (#F3F5FB vagy #F6F7F9), legfeljebb 2 szakaszban; sötét #10152B, csak a Mit kapsz és a lábléc. Tömör kék #1428DB nagy felületként csak a záró CTA-ban. A kék egyébként link és kattintható elem. A sárga #FFC93C főgomb és marker-kiemelő; ez a márkajel, a logó ívére rímel. Képernyőnként legfeljebb egy kiemelés: H1 kulcsszó, ár, 1–2 kulcsszám. Zöld csak a „kész” állapotra az app-képeken belül. Nincs pasztell (menta, levendula, krém, rózsa, korall, égkék), nincs gradiens, nincs radial fény, nincs színezett árnyék.\n\nTIPOGRÁFIA: Geist. H1 56–60 / 600 / -0.025em (mobilon 36–38). H2 38–40 / 600 / -0.02em (mobilon 28–30). H3 20 / 600. Törzsszöveg 18 / 1.6, #2A3247 (mobilon 16.5). Szürke (#5F687D) csak meta- és lábjegyzetszövegre. A törzsben nincs nagybetűs felcím vagy címke (csak a lábléc oszlopcímeiben). Minden szám tabular-nums. A címek egymondatosak, nem „Állítás. Csattanó.” formájúak. Szövegszélesség legfeljebb 34em.\n\nTÉRKÖZ ÉS RITMUS: konténer 1200 px, szakaszköz 120 / 72 px. A szakaszokat 1 px-es #E6E9F2 vonal és térköz választja el, nem háttérszín. A szakaszfej elrendezése változzon (bal sticky cím + jobb tartalom / teljes szélességű cím / csak cím). Két egymást követő szakasz ne legyen azonos szerkezetű.\n\nDOBOZ: az egész oldalon legfeljebb 2 doboz: az árkártya (1 px #D5DBEA, 12 px radius, árnyék nélkül) és az „Amit soha nem kérünk el” figyelmeztetés (1 px sötét keret, 8 px radius). Minden más hasábokban, vonalakkal, keret és háttér nélkül. Nincs bal oldali színes csík, nincs 16 px feletti radius (a telefont kivéve), nincs hover-emelés nem kattintható elemen. Árnyék csak a telefonon, semlegesen, pl. 0 2px 6px rgba(16,21,43,.10), 0 40px 80px -32px rgba(16,21,43,.35).\n\nIKON: Fluent Emoji csak az app képernyőin és a képernyőre úszó app-értesítésekben. A marketingszövegben nincs ikon és nincs ikoncsempe. Pipa csak az ár „Benne van” listájában: egyszínű, sötét, karika nélkül. Nincs színes számkarika; a lépésszám nagy, vékony, egyszínű számjegy vagy kicsi „01”.\n\nKÉP: minden telefon ugyanaz a valósághű mockup (pl. devices.css iPhone 14 Pro, MIT; licencet menteni a kepek/LICENC_*.txt fájlba), panel és ragyogás nélkül. A képernyőterület CSS-változókkal legyen megadva, hogy a rétegek a helyükre essenek. Egy nagy gépes app-kép a Mit kapsz végén. Minden képcsoport alatt marad: „Az app képei bemutató adatokkal készültek.”\n\nMOZGÁS: csak a termék mozog: a hős crossfade-je (kb. 3,5 s; megáll hover, fókusz és rejtett fül esetén; reduced-motion alatt és JS nélkül állókép) és a Mit kapsz telefonrétegei. Nincs szakasz-beúszás, hover-emelés, idővonal-rajzolás, rugós túllendülés. Csak opacity és transform, 200–600 ms ease-out.\n\nTARTALOM: minden állítás egyszer szerepeljen. A 24–48 órás mondat egyszer, a záróban.\n\nMEGTARTANDÓ: Geist, sárga főgomb, sárga marker az áron, a Külön díjak dl-táblázat vonalakkal, a GYIK vonalas listája bal sticky címmel, a teljes impresszum a láblécben, a Mit kapsz asztali sticky színpada, a valódi app-képek és az árak."}

=====

{"tetelek": [{"hol": "#mit-kapsz: mind a 7 p.blepes-haszon (sablon 220, 244, 271, 295, 319, 343, 367. sor), plusz a két pipás p.blepes-meg sor (245, 272.) és a blepes-cimke 1–7 számai", "mi_ai_hatasu": "Hétszer ugyanaz a „Neked ebből: …” kiemelő doboz, kétszer alatta egy pipás biztosító sor, a lépések előtt pedig 1–7-ig számok.", "miert": "Az angol landing-sablonok „Benefit:” / „What’s in it for you” címkéjének tükörfordítása. Ugyanaz a címke ugyanabban a dobozban hétszer egymás után: ez a gépi ismétlés legbiztosabb jele. A doboz a bekezdést mondja el újra, és 7-ből 6 tagadás („nem késel le”, „nem kell rákérdezned”, „nem maradsz egyedül”). Magyar vállalkozó így nem beszél, egy valódi cég oldalán a haszon a mondatban van. A számozás sorrendet sugall, pedig ez funkciólista, és közvetlenül a számozott „Hogyan működik” után jön (két számozott sor egymás után).", "javitas": "Mind a 7 blepes-haszon bekezdés kikerül a szövegből (a CSS-szabály maradhat a fájlban). A blepes-meg sorok pipa nélkül, sima mondatként olvadnak a bekezdésbe. A haszon a címbe vagy egy „így…” mellékmondatba kerül. A blepes-cimke számai (1–7) kikerülnek, csak a szó marad: Számlák / Félretenni / Határidők / Fotózás / Dosszié / Üzenetek / Keretek. Lépésenként a pontos új szöveg a következő 7 tételben van.", "sulyossag": "nagy"}, {"hol": "#mit-kapsz 1. lépés, Számlák (218–220. sor)", "mi_ai_hatasu": "Cím: „Kiállítasz egy számlát. Az app már tudja.” Kétütemű „X. Y.” cím, megszemélyesített app, alatta „Neked ebből: nincs adminisztráció…”.", "miert": "Az „Az app már tudja” az angol „it just knows” fordulat: okos, szinte emberi szoftvert sugall, ettől AI-hatású. Azonnaliságot is ígér, ami nem biztos. A haszon-doboz a bekezdés második felét ismétli.", "javitas": "h3: „Kiállítasz egy számlát. Az app már tudja.” -> „A kiállított számláid maguktól bejönnek” | p: -> „Amit kiállítasz, azt az app a NAV Online Számla rendszeréből hozza be, neked nem kell begépelned. Minden számla mellett ott van, nagyjából mennyit tegyél félre belőle adóra.” | blepes-haszon: törlés.", "sulyossag": "nagy"}, {"hol": "#mit-kapsz 2. lépés, Félretenni (242–245. sor)", "mi_ai_hatasu": "Bekezdés + „Neked ebből: nem költöd el… nem ér meglepetés” + pipás „Ez csak jelölés: pénzt nem vonunk le, nem utalunk.” Ez három blokk egymás alatt, ugyanarról.", "miert": "Ugyanazt mondja háromszor, egyre több tagadással. Ez a pénz-biztosítás az oldalon négyszer szerepel (itt, 3. lépés, tények-kártya, GYIK).", "javitas": "h3 marad, csak pont nélkül: „Látod, mennyi pénz nem a tiéd” (ez az egyetlen cím, ami élő beszédnek hangzik). | p: -> „A főoldalon egyetlen szám mutatja, mennyit tegyél félre adóra és járulékra. Minden új számlával frissül, így nem költöd el véletlenül az adó pénzét, és a negyedév végén nem ér meglepetés. Ha félretetted, megjelölöd. Ez csak egy jelölés az appban, a pénz nálad marad. A befizetendő összeget negyedév végén a könyvelőd pontosítja.” | blepes-haszon és blepes-meg: törlés (beleolvadt).", "sulyossag": "nagy"}, {"hol": "#mit-kapsz 3. lépés, Határidők (269–272. sor)", "mi_ai_hatasu": "„Tudod, mit, mikorra és hova utalj.”: hármas felsorolás a címben. Utána „Neked ebből: nem késel le… és nem gépeled el…”, majd pipás „Az adót te utalod el, így a pénzed végig nálad marad.”", "miert": "Hármas ritmus a címben, két tagadás a dobozban, és a pipás sor a 2. lépést ismétli. A legerősebb haszon (szólunk határidő előtt) a bekezdés elejére van elrejtve.", "javitas": "h3: -> „Határidő előtt szólunk” | p: „Határidő előtt szólunk. Látod az összeget…” -> „Az appban ott az összeg, a NAV-számlaszám és a közlemény, egy koppintással kimásolod őket a bankodba, így nem kell átgépelned a számlaszámot. Az utalást te indítod, a saját bankodból. Katásként a havi katát látod így.” | blepes-haszon és blepes-meg: törlés.", "sulyossag": "nagy"}, {"hol": "#mit-kapsz 4. lépés, Fotózás (293–295. sor)", "mi_ai_hatasu": "„Papírt kaptál? Lefotózod, és kész.”: kérdés–válasz cím reklámos „és kész” zárással. Az „és kész” az oldalon háromszor szerepel (2. lépés szövege, ez a cím, hős-felirat).", "miert": "A kérdés–válasz–„done” szerkezet a reklámszöveg-generátorok kedvenc képlete. A haszon-doboz („nem kell papírt hordanod…”) a bekezdés logikus folytatása, külön dobozban mesterkélt.", "javitas": "h3: -> „Ami papíron jön, azt lefotózod” | p: -> „A nyugtát, a levelet vagy a kézzel írt számlát lefotózod a telefonoddal, vagy feltöltöd PDF-ben. Egyenesen a könyvelődhöz kerül, és ő teszi a helyére. Nem kell hozzá papírokat hordanod, és régi e-mailekben sem kell keresgélned.” | blepes-haszon: törlés.", "sulyossag": "nagy"}, {"hol": "#mit-kapsz 5. lépés, Dosszié (317–319. sor)", "mi_ai_hatasu": "„Minden papírod egy helyen. És ember nézi át.”: kétütemű cím, a második fele „És…”-sel kezdődő töredék.", "miert": "Az „És + töredék” zárás tipikus AI-ritmus. Az „ember nézi át” védekező, éppen a robotot juttatja az olvasó eszébe. A „Neked ebből: látod, hogy rendben vagy” a bekezdés utolsó gondolatát ismétli.", "javitas": "h3: -> „Amit küldesz, a könyvelőd átnézi” | p: -> „A havi dossziéban egy helyen van minden, amit küldtél, a kiállított számláid és a NAV levelei is. Itt látod, mit nézett már át a könyvelőd, és mit kér még tőled, így nem kell rákérdezned, hogy rendben vagy-e.” | blepes-haszon: törlés.", "sulyossag": "nagy"}, {"hol": "#mit-kapsz 6. lépés, Üzenetek (341–343. sor)", "mi_ai_hatasu": "„A könyvelőd egy üzenetnyire van.”, alatta „Neked ebből: nem maradsz egyedül a kérdéseiddel, és látod, ha rendben megérkezett a befizetésed.”", "miert": "Az „egy üzenetnyire” a „just a message away” tükörfordítása. A haszon-doboz két össze nem tartozó dolgot köt egy „és”-sel, ez a generált szöveg jellemzője. A „nem maradsz egyedül” érzelmi klisé.", "javitas": "h3: -> „Bármikor írhatsz a könyvelődnek” | p: -> „Az appban üzenetet küldesz neki, jövedelemigazolást vagy nullás igazolást pedig egy gombbal kérsz. Ha elakadsz, visszahívást is kérhetsz. Ha NAV-levelet kapsz, ő mondja meg, mit jelent, és a meghatalmazásod alapján elintézi. Azt is jelzi, ha rendben megérkezett a befizetésed.” | blepes-haszon: törlés.", "sulyossag": "nagy"}, {"hol": "#mit-kapsz 7. lépés, Keretek (365–367. sor)", "mi_ai_hatasu": "„Neked ebből: egy pillantásból tudod, mennyi a tiéd.”", "miert": "Az „egy pillantásból” az „at a glance” tükörfordítása (magyarul „egy pillantással” lenne, de így sem mondja senki). A cím viszont élő beszéd („belecsúszik az áfába”), az maradhat.", "javitas": "h3: „Nem csúszol bele véletlenül az ÁFA-ba.” -> „Nem csúszol bele véletlenül az áfába” (pont nélkül, kisbetűs áfa) | p: -> „Az app mutatja, mennyit számlázhatsz még idén áfa nélkül. Katásként a kata-keretedet is, és szólunk, ha cégnek számlázol. Ugyanitt megnézheted azt is, mennyi maradt neked az adók és járulékok után.” | blepes-haszon: törlés.", "sulyossag": "kozepes"}, {"hol": "#mit-kapsz, a szakasz vége: ul.bemutato-tenyek (390–394. sor)", "mi_ai_hatasu": "Pontosan 3 kártya: ikon + kétszavas cím + egy mondat („Telefonon és gépen” / „A pénzed nálad marad” / „A NAV-hoz a könyvelőd fordul”).", "miert": "Ez a leggyakoribb AI/Tailwind-szakaszzáró („feature grid”). Ráadásul a 3-ból 2 szó szerinti ismétlés: a pénz-biztosítás negyedszer, az „Az app nem küld be semmit a NAV-nak…” mondat a Biztonság-szakaszban szó szerint újra.", "javitas": "A 3 kártya helyett egyetlen sima mondat a bemutató alatt, a jegy előtt: „Az appot telefonon és gépen is használhatod, ugyanazzal a belépéssel.” A másik két kártya szövege kimarad (a tényeik megvannak: Félretenni-lépés, GYIK, Biztonság). „Az app képei bemutató adatokkal készültek.” változatlanul marad.", "sulyossag": "nagy"}, {"hol": "#konyvelo bal oldal: „Egy negyedév a könyvelőddel” idővonal (403–426. sor)", "mi_ai_hatasu": "5 egyforma elem: időcímke + igei cím + bekezdés. A címek ritmikus párok („Kiszámolja és beadja”, „Elmagyarázza és intézi”), a bekezdés pedig megismétli a címet.", "miert": "„Kiszámolja és beadja” → a szöveg is így kezdődik: „Kiszámolja és beadja…”. „Látja, hogy megérkezett” → „…látja, hogy rendben megérkezett”. A NAV-levél és a „Bármikor válaszol, igazolás egy gombbal” elem a Mit kapsz 5–6. lépését ismétli. A szimmetrikus, egyforma hosszú elemek generált hatásúak.", "javitas": "Cím: „Egy negyedév a könyvelőddel” -> „Mit csinál a könyvelőd?” Az elemekben nincs külön h3, az időpont félkövér a mondat elején: (1) „Minden hónapban vezeti a bevételi nyilvántartásodat, és átnézi a számláidat. Ha valami hiányzik, szól. A bankszámlakivonatodat is elkéri, mert abból látja, mikor érkezett meg a pénz.” (2) „A negyedév végén kiszámolja és bevallja a negyedéves adódat és járulékaidat, és az appban megírja, mennyit utalj.” (3) „Amikor utaltál, a feltöltött kivonatodon látja, hogy megérkezett a befizetésed, és az appban jelzi neked.” (4) „Ha NAV-levél jön, elmondja, mit jelent, és a meghatalmazásod alapján elintézi.” (5) „Katásként a havi katát és a kata-keretedet figyeli.” (ebbe olvad a negyedev-meg sor). A „Bármikor / Válaszol neked” elem kimarad, mert az Üzenetek-lépés már elmondja.", "sulyossag": "nagy"}, {"hol": "#konyvelo jobb oldal: felcím, h2, bevezető, „Név szerint ismered” és „Egy szerződés, egy felelős” doboz (430–443. sor)", "mi_ai_hatasu": "„Valódi könyvelő dolgozik neked.” + „…nyilvántartásba vett könyvelő végzi, nem egy program. És te tudod, ki ő.” + két ikonos tény-doboz párhuzamos szlogencímmel.", "miert": "A „nem egy program” klasszikus „nem X, hanem Y” védekezés, és épp a robotra tereli a figyelmet. Az „És te tudod, ki ő.” drámai töredék. Az „Egy szerződés, egy felelős” kéttagú szlogen. Az ikon + cím + mondat doboz ugyanaz a sablon, mint a bizalmi sáv és a tények-kártya.", "javitas": "Felcím („A könyvelőd”): törlés. | h2: -> „Ki könyvel neked?” | bevezető: -> „Egy nyilvántartásba vett könyvelő. A neve és a nyilvántartási száma benne van a szerződésedben, és az appban is látod.” | A két doboz helyett egy sima bekezdés: „A szerződést a Somosi Kft.-vel kötöd. A könyvelőd munkájáért mi felelünk, úgy, mintha magunk dolgoznánk.”", "sulyossag": "nagy"}, {"hol": "#konyvelo: „Amit soha nem kérünk el” doboz (444–447. sor)", "mi_ai_hatasu": "Drámai, tagadó cím külön dobozban, felsorolásszerű, alany nélküli kezdéssel („A jelszavadat, az Ügyfélkapu+-…”).", "miert": "Ez a harmadik ugyanilyen biztosítás az oldalon (bizalmi sáv, GYIK). A tartalma hasznos csalás elleni figyelmeztetés, de így szlogennek hat. Konkrét e-mail-címmel, rendes mondatban olyan, mint egy bank valódi tájékoztatója.", "javitas": "h3: „Amit soha nem kérünk el” -> „Ha valaki a nevünkben keres” | p: -> „Telefonon soha nem kérjük el a kártyaadataidat, és sehol nem kérjük el a jelszavadat, az Ügyfélkapu+- vagy DÁP-belépésedet vagy a kódjaidat. Ha valaki a nevünkben mégis ilyet kér, tedd le, és írj nekünk: ugyfelszolgalat@adozz.hu”", "sulyossag": "kozepes"}, {"hol": "„valódi könyvelő” az egész oldalon: hős bevezető (56), bizalmi sáv (118), #konyvelo h2 (431), GYIK próbaidő (627)", "mi_ai_hatasu": "Négyszer bizonygatja, hogy a könyvelő „valódi”.", "miert": "Aki ennyiszer mondja, hogy nem robot, az gyanús. A „valódi” jelzővel az AI-landingok bizonygatnak. A bizalmat a konkrétum adja (nyilvántartásba vett, a neve a szerződésben, Somosi Kft. felel), nem a jelző.", "javitas": "Hős (56): „Valódi, nyilvántartásba vett könyvelő intézi…” -> „Nyilvántartásba vett könyvelő intézi…” (a teljes új bevezető a hős-tételben). Bizalmi sáv: kikerül (lásd a bizalmi sáv tételt). #konyvelo h2: lásd fent („Ki könyvel neked?”). GYIK (627): „A havidíjért valódi könyvelő dolgozik neked, ezért ingyenes időszak nincs. A regisztrációhoz nem kell kártya. Ha kéred, előbb visszahívunk és mindent átbeszélünk, és csak utána fizetsz. Fizethetsz kártyával vagy átutalással.” -> „A havidíjért egy könyvelő dolgozik a vállalkozásodon, ezért ingyenes időszakot nem tudunk adni. Regisztrálni kártya nélkül tudsz. Ha szeretnéd, előbb visszahívunk, átbeszélünk mindent, és csak utána fizetsz, kártyával vagy átutalással.” A „valódi” szó az oldalon csak a belső vélemény-helyőrzőben maradhat.", "sulyossag": "nagy"}, {"hol": "Az egész oldal címei (h1, h2, h3), pl. 55, 140, 171, 207, 218, 242, 269, 293, 317, 341, 365, 431, 457, 488, 649. sor", "mi_ai_hatasu": "Minden cím ponttal zárul, és sok kétütemű: „Átalányadósoknak és katásoknak. Csak nekik.”, „Kiállítasz egy számlát. Az app már tudja.”, „Minden papírod egy helyen. És ember nézi át.”, „Egy havidíj. Minden más díj előre kiírva.” Ide tartoznak a párhuzamos névszópárok is: „Érthető meghatalmazás, védett adatok.”, „Egy szerződés, egy felelős”, „Szerződés, meghatalmazás”.", "miert": "A ponttal lezárt, két ütemre tört cím az Apple/Stripe-utánzó AI-landingok védjegye. A magyar cégoldalak (Billingo, Számlázz.hu) címei pont nélküliek, sima állítások vagy kérdések. A sorozatos szlogencímek reklámügynökségi vagy gépi hatásúak.", "javitas": "Minden h1/h2/h3 végéről lekerül a pont (a kérdőjel marad). Egy cím egy állítás. A kétüteműek pontos cseréje a szakasz-tételekben van; összefoglalva: „Átalányadósoknak és katásoknak. Csak nekik.” -> „Kiket könyvelünk?” | „Négy lépés, és a könyvelésed rendben van.” -> „Így indul a könyvelésed” | „Érthető meghatalmazás, védett adatok.” -> „Mit jelent a meghatalmazás, és hol vannak az adataid?” | „Egy havidíj. Minden más díj előre kiírva.” -> „Mennyibe kerül?” | „Valódi könyvelő dolgozik neked.” -> „Ki könyvel neked?” | „Legyen saját könyvelőd.” -> „Legyen saját könyvelőd” | H1: „Saját könyvelő átalányadózóknak és katásoknak”.", "sulyossag": "nagy"}, {"hol": "Ugyanaz a tény többször az oldalon (ismétlés-térkép, egész sablon)", "mi_ai_hatasu": "„Pénzt nem vonunk le, és nem utalunk helyetted”: 4×. „Az app nem küld be semmit a NAV-nak. A bevallást a könyvelőd adja be, miután átnézte.”: 2× szó szerint. „…belépésedet és a jelszavadat soha nem kérjük el”: 3×. ONYA, „ha kéred, ő küldi be, te hagyod jóvá, bármikor visszavonhatod, ugyanott”: 3× (kétszer szó szerint). „Európai szerveren / titkosítva / csak a könyvelőd látja”: 3×. „nem kell kártya”: 4×. „kártyával vagy átutalással”: 5×. „nincs hűségidő”: 6×. „A többit csak akkor fizeted, ha kéred.”: 2×, egymás alatt. „szólunk, és megbeszéljük, hogyan tovább”: 2×. A 24–48 órás mondat: 2×.", "miert": "A generált szövegek blokkonként újraírják ugyanazokat a biztosításokat, mert nem látják az egészet. Az olvasónak ez töltelék, és gyanús, hogy miért kell ennyiszer megnyugtatni.", "javitas": "Egy tény egy helyen (a GYIK lehet kivétel, de rövidebben, más szavakkal). Pénz nálad marad: Félretenni-lépés egy mondata + GYIK; a tények-kártyából kikerül, a Határidők-lépésben csak „Az utalást te indítod”. „Az app nem küld be semmit a NAV-nak…”: csak a Biztonság-listában. Belépés/jelszó: a könyvelő-figyelmeztetés + GYIK egy mondata („A belépési adataidat ehhez sem kérjük el.”); a bizalmi sávból kikerül. ONYA-részletek: Biztonság teljes, GYIK röviden (lásd GYIK-tétel), Hogyan 2. lépés röviden. Szerver/titkosítás: Biztonság + GYIK. „Nem kell kártya”: hős + ár-mikro + GYIK; a Hogyan 1. lépéséből kikerül. „Kártyával vagy átutalással”: Hogyan 3. lépés + ár-bekezdés + GYIK; a hős mikroszövegéből és a záró mikroszövegből kikerül. Hűségidő: hős, ár-bekezdés, összevetés-tábla, záró mikroszöveg; a GYIK felmondás-válasz végéről a „Hűségidő nincs.” kikerül. 24–48 órás mondat: csak a záró kártyában, egyszer. „Az app képei bemutató adatokkal készültek.”: a szabály szerint marad.", "sulyossag": "nagy"}, {"hol": "Bizalmi sáv (114–133. sor)", "mi_ai_hatasu": "4 egyforma ikonos blokk: „Valódi könyvelő / NAV-meghatalmazással / Európai szerveren / Magyar cég”, mindegyik alatt egy mondattal.", "miert": "Klasszikus „trust bar” sablon. Mind a négy állítás később újra elhangzik. A „Valódi könyvelő” és a „Magyar cég” címke önmagában bizonygatás. A „NAV-meghatalmazással” cím alatt nem a meghatalmazásról, hanem a jelszóról szól a mondat. Egy valódi magyar cég ezt egy sima sorban, cégadatokkal írja le, és ettől lesz hiteles.", "javitas": "A 4 blokk helyett egy kisebb betűs, ikon nélküli sor: „Az Adózz.hu a Somosi Kft. szolgáltatása · 1123 Budapest, Nagyenyed utca 5. · Adószám: 32769678-2-43 · A könyvelést nyilvántartásba vett könyvelő végzi, NAV-meghatalmazással · Cégadatok” (a „Cégadatok” marad link az #impresszum-ra).", "sulyossag": "kozepes"}, {"hol": "Hős (54–69. sor)", "mi_ai_hatasu": "„Valódi, nyilvántartásba vett könyvelő…” + „Az appban pedig mindig látod…” + a gomb alatt 3 pipás mikroszöveg („A regisztrációhoz nem kell kártya / Kártyával vagy átutalással fizethetsz / Nincs hűségidő”).", "miert": "A gomb alatti 3 pipás sor a legismertebb SaaS-hős minta. A „mindig” túlzás, a „valódi” bizonygatás. A fizetési mód itt még nem kérdés, az ár mellé való.", "javitas": "H1: „Saját könyvelő átalány­adózóknak és katásoknak” (pont nélkül, a &shy; maradhat). | bevezető: -> „Nyilvántartásba vett könyvelő intézi a bevallásaidat és a NAV-os ügyeidet. Te közben az appban látod, mennyit tegyél félre adóra, és mikor mit kell befizetned.” | ul.mikro (3 pipa) helyett egy szürke sor pipa nélkül: „Regisztrálni kártya nélkül tudsz. Hűségidő nincs.”", "sulyossag": "kozepes"}, {"hol": "Kinek szól (138–160. sor)", "mi_ai_hatasu": "„Átalányadósoknak és katásoknak. Csak nekik.”: drámai töredék, és szinte szó szerint a H1-et ismétli. A bevezetőben „dolgozunk… dolgozni” szóismétlés van, a „nem” lista vesszővel ér véget.", "miert": "A „Csak nekik.” típusú egyszavas utóütés generált reklámritmus. Az „átalányadós” és az „átalányadózó” keveredik. A vesszővel végződő lista befejezetlen, ilyet ember nem hagy így.", "javitas": "Felcím („Kinek szól”): törlés. | h2: -> „Kiket könyvelünk?” | bevezető: -> „Alanyi áfamentes egyéni vállalkozókat, akik átalányadóval vagy katával adóznak. Mást nem, ezért tudunk mindenkinek ugyanazon, előre kiírt áron dolgozni.” | igen-lista 2. sor: „alanyi ÁFA-mentes vagy,” -> „alanyi áfamentes vagy,” | nem-lista: „ÁFA-körbe tartozol,” -> „áfakörbe tartozol,”; az utolsó sor „Kft.-d vagy Bt.-d van,” -> „Kft.-d vagy Bt.-d van.” | megjegyzés: „Ha év közben változik a helyzeted, szólunk, és megbeszéljük, hogyan tovább.” -> „Ha év közben ide kerülsz, szólunk, és megbeszéljük, mi legyen.”", "sulyossag": "kozepes"}, {"hol": "Hogyan működik (169–193. sor)", "mi_ai_hatasu": "„Négy lépés, és a könyvelésed rendben van.”: SaaS-képlet. „A könyvelőd bekapcsolja a könyvelést.”: fordításíz. A 3. lépésben a 24–48 órás mondat (a zárónál még egyszer).", "miert": "Az „N lépés, és kész/rendben” a leggyakoribb generált lépés-cím. A „bekapcsolja” az angol „turns on” tükörfordítása, magyarul könyvelést elkezdenek vagy átvesznek. A 3. lépés címe csak a visszahívást mondja, a fizetés el van rejtve a szövegben.", "javitas": "Felcím: törlés. | h2: -> „Így indul a könyvelésed” | 1. p: -> „Megadod az e-mail-címedet, és válaszolsz pár kérdésre a vállalkozásodról.” | 2. h3: „Szerződés, meghatalmazás” -> „Szerződés és NAV-meghatalmazás”; p: -> „Elfogadod a szerződést, és a NAV-nál meghatalmazást adsz a könyvelődnek. Ezt ő is beküldheti, neked csak jóvá kell hagynod.” | 3. h3: „Visszahívás, ha kéred” -> „Átbeszéljük, ha szeretnéd”; p: -> „Az appban kérhetsz visszahívást, és a csapatunk mindent átbeszél veled. Fizetni csak utána kell, kártyával vagy átutalással.” | 4. p: -> „A könyvelőd elkezdi a könyvelésedet. Innentől a számláid maguktól bejönnek az appba, és ott van, mennyit tegyél félre.”", "sulyossag": "kozepes"}, {"hol": "#mit-kapsz bevezető (208. sor)", "mi_ai_hatasu": "„Nézd meg lépésről lépésre, mit mutat neked az app egy hónap alatt. A számolást és a bevallást a könyvelőd végzi. Te csak látod, hol tartasz.”", "miert": "A „lépésről lépésre” klisé. Az „egy hónap alatt” keret nem igaz a lépésekre (a keretek, az üzenetek nem havi események). A „hol tartasz” két sorral lejjebb a címet ismétli.", "javitas": "h2 marad (a tulajnak tetszett), csak pont nélkül: „Mindig tudod, hol tartasz az adóval” | bevezető: -> „A számolást és a bevallást a könyvelőd végzi. Az app arra való, hogy közben te is képben legyél. Ezt mutatja:”", "sulyossag": "kozepes"}, {"hol": "Biztonság (456–466. sor)", "mi_ai_hatasu": "„Érthető meghatalmazás, védett adatok.”: két melléknév + főnév pár vesszővel. „A NAV-meghatalmazás, röviden”.", "miert": "Brosúra-szlogen, nem mond semmit. A szakaszt egy kérdés vezetné be jól, amit a vállalkozó tényleg feltesz.", "javitas": "Felcím: törlés. | h2: -> „Mit jelent a meghatalmazás, és hol vannak az adataid?” | h3: „A NAV-meghatalmazás, röviden” -> „A NAV-meghatalmazás” | A 4. listapont („Az app soha nem küld be semmit a NAV-nak…”) marad: ez lesz az egyetlen helye. Az ár-blokkban és a GYIK-ben is „ÁFA” -> „áfa” (lásd az írásmód-tételt).", "sulyossag": "kicsi"}, {"hol": "Árak (487–548. sor)", "mi_ai_hatasu": "„Egy havidíj. Minden más díj előre kiírva.”: kétütemű cím. „A többit csak akkor fizeted, ha kéred.”: szó szerint kétszer, egymás alatt (489 és 515). Alul 3 pipás sor félkövér kezdettel.", "miert": "A kétütemű cím és a félkövér kezdetű pipás hármas sablon. Az egymás alatti szó szerinti ismétlés gépi hiba.", "javitas": "Felcím: törlés. | h2: -> „Mennyibe kerül?” | bevezető: „Évente egyszer jön hozzá az éves zárás. A többit csak akkor fizeted, ha kéred.” -> „A havidíjhoz évente egyszer jön hozzá az éves zárás. Minden más díj itt van lent, forintra pontosan.” | ar-afa: „bruttó, 27% ÁFA-val” -> „bruttó, 27% áfával” | ar-kulon-bev: -> „Az éves zárást akkor fizeted, ha az éves bevallásodat mi adjuk be. A többi díj csak akkor jár, ha te kéred a munkát. Mindet előre látod az appban, és a jóváhagyásod nélkül nem kérjük.” | ar-tenyek (3 pipás sor) helyett egy bekezdés: „Havonta előre fizetsz, kártyával vagy átutalással. Hűségidő nincs: ha lemondod, a kifizetett hónap végéig minden működik. Minden ár bruttó, 27% áfával, a részleteket az ÁSZF-ben találod.” (az ÁSZF link marad). | Díjlista: „SZJA vagy kata” -> „szja vagy kata”; „ÁFA-bevallás” -> „áfabevallás”; Benne van: „SZJA-előleg, TB-járulék, szocho” -> „szja-előleg, tb-járulék, szocho”.", "sulyossag": "kozepes"}, {"hol": "Összevetés bevezető (559. sor)", "mi_ai_hatasu": "„Mindkettő jó választás lehet. Ez a különbség.”", "miert": "A kiegyensúlyozó semmitmondás („mindkettő jó lehet”) tipikus AI-gesztus. Egy őszinte cég kimondja, kinek nem való, és ettől lesz hihető.", "javitas": "Felcím: törlés (a h2 kérdése elég). | bevezető: -> „Ha személyesen szeretnél leülni a könyvelőddel, egy hagyományos iroda jobb neked. Ha inkább a telefonodról intéznéd, nézd meg, miben más nálunk.”", "sulyossag": "kozepes"}, {"hol": "GYIK (603–639. sor)", "mi_ai_hatasu": "Több válasz szó szerint a fenti szakaszokat ismétli. A „Nem. Az adót te utalod el… az utalást te indítod… nem utalunk helyetted” háromszor mondja ugyanazt. A „Személyre szabott útmutató” marketing-buzzword.", "miert": "Belső háromszoros ismétlés és szó szerinti átvétel a Biztonság-szakaszból. A „személyre szabott” az AI-szövegek kedvenc jelzője.", "javitas": "603: „…szólunk, és megbeszéljük, hogyan tovább.” -> „…szólunk, és együtt megnézzük, mi a teendő.” (az „ÁFA-mentes/ÁFA-mentességet” -> „áfamentes/áfamentességet”). | 615: -> „Nem, az utalást mindig te indítod, a saját bankodból. Mi megmondjuk, mennyit, mikorra és melyik NAV-számlára utalj. A számládról pénzt nem vonunk le.” | 619: -> „Ezzel a könyvelőd a nevedben adhatja be a bevallásaidat, és intézheti az adóügyeidet a NAV-nál. A NAV online felületén (ONYA) adod meg, vagy a könyvelőd küldi be, és te jóváhagyod. Ugyanott bármikor visszavonhatod. A belépési adataidat ehhez sem kérjük el.” | 627: lásd a „valódi” tételt. | 631: az utolsó mondat („Hűségidő nincs.”) kikerül. | 639: „Személyre szabott útmutatót kapsz képekkel és videóval” -> „Olyan útmutatót kapsz, ami a te helyzetedre szól, képekkel és videóval”.", "sulyossag": "kozepes"}, {"hol": "Záró CTA + visszahívás-kártya (649–659. sor)", "mi_ai_hatasu": "„Regisztrálj, válaszolj pár kérdésre, és ha kéred, előbb visszahívunk.”: három felszólítás egymás után. A mellette lévő kártya ugyanezt mondja. A záró mikroszöveg: „19 999 Ft/hó bruttó · Nincs hűségidő · Kártya vagy átutalás” (pontokkal elválasztott hármas). A kártyában „egy gombbal”.", "miert": "A hármas, ponttal tagolt mikroszöveg és a hármas felszólítás a sablon zárás. A visszahívást itt kétszer mondja el két blokk.", "javitas": "h2: „Legyen saját könyvelőd” (pont nélkül). | p: -> „Regisztrálj, és válaszolj pár kérdésre a vállalkozásodról.” | zaro-mikro: -> „Havi 19 999 Ft bruttó, hűségidő nélkül.” | kártya p: „Regisztráció után az appban egy gombbal kérsz visszahívást.” -> „Regisztráció után az appban kérhetsz visszahívást.”; utána változatlanul: „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. A visszahívás ingyenes, és nem kötelező.” (ez az engedett mondat egyetlen helye).", "sulyossag": "kicsi"}, {"hol": "Szakasz-felépítés: felcím + h2 + bevezető minden szakaszban (136, 167, 203, 400, 453, 484, 554, 593. sor)", "mi_ai_hatasu": "8 szakasz ugyanúgy indul: kis felcím (ami a menüpontot ismétli), alatta szlogencím, alatta bevezető, utána kártyarács.", "miert": "Az egyforma szakaszváz a generált landing legerősebb szerkezeti jele: a szöveg sablonba van töltve, nem a tartalomhoz igazodik. A felcím („Árak”, majd „Mennyibe…”) duplán mondja ugyanazt.", "javitas": "Felcím csak a hősben („Online könyvelés egyéni vállalkozóknak”) és a Mit kapsz szakaszban („Mit kapsz”) marad, a többiből kikerül: Kinek szól, Hogyan működik, A könyvelőd, Biztonság, Árak, Összevetés, GYIK. A címek típusa váltakozzon: kérdés („Kiket könyvelünk?”, „Ki könyvel neked?”, „Mennyibe kerül?”, „Miben más, mint egy hagyományos könyvelőiroda?”), sima állítás („Így indul a könyvelésed”), egyszerű címke („Gyakori kérdések”). Bevezető csak ott legyen, ahol új információt ad (Kinek, Mit kapsz, Árak, Összevetés), a Hogyan és a GYIK fölött nem kell.", "sulyossag": "kozepes"}, {"hol": "Szó-tikkek az egész oldalon", "mi_ai_hatasu": "„látod/Látod” 16×, „ha kéred/Ha kéred” 10×, „rendben” 8×, „egy gombbal / egy koppintással / egy gombnyomással” 5×, „és kész” 3×, „maguktól” 2×.", "miert": "Ugyanaz a fordulat újra és újra: ez a gépi szöveg hangja. Ember ennyi szövegben magától váltogat („ott van”, „megmutatja”, „megnézheted”, „ha szeretnéd”).", "javitas": "A fenti cserékkel a „látod” kb. 6-ra, a „ha kéred” 2-re csökken („Ha kéred, ő küldi be” -> „Ezt ő is beküldheti”; „Visszahívás, ha kéred” -> „Átbeszéljük, ha szeretnéd”; „ha kéred, előbb visszahívunk” -> „Ha szeretnéd, előbb visszahívunk”). Az „egy gombbal” csak az igazoláskérésnél marad, az „egy koppintással” csak a számlaszám-másolásnál. Az „és kész” sehol. A Benne van listában: „Üzenetek a könyvelődnek, visszahívás, ha kéred” -> „Üzenetek a könyvelődnek, visszahívás igény szerint”.", "sulyossag": "kozepes"}, {"hol": "Írásmód az egész oldalon: ÁFA (12×), SZJA/Szja/szja vegyesen, TB-járulék, átalányadós/átalányadózó", "mi_ai_hatasu": "Csupa nagybetűs „ÁFA”, „ÁFA-mentes”, „ÁFA-körbe”. Az „SZJA” (ár) mellett „Szja” (app-réteg) és „szja” (GYIK). Az „átalányadósoknak” (Kinek h2) mellett „átalányadózóknak” (H1).", "miert": "A NAV és a magyar könyvelők „áfa”, „szja”, „tb-járulék”, „áfamentes” alakot írnak. A csupa nagybetű és a keveredés fordított vagy összeollózott szöveg hatását kelti, a következetes NAV-os írásmód viszont szakértőt mutat.", "javitas": "Mindenhol (meta description is): „ÁFA” -> „áfa”, „ÁFA-mentes” -> „áfamentes”, „ÁFA-mentességet” -> „áfamentességet”, „ÁFA-körbe” -> „áfakörbe”, „ÁFA-bevallás” -> „áfabevallás”, „27% ÁFA-val” -> „27% áfával”, „ÁFA nélkül” -> „áfa nélkül”, „SZJA” -> „szja”, „SZJA-előleg” -> „szja-előleg”, „TB-járulék” -> „tb-járulék”, „vállalkozói SZJA-val” -> „vállalkozói szja-val”. Mindenhol „átalányadózó”, sehol „átalányadós”. A mondat eleji „Szja-előleg” (app-réteg) marad nagy kezdőbetűvel.", "sulyossag": "kozepes"}, {"hol": "#mit-kapsz 1. lépés, értesítés-réteg (230. sor)", "mi_ai_hatasu": "„Új számla a NAV-tól”", "miert": "Nem AI-íz, hanem félreérthető, ami szintén gépies figyelmetlenségnek hat. Egy vállalkozó úgy olvassa, hogy a NAV küldött neki számlát vagy bírságot. Valójában a saját kiállított számlája jött be a NAV Online Számlából.", "javitas": "„Új számla a NAV-tól” -> „Új kiállított számla” (az alsor marad: „Napfény Étterem Kft. · 418 000 Ft”).", "sulyossag": "kozepes"}, {"hol": "Hős vezérlő és feliratok: sablon 85–107. sor (data-cim, hos-felirat, fülek, „Melyik képernyőt mutassuk?”), mozgas.js 55, 70, 83. sor (aria-label „Képváltás szüneteltetése/indítása”), 77. sor (gépes kép alt), 92. sor (figcaption)", "mi_ai_hatasu": "Az 5 forgó felirat ugyanarra a képletre épül: „Név: mondat” („Főoldal: mennyit tegyél félre adóra”, „Dosszié: minden papírod egy helyen”, „Üzenetek: a könyvelőd egy üzenetnyire”, „Fotózás: a papírt lefotózod, és kész”, „Határidők: mit, mikorra, melyik számlára”).", "miert": "A tulaj döntése szerint a gombsor és a felirat kikerül. A képletes feliratokat ne tegyük át máshova, mert ugyanazokat a kliséket hordozzák („egy üzenetnyire”, „és kész”, hármas).", "javitas": "A data-cim attribútumok, a hos-felirat, a fülek feliratai, a „Melyik képernyőt mutassuk?” csoportcímke és a mozgas.js két aria-label szövege a vezérlővel együtt megszűnik. Szöveges pótlás nem kell; a forgó képek ne kapjanak aria-live-ot. A gépes kép alt-ja a gépes képpel együtt megy. Az első telefonkép alt-ja marad: „Az Adózz.hu app főoldala telefonon: mennyit tegyél félre adóra, határidők”. A figcaption („Az app képei bemutató adatokkal készültek.”) a szabály szerint marad. Ez nem a tulaj által kifogásolt felirat, az a gombsor alatti hos-felirat volt. Ha a tulaj szó szerint semmit sem akar a telefon alá, a mondat a hős bal oszlopába, a mikroszöveg alá költözhet, apró szürke betűvel.", "sulyossag": "kicsi"}], "iranyelvek": "HANG: egy kis budapesti könyvelőcég ügyintézője ír egy 40 körüli villanyszerelőnek vagy kozmetikusnak. Tegező, nyugodt, tárgyszerű, inkább kicsit száraz. Nem lelkesedik, nem győzköd, nem bizonygat. A hitelességet a konkrétum adja, nem a jelző: forintösszeg, menüút (Fiók > Előfizetés > Lemondás), cégnév, cím, adószám, ONYA, a könyvelő nyilvántartási száma a szerződésben.\n1) CÍMEK: pont nélkül (a kérdőjel marad). Egy cím egy állítás. Tilos a két ütemre tört cím („X. Y.”), a „Kérdés? Válasz, és kész.” forma, az „És…”-sel kezdett töredék és a vesszős névszópár („Érthető meghatalmazás, védett adatok”). Ahol a vállalkozó kérdezne, ott kérdés legyen („Kiket könyvelünk?”, „Ki könyvel neked?”, „Mennyibe kerül?”). Nem kell minden cím szlogen: a szakaszcím lehet sima címke vagy egyszerű állítás.\n2) HASZON: a mondatba kerül („…, így…”, „…, ezért…”) vagy a címbe. Soha nem kerül külön címkével vagy dobozba („Neked ebből”, „Előny”, „Miért jó”).\n3) EGY TÉNY EGYSZER: ami már elhangzott, az nem ismétlődik. A GYIK lehet kivétel, de rövidebben és más szavakkal. A „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.” pontosan egyszer szerepel (záró kártya), más válaszidő-ígéret nincs.\n4) TAGADÁS: szakaszonként legfeljebb egy biztosító, tagadó mondat. Inkább állíts („az utalást te indítod”), mint halmozd a tagadást („nem vonunk le, nem utalunk, nem küld be, soha nem kérünk”).\n5) KERÜLENDŐ: „valódi (könyvelő)”, „nem egy program”, „Csak nekik.”, „egy üzenetnyire”, „egy pillantásból”, „lépésről lépésre”, „személyre szabott”, „és kész”, „az app már tudja”, „bekapcsolja a könyvelést”, „Mindkettő jó választás lehet.” Korlátok: „ha kéred” legfeljebb 2–3×, „látod” szakaszonként legfeljebb 1×, „egy gombbal” és „egy koppintással” egyszer-egyszer.\n6) RITMUS ÉS SZERKEZET: változó mondat- és bekezdéshossz. Hármas felsorolás csak akkor, ha tényleg három dolog van, és ne legyen minden blokk vége hármas (pipás mikroszöveg, 3 kártya, pontokkal tagolt hármas). Ne induljon minden szakasz felcím + szlogencím + bevezető + kártyarács sorrenddel. Felcím csak a hősben és a Mit kapsz szakaszban maradjon. Kártya vagy doboz csak ott legyen, ahol tényleg külön dologról van szó (ár, díjlista, táblázat), ikon + kétszavas cím + egy mondat formájú rács sehol.\n7) ÍRÁSMÓD (NAV szerint, következetesen): áfa, áfamentes, áfakör, áfabevallás, szja, szja-előleg, tb-járulék, szocho, kata, katás, kata-keret, átalányadózó (nem „átalányadós”). Ezres tagolás nem törő szóközzel („19 999 Ft”). Nincs „a(z)”. A listák írásjelei rendben legyenek, a lista ne végződjön vesszővel.\n8) VÁLTOZATLAN: minden ár és tény (19 999 Ft/hó bruttó, éves zárás 14 999 Ft, 254 987 Ft/év, külön díjak), „Az app képei bemutató adatokkal készültek.”. Nincs AI-említés, nincs kitalált vélemény, szám, díj vagy könyvelőnév, és csak valós funkció szerepel."}

=====

## Telefonkeret: kész, saját SVG (letöltött keret egyik jelölt licence alapján sem használható)

**A választott keret** egy saját, kézzel írt SVG-keret. Valósághű, de márkajelzés nélküli: grafitszínű, rétegzett fém perem (alap-színátmenet, sötét külső él, felső-alsó csúcsfény, belső árnyékvonal), fekete üvegperem fénylő éllel és felső hangszóró-réssel. A kamera kör alakú előlapi kivágás, kék lencsefénnyel. Jobb oldalon hangerő- és bekapcsológomb van fém színátmenettel, a peremen 4 antennacsík, a kijelzőn halvány tükröződés. Az SVG-ben nincs külső hivatkozás, a CSP-vel (default-src 'self') működik, és az egybe.py base64-gyel beágyazza.

Az Apple-jellegzetességeket szándékosan kihagytam: nincs Dynamic Island vagy notch, nincs Ring/Silent kapcsoló, nincs bal oldali hangerősor. Ennek oka, hogy az Apple irányelvei ezeket a részleteket általános készülékrajzon sem engedik.

Megnéztem a képeket, a geometriát Puppeteerrel ellenőriztem:
- **390 px-es telefonnézetben, 2x-es élességgel** világos és sötét alapon: pontosan illeszkedik, nincs varrat, nincs vízszintes kilógás (scrollWidth 390).
- **Mért arány:** a .telefon magassága / szélessége 2,0461, ez megegyezik a 888/434 aránnyal. Az app-kép eltolása és szélessége a számítottal egyezik (például 300 px-es keretnél 15,2 px és 269,59 px).

**Fájlok:**
- `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/kepek/telefon_keret.svg` (4,6 KB, ez a fő változat)
- `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/kepek/telefon_keret.webp` (868x1776, 2x-es, átlátszó, veszteségmentes, 50 KB, tartaléknak)
- `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/kepek/LICENC_telefon_keret.txt`: eredet, a jelöltek elvetésének okai forrás-URL-ekkel, méretek, dátum
- Munkafájlok, próbaképek, minta-CSS és minta-HTML: `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/telefon_keret_munka/` (benne `minta.css`, `minta.html`, `minta_390.png`, `proba_1x.png`, `proba_sarok.png`, valamint `telefon_keret_v1.svg`, az első változat)

**Licenc:** saját munka, nincs benne harmadik fél anyaga, és MI-vel generált kép sincs. Saját szerverről szabadon használható. Az oldalon ne nevezzük iPhone-nak.

**Miért nem letöltött keret** (2026-11-20-án ellenőrizve):
- **Apple Product Bezels:** a licenc csak az App Store-ban elérhető appokra és csak Developer Program-tagoknak szól. Tilt minden módosítást, árnyékot és tükröződést is, a tulaj pedig árnyékot kér. Nem használható.
- **Meta „Design at Meta – Devices”:** kereskedelmi célra csak írásos engedéllyel használható. Nem használható.
- **picturepan2/devices.css (MIT):** lapos, sematikus, iPhone 14 Pro-utánzat, a kijelzője 390x830, nem illik a 390x844-es képeinkhez.
- **Magic UI iPhone (MIT):** lapos, szürke vonalrajz.
- **PommePlate (CC0):** régi, notch-os iPhone-ok, a tárolót 2023-ban archiválták.
- **Monkr:** az Apple bezel-képeit használja.

**Letöltés:** én nem töltöttem le semmit. A `mockup_letoltes/devicescss` és `mockup_letoltes/magicui` mappát 20:47-kor már kitöltve találtam. Csak olvastam belőlük, nem futtattam semmit, és nem vettem át belőlük kódot.

## Méretek

A keret viewBoxa 0 0 434 888. Egy egység 1 CSS px, ha a keret 434 px széles. 2x-es webp-ben minden érték kétszeres.

| Elem | Helyzet | Méret | Sarok |
|---|---|---|---|
| Kijelző (ide kerül az app-kép) | x 22, y 22 | 390x844 | r44 |
| Látható nyílás (átlátszó a kereten) | x 22,5, y 22,5 | 389x843 | r43,5 |
| Készüléktest | x 3–431, y 3–885 | 428x882 | r63 |
| Oldalgombok | x 431–433,6; y 196–298 és 330–396 | – | – |
| Kamera | középpont (217, 44) | r6,4 | – |

- **A kijelző százalékban:** left 5,069%, top 2,4775%, width 89,862%, height 95,045%, border-radius 11,282% / 5,213%. A kijelző pontosan 390x844, tehát a 780x1688-as képek torzítás és vágás nélkül illenek bele.
- **A nyílás szándékosan kisebb.** A perem 0,5 egységgel rálóg a képre, így nincs világos varrat. Kör alakú vágás körben 0,5 px-t takar, ez semmit nem takar el a tartalomból.
- **Kamera és állapotsor:** a kamera a „9:41” és az ikonok közötti üres sávban, az állapotsor magasságában ül.
- **2x-es webp-ben mérve:** a nyílás x 45–822, y 45–1730 (pixelhatárral 823 és 1731), a kijelző 44,44 780x1688, sarka r88.

## Beillesztés

Csak CSS kell, a 8 telefon HTML-je maradhat. A keret ::after rétegként a képernyő fölé kerül, az árnyék ::before rétegként a test alakjában.

```css
/* telefonkeret: kepek/telefon_keret.svg (434x888; kijelző x22 y22 390x844 r44) */
.telefon {
  --w: 260px;
  box-sizing: border-box; position: relative; isolation: isolate; flex: none; align-self: flex-start;
  width: var(--w);
  padding: calc(var(--w) * .05069);          /* 22/434 minden oldalon -> magasság = w*888/434 */
  background: none; border-radius: 0; box-shadow: none;
}
.telefon::before {                           /* árnyék a test alakjában (a test 3 egységgel beljebb) */
  content: ""; position: absolute; z-index: -1; inset: calc(var(--w) * .00691);
  border-radius: calc(var(--w) * .14516);    /* 63/434 */
  box-shadow: 0 40px 70px -28px rgba(16,21,43,.45), 0 14px 28px -14px rgba(16,21,43,.30);
}
.telefon::after {                            /* keret a képernyő FÖLÖTT; a régi pirula-sziget helyett */
  content: ""; position: absolute; z-index: 6; inset: 0; pointer-events: none;
  transform: none; top: 0; left: 0; width: auto; height: auto; border-radius: 0;
  background: url("kepek/telefon_keret.svg") 0 0 / 100% 100% no-repeat;
}
.telefon > img, .telefon > .valto, .telefon > .kepernyo {
  display: block; width: 100%; height: auto;
  border-radius: calc(var(--w) * .10138);    /* 44/434 (eddig .127) */
  overflow: hidden;
}
.bemutato .telefon { background: none; box-shadow: none; }   /* a régi sötét doboz és belső keret ki */
```

Teendők a mostani stilus.css-ben:
- **Régi ::after (pirula-sziget):** a `.telefon::after` mostani deklarációit cserélni kell, vagy felül kell írni őket. A fenti blokk ezt fedi le.
- **Lekerekítések:** a `.telefon img`, a `.telefon .valto` és a `.kepernyo` `.127`-es szorzója `.10138` legyen.
- **Doboz és padding:** a `.telefon` régi padding (`.03`), háttér és box-shadow kimarad.
- **Mobil --w értékek:** a 236, 248 és 232 px-es felülírások maradhatnak. A kijelző szélessége ezekben `0,8986 × --w` lesz, vagyis kicsit keskenyebb a mostaninál, ezért a --w-t érdemes kb. 5%-kal növelni.
- **Belső rétegek a .kepernyo-n belül:** a százalékos és em-alapú méretek a .kepernyo-hoz igazodnak, nem kell őket módosítani.
- **Aránytartás:** a keret preserveAspectRatio-ja alapértelmezett (meet), ezért nem torzul. A .telefon-t viszont nem szabad flex-stretch-csel magasítani, ezért kell az `align-self: flex-start`.
- **Hero váltóképek:** a `.valto` crossfade és a translateX úgy marad, a keret fölötte van. JS nélkül és csökkentett mozgásnál is látszik, mert sima CSS-háttér.
- **Tükröződés:** a kijelzőn lévő halvány tükröződés egyetlen `<rect fill="url(#tukor)">` sor az SVG-ben, és törölhető, ha nem kell.
- **Home-csík:** szándékosan nincs benne, mert sötét aljú képen eltűnne.

=====

# SaaS-kutatás és specifikáció az Adózz.hu oldalához (11-20)

12 oldalról készült kép és stílusmérés gépen (1440) és telefonon (390), és öt írást olvastam el arról, mitől tűnik egy oldal „AI-nak”. Az oldalon semmit nem szerkesztettem, és nem töltöttem le semmit.

**Röviden:** a jól kinéző oldalak kevés eszközzel dolgoznak.
- 1–2 márkaszín, legfeljebb 3 háttér.
- Közepes vastagságú cím (500–600).
- A termék valódi képe nagyban.
- A funkciókat vékony vonalakkal tagolt lista vagy keretes rács mutatja be, nem ikonos dobozsor.
- Szinte semmi díszítés: nincs csupa nagybetűs felcím, színes számkör, oldalcsíkos kiemelő doboz, emoji-ikon csempén, és nincs minden szakasznak saját pasztellje.

A mostani oldalon pont ezek vannak.

---

## 1. Mért adatok (getComputedStyle, px)

| Oldal | H1 gép (méret/sormagasság, vastagság, betűköz) | H1 telefon | H2 gép / telefon | Alcím | Fő gomb (gép) | Színek | Hős termékkép |
|---|---|---|---|---|---|---|---|
| Linear | 64/64, 510, −0,022em | 38/42 | 48 / 24 | 16 | 32 magas, pill | nincs kiemelőszín, sötét | 1320 px széles valódi UI, mobilon jobbra kilóg a képből |
| Attio | 64/61, 600, −0,02em | 40/38 | 40 / 32 | 18 | 36, r10 | fekete + 1 kék | középre zárt cím, alatta ~1080 px valódi app-ablak |
| Qonto | 56/56, 700, 0 | 36/40 | 56 / 32 | 18 | 48, r8, fekete | fekete-fehér | középre zárt; gépen középen, mobilon balra zárt |
| Billingo | 56/64, 500, −1px | 40/48 | 48 / 40 | 16 | 49, r8, korall #FF6F55 | kék #314EFF + korall | szöveg balra, jobbra fotó valódi app-képpel, teljes kék sáv lekerekített aljjal |
| Pennylane | 52/60, 600, −3% | 36/41 | 34 / 32 | 24 | 50, r6, neon #00F872 | mélyzöld #003D3D + neon | szöveg balra, jobbra asztali fotó valódi képernyővel |
| Számlázz.hu | 48/54, 600 (Lexend), 0 | 32/40 | ~32 | 16 | 42, r6, narancs #FF6630 | sötétkék + narancs | szöveg balra, jobbra fotó ferde kivágásban |
| Kontist | 48/48, 600, 0 | 30,6/34 | 40 / 30,6 | pipalista | 52, pill, menta #01FF94 | mélytürkiz #002E33 + menta | szöveg balra, jobbra döntött valósághű iPhone halvány panelben, a telefon alul kivágva |
| Stripe | 48/55, **300**, −0,02em, kétszínű | 34/35, csak az első mondat | 32 / 22 | (a cím 2. fele) | 48, r4, #533AFD | lila + színátmenetes szalag | szöveg balra; lent keretes bento valódi UI-darabokkal |
| Mercury | 49/54, 480, 0 | 28/31 | 42 / 28 | 21 | 40, pill | sötét + kék #5266EB | középre zárt cím teljes szélességű képen |
| Accountable | 72/72, 800 | 48/48 | 60 / 30 | 20 | 56–78, r12, lila | lila + sötétlila | középre zárt; laptop + telefon + kártya + kabala; mellette apró tanúsítvány-címkék |
| Raycast | 64/70, 600 | 36/40 | 20–32 | 18 | 36, r8 | fekete + piros | középre zárt cím absztrakt fénycsíkokon |
| Finom | 148 keskeny nagybetűs, 900 | 72 | 64 / 40 | – | 56, pill | szürke + rózsaszín | középen telefon, körülötte lebegő UI-cédulák |
| **Adózz most** | **58/61, 700, −0,035em** | 38 | **46 / 31** | 20 | **54, r12, belső árnyék** | kék + sárga + **6 pasztell háttér + 6 kiemelőszín** | telefon + böngésző + levendula doboz + vezérlősor |

**Mediánok**
- **Gép:** H1 56 px; vastagság 500–600 (700 fölött csak 3/12); betűköz 0 és −0,025em között; H2 40 px; alcím 18 px; gomb 48 magas, 6–8 px sarok.
- **Telefon:** H1 36 px (a gépi méret 60–65%-a); H2 28–32; oldalmargó 16–24 px; a fő gomb 4/12 oldalon teljes szélességű (Stripe, Kontist, Attio, Qonto).
- **Szakaszköz:** Linear 128 px, Számlázz.hu 64 px gépen / 32 px telefonon; a többin képről mérve 96–128 px.
- **Tartalomszélesség:** 1024 (Számlázz.hu), 1140 (Kontist), 1280 (Linear, Billingo), 1312 (Pennylane), 1344 (Qonto).
- **Alcím szélessége:** 486–672 px.

## 2. Mitől néznek ki jól, és miért nem sablonosak (látott minták)

1. **A termék valódi képe a fő kép, nagyban.** Linear és Attio: a hős alatt ~1100–1300 px széles valódi UI. Kontist: egy nagy, valósághű telefon. Pennylane, Billingo, Számlázz.hu: fotó, rajta a valódi app.
2. **Kevés szín.** Mind a 12 oldalon 1–2 márkaszín van. A márkaszín a gombon és 1 sávon jelenik meg, nem szakaszonként. Háttérből legfeljebb 3: fehér, egy halvány semleges, és egy sötét vagy márkaszínű sáv (Qonto fehér/fekete, Pennylane fehér/mélyzöld, Stripe fehér + 1 sötét sáv, Billingo fehér + kék sávok).
3. **Közepes vastagságú, kicsit szűkített cím.** 500–600 vastagság, −0,02em körüli betűköz. A Stripe 300-as vékony betűvel dolgozik. A sablon-hatást a 700–800-as, nagyon szűk cím adja.
4. **Kétszínű címek.** Az első mondat sötét, a folytatás szürke ugyanabban a címben, és ez kiváltja az alcímet (Stripe, Attio, Linear, Raycast).
5. **A funkciók ikonos dobozsor helyett ezekkel jelennek meg:**
   - Vékony vonalakkal tagolt lista bal oldalt, mellette egy nagy termékkép (Mercury, Kontist, Qonto).
   - Keretes bento-rács, egy nagy és két kisebb cellával, a UI-darabok kilógnak a cella széléből (Stripe, Pennylane, Billingo).
   - Közös keretes rács, ahol a cellák között 1 px vonal van, nincs rés és nincs árnyék (Attio, Linear).
   - A Számlázz.hu 3×3-as egyforma ikonos kártyarácsa a legkevésbé modern elem a 12 oldal közül.
6. **Ikon kevés és egyféle.** Egyszínű vonalikon csempe nélkül (Kontist ~24 px, Billingo), vagy semmi (Linear, Qonto, Stripe). Emoji-ikont egyik oldal sem használ díszítésre.
7. **Felcím alig van.** Csupa nagybetűs, ritkított, színes felcím csak a Linearen van, egyszer. Az Attio egyszer használ egy „Platform” címkét, a Számlázz.hu apró kisbetűs címkéket.
8. **Ellenőrizhető bizalmi elemek.**
   - Cégadat és hatósági tény: Qonto „francia bank, párizsi központ”; Kontist „Solaris partnerbank, BaFin”; Accountable apró címkék a hős mellett (GoBD, németországi szerver, ELSTER).
   - Hivatalos jelvény: Pennylane.
   - A többi bizalmi elem (logók, csillagos értékelés, ügyfélszám) kitalált adat nélkül nálunk nem használható.
9. **Kevés mozgás.** Váltakozó termékkép vagy fül (Attio, Mercury), lassú logó-szalag (Stripe, Mercury, Linear). Nem úszik be minden kártya, és nincs számláló-pörgetés.
10. **Mobilon:**
    - Gépen középre zárt hős mobilon balra zárt (Qonto).
    - A UI nem zsugorodik olvashatatlanra, hanem kilóg a jobb szélen (Linear, Pennylane, Attio).
    - A logósor vízszintesen görgethető szalag.
    - A bento egy oszlopba rendeződik.
    - A gombok teljes szélességűek.
    - A Billingo és a Számlázz.hu a képet a cím fölé teszi; a többiek alá.

## 3. Miért tűnik a mostani oldal AI-nak (mért okok)

1. **Szivárvány-szakaszok:** 6 különböző szakaszháttér (kék, meleg, sötét, menta, levendula, kék) és 6 funkció-kiemelőszín (.szin-*). Egyik minta sem csinálja ezt.
2. **Ugyanaz a ritmus tízszer:** színes, nagybetűs felcím → 46 px-es félkövér cím → bevezető → dobozok. Felcímből 9 van a sablonban.
3. **Dobozba tett doboz:**
   - „Neked ebből:” kiemelők színes bal oldali csíkkal.
   - 3 egyforma ikonos tény-kártya.
   - Idővonal kártyában, ikonos csempékkel és függőleges vonallal.
   - Tény-kártyák 2 px-es színes kerettel.
4. **Emoji-ikonok csempén:** 23 Fluent-ikon a sablonban, nagyrészt díszítésként.
5. **Túl sok árnyék és sarokméret:** 26 box-shadow, ~15 féle border-radius (2–24 px, 50%, 99px).
6. **A hős túlzsúfolt:** telefon + böngésző + levendula háttérdoboz + vezérlősor + felirat + elválasztó + nagy ár + 3 pipa.
7. **Két egyforma súlyú gomb** a hősben, a fő gombon 3D-hatású belső árnyék.
8. **Díszítő mozgás:** a kártyák beúsznak, a dobozok egér alatt felemelkednek, a sötét szakasz mögött színes fényfoltok vannak.

## 4. Rendszer (tokenek) az építőnek

### Színek
| Szerep | Érték |
|---|---|
| Címek | #10152B |
| Szöveg | #2A3247 |
| Halvány szöveg | #5F687D |
| Kétszínű cím 2. fele világos alapon | #7A8295 (3,9:1; csak 24 px fölött) |
| Kétszínű cím 2. fele sötét alapon | #8C94AD (6:1) |
| Vonal | #E6E9F2 |
| Panelkeret | #DDE2EC |
| Halvány háttér | #F6F7FA |
| Sötét sáv | #10152B |
| Márka-kék | #1428DB |
| Sárga | #FFC93C (hover #FFC11A) |
| Zöld pipa | #15803D |

- **Kék:** csak linkre, aktív állapotra, a záró sávra és az összevetés Adózz-oszlopára.
- **Sárga:** csak a fő gombokra és a sötét listában az aktív lépés számára.
- **Pasztellek és .szin-* kiemelőszínek:** törölni.
- **Hátterek:** fehér, #F6F7FA, #10152B, és egyszer #1428DB. Ennél több nincs.

### Tipográfia (Geist; vastagság csak 400, 500, 600)
| Elem | Gép | Telefon |
|---|---|---|
| H1 | 56/1.04, 600, −0,025em (981–1180 px között 48) | 36/1.08, −0,02em |
| H2 | 40/1.1, 600, −0,02em | 28/1.15 |
| H3 | 20/1.3, 600, −0,01em | 18 |
| Bevezető | 19/1.55, #5F687D, max 560 px | 17 |
| Szöveg | 16/1.6, max 68ch | 16 |
| Apró | 14/1.5 | 14 |
| Gomb | 17, 600 | 17 |

- Számoknál: font-variant-numeric: tabular-nums.
- Felcím (.felcim) sehol nincs. Ha mégis kell, 15 px, 500-as vastagság, kisbetűs, #5F687D.

### Térköz és rács
- **Konténer:** 1200 px tartalom; oldalmargó 40 / 32 (tablet) / 20 px (telefon).
- **Szakaszköz:** fő szakasz 112 px gépen, 72 px telefonon; kis szakasz (bizalmi sor) 56 / 40 px. Nem mind egyforma.
- **Címblokk és tartalom között:** 48 / 32 px. **H2 és bevezető között:** 16 px.

### Sarkok és árnyékok
- **Sarkok, csak három érték:**
  - 8 px: gomb, beviteli mező, címke;
  - 16 px: panel, képdarab;
  - 999px: pill.
- **Árnyék:** csak a telefonokon. Kártyán, gombon és táblázaton nincs árnyék; helyette 1 px keret vagy háttérváltás.

### Ikonok
- A Fluent-ikonok csak az app képein belül maradnak, mert az a valódi UI.
- Az oldalon legfeljebb 4–6 ikon lehet, ha kell: saját inline SVG, 20 px, 1,5 px vonal, currentColor, csempe nélkül.

### Mozgás
- Csak a hős képernyőváltása és a „Mit kapsz” szakasz ragadós telefonja mozog.
- Nincs beúszás, felemelkedés, és a telefonon kívül számlálópörgetés sem.
- A telefon képernyőjén belüli réteganimációk maradhatnak.
- Időzítés: 200–400 ms, cubic-bezier(.2,.7,.2,1), csak opacity/transform.

### Telefon-keret (tulaj 3. pontja; minden telefon ezt kapja)
A valós oldalakon fotóhű iPhone-keret van (Kontist, Finom, Accountable). A jogilag legtisztább megoldás egy saját rajzolású SVG/CSS keret, így licencfájl sem kell. Letöltött mockup csak egyértelmű kereskedelmi webes licenccel jöhet szóba, LICENC_*.txt-vel.

Méretek a képernyő W szélességéhez képest (képarány 780:1688 = 1:2,164):
- **Képernyő:** sarok 0,14W.
- **Fém perem:** 0,012W, linear-gradient(90deg, #3A3F4B, #8A90A0 25%, #2E323C 50%, #8A90A0 75%, #3A3F4B).
- **Fekete keret:** 0,033W (#0B0C10). Külső szélesség ≈1,09W, külső sarok ≈0,185W.
- **Dynamic Island:** 0,32W × 0,095W, a képernyő tetejétől 0,028W-re. Csak akkor kell, ha a képernyőkép nem tartalmazza már (ne legyen dupla).
- **Gombok:** 0,012W vastagok, fém színátmenettel; magasság és hely a keret magasságához (H) képest:
  - bal oldalon akciógomb 17% / 4%, hangerő fel 24% / 7,5%, hangerő le 33% / 7,5%;
  - jobb oldalon bekapcsológomb 27% / 11%.
- **Árnyék fehér alapon:** 0 40px 80px -30px rgba(16,21,43,.45), 0 18px 36px -18px rgba(16,21,43,.30), és alatta talpárnyék: egy 70% széles, 24 px magas elmosott ellipszis (radial-gradient rgba(16,21,43,.28) → átlátszó).
- **Árnyék sötét alapon:** 0 40px 80px -20px rgba(0,0,0,.6).
- **Állás:** egyenes, nem döntött. A Kontist dönti, de telefonon az egyenes jobban olvasható.

## 5. Szakaszonként

### Fejléc
- 72 px magas, fehér, alul 1 px #E6E9F2.
- Menü: 15 px, 500-as vastagság.
- Jobbra „Belépés” szöveglink és a sárga „Regisztrálok” gomb (40 magas, r8, 600).
- Telefonon 60 px magas, egy kicsi sárga gomb és menü.
- Minta: Qonto, Attio, Kontist.

### Hős (tulaj 1. és 2. pontja)
**Háttér és rács**
- Fehér háttér, színátmenet nélkül.
- Rács 7/5: a szöveg 620 px széles, a telefon a jobb oszlop közepén.
- Térköz fent 64, lent 80 px. 1440×900-on a bizalmi sor alja még éppen látszik.
- Minta: Kontist, Billingo, Pennylane; a félkövér-szűk H1 helyett a Linear/Attio vastagsága.

**Bal oszlop, sorrendben**
1. A felcím helyett opcionális 15 px-es szürke sor kisbetűvel: „Online könyvelés egyéni vállalkozóknak”.
2. H1 56 px (a szöveg marad).
3. 24 px-es köz, bevezető 19 px, max 540 px.
4. 32 px-es köz, gombsor:
   - sárga „Regisztrálok” gomb: 52 magas, 24 px-es vízszintes belső margó, r10, 17/600, árnyék nélkül;
   - mellette 24 px-re a „Visszahívást kérek →” szöveglink: 17/500, #1428DB, 52 px magas kattintható terület.
   - Egy domináns gomb + szöveglink: Attio, Stripe, a tiltólista szerint.
5. 20 px-es köz, egysoros ár-sor 15 px-en, #5F687D:
   - „**19 999 Ft/hó** bruttó · éves zárás 14 999 Ft/év · minden díj kiírva”;
   - a „kiírva” link a #arak szakaszra mutat.
   - Az elválasztó vonal, a nagy ár és a 3 pipa kimarad; a kártya- és hűségidő-infót az Árak szakasz és a záró sor viszi.

**Jobb oszlop**
- Egyetlen telefon, 288 px képernyő-szélesség (külsőleg ~314), egyenesen, csak árnyékkal.
- Nincs mögötte doboz, nincs böngészőkép, és alatta sincs semmi.
- „Az app képei bemutató adatokkal készültek.” mondat: a „Mit kapsz” szakasz végén és a láblécben marad meg.

**Képernyőváltás**
- Főoldal → Dosszié → Üzenetek → Fotózás → Határidők, 4000 ms-onként.
- Áttűnés 400 ms, opacity és translateX 16 px.
- 2 kör után megáll a Főoldalon.
- Megáll akkor is, ha:
  - egér van rajta, vagy fókuszba kerül (focus-within; a figure tabindex="0", aria-label felsorolja az 5 képernyőt);
  - a fül rejtett (document.hidden);
  - a hős kikerül a képből (IntersectionObserver).
- Csökkentett mozgásnál és JS nélkül álló Főoldal-kép.
- Minta: Attio, Mercury.

**Telefonon**
- Szöveg balra zárva.
- A gomb teljes szélességű, 52 px; alatta középre zárt szöveglink, 44 px magas.
- Utána az ár-sor 14 px-en, majd 40 px-re a telefon 248 px-es képernyővel, középen.
- Minta: Stripe, Kontist, Qonto.

### Bizalmi sor (a kék sáv helyett)
- Fehér háttér, fent és lent 1 px #E6E9F2 vonal.
- 4 oszlop 1 px függőleges elválasztóval, cellánként 28/24 px belső margó.
- Cím 15/600 #10152B, szöveg 14/1.5 #5F687D, csempe és emoji nélkül.
- A meglévő 4 tény marad: Valódi könyvelő, NAV-meghatalmazással, Európai szerveren, Magyar cég (Somosi Kft. · adószám · Cégadatok link).
- Tablet: 2×2. Telefon: egy oszlop, vonallal elválasztva.
- Minta: Qonto (Made in France / ügyfélszolgálat sor), Kontist (Solaris/BaFin sor), Stripe és Attio keretes sávja.

### Kinek szól
- Fehér háttér.
- Kétszínű H2: „Átalányadósoknak és katásoknak.” sötét, „Csak nekik.” szürke.
- Két oszlop, köztük 1 px függőleges vonal, színes kártyák nélkül:
  - „Neked szól, ha” lista #15803D színű 16 px-es SVG-pipával;
  - „Most nem neked szól, ha” lista szürke gondolatjellel;
  - tételek 16 px-en, 12 px-es közzel.
- Telefonon egymás alatt, köztük vonal.
- Minta: Stripe/Attio kétszínű cím, Kontist vonalas lista.

### Hogyan működik (4 lépés)
- #F6F7FA háttér.
- Közös keretes rács: 4 oszlop, fent 1 px vonal, oszlopok között 1 px #E6E9F2, cellánként 28/24 px.
- „01–04” 14 px tabular-nums #7A8295, cím 18/600, szöveg 15/1.6 #5F687D.
- Nincs fehér kártya, színes szám-kör és nyíl.
- Telefonon függőleges lista vonallal; a szám bal oldalt, 32 px széles oszlopban.
- Minta: Linear FIG-oszlopai, Attio rácsa.

### Mit kapsz (tulaj 4. pontja)
**Háttér és cím**
- #10152B, egyszínű; a ::before fényfoltok és a telefonok mögötti színes fény kimarad.
- Kétszínű H2 (fehér + #8C94AD), például „Mindig tudod, hol tartasz az adóval.” + a meglévő „Minden új számlával frissül” gondolat.

**Gépen (981 px fölött): bal 5/12 lista, jobb 7/12 ragadós telefon**
- A lista 7 lépés, mindegyik:
  - fölötte 1 px rgba(255,255,255,.12) vonal, 28 px-es függőleges belső margó;
  - „01” 14 px #8C94AD (aktív: #FFC93C);
  - cím 22/1.25/600 fehér;
  - 1–2 mondat 16/1.6 #B9C0D4;
  - a „Neked ebből” gondolat egy sima mondatként a szöveg végén, 16/500 fehér, doboz és csík nélkül.
- Inaktív lépés opacity .5 (csak html.mozog alatt).
- Kimarad: színes szám-körök, nagybetűs színes címkék (SZÁMLÁK…), a telefonok mögötti lekerekített panelek és a pöttyök.
- A ragadós telefon 300 px-es képernyővel; a képernyőváltás 300 ms-os áttűnés; a telefonon belüli réteganimációk maradnak.

**A szakasz vége**
- A 3 kártya helyett egy sor 3 hasábbal, felettük vékony vonal, ikon és doboz nélkül: „Telefonon és gépen”, „A pénzed nálad marad”, „A NAV-hoz a könyvelőd fordul”.
- Cím 16/600 fehér, szöveg 15 #B9C0D4.
- Alatta „Az app képei bemutató adatokkal készültek.” 13 px #8C94AD.

**Telefonon**
- Lépésenként: szám + cím + szöveg, majd 32 px-re a telefon 240 px-es képernyővel, középen.
- Lépések között 56 px és 1 px vonal, panel nélkül.

Minta: Mercury (vonalas lista bal oldalt + nagy UI), Kontist (képernyő + vonallal tagolt funkciólista), Qonto (sötét sáv), Attio (aktív fehér, inaktív szürke lépés).

### Könyvelő (tulaj 5. pontja)
- Fehér háttér a menta helyett.
- Fent kétszínű H2 („Valódi könyvelő dolgozik neked.”) és a bevezető, 6/12 szélességben.

**„Egy negyedév a könyvelőddel” táblázatként (dl), kártya, ikon és függőleges vonal nélkül**
- 5 sor, mindegyik fölött 1 px #E6E9F2 vonal, 20 px-es függőleges belső margó.
- Bal oszlop (3/12): 15/600 #10152B, kisbetűs („Minden hónapban”, „A negyedév végén”, „Amikor utaltál”, „Ha NAV-levél jön”, „Bármikor”).
- Jobb oszlop (9/12): cím 18/600 + szöveg 16 #5F687D.
- Alatta a katás mondat 14 px-en.

**Tény-blokkok**
- „Név szerint ismered” és „Egy szerződés, egy felelős” két hasábban.
- Fölöttük 2 px #10152B vonal (szerkesztőségi hatás), H3 18 + szöveg 16, keret és ikon nélkül.

**„Amit soha nem kérünk el”**
- Átkerül a Biztonság szakaszba, sima bekezdésként, félkövér bevezetővel.
- Nincs bal oldali színes csík.

**Opcionális**
- Valódi UI-kivágás az app_uzenetek_chat képből: egy válasz „a könyvelődtől”, 16 px-es sarkú, 1 px keretes csempében #F6F7FA alapon (Pennylane/Stripe-féle UI-darab).
- Név nincs rajta, csak „a könyvelőd”.

Minta: Mercury/Kontist vonalas listái, Stripe/Pennylane UI-darabjai.

### Biztonság
- Fehér háttér, fent 1 px vonal választja el.
- Két hasáb („A NAV-meghatalmazás, röviden” / „Az adataid”): H3 20 + vonallal tagolt tételek, 16 px.
- Kimarad: kártya, levendula háttér, színes pötty.
- Alatta „Amit soha nem kérünk el:” egy bekezdés, és az „Adatkezelési tájékoztató →” link.
- Minta: Kontist banki-biztonsági sora (három hasáb ikon-doboz nélkül).

### Árak (az árak változatlanok)
**Keret**
- #F6F7FA háttér.
- Egy fehér panel 16 px-es sarokkal és 1 px #DDE2EC kerettel; nincs 2 px kék keret és nincs színes árnyék.

**Bal oldal**
- „Havidíj” 15 px, halvány.
- **19 999 Ft** 56/600 tabular-nums, sárga kiemelő-csík nélkül; mellette „/ hó” 20 px, halvány.
- „bruttó, 27% ÁFA-val” és „Egy teljes év…: 254 987 Ft” 15 px.
- Benne-lista egyszínű pipával, 12 px-es közzel.
- Sárga gomb 52 px, teljes szélességű; alatta a kártyás mondat 14 px-en.

**Jobb oldal: „Külön díjak”**
- Vonallal tagolt sorok, az ár jobbra igazítva, tabular-nums.
- Az „Éves zárás” sorban nincs sárga doboz; helyette félkövér + „évente egyszer” szürke pill-címke (#F1F3F8).

**Alatta**
- A 3 ikonos tény helyett egy 15 px-es szürke sor „·” elválasztóval.

**Telefonon**
- Havidíj fölül, Külön díjak alul, panelen belüli 1 px vonallal.

Minta: Pennylane és Qonto árazási felépítése; az ár mint az egyetlen nagy szám.

### Összevetés
- Fehér háttér, árnyékos kártya nélkül.
- Fejléc: az „Adózz” oszlop kék szöveg, alatta 2 px #1428DB vonal, az oszlop háttere #F5F7FF.
- Sorok 1 px vonallal; első oszlop 15/600, cellák 15 px.
- Telefonon soronként egymás alatt: címke, majd „Adózz: …” és „Hagyományos iroda: …”, vízszintes görgetés nélkül.
- A lábjegyzet marad.
- Minta: Pennylane összehasonlítása, illetve az Evil Martians szerint zsúfolt piacon hasznos az összevetés.

### Vélemények-helyőrző
- Marad, ahogy van; élesítés előtt rejtendő.

### GYIK
- Fehér háttér.
- A cím bal oldalt ragadós.
- Harmonika vonallal: kérdés 18/500, válasz 16 #5F687D, max 68ch.
- Plusz-jel 20 px, kör nélkül; nyitáskor rotate(45deg).
- Minta: Linear, Stripe, Mercury.

### Záró
- Teljes szélességű #1428DB sáv (ez az egyetlen kék sáv), 96 / 64 px.
- H2 40/28 fehér.
- Szöveg #DCE2FF.
- Sárga gomb 52 px, mellette fehér szöveglink „Visszahívást kérek →”.
- Az egyetlen engedett mondat 15 px-en: „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.”
- Minta: Billingo kék árazási sávja, Evil Martians: kontrasztos záró blokk 1 céllal.

### Lábléc
- #10152B háttér.
- 4 hasáb + cégadatok, 14 px #A9B0C5; jogi sor 13 px.
- Itt is szerepel: „Az app képei bemutató adatokkal készültek.”

### Szakaszok háttérsora
Fehér (hős) → fehér + vonalak (bizalmi sor) → fehér (kinek) → #F6F7FA (hogyan) → #10152B (mit kapsz) → fehér (könyvelő) → fehér (biztonság) → #F6F7FA (árak) → fehér (összevetés, vélemények, GYIK) → #1428DB (záró) → #10152B (lábléc).

## 6. Telefon (390 px) – külön szabályok
- Oldalmargó 20 px; H1 36, H2 28, bevezető 17, szöveg 16; szakaszköz 72 px.
- Fő gomb teljes szélességű, 52 px; minden koppintható elem legalább 44 px.
- A telefon-mockup képernyője 240–260 px széles.
- Rácsok egy oszlopba vonallal; táblázatok soronként egymás alá.
- Nincs hover-hatás.
- 390/768/1280/1440 px-en nincs vízszintes kilógás. A kilógó UI-darabok szülője overflow: clip.
- Minta: Stripe, Kontist, Attio, Qonto.

## 7. Tiltólista (az építő ezzel ellenőrizze a kész oldalt)

**Nem lehet rajta:**
- színes, nagybetűs felcím;
- színes szám-kör;
- bal oldali színes csíkos kiemelő doboz;
- 3 egyforma ikonos kártya;
- emoji- vagy Fluent-ikon csempén az appképeken kívül;
- 6 féle pasztell;
- funkciónként saját szín;
- fényfolt vagy színátmenet a sötét sávon;
- 700-as vagy vastagabb cím, −0,03em-nél szűkebb betűköz;
- 2 egyforma súlyú hős-gomb;
- árnyék kártyán vagy gombon;
- 3-nál több sarokméret;
- beúszó vagy felemelkedő kártya;
- vezérlősor a hős-telefon alatt;
- böngészőkép és háttérdoboz a hősben.

**Kötelező marad:**
- CSP default-src 'self', csak a mozgas.js;
- JS nélkül és csökkentett mozgás mellett is minden látszik;
- csak transform/opacity animáció;
- a szövegek és árak a mostaniak;
- „Az app képei bemutató adatokkal készültek.” mondat.

**A tulaj döntése:** az erős „valódi cég” jel egy szerző lenne, például az alapító saját, valódi telefonos fotója vagy aláírt sora (21st.dev). Könyvelő-fotó és kitalált név továbbra sem lehet.

## 8. Képernyőképek

A gépi képek 1440×3600 (1x, 4 képernyő), a telefonos képek 780×5064 (390 px, 2x, 3 képernyő). Mindet megnéztem.

Mappa: `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/saas_kutatas/`

| Oldal | Gép | Telefon |
|---|---|---|
| Billingo | billingo_gep.png | billingo_telefon.png |
| Számlázz.hu | szamlazz_gep.png | szamlazz_telefon.png |
| Accountable | accountable_gep.png | accountable_telefon.png |
| Kontist | kontist_gep.png | kontist_telefon.png |
| Pennylane | pennylane_gep.png | pennylane_telefon.png |
| Qonto | qonto_gep.png | qonto_telefon.png |
| Finom | finom_gep.png | finom_telefon.png |
| Mercury | mercury_gep.png | mercury_telefon.png |
| Linear | linear_gep.png | linear_telefon.png |
| Stripe | stripe_gep.png | stripe_telefon.png |
| Attio | attio_gep.png | attio_telefon.png |
| Raycast | raycast_gep.png | raycast_telefon.png |

**Ugyanebben a mappában még:**
- `<oldal>_meres.json`: mért stílusadatok;
- `nezet/`: nézőképek (`_g1.jpg` = az első 1800 px eredeti méretben, `_g2.jpg` = 1800–3600 px 60%-on, `_t.jpg` = 3 telefon-képernyő egymás mellett);
- `futas.log`.

**Megjegyzések a képekhez:**
- Sütit sehol nem fogadtam el; a sávokat CSS-sel rejtettem el.
- **Mercury:** a hősben megmaradt a süti-szöveg egy keskeny csíkja (nem fogadtam el, és nem sikerült eltüntetni).
- **Finom:** az országválasztót elrejtettem, ezért a fejléc a kép aljára került. A /en-de/ címen Cloudflare-ellenőrzés jött, azt nem kerültem meg.
- **Pennylane:** a helyválasztó felugró ablak elrejtve.

**Szkriptek:**
- `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/saas_fotoz2.cjs`: fotózás és mérés;
- `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/saas_nezet.py`: nézőképek;
- `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/saas_osszeg.py`: összesítés.

## 9. Források (olvasott írások)
- [Evil Martians – We studied 100 dev tool landing pages (2025)](https://evilmartians.com/chronicles/we-studied-100-devtool-landing-pages-here-is-what-actually-works-in-2025)
- [21st.dev – Website not look AI generated](https://21st.dev/blog/website-not-look-ai-generated)
- [dev.to – How to fix the AI-generated look in your frontend](https://dev.to/alanwest/how-to-fix-the-ai-generated-look-in-your-frontend-1ahh)
- [Anti AI slop ban list (GitHub wiki)](https://github.com/Laith0003/ux-skill/wiki/Anti-AI-slop-ban-list.md)
- [LogRocket – Linear design](https://blog.logrocket.com/ux-design/linear-design/)

A Vercel Geist tipográfia-oldala csak osztályneveket ad, számértéket nem; a uxdesign.cc írás 403-mal nem nyílt meg.

=====

## Adózz.hu landing, 2. kör (11-20 este)

Az oldal átépült a SaaS-specifikáció és a tulaj 6 pontja szerint. Az AI-sablon jegyek kikerültek: a pasztell szakaszok, a kiemelőszínek, a felcímek, a dobozok, az ikoncsempék, a színes számkörök, a „Neked ebből” dobozok, a díszítő mozgás és a hős kollázsa. A Gemini külső értékelése szerint az AI-hatás tervezői szemmel **8/10-ről 4/10-re**, vállalkozói szemmel **6/10-ről 3/10-re** csökkent (0,0185 $).

**Ellenőrzések:**
- Az `epit.cjs` és a `kep.cjs` hiba nélkül fut: CSP OK; nincs kilógás 1440, 1280, 768 és 390 px-en; nincs JS-hiba és nincs idegen kérés.
- JS nélkül és csökkentett mozgásnál minden tartalom látszik. Kivétel a telefonos táblázat fejsora, ezt szándékosan rejtem el, mert a sorok elé „Adózz:” és „Hagyományos iroda:” címke kerül.
- A hős képváltását lemértem: egér vagy fókusz alatt megáll, utána a maradék idővel folytatódik.
- A ragadós telefon mind a 7 lépésnél jól vált.
- A gépes (2x) és telefonos éles képek minden szakaszát megnéztem.

### 0) Mentés
Munka előtt ide mentettem a sablont, a `stilus.css`-t, a `mozgas.js`-t, az `index.html`-t és a képeket: `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_regi/elotte_kor2_20261120_2050/`. Utólag a régi egyfájlos változat is odakerült. Nem töröltem semmit.

### Szakaszonként

**Egész oldal**
- **Színek:** 3 háttér maradt: fehér, `#F6F7FA` (Hogyan, Árak) és `#10152B` (Mit kapsz, lábléc). Tömör kék csak a záró sávban van. Törlődtek a menta, levendula, krém és halványkék hátterek, a `.szin-*` színek, a színátmenetek és a fényfoltok.
- **Betű:** a címek Geist 600 vastagok, −0,02…−0,025em betűközzel (eddig 700, −0,035em). H1 56/36, H2 40/28 px.
- **Sarkok és árnyék:** csak 3 sarokméret van (8, 16, 999). Árnyék csak a telefonokon van.
- **Felcímek:** nincs több nagybetűs, színes felcím, csak a hősben egy kisbetűs, szürke előcím.
- **Pipák:** vékonyak, egyszínűek, karika nélkül (`epit.cjs` PIPA).
- **Szöveg:** a pontot levettem a címekről. NAV-írásmódot használok (áfa, szja, tb-járulék), sehol nincs „átalányadós” vagy „valódi”. A szótikkeket (látod, ha kéred) megritkítottam.

**Fejléc:** 72 px magas (telefonon 60), 15 px-es menü. Jobbra „Belépés” link és sárga, 40 px-es gomb.

**Hős (tulaj 1. és 2. pont)**
- Eltűnt a gépes kép, a lila doboz, a radial fény, a gombsor, a fülek és a felirat. Egyetlen telefon maradt, kétrétegű árnyékkal és talpárnyékkal.
- A képernyők maguktól váltanak (Főoldal, Dosszié, Üzenetek, Fotózás, Határidők), 4 másodpercenként, 0,4 mp-es áttűnéssel. Két kör után a Főoldalon megállnak.
- Megállnak akkor is, ha egér van rajtuk, ha fókuszba kerülnek (a figure `tabindex="0"` és `aria-label`), ha a fül rejtett, vagy ha a hős kikerül a képből. JS nélkül és csökkentett mozgásnál a Főoldal áll.
- Egy domináns sárga gomb maradt, mellette a „Visszahívást kérek →” szöveglink, alatta egysoros ár és egy mikrosor. Kikerült a 3 pipa és a második gomb.

**Telefon (tulaj 3. pont)**
- Mind a 8 telefon ugyanazt a saját, valósághű SVG-keretet kapta (`kepek/telefon_keret.svg`, a licenc a `LICENC_telefon_keret.txt`-ben).
- A kijelzőt és a rétegeket egy közös változó (`--k`) méretezi, így a mozgó rétegek pontosan a kijelzőn belül maradnak. A képeken ellenőriztem.

**Bizalmi sor:** a kék ikonos sáv helyett fehér sor lett, 4 hasábbal és vonalakkal, ikon nélkül. Az elemek: Nyilvántartásba vett könyvelő, NAV-meghatalmazással, Európai szerveren, és a Somosi Kft. címmel, adószámmal, cégadat-linkkel. Így ellenőrizhető tények állnak a „Valódi könyvelő” és a „Magyar cég” címke helyett.

**Kiket könyvelünk:** kétszínű cím lett. A zöld és rózsaszín kártya helyett két hasáb van, köztük vonal. Az igen-lista vékony zöld pipát, a nem-lista gondolatjelet kapott.

**Hogyan működik:** keretes rács lett, 1 px-es elválasztókkal és „01–04” számozással. Kikerültek a fehér kártyák, a színes számkörök és a nyilak. A szövegek az új változatra cserélődtek.

**Mit kapsz (tulaj 4. pont)**
- A szerkezet maradt: lépésenként váltó telefon, mozgó rétegekkel.
- Kikerült a 7 „Neked ebből” doboz, a színes számkörök és nagybetűs címkék, a panelek, a ragyogás és a pöttyök.
- Minden lépés így néz ki: „01 Számlák” szürkével (az aktív szám sárga), H3, majd 1–2 bekezdés. A haszon a mondatba olvadt. Gépen a bal oldali lista vonallal tagolt, az inaktív lépés 50%-os, jobbra ragadós telefon áll.
- A 3 kis kártya helyett a valódi gépes app-kép áll „Gépen is ugyanaz az app” szöveggel. Telefonon ez a kép a jobb szélen kilóg.
- Rétegszövegek: „Új kiállított számla”, „áfa nélkül”. A kiemelő keret mindenhol sárga, a pop-animáció túllendülés nélküli.

**Könyvelő (tulaj 5. pont)**
- Menta helyett fehér háttér.
- Osztott fej: „Ki könyvel neked?” és két bekezdés (név és nyilvántartási szám a szerződésben; Somosi Kft. felelőssége).
- Az idővonal, az ikonok és a 3 doboz helyett vonalas definíciós lista áll „Ezt csinálja a könyvelőd egy negyedévben” címmel, 5 sorral.

**Biztonság**
- Levendula háttér és kártyák helyett két hasáb, vonalas tételekkel.
- Az „Amit soha nem kérünk el” ide került „Ha valaki a nevünkben keres” címmel. Doboz helyett 2 px-es sötét felső vonalat kapott, mert a Gemini a magányos keretet is sablonosnak látta.

**Árak**
- Egy fehér panel 1 px kerettel. Nincs kék keret, színes árnyék, sárga csík és sárga éves-zárás doboz. Az éves zárás mellett egy szürke „évente egyszer” címke áll.
- A lista sötét, vékony pipákat kapott. A 3 pipás tény helyett egy bekezdés van. Az árak változatlanok.

**Összevetés:** sima táblázat vonalakkal. Az Adózz-oszlop kék fejlécet és 2 px-es alsó vonalat kapott, mögötte nagyon halvány kék háttérrel. Telefonon soronként „Adózz: …” és „Hagyományos iroda: …” áll, nincs kártyafal. Új bevezető került fölé.

**GYIK:** fehér háttér, ragadós cím. Kör nélküli + jel, ami nyitáskor elfordul. A szövegek az új változatra cserélődtek, és kikerült a „Hűségidő nincs” ismétlés.

**Záró:** tömör kék, nincs színátmenet, fénykör és üvegdoboz. A visszahívás-blokkot csak egy vonal választja el. A 24–48 órás mondat egyetlen helye itt van.

**Lábléc:** `#10152B` háttér. Itt is szerepel az „Az app képei bemutató adatokkal készültek.” mondat, a Mit kapsz végén is.

**mozgas.js**
- Kikerült a beúszás, a hover-emelés, az idővonal-rajzolás, a hős vezérlője és a fényfoltok kezelése.
- Csökkentett mozgásnál vagy IntersectionObserver nélkül a fájl csak a `js` osztályt teszi ki.

Nyílt forrású elemet nem vettem át: a keret saját, a CSS kézzel írt. Ezért a `vendor/LICENCEK.md` nem készült el.

### Nyitva maradt (a tulaj döntése)
1. **Kitalált név az app-képeken:** szerepel a „Kovács Bence” név és avatar, a csetben „Szia Péter/Bence” és „Írj Bencének…”. Ez ütközik a „nincs kitalált könyvelőnév” szabállyal. A C5_v2 képeket újra kellene renderelni.
2. **Válaszidő-ígéret a képeken:** a „Kollégánk 24–48 órán belül visszahív…” szöveg rajta van az `app_asztali.webp`-n (ez most nagyban áll a Mit kapsz végén) és az `app_uzenetek.webp`-n (a hős váltakozó képei között).
3. **„ÁFA” az app-képeken:** a képek nagybetűs „ÁFA”-t használnak, az oldal szövege már „áfa”.
4. **A 7 lépés:** a Gemini és a művészeti vezető is a 4–6. lépés összevonását javasolja, telefonon pedig lapozást. A szerkezet a kérés szerint maradt. A telefonos oldal hossza 23 685 px-ről 20 202 px-re csökkent.
5. **„Mintha magunk dolgoznánk”:** a mondatot meghagytam (a Ptk. 6:129. szerinti felelősségi fordulat), a Gemini mesterkéltnek érezte.
6. **Eltérések a specifikációtól:**
   - A hős-telefon kijelzője 280 px a kért 288 helyett, hogy 1440×900-on a bizalmi sor eleje még látsszon.
   - A H1-en nincs sárga kiemelés, és az áron sincs (a specifikáció szerint).
   - A hős két kör után megáll; folyamatos váltáshoz a `KOROK` értéket kell átírni a `mozgas.js`-ben.
7. **Régi videók:** a `mozgas_asztali.mp4` és a `mozgas_mobil.mp4` még az 1. kört mutatja, nem készítettem újat.
8. **Vélemény-helyőrző:** élesítés előtt el kell rejteni.

### Fájlok
Mind a `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/` mappában:
- **Forrás:** `_eszkoz/index.sablon.html`, `stilus.css`, `mozgas.js`, `_eszkoz/epit.cjs` (új pipa)
- **Kimenet:** `index.html`, `adozz_weboldal_egyben.html` (2029 KB, a telefonra), `landing_asztali.png`, `landing_mobil.png`
- **Gemini:** `_eszkoz/gemini_ai_hatas_2.py`, `_eszkoz/gemini_ai_hatas_2.json`

Éles képek (2x) és próbaszkriptek:
- `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/hq_kor2/gep_01.png` … `gep_09.png` (gép)
- `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/hq_kor2/tel_01.png` … `tel_15.png` (telefon)
- `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/k2_mozgas_proba.cjs`
- `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/k2_hos_proba.cjs`
- `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/k2_nojs.cjs`

=====

## A Gemini 2. véleménye az Adózz.hu landingről (11-20, 21:47)

Az új oldalról 9 gépes, 2x-es képet készítettem (1440 px, 1800 px-es szeletek). Ugyanúgy kérdeztem meg a Geminit, mint az 1. körben: ugyanazzal a modellel (`google/gemini-3.8-flash`, low reasoning), ugyanazzal a két szereppel (magyar webdizájner és átlagos vállalkozó), és ugyanazzal a JSON-szerkezettel, csak gépes képekkel. Két mezőt tettem hozzá: egy bizalmi pontszámot, és azt, hogy a tulaj által kifogásolt részek új megoldásán maradt-e AI-hatás. A Gemini nem tudta, hogy ez javított változat; a tulaj kifogásait csak „az előző változatban” megjelöléssel kapta meg. **Költség: 0,0215 $** (12 207 bemenő és 3 299 kimenő token, egy hívás).

### Összkép
| | 1. kör | 2. kör (most) |
|---|---|---|
| AI-hatás tervezői szemmel | 8/10 | **4/10** |
| AI-hatás vállalkozói szemmel | 6/10 | **3/10** |
| Vállalkozói bizalom | – | **8/10** |

Az építő korábbi, saját kérdésre kapott 2. körös eredménye ugyanígy 4 és 3 volt, tehát a két mérés egyezik.

- **Tervező:** „tiszta, európai fin-tech irány”, de a kétszínű címek és a 01–07 számozás még modern UI-kit ritmusú.
- **Vállalkozó:** átlátható, a cégadatok és az árak kint vannak, de a sötétkék rész végtelennek tűnik.

### Mi javult (a tulaj kifogásai)
1. **A hős telefonja:** nem maradt AI-hatás. A Gemini szerint a valósághű keret és a valódi app-kép „teljesen hiteles”.
2. **A könyvelő-szakasz:** nem maradt AI-hatás. A vonalas lista „hivatali, komoly és banki hatású”.
3. **A Mit kapsz vége (a gépes app-kép a 3 kártya helyén):** kicsi a maradék hatás. Annyit javasol, hogy kapjon egy 1 px-es, áttetsző fehér (`#ffffff15`) keretet.
4. Már szóba sem került, ami az 1. körben a fő gond volt: a pasztell hátterek, a „Neked ebből” dobozok, az ikoncsempék, az üveghatás és a ragyogás.
5. **Ami bizalmat kelt:**
   - a bizalmi sor a Somosi Kft. adataival, adószámmal és címmel,
   - a NAV-meghatalmazás magyarázata (ONYA, visszavonható),
   - a tételes díjlista,
   - a teljes impresszum.
6. **Ezeket hagyjuk meg:** a hőst, a bizalmi sort, az árpanelt, az app-képeket és a „Ha valaki a nevünkben keres” részt.

### Mi maradt, súly szerint
1. **Mit kapsz, 7 lépés (közepes–nagy):** monoton és hosszú. A Gemini 4 blokkot javasol (Számlák; Adó és határidők; Fotózás; Kapcsolat a könyvelővel), és a 01–07 számok törlését. Ezt mindhárom értékelés jelezte, de a lépések összevonása a tulaj döntése.
2. **Kétszínű címek (közepes, most ez a legerősebb AI-jel):** a „Kiket könyvelünk? + szürke folytatás” és a „Mindig tudod… + szürke folytatás” Tailwind/Vercel-reflexnek hat. Javaslat: a cím egyszínű legyen, a második fele kerüljön 18–20 px-es alcímbe.
3. **„Így indul a könyvelésed”, 01–04 rács (közepes):** szerinte SaaS-klisé. Függőleges, számozott lépéssort javasol.
4. **Lebegő „most” értesítések a telefonokon (közepes):** szerinte Dribbble-sablon.
   - Saját megfigyelésem az állóképen (csökkentett mozgás vagy JS nélkül): a rétegek félig eltakarják az alattuk lévő app-szöveget, és ez hibának látszik. Példák:
     - a „Járulékok” cím a határidő-értesítés alatt (3. szelet),
     - „A félreteendőt akkor számoljuk…” a sárga buborék alatt (2. szelet),
     - a Dosszié fejszövege (4. szelet),
     - a „bevétel 1 690 000 Ft” sor (5. szelet).
   - A Fotózás lépésben a kék koppintás-karika rálóg a „Dosszié” feliratra.
5. **A sötét Mit kapsz sáv:** a Gemini szerint tech- vagy kriptó-hatású, és világos hátteret javasol. Ez ütközik az arculattal (`#10152B`), ezért a tulaj döntése.
6. **Az összevető táblázat (kicsi):** startup-séma. Táblázat helyett 3–4 életszerű helyzetet javasol.
7. **Szövegjavaslatok:**
   - „A számolást és a bevallást közben a könyvelőd végzi” → „…a könyvelőd csinálja helyetted”
   - „Mindig tudod, hol tartasz az adóval” → „Pontosan látod, mennyi adót kell félretenned”
   - „Ami papíron jön, azt lefotózod” → „Fotózd le a papíralapú számlákat”

### Ne vedd át, mert ütközik a szabályokkal vagy a tényekkel
- **„A könyvelőd visszahív telefonon”:** valójában a csapat hív vissza, ezért ez valótlan.
- **„Szerződés után közvetlen telefonos kapcsolat a könyvelőddel”:** nem igazolt funkció.
- **Telefonszám a fejlécben:** a Gemini szerint hiányzik, és csak „visszahívást kérni” gyanús. Ez a tulaj döntése; számot kitalálni nem szabad.

A telefonos nézetet ez a kör nem nézte, mert az 1. körhöz hasonlóan csak gépes képeket kapott. Az építő korábbi futása (a telefonos képekkel) három dolgot jelzett:
- telefonon a 4 hasábos bizalmi sor egymás alá kerül, és hosszú lesz,
- a Mit kapsz szakasz túl hosszú,
- az összevető táblázat telefonon szétesik.

### Fájlok
- `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_ai_hatas_2.json`: az új eredmény, a teljes kérdéssel és a költséggel.
- `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_ai_hatas_2_epito_2139.json`: az építő korábbi, 21:39-es eredménye. Felülírás előtt ide mentettem, semmi nem veszett el.
- `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_ai_hatas_2_ujra.py`: a kérdező szkript.
- A képek: `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/hq_gemini2/gep_01.png` … `gep_09.png`. Mindet megnéztem. Az oldal 14 614 px magas, és képkészítés közben nem volt JS-hiba.

=====

{"tetelek": [{"hol": "Mit kapsz, a telefonok mozgó rétegei (stilus.css: .ertesites 275. sor, .hivo-szamla 301, .tab-jel 329, .keret-kartya 347). Képek: scratchpad/mv_kor2/m/gep_lepes1_b.png, gep_lepes4_b.png, tel_lepes1_b.png, z_ert.png, z_hivo.png, z_lepesek_b.png", "mi_ai_hatasu": "A rétegek a képernyőn belül maradnak (mértem: 1440 és 390 px-en, mind a 7 lépésben 0 px kilógás), de rosszul takarnak. 1) Az értesítés háttere rgba(255,255,255,.97). Ezért átüt rajta a fehér „Adózz.hu” logó, a vissza-nyíl és a képernyőcím („Kiállított számlák”, „IV. negyedév: szja és járulékok”, „Novemberi dosszié”, „Mégse / Kovács Bence kapja meg”). Az értesítés alsó éle félbevágja a fejléc alcímét („2 számla, összesen 563 000 Ft…”), ez az 1., 3., 5. és 6. lépésben is így van. 2) Az 1. lépés buboréka eltakarja „A félreteendőt akkor számoljuk, amikor a pénz m…” sort: a bal szélen kilóg az „m”, a nyíl kettévágja a „számoljuk” szót. A buborék ráadásul szó szerint megismétli a fölötte álló sárga sávot („Ebből eddig kb. 29 000 Ft-ot tegyél félre.”). 3) A 7. lépésben a keret-kártya alól félig kilóg a havi lista egy sora („bevétel 1 690 000 Ft”). 4) A Fotózás végállapotában üres kereső látszik „Még nincs oldal” felirattal, közben az értesítés azt írja, hogy „Elküldve”. A kék gyűrű (.tab-jel) áthúzza a „Dosszié” fülfeliratot.", "miert": "Valódi app képernyőjén nincs félig takart sor és áttetsző szellemszöveg, így ez elcsúszásnak, hibának látszik. Ez az első, amit a tulaj a szakaszban lát a telefonján, rögtön az 1. lépésnél. A sok lebegő kártya, gyűrű és buborék egy képernyőn a Framer-féle „annotált demó” sablonhatását is erősíti.", "javitas": "Közös szabály: képernyőnként legfeljebb 2 réteg legyen. Minden réteg alá kerüljön a képernyő színével egyező .maszk, hogy a képernyőképből semmi ne lógjon ki alóla. Az .ertesites háttere legyen tömör #fff. Vagy kerüljön a státuszsor alá (top kb. 2,6%) egysoros szöveggel, a fejléc fölé, és alá egy kék (#1A2FE0-szerű, a fejléc színével egyező) maszk takarja a teljes címet és alcímet. Vagy legyen egy fejléc-magas maszk, amely az értesítéssel együtt jelenik meg. Az 1. lépésből a .hivo buborék kerüljön ki (a sárga sáv már elmondja), vagy kerüljön az üres alsó sávba (top kb. 72%), ahol semmi nincs alatta. A 7. lépésben a .keret-kartya alá #F6F7FB maszk kerüljön a lista soraira. A Fotózás végállapotában maradjon látható a lefotózott papír kis bélyegképként, a „Még nincs oldal” sort fedje le maszk, a .tab-jel csak az ikont keretezze (kisebb, feljebb), vagy maradjon el. Ellenőrzés: minden lépés „a” (450 ms) és „b” (4 s) kockája 2x nagyításban (scratchpad/mv_mozgas.cjs).", "sulyossag": "nagy"}, {"hol": "App-képek tartalma (C5_v2/v2.js → kepek/app_*.webp): hős első képe, a 2., 5. és 6. lépés, a Fotózás „a” kockája, app_asztali.webp (Mit kapsz vége), app_uzenetek.webp (a hős váltakozó képei között)", "mi_ai_hatasu": "„Kovács Bence, a könyvelőd” név és rajzolt avatar áll az oldal legelső képén és még négy helyen. A csetben „Szia Péter!”, „Szia Bence!”, „Írj Bencének…”, a Fotózásban „Kovács Bence kapja meg” szerepel. A gépes képen, amely most nagyban áll a Mit kapsz végén, és a hős Üzenetek-képén ez áll: „Kollégánk 24–48 órán belül visszahív…”. A képeken „ÁFA”, az oldalon „áfa” szerepel.", "miert": "A tulaj szabálya szerint nem lehet kitalált könyvelőnév, és válaszidő-ígéret is csak egyszer, a záróban állhat. A kitalált, rajzolt avatarú „könyvelő-persona” tipikus demó- és AI-sablonelem. Egy valódi cégnél ráadásul hitelességi kockázat: az olvasó megkérdezheti, ki az a Kovács Bence, és hol van a nyilvántartási száma.", "javitas": "A C5_v2 képeket újra kell renderelni. A név helyére „A könyvelőd” kerüljön, az avatar helyére a Fiók fülön már használt semleges sziluett-ikon vagy semmi. Csetben: „Szia!”, a beviteli mezőben „Írj a könyvelődnek…”. Fotózás: „A könyvelőd kapja meg”. Dosszié: „A könyvelőd átnézte az iratokat”, „A könyvelőd látta · ma 9:12”. A „Kollégánk 24–48 órán belül…” helyett „Visszahívást kérhetsz munkanapokon 9 és 17 óra között.” álljon. „ÁFA” helyett „áfa”. Utána következik a kepek_vag.py, majd a .kv-* háttérpozíciók és a maszkok ellenőrzése, mert a szövegek hossza változik.", "sulyossag": "nagy"}, {"hol": "Mit kapsz, telefonon (390 px) és az oldal teljes hossza; scratchpad/mv_kor2/tel_03–tel_08.png", "mi_ai_hatasu": "Gépen a ragadós telefon jól működik. Telefonon viszont 7 teljesen egyforma modul jön egymás után: címke, H3, bekezdés, majd egy 546 px magas telefon. A szakasz 390 px-en 7274 px magas, ez az oldal 36%-a (20 202 px, kb. 24 képernyő 844 px-es kijelzőn; a régi oldal 23 685 px volt).", "miert": "A hétszer ismétlődő, egyforma blokk gépi ritmus, és a tulaj éppen telefonon nézi az oldalt. A 4–7. lépésnél már csak görget, közben az ár és a könyvelő-rész messzire kerül. A szerkezet maradhat (a tulaj szerint „egész jó”), csak a telefonos ritmusa nem.", "javitas": "A 981 px alatti nézetre vonatkozik. Az 1–3. lépés (számla, félretenni, határidő) maradjon saját telefonnal. A 4–6. lépés (Fotózás, Dosszié, Üzenetek) egy saját overflow-x: auto, scroll-snap sorba kerüljön: telefononként 200 px-es kijelző, alatta rövid cím és egy mondat (az oldal nem lóghat ki, a sor szülője overflow: clip). A 7. lépés maradhat. Cél: a Mit kapsz szakasz 390 px-en legfeljebb kb. 4500 px. A gépes nézet és a ragadós telefon maradjon változatlan.", "sulyossag": "kozepes"}, {"hol": "Kétszínű H2-k: #kinek „Kiket könyvelünk? Alanyi áfamentes egyéni vállalkozókat, akik átalányadóval vagy katával adóznak.” és #mit-kapsz „Mindig tudod, hol tartasz az adóval. A számolást és a bevallást közben a könyvelőd végzi.”; gep_01, tel_02, tel_03", "mi_ai_hatasu": "A „sötét állítás, utána szürke folytatás ugyanabban a címben” képlet kétszer szerepel az első öt szakaszban. A Kinek-cím telefonon 5 sor, ebből 4 szürke, 600-as vastagságú. Alatta még egy szürke bevezető is áll.", "miert": "A szürke folytatású cím (text-muted span) 2025–26-ban a v0- és Lovable-landingok alapbeállítása, kétszer már képletnek hat. A nagy, kövér, szürke szövegtömb gyengíti a hierarchiát: nem derül ki, mi a cím és mi a magyarázat.", "javitas": "A Kinek H2 egyszínű és rövid legyen: „Átalányadózó és katás egyéni vállalkozókat könyvelünk.” A feltétel a bevezetőbe kerüljön: „Csak alanyi áfamentes vállalkozókkal dolgozunk, ezért tudunk mindenkinek ugyanazon, előre kiírt áron dolgozni.” Kétszínű cím legfeljebb egy maradjon, a sötét Mit kapsz szakaszban, vagy ott is egymondatos cím álljon. A .cim-folyt csak ott maradjon.", "sulyossag": "kozepes"}, {"hol": "Hős: „Visszahívást kérek →” szöveglink (href=#visszahivas), és a záró „Előbb beszélnél velünk?” blokkja", "mi_ai_hatasu": "A hős linkje visszahívást ígér, de a záró sávra visz, ahol ez áll: „Regisztráció után az appban kérhetsz visszahívást.”", "miert": "Ha a gomb mást ígér, mint amit a cél ad, az csalinak hat, és egy könyvelő-szolgáltatónál pont a bizalom sérül. A valódi cégoldalak (Billingo, Számlázz.hu) linkszövege azt mondja, ami történni fog.", "javitas": "Legyen a link „Kérdésed van? Írj nekünk →”, és mutasson a #visszahivas blokkra. Vagy legyen „Így indul a könyvelésed →”, és mutasson a #hogyan szakaszra. A záró blokk szövege maradhat.", "sulyossag": "kozepes"}, {"hol": "Telefonkeret (kepek/telefon_keret.svg, mind a 8 telefon); z_hos_tel.png", "mi_ai_hatasu": "Saját rajzolású, valósághű keret. Van fémperem, fekete kijelzőperem, jobb oldali gombok, antennacsíkok, kör alakú előlapi kamera és semleges, kétrétegű árnyék, és minden telefon ugyanezt kapta. A tulaj 3. pontja így lényegében teljesül. Apró ellentmondás: a keret Android-jellegű (lyukkamera), a képernyőképek viszont iOS-állapotsort mutatnak (9:41, iOS-ikonok), a kamera az állapotsor közepén ül. Sötét alapon a fekete perem csak a vékony fémélen látszik.", "miert": "Hős-méretben hitelesnek látszik, 240 px-en a különbséget senki nem veszi észre. A tulaj azonban „igazi, letöltött mockupot” kért, ezért tudnia kell, hogy ez saját rajz. A letöltés elmaradásának oka dokumentált: az Apple és a Meta licence nem engedi, a devices.css pedig túl lapos.", "javitas": "A keret maradhat. A tulajnak egy mondatban meg kell írni, hogy saját rajzolású, jogtiszta keret, és miért nem letöltött (LICENC_telefon_keret.txt). Opcionálisan: a sötét szakaszban (.szakasz-sotet .telefon) a fémperem fénye legyen 10–15%-kal erősebb, hogy a test jobban elváljon a #10152B háttértől.", "sulyossag": "kicsi"}, {"hol": "Hős képváltás (mozgas.js, KOROK = 2)", "mi_ai_hatasu": "A képek két kör (kb. 40 s) után a Főoldalon megállnak. Aki később görget vissza a hősre, álló képet lát.", "miert": "A tulaj azt kérte, hogy a képek „csak maguktól cserélődjenek”. Ha visszatérve áll a kép, elromlottnak gondolhatja. A megállás akadálymentességi szempontból védhető, de ez a tulaj döntése.", "javitas": "Két lehetőség van, ezt a tulajnak kell megkérdezni. Az egyik a folyamatos váltás (KOROK = Infinity), a meglévő megállásokkal együtt: egér alatt, fókuszban, rejtett fülön és amikor a hős nem látszik. A másik, hogy a mostani kétkörös megállás marad. Bármelyik legyen, a jelentésben egy mondatban jelezni kell.", "sulyossag": "kicsi"}, {"hol": "Hogyan működik (01–04) és rögtön utána a Mit kapsz (01–07); gep_02, tel_03", "mi_ai_hatasu": "Két egymást követő szakaszban két, azonos stílusú „01, 02…” számsor fut, ugyanazzal a szürke tabular számmal.", "miert": "Két párhuzamos lépésszámozás összezavarja az olvasót („most hányadik lépésnél tartok?”), és megint egyforma szakaszszerkezet lesz belőle.", "javitas": "A Hogyan működik tartsa meg a 01–04 számozást. A Mit kapsz-ból a szám kerüljön ki, csak a szürke címke maradjon („Számlák”). Gépen az aktív lépést az elég jelzi, hogy fehér, a többi pedig 50%-os.", "sulyossag": "kicsi"}, {"hol": "Vélemény-helyőrző (#velemenyek), gep_07, tel_13", "mi_ai_hatasu": "Sárga, ferdén csíkos, szaggatott keretes doboz a GYIK előtt, „[Itt lesznek valódi ügyfélvélemények]” felirattal.", "miert": "Ez most az oldal leghangosabb eleme, és a tulaj szemében félkész oldalt jelez. Az oldal minden más részén nincs doboz és csík.", "javitas": "A tulajnak küldött mintában legyen rejtve (display:none, a helyén HTML-megjegyzés), és a jelentés írja le, hová kerülnek majd a vélemények. Ha látszania kell, legyen semleges: 1 px-es szürke szaggatott vonal, csík és sárga nélkül, 14 px-es szöveggel.", "sulyossag": "kicsi"}, {"hol": "Fejléc menü (index.sablon.html 25–29. és 37–41. sor)", "mi_ai_hatasu": "A menü sorrendje: Mit kapsz, Hogyan működik, Könyvelő, Árak, GYIK. Az oldalon a Hogyan működik a Mit kapsz előtt áll.", "miert": "Ha a menü sorrendje eltér az oldalétól, az a rendezetlenség apró jele. Egy gondos cégoldalon a kettő egyezik.", "javitas": "A sorrend legyen: Hogyan működik, Mit kapsz, Könyvelő, Árak, GYIK, a mobilmenüben és a láblécben is.", "sulyossag": "kicsi"}, {"hol": "Mit kapsz csökkentett mozgásnál / JS nélkül, gépen; scratchpad/mv_kor2/gep_02–05.png", "mi_ai_hatasu": "Gépen 7 telefon áll egymás alatt. A szöveg függőlegesen középen van, fölötte és alatta kb. 250 px-es üres sötét folt marad. Minden réteg végállapota egyszerre látszik. A Fotózásban egyszerre van ott a papír, a „Még nincs oldal” felirat, az „Elküldve” értesítés és a feliratot áthúzó gyűrű.", "miert": "A tulaj valószínűleg nem így látja, de ez az oldal állóképes változata, és a képernyőképek is ebben az állapotban készülnek. Most félkésznek és zsúfoltnak hat.", "javitas": "html:not(.mozog) alatt a .blepes align-items legyen start, a .blepes-szoveg pedig sticky (top: 120px). Mozgás nélkül csak az egy, értelmes végállapot-réteg látsszon, az átmeneti rétegek (.koppintas, .tab-jel, .villanas, .hivo) legyenek rejtve.", "sulyossag": "kicsi"}, {"hol": "Szöveg és tördelés: #konyvelo bevezető; H1 768 px-en (sz_768_elso.png)", "mi_ai_hatasu": "„A könyvelőd munkájáért mi felelünk, úgy, mintha magunk dolgoznánk.” – ez mesterkélt jogi fordulat. 768 px-en a H1 így törik: „átalány- / adózóknak”.", "miert": "A tankönyvszerű felelősségi mondat nem hétköznapi magyar. Egy elválasztott szó a főcímben gondatlan hatású.", "javitas": "A mondat legyen: „A könyvelőd munkájáért a Somosi Kft. felel.” A h1 és a h2 kapjon hyphens: manual és text-wrap: balance beállítást.", "sulyossag": "kicsi"}], "iranyelvek": "ÖSSZKÉP: nagy előrelépés. A régi képekhez (hq_2040) képest a fehér alap, a vonalas hasábok, a 600-as Geist címek, a sima hős egyetlen telefonnal, a cégadatos bizalmi sor és a vonalas táblázatok már valódi, gondos cég hatását keltik (Qonto, Pennylane, Billingo vonal). A pasztellek, a színes felcímek, az ikoncsempék, a „Neked ebből” dobozok és a 3 kártya eltűnt. Saját becslésem: AI-hatás tervezői szemmel kb. 3/10 (régi 8/10). Ami még sablonos vagy hibás: a telefonok mozgó rétegei, a kitalált persona az app-képeken, a kétszínű cím képlete, és a telefonos Mit kapsz 7 egyforma blokkja.\n\nA TULAJ 6 PONTJA:\n1) Hős gombsor és felirat: teljesült. Megáll egér, fókusz, rejtett fül és kigörgetés esetén; csökkentett mozgásnál állókép van. Eltérés: két kör után megáll, erről a tulajt meg kell kérdezni.\n2) Gépes kép és lila doboz: teljesült, csak semleges árnyék maradt.\n3) Valósághű telefon: teljesült, mind a 8 telefonon egységes, de a keret saját rajzolású, nem letöltött. A tulajnak ezt egy mondatban meg kell mondani.\n4) Mit kapsz dobozai és a 3 kártya: a marketingdobozok tekintetében teljesült. Új hiba a telefonokon belül: áttetsző értesítések, félbevágott sorok, eltakart szöveg. Ezt a tulaj elcsúszásnak fogja látni.\n5) Könyvelő-szakasz: teljesült, az oldal legjobb része (osztott fej, dl-lista vonalakkal).\n6) Az egész oldal AI-mentesítése: nagyrészt teljesült.\n\n3. KÖR SORRENDJE:\n(1) A rétegek takarásának javítása tömör értesítéssel és maszkokkal, képernyőnként legfeljebb 2 réteggel.\n(2) Az app-képek újrarenderelése név és válaszidő-ígéret nélkül, „áfa” írásmóddal.\n(3) Telefonon a Mit kapsz 4–6. lépése egy vízszintes, lapozós sorba kerüljön, cél: 4500 px alatt.\n(4) A Kinek-cím egyszínű legyen, a hős linkszövege igazodjon a céljához.\n(5) A kis tételek.\n\nNE NYÚLJ HOZZÁ: hős-elrendezés, bizalmi sor cégadatokkal, Hogyan működik vonalas rács, Könyvelő dl-lista, Biztonság két hasábja és „Ha valaki a nevünkben keres” blokkja, árpanel és Külön díjak, összevetés-táblázat, GYIK, tömör kék záró, lábléc impresszummal, gépen a ragadós telefon.\n\nELLENŐRIZVE: nincs vízszintes kilógás 1440, 1280, 768, 390 és 360 px-en; nincs JS-hiba; a mozgó rétegek sehol nem lógnak ki a kijelzőről (1440 és 390 px, mind a 7 lépés); a hős váltása működik.\n\nKÉPEIM: D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/mv_kor2/ (gep_01–09, tel_01–15 = csökkentett mozgás, 2x; m/gep_*, m/tel_* = mozgó állapot lépésenként „a” 450 ms és „b” 4 s kockával; z_*.png = kinagyított részletek).\nSzkriptek: D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/mv_mozgas.cjs, D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/mv_szelesseg.cjs, D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/mv_szakaszok.cjs.\n\nOpcionális, a tulaj döntése: a legerősebb „valódi cég” jel egy valódi szerző lenne, például az alapító saját fotója és aláírt mondata a Könyvelő-szakasz mellett. Kitalált név vagy könyvelő-fotó továbbra sem kerülhet az oldalra."}

=====

## Adózz.hu landing, 2. kör: technikai és szabályellenőrzés (11-20)

Semmit nem javítottam. A próbákat egy helyi szerveren futtattam (127.0.0.1), amely valódi `Content-Security-Policy: default-src 'self'` fejlécet küld. A próbaszkriptek és a kimeneteik itt vannak: `D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/k2_ell/` (`proba1.cjs`–`proba6.cjs`, `p2_*.json`, `p3.json`).

### BLOKKOLÓ (szabályt sért, a tulajhoz utalt nyitott pont)

**1. Kitalált könyvelőnév az app-képeken**
- **Hol:** a „Kovács Bence” név és egy rajzolt arc ezeken látszik:
  - `kepek/app_fooldal.webp`: ez a hős első képe, JS nélkül és csökkentett mozgásnál is ez áll. Gépen a hajtás fölött van, telefonon 626 px-től.
  - `app_dosszie.webp`
  - `app_fotozas.webp` („Kovács Bence kapja meg”)
  - `app_uzenetek.webp` („Írj Bencének…”)
  - `app_uzenetek_chat.webp` („Szia Péter!”, „Szia Bence!”)
  - `app_asztali.webp` (kétszer)
- **Javítás:** a C5_v2 képeket újra kell renderelni „a könyvelőd” felirattal, név és arc nélkül.

**2. Időígéret a képeken, az engedett mondaton kívül**
- **Hol:**
  - `app_uzenetek.webp` (a hős 3. képe): „Kollégánk 24–48 órán belül visszahív.”
  - `app_asztali.webp` (nagyban, a Mit kapsz végén): „Kollégánk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.”
- **Javítás:** a képekről ezt a sort ki kell venni, vagy erre cserélni: „Munkanapokon 9 és 17 óra között.” Átmeneti megoldás: az `app_uzenetek.webp` kikerül a hős váltójából (sablon 74. sor), és a gépes kép lecserélődik.

### FONTOS

**3. Nem létező funkció**
- **Hol:** sablon 344. sor: „Gépen a papírokat egyszerűen ráhúzod a Dossziéra.”
  - Az ügyfél-appban nincs fogd és vidd feltöltés. A `kod/app/src`-ben nincs drop/dragover kezelő, a `kod/SPEC.md` 18. pontja szerint ez csak a könyvelői Panel Dossziéjában van meg.
  - A webes ügyfél-app gépen is a telefonos elrendezést mutatja, középre igazítva (`kod/app/src/app/_layout.tsx` 2. sor: „max. 480 pt széles, asztali gépen is”). Az `app_asztali.webp` széles, oldalsávos gépes felülete tehát ma nem létezik.
- **Javítás:** a mondat törlése. A gépes kép helyére a valódi webes nézet kerüljön, vagy maradjon el. Ha a C5_v2 gépes nézet élesítés előtt elkészül, a kép maradhat; ez a tulaj döntése.

**4. Félrevezető árállítás**
- **Hol:**
  - sablon 414. sor: „Minden más díj itt van lent, forintra pontosan.”
  - Ezzel szemben a bérszámfejtés „egyedi ajánlat” (464. sor), és az áfabevallás, a NAV-ellenőrzés és a korábbi évek is „egyedi ajánlattal” mennek (467. sor).
  - Hasonló a hősben a „minden díj kiírva” (62. sor) és a táblázatban a „minden díj kiírva ezen az oldalon” (486. sor).
- **Javítás:** „A többi díj is itt van lent. Ami egyedi, arra előre, írásban adunk ajánlatot.” A hősben és a táblázatban a „minden” szót érdemes kivenni.

**5. A mobilmenü nyitva marad**
- **Hol:** 390 px-en a menüben az „Árak”-ra koppintva a lap legörget, de a `details.open` értéke `true` marad. A 220×316 px-es menülap a tartalmon ragad. A tulaj telefonon nézi, ezt látni fogja. A régi `mozgas.js` sem kezelte.
- **Javítás:** a `mozgas.js` `indul()` függvényének elején, még a `csendes`/`!vanIO` kilépés előtt: a `.mobilmenu-lap a` kattintására `details.open = false`, és ugyanez Escape-re és kívül koppintásra. JS nélkül a natív működés marad.

**6. Hiányzó licencek**
- **Hol:**
  - `vendor/LICENCEK.md` nincs, pedig két nyílt forrású elem van az oldalon: a Geist betű (OFL-1.1) és a Fluent Emoji Flat ikonok (MIT, az `epit.cjs` égeti be a rétegekbe).
  - A `fontok/Geist_OFL.txt` csak 3 soros hivatkozás, nem a teljes OFL-szöveg.
  - A kiszolgált, szűkített `Geist_wght.woff`-ból kimaradt a licenc-metaadat (nameID 13 és 14). A TTF-ben megvan.
- **Javítás:** `vendor/LICENCEK.md` forrás URL-lel, licenccel és verzióval (Geist, Fluent Emoji). A teljes `OFL.txt` kerüljön a `fontok/` mappába, és a woff-ot újra kell szűkíteni `--name-IDs='*'` kapcsolóval.

**7. Gyenge kontraszt a gépes Mit kapsz szakaszban**
- **Hol:** 981 px fölött, mozgással a `.szinpad-mod .blepes-szoveg { opacity: .5 }` miatt az inaktív lépések gyengék:
  - törzsszöveg: 3,38:1
  - „01 Számlák” címke: 2,43:1
  - Az AA szint 4,5:1-et kér.
- **Javítás:** opacity helyett szín. Inaktív bekezdés `#8C94AD` (5,97:1), H3 `#B9C0D4`, a címkét ne halványítsd. Ha marad az opacity, akkor legalább 0,7, de a címke így sem éri el a 4,5:1-et.

### APRÓ

8. **`.lepes-szam`** (Hogyan működik, „01–04”): `#7A8295` a `#F6F7FA` háttéren 3,59:1, 14 px-en. Javítás: `var(--halvany)` (5,21:1).
9. **Nem transform/opacity átmenet:** `.gomb { transition: background-color }` (`stilus.css` 87. sor) és `.blepes-szam { transition: color }` (234. sor). Javítás: az átmenet törlése.
10. **Elvesző alt-szövegek:** gépen, mozgással a `.blepes-kep` rejtett (`display:none`), a ragadós telefon klónjai pedig `aria-hidden` és `alt=""` beállítást kapnak. Így a 7 leíró alt-szöveg elvész a képernyőolvasó elől. Javítás: a klónban maradjon meg az alt, és a színpadról kerüljön le az `aria-hidden`.
11. **WCAG 2.2.2 (szüneteltetés):** a hős kb. 36 másodpercig vált magától, és csak egér vagy fókusz alatt áll meg, utána folytatja. Telefonon egy koppintás is megállítja, amíg máshova nem koppintasz. Ha kell, az első egér-, fókusz- vagy koppintásjel után végleg megállhat (`ok.vege = true`). Ez a tulaj döntése.
12. **Belső jegyzetek a nyilvános forrásban:**
    - `stilus.css` 2. sor: „„AI-landing” jegyek nélkül”, és versenytárs-nevek (Qonto, Kontist, Attio, Stripe, Billingo).
    - Belső jegyzetek a sablon HTML-kommentjeiben (10–12., 66–68., 158–162., 500. sor).
    - Javítás: élesítéskor kivenni őket, például egy lépéssel az `epit.cjs`-ben.
13. **Ismert, a tulajhoz utalt pontok:**
    - A vélemény-helyőrző („[Itt lesznek valódi ügyfélvélemények]”) élesítés előtt elrejtendő.
    - Az app-képek nagybetűs „ÁFA”-t használnak, az oldal szövege „áfa”-t.
14. **Az egyfájlos változatban** (`adozz_weboldal_egyben.html`) inline `<script>` van. Ez csak telefonos előnézetre jó, ne ezt telepítsd.
15. **Régi iOS:** az `overflow-x: clip` iOS Safari 16 előtt nem működik. Ott a 620 px-es gépes kép csak a `body { overflow-x: hidden }` miatt nem lóg ki.

### RENDBEN
- **Vízszintes kilógás:** 390@2 (mobil, érintés), 768, 1280 és 1440 px-en sincs.
  - A `scrollWidth` mindenhol a szélességgel egyezik, és fél képernyőnként végiggörgetve a programozott vízszintes görgetés mindenhol 0.
  - Levágatlanul kilógó elem nincs. 390 px-en a `.gepen-kep` szándékosan lóg ki, és a sötét sáv levágja.
- **CSP és hálózat:** 0 CSP-sértés, 0 konzolhiba vagy figyelmeztetés, 0 JS-hiba, 0 sikertelen és 0 idegen kérés.
  - Nincs süti, és egyetlen script van (`/mozgas.js`).
  - Nincs inline script, `on*` vagy `style=` attribútum, és nincs `data:` URI.
  - Az `index.html` bájtra egyezik a sablonból épített változattal.
- **Hős:**
  - Vezérlő nincs (0 elem).
  - Váltás körülbelül 4 másodpercenként.
  - Egér alatt 6 másodpercig áll, utána a maradék idővel folytatja.
  - Fókusz alatt, rejtett fülnél és kigörgetve is áll.
  - 10 váltás után, a 36. másodpercnél a Főoldalon megáll, és a 47. másodpercig sem mozdul.
  - 390 px-en ugyanígy működik.
- **Csökkentett mozgás** (1440 és 390 px): `js` van, `mozog` nincs. 9 másodperc alatt nincs váltás, 0 futó animáció, minden réteg látszik, és nincs ragadós telefon.
- **JS nélkül:**
  - 1440 px-en 304 szöveges elemből 0 rejtett.
  - 390 px-en csak az asztali menü duplikátuma és a táblázat fejléce rejtett, a fejlécet a `data-cim` címkék pótolják.
  - Rejtett képből csak a hős 2–5. díszítőképe (`alt=""`) van.
- **Telefonkeret:**
  - A `kepek/telefon_keret.svg` 200-as válasszal betölt, mind a 8 telefon háttere.
  - Az SVG-ben nincs kép, script vagy külső hivatkozás.
  - A `LICENC_telefon_keret.txt` szerint a keret saját rajz, így harmadik fél licence nem vonatkozik rá, használható.
- **Kontraszt (AA) a fő párokra:**
  - törzsszöveg a fehéren: 12,76
  - `#5F687D`: 5,58 / 5,21 / 5,03
  - sárga gomb: 11,74
  - kék link: 8,91
  - záró sáv: 6,95 / 5,96
  - sötét sáv: 9,92 / 5,97
  - lábléc: 7,06–13,79
  - a világos második félmondat (40 és 28 px): 3,85, nagy szövegnek megfelel
- **Szöveg:**
  - AI-említés 0 a sablonban és a `mozgas.js`-ben.
  - Az engedett 24–48 órás mondat pontosan egyszer szerepel. A lábléc „munkanapokon 9 és 17 óra között” mondata csak időablak, nem ígéret.
  - „a(z)” 0, kitalált név a sablonban 0.
  - Az árak változatlanok: 254 987 = 12 × 19 999 + 14 999, és a régi sablonhoz képest nem tűnt el és nem jött új szám.
  - „Az app képei bemutató adatokkal készültek.” kétszer szerepel, és a hős `aria-label`-jében is.

=====

## A tulajnak

**1) A 6 pontod (+ a görgetéses kérésed)**
1. **Hős-telefon:** nincs alatta gombsor és felirat. A képek folyamatosan, maguktól cserélődnek, és csak akkor állnak meg, ha rájuk mutatsz vagy rájuk koppintasz.
2. **Mögötte:** nincs gépes kép és nincs lila doboz, csak árnyék.
3. **Telefonkeret:** mind a 8 telefon ugyanazt a valósághű keretet kapta (perem, gombok, kamera). Saját rajz, mert a letölthető keretek (Apple, Meta) licence nem engedi a kereskedelmi weboldalt.
4. **„Mit kapsz”:** eltűntek a „Neked ebből” dobozok és a 3 kis kártya.
   - A görgetéses kérésed szerint most **egyetlen telefon áll** (telefonon fent, gépen jobbra).
   - Görgetéskor benne vált a képernyő, és mellette vagy alatta átíródik a szöveg. Egy vékony sárga csík mutatja, melyik lépésnél tartasz a 7-ből.
   - Nincs több egymás alatti telefon.
5. **Könyvelő-rész:** idővonal és dobozok helyett egy egyszerű, vonalas lista mutatja, mit csinál a könyvelőd egy negyedévben.
6. **Egész oldal:** kevesebb szín, doboz és ikon lett. A címek egyszínűek, a menü sorrendje megegyezik az oldaléval, és a telefonos menü bezárul, ha egy pontjára koppintasz.

**2) Mitől tűnt AI-nak, és mit csináltunk helyette**
- **Sok színes doboz, ikoncsempe és pasztell háttér:** helyettük vonalakkal tagolt, sima szöveg áll, mint egy rendes cégoldalon.
- **Ráragasztott „demó-elemek” a telefonokon (félig átlátszó buborékok, félbevágott sorok):**
  - Az értesítés most úgy néz ki, mint egy igazi telefonértesítés, az app saját ikonjával, és nem takar ki félig semmit.
  - A kártyák az app saját kártyáira hasonlítanak.
  - Képernyőnként legfeljebb két ilyen elem jelenik meg.
- **Kitalált könyvelőnév az app képein:** sehol nincs név, csak „a könyvelőd”, és válaszidő-ígéret sincs a képeken.
- **Kétszínű, szürke folytatású címek:** egyszínűek lettek.
- **7 egyforma blokk egymás alatt telefonon:** ehelyett a görgetésre váltó, egyetlen telefonos bemutató van, így a rész rövidebb is lett.

**3) Mit mondott a végén a Gemini**
- **Pontszámok:** az AI-hatás tervezői szemmel 4/10, vállalkozói szemmel 3/10 (az 1. körben 8/10 és 6/10 volt). Vállalkozói bizalom: 8/10.
- **Ami bizalmat kelt:** a cégadatok, a kiírt árak és a külön díjak listája.
- **Kritikák és amit tettünk:**
  - Kicsit nagynak találta a telefont a görgetős részben, ezért kisebb lett.
  - Az értesítéseket nem érezte elég natívnak, ezért most az app ikonjával jelennek meg.
  - A sárga keretet „marketingesnek” látta, ezért helyette egy „Új” címke áll.
  - Két címet átírtunk az ő javaslata alapján.
- **A te döntésed:** szerinte a sötétkék sáv és a 01–04 lépésrács még kicsit „SaaS-sablonos”.

---

## Claude-nak

**Kiküldendő fájlok, sorrendben**
1. `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_kepek_tulajnak/kor2/mozgas_telefon.mp4` (390x844@2, 39,4 s, H.264 yuv420p 30 fps; ffprobe és 13 kivett kocka ellenőrizve)
2. `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_kepek_tulajnak/kor2/gorgetes_telefon_01.png` … `gorgetes_telefon_07.png` (a 7 lépés telefonon, 390x844@2)
3. `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_kepek_tulajnak/kor2/adozz_weboldal_kor2.html` (egyfájlos, 1889 KB; puppeteerrel fájlból megnyitva: a hős vált, a ragadós bemutató működik, 0 konzolhiba, 0 külső kérés)
4. `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_kepek_tulajnak/kor2/telefon_01.png` … `telefon_09.png` (teljes oldal, 390 2x, 1600 px-es szeletek)
5. `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_kepek_tulajnak/kor2/gep_01.png` … `gep_06.png` (1440 2x, 1800 px-es szeletek)
6. Opcionális: `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_kepek_tulajnak/kor2/gorgetes_gep_01.png` … `gorgetes_gep_07.png`

A teljes oldalas képek a `_eszkoz/tulaj_kep.cjs` szkripttel készültek, nem a `hq_kep.cjs`-sel. Ok: a ragadós bemutató élőben görgetésre vált, és a sima teljes oldalas kép görgetési hosszát üres sötét sáv lett volna. A szkript ezért csak a képhez egy képernyőnyire csukja a bemutatót (`teljes_kep_stilus.cjs`). Mindet megnéztem.

**OpenRouter-költség**
- Ebben a futásban: 0,0194 $ (1 Gemini-hívás, 13 023 bemenő / 2 571 kimenő token; `_eszkoz/gemini_ai_hatas_3.json`).
- A 2. kör eddig összesen: 0,0185 + 0,0215 + 0,0194 = **0,0594 $**.
- A Gemini a két utolsó apró javítás (app-ikon az értesítésben, „Új” címke) előtti képeket látta.

**Ellenőrzések (minden rendben)**
- `node _eszkoz/kep.cjs` hiba nélkül fut: CSP OK, nincs kilógás 1440/1280/768/390 px-en, nincs JS-hiba, a ragadós bemutató megvan.
- `_eszkoz/bemutato_kep.cjs`: 390x844, 390x664, 360x640, 768x1024 és 1440x900 méreten, minden lépésnél a szöveg a képernyőn belül és a telefon alatt van.
- JS nélkül 0 rejtett tartalom (a 7 lépés egymás alatt). Csökkentett mozgásnál ragadós, de animáció nélküli, és a hős áll.
- A mobilmenü bezárul menüpontra, Escape-re és kívül koppintásra.
- Szabályok: 0 név, a 24–48 órás mondat 1×, 0 „a(z)”, 0 AI-említés, az árak változatlanok.

**Mi készült el**
- **Ragadós bemutató gépen és telefonon** (`mozgas.js`, saját kód, könyvtár nélkül). Az eredeti szövegek és alt-szövegek képernyőolvasónak megmaradnak, a színpad `aria-hidden`.
- **Rétegek:** tömör értesítés a státuszsor alatt, takarók, natív hatású kártyák, papír-végállapot „1 oldal”-lal, legfeljebb 2 réteg képernyőnként.
- **Kontraszt:** az inaktív lépések opacity helyett színnel halványodnak (AA); a sötét bevezető színe javítva; a `.gomb` és a lépésszám színátmenete kikerült.
- **Licencek:**
  - `vendor/LICENCEK.md`, mellette a licencszövegek;
  - `fontok/OFL.txt`;
  - a woff újraszűkítve a licenc-névbejegyzésekkel (név ID 13 és 14), a régi woff a `_regi`-ben.
- **Szöveg és felület:** a CSS-ből kikerültek a belső jegyzetek és a cégnevek; a menü sorrendje egyezik az oldaléval; a vélemény-helyőrző és a gépes kép nem jelenik meg.
- **Jegyzet:** `C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/MOZGAS_JEGYZET.md` (a döntések, a licencek és a k8 átvételi lista).
- **Mentés:** `_regi/elotte_kor2_ragados_20261120_2215/`. Semmit nem töröltem.

**Nyitva maradt (a tulaj döntése)**
1. **Hős képváltása:** most folyamatos (a tulaj szavai szerint). Ha mégis két kör után álljon meg, azt a `mozgas.js`-ben kell visszaállítani.
2. **Script az éles oldalon:** a `kod/landing` SPEC §29.3.6 szerint script nélküli. A mozgáshoz egy saját `'self'` `mozgas.js`-t kell engedélyezni; nélküle a minta JS nélkül is teljes.
3. **Gemini-javaslatok, amikhez nem nyúltam:**
   - a sötét „Mit kapsz” sáv (ez arculati kérdés);
   - a 01–04 lépésrács (a művészeti vezető szerint maradjon);
   - telefonszám a fejlécben (kitalált szám nem kerülhet ki);
   - link a hivatalos könyvelő-nyilvántartáshoz a „Ki könyvel neked?” résznél.
4. **Régi, nem frissített fájlok:**
   - a `C5_v2` eredeti képernyőin és az `app_asztali*.webp`-n még „Kovács Bence” áll (nincsenek az oldalon);
   - a gyökérben lévő régi `mozgas_asztali.mp4` és `mozgas_mobil.mp4` még az 1. kört mutatja (nem töröltem);
   - az `adozz_weboldal_egyben.html`-t a gyökérben is frissítettem.
5. **Vélemények:** még nincsenek. Csak valódi, névvel és írásos engedéllyel kerülhetnek ki; a helyük a GYIK előtt van.

=====

ÍTÉLET: OK. A ragadós bemutató működik, és a tulaj kérését teljesíti. Nincs blokkoló hiba. Lépésváltáskor viszont 2 kozmetikai gond látszik (a videóban is), ezeket érdemes kijavítani, mielőtt a tulaj megnézi. Nem javítottam semmit, a projektfájlokhoz nem nyúltam.

MIT NÉZTEM MEG (saját puppeteer-szkriptekkel, minden képet megnéztem)
- 390x844@2 (mobil emuláció) és 1440x900: 14 görgetési pozíció a szakasz előttől a következő szakaszig. Lépésenként a végállapot (4,2 s után) és az átmenet (kb. 150 ms-mal a váltás után), egérgörgős görgetéssel.
- Csökkentett mozgás (390), JS nélkül (390 és 1440).
- Visszafelé görgetés, gyors ugrás a szakasz közepére, majd ki és vissza.
- Vízszintes kilógás a teljes oldalon 360/390/768/1280/1440 px-en, az index.html-en és az egyfájlos adozz_weboldal_kor2.html-en is.
- Akadálymentességi fa (képernyőolvasó).
- A videóból kivett kockák: 2 s-onként, plusz sűrűn a szakasz elején, végén és egy lépésváltásnál.

AMI RENDBEN VAN
- Egy telefon ragad gépen is és telefonon is (a többi kép rejtett, 1x1 px-re vágva). Telefonon a telefon 87–603 px között, a haladásjelző 639 px-nél, a szöveg 656–826 px között áll (a képernyő 844 px). Nem takarják egymást, semmi nem lóg ki. Gépen a telefon jobbra, top 135, alja 838 (900 px-ből). Balra az aktív lépés kiemelt, a többi halványabb, de olvasható.
- A képernyő és a szöveg mind a 7 lépésnél vált, sorrendben, egyenletesen. Telefonon kb. 630 px görgetés jut egy lépésre (kb. 0,75 képernyő), gépen kb. 560 px. Előre és hátra görgetve ugyanaz az aktív lépés. Gyors ugrás után a megfelelő lépés jön, és az animációja újraindul.
- A szakasz eleje és vége tiszta: natív sticky, nincs ugrás. Az első lépés már a beérkezéskor aktív, az utolsó az elengedésig. Elengedéskor a színpad alja 595 px, a következő szakasz 790 px-nél kezdődik (gépen 519 és 748 px). Nincs ráfedés, nem marad üres sáv (a záró szöveg előtt kb. 40–60 px rés van).
- JS nélkül a 7 lépés egymás alatt látszik, szöveg és telefon együtt, a rétegek végállapotban. Rejtett tartalom nincs.
- Csökkentett mozgásnál ragad, ugrásszerűen vált, a rétegek végállapotban vannak, nincs animáció.
- Képernyőolvasó: mind a 7 h3, a bekezdések és a 7 kép alt-szövege pontosan egyszer szerepel, a színpad aria-hidden. A szakaszban nincs fókuszálható elem, ezért billentyűzettel nincs mit elakasztani.
- 0 konzolhiba, 0 JS-hiba, 0 külső kérés, sehol nincs vízszintes kilógás (mindkét változatban). A képek lazy betöltéssel is mind betöltődnek (a tesztben nem kényszerítettem eagerre).
- A videó (mozgas_telefon.mp4: 780x1688, 30 fps, 39,4 s) ezt mutatja: kb. 9,4 s-tól 33 s-ig egy ragadós telefon, váltó képernyők és szöveg, a végén tiszta elengedés. A tulajnak átadott gorgetes_telefon_01…07.png képek is végállapotot mutatnak, rendben vannak.

GONDOK (egyik sem blokkoló)
1. KÖZEPES–ALACSONY (kozmetikai, a videóban is látszik). Telefonon lépésváltáskor a régi és az új lépés szövege egyszerre úszik át ugyanabban a rácscellában. Kb. 0,2–0,3 s-ig két cím és két bekezdés olvashatatlanul egymásra csúszik, pl. „A kiállított számláid…” a „Egy szám mutatja…” fölött. A videóban kb. 13,9–14,0 s-nál látszik.
   - Bizonyíték: scratchpad/ell_ragados/lap_video_valtas.png (sw_057–059), t2_lepes4_atmenet.png, t2_lepes5_atmenet.png.
   - Javaslat: egymás utáni váltás. A stilus.css kb. 289–290. soránál: a nem aktív szöveg `transition: opacity .12s linear, transform .12s`, az `.aktiv` pedig `transition: opacity .25s var(--mozgas) .12s, transform .25s var(--mozgas) .12s`. Így a régi eltűnik, mielőtt az új beúszik.
2. ALACSONY–KÖZEPES (kozmetikai). A 2. (Félretenni) és a 7. (Keretek) lépésnél a takaró is áttűnéssel jelenik meg a kártyával együtt (`.takaro.t-felretesz` és `.t-kereset`, `a-fade k0`). Kb. 0,4 s-ig átlátszik alatta az eredeti app-tartalom, és a beúszó kártyával kettős szöveget ad:
   - 2. lépés: „Idei kereteid / Még 3 685 000 Ft” a „Most legyen félretéve kb. 221 000 Ft” alatt;
   - 7. lépés: „Hónaponként / Október…” a „Még 20 000 000 Ft” alatt.
   - Bizonyíték: lap_video_valtas.png (sw_060–062, kb. 14,0–14,2 s), t2_lepes2_atmenet.png, t2_lepes7_atmenet.png.
   - Javaslat: a sablonban ennél a két takaró-spannál vedd ki az `a-fade` osztályt. A takaró az első pillanattól álljon, és csak a kártya mozogjon. JS nélkül és csökkentett mozgásnál ez nem változtat semmit.
3. ALACSONY (opcionális). A telefon képernyőinek áttűnése 0,3 s-ig mindkét képet félig átlátszóan mutatja, ezért szellemképes (sw_057–058).
   - Javaslat: `.szinpad-tarto > .kepernyo.aktiv { z-index: 1 }`. A régi képernyő maradjon teljesen látható, és csak az új beúszása után tűnjön el (`transition: opacity 0s .3s` a nem aktívon).
4. ALACSONY (megfontolandó). Az Üzenetek lépés végállapotában az `m-ma` maszk (k6) eltűnése után alul egy félig levágott sor jelenik meg: „Ma / A könyvelőd kéri…”, amit az írómező kettévág (t2_lepes6_veg.png). A Gemini korábban éppen a „félbevágott sorokat” kifogásolta.
   - Javaslat: az `m-ma` maszkról vedd ki az `a-ki` osztályt, így a beszélgetés a válasszal ér véget.

TÁJÉKOZTATÁS (nem hiba)
- Telefonon egy lépésre kb. 0,75 képernyőnyi görgetés jut. Ez közel van a kért „kb. egy képernyőnyihez”. Ha pontosan egy kell, a `.szinpad-mod .blepes { height: 88svh }` értéket kell kb. 110svh-ra emelni.
- A szöveg alja 390x844-en 18 px-re van a képernyő aljától. Ez rendben van, a magasság svh-alapú.

FÁJLOK (mind a D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/ell_ragados/ mappában)
- Szkriptek:
  - ell.cjs (görgetési sor + mérés)
  - ell2.cjs (lépésenkénti végállapot és átmenet)
  - ell3.cjs (kilógás, egyfájlos változat)
  - ell4.cjs (akadálymentességi fa)
  - ell5.cjs (visszafelé görgetés és ugrás)
- Képek:
  - telefon görgetés: tel_00…13.png
  - gép görgetés: gep_00…13.png
  - lépésenként: t2_lepesN_veg.png és t2_lepesN_atmenet.png
  - csökkentett mozgás: rm_tel_*.png
  - JS nélkül: nojs_tel_*.png, nojs_gep_*.png
  - videókockák: video/*.png
- Áttekintő lapok: lap_*.png
- Mérések: tel.json, gep.json, rm_tel.json, nojs_tel.json, nojs_gep.json