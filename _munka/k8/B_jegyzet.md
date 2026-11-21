# k8 – ALAP-B jegyzet (2026-11-21)

Átadás a FELÜLET-A / FELÜLET-P építőknek és az INTEGRÁTOR-nak. A SPEC-et és a deploy/README-t NEM írtam (integrátor).
Régi fájlok: `kod/<csomag>/_regi/elotte_k8_B/…` (a 64b4b14 alapcommitból), a próbaszkriptek: `kod/deploy/_regi/elotte_k8_B/`,
`kod/_qa/_regi/elotte_k8_B/`, az egyszeri app-szkriptek áthelyezve: `kod/app/_regi/elotte_k8_B/scripts/`.

## Adatbázis (csak hozzáadó)
- `drizzle/0027_k8_enumok.sql`: notification_kind + `transfer_request`, `transfer_reminder`.
- `drizzle/0028_k8.sql`: `clients.customer_no` (szekvencia 10001-től, a meglévők `created_at` sorrendben kapnak számot, DB-default
  nextval – a kód nem írja), `subscriptions.billing_method` ('kartya' | 'atutalas', alap 'kartya'), új `transfer_requests` tábla
  (egyedi `order_no`; havonta egy élő díjbekérő / előfizetés, egy nyitott első havi / ügyfél), `demo_outbox.body_html`,
  `users.mfa_email_enabled_at` (B7-hez előkészítve, nem használt).

## Végpontok
- Ügyfél: `GET /client/billing` → `ClientBillingView`; `POST /client/billing/transfer {purpose:'subscribe'|'switch'}`
  (409 `atutalas_kikapcsolva`, 409 `step_locked` nyitott visszahívásnál, 503 `not_configured` ha nincs számlázó-útvonal).
- Konzol (TOTP; írás step-uppal): `GET /admin/console/transfers?status=fizetett|var|kesik|hiba&clientId=`,
  `GET /admin/console/transfers/summary`, `POST /admin/console/transfers/:id/paid {paidOn, amountHuf, reason}` (az összeg
  csak a díjbekérőé lehet: 409 `osszeg_elteres`), `POST /admin/console/transfers/:id/resend`,
  `GET|PUT /admin/console/switches/fizetes {atutalas?, kesesLeallit?, kozlemeny?, reason}`.
- Admin: `GET /admin/demo-outbox/:id/html` → `{url}` (aláírt, 5 perces link) → nyilvános `GET /api/v1/demo-level/:token`
  saját szigorú CSP-vel (csak DEMO). A panel CSP-je tiltja a frame-et, ezért új lap.
- `/config` új mező: `fizetes: { atutalas: boolean }` (kapcsoló ÉS van számlázó-útvonal).
- `POST /client/guided {action:'callback_offer_skip'}` – „Nem kell, mehetünk tovább”.

## DTO-k, szövegek: `kod/shared/src/k8.ts`
`BillingMethod`, `FizetesKapcsolok` (+ `fizetesKapcsolokDefault(appEnv)`), `TRANSFER_RULES` (8 nap, emlékeztető 1/4/8, zárás 8),
`orderNoOf()`, `kozlemenyOf()`, `TransferRequestView`, `ClientBillingView`, `AdminTransferRow`, `AdminTransferSummary`,
`TRANSFER_TEXTS`, `CALLBACK_OFFER_TEXTS`, `LOCK_ELOFIZETES_VISSZAHIVAS_UTAN`, `MAIL_FOOTER_KINDS`. Tartalomkulcsok:
`backend/src/content/k8.ts` (`k8.ui.*`, `k8.visszahivas_ajanlat.*`, `email.transfer_request|transfer_reminder|fee_invoice[.havidij|.sztorno|.helyesbito]|welcome|subscription_started|account_locked|guided_continue|fee_waived|account_disabled|account_enabled`, `email.<kind>.gomb`, `email.generic.footer_munkatars`).
Vezetett futás: új pszeudo-lépés `visszahivas_ajanlat` (GUIDED_ORDER van / inditas_onallo, az `elofizetes` előtt), útvonal
`/bekotes/visszahivas-ajanlat`.

## Kapcsolók (`system_state['kapcsolok.fizetes']`, `value ||` összefésüléssel)
- `atutalas`: DEMO-n alapból BE, élesben alapból KI (amíg az ÁSZF nem ismeri). KI = új választás 409; aki már átutalással fizet,
  annak a díjbekérője tovább jön.
- `kesesLeallit`: alap KI (nyitott tulaj-döntés). BE: a határidő után 8 nappal zárolás `atutalas_kesik` okkal.
- `kozlemeny`: alap `havi` (= a díjbekérő rendelésszáma, pl. ADZ-10482-2026-12), `allando` = ADZ-10482. Indok lent.
Átállítás: konzol → Rendszer → „Átutalásos fizetés” (step-up, napló), vagy SQL `value || '{"atutalas":true}'`.

## Számlázz.hu Agent – ellenőrizve a hivatalos doksiból (docs.szamlazz.hu „Számla XML lekérdezése – válasz”)
- Lekérdezés: `action-szamla_agent_xml`, `xmlszamlaxml` (szamlaszam | rendelesSzam | szamlaKulsoAzon, pdf). A válasz gyökere
  `szamla`; a fizetettségnek NINCS külön jelzője: a `kifizetesek/kifizetes` (datum, jogcim, osszeg, megjegyzes, bankszamlaszam)
  lista az állapot; `alap/tipus` D = díjbekérő, SZ/VS = számla; `alap/hivdijbekszam` = a díjbekérő száma, amiből a számla készült.
- Az Autokassza (szamlazz.hu leírás szerint) a beérkező utalás KÖZLEMÉNYÉBEN számlaszámot, díjbekérő-számot vagy rendelésszámot
  keres; üres közleménynél a küldő számlaszámot nézi. Ezért a fix `ADZ-10482` közlemény a havonta más rendelésszámú díjbekérőhöz
  valószínűleg NEM párosul → alapértelmezés `havi` közlemény. Az állandó átutalás így nem működik (havonta más a közlemény).
  **Tulaj-kérdés marad.** Élőben nem próbáltam (nincs kulcs a gépen) – mock + teszt.
- Az Autokassza a kifizetett díjbekérőből magától számlát készíthet és ki is küldheti → kezeljük: ha a lekérdezés számlát ad
  vissza (`tipus`≠D, `hivdijbekszam` = a mienk), a díjbekérő fizetett, és a végszámla ezt ÁTVESZI (nincs második számla).
  **Tulaj-teendő:** a Számlázz.hu-ban az automatikus számla-kiküldést kikapcsolni (különben az ügyfél két levelet kap).
- Végszámla átutalásnál: `dijbekeroSzamlaszam`, `fizmod Átutalás`, teljesítés = a beérkezés napja, `sendEmail=false`.
  Kártyásnál is `sendEmail=false` (K8_TERV:22), a sztornóban nincs vevő-e-mail. Saját levél PDF-fel: `email.fee_invoice.*`.

## Levelek
- `backend/src/notify/sablon.ts`: a `dizajn/email/sablon.html` konstansként + renderelő. MINDEN levél HTML-része ezzel megy
  (`mailer.ts htmlOfMail`; szerkezett `level`, vagy a sima szövegből: bekezdések, magányos 6 jegyű kód → kódblokk, záró link →
  gomb/„Megnyitom”). „Adózz.hu” mindig teljes, kifejezett link (blokkszinten, meglévő `<a>`-n belül nem). A text/plain és a
  tárgyak változatlanok. Lábléc-változatok: ügyfél, munkatárs, fiók nélküli, kód, visszahívás.
- **Döntés:** a tipp/info doboz a levélben is fehér + 4 px telt bal sáv (nem #FFF6DB / #EAEDFC) – a „nincs halvány pasztell
  doboz” szabály miatt.
- JL-levelek: 14 üdvözlő (regisztráció megerősítése után) + „Elindult az előfizetésed” (első sikeres fizetés), 15 fiókzár,
  16 „Folytasd” (napi job, csak a job első futása UTÁN regisztráltaknak – a mostani bekötés alattiak, köztük a tulaj tesztfiókjai,
  nem kapnak meglepetés-levelet), 18 díj elengedve, 19 letiltva/feloldva, 20–21 + „átutalás késik” sorok az admin napi
  összesítőjében. 17 (éves határidő): az `annual_due` e-mail a 11-21-es javító körben már BE van – nem készült külön levél.

## App (MOSTANI stílus – A hozza v2-re)
B-tulajdonú (F2b-ben A veszi át): `app/bekotes/elofizetes.tsx` (ajánlat-kártya, „Hogyan fizetnél?”, átutalás-ág),
`app/bekotes/visszahivas-ajanlat.tsx` (ÚJ), `app/fiok/elofizetes.tsx` (`<AtutalasFiok>`), `app/fiok/dijszamlak.tsx`
(díjbekérők felül), `app/elofizetes/eredmeny.tsx` („Inkább átutalom”), `api/hooks-k8.ts` (ÚJ: `useSzamlazas`,
`useAtutalasValasztas`, `useAjanlatKihagyas`), `api/minta/k8.ts` (ÚJ), `api/minta/szerver.ts`, `api/minta/k29.ts`,
`kepernyok/Atutalas.tsx` (ÚJ: `UtalasiAdatok`, `AtutalasValaszto`, `AtutalasBekotes`, `AtutalasFiok`),
`kepernyok/VisszahivasAjanlat.tsx` (ÚJ). A `tests/k3c3.test.ts` egy sora indokkal módosult (időígéret ki).

## Panel (MOSTANI stílus – P hozza v2-re)
`api/k8.ts` (ÚJ), `pages/admin/konzol/Atutalas.tsx` (ÚJ: `AtutalasSzakasz`, `KeziJelolesFiok`, `FizetesKapcsolokLap`,
`allapotCimke`), `konzol/Attekintes.tsx` (Átutalás szakasz), `konzol/UgyfelKartya.tsx` (ügyfél díjbekérői), `Rendszer.tsx`
(kapcsolók), `DemoPosta.tsx` („Levél képe”), `Elofizetesek.tsx` (oszlop: kártya / átutalás), `mock/k8.ts` (ÚJ) +
`mock/server.ts`, teszt `konzol/atutalas.test.tsx`. Nem készült: `konzol/Ugyfelek.tsx` szűrő (fizetési mód / késik) – a díjbekérő
tábla szűrője kiváltja; a fizetési mód oszlop az Előfizetések oldalon van.

## k7b-maradékok
- Időígéretek ki a shared/backend/jogi szövegekből (bekotes.ts, k29g.ts, k29f.ts, enums.ts, tulaj1118.ts, tulaj1119.ts,
  defaults.hu.json, onboarding.ts; jogi `tartalom` egységesítve a kóddal, app_szovegek.md újragenerálva). Az egyetlen engedett
  mondat szó szerint; a jogszabályi határidők maradnak (`5 munkanapon belül`, `4 napon belül`). Őr: `test/k8-szovegek.test.ts`.
  Az app/panel saját forrásában maradt ilyen szöveg (pl. app `lib/ut.ts` „Kollégánk 24–48 órán belül hív.”) → A2 / P4.
- Dupla kártyatörlés-levél: feltételes frissítés, csak a ténylegesen törlő hívás küld levelet (teszt).
- `https-proba.sh` / `bongeszo-proba.mjs`: k29 kártyás út (DEMO-n végigkattint, Stripe TESZT-nél csak a Checkout URL-t nézi).
- `_qa/k5|k6|k7_integ_harness.mjs`: a k7b-s regisztrációra igazítva (202 + `/auth/register/verify`).
- Új APK: nem (tulaj-döntés, opcionális).

## Nyitott / integrátornak
- Tulaj: közlemény-formátum (havi vs. állandó), késésnél leállás, Erste + Autokassza bekötése, a Számlázz automatikus
  számlakiküldésének kikapcsolása, Lark: `ertesites@` alias az `ugyfelszolgalat@`-on (Próbalevél tanulsága), ÁSZF (ügyvéd).
- B7 (e-mailes kétlépcsős belépés) NEM készült el ebben a körben (csak az oszlop).
- Telepítés előtt: `pg_dump`; a 0028 egy adatírást tartalmaz (customer_no első feltöltése ~38 ügyfélre).
- DEMO-adatlépés `data.k8`: két kitalált ügyfél („Utaló Péter” fizetett, „Átutaló Ágnes” késik), belépés nélkül.
