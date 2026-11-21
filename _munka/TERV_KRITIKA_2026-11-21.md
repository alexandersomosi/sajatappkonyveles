# Kritika: TERV_EVES_CIKLUS_KATA.md és TERV_FELUGYELET.md (2026-11-21)

**Mire szól:** a két 11-21-i terv hibái, hiányai és kockázatai. A terveket NEM módosítottam; ez a fájl az építés előtti javítólista.
**Hogyan készült:** mindkét terv teljes elolvasása; a kód szúrópróbás olvasása (`ado-motor/src/rules/holidays.ts`, `backend/src/jobs.ts`, `worker.ts`, `services/accounts.ts`, `notify/notify.ts`, `deploy/bongeszo-proba.mjs`, `deploy/env.example`, `landing/hirdetes-sablon.js`, `proxy/caddy/sites/adozz.caddy`); a szerveren csak olvasó parancsok (titok nélkül); 7 jogszabályi/NAV-állítás ellenőrzése hivatalos forrásban (1. fejezet).
**Jelölések:** [DÁVID] könyvelői szakmai döntés · [TULAJ] a tulaj dönt · [JOGI] jogász · [KÓD] fejlesztés · [ELLENŐRIZENDŐ] építéskor igazolni.

---

## 0. A legfontosabb 12 pont (sorrendben)

1. **A 2027-es kata nem „csak egy összeg”.** A T/928/9 egységes javaslat (2026-11-20) új adónemet hoz: 100 000 / 50 000 Ft/hó (fő-/nem főfoglalkozású), 22 M Ft keret, 15 %-os kiegészítő adó a kifizetői bevételre, választás 2026-12-01-től. A régi kata 2027-ben 75 000 Ft. Az éves terv a 2027-es katát a 2026-os szabályok másolatával és `monthlyHuf: null`-lal kezeli (5.3, F4) – ez elfogadás esetén rossz keretet, rossz megszűnési szabályt és hiányzó kiegészítő adót jelentene. → 2.1.
2. **A felügyelet a meglévő `clients.is_test` jelzőre köti a „ne küldj levelet, ne fizettess” őröket.** A szerveren ma 15 ilyen ügyfél van, és a meglévő `deploy/bongeszo-proba.mjs` regressziós próba pontosan ezekkel olvassa ki a regisztrációs kódot a DEMO-postafiókból és indít DEMO-fizetést. Az őrök ezt a próbát eltörnék. → külön jelző kell (3.2).
3. **A rendszerellenőr konténer a teljes `.env`-et megkapja** (JWT_SECRET, APP_DATA_KEY, NAV_CRED_KEY, FILE_ENC_KEY, Stripe-, SimplePay-, Számlázz.hu-kulcs…), mellé SELECT-et minden táblára és írási jogot a teljes iratmappára, kimenő hálózattal. Ez a legkisebb jogosultság elvével ütközik. → 3.1.
4. **Éjjel túl sok minden PIROS és csörög** (külső sslip.io DNS, NAV-programhiba, tanúsítvány 7 nap, vitatott terhelés, egyetlen elmaradt óránkénti mentés). Ebből riasztási fáradtság lesz, és a tulaj lenémítja a telefont. → „ébresztő” szűkebb kör (3.3).
5. **Az U01 (kimentek-e az emlékeztetők) 09:15-kor újraszámolja a jelölteket** – ami 08:00 óta változott (új ügyfél, új tétel), hamis PIROS-t ad. → a 08:00-s futás mentse el a jelöltlistát (3.3).
6. **A „Pótlás most / Újrafuttatás” gomb pénzmozgató feladatokra is megnyomható** (billing, predebit, invoices_issue). A `jobs.ts` slot-zára arra véd, hogy egy slotban ne fusson kétszer; a gomb ezt kapcsolja ki. → tiltólista (3.4).
7. **Az éves terv F1-e (12.07-ig) túl nagy, és a sürgősség indoka gyenge:** a szerver DEMO; a „katás ügyfél” DEMO-adat. Az igazi határidő az élesítés. → kis hotfix most (H2 + munkanap), a többi szeletelve (2.7). Ugyanez a felügyeletre: előbb egy 1–2 napos „minimum riasztás” (3.6).
8. **Folyószámla-egyeztetés: az „adónem egyenlege ≤ 0 → alapból bejelölve rendben” szabály** jelöletlen, ki nem fizetett tételt is „rendben”-re tehet (a NAV még nem írta elő, vagy régi túlfizetés fedi). Katásnál ez a 100 000 Ft-os év végi szabály miatt veszélyes. → csak tényleges befizetés-sor alapján (2.4).
9. **Önellenőrzési pótlék: két törvényi kivétel hiányzik** (Art. 211. § (3): munkáltatói/kifizetői hibás igazolás miatt nincs pótlék; 212. § (5): egymást követő időszakok láncolt javítása), és a **HIPA-önellenőrzés pótléka nem a NAV 215-ös számlájára megy**, hanem az önkormányzathoz. → 2.3.
10. **Hiányzó esetek:** mellékállású átalányos (a DEMO-n 3 profil van!), a főfoglalkozás elvesztése katásnál (munkaviszony, nyugdíj), év közbeni EV-megszűnés bevallásai, kifizetői bevétel miatti kata-megszűnés utáni állapot. → 2.2.
11. **Értesítési lyuk:** induláskor mindenki webes (HIANYLISTA 1.9), push nincs; az `annual_due` fajta e-mailje alapból KI (`notify.ts:87`), így a jóváhagyási határidő-emlékeztető (3.3, `annual_due.jovahagyas`) senkihez nem jut el. → 2.5.
12. **A két terv ütközik:** mindkettő „SPEC §32”-t ír, mindkettő új migrációt és „D1–Dn” Dávid-kérdéseket számoz; a felügyelet U05/U06 nem egyezik az éves terv kata-tételeivel. → 4.

---

## 1. Szúrópróba: 7 állítás hivatalos forrásban (11-21)

| # | Állítás a tervben | Eredmény | Forrás |
|---|---|---|---|
| 1 | Visszajáró szja: a beérkezéstől 30 napon belül, legkorábban az adóévet követő március 1-jétől (Art. 64. § (1)) | **Igaz.** | https://njt.jog.gov.hu/jogszabaly/2017-150-00-00 (64. § (1)) |
| 2 | Önellenőrzési pótlék: alapkamat/365, 3 tizedesre csonkítva, ismételtnél másfélszeres, 5000 Ft-os felső határ hiánytalan megfizetésnél, későbbi bevallásban pótoltnál legfeljebb a késedelmi pótlék (Art. 212. §) | **Igaz** (212. § (1), (1a), (1b), (2), (3); 209. § (2)). **Hiányzik a tervből:** 211. § (3) (nincs pótlék, ha a javítás a munkáltató vagy kifizető késedelmes/hibás igazolása miatt kell) és 212. § (5) (több egymást követő időszak önellenőrzésénél az alap az első téves bevallás különbözete). | ugyanott, 209–212. § |
| 3 | NAV-számlák: szja 10032000-06056353 (103), kata 10032000-01076349 (288), késedelmi pótlék 10032000-01076985 (138), bírság/önellenőrzés 10032000-01076301 (215) | **Igaz** (a jegyzék 2026.11.01-től hatályos). **Pontosítás:** a 215-ös számla csoportos: az önellenőrzési pótlék 215, a bírság 224, a mulasztási bírság 226 adónemen könyvelődik → a folyószámla-sorokba külön kell. | https://nav.gov.hu/print/ugyfeliranytu/szamlaszamok/szamlaszamok/nav-adoztatasi-szamlaszamok |
| 4 | '26KATA nyilatkozat minden katásnak, febr. 25-ig; megszűnéskor 30 nap; mentes hónapok (7. § (8)–(10)); keret 18 M / 1,5 M Ft/hó | **Igaz** (Kata tv. 10. §, 7. § (4)–(10)). **Hiányzik a tervből:** az örökbefogadói díj és a gyermekek otthongondozási díja (GYOD) mint mentes ok; a baleseti táppénz a táppénz mellett. Az njt-oldal 2023.08.01-i állapotot jelzett → a hatályos állapotot építés előtt újra nézni. | https://njt.jog.gov.hu/jogszabaly/2022-13-00-00 |
| 5 | A 2026.12.12-i szombati munkanapot a 4/2026. (XI. 13.) SZCSM r. törölte | **Igaz** (a 10/2025. NGM r. 2. § c) pontját az 1. § hatályon kívül helyezte). A 2026-12-14-es kata-határidő helyes. | https://njt.jog.gov.hu/jogszabaly/2025-10-20-2X |
| 6 | HIPA sávos: adó és előleg május 31.; előleg = előző évi adó; bevallás csak, ha több az előlegnél vagy visszatérítést kér (Htv. 39/A. § (7)–(9)) | **Igaz.** Pontosítás: az előleg az **adóév** május 31-éig esedékes, az éves adó a **következő év** május 31-éig – a két tétel ugyanazon a napon jön. | https://njt.jog.gov.hu/jogszabaly/1990-100-00-00 |
| 7 | T/928: régi katának 2027-ben 75 000 Ft | **Igaz, de hiányos** – lásd 2.1. (A tervezet, nincs kihirdetve.) | https://www.parlament.hu/irom43/00928/00928-0009.pdf (7. §, 8. §, 14–16. §, 29. §) |

Nem hivatalos forrásból igazolva: az 5,5 %-os jegybanki alapkamat 2026.08.26-tól (adozona.hu, Bankmonitor). A szeptember–novemberi kamatdöntéseket az mnb.hu-n meg kell nézni, mielőtt a `base-rates.ts` elkészül [ELLENŐRIZENDŐ].

---

## 2. Éves ciklus és KATA

### 2.1 T/928 – a 2027-es kata alapjaiban más [kritikus]

A T/928/9 egységes javaslat (benyújtva 2026-11-20 13:17) szövege szerint:
- **Új adónem** („kisadózó egyéni vállalkozók tételes adója”): főfoglalkozásúnak 100 000 Ft/hó, nem főfoglalkozásúnak 50 000 Ft/hó 2027-ben (7. § (1)); keret **22 M Ft**, felette 40 % különadó (7. § (4)–(5)); **kiegészítő adó**: a kifizetőtől származó bevétel 15 %-ának az éves tételes adót meghaladó része (8. §); a választás bejelentése **2026-12-01-től**, hatály 2027-01-01 (16. § (1)); a törvény egy része 2026-12-01-jén hatályba lép (14. § (1)).
- **Régi kata (Kata tv.):** 7. § (1) 50 000 → 75 000 Ft (2027), → 100 000 Ft (2028); a Kata tv. 2029-01-01-jén hatályát veszti (29–30. §).
- **Átmenet:** a régi kata kifizetői bevétel miatti megszűnése után 15 napon belül választható az új (15. § (2)); más megszűnési okoknál 12 hónapos tilalom (15. § (1)).

**Mi a baj a tervben:**
- `rules/2027.ts`: `kata: { ...RULES_2026.kata, monthlyHuf: null }` → elfogadás esetén az új katás ügyfélnek 18 M-os keretet, „kifizetői bevétel = megszűnés” figyelmeztetést és kiegészítő adó nélküli éves összesítőt mutatna.
- A `client_tax_profiles`-ban nincs mező arra, hogy **melyik kata** (régi vagy új), és hogy főfoglalkozású-e az új katában.
- A `revenue_items`-ben nincs kifizető-típus és -azonosító, pedig az új kata nyilvántartása megköveteli (T/928 12. § (2) e)–g), a k6/kata_2026.md 15.1 szerint) [ELLENŐRIZENDŐ a végleges szövegben].
- A `jobNewYear` H2-javítása vakon másolja a `regime`-et. Decemberben ügyfelenként dönteni kell a 2027-es módról (átalány marad / régi kata marad 75 000-rel / új kata), és ezt **előre rögzíteni** a 2027-es profilban. A `jobNewYear` `onConflictDoNothing`-gal dolgozik (jobs.ts:217), tehát egy előre felvett 2027-es profilt megtart – erre lehet építeni.

**Javaslat [KÓD]:**
- F1 migrációba (hozzáadó): `client_tax_profiles.kata_variant text` (`'regi' | 'uj'`, null = nem katás), `kata_fofoglalkozasu boolean`; a `revenue_items`-be `payer_kind` (`maganszemely` | `kifizeto` | `kulfoldi_kifizeto`) + `payer_tax_number` – csak ha Dávid szerint kell.
- `KataRules` változatonként (`rules/2027.ts`: `kataRegi`, `kataUj`), mindkettő `draft: true`, amíg a Magyar Közlönyben nincs kihirdetve. A 2027-es kata-tételek csak a könyvelő ügyfelenkénti megerősítése után jönnek létre.
- Panel: „2027-es adózási mód” kártya decemberben (döntés, bejelentés dátuma, ki adta be), és könyvelői feladat minden katás és átalányos ügyfélre december 1. és 31. között.
- A felügyelet U06-ja jelezzen, ha 2027 januárjában van katás ügyfél megerősített 2027-es összeg nélkül (különben a február 12-i határidő előtt nem megy emlékeztető).

### 2.2 Hiányzó esetek

| Eset | Mi hiányzik | Javaslat |
|---|---|---|
| **Mellékállású átalányos** (a DEMO-n 3 `mellekallasu` profil van) | Az éves összesítő „Járulékok” blokkja csak a nyugdíjast kezeli külön (3.3/6). A mellékállású járulékszabálya más. | Az összesítő ágazzon `status` szerint (fő / mellék / nyugdíjas), a szöveget Dávid adja [DÁVID K2]. |
| **Nyugdíjas** | A „Nyugdíjasként nem fizetsz TB-járulékot és szochót” mondat forrás nélküli. | Forrás vagy [DÁVID K2]. |
| **Katás elveszti a főfoglalkozást** (munkaviszony, nyugdíj, egyéb Kata tv. 2. § 2. ok) | Nincs esemény, nincs feladat. A k6 szerint a kata a hónap végével megszűnik, 15 napon belül bejelentendő (Kata tv. 5. § (1) h), (3a)). | Panel: „Kata megszűnése” művelet okkal → `kataTo`, '26KATA 30 napon belül (Kata tv. 10. § (2)), különadó 30 napon belül (7. § (6)), bejelentési feladat [DÁVID K3]. |
| **Kifizetői bevétel miatti kata-megszűnés** | Csak a számla kiállításakor van figyelmeztetés (D23). Utána az ügyfél vagy átalányra, vagy vállalkozói szja-ra kerül – ez utóbbit az app nem kezeli; 2027-től az új katára is válthat 15 napon belül (T/928 15. § (2)). | Ugyanaz a „Kata megszűnése” művelet + a további rezsim döntése [DÁVID K4]; ha az ügyfél a termékből kiesik, a tulaj is kapjon jelzést. |
| **Év közbeni EV-megszűnés** | Csak a kata ága van meg (kataTo + 30 nap). Az átalányos megszűnő ügyfél szja-, 2658- és HIPA-bevallásának határideje és a díj nincs a tervben; a T4 csak a január 5-i megnyitásról szól. | [DÁVID K1]; addig a megszűnt ügyfél éves zárása kézzel indítható legyen. |
| **Év közbeni kezdés** | D8 (adómentes rész) és D30 (első évben nincs HIPA-előleg) megvan. | Rendben. |
| **Kata → átalány év közben (vegyes év)** | Kézi számolás (D27) – rendben az első változatban. | A vegyes év jelzése a Határidő-figyelőben is látsszon. |
| **Visszajáró** | Rendben (Art. 64. § (1) igazolva). | – |
| **Kamarai hozzájárulás, NAV-levél válaszhatárideje** | A HIANYLISTA 2.3 felsorolja, a terv kihagyja. | Az idővonalba és a Határidő-figyelőbe, forrással [DÁVID K10]. |

### 2.3 Adószabály-pontosítások

- **Mentes okok (Kata tv. 7. § (8)):** az `InsuranceBreak.kind` és a `kata.mentes_ok.*` listájából hiányzik az `orokbefogadoi_dij` és a `gyod` (gyermekek otthongondozási díja); a baleseti táppénz a táppénzzel együtt kezelhető. A 30 napos szabály (7. § (9)) csak az a)–c) okokra vonatkozik, a szünetelésre nem – a motor-tesztben ezt külön esetként kell felvenni.
- **Pótlék-kivételek:** az önellenőrzés űrlapjára kell egy „munkáltatói/kifizetői igazolás hibája miatt” jelölő (Art. 211. § (3) a)) → pótlék 0; a `cause = 'kesoi_irat'` ezt nem fedi. Az egymást követő negyedévek javításánál a 212. § (5) szerinti alap kell; a terv negyedévenként külön számol [DÁVID K6].
- **HIPA-önellenőrzés:** a terv minden `onellenorzesi_potlek` tételt a NAV 215-re tesz (5.2 `ADONEM_BY_ITEM_KIND`). Helyi adónál a pótlék az önkormányzat számlájára megy [DÁVID K7]; addig a HIPA-ra ne legyen automatikus pótléktétel.
- **Adónemek:** a folyószámla-űrlapra kell a 224 (bírság) és a 226 (mulasztási bírság) sor is; a 12 %-os különbözeti bírság tétele ne `adonem '215'`-tel jöjjön létre [DÁVID K8].
- **Alapkamat-tábla:** a 2026.08.26. utáni MNB-döntéseket hivatalosan ellenőrizni; a felügyeletben legyen INFO-ellenőrzés, ha az mnb.hu kamata eltér a táblától.
- **100 000 Ft-os szabály:** a törvény a végrehajtható, nettó tartozásról szól, és a NAV visszavonja a határozatot, ha a véglegessé válásig minden ki van fizetve (Kata tv. 5. § (1) e)). A december 16-i egyszeri jelzés mellé kell egy december 22-i (utolsó teljes hét) könyvelői ellenőrzés is; az ügyfélszöveg mondja meg, hogy a határozat véglegessé válásáig a befizetés még megmenti a katát.

### 2.4 Éles adat szennyezése, téves „rendben”

- **Folyószámla csoportos ellenőrzés (4.4):** az „alapból bejelölve, ha az adónem egyenlege ≤ 0” szabály hamis „rendben”-t adhat (a NAV még nem írta elő a kötelezettséget, régi túlfizetés fedi, más tétel jóváírása). → Alapból üres; bejelölni csak a kivonat befizetés-sora alapján lehessen (dátum + összeg), a jelölésnél a könyvelő lássa az egyezést [DÁVID K11].
- **Utólag pótolt (`backfilled`) kata-hónapok:** az ügyfél nem látja őket, amíg a könyvelő nem ellenőrzi. Ha valóban nincsenek befizetve, az ügyfél nem kap jelzést → a könyvelői feladat határideje legyen december 10. (a 100 000 Ft-os szabály előtt).
- **Automatikusan jóváhagyott kata-tétel:** ha a kata közben megszűnt (2.2), az app tovább generál tételt és emlékeztetőt → a kata-tétel csak érvényes `regime = 'kata'` és `kataTo` nélküli vagy jövőbeli `kataTo` mellett jöjjön létre (ez a tervben megvan), és a „Kata megszűnése” művelet azonnal érvénytelenítse a jövőbeli jelöletlen tételeket.
- **`hidden_at` szűrés:** „minden lekérdezés kiszűri” – egy kimaradt lekérdezés visszahozza a rejtett negyedévet (emlékeztető is mehet rá). → Egy közös `visiblePeriods()` segéd + teszt, amely tiltja a közvetlen `taxPeriods` lekérdezést az ügyfél- és job-kódban.

### 2.5 Értesítési lyuk webes ügyfeleknél

- A HIANYLISTA 1.9 szerint induláskor minden ügyfél webes, a push nem működik, és ha nincs push-token, e-mail sem megy helyette.
- `notify.ts:87`: `annual_due: { push: true, email: false }` → az `annual_due.jovahagyas` (jóváhagyási határidő 7/3/1 nappal előtte) és a meglévő éves emlékeztetők nem jutnak el a webes ügyfélhez.
- **Javaslat:** az F2 előtt az 1.9 javítása (push helyett e-mail), vagy legalább `annual_due.email = true`. A terv minden új ügyfél-értesítésénél ellenőrizni, hogy webes ügyfélnél is van-e csatorna.

### 2.6 Díj és jog

- A terv helyesen jelzi a [T1, JOGI] előfeltételt. Kiegészítés: a T/928 új katája a katás csomag ÁSZF-ét is érinti (fő-/mellékfoglalkozású, B2B megengedett), ezért a jogásznak egyszerre kell látnia a kettőt.

### 2.7 Túl nagy első lépés

- **Tény:** a szerver DEMO (HIANYLISTA 1.14: „Élesítéskor a demó megszűnik”). Olvasva (11-21): 37 ügyfél, ebből 15 `is_test`; a katás profil 1 db (`is_test = false`, DEMO-adat). A „12.08-án megy az első kata-emlékeztető” tehát demó-ügyfélnek menne.
- **Javasolt szeletelés:**
  - **F0 – hotfix, 1–2 nap, most:** `holidays.ts` (12-12 törlése a forrással), H2 (`jobNewYear`: regime, kataFrom/To, nincs negyedév katásnál), H1 (rejtés), H4 (komment), H8 („Bence”). Ezek kis, jól tesztelhető változások, és a január 1-jei futás DEMO-adatát is megvédik.
  - **F1a – élesítésig:** KATA havi tételek, fizetési lap, emlékeztetők, keret-sáv; migráció csak ehhez (+ a 2.1 `kata_variant` mezői).
  - **F1b:** kézi folyószámla, HIPA-előzmény, Éves áttekintő alap.
  - **F2/F3** marad; a `tax_corrections` táblát csak az F3-ban hozzuk létre, Dávid D10–D13 válasza után (a terv szerint is hozzáadó migráció, így nincs ok előre rögzíteni egy 33 nyitott kérdéstől függő sémát).
- **Egyszerűsítés:** a beadási adatok (dátum, iktatószám, bevallás-PDF, nyugta) most három helyen jönnek létre (`tax_periods.filing_ref`, `annual_closings.szja_*/hipa_*`, `tax_corrections.filed_*`). Egy közös `filings` tábla (űrlap, időszak, dátum, iktatószám, iratok) kevesebb mezőt és egy ellenőrzési utat adna. Döntés az építőé.

---

## 3. Felügyelet

### 3.1 Biztonság

- **Teljes `.env` az ellenőrben (1.2 compose):** a konténer megkapja a JWT_SECRET-et (bárki nevében tokent írhatna), a CODE_HMAC_SECRET-et, az APP_DATA_KEY-t, a NAV_CRED_KEY-t, a FILE_ENC_KEY-t, a Stripe- és SimplePay-titkot, a Számlázz.hu-, NAV-, Expo-, Umami- és Meta-kulcsokat (env.example kulcsnevei). Mellé SELECT minden táblára, a `nav_credentials`-t is → a titkosított NAV-jelszavak visszafejthetők.
  - **Javaslat:** a `.env.figyelo` csak felsorolt kulcsokat kapjon (SMTP a külön ZeptoMail-ügynökkel, egy Stripe *restricted* olvasókulcs, Számlázz.hu, NAV-kereső – ha ezek ellenőrzése egyáltalán az ellenőrben fut). A T02 (iratok visszafejtése) a workerben fusson, és csak az eredményt írja a `system_state`-be; így a FILE_ENC_KEY nem kell az ellenőrnek.
  - **DB-szerep:** SELECT csak a ténylegesen olvasott táblákra/oszlopokra, vagy SECURITY DEFINER nézetek, amelyek csak darabszámot adnak. A `users`, `sessions`, `nav_credentials`, `messages`, `documents` tartalma ne legyen olvasható.
  - **Iratmappa:** a `../data/files` egészét írhatóan csatolja → csak a `_figyelo` almappa legyen írható (külön csatolás), a többi semmi vagy csak olvasható.
- **Szintetikus próba `--ipc=host`:** a gazdagép IPC-névterét osztja meg. Helyette `--shm-size=1g` (a Playwright-doksi ezt is elfogadja) [ELLENŐRIZENDŐ].
- **`adozz_telefon_ntfy.cmd` (`ssh … cat …`):** ne az egész `.env.figyelo`-t írja ki (abban a DB-jelszó és a tokenek is benne vannak), csak a tulajnak kellő 3 értéket, kulcsnév szerint kiválasztva.
- **Kimenő szövegek:** a szövegszűrő mintái nem fogják meg a neveket. A `{error}`, `{lastError}`, `{smtpHiba}`, `{kumaHiba}`, `{kimenetRovid}` nyers szövegében ügyfélnév lehet (pl. egy job hibája egy ügyfélnévvel). → Kifelé csak hibakód/osztály menjen, a nyers szöveg csak a panelen.
- **Riasztó-levél a DEMO-n is valódi SMTP-n megy:** a címzett legyen fix engedélylistán (csak a `FIGYELO_EMAIL_TO` címei), és a kód utasítsa el, ha a cím egy ügyfél-címmel egyezik.

### 3.2 Meglévő folyamatok törése, adatszennyezés

- **`is_test` őrök (1.4) ↔ `deploy/bongeszo-proba.mjs`:** a meglévő böngészős próba `utm_source=bongeszo-proba`-val regisztrál (→ `is_test = true`, accounts.ts:127), a kódot a DEMO-postafiókból olvassa (bongeszo-proba.mjs:129-140), majd DEMO-előfizetést indít (:175-189). Ha a `mailer` és a fizetésindítás minden `is_test` ügyfélre tilt, ez a próba elbukik. → Külön jelző kell: `clients.is_synthetic` (vagy a szintetikus ügyfél azonosítója a `system_state`-ben), és az őrök csak erre vonatkozzanak.
- **Téves állítás (X01):** „a `*proba*` forrást az `isTestSource` (accounts.ts:74) kiszűri”. A minta `^(qa[_-]|teszt|test|https-proba|bongeszo-proba|qa_proba|smoke)`, a `figyelo-proba` nem illeszkedik rá; és a jelző csak regisztrációkor, csak `appEnv = 'demo'` mellett áll be. Az X01 nem regisztrál, tehát ez nem is kell; a statisztikát az Umami-kikapcsolás védi.
- **Umami-kikapcsolás:** a `localStorage.setItem('umami.disabled','1')`-t a Playwright `addInitScript`-tel kell beállítani az első betöltés előtt, különben az első oldalnézet már beszámít.
- **Hirdetési pixelek:** rendben – a `hirdetes-sablon.js` csak hozzájárulás után tölt Meta/Google-kódot, a próba nem fogad el semmit. A süti-ablak viszont eltakarhatja az `#arak`-at → az X01 a „láthatóságot” a süti-ablak mellett mérje, és soha ne kattintson az ablakra.
- **Szintetikus könyvelő:** a terv kiszűri a könyvelőválasztóból – a kód minden automatikus ügyfél-kiosztásánál (legkevesebb ügyfél szerinti választás) is ki kell zárni [KÓD].

### 3.3 Hamis vagy fölösleges riasztás

- **U01:** a 09:15-ös ellenőrzés újra lefuttatja a `gyujt()`-et. Ami 08:00 és 09:15 között változott, az hamis PIROS lesz. → A 08:00-s `kuld()` mentse a jelöltlistát (azonosítók, darabszám) a job eredményébe, az U01 ezt hasonlítsa a létrejött értesítésekhez.
- **H01 átmeneti szabálya** („vagy van futó feladat 90 percnél frissebb `startedAt`-tal”): ha a worker egy feladat közben hal meg, a `running: true` bent marad → 90 percig nincs riasztás. → A szívverés külön időzítőre tétele (worker.ts:105-120) kis változás; legyen előfeltétel, ne átmeneti szabály.
- **Éjjeli PIROS:** javasolt „ébresztő” kör (22–07 is csörög): K03, K05, K07, D01, S02-api/worker/db/proxy, H01, M03 (külső mentés 3 órája hibás), S05 (10 % alatt), T01, K12. A többi PIROS (K09 külső DNS, N03, N08, T05/T06, F08, Z01–Z04, M01 egyszeri kimaradás, S08, A01, E05 éjjel) reggel 07:00-kor menjen, a jelentés tetején.
- **M01:** egy elmaradt óránkénti mentés ne legyen azonnal PIROS; SÁRGA 75 percnél, PIROS 3 óránál.
- **S06:** a Postgres a memóriakeretéhez közel dolgozik (page cache) → tartós hamis SÁRGA lehet. A konténer-szabály csak az api/worker/ellenor-ra vonatkozzon, vagy a cache nélküli értéket nézze [ELLENŐRIZENDŐ].
- **S09:** Ubuntu alatt szinte mindig vár valamilyen frissítés → állandó sárga. Küszöb: biztonsági frissítés ≥ 7 napja, vagy újraindítás-igény ≥ 3 napja.
- **N08:** óránként valódi `queryTaxpayer` a saját technikai felhasználónkkal (napi 24 hívás). → Naponta egyszer elég; a NAV kéréskorlátja ismeretlen.
- **K10:** 10 percenként üres POST a Stripe-webhookra → napi 144 `bad_signature` naplósor. Ha a kód ezt biztonsági eseményként naplózza vagy auditba írja, szűrni kell; elég óránként.

### 3.4 Veszélyes gombok

- **„Újrafuttatás” / „Pótlás most”:** a `runIfDue` a slotot atomikusan foglalja (jobs.ts:398-423); a „slotra idempotens” itt azt jelenti, hogy egy slotban egyszer fut, nem azt, hogy kétszer futtatva biztonságos. → Tiltólista: `billing`, `predebit`, `invoices_issue`, `termination_effective`, `suspension_warning`, `service_lock_check`; ezekre csak fejlesztői, kódból végzett pótlás. A többinél is megerősítő ablak + audit, és a gomb csak hibás/elmaradt állapotban aktív.

### 3.5 Hiányok és ellentmondások

- **Az adatlap-táblából kimaradt a `marketing_retention`** (03:40, jobs.ts:353). A vitest-teszt megfogná, de a terv táblája hiányos (28 sor, a `jobDefs()` 29 nevet ad).
- **U06 ↔ éves terv:** az U06 „hó 1-jén az előző havi KATA-tételt” keresi; az éves terv a tételt a hónap elején a *tárgyhónapra* hozza létre (5.4 `syncKataPeriods`). Emlékeztető-napok: az éves terv 8-án, a határnapon és +1 nappal küld, plusz december 16-án; az U06-ban ezek legyenek a minták. A 2027-es összeg nélküli (`becsles`) tételre ne riasszon emlékeztető-hiányt, de jelezze a hiányzó megerősítést (2.1).
- **U05:** csak az átalányos ügyfeleket nézi; a kata-tételek, az `eves_szja`, `hipa_eves`, `onellenorzes` időszakok megépülésekor ide is be kell venni őket.
- **Közvetlen életjelek:** a Healthchecks HC1–HC4 csak a host-szkriptet, a Kumát, az ellenőrt és a jelentést nézi. Ha a `backup.sh`, a `restic-mentes.sh` és a worker minden sikeres köre maga is pingelne egy-egy Healthchecks-ellenőrzést (20 ingyenes, 4 foglalt), a legfontosabb három hiba az ellenőr hibájától függetlenül is riasztana.
- **Lezárható tétel (6. pont 11.):** a „Adozz mentes kulso” ütemezett feladat ma **ki van kapcsolva** (schtasks: Disabled, Next Run Time: N/A); a napló utolsó sora 11-20 23:20, utána nincs futás. Nincs teendő.

### 3.6 Túl nagy első lépés

A terv F1-e egyszerre hoz ~90 ellenőrzést, saját ntfy-szervert új nyilvános aldomainnel, Uptime Kumát, Playwright-képet (~2 GB) és 5 új táblát. A tulaj kérése első fele („ha leáll valami, azonnal szóljon”) ennél sokkal kisebb lépéssel teljesül:

- **F-mini (1–2 nap):** a worker szívverése külön időzítőn; Healthchecks-ping a worker körből, a `backup.sh`-ból, a `restic-mentes.sh`-ból és a host cronból (e-mail + ntfy.sh riasztás a Healthchecks-től); UptimeRobot az app, a panel és az API címére. Kód alig kell, és a szervertől független.
- **F-1:** az ellenőr 15 legfontosabb ellenőrzéssel (H01, H03, H04, D01, D04, M01, M03, S02, S05, E02, E03, U01, T01, K07-belső, R01), e-mail + ntfy.
- **F-2:** a többi csoport, a Rendszer fül, a szintetikus próba, a Kuma.
- A szintetikus kép építése ne fusson minden `up.sh`-ban (lassítja a telepítést és növeli a már 10,65 GB-os build cache-t), csak ha a `deploy/figyelo/szintetikus/` változott.

### 3.7 Kell-e a Kuma? [TULAJ]

A tulaj „például”-ként említette. Ugyanazon a gépen futva a nyilvános címeket nem nézi valóban kívülről (azt az UptimeRobot teszi), a K12 szerepét (az ellenőr halála) a Healthchecks HC3 is ellátja. Cserébe új felület, 2FA, SQLite, kézi monitorfelvétel és a 2026 októberi–novemberi biztonsági közlemények miatti frissítési teher jön. Javaslat: az első körben nélküle; ha a tulaj szeretne egy grafikus áttekintőt, utólag hozzáadható. Ha marad, a terv biztonsági beállításai (loopback, SSH-alagút, 2FA, nincs docker.sock) jók.

---

## 4. A két terv közös ügyei

- **SPEC-fejezet:** mindkét terv „§32”-t ír (éves terv 6. sor, felügyelet 5. sor). → Az egyik legyen §33.
- **Migrációk:** az éves terv 0022/0023-at foglal, a felügyelet is új migrációt ír, a K8 és az Umami is jöhet. A drizzle migrátor a függő migrációkat egy tranzakcióban futtatja → az enumérték-fájl szabálya („ugyanabban a futásban nem használjuk”) a *többi sávra* is érvényes. Számozás építéskor, sorban.
- **Dávid-kérdések számozása:** mindkettő D1-től számoz (éves D1–D33, felügyelet D1–D7). → Előtag: `ÉV-D…`, `FE-D…`, ez a kritika `K…`. Átfedés: FE-D6 (folyószámla-egyeztetés módja) ≈ ÉV-D14/D16. Dávid a korábbi 17 kérdésre sem válaszolt még (DAVID_KERDESEK.md) → egy összefésült, fontossági sorrendbe tett lista kell, az első 10 a blokkolók.
- **Új feladatok adatlapja:** az éves terv 6 új jobot hoz (`kata_periods`, `kata_ev_vege`, `account_checks`, `kata_limit`, `refund_watch`, `kata_exempt_report`); mindhez adatlap kell, különben a felügyelet tesztje elbuktatja a buildet – ez szándékos, de az éves terv építője tudjon róla.
- **A felügyelet [DÁVID]-hivatkozásai** a Katv. pontos §-át kérik (U06) – az éves terv 1.2 táblája ezt már megadja (Kata tv. 7. § (1)–(3)); átvehető.

---

## 5. Új kérdések Dávidnak (a kritikából, 11 db)

- **K1.** Év közbeni EV-megszűnésnél (átalány) melyik bevallást, milyen határidővel kell beadni (szja, 2658, HIPA), és te adod-e be? Jár-e rá az éves zárás díja?
- **K2.** Az éves összesítő „Járulékok” blokkja mellékállású és nyugdíjas átalányosnál: mi legyen a pontos szöveg (és a jogszabályhely)?
- **K3.** Katásnál a főfoglalkozás elvesztését (munkaviszony, nyugdíj) ki figyeli és jelenti be 15 napon belül? Rögzíted-e az appban a megszűnést?
- **K4.** Kifizetői bevétel miatti kata-megszűnés után az év hátralévő részére átalány választható, vagy vállalkozói szja jön (amit az app nem kezel)? 2027-től az új katát ajánlod-e helyette (T/928 15. § (2))?
- **K5.** Ha a T/928 kihirdetésre kerül: decemberben ügyfelenként te döntöd el a 2027-es módot (átalány / régi kata 75 000 Ft / új kata), és rögzíted az appban? Kell-e a bevételnél kifizető-adat (név, adószám)?
- **K6.** Önellenőrzésnél mikor alkalmazod az Art. 211. § (3) a) szerinti pótlékmentességet, és hogyan kezeled az egymást követő negyedévek láncolt javítását (212. § (5))?
- **K7.** A HIPA-önellenőrzés pótléka és a HIPA-különbözet melyik önkormányzati számlára megy (település szerint te adod meg)?
- **K8.** A folyószámlán külön sor kell-e a 224 (bírság) és a 226 (mulasztási bírság) adónemre? A 12 %-os különbözeti bírság melyik adónemre és számlára megy?
- **K9.** A mentes okok közé felvegyük az örökbefogadói díjat és a gyermekek otthongondozási díját (Kata tv. 7. § (8) a))? Ezekre is te teszed meg a 12-éig esedékes bejelentést?
- **K10.** A kamarai hozzájárulás és a NAV-levelek válaszhatárideje bekerüljön-e az éves idővonalba és a Határidő-figyelőbe? Melyik a forrásuk?
- **K11.** Folyószámla-egyeztetésnél csak a kivonat tényleges befizetés-sora alapján jelöljük a tételt „rendben”-re (ne az egyenleg alapján)?

## 6. Új döntések a tulajnak

- **T-K1.** A felügyelet első lépése: a kicsi, 1–2 napos „életjel + 15 riasztás” változat (3.6), a többi utána?
- **T-K2.** Uptime Kuma az első körben: kell, vagy elég a saját ellenőr + Healthchecks + UptimeRobot (3.7)?
- **T-K3.** Éjjel (22–07) csak a valódi leállás csörögjön (3.3 „ébresztő” kör), a többi PIROS reggel 7-kor?
- **T-K4.** Telefonos riasztás: saját ntfy-szerver új nyilvános aldomainnel, vagy az ntfy.sh véletlen nevű témája + e-mail (egyszerűbb, kevesebb nyilvános felület)?
- **T-K5 [JOGI].** A T/928 miatt a katás csomag és az ÁSZF egyszerre kerüljön a jogászhoz (T1 kiegészítése).

## 7. Források (a kritikához olvasva, 11-21)

- Art. (2017. évi CL. tv.) 64. § (1), 209. § (2), 211. § (3), 212. § (1)–(5): https://njt.jog.gov.hu/jogszabaly/2017-150-00-00
- Kata tv. (2022. évi XIII. tv.) 5. § (1) e), 7. § (4)–(10), 10. §: https://njt.jog.gov.hu/jogszabaly/2022-13-00-00
- Htv. (1990. évi C. tv.) 39/A. § (7)–(9): https://njt.jog.gov.hu/jogszabaly/1990-100-00-00
- 10/2025. (IV. 30.) NGM r. 2. § c) – hatályon kívül: 4/2026. (XI. 13.) SZCSM r. 1. §: https://njt.jog.gov.hu/jogszabaly/2025-10-20-2X
- NAV adóztatási számlaszámok (2026.11.01-től): https://nav.gov.hu/print/ugyfeliranytu/szamlaszamok/szamlaszamok/nav-adoztatasi-szamlaszamok
- T/928/9 egységes javaslat (2026-11-20): https://www.parlament.hu/irom43/00928/00928-0009.pdf
- UptimeRobot árak (ingyenes csomag: „personal and commercial projects”, 5 perc): https://uptimerobot.com/pricing/
- Alapkamat (nem hivatalos): adozona.hu, bankmonitor.hu – az mnb.hu-n ellenőrizendő.
- Kód: `ado-motor/src/rules/holidays.ts:34-41`; `backend/src/jobs.ts:194-222, 329-393, 398-430`; `backend/src/worker.ts:105-120`; `backend/src/services/accounts.ts:74-75, 127`; `backend/src/notify/notify.ts:87-88`; `deploy/bongeszo-proba.mjs:103-191`; `deploy/env.example`; `landing/hirdetes-sablon.js:1-10`; `deploy/proxy/caddy/sites/adozz.caddy:148` (a www-átirányítás `permanent` = 301, a K02 elvárása helyes).
- Szerver (csak olvasva): 5 konténer fut; 37 ügyfél, ebből 15 `is_test`; adóprofilok 2026-ra: 22 főfoglalkozású átalány (ebből 12 `is_test`), 3 mellékállású átalány, 1 kata (nem `is_test`); `job.new_year` még nem futott.
