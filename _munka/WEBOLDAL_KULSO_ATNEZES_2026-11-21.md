# Külső Gemini-átnézés: szűrés és javítási javaslat – Adózz.hu értékesítő oldal, 2026-11-21

Forrás: `kod/landing/_eszkoz_kulso/gemini_kulso_2026-11-21.json` (5 nézőpont, google/gemini-3.8-flash, 14 kép + az oldal teljes szövege).
Összevetve ezekkel: `kod/landing/oldal.sablon.html`, `kod/jogi/aszf.md`, `kod/jogi/megbizasi_szerzodes.md`, `kod/jogi/adatkezeles.md`,
`_munka/K8_TERV.md`, `_munka/TERV_EVES_CIKLUS_KATA.md`, `_munka/HIANYLISTA_2026-11-21.md`, `kod/shared/src/bekotes.ts`,
`kod/app/src/app/(auth)/regisztracio.tsx`, `kod/backend/src/config.ts`, `kod/ado-motor/src/rules/2026.ts` és a memória-összefoglaló.
Ebben a körben semmi nem módosult, ez csak javaslat. Költség: 0,0483 $ (keret 0,08 $).

## 1. Röviden: mit mondtak a „vásárlók”

- **Érthető-e?** Igen. Mind az 5 nézőpont 5 másodperc alatt eltalálta: online könyvelés appal, valódi könyvelővel, átalányadós és
  katás egyéni vállalkozóknak. A havidíjat és a külön díjakat mind értik.
- **Bizalom:** 6–8 pont a 10-ből (Gábor 6, Anna 7, Péter, Lili és a szakember 8).
- **Senki nem regisztrálna rögtön.** Péter előbb visszahívást kérne, a többiek elmentenék későbbre.
- **Ami zavaros:** az ONYA szó magyarázat nélkül; a „Visszahívást kérek” gomb regisztrációra visz; az éves zárás (mi ez, mikor kell
  fizetni, miért nincs benne a havidíjban); a szakszavak az Árakban (szja-előleg, tb-járulék, szocho), és hogy ebből mi vonatkozik a katásra;
  „alanyi áfamentes”, „Ügyfélkapu+ vagy DÁP”; az, hogy indulóknak is szól, csak a 4. szakaszban derül ki.
- **Ami bizalmat rombol:** nincs telefonszám, nincs vélemény; a „Gépen az app ma még telefonos elrendezésben nyílik meg.”
  félkésznek hat; az „Európai szerveren” mellett a láblécben München áll; nem derül ki, mit jelent a „Somosi Kft. felel”.

## 2. Jogos javaslatok, rangsorolva (érthetőség > bizalom > meggyőzés)

Jelölések: **Igaz?** = az új szöveg a tények szerint igaz-e, és mivel ellenőriztem. **Teendő** = teszt, tulaj- vagy jogászdöntés.
A sablonban a cégnév `{{ceg:legalName}}`; az alábbi szövegekben a kiírt alak (Somosi Kft.) áll.

### ÉRTHETŐSÉG

**1. A „Visszahívást kérek” gomb a regisztrációra visz (mind az 5 jelezte)**
- Hol: 12. Záró felhívás (`oldal.sablon.html` 634–636. sor).
- Gond: „Regisztráció után az appban kérhetsz visszahívást.” A gomb felirata viszont azt ígéri, hogy rögtön kérhet. A „nem kötelező”
  kétértelmű (szakember: kinek nem kötelező?).
- Régi szöveg: „Regisztráció után az appban kérhetsz visszahívást. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.
  A visszahívás ingyenes, és nem kötelező.”
- Új szöveg: „A visszahíváshoz előbb regisztrálsz: a neved, az e-mail-címed és egy jelszó kell (vagy Google-fiók), kártya nem. A megerősítő
  kód után a visszahívás lapja nyílik meg. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között. A visszahívás ingyenes,
  és nélküle is elindulhatsz.”
- Gomb: „Visszahívást kérek” → „Regisztrálok, és visszahívást kérek” (a link marad: `/regisztracio?cel=visszahivas`).
- Igaz? IGEN. `regisztracio.tsx`: vezetéknév, keresztnév, e-mail, jelszó (+ Google), a kód után `/postafiok?cel=visszahivas` →
  `/visszahivas`. A visszahívás nem kötelező (K8_TERV: „a NEM kötelező visszahívás UTÁN”), ingyenes (ÁSZF 2.4, 4/B.1). Az időmondat
  betűre a megengedett mondat.
- Teendő: `meres.test.mjs` 169. sor a gombfeliratot keresi, ezt igazítani kell. (Regisztráció nélküli visszahívás: lásd 5. pont, üzleti döntés.)

**2. Az ONYA magyarázat nélkül (Péter, Anna, Gábor, Lili – a vásárlók mindegyike)**
- Hol: 3. „Röviden rólunk” sáv, „NAV-meghatalmazással” kártya (126. sor).
- Régi: „Az ONYA-n adod meg, és ugyanott bármikor visszavonhatod.”
- Új: „A NAV online felületén (ONYA) adod meg, és ugyanott bármikor visszavonhatod.”
- Igaz? IGEN. Ugyanez a forma áll a 8. szakaszban és a GYIK-ben; ÁSZF összefoglaló + 8. pont (visszavonás az ONYA-ban).

**3. Szakszavak az Árakban, és a katás nem tudja, mi vonatkozik rá (Péter, Anna, Lili, közvetve a szakember)**
- Hol: 9. Árak, „Benne van” lista (488. sor).
- Régi: „A negyedéves adó és járulékok kiszámítása és bevallása (szja-előleg, tb-járulék, szocho)”
- Új: „Átalányadósként: a negyedéves adód és járulékaid kiszámítása és bevallása (szja-előleg, tb-járulék, szocho)”
  (a következő sor marad: „Katásként: a havi kata és a kata-keret figyelése”).
- Ajánlott kiegészítés a lista alá, egy kis szürke sorban: „Szja-előleg: a jövedelemadód negyedéves része. Tb-járulék: ebből jár a
  nyugdíjad és az egészségügyi ellátásod. Szocho: szociális hozzájárulási adó, ezt is a jövedelmed után fizeted.”
- Igaz? IGEN. Az ado-motor 2026-os szabályai: szja 15%, tb 18,5%, szocho 13%, negyedéves fizetés. A kata ezeket kiváltja (havi 50 000 Ft,
  `KATA_RULES_REGI_2026`), ezért a katásra nem vonatkozik.

**4. Az éves zárás homályos (Péter, Lili, szakember)**
- Hol: 9. Árak – bevezető (475. sor), „Külön díjak” bevezető (503. sor), az „Éves zárás” sor leírása (506. sor).
- Gond: nem derül ki, mi ez, mikor kell fizetni, miért nincs benne a havidíjban, és választható-e.
- a) Régi: „A havidíjhoz évente egyszer jön hozzá az éves zárás. A többi díj is itt van. Ami egyedi, arra előre, írásban adunk ajánlatot.”
  Új: „A havidíjon felül évente egyszer az éves zárást fizeted: ekkor adja be a könyvelőd az éves bevallásaidat. A többi díj is itt van.
  Ami egyedi, arra előre, írásban adunk ajánlatot.”
- b) Régi: „Az éves zárást akkor fizeted, ha az éves bevallásodat mi adjuk be. A többi díj csak akkor jár, ha te kéred a munkát. …”
  Új: „Az éves zárás díját évente egyszer, az éves kérdőív elküldésekor fizeted, utána a könyvelőd elkészíti és beadja az éves
  bevallásaidat. Ha az éves bevallást magad adod be, ezt nem kell fizetned. A többi díj csak akkor jár, ha te kéred a munkát. Mindet előre
  látod az appban, és a jóváhagyásod nélkül nem kérjük.”
- c) Régi: „Az éves adóbevallások: szja vagy kata, és iparűzési adó.”
  Új: „Az előző év bevallásai (szja vagy kata, és iparűzési adó). Kiszámoljuk, kell-e még fizetned, vagy visszajár.”
- Igaz? RÉSZBEN, előfeltétellel. A folyamat igaz (`TERV_EVES_CIKLUS_KATA.md` 7. pont: a díj a kérdőív elküldésekor keletkezik, magától
  soha nem vonjuk le; az éves zárás kiszámolja a különbözetet vagy a visszajárót). A „Ha … magad adod be” mondat a mostani feltételes
  szöveget mondja ki egyenesen: [TULAJ: maradjon-e]. **De:** az ÁSZF 4.1 és a Megbízási szerződés szerint az éves bevallás a havidíj
  része, a 14 999 Ft-os díj pedig a rendszerben KI van kapcsolva (T1). A szöveg csak akkor igaz, ha az ÁSZF-et javítják. Addig az oldal és
  a szerződés ellentmond egymásnak, és ez nem a Gemini lelete.

**5. „alanyi áfamentes vagy” – magyarázat nélkül (Péter, Lili)**
- Hol: 4. Kinek szól, „Neked szól, ha” lista (146. sor).
- Régi: „alanyi áfamentes vagy,”
- Új: „alanyi áfamentes vagy, vagyis nem számolsz fel áfát (2026-ban évi 20 millió Ft bevételig; induláskor ezt választod),”
- Igaz? IGEN. `ado-motor/src/rules/2026.ts` `afaLimitHuf: 20_000_000` (Áfa tv. 188. §); a választás az induló útmutató része (ONYA, T101E
  adózási adatok, `bekotes.ts`). Teendő: 2027-01-01 előtt 22 millióra írni (a K8_TERV 2027-es frissítési listájába).

**6. „Ügyfélkapu+ vagy DÁP” – Anna nem tudja, mi ez, neki „sima” Ügyfélkapuja van**
- Hol: 11. GYIK, „Mi kell az induláshoz?” (612. sor).
- Régi: „… és Ügyfélkapu+ vagy DÁP, hogy megadd vagy jóváhagyd a NAV-meghatalmazást.”
- Új: „… és állami belépés: Ügyfélkapu+ (felhasználónév, jelszó és egy egyszer használatos kód) vagy DÁP (az állam telefonos alkalmazása).
  Ezzel adod meg vagy hagyod jóvá a NAV-meghatalmazást. Ha még a régi Ügyfélkapud van, előbb Ügyfélkapu+-ra kell váltanod, ebben bármelyik
  kormányablakban segítenek. Ha nincs ilyen belépésed, a visszahívásban megmutatjuk, hogyan szerezhetsz.”
- Igaz? IGEN a leírás (`bekotes.ts` 363–365. sor, ÁSZF 4/C.9). A „régi Ügyfélkapu már nem elég” általános tény (2025. január 16-án szűnt
  meg); a repóban nincs rá forrás, kiírás előtt egy pillantás a magyarorszag.hu-ra.

**7. A hős nem mondja ki, hogy indulóknak is szól (Lili)**
- Hol: 2. Első képernyő, a cím feletti kis sor (59. sor).
- Régi: „Online könyvelés egyéni vállalkozóknak”
- Új: „Online könyvelés egyéni vállalkozóknak, akkor is, ha most indulsz”
  (másik lehetőség: a bevezető végére egy mondat: „Ha most indítod a vállalkozásodat, abban is segítünk.”)
- Igaz? IGEN: ÁSZF 4/A (személyre szabott útmutató) és 4/C (2026 végéig „helyetted” is).

**8. Mikor indul a havidíj, ha még nincs bevételem? (Lili)**
- Hol: 11. GYIK, „Miért nincs próbaidő? Mikor kell fizetni?” (604. sor).
- Régi vége: „… és csak utána fizetsz, bankkártyával.”
- Új vége: „… és csak utána fizetsz, bankkártyával. A havidíj az első fizetéstől jár, akkor is, ha még nincs bevételed.”
- Igaz? IGEN: ÁSZF 4/A.6 („A havidíjat a szerződés elfogadása és a kártyád megadása napjától fizeted”); a backend alapértéke
  `NEW_BUSINESS_CHARGE_POLICY=azonnal` (a szerver .env-jét nem néztem).

### BIZALOM

**9. „Európai szerveren” és a láblécben München (Gábor)**
- Hol: 8. szakasz, „Az adataid” (458. sor) és a GYIK „Hol vannak az adataim…” (600. sor).
- Régi: „Európai szerveren tároljuk őket, minden fájlt külön titkosítva.” Új: „Az Európai Unióban tároljuk őket (a szerverünk
  Németországban van), minden fájlt külön titkosítva.”
- GYIK régi: „Európai szerveren, titkosítva.” Új: „Az Európai Unióban, németországi szerveren, titkosítva.”
- Igaz? IGEN az adatkezelési tervezet szerint (2.17 és 3.1: Contabo GmbH, Németország, „Az adatok az Európai Unióban vannak”), de ott
  [ELLENŐRIZNI] jelölés áll. A München a cég székhelye. Nem ellentmondás, csak meg kell magyarázni.

**10. „A könyvelőd munkájáért a Somosi Kft. felel.” – mit jelent bírság esetén? (Gábor)**
- Hol: 7. „Ki könyvel neked?” (420. sor).
- Régi: „A szerződést a Somosi Kft.-vel kötöd. A könyvelőd munkájáért a Somosi Kft. felel.”
- Új: „A szerződést a Somosi Kft.-vel kötöd. A könyvelőd munkájáért is mi felelünk: ha a mi vagy a könyvelőd hibájából kell bírságot vagy
  pótlékot fizetned, a szerződés szerint megtérítjük.”
- Igaz? IGEN a tervezetek szerint: ÁSZF 9.1, Megbízási szerződés 7.2. A „szerződés szerint” azért kell, mert a felelősség felső határa
  (Megbízási 7.4) még nyitott, és a T3 („az iroda fizeti vagy megtéríti?”) sincs eldöntve. Teendő: [TULAJ/JOGÁSZ OK] kell, mert ez
  nyilvános felelősségvállalás. Felelősségbiztosítást NEM írunk (lásd 4. pont).

**11. „Gépen az app ma még telefonos elrendezésben nyílik meg.” félkésznek hat (szakember, Péter)**
- Hol: 6. bemutató alatti kis jegy (410. sor) és a hős aria-label.
- A mondat őszinteségi okból került ki 11-21-én, és igaz. Ha a k8 (gépes nézet) élesbe megy, a K8_TERV szerint visszaáll erre: „Az app
  képei bemutató adatokkal készültek.” Ez a végleges megoldás.
- Ha a k8 még nincs kint, és addig is javítanánk, átmeneti szöveg: „Az app képei bemutató adatokkal és az app új kinézetével készültek,
  amelyet most vezetünk be. Gépen ma még a telefonos elrendezés nyílik meg, ugyanazokkal a funkciókkal.”
- Igaz? IGEN, a webes app ugyanaz a program, és a 6. szakasz is ezt írja. Teendő: `meres.test.mjs` 156. sor a mostani mondatot keresi.

**12. Hogyan váltok a régi könyvelőmtől? (Anna)**
- Hol: 11. GYIK, új kérdés a „Katás vagyok” után.
- Új kérdés: „Most másik könyvelőm van. Hogyan váltok?”
- Új válasz: „Az appban megadod az eddigi könyvelődet, és szólsz neki, hogy váltasz. A könyvelőd megbeszéli veled, melyik negyedévtől viszi a
  könyvelésedet, és átkérjük az idei adatokat, hogy semmi ne maradjon ki, és semmit ne adjunk be kétszer. A régi meghatalmazást csak akkor
  vond vissza, ha a könyvelőd szól.”
- Igaz? IGEN, valós funkció: `bekotes.ts` `elozo_konyvelo` („Tőle kérjük át az idei adatokat…”) és `konyvelovaltas`, az ado-motor kezeli
  az előző könyvelő negyedéveit (`priorOverrides`). Teendő: a SPEC 29. sora [KÖNYVELŐ] jelölésű, Dávid nézze meg.

### MEGGYŐZÉS

**13. A záró felhívás ismétlésnek hat (Péter, Anna)**
- Hol: 12. Záró felhívás (628. sor).
- Régi: „Regisztrálj, és válaszolj pár kérdésre a vállalkozásodról.” (szinte szó szerint az „Így indul” 1. lépése)
- Új: „Kártya nélkül regisztrálsz. Fizetni akkor kell, amikor indul a könyvelésed.”
- Igaz? IGEN: ÁSZF 2.4 („a munkát az első sikeres fizetés után kezdjük”), K8_TERV (a kártya a visszahívás után jön).

## 3. Szakszavak – rövid, beépített magyarázat

Ott érdemes elhelyezni őket, ahol először előfordulnak: zárójelben, egy kis szürke sorban vagy egy „Mi ez?” buborékban. Mind igaz a
megadott forrás szerint. Az évszámos adatokat 2027-01-01 előtt frissíteni kell.

| Szó | Javasolt magyarázat (egy mondat) | Forrás / ellenőrzés |
|---|---|---|
| ONYA | A NAV online nyomtatványkitöltője (onya.nav.gov.hu), itt adod meg és itt vonod vissza a meghatalmazást. | `bekotes.ts` 1026., 1108.; ÁSZF 4/C |
| NAV-meghatalmazás | Ezzel a könyvelőd a nevedben beadhatja a bevallásaidat és intézheti az adóügyeidet a NAV-nál; bármikor visszavonhatod. | oldal 8. szakasz, ÁSZF |
| Ügyfélkapu+ | Az állami ügyintézés belépése: felhasználónév, jelszó és egy egyszer használatos kód. | `bekotes.ts` 363. |
| DÁP | Az állam telefonos alkalmazása, ezzel is beléphetsz az állami ügyeidbe. | `bekotes.ts` 363–365. |
| Átalányadó | Nem kell költségszámlákat gyűjtened: a bevételedből a törvény egy fix részt költségnek vesz, és csak a maradék után fizetsz adót és járulékot. | ado-motor 2026 (költséghányad) |
| Kata | Havi fix összeget fizetsz (2026-ban 50 000 Ft), ez kiváltja az szja-t, a tb-járulékot és a szochót; csak magánszemélyeknek számlázhatsz. | `KATA_RULES_REGI_2026`; oldal GYIK |
| Kata-keret | Katásként évente 18 millió Ft bevételig marad ennyi az adód; ami felette van, annak 40%-a különadó. | `yearlyLimitHuf`, `kulonadoPermille: 400` |
| Alanyi áfamentes | Nem számolsz fel áfát a számláidon, amíg a bevételed nem lépi át az évi 20 millió Ft-ot (2026); induláskor ezt választod. | `afaLimitHuf`, Áfa tv. 188. § |
| Szja-előleg | A jövedelemadód negyedéves része; az éves zárásnál elszámolunk vele. | ado-motor, TERV_EVES |
| Tb-járulék | A jövedelmed után fizeted, ebből jár a nyugdíjad és az egészségügyi ellátásod. | ado-motor (18,5%) |
| Szocho | Szociális hozzájárulási adó, ezt is a jövedelmed után fizeted. | ado-motor (13%) |
| Iparűzési adó (HIPA) | Helyi adó, amit a vállalkozásod után az önkormányzatnak fizetsz; évente egyszer vallod be. | oldal Árak, TERV_EVES |
| Éves zárás | Évente egyszer a könyvelőd elkészíti és beadja az előző év bevallásait, és kiszámolja, kell-e még fizetned, vagy visszajár. | TERV_EVES 7. pont |
| NAV Online Számla | A NAV rendszere, ahová a kiállított számláid maguktól beérkeznek; innen hozza be őket az app. | oldal 6. szakasz |
| Jogállás (fő-/mellékállás) | Mellékállású vagy, ha mellette legalább heti 36 órás munkaviszonyod van, vagy nappali tagozaton tanulsz; ettől függ, mennyi járulékot fizetsz. | SPEC 982. sor |
| Szünetelés | Egy időre bejelented, hogy nem dolgozol a vállalkozásodban; addig nem kell utána adóelőleget és járulékot fizetned. | memória 11-20 (szünetelés = biztosítási szünet) |
| Nyilvántartásba vett könyvelő | Engedéllyel dolgozó könyvelő, akit az állam nyilvántart; a nyilvántartási számát a szerződésedben látod. | oldal 7. szakasz (a nyilvántartó szervet nem írnám ki ellenőrzés nélkül) |

## 4. Elvetett javaslatok és miért

| Javaslat (ki) | Miért dobtuk el |
|---|---|
| Ügyfélvélemények, értékelések, esettanulmány, aktív ügyfélszám (szakember, Péter, Anna) | Kitalált lenne: még nincs ügyfél. Szabály: nincs kitalált vélemény vagy szám. Valódi vélemény majd a HIANYLISTA 2.24 szerint (NPS, hozzájárulással), a rejtett vélemény-sáv akkor kapcsolható be. |
| „A Somosi Kft. anyagi felelősséget vállal felelősségbiztosítással” (Gábor, szakember) | Kitalált tény: a felelősségbiztosítás nyitott (memória, Megbízási 7.4 [TULAJ/JOGI]). Helyette a 10. pont, a szerződés szerinti megtérítéssel. |
| Garantált válaszidő a könyvelői üzenetekre (Péter, szakember) | Szabályt sért: időígéret csak a 24–48 órás visszahívás mondata lehet. |
| Fotó a könyvelőről vagy a csapatról, „arcok a cég mögött” (Lili, szakember) | A tulaj 11-20-i döntése: könyvelő-fotó nem lesz, kitalált név sem. |
| Lebegő „Regisztrálok” sáv mobilon (szakember) | Téves: az élő oldalon a fejléc a Regisztrálok gombbal ragadós (`stilus.css` 132. sor, `position: sticky`), csak a képekhez állt helyben. |
| Kalkulátor, ami megmondja, kata vagy átalány éri-e meg (Lili) | Ütközik a szabállyal: ÁSZF 4/A („nem döntünk helyetted”), és a T/928 miatt az app nem javasol adózási módot, Dávid dönt. |
| Bérszámfejtés pontos ára (Gábor) | Nincs ár (K8_TERV: „ár még nincs”), kiírni kitalálás lenne. Az „egyedi ajánlat” igaz. |
| „A kontraszt mindenhol megfelel” (szakember) | Nem ellenőrzött állítás, nem javaslat. Nem vesszük biztosnak. |
| A zöld dobozok megtörik a palettát (szakember) | A tulaj 11-21-i kifejezett döntése a telt zöld; ízlésbeli megjegyzés. |
| A 8 lépéses bemutató rövidítése mobilon (Péter, Anna, szakember) | A tulaj kifejezetten kérte és jóváhagyta („csak akkor veszi meg, ha érti”). Csak tulajdöntésre változhat. |
| Az Összevetés „megismétli a díjakat” (szakember) | Az összehasonlító táblához kell az ár-sor. Egy rövid cella, nem ismétlés. |
| A meghatalmazás magyarázata négyszer szerepel (Gábor, Lili) | Részben jogos, de a GYIK-nek önmagában is érthetőnek kell lennie. A 2. pont után a „Röviden” kártya rövid és egyértelmű marad, ezért nem vágunk. |
| „kötelezettségmentes” (szakember szövegjavaslata) | Hivatalos, nehézkes szó. Helyette a saját szöveg: „nélküle is elindulhatsz” (1. pont). |
| „…az ONYA rendszerben adod meg Ügyfélkapuval” (Gábor szövegjavaslata) | Pontatlan: Ügyfélkapu+ vagy DÁP kell. Helyette a 8. szakasz már bevált formája (2. pont). |

## 5. Nem hamis, de üzleti döntés (a tulajé)

- **Telefonszám a regisztráció előtt** (Péter, Anna, Gábor). A tulaj 11-19-én döntött: telefonszám később. Most az e-mail és a visszahívás
  van.
- **Visszahívás regisztráció nélkül** (szakember, Gábor, Lili). Ez új funkció, és egy új adatkezelési cél is (nem ügyfél telefonszáma),
  ezért jogász kell hozzá. Addig az 1. pont szerinti őszinte felirat a megoldás.
- **Indulóknak a díj az adószám után induljon** (Lili: „bevétel nélkül sok a 19 999 Ft”). A kapcsoló már kész:
  `NEW_BUSINESS_CHARGE_POLICY=adoszam_utan`, és az app szövege hozzá: „…addig nem fizetsz”. A tulaj 11-19-én a díjmentes időszakot
  elvetette, és az ÁSZF 4/A.6 is a mostanit írja. Csak tulaj- és ÁSZF-döntéssel változhat.
- **Személyes találkozó** (Anna, Gábor). „Nincs, minden online megy”: ez igaz, marad.

## 6. Mielőtt a javítások kimennek

- **ÁSZF ↔ oldal ellentmondások (nem Gemini-lelet, de a 4. pont rájuk épül):**
  - az ÁSZF 4.1 szerint az éves bevallás a havidíj része, az oldal 14 999 Ft-os külön díjat ír, a díj a rendszerben KI;
  - az ÁSZF 3.1 szerint a szolgáltatás „nem KATA-s, és nincs alkalmazottja”, az oldal katásoknak is szól, és a bérszámfejtést felárért
    vállalja.

  Ezeket előbb a jogásznak vagy a tulajnak kell rendeznie (T1, HIANYLISTA 1.1, 1.11).
- **Tesztek, amelyek a mostani szöveget keresik:**
  - `kod/landing/meres.test.mjs` 156. sor (a „Gépen az app…” mondat, 11. pont);
  - `kod/landing/meres.test.mjs` 169. sor (a „Visszahívást kérek” felirat, 1. pont).

  A `build.mjs` 209. sora csak a linket nézi, az marad.
- **2027-01-01 előtti frissítés:** a 20 millió Ft-os áfahatár (5. pont és a szólista), a kata 50 000 Ft és 18 millió Ft (a T/928 sorsa
  szerint), és a K8_TERV-ben már felsorolt „helyetted” díjak és a GYIK „2026 végéig” mondata.
- A 10. pont (felelősség) és a 4.b „magad adod be” mondata csak tulaj/jogász OK után kerülhet ki.

## 7. Költség

0,0483 $ (5 hívás: 0,0091 + 0,0084 + 0,0090 + 0,0086 + 0,0132), a keret 0,08 $ volt. Az OpenRouter-kulcs keret-maradéka
7,83 $-ról 7,81 $-ra csökkent. Ez a szűrő kör nem hívott külső modellt.
