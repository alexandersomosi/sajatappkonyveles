# Éves ciklus és KATA – építési terv (2026-11-21)

**Mire szól:** az éves SZJA-bevallás, a különbözet (fizetendő vagy visszajáró), az önellenőrzés, a NAV-folyószámla egyeztetése, a katások havi befizetéseinek követése és a kata-keret. A tulaj 11-21-én jóváhagyta, az építés a marketing-telepítés után indul.
**Nem ide tartozik:** a felügyelet és a riasztás (Uptime Kuma, funkcióellenőrző): az a `_munka/TERV_FELUGYELET.md` dolga.
**Alapja:** a NAV-szabálykutatás és a kód-felmérés (11-21, a workflow két előző lépése), valamint `KONYVELO_LEFEDETTSEG.md`, `HIANYLISTA_2026-11-21.md` (1.8, 2.3), `DAVID_KERDESEK.md`, `k6/kata_2026.md` és SPEC §28.K.1, .3, .4, .11.
**SPEC:** az építő ebből a tervből írja meg a SPEC új szakaszát (§32, „Éves ciklus és KATA”).
**Útvonalak:** a `C:/Users/UpgradePC/konyvelo_app/kod/` mappához képest.

---

## 0. Röviden

1. **Négy fázis.**
   - **F1 (2026.12.07-ig):** KATA havi tételek, kata-keret, emlékeztetők, a kézi folyószámla-egyeztetés, HIPA-előzmény, az élő hibák (H1–H8) és **az összes adatbázis-változás**.
   - **F2 (2027.01.04-ig):** éves idővonal, a katás éves ág ('26KATA + különadó), az ügyféloldali összesítő váza.
   - **F3 (2027.03.01-ig):** az átalányos éves bevallás összegekkel, különbözet, visszajáró, éves HIPA, önellenőrzés, Éves áttekintő.
   - **F4 (feltételes):** NAV M2M adószámla-lekérdezés, 2027-es kata-összeg, részletfizetés, automatikus pótlék.
2. **Az app semmit nem ad be és nem utal.** A végleges összeget mindig a könyvelő írja be a bevallásból; a motor csak becsül és ellenőriz. Minden befizetési jelölés mellett ott áll: „Ez csak jelölés: pénzt nem vonunk le, nem utalunk.”
3. **Új időszakfajták a meglévő `tax_periods` + `tax_payment_items` rendszerben:** `kata`, `kata_eves`, `eves_szja`, `hipa_eves`, `onellenorzes`. Így a „Megjelölöm, hogy befizettem”, az ellenőrzés, a határidőlista és az emlékeztetők újrahasznosíthatók.
4. **Két új tábla:** `tax_corrections` (önellenőrzés) és `account_reconciliations` (folyószámla).
   - Az `annual_closings` összeg- és beadási mezőket kap.
   - Új enumértékek: 3 tételfajta, 1 iratkategória, 2 értesítésfajta.
   - Csak hozzáadó migráció, előtte pg_dump. Nem törlünk: ami fölösleges, rejtett vagy érvénytelenített lesz.
5. **Új közös fizetési lap az appban (`/fizetes/[id]`).** Minden befizetésre ugyanaz, a jóváhagyott 53_hataridok_b minta szerint: kedvezményezett, számlaszám, közlemény, összeg, „Másolom”, „Megjelölöm, hogy befizettem”. A Határidők sorai ide visznek.
6. **KATA havi tétel:**
   - a hónap kezdetén automatikusan jóváhagyott 50 000 Ft-os tétel, határidő a következő hónap 12-e (munkanapra tolva);
   - mentes hónap (táppénz, CSED, GYED, szünetelés) csak a könyvelő rögzítésével;
   - keret-sáv: 18 M Ft, illetve a tételes adóval érintett hónapok × 1,5 M Ft; jelzés 80 és 100 %-nál, és ha az előrejelzés túllépést mutat.
7. **Éves bevallás.**
   - A könyvelő beírja az összegeket: éves szja, elszámolt előlegek, csjk, egyéb sorok.
   - Az ügyfél egy összesítőt hagy jóvá: bevétel, adó, járulékok, eddig befizetett előlegek, különbözet, határidő, NAV-számla és közlemény. A jóváhagyás hash-e a számokat is lefedi.
   - Beadáskor rögzítendő: dátum, NAV-iktatószám, nyugta.
   - Ezután fizetési tétel (május 20.) vagy visszajáró-követés: a NAV a beérkezéstől 30 napon belül, de legkorábban március 1-jétől utal (Art. 64. § (1)).
8. **Önellenőrzés:**
   - az eredeti időszak érintetlen marad;
   - a könyvelő rögzíti az okot és az adónemenkénti különbözetet; az app pótlékot javasol, a végleges összeget a könyvelő hagyja jóvá;
   - az ügyfél jóváhagyja, utána beadás, majd fizetési tétel;
   - pótlék: a jegybanki alapkamat 1/365-e naponta, 3 tizedesre csonkítva, ismételt önellenőrzésnél másfélszeres (Art. 212. §).
9. **Folyószámla:**
   - Kézi rögzítés: dátum, adónemenkénti egyenleg (103, 406, 258, 288, 138, 215), az app által várt összeg, eltérés, teendő, következő ellenőrzés, kivonat.
   - Ebből egy mozdulattal ellenőrizhetők a jelölt befizetések.
   - Katásnál december közepén kötelező ellenőrzés, mert a 100 000 Ft feletti év végi tartozás megszünteti a katát (Kata tv. 5. § (1) e)).
10. **Díj:** az éves zárás 14 999 Ft-ja marad a meglévő úton: a kérdőív elküldésekor `fee_charges`, ügyfél-indította kártyás fizetés, 14 nap után zárolás. Önellenőrzési díj nincs.
    - **Előfeltétel:** az ÁSZF ellentmondásának jogi javítása. A 4.1 szerint az éves bevallás benne van a havidíjban, a 3.1 pedig kizárja a katásokat.
11. **Döntések:** 33 eldöntendő kérdés Dávidnak és 6 a tulajnak/jogásznak (9. fejezet). Ami bizonytalan, az első változatban kikapcsolva vagy csak a könyvelőnek látszik (10. fejezet).

---

## 1. Alapelvek és a tények, amelyekre a terv épül

### 1.1 Alapelvek (kötelezőek az építőnek)

- **Az app nem ad be és nem utal.** A bevallást Dávid adja be meghatalmazottként; a pénzt az ügyfél utalja. Az app jelöl, emlékeztet, ellenőrzést rögzít.
- **A végleges szám a könyvelőé.** A motor becsül (éves különbözet, kata-keret, pótlék); a panel mutatja az eltérést a könyvelő számától. Az ügyfél csak a könyvelő által jóváhagyott összeget látja véglegesként; a becslés mellett mindig „kb.” áll.
- **Nem törlünk** (tulaj-szabály). A fölösleges időszak rejtett lesz (`hidden_at`), a tétel érvénytelen (`voided_at`), a javítás pedig új sor (önellenőrzés) a régi mellett.
- **Csak hozzáadó migráció.** Előtte pg_dump, a minta szerint: `/srv/kezjegy/backups/pg_dump_elotte_<feladat>_<időbélyeg>.dump.gpg`. Az enumérték külön fájlba kerül, mint eddig (`ALTER TYPE … ADD VALUE IF NOT EXISTS`, és ugyanabban a futásban nem használjuk).
- **Szöveg csak a content rendszerből jön** (`content_texts`, alapértékek a `kod/shared`-ből).
  - Tegezünk, „a(z)” nincs: a `fill()` a helyőrző elé tett névelőt magától igazítja („a {honap}” → „az október”).
  - Nincs időígéret, csak törvényes határnap.
  - A könyvelő neve mindig `{firstName}`, sosem beégetve.
  - Az ügyfélszövegben „szja” kisbetűvel, mondat elején „Szja”; a főoldal kisbetűs; az ÁFA nagybetűs (`dizajn/C5_v2/SZOVEG_JAVITASOK.md` 42–46. sor).
- **A bizonytalan rész kapcsoló mögé kerül** (5.9), és az első változatban ki van kapcsolva vagy csak a könyvelőnek látszik.

### 1.2 Jogszabályi tények, amelyeket a kód használ

| Tény | Érték | Forrás |
|---|---|---|
| EV éves szja-bevallás 2026-ról | 26SZJA (a név a NAV mintájából következik), határidő és fizetés **2027.05.20.** | NAV 100. füzet 1., 4.; Szja tv. 12/C. § (4); NAV „2025-ben szerzett jövedelem bevallása” |
| Az EV bevallási tervezete | 2027.03.15-től érhető el; EV-nél **nem válik magától bevallássá** | Szja tv. 12/C. § (1), (7); NAV hír 2026.05.15. |
| TB és szocho átalányosnál | a negyedéves 2658-ban rendeződik, göngyölítve; az éves bevallásban nincs különbözetük | NAV 100. 6.1; NAV 3. II.5, III.4 |
| Szja-számla | 10032000-06056353, HU16 1003 2000 0605 6353 0000 0000, adónem 103 | NAV számlaszám-jegyzék (2026.11.01-től; a scratchpad `iban.txt` egyezik) |
| TB / szocho | 10032000-06055802 (406) / 10032000-06055912 (258) | ugyanott |
| KATA-számla | „NAV Kisadózó vállalkozások adója bevételi számla”, 10032000-01076349, HU27 1003 2000 0107 6349 0000 0000, adónem 288; a 40 %-os különadó is ide megy | ugyanott; NAV 99. füzet 4.1; 25KATA útmutató 5. |
| Késedelmi pótlék | 10032000-01076985, adónem 138 | ugyanott |
| Önellenőrzési pótlék, bírság | „NAV Bírság, mulasztási bírság és önellenőrzéssel kapcsolatos befizetések bevételi számla”, 10032000-01076301, adónem 215 | ugyanott |
| Visszajáró szja | a beérkezéstől számított **30 napon belül, de legkorábban az adóévet követő március 1-jétől** utalja a NAV; beszámíthat tartozásba | Art. 64. § (1) (szó szerint ellenőrizve az njt-szövegben); 64. § (4) |
| Részletfizetés | a bevallásban kérhető 12 havi részletfizetés EV-re **nem** vonatkozik; az EV-nek automatikus részletfizetés jár (≤ 2 M Ft, ≤ 12 hó, évente egyszer) | Art. 199. § (1)–(2) |
| Önellenőrzés | ellenőrzés előtt; csak 1000 Ft feletti helyesbítés; az eredeti nyomtatványon „O” jellel; a különbözet és a pótlék a beadással egyidejűleg esedékes; az adózó javára szóló javításnál nincs pótlék | Art. 54–57. §; 2658 útmutató 7. pont |
| Önellenőrzési pótlék | naponta az aznap érvényes jegybanki alapkamat 1/365-e; a napi mérték 3 tizedesre, a többit elhagyva; ismételt önellenőrzésnél az összeg másfélszerese; ha az adót eredetileg hiánytalanul megfizette, az 5000 Ft feletti részt nem kell megfizetni; ha a későbbi bevallásban már pótolta, legfeljebb a két bevallás közti késedelmi pótlék | Art. 212. § (1), (1a), (1b), (2), (3); 209. § (2) (szó szerint ellenőrizve) |
| Jegybanki alapkamat | 5,5 % 2026.08.26-tól → önellenőrzési pótlék 0,015 %/nap, késedelmi 0,028 %/nap | mnb.hu (a NAV-kutatás szerint); a korábbi kamatokat nem gyűjtöttük → 5.3 |
| Elévülés | 5 év a bevallási év végétől (26SZJA: 2032.12.31.) | Art. 202. § (1) |
| KATA | csak főfoglalkozású; 50 000 Ft minden megkezdett hónapra, határidő a következő hónap 12-e; nincs havi bevallás | Kata tv. 7. § (1)–(3); NAV 99. 1., 4.1 |
| KATA-keret | 18 M Ft, nem teljes évben a tételes adóval érintett hónapok × 1,5 M Ft; felette 40 % különadó, határidő február 25. (megszűnésnél 30 nap) | Kata tv. 7. § (4)–(6); NAV 99. 4.2 |
| Éves kata-nyilatkozat | **minden** katásnak, február 25-ig (2026-ról: '26KATA, 2027.02.25.) | Kata tv. 10. §; NAV 99. 6. |
| Mentes hónapok | egész hónapos táppénz, CSED, GYED, GYES, GYET, ápolási díj, tartalékos szolgálat, fogvatartás, szünetelés; ha bevétel volt, mégis fizetni kell; 30 napos szabály a záró hónapra; bejelentés a következő hónap 12-éig (szünetelésnél nem kell) | Kata tv. 7. § (8)–(10) |
| Kifizetőtől kapott bevétel | a kata a bevétel előtti nappal megszűnik; 15 napon belül bejelentendő | Kata tv. 5. § (1) g); NAV 99. 3. |
| Év végi tartozás | ha december 31-én a végrehajtható nettó adótartozás > 100 000 Ft, megszűnik a kata | Kata tv. 5. § (1) e) |
| 2027-es kata | a T/928 egységes javaslata (11.20.) szerint a régi katásnak 75 000 Ft/hó; **még nincs kihirdetve** | parlament.hu T/928/9 |
| HIPA sávos | ≤ 25 M Ft bevételnél 2,5 / 6 / 8,5 M Ft alap; előleg = az előző évi adó, május 31-éig; éves adó a következő év május 31-éig; bevallás csak, ha több az előlegnél, vagy visszatérítést kér; az első évben nincs előleg | Htv. 39/A. § (2), (7)–(9); 41. § (4) b) |
| HIPA általános | előleg március 15. és szeptember 15. (március 15. ünnep → a következő munkanap); bevallás május 31. | 25HIPAK útmutató |
| Munkarend 2026 | a december 12-i szombati munkanapot a 4/2026. (XI. 13.) SZCSM rendelet törölte → a novemberi kata határideje **2026.12.14. (hétfő)** | njt 10/2025. NGM r. 2. § c), hatályon kívül |
| NAV M2M adószámla-lekérdezés | 2025.10.06. óta él (összesített és tételes adószámla, köztartozás, hiányzó bevallás); a felhasználó a könyvelő, a saját API-kulcsával | NAV évkönyv 2025, 12. old.; github.com/nav-gov-hu/M2M (spec 1.3, 2026.11.12.) |

### 1.3 A korábbi anyagokban ezeket kell javítani

- **„Folyószámlára nincs API” (kód-felmérés 1.9, 4.3):** van (M2M), de az első változat kézi rögzítés; az M2M az F4-ben jön.
- **`flags.ts` komment („a '26KATA csak keret felett”):** téves, minden katás nyilatkozik.
- **`ado-motor/src/rules/holidays.ts`:** a 2026-12-12 még munkanapként szerepel. Ki kell venni a `MOVED_WORKING_DAYS[2026]`-ból, forrásmegjelöléssel.
- **„Visszajáró: legkorábban az esedékességtől” (NAV-kutatás 9.):** a pontos szabály „legkorábban március 1-jétől” (Art. 64. § (1)).

---

## 2. Fázisok

| Fázis | Határidő | Miért eddig | Tartalom |
|---|---|---|---|
| **F1 – most** | **2026.12.07.** A `jobNewYear` javítása legkésőbb 12.30-ig. | 12.08-án megy az első kata-emlékeztető (a novemberi katára, határidő 12.14.). A január 1-jei futás most a katásokat átalányra állítaná (H2). | Minden migráció (5.1). H1–H4, H6–H8 javítása. Munkanap-javítás. KATA havi tételek, mentes időszakok, fizetési lap, „Megjelölöm”, könyvelői ellenőrzés, emlékeztetők (8-án, 12-én, +1 nap). Kata-keret-sáv, figyelmeztetés, KataKártya élesítése. Kézi folyószámla-egyeztetés (a katások december közepi ellenőrzéséhez). HIPA-előzmény tárolása és a sávos előleg előtöltése. Átvétel: előző évi HIPA, nyitó egyenleg. |
| **F2 – éves zárás előkészítése** | **2027.01.04.** | 01.05-én nyílik az éves zárás; a katás kérdőív 02.05-ig, a '26KATA 02.25-ig. | Éves idővonal az appban. Az éves zárás katás ága: összesítő (bevétel, keret, túllépés, különadó), jóváhagyás, beadás iktatószámmal, `kata_eves` időszak a különadóval. A jóváhagyás hash-e a számokat is lefedi. Az `ev:y:kata` határidősor. Megszűnt vagy felfüggesztett ügyfél kezelése (T4). H8: `kesz` HIPA nélkül is. |
| **F3 – éves bevallás** | **2027.03.01.** (a NAV-tervezet 03.15-től) | 03.15-től dolgozik a könyvelő a 26SZJA-n; jóváhagyás 05.10-ig, beadás és fizetés 05.20-ig. | Átalányos összesítő és jóváhagyás. `eves_szja` időszak és különbözet-tétel. Visszajáró-követés. Éves HIPA-kártya, `hipa_eves` különbözet, a következő évi előleg előtöltése. Önellenőrzés (panel, app, pótlék-javaslat). Éves áttekintő oldal. Levélsablonok. |
| **F4 – feltételes** | Döntés után | Külső feltételtől függ. | NAV M2M adószámla-lekérdezés (Dávid regisztrációja kell). A 2027-es kata-összeg (T/928 kihirdetése). Részletfizetés-szöveg. A pótlék automatikus elfogadása. Csoportos lekérdezés importja. Vegyes év (átalány ↔ kata) automatikus számolása. |

**Ha az F1 csúszik:** a novemberi kata-emlékeztetőt Dávid küldi kézzel (Üzenetek), és a 2027.01.01-i `jobNewYear` előtt külön hotfixben kerül ki a H2 javítása.

---

## 3. Ügyfél (app)

### 3.1 Éves teendők idővonala – „Mikor mi jön” (F2)

- **Hol:** az `/eves-zaras` képernyő új szakasza a státuszkártya alatt. A főoldali éves kártyán egy sor: „Következő: {datum} – {mi}”.
- **Adat:** `GET /client/annual/timeline?year=` (5.5). A szerver a `deadlinesFor` + `annual_closings` + `tax_periods` adataiból építi. Soronként: `date`, `dateLabel`, `title`, `sub`, `who` (`te` | `konyvelo` | `nav`), `status` (`kesz` | `most` | `kovetkezik` | `lejart`), `link`.
- **Átalány, 2026-os adóév:**

| Dátum | Sor (content `eves.idovonal.*`) | Ki |
|---|---|---|
| jan. 5. | Megnyílik az éves zárás – „Pár kérdés az évedről, kb. 5 perc.” | te |
| jan. 12. | IV. negyedévi befizetés: szja-előleg, TB-járulék, szocho (nyugdíjasnál csak szja-előleg) | te |
| márc. 15. | Eddig töltsd ki az éves kérdőívet (`ANNUAL_RULES.questionnaireDue.atalany`) | te |
| márc. 15-től | {firstName} elkészíti a bevallásod tervezetét – „A NAV ekkortól adja ki a tervezetet.” | könyvelő |
| máj. 10. | Eddig hagyd jóvá a tervezetet [D2] | te |
| máj. 20. | Beadjuk az szja-bevallásodat; eddig kell befizetned a különbözetet, ha van | könyvelő + te |
| a beadás után | Ha adó jár vissza: a NAV utalja (3.5) | NAV |
| máj. 31. | Iparűzési adó: éves bevallás és különbözet; a következő évi előleg | könyvelő + te |

- **KATA:**

| Dátum | Sor | Ki |
|---|---|---|
| minden hónap 12-e | Havi kata: {osszeg} Ft (a határidő munkanapra tolva) | te |
| dec. 31. | „Ne maradjon 100 000 Ft-nál nagyobb adótartozásod, különben megszűnik a katád.” | te |
| jan. 5. | Megnyílik az éves zárás | te |
| febr. 5. | Eddig töltsd ki a kérdőívet | te |
| febr. 18. | Eddig hagyd jóvá a kata-nyilatkozatot [D2] | te |
| febr. 25. | Beadjuk a kata-nyilatkozatodat; ha túllépted a keretet, eddig kell befizetned a különadót | könyvelő + te |
| máj. 31. | Iparűzési adó | könyvelő + te |

- **Állapotcímkék:** „Kész”, „Most”, „Lejárt”; a jövőbeli sor csak dátum.

### 3.2 Közös fizetési lap `/fizetes/[id]` (F1)

- **Új képernyő:** `app/src/app/fizetes/[id].tsx`. Minden jóváhagyott fizetendő időszakra ugyanaz (negyedév, kata, éves szja, HIPA, önellenőrzés), a 53_hataridok_b minta szerint.
- **Adat:** a meglévő `GET /client/tax-periods/:id` (`TaxPeriodDetail.items`). Jelölés: a meglévő `POST /client/tax-periods/:id/mark-paid` és `unmark-paid`. A szerver ezeket minden új időszakfajtára engedi (5.4).
- **Tartalom:**
  - **Fejléc:**
    - cím: `fizetes.cim.<kind>` (pl. „Kata – november”, „Szja-különbözet 2026”);
    - alcím: „Utald el {hatarido}.” vagy „Lejárt: {datum} volt a határidő. Utald el minél előbb.”
    - Ha több tétel van: „{n} külön tétel, {n} számlára.”
  - **Tételenként:**
    - Összeg (Másolom), Kedvezményezett, Számlaszám (Másolom), Közlemény (Másolom).
    - A közlemény az ügyfél adószáma, a meglévő `reference`; [D22].
    - Másolás után: „Kimásoltuk”.
  - **Alul:**
    - fő gomb: „Megjelölöm, hogy befizettem”, alatta: „Ez csak jelölés: pénzt nem vonunk le, nem utalunk.” Megnyomásra dátumválasztó (alapérték: ma), a meglévő `markPaid` szabályaival.
    - Jelölés után: „Befizetted, {firstName} ellenőrzi.” + szöveglink: „Mégsem fizettem be”.
    - Ellenőrzés után: „Rendben: {firstName} látta a befizetésedet.” Ilyenkor nincs gomb.
    - Eltérésnél: „{firstName} eltérést talált. Nézd meg az üzenetét.” + gomb: „Megnyitom az üzenetet”.
  - **Mentes kata-hónap:** „Erre a hónapra nem kell katát fizetned ({ok}).” Nincs tétel, nincs gomb.
  - **Ha a tétel még nincs jóváhagyva** (2027-es kata összeg nélkül, 5.3): „Az összeget {firstName} még megerősíti.” Nincs számlaszám és nincs gomb.
- **Határidők** (`app/src/app/hataridok.tsx`): a befizetési sor a `Deadline.link`-re visz, ami jóváhagyott időszaknál `/fizetes/{periodId}` (5.6). A sorok szövege és állapota a meglévő marad („Befizetted, {fn} ellenőrzi”, „Lejárt”, „Kész”).
- **Főoldal:** a `ClientHome.paymentCard` (`PaymentCardView`, `shared/src/api.ts`) mostantól ki van töltve. Mindig a legkorábbi nyitott (`fizetendo` | `elteres`), jóváhagyott, nem utólag pótolt (`backfilled`) időszakot mutatja, bármilyen fajtájú. Koppintásra `/fizetes/{id}`.

### 3.3 Az éves bevallás jóváhagyása – átalány (F3; a katás változat F2-ben, 3.6)

- **Képernyő:** `app/src/app/eves-zaras/jovahagyas.tsx`, `jovahagyasra_var` állapotban. Az `/eves-zaras` gombja: „Átnézem és jóváhagyom”.
- **Adat:** az `AnnualView.summary` (5.5). A könyvelő írta be (4.1); az ügyfél csak a könyvelő számait látja.
- **Felépítés** (content `eves.osszesito.*`):
  1. **Fejléc:** „Nézd át a bevallásodat” · „Szja-bevallás {ev} (26SZJA)”.
  2. **„{firstName} üzenete”:** az `annual_closings.letter_text`, ha van.
  3. **„Bevételed és jövedelmed”:**
     - Bevétel – X Ft
     - Költséghányad ({pct}%) – −Y Ft
     - Jövedelem – Z Ft
     - Adómentes rész – −1 936 800 Ft (vagy kevesebb, ha a jövedelem kisebb)
     - Kedvezményeid – −K Ft (csak ha van)
     - Adóköteles jövedelem – T Ft
     - A sorok a motor éves eredményéből jönnek (`calculateYear` az év végével; 5.3), a könyvelő felülírhatja őket.
  4. **„Szja”:**
     - „Szja az évre (15%)” – A Ft
     - „Eddig befizetett szja-előleg” – −B Ft, lenyitható negyedévenként: „I. negyedév – 12 000 Ft ✓ ellenőrizve” / „jelölted” / „nincs jelölve”
     - egyéb sorok (pl. „Munkabéredből levont adó”), ha a könyvelő felvette
     - „Családi járulékkedvezmény elszámolása” – ±C Ft, ha van
  5. **Eredmény (nagy sor):**
     - „Fizetendő: {osszeg} Ft”, alatta: „Utald el {hatarido} a NAV szja-számlájára.”
     - vagy „Visszajár: {osszeg} Ft”, alatta: „A NAV utalja vissza a bankszámládra: {szamla}.” (maszkolva; ha nincs: „…arra a bankszámládra, amelyet a bevallásban megadunk.”)
     - vagy „Nincs különbözet”, alatta: „Az előlegeid pontosan kiadták az adódat.”
  6. **„Járulékok”** (tájékoztató):
     - „TB-járulék {ev}: T Ft” · „Szocho {ev}: S Ft”
     - „Ezeket negyedévente fizetted. Az éves bevallás nem változtat rajtuk.” [D3]
     - Nyugdíjasnál a blokk helyén: „Nyugdíjasként nem fizetsz TB-járulékot és szochót.”
  7. **„Iparűzési adó”** (csak ha a könyvelő már beírta, 4.2):
     - „Iparűzési adó {ev}: H Ft” · „Befizetett előleg: −E Ft” · „Különbözet: fizetendő F Ft {hipaHatarido}” vagy „visszajár”
     - „Ezt külön bevallásban adjuk be, és az önkormányzatnak fizeted.”
  8. **Utalási adatok** (csak fizetendőnél): Kedvezményezett, Számlaszám (Másolom), Közlemény (Másolom), Összeg (Másolom), majd: „A bevallás beadása után a Határidők között is megtalálod, ott jelölheted meg a befizetést.”
  9. **„Megnyitom a tervezetet”:** a PDF (meglévő `draft`).
  10. **Gombok:** fő gomb „Jóváhagyom a bevallást” → megerősítő lap: „Jóváhagyod? Ezzel engedélyezed, hogy {firstName} ezzel a tartalommal beadja a bevallásodat.” [Jóváhagyom] [Mégse]. Másodlagos: „Kérdésem van” (Üzenetek).
  11. **Lábléc:** „Az összegek a bevallás tervezetéből valók. Ezt adjuk be a NAV-hoz.”
- **Jóváhagyás:**
  - A meglévő `POST /client/annual/:id/approve { hash }` hash-e mostantól `sha256(docId + ':' + summaryHash)`, ahol a `summaryHash` a kanonikus JSON-összesítő sha256-ja.
  - Ha a könyvelő a jóváhagyás után bármit módosít, a jóváhagyás érvénytelen lesz (a meglévő 409 „A tervezet változott. Nyisd meg újra, és nézd át.”), és az ügyfél újra értesítést kap.
  - Mentés: az `annual_closings.approved_summary` jsonb mezőbe (pontosan, amit látott) + a meglévő hozzájárulási adatok.
- **Részletfizetés:** az első változatban nem ajánljuk fel [D9, T6]. Fizetendőnél egy sor: „Ha egyszerre nem tudod kifizetni, írj nekünk, mielőtt lejár a határidő.”

### 3.4 A különbözet befizetése (F3)

- **Mi történik beadáskor:** amikor a könyvelő rögzíti a beadást (4.1, „Beadtam”) és a különbözet > 0, a szerver létrehozza:
  - az `eves_szja` időszakot (`YYYY-SZJA`, határidő május 20. munkanapra tolva);
  - rajta egy `szja_kulonbozet` tételt (NAV szja-számla, közlemény: adószám);
  - ha a könyvelő felvett 12 %-os különbözeti bírságot, egy `egyeb_ado` tételt is a 215-ös számlára [D4].
- **Értesítés:** `annual_status.fizetendo` (6.3).
- **Ezután minden a meglévő úton megy:** Határidők sor („Szja-különbözet 2026: X Ft”), fizetési lap, „Megjelölöm”, a könyvelő ellenőrzése, emlékeztetők (7/3/1 nap előtte, a határnapon, +1 nap; 6.3).

### 3.5 Visszajáró (F3)

- **Az `/eves-zaras` kártyája beadás után:**
  - **Cím:** „Visszajár: {osszeg} Ft”.
  - **Szöveg:** „A NAV utalja vissza erre a bankszámládra: {szamla}. Ha {datum} után sem érkezett meg, írj nekünk.”
    - `{datum}` = `refund_expected_by` = `max(beadás napja, következő év 03-01)` + 30 nap. Ez óvatos becslés: Art. 64. § (1), és van benne tartalék a banki átfutásra.
  - **Gomb:** „Megjelölöm, hogy megérkezett” + „Ez csak jelölés.” → dátum és összeg (alapérték: a várt összeg).
  - **Utána:** „Megérkezett: {osszeg} Ft ({datum}).”
- **Ha a könyvelő rögzíti a folyószámla alapján:**
  - **Megérkezett:** ugyanez a szöveg, és értesítés: `annual_status.visszaerkezett`.
  - **Beszámítva:** „A NAV a visszajáró összeget egy másik adótartozásodba számította be. Nézd meg {firstName} üzenetét.”
  - **Átvezetve:** „A visszajáró összeget a NAV egy másik adódra vezette át.”
- **Ha a `refund_expected_by` elmúlt, és senki nem jelölte:** a könyvelő `tax_task.visszajaro_kesik` feladatot kap. Az ügyfél nem kap riasztást (a kártya szövege már mondja, mit tegyen).

### 3.6 Kata-nyilatkozat jóváhagyása és a különadó (F2)

- **Ugyanaz a képernyő, katás összesítővel** (`eves.osszesito.kata.*`):
  - „Bevétel {ev}” – X Ft (pénzforgalmi, a befolyás napja szerint);
  - „Kereted” – L Ft („{n} hónap × 1 500 000 Ft”, vagy 18 000 000 Ft);
  - „Befizetett havi kata” – n × 50 000 Ft (a hónapok állapota lenyitható: ✓ ellenőrizve / jelölted / nincs jelölve / mentes);
  - „Kereten felüli bevétel” – Ü Ft, ha van;
  - „Különadó (40%)” – Ü × 40 %.
- **Eredmény:**
  - különadóval: „Fizetendő különadó: {osszeg} Ft”, alatta: „Utald el {hatarido} a NAV kata-számlájára.”
  - különadó nélkül: „Nincs különadó” + „Nem léptél túl a kereteden.”
- **„Iparűzési adó” blokk:** mint 3.3/7.
- **Jóváhagyás:** „Jóváhagyom a nyilatkozatot”.
- **Beadás után** (4.1): a különadóhoz `kata_eves` időszak (`YYYY-KATA`, határidő február 25., év közbeni megszűnésnél kataTo + 30 nap [D25]) és egy `kata_kulonado` tétel a kata-számlára.

### 3.7 Önellenőrzés: értesítés és jóváhagyás (F3)

- **Értesítés:** `correction_status.jovahagyasra_var` vagy `…_javara` (6.3).
- **Képernyő** (`app/src/app/onellenorzes/[id].tsx`, content `onell.*`):
  - **Cím:** „Javítjuk egy beadott bevallásodat”.
  - **„Mit javítunk?”:** a bevallás neve („2026. III. negyedévi járulékbevallás (2658)”, „Szja-bevallás 2026”, „Kata-nyilatkozat 2026”, „Iparűzési adó 2026”).
  - **„Miért?”:** a könyvelő szövege (`reason`).
  - **Adónemenként:** „Szja – +12 000 Ft” / „TB-járulék – −3 000 Ft (a javadra)”.
  - **„Önellenőrzési pótlék”:** P Ft, alatta: „A késve bevallott adó után jár, naponta a jegybanki alapkamat 365-öd része.”
    - Ha az iroda fizeti [T3]: „A pótlékot mi álljuk.”
    - Ha 0: a sor nem látszik.
  - **„Összesen fizetendő”:** a különbözetek összege + pótlék, alatta: „A beadással egy időben esedékes. Az utalási adatokat a beadás után a Határidők között látod.”
    - A javadra szóló javításnál: „A javadra javítunk: {osszeg} Ft. Ezt a NAV a folyószámládon írja jóvá; {firstName} figyeli.”
  - **Gombok:** fő gomb „Jóváhagyom az önellenőrzést” (megerősítő lap, hash a tartalomra), másodlagos „Kérdésem van”.
- **Beadás után:** `onellenorzes` időszak a tételekkel (5.4), értesítés `correction_status.beadva_fizetendo` / `beadva_javara`, majd a 3.2 szerinti fizetés.
- **Jóváhagyás nélküli beadás:** csak a könyvelő rögzített telefonos egyeztetése után, ugyanúgy, mint az éves zárásnál [D13].

### 3.8 KATA havi tételek – Határidők és főoldal (F1)

- **Határidők:**
  - havonta egy sor, ha a hónap megkezdődött: „Kata – {honap}: {osszeg} Ft”, határidő a következő hónap 12-e (munkanapra tolva); 2026 novemberére **december 14.**;
  - koppintásra fizetési lap (3.2);
  - mentes hónap: „Kata – {honap}: nem kell fizetned ({ok})”, állapota kész;
  - az F1 előtti, utólag pótolt (`backfilled`) hónapok az ügyfélnek csak akkor látszanak, ha a könyvelő ellenőrizte őket (5.8).
- **Főoldal (katás nézet;** az `augmentHome` tölti, `client-k28.ts`):
  - a „Kata” hős helyett a fizetési kártya (3.2), ha van nyitott tétel; ha nincs: „Most nincs mit fizetned. A következő kata: {honap}, {hatarido}.”;
  - a két szám („Idei bevétel” és a keret-sáv), 3.9.
- **„Félretenni” katásnál** (ma 404, `client-k28.ts:97`): a SPEC §28.K.11 szövegével („Havonta 50 000 Ft a kata. Ha a kereted fölé mennél, a fölötti rész 40%-át is félre kell tenned.”), plusz a különadó-becslés sora, ha van túllépés, és a HIPA sora.

### 3.9 Kata-keret-sáv és figyelmeztetés (F1)

- **Adat:** a `KataHomeView` (`shared/src/api.ts`, ma senki nem tölti), három új mezővel: `projectedHuf`, `remainingHuf`, `projectedOverHuf`.
- **Megjelenés:**
  - Cím: „Idei kereted”.
  - Sáv: „{bevetel} / {keret} Ft” (a meglévő `kata.meter`); alatta: „Idén eddig a kereted {pct}%-át használtad.” (`kata.meter_line`).
  - Színek: zöld; borostyán ≥ 80 % (`KATA_RULES_2026.warnPct`); piros > 100 %.
  - Kis sor: „Kereted: {n} hónap × 1 500 000 Ft” (ha nem 12 hónap) vagy „Kereted: 18 000 000 Ft”.
  - „Még {maradek} Ft fér bele.” (ha < 100 %).
- **Figyelmeztető sor a sáv alatt:**
  - **80–100 %:** „Közel vagy a keretedhez. Ami fölé megy, annak 40%-át különadóként kell befizetned.”
  - **> 100 %:** „{tobblet} Ft-tal túlléptél a kereteden. Erre kb. {kulonado} Ft különadó jár, {hatarido} kell befizetni. Tegyél félre ennyit.”
  - **Az előrejelzés túllépést mutat (de még < 100 %):** „Ha így folytatod, év végére kb. {tobblet} Ft-tal mész a kereted fölé. Beszélj {firstNameWith}, mit tehetsz.”
    - Csak akkor jelenik meg, ha a motor előrejelzése megbízható (`projectionMinDays` = 60 nap adat).
- **Push és e-mail:** egyszer évente küszöbönként: `limit_warning.kata80`, `.kata100`, `.kata_elore`. A könyvelő `…_staff` változatot kap (6.3).
- **Számlánkénti sor** (a meglévő `kata.invoice_fits` / `invoice_over`) változatlan. A céges vevő figyelmeztetése (`kata_business_invoice`) is marad [D23].

### 3.10 Év végi kata-tartozás (F1)

- **Mikor és kinek:** december 16-án (vagy az utána következő munkanapon) push és e-mail `tax_due_soon.kata_ev_vege` (6.3), annak a katásnak, akinél
  - van le nem jelölt, lejárt kata-tétel, vagy
  - a legutóbbi folyószámla-egyeztetés (4.4) hátralékot mutat.
- A szöveg a törvényi szabályt mondja (100 000 Ft, december 31.), és ha ismert, a hátralék összegét.
- **Az első változatban csak a könyvelő által rögzített hátralékra megy ki** (10. fejezet), vagy le nem jelölt tételre.

---

## 4. Könyvelő (panel)

### 4.1 Éves zárás fül – munkafolyamat (F2 kata, F3 átalány)

**Fájl:** `panel/src/pages/acc/ugyfel/EvesZaras.tsx`.

- **A státuszok nem változnak** (`ANNUAL_STATUSES`, DB CHECK); a fül ezekre épül.
- **A `beadva` jelentése:** „beadva, a különbözet vagy a HIPA még rendezésre vár”.
- **A `kesz` most automatikus.** Akkor áll be, ha
  - az szja- vagy kata-bevallás be van adva, **és**
  - a különbözet rendezve van (befizetés ellenőrizve; visszajáró megérkezett, beszámítva vagy átvezetve; vagy nincs különbözet), **és**
  - a HIPA be van adva, vagy „nem kell” (H8).
- **A „Kész” kézzel is kimondható** („Lezárom az éves zárást”, indokkal), ha valami az appon kívül rendeződött.

**Lépések (kártyák a fülön, felülről lefelé):**

1. **Kérdőív és ellenőrzőlista:** a meglévő.
2. **„Összegek” kártya** (`konyvelonel` és `jovahagyasra_var` állapotban szerkeszthető).
   - **Átalány mezői:**
     - Bevétel, Jövedelem, Adóköteles jövedelem, Kedvezmények: előtöltve a motorból, felülírható (indok kötelező, ha eltér).
     - **Éves szja (A)**: kötelező.
     - **Elszámolt szja-előleg (B)**: előtöltve a jóváhagyott negyedéves `szja_eloleg` tételek összegével, negyedéves bontásban az ellenőrzés állapotával. Ha bármelyik negyedév nincs „rendben”, borostyán jelzés: „Előbb egyeztesd a folyószámlát (4.4).”
     - **Csjk elszámolása (C, ±)** és **12 %-os különbözeti bírság**: opcionális [D4].
     - **Egyéb sorok** (címke + ±összeg, legfeljebb 5): például a munkabérből levont adó, más jövedelem [D1].
     - **Különbözet** = A − B + C + Σ egyéb, számolt, nem írható.
     - **TB és szocho éves összege:** a negyedéves tételekből, csak tájékoztatás.
     - **Visszajáró módja:** `kiutalas` (alapérték) | `atvezetes` [D5].
     - **„{firstName} üzenete az ügyfélnek”:** szöveg, sablonból (6.6).
     - **Jelölőnégyzet (kötelező a továbblépéshez):** „Az összegek egyeznek a bevallás tervezetével.”
   - **Kata mezői:** bevétel (előtöltve a motorból), tételes adóval érintett hónapok (előtöltve), keret (számolt), különadó-alap és különadó (számolt, felülírható indokkal), üzenet, egyezés-jelölő.
   - **Motor-összevetés** (csak a panelen): „Az app becslése: különbözet kb. X Ft. Eltérés a te számodtól: Y Ft.” Ha |Y| > 1000 Ft, borostyán sor (nem tiltás).
3. **„Ügyfélnek jóváhagyásra” gomb** (a meglévő `draft` lépés).
   - Feltétel: van feltöltött tervezet-PDF és mentett összeg.
   - Az ügyfél értesítést kap (`annual_status.jovahagyasra_var`, meglévő).
   - Ha az ügyfél jóváhagyása után változik az összeg vagy a PDF, a jóváhagyás érvénytelen lesz.
4. **„Beadtam” kártya** (a meglévő `filed-szja` lépés, bővítve).
   - **Mezők:** beadás napja (kötelező, nem lehet jövőbeli), **NAV-iktatószám** (kötelező, szöveg, legfeljebb 40 karakter), bevallás-PDF (kötelező), NAV-visszaigazolás / nyugta (kötelező, `nav_visszaigazolas`).
   - **Jóváhagyás nélkül:** a meglévő szabály (csak rögzített telefonos egyeztetéssel, megjegyzés kötelező).
   - **A szerver ezt csinálja** (5.4):
     - különbözet > 0 → fizetési tétel;
     - különbözet < 0 → `refund_expected_by`;
     - = 0 → rendezve;
     - katánál különadó > 0 → `kata_kulonado` tétel.
5. **„Különbözet” kártya** (`beadva` után):
   - fizetendőnél a tétel állapota (jelölte / ellenőrizve) és a meglévő ellenőrzés gombjai („Rendben” / „Eltérés”);
   - visszajárónál: várható dátum, valamint „Megérkezett” (dátum, összeg), „Beszámítva”, „Átvezetve” (megjegyzéssel) gombok.
6. **„Iparűzési adó” kártya:** 4.2.
7. **„Önellenőrzés indítása” gomb** a beadás után (4.3).

### 4.2 Éves HIPA-kártya (F3; az előzmény mezői F1-ben)

- **Mezők:**
  - módszer (a profilból, csak olvasható);
  - **éves adó (H)**;
  - **befizetett előleg (E)**: előtöltve a jóváhagyott `hipa_eloleg` tételekből;
  - különbözet = H − E;
  - önkormányzati számlaszám (előtöltve);
  - **„Bevallás kell”**: sávosnál csak akkor, ha H > E, vagy visszatérítést kér (Htv. 39/A. § (8)); általános módszernél mindig;
  - „Nincs HIPA-kötelezettség” jelölő (H8).
- **„Beadtam a HIPA-bevallást”:** dátum, iktatószám, PDF, nyugta. Ha nem kell bevallás: „Nem kell bevallás, rögzítem az adót”.
- **Mentéskor a szerver:**
  - H − E > 0 → `hipa_eves` időszak (`YYYY-HIPA`, május 31. munkanapra tolva) és `hipa_kulonbozet` tétel az önkormányzati számlára;
  - beírja a **következő évi** profilba: `hipa_prior_year_huf = H`. Ebből töltődik elő a következő évi `HIPA-1` előleg-jóváhagyás összege (Htv. 39/A. § (9)) és a motor `hipa.priorYearHuf` bemenete (H7).
- **Az önkormányzati egyenleget az app nem követi** (a NAV-adószámlán nincs rajta) [D28].

### 4.3 Önellenőrzés rögzítése (F3)

- **Hol:**
  - az Adó fülön minden beadott időszaknál „Önellenőrzés” gomb (ma a `reopenPeriod` csak hibaüzenetet ad);
  - az Éves zárás fülön beadás után;
  - az ügyfél adatlapján egy „Önellenőrzések” lista.
- **Űrlap** (`panel/src/pages/acc/ugyfel/Onellenorzes.tsx`, oldalsó panel):
  - **Melyik bevallás:** kiválasztva (`form`: `2658` | `SZJA` | `KATA` | `HIPA` | `egyeb` + az időszak kulcsa).
  - **Sorszám:** számolt; ha 2 vagy több: „Ismételt önellenőrzés – a pótlék másfélszeres”.
  - **Ok (kategória):** `kesoi_irat` | `ugyfel_adat` | `konyvelo_hiba` | `nav_felhivas` | `egyeb`.
  - **„Miért?” szöveg:** ezt látja az ügyfél, legfeljebb 600 karakter.
  - **Belső megjegyzés.**
  - **Különbözetek:** adónemenként egy sor (adónem-választó: 103 szja, 406 TB, 258 szocho, 288 kata, HIPA (önkormányzat), egyéb + kód); összeg ± (+ = fizetendő, − = a javára); az eredeti esedékesség (előtöltve az időszakból).
  - **Pótlék:**
    - az app javaslata (5.3 `selfRevisionSurcharge`), alatta a levezetés: „100 000 Ft × 0,015%/nap × 200 nap = 3 000 Ft”;
    - a végleges összeg, felülírható (indok kötelező, ha eltér);
    - jelölők: „Az adót eredetileg hiánytalanul megfizette (5000 Ft-os felső határ)” (Art. 212. § (2)); „A következő bevallásban már pótolta” (Art. 212. § (3)) → ekkor a pótlék kézzel adandó meg;
    - „Ki fizeti a pótlékot?”: `ugyfel` (alapérték) | `iroda` [T3];
    - ha az időszak 2026.08.26. előtti napot is érint (nincs kamattábla), nincs javaslat: „Írd be a NAV pótlékkalkulátorából.”
  - **ONELLB-bejelentés napja:** opcionális.
  - **„Ügyfél-jóváhagyást kérek”:** alapérték igen [D13].
- **Ellenőrzések:**
  - ha minden különbözet |összeg| ≤ 1000 Ft: tiltás, „1000 Ft-ig nem önellenőrzés: elég a következő bevallásban javítani.” (Art. 56. § (3)) [D11];
  - az időszak legyen beadva (`filingStatus = 'beadva'`, vagy az éves zárás `beadva` / `kesz`).
- **Gombok:** „Mentés tervezetként” · „Ügyfélnek jóváhagyásra” · „Beadtam” (dátum, iktatószám, PDF, nyugta – kötelező) · „Visszavonom” (indokkal; nem törlés).
- **Beadáskor a szerver:**
  - `onellenorzes` időszak a fizetendő különbözetekkel + `onellenorzesi_potlek` tétel (215-ös számla), ha a pótlékot az ügyfél fizeti és > 0;
  - határidő: a beadás napja;
  - a javára szóló sorok nem lesznek tételek: a folyószámlán követjük (4.4).
- **Az eredeti időszak és a számolása érintetlen.** Az időszak sorában jelvény: „Önellenőrizve (1×)”.
- **A motor jelzése** („a lezárt negyedév bevétele változott”, `year.ts`) a panelen két gombot kap:
  - „Átviszem a következő negyedévbe” (a meglévő viselkedés; Art. 212. § (3) miatt ez is lehet jogszerű);
  - „Önellenőrzést indítok”.
  - A döntés a könyvelőé [D11].

### 4.4 NAV-folyószámla egyeztetése (F1)

- **Hol:** új fül az ügyfél adatlapján, „Folyószámla” (`panel/src/pages/acc/ugyfel/Folyoszamla.tsx`, route `/ugyfelek/:id/folyoszamla`). A lista az eddigi egyeztetéseket mutatja: dátum, állapot, összesített egyenleg, ki rögzítette.
- **„Új egyeztetés” űrlap:**
  - **A lekérdezés napja** (`as_of`, alapérték: ma) és opcionálisan az „időszak vége”.
  - **Egyenleg adónemenként** (táblázat).
    - **Sorok:** 103 Szja, 406 TB-járulék, 258 Szocho, 288 Kata (csak katásnál), 138 Késedelmi pótlék, 215 Bírság / önellenőrzési pótlék, és „+ Egyéb adónem” (kód + név) [D16].
    - **Oszlopai:**
      - NAV-egyenleg: + tartozás / − túlfizetés;
      - Könyvelésre váró befizetés (opcionális);
      - **App szerint várható**: a jóváhagyott, `as_of`-ig esedékes, nem érvénytelen tételek közül a „nincs jelölve” és a „jelölve, nem ellenőrizve” összege, külön oszlopban;
      - **Eltérés**: számolt.
  - **Állapot** (javaslat az eltérésből, átírható): `rendben` | `hatralek` | `tulfizetes` | `elteres`.
  - **„Ezeket a befizetéseket a folyószámlán láttam”:** jelölőlista az `as_of`-ig esedékes, még nem ellenőrzött tételekről (kata-hónapok, negyedévek, különbözetek), alapból bejelölve azok, amelyekhez az adónem egyenlege ≤ 0. Mentéskor ezek `verification = 'rendben'` állapotot kapnak (a meglévő `verifyPayment` útján, csoportosan), hivatkozással az egyeztetésre.
  - **Teendő:** `nincs` | `befizetes_kerve` | `atvezetes_kerve` (ATVUT17) | `kiutalas_kerve` | `eszrevetel` | `onellenorzes` (4.3-at nyitja). Megjegyzés.
  - **„Szólok az ügyfélnek”** (opcionális):
    - hátraléknál üzenet a meglévő Üzenetek szálba (sablon: 6.6), és ha a teendő `befizetes_kerve`, egy kérés (`requests`) határidővel;
    - automatikus ügyfélértesítés nincs.
  - **Kivonat:** PDF feltöltése, új kategória: `adoszamla_kivonat`, láthatóság: `csak_konyvelo`, a könyvelő átállíthatja.
  - **Következő ellenőrzés:** dátum, alapértéke a szabály szerint [D15]:
    - átalánynál a következő negyedéves határidő + 7 munkanap; május 20. után + 7 munkanap;
    - katásnál a következő hónap 12-e + 5 munkanap; novemberben december 15.;
    - visszajárónál a `refund_expected_by` + 1 nap.
- **Hatások:**
  - ügyféljelző: `folyoszamla_elteres`, ha a legutóbbi egyeztetés `hatralek` vagy `elteres`, és nincs rendezve;
  - a „Következő ellenőrzés” megjelenik a Határidő-figyelőben (5.6);
  - lejáratkor `tax_task.folyoszamla` értesítés megy.
- **Átvétel előző könyvelőtől** (`Attekintes.tsx`): az átvétel lépésénél az első egyeztetés „nyitó egyenleg” jelöléssel rögzíthető (`kind = 'nyito'`).

### 4.5 KATA havi befizetések, mentes időszakok, keret (F1)

- **Az Adó fül katás évben** (`Ado.tsx`, a `regime` alapján): nincs negyedéves kártya (H1). Helyette:
  - **„Kata {ev}” táblázat**, havonta egy sor:
    - hónap; állapot („Fizetendő”, „Mentes – táppénz”, „Nem katás hónap”);
    - határidő, összeg;
    - **ügyfél jelölte** (dátum); **ellenőrzés** („Rendben” / „Eltérés” gomb, a meglévő `verify-payment`); folyószámla-hivatkozás.
  - **Csoportos művelet:** kijelölt sorok → „Rendben (folyószámla alapján)” (4.4 szerint, vagy egyeztetés nélkül, megjegyzéssel).
  - **„Mentes időszak hozzáadása”:**
    - mezők: kezdet, vég, ok (`tappenz` | `csed` | `gyed` | `gyes` | `gyet` | `apolasi_dij` | `tartalekos` | `fogvatartott` | `szunetel`), „bejelentve” dátum (a–c okoknál; szünetelésnél nem kell);
    - ez a `client_tax_profiles.insurance_breaks` jsonb-be kerül (új `kind`-okkal, 5.2);
    - mentés után a motor újraszámolja a hónapokat (5.3), a szerver a tételeket hozzáigazítja (5.4).
    - Ha egy már jelölt vagy ellenőrzött tétel mentes lett: piros sor: „Befizette, de mentes hónap: túlfizetés. Rendezd a folyószámlán.” A tétel nem lesz érvénytelen.
  - **Bejelentési határidő:** az a–c okú mentes hónapoknál a könyvelő feladatsort kap: „Mentesség bejelentése: {honap} – {ügyfél}”, határidő a következő hónap 12-e, a Határidő-figyelőben, amíg a „bejelentve” üres [D20].
  - **Bevétel mentes hónapban:** borostyán sor: „{honap}: bevétel volt, ezért mégis fizetni kell (Kata tv. 7. § (8)).” A motor ezt fizetendőnek számolja.
- **KataKártya élesítése** (`K28Kartyak.tsx`, `acc-k28.ts` `accDetailK28`):
  - a szerver kitölti a `kata` mezőt: keret, használt, %, előrejelzés, különadó-becslés, tételes adóval érintett hónapok, céges vevő jelzései;
  - a 2027-es tételekhez, ha az összeg nincs megerősítve: „A 2027-es havi összeg nincs megerősítve (T/928).” (5.3).
- **Adózási mód váltása** (`acc-k28.ts`, a regime-beállítás) után a szerver azonnal futtatja a `syncKataPeriods`-t és az `ensurePeriods`-t (5.4).

### 4.6 Áttekintők (F1 alap, F3 teljes)

- **Új oldal: „Éves áttekintő”** (`panel/src/pages/acc/EvesAttekinto.tsx`, route `/eves-attekinto`, a könyvelőnek a saját ügyfeleire, az adminnak mindenkire, csak olvasva; menüpont a Határidő-figyelő alatt).
  - **Évválasztó.** Ügyfelenként egy sor.

| Oszlop | Tartalom |
|---|---|
| Ügyfél | név, adózási mód chip (Átalány / Kata), jelzők |
| Negyedévek / Kata | átalány: Q1–Q4 kis jelek (számolva / jóváhagyva / befizetve / ellenőrizve / beadva); kata: „10/11 rendben, 1 hiányzik” |
| Folyószámla | utolsó egyeztetés dátuma + állapot, következő ellenőrzés (pirossal, ha lejárt) |
| Éves zárás | státusz (`ANNUAL_STATUSES` címkével), labda (`ANNUAL_BALL`: „ügyfélre vár” / „rád vár”) |
| Különbözet | ± összeg, rendezve-jel (befizetve / ellenőrizve / visszaérkezett) |
| HIPA | előleg (jóváhagyva / befizetve), éves (beadva / nem kell) |
| Önellenőrzés | nyitott önellenőrzések száma |

  - **Szűrők:** „Hiányzik valami”, „Rám vár”, „Ügyfélre vár”, „Lejárt”, „Kata”, „Átalány”.
  - **CSV-export** (a meglévő export mintájára).
  - **Teljesítmény:** egy összesítő lekérdezés (`GET /acc/overview/year`, 5.5); ügyfelenként nem futtatunk teljes évszámolást (a HIANYLISTA 3.x lassúság-pontja).
- **Határidő-figyelő** (`HataridoFigyelo.tsx`, a `clientDeadlines` könyvelői nézetéből): automatikusan megkapja az új sorokat (5.6): kata-hónapok `lejárt` állapottal, '26KATA, különbözet, önellenőrzés, folyószámla-ellenőrzés, mentesség bejelentése.
- **Ügyféllista:** új jelzők és szűrők: `folyoszamla_elteres`, `onellenorzes_nyitott`. A `hatar_kozel` katásnál a kata-keretből jön (H6), a `kata_figyelem` céges vevőnél vagy túllépésnél.

### 4.7 Az Adó fül egyéb változásai (F1)

- **A regime-et figyelembe veszi:** katás évben nincs negyedév-jóváhagyás (H1), a szerver is tiltja (409: „Katás évben nincs átalányos negyedév.”).
- **Vegyes év** (`kataFrom` > jan. 1. vagy `kataTo` < dec. 31.):
  - csak a nem katás hónapokat érintő negyedévek látszanak, „Vegyes év: számold kézzel” jelzéssel;
  - a motor-becslés ezekre nem jelenik meg [D27].
- **HIPA-előleg kártya** (k7b): a jóváhagyás összegmezője előtöltve a `hipa_prior_year_huf`-ból, felirattal: „Előző évi adó (Htv. 39/A. § (9))”.

---

## 5. Adatmodell, adómotor, backend

### 5.1 Migrációk (F1-ben mind; a sorszám a következő szabad, a terv írásakor 0022/0023)

**`backend/drizzle/0022_ev_ciklus_enumok.sql`** (csak enumérték; ebben a futásban nem használjuk):

```sql
ALTER TYPE "public"."payment_item_kind" ADD VALUE IF NOT EXISTS 'szja_kulonbozet';--> statement-breakpoint
ALTER TYPE "public"."payment_item_kind" ADD VALUE IF NOT EXISTS 'onellenorzesi_potlek';--> statement-breakpoint
ALTER TYPE "public"."payment_item_kind" ADD VALUE IF NOT EXISTS 'egyeb_ado';--> statement-breakpoint
ALTER TYPE "public"."document_category" ADD VALUE IF NOT EXISTS 'adoszamla_kivonat';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'correction_status';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE IF NOT EXISTS 'tax_task';
```

**`backend/drizzle/0023_ev_ciklus.sql`** (hozzáadó):

```sql
-- tax_periods: új fajták (a kind text, CHECK nincs), rejtés, mentesség, utólagos pótlás
ALTER TABLE tax_periods ADD COLUMN IF NOT EXISTS hidden_at timestamptz;
ALTER TABLE tax_periods ADD COLUMN IF NOT EXISTS hidden_reason text;            -- 'kata_ev' | 'vegyes_ev' | …
ALTER TABLE tax_periods ADD COLUMN IF NOT EXISTS exempt_reason text;            -- kata: tappenz|csed|gyed|gyes|gyet|apolasi_dij|tartalekos|fogvatartott|szunetel
ALTER TABLE tax_periods ADD COLUMN IF NOT EXISTS backfilled boolean NOT NULL DEFAULT false;
ALTER TABLE tax_periods ADD COLUMN IF NOT EXISTS filing_ref text;               -- NAV-iktatószám
ALTER TABLE tax_periods ADD COLUMN IF NOT EXISTS correction_id uuid;            -- 'onellenorzes' fajtánál a tax_corrections sor

-- tax_payment_items: adónem (folyószámla-párosítás), melyik egyeztetés ellenőrizte
ALTER TABLE tax_payment_items ADD COLUMN IF NOT EXISTS adonem text;             -- '103','406','258','288','138','215', HIPA: null
ALTER TABLE tax_payment_items ADD COLUMN IF NOT EXISTS reconciliation_id uuid;

-- client_tax_profiles: előző évi HIPA (sávos előleg alapja)
ALTER TABLE client_tax_profiles ADD COLUMN IF NOT EXISTS hipa_prior_year_huf integer;
ALTER TABLE client_tax_profiles ADD COLUMN IF NOT EXISTS hipa_prior_year_source text;  -- 'eves_zaras' | 'atvetel' | 'kezi'

-- annual_closings: összegek, beadás, különbözet, visszajáró (státusz-CHECK változatlan)
ALTER TABLE annual_closings
  ADD COLUMN IF NOT EXISTS amounts jsonb,                 -- a 4.1 űrlap (zod: annualAmountsSchema), az összes beírt sor
  ADD COLUMN IF NOT EXISTS amounts_set_by uuid,
  ADD COLUMN IF NOT EXISTS amounts_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS engine_estimate jsonb,         -- a motor becslése a mentés pillanatában
  ADD COLUMN IF NOT EXISTS letter_text text,
  ADD COLUMN IF NOT EXISTS approved_summary jsonb,        -- amit az ügyfél jóváhagyott
  ADD COLUMN IF NOT EXISTS diff_huf integer,              -- + fizetendő / − visszajár (szja, ill. katánál a különadó)
  ADD COLUMN IF NOT EXISTS filed_szja_on date,
  ADD COLUMN IF NOT EXISTS szja_filing_ref text,
  ADD COLUMN IF NOT EXISTS szja_return_document_id uuid,
  ADD COLUMN IF NOT EXISTS szja_receipt_document_id uuid,
  ADD COLUMN IF NOT EXISTS settlement_period_id uuid,     -- eves_szja / kata_eves időszak
  ADD COLUMN IF NOT EXISTS refund_mode text,              -- 'kiutalas' | 'atvezetes'
  ADD COLUMN IF NOT EXISTS refund_expected_by date,
  ADD COLUMN IF NOT EXISTS refund_status text,            -- 'var' | 'megerkezett' | 'beszamitva' | 'atvezetve'
  ADD COLUMN IF NOT EXISTS refund_received_on date,
  ADD COLUMN IF NOT EXISTS refund_received_huf integer,
  ADD COLUMN IF NOT EXISTS refund_marked_by text,         -- 'ugyfel' | 'konyvelo'
  ADD COLUMN IF NOT EXISTS refund_note text,
  ADD COLUMN IF NOT EXISTS hipa_needed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS hipa_amounts jsonb,            -- {taxHuf, advancesHuf, returnNeeded, accountNumber}
  ADD COLUMN IF NOT EXISTS filed_hipa_on date,
  ADD COLUMN IF NOT EXISTS hipa_filing_ref text,
  ADD COLUMN IF NOT EXISTS hipa_return_document_id uuid,
  ADD COLUMN IF NOT EXISTS hipa_receipt_document_id uuid,
  ADD COLUMN IF NOT EXISTS hipa_period_id uuid,
  ADD COLUMN IF NOT EXISTS closed_manually_reason text;

-- önellenőrzés
CREATE TABLE IF NOT EXISTS tax_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  form text NOT NULL CHECK (form IN ('2658','SZJA','KATA','HIPA','egyeb')),
  form_label text NOT NULL,                     -- '2658', '26SZJA', '26KATA', '26HIPAK'
  subject_key text NOT NULL,                    -- '2026-Q3', '2026', '2026-KATA', '2026-HIPA'
  original_period_id uuid,                      -- tax_periods (negyedév, kata, hipa)
  annual_closing_id uuid,
  seq integer NOT NULL DEFAULT 1,               -- 2+ = ismételt
  status text NOT NULL DEFAULT 'tervezet' CHECK (status IN ('tervezet','ugyfelre_var','jovahagyva','beadva','rendezve','visszavonva')),
  cause text NOT NULL CHECK (cause IN ('kesoi_irat','ugyfel_adat','konyvelo_hiba','nav_felhivas','egyeb')),
  initiated_by text NOT NULL DEFAULT 'konyvelo' CHECK (initiated_by IN ('konyvelo','ugyfel','nav')),
  reason text NOT NULL,                         -- az ügyfél látja
  internal_note text,
  diffs jsonb NOT NULL DEFAULT '[]',            -- [{adonem, kind, label, amountHuf(±), originalDueDate}]
  potlek_suggested_huf integer,
  potlek_basis jsonb,                           -- {days, dailyRatePct, rows:[{from,to,ratePct}], repeated}
  potlek_huf integer NOT NULL DEFAULT 0,
  potlek_override_reason text,
  potlek_payer text NOT NULL DEFAULT 'ugyfel' CHECK (potlek_payer IN ('ugyfel','iroda')),
  potlek_cap_paid_in_full boolean NOT NULL DEFAULT false,   -- Art. 212. § (2)
  onellb_on date,
  needs_client_approval boolean NOT NULL DEFAULT true,
  approval_hash text, approved_at timestamptz, approved_by uuid, approved_summary jsonb,
  filed_on date, filing_ref text, return_document_id uuid, receipt_document_id uuid, filed_by uuid,
  payment_period_id uuid,                       -- az 'onellenorzes' fajtájú tax_periods sor
  cancelled_reason text,
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tax_corrections_client_idx ON tax_corrections (client_id, created_at DESC);

-- folyószámla
CREATE TABLE IF NOT EXISTS account_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id),
  kind text NOT NULL DEFAULT 'rendes' CHECK (kind IN ('rendes','nyito')),
  source text NOT NULL DEFAULT 'kezi' CHECK (source IN ('kezi','m2m')),
  as_of date NOT NULL,
  period_end date,
  balances jsonb NOT NULL,                      -- [{adonem, label, balanceHuf(±), pendingHuf, expectedUnmarkedHuf, expectedMarkedHuf, diffHuf}]
  total_debt_huf integer NOT NULL DEFAULT 0,
  total_overpayment_huf integer NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('rendben','hatralek','tulfizetes','elteres')),
  follow_up text NOT NULL DEFAULT 'nincs' CHECK (follow_up IN ('nincs','befizetes_kerve','atvezetes_kerve','kiutalas_kerve','eszrevetel','onellenorzes')),
  follow_up_note text,
  resolved_at timestamptz, resolved_by uuid,
  verified_item_ids uuid[] NOT NULL DEFAULT '{}',
  document_id uuid,
  correction_id uuid,
  request_id uuid,
  note text,
  next_check_on date,
  checked_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_reconciliations_client_idx ON account_reconciliations (client_id, as_of DESC);
CREATE INDEX IF NOT EXISTS account_reconciliations_next_idx ON account_reconciliations (next_check_on);
```

- Az audit-trigger (`0001_audit_trigger.sql` mintája) a két új táblára is kell.
- A drizzle-séma (`backend/src/db/schema.ts`) és a meta ugyanígy bővül.
- Előtte pg_dump, utána független ellenőrzés: a sorok száma, `\d` a táblákra.

### 5.2 Közös enumok és típusok (`kod/shared`)

- **`enums.ts`:**
  - `TAX_PERIOD_KINDS` = `['negyedev','hipa','kata','kata_eves','eves_szja','hipa_eves','onellenorzes']`;
  - `PAYMENT_ITEM_KINDS` + `'szja_kulonbozet','onellenorzesi_potlek','egyeb_ado'` (a 0022 sorrendjében);
  - `DOCUMENT_CATEGORIES` + `'adoszamla_kivonat'`;
  - `NOTIFICATION_KINDS` + `'correction_status','tax_task'`;
  - `CLIENT_FLAGS` + `'folyoszamla_elteres','onellenorzes_nyitott'` (jsonb, nem kell hozzá migráció).
- **`ANNUAL_RULES` bővítése:**
  - `approvalDue: { atalany: '05-10', kata: '02-18' }` [D2];
  - `refundBufferDays: 30`;
  - `kataTerminationDays: 30` [D25].
- **Az `InsuranceBreak.kind` bővítése:** `'tappenz' | 'csed' | 'gyed' | 'gyes' | 'gyet' | 'apolasi_dij' | 'tartalekos' | 'fogvatartott'`, plusz opcionális `reportedOn?: string`.
  - Átalánynál ezek „kieső időként” számítanak, mint ma a `kieso`; ezt [D3/D27] erősítse meg, addig az átalány-motor a régi `kieso`-ként kezeli őket.
- **`NAV_ADONEMEK`:** `{ '103': 'Szja', '406': 'TB-járulék', '258': 'Szocho', '288': 'Kata', '138': 'Késedelmi pótlék', '215': 'Bírság, önellenőrzési pótlék' }` + `ADONEM_BY_ITEM_KIND`:
  - `tb_jarulek` → 406, `szocho` → 258, `szja_eloleg` / `szja_kulonbozet` → 103;
  - `kata_teteles` / `kata_kulonado` → 288; `onellenorzesi_potlek` → 215;
  - `hipa_*` → null.
- **Új szövegfájl:** `shared/src/eves.ts`. Benne a szövegkonstansok (6. fejezet), az `EVES_KAPCSOLOK` alapértékei (5.9) és az `annualAmountsSchema` mezőlistája.
- **DTO-k** (`shared/src/api.ts`, „SPEC §32” blokk):
  - `AnnualSummary`, `AnnualSettlementView`, `AnnualTimelineItem`;
  - `TaxCorrectionView`, `AccTaxCorrection`, `ReconciliationView`;
  - `KataYearView` (havi sorok), `YearOverviewRow`;
  - a `KataHomeView` + `projectedHuf`, `remainingHuf`, `projectedOverHuf`;
  - az `AnnualView` + `summary`, `settlement`, `hipa`, `timelineNext`.

### 5.3 Adómotor (`ado-motor/src`; az `engineVersion` minor verziója nő)

**Szabályok:**

- **`rules/types.ts`:** új `KataRules`:
  - `monthlyHuf: number | null`, `limitPerMonthHuf`, `yearlyLimitHuf`, `kulonadoPermille` (400), `dueDay` (12);
  - `exemptMinDays` (30), `reportDays` (15), `debtLimitHuf` (100 000);
  - `declarationDue` (MonthDay 02-25), `declarationForm`, `terminationDays` (30);
  - `account: NavAccount`, `adonem: '288'`, `draft: boolean`.
  - A `TaxRules` megkapja: `kata?: KataRules`, `accounts.kata`, `accounts.kesedelmiPotlek`, `accounts.onellenorzes`.
- **`rules/2026.ts`:** a `kata` blokk a 1.2 értékeivel, forrásokkal (`katv`, `nav-99`, `nav-iban`), és a három új számla (IBAN-teszttel).
- **`rules/2027.ts`:** `kata: { ...RULES_2026.kata, monthlyHuf: null, draft: true }`, megjegyzéssel: „T/928 nincs kihirdetve; 75 000 Ft (régi kata) vagy 50 000 Ft – Dávid erősíti meg” [D24].
  - Amíg `null`: a szerver a 2027-es kata-időszakot összeg nélkül, `becsles` állapotban hozza létre (3.2), és nincs emlékeztető.
- **`rules/base-rates.ts`** (új): a jegybanki alapkamat dátumtáblája: `[{ from: '2026-08-26', pct: 5.5 }]`, forrás: mnb.hu.
  - A korábbi időszakokra nincs adat, ezért a pótlék-javaslat `null` (4.3).
  - Új kamatdöntésnél a táblát kézzel bővítjük. A felügyeleti terv figyelheti.
- **`rules/holidays.ts`:** a `2026-12-12` sor törlése a `MOVED_WORKING_DAYS[2026]`-ból, a megjegyzésben a 4/2026. (XI. 13.) SZCSM rendelettel (njt). [D32]

**Új számolófüggvények:**

- **`engine/kata.ts`:**
  - `kataMonths({ year, kataFrom, kataTo, breaks, revenue }, rules)` → `KataMonth[]`: `{ month, liable, exemptReason?, revenueInMonthHuf, amountHuf | null, dueDate }`.
    - Minden megkezdett hónap után fizetni kell (7. § (2)).
    - Egész hónapos mentesség (7. § (8)); szünetelésnél csak az egész hónap számít.
    - A 30 napos szabály a záró hónapra (7. § (9)): az állapot napjai a nem mentes hónapokban együtt ≥ 30.
    - Ha a mentes hónapban bevétel volt, mégis fizetendő.
    - Határidő: a következő hónap 12-e, `nextWorkingDay`.
  - `kataLimitMeter(months, revenue, asOf, rules)` → `{ usedHuf, limitHuf, liableMonthsSoFar, assumedFutureMonths, projectedHuf, ratio, level, remainingHuf, overHuf, projectedOverHuf, kulonadoEstimateHuf, kulonadoDue }`.
    - A keret = (az eddigi adóköteles hónapok + a `kataTo`-ig hátralévő hónapok, adókötelesnek feltételezve) × 1,5 M Ft, legfeljebb 18 M Ft.
    - A bevétel pénzforgalmi: `receivedOn`.
    - Az előrejelzés napi arányosítással, mint az átalánymérőnél, a `projectionMinDays` szabállyal.
  - `kataDeadlines(year, profile, rules)`: a havi határidők, a `YYYY-KATA` 02-25 (vagy `kataTo` + 30), és a mentességek bejelentési határideje.
  - A `calculateYear` katás profilnál nem számol negyedévet, hanem `{ kata: { months, meter }, hipa }`-t ad. A HIPA-becslés a kata-előrejelzésből számol (Htv. 52. § 22. h); a `hipa.ts` változatlan).
- **`engine/annual.ts`:** `annualSzjaEstimate(yearResult, approvedQuarters)` → `{ incomeHuf, taxFreeUsedHuf, allowancesHuf, taxableHuf, szjaTaxHuf, advancesHuf, byQuarter[], diffHuf (±), csjkPotentialHuf, tbYearHuf, szochoYearHuf }`.
  - A `reserve.ts` `yearEndSettlement` mostantól erre épül; előjeles különbözetet is ad (ma csak a visszajárót).
  - Csak becslés, a panel-összevetéshez és az összesítő bevétel-soraihoz.
- **`engine/potlek.ts`:**
  - `selfRevisionSurcharge({ amountHuf, from, to, repeated, rates })` → `{ huf | null, days, rows }`:
    - a napi mérték az aznap érvényes kamat / 365, 3 tizedesre csonkítva (Art. 209. § (2));
    - a forint összeg kerekítése [D12; addig a NAV-kalkulátorral egyező tesztpélda dönt, `Math.round`];
    - ismételt önellenőrzésnél × 1,5;
    - `null`, ha valamelyik napra nincs kamat a táblában.
  - `lateSurcharge(...)` ugyanígy, +5 %-ponttal; csak tájékoztatásra a panelen [D7].
- **`calendar.ts`:**
  - `deadlinesFor(year, { hipaMethod, regime, kataFrom, kataTo })`: katás évben nincs Q1–Q4 és 26SZJA, helyettük a `kataDeadlines`;
  - `refundExpectedBy(filedOn, taxYear)` = `max(filedOn, (taxYear+1)-03-01) + 30 nap`.

**Tesztek:** `ado-motor/test/kata.test.ts`, `annual.test.ts`, `potlek.test.ts`, `calendar.test.ts`. Az esetek listája a 8.1-ben.

### 5.4 Backend szolgáltatások

**`services/tax.ts`:**

- **`ensurePeriods(db, clientId, year, hipaMethod, status, regime?)`:**
  - katás évben nem hoz létre `negyedev` időszakot;
  - a meglévő, nem jóváhagyott negyedéveket `hidden_at = now()`, `hidden_reason = 'kata_ev'` jelöléssel elrejti (H1);
  - a jóváhagyottakat nem rejti el, hanem panel-jelzést ad.
- A **`recalcYear`** és a **`calculatePeriod`** katás évben 409-et ad. Minden lekérdezés kiszűri a `hidden_at IS NOT NULL` sorokat (`acc.ts` tax-periods listája, `client.ts` tax-periods, `heroPeriod`, `clientDeadlines`, jobok).
- **`periodLabel` / `periodAdj`:**
  - `kata` → „2026. novemberi kata” / „novemberi kata”;
  - `kata_eves` → „2026. évi kata-különadó”;
  - `eves_szja` → „2026. évi szja-különbözet”;
  - `hipa_eves` → „2026. évi iparűzésiadó-különbözet”;
  - `onellenorzes` → „Önellenőrzés: {form_label} {subject}”.
- **`markPaid`, `unmarkPaid`, `verifyPayment`:** minden fajtára működnek; a `verifyPayment` értesítése fajta szerinti változatot kap (6.3: `kata`, `eves`, `onell`).
- **`filingCheck`:** az új fajtákra „Ehhez nincs külön bevallás ezen a lapon” (az éves bevallást az Éves zárás fül rögzíti).
- **`reopenPeriod`:** a beadott időszakra a hibaüzenet mellé gomb kerül: „Önellenőrzést indítok”.
- **Közös segéd** (az `approveHipaManual` mintájára): `createManualPeriod(db, { clientId, kind, periodKey, year, dueDate, items[], filed?, correctionId? })`. Létrehozza a `jovahagyva` időszakot a tételekkel (`adonem` kitöltve), és értesít.

**`services/kata.ts`** (új):

- **`syncKataPeriods(deps, db, clientId, year)`** (idempotens):
  - a `kataMonths` szerint minden megkezdett hónapra `kata` időszak (`YYYY-MM-KATA`): `calcStatus 'jovahagyva'`, határidő, tétel a kata-számlára (`adonem '288'`, `reference` = adószám);
  - mentes hónap: `paymentStatus 'nincs_fizetendo'`, `exempt_reason`; a jelöletlen tétel érvénytelen lesz, a jelöltet meghagyja, és panel-jelzést ad (4.5);
  - `monthlyHuf = null` esetén `becsles`, tétel nélkül;
  - nem katás hónap (`kataFrom` előtt, `kataTo` után): nincs sor.
- **`kataView`** (ügyfél) és **`accKataView`** (panel): hónapok, mérő, céges vevő jelzései. Ezek töltik a `KataHomeView`-t és a `KataKartya`-t.
- **`setKataBreaks`:** a mentes időszakok mentése az `insurance_breaks`-be, majd `syncKataPeriods`.

**`services/eves-zaras.ts`** (bővítés):

- **`saveAnnualAmounts`:**
  - zod: `annualAmountsSchema`;
  - csak `konyvelonel` / `jovahagyasra_var` állapotban;
  - ha `jovahagyasra_var`-ban változik: `approvedAt = null`, `approvalHash = null`, az ügyfél értesítést kap;
  - elmenti az `engine_estimate`-et.
- **`annualStep('draft')`:** csak akkor engedi, ha van összeg és egyezés-jelölő.
- **`annualSummary`:** a kanonikus összesítő (3.3, 3.6), és **`draftHash(docId, summaryHash)`**.
- **`annualStep('filed-szja')`:**
  - kötelező: `filedOn`, `filingRef`, a két irat;
  - kiírja a `filed_szja_on`, `szja_filing_ref`, `szja_*_document_id` mezőket;
  - az eredménytől függően:
    - különbözet > 0 → `createManualPeriod(eves_szja)` `szja_kulonbozet` tétellel (+ `egyeb_ado` bírság, ha van);
    - < 0 → `refund_expected_by`, `refund_status 'var'`;
    - katánál különadó > 0 → `kata_eves` időszak és `kata_kulonado` tétel;
  - az értesítés változata a 6.3 szerint.
- **`annualRefund`** (könyvelő vagy ügyfél): `megerkezett` | `beszamitva` | `atvezetve`, dátum, összeg, megjegyzés. Az ügyfél csak `megerkezett`-et jelölhet.
- **`saveAnnualHipa` és `annualStep('filed-hipa')`:**
  - nem kell bevallás és nincs különbözet → nem kell irat;
  - H − E > 0 → `hipa_eves` időszak;
  - a következő év profiljába beírja: `hipa_prior_year_huf`, `source 'eves_zaras'`.
- **`maybeCloseAnnual`:** a 4.1 szabálya szerint `beadva → kesz`. Lefut minden befizetés-ellenőrzés, visszajáró-rögzítés és HIPA-mentés után.
- **`jobAnnualOpen`:** a katás ág (változatlan), valamint `felfuggesztve` ügyfél [T4]. A `megszunt` ügyfél nem nyílik meg magától.
- **`approveAnnual`:** a `approved_summary`-t is menti.

**`services/onellenorzes.ts`** (új):

- `createCorrection`, `updateCorrection` (pótlék-javaslat: `selfRevisionSurcharge`), `sendCorrection` (→ `ugyfelre_var`), `approveCorrection` (ügyfél, hash), `fileCorrection` (→ `beadva`, `createManualPeriod(onellenorzes)`), `cancelCorrection`.
- **`maybeSettleCorrection`:** `beadva → rendezve`, ha minden tétel `rendben`, és nincs fizetendő.
- **Szabályok:** az 1000 Ft-os küszöb; csak beadott időszakra; a `seq` számolása a `(client, form, subject_key)` alapján.

**`services/folyoszamla.ts`** (új):

- **`expectedBalances(clientId, asOf)`:** adónemenként a jelöletlen, illetve a jelölt, de nem ellenőrzött tételek összege, a `tax_payment_items.adonem` alapján.
- **`saveReconciliation`** egy tranzakcióban:
  - csoportos ellenőrzés a meglévő `verifyPayment`-tel; `reconciliation_id` a tételeken;
  - ha `befizetes_kerve`: kérés (`requests`);
  - jelző, következő ellenőrzés.
- **`resolveReconciliation`:** „Rendezve” jelölés.
- **`nextCheckDefault(client)`:** 4.4.

**`services/flags.ts`:** 5.6 és a `computeFlags` (H6, új jelzők).

**`jobs.ts` `jobNewYear` (H2):**

- másolja a `regime`-et;
- másolja a `kataFrom`-ot, ha az új évben is él (különben `${year}-01-01`, ha katás maradt);
- másolja a `kataTo`-t, ha ≥ az új év első napja;
- `hipa_prior_year_huf`: üres, az éves HIPA-mentés tölti;
- az `ensurePeriods` megkapja a `status`-t és a `regime`-et (nyugdíjasnál ne legyen 2658);
- katásnál `syncKataPeriods`.

**`services/emlekezteto.ts`:** 5.7.

**`services/eves-zaras.ts` és `app/src/app/eves-zaras/index.tsx` (H8):**

- a beégetett „(Bence adja be)” helyett `${fn} adja be`;
- a `kesz` állapothoz nem kell HIPA, ha `hipa_needed = false`, vagy a profil `hipaMethod = 'nincs'`.

### 5.5 API (`/api/v1`)

**Ügyfél:**

| Módszer | Útvonal | Mit csinál | Fázis |
|---|---|---|---|
| GET | `/client/annual?year=` | meglévő; + `summary`, `settlement`, `hipa`, `timelineNext` | F2/F3 |
| GET | `/client/annual/timeline?year=` | 3.1 | F2 |
| POST | `/client/annual/:id/approve` `{hash}` | meglévő; a hash a számokat is lefedi | F2 |
| POST | `/client/annual/:id/refund-received` `{receivedOn, amountHuf}` | 3.5 | F3 |
| GET | `/client/tax-periods/:id` | meglévő; minden fajtára | F1 |
| POST | `/client/tax-periods/:id/mark-paid`, `/unmark-paid` | meglévő; minden fajtára | F1 |
| GET | `/client/kata?year=` | `KataYearView` (hónapok + mérő) | F1 |
| GET | `/client/corrections`, `/client/corrections/:id` | 3.7 | F3 |
| POST | `/client/corrections/:id/approve` `{hash}` | 3.7 | F3 |

**Könyvelő (a saját ügyfelére; más ügyfélre 404, a meglévő `acc.ts` szabály szerint):**

| Módszer | Útvonal | Mit csinál | Fázis |
|---|---|---|---|
| PUT | `/acc/clients/:id/annual/:aid/amounts` | 4.1/2 | F2 |
| POST | `/acc/clients/:id/annual/:aid/draft` | meglévő; + feltétel | F2 |
| POST | `/acc/clients/:id/annual/:aid/filed-szja` | meglévő; + `filedOn`, `filingRef`, iratok | F2 |
| POST | `/acc/clients/:id/annual/:aid/refund` | 4.1/5 | F3 |
| PUT | `/acc/clients/:id/annual/:aid/hipa` | 4.2 | F3 |
| POST | `/acc/clients/:id/annual/:aid/filed-hipa` | meglévő; + mezők | F3 |
| POST | `/acc/clients/:id/annual/:aid/close` `{reason}` | kézi lezárás | F2 |
| GET | `/acc/clients/:id/kata?year=` | 4.5 | F1 |
| PUT | `/acc/clients/:id/kata/breaks` | mentes időszakok | F1 |
| POST | `/acc/clients/:id/kata/verify` `{periodIds[], verification, note}` | csoportos ellenőrzés | F1 |
| GET / POST | `/acc/clients/:id/reconciliations` | 4.4 (multipart vagy `documentId`) | F1 |
| GET | `/acc/clients/:id/reconciliations/expected?asOf=` | előtöltés | F1 |
| POST | `/acc/reconciliations/:id/resolve` | rendezve | F1 |
| GET / POST | `/acc/clients/:id/corrections` | 4.3 | F3 |
| PUT | `/acc/corrections/:id` | 4.3 | F3 |
| POST | `/acc/corrections/:id/send` · `/filed` · `/cancel` | 4.3 | F3 |
| GET | `/acc/corrections/potlek?amountHuf&from&to&repeated` | javaslat | F3 |
| GET | `/acc/overview/year?year=&filter=` | 4.6 | F1 (alap) / F3 |
| GET | `/admin/overview/year?year=&accountantId=` | 4.6, csak olvasás | F3 |

- **Minden író végpont:** audit (`annual.amounts_saved`, `annual.refund`, `kata.breaks_saved`, `kata.verified`, `correction.*`, `reconciliation.saved`), zod `strictObject`.
- **Zárolt ügyfélnél** (`service_lock`): a könyvelő rögzíthet, az ügyfél jelölhet befizetést. Az éves zárás lépései a meglévő zárolási szabályt követik.

### 5.6 Határidők generálása (`services/flags.ts` `clientDeadlines`)

**Közös szabályok:**

- **Kimarad:**
  - a `hidden_at`-os időszak;
  - a `backfilled` időszak az ügyfélnek, amíg nincs ellenőrizve;
  - a `serviceStart` előtti időszak (meglévő szabály).
- **Link:** a jóváhagyott, fizetendő időszak befizetési sora `/fizetes/{id}`-ra visz.

**Sorok:**

| Id | Fajta | Cím (ügyfél / könyvelő) | Kész, ha |
|---|---|---|---|
| `per:<id>:befizetes` (kata) | befizetes | „Kata – {honap}: {osszeg} Ft”; mentes: „Kata – {honap}: nem kell fizetned ({ok})” | jelölve vagy ellenőrizve (a meglévő `paid` szabály); mentes: mindig |
| `kata-bej:<clientId>:<YYYY-MM>` (csak könyvelő) | egyeb | „Mentesség bejelentése: {honap}” | van `reportedOn` |
| `ev:<y>:kata` | bevallas | „Kata-nyilatkozat ('{yy}KATA) – a könyvelőd adja be / te adod be” | `filed_szja_at` (a katás ág ezt használja) |
| `per:<id>:befizetes` (kata_eves) | befizetes | „Kata-különadó {y}: {osszeg} Ft” | jelölve / ellenőrizve |
| `ev:<y>:szja` | bevallas | „Szja-bevallás ({form}) – a könyvelőd adja be” | `filed_szja_at` (az ügyfélnek is azonnal: a különbözet már külön sor) |
| `per:<id>:befizetes` (eves_szja) | befizetes | „Szja-különbözet {y}: {osszeg} Ft” | jelölve / ellenőrizve |
| `ev:<y>:hipa` | bevallas | meglévő; „kész”, ha `filed_hipa_at`, vagy `hipa_needed = false`, vagy nem kell bevallás | |
| `per:<id>:befizetes` (hipa_eves) | befizetes | „Iparűzési adó {y}: különbözet, {osszeg} Ft” | jelölve / ellenőrizve |
| `per:<id>:befizetes` (onellenorzes) | befizetes | „Önellenőrzés ({form_label}): {osszeg} Ft” | jelölve / ellenőrizve |
| `refund:<annualId>` | egyeb | „Visszajáró szja: {osszeg} Ft – a NAV utalja” | `refund_status` ≠ `var`; a könyvelőnek lejárt, ha `refund_expected_by` elmúlt |
| `fsz:<clientId>` (csak könyvelő) | egyeb | „NAV-folyószámla egyeztetése” | – (a dátum a `next_check_on`; egyeztetéskor újat kap) |

- **A régi kata-ciklus** (a `flags.ts` mostani katás része, `KATA_RULES_2026.monthlyHuf` minden évre, csak jövőbeli sorok) **megszűnik:** a valódi időszakok veszik át (H3). A komment javítandó (H4).

### 5.7 Jobok és emlékeztetők

| Job | Mikor | Mit csinál | Fázis |
|---|---|---|---|
| `kata_periods` (új, `services/kata.ts`) | naponta 03:10 + minden profilváltozás után | `syncKataPeriods` az aktív katás ügyfelekre, az idei és a tavalyi évre | F1 |
| `jobRemindersK28` bővítése (`emlekezteto.ts`) | naponta 08:00 | **Kata:** a hónap 8-án (vagy a következő munkanapon) `tax_due_soon.kata`, a határnapon `kata_ma`, +1 nappal `kata_lejart`, ha van jelöletlen tétel. Nem megy mentes hónapra, `becsles` állapotra, `backfilled` sorra és zárolt ügyfélnek, kivéve a fizetési szövegeket (meglévő elv). Kulcs: `rem:kata:<periodId>:<lépés>`. | F1 |
| `jobReminders` 7/3/1 nap (`jobs.ts`) | naponta | A `kata` fajtát kihagyja (ott a fenti ritmus él). Az `eves_szja`, `hipa_eves`, `kata_eves`, `onellenorzes` ugyanígy kap 7/3/1-et, `tax_due_soon` fajta szerinti változattal (`eves`, `hipa`, `kata_kulonado`, `onell`). | F1 (kódszabály) / F3 |
| `kata_ev_vege` | dec. 16. (vagy a következő munkanap) 09:00 | 3.10 ügyfél; `tax_task.kata_ev_vege` könyvelő, dec. 10-én minden katás ügyfélre, akinek nincs december 1. utáni egyeztetése | F1 |
| `account_checks` | naponta 07:30 | `tax_task.folyoszamla` annak a könyvelőnek, akinél egy ügyfél `next_check_on` ≤ ma, és nincs újabb egyeztetés (`notifyOnce` kulcs: `tt:fsz:<clientId>:<next_check_on>`) | F1 |
| `kata_limit` (a `jobReminders` korlát-része mellé) | naponta | `limit_warning.kata80` / `kata100` / `kata_elore` évente egyszer küszöbönként (`limit:kata80:<year>` …), plusz a `…_staff` változat | F1 |
| `refund_watch` | naponta | `tax_task.visszajaro_kesik`, ha `refund_status = 'var'` és `refund_expected_by` < ma | F3 |
| `kata_exempt_report` | naponta | `tax_task.mentesseg_bejelentes` 3 nappal a 12-e előtt, ha nincs `reportedOn` | F1 |
| `jobNewYear` | jan. 1. | H2-javítás (5.4) | F1 (12.30-ig) |
| `jobAnnualOpen` | jan. 5. 09:00 | meglévő + `felfuggesztve` [T4] | F2 |
| `jobAnnualReminders` | naponta | meglévő; + jóváhagyási határidő (`approvalDue`) 7/3/1 nappal előtte, `annual_due.jovahagyas` változattal | F2 |

### 5.8 Egyszeri adatlépés (`system_state['data.ev_ciklus']`, idempotens, a worker indulásakor)

1. **H1:** a katás évek nem jóváhagyott `negyedev` időszakai: `hidden_at`, `hidden_reason 'kata_ev'`, audit `tax.period_hidden`.
   - Élesben ma 1 katás ügyfél van, 4 negyedévvel `becsles` állapotban; számolás marad, törlés nincs.
   - Jóváhagyott katás negyedév esetén nem nyúl hozzá, hanem panel-feladatot ad.
2. **KATA-időszakok 2026-ra:** `syncKataPeriods`.
   - Az adatlépés napja előtt lejárt hónapok `backfilled = true` jelölést kapnak: nincs emlékeztető, az ügyfélnek nem látszanak, és a könyvelő feladata: „Ellenőrizd a folyószámlán: 2026. {honapok} kata”.
3. **`tax_payment_items.adonem`** kitöltése a meglévő tételeken a `kind` alapján.
4. **`client_tax_profiles.hipa_prior_year_huf`:** ha egy jóváhagyott 2026-os `HIPA-1` előleg van, és a 2025-ös éves adó nem ismert, üresen marad (a könyvelő az átvételnél vagy kézzel tölti).
5. **A 2026-os `annual_closings` sorok:** `regime` frissítése a profilból (ha eltér).
- **Előtte pg_dump, utána független ellenőrzés** (sorszámok, a katás ügyfél Határidők-listája, a HIPA-előleg sora változatlan).
- **Demo-mag** (`seed:ev_ciklus`, `APP_ENV=production`-ben nem fut, kitalált adatokkal): egy katás ügyfél egy mentes hónappal és egy túllépéssel; egy átalányos ügyfél fizetendő különbözettel, egy visszajáróval, egy önellenőrzéssel és egy egyeztetéssel.

### 5.9 Kapcsolók (`EVES_KAPCSOLOK`, alapérték a kódban, felülírás: `system_state['kapcsolok.ev_ciklus']`)

| Kapcsoló | Alapérték | Mit kapcsol |
|---|---|---|
| `kataEvVegeUgyfelnek` | `csakRogzitettHatralek` | 3.10: csak a könyvelő által rögzített hátralékra (vagy jelöletlen, lejárt tételre) megy ügyfélértesítés |
| `kataElorejelzesUgyfelnek` | `false` | 3.9: az ügyfél csak a tényleges túllépést látja, az előrejelzést nem; a könyvelő igen |
| `potlekJavaslat` | `true`, csak panel | 4.3: javaslat, a könyvelő hagyja jóvá; az ügyfél csak a jóváhagyott számot látja |
| `refundDatumUgyfelnek` | `true` | 3.5: a „Ha {datum} után sem érkezett meg” mondat |
| `reszletfizetesSzoveg` | `false` | Art. 199. § szöveg [T6] |
| `m2m` | `false` | F4 |
| `kata2027Osszeg` | `null` | 2027-es havi összeg, amíg [D24] nem dönt |
| `vegyesEvMotor` | `false` | vegyes év automatikus számolása |
| `csjkBirsagTetel` | `false` | 12 %-os különbözeti bírság külön tételként [D4] |

---

## 6. Értesítések és szövegek (content)

### 6.1 Szabályok

- **Kulcsok:** `notif.<kind>[.<variant>].title|body`, a képernyőszövegek `eves.*`, `fizetes.*`, `kata.*`, `onell.*`, `folyoszamla.*` (panel).
- **Forrás:** a `shared/src/eves.ts`; a backend `content/eves.ts` lapítja és regisztrálja a `DEFAULT_TEXTS`-ben (a `k28.ts` mintájára, helyőrző-ellenőrzéssel).
- **Helyőrzők:**
  - `{firstName}` (a könyvelő), `{firstNameWith}` („Bencével”);
  - `{osszeg}` (szóközös ezres, Ft nélkül);
  - `{hatarido}` = `huDayMonthIg` („december 14-ig”), `{datum}` = `huDayMonth` („december 14.”);
  - `{honap}` (kisbetűs hónapnév), `{ev}`, `{ok}`, `{szamla}` (maszkolt), `{clientName}` (panel).
- **QA:**
  - grep: a `a\(z\)` és a `RESPONSE_TIME_FORBIDDEN_PATTERNS` minta nem fordulhat elő az új kulcsokban;
  - a `\bBence\b` nem fordulhat elő az app és a backend szövegeiben (H8);
  - ügyfélszövegben nincs „SZJA” nagybetűvel.

### 6.2 Ügyfél képernyőszövegek (a fontosabbak; a többi a 3. fejezetben szó szerint)

| Kulcs | Szöveg |
|---|---|
| `fizetes.cim.kata` | Kata – {honap} |
| `fizetes.cim.eves_szja` | Szja-különbözet {ev} |
| `fizetes.cim.kata_eves` | Kata-különadó {ev} |
| `fizetes.cim.hipa_eves` | Iparűzési adó {ev}: különbözet |
| `fizetes.cim.onellenorzes` | Önellenőrzés: {mit} |
| `fizetes.al.nyitott` | Utald el {hatarido}. |
| `fizetes.al.lejart` | Lejárt: {datum} volt a határidő. Utald el minél előbb. |
| `fizetes.al.tobb` | {n} külön tétel, {n} számlára. A bankodban külön utalásként add fel. |
| `fizetes.kozlemeny_tipp` | A közleménybe az adószámodat írd. |
| `fizetes.jeloles` | Megjelölöm, hogy befizettem |
| `fizetes.jeloles_al` | Ez csak jelölés: pénzt nem vonunk le, nem utalunk. |
| `fizetes.jelolve` | Befizetted, {firstName} ellenőrzi. |
| `fizetes.megse` | Mégsem fizettem be |
| `fizetes.rendben` | Rendben: {firstName} látta a befizetésedet. |
| `fizetes.elteres` | {firstName} eltérést talált. Nézd meg az üzenetét. |
| `fizetes.mentes` | Erre a hónapra nem kell katát fizetned ({ok}). |
| `fizetes.nincs_osszeg` | Az összeget {firstName} még megerősíti. |
| `kata.mentes_ok.*` | táppénz · CSED · GYED · GYES · GYET · ápolási díj · tartalékos szolgálat · fogvatartás · szünetel a vállalkozásod |
| `kata.keret_cim` | Idei kereted |
| `kata.keret_honapok` | Kereted: {n} hónap × 1 500 000 Ft |
| `kata.keret_maradek` | Még {maradek} Ft fér bele. |
| `kata.keret_kozel` | Közel vagy a keretedhez. Ami fölé megy, annak 40%-át különadóként kell befizetned. |
| `kata.keret_tullepve` | {tobblet} Ft-tal túlléptél a kereteden. Erre kb. {kulonado} Ft különadó jár, {hatarido} kell befizetni. Tegyél félre ennyit. |
| `kata.keret_elore` | Ha így folytatod, év végére kb. {tobblet} Ft-tal mész a kereted fölé. Beszélj {firstNameWith}, mit tehetsz. |
| `kata.nincs_fizetnivalo` | Most nincs mit fizetned. A következő kata: {honap}, {hatarido}. |
| `eves.idovonal.cim` | Mikor mi jön |
| `eves.idovonal.kovetkezo` | Következő: {datum} – {mi} |
| `eves.osszesito.cim` | Nézd át a bevallásodat |
| `eves.osszesito.uzenet_cim` | {firstName} üzenete |
| `eves.osszesito.fizetendo` | Fizetendő: {osszeg} Ft |
| `eves.osszesito.fizetendo_al` | Utald el {hatarido} a NAV szja-számlájára. |
| `eves.osszesito.visszajar` | Visszajár: {osszeg} Ft |
| `eves.osszesito.visszajar_al` | A NAV utalja vissza a bankszámládra: {szamla}. |
| `eves.osszesito.nulla` | Nincs különbözet |
| `eves.osszesito.nulla_al` | Az előlegeid pontosan kiadták az adódat. |
| `eves.osszesito.jarulek_al` | Ezeket negyedévente fizetted. Az éves bevallás nem változtat rajtuk. |
| `eves.osszesito.hipa_al` | Ezt külön bevallásban adjuk be, és az önkormányzatnak fizeted. |
| `eves.osszesito.utalas_al` | A bevallás beadása után a Határidők között is megtalálod, ott jelölheted meg a befizetést. |
| `eves.osszesito.reszlet` | Ha egyszerre nem tudod kifizetni, írj nekünk, mielőtt lejár a határidő. |
| `eves.osszesito.lab` | Az összegek a bevallás tervezetéből valók. Ezt adjuk be a NAV-hoz. |
| `eves.osszesito.megerosit` | Jóváhagyod? Ezzel engedélyezed, hogy {firstName} ezzel a tartalommal beadja a bevallásodat. |
| `eves.osszesito.kata.gomb` | Jóváhagyom a nyilatkozatot |
| `eves.osszesito.kata.kulonado` | Fizetendő különadó: {osszeg} Ft |
| `eves.osszesito.kata.kulonado_al` | Utald el {hatarido} a NAV kata-számlájára. |
| `eves.osszesito.kata.nincs` | Nincs különadó |
| `eves.osszesito.kata.nincs_al` | Nem léptél túl a kereteden. |
| `eves.visszajar.cim` | Visszajár: {osszeg} Ft |
| `eves.visszajar.szoveg` | A NAV utalja vissza erre a bankszámládra: {szamla}. Ha {datum} után sem érkezett meg, írj nekünk. |
| `eves.visszajar.jeloles` | Megjelölöm, hogy megérkezett |
| `eves.visszajar.megjott` | Megérkezett: {osszeg} Ft ({datum}). |
| `eves.visszajar.beszamitva` | A NAV a visszajáró összeget egy másik adótartozásodba számította be. Nézd meg {firstName} üzenetét. |
| `eves.visszajar.atvezetve` | A visszajáró összeget a NAV egy másik adódra vezette át. |
| `eves.allapot.beadva_fizetendo` | Beadtuk a bevallásodat. Utald el a különbözetet: {osszeg} Ft, {hatarido}. |
| `eves.allapot.beadva_visszajar` | Beadtuk a bevallásodat. {osszeg} Ft jár vissza, a NAV utalja. |
| `onell.cim` | Javítjuk egy beadott bevallásodat |
| `onell.mit` | Mit javítunk? |
| `onell.miert` | Miért? |
| `onell.potlek` | Önellenőrzési pótlék |
| `onell.potlek_al` | A késve bevallott adó után jár, naponta a jegybanki alapkamat 365-öd része. |
| `onell.potlek_iroda` | A pótlékot mi álljuk. |
| `onell.osszesen` | Összesen fizetendő: {osszeg} Ft |
| `onell.osszesen_al` | A beadással egy időben esedékes. Az utalási adatokat a beadás után a Határidők között látod. |
| `onell.javara` | A javadra javítunk: {osszeg} Ft. Ezt a NAV a folyószámládon írja jóvá; {firstName} figyeli. |
| `onell.gomb` | Jóváhagyom az önellenőrzést |
| `onell.megerosit` | Jóváhagyod? Ezzel engedélyezed, hogy {firstName} beadja az önellenőrzést. |

### 6.3 Ügyfél-értesítések (push + app; e-mail: a `KIND_DEFAULTS` szerint)

| Kulcs (`notif.…`) | Cím | Szöveg | E-mail |
|---|---|---|---|
| `tax_due_soon.kata` (módosítás) | Utald el a katát: {osszeg} Ft | A {honap} havi kata határideje: {datum} | igen |
| `tax_due_soon.kata_ma` (módosítás) | Ma van a kata határideje | Utald el ma: {osszeg} Ft ({honap} havi kata). Az utalási adatokat az appban látod. | igen |
| `tax_due_soon.kata_lejart` | Lejárt a kata határideje: {osszeg} Ft | A {honap} havi katát {hatarido} kellett volna befizetni. Utald el minél előbb; ha már megtetted, jelöld meg az appban. | igen |
| `tax_due_soon.kata_ev_vege` | Ne maradjon adótartozásod az év végén | Ha december 31-én 100 000 Ft-nál nagyobb adótartozásod van, megszűnik a katád. {firstName} hátralékot lát: {osszeg} Ft. Utald el december 31. előtt. | igen |
| `tax_due_soon.eves` | Közeleg az szja-különbözet határideje: {osszeg} Ft | Határidő: {datum} Az utalási adatokat az appban látod. | igen |
| `tax_due_soon.kata_kulonado` | Közeleg a kata-különadó határideje: {osszeg} Ft | Határidő: {datum} A NAV kata-számlájára utald. | igen |
| `tax_due_soon.onell` | Fizesd be az önellenőrzés összegét: {osszeg} Ft | A beadással egy időben esedékes. Az utalási adatokat az appban látod. | igen |
| `annual_status.fizetendo` | Beadtuk a bevallásodat: {osszeg} Ft-ot kell befizetned | Utald el {hatarido} a NAV szja-számlájára. Az utalási adatokat az appban látod. | igen |
| `annual_status.visszajar` | Beadtuk a bevallásodat: {osszeg} Ft jár vissza | A NAV utalja vissza a bankszámládra. Ha megérkezett, jelöld meg az appban. | igen |
| `annual_status.nulla` | Beadtuk a bevallásodat | Nincs különbözet: az előlegeid pontosan kiadták az adódat. | igen |
| `annual_status.visszaerkezett` | Megérkezett a visszajáró adód | A NAV {osszeg} Ft-ot utalt vissza. | nem |
| `annual_status.kata_kulonado` | Beadtuk a kata-nyilatkozatodat: {osszeg} Ft különadót kell befizetned | Utald el {hatarido} a NAV kata-számlájára. Az utalási adatokat az appban látod. | igen |
| `annual_status.kata_beadva` | Beadtuk a kata-nyilatkozatodat | Nem léptél túl a kereteden, különadó nincs. | igen |
| `annual_status.hipa_fizetendo` | Iparűzési adó: {osszeg} Ft különbözetet kell befizetned | Utald el {hatarido} az önkormányzat számlájára. Az utalási adatokat az appban látod. | igen |
| `annual_status.valtozott` | Változott a bevallásod tervezete | {firstName} módosította. Nézd át újra, és hagyd jóvá. | igen |
| `annual_due.jovahagyas` (meglévő) | Hagyd jóvá a bevallásodat {hatarido} | Kész a tervezet. Kb. 2 perc. | – |
| `correction_status.jovahagyasra_var` | Javítani kell egy beadott bevallásodat | {firstName} önellenőrzést készített: {mit}. Nézd át, és hagyd jóvá. | igen |
| `correction_status.jovahagyasra_var_javara` | Javítunk egy bevallásodat, a javadra | {firstName} önellenőrzést készített: {mit}. Nézd át, és hagyd jóvá. | igen |
| `correction_status.beadva_fizetendo` | Beadtuk az önellenőrzést: {osszeg} Ft-ot kell befizetned | A különbözet és a pótlék most esedékes. Az utalási adatokat az appban látod. | igen |
| `correction_status.beadva_javara` | Beadtuk az önellenőrzést | A javadra javítottunk: {osszeg} Ft. {firstName} figyeli, mikor írja jóvá a NAV. | igen |
| `correction_status.rendezve` | Lezártuk az önellenőrzést | Minden befizetés rendben. | nem |
| `limit_warning.kata80` | Elérted a kata-kereted {percent}%-át | Idén eddig {bevetel} Ft a bevételed, a kereted {keret} Ft. A fölötte lévő bevétel 40%-át különadóként kell befizetni. | igen |
| `limit_warning.kata100` | Túlléptél a kata-kereteden | {tobblet} Ft-tal vagy a kereted fölött. Erre kb. {kulonado} Ft különadó jár, {hatarido} kell befizetni. Tegyél félre ennyit. | igen |
| `limit_warning.kata_elore` | Év végére túlléphetsz a kata-kereteden | Ha így folytatod, kb. {tobblet} Ft-tal mész a kereted fölé. Beszélj {firstNameWith}, mit tehetsz. | igen (ha a kapcsoló be) |
| `tax_payment_verified.kata` | {firstName} látta a befizetésedet | A {honap} havi katád rendben megérkezett a NAV-hoz. | nem |
| `tax_payment_verified.eves` | {firstName} látta a befizetésedet | Az szja-különbözet rendben megérkezett a NAV-hoz. | nem |
| `tax_payment_mismatch.kata` | Eltérést látunk a befizetésednél | {firstName} eltérést talált a {honap} havi katánál. Nézd meg az üzenetét. | igen |

- **A `REMINDER_GROUP_KINDS.befizetes`** (Fiók → Értesítések → „Befizetési határidők”) a `tax_due_soon`-nal minden új változatot lefed.
- **A `correction_status`** a `fee_due` mintájára mindig be van kapcsolva: `ALWAYS_ON_KINDS` + `correction_status`, mert pénz és jóváhagyás.
- **A `KIND_DEFAULTS`:**
  - `correction_status: { push: true, email: true, to: 'client' }`;
  - `tax_task: { push: false, email: false, to: 'accountant' }` (panel-jelvény + napi összesítő).

### 6.4 E-mailek (a `dizajn/email/sablon.html` sablonnal; tárgy = a cím; törzs = a szöveg + egy mondat + gomb)

| Esemény | Törzs a szöveg után | Gomb |
|---|---|---|
| `annual_status.fizetendo` | „A bevallás és a NAV visszaigazolása a dossziédban van. Ha egyszerre nem tudod kifizetni, írj nekünk, mielőtt lejár a határidő.” (az utolsó mondat csak bekapcsolt kapcsolóval) | Megnyitom az utalási adatokat |
| `annual_status.visszajar` | „A bevallás és a NAV visszaigazolása a dossziédban van.” | Megnyitom az appot |
| `annual_status.kata_kulonado` | „A nyilatkozat és a NAV visszaigazolása a dossziédban van.” | Megnyitom az utalási adatokat |
| `correction_status.jovahagyasra_var` | „Az önellenőrzést csak a jóváhagyásod után adjuk be.” | Átnézem |
| `correction_status.beadva_fizetendo` | „Az önellenőrzés és a NAV visszaigazolása a dossziédban van.” | Megnyitom az utalási adatokat |
| `tax_due_soon.kata_ev_vege` | „Ha már elutaltad, jelöld meg az appban, és {firstName} a NAV-nál ellenőrzi.” | Megnyitom az utalási adatokat |
| `limit_warning.kata100` | „Ha kérdésed van, írj {firstName} számára az appban.” | Megnézem a keretemet |

- Az „Adózz.hu” minden levélben teljes link legyen (K8 próbalevél-tanulság).

### 6.5 Könyvelői szövegek (panel; szakmai, de tegező)

| Kulcs | Cím | Szöveg |
|---|---|---|
| `notif.tax_task.folyoszamla` | Folyószámla-egyeztetés: {clientName} | Esedékes: {datum}. Rögzítsd az egyenleget adónemenként. |
| `notif.tax_task.kata_ev_vege` | Kata év vége: nézd meg {clientName} folyószámláját | Ha december 31-én 100 000 Ft-nál nagyobb a végrehajtható nettó adótartozása, megszűnik a katája (Kata tv. 5. § (1) e)). |
| `notif.tax_task.mentesseg_bejelentes` | Mentesség bejelentése: {clientName}, {honap} | A bejelentés határideje: {datum} (Kata tv. 7. § (10)). |
| `notif.tax_task.visszajaro_kesik` | {clientName}: a visszajáró szja még nem érkezett meg | Várható volt: {datum}. Nézd meg a folyószámláját. |
| `notif.tax_task.backfill` | {clientName}: ellenőrizd a korábbi kata-hónapokat | {honapok} – az app indulása előtti hónapok. Nézd meg a folyószámlán, és jelöld őket. |
| `notif.tax_task.kata_osszeg` | 2027-es kata-összeg megerősítésre vár | A havi összeg nincs megerősítve (T/928). Addig a 2027-es kata-tételek összeg nélkül állnak. |
| `notif.tax_task.befizetett_mentes` | {clientName}: befizetett, de mentes kata-hónap | {honap}: túlfizetés lehet. Rendezd a folyószámlán. |
| `notif.limit_warning.kata80_staff` | {clientName} elérte a kata-keret {percent}%-át | Bevétel: {bevetel} Ft, keret: {keret} Ft, várható: {varhato} Ft. |
| `notif.limit_warning.kata100_staff` | {clientName} túllépte a kata-keretet | Többlet: {tobblet} Ft, különadó kb. {kulonado} Ft. |
| `folyoszamla.uj` | Új egyeztetés | |
| `folyoszamla.lattam` | Ezeket a befizetéseket a folyószámlán láttam | |
| `eves.panel.osszegek` | Összegek | |
| `eves.panel.egyezik` | Az összegek egyeznek a bevallás tervezetével. | |
| `eves.panel.motor` | Az app becslése: különbözet kb. {becsles} Ft. Eltérés a te számodtól: {elteres} Ft. | |
| `eves.panel.elonleg_ellenorizetlen` | Előbb egyeztesd a folyószámlát: van ellenőrizetlen negyedéves előleg. | |
| `eves.panel.beadtam` | Beadtam | |
| `eves.panel.iktatoszam` | NAV-iktatószám | |
| `onell.panel.kuszob` | 1000 Ft-ig nem önellenőrzés: elég a következő bevallásban javítani. | |
| `onell.panel.nincs_kamat` | Erre az időszakra nincs kamatadatunk. Írd be a pótlékot a NAV pótlékkalkulátorából. | |
| `kata.panel.vegyes_ev` | Vegyes év: a negyedéveket számold kézzel. | |
| `kata.panel.2027` | A 2027-es havi összeg nincs megerősítve (T/928). | |

### 6.6 Levélsablonok a könyvelőnek (a `Sablonok.tsx` meglévő sablonjai mellé; az ügyfél az összesítőn vagy üzenetként látja)

- **`sablon.eves_fizetendo`:** „Elkészült a {ev}. évi szja-bevallásod tervezete. Az idei adód {szja} Ft, előlegként {eloleg} Ft-ot fizettél be, így {osszeg} Ft a különbözet. Ezt {hatarido} kell befizetned a NAV szja-számlájára; az adatokat az appban látod. Nézd át, és ha minden rendben, hagyd jóvá.”
- **`sablon.eves_visszajar`:** „Elkészült a {ev}. évi szja-bevallásod tervezete. Az idei adód {szja} Ft, előlegként {eloleg} Ft-ot fizettél be, így {osszeg} Ft jár vissza. Ezt a NAV utalja a bankszámládra. Nézd át, és ha minden rendben, hagyd jóvá.”
- **`sablon.kata_nyilatkozat`:** „Elkészült a kata-nyilatkozatod. Idén {bevetel} Ft volt a bevételed, a kereted {keret} Ft. {kulonadoMondat} Nézd át, és ha minden rendben, hagyd jóvá.”
  - A `{kulonadoMondat}` az app tölti ki: „Nem léptél túl rajta, különadó nincs.” vagy „A kereten felüli {tobblet} Ft után {kulonado} Ft különadót kell fizetned {hatarido}.”
- **`sablon.onellenorzes`:** „Egy beadott bevallásodban javítanunk kell: {mit}. {miert} A különbözet {osszeg} Ft, az önellenőrzési pótlék {potlek} Ft. Nézd át, és ha rendben van, hagyd jóvá.”
- **`sablon.folyoszamla_hatralek`:** „Megnéztem a NAV-folyószámládat ({datum}). {adonem} adónemen {osszeg} Ft hátralékot látok. Kérlek, utald el {hatarido}; az utalási adatokat az appban látod. Ha már elutaltad, jelezd itt.”

---

## 7. Díj: az éves zárás 14 999 Ft-ja

- **Marad a meglévő út** (SPEC §28.K.1, §28.K.3; `services/eves-zaras.ts` `submitAnnual`, `services/dijak.ts`, `services/payments.ts` `startFeePaymentK29`):
  1. Az ügyfél elküldi a kérdőívet. A `createFeeCharge('eves_zaras', {type:'eves_zaras', annualId})` → `dijra_var`; az összeg a `fee_settings` pillanatképe (ma 14 999 Ft, „Tulaj 11-20: végleges ár”).
  2. Fizetés: „Fizetek (14 999 Ft)”, ügyfél-indította egyszeri kártyás fizetés. A mentett kártyával is mehet egy koppintással (`useSavedCard`), de **magától soha nem vonjuk le** (a kártyás hozzájárulás csak a havidíjra szól, SPEC §28.K.1).
  3. Sikeres fizetés → `fizetve`, díjszámla (Számlázz.hu, a saját levelünkkel), `konyvelonel`, a könyvelő értesítést kap.
  4. **Ha nincs kifizetve:** a meglévő emlékeztetők és a 14 napos zárolás (`zarolas.ts`, `ANNUAL_RULES.lockAfterDays`). Zárolás alatt a határidő-figyelmeztetés („Közeleg egy határidő: {date}…”) továbbra is kimegy.
- **Átutalásos ügyfél** (K8: havi díjbekérő, 8 napos fizetési határidő):
  - ha ez megépül, az éves zárás díja ugyanazzal a díjbekérő-úttal is fizethető: külön díjbekérő, egyedi rendelésszám (pl. `ADZ-10482-EVES-2026`), mert a Számlázz.hu ismétlődés-tiltása be van kapcsolva;
  - az Autokassza-párosítás után ugyanaz a `fizetve` → `konyvelonel` lépés;
  - addig csak kártya.
- **KATA:** ugyanaz a díj; a '26KATA nyilatkozatot és a HIPA-bevallást fedi.
- **Mi nincs benne a díjban** (külön díjat az első változatban nem vezetünk be):
  - önellenőrzés [T2];
  - folyószámla-egyeztetés (havidíjas szolgáltatás);
  - más jövedelmek (E1 kérdés: „Lehet, hogy ehhez külön segítség kell – ezt előre megmondja.”).
- **Visszatérítés:** a meglévő szabály. Ha a munka nem kezdődött el (lemondás `konyvelonel` előtt), `visszaterites_kell`.
- **Előfeltétel élesítés előtt [T1, JOGI]:**
  - az ÁSZF 4.1 és a Megbízás 2.1/5.1 szerint az éves SZJA/HIPA benne van a havidíjban, és az ÁSZF 3.1 kizárja a katásokat (HIANYLISTA 1.x);
  - amíg ez nincs javítva, a 14 999 Ft vitás. Az F2 élesítése előtt az ÁSZF-et módosítani kell (30 napos értesítés, ha szükséges).

---

## 8. Tesztek és elfogadási feltételek

### 8.1 Adómotor (egységtesztek, kézzel számolt értékekkel)

- **KATA hónapok (NAV 99 / Kata tv. 7. § példák):**
  - táppénz 01.19–03.24 → január fizetendő, február és március mentes;
  - táppénz 01.19–02.20 → január fizetendő, február mentes;
  - szünetelés 03.10–05.31 → március fizetendő, április és május mentes;
  - mentes hónapban bevétel → fizetendő;
  - `kataFrom` 2026-03-01 → 10 fizetendő hónap.
- **Keret és különadó:**
  - 03.01-től katás, 17 M Ft bevétel → keret 15 M, különadó 800 000 Ft;
  - egész év, 20 M → 800 000 Ft;
  - 2 mentes hónap + 17 M → keret 15 M, 800 000 Ft;
  - ratio 0,80 → `figyelem`; 1,01 → `tullepve`.
- **Határidők:**
  - 2026 november → **2026-12-14** (a munkanap-javítás után); 2026 december → 2027-01-12;
  - 2027: 02-12, 03-12, 04-12, 05-12, **06-14**, 07-12, 08-12, **09-13**, 10-12, 11-12, **12-13**, 2028-01-12;
  - '26KATA → 2027-02-25; `kataTo` 2027-04-10 → nyilatkozat 2027-05-10.
- **Visszajáró:**
  - `refundExpectedBy('2027-04-20', 2026)` = 2027-05-20;
  - `('2027-01-10', 2026)` = 2027-03-31.
- **Pótlék:**
  - 100 000 Ft, 200 nap 2026.08.26. után → 3 000 Ft; ismételt → 4 500 Ft;
  - az időszak 2026.08.01-jén kezdődik → `null`;
  - 5000 Ft-os felső határ jelölővel.
- **Éves szja-becslés:** a §28.3.8 „egyenletes év” esete (2026, 45 %) → előlegek 699 480; az éves szja és a különbözet kézzel ellenőrizve, a késői kedvezmény miatt negatív különbözet.
- **`deadlinesFor` katás évben:** nincs Q1–Q4, nincs 26SZJA, van 12 havi kata + '26KATA + HIPA.

### 8.2 Backend (integrációs tesztek a meglévő harness-szel)

- **H1:** katás profil → az `ensurePeriods` nem hoz létre negyedévet; a meglévő `becsles` negyedév rejtett lesz; a `calculate` és az `approve` 409-et ad.
- **H2:** a `jobNewYear` 2027-01-01-jén katás profilból katás 2027-es profilt csinál (`regime`, `kataFrom`); nyugdíjasnál nincs `2658`.
- **`syncKataPeriods`:**
  - idempotens (kétszer futtatva ugyanannyi sor);
  - mentessé tett hónap → a jelöletlen tétel érvénytelen lesz, a jelölt megmarad, és jelzés megy;
  - `monthlyHuf = null` → `becsles`, nincs tétel, nincs emlékeztető.
- **Fizetés:** `markPaid` / `unmarkPaid` / `verifyPayment` minden új fajtára; a csoportos kata-ellenőrzés; az egyeztetés a bejelölt tételeket `rendben`-re állítja.
- **Emlékeztetők** (álórával):
  - 12-08 → `kata`; 12-14 → `kata_ma`; 12-15 → `kata_lejart`;
  - jelölt tételre semmi; mentes hónapra semmi;
  - kétszeri futás nem küld kétszer (`notifyOnce`).
- **Éves zárás:**
  - az összeg mentése `jovahagyasra_var`-ban törli a jóváhagyást;
  - régi hash → 409;
  - `filed-szja` iktatószám nélkül → 422;
  - különbözet +X → `eves_szja` időszak és tétel a 103-as számlára;
  - −Y → `refund_expected_by`;
  - a `kesz` csak a 4.1 feltételeivel áll be; `hipa_needed = false` esetén HIPA nélkül is.
- **HIPA:** a `filed-hipa` beírja a következő évi `hipa_prior_year_huf`-ot, és az előleg-jóváhagyás előtöltése ezt mutatja.
- **Önellenőrzés:**
  - ≤ 1000 Ft → 422;
  - nem beadott időszakra → 409;
  - `seq` = 2 → a pótlék ×1,5;
  - beadás → `onellenorzes` időszak + `onellenorzesi_potlek` tétel a 215-ös számlára;
  - `iroda` fizeti → nincs pótléktétel;
  - az eredeti időszak változatlan.
- **Hozzáférés:** a könyvelő más ügyfelére 404; a csapat csak olvashat; az ügyfél csak a saját sorait látja.
- **Szövegek:** minden új kulcs megvan a `DEFAULT_TEXTS`-ben; nincs ismeretlen helyőrző; a QA-grep (6.1) tiszta.

### 8.3 Elfogadás (kézi végigjátszás a demo-szerveren, böngészővel; telefon és asztali szélesség)

1. **Katás demo-ügyfél, 2026 november:**
   - a Határidők között „Kata – november: 50 000 Ft”, december 14.;
   - a fizetési lapon a számlaszám 10032000-01076349, a közlemény az adószám, három Másolom működik;
   - „Megjelölöm…” → „Befizetted, … ellenőrzi”;
   - a panelen „Rendben” → az appban „Kész”, és jön a push.
2. **A könyvelő mentes időszakot rögzít (táppénz):** a hónap sora „nem kell fizetned (táppénz)”, a keret 1,5 M-mal csökken, és a Határidő-figyelőben megjelenik a bejelentési sor.
3. **A bevétel eléri a keret 80 %-át:** borostyán sáv, egy push; 100 % fölött piros sáv a különadó-becsléssel.
4. **Folyószámla-egyeztetés hátralékkal:** jelző az ügyféllistán; „Szólok az ügyfélnek” → üzenet és kérés; december 16-án `kata_ev_vege` push.
5. **2027.01.01. (álóra):** a katás ügyfél katás marad, nincs negyedéve.
6. **Átalányos ügyfél éves zárása:** kérdőív → díj → összegek → jóváhagyás (az ügyfél látja a bevételt, a 15 %-ot, az előlegeket negyedévenként, a különbözetet és a számlaszámot) → beadás iktatószámmal → a különbözet a Határidők között → jelölés → ellenőrzés → `kesz`.
   - Visszajárós változat: „Megjelölöm, hogy megérkezett” → `kesz`.
7. **Önellenőrzés egy beadott negyedévre:** ügyfél-jóváhagyás → beadás → fizetési lap két tétellel (különbözet + pótlék).
8. **Az Éves áttekintő** 15 ügyféllel 2 másodpercen belül betölt, és a szűrők működnek.
9. **A beégetett „Bence”** sehol nem jelenik meg más könyvelőnél.

---

## 9. Döntések

### 9.1 [DÁVID] – eldöntendő, javaslattal (zárójelben: melyik fázist blokkolja)

**Éves szja**

- **D1.** Az eSZJA-tervezetből te készíted el és adod be meghatalmazottként (UJEGYKE E/2), és a végleges számokat (éves szja, elszámolt előleg, egyéb sorok) te írod be az appba? *Javaslat: igen.* (F3)
- **D2.** Az ügyfél-jóváhagyás határideje átalánynál május 10., katánál február 18.? *Javaslat: igen.* (F2)
- **D3.** Átalánynál a TB és a szocho csak a 2658-ban rendeződik, az éves bevallásban nincs különbözetük, és ezt így írjuk ki az ügyfélnek? *Javaslat: igen (NAV 100 6.1).* (F3)
- **D4.** A csjk éves elszámolását (visszaigénylés vagy visszafizetés) összegként te írod be; a 12 %-os különbözeti bírság a 215-ös számlára megy, külön tételként? *Javaslat: összeg igen, külön tétel csak a megerősítésed után.* (F3)
- **D5.** Visszajárónál mindig kiutalást kérsz, nem átvezetést (25SZJA-170)? *Javaslat: kiutalás.* (F3)
- **D6.** A kedvezményeket negyedévente, az előlegben érvényesíted (DAVID_KERDESEK 2.)? (F3)
- **D7.** Alulfizetett negyedéves előlegnél az app ne számoljon késedelmi pótlékot, csak jelezze? *Javaslat: igen.* (F3)
- **D8.** Év közben kezdő (nem áttérő) EV-nél is a teljes 1 936 800 Ft adómentes rész jár? (F3)
- **D9.** Az app ne ajánljon részletfizetést; ha az ügyfél kéri, te adod be (Art. 199. § (1))? *Javaslat: igen.* (F3)

**Önellenőrzés**

- **D10.** Nyomtatványok: 26SZJA, 2658, 26HIPAK önellenőrzés jelleggel, '26KATA-ONELL. Jók? (F3)
- **D11.** Lezárt negyedév különbözete: az app mindkét utat felkínálja (átvitel a következő negyedévbe – Art. 212. § (3) –, vagy önellenőrzés), és te döntesz? 1000 Ft-ig tiltjuk az önellenőrzést? *Javaslat: igen, igen.* (F3)
- **D12.** Pótlék-javaslat: kamat/365, 3 tizedesre csonkítva, ismételtnél ×1,5; a napok az eredeti esedékességet követő naptól a beadás napjáig (mindkettő benne); kerekítés egész forintra. Egyezik a NAV-kalkulátorral? (F3)
- **D13.** Az ügyfél jóváhagyását a javára szóló önellenőrzésnél is kérjük? *Javaslat: igen.* (F3)

**Folyószámla**

- **D14.** Ellenőrzési rend: negyedéves határidő + 7 munkanap; május 20. után; katásnál havonta a 12-e után és december 15-én. Elfogadod? (F1)
- **D15.** Elég rögzíteni ezeket az adónemeket: 103, 406, 258, 288, 138, 215 + egyéb? (F1)
- **D16.** Kiterjed a meghatalmazásod az adószámla megtekintésére (UJEGYKE D/1 vagy E/7)? Használod az Ügyfélportál „Csoportos lekérdezések” funkcióját? (F1)
- **D17.** Túlfizetésnél az ATVUT17-et csak az ügyfél kérésére adod be? *Javaslat: igen.* (F1)
- **D18.** Később (F4) regisztrálnál NAV M2M-felhasználóként, és megadnád az API-kulcsodat az appban? (F4)

**KATA**

- **D19.** A '26KATA nyilatkozat minden katásnak kötelező (NAV 99 6. pont). Megerősíted? (F2)
- **D20.** A mentes hónapok (táppénz, CSED, GYED…) bejelentését te intézed 12-éig? Melyik lapon (T101E, melyik blokk)? (F1)
- **D21.** Mentes időszakot csak te rögzíthetsz, az ügyfél nem? *Javaslat: igen.* (F1)
- **D22.** A kata (és minden NAV-utalás) közleménye az adószám legyen, ne az adóazonosító jel? *Javaslat: adószám.* (F1)
- **D23.** DOMESTIC/OTHER vevőnél már a kiállításkor piros jelzés? *Javaslat: igen.* (F1)
- **D24.** T/928: senkinek ne ajánljunk régi kata-belépést 2026.11.30-ig; a 2027-es havi összeget (75 000 / 50 000 Ft) te erősíted meg, addig az app nem mutat összeget? (F1)
- **D25.** Év közbeni kata-megszűnésnél a nyilatkozat és a különadó határideje kataTo + 30 nap, munkanapra tolva? (F2)
- **D26.** Elég a katás kérdőív február 5-i határideje (a nyilatkozat február 25-én)? (F2)
- **D27.** Vegyes év (átalány ↔ kata év közben): az első változatban kézzel számolod a negyedéveket? *Javaslat: igen.* (F1)
- **D28.** Katás keret-figyelmeztetés 80 %-nál és 100 % fölött; az előrejelzést csak te látod? *Javaslat: igen.* (F1)

**HIPA**

- **D29.** Az alapértelmezés a sávos módszer; a kulcsot és a számlaszámot te adod meg településenként; az önkormányzati egyenleget te nézed. Kell-e külön önkormányzati meghatalmazás? (F3)
- **D30.** Sávos módszernél az első évben nincs előleg (Htv. 41. § (4) b)): így kezeljük? (F1)
- **D31.** Katásnál is sávos a HIPA (Htv. 39/A., 52. § 22. h))? (F1)
- **D32.** A HIPA-különbözethez nem kérünk külön ügyfél-jóváhagyást, elég az szja- vagy kata-összesítővel együtt (vagy utólagos tájékoztatás)? *Javaslat: igen.* (F3)

**Munkarend**

- **D33.** A december 12-i szombat már nem munkanap (4/2026. SZCSM r.), így a novemberi kata határideje december 14. Ha a 2027-es munkarend-rendelet szombati munkanapot hoz, a korábbi dátumot mutatjuk? *Javaslat: igen.* (F1)

### 9.2 [TULAJ] / [JOGI]

- **T1 [JOGI].** Az ÁSZF 4.1 és a Megbízás szerint az éves bevallás benne van a havidíjban, a 3.1 kizárja a katásokat. A 14 999 Ft-os díj élesítése előtt javítani kell. (F2 előtt)
- **T2.** Az önellenőrzés az első változatban díjmentes. Később legyen-e díja, ha az ügyfél késői irata miatt kell?
- **T3.** Ha a hibát az iroda okozta, a pótlékot az iroda fizeti vagy téríti meg? (A `potlek_payer = 'iroda'` mező kész rá.)
- **T4.** Felfüggesztett ügyfélnek is megnyíljon január 5-én az éves zárás? A megszűnt ügyfélnek csak kérésre (díjjal)?
- **T5.** F4: a Somosi Kft. regisztrálja-e a kliensprogramot a NAV M2M-re? (Utána a titkokat titkosítva kell tárolni, a felhasználónak törölhetőnek kell lenniük, és 90 napos hívásnapló kell.)
- **T6.** Ne ajánljuk fel az Art. 199. § szerinti automatikus részletfizetést (csak „írj nekünk”)?

---

## 10. Az első változatban kikapcsolva vagy óvatosan

| Mi | Miért | Hogyan |
|---|---|---|
| NAV M2M adószámla-lekérdezés | regisztráció, kulcskezelés és Dávid döntése kell [D18, T5]; a GitHub-specifikációt építés előtt újra ellenőrizni kell | csak kézi rögzítés; az `account_reconciliations.source = 'm2m'` és a `nav-kliens` bővítése az F4-ben |
| 2027-es kata-összeg | a T/928 nincs kihirdetve | `monthlyHuf = null`, tétel és emlékeztető nélkül; könyvelői feladat [D24] |
| Pótlék | a kamattábla csak 2026.08.26-tól ismert; a kerekítés megerősítendő | csak javaslat a panelen, a könyvelő hagyja jóvá; korábbi napnál nincs javaslat |
| Késedelmi pótlék az alulfizetett előlegre | szakmai döntés [D7] | nem számoljuk, nem mutatjuk |
| Részletfizetés | EV-nél csak az automatikus van, nem a bevallásban [T6] | csak „írj nekünk” |
| Kata-túllépés előrejelzése az ügyfélnek | félrevezető lehet év elején | csak a panelen (`kataElorejelzesUgyfelnek = false`) |
| Év végi 100 000 Ft-os figyelmeztetés | a „végrehajtható nettó tartozást” csak a folyószámla mutatja | ügyfélnek csak rögzített hátraléknál vagy jelöletlen, lejárt tételnél |
| 12 %-os csjk különbözeti bírság | számla és szabály megerősítendő [D4] | benne van a különbözetben, külön tétel nincs |
| Vegyes év (átalány ↔ kata) | a motornak nincs „rezsim-szakasz” bemenete | kézi számolás, panel-jelzés [D27] |
| HIPA önkormányzati egyenleg | nincs NAV-adat | nem követjük; csak a befizetés jelölése és ellenőrzése |
| Visszajáró várható dátuma | óvatos becslés | csak „ha … után sem érkezett meg, írj nekünk” mondat; nem riasztás |
| Önellenőrzés a javára | a NAV jóváírása a folyószámlán látszik | nincs tétel, csak egyeztetés |
| Utólag pótolt (`backfilled`) kata-hónapok | nem tudjuk, fizette-e | az ügyfél nem látja, amíg a könyvelő nem ellenőrizte; nincs emlékeztető |
| Automatikus „kész” a folyószámlából | – | a könyvelő jelöl, a rendszer nem következtet |

---

## 11. Források

**Jogszabályok (njt.hu)**
- Art. (2017. évi CL. tv.): https://njt.jog.gov.hu/jogszabaly/2017-150-00-00
  - 52. § (soron kívüli bevallás), 54–57. § (önellenőrzés), 64. § (1) (visszatérítés: 30 nap, legkorábban március 1.)
  - 199. § (részletfizetés), 202. § (elévülés), 208–209. § (késedelmi pótlék), 211–214. § (önellenőrzési pótlék)
- Air. 52. § (4) (munkaszüneti nap → következő munkanap): https://njt.jog.gov.hu/jogszabaly/2017-151-00-00
- Szja tv. 12/B–12/C. § (tervezet, határidő): https://njt.jog.gov.hu/jogszabaly/1995-117-00-00
- Htv. 39/A. §, 41. § (4) b), 52. § 22. h): https://njt.jog.gov.hu/jogszabaly/1990-100-00-00
- Kata tv. 5. § (1) e), g); 7. § (1)–(10); 10. §: https://njt.jog.gov.hu/jogszabaly/2022-13-00-00
- 10/2025. (IV. 30.) NGM r. – a 2. § c) pontját a 4/2026. (XI. 13.) SZCSM r. hatályon kívül helyezte: https://njt.jog.gov.hu/jogszabaly/2025-10-20-2X

**NAV**
- NAV 100. sz. füzet (átalányadózás, 2026.02.20.): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/100.-Az-egyeni-vallalkozok-atalanyadozasanak-alapveto-szabalyai-2026.-02.-20
- NAV 3. sz. füzet (EV szja és járulék, 2026.08.31.): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/03.-Az-egyeni-vallalkozok-szja--es-jarulekkotelezettsege-2026.-08.-31.
- NAV 99. sz. füzet (KATA, 2026.02.20.): https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fnezzen-utana%2Finf_fuz%2F2026%2F99.-Kisadozo-vallalkozok-teteles-adoja-kata-2026.-02.-20
- NAV számlaszám-jegyzék (2026.11.01-től): https://nav.gov.hu/print/ugyfeliranytu/szamlaszamok/szamlaszamok/nav-adoztatasi-szamlaszamok
- NAV „Ki hogyan fizethet a NAV-nak”: https://nav.gov.hu/ugyfeliranytu/szamlaszamok/Ki_hogyan_fizethet_a_NAV-nak
- NAV adószámla, ATVUT17: https://nav.gov.hu/Elethelyzetek-adozasa/ugyintezeshez/Atvezetesi-es-kiutalasi-kerelem
- NAV adószámla-lekérdezés: https://nav.gov.hu/ado/adoszamla_informaciok/elektronikus_lekerdezes/hogyan_kerdezheti_le
- NAV adószámla-egyeztetés: https://nav.gov.hu/ado/adoszamla_informaciok/egyeztetes/minden_egyezik_es_tartozasa_van
- NAV önellenőrzési pótlék kalkulátor (tájékoztató): https://nav.gov.hu/ugyfeliranytu/kalkulatorok/potlekszamitas/onellenorzesi-potlek-szamitas/tajekoztato-az-onellenorzesi-potlek-kalkulator-mukodeserol
- 2658 nyomtatvány és útmutató (7. pont: önellenőrzés): https://nav.gov.hu/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/2658
- 25SZJA útmutató: https://nav.gov.hu/pfile/file?path=/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/25SZJA/25szja-kitoltesi-utmutato
- 25KATA nyomtatvány és útmutató: https://nav.gov.hu/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/25KATA
- 25HIPAK útmutató: https://nav.gov.hu/pfile/file?path=/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/25HIPAK/25hipak-kitoltesi-utmutato
- NAV hír – EV-tervezet nem válik automatikusan bevallássá (2026.05.15.): https://nav.gov.hu/sajtoszoba/hirek/Az_egyeni_vallalkozoknak_afas_maganszemelyeknek_ostermeloknek_mindenkepp_foglalkozniuk_kell_a_bevallassal
- NAV évkönyv 2025 (12. old.: Csoportos lekérdezések, M2M): https://nav.gov.hu/pfile/file?path=%2Fkiadvanyok%2Fevkonyvek%2Fnav-evkonyv-2025
- NAV M2M (GitHub, spec 1.3): https://github.com/nav-gov-hu/M2M

**Egyéb**
- MNB – jegybanki alapkamat: https://www.mnb.hu/
- T/928 egységes javaslat (2026.11.20.): https://www.parlament.hu/irom43/00928/00928-0009.pdf

**Belső anyagok**
- NAV-kutatás és kód-felmérés: a workflow előző lépései (11-21); a kinyert szövegek a session scratchpadjében (`txt/`, `web/`), nem tartós helyen.
- `_munka/k6/kata_2026.md` (16–17. pont: a motorhiányok listája), `_munka/KONYVELO_LEFEDETTSEG.md`, `_munka/HIANYLISTA_2026-11-21.md` (1.8, 2.3), `_munka/DAVID_KERDESEK.md`, `_munka/K8_TERV.md`.
- SPEC §28.K.1, .3, .4, .11; `dizajn/C5_v2/53_hataridok_b.html` (fizetési lap minta), `95_eves_zaras*.html`; `dizajn/C5_v2/SZOVEG_JAVITASOK.md`.
