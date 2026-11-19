# Kézjegy – Android teszt-APK (ügyfél-app)

`Kezjegy-<verzió>-test.apk`: telefonra közvetlenül telepíthető **teszt** változat
(csomagazonosító `com.somosi.kezjegy`, a név a `kod/shared/brand.json`-ból jön).
Az app az élő DEMO szerverhez kapcsolódik: `https://api.45-94-65-74.sslip.io/api/v1`
(kitalált adatok, DEMO fizetés, DEMO NAV – valódi pénz és valódi NAV-kapcsolat nincs).

## Telepítés a telefonra

1. Másold át az APK-t a telefonra (USB, Google Drive, e-mail magadnak).
2. Nyisd meg a telefonon; a rendszer megkérdezi, engedélyezed-e az „ismeretlen forrásból”
   telepítést annak az alkalmazásnak (Fájlok / Drive), amivel megnyitottad. Engedélyezd.
3. Telepítés → Megnyitás. A Play Protect figyelmeztethet („ismeretlen fejlesztő”): ez a
   teszt-aláírás miatt van, „Telepítés mindenképp”.

USB-n gépről: `D:/Atvitel/Android/Sdk/platform-tools/adb install -r Kezjegy-1.0.7-test.apk` (a régebbi fölé frissítésként települ)

Belépés: a demo ügyfél (Szabó Kata) jelszava csak a szerveren van:
`ssh appok-1 'cat /srv/kezjegy/demo_belepesek.txt'` (sor: `ugyfel;kata.szabo@demo.kezjegy.test;…`).
Új fiókot is regisztrálhatsz; az e-mail kód a DEMO postafiókba megy (admin panel → Demo postafiók).

## Verziók

| Fájl | Verzió (versionCode) | Mikor |
| --- | --- | --- |
| `Kezjegy-1.0.0-test.apk` | 1.0.0 (1) | 2026-11-18 03:04 – első teszt-APK, 68 524 792 bájt, SHA-256 `947a39db678d698459391f893201f2afb83cfb86eb2443e36c79bf32a425b483` |
| `Kezjegy-1.0.1-test.apk` | 1.0.1 (2) | 2026-11-18 05:04 – 1. ellenőrző kör javításai (kijelentkezés, előfizetés-kezelés, előnézet, 2FA, ONYA-útmutató stb.), 68 553 224 bájt, SHA-256 `b9190ca15dbbd24f707c741c432f59a40cce12a25fac12496f56adb0ed8fbdd2` |
| `Kezjegy-1.0.2-test.apk` | 1.0.2 (3) | 2026-11-18 reggel – 2. ellenőrző kör javításai (részben befizetett tételek a főoldalon  befizettem-lap  kérdőív alapértelmezés nélkül  „Hol tartunk” mondatokkal  időpont-csere  hibaüzenetek  űrlaphibák törlése)  68 562 260 bájt, SHA-256 `0d654e212e47cd915511d9392c6cc7807666047c440f8eda56434db01244fc0f` |
| `Kezjegy-1.0.3-test.apk` | 1.0.3 (4) | 2026-11-18 13:50 – a 11-18-i kérések: alsó sáv a bekötés alatt, korlátozott mód, „Van már egyéni vállalkozásod?”, új vállalkozás útmutatója jelölt NAV-képekkel, visszahívás, videók (expo-video, streamelve az app.…/media/ címről), magyarázatok; 70 250 189 bájt, SHA-256 `3d00d1bcf50bc1707267e2424ab6c79159b3afa65b850b759f90dd4aa1d21139` |
| `Kezjegy-1.0.4-test.apk` | 1.0.4 (5) | 2026-11-18 17:07 – a 2. átnézés javításai (fülsor hidegindításnál, zárolt irat-lap, alsó sáv a fizetés-visszatérésnél és a kérdés-űrlapon, ÖVTJ-várakozás az útmutató tetején, javítás ONYA/Ügysegéd szerint, saját szavas tevékenység, „Bemutató videó · 1:47”, felolvasó-címkék, 320 px); 70 268 289 bájt, SHA-256 `c04c3fc002976b31e3b881e8ebe622c4a15ddd5f221451a52e926b9e85862b7f`. Az élő API-val csak az `up.sh` után teljes |
| `Kezjegy-1.0.5-test.apk` | 1.0.5 (6) | 2026-11-19 09:42 – az új kék szín (#1428DB) és a 11-19-i 1. ellenőrző kör javításai; 70 391 749 bájt, SHA-256 `e11f1a2e00cf5ba16129e0951f1b1bcfede3390cf6e46e196e3441b3ba07586a` |
| `Kezjegy-1.0.6-test.apk` | 1.0.6 (7) | 2026-11-19 13:42 – a 11-19-i tulaj-kérések (SPEC §27: oda-vissza váltás, „Intézzük helyetted”, „Így halad a bekötésed”, „Kiállított számlák”); 70 531 449 bájt, SHA-256 `74b0046ae0d00df214f47ed0ed56d799eee865b589e19c443f5dbde35a0dd71d` |
| `Kezjegy-1.0.7-test.apk` | 1.0.7 (8) | 2026-11-19 19:17 – a 11-19-i 1. és 2. javító kör (adatok megmaradnak váltáskor, egy „Mentés” elég, ki kire vár, „Késünk vele”, „Másik számot adok meg”, kis telefonok); 70 550 249 bájt, SHA-256 `795d83583aea62f8903d7608ae46bacf39e1d4261772275459bb0fee2e610e06`; ugyanaz a debug-kulcs, a régi fölé frissítésként települ |

Az előző azonos nevű APK újraépítéskor az `_regi/` mappába kerül, nem törlődik.

## Újraépítés

```bash
bash C:/Users/UpgradePC/konyvelo_app/apk/build-apk.sh             # android/ megvan
PREBUILD=1 bash C:/Users/UpgradePC/konyvelo_app/apk/build-apk.sh  # app.config.ts / brand.json változott
```

A szkript csak a saját folyamatában állítja be az `ANDROID_HOME`-ot (D:/Atvitel/Android/Sdk),
a `JAVA_HOME`-ot (JDK 17) és a `GRADLE_USER_HOME`-ot (D:/Atvitel/Android/gradle-home, mert a
C: kevés). A `windows-path.init.gradle` (ugyanaz a trükk, mint a Gardokónál) a 260 karakteres
Windows-útvonalkorlát miatt rövidíti a CMake-utakat; az app modul CMake-mappája
`D:/Atvitel/Android/cxk`. Processzor-architektúrák: `arm64-v8a,armeabi-v7a`
(emulátorhoz: `ABIS=x86_64 bash build-apk.sh`). Első építés ~30 perc, utána pár perc. Naplók: `_naplok/`.

Másik szerver: `EXPO_PUBLIC_API_URL=https://api.sajatdomain.hu/api/v1 PREBUILD=1 bash build-apk.sh`.

## Fontos: ez NEM a Play Áruházba való változat

A teszt-APK **a nyilvános debug kulccsal** van aláírva. Próbára jó, de a Play Áruház nem fogadja el,
és a Play-es változat nem tud rá frissíteni. A Play Áruházhoz kell [TULAJ]: saját feltöltési kulcs
(upload key, a repón kívül, biztonsági másolattal), `.aab` csomag (`./gradlew bundleRelease` vagy EAS),
Play App Signing, `versionCode` növelése minden feltöltésnél. Push értesítéshez EAS projekt + FCM kell;
Google-belépéshez a Google client ID-k (a kulcs-szkript) és az Android kliens SHA-1-je.

Engedélyek: kamera (iratfotó), biometria (feloldás), értesítés, internet. A `RECORD_AUDIO`,
`ACCESS_FINE_LOCATION` és `SYSTEM_ALERT_WINDOW` az `app.config.ts` `android.blockedPermissions`
részével ki van véve.
