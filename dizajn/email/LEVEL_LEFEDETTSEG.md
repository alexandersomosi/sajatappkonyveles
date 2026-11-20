# Levél-lefedettség: ügyfél-életút és e-mailek

Ellenőrizve a kódban 2026-11-20-án. Csak olvastam, a kódban semmit nem módosítottam. A hivatkozások a `kod/backend/src` mappához képest értendők, kivéve a `SPEC.md` (`kod/SPEC.md`) és az `app/src` (`kod/app/src`) hivatkozásait.

## 1. Keret

Ma minden saját levél ugyanazzal az egyszerű kerettel megy ki (notify/mailer.ts:31-42 `htmlOf`, egyetlen hívás: mailer.ts:80: márkanév, kék csík, fehér kártya; logó, gomb és List-Unsubscribe nélkül), kivéve a díjszámlát, amit a Számlázz.hu a saját keretében küld (a tárgya és a szövege a miénk, payments/invoices.ts:308-320, :339-340); az új, jóváhagyásra kész sablon a `C:/Users/UpgradePC/konyvelo_app/dizajn/email/sablon.html`, ez még nincs beépítve (a backend sehol nem hivatkozik rá).

## 2. Minden esemény

Kell-e: **megvan** = van levél és rendben; **hiányzik** = kellene levél, de nincs; **javítandó** = megy levél, de hibás vagy hiányos; **jó lenne**; **nem kell** = szándékosan csak push vagy app.
Prioritás: **K** = kötelező, **EA** = erősen ajánlott, **JL** = jó lenne, **–** = nincs teendő.

### Fiók és belépés

| # | Esemény | Kinek | E-mail ma | Push/app ma | Kell-e | Prior. | Hol |
|---|---|---|---|---|---|---|---|
| 1 | Regisztráció jelszóval: megerősítő kód, újraküldés (admin is kérheti) | ügyfél | igen | – | megvan | – | routes/auth.ts:183, :218; services/konzol-muveletek.ts:359 |
| 2 | Regisztráció Google- vagy Apple-fiókkal (üdvözlő levél egyik úton sincs) | ügyfél | nem | – | jó lenne | JL | routes/auth.ts:400-415 |
| 3 | Regisztráció már létező címmel | ügyfél | nem; a 409-es hiba elárulja, hogy a cím létezik | – | hiányzik | EA | routes/auth.ts:167-168; SPEC.md:2448 (S16); SPEC.md:1280 („S16 not done”) |
| 4 | Fiókzár (10 hibás jelszó több címről, 15 percre) | tulajdonos | nem | – | jó lenne | JL | routes/auth.ts:244-249 |
| 5 | Elfelejtett jelszó: kód (admin is kérheti) | mindenki | igen | – | megvan | – | routes/auth.ts:515-516; konzol-muveletek.ts:359 |
| 6 | Jelszó megváltozott; kétlépcsős belépés be- vagy kikapcsolva | mindenki | igen | – | megvan | – | routes/auth.ts:559, :583, :630, :646 |
| 7 | E-mail-cím változása (csak admin tudja) | ügyfél: új és régi cím | igen; a régi címre menő szöveg be van égetve | – | javítandó (sablonba) | JL | konzol-muveletek.ts:167, :169 |
| 8 | Az admin módosítja az ügyfél adatait | ügyfél | igen | app | megvan | – | konzol-muveletek.ts:175 |

### Bevezető, bekötés, vállalkozásindítás

| # | Esemény | Kinek | E-mail ma | Push/app ma | Kell-e | Prior. | Hol |
|---|---|---|---|---|---|---|---|
| 9 | Az ügyfél beküldte az adatokat, a meghatalmazást vagy az azonosítást; 3 napnál régebben vár | könyvelő | csak a napi összesítőben | app | megvan | – | services/onboarding.ts:479-491; jobs.ts:94-96, :119-134 |
| 10 | Hiánypótlás vagy ONYA-jóváhagyás kell | ügyfél | igen | push + app | megvan | – | routes/acc.ts:431, :433, :468 |
| 11 | Bekötés kész | ügyfél | igen | push + app | megvan | – | onboarding.ts:470 |
| 12 | Visszahívás-kérés visszaigazolása | ügyfél | igen | app | megvan | – | services/callbacks.ts:306 |
| 13 | Visszahívás menete | ügyfél | nem értük el / rossz szám / háromszor sikertelen: igen; „most hívunk”, megtörtént, lezárva: nem | push és/vagy app | megvan (SPEC szerint) | – | callbacks.ts:492, :560-563, :581 |
| 14 | Megbízási szerződés elfogadva | ügyfél | igen, PDF csatolva | – | megvan | – | services/contracts.ts:78-88 |
| 15 | „Intézzük helyetted”: indult, meghatalmazás beadva, emlékeztetők, lejárt, engedély kell, EV bejelentve | ügyfél | igen; kivétel az ismételt engedélykérés („ujra”), az csak push | push + app | megvan | – | services/assist.ts:469, :547, :574, :610, :924, :964; jobs-tulaj1119.ts:61, :67 |
| 16 | Vállalkozásindítás: adatlap vagy NAV-igazolás beküldve | csapat + admin | igen | app | megvan | – | routes/client-bekotes.ts:190, :267 |
| 17 | Vállalkozásindítás: emlékeztető, hiánypótlás, ellenőrizve, elindult, kamarai emlékeztető | ügyfél | igen | push + app | megvan | – | routes/team.ts:342, :387, :401; jobs.ts:275; client-bekotes.ts:579; jobs-tulaj1119.ts:188 |
| 18 | „Folytasd, ahol abbahagytad” (guided_continue) | ügyfél | nem | nem: a típus létezik, de semmi nem küldi | jó lenne | JL | notify/notify.ts:118 |
| 19 | Az ügyfél utat vált (van vállalkozása / indítás) | csapat, könyvelő | csak az összesítőben | app | megvan | – | services/pathchange.ts:190-207; jobs-tulaj1119.ts:196-206 |

### Előfizetés és fizetés

| # | Esemény | Kinek | E-mail ma | Push/app ma | Kell-e | Prior. | Hol |
|---|---|---|---|---|---|---|---|
| 20 | Első fizetés sikeres („elindult az előfizetésed”) | ügyfél | csak a Számlázz.hu számlalevele | push + app (számla kiállítva) | saját levél jó lenne | JL | services/payments.ts:737-935 (nincs értesítés); payments/invoices.ts:374 |
| 21 | Első fizetés sikertelen | ügyfél | nem | a fizetőoldalon látja | nem kell | – | – |
| 22 | Levonás 3 nap múlva; nincs mentett kártya | ügyfél | igen, nem kapcsolható ki | push + app | megvan | – | payments.ts:1180-1185, :1907, :1913 |
| 23 | Sikeres havi levonás | ügyfél | igen (a Számlázz.hu küldi a számlát) | push + app | megvan | – | invoices.ts:308-320, :374 |
| 24 | Sikertelen havi levonás: elutasítva, lejárt kártya vagy 3DS-hitelesítés kell | ügyfél | igen, mindig | push + app | megvan | – | payments.ts:1000-1006 |
| 25 | A kártya 30 napon belül lejár | ügyfél | igen | push + app | megvan | – | services/subscription.ts:829, :847 |
| 26 | Késés: „5 nap múlva szünetel” | ügyfél | igen | push + app | megvan | – | payments.ts:1952 |
| 27 | Zárolás előtti figyelmeztetés; zárolva; feloldva | ügyfél (+ könyvelő) | igen (a zárolásé nem kapcsolható ki); könyvelő: összesítő | push + app | megvan | – | services/zarolas.ts:69, :71, :74, :183 |
| 28 | Szüneteltetés kezdete / vége | ügyfél | igen | push + app | megvan | – | services/szuneteltetes.ts:44, :56 |
| 29 | Díjszámla kiállítva | ügyfél | igen, de a Számlázz.hu keretében (szöveg a miénk) | push + app | javítandó (kinézet) | JL | invoices.ts:336-342, :374 |
| 30 | Visszatérítés | ügyfél | igen, mindig | push + app | megvan | – | payments.ts:1582, :1624 |
| 31 | Admin díjat ad / árat csökkent / áremelést ad | ügyfél | igen | app | megvan | – | konzol-muveletek.ts:216, :219, :250 |
| 32 | Admin visszavonja az árkedvezményt (= drágul a havidíj) | ügyfél | nem | nem | hiányzik | EA | konzol-muveletek.ts:224-235 |
| 33 | Admin törli a mentett kártyát | ügyfél | nem | nem | hiányzik | EA | routes/admin.ts:445-448; subscription.ts:686-706 |
| 34 | Admin elengedi a díjat | ügyfél | nem | nem | jó lenne | JL | konzol-muveletek.ts:254-260; services/dijak.ts:427-436 |

### Könyvelés

| # | Esemény | Kinek | E-mail ma | Push/app ma | Kell-e | Prior. | Hol |
|---|---|---|---|---|---|---|---|
| 35 | Könyvelői kérés, havi kivonat-kérés, kérés-emlékeztető | ügyfél | igen | push + app | megvan | – | routes/acc.ts:1149; jobs.ts:76, :187; services/emlekezteto.ts:59 |
| 36 | Feltöltési emlékeztető, „valami rád vár”, havi kérdések | ügyfél | nem | push + app | nem kell | – | emlekezteto.ts:71, :98, :100; services/havi-ellenorzes.ts:151 |
| 37 | Irat feldolgozva / beadva | ügyfél | nem | push + app | nem kell | – | acc.ts:745-746, :772 |
| 38 | Az ügyfél kérése teljesítve / elutasítva; a könyvelő visszavonta a kérését | ügyfél | nem | push + app | nem kell (SPEC.md:928) | – | acc.ts:1177, :1201-1203 |
| 39 | Fizetendő adó jóváhagyva / módosítva | ügyfél | igen | push + app | megvan | – | services/tax.ts:323-325, :389-391, :411, :426 |
| 40 | Új kiállított számla a NAV-ból | ügyfél | alapból nem (bekapcsolható) | push + app | megvan | – | services/szamla-ertesites.ts:292-302 |
| 41 | Adóhatáridő: 7, 3, 1 nap, aznap, lejárt | ügyfél | igen, minden lépésnél | push + app | megvan; a SPEC.md:922 csak a 3 naposnál kér levelet, ez inkább sok | – | jobs.ts:44-63; emlekezteto.ts:46 |
| 42 | Befizetés megérkezett / eltérés | ügyfél | nem / igen | push + app | megvan | – | tax.ts:628, :629 |
| 43 | Bevallás beadva | ügyfél | igen | push + app | megvan | – | tax.ts:742 |
| 44 | Éves zárás: határidők / állapotváltozás | ügyfél | nem / igen | push + app | határidőkre jó lenne | JL | services/eves-zaras.ts:219, :239, :257 |
| 45 | Kedvezmény-kérdőív (év eleje, lejár), döntés | ügyfél | igen | push + app | megvan | – | jobs-k28.ts:52, :71; services/kedvezmeny.ts:631 |
| 46 | Igazolás kész | ügyfél | igen | push + app | javítandó: a saját levélszöveg (content/k29f.ts:50) nincs bekötve | JL | services/igazolas.ts:542-553 |
| 47 | Igazolás elutasítva / beadva a NAV-nak | ügyfél | nem (noEmail) | push + app | elutasításra hiányzik | EA | igazolas.ts:551, :614-630 |
| 48 | Változásbejelentés: díj, engedély, beküldve, kész | ügyfél | igen | push + app | megvan | – | services/valtozas.ts:294, :459, :472, :503 |
| 49 | Alkalmazott-bejelentés: döntés | ügyfél | igen | push + app | megvan | – | services/alkalmazott.ts:81 |
| 50 | Jövedelemkimutatás ellenőrizve | ügyfél | nem | push + app | nem kell | – | services/kimutatas.ts:423-425 |
| 51 | Új üzenet a könyvelőtől, az ügyfélszolgálattól vagy az admintól; könyvelőváltás | ügyfél | alapból nem; a Fiók → Értesítések alatt bekapcsolható | push + app | hiányzik (alapértékként) | EA | acc.ts:1264; team.ts:493; konzol-muveletek.ts:368; admin.ts:82; notify/notify.ts:26; app/src/app/fiok/ertesitesek.tsx:39 |
| 52 | ÁFA-keret 80 %; KATA: cégnek számlázott | ügyfél + könyvelő | igen | push + app | megvan | – | jobs.ts:111, :115; szamla-ertesites.ts:213-214 |

### Fiók vége

| # | Esemény | Kinek | E-mail ma | Push/app ma | Kell-e | Prior. | Hol |
|---|---|---|---|---|---|---|---|
| 53 | Lemondás (ügyfél, admin, vállalkozás megszüntetése) | ügyfél | igen | push + app | megvan | – | subscription.ts:619; services/megszuntetes.ts:33 |
| 54 | Az előfizetés ténylegesen megszűnik (az időszak végén) | ügyfél + könyvelő | nem | nem | hiányzik | EA | subscription.ts:857-882 |
| 55 | Admin „megszűnt” állapotba teszi az ügyfelet (azonnal leáll az előfizetés, törlődik a kártya) | ügyfél + könyvelő | nem | nem | hiányzik | EA | routes/admin.ts:374-384 |
| 56 | Felmondás (admin) | ügyfél | igen, mindig, de PDF nélkül | push + app | javítandó: a felmondó PDF-et csatolni (SPEC.md:4679), a saját szöveget (content/k29f.ts:66) bekötni | **K** | konzol-muveletek.ts:509-527 |
| 57 | A felmondás hatályba lép | ügyfél | nem (a könyvelő kap feladatot) | nem | hiányzik | EA | konzol-muveletek.ts:534-560 |
| 58 | Szerződés visszaállítva | ügyfél | igen | push + app | megvan | – | konzol-muveletek.ts:585 |
| 59 | Fióktörlés kérve | ügyfél | igen | – | megvan | – | routes/me.ts:331 |
| 60 | Fióktörlés visszavonva | ügyfél | nem | – | hiányzik | EA | me.ts:336-340; auth.ts:271, :321; services/gdpr.ts:75-85 |
| 61 | Fióktörlés végrehajtva (30 nap után) | ügyfél | nem; a 30 nap alatt semmilyen értesítő levél nem megy ki | – | hiányzik | EA | gdpr.ts:273; notify/notify.ts:358 |
| 62 | Adatmásolat kérve / kész | ügyfél | igen | push + app | megvan | – | me.ts:277; gdpr.ts:258 |
| 63 | Adatmásolat hibára futott | ügyfél + admin | nem; csak napló, a kódmegjegyzés „admin alert”-et ír, de nincs | nem | hiányzik | EA | gdpr.ts:259-262, :338-347 |
| 64 | Admin letiltja vagy feloldja egy ügyfél vagy munkatárs fiókját | érintett | nem | nem | jó lenne | JL | admin.ts:630-682 |

### Könyvelő és tulaj oldal

| # | Esemény | Kinek | E-mail ma | Push/app ma | Kell-e | Prior. | Hol |
|---|---|---|---|---|---|---|---|
| 65 | Új ügyfél regisztrált (automatikusan kap könyvelőt) | könyvelő, admin | nem | nem | jó lenne (sor az összesítőben) | JL | services/accounts.ts:111 |
| 66 | Ügyfél kézi átadása más könyvelőnek | régi és új könyvelő; ügyfél | könyvelők: igen; ügyfél: nem | ügyfél: push + app | megvan | – | admin.ts:74-94; konzol-muveletek.ts:332-348 |
| 67 | Az ügyfél ír, kér, feltölt, befizetettnek jelöl | könyvelő | csak a napi összesítőben | app | megvan (SPEC szerint) | – | routes/client.ts:765-953; tax.ts:570 |
| 68 | Napi összesítő 08:00 | könyvelő; csapat + admin | igen | – | megvan; a könyvelői szöveg be van égetve | JL | jobs.ts:119-134, :281-312 |
| 69 | Fizetési vita, dupla terhelés, sikertelen díjszámla | admin | igen | app | megvan | – | invoices.ts:437-453 |
| 70 | Egy ügyfél havidíj-levonása sikertelen | admin, könyvelő | nem | csak zároláskor, a könyvelőnek | jó lenne | JL | zarolas.ts:71 |
| 71 | NAV-hiba (sikertelen lekérdezés, hibás technikai felhasználó) | könyvelő, admin | nem | csak a „hiányzik valami” jelző a panelen | hiányzik | EA | services/navsync.ts:166-181, :191; services/flags.ts:34 |
| 72 | Visszahívás kiosztva / lejárt; „Intézzük helyetted” feladatok; felmondás hatályba lépett | munkatárs | igen | app | megvan | – | callbacks.ts:349, :463, :725-731; assist.ts:445; jobs-tulaj1119.ts:83, :111, :156; konzol-muveletek.ts:554 |
| 73 | Munkatárs meghívása (könyvelő, ügyfélszolgálat) | új munkatárs | igen | – | megvan | – | admin.ts:260, :566 |
| 74 | Admin közleménye az ügyfeleknek | kiválasztott ügyfelek | ha az admin bejelöli | app (+ push, ha bejelöli) | megvan | – | konzol-muveletek.ts:401 |

**Nincs ilyen funkció, így levél sem kell:** átutalásos fizetés és díjbekérő (a „díjbekérő” csak a DEMO-számla neve, invoices.ts:58; a `dizajn/email/04_dijbekero_atutalas.html` csak minta), e-mailes belépési kód (auth.ts:223-280), „irat visszadobva” állapot (_shared/enums.ts:134). Régi, nem futó ág: időpont-emlékeztető (jobs.ts:233).

**Összesen 74 esemény.** E-mail ma: **40** eseményre megy, **11** eseményre részben (csak összesítőben, csak egyes változatoknál, csak a Számlázz.hu-tól vagy csak bekapcsolva), **23** eseményre nem megy. A 23-ból 5 szándékosan csak push vagy app (#21, #36, #37, #38, #50).

## 3. Hiányzó levelek prioritás szerint

A szövegek tegezők és rövidek. A `{…}` a kitöltendő érték, a márkanév az `_shared/brand.json` szerinti „Adózz”.

### K – kötelező

1. **Felmondás, PDF-fel (#56)**
   - Tárgy: *Felmondtuk a szerződésedet*
   - Tartalom: „A szerződésed {datum}-ig érvényes, addig minden a megszokott módon megy. A felmondó levelet csatoltuk, és a Dossziéban is megtalálod.” Azonnali felmondásnál: „A szerződésed ma megszűnt. A felmondó levelet csatoltuk, és a Dossziéban is megtalálod.”
   - Megjegyzés: az értesítés-útvonal (notify) nem visz csatolmányt, ezért ezt a levelet a szerződéslevélhez hasonlóan közvetlenül kell küldeni (contracts.ts:80-86).

### EA – erősen ajánlott

2. **Új üzenet (#51)**
   - Tárgy: *{firstName} üzenetet küldött*; ügyfélszolgálattól: *Új üzeneted jött az ügyfélszolgálattól*
   - Tartalom: „Új üzeneted van az Adózz-ban. Az appban, az Üzenetek között olvashatod és válaszolhatsz rá.”
   - Megjegyzés: elég a `message_new` e-mail-alapértékét bekapcsolni (notify.ts:26). Javasolt naponta legfeljebb egy levél.
3. **NAV-hiba (#71)**, a könyvelőnek és az adminnak
   - Tárgy: *NAV-hiba: {clientName} számlái nem jönnek*
   - Tartalom: „A NAV-lekérdezés nem sikerült: {hiba}. Amíg nem javítod a technikai felhasználót, a napi lekérdezés kihagyja ezt az ügyfelet.”
4. **Megszűnt az előfizetés (#54)**
   - Ügyfélnek, tárgy: *Megszűnt az előfizetésed*
   - Tartalom: „{datum}-tól megszűnt az Adózz-előfizetésed, több díjat nem vonunk le. Az irataidat az appban továbbra is megnézheted.”
   - Könyvelőnek feladatként, mint a felmondásnál (konzol-muveletek.ts:554): *Megszűnt: {clientName}*. Tartalom: „Vond vissza a meghatalmazást, és töröld a technikai felhasználót.”
5. **Admin „megszűnt” állapotba tette az ügyfelet (#55):** ugyanaz a két levél, mint a 4. pontban.
6. **A felmondás hatályba lépett (#57)**
   - Tárgy: *Megszűnt a szerződésed*
   - Tartalom: „A felmondás mai nappal hatályos, a szolgáltatás véget ért. A felmondó levelet a Dossziéban találod.”
7. **Fióktörlés visszavonva (#60)**
   - Tárgy: *Visszavontad a fiókod törlését*
   - Tartalom: „A fiókod megmarad, ugyanúgy használhatod. Az előfizetésed a fizetett időszak végéig tart, a Fiók → Előfizetés alatt újraindíthatod. Ha nem te voltál, állíts be új jelszót, és írj nekünk.”
8. **Fiók törölve (#61)**
   - Tárgy: *Töröltük az Adózz-fiókodat*
   - Tartalom: „A kérésedre töröltük a fiókodat. Amit a törvény szerint meg kell őriznünk (például a számlákat), azt a megőrzési idő végéig zárolva tároljuk.”
   - Megjegyzés: az álnevesítés (gdpr.ts:273) előtt kell elküldeni, mert utána már nincs valódi cím.
9. **Adatmásolat hiba (#63)**
   - Ügyfélnek, tárgy: *Nem készült el az adataid másolata*. Tartalom: „Hiba történt a másolat készítésekor. Már dolgozunk rajta, és szólunk, amint letölthető.”
   - Adminnak, tárgy: *Adatmásolat hiba: {clientName}*. Tartalom: „A másolat kétszer sem készült el. A GDPR szerint a kéréstől számított egy hónapon belül teljesíteni kell.”
10. **Már van fiókod (#3)**
    - Tárgy: *Már van fiókod az Adózz-ban*
    - Tartalom: „Ezzel a címmel most valaki regisztrálni próbált. Ha te voltál, lépj be, vagy kérj új jelszót az „Elfelejtettem a jelszavam” gombbal. Ha nem te voltál, nincs teendőd.”
    - Megjegyzés: ehhez a regisztráció válaszát is egységesíteni kell, és ez az app oldalán is változást kér (SPEC.md:1280).
11. **Megszűnt az árkedvezmény (#32)**
    - Tárgy: *Változik a havidíjad*
    - Tartalom: „{datum}-tól a havidíjad {osszeg} Ft, mert megszűnt a kedvezményed. A részleteket a Fiók → Előfizetés alatt látod.”
    - Megjegyzés: a visszavonás azonnal hat. Az áremelésnél kötelező 30 napos előzetes értesítés (konzol-muveletek.ts:202) itt nem érvényesül. Erről a tulaj döntsön.
12. **Admin törölte a kártyát (#33)**
    - Tárgy: *Töröltük a mentett kártyádat*
    - Tartalom: „Az ügyfélszolgálat törölte a mentett bankkártyádat. Hogy a havidíj levonása ne akadjon el, adj meg új kártyát a Fiók → Előfizetés alatt.”
13. **Igazolás nem adható ki (#47)**
    - Tárgy: *Nem tudjuk kiadni az igazolásodat*
    - Tartalom: „{firstName} nem tudta kiadni a(z) {tipus} igazolást: {ok}. Ha már kifizetted a díját, visszatérítjük.”

### JL – jó lenne

14. **Üdvözlő levél (#2) és sikeres első fizetés (#20)**
    - Tárgy: *Üdv az Adózz-ban!* Tartalom: „Örülünk, hogy itt vagy. Az appban lépésről lépésre végigvezetünk a bekötésen; ha elakadsz, kérj visszahívást. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.”
    - Tárgy: *Elindult az előfizetésed*. Tartalom: „Sikerült az első fizetés, elindult az előfizetésed. A számlát külön levélben kapod.”
15. **Fiókzár (#4)**
    - Tárgy: *Zároltuk a belépést a fiókodba*
    - Tartalom: „Több helyről rossz jelszóval próbáltak belépni, ezért 15 percre zároltuk a fiókodat. Ha nem te voltál, állíts be új jelszót az „Elfelejtettem a jelszavam” gombbal.”
16. **Folytasd, ahol abbahagytad (#18)**
    - Tárgy: *Folytasd ott, ahol abbahagytad*
    - Tartalom: „Már csak pár lépés, és {firstName} elkezdheti a könyvelésedet. Az appban onnan folytatod, ahol abbahagytad.”
17. **Éves zárás határideje (#44)**
    - Tárgy: *{hatarido}: éves kérdőív*
    - Tartalom: „Töltsd ki az éves kérdőívet {hatarido}, hogy {firstName} időben beadhassa a bevallásodat.”
18. **Díj elengedve (#34)**
    - Tárgy: *Elengedtük a díjat*
    - Tartalom: „A(z) {label} díját ({osszeg} Ft) nem kell kifizetned.”
19. **Fiók letiltva / feloldva (#64)**
    - Tárgy: *Letiltottuk a fiókodat* / *Újra használhatod a fiókodat*
    - Tartalom: „Letiltottuk az Adózz-fiókodat, ezért most nem tudsz belépni. Ha kérdésed van, válaszolj erre a levélre.” Ehhez be kell állítani a válaszcímet (mailer.ts:76).
20. **Új ügyfél (#65)**, sor a könyvelő és az admin napi összesítőjében: „Új ügyfeled: {clientName} (a bekötés elején tart).”
21. **Sikertelen levonás (#70)**, sor az admin és a könyvelő napi összesítőjében: „Nem sikerült levonni {clientName} havidíját ({osszeg} Ft).”

## 4. Egységesítéshez

A levelek kinézete egységes (1. pont), a szövegük és a felépítésük viszont nem. Négyféle forrásból jönnek:
- **Értesítés-levelek** (notify.ts:351-366):
  - A tárgy az app-értesítés címe, márkanév nélkül.
  - A törzs a rövid app-szöveg, megszólítás és aláírás nélkül.
  - Utána nyers URL jön. A SPEC „Megnyitom: {link}” feliratot kér (SPEC.md:1844).
  - A végén az `email.generic.footer` áll (content/defaults.hu.json:108). Ezt a munkatársak is megkapják, pedig a „Fiók → Értesítések” menü nekik nem érvényes.
- **Kódos, biztonsági és közvetlen levelek** (notify.ts:281-296; me.ts:242-250; contracts.ts:80; admin.ts:84-91; jobs.ts:306-309): „Szia!”-val kezdődnek, a márkanév az aláírás, lábléc nincs.
- **Beégetett szöveg**, a tartalomszerkesztőből nem érhető el: jobs.ts:127-132 (könyvelői összesítő) és konzol-muveletek.ts:169 (levél a régi e-mail-címre).
- **Halott sablonok**, a kód nem használja őket: content/k29f.ts:50 (igazolás kész) és :66 (felmondás).

Az újrapróbálás sem egységes: az értesítés-leveleket a rendszer 3 napig újrapróbálja (notify.ts:301-302, :367-369), a közvetlen leveleket egyszer próbálja, utána csak naplóz. A hangnem (tegeződés) mindenhol egységes. Az új sablon (`sablon.html`) beépítésekor érdemes egyszerre bevezetni a közös megszólítást és aláírást, egy külön munkatársi láblécet és a gombot a nyers URL helyett.
