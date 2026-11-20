# kod/landing – az adozz.hu nyitóoldala (SPEC §29.3.6, §31)

Egyetlen statikus oldal: HTML + CSS + **egy saját szkript** (`js/meres.js`), **süti nélkül**, a C kinézetben (kék sáv
rozettával, fehér szakaszok, köztük 10 px-es `#D3DAFC` sáv), mobil először (390 / 320 px), asztalon középre. A Geist betűk az
app `assets/fonts` mappájából, a 3D tárgyak az app `assets/ikon3d` mappájából jönnek; a CSP (`default-src 'self'`,
`script-src 'self'`) mellett is működik, mert nincs inline stílus, inline szkript és külső betöltés.

- **Mérés (SPEC §31, 2026-11-20):** a `meres.json` nyilvános beállításaiból. A `js/meres.js`-t a `build.mjs` állítja elő a
  `meres-sablon.js`-ből és a közös csatornaszabályból (`kod/shared/src/marketing.ts`): a Regisztrálok / Belépés / Visszahívást
  kérek link továbbviszi az `utm_*`-ot, a hivatkozó oldal nevét és az érkezési oldalt (csak a linkben). Ha az
  `umamiWebsiteId` ki van töltve (a `deploy/umami-beallit.sh` írja ki), a saját statisztika-szerverünk szkriptje is az
  oldalra kerül (`/m/script.js`, süti nélkül, kattintás-azonosító és más paraméter nélkül, „Ne kövess” jelzést tiszteletben
  tartva, a láblécben kikapcsolható). A lábléc szövegét a build igazítja („nem követ” csak statisztika nélkül marad).
- **Hirdetési mérés:** a süti-ablak és a Meta/Google betöltő kód (`hirdetes-sablon.js`) csak `"hirdetes": true` esetén kerül
  az oldalba, és akkor is csak a szerver kapcsolójával (`ADS_TRACKING_ENABLED`) fut. Bekapcsolás: `kod/MARKETING.md`.
- **Teszt:** `node --test kod/landing/meres.test.mjs` (jsdom a `kod/panel`-ből; a hirdetési változatot ideiglenes mappába építi).
- **Árak:** soha nincsenek kézzel beírva. A `build.mjs` a `kod/shared` `FEE_DEFAULTS`-ából generálja az `arak.json`-t, és abból
  az oldalt (havidíj, éves zárás, változás bejelentése helyetted, jogállás-változás, szünetelés alatt, magad bejelentve 0 Ft).
- **Cégadatok:** `kod/shared/brand.json` → `provider` (név, székhely, adószám, cégjegyzékszám). Telefonszám nincs.
- **Ügyfélszolgálat:** amíg a `supportEmail` `[CÉGADAT…]` helyőrző, az oldal ezt írja: „Ügyfélszolgálat: az appban, az
  Üzenetek fülön.” [TULAJ/JOGI: az Ekertv. miatt e-mail-cím kell az oldalra, mielőtt valódi ügyfél jön.]
- **Linkek:** Regisztrálok → `https://app.adozz.hu/regisztracio`, Belépés → `…/belepes`, Visszahívást kérek →
  `…/regisztracio?cel=visszahivas`, ÁSZF / Adatkezelés / Sütik → `…/jogi/aszf`, `…/jogi/adatkezeles`, `…/jogi/suti`. Kalkulátor-link csak akkor kerül rá, ha a `/kalkulator` útvonal elkészül (k6 után még nincs).

```bash
node kod/landing/build.mjs     # → kod/landing/dist/ (ezt tölti fel a deploy a /srv/kezjegy/web/landing mappába)
node kod/landing/kepek.mjs     # képek: kod/_qa/k7_landing_{390,320,1280}.png (fej nélküli Chrome)
```

A kiszolgálás (B1, `kod/deploy`): `kezjegy-web` `:8082 { root * /srv/landing }`, a proxy `adozz.hu` → `kezjegy-web:8082`,
`www.adozz.hu` → 301 `https://adozz.hu`.
