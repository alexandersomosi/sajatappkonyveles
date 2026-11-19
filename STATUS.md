# Kézjegy (munkanév) – állapot, 2026. 11. 19. este (a nap zárása)

**Él:** app https://app.45-94-65-74.sslip.io · panel https://konyvelo.45-94-65-74.sslip.io (18:10 óta a legfrissebb, este újra ellenőrizve). **Android:** `apk\Kezjegy-1.0.7-test.apk` (1.0.7 / 8, 19:17, 70,6 MB, SHA-256 `795d8358…2e610e06`; benne a ma esti 2. javító kör is; a régi fölé frissítésként települ, telefonon még nem próbáltuk). A te két fiókod (alex@, tulaj@) megvan, a Gardoko 200. A mai hosszú leírás: `_regi\STATUS_elotte_zaras_1119.md`.

## Mi változott ma a kéréseidre
- **1. Valódi NAV-képek:** a vállalkozás-bejelentésnél 18-ból 7 valódi (belépés, Ügysegéd főoldal, ügytípus, személyi adatok, nyilatkozatok, beküldés, megtekintés – a NAV kisfilmjéből, a mintaadatok elmosva). 11 még rajz, a kép alatt: „Rajzolt vázlat”. A meghatalmazás 16 képe valódi, a jóváhagyásé 6 valódi + 1 rajz.
- **2. Vissza lehet váltani:** „Módosítom” a Főoldal első sorában, az Adataid lapon, a kérdőívnél és a Fiókban; utána pár másodpercig „Visszavonom”. Amit beírtál, megmarad. Ha már megvan az adószám, a váltás visszahívással megy.
- **3. „Intézzük helyetted” kiemelve:** kék keretes kártya a választásnál, a Főoldalon és az útmutatók elején; a meghatalmazásnál „Megcsináljuk helyetted” a lap tetején. Menete: visszahívás 24–48 órán belül → Bence a saját belépésével, meghatalmazottként beküldi → az ügyfél 4 napon belül jóváhagyja az ONYA-ban → az appban engedélyezi → Bence beküldi a bejelentést. Belépési adatot soha nem kérünk. A panelen külön „Intézzük helyette” lista, határidőkkel és késés-emlékeztetővel.
- **4. Átláthatóság:** „Így halad a bekötésed” lista: minden sorban ki lép (Te / Bence / Csapatunk / NAV), mennyi idő, „Mi ez?”. Fölötte „Most ez jön” kártya egy gombbal. Ha mi késünk, a várakozó kártya kiírja. Mindenhol „anyukád”.
- **Számla-szöveg (10:20):** mindenhol „Kiállított számlák”: „A kiállított számláid maguktól megjelennek itt – nem kell feltöltened őket.” + egy „Mi ez?” magyarázat. A szójegyzék: SPEC §27.
- **Adóhiba javítva:** ha egy jóváhagyott negyedévbe utólag kerül bevétel, az adója a következő nyitott negyedévbe kerül, és Bence figyelmeztetést kap.
- Tesztek: backend 262, panel 61, app 31, jogi 45 – mind zöld. Minden élesítés előtt titkosított mentés; a mai 3 adatbázis-változás csak bővített, semmi nem törlődött.

## Még nyitott (az esti ellenőrzés találta, nem javítottuk)
- **Visszavonás hiba:** ha „Intézzétek helyettem” után átváltasz „már van”-ra, majd „Visszavonom”, a kérés nem jön vissza (újra kell kérni). A visszahívás-kérés közben nyitva marad.
- **Régi link / Vissza gomb:** a vállalkozás-indítás lapjai (központ, kérdőív, útmutató) annak is megnyílnak, akinél már „van vállalkozás”. Ott egy körbe vezető zsákutca is van.
- **Kikapcsoló:** az `ASSIST_EV_ENABLED=false` és a 12-31-i határnap csak az ÚJ kéréseket állítja meg, a folyamatban lévőket nem.
- **Bejelentés-videó:** a 2. javító körben elveszett 4 kézzel beállított kameraállás (pl. 108 mp-nél levágott táblázat). Újra kell renderelni, hang nem kell (0 Ft).
- **Apróbbak:** 320 px-en levágott gombfelirat („Igen, még nincs vállalkozás…”, „Megnézem a két lehető…”); a hívás-csík és a „Közben:” sor kétszer mondja ugyanazt; „Most ez jön · 8. lépés”, miközben a 4–7. sor nyitott; a 4 napos jóváhagyás utolsó napján „ma” áll, de este 8 körül már lejár; Bence beküldési napja lehet korábbi az ügyfél engedélyénél; a panel Üzenetek lapja „elállt”-at ír váltás után; a panelen még „lehívás” szó.
- **Saját-kép parancs:** lefut, de a jelölések több képen kézi igazítást kérnek, és nem figyelmeztet. A leírásban hiányzik, hogyan mentse a képet (05.png) és hogyan jut el hozzád.
- Korábbról: T3, T6, T8, T9, T10, T13 adó-/szövegpont, a videók képi javítása (O2, O3), a PDF kinézete (O6).

## A te dolgod
1. **NAV-képek:** kérj meg egy ismerőst, akinek még NINCS egyéni vállalkozása (Ügyfélkapu+ vagy DÁP kell). Leírás: `utmutato_kepek\SAJAT_KEPEK.md` – 7 kép (05, 06, 07, 08, 09, 10, 12), a „Bejelentés megtétele” gombot NE nyomja meg. Utána egy parancs: `python C:\Users\UpgradePC\konyvelo_app\utmutato_kepek\sajat_kepek.py`, és szólj nekünk, mielőtt feltöltjük. Ha a te NAV-fiókodban maradt „Kitöltés alatt” piszkozat: beküldés nélkül nem indít semmit, de törölheted.
2. **Ügyvéd:** `kod\jogi\UGYVED_KERDESEK_k5.md` – beküldheti-e a könyvelőnk az új vállalkozás bejelentését (Üttv., Btk. 286. §), elég-e az appban adott engedély, használhatók-e a NAV-kisfilm kockái. Addig a bejelentés-rész kikapcsolható (`ASSIST_EV_ENABLED=false`, lásd fent a hibát).
3. **Döntések:** a bemutató videó sorrendje és a „NAV-os értesítés” szó (2 új hangsor kell); legyen-e külön díj az „Intézzük helyetted”-ért (most nincs); Bence UJEGYKE-jogcíme (9 vagy 60); a regisztráció elárulhatja-e, hogy egy címmel már van fiók.
4. **Mentés:** az éjszakai mentés cronja még nincs bekapcsolva, és a szerveren 6 régi, titkosítatlan mentés van – csak a te igeneddel nyúlunk hozzájuk.
5. **APK:** másold a telefonra, telepítsd a régi fölé, és írd meg, mi nem tetszik.
6. **Korábbi teendők (változatlan):** végleges név + domain; SimplePay-szerződés; Brevo (e-mail); Google/Apple-belépés; NAV teszt-regisztráció (technikai felhasználó); Számlázz.hu vagy Billingo; a könyvelő adatai + a 35 tevékenység ÖVTJ-kódja; kulcs-szkript (`kezjegy_kulcsok.ps1`); Play Áruház / iPhone fejlesztői fiókok.
7. **Ha kéred, holnap** a fenti „Még nyitott” hibákat javítjuk (a videóhoz és a képekhez pénz nem kell).
