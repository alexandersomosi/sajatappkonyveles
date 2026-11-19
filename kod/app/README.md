# kod/app – az ügyfél-app (Expo, Android/iOS + web)

Expo SDK 58 · expo-router · TypeScript · TanStack Query. A jóváhagyott **Kézjegy C2** dizájn szerint
(`dizajn/C2_modern/app_v2`, `TERV.md`, `tokens.css`): Geist (a dizájn változtatható betűjéből példányosított pontos
súlyok), tintakék sáv rozettával, színezett alap fehér lapokkal, a könyvelő levele kézírásos aláírással, csak a
jóváhagyott 3D ikonok (vonalas ikon sehol), rajzolt könyvelő-karakter, szemből nézett tárgyképek.
A termék neve egyetlen helyről jön: `kod/shared/brand.json` → `src/_shared/brand.json` (`npm run shared`).

## Futtatás

```bash
npm install                     # egyszer
npm run web                     # fejlesztői szerver böngészőben (a valódi API-t hívja: EXPO_PUBLIC_API_URL)
npm start                       # Expo dev szerver telefonhoz (natív modulokhoz fejlesztői build kell, lásd lent)

npm run export:web              # éles webes build → dist/ (ugyanazon a hoston hív: /api/v1)
npm run export:minta            # MINTA build → dist-minta/ (beépített kitalált adatok, szerver nélkül)
npm run kiszolgalo              # dist-minta kiszolgálása: http://127.0.0.1:8790/?minta=kata
npm run kepek                   # képernyőképek a dist-minta-ról → _kepek/ (fej nélküli Chrome, 390×844 @2x)

npm run typecheck               # tsc --noEmit
npm test                        # node:test – formázók, ellenőrzők (adószám, adóazonosító, dátumok, toldalékok)
npm run eszkozok                # képelemek újragenerálása a dizájnmappából (+ python scripts/fontok.py)
```

MINTA forgatókönyvek (csak `export:minta` buildben): `?minta=kata` (alap, becslés 2026-11-17),
`fizetendo` (03: jóváhagyott III. negyedév, október 9.), `befizetve` (08 állapot), `ures` (11: üres novemberi dosszié),
`peter` (02: bekötés folyamatban), `uj` (frissen regisztrált), `kint` (kilépve). A MINTA módot minden képernyőn
„MINTA” címke jelzi; a szerver DEMO módját (`/config.demo`) „DEMO” címke.

## Környezeti változók (build-idő)

| Változó | Mire | Alap |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | API alapcím | web: `/api/v1` · natív: `https://api.45-94-65-74.sslip.io/api/v1` |
| `EXPO_PUBLIC_API_MODE` | `minta` = beépített mintaadatok | üres |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | natív Google-belépés [OWNER] | üres → a gomb csak akkor látszik, ha a szerver `/config` szerint be van kapcsolva |
| `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` | a Google config plugin iOS URL-sémája (`com.googleusercontent.apps.…`) | üres → a plugin kimarad |

A Google-/Apple-gomb, a SimplePay éles/sandbox/demo módja és a push mind a szerver `/config`-jából és állapotából
jön; kulcs nélkül az app semmit nem színlel: a gomb rejtve, a fizetés „DEMO FIZETÉS” jelzéssel.

## Natív build (a tulaj teendője)

Natív modulok: dokumentum-szkenner (`react-native-document-scanner-plugin`), megosztás más appból
(`expo-share-intent`), Google-belépés. Ezek Expo Go-ban nem futnak (az app ilyenkor kamerára / fájlválasztásra vált).
Fejlesztői build: `npx expo prebuild` + `npx expo run:android`, vagy EAS (`npx eas-cli@latest build -p android`).
Push: EAS projekt + FCM/APNs kell (`extra.eas.projectId`); addig csak az appon belüli értesítések mennek.

## Felépítés

```
app.config.ts          név a brand.json-ból; séma kezjegy, csomag com.somosi.kezjegy; engedélyek magyarul
src/app/               képernyők (expo-router) – lásd SPEC §17.3
src/api/http.ts        API-kliens: hibák (§3.5), forgó frissítő token (natív: secure-store, web: HttpOnly süti), XHR-feltöltés
src/api/hooks.ts       TanStack Query hookok (§12.4)
src/api/minta/         MINTA-szerver (csak minta buildben töltődik be)
src/auth/              belépés, biometrikus zár (5 perc háttér után), Google/Apple
src/lib/               formázók (hu, Europe/Budapest), ellenőrzők, fájlok (JPEG ≤2400 px, EXIF nélkül), SimplePay, push, megosztás
src/theme/             tokenek (tokens.css → TS), GENERÁLT képjegyzék és útvonalak
src/ui/                közös elemek: sáv, lap, gombok, levél + aláírás, mérő, lépéssor, fülsor + Fotózás-gomb, alsó lap
assets/                3D ikonok, karakter, tárgyképek, rozetta, papír, Geist-súlyok, app-ikon (scripts/eszkozok.mjs)
_kepek/                képernyőképek (MINTA build)
_regi/                 a sablon félretett fájljai (nem törlünk)
```

## Tulaj-kérések 11-18 (SPEC §26)

| Mi | Hol |
|---|---|
| Bekötés = Főoldal a bekötés alatt: fülsor (Főoldal aktív, teendő-jelvény), bemutató videó, „Van már egyéni vállalkozásod?”, minden lépés „Mi ez?”-vel, zárt lépés lakattal és okkal, visszahívás-kártya | `src/app/bekotes/index.tsx` |
| Új vállalkozás (önkiszolgáló): központ + „Készítsd elő” · 5 lapos adatlap (ÖVTJ-kereső, költséghányad- és járulék-tájékoztató, stop-kártya, összefoglaló) · „Mit hova jelölj” útmutató · NAV-os igazolás feltöltése · adószám | `src/app/bekotes/vallalkozas/{index,adatlap,utmutato,feltoltes}.tsx` |
| Útmutató-test (videó, lépéslapok, jelölt NAV-képek nagyítható nézővel, „Megvan”, másolás) | `src/kepernyok/Utmutato.tsx`, `src/ui/KepNezo.tsx`, `src/lib/utmutato.ts` |
| NAV-meghatalmazás útmutatóval (az ONYA-képernyőképekkel); a másik két mód alatta | `src/app/bekotes/meghatalmazas.tsx` |
| Visszahívás (időpontfoglalás helyett): űrlap, állapot, módosítás, lemondás; „Elakadtál? Kérj visszahívást” minden lépésnél | `src/app/visszahivas.tsx`, `src/ui/Visszahivas.tsx`; a régi `bekotes/idopont` átirányít |
| Korlátozott mód: zárolt képernyő/alsó lap („… – hamarosan”, ok, „Mi kell még?”), 403 `locked_until_active` → lap | `src/ui/Zarolt.tsx`, `src/lib/hozzaferes.ts` |
| „Mi ez? / Miért kell? / Hol találod?” alsó lap, „Hol találom?” a mezők alatt (`Mezo hol=`) | `src/ui/Magyarazat.tsx` |
| Videókártya + lejátszó (natív: `expo-video`, web: `<video>` + magyar felirat-sáv); hiányzó fájlnál szöveg | `src/ui/Video.tsx`, `src/ui/VideoLejatszo{,.web}.tsx`, `src/lib/media.ts` |

```bash
node scripts/utmutato-kepek.mjs        # utmutato_kepek/<útmutató>/index.json → kod/media/utmutato/<útmutató>/ + kepek.json
                                       # (újrajelölés után újra; régi képek → kod/media/utmutato/_regi/<idő>/)
npm run export:minta && node scripts/kepek-k3.mjs        # k3_* képernyőképek 390×844 és 360×780 (MINTA; port: PORT=…)
# helyi próba a VALÓDI backenddel (a backend saját dist/-jét nem írja felül):
#   cd ../backend && npx tsc -p tsconfig.json --outDir <mappa>/dist   (+ <mappa>/package.json, drizzle/, node_modules junction)
BACKEND_KOD=<mappa> PORT=8797 node scripts/helyi-proba.mjs        # + a 11-18-as demó kiegészítés (Levente, Anna, Zsófia)
HELYI=1 BASE=http://127.0.0.1:8797 PARHUZAMOS=1 node scripts/kepek-k3.mjs   # k3_h* képek
```

- `/media/` a helyi kiszolgálókon is (a `kod/media` mappából, Range/206, `text/vtt`, hiányzó fájlra sima 404): `scripts/media-kiszolgalo.mjs`; más mappa: `MEDIA_DIR=…`.
- MINTA forgatókönyvek (új): `?minta=uj` (még nem válaszolt az elágazásra), `indul` (új vállalkozás, adatlapnál), `utmutato` (kész az útmutató), `levente` (beküldte, átnézzük; nyitott visszahívás).
- A natív lejátszóhoz új APK kell (`expo-video` config plugin az `app.config.ts`-ben). A külső WebVTT-t az `expo-video` nem tölti be: natívan a beégetett felirat látszik (és a fájlba ágyazott sáv, ha van).
- Tesztek: `npm test` (node:test; a `tests/ts-feloldo.mjs` oldja fel a kiterjesztés nélküli importokat) – tevékenység-kereső, útmutató-helyőrzők, kepek.json, magyarázatok ikonjai, korlátozott mód.

## 1. ellenőrző kör javításai (2026-11-19)

- **Új vállalkozás útja:** „Még nincs, most indítanám” után előbb a rövid „Rólad” lap jön (`/bekotes/adatok?utana=vallalkozas`), mentés után a
  vállalkozás-központ. Ha a „Rólad” hiányzik, a központ gombja és az adatlap is oda visz (`utana=adatlap&utanaLap=N`), mentés után vissza;
  „A lakcímem” csak meglévő lakcímmel választható. A beküldés `adatok` mezőhibájánál gomb: „Megadom az adataimat”.
- **Kétlépcsős belépés:** 403 `reauth_required` → „Mostani jelszó” mező, a `/auth/totp/setup` és `/enable` `currentPassword`-del megy újra.
- **Számlaszámok lap:** részben befizetett negyedévnél csak a hátralévő tételek kapnak másoló gombot; a befizetettek összecsukva,
  „Ezt már befizetted, ne utald el újra”. Másolás: `src/lib/vagolap.ts` (weben saját út; sikertelen írásnál nincs „Kimásoltad”).
- **Főoldal (03):** „3 külön utalás a NAV-nak, 3 számlaszámra” egy sorban; a visszahívás-link a gyorsműveletek alatt; az SZJA sor mellett a
  negyedév neve (a hosszú alcím a harmadik sort is kétsorossá tette). **Bekötés-főoldal:** a sáv kártyáján csak a kapszula; amíg az elágazás
  megválaszolatlan, a videó alacsony kártya (kis kijelzőn egy sor), így mindkét válasz a fülsor fölött van.
- **Videókártya:** fehér lap, bal oldalt a plakát bélyegképe, kék „Lejátszás” kapszula; az egysoros változatban csak a háromszög (korong nélkül).
- **Útmutató:** a kész lépés jele az ibolya pecsét (`KeszJel`), a mezősorok előtt nincs ✓ / ×; képnéző: „Kisebb / Nagyobb” kapszulák.
- **„Hogyan jött ki?”:** kézi módosításnál az adó-sorban áthúzva a számítás, mellette a végleges összeg, alatta a könyvelő indoka.
- Dátum: „november 10-e volt” (`datumE`), „2027. január” (`honapCim`); weben 3×-os kijelzőn nagyobb forrásfájl az ikonokhoz (`Ikon3d`),
  60 pt-os arckép a nagy forrásból; a Fotózás sarokjelei 200 ms alatt ugranak a papírra; a tétel törlése alsó lapon kérdez.
- Ellenőrző szkriptek: `scripts/jav1/` – `harness.mjs` (helyi backend-pillanatkép + app + panel, `BACKEND_KOD=<mappa>`), `app_helyi.mjs`
  (30 ellenőrzés a valódi backenddel), `app_minta.mjs` (MINTA képek méréssel), `eles_nyilvanos.mjs` (éles, csak nyilvános oldalak).
  Képek: `_kepek/jav1_*`.
- **Natív app:** ezek a javítások a webes buildben élnek; a telefonos apphoz új APK kell (a `apk/Kezjegy-1.0.4-test.apk` még a régi).

## Tulaj-kérések 11-19 (SPEC §27)

| Mi | Hol |
|---|---|
| EGY lista a Főoldalon („Így halad a bekötésed”: szám · név · ki lép · állapot · idő · Mi ez?), EGY „Most ez jön” vagy várakozó kártya (ki dolgozik, mennyi ideig, meddig – utána visszahívás), EGY szám (sáv = fül-jelvény = zárt lap). A listát a szerver adja (`OnboardingState.journey`); §27 nélküli szervernél és a MINTA-ban ugyanaz a számítás: `src/lib/ut.ts` | `src/app/bekotes/index.tsx`, `src/ui/Ut.tsx`, `src/lib/ut.ts` |
| A fő válasz módosítható (S5): az 1. sor „Módosítom”, a Rólad lap, az Adataid 2. lap („Még nincs adószámom”), a kérdőív kapuja és 1. lapja, a Fiók, a központ „Mégsem most?” lapja; „Visszavonom” 5 mp-ig; beküldés után visszahívás | `src/ui/Ut.tsx` (`UtvaltasProvider`, `useUtvaltas`) |
| „Hogyan jelentsük be?” (S3) a „Még nincs” után; kiemelt „Intézzétek helyettem” / „Megcsináljuk helyetted a meghatalmazást” kártyák; a kérés képernyője (így megy · soha nem kérjük el a belépésedet · visszahívás) | `src/ui/Ut.tsx`, `src/app/helyettunk.tsx`, `src/ui/Helyettunk.tsx` |
| NAV-meghatalmazás: felül a választás (kiemelt „Megcsináljuk helyetted”), „Magam adom meg” → az ONYA-útmutató lépésenként; a kérés állapotai; jóváhagyás határidővel | `src/app/bekotes/meghatalmazas/index.tsx`, `…/meghatalmazas/jovahagyas.tsx` |
| Útmutatók lépésenként (`?lepes=N`, „Megvan, tovább”, „Vissza”, „Mutasd egyben”), a képek alatt az őszinte kis sor (`kepCimke`: „NAV-képernyő · Forrás: …” / „Rajzolt vázlat – …”), rajzolt kép esetén egy sor a bevezető alatt | `src/kepernyok/Utmutato.tsx`, `src/lib/utmutato.ts`, `src/ui/KepNezo.tsx` |
| Vállalkozás-központ (S8), kérdőív (S9: két pipa, időarányos ÁFA- és átalány-határ), értesítés feltöltése (S11), kamara (S12), végső engedély (S17) | `src/app/bekotes/vallalkozas/{index,adatlap,feltoltes,kamara,engedely}.tsx` |
| „Anyukád” (S18 Igazolványok, „Hol találom?” a négy mezőn), „Hol találom?” csak iraton álló számnál, máshol „Mi ez?” | `src/app/bekotes/azonositas.tsx`, `src/ui/Magyarazat.tsx` |
| Kiállított számlák egy szóval (§27.5): Dosszié, havi lista, feltöltés | `src/app/dosszie/…`, `src/app/feltoltes.tsx` |
| Biztonság: a fizetés-eredmény csak a szerver visszaigazolása után „Sikeres”; `android.allowBackup: false`; 1.0.6 (versionCode 7) | `src/app/elofizetes/eredmeny.tsx`, `app.config.ts` |

```bash
npm run export:minta && node scripts/kepek-k5.mjs     # k5_app_* → kod/_qa (390×844 és 320×640), PORT=8833
node scripts/k27-szamla-szoveg.mjs                     # K5.1: tiltott számla-fordulatok (app, panel, backend, jogi, VTT)
```

MINTA forgatókönyvek (új): `marika` (Intézzük helyetted, jóváhagyásra vár), `engedely` (él a meghatalmazás → végső
engedély), `bekuldve` (bejelentettük, adószámra várunk), `ilona` (visszahívást kért), `david` (meglévő vállalkozás,
„Megcsináljuk helyetted a meghatalmazást”, egyeztetve), `kamara` (kész bejelentés, kamarai regisztráció).

## Tulaj-kérések 11-19 este (SPEC §28 + §28.K, k6)

**Kinézet (§28.K.10, a tulaj választása 20:10 „a C sokkal jobb” + 20:20 „csak valami elválasztó köztük”):** fehér alap, a
szakaszok teljes szélességű fehér sávok, köztük **8 pt-os `#EEF1F8` sáv**; árnyék, egymásra rakott lap, sötétítés nincs.
Ez a közös elemekben él, így minden képernyő megkapja: `src/ui/teljes.tsx` (környezet + `SAV`), `src/ui/alap.tsx`
(`Lap` teljes szélesség + sáv, `kotott`/`elso`; `Szakasz` 3D ikon 28 + sötét cím 18 + kapszula; `GombE` 52 és két sorra
nőhet; `GombM` 40/44; `Sor` ikon 28, 52 magas), `src/ui/keret.tsx` (lapos 5 fülű fülsor 52 pt, Fotózás középen; `dokk` =
fix fő gomb a fülsor fölött; `CimSor` = C űrlap-fejléc „Vissza” kapszulával; a szakaszcím alatti lap nem kap sávot), a
kerek „i” (`MiEzKor`), C űrlap: `src/kepernyok/Urlap.tsx`. Az alsó lapon (sheet) belül a lap marad kártya.

| Mi | Hol |
|---|---|
| Főoldal: két nagy szám, havi kérdés, éves zárás, szünetelés, „Félretenni” (gyűrű + „Félretettem…”), „Mennyit kerestem?”, kedvezmény-tipp, „Ha elakadsz”, dokkban „Elutaltam” | `src/app/index.tsx`, `src/kepernyok/k28.tsx` |
| Számlánként „Ennyit tegyél félre” + „Miért ennyi?”; a lista második alsora; hónap-összeg | `src/app/szamla/[id].tsx`, `src/app/dosszie/[honap]/szamlak.tsx` |
| `/felretesz`, `/kereset` | `src/app/felretesz.tsx`, `src/app/kereset.tsx` |
| Kedvezmény-kérdőív K0–K12 (csak a releváns lapok; nincs név, gyerek-születésnap, TAJ, adóazonosító; egészségügyi adat csak kifejezett hozzájárulással), állapot-képernyő | `src/app/kedvezmenyek/{index,kerdoiv}.tsx` |
| Változás-útmutatók: hub, info-lap a kiemelt „Bejelentjük helyetted” kártyával (díj, DEMO), útmutató lépésenként (nagyítható képek, ha a B4 kész), kérés + előre fizetés, engedély | `src/app/valtozas/**`, `src/kepernyok/ValtozasUrlap.tsx` |
| Havi ellenőrzés „Változott valami?”, „Hogyan intézzük?”, díj előre | `src/app/valtozott.tsx` |
| Éves zárás állapot + kérdőív E0–E8 | `src/app/eves-zaras/{index,kerdoiv}.tsx` |
| Díjak és számlák (a régi Díjszámlák helyett), egyszeri díj fizetése (`dijFizetes`) | `src/app/fiok/dijak.tsx`, `src/lib/simplepay.ts` |
| Díj-zárolás sáv minden fő képernyőn | `src/ui/Zarolas.tsx` (a `Kepernyo` teszi be) |
| Alkalmazott / EFO kérdés + kedvezmény-kapu a bekötésben | `src/app/bekotes/alkalmazottak.tsx` (az Adataid mentése után) |
| Értesítések: csendes idő, számlák (+ összeg a pushban), kedvezmények, emlékeztetők | `src/app/fiok/ertesitesek.tsx` |
| Fiók → Adózás (kedvezmények, kereset, változás), Díjak és számlák | `src/app/fiok/index.tsx` |
| MINTA-szerver minden új végponttal | `src/api/minta/k28.ts` |

MINTA forgatókönyvek (új): `eszter` (kedvezmény vár), `balint` (25 év alatti, jóváhagyva), `norbert` (havi kérdés +
7 999 Ft DEMO díj), `adam` (székhely-engedély), `eves` (éves zárás kérdőív), `zarolt` (díj-zárolás), `szunetel`, `tamas`
(bekötés, EFO).

```bash
npm run export:minta && node scripts/kepek-k6.mjs       # k6_app_* → kod/_qa (390×844 és 320×640), PORT=8834
ELOTTE=1 MAPPA=<régi dist> node scripts/kepek-k6.mjs    # a restyle előtti képek (k6_app_e*)
```
