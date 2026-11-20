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

## Gépes (asztali) nézet (tulaj 11-20)
- Az app.adozz.hu gépen is megnyílik -> responsive: telefonon a v2, ~1024 px felett asztali elrendezés: bal menüsáv logóval (Főoldal, Dosszié, Feltöltés, Üzenetek, Fiók) + könyvelő kártya alul, kék hős sáv, 2 oszlopos kártyarács, kétpaneles üzenetek/határidők/dosszié, osztott belépőoldal. Minták: dizajn/C5_v2/asztali/ – JÓVÁHAGYVA 11-20 ("nagyon jól néz ki"). A menüben "Fotózás" kamera ikonnal marad (gépen fájlfeltöltést is enged).

## E-mail-lefedettség (felmérés 11-20, dizajn/email/LEVEL_LEFEDETTSEG.md)
- 74 esemény: 40 kap e-mailt, 11 részben, 23 nem (5 szándékosan csak push/app, 18 valódi hiány). Mind a 21 hiányzó levélhez van javasolt tárgy+szöveg a fájlban.
- k8: minden levél az új sablonnal (dizajn/email/sablon.html, mailer.ts htmlOf helyett); a díjszámla is (Számlázz sendEmail=false).
- Top hiányok: felmondó PDF e-mailben (kötelező); új üzenet a könyvelőtől alapból e-mail (most csak bekapcsolva); NAV-hiba jelzése (ügyfél+könyvelő); előfizetés megszűnése; felmondás hatálybalépése; fióktörlés visszavonva/végrehajtva + adatexport-hiba; árkedvezmény visszavonása, admin kártyatörlés; "már van fiókod" levél (regisztrációnál ne árulja el, hogy létezik a cím); elutasított igazolás e-mailben is.
- Döntés kell: árkedvezmény visszavonásánál is 30 napos előzetes értesítés?
- Fotózás (telefon): a kamera mellett GALÉRIA és FÁJL/PDF feltöltés is (tulaj 11-20); minta: dizajn/C5_v2/64_fotozas.png (vaku a keret sarkában).
- Könyvelői panel + tulaj konzol (konyvelo.adozz.hu) is megkapja a v2 dizájnt: felirat-logó, kártyák, Microsoft emoji ikonok (a 3D ikonok helyett), sárga fő gomb, egységes menüsáv (tulaj 11-20 kérdésére: igen). Előtte minták jóváhagyásra.

## Mozgás (motion design) az appban (tulaj 11-20: "ezeket is tegyük bele") – csak az ügyfél-appba, a panelbe/konzolba nem
- Főoldal betöltés: kártyák finom, egymás utáni beúszása; a fő összeg (pl. 250 000 Ft) felpörgése nulláról.
- Haladás- és keretcsíkok feltöltődése betöltéskor.
- Gombnyomás: enyhe "benyomódás" (scale ~0,97).
- "Megjelölöm, hogy félretettem" / befizetés után: felpattanó zöld pipa.
- Bekötés vége és első sikeres fizetés: rövid ünneplő animáció (pl. konfetti, Lottie – MIT licencű lottie-react-native).
- Fotózás: villanás + a kép bélyegképként a Dossziéba "repül".
- Betöltés: forgó kör helyett halvány helykitöltők (skeleton).
- Alsó sáv: a kiválasztott fül ikonja picit megugrik; az új üzenet piros pöttye felpattan.
- Szabályok: 0,2–0,4 s, nincs folyamatos mozgás, gyenge telefonon is akadásmentes (Reanimated / natív driver), a rendszer "csökkentett mozgás" beállítását tiszteletben tartja.
- Weboldal (adozz.hu): opcionális, 1-2 finom CSS-mozgás a hős részen (JS nélkül).
- Gépen (app.adozz.hu asztali nézet) UGYANEZEK a mozgások (ugyanaz a kód fut a weben), plusz gépre szabva: egér fölé vitelre a kártya picit megemelkedik, a gomb kiemelődik; fájl behúzásakor a feltöltő sáv kivilágosodik, feltöltés után a fájl a listába "repül" (a kamera-villanás helyett). (tulaj 11-20: "gépen is kellene")

## Könyvelői felület hiányai (felmérés 11-20, _munka/KONYVELO_LEFEDETTSEG.md)
- A negyedéves átalányadós munka megvan; egész évhez hiányzik. Két hiba a k7b-ben javul (HIPA-jóváhagyó gomb; éves SZJA/HIPA határidő "kész" állapota).
- Nagyobb hiányok (k8/k9, előbb Dávid válaszai): éves különbözet (SZJA/TB/szocho/HIPA fizetendő/visszajáró) tételként; NAV-folyószámla egyeztetés + önellenőrzés; helyettesítés (más könyvelő átmenetileg); ÁFA (közösségi adószám) időszak/határidő; KATA-kártya kitöltése + havi KATA-befizetések követése; jogállás évközi változása; meghatalmazás terjedelme; 35 tevékenység ÖVTJ-kódja üres; közös olvasatlan-üzenet és "Ma" nézet; negyedéves zárási tábla minden ügyfélre; négy szem elve adó-jóváhagyásnál.
- FIGYELEM (11-20): a Számlázz.hu "Rendelésszám ismétlődés tiltása" BE VAN (a tulaj 11-20 este bekapcsolta; k7 kérte, a kártyás számláknál a fizetés-azonosító a rendelésszám). Az átutalásos díjbekérőnél ezért NEM lehet minden hónapban ugyanaz a rendelésszám (ADZ-10482) – helyette egyedi (pl. ADZ-10482-2026-12), az ügyfélazonosító a közleménybe/megjegyzésbe; ellenőrizni, hogy az Autokassza így is párosít-e (állandó átutalásnál fix közlemény + a küldő bankszámla alapján). Ha nem: a közlemény-formátumot igazítani.
- Google iOS client: 573908605351-u5vsshs9m00li20dfb3k5m8vl3n5m616.apps.googleusercontent.com (bundle com.somosi.kezjegy). iOS buildnél: GOOGLE_IOS_CLIENT_ID + a fordított client ID URL-sémaként az app.json-ban (com.googleusercontent.apps.573908605351-u5vsshs9m00li20dfb3k5m8vl3n5m616); Team ID az Apple-fiók után.
