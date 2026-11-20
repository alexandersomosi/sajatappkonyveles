# Könyvelői lefedettség – mit lát ma a könyvelő, és mi hiányzik (2026-11-20)

Csak olvasás alapján készült, a kódot nem módosítottam. Minden útvonal a `C:/Users/UpgradePC/konyvelo_app/kod/` mappához képest értendő. Minden „hiányzik” állítást grep-pel vagy a fájl elolvasásával ellenőriztem. Ahol a korábbi felmérés tévedett, azt a táblázatban jelzem („JAVÍTVA”).

## 1. Mennyire teljes ma

A negyedéves átalányadós munkához a könyvelő **szinte mindent lát és meg is tud csinálni**. A teljes lánc megvan:

1. bevétel (NAV-szinkron és kézi tételek, a befolyás napja javítható)
2. számolás
3. levezetés
4. kézi módosítás indokkal
5. jóváhagyás és levél
6. befizetés-ellenőrzés
7. 2658-as bevallás rögzítése a NAV-nyugtával

Mellette megvan a dosszié, a kérések, az üzenetek, az igazolások, a kedvezmények, az éves zárás folyamata és a napló.

**Élesben két hiba van:**
- az iparűzésiadó-előleget (HIPA) nem lehet jóváhagyni a panelen;
- az éves SZJA- és HIPA-határidő soha nem lesz „kész”.

**Teljes évre egy könyvelő ma még nem vállalná.** Ehhez hiányzik:
- az éves különbözet mint fizetendő vagy visszajáró tétel;
- a NAV-folyószámla egyeztetése;
- az önellenőrzés;
- a helyettesítés;
- az ÁFA-teendők közösségi adószámos ügyfélnél;
- a KATA követése (kártya és befizetések);
- a havonkénti jogállás.

## 2. Táblázat

| Igény | Van-e | Hol | Megjegyzés |
|---|---|---|---|
| Csak a saját ügyfelei | igen | `backend/src/routes/acc.ts:108-112`, `services/people.ts:25-33` | Más ügyfélre 404-et kap. |
| Ügyféllista, állapotszűrők | igen | `panel/src/pages/acc/UgyfelLista.tsx:86-105`, `acc.ts:178-217` | Keresés csak névre és adószámra (`acc.ts:182`). |
| Olvasatlan üzenet a listában vagy gyűjtőnézetben | nincs | `acc.ts:266` csak az adatlapon; `/uzenetek` csak a csapatnak (`panel/src/App.tsx:139`) | Csak az adatlap fülének számlálója (`UgyfelAdatlap.tsx:45`) és az értesítés jelzi. |
| „Ma” oldal, napi teendők | nincs | kezdőlap `/ugyfelek` (`panel/src/lib/csapat.ts:308-313`) | Szétszórva: lista fejléce, menüszámlálók, Határidő-figyelő, napi e-mail. |
| Ügyféladatok, adóprofil, költséghányad | igen | `ugyfel/Attekintes.tsx:55-338`, `acc.ts:327-388` | – |
| Bekötés, KYC, NAV-kapcsolat | igen | `ugyfel/Bekotes.tsx`, `acc.ts:390-556` | A lakcímkártya hátoldalát a panel elrejti, de a szerver még visszaadja (`acc.ts:455`). |
| Bevétel befolyás szerint | igen | `ado-motor/src/engine/year.ts:96`; javítás `ugyfel/NavSzamlak.tsx:152` | **JAVÍTVA:** a becsült befolyási nap tételesen javítható. A motor figyelmeztet is a becsült tételekre (`year.ts:540-545`). |
| Bevételi nyilvántartás CSV | igen | `acc.ts:1422-1439` | – |
| Bejövő számlák | nincs (szándékos) | `services/navsync.ts:1` | Átalányadónál nem kell. |
| Bankkivonat | részben | Dosszié irattípus | Csak iratként tárolja, tételes feldolgozás nincs. |
| Negyedéves számolás és jóváhagyás | igen | `ugyfel/Ado.tsx:179-317`, `acc.ts:1017-1030` | Bekötés alatt nem hagyhatja jóvá (`acc.ts:1001-1008`). |
| **HIPA-előleg jóváhagyása** | **nincs (HIBA)** | szerver `acc.ts:1033-1046`; panel `api/endpoints.ts`-ben nincs hívás | A „Számolás most” 409-et ad (`services/tax.ts:222-223`), és egy nem létező kártyára küld. |
| Befizetés-ellenőrzés | részben | `acc.ts:1064-1075`, `Ado.tsx:637-779` | Csak kézi jelölés („rendben” vagy „eltérés”). |
| NAV-folyószámla egyeztetés | nincs | – | A „folyószámla” szó sehol nem szerepel a kódban. |
| 2658 beadása és rögzítése | igen | `acc.ts:1077-1108`, `Ado.tsx:937-966` | Az app nem ad be semmit, a könyvelő rögzíti a beadást. |
| Önellenőrzés | nincs | `services/tax.ts:420`, `Ado.tsx:966` | A beadott időszak zárolva marad, a hibaüzenet a NAV-ra utal. |
| Éves zárás folyamata | igen | `ugyfel/EvesZaras.tsx`, `services/eves-zaras.ts` | Kérdőív, díj, tervezet, ügyfél-jóváhagyás, SZJA-, majd HIPA-beadás. |
| Éves különbözet (SZJA/TB/szocho, HIPA) | nincs | `shared/src/enums.ts:163` (csak `negyedev` és `hipa`), `db/schema.ts:1697-1721` | Nincs összeg, nincs befizetendő tétel. A `hipa_kulonbozet` tételfajta létezik, de semmi nem használja. |
| **Éves SZJA- és HIPA-határidő „kész” állapota** | **nincs (HIBA)** | `services/flags.ts:117` és `:119` fixen `false` | A `filedSzjaAt` és `filedHipaAt` megvan (`schema.ts:1715-1716`), mégis 90 napig „lejárt” marad (`acc.ts:1336-1341`). |
| KATA havi határidők | igen | `flags.ts:122-139` | Csak a jövőbelieket mutatja. |
| KATA-befizetések követése | nincs | `flags.ts:123` (komment), `kata_teteles` csak címke (`panel/src/lib/labels.ts:174`) | – |
| '26KATA nyilatkozat határideje | részben | `eves-zaras.ts:79` | **JAVÍTVA:** az Éves zárás nézet mutatja. A határidőlistában és a Határidő-figyelőben nincs (`flags.ts:115`). |
| **KATA-kártya az adatlapon** | **nincs (HIBA)** | panel `ugyfel/K28Kartyak.tsx:54`; szerver `routes/acc-k28.ts:52-69` | A szerveren nincs `KataHomeView`-t előállító kód, csak a minta tölti ki (`panel/src/mock/k28.ts:1121`). |
| **Továbbító postafiók** | **nincs** | panel `K28Kartyak.tsx:72`; szerver: csak séma (`schema.ts:357-358, 1780`) | **JAVÍTVA:** nem csak az adat hiányzik a válaszból, a szerveroldali funkció egyáltalán nincs megírva. |
| ÁFA közösségi adószámnál | nincs | ígéret `shared/src/bekotes.ts:301`; ellentmondás `shared/src/k29f.ts:556` | Az `euPartner` választ csak a csapat panelje mutatja (`pages/csapat/Regisztracio.tsx`). Nincs se időszak, se határidő. |
| ÁFA- és átalánykeret-figyelés | igen | `ado-motor/src/engine/meters.ts`, `flags.ts:38`, értesítés `jobs.ts:111-115` | Átlépés esetén nincs teendőlista vagy kiléptetési folyamat. |
| Tevékenység, ÖVTJ | részben | `shared/src/bekotes.ts:657+` (35 sorból 35-nél `ovtjKod: null`), `acc.ts:342` (egy kód) | Nincs több ÖVTJ és fő tevékenység. |
| Jogállás | részben | `acc.ts:369-383` | Évente egy jogállás. Évközi váltáskor csak rendszerjegyzetet kap. |
| Helyettesítés | nincs | `acc.ts:108-112`; admin `services/konzol-muveletek.ts:332` | Csak végleges áthelyezés van. |
| Meghatalmazás | részben | `shared/src/enums.ts:109` | Csak a mód és a fájl van meg. Nincs terjedelem, érvényesség és visszavonás. |
| Kedvezmények | igen | `ugyfel/Kedvezmenyek.tsx`, `acc-k28.ts:97-137` | Dávid 2. és 3. kérdése még nyitott. |
| Igazolások | igen | `pages/acc/Igazolasok*.tsx`, `shared/src/k29f.ts:34` | Fajták: jövedelem, adó, KOMA, EV-kivonat, egyéb. |
| Illetőségigazolás | részben | `k29f.ts:34` (`egyeb`) | **JAVÍTVA:** az „egyéb” típuson át kérhető. Külön típus nincs. |
| NAV-levelek válaszhatáridővel | részben | `enums.ts:147` (`nav_level`), `services/documents.ts:308` | Csak iratként jelenik meg, határidő-követés nincs. |
| Négy szem | részben | `routes/team.ts:371-372`, `services/valtozas.ts:496-497` | Adó-jóváhagyásnál és beadásnál nincs (`acc.ts:1017, 1077`). |
| Változásbejelentések, Intézzük helyette | igen | `acc-k28.ts:345-415`, `pages/acc/HaviValtozasok.tsx` | – |
| Alkalmazott és EFO | részben | `services/alkalmazott.ts:1-4` | Csak a döntést rögzíti, bérszámfejtés és 08-as bevallás nincs. |
| Átvétel előző könyvelőtől | részben | `Attekintes.tsx:126-161`, `schema.ts:336` | Nincs előző évi HIPA, nyitó folyószámla-egyenleg és átadás-átvételi irat helye. |
| Dosszié: havi „átnézve” és irat új verziója | részben | szerver `acc.ts:631`, `:702` | A panelen nincs gomb (`endpoints.ts`-ben nincs hívás). |
| Értesítések | igen | `panel/src/layout/Ertesitesek.tsx` | Típus szerint nem szűrhető. Az `onboarding_task` értesítést sehol nem küldi a kód (`notify/notify.ts:101`). |
| Határidő-naptár (iCal) | részben | `services/naptar.ts:1` | Csak az ügyfélnek van, a könyvelőnek nincs. |
| 2658-kitöltő nézet sorszámokkal | nincs | `Ado.tsx:329-369` | Csak havi tábla van. |
| Önkormányzati HIPA-kulcsok és számlaszámok | nincs | `schema.ts:331` (`hqMunicipality`) | Kézzel kell beírni. |

## 3. Hiányok prioritás szerint

### Nélkülözhetetlen
1. **HIPA-előleg jóváhagyása (HIBA).**
   Javaslat: az `Ado.tsx`-be „Iparűzési adó” kártya kerüljön a `hipa` mező becslésével, összeg- és számlaszám-mezővel, és ez hívja a `POST /acc/tax-periods/:id/hipa-approve` végpontot. HIPA-időszakon a „Számolás most” gomb rejtve legyen.
2. **Az éves SZJA- és HIPA-határidő sosem kész (HIBA).**
   Javaslat: a `flags.ts:117/119` a `done` értéket az `annual_closings.filedSzjaAt` / `filedHipaAt` mezőből vegye.
3. **Éves különbözet.**
   Javaslat: új `eves` időszak-típus SZJA-, TB-, szocho- és HIPA-különbözet tételekkel (fizetendő vagy visszajáró), számlaszámmal, határidővel és ugyanazzal a befizetés-ellenőrzéssel, mint a negyedéveknél.
4. **NAV-folyószámla.**
   Javaslat: negyedévenkénti „folyószámla egyeztetve” rögzítés: dátum, hátralék vagy túlfizetés összege, kivonat-irat, megjegyzés. Az eltérés jelzésként jelenjen meg az ügyféllistán.
5. **Önellenőrzés.**
   Javaslat: a beadott negyedévhez „önellenőrzés” verzió tartozzon új számolással, a különbözet és a pótlék tételével, és az új bevallás és nyugta feltöltésével. A régi verzió megmarad.
6. **Helyettesítés.**
   Javaslat: az admin adhasson ideiglenes, lejárati dátumos helyettest egy könyvelő összes ügyfelére vagy egyes ügyfeleire. A helyettes olvashat és jóváhagyhat, minden lépése naplózva van.
7. **ÁFA közösségi adószámnál.**
   Javaslat: ha az `euPartner` = igen, az ügyfélnek legyenek ÁFA- és összesítőnyilatkozat-időszakai határidővel és irathellyel. A válasz a könyvelő adatlapján is jelenjen meg, és a megszűnés-útmutató szövege (`k29f.ts:556`) erre az esetre változzon.
8. **KATA-kártya és KATA-befizetések.**
   Javaslat: az `accDetailK28` töltse ki a `kata` mezőt (keret, havi tételek, különadó-kockázat). A havi 50 000 Ft `kata_teteles` fizetési tételként jelenjen meg, befizetés-jelöléssel és -ellenőrzéssel.
9. **Havonkénti jogállás.**
   Javaslat: a jogállás hónapokra bontva legyen megadható, és a motor havonta ezzel számoljon (a kieső időszak mintájára).
10. **Meghatalmazás terjedelme.**
    Javaslat: a meghatalmazásnál rögzíteni kell, mire szól (adónemek, HIPA), mettől érvényes, és visszavonták-e. Ehhez kell egy külön mező az önkormányzati meghatalmazásnak is.
11. **ÖVTJ-kódok.**
    Javaslat: töltsük ki a 35 tevékenység kódját (Dávid adja meg), és ügyfelenként több ÖVTJ is legyen megadható fő tevékenység jelöléssel.

### Fontos
1. **Olvasatlan üzenetek és „Ma” nézet.**
   Javaslat: „Olvasatlan” oszlop és szűrő az ügyféllistán, és egy „Ma” kezdőlap: lejárt vagy mai határidők, olvasatlan üzenetek, átnézendő iratok, jóváhagyásra váró negyedévek.
2. **Negyedéves zárási tábla.**
   Javaslat: egy oldal az összes ügyfélről, oszlopokkal: számolva, jóváhagyva, befizetve, ellenőrizve, beadva. Szűrhető a hiányzó lépésre.
3. **Négy szem az adónál.**
   Javaslat: kapcsolható szabály legyen, hogy a jóváhagyást vagy a beadást egy második könyvelő vagy az admin is átnézze (Dávid döntése kell hozzá).
4. **NAV-levelek követése.**
   Javaslat: a `nav_level` iratnál legyen válaszhatáridő és „megválaszolva” állapot, a határidő pedig kerüljön be a Határidő-figyelőbe.
5. **Keretátlépés.**
   Javaslat: átlépéskor nyíljon meg egy kiléptetési teendőlista: bejelentés, számlázó átállítása, ÁFA-alanyiság, 4 év kizárás, ügyfél-tájékoztatás.
6. **Dosszié: havi „átnézve” és új verzió.**
   Javaslat: a már meglévő `review` és `versions` végpontokhoz kell egy-egy gomb a `Dosszie.tsx`-ben.
7. **'26KATA nyilatkozat határideje.**
   Javaslat: a `flags.ts` katás évre adjon `ev:${y}:kata` határidősort (febr. 25.), amely a beadás után „kész” lesz.
8. **Továbbító postafiók.**
   Javaslat: írjuk meg a szerveroldalt (cím előállítása a `mailboxCode`-ból, beérkező levél feldolgozása, napló), vagy vegyük ki a kártyát a panelből.
9. **Átvétel előző könyvelőtől.**
   Javaslat: az átvételnél legyen rögzíthető az előző évi HIPA (ebből jön az előleg), a nyitó folyószámla-egyenleg, és legyen helye az átadás-átvételi iratnak.
10. **HIPA: több telephely és költözés.**
    Javaslat: az ügyfélhez lehessen több települést rögzíteni, mindegyiknél időszakkal, kulccsal és számlaszámmal.
11. **Alkalmazott és EFO.**
    Javaslat: amíg nincs bérszámfejtés, a „felárért vállalva” döntéshez legyen havi 08-as határidő és irathely.
12. **Illetőségigazolás.**
    Javaslat: legyen külön igazolástípus („Illetőségigazolás külföldi megrendelőnek”) díjjal.
13. **`onboarding_task` értesítés.**
    Javaslat: vagy küldjük ki (például a bekötés átnézhető lépéseinél), vagy töröljük a típust.

### Kényelmi
1. **2658-kitöltő nézet.** Javaslat: a nyomtatvány sorszámaival tükrözött nézet, másolható összegekkel.
2. **Önkormányzati tábla.** Javaslat: településenkénti HIPA-kulcsok és számlaszámok táblája automatikus kitöltéssel.
3. **Befolyás napja.** Javaslat: bank- vagy számlázóprogram-adatból (például Billingo) jöjjön a pontos befolyási nap a becslés helyett.
4. **Nyugták.** Javaslat: a pénztárgép napi összesítője automatikusan érkezzen be.
5. **Csoportos műveletek és naptár.** Javaslat: csoportos „Számolás most” a kijelölt ügyfelekre, és saját iCal határidő-naptár a könyvelőnek.
6. **Keresés és értesítések.** Javaslat: a keresés terjedjen ki az e-mail-címre és a telefonszámra (`acc.ts:182`), az értesítések pedig legyenek szűrhetők típus szerint.
7. **Lakcímkártya hátoldala.** Javaslat: a szerver se adja vissza a könyvelőnek (`acc.ts:455`), ne csak a panel rejtse el.

## 4. Ellenőrizendő szakmai kérdések Dávidnak

**Még nyitott a `_munka/DAVID_KERDESEK.md`-ből:**
1. A félretenni-szabály.
2. Az utólag jóváhagyott családi járulékkedvezmény (a panel „Hatás” blokkja javítandó).
3. A magzat 91. napja; a költséghányad tevékenységváltásnál; a HIPA költözésnél.
4. A négy szem a változás lezárásánál.

**Új kérdések:**

5. Négy szem az adóban: kell-e második ellenőr a negyedéves jóváhagyáshoz vagy a beadáshoz?
6. Ki számolja és ki ellenőrzi az éves különbözetet (SZJA, TB, szocho, HIPA)? Legyen-e ez fizetési tétel az appban?
7. Mi a NAV-folyószámla egyeztetésének gyakorlata: milyen gyakran, és mit rögzítsünk?
8. A 35 tevékenység ÖVTJ-kódja (TEÁOR'25). A „Fotózás” valóban a 80%-os listán van-e (`bekotes.ts:661`)? A 80% csak akkor jár-e, ha az ügyfél kizárólag listás tevékenységet végez?
9. A nappali tagozatos tanuló helyesen fofoglalkozású-e a számolásban (`enums.ts:121` és `499-505`)?
10. Devizás számlánál melyik árfolyam a helyes az átalányadóhoz? Ma a számlán szereplőt használjuk (`adapters/nav-kliens.ts:48`).
11. Közösségi adószámos, alanyi mentes ügyfélnél melyik nyomtatvány kell (65-ös, A60), milyen gyakran, és mit vállalunk ebből?
12. Minden katásnak kell-e '26KATA nyilatkozatot adnia, vagy csak a keret felett?
13. Van-e még katás tételes HIPA 2026-ban?
14. Jók-e a HIPA-sávok (2,5 / 6 / 8,5 M Ft alap, `rules/2026.ts:76-80`), és hogyan kezeljük az első évet?
15. Mire szóljon a meghatalmazás 2026-ban (adónemek, HIPA-bevallás)? Kell-e külön önkormányzati meghatalmazás?
16. A 2658 M-lapjához kell-e TAJ-szám és születési adat, vagy az ONYA előtölti?
17. A szabályértékek egyszeri átnézése (`ado-motor/src/rules/2026.ts`):
    - költséghányad 45% (45. sor)
    - szocho-minimum 100% (a minimálbér vagy a garantált bérminimum 100%-a?) (42. sor)
    - adómentes rész 1 936 800 Ft (49. sor)
    - átalányadó-keret 38 736 000 Ft (55. sor)
    - ÁFA-határ 20 M Ft (58. sor)
    - nyomtatványok: 2658 és 26SZJA (68-69. sor)
    - a kétgyermekes anyák születési évhatára 1986 (101. sor)

**Ügyvédnek, nem Dávidnak:** beküldheti-e Dávid meghatalmazottként a változásbejelentést (`kod/jogi/UGYVED_KERDESEK_k5.md`).
