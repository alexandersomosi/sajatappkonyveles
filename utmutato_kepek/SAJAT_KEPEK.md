# Saját NAV-képek – mi hiányzik még, és ki tudja lefotózni

*Frissítve: 2026-11-19 este (javító kör 2; a régi változat: `_regi/javito2_1119/SAJAT_KEPEK.md`).*

## Röviden

- **Te ezt nem tudod lefotózni.** Neked 2026. augusztus 1. óta van egyéni vállalkozásod, ezért a te fiókodban az
  „Egyéni vállalkozói tevékenység elkezdése” űrlap nem indul el. 11:50-kor azt kérted, hogy erre várjunk, amíg
  megkérsz valakit. A saját fiókodból készült képeidet ehhez az útmutatóhoz **nem használjuk**.
- **Kit kérj meg:** olyan ismerőst, akinek **még nincs** egyéni vállalkozása, van Ügyfélkapu+-a vagy DÁP-ja, és
  beleegyezik, hogy a képernyőképeit (elmosott adatokkal) felhasználjuk. Ő belép, végigkattint, lefotózza a lapokat,
  és **nem küldi be**. Kb. 20 perc.
- Addig a 11 rajzolt kép marad, őszinte felirattal („Rajzolt vázlat – a valódi képernyő kicsit eltérhet”). 11-19-én
  a rajzokat a valódi űrlaphoz igazítottuk: ugyanaz a cím („Egyéni vállalkozói tevékenység elkezdése”), ugyanaz az
  1–6 lépéses sáv, ugyanazok a gombok („Mentés”, „Tovább”, „Új főtevékenység”, „Új tevékenység hozzáadása”).

## Mi valódi már, mi rajz

| Útmutató | Valódi NAV-kép | Rajz |
|---|---|---|
| Vállalkozás bejelentése | 7: belépés (01), Ügysegéd főoldal (02), ügytípus (03), személyi adatok (04), nyilatkozatok (11), beküldés (13), megtekintés (14) | 11: címadatok (05), tevékenységek (06), munkavégzés jellege ×4 (07), kata/átalány (08), áfamentesség (09), többi áfa-rovat ×2 (10), ellenőrzés (12) |
| NAV-meghatalmazás (magad adod meg) | mind a 16 | – |
| Jóváhagyás az ONYA-ban („Intézzük helyetted”) | 6: nyitóoldal, belépés, profil, Főoldal + Meghatalmazások csempe, Értesítések jelzés, „Jóváhagyásra vár” csempe | 1: a JÓVÁHAGYÁS gomb és a megerősítő ablak (06) |

## A jóváhagyás gombja (06) – mikor lesz róla valódi kép

Csak akkor látszik, ha egy valódi meghatalmazás **jóváhagyásra vár**. Erre az első valódi „Intézzük helyetted”
ügyfélnél lesz alkalom (ő a saját gépén lefotózhatja, ha beleegyezik), vagy ha Bence egyszer neked küld be egyet.
Addig a rajz marad.

## Ha megvan az ismerős: így fotózzon

1. Gépen nyissa meg: **ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main**, és lépjen be (Ügyfélkapu+ vagy DÁP).
2. Kattintson az **„Új bejelentés, kérelem benyújtása”** fülre, majd: **„Egyéni vállalkozói tevékenység elkezdése”**.
3. Minden lapról képernyőkép: **Win + Shift + S**, a NAV-oldal fehér része. **A képernyőkép előtt vigye el az egeret a
   gombokról** (különben a súgó-felirat eltakarja a gombot, és a kép rossz helyen vágódik).
4. A képek neve és tartalma:
   - **05.png** – Vállalkozói címadatok: a Székhely és a Telephely / Fióktelep rész.
   - **06.png** – Tevékenységek: az „Új főtevékenység” gomb és a „Tevékenység(ek)” rész.
   - **07.png** – Adózási adatok, „A munkavégzés jellege”: még semmi ne legyen bejelölve.
   - **08.png** – Adózási adatok: kata **nincs**, átalányadózás **bejelölve**.
   - **09.png** – Adózási adatok, áfamentesség: a „2. Az alanyi adómentesség választása” bejelölve.
   - **10.png** – Adózási adatok, a többi áfa-rovat: mind üresen.
   - **12.png** – Ellenőrzés: az összesítő teteje.
5. **A „Bejelentés megtétele” gombot NE nyomja meg** – az valódi vállalkozást indít, és nem vonható vissza. A „Mentés”
   gombot se. A végén zárja be a lapot, és lépjen ki. A „Bejelentéseim, kérelmeim” fülön maradhat egy **„Kitöltés alatt”**
   piszkozat (a tiédben is ott maradt 11-19-én): beküldés nélkül nem indít vállalkozást; ha lehet, törölje.
6. A képeket (**05, 06, 07, 08, 09, 10, 12** – csak ez a hét kell) tedd ide:
   **C:\Users\UpgradePC\konyvelo_app\utmutato_kepek\sajat\vallalkozas_bejelentes\** (most ott egy **IDE_A_KEPEKET.txt** áll –
   azt hagyd ott, a `_nyers` almappához ne nyúlj), és ha akarod, az ő nevét, anyja nevét és címét soronként a
   **sajat\nevek.txt** fájlba (a parancs ezeket minden képen elmossa; a fájl csak a gépeden van).

## Egy parancs, ellenőrzés, feltöltés

```
python C:\Users\UpgradePC\konyvelo_app\utmutato_kepek\sajat_kepek.py
```

Elmossa a személyes adatokat, rárakja a jelöléseket, frissíti az appot és a videót **a meglévő hanggal** (nem kerül
pénzbe). A végén kiírja az ellenőrző lapot (`_elonezet\sajat_ellenorzes_vallalkozas_bejelentes.jpg`: piros = elmosva,
kék = jelölés), és – ha valamit nem talált – a figyelmeztetéseket még egyszer, a legvégén.

- Ha valahol még látszik név, cím vagy adóazonosító: **ne töltsd fel**, szólj Claude-nak.
- Ha minden jó: kérd meg Claude-ot („töltsd fel a saját NAV-képeket”). A feltöltés parancsa Git Bash-ban fut, nem a
  Windows parancssorban (a parancs a végén kiírja).

## Változásbejelentés – mi hiányzik még (11-19 este)

A 11-19-i saját képeidből elkészült a változás-útmutatók 11 valódi képe (elmosva: a neved, a címed, az azonosítók, a
főtevékenységed; `valtozas/`). Ami még rajz, és csak te tudod lefotózni a saját fiókodban:

- **Az adatváltozás-űrlap 4. lapja („Ellenőrzés”).** Ugyanúgy indítsd, mint 11-19-én („Egyéni vállalkozással
  kapcsolatos adatváltozás bejelentése” → „Bejelentés kitöltése”), kattints végig a „Tovább” gombokon, és a 4. lapról
  készíts képet. **Ne küldd be, és ne mentsd el.**
- **A szüneteltetés lapjai** az „Új bejelentés, kérelem benyújtása” fül alján: a kártya és a kezdőnap mezője.
  **Soha ne küldd be – azzal a saját vállalkozásodat szüneteltetnéd.**
- **ONYA, T101E:** csak az űrlap első lapja.

A képeket tedd a `sajat\vallalkozas_bejelentes\_nyers\` mappába (például `13_ellenorzes.jpg`), és szólj Claude-nak:
„dolgozd fel az új változás-képeket”. A NAV 11-19-én létrehozott egy üres „Kitöltés alatt” piszkozatot a fiókodban – azt
csak te törölheted a „Bejelentéseim, kérelmeim” fülön (mi nem nyúlunk a fiókodhoz).
