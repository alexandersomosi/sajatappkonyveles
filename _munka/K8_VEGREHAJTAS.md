# K8 – végrehajtási terv (2026-11-21, tervező; csak olvasás alapján)

Források: `_munka/K8_TERV.md`, `dizajn/C5_v2/` (NN_*.html/.png, `v2.css`, `v2.js`), `dizajn/C5_v2/asztali/` (A01–A80, `v2_asztali.css`),
`dizajn/email/` (`sablon.html`, `elemek.md`, `README.md`, `LEVEL_LEFEDETTSEG.md`), `dizajn/landing_v2_proba4/_eszkoz/epit.cjs` (KOZEPRE),
`_munka/HIANYLISTA_2026-11-21.md`, `_munka/KONYVELO_LEFEDETTSEG.md`. Minden útvonal a `C:/Users/UpgradePC/konyvelo_app/` mappától értendő.

Szerepek: **ALAP-B** (backend, fizetés, levelek, k7b-maradékok, az app és a panel minimális fizetési képernyői a MOSTANI stílusban),
**ALAP-D** (közös dizájn-alap: CSAK `kod/shared/v2/`), **FELÜLET-A** (`kod/app`: v2 minden képernyőn, gépes nézet, mozgás),
**FELÜLET-P** (`kod/panel`: könyvelői felület és konzol új kinézete), **INTEGRÁTOR** (SPEC, `kod/deploy/README.md`, telepítés, landing-szöveg).

---

## 0. Közös szabályok minden építőnek (a feladatleírásból, kötelező)

- **Semmit nem törlünk.** Módosítás előtt a régi fájl másolata: `kod/<csomag>/_regi/elotte_k8_<építő>/<eredeti útvonal>` (a meglévő
  `_regi/elotte_k7_b3/` mintájára). Fájlt „kivezetni” csak áthelyezéssel lehet.
- **Adatbázis:** csak hozzáadó migráció (`kod/backend/drizzle/0027_…`, `0028_…`; enum-bővítés külön fájlban, ahogy a 0022/0024
  is), meglévő sort nem írunk át – kivétel az új oszlop első feltöltése (pl. ügyfélszám). Soha nem újraseedelünk; a DEMO-adat
  idempotens adatlépéssel jön (`services/datastep-k8.ts`, a `datastep-k7b.ts` mintájára, `system_state['data.k8']`).
- **Fiókok:** alex@, tulaj@, a Google-os tesztfiók és minden demo belépő működjön (a TOTP-s fiókok is: lásd B7). A telepítés előtt/után
  `tulaj-fiokok-allapot.sh ment/hasonlit`.
- **Titok:** a `.env` értékeit senki nem olvassa; a kedvezményezett adatai a `kod/shared/brand.json` `provider` mezőiben vannak (nyilvános).
- **Szövegek:** tegező, rövid, magyaros; „a(z)” nélkül; nincs AI-említés; nincs kitalált szám/vélemény (a számok az API-ból jönnek);
  **nincs időígéret** – az egyetlen engedett mondat: „A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.”
  A mintákban lévő „kb. 3 perc”, „kb. 5 perc”, „Pár perc, és kész is vagy”, „Kollégánk 24–48 órán belül…”, „általában 1 munkanapon
  belül”, „kb. 20 perc múlva él” NEM kerül be (a jogszabályi határidők – „4 napon belül jóváhagyod”, „5 munkanapon belül” – maradnak,
  mert nem a mi ígéretünk). A `SZOVEG_JAVITASOK.md` tételei közül ami időt ígér, azt az időrész nélkül vesszük át.
- **Nincs nagy, halvány, „átlátszónak ható” pasztell doboz:** ahol a minta ilyet használ (`.seg` #EAF0FF „Ha elakadsz”, `.k.ossz`
  narancs-világos kártya, `.feltolto` #F8FAFF, nagy `.doboz.tipp/.info`), ott **tiszta fehér kártya + 4 px telt színes bal sáv /
  színes ikon**. Kis állapotcímke (`.cimke`) telt világos alapon maradhat. Ez szándékos eltérés a mintától – a jegyzetben jelölni.
- **Akadálymentesség marad:** fókusz látható (web: 2 px #1428DB körvonal, 2 px eltolás), minden vezérlőnek felirata/`accessibilityLabel`-e,
  a díszítő ikon rejtett (`aria-hidden`/`importantForAccessibility="no-hide-descendants"`), érintési cél ≥ 44 pt, szövegkontraszt ≥ 4,5:1.
  Figyelem: a v2 `--halvany` #8A93A8 fehéren csak 3,08:1 (`.nav` inaktív felirat, `.nap`) → szövegre a `#5B6478` (5,93:1) kell;
  a #8A93A8 / #9AA2B5 csak nem-szöveges elemre (ikon, nyíl) mehet.
- **Tesztek zöldek maradnak.** Ha egy elvárás a k8 miatt változik, a teszt mellé egysoros indoklás („k8: …, tulaj 11-20”).
- **Dokumentumot csak az INTEGRÁTOR ír** (`kod/SPEC.md`, `kod/deploy/README.md`). Az építők a saját jegyzetükbe írnak:
  `_munka/k8/B_jegyzet.md`, `D_jegyzet.md`, `A_jegyzet.md`, `P_jegyzet.md` (mit változtatott, SPEC-javaslat, nyitott kérdések).

---

## 1. Munkacsomagok – a K8_TERV minden tétele

### 1.0 Megfeleltetés: K8_TERV-tétel → csomag

| K8_TERV tétel | Csomag |
|---|---|
| Dizájn: kártyák, szürke háttér, kék gradiens fejléc | D2, A0–A1, P0–P4 |
| Felirat-logó (Poppins 800, sárga „zz”, lendület-vonal) | D6, A0, P1 |
| Sárga főgomb képernyőnként max. 1; Google-gomb színes „G” | D2/D4, A0–A1, P2 |
| Fluent Emoji Flat tartalmi ikonok, Material vezérlők, semleges csempe #F1F3F9, 34 px | D1, D3–D5, A0, P1 |
| Ikonok középre (KOZEPRE) | D1 |
| Színes alsó navigáció, aktívon kék felső csík + kék felirat | A0 (Fulsor), D2 tokenek |
| Szövegek (`SZOVEG_JAVITASOK.md`, 78 csere) | B0/B8 (shared, backend), A2 (app), P4 (panel) |
| Bekötés: kártya csak a nem kötelező visszahívás(-ajánlat) UTÁN, „a csapatunktól” | B5, B10 |
| Bérszámfejtés felárért, egyedi ajánlat | B8 (+B10 ajánlatkérés visszahívás-témával) |
| Kétlépcsős belépés e-mailes kóddal | B7 (+B10 app-képernyők) |
| „Megjelölöm, hogy félretettem” + „Ez csak jelölés…” | B8 (shared szöveg), A1 (51_felretesz) |
| Határidők: NAV-számlaszám + közlemény „Másolom” | B8 (DTO `payTo`), A1 (53_hataridok_b) |
| Fizetés: kártya VAGY átutalás, díjbekérő 8 nap | B1–B3, B10, B11 |
| Autokassza-egyeztetés, fizetett/vár/késik a vezérlőpultban | B3, B11 |
| Egyedi havi rendelésszám (ADZ-<ügyfélszám>-<év>-<hó>) | B1–B2 |
| Saját díjszámla-levél ZeptoMaillel, Számlázz `sendEmail=false` | B4, B6 |
| Késés: alapból nem áll le, emlékeztetők 1/4/8. nap, piros „késik”, kézi felfüggesztés, kapcsoló | B3, B11 |
| ÁSZF csak kártyát ismer → átutalás DEMO-n BE, élesben kapcsolóval KI | B3 (kapcsoló), I1/I2 (leírás) |
| Gépes nézet (bal menü, hős sáv, 2 oszlopos rács, kétpaneles nézetek, osztott belépő) | A4 (+ 3. fejezet) |
| Fotózás telefonon: Galéria + exponáló + „Fájl, PDF”, vaku a keret sarkában | A3 |
| Mozgás az appban (és gépen ugyanaz + hover, behúzás) | A5, A6 (+ 4. fejezet) |
| E-mail: minden levél az új sablonnal, „Adózz.hu” teljes link, munkatársi lábléc | B6 |
| Hiányzó levelek (LEVEL_LEFEDETTSEG 3. pont 14–21: JL) | B6 |
| Panel + tulaj konzol v2 kinézet (minták jóváhagyásra) | P0–P6 |
| k7b után nyitva: időígéretek (`tulaj1118.ts`, `bekotes.ts`), dupla kártyatörlés-levél, `app_szovegek.json`, régi szkriptek, 14/17/19. levél, új APK | B8, B9, B6, I3 (APK: opcionális) |
| Landing: `.bemutato-jegy` + hős aria-label vissza (ha a k8 él) | I4 |
| Landing: 3× „bankkártyával” → „kártyával vagy átutalással” | **NEM most** (csak ha élesben BE az átutalás, az ÁSZF után) |

**A k8-ból kimarad (szándékosan, indokkal):** új app-ikon/favicon (tulaj-döntés nyitott); „Bencével kötöd” → „velünk kötöd” (nyitott –
B8 csak egy tartalomkulcsba gyűjti, hogy egy helyen átírható legyen); plusz díjak és a 24–48 óra (nyitott, nem változik); árkedvezmény
30 napos előzetes értesítése (nyitott); a könyvelői „nagyobb hiányok” (helyettesítés, ÁFA, ÖVTJ, „Ma” nézet, negyedéves zárási tábla,
négy szem – Dávid válaszai után, k9); HIANYLISTA 1.9 (webes e-mail-tartalék push helyett) és 2.2 (azonnali jelzés a csapatnak) – nincs
a K8_TERV-ben; az iOS Google-kliens beállítása (Apple Team ID kell); a landing egyéb nyitott pontjai; landing-mozgás (a landinghoz most
csak az I4 nyúl). A két k7b-s könyvelői hiba (HIPA-jóváhagyás, éves határidő „kész”) **már javítva** (`backend/src/routes/acc.ts:1054`,
`panel/src/pages/acc/ugyfel/Ado.tsx:335`, `backend/src/services/flags.ts:179-183`) – nincs teendő.

---

### 1.1 ALAP-D – közös dizájn-alap (`kod/shared/v2/`, más fájlhoz NEM nyúl)

Elv: egy forrás, két célplatform. A platformfüggetlen rész (`*.ts`, React nélkül) RN-ben és webes Reactben is fordul; a komponensek
külön `rn/` (react-native + react-native-svg) és `web/` (React DOM) mappában vannak. A fogyasztók MÁSOLATOT kapnak (mint a
`kod/shared/scripts/sync-shared.mjs`), mert a Metro és a Vite a csomagon kívülre nem lát jól, és a `sync-shared.mjs` csak a `src/*.ts`-t viszi.

Célszerkezet:
```
kod/shared/v2/
  README.md            – exportok listája (a FELÜLET-A/P ebből dolgozik; a D végén FAGYASZTVA), használat, sync
  LICENCEK.md          – Fluent Emoji Flat (MIT, Microsoft), Material Icons (Apache-2.0), Poppins (OFL, csak a logóképben), Geist (OFL)
  tokenek.ts           – szín, sugár, térköz, árnyék, tipográfia, csempe, nav, mozgás-idők, töréspontok (React nélkül)
  ikon/nevek.ts        – EmojiNev (45), VezerloNev, NAV_IKONOK
  ikon/emoji-adat.ts   – GENERÁLT: {vb, elemek:[{t:'p',d,f,r?}|{t:'r',x,y,w,h,rx,f}]}; KOZEPRE már alkalmazva
  ikon/kozepre.ts      – a KOZEPRE-táblázat (igazolvany '0 5 32 32', kamera '0 4.5 32 32', emberek '0 2.96 32 32',
                         cimke '0.03 2.11 32 32', irat-toll '2.1 0 32 32') + forrás és mérőszkript megnevezése
  ikon/material.ts     – vezérlő-ikonok 24×24 path-jai + a színes Google „G” (4 path) + chev
  ikon/megfeleltetes.ts– régi 3D név → új emoji név (app `Ikon3dNev`, panel `Icon3dName`, app `TargykepNev`), javasolt csempeméret
  logo/                – logo.png, logo_feher.png (@1x/@2x/@3x), méretadatok
  rn/Ikon.tsx, rn/VezerloIkon.tsx, rn/Csempe.tsx, rn/Logo.tsx, rn/GoogleG.tsx
  web/Ikon.tsx, web/VezerloIkon.tsx, web/Csempe.tsx, web/Logo.tsx, web/GoogleG.tsx, web/v2.css
  scripts/gen-ikonok.mjs, scripts/gen-css.mjs, scripts/sync-v2.mjs
  tsconfig.rn.json, tsconfig.web.json
  teszt/v2.test.mjs
  minta/ikonok.html    – generált ikon-katalógus (szemrevételezéshez, csempében, 24/34/50 px)
```

**D1 – Ikon-generátor + KOZEPRE.** `scripts/gen-ikonok.mjs` a `dizajn/C5_v2/v2.js` `var EMOJI = …` sorát olvassa (ahogy az `epit.cjs`
8–11. sora), a 45 rajzot (csak `path` és `rect`, csak telt `fill`, `fill-rule`/`clip-rule` – ellenőrizve) adatszerkezetté alakítja,
a `ikon/kozepre.ts` szerint felülírja a viewBoxot, és megírja az `ikon/emoji-adat.ts`-t („GENERÁLT – kézzel ne írd” fejléccel).
Futásidőben NINCS XML-elemzés (`SvgXml` tilos – lassú listákban). *Elfogadás:* 45 kulcs; a KOZEPRE-ikonok viewBoxa a táblázat szerinti;
újrafuttatva bájtra azonos kimenet. *Teszt:* `teszt/v2.test.mjs` (kulcsszám, csak p/r elemek, KOZEPRE alkalmazva).

**D2 – Tokenek (`tokenek.ts`).** A `v2.css :root` + a `v2_asztali.css` értékei névvel: `szin` (kek #1428DB, kekVil #E6EBFF, kekIkon #1F3BE0,
sarga #FFC93C, sargaS #E9AE12, sotet #10152B, szoveg2 #2A3247, szurke #5B6478, `dekorHalvany` #8A93A8 (csak nem-szöveg), hatter
#F3F5FB, vonal #ECEFF6, keret #DCE2F0, csempe #F1F3F9, zold/zoldVil, narancs/narancsVil, piros/pirosVil, pont #EF3B3B, fejHalvany #D5DCFF,
fejGradiens [#1D35EC, #1428DB, #0F20BE] 160°), `sugar` (kartya 20 / asztalon 22, gomb 14, gombKis 999, mezo 14, csempe 13/11/20,
fejlec 26/24, hos 24), `arnyek` (kártya `0 1px 2px rgba(16,21,43,.04), 0 6px 20px rgba(16,21,43,.06)`, sárga gomb, nav, fejléc – mindegyik
`boxShadow` szövegként ÉS RN `shadow*`/`elevation` tartalékként), `tipo` (Geist; fejléc h1 27/800, kis 25, kártyacím 18.5/750, h3 16/700,
szöveg 15/1.45, szakaszcím 14/700 nagybetűs .04em, nagy szám 25/800, gomb 17/750, nav 13/600→750; asztali: hős h1 36 (1360 alatt 33),
oldalcím 28/800), `csempe` (42→34, kicsi 36→29, nagy 64→50), `nav` (ikon 28, csík 3 px, 20%-os behúzás), `mozgas` (rovid 200, alap 300,
hosszu 400 ms, benyomodas 0.97, easing [0.22,1,0.36,1]), `torespont` (asztali 1024, szelesAsztali 1360, mobilMax 480, tartalomMax 1120).
*Elfogadás:* minden szövegszín–háttér párra ≥ 4,5:1 (nagy szövegre ≥ 3:1), a #8A93A8 csak „dekor” néven érhető el. *Teszt:* WCAG-kontraszt
számítás a tesztben a felsorolt párokra (pl. szurke/hatter 5,44; feher/kek 8,91; sotet/sarga 11,74; zold/zoldVil 4,73).

**D3 – Ikon-építő.** `rn/Ikon.tsx`: `<Ikon nev pt label? />` → `react-native-svg` `Svg`+`Path`+`Rect`, `React.memo`, címke nélkül rejtett.
`rn/Csempe.tsx`: `<Csempe nev meret="kicsi|alap|nagy" />` (#F1F3F9, r 11/13/20). `web/Ikon.tsx` ugyanez `<svg aria-hidden focusable="false">`-lel,
`role="img"`+`aria-label`, ha van címke. Szürke változat (mezőben, fejléc háttérrajzán: `grayscale(1)`): RN-ben `szurke` prop, ami a
fill-eket egy szürkeskálás táblával cseréli (filter nincs RN-ben). *Elfogadás:* ugyanaz a név mindkét platformon ugyanazt rajzolja;
a csempében az ikon optikailag középen (KOZEPRE). *Teszt:* `tsc -p tsconfig.rn.json` és `-p tsconfig.web.json` hibátlan; a katalógus képe.

**D4 – Material vezérlő-ikonok (`ikon/material.ts`).** A `v2.js` `P` táblájából, ami nem emoji: vissza, bezar, plusz, kuld, letolt, szem,
pipa, kereses, gemkapocs, csillag, zaszlo + chev (saját) + google (színes); hozzá, ami a képernyőkhöz kell és hiányzik: masol
(content_copy – „Másolom” gombok), chev-le / chev-fel (lenyíló), kulso (open_in_new), frissit (refresh), szuro (filter_list), tobb
(more_horiz – konzol „Műveletek”). `VezerloIkon` színe `currentColor`/`szin` prop. *Elfogadás:* minden path érvényes 24×24; licenc a
`LICENCEK.md`-ben. *Teszt:* path-szintaxis ellenőrzés a tesztben.

**D5 – Megfeleltetés (`ikon/megfeleltetes.ts`).** Hogy a 86 app-beli `<Ikon3d>` és a 183 panelbeli `<I3>` hívás egy csapásra átálljon
(lásd A0, P1), egy táblázat: app `Ikon3dNev` (a `kod/app/src/theme/kepjegyzek.ts` kulcsai: befizetve, bevallas, boritek, dosszie, ertesites,
feltoltes, fiok, fooldal, fotozas, hataridok, igazolas, irat, kerdezek, kivonat, lakat, masolas, nyugta, nyugta_uj, ora, szamlak,
szamlaszam, szamolo, tepnaptar, uzenetek, *_arnyektalan, befizetve_jel) és panel `Icon3dName` (`kod/panel/src/ui/Icon3d.tsx`) → EmojiNev
(pl. fooldal→fooldal, dosszie→dosszie, fotozas→kamera, uzenetek→uzenet, fiok→fiok, hataridok/tepnaptar→naptar, igazolas→igazolvany,
irat→irat, nyugta→nyugta, szamlaszam→bank, szamolo→szamologep, ertesites→csengo, feltoltes→feltolt, boritek→level, bevallas→irat-toll,
befizetve/befizetve_jel→pipa-kor, ora→ora, lakat→lakat, kerdezek→buborek, kivonat→bank, szamlak→nyugta; masolas→VEZÉRLŐ masol).
A tárgyképek (`TargykepNev`: befizetve_pecset, dosszie_mappa, hatarido_naptar, level_boritek, meghatalmazas_alairva, ures_mappa, …) →
nagy csempe + emoji. *Elfogadás:* minden régi név lefedve (a teszt a két forrásfájl kulcslistáját a táblázattal veti össze – csak olvasás).

**D6 – Logó.** A felirat-logó képként (Poppins nem kell az appba): a `kod/landing/kepek/logo.png` és `logo_feher.png` (3×, 30 px-es betűre
vágva) átmásolva + @1x/@2x változat; `rn/Logo.tsx` (`Image`, `feher` prop, `meret` = betűméret px), `web/Logo.tsx` (`<img alt="Adózz.hu">`).
Ha élesebb kell: újragyártás a `dizajn/landing_v2_proba4/_eszkoz/logo_kep.cjs` módszerével, a kimenet a `kod/shared/v2/logo/` alá.
*Elfogadás:* 22–38 px-es megjelenítésnél éles (2×/3× kijelzőn is), `alt`/`accessibilityLabel` „Adózz.hu”.

**D7 – `web/v2.css`.** A `gen-css.mjs` a `tokenek.ts`-ből CSS-változókat ír (`--v2-kek` …) + néhány osztályt (`.v2-kartya`, `.v2-gomb`,
`.v2-gomb-masod`, `.v2-gomb-veszely`, `.v2-csempe`, `.v2-cimke-*`, `.v2-fokusz`). **Globális reset nincs** (a panel `app.css`-ét nem írhatja felül
nem várt módon). *Elfogadás:* a változók értéke = `tokenek.ts`.

**D8 – Sync, típusellenőrzés, tesztek, README.** `scripts/sync-v2.mjs <célmappa> --rn|--web`: a közös `*.ts` + `logo/` + a cél szerinti
`rn/` VAGY `web/` mappa másolása „GENERATED from kod/shared/v2” fejléccel (a `src/_shared/v2/` alá; a meglévő forrás-szkennelő tesztek
a `_shared` mappát kihagyják). `tsconfig.rn.json` / `tsconfig.web.json`: a `kod/app/node_modules`, ill. `kod/panel/node_modules` típusait
csak OLVASVA (paths/typeRoots); a közös rész a panel szigorú beállításaival is fordul (`noUnusedLocals`, `isolatedModules`).
*Teszt-parancs:* `node --test kod/shared/v2/teszt/` + a két `tsc --noEmit -p`. *Átadás:* `D_jegyzet.md` + a fagyasztott README (exportok).

---

### 1.2 ALAP-B – backend, fizetés, levelek, k7b-maradékok, minimális app/panel képernyők

**B0 – Előkészítés.** (a) `_munka/k8/szoveg_hely.md`: a `dizajn/C5_v2/SZOVEG_JAVITASOK.md` 78 tétele és az időígéretek helye grep-pel
szétválogatva: `kod/shared/src/*.ts` / `kod/backend/src/content/*` (→ B8 maga javítja) vs. `kod/app/src/**` (→ A2) vs. `kod/panel/src/**` (→ P4).
(b) A B-tulajdonú app/panel fájlok listája (lásd 2.3) a jegyzetbe, hogy a FELÜLET-ek ne nyúljanak hozzájuk a B vége előtt.

**B1 – Adatmodell (migráció 0027 enum, 0028 tábla/oszlop – csak hozzáadó).**
- `clients.customer_no integer UNIQUE` + szekvencia 10001-től; a meglévő ügyfelek feltöltése `created_at` sorrendben (csak az új oszlop).
  Új ügyfél a regisztrációkor kap számot (`services/registration.ts`).
- `subscriptions.billing_method text NOT NULL DEFAULT 'kartya'` (`'kartya' | 'atutalas'`).
- Új tábla `transfer_requests` (díjbekérő): id, client_id, subscription_id, kind (`elso_havi|havi|egyszeri`), period_start, period_end,
  amount_huf, order_no (UNIQUE), kozlemeny, proforma_number, proforma_pdf_file_id, issued_on, due_on, status
  (`kiallitva|fizetve|kesik|visszavonva|hiba`), paid_on, paid_amount_huf, paid_source (`autokassza|kezi|demo`), payment_id, last_checked_at,
  reminders_sent jsonb, mode (`demo|teszt|eles`), created_at.
- `demo_outbox.body_html text NULL` (a DEMO-postafiókban látszódjon az új levél).
- `users.mfa_email_enabled_at timestamptz NULL` (B7).
- `payments.provider` szöveg – `'atutalas'` érték csak TS-típusbővítés (`backend/src/db/schema.ts:1991`), nem DB-enum.
- Ha a szolgáltatás-zárolás oka pgEnum: `atutalas_kesik` érték a 0027-ben.
*Elfogadás:* `drizzle/meta` frissítve; PGlite-on minden migráció lefut; régi kód az új oszlopokat figyelmen kívül hagyja.
*Teszt:* `test/k8-ugyfelszam.test.ts` (egyedi, folytonos, új ügyfél következő számot kap).

**B2 – Díjbekérő kiállítása.** Új fájlok: `backend/src/payments/dijbekero.ts` (XML), `backend/src/services/atutalas.ts` (folyamat),
`backend/src/jobs-k8.ts` (ütemezés; a `jobs.ts`/`worker.ts` csak egy import + regisztráció sort kap), `backend/src/content/k8.ts` (szövegek,
`/admin/szovegek` alatt szerkeszthetők), `kod/shared/src/k8.ts` (DTO-k, címkék, formátumfüggvények – a `sync-shared.mjs` magától viszi).
- XML a `buildInvoiceXml` (`payments/szamlazzhu.ts:101`) mintájára: `dijbekero=true`, `rendelesSzam = szamlaKulsoAzon = order_no`,
  `fizetesiHataridoDatum = kelt + 8 nap`, fizetési mód átutalás, `sendEmail=false`, megjegyzés: „Közlemény: ADZ-10482”.
- **Rendelésszám (havonta egyedi, a „Rendelésszám ismétlődés tiltása” miatt):** `ADZ-<ügyfélszám>-<ÉÉÉÉ>-<HH>` (a HH az időszak kezdő
  hónapja), újrakiállításnál `-2`, `-3`. **Közlemény (állandó, az állandó átutaláshoz):** `ADZ-<ügyfélszám>` (a 85_elofizetes_b szerint;
  a formátum tulaj-kérdés, egy függvényben: `kozlemenyOf()` a `shared/src/k8.ts`-ben).
- Időzítés: az első díjbekérő azonnal, amikor az ügyfél a bekötésben az átutalást választja; utána minden új előfizetési időszak első napján
  (ugyanazon a napi futáson, amikor a kártyát terhelnénk – az időszak évfordulós, pl. 11. 20. – 12. 19., ezért a szöveg NEM „minden hónap
  elején”, hanem „minden hónapban, az időszakod első napján”).
- DEMO (`INVOICE_MODE=demo`): helyi PDF „DÍJBEKÉRŐ – DEMO” felirattal (a `demoFeeInvoiceProvider` mintájára, `payments/invoices.ts:59`).
- Levél (új sablon, 04_dijbekero_atutalas minta): összeg, számlaszám (brand.json), közlemény, határidő, PDF csatolva, gomb
  „Megnézem az utalási adatokat”.
*Elfogadás:* XML a `test/fixtures/szamlazz/xmlszamla.xsd` szerint érvényes; ugyanarra az időszakra nem készül két díjbekérő (egyedi kulcs);
DEMO-n nem megy ki semmi. *Teszt:* `test/k8-dijbekero.test.ts`.

**B3 – Autokassza-egyeztetés, aktiválás, késés, kapcsolók.**
- `jobTransferReconcile` (munkanapokon néhány óránként): a nyitott díjbekérőket a `buildQueryXml` (`szamlazzhu.ts:177`,
  `action-szamla_agent_xml`, `rendelesSzam` alapján) kérdezi le; ha fizetett → `applyTransferPaid(transferId, {paidOn, amount, source})`.
  **Ellenőrizendő (ALAP-B, a Számlázz teszt fiókján, a `k29-elo-teszt` mintájára, kulcs nélkül kihagyva):** a válasz melyik mezője mutatja a
  díjbekérő kifizetését; az Autokassza a fix közleményű (`ADZ-10482`) állandó átutalást a havonta más rendelésszámú díjbekérőhöz párosítja-e
  (összeg + küldő bankszámla alapján). Ha nem: a közlemény formátumát kell igazítani (tulaj-kérdés), addig a kézi jelölés a tartalék.
- `applyTransferPaid` egy tranzakcióban: `payments` sor (`provider 'atutalas'`, `status 'sikeres'`, `kind 'elso_havi'|'havi'`), időszak
  (első fizetésnél az időszak a beérkezés napjától indul – nincs ingyenes nap), majd UGYANAZ a folytatás, mint a sikeres kártyás
  fizetésnél (`services/payments.ts:737 applyPaymentSucceeded` utófeladatai kiemelve egy közös segédbe; a kártyás viselkedés bájtra
  ugyanaz marad): előfizetés aktív, bekötés `elofizetes` → kész, `checkCompletion`, végszámla sorba állítva.
- Végszámla: a meglévő `queueFeeInvoice`/`processInvoice` (`payments/invoices.ts:129, :238`) a payment-sor kulcsával (`invoiceKeyFor`,
  `ADZ-<20 hex>`), `dijbekeroSzamlaszam = proforma_number`, `fizetve=true`, `sendEmail=false`; utána saját levél (B4).
- Kézi jelölés (éles tartalék és DEMO-próba): konzol „Beérkezett, rögzítem” (dátum, összeg, ok, step-up) → `applyTransferPaid(source:'kezi')`.
  DEMO-n az e-mail-forgatókönyv (`utal+…@` cím) a következő futáskor fizetettnek veszi, mint a kártyás `fail+…` (`provider.ts`, `demoScenario`).
- Késés: határidő után 1., 4., 8. nap emlékeztető (levél + push + app), egyszer-egyszer (dedupe kulcs `transfer:<id>:<nap>`); a díjbekérő
  `kesik` a határidő utáni naptól; **alapból a könyvelés NEM áll le.** Kapcsoló `kesesLeallit` (alap KI): ha BE, a 8. napon a meglévő
  szolgáltatás-zárolás (`services/zarolas.ts`) `atutalas_kesik` okkal. Kézi felfüggesztés: a meglévő `setManualLock`
  (`services/konzol-muveletek.ts:323`) előtöltött okkal („Átutalás késik”).
- **Kapcsolók:** `system_state['kapcsolok.fizetes'] = { atutalas, kesesLeallit }`, a `evesKapcsolok` (`services/kata.ts:52`) mintájára
  összefésülve; alapérték: `atutalas = (APP_ENV === 'demo')`, `kesesLeallit = false`. A `/config` válasz kapja: `fizetes.atutalas`.
  KI állásban az átutalás indítása 409 `atutalas_kikapcsolva`; a már átutalással fizetők díjbekérője tovább megy (senkit nem hagyunk el).
  Konzolból kapcsolható (B11), step-up + napló + figyelmeztető szöveg: „Élesben csak az ÁSZF frissítése után kapcsold be.”
- Lemondásnál az időszak vége után nincs új díjbekérő; a nyitott marad.
*Elfogadás:* első utalás → aktív ügyfél; késésnél csak emlékeztető (kapcsoló KI); a konzol fizetett/vár/késik számai egyeznek a táblával.
*Teszt:* `test/k8-atutalas.test.ts` (fizetett-egyeztetés → payment + számla `dijbekeroSzamlaszam`-mal és `sendEmail=false`-szal; aktiválás;
emlékeztetők pontosan 1/4/8. napon és egyszer; kapcsoló KI élesben → 409; DEMO-n BE; `kesesLeallit` BE → zárolás; kézi jelölés step-up-pal).

**B4 – Saját díjszámla-levél minden számlánál.** `processInvoice`: `sendEmail=false` a kártyás számlákon is; a `kiallitva` után saját levél
(03_dijszamla minta: „Szia, Zoé! Elkészült a havidíjad számlája (2026. 11. 20. – 12. 19.).”, PDF csatolva, gomb „Letöltöm a számlát”).
A `emailTargy/emailSzoveg` (`invoices.ts:319-320`, `content/k29.ts`) a Számlázz-ban marad (nem megy ki), a szöveg a saját levélbe költözik.
A storno/helyesbítő ugyanígy. Az app „A számlát a Számlázz.hu e-mailben is elküldi.” mondata (84_dijszamlak) → „A számlát e-mailben is
elküldjük.” (shared/k29 szöveg, B8). *Teszt:* `test/k29-szamlazz.test.ts` elvárása `sendEmail: true` → `false` (indok: K8_TERV:22).

**B5 – Kártya csak a visszahívás-ajánlat után.** `kod/shared/src/enums.ts` `JOURNEY_ORDER.van` és `.inditas_onallo`: `'visszahivas'` sor
közvetlenül az `'elofizetes'` elé; a `JOURNEY_NOT_REQUIRED_FOR_ACTIVATION` és `JOURNEY_NOT_COUNTED` ezekben az utakban tartalmazza
(a `inditas_segitett` meglévő viselkedése nem változik). `kod/shared/src/k29g.ts` `GUIDED_ORDER.van` / `.inditas_onallo`: új vezetett
lépés `'visszahivas'` az `'elofizetes'` előtt, saját képernyővel (`GUIDED_STEP_ROUTES.visszahivas = '/bekotes/visszahivas-ajanlat'`).
Backend: `services/journey.ts` / `services/guided.ts` / `services/onboarding.ts` – új zár `bekotes.zarolt.elofizetes_visszahivas_utan`,
amíg az ügyfélnek nyitott (`CALLBACK_OPEN_STATUSES`: uj, folyamatban) visszahívása van; bármely lezárt állapot (teljesitve, sikertelen,
visszavonva, lezarva) feloldja. „Nem kell, mehetünk tovább” → a lépés kihagyva, az előfizetés nyitva. A lépés-időszövegek (`timeText`,
`bekotes.ts:1524-…` „kb. 3 perc”) üresek. *Teszt:* `test/k8-bekotes.test.ts`; az app `tests/k7.test.ts:60-64` relatív sorrend-ellenőrzése
változatlanul zöld (csak beszúrás).

**B6 – Levelek: új sablon mindenre + JL-levelek.**
- `backend/src/notify/sablon.ts`: a `dizajn/email/sablon.html` másolata konstansként (a Docker-képbe így bekerül) + renderelő:
  `{{elonezet}} {{cim}} {{tartalom}} {{#gomb}} {{#link}} {{lablec_ok}}`, a blokkok az `elemek.md` szerint (p, kicsi, kod, kv, tipp, info, link, a,
  egyben – a tipp/info a sablonban is fehér alapon bal sávval, ha a levélben is kerülni akarjuk a nagy pasztellt; ha az `epit_peldak.cjs`
  világos alapját tartjuk, az a levélben kicsi és jóváhagyott – döntés a B-jegyzetbe), `esc()` mindenre, `ty()` magyar tipográfia,
  **„Adózz.hu” utólagos csere teljes, kifejezett linkre** (`<a href="https://adozz.hu" style="color:inherit;text-decoration:none">Adózz.hu</a>`;
  meglévő `<a>`-n belül nem), max. 1 gomb.
- `notify/mailer.ts`: `send()` új, nem kötelező mezője `level` (szerkezett tartalom); ha nincs, a szöveges levél bekezdésekből épül
  ugyanebbe a sablonba (így MINDEN levél új kinézetű, a `htmlOf` marad exportálva, de nem használjuk). A `text/plain` rész változatlan,
  a tárgyak változatlanok. DEMO: `body_html` is mentődik.
- A hat mintalevél szerkezett tartalommal: belépési/megerősítő kód (`notify.ts:322 sendCodeEmail`), jelszó-visszaállítás, díjszámla (B4),
  díjbekérő (B2), határidő-emlékeztető (`jobs.ts` adóhatáridők), visszahívás-visszaigazolás (`services/callbacks.ts`).
- Lábléc-változatok: ügyfél („…mert az Adózz.hu-n van fiókod.”), munkatárs (könyvelő/admin/csapat), fiók nélküli (regisztráció előtt).
- `dispatchPending` (`notify.ts:444`): a levél végére fűzött link gomb lesz (`email.<kulcs>.gomb` szöveg, ha van; különben link).
- Hiányzó JL-levelek (`LEVEL_LEFEDETTSEG.md` 3. pont): 14 üdvözlő + első sikeres fizetés, 15 fiókzár, 16 „Folytasd, ahol abbahagytad”
  (`guided_continue` – most semmi nem küldi), 17 éves zárás határideje, 18 díj elengedve, 19 fiók letiltva/feloldva, 20–21 összesítő-sorok;
  szövegük a fájlban kész, „a(z)” és időígéret nélkül átnézve. A k7b 14/17/19-es szövegjavítás-tétele ezzel lezárul.
- Panel DEMO-postafiók: „Levél képe” link → új admin végpont `GET /api/v1/admin/demo-outbox/:id/html` (csak DEMO, csak admin), válasz
  saját szigorú CSP-vel (`default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; frame-ancestors 'none'`), új lapon
  (a panel CSP-je `frame-src 'none'`, ezért nem iframe).
*Elfogadás:* minden sablonkulcs renderel; a HTML-ben az „Adózz.hu” mindig `<a href="https://adozz.hu"`-n belül; felhasználói adat
escape-elve; Outlook-gomb (VML) megmarad. *Teszt:* `test/k8-levelek.test.ts` (az összes `email.*` kulcs renderelése, link-szabály,
escape, egy gomb, `body_html` a demo_outboxban); a `k7b-levelek.test.ts` és `kor3.test.ts` változatlanul zöld.
*Valódi kliens-próba* (Outlook, Gmail, Apple Mail) csak a tulaj kifejezett engedélyével, ZeptoMailen át (a szerver MAIL_MODE=demo).

**B7 – Kétlépcsős belépés e-mailes kóddal (ügyfél).** `routes/auth.ts`: új út az ügyfeleknek – beállítás (`/auth/mfa-email/setup`, kód
a címre), bekapcsolás kóddal, kikapcsolás jelszóval/kóddal, belépéskor `mfa_required` → `/auth/login/email-code` (+ újraküldés,
10 perc érvény, ráta-korlát a meglévő kódtábla és `sendCodeEmail` mintájára). Hitelesítő app és tartalékkód az ügyfélnek nem kínált;
**akinek már be van kapcsolva a TOTP, annál tovább működik** (a tulaj fiókjai miatt is), a munkatársak TOTP-je (`STAFF_TOTP_REQUIRED`)
változatlan. „Nem férek hozzá az e-mailemhez” → ügyfélszolgálati út (mailto + szöveg). *Teszt:* `test/k8-mfa-email.test.ts` + a meglévő
`auth.test.ts` zöld.

**B8 – Termékszövegek és adat a shared/backend oldalon.** `kod/shared/src/bekotes.ts`: `ringMark: 'Félretettem…'` → „Megjelölöm, hogy
félretettem”, alá „Ez csak jelölés: pénzt nem vonunk le, nem utalunk.”; időígéretek ki (`bekotes.ts:412, :459, :499, :506, :767-773, :1016,
:1152, :1524-…`), a visszahívásos mondatok az egyetlen engedett mondatra; `backend/src/content/tulaj1118.ts:11, :71, :75` ugyanígy;
bérszámfejtés: „felárért vállaljuk, egyedi ajánlatot adunk” (a „Bérszámfejtést most nem vállalunk” helyett – `bekotes.ts:300` körül,
`k29f.ts:557`), ajánlatkérés visszahívás-témával (`CALLBACK_TOPICS` + `'berszamfejtes'`); „Bencével kötöd” egy tartalomkulcsba
(`szerzodes.felek`), hogy a tulaj döntése után egy helyen átírható legyen; `Deadline` DTO (`shared/src/api.ts:434`) új, nem kötelező
`payTo?: {label, accountNo, kozlemeny}[]` mező a befizetési tételekhez (NAV-számlák az ado-motorból, közlemény = adószám); a
`SZOVEG_JAVITASOK.md` shared/backend része (B0 lista szerint; „Szia, Péter!” vesszővel – a díjszámla-levél is „Szia, Zoé!”); a fizetési
szövegek a kapcsolótól függenek („Fizethetsz kártyával vagy átutalással” csak `fizetes.atutalas` BE esetén). `kod/jogi/app_szovegek.json`
régi, a kód által felülírt szövegeinek egységesítése (k7b-maradék). A DEMO-n felülírt tartalomkulcsokat a telepítés előtt olvasva
ellenőrizni (az `ev_javitas` szerint most nincs).
*Teszt:* új backend-teszt a `RESPONSE_TIME_FORBIDDEN_PATTERNS` (`shared/src/enums.ts:1886`) bővített változatával a backend-tartalomra és a
shared szövegekre, fehérlistával (az engedett mondat, jogszabályi határidők); az app `tests/k6.test.ts:82` és a panel
`src/lib/szoveg.test.ts` zöld.

**B9 – k7b-maradékok.** Dupla kártyatörlés-levél (`services/subscription.ts:739 deleteCard`, `:717 notifyCardDeletedByAdmin`): egyszeri
jelzés feltételes frissítéssel / sorzárral; régi egyszeri szkriptek (`kod/app/scripts/_helyi_j1119.mjs`, `_helyi_j2.mjs`,
`kod/_qa/k5|k6|k7_integ_harness.mjs`) → `_regi/` (vagy az új regisztrációra igazítva, ha még kellenek); `kod/deploy/https-proba.sh` és
`kod/deploy/bongeszo-proba.mjs` SimplePay-része Stripe/DEMO-ra frissítve (a régi a `deploy/_regi/`-be). *Teszt:* párhuzamos
kártyatörlés → egy levél.

**B10 – App: minimális fizetési képernyők (funkcionálisan, a MOSTANI stílusban; a FELÜLET-A később v2-re hozza).**
`kod/app/src/app/bekotes/elofizetes.tsx` („Hogyan fizetnél?” Kártyával / Átutalással, ha `fizetes.atutalas`; átutalásnál magyarázat +
„Kérem a díjbekérőt” → utalási adatok „Másolom” gombokkal, `lib/vagolap.ts`), `kod/app/src/app/fiok/elofizetes.tsx` (mód, következő
díjbekérő, nyitott díjbekérő utalási adatokkal, „Átváltok kártyára” a meglévő kártyás úton / „Átváltok átutalásra” a következő időszaktól),
`kod/app/src/app/elofizetes/eredmeny.tsx` („Inkább átutalom” sikertelen kártyánál, ha BE), `kod/app/src/app/fiok/dijszamlak.tsx`
(díjbekérők a lista tetején, „Átutalásnál az utalás beérkezése után állítjuk ki.”), új `kod/app/src/app/bekotes/visszahivas-ajanlat.tsx`
(35_bekotes_idopont: „Beszélnél előbb velünk?” – Visszahívást kérek / Nem kell, mehetünk tovább; a régi `bekotes/idopont.tsx` átirányító
marad), `kod/app/src/app/fiok/ketlepcsos.tsx` és `(auth)/ketlepcsos.tsx` (e-mailes kód; TOTP-s fióknál a régi út), új
`kod/app/src/api/hooks-k8.ts`, minta-adat `kod/app/src/api/minta/k8.ts` (+ bekötés a `minta/szerver.ts`-be).
*Elfogadás:* telefonon és weben végigmegy (DEMO): átutalás választása → díjbekérő → kézi jelölés a konzolban → aktív.

**B11 – Panel/konzol minimális képernyők (mostani stílusban).** `kod/panel/src/pages/admin/konzol/Attekintes.tsx` (pénz-csempe: átutalás
fizetett / vár / késik, linkkel a szűrt listára), `konzol/Ugyfelek.tsx` (szűrő: fizetési mód, késik), `konzol/UgyfelKartya.tsx` („Díjbekérők”
szakasz: hó, rendelésszám, összeg, határidő, állapot piros „késik” címkével, utolsó lekérdezés; „Beérkezett, rögzítem”, „Újraküldöm”,
„Felfüggesztem” = `setManualLock` előtöltve), `pages/admin/Elofizetesek.tsx` (oszlop + szűrő: fizetési mód), `pages/admin/Rendszer.tsx`
(kapcsolók: „Átutalásos fizetés”, „Késésnél álljon le a könyvelés”, figyelmeztetéssel), `pages/admin/DemoPosta.tsx` („Levél képe”),
új `kod/panel/src/api/k8.ts` (+ mock: `src/mock/server.ts`). *Teszt:* `kod/panel/src/pages/admin/konzol/atutalas.test.tsx` (állapotcímkék,
a kézi jelölés okot és megerősítést kér).

**B12 – DEMO-adatlépés.** `services/datastep-k8.ts` (csak `APP_ENV=demo`, idempotens, `data.k8`): 1–2 SEEDELT demo ügyfélnél
(soha nem alex@/tulaj@/Google) átutalásos előfizetés egy fizetett és egy késő díjbekérővel, hogy a konzolban látszódjon a „késik”.

**B13 – Tesztek összesítve.** `cd kod/backend && npm test && npm run typecheck`; `cd kod/shared && npm run typecheck`; a B10/B11 után
`cd kod/app && npm test && npm run typecheck`, `cd kod/panel && npm test && npm run typecheck`. Átadás: `B_jegyzet.md` (új végpontok, DTO-k,
hook-nevek, kapcsolók, ellenőrizendő Számlázz-pontok eredménye).

---

### 1.3 FELÜLET-A – `kod/app` (v2 minden képernyőn, gépes nézet, mozgás)

**A0 – Bekötés a v2-be, „API marad, kinézet cserél” elv.**
- `kod/app/package.json` `shared` szkriptje: `… && node ../shared/v2/scripts/sync-v2.mjs src/_shared/v2 --rn` (így az `export:web` és
  a `start` is mindig friss másolatot kap).
- `src/theme/tokens.ts`: a `szin`/`forma`/`arnyek` kulcsnevei maradnak (180 fájl használja), az értékek a `_shared/v2/tokenek`-ből
  (alap → #F3F5FB, halvany → #5B6478, keret → #DCE2F0, hajszal → #ECEFF6 …) + új `v2` export.
- Primitívek átrajzolása, az aláírásuk változatlan: `src/ui/alap.tsx` (`Lap` → fehér kártya r20 + kártyaárnyék, 12 pt köz; `Szakasz` →
  nagybetűs 14/700 szakaszcím; `GombE` → sárga, r14, h52, sötét felirat; `GombM` → fehér keretes másodlagos; `GombSz` → kék aláhúzott
  link; `Cimke`/`Allapot` → v2 címkék; `Sor` → `lsor`/`hsor`; `Fejlec` → kék gradiens, alul 26-os kerekítés, a régi rozetta ki),
  `src/ui/keret.tsx` (`Kepernyo` szürke háttér, a C-féle `SAV` csíkok ki – `src/ui/teljes.tsx`; `Fulsor` v2: fehér, felül 22-es kerekítés,
  MINDEN ikon színes 28 pt, aktív = 3 pt kék felső csík + kék 750-es felirat, inaktív felirat #5B6478; `Dokk` v2), `src/ui/Mezo.tsx`,
  `src/ui/T.tsx`, `src/ui/kepek.tsx` (`Ikon3d` és `Targykep` belül a v2 `Ikon`/`Csempe`-t rajzolja a `megfeleltetes` szerint → a 86 hívás
  egyszerre vált; a `kepjegyzek.ts` import kikerül, a fájl marad).
*Elfogadás:* minden képernyő v2 alapkinézetű lesz, mielőtt egyenként finomítunk; typecheck zöld.

**A1 – Képernyők a mintákhoz (telefon, 390 pt).** Minden képernyő a megfelelő `dizajn/C5_v2/NN_*.html/.png` szerint; képernyőnként max.
1 sárga főgomb; tartalom-ikonok csempében; a pasztell-szabály (0. fejezet).

| Minta | Fájl (`kod/app/src/app/…`) |
|---|---|
| 01_fooldal, 50_fooldal_indulas, fooldal_v2 | `index.tsx` |
| 10, 11, 12, 13, 14 | `(auth)/belepes.tsx`, `regisztracio.tsx`, `jelszo-elfelejtve.tsx`, `jelszo-uj.tsx`, `ketlepcsos.tsx` (+ `kepernyok/AuthKeret.tsx`) |
| 15_email_megerosites, 16_nem_talalhato | `email-megerosites.tsx` (+ `(auth)/postafiok.tsx`), `+not-found.tsx` |
| 20, 21(_b), 22(_b), 23(_b), 24, 25 | `bevezeto/index.tsx`, `udv.tsx`, `ut.tsx`, `adoszam.tsx`, `var.tsx`, `kesz.tsx` (+ `kepernyok/Bevezeto.tsx`) |
| 30, 31, 32, 33 | `bekotes/index.tsx`, `adatok.tsx`, `alkalmazottak.tsx`, `azonositas.tsx` |
| 34(_b), 35, 36 | `bekotes/elofizetes.tsx`*, `bekotes/visszahivas-ajanlat.tsx`*, `bekotes/szerzodes.tsx` |
| 40(_b), 41 | `bekotes/meghatalmazas/index.tsx`, `jovahagyas.tsx` |
| 42(_b)–47 | `bekotes/vallalkozas/index.tsx`, `adatlap.tsx`, `engedely.tsx`, `feltoltes.tsx`, `kamara.tsx`, `utmutato.tsx` |
| 51, 52, 53(_b), 54, 55, 56, 57 | `felretesz.tsx`, `fizesd-ki.tsx`, `hataridok.tsx` + `fizetes/[id].tsx`, `kereset.tsx`, `kimutatas.tsx`, `ertesitesek.tsx`, `valtozott.tsx` |
| 60, 61, 62, 63, 64, 65 | `dosszie/index.tsx`, `dosszie/[honap]/szamlak.tsx`, `szamla/[id].tsx`, `tetel/[id].tsx`, `fotozas.tsx`, `feltoltes.tsx` |
| 66, 67, 68(_b) | `igazolas/index.tsx`, `igazolas/[id].tsx`, `igazolas/uj.tsx` |
| 70, 71(_b), 72, 73, 74, 75(_b), 76 | `uzenetek.tsx`, `visszahivas.tsx`, `gyik.tsx`, `helyettunk.tsx`, `keresek/index.tsx`, `keresek/uj.tsx`, `jogi/[tipus].tsx` |
| 80–88 | `fiok/index.tsx`, `adataim.tsx`, `biztonsag.tsx`, `dijak.tsx`*, `dijszamlak.tsx`*, `elofizetes.tsx`*, `ertesitesek.tsx`, `ketlepcsos.tsx`*, `torles.tsx` |
| 89(_b) | `elofizetes/eredmeny.tsx`* |
| 90–94 | `valtozas/index.tsx`, `engedely.tsx`, `[fajta]/index.tsx`, `[fajta]/kerem.tsx`, `[fajta]/utmutato.tsx` (+ `kepernyok/ValtozasUrlap.tsx`) |
| 95(_b), 96, 97, 98 | `eves-zaras/index.tsx` + `jovahagyas.tsx`, `eves-zaras/kerdoiv.tsx`, `kedvezmenyek/index.tsx`, `kedvezmenyek/kerdoiv.tsx` |
| minta nélkül (általános v2) | `onellenorzes/[id].tsx`, `kepernyok/kata.tsx`, `k28.tsx`, `k29f.tsx`, `Utmutato.tsx`, `ui/Visszahivas.tsx`, `ui/Zarolt.tsx` … |

`*` = B-tulajdonú fájl: csak a 2b fázisban (B vége után) nyúl hozzá az A. Google-gomb: hivatalos színes „G” (`GoogleG`).
*Teszt:* új `kod/app/tests/k8-v2.test.ts`: (1) a `megfeleltetes` minden `Ikon3dNev`-et lefed; (2) forrás-szkennelés: nincs „kb. \d+ perc”,
„Pár perc”, „Kollégánk 24–48”; a 24–48-as mondat csak szó szerint; (3) képernyőnként legfeljebb egy `GombE` (statikus számlálás,
indokolt kivétellistával a feltételes ágakra).

**A2 – Szövegek az app forrásában:** a `szoveg_hely.md` app-része (B0), a 0. fejezet szűrőjével. Ha shared-szöveg is kell →
`_munka/k8/szoveg_keres.md` (B rövid utókörben, vagy az integrátor).

**A3 – Fotózás (64_fotozas, `src/app/fotozas.tsx`).** Telefonon a kamera alatt egy sor: balra **Galéria** (`expo-image-picker`, több kép –
már van, `fotozas.tsx:149`), középen az exponáló, jobbra **„Fájl, PDF”** (`expo-document-picker` → ugyanaz az átnéző/feltöltő folyamat,
`lib/fajlok.ts iratFeltolt`); a vaku kapcsolója a keret sarkában. Ahol most a natív iratszkenner fut, ott az exponáló útja maradhat,
de a Galéria és a „Fájl, PDF” a v2 képernyőn mindig látszik (a végleges viselkedést képpel a tulajnak megmutatni). Gépen lásd 3. fejezet.
*Elfogadás:* mindhárom út feltölt (DEMO), a csökkentett mozgásnál villanás nélkül.

**A4 – Gépes nézet** – a 3. fejezet szerint.

**A5 – Mozgás** – a 4. fejezet szerint (`src/lib/mozgas.ts` bővítése + új `src/ui/mozgas/`).

**A6 – Helykitöltők (skeleton).** A `Betolt` (`src/ui/keret.tsx:540`, `ActivityIndicator`) helyett a fő képernyőkön (főoldal, dosszié,
üzenetek, határidők, fiók, bekötés) a kártyák alakját követő, ÁLLÓ szürke blokkok (#E9ECF4, nincs csillogás – „nincs folyamatos mozgás”),
a betöltött tartalom 200 ms-os áttűnéssel jön. A gombok saját töltésjelzője maradhat. `accessibilityLabel="Betöltjük…"`, `aria-busy`.

**A7 – Akadálymentesség, képek, tesztek.** Képernyőképek 390 és 1280/1440 pt-on a meglévő szkriptekkel (`scripts/kepek*.mjs`,
`?szelesseg=390`) → `kod/app/_kepek/k8/`, összevetés a mintákkal; billentyűs bejárás gépen (Tab-sorrend: ugrólink → menü → tartalom),
látható fókusz, `document.title` képernyőnként (`expo-router/head` – ellenőrizni web 'single' kimenettel); `cd kod/app && npm test &&
npm run typecheck && npm run export:web` (az `ellenoriz-dist.mjs` szerint a dist-ben nincs MINTA-név – a gépes könyvelő-kártya neve is
API-ból jön, soha nem beégetve).

---

### 1.4 FELÜLET-P – `kod/panel` (könyvelői felület + konzol; mozgás NINCS)

**P0 – Alap.** `kod/panel/package.json` `sync` szkriptje: `… && node ../shared/v2/scripts/sync-v2.mjs src/_shared/v2 --web`.
`src/styles/tokens.css`: a meglévő változónevek maradnak, értékük v2 (`--alap` #F3F5FB, `--halvany` #5B6478, `--keret` #DCE2F0, `--r-lap` 20 …),
új `--sarga` stb.; `src/main.tsx` importálja a `_shared/v2/web/v2.css`-t az `app.css` ELŐTT. `src/styles/app.css` v2-re igazítva (kártya,
gomb, mező, címke, tábla), a régi a `_regi/elotte_k8_P/`-be.
**P1 – Ikonok, logó, menüsáv.** `src/ui/Icon3d.tsx`: az `I3` aláírása marad, belül a v2 `Ikon` a `megfeleltetes` szerint → a 183 hívás
egyszerre vált (a `public/a/ikon3d` fájlok maradnak, csak nem hivatkozzuk). `src/ui/kozos.tsx` `Logo` → felirat-logó.
`src/layout/Shell.tsx`: egységes fehér bal menüsáv (logó, csoportcímek, Fluent ikonok 28 px, aktív = kék-világos alap + 4 px kék bal sáv,
számláló-jelvények), ugyanaz a nyelv, mint az app gépes menüje; billentyűvel bejárható, `aria-current="page"`.
**P2 – Gombok.** Fő gomb sárga (#FFC93C, sötét felirat), képernyőnként egy; másodlagos fehér keretes; veszély piros keretes; a „kapszula =
csak gomb” régi szabály helyett a v2 sugarak.
**P3 – Konzol** (`src/pages/admin/konzol/*`, `src/pages/admin/*`): kártyás csempék, táblák, a B11 átutalás-szakasz v2-ben (piros „késik”).
**P4 – Könyvelői oldalak** (`src/pages/acc/*`, `src/pages/acc/ugyfel/*`, `src/pages/csapat/*`, `src/pages/kozos/*`): kártyák, táblák; a
`szoveg_hely.md` panel-része.
**P5 – Belépés** (`BelepesOldal` az `App.tsx`-ben): v2 kártya + logó (az A10 osztott elrendezés mintájára, egyszerűsítve).
**P6 – Minták jóváhagyásra (KAPU, K8_TERV:40).** P0–P2 után 5 kép a mock-buildből (`npm run kepek` → `scripts/screenshots.mjs`):
ügyféllista, ügyfél-adatlap Adó fül, Határidő-figyelő, konzol áttekintés, konzol ügyfélkártya → `_munka/k8/panel_minta/`. A P3–P5 a tulaj
OK-ja után megy tovább. Ha az OK késik, a telepítés a B-állapotú panelt viszi (lásd 6. fejezet, `kod/panel/dist-k8b`).
**P7 – Tesztek.** `cd kod/panel && npm test && npm run typecheck && npm run build` (a `check-dist.mjs` is); a `hipa.test.tsx`,
`evesciklus.test.tsx`, `fiok.test.tsx`, `szoveg.test.ts`, `szovegek.test.ts` zöld (gombfelirat nem változik – ha mégis, indokolva);
új `src/layout/Shell.test.tsx` (aktív menüpont `aria-current`, ikon `aria-hidden`).

---

### 1.5 INTEGRÁTOR

**I1 – SPEC.** Új `## 33. k8` fejezet a jegyzetekből; a **§2.5–2.6 frissítése** (most: „C2 dizájn”, „No thin vector/line icons…
no material icons”, „16 realistic 3D PNG” – ez a v2-vel ellentétes: Fluent Emoji Flat + Material vezérlők, felirat-logó, sárga főgomb);
§2.2 (fizetés: Stripe-kártya vagy átutalás, kapcsolóval); §3.5 (mozgás- és kontrasztszabályok). **A kapcsoló leírása:** „Átutalás:
`system_state['kapcsolok.fizetes'].atutalas` – DEMO-n alapból BE, élesben alapból KI, amíg az ÁSZF (ügyvéd) nem ismeri az átutalást;
bekapcsolás a konzol Rendszer lapján vagy SQL-lel, `value ||` összefésüléssel.” **I2 – `kod/deploy/README.md`** k8-szakasz (lépések,
mentések, visszaállás, kapcsolók). **I3 – telepítés** (6. fejezet). **I4 – landing-szöveg** (6. fejezet 9. lépés). **I5** – a
`_munka/HIANYLISTA_2026-11-21.md` 1.10 és 2.16 tételének állapota a jegyzetbe (a fájlt a tulajnak szóló összefoglaló frissíti).

---

## 2. Sorrend, párhuzamosítás, fájl-tulajdon

### 2.1 Fázisok
```
F0  INTEGRÁTOR (rövid): _munka/k8/ létrehozása; a futó landing-színjavítás befejezésének ellenőrzése (nem nyúl hozzá)
F1  ALAP-B  ║  ALAP-D                          (párhuzamosan; közös fájljuk nincs)
F2a FELÜLET-A ║ FELÜLET-P   – az ALAP-D kész + README fagyasztva; csak a NEM B-tulajdonú fájlokon
F2b FELÜLET-A ║ FELÜLET-P   – az ALAP-B is kész; a B-tulajdonú app/panel fájlok v2-re hozása
F3  INTEGRÁTOR: teljes tesztsor, SPEC/README, telepítés, landing-szöveg
```
Ha egyszerűbb vezényelni: F2 egyben, mindkét ALAP után – ez lassabb, de ütközésmentes. A P6 kapu az F2a közepén van.

### 2.2 Átadási szerződések
- **D → A, P:** a `kod/shared/v2/README.md` export-listája az F1 végén fagyasztva. Ha az A vagy a P változást kér (új ikon, token),
  azt a `_munka/k8/v2_keres.md`-be írja; rövid D-utókör (vagy az integrátor) végzi, a felületek **soha nem írják** a `kod/shared/v2/`-t.
- **B → A, P:** a `B_jegyzet.md` tartalmazza az új végpontokat, DTO-kat (`shared/src/k8.ts`), hook-neveket (`api/hooks-k8.ts`), a
  `/config` `fizetes` mezőjét és a B-tulajdonú fájlok listáját. Shared-szöveg kérés: `_munka/k8/szoveg_keres.md`.

### 2.3 Ki melyik fájlt írhatja (egyszerre mindig csak egy építő)

| Terület | F1 | F2a | F2b |
|---|---|---|---|
| `kod/shared/v2/**` | D | – (olvas) | – (olvas) |
| `kod/shared/src/**`, `kod/shared/brand.json` (olvas) | B | – (olvas) | – (olvas) |
| `kod/backend/**` (src, drizzle, test), `kod/jogi/app_szovegek.json` | B | – | – |
| `kod/deploy/https-proba.sh`, `bongeszo-proba.mjs`, `kod/_qa/*harness*`, `kod/app/scripts/_helyi_j*` | B | – | – |
| App B-fájlok: `app/bekotes/elofizetes.tsx`, `app/bekotes/visszahivas-ajanlat.tsx`, `app/fiok/elofizetes.tsx`, `app/fiok/dijszamlak.tsx`, `app/fiok/dijak.tsx`, `app/fiok/ketlepcsos.tsx`, `app/(auth)/ketlepcsos.tsx`, `app/elofizetes/eredmeny.tsx`, `api/hooks-k8.ts`, `api/hooks-k29.ts`, `api/minta/k8.ts`, `api/minta/szerver.ts`, `lib/bevezeto.ts` | B | – | A |
| Minden más `kod/app/**` (theme, ui, lib, kepernyok, többi képernyő, `package.json`, tests) | – | A | A |
| Panel B-fájlok: `pages/admin/konzol/Attekintes.tsx`, `Ugyfelek.tsx`, `UgyfelKartya.tsx`, `pages/admin/Elofizetesek.tsx`, `Rendszer.tsx`, `DemoPosta.tsx`, `api/k8.ts`, `api/endpoints.ts`, `mock/server.ts` | B | – | P |
| Minden más `kod/panel/**` (styles, layout, ui, többi oldal, `package.json`) | – | P | P |
| `kod/landing/**` | – | – | – (csak F3, INTEGRÁTOR, I4) |
| `kod/SPEC.md`, `kod/deploy/README.md`, `kod/deploy/*.sh` (a fentieken kívül) | – | – | – (F3, INTEGRÁTOR) |
| `_munka/k8/<szerep>_jegyzet.md` | saját | saját | saját |

---

## 3. A gépes nézet felépítése (Expo Router, web)

**Mostani állapot:** a gyökér `kod/app/src/app/_layout.tsx` egy `Stack`-et ad; weben a `src/lib/webkeret.ts` `keretStilus`-a az egészet
max. 480 pt-ra szűkíti; a fülsort minden képernyő maga rajzolja (`Kepernyo ful=…` → `Fulsor`, `src/ui/keret.tsx:101`). Nincs `(tabs)` csoport.

**Töréspont és döntés:**
- `src/lib/elrendezes.ts` (új): `useAsztali()` = `Platform.OS === 'web' && szélesség ≥ 1024 && KERET_SZELESSEG === null` (a
  `?szelesseg=390` képernyőkép-paraméter mindig telefonos). `useSzelesAsztali()` = ≥ 1360. Natív (telefon, tablet) mindig telefonos.
- < 1024 (telefon, tablet, keskeny ablak): marad a mostani telefonos v2 elrendezés középen, max. 480 pt, alsó menüvel.
- ≥ 1024: bal menüsáv 232 pt (≥ 1360: 248 pt), tartalom 28/36 pt oldalmargóval, max. 1120 pt széles, középen.

**Gyökér-elrendezés (`_layout.tsx`):** a fa szerkezete MINDIG ugyanaz, hogy ablak-átméretezéskor a `Stack` ne mountolódjon újra (nem
vész el állapot): `<View row>{<Oldalsav lathato={…} />}<View flex:1><Stack …/></View></View>`; az `Oldalsav` rejtve `null`-t ad. A külső
`keretStilus` gépen 100% (a #CCD2E4 keret-háttér csak telefonos weben). Az oldalsáv látszik, ha `useAsztali() && allapot==='bent'` és a
szegmens NEM: `(auth)`, `bevezeto/*`, vezetett lépés (`?vezetett=`), `jogi`, `email-megerosites`, `+not-found`. Ugrólink „Ugrás a
tartalomra” (csak weben, fókuszra látszik).

**`src/ui/asztali/Oldalsav.tsx` (új):** logó (kék, 30 px) · menü: Főoldal, Dosszié, **Fotózás** (kamera ikon, felirat marad), Üzenetek,
Fiók – `accessibilityRole="link"`, `aria-current="page"` az aktívon (`useAktivFul`, `keret.tsx:648`), aktív = kék-világos alap + 4 pt kék
bal sáv, piros pötty az olvasatlannál; bekötés alatt a Főoldal a `/bekotes`-re visz (ugyanaz a logika, mint a `Fulsor`-ban – a
`useFulAllapot` + `nyitottDokumentumKeres` közös fájlba kerül: `src/ui/fulAllapot.ts`, mindkettő onnan olvas) · alul a könyvelő kis
kártyája (avatar, név az API-ból, „Visszahívást kérek” → `/visszahivas`).

**`Kepernyo` gépen (`src/ui/keret.tsx`):** nincs `Fulsor`; a `dokk` (fő gomb) a tartalom végén, a kártyában (nem fix alsó sáv); a
`fejlec` hős sávként jelenik meg (`Fejlec` `asztali` változat: lekerekített 24-es kék kártya a tartalomoszlop tetején, h1 36/33);
a görgetés csak a tartalomoszlopban.

**Rács és panelek (`src/ui/asztali/`):**
- `Racs.tsx`: telefonon egy oszlop (változatlan), gépen két oszlop (két `View` oszlop flexboxszal – nincs CSS grid az RN-stílusban),
  `Racs.Szeles` mindkét oszlopot foglalja; köz 22 pt.
- `KetPanel.tsx`: bal lista (340, ill. 1360 alatt 290 pt) + jobb részlet; a kiválasztás URL-paraméterben (`?honap=`, `?id=`), így
  a link megosztható és a vissza gomb működik; telefonon a meglévő külön útvonalak maradnak (`dosszie/[honap]/szamlak.tsx` stb.).
- **Mintás képernyők gépen:** A01 → `index.tsx` (hős + 2 oszlopos rács, „Félretenni” széles kártya két hasábbal), A30 → `bekotes/index.tsx`
  (lépéslista két hasábban 5/7 arányban), A53 → `hataridok.tsx` (lista + utalási adatok `utalas-racs`), A60 → `dosszie/index.tsx`
  (feltöltő sáv + hónaplista + havi tábla), A62 → `szamla/[id].tsx` (balra előnézet, jobbra adatok), A70 → `uzenetek.tsx` (bal blokkok:
  könyvelő, visszahívás, igazolás-kérések, GYIK; jobb: csevegés), A80 → `fiok/index.tsx` (két oszlopos szakaszok), A10 →
  `kepernyok/AuthKeret.tsx` + `(auth)/_layout.tsx` (osztott: bal kék márka-fél 3 előnnyel fehér csempében, jobb űrlap max. 460 pt;
  „Pár perc, és kész is vagy.” nélkül).
- **Minta nélküli képernyők gépen:** hős sáv + egy középre tett, max. 760 pt széles kártyaoszlop (olvasható, kockázatmentes).

**Gépre szabott viselkedés:** egér fölött a kártya megemelkedik és a gomb kiemelődik (4. fejezet); Fotózás gépen: `fotozas.tsx` web+asztali
ágon fájlfeltöltő oldal – szaggatott keretes feltöltő sáv (behúzással), „Fájl kiválasztása” (`expo-document-picker`), és ha van kamera,
„Fotó a webkamerával” (`expo-camera` weben); a behúzás (`dragover/drop`) csak weben, külön platformfájlban:
`src/ui/asztali/BehuzoSav.web.tsx` + üres natív párja (`BehuzoSav.tsx`) – a projekt már használja ezt a mintát (`ui/VideoLejatszo.web.tsx`).
**Fókusz és billentyű:** minden menüpont/gomb Tab-bal elérhető, látható fókuszgyűrű (`Pressable` `focused` állapot weben); `Escape`
bezárja az alsó lapot/párbeszédet.
*Elfogadás:* 1024, 1280, 1440 pt-on a nyolc minta szerint; 1023 pt-on telefonos; átméretezéskor nincs állapotvesztés; a képernyőolvasó
a menüt „Fő menü” navigációként olvassa. *Teszt:* `tests/k8-v2.test.ts` (töréspont-függvény tiszta logikája), képek 1280/1440-en.

---

## 4. Mozgások (csak az ügyfél-appban; panel és konzol: nincs)

Megvalósítás: React Native `Animated`, csak `transform` és `opacity`, `useNativeDriver: Platform.OS !== 'web'` (natívan a natív szálon fut,
weben ugyanaz a kód CSS-transzformként). **Nem** veszünk fel új natív függőséget (Reanimated, lottie-react-native): mindkettő új APK-t és
build-beállítást kérne, a kért mozgásokhoz az `Animated` elég; a konfetti saját, ~16 elemes `Animated`-komponens (lásd kockázatok).
Közös alap: `src/lib/mozgas.ts` bővítése – `useMozgasKi()` hook (a meglévő `mozgasKi()` + `AccessibilityInfo` `reduceMotionChanged`
figyelése; weben a `prefers-reduced-motion`; a `KEPERNYOKEP` mód mindig KI), időtartamok a `_shared/v2/tokenek` `mozgas` értékeiből.
Komponensek: `src/ui/mozgas/` (`Beuszo.tsx`, `PorgoOsszeg.tsx`, `ToltoCsik.tsx`, `Benyomodo.tsx`, `FelpattanoPipa.tsx`, `Konfetti.tsx`,
`Villanas.tsx`, `RepuloKep.tsx`, `Emelkedo.tsx`).

| # | Hol | Mit | Idő / görbe | Csökkentett mozgásnál |
|---|---|---|---|---|
| 1 | Főoldal (`index.tsx`), gépen is | kártyák egymás utáni beúszása: opacity 0→1, translateY 12→0 | 300 ms, 50 ms késleltetés kártyánként (max. 6), out-cubic; munkamenetenként egyszer | azonnal a helyén |
| 2 | Főoldal fő összeg | felpörgés 0-ról a végértékig (`PorgoOsszeg`) | 400 ms | azonnal a végérték |
| 3 | Haladás- és keretcsíkok (`ui/Mero.tsx`, bekötés `halad`) | feltöltődés: scaleX 0→arány, `transformOrigin: 'left'` | 400 ms | azonnal kitöltve |
| 4 | Minden gomb (`GombE`, `GombM`, csempés sor) | benyomódás: scale 1→0,97 | le 100 ms, fel 200 ms | nincs skála (a nyomott szín marad) |
| 5 | „Megjelölöm, hogy félretettem”, „Befizettem” | felpattanó zöld pipa: scale 0,6→1,08→1 + opacity | 350 ms (+ natívan siker-rezgés) | pipa animáció nélkül |
| 6 | Bekötés vége (`bevezeto/kesz.tsx`, `bekotes`), első sikeres fizetés (`elofizetes/eredmeny.tsx`) | rövid konfetti, egyszer | ≤ 1,2 s, egyszeri, nem ismétlődik | csak a statikus pipa |
| 7 | Fotózás (`fotozas.tsx`), telefon | villanás (fehér réteg opacity 0→0,85→0), majd a bélyegkép a Dosszié fül felé „repül” (scale 1→0,15 + translate + opacity) | 200 ms + 400 ms | nincs villanás, nincs repülés |
| 8 | Betöltés (A6) | álló helykitöltők, a tartalom áttűnéssel érkezik | 200 ms | áttűnés nélkül |
| 9 | Alsó sáv (`Fulsor`) | a kiválasztott fül ikonja picit megugrik (translateY 0→-3→0, scale 1→1,08→1); az új üzenet piros pöttye felpattan (scale 0→1,2→1) | 250 ms / 300 ms | nincs mozgás |
| 10 | Gép: kártya és sor egér fölött (`Emelkedo`) | translateY 0→-2 + egy második, erősebb árnyékréteg opacity 0→1 (az árnyékot nem animáljuk) | 200 ms | nincs emelés |
| 11 | Gép: gomb egér fölött | kiemelés: fedőréteg opacity 0→0,08 | 200 ms | azonnali színváltás |
| 12 | Gép: fájl behúzása (`BehuzoSav.web.tsx`) | a feltöltő sáv kivilágosodik: világoskék fedőréteg opacity 0→1 | 200 ms | azonnal |
| 13 | Gép: feltöltés után | az új fájl a listába „repül”: translateY -8→0 + opacity (a kamera-villanás helyett) | 300 ms | azonnal a listában |

Szabályok: 0,2–0,4 s; nincs folyamatos/ismétlődő mozgás. **Indokolt kivételek** (a jegyzetbe): a #4 lenyomása 100 ms (azonnali visszajelzés);
a #6 konfetti ≤ 1,2 s (a tulaj kérte, egyszeri); a #2 felpörgés szövegcsere (nem transform/opacity) – ezért egy kis, elszigetelt komponens,
táblázatos számjegyekkel (nincs elrendezés-ugrás), és a képernyőolvasó mindig a végértéket kapja (`accessibilityLabel`).
*Elfogadás:* gyenge Androidon (emulátor CPU-korláttal) és 4× lassított Chrome-on akadásmentes; csökkentett mozgásnál semmi nem mozog.
*Teszt:* `tests/k8-v2.test.ts` tiszta függvényekre (időtartam-tábla ≤ 400 ms a kivételeken kívül; `useMozgasKi` logika: KEPERNYOKEP → KI).

---

## 5. Kockázatok és kezelésük

| Kockázat | Hatás | Kezelés |
|---|---|---|
| **Expo web ↔ natív különbségek:** `boxShadow` (RN 0.88 + RN-web 0.21), `transformOrigin`, `Pressable` `hovered`/`focused` csak weben, CSS grid nincs az RN-stílusban, behúzás (drag&drop) csak DOM-on | eltérő kinézet/működés | a tokenekben `boxShadow` + `shadow*` tartalék; rács flexbox-oszlopokkal; hover/fókusz csak weben; `.web.tsx` platformfájlok; minden képernyőt 390-en ÉS 1280-on, natívan legalább a fő utakat Android-emulátoron nézni |
| **Natív kiadás:** a régi APK-val a regisztráció nem fejezhető be (k7b); a v2 natívan csak új APK-val látszik | a telefonos app régi marad | a webes app a fő csatorna; új APK opcionális lépés a tulaj döntésére (6. fejezet); új natív modult a k8 nem hoz be |
| **Másolatok elavulása** (`src/_shared/v2` nem frissül) | régi ikon/token a buildben | a sync az app `shared` és a panel `sync`/`prebuild` szkriptjébe kötve; az `export:web` és a `build` mindig futtatja |
| **Forrás-szkennelő tesztek** (időígéret, tiltott szóhasználat, díjmentes időszak: app `tests/k6.test.ts`, `k7.test.ts`, panel `szoveg.test.ts`) | piros teszt új szövegtől | az új szövegek a szabályok szerint; a `_shared` mappát a szkennerek kihagyják, ezért a v2-be felhasználói szöveg nem kerül |
| **Teljesítmény:** 45 SVG-ikon sok példányban (Dosszié-lista, fülsor), web-csomag +~70 KB nyers ikonadat | akadás gyenge telefonon | előre generált adat (nincs futásidejű XML-elemzés), `React.memo`; csak transform/opacity natív driverrel; árnyékot és színt nem animálunk; skeleton állóképként; a régi 3D PNG-k `require`-je kikerül a használatból, így a bundler nem viszi |
| **Kontraszt-regresszió** a v2 színeivel (#8A93A8 3,08:1) | AA-sértés | tokenteszt (D2); szövegre #5B6478; a sárga gombon sötét felirat (11,74:1) |
| **Pasztell-szabály vs. jóváhagyott minta** | tulaj-elégedetlenség | fehér kártya + telt bal sáv; az eltérés a képekkel együtt a jegyzetben |
| **Számlázz/Autokassza bizonytalanság:** a lekérdezés pontos mezője, a fix közleményű állandó átutalás párosítása, a rendelésszám-ismétlődés tiltása a díjbekérőn és a végszámlán | átutalás nem egyeztethető automatikusan | egyedi havi díjbekérő-kulcs, a végszámla saját (payment-) kulccsal; teszt-fiókos próba kulcs nélkül kihagyva; kézi „Beérkezett, rögzítem” mindig van; a DEMO-n (`INVOICE_MODE=demo`) valódi Autokassza nincs – ez élesítés előtti tulaj-teendő (Erste-kapcsolat) |
| **Jogi:** az ÁSZF csak kártyát ismer | jogvita élesben | kapcsoló: DEMO BE, élesben KI; minden „átutalás” szöveg és választó a kapcsolótól függ; a landing „bankkártyával” marad |
| **`payments.ts` (2108 sor) átalakítása** a közös sikeres-fizetés segédhez | kártyás regresszió | a kártyás út változatlan viselkedése: a `k29-payments`, `k7c2-fizetes`, `payments` tesztek zöldek; a kiemelés tisztán szerkezeti |
| **Levél-renderelés** (Outlook, Gmail `<style>` eldobás, sötét mód, „Adózz.hu” félig linkelése) | csúnya/hibás levél | a sablon táblázatos, inline; a link-szabály tesztje; valódi kliens-próba csak a tulaj engedélyével |
| **Migráció az élő DEMO-adatbázison** (ügyfélszám-feltöltés 38 ügyfélre) | adatprobléma | csak új oszlop/tábla; előtte kézi titkosított `pg_dump` + `pg_restore -l`; az `up.sh` saját mentése; visszaállás leírva |
| **Két építő ugyanabban a fájlban** | felülírás | 2.3 táblázat; kérésfájlok (`v2_keres.md`, `szoveg_keres.md`) |
| **A landing élő, épp színjavítás fut rajta** | ütköző szerkesztés | a landinghoz csak az F3 végén az integrátor nyúl, a fájlt frissen újraolvasva, csak a két mondatot és a tesztsort cseréli |
| **Panel-minták jóváhagyása késik** | csúszó telepítés | P6 kapu; tartalék: a B-állapotú panel buildje (`kod/panel/dist-k8b`) települ az app/backend k8-cal |

---

## 6. Telepítés sorrendje (INTEGRÁTOR, F3)

0. **Feltételek:** minden csomag tesztje zöld – `cd kod/backend && npm test && npm run typecheck`; `cd kod/shared && npm run typecheck`;
   `node --test kod/shared/v2/teszt/`; `cd kod/app && npm test && npm run typecheck`; `cd kod/panel && npm test && npm run typecheck &&
   npm run build`; `node --test kod/landing/meres.test.mjs`. A panel-minták tulaj-OK-ja (P6) megvan (különben 4b). A landing-színjavítás
   lezárult. Más telepítés nem fut.
1. **Állapotfelvétel:** `ssh appok-1 'bash -s' < kod/deploy/fiok-szamok.sh` (felhasználók / ügyfelek / migráció 26) és
   `ssh appok-1 'bash -s ment elotte_k8_<ts>' < kod/deploy/tulaj-fiokok-allapot.sh`.
2. **Kézi, titkosított mentés:** `backups/pg_dump_elotte_k8_<ts>.dump.gpg` + `pg_restore -l` próba (a k7b/marketing mintájára;
   README „Mentés és visszaállítás”).
3. **Build a gépen:** `cd kod/app && npm run export:web` (a `shared` szkript a v2-t is szinkronizálja; az `ellenoriz-dist.mjs` lefut);
   `cd kod/panel && npm run build`. A landingot itt NEM építjük újra.
4. **Feltöltés és indítás:** `bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'` – az `up.sh` saját mentést
   készít (`_regi/db_elotte_up_<idő>.dump.gpg`), lefuttatja a 0027–0028(+) migrációt, újraépíti az API-t és a workert, újralétrehozza a
   `kezjegy-web`-et (új app- és panel-build), frissíti a proxyt. Az új backend a régi APK-val is kompatibilis (csak hozzáadó API).
   4b. Ha a panel nincs jóváhagyva: a `dist` helyett a `kod/panel/dist-k8b` (a B vége után az integrátor által mentett build) megy fel.
5. **Utána, élőben (DEMO):** `hasonlit elotte_k8_<ts> utana_k8_<ts>` → VÁLTOZATLAN (fiókszámok, alex@, tulaj@, Google-os tesztfiók
   munkamenetei); mind a 8 cím 200/301 (`atallas.sh allapot`); API/worker/proxy/web napló 0 hiba; demo belépések (admin, könyvelő, csapat,
   ügyfelek) 200; `system_state` `kapcsolok.fizetes` → `atutalas` BE (DEMO-alapérték), `kesesLeallit` KI; az adatlépés `data.k8` lefutott.
6. **Élő próba:** új DEMO-regisztráció (kitalált cím, `is_test`, nem töröljük) → visszahívás-ajánlat → „Nem kell” → átutalás → díjbekérő-levél
   a DEMO-postafiókban (HTML-képpel) → konzol „Beérkezett, rögzítem” → díjszámla-levél + aktiválás + konfetti; konzol: fizetett/vár/késik
   (a B12 késő díjbekérője pirosan); kártyás út változatlanul (Stripe teszt); app 390 és 1280/1440 pt, csökkentett mozgással is; panel új
   kinézet; képek a `kod/_qa/eles_k8_1121/` alá.
7. **Worker-ütemezés:** a `jobTransferIssue`, `jobTransferReconcile`, `jobTransferReminders` regisztrálva (napló), DEMO-n a demo szolgáltatóval.
8. **Dokumentáció:** SPEC §33 + §2.2/§2.5/§2.6/§3.5, `kod/deploy/README.md` k8-szakasz – benne a kapcsoló leírása: **„Átutalás: DEMO-n BE;
   élesben KI, amíg az ügyvéd az ÁSZF-be fel nem veszi az átutalást (és vele a díjbekérőt, a 8 napos határidőt, a késés kezelését).
   Bekapcsolás: konzol → Rendszer → Átutalásos fizetés (step-up), vagy SQL a `system_state.value ||` összefésüléssel.”**
9. **Landing-szöveg visszaállítása** (csak ha a k8 él, és a színjavítás lezárult; a fájlt frissen újraolvasva):
   `kod/landing/oldal.sablon.html` 78. sor aria-label → „Az Adózz.hu app telefonon és gépen, böngészőben. A képek bemutató adatokkal
   készültek.” (a `_regi/elotte_elesites_javitas_20261121_1041/oldal.sablon.html:78` eredetije), 410. sor `.bemutato-jegy` → „Az app képei bemutató adatokkal készültek.”; `kod/landing/meres.test.mjs:156` az új mondatra;
   `node --test kod/landing/meres.test.mjs` → `node kod/landing/build.mjs` → `bash kod/deploy/landing-csere.sh` (csak a landing; README
   „Landing élesítése”), utána `https://adozz.hu/` 200, `/email/logo_feher@2x.png` 200, `/js/meres.js` 200. **A 3× „bankkártyával”
   (`oldal.sablon.html:186, :476, :604`, teszt `meres.test.mjs:155`) marad**, amíg élesben nincs BE az átutalás.
10. **Visszaállás, ha kell:** `_regi/db_elotte_up_<idő>.dump.gpg` (a régi kód az új oszlopokat/táblát nem olvassa); webes buildek
    `_regi/web_*`; forrás `_regi/src_*`; a landing `_regi/web_landing_<idő>`.
11. **Opcionális, csak tulaj-döntéssel:** új Android APK (`kod/app/android`, release build); valódi levélkliens-próba ZeptoMailen át.

---

## Függelék – nyitott tulaj-döntések és tulaj-teendők (a k8 nem dönti el)

- Késő átutalásnál álljon-e le a könyvelés (most: NEM; kapcsoló `kesesLeallit`).
- „ADZ-10482” közlemény formátuma (függ attól, hogy az Autokassza párosít-e így).
- „Bencével kötöd” → „velünk kötöd”; plusz díjak; 24–48 óra; árkedvezmény-visszavonás 30 napja; bérszámfejtés ára; új app-ikon/favicon.
- Tulaj-teendő: Erste-kapcsolat + Autokassza a Számlázz.hu-ban; Lark: `ertesites@adozz.hu` alias az `ugyfelszolgalat@` fiókon
  (a válaszlevelek most visszapattannak); ügyvéd: ÁSZF (átutalás, díjbekérő, 8 nap); az élesítés előtti valódi levélpróba engedélye.
