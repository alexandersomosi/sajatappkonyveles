# Átvett, nyílt forrású elemek a v2 dizájn-alapban (kod/shared/v2)

Utolsó ellenőrzés: 2026-11-21. A licencszövegek változtatás nélkül a `licencek/` mappában vannak (a
`dizajn/landing_v2_proba4/vendor/` 2026-11-20-i letöltéséből másolva). A `sync-v2.mjs` ezt a fájlt és a `licencek/`
mappát is átmásolja a fogyasztókba (`kod/app/src/_shared/v2/`, `kod/panel/src/_shared/v2/`), hogy a licenc a kód mellett legyen.

| Elem | Hol van | Forrás | Licenc | Licencszöveg |
|---|---|---|---|---|
| **Fluent Emoji Flat** – 45 tartalmi ikon (`ikon/emoji-adat.ts`) | az app és a panel minden tartalmi ikonja, csempében és a menükben | https://github.com/microsoft/fluentui-emoji (a `main` ág, 2026-11) – a `dizajn/C5_v2/v2.js` EMOJI térképén át | MIT, © Microsoft Corporation | `licencek/LICENSE_fluentui-emoji_MIT.txt` |
| **Material Icons** – vezérlő-ikonok útvonalai (`ikon/material.ts`: pipa, letolt, csillag, szem, kuld, plusz, vissza, bezar, zaszlo, kereses, gemkapocs, masol, kulso, frissit, szuro, tobb) | gombok, linkek, mezők kezelőelemei | https://github.com/google/material-design-icons (a `master` ág, baseline 24 px) | Apache License 2.0, © Google | `licencek/LICENSE_material-design-icons_Apache-2.0.txt` |
| **Geist** betű | az app (`kod/app/assets/fonts/Geist-W*.ttf`, statikus példányok) és a panel (`@fontsource-variable/geist`) betűje; itt csak a neve szerepel a tokenekben (`betu`) | https://github.com/vercel/geist-font | SIL Open Font License 1.1 | `licencek/LICENSE_geist_OFL-1.1.txt` (és `kod/app/assets/fonts/OFL.txt`) |

## Megjegyzések

- **Fluent Emoji:** a rajzokat nem módosítottuk; csak a viewBoxot toltuk el néhány ikonnál, hogy a rajz a mező közepére
  essen (`ikon/kozepre.ts`), és a `white`/`black` színneveket hexára írtuk (a kép azonos). Az MIT a szerzői jogi és
  engedélyszöveg megtartását kéri – ezt ez a fájl és a `licencek/` mappa teljesíti.
- **Material Icons:** az Apache 2.0 a licenc mellékelését kéri; NOTICE fájl a tárolóban nincs. Az útvonalakat változtatás
  nélkül vettük át.
- **Saját rajzok, nem átvétel:** a `chev`, `chev-le`, `chev-fel`, `chev-bal` nyíl (a v2.js EGYEDI `chev`-je és elforgatottjai).
- **Google „G”** (`GOOGLE_G`): a Google márkajele a „Belépés Google-lel” gombhoz, a Google arculati szabályai szerint
  (színe nem változtatható); nem nyílt forrású átvétel, hanem a Google-belépés kötelező eleme.
- **Logó** (`logo/logo.png`, `logo/logo_feher.png`): a saját felirat-logónk képe. A Poppins 800 betűvel készült
  (SIL OFL 1.1, Indian Type Foundry); a kép nem tartalmazza a betűfájlt, így a betűt sem az app, sem a panel nem
  tölti be. Gyártás: `scripts/logo-kep.cjs`.
- Animációs vagy UI-könyvtárat nem vettünk át: a komponensek (`rn/`, `web/`) saját kódok; az RN-ben a már meglévő
  `react-native-svg` (MIT) rajzol.
