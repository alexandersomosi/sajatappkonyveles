# 1. kör: építő jelentése, 11-20 20:30

KÉSZ: mind a 4 tulaji kérés megvalósult a landing_v2 mappában. A kep.cjs hibát nem talált, mindkét videó elkészült, és egy második Gemini-kört is lefuttattam a kész oldalon (0,0143 $).

## 0) Biztonsági másolat
- Munka előtt mindent ide másoltam: C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/_regi/elotte_mozgas_20261120_1940/
  - sablon, stilus.css, index.html, egyfájlos html, a két png, az összes kép, az eszközök (epit/kep/kepek_vag/egybe).
- Nem töröltem semmit.

## 1) Képek – _eszkoz/kepek_vag.py
- A LISTA bővült, és a kivágás most több szeletből is összerakhat egy képet (fejléc + lejjebb görgetett rész).
- A dokk-magasságot a képekből mértem: a navigáció kb. 170 px, ezért 190 px.
- Új telefonképek (780x1688):
  - app_dosszie, app_szamlak (61), app_fotozas (64), app_kereset (54);
  - app_uzenetek_chat: a fejléc (0–432) és a beszélgetés (1190-től) összeillesztve.
- Új gépes képek a hőshöz (A60/A70/A53, 1440x914-re vágva): app_asztali_dosszie, app_asztali_uzenetek, app_asztali_hataridok.

## 2) Hős
- A telefon képernyője vált: Főoldal → Dosszié → Üzenetek → Fotózás → Határidők, 3,4 mp-enként, oldalra csúszó áttűnéssel.
- A böngészőkép együtt vált vele; a Fotózásnál a gépes Dosszié látszik, mert ott van a „Húzd ide a fájlt”.
- Alatta vezérlő:
  - szünet/indítás gomb, magyar akadálymentes felirattal („Képváltás szüneteltetése/indítása”);
  - 5 fül-gomb Fluent ikonnal és haladás-csíkkal; mobilon és 981–1180 px között csak ikon;
  - felirat, pl. „Dosszié: minden papírod egy helyen”.
- Mikor áll meg:
  - ha nem látható a fül vagy a hős a képernyőn kívül van;
  - reduced-motion esetén eleve áll, és csak kézzel indul.
- JS nélkül a vezérlő láthatatlan, de a helye megvan, így nincs elmozdulás.
- Az ár alatti sor: „bruttó · éves zárás évente egyszer: 14 999 Ft · minden díj kiírva”.

## 3) #mit-kapsz: mozgó bemutató, sötét #10152B alapon
- 7 lépés, mindegyik: színes szám + címke, cím, 1–2 mondat, „Neked ebből:” haszon-sor.
- A lépések:
  1. Számlák (égkék): „Új számla a NAV-tól” értesítés, a Napfény-sor becsúszik a listába, buborék: „Ebből kb. 29 000 Ft-ot tegyél félre”.
  2. Félretenni (sárga): a számláló 221 000 → 250 000 Ft-ra pörög „+29 000 Ft” címkével, koppintás → zöld „Megjelölve”; alatta: „Ez csak jelölés…”.
  3. Határidők (kék): „Közeleg egy határidő” értesítés, keret a 10032000-06056353 körül, „Másolom” → „Kimásolva”; katás mondat.
  4. Fotózás (menta): papír a keretben, vaku, a papír a Dosszié fülre repül, „Elküldve a könyvelődnek”.
  5. Dosszié (menta): a Papírbolt-sor becsúszik „Új” címkével, „A könyvelőd átnézte az iratokat · 5 irat rendben”.
  6. Üzenetek (levendula): a kérdés megjelenik, gépelés-jelző, a válasz („Eddig 317 000 Ft-ot…”), végül „Megérkezett a befizetésed”.
  7. Keretek (korall): „Még 3 685 000 Ft”, a sáv 16 315 000 Ft-ig töltődik a 20 000 000 Ft-ból; kiemelés a „14 527 000 Ft maradt neked” körül.
- Hogyan mozog:
  - A rétegeket HTML/CSS-sel rajzoltam, a képek pixeleiből kimért százalékos helyekre.
  - A „becsúszó sor” a képből kivágott háttérkép (CSS url), alatta fehér takaróval.
  - Név a rétegekben nincs, csak „a könyvelőd”.
  - A számok mind az app-képekről valók. Egyetlen kivétel a számláló 221 000-es kezdőértéke, ami csak a felpörgés közben villan fel (250 000 − 29 000).
- Elrendezés:
  - ≥981 px: a mozgas.js a lépések telefonjaiból ragadós „színpadot” épít, a telefon görgetésre vált, alatta színes pöttyök.
  - Keskenyebben: minden lépésnek saját telefonja van, és akkor indul, amikor félig a képernyőre ért.
  - JS nélkül / reduced-motion esetén: lépésenként szöveg + telefon, minden réteg a végállapotában.
- A 4 apró kártyából 3 beépült a lépésekbe. Alatta 3 tény-kártya: „Telefonon és gépen”, „A pénzed nálad marad”, „A NAV-hoz a könyvelőd fordul”, és a „bemutató adatokkal” jelölés.

## 4) #konyvelo: fotó nélkül, menta alapon
- A fotó és a [NÉV]/[KÉPESÍTÉS]/[nyilvántartási szám]/idézet helyőrzők eltűntek.
- Bal oldalon „Egy negyedév a könyvelőddel” idővonal 5 lépéssel, Fluent ikonokkal, görgetésre töltődő vonallal:
  - havonta átnézi a számláidat, és kéri a kivonatot, mert abból látja, mikor jött a pénz;
  - a negyedév végén kiszámolja és beadja;
  - a feltöltött kivonaton látja, hogy megérkezett a befizetésed;
  - elmagyarázza a NAV-levelet;
  - bármikor kérdezhetsz tőle.
- Jobb oldalon tény-kártyák:
  - kiemelve: „Név szerint ismered – a neve és a nyilvántartási száma a szerződésedben és az appban”;
  - „Egy szerződés, egy felelős”: Somosi Kft. + a már meglévő „úgy felelünk…” mondat;
  - a „Amit soha nem kérünk el” doboz maradt.

## 5) Színek (stilus.css, jelölők a :root-ban)
| Szakasz | Háttér |
|---|---|
| Hős | halványkék |
| Bizalmi sáv | tömör kék, ikonok #F1F3F9 csempén |
| Kinek | fehér; „igen” kártya menta, „nem” kártya rózsa |
| Hogyan | meleg sárgás, fehér kártyák, színes 1–4 számok, nyilak |
| Mit kapsz | sötét |
| Könyvelő | menta |
| Biztonság | levendula |
| Árak | fehér; 2 px kék keretes kártya, sárga kiemelő a 19 999 Ft alatt, kiemelt éves zárás sor |
| Összevetés | halványkék |
| Vélemények-helyőrző | fehér |
| GYIK | meleg |
| Záró | kék |
| Lábléc | sötét |

- Funkció-színek: .szin-egkek/sarga/kek/menta/levendula/korall.
- A --halvany szürkét sötétítettem (#5F687D), mert a régi #8A93A8 kis betűvel nem volt AA.
- Kontraszt: 86 szöveg/háttér párt ellenőriztem, mind ≥4,5:1; a sötét szakaszban a legkisebb 7,03.

## 6) Mozgás és mozgas.js
- Egyetlen saját fájl: C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/mozgas.js, `<script src="mozgas.js" defer>`.
- Nincs benne inline kód, onclick vagy style= attribútum; IntersectionObserver + requestAnimationFrame.
- Csak transform/opacity animálódik.
- Görgetésre beúszó kártyák (a hajtás környéki bizalmi sáv kivételével), felpörgő számok, egér alatti emelkedés.
- Gemini-javaslatokból átvett szövegek: „Átalányadósoknak és katásoknak. Csak nekik.”, „Egy havidíj. Minden más díj előre kiírva.” + alcím, ONYA magyarázat, jogállás- és szünetelés-szöveg, „a törvény előírja…” (a pénzmosás helyett), „az induláshoz”, a szocho a felsorolás végére került.

## 7) Eszközök
- kep.cjs:
  - CSP-forrásellenőrzés: csak a mozgas.js engedett, nincs inline script/style/on*;
  - a teljes oldalas képek reduced-motion emulációval készülnek (végállapot);
  - új mozgás-próba végiggörgetve 1440/390/1280/768 szélességen.
- Az egybe.py inline-ba teszi a mozgas.js-t. Frissítettem a scratchpad példányt, és van másolat itt: _eszkoz/egybe.py.
- Új: _eszkoz/video.cjs, _eszkoz/gemini_ellenor_2.py.

**kep.cjs kimenete:**
```
forrás (CSP)  OK
landing_asztali.png  1440x16013 @1x (csökkentett mozgás, állókép)  OK
landing_mobil.png  390x23685 @2x (csökkentett mozgás, állókép)  OK
mozgás-próba 1440x900 (ragadós színpad)  OK
mozgás-próba 390x844 (lépésenkénti telefonok)  OK
mozgás-próba 1280x800 (ragadós színpad)  OK
mozgás-próba 768x1024 (lépésenkénti telefonok)  OK
```
- Egyfájlos változat: adozz_weboldal_egyben.html, 2398 KB, nem maradt helyi hivatkozás. Headless Chrome-ban 390 és 1440 szélességen kipróbáltam: nincs JS-hiba és nincs idegen kérés.

## 8) Videók (ffprobe)
- **mozgas_mobil.mp4**: H.264, yuv420p, 780x1688, 30 fps, 40,17 s, 9,75 MB.
  - A headless közvetítés csak 1x-es képet ad, ezért lassított oldal-idővel (×0,2) és képernyőképekkel vettem fel; 2401 kocka, a sebesség valós.
- **mozgas_asztali.mp4**: H.264, yuv420p, 1440x900, 30 fps, 40,4 s, 4,46 MB (CDP közvetítés).
- Forgatókönyv: hős váltás → a 7 lépés → könyvelő-szakasz.
- 10–14 kivett képkockát néztem meg mindkettőből: van mozgás (számláló félúton, gépelés-jelző, papír, áttűnés), nincs üres vagy fekete kocka.

## Második Gemini-kör a kész oldalon (_eszkoz/gemini_kulso_2.json)
- Költség 0,0143 $; az eddigi összesen 0,0529 $ a 0,12 $-os keretből.
- Érthetőség 9/10. Vásárlási szándék:
  - Péter: igen; Gábor: igen; Lili: igen;
  - Anna: talán (az ár és a személyes kapcsolat miatt).
- Mind a négyen a saját szavukkal helyesen írták le, mit csinál az app.
- A kivonat szerepét homályosnak találták; ezt már javítottam az idővonalban.

## Nyitva maradt (a tulaj döntése)
1. **Kitalált könyvelőnév a képeken.** Az app bemutató képein „Kovács Bence” név és rajzolt avatar látható, és az új váltakozó/bemutató képekkel ez többször előkerül. Gemini (Anna) szerint ellentmond a „nincs fotó” elvnek. Ha zavaró, a C5_v2 képeket újra kell renderelni „a könyvelőd” felirattal és semleges ikonnal.
2. A „…úgy felelünk, mintha magunk dolgoznánk” mondatot meghagytam. Felelősségbiztosítás csak akkor kerülhet ki, ha valóban van. A „nyilvántartást bárki ellenőrizheti” mondat a tulaj megerősítése nélkül nincs kint.
3. Új GYIK „Még csak indulok, nincs bevételem. Mikortól fizetek?” kérdés: a választ a tulajnak kell megadnia.
4. A „Megjelölve” és „Kimásolva” állapot szemléltető visszajelzés. Érdemes megnézni, hogy az appban is így jelenik-e meg.
5. A vélemény-helyőrzőt élesítés előtt el kell rejteni.
6. A sötét szakasz overflow-x: clip-et használ (Safari 16+). Régebbin a body overflow-x: hidden takar.

## Fájlok
Mind a C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2/ mappában:
- Fő fájlok: _eszkoz/index.sablon.html, stilus.css, mozgas.js (új), index.html (generált)
- Eszközök (_eszkoz/): kepek_vag.py, kep.cjs, egybe.py, video.cjs, gemini_ellenor_2.py, gemini_kulso_2.json
- Képek: kepek/app_*.webp
- Képernyőképek és egyfájlos változat: landing_asztali.png, landing_mobil.png, adozz_weboldal_egyben.html
- Videók: mozgas_mobil.mp4, mozgas_asztali.mp4