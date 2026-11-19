# Útmutató-videók: vállalkozás bejelentése + NAV-meghatalmazás (SPEC §26.7, tulaj-kérés 8)

Két rövid, függőleges, narrált videó az önkiszolgáló útmutatók tetejére. A motor itt van (`eszkoz/`), és mindkét videót
ez építi. A meghatalmazás-videó a `../meghatalmazas/` mappában van.

| Videó | Mappa | Hossz | Hol jelenik meg |
|---|---|---|---|
| `vallalkozas_bejelentes` | `video/vallalkozas_bejelentes/` | 90–150 s | a bejelentés-útmutató teteje |
| `meghatalmazas` | `video/meghatalmazas/` | 60–100 s | a meghatalmazás-útmutató teteje |

## Egy parancs

```
python C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz/epit.py mind          # HANGGAL (végleges)
python C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz/epit.py mind --nema   # átmeneti: hang nélkül
```

A végleges lánc videónként:
1. `hang.py`: soronként Gemini 3.8 Flash TTS az OpenRouteren át (`google/gemini-3.8-flash-tts`), a **közös hanggal**
   (`video/hang.json`: **Umbriel** – a tulaj választása 2026-11-18 18:45 – + a privátbanki alapstílus + soronkénti hangulat), tartalom szerinti gyorsítótárral.
   A sor eleje a beszéd valódi kezdete: a felvétel eleji kattanást (a TTS szinte minden take elejére tesz egyet,
   0,1–0,4 s-mal a hang elé) a `hang.py` levágja, a zárhang (k, p, t) saját pattanását megtartja (`beszed_kezdete`).
   A régebbi take-eket az `eleje_javit` hozza rendbe (az `epit.py` minden futáskor meghívja; ismételhető, az átírt
   take eredetije a `hang/_regi/eleje_elott_<idő>/` mappában marad).
2. `vak.py`: minden sort 3-szor átírat a szöveg megmutatása nélkül (`google/gemini-3.8-flash`). Egy szó hibás, ha
   legalább 2 átiratból hiányzik. A szolgáltató biztonsági szűrője néha ártatlan sort is elutasít (403 „SAFETY”) vagy
   félbevágja a választ: az ilyen válasz nem eredmény, a `vak.py` újrakéri (tartalék-kéréssel is, a várt szöveg
   megmutatása nélkül); az elutasított kérés nem kerül pénzbe (`chat_blokk` sor a naplóban, 0 USD).
3. Újravétel legfeljebb 2 körben, **csak a hibás sorokra**. Minden sorra a legkevesebb hibát adó take marad.
4. Ha a videó a SPEC-sávnál hosszabb lenne, enyhe gyorsítás (legfeljebb 1,08x). Ha ez sem elég, szól, hogy rövidíteni kell.
5. `render.py`: kép, beégetett felirat, WebVTT, poszter, hangkeverés, kétmenetes H.264 High +
   AAC kódolás 14,3 MB célméretre (a kész fájl 15 MB alatt marad; a kvantáló felső korlátja 38, hogy egyetlen kocka
   se essen szét), `+faststart`. A jelölések és a felirat-váltások ideje a hang valódi ritmusából jön (lásd lent).
   - **Szín:** BT.709, korlátozott tartomány, teljes címkézéssel (mint a fő videó), így a böngésző a sávot a márkakék
     #1428DB-nek festi (címke nélkül, BT.601-gyel #0F31E4 lett). A `kockak/` JPEG-jei BT.601-re átszámolva készülnek.
   - **Hang:** -16 LUFS (visszamérve, ±0,3 LU), és a valódi csúcs a KÉSZ mp4-ben legfeljebb -1,5 dBTP: a keverés
     -2,6 dBTP-s plafonnal készül (az AAC 0,3–0,9 dB-t rálő), a kódolás után a `csucs_igazit` visszaméri, és ha kell,
     lejjebb vett plafonnal csak a hangsávot cseréli. A végleges hang egyszer kódolódik (a WAV-ból), nem kétszer.
     A mért értékek: `_elonezet/idovonal.json` → `hang`.
6. Másolat a `kod/media/`-ba (`<nev>.mp4`, `<nev>.vtt`, `<nev>_poszter.jpg`). A régi a `video/<nev>/_regi/`-be kerül.
7. `ellenoriz.py`: kodek, méret, hossz, színcímkék és a címkép kékje (#1428DB ± 3), hangosság és csúcs, VTT, poszter,
   tiltott szavak, a média-másolat egyezése, és kockák 3 másodpercenként (`kockak/vegso_lap_*.jpg`).

Kilépési kódok: 0 = kész, 1 = ellenőrzési hiba, 3 = OpenRouter 402 (nincs kredit; a lánc megáll, a meglévő kimenet
marad), 4 = betelt a keret.

**Keret:** a két videó együtt legfeljebb **0,30 USD** (TTS, átírás, lektorok); emelni csak az `UTMUTATO_HANG_KERET`
környezeti változóval lehet, és a három videó (a bekötés-videóval együtt) összesen sem lépheti át a 0,60 USD-t. Minden hívás a `koltseg.jsonl`-be kerül
(`video/<nev>/koltseg.jsonl`, a lektorok a bejelentés naplójában). Feltölteni nem szabad.

## Fájlok

| Fájl | Mi ez |
|---|---|
| `forgatokonyv.json` | a szöveg soronként: `mond` (amit a hang mond, a számok betűvel), `felirat` (beégetett + VTT), `kep` (NAV-kép), `jel` (melyik szónál jelenik meg melyik jelölés), `hangulat` |
| `lektor/kor1_*.json`, `kor2_*.json` | a két független lektor (nyelv: claude-haiku-5.5, tények: gemini-3.8-flash) válasza; az elfogadott és elutasított pontok a `forgatokonyv.json` „lektor” mezőjében |
| `hang/` | soronkénti WAV, `hossz.json`, `takek/` (minden take), `cache/`, `VAK.md` / `VAK.json` (vak ellenőrzés), `ALLAPOT.md` (ha áll) |
| `<nev>.mp4`, `<nev>.vtt`, `<nev>_poszter.jpg` | a kimenet (ugyanez a `kod/media/`-ban) |
| `kockak/` | ellenőrző kockák; `vegso_lap_*.jpg` = a kész mp4-ből 3 másodpercenként (a régiek: `kockak/_regi/`), `jel_lap_*.jpg` = jelölésenként egy kocka |
| `eszkoz/jel_kockak.py <nev>` | jelölésenként egy kocka a KÉSZ mp4-ből (0,5 s-mal a jelölés megjelenése után): ráközelít-e a kamera arra, amiről a hang beszél |
| `eszkoz/felirat_szinkron.py <nev>` | a VTT cue-k kezdete a beszéd tényleges kezdetéhez mérve a kész mp4 hangsávjában |
| `eszkoz/minoseg.py <nev>` | kockánkénti SSIM a kész mp4 és a köztes fájl között: szétesett kockák keresése a kódolás után |
| `eszkoz/kattanas.py <nev> --keres` / `<nev> <sor> <t0> <t1>` | a szünetekben álló rövid impulzusok listája, illetve egy soron belüli kattanás elnémítása a meglévő felvételben (új felvétel nélkül; az eredeti a `hang/_regi/`-be kerül) |
| `../felirat_tores.py`, `../hang_ellenorzes.py` | a három videó KÖZÖS felirat-tördelője és hangmércéje (a bekötés-videó is ezt használja) |
| `_elonezet/` | köztes fájlok (idővonal, hangkeverés, kétmenetes napló) |
| `_regi/` | a felülírt kimenetek (nem törlünk) |

## Kép

- Az alap a jelölt NAV-képek: `utmutato_kepek/<útmutató>/index.json`. A `kepek.py` ugyanazzal a rajzolással (az
  `annotate.py` függvényeivel) rakja össze őket alapra és jelölésenkénti rétegre. A teljes jelöléssel rajzolt kép
  pixelre egyezik a jelölt képpel (`python eszkoz/kepek.py` ellenőrzi).
- A jelölések egyenként, a narráció adott szavánál jelennek meg. A kamera lassan rájuk közelít. A széles, asztali
  NAV-képernyőképeken erősebben, hogy a betű telefonon is olvasható legyen. A „pirula” a jelölés feliratát mutatja.
- A rajzolt képeken „Illusztráció” címke és a forrás látszik, a valódiakon a forrás.
- Ha a tulaj saját képernyőképet tesz az `utmutato_kepek/_sajat/` mappába, és lefuttatja az `annotate.py`-t, akkor egy
  `epit.py` futás a videót is frissíti, ugyanazzal a forrásválasztással.
- C2-stílus: Geist betű, tintakék sáv, fehér lapok színezett alapon, valószerű 3D ikonok és tárgyképek a
  `dizajn/C2_modern/assets`-ből.

## Kamera és stílus (javítás, 2026-11-18 15:30)

- A videó csak a képernyőkép lapját mutatja; a jelölt kép alatti lista és forrássor nem látszik (a jelölés felirata a
  pirulában, a forrás a lábsorban), így saját felirat soha nem vágódik félbe.
- Jelölésenként a `forgatokonyv.json` `jel` bejegyzésében: `"nezet": [x0, y0, x1, y1]` (a jelölt @2x kép törtjében: ezt a
  részt mutatja egészben), `"skala"` (kimeneti px / vászon-px, apró segédlet-képekhez 1,5–1,9), `"sor_eleje": true`
  (széles asztali sor: előbb a sor eleje, pl. „UJEGYKE”, aztán végigúszik a gombig, és ott jelenik meg a jelölés).
  `"nezet"` + `"skala"` együtt: a nézet a megadott rész közepére áll a megadott nagyítással – így állítható be, hogy
  a kép széle két mező / két szó közé essen, és ne vágjon félbe feliratot vagy gombot. `"nyito_arany": 1.0`: a kép
  rögtön a jelölés nézetével nyit (alapból 0,9-szeres, kicsit távolabbi nyitókép van, ami félbevághat egy szélső feliratot).
- Felirat: kék (#1428DB) kapszula, fehér betű (mint a fő videóban); a végén kék zárókép (`"vege": {"cim", "al"}`).
- `"kitart": 1.2` egy jeleneten vagy egy soron: ennyi másodperc szünet utána, mielőtt a kép vált. Arra való, hogy a
  mondat végén megjelenő jelölés (vagy a lista utolsó sorai) látsszon, ne vágja el a váltás.
- **A hang valódi ritmusa** (csak a narrált módban): a `render.py` megméri a soron belüli szüneteket, és az írásjelekhez
  párosítja őket (`ritmus()`). A `jel.szo` horgonyok és a soron belüli felirat-váltások ideje így szünettől szünetig
  számolódik, nem egyenletes betűtempóból: a kamera akkor ér a jelölt részre, és a felirat akkor vált, amikor a hang
  tényleg ott tart. Néma / előnézet módban marad az egyenletes becslés (13,7 karakter/s, a közös hang mért tempója).
- Kockák gyors ellenőrzése az `eszkoz/` mappában: `python -c "import render; render.epit('<nev>', mod='nema', csak_kockak=[31.5, 38.0])"` (PIL-képeket ad vissza).

## Ha a hangos változat túl hosszú lenne (SPEC: bejelentés ≤ 150 s, meghatalmazás ≤ 100 s)

A narrált változat ma 146,1 s és 97,4 s (a néma becslés ugyanennyi ± 1 s). A bejelentés-videó közel van a 150 s-hoz:
ha a szöveg hosszabb lesz, az `epit.py` előbb enyhén gyorsít (legfeljebb 1,08x), és szól, ha ez sem elég. Akkor ezeket
lehet elsőként rövidíteni vagy elhagyni (a `mond` és a `felirat` együtt), vagy a `kitart` szüneteket csökkenteni:
- bejelentés: „Telephely csak akkor kell, ha…” rövidebben · „Ha valami hibás, szólj a NAV-nak.”;
- meghatalmazás: „Hozzád kötődik, ezért induló vállalkozásnál is jó.” · „A „Képviselt” te vagy, előre kitöltve.”

## Állapot (2026-11-19) – KÉSZ, narrálva

- Mindkét videó a **végleges közös hanggal (Umbriel)** készült el, soronkénti felvétellel és vak ellenőrzéssel:
  bejelentés 148,0 s, 13,72 MB; meghatalmazás 95,3 s, 13,76 MB. A kimenet a `kod/media/`-ban is ott van.
- Vak ellenőrzés: mind az 50 sor rendben (`hang/VAK.md`). Újravett sorok (a jobb take maradt):
  bejelentés b09 (t3), b11 (t2), b21 (t2), b29 (t2), b36 (t2);
  meghatalmazás m01 (t2), m21 (t3), m23 (t2).
  A b09, a b21 és az m23 az automatikus szűrőn átment, de az átiratok gyanúsak voltak („Koppintson”, „alkatát”,
  „koppintsa”), ezért kézzel újravettük őket; az új take-ek mindhárom átirata hibátlan.
- Költés a két videóra összesen 0,2046 USD a 0,30-as keretből (ebből a 11-18-i lektorok 0,0854; a `koltseg.jsonl` szerint).
- Ellenőrizve: `ellenoriz.py` RENDBEN, `teszt.py` OK; kockák 3 másodpercenként (`kockak/vegso_lap_*.jpg`) és jelölésenként
  (`kockak/jel_lap_*.jpg`) megnézve; a felirat minden cue-ja 0,01–0,14 s-mal a beszéd előtt indul; a kész fájl minden
  kockája ép (a köztes fájlhoz mért SSIM legrosszabb értéke 0,99).
- Ami a hanghoz igazodva változott a képben: `kitart` szünetek (a lista utolsó két sora és négy mondat végi jelölés eddig
  nem vagy csak egy villanásra látszott), a „főállás” jelölés 0,4 s-mal korábban, a fejléc haladásjelzőjének hátralévő
  szakaszai a kék palettából (`HALADAS_HATRA`), a szöveg nem változott (`forgatokonyv.json` „megjegyzes_hang_1119”).
- Ha a gép más munkáktól kifogy a memóriából: az ffmpeg-hívások várnak és újrapróbálják (`kozos.futtat`), a kockák
  küldése is újraindul; a hang és az átiratok gyorsítótárban vannak, az újrafuttatás nem kerül pénzbe.
- Újraépítés bármikor: `python C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz/epit.py mind`
  (utána élesítés: `node kod/deploy/videok-json.mjs` + `bash kod/deploy/feltolt.sh --media`; ha útmutató-kép is változott,
  előtte `node kod/app/scripts/utmutato-kepek.mjs`).

## 1. javító kör a független ellenőrzés után (2026-11-19 reggel)

A fenti „Állapot” a reggeli (06:30-as) kiadást írja le; az ellenőrzés hibalistája után ez változott. A régi eszközök,
forgatókönyvek és kimenetek: `_regi/eszkoz_elotte_javitas_20261119_0700/`, `_regi/forgatokonyv_elotte_javitas_20261119_0700.json`,
`_regi/kimenet_*`, `../meghatalmazas/_regi/…`.

- **Kész fájlok:** bejelentés 146,1 s, 13,89 MB; meghatalmazás 97,4 s, 13,82 MB. Mindkettő BT.709 címkékkel (a sáv
  #1428DB/#1428DC-nek dekódolódik – eddig a böngésző #0F31E4-et festett), -16,3 LUFS, a csúcs -2,2 dBTP a kész fájlban
  (eddig -0,6 / -1,2 dBTP volt, a -1,5-ös cél fölött).
- **Kattanások:** a sorok eleji kattanás / pattanás levágva (bejelentés: b09, b28, b36 és az üres felvezetés a b12, b22,
  b24, b34, b38 sorban; meghatalmazás: m08, m16, m21, m14). A kész fájlokban egyetlen sor előtt sincs hang a beszéd előtt;
  a felirat mindenhol 0,05–0,15 s-mal jár a hang előtt (eddig a kattanós soroknál 0,22–0,42 s).
- **Új felvétel csak két sorra** (a vak ellenőrzés a vágás utáni újraméréskor hibát talált): b21 (t4 – a t2-ben
  „kottát”-ot hallott két átirat a „katát” helyett) és m04 (t2 – „Nézd meg” a „Nyisd meg” helyett). Mind az 50 sor rendben.
- **Kép – bejelentés:** az Ellenőrzés táblázata a „Vissza” jelölésnél is egészben látszik (igen/nem oszlop, „Tovább” gomb);
  „Csak ha van más is” 1,7 s, a második „Hagyd üresen” 1,3 s, „Vissza, ha javítanál” 1,7 s (eddig 0,8–0,9 s); a
  „Mire alapozod a székhelyet” megjegyzése két sorban, az oszlopon belül. A néma kitartások: 1,9 s (lista), 1,55 s
  (ellenőrzés, eddig 1,8 s), 1,5 s (tevékenységek).
- **Kép – meghatalmazás:** lásd `../meghatalmazas/README.md` (jelölések ideje, újrajelölt NAV-képek, szorosabb nézetek).
- **Ellenőrizve:** `ellenoriz.py mind` RENDBEN (színcímkék, a címkép kékje, hangosság, csúcs is), `teszt.py` OK (960),
  `felirat_szinkron.py` 0 eltérés, `minoseg.py` SSIM legrosszabb 0,989; a kész hangsávok egy-egy vak átirata (a szöveg
  megmutatása nélkül) minden várt szót sorrendben tartalmaz, terméknév / könyvelőnév / MI nélkül; kockák 2 másodpercenként
  megnézve.
- **Költés:** a két útmutató-videó 0,2798 USD a 0,30-as keretből; a három videó együtt 0,5474 USD a 0,60-ból
  (a javító kör: 0,0273 USD – ebből 2 új felvétel + a vágott sorok vak újraellenőrzése + a két végső átirat az
  útmutatóknál 0,0202, és az L05 két próbafelvétele a fő videónál 0,0070; a fő videó nem változott).

## 2. javító kör a független ellenőrzés után (2026-11-19 délelőtt) – a MOSTANI állapot

Az 1. javító kör leírása fent van; a 2. ellenőrzés hibalistája után ez változott. A régi eszközök, forgatókönyvek és
kimenetek: `_regi/eszkoz_elotte_r2_20261119_r2/`, `_regi/forgatokonyv_elotte_r2_20261119_r2.json`, `_regi/kimenet_*`,
`../meghatalmazas/_regi/…`.

- **Kész fájlok:** bejelentés 146,5 s, 13,95 MB; meghatalmazás 97,3 s, 14,08 MB. Hang: mono,
  csatornánként -16,3 / -16,3 LUFS, a kész fájl csúcsa -2,1 / -2,2 dBTP; a bekötés-videó
  -16,3 LUFS (1 csatorna) – a három videó egyforma hangos.
- **Hangerő-mérce (közös):** `../hang_ellenorzes.py`. Az `ellenoriz.py` és a bekötés-videó `teszt.py`-ja ugyanazt méri:
  mono hangsáv, CSATORNÁNKÉNTI hangosság -16 ± 0,7 LUFS, valódi csúcs ≤ -1,5 dBTP, és a három kész videó legfeljebb
  1 LU-val tér el egymástól. (A bekötés-videó sztereó volt: a fájl egészére mért LUFS egyezett, csatornánként 3 dB-lel
  halkabb volt.) Önállóan: `python ../hang_ellenorzes.py`.
- **Kattanások:** a `hang.py` a sor elején álló rövid (≤ 15 ms), a beszédtől ≥ 30 ms csenddel elválasztott pattanást
  akkor is levágja, ha 0,1 s-nál közelebb van a hanghoz – de csak ha a sor NEM zárhanggal kezdődik (`eleje_elemzes`;
  a k / p / t pattanása a szó része marad). Ilyenkor a 60 ms-os ráhagyást is kinémítja. Így tűnt el a b11 előtti kattanás
  (85 ms-mal a hang előtt), és ugyanez a b12, b25, b28, b29, b33, m03 elején. A soron BELÜLI kattanás kézi:
  `python eszkoz/kattanas.py <nev> <sor> <t0> <t1>` (a b26-ban a „vagy” előtti impulzus, 5,436–5,462 s; a jelöltek
  listája: `kattanas.py <nev> --keres`). Az eredeti felvételek: `hang/_regi/eleje_elott_*`, `hang/_regi/kattanas_elott_*`.
  Az átírt sorok vak ellenőrzése újra lefutott: mind rendben. Új felvétel nem készült.
- **Felirat:** a tördelés közös modulja a `../felirat_tores.py` (mindhárom videó): a sor és a cue ott törik, ahol a mondat
  tagolódik (írásjel, tagmondat, névelő előtt), nem a kiegyensúlyozott sorhossz szerint; ige + igekötő / simulószó
  („jelented be”, „töltsd le”, „ne jelöld”, „nyilvántartást is”), névelő + szó, szám + szó soha nem válik el, és nem
  marad árva szó. Kézi tördelés, ahol a szószerkezet határát a szabály nem látja: `"felirat_sorok": [[sor, sor], [sor]]`
  a sorban (most: b22). Egy írásmód: áfamentes / áfamentesség (b25, b29 és az „Adózási adatok – áfa” cím; a `mond`
  nem változott).
- **Kép – a nézet széle:** a `render.szel_igazit` a kamera célállapotát a kép tartalmához igazítja: a felső és az alsó
  szél olyan sávba kerül, ahol csak a lap háttere van (két sor / két kártya közé), ha kell, pár százalék nagyítás-
  változással; a jelölést sem vágja félbe. Kikapcsolás jelölésenként: `"szel_igazit": false`. Kézzel megadott nézet:
  b11 (a tájékoztató sortól a gombokig), b27 (mind a négy kártya a gombokkal).
- **Kép – b19:** a négy választógomb kiemelése egy álló nézetben vált (a teljes kártya a gombokkal, a kártya két
  oldalán levegővel); a változat a jelölésével EGYÜTT úszik be (`"atusztat": true`), így mindegyik kiemelés a
  következőig látszik (0,9–1,3 s), az utolsó 0,7 s kitartással.
- **Új jel-kapcsolók a `forgatokonyv.json`-ban:** `"atusztat"` (fent), `"all": true` (a nyugvó kamera nem közelít
  lassan rá – ha a nézet széle szavak / mezők közti keskeny résben áll), `"pirula": "…"` (a jelölés feliratának
  felülírása csak a videóban), `"pirula_elotte": "…"` a sorban (szám nélküli pirula a kép első jelölése előtt),
  `"szel_igazit": false`. A `"csak_ez"` váltás mostantól átúszik (nem egy kockán tűnnek el a korábbi jelölések).
- **Meghatalmazás:** lásd `../meghatalmazas/README.md`.
- **Ellenőrizve:** `ellenoriz.py mind` RENDBEN, `teszt.py` OK, `felirat_szinkron.py`, `minoseg.py`; jelölésenként és
  2 másodpercenként kockák megnézve.
- **Költés:** a két útmutató-videó 0,2946 USD a 0,30-as keretből (ebben a körben csak a 8 átírt sor vak
  újraellenőrzése: 24 átirat, 0,0054 USD); a bekötés-videó 0,2748 USD (ebben a körben az L05 új felvétele + 2 vak
  átirata: 0,0032 USD); a három videó együtt 0,5694 USD a 0,60-ból.

## Tulaj-kérések 11-19 délután (1., 3., 4., 5. kérés) – a MOSTANI állapot, élesben 14:18 óta

A régi forgatókönyvek, eszközök, README-k: `_regi/forgatokonyv_elotte_20261119_tulaj1119.json`,
`_regi/eszkoz_elotte_20261119_tulaj1119/`, `_regi/README_elotte_20261119_tulaj1119.md` (a meghatalmazásé a `../meghatalmazas/_regi/`-ben).

- **Valódi NAV-képek (1. kérés):** a 02, 03, 04, 11, 13, 14 kép a NAV „Megújul az Ügysegéd” kisfilmjéből vett valódi
  képernyő lett (`utmutato_kepek/README.md`); a videó most ezekkel készült. A rajzra hangolt kézi nézetek (b11, b32, b33)
  kikerültek, a kamera a jelölésekből számol.
- **Szöveg (csak ahol kellett):** b04 „…és **anyukád** születési neve” (4. kérés); b11 + b12 egy mondat: „A NAV tölti ki az
  adataidat: nézd át őket, és ha valami hibás, szólj a NAV-nak.” (a valódi lapon nincs TAJ-rovat); b28 „Jelöld be, hogy
  nincs kizáró ok, **és a másik hármat is.**” (a valódi lapon négy nyilatkozat van, 2. jelölés); új b40 „Ha egyedül nem
  megy, a bejelentést és a meghatalmazást is elintézzük helyetted.” (3. kérés). Számla-szöveg (5. kérés) ebben a videóban nem volt.
- **Kiemelés (3. kérés):** a zárókép alján az app kártyája: fehér lap márkakék kerettel, „Ha egyedül nem megy” jelvény,
  „Intézzük helyetted”, 3D `igazolas` ikon (`zaro.helyettunk` a forgatókönyvben, a `"zaro_elem": "helyettunk"` jel hozza be).
- **Igaz címke:** a Készítsd elő listában „Anyukád születési neve” címkéje „A NAV tölti ki” (eddig „Mi nem tároljuk” – nem
  igaz, az azonosításnál a Pmt. miatt elkérjük); a TAJ-sor „Mi nem tároljuk” címkéje marad. Új listaelem-mező: `"cimke"`.
- **Meghatalmazás-videó:** új m26 „Ha egyedül nem megy, megcsináljuk helyetted: te csak jóváhagyod.” + „Megcsináljuk
  helyetted” kártya a záróképen; az m03 („Hozzád kötődik…”) kimaradt, hogy a 100 s-os sávban maradjon.
- **Hossz:** bejelentés 149,6 s (az `epit.py` 1,020x-es enyhe gyorsítással), 13,98 MB; meghatalmazás 98,0 s, 14,06 MB.
  Hang: mono, csatornánként -16,3 / -16,2 LUFS, csúcs -2,2 / -2,0 dBTP (a bekötés-videó -16,4 LUFS): `../hang_ellenorzes.py` RENDBEN.
- **Új felvétel csak az új / átírt sorokra:** b04, b11, b28, b40, m26 – mind első take, mind 3 vak átirata hibátlan.
  Költség: 0,0112 USD (bejelentés 0,0092, meghatalmazás 0,0020; `koltseg.jsonl`).
- **Ellenőrzés:** `ellenoriz.py` RENDBEN, `teszt.py` OK (1433; a hossz-teszt most a valódi, gyorsítás utáni hosszt nézi, ha
  minden sornak van felvétele; a tiltott szavak közé bekerült az „anyád/anyja/édesanyád” és a „NAV-tól jön/jött számla”
  minta); 3 másodpercenkénti kockák (`kockak/vegso_lap_*.jpg`) megnézve.

**11-19 javító kör (16:00 körül, élesben 16:15 óta):**
- **Szöveg:** b04 most „Kell még az adókártyád. Anyukád születési nevét a NAV tölti ki: csak nézd át.” (eddig „…és anyukád
  születési neve”; a TAJ csak a listán, „ha a képernyő kéri”); b36 + a zárókép kártyája „Feltöltöm az értesítést” /
  „NAV-os értesítés” (az app gombjával egyezik). A záró kártya ≥ 2,3 s teljesen látszik, közeli vágással (render.py VEG 3,4,
  ZARO_KEP 2,4). Részletek: `forgatokonyv.json` → `megjegyzes_javito_1119`.
- **Hang:** új felvétel csak a b04 és a b36 (a vak ellenőrzés mindkettőn hibátlan); a bejelentés-videó 0,0245 USD-be került
  ebben a körben (`koltseg.jsonl`, 15:00 utáni sorok), a meghatalmazás-videó m26 újravétele 0,0020 USD.
- **Hossz:** 149,7 s, 14,0 MB.

**11-19 javító kör 2 (este; új hangfelvétel NINCS, 0 USD – `utmutato_kepek/_eszkoz/video_ujra.py`, a meglévő hanggal):**
- **b32:** a „Bejelentés megtétele” gomb jelölése a sor ELEJÉN jelenik meg (eddig a sor végén, 112,8 s-nál), a nézet a
  gombsorra áll (`"szo": "Ha minden"`, `nezet`).
- **Képek:** a 05, 06, 12 rajzolt vázlatról lekerültek a saját, tegező segítő mondataink („Ha a székhelyeden kívül…”,
  „Nem kötelező.”, „Itt ellenőrizheted…”) – a valódi NAV-felületen nincsenek; a képaláírásba kerültek. A 06-os alt szöveg javítva.
- **Hossz:** 149,7 s, 14,0 MB; `ellenoriz.py` RENDBEN. A régi forgatókönyv: `_regi/javito2_1119/forgatokonyv.json`.
