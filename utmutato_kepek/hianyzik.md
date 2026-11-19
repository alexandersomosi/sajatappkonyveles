# Hiányzó valódi NAV-képernyőképek – így pótolod

2026-11-19 (az előző változat: `_regi/doku/hianyzik_elotte_kisfilm_20261119.md`). Mi senki nem léptünk be a NAV-hoz vagy az
Ügyfélkapu+-ba. Ami csak belépés után látszik, és hivatalos anyagban sincs róla kép, az most is **rajzolt „Illusztráció”**.
**A tulajnak: `SAJAT_KEPEK.md` (telefonon is olvasható), és egy parancs: `python sajat_kepek.py`.**

## 1. Mi valódi és mi rajz (vállalkozás bejelentése)

2026-11-19-én a NAV hivatalos kisfilmjéből („Megújul az Ügysegéd”, https://youtu.be/DQnbjo2lrv8, NAVgovHu csatorna; a NAV
2026.02.19-i sajtóközleménye és a nav.gov.hu „Új ügysegéd” csempéjének „Segédlet” linkje mutat rá) hat lépéshez lett valódi kép.
A kisfilm a NAV bemutató-felületét mutatja tesztadatokkal („SAMPLE …” nevek); a neveket és az ügyazonosítót elmostuk.
Rögzítés: a beépített böngészőben, hd1080 lejátszás közben a kockát canvasra rajzolva, 1:1-es képernyőképekből (videót nem
töltöttünk le) – `_forras2/kisfilm_kockak/` (`kockak.json`), előkészítés: `_eszkoz/kisfilm_nyers.py`, beírás: `_eszkoz/kisfilm_beepit.py`.

| Fájl (`vallalkozas_bejelentes/`) | Képernyő | Most | Mit kell rajta megnézni a valódi felületen (saját kép) |
|---|---|---|---|
| `01_belepes.png` | Belépés (KAÜ) | **valódi** (belépő oldal) | – |
| `02_ugyseged_fooldal.png` | Ügysegéd, három fül | **valódi** (kisfilm 0:32) | – |
| `03_ugyseged_ugytipus.png` | Új bejelentés fül, az ügy | **valódi** (kisfilm 0:28) | – |
| `04_szemelyi_adatok.png` | Személyi adatok (1/6) | **valódi** (kisfilm 0:22) | kér-e TAJ-számot (a kisfilmben nincs ilyen mező) |
| `05_cimadatok.png` | Vállalkozói címadatok (2/6) | Illusztráció | székhely mezői, telephely/fióktelep, jogcím |
| `06_tevekenysegek.png` | Tevékenységek (3/6) | Illusztráció | ÖVTJ-kereső, főtevékenység |
| `07_adozas_munkavegzes_<valasz>.png` (4 db) | Adózási adatok (4/6) – A munkavégzés jellege | Illusztráció | **a választható sorok pontos felirata** (a kisfilm Megtekintés lapján az egyik: „Főfoglalkozásként”) |
| `08_adozas_kata_atalany.png` | Adózási adatok – kata, átalányadó | Illusztráció | a két nyilatkozat pontos felirata |
| `09_adozas_afa_mentesseg.png` | Adózási adatok – Áfa-mentesség | Illusztráció | a „2. Az alanyi adómentesség választása” sor (a kisfilmben az 1. sor felirata: „Kizárólag közérdekű, vagy egyéb sajátos jellegére tekintettel adómentes tevékenységet folytatok.”) |
| `10_adozas_afa_tobbi_eu_igen.png`, `..._eu_nem.png` | Adózási adatok – közösségi adószám, MNB/EKB, pénzforgalmi, 49/A., 89/A., 96. § | Illusztráció | sorrend és feliratok |
| `11_nyilatkozatok.png` | Nyilatkozatok (5/6) | **valódi** (kisfilm 0:24) | – |
| `12_ellenorzes.png` | Ellenőrzés (6/6) – az összesítő | Illusztráció | az összesítő kinézete |
| `13_bekuldes.png` | Ellenőrzés – a lap alja, „Bejelentés megtétele” | **valódi** (kisfilm 0:37) | – |
| `14_megtekintes_pdf.png` | Bejelentéseim, kérelmeim – Megtekintés | **valódi** (kisfilm 0:42) | csak valódi beküldés után látszik |

**Amit a kisfilm a valódi felületről megmutatott (a szövegekben javítani érdemes – `kod/shared/src/bekotes.ts`, nem itt):**
- A folyamat **6 lépés**: Személyi adatok · Vállalkozói címadatok · Tevékenységek · Adózási adatok · Nyilatkozatok · Ellenőrzés
  (a rajzolt vázlatok 11-19 óta ugyanezt az 1–6 sávot mutatják; a Megtekintés a beküldés után, a „Bejelentéseim, kérelmeim” fülön van).
- A Személyi adatok lapon: viselt név, születési név, anyja születési neve, születési idő, ország, hely, adóazonosító jel,
  állampolgárság – **TAJ-szám ezen a lapon nincs**; lakcím sincs.
- A **Nyilatkozatok** lapon **négy** jelölőnégyzet van, mindet be kell jelölni: I. nincs kizáró ok (büntetőjogi felelősséggel);
  II. a főtevékenység feltételeit tudomásul veszi; III. a megadott ingatlanok megfelelnek a feltételeknek; IV. a kamara értesítését
  tudomásul veszi. Eddig az app csak az elsőt említette (index.json: frissítve).
- A „Bejelentés megtétele” után még egy **„Figyelem!” ablak** jön (Mégse / Bejelentés megtétele), utána „Sikeres bejelentés” – Rendben.
- A PDF: „Bejelentéseim, kérelmeim” fül → az ügy kártyája (Elfogadva, azonosító, benyújtás ideje) → **Megtekintés** → **Letöltés**.

A kisfilm további kockái (a 0:17 „Képviseletválasztó”: „Saját ügyemben járok el / Más ügyében járok el”; a „Figyelem!” ablak;
a „Sikeres bejelentés”; a Megtekintés lap alja a Letöltés gombbal) a `_forras2/kisfilm_kockak/` mappában vannak, de nem kerültek
útmutatóba: a „Figyelem!” ablak a kisfilmben adatváltozást kérdez („Biztos, hogy bejelenti az adatváltozást?”), a Megtekintés
lapon pedig a mintaügy áfamentességként az 1. pontot mutatja – mindkettő félrevezető lenne egy kezdőnek.

**2026-11-19 – hol kerestünk még (az előző körön túl):** a NAV YouTube-csatornája (NAVgovHu; „ügysegéd”, „egyéni vállalkozó”,
„ügyfélportál” keresés: csak ez az egy kisfilm), a nav.gov.hu „Új ügysegéd” csempe és Tájékoztatók rovata (üres), a NAV
sajtószoba Ügysegéd-hírei (a „Mától elérhető a Vállalkozói Ügysegéd” hír erre a kisfilmre linkel; más képet nem tartalmaznak),
az „Egyéni vállalkozás lépésről lépésre” oldal (2026.02.19., 15 kártya + PDF:
`_forras2/nav_lepesrol_lepesre/` – a kártyákon csak a **régi** Webes Ügysegéd apró képei vannak, ezért nem használtuk),
kormany.hu, mkik.hu (a 2027-es kamarai nyilvántartásról még nincs felület-kép), a NAV Facebook-oldala (keresővel: nincs
Ügysegéd-bejegyzés képpel; belépni nem léptünk). Felhasználói kézikönyv a Vállalkozói Ügysegédhez nincs, csak a 2026.03.19-i
szöveges útmutató. Magán könyvelő-blogon sem találtunk képernyőképes leírást (ha lenne, azt csak hivatkoznánk, képet nem vennénk át).

## 2. Ami valódi, de régebbi (meghatalmazás, nem kötelező pótolni)

A meghatalmazás minden képe valódi. A friss (2026.11.18.) képek a nyilvános, belépés nélküli ONYA-ból készültek; néhány a NAV
segédleteiből jön:

| Fájl (`meghatalmazas/`) | Forrás | Megjegyzés |
|---|---|---|
| `03_onya_profil.png`, `04_onya_uj_nyomtatvany.png`, `07_uj_bejelentes.png` | NAV ONYA-bemutató, 2026.01.23. | friss felület; a 07 a meghatalmazott nézete, a meghatalmazóé ugyanígy néz ki, más fejléccel |
| `06_meghatalmazo_szerep.png`, `10_kepviselt_te.png`, `14_benyujtas.png`, `15_sikeres_benyujtas.png`, `16_lista_megtekintes.png` | NAV segédlet, 2025.03.11. | 2025-ös felület; ha az ONYA azóta átrendeződött, érdemes cserélni |

A 08, 09, 11, 12, 13 a **belépés nélküli** UJEGYKE-űrlapról készült. Belépve ugyanezek a rovatok vannak, de a „Képviselt”
rész előre ki van töltve. Ha belépve más a sorrend, cseréld.

**A `14_benyujtas.png` forrása kiegészített kép** (2026-11-19): a NAV-segédlet ábrája a bal szélén levágva szerepel, ezért a két
szélére fehér sáv került, és a hiányzó fél betűt ugyanennek a segédletnek egy másik ábrájából pótoltuk (`_eszkoz/benyujtas_teljes.py`).

## 3. Saját képernyőkép (tulaj) – egy paranccsal

1. **`SAJAT_KEPEK.md`**: belépés (Ügyfélkapu+ / DÁP), a lapok listája sorrendben, mit kell látni rajtuk, és **NE KÜLDD BE**.
2. A képek ide: `utmutato_kepek/sajat/vallalkozas_bejelentes/` – csak a még rajzolt hét: **05, 06, 07, 08, 09, 10, 12**
   (`NN.png`; a meghatalmazáshoz: `sajat/meghatalmazas/NN.png`). A mappában az `IDE_A_KEPEKET.txt` marad, a `_nyers` almappához ne nyúlj.
   A végén a „Bejelentéseim, kérelmeim” fülön maradhat egy „Kitöltés alatt” piszkozat: beküldés nélkül nem indít vállalkozást; ha lehet, törölni.
3. Egy parancs: **`python C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/sajat_kepek.py`**
   - szövegfelismerés (a Windows beépített magyar OCR-je, `_eszkoz/ocr.ps1`, hálózat nélkül), és elmos minden személyes adatot
     (bejelentkezett név, a személyes rovatok értéke, hosszú számok, e-mail, csupa nagybetűs nevek; az adatos lapokon – 04, 05, 12 –
     minden ismeretlen szót; ha van `sajat/nevek.txt`, az abban lévő szavakat minden képen). A kép **elmosva** kerül a `_sajat/` alá;
   - a jelöléseket a szöveg alapján a helyükre teszi (amit nem talál, annak a felirata keret nélkül marad, és szól);
   - `index.json` (`sajat` blokk, forrás, alt), `annotate.py` (a régi kép a `_regi/`-be), ellenőrző lap:
     `_elonezet/sajat_ellenorzes_<útmutató>.jpg` (piros = elmosva, kék = jelölés);
   - `node kod/app/scripts/utmutato-kepek.mjs` (az appba), és `_eszkoz/video_ujra.py`: a videó újra, **a meglévő hanggal**
     (a hálózat és a fizetős hívások a folyamaton belül tiltva; a kézi kameranézeteket a megváltozott képeken a jelölésekhez igazítja).
   - Feltölteni nem tölt fel: az ellenőrző lap megnézése után `node kod/deploy/videok-json.mjs` + `bash kod/deploy/feltolt.sh --media`.
4. Kézi javítás, ha kell: `sajat/<útmutató>/NN.json` – `{"homalyos": [[x0,y0,x1,y1]], "vagas": [...], "jelolesek": {"1": [...]}}`
   (az eredeti képernyőkép pixelében), vagy Claude-nak: „nézd meg a saját NAV-képeim ellenőrző lapját”.
5. Próba (a valódi fájlokhoz nem nyúl): `python _eszkoz/sajat_kepek_proba.py` – a rajzolt vázlatok másolatait kitalált adatokkal
   „tulaj-képnek” teszi egy ideiglenes mappába, és végigfuttatja (elmosás-ellenőrzés OCR-rel, app-jegyzék, videó, költségnapló).
   11-19 javító kör 2: `python _eszkoz/sajat_kepek_proba.py --csak-horgony` – a valódi NAV-űrlap fejléce, címe és 1–6 lépéssora
   (a NAV kisfilmjének 21,6 s-os kockájából) + a 05/06/12 vázlat tartalma: a jelölések nem eshetnek a címre / a lépéssorra
   (a „Főtevékenység” horgony eddig a cím „tevékenység” szavára talált). A teljes próba is lefuttatja.

A „Megtekintés” (PDF) képernyő csak beküldés után látszik: az marad a kisfilmből (vagy egy valódi ügyfél képe, az ő engedélyével, elmosva).

## 4. 2027

2027. január 1-jétől a kamara vezeti az egyéni vállalkozók nyilvántartását (Evectv. módosítás, 2026. évi III. törvény).
Az új felület képei még nem ismertek: 2026 végén az egész `vallalkozas_bejelentes` sorozatot újra kell nézni.
