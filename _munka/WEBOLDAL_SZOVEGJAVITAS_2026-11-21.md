# Értékesítő oldal: szövegjavítás – változáslista, 2026-11-21

Forrás: `_munka/WEBOLDAL_KULSO_ATNEZES_2026-11-21.md` (a Gemini-átnézés szűrt javaslatai) és a tulaj 11-21-i két döntése:
(1) „Ne vállalj felelősséget, azt se írd, mi vállaljuk a felelősséget.”, (2) „Telefonszám később lesz.”

- **Nincs telepítve.** Csak a forrás (`kod/landing`) és a helyi `kod/landing/dist` változott, a tulaj jóváhagyására vár.
- **Mentés a munka előtt:** `kod/landing/_regi/elotte_szovegjavitas_20261121_1312/` (sablon, CSS, mozgas.js, build, teszt, README,
  arak.json, dist). Semmi nem törlődött.
- **Módosított fájlok:** `oldal.sablon.html`, `stilus.css` (2 új szabály a végén), `meres.test.mjs`, `README.md`; a `dist` újraépítve.
  A `mozgas.js` és a `build.mjs` nem változott. A `kod/app`, `kod/panel`, `kod/backend` és `kod/shared` mappákhoz nem nyúltam,
  csak olvastam őket.
- A még nem élő 4h telt színek és a lépésenkénti görgetés változatlanul benne vannak a forrásban és a dist-ben.

## 1. A tulaj döntései

| # | Hol | Régi | Új | Forrás / ellenőrzés |
|---|---|---|---|---|
| T1 | 7. „Ki könyvel neked?”, a cím alatti kis sor | „A szerződést a Somosi Kft.-vel kötöd. A könyvelőd munkájáért a Somosi Kft. felel.” | „A szerződést a Somosi Kft.-vel kötöd, a könyvelőd a mi megbízásunkból dolgozik neked.” | ÁSZF 1.3 (a könyvelő „a mi alvállalkozónként” dolgozik), Megbízási szerződés 1. („A munkát végző könyvelő (közreműködőnk)”). Igaz. |
| T1 | az egész oldal (szöveg, GYIK, alt-szövegek, meta, aria-label; a dist minden szövege) | – | Nincs több felelősségvállaló mondat. Keresve: felel*, felelős*, megtérít*, kártérít*, garant*, helytáll*. A javasolt új felelősség-mondat (javaslatfájl 10. pont) NEM került be. | Egyetlen találat volt (a fenti mondat). A „bérszámfejtést felárért vállaljuk” munkavállalás, nem felelősség, ezért maradt. Teszt őrzi. |
| T2 | az egész oldal | – | Telefonszám nincs (nem is volt). | Teszt őrzi (`tel:`, `+36…`, „telefonszámunk”). |

## 2. Az átvezetett javaslatok

| # | Hol | Régi | Új | Forrás / ellenőrzés |
|---|---|---|---|---|
| 1 | 2. Első képernyő, a cím feletti kis sor | „Online könyvelés egyéni vállalkozóknak” | „Online könyvelés egyéni vállalkozóknak, akkor is, ha most indulsz” | ÁSZF 3.1 („vagy most jelenti be a vállalkozását”), 4/A. Gépen egy sor, 390-en két sor. |
| 2 | 3. „Röviden rólunk”, „NAV-meghatalmazással” kártya | „Az ONYA-n adod meg, és ugyanott bármikor visszavonhatod.” | „A NAV online felületén (ONYA) adod meg, és ugyanott bármikor visszavonhatod.” | Ugyanez a forma áll a 8. szakaszban és a GYIK-ben; ÁSZF 4/C, 8.6. |
| 3 | 4. „Kinek szól”, „Neked szól, ha” lista | „alanyi áfamentes vagy,” | „alanyi áfamentes vagy, vagyis nem számolsz fel áfát (2026-ban évi 20 millió Ft bevételig, ha év közben indulsz, arányosan kevesebbig),” | **A szám hivatalos forrásból igazolva:** NAV, 2025-12-11: [Emelkedik az alanyi adómentesség értékhatára](https://nav.gov.hu/ado/afa/Emelkedik_az_alanyi_adomentesseg_ertekhatara) (Áfa tv. 188. § (2), 2026-tól 20 millió Ft, 2027-től 22 millió Ft). Az év közbeni indulás időarányos határa: [NAV GYIK az értékhatár emeléséről](https://nav.gov.hu/ado/afa/gyakran-ismetelt-kerdesek-az-alanyi-adomentesseg-ertekhataranak-emelesevel-kapcsolatban) („időarányosan veszi figyelembe”). Egyezik az app súgójával (`bekotes.ts`) és a bemutató „keret 20 000 000 Ft” képével. |
| 4 | 9. Árak, „Benne van” lista | „A negyedéves adó és járulékok kiszámítása és bevallása (szja-előleg, tb-járulék, szocho)” | „Átalányadózóként: a negyedéves adód és járulékaid kiszámítása és bevallása (szja-előleg, tb-járulék, szocho)” (a következő sor marad: „Katásként: a havi kata és a kata-keret figyelése”) | ÁSZF 4.1, Megbízási 2.1. A feladatban „Átalányadósként” állt; az oldal, az ÁSZF és az app mindenhol az „átalányadózó” szót használja (az app súgója: „Átalányadózóként …”), ezért ez lett. Ha a tulaj az „átalányadós” alakot kéri, egy szó csere. |
| 4b | 9. Árak, a „Benne van” lista alatt, új kis szürke sor (`.ar-szavak`) | – | „Szja-előleg: a jövedelemadód negyedéves része. Tb-járulék: társadalombiztosítási járulék, ez ad jogot a nyugdíjra és az egészségügyi ellátásra. Szocho: szociális hozzájárulási adó, ezt is a jövedelmed után fizeted. Katásként ezek helyett a havi katát fizeted.” | ado-motor 2026 (szja, tb 18,5%, szocho 13%, negyedéves fizetés; a kata ezeket kiváltja: `KATA_RULES_REGI_2026`). Számot nem írtam bele. |
| 5 | 8. „Az adataid” | „Európai szerveren tároljuk őket, minden fájlt külön titkosítva.” | „Az Európai Unióban tároljuk őket (a szerverünk Németországban van), minden fájlt külön titkosítva.” | Adatkezelési tervezet 2.17 és 3.1 (Contabo GmbH, Németország, „Az adatok az Európai Unióban vannak”). Egyezik a lábléc tárhelyszolgáltató-adatával (Contabo GmbH, München, Németország). A tervezetben ott még [ELLENŐRIZNI] jelölés áll. |
| 5b | 11. GYIK, „Hol vannak az adataim, és ki látja őket?” | „Európai szerveren, titkosítva. …” | „Az Európai Unióban (a szerverünk Németországban van), titkosítva. …” | mint fent |
| 6 | 11. GYIK, „Miért nincs próbaidő? Mikor kell fizetni?” | „… és csak utána fizetsz, bankkártyával.” | „… és csak utána fizetsz, bankkártyával. A havidíj az első fizetéssel indul, akkor is, ha még nincs bevételed.” | ÁSZF 4/A.6 („A havidíjat a szerződés elfogadása és a kártyád megadása napjától fizeted”), Megbízási 5.1 („akkor is, ha most indítod a vállalkozásodat”), backend alapérték `NEW_BUSINESS_CHARGE_POLICY=azonnal`, a szerver `/config`-ja is `azonnal` (`kod/deploy/README.md`). „Bankkártyával” maradt. Lásd 4. pont: ÁSZF 2.3. |
| 7 | 11. GYIK, „Mi kell az induláshoz?” | „… és Ügyfélkapu+ vagy DÁP, hogy megadd vagy jóváhagyd a NAV-meghatalmazást.” | „… és egy állami belépés: Ügyfélkapu+ (felhasználónév, jelszó és egy egyszer használatos kód) vagy DÁP (a Digitális Állampolgár alkalmazás a telefonodon). Ezzel adod meg vagy hagyod jóvá a NAV-meghatalmazást. Ha még a régi Ügyfélkapud van, előbb válts Ügyfélkapu+-ra az ugyfelkapu.gov.hu oldalon. Ha nincs ilyen belépésed, a visszahívásban megmutatjuk, hogyan szerezhetsz.” | `bekotes.ts` (ugyfelkapu_dap), ÁSZF 4/C.9 („a hívásban megmutatjuk, hogyan szerezhetsz”). A régi Ügyfélkapu: [ugyfelkapu.gov.hu súgó](https://ugyfelkapu.gov.hu/sugo/s-bejelentkezes/s-felhasznalonev-es-jelszo/s-uk_megszunese_240116) (2025-01-16 óta az egyfaktoros belépés csak az Ügyfélkapu+ igénylésére jó, „váltson Ügyfélkapu+-ra” az ugyfelkapu.gov.hu-n). A javaslat „kormányablakban segítenek” részét a hivatalos oldal nem írja, ezért kimaradt. |
| 8 | 11. GYIK, ÚJ kérdés (2. oszlop, a „Mi kell az induláshoz?” után) | – | Kérdés: „Hogyan váltok a régi könyvelőmtől?” Válasz: „Az appban megadod az eddigi könyvelődet, és szólsz neki, hogy váltasz. A könyvelőd felveszi vele a kapcsolatot az idei adatokért, hogy ne maradjon ki semmi, és semmit ne adjunk be kétszer. Azt, hogy melyik negyedévtől viszi a könyvelésedet, megbeszéli veled. A régi meghatalmazást csak akkor vond vissza, ha a könyvelőd szól.” | A funkció megvan: `kod/app/src/app/bekotes/adatok.tsx` „Eddigi könyvelőd (ha volt)” mező, súgója: „{könyvelő} felveszi vele a kapcsolatot az idei adatokért”; „Könyvelőt váltasz?” doboz a `konyvelovaltas` magyarázattal (`bekotes.ts`: szólj az eddigi könyvelődnek; melyik negyedévtől, azt a könyvelő megbeszéli; a régi meghatalmazást csak akkor vond vissza, ha szól); az adat a backendben is tárolódik (`previousAccountant`). A GYIK így 5 + 6 kérdés (az 1. oszlop első kérdése nyitva áll, így kiegyensúlyozott). |
| 9 | 12. Záró, „Előbb beszélnél velünk?” szöveg | „Regisztráció után az appban kérhetsz visszahívást. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. A visszahívás ingyenes, és nem kötelező.” | „A visszahíváshoz előbb regisztrálsz: a neved, az e-mail-címed és egy jelszó kell, kártya nem. Az e-mailben kapott kód beírása után a visszahívás lapja nyílik meg. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. A visszahívás ingyenes, és nélküle is elindulhatsz.” | `regisztracio.tsx` (vezetéknév, keresztnév, e-mail, jelszó; a `cel=visszahivas` után `/postafiok?cel=visszahivas`), `postafiok.tsx` (a 6 jegyű kód után `/visszahivas`). Ingyenes: ÁSZF 2.4, 4/B.1. Nem kötelező: K8_TERV. Az időmondat betű szerint a megengedett mondat. A Google-belépést nem írtam ki (csak akkor látszik, ha be van állítva). |
| 9b | 12. Záró, a gomb | „Visszahívást kérek” | „Regisztrálok, és visszahívást kérek” | A link (`/regisztracio?cel=visszahivas`) és a mérési esemény (`visszahivas`, `zaro`) változatlan. CSS: a `.gomb-vonal` telefonon két sorba törhet (390-en 2 sor, nem lóg ki; 1440-en 1 sor). |

## 3. Amit szándékosan NEM változtattam

- **Éves zárás** (javaslatfájl 4. pont): a feladat szerint most nem bővül, az ÁSZF 4.1 még mást mond (ügyvéd rendezi). Az oldalon a régi szöveg maradt.
- **„Gépen az app ma még telefonos elrendezésben nyílik meg.”** (11. pont) és a **záró „Regisztrálj, és válaszolj…”** mondat (13. pont): nem voltak a feladatban.
- **Telefonszám, vélemények, felelősségbiztosítás, válaszidő-ígéret:** nem kerültek be (tulajdöntés, illetve szabály).
- Az adózási módot az oldal továbbra sem javasolja.

## 4. Nyitott pontok (tulaj / jogász / könyvelő)

1. **ÁSZF 2.3 ↔ 4/A.6 ellentmondás (a tervezeten belül):** a 2.3 szerint induló vállalkozónál „a kártyádat csak akkor kérjük, amikor az adószámodat már rögzítettük”, a 4/A.6 és a Megbízási 5.1 szerint a díj a szerződés és a kártya napjától jár, a szerver `azonnal`. Az új GYIK-mondat („A havidíj az első fizetéssel indul, akkor is, ha még nincs bevételed.”) mindkét esetben igaz, de a 2.3-at a jogásznak javítania kell.
2. **A szerződések felelősségi pontjai:** az ÁSZF 1.3 („Érte úgy felelünk, mintha magunk dolgoznánk”), 9.1 és a Megbízási 7.2, 7.5 továbbra is felelősséget vállal. Az oldalról kikerült a felelősség-mondat; a szerződések szövege a jogász és a tulaj dolga.
3. **2027-01-01 előtt:** az áfahatár 20 millióról 22 millió Ft-ra (NAV-forrás fent). A `meres.test.mjs` a mostani 2026-os szöveget nézi, ezért a csere után a tesztet is át kell írni.
4. **Könyvelőváltás:** a SPEC-ben ez [KÖNYVELŐ] jelölésű; Dávid nézze meg a GYIK-választ (a lépések az app mostani szövegéből vannak).
5. **Apróság:** 1440-en a záró panel keskeny oszlopában a „24–48” a nagykötőjelnél sort törhet („24–” / „48 órán”). A megengedett mondat betű szerint kötött (a build és a teszt is így keresi), ezért nem tettem bele nem törő jelet. Ha zavar, a mondat köré lehet egy CSS-osztályt tenni, és akkor a build-ellenőrzést is igazítani kell.

## 5. Tesztek és helyi nézés

- `node kod/landing/build.mjs` → kész (havidíj 19 999 Ft, 6 ár, 25 helyi fájl ellenőrizve; a build saját ellenőrzései: CSP, AI-említés, belső jegyzet, a visszahívás mondata és linkje).
- `node --test kod/landing/meres.test.mjs` → **7/7 sikeres.** Indokolt elvárás-frissítés: a gombfelirat („Regisztrálok, és visszahívást kérek”, régi: „Visszahívást kérek”). Új elvárások: nincs felelősség-mondat (felel*, megtérít*, garant* stb.) és nincs telefonszám; a semleges könyvelő-mondat; a szerver-mondat kétszer, egyezik a lábléc „Németország” adatával, nincs „Európai szerveren”; nincs magyarázat nélküli „ONYA-n”; hős-sor, „Átalányadózóként”, szakszó-sor, új GYIK-kérdés, a 2026-os áfahatár, a visszahívás regisztrációs mondata. Ellenpróba: a felelősség- és az ONYA-szabály a régi dist-en elbukik.
- **Helyi nézés** (Chrome, headless, helyi http-szerverről a `dist`, a `/m/script.js` helyett üres válasz; végiggörgetve, a GYIK lenyitva): 390 és 1440 szélesen **nincs vízszintes kilógás** (scrollWidth = szélesség, egy elem sem lóg ki), **konzolhiba 0**, sikertelen kérés 0. A záró gomb 390-en 330 px széles, 2 soros; 1440-en 1 soros.
- A dist eltérése a mentéshez képest csak a fenti szövegek és a 2 CSS-szabály (`mozgas.js` azonos).
