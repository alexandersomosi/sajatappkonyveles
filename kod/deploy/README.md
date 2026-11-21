# Kézjegy – telepítés az appok-1 szerverre (`kod/deploy`)

> **2026-11-20: A GARDOKO TÖRÖLVE (a tulaj kérésére, véglegesen).** Az `appok-api-1`, `appok-db-1`, az `appok_pgdata`
> kötet és a `/srv/appok` adatai lekerültek. **A Gardoko-health ellenőrzés MEGSZŰNT** – a
> `https://45-94-65-74.sslip.io/api/v1/health` hibája innentől NEM hiba, ne próbáld helyreállítani, és **NE indítsd
> újra az `appok` compose-t**.
> **2026-11-20 13:44 óta a nyilvános kapu az Adózz saját proxyja: `kezjegy-proxy`** (compose projekt `kezjegy-proxy`,
> `/srv/kezjegy/proxy/`, 80/443). Az `appok-caddy-1` leállítva (a takarítás lent). Telepítés előtt/után az **Adózz**
> címeit nézd: `adozz.hu`, `app.`/`konyvelo.`/`api.adozz.hu` és api/app/konyvelo …sslip.io → 200
> (`ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh allapot'`).
> **2026-11-21 00:04 óta a KÜLSŐ MENTÉS közvetlenül a szerverről megy a Hetzner Storage Boxra** (restic, óránként
> a 35. percben, `restic-mentes.sh`; a tulaj döntése 11-20) – lásd lent: „Külső mentés: restic a Storage Boxon”.
> A tulaj gépén át futó „Adozz mentes kulso” feladat KIKAPCSOLVA (Disabled, nem törölve).



## k8 – v2 kinézet, gépes nézet, átutalás díjbekérővel, új levélsablon (SPEC §34) – ÉLESÍTVE a DEMO-ra 2026-11-21 15:31–15:59

Ahogy ment:
```bash
ssh appok-1 'bash -s' < kod/deploy/fiok-szamok.sh                                    # 41 felhasználó / 38 ügyfél / migráció 27
ssh appok-1 'bash -s ment elotte_k8_20261121_152819' < kod/deploy/tulaj-fiokok-allapot.sh
# kézi, titkosított mentés: backups/pg_dump_elotte_k8_20261121_152819.dump.gpg (498 130 bájt; pg_restore -l: 593 sor)
cd kod/app && npm run export:web; cd kod/panel && npm run build                       # tesztek előtte: lent
bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'           # _regi/db_elotte_up_20261121_153427; migráció 27 → 29
ssh appok-1 'bash -s hasonlit elotte_k8_20261121_152819 utana_k8_20261121_153528' < kod/deploy/tulaj-fiokok-allapot.sh   # VÁLTOZATLAN
bash kod/deploy/feltolt.sh --web-only && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh' # panel: a „Késik” csempe sávja (_regi/db_elotte_up_20261121_154950)
bash kod/deploy/feltolt.sh --web-only && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh' # app: a gépes Dosszié üres bal oszlopa (_regi/db_elotte_up_20261121_155812)
# landing: a bemutató alatti jegy és a hős aria-labelje vissza „Az app képei bemutató adatokkal készültek.”-re (a gépes nézet él)
node kod/landing/build.mjs && node --test kod/landing/meres.test.mjs                  # 7/7
# …a landing-csere.sh fejében lévő csomagolás → ssh appok-1 "bash -s" < kod/deploy/landing-csere.sh   (TS=20261121_155059)
```
- **Migrációk:** `0027_k8_enumok.sql` (értesítés-fajták `transfer_request`, `transfer_reminder`), `0028_k8.sql`
  (`clients.customer_no` szekvenciával 10001-től – az egyetlen írás meglévő sorba: 40 ügyfél 10001–10040; `subscriptions.billing_method`;
  új `transfer_requests` tábla; `demo_outbox.body_html`; `users.mfa_email_enabled_at` – még nem használt). Csak hozzáadó.
- **Adatlépések (worker, egyszer):** `data.k8` `{clients: 2, transfers: 3}` (két kitalált, belépés nélküli átutalós ügyfél: Utaló Péter
  fizetett, Átutaló Ágnes késik); `data.k8_szoveg` `{faq: 3, content: 0, faqKept: 0}` (3 GYIK-válasz időígéret nélkül, csak ahol az élő
  sor még szó szerint a régi szöveg volt).
- **Kapcsolók (`system_state['kapcsolok.fizetes']`, sor nincs → a kód alapértéke):** `atutalas` = **BE a DEMO-n** (APP_ENV=demo),
  **élesben KI**, amíg az ügyvéd az ÁSZF-be fel nem veszi az átutalást (és vele a díjbekérőt, a 8 napos határidőt, a késés kezelését);
  `kesesLeallit` = KI (nyitott tulaj-döntés); `kozlemeny` = `havi`. Bekapcsolás: konzol → Rendszer → „Átutalásos fizetés” (step-up),
  vagy `insert into system_state(key, value) values ('kapcsolok.fizetes', '{"atutalas": true}') on conflict (key) do update set value = system_state.value || excluded.value;`
  A `.env` nem változott (a kapcsolók az adatbázisban vannak).
- **Új jobok:** `transfer_issue` (06:30), `transfer_reconcile` (munkanapokon 2 óránként; a hibás díjbekérőt is újrapróbálja),
  `transfer_reminders` (09:30; a lemondott / megszűnt ügyfél nyitott díjbekérőjét visszavonja), `guided_continue` (11:00).
- **Utána (élőben):** mind a 8 cím 200/301; API/worker/proxy napló 0 figyelmeztetés/hiba; mind a 20 demo belépés 200; alex@ és tulaj@
  VÁLTOZATLAN; a Google-os tesztfiók aktív, 7 élő munkamenet, nem változott; `backup.sh` 15:05, restic 15:35 OK (a cron-sorok és a két
  szkript hash-e változatlan); `/config` → `fizetes.atutalas: true`. Élő DEMO-próba új, kitalált ügyféllel (`k8.atutalas.<idő>@demo.kezjegy.test`,
  `utm_source=qa_k8` → `is_test`; nem töröltük): regisztráció → kód a DEMO-postafiókból → adatok + szerződés → „Átutalással fizetek” →
  díjbekérő `ADZ-10044-2026-11` / `DEMO-D-2026-000004`, határidő +8 nap, a levél az új sablonnal a DEMO-postafiókban (HTML-kép:
  `kod/_qa/eles_k8_1121/level_dijbekero_*.png`). Három félbehagyott próba-regisztráció (`k8.atutalas.2026112114{40,41,43}@…`) is maradt
  (`is_test`, nem töröltük). Képek: `kod/_qa/eles_k8_1121/` (app telefon + gép, panel könyvelő + tulaj, a konzol mock-képei `panel_mock/`).
- **A konzol a DEMO admin fiókkal nem nyílik meg** (`mfa_setup_required`: a konzolhoz TOTP kell, a demo adminnak nincs). Ha a tulaj a
  DEMO-n ki akarja próbálni: panel → Beállítások → kétlépcsős belépés bekapcsolása a saját admin fiókján.
- **Visszaállás:** `_regi/db_elotte_up_20261121_153427.dump.gpg` (a 0027/0028 csak hozzáad; a régi kód az új oszlopokat/táblát nem
  olvassa); a k8 előtti webes buildek `_regi/web_{app,panel,landing}_20261121_153148`, a k8 előtti forrás `_regi/src_20261121_153148`; a landing a szövegcsere előtt `_regi/landing_elotte_20261121_155059`.
- **Új APK kell** a v2 kinézethez a telefonon (és a k7b óta a regisztrációhoz is). **[TULAJ] EAS-szel, a saját Expo-fiókoddal** (mi
  nem indítjuk): 1) `npm i -g eas-cli` és `eas login`; 2) `cd kod/app`, a `app.config.ts`-ben `version` 1.0.8, `android.versionCode` 9;
  3) `npx eas build:configure` (létrehozza az `eas.json`-t; profil: `preview`, `"android": {"buildType": "apk"}`, `"env": {"EXPO_PUBLIC_API_URL":
  "https://api.adozz.hu/api/v1"}`); 4) `npm run shared && npx eas build -p android --profile preview`; 5) a kész APK linkjét a telefonon
  megnyitva telepíted (a régi fölé, ha ugyanaz a kulcs – az EAS saját kulcsa más, mint a helyi debug-kulcs, ezért az első EAS-APK előtt a
  régit le kell törölni a telefonról). A helyi út (`apk/build-apk.sh`, debug-kulcs) továbbra is megvan.


## Éves ciklus + KATA javító kör (SPEC §32.C) – ÉLESÍTVE a DEMO-ra 2026-11-21 04:56–05:11 (F0 + F1a + F2/F3 + javítások együtt)

Ahogy ment:
```bash
ssh appok-1 'bash -s' < kod/deploy/fiok-szamok.sh                                    # 41 felhasználó / 38 ügyfél / migráció 22
ssh appok-1 'bash -s ment elotte_evjav_20261121_045652' < kod/deploy/tulaj-fiokok-allapot.sh
# kézi, titkosított mentés: backups/pg_dump_elotte_evjav_20261121_045652.dump.gpg (476 885 bájt; pg_restore -l: 579 sor)
cd kod/app && npm run export:web; cd kod/panel && npm run build
bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'           # _regi/db_elotte_up_20261121_045932; migráció 22 → 27
bash kod/deploy/feltolt.sh --web-only && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh' # panel apró szövegjavítás (_regi/db_elotte_up_20261121_050956)
ssh appok-1 'bash -s hasonlit elotte_evjav_20261121_045652 utana_evjav_20261121_050056' < kod/deploy/tulaj-fiokok-allapot.sh   # VÁLTOZATLAN
```
- **Migrációk:** 0022–0026 (csak hozzáadó; a 0026: `annual_closings.draft_document_id`, `client_tax_profiles.regime_decision`).
  Adatlépések: `data.kata_f1` `{profiles: 1, variants: 1, kataCreated: 11, backfilled: 10, adonem: 42, annual: 0}`,
  `data.ev_javitas` `{content: 0, annualPrefs: 0}` (a szerveren nem volt felülírt szöveg és `annual_due`-beállítás).
- **Proxy:** az `adozz.caddy` feltöltős útvonalai bővültek (éves beadás, önellenőrzés beadása, folyószámla: 60 MB); az up.sh
  érvényesítette és újratöltötte. Régi: `deploy/_regi/adozz_elotte_ev_javitas_1121.caddy`.
- **Utána:** mind a 8 cím 200/301; API/worker naplóban 0 figyelmeztetés/hiba; a demo belépések (admin, könyvelő, csapat, 17
  ügyfél) 200; alex@ és tulaj@ VÁLTOZATLAN; a Google-os tesztfiók aktív, 3 élő munkamenet; a `backup.sh` 05:05-kor lefutott.
- **Élő próba (DEMO):** képek `kod/_qa/eles_ev_1121/` (Lakatos Gréta – kata, Varga Réka – átalány, panel + app). Levelek a
  DEMO-postafiókban: „Javítani kell egy beadott bevallásodat” (Réka; egy próba-önellenőrzés, utána **visszavonva**, nem törölve)
  és „Utald el a katát: 50 000 Ft” (Gréta; egyszeri próba-emlékeztető saját dedupe-kulccsal, a december 8-i valódi is kimegy).
- **Kapcsolók (mind KI):** `kata2027`, `kata2027Osszeg` (null), `evesZarasDij`, `kataElorejelzesUgyfelnek`,
  `lemondottEvesZaras` ('ki'), `reszletfizetesSzoveg`, `csjkBirsagTetel`. Bekapcsolás: a lenti SQL, `system_state.value ||`
  összefésüléssel.
- **Visszaállás:** `_regi/db_elotte_up_20261121_045932.dump.gpg` (a 0022–0026 csak új oszlopokat / táblákat hoz); a régi
  kód a `_regi/src_*`-ban, a webes buildek a `_regi/web_*`-ban.

## Éves ciklus F2/F3 (SPEC §32.B) – ÉPÍTŐ B, 2026-11-21 – ÉLESÍTVE a DEMO-ra 11-21 05:00 (lent: „Javító kör”)

- **Migráció (csak hozzáadó), sorrendben az F1a után:** `0024_ev_ciklus_enumok.sql` (enumértékek: `payment_item_kind` +
  `szja_kulonbozet`, `onellenorzesi_potlek`, `egyeb_ado`; `document_category` + `adoszamla_kivonat`; `notification_kind` +
  `correction_status` – ebben a futásban semmi nem használja őket) és `0025_ev_ciklus.sql` (`tax_periods` + `filing_ref`,
  `correction_id`; `tax_payment_items.reconciliation_id`; `client_tax_profiles` + `hipa_prior_year_huf`,
  `hipa_prior_year_source`; `annual_closings` + az összegek, a beadás, a különbözet, a visszajáró, az éves HIPA, a kézi
  lezárás / megnyitás oszlopai (új oszlopokon két CHECK); két új tábla: `tax_corrections`, `account_reconciliations`
  indexekkel). Meglévő sort és oszlopot nem módosít; adatlépés nincs.
- **Előtte pg_dump** (az `up.sh` titkosított mentése + kézi `_regi/pg_dump_elotte_ev_ciklus_<idő>.dump.gpg`,
  `pg_restore -l` próbával). Soha nem újraseedelés.
- **Ellenőrzés telepítés után:** `\d tax_corrections`, `\d account_reconciliations`, `select count(*) from annual_closings
  where amounts is not null;` (0), a 2026-os éves zárások állapota változatlan.
- **Új jobok:** `account_checks` (07:30: esedékes folyószámla-ellenőrzés → `tax_task.folyoszamla`), `refund_watch`
  (09:10: késő visszajáró → `tax_task.visszajaro_kesik`). Mindkettő csak könyvelői feladatot ad.
- **Új kapcsolók** (ugyanabban a `system_state['kapcsolok.ev_ciklus']` JSON-ban): `lemondottEvesZaras`
  (`ki` = alapérték, a mostani viselkedés: megszűnt / felfüggesztett ügyfélnek nem nyílik éves zárás; `kezi` = a könyvelő a
  panelen megnyithatja; `automatikus` = január 5-én magától megnyílik) – **tulaj-döntés (T4)**; `refundDatumUgyfelnek`
  (igaz), `reszletfizetesSzoveg` (hamis), `csjkBirsagTetel` (hamis). Bekapcsolás pl.:
  `insert into system_state(key, value) values ('kapcsolok.ev_ciklus', '{"lemondottEvesZaras": "kezi"}') on conflict (key) do update set value = system_state.value || excluded.value;`
  (A kulcsok egy JSON-ban élnek; a `||` a többi, már beállított kapcsolót megtartja – javító kör 11-21.)
- **Viselkedésváltozás a DEMO-n:** a tervezet csak elmentett összegekkel és „egyeznek” jelöléssel mehet ki jóváhagyásra;
  a „Beadtam” (szja / kata) NAV-iktatószámot, bevallást és NAV-visszaigazolást kér; a `beadva → kesz` automatikus (a
  különbözet rendezése és a HIPA után); a panel Adó füle nem mutatja az éves különbözet és az önellenőrzés befizetéseit
  (azok az Éves zárás / Önellenőrzés fülön vannak); az app éves zárás képernyője és kérdőíve a folyamatban lévő évet kéri
  (javítás: eddig a naptári év üres zárását nyitotta meg januárban).


## Éves ciklus és KATA, F0 + F1a (SPEC §32) – ÉPÍTŐ A, 2026-11-21 – ÉLESÍTVE a DEMO-ra 11-21 05:00 (lent: „Javító kör”)

- **Migráció (csak hozzáadó):** `0022_kata_enumok.sql` (enumértékek: `payment_item_kind` + `kata_teteles`, `kata_kulonado`;
  `notification_kind` + `tax_task` – ebben a futásban semmi nem használja őket) és `0023_kata.sql` (`tax_periods` +
  `hidden_at`, `hidden_reason`, `exempt_reason`, `backfilled`; `tax_payment_items.adonem`; `client_tax_profiles` +
  `kata_variant` (CHECK `regi`|`uj`), `kata_fofoglalkozasu`; egy index). Meglévő sort és oszlopot nem módosít.
- **Előtte pg_dump** (az `up.sh` titkosított mentése + egy kézi `_regi/pg_dump_elotte_kata_f1_<idő>.dump.gpg`,
  `pg_restore -l` próbával). Soha nem újraseedelés.
- **Worker-adatlépés `data.kata_f1`** (egyszer, idempotens): az idei katás profilok `kata_variant = 'regi'`,
  főfoglalkozású; a katás év NEM jóváhagyott negyedévei rejtve (`hidden_reason 'kata_ev'`, nem törölve); a kata-hónapok
  sorai 2026-ra (a ma előtt lejártak `backfilled`: nincs emlékeztető, az ügyfél csak a könyvelő „Rendben”-je után látja,
  a könyvelő egy `tax_task` feladatot kap); a meglévő tételek `adonem`-je. A DEMO-n ma 1 katás ügyfél van.
- **Új jobok:** `kata_periods` (03:10), `kata_year_end` (09:00: dec. 10/22 könyvelői feladat, dec. 16 ügyfél, mentesség
  bejelentése 3 nappal a 12-e előtt). A `reminders_k28` (08:00) küldi a kata-emlékeztetőt (8-án / határnapon / +1 nap).
- **Kapcsolók** (`system_state['kapcsolok.ev_ciklus']`, JSON; kódbeli alapérték mind KI): `kata2027` (a T/928 szerinti
  2027-es kata – csak a törvény kihirdetése után), `kataElorejelzesUgyfelnek`, `kataEvVegeUgyfelnek` (`jeloletlen`|`ki`),
  `evesZarasDij` (a 14 999 Ft-os éves zárási díj – az ÁSZF javításáig KI). Bekapcsolás pl.:
  `insert into system_state(key, value) values ('kapcsolok.ev_ciklus', '{"evesZarasDij": true}') on conflict (key) do update set value = system_state.value || excluded.value;`
  (a `||` a többi, már beállított kapcsolót megtartja)
- **Viselkedésváltozás a DEMO-n:** az éves zárás kérdőíve díj nélkül megy a könyvelőhöz (`evesZarasDij` KI); a
  `annual_due` értesítés e-mailben is megy (az ügyfél beállítása szerint); a novemberi kata határideje 2026-12-14.
- **Ellenőrzés telepítés után:** `select key, value from system_state where key = 'data.kata_f1';`, a katás ügyfél
  Határidők-listája („Kata – november: 50 000 Ft”, december 14.), a fizetési lap (`/fizetes/<id>`), a panel Adó füle.


## Landing élesítése – az új értékesítő oldal (adozz.hu), 2026-11-21 10:48 (CSAK a landing)
A tulaj jóváhagyta („Jó lesz így a weboldal, kiteheted”). A `feltolt.sh --web-only` + `up.sh` út **nem** ment, mert az az app és
a panel mappáját is cseréli, az `up.sh` pedig API-image-et épít, adatbázist ment és migrál. Helyette: `deploy/landing-csere.sh`
(a fejében a gépi lépések) – a csomag hash-listával megy fel, a szerveren az élő mappa másolata
`_regi/landing_elotte_20261121_104810`, a régi mappa `_regi/web_landing_20261121_104810`, a csomag
`_regi/landing_feltoltes_20261121_104810.tar.gz`; utána csak `docker compose … up -d --no-deps --force-recreate kezjegy-web`.
- **Ellenőrizve:** a konténer `index.html`-je = a diszken lévő (`c12f2fa4…`); `/`, `/stilus.css`, `/js/mozgas.js`, `/js/meres.js`,
  `/m/script.js`, `/email/logo_feher@2x.png`, `/email/logo_alairas@2x.png` 200 (a két logó bájtra a régi); a régi
  `kepek/LICENC_telefon_keret.txt` 404; CSP változatlan (`script-src 'self'`), süti nincs; `app.adozz.hu`, `konyvelo.adozz.hu`,
  `/api/v1/health` 200, `marketing-config` `{"ads":false}`. Fejetlen Chrome 390 és 1440 (normál User-Agent): konzol-, JS- és
  CSP-hiba 0, idegen kérés 0, vízszintes kilógás 0; a hős telefonmenüje és a ragadós bemutató (8 lépés, gépes zárás) működik;
  9/9 app-link viszi az `utm_*`-ot, a `hivatkozo`-t és az `erkezes`-t. Az Umami (csak olvasó felhasználóval, a konténeren belül)
  2 látogatást mutat `elesites_proba` kampánnyal, a 4 eseménnyel. A `backup.sh` és a `restic-mentes.sh` hash-e és cron-sora
  változatlan, a restic 10:35-ös futása OK.
- **Visszaállás:** `mv web/landing _regi/landing_hibas_<idő> && cp -a _regi/landing_elotte_20261121_104810 web/landing`, majd a
  `kezjegy-web` újralétrehozása (ugyanaz a compose-sor).

## Marketing (SPEC §31) – ÉLESÍTVE 2026-11-21 01:19–01:36 (javító + telepítő)

Ahogy ment (a lépések lent, a „telepítési terv” szerint):
```bash
ssh appok-1 'bash -s' < kod/deploy/fiok-szamok.sh                                              # 40 felhasználó / 37 ügyfél / migráció 20
ssh appok-1 'bash -s ment elotte_marketing_20261121_011908' < kod/deploy/tulaj-fiokok-allapot.sh
# kézi, titkosított mentés: backups/pg_dump_elotte_marketing_20261121_011908.dump.gpg (468 382 bájt; pg_restore -l: 554 sor)
cd kod/app && npm run export:web; cd kod/panel && npm run build; node kod/landing/build.mjs
bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'                     # _regi/db_elotte_up_20261121_012238; migráció 20 → 22; Umami indul
ssh appok-1 'bash /srv/kezjegy/deploy/umami-beallit.sh'                                         # .env-mentés _regi/env_20261121_012422; website id 4b205eb2-…
# meres.json umamiWebsiteId → node kod/landing/build.mjs → feltolt.sh --web-only → up.sh (2×; a 2. a panel apró javításával)
ssh appok-1 'bash -s hasonlit elotte_marketing_20261121_011908 utana_marketing_20261121_013515' < kod/deploy/tulaj-fiokok-allapot.sh   # VÁLTOZATLAN
```
- **Eredmény:** a 0021 22 forrássort töltött vissza (mind `before_tracking`); a `.env` csak az `umami-beallit.sh`-tól változott
  (4 `UMAMI_*` kulcs, előtte mentés); új 600-as fájlok: `.env.umami`, `.env.umami-db`, `.umami_beallitas`. A gyári Umami-admin
  belépés 401. A kezjegy-umami env: `SALT_ROTATION=day`, `SKIP_LOCATION_HEADERS=1`. A restic 01:35-ös futása már az `umami`
  pillanatképpel és a bővített `config` listával ment (OK).
- **Élő ellenőrzés:** mind a 8 cím 200/301; `adozz.hu` CSP `script-src 'self'`, sütit nem tesz; `/js/meres.js` és `/m/script.js`
  200, `/m/x` és `/m/api/x` 404; `/api/v1/public/marketing-config` → `{"ads":false}`, `/api/v1/public/hozzajarulas/<id>` 404.
  Headless látogatás `?utm_source=youtube&utm_medium=video&utm_campaign=proba-1121&gclid=…` (hivatkozó youtube.com): 3 küldés
  (oldal, arak-lathato, regisztralok), a webcímben csak az utm_, a hivatkozó csak a webhely, Meta/Google kérés 0; a Regisztrálok
  azonnal (0,5–0,8 s) az `app.adozz.hu/regisztracio?utm_…&hivatkozo=youtube.com&erkezes=/` címre visz. **Figyelem: az Umami a
  „HeadlessChrome” böngészőt botnak veszi és eldobja – gépi próbához normál User-Agent kell.** A pult végpontja (7 nap):
  1 látogató, YouTube 1, Gép 1, Magyarország 1, események „Görgetett az árakig” 1, „Regisztrálok gomb” 1, kampány
  `proba-1121` 1 látogató / 1 regisztrált. DEMO-regisztráció a böngészőben (kitalált cím `marketing.proba.<idő>@demo.kezjegy.test`,
  a DEMO-postafiók kódjával): forrássor `regisztracio | youtube | video | proba-1121 | youtube.com | / | web`, kattintás-azonosító
  nincs; utána `clients.is_test = true` (nem töröltük). Az app `/jogi/suti` és `/jogi/adatkezeles` kijelentkezve megnyílik
  (2026-11-21, belső jelölő nem látszik). Demo belépések (admin, könyvelő, csapat, ügyfelek, a tulaj demo ügyfele) 200; a
  Google-os tesztfiók aktív, 3 élő munkamenete megmaradt. Naplók: API/worker/proxy/web 0 hiba- és figyelmeztetéssor.
  Képek: a javító scratchpadjének `kepek_eles/` mappája (a jelentésben).
- **Az Umami nyers adatainak törlése (2 év):** `deploy/umami-megorzes.sh` – próbafutás rendben (a 3.5.0 táblanevei egyeznek),
  **nincs időzítve** (házirend: semmit nem törlünk; a cron-sor a szkript fejében, a tulaj dönt).

### A telepítési terv (az építő írta; így is ment)
Új: saját statisztika-szerver (Umami 3.5.0 + saját Postgres), a Marketing fül, a források mentése, a nyitóoldal szkriptje, a
kikapcsolt hirdetési mérés. Tulaj-leírás: `kod/MARKETING.md`. Migráció: **0020** (`legal_doc_type += 'suti'`, csak enum) és
**0021** (4 új tábla + a `marketing_touches` feltöltése a `signup_attribution`-ből; meglévő sort nem módosít). A régi fájlok:
`deploy/_regi/*_elotte_marketing_1121.*`.
1. **Előtte:** `fiok-szamok.sh` + `tulaj-fiokok-allapot.sh ment elotte_marketing_<ts>`; kézi, titkosított mentés
   `backups/pg_dump_elotte_marketing_<ts>.dump.gpg` (`pg_restore -l` próbával) – a k7b mintájára.
2. **Build a gépen:** `cd kod/app && npm run export:web`; `cd kod/panel && npm run build`; `node kod/landing/build.mjs`
   (a `meres.json` `umamiWebsiteId`-je még üres → statisztikai szkript nélkül, de a `js/meres.js` már átadja a forrást).
3. `bash kod/deploy/feltolt.sh` (megáll, ha a landingból hiányzik a `js/meres.js` vagy az e-mail-logó) → `ssh appok-1 'bash
   /srv/kezjegy/deploy/up.sh'`. Az up.sh: `gen-env.sh` (új: `.env.umami`, `.env.umami-db`; a `.env` módosítása előtt
   `_regi/env_<idő>`), a landing ellenőrzése, a saját titkosított mentése, a migrációk (0020, 0021), a `kezjegy-umami` és
   `kezjegy-umami-db` indítása (a kép a pontos digesttel húzódik le), a `kezjegy-web` újralétrehozása (új: a landing index és az
   e-mail-logó próbája), a proxy (`atallas.sh frissit`: érvényesíti az új `adozz.caddy`-t – CSP `script-src 'self'`, `/m/*`
   útvonalak, a két nyilvános hirdetési végpont).
4. **Utána:** `hasonlit … utana_marketing_<ts>` (a fiókszámok és a tulaj fiókjai változatlanok), mind a 8 cím 200/301,
   `curl -sI https://adozz.hu/` (új CSP), `https://adozz.hu/js/meres.js` 200, `https://adozz.hu/m/api/x` 404,
   `https://adozz.hu/api/v1/public/marketing-config` → `{"ads":false}`, `docker inspect kezjegy-umami` → healthy.
5. **Egyszer:** `ssh appok-1 'bash /srv/kezjegy/deploy/umami-beallit.sh'` → kiírja a nyilvános website id-t (az API-t
   újraindítja). Ezt a `kod/landing/meres.json` `umamiWebsiteId` mezőjébe → `node kod/landing/build.mjs` → `feltolt.sh --web-only`
   → **`up.sh`** (csak így látszik a landing új mappája). Ellenőrzés: `https://adozz.hu/m/script.js` 200, a nyitóoldal betöltése után a
   Marketing fülön megjelenik egy látogató (a te látogatásod).
6. **A restic konfig-mentésébe** (szerveren: `restic-mentes.sh`) vedd fel a `.env.umami`, `.env.umami-db`, `.umami_beallitas`
   fájlt és a `hirdetes/` mappát (a mostani lista: `.env`, `.env.db`, `.backup_pass`, `deploy/`, `proxy/`).
Visszaállás: a `_regi/db_elotte_up_<idő>.dump.gpg` (a 0021 csak új táblákat hoz, a régi kód nem olvassa őket); a landing régi
mappája `_regi/web_landing_<idő>`; a proxy-konfig `atallas.sh` szerint; az Umami két konténere `docker compose stop
kezjegy-umami kezjegy-umami-db` (a kötet marad).

## k7b – a hiányzó levelek + S16 regisztráció, élesítve 2026-11-20 20:19–20:23
Ugyanúgy, mint a k7c2: `fiok-szamok.sh` + `tulaj-fiokok-allapot.sh ment elotte_k7b_20261120_201900` → kézi, titkosított mentés
`backups/pg_dump_elotte_k7b_20261120_201900.dump.gpg` (pg_restore -l: 554 sor) → web export + panel build → `feltolt.sh` → `up.sh`
(saját mentése `_regi/db_elotte_up_20261120_202228.dump.gpg`; **migráció nem volt, 20 maradt**; worker: `data.k7b` `{content: 0,
messagePrefs: 0}`) → `hasonlit … utana_k7b_20261120_202333`: VÁLTOZATLAN; a fiókszámok ugyanazok. Utána mind a nyolc cím 200/301,
az éles app és panel `index.html` = a helyi build, az API/worker naplójában nincs figyelmeztetés vagy hiba.
- **A regisztráció szerződése megváltozott (SPEC §30):** `POST /auth/register` → 202 munkamenet nélkül, a kód nyitja
  (`POST /auth/register/verify`); megerősítés előtt a jelszó 401-et kap (új kód megy). A web (kezjegy-web) a backenddel együtt ment ki.
  **A régi APK nem tudja befejezni a regisztrációt – új APK kell.**
- **Élő próba (DEMO, kitalált cím `k7b.proba.<idő>@demo.kezjegy.test`, `is_test = true`):** 202 → jó jelszó a megerősítés előtt 401,
  betűre ugyanaz, mint a rossz jelszóé → ugyanaz a cím újra 202 → rossz kód 400 → a levélben kapott kód 201, megerősítve. A DEMO
  postafiókba 3 kódos levél + 1 „Már van fiókod az Adózzban” került (valódi levél nem ment ki).
- **`https-proba.sh` és `bongeszo-proba.mjs`** az új regisztrációt követi. A kettő többi része (SimplePay DEMO indítás) a Stripe-ra
  váltás óta elavult, ezért most nem futott; az egyszeri `app/scripts/_helyi_j1119.mjs`, `_helyi_j2.mjs` és a `_qa/*_harness.mjs`
  a régi regisztrációt használja.

## k7c2 – a 2. ellenőrzés javításai, élesítve 2026-11-20 17:42–17:47
Ugyanúgy, mint a k7c: `fiok-szamok.sh` + `tulaj-fiokok-allapot.sh ment elotte_k7c2_20261120_174225` → `feltolt.sh` → `up.sh`
(titkosított mentés `_regi/db_elotte_up_20261120_174609.dump.gpg`, migráció **0019_k7c2** 19 → 20: `payments.charge_params`,
`payments.refund_pending_at`, `subscriptions.predebit_period`, `stripe_events.claimed_at`, és a `payments_one_success_per_fee`
részleges egyedi index – csak akkor jön létre, ha nincs dupla sikeres díjfizetés; az élőn 0 volt, létrejött) →
`hasonlit … utana_k7c2_20261120_174710`: VÁLTOZATLAN. Utána mind a nyolc cím 200/301, `/config` ár 19 999, az ÁSZF /
szerződés / kártyás engedély 19 999 Ft; az éles `index.html` = a helyi build.
- **Számlázz.hu kulcs:** DEMO szerveren csak `SZAMLAZZHU_TEST_AGENT_KEY` olvasódik, éles szerveren csak `SZAMLAZZHU_AGENT_KEY`
  (`config.ts`); a `kezjegy_kulcsok.ps1` fiókválasztáskor ugyanabban a futásban kéri a fiók kulcsát. Élő Stripe-kulcs éles
  Számlázz.hu nélkül nem indul.
- **Új Stripe-események** (`stripe_szerverre.ps1` + `STRIPE_WEBHOOK_EVENTS`): `refund.failed`, `charge.refund.updated`,
  `charge.dispute.closed` – a tulaj a következő `stripe_szerverre.ps1` futtatással iratkozik fel rájuk.
- **[TULAJ]** `ar_19999_szerverre.ps1`: a `.env` tartalék `PLAN_PRICE_HUF` sora 20000 → 19999 (a kijelzett ár már a Díjak beállításból jön).
- Helyi próba: `PORT=8893 node kod/app/scripts/helyi-proba.mjs` (most a `seed:k29`-et is betölti) +
  `BASE=http://127.0.0.1:8893 node kod/app/scripts/k7c2-kepek.mjs` → `kod/_qa/k7c2j_*.png`.

## k7c – a vezetett első indulás (bevezető) javítása, élesítve 2026-11-20 15:54–15:57

Ugyanúgy, mint a k7-es frissítés (fiókszámok és tulaj-fiókok előtte/utána, `feltolt.sh` + `up.sh`); migráció nem volt (19 maradt).
Titkosított mentés előtte: `_regi/db_elotte_up_20261120_155647.dump.gpg`. alex@, tulaj@ VÁLTOZATLAN, a fiókszámok (david@,
bence.kovacs@) ugyanazok. Utána mind a nyolc cím 200/301. Az éles app `index.html` = a helyi build.
- **A `feltolt.sh` már nem viszi fel a `caddy/kezjegy.caddy`-t** (a régi közös Caddy importmappája; a `takarit` 14:45-kor
  `_regi`-be tette, egy teljes feltöltés eddig visszahozta volna). A `deploy/kezjegy.caddy` fájl megmaradt, csak nem megy fel.
- Helyi végigjátszás a VALÓDI regisztrációs képernyőkön: `app/scripts/k7c-bevezeto.mjs` (friss `scripts/jav1/harness.mjs`
  mellett – az API óránként 5 regisztrációt enged egy IP-ről), képek `kod/_qa/k7c_bevezeto_*.png`.

## k7 – élesítve 2026-11-20 13:38–13:47 (integrátor)

Ahogy ment (a következő k7-es frissítésnél ugyanígy, csak az átállási lépések nélkül):
```bash
for u in https://api.45-94-65-74.sslip.io/api/v1/health https://app.45-94-65-74.sslip.io/ https://konyvelo.45-94-65-74.sslip.io/; do curl -s -o /dev/null -w "%{http_code} $u\n" $u; done
ssh appok-1 'bash -s' < kod/deploy/fiok-szamok.sh
ssh appok-1 'bash -s ment elotte_k7integ_20261120_133820' < kod/deploy/tulaj-fiokok-allapot.sh
bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'     # titkosított mentés _regi/db_elotte_up_20261120_134050.dump.gpg; migráció 17 → 19
ssh appok-1 'bash /srv/kezjegy/deploy/seed-k29.sh'                             # 5 új demó-elem; a lista 21 sor (600)
ssh appok-1 'bash -s hasonlit elotte_k7integ_20261120_133820 utana_k7integ_20261120_134157' < kod/deploy/tulaj-fiokok-allapot.sh   # VÁLTOZATLAN
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh elokeszit'             # 3 fájl, DNS 5 név = 45.94.65.74, a régi proxy 2 fájlja: _regi/appok_elotte_20261120_134243/
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh tanusitvany'           # 4 tanúsítványfájl átmásolva
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh atall'                 # előtte/utána api/app/konyvelo 200; kiesés néhány mp
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh adozz'                 # 5 név 200/301/404, Let's Encrypt (YE1/YE2), lejár 2027-02-18
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh cimek'                 # nyilvanos.env → adozz.hu; API + worker újra; mindkét címkészlet 200
```
- Eredmény: adatlépés `data.k29` `{inserted: 6, confirmed: [eves_zaras, valtozas_egyszeru, valtozas_jogallas, szuneteltetesi_dij], faqNoTrial: 1, openChargesUndemo: 1}`;
  alex@, tulaj@ VÁLTOZATLAN; david@ 20 irat / 33 számla / 34 bevétel / 9 üzenet / 14 értesítés / 5 negyedév – előtte és utána ugyanaz;
  bence.kovacs@ 3 élő munkamenete megmaradt (32 → 35 ügyfél a demó-kiegészítéssel). Az éles `index.html` = a helyi build.
- Kívülről (curl + openssl, ezen a gépen): `adozz.hu` 200 (CSP: script-src 'none'), `www.adozz.hu` 301 → `https://adozz.hu/`,
  `app.adozz.hu` 200, `konyvelo.adozz.hu` 200, `api.adozz.hu/api/v1/health` 200, `api.adozz.hu/` 404; a három sslip-cím 200
  (a régi tanúsítványokkal). `POST /auth/refresh` mindkét címkészlet Originjével 401 (rendben, nincs süti), idegen Originnel 403.
- A szerver továbbra is `PAYMENT_PROVIDER=demo`, `INVOICE_MODE=demo`, `NEW_BUSINESS_CHARGE_POLICY=azonnal` (a `/config` szerint);
  a Stripe TESZT-et a tulaj kapcsolja be: `stripe_szerverre.ps1`.
- **443/udp NINCS publikálva** (ugyanúgy, mint az `appok-caddy-1`-nél): a böngészők TCP-n jönnek. HTTP/3-hoz a tulaj dönt (lent, [TULAJ]).
- **Takarítás (`atallas.sh takarit TAKARIT`, ≥ 60 perc tiszta proxy-napló után)** – a legkevésbé romboló formában: a leállított
  `appok-caddy-1` konténer és az `appok_edge`/`appok_internal` háló megszűnik (adat nincs bennük); a `/srv/appok` (régi Caddyfile,
  compose, a Gardoko `.env`-je) a `/srv/kezjegy/_regi/appok_gardoko_<idő>/` alá KÖLTÖZIK (700); az `appok_caddy_data`,
  `appok_caddy_config` kötet és az `appok/garden-api` kép megmarad – **[TULAJ]** ha nem kellenek:
  `ssh appok-1 'docker volume rm appok_caddy_data appok_caddy_config; docker image rm appok/garden-api:latest'`.
  A takarítás után visszaállni a régi proxyra már nem lehet (`visszaall` csak előtte); a kezjegy-proxy fájljai a `/srv/kezjegy/proxy/`-ban.
  **Lefutott 14:45-kor** (a proxy 61 perce futott, a naplóban 0 hibasor; a 14:05-ös óránkénti mentés rendben, 456 269 bájt):
  `appok-caddy-1` és a két `appok_*` háló eltávolítva; `/srv/appok` → `/srv/kezjegy/_regi/appok_gardoko_20261120_144542/`
  (a `/srv` a rooté, ezért `sudo -n mv` – a szkript ezt már magától így csinálja); `/srv/kezjegy/caddy` →
  `/srv/kezjegy/_regi/caddy_elotte_k7_20261120_144519/`. Megmaradt: `appok_caddy_data`, `appok_caddy_config` kötet. Utána mind a
  nyolc cím 200/301, csak a `kezjegy-proxy` publikál portot (80, 443).
- Helyi végigjátszás élesítés előtt (Stripe TESZT + Számlázz.hu Tesztüzem, kitalált adatok): `kod/_qa/k7_integ_eredmeny.txt`,
  képek `kod/_qa/k7_integ_*.png`, azonosítók `kod/_qa/k7_integ_stripe_futas1.jsonl`.


## k7 (SPEC §29) – saját proxy, adozz.hu, Stripe, Számlázz.hu – terv (B1 backend, 11-20); ÉL 13:44 óta, lásd fent

**Új elrendezés a szerveren** (a `feltolt.sh` viszi fel, az `atallas.sh` teszi a helyére):
```
/srv/kezjegy/
  proxy/                 ÚJ – az Adózz proxy (compose projekt: kezjegy-proxy, konténer: kezjegy-proxy, 80/443)
    docker-compose.yml   a deploy/proxy/-ból másolva; image caddy:2-alpine@sha256:003a978… (a szerveren lévő v2.11.9)
    caddy/Caddyfile      + caddy/sites/adozz.caddy – a mappa van csatolva (/etc/caddy), a fájlokat cseréljük benne
  nyilvanos.env          ÚJ, 644 – CSAK nyilvános címek (APP/PANEL/API/LANDING_PUBLIC_URL, EXTRA_PUBLIC_ORIGINS);
                         a compose a .env UTÁN tölti be (az nyer); az up.sh minden más kulcsot visszautasít
  web/landing            ÚJ – az adozz.hu bemutató oldal (kod/landing/dist), kezjegy-web :8082
```
Miért nem a `deploy/proxy/` alatt fut: a `feltolt.sh` a `deploy/` mappát egészben cseréli, a futó proxy viszont a
csatolt mappáját tartja – ezért a proxy a `/srv/kezjegy/proxy/`-ban él, és minden `up.sh` az `atallas.sh frissit`-tel
validálja, fájlonként cseréli (a régi a `_regi/proxy_<idő>/`-be) és újratölti. Az átállás előtt az `up.sh` a régi
`appok-caddy-1`-et tölti újra (konténernév alapján, `/srv/appok` útvonal nélkül). A `caddy-csatolas.sh` visszavonva
(`deploy/_regi/caddy-csatolas_visszavonva_k7_1120.sh`).

**Élesítés sorrendje (integrátor; minden lépés előtt Adózz health 200):**
```bash
bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'   # titkosított pg_dump, migráció 0017 (enum) + 0018 (csak bővít), worker: data.k29
ssh appok-1 'bash /srv/kezjegy/deploy/seed-k29.sh'                          # Halmi Zsófia, Kerekes Anna (+ B2: igazolások, Fodor Márk …); 2. futás: semmi
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh elokeszit'          # fájlok, validálás, DNS (5 név = 45.94.65.74), a régi proxy 2 fájljának másolata
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh tanusitvany'        # appok_caddy_data → kezjegy_caddy_data (a sslip-tanúsítványok maradnak)
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh atall'              # ≈10–30 s kiesés; 90 s alatt nem 200 → automatikus VISSZAÁLLÍTÁS
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh adozz'              # adozz.hu 200, www → 301, app/konyvelo 200, api health 200, api / 404, Let's Encrypt
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh cimek'              # nyilvanos.env (adozz.hu), API + worker újra; mindkét címkészlet health
# ≥ 1 óra tiszta proxy-napló után (a tulaj 11-20-án jóváhagyta a Gardoko-maradékok végleges törlését):
ssh appok-1 'bash /srv/kezjegy/deploy/proxy/atallas.sh takarit TAKARIT'    # appok-caddy-1 + appok_edge/_internal el; /srv/appok és caddy/ → _regi; a kötetek/kép maradnak (k7 integrátor)
```
Kézi visszaállítás a `takarit` előtt bármikor: `atallas.sh visszaall` (a kezjegy-proxy leáll, az appok-caddy-1 indul).
Állapot: `atallas.sh allapot`. Napló: `/srv/kezjegy/_regi/proxy_atallas_<idő>_<lépés>.log`. A `pgtest_net`, `pgtest_nm`
hálókhoz és a névtelen kötethez nem nyúl (nem része a jóváhagyásnak).

**Fizetés és díjszámla a szerveren:** a szerver `PAYMENT_PROVIDER=demo` (alapérték) és `INVOICE_MODE=demo` marad. A
Stripe TESZT-et a tulaj kapcsolja be az átállás után: `stripe_szerverre.ps1` (webhook-végpont a Stripe-nál
`https://api.adozz.hu/api/v1/webhooks/stripe`, a 8 eseménnyel, API-verzió 2026-10-28.endive; vissza: `-Vissza`). A
szerver `.env`-jében lévő `SZAMLAZZHU_AGENT_KEY` a Somosi Kft. ÉLES kulcsa: amíg `INVOICE_MODE=demo`, nem használjuk;
`INVOICE_MODE=szamlazzhu` csak `SZAMLAZZHU_ACCOUNT`-tal indul, és DEMO szerveren csak `teszt` fiókkal. A régi DEMO
előfizetések (SimplePay-DEMO kártya) a `demo` szolgáltatónál maradnak (data.k29), így senki nem zárolódik az átállástól.
Ha a `.env`-ben `NEW_BUSINESS_CHARGE_POLICY=adoszam_utan` sor van, azt a tulaj törölje (az új alapérték `azonnal`).

**Új env (mind opcionális; `env.example`):** `PAYMENT_PROVIDER`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_STATEMENT_SUFFIX_HAVI` (HAVIDIJ), `STRIPE_CHECKOUT_LOCALE` (hu), `SZAMLAZZHU_ACCOUNT`,
`SZAMLAZZHU_URL`, `NAV_LOOKUP_MODE/TAX_NUMBER/LOGIN/PASSWORD/SIGN_KEY/EXCHANGE_KEY` (mind az öt vagy egyik sem),
`LANDING_PUBLIC_URL`, `EXTRA_PUBLIC_ORIGINS` (ez a kettő a `nyilvanos.env`-be).

**Új workerfeladatok:** `predebit` 10:00, `suspension_warning` 10:05, `payments_reconcile` 15 percenként,
`invoices_issue` percenként (a `billing` 06:00 a szolgáltató szerint ágazik el). Admin: `/admin/k29/{subscriptions,payments,fee-invoices,system}`.

**Élesítés (valódi pénz, később – SPEC §29.11.3, [TULAJ]):** 1) Stripe-fiók aktiválása, Dashboard: rövid
megnevezés `ADOZZ`, a Stripe saját nyugta-e-mailjei KI, Radar alapszabályok; 2) új, üres éles adatbázis (lent,
„Élesítés” 1.); 3) `stripe_szerverre.ps1 -Eles` (élő kulcsok `Read-Host`-tal, élő webhook); 4) `kezjegy_kulcsok.ps1`:
`APP_ENV=production`, `INVOICE_MODE=szamlazzhu`, `SZAMLAZZHU_ACCOUNT=eles`, ZeptoMail token, push, NAV lookup;
5) Számlázz.hu éles fiók: „Rendelésszám ismétlődés tiltása” BE, e-számla BE; 6) egy valódi 19 999 Ft-os fizetés a
tulaj kártyájával + visszatérítés → sztornó, ellenőrzés a Számlázz.hu-ban és a Stripe-ban.

SPEC §20. A Kézjegy a Gardoko mellett fut ugyanazon a Contabo VPS-en, **saját** mappában, saját compose
projektben, saját Postgresszel és hálózattal. Portot csak a közös Caddy (`appok-caddy-1`) publikál.

## Címek (sslip.io aldomainek – a választás: aldomain, nem útvonal)

| Cím | Mi |
|---|---|
| https://app.45-94-65-74.sslip.io | ügyfél webapp (Expo web export) + ugyanazon a hoston `/api/v1` |
| https://konyvelo.45-94-65-74.sslip.io | könyvelői + admin panel + ugyanazon a hoston `/api/v1` |
| https://api.45-94-65-74.sslip.io/api/v1 | API a telefonos appnak, a SimplePay IPN-nek és vissza-URL-nek (minden más 404) |
| https://45-94-65-74.sslip.io | **Gardoko** – változatlan |

Let's Encrypt tanúsítványt a közös Caddy kér automatikusan mindhárom névre.

## Szerkezet a szerveren

```
/srv/kezjegy/
  .env                  600 – az app beállításai és kulcsai, az API és a worker kapja (gen-env.sh; kulcsok: kezjegy_kulcsok.ps1)
  .env.db               600 – az adatbázis-tulajdonos titkai (POSTGRES_PASSWORD, MIGRATION_DATABASE_URL,
                        KEZJEGY_APP_DB_PASSWORD) – CSAK a kezjegy-db és a kezjegy-migrate kapja (3. kör)
  .backup_pass          600 – a mentések gpg-jelszava
  demo_belepesek.txt    600 – demo fiókok jelszavai (seed.sh írja; SEHOL máshol nincs)
  deploy/               ez a mappa (compose, web.Caddyfile, szkriptek)
  caddy/kezjegy.caddy   a közös Caddy ezt importálja (könyvtár-csatolás, csak olvasható)
  src/                  build-kontextus: shared, ado-motor, nav-kliens, backend, jogi (node_modules nélkül)
  web/app, web/panel    statikus buildek
  data/files            700 – titkosított fájlok (AES-256-GCM, KJF1 blobok)
  backups/              700 – éjszakai titkosított DB-mentések
  _regi/                minden lecserélt fájl/mappa (semmit nem törlünk)
```

Konténerek (`docker compose -p kezjegy`): `kezjegy-db` (postgres:17-alpine, volume `kezjegy_pgdata`, csak a
belső `kezjegy_internal` hálón), `kezjegy-migrate` (egyszer fut minden `up.sh`-ban, a tulajdonosi szereppel
migrál, utána leáll), `kezjegy-api` (Node 22, Hono; `SKIP_MIGRATIONS=1`, a `kezjegy_app` szereppel),
`kezjegy-worker` (ugyanaz az image, `node dist/worker.js`), `kezjegy-web` (caddy, statikus: :8080 app, :8081 panel).
Mind `read_only`, `no-new-privileges`, `cap_drop: ALL`, a deploy felhasználóként (1001) fut; **nincs `ports:`**.
A közös Caddy a `kezjegy_edge` hálón éri el az API-t és a statikus szervert.

## Első telepítés (2026-11-18 éjjel így ment)

```bash
# a PC-n (Git Bash):
cd C:/Users/UpgradePC/konyvelo_app/kod/app   && npm run export:web
cd C:/Users/UpgradePC/konyvelo_app/kod/panel && npm run build
bash C:/Users/UpgradePC/konyvelo_app/kod/deploy/feltolt.sh        # csomagol + feltölt + kicsomagol /srv/kezjegy alá
ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'                      # .env generálás, image build, indítás, migráció
ssh appok-1 'bash /srv/kezjegy/deploy/seed.sh'                    # demo adatok, jelszavak a demo_belepesek.txt-be
ssh appok-1 'bash /srv/kezjegy/deploy/caddy-csatolas.sh'          # EGYSZER: közös Caddy bekötése (Gardoko-mentéssel)
ssh appok-1 'bash /srv/kezjegy/deploy/https-proba.sh'             # végpontok és folyamatok HTTPS-en, curl-lel
```

## Frissítés (új kód)

```bash
bash C:/Users/UpgradePC/konyvelo_app/kod/deploy/feltolt.sh        # a régi mappák a /srv/kezjegy/_regi alá kerülnek
ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'
```
Csak a webes buildek: `feltolt.sh --web-only`, utána `up.sh`.
**A `feltolt.sh` után még semmi nem él** (a `--media` kivétel: az azonnal látszik): a `kezjegy-web` a régi mappát tartja
csatolva, és az API/worker is a régi image-ből fut. Az `up.sh` (2026-11-18 este óta) a `kezjegy-web`-et újra is létrehozza
(`--force-recreate`), és kiírja: „kezjegy-web: az új app-build él”. A feltöltés a jelenleg kiszolgált kiadás saját
fájljait is megtartja egy kiadásig, így a nyitott böngészőfülek nem törnek el.

## Demo belépések

A jelszavak csak a szerveren vannak. A tulaj így olvassa ki a saját gépéről:

```bash
ssh appok-1 'cat /srv/kezjegy/demo_belepesek.txt'
```

Sorok: `szerep;e-mail;jelszó` – admin (Demo Tulajdonos), könyvelő (Kovács Bence), ügyfelek (Szabó Kata,
Varga Réka, Németh Péter). Minden fiók kitalált, a domain `demo.kezjegy.test` (nem létező).

## A közös (Gardoko) fájlok változása – egyetlen egyszer

`caddy-csatolas.sh` előtte menti a `/srv/appok/deploy/docker-compose.yml`-t és a `Caddyfile`-t a
`/srv/appok/_regi/` alá, majd:
- compose, `caddy` szolgáltatás: + `kezjegy_edge` háló, + `/srv/kezjegy/caddy:/etc/caddy/kezjegy:ro`;
  a végén `networks: kezjegy_edge: { external: true, name: kezjegy_edge }`;
- Caddyfile: + egy sor a végén: `import /etc/caddy/kezjegy/*.caddy`.

Ellenőrzi mindkettőt (compose config, `caddy validate`), csak a `caddy` konténert hozza újra (`--no-deps`),
és Gardoko health-et néz előtte és utána; hiba esetén azonnal visszaállítja a mentett fájlokat.
**Visszaállítás kézzel:** a két mentett fájlt vissza kell másolni, majd
`docker compose --env-file /srv/appok/.env -f /srv/appok/deploy/docker-compose.yml up -d --no-deps --force-recreate caddy`.

Fontos: a Gardoko `caddy` szolgáltatása mostantól a `kezjegy_edge` hálót is kéri. Ezt a hálót a kezjegy
compose hozza létre; ne futtass `docker compose down`-t a kezjegy projekten (a `stop` rendben van).

## Mentés és visszaállítás

- **ÓRÁNKÉNTI mentés BEKAPCSOLVA (2026-11-19 23:05, a tulaj kérésére).** A szerver cronja (deploy felhasználó):
  ```bash
  ssh appok-1 '{ crontab -l 2>/dev/null | grep -v kezjegy/deploy/backup.sh || true; echo "5 * * * * /bin/bash /srv/kezjegy/deploy/backup.sh >> /srv/kezjegy/backups/backup.log 2>&1"; } | crontab - && crontab -l'
  ```
  Az első óránkénti mentés visszaállíthatóságát ellenőriztük (`pg_restore -l`: 55 tábla adata).
- `backup.sh` – minden óra 05. percében: `pg_dump -Fc` → `gpg --symmetric AES256` (`.backup_pass`) →
  `backups/db_<idő>.dump.gpg`; naponta egyszer (a 03 órás futáskor) a titkosított `data/files` tar-ja is. A végén
  beírja a mentés idejét (admin → Rendszer: „mentés kora”). Nem töröl (házirend): a legutóbbi 48 mentés és 7
  fájl-pillanatkép marad kéznél, a régebbiek a `backups/regi/` alá kerülnek.
- **Külső másolat: 2026-11-21 óta restic, KÖZVETLENÜL a szerverről** (lent: „Külső mentés: restic a Storage
  Boxon”). A korábbi út – a tulaj gépén a Feladatütemező „Adozz mentes kulso” feladata (`mentes-kulso-rejtett.vbs`
  → `mentes-kulso.sh`, óránként :20, `hetzner-tar:kezjegy/mentesek/`) – **11-20 éjjel KIKAPCSOLVA** (Disabled, nem
  törölve; a már kint lévő `kezjegy/mentesek/` fájlok maradnak). Visszakapcsolás csak ha kell:
  `Enable-ScheduledTask -TaskName "Adozz mentes kulso"` (PowerShell).
- `restore-proba.sh` – visszaállítási próba: a legutóbbi mentést egy eldobható, hálózat nélküli Postgres
  konténerbe tölti, és sorszámokat hasonlít az éleshez. Az éles adatbázishoz nem nyúl.
- Valódi visszaállítás (katasztrófa után):
  ```bash
  cd /srv/kezjegy/deploy && docker compose --env-file ../.env stop kezjegy-api kezjegy-worker
  gpg --batch --pinentry-mode loopback --passphrase-file /srv/kezjegy/.backup_pass -d ../backups/db_<idő>.dump.gpg \
    | docker exec -i kezjegy-db pg_restore -U kezjegy -d kezjegy --clean --if-exists --no-owner
  docker compose --env-file ../.env start kezjegy-api kezjegy-worker
  ```
- **[TULAJ]** A `.env` kulcsai (`FILE_ENC_KEY`, `APP_DATA_KEY`, `NAV_CRED_KEY`) és a `.backup_pass` nélkül a
  fájlok és a mentések nem olvashatók: legyen róluk offline másolat (pl. jelszókezelő). Kiolvasás:
  `ssh appok-1 'cat /srv/kezjegy/.env /srv/kezjegy/.backup_pass'` – csak a saját gépeden, ne másold máshová.

## Külső mentés: restic a Storage Boxon (2026-11-21 00:04 óta)

A tulaj döntése (11-20 éjjel): „csak új dolgokat tegye fel a Hetzner szerverre, direktbe, ne a gépemen keresztül”.

- **Mi fut, hol:** a szerver (deploy felhasználó) cronja, a helyi `backup.sh` (:05) mellett:
  ```
  35 * * * * /bin/bash /srv/kezjegy/deploy/restic-mentes.sh >> /srv/kezjegy/backups/restic.log 2>&1
  ```
  `restic-mentes.sh` (flock: két futás nem megy egymásra) → **`sftp:storagebox:kezjegy/restic`** (Hetzner Storage
  Box u696276, port 23; a szerveren `~/.ssh/config` „storagebox”, kulcs `~/.ssh/id_ed25519_storagebox`, a Storage
  Box `.ssh/authorized_keys`-ébe hozzáfűzve; előtte-másolat: `.ssh/authorized_keys.elotte_20261120_235837`).
  restic 0.18.1 (apt, `apt-mark hold`). Titkosított (AES-256), tömörített, deduplikált – csak a változás megy ki.
- **Óránként ezek a pillanatképek (címkék):** `db` = `pg_dump -Fp` a kezjegy-db-ből stdinen (`/kezjegy.sql`);
  `umami` = ha fut a `kezjegy-umami-db`, annak a dumpja (`/umami.sql`); `files` = `/srv/kezjegy/data/files`;
  `config` = `.env`, `.env.db`, `nyilvanos.env`, `.backup_pass`, `deploy/`, `proxy/`; `app` = `src/` + `web/`
  (a futó kód és a webes felületek médiával). A `files`/`config`/`app` csak változáskor kap új pillanatképet.
  Hibás pg_dump vagy megszakadt feltöltés esetén nem készül pillanatkép (nincs félkész állapot).
- **NINCS forget/prune** (házirend: semmit nem törlünk; a tulaj nem engedélyezett ritkítást). Az adatbázis-dump
  óránként ~0,4 MB-tal növeli a tárolót (a PG 17 dumpok eleje/vége véletlen `\restrict` kulcsot kap, ezért a kis
  dump alig deduplikálódik) → ~9 MB/nap, ~3,3 GB/év a jelenlegi méretnél.
- **Jelszó:** `/srv/kezjegy/.restic_pass` (600). Másolata a tulaj gépén: `konyvelo_app/_privat/restic_jelszo.txt`
  (a **2. sor** a jelszó; legyen offline is). **Enélkül a külső mentés nem állítható vissza.** Ezzel az egy
  jelszóval minden visszajön: a `config` pillanatképben ott a `.env` (FILE_ENC_KEY, APP_DATA_KEY, NAV_CRED_KEY)
  és a `.backup_pass` is.
- **Napló / állapot:** `backups/restic.log` (időpont, pillanatkép-azonosítók, hozzáadott méret, titok nélkül),
  `backups/restic_allapot.json` (`eredmeny`, `utolso_sikeres_mentes`, `utolso_siker_cimkenkent`, `hiba`).
  Gyors nézet: `ssh appok-1 'tail -7 /srv/kezjegy/backups/restic.log; cat /srv/kezjegy/backups/restic_allapot.json'`
- **Ellenőrzés / próba** (a szerveren):
  ```bash
  export RESTIC_REPOSITORY=sftp:storagebox:kezjegy/restic RESTIC_PASSWORD_FILE=/srv/kezjegy/.restic_pass
  restic snapshots; restic check            # havonta egyszer: restic check --read-data
  ```
  Próbavisszaállítás 2026-11-21 00:09 (db 7701cffa → ideiglenes, hálózat nélküli `postgres:17-alpine`, `--rm`):
  80/80 tábla, 78 egyezik, eltérés csak az élő azóta írt soraiban (audit_log 925→926, sessions 329→330);
  files: 1 fájl bájtra egyezik + a teljes pillanatkép (467 fájl) `diff -r` egyezik; config: `.env`, `.env.db`,
  `.backup_pass` ellenőrzőösszeg egyezik.

### Visszaállítás lépései vész esetén (új szerveren is)

1. Új Ubuntu-szerver Dockerrel, `deploy` felhasználó a `docker` csoportban (mint fent, „Első telepítés”);
   `sudo apt-get install restic` (0.18.x), `sudo mkdir -p /srv/kezjegy && sudo chown deploy: /srv/kezjegy`.
2. Kapcsolat a Storage Boxhoz: új kulcs (`ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519_storagebox`), a
   `~/.ssh/config` „storagebox” blokkja (HostName u696276.your-storagebox.de, User u696276, Port 23, IdentityFile,
   IdentitiesOnly yes), a nyilvános kulcs HOZZÁFŰZÉSE a Storage Box `.ssh/authorized_keys`-éhez a tulaj gépéről
   (`hetzner-tar`; előtte másolat róla). Host-kulcs ujjlenyomat (ED25519):
   `SHA256:XqONwb1S0zuj5A1CDxpOSuD2hnAArV1A3wKY7Z3sdgM` – csak ha egyezik, akkor fogadd el.
3. Jelszó: a `_privat/restic_jelszo.txt` **2. sora** → `/srv/kezjegy/.restic_pass` (`umask 077`, 600). Utána:
   ```bash
   export RESTIC_REPOSITORY=sftp:storagebox:kezjegy/restic RESTIC_PASSWORD_FILE=/srv/kezjegy/.restic_pass
   restic snapshots                                   # a legutóbbi db / files / config / app
   restic restore latest --tag config --target /      # .env, .env.db, nyilvanos.env, .backup_pass, deploy/, proxy/
   restic restore latest --tag app    --target /      # src/, web/
   restic restore latest --tag files  --target /      # data/files
   ```
   (Régebbi állapot: `restic snapshots --tag db`, és `latest` helyett a pillanatkép azonosítója.)
4. Csak az adatbázist indítsd, és ÜRES adatbázisba töltsd be a dumpot:
   ```bash
   cd /srv/kezjegy/deploy && docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml up -d kezjegy-db
   # várj, amíg healthy: docker inspect -f '{{.State.Health.Status}}' kezjegy-db
   docker exec kezjegy-db psql -U kezjegy -d kezjegy -c "CREATE ROLE kezjegy_app LOGIN"   # a jelszót a db-roles.sh adja
   restic dump latest --tag db /kezjegy.sql | docker exec -i kezjegy-db psql -X -q -v ON_ERROR_STOP=1 -U kezjegy -d kezjegy >/dev/null
   ```
5. `bash /srv/kezjegy/deploy/up.sh` (kép építése a `src/`-ből, migrációk, `db-roles.sh`, API + worker + web), majd
   a proxy: `docker compose -p kezjegy-proxy -f /srv/kezjegy/proxy/docker-compose.yml up -d`; DNS: `adozz.hu` és
   aldomainjei → az új szerver IP-je (a Caddy magától kér új tanúsítványt).
6. Umami (ha volt): `restic dump latest --tag umami /umami.sql | docker exec -i kezjegy-umami-db psql -X -v
   ON_ERROR_STOP=1 -U <umami-felhasználó> -d <umami-adatbázis>` – szintén üres adatbázisba.
7. Cron vissza (deploy): a `backup.sh` (:05) és a `restic-mentes.sh` (:35) sora (fent).

Ugyanazon a szerveren, ha csak az adatbázis romlott el: elsőként a helyi `backups/db_*.dump.gpg` (fent); a restic
dump csak üres adatbázisba tölthető – a meglévő `kezjegy_pgdata` kötetet NE töröld, hanem tedd félre (tulaj dönt).

## Kulcsok később

`C:/Users/UpgradePC/konyvelo_app/kezjegy_kulcsok.ps1` (PowerShell): SimplePay (mód, merchant, secret),
Brevo SMTP + MAIL_FROM, Google client ID-k, Apple bundle ID, NAV mód + szoftveradatok, díjszámla-szolgáltató,
push, a termék neve (a `kod/shared/brand.json`-ba), nyilvános címek, könyvelői 2FA, `APP_ENV`. A régi `.env`
a `_regi/`-be kerül, az API és a worker újraindul. Saját domain esetén a `caddy/kezjegy.caddy` host-neveit és
az app natív API-címét (`EXPO_PUBLIC_API_URL`, új APK) is át kell írni.

## Könyvelői kétlépcsős belépés (2026-11-18, 1. ellenőrző kör)

- Új telepítésnél `STAFF_TOTP_REQUIRED=true` az alapérték (`gen-env.sh`), és `APP_ENV=production` mellett a
  szerver `false`-szal el sem indul. A `kezjegy_kulcsok.ps1` éles módba váltáskor magától `true`-ra állítja.
- **A mostani DEMO szerveren** a régi `.env`-ben `false` maradt, hogy a demo könyvelő/admin fiók 2FA nélkül is
  kipróbálható legyen (csak kitalált adat van rajta). **[TULAJ]** Éles indulás előtt: `true`, és minden könyvelő
  az első belépéskor beállítja a hitelesítő appot.
- A tesztszkriptek (`https-proba.sh`, `bongeszo-proba.mjs`) `utm_source`-szal regisztrálnak; ezek az ügyfelek
  `clients.is_test = true` jelölést kapnak (csak DEMO-ban), és kimaradnak az admin számaiból.

## 2. ellenőrző kör (2026-11-18 reggel) – ami a szerveren változott

- **Adatbázis-szerepek.** Az API és a worker a `kezjegy_app` szereppel kapcsolódik (nem superuser, nincs
  BYPASSRLS / CREATEDB / CREATEROLE; az `audit_log`-on csak SELECT + INSERT). A migrációkat az API induláskor a
  tulajdonos szereppel futtatja (`MIGRATION_DATABASE_URL`). A régi napló 5 év utáni törlése csak a
  `kezjegy_audit_purge()` SECURITY DEFINER függvényen át megy (0006-os migráció), ami 5 évnél frissebbet soha nem
  töröl. `db-roles.sh` állítja be (az `up.sh` minden futáskor meghívja); az első futás a régi `.env`-et
  `_regi/env_elotte_dbszerep_<idő>` néven elmentette. Visszaállítás: azt a fájlt vissza kell másolni, majd
  `docker compose --env-file /srv/kezjegy/.env -f docker-compose.yml up -d --force-recreate kezjegy-api kezjegy-worker`.
- **Kérésméret.** Caddy: 60 MB csak a feltöltő útvonalakon, minden más 1 MB. Az API ugyanezt nézi útvonalanként,
  folyam közben is (refresh 8 KB, SimplePay IPN 64 KB, JSON 1 MB) – `backend/src/app.ts` `bodyLimitFor`.
- **CSP.** Ügyfél-app: `connect-src` + `blob: data:` (biztonsági háló; az app már nem kér le blob: címet). Panel:
  szigorúbb CSP, Google-források nélkül.
- **Frissítő süti:** `__Host-kj_rt`, `Path=/`, `Domain` nélkül (a sslip.io nincs a Public Suffix Listán, más
  *.sslip.io oldal így nem tud sütit „rádobni”). A régi `kj_rt` sütit már nem olvassuk: a webes ügyfeleknek és a
  panelnek egyszer újra be kell lépnie.
- **DEMO jelszavak újragenerálva** (a régiek egy ellenőrző kör naplójába kerültek): `bash seed.sh --uj-jelszavak`
  – az 5 demó fiók minden munkamenete véget ért; az új lista a `demo_belepesek.txt`-ben (600), a régi `_regi/`-ben.
- **DEMO regisztráció:** amíg nincs valódi levélküldés (DEMO postafiók), csak kitalált címmel (`…@….test`,
  `example.com`) lehet regisztrálni, hogy valódi ember adata ne kerüljön a demóba. A DEMO postafiókban a más
  könyvelőknek/adminoknak küldött jelszó-kódok maszkolva látszanak.
- **Mentés:** `backup.sh` forgat, de nem töröl: a legutóbbi 14 adatbázis-mentés és 4 fájl-pillanatkép marad a
  `backups/` mappában, a régebbiek a `backups/regi/` alá kerülnek. A „Rendszer” oldal 26 óra után pirosan jelez.
- A hibás állapotban maradt 8 GDPR-export újra sorba állt, mind elkészült.

## Élesítés (valódi ügyfelek előtt) – [TULAJ]

1. **Új, üres adatbázis.** A DEMO adatok (kitalált fiókok, DEMO kártyák, DEMO díjbekérők) nem maradhatnak az éles
   adatbázisban. A `kezjegy_kulcsok.ps1` meg is áll, ha `APP_ENV=production`-t adsz meg, és DEMO sorokat talál.
   Javasolt menet: `docker compose … stop`, a `kezjegy_pgdata` kötet átnevezése/megtartása archívként (nem
   törlünk), új kötettel indítás, `up.sh` (migrációk), seed NÉLKÜL, könyvelő meghívása az admin felületről.
2. Kulcsok a `kezjegy_kulcsok.ps1`-gyel (SimplePay, Brevo, NAV, Google…), `STAFF_TOTP_REQUIRED=true`.
3. Saját domain (pl. `app.<domain>.hu`, `konyvelo.<domain>.hu`, `api.<domain>.hu`) – a Gardoko ne fusson a
   Kézjegy-címek szülő-domainjén. `caddy/kezjegy.caddy` host-nevei + `EXPO_PUBLIC_API_URL` + új APK.
4. Éjszakai mentés cronja (lent) és külső másolat (pl. Hetzner Storage Box), a kulcsok és a `.backup_pass`
   offline, külön a mentésektől.
5. A SimplePay szerződés után a SimplePay-logó + fizetési tájékoztató link a kártyás fizetés mellé
   (a kereskedői csomagból; az app most csak szöveges linket mutat).

## 3. ellenőrző kör (2026-11-18 délelőtt) – ami a szerveren változott

- **Titkok szétválasztva.** Az `up.sh` első futása (`gen-env.sh`) a `.env`-ből a `.env.db`-be költözteti a
  `POSTGRES_PASSWORD`, `MIGRATION_DATABASE_URL`, `KEZJEGY_APP_DB_PASSWORD` sorokat (a régi `.env` a
  `_regi/env_elotte_szetvalasztas_<idő>` alá kerül). Az API és a worker így soha nem látja a szuperfelhasználói
  kapcsolatot; a migrációt az egyszer futó `kezjegy-migrate` végzi (`compose --profile migrate run`), utána a
  `db-roles.sh` állítja a `kezjegy_app` jogait, és csak ezután indul az API. Az `up.sh` a végén ellenőrzi, hogy
  az API és a worker környezetében nincs tulajdonosi titok (csak a neveket nézi, értéket nem ír ki).
  A `kezjegy_kulcsok.ps1` továbbra is a `.env`-et írja és az API-t/workert indítja újra – ez így helyes.
  Nyitott: a `kezjegy` tulajdonos még szuperfelhasználó a saját Postgres-konténerében; nem-szuper tulajdonosra
  váltás (séma-tulajdon átadása) külön, karbantartási ablakban.
- **Statikus kiszolgálás (`web.Caddyfile`).** Hiányzó `/assets/*` vagy `/_expo/static/*` fájlra 404 jön
  (`Cache-Control: no-store`), nem az `index.html`; `immutable` csak létező fájlon. Az SPA-visszaesés csak
  oldal-útvonalakra él. A `feltolt.sh` az előző kiadás saját hash-elt fájljait (`.sajat_fajlok.txt` alapján)
  még egy kiadásig megtartja, így a frissítés előtt megnyitott fülek is betöltik a lusta oldalaikat.
- **Mentés:** a `backup.sh` minden futáskor beírja a `backups/regi` méretét és a szabad helyet
  (admin → Rendszer: `backupDisk`, 5 GB fölött vagy 15% szabad hely alatt figyelmeztet). Külső másolat:
  `mentes-kulso.sh` (a tulaj gépéről, a meglévő `hetzner-tar` kapcsolattal, SHA-256 ellenőrzéssel, törlés
  nélkül). **[TULAJ]** Se a cron, se a külső másolat nincs bekapcsolva – mindkettő a te jóváhagyásodra vár.

## Ellenőrzés

- `https-proba.sh` – infrastruktúra (TLS, fejlécek, CSP, 404 az api gyökerén), Kata olvasási folyamatai,
  süti + CSRF-fejléc, szerepkör-elválasztás, Bence és admin nézetei, majd egy **új kitalált ügyfél** végig:
  regisztráció → e-mail kód (DEMO postafiók) → kérdőív → szerződések → SimplePay DEMO fizetés (vissza-URL
  aláírással) → irat feltöltés + aláírt fájllink → üzenet → KYC → meghatalmazás → Bence: irat „látta”, válasz,
  KYC elfogadás, NAV technikai felhasználó + próba + szinkron (DEMO mock), számolás + jóváhagyás → ügyfél
  „befizettem” → könyvelő ellenőrzés → napló → elfelejtett jelszó → 2FA → GDPR export + fióktörlés kérése;
  végül a naplók (nincs e-mail, jelszó, adóazonosító) és hogy csak `appok-caddy-1` publikál portot.
- `docker ps --format '{{.Names}} {{.Ports}}'` – csak `appok-caddy-1` mutat `0.0.0.0` portot.

## SPEC §26 (owner orders 2026-11-18) – deploy notes (backend builder, not deployed yet)

- **Before migrating**: `pg_dump` into `/srv/kezjegy/_regi/` (house rule). Migrations `0008` (enum values only) and
  `0009` (new tables/columns) are additive; the live rows of `alex@` / `tulaj@` are not touched. The worker runs the
  one-time data step at start (marker `system_state['data.tulaj1118']`). Afterwards check `alex@` / `tulaj@`
  `onboarding_steps` unchanged (only `clients.business_status` may change, and only for clients with an adószám).
- **Demo addition** (once, idempotent): `bash /srv/kezjegy/deploy/seed-tulaj1118.sh` – appends Anna (csapat) and
  Levente to `/srv/kezjegy/demo_belepesek.txt` (600), the old list goes to `_regi/`. Never prints passwords.
- **Media**: `bash kod/deploy/feltolt.sh --media` copies `kod/media/` to `/srv/kezjegy/web/media/` (replaced files →
  `_regi/media_<time>/`). `docker-compose.yml` mounts it read-only into `kezjegy-web` at `/srv/media`;
  `web.Caddyfile` serves `/media/*` on the app host (explicit `video/mp4`, `text/vtt`, Range → 206, missing → plain
  404). A changed `web.Caddyfile` / compose needs `up.sh` (recreate `kezjegy-web`); validate first, e.g.
  `docker run --rm -v /srv/kezjegy/deploy/web.Caddyfile:/etc/caddy/Caddyfile:ro caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile`.
- **kezjegy.caddy**: the 60 MB upload rule now also covers `client/business-registration/filed` and `team/attachments`
  (copy the old file to `/srv/appok/_regi/` first, reload the shared Caddy, check Gardoko health before/after).
- **New optional env**: `NEW_BUSINESS_CHARGE_POLICY` (adoszam_utan), `CALLBACK_DUE_HOURS` (48), `CALLBACK_CALLER_ID` (empty).

## SPEC §26 – élesítve 2026-11-18 13:15–13:30 (integrátor)

Sorrend, ahogy ment (a következő §26-os frissítésnél ugyanígy):
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://45-94-65-74.sslip.io/api/v1/health          # Gardoko előtte
ssh appok-1 'bash -s ment elotte_<idő>' < kod/deploy/tulaj-fiokok-allapot.sh                 # alex@ + tulaj@ pillanatkép (600, hash csak a fájlban)
ssh appok-1 'docker exec kezjegy-db pg_dump -U kezjegy -d kezjegy -Fc > /srv/kezjegy/_regi/pg_dump_elotte_<név>_<idő>.dump'   # + chmod 600
ssh appok-1 'cp -p /srv/appok/deploy/Caddyfile /srv/appok/_regi/…; cp -p /srv/kezjegy/caddy/kezjegy.caddy /srv/appok/_regi/…'
bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'                    # migráció (kezjegy-migrate), API, worker (adatlépés), web
node kod/deploy/videok-json.mjs && bash kod/deploy/feltolt.sh --media                       # videok.json (hossz, méret, hasNarration) + videók + útmutató-képek
ssh appok-1 'bash /srv/kezjegy/deploy/seed-tulaj1118.sh'                                     # demó kiegészítés; 2. futás: „már megvan”
ssh appok-1 'bash -s ment utana_<idő>' < kod/deploy/tulaj-fiokok-allapot.sh
ssh appok-1 'bash -s hasonlit elotte_<idő> utana_<idő>' < kod/deploy/tulaj-fiokok-allapot.sh   # → VÁLTOZATLAN
node kod/_qa/k3_eles_video.mjs                                                               # a 3 videó lejátszik az éles címről (belépés nélkül)
```
- Eredmény 11-18: 10 migráció; adatlépés `{businessStatus: 14, callbacks: 2, faq: 4}` (Péter + egy régi QA-ügyfél foglalt
  hívása lett visszahívás); demó kiegészítés 7 elem; alex@ és tulaj@ bájtra azonos (még nem válaszoltak az elágazásra,
  `business_status` NULL → az app megkérdezi). Mentés: `/srv/kezjegy/_regi/pg_dump_elotte_tulaj1118_20261118_131454.dump`.
- `/media/*`: mp4 `video/mp4` + `Accept-Ranges` + Range → 206; vtt `text/vtt; charset=utf-8`; json `application/json`;
  hiányzó fájl → 404 „Nem található.” (nem index.html). A panel hostja nem szolgál ki `/media`-t (404).
- **A három videó most NÉMA, feliratos köztes változat** (OpenRouter 402 a Gemini TTS-re, egyenleg ~0,83 USD). Hangos
  változat: `python C:/Users/UpgradePC/konyvelo_app/video/bekotes/eszkoz/minden.py` és
  `python C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz/epit.py mind`, utána a fenti
  `videok-json.mjs` + `feltolt.sh --media` (a `hasNarration` true lesz, az app „Felirattal, hanggal.”-t ír).
  **11-19 05:35: a bekötés-videó hangos (Umbriel), kék változata él** (98,5 s, 13,1 MB, `hasNarration` true; csak
  `bekotes.mp4`, `bekotes.vtt`, `videok.json` cserélődött, a régiek: `/srv/kezjegy/_regi/media_20261119_053459/`).
  **11-19 06:31: a két útmutató-videó hangos (Umbriel), kék változata is él**: `vallalkozas_bejelentes` 148,0 s, 13,7 MB;
  `meghatalmazas` 95,3 s, 13,8 MB; `hasNarration` true mindháromnál (2 mp4 + 2 vtt + `videok.json` cserélődött, a régiek:
  `/srv/kezjegy/_regi/media_20261119_063118/`; Gardoko health előtte/utána 200; `node kod/_qa/k3_eles_video.mjs` rendben).
  **11-19 08:03: a két útmutató-videó javított kiadása él** (a független ellenőrzés hibalistája után: BT.709 színcímkék –
  a böngésző a sávot #1428DC-nek festi, eddig #0F31E4 volt –, a sorok eleji kattanások levágva, a csúcs -2,2 dBTP,
  hosszabban látszó jelölések, újrajelölt NAV-képek): `vallalkozas_bejelentes` 146,1 s, 13,9 MB; `meghatalmazas` 97,4 s,
  13,8 MB. Csak média: 2 mp4 + 2 vtt + `videok.json` + a meghatalmazás-útmutató 6 újrajelölt képe (08, 10–14, @2x-szel
  együtt 12 fájl) + a `kepek.json` cserélődött – 18 fájl, a régiek: `/srv/kezjegy/_regi/media_20261119_080256/`. A
  `bekotes.*` nem változott. Újraindítás nem volt; Gardoko health előtte/utána 200; az élő fájlok sha256-ra egyeznek a
  `kod/media/`-val (44 fájl); Range → 206; `node kod/_qa/k3_eles_video.mjs` rendben. Sorrend, ha útmutató-kép is változik:
  `python utmutato_kepek/annotate.py …` → `python video/vallalkozas_bejelentes/eszkoz/epit.py mind` →
  `node kod/app/scripts/utmutato-kepek.mjs` → `node kod/deploy/videok-json.mjs` → `bash kod/deploy/feltolt.sh --media`.
  **11-19 09:51: mindhárom videó 2. javított kiadása él** (a 2. független ellenőrzés hibalistája után): mindhárom
  hangsáv MONO és csatornánként -16,3 LUFS (a bekötés-videó sztereó volt, csatornánként 3 dB-lel halkabb), a sorok eleji
  és egy soron belüli kattanás eltűnt, a feliratok a mondat tagolása szerint törnek, egy írásmód (áfamentes), a nézet
  széle nem vág félbe sort / gombot, a meghatalmazás 03, 05, 06, 14, 15. képe újrajelölve (a 14–15. ikonjának köre
  teljes). `bekotes` 98,7 s, 13,2 MB (L05: „…hova kell fizetned.”); `vallalkozas_bejelentes` 146,5 s, 13,9 MB;
  `meghatalmazas` 97,3 s, 14,1 MB. Csak média: 3 mp4 + 3 vtt + `videok.json` + 10 útmutató-kép (@2x-szel) + a
  meghatalmazás `kepek.json`-ja – 18 fájl cserélődött, a régiek: `/srv/kezjegy/_regi/media_20261119_095114/`. Újraindítás
  nem volt, az adatbázishoz senki nem nyúlt; Gardoko health előtte/utána 200; az élő `/media` 80 fájlja sha256-ra egyezik
  a `kod/media/`-val; Range → 206; `node kod/_qa/k3_eles_video.mjs` rendben.
  **11-19 10:42: záró élesítő ellenőrzés (a 3. független ellenőrzés után) – új feltöltés NEM kellett, a szerveren semmi nem
  változott.** A három videó 9 fájlja (mp4 + vtt + poszter) és a `videok.json` (újragenerálva: bájtra ugyanaz, `hasNarration`
  true mindháromnál) az élő `/media`-n sha256-ra egyezik a `video/<név>/` és a `kod/media/` fájljaival – a 09:51-es kiadás
  a végleges. Az élő fájlokból kivett kockák és a poszterek kékek (a sáv #1428DB ± 2; Chrome-ban #1428DC), a hangsáv mono,
  beszéddel; az élő app-csomag a kártyán „Felirattal, hanggal.”-t ír, ha a `hasNarration` nem false. Gardoko health
  előtte/utána 200; `node kod/_qa/k3_eles_video.mjs` rendben (a korábbi képek: `kod/_qa/_regi/k3_eles_elotte_20261119_1040/`).
  Hangköltség a három `koltseg.jsonl` szerint: 0,5915 USD a 0,60-ból (bekötés 0,2804; bejelentés 0,2269; meghatalmazás 0,0841).
  **Figyelem – helyben vár, NEM él:** a `kod/media/utmutato/vallalkozas_bejelentes/` 13 fájlja (a 02, 03, 04, 11, 13, 14.
  kép @2x-szel + `kepek.json`; 10:05, a NAV-kisfilmből vett valódi képek, `utmutato_kepek/README.md`) újabb, mint az élő.
  A következő `feltolt.sh --media` ezeket is kiteszi; a bejelentés-videó (09:49) még a rajzolt változatukat mutatja
  (videó újra a meglévő hanggal: `python utmutato_kepek/_eszkoz/video_ujra.py vallalkozas_bejelentes`). Ez a lépés nem tette ki.
- Helyi végigjátszás élesítés előtt (valódi backend PGlite-tal, app :8811 + panel :8812, jelszót senki nem gépel):
  `node kod/_qa/k3_e2e.mjs` → `kod/_qa/k3_e*.png`, `k3_p*.png`, `k3_e2e_eredmeny.json` (11-18: 36 ellenőrzés rendben).

## 1. kör, 2026-11-19 – ami a telepítésben változott

- **Csak a szerveroldal frissítése:** `bash kod/deploy/feltolt.sh --no-web`, majd `ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'`
  (a webes buildekhez nem nyúl).
- **Mentés a migráció előtt, titkosítva.** Az `up.sh` minden futáskor készít egy `pg_dump`-ot a migráció ELŐTT, a
  `.backup_pass`-szal titkosítva: `/srv/kezjegy/_regi/db_elotte_up_<idő>.dump.gpg`. Mentés nélkül nincs migráció.
  A korábbi, kézzel készült 4 mentés (`_regi/pg_dump_elotte_*.dump`) még titkosítatlan (600-as fájl, 700-as mappa) –
  **[TULAJ]** ha kell, titkosítsd vagy vidd el őket; mi nem törlünk.
- **`kezjegy.caddy` ellenőrzése feltöltéskor.** A `feltolt.sh` az új fájlt a közös Caddy saját konfigurációjával
  ellenőrzi (`caddy validate`); ha hibás, a régi marad érvényben, és a feltöltés megáll. Így egy elrontott fájl egy
  későbbi Caddy-újraindításnál sem viheti el a Gardokót.
- **Kérésméret:** az egyfájlos útvonalak (`*/attachments`) 26 MB-ot kapnak (eddig 60), a többi feltöltő útvonal 60 MB-ot.
- **Memória:** `kezjegy-api` 1280 MB (egyszerre legfeljebb 2 feltöltés fut a szerveren, hívónként 1). A worker 512 MB
  maradt: az adatmásolat (GDPR-export) már folyamként készül.
- **`/api/v1/health`** névtelenül csak `ok`, `version`, `db`. A módokat az admin „Rendszer” oldala mutatja; a
  `https-proba.sh` a DEMO-jelölést a `/config`-ból nézi.
- **[TULAJ] még nyitva:** az éjszakai mentés cronja és a külső másolat (fent, „Mentés és visszaállítás”); a
  `STAFF_TOTP_REQUIRED=true` valódi adat előtt; saját domain (utána `includeSubDomains` a HSTS-be); a 443/udp
  megnyitása vagy a HTTP/3 kikapcsolása a közös Caddyben; `X11Forwarding no` az sshd-ben; a
  `C:\Users\UpgradePC\konyvelo_app\DEMO_BELEPESEK.txt` helyi jelszólista megszüntetése (a jelszavak csak a szerveren legyenek).

## SPEC §27 (owner orders 2026-11-19) – deploy notes of the backend builder (B1; NOT deployed, the integrator does it)
- **Migrations** (`kod/backend/drizzle/`): `0011_tulaj1119_enumok.sql` (only `ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS` × 10), `0013_tulaj1119_tiltas.sql` (`clients.disabled_at/disabled_reason`, S9) and `0012_tulaj1119.sql` (new table `assist_requests`; `business_registrations.mode/chamber_due_on/chamber_done_at/chamber_reminders`; `clients.business_status_changed_at`; `users.totp_locked_until`; three CHECK constraints widened = drop + re-add with the old values plus the new ones). Additive only. SPEC §27.7.1 calls them 0010/0011 – the number 0010 was already taken by `0010_kor1_1119`. Order: pg_dump → `feltolt.sh` → `up.sh` (runs all three) → the worker runs the one-time data step `data.tulaj1119` at start → `bash /srv/kezjegy/deploy/seed-tulaj1119.sh` (Marika, Dávid, Ilona; two lines appended to `demo_belepesek.txt`, nothing printed).
- **New env (all optional, defaults in brackets)**: `ASSIST_EV_ENABLED` [true] – kill switch of "Intézzük helyetted" for the EV part; `ASSIST_EV_VALID_UNTIL` [2026-12-31]; `ASSIST_UJEGYKE_JOGCIM` [9 | 60]; `QUOTA_BEFORE_ACTIVATION_MB` [300], `QUOTA_AFTER_ACTIVATION_MB` [4096], `MIN_FREE_DISK_MB` [5120] and `MIN_FREE_DISK_PCT` [0 = off] (§27.11 S6: uploads answer 413 `quota_exceeded` / 507 `storage_full` – an absolute floor, because the developer PCs run at 95 % full and a % rule would stop their local harnesses; the admin Rendszer page shows `filesFreeDiskPct`). Add them to `env.example` when the integrator touches it.
- **Uploads (§27.11 S5)**: the API now keys the upload slot on the user (not the token) and answers 408 after 120 s. Caddy still streams bodies: `request_buffers` on the three upload matchers of `kezjegy.caddy` would stop a slow sender before the API – a change of the SHARED Caddy file, so only with the copy to `/srv/appok/_regi/` and the Gardoko health check before/after (integrator's call; not required).
- **Containers (§27.11 S15)**: `pids_limit` added to migrate/api/worker/web (no other effect). The dedicated uid is OPT-IN, never by default (a wrong owner would stop file writes): 1) `sudo groupadd -g 10001 kezjegy && sudo useradd -u 10001 -g 10001 -M -s /usr/sbin/nologin kezjegy`; 2) `sudo chown -R 10001:10001 /srv/kezjegy/data/files /srv/kezjegy/_seed /srv/kezjegy/hirdetes` (the write mounts, plus the read-only Google ad key folder of SPEC §31.6 – its `google.json` is 600, so the container user must own it; `web/` is mounted read-only and must stay world-readable); 3) `KEZJEGY_UID=10001` and `KEZJEGY_GID=10001` into `/srv/kezjegy/.env`; 4) `up.sh`; 5) upload one file on the DEMO and check the health of both apps. Run `seed-tulaj1119.sh` BEFORE switching (its credentials copy is owned by the deploy user and the container appends to it).
- **Sign-in routes (§27.11 S3)**: every JSON body must carry `Content-Type: application/json` (415 otherwise); POSTs to `/auth/*` from another site (`Sec-Fetch-Site: cross-site`, or an `Origin` that is neither the request's own host nor APP/PANEL/API_PUBLIC_URL) answer 403. Our app and panel already send JSON; native apps send no Origin. Live check after deploy: `curl -s -o /dev/null -w '%{http_code}' -X POST -H 'content-type: text/plain' --data '{}' https://api.45-94-65-74.sslip.io/api/v1/auth/login` → 415 (no password typed).

## SPEC §27 – élesítve 2026-11-19 13:18–13:23 (integrátor)
Sorrend, ahogy ment (a következő frissítésnél ugyanígy):
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://45-94-65-74.sslip.io/api/v1/health                 # Gardoko előtte: 200
ssh appok-1 'bash -s ment elotte_integ1119_<TS>' < kod/deploy/tulaj-fiokok-allapot.sh               # alex@ + tulaj@ pillanatkép
# titkosított pg_dump a _regi-be (ugyanúgy, mint az up.sh: gpg AES256, .backup_pass), utána pg_restore -l próba
ssh appok-1 'umask 077; F=/srv/kezjegy/_regi/pg_dump_elotte_<név>_<TS>.dump.gpg; docker exec kezjegy-db pg_dump -U kezjegy -d kezjegy -Fc | gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-file /srv/kezjegy/.backup_pass --symmetric --cipher-algo AES256 -o $F'
ssh appok-1 'cp -p /srv/appok/deploy/Caddyfile /srv/appok/_regi/Caddyfile_elotte_kezjegy_<név>_<TS>; cp -p /srv/kezjegy/caddy/kezjegy.caddy /srv/appok/_regi/kezjegy.caddy_elotte_<név>_<TS>'
bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'                         # migráció 0011–0013, worker: data.tulaj1119
ssh appok-1 'bash /srv/kezjegy/deploy/seed-tulaj1119.sh'                                           # Marika, Dávid, Ilona; 2. futás: „már megvan”
bash kod/deploy/feltolt.sh --media                                                                 # útmutató-képek (a 7 valódi NAV-kocka)
ssh appok-1 'bash -s ment utana_integ1119_<TS>' < kod/deploy/tulaj-fiokok-allapot.sh
ssh appok-1 'bash -s hasonlit elotte_integ1119_<TS> utana_integ1119_<TS>' < kod/deploy/tulaj-fiokok-allapot.sh   # → VÁLTOZATLAN
```
- Eredmény 11-19: migrációk 11 → 14; adatlépés `{faqUpdated: 7, faqInserted: 1, assists: 0, content: 0}`; demó kiegészítés 3 új
  elem (a lista 10 sor, 600); média 13 cserélt fájl (régiek: `/srv/kezjegy/_regi/media_20261119_132223/`); alex@ és tulaj@
  VÁLTOZATLAN; a meglévő ügyfelek `onboarding_steps` md5-je előtte/utána azonos; Gardoko előtte/utána 200. Mentések:
  `/srv/kezjegy/_regi/pg_dump_elotte_integ1119_20261119_131813.dump.gpg` (pg_restore -l: 381 objektum) és az up.sh saját
  `db_elotte_up_20261119_132053.dump.gpg`-je. A `kezjegy.caddy` és a `web.Caddyfile` nem változott (a közös Caddyhez nem nyúltunk).
- Nyilvános ellenőrzés (jelszó nélkül, curl): mindhárom host health 200; `/auth/login` text/plain → 415, idegen Origin → 403;
  `/client/assist`, `/team/assists` token nélkül 401; az előző kiadás egy-egy hash-elt JS-e (app, panel) 200; `/media/bekotes.mp4` Range → 206.
- Helyi végigjátszás élesítés előtt: `node kod/_qa/k5_integ_harness.mjs` (APP_PORT/PANEL_PORT) + `node kod/_qa/k5_integ_proba.mjs`
  → `kod/_qa/k5_integ_*.png`, `k5_integ_eredmeny.txt`.
- **Nem tettük meg (a tulaj igene kell):** az éjszakai mentés cronja (S11) és a régi titkosítatlan `_regi/pg_dump_*.dump`
  fájlok titkosítása / elvitele (S10); a saját uid a konténereknek (S15, „Saját uid” fent).

## Média – élesítve 2026-11-19 14:18 (képek + videók, a 11-19-i tulaj-kérések)
Sorrend (ha útmutató-kép vagy videó változik, mindig így):
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://45-94-65-74.sslip.io/api/v1/health   # Gardoko előtte: 200
node kod/app/scripts/utmutato-kepek.mjs                 # utmutato_kepek/ -> kod/media/utmutato/ (kepek.json)
python utmutato_kepek/_eszkoz/media_kicsinyit.py        # ÚJ: az app képei 256 színnel (telefonra), a normalizáló után MINDIG
node kod/deploy/videok-json.mjs                         # hossz, méret, hasNarration
bash kod/deploy/feltolt.sh --media                      # csak média; a közös Caddyhez nem nyúl
```
- Eredmény: 7 új + 75 cserélt fájl (a régiek: `/srv/kezjegy/_regi/media_20261119_141757/`). A három videó (mp4 + vtt + poszter),
  a `videok.json` (107,0 / 149,6 / 98,0 s, `hasNarration` true), a bejelentés- és a meghatalmazás-útmutató képei kicsinyítve
  (a két útmutató 68 képe 23,1 MB helyett ~7 MB), és az új `utmutato/meghatalmazas_jovahagyas/` (3 valódi kép + `kepek.json`).
- Ellenőrzés curl-lel (jelszó nélkül): a 10 fő fájl sha256-ja az éles `/media/`-n = a `kod/media/`-é; az éles `/media` 87
  fájlja (ssh-n át) mind egyezik a `kod/media/`-val (csak a szerveren lévő régi APK-mappa többlet); mp4 Range → 206; a három
  host health 200; Gardoko előtte/utána 200. Adatbázishoz, konténerhez, Caddyhez nem nyúltunk.

## Javító kör 2 – élesítve 2026-11-19 18:07–18:11
Sorrend: Gardoko health 200 → `tulaj-fiokok-allapot.sh ment elotte_j2_20261119_180719` → titkosított pg_dump
`/srv/kezjegy/_regi/pg_dump_elotte_j2_20261119_180719.dump.gpg` (pg_restore -l: 399 sor) → a közös Caddy két fájljának másolata
`/srv/appok/_regi/*_elotte_kezjegy_j2_20261119_180719` (nem változtak) → `feltolt.sh` → `up.sh` (nincs új migráció, 14 maradt;
a worker új feladata: `assist_overdue`) → normalizáló + `media_kicsinyit.py` + `videok-json.mjs` → `feltolt.sh --media` (13 cserélt
fájl, régiek: `/srv/kezjegy/_regi/media_20261119_181030/`) → pillanatkép utána: alex@ és tulaj@ VÁLTOZATLAN → Gardoko 200,
api/app/konyvelo health 200, mp4 Range 206, `/client/assist` token nélkül 401; az éles app-csomagban benne vannak az új szövegek.
Helyi próba: `PORT=8864 node kod/app/scripts/_helyi_j2.mjs` (+ `allapot=inditas_kerdoiv | segitett_nemvette`, staff TOTP csak itt
kikapcsolva) és `BASE=http://127.0.0.1:8864 node kod/app/scripts/_kepek_j2.mjs` → `kod/_qa/j2_*.png`, `j2_eredmeny.json`;
panel: `VITE_API_PROXY=http://127.0.0.1:8864 npx vite --port 5191` + `scripts/_panel_j2.mjs` → `kod/_qa/j2_panel_*.png`.

## k6 (SPEC §28 + §28.K, átnevezés „Adózz”) – integrátor 2026-11-19 22:45: KÉSZ HELYBEN, MÉG NEM ÉL
Az élesítést az automatikus engedélyszűrő megállította a `feltolt.sh`-nál – a szerveren eddig csak ez történt: Gardoko 200,
pillanatkép `fiokok_elotte_k6integ_20261119_224123.txt`, titkosított mentés `/srv/kezjegy/_regi/pg_dump_elotte_k6integ_20261119_224123.dump.gpg`
(pg_restore -l: 399 sor), a közös Caddy két fájljának másolata `/srv/appok/_regi/*_elotte_kezjegy_k6integ_20261119_224123` (nem változtak).
A buildek készen állnak (`app/dist` – benne az „Adózz” név és az új ikon –, `panel/dist`, `backend` tesztek 300/300). A folytatás, ugyanígy:
```bash
curl -s -o /dev/null -w '%{http_code}\n' https://45-94-65-74.sslip.io/api/v1/health                 # Gardoko: 200
ssh appok-1 'bash -s' < kod/deploy/fiok-szamok.sh                                                   # ÚJ: csak darabszámok (alex@, tulaj@, david@, bence.kovacs@)
bash kod/deploy/feltolt.sh && ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'                         # migráció 0014–0016 (csak bővít), worker: data.ot1119 + data.k28
ssh appok-1 'bash /srv/kezjegy/deploy/seed-ot1119.sh' && ssh appok-1 'bash /srv/kezjegy/deploy/seed-k28.sh'   # új kitalált ügyfelek; 2. futás: „már megvan”
node kod/app/scripts/utmutato-kepek.mjs && python utmutato_kepek/_eszkoz/media_kicsinyit.py && node kod/deploy/videok-json.mjs
bash kod/deploy/feltolt.sh --media                                                                 # ÚJ: utmutato/valtozas_<fajta>/ (6 mappa, elmosott NAV-képek)
ssh appok-1 'bash -s ment utana_k6integ_<TS>' < kod/deploy/tulaj-fiokok-allapot.sh
ssh appok-1 'bash -s hasonlit elotte_k6integ_20261119_224123 utana_k6integ_<TS>' < kod/deploy/tulaj-fiokok-allapot.sh
ssh appok-1 'bash -s' < kod/deploy/fiok-szamok.sh                                                   # david@: 20 irat, 33 számla, 34 bevétel, 9 üzenet maradjon
```
Előtte (11-19 22:41) a darabszámok: alex@ és tulaj@ bekotes_alatt, minden 0; david@ aktiv, 20 irat / 33 NAV-számla / 34 bevétel / 9 üzenet /
14 értesítés / 5 negyedév / 1 adóprofil; bence.kovacs@ active, 23 ügyfél; összesen 26 felhasználó, 23 ügyfél, 14 migráció; tárolt szövegben
„Kézjegy”: 0. Helyi végigjátszás: `APP_PORT=8871 PANEL_PORT=8872 node kod/_qa/k6_integ_harness.mjs` + `node kod/_qa/k6_integ_proba.mjs`
→ `kod/_qa/k6_integ_*.png`, `k6_integ_eredmeny.txt` (50/50 rendben).

## k6 + k6c + k6c2 – élesítve 2026-11-20 08:28–08:34
Az integrátor (11-19 22:41) és a k6c kör élesítése a `feltolt.sh`-nál megállt; ez a kör vitte ki mindet egyben (a 2. javító
kör k6c2 javításaival). A Gardoko 11-20 óta törölve: a 502 várt, helyette az Adózz három címe 200 előtte és utána.
Sorrend: api/app/konyvelo health 200 → `fiok-szamok.sh` + `tulaj-fiokok-allapot.sh ment elotte_k6c2_20261120_082850` →
`feltolt.sh` → `up.sh` (titkosított mentés `_regi/db_elotte_up_20261120_083151.dump.gpg`, migráció 0014–0016: 14 → 17,
csak bővít; worker: data.ot1119, data.k28, data.k6c) → `seed-ot1119.sh` (4 új) + `seed-k28.sh` (5 új kitalált ügyfél) →
`utmutato-kepek.mjs` + `media_kicsinyit.py` + `videok-json.mjs` → `feltolt.sh --media` (78 új, 2 cserélt) →
`hasonlit elotte_k6c2_20261120_082850 utana_k6c2_20261120_083340`: VÁLTOZATLAN. david@: 20 irat / 33 számla / 34 bevétel /
9 üzenet / 14 értesítés / 5 negyedév – előtte és utána ugyanaz; bence.kovacs@ 3 élő munkamenete megmaradt (23 → 32 ügyfél).
Az éles `index.html` = a helyi build; a két új útmutató-kép sha256-ja egyezik; `/client/reserve` token nélkül 401.
Helyi próba: `APP_PORT=8891 PANEL_PORT=8892 node kod/_qa/k6_integ_harness.mjs` + `APP=http://127.0.0.1:8891 node kod/_qa/k6c2j_javito_proba.mjs`
→ `kod/_qa/k6c2j_*.png`, `k6c2j_eredmeny.txt`.
