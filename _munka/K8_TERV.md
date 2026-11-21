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
- Fizetés: kártya (Stripe, automatikus) VAGY átutalás (havi díjbekérő, 8 nap fizetési határidő – a tulaj 11-20 jóváhagyta). Kedvezményezett: Somosi Kft., számlaszám/IBAN/SWIFT a `kod/shared/brand.json` provider mezőiben.
- Átutalás-egyeztetés: Számlázz.hu Autokassza (Erste). A díjbekérőn rendelésszám = ügyfélazonosító (pl. ADZ-10482, ez a közlemény is); a backend lekérdezi a fizetési állapotot (a pontos Agent-hívást ellenőrizni), a vezérlőpultban: fizetett / vár / késik; első utalás után automatikus bekapcsolás; késésnél emlékeztető.
- Díjszámla-levél: NEM a Számlázz.hu küldi (sendEmail=false), hanem saját Adózz-levél ZeptoMaillel, a mi arculatunkkal, a számlával (PDF/link). Szöveg „a(z)” nélkül, pl.: „Szia Zoé! Elkészült a havidíjad számlája (2026. 11. 20. – 12. 19.).” (Most: kod/backend/src/payments/invoices.ts emailTargy/emailSzoveg + content/k29.ts.)

## Nyitott (tulaj)
- 8 napos fizetési határidő: JÓVÁHAGYVA (11-20). NYITOTT: késésnél szüneteljen a könyvelés (mint sikertelen kártyánál)?
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

## Próbalevél tanulságai (11-20 20:20)
- ZeptoMail → Lark kézbesítés OK (nem spam). A tulaj válasza az ertesites@adozz.hu-ra ment (a saját címre mutató Reply-To-t a Lark figyelmen kívül hagyja) és VISSZAPATTANT: az ertesites@ nem létező postafiók. Teendő (tulaj): a Lark-adminban az ertesites@adozz.hu legyen alias az ugyfelszolgalat@ postafiókon, hogy ügyfélválasz soha ne vesszen el.
- A levelezők az "Adózz.hu" szót félig linkelik ("Adó" + link "zz.hu", az ó miatt). Minden HTML-levélben az Adózz.hu legyen teljes, kifejezett link (<a href="https://adozz.hu" style="color:…;text-decoration:none">). A dizajn/email/sablon.html és az aláírások javítva; a backend htmlOf/új sablon-renderelő (k8) is így tegye a szövegtörzsben.
- A levéllogó (https://adozz.hu/email/logo_feher@2x.png) 404 volt: a landing mappát 17:42-kor kicserélték, a kezjegy-web konténer a régi (bind mount) mappát látta. Javítva: email/ feltöltve + kezjegy-web újraindítva → 200. A landing-telepítés (feltolt.sh / k8) mappacsere után indítsa újra a kezjegy-webet (vagy a szülőmappát csatolja), és a dist/email mindig kerüljön fel (build.mjs már másolja).

## k7b után nyitva (11-20 20:23, élő)
- Időígéret maradt felületi szövegben (a megengedett mondaton kívül): kod/backend/src/content/tulaj1118.ts, kod/shared/src/bekotes.ts → javítani.
- Új APK kell (a régi APK-val a regisztráció nem fejezhető be; a webes app már jó).
- Két egyszerre végzett kártyatörlés dupla levelet küldhet (ritka).
- A jogi app_szovegek.json régi szövegei (a kód felülírja) → egységesíteni.
- Régi egyszeri szkriptek (app/scripts/_helyi_j*.mjs, _qa/*_harness.mjs) a régi regisztrációt használják; https-proba.sh / bongeszo-proba.mjs SimplePay-része elavult.
- Szövegjavítás: 54-ből 51 bent; a 14., 17., 19. tétel levele nem készült.

## Átvétel a marketing-munkából (SPEC §31, 11-21) – a landing_v2 élesítésekor (k8)
A mostani nyitóoldal (`kod/landing/build.mjs`) már így készül; az új landingnak (dizajn/landing_v2) ugyanez kell, különben a
forrás és a statisztika elvész, vagy a lábléc valótlant állít:
- **Szkriptek a `<head>`-ben, ebben a sorrendben:** `<script defer src="js/meres.js"></script>`, majd – csak ha a `kod/landing/meres.json`
  `umamiWebsiteId`-je ki van töltve – `<script defer src="/m/script.js" data-website-id="…" data-domains="adozz.hu" data-before-send="adozzStatSzuro" data-do-not-track="true"></script>`.
  A `js/meres.js`-t ne kézzel írd: a `build.mjs` állítja elő (`meres-sablon.js` + a közös csatornaszabály); a v2 buildje hívja ugyanazt
  a generálást, vagy másolja a `kod/landing/dist/js/meres.js`-t. Inline szkript nem lehet (CSP).
- **Események:** `data-umami-event="regisztralok"` (+ `data-umami-event-hely="hos|arak|zaro|fejlec|lab"`) minden Regisztrálok-linken,
  `belepes` a Belépésen, `email-iras` a mailto-n, `visszahivas` a Visszahívást kérek linken (`https://app.adozz.hu/regisztracio?cel=visszahivas`).
  Az árak szakasz azonosítója **`id="arak"`** (a v2 index.html 372. sorában már megvan) – erre figyel a „görgetett az árakig”.
- **Linkek:** minden app-link `https://app.adozz.hu/…` alakú legyen (a `meres.js` ezekhez fűzi az `utm_*`, `hivatkozo`, `erkezes`
  paramétert); a `/jogi/` linkek tisztán maradnak.
- **Lábléc:** a Jogi menübe „Süti-tájékoztató” → `https://app.adozz.hu/jogi/suti`. A „nincs követő süti” / „nem követ” mondat helyett
  (v2 359. és 575. sor) a statisztika bekapcsolása után: „Ez az oldal nem használ sütit. A látogatottságot a saját szerverünkön mérjük,
  süti nélkül, összesítve.” Hirdetési build esetén: „Hirdetési sütit csak akkor használunk, ha elfogadod. A látogatottságot a saját
  szerverünkön mérjük, süti nélkül.” Kell a látogató kikapcsoló gombja: `<button type="button" class="szoveg-gomb" id="meres-kapcsolo" hidden></button>`
  (a `meres.js` teszi láthatóvá), hirdetési buildben mellé `id="suti-beallitasok"` („Süti-beállítások”).
- **Süti-ablak:** csak a `meres.js` rendereli (hirdetési buildben, a szerver kapcsolójával); a v2 adja hozzá a `.hj-ablak`, `.hj-gomb`,
  `.hj-szoveg-gomb`, `.hj-beallitasok`, `.hj-doboz` stílust a saját arculatában – az „Elfogadom” és az „Elutasítom” egyforma maradjon.
- **CSP:** a proxy `kezjegy_csp_landing`-je már `script-src 'self'` (a v2 `mozgas.js`-e is fut vele). Hirdetéskor `kezjegy_csp_landing_hirdetes`.
- **Telepítés:** a landing mappája egészben cserélődik: legyen benne az `email/` (két logó) és a `js/meres.js` – a `feltolt.sh` most megáll
  nélkülük, az `up.sh` pedig ellenőrzi és újralétrehozza a `kezjegy-web`-et. A teszt: `node --test kod/landing/meres.test.mjs`.

## Átvétel a marketing-munkából – JAVÍTVA ÉS ÉLES (11-21 01:36) – EZ AZ ÉRVÉNYES, a fenti szakasz helyett
A mostani nyitóoldal (`kod/landing`) így fut élesben (DEMO szerver, statisztika BE, hirdetés KI). A landing_v2-nek ugyanez kell:
- **A `<head>`-ben csak** `<script defer src="js/meres.js"></script>`. **NE legyen `/m/script.js` tag a HTML-ben:** a statisztika
  szkriptjét a `meres.js` maga tölti be (website id, domains, before-send szűrő, tag = csatorna, Do Not Track), és csak azután, hogy a
  szűrő kész – így a statisztika soha nem fut szűretlenül. A `js/meres.js`-t a `kod/landing/build.mjs` generálja a
  `kod/landing/meres.json`-ból (website id már benne: `4b205eb2-faaa-4512-928a-b94d14fad444`) és a közös csatornaszabályból:
  a v2 buildje hívja ugyanazt a generálást, vagy másolja a `kod/landing/dist/js/meres.js`-t. Inline szkript nem lehet (CSP).
- **Események: `data-kj-esemeny` + `data-kj-hely`, NEM `data-umami-event`** (az Umami-tracker az ilyen linket addig visszatartja,
  amíg a kérése le nem fut – lassú statisztika-szervernél a gomb megfagy). Értékek: `regisztralok` (hely: `hos|arak|zaro|fejlec|lab`),
  `belepes`, `email-iras` (mailto), `visszahivas` (`https://app.adozz.hu/regisztracio?cel=visszahivas`). A `meres.js` várakozás
  nélkül küldi őket. Az árak szakasz: **`id="arak"`** („görgetett az árakig”).
- **UTM-továbbadás:** minden app-link `https://app.adozz.hu/…` alakú; a `meres.js` fűzi hozzá az `utm_*`, `hivatkozo` (csak a webhely
  neve), `erkezes` paramétert; a `/jogi/` linkek tiszták maradnak. Kattintás-azonosító (gclid, fbclid) csak bekapcsolt hirdetési
  mérésnél és „Elfogadom” után megy át.
- **Lábléc:** `<p id="meres-lablec">` a `kod/jogi/app_szovegek.json` `meres.lablec` szövegével („Ez az oldal nem használ sütit. A
  látogatottságot saját szerverünkön, süti nélkül, összesítve mérjük.”); a link felirata `lablec.suti` = „Süti-tájékoztató” →
  `https://app.adozz.hu/jogi/suti`; a látogató kikapcsolója `<button type="button" class="szoveg-gomb" id="meres-kapcsolo" hidden></button>`
  és mellette `<span id="meres-visszajelzes" role="status" aria-live="polite"></span>`; hirdetési buildben `id="suti-beallitasok"`.
  **A landing_v2 „nincs követő süti” / „nem követ” mondata (359. és 575. sor) már MOST sem igaz a statisztika miatt → a fenti
  `meres.lablec` szövegre kell cserélni. A hirdetési mérés bekapcsolásakor ez újra módosul:** a `meres.js` a szerver `{ads:true}`
  válaszára magától a hirdetési mondatra cseréli a `#meres-lablec` szövegét, a jogi szövegek pedig a
  `kod/jogi/bekapcsolaskor/valtozatok.md` A) része szerint változnak.
- **Süti-ablak (csak hirdetési build + bekapcsolt szerver):** a `meres.js` rendereli, a szövegei buildkor az `app_szovegek.json`
  `suti_ablak.*` kulcsaiból jönnek (nincs beégetett szöveg, nincs „személyre szabott” jelölő). A v2 adja hozzá a stílust: `.hj-ablak`,
  `.hj-gomb`, `.hj-szoveg-gomb`, `.hj-beallitasok`, `.hj-beall-cim`, `.hj-kicsi`, `.hj-szukseges`, `.hj-doboz` – az „Elfogadom” és
  az „Elutasítom” egyforma, előre fókusz nélkül.
- **CSP / proxy:** változatlan (`kezjegy_csp_landing`, `script-src 'self'`; a `/m/script.js`, `/m/api/send` és a hirdetési végpontok
  útvonalai az `adozz.caddy`-ben).
- **Telepítés és próba:** a mappa egészben cserélődik; legyen benne `email/` (két logó) és `js/meres.js` (a `feltolt.sh` megáll
  nélkülük). Teszt: `node --test kod/landing/meres.test.mjs`. **Gépi böngészős próbához normál User-Agent kell** (az Umami a
  „HeadlessChrome”-ot botnak veszi, és nem számolja). Élesítés után a Marketing fülön (7 nap) meg kell jelennie a próbalátogatásnak.

## Éves ciklus + KATA (SPEC §32, §32.B, §32.C) – mi maradt nyitva (2026-11-21, a DEMO-ra élesítés után)
Élesítve a DEMO-ra 11-21 05:00 (migráció 0022–0026). A k8 (landing_v2) ezekhez nem nyúl, de ezek még nyitottak:
- **Dávid válaszai:** `_munka/DAVID_KERDESEK_OSSZEFESULT_2026-11-21.md` (56 kérdés, az első 10 sürgős – köztük a 2027-es
  kata és a 30 napos záróhónap). A [DÁVID]-függő pontok óvatos alapértéken állnak.
- **T/928 (2027-es kata):** amíg nincs kihirdetve, a `kata2027` KI (a 2027-es hónapok összeg nélkül). Kihirdetés után: a
  végleges szöveg ellenőrzése, `ado-motor/src/rules/2027.ts` `draft: false`, `kata2027` BE, `kata2027Osszeg` (75 000 vagy
  50 000). Az új kata NAV-számlája és nyomtatványa még ismeretlen – addig rá sem tétel, sem emlékeztető nem készül.
  Decemberben minden ügyfélnél rögzíteni kell a 2027-es módot (panel: „2027. évi adózási mód” kártya).
- **Éves zárás díja (14 999 Ft):** `evesZarasDij` KI, amíg az ÁSZF-et a jogász nem javítja (T1, T-K5); a díjfolyamat kész.
- **Nem készült el:** a „Kata megszűnése” művelet (ok, 15 napos bejelentési feladat, a jövőbeli tételek érvénytelenítése, a
  nyilatkozat rögzítése még a tárgyévben); a webes ügyfelek általános e-mail-tartaléka push helyett (HIANYLISTA 1.9 – az
  éves és a kata-értesítések már mennek e-mailben); az új mezők demo-adata (a DEMO-n nincs éves zárás folyamatban, nincs
  önellenőrzés és folyószámla-egyeztetés); a mellékállású / nyugdíjas járulékszöveg (Dávid K2).
- **Tulaj-döntések:** T4 (a megszűnt ügyfél éves zárása: `lemondottEvesZaras` most 'ki'), T3 (az iroda fizeti-e a hibájából
  eredő pótlékot – a mező kész), T6 (részletfizetés-szöveg KI).
- **Karbantartás:** új MNB-kamatdöntésnél az `ado-motor/src/engine/potlek.ts` `BASE_RATES` táblát kézzel bővíteni (addig a pótlékot a
  NAV-kalkulátorból írja be a könyvelő).
