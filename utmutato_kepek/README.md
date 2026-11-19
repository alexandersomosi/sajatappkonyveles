# utmutato_kepek – jelölt NAV-képek a két önkiszolgáló útmutatóhoz

2026-11-18, tulaj-kérés 9 („NAV screenshotok kellenének jelöléssel”). Az app (SPEC §26.6.4) és a két útmutató-videó innen dolgozik.

## Mi van itt

| Mappa / fájl | Tartalom |
|---|---|
| `vallalkozas_bejelentes/` | 18 kép (14 lépés; a munkavégzés 4, a közösségi adószám 2 változatban) + `index.json`. **7 valódi**: a belépés (01) és a NAV kisfilmjéből a 02, 03, 04, 11, 13, 14 (2026-11-19); a 05–10 és a 12 még **Illusztráció** (lásd `hianyzik.md`). |
| `meghatalmazas/` | 16 kép, **mind valódi NAV-képernyő** + `index.json` |
| `NN_slug.png` / `NN_slug@2x.png` | 1080 px / 2160 px széles, C2-stílus: alapszínű keret, fehér lap, jelölések, alatta számozott magyarázat és forrás |
| `annotate.py` | **egy paranccsal újrajelöl mindent**: `python annotate.py` (Pillow kell; numpy/opencv nem kötelező) |
| `hianyzik.md` | mi rajzolt, mit mutatott meg a NAV kisfilmje, hol kerestünk |
| **`SAJAT_KEPEK.md`** | a tulajnak, telefonon is olvasható: melyik NAV-lapot hogyan fotózza, hová tegye |
| **`sajat_kepek.py`** | **EGY PARANCS** a tulaj képeihez: OCR-es elmosás, jelölés, index, `annotate.py`, app-másolat, videó a meglévő hanggal (lásd a fájl elejét) |
| `sajat/<útmutató>/NN.png` | ide teszi a tulaj a saját képernyőképeit (a gépén marad; a `_sajat/` alá már elmosva kerülnek) |
| `forrasok.md`, `forrasok.json` | minden kép forrása (URL, cím, dátum, oldal/dia), szerzői jogi megjegyzés a jogásznak |
| `_forras/` | a 3 letöltött hivatalos NAV-fájl (nem megbízható adat, semmit nem futtatunk belőle) |
| `_forras2/` | 2026-11-19: a NAV kisfilm kockái (`kisfilm_kockak/`, a beépített böngészőből, 1:1-es csempékből) és a „lépésről lépésre” oldal letöltött fájljai (nem használtuk) |
| `_nyers/` | a felhasznált forrásképek **előre elmosva** + `.json` a jelölendő elemek helyével |
| `_illusztracio/` | a vázlat-képernyők: `kepernyok.py` → `html/`, `node render.mjs` → `png/` (+ elemhelyek `.json`) |
| `_sajat/<útmutató>/` | ide kerülnek a tulaj saját képernyőképei (`<NN>_<slug>.png`) |
| `_eszkoz/` | `kisfilm_nyers.py` + `kisfilm_beepit.py` (a kisfilm-kockák előkészítése és beírása), `ocr.ps1` (Windows OCR, magyar), `ui_szavak.txt` (a NAV-felület szavai az elmosáshoz), `video_ujra.py` (videó a meglévő hanggal, hálózat nélkül), `video_nezet_alap.json` (melyik képre készültek a videó kézi nézetei), `sajat_kepek_proba.py` (végpontig tartó próba a valódi fájlok érintése nélkül), `rogzit.mjs` (nyilvános NAV-oldalak újrafotózása), `kinyer.py` (képek kinyerése a PDF/PPTX-ből), `benyujtas_teljes.py` (a meghatalmazás 14. képének forrása levágott szöveg nélkül – lásd lent), `ikon_teljes.py` (a 14. és 15. kép ikonjának köre levágás nélkül – lásd lent) |
| `_elonezet/` | áttekintő lapok (`attekintes_*.jpg`) és a `--racs` segédképek |
| `_regi/` | minden felülírt kép és index ide kerül (nem törlünk) |

## Jelölések (C2)

- **kék keret** (#1428DB, a márkaszín 11-18 17:50 óta; előtte tintakék #17284A) = erre koppints / ezt válaszd;
- **borostyán keret** = ezt jelöld be / ide írj;
- **szaggatott keret** = hagyd üresen / ne jelöld;
- számozott korong a keret mellett rövid nyíllal; a számok a kép alatti magyarázat soraihoz és az app lépésszövegéhez tartoznak;
- személyes adat (név, adóazonosító, cím, cégnév, érkeztetési szám – a mintaadat is) elmosva; a rajzolt képeken szürke sáv.
- **A keret a tartalom KÖRÜL van, levegővel** (2026-11-19, ellenőrző kör): a keret 12–13 px vastag a @2x képen, ezért a
  `doboz` ne a szöveg széle legyen (úgy a keret rálóg az első betűkre / a felső sorra – ez történt a meghatalmazás 10–14.
  képén), hanem a tartalom széle + kb. 8 px levegő + a keret vastagsága; ilyenkor `"parna": 0`, a `doboz` a keret
  KÜLSŐ széle. Ha a forráskép széléig ér a tartalom, előbb `bovites` (fehér sáv) kell – a `doboz` negatív is lehet.
- **A meghatalmazás 14. képe** („Meghatalmazás benyújtása!”): a NAV saját ábrája a bal szélén levágva szerepel a
  segédletben (a „Ha folytatja, …” sor H betűje félig), szélesebb forrás nincs. A `_eszkoz/benyujtas_teljes.py` fehér
  sávot tesz a két szélére, és a H hiányzó szárát (3 képpontoszlop) ugyanennek a segédletnek egy másik ábrájából
  pótolja, ahol ugyanez a sor képpontra azonos rajzolattal teljes (`_nyers/…/o03_benyujtas_teljes.png` + `.json`).
  A párbeszédablak tartalma nem változik.

- **A meghatalmazás 14. és 15. képének ikonja** (2026-11-19, 2. ellenőrző kör): a NAV-segédlet két ábrája FELÜL is
  levágva szerepel – a figyelmeztető háromszög, illetve a pipa köré rajzolt kör teteje hiányzott (7, illetve 26
  képpontsor), a kör „le volt nyírva” a lap szélénél. A `_eszkoz/ikon_teljes.py` fehér sávot tesz a kép tetejére, és a
  hiányzó körívet a kör SAJÁT alsó ívének tükrözésével pótolja (csak a körvonal sávját; a kör belseje, a szöveg és a gombok
  változatlanok; ellenőrzi, hogy a még látható felső ív képpontra a tükörképe az alsónak – különben megáll). Kimenet:
  `_nyers/…/o03_benyujtas_ikonnal.png`, `o03_sikeres_ikonnal.png` (+ `.json`, a helyek a sávval lejjebb). Sorrend, ha a
  forrás változna: `python _eszkoz/benyujtas_teljes.py` → `python _eszkoz/ikon_teljes.py` → `python annotate.py meghatalmazas 14`
  (és `15`).
- **Ugyanebben a körben újrajelölve** (az `index.json` „megjegyzes_r2_1119” mezői): 03 – az 1. jelölés korongja a keret
  FÖLÖTT van (`"szam_hely": "fent"`, felül 64 képpont fehér sáv), eddig a „Hátralévő idő” feliratot takarta; 05 és 06 – az
  1. jelölés kerete a sor bal részét (a feliratot), nem a teljes szélességű sort fogja körbe, így a videó ráközelített
  nézetében a keret egészben látszik, és nem fut ki a kép szélén.

## index.json (az app normalizálójának)

```
lepesek[]: sorszam, slug, lepes_kulcs (= kod/shared GUIDE_STEP_KEYS), resz (1, 2, 3 – egy lépéskulcshoz több kép, sorban),
           valtozat (null, vagy {"mezo": "workKind"|"euPartner", "ertek": …} – csak az adott válasznál mutasd; euPartner 'nem_tudom' → 'nem'),
           kepernyo, mit_csinalj, mezok[] {mezo, mit, ertek}, felirat (rövid képaláírás), alt, tipus ('valodi'|'illusztracio'),
           forras {id, cim, url, datum, oldal, fajta}, forras_rovid (a kép alján is ez áll),
           alap {kep, vagas, bovites, kitoltes, jel_meret, homalyos, takar, piros_ki}, jelolesek[] {n, doboz, stilus, cimke},
           sajat {kep, vagas, homalyos, jelolesek} (a tulaj képéhez),
           kimenet {fajl, fajl_2x, szel, mag, szel_2x, mag_2x, tipus, forras_hasznalt, jelolesek_kimeneten[] {n, stilus, cimke, doboz, korong}}
kep_nelkuli_lepes_kulcsok: a kép nélküli lépések (saját app-képernyő, kamarai regisztráció)
```

A normalizáló a **`kimenet.tipus`**-t használja (saját képnél `valodi` lesz), a `kimenet.fajl`/`fajl_2x`-et és a `felirat`/`alt`/`forras` mezőket.
A `jelolesek_kimeneten` 0–1 arányú koordináta a kész képen (a videó ide közelít, ide hozza be a jelölést).

## Parancsok

```
python annotate.py                         # minden kép újra (régiek a _regi/-be)
python annotate.py meghatalmazas 09        # egy kép
python annotate.py --racs vallalkozas_bejelentes 05   # koordináta-rács a forrásképre
python annotate.py --elonezet              # áttekintő lapok
python sajat_kepek.py                      # a tulaj saját képei: sajat/<útmutató>/NN.png -> minden (SAJAT_KEPEK.md)
python _eszkoz/sajat_kepek_proba.py        # a fenti végpontig, ideiglenes mappában, kitalált adatokkal
python _eszkoz/video_ujra.py vallalkozas_bejelentes   # csak a videó újra, a meglévő hanggal
cd _illusztracio && python kepernyok.py && node render.mjs   # a vázlatok újrarajzolása (puppeteer-core a kod/panel-ből)
```

## Az app képei telefonra (2026-11-19)

Az app telefonon a `@2x` képet tölti be (2160 px széles). A `kod/media/utmutato/` másolatokat a
`python _eszkoz/media_kicsinyit.py` 256 színű PNG-vé teszi (szemre ugyanaz, kb. harmada akkora: a három útmutató 73 képe
24,1 MB helyett 7,3 MB; a NAV-logó piros-zöldje és a jelölések színe külön palettahelyet kap). Csak akkor cserél, ha a PSNR
≥ 38 dB és a pixelek 99,99 %-ánál a hiba < 64; a forrás (ez a mappa) és a videók képei nem változnak. A normalizáló
(`node kod/app/scripts/utmutato-kepek.mjs`) a forrást másolja vissza, ezért utána **mindig** ezt is futtasd
(a `sajat_kepek.py` már megteszi). Sorrend élesítés előtt:
`node kod/app/scripts/utmutato-kepek.mjs` → `python utmutato_kepek/_eszkoz/media_kicsinyit.py` → `node kod/deploy/videok-json.mjs` →
`bash kod/deploy/feltolt.sh --media`.

**`meghatalmazas_jovahagyas/`** (SPEC §27.3.6, első kör): a belépés és a profil lépés a meghatalmazás-útmutató valódi
képei (01, 02, 03 – ugyanazok a fájlok és jelölések). Az ONYA-értesítés, a „Jóváhagyásra vár” csempe és a Jóváhagyás gomb
lépésének még nincs képe (az app ezeket kép nélkül mutatja); ezekhez az ONYA bemutató 10–11. diája, a segédlet 10. oldala
(a látszó keresztnév elmosásával) és a tulaj vagy Bence saját, elmosott képernyőképe kell.
