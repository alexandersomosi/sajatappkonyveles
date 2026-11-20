# 1. kör: Gemini külső szem (a régi oldalról), 11-20 19:45

KÜLSŐ SZEMŰ ÁTNÉZÉS (Gemini, 4 perszóna): kész, még semmit nem építettem.

Fájlok:
- Szkript: D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/gemini_landing.py (`--proba`: hívás nélkül csak kivonatot és szeleteket készít)
- Kimenet: C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_eszkoz/gemini_kulso_1.json (4 válasz, usage, költség, base64 nélkül)
- Elküldött szeletek: D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/gemini_szeletek/szelet_1..6.jpg
  - 6 szelet a telefonos képből, 390×844, ezek a részek: hős, Hogyan, Mit kapsz eleje, Mit kapsz közepe, Mit kapsz vége + Könyvelő, Árak.
  - A szakaszok helyét 390 px-en ezzel mértem: D:/Atvitel/Temp/claude/ab8703f8a7f91647/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/szakasz_pozicio.cjs
- Az oldal teljes látható szövegét 14 szakaszra bontva küldtem, 12 614 karaktert. A rejtett szöveget és a mobilmenü ismétlését kihagytam.

KÖLTSÉG: 0,0386 $ (4 hívás, a usage.cost összege), a keret 0,06 $ volt.
- Hívásonként kb. 13 450 bemenő token. Ebből 12 643 gyorsítótárból jött (cache_control a közös előtagon), ezért volt olcsó.
- A kimenet kb. 2 000–2 250 token hívásonként.
- Az OpenRouter /key szerint a keret előtte 7,966 $, utána 7,946 $ volt. A keret tehát nem kb. 0,5 $, ahogy a feladat írta.

---
PERSZÓNÁNKÉNT

A) Szabó Péter (34, kezdő átalányadós) – MEGVENNÉ.
- 5 mp után érti: „online könyvelés + app, átalányadósoknak/katásoknak”.
- Ez győzi meg: „Minden számla után látod, mennyit tegyél félre.”, a „Másolom” gomb és az igazolás egy gombnyomással.
- Fél, hogy „csak egy algoritmus dobálja a számokat”. Gyanús neki az éves zárás külön díja („a 20 ezer csak a kezdet?”).
- Nem érti, hogy a befizetést neki kell-e jelölnie, vagy a könyvelő látja a bankból.
- Nem érthető neki: „szocho”, „Jogállás-változás”, és ijesztő a „pénzmosás elleni törvény” a GYIK-ben.

B) Kiss Anna (41, katás, irodánál 15 000 Ft/hó) – NEM VENNÉ MEG.
- 19 999 + 14 999 Ft éves zárás a mostani 15 000 Ft-hoz képest, és a mostani könyvelője személyesen elérhető.
- Úgy érzi, a szöveg átalányadós: a negyedéves SZJA-előlegről szól, a katás oldalról alig. „A befizetendő összeget negyedévente…” összezavarja.
- Neki erős pont: „szólunk, ha cégnek számlázol”, és hogy a számlák maguktól jönnek.
- A 24–48 órás visszahívást lassúnak érzi, pánik esetére közvetlen elérést szeretne.

C) Tóth Gábor (52, gyanakvó villanyszerelő) – TALÁN.
- Megnyugtatja: „Pénzt nem vonunk le, és nem utalunk helyetted.”, „…jelszavadat soha nem kérjük el.”, a Somosi Kft. és az adószám.
- Fél, hogy ha a könyvelő hibázik, a NAV őt bünteti.
- „Érte úgy felelünk, mintha magunk dolgoznánk.” → szerinte ez „mellébeszélés”. Felelősségbiztosítást és írásos felelősségvállalást akar látni.
- „Az irataidat titkosítva tároljuk.” → túl általános, nem derül ki, ki fér hozzá.

D) Nagy Lili (26, induló grafikus) – TALÁN.
- Tetszik neki a dizájn és az „Ebben is segítünk” az indulásnál.
- Fél, hogy indulóként bevétel nélkül azonnal fizetnie kell. Nem tudja, ki segít eldönteni, kata vagy átalányadó.
- Szerinte „Egy csomag, egy ár.” félrevezető, mert alatta külön díjak jönnek.
- „célcsoport” túl száraz, „ONYA” ismeretlen.

---
KÖZÖS TANULSÁGOK (rangsorolva)

1. Az 5 mp-es teszt mind a négynek sikerült: a hős érthető, ehhez nem kell nyúlni.
2. Az árak megfogalmazása gyanút kelt (3/4, Annánál ez dönt).
   - Az „Egy csomag, egy ár” és a lenti külön díjak ellentmondásnak tűnnek, az éves zárás meglepetés.
   - Megoldás: őszinte cím, és az éves zárás már a hős árnál látszódjon.
3. Bizalom: ki felel, ha hiba van, és dolgozik-e ember a számaimon (Péter, Gábor, Anna).
   - Megoldás: tények (szerződő fél, név és nyilvántartási szám az appban), és a mozgó bemutatóban látszódjon az emberi munka („átnézte az iratokat”, „Kéri az októberi bankszámlakivonatot”).
4. Elérhetőség: a 24–48 óra lassúnak hat (Anna, Gábor, Lili).
   - Időt nem ígérhetünk. Helyette azt kell kiemelni, hogy bármikor írhat az appban, és hogy határidő előtt emlékeztetünk, a határidőket a könyvelő figyeli.
5. Szakszavak: szocho, SZJA-előleg/TB-járulék felsorolva, ONYA, jogállás-változás, pénzmosás, célcsoport, bekötés (GYIK).
6. Egybefolyás (4/4), ugyanazokon a helyeken:
   - hős és bizalmi sáv: nincs törés,
   - Kinek és Hogyan: fehér alapon fekete szöveg,
   - Mit kapsz vége és Könyvelő: fehér kártya fehér/szürke alapon, a határ eltűnik,
   - Biztonság, Árak, Összevetés: szöveges falak egymás után.
   - Kértek: színes hátteret, színes lépésszámokat, funkciónként kiemelőszínt, egy sötét kontrasztszakaszt.
7. A mozgó bemutatóra mind a négy magától ugyanazt a sort mondta: számla beérkezik → félretenni összeg ugrik → „Másolom” → fotó a Dossziéba.
   - Visszatérő haszon 1: „tudom, mennyi a tiszta pénzem / mit nem költhetek el”.
   - Visszatérő haszon 2: „nem gépelem el a számlaszámot”.
   - Az appban van „Mennyit kerestem?” képernyő (54_kereset), ez pontosan erre felel.
8. A katásoknak (Anna) és az indulóknak (Lili) kevés saját üzenet jut.

FIGYELEM: néhány Gemini-javaslat sérti a szabályokat, ezeket NE vegyük át.
- „teljes anyagi felelősség és biztosítási garancia”, kötvényszám és biztosítási összeg: csak akkor, ha a tulaj szerint valóban van ilyen.
- „kamarai pecsét”
- „azonnal elérhető ember”
- „bemutató videó”
- kitalált számok: „12 000 Ft-os fodrász számla”, „11,2 millió keret”

---
SZÖVEGJAVASLATOK (régi → új)

- Hős, ár alatt: „bruttó, minden külön díj kiírva” → „bruttó · évente egyszer éves zárás: 14 999 Ft · minden díj kiírva”
- Kinek H2: „Egy célcsoport, egy csomag.” → „Átalányadósoknak és katásoknak. Csak nekik.”
- Árak H2: „Egy csomag, egy ár. A külön díjakat is előre látod.” → „Egy havidíj. Minden más díj előre kiírva.”
  - Alá: „Évente egyszer jön hozzá az éves zárás. A többit csak akkor fizeted, ha kéred.”
- Könyvelő-lista: „Kiszámolja és beadja a negyedéves SZJA-előleget, TB-járulékot és szochót.” → „Negyedévente kiszámolja és beadja az adódat és a járulékaidat (SZJA-előleg, TB-járulék, szocho).”
- Biztonság: „Te adod meg az ONYA-ban.” → „Te adod meg a NAV online felületén (ONYA).”
- Árak: „Jogállás-változás bejelentése helyetted / Például főállásból mellékállásba.” → „Ha főállásból mellékállásba váltasz (vagy fordítva), bejelentjük helyetted.”
- Árak: „Amíg szünetel a vállalkozásod / A havidíj helyett ezt fizeted.” → „…/ Ilyenkor a havidíj helyett csak ennyit fizetsz.”
- GYIK: „(a pénzmosás elleni törvény miatt azonosítanunk kell az ügyfeleinket)” → „(a törvény előírja, hogy azonosítsuk az ügyfeleinket)”
- GYIK: „…ami a bekötéshez és a visszahíváshoz kell.” → „…ami az induláshoz és a visszahíváshoz kell.”
- Bizalmi sáv: „Az irataidat titkosítva tároljuk.” → „Az irataidat titkosítva tároljuk, és csak a könyvelőd látja őket.”
- Könyvelő: „Érte úgy felelünk, mintha magunk dolgoznánk.” → „A szerződést velünk kötöd, így a könyvelőd munkájáért mi felelünk.” (A tulaj ellenőrizze, jogilag igaz-e.)
- Mit kapsz / Félretenni: „A befizetendő összeget negyedévente a könyvelőd hagyja jóvá.” → „Mielőtt utalsz, a könyvelőd ellenőrzi az összeget.”
  - Új sor: „Katás vagy? Ugyanígy látod a havi katát és a kata-keretedet, és szólunk, ha cégnek számlázol.”
- Mit kapsz / Üzenetek, az elérhetőség miatt: „Kérdezz tőle az appban…” → „Bármikor írhatsz neki az appban, és ha elakadsz, visszahívást kérhetsz.” Ez nem időígéret. A visszahívás idejénél továbbra is csak az engedett mondat maradjon.
- Új GYIK-kérdés kell, de a választ a tulajnak kell megadnia: „Még csak indulok, és nincs bevételem. Mikortól fizetek?”

---
MOZGÓ BEMUTATÓ: „Mindig tudod, hol tartasz az adóval” (lépések és a „miért jó neked”)

A számok mind az app-képekről valók.

1. Beérkezik a számla.
   - Mozog: a „Kiállított számlák” listába becsúszik a „Napfény Étterem Kft. · SZ-2026-0019 · 418 000” sor, alatta felbukkan: „Ebből kb. 29 000 Ft-ot tegyél félre.”
   - Neked: nem gépelsz be semmit, a számláid maguktól jönnek a NAV-tól.
2. Felpörög a félreteendő összeg.
   - Mozog: a főoldalon a számláló felpörög „kb. 250 000 Ft”-ig (III. negyedév 96 000 + IV. negyedév eddig 154 000). Koppintás a „Megjelölöm, hogy félretettem” gombra → pipa.
   - Alatta: „Ez csak jelölés: pénzt nem vonunk le, nem utalunk.”
   - Neked: nem költöd el az adó pénzét, és negyedév végén nem ér meglepetés.
3. Jön a határidő.
   - Mozog: értesítés: „Közeleg egy határidő – Szja-előleg, IV. negyedév: jan. 12.” Utána a kártya: „kb. 49 680 Ft”, számlaszám 10032000-06056353. Koppintás a „Másolom” gombra → „Kimásolva”.
   - Felirat: katásként a havi katát látod így.
   - Neked: nem késel le határidőt, és nem gépeled el a számlaszámot.
4. Lefotózod a papírt, és bekerül a Dossziéba.
   - Mozog: kameranézet (Galéria | exponáló | Fájl, PDF), majd a „Papírbolt, nyomtatópapír” bekerül a „Novemberi dosszié – Amit te küldtél” részbe. Felirat: „Elküldve a könyvelődnek”. Utána: „átnézte az iratokat · 5 irat rendben”.
   - A mozgó rétegben név NE legyen, csak „a könyvelőd”.
   - Neked: nem hordod a papírt, és látod, hogy ember nézte át. Ez Péter „algoritmus” félelmére felel.
5. Ír a könyvelőd.
   - Mozog: gépelés-jelző, majd „Itt vagyok, ha kérdésed van…”. Utána a gombok: „Jövedelemigazolás”, „Nullás igazolás”, „Visszahívást kérek”. Végül értesítés: „Megérkezett a befizetésed – a III. negyedéves szja-előleg rendben megérkezett.”
   - Neked: kérdezhetsz, igazolást kérhetsz egy gombbal, és a könyvelőd látja, hogy rendben vagy. Ez Péter „ki látja a befizetést?” kérdésére felel.
6. Töltődik a keret-sáv.
   - Mozog: a sáv eddig 16 315 000 Ft-ig töltődik a 20 000 000 Ft-os keretből, mellette: „Még 3 685 000 Ft”.
   - Katásként: kata-keret, és „szólunk, ha cégnek számlázol”.
   - Neked: nem csúszol bele véletlenül az ÁFA-ba, és nem veszíted el a katát.
7. Záró kép (javasolt): „Mennyit kerestem? Idén eddig kb. 14 527 000 Ft maradt neked.”
   - Neked: egy pillantásból tudod, mennyi a tiéd az adók után. Ez volt a perszónák saját szava.

---
A KÖNYVELŐ SZAKASZ FOTÓ NÉLKÜL (a perszónák szerint mi adna bizalmat)

- „Egy negyedév a könyvelőddel” mozgó idővonal:
  - havonta: átnézi a számláidat, és kéri, ami hiányzik,
  - negyedév végén: kiszámolja és beadja a bevallást,
  - látja a kivonatodon, hogy megérkezett a befizetésed,
  - ha NAV-levél jön, elmagyarázza.
- Mellette kiemelt tény-kártyák:
  - „A neve és nyilvántartási száma a szerződésedben és az appban.”
  - Ha igaz: „A nyilvántartást bárki ellenőrizheti.” Ezt a tulaj erősítse meg.
  - A szerződő fél a Somosi Kft.
  - A meglévő „Amit soha nem kérünk el” doboz.
- Felelősségbiztosítást 3 perszóna kért. Csak akkor kerüljön ki, ha valóban van.

---
SZÍNEK (a perszónák szerint itt kell a törés)

- Hős: halványkék.
- Bizalmi sáv: tömör kék vagy fehér kártyák kék alapon.
- Kinek: fehér alap, az „igen” kártya menta, a „nem” kártya halvány rózsa.
- Hogyan: meleg sárgás alap, színes lépésszámokkal.
- Mit kapsz / mozgó bemutató: sötét (#10152B).
- Könyvelő: menta.
- Biztonság: levendula.
- Árak: fehér alap, kék keretes kártya, sárga kiemelés.
- Összevetés: halványkék.
- Záró: tömör kék, sárga gombbal.
- Funkciónkénti kiemelőszín: Félretenni sárga, Határidők kék, Dosszié/Fotó menta, Üzenetek levendula, Keretek korall.
- A szöveg mindenhol sötét a pasztell alapon, hogy meglegyen a WCAG AA kontraszt.