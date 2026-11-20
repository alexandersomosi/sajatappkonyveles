# Átvett, nyílt forrású elemek az Adózz.hu értékesítő oldalán (landing_v2)

Utolsó ellenőrzés: 2026-11-20. Minden fájl a saját szerverünkről megy ki (CSP `default-src 'self'`), CDN és külső kérés nincs.
A licencszövegeket 2026-11-20-án töltöttük le a forrástárolóból (HTTP 200), változtatás nélkül; ebben a mappában vannak.

| Elem | Hol van az oldalon | Forrás | Licenc | Verzió | Licencszöveg |
|---|---|---|---|---|---|
| **Geist** betű (változtatható, latin + magyar betűkre szűkítve) | `fontok/Geist_wght.woff` (+ tartalék `Geist_wght.ttf`), az egész oldal betűje | https://github.com/vercel/geist-font | SIL Open Font License 1.1 | 1.800 (a betűfájl 5. névbejegyzése) | `fontok/OFL.txt`, `vendor/LICENSE_geist_OFL-1.1.txt` |
| **Fluent Emoji Flat** ikonok (irat, naptár, pipa-kör, irat-tollal) | a „Mit kapsz” telefonjainak rétegeiben, beégetett SVG-ként (`_eszkoz/epit.cjs` a `C5_v2/v2.js`-ből) | https://github.com/microsoft/fluentui-emoji | MIT | a `main` ág, 2026-11 | `vendor/LICENSE_fluentui-emoji_MIT.txt` |
| **Material Icons** „person” útvonal (semleges sziluett) | csak az app-KÉPEKEN (`kepek/app_*.webp`), a „Kovács Bence” arc helyén; az app kezelőelemei is ebből a készletből valók | https://github.com/google/material-design-icons | Apache License 2.0 | a `master` ág, 2026-11 | `vendor/LICENSE_material-design-icons_Apache-2.0.txt` |

## Megjegyzések

- **Geist:** a szűkített `Geist_wght.woff`-ot 2026-11-20-án újra elkészítettük a `Geist_wght.ttf`-ből
  (`python -m fontTools.subset … --layout-features='*' --name-IDs='*' --flavor=woff`), így a licenc-névbejegyzések
  (13: licencleírás, 14: licenc URL) benne maradtak. A betűkészlet (330 karakter) és a betűtulajdonságok nem változtak.
  Az OFL szerint a betű szabadon használható és beágyazható weboldalon; önmagában nem adható el, és a „Geist” név
  módosított változatra csak engedéllyel tehető. A szűkítés nem nevezi át a betűt, ez az OFL szerint megengedett
  felhasználás (a betűt nem terjesztjük önálló termékként).
- **Fluent Emoji:** az MIT licenc a szerzői jogi és engedélyszöveg megtartását kéri; ez a fájl és a `vendor/` mappa ezt teljesíti.
- **Material Icons:** az Apache 2.0 a licenc mellékelését kéri; NOTICE fájl a tárolóban nincs.
- **Telefonkeret** (`kepek/telefon_keret.svg`): saját rajz, nem nyílt forrású átvétel. Eredet és indoklás: `kepek/LICENC_telefon_keret.txt`.
- **App-képek** (`kepek/app_*.webp`): a saját app-dizájnunk (C5_v2) képernyőképei, bemutató adatokkal. AI-val generált kép nincs.
- Animációs vagy CSS-könyvtárat nem vettünk át: a `stilus.css` és a `mozgas.js` kézzel írt, saját kód.
