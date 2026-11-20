# k8 – arculati és döntési kör (a k7 UTÁN) – gyűjtő, 2026-11-20

A k7 (Stripe, Számlázz.hu, domain, F1–F4, F9 vezérlőpult, G bevezető) lezárása után ez kerül az appba (kod/app), a panelbe (kod/panel), a backendbe és a levelekbe.
Mérce: `dizajn/C5_v2/` (89 jóváhagyott képernyő, HTML+PNG), közös alap: `dizajn/C5_v2/v2.css` + `v2.js`.

## Dizájn (tulaj jóváhagyta 11-20)
- Kártyás elrendezés: szürke háttér (#F3F5FB), minden szakasz külön fehér kártya (r 20, finom árnyék), kék gradiens fejléc alul kerekítve.
- Felirat-logó: Poppins 800 „Adó” + sárga „zz” + „.hu” + sárga lendület-vonal; nincs kabala.
- Sárga #FFC93C fő gomb sötét #10152B felirattal, képernyőnként max. 1; Google-gomb hivatalos színes „G”-vel.
- Ikonok: Microsoft Fluent Emoji Flat (MIT) a tartalmi ikonokhoz (v2.js EMOJI térkép, forrás `dizajn/C5_v2/_ikon_proba/emoji`), a kezelőelemek (vissza, nyíl, bezár, plusz, küld, letölt, szem, pipa, keresés, gemkapocs) egyszerűek maradnak. Semleges csempe (#F1F3F9), az ikon nagy (34 px a 42-es csempében).
- Alsó navigáció: fehér, felül kerekített, MINDEN ikon színes; a kiválasztott fület kék felső csík + kék felirat jelzi.
- Szövegek: `dizajn/C5_v2/SZOVEG_JAVITASOK.md` (78 csere; szja kisbetű, ÁFA nagybetű, főoldal kisbetű, havidíj egybe, „Kifizetem (… Ft)”).

## Termékdöntések (tulaj, 11-20)
- Bekötés: a kártyát/fizetést csak a NEM kötelező visszahívás UTÁN kérjük; a visszahívás „a csapatunktól” (nem nevezzük meg, ki hív). Bekötés 13 lépés.
- Bérszámfejtés (alkalmazott, alkalmi munkás/EFO): vállaljuk, felárért, egyedi ajánlat (ár még nincs).
- Kétlépcsős belépés: e-mailes kód (nincs hitelesítő app, nincs tartalékkód).
- „Félretettem” gomb → „Megjelölöm, hogy félretettem” + „Ez csak jelölés: pénzt nem vonunk le, nem utalunk.”
- Határidők: NAV-számlaszám + közlemény (az ügyfél adószáma) „Másolom” gombokkal (53_hataridok_b). Számlák: szja 10032000-06056353, TB 10032000-06055802, szocho 10032000-06055912 (nav.gov.hu 2026.11.01, egyezik az ado-motorral). Átalányadós EV: negyedéves fizetés, a negyedévet követő hó 12-ig (IV. n.év: jan. 12.).
- Fizetés: kártya (Stripe, automatikus) VAGY átutalás (havi díjbekérő, 8 nap – jóváhagyásra vár). Kedvezményezett: Somosi Kft., számlaszám/IBAN/SWIFT a `kod/shared/brand.json` provider mezőiben.
- Átutalás-egyeztetés: Számlázz.hu Autokassza (Erste). A díjbekérőn rendelésszám = ügyfélazonosító (pl. ADZ-10482, ez a közlemény is); a backend lekérdezi a fizetési állapotot (a pontos Agent-hívást ellenőrizni), a vezérlőpultban: fizetett / vár / késik; első utalás után automatikus bekapcsolás; késésnél emlékeztető.
- Díjszámla-levél: NEM a Számlázz.hu küldi (sendEmail=false), hanem saját Adózz-levél ZeptoMaillel, a mi arculatunkkal, a számlával (PDF/link). Szöveg „a(z)” nélkül, pl.: „Szia Zoé! Elkészült a havidíjad számlája (2026. 11. 20. – 12. 19.).” (Most: kod/backend/src/payments/invoices.ts emailTargy/emailSzoveg + content/k29.ts.)

## Nyitott (tulaj)
- 8 napos fizetési határidő OK? Késésnél szüneteljen a könyvelés (mint sikertelen kártyánál)?
- „ADZ-10482” közlemény-formátum OK?
- Szerződésnél „Bencével kötöd” → „velünk kötöd” (a szerződő fél a Somosi Kft.)?
- Plusz díjak (éves zárás 14 999, változás 4 999) maradnak? 24–48 órás visszahívás marad?
- Új app-ikon + favicon (felirat-alapú jel).
