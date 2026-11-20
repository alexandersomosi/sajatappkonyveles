## 29. Stripe, Számlázz.hu, adozz.hu (k7) – contract

Written 2026-11-20 ~11:00 by the k7 planner after reading `backend/src/payments/{simplepay,invoices}.ts`, `services/{subscription,dijak,zarolas,szuneteltetes,journey,onboarding,gdpr,access}.ts`, `routes/{public,client,client-k28,acc-k28,admin}.ts`, `config.ts`, `http/core.ts` (`sameSiteGuard`), `db/schema.ts`, `kod/shared/src/{enums,bekotes,api}.ts`, the app (`bekotes/{index,adatok,elofizetes}.tsx`, `fiok/elofizetes.tsx`, `lib/{simplepay,ut}.ts`, `index.tsx`), the panel routes (`App.tsx`), `kod/deploy/{docker-compose.yml,kezjegy.caddy,web.Caddyfile,up.sh,README.md}`, `kezjegy_kulcsok.ps1`, `stripe_teszt_kulcs.ps1`, `kod/jogi/aszf.md`, the live server **read-only** (`appok-caddy-1` publishes 80/443 with the volumes `appok_caddy_data` + `appok_caddy_config`, networks `appok_edge`, `appok_internal`, bind mounts `/srv/appok/deploy/Caddyfile`, `/srv/appok/web`, `/srv/kezjegy/caddy`; checked 11-20 10:40) and DNS (`adozz.hu`, `www.adozz.hu`, `app.adozz.hu`, `konyvelo.adozz.hu`, `api.adozz.hu` → **45.94.65.74**, checked 11-20 10:40), plus the official sources of §29.20. **§29 wins over every older section where they differ.** Old SPEC: `kod/_regi/SPEC_elotte_k7_1120.md`.

### 29.0 Orders → sections, precedence, principles, builders

| # | Owner's order (11-19 / 11-20) | Where |
|---|---|---|
| A | Payments = **Stripe** (Payments API only: no Stripe Billing, no Stripe invoices, no merchant-of-record); SimplePay code kept, switched off | §29.1 |
| B | Fee invoices via **Számlázz.hu** Számla Agent (the owner already uses it) | §29.2 |
| C | **adozz.hu** domains; the public proxy moves from the old `appok` project into the Adózz deployment; Gardoko leftovers removed (owner-approved permanent deletion) | §29.3 |
| D | Real prices without "DEMO" (19 999 / 14 999 / 2 999 / 4 999 / 7 999 Ft, admin-editable), **no free trial anywhere** ("paid from day one"), the 10 px `#D3DAFC` separator everywhere (app + panel), taxpayer lookup: 1-day cache + 8 s timeout → "Töltsd ki kézzel" | §29.4 |
| F1 | "Igazolást kérek" (owner 11-20 00:55 "1 2 3 4 9 csináld meg") | §29.5 |
| F2 | Bevételi kimutatás PDF on one tap | §29.6 |
| F3 | Megszüntetés guide + "Megszüntetjük helyetted" | §29.7 |
| F4 | Deadlines to the client's own calendar (iCal feed + "Hozzáadás a naptárhoz") | §29.8 |
| F9 | Owner console with full control (11-20 01:00 "minden infó legyen, tudjak felmondani ügyfeleket, teljes kontroll, változtatni adatokat") | §29.9 |
| G | Guided first run (11-20 10:30 "nem úgy volt, hogy így végigmegy először, ilyen bevezetősen?") | §29.10 |
| E | Owner scripts `stripe_szerverre.ps1`, updated `kezjegy_kulcsok.ps1`, later live switch | §29.11 |

**Found unbuilt from k6 (verified in the code 11-20; §29 builds what G and C need):**
- §28.K.9 **taxpayer lookup**: only the shared DTOs/texts exist (`TaxpayerLookupInput/Result`, `BusinessIdentityInput`, `TAXPAYER_LOOKUP_TEXTS`, `TAXPAYER_LOOKUP_RULES`); there is no `services/adoszam-kereso.ts`, no `/client/onboarding/taxpayer-lookup`, no `/client/onboarding/business-identity`, no `NAV_LOOKUP_*` in `config.ts`, no app screen ("Hol találom?" / "Most nem tudom" exist only as old field links in `bekotes/adatok.tsx`). → built in §29.4.4 (backend B1) + §29.10.5 (screen B3).
- §28.K.8 **`/kalkulator`** is not built → the adozz.hu landing is a plain one-page product page (§29.3.6); a calculator link is added only when the route exists.

**Precedence (what §29 changes in older sections):**
- §9, §11.5, §28.K.1 (payment parts), §28.K.6 (charging): when `PAYMENT_PROVIDER=stripe` the Stripe flows of §29.1 replace the SimplePay flows; SimplePay stays in the code (`PAYMENT_PROVIDER=simplepay`), never deleted, off by default.
- §28.K.1 "one-off fees are never charged on the recurring token" → replaced by §29.1.7 (saved card, after the client's explicit tap; covered by the new card consent).
- §28.K.1 DEMO mark + "Megerősítem" step → §29.4.1 (prices are real; an admin edit is the confirmation).
- §26.1.7 `NEW_BUSINESS_CHARGE_POLICY` default `adoszam_utan` → **`azonnal`** (§29.4.2: no free period).
- §28.K.6 `PAUSE_RULES.maxYears` 2 → **3** (NAV: szüneteltetés min. 1 month, max. 3 years for notices since 2021-07-01; §29.20 [NAV-SZ]).
- §28.K.9 "no cache table" → a **24-hour in-process memory cache**, never in the DB (§29.4.4).
- §27.4 / §27.4.4: the guided first run (§29.10) opens instead of `/bekotes` until finished or paused; `/bekotes` stays the overview.
- §20 + `deploy/README.md`: own proxy `kezjegy-proxy` (§29.3); `caddy-csatolas.sh` is retired (→ `deploy/_regi/`).
- `jogi/aszf.md` 6.1 (27 % ÁFA), 6.3 (Stripe instead of SimplePay), 2.4 / 4/A.6 / megbízási 5.1 (no free period), 6.4 (Számlázz.hu e-invoice) – §29.16.

**Principles (in addition to §28.K.0):**
1. **Money state only from Stripe** – the webhook or a server-side `retrieve`; never from the app, never from the return URL. The result screen polls the server.
2. **At most one successful charge per subscription period** – a partial unique index in the DB; a duplicate success is refunded automatically and raised to the admin.
3. **Exactly one fee invoice per successful payment** – `rendelesSzam` = `szamlaKulsoAzon` = our payment key; after any uncertain error we **query first**, then issue.
4. **No live key in tests or on the demo server** – config refuses `sk_live_` with `APP_ENV=demo`; `INVOICE_MODE=szamlazzhu` on `APP_ENV=demo` requires `SZAMLAZZHU_ACCOUNT=teszt`; the server stays `PAYMENT_PROVIDER=demo` and `INVOICE_MODE=demo` until the owner runs his scripts.
5. **Secrets** only in `/srv/kezjegy/.env`, written only by the owner's scripts; `/srv/kezjegy/nyilvanos.env` holds public URLs only; nothing secret in code, logs, tests, metadata or screenshots.
6. **Live DB safety** exactly as §28.0.2 (7): encrypted pg_dump first (`up.sh`), additive migrations, the owner's accounts and the demo logins (`bence.kovacs@demo.kezjegy.test`, `david@demo.kezjegy.test` "Fendrik Dávid") keep working; **existing demo subscriptions keep their demo provider** (§29.1.12) so no demo client gets locked by the switch.
7. **Card data never reaches us**: we store brand, last 4 digits, expiry, Stripe ids; Stripe `metadata` holds our ids only (no name, e-mail, adószám).
8. **One look** (C_VEGLEGES: blue band, 10 px `#D3DAFC` band between sections), tegező, short, no AI wording, no phone number shown, `[CÉGADAT]` placeholders kept.

**Builders and file ownership** (three in parallel, then the integrator; nobody deploys in the build phase):
| Builder | Owns |
|---|---|
| **B1 backend** | **First, before anything else:** creates `kod/shared/src/k29.ts`, empty `k29f.ts` and `k29g.ts` and adds the three lines `export * from './k29'; export * from './k29f'; export * from './k29g';` to `shared/src/index.ts`; then the small in-place edits of `enums.ts` listed in §29.15. Backend: `src/payments/{provider,stripe,demo,szamlazzhu,invoices,huf}.ts`, `src/services/{payments,subscription,dijak,szuneteltetes,zarolas,adoszam-kereso}.ts`, `src/routes/{payments-k29,webhooks-k29}.ts`, `src/jobs-k29.ts` (one line in `jobDefs`), `config.ts`, `http/core.ts` (origin list), **`db/schema.ts` and ALL §29 migrations** (`0017_k29_enumok.sql`, `0018_k29.sql` – incl. the F and G tables of §29.12, written first so B2/B3 can build on them), `content/k29.ts`, `seed/k29.ts`; `kod/deploy/**` (proxy, `atallas.sh`, `up.sh`, `feltolt.sh`, `gen-env.sh`, `nyilvanos.env.example`, README); owner scripts `stripe_szerverre.ps1`, `kezjegy_kulcsok.ps1` (§29.11). |
| **B2 új-funkciók** | `kod/shared/src/k29f.ts`; backend `src/services/{igazolas,kimutatas,megszuntetes,naptar,konzol,konzol-muveletek,anonimizalas}.ts`, `src/routes/{client-k29f,acc-k29f,admin-konzol,public-naptar}.ts`, `src/jobs-k29f.ts`; app `src/app/igazolas/**`, `src/app/kimutatas.tsx`, the `valtozas_megszuntetes` guide/hub parts, the calendar parts of `src/app/hataridok.tsx`; panel `pages/acc/Igazolasok*.tsx`, `pages/acc/ugyfel/Kimutatas.tsx`, `pages/admin/konzol/**`. Uses B1's payment/invoice services **only** through §29.1.15. |
| **B3 app+panel** | `kod/shared/src/k29g.ts`; backend `src/services/guided.ts`, `src/routes/client-k29g.ts`; app `src/app/bevezeto/**`, `src/lib/fizetes.ts` (new; `lib/simplepay.ts` stays for `PAYMENT_PROVIDER=simplepay`), all client payment screens (`bekotes/elofizetes.tsx`, `fiok/elofizetes.tsx`, `fiok/dijak.tsx`, `elofizetes/eredmeny.tsx`, `fizesd-ki`), the `vezetett=1` hooks in the existing step screens, the separator sweep, MINTA server entries for every new endpoint; panel payment views (`Elofizetesek`, `Fizetesek`, new `Dijszamlak`, `Rendszer`), the panel separator sweep; `kod/landing/**`; `kod/jogi/**` (§29.16). |
| **Integrator** | fit + tests + local Stripe TEST / Számlázz.hu Tesztüzem end-to-end, deploy, then §29.3.5 on the server. |
Shared rule: `kod/shared` edits only in the owner's own `k29*.ts` file (B1 also does the listed `enums.ts`/`bekotes.ts` edits); every package re-runs `node ../shared/scripts/sync-shared.mjs src/_shared`. Ports: each builder picks free local ports; headless Chrome with its own `--user-data-dir`.

---

### 29.1 A – Payments with Stripe

#### 29.1.1 Provider abstraction and config

- `PAYMENT_PROVIDER` = `stripe` | `simplepay` | `demo`; default **`demo`** when `APP_ENV=demo`, **`disabled`** when `APP_ENV=production` and no provider is configured (503 `not_configured` as today). The old `SIMPLEPAY_MODE` keeps working **only** under `PAYMENT_PROVIDER=simplepay` (`demo` provider = today's DEMO pay page code path, §29.1.12).
- Stripe env: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (secrets), `STRIPE_STATEMENT_SUFFIX_HAVI` (default `HAVIDIJ`), `STRIPE_CHECKOUT_LOCALE` (default `hu`).
- **Mode from the key prefix:** `sk_test_`/`rk_test_` → `test`, `sk_live_`/`rk_live_` → `live`. `ConfigError` when: `APP_ENV=demo` with a live key ("Élő Stripe-kulcs nem lehet DEMO szerveren."); `APP_ENV=production` with a test key; `PAYMENT_PROVIDER=stripe` with a missing key or webhook secret; publishable and secret key modes differ. Keys are never logged; `/admin/system` shows `stripe: test|live|off` and "webhook titok: megvan/hiányzik".
- `cfg.payment = { provider, stripe?: { mode, secretKey, publishableKey, webhookSecret, suffixHavi, locale } }`; `integrationModes()` gets `payment` (and keeps `simplepay`).
- `src/payments/provider.ts` – the interface every flow uses (no Stripe types leak into services):
```ts
interface PaymentProvider {
  readonly name: 'stripe' | 'simplepay' | 'demo';
  readonly mode: 'test' | 'live' | 'demo' | 'sandbox';
  /** Hosted page: first month + save card (mode payment + setup_future_usage) or card only (mode setup). */
  startHosted(i: HostedStart): Promise<{ url: string; providerRef: string; expiresAt: Date }>;
  /** Merchant-initiated off-session charge with the saved card. Never throws on a card decline: returns the outcome. */
  chargeSaved(i: SavedCharge): Promise<ChargeOutcome>;
  retrievePayment(providerRef: string): Promise<ProviderPaymentState>;
  retrieveHosted(sessionRef: string): Promise<ProviderHostedState>;
  cancelPending(providerRef: string): Promise<void>;
  refund(i: { providerRef: string; amountHuf: number; idempotencyKey: string; reason: string }): Promise<{ refundRef: string; status: 'succeeded' | 'pending' | 'failed' }>;
  detachCard(pmRef: string): Promise<void>;
  verifyWebhook(raw: string, headers: Record<string, string | undefined>): ProviderEvent | null;
}
type ChargeOutcome =
  | { kind: 'succeeded'; providerRef: string; card: CardInfo }
  | { kind: 'processing'; providerRef: string }
  | { kind: 'requires_auth'; providerRef: string | null }                         // authentication_required
  | { kind: 'declined'; providerRef: string | null; code: string; declineCode?: string }  // card_declined, expired_card, insufficient_funds …
  | { kind: 'uncertain'; error: string };                                         // network / 5xx: same idempotency key retried the same day
```
- `src/payments/stripe.ts`: the official **`stripe`** npm SDK, exact version pinned in `package.json`, `apiVersion` pinned to that SDK's default (the webhook endpoint is created with the same version, §29.11.1); timeout 20 s, `maxNetworkRetries: 1` (the SDK reuses our idempotency key). The newer Stripe "Off-Session Payments API" is deliberately **not** used (owner: PaymentIntents).
- `src/payments/huf.ts`: **Stripe HUF is a two-decimal currency for charges** (§29.20 [STR-CUR]): `hufToStripe(n) = n * 100` (asserts a positive integer forint), `stripeToHuf(a)` asserts `a % 100 === 0`. 19 999 Ft = `1999900`. Minimum charge: our smallest real amount is 2 999 Ft; the fee screen refuses 1–199 Ft (0 Ft = free is fine).

#### 29.1.2 Data model (B1; additive; full DDL in §29.12)

- **`payments`** (provider-neutral; one row per attempt to move money): `id`, `client_id`, `subscription_id` null, `fee_charge_id` null, `kind` (`elso_havi` | `havi` | `egyszeri` | `fizesd_ki`), `provider` (`stripe`|`demo`|`simplepay`), `mode` (`test`|`live`|`demo`|`sandbox`), `amount_huf`, `period_start`/`period_end` (monthly kinds), `status` (`letrehozva` → `feldolgozas` | `hitelesites_kell` | `sikeres` | `sikertelen` | `megszakitva` | `bizonytalan` | `duplikalt`), `initiated` (`ugyfel` | `utemezo` | `admin`), `off_session` bool, `attempt_day` date, `idempotency_key` unique, `stripe_payment_intent_id` unique, `stripe_checkout_session_id` unique, `stripe_charge_id`, `failure_code`, `decline_code`, `card_brand`, `card_last4`, `refunded_huf` default 0, `dispute_status` null, `fee_invoice_id` null, `applied_at`, `succeeded_at`, `created_at`, `updated_at`.
  - **Partial unique index** `payments_one_success_per_period` on `(subscription_id, period_start)` where `kind in ('elso_havi','havi','fizesd_ki') and status = 'sikeres'` – the DB refuses a second success for the same month.
- **`payment_methods`**: `id`, `client_id`, `provider`, `mode`, `stripe_customer_id`, `stripe_payment_method_id` unique, `brand`, `last4`, `exp_month`, `exp_year`, `status` (`aktiv` | `torolve` | `lejart` | `lecserelve`), `consent_id` (→ `consents`), `created_at`, `detached_at`.
- **`stripe_customers`**: `(client_id, mode)` unique → `customer_id` (test and live customers are different objects).
- **`stripe_events`**: `id` (Stripe `evt_…`, PK), `type`, `mode`, `stripe_created_at`, `received_at`, `processed_at` null, `attempts`, `last_error` (≤ 200 chars, no payload). Payloads are **not** stored.
- `subscriptions` + `provider text not null default 'simplepay'` (backfill: `mode='demo'` → `'demo'`), + `payment_method_id uuid null`, + `predebit_notified_for date null`, + `suspension_warned_for date null`. Statuses unchanged (`incomplete`, `active`, `past_due`, `suspended`, `canceled`).
- `fee_charges` + `payment_id uuid null`; purpose union widened (jsonb, no constraint): `{ type: 'igazolas'; requestId }`, `{ type: 'megszuntetes'; assistId }`, `{ type: 'admin'; note }`.
- `simplepay_transactions` and `card_registrations` stay untouched (history, SimplePay).

#### 29.1.3 Stripe customer, consent, card saving

**Customer:** one per client and mode, created lazily at the first card step: `customers.create({ email, name: "{lastName} {firstName}", metadata: { client_id }, preferred_locales: ['hu'] }, { idempotencyKey: 'cus:<clientId>:<mode>' })`, stored in `stripe_customers`. An e-mail change updates it. Stripe's own receipt e-mails are switched off in the Dashboard [TULAJ, §29.19] – Számlázz.hu sends the invoice.

**Consent (shown and stored BEFORE the hosted page opens):** new legal document type **`kartyas_fizetes`** ("Kártyás fizetés – engedély", `kod/jogi/kartyas_fizetes.md`, version `k7-1`, [JOGI] draft). `GET /client/subscription/consent` returns `{ version, text, sha256, amountNowHuf, monthlyHuf, pauseHuf, period }` – the text filled with the client's real numbers. The app shows it in full (no "teljes szöveg" fold for this one), with one checkbox; `POST /client/subscription/start` must send `{ consentVersion, consentSha256 }` equal to the server's current values (else 409 "Közben változott a szöveg. Nézd át újra."). The server inserts a `consents` row (`doc_type 'kartyas_fizetes'`, version, `text_sha256`, `ip_hmac`, user agent) and links it to the saved card (`payment_methods.consent_id`). Text (`CARD_CONSENT_TEXT`, placeholders filled):
> **Engedélyezem, hogy a Somosi Kft. (Adózz) a most megadott bankkártyámról levonja az előfizetésem díját:**
> – most {elsoOsszeg} Ft-ot az első hónapért ({idoszak});
> – utána havonta egyszer, a kifizetett hónap végén a következő hónap díját: most {havidij} Ft-ot (amíg szünetel a vállalkozásom, {szunetdij} Ft-ot).
> Minden levonás előtt 3 nappal szóltok az összegről és a napról. Ha a díj változik, legalább 30 nappal előtte szóltok.
> Amit az appban külön megrendelek (például az éves zárást), annak díját csak akkor vonjátok le erről a kártyáról, ha az appban jóváhagyom.
> Bármikor lemondhatom az appban: Fiók → Előfizetés → Lemondom. A kifizetett hónap végéig minden marad. A kártyámat is bármikor törölhetem.
> A kártyám adatait a Stripe kezeli, az Adózz nem látja és nem tárolja őket.

Checkbox: "Elolvastam, és engedélyezem a havi levonást." Main button: "Tovább a kártyához ({osszeg} Ft)". Under it: "A fizetés a Stripe biztonságos oldalán történik." On the Stripe page `custom_text.submit.message`: "Havi {havidij} Ft-os előfizetés az Adózznál. Minden levonás előtt 3 nappal szólunk. Bármikor lemondhatod az appban."

**`POST /client/subscription/start { platform: 'app'|'web', purpose: 'subscribe'|'card_update'|'restart', consentVersion, consentSha256, returnOrigin? }`** (same guards as today: e-mail verified, address present, `assertStepOpen('elofizetes')` for `subscribe`, the §28.K.7 employer gate, rate limit 10/h):
- **`subscribe` / `restart`** (nothing paid yet, or nothing paid any more): Checkout Session **`mode: 'payment'`** – `line_items: [{ price_data: { currency: 'huf', unit_amount: hufToStripe(amount), product_data: { name: 'Adózz havidíj ({YYYY.MM.DD.}–{YYYY.MM.DD.})' } }, quantity: 1 }]`, `customer`, `payment_method_types: ['card']`, `payment_intent_data: { setup_future_usage: 'off_session', statement_descriptor_suffix: 'HAVIDIJ', description: 'Adózz havidíj', metadata: { payment_id, client_id, kind: 'elso_havi', period_start } }`, `client_reference_id: payment_id`, `metadata` same, `locale: 'hu'`, `origin_context: platform === 'app' ? 'mobile_app' : 'web'`, `expires_at: now + 30 min`, `success_url`/`cancel_url` = §29.1.3 back URL, `custom_text.submit.message`. Idempotency key `checkout:<paymentId>`. A `payments` row (`elso_havi`, `letrehozva`, period = `nextPaidStart()` → +1 month) is inserted first. An open session younger than 25 min for the same purpose is handed back instead (as today's `REOPEN_WINDOW_MS`).
- **`card_update`** while a paid period runs and nothing is due: Checkout **`mode: 'setup'`** (`setup_intent_data.metadata`, `currency: 'huf'` – Stripe requires a currency in setup mode unless `allowed_payment_method_types` is set; pass it anyway), no money moves; the new card replaces the old one only after `setup_intent.succeeded` (old PM detached at Stripe, row `lecserelve`). If money **is** due (`past_due`/`suspended`/open `hitelesites_kell`), `card_update` becomes **"Fizesd ki"** (§29.1.5) – pay the due month with the new card.
- **Back URL**: `success_url = {API_PUBLIC_URL}/api/v1/payments/stripe/vissza?p={app|web}&o={originKey}&cs={CHECKOUT_SESSION_ID}&cel={elofizetes|dij|fizesd-ki}`; `cancel_url` same with `&megszakitva=1`. `originKey` maps to one of the allowed app origins (adozz.hu or sslip, §29.3.4) so a web client returns to the host he started on (the refresh cookie is host-bound). The route redirects 302 to `kezjegy://elofizetes/eredmeny?cs=…&cel=…` (app) or `{appOrigin}/elofizetes/eredmeny?cs=…&cel=…` (web). It changes nothing in the DB.
- Result screen polls **`GET /client/payments/checkout/:cs`** → `{ status: 'sikeres'|'feldolgozas'|'sikertelen'|'megszakitva', amountHuf, cardLabel?, period?, nextChargeOn? }`; while our row is not final the server calls `retrieveHosted(cs)` (expands `payment_intent.latest_charge`, `setup_intent.payment_method`) and applies the result **idempotently** with the same code as the webhook (so a lost webhook never leaves the client hanging).

#### 29.1.4 Monthly charges by OUR scheduler

- `runBillingJob` (06:00, unchanged schedule) → `chargeSubscription(sub)` dispatches on **`sub.provider`** (not on the server setting – §29.1.12). For `stripe`:
  1. Re-read the row; skip unless `chargeDue()` (unchanged rule), no `payments` row of this subscription in `feldolgozas`/`bizonytalan` younger than 24 h, and **no success for the period** (the unique index is the final guard).
  2. Amount = `effectiveMonthlyAmount(clientId, periodStart)` (§29.1.15: plan fee from `fee_settings` → pause fee inside a `subscription_pauses` row → client price override of §29.9.4 → free month = 0). **0 Ft**: insert a `payments` row `havi` with `provider = sub.provider`, `amount_huf 0`, status `sikeres`, `idempotency_key 'ingyenes:<subId>:<periodStart>'` (no Stripe call, no invoice), advance the period, audit `subscription.free_month`.
  3. Insert `payments` (`havi`, `utemezo`, `off_session true`, `attempt_day = today`, `idempotency_key = 'havidij:<subId>:<periodStart>:<YYYY-MM-DD>'`).
  4. `paymentIntents.create({ amount: hufToStripe(amount), currency: 'huf', customer, payment_method: <active PM>, off_session: true, confirm: true, statement_descriptor_suffix: cfg.suffixHavi, description: 'Adózz havidíj {YYYY.MM.}', metadata: { payment_id, client_id, subscription_id, kind: 'havi', period_start } }, { idempotencyKey })`.
  5. Outcome → `succeeded`: `applyPaymentSucceeded` at once (the webhook later is a no-op); `processing`: status `feldolgozas` (webhook / reconcile finishes it); `requires_auth` / `declined`: §29.1.5; `uncertain`: status `bizonytalan` – the reconcile job (§29.1.9) re-sends **the same idempotency key the same day** (Stripe returns the original result) or retrieves by `metadata.payment_id` via `paymentIntents.search` the next day before any new attempt.
- **At most one attempt per subscription per day**: the per-day idempotency key + `nextRetryAt` + the "no attempt row today" check (`attempt_day = today`).
- Statement descriptor: suffix `HAVIDIJ` (one-off fees: `EVES ZARAS`, `VALTOZAS`, `IGAZOLAS`, `MEGSZUNTETES`, `DIJ`); the prefix is the account's shortened descriptor (set to `ADOZZ` in the Dashboard [TULAJ]).
- Metadata never holds names, e-mails or tax numbers.

#### 29.1.5 Failures, retries, "Fizesd ki", suspension, lock

- Every failed monthly attempt → `registerFailure()` (**existing schedule reused**: retries +1 / +3 / +7 days from the first failure at 06:00, `graceUntil` = first failure + 14 days, then `suspended` + lifecycle `felfuggesztve` + the §28.K.5 lock). `payments.status` `hitelesites_kell` (`authentication_required`) or `sikertelen` with `failure_code`/`decline_code`.
- Client notification **`payment_action_needed`** (always on; push + in-app + e-mail), variant by cause (`PAYMENT_FAIL_TEXTS`):
  - `hitelesites`: "Erősítsd meg a fizetést" / "A bankod megerősítést kér a {osszeg} Ft-os havidíjhoz. Koppints, és fizesd ki pár lépésben."
  - `elutasitva`: "Nem sikerült levonni a havidíjat" / "A bankod nem engedte a {osszeg} Ft-ot. Fizesd ki most, vagy adj meg másik kártyát. Pár nap múlva újra megpróbáljuk."
  - `lejart_kartya`: "Lejárt a kártyád" / "Adj meg új kártyát, és fizesd ki a {osszeg} Ft-ot."
  - `figyelmeztetes` (sent once, `graceUntil − 5 days`, ÁSZF 6.5 "legalább 5 nappal előtte szólunk"): "5 nap múlva szünetel a könyvelésed" / "Még nincs kifizetve a {osszeg} Ft-os havidíj. Fizesd ki {hataridoIg}, és minden megy tovább." (`subscriptions.suspension_warned_for`).
  - Link `/fizesd-ki`. The Főoldal shows a red one-line banner "Fizetésre vár: {osszeg} Ft" + main button **"Fizesd ki"**.
- **"Fizesd ki" = hosted on-session payment**: `POST /client/payments/due/pay { platform, returnOrigin? }` → the due period (oldest unpaid month of the subscription) → first `cancelPending()` on any of its PaymentIntents still in `requires_payment_method`/`requires_action`/`requires_confirmation` (so an old one can never succeed later), then a Checkout Session `mode: 'payment'` exactly like §29.1.3 with `kind: 'fizesd_ki'`, `setup_future_usage: 'off_session'` (the card the client authenticates – old or new – becomes the saved card), same consent rule (the client re-confirms the consent text if he enters a new card: the screen shows it once more when `consent.version` changed or the card changes). Success → `applyPaymentSucceeded` → `active`, failures reset, lock lifts at once (`computeServiceLock`, unchanged), `service_unlocked`.
- A client may also simply wait: the scheduled retries continue; nothing is charged twice (unique index + `cancelPending`).

#### 29.1.6 Pre-debit reminder (3 days before every charge)

- Job `predebit` daily 10:00 (Budapest): every `active` subscription (not `cancelAtPeriodEnd`, provider `stripe` or `demo`) whose `nextChargeAt` falls on **today + 3 days** and `predebit_notified_for ≠ that date` → notification **`charge_upcoming`** (always on; in-app + push + e-mail; quiet hours for push as §28.2.3), dedupe `notifyOnce('rem:predebit:<subId>:<periodStart>')`.
- Texts: title "3 nap múlva levonjuk a havidíjat"; body "{datum}: {osszeg} Ft a kártyádról ({kartya}) a(z) {idoszak} időszakra. Ha nem szeretnéd, mondd le előtte: Fiók → Előfizetés." E-mail adds the line "Lemondás után a kifizetett időszak végéig minden marad." Amount = `effectiveMonthlyAmount` (shows the pause fee or a client's own price correctly; free month → no reminder).
- One-off fees have no pre-debit reminder (the client taps them himself).

#### 29.1.7 One-off fees (annual closing, change fees, suspension, certificates, closing)

- Kinds and amounts: `fee_settings` (§29.4.1). `szuneteltetesi_dij` is **monthly** and is charged by §29.1.4 instead of the plan fee (unchanged §28.K.6 rule); the others are one-off `fee_charges`.
- **Client pays in the app with the saved card** (owner 11-20 "charged the same way"): `POST /client/fees/:id/pay { platform, useSavedCard: boolean, returnOrigin? }`:
  - `useSavedCard: true` and an `aktiv` card exists → `paymentIntents.create({ …, customer, payment_method, off_session: false, confirm: true, return_url: <back URL cel=dij>, statement_descriptor_suffix, metadata: { kind: 'egyszeri', fee_charge_id, … } }, { idempotencyKey: 'dij:<chargeId>:<YYYY-MM-DD>' })`. Status `succeeded` → paid at once (screen: "Kifizetted, köszönjük!"); `requires_action` with `next_action.redirect_to_url` → the app opens that URL (expo-web-browser / web redirect) for the bank's check and returns through the back URL; any decline → the screen offers "Másik kártyával fizetek" (= Checkout).
  - otherwise → Checkout `mode: 'payment'` for the charge amount (no `setup_future_usage` unless the client has no saved card at all).
  - The pay screen states before the tap: "{label}: {osszeg} Ft. A kártyádról vonjuk le ({kartya})." Button "Fizetek ({osszeg} Ft)"; capsule "Másik kártyával".
- A fee charge created by the **admin** (purpose `admin`, §29.9.4) is never charged without the client's tap. A fee charge the client himself ordered (annual closing, assisted change, certificate fee, closing) may be charged off-session by the admin only with the explicit console action "Levonom a mentett kártyáról" + reason (covered by the consent sentence "Amit az appban külön megrendelek…" – [JOGI] confirm).
- Success → `applyFeeFinished` equivalent: charge `fizetve`, `payments` row `sikeres`, fee invoice (§29.2), the purpose action (`runPurpose`, unchanged + the new `igazolas` / `megszuntetes` purposes).

#### 29.1.8 Webhooks

- **`POST /api/v1/webhooks/stripe`** on every host (the endpoint configured at Stripe is `https://api.adozz.hu/api/v1/webhooks/stripe`). Raw body ≤ 256 KB (`bodyLimitFor`; Caddy's 1 MB default is enough). Signature: `Stripe-Signature` checked with `STRIPE_WEBHOOK_SECRET` (SDK `webhooks.constructEvent`, tolerance 300 s); bad → 400, one log line per IP per hour, the same flood guard as the SimplePay IPN (`IPN_BAD_PER_HOUR`). `event.livemode` must match the configured mode, else 200 + ignored + audit (`payment.webhook_mode_mismatch`).
- **Idempotent processing:** `insert into stripe_events … on conflict do nothing`; already `processed_at` → 200 at once. Processing runs in one transaction; an exception → `attempts+1`, `last_error`, **HTTP 500** (Stripe retries for up to 3 days); success → `processed_at`, 200. Handlers are **order-independent**: they re-read the object from Stripe (`retrievePayment` / `retrieveHosted`) and act on its current state; our state machine never moves back (`sikeres` is final except refunds).
- Events subscribed (and the only ones handled):
  | Event | Action |
  |---|---|
  | `checkout.session.completed` | mode `payment` + `payment_status: 'paid'` → `applyPaymentSucceeded(metadata.payment_id)`; mode `setup` → `applyCardSaved` |
  | `checkout.session.expired` | our row `letrehozva` → `megszakitva` |
  | `setup_intent.succeeded` | `applyCardSaved` (no-op if already done by the session event) |
  | `payment_intent.succeeded` | `applyPaymentSucceeded` (idempotent) |
  | `payment_intent.payment_failed` | off-session / saved-card PIs only (Checkout-internal attempts are ignored: the client is still on the page) → §29.1.5 |
  | `charge.refunded` | sync `refunded_huf` from the charge; a refund made outside our console (Stripe Dashboard) is applied the same way + admin alert; invoice storno/correction (§29.2.4) |
  | `charge.dispute.created` | `dispute_status`, audit `payment.dispute`, staff notification `payment_disputed` to admins; nothing changes for the client automatically |
  | `payment_method.automatically_updated` | refresh brand/last4/expiry of our `payment_methods` row |
- `applyPaymentSucceeded(paymentId)` (one transaction, row locked `for update`; `applied_at` once): `payments` → `sikeres`, card info from `latest_charge.payment_method_details.card`; monthly kinds → subscription `active`, period from the row, `nextChargeAt = periodEnd 09:00`, failures cleared, `payment_method_id` = the PI's PM (new `payment_methods` row `aktiv`; an older active card → `lecserelve` + detached after commit), lifecycle `felfuggesztve`/`megszunt` → `aktiv` (as today, except a terminated client §29.9.4 – never reactivated by a payment), `setStep('elofizetes','kesz')`; `egyszeri` → charge `fizetve` + `runPurpose`. **Unique violation** of `payments_one_success_per_period` → this row `duplikalt`, automatic full refund (`refund:dup:<paymentId>`), audit `payment.duplicate_refunded`, admin alert. After commit: fee invoice (§29.2), `fee_invoice_issued` (in-app + push; the e-mail comes from Számlázz.hu), `checkCompletion`, `computeFlags`, `computeServiceLock`.

#### 29.1.9 Reconciliation (missed webhook safety)

Job `payments_reconcile` every 15 min: `payments` in `letrehozva` (with a session, older than 35 min), `feldolgozas`, `bizonytalan`, `hitelesites_kell` (open PI) older than 15 min → `retrieve…` → apply success / failure / expiry with the same functions. `stripe_events` with `processed_at null` and `attempts ≥ 3` → admin alert on `/admin/rendszer` ("Fennakadt Stripe-esemény: N"). Limits: 100 rows per run.

#### 29.1.10 Refunds and disputes (admin)

- `POST /admin/console/payments/:id/refund { amountHuf, reason, stepUp }` (§29.9): `amountHuf ≤ amount − refunded`; `refunds.create({ payment_intent, amount: hufToStripe(amountHuf), reason: 'requested_by_customer', metadata: { payment_id, by_user } }, { idempotencyKey: 'refund:<paymentId>:<n>' })`; `payments.refunded_huf` updated on success (and again, idempotently, by `charge.refunded`); **automatic invoice action** (§29.2.4: full → storno, partial → corrective invoice); client notification **`payment_refunded`**: "Visszautaltunk {osszeg} Ft-ot" / "A kártyádra kerül vissza, a bankodtól függően pár munkanap alatt." Audit `admin.payment_refunded` (amount, reason).
- A refund of a monthly payment does **not** change the paid period unless the admin also terminates or shortens it (separate action). A refunded one-off fee whose work never started → charge `visszaterites_megtortent` (existing status).
- Disputes: shown on the client card and the payments list with a red chip "Vitatott terhelés"; the answer is given in the Stripe Dashboard [TULAJ].

#### 29.1.11 Cancellation, card deletion, card expiry

- Client cancel / resume: unchanged rules (`cancelAtPeriodEnd`, ends at period end, charges stop). Copy on the screen: "Lemondod? A(z) {idoszakVege}-ig minden marad, utána nem vonunk le többet."
- **Card deletion** (ÁSZF 8.4, unconditional): `detachCard` at Stripe + row `torolve`; the subscription runs to the period end; the next charge needs a new card (the pre-debit job sends `subscription_renewal_needed` instead of `charge_upcoming` when no active card).
- Expiry: `renewalCheck()` reads `payment_methods.exp_*` (card expiring within 30 days → `subscription_renewal_needed`, existing kind); the SimplePay token-count rules do not apply to Stripe.

#### 29.1.12 Demo provider; SimplePay kept off

- `PAYMENT_PROVIDER=demo` = today's DEMO pay page (`/payments/demo/pay`) generalised: it now serves `payments` rows too (first month, card update, Fizesd ki, one-off) and has four buttons: "Sikeres fizetés szimulálása", "Hitelesítést kér (3DS) szimulálása", "Elutasított kártya szimulálása", "Megszakítom". DEMO card label "DEMO •••• 4242". Monthly demo charges: e-mail `fail+…` → `declined`, `auth+…` → `requires_auth` (both in demo only). Banner "DEMO FIZETÉS – nem valódi kártya, nem vonunk le pénzt." stays.
- **Provider per subscription:** a subscription is always charged by the provider that saved its card (`subscriptions.provider`). In `APP_ENV=demo` the existing demo subscriptions keep being renewed by the demo provider even after `PAYMENT_PROVIDER=stripe` (no `DEMO_TOKEN` failure cascade, no demo client locked by the switch; David and the seed clients stay green). In `APP_ENV=production` the old rule stays (a demo subscription is never charged; the DB must be empty anyway).
- `PAYMENT_PROVIDER=simplepay`: today's SimplePay code, untouched; `/webhooks/simplepay/ipn` answers only then (otherwise 404). No SimplePay code is deleted.

#### 29.1.13 Client screens and copy (B3; C look, separator)

- **Card step** (guided flow and `/bekotes/elofizetes`): band "Utolsó lépés: a kártyád" / "Havi {havidij} Ft. Az első hónapot most fizeted, utána havonta egyszer vonjuk le. Bármikor lemondhatod." · section "Mit kapsz ezért?" (existing `ar.mit_kapsz`) · the consent text (§29.1.3) + checkbox · main button "Tovább a kártyához ({osszeg} Ft)" · line "A fizetés a Stripe biztonságos oldalán történik. A kártyád számát mi nem látjuk." No SimplePay logo/link when provider ≠ simplepay. DEMO: the existing `DemoFizetesJel`.
- **Result** `/elofizetes/eredmeny`: polling (≤ 30 s, then "Még ellenőrizzük a fizetést. Szólunk, ha kész."); success "Kifizetted, köszönjük!" + "Következő levonás: {datum}, {osszeg} Ft." + (guided) "Tovább" → next step; failure "Nem sikerült a fizetés" + "Próbáld újra" / "Másik kártyával"; cancelled "Megszakítottad. Nem vontunk le semmit."
- **Fiók → Előfizetés** (`/fiok/elofizetes`): rows "Havidíj" {osszeg} Ft · "Következő levonás" {datum} (or "Lemondva – {datum}-ig él") · "Kártya" {Visa •••• 4242}, "lejár {hh/éé}" · capsules "Kártya cseréje", "Kártya törlése"; text link "Lemondom". Open payment problem → red section on top with "Fizesd ki".
- **Fiók → Díjak és számlák** (`/fiok/dijak`): open charges ("Fizetek"), paid ones, and **every fee invoice** (number, date, amount, "PDF" → the stored Számlázz.hu PDF; storno shown "Sztornózva" + the storno PDF).
- **`/fizesd-ki`**: band "Fizetésre vár: {osszeg} Ft" / "A(z) {idoszak} havidíja. Fizesd ki, és minden megy tovább." · the card in use · main button "Fizesd ki ({osszeg} Ft)" · capsule "Másik kártyával fizetek".
- App lib `src/lib/fizetes.ts`: `kartyaMentes(purpose)`, `fizesdKi()`, `dijFizetes(id, useSavedCard)`; native: `WebBrowser.openAuthSessionAsync(url, 'kezjegy://elofizetes')` (expo-web-browser of the installed SDK – check the SDK 58 docs before use, AGENTS.md); web: `window.location.assign(url)`. The money state is always read back from the server.

#### 29.1.14 Panel screens (B3)

- `/admin/elofizetesek`: provider + mode chip (Stripe teszt / Stripe éles / DEMO / SimplePay), status, next charge date + amount, card label, failures, "Fizesd ki" link sent; filter `past_due`, `suspended`, `hitelesites_kell`.
- `/admin/fizetesek`: every `payments` row (client, kind, amount, status, card, Stripe id as a link to the Dashboard – test/live path chosen by mode, refunded, dispute) + filters; "Visszatérítés" opens the console action (§29.9).
- **New `/admin/dijszamlak`**: fee invoices with status (`kiallitva`, `folyamatban`, `hiba`, `sztorno`), number, account (teszt/éles/DEMO), error code + message, attempts, "Újrapróbálom" (queries first), PDF link.
- `/admin/rendszer`: Stripe mode, webhook secret present, last webhook received, unprocessed events, last reconcile run; Számlázz.hu mode + account kind, open invoice errors; never a key value.

#### 29.1.15 Service contract between builders (B1 exports; B2 calls only these)

```ts
effectiveMonthlyAmount(deps, db, clientId: string, periodStart: ISODate): Promise<{ amountHuf: number; source: 'terv' | 'szunetel' | 'egyedi_ar' | 'kedvezmeny' | 'ingyenes_honap' }>
createFeeChargeK29(deps, db, i: { clientId: string; kind: FeeKind; amountHuf?: number; purpose: FeePurpose; by: string | null }): Promise<FeeChargeRow | null> // null when the amount is 0
startFeePayment(deps, cl, chargeId, i: { platform; useSavedCard: boolean; returnOrigin? }): Promise<FeePayStartK29>
chargeFeeOffSessionByAdmin(deps, i: { chargeId; byUserId; reason }): Promise<ChargeOutcome>
refundPayment(deps, i: { paymentId; amountHuf; reason; byUserId }): Promise<{ refundedHuf: number; invoiceAction: 'sztorno' | 'helyesbito' | 'nincs' | 'hiba' }>
cancelSubscriptionK29(deps, i: { clientId; when: 'idoszak_vege' | 'azonnal' | 'datum'; date?: ISODate; byUserId; reason }): Promise<void> // stops charges, keeps history
paymentsOfClient(db, clientId), cardOfClient(db, clientId), invoicesOfClient(db, clientId), subscriptionView(deps, db, clientId)
retryInvoice(deps, feeInvoiceId, byUserId): Promise<void>
```

---

### 29.2 B – Fee invoices via Számlázz.hu (Számla Agent)

#### 29.2.1 Config

- `INVOICE_MODE` = `szamlazzhu` | `demo` (`billingo` stays accepted but unbuilt); `SZAMLAZZHU_AGENT_KEY` (secret), **`SZAMLAZZHU_ACCOUNT`** = `teszt` | `eles` (non-secret, required with `szamlazzhu`).
- Refusals (`ConfigError`): `APP_ENV=demo` + `INVOICE_MODE=szamlazzhu` + `SZAMLAZZHU_ACCOUNT≠teszt` ("Éles Számlázz.hu-fiók nem lehet DEMO szerveren: az első éles számla elindítja a fizetős csomagot."); `APP_ENV=production` + `teszt`.
- **The live server stays `INVOICE_MODE=demo`** (its `SZAMLAZZHU_AGENT_KEY` is the owner's LIVE Somosi Kft. key – never used until the go-live). Local tests read `SZAMLAZZHU_TEST_AGENT_KEY` in-process only (never echoed, never in a file).
- Account settings the owner switches on in **both** Számlázz.hu accounts [TULAJ]: Beállítások → Fiókbeállítások → Számlázási beállítások → Számlaszerkesztő beállítások → **"Rendelésszám ismétlődés tiltása"**; e-invoice (e-számla) enabled; invoice e-mail texts; prefix (e.g. `ADZ`).

#### 29.2.2 Protocol (`src/payments/szamlazzhu.ts`; §29.20 [SZ-*])

- `POST https://www.szamlazz.hu/szamla/` as `multipart/form-data`, one XML file per call, field: **`action-xmlagentxmlfile`** (issue), **`action-szamla_agent_xml`** (query, schema `xmlszamlaxml`), **`action-szamla_agent_st`** (storno, schema `xmlszamlast`), **`action-szamla_agent_pdf`** (PDF only, if needed). Timeout 20 s. Element order is fixed by the XSD; build the XML with an escaping writer (never string-concatenated user input), validate in tests against the XSDs (downloaded into `backend/test/fixtures/szamlazz/` by the builder, with the source URL in a header comment).
- Issue XML (`xmlszamla`, namespace `http://www.szamlazz.hu/xmlszamla`):
  - `beallitasok`: `szamlaagentkulcs`, `eszamla` **true**, `szamlaLetoltes` **true**, `valaszVerzio` 1, `szamlaKulsoAzon` = **our key**.
  - `fejlec`: `keltDatum` = today (Budapest), `teljesitesDatum` = payment day [KÖNYVELŐ: monthly prepaid service – confirm], `fizetesiHataridoDatum` = payment day, `fizmod` "Bankkártya", `penznem` HUF, `szamlaNyelve` hu, `megjegyzes` "Bankkártyával fizetve. Azonosító: {kulcs}", `rendelesSzam` = **our key**, `fizetve` **true**, `elolegszamla`/`vegszamla`/`helyesbitoszamla`/`dijbekero` false.
  - `elado`: `emailReplyto` = `brand.provider.supportEmail` when it is not a `[CÉGADAT…]` placeholder (else omitted), `emailTargy` "Adózz – számla: {megnevezes}", `emailSzoveg` "Szia {keresztnev}! Csatoltuk a(z) {megnevezes} számláját. Az appban is megtalálod: Fiók → Díjak és számlák."
  - `vevo`: `nev` = the EV's name (business identity name, e.g. "Kovács Péter e.v."; fallback "{lastName} {firstName}"), `irsz`/`telepules`/`cim` = the **székhely** when known, else the lakcím [KÖNYVELŐ confirms], `email` = login e-mail, **`sendEmail` true** (Számlázz.hu sends it), `adoszam` = the EV's adószám when known.
  - `tetelek/tetel`: one line – `megnevezes` (`INVOICE_LINE_TEXTS`: "Könyvelési szolgáltatás – havidíj ({YYYY.MM.DD.}–{YYYY.MM.DD.})", "Könyvelési szolgáltatás – rendelkezésre állási díj ({honap})", "Éves zárás ({ev}): SZJA- és iparűzésiadó-bevallás", "Változás bejelentése helyetted: {valtozas}", "Jogállás-változás bejelentése helyetted", "Igazolás intézése: {tipus}", "Vállalkozás megszüntetésének intézése", "Díj: {admin megjegyzés}"), `mennyiseg` 1, `mennyisegiEgyseg` "hó" / "alkalom", `afakulcs` "27".
- **Our key** (`rendelesSzam` = `szamlaKulsoAzon`): `ADZ-{paymentId without dashes, first 20 hex}` (storno: `+S`, correction: `+H{n}`); stored in `fee_invoices.external_key` (unique).
- **27 % ÁFA from a gross price** (`grossToLine(gross)`): `netto = round2(gross / 1.27)`, `afa = round2(gross − netto)`, `brutto = gross`; `nettoEgysegar = nettoErtek = netto`. Tests: 19 999 → 15 747,24 + 4 251,76; 14 999 → 11 810,24 + 3 188,76; 7 999 → 6 298,43 + 1 700,57; 4 999 → 3 936,22 + 1 062,78; 2 999 → 2 361,42 + 637,58. **The integrator issues one Tesztüzem invoice per amount** and records whether the Agent's item check accepts it; if one is refused, fall back to `netto = round(gross/1.27)` with `afa = gross − netto` for that amount and report it [KÖNYVELŐ: rounding of the gross price invoices].
- Response: headers `szlahu_szamlaszam` (URL-encoded), `szlahu_nettovegosszeg`, `szlahu_bruttovegosszeg`, `szlahu_error`, `szlahu_error_code`; body = the PDF (check `%PDF-` magic; an XML or `[ERR]` text body is an error). Error codes **71/152** ("Már létező rendelésszám") → treat as "already issued": query, store, done.

#### 29.2.3 Flow, idempotency, errors

- After every successful payment with `amount > 0`: insert `fee_invoices` (`status 'folyamatban'`, `kind 'szamla'`, `external_key`, `payment_id`, `provider`, `provider_account`, `buyer` snapshot jsonb) **in the payment transaction**; after commit the API tries once; the worker job `invoices_issue` (every minute) picks `folyamatban`/`hiba` rows whose `next_retry_at ≤ now`.
- **Every retry queries first** (`action-szamla_agent_xml` with `szamlaKulsoAzon` and `pdf=true`): found → store number + PDF, `kiallitva`; not found → issue. Back-off 2 min, 15 min, 1 h, 6 h, 24 h; after 5 failures the row stays `hiba` with an admin alert (`/admin/dijszamlak`, `/admin/rendszer` count, staff notification `invoice_failed` to admins once per row).
- PDF stored with `deps.storage.put` (`kind 'dijszamla'`, `retentionUntil = Jan 1 of year + 9` – Számv. tv. 169. § 8 years + margin) and linked; the client sees it in Fiók → Díjak és számlák; `fee_invoice_issued` push/in-app (no own e-mail: Számlázz.hu sends it).
- Mode matching: a `test` Stripe payment is invoiced only with `SZAMLAZZHU_ACCOUNT=teszt`; a `live` payment only with `eles`; a `demo` payment only with the DEMO díjbekérő PDF (as today). A mismatch → no call, row `hiba` `mode_mismatch`, admin alert.
- `INVOICE_MODE=demo`: the existing DEMO díjbekérő ("DEMO DÍJBEKÉRŐ – NEM SZÁMLA") through the same pipeline (row → PDF), so the app and the panel look the same in demo.

#### 29.2.4 Storno and correction on refund

- **Full refund** → storno (`xmlszamlast`: `beallitasok` `szamlaagentkulcs`, `eszamla` true, `szamlaLetoltes` true, `szamlaKulsoAzon` = key + `S`; `fejlec` `szamlaszam` = the original number, `keltDatum`/`teljesitesDatum` today, `megjegyzes` "Visszatérítés: {ok}"; `vevo` `email`) → new `fee_invoices` row `kind 'sztorno'`, `storno_of` = original; original → `status 'sztorno'`. Query-first by the storno key before any retry.
- **Partial refund** → corrective invoice (`xmlszamla` with `helyesbitoszamla` true, `helyesbitettSzamlaszam` = original, one negative line "Visszatérítés: {megnevezes}" of the refunded gross, key + `H{n}`) [KÖNYVELŐ confirms the corrective form]. Row `kind 'helyesbito'`.
- Failures of storno/correction follow §29.2.3 (retry, admin view).

---

### 29.3 C – Domains and the proxy

#### 29.3.1 Hosts

| Host | Serves |
|---|---|
| `adozz.hu` | the landing page (§29.3.6) |
| `www.adozz.hu` | 301 → `https://adozz.hu{uri}` |
| `app.adozz.hu` | client web app + same-origin `/api/v1` |
| `konyvelo.adozz.hu` | panel + same-origin `/api/v1` |
| `api.adozz.hu` | API for the native app, the Stripe webhook, payment back URLs, the iCal feed (everything else 404) |
| `app.45-94-65-74.sslip.io`, `konyvelo.45-94-65-74.sslip.io`, `api.45-94-65-74.sslip.io` | **kept**, same as today (the installed APK talks to `api.…sslip.io`) |
| `45-94-65-74.sslip.io` | Gardoko – deleted; no site block any more (the address simply fails) |
Automatic HTTPS (Let's Encrypt) for all hosts. HSTS `max-age=31536000` (no `includeSubDomains`, no preload). `X-Robots-Tag: noindex` on the panel and API hosts.

#### 29.3.2 New proxy (dedicated small compose, B1)

- `kod/deploy/proxy/docker-compose.yml` – compose project **`kezjegy-proxy`**, one service **`kezjegy-proxy`** (`caddy:2-alpine`, exact tag pinned), `ports: ["80:80", "443:443", "443:443/udp"]`, `read_only: true`, `tmpfs /tmp`, `security_opt: no-new-privileges`, `cap_drop: [ALL]`, `cap_add: [NET_BIND_SERVICE]` (runs as the image's root user inside the container because file capabilities do not apply under no-new-privileges; it writes only to its two volumes), volumes `./Caddyfile:/etc/caddy/Caddyfile:ro`, `./sites:/etc/caddy/sites:ro`, `kezjegy_caddy_data:/data`, `kezjegy_caddy_config:/config`, network `kezjegy_edge` (external, created by the main compose), `mem_limit 256m`, `pids_limit 128`, logging as the main compose. Separate project so that `up.sh`'s `docker compose up -d` of the main stack never tries to bind 80/443 and the proxy is never recreated by a deploy.
- `kod/deploy/proxy/Caddyfile`: global `{ admin localhost:2019 }` (reload via `docker exec`), then `import /etc/caddy/sites/*.caddy`.
- `kod/deploy/proxy/sites/adozz.caddy` = today's `kezjegy.caddy` snippets (`kezjegy_fejlecek`, `kezjegy_csp`, `kezjegy_csp_panel`, `kezjegy_api`) + site blocks for **both host sets** (`app.adozz.hu, app.45-94-65-74.sslip.io { … }` etc.), `adozz.hu` → `reverse_proxy kezjegy-web:8082`, `www.adozz.hu` → `redir https://adozz.hu{uri} permanent`, the webhook route body limit 256 KB, landing CSP `default-src 'self'; img-src 'self' data:; style-src 'self'; font-src 'self'; script-src 'none'; frame-ancestors 'none'; base-uri 'self'`. The client CSP needs **no** Stripe origin (Checkout is a full redirect, no Stripe.js).
- `kezjegy-web` (`web.Caddyfile`) gets `:8082 { root * /srv/landing; import kezjegy_statikus }` and the bind mount `../web/landing:/srv/landing:ro`; `feltolt.sh` uploads `kod/landing/dist` (or the folder itself) to `/srv/kezjegy/web/landing` (`--web-only` includes it).
- **Certificates:** before the switch the content of `appok_caddy_data` is copied into the new volume `kezjegy_caddy_data` (`docker run --rm -v appok_caddy_data:/from:ro -v kezjegy_caddy_data:/to caddy:2-alpine sh -c 'cp -a /from/. /to/'`) so the sslip certificates are reused (sslip.io is not on the Public Suffix List: Let's Encrypt's per-domain limit is shared by every sslip.io user – re-issuing is a real risk). The adozz.hu certificates are issued fresh.
- `up.sh`: the `appok-caddy-1` reload block is replaced by: validate `proxy/Caddyfile` + `sites/` with a throw-away `caddy validate`, then `docker exec kezjegy-proxy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile` if the container runs. `caddy-csatolas.sh` → `deploy/_regi/`.

#### 29.3.3 Public URLs: `/srv/kezjegy/nyilvanos.env`

- New file, mode 644, owned by deploy, **public values only**: `APP_PUBLIC_URL=https://app.adozz.hu`, `PANEL_PUBLIC_URL=https://konyvelo.adozz.hu`, `API_PUBLIC_URL=https://api.adozz.hu`, `LANDING_PUBLIC_URL=https://adozz.hu`, `EXTRA_PUBLIC_ORIGINS=https://app.45-94-65-74.sslip.io,https://konyvelo.45-94-65-74.sslip.io,https://api.45-94-65-74.sslip.io`. Example in `kod/deploy/nyilvanos.env.example`.
- Main compose: `kezjegy-api` and `kezjegy-worker` get `env_file: [{ path: ../.env, required: true }, { path: ../nyilvanos.env, required: false }]` – **the later file wins**, so nobody touches `.env` for URLs. `up.sh` refuses a `nyilvanos.env` that contains any key outside the five above (prints the key names only).
- `kezjegy_kulcsok.ps1` section 8 writes these keys to `nyilvanos.env` (not `.env`) from now on (§29.11.2).
- Written by the integrator **after** the adozz.hu hosts answer over HTTPS (§29.3.5 step 6), then `up -d --force-recreate kezjegy-api kezjegy-worker`.

#### 29.3.4 Origins (B1, `config.ts` + `http/core.ts`)

- `cfg.publicOrigins` = origins of `APP/PANEL/API/LANDING_PUBLIC_URL` + `EXTRA_PUBLIC_ORIGINS` (validated https URLs). `sameSiteGuard` allows exactly these (plus the same-host rule and the non-production localhost rule, unchanged).
- `cfg.appOrigins` = `[APP_PUBLIC_URL origin, …EXTRA app origins]`, with short keys (`a` = adozz, `s` = sslip) for the payment back URL (§29.1.3) – an unknown key falls back to `APP_PUBLIC_URL`.
- The DEMO pay page CSP `form-action` lists every app origin + `kezjegy:`.
- E-mail and push links use `APP_PUBLIC_URL`/`PANEL_PUBLIC_URL` (→ adozz.hu after step 6). The refresh cookie `__Host-kj_rt` stays host-only: a web user who moves from sslip to adozz.hu signs in once more (expected).
- The native app's API base stays `https://api.45-94-65-74.sslip.io/api/v1` in the current APK; a new APK uses `https://api.adozz.hu/api/v1` [TULAJ, later].

#### 29.3.5 The switch – step by step, reversible (integrator; script `kod/deploy/proxy/atallas.sh`)

`atallas.sh <lepes>` prints every step, stops on the first error, never prints secrets, and writes `/srv/kezjegy/_regi/proxy_atallas_<time>.log`.
1. **`elokeszit`** (no effect on traffic): copy `proxy/` to `/srv/kezjegy/deploy/proxy/`; `docker compose -p kezjegy-proxy -f … config -q`; `caddy validate` in a throw-away container with the same mounts; check `kezjegy_edge` exists; check DNS of the 5 adozz.hu names = 45.94.65.74 (else stop: "A DNS még nem ide mutat"); save `/srv/appok/deploy/{Caddyfile,docker-compose.yml}` copies into `/srv/kezjegy/_regi/appok_elotte_<time>/` (not `.env`).
2. **`tanusitvany`**: create `kezjegy_caddy_data` + `kezjegy_caddy_config`; copy `appok_caddy_data` → `kezjegy_caddy_data` (§29.3.2).
3. **`atall`** (≈ 10–30 s outage): `docker stop appok-caddy-1` (stop, not rm) → `docker compose -p kezjegy-proxy -f /srv/kezjegy/deploy/proxy/docker-compose.yml up -d` → for 90 s every 3 s: `curl -sS -o /dev/null -w '%{http_code}'` on `https://api.45-94-65-74.sslip.io/api/v1/health`, `https://app.45-94-65-74.sslip.io/`, `https://konyvelo.45-94-65-74.sslip.io/` (all 200) → **any failure: automatic rollback** = `docker compose -p kezjegy-proxy … stop && rm -f`, `docker start appok-caddy-1`, re-check the three hosts, print "VISSZAÁLLÍTVA".
4. **`adozz`**: wait ≤ 3 min for the certificates; check `https://adozz.hu/` 200 (landing), `https://www.adozz.hu/` 301 → `https://adozz.hu/`, `https://app.adozz.hu/` 200, `https://konyvelo.adozz.hu/` 200, `https://api.adozz.hu/api/v1/health` 200, `https://api.adozz.hu/` 404; certificate issuer contains "Let's Encrypt" (`openssl s_client -servername … | openssl x509 -noout -issuer -enddate`). A failing adozz.hu host does **not** roll back (the sslip hosts carry the service); the proxy logs are checked (`docker logs kezjegy-proxy --tail 50`).
5. **Manual rollback** (any time before step 7): `atallas.sh visszaall` = step 3's rollback.
6. **`cimek`**: write `/srv/kezjegy/nyilvanos.env` (§29.3.3), recreate api + worker, check `/health` on both host sets, a login through `https://app.adozz.hu` (curl against `/api/v1/config`), the e-mail link base in the DEMO postafiók.
7. **`takarit`** – only after steps 3–6 are green and at least **1 hour** of clean proxy logs (the script refuses earlier and asks for the word `TAKARIT`): `docker rm appok-caddy-1`; `docker network rm appok_edge appok_internal`; `docker volume rm appok_caddy_data appok_caddy_config` (the certificates live on in `kezjegy_caddy_data`); `docker image rm appok/garden-api:latest` (if present; the shared `caddy:2-alpine` image stays – the new proxy uses it); **`rm -rf /srv/appok`** (owner-approved permanent Gardoko deletion, 11-20); `/srv/kezjegy/caddy/` → `/srv/kezjegy/_regi/caddy_elotte_k7_<time>/` (ours: moved, not deleted). It does **not** touch `pgtest_net`, `pgtest_nm` or the unnamed volume (not part of the approval; listed for the owner). After it: `up.sh` must not reference `/srv/appok` anywhere (grep check in the script).
8. README: the "Gardoko" paragraphs go to "Történet"; the new layout (`proxy/`, `nyilvanos.env`, hosts) and the rollback commands are documented.

#### 29.3.6 Landing page `adozz.hu` (B3; `kod/landing/`)

Plain static page (HTML + CSS, Geist from `kod/app` assets, no script, no tracking, no cookie, no AI wording), C look (blue band, 10 px `#D3DAFC` separators), mobile first (390 / 320 px) and desktop:
- Band: brand name, `brand.tagline` "Saját könyvelő, aki név szerint ismer.", line "Átalányadós és katás egyéni vállalkozóknak. Havi 19 999 Ft, minden benne van." Buttons "Regisztrálok" → `https://app.adozz.hu/regisztracio`, capsule "Belépés" → `https://app.adozz.hu/belepes`.
- Section "Mit kapsz?": saját könyvelő név szerint; kiszámolja és beadja az adódat; a kiállított számláid maguktól bejönnek (NAV Online Számla); emlékeztetők a határidőkre; mennyit tegyél félre; üzenet a könyvelődnek az appban.
- Section "Így indulsz": 1. Regisztrálsz és válaszolsz pár kérdésre. 2. Aláírod a szerződést és engedélyt adsz a NAV-nál. 3. Megadod a kártyádat – az első hónapot ekkor fizeted. 4. A könyvelőd bekapcsolja a könyvelést.
- Section "Mennyibe kerül?": table from the fee table (19 999 Ft/hó; éves zárás 14 999 Ft/év; változás bejelentése helyetted 4 999 Ft; jogállás-változás 7 999 Ft; szünetelés alatt 2 999 Ft/hó; magad bejelentve 0 Ft) + "Bármikor lemondhatod." Values come from one JSON file the landing build reads (`kod/landing/arak.json`, generated from `FEE_DEFAULTS` by a script) – no hand-typed prices.
- Footer: Somosi Kft. data from `brand.json` (name, seat, tax number, registry number), links ÁSZF / Adatkezelés (`https://app.adozz.hu/jogi/aszf`, `…/adatkezeles`), "Ügyfélszolgálat: az appban, az Üzenetek fülön" while `supportEmail` is a `[CÉGADAT…]` placeholder [TULAJ/JOGI: Ekertv. needs an e-mail address on the site before real customers]. No phone.
- Calculator link only when `/kalkulator` exists (it does not after k6).

---

### 29.4 D – Prices, no trial, separator, taxpayer lookup

#### 29.4.1 Real prices without "DEMO"

- `FEE_DEFAULTS` (enums.ts, B1): `eves_zaras` 14 999 / év, `valtozas_egyszeru` 4 999, `valtozas_jogallas` 7 999, `szuneteltetesi_dij` 2 999 / hó → **`confirmed: true`**, note "Tulaj 11-20: végleges ár". New kinds (§29.12): `igazolas_jovedelem`, `igazolas_ado`, `igazolas_koma`, `igazolas_ev_kivonat`, `igazolas_egyeb` (0 Ft, alkalom, confirmed), `megszuntetes` (7 999, alkalom, confirmed; owner: "priced as the legal-status change").
- Data step `data.k29` (idempotent, worker start): every `fee_settings` row whose amount equals the owner's price and `confirmed_at` is null → `confirmed_at = now`, history row "Tulaj 11-20: végleges ár"; a row with another amount (an admin edit) is left as it is and listed in the step's audit.
- **An admin edit is the confirmation** from now on: `updateFeeSetting` sets `confirmed_at = now`, `confirmed_by = admin`; `POST /admin/fees/:kind/confirm` stays (no-op if confirmed). The amber DEMO chip on prices disappears everywhere (app, panel, e-mails, fee lines); `fee_charges.demo` = false for new rows. The rule "unconfirmed fee cannot be charged in production" stays in code (it never triggers now). Validation: amount 0 or ≥ 200 Ft (Stripe HUF minimum ≈ 175 Ft), whole forints; a rise of a monthly fee still needs `effectiveFrom ≥ today + 30` (ÁSZF 6.7).
- What stays "DEMO": the **payment provider** marking while `PAYMENT_PROVIDER=demo` ("DEMO FIZETÉS") and the DEMO díjbekérő while `INVOICE_MODE=demo` – they are honest (no money moves).
- QA grep after the build: no "DEMO" chip next to 14 999 / 4 999 / 7 999 / 2 999 in app, panel, mail templates and `jogi`; the 19 999 sweep of §28.K.1 stays green.

#### 29.4.2 No trial anywhere

- `NEW_BUSINESS_CHARGE_POLICY` default **`azonnal`**: on the new-business path the card step is open right after the contract (§29.10 order), no "Addig minden ingyenes" lock text. The env value `adoszam_utan` stays possible but is not used.
- Texts to change (B3 for app/jogi, B1 for backend content): `tulaj1118.ts` key `bekotes.zarolt.elofizetes_adoszam_utan` (text → "A kártyádat a szerződés után kérjük." – kept for the env option only), app fallbacks in `bekotes/elofizetes.tsx` and the MINTA files, `jogi/app_szovegek.json` FAQ 12 ("Amíg nincs adószámod, nem fizetsz semmit…" → "A havidíjat a szerződés és a kártya megadása napjától fizeted. Ebben benne van a vállalkozásod elindítása is: az útmutató, az értesítés átnézése és a visszahívás."), ÁSZF "Röviden" bullet, 2.4 last sentence, 4/A.6, megbízási szerződés 5.1 + 2.7 (as `jogi/README.md` item 10 lists), the welcome and landing copy. Grep after the build (`ingyenes(en)? (próba|hónap)|próbaid|addig minden ingyenes|amíg nincs adószámod, nem fizetsz`) must find nothing; "ingyenes" stays only for the self-filed change guides (0 Ft rule) and the callback.
- The guided flow, the landing and the welcome screens say: "Az első hónapot a kártyád megadásakor fizeted. Bármikor lemondhatod." – never "ingyenes" for the service.

#### 29.4.3 Separator everywhere

Every client screen (incl. the new §29 screens, the guided flow, auth screens, `/fizesd-ki`, `/igazolas/*`, `/kimutatas`) and every panel page with stacked sections uses the C_VEGLEGES rule: `.szak + .szak { border-top: 10px solid #D3DAFC }` (app: the `Szakasz` component; panel: the shared section class). B3 sweeps all screens: screenshots at 390×844 and 320×640 (app) and 1440/1280 (panel), LOOKED at; a list of screens checked goes into the report.

#### 29.4.4 Taxpayer lookup (builds §28.K.9 backend; B1)

- `services/adoszam-kereso.ts`: `lookupTaxpayer(deps, clientId, torzsszam)` – nav-kliens `queryTaxpayer` with **our own technical user** (`NAV_LOOKUP_MODE` test|prod, `NAV_LOOKUP_TAX_NUMBER`, `NAV_LOOKUP_LOGIN`, `NAV_LOOKUP_PASSWORD`, `NAV_LOOKUP_SIGN_KEY`, `NAV_LOOKUP_EXCHANGE_KEY`; secrets never logged; config: all five or none). Not configured: `APP_ENV=demo` → nav-kliens mock (`demo: true`); production → status `lookup_not_configured`.
- **Timeout 8 s** (`AbortSignal.timeout(8000)` around the queued call incl. the queue wait) → status `unavailable` + `message` "Most nem érjük el a NAV-ot. Töltsd ki kézzel – ugyanúgy jó." The app then opens the manual form with the digits kept.
- **Cache 24 h, memory only**: `Map<hmac(torzsszam), { result, at }>` in the API process (`APP_DATA_KEY`-derived HMAC key; max 1 000 entries LRU; never written to the DB, never logged; cleared on restart). Only successful NAV answers are cached (found / not found / not EV), never errors. A cache hit does not count against the client's rate limit (`TAXPAYER_LOOKUP_RULES`: 10/h, 30/day per client) but is audited the same (`onboarding.taxpayer_lookup` with `found`, `demo`, `cached` only).
- Endpoints (contracts already in shared): `POST /client/onboarding/taxpayer-lookup` → `TaxpayerLookupResult` (+ `cached: boolean`); `POST /client/onboarding/business-identity` (`BusinessIdentityInput`) → saves adószám (or `adoszamPending`), name, székhely, ÁFA answer, evSince, activity, regime answer into the profile/onboarding step data; `POST /acc/clients/:id/adoszam` (`AdoszamStaffInput`) with the check digit and the ÁFA code warning.
- `[JOGI]`: the adatkezelés purpose note (§28.K.20) now also says "a lekérdezés eredményét legfeljebb 24 óráig a szerver memóriájában tartjuk".

---

### 29.5 F1 – "Igazolást kérek"

**Rules from the official source** ([NAV-IGAZ] = NAV 22.1. információs füzet "Adóhatósági igazolások", közzétéve 2026-10-02; [NAV-KOMA]; [NAV-EV]):
- NAV certificates are **free** ("ingyenesen kérhetők"), requested on the **IGAZOL** form (ÁNYK/ONYA, KAÜ login); a **meghatalmazott may act** for the taxpayer ("Az adózót meghatalmazott is képviselheti… a kérelem előterjesztésekor, az igazolás átvételekor"; in ONYA as a representative). Deadline for NAV: **6 days** (Adóig. vhr. 1. § (4)), extendable once by ≤ 30 days (Air. 50. § (2)). Electronic certificates go only to the taxpayer's or the representative's **tárhely**, signed and time-stamped; "**Az elektronikusan kiállított hivatalos irat csak elektronikus formában érvényes**" → we hand over the original PDF file, never a re-render; a paper copy can be asked by post (also directly to the user organisation).
- Required data on IGAZOL: purpose (jogcím), the **user organisation's name** ("az igazolás felhasználójának … megnevezése"), copies, delivery, type, the **tax year** for a jövedelemigazolás, the language for an illetőségigazolás.
- **Language:** adó- and jövedelemigazolás **only in Hungarian**; illetőségigazolás Hungarian and English.
- **Jövedelemigazolás** is per tax year and **cannot be issued for a year without a filed SZJA return** ("nem adható ki, ha … nem nyújtott be bevallást"); for átalány it shows the revenue, the cost ratio, the átalány income, its tax-free part and the taxable income; for KATA the '…KATA declaration data (60 % of the declared revenue).
- **Adóigazolás:** since **2026-10-01** there is no separate "nemleges/általános" kind; it certifies no debt + all returns/payments done as of the issue day (or a chosen day); a "bővített" one with return data is often asked by banks (e.g. Széchenyi Kártya – user KAVOSZ Zrt.).
- **KOMA:** being in the Köztartozásmentes Adózói Adatbázis replaces the tax certificate wherever a law asks for it; a non-law user (bank, partner) decides itself. Admission on the **KOMA form**, entry on the **10th of the following month**, monthly update on the 10th; public lookup by name / adószám / adóazonosító jel without login; certificate of KOMA status on IGAZOL with jogcím **A298**. Conditions: Art. 260. § (1) (net tax debt ≤ 5 000 Ft, other public debt ≤ 30 000 Ft, no insolvency proceedings, returns filed).
- **EV register data:** the public register search is free for anyone (by nyilvántartási szám or adószám); an official **hatósági bizonyítvány** about the own register data is issued by NAV on request (online with KAÜ, in person, by post; **8 days**; electronically to the tárhely or by post). [KÖNYVELŐ: fee of the hatósági bizonyítvány – the NAV page does not state it; and whether the 2027 move of the EV register to the chamber changes the channel.]

**Types (`CERTIFICATE_TYPES_K29`, k29f.ts; legacy values mapped: `nullas_igazolas` → `adoigazolas`, `koztartozasmentes_igazolas` → `koma`):**
| Type | Client label · one line | Asked from the client (one per screen) |
|---|---|---|
| `jovedelemigazolas` | "Jövedelemigazolás" · "A NAV igazolja, mennyi volt a jövedelmed egy évben. Bank, hitel, lízing, albérlet kéri." | year (only years with a filed return; the current year → "Erre az évre még nincs bevallás, ezért a NAV még nem ad róla igazolást. Addig a Bevételi kimutatás segíthet." + button to §29.6), purpose, user name, deadline, paper copy |
| `adoigazolas` | "Adóigazolás (nincs tartozásod)" · "A NAV igazolja, hogy nincs adótartozásod. Pályázat, hitel, partner kéri." | purpose, user name, "Bővített kell? (bevallási adatokkal – bankok kérik)" igen/nem/nem tudom, deadline, paper copy |
| `koma` | "Köztartozásmentes adatbázis (KOMA)" · "Ha benne vagy, sok helyen nem kell külön igazolás. Megnézzük, és ha kell, kérjük a felvételed." | purpose, user name (optional), deadline |
| `ev_kivonat` | "Egyéni vállalkozói nyilvántartás adatai" · "Kivonat arról, ami a nyilvántartásban áll rólad, például a tevékenységeid és a székhelyed." | purpose, "Hivatalos (hatósági bizonyítvány) kell, vagy elég egy kinyomtatott kivonat?" chips, deadline |
| `egyeb` | "Más igazolás" · "Írd le, mire van szükséged." | free text ≤ 500, deadline |
Common screens: **purpose** chips "Bank, hitel" · "Lízing" · "Albérlet" · "Pályázat, támogatás" · "Széchenyi Kártya" (→ user prefilled "KAVOSZ Zrt.") · "Más" (text ≤ 120); **"Ki kéri? (például OTP Bank)"** (≤ 120, required for jövedelem/adó); **"Meddig kell?"** date (optional; < 8 days → amber "A NAV-nak akár 6 nap is kellhet, ezért lehet, hogy addigra nem lesz kész."); **"Papíron is kell?"** toggle → "Postán is kérjük a lakcímedre" (+ "vagy egyenesen annak, aki kéri" with its address); **"Angolul kell?"** (link "Mi ez?") → "A NAV a jövedelem- és az adóigazolást csak magyarul adja ki. Ha angolul kell, hiteles fordítást külön kell kérned." (stored as `englishRequested` so the accountant sees it). Summary + fee line ("Díja: benne van a havidíjban." when 0, else "{osszeg} Ft, előre fizetve" → §29.1.7) → main button **"Elküldöm"**. Nothing else is asked (adóazonosító jel, address etc. come from the profile).

**Where:** Főoldal quick action "Igazolást kérek" and Fiók → "Igazolások" → `/igazolas` (list with status) and `/igazolas/uj` (the form). The certificate cards of the old `/keresek/uj` open `/igazolas/uj` (the "adatváltozás / kérdés" types stay there). `POST /client/certificates` creates the `requests` row (`direction 'ugyfeltol'`, `type 'igazolas'`) + the `certificate_requests` row in one transaction; the old `POST /client/requests` with `certificate` keeps working for old app builds (mapped to the new types).

**Statuses + timeline** (`certificate_requests.status`; `certificate_events` rows; client text `CERT_STATUS_TEXTS`):
`dijra_var` ("Fizetésre vár") → `beerkezett` ("Elküldted – {firstName} hamarosan beadja") → `navnal` ("{firstName} beadta a NAV-nak ({datum}). A NAV legfeljebb 6 nap alatt adja ki.") → `kesz` ("Kész – letöltheted") | `elutasitva` ("Nem adható ki: {ok}") | `visszavonva` (client cancels before `navnal`). KOMA outcomes in the `kesz` text: "Szerepelsz a KOMA-ban ({datum} óta)." / "Kértük a felvételed: {honap} 10-én kerülsz be." / "Megjött az igazolás (A298)."
- Every status change → push + in-app **`certificate_status`** (variants `navnal`, `kesz`, `elutasitva`); `kesz` text "Kész az igazolásod" / "{tipus}: letöltheted az appban." (e-mail too). Service lock: requesting is locked (`igazolas_keres` – existing rule); downloading a finished one stays open.

**Panel (accountant: own clients; admin: all; B2):** queue **`/igazolasok`** (columns: client, type, purpose/user, deadline, status, age; overdue chip when `navnal` > 6 days: "NAV-határidő lejárt – nézz rá"), detail page with everything IGAZOL needs (name, adóazonosító jel masked + reveal (audited), adószám, address, type, year, purpose, user name, copies, delivery, bővített, English note), buttons: **"Beadtam a NAV-nak"** (date, optional iktatószám) → `navnal`; **"Feltöltöm az igazolást"** (PDF only, magic-byte check, ≤ 15 MB; stored unchanged as document category `igazolas`, visibility shared, in the dossier month of the upload, `result_document_id`) → `kesz`; **"Nem adható ki"** (reason ≤ 300, required; quick reasons "Erre az évre még nincs beadott bevallás", "Tartozás miatt nem nullás", "Más") → `elutasitva`; "Írok az ügyfélnek" (Üzenetek). Staff notification `certificate_requested` to the client's accountant; staff lock rule unchanged (`igazolas_keres`). We **never** log in anywhere: the accountant uses his own meghatalmazott access outside the app.

**Fees:** per type in `fee_settings` (`igazolas_*`, default 0 Ft, admin-editable at `/admin/dijak`). > 0 → a `fee_charges` row (purpose `igazolas`), status `dijra_var` until paid (§29.1.7), then `beerkezett`.

---

### 29.6 F2 – Bevételi kimutatás (PDF on one tap)

- Client: Főoldal quick action and `/kimutatas`: main button **"Idei kimutatás letöltése"** (1 January → today); chips for the previous years ("2025 egész éve") and **"Más időszak"** (from–to month, ≤ 24 months, not before the client's first revenue month). `GET /client/income-statement?from=YYYY-MM&to=YYYY-MM` → PDF (`application/pdf`, generated on the fly with `lib/pdf.ts`, Geist; cached 10 min per (client, from, to, data hash)); the app opens it like the other PDFs (signed file link on native; download on web) and offers "Mentés a dossziéba" (stores a copy as document category `kimutatas`).
- **Content** (`INCOME_STATEMENT_TEXTS`):
  - Title "Bevételi kimutatás – {from}–{to}"; client block: name, EV name, adószám, EV nyilvántartási szám (if known), székhely; regime line: "Átalányadózó egyéni vállalkozó (költséghányad: {x}%)" or "Kisadózó vállalkozó (kata)" (per year when it changed: one line per regime span).
  - Table per month: "Hónap" · "Kiállított számlák (db)" · "Egyéb bevétel (db)" · "Bevétel (Ft)"; source = `revenue_items` (not deleted; `source 'nav_szamla'` = issued invoices from the NAV sync, `kezi` = manual receipts), grouped by **`received_on`** (the day the money arrived – the same basis as the tax); átalány uses `counts_for_atalany`; KATA uses all revenue. Months with an estimated date (`received_on_estimated`) get a footnote mark "*a beérkezés napja becsült (a számla fizetési határideje)". Total row; "ebből kézi tétel: {Ft}".
  - Generated: "Készült: {datum} {ido}, az Adózz appból."
  - Honest note (always): "Ez a kimutatás a NAV Online Számla rendszeréből letöltött számláid és az általad megadott egyéb bevételek alapján készült. **Nem hivatalos NAV-igazolás.** Hivatalos jövedelemigazolást az appban kérhetsz: Igazolást kérek."
  - **Stamp** only when the accountant approved exactly this data: "A könyvelőd, {Név} ellenőrizte: {datum}." – `income_statement_approvals (client_id, from_month, to_month, data_sha256, approved_by, approved_at)`; the stamp is printed only if the current data hash equals an approval (data changed → no stamp; the screen says "A könyvelőd még nem ellenőrizte ezt a változatot." + capsule **"Kérem, hogy {firstName} ellenőrizze"** → a `requests` row `ugyfeltol` type `kimutatas_ellenorzes` + staff notification).
- Panel (B2): client page tab section "Bevételi kimutatás": the same table for a chosen period, **"Ellenőriztem, rendben"** (stores the approval for the current hash; audit `income_statement.approved`) → client notification `income_statement_checked` ("{firstName} ellenőrizte a bevételi kimutatásodat").
- Service lock: download stays open (own data).

---

### 29.7 F3 – "Megszüntetés" guide + "Megszüntetjük helyetted"

**Rules (official; [NAV-MEGSZ], [NAV-SZ], [KATA], [IPA]; uncertain ones marked):**
- The EV is closed in the **Vállalkozói Ügysegéd** (KAÜ login), at any NAV office, or by phone on the NAV Infóvonal (1819); **not by post**. Free ("díj- és illetékmentes"). The closing day can be **the day after the notice at the earliest**, and **cannot be changed later** (an earlier day may be reported later). Done when it shows in the register; the notice can be downloaded in the Ügysegéd. A meghatalmazott may act (in person with the original power of attorney; online as representative [KÖNYVELŐ/JOGI: whether the accountant may file it online as meghatalmazott – same open question as `jogi/UGYVED_KERDESEK_k5.md`]).
- From **2027-01-01** the EV register moves to the chamber (ÁSZF 4/C.8, `CHANGE_UGYSEGED_VALID_UNTIL`) → the Ügysegéd steps are valid until 2026-12-31; after that the guide shows text only ("A kamara új felületén…") until real screens exist [ELLENŐRIZENDŐ].
- **After closing (what we do; deadlines):** the quarterly contribution return ('58) for the quarter of closing – due the **12th of the month after the quarter**; the **SZJA return** of the closing year with the átalány sheets – due **20 May** of the next year (as every year); **KATA**: the KATA status ends with the EV; the '…KATA declaration (+ különadó if over the keret) is due **within 30 days** after the end ([KATA] §28.K.11); **HIPA**: an extra (soron kívüli) local business tax return because of the closing – deadline per the municipal rules [KÖNYVELŐ: confirm the exact deadline; municipal guides cite about 30 days]; **ÁFA**: alanyi mentes EVs have no ÁFA return; only if the EV was registered for ÁFA / has a community tax number [KÖNYVELŐ]; NAV Online Számla: no more invoices after the closing day; the bank account and the invoicing program are closed by the client; the chamber is notified by NAV. Money that arrives for the business after the closing still counts as business revenue of the closing year [KÖNYVELŐ: confirm wording].
- **What to keep:** invoices (copies), receipts, bank statements, NAV letters – at least until the tax limitation ends: 5 years from the end of the year in which the last return was due (Art. 202. §); our copies stay downloadable in the app until then (GDPR export).
- **Do not revoke the NAV meghatalmazás** before the last returns are filed; the accountant ends it within 8 days after the contract ends (ÁSZF 8.6).

**Change kind `valtozas_megszuntetes`** ("A vállalkozás megszüntetése") – added to `CHANGE_KINDS`, `ASSIST_KINDS`, `CHANGE_UGYSEGED_KINDS` (B1 edits enums.ts; B2 builds the guide): hub card in `/valtozas` (family of §28.5) with the choice screen of §28.K.2: card A (highlighted) **"Megszüntetjük helyetted"** – "Megadod a napot, {firstName} meghatalmazottként bejelenti, és elvégzi a záró bevallásokat. Díja: {dij} Ft, előre fizetve." (fee kind `megszuntetes`, 7 999 Ft default, admin-editable) · capsule B **"Magam jelentem be"** (the guide, 0 Ft) · text link "Előbb beszéljük meg" (callback, topic `megszuntetes`).
- **Form:** "Melyik nappal szűnjön meg?" (date ≥ tomorrow; ≤ today + 90; warning line "A bejelentés után ezt a napot már nem lehet módosítani.") · "Volt alkalmazottad az idén?" igen/nem · "Mi legyen az Adózz-előfizetéseddel?" shown as text, not a choice: "A záró bevallásokig folytatjuk, utána magától megszűnik. Az éves zárás díja ({evesDij} Ft) akkor jár, ha az idei SZJA-bevallást is mi adjuk be."
- **Guide steps** (`valtozas_megszuntetes` template; drawn pictures with the honest line "Ezt a képernyőt még nem fotóztuk le, ezért rajzon mutatjuk." until real captures exist): `elotte` ("Mielőtt bejelented": utolsó számlák kiállítva, kintlévőségek, alkalmazott, nyitott NAV-tartozás) · `belepes` · `ugyseged_fooldal` · `megszuntetes_inditas` · `megszuntetes_datum` (the day + the warning) · `ellenorzes_bekuldes` · `ertesites_letoltes` · `app_feltoltes` ("Töltsd fel ide a NAV értesítését") · `utana` ("Ezek jönnek utána": the deadlines above as rows with "{firstName} intézi" chips) · `megorzes` (what to keep, how long, "Töltsd le az adataidat" button → GDPR export).
- **Follow-ups on `change-done`** (accountant checklist `CHANGE_FOLLOWUPS.valtozas_megszuntetes`): `zaro_jarulek_bevallas` ('58 for the closing quarter), `szja_eves` (annual closing for the year – creates the annual closing for the client, fee `eves_zaras` when due), `kata_zaro` (KATA only), `hipa_soron_kivuli`, `afa_ellenorzes`, `meghatalmazas_megszuntetes` (after the last return), `elofizetes_lezaras` → when ticked: `cancelSubscriptionK29(when: 'idoszak_vege')` with reason "megszuntetes" and the client notification "Lezártuk a vállalkozásod ügyeit. Az előfizetésed {datum}-ig él, utána nem vonunk le többet."
- Subscription rule: the monthly fee runs until `elofizetes_lezaras` is ticked (the closing work is done); no proration; the annual closing (May next year) is ordered separately (§28.K.3 allows it for an ended client).

---

### 29.8 F4 – Deadlines to the client's own calendar

- **Feed**: `calendar_feeds (client_id PK, token_hash text unique, token_enc text, created_at, rotated_at, revoked_at, last_fetched_at, fetch_count)`. Token = 32 random bytes base64url; lookup by `sha256(token)`; `token_enc` (APP_DATA_KEY) so the client can copy the link again.
- `GET /client/calendar` → `{ enabled, httpsUrl, webcalUrl, googleUrl, outlookUrl }`; `POST /client/calendar` (create or **"Új linket kérek"** = rotate; the old link stops at once); `DELETE /client/calendar` ("Kikapcsolom"). Audit `calendar.feed_created|rotated|revoked`.
- **Public** `GET /api/v1/naptar/{token}.ics` (served on the API and app hosts): `text/calendar; charset=utf-8`, `Cache-Control: private, max-age=3600`, ETag; unknown/revoked → 404 (same body for both); rate limit 60/h per token and 600/h per IP; `last_fetched_at` updated at most once an hour. Auto-revoked when the contract ends (§29.9.4) or on anonymisation.
- **Content** (RFC 5545): `X-WR-CALNAME:Adózz – határidők`, `X-WR-TIMEZONE:Europe/Budapest`, all-day `VEVENT`s from `clientDeadlines(today − 30 d … today + 400 d)`; `UID` = `HMAC(clientId:deadlineId)@adozz.hu`; `SUMMARY` only from the fixed label list `ICAL_LABELS` (no names, no amounts, no adószám, no accountant name): "SZJA-előleg befizetése", "TB-járulék befizetése", "Szocho befizetése", "Adóbefizetés (negyedéves)", "Kata befizetése", "Iparűzésiadó-előleg", "SZJA-bevallás", "Iparűzésiadó-bevallás", "Kata-nyilatkozat", "Éves zárás kérdőív", "Könyvelői kérés határideje", "Határidő" (fallback); `DESCRIPTION`: "Részletek az Adózz appban: {APP_PUBLIC_URL}/hataridok" (no amount); `VALARM` 1 day before (clients that ignore it keep the app reminders).
- **Screen** (`/hataridok`, B2): top section "Naptárba" – "Feliratkozom a naptáramban" opens a sheet: "Google Naptár" (`https://calendar.google.com/calendar/r?cid=` + encoded webcal URL), "Apple Naptár" (`webcal://…`), "Outlook" (`https://outlook.live.com/calendar/0/addfromweb?url=…&name=Adózz`), "Link másolása", and the lines "A naptárad naponta frissíti. A naptárban csak a határidő neve látszik, összeg és név nem." · "Új linket kérek" · "Kikapcsolom". Per row a capsule **"Naptárba"** → sheet "Google" (`calendar.google.com/calendar/render?action=TEMPLATE&text=…&dates=YYYYMMDD/YYYYMMDD+1&details=…`), "Apple" (`GET /client/deadlines/{id}/ics` – one event, same labels), "Outlook" (`outlook.live.com/calendar/0/deeplink/compose?subject=…&startdt=YYYY-MM-DD&enddt=…&allday=true&body=…`). In-app reminders stay as they are.

---

### 29.9 F9 – Owner console with full control (panel, admin only)

#### 29.9.1 Access

- Routes `/admin/konzol/**` (panel) and `/api/v1/admin/console/**` (API): role **admin** only (others: 404, also via the API directly); the admin must have **TOTP enabled** (regardless of `STAFF_TOTP_REQUIRED`; otherwise the panel sends him to `/ketlepcsos-beallitas`, the API answers 403 `mfa_setup_required`).
- **Step-up for every write**: `POST /admin/console/step-up { code }` (TOTP or recovery code, existing checks and lockouts) → `admin_step_ups (session_id PK, user_id, verified_at)`; writes require `verified_at ≥ now − 10 min` for the current session (`sid` of the access token) else 403 `step_up_required` → the panel shows the code dialog and repeats the action.
- Every write: **confirmation dialog** (what happens, to whom, the amount) and, for destructive ones, a **reason** (min 5 chars): terminate, reactivate, refund, off-session charge, price change/discount/free months, lock/unlock, suspend/resume, erase, data edit of NAV-sourced fields, announcement to > 1 client. The API refuses without `reason` where required (422).
- **Audit** (append-only, existing `audit_log`; the app role has only SELECT + INSERT): `action` `admin.<area>.<verb>`, `actor_user_id`, `client_id`, `details: { reason, before, after, amountHuf?, requestId }`; `before/after` mask secrets (adóazonosító jel, bank account, phone → last 3 characters), never card data, never tokens. Visible on the client card (tab "Napló") and in the global log `/admin/naplo` (filter "Admin-műveletek").

#### 29.9.2 Overview `GET /admin/console/overview` (`/admin/konzol`)

All numbers from the DB, `is_test` clients excluded, demo payments counted under a "DEMO" label in demo:
- **Ügyfelek:** active (lifecycle `aktiv`) split átalány / KATA (current-year `client_tax_profiles.regime`), in onboarding, suspended (`felfuggesztve`), terminated; **new and cancelled per month** (last 12 months: new = `clients.created_at`; cancelled = `subscriptions.canceled_at` + terminations).
- **Pénz:** **MRR** = Σ `effectiveMonthlyAmount` of subscriptions `active`/`past_due` not `cancel_at_period_end`; **collected revenue per month** = Σ successful `payments.amount_huf` − refunds, by `succeeded_at` month (12 months), split monthly fee / one-off fees; **failed and overdue**: count + Σ of `past_due` and `suspended` + open `hitelesites_kell`; **locked clients** (`service_lock` not null) with reasons; **upcoming charges** next 7 / 30 days (count + Σ from `next_charge_at` and the effective amount); **fees by kind** per month (annual closing, changes, suspension, certificates, closing, admin) – paid / open / waived.
- **Könyvelők:** per accountant: clients, open tasks (open requests to the client + client requests + open assists + check-in items + certificates + annual closings with the ball at the accountant), the **oldest open item** (kind + age in days).
- Each tile links to the filtered client list. Tests compare every number with a direct SQL count on the seed.

#### 29.9.3 Client list and client card

- `GET /admin/console/clients?q&status&regime&accountant&unpaid&locked&cancelled&terminated&cursor` (`/admin/konzol/ugyfelek`): search by name, e-mail, adószám, phone (last digits); columns name, regime chip, accountant, lifecycle, subscription status, next charge, unpaid amount, lock chip, created.
- `GET /admin/console/clients/:id` (`/admin/konzol/ugyfelek/:id`) – **everything we store**, in sections (tabs on narrow screens), each with its own small endpoint so the page loads fast: **Profil és vállalkozás** (all `clients` fields, business identity + source "NAV-ból" chip, tax profiles per year, regime, allowances), **Hozzájárulások** (every `consents` row: document, version, time; card consent), **Előfizetés és ár** (plan, effective price + overrides, pause, next charge, failures, grace, lock), **Fizetések** (every `payments` row + refunds + disputes), **Díjszámlák** (every fee invoice, PDF), **Kártya** (brand, last 4, expiry, status – never more), **Díjak** (fee charges), **Kérések** (requests both ways), **Üzenetek**, **Dokumentumok** (list; opening a file is audited), **Igazolások** (F1), **NAV-kapcsolat** (credential status, last sync runs, errors), **Értesítések** (sent notifications: kind, channel, time, read), **Belépések** (`users.last_login_at`, sessions: kind, created, last used, UA short), **Napló** (audit for this client). Encrypted fields (adóazonosító jel, phone, bank account) masked with "Mutasd" (decrypt on demand, audited `admin.client.field_revealed`).
- **"Ügyfél szemével"** (read-only): `GET /admin/console/clients/:id/preview` returns the DTOs the client app would get (`ClientHome`, `OnboardingState`/`JourneyView`, `SubscriptionView`, `FeesView`, open requests) computed for that client; the panel renders them in a 390 px phone frame as simplified screens ("Főoldal", "Bekötés", "Előfizetés", "Díjak") with the banner "Így látja most – csak nézet". No client token is ever minted; nothing can be clicked through to an action. Audit `admin.client.preview`.

#### 29.9.4 Actions (`POST/PATCH /admin/console/clients/:id/...`; all step-up + confirm + audit)

| Action | Endpoint · body | Rules |
|---|---|---|
| Edit client data | `PATCH …/profile` `{ fields…, confirmNavOverride?, reason? }` | same validators as the client forms (adószám + check digit, adóazonosító jel + check digit, irányítószám, phone, dates); a field that came from the NAV lookup needs `confirmNavOverride: true` + reason ("Ezt a NAV-adatbázisból töltöttük ki. Ha átírod, nézd meg az ONYA-ban is."); e-mail change → new address must be verified by the client (code mail), notice to the old address; client notification `profile_changed_by_admin` ("Módosítottuk az adataidat: {mezok}") |
| Change price / discount / free months | `POST …/price` `{ kind: 'egyedi_ar'|'kedvezmeny_szazalek'|'ingyenes_honap', amountHuf?|percent?|months?, fromPeriod, untilPeriod?, reason }` | `client_price_overrides`; a rise applies only to periods starting ≥ today + 30 (ÁSZF 6.7) and the client is notified 30 days ahead (`price_changed`); discounts/free months apply from the next charge; revoke = `DELETE …/price/:overrideId` (reason) |
| Waive / add a fee | `POST /admin/fee-charges/:id/waive` (exists) · `POST …/fees` `{ kind, amountHuf?, note, reason }` | an admin fee is a `fee_charges` row purpose `admin`; the client gets `fee_due` and pays in the app |
| Charge a one-off fee now | `POST …/fees/:chargeId/charge-now` `{ reason }` | only for charges the client ordered himself (not purpose `admin`), only with an `aktiv` card; off-session §29.1.7; outcome shown |
| Refund | `POST /admin/console/payments/:id/refund` `{ amountHuf, reason }` | §29.1.10 with automatic storno/correction |
| Lock / unlock | `POST …/lock` `{ mode: 'zarolva'|'feloldva', until?, reason }` · `DELETE …/lock` | `clients.service_lock_manual`; `zarolva` adds reason `kezi` to `service_lock` (client text "Szünetel a könyvelésed. Írj nekünk, ha kérdésed van."); `feloldva` suppresses the automatic reasons until `until` (≤ 30 days; "türelmi idő"); `computeServiceLock` honours both |
| Suspend / resume (szüneteltetés) | `POST …/pause` `{ from, to?, reason }` · `POST …/pause/close` `{ lastDay, reason }` | existing `openPause`/`closePause` with source `admin` (new `PAUSE_SOURCES` value) |
| Reassign accountant | `POST …/accountant` `{ accountantId, reason }` | existing rules (2FA of the new accountant, notices to everyone) |
| Invite / password reset link | `POST …/send-verification` · `POST …/send-password-reset` | triggers the existing e-mail code flows to the client's own address; the admin never sees a code or sets a password (DEMO postafiók masks it as today) |
| Message one client | `POST …/messages` `{ body }` | Üzenetek, sender "Ügyfélszolgálat" |
| Announce | `POST /admin/console/announcements` `{ title ≤ 80, body ≤ 600, channels: { inApp: true, push, email }, filter, expectedCount }` | first a dry run returns the count; the send must echo it; ≤ 3 per day; notification kind `announcement`; stored in `announcements` |
| GDPR export | `POST …/export` `{ reason }` | existing export builder; the admin gets the download link once; audited |
| **Terminate (felmondás)** | `POST …/terminate` `{ kind, reason, effectiveOn? }` | §29.9.5 |
| Reactivate | `POST …/reactivate` `{ reason }` | only terminated, not anonymised: users.status active, lifecycle `bekotes_alatt`, steps `szerzodes` + `elofizetes` back to `nincs_kezdve` (new contract + card needed), the guided flow resumes there; notification `contract_reactivated` |
| **Erase (anonymise)** | `POST …/anonymize` `{ reason, confirmName }` | §29.9.6 |

Panel layout: client card header with the action menu (one button "Műveletek ▾" + the most used: "Üzenet", "Ár", "Zárolás"); each action = a dialog with the fields, the reason box, the summary sentence and "Megerősítem". Success toast + the card refreshes.

#### 29.9.5 Termination per ÁSZF 8.5

- `kind` (`TERMINATION_KINDS`):
  - `rendes` – ordinary by us: **30-day notice** (ÁSZF 8.5); `effectiveOn = max(today + 30, current period end)`; **no further charge** after the notice (days after the paid period until `effectiveOn` are not charged) [JOGI confirm].
  - `azonnali_dij` – immediate for non-payment: allowed only when a fee is unpaid **more than 30 days** (oldest unpaid month's first failure ≤ today − 30, or an open fee charge due > 30 days ago); the API refuses otherwise ("Az ÁSZF szerint azonnal csak 30 napnál régebbi tartozás miatt mondhatunk fel.").
  - `azonnali_mas` – immediate for the other ÁSZF 8.5 grounds: sub-reason `valotlan_adat_pmt` | `jogellenes` | `bantalmazo` (required).
  - `ugyfel_kerte` – on the client's request: `idoszak_vege` (ÁSZF 8.1) or `azonnal` with the pro-rata refund of the remaining paid days (ÁSZF 8.3; refund via §29.1.10, automatic correction invoice).
- Effects (one transaction + after-commit calls): `clients.terminated` jsonb `{ kind, subReason, reason, noticeAt, effectiveOn, by }`; `cancelSubscriptionK29` (immediate kinds: `canceled` now; others: `cancel_at_period_end` with the end date); open `payments` cancelled (`cancelPending`); the saved card **detached** at the effective date (immediately for immediate kinds); open fee charges stay payable (listed in the settlement); calendar feed revoked at `effectiveOn`; on `effectiveOn` the existing end-of-relationship code runs (lifecycle `megszunt`, `endRelationship`), and the accountant gets a task **"Meghatalmazás megszüntetése a NAV-nál (8 napon belül)"** + "Technikai felhasználó letiltása" (ÁSZF 8.6).
- **Written notice**: a PDF letter "Felmondás" (`TERMINATION_LETTER` template per kind: who, why in plain words for the client – the internal `reason` is NOT printed for `rendes`, the ÁSZF point is cited for immediate kinds – the effective date, what happens with the data and the meghatalmazás, the settlement) stored as a client document (shared) **and** sent by e-mail (always-on kind `contract_terminated`, variants `rendes`, `azonnali`, `ugyfel_kerte`) + in-app + push. Title "Felmondtuk a szerződésedet" / "{datum}-ig minden marad. A részleteket a levélben olvasod." (immediate: "A szerződésed ma megszűnt. A részleteket a levélben olvasod.").
- **Settlement** ("Elszámolás" section in the letter + the console): paid periods, refunds, open fees, whether an annual closing will still be done; the final fee invoice/correction is created by the refund flow when money goes back.
- A payment after termination never reactivates the client (applyPaymentSucceeded checks `clients.terminated`).

#### 29.9.6 GDPR erasure = anonymisation (never a hard delete)

- Preconditions: subscription `canceled` and no money in flight (`payments` in `letrehozva`/`feldolgozas`/`bizonytalan`/`hitelesites_kell`); otherwise the API names what blocks it. `confirmName` must equal the client's full name.
- New `anonymizeClient(deps, clientId, { by, reason })` (B2; the existing self-service `executeDeletion` is refactored to call it, so both paths are the same): **updates only** – `users`: e-mail `torolt+{id}@deleted.invalid`, password/Google/Apple/TOTP fields null, display name "Törölt felhasználó", status `deleted`; `clients`: names "Törölt" / "ügyfél", `phone_enc`, `adoazonosito_jel_enc`, `adoazonosito_hmac`, `adoazonosito_last3`, birth name, address fields, attribution, referral code, mailbox code and senders → null (the identity data the law requires stay only in the retained KYC record and the retained documents); sessions **revoked** (`revoked_at`), push tokens disabled, notification title/body replaced by "—", message bodies of the client replaced by "[törölve]" except those under legal hold, callback phones null, calendar feed revoked, Stripe customer: `customers.update(email: null, name: null)` and detach all cards (the Stripe customer object itself is left, payments history needs it); `clients.anonymized_at`.
- **Kept** (legal retention, `legal_hold` + `retention_until`): fee invoices and their PDFs (Számv. tv. 169. §: 8 years), payments rows (amounts, dates, ids – accounting), tax records and documents the accountant worked with (Art. 202. §: end of year + 6), KYC records (Pmt. 57. §: 8 years after the relationship), the audit log. The Számlázz.hu invoices keep the buyer data by law.
- Audit `admin.client.anonymized` (reason, counts of rows changed). Irreversible: the dialog says "Ez nem visszavonható." Reactivation is impossible afterwards.

---

### 29.10 G – Guided first run ("bevezető")

#### 29.10.1 When it opens

- `clients.guided` jsonb `{ welcomeSeenAt?, pausedAt?, finishedAt?, lastKey?, doneSeenAt? }` (null = never started).
- **Auto-open** (instead of `/bekotes`) when: role client, lifecycle `bekotes_alatt` (onboarding not complete), not terminated, `guided.pausedAt` null and `guided.doneSeenAt` null. Checked by `src/app/index.tsx` (and after login/registration): `GET /client/guided` `show: true` → `router.replace('/bevezeto')`, else `/bekotes` as today. Active clients (David, the seed clients with finished onboarding) never see it. The owner's reset account (a new client) gets it on the next login automatically – no special code.
- **"Később folytatom"** (on every guided screen) → `POST /client/guided { action: 'later' }` (sets `pausedAt`, keeps `lastKey`) → `/bekotes` (the checklist stays the overview). There a top card **"Folytasd ott, ahol abbahagytad"** / "Következő: {lépés} · {idő}" with the main button **"Folytatom"** → `action: 'resume'` (clears `pausedAt`) → `/bevezeto` at the right step.
- When a waiting step resolves and gives the client something to do, the existing journey notification links to `/bevezeto` (`kezjegy://bevezeto`), which resumes at that step (it does not clear `pausedAt` by itself – only the tap does).

#### 29.10.2 Sequence (`GUIDED_ORDER` in k29g.ts; one source of truth = the server journey)

`GET /client/guided` (B3, `services/guided.ts`) builds the steps from **`buildJourney()`** (the existing journey: states, locks, waits, routes) reordered by `GUIDED_ORDER[variant]` and adds the pseudo-step `adoszam` on the `van` path:
| Variant | Order (each = one guided step; `*` = only when it applies) |
|---|---|
| (before the answer) | `udv` (3 welcome screens) → `ut` "Van már vállalkozásod?" |
| `van` | `adoszam` → `adatok` (the questionnaire pages "Rólad", "Vállalkozásod", "Helyzeted" + `alkalmazottak`*) → `kedvezmenyek`* (átalány only; the gate question) → `szerzodes` → `meghatalmazas` (self ONYA / "Intézzük helyetted") → `azonositas` → `elofizetes` (card, §29.1.13) → `kesz` |
| `inditas_onallo` | `adatok` ("Rólad") → `kedvezmenyek`* → `kerdoiv` (adatlap) → `bejelentes` (guide; client files) → `ertesites` (upload) → `szerzodes` → `azonositas` → `elofizetes` → `meghatalmazas` → `kesz` (`kamara` is optional and stays on the checklist) |
| `inditas_segitett` | `visszahivas` (waiting) → `adatok` → `kedvezmenyek`* → `kerdoiv` → `szerzodes` → `meghatalmazas` → `vegso_jovahagyas` → `azonositas` → `elofizetes` → `kesz` |
Deviations from the owner's spoken order, kept on purpose and stated in the report: **the contract comes before the NAV meghatalmazás** (the existing lock: our accountant is authorised under the signed contract), and **azonosítás** (the Pmt. identification, required before the business relationship) sits between the contract and the card.
- `GuidedView` DTO: `{ show, paused, variant, welcome: { seen, accountant: AccountantPublic | null, priceHuf, rows: { title, time }[] }, steps: { key, title, state: 'kesz'|'most'|'nyitva'|'var'|'kesobb'|'kihagyva', route, timeText, waitText?, lockedReason? }[], currentKey: string | null, progress: { done, total }, finished: boolean, pending: { title, actorLabel, timeText }[] }`. `currentKey` = the **first `most`/`nyitva` step in `GUIDED_ORDER`** (not the first in time) – so a waiting step never blocks the next one; `finished` = no client step left (only waits).
- `POST /client/guided { action: 'welcome_seen' | 'later' | 'resume' | 'step_seen' | 'done_seen', key? }`.

#### 29.10.3 Screens (app, B3; full screen: no tab bar; C look; one question or task per screen)

- **Guided header** (`VezetettFejlec`, replaces `CimSor` when `vezetett=1`): the narrowed blue band with "Vissza" capsule (previous guided step; on the first step: closes = "Később folytatom"), the step name, a **big progress bar** "{done} / {total} lépés kész" (one continuous 6 px bar, §28.K.10), and the text button **"Később folytatom"**. The existing screens keep their body; after a successful save they call `vezetettTovabb()` = `router.replace('/bevezeto')` (the router asks the server for the next step) instead of going home.
- **W1** – band: avatar of the brand rosette; title "Szia {keresztnev}!"; text "Üdv az Adózzban. Mi könyveljük az egyéni vállalkozásodat: kiszámoljuk az adódat, beadjuk a bevallásaidat, és szólunk, ha teendőd van." Main button "Tovább".
- **W2** – title "Ő lesz a könyvelőd"; the accountant's avatar (`Arckep`, 72) + "**{Név}**", line "{titulus}, nyilvántartási szám: {szam}"; text "Név szerint ismer. Neki írsz az appban, és ő ad be mindent a NAV-nál helyetted." (No accountant yet: "Kapsz egy saját könyvelőt" / "A beállítás közben kijelöljük. Addig csapatunk segít.") Main button "Tovább".
- **W3** – title "Így indulunk"; four rows (title + time, from the journey times): "Pár kérdés rólad és a vállalkozásodról" · "kb. 5 perc"; "Szerződés és engedély a NAV-nál" · "kb. 10 perc"; "A kártyád megadása" · "kb. 2 perc"; "{firstName} bekapcsolja a könyvelést" · "a NAV-tól függ". Section "Mennyibe kerül?": big number **"19 999 Ft / hó"** + "Minden benne van, amit az app tud. Az első hónapot a kártyád megadásakor fizeted. Bármikor lemondhatod." Main button **"Kezdjük"**, text link "Később folytatom". (`welcome_seen` after W3.)
- **`ut`** – the existing two-answer card ("Van már egyéni vállalkozásod?") as its own screen.
- **`adoszam`** (new screen `/bevezeto/adoszam`, the §28.K.9 flow, B3; backend §29.4.4): title "Add meg az adószámodat", sub "Ebből kikeressük a vállalkozásod adatait, neked csak rá kell bólintanod."; field with the mask; after the 8th digit the lookup (debounce 250 ms) → the confirm card **"Ez a te vállalkozásod?"** (name + székhely; "DEMO – kitalált adatok" chip in demo) → "Igen, ez az enyém" fills the rest of the number and goes on to the prefilled confirm screens (`Rendben` / `Javítom`) of §28.K.9 step 4; **"Hol találom?"** round i (explainer `adoszam`); text link **"Most nem tudom"** → the manual form (one field per screen); lookup states `not_found`, `not_ev`, `afa_warning`, `unavailable`/timeout ("Most nem érjük el a NAV-ot. Töltsd ki kézzel – ugyanúgy jó." + main button "Kitöltöm kézzel"), `rate_limited`. Onboarding is never blocked on the adószám.
- **Step screens** – the existing ones, opened with `?vezetett=1`: `/bekotes/adatok` (pages one per screen as today), `/bekotes/alkalmazottak`, `/kedvezmenyek/kerdoiv` (gate first: "Jár neked valamilyen adókedvezmény?" – "Igen / Nem tudom → kérdőív", "Nem" → next), `/bekotes/vallalkozas/adatlap`, `…/utmutato`, `…/feltoltes`, `/bekotes/szerzodes`, `/bekotes/meghatalmazas` (the three ways; "Intézzük helyetted" highlighted as today), `…/jovahagyas`, `/bekotes/azonositas`, `/bekotes/elofizetes` (§29.1.13).
- **Waiting interstitial** `/bevezeto/var` (shown once right after the client finished a step that starts a wait, e.g. the meghatalmazás was sent): title "Most {ki} jön" (NAV / {firstName} / Csapatunk), the existing `WAITING_TEXTS` body + time ("általában 1–3 munkanap"), line "Addig folytasd a következővel." Main button **"Tovább: {következő lépés}"**; if nothing is left for the client → the done screen.
- **Done** `/bevezeto/kesz`: big check, title "Kész vagy a te részeddel!", text "Most {firstName} és a NAV dolgozik. Szólunk, ha kell tőled valami." List of what is pending (who · what · usual time). Main button "Főoldal" (`done_seen`) → `/bekotes` (or `/` once active).
- Re-entering `/bevezeto` continues at `currentKey` (W1–W3 are skipped once `welcomeSeenAt` is set). "Vissza" on a done step opens it for editing; the bar never goes backwards.
- MINTA scenarios: `uj` (fresh: W1), `bevezeto_adoszam`, `bevezeto_var`, `bevezeto_kesz`, `bevezeto_szunet` (paused card on `/bekotes`).

#### 29.10.4 Copy (`GUIDED_TEXTS`, k29g.ts; tegező, short) – as in §29.10.3, plus: progress "{done} / {total} lépés kész"; paused card "Folytasd ott, ahol abbahagytad" / "Következő: {lepes} · {ido}" / "Folytatom"; "Később folytatom"; "Vissza".

#### 29.10.5 Acceptance (G)

A brand-new registration lands on W1; W1→W3→`ut`→`adoszam` (lookup finds the demo company; "Most nem tudom" works; the 8 s timeout path shows the manual form) →… each finished step goes straight to the next without the checklist; "Később folytatom" saves and shows `/bekotes` with the resume card; "Folytatom" continues at the right step; a waiting step shows the interstitial and the flow continues; the card step saves the card through Stripe TEST (4242) and the flow ends on the done screen; an active client never sees it; the owner's account (fresh) gets it; 390×844 and 320×640 screenshots of every guided screen LOOKED at.

---

### 29.11 E – Owner scripts (written by B1, **never run** by anyone but the owner)

#### 29.11.1 `C:/Users/UpgradePC/konyvelo_app/stripe_szerverre.ps1`

PowerShell 5.1 (no `&&`, no ternary), ASCII-safe like `kezjegy_kulcsok.ps1`:
1. Read `STRIPE_TEST_SECRET_KEY` and `STRIPE_TEST_PUBLISHABLE_KEY` from HKCU (`[Environment]::GetEnvironmentVariable(…, 'User')`) into variables; refuse anything not `sk_test_`/`rk_test_` / `pk_test_` ("Ez nem teszt-kulcs. Nem változtattam semmit.").
2. Check `https://api.adozz.hu/api/v1/health` is 200 (else stop: "Az api.adozz.hu még nem él – előbb a domain-átállás kell.").
3. Stripe API (`Invoke-RestMethod`, Basic auth header built in memory): list `GET /v1/webhook_endpoints?limit=100`; an endpoint whose `url` = `https://api.adozz.hu/api/v1/webhooks/stripe` is **deleted and re-created** (Stripe returns the signing secret only at creation): `POST /v1/webhook_endpoints` with `url`, `enabled_events[]` = the 8 events of §29.1.8, `api_version` = the constant `$StripeApiVersion` (equal to the backend's pinned SDK default; B1 keeps both in sync and a backend test compares them), `description` "Adózz API (teszt)". The returned `secret` stays in a variable.
4. Write `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `PAYMENT_PROVIDER=stripe` to `/srv/kezjegy/.env` **exactly the safe way of `kezjegy_kulcsok.ps1`** (values base64 into the remote script, `.env` copied to `_regi/` first, python merge, `chmod 600`, recreate `kezjegy-api kezjegy-worker`, wait for healthy).
5. Print only **`OK`** / **`NEM OK: <step name>`** per step (never a key, never the secret, never the endpoint id), then `GET https://api.adozz.hu/api/v1/config` → `paymentProvider: stripe`, `paymentMode: test` → "Kész: a szerver Stripe TESZT módban fizet."
6. Switch `-Vissza`: writes `PAYMENT_PROVIDER=demo` only (keys stay), restarts, prints OK.
7. Switch `-Eles` (only for the go-live, §29.11.3): asks the live keys with `Read-Host -AsSecureString` instead of reading HKCU, refuses unless the server already runs `APP_ENV=production` (checked remotely without printing values), creates the **live** webhook endpoint (description "Adózz API (éles)"), otherwise the same steps.

#### 29.11.2 `kezjegy_kulcsok.ps1` (updated in place; old copy to `C:/Users/UpgradePC/konyvelo_app/_regi/`)

- Section 1 **Stripe** replaces SimplePay: `PAYMENT_PROVIDER` (stripe | demo | simplepay), `STRIPE_SECRET_KEY` (secret; for the go-live the `sk_live_…` key), `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (secret) + the note "A webhook titkot a stripe_szerverre.ps1 hozza létre; éleshez: `stripe_szerverre.ps1 -Eles`". The SimplePay questions move to an optional section 1b ("csak ha SimplePay-re váltanál vissza").
- Section 6 **Számlázz.hu**: `INVOICE_MODE` (szamlazzhu | demo), `SZAMLAZZHU_ACCOUNT` (teszt | eles), `SZAMLAZZHU_AGENT_KEY` (secret) + the warning line "Az ÉLES Számla Agent kulcs első számlája elindítja a fizetős csomagot – csak élesítéskor (APP_ENV=production)."; validation refuses `INVOICE_MODE=szamlazzhu` + `eles` unless `APP_ENV=production` is set in the same run or already on the server (the remote script checks the current `APP_ENV` value without printing it).
- Section 5 gets the **NAV own technical user** (for the adószám lookup, §29.4.4): `NAV_LOOKUP_MODE` (test | prod), `NAV_LOOKUP_TAX_NUMBER` (8 digits, Somosi Kft. törzsszám), `NAV_LOOKUP_LOGIN`, `NAV_LOOKUP_PASSWORD` (secret), `NAV_LOOKUP_SIGN_KEY` (secret), `NAV_LOOKUP_EXCHANGE_KEY` (secret); all-or-nothing check.
- Section 2 e-mail stays generic SMTP (Zoho ZeptoMail: `smtp.zeptomail.eu`, 587, user `emailapikey`, the Send Mail Token as password) – no code change needed.
- Section 8 URLs → written to **`/srv/kezjegy/nyilvanos.env`** (§29.3.3), never to `.env`.
- Validation lines updated (`PAYMENT_PROVIDER`, `SZAMLAZZHU_ACCOUNT`, `NAV_LOOKUP_MODE`); the production check also counts `payments` / `subscriptions` with `provider='demo'`.

#### 29.11.3 Later live switch (documented in `deploy/README.md` "Élesítés" and in STATUS for the owner)

1. Stripe account activation (company data, bank account, identity) [TULAJ]; Dashboard: shortened descriptor `ADOZZ`, customer e-mails for successful payments **off**, Radar default rules.
2. New, empty production DB (README "Élesítés" step 1 – unchanged rule).
3. `stripe_szerverre.ps1 -Eles`: asks the live secret + publishable key with `Read-Host -AsSecureString` (never stored on the PC), creates the **live** webhook endpoint, writes the keys, `PAYMENT_PROVIDER=stripe`.
4. `kezjegy_kulcsok.ps1`: `APP_ENV=production`, `INVOICE_MODE=szamlazzhu`, `SZAMLAZZHU_ACCOUNT=eles` (the live key is already on the server), ZeptoMail token, push, NAV lookup user.
5. Számlázz.hu live account: "Rendelésszám ismétlődés tiltása" on, e-invoice on.
6. One real 19 999 Ft payment by the owner's own card + refund → storno, checked in Számlázz.hu and Stripe.

---

### 29.12 Data model and migrations (B1 writes ALL of it first; additive; pg_dump by `up.sh` first)

**`0017_k29_enumok.sql`** (separate file, `ALTER TYPE … ADD VALUE IF NOT EXISTS`, like 0014): `notification_kind` + `charge_upcoming`, `payment_action_needed`, `payment_refunded`, `payment_disputed`, `invoice_failed`, `certificate_requested`, `certificate_status`, `income_statement_checked`, `income_statement_review`, `contract_terminated`, `contract_reactivated`, `price_changed`, `profile_changed_by_admin`, `announcement`, `guided_continue`; `legal_doc_type` + `kartyas_fizetes`.

**`0018_k29.sql`:**
- New tables: `payments`, `payment_methods`, `stripe_customers`, `stripe_events` (§29.1.2); `client_price_overrides (id, client_id, kind, amount_huf null, percent smallint null, months smallint null, from_period date, until_period date null, reason text, created_by, created_at, revoked_at, revoked_by, revoke_reason)`; `admin_step_ups (session_id uuid PK, user_id, verified_at)`; `announcements (id, title, body, channels jsonb, filter jsonb, recipient_count int, created_by, created_at)`; `certificate_events (id, request_id → requests, status text, at, by uuid null, note text null)`; `income_statement_approvals (id, client_id, from_month char(7), to_month char(7), data_sha256 text, approved_by, approved_at, unique(client_id, from_month, to_month, data_sha256))`; `calendar_feeds` (§29.8).
- Altered (add columns only): `subscriptions` (+ `provider` default 'simplepay' + backfill, `payment_method_id`, `predebit_notified_for`, `suspension_warned_for`); `fee_charges` (+ `payment_id`); `fee_invoices` (+ `payment_id`, `kind text not null default 'szamla'`, `external_key text unique`, `provider_account text`, `storno_of uuid`, `attempts int default 0`, `next_retry_at`, `last_error_code`, `buyer jsonb`); `clients` (+ `guided jsonb`, `business_identity_source text` if missing, `service_lock_manual jsonb`, `terminated jsonb`, `anonymized_at`); `certificate_requests` (+ `status text not null default 'beerkezett'`, `user_name`, `purpose_kind`, `needed_by date`, `paper_copy bool default false`, `paper_to text`, `extended text`, `english_requested bool default false`, `other_text`, `fee_charge_id`, `rejected_reason`, `done_at`; legacy `certificate_type` values kept, mapped in code).
- Check constraints widened (drop + re-create in the same migration, values from the new `FEE_KINDS`): `fee_settings_kind_chk`, `fee_charges_kind_chk`.
- Indexes: `payments(client_id, created_at)`, `payments(status) where status in ('letrehozva','feldolgozas','bizonytalan','hitelesites_kell')`, the partial unique `payments_one_success_per_period`, `fee_invoices(status, next_retry_at)`, `certificate_requests(status)`.
- Grants: `db-roles.sh` gives `kezjegy_app` the usual rights on the new tables (`stripe_events`, `payments`: SELECT/INSERT/UPDATE; none needs DELETE).
- Data step `data.k29` (worker start, idempotent): fee settings confirm (§29.4.1); `subscriptions.provider` backfill check; `fee_settings` rows for the new kinds.

### 29.13 Notifications and jobs

| Kind (variant) | To | Channels | Switchable |
|---|---|---|---|
| `charge_upcoming` | client | in-app, push, e-mail | no |
| `payment_action_needed` (`hitelesites`, `elutasitva`, `lejart_kartya`, `figyelmeztetes`) | client | in-app, push, e-mail | no |
| `payment_refunded` | client | in-app, push, e-mail | no |
| `payment_disputed`, `invoice_failed` | admins | in-app, e-mail digest | – |
| `certificate_requested` | accountant | in-app, digest | – |
| `certificate_status` (`navnal`, `kesz`, `elutasitva`) | client | in-app, push (`kesz` also e-mail) | yes ("Ha valami rád vár" group) |
| `income_statement_review` / `income_statement_checked` | accountant / client | in-app (+push) | – / yes |
| `contract_terminated` (`rendes`, `azonnali`, `ugyfel_kerte`), `contract_reactivated` | client | in-app, push, e-mail | no |
| `price_changed`, `profile_changed_by_admin` | client | in-app, e-mail | no |
| `announcement` | filtered clients | as chosen | push only switchable |
| `guided_continue` | client | push, in-app | yes |
Jobs (`jobs-k29.ts`, `jobs-k29f.ts`): `predebit` 10:00 · `suspension_warning` 10:05 · `payments_reconcile` every 15 min · `invoices_issue` every minute · `price_rise_notices` 10:10 · `termination_effective` 06:10 (applies `effectiveOn`) · `calendar_feed_revoke` with it · existing `runBillingJob` 06:00 (provider dispatch) and `jobServiceLockCheck` 06:20 unchanged.

### 29.14 API (`/api/v1`; DTOs in `k29*.ts`)

| Route | Who | DTO |
|---|---|---|
| `GET /client/subscription/consent` | C | `CardConsentView` |
| `POST /client/subscription/start` | C | `SubscriptionStartInputK29` → `HostedStartResult { url, paymentId, expiresAt }` |
| `GET /client/payments/checkout/:cs` | C | `CheckoutResultView` |
| `POST /client/payments/due/pay` · `GET /client/payments/due` | C | `HostedStartResult` · `DuePaymentView \| null` |
| `POST /client/fees/:id/pay` | C | `FeePayInputK29` → `FeePayResultK29` (`sikeres` / `atiranyitas` {url}) |
| `GET /client/payments` | C | `ClientPaymentItem[]` (date, kind, amount, status, invoice) |
| `GET /payments/stripe/vissza` | public | 302 |
| `POST /webhooks/stripe` | public (signed) | 200/400/500 |
| `POST /client/onboarding/taxpayer-lookup`, `POST /client/onboarding/business-identity`, `POST /acc/clients/:id/adoszam` | C / C / A | §28.K.9 DTOs (+`cached`) |
| `GET /client/guided`, `POST /client/guided` | C | `GuidedView`, `GuidedActionInput` |
| `GET/POST /client/certificates`, `GET /client/certificates/:id`, `POST /client/certificates/:id/cancel` | C | `CertificateRequestInput`, `CertificateView` |
| `GET /acc/certificates`, `GET /acc/certificates/:id`, `POST /acc/certificates/:id/{submitted,result,reject}` | A (own) / AD | `AccCertificateRow`, `AccCertificateDetail` |
| `GET /client/income-statement?from&to` (PDF), `GET /client/income-statement/meta?from&to`, `POST /client/income-statement/review` | C | `IncomeStatementMeta` |
| `GET /acc/clients/:id/income-statement?from&to`, `POST /acc/clients/:id/income-statement/approve` | A | `AccIncomeStatementView` |
| `GET/POST/DELETE /client/calendar`, `GET /client/deadlines/:id/ics` | C | `CalendarFeedView` |
| `GET /naptar/:token.ics` | public | text/calendar |
| `POST /admin/console/step-up` | AD | `{ code }` |
| `GET /admin/console/overview`, `GET /admin/console/clients`, `GET /admin/console/clients/:id[/section]`, `GET /admin/console/clients/:id/preview` | AD | `ConsoleOverview`, `ConsoleClientRow[]`, `ConsoleClientCard*`, `ConsolePreview` |
| `PATCH/POST …/clients/:id/{profile,price,fees,fees/:cid/charge-now,lock,pause,pause/close,accountant,send-verification,send-password-reset,messages,export,terminate,reactivate,anonymize}`, `POST /admin/console/payments/:id/refund`, `POST /admin/console/announcements`, `POST /admin/console/invoices/:id/retry` | AD + step-up | §29.9.4 |
`GET /config` gains `paymentProvider`, `paymentMode` (`simplepayMode`/`simplepayEnabled` kept for old app builds; `simplepayEnabled` = `paymentProvider !== 'disabled'`).

### 29.15 Shared contract files

- **B1, `enums.ts` (in place):** `FEE_KINDS` + the 6 new kinds; `FEE_DEFAULTS` (§29.4.1); `ONE_OFF_FEE_KINDS` + `igazolas_*`, `megszuntetes`; `FEE_PURPOSE_TYPES` + `igazolas`, `megszuntetes`, `admin`; `CHANGE_KINDS`/`ASSIST_KINDS`/`CHANGE_UGYSEGED_KINDS` + `valtozas_megszuntetes` (+ `changeFeeKind` → `megszuntetes`); `NOTIFICATION_KINDS` + §29.13; `LEGAL_DOC_TYPES` + `kartyas_fizetes`; `SERVICE_LOCK_REASONS` + `kezi`; `PAUSE_SOURCES` + `admin`; `PAUSE_RULES.maxYears` = 3; `ALWAYS_ON_KINDS` + `charge_upcoming`, `payment_action_needed`, `payment_refunded`, `contract_terminated`.
- **`k29.ts` (B1):** `PAYMENT_PROVIDERS`, `PAYMENT_KINDS`, `PAYMENT_STATUSES_K29`, `PAYMENT_FAIL_TEXTS`, `CARD_CONSENT_TEXT`, `PREDEBIT_TEXTS`, `INVOICE_LINE_TEXTS`, `INVOICE_STATUSES_K29`, `STRIPE_WEBHOOK_EVENTS`, `HUF` helpers' types, DTOs of §29.1/§29.2/§29.4.
- **`k29f.ts` (B2):** `CERTIFICATE_TYPES_K29`, `CERT_PURPOSE_KINDS`, `CERT_STATUS_TEXTS`, `CERT_TYPE_TEXTS`, `INCOME_STATEMENT_TEXTS`, `CLOSING_GUIDE` texts + `CLOSING_FOLLOWUPS`, `ICAL_LABELS`, `TERMINATION_KINDS` + `TERMINATION_TEXTS`, console DTOs and action inputs.
- **`k29g.ts` (B3):** `GUIDED_ORDER`, `GUIDED_TEXTS`, `GuidedView`, `GuidedActionInput`.
- Content keys: every text above is also a `content_texts` default (`k29.*`, `k29f.*`, `k29g.*`) editable at `/admin/szovegek`, generated by `content/k29.ts` like `content/k28.ts`.

### 29.16 Legal texts (B3; drafts "TERVEZET – jogász ellenőrzi")

- New `jogi/kartyas_fizetes.md` (the consent of §29.1.3 + Stripe as processor) – the app shows it; `simplepay_adattovabbitas.md` / `simplepay_ismetlodo.md` stay for `PAYMENT_PROVIDER=simplepay`.
- ÁSZF: 6.1 "…bruttó összeg, amely 27% ÁFA-t tartalmaz"; 6.3 Stripe (Stripe Payments Europe, Ltd.) instead of SimplePay, no token count/limit wording (7.2 rewritten: "A kártyás engedély a lemondásig vagy a kártya törléséig él. Minden levonás előtt 3 nappal szólunk."); 6.4 e-invoice from Számlázz.hu (consent to e-invoice); 6.5 unchanged schedule + "a bankod megerősítést kérhet: ilyenkor az appban fizeted ki"; 8.5 unchanged grounds, + the settlement sentence; no-trial edits of §29.4.2; one-off fees with the saved card after approval (§29.1.7).
- Adatkezelés: Stripe and KBOSS.hu Kft. (Számlázz.hu) as processors; the 24 h lookup memory cache; the calendar feed (secret link, labels only); anonymisation vs. retention periods (§29.9.6).
- `requiresReconsent`: [JOGI] decides; the card consent is collected fresh anyway at the next card step.

### 29.17 Demo data `seed:k29` (local harness + live demo DB; idempotent; refuses `APP_ENV=production`; never touches `alex@`, `tulaj@`, `bence.kovacs@`, `david@`; fake data only)

- Three new fictional clients (`…@demo.kezjegy.test`): "Halmi Zsófia" (demo card, one refunded month with a DEMO storno), "Kerekes Anna" (`hitelesites_kell` payment, "Fizesd ki" open), "Fodor Márk" (terminated `rendes`, effective in 20 days); certificate requests in every status for the existing demo clients (Szabó Kata: jövedelemigazolás `kesz` with a DEMO PDF marked "DEMO – nem NAV-irat"; Varga Réka: adóigazolás `navnal`); one income statement approval; one calendar feed; one price override (Németh Péter: 1 free month); console overview numbers non-trivial. Passwords only appended to `/srv/kezjegy/demo_belepesek.txt`, never printed.

### 29.18 Tests and acceptance

**Backend (vitest on PGlite + mocks; B1/B2):**
- HUF: `hufToStripe(19999) = 1999900`, rejects 0.5 / negatives; `grossToLine` for the five prices.
- Stripe provider (mocked HTTP): first payment session params (setup_future_usage, suffix, metadata without personal data, idempotency key); off-session charge for each outcome (`succeeded`, `processing`, `authentication_required`, `card_declined`+`insufficient_funds`, `expired_card`, network error → `bizonytalan` → same key retried); **no second success for a period** (unique index → `duplikalt` → refund call); at most one attempt per day; demo subscriptions keep the demo provider after `PAYMENT_PROVIDER=stripe`; free month → no call; pause fee amount; price override.
- Webhooks: bad signature 400 + no audit flood; replay of the same event → processed once; out-of-order (`payment_intent.succeeded` before `checkout.session.completed`) → one success; livemode mismatch ignored; handler error → 500 then success on retry; `charge.refunded` from the Dashboard → storno queued.
- Pre-debit on day −3 only, once; suspension warning at grace − 5; lock lifts on success; terminated client never reactivated by a payment.
- Számlázz.hu (mocked multipart): XML order vs the XSDs; headers parsing; 71/152 → query; timeout → query-first retry; storno/correction; mode mismatch refused; `ConfigError` for a live account on demo.
- Config: live key on demo refused; test key in production refused; nyilvanos.env override order (compose test in `deploy/`).
- Taxpayer lookup: 8 s timeout → `unavailable`; cache hit within 24 h (no second NAV call, not rate-limited), not after; nothing in the DB.
- F1: every type's required fields; current-year jövedelem refused with the text; fee > 0 → `dijra_var`; status timeline; lock rule. F2: monthly totals = Σ `revenue_items` by `received_on` for 3 fixtures (átalány, KATA, a mixed year); stamp only with the same hash. F3: follow-up → subscription ends at period end. F4: feed has no amount/name/adószám (regex), rotate invalidates, revoked 404, UID stable. F9: non-admin 404 on every console route (accountant, csapat, client tokens); no step-up → 403; every write audited with reason/before/after; terminate kinds and the 30-day rule; anonymise keeps fee invoices/payments/audit, changes no row by DELETE (spy on the query builder); overview numbers = SQL counts.
- G: `GuidedView` per variant (order, `currentKey` skips waiting steps, progress counts), `later`/`resume`, active client `show:false`.

**Live Stripe TEST + Számlázz.hu Tesztüzem (integrator, from this PC, keys in-process only, ids recorded, never keys):** 4242 save + first month → webhook → Tesztüzem invoice → PDF in the app; off-session renewal (clock moved in the local harness); 4000 0025 0000 3155 (3DS at save, off-session OK); 4000 0027 6000 3184 → `authentication_required` → "Fizesd ki" → paid; 4000 0000 0000 0341 → retries → suspended → lock → Fizesd ki → unlock; 4000 0000 0000 9995 insufficient funds; refund full → storno, partial → correction; one invoice per real price (rounding check).

**App/panel (B2/B3):** screenshots 390×844 and 320×640 (`kod/_qa/k7_*.png`, `k7f_*.png`), panel 1440/1280, LOOKED at; separator everywhere; no "DEMO" chip on real prices; no trial wording (grep); the guided journey of §29.10.5; the console flows as admin; the client sees the result of each console action.

**Server (integrator):** §29.3.5 checks; every host answers HTTPS with the right app; CORS/origin check from both host sets (POST `/auth/refresh` with each Origin); the APK's sslip API works; hourly backups still run (`backup.log` new line after the switch); DB counts and the four protected accounts intact; no secret in the repo, logs, `nyilvanos.env`.

### 29.19 Waits (additions to §23 / §28.13 / §28.K.23)

| # | Who | What |
|---|---|---|
| 1 | TULAJ | Run `stripe_szerverre.ps1` (after the domain switch) – the server then takes Stripe TEST payments |
| 2 | TULAJ | Stripe Dashboard: shortened descriptor `ADOZZ`; customer e-mails for successful payments OFF; later account activation for live keys |
| 3 | TULAJ | Számlázz.hu (both accounts): "Rendelésszám ismétlődés tiltása" ON, e-invoice ON, e-mail text; live switch only at the go-live |
| 4 | TULAJ | Support e-mail (Ekertv. needs one on adozz.hu before real customers); ZeptoMail token |
| 5 | TULAJ | Confirm `NEW_BUSINESS_CHARGE_POLICY=azonnal` (new businesses pay from the contract, no free period) |
| 6 | TULAJ | Confirm the guided order deviations (contract before meghatalmazás; azonosítás before the card) |
| 7 | JOGI | Card consent text, one-off fees with the saved card (incl. admin "Levonom" for client-ordered fees), ÁSZF 6.1/6.3/6.4/7.2/8.5 edits, termination letter, `rendes` termination without charging the notice days, anonymisation vs. retention, e-invoice consent |
| 8 | KÖNYVELŐ | Invoice: `teljesitesDatum` of a prepaid monthly fee; buyer address (székhely vs lakcím); gross-price rounding (§29.2.2); corrective invoice form for partial refunds |
| 9 | KÖNYVELŐ | F1: fee of the EV hatósági bizonyítvány; the IGAZOL fields we pre-fill; the meghatalmazott channel in ONYA |
| 10 | KÖNYVELŐ | F3: HIPA soron kívüli deadline after closing; ÁFA closing duties; post-closing revenue wording; whether he may file the megszüntetés online as meghatalmazott; the 2027 chamber channel |
| 11 | KÖNYVELŐ | `PAUSE_RULES.maxYears` 3 (NAV page) – confirm the reminders (60/30 days before 3 years) |
| 12 | TULAJ | New APK with `api.adozz.hu` (not now) |

### 29.20 Sources (official; read 2026-11-20)

- **[STR-CO]** Stripe API – Create a Checkout Session (`mode`, `payment_intent_data.setup_future_usage`, `customer`, `currency` required in setup mode without allowed types, `expires_at` 30 min–24 h, `locale` `hu`, `origin_context`, `custom_text`): https://docs.stripe.com/api/checkout/sessions/create
- **[STR-PI]** Stripe API – PaymentIntent object/create (`off_session`, `setup_future_usage`): https://docs.stripe.com/api/payment_intents/object ; migration note on the Off-Session Payments API: https://docs.stripe.com/payments/off-session-payments/migrate-from-payment-intents
- **[STR-CUR]** Stripe – Supported currencies (HUF two-decimal for charges, zero-decimal for payouts): https://docs.stripe.com/currencies
- **[SZ-ISSUE]** Számlázz.hu docs – Számla generálás, kérés + Minta XML/XSD (`action-xmlagentxmlfile`, `xmlszamla`, element order, `szamlaKulsoAzon`, `rendelesSzam`, `fizetve`, `sendEmail`): https://docs.szamlazz.hu/hu/agent/generating_invoice/request , https://docs.szamlazz.hu/hu/agent/generating_invoice/xml
- **[SZ-RESP]** Válasz (headers `szlahu_*`, PDF body, `[ERR]`): https://docs.szamlazz.hu/hu/agent/generating_invoice/response
- **[SZ-ORDER]** Rendelésszám és duplikáció-ellenőrzés ("Rendelésszám ismétlődés tiltása", 2-day identical-retry rule, codes 71/152): https://docs.szamlazz.hu/agent/generating_invoice/settings_and_rules/order-number
- **[SZ-QUERY]** Számla XML lekérdezése (`action-szamla_agent_xml`, `xmlszamlaxml`, by `szamlaszam` / `rendelesSzam` / `szamlaKulsoAzon`, `pdf`): https://docs.szamlazz.hu/agent/querying_xml/request , https://docs.szamlazz.hu/agent/querying_xml/xml
- **[SZ-ST]** Sztornó (`action-szamla_agent_st`, `xmlszamlast`): https://docs.szamlazz.hu/agent/reversing_invoice/request , https://docs.szamlazz.hu/agent/reversing_invoice/xml
- **[NAV-IGAZ]** NAV 22.1. információs füzet "Adóhatósági igazolások" (közzétéve 2026-10-02): https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fnezzen-utana%2Finf_fuz%2F2026%2F22.1.-Adohatosagi-igazolasok-2026-10-02 (Adóig. vhr. 465/2017. (XII. 28.) Korm. r. 1. § (4), 24. §; Air. 50. § (2); Art. 260. § (1))
- **[NAV-KOMA]** NAV – A Köztartozásmentes Adózói Adatbázis (KOMA): https://nav.gov.hu/Elethelyzetek-adozasa/ugyintezeshez/A-Koztartozasmentes-Adozoi-Adatbazis-KOMA ; lekérdezés: https://nav.gov.hu/adatbazisok/koztartozasmentes/egyszeru_lekerdezes
- **[NAV-EV]** NAV – Egyéni vállalkozók nyilvántartása, GYIK (hatósági bizonyítvány 8 napon belül, nyilvános lekérdezés): https://nav.gov.hu/Elethelyzetek-adozasa/vallalkozas/egyeni-vallalkozok-nyilvantartasa/gyakran-ismetelt-kerdesek
- **[NAV-MEGSZ]** NAV – Az egyéni vállalkozás megszüntetése (Vállalkozói Ügysegéd / ügyfélszolgálat / Infóvonal, nem postán; legkorábban a bejelentést követő nap; nem módosítható; díj- és illetékmentes): https://nav.gov.hu/Elethelyzetek-adozasa/vallalkozas/egyeni-vallalkozok-nyilvantartasa/az-egyeni-vallalkozas-megszuntetese
- **[NAV-SZ]** NAV – Az egyéni vállalkozás szüneteltetése (min. 1 hónap, max. 3 év; 2021-07-01 előtt 2 év): https://nav.gov.hu/Elethelyzetek-adozasa/vallalkozas/egyeni-vallalkozok-nyilvantartasa/az-egyeni-vallalkozas-szuneteltetese ; Evectv. (2009. évi CXV. tv.): https://njt.hu/jogszabaly/2009-115-00-00
- **[NAV-UGY]** A NAV ÜPO Vállalkozói Ügysegédjének útmutatója (2026-03-19): https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fvallalkozoknak%2Findulo-vallalkozas%2Fkapcsolodo-tartalmak%2Fa-vallalkozoi-ugyseged-utmutatoja
- **[IPA]** Htv. (1990. évi C. tv.) – HIPA bevallás megszűnéskor [KÖNYVELŐ confirms the deadline]: https://njt.hu/jogszabaly/1990-100-00-00 ; Art. (2017. évi CL. tv.) 202. § (elévülés), 260. § (KOMA): https://njt.hu/jogszabaly/2017-150-00-00
- **[KATA]** `_munka/k6/kata_2026.md` (k6 research, official sources cited there).
- Számv. tv. (2000. évi C. tv.) 169. § (8 év): https://njt.hu/jogszabaly/2000-100-00-00 ; Pmt. (2017. évi LIII. tv.) 57. §: https://njt.hu/jogszabaly/2017-53-00-00
