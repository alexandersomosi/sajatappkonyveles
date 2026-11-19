# Kézjegy backend (`kod/backend`)

Hono API + background worker + Drizzle/Postgres schema + demo seed for the Kézjegy service.
Contract: `kod/SPEC.md` (§4 security, §5 data model, §9 SimplePay, §12 REST API, §13 env, §15 jobs,
§19 seed). Product name comes only from `kod/shared/brand.json`.

The app **never files anything to NAV**: the NAV client is read-only (`@kezjegy/nav-kliens`).

## Run

```bash
npm ci                 # Node 22+ (works on 23/24); .npmrc has legacy-peer-deps
npm test               # vitest on PGlite: 205 tests (auth, roles, uploads, KYC, tax flow, SimplePay DEMO + sandbox, NAV sync, GDPR, seed,
                       #   SPEC §26: new business, callbacks, restricted mode, csapat permissions, demo addition)
npm run typecheck
npm run build          # → dist/ (ESM). prebuild copies kod/shared into src/_shared
npm run smoke          # runs the COMPILED dist on PGlite: health, config, full demo seed, jobs
```

Local packages (built first): `../ado-motor` and `../nav-kliens` (`npm ci && npm run build` in each).

Production processes (same image, see `Dockerfile`, build context = `kod/`):

```bash
docker build -f backend/Dockerfile -t kezjegy-api kod/
node dist/index.js     # API on :8080 – applies the SQL migrations in drizzle/ on start
node dist/worker.js    # jobs (waits until the API's migrations are in place)
node dist/seed/index.js [--force-demo]   # demo data (refuses APP_ENV=production without the flag)
node dist/seed/tulaj1118.js              # SPEC §26.13 idempotent demo ADDITION on a live DB (never a reseed;
                                         # deploy: bash /srv/kezjegy/deploy/seed-tulaj1118.sh)
```

Health: `GET /api/v1/health` → `{ ok, version, db }` (anonymous callers get nothing more since 2026-11-19; the
integration modes are on `GET /admin/system` and, for the app, in `GET /config`).

## Environment (`/srv/kezjegy/.env`)

Required (process exits with a clear Hungarian message if missing): `DATABASE_URL`, `JWT_SECRET`,
`CODE_HMAC_SECRET`, `FILE_LINK_SECRET`, `AUDIT_IP_SALT` (≥16 chars, random 32 B base64 recommended),
`FILE_ENC_KEY`, `APP_DATA_KEY`, `NAV_CRED_KEY` (exactly 32 bytes, base64 or 64 hex; three different keys),
and `SIMPLEPAY_DEMO_SECRET` while SimplePay runs in DEMO.

| Var | Default | Notes |
|---|---|---|
| `APP_ENV` | `demo` | `production` turns every keyless integration into "not configured" (503), never fake success |
| `PORT` | 8080 | |
| `APP_PUBLIC_URL`, `PANEL_PUBLIC_URL`, `API_PUBLIC_URL` | sslip.io hosts | links in e-mails, SimplePay back URL, demo pay page |
| `FILE_ENC_KEY_ID` | 1 | key id written into every blob |
| `FILES_DIR`, `LEGAL_DIR`, `FONT_DIR` | `/data/files`, `/app/legal`, `/app/fonts` | |
| `STAFF_TOTP_REQUIRED` | true | staff get `403 totp_setup_required` until 2FA is on; set `false` only on a DEMO host |
| `SMTP_HOST`, `SMTP_PORT`(587), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_REPLY_TO` | empty → DEMO outbox | Brevo: `smtp-relay.brevo.com` |
| `GOOGLE_CLIENT_IDS` | empty → hidden | comma list in order web, android, ios |
| `APPLE_BUNDLE_ID` | empty → hidden | |
| `SIMPLEPAY_MODE` | `demo` | `sandbox`/`live` need `SIMPLEPAY_MERCHANT_HUF` + `SIMPLEPAY_SECRET_HUF` |
| `SIMPLEPAY_RECURRING_TIMES`, `SIMPLEPAY_TOKEN_VALID_MONTHS` | 12, 12 | |
| `PLAN_PRICE_HUF` | 20000 | |
| `INVOICE_MODE` | `demo` | `szamlazzhu`/`billingo` providers are not implemented yet → fee invoice row `hiba` + admin alert |
| `NAV_MODE` | `demo` | `test`/`prod` use the real XML client; prod refuses the placeholder `NAV_SOFTWARE_ID` |
| `NAV_SOFTWARE_ID`, `NAV_SOFTWARE_VERSION`, `NAV_DEV_NAME`, `NAV_DEV_CONTACT`, `NAV_DEV_TAX_NUMBER`, `NAV_SYNC_HOUR` (5) | | |
| `PUSH_MODE` | `demo` | `expo` sends via exp.host; `EXPO_ACCESS_TOKEN` optional |
| `LOG_LEVEL` | info | pino JSON, central redaction (`src/log.ts`) |
| `SEED_CREDENTIALS_FILE` | `/run/seed/demo_belepesek.txt` | seed passwords, mode 600, never printed |
| `TRUST_PROXY_HOPS` | 1 | client IP = last `X-Forwarded-For` entry (Caddy sets it) |
| `APP_VERSION`, `SKIP_MIGRATIONS` | | optional |
| `NEW_BUSINESS_CHARGE_POLICY` | `adoszam_utan` | SPEC §26.1.7 [OWNER]: `azonnal` opens the subscription step right away on the new-business path |
| `CALLBACK_DUE_HOURS` | 48 | callback deadline (calendar hours; amber after 24 h) |
| `CALLBACK_CALLER_ID` | empty → hidden | "Erről a számról hívunk: …" [OWNER] |

## Layout

```
src/index.ts, worker.ts, app.ts, deps.ts, config.ts, log.ts, jobs.ts
src/db/schema.ts            Drizzle schema (SPEC §5); SQL migrations in drizzle/ (0001 = audit trigger)
src/auth/                   JWT + rotating refresh tokens, e-mail codes, Google/Apple ID tokens, middleware
src/routes/                 public (health, config, legal, IPN, back URL, DEMO pay page), auth, me, client, acc, admin, files,
                            client-bekotes (§26 client: branch question, registration, guides, explainers, access, callbacks),
                            team (§26 /team: callbacks queue, registration pipeline, onboarding threads)
src/services/               tax, documents, onboarding, requests, flags+deadlines, navsync, subscription, gdpr, contracts, seed helpers,
                            §26: access (restricted mode), registration, guides, callbacks, team, datastep (one-time data step)
src/content/tulaj1118.ts    §26.8 content defaults generated from kod/shared (explainers, locks, callback texts)
src/payments/simplepay.ts   SimplePay v2.1 protocol client (HMAC-SHA384 signatures)
src/notify/                 in-app notifications, SMTP mailer (DEMO outbox), Expo push
src/files/                  encrypted file store (AES-256-GCM, AAD = file id), upload checks, photo→PDF merge
src/tax/engine.ts           → @kezjegy/ado-motor        src/nav/*  → @kezjegy/nav-kliens
src/adapters/               SPEC §3.2 fallbacks of both packages (same contracts; not wired any more)
src/seed/                   demo data (SPEC §19)
```

## Security notes

- Passwords argon2id (19 MiB, t=2, p=1); access JWT 10 min; refresh tokens SHA-256 hashed, rotated,
  reuse revokes the family; web refresh only with the `kj_rt` cookie + `X-Kezjegy: 1`.
- Every route group checks the role; accountant routes check the assignment (404, no enumeration);
  admins never see documents, messages, KYC or NAV data.
- Files: `KJF1` blobs, AES-256-GCM, AAD = file id, key from env only. DB fields `KJD1` with
  `APP_DATA_KEY`; NAV credentials with the separate `NAV_CRED_KEY`, write-only via the API.
- Audit log is append-only (DB trigger); IPs only as HMAC; no bodies/codes/tokens in details or logs.
- Uploads: magic-byte check (JPEG/PNG/PDF; HEIC refused), 25 MB/file, 60 MB/request, GPS EXIF removed.
- Rate limits (in-memory): login 10/15 min per IP+e-mail; 10 failures within an hour lock the account for
  15 min, and a locked account answers exactly like a wrong password (401, no existence oracle; the password
  reset clears the lock). Register/forgot 5/h per IP and 3/h per e-mail, uploads 600/h (429 says how many
  minutes, `retryAfter` in the error body), photo→PDF merges one per user and 2 at a time, everything else
  600/5 min per user.
- Refresh tokens: a rotated token still works for 60 s (lost response, two tabs) and gets a sibling session;
  later reuse revokes the family. Turning 2FA on needs a sign-in within 10 min or the current password, ends
  the other sessions and e-mails the owner (also on 2FA off and after a password reset).
- Admin: sign-in mails of other staff are hidden in the DEMO outbox (by template, not wording) and the
  `email.auth_*` code templates are not editable. A reassigned client gets a message + push, both accountants
  an e-mail; with `STAFF_TOTP_REQUIRED` an accountant without 2FA gets no clients.
- Migrations: `node dist/db/migrate-cli.js` (deploy: the one-shot `kezjegy-migrate` service with the owner
  URL); the API and worker run with `SKIP_MIGRATIONS=1` as the least-privilege role.

## Backup age in the admin panel

`GET /admin/system` reports `backupAgeHours` from `system_state['backup.last']`. The nightly backup
script should end with:

```bash
docker exec kezjegy-db psql -U kezjegy -d kezjegy -c "insert into system_state(key, value) values ('backup.last', jsonb_build_object('at', now())) on conflict (key) do update set value = excluded.value, updated_at = now()"
```

## Demo logins

After `seed`: `ssh appok-1 'cat /srv/kezjegy/demo_belepesek.txt'` (admin, Kovács Bence, Szabó Kata,
Varga Réka, Németh Péter – all fictional, e-mail domain `demo.kezjegy.test`). DEMO payment: the
"Kártyás fizetés" button opens `/api/v1/payments/demo/pay` with "Sikeres / Sikertelen fizetés
szimulálása"; an e-mail starting with `fail+` makes monthly charges fail (retry/suspension demo).
NAV demo: any well-formed technical user works; logins starting with `hibas`, `rosszkulcs`,
`nincsjog`, `karbantart`, `nemvalid` simulate NAV errors.

## SPEC §26 (owner orders 2026-11-18) – what the backend does

- **Migrations** `0008_tulaj1118_enumok` (only `ALTER TYPE … ADD VALUE IF NOT EXISTS`) and `0009_tulaj1118` (new tables
  `team_members`, `business_registrations`, `callback_requests`, `callback_attempts`; `clients.business_status`,
  `messages.read_by_team_at`). Additive only; nothing renamed or dropped. The new tables get the app-role grants through
  the existing `ALTER DEFAULT PRIVILEGES` of `deploy/db-roles.sh`.
- **One-time data step** at worker start (`src/services/datastep.ts`, marker `system_state['data.tulaj1118']`):
  `business_status='van'` for clients with an adószám, booked legacy appointments → callbacks (unique
  `legacy_appointment_id`), the 4 new FAQ items when missing. Re-running is a no-op.
- **Restricted mode** (`src/services/access.ts`): one middleware on `/client/*` + handler checks; 403
  `{ error: { code: 'locked_until_active', message, feature } }`. `GET /client/access` = `Me.access`.
- **Role `csapat`**: `/team/*` only (callbacks, registrations, threads of clients in `bekotes_alatt`); every other route
  group answers 404. Permission tests: `test/tulaj1118-csapat.test.ts`.
- **Appointments retired**: writes answer 410 `megszunt_funkcio`, old rows stay readable, no `apt:` deadlines, the
  hourly reminder is a no-op.
- **Jobs**: `every5` runs the callback SLA first; `staff_digest` 08:00; `registration_reminders` 10:00.

## Round 1 of 2026-11-19 – what changed in the backend (tests: `test/kor1119.test.ts`, `test/meres-export-memoria.test.ts`)

- **Migration `0010_kor1_1119`** (additive): `simplepay_transactions.payment_url_enc`, `gdpr_exports.attempts/started_at/error`,
  `email_codes.ip_hmac/foreign_attempts`. One-time data step `data.kor1_1119` at worker start (`services/datastep.ts`
  `runDataFixKor1`): notification links `/dosszie/<hónap>` → `/dosszie?honap=<hónap>`, missing `signup_attribution` rows,
  three demo texts and one FAQ answer (only rows that still hold the old text).
- **Sign-in.** No account-wide lock from one address: the 15-minute lock needs wrong passwords from ≥ 3 addresses and
  never applies to an address that signed in to the account in the last 90 days. E-mail codes remember the asking
  address (`ip_hmac`): only that address uses the code's 5 attempts / 20 per day; others have 3 per code / 10 per day
  and cannot invalidate the owner's code. `forgot` is limited per e-mail **and** address (3/h) + 12/h per e-mail. The
  reset answers the same for a wrong code and for no code; with SMTP the mail goes out after the response. Rate-limit
  keys use the /64 of an IPv6 address. Register still answers 409 for an existing address ([OWNER] decision).
- **Accountant's adóazonosító jel** reaches a client only after e-mail confirmation + megbízási szerződés (or once the
  meghatalmazás is submitted); audited once per client per day. The meghatalmazás step is locked until the contract
  (`bekotes.zarolt.szerzodes_utan`); while the branch question is unanswered the subscription step is locked
  (`bekotes.zarolt.elagazas`, 409 `step_locked` on `/client/subscription/start`).
- **Existing business:** an adószám whose ÁFA-kód is not 1 is refused on `PUT /client/profile` (400, `fields.adoszam`,
  top-level `stop: "nem_afamentes"`); `evSince` ≥ 1990-01-01; KYC birth date: past, ≥ 18 years.
- **Accountant step endpoint** (`POST /acc/clients/:id/onboarding/:step`): fiok/adatok/szerzodes/elofizetes/azonositas
  are never settable; meghatalmazas `kesz` only after the client's submission (`konyvelore_var`) or with
  `{ override: true, note }` (audited `onboarding.step_override`); nav_bekotes `kesz` only with a tested connection.
  Requests cannot be due in the past. `pickAccountant` skips accountants who never signed in.
- **Subscription.** `chargeSubscription` re-reads the row and charges only what is due (`chargeDue`); admin retry
  answers 409 otherwise; `GET /admin/subscriptions` items carry `retryable`. A second `/client/subscription/start`
  within 25 minutes returns the same payment page instead of 409. Admin cancellation: notification variant `admin`.
- **GDPR export** is streamed (ZIP written entry by entry to `<FILES_DIR>/_tmp`, encrypted as a stream, downloaded as a
  stream; measured +25 MB RSS for 120 MB of files), claimed with an attempt counter (`folyamatban`, max 2 → `hiba`).
  `POST /me/export` needs a sign-in ≤ 10 min old or `{ password }` / `{ totpCode }` and mails the owner.
  Signed file links are bound to the session family (dead after logout). `/me/notifications` needs staff 2FA when 2FA
  is mandatory.
- **Uploads:** at most 2 upload requests at once on the server and one per caller (others wait up to 45 s, then 429);
  the one-file routes (`*/attachments`) take 26 MB.
- **Tax.** Home hero keeps the quarter that just closed until it is approved (max 14 days after its deadline, also
  across the new year; texts `ui.hero.veglegesites_note`, `ui.home.letter_veglegesites`). A verified payment cannot be
  re-marked or un-verified by the client (`paymentStatusOf`). Overdue approval → `notif.tax_approved.overdue.*`;
  HIPA payment texts name the önkormányzat. A jogállás change in a year with an approved quarter leaves a pinned
  internal note. The alanyi ÁFA limit is time-proportional in the starting year (engine + registration hints).
- **Mails:** `email.contract_accepted.*` (PDF attached; in DEMO the outbox names the attachment),
  `email.account_deletion_requested.*`, `email.export_requested.*`, `email.auth_staff_invite_csapat.*`. In DEMO the
  admin who invites a colleague gets `demoInviteCode` once in the create response; the Demo-postafiók hides sign-in
  mails of the csapat role too.
