# Adózz (munkanév: Kézjegy) – állapot, 2026. 11. 20. 10:15

**Él:** app https://app.45-94-65-74.sslip.io · panel https://konyvelo.45-94-65-74.sslip.io · API 200 (10:08-as élesítés után mind a három cím 200). A te fiókjaid (alex@, tulaj@) és Bence + Dávid demo-belépése változatlan, az adatbázishoz nem nyúltunk (élesítés előtt titkosított mentés: `/srv/kezjegy/_regi/db_elotte_up_20261120_100737.dump.gpg`). A Gardoko törölve, ez rendben van. APK most nem készült (kérésed szerint). Az előző állapot: `_regi\STATUS_elotte_k6c3_1120.md`.


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
- A fizetés (havidíj, „Bejelentjük helyetted” díja: 4 999 / 7 999 Ft) DEMO-fizetés.

## Neked kell dönteni
1. **Ügyvéd:** beküldheti-e Bence meghatalmazottként a változás-bejelentést, és elég-e az appban adott engedély (`kod\jogi\UGYVED_KERDESEK_k5.md`). A jogi szövegek még tervezetek.
2. **Díjak:** jó-e a 4 999 / 7 999 Ft-os előre fizetett díj a „Bejelentjük helyetted”-ért (útmutatóval ingyenes).
3. **Kulcsok az éleshez:** push (Google/Apple), e-mail (Brevo), SimplePay, valódi NAV technikai felhasználó, végleges név + domain.

## Bencének (a könyvelőnek) kell eldöntenie
1. **Félretenni-szabály:** a számla miatt mennyivel nő az idei adó, ezresre felfelé – vállalja-e így. A végleges összeget továbbra is ő hagyja jóvá negyedévente.
2. **Utólag jóváhagyott családi járulékkedvezmény:** a már lezárt negyedévekre eső részt most sehol nem ígérjük vissza. Ha az éves bevallásban érvényesíti, szóljon: akkor mindenhol egyformán kiírjuk („az éves bevallásban”). A panel „Hatás” blokkja még úgy mutatja, mintha minden negyedévre járna.
3. **Szakmai pontok:** a várandósság 91. napja (orvosi igazolással), tevékenységváltásnál a költséghányad, költözésnél az iparűzési adó.
4. **Négy szem:** maradjon-e, hogy a változás lezárását nem az jelöli, aki beküldte.

## Képek (8 db, sorrendben): `_munka\k6\kuldendo.txt`
