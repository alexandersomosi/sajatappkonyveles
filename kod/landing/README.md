# kod/landing – az adozz.hu nyitóoldala (SPEC §29.3.6)

Egyetlen statikus oldal: HTML + CSS, **szkript, követés és süti nélkül**, a C kinézetben (kék sáv rozettával, fehér
szakaszok, köztük 10 px-es `#D3DAFC` sáv), mobil először (390 / 320 px), asztalon középre. A Geist betűk az app
`assets/fonts` mappájából, a 3D tárgyak az app `assets/ikon3d` mappájából jönnek; a CSP (`default-src 'self'`, `script-src
'none'`) mellett is működik, mert nincs inline stílus és nincs külső betöltés.

- **Árak:** soha nincsenek kézzel beírva. A `build.mjs` a `kod/shared` `FEE_DEFAULTS`-ából generálja az `arak.json`-t, és abból
  az oldalt (havidíj, éves zárás, változás bejelentése helyetted, jogállás-változás, szünetelés alatt, magad bejelentve 0 Ft).
- **Cégadatok:** `kod/shared/brand.json` → `provider` (név, székhely, adószám, cégjegyzékszám). Telefonszám nincs.
- **Ügyfélszolgálat:** amíg a `supportEmail` `[CÉGADAT…]` helyőrző, az oldal ezt írja: „Ügyfélszolgálat: az appban, az
  Üzenetek fülön.” [TULAJ/JOGI: az Ekertv. miatt e-mail-cím kell az oldalra, mielőtt valódi ügyfél jön.]
- **Linkek:** Regisztrálok → `https://app.adozz.hu/regisztracio`, Belépés → `…/belepes`, ÁSZF / Adatkezelés → `…/jogi/aszf`,
  `…/jogi/adatkezeles`. Kalkulátor-link csak akkor kerül rá, ha a `/kalkulator` útvonal elkészül (k6 után még nincs).

```bash
node kod/landing/build.mjs     # → kod/landing/dist/ (ezt tölti fel a deploy a /srv/kezjegy/web/landing mappába)
node kod/landing/kepek.mjs     # képek: kod/_qa/k7_landing_{390,320,1280}.png (fej nélküli Chrome)
```

A kiszolgálás (B1, `kod/deploy`): `kezjegy-web` `:8082 { root * /srv/landing }`, a proxy `adozz.hu` → `kezjegy-web:8082`,
`www.adozz.hu` → 301 `https://adozz.hu`.
