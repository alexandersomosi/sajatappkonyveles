# Adózz.hu értékesítő oldal – mozgás és 2. kör: döntések, licencek, átvétel az éles landingba

Dizájnminta, nem élő oldal (a tulaj kérése: „még ne tedd ki”). Utolsó frissítés: 2026-11-20 késő este.
Mappa: `konyvelo_app/dizajn/landing_v2/`. Forrás: `_eszkoz/index.sablon.html` + `stilus.css` + `mozgas.js` → `node _eszkoz/epit.cjs` → `index.html`.

## 1. A 2. kör döntései (a tulaj 11-20-i visszajelzései alapján)

| # | Tulaj kérése | Mi lett |
|---|---|---|
| 1 | Hős: a telefon alatt ne legyen gombsor és felirat, a képek maguktól cserélődjenek | Nincs vezérlő. A képernyők **folyamatosan** váltanak (4 mp, 0,4 mp áttűnés). Megáll, ha egér van rajta, ha fókuszban van (koppintás is fókuszba teszi), ha a fül rejtett vagy a hős nem látszik. Csökkentett mozgásnál állókép (Főoldal). |
| 2 | Hős: nem kell a gépes kép és a színes doboz | Egyetlen telefon, csak árnyékkal és talpárnyékkal. |
| 3 | Valósághű telefon-mockup | Saját rajzolású, valósághű SVG-keret (fémperem, gombok, kamerakivágás), az oldal minden telefonján ugyanaz. Letöltött keret nem jogtiszta (lásd 2. pont). |
| 4 | „Mit kapsz”: AI-hatású dobozok, „Neked ebből”, 3 kis kártya | Mind kikerült. A lépések vonallal tagolt szövegek, szám nélkül. A szakasz végén egy mondat: „Az appot gépen, böngészőből is megnyithatod…” (a gépes app-kép kikerült, mert az ügyfél-app gépen ma a telefonos nézetet mutatja). |
| 5 | Könyvelő-szakasz: AI-hatású idővonal és dobozok | Osztott fej + „Ezt csinálja a könyvelőd egy negyedévben” vonalas lista. Felelősségi mondat: „A könyvelőd munkájáért a Somosi Kft. felel.” |
| 6 | Az egész oldal AI-mentesítése | Kevesebb szín (fehér, halványszürke, egy sötét és egy kék sáv), nincs felcím, ikoncsempe, pasztell, színátmenet. Kétszínű címek egyszínűre. Menüsorrend = oldalsorrend. A vélemény-helyőrző kikerült (a sablonban megjegyzés jelzi a helyét, a GYIK előtt). |
| 7 | (21:50) „Görgetéskor íródjon át a szöveg, a telefonok ne egymás alatt legyenek” | **Ragadós bemutató** gépen és telefonon is: EGY telefon áll, görgetésre lépésenként vált benne a képernyő, a lépés szövege cserélődik. Részletek lent. |

### 3. kör (tulaj, 11-20 23:38): kattintható hős-telefon, gépes nézet mögötte, „Gépen is ugyanez” zárólépés
| # | Tulaj kérése | Mi lett |
|---|---|---|
| 1 | A hős telefonja ne váltson magától; a 4 menüpontot lehessen nyomni | Nincs automatikus váltás. A telefon képernyőjén lévő alsó menü fölött 4 átlátszó, valódi `<button>` (Főoldal, Dosszié, Fotózás, Üzenetek; `aria-label`, `aria-pressed`, látható fókuszkeret, kb. 46x51 px gépen, 44x49 px 390-en). A Fiók fölött nincs gomb (a képen csak kép). Kattintásra 0,25 s-os áttűnés (az új a régi fölé), csökkentett mozgásnál azonnal. Betöltéskor egyszeri koppintás-jel (Dosszié → Fotózás → Üzenetek), mellette „Próbáld ki: kattints/koppints a menüre” felirat nyíllal; az első kattintás után mindkettő eltűnik. JS nélkül: Főoldal áll, gomb és felirat nincs. |
| 2 | A hősbe a telefon MÖGÉ a webes változat | Böngészőablak (saját rajz: sáv, 3 pont, „app.adozz.hu” címsor) hátul, a telefon elöl rálóg, a telefon árnyéka a böngészőre esik. A kettő szinkronban vált (gépen a Fotózás = „Papír beküldése”, a fájlt a gépről választod ki). Gépen a telefon jobbra, a böngésző balra fent, két oldalt kilátszik; telefonon (≤760 px) a telefon nagyobb és középen, a böngésző mögötte fent és két oldalt. A méretek a kompozíció szélességéhez igazodnak (`container-type`, `cqw`). |
| 3 | A görgetősnél az utolsó után: gépen is ugyanez | 8. lépés „Gépen is ugyanez”: a ragadós telefon kisebb lesz (gépen 0,6, telefonon 0,7) és jobbra lent félrehúzódik, mögötte beúszik a böngészőablak a gépes Főoldallal (`.szinpad.gep-mod`, csak transform/opacity). A 2. kör „Az appot gépen, böngészőből is megnyithatod…” mondata ebbe olvadt (nincs kétszer). JS nélkül: szöveg + ugyanez a kompozíció állóképként. |

Mért menüpont-helyek (az app-kép 390x844-es nézetében: `.nav` y 759–844, vízszintes belső margó 6 px, 5 egyforma, 75,6 px széles gomb; `_eszkoz/app_minta/hatarok.json` + `C5_v2/v2.css .nav`): bal = 1,538% + i × 19,385% (Főoldal 1,538%, Dosszié 20,923%, Fotózás 40,308%, Üzenetek 59,692%), szélesség 19,385%, teteje 89,929%, magassága 10,071% (a kép aljáig). A képernyőhöz (`.valto`) viszonyított százalék, így minden méretben a helyén van.

Gépes app-képek (`kepek/app_gep_fooldal|dosszie|feltoltes|uzenetek.webp`, 1600x1000): `_eszkoz/app_minta_gep.py` (a `C5_v2/asztali` A01/A60/A70 MÁSOLATA név és ígéret nélkül, + A64 „Papír beküldése” az A60-ból, a menüben a Fotózás aktív) → `node _eszkoz/app_minta_gep_kep.cjs` (1280x800 @1,25) → `python _eszkoz/kepek_vag.py --gep`. A régi `app_asztali*.webp` (névvel) megmaradt, az oldalon nincs.
Valós funkció: a „Húzd ide a fájlt…” (fogd és vidd) az ügyfél-appban nincs, ezért a gépes képen „Válaszd ki a fájlt a gépedről” áll. **Nyitott (tulaj):** a mai webes ügyfél-app gépen a telefonos elrendezést mutatja középen (`kod/app/src/app/_layout.tsx`, max. 480 pt); az oldalsávos gépes nézet a `C5_v2/asztali` terve. Élesítés előtt vagy meg kell építeni, vagy a böngészőablakba a mai (középre igazított) nézet kerüljön.
Mentés: `_regi/elotte_kor3_20261120_2345/` (sablon, CSS, JS, index, vendor, egyfájlos, a módosított eszközök).

### A ragadós bemutató (#mit-kapsz) működése
- **JS nélkül:** a 7 lépés egymás alatt (szöveg + telefon), a rétegek a végállapotukban. Gépen a szöveg a telefon mellett ragad (CSS `position: sticky`).
- **JS-sel (gépen, ≥981 px):** balra a 7 lépés szövege görög, az aktív lépés címkéje sárga, a többi halványabb (szín, nem átlátszóság: AA-kontraszt). Jobbra a telefon függőlegesen középen ragad, alatta 7 részes haladásjelző.
- **JS-sel (telefonon és tableten, ≤980 px):** a telefon a fejléc alatt áll (a magassághoz igazodik, max. 252 px széles, tableten 340 px), alatta a haladásjelző és az aktív lépés címkéje, címe, szövege. Lépésenként kb. 0,75 képernyőnyi görgetés (a lista elemei 88svh magasak). A szakasz 390x844-en 5632 px (korábban 7274 px), az oldal 18 250 px (korábban 20 202 px).
- **Csökkentett mozgásnál:** ugyanez a ragadós elrendezés, de animáció és áttűnés nélkül; a rétegek a végállapotukban. (Sok iPhone-on be van kapcsolva a „Mozgás csökkentése”, ezért nem a 7 telefonos tartalék jön.)
- **Akadálymentesség:** az eredeti lépésszövegek és képleírások (alt) a helyükön maradnak (telefonon vizuálisan rejtve, képernyőolvasónak olvashatóan); a színpad másolata `aria-hidden`. Ha a képernyőolvasó egy lépésre lép, a böngésző odagörget, és a színpad átvált.
- **Technika:** `mozgas.js` görgetésfigyelő (`requestAnimationFrame`-mel ritkítva), külső könyvtár nélkül. Gépen az a lépés aktív, amelyiken a képernyő közepe áll; telefonon a ragadós szakasz görgetési hossza egyenlően oszlik el a 7 lépés között. Csak transform/opacity animál. A telefon mérete telefonon konténer-lekérdezéssel (`cqh`) igazodik, régi böngészőben `svh`-s tartalék.
- **Rétegek a telefonokon** (legfeljebb két látható réteg képernyőnként): az értesítés tömör fehér, az app saját ikonjával, a státuszsor alatt áll, és csak a fejléc felső sorát takarja (a cím alatta szabadon marad). A kártyák (Félretenni, Keretek) az app saját kártyáinak stílusát kapták, és egy háttérszínű takaró (`.takaro`) fedi, ami alóluk kilógna. Fotózás: a papír a keretben marad, a „Még nincs oldal” helyén „1 oldal”. Számlák: a sárga keret helyett „Új” címke.
- **Mobilmenü:** menüpontra koppintva, Escape-re és kívül koppintva bezárul (a régi változatban nyitva maradt).
- **Utolsó javítás (11-20 éjjel, az ellenőr 4 kozmetikai pontja):**
  1. Telefonon a lépésszöveg egymás után vált: a régi 0,12 s alatt eltűnik, az új csak utána úszik be (0,25 s), így nem csúszik egymásra két cím.
  2. A Félretenni és a Keretek lépés takarója (`.t-felretesz`, `.t-kereset`) az első pillanattól áll (nincs `a-fade`), csak a kártya mozog: nincs kettős szöveg.
  3. A telefon képernyőváltása: az új képernyő a régi fölé úszik be (`z-index: 1`), a régi teljesen látszik, amíg az új be nem ért, és csak utána tűnik el (`transition: opacity 0s .3s`).
  4. Üzenetek: a „Ma” alatti, az írómezőnél félbevágott sort egy takaró végig fedi (`.takaro.m-ma`, JS nélkül és csökkentett mozgásnál is), a beszélgetés a válasszal ér véget.
  Csökkentett mozgásnál a `transition-delay` is 0 (ugrásszerű váltás). Mentés: `_regi/elotte_kor2_utolso_20261120_2320/`.
  A videókészítőben (`_eszkoz/video.cjs`) javítva: a CDP `Animation.setPlaybackRate` a rAF időbélyegét is lassította, ezért a korábbi videókban a számlálók (pl. „Még 3 685 000 Ft”) négyszer lassabban pörögtek, mint az oldalon. Az oldal maga jó volt.

### App-képek (`kepek/app_*.webp`)
A `C5_v2` képernyők MÁSOLATÁBÓL készülnek (`_eszkoz/app_minta.py` → `app_minta_kep.cjs` → `kepek_vag.py`): nincs bennük kitalált név („a könyvelőd” áll), rajzolt arc helyett semleges sziluett, nincs válaszidő-ígéret, „áfa” kisbetűvel. A `C5_v2` eredeti fájljai változatlanok (ott még „Kovács Bence” áll – ha az appot élesítjük, ott is cserélni kell). Az `app_asztali*.webp` képek már nincsenek az oldalon (bennük még a régi név van).

## 2. Licencek
- **Telefonkeret** (`kepek/telefon_keret.svg`): saját rajz, harmadik fél licence nem vonatkozik rá. Miért nem letöltött: az Apple és a Meta készülékképeinek licence nem engedi a kereskedelmi webes használatot/módosítást, a nyílt forrású CSS-keretek (devices.css, Magic UI) laposak. Részletek: `kepek/LICENC_telefon_keret.txt`.
- **Átvett nyílt forrású elemek:** `vendor/LICENCEK.md` (Geist OFL-1.1, Fluent Emoji MIT, Material Icons Apache-2.0), mellette a licencszövegek. A `fontok/Geist_wght.woff` újraszűkítve, a licenc-névbejegyzésekkel; teljes OFL: `fontok/OFL.txt`.
- AI-val generált kép nincs az oldalon.

## 3. Mit kell átvenni az éles landingba (`kod/landing`, k8)
Az éles landing (`kod/landing/build.mjs`) ma **script nélküli** (SPEC §29.3.6: „plain static HTML + CSS, no script”). A mozgáshoz ezt a SPEC-pontot módosítani kell: egyetlen saját, `'self'`-ről kiszolgált `mozgas.js`, követés és süti nélkül – erről a tulaj dönt. Ha nem kell a mozgás, a minta JS nélkül is teljes (lépések egymás alatt).
1. **HTML:** a `_eszkoz/index.sablon.html` szerkezete és szövegei a `build.mjs` sablonjába; az árak továbbra is az `arak.json`-ból (FEE_DEFAULTS), a cégadatok a `kod/shared/brand.json`-ból jöjjenek, ne kézzel.
   A `<!--logo-->`, `<!--pipa-->`, `<!--ikon:…-->` jelölők és a megjegyzés-szűrés logikája: `_eszkoz/epit.cjs`.
2. **CSS:** `stilus.css` egészben (a `--fej` változó a ragadós fejléc magassága; a `.szinpad*`, `.halado`, `.takaro`, `.ert-app`, `.cimke-uj` szabályok a bemutatóhoz kellenek).
3. **JS:** `mozgas.js` változtatás nélkül, `<script src="mozgas.js" defer>`. CSP: `default-src 'self'` elég (a JS csak CSSOM-mal állít `transform`-ot, ez nem inline stílus).
4. **Fájlok:** `kepek/` (app_fooldal, app_dosszie, app_uzenetek, app_fotozas, app_hataridok, app_szamlak, app_kereset, app_uzenetek_chat, app_gep_fooldal, app_gep_dosszie, app_gep_feltoltes, app_gep_uzenetek, telefon_keret.svg, favicon.png, logo*.png), `fontok/` (woff + ttf + OFL.txt), `vendor/` (licencek).
5. **Élesítés előtt:** valódi vélemények csak névvel és írásos engedéllyel (helye: a GYIK előtt); a `Belépés`/`Regisztrálok` linkek célja (`app.adozz.hu/...`) ellenőrzendő; a Gemini telefonszámot hiányolt a fejlécből – ez tulaji döntés, kitalált szám nem kerülhet ki.
6. **Ellenőrzés:** `node _eszkoz/kep.cjs` (CSP, kilógás 1440/1280/768/390, JS-hiba, ragadós bemutató), `node _eszkoz/bemutato_kep.cjs <előtag> 390 844 2` és `… 1440 900 1` (lépésenkénti képek + mérés: a szöveg a képernyőn belül és a telefon alatt van-e).

## 4. Eszközök
- `_eszkoz/epit.cjs` – sablon → `index.html` (a HTML-megjegyzéseket kiveszi).
- `_eszkoz/kep.cjs` – teljes oldalas képek + próbák. `_eszkoz/teljes_kep_stilus.cjs` – csak a teljes oldalas képhez csukja össze a ragadós bemutatót.
- `_eszkoz/tulaj_kep.cjs` – éles (2x) szeletelt képek a tulajnak (`_kepek_tulajnak/kor2/gep_NN.png`, `telefon_NN.png`).
- `_eszkoz/bemutato_kep.cjs` – a ragadós bemutató képei görgetés közben (`gorgetes_*` a tulajnak).
- `_eszkoz/video.cjs telefon` – `_kepek_tulajnak/kor2/mozgas_telefon.mp4` (390x844 @2x); `_eszkoz/video.cjs gep` – `_kepek_tulajnak/kor2/mozgas_gep.mp4` (1440x900, kb. 33 s: hős-váltás + ragadós bemutató + elengedés).
- `_eszkoz/gemini_ai_hatas_3.py` – külső vélemény (OpenRouter, Gemini), eredmény: `_eszkoz/gemini_ai_hatas_3.json`.
- Mentések: `_regi/elotte_kor2_20261120_2050/`, `_regi/elotte_kor2_javito_20261120_2205/`, `_regi/elotte_kor2_ragados_20261120_2215/`, `_regi/elotte_kor2_utolso_20261120_2320/` (a ragadós bemutató előtti sablon, CSS, JS, index, régi woff és szkriptek).
