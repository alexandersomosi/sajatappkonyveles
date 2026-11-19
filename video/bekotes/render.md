# Bekötés-videó – újragyártás egy paranccsal

A bekötési oldal tetején futó bemutató videó (SPEC §26.7, tulaj 5. és 6. kérése). 1080×1920, 30 fps, H.264 High + AAC,
`+faststart`, beégetett felirat + WebVTT. Terméknév és könyvelőnév nem hangzik el, és 2026-11-19 óta a KÉPEN sincs
terméknév (a nyitó- és a záróképről és a poszterről kikerült a szóvédjegy – tulaj 6. kérése); a `kod/shared/brand.json`-ból
csak a havidíj jön.

## Egy parancs

```
cd C:/Users/UpgradePC/konyvelo_app/video/bekotes
python eszkoz/minden.py
```

1. `eszkoz/hang_lepes.py` – hang: soronként Gemini 3.8 Flash TTS az OpenRouteren (`../hang.json` hangja és stílusa),
   minden sor 2 vak átírással ellenőrizve, csak a hibás sor kap új felvételt (max. 2), majd tervezett szünetekkel
   összerakva → `hang/narracio.wav` (MONO, −16 LUFS: kétmenetes loudnorm + csúcshatároló −2,6 dBTP-n, ebur128-cal
   visszamérve, ±0,3 LU-n belül; a mért érték az `idozites.json` `lufs` / `csucs_dbtp` mezőjében) + `hang/idozites.json` +
   `hang/kiejtes.json`. A sorok eleji vágás a
   felvétel-eleji kattanást eldobja (ha 0,2 s-nál messzebb van a beszédtől), a zárhang kezdetét megtartja. Minden felvétel a
   `hang/cache/`-ben marad, újrafuttatáskor csak az új vagy módosított sor kerül pénzbe. Ha 110 s fölé menne, legfeljebb
   1,06-os tempóval igazít. **Ha az OpenRouter elutasít (402) vagy elfogy a 0,30 USD-s keret**, becsült időzítéssel néma
   előzetest készít, és 3-as kóddal lép ki.
2. `eszkoz/render.py` – kép: `remotion/src/adat.json` az időzítésből, a jóváhagyott C2-elemek (3D ikonok, rajzolt
   avatar, tárgyképek, Geist, guilloche-rozetta) a `remotion/public/`-ba, Remotion-render, ffmpeg-kódolás (a CRF addig nő,
   amíg ≤ 14 MB; a hangsáv MONO, mint a két útmutató-videóé), a KÉSZ fájl hangjának visszamérése (ha a valódi csúcs
   −1,5 dBTP fölött lenne, lejjebb vett plafonnal csak a hangsávot cseréli), poszter (≤ 300 KB), VTT, 3 másodpercenként
   egy kocka a `kockak/`-ba áttekintő lapokkal, végül a három fájl másolata a `kod/media/`-ba (SPEC §26.7.1). Az előző
   kimenet a `_regi/kimenet_<idő>/` mappába kerül (nem törlünk).
   A kódolás BT.709, korlátozott tartomány, teljes címkézéssel és pontos kerekítéssel (a sáv #1428DB-nek dekódolódik);
   a `kockak/` JPEG-jei BT.601-re átszámolva készülnek, így a színük a videóéval egyezik.
3. `eszkoz/teszt.py` – ellenőrzés (tiltott szavak, feliratsorok hossza, formátum, méret, faststart, VTT, másolatok;
   a VTT ideje = `hang/idozites.json`, a fejlécsáv színe #1428DB; hang: mono, CSATORNÁNKÉNT −16 ± 0,5 LUFS, a valódi
   csúcs ≤ −1,5 dBTP, és a három kész videó csatornánként legfeljebb 1 LU-val tér el – `../hang_ellenorzes.py`; a VTT
   sortörése nem választ el igét az igekötőjétől – `../felirat_tores.py`).

Csak a kép: `python eszkoz/render.py` (gyors próba fél felbontásban: `--gyors`; másolás nélkül: `--nincs-masolas`).
Csak a WebVTT újra (a tördelési szabályok változása után, kép és hang nélkül): `python eszkoz/render.py --csak-vtt`.
Néma előzetes API-hívás nélkül: `python eszkoz/minden.py --becsult`.
Remotion Studio: `cd remotion && npm run studio`. Típusellenőrzés: `cd remotion && npm run typecheck`.

## Mit hol kell átírni

| Változás | Hol | Utána |
|---|---|---|
| Szöveg | `szoveg/sorok.json` (`szoveg` = felirat, a `|` feliratváltás; `tts` = kimondott alak, ha eltér, pl. számok betűvel) | `python eszkoz/biralat.py <kör>` (két független bíráló, ~0,01 USD), majd `minden.py` |
| Havidíj | `kod/shared/brand.json` | `python eszkoz/render.py` (a hang nem mondja ki; terméknév a videóban nincs) |
| Díjkezdés új vállalkozásnál `azonnal`-ra (SPEC §26.1.7) | `sorok.json` L11 3. része + `remotion/src/Bekotes.tsx` `LepesSzerzodes` borostyán doboza | `minden.py` (csak L11 kerül pénzbe) |
| Közös hang | `../hang.json` (mind a három videóé!) | `python eszkoz/minta.py --hang-json`, majd `minden.py` |
| A könyvelő rajzolt avatarja | `eszkoz/render.py` → `karakter_1_lapos_nagy.png` | `render.py` |
| Jelenetek kinézete | `remotion/src/Bekotes.tsx`, közös elemek: `remotion/src/elemek.tsx`, poszter: `remotion/src/Poszter.tsx` | `render.py` |

## Fájlok

- `bekotes.mp4`, `bekotes_poszter.jpg`, `bekotes.vtt` – a kimenet (másolata: `kod/media/`)
- `szoveg/sorok.json` – a végleges szöveg és a bírálati döntések (`biralat`); `szoveg/biralat_1..4.json` – a bírálatok;
  `szoveg/sorok_v1..v5.json` – a korábbi változatok
- `hang/` – minták, felvételek, időzítés, kiejtés-jelentés; `koltseg.jsonl` – minden fizetős hívás a költségével
- `kockak/attekinto_*.jpg` – az utolsó render kockái (a korábbiak a `kockak/_regi/`-ben)

## Költség

Kulcs: `OPENROUTER_API_KEY` (HKCU\Environment, csak a folyamaton belül olvassuk, soha nem írjuk ki). Keret: 0,30 USD
(`BEKOTES_HANG_KERET` környezeti változóval állítható). Becslés a teljes hangra: ~0,03 USD TTS + ~0,03 USD vak átírás.

## 2. ellenőrző kör (2026-11-19 délelőtt) – a MOSTANI állapot

- **Hangerő:** a videó eddig sztereó volt (a mono narráció az ffmpeg alapértelmezett −3 dB-es felkeverésével), a két
  útmutató mono. A fájl egészére mért hangosság egyezett (−16,2 / −16,3 LUFS), ezért a tesztek átmentek – csatornánként
  (amit a telefon lejátszik) viszont ez a videó 3 dB-lel halkabb volt (−19,2 LUFS). Most mindhárom mono, csatornánként
  −16,3 LUFS, a kész fájl csúcsa −2,1 dBTP (a keverés plafonja −2,6 dBTP, mint az útmutatóknál). A `teszt.py` és az
  útmutatók `ellenoriz.py`-ja ugyanazt a közös mércét használja (`../hang_ellenorzes.py`: csatornaszám, csatornánkénti
  LUFS, csúcs, és a három videó egymáshoz mérve), így az eltérés nem térhet vissza észrevétlenül.
- **L05:** a sor vége „…mikorra és hova **kell fizetned**.” (eddig „…hova fizess.”, amelynek utolsó szótagját a vak
  átiratok fele „fizetsz”-nek hallotta, két újravétel után is). Az új felvétel első take-je: mindkét vak átirat
  „…hova kell fizetned.” (0,0032 USD). A tartalom nem változott. **Ha a tulaj a régi szöveget kéri vissza:** a
  `szoveg/sorok_v6.json` L05 sorát vissza kell írni a `sorok.json`-ba, majd `python eszkoz/minden.py` (a régi felvétel a
  gyorsítótárban van, nem kerül pénzbe).
- **Egy írásmód:** az „A NAV űrlapján” kártyán „Alanyi áfamentesség” (eddig „Alanyi ÁFA-mentesség”), ahogy az útmutató-
  videók feliratában is (áfamentes / áfamentesség). Megjegyzés: az app saját szövegei továbbra is „ÁFA-mentes”-t írnak.
- **Felirat:** a VTT sorai a mondat tagolása szerint törnek (`../felirat_tores.py`: „Köszönjük, hogy telepítetted /
  az alkalmazásunkat!”, „Ha még nincs vállalkozásod, / te magad jelented be”); a beégetett feliratban a tiltott
  töréshelyeken nem törhető szóköz áll (ige + igekötő, névelő + szó).
- **Kész fájl:** 98,7 s, 13,2 MB. `teszt.py`: OK (435). A régi kimenet: `_regi/kimenet_elotte_r2_20261119_0900/`, a régi
  eszközök: `_regi/elotte_r2_20261119_r2/`.

## Megjegyzés (2026-11-19, 1. ellenőrző kör – a fenti 2. kör megoldotta): L05 „…mikorra és hova fizess.”

A független ellenőrzés szerint az L05 utolsó szótagja félig elnyelt (a vak átiratok egyike „fizetsz”-t írt). Két új
próbafelvétel készült ugyanazzal a hanggal és a „take N, saying every word completely and clearly to its very last sound”
utasítással (`hang/sorok/L05_t2_nyers.wav`, `L05_t3_nyers.wav`, 0,0070 USD a `koltseg.jsonl`-ben): mindkettőnél MINDKÉT
vak átirat „fizetsz”-t hallott, az eredeti (t1) felvételnél csak az egyik. A legjobb tehát továbbra is a t1 – **a videó
nem változott**, nem kellett újrarenderelni. A `hang_lepes.py` újrafuttatva is a t1-et választja (az első hibátlan take).
Ha a tulaj mégis zavarónak hallja: a szöveg átírása segíthet (pl. „…mikorra és hova kell fizetned.”), az egy sor új hangja.

## Tulaj-kérések 11-19 délután (3., 5., 6. kérés) – a MOSTANI állapot, élesben 14:18 óta

- **L04 (5. kérés):** „A kiállított számláid maguktól megjelennek az alkalmazásban – nem kell feltöltened őket.” (eddig „A
  számláid maguktól megérkeznek a NAV-tól.”, amit az ügyfél úgy érthetett, hogy a NAV küld neki számlát). A kártya: „Kiállított
  számlák / Maguktól megjelennek.”; az 5. lépés kártyáján „Utána a kiállított számláid maguktól megjelennek.” (SPEC §27.5).
- **Új L20b (3. kérés):** „Ha egyedül nem megy, a bejelentést és a meghatalmazást is elintézzük helyetted.” A Segítség-jelenetben
  kiemelt kártya, mint az appban: fehér lap márkakék kerettel, „Ha egyedül nem megy” jelvény, „Intézzük helyetted”, „A bejelentést
  és a meghatalmazást is. Te csak jóváhagyod.”, 3D `igazolas` ikon.
- **Szóvédjegy (6. kérés):** a nyitó- és a záróképről és a poszterről kikerült (csak kép, hangköltség nélkül).
- **Kész fájl:** 107,0 s, 11,1 MB, mono, -16,4 LUFS csatornánként, csúcs -2,2 dBTP; `teszt.py` OK (550; új tiltott minták: „anyád”,
  „NAV-tól jön/jött számla”). Új felvétel csak az L04 (1. take) és az L20b (2. take: az 1. take vak átirata üresen jött vissza);
  mindkettő 2 vak átirata hibátlan. Költség: 0,0114 USD (`koltseg.jsonl`). A szöveg előző változata: `szoveg/sorok_v7.json`;
  a régi Remotion-fájlok: `_regi/elotte_20261119_tulaj1119/`.
- **Nyitott (a tulaj dönt):** a videó lépéssorrendje (szerződés + kártya → meghatalmazás → igazolványok → összekötés) még a
  §26-os rendet mutatja; a §27 szerint a kártya (előfizetés) az igazolványok után jön. Ehhez az L11 kettéválasztása és egy
  jelenet áthelyezése kell (két új hangsor, ~0,01 USD).
