# Adózz (munkanév: Kézjegy) – állapot, 2026. 11. 20. 18:50

**Él:** https://adozz.hu · https://app.adozz.hu · https://konyvelo.adozz.hu · https://api.adozz.hu (a régi sslip-címek is mennek). 18:45-kor mind a nyolc cím 200/301. A te fiókjaid (alex@, tulaj@) és Bence + Dávid demo-belépése változatlan, az adatbázist sosem töröltük (minden élesítés előtt titkosított mentés a `/srv/kezjegy/_regi/`-be). A Gardoko törölve, ez rendben van. APK most nem készült. Az előző állapot: `_regi\STATUS_elotte_k6c3_1120.md`.

## k7 – összefoglaló (18:50): mi él, mi teszt, mi a te dolgod

**A kérdésedre („nem úgy volt, hogy így végigmegy először?”):** igen, és most így megy (15:57 óta élesben, 18:10-kor
harmadszor is végigjátszva telefon-méreten): Regisztrálok → e-mail-kód → **„Szia {név}!”** → **„Ő lesz a könyvelőd”** →
**„Így indulunk”** (4 lépés + 19 999 Ft/hó) → kérdések lépésenként → szerződés, NAV-engedély → **„Utolsó lépés: a kártyád”**
→ Főoldal. Képek: `_munka\k7\kuldendo.txt`.

**Élesben (bárki megnyithatja):**
- Saját cím: `adozz.hu` (bemutató oldal az árakkal), `www.adozz.hu` → `adozz.hu`, `app.`, `konyvelo.`, `api.adozz.hu`;
  saját proxy (`kezjegy-proxy`), Let's Encrypt-tanúsítvány (magától megújul). A régi közös Caddy leállt, a Gardoko-maradék a `_regi`-ben.
- Árak (valódi, DEMO jelölés nélkül, a tulajdonosi felület **Díjak** lapján módosíthatók): havidíj **19 999 Ft**, éves zárás
  **14 999 Ft**, szüneteltetés alatt **2 999 Ft/hó**, változás magad (útmutatóval) **0 Ft**, helyetted **4 999 Ft**,
  jogállás-változás **7 999 Ft** (előre). Nincs ingyenes próbaidő: az első hónapot a kártya megadásakor fizeti.
- A vezetett első indulás (bevezető), az igazolások, a bevételi kimutatás (PDF), a változás- és megszüntetés-útmutatók,
  a határidők naptárba, a tulajdonosi konzol (ügyfelek, zárolás, visszatérítés, díjszámlák).
- Tesztek (17:47-es állapot): adómotor 208, backend 420, app 49, panel 80, jogi 45 – mind zöld.

**Még teszt / DEMO módban:**
- **Fizetés a szerveren: DEMO** (sárga „DEMO FIZETÉS” doboz, pénz nem mozdul). A Stripe-ot TESZT-módban (az „Adózz” Stripe-fiók,
  „Tesztkörnyezet”) és a Számlázz.hu Tesztüzemet csak ezen a gépen próbáltuk ki, kitalált ügyfelekkel (18:06): fizetés, részleges
  + maradék visszatérítés, helyesbítő számlák, adószámos vevő, és a rossz kártyák (hitelesítés kell / elutasítva / nincs fedezet) –
  mind jól kezelve. A NAV-hoz semmi nem ment, valódi pénz nem mozdult.
- **Díjszámla: DEMO** (`INVOICE_MODE=demo`). Az éles Somosi Kft.-s Számlázz.hu-kulcsodat a szerver nem használja.
- **E-mail és push:** még nem megy ki (nincs kulcs), csak az appban látszik. **NAV:** kitalált számlák, senki nem lép be a NAV-ba.
- Külön most fut: a hiányzó levelek pótlása (k7b) – annak az eredményét külön kapod.

**A te lépéseid, ebben a sorrendben** (kulcsot soha ne küldj chatbe; a szkriptek nem írják ki):
1. **Stripe TESZT a szerveren:** PowerShellben
   `powershell -ExecutionPolicy Bypass -File C:\Users\UpgradePC\konyvelo_app\stripe_szerverre.ps1`
   (a gépen elmentett teszt-kulcsokkal webhookot nyit az `api.adozz.hu`-n, beírja a szerverre, újraindít; csak OK / NEM OK-t ír).
   Utána az új regisztrálók a Stripe teszt-oldalán fizetnek (kártya: 4242 4242 4242 4242, bármilyen jövőbeli dátum, bármilyen CVC);
   a régi demó-ügyfelek (Dávid stb.) maradnak DEMO-n. Vissza: ugyanez `-Vissza`-val.
   Ugyanekkor: `ar_19999_szerverre.ps1` (a szerver tartalék ára még 20 000 → 19 999; a kijelzett ár már most is 19 999).
2. **Stripe-fiók aktiválása (az éles kulcsokhoz):** Stripe Dashboard → fiók aktiválása a Somosi Kft. adataival, bankszámlával,
   az ügyvezető azonosításával. Beállítások: rövid megnevezés a kivonaton `ADOZZ`; a Stripe saját nyugta-e-mailjei KI (a számlát
   mi küldjük); Radar alapszabályok BE. Az éles kulcsot még NE vidd fel: az élesítéskor megy, új, üres adatbázissal
   (`stripe_szerverre.ps1 -Eles`, előtte `kezjegy_kulcsok.ps1` `APP_ENV=production`) – ezt együtt csináljuk.
3. **Számlázz.hu élesre kapcsolása:** a Somosi Kft. Számlázz.hu-fiókjában „Rendelésszám ismétlődés tiltása” BE és e-számla BE.
   Élesítéskor `kezjegy_kulcsok.ps1` 6. pont: `szamlazzhu` + fiók `eles` + a Számla Agent kulcs. **Figyelem:** az első éles
   számla elindítja a fizetős csomagot. Utána egy valódi 19 999 Ft-os fizetés a saját kártyáddal + visszatérítés → sztornó,
   és megnézzük a Számlázz.hu-ban és a Stripe-ban.
4. **Zoho ZeptoMail token:** a Zohóban hitelesítsd az `adozz.hu` domaint (a DNS-be a megadott SPF/DKIM sorok), készíts
   Send Mail Tokent, és `kezjegy_kulcsok.ps1` 2. pont: `smtp.zeptomail.eu`, `587`, felhasználó `emailapikey`, jelszó a token,
   feladó pl. `Adózz <ertesites@adozz.hu>`. Kódot nem kell hozzá írni.
5. **Ügyfélszolgálati e-mail és telefon:** döntsd el. Most telefon sehol nem látszik, a jogi szövegekben `[CÉGADAT]` helyőrző áll,
   a bemutató oldalon: „Ügyfélszolgálat: az appban, az Üzenetek fülön.” A `kod\shared\brand.json`-ban viszont már
   `ugyfelszolgalat@adozz.hu` áll – ha nem ez lesz, szólj, és átírjuk (vagy kivesszük).


## 17:46 – a 2. ellenőrzés hibái javítva, élesben (k7c2)
Élesítés előtt titkosított mentés (`_regi/db_elotte_up_20261120_174609.dump.gpg`), migráció 19 → 20 (csak bővít). A fiókjaid
(alex@, tulaj@) VÁLTOZATLANOK, Dávid és Bence számai ugyanazok. Mind a nyolc cím 200/301. Tesztek: adómotor 208, backend 420,
app 49, panel 80, jogi 45 – mind zöld. Képek: `kod\_qa\k7c2j_*.png`.
- **Fizetés:** egy díjat csak egyszer lehet kifizetni (ha mégis kétszer jön pénz, a másodikat automatikusan visszautaljuk,
  számla nélkül, és szólunk). Díjfizetés nem ment el kártyát. Levonás csak 3 nappal előtte küldött értesítés után.
  Ha a Stripe visszautasítja a kérésünket, a hónap fizetetlen lesz (nem fut a végtelenségig), és szólunk neked.
- **Számlázz.hu:** a DEMO szerveren a szerver soha nem olvassa az ÉLES kulcsodat, a teszt fiók csak a saját teszt kulcsával megy.
- **Ár:** az ÁSZF, a szerződés, a kártyás engedély és a regisztráció mindenhol 19 999 Ft (a Díjak beállításból jön).
- **Adó:** utólag jóváhagyott családi kedvezménynél nincs „elveszett” keret (Réka: kb. 195 000 Ft megtakarítás, 139 380 Ft jár
  vissza); a járulék a saját hónapjában marad (Kata: eddigi adó 1 063 633 Ft). A bevételi kimutatás csak a már megérkezett pénzt
  számolja (Kata: 8 242 000 Ft) – ezért Bencének újra jóvá kell hagynia a kimutatását.
- **Kata:** nincs negyedéves átalány-határidő, helyette havi 50 000 Ft; a cégnek kiállított számlánál piros figyelmeztetés.
- **Képernyők:** felmondott ügyfélnél egy dátum és „Felmondtuk…” (nincs „Mégis maradok”); fizetetlen havidíjnál „Adót most nem
  kell fizetned” + piros kártya az okkal; a konzol párbeszédablakai kiírják, miért nem ment; „Díjak és számlák” a bekötés alatt is.
- **Neked kell dönteni:** 1) Hosszú szünetelés után a „Fizesd ki” a legrégebbi hónapot fizeti, és a további elmaradt hónapokat
  is levonjuk (most már mindegyiket 3 nappal előtte jelezve). Maradjon így, vagy induljon újra a hónap a fizetés napjától?
  2) Felmondott ügyfélnél most nincs „Fizesd ki” (ha mégis fizet, értesítést kapsz, és visszautalhatod). Így jó?
  3) A szerver `.env`-jében a tartalék ár még 20 000: `ar_19999_szerverre.ps1` (te futtatod) átírja 19 999-re.
  4) A `brand.json`-ban már van ügyfélszolgálati e-mail (`ugyfelszolgalat@adozz.hu`) – ha még nem döntöttél, szólj.
- **Bencének:** szünetelés alatt arányos-e a sávos iparűzési adó (most egész évre 50 000 Ft-tal számolunk).

## 16:00 – a bevezető javítva, élesben (a kérdésedre: „nem úgy volt, hogy így végigmegy először?”)
Igen, így kellett volna – és most így megy. A hiba: a regisztráció után az e-mail-kód megerősítése egyenesen a bekötési
listára vitt (ott: „Folytasd ott, ahol abbahagytad”), és csak egy újratöltés után indult el a bevezető. Most:
- **Regisztrálok → e-mail-kód → Megerősítem → „Szia {keresztnév}!”** (az üdvözlő képernyők), utána lépésről lépésre.
- Aki még el sem kezdte, a listán nem „Folytasd ott…” kártyát lát, hanem „Végigvezetünk a beállításon – Kezdjük”.
- A „Jár neked adókedvezmény?” kérdésnél a „Később” most tényleg továbbvisz (eddig ugyanaz a kérdés jött vissza).
- Az „Intézzük helyetted” lapon is megmarad a bevezető fejléce és a haladás.
- A végén nem írja, hogy „Kész vagy”, ha még jön tőled valami: „Most nincs több teendőd. Később még 1 dolog kell tőled: NAV-meghatalmazás.”
Végigpróbálva a valódi regisztrációs képernyőkön, kitalált adatokkal (képek: `kod\_qa\k7c_bevezeto_*.png`). Élesítés előtt
titkosított mentés; a fiókjaid és a demó-belépések változatlanok. Tesztek: backend 402, app 49 – mind zöld.
Ami még nyitott (nem ez a javítás): a szerveren a havidíj még 20 000 Ft-ként szerepel (regisztráció, ÁSZF); ezt külön kell javítani.

## A kért 5 funkció – mind kész, élesben
1. **Ennyit tegyél félre** – minden kiállított számládnál egy sor: „145 000 Ft-os számla – ebből kb. 5 000 Ft-ot tegyél félre.” Mellette „Miért ennyi?”: megmutatja, miért nem mindig ugyanannyi (adómentes rész, havi minimum, negyedéves járulék). Mindig felfelé kerekít ezresre. A Főoldalon: „Most kb. … Ft legyen félretéve”, mellette az idei összes és a már lezárt negyedévek.
2. **Értesítés új számláról** – a napi NAV-lekérés után: „Új kiállított számlád: 120 000 Ft – Bodza Kiadó Kft. Tegyél félre kb. … Ft-ot.” Ha több jön, egy összesített üzenet. A beállításokat és az éjszakai csendes időt betartja. (A képen Bálint 25 év alatti és a havi minimumon van, ezért nála „most nem kell félretenned” – ez helyes.)
3. **2026-os kedvezmények** – rövid kérdőív (bekötéskor és a Fiókban): családi kedvezmény és járulékkedvezmény, 25 év alattiak, 30 év alatti anyák, a 2–3–4 gyermekes anyák SZJA-mentessége, első házasok, személyi kedvezmény. Bence a panelen jóváhagyja, a számítás ezzel megy, az ügyfél látja: „idén eddig kb. … Ft-tal kevesebb adó”.
4. **Mennyit kerestem?** – havonta és idén eddig mennyi maradt az adók után, plusz év végi előrejelzés egy egyszerű mondattal.
5. **Változás-útmutatók** – székhely, tevékenység (ÖVTJ), telephely, szüneteltetés, újrakezdés, adózási adat (ONYA). Lépésenként, a te saját NAV-képernyőiddel – **minden személyes adat elmosva** (ellenőriztük). Mindegyiknél: „Kérj visszahívást” és „Bejelentjük helyetted”.

## Ma reggel javítva (az ellenőrzés két súlyos adóhibája)
- **Kedvezmény utólag:** ha Bence a kedvezményt az I–III. negyedév jóváhagyása után hagyja jóvá, az előrejelzés eddig úgy számolt, mintha a régi negyedévek is csökkentek volna (Kata: „kb. 560 000 Ft adó”, a valóság kb. 1 090 000 Ft). Most a jóváhagyott negyedévek maradnak, csak a túlfizetett SZJA jár vissza. A Kedvezmények lap is így számol (Kata: 389 000 + 101 000 = kb. 490 000 Ft, nem 1 023 000).
- **Számlák sorrendje:** a félretenni-összeg mostantól a pénz beérkezésének napja szerint számol, nem aszerint, mikor került be a tétel. Réka szeptemberi számlája így helyesen kb. 3 000 Ft (eddig tévesen „még adómentes”).
- Apróság: a panelen „Döntött: Kovács Bence” (eddig egy belső azonosító állt ott), és az „Ezt látja az ügyfél” kártyán kerek „kb.” összeg.
- Tesztek: adómotor 201, backend 321, panel 80, app 39 – mind zöld.

## Ami DEMO (nem valódi)
- Minden ügyfél, számla és összeg kitalált. A NAV-kapcsolat próbaváltozat: senki nem lép be a NAV-ba.
- A telefonos (push) értesítés és az e-mail kulcs nélkül nem megy ki, csak az appban látszik.
- A fizetés a szerveren DEMO-fizetés (az árak valódiak: 19 999 / 14 999 / 2 999 / 4 999 / 7 999 Ft). Stripe: lásd fent, 1. lépés.

## Neked kell dönteni
1. **Ügyvéd:** beküldheti-e Bence meghatalmazottként a változás-bejelentést, és elég-e az appban adott engedély (`kod\jogi\UGYVED_KERDESEK_k5.md`). A jogi szövegek még tervezetek.
2. **Díjak:** eldöntve (11-19/20): 4 999 / 7 999 Ft előre, útmutatóval ingyenes; éves zárás 14 999, szüneteltetés 2 999 Ft.
3. **Kulcsok az éleshez:** Stripe (élő), Számlázz.hu (éles), e-mail (Zoho ZeptoMail), push (Google/Apple), valódi NAV technikai
   felhasználó – a sorrend fent, a k7-összefoglalóban. A név (Adózz) és a domain (adozz.hu) kész. A SimplePay kódja megmaradt, ki van kapcsolva.

## Bencének (a könyvelőnek) kell eldöntenie
1. **Félretenni-szabály:** a számla miatt mennyivel nő az idei adó, ezresre felfelé – vállalja-e így. A végleges összeget továbbra is ő hagyja jóvá negyedévente.
2. **Utólag jóváhagyott családi járulékkedvezmény:** a már lezárt negyedévekre eső részt most sehol nem ígérjük vissza. Ha az éves bevallásban érvényesíti, szóljon: akkor mindenhol egyformán kiírjuk („az éves bevallásban”). A panel „Hatás” blokkja még úgy mutatja, mintha minden negyedévre járna.
3. **Szakmai pontok:** a várandósság 91. napja (orvosi igazolással), tevékenységváltásnál a költséghányad, költözésnél az iparűzési adó.
4. **Négy szem:** maradjon-e, hogy a változás lezárását nem az jelöli, aki beküldte.

## Képek (8 db, sorrendben): `_munka\k7\kuldendo.txt` (a k6-osak: `_munka\k6\kuldendo.txt`)
