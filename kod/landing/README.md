# kod/landing – az adozz.hu nyitóoldala (SPEC §29.3.6, §31)

**2026-11-21 óta a tulaj által jóváhagyott új értékesítő oldal** („Jó lesz így a weboldal, kiteheted”), a
`dizajn/landing_v2_proba4` végleges dizájnja átültetve ide. Egyetlen statikus oldal: HTML + CSS + **két saját szkript**
(`js/meres.js`, `js/mozgas.js`), követő süti nélkül, minden saját forrásból (CSP `default-src 'self'; script-src 'self';
style-src 'self'`): nincs inline stílus, inline szkript, inline eseménykezelő és külső betöltés (a build ellenőrzi).
A régi (C kinézetű) oldal forrása és utolsó dist-je: `_regi/elotte_uj_dizajn_20261121_1005/`.

**ÉLES 2026-11-21 10:48** (csak a landing, `kod/deploy/landing-csere.sh`). Élesítés előtti javítások (régi fájlok:
`_regi/elotte_elesites_javitas_20261121_1041/`): a kiszolgált `stilus.css` és `js/mozgas.js` megjegyzések nélkül megy ki
(`megjegyzes.mjs`; a teszt acornnal nézi, hogy a JS minden tokenje változatlan), a `kepek/LICENC_*.txt` nem kerül a dist-be, a
`vendor/LICENCEK.md` nyilvános változata belső utak és AI-mondat nélkül, és a build a dist MINDEN szöveges fájlját ellenőrzi
(AI-említés, „tulaj”-jegyzet, belső út). Szövegek: fizetés „bankkártyával” (átutalás még nincs, ÁSZF 6.2); iratok: „a könyvelőd
kezeli. Rajta kívül csak a cégünk vezetése férhet hozzájuk, naplózva.”; a bemutató alatti jegy kiegészült (új kinézet, gépen ma
még telefonos elrendezés).

## Fájlok

| Fájl | Mi ez |
|---|---|
| `oldal.sablon.html` | a dizájn sablonja (`dizajn/landing_v2_proba4/_eszkoz/index.sablon.html` másolata) a build jelölőivel: `{{ar:…}}`, `{{ceg:…}}`, `{{email}}`, `{{esemeny:név:hely}}`, `{{meres_lablec}}` stb. A `<!--logo-->`, `<!--pipa-->`, `<!--ikon:név-->` jelölőket és a megjegyzés-szűrést a dizájn `epit.cjs`-éből vettük át (a KOZEPRE ikon-javítással együtt). |
| `stilus.css` | a dizájn CSS-e változatlanul (a 4. kör, 4b, 4e, 4f blokkokkal; 11-21 11:40: 4h – telt kék „Mennyibe kerül?” és „Miben más” Adózz-oszlop, telt zöld „Ki könyvel neked?”), a végén az élő oldal mérés-elemeinek stílusa („Visszahívást kérek”, lábléc mérés-sora, süti-ablak `.hj-*`). |
| `mozgas.js` | a dizájn mozgása változatlanul → `dist/js/mozgas.js` megjegyzések nélkül (mobilmenü, kattintható hős-telefon, ragadós bemutató). Nem kér semmit a hálózatról, nem tárol semmit. |
| `megjegyzes.mjs` | a `stilus.css` és a `mozgas.js` megjegyzés-szűrője a buildhez (sztringet, `url()`-t, regexet nem bánt; kódhoz tapadó megjegyzésnél megáll). |
| `kepek/` | a dizájn képei: app-képernyők bemutató adatokkal (`app_*.webp`, a gépesekből 800w változat is), `telefon_keret.svg` (saját rajz; az eredet-jegyzet `LICENC_telefon_keret.txt` csak itt, a dist-be nem megy), `logo.png`, `logo_feher.png`, `favicon.png`. A régi névvel készült `app_asztali*.webp` NINCS itt. |
| `fontok/` | Geist (OFL-1.1), szűkített woff + teljes ttf. |
| `vendor/` | az átvett nyílt forrású elemek licencei (`LICENCEK.md`). |
| `ikonok.json` | a sablon Fluent Emoji Flat ikonjai (MIT), a `dizajn/C5_v2/v2.js`-ből: `node kod/landing/ikonok.mjs` (csak új ikonnál kell újra). |
| `meres-sablon.js`, `hirdetes-sablon.js`, `meres.json` | SPEC §31 mérés (változatlan). |
| `email/` | a rendszerlevelek és a tulaj aláírásának logói → `dist/email/` (a szerveren nem veszhet el). |

## Mérés és linkek (SPEC §31 – változatlanul átvéve)

- A `js/meres.js`-t a `build.mjs` állítja elő a `meres-sablon.js`-ből és a közös csatornaszabályból
  (`kod/shared/src/marketing.ts`). Minden `https://app.adozz.hu/…` link (Regisztrálok, Belépés, Visszahívást kérek) továbbviszi az
  `utm_*`-ot, a hivatkozó oldal nevét és az érkezési oldalt; a `/jogi/` linkek tiszták maradnak. Ha az `umamiWebsiteId` ki van
  töltve, a `meres.js` maga tölti be a saját statisztika szkriptjét (`/m/script.js`, süti nélkül, szűrővel, DNT).
- Események (`data-kj-esemeny` + `data-kj-hely`, nem `data-umami-event`): `regisztralok` (fejlec, hos, arak, zaro, lab),
  `belepes` (fejlec, menu, lab), `visszahivas` (zaro), `email-iras` (biztonsag, gyik, zaro, lab, impresszum); az árak szakasz
  `id="arak"` („Görgetett az árakig”).
- „Visszahívást kérek” → `https://app.adozz.hu/regisztracio?cel=visszahivas`, a kék záró panelen, az egyetlen engedett
  időígéret alatt: „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.”
- Lábléc: ÁSZF, Adatkezelés, Süti-tájékoztató (`…/jogi/suti`), Impresszum; `#meres-lablec` (statisztikával a jogász
  `meres.lablec` szövege), a látogató kikapcsolója (`#meres-kapcsolo`), hirdetési buildben `#suti-beallitasok`.
- **Hirdetési mérés:** a süti-ablak és a Meta/Google kód csak `"hirdetes": true` esetén kerül az oldalba, és akkor is csak a
  szerver kapcsolójával (`ADS_TRACKING_ENABLED`) fut. Most KI. A „nincs követő süti” mondat (Biztonság rész) csak a hirdetési
  kód nélküli buildben áll; `"hirdetes": true` mellett a build kiveszi. Bekapcsolás: `kod/MARKETING.md`.

## Adatok

- **Árak:** soha nincsenek kézzel beírva. A `build.mjs` a `kod/shared` `FEE_DEFAULTS`-ából generálja az `arak.json`-t
  (havidíj, éves zárás, változás, jogállás-változás, szünetelés, megszüntetés; csak megerősített ár), és abból tölti ki az oldal
  minden árát, az éves összeget is (12 × havidíj + éves zárás).
- **Cégadatok:** `kod/shared/brand.json` → `provider` (név, székhely, adószám, cégjegyzékszám, ügyfélszolgálati e-mail).
- **Gyorsítótár:** a szerver minden landing-fájlt `Cache-Control: no-cache`-sel ad (`deploy/web.Caddyfile`), ezért nincs
  fájlnév-hash: egy új telepítés a következő betöltéskor látszik.

```bash
node kod/landing/build.mjs              # → kod/landing/dist/ (ezt tölti fel a deploy a /srv/kezjegy/web/landing mappába)
node --test kod/landing/meres.test.mjs  # jsdom a kod/panel-ből; a statisztikás és a hirdetési változatot ideiglenes mappába építi
node kod/landing/ikonok.mjs             # csak ha a sablon új ikont kap
```

A kiszolgálás (B1, `kod/deploy`): `kezjegy-web` `:8082 { root * /srv/landing }`, a proxy `adozz.hu` → `kezjegy-web:8082`,
`www.adozz.hu` → 301 `https://adozz.hu`. A landing mappa cseréje után a `kezjegy-web`-et újra kell létrehozni (csak a landingnál: `kod/deploy/landing-csere.sh`, ez
magát a `kezjegy-web`-et hozza újra; teljes telepítésnél az `up.sh`), és a `dist/email/` mappa nem veszhet el.
