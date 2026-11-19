# Kézjegy (munkanév) – állapot, 2026. 11. 19. 13:30 (a 11-19-i kéréseid élesben)

## 0. Ami ma élesbe ment (11-19, 13:23)
**Él:** az app (https://app.45-94-65-74.sslip.io), a panel (https://konyvelo.45-94-65-74.sslip.io), az API és a háttérfolyamat,
és az útmutató-képek. Előtte titkosított mentés: `/srv/kezjegy/_regi/pg_dump_elotte_integ1119_20261119_131813.dump.gpg`.
A te két fiókod (alex@, tulaj@) **változatlan** (előtte–utána összevetve), a többi ügyfél bekötési lépései sem változtak,
a Gardoko végig 200.

1. **Valódi NAV-képek (1. kérés).** A vállalkozás-bejelentés útmutatójában most **7 valódi NAV-képernyő** van (a NAV saját
   „Megújul az Ügysegéd” kisfilmjéből: belépés, Ügysegéd főoldal, ügytípus, személyi adatok, nyilatkozatok, beküldés,
   megtekintés – a mintaadatok elmosva, a forrás a kép alatt). **11 kép még rajzolt vázlat** (címadatok, tevékenységek,
   adózási lapok, ellenőrzés): ezekről nincs hivatalos kép, a kép alatt ez áll: „Rajzolt vázlat – a valódi képernyő kicsit
   eltérhet”. Ezeket csak te tudod lefotózni (belépsz, végigkattintod, **NE küldd be**): `utmutato_kepek\SAJAT_KEPEK.md`,
   utána egy parancs: `python C:\Users\UpgradePC\konyvelo_app\utmutato_kepek\sajat_kepek.py`. A meghatalmazás 16 képe valódi.
2. **Vissza lehet váltani (2. kérés).** A „Van már egyéni vállalkozásod?” válasz bármikor módosítható: a Főoldal listájának első
   sorában „Módosítom”, a Rólad / Adataid lapon és a kérdőívnél is; 30 másodpercig „Visszavonom”. Amit a kérdőívbe írt,
   megmarad. Ha már megadta az adószámát vagy beküldte a bejelentést, a váltás visszahívással megy (a csapat a panelen állítja át).
3. **„Intézzük helyetted” (3. kérés), kiemelve.** A Főoldalon és a kérdésnél kék keretes kártya: „Nem boldogulsz vele? Intézzük
   helyetted”, a meghatalmazásnál „Megcsináljuk helyetted a meghatalmazást”. Menete: visszahívás (24–48 óra) → hívás,
   egyeztetés → Bence a **saját** belépésével, meghatalmazottként beküldi a meghatalmazást → az ügyfél 4 napon belül jóváhagyja
   az ONYA-ban (emlékeztetőkkel) → az ügyfél az appban átnézi és engedélyezi az adatait → Bence beküldi a bejelentést → a csapat
   ellenőriz, rögzíti az adószámot. Belépési adatot soha nem kérünk, és nem lépünk be helyette (ez az appban, a panelen, a
   GYIK-ban és az ÁSZF-tervezetben is ott van). A panelen új „Intézzük helyette” lista (ki kinél van, határidők). Kikapcsolható:
   `ASSIST_EV_ENABLED=false`; a bejelentés-rész 2026-12-31-ig él (utána a kamara viszi a nyilvántartást).
4. **Átláthatóbb folyamat (4. kérés).** Egy lista: „Így halad a bekötésed” (minden sorban: ki lép – Te / Bence / Csapatunk –,
   mennyi idő, „Mi ez?”), fölötte egy „Most ez jön” kártya egy gombbal; a kék sáv, a fül-jelvény és a zárolt lap ugyanazt a
   számot mutatja; a hosszú feladatok lépésenként; várakozásnál kiírja, ki dolgozik és meddig. Mindenhol „anyukád”.
5. **Számla-szöveg (5. kérés).** Mindenhol „Kiállított számlák”: „A kiállított számláid maguktól megjelennek itt – nem kell
   feltöltened őket.” + egyszeri „Mi ez?” magyarázat; az állapot „Letöltöttük”. Kivétel csak a videók hangja (lásd 2.).
- **Adóhiba javítva (a blokkoló T1):** ha egy már jóváhagyott negyedévbe utólag kerül bevétel (késve rögzített számla, átírt
  dátum), az adója most a következő nyitott negyedévbe kerül – eddig elveszett –, és Bence figyelmeztetést kap („Lezárt
  negyedév bevétele változott – nézd át”).
- Biztonsági javítások (2. átnézés): külön zár a kétlépcsős kódra, jelszó-visszaállító kód nem találgatható, idegen oldalról nem
  lehet beléptetni, tárhely-korlát ügyfelenként, admin le tudja tiltani az ügyfélfiókot, és még néhány kisebb.
- Új demó ügyfelek: **Kiss Marika** (intézzük, a meghatalmazás jóváhagyására vár), **Molnár Dávid** (van vállalkozása, a
  meghatalmazást intézzük), **Balogh Ilona** (nem tud belépni, hívásra vár). Belépések: `ssh appok-1 'cat /srv/kezjegy/demo_belepesek.txt'`.
- Automata tesztek: backend 246, adómotor 138, NAV-kliens 105, jogi 45, panel 61, app 31 – mind zöld. Képek a helyi
  végigjátszásról: `kod\_qa\k5_integ_*.png` (új ügyfél: kérdés → „Még nincs” → váltás → vissza → „Intézzétek helyettem” →
  a csapat és Bence a panelen; Marika, Dávid).
- **Android: `C:\Users\UpgradePC\konyvelo_app\apk\Kezjegy-1.0.6-test.apk`** (13:42, 1.0.6 / 7: a mai változások + kék színek;
  a telefon biztonsági mentése nem viszi el az app adatait). A régi fölé frissítésként települ; telefonon még nem próbáltuk.

## 00. Ami még nyitott (11-19) – a te dolgod vagy döntésed
- **Videók hangja:** a bekötés-videóban még elhangzik „A számláid maguktól megérkeznek a NAV-tól”, a bejelentés-videóban
  „anyád születési neve”. A felirat és a hang csak együtt cserélhető (újramondatás, fizetős hang) – a videós munka része.
- **Saját NAV-képek:** a 11 rajzolt kép + az ONYA „JÓVÁHAGYÁS” gomb és felugró ablaka (lásd 0./1.).
- **Ügyvéd:** `kod\jogi\UGYVED_KERDESEK_k5.md` – beküldheti-e a könyvelőnk az új vállalkozás bejelentését a díjas szolgáltatás
  részeként (Üttv., Btk. 286. §), elég-e az appban adott engedély, használhatók-e a NAV-kisfilm kockái. Addig kikapcsolható.
- **Döntések:** nincs külön díj az „Intézzük helyetted”-ért (most így szerepel); a név „Intézzük helyetted / Intézzétek helyettem”;
  Bence UJEGYKE-jogcíme (9 vagy 60).
- **Mentés:** az éjszakai mentés cronja még nincs beállítva, és a `_regi`-ben 6 régi, titkosítatlan mentés van (600-as fájlok,
  700-as mappa). Ezekhez csak a te igeneddel nyúlunk (beállítás, titkosítás, elvitel).
- **Regisztráció:** a regisztráció most elárulja, ha egy címmel már van fiók (S16, óránként max. 5 próba). Ha zavar, „nézd meg a
  postafiókodat” típusú regisztráció kell (az app is változik).
- Nem javított apróbb adó-/szövegpontok (a 2. átnézésből): T3, T6, T8 (2027-es 2758-as nyomtatvány a backendben), T9, T10, T13,
  valamint a videók képi javítása (O2, O3) és a backend PDF-kinézete (O6).

---
# Korábbi állapot (11-18 este) – változatlanul

## 000. Ami 16:30 után változott (a második átnézés javításai)
**Élesítés állapota (16:58):** az új app, panel és API **fel van töltve**, de **még nem él**: az indítást (`up.sh`) nálam
most is letiltotta a biztonsági engedély. Egy parancs, és él: `ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'`
(új adatbázis-migráció nincs; mentés előtte: `/srv/kezjegy/_regi/pg_dump_elotte_k3e_20261118_165743.dump`; a te két
fiókod változatlan, a Gardoko 200). Az `up.sh` mostantól **újra is létrehozza** a webes konténert, és kiírja, hogy az
új app-build él-e – a délutáni hiba (a régi mappát szolgálta ki) így nem fordulhat elő. Utána: `curl -s https://45-94-65-74.sslip.io/api/v1/health`.
A videók, posztereik és az útmutató-képek **már élnek** (`/media/`).
- **NAV-képernyőképek jelöléssel:** a meghatalmazás mind a 16 képe valódi, jelölt NAV-képernyő. A vállalkozás
  bejelentésénél továbbra is **csak a belépés valódi**, a többi rajzolt vázlat („Illusztráció”), mert mi nem lépünk be
  a NAV-hoz. Ma: a rajzolt feliratok most szóról szóra egyeznek az útmutatóval (munkavégzés jellege, telephely,
  tevékenység). **A te döntésed:** (a) belépsz, végigkattintod az Ellenőrzés képernyőig (NE küldd be!), lefotózod –
  `utmutato_kepek\hianyzik.md`, utána egy parancs újrajelöl mindent; vagy (b) engeded, hogy a NAV kisfilmjéből
  (https://youtu.be/DQnbjo2lrv8) vegyünk kockákat (ehhez le kell tölteni, csak a te igeneddel).
- **Javítás a NAV-nál:** az app és a panel most helyesen írja, hol lehet javítani egy beküldött bejelentést: cím és
  tevékenység a Vállalkozói Ügysegédben, **adózási adat (ÁFA, átalány, kata, munkavégzés jellege) csak az ONYA-ban,
  „Egyéni vállalkozó bejelentése” (T101E)**. A csapatnak három mintaszöveg; ha kimaradt az alanyi ÁFA-mentesség vagy az
  átalányadó, a könyvelő dönt [KÖNYVELŐ].
- **„Saját szavaiddal” tevékenység** a listás mellett sem vész el: az összefoglalóban, az útmutatóban, az Ellenőrzésnél
  és a könyvelőnél is ott van; a csapat addig nem hagyhatja jóvá, amíg sorként, kóddal fel nem vette.
- **ÖVTJ-várakozás:** az útmutató tetején már az elején ott a figyelmeztetés („általában 1 munkanapon belül megírjuk”),
  a csapat sorában határidő látszik („ÖVTJ-kód kell … -ig”, pirossal, ha lejárt). A 35 sor kódja továbbra is a könyvelőre vár.
- **Korlátozott mód rése bezárva:** bekötés alatt álló ügyfélnek nem megy adós értesítés (sem appban, sem push, sem
  e-mail); a könyvelő számolhat, de jóváhagyni csak az aktiválás után tud (a panel ki is írja).
- Visszahívás: az e-mailes link (`?id=`) megnyitja a kérést; nincs „-1 perce” / „121 perc”; lezárt kérésnél senki nem
  látja a teljes számot; Péter régi időpontja egyformán „holnap 10:00 körül” az értesítésben és az állapotkártyán.
- App: hidegen megnyitott képernyőn is jó a fülsor (teendő-jelvény, Fotózás felirat), a könyvelői irat a bekötés előtt a
  zárolt Dosszié-lapot mutatja, alsó sáv a fizetés-visszatérésnél és a „Kérdésem van” űrlapon, „Bemutató videó · 1:47”,
  felolvasónak jobb címkék, 320 px-en nem vágódik a cím és az összeg. **Android: `Kezjegy-1.0.4-test.apk`** (lásd 1.).
- GYIK: a „Biztonságban vannak az adataim?” válasza egyszer frissül (csak ha még a régi szöveg van ott).
- Videók: a telephely- és a közösségi adószám-mondat pontos, a könyvelő adóazonosító jele végig látszik, nincs félbevágott
  felirat a kép szélén, új, középre zárt poszter és címkép. **Még mindig némák** (lásd 3.).
- Automata tesztek: backend 187, panel 40, app 21, jogi 33 – mind zöld (az adómotor 131 és a NAV-kliens 105 tesztje nem változott, most nem futott). Képek: `kod\_qa\k3e_*.png`
  (helyi végigjátszás: `node kod\_qa\k3e_javito.mjs`, `node kod\_qa\k3e_ujra.mjs`).

## 00. Ami 15:30 után változott (a délutáni átnézés javításai)
**Élesítés állapota (15:25):** a videók és az útmutató-képek **élesben vannak**. Az app, a panel és az API új kódja
**fel van töltve** a szerverre (`/srv/kezjegy`), de az indítás még nem futott (nálam a biztonsági engedély nem
engedte). Egy parancs, és él: `ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'` (új adatbázis-migráció nincs; mentés előtte:
`/srv/kezjegy/_regi/pg_dump_elotte_javito_k3c_20261118_152241.dump`; a te két fiókod változatlan, a Gardoko 200).
Utána ellenőrzés: `curl -s https://45-94-65-74.sslip.io/api/v1/health` (Gardoko) és `curl -s https://api.45-94-65-74.sslip.io/api/v1/health`.
- **NAV-képernyőképek jelöléssel:** a meghatalmazás mind a 16 képe valódi, jelölt NAV-képernyő (most a segédlet teljes
  címével). A **vállalkozás bejelentésénél továbbra is csak a belépés valódi**, a többi 13 képernyő rajzolt vázlat:
  a NAV 2026-os Ügysegéd-útmutatójában nincs kép, más hivatalos NAV-oldalon sem találtunk (ma újra megnéztük), és mi
  nem lépünk be. Az app ezt őszintén jelzi („NAV KÉPERNYŐ · RAJZOLT VÁZLAT”), a videó posztere már nem ígér
  „NAV képernyőket”. **Két út, a te döntésed:** (a) belépsz, végigkattintod az Ellenőrzés képernyőig (NE küldd be!),
  és lefotózod – leírás: `utmutato_kepek\hianyzik.md`, utána egy parancs újrajelöl mindent; (b) engeded, hogy a NAV
  hivatalos kisfilmjéből (https://youtu.be/DQnbjo2lrv8) vegyünk kockákat – ehhez a videót le kell tölteni, ezt csak a
  te igeneddel tesszük.
- **Tevékenység (ÖVTJ):** a listánk 35 sorának egyikénél sincs még hivatalos ÖVTJ-kód (a könyvelő írja be). Addig az
  útmutató nem mond biztos sort: a „Tevékenységek” és a beküldés lépésnél kiírja, hogy **várjon, amíg megírjuk**; a
  csapat feladatot kap, és ha beírja a kódot (Vállalkozás-indítás → Javítom), az ügyfél értesítést kap („Megírtuk,
  melyik sort válaszd”). A másolás gomb már csak a kódot vagy a keresőszót másolja.
- Útmutató: a címek mezőnként másolhatók, minden telephely/fióktelep és tevékenység külön sor, az Ellenőrzésnél
  közösségi adószám, telephely, székhelyszolgáltató is; a kamarai lépés „KAMARAI OLDAL”, és kiírja az évi 5 000 Ft
  kamarai hozzájárulást; a meghatalmazásnál „Ellenőrzés és benyújtás” → „Tovább” (mint a NAV képén).
- Járulék-tipp: nyugdíjasnak „nem fizetsz TB-járulékot és szochót”, a „2027-től 50%” csak a 45%-os munkáknál.
- Panel: a csapat a pipalista mellett látja a profil nevét és lakcímét; beküldés után a beküldés napja a kezdés napja;
  a visszahívásnál sikertelen hívás után nem írja, hogy „kérte, hogy … hívjuk”; a régi időpont-szövegek a „Megszűnt”
  csoportban; a régi időpont-értesítések nem látszanak az appban.
- App: alsó sáv a GYIK-on és a szerződés-olvasón is; zárolt azonosítás-lap; „Mi kell még?” a következő lépéshez görget;
  Üzenetekben a visszahívás külön csempe („Csapatunk 24–48 órán belül hív.”); „Még 3 lépés… Ebből 1 a tiéd”.
- Videók: olvasható közelítések (UJEGYKE, Meghatalmazó), nincs levágott felirat, kék feliratcsík és záró kép, mint a fő
  videóban; a fő videó színtartománya Androidra javítva. **Még mindig némák** (OpenRouter-egyenleg 0,83 USD, lásd 3.).
- Képek: `kod\_qa\k3d_*.png` (helyi végigjátszás, `node kod\_qa\k3d_javito.mjs`), videókockák
  `video\meghatalmazas\kockak\vegso_lap_*.jpg`.

## 0. Ami ma délután változott (élesben 13:30 óta)
- **Új vállalkozás önkiszolgálóan:** „Van már egyéni vállalkozásod?” → „Még nincs” → rövid adatlap (5 lap, ÖVTJ-kereső,
  költséghányad- és járuléktipp) → személyre szabott „Mit hova jelölj” útmutató **jelölt NAV-képernyőképekkel** (számozott
  jelölők, keretek, nyilak, elmosott személyes adatok, forrás a kép alatt; ami belépés nélkül nem látszik, az „Illusztráció”)
  → az ügyfél maga küldi be, feltölti a NAV-os PDF-et → a csapat ellenőrzi (9 pont) és rögzíti az adószámot → jön a saját
  NAV-meghatalmazás, ugyanilyen útmutatóval. TAJ-t, anyja nevét nem kérjük. Hiányzó valódi képek: `utmutato_kepek\hianyzik.md`.
- **Visszahívás időpontfoglalás helyett** mindenhol („Elakadtál? Kérj visszahívást”), 24–48 óra; a panelen Visszahívások sor
  (magamra veszem, most hívom, eredmény, összefoglaló az ügyfélnek). A régi foglalások visszahívássá váltak (Péter).
- **Alsó sáv a bekötés alatt is**; amíg nincs bekötve, a Dosszié, határidők, NAV-számlák, igazolások **zárva**, okkal
  („A bekötés után nyílik meg…”), és ezt a szerver is betartja. Minden tételnél „Mi ez? / Miért kell? / Hol találod?”.
- **Videók** a bekötés tetején és a két útmutató tetején (`/media/…`). **Még némák, felirattal** – a Gemini-hanghoz nincs
  elég OpenRouter-egyenleg (lásd 3.).
- Új szerepkör: **ügyfélszolgálat (csapat)** – demo: Nagy Anna (`csapat;anna.nagy@…` a belépési listában). Demo ügyfelek:
  Tóth Levente (beküldte, ellenőrzésre vár), Fehér Zsófia (útmutatónál, nem tud belépni).
- A te két fiókod (alex@, tulaj@) változatlan; az első belépéskor az elágazó kérdést látod. Mentés a frissítés előtt:
  `/srv/kezjegy/_regi/pg_dump_elotte_tulaj1118_20261118_131454.dump`. A Gardoko végig 200.
- Képek: `kod\_qa\k3_e*.png` (ügyfél-app, végigjátszott folyamat), `k3_p*.png` (csapat a panelen), `k3_l*.png` (éles videók).

## 1. Most kipróbálhatod
- Ügyfél-app böngészőben: https://app.45-94-65-74.sslip.io
- Könyvelő + admin panel: https://konyvelo.45-94-65-74.sslip.io · API (csak az appnak): https://api.45-94-65-74.sslip.io/api/v1
- Android: `C:\Users\UpgradePC\konyvelo_app\apk\Kezjegy-1.0.6-test.apk` (11-19 13:42, a mai kérésekkel – lásd fent; a régi fölé frissítésként
  települ, telefonon még nem próbáltuk). Másold a telefonra (Drive/USB), nyisd meg,
  engedélyezd az „ismeretlen forrásból” telepítést, a Play Protectnél „Telepítés mindenképp”. iPhone-app még nincs.
- Demo belépések (admin, Kovács Bence könyvelő, Nagy Anna ügyfélszolgálat, 4 ügyfél; sor: szerep;e-mail;jelszó): `ssh appok-1 'cat /srv/kezjegy/demo_belepesek.txt'`
- Új fiókot is regisztrálhatsz: az e-mail-kódot az admin panel → Demo-postafiók oldalon látod. Minden adat kitalált.
- Képek: `_reggel.jpg` (10 kép egyben), egyenként küldéshez a sorrend: `_reggel_sorrend.txt`.

## 2. Kész (FUNKCIOK.md szerint)
- Bekötés (1–7): e-mail + jelszó, jelszó-visszaállítás kóddal, 2FA, ujjlenyomat; kérdőív; szerződés; kártyás előfizetés;
  NAV-bejelentés ONYA-útmutatóval (AVDH helyett, 2026-os szabály); azonosítás igazolványfotóval (a lakcímkártyának csak a lakcímes oldala); visszahívás kérése (időpontfoglalás helyett).
- Főoldal (8–11): fizetendő összeg + Bence levele aláírással, „Hogyan jött ki?”, számlaszám/közlemény másolás, „Már befizettem”, határ-mérők.
- Dosszié (12–15): NAV-számlák, fotó/PDF feltöltés, megosztás más appból, állapotok, beadott bevallások.
- Üzenetek, kérések, határidők, fiók (16–19): chat csatolmánnyal, kérés-gombok, lemondás, adatletöltés, fióktörlés.
- Könyvelői panel (20–28): ügyféllista, adatlap, 2026-os adószámolás + jóváhagyás, „Beadva”, kérések, határidő-figyelő, CSV-export, napló.
- Admin (29–32): bevétel, előfizetések, fizetések, könyvelők, honnan jöttek + ajánlókód, GYIK és szövegek.
- Háttér (33–35): NAV-lehívó, adómotor, titkosított fájlok és kulcsok, napló, mentés + visszaállítási próba.
- 11-18 délután (36–42): új vállalkozás önkiszolgálóan, visszahívás, korlátozott mód, magyarázatok, videók, csapat-szerepkör.
- 504 automata teszt zöld (backend 179, adómotor 131, NAV-kliens 105, jogi 33, panel 37, app 19); a helyi végigjátszás
  (`node kod\_qa\k3_e2e.mjs`) ellenőrzései rendben; az éles cím videói lejátszanak. A Gardoko végig működött (most is 200).

## 3. Még DEMO – ezt neked kell megtenned
- **Videók hangja:** az OpenRouter-egyenleg ~0,83 USD, a Gemini 3.8 TTS ennél többet foglal le (402). Tölts fel pár dollárt
  (openrouter.ai → Credits), utána **először a hangminta + vak ellenőrzés** (a `video\hang.json` addig IDEIGLENES):
  `python C:\Users\UpgradePC\konyvelo_app\video\bekotes\eszkoz\minta.py --hang-json`, majd
  `python C:\Users\UpgradePC\konyvelo_app\video\bekotes\eszkoz\minden.py` és
  `python C:\Users\UpgradePC\konyvelo_app\video\vallalkozas_bejelentes\eszkoz\epit.py mind`, majd
  `node kod\deploy\videok-json.mjs` és `bash kod\deploy\feltolt.sh --media`.
- **Döntések (11-18):** mikor fizet az új vállalkozó (alap: az adószám után; `NEW_BUSINESS_CHARGE_POLICY`), melyik számról
  hívunk (`CALLBACK_CALLER_ID`, addig nem mutatjuk), elég-e 48 naptári óra; a valódi ügyfélszolgálatos kollégák neve.
- **Ügyvéd: ha kikerül az „Egyéni vállalkozói nyilvántartással kapcsolatos ügyek” ügycsoport** a meghatalmazásból
  (jogi README 12. kérdés), a meghatalmazás-videóból is ki kell venni (m18–m19 sor és a 13-as kép), majd
  `python C:\Users\UpgradePC\konyvelo_app\video\vallalkozas_bejelentes\eszkoz\epit.py meghatalmazas` és `bash kod\deploy\feltolt.sh --media`.
- **NAV-képek:** a Vállalkozói Ügysegéd képei most rajzolt vázlatok („Illusztráció”). Belépve lefotózhatod őket (NE küldd be!),
  leírás: `utmutato_kepek\hianyzik.md`, utána egy parancs újrajelöl mindent; vagy engedd meg a NAV kisfilmjének használatát (lásd 00.).
  A meghatalmazás 16 képe már valódi NAV-képernyő.
- **Könyvelő: ÖVTJ-kódok.** `kod/shared/src/bekotes.ts` → `BUSINESS_ACTIVITIES`: mind a 35 sorhoz a KSH ÖVTJ'25 kód (`ovtjKod`) és a sor
  pontos neve (`ovtjNev`). Amíg nincs, minden új vállalkozónak a csapat írja be a kódot, és addig az útmutatója vár.
- **Név + domain:** döntsd el a végleges nevet, vegyél domaint. A nevet egy helyen írjuk át (kod/shared/brand.json), utána új APK,
  és a fő videót újra kell renderelni (a név a kezdő- és zárókockában és a poszteren van): `python C:\Users\UpgradePC\konyvelo_app\video\bekotes\eszkoz\render.py`,
  majd `node kod\deploy\videok-json.mjs` és `bash kod\deploy\feltolt.sh --media`. Az útmutató-videókban nincs terméknév.
- **SimplePay:** simplepay.hu → Kereskedőknek → szerződés (domain + Somosi Kft. adatai). Utána a kereskedői adminból: MERCHANT + SECRET KEY (HUF),
  az IPN cím beírása: https://api.<domain>/api/v1/webhooks/simplepay/ipn, sandbox tesztlista, logócsomag letöltése.
- **Brevo (e-mail):** brevo.com → fiók → Senders & Domains → domain hitelesítése (SPF/DKIM a DNS-ben) → SMTP & API → SMTP kulcs.
- **Google-belépés:** console.cloud.google.com → APIs & Services → Credentials → OAuth client ID: Web, Android (aláíró kulcs SHA-1), iOS.
  Apple-belépéshez Apple fejlesztői fiók kell (bundle id: com.somosi.kezjegy). Addig ezek a gombok rejtve vannak.
- **NAV teszt:** onlineszamla-test.nav.gov.hu → Ügyfélkapu+ belépés a Kft. nevében → regisztráció → 1 technikai felhasználó (csak lekérdezés).
  Szoftverazonosító: HU + Kft. törzsszám (8 jegy) + 8 saját karakter. Élesben a könyvelő ügyfelenként hoz létre technikai felhasználót.
- **Díjszámla:** válassz Számlázz.hu vagy Billingo között + API-kulcs (a bekötést utána írjuk meg).
- **Ügyvéd:** nézesse át a `kod\jogi` mappát; a README.md-ben 11 kérdés (főleg: elég-e a fotós azonosítás a Pmt. szerint, kell-e a Kft.-nek
  könyvelői engedély, meghatalmazás a könyvelőre vagy a Kft.-re). Előtte írd be a Kft. adatait: kod/shared/brand.json → provider.
- **Könyvelő:** név, végzettség, PM-szám, adóazonosító jel (az ONYA-útmutatóhoz), rajzolt figura vagy fotó, válaszidő, könyvelőprogram
  (export), garantált bérminimum + HIPA, közlemény. Mondja meg, jó-e neki az ONYA az AVDH helyett és a fotós azonosítás; alvállalkozói szerződés.
- **Kulcsok beírása:** PowerShellben `powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\kezjegy_kulcsok.ps1`.
  Ami megvan, beírod, a többinél csak Enter. A titkos értékek nem látszanak, egyenesen a szerverre mennek, az API újraindul.
  Éleshez a végén: APP_ENV=production és STAFF_TOTP_REQUIRED=true (a szkript ezt is kérdezi).
- **Mentés:** az éjszakai mentés még NINCS bekapcsolva (parancs: kod/deploy/README.md, „Mentés” rész). Válassz külső helyet (pl. Hetzner),
  és a titkosító kulcsokról (FILE_ENC_KEY, APP_DATA_KEY, NAV_CRED_KEY) + .backup_pass-ról legyen offline másolat.

## 4. Következő lépések
1. Nézd meg a `_reggel.jpg`-t, próbáld ki az APK-t, írd meg, mi nem tetszik. Jóváhagyott dizájn nélküli képernyők: fiók, Számlaszámok lap, feltöltés-választó.
2. Név + domain → SimplePay-szerződés → Brevo → kulcs-szkript.  3. NAV-teszt regisztráció → próba-lehívás NAV_MODE=test módban.
4. Ügyvéd + könyvelő egyeztetése.  5. Play Áruház / iPhone: fejlesztői fiókok, EAS-projekt, push (FCM/APNs), saját aláíró kulcs.
6. Döntéseid: türelmi idő felfüggesztés előtt (alap 14 nap), ajánlói jutalom, a Kft. ÁFA-státusza, mutasson-e összeget a push értesítés.
