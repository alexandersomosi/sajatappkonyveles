# Adózz.hu – végleges hiánylista (2026-11-21)

Öt szemszög (ügyfélút, könyvelő, élesítés, jog, üzlet) összevonva. A duplikációkat egy tételbe tettem, 14 állítást szúrópróbával a kódban ellenőriztem, és 3 új hiányt vettem fel (2.1 kamarai nyilvántartás 2027-től, 2.2 nincs azonnali jelzés a csapatnak, 3.12 akadálymentesség).
Az útvonalak a `C:/Users/UpgradePC/konyvelo_app/` mappától értendők. A „mem.” a memória `konyvelo-app.md` fájlja.
Kié: **fejlesztés** / **tulaj** / **ügyvéd** / **könyvelő** / **vegyes**.

**Folyamatban, ezért itt nem részletezem:** marketing (Umami, Marketing fül, előkészített Meta/Google-mérés, adatkezelési és süti-tájékoztató), a weboldal 3. köre, és a restic külső mentés (11-21 00:04 óta óránként, közvetlenül a szerverről: `kod/deploy/README.md:11-12, :275-346`).
**Jóváhagyva, tervezés alatt** (tulaj 11-21, mem. :203, wf_23a665f6-f9d; a `_munka/TERV_EVES_CIKLUS_KATA.md` és a `TERV_FELUGYELET.md` még nem készült el; az építés a marketing-telepítés után jön):
- éves ciklus (éves SZJA, különbözet, önellenőrzés, NAV-folyószámla) és a KATA havi befizetéseinek követése;
- felügyelet (Uptime Kuma, minden funkciót figyelő ellenőrző, riasztás).

## Szúrópróba

Rendben találtam:
- `eves-zaras.ts:229`: az éves zárás csak az 'aktiv' ügyfélnek nyílik;
- `push.tsx:24-26`: a weben és EAS-projekt nélkül a push-regisztráció kilép;
- a `kata_teteles` és a `kata_kulonado` csak az enumban szerepel;
- `aszf.md:55`: „nem KATA-s”;
- `acc.ts:189-216`: ügyfelenként 6–8 lekérdezés és egy computeYear;
- `admin-konzol.ts:74-89` és `konzol.ts:633-639` mutatja az üzenetet, az iratot és az adóazonosítót, miközben az `adatkezeles.md:11, :241` szerint ezeket a vezetés nem látja;
- `me.ts:104-115`: az e-mail-cím nem módosítható;
- `gdpr.ts:437-445`: a napló 5 év után törlődik;
- a `guided_continue`-t semmi nem küldi;
- `jobs.ts:104-116`: ÁFA-figyelmeztetés csak 80%-nál;
- `adatkezeles.md:213-223`: a Lark nincs az adatfeldolgozók között;
- `subscription.ts:610-627`: lemondáskor csak az ügyfél kap értesítést;
- `accounts.ts:28-55`: ha minden könyvelő betelt, az eredmény null;
- `Forrasok.tsx:45`: az ajánlásért nincs jutalom.

Helyesbítések az ügynökök anyagához:
1. A mentési tétel nagy részét a restic-kör megoldotta: a fájlok óránként mentődnek, és az új szerveres visszaállítás le van írva (README:312-346). Ezért csak a maradék szerepel (1.19).
2. Közösségi adószámnál az ÁFA-bevallás az ÁSZF 4.3 szerint nincs benne a havidíjban („külön megállapodással”). A hiány az ára és a folyamata, nem a döntés.
3. A kamarai regisztrációra van emlékeztető (`jobs-tulaj1119.ts:5, :188`). Csak az évi 5 000 Ft-os kamarai hozzájárulásra nincs határidő.
4. Az élesítési lista a `kod/deploy/README.md:390-403` sorokban van; a :314-327 sorokban ma a restic-visszaállítás áll.
5. A `jogi/README.md` kérdései így számozódnak: 1. → :134, 2. → :135, 3. → :136, 6. → :139, 7. → :140, 9. → :142, 11. → :144. A fő szerződés a :159. sorban, a Kft. ÁFA-helyzete a :157. sorban szerepel.

---

## 1. ÉLESÍTÉS ELŐTT KÖTELEZŐ

### 1.1 Jogi szövegek: ügyvédi átnézés és igazítás ahhoz, amit az app ténylegesen csinál
- **Mi hiányzik:** Minden ügyfélnek szóló szöveg még tervezet (`draft: true`). Nyitott kérdés: 19 a README-ben, 10 a k5-ben, 15 a marketing-listán. Az ÁSZF és a Megbízás több ponton mást mond, mint amit az app csinál:
  - **KATA:** az ÁSZF 3.1 szerint ügyfél csak „nem KATA-s” lehet, és a Megbízás tárgya is csak az átalányadó (2658, 26SZJA). Közben KATA-csomagot árulunk.
  - **Díjak:** az ÁSZF 4.1 és a Megbízás 2.1/5.1 szerint az éves SZJA/HIPA és a változásbejelentés benne van a havidíjban. Az app és a weboldal ezzel szemben 14 999 / 4 999 / 7 999 / 2 999 Ft-ot kér. Az ÁSZF 6.1 maga is ellentmond a 4.1-nek. A külön díjak nincsenek a 13. pont kiemelt feltételei között (Ptk. 6:78. §).
  - **Fizetés:** az ÁSZF csak kártyát ismer, és a kártyát a szerződéskötés részévé teszi (2.3–2.4, 6.2). Közben jön az átutalás, a kártyát pedig csak a visszahívás után kérjük. A 2.3 új vállalkozásra vonatkozó mondata ütközik a 4/A.6-tal. A SimplePay-nyilatkozatok `showInApp: true` beállítással még megjelennek.
  - **Bérszámfejtés:** az ÁSZF 3.1 kizárja, a 4.3 „külön megállapodásra” utal, a tulaj döntése szerint viszont felárért vállaljuk.
  - **Válaszidő:** az ÁSZF 4.4 és a Megbízás 6.3 „1 munkanapon belül” választ ígér, holott a tulaj 11-19-én megtiltotta a válaszidő-ígéretet.
  - **Árváltozás:** csak a havidíjra van 30 napos szabály (6.7); a külön díjak módosítására és a kedvezmény visszavonására nincs.
  - Minden verziónál `requiresReconsent: false`, ezért élesítéskor dönteni kell az újraelfogadásról.
- **Miért fontos:** díjvitánál és lemondásnál a szerződés dönt. Ha az ÁSZF szerint benne van a havidíjban, a 14 999 Ft nem követelhető, a KATA-s ügyfél pedig olyan szerződést fogad el, amely kizárja őt.
- **Kié:** ügyvéd + tulaj (döntések) + fejlesztés (szövegcsere).
- **Tervezve:** nem. A SPEC §23 9. sora nyitott (SPEC.md:1149), a mem. :194 nyitott ellentmondásként jegyzi; a K8_TERV.md:67 csak a kódbeli időígéretet javítja.
- **Bizonyíték:** kod/jogi/index.json (minden elem `"draft": true`); kod/jogi/aszf.md:1, :51-55, :63-73, :77-79, :188-192, :204, :274-283; kod/jogi/megbizasi_szerzodes.md:21-26, :33, :81, :93; kod/jogi/README.md:118, :132-152; kod/jogi/UGYVED_KERDESEK_k5.md; kod/jogi/UGYVED_KERDESEK_marketing.md; dizajn/landing_v2/index.html:417-463; mem. :82, :89, :110, :194.

### 1.2 Fő szerződés a könyvelő cégével, felelősségi korlát, felelősségbiztosítás
- **Mi hiányzik:** Nincs megírva a Somosi Kft. és a Mennyi Az Annyi Kft. (Fendrik Dávid) közötti alvállalkozói fő szerződés. Ebben kellene rendezni: díj (5 100 Ft + ÁFA/ügyfél/hó), kapacitás, határidő-vállalás, helyettesítés, felelősség és visszkereset, titoktartás, Pmt.-munkamegosztás, ügyfél-elcsábítás tilalma, ügyfélátadás kilépéskor. A sablonok (adatfeldolgozói szerződés, Megbízás) természetes személy könyvelőt feltételeznek, pedig a partner egy cég. Az ÁSZF 9.1 felső határ nélkül vállalja a bírság és a pótlék megtérítését, a Megbízás 7.4 korlátja még helyőrző, és a két dokumentum kizárási köre eltér. Szakmai felelősségbiztosítás nincs, és a rendszer sem tartja nyilván (kötvény, lejárat, a PM-regisztráció érvényessége).
- **Miért fontos:** az ügyfél felé a Kft. felel. Egy adómotor-hiba egyszerre sok ügyfelet érint, a könyvelő pedig szerződés nélkül magával viheti az ügyfeleket.
- **Kié:** tulaj + ügyvéd (+ könyvelő).
- **Tervezve:** nem. A tulaj teendői között szerepel (jogi/README.md:159), de ütemezés nélkül; a 7. ügyvédi kérdés (:140) nyitott.
- **Bizonyíték:** kod/jogi/README.md:140, :159; kod/jogi/adatfeldolgozoi.md:9-15; kod/jogi/megbizasi_szerzodes.md:15, :35-37, :105-111; kod/jogi/aszf.md:240-248; kod/deploy/eles_konyvelo.json:3-13; kod/backend/src/db/schema.ts:266-291 (accountants: csak registrationNumber); mem. :10-13.

### 1.3 Nyitott ügyvédi alapkérdések, amelyek nélkül nem indulhatunk
- **Mi hiányzik:** válasz ezekre:
  - (a) Elég-e a fotós okmány-azonosítás a Pmt. 7. § (10) szerint (nincs videó, nincs DÁP)? Az azonosítás ráadásul a szerződés után jön.
  - (b) Árulhat-e a Kft. a saját nevében könyvelést (tevékenységi kör, Szt. 151. §)? Maga is Pmt.-kötelezett-e?
  - (c) A NAV-meghatalmazás jogcíme: 9-es (a könyvelőnek) vagy 15-ös (a cégnek)? A partner itt maga is könyvelő cég.
  - (d) Zugírászat (Üttv. 2. és 4. §, Btk. 286. §): a korábbi kérdés díjmentes ügyintézést feltételezett, most viszont a díjas EV-nyilvántartási ügyintézés 4 999 / 7 999 Ft.
  - (e) Kizárható-e a fogyasztói minőség? A „még nincs vállalkozásom” úton az ügyfél magánszemélyként szerződik (14 napos elállás, Fgytv. 17/A. szerinti panaszkezelés, békéltető testület). A rendszerben nincs panaszkezelési folyamat, és a vállalt 15 napot semmi nem figyeli.
- **Miért fontos:** ha a fotós azonosítás nem elég, minden aktivált ügyfél átvilágítása hibás. A zugírászat bűncselekmény. Fogyasztónak minősülő ügyfélnél az ÁSZF több pontja érvénytelen lehet.
- **Kié:** ügyvéd.
- **Tervezve:** részben. Kérdésként szerepelnek (jogi/README.md:134-139; UGYVED_KERDESEK_k5.md:11-14), de a díjas változásintézés új tényállását még nem kérdeztük meg, és határidő sincs.
- **Bizonyíték:** kod/jogi/README.md:134-139; kod/SPEC.md:634, :1423; kod/jogi/aszf.md:15, :34, :45, :57; kod/jogi/pmt_nyilatkozatok.md:13-17; dizajn/landing_v2/index.html:449-463; Pmt. https://net.jogtar.hu/jogszabaly?docid=a1700053.tv; Fgytv. https://net.jogtar.hu/jogszabaly?docid=99700155.tv; Szt. https://net.jogtar.hu/jogszabaly?docid=a0000100.tv

### 1.4 Pmt.: belső rend és folyamatos teljesítés
- **Mi hiányzik:** írásos kockázatértékelés (27. §); belső szabályzat (a tevékenység kezdetétől számított 45 napon belül a felügyelethez, 65. § (9)); kijelölt felelős vezető és kijelölt személy (5 munkanapon belül bejelentve, 31. § (2)); bejelentési rend; képzés; szűrés a korlátozó intézkedések listáin. A rendszer rögzíti az igazolvány lejáratát, de semmi nem figyeli, és nincs kockázati besorolás vagy felülvizsgálati dátum.
- **Miért fontos:** ha a Kft. kötelezett, a kockázatértékelésnek az indulás előtt kell elkészülnie, és mulasztásért felügyeleti bírság jár.
- **Kié:** vegyes. Az ügyvéd dönti el, hogy a Kft. kötelezett-e; a tulaj és a könyvelő írja meg a dokumentumokat; a fejlesztés a lejárat figyelését építi meg.
- **Tervezve:** nem (csak a 2. ügyvédi kérdésként: jogi/README.md:135).
- **Bizonyíték:** Pmt. 27., 30., 31. § (2), 63. § (4a), 64., 65. § (9); kod/jogi/adatkezeles.md:84-92; kod/backend/src/routes/client.ts:452, :466; kod/backend/src/db/schema.ts:460-483.

### 1.5 Adatvédelem: adatfeldolgozók, szerződések, nyilvántartások, ki mit lát
- **Mi hiányzik:**
  - (a) Hiányos az adatfeldolgozók listája. Kimaradt a Lark Mail: az ugyfelszolgalat@ postafiók egy másik cég, a PrémiumJárgány Kft. Lark-szervezetében van. A Hetzner Storage Box csak feltételesen szerepel, pedig 11-21 óta óránként oda megy a mentés; a fiók közös a Kukutyini-archívummal, ezért tisztázni kell, ki a szerződő fél. A telefonszolgáltató helyén helyőrző áll. A díjszámla-levelet már nem a Számlázz.hu küldi.
  - (b) Nincs nyoma megkötött adatfeldolgozói szerződésnek (Contabo, Hetzner, Stripe, KBOSS, Zoho, Lark, Expo), és nincs rögzítve az USA-ba továbbítás jogalapja.
  - (c) Hiányzik a GDPR 30. cikk szerinti nyilvántartás, az incidens-nyilvántartás (33. cikk (5)), a fő adatkezelés hatásvizsgálata, az írásos érdekmérlegelés, és a döntés arról, kell-e adatvédelmi tisztviselő.
  - (d) A tájékoztató szerint a cég vezetése nem látja az üzeneteket, az iratokat és az adóazonosítót. A tulajdonosi konzol viszont mutatja az utolsó 100 üzenetet és az iratlistát, megnyitja az iratot, és felfedi az adóazonosító jelet és a telefonszámot (naplózva).
- **Miért fontos:** a GDPR 13., 28., 30. és 33. cikke feltétel nélkül kötelező, és egy valótlan „ki mit lát” állítás NAIH-panasznál a legkönnyebben bizonyítható hiba.
- **Kié:** vegyes. A tulaj köti meg a szerződéseket; az ügyvéd dönt a hatásvizsgálatról és a tisztviselőről; a fejlesztés vagy szűkíti a konzol hozzáférését, vagy átírja a tájékoztatót.
- **Tervezve:** részben. A marketing-kör M4 és M13 pontja csak a marketingre vonatkozik, a többi nincs tervben.
- **Bizonyíték:** kod/jogi/adatkezeles.md:11, :55, :213-223, :241; kod/jogi/adatfeldolgozoi.md:15, :148, :152-155; kod/backend/src/routes/admin-konzol.ts:74-89; kod/backend/src/services/konzol.ts:633-639; kod/deploy/README.md:275-290; kod/jogi/README.md:142-144; mem. :162; https://naih.hu/data-protection/gdpr-35-4-mandatory-dpia-list

### 1.6 Impresszum és ügyfélszolgálati elérhetőség
- **Mi hiányzik:** Az élő adozz.hu láblécéből hiányzik a cégbíróság, az e-mail-cím és a tárhelyszolgáltató (Ekertv. 4. §). A v2 láblécéből a tárhelyszolgáltató elérhetősége hiányzik. Az ügyfél által olvasott ÁSZF-ben és tájékoztatóban [CÉGADAT] helyőrzők látszanak, például „Képviseli: [CÉGADAT: ügyvezető neve]”, pedig az adat a brand.json-ban megvan. Telefonszám nincs: a brand.json-ban nincs rá mező, a `CALLBACK_CALLER_ID` üres, ezért az app azt sem tudja megmondani, melyik számról hívunk vissza. Nincs jegykezelés és ügyeleti rend. A 24–48 órás visszahívási idő nyitott döntés.
- **Miért fontos:** az Ekertv. folyamatos közzétételt ír elő, a Stripe aktiválása is kér elérhetőséget, és a visszahívás most a fizetés előtti lépés.
- **Kié:** tulaj (telefonszám, döntések) + fejlesztés (lábléc, helyőrzők).
- **Tervezve:** részben. A weboldal 3. köre hozza a cégbíróságot és az e-mail-címet (STATUS.md:49-51, K8_TERV.md:28); a telefonszám és a helyőrzők nincsenek ütemezve.
- **Bizonyíték:** kod/landing/dist/index.html:70, :76-78; dizajn/landing_v2/index.html:602-611; kod/jogi/aszf.md:22, :28; kod/jogi/adatkezeles.md:22; kod/shared/brand.json:13; kod/deploy/env.example:123-126; mem. :110, :158; Ekertv. https://net.jogtar.hu/jogszabaly?docid=a0100108.tv

### 1.7 Lemondás és megszűnés: ki adja be az utolsó év bevallásait
- **Mi hiányzik:** A lemondás képernyője szerint „a kifizetett hónap végéig a könyvelőd mindent intéz”, de nem derül ki, ki adja be az adott év SZJA-, HIPA- és '26KATA-bevallását, és mi lesz a NAV-meghatalmazással. A január 5-i éves zárás csak az 'aktiv' ügyfélnek nyílik meg, a 'megszunt' és a 'felfuggesztve' ügyfélnek nem; a 'megszunt' ügyfél csak olvashatja az adatait. Az ÁSZF szerint kérésre átadjuk az iratokat, de az appban erre nincs út: olvasható átadási csomag nincs, csak a GDPR-féle JSON-ZIP.
- **Miért fontos:** az ügyfelek jellemzően év végén mondanak le, a bevallás viszont májusig esedékes. Ha kimarad, mulasztási bírság jár, és vitás, ki a felelős.
- **Kié:** tulaj (döntés: benne van-e, és mennyiért) + fejlesztés.
- **Tervezve:** nem (az ÁSZF 8.2-ben [TULAJ] jelöléssel áll; jogi/README.md:157).
- **Bizonyíték:** kod/jogi/aszf.md:216, :232-234; kod/app/src/app/fiok/elofizetes.tsx:216; kod/backend/src/services/eves-zaras.ts:229; kod/backend/src/services/subscription.ts:932, :964; SPEC.md:1280; kod/backend/src/services/gdpr.ts:209-210.

### 1.8 KATA: befizetési tétel, számlaszám, emlékeztető, keret
- **Mi hiányzik:** A KATA-csomag 19 999 Ft, de nincs fizetési tétel a havi 50 000 Ft-hoz és a 40%-os különadóhoz. A `kata_teteles` és a `kata_kulonado` csak az enumban létezik. Nincs KATA-számlaszám a NAV_ACCOUNTS-ban, és nincs „Elutaltam” gomb vagy befizetés-ellenőrzés. A SPEC §28.K.4 szerinti emlékeztető (8-án és 12-én) meg van tervezve, de nincs megépítve. Az adómotor nem számol időarányos 18 M Ft-os keretet és különadót. A panel KATA-kártyája üres, a 'kata_figyelem' jelzőt semmi nem állítja be, és a '26KATA-nyilatkozat határideje nincs a Határidő-figyelőben.
- **Miért fontos:** a katás ügyfél egyetlen havi teendője ez, és egy kimaradt befizetésből hátralék és pótlék lesz. A fő ígéret („mindig tudod, mit és mikor fizess”) KATA-nál most nem teljesül.
- **Kié:** fejlesztés (+ könyvelő: Dávid 12. és 13. kérdése).
- **Tervezve:** részben. A havi befizetések követését a tulaj 11-21-én jóváhagyta (mem. :203; K8_TERV.md:57). A keretszámítás, a különadó és a '26KATA-határidő külön nincs megnevezve.
- **Bizonyíték:** kod/shared/src/enums.ts:176; kod/ado-motor/src/rules/2026.ts:6-26; kod/backend/src/jobs.ts:43-65; kod/backend/src/services/flags.ts:125, :133-134; kod/backend/src/seed/k28.ts:44; SPEC.md:3837; _munka/KONYVELO_LEFEDETTSEG.md:56-58, :160-161.

### 1.9 Értesítések: induláskor minden ügyfél webes, így a csak push-ként küldött jelzések elvesznek
- **Mi hiányzik:** Bolti app nincs, a teszt-APK nem adható ügyfélnek, ezért induláskor mindenki az app.adozz.hu-t használja. A weben a push-regisztráció azonnal kilép, és ha nincs push-token, e-mail sem megy helyette. Alapból csak push megy ki ezekről:
  - havi „Változott valami?” (checkin_due);
  - megnyílt az éves kérdőív (annual_due);
  - „valami rád vár” (nudge) és feltöltési emlékeztető;
  - új számla, irat feldolgozva, befizetés ellenőrizve, kérés kész;
  - „Folytasd” (guided_continue).
  A push élesben is ki van kapcsolva (nincs EAS projectId, FCM/APNs és EXPO_ACCESS_TOKEN).
- **Miért fontos:** a webes ügyfél appon kívül semmilyen jelzést nem kap a havi kérdőívről és az éves zárásról, ezért csúsznak a határidők.
- **Kié:** fejlesztés (e-mail-tartalék, ha nincs érvényes push-token; vagy az alapbeállítás átírása).
- **Tervezve:** nem. A LEVEL_LEFEDETTSEG.md:98 a #36-ot épp azzal a feltevéssel hagyta e-mail nélkül, hogy a push működik.
- **Bizonyíték:** kod/app/src/lib/push.tsx:24-26; kod/backend/src/notify/notify.ts:19-26, :78, :85-92, :120, :221-232; SPEC.md:643-644, :1148; dizajn/email/LEVEL_LEFEDETTSEG.md:98, :144.

### 1.10 Átutalásos fizetés (havi díjbekérő)
- **Mi hiányzik:** A bevezető kötelező utolsó lépése a kártya. Átutalás, díjbekérő (8 nap) és Autokassza-egyeztetés nincs; a vezérlőpult nem mutatja a fizetett / vár / késik állapotot. A rendelésszám-ismétlődés tiltása miatt havonta egyedi rendelésszám kell. Nyitott döntés: leálljon-e a könyvelés késésnél.
- **Miért fontos:** a tulaj szerint „sokan nem mernek kártyát megadni”, ők most a bekötés végén elakadnak.
- **Kié:** fejlesztés (+ tulaj: Erste-bankkapcsolat és Autokassza a Számlázz.hu-ban, a késés kezelése).
- **Tervezve:** igen, K8_TERV.md:20-22, :25, :58.
- **Bizonyíték:** STATUS.md:9-10, :17; dizajn/email/LEVEL_LEFEDETTSEG.md:142; mem. :143-146.

### 1.11 Megígért, de nem kezelt kiegészítő szolgáltatások: bérszámfejtés és ÁFA-bevallás közösségi adószámnál
- **Mi hiányzik:**
  - **Bérszámfejtés:** a tulaj döntése szerint felárért vállaljuk, az app viszont még ezt írja: „Bérszámfejtést most nem vállalunk”, és az Előfizetés lépés a könyvelő döntéséig zárva marad. Nincs ár, ajánlat-képernyő, havi 08-as bevallási határidő, irathely, és nincs bér- vagy EFO-nyilvántartás.
  - **ÁFA közösségi adószámnál** (pl. Facebook- vagy Google-hirdetés): a bekötés szövege szerint ilyenkor ÁFA-bevallás és összesítő nyilatkozat kell. Az ÁSZF 4.3 szerint ez „külön megállapodás”, de nincs hozzá ár, ÁFA-időszak, határidő és fizetési tétel. A megszüntetés-útmutató közben azt írja: „nincs ÁFA-bevallásod”. Az euPartner-válasz a könyvelő adatlapján nem látszik.
- **Miért fontos:** mindkettőnél havi vagy negyedéves bevallás marad ki, ami bírsággal jár. A bérszámfejtést kérő ügyfél ráadásul elakad a bekötésben.
- **Kié:** tulaj (árak) + könyvelő (folyamat) + fejlesztés.
- **Tervezve:** részben. Bérszámfejtés: a döntés megvan, ár nincs (K8_TERV.md:16). ÁFA: K8_TERV.md:57, Dávid 11. kérdése (KONYVELO_LEFEDETTSEG.md:159).
- **Bizonyíték:** kod/shared/src/bekotes.ts:300, :3132, :3589; kod/shared/src/k29f.ts:557; SPEC.md:3878; kod/shared/src/enums.ts:163; kod/jogi/aszf.md:77; kod/backend/src/services/registration.ts:98, :171; mem. :13.

### 1.12 Díjszámla: teljesítési dátum, számlatípus, a Kft. ÁFA-helyzete
- **Mi hiányzik:** A díjszámlán a teljesítés napja és a fizetési határidő egyaránt a fizetés napja ([KÖNYVELŐ], eldöntetlen), pedig a díj a következő hónapra szól, előre fizetve. Nincs eldöntve:
  - előleg- vagy végszámla legyen-e (Áfa tv. 58. §);
  - adószám nélküli új vállalkozónál kire szól a számla;
  - mi legyen a vevő címe.
  A Kft. ÁFA-helyzete nyitott tulaj-döntés.
- **Miért fontos:** hibás teljesítési dátummal minden díjszámla rossz ÁFA-időszakba és rossz NAV-adatszolgáltatásba kerül, utólag pedig tömeges sztornó kellene.
- **Kié:** könyvelő (+ tulaj).
- **Tervezve:** részben. A díjbekérőt és a saját levelet a K8 tervezi (K8_TERV.md:20-22, :58), a teljesítési dátumot nem.
- **Bizonyíték:** kod/backend/src/payments/szamlazzhu.ts:22, :120-131; kod/jogi/README.md:157; SPEC.md:1147 (#7); kod/jogi/aszf.md:43, :198.

### 1.13 Élesítési forgatókönyv, induló adatok és főpróba
- **Mi hiányzik:** Három lista él egymás mellett, és részben ellentmondanak egymásnak. A README „Élesítés” része elavult: SimplePay, Brevo, caddy/kezjegy.caddy szerepel benne. Egyik listában sincs benne:
  - a demó-fájlok és a demó-belépők kezelése;
  - az sslip.io-címek kivezetése (a natív build alapcíme is ilyen);
  - a demóadatos mentések elkülönítése;
  - a NAV_MODE=prod és a PUSH_MODE sorrendje;
  - a Google-hozzájárulási képernyő „Published” állapota;
  - záró füstpróba valódi adatokkal, és egy visszalépési pont.
  Nincs szkript arra sem, ami üres adatbázisban létrehozza az első admint (a tulajt) és a valódi könyvelőt (profil, TOTP). Az `eles_konyvelo.json`-t semmi nem olvassa. Ellenőrizni kell, hogy a díjak és a szövegek üres adatbázisban is a valódi értékkel jönnek-e létre.
- **Miért fontos:** az átállás egyszeri lépés, és ha valami kimarad (demókulcs, kikapcsolt kétlépcsős belépés, sslip-cím), az csak élesben derül ki.
- **Kié:** fejlesztés + tulaj.
- **Tervezve:** részben (README.md:144-153, STATUS.md:31-51); egységes lista és főpróba nincs.
- **Bizonyíték:** kod/deploy/README.md:144-153, :390-403; kod/deploy/proxy/caddy/sites/adozz.caddy:83, :94, :106; apk/build-apk.sh:7; kod/backend/src/seed/ (csak demó-seedek); a grep szerint az `eles_konyvelo` a fájlon kívül sehol nem szerepel; mem. :188, :193.

### 1.14 Külön tesztkörnyezet (staging) az éles mellett
- **Mi hiányzik:** Egyetlen környezet fut, és minden kör közvetlenül erre telepít. Élesítéskor a demó megszűnik (Dávid és Bence ezen nézi a panelt), és éles módban a rendszer elutasítja a teszt Stripe-kulcsot és a Számlázz.hu tesztfiókot. Így élesítés után nem lesz hol fizetést vagy új funkciót kipróbálni.
- **Miért fontos:** fizető ügyfelek mellett nem lehet próba nélkül, naponta többször közvetlenül a valódi adatokra telepíteni.
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** kod/deploy/README.md:13-58 (közvetlen élesítések); kod/deploy/env.example:69-71, :81-84; kezjegy_kulcsok.ps1:120, :133.

### 1.15 A NAV-számlaszinkron valódi próbája
- **Mi hiányzik:** A valódi NAV-val eddig csak az adószám-lekérdezés futott. A kiállított számlák napi lehívása (queryInvoiceDigest/Data), vagyis a termék lényege, csak szimulált adatokkal ment, és a szerveren NAV_MODE=demo. Kell egy próba egy valódi egyéni vállalkozó technikai felhasználójával (például a tulaj 2026.08.01. óta működő EV-jével): 35 napos ablakok, lapozás, hibaüzenetek, és hogyan veszi fel a könyvelő a technikai felhasználót.
- **Miért fontos:** a „mennyit tegyél félre” szám a NAV-ból jövő számlákon alapul.
- **Kié:** vegyes (tulaj: technikai felhasználó; fejlesztés: próba).
- **Tervezve:** részben (SPEC §23 6. sor; mem. :188); élő szinkronpróba nincs tervben.
- **Bizonyíték:** kod/nav-kliens/tools/nav_eles_proba.mjs:1-3; SPEC.md:1146; mem. :64, :167, :188.

### 1.16 Kártyás fizetés és díjszámlázás élesítése
- **Mi hiányzik:** A Stripe-fiók aktiválása (cégadatok, képviselő, bankszámla, ADOZZ kivonat-megnevezés, a Stripe saját nyugtái kikapcsolva, Radar), utána `stripe_szerverre.ps1 -Eles`. Számlázz.hu: `INVOICE_MODE=szamlazzhu`, `SZAMLAZZHU_ACCOUNT=eles`. Végül egy valódi 19 999 Ft-os fizetés, visszatérítés és sztornó.
- **Miért fontos:** enélkül nincs bevétel és szabályos számla.
- **Kié:** tulaj.
- **Tervezve:** igen (STATUS.md:38-45; README.md:148-153).
- **Bizonyíték:** STATUS.md:24-27, :38-45; mem. :101, :104.

### 1.17 Felügyelet és riasztás
- **Mi hiányzik:** Nincs külső figyelés (a szerveren kívülről), nincs cron- és heartbeat-figyelés (worker, mentés, a 05:30-as NAV-szinkron, Stripe-webhook, díjszámla-hibák), nincs tanúsítványlejárat-figyelés, és nincs riasztás telefonra vagy e-mailre. Az admin Rendszer lapja csak akkor mutat bármit, ha valaki megnyitja.
- **Miért fontos:** ha a worker leáll, nincs levonás és nincs emlékeztető, és erről most csak ügyfélpanaszból értesülnénk.
- **Kié:** fejlesztés.
- **Tervezve:** igen. A tulaj 11-21-én jóváhagyta (Uptime Kuma, funkcióellenőrzés, riasztás; mem. :203). Tervezés alatt, építés a marketing után.
- **Bizonyíték:** kod/backend/src/routes/admin.ts:877-935; kod/deploy/backup.sh:32-33; a grep szerint nincs uptime/sentry/kuma.

### 1.18 Biztonság élesítéskor: titokcsere, kétlépcsős belépés, hozzáférések
- **Mi hiányzik:**
  - **Titokcsere:** az élesítési terv csak új adatbázist ír elő, a demóhoz generált titkok maradnának (JWT, HMAC, FILE_ENC_KEY, APP_DATA_KEY, NAV_CRED_KEY, .backup_pass, adatbázis-jelszavak). Cserére vár a chatbe került NAV TESZT-kulcs és a Számlázz.hu tesztkulcsa, meg kell szüntetni a helyi DEMO_BELEPESEK.txt-t, és nincs rotációs rend.
  - **A szerveren:** STAFF_TOTP_REQUIRED=false; az sshd-ben X11Forwarding yes; jelszó nélküli sudo, amivel az ügynökök is dolgoznak; a Postgres tulajdonosi szerepe szuperfelhasználó; HSTS includeSubDomains nélkül; a konzol bárhonnan elérhető (megfontolandó IP-szűrés vagy Tailscale); a fail2ban csak az sshd-t védi; 1 biztonsági frissítés vár.
- **Miért fontos:** a konzolból minden ügyféladat, a visszatérítés és a felmondás elérhető, és ezeken a kulcsokon múlik az adóadatok titkosítása.
- **Kié:** vegyes.
- **Tervezve:** részben (README.md:453-462, :488-489, [TULAJ]; mem. :90, :111); a teljes .env-csere, a sudo és az admin-elérés szűkítése nincs tervben.
- **Bizonyíték:** kod/deploy/README.md:390-403 (nincs titokcsere-lépés); kod/deploy/env.example:28-37; kezjegy_kulcsok.ps1:137-141; a szerver olvasó ellenőrzése (11-20, az élesítési szemszög szerint).

### 1.19 Mentés: ami a restic után még hiányzik
- **Mi hiányzik:** A visszaállítási próba (11-21 00:09) csak az adatbázisra futott: a titkosított fájlok és az app működése visszaállítás után nincs kipróbálva, és a próbát semmi nem ütemezi. Nincs kimondva, mennyi adatvesztés és kiesés fér bele (RPO/RTO). A titkosító kulcsok és a restic-jelszó offline másolata [TULAJ] tétel, a jelszó most csak a szerveren és a tulaj gépén van.
- **Miért fontos:** egy soha ki nem próbált teljes visszaállítás valódi baj esetén jó eséllyel nem működik.
- **Kié:** vegyes.
- **Tervezve:** részben (a restic-kör folyamatban; README.md:302-311).
- **Bizonyíték:** kod/deploy/README.md:295, :302-311; kod/deploy/restore-proba.sh:8-20; SPEC.md:1152 (#12).

### 1.20 Incidens- és üzemzavar-terv, incidens-nyilvántartás
- **Mi hiányzik:** Nincs írott terv arra, ki észleli a bajt, ki dönt, mit kapcsolunk le (vannak hozzá kapcsolók), kit és milyen szöveggel értesítünk (ügyfél, könyvelő, 72 órán belül a NAIH). Nincs leírva a teendő dupla terhelésnél, NAV-határidő előtti kiesésnél és a könyvelő kiesésénél. A GDPR 33. cikk (5) szerinti incidens-nyilvántartás sincs.
- **Miért fontos:** a tájékoztató már ígéri a 72 órás bejelentést, az adatfeldolgozói szerződés pedig a 24 órás értesítést.
- **Kié:** vegyes.
- **Tervezve:** nem.
- **Bizonyíték:** kod/jogi/adatkezeles.md:255; kod/jogi/adatfeldolgozoi.md:102-104; README.md:460.

### 1.21 Telepítés: visszaállítható kiadás
- **Mi hiányzik:** Az image mindig `latest` néven a szerveren épül, és felülírja az előzőt, így nincs mire visszaállni. Nincs CI, és nincs leírt visszalépés hibás migráció esetére (a pg_restore az azóta beírt adatokat eldobja). Nincs karbantartási ablak és expand–contract szabály.
- **Miért fontos:** éles adatok mellett egy rossz kiadásnál percek alatt, adatvesztés nélkül kell tudni visszaállni.
- **Kié:** fejlesztés.
- **Tervezve:** részben (mentés a migráció előtt: up.sh:38-51; csak bővítő migráció: README.md:459).
- **Bizonyíték:** kod/deploy/docker-compose.yml:46, :75; kod/deploy/up.sh:25-27, :57; nincs .github mappa.

---

## 2. ELSŐ HÓNAPBAN

### 2.1 Évváltás 2027: KEMÉNY DÁTUM, 2027. január 1. (ÚJ tétel)
- **Mi hiányzik:**
  - (a) 2027. január 1-jétől az egyéni vállalkozók nyilvántartását a kamara vezeti (a SPEC szerint 2026. évi III. tv.). A rendszer ezen a napon magától elavultnak jelöli az új vállalkozás, a változás és a megszüntetés útmutatóit, és lekapcsolja a segített EV-ügyintézést (`ASSIST_EV_VALID_UNTIL=2026-12-31`). Ha addig nem frissítjük, leállnak a fizetős „Intézzük helyetted” tételek (4 999 / 7 999 Ft), és az ÁSZF 4/A.5 is elavul.
  - (b) A 2027-es adószabályok tervezetek: a 2026-os minimálbért, garantált bérminimumot és adómentes részt viszik tovább. A 2027-es áthelyezett munkanapok listája üres. Nincs olyan folyamat, amelyben a könyvelő évente jóváhagyja a szabályértékeket; Dávid a 2026-osakat sem nézte még át.
- **Miért fontos:** januártól minden félretenni-összeg és járulékminimum ezen fut. A kamarai átállás pedig magától kikapcsol egy fizetős szolgáltatást.
- **Kié:** vegyes (könyvelő + tulaj + fejlesztés).
- **Tervezve:** részben. SPEC §27.13 #26 és §26 #19 („decemberben újraellenőrizni”), jogi/README.md:162; a szabályok frissítését csak a 2027.ts kódkommentje írja elő.
- **Bizonyíték:** SPEC.md:1422, :1653, :1910, :2525, :2535; kod/backend/src/config.ts:449-454; kod/shared/src/bekotes.ts:828, :1021, :2741; kod/backend/src/content/tulaj1118.ts:69; kod/ado-motor/src/rules/2027.ts:4-18; kod/ado-motor/src/rules/holidays.ts:14-40; _munka/KONYVELO_LEFEDETTSEG.md:165-172.

### 2.2 Nincs azonnali jelzés a csapatnak és a könyvelőnek (ÚJ tétel)
- **Mi hiányzik:** A visszahívás-kérés (`callback_new`) és az ügyfél új üzenete (`client_message_new`) se pusht, se e-mailt nem küld. A csapat és a könyvelő csak a panelen látja, ha éppen nyitva van, vagy a másnap reggel 8-kor kiküldött összesítőben. A visszahívás most a kártya előtti értékesítési lépés, mégsem mérjük, hány visszahívást kérő fizet, mennyi idő telik el a kérés és a hívás között, és nincs beszélgetési vezérfonal sem.
- **Miért fontos:** a délelőtt visszahívást kérő ügyfél akár másnapig vár, közben megnézi a versenytársat; a felhasználói próbán már a 24–48 óra is lassúnak tűnt.
- **Kié:** fejlesztés (azonnali e-mail vagy push a csapatnak, mérés) + tulaj (vezérfonal, válaszidő).
- **Tervezve:** nem (K8_TERV.md:15 csak a sorrendet rögzíti, a :28 a 24–48 órát nyitva hagyja).
- **Bizonyíték:** kod/backend/src/notify/notify.ts:29, :60-61; kod/backend/src/jobs.ts:119-133, :331-332; dizajn/C5_v2/USER_TESZT.md:18.

### 2.3 Éves ciklus: különbözet, önellenőrzés, NAV-folyószámla, NAV-levelek, éves értesítések
- **Mi hiányzik:**
  - Az Éves zárás képernyő nem mutatja a fizetendő vagy visszajáró különbözetet (SZJA/TB/szocho/HIPA), és nincs belőle fizetési tétel. A `hipa_kulonbozet` fajtát semmi nem használja.
  - Önellenőrzés nincs: a beadott negyedév zárolva van.
  - A NAV-folyószámlát semmi nem egyezteti (a kódban a szó sem szerepel).
  - A NAV-levélnek nincs válaszhatárideje.
  - A január 5-i megnyitás és a „valami rád vár” jelzés alapból csak push.
  - A kérdőív határideje (márc. 15. / febr. 5.) után nincs eszkaláció május 20-ig.
  - Az évi 5 000 Ft-os kamarai hozzájárulás nincs a határidők között.
- **Miért fontos:** a 2026-os év zárása 2027. január 5-én nyílik, és az ügyfelet ilyenkor egyetlen szám érdekli: mennyit kell még fizetnie, vagy mennyit kap vissza.
- **Kié:** fejlesztés (+ könyvelő: Dávid 6. és 7. kérdése).
- **Tervezve:** részben. A különbözetet, az önellenőrzést és a folyószámlát a tulaj 11-21-én jóváhagyta (mem. :203; K8_TERV.md:57). A NAV-levelek határideje, az e-mail, az eszkaláció és a kamarai határidő nincs benne.
- **Bizonyíték:** kod/backend/src/services/eves-zaras.ts:72-86, :246-259; kod/backend/src/services/flags.ts:115-118; kod/backend/src/services/tax.ts:420-421; kod/shared/src/enums.ts:163, :172, :176; kod/backend/src/notify/notify.ts:87, :91; kod/backend/src/services/documents.ts:306-308; kod/shared/src/bekotes.ts:526; dizajn/email/LEVEL_LEFEDETTSEG.md:101 (#44).

### 2.4 Könyvelőváltók: átvételi folyamat és ajánlat januárra
- **Mi hiányzik:** Nem rögzíthető az előző évi HIPA (ebből jön az előleg), a nyitó folyószámla-egyenleg, a korábbi negyedévek beadott 2658-asai, és az átadás-átvételi irat. Csak az előző könyvelő neve kerül be szövegként. Értékesítési ajánlat sincs: hiányzik az „Átvesszük a régi könyvelődtől” lépéssor (régi meghatalmazás visszavonása, ki adja be a régi negyedévet, nincs dupla díj). A „Könyvelőt váltasz?” szöveg a könyvelőre vár.
- **Miért fontos:** a célcsoport többségének már van könyvelője, a természetes váltási pont január, ami kb. 6 hét múlva van; a hibás nyitó adat egész évben rossz előleget ad.
- **Kié:** vegyes.
- **Tervezve:** nem (csak javaslat: KONYVELO_LEFEDETTSEG.md:123-124; SPEC §27.13 #29).
- **Bizonyíték:** kod/panel/src/pages/acc/ugyfel/Attekintes.tsx:126-161; kod/backend/src/db/schema.ts:336; dizajn/landing_v2/index.html:128; SPEC.md:2528.

### 2.5 Egyetlen könyvelő: kapacitás, helyettesítés, toborzás
- **Mi hiányzik:** A kapacitás alapértéke 150 ügyfél, ezt senki nem egyeztette Dáviddal. Ha minden könyvelő betelt, az új ügyfél könyvelő nélkül marad, és erről senki nem kap jelzést. Nincs előrejelzés, toborzási folyamat és egységes feltételrendszer. Ideiglenes helyettes sincs, csak végleges áthelyezés, és minden /acc útvonal a saját ügyfelekre szűr. A helyettes NAV-jogosultsága a jogcímen múlik (1.3 c).
- **Miért fontos:** a IV. negyedév határideje január 12., ez a téli szabadság ideje; ha Dávid kiesik, megáll minden jóváhagyás.
- **Kié:** vegyes.
- **Tervezve:** részben (helyettesítés: K8_TERV.md:57); a kapacitásriasztás és a toborzás nincs tervben.
- **Bizonyíték:** kod/backend/src/services/accounts.ts:28-55; kod/backend/src/routes/admin.ts:571; kod/backend/src/routes/acc.ts:98-112; kod/backend/src/services/konzol-muveletek.ts:361-376; kod/backend/src/db/schema.ts:288.

### 2.6 Regisztrációs és bekötési levelek: „Folytasd”, üdvözlés, első 30 nap
- **Mi hiányzik:** A `guided_continue` értesítést semmi nem küldi, és e-mailben ki is van kapcsolva. Üdvözlő levél nincs. Aki a szerződésnél vagy a kártyánál megáll, nem kap emlékeztetőt (a tulaj saját tesztfiókja is ott áll). Nincs „első 30 nap” tippsor. Új vállalkozásnál van emlékeztető, a „van vállalkozásom” úton nincs.
- **Miért fontos:** a hirdetésből érkező, félúton megálló regisztrálók a legolcsóbban visszahozható ügyfelek.
- **Kié:** fejlesztés.
- **Tervezve:** részben (a szöveg kész: LEVEL_LEFEDETTSEG.md 3. pont 14. és 16.); építésre nincs ütemezve.
- **Bizonyíték:** kod/backend/src/notify/notify.ts:120; dizajn/email/LEVEL_LEFEDETTSEG.md:27, :43, :64, :201-210; kod/backend/src/jobs.ts:82-100; mem. :199.

### 2.7 Lemondás: ok és jelzés a tulajnak
- **Mi hiányzik:** A „Lemondom” egy megerősítés után lefut, okot nem kérdez. A lemondásról csak az ügyfél kap értesítést, a tulaj és a könyvelő nem.
- **Miért fontos:** ok nélkül nem derül ki, mi viszi el az ügyfeleket; jelzés nélkül pedig nincs esély felhívni őt a kifizetett időszak vége előtt.
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** kod/app/src/app/fiok/elofizetes.tsx:213-236; kod/backend/src/services/subscription.ts:610-627; SPEC.md:4637.

### 2.8 Tulajdonosi számok és a könyvelő havi elszámolása
- **Mi hiányzik:** Van MRR, új és lemondott ügyfelek száma, beszedett bevétel. Hiányzik: lemorzsolódási arány, kohorszonkénti megtartás, LTV és LTV/CAC. Hiányzik az ügyfelenkénti fedezet: ÁFA, a könyvelő 5 100 Ft-ja, a Stripe kb. 385 Ft-ja és a Számlázz.hu Agent-díja után. Nincs havi könyvelői elszámolás (hány aktív ügyfél után mennyi jár), és nincs heti összefoglaló e-mail a tulajnak.
- **Miért fontos:** csak MRR-ből nem látszik, megéri-e egy hirdetés vagy egy kedvezmény, és mikor szivárog az ügyfélkör.
- **Kié:** fejlesztés.
- **Tervezve:** részben. A marketing-kör forrásonkénti MRR-t és ügyfélszerzési költséget ad (folyamatban); a többi nincs tervben.
- **Bizonyíték:** SPEC.md:4635-4641; kod/backend/src/services/konzol.ts:223-330; kod/backend/src/jobs.ts:119-133; mem. :10-11, :101, :103.

### 2.9 ÁFA- vagy átalánykeret átlépése: nincs „mi történik most” út
- **Mi hiányzik:** Évente egyszer, 80%-nál jön egy figyelmeztetés, 90–100%-nál nincs. Az átalánykeret közelségéről nem jön értesítés. Átlépéskor nincs teendősor (bejelentés, a számlázó átállítása, 4 éves kizárás). Nincs eldöntve, mi lesz az előfizetéssel (ÁSZF 3.3: „megbeszéljük”).
- **Miért fontos:** a sikeres ügyfél épp ebbe ütközik bele, és ha ÁFA nélkül számláz tovább, visszamenőleges ÁFA-t és bírságot fizet.
- **Kié:** vegyes.
- **Tervezve:** nem (csak javaslat: KONYVELO_LEFEDETTSEG.md:115-116).
- **Bizonyíték:** kod/backend/src/jobs.ts:104-116; kod/backend/src/services/flags.ts:36-40; kod/shared/src/enums.ts:1470; SPEC.md:3757; kod/jogi/aszf.md:59.

### 2.10 Évközi jogállás-váltás (munkaviszony, nyugdíj)
- **Mi hiányzik:** A motor évente egy jogállást ismer. Évközi váltáskor csak rendszerjegyzet készül, a járulék és a félretenni-összeg a régi állapottal számol tovább, pedig az ügyfél 7 999 Ft-ot fizet a változásért.
- **Miért fontos:** hibás TB- és szocho-alap lesz a teljes évre, és ez az egyik leggyakoribb élethelyzet.
- **Kié:** fejlesztés.
- **Tervezve:** igen (K8_TERV.md:57).
- **Bizonyíték:** kod/backend/src/routes/acc.ts:369-383; kod/shared/src/enums.ts:1471-1472.

### 2.11 Utólagos változás egy lezárt vagy beadott negyedévben
- **Mi hiányzik:** A késve érkező számlára vagy iratra az adómotor csak a számolás belsejében figyelmeztet. Nincs belőle ügyféllista-jelző vagy teendő. A „document.after_filing” naplóbejegyzést semmi nem olvassa.
- **Miért fontos:** 100–200 ügyfélnél a beadott 2658 hibás marad, és az önellenőrzés elmarad.
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** kod/ado-motor/src/engine/year.ts:399; kod/backend/src/services/flags.ts:14-47; kod/backend/src/routes/client.ts:756-763.

### 2.12 Bevételek, amelyek nincsenek a NAV Online Számlában
- **Mi hiányzik:** Ide tartozik a nyugta, a pénztárgép, a platformok által kiállított (önszámlázott) bevétel és az OSS. Az ügyfél összeget nem adhat meg, csak fájlt tölthet fel. A fotóból előtöltés (§28.K.12/5) nincs megépítve. A NAV nyugta-összesítőjét és a pénztárgépes adatokat nem kérdezzük le.
- **Miért fontos:** a fodrász vagy a kiskereskedő ügyfélnél az app a valósnál kisebb adót mutat.
- **Kié:** fejlesztés.
- **Tervezve:** részben (SPEC §28.K.12/5 leírva, nincs megépítve).
- **Bizonyíték:** SPEC.md:2263, :3982; kod/backend/src/routes/client.ts:664; mem. :75.

### 2.13 Új vállalkozó: „első számla” útmutató
- **Mi hiányzik:** Az új vállalkozás útja az adószámmal véget ér. Nincs lépés a számlázóprogram kiválasztására, az alanyi mentesség jelölésére és a NAV-adatszolgáltatás beállítására, pedig a bevételek lehívása erre épül.
- **Miért fontos:** ha a frissen indult ügyfél rosszul számláz, a NAV-ból semmi nem jön be, és az app üres marad.
- **Kié:** vegyes.
- **Tervezve:** nem.
- **Bizonyíték:** SPEC.md:1454-1455; kod/shared/src/bekotes.ts:488, :2437.

### 2.14 Az ügyfél nem látja, ha a NAV-adatai elavultak
- **Mi hiányzik:** NAV-hiba esetén csak a könyvelő és az admin kap levelet. Az appban nincs „utoljára frissítve” időpont és figyelmeztetés sem.
- **Miért fontos:** az ügyfél a félretenni-összeg és a keretek alapján dönt, és ezek napokig elavultak lehetnek úgy, hogy erről nem tud.
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** dizajn/email/LEVEL_LEFEDETTSEG.md:13; a grep szerint lastSync/syncedAt nincs az api.ts-ben és az appban.

### 2.15 E-mail-cím és telefonszám önálló módosítása
- **Mi hiányzik:** A PATCH /me csak a nevet és az értesítési beállításokat fogadja. Az e-mail-címet csak az admin módosíthatja. A „Nem férek hozzá az e-mailemhez” út csak mintaként létezik.
- **Miért fontos:** az e-mail a belépés, a kétlépcsős kód és minden levél csatornája; aki elveszti a postafiókját, kizárja magát.
- **Kié:** fejlesztés.
- **Tervezve:** részben (minta: dizajn/C5_v2 14 → 71).
- **Bizonyíték:** kod/backend/src/routes/me.ts:104-115; kod/app/src/app/fiok/adataim.tsx:42-61; kod/backend/src/services/konzol-muveletek.ts:139-168.

### 2.16 Gépes nézet (app.adozz.hu)
- **Mi hiányzik:** A jóváhagyott asztali elrendezés nincs beépítve, a web ma telefonos elrendezésben jelenik meg.
- **Miért fontos:** induláskor mindenki a webet használja, és a kivonatokat, PDF-eket a legtöbben gépről töltik fel.
- **Kié:** fejlesztés.
- **Tervezve:** igen (K8_TERV.md:31-32, :53).
- **ÁLLAPOT 11-21 16:00 (k8):** KÉSZ és él: app.adozz.hu 1024 px felett bal menüvel, kártyaráccsal, kétpaneles üzenetekkel, osztott belépővel. Hiányzik még: a Határidők és a Számla kétpaneles gépes nézete, webkamerás fotó gépen.
- **Bizonyíték:** dizajn/C5_v2/asztali/; mem. :169-175.

### 2.17 Könyvelői törzsadatok: meghatalmazás terjedelme, ÖVTJ-kódok
- **Mi hiányzik:** A meghatalmazásnak csak a módja és a fájlja van meg; az adónemek, az érvényesség és a visszavonás nem rögzíthető. A 38 tevékenységből 35-nek nincs ÖVTJ-kódja, ügyfelenként csak egy kód adható meg, és a 80%-os költséghányad nincs kódhoz kötve.
- **Miért fontos:** a rossz költséghányad minden negyedévet elront, és ha a meghatalmazás nem fedi a beadandó bevallást, a beadás érvénytelen.
- **Kié:** könyvelő + fejlesztés.
- **Tervezve:** igen (K8_TERV.md:57; Dávid 15. kérdése és DAVID_KERDESEK.md:188).
- **Bizonyíték:** kod/shared/src/enums.ts:109; kod/shared/src/bekotes.ts (35 db `ovtjKod: null`); kod/backend/src/routes/acc.ts:366-367.

### 2.18 Bolti megjelenés, OTA-frissítés, minimumverzió
- **Mi hiányzik:** Csak debug-kulccsal aláírt teszt-APK van. Nincs feltöltési kulcs, .aab, Play-fiók, Apple Developer-fiók, EAS és bolti adatlap. Nincs „Sign in with Apple” (Apple 4.8). Nincs expo-updates és nincs általános „Frissítsd az appot” minimumverzió, holott a regisztráció változása egyszer már használhatatlanná tette a kint lévő APK-t. Induláskor dönteni kell: csak webbel indulunk-e.
- **Miért fontos:** a boltok ellenőrzése napokig vagy hetekig tart, és boltból telepített appnál a backend-változás eltörheti a régi verziót.
- **Kié:** vegyes (tulaj: fiókok; fejlesztés: build, OTA).
- **Tervezve:** részben (apk/README.md:53-58; K8_TERV.md:59, :68); kiadási terv nincs.
- **Bizonyíték:** kod/app/android/app/build.gradle:110-115; kod/app/app.config.ts:65, :85, :107; kod/deploy/README.md:19-21; mem. :83, :192-196; https://developer.apple.com/app-store/review/guidelines/#login-services

### 2.19 Üzemeltetés: hibakövetés, naplómegőrzés, lemezhely
- **Mi hiányzik:** Nincs hibagyűjtő (például önállóan futtatott GlitchTip); az app, a panel és a telefonos összeomlások hibái sehová nem jutnak el. A konténernaplók konténerenként legfeljebb 3×10 MB-ig élnek, és minden élesítéskor elvesznek; központi gyűjtés és megőrzési szabály nincs. A Docker build cache 10,65 GB, a _regi 2,9 GB és nő; riasztás és archiválási rend nincs.
- **Miért fontos:** egy panasz vagy incidens kivizsgálásához napokra visszamenő napló kell, a betelt lemez pedig leállítja az adatbázist.
- **Kié:** fejlesztés.
- **Tervezve:** részben (a felügyeleti terv, mem. :203, ezt fedheti; a naplómegőrzés és az archiválás nincs benne).
- **Bizonyíték:** kod/deploy/docker-compose.yml:13-17; kod/deploy/up.sh:57, :61; kod/deploy/proxy/caddy/sites/adozz.caddy:5-6; kod/deploy/backup.sh:28-34; a szerver olvasó ellenőrzése (11-20).

### 2.20 Biztonsági rutin: peremvédelem és függőségfrissítés
- **Mi hiányzik:** A kérésszám-korlát csak az API memóriájában él, újraindításkor nullázódik; a proxyban nincs korlát, WAF és DDoS-védelem. Nincs Dependabot vagy Renovate, nincs npm audit, és az alapképek lebegő címkéről épülnek.
- **Miért fontos:** a regisztráció és az elfelejtett jelszó végpontja e-mailt küld (költség, feladói hírnév), és az ismert sérülékenységek kihasználása a leggyakoribb támadás.
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** SPEC.md:192 (§4.3); kod/deploy/proxy/caddy/sites/adozz.caddy:42-67; kod/backend/Dockerfile:4, :29; kod/deploy/docker-compose.yml:21, :146.

### 2.21 E-mail-kézbesítés
- **Mi hiányzik:** Nincs visszapattanás- és panaszkezelés (ZeptoMail bounce): ha egy ügyfél címe rossz, a díjbekérő és az emlékeztető csendben elveszik. Az ertesites@ címre küldött válasz visszapattan, ehhez alias kell (élesítés előtt, a tulaj teendője). A DMARC p=none.
- **Miért fontos:** a fizetés és a határidők e-mailre épülnek.
- **Kié:** vegyes.
- **Tervezve:** részben (alias: K8_TERV.md:62); a bounce-kezelés nincs tervben.
- **Bizonyíték:** kod/backend (csak stripe/simplepay webhook); mem. :157, :191.

### 2.22 Megőrzés és törlés
- **Mi hiányzik:** A mentések soha nem törlődnek (régi dumpok, restic), ezért a fióktörlés és a tájékoztatóban vállalt megőrzési idők a mentésekben nem teljesülnek. Több kategóriánál maga a tájékoztató írja, hogy az automatikus törlés „még nincs”. A napló 5 év után törlődik, ami rövidebb lehet az adó elévülésénél. A tájékoztató napi mentést ír, valójában óránkénti van.
- **Miért fontos:** ez a GDPR 5. cikk (1) e) és 17. cikkét sérti, és NAIH-panasznál nehéz megmagyarázni. A mentési szabályt és a tájékoztató mondatát már élesítéskor rögzíteni kell.
- **Kié:** vegyes.
- **Tervezve:** nem.
- **Bizonyíték:** kod/backend/src/services/gdpr.ts:334-338, :437-445; SPEC.md:231; kod/jogi/adatkezeles.md:134, :163, :188, :253, :265, :279-297; kod/jogi/README.md:142.

### 2.23 Árazási döntések: KATA-ár, külön díjak, próbaidő vagy garancia
- **Mi hiányzik:** A KATA-csomag ára 19 999 Ft, a versenytársaknál ez kb. 11 500–14 990 Ft. A felhasználói próbán a külön díjak (14 999 / 4 999) „lehúzásszagúnak” hatottak. Próbaidő nincs, és helyette sincs „első hónap pénzvisszafizetés” garancia, pedig az időarányos visszatérítés technikailag kész.
- **Miért fontos:** a díjtábla az első ügyfelek ÁSZF-jébe kerül, és később csak 30 napos előzetes értesítéssel emelhető.
- **Kié:** tulaj.
- **Tervezve:** részben (K8_TERV.md:28: a plusz díjak kérdése nyitott).
- **Bizonyíték:** mem. :85; dizajn/C5_v2/USER_TESZT.md:9, :13, :17; SPEC.md:4532-4536, :4677; https://www.okoskonyvelom.hu/arak

### 2.24 Valódi vélemények és elégedettség gyűjtése
- **Mi hiányzik:** Nincs NPS-kérdés jó pillanatban (például a jóváhagyás után), nincs közzétételi hozzájárulással kért vélemény, Google Cégprofil és áruházi értékelés-kérés sem; a landing vélemény-sávja rejtve van.
- **Miért fontos:** új márkánál a bizalom a fő akadály, és az első 20–50 ügyfél véleménye adja a hirdetések anyagát.
- **Kié:** vegyes.
- **Tervezve:** részben (a rejtett sáv: mem. :194).
- **Bizonyíték:** a grep szerint a kódban nincs nps/requestReview; mem. :182, :194.

### 2.25 YouTube- és tartalomcsatorna
- **Mi hiányzik:** Nincs tartalomterv („Hogyan működik?” formátumban), lead-mágnes (kalkulátor), nézői kód, szezonális naptár (január, május 20.), és tudástár a keresőből érkezőknek.
- **Miért fontos:** a tulaj YouTuber, ez a legolcsóbb saját csatornája.
- **Kié:** tulaj.
- **Tervezve:** részben (a kampánylink-készítő a marketing-körben).
- **Bizonyíték:** mem. :201; SPEC.md:3891-3897; kod/backend/src/db/schema.ts:2069-2070.

### 2.26 Az „Adózz” név védjegyvizsgálata
- **Mi hiányzik:** Nem készült SZTNH/EUIPO-kutatás. A név a Számlázz.hu mintáját idézi, ugyanabban a piacban.
- **Miért fontos:** ütközés esetén márkanevet, domaint, appot és boltfiókot kell cserélni, ezért a nagyobb marketingköltés előtt érdemes megnézni.
- **Kié:** ügyvéd.
- **Tervezve:** nem (csak a mem. :71 jegyzi).
- **Bizonyíték:** mem. :71; a „védjegy” szó a kod/jogi mappában nem szerepel.

---

## 3. KÉSŐBB

### 3.1 Bank- és Billingo-bekötés, kivonat-továbbítás
- **Mi hiányzik:** A befolyás napja becsült, és az ügyfél nem jelölheti „megkaptam”-nak. A kivonatot havonta kézzel kell feltölteni. A továbbító e-mail-cím (§28.K.12/6) csak adatbázis-oszlop. Bankbekötés (Aggreg8, Enable Banking) és Billingo API v3 csak kutatásként létezik.
- **Miért fontos:** átalányadónál az adó a pénz megérkezésétől függ, és a versenytársak bankszinkronnal dolgoznak.
- **Kié:** vegyes (tulaj: ajánlatkérés).
- **Tervezve:** részben (FUNKCIOK.md:64 „Később”; _munka/bankbekotes_kutatas_2026-11-19.md).
- **Bizonyíték:** kod/app/src/app/szamla/[id].tsx:77, :86; SPEC.md:3984-3990; mem. :70, :75.

### 3.2 A könyvelő tömeges munkája 100–200 ügyfélnél
- **Mi hiányzik:** Nincs negyedéves zárási tábla minden ügyfélre, „Ma” nézet és közös olvasatlan-lista. Csoportos számolás, jóváhagyás (sablonlevéllel) és befizetés-ellenőrzés nincs. A Dosszié havi „átnézve” állapota és az irat új verziója a szerveren megvan, a panelen nincs hozzá gomb.
- **Miért fontos:** ez negyedévente kb. 600 kattintássorozat és 200 kézzel írt levél.
- **Kié:** fejlesztés.
- **Tervezve:** részben (K8_TERV.md:57: zárási tábla, „Ma” nézet); a csoportos műveletek nem.
- **Bizonyíték:** kod/backend/src/routes/acc.ts:266, :635-646, :706, :757, :840, :994, :1027; kod/panel/src/App.tsx:139.

### 3.3 Teljesítmény és skálázás
- **Mi hiányzik:** Az ügyféllista minden betöltéskor ügyfelenként 6–8 lekérdezést és egy teljes éves számítást futtat, lapozás és gyorsítótár nélkül. A Határidő-figyelő és a konzol áttekintője szintén mindent betölt. Terhelésteszt nem volt (egy VPS, egy API-példány, soros NAV-szinkron).
- **Miért fontos:** a csúcs pont a határidők előtt jön, amikor a lassulás a legdrágább.
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** kod/backend/src/routes/acc.ts:189-216, :1337-1345; kod/backend/src/services/konzol.ts:229, :250-251, :391; SPEC.md §15.

### 3.4 Bevallás-előkészítés: 2658 nyomtatványsor-nézet vagy ÁNYK/ONYA-fájl
- **Mi hiányzik:** Csak havi tábla van, minden bevallást kézzel kell begépelni.
- **Miért fontos:** évente kb. 800 negyedéves és 200 éves bevallásnál a kézi átgépelés a leggyakoribb hibaforrás.
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** kod/panel/src/pages/acc/ugyfel/Ado.tsx:329-369; KONYVELO_LEFEDETTSEG.md:77, :135.

### 3.5 Iparűzési adó: több település, költözés, önkormányzati adatok
- **Mi hiányzik:** Egy szöveges székhely-település van. A számlaszámot kézzel kell beírni, és nincs önkormányzati kulcs- és számlaszámtábla.
- **Miért fontos:** a félreutalás és a hiányzó HIPA-megosztás bírsággal jár.
- **Kié:** vegyes.
- **Tervezve:** nem.
- **Bizonyíték:** kod/backend/src/db/schema.ts:331; kod/backend/src/routes/acc.ts:233.

### 3.6 Négy szem elve az adó jóváhagyásánál és beadásánál
- **Mi hiányzik:** A jóváhagyást, a kézi módosítást és a beadást egy ember végzi, második ellenőr és mintavétel nélkül.
- **Miért fontos:** nagy ügyfélszámnál a fáradtságból eredő hiba szűretlenül megy ki.
- **Kié:** vegyes.
- **Tervezve:** igen (K8_TERV.md:57).
- **Bizonyíték:** kod/backend/src/routes/acc.ts:1021-1035, :1081-1112.

### 3.7 Növekedési eszközök: ajánlói jutalom, kupon, éves előfizetés, hírlevél
- **Mi hiányzik:** Az ajánlókód működik, de jutalom nincs. Regisztrációkor beváltható kupon és éves előfizetés sincs. A marketing-hozzájárulás és a hírlevél-lista hiányzik (Grt. 6. §).
- **Miért fontos:** az ajánlás a legolcsóbb csatorna, és az éves díj csökkenti a lemorzsolódást.
- **Kié:** tulaj (11-20-án az ajánlói programot és az éves díjat kifejezetten nem kérte).
- **Tervezve:** nem (SPEC §23 #13 nyitott).
- **Bizonyíték:** kod/panel/src/pages/admin/Forrasok.tsx:45; SPEC.md:1153, :4654; mem. :114.

### 3.8 Ügyfélmegtartás: visszatartó ajánlat és kockázatos ügyfelek listája
- **Mi hiányzik:** Lemondáskor nem kínálunk szüneteltetést, visszahívást vagy kedvezményt. Nincs ügyfél-egészség pontszám sem (utolsó belépés, figyelmen kívül hagyott emlékeztetők, fizetési hibák).
- **Miért fontos:** néhány száz ügyfélnél a csendes ügyfelet előre kell felhívni.
- **Kié:** vegyes.
- **Tervezve:** nem.
- **Bizonyíték:** kod/app/src/app/fiok/elofizetes.tsx:213-236; SPEC.md:382-389, :4645.

### 3.9 Partnercsatornák (futárplatformok, bankok, számlázók)
- **Mi hiányzik:** Nincs partnerterv, pedig a versenytársak Wolt/Foodora-, bank- és számlázóprogramokon keresztül szereznek ügyfelet.
- **Miért fontos:** a partner célzott közönséget hoz olcsóbban, mint a hirdetés.
- **Kié:** tulaj.
- **Tervezve:** nem.
- **Bizonyíték:** _munka/versenytarsak_2026-11-19.json; https://www.billingo.hu/konyvelo-vagyok

### 3.10 Számlakiállítás az appból
- **Mi hiányzik:** Számlát az appban nem lehet kiállítani, ez a Billingo és a Számlázz.hu alapfunkciója.
- **Miért fontos:** ez a versenytársakhoz képest látványos hiány, de nem feltétele az indulásnak.
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** SPEC.md:2263; mem. :75.

### 3.11 Státuszoldal és karbantartási sáv
- **Mi hiányzik:** Nincs nyilvános státuszoldal, és az appban nincs karbantartási vagy üzemzavar-sáv.
- **Miért fontos:** határidő napján az ügyfél lássa, hogy tudunk a hibáról.
- **Kié:** fejlesztés.
- **Tervezve:** nem (az Uptime Kuma-terv hozhat státuszlapot).
- **Bizonyíték:** a grep szerint a karbantartás szó az appban és a panelben nem szerepel; kod/deploy/README.md:119.

### 3.12 Akadálymentességi ellenőrzés (ÚJ tétel)
- **Mi hiányzik:** A SPEC előírja a 4,5:1 kontrasztot, a 44 pt-os érintési célt, a 130%-os betűméretet és a csökkentett mozgás tiszteletben tartását. A kódban sok címke van (73 accessibilityLabel, 183 role az appban, 93 aria- a panelen), de képernyőolvasós próba nem volt, és a k8 v2-átdolgozása (új színek, sárga gombok, mozgás) újra felülírja ezt.
- **Miért fontos:** idősebb vagy gyengénlátó vállalkozók is használják; a mikrovállalkozás szolgáltatásként valószínűleg mentesül az EU akadálymentességi irányelv alól [JOGI: ellenőrizni].
- **Kié:** fejlesztés.
- **Tervezve:** nem.
- **Bizonyíték:** SPEC.md:167, :1616; grep-számok (kod/app/src, kod/panel/src); 2019/882/EU irányelv 4. cikk (5): https://eur-lex.europa.eu/eli/dir/2019/882/oj
