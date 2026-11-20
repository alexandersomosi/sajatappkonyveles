# Adózz (munkanév: Kézjegy) – állapot, 2026. 11. 20. 10:15

**Él:** app https://app.45-94-65-74.sslip.io · panel https://konyvelo.45-94-65-74.sslip.io · API 200 (10:08-as élesítés után mind a három cím 200). A te fiókjaid (alex@, tulaj@) és Bence + Dávid demo-belépése változatlan, az adatbázishoz nem nyúltunk (élesítés előtt titkosított mentés: `/srv/kezjegy/_regi/db_elotte_up_20261120_100737.dump.gpg`). A Gardoko törölve, ez rendben van. APK most nem készült (kérésed szerint). Az előző állapot: `_regi\STATUS_elotte_k6c3_1120.md`.

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
