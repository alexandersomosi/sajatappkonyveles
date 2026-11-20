# Kézjegy – rendszerterv (SPEC.md)

Single source of truth for the overnight build of 2026-11-17/18. Every builder (backend, ado-motor, nav-kliens, app, panel, jogi, deploy) follows this file. Where this file and a builder's own idea disagree, this file wins; if this file is wrong, append a dated note in **§24 Builder notes** (never rewrite other sections) and code against the note.

Working name **"Kézjegy"** is NOT final. It lives in exactly one place: `kod/shared/brand.json` → `name`. Nothing else may hard-code it (see §3.4).

Markers used below:
- **[OWNER]** waits for the owner (account, key, decision). Build it, make it switchable, show a clear DEMO/"nincs beállítva" state.
- **[JOGI]** a lawyer must confirm. Build the default described here.
- **[KÖNYVELŐ]** the real accountant must confirm a professional default.
- **[DEMO]** behaviour when an integration has no keys (§13).
- **[NEM MA]** explicitly out of scope tonight.

**2026-11-18 owner orders: §26 overrides every older section where they differ** (optional appointment booking is retired and replaced by the callback request; new-business self-service path; restricted mode before activation; role `csapat`).

**2026-11-19 owner orders: §27 overrides §26 and every older section where they differ** (real NAV screenshots with honest labels; the branch answer can be changed; "Intézzük helyetted" – on request, after a callback, our accountant files the meghatalmazás and the EV bejelentés as the client's registered meghatalmazott, never with the client's login; one journey list with one current action; "anyukád"; one wording for issued invoices).

**2026-11-19 owner orders (12:25 "Ez mind az 5 kell" and the afternoon/evening additions): §28 overrides §27 and every older section where they differ, and §28.K overrides §28** (§28: "Ennyit tegyél félre", new-invoice notification, 2026 personal allowances, "Mennyit kerestem?", change guides; §28.K: monthly check-in, annual closing fee + questionnaire, reminders, unpaid-fee lock, suspension fee, employees/EFO, public tax calculator, auto-fill by adószám, the clarity pass in the approved C look (8 px separator band between sections), KATA clients, Accountable patterns, real new-business screens, k5 leftovers, no response-time promise, **monthly fee 19 999 Ft** and the change fees).

Demo "today" for all expected numbers in this file: **2026-11-17** (`kod/shared/demo/fixtures.json` → `today`).

---

## Contents

1. Product and roles
2. Non-negotiable owner decisions
3. Architecture, folders, tech stack, conventions
4. Security and privacy
5. Data model (Postgres 17 / Drizzle)
6. State machines
7. Tax engine (`ado-motor`) – 2026 rules, algorithm, contract, worked examples
8. NAV Online Számla client (`nav-kliens`)
9. SimplePay recurring subscription
10. Authorisation to NAV (meghatalmazás), AVDH status, KYC (Pmt.)
11. Other integrations: e-mail, push, Google, Apple, fee invoices
12. REST API
13. Environment variables and DEMO behaviour
14. Files and storage layout
15. Background jobs
16. Notifications catalogue
17. Client app screens (Expo) ↔ FUNKCIOK.md
18. Accountant + admin panel screens ↔ FUNKCIOK.md
19. Demo seed data
20. Deployment on appok-1
21. Legal texts (`kod/jogi`) contract
22. Tests and done-criteria per package
23. Waits for the owner / lawyer / accountant
24. Builder notes (append-only)
25. Sources (+ "25. Review round 1 fixes")
26. Tulaj-kérések 11-18: new business (self-service), callback instead of booking, bottom bar + restricted mode, explainers, videos, annotated NAV screenshots, team role `csapat`
27. Tulaj-kérések 11-19: real screenshots, changeable branch, "Intézzük helyetted" (assisted path), one transparent journey, "anyukád", issued-invoice wording, round-2 findings → builders
28. Öt új funkció 11-19 (félretenni, new-invoice notification, allowances, "Mennyit kerestem?", change guides) + **28.K Kiegészítés** (check-in, annual closing, reminders, lock, suspension fee, EFO, calculator, adószám auto-fill, clarity pass (C look + 8 px separator band), KATA, Accountable patterns, real NAV screens, k5 leftovers, no response-time promise, prices 19 999 Ft and fees)

---

## 1. Product and roles

A Hungarian subscription service: an **alanyi ÁFA-mentes, átalányadós egyéni vállalkozó** (sole trader) gets a named human accountant for **19 999 Ft gross / month** (§28.K.1; was 20 000). The contract is with the owner's company (**Somosi Kft.**); the accountant is a subcontractor of the Kft. and the client's NAV **állandó meghatalmazott**. The accountant calculates, approves and files; **the app never files anything to NAV.** It reads the client's issued invoices from NAV Online Számla (read-only, with a technical user), shows what to pay, collects documents, and keeps a shared monthly dossier.

| Role | Who | Where | Sees |
|---|---|---|---|
| `client` | the sole trader (e.g. Szabó Kata) | mobile app (Android/iOS) + same app as web (`app.` host) | only own data |
| `accountant` | e.g. Kovács Bence | web panel (`konyvelo.` host) | only clients assigned to him |
| `admin` | owner (Somosi Kft.) | same panel, admin section | business data (clients list, subscriptions, payments, workload, texts, audit). **Not** documents, messages, KYC or NAV data of clients (least privilege; §4.6). |

Scope = `C:/Users/UpgradePC/konyvelo_app/FUNKCIOK.md` points 1–35. "Később" items are [NEM MA].

---

## 2. Non-negotiable owner decisions

1. Login: e-mail + password (reset by **e-mail code**), Google sign-in, Apple sign-in **on iOS only**, biometric unlock (client-side), optional TOTP 2FA.
2. Payment: **SimplePay recurring card payment**, 19 999 Ft/month, in the browser outside the app stores (real-world human service – Apple App Review Guideline 3.1.3(e), Google Play payments policy exemption for services consumed outside the app; §25).
3. **No video call by default.** Identification = upload of ID card + address card photos + declarations. An **optional** appointment / phone-call booking exists, switched **off** by default per accountant (`accountants.appointments_enabled = false`).
4. The accountant files to NAV himself. The app never calls any NAV write operation (`manageInvoice`, `manageAnnulment`, `tokenExchange` are forbidden in code).
5. Design = **Kézjegy C2** (`dizajn/C2_modern/app_v2/` PNG + HTML + `tokens.css` + `TERV.md`). Typeface **Geist** only. Brand-blue header band (`#1428DB`, owner decision 2026-11-18 17:50; final tokens and contrast ratios: `dizajn/PALETTA.md`, overrides the colours of `tokens.css`) with the big number, tinted ground `#E4E8F3` with white sheets, the accountant's short monthly letter with handwritten signature.
6. **No thin vector/line icons anywhere** (app AND panel; no lucide/heroicons/material icons/icon fonts). Every pictorial icon is one of the 16 realistic 3D PNGs in `dizajn/C2_modern/assets/ikon3d/` (§17.2). **No pastel circles behind quick actions** (the TERV round-4 coloured circles are overruled). Pure typographic glyphs set in Geist text (‹ › × ✓ →) are allowed for back/close/chevron/check-in-text.
7. The accountant is shown as the drawn character `assets/avatar/karakter_1_lapos@2x.png/@3x.png` (never a generated photo).
8. Empty states / onboarding visuals: `assets/illusztraciok/*` (front-view realistic objects). Header texture: the guilloche rosette as in the approved PNGs (`app_v2/guilloche_rozetta.svg`), paper texture for the letter `assets/textura/papirszal_halk_csempe.png`; `assets/textura/guilloche_halk_csempe.png` is the allowed alternative for wide panel headers.
9. Every external integration is real code against official docs, switchable by env, with a clearly labelled DEMO mode when keys are missing. **Never fake success silently in production mode** (§13.1).
10. Only fake demo data. Never delete files (move to `_regi/`). Never print or commit secrets.

---

## 3. Architecture, folders, tech stack, conventions

### 3.1 Picture

```
 Phone app (Expo, Android/iOS) ──HTTPS──► api.45-94-65-74.sslip.io/api/v1 ─┐
 Web app  (Expo web export)   ──HTTPS──► app.45-94-65-74.sslip.io           │   appok-caddy-1 (shared Caddy,
          (static + same-origin /api/v1)                                     ├─► TLS, routes by host)
 Panel    (React+Vite static) ──HTTPS──► konyvelo.45-94-65-74.sslip.io      │
          (static + same-origin /api/v1)                                     ┘
                                              │ docker network kezjegy_edge
                    ┌─────────────────────────┼──────────────────────────────┐
                    ▼                         ▼                              ▼
              kezjegy-web (caddy,      kezjegy-api (Node, Hono)       kezjegy-worker (same image,
              static app:8080,         :8080, REST, IPN, files        jobs: NAV sync, SimplePay
              panel:8081)                     │                       charges, reminders, GDPR)
                                              │ kezjegy_internal (internal: true)
                                              ▼
                                        kezjegy-db (postgres:17-alpine, volume kezjegy_pgdata)
                                        /srv/kezjegy/data/files  (AES-256-GCM encrypted blobs)
 Outbound (from api/worker via kezjegy_edge): NAV Online Számla, SimplePay, SMTP (Brevo),
 Google/Apple JWKS, Expo push.
```

Web app and panel call the API **same-origin** (`/api/v1` on their own host, proxied by Caddy) → no CORS, first-party cookies. The native app uses `https://api.45-94-65-74.sslip.io/api/v1`.

### 3.2 Folders (each builder owns exactly one)

```
kod/
  SPEC.md            this file
  shared/            contracts owned by SPEC author: brand.json, src/ (types), demo/fixtures.json
  ado-motor/         pure TS tax engine (npm package "@kezjegy/ado-motor", no I/O)
  nav-kliens/        TS NAV Online Számla v3.0 read client + mock (npm package "@kezjegy/nav-kliens")
  backend/           Hono API + worker + Drizzle + seed + Dockerfile
  app/               Expo (expo-router) client app, also exported to web
  panel/             React + Vite accountant + admin panel
  jogi/              Hungarian legal drafts (Markdown) + templates for generated PDFs
  deploy/            compose, Caddy snippet, scripts for appok-1, key script template
  _qa/               QA screenshots (QA rounds only)
```

**No npm workspaces** (parallel builders would race on one `node_modules`). Each package has its own `package.json` and lockfile. Linking:
- backend depends on `"@kezjegy/ado-motor": "file:../ado-motor"` and `"@kezjegy/nav-kliens": "file:../nav-kliens"`. Both packages must build to `dist/` (ESM + `.d.ts`) with `npm run build`, and export from `dist/index.js`. Backend Docker build context is `kod/` (Dockerfile at `backend/Dockerfile`) and copies the two packages.
- `kod/shared/src/*.ts` is source-only. Consumers copy it with a tiny `scripts/sync-shared.mjs` into `src/_shared/` (generated, header "GENERATED – edit kod/shared") on `predev`/`prebuild`. `brand.json` and `demo/fixtures.json` are copied the same way. Never edit the copies.
- If ado-motor or nav-kliens is not ready when backend needs it: write a thin adapter in `backend/src/adapters/` that matches §7.5 / §8.5 exactly, and switch to the real package at integration time.

### 3.3 Tech stack (versions checked on npm 2026-11-17)

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere, `strict: true`. Backend/panel/packages pin **typescript 5.9.3** (proven in Gardoko; TS 7.0 is out but tooling is not all ready). The app uses the version the Expo SDK 58 template installs. |
| Runtime | **Node 22 LTS** (`node:22-slim` image; `engines >=22`). Node 24 also works. |
| API | **Hono 4.13** + `@hono/node-server 2.1`, validation with **zod 4** (`@hono/zod-openapi` optional; if used, serve `/api/v1/openapi.json`). |
| DB | **Postgres 17** (`postgres:17-alpine`), **Drizzle ORM 0.45** + **drizzle-kit 0.31** (SQL migrations committed in `backend/drizzle/`), driver `pg` 8. Tests: `@electric-sql/pglite` 0.5 via `drizzle-orm/pglite`. |
| Crypto | Node `crypto` (AES-256-GCM, HMAC-SHA384, SHA-512), **`js-sha3`** 0.15 for SHA3-512 (do not rely on OpenSSL `sha3-512` availability), **`@node-rs/argon2`** 2.2 (argon2id), **jose** 6 (JWT + JWKS). TOTP: own RFC 6238 implementation (≈40 lines, tested with RFC vectors) or `otplib` 13. |
| XML | **fast-xml-parser** 5 (NAV). |
| PDF | **pdf-lib** 1.17 + **@pdf-lib/fontkit** (Geist TTF embedded → correct ő/ű). |
| Mail | **nodemailer** 10 (SMTP, Brevo). |
| Logs | **pino** 10 with redaction (§4.7). |
| Tests | **vitest** 5. |
| Client app | **Expo SDK 58** (`expo@58`, React Native 0.88, React 19.3), **expo-router 58**, `@expo-google-fonts/geist` (static weights 400/500/600/700/800/900), `react-native-svg` (signature, rosette), `expo-secure-store`, `expo-local-authentication`, `expo-apple-authentication`, `expo-web-browser` (SimplePay), `expo-camera`, `react-native-document-scanner-plugin` (auto edge detection + deskew, multi-page; Android ML Kit / iOS VisionKit), `expo-document-picker`, `expo-image-manipulator`, `expo-file-system`, `expo-sharing`, `expo-notifications`, `expo-share-intent` 9 (receive PDF/image shared from other apps), `@react-native-google-signin/google-signin` 17 (native Google ID token) / Google Identity Services on web, `@tanstack/react-query` 5. Web export: `web.output: "single"` (SPA). |
| Panel | **React 19 + Vite 8 + react-router 8 + TanStack Query 5**, plain CSS using the ported `tokens.css`. No UI kit that ships line icons. Charts: hand-made SVG bars (follow the dataviz rules: one hue, labelled values). |

### 3.4 Brand / naming

- `kod/shared/brand.json` → `name` is the only product-name value. App: `app.config.ts` reads it for `name`; screens import it from `src/_shared/brand.json`. Panel: same. Backend: e-mail templates, PDFs, `/config`. Jogi: placeholder `{{brand.name}}`.
- Fixed technical IDs (do NOT derive from the name): scheme `kezjegy`, Android package `com.somosi.kezjegy`, iOS bundle `com.somosi.kezjegy`, DB/compose names `kezjegy`.
- The accountant's name is never hard-coded either: UI uses `accountant.firstName` ("Bence") / `accountant.displayName` ("Kovács Bence").

### 3.5 Conventions

- **API**: base `/api/v1`, JSON, `camelCase` fields. Request ID: accept/echo `X-Request-Id` (generate if absent).
- **Errors**: HTTP status + `{ "error": { "code": "snake_case", "message": "<plain Hungarian, tegező>", "fields"?: { "<field>": "<message>" } } }`. Codes used everywhere: `validation_failed` 400, `unauthenticated` 401, `mfa_required` 401, `forbidden` 403, `not_found` 404, `conflict` 409, `too_large` 413, `rate_limited` 429 (+`Retry-After`), `not_configured` 503 (integration has no keys in production mode), `demo_only` 403, `internal` 500 (message never contains internals).
- **IDs**: `uuid` (Postgres `gen_random_uuid()`), except `audit_log.id bigserial`.
- **Money**: integer forint (`bigint` in DB, `number` in JSON). No floats for money anywhere. UI format `Intl.NumberFormat('hu-HU')` → "457 380 Ft" (thin/no-break space grouping), "Ft" smaller per design.
- **Time**: timestamps `timestamptz`, JSON ISO-8601 UTC (`2026-11-17T09:20:00Z`). Business dates (`dueDate`, `receivedOn`, `issueDate`) are `date` / `"YYYY-MM-DD"` in **Europe/Budapest**. Month keys `"YYYY-MM"`; quarter keys `"YYYY-Q3"`.
- **Pagination**: `?limit=&cursor=` → `{ items: [...], nextCursor: string | null }`.
- **Enum values** for domain states are Hungarian ASCII snake_case (e.g. `konyvelo_latta`); table/column/field names are English. The full lists are in `kod/shared/src/enums.ts`; DTO types in `kod/shared/src/api.ts` (typechecked). In this file's tables `\|` inside code means a literal `|` (union / alternatives).
- **UI copy**: Hungarian, tegeződés, short plain sentences, no jargon without explanation ("szocho" always with "szociális hozzájárulási adó" once). Numbers in copy are illustrative only.
- **Accessibility**: text contrast ≥ 4.5:1 (tokens already comply), touch targets ≥ 44 pt, dynamic type respected up to 130 %, reduced motion respected.

---

## 4. Security and privacy

### 4.1 Authentication
- Passwords: **argon2id** (`@node-rs/argon2`, memoryCost 19 456 KiB, timeCost 2, parallelism 1 – OWASP minimum), min length 10, max 128, reject the 10 000 most common (small embedded list) and the user's own e-mail.
- **Access token**: JWT HS256 (`JWT_SECRET`), 10 min, claims `{ sub, role, sid }`. Every request also checks the session row (`sessions.revoked_at IS NULL`, user `status='active'`), cached ≤ 30 s in memory.
- **Refresh token**: opaque 32 random bytes (base64url), stored only as SHA-256 hash; 30 days absolute, 14 days idle; **rotated on every use**; reuse of a rotated token revokes the whole `family_id` (theft detection).
  - Native app: refresh token in the JSON body, stored in `expo-secure-store`.
  - Web (app + panel, same-origin): refresh token in cookie `__Host-kj_rt` — `HttpOnly; Secure; SameSite=Strict; Path=/`, no `Domain` (QA kör 2: sslip.io is not on the Public Suffix List, the `__Host-` prefix blocks cookie tossing from other *.sslip.io sites; the old `kj_rt` is only cleared, never read). Refresh/logout over cookie additionally require header `X-Kezjegy: 1` (CSRF guard). Access token kept in memory only.
- **E-mail codes** (verify e-mail, password reset, staff invite): 6 digits, 15 min, max 5 attempts, stored as HMAC-SHA256 (`CODE_HMAC_SECRET`), single use; requesting a new one invalidates the old.
- **TOTP 2FA**: RFC 6238 (SHA-1, 6 digits, 30 s, ±1 step), secret encrypted with `APP_DATA_KEY`; 10 one-time recovery codes (argon2id-hashed). Login with 2FA: `POST /auth/login` → `401 mfa_required` + `mfaToken` (5 min JWT, `typ=mfa`) → `POST /auth/login/totp`. `STAFF_TOTP_REQUIRED=true` forces accountant/admin to enable it at first login [OWNER: turn on in production].
- **Google**: verify ID token with jose against `https://www.googleapis.com/oauth2/v3/certs`; `iss ∈ {accounts.google.com, https://accounts.google.com}`, `aud ∈ GOOGLE_CLIENT_IDS`, `email_verified = true`. **Apple**: JWKS `https://appleid.apple.com/auth/keys`, `iss = https://appleid.apple.com`, `aud = APPLE_BUNDLE_ID`. Link by provider `sub`; link to an existing password account only if the e-mail matches and is verified. (Gardoko's `backend/src/auth/oidc.ts` is a proven reference.)
- **Biometric unlock**: client-side only (expo-local-authentication gates the stored refresh token after ≥ 5 min in background). No server part.

### 4.2 Authorization (checked on EVERY endpoint)
Middleware order: request-id → rate limit → auth (session) → role guard → **ownership guard**:
- `client` routes resolve `clientId` from the session user; a client never passes another client's id.
- `accountant` routes: the target client must have `clients.accountant_id = <this accountant>`; else **404** (not 403, to avoid enumeration).
- `admin` routes: only `/admin/*`; admins hit 404 on `/acc/*` unless they also own an accountant profile that is assigned to that client.
- File download (`/files/:id`): allowed if the file belongs to the caller's own client record, or to a client assigned to the caller accountant, and the file's `visibility` allows it; KYC files: accountant only. Every download of a document/KYC file → audit `file.download`.
A test per role per route group proves cross-client access returns 404 (§22).

### 4.3 Rate limits (in-memory, single API instance; key = client IP from Caddy's `X-Forwarded-For` last hop, plus user/e-mail)
| What | Limit |
|---|---|
| `POST /auth/login`, `/auth/login/totp` | 10 / 15 min per IP+e-mail; after 10 failures the account is soft-locked 15 min (`users.locked_until`) |
| `POST /auth/register`, `/auth/password/forgot`, `/auth/email/resend` | 5 / hour per IP, 3 / hour per e-mail |
| code verification | 5 attempts per code |
| uploads | 120 files / hour per user, 25 MB per file, 60 MB per request |
| everything else authenticated | 600 / 5 min per user |
| IPN webhook | not limited (signature-checked) |

### 4.4 Encryption at rest
| Data | How | Key (env) |
|---|---|---|
| Every stored file (receipts, statements, ID photos, signed PDFs, generated PDFs, NAV raw XML, GDPR exports) | AES-256-GCM, random 12-byte IV per file, AAD = file id; blob format: `"KJF1"` (4 B) · keyId (1 B) · iv (12 B) · ciphertext · tag (16 B) | `FILE_ENC_KEY` (32 B base64), `FILE_ENC_KEY_ID` (default 1) |
| DB fields: TOTP secret, SimplePay tokens, adóazonosító jel, KYC personal data JSON, phone number, staff adóazonosító jel | AES-256-GCM, value stored as `base64("KJD1"·keyId·iv·ct·tag)` in a `text` column suffixed `_enc` | `APP_DATA_KEY` |
| NAV technical-user credentials (login, password, XML signing key, XML exchange key) | same format, **separate key** | `NAV_CRED_KEY` |
- Keys only in `/srv/kezjegy/.env` (chmod 600), never in the DB, logs, repo or images. Missing key at start → the process exits with a clear error (in DEMO the deploy script generates them; §20).
- [OWNER] keep an offline copy of the keys: without them backups are unreadable.
- Lookup by adóazonosító jel uses `adoazonosito_hmac` (HMAC-SHA256 with `APP_DATA_KEY`-derived subkey); display shows only the last 3 digits.

### 4.5 Transport and headers
TLS by Caddy (Let's Encrypt). Headers on all hosts: HSTS 1 year, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, `-Server`. CSP for app and panel: `default-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://accounts.google.com; frame-src https://accounts.google.com; style-src 'self' 'unsafe-inline'; script-src 'self' https://accounts.google.com/gsi/client` – if Expo web needs inline scripts, ship as `Content-Security-Policy-Report-Only` first and note it in §24. API responses: `Cache-Control: no-store`.

### 4.6 Audit log (FUNKCIOK 28, 35)
Append-only table `audit_log` (§5.13); a DB trigger rejects UPDATE/DELETE unless `SET LOCAL kezjegy.audit_purge = 'on'` (only the retention job). Logged actions (minimum): `auth.login`, `auth.login_failed`, `auth.logout`, `auth.password_reset`, `auth.totp_enabled/disabled`, `user.created`, `client.profile_updated`, `consent.accepted`, `kyc.submitted`, `kyc.viewed`, `kyc.reviewed`, `document.uploaded`, `document.viewed` (by accountant), `document.status_changed`, `file.download`, `nav_credentials.saved/deleted/tested`, `nav.sync`, `tax.calculated`, `tax.approved`, `tax.reopened`, `tax.payment_marked/unmarked/verified`, `tax.filed`, `request.*`, `message.sent` (no body), `subscription.*`, `payment.ipn`, `admin.client_reassigned`, `content.updated`, `gdpr.export_requested/downloaded`, `gdpr.delete_requested/executed`, `appointment.*`. `details` JSON never holds message bodies, codes, tokens, passwords, file contents or full personal identifiers. IP stored as `HMAC(AUDIT_IP_SALT, ip)` only.

### 4.7 Logging
pino JSON to stdout. Never log: request/response bodies, `Authorization`, cookies, e-mail addresses, IPs (log the HMAC), codes, tokens, NAV credentials, SimplePay tokens/signatures, file names supplied by users. Redaction paths configured centrally and unit-tested. DEMO mail/push log only `template`, a recipient hash and "not sent (DEMO)".

### 4.8 GDPR
- **Export** (`POST /me/export`): worker builds a ZIP (JSON of all the user's personal data + their uploaded and generated files, decrypted) → stored encrypted → notification + link valid 24 h (`GET /me/exports/:id/download`).
- **Delete** (`POST /me/delete`, password or TOTP re-check): immediately disable login, revoke sessions, cancel subscription (no further charges), `cardcancel` at SimplePay, delete push tokens, mark `pending_deletion`. After **30 days** the worker deletes everything not under legal retention and pseudonymises the user row; retained data moves to legal hold (access admin-only with audit, purged at `retention_until`). The user can cancel within 30 days by logging in [JOGI].
- Retention defaults [JOGI]:

| Data | Keep | Basis |
|---|---|---|
| KYC records and ID images | 8 years after the business relationship ends | Pmt. (2017. évi LIII. tv.) 56–57. § |
| Fee invoices (díjszámlák) of the Kft. | 8 years | Számv. tv. 169. § |
| Client documents, NAV invoice data, tax calculations, messages | until the end of the tax assessment limitation period: 5 years after the end of the year in which the return was due (Art. 202. §), then deleted; on account deletion the user receives the export first | Art. (2017. évi CL. tv.) |
| Audit log | 5 years | legitimate interest / accountability |
| Sessions, e-mail codes, rate-limit data | 90 days | — |
| Consents | lifetime of account + 5 years | proof of consent |

---

## 5. Data model (Postgres 17, Drizzle)

All tables have `created_at timestamptz not null default now()`; mutable ones also `updated_at`. Soft delete = `deleted_at`. Enum lists are in §6 and `kod/shared/src/enums.ts`.

### 5.1 Identity
**users** — `id uuid pk`, `email citext unique not null`, `email_verified_at`, `password_hash text null` (null = social-only), `role user_role not null`, `status user_status default 'active'`, `display_name text`, `google_sub text unique`, `apple_sub text unique`, `totp_secret_enc text`, `totp_enabled_at`, `recovery_codes jsonb` (argon2 hashes + used flags), `failed_logins int default 0`, `locked_until`, `last_login_at`, `deletion_requested_at`, `deletion_due_at`, `deleted_at`.

**sessions** — `id uuid pk`, `user_id fk`, `family_id uuid`, `refresh_hash text unique`, `rotated_at`, `revoked_at`, `expires_at`, `idle_expires_at`, `last_used_at`, `client_kind ('native','web','panel')`, `user_agent text` (≤ 120 chars), `ip_hmac text`.

**email_codes** — `id`, `user_id null`, `email citext`, `purpose ('verify_email','password_reset','staff_invite')`, `code_hmac`, `expires_at`, `attempts int`, `used_at`.

**push_tokens** — `id`, `user_id`, `token text unique`, `platform ('android','ios','web')`, `last_seen_at`, `disabled_at`.

**notification_prefs** — `user_id`, `kind notification_kind`, `push bool`, `email bool`; pk (`user_id`,`kind`). Missing row = defaults from §16.

**consents** — `id`, `user_id`, `doc_type legal_doc_type`, `version text`, `accepted_at`, `ip_hmac`, `user_agent`, `withdrawn_at`.

**legal_documents** — `id`, `doc_type`, `version text` (e.g. `2026-11-17`), `title`, `source_path` (file in `LEGAL_DIR`), `sha256`, `effective_from date`, `requires_reconsent bool`. Loaded from `kod/jogi/index.json` at start (upsert).

### 5.2 Accountants
**accountants** — `id uuid pk`, `user_id fk unique`, `display_name` ("Kovács Bence"), `first_name` ("Bence"), `title` ("Mérlegképes könyvelő"), `registration_number` (PM nyilvántartási szám; demo "123456"), `adoazonosito_jel_enc` (needed for the client's ONYA authorisation form), `avatar_key` (default `karakter_1_lapos`), `signature_svg_path text` (SVG path data; demo from `app_v2/kezjegy_utak.js`), name forms for Hungarian suffixes `name_with` ("Bencével"), `name_from` ("Bencétől"), `name_onto` ("Bencére"), `name_acc` ("Bencét"), `response_time_text` ("Munkanapokon 4 órán belül válaszol"), `appointments_enabled bool default false`, `monthly_statement_request bool default true`, `capacity int default 150`, `active bool`.

### 5.3 Clients
**clients** — `id uuid pk`, `user_id fk unique`, `accountant_id fk null`, `lifecycle client_lifecycle default 'bekotes_alatt'`, `first_name`, `last_name`, `birth_name`, `phone_enc`, `adoazonosito_jel_enc`, `adoazonosito_hmac`, `adoszam text` (format `^\d{8}-\d-\d{2}$`, check digit validated; §19.1), `ev_nyilvantartasi_szam text`, `address_zip`, `address_city`, `address_line`, `hq_municipality text` (for HIPA), `activity_text`, `activity_code text null` (ÖVTJ'24, filled by accountant), `ev_since date`, `previous_accountant text`, `has_separate_business_account bool`, `referral_code_id fk null`, `attribution jsonb` (utm_*), `next_flags jsonb` (cached §6.10 flags), `personal_referral_code text unique`.

**client_tax_profiles** — `id`, `client_id`, `year int`, `cost_ratio smallint check in (45,80,90)` (2026: general ratio is **45**, not 40 – §7.1), `cost_ratio_source ('ugyfel_javaslat','konyvelo_megerositette')`, `status tax_status ('fofoglalkozasu','mellekallasu','nyugdijas')`, `guaranteed_minimum bool` (főtevékenység needs ≥ secondary qualification → garantált bérminimum as minimum base), `atalany_from date null` (if switched/started mid-year), `insurance_breaks jsonb` (`[{from,to,kind:'szunetel'|'kieso'}]`), `hipa_method ('savos','altalanos','nincs')`, `hipa_rate_pct numeric(4,2) default 2.00`, `hipa_account_number text null`, `prior_overrides jsonb null` (`{ priorActualBaseSum, priorSzjaAdvanceSum }` for quarters handled by a previous accountant); unique (`client_id`,`year`).

**internal_notes** — `id`, `client_id`, `author_user_id`, `body text` (≤ 4 000), `pinned bool`. Accountant-only, never exported to the client (but included in GDPR export as "könyvelői jegyzet" [JOGI]).

### 5.4 Onboarding, KYC, NAV credentials
**onboarding_steps** — pk (`client_id`,`step onboarding_step`), `status step_status`, `data jsonb` (non-sensitive, e.g. `{ method: 'onya_ugyfel' }`), `note text` (shown to client when `hianyos`), `updated_at`, `completed_at`, `reviewed_by`.

**kyc_records** — `id`, `client_id`, `status ('bekuldve','elfogadva','hianyos')`, `data_enc` (Pmt. 7. § data: family/given name, birth name, mother's birth name, place + date of birth, citizenship, address, document type + number + expiry), `declarations jsonb` (`{ ownBehalf: true, pep: false, pepDetails?: string, signedAt }`), `files jsonb` (`{ idFront, idBack, addressFront, addressBack }` → file ids), `submitted_at`, `reviewed_by`, `reviewed_at`, `review_note`, `relationship_ended_at null`, `retention_until date`.

**nav_credentials** — `id`, `client_id unique`, `tax_number char(8)`, `secret_enc` (NAV_CRED_KEY: `{ login, password, signatureKey, exchangeKey }`), `login_hint text` (first 3 chars + "…"), `environment ('demo','test','prod')`, `status ('nincs_ellenorizve','rendben','hibas')`, `last_test_at`, `last_test_error`, `last_sync_at`, `last_sync_status`, `last_sync_error`, `sync_cursor_ins_date timestamptz`, `saved_by`, `saved_at`.

**nav_sync_runs** — `id`, `client_id`, `started_at`, `finished_at`, `status ('ok','hiba')`, `digests_seen int`, `invoices_new int`, `error_code text`.

### 5.5 Dossier, documents, NAV invoices, revenue
**dossiers** — `id`, `client_id`, `month char(7)` ("2026-10"), `reviewed_at`, `reviewed_by`, `summary_note text` ("A tegnapi szerződésre még ránéz."); unique (`client_id`,`month`). Created lazily and by the monthly job.

**documents** — `id`, `client_id`, `dossier_month char(7)`, `source document_source`, `category document_category`, `title text` (≤ 120), `status document_status default 'feltoltve'`, `status_changed_at`, `visibility ('kozos','csak_konyvelo') default 'kozos'`, `document_date date null`, `amount_huf bigint null`, `current_version_id`, `client_note text`, `accountant_comment text` (shown on item detail, e.g. Bence's tip), `related_period_id null`, `related_request_id null`, `created_by`, `deleted_at`.

**document_versions** — `id`, `document_id`, `version_no int`, `file_id`, `page_count int`, `thumb_file_id null`, `uploaded_by`, `note`. Multi-page photo uploads are merged server-side into one PDF (pdf-lib); the first page also stored as JPEG thumbnail.

**document_status_history** — `id`, `document_id`, `from_status null`, `to_status`, `changed_by null` (null = system), `changed_at`, `note`.

**nav_invoices** — `id`, `client_id`, `invoice_number`, `batch_index int null`, `operation ('CREATE','MODIFY','STORNO')`, `category`, `issue_date`, `delivery_date`, `payment_date null`, `payment_method null`, `currency`, `net_huf bigint`, `vat_huf bigint`, `gross_huf bigint`, `customer_name text null`, `customer_tax_number text null`, `original_invoice_number null`, `modification_index int null`, `ins_date timestamptz`, `transaction_id text`, `data jsonb` (normalized invoice §8.5), `raw_xml_file_id null`, `dossier_month char(7)` (= issue month), `status document_status default 'feltoltve'`; unique (`client_id`,`invoice_number`,`coalesce(modification_index,0)`,`operation`).

**revenue_items** (bevételi nyilvántartás; input of the engine) — `id`, `client_id`, `source ('nav_szamla','kezi')`, `nav_invoice_id null`, `document_id null`, `received_on date` (pénzforgalmi dátum: counts for átalányadó), `received_on_estimated bool`, `delivery_date date` (teljesítés: counts for the alanyi ÁFA limit), `amount_huf bigint` (may be negative for STORNO/MODIFY), `description`, `counts_for_atalany bool default true`, `counts_for_afa_limit bool default true`, `excluded_reason text null`, `created_by`, `deleted_at`.
Rule when created from a NAV invoice: `received_on` = `issue_date` for `CASH|CARD|VOUCHER`, else `payment_date ?? issue_date` with `received_on_estimated = true` (accountant can correct after seeing the bank statement). Items with `received_on > asOf` are "várható" and excluded from the current estimate.

### 5.6 Tax periods and payments
**tax_periods** — `id`, `client_id`, `kind ('negyedev','hipa')`, `period_key` ("2026-Q3" | "2026-HIPA-1" | "2026-HIPA-2"), `year`, `quarter null`, `due_date date`, `calc_status calc_status default 'nincs'`, `payment_status payment_status default 'nincs_fizetendo'`, `filing_status ('nincs','beadva') default 'nincs'`, `approved_calculation_id null`, `filed_at`, `filed_by`, `filing_form text` ("2658"), `return_document_id null`, `receipt_document_id null`; unique (`client_id`,`period_key`).

**tax_calculations** — `id`, `tax_period_id`, `version int`, `engine_version text`, `rules_version text` ("2026-01-01"), `as_of date`, `input jsonb` (engine input snapshot), `result jsonb` (full engine output incl. explanation), `overrides jsonb null` (`{ tb?, szocho?, szjaAdvance?, hipa?, reason }` – reason required), `letter_text text null`, `calculated_by null` (null = system), `approved_by null`, `approved_at null`, `published_at null`.

**tax_payment_items** — `id`, `tax_period_id`, `kind payment_item_kind`, `label` ("TB-járulék"), `sublabel null` ("szociális hozzájárulási adó"), `amount_huf bigint`, `due_date`, `account_name`, `account_number` ("10032000-06055802"), `iban`, `reference` (közlemény = client's adószám, [KÖNYVELŐ] may switch to adóazonosító jel), `marked_paid_at`, `marked_paid_on date` (client-stated date), `verified_at`, `verified_by`, `verification ('rendben','elteres') null`, `verification_note`.

**deadlines** — `id`, `client_id null` (null = applies to all clients of the kind), `kind ('befizetes','bevallas','keres','idopont','egyeb')`, `title`, `due_date`, `related_period_id null`, `related_request_id null`, `created_by null`. Generated yearly from §7.4 calendar + per client from periods/requests/appointments.

### 5.7 Messages, requests, certificates
**messages** — `id`, `client_id`, `sender_user_id null` (null = system), `sender_role`, `kind ('szoveg','keres_kartya','rendszer')`, `body text` (≤ 4 000), `request_id null`, `document_id null` (when "Kérdezek róla" on an item), `read_by_client_at`, `read_by_accountant_at`, `deleted_at`.
**message_attachments** — `message_id`, `file_id`, `display_name`.
**message_templates** — `id`, `accountant_id null` (null = global), `title`, `body`, `sort`.

**requests** (kérések, both ways) — `id`, `client_id`, `direction ('konyvelotol','ugyfeltol')`, `type request_type`, `title`, `body`, `dossier_month null`, `due_date null`, `status request_status default 'nyitott'`, `result_document_id null`, `created_by`, `completed_at`, `completed_by`, `status_note`.
**certificate_requests** — `request_id pk fk`, `certificate_type ('jovedelemigazolas','nullas_igazolas','koztartozasmentes_igazolas')`, `year int null` (jövedelemigazolás), `purpose text` ("bank, lakáshitel"), `language ('hu','en') default 'hu'`, `submitted_to_nav_at null`, `document_id null`.

### 5.8 Appointments (optional)
**availability_slots** — `id`, `accountant_id`, `starts_at`, `ends_at`, `channels text[]` (`telefon`,`video`), `status ('szabad','foglalt','torolve')`.
**appointments** — `id`, `client_id`, `accountant_id`, `slot_id`, `starts_at`, `ends_at`, `channel ('telefon','video')`, `phone_enc null`, `video_link text null` (entered by accountant), `topic text`, `status ('foglalt','lemondva','megtortent','elmaradt')`, `cancelled_by null`, `reminder_24h_at`, `reminder_1h_at`.

### 5.9 Subscriptions and SimplePay
**plans** — `code pk` ("havi"), `name`, `price_huf int` (19999), `interval ('month')`, `active`.
**subscriptions** — `id`, `client_id unique`, `plan_code`, `status subscription_status default 'incomplete'`, `current_period_start date`, `current_period_end date`, `next_charge_at timestamptz`, `cancel_at_period_end bool`, `canceled_at`, `failed_attempts int default 0`, `last_failure_code text`, `grace_until date null`, `card_registration_id null`, `mode ('demo','sandbox','live')`.
**card_registrations** — `id`, `client_id`, `simplepay_card_id bigint` (= transactionId of the registration payment), `card_mask` ("xxxx-xxxx-xxxx-4193"), `card_expiry date`, `tokens_until timestamptz`, `max_amount_huf int`, `status ('fuggo','aktiv','torolve','lejart')`, `mode`.
**payment_tokens** — `id`, `card_registration_id`, `token_enc` (APP_DATA_KEY), `status ('fuggo','aktiv','felhasznalt','visszavont')`, `used_at`, `used_order_ref`.
**simplepay_transactions** — `id`, `order_ref text unique` (ours: `KJ-YYYYMMDD-<10 base32>`), `simplepay_transaction_id bigint null`, `kind ('regisztracio','ismetlodo','visszaterites')`, `client_id`, `subscription_id`, `amount_huf`, `currency 'HUF'`, `status text` (SimplePay status string, §9.1), `period_start date`, `period_end date`, `error_codes text[]`, `ipn_count int`, `last_ipn_at`, `finished_at`, `mode`.
**fee_invoices** (díjszámlák) — `id`, `client_id`, `simplepay_transaction_id fk`, `provider ('demo','szamlazzhu','billingo')`, `number text`, `issued_on date`, `amount_huf`, `pdf_file_id`, `external_id`, `status ('kiallitva','hiba','sztorno')`, `demo bool`.

### 5.10 Notifications
**notifications** — `id`, `user_id`, `kind notification_kind`, `title`, `body`, `link text` (in-app route, e.g. `/dosszie/2026-10`), `data jsonb`, `read_at`, `push_sent_at`, `email_sent_at`, `error text`.

### 5.11 Referral and attribution
**referral_codes** — `id`, `code text unique` (A–Z0–9, 6–12), `owner_client_id null`, `campaign text null`, `note`, `active bool`, `created_by`.
**signup_attribution** — `user_id pk`, `referral_code_id null`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `landing ('web','android','ios')`, `first_seen_at`.

### 5.12 Content
**content_texts** — `key text pk` (e.g. `notif.tax_approved.title`, `email.password_reset.body`, `ui.home.letter_default`), `body text`, `placeholders text[]`, `updated_by`, `updated_at`, `version int`. Defaults shipped in `backend/src/content/defaults.hu.json`; DB rows override.
**faq_items** — `id`, `question`, `answer` (plain text with line breaks), `sort int`, `published bool`.

### 5.13 Audit, files, exports
**audit_log** — `id bigserial pk`, `at timestamptz`, `actor_user_id null`, `actor_role text`, `action text`, `target_type text`, `target_id text`, `client_id uuid null`, `ip_hmac`, `user_agent` (≤ 80), `request_id`, `details jsonb`. Indexes: (`client_id`,`at`), (`actor_user_id`,`at`), (`action`,`at`).
**files** — `id uuid pk`, `owner_client_id null`, `kind ('dokumentum','kyc','uzenet_csatolmany','nav_xml','generalt_pdf','dijszamla','gdpr_export','alairas')`, `mime`, `size_bytes`, `sha256` (of plaintext), `key_id smallint`, `storage_path`, `display_name` (sanitized, ≤ 120), `created_by`, `retention_until date null`, `legal_hold bool`, `deleted_at`.
**gdpr_exports** — `id`, `user_id`, `status ('keszul','kesz','lejart','hiba')`, `file_id`, `expires_at`.
**demo_outbox** (only used when `MAIL_MODE=demo`) — `id`, `to_hash`, `to_display` (masked "ka…@demo.kezjegy.test"), `subject`, `body_text`, `created_at`; kept 7 days; visible to admins in the panel (§18) so testers can read codes.

---

## 6. State machines

Every transition writes history (where a history table exists), an audit row and the notifications in §16.

### 6.1 Onboarding steps (`onboarding_step`)
| Step | Client does | Accountant does | Done when |
|---|---|---|---|
| `fiok` | registers, verifies e-mail (or Google/Apple) | — | e-mail verified |
| `adatok` | questionnaire (§17 B2) | confirms cost ratio + status in tax profile | client submitted (`kesz`); accountant confirmation tracked in `client_tax_profiles.cost_ratio_source` |
| `szerzodes` | reads + accepts ÁSZF, Adatkezelési tájékoztató, Megbízási szerződés (current versions) | — | 3 consents stored |
| `elofizetes` | SimplePay card registration + first month | — | IPN `FINISHED` for the registration order (DEMO: demo IPN) |
| `meghatalmazas` | files UJEGYKE in ONYA as meghatalmazó, taps "Beküldtem" (optionally uploads ONYA confirmation PDF) – or approves the accountant's filing within 4 days; alternative signed PDF (§10) | checks NAV, sets `kesz` or `hianyos` with note | accountant set `kesz` |
| `azonositas` | uploads ID front/back, address card front/back, fills Pmt. data + declarations | reviews → `kesz` or `hianyos` | accountant `kesz` (kyc `elfogadva`) |
| `idopont` | books optional call | marks `megtortent` | only if `appointments_enabled`; else `kihagyva` |
| `nav_bekotes` | — | saves technical-user credentials, test OK, first sync OK | first successful sync |

`step_status`: `nincs_kezdve` → `ugyfelre_var` ↔ `konyvelore_var` → `kesz`; `hianyos` (accountant sent back with note) → `ugyfelre_var`; `kihagyva`.
Client-facing progress line (FUNKCIOK 7): **Aláírva** (`szerzodes`=kesz ∧ `meghatalmazas`∈{konyvelore_var,kesz}) → **Azonosítva** (`azonositas`=kesz) → **NAV-nál bejelentve** (`meghatalmazas`=kesz) → **Számlák bekötve** (`nav_bekotes`=kesz) → **Kész** (all required steps kesz ∧ `elofizetes`=kesz). When "Kész", `clients.lifecycle='aktiv'`.

### 6.2 Documents (`document_status`) – the four words never change
`feltoltve` ("Feltöltve"; for NAV items "Megérkezett") → `konyvelo_latta` ("{firstName} látta"; set automatically when the accountant opens it in the panel) → `feldolgozva` ("Feldolgozva") → `beadva` ("Beadva"; set in bulk when the period it belongs to is filed). Accountant may move back one step with a note. Client may delete or replace only while `feltoltve`; afterwards only add a new version (status returns to `feltoltve`). Notify client on `feldolgozva` (batched, max one push per day) and on `beadva`.

### 6.3 Tax periods
- `calc_status`: `nincs` → `becsles` (system recalculation after each sync/revenue change; shown to client as estimate) → `jovahagyva` (accountant approves → payment items created, letter published). `POST reopen` → back to `becsles` (payment items voided; client notified "{firstName} módosította az összeget").
- `payment_status`: `nincs_fizetendo` (total 0) | `fizetendo` → `befizetve_jelezve` (client "Már befizettem"; "Mégsem fizettem be" returns to `fizetendo`) → `ellenorizve` (accountant saw it on the bank statement) or `elteres` (with note; client sees a request).
- `filing_status`: `nincs` → `beadva` (accountant uploads the 2658 return PDF + NAV receipt; all `feldolgozva` documents of that quarter's months → `beadva`).

### 6.4 Requests
`nyitott` → `folyamatban` → `teljesitve` | `elutasitva` (with reason); creator may `visszavonva` while `nyitott`. An accountant→client `dokumentum` request becomes `teljesitve` when the client attaches a document and taps "Kész" (or accountant closes it).

### 6.5 Subscription
`incomplete` → (registration FINISHED) `active` → (charge failed) `past_due` (retries at +1, +3, +7 days) → (still unpaid at +14 days) `suspended` [OWNER: grace length] → (paid) `active`. `cancel_at_period_end` → `canceled` at period end. Card deleted → stays `active` until period end, next charge needs a new card registration.

### 6.6 Appointments
`foglalt` → `megtortent` | `elmaradt` | `lemondva`.

### 6.7 Client lifecycle
`bekotes_alatt` → `aktiv` → `felfuggesztve` (subscription suspended) → `aktiv`; `megszunt` (cancelled + period ended, or deleted).

### 6.8 KYC
`bekuldve` → `elfogadva` | `hianyos` (note) → `bekuldve`.

### 6.9 NAV credentials
`nincs_ellenorizve` → (test OK) `rendben` | `hibas` (error code mapped to Hungarian, §8.4).

### 6.10 Client flags (panel filters, FUNKCIOK 20)
Computed nightly and after relevant events into `clients.next_flags`:
- `bekotes_alatt`: lifecycle `bekotes_alatt`.
- `hianyzik_valami`: any accountant→client request past due, or any onboarding step `hianyos`, or approved tax items past due and not marked paid, or NAV sync `hibas`.
- `hatar_kozel`: alanyi ÁFA meter ≥ 80 % or projected ≥ 100 %, or átalány cap meter ≥ 80 %.
- `dij_elmaradt`: subscription `past_due` or `suspended`.
- `rendben`: none of the above and lifecycle `aktiv`.

---

## 7. Tax engine (`kod/ado-motor`)

Pure TypeScript, no I/O, deterministic, every rate and limit in one dated config object with source URLs. **It is an estimate the accountant approves** – every result carries `disclaimer: "Becslés. A végleges összeget a könyvelőd hagyja jóvá."` until approved.

### 7.1 Rules for 2026 (sources: NAV 100. és 3. sz. információs füzet 2026, NAV hírek – §25)
| Item | 2026 value | Note / source |
|---|---|---|
| Monthly minimum wage (minimálbér) | **322 800 Ft** | 426/2025. (XII. 23.) Korm. r. |
| Guaranteed wage minimum (garantált bérminimum) | **373 200 Ft** | same; used instead of minimálbér when the personally performed main activity needs at least secondary qualification (e.g. NAV's example: kozmetikus) – per-client flag `guaranteedMinimum` [KÖNYVELŐ] |
| Annual minimum wage | 3 873 600 Ft | 12 × 322 800 |
| Cost ratios (költséghányad) | **45 %** general (was 40 % until 2025; **50 % from 2027**), **80 %** for activities listed in Szja tv. 53. § (2) (e.g. ÖVTJ'24 41–42 építőipari kivitelezés, 9602 fodrászat/szépségápolás, 4520 gépjárműjavítás, 951, 952, 56 vendéglátás, 4932 taxi, 855301), **90 %** exclusively retail (kiskereskedelem, except vendéglátás) | NAV 100. füzet 3. pont. The task brief said 40 %; the law for 2026 says 45 % – use 45. If activities change during the year to a lower ratio, the lower ratio applies to the whole year. |
| Átalányban megállapított jövedelem | revenue × (1 − ratio) | per month, rounded to forint |
| Tax-free part (adómentes rész) | **1 936 800 Ft / year** = half the annual minimum wage; not prorated for mid-year starters | Szja tv. 1. sz. melléklet 4.48 |
| SZJA | **15 %** of the taxable part (income above 1 936 800 Ft, cumulative from 1 Jan) | |
| SZJA advance | **quarterly**, cumulative: Q advance = 15 % × taxable YTD − advances of earlier quarters; due the **12th of the month after the quarter** (Q4 → 12 Jan next year) | Szja tv. 47. § (4a); NAV 100. füzet 4. pont |
| TB-járulék | **18.5 %** | Tbj. |
| Szocho | **13 %** | Szocho tv. |
| Járulék + szocho base (főfoglalkozású) | **göngyölítéses (cumulative) method per quarter** (§7.2), monthly minimum = minimálbér or garantált bérminimum (**100 %**, the 112.5 % szocho multiplier is gone from 2026); the tax-free part is NOT part of the base | NAV 100. füzet 6.1; NAV hír "Csökken a szocho alapja…" |
| Mellékállású (alongside ≥ 36 h/week employment or full-time studies) | same cumulative base, **no minimum** | NAV 100. füzet 6.2 |
| Nyugdíjas (kiegészítő tevékenységű) | **no TB, no szocho**; SZJA as usual | NAV 100. füzet 6.3 (anyák kedvezménye exception → [KÖNYVELŐ], not modelled) |
| Járulék filing and payment | **quarterly from 2026**: form **2658**, monthly breakdown, filing AND payment by the 12th of the month after the quarter | NAV hír "Így adózunk jövőre", "Csökken a szocho alapja…" |
| Átalányadó revenue cap | 10 × annual minimum wage = **38 736 000 Ft**; retail **193 680 000 Ft**; prorated by days for mid-year start | Szja tv. 50. § (1), 52. § (1) |
| Alanyi ÁFA-mentesség limit | **20 000 000 Ft** in 2026 (22 M in 2027, 24 M in 2028); counted on consideration by delivery date; warn at **80 %** | Áfa tv. 188. §; NAV "Így adózunk jövőre" |
| Szocho annual cap (24 × minimálbér = 7 747 200 Ft) | **does not apply** to the átalányadózó's own monthly szocho (it is for vállalkozói osztalékalap etc.) | NAV 3. füzet III.1 |
| HIPA (helyi iparűzési adó) | small-business simplified **banded base** (kisvállalkozó, net revenue ≤ 25 M Ft): base **2.5 M** (revenue < 12 M), **6 M** (12–18 M), **8.5 M** (18–25 M) per municipality × local rate (max 2 %, default 2 %); the old "120 % of átalány income" rule ended in 2022. General method is [KÖNYVELŐ] (not modelled; `hipa_method='altalanos'` → engine returns `null` + note). Advances: default 16 March 2026 and 15 September (half each); annual return 31 May; municipality-dependent → [KÖNYVELŐ] per client | Htv. (1990. évi C. tv.) kisvállalkozói egyszerűsített adóalap; municipal guides (§25) – verify § number |
| Rounding | each monthly base rounded to forint (half up); TB/szocho computed per month and rounded; SZJA computed on cumulative taxable amount and rounded | Art.: magánszemély forintra kerekít |
| Collection accounts | SZJA **10032000-06056353**, TB **10032000-06055802**, Szocho **10032000-06055912** (NAV beszedési számlák for EV); közlemény = adószám (or adóazonosító jel) | NAV 3. füzet; NAV "Ki, hogyan fizethet a NAV-nak?" |

All of this lives in `ado-motor/src/rules/2026.ts` as `RULES_2026` with `{ validFrom: '2026-01-01', sources: string[] }`; `RULES_2027` stub with the known changes (cost ratio 50 %, ÁFA limit 22 M) marked `draft: true`.

### 7.2 Algorithm (per client, per year, as of a date)
1. Take revenue items with `countsForAtalany` and `receivedOn ≤ asOf` in the year; monthly revenue `R[m]`. Monthly income `I[m] = round(R[m] × (100 − ratio) / 100)`.
2. For quarter q (months a..c): `incomeYTD = Σ I[1..c]`; `taxableYTD = max(0, incomeYTD − 1 936 800)`.
3. Insured months in q = months with ≥ 1 insured day (exclude months fully covered by `szunetel`; months before `atalanyFrom`/EV start are not insured).
4. Cumulative base: `g = max(0, taxableYTD − priorActualBaseSum) / insuredMonths` where `priorActualBaseSum` = sum of the **actual** monthly bases of earlier quarters (including minimum bases). (Verified against the NAV example in §7.6.)
5. Monthly actual base:
   - `fofoglalkozasu`: `max(g, minimum)`, where `minimum` = minimálbér or garantált bérminimum; for a month with `kieso` days (táppénz, gyed …) or a partial month, `minimum = min(fullMinimum, fullMinimum / 30 × (daysInMonth − kiesoDays))`.
   - `mellekallasu`: `g` (no minimum).
   - `nyugdijas`: 0.
6. `TB = Σ round(base × 0.185)`, `szocho = Σ round(base × 0.13)` over the quarter's insured months.
7. `szjaAdvance(q) = round(taxableYTD(q) × 0.15) − round(taxableYTD(q−1) × 0.15)` (or `− priorSzjaAdvanceSum` override). Never negative (if negative → 0 and a warning `szja_tulfizetes`).
8. HIPA (banded): from annual projected net revenue choose the band; annual tax = base × rate; two advances = half each (shown as estimate only).
9. Meters (as of `asOf`): `afa` = Σ revenue by `deliveryDate` in the year vs 20 M (projected = used / dayOfYear × daysInYear, the "csíkozott" part); `atalanyCap` vs 38 736 000 (or retail cap); `adomentes` = `{ limit: 1 936 800, usedIncome: min(incomeYTD, limit), reachedMonth }`.
10. Warnings (codes + Hungarian text): `afa_80`, `afa_projected_over`, `atalany_cap_80`, `cost_ratio_2026_changed` (profile still 40), `mellekallas_condition` (reminder of the 36-hour rule), `garantalt_minimum_check`, `hipa_altalanos_not_modelled`, `received_on_estimated` (some items have estimated dates).

### 7.3 Explanation ("Hogyan jött ki?", design 07) – produced by the engine in Hungarian
Lines for one quarter, e.g. Kata Q3 2026 (§7.6):
- intro: "2026-tól a TB-járulékot, a szochót és az SZJA-előleget is negyedévente fizeted, a negyedév utáni hónap 12-éig. Mindhárom az idei jövedelmedből jön."
- "Július–szeptemberi bevételed: 2 490 000 Ft" / "− Költséghányad, 45%: 1 120 500 Ft" / "= Jövedelmed a negyedévben: 1 369 500 Ft"
- "Év eleje óta: 3 817 000 Ft jövedelem; ebből 1 936 800 Ft adómentes."
- "TB-járulék: havonta legalább a minimálbér (322 800 Ft) után fizetsz. A jövedelmed ennél kevesebb volt, ezért 3 × 322 800 Ft ennek 18,5%-a: 179 154 Ft"
- "Szocho (szociális hozzájárulási adó): ugyanennek 13%-a: 125 892 Ft"
- "SZJA-előleg: az adóköteles rész év eleje óta 1 880 200 Ft, ennek 15%-a 282 030 Ft. Ebből 76 605 Ft-ot már befizettél, most: 205 425 Ft"
- result "Összesen: 510 471 Ft" + disclaimer.
Design note: the approved 07 PNG says "A járulékokat havonta, az SZJA-előleget negyedévente fizeted" and "Költséghányad, 40%". **Both are outdated for 2026 – use the text above** (law beats mock-up).

### 7.4 Deadlines calendar
`deadlinesFor(year)` returns NAV dates with the "next working day" rule using a config list of Hungarian non-working days and moved working days. 2026 quarterly due dates **2026-04-13, 2026-07-13, 2026-10-12, 2027-01-12** (NAV's published list); SZJA annual return **2027-05-20** (for tax year 2026); HIPA advances default **2026-03-16, 2026-09-15** (15 March 2026 is a Sunday and a holiday), HIPA annual return **2027-05-31** (Monday) [KÖNYVELŐ]; 2027 HIPA first advance 2027-03-16 (15 March 2027 is a holiday). Holiday list for 2026–2027 in `rules/holidays.ts` with source comment.

### 7.5 Contract (TypeScript; exported from `@kezjegy/ado-motor`)
```ts
export type CostRatio = 45 | 80 | 90;
export type TaxStatus = 'fofoglalkozasu' | 'mellekallasu' | 'nyugdijas';
export interface RevenueItemInput { receivedOn: string; deliveryDate: string; amountHuf: number;
  countsForAtalany: boolean; countsForAfaLimit: boolean; estimated?: boolean }
export interface TaxProfileInput { year: number; costRatio: CostRatio; status: TaxStatus; guaranteedMinimum: boolean;
  atalanyFrom?: string; retail?: boolean;
  insuranceBreaks?: { from: string; to: string; kind: 'szunetel' | 'kieso' }[];
  hipa?: { method: 'savos' | 'altalanos' | 'nincs'; ratePct: number };
  priorOverrides?: { throughQuarter: 1|2|3; priorActualBaseSum: number; priorSzjaAdvanceSum: number } }
export interface YearInput { profile: TaxProfileInput; revenue: RevenueItemInput[]; asOf: string }
export interface MonthLine { month: number; revenueHuf: number; incomeHuf: number; insured: boolean;
  minimumHuf: number | null; baseHuf: number; tbHuf: number; szochoHuf: number }
export interface QuarterResult { quarter: 1|2|3|4; periodKey: string; dueDate: string; complete: boolean; // complete = quarter ended before asOf
  revenueHuf: number; incomeHuf: number; incomeYtdHuf: number; taxableYtdHuf: number; cumulativeBasePerMonthHuf: number;
  months: MonthLine[]; tbHuf: number; szochoHuf: number; szjaAdvanceHuf: number; totalHuf: number;
  payments: { kind: 'tb_jarulek'|'szocho'|'szja_eloleg'; label: string; sublabel?: string; amountHuf: number;
              accountName: string; accountNumber: string; iban: string }[];
  explanation: { intro: string; lines: { label: string; amountHuf?: number; op?: '+'|'−'|'='; note?: string }[]; result: string };
  warnings: { code: string; text: string }[] }
export interface Meter { usedHuf: number; limitHuf: number; projectedHuf: number; ratio: number; warning: boolean; sentence: string }
export interface YearResult { engineVersion: string; rulesVersion: string; asOf: string; quarters: QuarterResult[];
  meters: { afa: Meter; atalanyCap: Meter; adomentes: { limitHuf: number; usedIncomeHuf: number; reached: boolean; reachedMonth: number | null; sentence: string } };
  hipa: { method: string; baseHuf: number | null; annualHuf: number | null; advances: { dueDate: string; amountHuf: number }[]; note: string } | null;
  revenueByMonth: { month: number; amountHuf: number }[]; warnings: { code: string; text: string }[]; disclaimer: string }
export function calculateYear(input: YearInput): YearResult;
export function deadlinesFor(year: number): { kind: 'befizetes'|'bevallas'; title: string; dueDate: string; periodKey?: string }[];
export function costRatioForActivity(answer: 'kiskereskedelem'|'lista80'|'egyeb'): CostRatio;
export const ENGINE_VERSION: string; export const RULES_2026: TaxRules;
```
`activity → ratio` helper is only a suggestion for the questionnaire; the accountant confirms.

### 7.6 Worked examples (must be unit tests)
**A. NAV 100. füzet example (income given directly, minimálbér, Feb kieső 25 days, Aug szünetel, Dec kieső 5 days):** monthly actual bases Q1 `[322 800, 32 280, 322 800]`, Q2 `[322 800 ×3]`, Q3 `[322 800, –, 322 800]` (g = 83 460), Q4 `[322 800, 322 800, 279 760]` (g = 40 440); cumulative actual bases **677 880 / 1 646 280 / 2 291 880 / 3 217 240** – identical to the NAV table.
**B. NAV SZJA examples:** 7 000 000 Ft revenue, 45 % → income 3 850 000, taxable 1 913 200, SZJA **286 980**. Q1 revenue 3 750 000 → income 2 062 500 → advance **18 855**; Q2 revenue 4 500 000 → income 2 475 000 → advance **371 250**.
**C. Seed clients, as of 2026-11-17** (revenue by received month from `fixtures.json`):

| Client | Q | Revenue | Income | Taxable YTD | Monthly bases | TB | Szocho | SZJA-előleg | Total |
|---|---|---|---|---|---|---|---|---|---|
| Kata 45 %, főfogl., minimálbér | 1 | 1 870 000 | 1 028 500 | 0 | 322 800 ×3 | 179 154 | 125 892 | 0 | **305 046** |
| | 2 | 2 580 000 | 1 419 000 | 510 700 | 322 800 ×3 | 179 154 | 125 892 | 76 605 | **381 651** |
| | 3 | 2 490 000 | 1 369 500 | 1 880 200 | 322 800 ×3 | 179 154 | 125 892 | 205 425 | **510 471** |
| | 4 (so far) | 1 062 000 | 584 100 | 2 464 300 | 322 800 ×3 | 179 154 | 125 892 | 87 615 | **392 661** (becslés) |
| Réka 80 %, főfogl., garantált | 1 | 4 450 000 | 890 000 | 0 | 373 200 ×3 | 207 126 | 145 548 | 0 | 352 674 |
| | 2 | 4 920 000 | 984 000 | 0 | 373 200 ×3 | 207 126 | 145 548 | 0 | 352 674 |
| | 3 | 4 960 000 | 992 000 | 929 200 | 373 200 ×3 | 207 126 | 145 548 | 139 380 | **492 054** |
| | 4 (so far) | 1 840 000 | 368 000 | 1 297 200 | 373 200 ×3 | 207 126 | 145 548 | 55 200 | 407 874 (becslés) |
| Péter 45 %, mellékállású | 1–2 | 3 060 000 | 1 683 000 | 0 | 0 | 0 | 0 | 0 | 0 |
| | 3 | 1 650 000 | 907 500 | 653 700 | 217 900 ×3 | 120 936 | 84 981 | 98 055 | 303 972 |
| | 4 (so far) | 910 000 | 500 500 | 1 154 200 | 166 833 ×3 | 92 592 | 65 064 | 75 075 | 232 731 (becslés) |

Meters as of 2026-11-17 (by delivery date): Kata ÁFA 8 242 000 Ft (41 %), Réka **16 315 000 Ft (81.6 % → warning, flag `hatar_kozel`)**, Péter 5 620 000 Ft. The same numbers are in `fixtures.json → expectedTax2026`. Q4 values change as later November invoices get "received" – tests pass `asOf: '2026-11-17'`.

---

## 8. NAV Online Számla client (`kod/nav-kliens`)

Read-only client for **Online Számla API v3.0** (interface spec HU v3.0, 2026-02-12, github.com/nav-gov-hu/Online-Invoice). Allowed operations: `queryInvoiceDigest`, `queryInvoiceData`, `queryTaxpayer` (credential check), optionally `queryInvoiceChainDigest`. Write operations must not exist in the package.

### 8.1 Transport
- Base URLs: test `https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3`, production `https://api.onlineszamla.nav.gov.hu/invoiceService/v3`. `POST /<operation>`, headers `Content-Type: application/xml`, `Accept: application/xml`, UTF-8.
- Namespaces: api `http://schemas.nav.gov.hu/OSA/3.0/api`, common `http://schemas.nav.gov.hu/NTCA/1.0/common`, base `http://schemas.nav.gov.hu/OSA/3.0/base`, data `http://schemas.nav.gov.hu/OSA/3.0/data` (check against the XSDs in the repo `src/schemas/nav/gov/hu/OSA`).
- HTTP 200 may still carry a business error (`result/funcCode = ERROR`, `errorCode`, `message`); non-200 = technical error (`GeneralErrorResponse`).
- **Rate limit**: the server allows 1 request / second / IP on limited endpoints (incl. `queryInvoiceData`, `queryTaxpayer`); extra requests get +4 s delay and are killed after 60 s queueing. The client serialises all calls through one queue with ≥ 1 000 ms spacing (one server IP for all clients). Timeout 60 s. Retry (max 3, exponential 2/4/8 s) only for network errors, HTTP 5xx and `OPERATION_FAILED`/maintenance codes – never for auth/signature errors.

### 8.2 Request header and signature (spec 1.3–1.5)
```xml
<QueryInvoiceDigestRequest xmlns="…/OSA/3.0/api" xmlns:common="…/NTCA/1.0/common">
  <common:header><common:requestId>{id}</common:requestId><common:timestamp>{UTC 2026-11-17T05:30:00.000Z}</common:timestamp>
    <common:requestVersion>3.0</common:requestVersion><common:headerVersion>1.0</common:headerVersion></common:header>
  <common:user><common:login>{login}</common:login>
    <common:passwordHash cryptoType="SHA-512">{UPPER(SHA-512(password))}</common:passwordHash>
    <common:taxNumber>{8 digits}</common:taxNumber>
    <common:requestSignature cryptoType="SHA3-512">{UPPER(SHA3-512(requestId + yyyyMMddHHmmss(UTC timestamp) + signatureKey))}</common:requestSignature></common:user>
  <software>…</software> …operation body…
</QueryInvoiceDigestRequest>
```
- `requestId`: pattern `[+a-zA-Z0-9_]{1,30}`, unique per taxpayer (use `KJ` + 26 chars base36 of time + random). Timestamp tolerance ±1 day.
- For query operations the signature is the **partial** one above (no invoice hashes).
- `software` block: `softwareId` `[0-9A-Z\-]{18}` (recommendation: `HU` + developer törzsszám (8) + 8 own chars; env `NAV_SOFTWARE_ID`, demo default `HU00000000KEZJEGY1` [OWNER: Somosi Kft. adószám]), `softwareName` (brand name), `softwareOperation=ONLINE_SERVICE`, `softwareMainVersion`, `softwareDevName` ("Somosi Kft."), `softwareDevContact` (e-mail), `softwareDevCountryCode=HU`, `softwareDevTaxNumber`.
- Unit tests: password hash and requestSignature against known vectors (compute with an independent implementation in the test, e.g. Python `hashlib.sha3_512`, and hard-code the expected strings).

### 8.3 Operations used
- `queryInvoiceDigest`: `page` (1-based), `invoiceDirection=OUTBOUND` (INBOUND supported but unused now), `invoiceQueryParams/mandatoryQueryParams` one of `invoiceIssueDate{dateFrom,dateTo}` or `insDate{dateTimeFrom,dateTimeTo}` – **max 35 days per request**; response `currentPage`, `availablePage`, `invoiceDigest[]` (invoiceNumber, batchIndex, invoiceOperation, invoiceCategory, invoiceIssueDate, supplier/customer tax number + name, paymentMethod, paymentDate, invoiceAppearance, source, invoiceDeliveryDate, currency, invoiceNetAmount(HUF), invoiceVatAmount(HUF), transactionId, index, originalInvoiceNumber, modificationIndex, insDate, completenessIndicator).
- `queryInvoiceData`: `invoiceNumberQuery{ invoiceNumber, invoiceDirection, batchIndex?, supplierTaxNumber? }` → `invoiceDataResult{ invoiceData (base64), auditData, compressedContentIndicator }`; if compressed → gunzip; parse `InvoiceData` XML (invoiceData.xsd) → normalized model.
- `queryTaxpayer` with the client's own tax number → "Kapcsolat ellenőrzése" in the panel.
- Iterator `syncOutbound({ since: insDate | null, year })`: first run = issue-date windows of ≤ 35 days from 1 Jan of the current year (and previous year if `asOf` ≤ 31 Jan); later runs = `insDate` window from `sync_cursor_ins_date − 1 day` to now; fetch data only for digests not yet stored.

### 8.4 Error mapping (Hungarian message for the panel)
`INVALID_SECURITY_USER` → "Hibás technikai felhasználónév vagy jelszó." · `INVALID_REQUEST_SIGNATURE` → "Hibás XML aláírókulcs." · `FORBIDDEN` / `NOT_REGISTERED_CUSTOMER` / `INVALID_CUSTOMER` → "Ehhez a technikai felhasználóhoz nincs lekérdezési jog, vagy nem ehhez az adószámhoz tartozik." · `REQUEST_ID_NOT_UNIQUE` → retry with a new id · `INVALID_REQUEST`, `SCHEMA_VIOLATION` → bug, alert · maintenance / `OPERATION_FAILED` / 5xx → "A NAV rendszere most nem érhető el, később újrapróbáljuk." Unknown codes keep the raw `errorCode` in `last_sync_error`.

### 8.5 Contract (exported from `@kezjegy/nav-kliens`)
```ts
export interface NavCredentials { login: string; password: string; signatureKey: string; exchangeKey?: string; taxNumber: string /*8 digits*/ }
export interface NavSoftware { softwareId: string; softwareName: string; softwareMainVersion: string; softwareDevName: string;
  softwareDevContact: string; softwareDevCountryCode?: string; softwareDevTaxNumber?: string }
export type NavEnvironment = 'demo' | 'test' | 'prod';
export interface InvoiceDigest { invoiceNumber: string; batchIndex?: number; operation: 'CREATE'|'MODIFY'|'STORNO'; category: string;
  issueDate: string; deliveryDate?: string; paymentDate?: string; paymentMethod?: string; currency: string;
  netAmountHuf: number; vatAmountHuf: number; supplierTaxNumber: string; customerName?: string; customerTaxNumber?: string;
  originalInvoiceNumber?: string; modificationIndex?: number; insDate: string; transactionId?: string; source?: string; completeness?: boolean }
export interface NormalizedInvoice extends InvoiceDigest { grossAmountHuf: number; exchangeRate?: number;
  customer: { name?: string; taxNumber?: string; vatStatus?: 'DOMESTIC'|'PRIVATE_PERSON'|'OTHER' };
  lines: { lineNo: number; description?: string; quantity?: number; unit?: string; unitPriceHuf?: number; netAmountHuf: number;
           vatExemption?: { case: string; reason: string } }[] }
export class NavError extends Error { code: string; funcCode?: string; retryable: boolean; httpStatus?: number; messageHu: string }
export interface NavClient {
  queryInvoiceDigest(p: { direction: 'OUTBOUND'|'INBOUND'; page: number; issueDate?: {from: string; to: string}; insDate?: {from: string; to: string} }):
    Promise<{ currentPage: number; availablePage: number; digests: InvoiceDigest[] }>;
  queryInvoiceData(p: { invoiceNumber: string; direction: 'OUTBOUND'|'INBOUND'; batchIndex?: number; supplierTaxNumber?: string }):
    Promise<{ invoice: NormalizedInvoice; rawXml: string; insDate?: string }>;
  queryTaxpayer(taxNumber: string): Promise<{ valid: boolean; name?: string }>;
  syncOutbound(p: { since: string | null; asOf: string }): AsyncIterable<{ digest: InvoiceDigest; data: () => Promise<{ invoice: NormalizedInvoice; rawXml: string }> }>;
}
export function createNavClient(o: { environment: NavEnvironment; credentials: NavCredentials; software: NavSoftware;
  transport?: Transport; minIntervalMs?: number; timeoutMs?: number; now?: () => Date }): NavClient;
export function passwordHash(password: string): string;            // UPPER SHA-512 hex
export function requestSignature(requestId: string, timestampIso: string, signatureKey: string): string; // UPPER SHA3-512 hex
export function createDemoTransport(fixtures: DemoFixtures): Transport;  // in-process mock speaking the same XML
export function startMockServer(o: { port: number; fixtures: DemoFixtures }): Promise<{ close(): Promise<void> }>;
```
**Mock / DEMO**: implements the same XML contract (validates header shape, recomputes and checks `passwordHash`/`requestSignature` against fixture credentials — any credentials are accepted in demo but must be well-formed and self-consistent), pages of 100, gzip+base64 invoice data. Fixtures: `kod/shared/demo/fixtures.json → navInvoices[taxNumber8]` (Kata, Réka, Péter; fixture invoices have no `insDate` → use `issueDate + "T10:00:00Z"`; only invoices with `issueDate ≤ asOf` exist). For any other tax number it generates deterministic fake invoices (seeded by the tax number: 2–4 per month Jan → asOf, 80 000–450 000 Ft, fictional customers) so a newly registered QA client also gets data. Every demo invoice carries `source: 'DEMO'`; the UI shows a "MINTA" label.

### 8.6 How the technical user is obtained (operational, shown in the panel help)
The accountant, as the client's **állandó meghatalmazott**, can act as **elsődleges felhasználó** for the client in the Online Számla web UI (`onlineszamla.nav.gov.hu`), create a **technical user** with the right to query submitted invoice data, and generate the **XML aláírókulcs** and **XML cserekulcs**. He enters login, password, signing key, exchange key and the client's tax number in the panel ("NAV-kapcsolat"). Test-environment users/keys (`onlineszamla-test.nav.gov.hu`) do not work in production and vice versa. [OWNER/KÖNYVELŐ: test registration of the Kft. / accountant in the NAV test system.]

---

## 9. SimplePay recurring subscription

Docs: SimplePay Online Payment **API v2.1** general doc and **card storage (oneclick/recurring) doc** (simplepartner.hu downloads, §25). Sandbox base `https://sandbox.simplepay.hu/payment/v2/`, live `https://secure.simplepay.hu/payment/v2/`.

### 9.1 Protocol
- POST JSON, UTF-8, `Content-Type: application/json`; header **`Signature: base64(HMAC-SHA384(SECRET_KEY, rawBody))`** on every request and response; verify response signatures; always include `salt` (32 random chars), `merchant`, `orderRef`, `currency: "HUF"`, `sdkVersion: "Kezjegy_Node_1.0"`. Amounts integer for HUF. Times ISO 8601 with offset. Ignore unknown response fields. `errorCodes[]` on failure.
- Statuses: `INIT, TIMEOUT, CANCELLED, NOTAUTHORIZED, INPAYMENT, INFRAUD, AUTHORIZED, FRAUD, REVERSED, REFUND, FINISHED`. Back events: `SUCCESS, FAIL, CANCEL, TIMEOUT`. Only IPN `FINISHED` (or `query` returning FINISHED) changes money state.

### 9.2 Card registration + first month (one-step recurring registration)
Preconditions: user is registered and logged in (SimplePay forbids card storage for guests); the client explicitly accepted (checkboxes, stored as consents) the **Adattovábbítási nyilatkozat** and the **Ismétlődő bankkártyás fizetés nyilatkozat** (SimplePay's mandatory texts, filled with Somosi Kft. data and the service URL/app name); the screen states token parameters in plain words: "12 alkalommal, legfeljebb 19 999 Ft, 2027. november 17-ig vonhatunk le a kártyádról. Bármikor törölheted a kártyádat a Fiók oldalon."
`POST /start` body: `merchant, orderRef, customer (name), customerEmail, language "HU", currency, total 19999, methods ["CARD"], salt, sdkVersion, threeDSReqAuthMethod "02" ("05" if the account was created with Google/Apple), invoice { name, country "HU", state, city, zip, address }, timeout (now + 30 min), url = API_PUBLIC_URL/api/v1/payments/simplepay/back?p=app|web, recurring { times: SIMPLEPAY_RECURRING_TIMES (default 12, max 24), until: now + 12 months, maxAmount: 19999 }`.
Response: `transactionId, paymentUrl, tokens[]` → store tokens encrypted as `fuggo`; return `paymentUrl` to the app, which opens it with `expo-web-browser` (`openAuthSessionAsync`, return URL `kezjegy://elofizetes`) or same tab on web.
IPN `FINISHED` (with `cardMask`, `expiry`) → tokens `aktiv`, `card_registrations.status='aktiv'`, `tokens_until = min(until, card expiry)`, subscription `active`, `current_period = [today, today + 1 month)`, `next_charge_at = period end 09:00 Europe/Budapest`, fee invoice issued (§11.5), onboarding step `elofizetes = kesz`.

### 9.3 Monthly charge (`dorecurring`, worker §15)
For each subscription with `next_charge_at ≤ now`, `status ∈ {active, past_due}`, not `cancel_at_period_end`: pick an `aktiv` token → `POST /dorecurring` with `orderRef` (new), `token`, `type: "MIT"`, `threeDSReqAuthMethod`, `total 19999`, `customerEmail`, `customer`, `invoice`, `methods ["CARD"]`. Synchronous response → wait for IPN. Success → token `felhasznalt`, period +1 month, fee invoice. Failure (errorCodes, NOTAUTHORIZED; a 3DS challenge cannot be completed without the customer) → token stays reusable (unsuccessful payment does not consume it), `failed_attempts++`, retries +1/+3/+7 days, notify client "Nem sikerült levonni a havidíjat" with "Kártya cseréje" (= new registration start which charges the due month). ≥ 14 days unpaid → `suspended`. No tokens left / tokens expire within 30 days / card expires → `subscription.renewal_needed` notification; renewal = new registration start charging the next month.
Missed IPN safety: worker calls `/query` for transactions without final status after 1 h.

### 9.4 IPN endpoint `POST /api/v1/webhooks/simplepay/ipn`
Read raw body bytes → verify `Signature` (constant-time compare) and `merchant` → parse → idempotent upsert by `orderRef`/`transactionId` → **respond HTTP 200 with the received JSON plus `"receiveDate": "<ISO now>"`, header `Signature` computed over the response body**, within 20 s (process async if needed). Invalid signature → 400, nothing stored except an audit row. SimplePay retries for up to 3 days if we do not answer correctly.

### 9.5 Back URL `GET /api/v1/payments/simplepay/back?p=…&r=…&s=…`
Decode `r` (base64 JSON `{r,t,e,m,o}`), verify `s` (signature of the decoded JSON); never change money state here; redirect 302 to `kezjegy://elofizetes/eredmeny?e=SUCCESS&t=…` (p=app) or `APP_PUBLIC_URL/fiok/elofizetes?eredmeny=SUCCESS&t=…` (p=web). The result screen shows the SimplePay transaction id and the required texts: success "Sikeres tranzakció. SimplePay tranzakcióazonosító: …"; fail "Sikertelen tranzakció. SimplePay tranzakcióazonosító: … Kérjük, ellenőrizd a tranzakció során megadott adatok helyességét. Amennyiben minden adatot helyesen adtál meg, a visszautasítás okának kivizsgálása érdekében vedd fel a kapcsolatot kártyakibocsátó bankoddal."; cancel "Megszakítottad a fizetést, vagy lejárt a tranzakció maximális ideje." (jogi builder finalises).

### 9.6 Cancel, card deletion, other calls
- Cancel subscription: `cancel_at_period_end = true`, no more `dorecurring`; at period end `canceled`, unused tokens `tokencancel`.
- **Card deletion must be possible from the profile at any time without conditions** (SimplePay rule) → `POST /cardcancel { cardId }` (cardId = registration transactionId) → all tokens inactive.
- `tokenquery`, `cardquery` used by the admin "Kártya állapota" action. Refunds [NEM MA] (admin does it in the SimplePay merchant admin).
- SimplePay logo + "Fizetési tájékoztató" link must appear near the payment button [OWNER: download the logo pack after contracting; until then a text link].
- Requirements to remember: TLS 1.2+ with a real certificate (Caddy ✓); IPN URL is set in the merchant admin ("Technikai adatok") = `https://api.<domain>/api/v1/webhooks/simplepay/ipn` [OWNER]; the contract needs the real domain/app name [OWNER]; the sandbox test checklist ("Testing" chapter) must pass before go-live [OWNER].

### 9.7 DEMO
`SIMPLEPAY_MODE=demo` (default when merchant/secret are missing **and** `APP_ENV=demo`): `/start` returns `paymentUrl = API_PUBLIC_URL/api/v1/payments/demo/pay?o=<orderRef>` – a server-rendered page with a big "DEMO FIZETÉS – nem valódi kártya, nem vonunk le pénzt" banner, the token parameters, and buttons "Sikeres fizetés szimulálása" / "Sikertelen fizetés szimulálása". The buttons call the **same IPN handler code** with a body signed by `SIMPLEPAY_DEMO_SECRET` (random per deploy), then redirect like the back URL. Demo tokens are random `DEMO…` strings; `dorecurring` in demo succeeds unless the client's e-mail starts with `fail+`. All demo rows have `mode='demo'` and the UI shows a "DEMO" label on subscription and fee invoice screens. In `APP_ENV=production` with missing keys: `/client/subscription/start` → 503 `not_configured` ("A kártyás fizetés még nincs bekapcsolva.").

---

## 10. Authorisation to NAV, AVDH status, identification (Pmt.)

### 10.1 What changed (researched 2026-11-17)
- The **standalone AVDH service ended 31 Dec 2024**; AVDH inside ePapír was available only until **31 Oct 2025** (Kormányhivatalok notice, §25). **AVDH is not available in 2026.** FUNKCIOK 4 ("aláírás AVDH-val") therefore becomes the flow below. [OWNER informed; JOGI to confirm.]
- The NAV permanent authorisation (állandó meghatalmazás) is registered on **UJEGYKE**. NAV's own FAQ: (a) the **meghatalmazó files it himself in ONYA** (onya.nav.gov.hu, KAÜ login with Ügyfélkapu+ or DÁP): "Meghatalmazások" → UJEGYKE → "Meghatalmazó" → no document needs to be attached; (b) the **meghatalmazott files it** and the meghatalmazó must **approve it in ONYA within 4 calendar days** of the notification; (c) paper only for those not obliged to e-communicate – sole traders are obliged, so not for our clients.
- **DÁP eAláírás** (Digitális Állampolgár app; web signing via QR since 2025/2026) gives a qualified signature producing a fully evidential private document, PDF only, ≤ 30 MB; **only for private persons for private purposes – DÁP states that sole traders may not use it to sign on behalf of their business.** Therefore it is only an optional, lawyer-gated path.

### 10.2 Flow in the app (step `meghatalmazas`, screen B5)
1. **Recommended – "Bejelentem az ONYA-ban" (method `onya_ugyfel`)**: step list with copy buttons: open onya.nav.gov.hu → log in (Ügyfélkapu+ / DÁP) → choose the profile of your adóazonosító jel → Meghatalmazások → UJEGYKE → Meghatalmazó → meghatalmazott: **{accountant.displayName}**, adóazonosító jel **{accountant adóazonosító jel}** (copy) → ügykörök: as listed by `kod/jogi/nav_meghatalmazas.md` [JOGI/KÖNYVELŐ] → Ellenőrzés és benyújtás. Then "Beküldtem" (optional: upload the ONYA confirmation PDF/screenshot). Status `konyvelore_var` → the accountant verifies at NAV → `kesz`.
2. **"{firstName} küldi be, én jóváhagyom" (method `onya_konyvelo`)**: the accountant files; the client gets an in-app task "Hagyd jóvá az ONYA-ban 4 napon belül" with the same login steps → "Jóváhagytam".
3. **Optional signed PDF (method `alairt_pdf`)** – only if the accountant switches it on for a client [JOGI]: download the prefilled PDF (§21), sign it with DÁP eAláírás (dap.gov.hu/ugyintezes/digitalis-alairas → QR → aláírásjelszó → download the signed PDF) or another qualified e-signature, upload. Backend checks it is a PDF containing a signature dictionary (`/ByteRange` + `/Contents`) and stores it; the accountant validates the signature (e.g. in a PDF reader / the government signature checker) and accepts. No cryptographic validation in the backend tonight.
4. The **megbízási szerződés with Somosi Kft.** is concluded electronically in the app (checkbox acceptance of the current version, consent row with timestamp, PDF copy e-mailed and stored in the dossier as `szerzodes_alairt`) [JOGI: confirm sufficiency].
Copy change vs design 02: "Aláírtad a meghatalmazást, hétfőn, Ügyfélkapuval" → "Bejelentetted {firstName}-t a NAV-nál, hétfőn, az ONYA-ban".

### 10.3 Identification (step `azonositas`, screen B6; FUNKCIOK 5)
- Uploads (camera with card frame, or file): személyi igazolvány front + back, lakcímkártya front + back (address side). Images are converted to JPEG ≤ 2 400 px on the long side client-side, encrypted at rest, KYC files visible to the assigned accountant only.
- Data form (Pmt. 7. § (2) for natural persons): családi és utónév, születési családi és utónév, anyja születési neve, születési hely és idő, állampolgárság, lakcím, okmány típusa és száma (+ lejárat). Stored in `kyc_records.data_enc`.
- Declarations (texts from `kod/jogi/pmt_nyilatkozatok.md`): "A saját nevemben járok el" (tényleges tulajdonos, Pmt. 8–9. §), kiemelt közszereplő nyilatkozat (Pmt. 9. §, yes/no + details), truthfulness, change-notification duty (5 munkanap).
- The accountant reviews (side-by-side viewer) → `elfogadva` / `hianyos` (+ note). [JOGI/KÖNYVELŐ]: whether photo upload without personal presence or audited video meets the accountant's Pmt. duties; the optional call (§6.1 `idopont`) can be used for it. Retention 8 years after the relationship ends.

---

## 11. Other integrations

### 11.1 E-mail (Brevo SMTP)
`nodemailer` SMTP (`SMTP_HOST=smtp-relay.brevo.com`, port 587 STARTTLS). Plain-text + simple HTML (Geist fallback fonts, ink-blue header line, no images except optional logo). Templates from `content_texts` keys `email.<kind>.subject|body`. `MAIL_MODE=demo` when SMTP vars are missing: write to `demo_outbox` (masked recipient), log "mail not sent (DEMO)". Production with missing SMTP → `not_configured` on flows that need mail (register still works but shows "Az e-mail-küldés még nincs beállítva" to staff). [OWNER: Brevo account + sender domain DKIM/SPF.]

### 11.2 Push (Expo)
`expo-notifications` tokens (`ExponentPushToken[…]`) → `push_tokens`. Sending via `https://exp.host/--/api/v2/push/send` (batch ≤ 100), handle receipts (`DeviceNotRegistered` → disable token). `PUSH_MODE=demo` (default until an EAS project + FCM credentials exist [OWNER]) → store and show in-app only, log "push not sent (DEMO)". In-app notifications always work.

### 11.3 Google sign-in
App: native Google sign-in (ID token, `webClientId` = Google web client id) on Android/iOS, Google Identity Services button on web. Backend `POST /auth/google { idToken }`. Without `GOOGLE_CLIENT_IDS` the backend answers 503 `not_configured` and `/config` says `googleSignIn:false` → buttons hidden. [OWNER: Google Cloud OAuth clients (web, Android with SHA-1 of the signing key, iOS).]

### 11.4 Apple sign-in (iOS only)
`expo-apple-authentication` → `POST /auth/apple { identityToken, fullName? }`. Button only when `Platform.OS === 'ios'` and `/config.appleSignIn`. [OWNER: Apple developer account, bundle id.]

### 11.5 Fee invoices (FUNKCIOK 3 "automatikus számla a díjról")
Interface `FeeInvoiceProvider { issue(tx, client): Promise<{ number, pdf: Buffer, externalId }> }`. Tonight only **DEMO provider**: PDF (pdf-lib, Geist) titled "DEMO DÍJBEKÉRŐ – NEM SZÁMLA", number `DEMO-2026-000123`, stored as file kind `dijszamla`. Real provider (Számlázz.hu Agent API or Billingo API v3) [OWNER: choose + key; Somosi Kft. VAT status decides net/VAT split of the 19 999 Ft gross]. Production without provider → payment still recorded, fee invoice row `status='hiba'` + admin alert (no fake invoice).

### 11.6 NAV
See §8. `NAV_MODE=demo|test|prod`.

### 11.7 Calendar
`GET /client/appointments/:id/ics` and `GET /client/deadlines/:id/ics` return `text/calendar` (RFC 5545, `Europe/Budapest`) for "Naptárba teszem".

---

## 12. REST API (`/api/v1`)

Auth column: `—` public, `C` client, `A` accountant (assigned clients only), `AD` admin. All bodies JSON unless "multipart". Shared DTO types live in `kod/shared/src/api.ts` (names in **bold** below).

### 12.1 Public / system
| Method path | Auth | Request → Response |
|---|---|---|
| `GET /health` | — | → `{ ok, version, db: 'ok'\|'hiba', appEnv, modes: { nav, simplepay, mail, push, invoice }, googleSignIn, appleSignIn }` (no secrets) |
| `GET /config` | — | → **PublicConfig** `{ brand: {name, tagline, subline, priceHufMonthlyGross}, appEnv, demo: boolean, features: { googleSignIn, appleSignIn, totp: true }, googleClientIds: { web?, android?, ios? }, legal: { aszf: version, adatkezeles: version, megbizasi_szerzodes: version, simplepay_adattovabbitas: version, simplepay_ismetlodo: version }, simplepayMode }` |
| `GET /legal/:docType` | — | → `{ docType, version, title, markdown }` |
| `GET /content/faq` | — | → `{ items: [{ id, question, answer }] }` |
| `POST /webhooks/simplepay/ipn` | signature | §9.4 |
| `GET /payments/simplepay/back` | — | §9.5 (302) |
| `GET /payments/demo/pay` · `POST /payments/demo/pay` | — (demo only, else 404) | §9.7 |

### 12.2 Auth (`/auth`)
| Method path | Auth | Request → Response |
|---|---|---|
| `POST /auth/register` | — | `{ email, password, firstName, lastName, referralCode?, utm?: {source,medium,campaign,content}, platform }` → 201 **AuthResult** (role client; `emailVerified:false`; verify code e-mailed) |
| `POST /auth/email/verify` | C | `{ code }` → `{ emailVerified: true }` |
| `POST /auth/email/resend` | C | → 204 |
| `POST /auth/login` | — | `{ email, password, clientKind: 'native'\|'web'\|'panel' }` → **AuthResult** or 401 `mfa_required` `{ mfaToken }` |
| `POST /auth/login/totp` | — | `{ mfaToken, code }` (code may be a recovery code) → **AuthResult** |
| `POST /auth/google` | — | `{ idToken, clientKind, referralCode?, utm? }` → **AuthResult** (`isNewUser`) |
| `POST /auth/apple` | — | `{ identityToken, fullName?: {givenName, familyName}, clientKind, referralCode? }` → **AuthResult** |
| `POST /auth/refresh` | refresh | native `{ refreshToken }` / web cookie + `X-Kezjegy: 1` → **AuthResult** |
| `POST /auth/logout` | C/A/AD | → 204 (revokes this session) |
| `POST /auth/logout-all` | C/A/AD | → 204 |
| `POST /auth/password/forgot` | — | `{ email }` → 202 always |
| `POST /auth/password/reset` | — | `{ email, code, newPassword }` → 204 (revokes all sessions) |
| `POST /auth/password/change` | C/A/AD | `{ currentPassword, newPassword }` → 204 |
| `POST /auth/totp/setup` | C/A/AD | → `{ secret, otpauthUrl }` (pending until enabled) |
| `POST /auth/totp/enable` | C/A/AD | `{ code }` → `{ recoveryCodes: string[10] }` (shown once) |
| `POST /auth/totp/disable` | C/A/AD | `{ password?, code }` → 204 |
| `GET /auth/sessions` · `DELETE /auth/sessions/:id` | C/A/AD | list `{ id, clientKind, userAgent, lastUsedAt, current }` / revoke |

**AuthResult** = `{ accessToken, accessTokenExpiresAt, refreshToken? (native only), user: { id, email, role, displayName, emailVerified, totpEnabled }, isNewUser? }`.

### 12.3 Me (`/me`) – all roles
| Method path | Request → Response |
|---|---|
| `GET /me` | → **Me** `{ user, client?: ClientSummary, accountant?: AccountantPublic, staffAccountantId?, notificationPrefs, consentsNeeded: LegalDocType[] }` |
| `PATCH /me` | `{ displayName?, notificationPrefs?: [{kind, push, email}] }` |
| `POST /me/push-tokens` | `{ token, platform }` → 204 · `DELETE /me/push-tokens/:token` |
| `GET /me/notifications?cursor` | → page of **NotificationItem** · `POST /me/notifications/read { ids? \| all: true }` |
| `POST /me/consents` | `{ items: [{ docType, version }] }` → 204 |
| `POST /me/export` | → 202 `{ exportId }` · `GET /me/exports` · `GET /me/exports/:id/download` (zip stream) |
| `POST /me/delete` | `{ password? , totpCode? , reason? }` → 202 `{ deletionDueAt }` · `POST /me/delete/cancel` |

### 12.4 Client (`/client`) – role `client`, own data only
**Onboarding**
| Method path | Request → Response |
|---|---|
| `GET /client/onboarding` | → **OnboardingState** `{ steps: [{ step, status, note?, completedAt? }], milestones: [{ key, label, done, current, sub? }], todoCount, accountant: AccountantPublic, appointmentsEnabled, meghatalmazasMethods: ['onya_ugyfel','onya_konyvelo','alairt_pdf'?] }` |
| `PUT /client/profile` | **ClientProfileInput** `{ firstName, lastName, phone?, adoazonositoJel, adoszam, evNyilvantartasiSzam?, address: {zip, city, line}, hqMunicipality, activityText, activityAnswer: 'kiskereskedelem'\|'lista80'\|'egyeb', taxStatus, evSince, previousAccountant?, hasSeparateBusinessAccount }` → **ClientProfile** (validates adószám/adóazonosító check digits) |
| `GET /client/profile` | → **ClientProfile** (adóazonosító masked `•••••••456`) |
| `GET /client/legal-pdf/:docType` | → PDF prefilled with client data (`megbizasi_szerzodes`, `nav_meghatalmazas`) |
| `POST /client/onboarding/meghatalmazas` | `{ method, fileId? }` → **OnboardingState** |
| `POST /client/kyc` | multipart: `idFront, idBack, addressFront, addressBack` (images/PDF) + `data` JSON (Pmt. fields) + `declarations` JSON → `{ status: 'bekuldve' }` |
| `GET /client/kyc` | → `{ status, reviewNote? }` (never returns the data back) |

**Home, tax, revenue**
| Method path | Request → Response |
|---|---|
| `GET /client/home` | → **ClientHome** (below) |
| `GET /client/tax-periods?year=` | → `{ items: TaxPeriodSummary[] }` |
| `GET /client/tax-periods/:id` | → **TaxPeriodDetail** (items, explanation, letter, filing docs) |
| `POST /client/tax-periods/:id/mark-paid` | `{ kinds?: PaymentItemKind[] (default all), paidOn: 'YYYY-MM-DD' }` → **TaxPeriodDetail** |
| `POST /client/tax-periods/:id/unmark-paid` | `{ kinds? }` → **TaxPeriodDetail** |
| `GET /client/revenue?year=` | → `{ year, byMonth: [{month, amountHuf, estimated}], totalHuf, meters }` |

**ClientHome** =
```ts
{ today: string; demo: boolean;
  client: { id: string; firstName: string; lifecycle: ClientLifecycle; onboardingComplete: boolean };
  accountant: AccountantPublic; // { id, displayName, firstName, nameForms: {with, from, onto, acc}, title, registrationNumber, avatarKey, signatureSvgPath, responseTimeText }
  hero: { state: 'bekotes_alatt'|'becsles'|'jovahagyva'|'befizetve'|'nincs_fizetendo'; periodId?: string; periodKey?: string;
          periodLabel?: string /* "III. negyedév" */; amountHuf?: number; dueDate?: string; daysLeft?: number;
          paidOn?: string; verified?: boolean; note?: string };
  letter: { greeting: string; body: string; signedBy: string; signedRole: string; date: string } | null;
  paymentItems: PaymentItem[];      // { id, kind, label, sublabel?, amountHuf, dueDate, accountName, accountNumber, iban, reference, markedPaidAt?, verifiedAt? }
  requestsFromAccountant: RequestSummary[];
  limits: { afa: Meter; atalanyCap: Meter; adomentes: { reached: boolean; reachedMonth: number|null; limitHuf: number; sentence: string } };
  revenueByMonth: { month: number; amountHuf: number }[];
  currentDossier: { month: string; label: string /* "Novemberi dosszié" */; items: DocumentListItem[]; totalCount: number };
  nextDeadline: Deadline | null }
```
Hero logic: the latest period with `calc_status='jovahagyva'` and payment not `ellenorizve` → `jovahagyva` (or `befizetve` if marked); otherwise the current quarter estimate → `becsles` ("Eddig ennyi gyűlt össze – {firstName} a negyedév végén véglegesíti"); onboarding incomplete → `bekotes_alatt`.

**Dossier and documents**
| Method path | Request → Response |
|---|---|
| `GET /client/dossiers?year=` | → `{ months: [{ month, label, documentCount, waitingCount, navInvoiceCount }] }` |
| `GET /client/dossiers/:month` | → **DossierView** `{ month, label, headline, review?: { by: AccountantPublic, at, okCount, note }, sentByMe: DocumentListItem[], fromNav: { invoices: { count, status, statusAt, totalHuf }, letters: DocumentListItem[] }, filedByAccountant: DocumentListItem[], openRequests: RequestSummary[] }` |
| `GET /client/documents/:id` | → **DocumentDetail** `{ ...DocumentListItem, versions: [{ id, versionNo, fileId, pageCount, createdAt }], history: [{ status, label, at, by? }], accountantComment?, clientNote?, amountHuf?, documentDate?, relatedRevenueMonth? }` |
| `POST /client/documents` | multipart: `pages[]` (1–20 images) **or** `file` (PDF/image), `category`, `dossierMonth`, `title?`, `note?`, `requestId?` → 201 **DocumentDetail** |
| `POST /client/documents/:id/versions` | multipart same → **DocumentDetail** |
| `DELETE /client/documents/:id` | → 204 (only `feltoltve`; soft delete) |
| `GET /client/nav-invoices?month=` | → `{ items: NavInvoiceListItem[] }` (`{ id, invoiceNumber, issueDate, customerName, grossAmountHuf, status, demo }`) |
| `GET /client/nav-invoices/:id` | → **NavInvoiceDetail** (normalized invoice) |
| `POST /files/:id/link` | C/A → `{ url, expiresAt }` (5-min HMAC-signed URL, for `<img>`/download in web) |
| `GET /files/:id` | C/A (Bearer or `?sig=&exp=`) → decrypted stream, `Content-Type`, `Content-Disposition` |

**Messages, requests, certificates**
| Method path | Request → Response |
|---|---|
| `GET /client/messages?cursor&limit` | → page of **Message** `{ id, kind, body, sender: 'en'\|'konyvelo'\|'rendszer', createdAt, attachments: [{fileId, displayName, mime}], request?: RequestSummary, document?: DocumentListItem, readByAccountantAt? }` (newest first) |
| `POST /client/messages` | `{ body, fileIds?: string[], documentId? }` → **Message** |
| `POST /client/attachments` | multipart `file` → `{ fileId }` (kind `uzenet_csatolmany`) |
| `POST /client/messages/read` | `{ upToId }` → 204 |
| `GET /client/requests?status=` | → `{ items: RequestSummary[] }` (`{ id, direction, type, title, body, status, statusLabel, dueDate?, createdAt, certificate? }`) |
| `POST /client/requests` | `{ type, body, title?, certificate?: { certificateType, year?, purpose, language? } }` → **RequestSummary** (also posts a `keres_kartya` message) |
| `POST /client/requests/:id/complete` | `{ documentIds?: string[], note? }` → **RequestSummary** (for accountant→client requests) |
| `POST /client/requests/:id/cancel` | → **RequestSummary** |

**Deadlines, appointments**
| Method path | Request → Response |
|---|---|
| `GET /client/deadlines?from&to` | → `{ items: Deadline[] }` (`{ id, kind, title, dueDate, daysLeft, amountHuf?, status: 'kesz'\|'nyitott'\|'lejart', link }`) |
| `GET /client/deadlines/:id/ics` | → `text/calendar` |
| `GET /client/appointments/slots` | → `{ enabled, slots: [{ id, startsAt, endsAt, channels }] }` (404-free: `enabled:false` when off) |
| `POST /client/appointments` | `{ slotId, channel, phone?, topic? }` → **Appointment** |
| `GET /client/appointments` · `POST /client/appointments/:id/cancel` · `GET /client/appointments/:id/ics` | |

**Subscription and fees**
| Method path | Request → Response |
|---|---|
| `GET /client/subscription` | → **SubscriptionView** `{ status, mode, priceHuf, currentPeriodEnd?, nextChargeAt?, cancelAtPeriodEnd, card?: { mask, expiry, tokensLeft, tokensUntil }, failedAttempts, graceUntil? }` |
| `POST /client/subscription/start` | `{ platform: 'app'\|'web', acceptedDeclarations: true }` → `{ paymentUrl, orderRef, tokenInfo: { times, maxAmountHuf, until } }` (409 if already active) |
| `POST /client/subscription/cancel` · `POST /client/subscription/resume` | → **SubscriptionView** |
| `POST /client/subscription/card/delete` | → **SubscriptionView** (SimplePay `cardcancel`) |
| `GET /client/fee-invoices` | → `{ items: [{ id, number, issuedOn, amountHuf, demo, fileId }] }` |

### 12.5 Accountant (`/acc`) – role `accountant`, assigned clients only
| Method path | Request → Response |
|---|---|
| `GET /acc/clients?filter=bekotes_alatt\|rendben\|hianyzik_valami\|hatar_kozel\|dij_elmaradt\|mind&q=` | → `{ items: AccClientRow[], counts: Record<filter, number> }`; row `{ id, name, lifecycle, flags[], nextDeadline?, openRequestsFromClient, openRequestsToClient, waitingDocuments, lastUploadAt?, afaRatio, subscriptionStatus, onboardingMilestone }` |
| `GET /acc/clients/:id` | → **AccClientDetail** (profile incl. full adóazonosító (audited), tax profile, onboarding, subscription summary, flags, NAV connection status, meters) |
| `PATCH /acc/clients/:id/tax-profile` | `{ year, costRatio?, status?, guaranteedMinimum?, insuranceBreaks?, hipa?, priorOverrides?, activityCode? }` → triggers recalculation |
| `POST /acc/clients/:id/onboarding/:step` | `{ status: 'kesz'\|'hianyos'\|'kihagyva', note? }` |
| `GET /acc/clients/:id/kyc` | → `{ status, data, declarations, files: { idFront, … } }` (audit `kyc.viewed`) · `POST /acc/clients/:id/kyc/review { status, note? }` |
| `PUT /acc/clients/:id/nav-credentials` | `{ login, password, signatureKey, exchangeKey?, taxNumber }` → `{ status, loginHint, savedAt }` (write-only; never returned) · `DELETE` · `POST …/test` → `{ ok, messageHu }` · `POST /acc/clients/:id/nav-sync` → `{ runId }` · `GET /acc/clients/:id/nav-sync-runs` |
| `GET /acc/clients/:id/dossiers/:month` | → **AccDossierView** (all documents incl. `csak_konyvelo`, NAV invoices, revenue items of the month) |
| `GET /acc/documents/:id` | → **DocumentDetail** (+ sets `konyvelo_latta` if `feltoltve`) |
| `POST /acc/clients/:id/documents` | multipart `file`/`pages[]`, `category`, `dossierMonth`, `title`, `visibility`, `status?` |
| `PATCH /acc/documents/:id` | `{ status?, statusNote?, category?, title?, dossierMonth?, amountHuf?, documentDate?, accountantComment?, visibility? }` |
| `POST /acc/documents/bulk-status` | `{ ids, status, note? }` |
| `PATCH /acc/nav-invoices/:id` | `{ status }` · `POST /acc/clients/:id/nav-invoices/bulk-status { month, status }` |
| `GET /acc/clients/:id/revenue?year=` | → `{ items: RevenueItem[], byMonth, meters }` |
| `POST /acc/clients/:id/revenue-items` | `{ receivedOn, deliveryDate, amountHuf, description, documentId?, countsForAtalany?, countsForAfaLimit? }` · `PATCH /acc/revenue-items/:id` · `DELETE /acc/revenue-items/:id` (soft) |
| `GET /acc/clients/:id/tax-periods?year=` | → periods with latest calculation |
| `POST /acc/clients/:id/tax-periods/:periodKey/calculate` | `{ asOf? }` → **TaxCalculation** (new version, `becsles`) |
| `POST /acc/tax-calculations/:id/approve` | `{ overrides?: { tbHuf?, szochoHuf?, szjaAdvanceHuf?, reason }, letterText }` → **TaxPeriodDetail** (creates payment items, notifies client) |
| `POST /acc/tax-periods/:id/reopen` | `{ reason }` |
| `POST /acc/tax-periods/:id/verify-payment` | `{ items: [{ kind, verification: 'rendben'\|'elteres', note? }] }` |
| `POST /acc/tax-periods/:id/filed` | `{ filedOn, form: '2658', returnFileId, receiptFileId }` (files uploaded first via `POST /acc/clients/:id/documents`) |
| `GET /acc/requests?status&clientId&type` | → `{ items }` (queue; certificate requests included) |
| `POST /acc/clients/:id/requests` | `{ type: 'dokumentum'\|'adat'\|'egyeb', title, body, dueDate?, dossierMonth? }` |
| `PATCH /acc/requests/:id` | `{ status, statusNote?, resultDocumentId?, submittedToNavAt? }` |
| `GET /acc/clients/:id/messages` · `POST /acc/clients/:id/messages` | same shapes as client (sender `konyvelo`) · `POST /acc/attachments` |
| `GET/POST/PATCH/DELETE /acc/message-templates` | `{ title, body }` |
| `GET/POST /acc/clients/:id/notes` · `PATCH/DELETE /acc/notes/:id` | |
| `GET /acc/deadline-board?week=2026-W47` | → `{ week, days: [...], rows: [{ client, items: [{ kind, title, dueDate, status, overdue }] }], overdue: [...] }` |
| `GET /acc/appointments` · `POST /acc/availability` `{ slots: [{startsAt, endsAt, channels}] }` · `DELETE /acc/availability/:id` · `PATCH /acc/appointments/:id { status, videoLink?, note? }` | |
| `GET /acc/settings` · `PATCH /acc/settings` | `{ responseTimeText?, appointmentsEnabled?, monthlyStatementRequest? }` |
| `GET /acc/export/revenue.csv?year&clientIds?` | CSV (UTF-8 BOM, `;`, columns: ügyfél, adószám, sorszám, bevétel dátuma, teljesítés, számlaszám/bizonylat, vevő, összeg (Ft), forrás, becsült dátum) – FUNKCIOK 27; program-specific formats [KÖNYVELŐ] |
| `GET /acc/audit?clientId&cursor` | → audit rows for own clients |

### 12.6 Admin (`/admin`) – role `admin`
| Method path | Request → Response |
|---|---|
| `GET /admin/dashboard` | → `{ clients: { total, byLifecycle, newThisMonth }, funnel: { registered, onboardingStarted, subscribed, active }, mrrHuf, revenueByMonth: [{ month, amountHuf }], failedPayments: n, cancellationsThisMonth, accountants: [{ id, name, clients, openRequests, overdueItems }] }` |
| `GET /admin/clients?status&q&cursor` | business fields only (name, e-mail, lifecycle, accountant, subscription, source) |
| `PATCH /admin/clients/:id` | `{ accountantId?, lifecycle? }` (audit `admin.client_reassigned`) |
| `GET /admin/subscriptions?status` · `POST /admin/subscriptions/:id/retry` · `POST /admin/subscriptions/:id/cancel` | |
| `GET /admin/payments?status=failed\|finished&from&to` | SimplePay transactions |
| `GET /admin/accountants` · `POST /admin/accountants` `{ email, displayName, firstName, title, registrationNumber }` (sends staff invite code) · `PATCH /admin/accountants/:id` | |
| `GET/POST/PATCH /admin/referral-codes` · `GET /admin/attribution?from&to` → by source/medium/campaign/code with signups and paying clients | |
| `GET /admin/content-texts` · `PUT /admin/content-texts/:key { body }` (placeholders validated) | |
| `GET/POST/PATCH/DELETE /admin/faq` | |
| `GET /admin/audit?actor&action&clientId&from&to&cursor` | |
| `GET /admin/demo-outbox` | only `MAIL_MODE=demo`, else 404 |
| `GET /admin/system` | → integration modes, last NAV sync stats, worker heartbeat, backup age |

### 12.7 Upload rules
Allowed: `image/jpeg`, `image/png`, `image/heic` (converted to JPEG client-side where possible; server rejects HEIC it cannot read), `application/pdf`. Magic-byte check, not only the declared type. ≤ 25 MB/file, ≤ 20 pages per document. Images are stored as uploaded (no EXIF location: the app strips EXIF; the server strips GPS EXIF from JPEGs). Display names are sanitized (no path chars, ≤ 120).

---

## 13. Environment variables and DEMO behaviour

### 13.1 Rule
`APP_ENV=demo|production`. In `demo` every integration without keys runs its DEMO adapter (clearly labelled in UI and `/health`). In `production` an integration without keys is **disabled** (503 `not_configured`, UI says "még nincs bekapcsolva") – it never pretends to succeed. Tonight's deploy: `APP_ENV=demo`.

### 13.2 List (`/srv/kezjegy/.env`; template `kod/deploy/env.example` with comments, no values)
| Var | Used by | Default / DEMO |
|---|---|---|
| `APP_ENV` | all | `demo` |
| `NODE_ENV`, `PORT` | api | `production`, `8080` |
| `DATABASE_URL` / `POSTGRES_PASSWORD` | api, worker, db | generated at deploy |
| `APP_PUBLIC_URL`, `PANEL_PUBLIC_URL`, `API_PUBLIC_URL` | api (links, redirects, e-mails) | `https://app.45-94-65-74.sslip.io`, `https://konyvelo.…`, `https://api.…` |
| `JWT_SECRET`, `CODE_HMAC_SECRET`, `FILE_LINK_SECRET`, `AUDIT_IP_SALT` | api | 32 B random, generated |
| `FILE_ENC_KEY`, `FILE_ENC_KEY_ID` | api, worker | 32 B random, `1` |
| `APP_DATA_KEY` | api, worker | 32 B random |
| `NAV_CRED_KEY` | api, worker | 32 B random (separate!) |
| `FILES_DIR`, `LEGAL_DIR`, `FONT_DIR` | api, worker | `/data/files`, `/app/legal`, `/app/fonts` |
| `STAFF_TOTP_REQUIRED` | api | `false` [OWNER: true] |
| `MAIL_MODE` (derived), `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_REPLY_TO` | api, worker | empty → demo outbox |
| `GOOGLE_CLIENT_IDS` (comma: web, android, ios) | api, `/config` | empty → Google hidden |
| `APPLE_BUNDLE_ID` | api | empty → Apple hidden |
| `SIMPLEPAY_MODE` (`demo\|sandbox\|live`), `SIMPLEPAY_MERCHANT_HUF`, `SIMPLEPAY_SECRET_HUF`, `SIMPLEPAY_RECURRING_TIMES` (12), `SIMPLEPAY_TOKEN_VALID_MONTHS` (12), `SIMPLEPAY_DEMO_SECRET` | api, worker | demo |
| `PLAN_PRICE_HUF` | seed of `plans` | 19999 |
| `INVOICE_MODE` (`demo\|szamlazzhu\|billingo`), `SZAMLAZZHU_AGENT_KEY`, `BILLINGO_API_KEY` | worker | demo |
| `NAV_MODE` (`demo\|test\|prod`), `NAV_SOFTWARE_ID`, `NAV_SOFTWARE_VERSION`, `NAV_DEV_NAME`, `NAV_DEV_CONTACT`, `NAV_DEV_TAX_NUMBER`, `NAV_SYNC_HOUR` (5) | worker, api | demo, `HU00000000KEZJEGY1` |
| `PUSH_MODE` (`demo\|expo`), `EXPO_ACCESS_TOKEN` | worker | demo |
| `LOG_LEVEL` | all | `info` |
| `SEED_CREDENTIALS_FILE` | seed | `/run/seed/demo_belepesek.txt` (bind-mounted to `/srv/kezjegy/demo_belepesek.txt`, 600) |
App build-time (Expo): `EXPO_PUBLIC_API_URL` (`https://api.45-94-65-74.sslip.io/api/v1`; web build uses `/api/v1`), `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` (optional). Panel: none (same-origin).
The owner's key script `C:/Users/UpgradePC/konyvelo_app/kezjegy_kulcsok.ps1` (written by the integrator, §20.5) updates these.

---

## 14. Files and storage layout

Host `/srv/kezjegy/data/files` (owner `deploy`, mode 700) mounted at `/data/files` in api + worker.
```
/data/files/<clientId | _system>/<yyyy>/<mm>/<fileId>.kjf     encrypted blob (§4.4), never a user-supplied name
```
- Generated PDFs (contracts, meghatalmazás, demo fee invoices, GDPR exports) are files too (`kind` distinguishes).
- No public URLs. Serving only through `/files/:id` with auth checks.
- Thumbnails: first-page JPEG for multi-page photo documents (stored as a separate file id). PDFs get no server thumbnail (UI shows the `irat` 3D icon).
- Fonts for PDFs: `backend/fonts/Geist-Regular.ttf`, `Geist-SemiBold.ttf` (static instances from `@expo-google-fonts/geist` or generated from `app_v2/fontok/Geist_wght.ttf`), copied into the image at `/app/fonts`.
- Backups (§20.4) include `/srv/kezjegy/data/files` as-is (already encrypted) + DB dump.

---

## 15. Background jobs (`kezjegy-worker`)

Same image as the API, command `node dist/worker.js`. Single instance; each job takes a Postgres advisory lock. Times Europe/Budapest.
| When | Job |
|---|---|
| daily 05:30 | NAV sync for every client with `nav_credentials.status='rendben'` (serial, ≥ 1 s spacing) → store invoices + revenue items → recalc current-year estimates → flags |
| daily 06:00 | SimplePay: charge due subscriptions, retries, renewal reminders; `/query` for stale transactions |
| daily 08:00 | reminders: tax items due in 7/3/1 days and not marked paid; requests due tomorrow/overdue; KYC/meghatalmazás stuck > 3 days (to accountant) |
| hourly | appointment reminders 24 h / 1 h; push receipts |
| daily 03:30 | GDPR: build exports, execute due deletions, purge expired exports/demo outbox/sessions/codes; retention purge (`audit_purge` setting) |
| 1st of month 06:10 | create dossiers for the month; if `monthly_statement_request` → request "Töltsd fel a(z) {előző hónap} bankszámlakivonatodat" (due 10th) |
| 1 Jan 00:10 | create next year's tax periods, deadlines, tax profiles (copy previous, flag `cost_ratio` review) |
| every 5 min | flag recompute queue, notification sender (push/e-mail batching) |
Worker writes a heartbeat row; `/admin/system` shows it.

---

## 16. Notifications catalogue

`notification_kind` values, default channels (push / e-mail / in-app always), recipient. Texts: `content_texts` keys `notif.<kind>.title|body`, `email.<kind>.subject|body`, placeholders in `{curly}`.
| Kind | To | Push | E-mail | Example title |
|---|---|---|---|---|
| `tax_approved` | client | ✓ | ✓ | "Megvan a III. negyedévi összeg: 510 471 Ft" |
| `tax_due_soon` | client | ✓ | ✓ (3 days) | "Még 3 nap: október 12-ig utald el" |
| `tax_reopened` | client | ✓ | ✓ | "{firstName} módosította a fizetendőt" |
| `tax_payment_verified` / `tax_payment_mismatch` | client | ✓ | – / ✓ | "{firstName} látta a befizetésed" |
| `tax_filed` | client | ✓ | ✓ | "{firstName} beadta a III. negyedéves bevallást" |
| `document_processed` (daily batch) / `document_filed` | client | ✓ | – | "3 iratod feldolgozva" |
| `request_new` / `request_reminder` | client | ✓ | ✓ | "{firstName} kéri: töltsd fel a szeptemberi kivonatot" |
| `request_done` | client | ✓ | – | "Elkészült a jövedelemigazolásod" |
| `message_new` | client | ✓ | – | "Új üzenet {firstName}-tól" |
| `client_message_new`, `client_request_new`, `client_document_uploaded`, `client_marked_paid`, `onboarding_needs_review` | accountant | – | daily digest ✓ | in-panel badge |
| `onboarding_needs_fix` | client | ✓ | ✓ | "Egy dolgot pótolnod kell" |
| `onboarding_done` | client | ✓ | ✓ | "Kész: minden be van kötve" |
| `limit_warning` | client + accountant | ✓ | ✓ | "Elérted az alanyi ÁFA-keret 80%-át" |
| `appointment_booked` / `_reminder` / `_cancelled` | both | ✓ | ✓ | "Holnap 10:00: hívás {firstName}-val" |
| `subscription_payment_failed` / `_renewal_needed` / `_canceled` / `fee_invoice_issued` | client | ✓ | ✓ | "Nem sikerült levonni a havidíjat" |
| `auth_email_code`, `auth_password_reset_code`, `auth_staff_invite` | user | – | ✓ only | code e-mails |
| `gdpr_export_ready` | user | ✓ | ✓ | "Elkészült az adataid másolata" |
Hungarian suffix handling for names (Bencé**vel**, Bencé**től**) – use the stored name forms `accountants.name_with|name_from|name_onto|name_acc` (placeholders `{firstNameWith}`, `{firstNameFrom}`, `{firstNameOnto}`, `{firstNameAcc}`) instead of guessing; the seed provides them, the admin form asks for them.

---

## 17. Client app (Expo) – screens ↔ FUNKCIOK

### 17.1 Design rules (read before coding)
- Look at every PNG in `dizajn/C2_modern/app_v2/` and read `TERV.md`; port `tokens.css` to `app/src/theme/tokens.ts` (same names). Geist via `@expo-google-fonts/geist`. Phone frame 390×844 @2x is the reference.
- Shapes (TERV G1): capsule = button only; 18 px sheet = content; 4 px paper = the letter only; 12 px = fields + request tiles; 6 px = status label. Shadow only on floating layers (tab bar, Fotózás button, bottom sheet, composer, letter).
- Header band `--tintakek` with the rosette (`guilloche_rozetta.svg` via react-native-svg; position per screen) and the big number/title in white; secondary text `--fejlec-halvany`.
- The letter: paper `#F3F4F6`-ish with `papirszal_halk_csempe.png` texture, "Kedves Kata!" 600 weight ~26 pt, body 16.5 pt / 1.62, accountant signature drawn from `signatureSvgPath` in `--tollkek` (stroke-order animation ~900 ms on first open; reduced motion → static), printed name + date.
- Status words are text with ✓ (no pills). Green `--kesz` only means "kész".
- Bottom tab bar floating: Főoldal / Dosszié / Üzenetek / Fiók + separate round dark **Fotózás** button. Messages screen hides the tab bar (own back arrow + composer).
- Copy per design PNGs, with the 2026 law fixes (§7.3) and the onboarding changes (§10.2). Login card copy "15 perces hívással kezdünk" → "Pár perc, és bekötünk" (no default call) [OWNER may reword].
- The approved app icon is the **flat ink-blue square with Geist Black "K" and the blue pen stroke** (`app_v2/kozos.js` symbol `#appikon`); render it to 1024 px PNG for `icon` and Android adaptive icon. The metallic K in `assets/app_ikon/` is retired – do not use.

### 17.2 3D icons (`assets/ikon3d/<name>_<pt>@2x|@3x.png`, sizes 24/28/36/44/56/72 pt)
| Icon | Where |
|---|---|
| `fooldal`, `dosszie`, `uzenetek`, `fiok` | tab bar (28 pt) |
| `fotozas` | round Fotózás button (28–36 pt), camera intro |
| `feltoltes`, `kerdezek`, `igazolas`, `hataridok` | the four quick actions (44 pt, **no circle behind**); also on related secondary buttons ("Kivonat feltöltése" uses `feltoltes`) |
| `szamolo` | "Hogyan jött ki?" button on the band and in the sheet |
| `szamlaszam` | "Számlaszámok" sheet rows |
| `masolas` | copy buttons (account number, közlemény, accountant adóazonosító in ONYA guide) |
| `befizetve` | paid states, verified ticks on documents (small overlay as in 04) |
| `irat` | PDFs, contracts, returns, NAV letters (list rows) |
| `nyugta` | receipts, pénztárgép összesítő |
| `ertesites` | notifications inbox, NAV letters |
Illustrations (`assets/illusztraciok/<name>@2x|@3x.png`, 160×120 pt box): `dosszie_mappa` (empty dossier, 11), `hatarido_naptar` (deadlines empty, appointment card), `level_boritek` (messages empty, e-mail verify), `meghatalmazas_alairva` (meghatalmazás step + onboarding done), `befizetve_pecset` (paid stamp sheet 08 and the stamp on the letter; `_feher` variants on dark), `videohivas_laptop` (only the optional call card). Avatar: `assets/avatar/karakter_1_lapos@2x/@3x.png` everywhere the accountant appears.

### 17.3 Screens (expo-router)
| Route | Design ref | FUNKCIOK | Content / behaviour |
|---|---|---|---|
| `(auth)/belepes` | 01 | 1 | e-mail + jelszó ("Mutasd"), Belépés, "Elfelejtettem a jelszavam", vagy, Google (if enabled), Apple (iOS + enabled), "Még nem vagy ügyfél?" → Regisztrálok |
| `(auth)/regisztracio` | – (same language) | 1, 31 | név, e-mail, jelszó (+ erősség), ajánlókód (prefilled from `?ref=`), UTM captured from the web URL; ÁSZF link |
| `(auth)/email-megerosites` | – | 1 | 6-digit code, resend (60 s), `level_boritek` illustration |
| `(auth)/jelszo-elfelejtve`, `(auth)/jelszo-uj` | – | 1 | e-mail → code + new password |
| `(auth)/ketlepcsos` | – | 1, 19 | TOTP or recovery code |
| lock overlay | – | 1 | biometric unlock after ≥ 5 min background (if enabled) |
| `bekotes/index` | 02 | 2–7 | band "Még N dolog kell tőled, a többit {firstName} intézi." + accountant card (avatar, title, nyilvántartási szám); next-step cards; optional call card (only if enabled); "Hol tartunk" milestone line |
| `bekotes/adatok` | – | 2 | 3 short pages: Rólad (név, telefon, adóazonosító jel, lakcím) · Vállalkozásod (adószám, EV nyilvántartási szám, székhely település, mivel foglalkozol → 3 choices with examples → suggested költséghányad, mióta vagy vállalkozó) · Helyzeted (főállás / mellékállás heti 36 órás munka vagy nappali tanulmány mellett / nyugdíjas; eddigi könyvelő; van-e külön vállalkozói számlád) |
| `bekotes/szerzodes` | – | 3 | ÁSZF, Adatkezelési tájékoztató, Megbízási szerződés: readable sheets + PDF download + one acceptance per document |
| `bekotes/elofizetes` | – | 3 | what you get for 19 999 Ft/hó, token info sentence, 2 SimplePay declarations (checkboxes with full text), SimplePay text link/logo, "Kártyás fizetés" → browser; result screen (§9.5); DEMO banner |
| `bekotes/meghatalmazas` | – | 4 | §10.2 methods; ONYA steps with copy buttons; "Beküldtem"; `meghatalmazas_alairva` illustration |
| `bekotes/azonositas` | – | 5 | §10.3: 4 photos with card-shaped guides, data form, declarations, "Titkosítva tároljuk, csak {firstName} látja." |
| `bekotes/idopont` | 02 card | 6 | only if enabled: slots, telefon/videó, confirm, "Naptárba teszem" (.ics), "Másik időpont" |
| `(tabs)/index` Főoldal | 03, 08 | 8–11 | §12.4 ClientHome: band (amount, "Október 12-ig, hétfőig", "még 3 nap" amber label, "Hogyan jött ki?"), letter, "3 külön utalás a NAV-nak, 3 számlaszámra" sheet with the items + "Számlaszámok" (primary) / "Már befizettem" (secondary); quick actions; "{firstName} kéri"; "Idei kereteid" (ÁFA meter with striped projection, adómentes rész sentence, átalány cap only if ≥ 50 %); "Idei bevételed" monthly bars (FUNKCIOK 9); "{Hónap} dosszié" preview. States: `becsles` (band shows "Eddig kb. 392 661 Ft" + "{firstName} a negyedév végén véglegesíti", no pay buttons), `jovahagyva`, `befizetve` (08 állapot: "Befizetted", stamp on the letter, "Mégsem fizettem be"), `nincs_fizetendo`, `bekotes_alatt` (redirect card to onboarding) |
| sheet `hogyan-jott-ki` | 07 | 8, 22 | engine explanation (§7.3), "Kérdezek róla" → chat with reference |
| sheet `szamlaszamok` | (not drawn) | 8 | per item: name, account number (copy), IBAN, közlemény (copy), amount (copy), due date; steps "1. Nyisd meg a bankod appját…"; same visual language |
| sheet `befizettem` | 08 | 8 | checklist of the 3 items (pre-ticked), date picker (default today), "Rendben" → stamp animation (180 ms, haptic) |
| `(tabs)/dosszie` | 04, 11 | 12–15 | month switcher in the band (current, previous, "Korábbiak"), headline "8 irat, ebből egy még {firstName}re vár.", review card, sections "Amit te küldtél", "A NAV-tól kaptuk" ("Ezeket neked nem kell feltöltened."), "{firstName} beadta"; dashed "+ Fájl hozzáadása"; empty month = 11 with `dosszie_mappa` |
| `dosszie/[honap]/szamlak` + `szamla/[id]` | – | 12 | NAV invoice list and detail (MINTA label in demo) |
| `tetel/[id]` | 05 | 14 | back arrow with month, status line ✓, preview (image zoom / PDF open), fields (összeg, hová került, feltöltve), {firstName} megjegyzése, history ("Hol tart"), "Kérdezek róla", new version |
| `fotozas` | 09 | 13 | document scanner (auto edges, deskew, multi-page) → review strip ("2. oldal", "Ezt újra", "+"), category chips (Nyugta, Számla, Kivonat, Szerződés, Egyéb), month, "Kész, feltöltöm"; web/no-scanner fallback: camera/file input |
| `feltoltes` | – | 13 | chooser: Fotózás · Fájl (PDF/kép, document picker) · Kivonat (category preset) ; share-intent entry (`expo-share-intent`) lands here with the shared file(s) |
| `uzenetek` | 06 | 16, 17 | header with avatar, name, "Mérlegképes könyvelő", response promise; request tiles (Jövedelemigazolás, Nullás igazolás, Köztartozásmentes, Megváltozott egy adatom); thread with own bubbles ink-blue; request cards; attachments (`feltoltes` icon button); composer |
| `keresek/uj` | – | 17 | form per type (year + purpose for jövedelemigazolás; what changed for adatváltozás/tevékenységváltozás) |
| `keresek/index` | – | 11, 17 | both directions with statuses |
| `hataridok` | – | 18 | list grouped by month (payments, filings, requests, appointment) with amber "még N nap" labels, .ics per item; empty → `hatarido_naptar` |
| `ertesitesek` | – | 18 | in-app inbox |
| `(tabs)/fiok` | – | 19 | accountant card; Előfizetés; Díjszámlák; Értesítések; Biztonság; Adataim letöltése; Fiók törlése; Ajánld ismerősnek (personal code + share); GYIK; Jogi dokumentumok; Kijelentkezés |
| `fiok/elofizetes` | – | 19 | status, next charge, card mask, "Kártya cseréje", "Kártya törlése", "Lemondás" (consequence text from jogi), DEMO label |
| `fiok/biztonsag`, `fiok/ketlepcsos` | – | 1, 19 | password change, 2FA setup (QR via `otpauthUrl`, secret copy, code, recovery codes), biometric toggle, sessions list |
| `fiok/ertesitesek`, `fiok/adataim`, `fiok/torles`, `gyik`, `jogi/[tipus]` | – | 18, 19, 32 | as named |
| Home-screen widget | 10 | – | [NEM MA] (needs native widget module) |

Data layer: TanStack Query, API client with automatic refresh, offline-tolerant reads (cache), uploads with progress and retry. Deep links: `kezjegy://elofizetes/eredmeny`, notification `link` routes. Web build: same routes, phone-width centred layout (max 480 px) on desktop.

---

## 18. Panel (React + Vite) – screens ↔ FUNKCIOK

Same visual language at desktop scale (1440×900 reference): tinted ground, white sheets, ink-blue top band with the rosette (or `guilloche_halk_csempe.png`), Geist, 3D icons at 24–36 pt for navigation and status, no line icons. Left navigation with 3D icons; tables on white sheets; drag-and-drop zones dashed `--kek`.
| Route | FUNKCIOK | Content |
|---|---|---|
| `/belepes`, `/ketlepcsos`, `/jelszo` | – | staff login (+ TOTP; forced setup if `STAFF_TOTP_REQUIRED`) |
| `/ugyfelek` | 20 | filter chips with counts (Bekötés alatt · Rendben · Hiányzik valami · Határ közelében · Díj elmaradt · Mind), search, table (§12.5 row) |
| `/ugyfelek/:id` → tabs | 21 | header: name, flags, next deadline, quick actions (Üzenet, Kérés, Számolás) |
| ↳ Áttekintés | 21 | data, tax profile editor (költséghányad 45/80/90 with hint about 2026, status, garantált bérminimum, HIPA), subscription summary, meters, internal notes |
| ↳ Bekötés | 2–7 | steps with review actions; meghatalmazás method + "Ellenőriztem a NAV-nál"; KYC viewer (images side by side + data + declarations) Elfogadom/Hiányos; **NAV-kapcsolat** form (login, password, signing key, exchange key, tax number; never shown back; "Kapcsolat ellenőrzése"; sync log; help §8.6) |
| ↳ Dosszié | 12–15, 23 | month grid, documents with status dropdowns, bulk status, drag-and-drop upload (category, visibility), comment for the client, NAV invoices group |
| ↳ NAV-számlák | 12, 33 | list/detail, received-date edits via revenue items |
| ↳ Bevételek | 22 | revenue items (NAV + kézi), add manual (e.g. pénztárgép összesítő), exclude/restore, monthly sums, CSV |
| ↳ Adó | 22, 23 | year → quarters; "Számolás" → engine result (monthly bases table, warnings, explanation preview exactly as the client will see it), overrides with reason, letter text (default from content), **"Jóváhagyom és elküldöm"**; payment verification per item; **"Beadva"**: upload 2658 PDF + NAV receipt; HIPA period |
| ↳ Kérések, Üzenetek | 16, 17, 24 | chat with templates; request create/close |
| ↳ Időpontok, Napló | 26, 28 | client's appointments; client audit trail |
| `/hatarido-figyelo` | 25 | week board (prev/next week), overdue column |
| `/keresek` | 17, 24 | queue incl. certificate requests (status flow, attach result PDF) |
| `/sablonok` | 24 | message templates |
| `/idopontok` | 26 | availability editor + bookings (only if enabled) |
| `/export` | 27 | revenue CSV by year/clients |
| `/naplo` | 28 | own clients' audit |
| `/beallitasok` | – | response-time text, appointments on/off, monthly statement request on/off, 2FA, signature preview |
| `/admin` | 29 | KPI tiles (aktív ügyfelek, MRR, sikertelen fizetések, lemondások), revenue by month bars, onboarding funnel |
| `/admin/elofizetesek`, `/admin/fizetesek` | 29 | lists, retry/cancel, card status |
| `/admin/ugyfelek` | 29, 30 | business data, accountant reassignment |
| `/admin/konyvelok` | 30 | workload (clients, open requests, overdue), invite accountant |
| `/admin/forrasok` | 31 | attribution table (source/medium/campaign/code → signups → paying), referral codes CRUD |
| `/admin/szovegek` | 32 | FAQ editor + notification/e-mail texts with placeholder check and preview |
| `/admin/naplo` | 28, 35 | audit search |
| `/admin/demo-postafiok` | – | DEMO only: last e-mails (codes) |
| `/admin/rendszer` | 33, 35 | integration modes, worker heartbeat, last sync, backup age |

---

## 19. Demo seed data (`backend/src/seed/`)

Idempotent `npm run seed` (refuses to run when `APP_ENV=production` unless `--force-demo`). Uses `kod/shared/demo/fixtures.json`. **All people, companies, numbers and documents are fictional.** E-mail domain `demo.kezjegy.test` (reserved TLD, never deliverable). Passwords: random 16+ chars, written only to `SEED_CREDENTIALS_FILE` (mode 600); never printed.

### 19.1 Identifiers (fake, formally valid; from fixtures.json)
| Person | Role | E-mail | Adószám | Adóazonosító jel |
|---|---|---|---|---|
| Kovács Bence | accountant | `bence.kovacs@demo.kezjegy.test` | – | 8428621233 |
| Szabó Kata | client | `kata.szabo@demo.kezjegy.test` | 68801234-1-41 | 8417104569 |
| Varga Réka | client | `reka.varga@demo.kezjegy.test` | 68904564-1-10 | 8450772176 |
| Németh Péter | client | `peter.nemeth@demo.kezjegy.test` | 68707893-1-06 | 8463473385 |
| Demo Tulajdonos | admin | `admin@demo.kezjegy.test` | – | – |
Validation helpers (backend + app): adószám törzsszám check digit = `(10 − (9d1+7d2+3d3+d4+9d5+7d6+3d7) mod 10) mod 10`; adóazonosító jel starts with 8, check digit = `(Σ i·d_i, i=1..9) mod 11` (≠ 10).

### 19.2 Accountant
Kovács Bence, "Mérlegképes könyvelő", nyilvántartási szám "123456" (minta), avatar `karakter_1_lapos`, signature path from `app_v2/kezjegy_utak.js` (Bence's), response text "Munkanapokon 4 órán belül válaszol", name variants "Bencével"/"Bencétől"/"Bencére"/"Bencét", **appointments_enabled = true in the demo** (to show the optional flow; default for new accountants is false), monthly statement request on.

### 19.3 Szabó Kata (the design persona; grafikus/illusztrátor)
- Profile: 45 éves, Budapest (fictional address "1136 Budapest, Példa utca 7."), activity "Grafikai tervezés és illusztráció", cost ratio **45 %** (confirmed), `fofoglalkozasu`, minimálbér, EV since 2019, client since 2026-01-08, lifecycle `aktiv`, all onboarding steps `kesz` (meghatalmazás method `onya_ugyfel`), KYC `elfogadva` (demo images: grey cards "DEMO – NEM VALÓDI OKMÁNY", no official layout, no emblem), NAV credentials demo (status `rendben`, last sync today 05:30).
- Revenue 2026: NAV invoices from fixtures (33 invoices to fictional customers: Bodza Kiadó Kft., Csipkebogyó Pékség Bt., Fecskefészek Utazási Kft., Mókusvár Játékbolt Kft., Zöldág Alapítvány) + one manual receipt (2026-10-03, 18 000 Ft, "Nyugta, készpénzes eladás"). Received by month: 610 000 · 540 000 · 720 000 · 880 000 · 760 000 · 940 000 · 820 000 · 650 000 · 1 020 000 · 900 000 · 162 000 (Nov so far; one 240 000 Ft invoice due 2026-11-20 is "várható").
- Tax: Q1, Q2, Q3 approved (letters), paid (marked on 2026-04-09, 07-09, 10-09), verified, filed (2658: 04-10, 07-10, 10-02 – "Bevallás a III. negyedévről, Beadva október 2-án"); Q3 = **510 471 Ft** (TB 179 154, szocho 125 892, SZJA 205 425). Q4 = `becsles` 392 661 Ft as of 2026-11-17, due 2027-01-12. Letter for Q3: "Kedves Kata! Kiszámoltam, mennyit kell most befizetned. Ez már a végleges összeg." (2026-10-02).
- Dossier: every month Jan–Nov has a bank statement PDF (generated "MINTA BANKSZÁMLAKIVONAT – DEMO", fictional bank "Példa Bank"), NAV invoice group, and 0–2 own uploads. Oct: "Nyugta, készpénzes eladás" (photo, `feldolgozva`, Bence's tip: "Ha máskor is kézzel adsz nyugtát, elég a hónap végén egyszerre lefotóznod a tömb lapjait."), "Szerződés, Bodza Kiadó" (PDF, `feltoltve`), "Levél a NAV-tól" (`feldolgozva`), "Bevallás a III. negyedévről" (`beadva`). Nov: one upload `feltoltve`, one `konyvelo_latta`. Statuses of Jan–Sep documents `beadva`.
- Open request from Bence: "Töltsd fel az októberi bankszámlakivonatodat." body "Csak ellenőrzéshez kell, a befizetendő összeg nem változik. Elég a bankod appjából letöltött PDF." due 2026-11-20.
- Certificate request: Jövedelemigazolás 2025, purpose "bank", status `folyamatban` ("Bence látta, pár napon belül kész").
- Messages (≈ 8, design 06): "Levelet kaptam a NAV-tól, megjelent. Feltöltöttem a dossziéba." / "Megnéztem: csak értesítés, nincs teendőd. Elteheted." / request card Jövedelemigazolás …
- Subscription `active` since 2026-01-08, card `xxxx-xxxx-xxxx-4193` (demo), 12 tokens of which 11 used → `renewal_needed` reminder scheduled for December, next charge 2026-12-08; 11 demo fee invoices.
- Personal referral code `KATA7Q2X`; attribution utm_source `facebook`, campaign `osz_2025`.

### 19.4 Varga Réka (fodrász – shows the 80 % ratio, garantált bérminimum, pénztárgép path, "határ közelében")
Eger (fictional address), activity "Fodrászat" (ÖVTJ'24 9602), **80 %**, `fofoglalkozasu`, `guaranteedMinimum: true`, lifecycle `aktiv`, flags `hatar_kozel` (ÁFA 16 315 000 Ft ≈ 81.6 %) and `hianyzik_valami` (request "Töltsd fel az októberi bankszámlakivonatodat" due 2026-11-10, overdue). Revenue: monthly manual "Pénztárgép havi összesítő" items (uploaded PDFs) + 4 NAV invoices (wedding hair, fictional "Gyöngyvirág Rendezvényház Kft."). Q1–Q2 approved/paid/verified/filed; Q3 approved **492 054 Ft**, marked paid 2026-10-10 but **not yet verified** (`befizetve_jelezve`); Q4 estimate 407 874. HIPA: banded, Eger, rate 2 % (estimate). Subscription active (demo).

### 19.5 Németh Péter (webfejlesztő – mellékállású, onboarding in progress)
Szeged (fictional), activity "Weboldal-fejlesztés", 45 %, `mellekallasu`, EV since 2024, previous accountant "Minta Könyvelőiroda Bt.", registered with us 2026-11-10, `prior_overrides` for Q1–Q3 entered (from the fixture's expected values). Onboarding: fiok/adatok/szerzodes/elofizetes `kesz`, azonositas `kesz`, meghatalmazas `konyvelore_var` (method `onya_ugyfel`, submitted 2026-11-16), idopont booked: phone call 2026-11-19 10:00, nav_bekotes `nincs_kezdve` (no NAV credentials yet → QA can save demo credentials and run the first sync; fixtures contain 28 invoices for his tax number). Open request "Töltsd fel az idei bankszámlakivonataidat" (design 02). Milestones show "NAV-nál bejelentve" as current.

### 19.6 Admin and global
Demo Tulajdonos (admin, no accountant profile). Plans: `havi` 19 999 Ft. Referral codes: `KATA7Q2X` (Kata), `OSZ2026` (campaign "őszi hirdetés"). FAQ: 8 items (from jogi app texts). Content defaults loaded. Legal documents from `kod/jogi/index.json` (fallback placeholders "TERVEZET – jogász ellenőrzi" if jogi is not ready). Kata's consents recorded with the current versions.

---

## 20. Deployment on appok-1

Server facts (checked 2026-11-17, read-only): Ubuntu, Docker 29.10, Compose v5.7; Gardoko = compose project `appok` in `/srv/appok/deploy` with services `caddy` (only one publishing 80/443), `api`, `db`; networks `appok_edge`, `appok_internal`; Caddyfile `/srv/appok/deploy/Caddyfile` (site `45-94-65-74.sslip.io`). sslip.io subdomains `app.`, `konyvelo.`, `api.45-94-65-74.sslip.io` resolve to 45.94.65.74 (checked). **Chosen: subdomains** (fallback paths only if ACME fails).

### 20.1 Layout
```
/srv/kezjegy/
  .env                     600, all secrets (§13)
  demo_belepesek.txt       600, seed passwords (owner reads: ssh appok-1 'cat /srv/kezjegy/demo_belepesek.txt')
  deploy/                  docker-compose.yml, kezjegy.caddy, web.Caddyfile, up.sh, backup.sh, migrate+seed scripts
  src/                     build context copy of kod/ (backend, ado-motor, nav-kliens, shared, jogi)
  web/app/                 Expo web export (static)
  web/panel/               panel build (static)
  data/files/              700, encrypted blobs
  backups/                 700, daily encrypted dumps (14 kept)
  _regi/                   replaced files
```
### 20.2 Compose (`name: kezjegy`)
Services: `kezjegy-db` (postgres:17-alpine, volume `kezjegy_pgdata`, network internal only, healthcheck), `kezjegy-api` (build `../src` with `backend/Dockerfile`, `read_only`, tmpfs `/tmp`, `no-new-privileges`, user 1001:1001, env_file `../.env`, volumes `../data/files:/data/files`, networks `kezjegy_edge` + `kezjegy_internal`, runs migrations on start), `kezjegy-worker` (same image, `command: node dist/worker.js`, same volumes/networks), `kezjegy-web` (caddy:2-alpine with `web.Caddyfile`: `:8080` serves `/srv/app` SPA with `try_files {path} /index.html`, `:8081` serves `/srv/panel`; volumes read-only; network `kezjegy_edge`). **No `ports:` anywhere.** Networks: `kezjegy_edge` (`name: kezjegy_edge`, bridge), `kezjegy_internal` (`internal: true`). Service names are unique (`kezjegy-*`) because Caddy also sits on `appok_edge` where `api` already exists.
### 20.3 Shared-file change (the only one)
1. Before: `curl -fsS https://45-94-65-74.sslip.io/api/v1/health` (must be OK).
2. Copy `/srv/appok/deploy/docker-compose.yml` and `Caddyfile` to `/srv/appok/_regi/<name>_<YYYYmmdd_HHMMSS>`.
3. appok compose, service `caddy`: add network `kezjegy_edge` and volume `/srv/kezjegy/deploy/kezjegy.caddy:/etc/caddy/kezjegy.caddy:ro`; top-level `networks: kezjegy_edge: { external: true, name: kezjegy_edge }`. Caddyfile: add top-level line `import /etc/caddy/kezjegy.caddy`.
4. Start kezjegy stack first (creates `kezjegy_edge`), then `docker compose --env-file /srv/appok/.env -f /srv/appok/deploy/docker-compose.yml up -d caddy`, then `caddy validate` / reload.
5. After: Gardoko health again + the three new hosts. If Gardoko fails → restore from `_regi` immediately.
`kezjegy.caddy`: three site blocks; `app.` and `konyvelo.` → `handle /api/* { request_body { max_size 60MB } reverse_proxy kezjegy-api:8080 }` + `handle { reverse_proxy kezjegy-web:8080|8081 }`; `api.` → `/api/*` to kezjegy-api, everything else 404. Security headers §4.5; access logs off; `header_up X-Forwarded-For {remote_host}`.
### 20.4 Backups
Host cron (deploy user) 03:00: `docker exec kezjegy-db pg_dump -Fc` → `gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /srv/kezjegy/.backup_pass` → `backups/db_YYYYmmdd.dump.gpg`; keep 14; files dir is already encrypted (rsync snapshot weekly). Offsite copy (e.g. the owner's Hetzner Storage Box) [OWNER decision]. Restore procedure documented in `kod/deploy/README.md` and tested once tonight.
### 20.5 Owner key script `C:/Users/UpgradePC/konyvelo_app/kezjegy_kulcsok.ps1`
Same proven pattern as `C:/Users/UpgradePC/kerti_doktor/kulcsok_beallitasa.ps1`: UTF-8 **with BOM**; secrets via `Read-Host -AsSecureString`; empty Enter = unchanged; values base64-encoded into a bash script piped to `ssh appok-1 'bash -s'`; remote script's first line `: 2>/dev/null`, backs up `.env` to `/srv/kezjegy/_regi/`, merges keys with python3, `chmod 600`, recreates `kezjegy-api` and `kezjegy-worker`, ends with `exit 0`. Sections: APP_ENV switch, SimplePay (mode, merchant, secret), SMTP/Brevo + MAIL_FROM, Google client ids, Apple bundle id, NAV mode + software id/dev data, invoice provider + key, push mode + Expo token, public URLs (after a real domain), STAFF_TOTP_REQUIRED. Prints the health URL to check.

---

## 21. Legal texts (`kod/jogi`) contract

Every file starts with: "TERVEZET – jogász ellenőrzi. Nem végleges, nem jogi tanács." Plain, fair, short Hungarian sentences.
- `index.json`: `[{ docType, version, title, file, requiresReconsent }]`; doc types: `aszf`, `adatkezeles`, `megbizasi_szerzodes`, `nav_meghatalmazas` (ONYA guidance + the ügykörök list + optional PDF meghatalmazás template), `adatfeldolgozoi` (Kft. ↔ accountant; not shown in app), `pmt_nyilatkozatok`, `simplepay_adattovabbitas`, `simplepay_ismetlodo`, `app_szovegek` (lemondás, automatikus megújítás, ár, fizetési eredmény-szövegek §9.5, GYIK 8 kérdés).
- Format: Markdown with headings (`#`, `##`), paragraphs, `-` lists, `**bold**` only (the backend's mini Markdown→PDF typesetter supports exactly these).
- Placeholders: `{{brand.name}}`, `{{ceg.nev}}`, `{{ceg.szekhely}}`, `{{ceg.adoszam}}`, `{{ceg.cegjegyzekszam}}`, `{{ceg.email}}`, `{{ugyfel.nev}}`, `{{ugyfel.szuletesi_nev}}`, `{{ugyfel.lakcim}}`, `{{ugyfel.adoazonosito_jel}}`, `{{ugyfel.adoszam}}`, `{{ugyfel.ev_nyilvantartasi_szam}}`, `{{konyvelo.nev}}`, `{{konyvelo.adoazonosito_jel}}`, `{{konyvelo.nyilvantartasi_szam}}`, `{{dij.havi_brutto}}`, `{{datum.ma}}`, `{{szerzodes.kezdete}}`, `{{szolgaltatas.url}}`. Unknown company data stays `[CÉGADAT: …]` (from `brand.json → provider`).
- The jogi builder may also render sample PDFs for review (`kod/jogi/pdf_minta/*.pdf`); the backend renders the real ones with client data.

---

## 22. Tests and done-criteria per package

- **ado-motor**: vitest; §7.6 A, B, C exactly; property tests (monotonic in revenue, never negative, rounding); nyugdíjas = 0 járulék; mellékállás no minimum; partial months; garantált minimum; ÁFA/átalány meters; deadlines incl. weekend shift; explanation snapshot for Kata Q3. `npm run build` → `dist/`.
- **nav-kliens**: vitest; hash/signature vectors; XML request snapshot per operation; response parsing incl. gzip; error mapping; 35-day window splitting; rate-limit spacing (fake timers); mock server contract tests (digest paging, data decode) using fixtures; **no write operations exported**.
- **backend**: vitest on PGlite: auth (register/verify/login/TOTP/refresh rotation + reuse detection/reset), role + ownership matrix (client A cannot read client B's documents/files/periods → 404; accountant cannot read unassigned client; admin cannot read documents/KYC), uploads (type sniffing, size, encryption round-trip, AAD tamper fails), document status flow, tax approve → client home, mark-paid/unmark, SimplePay signature sign/verify with the doc's example, IPN idempotency + response signature, dorecurring retry logic (fake clock), NAV sync with demo transport → revenue items → estimate equals §7.6 C, GDPR export contains data and delete disables login, audit trigger blocks UPDATE, log redaction. `GET /health` OK in Docker.
- **app**: typecheck, unit tests for formatters/validators; Expo web export runs; screenshots of every screen (390×844 @2x) into `kod/app/_kepek/` compared side by side with the approved PNGs; Android debug APK builds (integration step).
- **panel**: typecheck, build, screenshots 1440×900 into `kod/panel/_kepek/`.
- **deploy**: Gardoko health before/after; `https://app.…`, `https://konyvelo.…`, `https://api.…/api/v1/health` over HTTPS; `docker ps` shows only `appok-caddy-1` with published ports; restore drill of one backup.

---

## 23. Waits for the owner / lawyer / accountant

| # | Item | Who | Until then |
|---|---|---|---|
| 1 | SimplePay merchant contract (needs real domain + company data), merchant id + secret (HUF), IPN URL in merchant admin, sandbox tests, logo pack | OWNER | DEMO payments |
| 2 | Brevo SMTP account, sender domain (SPF/DKIM), MAIL_FROM | OWNER | demo outbox |
| 3 | Google OAuth client ids (web, Android with signing SHA-1, iOS) | OWNER | button hidden |
| 4 | Apple developer account + bundle id | OWNER | button hidden |
| 5 | Domain + final product name (brand.json `name`). **Rename checklist:** brand.json → sync-shared → new APK; re-render the main video (`python video/bekotes/eszkoz/render.py`, the name is burned into its first/last frame and poster; the guide videos carry no product name) → `node kod/deploy/videok-json.mjs` → `bash kod/deploy/feltolt.sh --media` | OWNER | sslip.io + "Kézjegy" |
| 6 | NAV test-environment registration (Kft./accountant via Ügyfélkapu+) and a test technical user; production technical users per client by the accountant | OWNER / KÖNYVELŐ | NAV demo mock |
| 7 | Fee invoicing provider (Számlázz.hu or Billingo) + key; Kft. VAT status | OWNER | demo PDF "nem számla" |
| 8 | EAS project + FCM/APNs for push | OWNER | in-app only |
| 9 | Lawyer review of `kod/jogi` (ÁSZF, adatkezelés, megbízás, meghatalmazás ügykörök, Pmt. remote identification, DÁP signature use, retention periods, e-contract) | JOGI | drafts marked TERVEZET |
| 10 | Real accountant: name, title, PM registration number, adóazonosító jel, character avatar OK, response-time promise, bookkeeping software (export format), garantált bérminimum and HIPA practice, közlemény choice | OWNER / KÖNYVELŐ | demo Bence |
| 11 | Turn on `STAFF_TOTP_REQUIRED`, set `APP_ENV=production` after keys | OWNER | demo |
| 12 | Offsite backup target + offline copy of encryption keys | OWNER | local backups only |
| 13 | Subscription grace period (default 14 days) and referral reward policy | OWNER | tracking only |
| 14 | Design follow-ups noted: 07 copy (2026 law), 02 copy (ONYA instead of AVDH), login card copy (no default call), not-yet-drawn screens (Számlaszámok sheet, Feltöltés chooser, Fiók) built in the same language | OWNER (review) | as specified here |

---

## 24. Builder notes (append-only)

Format: `- YYYY-MM-DD HH:MM <builder>: <note>` . Contract changes go here first, then into code.

- 2026-11-18 00:40 panel: **Shapes the panel consumes** (full TS in `kod/panel/src/api/types.ts`; all calls in `kod/panel/src/api/endpoints.ts`, one place to fix at integration). Where §12.5/§12.6 only names an endpoint, the panel expects:
  - `GET /acc/clients/:id` → `AccClientDetail` = `{ id, firstName, lastName, name, email, phone|null, lifecycle, flags[], clientSince, adoazonositoJel|null (full, audited), adoszam, evNyilvantartasiSzam, birthName, address{zip,city,line}|null, hqMunicipality, activityText, activityCode, evSince, previousAccountant, hasSeparateBusinessAccount, taxProfile: TaxProfile|null, onboarding{ steps[{step,status,note?,completedAt?,data?{method?,submittedAt?,fileId?}}], milestones[] }, kycStatus|null, subscription{status,mode,priceHuf,nextChargeAt?,cardMask?,failedAttempts}|null, nav: NavConnection{status:'nincs'|'nincs_ellenorizve'|'rendben'|'hibas', environment, loginHint, taxNumber, savedAt, lastTestAt, lastTestError, lastSyncAt, lastSyncStatus, lastSyncError}, meters|null, nextDeadline|null, openRequestsFromClient, openRequestsToClient, unreadMessages, demo }`.
  - **Added** `GET /acc/clients/:id/dossiers?year=` → `{ months:[{month,label,documentCount,waitingCount,navInvoiceCount}] }` (same as the client one). `GET /acc/clients/:id/dossiers/:month` → `{ month, label, documents: AccDocument[] (DocumentListItem + visibility, createdAt, createdByRole 'client'|'accountant'|'system', clientNote?, accountantComment?, fileId?, mime?), navInvoices{ items: NavInvoiceListItem[], totalHuf, status|null }, revenueItems: RevenueItem[], review{at,okCount,note?}|null, openRequests: RequestSummary[] }`.
  - **Added** `GET /acc/clients/:id/nav-invoices?year=` → `{ items: AccNavInvoiceRow[] }` (NavInvoiceListItem + operation, deliveryDate, paymentDate, paymentMethod, customerTaxNumber, revenueItemId, receivedOn, receivedOnEstimated) and `GET /acc/nav-invoices/:id` → that row + `currency, netHuf, vatHuf, vatExemption, lines[]`.
  - `GET /acc/clients/:id/kyc` → `{ status, submittedAt, reviewNote, data: Record<camelCaseField,string>, declarations{ownBehalf,pep,pepDetails?,signedAt}, files{idFront?,idBack?,addressFront?,addressBack?} (file ids) }`; images shown via `POST /files/:id/link` → `<img src=url>`.
  - `GET /acc/clients/:id/tax-periods?year=` → `{ year, items: AccTaxPeriod[], defaultLetterText }`, `AccTaxPeriod` = TaxPeriodSummary + `{ year, quarter, items: PaymentItem[], letter|null, latestCalculation: TaxCalculation|null (result = ado-motor QuarterResult), approvedCalculationId, filed{filedOn,form,documents[]}|null }`. `POST …/calculate` and `POST /acc/tax-calculations/:id/approve` may return anything; the panel refetches the list.
  - `POST /acc/tax-periods/:id/filed` body sent by the panel: `{ filedOn, form:'2658', returnDocumentId, receiptDocumentId, returnFileId, receiptFileId }` (the two documents are uploaded first with `POST /acc/clients/:id/documents`, category `bevallas` / `nav_visszaigazolas`; the panel passes both the document ids and their current file ids – backend may use either).
  - `GET /acc/requests` → `{ items: (RequestSummary & { client:{id,name}, updatedAt? })[] }`. `GET /acc/clients/:id/notes` → `{ items:[{id,body,pinned,author,createdAt,updatedAt}] }`. `GET /acc/message-templates` → `{ items:[{id,title,body,global}] }`. `GET /acc/clients/:id/messages` → `Page<Message>` newest first, `sender` from the accountant's view: `'en'` (me) / `'ugyfel'` / `'rendszer'`.
  - `GET /acc/deadline-board?week=` → `{ week, prevWeek, nextWeek, days[7] (Mon..Sun), rows:[{ client:{id,name}, items: BoardItem[] }], overdue: (BoardItem & {client, daysOverdue})[] }`, `BoardItem = { id, kind, title, dueDate, status:'kesz'|'nyitott'|'lejart', overdue, amountHuf? }`.
  - `GET /acc/appointments` → `{ enabled, slots:[{id,startsAt,endsAt,channels,status}], appointments: (Appointment & {client:{id,name}, phone?})[] }`. `GET /acc/settings` → `{ displayName, firstName, title, registrationNumber, responseTimeText, appointmentsEnabled, monthlyStatementRequest, signatureSvgPath, avatarKey }` (the panel needs `firstName` for "Bence látta" and the signature for the letter preview).
  - `GET /acc/audit` and `GET /admin/audit` → `Page<{ id, at, actor{id,name,role}, action, targetType, targetId, client{id,name}|null, details }>`.
  - Admin: `GET /admin/clients` → `Page<{id,name,email,lifecycle,accountant{id,name}|null,subscriptionStatus,source,referralCode,createdAt}>`; `GET /admin/subscriptions` → `{ items:[{id,client,status,mode,priceHuf,currentPeriodEnd,nextChargeAt,failedAttempts,lastFailureCode,graceUntil,cancelAtPeriodEnd,card{mask,status,tokensLeft,expiry}|null}] }`; `GET /admin/payments` → `{ items:[{id,orderRef,client,kind,amountHuf,status,createdAt,finishedAt,errorCodes[],mode}] }`; `GET /admin/accountants` → `{ items:[{id,displayName,firstName,title,email,registrationNumber,clients,capacity,openRequests,overdueItems,waitingDocuments,active,appointmentsEnabled,nameForms{with,from,onto,acc}}] }` (POST also takes `nameForms`, §16); `GET /admin/referral-codes` → `{ items:[{id,code,ownerClient|null,campaign,note,active,signups,paying,createdAt}] }`; `GET /admin/attribution` → `{ rows:[{source,medium,campaign,code,signups,paying}] }`; `GET /admin/content-texts` → `{ items:[{key,group,description?,body,defaultBody,placeholders[],updatedAt,updatedBy,version}] }`; `GET /admin/faq` → `{ items:[{id,question,answer,sort,published}] }`; `GET /admin/demo-outbox` → `{ items:[{id,toDisplay,subject,bodyText,createdAt}] }`; `GET /admin/system` → `{ appEnv, version, modes{nav,simplepay,mail,push,invoice}, googleSignIn, appleSignIn, staffTotpRequired, workerHeartbeatAt, lastNavSync{at,ok,failed}|null, backupAgeHours|null, db }`.
  - Auth: the panel logs in with `clientKind:'panel'`, keeps the access token in memory, refreshes with the `__Host-kj_rt` cookie + `X-Kezjegy: 1`. When `STAFF_TOTP_REQUIRED=true` and the staff user has no TOTP yet, the API should answer staff routes with **403 `totp_setup_required`**; the panel then opens its 2FA setup page. A `client` user who logs in to the panel is shown "Ez a felület a könyvelőknek szól" and logged out.
- 2026-11-18 00:55 ado-motor: **Ready.** `kod/ado-motor`: `npm run check` = typecheck + 122 vitest tests + build → `dist/` (ESM + .d.ts). §7.6 A, B, C reproduce exactly. The §7.5 contract is unchanged; `test/szerzodes.test.ts` copies it verbatim and fails the typecheck if the package drifts. All additions are optional fields (list in `kod/ado-motor/README.md`). Validation throws `AdoMotorInputError { code:'validation_failed', fields:{path:message} }`; map it to HTTP 400.
- 2026-11-18 00:55 ado-motor: **HIPA correction (§7.1 row, §7.2 step 8, §7.4).** The kisvállalkozó sávos method (Htv. 39/A, text in force in 2026) has **one advance by the last day of May of the tax year**, equal to the previous year's tax (39/A (9)). The tax and a return (only if the tax is higher) are due by 31 May of the next year (39/A (7)–(8)). 16 March and 15 September are the general method's dates. The bands use inclusive upper bounds: ≤ 12 M → 2.5 M, ≤ 18 M → 6 M, ≤ 25 M → 8.5 M (retail átalányadózó up to 120 M), not "< 12 M". For a shorter year, revenue is annualised by days and the base is prorated (39/A (2)–(3)). No advance is due in the first year (41. § (4) b)). Engine output: `hipa.advances = [{ dueDate:'2026-06-01', amountHuf }]` (31 May 2026 is a Sunday) and `hipa.annualDueDate = '2027-05-31'`. `deadlinesFor(year, { hipaMethod })` defaults to `'savos'` and returns periodKeys `2026-HIPA-1` (befizetés, 2026-06-01) and `2026-HIPA` (bevallás, 2027-05-31). `'altalanos'` gives `-HIPA-1` 2026-03-16, `-HIPA-2` 2026-09-15 and `2026-HIPA`. Backend: build the HIPA periods from `deadlinesFor` with the client's `hipa_method`. [KÖNYVELŐ]
- 2026-11-18 00:55 ado-motor: **Explanation lines (§7.3).** Lines have an optional `kind`: `'cim'` (block heading with no amount; `side` holds the grey right-hand text, e.g. "július–szeptember"), `'sor'` (arithmetic row with op `−`/`=`), `'ado'` (highlighted tax row; the `ado` rows add up to the total) and `'megjegyzes'` (plain note, e.g. "A negyedév még tart…"). App: render `cim` as the design-07 `.bcim` and `ado` as `.s.ado`. Ignoring `kind` still reads correctly. The SZJA wording "már befizettél" became the row "Az előző negyedévek előlege", because the engine cannot know what was paid. The full Kata Q3 text is in `ado-motor/test/magyarazat.test.ts`. Kata's adómentes rész is reached in **June** on the fixture data; the "április" in the design is only illustrative.
- 2026-11-18 00:55 ado-motor: **Warnings and meters.** Every warning has `audience: 'ugyfel' | 'konyvelo'`, and client screens show only `ugyfel`. Codes added to §7.2 step 10: `afa_over`, `atalany_cap_over`, `atalany_cap_projected_over`, `hipa_savos_limit_over`, `revenue_before_start`, `retail_ratio_mismatch`, `kedvezmeny_nem_modellezett` (profile `allowances`; családi kedvezmény etc. are not modelled), `rules_draft`, `szja_tulfizetes`, and `cost_ratio_<year>_changed` (2026 → `cost_ratio_2026_changed`). Suggested panel flag: `hatar_kozel` = `meters.afa.warning || meters.atalanyCap.warning`. Meters add `detail` (the design-03 second line) and `remainingHuf`, and the sentences follow design 03 ("Még 11 758 000 Ft-ot számlázhatsz ÁFA nélkül."). Projection warnings start only after 60 active days. The ÁFA limit is not prorated for a mid-year start; the átalány cap is prorated by days.
- 2026-11-18 00:55 ado-motor: **Quarters and payments.** `quarters` holds the quarters that started on or before asOf and end on or after `atalanyFrom`. Find a quarter by `quarter`, not by array index. Payments with 0 Ft are omitted. `accountName` is NAV's full official name, `accountShortName` is for small screens. NAV's published IBANs (HU16…, HU22…, HU12…) are cross-checked by mod-97 in the tests.
- 2026-11-18 00:55 ado-motor: **Holidays.** 24 Dec is a public holiday from 2026 (Mt. amendment, November 2026). 2026-12-12 stays a working Saturday until the decree repealing it is found, because that only ever makes a deadline earlier. A worked Saturday counts as a working day [KÖNYVELŐ]. No 2027 NGM decree existed on 2026-11-18, so 2027 uses statutory holidays only. `RULES_2027` is a draft: 50 %, 22 M ÁFA limit, and the 2026 minimum wage until the 2027 decree; it emits `rules_draft`.
- 2026-11-18 00:55 ado-motor: **Tooling.** npm 10.9 crashes on vitest 5's optional peer chain (`Cannot read properties of null (reading 'edgesOut')`), and vitest 5 needs `vite` installed. ado-motor therefore has `.npmrc legacy-peer-deps=true` and `vite@8.3.8` as a devDependency. `nav-kliens/node_modules` has no `vite` either, so its `npm test` probably fails with "Cannot find package 'vite'". The same fix applies there: `npm i -D --save-exact vite@8.3.8 --legacy-peer-deps`.
- 2026-11-18 01:05 nav-kliens: **Ready.** `kod/nav-kliens`: `npm ci && npm test` (105 vitest tests) and `npm run build` → `dist/` (ESM + .d.ts + `dist/_shared` JSON). All §8.5 names and signatures are kept. **Additions (all optional / additive):** `NavClient.environment`; `queryInvoiceChainDigest()`; `syncInvoices({direction,since,asOf})` (INBOUND too); `checkConnection()` → `{ ok, code?, messageHu, taxpayerName? }` (never throws NavError; use it for `POST …/nav-credentials/test`); `createNavClientFromEnv(creds, env?)` (throws `NOT_CONFIGURED` in test/prod without `NAV_SOFTWARE_ID`/`NAV_DEV_NAME`/`NAV_DEV_CONTACT`, or with the demo id in prod); `navConfigFromEnv()` → `{ environment, baseUrl, software, configured, problems[], label, syncHour }` for `/health`; `demoCredentialsFor(taxNumber)` (fictional technical user that the mock checks strictly; seed Kata/Réka/Péter with it); `parseInvoiceDataXml(rawXml, { insDate, operation? })` for re-parsing stored XML. `NavError` also has `kind` ('auth','permission','unavailable','bug','clock','not_found','data','config','unknown') and `toJSON()` without free text. `InvoiceDigest` adds `supplierName?`, `index?`, `invoiceAppearance?`. `NormalizedInvoice` adds `vatExemption?` (invoice level, e.g. AAM), `modifyWithoutMaster?`, `customer.communityVatNumber?/thirdStateTaxId?`. Lines add `unitCode?`, `vatAmountHuf?`, `grossAmountHuf?`, `vatPercentage?`, `vatContent?`, `vatOutOfScope?`, `modifiesLine?`. `queryTaxpayer` adds `incorporation?`, `vatCode?`, `countyCode?`, `address?`, `infoDate?`. `createDemoTransport(fixtures?)` / `startMockServer({port, fixtures?, today?, pageSize?})`: fixtures default to the bundled `kod/shared/demo/fixtures.json`.
- 2026-11-18 01:05 nav-kliens: **Behaviour backend must know.** (1) `queryInvoiceData` alone cannot tell STORNO from MODIFY: from the XML, `invoiceReference` means `MODIFY`. `syncOutbound().data()` merges the digest (operation, insDate, transactionId, source, batchIndex), so store what `data()` returns. (2) Not found → `NavError INVOICE_NOT_FOUND` (NAV answers OK with no result). (3) Cursor: set `sync_cursor_ins_date` to the run's start time; the next run reads from cursor − 1 day, and digests are de-duplicated within a run but **not** across runs (skip by the §5.5 unique key). (4) In demo, every digest and invoice has `source:'DEMO'` → `demo: true`. (5) Fixture `KSZ-2026-032` is dated **2026-11-18**, after the demo today 2026-11-17, so the mock returns 32 of Kata's 33 invoices on 11-17 (gross 8 224 000 Ft + the 18 000 Ft manual receipt = `expectedAfaKeretUsedAsOfToday.kata` 8 242 000 ✓) and 33 from 11-18 on (real clock). (6) Mock QA trigger logins for panel error states: `hibas…` → INVALID_SECURITY_USER, `rosszkulcs…` → INVALID_REQUEST_SIGNATURE, `nincsjog…` → FORBIDDEN, `nemvalid…` → NOT_REGISTERED_CUSTOMER, `karbantart…` → HTTP 503. Any other well-formed login is accepted in demo; any other valid tax number gets deterministic generated invoices (incl. one STORNO per year) and INBOUND purchases. (7) The rate limiter works per process. API (connection test) and worker (sync) are two processes; a rare collision only costs NAV's +4 s delay. (8) Docker: the `file:` dep is a symlink. Run `npm ci && npm run build` inside `nav-kliens` in the build stage (or install with `--install-links`); runtime needs `dist/_shared/`.
- 2026-11-18 01:05 nav-kliens: **Verification.** Requests, mock responses and all 231 mock InvoiceData documents (3 demo clients + a generated taxpayer, OUTBOUND and INBOUND) validate against NAV's official XSDs (invoiceApi/invoiceData/invoiceBase 3.0 + NTCA common from `nav-gov-hu/Common` branch `release/common-1.0.x`; the RC3 tag lacks `ResponsePageType`). The checker is `nav-kliens/tools/xsd_check.py`. The signature unit tests use the 4 requestSignature values printed in NAV's own sample requests. `GeneralExceptionResponse` is in the **common** namespace (common.xsd), not api. Error HTTP statuses follow the spec table: FORBIDDEN, NOT_REGISTERED_CUSTOMER, INVALID_CUSTOMER and INVALID_USER_RELATION come as **HTTP 500** and are mapped by errorCode, never retried. MAINTENANCE_MODE reaches clients as a bare HTTP 503. §8.1's "1 req/s" list in the spec covers queryInvoiceData and queryTaxpayer (not queryInvoiceDigest); we space all calls anyway, as §8.1 says.

- 2026-11-18 01:05 jogi: **Ready.** `kod/jogi` is the package `@kezjegy/jogi` (ESM, `dist/` + `.d.ts`, like ado-motor; `.npmrc legacy-peer-deps=true`, `vite@8.3.8` dev dep). `npm run minden` = build → `app_szovegek.md` → `ellenoriz` (TERVEZET line, §21 Markdown subset, only registered placeholders, no hard-coded product name, 8 FAQ) → 23 vitest tests → `pdf_minta/*.pdf` (fictional Kata/Bence data). API for the backend (`"@kezjegy/jogi": "file:../jogi"`): `betoltIndex()` + `forras(docType)` → `{ elem: {version, title, requiresReconsent, effectiveFrom, …}, markdown, sha256 }` for the `legal_documents` upsert; `kitoltottDokumentum(docType, { adat?, hiany? })` → filled Markdown for `GET /legal/:docType` (brand + company filled from brand.json; pass the client's data for `megbizasi_szerzodes` when a client asks); `jogiPdf(docType, { adat, hiany, elfogadas?, betuDir? })` → `{ pdf, fajlnev, sha256, oldalak, hianyzo }` for `GET /client/legal-pdf/:docType` and the accepted-contract copy (`szerzodes_alairt`, §10.2 4.); `appSzovegek()` → `{ szovegek, gyik[8] }` for content defaults and the FAQ seed (§19.6). Missing data modes: `hiany: 'cimke'` ("[HIÁNYZÓ: …]"), `'ures'` (dotted blank), `'hiba'` (throws `HianyzoAdatHiba`). Inserted values are stripped of `**`, newlines and `{{ }}`. The backend image must contain `kod/jogi` (`index.json`, `*.md`, `sablonok/`, `fonts/`, `kepek/`, `dist/`); `dir` = LEGAL_DIR and `betuDir` = FONT_DIR can override the package paths.
- 2026-11-18 01:05 jogi: **index.json extras** (beyond §21's five fields; ignore what you do not need): `effectiveFrom`, `audience ('ugyfel'|'belso')`, `showInApp`, `pdf`, `pdfPrefilled`, `pdfTemplate`, `pdfTitle`, `data`, `draft`. The PDF of `nav_meghatalmazas` is the printable authorisation (`sablonok/nav_meghatalmazas_okirat.md`, only for method `alairt_pdf`); the PDF of `pmt_nyilatkozatok` is the filled Pmt. client due-diligence sheet (`sablonok/pmt_adatlap.md`; generate it when the accountant accepts the KYC, store as file kind `kyc`, accountant-only). Placeholders added to §21: `ceg.kepviselo`, `dok.verzio|hatalyos|cim` (automatic), `ugyfel.email`, `konyvelo.keresztnev|cim|adoszam`, `elofizetes.alkalom|honapok|max_osszeg` (config, defaults 12/12/price), `elofizetes.lejarat_ig|idoszak_vege_ig|kovetkezo_levonas|szunetel_datum_ig`, `simplepay.tranzakcio`, `hatarido.kovetkezo`, `arvaltozas.datum_tol|uj_ar`, `kyc.*`, `nyilatkozat.*` (checkbox `x` or one space). Keys ending `_ig`/`_tol` expect the suffixed date ("2027. január 8-ig"; helper `datumIg`). Full list with labels: `kod/jogi/src/helyorzok.ts`. Markdown extensions that degrade to plain text: `1. ` numbered steps and `- [ ]`/`- [x]` checkboxes.
- 2026-11-18 01:05 jogi: **KYC contract change (legal; affects §10.3, §12.4 `POST /client/kyc`, the app B6 screen and the panel KYC viewer).** Pmt. 7. § (8) excludes copying the side of the lakcímkártya that shows the személyi azonosító (that is the back). Collect **only the address side** (`addressFront`); `addressBack` must not be requested (make it optional/ignored; UI text `azonositas.lakcimkartya` in `app_szovegek.json`). The ID document may be a személyi igazolvány (both sides), an útlevél (data page only → `idBack` optional) or a kártyás jogosítvány (both sides). Keep the document expiry in `kyc_records.data_enc` (already listed in §5.4).
- 2026-11-18 01:05 jogi: **Consent UX.** The Adatkezelési tájékoztató is acknowledged, not consented to: checkbox "Elolvastam az Adatkezelési tájékoztatót." (`szerzodes.tudomasul_adatkezeles`). Above the ÁSZF checkbox show the five "kiemelt feltételek" (`szerzodes.kiemelt`, Ptk. 6:78. §). For the megbízási szerződés store the SHA-256 of the *filled* text returned by `jogiPdf`/`kitoltottDokumentum` together with the consent (proof of exactly what the client accepted; the PDF's acceptance block prints it). Payment result texts: cancel and timeout are separate keys (`fizetes.megszakitva`, `fizetes.idotullepes`). Suggestion [JOGI]: no money amounts in push bodies (lock screen; Expo/FCM/APNs are outside the EU).
- 2026-11-18 01:30 panel: built (`kod/panel`, README there). Typecheck, 16 vitest tests and `npm run build` pass; `scripts/check-dist.mjs` fails the build if mock code or source maps reach `dist/`. 43 screenshots 1440×900 in `kod/panel/_kepek/` from the `--mode mock` build (in-browser demo API in `src/mock`, never in a normal build). Extra calls/assumptions beyond the 00:40 note: `GET /files/:id` with Bearer for downloads (CSV and documents via `downloadVia`), `POST /files/:id/link` for `<img>` previews (KYC, photos); `PATCH /acc/revenue-items/:id` accepts `receivedOnEstimated:false` and `excludedReason:null` (restore); `POST /acc/clients/:id/nav-credentials/test` is the "…/test" of §12.5; `PATCH /acc/requests/:id` may carry `resultDocumentId` of a document the panel uploaded first (category `igazolas`); `GET /acc/requests?status=nyitott` is used for the sidebar badge (only `direction='ugyfeltol'` counted); `POST /acc/attachments` → `{fileId}`; `GET /auth/sessions` may return either `{items}` or a bare array. 3D icons used besides the 16: `szamlak`, `boritek`, `bevallas` (already in the approved 04 PNG), `befizetve_jel` and `*_arnyektalan` variants – all from `assets/ikon3d`.

- 2026-11-18 01:40 backend: **Ready.** `kod/backend`: `npm test` = 90 vitest tests on PGlite (KYC with the app payload, auth incl. refresh-reuse detection and TOTP, role/ownership matrix, uploads + encryption, document flow, approve → home → paid → verified → filed, SimplePay DEMO + IPN + dorecurring retries/suspension + sandbox mode against a signature-checking fake SimplePay, NAV sync = §7.6 C exactly for all three clients, GDPR export/delete, audit trigger, log redaction, full demo seed through the API); `npm run build`; `npm run smoke` runs the compiled `dist/` (health, config, seed, jobs). Wired to the real `@kezjegy/ado-motor` and `@kezjegy/nav-kliens` (`file:` links); the §3.2 fallbacks stay in `src/adapters/` unused. `Dockerfile` (context `kod/`, + `backend/Dockerfile.dockerignore`) builds both packages, then the backend; runtime keeps the `kod/` relative layout (`/app/backend`, `/app/ado-motor`, `/app/nav-kliens`), `/app/legal` = `kod/jogi` (index.json, *.md, app_szovegek.json, sablonok), `/app/fonts` = Geist. Not built with Docker here (no Docker on this PC). README lists every env var.
- 2026-11-18 01:40 backend: **For deploy.** API applies the migrations on start (`drizzle/`, journal-based); the worker waits up to 5 min for them – still give `kezjegy-worker` `depends_on: kezjegy-api: condition: service_healthy`. The image has a HEALTHCHECK on `/api/v1/health`. Runtime user in the image is `node` (1000); compose may override (`user: 1001:1001`) – then `/srv/kezjegy/data/files` must be writable by that uid. Seed: `docker compose run --rm kezjegy-api node dist/seed/index.js` with `SEED_CREDENTIALS_FILE` bind-mounted (600). Extra optional env: `TRUST_PROXY_HOPS` (1; client IP = last `X-Forwarded-For` entry, matching `header_up X-Forwarded-For {remote_host}`), `APP_VERSION`, `SKIP_MIGRATIONS`. `SIMPLEPAY_DEMO_SECRET` is required while SimplePay is in DEMO. In `APP_ENV=production` a DEMO value of any `*_MODE` is treated as **disabled** (503 `not_configured`), never as demo.
- 2026-11-18 01:40 backend: **Data-model deviations (§5).** `users.email` is `text` stored trimmed + lower-case with a unique index (same effect as citext; no extension needed). Added columns: `users.totp_pending_enc`; `clients.adoazonosito_last3`, `activity_answer`, `alairt_pdf_allowed` (accountant switch for method `alairt_pdf`); `client_tax_profiles.retail`; `tax_periods.latest_calculation_id`, `filed_on`; `tax_payment_items.calculation_id`, `voided_at`; `deadlines.period_key`, `related_appointment_id`; `nav_invoices.mod_key` (= coalesce(modification_index,0), part of the unique key), `demo`, `status_changed_at`; `subscriptions.next_retry_at`, `first_failed_at`, `renewal_notified_at`; `card_registrations.order_ref`; `payment_tokens.seq`; `simplepay_transactions.card_registration_id`, `token_id`, `applied_at` (idempotency), `platform`; `fee_invoices.error`; `consents.text_sha256`; `notifications.want_push`, `want_email`; `appointments.note`; `internal_notes.deleted_at`; new table `system_state` (worker heartbeat, last run of each job, `backup.last` for the backup script to write). The cost-ratio check allows **45, 50, 80, 90** (50 % is the 2027 general ratio; migration 0002). HIPA periods follow ado-motor's `deadlinesFor(year, { hipaMethod })` (sávos: one advance `YYYY-HIPA-1`).
- 2026-11-18 01:40 backend: **API details the app/panel can rely on.** Errors: `totp_setup_required` 403 (as the panel asked); login of an account under deletion → 403 `deletion_pending` (+`deletionDueAt`), resend the login with `cancelDeletion: true` to cancel. `/config` adds `simplepayEnabled`. `TaxCalculation.result` is the ado-motor `QuarterResult`; extra `context: { meters, hipa, warnings, disclaimer }`. Deadline ids are composite (`per:<periodId>:befizetes|bevallas`, `req:<id>`, `apt:<id>`, `dl:<id>`) and work with `/client/deadlines/:id/ics`. Signed file links: `POST /files/:id/link` → `{ url: "/api/v1/files/<id>?u=<userId>&exp=<unix>&sig=<hmac>" }` (5 min, relative URL; native must prefix the API origin). `POST /acc/attachments` works without `clientId` (the file is bound to the client when the message is sent) or with a `clientId` form field. `GET /acc/requests?status=nyitott_mind` = nyitott + folyamatban; `status` may also be a comma list. Added: `POST /acc/clients/:id/dossiers/:month/review { note? }` (the "Bence átnézte" card), `GET /acc/clients/:id/requests`, `POST /acc/documents/:id/versions`, `POST /admin/subscriptions/:id/card/delete`, `GET /admin/subscriptions/:id/card-status`, `GET /me/notifications` also returns `hasUnread`. `POST /acc/clients/:id/onboarding/meghatalmazas { status: 'ugyfelre_var', note? }` = "beadtam, hagyd jóvá az ONYA-ban" for method `onya_konyvelo`; the client then posts `{ method: 'onya_konyvelo', approved: true }`. `PATCH /acc/clients/:id/tax-profile` also takes `retail`, `atalanyFrom`, `alairtPdfAllowed`. `GET /client/nav-invoices/:id` returns the list fields + `invoice` (normalized data).
- 2026-11-18 01:40 backend: **KYC.** `POST /client/kyc` accepts both the SPEC names and the app's (`name` or `familyName`+`givenName`, `mothersBirthName`/`motherBirthName`, `documentType` `szemelyi`/`szemelyi_igazolvany`/`utlevel`/`jogositvany`, declarations `notifyChanges`/`changeDuty`). Per the jogi note (Pmt. 7. § (8)) **`addressBack` is ignored and never stored**; `idBack` is optional only for `utlevel`. The app still asks for the lakcímkártya back side – the app should drop that photo slot. KYC data JSON is encrypted (`APP_DATA_KEY`); `GET /client/kyc` never returns it.
- 2026-11-18 01:40 backend: **Behaviour choices.** Seed: Kata's bank statements are Jan–Sep (October is the open request of §19.3), 10 of 12 tokens used (registration month uses none) – the December `renewal_needed` still fires because the token window ends 2027-01-08. Renewal reminder = no active token left, or token window / card expiry within 30 days. Failed monthly charge keeps the token; retries at first failure +1/+3/+7 days; suspended at +14 days; a new card registration charges the due month and reactivates (`felfuggesztve` → `aktiv`). Fee invoices: DEMO PDF "DEMO DÍJBEKÉRŐ – NEM SZÁMLA" via `src/payments/invoices.ts`. GDPR delete after 30 days: sessions, push tokens, notifications, prefs, exports, attribution removed; user row pseudonymised (`torolt+<id>@deleted.invalid`); client files put on legal hold (tax data until 31 Dec of year+6, KYC and fee invoices 8 years) and purged by the 03:30 job when `retention_until` passes; audit rows older than 5 years purged with `SET LOCAL kezjegy.audit_purge`. The password blocklist is a compact list of common ≥ 10-character passwords plus sequence/repeat patterns (shorter ones fail on length anyway). TOTP accepts ±1 step without replay tracking. Document status "Bence látta" is set when the accountant opens the document detail. Every consent row stores `text_sha256` = SHA-256 of the exact filled text accepted (client data filled in; migration 0003), and the accepted contract PDF is stored in the dossier as `szerzodes_alairt`; the client legal PDFs use the backend's own Markdown typesetter (Geist), not `@kezjegy/jogi`'s `jogiPdf`. [JOGI] suggestion "no amounts in push bodies" is not applied (SPEC §16 example titles carry the amount) – owner to decide.
- 2026-11-18 03:00 app: **Ready.** `kod/app` (Expo SDK 58, expo-router, TS; README there). `npm run typecheck`, `npm test` (node:test: formatters incl. -án/-én/-ig suffixes and Europe/Budapest time, adószám/adóazonosító check digits), `npx expo-doctor` 18/18, Android Hermes bundle builds (`npx expo export -p android`). Web: `npm run export:web` → `kod/app/dist` (SPA, `web.output: single`; serve with `try_files {path} /index.html`; no inline scripts, styles are injected at runtime → CSP needs `style-src 'unsafe-inline'`, already in §4.5). The export runs `scripts/ellenoriz-dist.mjs`, which fails if any MINTA data reaches `dist/`. `npm run export:minta` → `dist-minta/` = a self-contained clickable demo with built-in fictional data (`?minta=kata|fizetendo|befizetve|ures|peter|uj|kint`), labelled "MINTA" on every screen; the mock is swapped out of normal builds by `metro.config.js`. 55 screenshots 390×844 @2x in `kod/app/_kepek/` (from dist-minta) + 10 in `_kepek/eles_backend/` taken against the **real backend** (DEMO, PGlite, seed) via `scripts/helyi-proba.mjs` (serves `dist/` + `/api/v1` on 127.0.0.1:8791, like Caddy). `scripts/szerzodes-proba.mjs <demo_belepesek.txt>` checks 32 client endpoints against that backend: all pass.
- 2026-11-18 03:00 app: **Deviations / decisions.** (1) Typeface: static instances of the design's own `app_v2/fontok/Geist_wght.ttf` at the exact design weights 400/500/550/600/650/700/750/800/900 (`assets/fonts/Geist-W*.ttf`, `scripts/fontok.py`), not `@expo-google-fonts/geist` (no 550/650/750). Geist lacks U+2713 ✓ and U+2011/U+2060: the checkbox ✓ falls back to the system font; the `T` text component inserts U+2060 so "10-ig", "18,5%-a", "NAV-nál" and "0 Ft" never break. (2) Icons: the 16 approved + `szamlak`, `boritek`, `bevallas` (as in the approved 04 PNG), `befizetve_jel`, `*_arnyektalan`; illustration `tepnaptar_3d` (02) and the rasterised `ures_mappa` (11) with the month as live text. The reserve icons `lakat`, `ora`, `kivonat`, `nyugta_uj` are not used. No line/vector icons; the Google "G" and the Apple button are the companies' own marks. (3) Fotózás button is white with the 2 pt ink ring (tokens.css 11-18, overrides TERV's "tömör tintakék"). (4) KYC screen follows the jogi/backend notes: lakcímkártya **address side only**, `idBack` not asked for útlevél; fields sent: `idFront`, `idBack?`, `addressFront`, `documentType`, `data` {name, birthName, mothersBirthName, birthPlace, birthDate, citizenship, address, documentType, documentNumber, documentExpiry}, `declarations` {ownBehalf, pep, pepDetails?, truthful, notifyChanges, signedAt}. (5) Consent screen: ÁSZF with the five "kiemelt feltételek", Adatkezelés as acknowledgement, Megbízás; all copy from `kod/jogi/app_szovegek.json`, copied into `src/_jogi/` by `npm run shared` (app falls back to its own text for missing keys). Payment result texts use the jogi keys (cancel and timeout separate). (6) Explanation renders the ado-motor `kind` lines (cim/sor/ado/megjegyzes); without `kind` it falls back to op order. (7) Login handles 403 `deletion_pending` (+`cancelDeletion: true`), `/config.simplepayEnabled === false` disables the card button with "A kártyás fizetés még nincs bekapcsolva.", `GET /client/nav-invoices/:id` with nested `invoice` is merged, `meters.*.detail` is shown when present, meghatalmazás `onya_konyvelo` approval is shown when the step is `ugyfelre_var` and `steps[].data.method === 'onya_konyvelo'`.
- 2026-11-18 03:00 app: **Asks to backend (optional, app degrades gracefully).** (a) `GET /client/onboarding` → add `onyaGuide: { accountantTaxId, ugykorok[] }` (the ONYA step-by-step shows the accountant's adóazonosító jel with a copy button, §10.2; today the app says "…üzenetben küldi el" and uses the jogi `meghatalmazas.ugykorok`). (b) `steps[].data.method` on the client's onboarding steps (for the `onya_konyvelo` approve card). (c) `AccountantPublic.nameForms.dat` ("Bencének") – the app derives it from `onto` (-re→-nek, -ra→-nak) for "Írj Bencének…". (d) On the becslés home the backend sends no `paymentItems`; the app then shows only the band (the design has no estimate sheet). (e) `hero.note` is printed under the due date as is.
- 2026-11-18 03:00 app: **Native build / owner.** Not built as APK/IPA tonight (needs EAS or Android SDK). Native-only modules: `react-native-document-scanner-plugin` (auto edges + deskew + multi-page), `expo-share-intent` (PDF/photo from other apps → Feltöltés), native Google sign-in (plugin added only when `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` is set). Expo Go / web fall back to camera with corner guides or file picker. Push registers only with an EAS `projectId` [OWNER]. Biometric lock: after ≥ 5 min in background and on cold start, gates the secure-store refresh token. Deep links: `kezjegy://elofizetes/eredmeny?e=&t=` (SimplePay `openAuthSessionAsync` return prefix `kezjegy://elofizetes`); web return `/fiok/elofizetes?eredmeny=…&t=…` is redirected to `/elofizetes/eredmeny`. Native API base `https://api.45-94-65-74.sslip.io/api/v1` (override `EXPO_PUBLIC_API_URL`).
- 2026-11-18 03:05 integrator: **Deployed on appok-1 (APP_ENV=demo).** https://app.45-94-65-74.sslip.io (web app), https://konyvelo.45-94-65-74.sslip.io (panel), https://api.45-94-65-74.sslip.io/api/v1 (native app, IPN, back URL) – **subdomains** (Let's Encrypt OK for all three). `/srv/kezjegy` = own compose project `kezjegy` (containers `kezjegy-db`, `kezjegy-api`, `kezjegy-worker`, `kezjegy-web`; volume `kezjegy_pgdata`; networks `kezjegy_edge`, `kezjegy_internal` internal). No `ports:`; `docker ps` shows only `appok-caddy-1` publishing. Gardoko health OK before and after. Deploy files: `kod/deploy/` (README there): `feltolt.sh` (PC → server, old folders to `_regi`), `up.sh`, `gen-env.sh`, `seed.sh`, `caddy-csatolas.sh`, `backup.sh`, `restore-proba.sh`, `https-proba.sh`, `bongeszo-proba.mjs`. Demo logins only in `/srv/kezjegy/demo_belepesek.txt` (600): `ssh appok-1 'cat /srv/kezjegy/demo_belepesek.txt'`.
- 2026-11-18 03:05 integrator: **Deviations from §20.** (1) The shared Caddy mounts the DIRECTORY `/srv/kezjegy/caddy:/etc/caddy/kezjegy:ro` and the Gardoko Caddyfile got `import /etc/caddy/kezjegy/*.caddy` (not a single-file mount: a replaced file would stay invisible to the running container); `up.sh` reloads the shared Caddy. Saved originals: `/srv/appok/_regi/docker-compose_20261118_024358.yml`, `/srv/appok/_regi/Caddyfile_20261118_024358`. (2) CSP (§4.5) is **enforced** on the static responses of `app.` and `konyvelo.` (`font-src 'self' data:`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` added; Google GSI style URL allowed); no violations in headless Chrome on login, registration, payment result, home. API host: no CSP from Caddy. (3) `kezjegy-web` runs as uid 1001, read-only, tmpfs `/data` `/config` owned by 1001. (4) `header_up X-Forwarded-For` dropped: Caddy's default already replaces untrusted XFF with the client IP. (5) Backups are not rotated (house rule: nothing is deleted) – rotation/offsite = [OWNER]. The 03:00 cron line is NOT installed yet (needs the owner's OK; command in `kod/deploy/README.md`); `backup.sh` + `restore-proba.sh` were run once (row counts equal).
- 2026-11-18 03:05 integrator: **Fixes made while wiring.** (a) backend `GET /payments/demo/pay`: CSP `form-action 'self' <APP_PUBLIC_URL origin> kezjegy:` – with `'self'` only, Chrome blocks the redirect chain after the submit (→ `/back` → app host or deep link) because API and web app are different hosts in production (invisible on a single-origin local test). (b) panel `refreshSession`: drains the error body (an unread fetch body kept the request pending; harmless for users, broke network-idle checks). (c) app: `android.permission.SYSTEM_ALERT_WINDOW` (Expo template) blocked. (d) `gen-env.sh` generates POSTGRES_PASSWORD and DATABASE_URL together.
- 2026-11-18 03:05 integrator: **Verification.** All package tests pass (ado-motor 122, nav-kliens 105, jogi 23, backend 90, panel 16, app 9 + typechecks). Panel (real build) against the real backend in-process: `kod/panel/scripts/eles-proba.mjs`, 37 pages, no failed API call, screenshots `kod/panel/_kepek/eles_backend/`. Live over HTTPS with curl, on the server: `bash /srv/kezjegy/deploy/https-proba.sh` → 113 OK / 0 HIBA (Kata/Bence/admin read flows, cookie + CSRF header, role isolation, then a NEW fictional client end to end: register → DEMO outbox code → questionnaire → consents → SimplePay DEMO → upload + signed link → message → KYC → meghatalmazás → accountant: seen, reply, KYC accept, optional appointment skipped, tax profile, NAV demo credentials/test/sync, calculate + approve → client home `jovahagyva` → mark paid → verified → audit; forgot/reset password, TOTP, GDPR export + delete; logs contain no e-mail/password/adóazonosító). Real browser over HTTPS: `node kod/deploy/bongeszo-proba.mjs` → 11 OK (screenshots `kod/_qa/eles_https/`). Test clients created by these scripts are fictional (`proba.*` / `bongeszo.*@demo.kezjegy.test`) and put into GDPR deletion at the end.
- 2026-11-18 03:05 integrator: **Android test APK** `C:/Users/UpgradePC/konyvelo_app/apk/Kezjegy-1.0.0-test.apk` (`apk/build-apk.sh`, same recipe as Gardoko: SDK on D:, JDK 17, Gradle home on D:, `windows-path.init.gradle` with CMake staging `D:/Atvitel/Android/cxk`), `com.somosi.kezjegy`, release build type signed with the public debug key, arm64-v8a + armeabi-v7a, talks to `https://api.45-94-65-74.sslip.io/api/v1`. Size and SHA-256 in `apk/Kezjegy-1.0.0-test.apk.sha256`.

- 2026-11-18 10:43 spec-26: **§26 written; `kod/shared` replaced cleanly** (the stopped run's partial files are in `kod/_regi/shared_src_par26_reszleges_1003/` and `_1020/`). Synced into backend, app, panel, jogi, nav-kliens; jogi and nav-kliens typecheck clean. **Expected compile breaks for the builders to fix** (exhaustive Records / new required fields): backend `src/notify/notify.ts` (15 new `NotificationKind`s), `src/services/documents.ts` (`ev_bejelentes` label), `src/services/onboarding.ts` (`OnboardingState.path/registration/callback`, `steps[].data.method` typed as `MeghatalmazasMethod`, `REQUIRED_STEPS` → `ONBOARDING_REQUIRED_STEPS`, new milestone `vallalkozas_elinditva`); panel `src/lib/labels.ts` (step `vallalkozas_inditas`, category `ev_bejelentes` label + icon), `src/mock/server.ts` + `src/pages/acc/UgyfelLista.tsx` (milestone `vallalkozas_elinditva`); app `src/api/minta/adatok.ts` (OnboardingState fields). The NAV guide PDFs downloaded by the NAV-képek job confirmed the field names used in `GUIDE_TEMPLATES` (Vállalkozói Ügysegéd útmutató 2026.03.19 III.3; ONYA képviseleti segédlet) and added two facts now in §26.1.4: the bejelentés is free, and the chamber registration is due within 5 working days (guide step `kamarai_regisztracio`).
- 2026-11-18 11:55 jogi: **§26.12 done** (drafts, "TERVEZET – jogász ellenőrzi"; old texts kept in `kod/jogi/_regi/par26_elott_20261118_1130/`). `npm run minden` green: typecheck, checker, 33 vitest tests, `pdf_minta/` + `_kepek/` regenerated and looked at. **Contract points for the other builders:**
  - **Version format:** changed docs are `2026-11-18.2` (aszf, adatkezeles, megbizasi_szerzodes, nav_meghatalmazas, adatfeldolgozoi, app_szovegek); `index.json` version = `YYYY-MM-DD` or `YYYY-MM-DD.N` (N 2–9; sorts correctly as text, the backend's `prev.version < doc.version` keeps working). `requiresReconsent: false` on every doc (owner's live accounts must not be blocked; [JOGI] decides before go-live). The backend upsert adds new `legal_documents` rows; old rows and consents stay untouched.
  - **ÁSZF** new sections `4/A.` (new-business help: what we do / do not do, client's own declaration Evectv. 6. § (4), start day = filing day, public data, chamber within 5 working days, guide valid for the 2026 NAV UI, fee from the recorded adószám [OWNER]) and `4/B.` (callback: 24–48 h target not a guarantee, workdays 9–17, any team member, max 3 tries, no recording, short note, summary as message, nothing final by phone, anti-fraud). Kiemelt feltételek +1 item → `app_szovegek.json` `szerzodes.kiemelt` now has **6** items (app: render the list, do not assume 5). **Adatkezelés:** 2.8 → "Üzenetek, kérések, visszahívás"; new 2.15 "Új vállalkozás indítása" (what we store, what we never ask: TAJ, anyja neve, születési hely/idő, állampolgárság, seat document); new 3.4 "Kik látják nálunk" (csapat per §26.4); retention: callbacks 1 year after closing, withdrawn registrations until account deletion, max 1 year after last login — **no purge job exists for either** [backend/OWNER, not in §26]. **Megbízás:** 2.7 (registration help is not representation), 6.2 (team contacts), 6.6 (no recording, nothing final by phone); section 6 renumbered 6.1–6.6 (no outside references). **Meghatalmazás:** initial EV bejelentés always by the client; meghatalmazás may be given before the business exists; "Kb. 20 perc"; [JOGI] note on the EV-register ügycsoport. **Adatfeldolgozói:** callbacks handed to the accountant, read-only registration, the accountant's adóazonosító jel shown to his clients (14.3).
  - **No EV-registration authorisation template** (owner chose self-service, §26.12) – stated in `kod/jogi/README.md` decision 9.
  - **`app_szovegek.json`:** FAQ 8 → **12** (the 8 old questions unchanged word for word, the 4 §26.2.7 questions appended verbatim; answers of #4 and #8 refined – the live DB keeps its old #4/#8 answers unless edited in `/admin/faq`; optional: the §26.9.3 data step may update them only where the row still equals the old default). New optional app keys `uj_vallalkozas.mit_teszunk|felelosseg|nem_taroljuk|dij|nyilvanos` (adatlap summary / hub; app falls back if unused) and `meghatalmazas.uj_vallalkozas`. New top-level block **`tartalom`** = jogi-reviewed §26 content texts under their exact content keys (`visszahivas.igeret|hivoszam|csalas|adatkezeles`, client `notif.callback_*`, `notif.registration_*` incl. variants `regi_idopont`, `adatlap`), `{single-brace}` placeholders, returned unchanged by `appSzovegek().tartalom`. They equal §26.2.2/§26.11 except two deliberate legal edits: `notif.callback_received.body` ends "…a jelszavadat, a kódjaidat vagy a kártyaadataidat." and `notif.registration_checked.title` = "Átnéztük a bejelentésedet" (our check is not an official check). **Backend:** please take these two into `defaults.hu.json` (or read the `tartalom` block of `LEGAL_DIR/app_szovegek.json` as defaults); `npm run ellenoriz` in jogi warns while they differ. **App:** re-run `npm run shared` (jogi-szovegek) to copy the new JSON.
  - Checker rules now enforced on all jogi texts (`src/szabalyok.ts`): no claim that we file the bejelentés, no booking offer, no lakcímkártya back side, no "AI", tegező, 12 FAQ with the 4 §26.2.7 questions, valid content keys, no amount/phone/tax id in push-capable notification texts, ÁSZF kiemelt list = `szerzodes.kiemelt`, ticked ügycsoportok = `meghatalmazas.ugykorok`. Backend legal tests (`kor2`/`kor3`/`seed`, filtered) pass against the new texts.

- 2026-11-18 12:25 guide-videos: **§26.7 `vallalkozas_bejelentes` + `meghatalmazas` built** in `C:/Users/UpgradePC/konyvelo_app/video/{vallalkozas_bejelentes,meghatalmazas}/` (engine `video/vallalkozas_bejelentes/eszkoz/`, README there). One command: `python C:/Users/UpgradePC/konyvelo_app/video/vallalkozas_bejelentes/eszkoz/epit.py mind` (TTS per line with the shared voice of `video/hang.json` → 3 blind transcriptions per line → retakes of the wrong lines only → render → `kod/media/` copies → checks).
  - **Voice NOT done yet:** OpenRouter answers 402 "Insufficient credits" to `google/gemini-3.8-flash-tts` (balance ~0.85 USD; the TTS pre-authorisation is higher, a smaller `max_tokens` does not help; the bekötés builder sees the same). Not topped up. `kod/media/vallalkozas_bejelentes.*` and `kod/media/meghatalmazas.*` are therefore an **interim silent version** (burned-in captions, silent AAC track, timing estimated at 13.5 chars/s). The command above replaces all three files of each video once there is credit (exit code 3 = still 402, outputs untouched). Integrator: deploying the interim is optional; the narrated files keep the same names.
  - Built with PIL + ffmpeg (not Remotion): the NAV images are re-composed from `utmutato_kepek/<kind>/index.json` with `annotate.py`'s own drawing (base + one layer per marker, pixel-identical to the published PNGs), so markers appear one by one at the narrated word and an owner re-annotation (`_sajat/` + `annotate.py`) flows into the video with the same command. Wide desktop NAV screenshots (ONYA) are zoomed to a readable scale (left part of a wide box = number disc + field label).
  - Contract notes for the app builder: (1) the files are 1080×1920, 30 fps, H.264 High + AAC 48 kHz mono, `+faststart`, two-pass to ~13.5 MB; posters 1080×1920 JPEG < 100 KB with the title inside the 4:5 crop. (2) The captions are burned in AND in the VTT; §26.7.3 says "captions on by default" – with both on, the viewer sees every caption twice. Suggest `default` off on the `<track>` (or keep it for screen readers only) – app decision, the files do not change. (3) The meghatalmazás video shows 15 of the 16 NAV images (16 = the list, covered by the app step); the bejelentés video shows 17 of 18 (the eu_igen variant of 10 is not shown – the video names the condition instead). (4) No product or accountant name is spoken or shown; the accountant is "a könyvelőd", the team "csapatunk".

- 2026-11-18 12:15 video-bekotes: **Built** `C:/Users/UpgradePC/konyvelo_app/video/bekotes/` (Remotion project + Python tools; one command `python eszkoz/minden.py`, details in its `render.md`). Outputs copied to `kod/media/bekotes.mp4`, `bekotes_poszter.jpg`, `bekotes.vtt` (H.264 High + AAC, +faststart, 1080×1920, 30 fps, 107.9 s, 13.6 MB; poster 113 KB; VTT `hu`, ≤ 2 × 42 chars). **The mp4 is currently a SILENT captioned preview**: OpenRouter refused every `google/gemini-3.8-flash-tts` call with 402 "Insufficient credits" (balance 0.974 USD; text chat calls still pass, so the TTS pre-authorisation exceeds the balance; no top-up per the owner's rule). Timing is estimated (4.4 syllables/s); when TTS is accepted, the same command voices it line by line, blind-checks every line, re-takes only wrong lines and re-times picture + captions to the real audio. Integrator/owner decide whether to deploy the silent preview or keep the §26.7.3 fallback ("A videó most nem érhető el…") until the voiced version exists.
- 2026-11-18 12:15 video-bekotes: **Shared voice** `C:/Users/UpgradePC/konyvelo_app/video/hang.json` = Gemini voice **Charon**, base style + moods + request shape — PROVISIONAL (chosen from the 2026-10-22 Hungarian measurements of the same model: 0 blind-transcript errors, warmest timbre), because no sample could be made today. `python video/bekotes/eszkoz/minta.py --hang-json` re-measures 3 voices and rewrites it; run it before any video is voiced for real.
- 2026-11-18 12:15 video-bekotes: **Contract notes.** (1) Burned-in captions exist for every spoken line except the opening/closing lines whose words are already on screen as big text; the VTT has all lines. Proposal for §26.7.3: do NOT mark the `<track>` `default` (native players would show the text twice); keep it selectable. [integrator decides] (2) Poster: everything readable sits in y 660–1260 (card cover crop) and inside the 4:5 crop. (3) If `NEW_BUSINESS_CHARGE_POLICY` becomes `azonnal`, only narration line L11 (3rd part) and the amber box in `remotion/src/Bekotes.tsx` `LepesSzerzodes` change (`minden.py` re-voices only that line). (4) The script never says the product or accountant name; the name on screen comes from `kod/shared/brand.json` at render time; the drawn avatar is the accountant's. Script reviewed by two independent reviewers in 4 rounds (`video/bekotes/szoveg/biralat_*.json`, decisions in `sorok.json`).

- 2026-11-18 12:30 backend (§26): **Ready, not deployed.** `kod/backend`: typecheck clean, `npm test` = 179 vitest tests (4 new files: `tulaj1118-vallalkozas`, `-visszahivas`, `-korlatozott`, `-csapat`, + the demo addition block in `seed.test.ts`), `npm run build`, `npm run smoke` (also runs the data step and the demo addition twice on the compiled `dist/`). Migrations `0008_tulaj1118_enumok.sql` (only `ADD VALUE IF NOT EXISTS`) and `0009_tulaj1118.sql` (tables + columns, text + CHECK) generated with drizzle-kit (journal not hand-edited). Existing tests that used dossier/tax/upload features on a fresh client now create it with `active: true` (restricted mode); the booking tests now expect 410.
- 2026-11-18 12:30 backend (§26): **API details beyond §26.10.** (1) Staff actions on a callback that is not theirs answer **409 `not_holder`** ("Előbb vedd magadra."); claim of someone else's answers 409 `conflict` with the holder's first name (admin `force: true` overrides). (2) An accountant who gives a callback back (`assign { userId: null }`) gets `{ ok: true, id }` (he no longer sees it). (3) `GET /team/callbacks` and `/team/registrations`, `/team/threads`: `cursor` = offset string ("50"), page size 50. Callbacks sort: open first, overdue first, then `dueAt`; filter `lezart` by `closedAt` desc. Registrations sort by `statusChangedAt` asc. (4) `GET /team/clients/:clientId` also opens for csapat when the client has an OPEN callback/registration (besides "last 90 days"). (5) For `csapat` viewers, message DTOs carry no `document` / `request` cards (the team never sees the dossier); `sender` is `'en'` for the viewer's own messages, `'csapat'` + `senderName` "{firstName} · ügyfélszolgálat" for other team members; accountant messages now carry `senderName` = his displayName. Reading a team thread is audited `message.thread_viewed`. (6) Meghatalmazás guide progress is stored in `onboarding_steps('meghatalmazas').data.guideProgress` (the bejelentés guide in `business_registrations.guide_progress`). (7) `PUT /client/profile` with the full questionnaire sets `business_status='van'` when it was null (no second question). On `inditas → van`, a client without adószám gets `adatok` back to `ugyfelre_var` (the "Rólad" page is not the full questionnaire). (8) Client `POST …/filed` and `…/adoszam` refuse a non-ÁFA-mentes adószám (middle digit ≠ 1) with 400 and content `vallalkozas.adoszam.nem_afamentes`; the team endpoint accepts it (the panel shows the amber warning). (9) `POST /client/documents` refuses category `ev_bejelentes` (only through `…/filed`). (10) Admin content edits accept the §26.8.1 group placeholders even when the default text does not use them (`GET /admin/content-texts` lists them in `placeholders`); new groups: Magyarázatok, Bekötés, Korlátozott mód, Vállalkozás bejelentése, Visszahívás.
- 2026-11-18 12:30 backend (§26): **Content keys added** besides §26.8.1: `vallalkozas.stop.mar_van_vallalkozas`, `vallalkozas.adoszam.nem_afamentes`, `visszahivas.lezaras_ok.<reason>` ({reasonText}), `visszahivas.toast`, `visszahivas.regi_idopont_megjegyzes`, `email.registration_needs_fix.body` ({note}), `email.staff_digest.subject|body`. `visszahivas.adatkezeles` is our default (jogi `app_szovegek.json` has no such key yet – [JOGI] may add it; the backend default is used until an admin edits it). The FAQ items come from jogi `gyik` when the question matches (it now has all 12), else from `services/datastep.ts`.
- 2026-11-18 12:30 backend (§26): **Deploy part (in `kod/deploy`, not applied):** `web.Caddyfile` `handle /media/*` (+ `uri strip_prefix`) on `:8080` before the SPA handlers, explicit types for mp4/vtt/json/jpg/png, `no-cache`, plain 404; `docker-compose.yml` mounts `../web/media:/srv/media:ro` into `kezjegy-web`; `feltolt.sh --media`; `seed-tulaj1118.sh`; `kezjegy.caddy` upload regex + `client/business-registration/filed`, `team/attachments` (60 MB); `env.example` new optional vars. The Caddyfile was not validated here (no Caddy on this PC) – validate on the server before `up.sh` (command in `deploy/README.md`). Integrator: `pg_dump` first; the worker runs the data step at start; then `seed-tulaj1118.sh`.
- 2026-11-18 12:30 backend (§26): **Open points.** The phone number of a callback is stored encrypted and shown in full only to its holder (audited); GDPR delete wipes callback numbers and notes (retention of the rest is [JOGI]). `jobAppointmentReminders` stays in `jobs.ts` but is never scheduled. Staff digest goes to every active csapat member and admin at 08:00 only when something waits. Before the first `csapat` login on a host with `STAFF_TOTP_REQUIRED=true` the member must set up 2FA (same as accountants).

- 2026-11-18 12:30 panel: **§26.3 built in `kod/panel`** (no backend team routes existed yet, so it runs against the contract with the in-browser mock: `npm run dev:mock`, `?mock_role=csapat` = Nagy Anna). Pages: `/visszahivasok` (queue + 480 px drawer: claim, Most hívom, attempt with outcome/summary/next time, assign, close without call, autosaved internal note, attempts, history; accountant sees only his rows, "Visszaadom a sorba" only), `/vallalkozas-inditas` (board ≥ 1280 px, chips + table below) and `/vallalkozas-inditas/:id` (answers edit drawer with ÖVTJ per activity → `PATCH {answers, ovtjKodok}`, check list → `check`, `request-fix`, `adoszam`, assign self/none, staff note), `/uzenetek[/:clientId]` (csapat only: `/team/threads`, messages, read marker, attachments), `/admin/csapat` (list, invite, suspend/re-enable), `/admin` service tiles (`AdminDashboard.service` optional), client tab "Visszahívások" (`GET /acc/clients/:id/callbacks`, create via `POST /team/clients/:id/callbacks`, old appointments read-only from `GET /acc/appointments`), Bekötés tab step `vallalkozas_inditas` (read-only `GET /acc/clients/:id/business-registration`; never "Rád vár" for the accountant and not counted in the tab badge), KYC viewer without any lakcímkártya back box. Role gate per page (`Csak` in `App.tsx`), menu from `lib/csapat.ts menuCsoportok` (unit-tested). Időpontok: page + tab moved to `kod/panel/_regi/idopontok_kivezetve_2026-11-18/`, `/idopontok` → `/visszahivasok`, appointments switch removed from `/beallitasok`, column removed from `/admin/konyvelok`, write calls removed from `endpoints.ts`.
- 2026-11-18 12:30 panel: **What the panel expects from the backend (beyond §26.10 as written).** (1) The accountant's menu shows Visszahívások only when `GET /team/callbacks?filter=mind` returns at least one row for him (= ever assigned to him); `GET /team/summary` is called only for csapat/admin. (2) `history[].text` already in Hungarian (printed as is; the panel sorts newest first itself); `attemptList` oldest first (the last item = last attempt, as the backend sends it). (2b) `POST /team/callbacks/:id/assign` by an accountant answers `{ ok, id }` – handled (drawer closes). (3) `TeamCallbackRow.minutesToDue` is computed at response time; the panel ticks it down locally. (4) "Hibás szám, várjuk az újat" is inferred from the last attempt's outcome `hibas_szam` – a `needsNewPhone` field on `TeamCallbackRow` would be cleaner (wish, not required). (5) `AccClientRow` carries no path: the client list prints "most indítja a vállalkozását" when `onboardingMilestone = 'vallalkozas_elinditva'` and counts the other milestones on the `van` line. (6) `POST /team/registrations/:id/assign {userId}` is used with the caller's own id or null only (no assignable list for registrations). (7) `/admin/szovegek` now names every §26.11 key of `backend/src/content/defaults.hu.json` (the panel test reads that file) and has samples for `phoneMasked, staffFirstName, reasonText, topicLabel, dueText, createdText, senderName, lines`.
- 2026-11-18 12:30 panel: **Deviation from §26.3.3 "PDF in an <iframe>/object":** impossible under the live panel CSP (`frame-src 'none'; object-src 'none'` in `deploy/kezjegy.caddy`) and the file responses (`sandbox` CSP + `X-Frame-Options: DENY`). The uploaded NAV confirmation: images inline with click-to-zoom, PDFs open in a new tab via the signed link (same as Dosszié), so the check list stays visible beside it. If the owner wants the PDF inside the page: allow `frame-src 'self'` on the panel host and drop `X-Frame-Options` for `ev_bejelentes` files (integrator + backend), or bundle pdf.js – not done.
- 2026-11-18 12:50 app (§26): **Built in `kod/app`, not deployed** (README section "Tulaj-kérések 11-18"). `npm run typecheck` clean, `npm test` = 19 node:test tests (new `tests/tulaj1118.test.ts`: ÖVTJ search "foto" → Fotózás, guide placeholders + közösségi adószám per answer, kepek.json files/kinds/missing/variants, every explainer has 3 blocks + an approved 3D icon/object, restricted-mode fallback, phone, ÁFA-mentes adószám), `npm run export:web` (no MINTA data in `dist/`), `npm run export:minta`. Screens: onboarding page with the tab bar (Főoldal active, amber todo badge), video card, branch question, every step with "Mi ez?", locked steps with `lakat` + reason, callback card; new-business hub + "Készítsd elő" (local ticks), 5-page adatlap, "Mit hova jelölj" guide on the annotated NAV images (tap → zoom viewer), upload, adószám, withdraw; meghatalmazás guide (the two other methods below it); `/visszahivas` (form, status, edit, cancel; `bekotes/idopont` redirects there; booking UI and hooks moved to `_regi/`); locked screens/sheets (Dosszié, Határidők, NAV-számlák, Fotózás without a request, igazolás requests) + 403 `locked_until_active` → sheet; explainer sheet and "Hol találom?" under fields; callback links on every step, Üzenetek tile + slim status card, Fiók row, GYIK block; notification settings without the legacy kinds. Screenshots LOOKED at: `kod/app/_kepek/k3_*_{390,360}.png` (MINTA) and `k3_h*_{390,360}.png` (the REAL backend 12:30 build with the 11-18 demo addition: Levente, Péter, Kata).
- 2026-11-18 12:50 app (§26): **Contract additions (app-owned files).** (1) `kod/media/utmutato/<kind>/kepek.json` items carry, besides `GuideImage`: `part` (order within one step key), `variant {field: 'workKind'|'euPartner', value}` (the app shows only the matching one; `nem_tudom` → `nem`; no workKind → `fofoglalkozas`), `sourceShort` (the line printed under the image), `markers[] {n, style, label, box}` (read out to screen readers). Written by `kod/app/scripts/utmutato-kepek.mjs` (+ `utmutato-kepek.map.json` for slug fallbacks); today 18 + 16 images, `missing`: `feltoltes_appban`, `kamarai_regisztracio` / `app_bekuldtem`. Re-run after every re-annotation (old files → `kod/media/utmutato/_regi/<ts>/`). (2) **Captions**: following both video builders' notes, the `<track>` is NOT `default` and the native player selects no subtitle track – the captions are burned in, so they are on by default anyway and never shown twice; the VTT stays selectable. (3) **Video card**: the vertical poster is shown whole as a 9:16 thumbnail on an ink-blue card with title, length (from `videok.json` if present) and the white "Lejátszás" capsule – a 200 pt wide cover crop cut the poster's drawn tab bar in half. Missing/failing file → poster (or `level_boritek`) + "A videó most nem érhető el. Minden lépést leírtunk lent." (HEAD check, no tracking). (4) If `GET /client/guides/:kind` answers 404 `not_found` (older backend), the app builds the same guide from `GUIDE_TEMPLATES` (`src/lib/utmutato.ts`); `Me.access` missing → derived from `CLIENT_FEATURE_RULES` + lifecycle. (5) `expo-video ~58.0.14` added with its config plugin (no background/PiP) → **the integrator needs a new APK**; external WebVTT is not loaded by expo-video, native shows the burned-in captions. (6) The local harness serves `kod/media` at `/media/` like Caddy (`scripts/media-kiszolgalo.mjs`: types, Range/206, `no-cache`, plain 404) and can run a backend compiled elsewhere (`BACKEND_KOD=<dir>`), so `kod/backend/dist` is never overwritten; it also runs `seedTulaj1118`.
- 2026-11-18 12:50 app (§26): **Open / for the integrator.** Live demo data: Levente's NAV PDF + Péter's mapped call render fine against the 12:30 backend. Not tested on a device (no APK built). The owner's `alex@` account (path not answered yet) will see "Van már egyéni vállalkozásod?" as the first card, nothing else changes for him. Port note: `kepek-k3.mjs` now refuses to shoot when its port is taken (another builder's server answered on 8796 once).
- 2026-11-18 13:30 integrator (§26): **Live on appok-1.** pg_dump `/srv/kezjegy/_regi/pg_dump_elotte_tulaj1118_20261118_131454.dump` → `feltolt.sh` + `up.sh` (migrations 0008 + 0009, 10 in the journal) → worker data step `{businessStatus: 14, callbacks: 2, faq: 4}` → `feltolt.sh --media` (videos, posters, VTT, `videok.json`, 34 guide images + 2 `kepek.json`) → `seed-tulaj1118.sh` (7 items; second run "már megvan"). `alex@` / `tulaj@`: snapshot before/after byte-identical (`deploy/tulaj-fiokok-allapot.sh`; users incl. hash md5s, clients, onboarding_steps, consents, subscriptions); both still have `business_status` NULL, so the app asks the branch question first. Gardoko health 200 before/after every step. Shared Caddy files copied to `/srv/appok/_regi/*_elotte_*tulaj1118_20261118_131523` before the reload; both Caddy configs validated on the server. `/media/*` checked with curl (200 `video/mp4`, Range → 206, `text/vtt; charset=utf-8`, missing → plain 404) and played in headless Chrome from the live origin (`kod/_qa/k3_eles_video.mjs`, readyState 4, 1080×1920). Previous web release's hashed chunks still answer 200.
- 2026-11-18 13:30 integrator (§26): **Contract change: `VideoManifest.items[].hasNarration?: boolean`** (optional). `kod/deploy/videok-json.mjs` writes `kod/media/videok.json` with ffprobe (duration, size) and `hasNarration = max_volume > -60 dB`; the app card says "Felirattal." instead of "Felirattal, hanggal." while it is false. All three videos are today the **silent captioned interim** (OpenRouter 402 for `google/gemini-3.8-flash-tts`, balance 0.83 USD, not topped up) – re-voice with the builders' one-command steps, then `videok-json.mjs` + `feltolt.sh --media`.
- 2026-11-18 13:30 integrator (§26): **Small app fixes while wiring.** (1) Tab badge on Főoldal = `todoCount` + 1 while the branch question is unanswered (was one less than the band's "Még N dolog"). (2) Active Főoldal: text link "Kérdésed van? Kérj visszahívást" under the accountant's letter (source `konyvelo_kartya`, §26.2.1 "accountant card … Főoldal" was missing for active clients). (3) "Készítsd elő", Ügyfélkapu+/DÁP row: "Ezt nem kérjük el: ezzel te lépsz be." instead of "…a NAV-os űrlapba te írod be." (4) `app.config.ts` 1.0.3 / versionCode 4; built `apk/Kezjegy-1.0.3-test.apk` (`PREBUILD=1 build-apk.sh`, expo-video classes in the dex, SHA-256 in `apk/README.md`; not tried on a device yet).
- 2026-11-18 13:30 integrator (§26): **End-to-end on the local harness** `node kod/_qa/k3_e2e.mjs` (one PGlite backend + app on :8811 + panel on :8812, demo seed + 11-18 addition + data step; logins via `/__helyi/belep`, never a typed password; one Chrome profile per shot) → `kod/_qa/k3_e*.png` (client, 390×844 @2x), `k3_p*.png` (team, 1440×900), results `kod/_qa/k3_e2e_eredmeny.json`. Covers: restricted-mode matrix via API (6 locked routes 403 `locked_until_active` with reason, 7 open routes 200, Kata active 200), all 35 explainers with three non-empty blocks, branch → hub → Rólad → 5-page adatlap → personalised guide (14 steps, no placeholder left, ÁFA/átalány/kata/pénzforgalmi/munkavégzés per answer) → annotated NAV images + zoom → videos play → PDF upload (`beadva`) → callback from "Elakadtál?" → team pipeline, 9-point check, adószám → `kesz` + milestone "Elindult a vállalkozásod" → callback queue: claim, "Most hívom" (client sees it), "Beszéltünk" + summary → summary in the client's thread → meghatalmazás guide + video + "Beküldtem" (`onya_ugyfel`) → Kata (active) callback from the Főoldal accountant link, seen by the team. Not re-run on the live host: `https-proba.sh` (logged-in live checks were not done; live checks were curl/DB/anonymous only).
- 2026-11-18 13:30 integrator (§26): **Open.** (a) Caddy answers a missing `/media/x.mp4` with 404 + `Content-Type: video/mp4` (the header is set before `file_server`; body "Nem található.") – harmless for the app (HEAD check uses `r.ok`), cosmetic. (b) `NEW_BUSINESS_CHARGE_POLICY`, `CALLBACK_CALLER_ID`, real team members – owner (§26.15). (c) Lawyer items §26.15 #20; retention purge for withdrawn registrations not built (jogi note 11:55).

---

- 2026-11-18 15:30 javító (k3c review of the 3 orders): **Contract changes, all additive (no migration).**
  - **ÖVTJ line before filing.** `BusinessActivity.ovtjNev?` + `BusinessActivityChoice.ovtjNev?` (official KSH ÖVTJ'25 line label; the team types it with the code in `PATCH /team/registrations/:id` `ovtjKodok[].ovtjNev`). The guide shows "{kód} – {név}" (or "{kód} ({our label})"), the copy button copies **only the code or the search word** (`GuideTemplateField.copyFrom`). While any activity has no code (`activityPending()` in `kod/shared/src/bekotes.ts`; today all 35 rows of `BUSINESS_ACTIVITIES` have `ovtjKod: null` → [KÖNYVELŐ]), the steps `tevekenysegek`, `ellenorzes`, `bekuldes` carry `GuideStep.hold` ("Várd meg, amíg megírjuk…"), `Guide.activityPending`, `BusinessRegistrationView.activityPending`, `TeamRegistrationRow.activityPending`; submit notifies the queue owners (`registration_submitted`, variant `tevekenyseg`, data `activityPending`); when the team's save makes it known → the client gets `registration_reminder` variant `tevekenyseg` "Megírtuk, melyik sort válaszd" (once per change); the daily reminder job stays quiet while pending. The upload is never blocked (if he filed anyway, the team checks the PDF).
  - **One personaliser** `personaliseGuide()` in `kod/shared/src/bekotes.ts` (backend `GET /client/guides/:kind` and the app's offline fallback use the same code). New per-item rows (`GuideTemplateField.each`: every telephely/fióktelep and every other activity gets its own rows), addresses split into irányítószám / település / közterület és házszám (one copy button each), székhelyszolgáltató name + adószám separately + "Az iratok őrzésének helye", Ellenőrzés rows for közösségi adószám, telephely/fióktelep, székhelyszolgáltató; `GuideStep.screenKind` ('nav' | 'kamara' | 'app': the step header says "KAMARAI OLDAL", and "NAV KÉPERNYŐ · RAJZOLT VÁZLAT" when all its pictures are drawn); the chamber step names the yearly 5 000 Ft kamarai hozzájárulás [KÖNYVELŐ: confirm]. `GUIDE_VERSION` = `2026-11-18.2`.
  - `PrepareItem.privacyNote` / `GuidePrepareItem.privacyNote?`: the exact line under each "Készítsd elő" row ("A bejelentéshez nem kérjük el. Az azonosításnál a pénzmosás elleni törvény miatt kell." / "Iratot nem kérünk, csak azt, hogy milyen jogon használod.").
  - `TeamRegistrationDetail.clientProfile?` `{ name, address }` read-only next to the check list (§26.4: for "Név, lakcím rendben" only). After `beadva` the panel shows the filing day as the start day.
  - `GET /me/notifications` never lists `LEGACY_NOTIFICATION_KINDS` (rows stay; also not counted as unread); `GET /admin/content-texts` items carry `legacy: true` for `notif|email.appointment_*` → `/admin/szovegek` group "Megszűnt" (last, with the note "nem küldjük ki").
  - `PUT /client/profile` address = the data-form rules (`isValidHuZip`, line 3–120).
  - jogi `nav_meghatalmazas` 2026-11-18.3 (no reconsent): "Ellenőrzés és benyújtás" → "Tovább".
  - App: lock card on `bekotes/azonositas`; `/bekotes?kovetkezo=1` scrolls to the next card; tab bar on GYIK and the legal reader (`/jogi/[tipus]?honnan=szerzodes` → Főoldal active); the callback tile in Üzenetek is separate from "Kérj tőle" ("Csapatunk 24–48 órán belül hív."); "Új kérés" before activation = "Kérdésem van" + a locked "Igazolás kérése"; tab labels max 110 % font, `aria-selected` / `aria-disabled` on the web; the tab bar fetches onboarding + requests itself while restricted (badge and Fotózás label are right on every screen).
  - Deploy 15:22–15:25: Gardoko 200 before/after, owner accounts snapshot `elotte_javito_20261118_152241` = after (VÁLTOZATLAN), pg_dump `/srv/kezjegy/_regi/pg_dump_elotte_javito_k3c_20261118_152241.dump`, `feltolt.sh` (code + web staged) and `feltolt.sh --media` (16 files replaced, old in `_regi/media_20261118_152411/`) done; **`up.sh` not run** (the builder's session was not permitted to restart containers) → live API/app/panel are still the 13:30 version until the owner runs `ssh appok-1 'bash /srv/kezjegy/deploy/up.sh'` (no new migration). Local proof: `node kod/_qa/k3d_javito.mjs` (14 checks OK, `kod/_qa/k3d_*.png`).
  - Videos: the guide renderer shows only the screenshot sheet (no cut labels/source lines), frames each marker on its box + korong, per-marker `nezet` / `skala` / `sor_eleje` in `forgatokonyv.json` (UJEGYKE: row start, then the button), ink-blue caption pills like the main video, an ink-blue closing frame (`vege`), 30 px source footer; the meghatalmazás segédlet's full title in `utmutato_kepek/meghatalmazas/index.json` (re-annotated). Main video encode: limited range BT.709 (`render.py kodol`), the current file re-encoded from `remotion/out/kep.mp4`. Still **silent**: OpenRouter balance 0.83 USD (402).
- 2026-11-18 17:30 jav-k3e: **k3c2 review fixes (contract changes)**
  - `activityPending` (shared): free text ("Írd le a saját szavaiddal") counts as pending ALSO next to list activities, until the team adds it as an activity row with a code and clears `activityFreeText` (panel: "Felveszem tevékenységként"). Guide: new conditions `sajat_szavakkal_is`, `szekhely_nem_szolgaltato`; placeholders `{foTevekenysegRovid}`, `{sajatSzavakkal}`, per-item `{aRovid}`; Tevékenységek gets a "További tevékenység (a saját szavaiddal …)" row, Ellenőrzés lists every activity in short form ("kód – név" or our label); Címadatok gets "Levelezési cím" and "Az iratok őrzésének helye" ("hagyd, ha nem kérdezi"). `kesz` keeps unresolved free text in `activity_text`.
  - `POST /team/registrations/:id/check` → 409 while `activityPending` (the team must code every activity from the PDF first). `evNyilvantartasiSzam` must match `/^\d{8}$/` on `POST /client/business-registration/filed`, `…/adoszam` and `POST /team/registrations/:id/adoszam` (400 "A nyilvántartási szám 8 számjegy.").
  - New shared constants: `ACTIVITY_PENDING_BANNER` (top of the guide + hub, promises "általában 1 munkanapon belül"), `ACTIVITY_PENDING_DEADLINE_WORKDAYS = 1` (panel pipeline: "ÖVTJ-kód kell … -ig" / red "lejárt"), `REGISTRATION_FIX_CHANNEL_TEXT` (address + activity → Vállalkozói Ügysegéd változásbejelentés; tax data → ONYA "Egyéni vállalkozó bejelentése", T101E – NAV Ügysegéd-útmutató 2026.03.19 pp. 4–5, 12, 18). Panel fix drawer: three templates (cím/tevékenység, adózási adat ONYA, kimaradt választás → the accountant decides [KÖNYVELŐ]).
  - Order 4 hole closed: `notify()` drops every `tax_*` kind for a client in `bekotes_alatt` (no in-app row, push or e-mail); `POST /acc/tax-calculations/:id/approve` and `/acc/tax-periods/:id/hipa-approve` → 409 for such clients (a draft `calculate` stays allowed); `jobReminders` tax loop only `lifecycle = 'aktiv'`. Panel Adó tab: notice + disabled "Jóváhagyom és elküldöm".
  - Callbacks: `TeamCallbackDetail.phone` is null once the callback is closed (no `callback.phone_viewed` then); status key `regi_idopont` (content `visszahivas.allapot.regi_idopont`, "Kollégánk {when} körül hív a {phoneMasked} számon, ahogy korábban egyeztettük.", `{when}` = `target_at`) for converted bookings while `uj` and not overdue. Panel `/visszahivasok?id=` = `?nyit=`; timers clamped (`varakozasPerc` ≤ 120, `hivasFolyik` ≤ 15, elapsed ≥ 0).
  - One-time data step `system_state['data.faq_biztonsag_1118']` (worker start): the FAQ "Biztonságban vannak az adataim?" answer is updated only if it is still the old default word for word.
  - App: tab bar + locked sheet FETCH `me` (staleTime 60 s) when logged in; `/tetel/:id` 403 `locked_until_active` → locked Dosszié sheet; tab bar on `/elofizetes/eredmeny` and `/keresek/uj`; only the 4 tabs are the tablist; badge "Főoldal, még N teendő"; locked `Sor` → `aria-disabled` + reason; month tabs `aria-selected`; collapsed video row "Bemutató videó · m:ss" (length never truncated, rounded down); band titles and the hero amount fit 320 px at large text. Version 1.0.4 (versionCode 5).
  - Videos (silent until the OpenRouter top-up): per-marker `nezet` boxes, new `"csak_ez"` jel option (earlier markers of the picture disappear), `NYITO_ARANY` 0.9, title card/poster centred with a larger object card; text fixes (telephely, közösségi adószám, "megírjuk, melyik sort válaszd", "Onyát"); b35 dropped and b01 shortened to stay ≤ 150 s.
  - Deploy: `up.sh` re-creates `kezjegy-web` (`--force-recreate`) and checks that the served index.html equals the one on disk; `feltolt.sh` says clearly that nothing is live until `up.sh`.
- 2026-11-18 18:50 színváltás:kék: **Palette = vivid blue `#1428DB`** (owner 17:50). Token NAMES unchanged (`tintakek` etc.), values per `dizajn/PALETTA.md`: brand `#1428DB`, link/secondary-button text `#1226B8`, secondary button `#DFE4FD`, ground `#E4E8F3`, ink `#10152B`, secondary text `#505873`/`#4A5270`, on-band secondary `#C9D2FF`, shadows `rgba(16,21,60,…)` (never the brand blue). App tab underline 24×4 pt, Fotózás ring 3 pt; video thumbnails on the blue card get a 1.5 pt white (45%) ring; NAV-image frames get an inner white hairline (`annotate.tomor_keret`, also used by the guide videos – pixel-equal). Icon/splash/adaptive-icon background `#1428DB` (android/ regenerated by `expo prebuild` – the native build cache was cleared by it, next APK build is a full one). E-mail template, DEMO pay page, backend + jogi PDFs, all 34 NAV images and the three videos (silent, no TTS) re-made. Danger red, amber tags, violet done-seal unchanged.
- 2026-11-19 12:40 B3 panel (§27): **built in `kod/panel`** against the contract with the in-browser mock (no `/team/assists` routes existed in the backend while building). `/helyettunk` queue + `/helyettunk/:id` detail (§27.6.2–27.6.3), callback drawer (assist banner, `hivas` list after "Beszéltünk" → `agreed`, "Kéri, hogy intézzük helyette?" → `POST /team/clients/:id/assists`, inline "Útvonal módosítása"), pipeline (chip + filter "Intézzük helyette", "Útvonalat váltott – már van vállalkozása", four-eyes hint), registration detail (assisted banner, client card with path history), accountant Bekötés tab ("Útvonal és Intézzük helyette" card, assist link instead of the old meghatalmazás buttons while an assist is open), admin tile + client block/unblock, staff notifications drawer, `/admin/szovegek` groups for the §27.9.2 prefixes, §27.5 wording. Typecheck, 61 vitest tests, `npm run build` (check-dist) pass; screenshots `kod/panel/_kepek/k5_*.png` (mock, 1440×900).
  - **What the panel expects from B1 (beyond §27.9 as written; all optional/additive):** (1) `TeamAssistDetail.approval?: { filedAt, dueOn, expiresAt, remindersSent, clientApprovedAt, expiredCount } | null` for the 4-day timer; without it the panel reads the filing time from the timeline entry `action: 'assist.ujegyke_filed'` (and `assist.client_approved`), so please use these action keys in `timeline`. (2) `POST /team/assists/:id/ev-filed` multipart fields: `file`, `items` (ONE field, a JSON array string), `filedOn`, optional `adoszam`, `evNyilvantartasiSzam`. (3) `GET /admin/clients` rows: `disabled?: boolean`, `disabledAt?`, `disabledReason?` (panel `AdminClientRow`); `POST /admin/clients/:id/disable|enable { reason }` as §27.9.1. (4) The panel fetches `GET /team/assists?filter=mind` (all pages, also for the accountant: menu item + "Neked" badge) and filters/counts the chips locally with `src/lib/helyettunk.ts`: "Nálam" = csapat: ball `csapat`; accountant: ball `konyvelo`; admin: ball `csapat`, or `konyvelo` when he is that client's accountant (= B1's `waitingOnMe` in `routes/team-helyettunk.ts`). "Lejárt jóváhagyás" chip = `meghatalmazas_lejart`, or `meghatalmazas_bekuldve` with `approvalDueOn` < today; B1's `approvalOverdue` also counts the due day itself (≤ today) – fine for the sidebar badge (= `waitingOnMe + approvalOverdue`), so the chip and the badge may differ by the items due today. (5) `filingData.adoazonositoJel` is hidden behind "Mutasd" in the UI only; the server audits `assist.data_viewed` when it sends the full value (every detail GET by the accountant/admin). If an audit per click is wanted, add `GET /team/assists/:id?mutasd=1` and tell B3. (6) Four eyes: the panel disables "Rendben, ellenőriztem" when `TeamRegistrationDetail.history` has an `assist.ev_filed` entry whose `by.userId` is the viewer (the API's 403 stays the real guard) – please write that history row on `ev-filed`. (7) The callback drawer reads `TeamCallbackDetail.clientCard.assist` (open or last closed) and `clientCard.pathHistory`; `TeamClientCard.businessStatus` = the current path. (8) Staff in-panel notifications: the panel now lists `GET /me/notifications` (sidebar "Értesítések" with the unread count, drawer, `POST /me/notifications/read`) and follows `link` when it starts with `/`; staff links should be panel routes: `/helyettunk/<assistId>`, `/vallalkozas-inditas/<registrationId>`, `/visszahivasok?nyit=<callbackId>` (covers `client_path_changed`, `assist_task`, `assist_approval_overdue`). Today `client_path_changed` links `/ugyfelek/<clientId>` (accountant-only route: csapat/admin land on their start page) and `assist_task` links `/helyettunk` – a per-recipient link (`/vallalkozas-inditas/<id>` or `/visszahivasok?nyit=<id>` for csapat/admin, `/helyettunk/<assistId>` for the accountant) would take them straight to the item. `GET /admin/clients` rows do not carry `disabled` yet (the panel then always offers "Fiók letiltása"). (9) `POST /team/clients/:clientId/path` errors are shown as they come (`path_change_needs_callback` with the blocker text); the dialog itself blocks `lifecycle ≠ bekotes_alatt` and a filed registration. (10) The accountant's Bekötés tab calls `GET /team/clients/:id` (allowed for own clients, §26.10).
  - **Round-2 findings (B3):** S9 – panel side done (admin Ügyfelek: "Fiók letiltása" / "Engedélyezem", reason required, confirm drawer, "Letiltva" label); needs B1's endpoints + the `disabled` row field. T8 – panel side done: the contribution form number comes from the period year (`jarulekNyomtatvany`: 2026 → 2658, 2027 → 2758) in the Adó tab texts and in the `POST /acc/tax-periods/:id/filed` body (`form`); the backend must accept 2758 for 2027 periods (B4). T12 – "Köztartozásmentességi igazolás" was already the only panel form; `src/lib/szoveg.test.ts` now guards it (+ no "anyád/édesanyád", no forbidden invoice wording, no hard-coded product name). O4 – fixed (`Beallitasok` session label `${brand.name} app`). O7 – fixed (`.kod-doboz` = Geist, tabular figures; the print-only recovery-code iframe keeps a system font – Geist is not loaded in that throw-away document). §27.5.3 B3 list – done (tab "Kiállított számlák", NavSzamlak empty text, Dosszié: "Kiállított számlák" section with `staffNoUpload` + a separate "Levél a NAV-tól" section, Bevételek chip/column/drawer text, Adó empty text, audit label, mock FAQ, README; `docStatusLabel(…, nav)` "Megérkezett" → "Letöltöttük"). T6 – the panel still has only the `hatar_kozel` flag; a separate "határ átlépve" flag needs a new `CLIENT_FLAGS` value in shared (not there) – not done. T10/T13 and the rest are not panel files.
  - Not verified against the real backend (B1's assist routes were not there yet): the integrator should run the panel against the PGlite harness once B1 is done (`kod/panel/scripts/jav1/panel_helyi.mjs` pattern) and look at `/helyettunk` with the §27.7.4 seed.
- 2026-11-19 12:20 B4 jogi (§27.10, only `kod/jogi`): **built.** New versions `2026-11-19` (aszf, adatkezeles, megbizasi_szerzodes, nav_meghatalmazas, adatfeldolgozoi, pmt_nyilatkozatok, app_szovegek; simplepay unchanged), all `requiresReconsent: false`; the accepted 11-18.2/.3 texts are kept in `kod/jogi/_regi/par27_elott_20261119/`. ÁSZF new **4/C. Intézzük helyetted** (+ Röviden, 4.1, 4/A.1–4/A.6, 4/B.6, 13. kiemelt #3), adatkezelés new **2.16** (+ Röviden, 2.9, 2.15, 3.2, 3.4, 8.), megbízás 2.1/2.7/3.2/4.1/4.2/new 4.6, `nav_meghatalmazas.md` "1. út / 2. út" + accountant UJEGYKE steps (J08, „VÉGLEGESÍTVE / Jóváhagyásra vár”) + EV filing as meghatalmazott, adatfeldolgozói new 7.2/B, FAQ 13, lawyer list `kod/jogi/UGYVED_KERDESEK_k5.md`. `npm run minden` green (ellenőrző 0 errors, 45 tests), `pdf_minta/` + `_kepek/` regenerated and looked at.
  - **For B1 – the instruction PDF (§27.3.3), no shared change:** template `kod/jogi/sablonok/ev_bejelentes_utasitas.md` (read it with `deps.legal.template('ev_bejelentes_utasitas.md')`); its version is in `kod/jogi/sablonok/sablonok.json` = **`2026-11-19`** (use it as `AssistConsentSummary.version`; the jogi version format has no `.1`, so not `2026-11-19.1`). Placeholders: `ugyfel.nev`, `utasitas.adoazonosito_jel_takart` ("•••••••456"), `konyvelo.nev`, `konyvelo.nyilvantartasi_szam`, `utasitas.szekhely|telephely|tevekenysegek|munkavegzes|adozas|kezdes` (each consent block's lines joined with "; "), `utasitas.nyilatkozat_szoveg` / `utasitas.utasitas_szoveg` (exactly the `declarationText` / `instructionText` the client saw), `utasitas.idopont` ("2026. november 19., 14:05", Budapest), `utasitas.ujjlenyomat` (= `consent_hash`), `utasitas.verzio`. Sanitise every value like jogi `biztonsagosErtek()` (drop newlines, `**`, `{{ }}`). Store the IP like `consents` (`ipHmac`): the adatkezelési tájékoztató 2.16 says "az IP-címedből képzett, vissza nem fejthető kód". Sample: `kod/jogi/pdf_minta/ev_bejelentes_utasitas.pdf`.
  - **For B1 – internal notes (round-2 O12):** in `backend/src/legal.ts` (public text, consent text, `/client/legal-pdf`, the okirat and the instruction template) remove `[JOGI…]`, `[TULAJ…]`, `[KÖNYVELŐ…]`, `[ELLENŐRIZNI…]` (also `A/B` combinations and `**[…]**`) with the preceding blanks, drop a line that becomes empty or an empty list item, collapse 3+ newlines – exactly jogi `BELSO_JEGYZET_MINTA` + `belsoJegyzetekNelkul()` (`kod/jogi/src/jogi.ts`); only for audience `ugyfel` documents (`adatfeldolgozoi` keeps them). `[CÉGADAT: …]` and `[SIMPLEPAY: …]` stay (missing values). Where a note stood in for a value it is now `[CÉGADAT: …]` (liability cap, invoicing and phone provider).
  - **For B1 – FAQ data step (§27.7.3):** 7 changed items carry `elozo_valasz` (+ `elozo_kerdes` for "Miért nem ti jelentitek be a vállalkozásomat?" → "Bejelentitek helyettem a vállalkozásomat?"), raw with `{{placeholders}}`: fill both with `fillLegal()` before comparing. New 13th item without `elozo_*`: insert if the question does not exist. Note: `backend/src/services/datastep.ts` `newFaqDefaults()` (the §26 step) still has its own fallback "Miért nem ti jelentitek be a vállalkozásomat?" – on a fresh DB (harness) it would be inserted next to the new "Bejelentitek helyettem…" because jogi no longer has that question; drop it there or let the §27 step also match that fallback text. **The `elozo_*` fields quote the old, now forbidden invoice wording on purpose** – the §27.5.4 QA scan (B2's `k27-szamla-szoveg.mjs`) must ignore JSON fields `elozo_kerdes` / `elozo_valasz`, and B2's `app/scripts/jogi-szovegek.mjs` may drop them from the app copy.
  - **For B1 – jogi `tartalom` (overrides the code defaults at runtime, `backend/src/content.ts`):** added the §27.8 client kinds `notif.assist_started|assist_mh_filed|assist_mh_reminder(.elso|.utolso_nap)|assist_mh_expired|assist_consent_needed(.ujra)|assist_ev_filed|kamara_reminder.title|body` with the SPEC placeholders (`{firstName}`, `{hatarido}`); the base `notif.assist_mh_reminder.*` = the `elso` text. Changed: `visszahivas.csalas` and `notif.callback_received.body` (+ "…, és nem lépünk be helyetted"), `notif.registration_reminder.adatlap.title` ("Folytasd a kérdőívet"), `notif.registration_checked.body` ("…a NAV-os értesítést…"), `notif.registration_done.body` = the §27.8 base text (the kamara sentence is not added – its date reaches the client through `kamara_reminder`), `notif.subscription_payment_failed.title|body` = the one retry sentence ("Az első sikertelen próbától számítva 1, 3 és 7 nap múlva újra megpróbáljuk…" = `RETRY_DAYS`, ÁSZF 6.5; replaces "Pár nap múlva"). One deliberate deviation: `notif.assist_ev_filed.title` = "{firstName} beküldte a bejelentésedet!" instead of "Bejelentettük a vállalkozásodat!" (the accountant files as meghatalmazott, not the company, ÁSZF 4/C.6) – **suggested for the orchestrator/[JOGI]:** the same wording for shared `ASSIST_TEXTS.filedTitle` and `ASSIST_STATUS_CLIENT_TEXT.bejelentes_bekuldve`.
  - **Suggested shared change ([JOGI], orchestrator):** `ASSIST_TEXTS.consentDeclaration` covers only declaration I of the NAV form's four (II main-activity conditions, III right to use the addresses, IV chamber notice are ticked by the accountant on the client's behalf). Proposed text in `kod/jogi/UGYVED_KERDESEK_k5.md` #3; not changed (shared is not mine). The jogi `helyettunk.*` texts are lawyer copies of `ASSIST_TEXTS` and `npm run ellenoriz` warns when they differ.
  - **Round-2 findings in `kod/jogi`:** O12 – fixed on the jogi side (above; backend side = B1). O6 – jogi side fixed: `pdf_minta/` regenerated, "a(z)" resolved by the filler (`nevelokFeloldasa()` = backend `huArticle()` rule), orphan headings fixed in the jogi typesetter; the port of the jogi typesetter into `backend/src/lib/pdf.ts` is **not done** (outside `kod/jogi` in this job). T12 – jogi part fixed ("köztartozásmentességi igazolás", "anyukád" in `uj_vallalkozas.nem_taroljuk`, "anyja születési neve" in adatkezelés/Pmt, one retry sentence). §27.5 wording fixed in every jogi text (ÁSZF 4.1/5.3/5.4, adatkezelés 2.5/2.6/3.2, megbízás 2.1/3.2, meghatalmazás, app texts, FAQ) and checked by the jogi tests over all `kod/jogi/*.md|*.json`; "NAV-os igazolás" → "NAV-os értesítés", "adatlap" → "kérdőív" in client texts. New content rules in `kod/jogi/src/szabalyok.ts` (unconditional "mi bejelentjük", csapat files, "bejegyeztet…", "ügyintézési díj", "jogi képviselet", asking for credentials, the old mother's-name word, §27.5 patterns; "soha nem kérjük el" required in ÁSZF, adatkezelés, megbízás, meghatalmazás and the FAQ).
- 2026-11-19 12:15 B1 backend (§27): **built in `kod/backend` (+ `kod/deploy` scripts/README), NOT deployed.** Typecheck + build clean; vitest 246 = 245 pass + 1 expected fail (T1 reproduction, below). New: `services/journey.ts` (the one journey, §27.4.2–27.4.3), `services/pathchange.ts` (§27.2), `services/assist.ts` + `routes/team-helyettunk.ts` (§27.3, §27.6, §27.9.1), `jobs-tulaj1119.ts` (`assist_approvals` every 15 min, `kamara_reminders` 10:00; one line in `jobDefs`, one digest line), `content/tulaj1119.ts` (+ `tulaj1119_regi.ts`, generated old texts), data step `data.tulaj1119` (worker start), `seed/tulaj1119.ts` + `deploy/seed-tulaj1119.sh` (Marika `?ki=marika`, Dávid `?ki=david`, Ilona), `lib/munkanap.ts`, `files/quota.ts`; tests `test/tulaj1119-ut|helyettunk|biztonsag.test.ts` + the 11-19 seed case in `seed.test.ts`.
  - **Contract changes / deviations (all additive):** (1) migrations are **0011** (`_enumok`, 10 × ADD VALUE), **0012** (§27.7.1 table + columns + 3 widened CHECKs, plus `users.totp_locked_until`) and **0013** (`clients.disabled_at|disabled_reason`, S9) – 0010 was already `0010_kor1_1119`. (2) Content keys are lower snake case (the admin route only takes `[a-z0-9_.]`): `bekotes.ut.band_todo`, `bekotes.ut.lepes.<step>.cim|ido|gomb|ido_segitett|gomb_segitett`, `bekotes.varakozas.<key>.felso|cim|szoveg`, `bekotes.ut.valtas.to_van`, `helyettunk.consent_instruction`, `szamlak.month_sub` …; extra keys `bekotes.ut.row_kihagyva|javitas_status|javitas_gomb|zarolt_*|ut_status_nincs|path_required`, `helyettunk.lezaras_ok.<reason>`, `helyettunk.hiba.*`, `vallalkozas.hint.jarulek_fo_kepesites` (T7), `notif.registration_done.kamara.*` (the §27.8 kamara sentence; jogi's base text stays). A jogi `tartalom` text that still equals the pre-§27 default word for word is superseded by the new default (`content.ts`); every other jogi text wins as before (so B4's `assist_ev_filed` title wins). (3) `AssistConsentSummary.version` = jogi `sablonok/sablonok.json` (`2026-11-19`); the hash = sha256 of canonical `{version, blocks}` where the "Kezdés napja" block enters with its title only (its date moves daily). The instruction PDF fills B4's template placeholders. (4) `TeamAssistDetail.approval {filedAt, dueOn, expiresAt, remindersSent, clientApprovedAt, expiredCount} | null` (B3's ask); `GET /admin/clients` rows `disabled`, `disabledAt`, `disabledReason`; `POST /admin/clients/:id/disable|enable {reason}` → 204. Timeline action keys `assist.<action>`; `ev-filed` also writes `assist.ev_filed` into the registration history. Staff links: `assist_task` → `/helyettunk/<assistId>`, atnezes → `/vallalkozas-inditas/<regId>`, `client_path_changed` → accountant `/ugyfelek/<id>`, csapat/admin `/vallalkozas-inditas/<regId>` (else `/visszahivasok?nyit=<cbId>`). (5) Rules made concrete: step locks never apply to an ACTIVE client; `PUT /client/profile` answers 409 `path_required` only in onboarding (an active legacy client without an answer still becomes 'van'); the old `/acc/clients/:id/onboarding/meghatalmazas` answers 409 while an assist is open (one place for the state); `POST /client/onboarding/meghatalmazas {onya_konyvelo, approved:true}` without an assist in the approval state keeps the old step flow; `POST /client/callbacks` (and a PATCH to) a `…_helyettem` topic opens/links the assist, `POST /team/clients/:id/callbacks` too; a kind `meghatalmazas` request is allowed before the contract (only the UJEGYKE waits for it); `canConsent` also before the meghatalmazás is live; push of the client `assist_*`/`kamara_reminder` kinds waits for 08:00 (`notifications.data.pushNotBefore`, the dispatcher skips the push until then, e-mail goes at once). (6) Journey: `ut` row statusText = the answer ("Már van vállalkozásom" / "Most indítom" / "Most indítom – ti intézitek"); `nincs` variant: `todoCount` = 1 (+ open requests), `remaining` = 7; a locked client row counts in `todoCount`; the meghatalmazás row follows the assist (its `most` action = `/bekotes/meghatalmazas/jovahagyas` with `dueText` "november 22-ig (még 3 nap)"); `waiting` falls back to `helyettunk_adoszam` after the EV filing. `ClientAccess.activationHint` = `journey.lockedSheetText` (also in `Me.access`). (7) The guide reminder job skips mode `segitett` in `utmutato`.
  - **Round-2 findings (B1):** S1 fixed (`totp_locked_until`; the password lock never blocks the second factor; test). S2 fixed (all comparisons of an account from addresses that never signed in share 30 per 24 h – reaching it closes every open code; reset mails max 5/h per account, counted in the DB; answer stays 202). S3 fixed (415 for a non-JSON body on every `readJson` route and `/auth/refresh`; `/auth/*` POST refuses `Sec-Fetch-Site: cross-site` and a foreign `Origin` – same host, the three public URLs and, outside production, localhost pass; native apps send none). S4 fixed (contract needs a confirmed e-mail and `adatok` kesz). S5 fixed in the API (slot per user id, 408 after 120 s); the Caddy `request_buffers` idea is in deploy/README for the integrator. S6 fixed (300 MB before / 4 GB after activation, `quota_exceeded` 413; free-disk floor `MIN_FREE_DISK_MB` 5120 → 507 – an absolute floor because the developer PCs run at 95 % and a % rule would stop the local harnesses; `filesFreeDiskPct` on the admin Rendszer page; unattached chat files count, nothing is deleted). S7 fixed (setup/enable need a confirmed e-mail; the reset that confirms a mailbox for the first time clears TOTP). S8 fixed (capacity counts confirmed clients only). S9 backend fixed (+ `megszunt` = read-only `/client/*`, 403 `megszunt`). S15 written: `pids_limit` on 4 services; the dedicated uid is OPT-IN (`KEZJEGY_UID/GID=10001` after the chown in deploy/README) – never by default. **S16 not done:** `/auth/register` signs the user in at once, so a uniform answer needs an app contract change (register → "check your mailbox" without tokens); the risk stays limited (5/h per address, 3/h per e-mail) – proposed for the orchestrator. T4 fixed (profile + periods for the start year AND the current year, recalculated after the registration). T5 backend part (computeHints uses the start year's rules and the retail cap). T7 fixed (both minimums when the main activity needs a qualification; `guaranteedMinimum` pre-set as a suggestion). O5 fixed in upload PDFs, ICS, SimplePay SDK string (`lib/pdf.ts` Producer is B4's file – still "Kezjegy"). O7 pay page (embedded Geist, `font-src data:`). O8 fixed (method-aware milestones, §27.5 wording). O11 fixed (journey numbers everywhere). O12 backend fixed (`stripInternalNotes` = jogi `BELSO_JEGYZET_MINTA` rule on every client legal text, templates and PDFs; `adatfeldolgozoi` keeps them).
  - **T1 (BLOCKER) – not fixed by B1:** the fix lives in `kod/ado-motor` (year.ts) and `backend/src/services/tax.ts`, both B4's per §27.0.5. Reproduced: `test/seed.test.ts` "round-2 tax BLOCKER T1" (Kata, +1 000 000 Ft dated 2026-09-20 after the Q3 approval → the Q4 estimate moves by 0 Ft instead of ≥ 82 500 Ft), marked `it.fails` – it turns red the moment the fix lands; then drop `.fails`.
- 2026-11-19 B2 app (§27): **done in `kod/app`** (old source in `kod/app/_regi/elotte_tulaj1119/`). Typecheck clean, `npm test` 31/31 (new `tests/tulaj1119.test.ts`: journey fallback, path change, `-ig` dates, image label, K5.1 + „anyukád” source scans). Screens S1–S25 as written; screenshots `kod/_qa/k5_app_*_{390,320}.png` (MINTA build, all looked at) + `k5_app_h*` (local harness, real backend snapshot of 11-19). Notes for B1/B3/integrator:
  - **Journey fallback:** the app renders `OnboardingState.journey` / `pathChange` when present; without them (old server, MINTA) it computes the same view in `src/lib/ut.ts` (`utEpit`, `utvaltasInfo`). Band, tab badge and locked sheet all read `journey.todoCount` / `journey.lockedSheetText` (the server's `activationHint` is only a last fallback). Interpretations B1 may want to mirror: a client row that the client already handed over (`konyvelore_var` self meghatalmazás / igazolványok, assisted `meghatalmazas_jovahagyva`) has `clientPart: false`, so each submit lowers the number by one; assisted `bejelentes` stays `var` (csapat, waiting `helyettunk_adoszam`) at `bejelentes_bekuldve` until the registration is `kesz`; assisted `vegso_jovahagyas` is `var` (csapat, `tevekenyseg_sor`) while `activityPending`. The app never relies on these: the server's journey wins.
  - **Endpoints used** exactly as §27.9.1: `PUT /client/onboarding/business-status {businessStatus, mode:'onallo'}` (the app sends `mode:'onallo'` with every `inditas`), `GET|POST /client/assist`, `…/:id/approved`, `GET|POST …/:id/consent` (`hash` echoed back), `…/:id/cancel`, `POST /client/business-registration/chamber {done}`, `GET /client/guides/meghatalmazas_jovahagyas` (409 `step_locked` → "Most nincs mit jóváhagynod"). Errors handled: 409 `path_change_needs_callback` / `conflict` → blocked sheet with "Kérem a visszahívást" (source `utvaltas`); `path_required`; `assist_already_open` → status screen; `assist_disabled` → `ASSIST_TEXTS.disabled` + callback; `assist_consent_stale` → reload + `consentStale`. Without `/client/assist` (404, old server) the request falls back to a plain callback (topic `vallalkozas_inditas` / `meghatalmazas`, note = the assisted topic label) so nothing is lost.
  - **`ASSIST_EV_VALID_UNTIL`:** the app hides the EV card after `ASSIST_EV_VALID_UNTIL_DEFAULT` (2026-12-31) by itself; the server kill switch is read from `Me.access.features[helyettunk].state === 'zarva'` (B1: set it while `ASSIST_EV_ENABLED=false`) and from 409 `assist_disabled`; either shows `ASSIST_TEXTS.disabled` + "Kérem a visszahívást" (topic `vallalkozas_inditas`). The meghatalmazás card is never hidden.
  - **Routes:** `bekotes/meghatalmazas.tsx` became `bekotes/meghatalmazas/index.tsx` (+ `jovahagyas.tsx`); new `helyettunk.tsx` (modal), `bekotes/vallalkozas/{kamara,engedely}.tsx`. Guides take `?lepes=N` (0 = intro) and `?egyben=1` (old long page); meghatalmazás `?mod=magam|pdf`. Consent `blocks[].editRoute` is pushed as is (e.g. `/bekotes/vallalkozas/adatlap?lap=3`).
  - **Image label (§27.1.2):** `kepCimke()` builds „NAV-képernyő · Forrás: NAV, {title without a leading "NAV:"}, {YYYY.MM.DD.}” / „… saját képernyőkép …” (title starting with „Saját”) / `GUIDE_IMAGE_LABELS.illusztracio`; `GUIDE_DRAWN_NOTE` shows while `kepek.json` has an `illusztracio` item. The normaliser already iterates `GUIDE_STEP_KEYS`; a kind without `utmutato_kepek/<kind>/index.json` is now a notice, not an error (B4's `meghatalmazas_jovahagyas` pictures can come later; the approval guide shows text only until then).
  - **Version:** 1.0.5 (6) was already built at 09:42 for the blue palette, so this round is **1.0.6 (versionCode 7)** + `android.allowBackup: false` (S13). Integrator: build the APK from this tree.
  - **Notification settings:** the 7 new client kinds (`assist_*`, `kamara_reminder`) are listed in Fiók → Értesítések; `PATCH /me` must accept them (B1).
  - **K5.1 script:** `node kod/app/scripts/k27-szamla-szoveg.mjs [--csak app|panel|backend|jogi|media]` (read-only; skips `*_regi.ts`, `"elozo_*"` lines and lines marked „szándékos”). State 11-19 13:10: app, panel, backend, jogi clean; **`kod/media/bekotes.vtt:28`** still says „A számláid maguktól megérkeznek a NAV-tól.” (B4, after the video job).
  - **Round-2 findings in B2's folders:** S13 fixed (allowBackup false); S14 fixed (success only when `GET /client/subscription` says `active`, else „Ellenőrizzük a fizetést”, after 40 s „írj nekünk”); T5 fixed (kérdőív page 5: prorated ÁFA line `afaLimitLine` + átalány cap from the planned start; server hints only when the server prorates too); T7 fixed in the app copy (`jarulekSzoveg(w, kepesites)` shows 117 558 Ft for qualification-bound main activities; "egyben utalod" → "Negyedévente fizeted.") – the stored `guaranteedMinimum` suggestion is B1; T11 fixed in the app (no „Jelentsd be Bencét”, no „Megmutatod, hogyan?”/„Készítsd elő” buttons – titles come from `JOURNEY_STEP_TEXTS`; Határidők: „kb.” amounts rounded to thousands; price on Regisztráció from `brand.json`; nyugdíj sentence lives in shared); T12 fixed in the app („Köztartozásmentességi igazolás” on Üzenetek, „adóigazolványodon” in the validator and Adataid, „anyukád” on Igazolványok + error text); O1 → 1.0.6 (7), integrator builds; O7: the app's 2FA secret and recovery codes are Geist with tabular figures (monospace removed); O9 fixed (Fiók during onboarding has „A fiókod · Mi ez?” → `fiok`; the four ID fields have „Hol találom?”); O10 fixed („Elakadtál?” in every state of S14 and S18); O11 fixed (one number, see above). Not done in the app: O15 (ID back side stays required – owner/lawyer).
  - **Verified on the local harness** (real backend snapshot of 11-19 13:00 with B1's journey/assist/seed, `node scripts/k5-ut-proba.mjs`, 10/10 OK): Marika's approval guide with the due date, one step per screen; Péter (has an adószám) → change sheet offers only the callback (`adoszam_megadva`); Marika inditas → van in 2 taps, toast „Visszavonom” restores „Most indítom”; Levente (filed) → blocked; Dávid → assist status on S14; band = tab badge = locked sheet everywhere. **K4.5 re-count (MINTA, 390 × 844, `scripts/k5-meres.mjs`):** EV guide 22.1 → 1.0–3.2 screens per step (median 1.8; steps 8 ÁFA 3.2 and 10 Ellenőrzés 3.0 are the long ones: 2 pictures + 6–8 field rows), meghatalmazás guide 13 → 1.0–2.4, approval guide 1.0–1.2, hub 3 → 1.0–1.2, Főoldal 2.3–2.4. The ≤ 1.5 target is not met on the long NAV steps; reaching it needs shorter step texts/field lists in the shared template (B4/SPEC owner) – pictures are already capped at half a screen (tap „Nagyítom”). Branch change: 2 taps from the Főoldal row, also from Rólad, Adataid 2, kérdőív gate + page 1, Fiók, hub „Mégsem most?”.
  - **Seen on the harness (B1, for the integrator):** `backend/src/services/documents.ts:35` still labels a downloaded issued-invoice batch „Megérkezett” (Dosszié row „3 kiállított számla · Megérkezett”); §27.5.2 says „Letöltöttük” (`NAV_ITEM_STATUS_LABELS.feltoltve`). One-word fix in B1's file; the app shows whatever the server sends.
  - **Shared text to check (B1 / SPEC owner):** `ASSIST_TEXTS.consentKezdes` ends "várhatóan {date}." while `{date}` is defined as "november 22." (with the period) → "november 22.." on the consent screen. Either drop the period from the template or fill `{date}` without it.

- 2026-11-19 13:25 Integrátor (§27): **live on appok-1** (backend + worker + app web + panel + media). Order as §27.0.5: Gardoko health 200 → owner snapshot `fiokok_elotte_integ1119_20261119_131813` → encrypted pg_dump `/srv/kezjegy/_regi/pg_dump_elotte_integ1119_20261119_131813.dump.gpg` (pg_restore -l: 381 objects; up.sh made its own `db_elotte_up_20261119_132053.dump.gpg`) → shared Caddy files copied to `/srv/appok/_regi/*_integ1119_20261119_131813` (kezjegy.caddy and web.Caddyfile unchanged) → `feltolt.sh` → `up.sh` (migrations 11 → 14 = 0011, 0012, 0013; worker data step `data.tulaj1119` = faqUpdated 7, faqInserted 1, assists 0, content 0) → `seed-tulaj1119.sh` (3 new: Marika, Dávid, Ilona; 2nd run "már megvan") → `feltolt.sh --media` (13 files: the 7 real NAV stills of the EV guide + @2x + `kepek.json`; live EV guide now 7 real / 11 drawn) → owner snapshot after: **VÁLTOZATLAN**; onboarding_steps md5 of the pre-existing clients identical before/after (KS); Gardoko 200 after.
  - **Integration fixes:** (1) **T1 BLOCKER fixed**: `ado-motor` `YearInput.approvedQuarters` (+ validation, `ENGINE_VERSION` 1.1.0): an approved quarter's APPROVED base and SZJA are the priors of the later quarters, so revenue landing in a closed quarter moves into the next open quarter; a changed approved-quarter revenue raises the accountant warning `jovahagyott_negyedev_valtozott` ("Lezárt negyedév bevétele változott – nézd át …"); a quarter covered by `priorOverrides` keeps the override. Backend `tax.ts` `approvedQuarterActuals()` feeds it from the approved calculations (manual SZJA override as given; TB override scales the base). New engine tests `ado-motor/test/jovahagyott.test.ts` (Kata +1 000 000 Ft → Q4 SZJA +82 500 Ft; moving Q4 revenue into the approved Q3 keeps Q4). The backend reproduction in `seed.test.ts` was failing for the wrong reason (its tokens had been revoked by the earlier "demo jelszócsere" case → TypeError, not the bug); it now logs in with rotated demo passwords and passes as a normal `it`. (2) "Megérkezett" → "Letöltöttük" for downloaded issued invoices (`backend/src/services/documents.ts`, app `tetel/[id].tsx`, app MINTA, panel mock). (3) Local harness with the 11-19 data step + seed: `kod/_qa/k5_integ_harness.mjs` (copy of `app/scripts/jav1/harness.mjs`).
  - **Tests:** backend 246/246 (22 files, no expected-fail left), ado-motor 138 (+5) + 1 skipped, nav-kliens 105, jogi 45 (+ `ellenoriz` 0 errors), panel 61, app 31; typecheck clean everywhere; panel `build` (check-dist) and app `export:web` clean; backend dist smoke OK. K5.1 scan: only `media/bekotes.vtt:28` (video). K3.9 credential grep: 0 hits.
  - **Local walk** (`node kod/_qa/k5_integ_proba.mjs`, harness :8881/:8882, no password typed): new client → branch question → "Még nincs" → mode sheet (Magam / Intézzétek helyettem) → journey (band = badge = 9) → "Módosítom" → van (toast + Visszavonom) → van journey → back to inditas → "Intézzétek helyettem" → callback form → assist `visszahivas_kerve` + callback; panel Anna sees it in `/helyettunk` and Visszahívások, detail with path history; Bence's queue ("Neked" on Dávid); Marika's approval card with the due date; Dávid's van journey. Screenshots `kod/_qa/k5_integ_01…16_*.png`, live start pages `k5_integ_20/21`, all looked at.
  - **Seen, not changed:** `pathchange.ts` treats ANY change within 30 s of the previous one as an undo (also a quick inditas → van right after the first answer is listed as "Visszavonta 30 mp-en belül" and gets no staff badge) – harmless, the comment says "back to the previous answer". `media/bekotes.vtt:28` (old invoice sentence) and `media/vallalkozas_bejelentes.vtt:16` ("anyád születési neve") are in the voiced videos: caption + voice must change together (video job, paid TTS). No pictures yet for `meghatalmazas_jovahagyas`.

## 25. Sources

Tax 2026
- NAV 100. sz. információs füzet – Az egyéni vállalkozók átalányadózásának alapvető szabályai (2026.02.20): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/100.-Az-egyeni-vallalkozok-atalanyadozasanak-alapveto-szabalyai-2026.-02.-20
- NAV 3. sz. információs füzet – Az egyéni vállalkozók szja- és járulékkötelezettsége (2026.08.31): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/03.-Az-egyeni-vallalkozok-szja--es-jarulekkotelezettsege-2026.-08.-31.
- NAV: Így adózunk jövőre: https://nav.gov.hu/sajtoszoba/hirek/Igy_adozunk_jovore
- NAV: Kedvező változások az átalányadózásban: https://nav.gov.hu/szja/ujdonsagok-tudnivalok/Kedvezo_valtozasok_az_atalanyadozasban
- NAV: Csökken a szocho alapja és változik az egyéni vállalkozók bevallási gyakorisága: https://nav.gov.hu/ado/szocialis_hozzajarulasi_ado/Csokken_a_szocialis_hozzajarulasi_ado_alapja_es_valtozik_az_egyeni_vallalkozok_bevallasi_gyakorisaga
- 426/2025. (XII. 23.) Korm. rendelet (minimálbér, garantált bérminimum 2026): https://njt.jog.gov.hu/jogszabaly/2025-426-20-22
- NAV információs füzetek 2026 (lista): https://nav.gov.hu/ugyfeliranytu/nezzen-utana/inf_fuz/2026
- NAV számlaszámok: https://nav.gov.hu/ugyfeliranytu/szamlaszamok/Ki_hogyan_fizethet_a_NAV-nak · IBAN: https://nav.gov.hu/ugyfeliranytu/szamlaszamok/iban/nav-adoztatasi-iban-szamlaszamok
- HIPA sávos egyszerűsített adóalap (önkormányzati tájékoztató példa): https://szegvar.hu/wp-content/uploads/2025/04/Tajekoztato-a-savos-adozasrol.pdf ; Htv.: https://njt.jog.gov.hu/jogszabaly/1990-100-00-00

NAV Online Számla
- Interface specification HU v3.0 (2026.02.12) and XSDs: https://github.com/nav-gov-hu/Online-Invoice (docs/API docs/hu, src/schemas/nav/gov/hu/OSA)
- Test / production API: https://api-test.onlineszamla.nav.gov.hu/invoiceService/v3 , https://api.onlineszamla.nav.gov.hu/invoiceService/v3

SimplePay
- Developer page: https://simplepay.hu/fejlesztoknek/
- API v2.1 general documentation (EN/HU): https://simplepartner.hu/download.php?target=v21docen , https://simplepartner.hu/download.php?target=v21dochu
- Card storage (oneclick + recurring, tokens, dorecurring, cardcancel, tokenquery) (EN/HU): https://simplepartner.hu/download.php?target=v21cardstoragedocen , https://simplepartner.hu/download.php?target=v21cardstoragedochu
- Sandbox admin: https://sandbox.simplepay.hu/admin/

Authorisation, signature, identification
- NAV – Állandó meghatalmazás (GYIK): https://nav.gov.hu/ugyfeliranytu/valaszol-a-nav/allando-meghatalmazas
- UJEGYKE nyomtatvány: https://nav.gov.hu/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/UJEGYKE
- AVDH megszűnése (Kormányhivatalok): https://kormanyhivatalok.hu/hirek/januar-1-tol-az-avdh-hitelesites-az-epapir-szolgaltatasban-erheto-el
- DÁP digitális aláírás: https://dap.gov.hu/ugyintezes/digitalis-alairas , https://dap.gov.hu/sugokozpont/digitalis-alairas , https://dap.gov.hu/hirek/webes-alairas
- Pmt. (2017. évi LIII. törvény): https://njt.jog.gov.hu/jogszabaly/2017-53-00-00

App stores (payments outside IAP for real-world services)
- Apple App Review Guidelines 3.1.3(e) Goods and Services Outside of the App: https://developer.apple.com/app-store/review/guidelines/#goods-and-services-outside-of-the-app
- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738

## 25. Review round 1 fixes (2026-11-18, 04:00–05:00) – contract changes

Behaviour
- Optional call: `idopont` never blocks activation (`REQUIRED_STEPS` = all steps except `idopont`); not counted in `todoCount`. Activation recomputes `next_flags` at once.
- Appointments: no overlapping availability per accountant (409); booking checks the accountant's booked calls in the same transaction; one future booking per client; `megtortent`/`elmaradt` only after `startsAt` (409). Durations are taken from the slot (no hard-coded "15 perc").
- Logout: Bearer-authenticated, no cookie CSRF check (the app also sends `X-Kezjegy: 1` on every request). A failed logout is reported to the user.
- E-mail codes: attempts are counted atomically before comparing (max 5 comparisons per code even under parallel requests); `/auth/password/reset` also limited per e-mail (10/h).
- TOTP: replay protection (`users.totp_last_step`), single-use MFA token (`mfa_challenges`, dead after 5 failures), per-user failure counter (5 → 15 min lock, any IP), recovery codes consumed under a row lock; codes are normalised (spaces, hyphens, invisible characters ignored).
- Staff: `STAFF_TOTP_REQUIRED` defaults to true; `APP_ENV=production` refuses false. Staff sessions: 7 days absolute, 12 h idle. Deactivating an accountant disables the user and revokes all sessions; inactive accountants get 404 everywhere (files included). `POST /admin/users/:id/disable|enable`.
- Every `/client/*` write needs a verified e-mail: `409 email_not_verified`.
- Logging: errors only through `safeErr()` (DB errors → name + SQLSTATE/constraint/table, never the query or parameters); unique violations answer 409.
- Uploads: images over 16 000 px per side or 50 MP are refused before decoding (413); PNG pixels per merged document ≤ 60 MP.
- GDPR exports are built every minute (`gdpr_export` job), not only at 03:30.
- Content texts: stale-while-revalidate cache (never a blocking reload inside a transaction); `notify()` supports text variants (`notif.<kind>.<variant>.*`); staff e-mail links point to the panel.
- Deadlines before the client joined are not ours (hidden unless we approved/filed them); `Deadline.verified=false` while a payment is marked but not verified.
- Subscription: a card change / restart prepays the NEXT unpaid month (`nextPaidStart`), never the same days twice; 2-minute double-tap guard; "Mégis maradok" needs an active card; a cancelled deletion restores the paid period as "cancelled at period end". Admin "megszűnt" cancels the subscription and deletes the card. Test-script clients (`clients.is_test`, utm `*proba*`/`qa_*`, DEMO only) are excluded from admin KPIs; MRR excludes subscriptions cancelled at period end.

API additions / changes
- `POST /acc/clients/:id/adoazonosito/reveal` → `{ adoazonositoJel }` (audited); `GET /acc/clients/:id` returns `adoazonositoJel: null` + `adoazonositoJelMasked`.
- `POST /acc/tax-periods/:id/letter { letterText }` – fixes an approved letter, amounts unchanged, neutral client notice.
- `PATCH /acc/requests/:id { status: 'visszavonva' }` – accountant withdraws his own open request.
- `GET /acc/clients/:id/revenue` → `totalHuf`; meters/milestones/deadlines/request labels in accountant wording.
- `GET /acc/clients/:id/kyc` → `fileMimes` (PDF uploads shown as links).
- `GET /client/onboarding` → `onyaGuide { accountantTaxId, accountantName, ugykorok[] }` (audited).
- `GET /client/home` → `serviceNotice?`; `DossierView.contracts[]`; `Deadline.verified?`; `RequestSummary.certificate.submittedToNavAt?`.
- `SubscriptionView.nextPaidPeriodStart`; `POST /client/subscription/start { purpose?: 'subscribe' | 'card_update' }` → `period { start, end }`.
- `PUT /client/profile`: `adoazonositoJel` may be empty once stored.
- `GET /admin/dashboard` → `endingSubscriptions`; overdue items = overdue requests + unpaid approved items + unfiled quarters due after the client joined.
- Migration `0004_kor1_biztonsag`: `mfa_challenges`, `users.totp_last_step`, `users.totp_failures`, `clients.is_test`.

---

## 26. Tulaj-kérések 11-18 (owner orders of 2026-11-18) – contract

Written 2026-11-18 10:20–11:30 by the SPEC author for the parallel builders (backend, app, panel, videos, jogi). **§26 wins over every older section where they differ** (in particular §2.3 "optional appointment", §6.1 `idopont`, §6.6, §10.2–§10.3, §12.4 "Deadlines, appointments", §12.5 `/acc/appointments`, §15 hourly appointment job, §16 `appointment_*`, §17.3 `bekotes/idopont`, §18 `/idopontok`, §19.2 `appointments_enabled = true`). Shared code: `kod/shared/src/enums.ts` (enums, labels, restricted matrix), `kod/shared/src/bekotes.ts` (explainer texts, "Készítsd elő", activity list, guide templates, helpers), `kod/shared/src/api.ts` (DTOs, block "SPEC §26"). The constant names quoted below are exported from there. Contract changes during the build go to §24 as usual.

### 26.0 Orders → sections, principles

| # | Owner's words (11-18) | Where |
|---|---|---|
| 1 + 7 | New businesses too: if the client has no business yet, **he files the EV bejelentés himself** with a personalised in-app guide ("Mit hova jelölj"), uploads the NAV confirmation, our team only checks it. No team filing, no mandatory call. | §26.1, §26.6 |
| 2 | No time-slot booking. **"Kérj visszahívást"** – a colleague calls within 24–48 hours; not necessarily the accountant first. Everywhere. | §26.2, §26.3, §26.4 |
| 3 | The bottom bar disappeared during onboarding → it stays. | §26.5.1 |
| 4 | Until the account is connected, some functions are **limited**, enforced by the API too. | §26.5.2 |
| 5 | Explainer **video** on the onboarding page + "Mi ez? Miért kell? Hol találod?" for **every** item. | §26.7, §26.8 |
| 6 | Video: "Köszönjük, hogy telepítetted az alkalmazásunkat" → what the app is good for → the onboarding steps. Gemini 3.8 TTS via OpenRouter. | §26.7.4 |
| 8 | The two guides get their own short narrated videos: `/media/vallalkozas_bejelentes.mp4`, `/media/meghatalmazas.mp4`. "Készítsd elő" opens the new-business guide. We never store TAJ or anyja neve. | §26.6, §26.7 |
| 9 | Guides and guide videos use **real NAV screenshots with markings** (numbered markers, boxes, arrows, personal data blurred, source noted); drawn "Illusztráció" only where no official screenshot exists. Nobody of us logs in to NAV. | §26.6.4 |
| 7 (KYC) | Never ask for the back of the lakcímkártya (Pmt. 7. § (8) a)). | §26.1.9 |

Principles: (1) **The live DB is never wiped or reseeded**; every migration is additive (§26.9); `alex@demo.kezjegy.test` and `tulaj@demo.kezjegy.test` keep their progress. (2) Help is optional everywhere ("Elakadtál? Kérj visszahívást"), never a gate. (3) Server-side checks for every lock (§26.5). (4) Hungarian, tegező, short words; never mention AI; product and accountant names only from `brand.json` / `AccountantPublic`. (5) Design: approved C2 set only – realistic 3D icons (`ICON3D` + `ICON3D_EXTRA`), the drawn avatar for the accountant only, object visuals from `assets/illusztraciok`; no line icons, no pastel circles. (6) Glossary: **csapat** = our service team (ügyfélszolgálat, role `csapat`); **bekötés** = onboarding; **aktiválás** = lifecycle `bekotes_alatt` → `aktiv`.

### 26.1 New business – self-service (orders 1, 7, 8)

#### 26.1.1 The branch question
- Shown on the onboarding page (Főoldal during onboarding) as the first card while `clients.business_status IS NULL`: title **"Van már egyéni vállalkozásod?"**, two large choices on a white sheet: **"Igen, van"** (`van`) and **"Még nincs, most indítanám"** (`inditas`), plus the "Mi ez?" link (explainer `vallalkozas_van_e`). Nothing else on the page is hidden; the other step cards show below in the `van` order until answered.
- `PUT /client/onboarding/business-status { businessStatus }` stores it. Switching is allowed while lifecycle is `bekotes_alatt` and there is no registration in `beadva | javitas | ellenorizve | kesz` (else 409 `conflict`, message "A bejelentésedet már beküldted. Ha mégsem kell, írj nekünk."). `van → inditas`: creates (or reopens with a new row if the last one is `elallt`) a registration in `kitoltes` and the step row `vallalkozas_inditas` = `ugyfelre_var`. `inditas → van`: the open registration → `elallt` (reason `mar_van_vallalkozasa`), step → `kihagyva`.
- **Existing clients are never asked again:** the one-time data step (§26.9.3) sets `business_status = 'van'` for every client who already has an `adoszam`. Clients without one (e.g. the owner's mid-onboarding account if he has not saved the questionnaire yet) see the question; their other step rows stay as they are.

#### 26.1.2 "Adataid" on the new path
Path `van`: unchanged (§17.3 `bekotes/adatok`, 3 pages). Path `inditas`: only the **"Rólad"** page (név, telefon – required here, adóazonosító jel, lakcím) → `PUT /client/profile` with **ClientProfileStartInput**; the `adatok` step becomes `kesz` when it is saved. Adószám, EV-szám, székhely település, tevékenység, mióta, költséghányad and "Helyzeted" are NOT asked: the registration supplies them at `kesz` (§26.1.8). "Eddigi könyvelő" is not asked on this path.

#### 26.1.3 The new-business data form ("Adatlap", screen `bekotes/vallalkozas/adatlap`)
Five short pages, one question group each, progress "2/5" in the band, "Tovább" saves a draft (`PUT /client/business-registration`, partial body), "Vissza" never loses data. Every field has a "Hol találom?" link to its explainer (§26.8.2). The "Elakadtál? Kérj visszahívást" link sits at the bottom of every page (source `vallalkozas_adatlap`, topic `vallalkozas_inditas`).

| Page | Fields (API name) | Rules |
|---|---|---|
| 1 "Mielőtt elkezded" | `declarations.noExclusion` (checkbox "Rám ezek egyike sem igaz" under the list of exclusions from explainer `kizaro_okok`), `declarations.singleBusiness` ("Most nincs másik élő egyéni vállalkozásom"), `revenueBand` (3 choices, `REVENUE_BAND_LABELS`) | both declarations must be true to submit; if the client says he has a live business → link "Mégis van vállalkozásom" (switches path). `revenueBand = 'tobb_20m'` → **stop card** (hints.stop `tobb_20m`, text `vallalkozas.stop.tobb_20m`: "Ennyi bevétel mellett nem lehetsz alanyi ÁFA-mentes. Szolgáltatásunk most az ÁFA-mentes egyéni vállalkozóknak szól. Ha kérdésed van, kérj visszahívást.") – submit returns 409 `conflict` |
| 2 "Mivel foglalkozol?" | `activities[]` `{ key, label?, main }`, `activityFreeText` | search over `BUSINESS_ACTIVITIES` (label + keywords, accent-insensitive, top 8 as you type; the full list in a sheet). 1 main + at most 4 others. Not found → free text (≤ 200) "Írd le a saját szavaiddal" (`ACTIVITY_NOT_FOUND_TEXT`); then the team picks the line (pipeline). Under the choice: **cost-ratio hint** (`hints.costRatioText`) and, when `kepesitesKellhet`, `ACTIVITY_QUALIFICATION_NOTE` |
| 3 "Hol lesz a székhelyed?" | `seat.kind` (`lakcim` / `mas_cim` / `szekhelyszolgaltato`), `seat.address` (not for `lakcim`), `seat.right` (for `mas_cim`), `seat.provider { name, adoszam }` (for `szekhelyszolgaltato`), `otherSites[] { address }` (question "Lesz üzleted, irodád vagy műhelyed másik címen?" Nincs / Van) | amber note (always): "A székhely címe nyilvános lesz: bárki megnézheti a nyilvántartásban." Address: zip `isValidHuZip`, city 1–60, line 3–120. Provider adószám: §19.1 check digit. ≤ 3 other sites; the backend sets `kind` = `telephely` (same city as the seat) or `fioktelep` |
| 4 "Hogyan dolgozol majd?" | `workKind` (4 choices, `WORK_KIND_LABELS`), `euPartner` (nem / igen / nem_tudom), `hasSeparateBusinessAccount` (optional) | under `workKind`: `hints.contributionText`, e.g. főállás: "Főállásban akkor is fizetsz havonta legalább 101 682 Ft járulékot (TB + szocho), ha kevés a bevételed. Negyedévente egyben utalod." (= round(322 800 × 18,5%) + round(322 800 × 13%), from `RULES_2026`); munkaviszony / tanulmány mellett: "Mellékállásban nincs legkisebb járulék: csak a tényleges jövedelmed után fizetsz."; saját jogú nyugdíjas (kiegészítő tevékenység): "Saját jogú nyugdíjasként nem fizetsz TB-járulékot és szochót, csak SZJA-t a tényleges jövedelmed után." (content `vallalkozas.hint.jarulek_nyugdij`, as `ado-motor` explanation.ts) [KÖNYVELŐ] |
| 5 "Mikor indulsz?" + Összefoglaló | `startPlan` (`mielobb` / `datum`), `startDate` (only `datum`: today … today + 180 days) | text from explainer `kezdes_napja`: the business starts on the day the client sends the bejelentés; a date is only his reminder (deadline-free). Summary of all answers with "Módosítom" per block, then **"Kérem az útmutatót"** → `POST /client/business-registration/submit` |

Hints (`BusinessRegistrationHints`, computed by the backend on every save, using `@kezjegy/ado-motor`): `costClass` = class of the main activity (`ellenorizendo` and free text → `costRatio: null`, text "A költséghányadot {firstName} mondja meg."); `costRatio` from `costRatioForActivity(COST_CLASS_ANSWER[costClass])`; text "A tevékenységed alapján a költséghányadod várhatóan {ratio}%. 2027-től az általános költséghányad 50%. {firstName} megerősíti." – the 2027 sentence only for `altalanos`; 80/90% use `vallalkozas.hint.koltseghanyad_kulonleges` without it; `afaLimitHuf` 20 000 000; `atalanyCapHuf` = 38 736 000 prorated by days from the planned start (today when `mielobb`) to 31 Dec (`RULES_2026`); `stop` as above (`kizaro_ok` when `noExclusion === false` was answered explicitly). The client never gets a tax amount here other than the minimum contribution sentence.

**We do not ask for or store**: TAJ-szám, anyja neve, születési hely/idő, állampolgárság, the document of the right to use the seat. The client types them into the NAV form himself ("Készítsd elő", §26.6.1). The data minimisation is stated in the adatkezelési tájékoztató (§26.12).

#### 26.1.4 Facts the flow relies on (research 11-18; sources §26.16)
- The bejelentés is **free** (díj- és illetékmentes). NAV issues the adószám and registers the business without delay ("haladéktalanul"); there is no expedited procedure. Separately, the new EV must apply to the területi gazdasági kamara on the chamber's own form **within 5 working days** (MKIK: https://mkik.hu/vallalkozoi-regisztracio) – the guide's last step `kamarai_regisztracio`. Later data changes: within 15 days (munkavégzés jellege in ONYA). The activity list is KSH **ÖVTJ'25** (https://www.ksh.hu/osztalyozasok_ovtj25); qualification/permit requirements: KAVIR (https://kavir.mkik.hu). (NAV Ügysegéd-útmutató 2026.03.19, III.2–3.)
- Since 2026-02-19 the EV bejelentés is filed in the **NAV Ügyfélportál → Vállalkozói Ügysegéd** (`https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main`), mobile-friendly, login with KAÜ (**Ügyfélkapu+ or DÁP**), or in person at a NAV ügyfélszolgálat. Not by phone, not by post. Help with KAÜ login: 1818 (Kormányzati Ügyfélvonal).
- Screens: Személyi adatok (prefilled from the register; on a mismatch the client must contact NAV) → Vállalkozói címadatok (székhely, telephely, fióktelep) → Tevékenységek (ÖVTJ, főtevékenység) → Adózási adatok ("A munkavégzés jellege" **mandatory**; "A katával kapcsolatos nyilatkozat"; "Az átalányadózás választásával kapcsolatos nyilatkozat" (Szja tv. 50. § (6)); "Az áfafizetési kötelezettség megállapításának módja" (only for ÁFA payers → empty); **"Áfamentesség" point 2 "Az alanyi adómentesség választása"** (only this point); "Közösségi adószám igénylése"; MNB/EKB-árfolyam; "A pénzforgalmi elszámolás választásával kapcsolatos nyilatkozat"; Áfa tv. 49/A., 89/A., 96. § bejelentések → empty) → Nyilatkozatok (kizáró okok) → Ellenőrzés → after "Bejelentés megtétele" the bejelentés **cannot be modified or withdrawn** → Megtekintés (the értesítés can be downloaded as PDF).
- The business may start on the day of registration; no expedited procedure; no future start-date field was found → **filing day = start day**.
- The ÁFA election must be made together with the start (Art. 16. § (2)); átalányadó election is part of the same bejelentés (Art. 1. melléklet 1.17).
- The seat must be owned or lawfully used (Evectv. 16. § (6)); no document is attached; seat/telephely/fióktelep **addresses become public** (Evectv. 12. § (2)).
- Exclusions (Evectv. 3. § (2)) and "one EV at a time" (3. § (3)) – explainer `kizaro_okok`.
- The NAV UJEGYKE meghatalmazás is tied to the person's adóazonosító jel, so it can be given **before** the business exists and stays valid after; given by the meghatalmazó in ONYA it needs no approval by a non-lawyer meghatalmazott and is live in ~20 minutes.
- **From 2027-01-01** the register moves to the chamber (MKIK, területi kamarák; 2026. évi III. tv.) – the guide is valid until 2026-12-31 (§26.6.5).
- Filing on behalf of the client for a fee may be "ügyvédi tevékenység" outside the accountant's tax authorisation (Üttv. 2. §, 4. §; the EV-nyilvántartási ügycsoport is "kivéve adóügyek") – a further reason the owner chose self-service. [JOGI] confirms that guiding + checking is fine.

#### 26.1.5 Registration state machine (`business_registrations.status`, `REGISTRATION_STATUSES`)
```
kitoltes ──submit──► utmutato ──client "Beküldtem" + PDF──► beadva ──team "Ellenőriztem"──► ellenorizve ──adószám──► kesz
                         ▲                                    │  ▲                                  (or directly kesz when the
                         │                                    ▼  │ client re-uploads                 adószám is already known)
                         │                                 javitas (team note)
any open status ──client "Leállítom" / path switch──► elallt
```
- `submit`: validates everything (400 `validation_failed` with `fields`; 409 when `hints.stop`), sets `submitted_at`, status `utmutato`. The guide (§26.6) is available from now on; the first `GET /client/guides/vallalkozas_bejelentes` sets `guide_opened_at`.
- `filed` (`POST /client/business-registration/filed`, multipart `file` + `filedOn` (today − 60 days … today) + `channel` (`FILING_CHANNELS`) + optional `adoszam`, `evNyilvantartasiSzam`): allowed in `utmutato` and `javitas`. The file (PDF or image, §12.7 rules) becomes a document, category **`ev_bejelentes`**, source `ugyfel`, visibility `kozos`, dossier month = month of `filedOn`, listed in `DossierView.contracts`; a re-upload in `javitas` adds a new version. Status → `beadva`, `fix_note` cleared. Notification `registration_submitted` to the team.
- Team check (`POST /team/registrations/:id/check { items }`): `items` must contain all `REGISTRATION_CHECK_ITEMS` (else 400). → `ellenorizve`, or straight to `kesz` when `adoszam` is already stored. Notification `registration_checked` (or `registration_done`).
- Team fix request (`POST /team/registrations/:id/request-fix { note }`, 1–1000 chars, shown to the client as is): allowed in `beadva`, `ellenorizve`. → `javitas`. Typical note: what to change with a "változásbejelentés" in the Ügysegéd (the original cannot be edited). Notification `registration_needs_fix`.
- Adószám: client (`POST /client/business-registration/adoszam`, allowed in `beadva`, `javitas`, `ellenorizve`) or team (`POST /team/registrations/:id/adoszam`, also `registeredOn` required). Validated with the §19.1 check digit; the middle digit must be `1` (alanyi adómentes ÁFA-kód) – otherwise the client sees "Ez az adószám nem ÁFA-mentes vállalkozásé. Nézd meg még egyszer, vagy írj nekünk." and the team sees an amber warning but may still save. When stored in `ellenorizve` → `kesz`; in `beadva`/`javitas` it is only stored (the team check then goes straight to `kesz`).
- `withdraw` (`POST /client/business-registration/withdraw { reason, note? }`): any open status → `elallt`; `clients.business_status` → NULL (the branch question shows again). Never deletes the uploaded document.
- One open registration per client (partial unique index). Every transition: audit `registration.<action>` (§26.9.4), `status_changed_at`, step row update (`REGISTRATION_STEP_STATUS`), flags recompute.
- Reminders (worker, daily 10:00): status `utmutato` and no `filed` for 3 days → `registration_reminder` (once), again after 10 days (max 2, `reminder_count`); `kitoltes` untouched for 3 days → the same kind, variant `adatlap` (max 1). Quiet when the client has an open callback.

#### 26.1.6 Onboarding steps, order, locks, milestones, activation
- Step order per path: `ONBOARDING_STEP_ORDER` (van: fiok, adatok, szerzodes, elofizetes, meghatalmazas, azonositas, nav_bekotes; inditas: fiok, adatok, **vallalkozas_inditas**, szerzodes, meghatalmazas, azonositas, elofizetes, nav_bekotes). `GET /client/onboarding` lists steps in this order and **never lists `idopont`**.
- Required for activation: `ONBOARDING_REQUIRED_STEPS[path ?? 'van']` (replaces `REQUIRED_STEPS` in `backend/src/services/onboarding.ts`; a missing `vallalkozas_inditas` row must never block a `van` client – existing active clients stay active).
- `vallalkozas_inditas` step status is derived from the registration (`REGISTRATION_STEP_STATUS`): kitoltes/utmutato → `ugyfelre_var`, beadva/ellenorizve → `konyvelore_var` (client text "Átnézzük" / "Várjuk az adószámot"), javitas → `hianyos` (note = fix note), kesz → `kesz`, elallt → `kihagyva`.
- **Locks on the `inditas` path** (`steps[].locked` + `lockedReason`, and the matching endpoints answer 409 `step_locked`): `meghatalmazas` and `azonositas` until the registration is `beadva` or later ("Ha beküldted a bejelentést, ez is megnyílik."); `elofizetes` per §26.1.7 ("Akkor kérjük a kártyádat, ha már megvan az adószámod. Addig minden ingyenes."); `nav_bekotes` (accountant step) until `kesz`. `szerzodes` is open at any time. Path `van`: no locks (unchanged).
- Milestones: `MILESTONE_ORDER[path]`; on `inditas` the first milestone is **"Vállalkozás elindítva"** (done = registration `kesz`; sub-texts like the others, e.g. current: "Ha beküldted, feltöltöd a NAV-os igazolást, és átnézzük.").
- `todoCount` counts open client-side steps that are not locked plus open accountant requests (unchanged rule otherwise).
- Activation (lifecycle `aktiv`) exactly as before, with the path's required steps. Restricted mode ends at the same moment (§26.5).

#### 26.1.7 When is a new-business client charged? [OWNER decision]
Default **`adoszam_utan`** (`NEW_BUSINESS_CHARGE_POLICY` env, `NEW_BUSINESS_CHARGE_POLICY_DEFAULT`): on the `inditas` path the `elofizetes` step stays locked until the registration is `kesz`; then the normal SimplePay card registration charges the first month (no proration, as today). Reason: we provide no accounting before the business exists, nothing to refund if the client never files, and the guide is a pre-sales help. Alternative `azonnal`: `elofizetes` is open right after `szerzodes` (first month paid while the registration runs). `/config.newBusinessChargePolicy` exposes it; the ÁSZF wording follows the default (§26.12). [OWNER] decides; the key script asks for it at the next run (integrator). Switching to `azonnal` also needs two text edits: content `bekotes.magyarazat.elofizetes.miert` and the ÁSZF fee-start sentence.

#### 26.1.8 What `kesz` fills in
In one transaction: `clients.adoszam`, `ev_nyilvantartasi_szam`, `ev_since` = `registered_on` (or `filedOn` when unknown), `hq_municipality` = seat city, `activity_text` = main activity label (+ others, ≤ 200), `activity_answer` = `COST_CLASS_ANSWER[costClass]` (null stays null → accountant decides), `activity_code` = main `ovtjKod` if any, `has_separate_business_account`; `client_tax_profiles` row for the current year if missing: `status = WORK_KIND_TAX_STATUS[workKind]`, `cost_ratio` = hint or 45, `cost_ratio_source = 'ugyfel_javaslat'`, `atalany_from = ev_since`, `guaranteed_minimum = false` ([KÖNYVELŐ] sets it). The `adatok` step stays `kesz`; `vallalkozas_inditas` → `kesz`; locked steps unlock; notification `registration_done`; the accountant gets `onboarding_needs_review` (variant `uj_vallalkozas`: "{clientName} vállalkozása elindult – nézd át a költséghányadot").

#### 26.1.9 KYC fix (order 7)
Already the backend behaviour (§24 01:05 jogi, 01:40 backend): only the **address side** of the lakcímkártya (`addressFront`); `addressBack` is never requested, shown, accepted or stored. App: no slot, no text asking for it anywhere (incl. tips, video scripts, explainer `lakcimkartya_foto`). Panel KYC viewer: no empty "hátoldal" box. Acceptance test O7.4.

### 26.2 Callback request instead of booking (order 2)

#### 26.2.1 Entry points (every former booking/call place)
One modal screen **`visszahivas`** (route `/visszahivas?forras=<source>&tema=<topic>`), opened from:

| Place | Was | Now (source / default topic) |
|---|---|---|
| Onboarding page, bottom card | optional call card ("videohivas_laptop", "Hívás {firstName}-val") | card with 3D `ora` 44 pt: "Elakadtál? Kérj visszahívást." + promise line (`bekotes` / `bekotes`) |
| Every onboarding sub-screen, adatlap page, guide step | – | text link "Elakadtál? Kérj visszahívást" (`adatok`, `vallalkozas_adatlap`, `vallalkozas_utmutato`, `meghatalmazas_utmutato`, `azonositas`, `elofizetes` / matching topic) |
| Accountant card (onboarding band, Főoldal, Fiók) | "Időpontot foglalok" / call promise by the accountant | secondary capsule button "Kérj visszahívást" + line "Csapatunk 24–48 órán belül hív. Nem feltétlenül {firstName} hív elsőként." (`konyvelo_kartya` / `egyeb`) |
| Üzenetek | (header) | request tile "Visszahívást kérek" next to the existing tiles; when a callback is open: a slim status card above the composer (`uzenetek` / `egyeb`) |
| Fiók | – | row "Visszahívást kérek" with the open callback's status as subtitle (`fiok` / `egyeb`) |
| GYIK | – | last block "Nem találtad a választ? Kérj visszahívást." (`gyik` / `egyeb`) |
| Locked-feature sheet (§26.5.3) | – | link "Kérdésed van? Kérj visszahívást." (`zarolt_funkcio` / `bekotes`) |
| `bekotes/idopont`, `hataridok` appointment rows, `fiok/ertesitesek` appointment kinds, panel `/idopontok`, `/beallitasok` appointments toggle, accountant client tab "Időpontok" | booking UI | removed (route `bekotes/idopont` redirects to `/visszahivas?forras=bekotes`; old code moved to `_regi/` or kept behind a dead flag) |

#### 26.2.2 Client form and promise
- If a callback is **open**, the screen shows its status card (§26.2.6) with "Módosítom" (phone, window, note, topic → `PATCH`) and "Mégsem kérem" (→ cancel) instead of a new form (409 `callback_already_open` from the API returns the open one).
- Form: **Telefonszám** (prefilled masked from the profile: "+36 30 *** **67 – ezen hívjunk?" with "Másik számot adok meg"; validation `normalizeHuPhone`, message "Magyar telefonszámot adj meg, például +36 30 123 4567."), checkbox "Mentsd el a profilomba is" (only when a new number is typed); **Miben segítsünk?** topic chips (`CALLBACK_TOPIC_LABELS`, preselected from the entry point); **Megjegyzés** (optional, ≤ 500, placeholder "Írd le röviden, hol akadtál el."); **Mikor hívhatunk?** (`CALLBACK_WINDOW_LABELS`, default `barmikor`); primary capsule **"Kérem a visszahívást"**.
- Promise block above the button (`CallbackPromise`, content texts): `visszahivas.igeret` "Kollégánk 24–48 órán belül felhív. Munkanapokon 9 és 17 óra között telefonálunk. Nem feltétlenül {firstName} hív elsőként, hanem valaki a csapatunkból." · `visszahivas.hivoszam` "Erről a számról hívunk: {callerId}" (hidden while env `CALLBACK_CALLER_ID` is empty [OWNER]) · `visszahivas.csalas` "Telefonon soha nem kérjük a jelszavadat, a belépési kódjaidat vagy a kártyaadataidat. Ha valaki ezt kéri, tedd le, és írj nekünk az alkalmazásban." · `visszahivas.adatkezeles` (jogi, §26.12) "A megadott számon ezzel a kéréssel kapcsolatban hívunk. A hívásról rövid jegyzetet írunk, a hívást nem rögzítjük. Részletek az Adatkezelési tájékoztatóban." – no consent checkbox (legal basis: the client's request / contract, [JOGI]).
- After sending: the status card + push permission prompt is NOT forced; a toast "Megkaptuk. Kollégánk 24–48 órán belül hív."

#### 26.2.3 Lifecycle, SLA, attempts (`callback_requests`)
```
uj ──claim / first attempt──► folyamatban ──"Beszéltünk"──► teljesitve
 │                              │  ├─ nem_vette_fel / foglalt (failed) ×3 ──► sikertelen
 │                              │  ├─ hibas_szam ──► (stays folyamatban, needs_new_phone) ──client new number──► back in the queue
 │                              │  └─ kesobb_kerte (+ nextAttemptAfter) ──► stays folyamatban
 ├──────────── client "Mégsem kérem" (uj | folyamatban) ──► visszavonva
 └──────────── staff "Lezárom hívás nélkül" + reason (uj | folyamatban) ──► lezarva
```
- `due_at = created_at + CALLBACK_DUE_HOURS` (env, default **48**, calendar hours), `target_at = created_at + 24 h`. **Overdue** = open and `now > due_at` (computed, not a status). Panel colours: until `target_at` neutral, then amber, after `due_at` red. [OWNER] may later count only working hours; tonight calendar hours.
- `CALLBACK_RULES`: max 3 failed attempts (`nem_vette_fel`, `foglalt`) → `sikertelen`; next attempt soft-blocked for 120 min after a failed one (panel warns, API allows); "Most hívom" sets `calling_now_until = now + 15 min` (client sees "Most hív kollégánk"); note ≤ 500, attempt note ≤ 500, internal note ≤ 2000, summary ≤ 1000; max 3 creates per client per 24 h (429 `rate_limited`); one open callback per client (partial unique index; 409 `callback_already_open` + body `{ error, callback: CallbackView }`).
- Attempt `beszeltunk` → `teljesitve`; optional `summaryForClient` is posted to the client thread as a message from the caller (sender `csapat`, or `konyvelo` when the accountant called) with the prefix "A hívásunk összefoglalója:"; `summary_message_id` stored.
- Client phone change on a `needs_new_phone` callback clears the flag, keeps the assignee, notifies the assignee (`callback_assigned`, variant `uj_szam`).
- Cancel by the client: `uj | folyamatban` → `visszavonva`; staff sees it greyed with the time.
- Every change: audit (`callback.*`), the detail `history` is built from these audit rows.

#### 26.2.4 Who handles it
- Queue owners: role **`csapat`** (all callbacks) and **`admin`** (all callbacks). The accountant handles only callbacks **assigned to him** (`assigned_user_id` = his user id); he sees his clients' callback history read-only on the client page.
- Assignment: "Magamra veszem" (claim; 409 if someone else holds it, admin may `force`), "Átadom" (to a team member, an admin, or **the client's accountant** – the only accountant offered), "Visszaadom a sorba" (`userId: null`). Notification `callback_assigned` to the new holder (e-mail ✓).
- New callbacks notify every active `csapat` user and admins (`callback_new`, in-panel badge; e-mail digest, see §26.11). Overdue → `callback_overdue` once to the holder (or all team when unassigned) and admins.

#### 26.2.5 Data model → §26.9.

#### 26.2.6 Client status texts (`CallbackView.statusText`; content keys `visszahivas.allapot.<key>`)
| Situation | Key | Default text |
|---|---|---|
| `uj`, not overdue | `uj` | "Megkaptuk. Kollégánk 24–48 órán belül hív a {phoneMasked} számon." |
| `folyamatban`, assigned, no attempt | `folyamatban` | "{staffFirstName} intézi a kérésedet. Hamarosan hív." |
| calling now | `most_hiv` | "Most hív kollégánk, {staffFirstName}. Ha nem tudod felvenni, újra próbáljuk." |
| last attempt failed | `nem_ert_el` | "{when} kerestünk, de nem értünk el. Újra próbáljuk." |
| `needs_new_phone` | `hibas_szam` | "Nem értünk el a megadott számon. Írd be a jó számot, és újra hívunk." (+ button "Javítom") |
| `kesobb_kerte` | `kesobb` | "Megbeszéltük, hogy {when} körül hívunk újra." |
| open and overdue | `lejart` | "Sajnáljuk, hogy még nem hívtunk. Hamarosan jelentkezünk." |
| `teljesitve` | `teljesitve` | "Beszéltünk {when}. Ha még kérdésed van, írj nekünk." |
| `sikertelen` | `sikertelen` | "Háromszor kerestünk, de nem értünk el. Írj nekünk üzenetet, vagy kérj új visszahívást." |
| `visszavonva` | `visszavonva` | "Lemondtad a visszahívást." |
| `lezarva` | `lezarva` | "Lezártuk a kérésedet: {reasonText}." (`megoldva_uzenetben` → "üzenetben válaszoltunk") |
`{when}` = Budapest time, "ma 14:20" / "tegnap 9:05" / "november 19-én 10:00". The client never sees attempt notes, internal notes or full staff names.

#### 26.2.7 Text replacements
- Login card (§17.1): stays "Pár perc, és bekötünk". Onboarding band accountant card: "{displayName}, a könyvelőd" + response promise; the call promise is replaced by the callback line (§26.2.1).
- `uzenetek` header: unchanged + during onboarding the subline "A bekötés alatt csapatunk is válaszol."
- FAQ (jogi `gyik` + live `faq_items`, §26.12): new items "Hogyan kérhetek visszahívást?", "Még nincs vállalkozásom. Mit tegyek?", "Miért nem ti jelentitek be a vállalkozásomat?", "Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?". No FAQ mentions booking.
- Notification settings (`fiok/ertesitesek`): `LEGACY_NOTIFICATION_KINDS` hidden; callback kinds shown under "Visszahívás".
- Content keys `notif.appointment_*` stay in the defaults (old rows render) but are never sent.

#### 26.2.8 Jobs (worker)
Every 5 min: `callback_sla` (overdue notifications once per callback, `overdue_notified_at`; clears expired `calling_now_until`). The hourly appointment reminder (§15) becomes a no-op. Daily 08:00 staff digest e-mail (§26.11). Daily 10:00 `registration_reminders` (§26.1.5).

#### 26.2.9 Retiring appointments (keep old data readable)
- Tables `availability_slots`, `appointments` and `accountants.appointments_enabled` stay untouched; no row is changed or deleted. `onboarding_steps` rows with step `idopont` stay; they are not listed, counted or required anywhere.
- **Mapping (one-time data step, §26.9.3):** each `appointments` row with `status = 'foglalt'` and `starts_at > now() − 1 day` gets one `callback_requests` row: `status 'uj'`, `source 'regi_idopont'`, `topic 'bekotes'`, `window` = `delelott` if the Budapest hour < 12 else `delutan`, `phone_enc` = the appointment's phone or the profile phone (none → `needs_new_phone = true`), `note` = "Korábban egyeztetett hívás: {date} {time} ({channel})", `due_at` = `max(starts_at, now())` + 2 h, `legacy_appointment_id` (unique → idempotent), `created_by_role 'system'`. The client gets one in-app notification `callback_received` variant `regi_idopont`: "Időpontfoglalás helyett mostantól visszahívást kérhetsz. A korábban egyeztetett hívásod megmaradt: kollégánk {when} körül hív." (Demo: Németh Péter's 2026-11-19 10:00 call.)
- API: `GET /client/appointments/slots` → `{ enabled: false, slots: [] }`; `GET /client/appointments` → old rows read-only; `POST /client/appointments`, `POST /client/appointments/:id/cancel`, `GET /client/appointments/:id/ics`, `POST /acc/availability`, `DELETE /acc/availability/:id`, `PATCH /acc/appointments/:id` → **410 `megszunt_funkcio`** ("Időpontot már nem lehet foglalni. Kérj visszahívást."). `GET /acc/appointments` → old rows read-only. `OnboardingState.appointmentsEnabled` always false. No `apt:` deadlines are generated any more (old ones are not shown).
- Audit actions `appointment.*` stay readable in the logs.

### 26.3 Panel (accountant + admin + team)

#### 26.3.1 Navigation per role (left nav, 3D icons 28 pt)
| Role | Items |
|---|---|
| `csapat` | **Visszahívások** (`ora`, badge open/overdue) · **Vállalkozás-indítás** (`bevallas`, badge "Ellenőrzésre vár") · **Üzenetek** (`uzenetek`, only onboarding clients, badge unread) · Beállítások (own password, 2FA) |
| `admin` | existing items + Visszahívások + Vállalkozás-indítás + **Csapat** (`fiok`) under "Admin" |
| `accountant` | existing items **minus Időpontok** + Visszahívások (`ora`, only his; hidden when he never had one) |
Login: role `csapat` is allowed in the panel (the "Ez a felület a könyvelőknek szól" refusal stays only for `client`). Landing page: csapat → `/visszahivasok`. `STAFF_TOTP_REQUIRED` applies to `csapat` like to every staff role.

#### 26.3.2 `/visszahivasok` – queue
- Filter chips with counts: **Nyitott** (default) · Lejárt · Enyém · Nincs gazdája · Lezárt · Mind; topic select; search (name, e-mail). Sort: overdue first, then `due_at` ascending.
- Table on a white sheet: Ügyfél (name + lifecycle label "Bekötés alatt"/"Aktív") · Téma · Megjegyzés (first 80 chars) · Mikor hívható (window) · Beérkezett · **Határidő** (countdown "még 21 óra" / red "lejárt 3 órája"; neutral → amber after 24 h → red after 48 h) · Kísérletek ("1/3") · Kié (first name or "—") · Állapot.
- Detail drawer (right, 480 px): header with client name + "Ügyfél adatlapja" link (accountant only, own clients) · client card (`TeamClientCard`: e-mail, masked phone, lifecycle, milestone, accountant, registration status with link to the pipeline) · client's note · phone: masked until the callback is **assigned to me**, then the full number with "Másolás" (`masolas` 3D icon) and a `tel:` link (audit `callback.phone_viewed`) · buttons: **Magamra veszem**, **Most hívom**, **Hívás eredménye** (outcome radios `CALLBACK_ATTEMPT_OUTCOME_LABELS`, note, for `beszeltunk` an optional "Összefoglaló az ügyfélnek" textarea, for `kesobb_kerte` a date-time), **Átadom** (select from `assignable`), **Lezárom hívás nélkül** (reason + note), internal note (autosave) · attempts list · history timeline. Toasts in Hungarian. Disabled buttons explain why (e.g. "Előbb vedd magadra.").
- Accountant view: same page, only his rows; no claim of others' rows; "Átadom" only back to the queue.

#### 26.3.3 `/vallalkozas-inditas` – pipeline
- Column board (≥ 1280 px) or chip filter + table (smaller): **Adatokat tölt** · **Útmutatónál** · **Ellenőrzésre vár** · **Javításra vár** · **Adószámra vár** · **Kész** (last 30 days) · Elállt (collapsed). Card: client name, days in status, main activity, start plan/date, guide progress "7/14 lépés", amber marker when > 3 days in `utmutato` or > 1 day in `beadva`, `ora` marker when a callback is open.
- Detail page `/vallalkozas-inditas/:id` (three columns):
  1. **Adatok** – the answers (`BusinessRegistrationAnswers`), editable by the team (`PATCH`, audited, the client sees the new values; editing is allowed in every open status), ÖVTJ code field per activity (6 digits, `isValidOvtjKod`), hints, staff note.
  2. **Útmutató és bejelentés** – guide opened at, steps done, filed on + channel, the uploaded NAV PDF/image inline (via `POST /files/:id/link`; PDF in an `<iframe>`/object, image zoomable), checklist `REGISTRATION_CHECK_LABELS` → **"Rendben, ellenőriztem"** (all ticked) / **"Javítást kérek"** (note dialog with the hint "Írd le pontosan, mit javítson, és hogyan: a beküldött bejelentést csak változásbejelentéssel lehet módosítani.").
  3. **Adószám** – adószám (check digit + ÁFA-kód 1 warning), nyilvántartási szám, nyilvántartásba vétel napja → **"Rögzítem"** (→ `kesz` when checked) · links: Üzenet (csapat), Visszahívás felvétele, history timeline.
- The team **never** files anything at NAV; no button or text suggests it.

#### 26.3.4 Admin
- `/admin/csapat`: table of team members (name, e-mail, active, 2FA on, open callbacks, done in 30 days, registrations checked in 30 days, last login) + **"Új munkatárs"** (e-mail, teljes név, keresztnév → staff invite code e-mail, like accountants) + deactivate/activate (disables login + revokes sessions; open callbacks of a deactivated member return to the queue).
- `/admin` dashboard: two extra tiles "Visszahívások" (open / overdue, median hours to first attempt in 30 days) and "Vállalkozás-indítás" (in pipeline / done this month) – `AdminServiceStats`.
- `/admin/szovegek`: the new content groups (§26.8.1) are editable there with placeholder check.

#### 26.3.5 Changes in existing panel pages
Client detail tabs: "Időpontok, Napló" → **"Visszahívások, Napló"** (the client's callbacks, read-only unless assigned); Bekötés tab: step `vallalkozas_inditas` with the registration status + "Megnyitom" (csapat/admin) / read-only summary (accountant); the KYC viewer shows no lakcímkártya back side. `/beallitasok`: the appointments switch is removed. `/ugyfelek` filter "Bekötés alatt" rows show the milestone "Vállalkozás elindítva" when on the new path. `/idopontok` route → redirect `/visszahivasok`.

### 26.4 Role `csapat` – permissions (enforced in the API; test per row)
| Resource | csapat | admin | accountant |
|---|---|---|---|
| Callbacks: list/detail/claim/attempt/close/assign | all clients | all clients | only `assigned_user_id = me` (others 404) |
| Full phone number of a callback | when assigned to me | when assigned to me | when assigned to me |
| Create a callback for a client | any client in `bekotes_alatt` or with a callback in the last 90 days | any | own clients |
| Registrations: list/detail/edit/check/fix/adószám | all | all | read-only for own clients (`GET /acc/clients/:id/business-registration`) |
| The `ev_bejelentes` document file | yes (audited `file.download`) | yes (audited) | own clients (as any document) |
| Messages | threads of clients with lifecycle `bekotes_alatt` only (read, write, attachments); 404 otherwise | no (unchanged least privilege) | own clients (unchanged) |
| Client card (`TeamClientCard`) | clients in `bekotes_alatt`, or with a callback/registration in the last 90 days | yes | own clients |
| Documents/dossier, KYC, NAV credentials, tax, revenue, internal notes, requests, deadlines, exports, audit, content, admin pages | **no (404)** | unchanged | unchanged |
- Messages written by `csapat`: `messages.sender_role = 'csapat'`, `sender_user_id` = the member; `Message.sender = 'csapat'`, `senderName` = "{firstName} · ügyfélszolgálat". The accountant sees them in the thread; `read_by_team_at` marks team reads. Client messages in `bekotes_alatt` notify the accountant (unchanged) **and** the team (`client_message_new`, in-panel badge + digest).
- A team member is a `users` row with role `csapat` + a `team_members` row (`display_name`, `first_name`, `active`). Invite and password set-up reuse the staff invite flow (`auth_staff_invite`, panel `/jelszo`).

### 26.5 Bottom bar during onboarding and restricted mode (orders 3, 4)

#### 26.5.1 Tab bar (all clients, always)
- The floating tab bar of §17.1 stays visible **during onboarding too**: Főoldal · Dosszié · Üzenetek · Fiók + the round Fotózás button. Same tabs before and after activation (Apple HIG: do not hide tabs; explain inside – §26.16).
- Before activation: **Főoldal** = the onboarding page (band, video card §26.7.3, branch question, step cards with "Mi ez?", "Hol tartunk", callback card); badge = `todoCount` (amber number). **Dosszié** = locked screen (§26.5.3, illustration `dosszie_mappa`, feature `dosszie`). **Üzenetek** = works (unread badge). **Fiók** = works. **Fotózás** button: if the client has an open accountant `dokumentum` request → opens the upload for that request; otherwise the locked sheet of feature `feltoltes`.
- Every onboarding sub-screen (adatok, adatlap, guides, szerződés, előfizetés, meghatalmazás, azonosítás, visszahívás) shows the tab bar with **Főoldal active**. Hidden only while the keyboard is open (Android `adjustResize`), in full-screen image/video viewers, the camera/scanner, and the Üzenetek thread (as today).
- After activation nothing changes compared with today.

#### 26.5.2 Restricted mode – matrix (`CLIENT_FEATURE_RULES`; lifecycle `bekotes_alatt` only)
Server side: one middleware on `/client/*` maps each route to a feature; when the client's lifecycle is `bekotes_alatt` and the feature is `zarva` (or `keresre` without a valid request) it answers **403 `{ error: { code: 'locked_until_active', message: <filled reason>, feature } }`**. Other lifecycles behave as before. `GET /client/access` and `Me.access` return the same matrix (`ClientAccess`).

| Feature | Before activation | Routes (client role) | Reason shown when locked (content `korlatozott.<feature>`) |
|---|---|---|---|
| `bekotes` | nyitva | `/client/onboarding*`, `/client/profile`, `/client/kyc`, `/client/legal-pdf/*`, `/client/onboarding/meghatalmazas` | – |
| `vallalkozas_inditas` | nyitva | `/client/business-registration*`, `/client/guides/*` | – |
| `uzenetek` | nyitva | `/client/messages*`, `/client/attachments` | – |
| `visszahivas` | nyitva | `/client/callbacks*` | – |
| `fiok`, `ertesitesek`, `adataim` | nyitva | `/me*`, `/auth/*` (export, delete, sessions, 2FA, push tokens, notifications) | – |
| `elofizetes`, `dijszamlak` | nyitva (step lock §26.1.7 still applies: 409 `step_locked`) | `/client/subscription*`, `/client/fee-invoices` | – |
| `gyik_jogi` | nyitva | `/content/*`, `/legal/*`, `/client/explainers` | – |
| `ajanlas` | nyitva | (`Me.client.personalReferralCode`) | – |
| `keres_valasz` | nyitva | `GET /client/requests`, `POST /client/requests/:id/complete`, `…/cancel`, `POST /client/documents` **with** `requestId` of an open `konyvelotol` request, `GET /client/documents/:id` for documents the client uploaded, `ev_bejelentes`, `szerzodes_alairt`, `meghatalmazas` | – |
| `kerdes` | nyitva | `POST /client/requests` with type in `REQUEST_TYPES_BEFORE_ACTIVATION` (`kerdes`) | – |
| `fooldal_ado` | **zárva** | `GET /client/tax-periods*`, `POST …/mark-paid`, `…/unmark-paid` (`GET /client/home` still answers with hero `bekotes_alatt`, no tax data) | "A bekötés után nyílik meg. Akkor számolja ki {firstName}, mennyit és mikorra kell befizetned." |
| `dosszie` | **zárva** | `GET /client/dossiers*`, other `GET /client/documents/:id`, `POST /files/:id/link` + `GET /files/:id` for files of locked documents | "A bekötés után nyílik meg. Akkor ide kerülnek a számláid a NAV-tól és az irataid." |
| `feltoltes` | **csak kérésre** | `POST /client/documents` without `requestId`, `POST /client/documents/:id/versions` of a non-request document | "A bekötés után nyílik meg. Ha {firstName} kér tőled valamit, azt már most is feltöltheted a kérésnél." |
| `nav_szamlak` | **zárva** | `/client/nav-invoices*` | "A bekötés után nyílik meg. A számláidat a NAV-meghatalmazás után kérjük le." |
| `bevetel` | **zárva** | `/client/revenue` | "A bekötés után nyílik meg. Akkor mutatjuk, mennyi a bevételed, és hol tartasz a keretekben." |
| `hataridok` | **zárva** | `/client/deadlines*` | "A bekötés után nyílik meg. Akkor ide kerülnek a befizetési és bevallási határidőid." |
| `igazolas_keres` | **zárva** | `POST /client/requests` with any other type (igazolások, adatváltozás, tevékenységváltozás) | "A bekötés után nyílik meg. Igazolást {firstName} a NAV-meghatalmazás után kérhet neked." |
Files a client may always open: his own uploads, message attachments, fee invoices, GDPR exports, generated legal PDFs, `ev_bejelentes`, `szerzodes_alairt`, `meghatalmazas`. `activationHint` = content `korlatozott.aktivalas_hint` "Még {n} lépés, és minden megnyílik." (n = `todoCount` + open accountant steps, min 1); when the client's own share m (open unlocked client steps + open accountant requests + 1 for an unanswered branch question = the band's "Még N dolog kell tőled") is smaller: `korlatozott.aktivalas_hint_reszlet` "… Ebből {m} a tiéd, a többi a mi dolgunk." (m = 0: `korlatozott.aktivalas_hint_mienk`).

#### 26.5.3 How a locked feature looks (app)
- Never a silently greyed control. A locked screen = white sheet on the tinted ground: 3D `lakat` 56 pt + the feature's object visual (Dosszié: `dosszie_mappa`; Határidők: `hatarido_naptar`), title "{label} – hamarosan", the reason text, primary capsule **"Mi kell még?"** (→ Főoldal, scrolls to the next step), text link "Kérdésed van? Kérj visszahívást." Locked rows/buttons stay focusable (`accessibilityState: { disabled: true }` + hint = reason) and open the same content as a bottom sheet.
- Home quick actions and Fiók rows that lead to locked features show a small `lakat` 24 pt instead of their chevron.
- The app reads `Me.access` (refetched after every onboarding mutation); a 403 `locked_until_active` from any call shows the sheet with `error.message` (defence in depth).

### 26.6 Self-service guides (orders 7, 8, 9)

#### 26.6.1 Screens
- `bekotes/vallalkozas` (hub of step `vallalkozas_inditas`): status text, the next action, and — before submit — the **"Készítsd elő"** list (`PREPARE_ITEMS`: Ügyfélkapu+ vagy DÁP, személyi, lakcímkártya, adóigazolvány, TAJ-kártya, anyád neve és születési adataid, a székhely jogcíme, a tevékenységeid). Each row: 3D icon from its explainer, label, one-line note, "Mi ez?" link, a tick the client can set (local only). Items with `storedByUs: false` carry the small line "Ezt nem kérjük el, a NAV-os űrlapba te írod be." Tapping "Készítsd elő" on the onboarding card opens this list first, then the adatlap (§26.1.3), then the guide.
- `bekotes/vallalkozas/utmutato` – guide `vallalkozas_bejelentes` (after submit). `bekotes/meghatalmazas` – guide `meghatalmazas` replaces the §10.2 ONYA step list for method `onya_ugyfel` (the methods `onya_konyvelo` and `alairt_pdf` stay as secondary options below, unchanged).
- Guide page layout, top to bottom: ink band (title, "Kb. 10–15 perc"), **video card** (§26.7.3), intro, the "Készítsd elő" list collapsed (bejelentés only), the steps (one white sheet each), the outro, then the action: bejelentés → **"Beküldtem, feltöltöm"** (→ upload screen); meghatalmazás → **"Beküldtem"** (+ optional upload, existing flow). Outdated banner (§26.6.5) above the steps when `outdated`.
- Step sheet: big step number + `screenTitle` (as NAV names it) · `text` · field rows: action label in bold (✓ for jelöld, × for ne jelöld, as Geist text glyphs) + `label` + `value` (+ copy button with the `masolas` 3D icon when `copyValue`) + `why` in secondary text · amber `warning` box · `link` as a capsule button opening the external browser · the annotated **screenshot** (§26.6.4) full width, 12 px radius, caption + "Forrás: NAV, {title}, {date}" in 12 pt, label **"Illusztráció"** on drawn ones; tap → full-screen viewer with pinch-zoom/double-tap zoom and the caption · checkbox **"Megvan"** (progress, `PUT /client/guides/:kind/progress`, debounced) · text link "Elakadtál? Kérj visszahívást". Readable for a 60-year-old: body 17 pt / 1.5, values 17 pt semibold, contrast ≥ 4.5:1, every target ≥ 44 pt.
- Upload screen (`bekotes/vallalkozas/feltoltes`): explainer `nav_igazolas_pdf` inline, file picker (PDF) / camera (photo), "Mikor küldted be?" (default today), "Hogyan?" (`FILING_CHANNEL_LABELS`), optional adószám + nyilvántartási szám ("Ha már tudod"), **"Feltöltöm"** → status card "Megkaptuk. Átnézzük, és szólunk." (`beadva`).

#### 26.6.2 Personalisation (backend, `GET /client/guides/:kind` → **Guide**)
Built from `GUIDE_TEMPLATES[kind]`: rows whose `when` does not match are dropped; placeholders filled; `actionLabel` from `GUIDE_ACTION_LABELS`; `copyValue` = the filled `value` when `copy`; `imageKey` = step key; `done` from the stored progress.
| Placeholder / condition | Source |
|---|---|
| `{nev}`, `{lakcim}` | profile name; profile address "1136 Budapest, Példa utca 7." |
| `{szekhely}`, `szekhely_*` | `seat.kind` (`lakcim` → the profile address) |
| `{szolgaltato}` | "{provider.name}, adószám: {provider.adoszam}" |
| `{telephely}`, `telephely_van/nincs` | `otherSites` ("Telephely: …" / "Fióktelep: …", one per line) |
| `{foTevekenyseg}`, `{egyebTevekenysegek}`, `egyeb_tevekenyseg_van` | per activity: `ovtjKod` known → "{ovtjKod} – {label}"; else "írd a keresőbe: „{navKereso}”, és válaszd a(z) {label} sort"; free text → "a válaszod alapján megírjuk, melyik sort válaszd" (team fills the code in the pipeline) |
| `{munkavegzesJellege}` | `WORK_KIND_GUIDE_VALUE[workKind]` |
| `eu_igen` / `eu_nem` | `euPartner === 'igen'` / otherwise |
| `{konyveloNev}`, `{konyveloAdoazonosito}`, `{konyveloNyilvantartasiSzam}`, `{ugykorok}` | `onyaGuide` data (§25: audited read of the accountant's adóazonosító jel); `AccountantPublic.registrationNumber`; `ugykorok` = jogi `meghatalmazas.ugykorok` joined by "; " |
| `{firstName}` | accountant first name |
`vallalkozas_bejelentes` is 409 `step_locked` before submit; `meghatalmazas` is available on path `van` always and on `inditas` from `beadva`. `version` = the template date ("2026-11-18"); `video` = `VideoRef` of `GUIDE_VIDEO[kind]`; `prepare` = `PREPARE_ITEMS` for the bejelentés guide only; `imagesManifest` = `utmutato/<kind>/kepek.json`.

#### 26.6.3 Facts that must stay true in every guide text, image caption and video
alanyi ÁFA-mentesség **igen**, átalányadózás **igen**, kata **nem**, pénzforgalmi elszámolás **nem**, közösségi adószám only if `euPartner = igen`, munkavégzés jellege per answer, the Ellenőrzés screen before sending, "Bejelentés megtétele" is final, filing day = start day, download the PDF on "Megtekintés", upload it in the app, then the chamber registration within 5 working days (step `kamarai_regisztracio`). The bejelentés is free. For the meghatalmazás (same as `kod/jogi/nav_meghatalmazas.md` and NAV's ONYA guide): onya.nav.gov.hu → own profile (adóazonosító jel, top right) → Új nyomtatvány → Meghatalmazások → **UJEGYKE** → pop-up **Meghatalmazó** → "Új bejelentés" → the accountant's name, adóazonosító jel, jogcím **9 – könyvelő**, nyilvántartási szám → the ügycsoportok of jogi `meghatalmazas.ugykorok` (today: ADÓÜGYEK + "Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)", the latter so the accountant can file later data changes at the client's request) → Kezdete: today, Vége: empty → **"Ellenőrzés és benyújtás"** → pop-up **"Tovább"** (~20 min; NAV segédlet 2025.03.11., p. 3). Whether the EV-register group may stay in a paid service is a [JOGI] question (Üttv., §26.1.4); the guide always follows the jogi list, so a change there needs no code change. The initial EV bejelentés is never filed by us, whatever this list contains.

#### 26.6.4 Annotated NAV screenshots (order 9) → `kepek.json`
- Source: the "NAV-képek" job writes `C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/<kind>/NN_slug.png` (+ `@2x`), `index.json`, `hianyzik.md`, `forrasok.md`, `annotate.py`. Real screenshots only from official NAV/government guides (personal data blurred, numbered markers, boxes and short arrows in C2 ink blue/amber, Geist labels); drawn reconstructions are labelled "Illusztráció". Nobody of us logs in to NAV/Ügyfélkapu; the owner captures missing screens later and re-runs `annotate.py`.
- **Normaliser (app builder, `kod/app/scripts/utmutato-kepek.mjs`)**: reads each `index.json`, maps entries to `GUIDE_STEP_KEYS[kind]` (14 + 8 keys; exact key/slug match first, else the table in `kod/app/scripts/utmutato-kepek.map.json` that the builder writes by looking at titles), copies the PNGs to `kod/media/utmutato/<kind>/` (file names kept), and writes `kod/media/utmutato/<kind>/kepek.json` (**GuideImageManifest**: `items[]` with `stepKey`, `file`, `file2x`, `width`, `height`, `kind` = `kepernyokep`/`illusztracio`, `caption`, `alt`, `source`; `missing[]` = step keys without a picture). Unmatched entries and missing keys are printed. Re-run after every re-annotation: `node scripts/utmutato-kepek.mjs && bash ../deploy/feltolt.sh --media`.
- App: fetches `<mediaBase>utmutato/<kind>/kepek.json` (cache 1 h, stale-while-revalidate), shows `file2x` on ≥ 2x screens; a step without a picture shows only its text (no empty box); a failed image load shows the caption in a dashed 12 px box. The two own-app steps (`feltoltes_appban`, `app_bekuldtem`) may use our own app screenshot or none; `kamarai_regisztracio` has no NAV picture (text + link only).

#### 26.6.5 Validity
`GuideTemplate.validUntil = '2026-12-31'`. After that day `Guide.outdated = true`, `outdatedText` = content `vallalkozas.utmutato.elavult` "2027-től a vállalkozások nyilvántartását a kamara vezeti. Ezt az útmutatót frissítjük. Addig kérj visszahívást, és segítünk." [OWNER/KÖNYVELŐ: update templates + screenshots before 2027-01-01, §26.15].

### 26.7 Videos (orders 5, 6, 8)

#### 26.7.1 Files and serving
| Video | Files (media base) | Length | Where |
|---|---|---|---|
| `bekotes` | `bekotes.mp4`, `bekotes_poszter.jpg`, `bekotes.vtt` | 70–110 s | top of the onboarding page (Főoldal during onboarding) |
| `vallalkozas_bejelentes` | `vallalkozas_bejelentes.mp4`, `…_poszter.jpg`, `….vtt` | 90–150 s | top of the bejelentés guide |
| `meghatalmazas` | `meghatalmazas.mp4`, `…_poszter.jpg`, `….vtt` | 60–100 s | top of the meghatalmazás guide |
- Format: 1080×1920 vertical, 30 fps, H.264 (High) + AAC, **`-movflags +faststart`** (streaming), ≤ 15 MB; poster JPEG 1080×1920 ≤ 300 KB (a frame with the title, no text cut at a 4:5 crop); WebVTT UTF-8, `hu`, ≤ 2 lines × 42 chars per cue; captions also burned in.
- Staging folder in the repo: **`C:/Users/UpgradePC/konyvelo_app/kod/media/`** (videos at its root, guide images under `utmutato/<kind>/`). It is shared, with fixed owners per path so parallel builders never collide: `bekotes.*` → main-video builder; `vallalkozas_bejelentes.*`, `meghatalmazas.*` → guide-video builder; `utmutato/**` → app builder's normaliser (§26.6.4); `videok.json` → integrator. The video builders produce their outputs in `C:/Users/UpgradePC/konyvelo_app/video/<name>/` and copy the three files into `kod/media/`.
- Server: `/srv/kezjegy/web/media/` → mounted read-only into `kezjegy-web` at `/srv/media`; `deploy/web.Caddyfile` `:8080` gets `handle_path /media/* { root * /srv/media … file_server }` **before** the SPA handlers, with explicit `Content-Type` for `.mp4` (`video/mp4`), `.vtt` (`text/vtt; charset=utf-8`), `.json` (`application/json`), `Cache-Control: no-cache` (ETag revalidation; files may be replaced), Range requests (206) and a plain 404 for missing files (never `index.html`). Upload: `feltolt.sh --media` (rsync-like copy of `kod/media/`, replaced files moved to `/srv/kezjegy/_regi/media_<ts>/`). The panel host does not serve `/media`. CSP: unchanged (`default-src 'self'` already allows same-origin media). Builder: backend (deploy part); integrator deploys.
- URLs: web → relative `/media/<file>`; native (APK) → `/config.mediaBaseUrl` (`${APP_PUBLIC_URL}/media/`) or `MEDIA_FALLBACK_BASE_URL` (`https://app.45-94-65-74.sslip.io/media/`). The local harness (`kod/app/scripts/helyi-proba.mjs`) serves `kod/media/` at `/media/` (app builder).

#### 26.7.2 Optional manifest
`<media>/videok.json` (**VideoManifest**: name, `durationSec`, `sizeBytes`, `updatedAt`) written by the integrator with ffprobe at upload. The player works without it (duration then from the video metadata; the card shows no length).

#### 26.7.3 Player behaviour and placement
- Card (white sheet, 18 px radius, directly under the ink band): poster (cover crop, 200 pt high on the onboarding page / 180 pt on guides), title ("Nézd meg, hogyan működik" / "Így jelentsd be – videó" / "Így add meg a meghatalmazást – videó"), length "1:35", and a white capsule **"Lejátszás"** with a filled play triangle drawn as a shape (not an icon set). Tap → full-screen vertical player: native controls (play/pause, seek, fullscreen), **captions on by default** (the VTT track; burned-in captions are also present), sound on (user-initiated), never autoplay, never loop, respects reduced motion (no animated poster). Closing returns to the same scroll position.
- Native: `expo-video` (`npx expo install expo-video`; needs a new APK build by the integrator) with the streamed URL; web: `<video controls playsinline preload="none" poster>` + `<track kind="captions" srclang="hu" default>`.
- **Missing or failing file** (404, network error, `onError`): the card shows the poster if it loads, else the `level_boritek` object visual, and the text "A videó most nem érhető el. Minden lépést leírtunk lent." – never a broken player, never an error code. Offline: the same text.
- After the video was played to ≥ 90 % (local flag per user) or once the client has finished the first step, the onboarding card collapses to one row "▶ Bemutató videó · 1:35" (tap to expand). Guide video cards never collapse.
- No tracking calls; no analytics.

#### 26.7.4 Content outline (video builders write the scripts from this; no product name, no accountant name, never AI, tegező, calm)
- **`bekotes`** (order 6, owner's words first): "Köszönjük, hogy telepítetted az alkalmazásunkat." → what it is good for: a real accountant (könyvelőd) does your taxes; your NAV invoices arrive by themselves; you see what to pay, by when, to which account; you only photograph receipts → the onboarding steps in order and why each is needed: adataid (tax and cost ratio) · if you have no business yet: the app shows you step by step how to register it yourself in a few minutes, then you upload the NAV confirmation and we check it · szerződés · előfizetés (for new businesses only once the tax number exists) · NAV-meghatalmazás given by you in ONYA with the in-app guide, so your accountant can file for you · photos of your ID and the address side of the address card, because the law requires identification · the accountant connects your invoices · what happens after (Főoldal shows what to pay) → "Ha elakadsz, kérj visszahívást: csapatunk 24–48 órán belül hív." → close.
- **`vallalkozas_bejelentes`**: "Készítsd elő" list → belépés Ügyfélkapu+/DÁP → the screens in §26.6/§26.1.4 order with what to tick and why (alanyi ÁFA-mentesség igen, átalányadózás igen, kata nem, pénzforgalmi nem, munkavégzés jellege, közösségi adószám only if needed) → the Ellenőrzés screen → "Bejelentés megtétele" is final and the start day is today → download the PDF on Megtekintés → upload it in the app → "Átnézzük, és szólunk." → reminder: kamarai regisztráció 5 munkanapon belül. Built on the annotated screenshots of `utmutato_kepek/vallalkozas_bejelentes/` (slow zoom to the marked area, markers in sync with the narration); "Illusztráció" label where the index says so.
- **`meghatalmazas`**: why (your accountant can file for you; it is tied to you as a person) → ONYA login → profile → Új nyomtatvány → Meghatalmazások → UJEGYKE → Meghatalmazó → the accountant's name and adóazonosító jel ("az alkalmazásban egy gombbal kimásolod") → ügykörök → beküldés (~20 perc múlva él) → "Beküldtem" in the app. Built on `utmutato_kepek/meghatalmazas/`.
- Voice: Gemini 3.8 Flash TTS via OpenRouter, one voice for all three (`C:/Users/UpgradePC/konyvelo_app/video/hang.json`). Builders' own rules (budget, cost log, blind transcription check) are in their task.

### 26.8 Explainers and editable content (order 5)

#### 26.8.1 Content keys (served from `content_texts`; defaults generated by the backend from `kod/shared/src/bekotes.ts` / `enums.ts` at start, DB rows override; editable in `/admin/szovegek`)
| Group | Keys | Placeholders |
|---|---|---|
| Explainers | `bekotes.magyarazat.<key>.cim` · `.mi` · `.miert` · `.hol` (from `ONBOARDING_EXPLAINERS`) | `{firstName}`, `{havidij}` |
| Restricted mode | `korlatozott.<feature>` (from `CLIENT_FEATURE_RULES.reason`), `korlatozott.aktivalas_hint` | `{firstName}`, `{n}` |
| Step locks | `bekotes.zarolt.bejelentes_utan`, `bekotes.zarolt.elofizetes_adoszam_utan`, `bekotes.zarolt.nav_bekotes` | – |
| Registration | `vallalkozas.allapot.<status>` (from `REGISTRATION_STATUS_CLIENT_TEXT`), `vallalkozas.stop.tobb_20m`, `vallalkozas.stop.kizaro_ok`, `vallalkozas.hint.koltseghanyad`, `vallalkozas.hint.koltseghanyad_konyvelo`, `vallalkozas.hint.jarulek_fo`, `vallalkozas.hint.jarulek_mellek`, `vallalkozas.utmutato.elavult` | `{firstName}`, `{ratio}`, `{amount}` |
| Callback | `visszahivas.igeret`, `.hivoszam`, `.csalas`, `.adatkezeles` (jogi), `visszahivas.allapot.<key>` (§26.2.6) | `{firstName}`, `{callerId}`, `{phoneMasked}`, `{staffFirstName}`, `{when}`, `{reasonText}` |
| Notifications | `notif.<kind>.title`, `notif.<kind>.body`, `email.<kind>.subject`, `email.<kind>.body` (§26.11) | per kind |
`GET /client/explainers` → `{ items: Explainer[] }` with `{firstName}` / `{havidij}` filled (cache 5 min). The app bundles `ONBOARDING_EXPLAINERS` only as an offline fallback.

#### 26.8.2 Which item gets which explainer and visual
| Where | Explainer key | 3D icon / visual |
|---|---|---|
| Branch question | `vallalkozas_van_e` | `kerdezek` |
| Step card Adataid | `adoazonosito_jel` (card) | `fiok` |
| Rólad: adóazonosító jel · telefon · lakcím | `adoazonosito_jel` · `telefonszam` · `lakcim` | `igazolas` · `kerdezek` · `boritek` |
| Vállalkozásod (van): adószám · EV-szám · tevékenység · költséghányad hint · mióta · eddigi könyvelő | `adoszam` · `ev_nyilvantartasi_szam` · `tevekenyseg` · `koltseghanyad` · `vallalkozo_miota` · `elozo_konyvelo` | `irat` · `irat` · `dosszie` · `szamolo` · `tepnaptar` · `irat` |
| Helyzeted: főállás/mellékállás · külön számla | `jogallas` · `kulon_bankszamla` | `fiok` · `szamlaszam` |
| Step card Vállalkozás bejelentése | `vallalkozoi_ugyseged` | `bevallas` + visual `tepnaptar_3d` on the hub |
| Adatlap 1: kizáró okok · várható bevétel | `kizaro_okok` · `varhato_bevetel` | `irat` · `szamolo` |
| Adatlap 2: tevékenység · költséghányad | `tevekenyseg` · `koltseghanyad` | `dosszie` · `szamolo` |
| Adatlap 3: székhely · jogcím · telephely | `szekhely` · `szekhely_jogcim` · `telephely` | `boritek` · `irat` · `boritek` |
| Adatlap 4: munkavégzés jellege · EU-partner · külön számla | `jogallas` · `kozossegi_adoszam` · `kulon_bankszamla` | `fiok` · `bevallas` · `szamlaszam` |
| Adatlap 5: kezdés | `kezdes_napja` | `tepnaptar` + `tepnaptar_3d` |
| Készítsd elő rows | `ugyfelkapu_dap`, `szuletesi_adatok`, `lakcim`, `adoazonosito_jel`, `taj_szam`, `szuletesi_adatok`, `szekhely_jogcim`, `tevekenyseg` | as each explainer |
| Guide steps (bejelentés) | `vallalkozoi_ugyseged`, `atalanyadozas`, `alanyi_afa_mentesseg`, `kata_penzforgalmi`, `kozossegi_adoszam`, `nav_igazolas_pdf` (as "Mi ez?" links on the matching rows) | `bevallas`, `szamolo`, `irat` |
| Step card Szerződés | `szerzodes` | `irat` |
| Step card Előfizetés | `elofizetes` | `szamlaszam` |
| Step card NAV-meghatalmazás + guide | `nav_meghatalmazas` (+ `ugyfelkapu_dap` on the login step) | `igazolas` + visual `meghatalmazas_alairva` |
| Step card Igazolványok: ID · lakcímkártya · nyilatkozatok | `szemelyi_foto` · `lakcimkartya_foto` · `pmt_nyilatkozatok` | `fotozas` · `fotozas` · `irat` |
| Step card Számlák bekötése | `nav_bekotes` | `szamlak` |
| Callback card / screen | `visszahivas` | `ora` |

#### 26.8.3 UI
On every step card: a text link **"Mi ez?"** (right of the title); in forms: **"Hol találom?"** under the field label. Both open a bottom sheet (shadow, 18 px top radius): 3D icon 44 pt + title, optional object visual (160×120 pt), three blocks with small caps headings **"Mi ez?"**, **"Miért kell?"**, **"Hol találod?"** (17 pt body, 1.5 line height; URLs open the external browser; numbered lines render as a list), bottom link "Elakadtál? Kérj visszahívást". Screen readers read the three headings. The sheet never hides the field it explains on web desktop (max 480 px column).

### 26.9 Data model and migrations (additive only)

#### 26.9.1 Migration files (`kod/backend/drizzle/`)
1. **`0008_tulaj1118_enumok.sql`** – only `ALTER TYPE … ADD VALUE IF NOT EXISTS`: `user_role` + `csapat`; `onboarding_step` + `vallalkozas_inditas`; `document_category` + `ev_bejelentes`; `notification_kind` + the 15 new kinds of §26.11 (`NOTIFICATION_KINDS` after `gdpr_export_ready`). Nothing else in this file, and **no later migration in the same run may use these new values** (Postgres forbids using a new enum value in the transaction that added it; drizzle may run pending files in one transaction). Values are used only at runtime.
2. **`0009_tulaj1118.sql`** – new tables and columns (text + CHECK for every new state; no new enum types):
- `clients.business_status text null check (business_status in ('van','inditas'))`.
- `messages.read_by_team_at timestamptz null`; `messages.sender_role` (text) also takes `'csapat'` (TS type only).
- **`team_members`** — `user_id uuid pk references users`, `display_name text not null`, `first_name text not null`, `active bool not null default true`, `created_at`, `updated_at`.
- **`business_registrations`** — `id uuid pk`, `client_id uuid not null references clients`, `status text not null default 'kitoltes'` (CHECK `REGISTRATION_STATUSES`), `status_changed_at timestamptz not null default now()`, `answers jsonb not null default '{}'` (= `BusinessRegistrationAnswers`; plain like `clients.address_*`; never TAJ/anyja neve/születési adatok), `submitted_at`, `guide_opened_at`, `guide_progress jsonb not null default '[]'`, `filed_on date`, `filed_channel text` (CHECK `FILING_CHANNELS`), `filed_document_id uuid null references documents`, `filed_at`, `check_items jsonb not null default '[]'`, `checked_by uuid null references users`, `checked_at`, `fix_note text`, `fix_requested_at`, `adoszam text`, `ev_nyilvantartasi_szam text`, `registered_on date`, `adoszam_set_by uuid null references users`, `done_at`, `withdrawn_at`, `withdraw_reason text` (CHECK), `withdraw_note text`, `assigned_user_id uuid null references users`, `staff_note text`, `reminder_count smallint not null default 0`, `last_reminder_at`, `created_at`, `updated_at`. Indexes: unique (`client_id`) WHERE status IN ('kitoltes','utmutato','beadva','javitas','ellenorizve'); (`status`, `status_changed_at`).
- **`callback_requests`** — `id uuid pk`, `client_id uuid not null references clients`, `created_by_user_id uuid null`, `created_by_role text not null` ('client','csapat','admin','accountant','system'), `status text not null default 'uj'` (CHECK `CALLBACK_STATUSES`), `topic text not null` (CHECK), `source text not null` (CHECK), `call_window text not null default 'barmikor'` (CHECK; `window` is avoided as a column name), `note text` (≤ 500), `phone_enc text null` (APP_DATA_KEY; null only for a legacy row without any number), `phone_masked text null`, `needs_new_phone bool not null default false`, `target_at timestamptz not null`, `due_at timestamptz not null`, `assigned_user_id uuid null references users`, `assigned_at`, `calling_now_until`, `attempts int not null default 0`, `failed_attempts int not null default 0`, `last_attempt_at`, `last_outcome text`, `next_attempt_after`, `internal_note text`, `summary_for_client text`, `summary_message_id uuid null`, `closed_at`, `closed_by uuid null`, `closed_reason text` (CHECK), `overdue_notified_at`, `legacy_appointment_id uuid null unique references appointments`, `created_at`, `updated_at`. Indexes: unique (`client_id`) WHERE status IN ('uj','folyamatban'); (`status`, `due_at`); (`assigned_user_id`, `status`); (`client_id`, `created_at`).
- **`callback_attempts`** — `id uuid pk`, `callback_id uuid not null references callback_requests`, `by_user_id uuid not null references users`, `at timestamptz not null default now()`, `outcome text not null` (CHECK), `note text`.
- Grants: the API role `kezjegy_app` gets the same privileges on the new tables as on the existing ones (`deploy/db-roles.sh` pattern); `audit_log` trigger unchanged.
3. Drizzle schema (`src/db/schema.ts`) mirrors the above; snapshots/journal updated with drizzle-kit (no hand-edited journal).

#### 26.9.2 Rename / deprecation policy
Nothing is renamed or dropped: `appointments`, `availability_slots`, `accountants.appointments_enabled`, `onboarding_steps(step='idopont')`, enum values `idopont`, `appointment_*` all stay.

#### 26.9.3 One-time data step (runtime, idempotent; worker start, marker `system_state['data.tulaj1118']`)
(1) `clients.business_status = 'van'` where `adoszam IS NOT NULL AND business_status IS NULL`; (2) legacy appointments → callbacks (§26.2.9; unique `legacy_appointment_id`); (3) FAQ: insert the four new items of §26.2.7 if no row with the same question exists (texts from jogi `app_szovegek.json`), never overwrite an admin-edited row; (4) nothing else. Re-running is a no-op. Before the first deploy the integrator takes `pg_dump` into `/srv/kezjegy/_regi/` (house rule) and afterwards verifies `alex@` and `tulaj@` rows and their `onboarding_steps` are unchanged except `business_status`.

#### 26.9.4 Audit actions (new)
`callback.created|updated|cancelled|claimed|assigned|calling|attempt|closed|phone_viewed`, `registration.saved|submitted|guide_opened|filed|checked|fix_requested|adoszam_set|withdrawn|edited_by_staff|assigned`, `team.member_invited|updated|disabled|enabled`, `message.sent` (team, no body), `business_status.set`. `details` never holds phone numbers, note texts or addresses.

### 26.10 API (additions; `/api/v1`; DTO names from `kod/shared/src/api.ts`)
Roles: `C` client, `T` csapat, `AD` admin, `A` accountant (row-level as §26.4). Errors §3.5 plus `locked_until_active` 403, `step_locked` 409, `callback_already_open` 409, `megszunt_funkcio` 410.

**System / me**
| Method path | Auth | Request → Response |
|---|---|---|
| `GET /config` | — | + `mediaBaseUrl`, `newBusinessChargePolicy` |
| `GET /me` | all | + `access` (C), `teamMember` (T) |
| `GET /client/access` | C | → **ClientAccess** |
| `GET /client/explainers` | C | → `{ items: Explainer[] }` |

**Onboarding / new business (client)**
| Method path | Auth | Request → Response |
|---|---|---|
| `GET /client/onboarding` | C | → **OnboardingState** (+ `path`, `registration`, `callback`, `steps[].locked/lockedReason/data`) |
| `PUT /client/onboarding/business-status` | C | `{ businessStatus: 'van' \| 'inditas' }` → **OnboardingState** (409 `conflict` §26.1.1) |
| `PUT /client/profile` | C | path `inditas`: **ClientProfileStartInput**; path `van`: unchanged |
| `GET /client/business-registration` | C | → **BusinessRegistrationResponse** |
| `PUT /client/business-registration` | C | **BusinessRegistrationInput** (partial) → **BusinessRegistrationView** (creates in `kitoltes`; 409 when `!canEdit`; 409 `step_locked` when path ≠ `inditas`) |
| `POST /client/business-registration/submit` | C | → **BusinessRegistrationView** (`utmutato`) · 400 `validation_failed` + `fields` · 409 when `hints.stop` |
| `POST /client/business-registration/filed` | C | multipart `file` + **BusinessRegistrationFiledInput** fields → **BusinessRegistrationView** (`beadva`) |
| `POST /client/business-registration/adoszam` | C | **BusinessRegistrationAdoszamInput** → **BusinessRegistrationView** |
| `POST /client/business-registration/withdraw` | C | **BusinessRegistrationWithdrawInput** → **BusinessRegistrationView** (`elallt`) |
| `GET /client/guides/:kind` | C | → **Guide** (409 `step_locked` §26.6.2) |
| `PUT /client/guides/:kind/progress` | C | **GuideProgressInput** → `{ doneStepKeys }` (unknown keys ignored) |

**Callbacks (client)**
| Method path | Auth | Request → Response |
|---|---|---|
| `GET /client/callbacks` | C | → **ClientCallbacks** |
| `POST /client/callbacks` | C | **CallbackCreateInput** → 201 **CallbackView** · 409 `callback_already_open` `{ error, callback }` · 400 phone · 429 |
| `PATCH /client/callbacks/:id` | C | **CallbackUpdateInput** → **CallbackView** (open only) |
| `POST /client/callbacks/:id/cancel` | C | → **CallbackView** |
| `/client/appointments*` | C | retired (§26.2.9) |

**Team (`/team/*`)**
| Method path | Auth | Request → Response |
|---|---|---|
| `GET /team/summary` | T, AD, A | → **TeamSummary** (A: only `callbacks.mine`/`open` of his) |
| `GET /team/callbacks?filter=nyitott\|lejart\|enyem\|gazdatlan\|lezart\|mind&topic&q&cursor` | T, AD, A | → `Page<TeamCallbackRow>` |
| `GET /team/callbacks/:id` | T, AD, A | → **TeamCallbackDetail** |
| `POST /team/callbacks/:id/claim` | T, AD | `{ force?: boolean }` (AD only) → **TeamCallbackDetail** |
| `POST /team/callbacks/:id/assign` | T, AD (A: only `userId: null`) | **CallbackAssignInput** → **TeamCallbackDetail** |
| `POST /team/callbacks/:id/calling` | holder | → **TeamCallbackDetail** |
| `POST /team/callbacks/:id/attempts` | holder | **CallbackAttemptInput** → **TeamCallbackDetail** |
| `POST /team/callbacks/:id/close` | holder, AD | **CallbackCloseInput** → **TeamCallbackDetail** |
| `PATCH /team/callbacks/:id` | holder, AD | **CallbackStaffPatch** → **TeamCallbackDetail** |
| `GET /team/clients/:clientId` | T, AD, A (own) | → **TeamClientCard** |
| `POST /team/clients/:clientId/callbacks` | T, AD, A (own) | **TeamCallbackCreateInput** → 201 **TeamCallbackDetail** (source `csapat`) |
| `GET /team/registrations?status=<status>\|nyitott\|mind&q&cursor` | T, AD | → `Page<TeamRegistrationRow>` |
| `GET /team/registrations/:id` | T, AD | → **TeamRegistrationDetail** |
| `PATCH /team/registrations/:id` | T, AD | **TeamRegistrationPatch** → **TeamRegistrationDetail** |
| `POST /team/registrations/:id/assign` | T, AD | **CallbackAssignInput** → **TeamRegistrationDetail** |
| `POST /team/registrations/:id/check` | T, AD | **RegistrationCheckInput** → **TeamRegistrationDetail** |
| `POST /team/registrations/:id/request-fix` | T, AD | **RegistrationFixInput** → **TeamRegistrationDetail** |
| `POST /team/registrations/:id/adoszam` | T, AD | **RegistrationAdoszamStaffInput** → **TeamRegistrationDetail** |
| `GET /team/threads?cursor` | T | → `Page<TeamThreadRow>` (clients in `bekotes_alatt`) |
| `GET /team/clients/:clientId/messages?cursor` · `POST …/messages` `{ body, fileIds? }` · `POST …/messages/read` `{ upToId }` | T | `Page<Message>` / **Message** / 204 (404 unless `bekotes_alatt`) |
| `POST /team/attachments` | T | multipart `file` → `{ fileId }` |
| `POST /files/:id/link`, `GET /files/:id` | T, AD | + `ev_bejelentes` documents and team-thread attachments (audited) |

**Admin / accountant**
| Method path | Auth | Request → Response |
|---|---|---|
| `GET /admin/team` | AD | → `{ items: TeamMemberRow[] }` |
| `POST /admin/team` | AD | **TeamMemberInvite** → 201 **TeamMemberRow** (staff invite e-mail) |
| `PATCH /admin/team/:userId` | AD | **TeamMemberPatch** → **TeamMemberRow** |
| `GET /admin/dashboard` | AD | + `service: AdminServiceStats` |
| `GET /acc/clients/:id/callbacks` | A | → `{ items: TeamCallbackRow[] }` |
| `GET /acc/clients/:id/business-registration` | A | → `{ registration: TeamRegistrationDetail \| null }` (read-only) |
| `GET /acc/settings` · `PATCH` | A | `appointmentsEnabled` returned as false, ignored on PATCH |
| `/acc/appointments`, `/acc/availability*` | A | read-only / 410 (§26.2.9) |

Validation details: phone `normalizeHuPhone`; zip `isValidHuZip`; adószám §19.1; ÖVTJ `isValidOvtjKod`; dates `YYYY-MM-DD` Budapest; text lengths per §26.2.3 / §26.1.3; enums by the shared lists. Rate limits: callbacks 3 per 24 h per client; registration writes count toward the 600 / 5 min default.

### 26.11 Notifications and e-mail texts (`content_texts` defaults; push bodies never contain amounts, phone numbers or tax ids)
| Kind | To | In-app | Push | E-mail | Title (`notif.<kind>.title`) | Body |
|---|---|---|---|---|---|---|
| `callback_received` | client | ✓ | – | ✓ | "Megkaptuk a visszahívási kérésed" | "Kollégánk 24–48 órán belül hív a {phoneMasked} számon. Telefonon soha nem kérjük a jelszavadat vagy a kódjaidat." |
| ↳ variant `regi_idopont` | client | ✓ | – | – | "Időpont helyett visszahívás" | "Időpontfoglalás helyett mostantól visszahívást kérhetsz. A korábban egyeztetett hívásod megmaradt: kollégánk {when} körül hív." |
| `callback_calling` | client | ✓ | ✓ | – | "Most hív kollégánk, {staffFirstName}" | "Ha nem tudod felvenni, újra próbáljuk." |
| `callback_missed` | client | ✓ | ✓ | ✓ | "Kerestünk, de nem értünk el" | "{when} hívtunk. Újra próbáljuk. Ha más számon érünk el, írd át az alkalmazásban." |
| `callback_wrong_number` | client | ✓ | ✓ | ✓ | "Javítsd ki a telefonszámodat" | "A megadott számon nem értünk el. Írd be a jó számot, és újra hívunk." |
| `callback_done` | client | ✓ | – | – | "Beszéltünk – köszönjük!" | "Ha még kérdésed van, írj nekünk az Üzenetekben." |
| `callback_unreached` | client | ✓ | ✓ | ✓ | "Nem értünk el telefonon" | "Háromszor próbáltuk. Írj nekünk üzenetet, vagy kérj új visszahívást." |
| `callback_closed` | client | ✓ | – | – | "Lezártuk a visszahívási kérésed" | "{reasonText}" |
| `registration_reminder` | client | ✓ | ✓ | ✓ | "Folytasd a vállalkozásod bejelentését" | "Az útmutatód készen áll. Pár perc az egész, és ha elakadsz, kérj visszahívást." |
| ↳ variant `adatlap` | client | ✓ | ✓ | ✓ | "Folytasd az adatlapot" | "Ott folytathatod, ahol abbahagytad. Utána elkészül a személyre szabott útmutatód." |
| `registration_needs_fix` | client | ✓ | ✓ | ✓ | "Egy dolgot javítanod kell a bejelentéseden" | "Megírtuk az alkalmazásban, mit és hogyan." (e-mail body adds "{note}") |
| `registration_checked` | client | ✓ | ✓ | ✓ | "Rendben van a bejelentésed" | "Átnéztük a NAV-os igazolást. Ha megjött az adószámod, írd be az alkalmazásban." |
| `registration_done` | client | ✓ | ✓ | ✓ | "Elindult a vállalkozásod!" | "Rögzítettük az adószámodat. Jöhet a következő lépés: a NAV-meghatalmazás, lépésről lépésre segítünk." |
| `callback_new` | csapat, admin | ✓ (badge) | – | digest | "Új visszahívási kérés: {clientName}" | "{topicLabel} · határidő: {dueText}" |
| `callback_assigned` | the new holder | ✓ | – | ✓ | "Rád bízták: {clientName} visszahívása" | "{topicLabel} · határidő: {dueText}" (variant `uj_szam`: "{clientName} új telefonszámot adott meg.") |
| `callback_overdue` | holder (or csapat) + admin | ✓ | – | ✓ (once) | "Lejárt a 48 óra: {clientName}" | "A kérés {createdText} érkezett. Hívd vissza minél előbb." |
| `registration_submitted` | csapat, admin | ✓ (badge) | – | ✓ | "{clientName} feltöltötte a NAV-os igazolást" | "Nézd át a Vállalkozás-indítás oldalon." |
| `client_message_new` (extended) | + csapat for `bekotes_alatt` clients | ✓ (badge) | – | digest | unchanged | unchanged |
| `message_new` variant `csapat` | client | ✓ | ✓ | – | "Új üzenet: {senderName}" | "Nyisd meg az Üzenetek fület." |
| `onboarding_needs_review` variant `uj_vallalkozas` | accountant | ✓ | – | digest | "{clientName} vállalkozása elindult" | "Nézd át a költséghányadot és a járulékalapot." |
E-mail subjects = titles; e-mail bodies = body + "Megnyitom: {link}" (client → app link; staff → panel link, §25). Staff digest (daily 08:00, `csapat` and `admin`): open/overdue callbacks, registrations waiting for check, unread onboarding threads – sent only when not empty. Legacy `appointment_*` never sent (§26.2.9). Client notification settings show the client kinds above under "Visszahívás" and "Vállalkozás bejelentése" (push/e-mail toggles; `callback_calling` push default on).

### 26.12 Legal texts (`kod/jogi`; drafts, "TERVEZET – jogász ellenőrzi")
- **`aszf.md`**: new section "Segítség új egyéni vállalkozás indításához": what we give (personalised written guide with annotated official screenshots, videos, checking the uploaded NAV confirmation, optional callback), what we do not do (we do not file the bejelentés and do not act as representative in the EV-register matter; the bejelentés is the client's own legal declaration, Evectv. 6. § (4); no legal advice), the client's responsibility for the accuracy of his data and choices, the start day = filing day, the public data of the register, the fee start for new businesses (default: after the adószám is recorded, §26.1.7 [OWNER]), the guide is free before the subscription. Callback service: a target of 24–48 hours, working hours, no guaranteed time, any member of the team may call, no call recording. Version bump; **`requiresReconsent: false`** in this draft round (the owner's live accounts must not be blocked) – [JOGI] decides before go-live.
- **`adatkezeles.md`**: section 2.8 "Üzenetek, kérések, időpontok" → "Üzenetek, kérések, visszahívás": phone number, callback request (topic, note, preferred window), call attempts and short call notes by our staff, no call recording; purpose: calling back at the client's request; basis: contract / steps before contract (GDPR 6. cikk (1) b)) [JOGI]; retention: callback data 1 year after closing, summaries posted as messages follow the message retention (2.5.) [JOGI/OWNER]. New section "Új vállalkozás indítása": the answers of the adatlap (activities, seat and other sites, work type, expected revenue band, EU partners, planned start), the uploaded NAV confirmation (may contain personal data, kept like the client documents), and explicitly what we do **not** collect (TAJ, anyja neve, születési adatok for this purpose). Recipients: Somosi Kft. staff in the ügyfélszolgálat role (only what §26.4 allows). Old wording about booked appointments stays for the existing rows ("korábban foglalt időpontok") with their retention.
- **`nav_meghatalmazas.md`**: keep the ONYA steps (they already match §26.6.3) and add: the meghatalmazás can be given before the business exists and stays valid after registration; the initial EV bejelentés is always filed by the client himself; the [JOGI] question whether the "Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)" ügycsoport may stay in a paid service (Üttv. 2. §, 4. §; Btk. 286. §) – the list in `app_szovegek.json` `meghatalmazas.ugykorok` stays the single switch. No new authorisation template for EV registration (the owner chose self-service; filing by us is out of scope – research §26.1.4).
- **`megbizasi_szerzodes.md`**: contacts by the service team (not only the accountant); the registration help is not representation.
- **`app_szovegek.json`**: `visszahivas.adatkezeles` sentence (§26.2.2); FAQ (8 → 12): the four new items of §26.2.7 with short, true answers (callback: 24–48 h, team member, never asks for passwords; no business yet: choose "Még nincs", fill the adatlap, follow the guide, upload the PDF, we check; why not us: it is your own legal declaration, it takes 10–15 minutes, and we check it afterwards; fee start: per §26.1.7); `azonositas.lakcimkartya` keeps "csak a lakcímes oldal". `npm run minden` must pass (8 → 12 FAQ: update the checker); regenerate `pdf_minta/`.
- The backend content defaults for §26.8/§26.11 live in `backend/src/content/defaults.hu.json` (backend builder); jogi owns only the texts named above.

### 26.13 Demo data addition (live DB, idempotent, never a reseed)
Script `kod/backend/src/seed/tulaj1118.ts` → `npm run seed:tulaj1118` (dist: `node dist/seed/tulaj1118.js`), wrapper `kod/deploy/seed-tulaj1118.sh` (runs it in `kezjegy-api` with `SEED_CREDENTIALS_FILE` bind-mounted). Rules: refuses in `APP_ENV=production`; runs only after migration 0009 and the data step; marker `system_state['seed.tulaj1118']` + per-entity existence checks (by e-mail) → a second run changes nothing; **never touches any existing user/client row** (in particular `alex@demo.kezjegy.test`, `tulaj@demo.kezjegy.test`, Kata, Réka, Péter rows are only *referenced* for callbacks); times relative to `now()`; passwords random 20 chars, appended **only** to `/srv/kezjegy/demo_belepesek.txt` (line `szerep;e-mail;jelszó`, file stays 600), never printed or logged; if the e-mail exists, no new password and no new line. Staff TOTP: handled exactly like the existing seeded staff accounts.
1. **Team member** `Nagy Anna` (role `csapat`, `anna.nagy@demo.kezjegy.test`, first name "Anna") → line `csapat;anna.nagy@demo.kezjegy.test;<pw>`.
2. **New-business client** `Tóth Levente` (`levente.toth@demo.kezjegy.test`, e-mail verified, accountant Bence, lifecycle `bekotes_alatt`, `business_status 'inditas'`): profile (fictional "6720 Szeged, Minta utca 3.", phone +36 30 555 0142, adóazonosító jel formally valid fake), steps `fiok`/`adatok`/`szerzodes` `kesz`, `vallalkozas_inditas` `konyvelore_var`; registration `beadva`: activities "Fotózás, képszerkesztés" (main) + "Videókészítés, vágás", seat `lakcim`, no other site, `workKind 'fofoglalkozas'`, `euPartner 'nem'`, `revenueBand 'max_12m'`, `startPlan 'mielobb'`, guide progress 14/14, filed yesterday via `ugyfelkapu_plus`, document `ev_bejelentes` = generated PDF "MINTA – NEM VALÓDI NAV-ÉRTESÍTÉS" (Geist, grey, no NAV logo or official layout). → line `ugyfel;levente.toth@demo.kezjegy.test;<pw>`.
3. **Second pipeline card without login** `Fehér Zsófia` (`zsofia.feher@demo.kezjegy.test`, `password_hash NULL`, cannot log in): `business_status 'inditas'`, registration `utmutato` (guide opened 4 days ago, 5/14 steps) – shows the "> 3 nap" marker.
4. **Callbacks** (4 states): Levente `uj` (created −3 h, topic `vallalkozas_inditas`, source `vallalkozas_utmutato`, note "Nem találom, melyik tevékenységet válasszam."); Zsófia `uj` **overdue** (created −50 h, topic `vallalkozas_inditas`); Varga Réka `folyamatban` (assigned Anna, created −20 h, 1 attempt `nem_vette_fel` −3 h, topic `ado_befizetes`); Szabó Kata `teljesitve` (created −2 days, attempt `beszeltunk` −1 day by Anna, summary posted to Kata's thread: "A hívásunk összefoglalója: megbeszéltük, hogy a jövedelemigazolás jövő héten elkészül."). Németh Péter's legacy appointment is mapped by the data step (§26.9.3), not by this script.
5. Notifications for the above as the normal code would create them (in-app only; no e-mail is sent in DEMO anyway).

### 26.14 Acceptance tests (per order; backend vitest on PGlite, app + panel on the local harnesses, live checks with curl only – never typing passwords on the live host)
**O1/O7 – new business, self-service**
- O1.1 Backend: a new client answers `inditas`; `GET /client/onboarding` lists `vallalkozas_inditas` 3rd, `meghatalmazas`/`azonositas`/`elofizetes`/`nav_bekotes` locked with reasons; `POST /client/subscription/start` → 409 `step_locked`.
- O1.2 Draft saves per page; `submit` with a missing field → 400 with `fields`; `revenueBand 'tobb_20m'` → 409 + stop text; complete → `utmutato`.
- O1.3 `GET /client/guides/vallalkozas_bejelentes` before submit → 409; after → 14 steps; for `euPartner 'igen'` the közösségi adószám row says "Jelöld be", for `nem` "Ne jelöld be"; `{munkavegzesJellege}` matches `workKind`; no unfilled `{…}` remains (regex check).
- O1.4 `filed` with a PDF → `beadva`, document `ev_bejelentes` in `contracts`, team notified; csapat `check` with 8/9 items → 400, with all → `ellenorizve`; `adoszam` with a bad check digit → 400; valid → `kesz`; profile fields filled per §26.1.8; locks gone; milestone "Vállalkozás elindítva" done.
- O1.5 `request-fix` → `javitas`, client sees the note, re-upload → `beadva` (new version).
- O1.6 Path switch rules (409 after `beadva`); withdraw → `elallt` + `business_status NULL`.
- O1.7 App (390×844 and 360×780): branch card, adatlap 5 pages with "Hol találom?", ÖVTJ search ("foto" finds "Fotózás, képszerkesztés"), cost-ratio hint, stop card, summary, guide with video card, Készítsd elő, step sheets with annotated screenshots (or text-only when missing), full-screen zoom, "Megvan" ticks persist after reload, upload screen, status texts. Screenshots `kod/app/_kepek/k3_*.png`, LOOKED at.
- O1.8 Nowhere in app, panel, notifications, legal texts or videos does it say that we file the bejelentés for the client; no mandatory call anywhere.
- O7.4 KYC: no `addressBack` slot/text in the app; API ignores it; panel shows no back-side box.

**O2 – callback**
- O2.1 Client creates a callback (profile phone and new phone); second create → 409 with the open one; 4th in 24 h → 429; bad phone → 400 Hungarian message.
- O2.2 Staff flow: claim → full phone visible only to the holder (others get `phone: null`), "Most hívom" → client `callingNow: true` + push; attempt `nem_vette_fel` ×3 → `sikertelen` + client notification; `hibas_szam` → client `needsNewPhone`, PATCH phone → back to the holder; `beszeltunk` + summary → message in the client thread; overdue job notifies once.
- O2.3 Accountant sees only callbacks assigned to him (others 404); can be assigned by csapat; can log attempts.
- O2.4 Legacy: Péter's booked call became exactly one callback (`regi_idopont`); running the data step again adds nothing; `POST /client/appointments` → 410; old appointment rows unchanged (row count + checksum before/after).
- O2.5 No booking UI anywhere: grep app/panel source for `idopont`/`slots`/`Időpontot foglal` outside `_regi` → only legacy readers; panel nav has no Időpontok; `/idopontok` redirects.
- O2.6 Every entry point of §26.2.1 opens the form with the right `source`/`topic` (app test + screenshots).

**O3 – bottom bar**
- O3.1 On the local harness with a fresh client (`bekotes_alatt`): the tab bar is visible on Főoldal (onboarding), Dosszié (locked screen), Üzenetek, Fiók and on every onboarding sub-screen; Főoldal active there; logout reachable in ≤ 2 taps. Screenshots at both widths.

**O4 – restricted mode**
- O4.1 Backend matrix test: for a `bekotes_alatt` client every `zarva` route in §26.5.2 returns 403 `locked_until_active` with `feature`; every `nyitva` route works; `POST /client/documents` with a valid open request id works, without → 403; after activation every route works. Same matrix for `GET /client/access`.
- O4.2 App: locked screens/sheets show the reason + "Mi kell még?" + callback link; no silently disabled control.

**O5/O6/O8 – explainers and videos**
- O5.1 Every step card and every form field listed in §26.8.2 has its "Mi ez?"/"Hol találom?" sheet with three non-empty blocks and the listed 3D icon (app test iterates `ONBOARDING_EXPLAINERS`); texts come from `GET /client/explainers` (change one in `/admin/szovegek` → visible in the app).
- O5.2 `curl -I https://app.45-94-65-74.sslip.io/media/bekotes.mp4` → 200 `video/mp4`, `Accept-Ranges: bytes`; a Range request → 206; `bekotes.vtt` → `text/vtt`; `/media/nincs.mp4` → 404 (not HTML). Same for the two guide videos and the posters. Gardoko health OK before/after.
- O5.3 Web: the video card plays (headless Chrome: `video.readyState ≥ 2` after play), captions track present; with the file renamed locally the placeholder text shows. APK (integrator): plays by streaming.
- O6.1 The `bekotes` video starts with "Köszönjük, hogy telepítetted az alkalmazásunkat", follows §26.7.4, contains no product name, no accountant name, no "AI"; reviewed by two independent reviewers (video builder).
- O8.1 Each guide page has its own video card at the top; "Készítsd elő" opens the guide; the API never accepts TAJ / anyja neve fields (unknown fields rejected by zod `strict`).

**O9 – NAV screenshots**
- O9.1 `kepek.json` exists for both guides, every item file exists, `kind` correct, source noted for `kepernyokep`; `missing[]` lists exactly the steps without pictures; the app shows "Illusztráció" on drawn ones and the source line on real ones; no unblurred personal data (visual check of every image).

**Safety**
- S1 Before/after each deploy: `pg_dump` in `/srv/kezjegy/_regi/`, Gardoko health 200, `alex@` / `tulaj@` users + their `onboarding_steps` + consents + subscription rows unchanged (query, never print passwords), demo addition idempotent (second run = no change).
- S2 Role isolation: csapat → 404 on `/acc/*`, `/admin/*`, documents (except `ev_bejelentes`), KYC, tax; cannot approve tax (`POST /acc/tax-calculations/:id/approve` → 404/403); cannot read messages of an `aktiv` client.

### 26.15 Waits (additions to §23)
| # | Item | Who | Until then |
|---|---|---|---|
| 15 | When to charge new-business clients (`adoszam_utan` / `azonnal`) | OWNER | `adoszam_utan` |
| 16 | Caller ID shown to clients (`CALLBACK_CALLER_ID`), callback hours, working-hours-only SLA | OWNER | hidden; 9–17 text; 48 calendar hours |
| 17 | ÖVTJ'25 codes for `BUSINESS_ACTIVITIES` (KSH list), cost classes marked `ellenorizendo`, garantált bérminimum per activity | KÖNYVELŐ | search words; "{firstName} mondja meg" |
| 18 | Review of all §26 texts, guide templates and videos against the live NAV screens; missing screenshots (`utmutato_kepek/hianyzik.md`) captured by the owner and re-annotated | OWNER / KÖNYVELŐ | "Illusztráció" where missing |
| 19 | Guide update for 2027 (chamber register) before 2027-01-01 | OWNER / KÖNYVELŐ | outdated banner from 2027-01-01 |
| 20 | Lawyer: guiding + checking is not "ügyvédi tevékenység"; callback data basis + retention; no-recording statement; may the EV-register ügycsoport stay in the paid meghatalmazás; use of official NAV screenshots (Szjt. 1. § (4)); `requiresReconsent` for the new ÁSZF | JOGI | drafts |
| 21 | Team members (real people, phones), staff digest recipients | OWNER | demo Nagy Anna |

### 26.16 Sources (research of 2026-11-18)
- NAV: A Vállalkozói Ügysegéd útmutatója (2026.03.19): https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Fvallalkozoknak%2Findulo-vallalkozas%2Fkapcsolodo-tartalmak%2Fa-vallalkozoi-ugyseged-utmutatoja · A megújult ügysegédről: https://nav.gov.hu/fooldal-elemei/fooldali-csempek/uj-ugyseged/tajekoztatok/a-megujult-ugysegedrol · Egyéni vállalkozás indítása: https://nav.gov.hu/Elethelyzetek-adozasa/vallalkozas/Egyeni-vallalkozas-inditasa · Sajtóközlemény 2026.02.19: https://nav.gov.hu/sajtoszoba/hirek/Matol_elerheto_a_Vallalkozoi_Ugyseged
- Evectv. (2009. évi CXV.) 3., 4., 6., 11–13., 16. §; 2027-es szöveg: https://net.jogtar.hu/jogszabaly?docid=a0900115.tv · Art. 16. § (2), 1. melléklet: https://net.jogtar.hu/jogszabaly?docid=a1700150.tv · Air. 15., 17. §: https://net.jogtar.hu/jogszabaly?docid=a1700151.tv · Ákr. 13–14. §: https://net.jogtar.hu/jogszabaly?docid=a1600150.tv · Dáptv.: https://net.jogtar.hu/jogszabaly?docid=a2300103.tv · Üttv. 2., 4. §
- NAV GYIK – Állandó meghatalmazás (1–2. oldal): https://nav.gov.hu/ugyfeliranytu/valaszol-a-nav/allando-meghatalmazas
- Adózóna 2026.02.19 / 2026.03.24 (Ügysegéd; 2027-es kamarai nyilvántartás)
- Apple HIG Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars · Android navigation bar: https://developer.android.com/develop/ui/compose/components/navigation-bar · Stripe Connect verification (server-side restrictions): https://docs.stripe.com/connect/handling-api-verification · NN/g disabled states: https://www.nngroup.com/articles/button-states-communicate-interaction/
- Callback practice: HSBC UK "Arrange a callback": https://www.hsbc.co.uk/forms/arrange-a-callback · Monzo call status: https://monzo.com/blog/2023/09/06/making-it-clear-when-were-on-a-call-with-you/ · Revolut "how to know it's really Revolut calling": https://www.revolut.com/blog/post/how-to-know-its-really-revolut-calling/ · MNB/OTP phone-fraud guidance: https://www.otpbank.hu/portal/hu/Hirek/mnb_adathalasz_kozlemeny


---

## 27. Tulaj-kérések 11-19 (owner orders of 2026-11-19) – contract

Written 2026-11-19 10:20–12:30 by the SPEC author for four parallel builders (B1 backend, B2 app, B3 panel, B4 content + tax + images + videos). **§27 wins over §26 and every older section where they differ.** In particular it replaces: §26.1.1 (branch rules), §26.1.5 `withdraw` rule, §26.1.6 step order of the `van` path and the step locks, §26.3.3 last line ("The team never files anything at NAV"), §26.6.3 last sentence ("The initial EV bejelentés is never filed by us"), §26.12 ÁSZF "what we do not do", §26.14 O1.8, and the app's use of the milestone list ("Hol tartunk"). Everything else of §26 stays.

Shared code (already updated and compiling, `npx tsc -p kod/shared/tsconfig.json --noEmit`): `kod/shared/src/enums.ts` (block "SPEC §27" at the end + the changed values listed in §27.0.4), `kod/shared/src/bekotes.ts` (block "SPEC §27" at the end: all new default texts; new explainers; guide template fixes; new guide `meghatalmazas_jovahagyas`), `kod/shared/src/api.ts` (block "SPEC §27" at the end + optional fields on existing DTOs). The old files are in `kod/_regi/shared_src_elotte_tulaj1119/`, the old SPEC in `kod/_regi/SPEC_elotte_par27_tulaj1119.md`. **Builders never edit `kod/shared`**: they run `node ../shared/scripts/sync-shared.mjs src/_shared` in their package; a needed contract change goes to §24 as a dated note and to the orchestrator.

### 27.0 Orders → sections, principles, builders

#### 27.0.1 Orders
| # | Owner's words (11-19, translated) | Where |
|---|---|---|
| 1 | "For the new-business registration REAL screenshots are needed." | §27.1 |
| 2 | "If I choose that I have NO business, I cannot switch back to 'I already have one'." | §27.2 |
| 3 | "If someone is not technical enough, they can ask US to register the business for them – callback. The meghatalmazás too: if needed we do it for them – THIS MUST BE HIGHLIGHTED." | §27.3, §27.6 |
| 4 | "'anyukád' instead of 'anyád'. The flow is important, it is still not transparent enough – look at it with a user's eyes too." | §27.0.3, §27.4 |
| 5 | (10:20) "Write this more clearly EVERYWHERE" – about "a számláid maguktól megjönnek a NAV-tól". | §27.5 |
| – | Open round-2 findings (`_munka/k5/k3_kor2_nyitott.json`) | §27.11 |

Policy for order 3 (orchestrator, binding): self-service stays the default; the assisted path "Intézzük helyetted" is offered on request after a callback (a team member calls within 24–48 h). We NEVER ask for, store or use the client's Ügyfélkapu+/DÁP credentials and never log in as the client; we act only as a registered meghatalmazott; the client approves/confirms what is needed himself. Legal texts are drafts for the lawyer; the zugírászat / Üttv. question for the non-tax EV-register part stays flagged [JOGI].

#### 27.0.2 Principles (in addition to §26.0)
1. **One list, one current action.** The app shows ONE progress list ("Így halad a bekötésed") and ONE primary action per screen. Every row says who acts (Te / {firstName} / Csapatunk / NAV) and how long it usually takes.
2. **One name per thing** (§27.4.1 table). Buttons in first person ("Kitöltöm", "Jóváhagytam"); links may ask ("Mi ez?", "Elakadtál? Kérj visszahívást").
3. **Everything can be undone or changed until it reaches the NAV**: the branch answer, the mode (self / assisted), the questionnaire, the consent. After a filing: a callback.
4. **We never touch the client's login.** Our accountant uses his own KAÜ login as the client's registered meghatalmazott; the client approves in ONYA himself and gives his final OK in the app.
5. Client-facing tegező texts say **"anyukád"**; legal templates, the panel and literal NAV field labels keep "anyja (születési) neve". Never "anyád", never "édesanyád".
6. The client's invoices are **"kiállított számlák"**; we **download** them from the NAV system; never "a NAV-tól jön/jött számla" (§27.5).
7. Live data: never wipe or reseed; migrations additive; `alex@` / `tulaj@` keep their progress (pg_dump before every migration, §26.9.3 house rule). Nobody of us logs in to NAV / Ügyfélkapu+ / DÁP. Only fake data in seeds and screenshots.

#### 27.0.3 Two ways to make the flow transparent – and the choice
**Sketch A – "Így halad a bekötésed" map.** The onboarding Főoldal shows: the blue band ("Még 3 dolog kell tőled, a többit Bence intézi."), ONE "Most ez jön" card with one button, and below it one numbered list of all steps; each row = number · name · who acts · status · typical time · "Mi ez?". Done rows collapse into "✓ 4 lépés kész · Mutasd". Waits are rows of their own ("Csapatunk dolgozik rajta · általában 1 munkanap").
```
┌ kék sáv ─────────────────────────────────────┐
│ Még 3 dolog kell tőled,                       │
│ a többit Bence intézi.      (Kérj visszahívást)│
└───────────────────────────────────────────────┘
┌ MOST EZ JÖN ──────────────────────── Mi ez? ┐
│ 4 · NAV-meghatalmazás   Te · kb. 5 perc       │
│ [ Megnézem, hogyan ]                          │
│ ★ Megcsináljuk helyetted a meghatalmazást  →  │
└───────────────────────────────────────────────┘
Így halad a bekötésed
 ✓ 3 lépés kész · Mutasd
 1  Vállalkozásod   Már van vállalkozásom · Módosítom
 4  NAV-meghatalmazás          Te · kb. 5 perc   ◀ most
 5  Igazolványok               Te · kb. 5 perc
 6  Előfizetés                 Te · kb. 2 perc
 7  Kiállított számlák bekötése  Bence · 1–2 munkanap
```
**Sketch B – strict wizard.** After login the client is inside a full-screen flow: progress bar "3/9", one question or task per screen, "Tovább"/"Vissza"; waiting states are full screens ("Most mi dolgozunk, gyere vissza holnap").

| Criterion (a non-technical 50-year-old on a phone) | A map | B wizard |
|---|---|---|
| "Where am I, what comes next, who is doing it?" | yes, one list | only "3/9"; the rest is hidden |
| Waits of days (team check, adószám, 4-day ONYA approval) | the row says who works and how long; she leaves and comes back to the same picture | the wizard stops on a "wait" screen; coming back days later she does not know what happened meanwhile |
| Steps that can run in parallel (contract while we check; ID photos while NAV works) | "Ezt is megcsinálhatod már" rows | hidden until the wizard reaches them → longer total time |
| Fixing a wrong answer (order 2) | "Módosítom" on row 1, always visible | many "Vissza" taps; data loss risk |
| Long tasks (14-step NAV guide, 8-step meghatalmazás) | a wall if shown on one page (today 22 phone screens) | one step per screen ✓ |
| Few decisions per screen | only if exactly one "Most ez jön" card exists | ✓ |

**Choice: combine – A as the home, B inside every long task.** The map is the only home of onboarding (it answers "where am I" and survives days of waiting); every task longer than one screen opens as a strict one-step-per-screen sequence with "2/5"-style progress and "Vissza" (kérdőív 5 pages, NAV guide 14 steps, meghatalmazás guide 8 steps, approval guide 6 steps, final consent). This is what a slow reader needs: she always sees the whole road on the Főoldal, and inside a task she never sees more than one thing to do. The old second list ("Hol tartunk") disappears from the app (the panel keeps milestones).

#### 27.0.4 What changed in `kod/shared` (contract for all builders)
- `enums.ts` – changed values: `ONBOARDING_STEP_ORDER.van` (szerződés → meghatalmazás → igazolványok → előfizetés → számlák, same tail as `inditas`), new `ONBOARDING_STEP_ORDER_SEGITETT`; `ONBOARDING_STEP_LABELS.nav_bekotes` = "Kiállított számlák bekötése"; `MILESTONE_LABELS.szamlak_bekotve`; `NAV_ITEM_STATUS_LABELS.feltoltve` = "Letöltöttük"; `REGISTRATION_STATUS_CLIENT_TEXT` (kérdőív / értesítés nouns); `FILING_CHANNELS` + `meghatalmazott` (+ `CLIENT_FILING_CHANNELS`); `GUIDE_KINDS` + `meghatalmazas_jovahagyas` (+ its `GUIDE_STEP_KEYS`), `GUIDE_VIDEO` now `VideoName | null`, new `GUIDE_IMAGE_LABELS`; `CALLBACK_TOPICS` + `vallalkozas_bejelentes_helyettem`, `meghatalmazas_helyettem` (+ `CALLBACK_ASSIST_TOPIC`); `CALLBACK_SOURCES` + `helyettunk_vallalkozas`, `helyettunk_meghatalmazas`, `utvaltas`; `CLIENT_FEATURES` + `helyettunk` (nyitva); `CLIENT_FEATURE_RULES.dosszie/nav_szamlak` texts; `NOTIFICATION_KINDS` + 10 kinds (§27.8); `MEGHATALMAZAS_METHOD_LABELS`. New block: `PATH_CHANGE_*`, `REGISTRATION_MODES`, `ASSIST_*` (kinds, statuses, labels, ball, actions + roles, close reasons, check items + labels, jogcím, rules, error codes, `ASSIST_EV_ENABLED_DEFAULT`, `ASSIST_EV_VALID_UNTIL_DEFAULT`, `ASSIST_UJEGYKE_JOGCIM_DEFAULT`), `JOURNEY_*` (step keys, actors, row states, variants, order, preview, not-required), `LOCK_ELOFIZETES_SZERZODES_UTAN`.
- `bekotes.ts` – texts: "anyukád" (explainer `szuletesi_adatok`, `PREPARE_ITEMS`), `nav_bekotes` / `adoszam` / `varhato_bevetel` / `alanyi_afa_mentesseg` / `jogallas` / `taj_szam` / `ugyfelkapu_dap` / `vallalkozoi_ugyseged` / `nav_igazolas_pdf` / `nav_meghatalmazas` / `vallalkozas_van_e` explainers; BUSINESS_ACTIVITIES `foto` → `lista80` (Szja tv. 53. § (2) i), round-2 tax finding 2); guide `vallalkozas_bejelentes` fixed to the real NAV screens (6 pages "(1/6)…(6/6)", "Saját ügyemben járok el", "Új bejelentés, kérelem benyújtása" → "Egyéni vállalkozói tevékenység elkezdése (vállalkozói bejelentkezés)", Személyi adatok without Lakcím/TAJ rows, four Nyilatkozatok, "Figyelem!" box, "Bejelentéseim, kérelmeim → Megtekintés → Letöltés"); new guide `meghatalmazas_jovahagyas`; `personaliseGuide()` accepts the new kind and `jovahagyasHatarido`; 12 new explainers (`fiok`, `utvaltas`, `kiallitott_szamlak`, `helyettunk_vallalkozas`, `helyettunk_meghatalmazas`, `meghatalmazas_jovahagyas`, `kamarai_regisztracio`, `konyvelovaltas`, `szuletesi_nev`, `anyja_szuletesi_neve`, `okmany_szama`, `okmany_ervenyesseg`), `WHERE_TO_FIND_EXPLAINERS`, `STEP_EXPLAINER.fiok`. New text blocks: `INVOICE_WORDING`, `INVOICE_WORDING_FORBIDDEN_PATTERNS`, `JOURNEY_STEP_TEXTS`, `JOURNEY_TEXTS`, `WAITING_TEXTS`, `WAITING_ESCALATE_TEXT`, `WAITING_MEANWHILE_TEXT`, `PATH_CHANGE_TEXTS`, `START_MODE_TEXTS`, `ASSIST_TEXTS`, `ASSIST_STEP_LIST`, `ASSIST_STATUS_CLIENT_TEXT` (+ `_MH`), `KAMARA_TEXTS`, `KERDOIV_TEXTS`, `HUB_TEXTS`, `STEP_LOCK_DEFAULT_TEXTS`, `GUIDE_DRAWN_NOTE`. Placeholder rule (header of the block): `{date}` = "november 22.", `{hatarido}` = "november 22-ig" (server-built).
- `api.ts` – optional new fields: `OnboardingState.journey/pathChange/assists/registrationMode`, `BusinessRegistrationView.mode/chamber`, `CallbackView.assistId`, `TeamSummary.assists`, `TeamClientCard.pathHistory/assist/registrationMode`, `TeamRegistrationRow.mode/assistId/pathChangedAt`, `AdminServiceStats.assists`; `Guide.video` is now `VideoRef | null` (+ `approvalDue`). New DTOs: `JourneyStepView`, `WaitingCardView`, `JourneyView`, `PathChangeInfo`, `BusinessStatusInput`, `PathHistoryItem`, `AssistView`, `AssistCreateInput`, `AssistCreateResult`, `AssistConsentSummary`, `AssistConsentInput`, `AssistCancelInput`, `ChamberDoneInput`, `TeamAssistRow`, `TeamAssistChecklistItem`, `TeamAssistDetail`, `AssistAgreedInput`, `AssistUjegykeFiledInput`, `AssistEvFiledInput`, `AssistCloseInput`, `AssistStaffPatch`.
- **Expected compile breaks after `sync-shared`** (each builder fixes its own): backend `notify/notify.ts` `KIND_DEFAULTS` (10 new kinds), `services/guides.ts` `GUIDE_TITLES` + `GUIDE_VIDEO[kind]` may be null, the route→feature map for `helyettunk`, every `Record<CallbackTopic|CallbackSource|FilingChannel, …>`; app `api/minta/tulaj1118.ts` (`Record<GuideKind, …>`), the guide video card (`video` may be null); panel `lib/labels.ts` `CALLBACK_SOURCE_LABEL`. Tests that match old texts: app `tests/tulaj1118.test.ts:90` (/Anyád/), jogi `src/jogi.test.ts:327`.

#### 27.0.5 Builders, file ownership, parallel rules
| Builder | Owns (may edit) | Must not edit |
|---|---|---|
| **B1 backend** | `kod/backend/**` except the B4 files below; `kod/deploy/*.sh\|*.yml\|README.md` (scripts only, no server action) | `kod/shared`, `kod/ado-motor`, `kod/jogi`, B4's backend files |
| **B2 app** | `kod/app/**` (incl. `scripts/utmutato-kepek.mjs`, `scripts/helyi-proba.mjs`, the MINTA server, tests, `app.config.ts`) | everything else |
| **B3 panel** | `kod/panel/**` (incl. its mock) | everything else |
| **B4 tartalom** | `kod/jogi/**`; `kod/ado-motor/**`; in the backend ONLY `src/services/tax.ts`, `src/services/flags.ts`, `src/lib/pdf.ts`, the function `accMeters`/`third()` in `src/routes/acc.ts`, and in `src/jobs.ts` ONLY the limit-warning job and `jobNewYear`; `C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/**`; `kod/media/utmutato/**` (by running B2's normaliser, never editing it); `C:/Users/UpgradePC/konyvelo_app/video/**` and `kod/media/*.mp4\|*.vtt\|*_poszter.jpg` (only after checking that the video job `wf_f9dfda1c-a0b` is finished: its `journal.jsonl` ends with the "élesítés" result and no later `started`) | `kod/shared`, app/panel source |
- Two builders touch `kod/backend/src/jobs.ts` and `src/routes/acc.ts`: re-read the file right before each edit, change only your own region, never reformat the file. B1 puts all new jobs in a new file `src/jobs-tulaj1119.ts` and adds ONE registration line to the scheduler.
- Local ports: B1 8851–8859, B2 8831–8839, B3 8841–8849, B4 8861–8869. Logged-in journeys only on the local harnesses with the demo seed (`/__helyi/belep?ki=<seed user>`); never type a password on the live host. Look at every screenshot (unique `--user-data-dir` per shot).
- Nobody deploys. The integrator (after the four builders) runs pg_dump → `feltolt.sh` → `up.sh` (migrations 0010 + 0011) → data step → `seed-tulaj1119.sh` → `feltolt.sh --media`, with the Gardoko health check (`https://45-94-65-74.sslip.io/api/v1/health`) before and after, shared Caddy files copied to `/srv/appok/_regi/` before any change.

### 27.1 Order 1 – real NAV screenshots in the new-business guide

#### 27.1.1 State on 2026-11-19 (képek job; `utmutato_kepek/hianyzik.md`, `forrasok.json`)
- `vallalkozas_bejelentes`: 18 pictures. **7 real**: `01_belepes` (KAÜ login page), `02_ugyseged_fooldal`, `03_ugyseged_ugytipus`, `04_szemelyi_adatok`, `11_nyilatkozatok`, `13_bekuldes`, `14_megtekintes_pdf` (stills of NAV's own short film "Megújul az Ügysegéd", https://youtu.be/DQnbjo2lrv8, linked from NAV's 2026-02-19 press release; test names and the case id blurred; captured as 1:1 screenshots in the built-in browser, no download). **11 drawn**: `05_cimadatok`, `06_tevekenysegek`, `07_adozas_munkavegzes_*` (4 variants), `08_adozas_kata_atalany`, `09_adozas_afa_mentesseg`, `10_adozas_afa_tobbi_eu_*` (2), `12_ellenorzes` – no official image exists; they stay "Rajzolt vázlat" until the owner captures them. `meghatalmazas`: 16/16 real. `meghatalmazas_jovahagyas`: new (B4, §27.3.6).
- The film showed facts that are now in the shared guide template (§27.0.4). B4 keeps every step text and its picture caption saying the same thing (round-2 owner finding 13).

#### 27.1.2 How the guide shows real vs drawn pictures (B2)
- Under every picture, as part of the picture block (never on the picture, never hidden, read by screen readers), 12 pt secondary text, one line: real → **"NAV-képernyő · Forrás: NAV, {source.title}, {source.date}"**; owner's own capture → **"NAV-képernyő · Forrás: saját képernyőkép, {date}"**; drawn → **"Rajzolt vázlat – a valódi képernyő kicsit eltérhet"** (`GUIDE_IMAGE_LABELS`). The caption (`GuideImage.caption`) comes first, the label second. Today's "NAV KÉPERNYŐ · RAJZOLT VÁZLAT" capsule is replaced by this line.
- When at least one picture of the guide is drawn, one line under the guide's intro (`GUIDE_DRAWN_NOTE`, content `vallalkozas.utmutato.rajz_megjegyzes`): "Néhány képet rajzoltunk, mert arról a lapról nincs hivatalos NAV-kép. A valódi oldal kicsit eltérhet." The line disappears by itself when `kepek.json` has no `illusztracio` item.
- The full-screen viewer shows the same label under the zoomed picture.

#### 27.1.3 Where the pictures come from (unchanged pipeline)
`utmutato_kepek/<kind>/index.json` (`lepesek[]`: `lepes_kulcs`, `tipus` valodi|illusztracio, `forras`, `felirat`, `mit_csinalj`, `alt`, `jelolesek`) → `annotate.py` (PNG + @2x, markers, blur) → normaliser `node kod/app/scripts/utmutato-kepek.mjs` (B2 makes it iterate `GUIDE_KINDS`, so the new kind needs no special code) → `kod/media/utmutato/<kind>/kepek.json` (`GuideImageManifest`, `kind` = `kepernyokep` | `illusztracio`, `source`) → app. The app never hard-codes a picture.

#### 27.1.4 Owner capture kit (already built; B4 only keeps it working)
- Instructions: `C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/SAJAT_KEPEK.md` (phone-readable, tegező): he logs in HIMSELF on his own computer, captures screens 02–13 in order, **never presses "Bejelentés megtétele" or "Mentés"**, saves them as `utmutato_kepek/sajat/vallalkozas_bejelentes/02.png … 13.png` (optional `sajat/nevek.txt` = extra words to blur).
- ONE command: **`python C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/sajat_kepek.py`** – offline OCR (Windows), blurs personal data, places the markers, writes `index.json` + `annotate.py`, review sheet `utmutato_kepek/_elonezet/sajat_ellenorzes_<guide>.jpg`, runs the normaliser, re-renders the guide video with the EXISTING voice (no paid calls). Nothing is uploaded; after he looked at the review sheet: `node kod/deploy/videok-json.mjs` and `bash kod/deploy/feltolt.sh --media`.
- B4 extends the kit to the folder `sajat/meghatalmazas_jovahagyas/` (the JÓVÁHAGYÁS button + its confirm pop-up have no official image; the owner or Bence captures them at the first real approval, blurred by the same command). If that extension is not small, B4 writes it as an owner to-do instead.

### 27.2 Order 2 – the branch answer can always be changed

#### 27.2.1 Rule
The answer to "Van már egyéni vállalkozásod?" can be changed **in the app at any time while nothing has reached the NAV in the client's name and he has not entered an adószám**; after that only through a callback (the team then changes it, §27.2.3). Data of both branches are kept. The change is offered everywhere the wrong answer bites (§27.2.5).

Blockers (`PATH_CHANGE_BLOCKERS`, checked in this order; the first that applies is returned):
| Blocker | Condition | Blocks |
|---|---|---|
| `nem_bekotes_alatt` | `clients.lifecycle ≠ 'bekotes_alatt'` | both directions |
| `bejelentes_bekuldve` | the client's registration (not `elallt`) is `beadva`, `javitas`, `ellenorizve` or `kesz` | both |
| `bejelentes_engedelyezve` | an open EV assist is `ugyfel_engedelyezte` or `bejelentes_bekuldve` | both |
| `adoszam_megadva` | path `van` and `clients.adoszam IS NOT NULL` | `van → inditas` |

#### 27.2.2 Transitions (server, one transaction each; `clients.business_status_changed_at = now()`)
| From → to | Effects |
|---|---|
| `NULL → van` | set `van`. Nothing else. |
| `NULL → inditas` | set `inditas`; **registration**: if the client's latest `business_registrations` row is `elallt` and was never filed (`filed_at IS NULL`), **reopen that row** (status `utmutato` if `submitted_at` is set, else `kitoltes`; clear `withdrawn_at/withdraw_reason/withdraw_note`; keep `answers`, `guide_progress`, `mode` = `onallo`); else insert a new row (`kitoltes`, `mode 'onallo'`). Step row `vallalkozas_inditas` follows `REGISTRATION_STEP_STATUS`. |
| `van → inditas` | blockers checked; same registration rule as above. `adatok` keeps its status (the Rólad page is a subset of the van form). The van-only profile fields (EV-szám, tevékenység, mióta, …) stay in `clients` untouched; they are overwritten only when the registration reaches `kesz` (§26.1.8). |
| `inditas → van` | blockers checked; set `van`; the open registration → `elallt` with `withdraw_reason 'mar_van_vallalkozasa'`, `withdraw_note 'utvaltas'` (answers kept); open EV assist: if no UJEGYKE was filed yet (`visszahivas_kerve`, `egyeztetve`) → `lezarva`, reason `utvaltas` (its callback stays open – the client may still want to talk); if the UJEGYKE was already filed (`meghatalmazas_bekuldve`, `_lejart`, `_jovahagyva`, `_el`) → **converted to kind `meghatalmazas`** (status kept; `meghatalmazas_el` becomes `kesz`); `adatok` → `ugyfelre_var` if `clients.adoszam IS NULL`. |
| mode `onallo → segitett` (path `inditas`) | only through `POST /client/assist {kind:'vallalkozas_bejelentes'}` (§27.3): sets `business_registrations.mode = 'segitett'` (creating the registration if needed). |
| mode `segitett → onallo` | `POST /client/assist/:id/cancel` → assist `visszavonva`, `mode = 'onallo'`; if the UJEGYKE was already filed the assist is converted to kind `meghatalmazas` instead of being cancelled. |
- A change back within 30 s of the previous one is the "Visszavonom" undo: same endpoint, audited with `note: 'visszavonta'`.
- `POST /client/business-registration/withdraw` follows the same blockers: allowed only in `kitoltes` and `utmutato` (before filing); otherwise 409 `path_change_needs_callback` (round-2 audit, walkthrough problem 19). Reason `mar_van_vallalkozasa` = the same effect as `inditas → van`; other reasons set `business_status = NULL` as before.
- `PUT /client/profile` with the full `van` body while `business_status IS NULL` → **409 `path_required`** "Előbb válaszolj a kérdésre: van már egyéni vállalkozásod?" (no more silent `van`; walkthrough problem 3). The app never opens the van form before the answer.
- Blocked change → 409 `path_change_needs_callback`, `message` = `PATH_CHANGE_BLOCKER_TEXT[blocker]`; the app shows the blocked sheet with "Kérem a visszahívást" (source `utvaltas`, topic `bekotes`).

#### 27.2.3 API (B1)
- `PUT /client/onboarding/business-status` **BusinessStatusInput** `{ businessStatus, mode?: 'onallo' }` → **OnboardingState** (with `pathChange`, `journey`). 409 as above.
- `GET /client/onboarding` → `pathChange: PathChangeInfo` (`canChange`, `blocker`, `blockerText`, `confirmText` = `PATH_CHANGE_TEXTS.toVan` (+ `toVanAssist` when an EV assist is open) or `.toInditas`).
- Staff: `POST /team/clients/:clientId/path` `{ businessStatus, note (1–500), clearAdoszam?: boolean }` (roles csapat, admin) – the change the team makes after the callback. Ignores the blockers `adoszam_megadva` (with `clearAdoszam: true` the server sets `clients.adoszam = NULL`; the old value goes into the audit details – the adószám is public register data, Evectv. 12. §) and `bejelentes_engedelyezve` (the open assist is closed `utvaltas` first); never ignores `bejelentes_bekuldve` or `nem_bekotes_alatt` (a filed bejelentés cannot be undone: the team uses the fix / withdraw flows of §26.3.3).

#### 27.2.4 Audit and notification
- Audit `business_status.changed` `{ from, to, by: 'ugyfel'|'csapat'|'admin', undo?: true, note? }` for every change (the existing `business_status.set` stays for the first answer). Details never hold note texts of the client.
- Notification `client_path_changed` (in-panel badge for csapat + admin + the client's accountant; staff digest; no e-mail, no push): "{clientName} módosította a válaszát" / "{fromLabel} → {toLabel}" (labels `JOURNEY_TEXTS.pathVan` / `pathInditas`). Not sent for the first answer or an undo within 30 s.

#### 27.2.5 Where the client can change it (B2) and what the panel shows (B3)
App entry points (all open the same change sheet, §27.4.4 S5): (1) **row 1 of the journey on the Főoldal**: "Vállalkozásod · {Már van vállalkozásom | Most indítom | Most indítom – ti intézitek} · Módosítom" – always visible during onboarding; (2) Rólad page header link `PATH_CHANGE_TEXTS.roladLink`; (3) Adataid page 2 (van), under the adószám field: `adoszamNincsLink`; (4) kérdőív gate AND page 1: `kerdoivLink`; (5) Fiók during onboarding: row "Vállalkozásod" with the current answer; (6) the hub's "Mégsem most?" sheet: "Mégis van vállalkozásom". After every change: toast `toastVan` / `toastInditas` with "Visszavonom" (5 s).
Panel: client card and client page show "Útvonal: Most indítja → Már van vállalkozása · ma 10:20 · az ügyfél váltott" (`TeamClientCard.pathHistory`, newest first, max 5); the pipeline card of a registration left this way shows "Útvonalat váltott – már van vállalkozása" instead of "Elállt"; csapat/admin get the "Útvonal módosítása" button on the client card (opens the staff change dialog with the note field and, when an adószám exists, the checkbox "Az adószám nem az övé – törlöm a profilból").

### 27.3 Order 3 – "Intézzük helyetted" (assisted path)

#### 27.3.1 Entry points (all highlighted the same way: white sheet with a 2 pt brand-blue border, a small capsule badge in `gombMAlap` with brand text, 3D icon 44 pt; never a pastel circle)
| Place | Card | Kind / source |
|---|---|---|
| Right after "Még nincs, most indítanám" | the second question "Hogyan jelentsük be a vállalkozásodat?" (`START_MODE_TEXTS`): two big cards, "Magam jelentem be" and the highlighted "Intézzétek helyettem" (badge "Ha nem boldogulsz vele"). Choosing self = `PUT business-status {inditas, mode:'onallo'}`; choosing assisted = `PUT business-status {inditas}` then the confirm sheet (§27.3.2) | `vallalkozas_bejelentes` / `helyettunk_vallalkozas` |
| Hub "Vállalkozás bejelentése" and the Főoldal while mode `onallo` and nothing is filed | card `ASSIST_TEXTS.evCardTitle/evCardBody`, button "Ezt kérem" | same |
| Inside the NAV guide (every step screen, under "Elakadtál?") | text link `ASSIST_TEXTS.guideLink` | same / `vallalkozas_utmutato` |
| NAV-meghatalmazás step (both paths), **at the top, above the self-service guide** | card `mhCardBadge` "Megcsináljuk helyetted" + `mhCardTitle` "Megcsináljuk helyetted a meghatalmazást" + `mhCardBody`, button "Ezt kérem" (illustration `meghatalmazas_alairva`) | `meghatalmazas` / `helyettunk_meghatalmazas` |
| Főoldal "Most ez jön" card of the meghatalmazás row | secondary line under the button: "★ Megcsináljuk helyetted a meghatalmazást" → same card | same |
| Callback form | topics `vallalkozas_bejelentes_helyettem`, `meghatalmazas_helyettem` (labels "Intézzétek helyettem: …"); choosing one turns the form into the confirm sheet | per topic |
| FAQ | two new items (§27.10) | – |
Hidden when `ASSIST_EV_ENABLED=false` or after `ASSIST_EV_VALID_UNTIL` (default `2026-12-31`, the end of the NAV register): the EV card then shows `ASSIST_TEXTS.disabled` with "Kérem a visszahívást" (topic `vallalkozas_inditas`). The meghatalmazás card is never hidden.

#### 27.3.2 The request = a callback with a type (client screen `/helyettunk?fajta=<kind>&forras=<source>`, B2)
- Modal screen like `/visszahivas`, titled `sheetTitleEv` / `sheetTitleMh`. Top: the numbered "így megy" list `ASSIST_STEP_LIST[kind]`: each line = actor chip (Te / {firstName} / Csapatunk / NAV) + text + time. Then `needs`, then the **never-credentials box** (3D `lakat` 36 pt + `ASSIST_TEXTS.neverCredentials`), then `free` [OWNER], then the callback fields exactly as §26.2.2 (masked phone + "Másik számot adok meg", window, note), topic fixed (not a chip), the promise block of §26.2.2, primary **"Kérem a visszahívást"**. Toast `ASSIST_TEXTS.toast`.
- `POST /client/assist` **AssistCreateInput** → 201 **AssistCreateResult**: creates the assist (`visszahivas_kerve`) and a callback with topic `ASSIST_CALLBACK_TOPIC[kind]`. If the client already has an open callback, the server **links** it instead of refusing: topic set to the assist topic, the new note appended ("— Intézzük helyetted kérés: …"), audit `callback.updated`. 409 `assist_already_open` (`{ error, assist }`) when an open assist of the same kind exists; an open `meghatalmazas` assist + a new `vallalkozas_bejelentes` request → the meghatalmazás assist is **upgraded** to kind `vallalkozas_bejelentes` (status kept). Rate limit: counts toward the 3 callbacks / 24 h.
- Kind `meghatalmazas` requires the step `meghatalmazas` to be not locked except by `szerzodes_utan` (the contract can follow the call); on the self-service `inditas` path it is available only after filing (409 `step_locked`). Kind `vallalkozas_bejelentes` requires path `inditas` (the app sets it first) and no filed registration.
- Backward compatibility: `POST /client/onboarding/meghatalmazas {method:'onya_konyvelo'}` without `approved` (old app builds) = `POST /client/assist {kind:'meghatalmazas', source:'meghatalmazas_utmutato'}` using the profile phone (if there is no phone: the assist is created without a callback in `visszahivas_kerve`, and the team contacts the client in Üzenetek); with `approved: true` = `POST /client/assist/:id/approved`.

#### 27.3.3 What the client confirms in the app before we act
1. **Before the UJEGYKE** (both kinds): the accepted contract (step `szerzodes` = `kesz`) – our accountant may act for him only under the megbízási szerződés; the Rólad data (name, adóazonosító jel) saved. The server refuses `ujegyke-filed` otherwise (409 `assist_wrong_status`, message "Előbb az ügyfélnek el kell fogadnia a szerződést.").
2. **The approval itself happens at the NAV** (ONYA, his own login) – the app only guides him and records "Jóváhagytam".
3. **Before the EV bejelentés** (kind `vallalkozas_bejelentes`): screen **"Nézd át, mit jelentünk be"** (`/bekotes/vallalkozas/engedely`, §27.4.4 S17) = a data summary in blocks + two checkboxes + one button:
   - Blocks (`AssistConsentSummary.blocks`, each with "Módosítom" → the kérdőív page): **Rólad (a NAV tölti ki)** name + adóazonosító jel masked; **Székhely** (+ the amber line `consentPublic`); **Telephely, fióktelep** or "Nincs"; **Tevékenységek** "kód – név" (fő first); **Munkavégzés jellege** (`WORK_KIND_GUIDE_VALUE`); **Adózás** `consentAdozas`; **Kezdés napja** `consentKezdes` (planned: next working day after the consent).
   - Checkbox 1 – the client's OWN declaration (Evectv. 3. §): `consentDeclaration`. Checkbox 2 – the written instruction [JOGI]: `consentInstruction` with the accountant's full name. Button **"Engedélyezem a bejelentést"**.
   - `GET /client/assist/:id/consent` → **AssistConsentSummary** (`hash` = sha256 hex of the canonical JSON `{version, blocks}`); `POST /client/assist/:id/consent` **AssistConsentInput** `{hash, declaration:true, instruction:true}` → **AssistView**. 409 `assist_consent_stale` when the hash differs from the current one; 409 while `activityPending` (an activity has no ÖVTJ line yet – "Előbb megírjuk a tevékenységed sorát.") or `missing` is not empty.
   - Stored on the assist: `consent_at`, `consent_hash`, `consent_version`, `consent_snapshot` (the blocks), IP and user agent (like `consents`). A PDF "Utasítás a vállalkozásod bejelentésére" (jogi template `ev_bejelentes_utasitas`, §27.10) is generated and stored as a document (category `szerzodes_alairt`, source `rendszer`, visibility `kozos`, listed in `DossierView.contracts`).
   - **Any later change** of the answers (client `PUT /client/business-registration`, team `PATCH /team/registrations/:id` incl. ÖVTJ codes) clears the consent's validity: status `ugyfel_engedelyezte → meghatalmazas_el` (or the consent is just marked invalid while the meghatalmazás track is still running), notification `assist_consent_needed` variant `ujra`, audit `assist.consent_invalidated`.
   - The consent may be given as soon as the questionnaire is complete and no activity is pending – even before the meghatalmazás is live (`canConsent`); the status then jumps to `ugyfel_engedelyezte` the moment the meghatalmazás is verified.

#### 27.3.4 State machine, who acts, client-visible statuses (`assist_requests.status`, `ASSIST_STATUSES`)
```
visszahivas_kerve ──csapat/accountant: call done + 'hivas' checklist──► egyeztetve
egyeztetve ──accountant: UJEGYKE filed as meghatalmazott + 'ujegyke' checklist──► meghatalmazas_bekuldve (due = filing day + 3)
meghatalmazas_bekuldve ──client "Jóváhagytam"──► meghatalmazas_jovahagyva ──accountant: live in ONYA──► meghatalmazas_el (EV) | kesz (kind meghatalmazas)
meghatalmazas_bekuldve ──accountant sees it live (client forgot to tap)──► meghatalmazas_el | kesz
meghatalmazas_bekuldve ──no approval 4 days + 2 h (worker) or staff──► meghatalmazas_lejart ──accountant re-files──► meghatalmazas_bekuldve (new due)
meghatalmazas_el ──client consent (valid)──► ugyfel_engedelyezte ──accountant: EV filed + PDF + 'bejelentes' checklist──► bejelentes_bekuldve
bejelentes_bekuldve ──registration kesz (team check + adószám, §26.1.5)──► kesz
any open before bejelentes_bekuldve ──client "Mégis magam csinálom"──► visszavonva   (UJEGYKE already filed → converted to kind meghatalmazas instead)
any open ──staff "Lezárom" + reason──► lezarva
```
| Status | Ball (`ASSIST_BALL`) | Client sees (`ASSIST_STATUS_CLIENT_TEXT`) | Journey row / card | Step rows |
|---|---|---|---|---|
| `visszahivas_kerve` | csapat | "Visszahívást kértél. Kollégánk 24–48 órán belül hív." | row `visszahivas` (EV) or the `meghatalmazas` row (kind `meghatalmazas`) = var (Csapatunk); waiting `helyettunk_hivas`; meanwhile: kérdőív / the next open row | – |
| `egyeztetve` | konyvelo | "Beszéltünk. {firstName} hamarosan beküldi a meghatalmazást, utána jóváhagyod." | row `meghatalmazas` = var ({firstName}), waiting `helyettunk_ujegyke` | `meghatalmazas` = `konyvelore_var`, data.method `onya_konyvelo` |
| `meghatalmazas_bekuldve` | ugyfel | "{firstName} beküldte a meghatalmazást. Hagyd jóvá az ONYA-ban {hatarido}." | row `meghatalmazas` = **most**, due date + "még N nap" / "Ma van az utolsó nap"; card `approveTitle` + "Megnyitom az útmutatót" + "Jóváhagytam" | `meghatalmazas` = `ugyfelre_var` |
| `meghatalmazas_lejart` | konyvelo | "Lejárt a 4 nap. {firstName} újra beküldi a meghatalmazást, és szólunk." | row = var; card `expiredTitle/expiredBody` + "Jóváhagytam" stays as a secondary link (late approvals happen) | `ugyfelre_var` |
| `meghatalmazas_jovahagyva` | konyvelo | "Jóváhagytad. {firstName} ellenőrzi, hogy él-e a meghatalmazás." | waiting `helyettunk_ellenorzes` | `konyvelore_var` (+ `clientApprovedAt`) |
| `meghatalmazas_el` (EV) | ugyfel | "Él a meghatalmazás. Nézd át az adataidat, és engedélyezd a bejelentést." | row `vegso_jovahagyas` = most | `meghatalmazas` = `kesz` |
| `ugyfel_engedelyezte` | konyvelo | "Engedélyezted. {firstName} általában 1 munkanapon belül beküldi a bejelentésedet." | waiting `helyettunk_bekuldes` | – |
| `bejelentes_bekuldve` | csapat | "Bejelentettük a vállalkozásodat. Rögzítjük az adószámodat." | card `filedTitle/filedBody` + "Megnézem az értesítést"; waiting `helyettunk_adoszam` | registration `beadva`, channel `meghatalmazott` |
| `kesz` | – | EV: "Elindult a vállalkozásod. Jöhet a következő lépés." · MH: "Él a meghatalmazás. {firstName} intézheti az adóügyeidet." | rows done; kamara row opens (EV) | registration `kesz` / step `kesz` |
| `visszavonva` / `lezarva` | – | "Lemondtad. Ha mégis kéred, bármikor szólhatsz." / "Lezártuk a kérésedet: {reasonText}." | the self-service rows come back | – |

Who may do what (enforced in the API; `ASSIST_ACTION_ROLES`; "konyvelo" = only the client's own accountant, others 404):
| Action (endpoint) | ügyfél | csapat | konyvelő | admin |
|---|---|---|---|---|
| create (`POST /client/assist`, `POST /team/clients/:id/assists`) | ✓ | ✓ | ✓ | ✓ |
| agreed (`…/agreed`, all `hivas` items of the kind) | – | ✓ | ✓ | ✓ |
| UJEGYKE filed (`…/ujegyke-filed`, all `ujegyke` items, jogcím) | – | – | ✓ | ✓ (records what the accountant did) |
| client approved (`POST /client/assist/:id/approved`) | ✓ | – | – | – |
| expired (`…/expired`; worker automatically) | – | ✓ | ✓ | ✓ |
| meghatalmazás live (`…/mh-live`) | – | – | ✓ | ✓ |
| consent (`POST /client/assist/:id/consent`) | ✓ | – | – | – |
| EV filed (`…/ev-filed`, multipart, all `bejelentes` items) | – | – | ✓ | ✓ |
| check of the EV PDF (`POST /team/registrations/:id/check`) | – | ✓ | – (never the one who filed: 403 "Négy szem elve: más nézze át.") | ✓ (not if he filed) |
| adószám (`…/registrations/:id/adoszam`) | ✓ (own app) | ✓ | ✓ | ✓ |
| cancel (`POST /client/assist/:id/cancel`) | ✓ | – | – | – |
| close (`…/close`, reason) | – | ✓ | ✓ | ✓ |
| full adóazonosító jel in `filingData` | – | – (masked) | ✓ (audited `assist.data_viewed`) | ✓ (audited) |
- The csapat never files anything at NAV and is never a meghatalmazott. The UJEGYKE and the EV bejelentés are filed **only by the client's accountant from his own ONYA / Ügyfélportál profile, with his own KAÜ login** (NAV UJEGYKE GYIK q.1–3; Segédlet 2025.03.11 pp. 8–10; Vállalkozói Ügysegéd útmutató 2026.03.19 pp. 7–8). Ügycsoportok: kind `vallalkozas_bejelentes` → "ADÓÜGYEK (kivéve egyes jövedéki ügyek)" + UJEGYKE-5 "Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)" (both are needed; neither covers the other); kind `meghatalmazas` → the jogi list `meghatalmazas.ugykorok` (today the same two). Jogcím: env `ASSIST_UJEGYKE_JOGCIM` = `9` (könyvelő, with his NGM number) [KÖNYVELŐ/JOGI: `60` is NAV's own recommendation for natural-person clients; `15` is not possible for Somosi Kft. with a subcontractor accountant, Szt. 151. § (1)].
- Team handbook text for the accountant (panel, collapsible "Így küldd be meghatalmazottként", B3, text only): 1) onya.nav.gov.hu, your own login, your own profile; 2) Új nyomtatvány → Meghatalmazások → UJEGYKE → Kiválaszt → szerep "Meghatalmazott"; 3) "Új bejelentés" (your data is prefilled as képviselő); 4) Képviselt: name + adóazonosító jel exactly as the NAV holds them (copy buttons from `filingData`); 5) jogcím, Kezdete: today, Vége: empty, the ügycsoportok above; 6) "Ellenőrzés és benyújtás" – the warning "J08 – A meghatalmazó jóváhagyása szükséges" is informational → "Tovább"; 7) "Sikeres benyújtás!"; 8) your Meghatalmazások list shows "VÉGLEGESÍTVE / Jóváhagyásra vár". For the EV: Ügyfélportál → Vállalkozói Ügysegéd → Képviseletválasztó "Más ügyében járok el" → the client → "Egyéni vállalkozás indítása" → the 6 pages exactly as the consent snapshot → "Bejelentés megtétele" → "Figyelem!" → "Sikeres bejelentés" → Bejelentéseim, kérelmeim → Megtekintés → Letöltés → upload here.

#### 27.3.5 Deadlines and reminders of the 4-day approval (B1 worker `assist_approvals`, every 15 min)
- NAV deletes an unapproved UJEGYKE 4 calendar days after the notice (UJEGYKE GYIK q.4, q.18). We store `approval_expires_at = ujegyke_filed_at + 4 × 24 h` and show **`approval_due_on` = Budapest date of filing + 3 days** (`ASSIST_RULES.shownApprovalDays`, one day of margin), text `{hatarido}` "november 22-ig" (the server builds the "-ig" form: numeral + "-ig", no period) / "Ma van az utolsó nap".
- Client: at filing `assist_mh_filed` (in-app, push, e-mail); +24 h if not approved `assist_mh_reminder` variant `elso`; on the due day at 09:00 variant `utolso_nap`; push only 8–20 h Budapest (else it waits for 8:00; in-app and e-mail go at once). Max 3 client messages per filing (`approval_reminders`). Quiet once the client tapped "Jóváhagytam".
- Staff: on the due day at 12:00, if not approved: `assist_approval_overdue` to the assignee (or every csapat member when unassigned) and the client's accountant ("Ma jár le a jóváhagyás: {clientName} – hívd fel."), once (`staff_alerted_at`).
- At `approval_expires_at + 2 h` (`expireGraceHours`) with no client tap and no verification: status `meghatalmazas_lejart`, `expired_count + 1`, client `assist_mh_expired`, accountant `assist_task` variant `ujra`. Re-filing starts a new window (no sanction; NAV: "a jóvá nem hagyott meghatalmazást a rendszer törölte").
- Our own targets (shown in the panel as "ma" / red "lejárt"): agreed → UJEGYKE within 1 working day; client approved → verified within 1 working day; consent → EV filed within 1 working day (`staffActionWorkdays`). Working days with `isWorkingDay`/`nextWorkingDay` of `@kezjegy/ado-motor` (B1 writes `addWorkingDays` in `backend/src/lib/munkanap.ts`).

#### 27.3.6 The approval guide (`GUIDE_KINDS` `meghatalmazas_jovahagyas`)
- Route `/bekotes/meghatalmazas/jovahagyas` (B2): one step per screen, 6 steps (`GUIDE_TEMPLATES.meghatalmazas_jovahagyas`), top banner with the due date (`Guide.approvalDue`), no video card (`video: null`), last step "Jóváhagytam" = `POST /client/assist/:id/approved`. `GET /client/guides/meghatalmazas_jovahagyas` (B1) → 409 `step_locked` unless an assist of the client is `meghatalmazas_bekuldve`, `_lejart` or `_jovahagyva`; placeholder `{jovahagyasHatarido}` filled with the due text, `{konyveloNev}` with the accountant's full name.
- Pictures (B4) in `utmutato_kepek/meghatalmazas_jovahagyas/` with their own `index.json`: `onya_belepes`, `onya_profil` = copies of `meghatalmazas/01_onya_nyitooldal`, `02_kau_belepes`, `03_onya_profil` (real); `onya_ertesites` = ONYA bemutató 2026.01.23 slide 11 (`D:/Atvitel/Temp/claude/C--Users-UpgradePC/87bd1012-c50f-48f0-975b-1b47560d5083/scratchpad/kinyert/onya_altalanos_bemutato/image11.png`) or `utmutato_kepek/_nyers/onya_bemutato_2026-01-23/dia10_meghatalmazasok_listaja.png`; `onya_jovahagyasra_var` = segédlet 2025.03.11 p.10 `kep_o10_01.png` (tile "VÉGLEGESÍTVE / Jóváhagyásra vár"; **blur the partly visible first name**); `onya_jovahagyas` = drawn "Illusztráció" (no official NAV-hosted image of the JÓVÁHAGYÁS button / pop-up exists; the third-party copy of ONYA doc v15.1 is NOT used) until the owner's or Bence's own blurred capture (§27.1.4); `app_jovahagytam` = none (own app). The segédlet p.9 images (`kep_o09_03` J08 warning, `kep_o09_04` "Sikeres benyújtás") are for the panel handbook only if B3 wants them (blurred), never for clients.

#### 27.3.7 Never-credentials (everywhere, same words)
`ASSIST_TEXTS.neverCredentials` on: the assist confirm sheet, the approval guide intro (second paragraph), the callback promise block (§26.2.2 `visszahivas.csalas` stays and is extended by B1 content: "…, és nem lépünk be helyetted."), the explainers `helyettunk_*`, the FAQ, ÁSZF and megbízási szerződés (§27.10), the panel handbook ("Soha ne kérd el és ne használd az ügyfél Ügyfélkapu+ / DÁP belépését, jelszavát, kódját; ne lépj be helyette, és ne irányítsd távolról a telefonját vagy gépét NAV-os ügyintézés közben." – the government DÁP notice calls this unlawful). **No API input, DB column, form field or log line ever holds a KAÜ username, password, PIN, TOTP or SMS code of a client** (acceptance K3.9 greps the code). If a client offers his password on the phone, the caller stops him and notes `jelszo_figyelmeztetes`.

#### 27.3.8 Without Ügyfélkapu+ / DÁP
The assisted path still needs the client's own login for the ONYA approval. The call checklist item `belepes_van` decides: if he has none, the caller explains (a) DÁP at home (explainer `ugyfelkapu_dap`), (b) a kormányablak, (c) for the EV only: one visit to a NAV ügyfélszolgálat with the printable personalised guide (the guide page's "Nyomtatható változat" link, B2, web only). The paper UJEGYKE route before registration (two witnesses) is NOT offered in the app; the team may agree it case by case after [JOGI]. The assist is then closed with reason `nincs_belepese` and a summary message to the client.

### 27.4 Order 4 – the new flow, screen by screen

#### 27.4.1 Rules for every onboarding screen (B2; checked in acceptance K4)
1. **One primary action** (one filled capsule) per screen. Secondary actions are text links or a light capsule (`gombMAlap`). The "Most ez jön" card is the only filled button on the Főoldal.
2. **Back / change**: every sub-screen has "Vissza" in the band; every multi-page task keeps the data on "Vissza"; every summary block has "Módosítom"; the branch answer, the mode (self / assisted), the meghatalmazás method (until submitted: "Másik módot választok"), the callback ("Módosítom" / "Mégsem kérem"), the chamber tick ("Mégsem csináltam meg") and the consent (by editing the questionnaire) can all be changed.
3. **One name per thing** (old names never appear in client copy):
| Thing | Name (everywhere) | Never |
|---|---|---|
| branch answer | "Vállalkozásod" (row 1) | – |
| Rólad / van form | "Adataid" | "Mondj magadról pár dolgot" as a title |
| our new-business questions | "Kérdőív a vállalkozásodról" (short: "kérdőív") | "adatlap", "adataidat" for it |
| filing at the NAV | "Bejelentés a NAV-nál" (verb: bejelenteni / beküldeni) | "Készítsd elő" as a button, "Jelentsd be a vállalkozásodat" as a step name |
| NAV's PDF | "NAV-os értesítés" | "NAV-os igazolás" (igazolás = certificates the accountant requests) |
| NAV site for the EV | "a NAV bejelentő oldala (Vállalkozói Ügysegéd)" on first mention, then "Vállalkozói Ügysegéd" | "NAV ÜPO", "Ügyfélportál" in client copy |
| ONYA | "ONYA (a NAV nyomtatványkitöltője)" on first mention | "UJEGYKE" in client copy (only in the guide row that shows NAV's label) |
| meghatalmazás | "NAV-meghatalmazás" | "Jelentsd be Bencét a NAV-nál", "Bence bejelenti magát" |
| ID step | "Igazolványok" | "Azonosítás" as a title |
| invoices | "Kiállított számlák" (§27.5) | "Számlák a NAV-tól", "NAV-számlák" |
| our team / accountant | "Csapatunk" / "{firstName}" | "ügyfélszolgálat" in client copy (panel only) |
4. **Plain words**: abbreviations are explained once inline (ÖVTJ = "a tevékenységek hivatalos listája"), internal codes never shown to clients (UJEGYKE, ÜPO, KAVIR only as link text with a plain label).
5. Field help link: "Hol találom?" only for explainers in `WHERE_TO_FIND_EXPLAINERS` (numbers printed on documents); every other question gets "Mi ez?" (round-2 walkthrough problem 16).
6. Readability as §26.6.1: body 17 pt / 1.5, targets ≥ 44 pt, contrast ≥ 4.5:1, works at 360×780 and 390×844, no horizontal scroll. Design: approved C2 + blue palette (`dizajn/PALETTA.md`, `C3_zold/kek.css`), Geist, realistic 3D icons only (`ICON3D` + `ICON3D_EXTRA`), the drawn avatar only for the accountant, object visuals from `assets/illusztraciok`.

#### 27.4.2 The journey (server-built, one source of every number) – B1 computes, B2 renders
`GET /client/onboarding` → `journey: JourneyView` built by `backend/src/services/journey.ts`:
- `variant` = `nincs` (business_status NULL) · `van` · `inditas_onallo` · `inditas_segitett` (registration `mode`). Rows = `JOURNEY_ORDER[variant]`, numbered 1…n; texts `JOURNEY_STEP_TEXTS[key]` (+ `…Segitett` variants); `actorLabel` from `JOURNEY_ACTOR_LABELS` (`konyvelo` → accountant's first name).
- Row → backing state: `ut` business_status · `visszahivas` the EV assist's callback (done when the assist left `visszahivas_kerve`) · `adatok` step `adatok` · `kerdoiv` registration `kitoltes` (done from `utmutato`) · `bejelentes` self: done when the registration is `beadva`+; actor te; `var` (actor csapat, waiting `tevekenyseg_sor`) while `activityPending`; assisted: actor konyvelo, done at `bejelentes_bekuldve` · `ertesites` (self) done when `beadva`+; when the team asks for a fix (`javitas`) this row becomes `most` again with statusText "Egy dolgot javítanod kell. Megírtuk, mit és hogyan." and action "Megnézem, mit javítsak" · `atnezes` (self, actor csapat) `var` while `beadva`; `ellenorizve` without adószám → actor nav, waiting `adoszam`; done at `kesz` · `vegso_jovahagyas` assist consent valid · `kamara` registration `chamber_done_at` (opens at `kesz`; `optional`) · `szerzodes`, `meghatalmazas`, `azonositas`, `elofizetes`, `nav_bekotes` their step rows (meghatalmazás via the assist when one exists).
- Row state: `kesz` (statusText "Kész, {date}") · `kesobb` (locked; `lockedReason` = the filled lock text of §26.1.6 + `LOCK_ELOFIZETES_SZERZODES_UTAN` "Előbb fogadd el a szerződést. Utána megadhatod a kártyádat." – the new server lock on BOTH paths, round-2 walkthrough problem 17) · `var` (actor ≠ te works; statusText "{actorLabel} dolgozik rajta") · client rows that can be done now: the **first** in order with a client deadline (approval, chamber) else the first in order = `most`, the others = `nyitva` ("Ezt is megcsinálhatod már") · `kihagyva`.
- `currentKey` = the `most` row. `waiting` = the first `var` row BEFORE `currentKey` (or the first `var` row when there is no `most`), with `WAITING_TEXTS[key]`, `escalateText` (`WAITING_ESCALATE_TEXT` with the escalation date of §27.4.3) and `meanwhile` (the first `nyitva` row).
- **`todoCount` = client rows (`clientPart`) not `kesz`/`kihagyva` + open accountant requests** (the branch question counts as 1 while unanswered). The same number is: the band ("Még {n} dolog kell tőled…"), the Főoldal tab badge, `OnboardingState.todoCount`, `ClientAccess.activationHint` and the locked sheet ("Még {remaining} lépés, és minden megnyílik. Ebből {n} a tiéd."). Locked client rows count (each completed thing lowers the number by exactly one) – round-2 owner finding 11 and walkthrough problem 8 close here. `remaining` = rows not `kesz`/`kihagyva`.
- `bandTitle`: path NULL → `bandStart`; `todoCount` = 1 → `bandTodoOne`; ≥ 2 → `bandTodo`; 0 → `bandNone` with the waiting actor ("Bence" / "Csapatunk" / "A NAV").
- The old `milestones` stay in the response (panel, old app builds) with the method-aware texts of round-2 owner finding 8 and the §27.5 wording; the app no longer renders them.

#### 27.4.3 The waiting card (one pattern for every wait)
White sheet, 3D `ora` 44 pt, kicker in small caps (`WAITING_TEXTS[key].kicker`, e.g. "MOST MI DOLGOZUNK" / "MOST BENCE DOLGOZIK" / "MOST A NAV DOLGOZIK"), title, body (what happens + typical time + "értesítünk"), then "Addig: {next row title}" with a light capsule button, then the escalation line "Ha {hatarido} nem történik semmi, kérj visszahívást." ("Ha november 21-ig …") with the link. When a client row is `most` at the same time, the wait is shown as a slim strip above the "Most ez jön" card: "Közben: {title} · {time}".
| Wait | Trigger | `WAITING_TEXTS` key | Escalation date (working days, Budapest) |
|---|---|---|---|
| ÖVTJ line | self, guide requested, `activityPending` | `tevekenyseg_sor` | `submitted_at` + 2 |
| our check of the NAV PDF | registration `beadva` | `atnezes` | `filed_at` + 2 |
| adószám | `ellenorizve` without adószám | `adoszam` | `checked_at` + 5 |
| meghatalmazás check (self) | step `meghatalmazas` `konyvelore_var`, method `onya_ugyfel`/`alairt_pdf` | `meghatalmazas_ellenorzes` | `submittedAt` + 3 |
| ID check | step `azonositas` `konyvelore_var` | `azonositas_ellenorzes` | + 2 |
| invoices connection | step `nav_bekotes` not done, meghatalmazás `kesz` | `nav_bekotes` | meghatalmazás done + 3 |
| assisted: call | assist `visszahivas_kerve` | `helyettunk_hivas` | callback `due_at` (48 h) |
| assisted: UJEGYKE | `egyeztetve` / `meghatalmazas_lejart` | `helyettunk_ujegyke` | `agreed_at` (or expiry) + 2 |
| assisted: verification | `meghatalmazas_jovahagyva` | `helyettunk_ellenorzes` | `client_approved_at` + 1 |
| assisted: EV filing | `ugyfel_engedelyezte` | `helyettunk_bekuldes` | `consent_at` + 2 |
| assisted: adószám | `bejelentes_bekuldve` | `helyettunk_adoszam` | `ev_filed_at` + 2 |

#### 27.4.4 Screens with their final copy (B2; texts = the shared constants named; B1 serves them as content)
**S1 Regisztráció** (`/regisztracio`): one new line under "Egyéni vállalkozóknak, havi 19 999 Ft": `JOURNEY_TEXTS.signupNewBusiness` "Még nincs vállalkozásod? Segítünk elindítani – addig nem fizetsz." (policy `azonnal` → `signupNewBusinessAzonnal`). The price comes from `brand.json` (round-2 language finding 11.6).

**S2 Főoldal, branch unanswered** (`/bekotes`, variant `nincs`): band `bandStart` "Kezdjük egy kérdéssel." + accountant card + "Kérj visszahívást" capsule · video card (§26.7.3) · card "Van már egyéni vállalkozásod?" (`Mi ez?` → `vallalkozas_van_e`) with two answers: "Igen, van" – "Már van adószámom." / "Még nincs, most indítanám" – "Segítünk elindítani." · then "Utána ezek jönnek" (`previewTitle`) – the six preview titles greyed, one line "Előbb válaszolj fent." (`previewLocked`), **no** "Most ez jön · Adataid – Kitöltöm" card, no "Most te jössz" rows (walkthrough problem 3) · callback card. Tab badge 1.

**S3 "Hogyan jelentsük be a vállalkozásodat?"** (bottom sheet right after "Még nincs, most indítanám"; `START_MODE_TEXTS`): sub "Bármelyiket választod, később módosíthatod." Card 1 "Magam jelentem be" – "Lépésről lépésre megmutatjuk, mit hova jelölj a NAV oldalán. Kb. 10–15 perc. Ügyfélkapu+ vagy DÁP kell hozzá." [Ezt választom]. Card 2 highlighted (badge "Ha nem boldogulsz vele") "Intézzétek helyettem" – "Felhívunk, és {firstName} meghatalmazottként bejelenti a vállalkozásodat. Neked csak jóvá kell hagynod. Ehhez is kell Ügyfélkapu+ vagy DÁP." [Ezt kérem] → S15. Closing the sheet without a choice = self-service.

**S4 Főoldal, journey** (`/bekotes`, any variant except `nincs`): band `bandTitle` + accountant card + "Kérj visszahívást" · open callback / assist status strip (one line, `statusText`, tap → details) · **"Most ez jön"** card: kicker "MOST EZ JÖN · {n}. lépés", 3D icon of the row's explainer, title = row title, one line (time / due), primary button = `action.label`, "Mi ez?"; under it the highlighted assist line when the row is `bejelentes` (self) or `meghatalmazas` · or the waiting card (§27.4.3) · **"Így halad a bekötésed"** (`listTitle`, sub `listSub`): "✓ {n} lépés kész · Mutasd" (collapsed done rows), then every other row: number circle (brand blue for `most`, outlined for others, ✓ violet `kesz` stamp style for done), title, actor chip, status line, time, "Mi ez?"; row 1 always shows "Vállalkozásod · {answer} · Módosítom" · video row (collapsed after viewing) · callback card "Elakadtál? Kérj visszahívást." The tab badge = `todoCount`. Tapping a row opens its route (locked rows open a sheet with `lockedReason`). Removed: "A lépések", "Hol tartunk", any second number.

**S5 Change sheet** (`PATH_CHANGE_TEXTS`): title "Módosítod a válaszodat?" · body `pathChange.confirmText` · primary "Igen, már van vállalkozásom" / "Igen, még nincs vállalkozásom" · link "Mégse". Blocked: body "Ezt itt már nem tudod módosítani. {reason} Kérj visszahívást, és segítünk." · primary "Kérem a visszahívást". After the change: back to S4 (or S3 for `→ inditas`), toast + "Visszavonom".

**S6 Adataid – van** (`/bekotes/adatok`, 3 pages, unchanged except): page 1 phone **required** on both paths (round-2 walkthrough problem 25: the callback is the main help) with "Mi ez?" (not "Hol találom?"); page 2 under the adószám field the link "Még nincs adószámom – most indítanám" → S5; page 3 "Eddigi könyvelőd" + the card "Könyvelőt váltasz?" (explainer `konyvelovaltas`, [KÖNYVELŐ]); every "Hol találom?" on a question that is not a document number becomes "Mi ez?".

**S7 Adataid – Rólad** (`/bekotes/adatok?utana=vallalkozas`): header link "Rossz gombot nyomtam: már van vállalkozásom" → S5; fields unchanged; button "Mentem, tovább" → next row of the journey (kérdőív).

**S8 Vállalkozás bejelentése – hub** (`/bekotes/vallalkozas`): band title "Vállalkozás bejelentése" + `statusText` (no more "Még nem küldted el az adataidat" right after Rólad: `kitoltes` text is "Még nem töltötted ki a kérdőívet. Ott folytathatod, ahol abbahagytad.") · one current card (kérdőív / útmutató / feltöltés / javítás / adószám / kamara) · the EV assist card (mode `onallo`, nothing filed) or the assist status card (mode `segitett`) · "Készítsd elő" collapsed: `HUB_TEXTS.prepareSummary` + "Mutasd mind" (8 rows as today, labels with "anyukád") · "Elakadtál? Kérj visszahívást" · at the very bottom the text link "Mégsem most?" → sheet "Mégsem most indítod?" with three rows: "Mégis van vállalkozásom" (= S5), "Később indítom", "Meggondoltam magam" (withdraw reasons). The red "Leállítom a bejelentést" button is gone.

**S9 Kérdőív a vállalkozásodról** (`/bekotes/vallalkozas/adatlap`, 5 pages, title `KERDOIV_TEXTS.title`, progress "2/5"): gate without Rólad = "Előbb pár adat rólad" + **"Mégis van vállalkozásom"** link; page 1: no 10-line paragraph – two checkboxes "Rám nem vonatkozik egyik kizáró ok sem" (with "Mi ez?" → `kizaro_okok`) and "Nincs másik élő egyéni vállalkozásom", link "Mégis van vállalkozásom", the revenue band; page 5 summary adds the prorated limits `afaLimitLine` ("Ha {startText} indulsz, idén {afaLimit} Ft bevételig lehetsz ÁFA-mentes (a 20 millió forint időarányos része).") from `hints.afaLimitHuf` and the átalány cap line (round-2 tax finding 5); when the main activity `kepesitesKellhet`, the contribution hint shows both numbers (minimálbér and garantált bérminimum, round-2 tax finding 7). Last button: self "Kérem az útmutatót"; assisted "Kész, elküldöm".

**S10 Útmutató – one step per screen** (`/bekotes/vallalkozas/utmutato?lepes=N`, same for the meghatalmazás guide inside S14 and the approval guide S16): band "Így jelentsd be a vállalkozásodat" + progress "{i}/{n}. lépés" bar · step 0 = intro + video card + the drawn-picture note (§27.1.2) + "Készítsd elő" collapsed · each step: NAV screen title (e.g. "Személyi adatok (1/6)"), text, field rows (✓ Jelöld be / × Ne jelöld be …, copy buttons), amber warning, the picture with the honest label, primary **"Megvan, tovább"** (= progress tick + next), link "Vissza", link "Elakadtál? Kérj visszahívást", link "Nem boldogulsz vele? Intézzük helyetted" (EV guide) · "Mutasd egyben" opens today's long page (kept). **While `activityPending`**: the amber `ACTIVITY_PENDING_BANNER` on step 0; the NAV link buttons of steps 1–2 are replaced by the line `HUB_TEXTS.guideHoldNavButton` ("Előbb megírjuk a tevékenységed sorát – értesítünk."); steps with `hold` show the hold box instead of "Megvan, tovább" (walkthrough problem 9). The last guide step's button: "Feltöltöm az értesítést" → S11.

**S11 NAV-os értesítés feltöltése** (`/bekotes/vallalkozas/feltoltes`): title "Töltsd fel a NAV-os értesítést" · explainer `nav_igazolas_pdf` inline · file / photo · "Mikor küldted be?" · "Hogyan?" (`CLIENT_FILING_CHANNELS` only) · **"Adószám (az értesítésen találod)"** (encouraged, still optional) + nyilvántartási szám · primary "Feltöltöm" → toast "Megkaptuk. Átnézzük, általában 1 munkanapon belül." → S4 with waiting `atnezes`.

**S12 Kamarai regisztráció** (`/bekotes/vallalkozas/kamara`, row `kamara` after the registration is `kesz`; `KAMARA_TEXTS`): title "Regisztrálj a kamaránál" · "{hatarido} (5 munkanap). Kb. 10 perc a kamara oldalán." · body · primary "Megnyitom a kamara oldalát" (external) · light capsule "Megcsináltam" (`POST /client/business-registration/chamber {done:true}`; toast "Köszönjük! Kipipáltuk." + "Mégsem csináltam meg") · after the date: `overdue`. Not required for activation; counts in `todoCount` while open; reminders §27.8 (walkthrough problem 11).

**S13 Szerződés**: unchanged (three documents, three ticks, "Elfogadom"). Before it is accepted, Előfizetés is locked on both paths.

**S14 NAV-meghatalmazás** (`/bekotes/meghatalmazas`): band "NAV-meghatalmazás" + "Így {firstName} intézheti helyetted az adóügyeidet a NAV-nál." · **choice at the top** (both visible without scrolling at 390×844): highlighted card "Megcsináljuk helyetted a meghatalmazást" (`mhCardBody`, [Ezt kérem] → S15 kind `meghatalmazas`) and card "Magam adom meg" – "Kb. 5 perc az ONYA-ban, képekkel és videóval segítünk." [Ezt választom] → the self-service guide one step per screen (S10 pattern) ending with "Beküldtem" · the band text follows the choice (walkthrough problem 5): self "Így add meg a NAV-meghatalmazást – kb. 5 perc", assisted the assist status · the misleading "Ha nem tudsz belépni az ONYA-ba" line is removed; `alairt_pdf` stays a hidden option the accountant enables · in every state (also waiting and done) "Elakadtál? Kérj visszahívást" (round-2 owner finding 10).

**S15 Intézzük helyetted – így megy** (`/helyettunk?fajta=…`): §27.3.2.

**S16 Jóváhagyás** (Főoldal card when the assist is `meghatalmazas_bekuldve`): kicker "MOST EZ JÖN · {n}. lépés", title "Hagyd jóvá a meghatalmazást a NAV-nál", line "{hatarido} (még {days} nap). Kb. 3 perc az ONYA-ban." (last day: "Ma van az utolsó nap: hagyd jóvá ma." in amber) · primary "Megnyitom az útmutatót" → `/bekotes/meghatalmazas/jovahagyas` (6 steps) · light capsule "Jóváhagytam" · after the tap: toast `approvedToast`, waiting `helyettunk_ellenorzes`. Expired: `expiredTitle` / `expiredBody`.

**S17 Nézd át, mit jelentünk be** (`/bekotes/vallalkozas/engedely`): §27.3.3 item 3; after "Engedélyezem a bejelentést": toast `consentToast`, waiting `helyettunk_bekuldes`; after filing: card `filedTitle` / `filedBody` + "Megnézem az értesítést" (opens the `ev_bejelentes` document, allowed before activation by §26.5.2 `keres_valasz`).

**S18 Igazolványok** (`/bekotes/azonositas`): field labels "Születési neved", **"Anyukád születési neve"**, "Az igazolvány száma", "Érvényes eddig", each with "Hol találom?" (new explainers `szuletesi_nev`, `anyja_szuletesi_neve`, `okmany_szama`, `okmany_ervenyesseg`; round-2 owner finding 9); error "Írd be anyukád születési nevét."; "Elakadtál? Kérj visszahívást" in every state.

**S19 Előfizetés**: unchanged copy; locked until the contract (both paths) and, on `inditas`, until the adószám (§26.1.7). The result screen never shows "Sikeres" from URL parameters (round-2 security finding 14).

**S20 Waiting cards**: §27.4.3. **S21 Visszahívás form**: topic preselected from `journey.currentKey` (`ut|adatok|szerzodes|nav_bekotes → bekotes`, `kerdoiv|bejelentes|ertesites|atnezes|vegso_jovahagyas|kamara → vallalkozas_inditas`, `meghatalmazas → meghatalmazas`, `azonositas → azonositas`, `elofizetes → elofizetes`), the two assisted topics in the chip list (walkthrough problem 18). **S22 Fiók** during onboarding: row "Vállalkozásod · {answer}" → S5; "Ajánld ismerősnek", "Díjszámlák", "Határidők" hidden until activation (walkthrough problem 20). **S23 Üzenetek**: the tab bar stays visible; before activation the four request chips are replaced by one chip "Kérdésed van a bekötésről?" (walkthrough problem 20). **S24 Locked sheet**: `journey.lockedSheetText`. **S25 Activation**: one-time card `JOURNEY_TEXTS.activeTitle` / `activeBody` on the first active Főoldal.

#### 27.4.5 Before → after (estimates from the 11-19 walkthrough `_munka/k5/flow_jelenlegi.md`; B2 re-counts on the harness, acceptance K4.5)
| Measure | Before (11-19) | After (§27) |
|---|---|---|
| Progress lists on the Főoldal | 2 (7–8 step rows + 5–6 milestones, different names and order) | 1 ("Így halad a bekötésed") |
| Numbers for "what is left" | 3 that disagree (band 4, badge 5, locked sheet "4 / 2") | 1 (`journey.todoCount`) |
| "Most te jössz" rows at the same time | up to 4 + a competing "Kitöltöm" card before the branch answer | 1 current card; the others say "Ezt is megcsinálhatod már" |
| New business, self – in-app taps (sign-up → only "számlák bekötése" left) | ≈ 78 | ≈ 83 (+1 mode question, +2 chamber, guide "Megvan, tovább" per step) |
| … phone screens to scroll on the longest pages | guide ≈ 22, meghatalmazás ≈ 13, hub ≈ 3 | ≤ 1.5 per step screen; hub ≤ 2 |
| … waits with no time given | 3 of 6 | 0 of 6 (every wait: who, how long, until when, then callback) |
| New business, assisted – client's own work | not possible (only a generic callback) | ≈ 62 in-app taps + ≈ 6 taps in ONYA (approval) instead of 14 Ügysegéd screens + an 8-step UJEGYKE form |
| Existing business – meghatalmazás | ≈ 16 ONYA actions | assisted: 1 tap "Ezt kérem" + callback form + ≈ 6 ONYA taps |
| Change "van → inditas" | impossible in the app | 2 taps (row 1 "Módosítom" → "Igen") |
| Change "inditas → van" | 5–7 taps via hidden links, only after giving personal data | 2 taps, from 6 places |
| Kamarai regisztráció | small print only | a row with a date, reminder and tick |

### 27.5 Order 5 – one wording for the client's issued invoices

#### 27.5.1 What it means (the fact every text must keep)
Every invoice the client ISSUES to his customers with any invoicing program (Számlázz.hu, Billingo, a webshop plugin, …) is reported to the NAV Online Számla system automatically. After the NAV connection we **download** them from there, so he never uploads his issued invoices; they are his revenue, the tax is computed from them. Not included: sales without an invoice (nyugta, pénztárgép, cash without invoice) – he records those separately (Fotózás / feltöltés). Incoming cost invoices are not needed for átalányadó (flat 45 / 80 / 90 % cost ratio).

#### 27.5.2 Glossary (`INVOICE_WORDING`; content keys `szamlak.<key>`)
| Use | Write | Never write |
|---|---|---|
| section / tab / step name | **"Kiállított számlák"** (step: "Kiállított számlák bekötése", milestone "Kiállított számlák bekötve") | "Számlák a NAV-tól", "NAV-számlák", "A NAV-tól kaptuk", "A NAV-tól jött" |
| the one short sentence | **"A kiállított számláid maguktól megjelennek itt – nem kell feltöltened őket."** | "a számláid maguktól megjönnek / megérkeznek a NAV-tól", "a NAV-tól jönnek, minden reggel" |
| the one-time "Mi ez?" | **"Minden számla, amit a számlázóprogramodban kiállítasz, automatikusan bekerül a NAV rendszerébe. Mi onnan töltjük le. Ami nincs benne: a számla nélküli eladás (pl. nyugta) – azt külön jelezd."** (explainer `kiallitott_szamlak`) | "a NAV küldi", "NAV-os számlák" |
| verb for what we do | "letöltjük (a NAV rendszeréből)" | "lekérjük a NAV-tól", "jön a NAV-tól" |
| status of one invoice | "Letöltöttük" (`NAV_ITEM_STATUS_LABELS.feltoltve`) | "Megérkezett" |
| month summary | "{n} kiállított számla" ("2 irat és 4 kiállított számla, mind rendben") | "4 számla a NAV-tól" |
| list sub-line | "{n} számla, összesen {sum} Ft. Naponta letöltjük őket a NAV rendszeréből." / empty: "Ebben a hónapban még nincs kiállított számlád, vagy még nem töltöttük le." | "Ebben a hónapban még nem jött számla a NAV-tól." |
| upload hint | `INVOICE_WORDING.uploadHint` | "azok maguktól jönnek a NAV-tól" |
| panel (accountant / team) | "Kiállított számlák" tab, sub `staffSub`; "A NAV Online Számlából naponta letöltve"; `staffNoUpload` | "NAV-számlák", "A NAV-tól jött", "A NAV-ból jövő számlákat" |
| legal drafts | "a kiállított számláid adatai, amelyeket a NAV Online Számla rendszeréből töltünk le" | "a NAV-tól lehívott számláid" |
Unchanged and correct: "Levél a NAV-tól" (real letters), "igazolást kérünk a NAV-tól" (certificates), "NAV Online Számla" as the system's name in legal texts and the panel.

#### 27.5.3 Every place that changes (owner of the change)
- **shared (done)**: `enums.ts` `CLIENT_FEATURE_RULES.dosszie.reason`, `.nav_szamlak` label + reason, `ONBOARDING_STEP_LABELS.nav_bekotes`, `MILESTONE_LABELS.szamlak_bekotve`, `NAV_ITEM_STATUS_LABELS`; `bekotes.ts` explainers `nav_bekotes`, `adoszam`, new `kiallitott_szamlak`, `INVOICE_WORDING`.
- **B1 backend**: `services/documents.ts:276-280` month summary ("{n} kiállított számla"); `services/onboarding.ts:229-230, 256` milestone texts; `content/defaults.hu.json` + `content/tulaj1118.ts` + new `content/tulaj1119.ts` (every default with the old wording; e-mail and notification bodies); `services/datastep.ts` FAQ texts; the data step `data.tulaj1119` (§27.7.3) updates live `content_texts` overrides and `faq_items` that still hold an old default word for word; `routes/acc.ts:127` `számláid→számlái` replacement stays valid; `test/*` expectations.
- **B2 app**: `src/app/dosszie/index.tsx:2,40,136,188-192` (header row = `short` + "Mi ez?" → `kiallitott_szamlak`; section "Kiállított számlák"; summary), `src/app/dosszie/[honap]/szamlak.tsx:25-48`, `src/app/feltoltes.tsx:129` (`uploadHint`), `src/ui/Zarolt.tsx:25` (`nav_szamlak: 'Kiállított számlák'`), `src/kepernyok/FeltoltesLap.tsx` (only if it mentions invoices; "Levél a NAV-tól" stays), `src/api/minta/adatok.ts:418,443`, `src/api/minta/szerver.ts:302-303` (MINTA FAQ "Honnan jönnek a számláim?" → "Miért nem kell feltöltenem a kiállított számláimat?" + the `miEz` text), the active Főoldal line under the hero.
- **B3 panel**: `pages/acc/UgyfelAdatlap.tsx:30` tab "NAV-számlák" → "Kiállított számlák"; `pages/acc/ugyfel/NavSzamlak.tsx:29` ("…a kiállított számlái naponta, maguktól töltődnek le a NAV Online Számlából"), `:51/:149` keep "demó NAV" only as a DEMO marker; `pages/acc/ugyfel/Dosszie.tsx:52,136,164` ("Kiállított számlák" / `staffNoUpload` / "Ebben a hónapban nincs letöltött kiállított számla."); `pages/acc/ugyfel/Bevetelek.tsx:47,184` ("Kiállított számlák" / "A kiállított számlákat nem kell felvenned: azokat a NAV Online Számlából töltjük le."); `pages/acc/ugyfel/Ado.tsx:209` ("a kiállított számlákból"); `lib/labels.ts:285`; `mock/data.ts:740` (FAQ answer), `README.md:35`.
- **B4 content**: `jogi/app_szovegek.json:16` + `app_szovegek.md:17` ("A kiállított számláidat a NAV rendszeréből mi töltjük le, neked csak a nyugtákat és a kivonatot kell feltöltened."), `app_szovegek.json:109` + `.md:199` (FAQ "Mennyibe kerül…" last sentence → "A kiállított számláidat a NAV rendszeréből mi töltjük le."), `jogi/aszf.md:133` ("a NAV Online Számla rendszeréből letöltött kiállított számláid"), `adatkezeles.md:60,68,154`, `nav_meghatalmazas.md:9,83`, `megbizasi_szerzodes.md:23,54` (check), regenerate `pdf_minta/`; videos: `kod/media/bekotes.vtt:28` + `video/bekotes/remotion/src/adat.json:170`, `Bekotes.tsx:170,481-483` ("A kiállított számláid maguktól megjelennek az alkalmazásban." – re-voice ONE line, captions + burned-in title "Kiállított számlák" / "Maguktól megjelennek"), guide images: none.

#### 27.5.4 QA (all builders before handing over)
Run every client- or team-facing text through `INVOICE_WORDING_FORBIDDEN_PATTERNS` (`new RegExp(p, 'iu')`): `kod/app/src`, `kod/panel/src`, `kod/backend/src/content`, `kod/backend/src/notify`, `kod/backend/src/services`, `kod/jogi/*.md|*.json`, `kod/media/*.vtt`, and (integrator, live, via the admin API) `content_texts` + `faq_items` → 0 hits. Comments and test fixtures that quote the forbidden form on purpose are excluded by a `// szándékos` marker.

### 27.6 Panel (B3) – team, accountant, admin

#### 27.6.1 Navigation (3D icons 28 pt)
| Role | Change |
|---|---|
| `csapat` | new item **"Intézzük helyette"** (`igazolas`, badge = `TeamSummary.assists.waitingOnMe + approvalOverdue`) between Visszahívások and Vállalkozás-indítás |
| `accountant` | the same item, only when he has (had) an assist; badge = items whose ball is `konyvelo` for his clients ("Neked") |
| `admin` | the same item + the dashboard tile |

#### 27.6.2 `/helyettunk` – queue
Filter chips with counts: **Nyitott** (default) · **Nálam** (ball on my role; accountant: his clients with ball `konyvelo`) · Ügyfélre vár · Lejárt jóváhagyás · Kész · Mind; kind select (Vállalkozás bejelentése / NAV-meghatalmazás); search. Sort: overdue `nextDue` first, then `nextDue` ascending. Table on a white sheet: Ügyfél (+ "Bekötés alatt") · Mit (`ASSIST_KIND_LABELS`) · Állapot (`ASSIST_STATUS_LABELS`) · **Kinél a labda** (Csapat / {accountant first name} / Ügyfél) · **Következő határidő** (`nextDue.what` + countdown "még 2 nap" / "ma" / red "lejárt 3 órája"; approval: "Jóváhagyás: nov. 22.") · Napja (days in status) · Kié (assignee first name).

#### 27.6.3 `/helyettunk/:id` – detail (three columns ≥ 1280 px, stacked below)
1. **Ügyfél és adatok** – `TeamClientCard` (with path history), the client's questionnaire answers read-only (link "Szerkesztés a Vállalkozás-indításban" for csapat/admin), **"Adatok a beküldéshez"** (`filingData`): name, adóazonosító jel (accountant/admin: "Mutasd" → full value, audited `assist.data_viewed`; csapat: masked only), jogcím (`ASSIST_JOGCIM_LABELS`), ügycsoportok – each with the `masolas` 3D copy button; for EV the **consent snapshot** (blocks, time, version) and a red line "A kérdőív változott az engedély óta – új engedély kell." when `answersMatchConsent === false`.
2. **Lépések** – one block per phase of the kind (`ASSIST_PHASES`; kind `meghatalmazas` hides the items `ASSIST_CHECK_NOT_FOR_MH`) (`checklist`), each item a checkbox (autosave via `PATCH … {check}`; ticks show who/when) and the phase action button, enabled only when every item of the phase is ticked and `allowedActions` contains it: **"Egyeztettünk – elindítom"** (`agreed`, phase `hivas`), **"Beküldtem az UJEGYKE-t"** (`ujegyke-filed`, phase `ujegyke`, jogcím select default env) – accountant/admin only, **"Lejárt – újra kell küldeni"** (`expired`), **"Él a meghatalmazás"** (`mh-live`), **"Beküldtem a bejelentést"** (`ev-filed`, phase `bejelentes`, file picker for the NAV értesítés PDF/image + "Beküldés napja" + optional adószám / nyilvántartási szám). Disabled buttons say why ("Előbb az ügyfélnek el kell fogadnia a szerződést.", "Az ügyfél még nem engedélyezte a bejelentést.", "A kérdőív változott az engedély óta.", "Ezt csak {accountant first name} küldheti be, a saját belépésével."). Collapsible **"Így küldd be meghatalmazottként"** handbook (§27.3.4) and the never-credentials rule (§27.3.7) at the top of this column, always visible.
3. **Idővonal** – `timeline` (newest first), staff note (autosave), "Visszahívás megnyitása" (`/visszahivasok?nyit=<callbackId>`), "Üzenet" (team thread), **"Lezárom"** (reason select `ASSIST_CLOSE_REASON_LABELS` + note).
After `ev-filed` the page links to `/vallalkozas-inditas/:registrationId` where the csapat does the four-eyes check and records the adószám (§26.3.3; the accountant who filed is refused).

#### 27.6.4 Changes in existing pages
- `/visszahivasok` drawer: callbacks with topic `…_helyettem` show the banner "Intézzük helyette: {kind}"; after the outcome "Beszéltünk" the drawer shows the `hivas` checklist and **"Egyeztettünk – elindítom"** (calls `agreed`) next to "Később"; other topics get the link "Kéri, hogy intézzük helyette?" → `POST /team/clients/:id/assists {kind}`.
- `/vallalkozas-inditas` board/table: chip "Intézzük helyette" on `mode 'segitett'` cards with the assist status; filter chip "Intézzük helyette"; cards of registrations left by a path change say "Útvonalat váltott – már van vállalkozása" (`pathChangedAt`).
- Client page (accountant/admin): Bekötés tab shows the journey rows (accountant wording via milestones as today) + "Útvonal" history + the assist card with link; client card button "Útvonal módosítása" for csapat/admin (§27.2.3).
- Admin dashboard: tile "Intézzük helyette" (`AdminServiceStats.assists`: open, done this month, expired approvals in 30 days, median days to done). Admin client page: **"Fiók letiltása" / "Engedélyezése"** (round-2 security finding 9; reason required; confirm dialog).
- Wording (§27.5.3 B3 list), "Köztartozásmentességi igazolás" as the one form of that certificate's name (round-2 language finding 12), `Beallitasok.tsx:234` session label from `brand.json` (owner finding 4), 2FA secret in Geist with tabular figures (owner finding 7), `CALLBACK_SOURCE_LABEL` + topic labels for the new values, `/admin/szovegek` groups for the new content keys (§27.9.2).
- Mock (`npm run dev:mock`): the three demo assists of §27.7.4 and the role views (`?mock_role=csapat|accountant|admin`).
- §26.4 matrix addition (B1 enforces, B3 relies on it): csapat may read the client card, the callbacks, the registration and the assist of any client with an open assist or one closed in the last 90 days; the accountant only his own clients' assists; nobody else's assist is visible (404).

### 27.7 Data model and migrations (B1; additive only)

#### 27.7.1 Migration files (`kod/backend/drizzle/`)
1. **`0010_tulaj1119_enumok.sql`** – only `ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS` for the 10 kinds of §27.8 (the order of `NOTIFICATION_KINDS`). Nothing else; no later migration of the run uses them (§26.9.1 rule).
2. **`0011_tulaj1119.sql`**:
   - `clients.business_status_changed_at timestamptz null`.
   - `business_registrations.mode text not null default 'onallo' check (mode in ('onallo','segitett'))`, `chamber_due_on date null`, `chamber_done_at timestamptz null`, `chamber_reminders smallint not null default 0`.
   - Widen CHECK constraints (drop + re-add with the old values plus the new ones; existing rows stay valid): `business_registrations.filed_channel` + `meghatalmazott`; `callback_requests.topic` + `vallalkozas_bejelentes_helyettem`, `meghatalmazas_helyettem`; `callback_requests.source` + `helyettunk_vallalkozas`, `helyettunk_meghatalmazas`, `utvaltas`.
   - **`assist_requests`** — `id uuid pk`, `client_id uuid not null references clients`, `kind text not null` (CHECK `ASSIST_KINDS`), `status text not null default 'visszahivas_kerve'` (CHECK `ASSIST_STATUSES`), `status_changed_at timestamptz not null default now()`, `callback_id uuid null references callback_requests`, `registration_id uuid null references business_registrations`, `assigned_user_id uuid null references users`, `created_by_role text not null` ('client','csapat','admin','accountant','system'), `created_by_user_id uuid null`, `agreed_at`, `agreed_by uuid null references users`, `ujegyke_filed_at`, `ujegyke_filed_by uuid null references users`, `ujegyke_jogcim text null` (CHECK '9','60'), `approval_due_on date null`, `approval_expires_at timestamptz null`, `approval_reminders smallint not null default 0`, `last_reminder_at`, `staff_alerted_at`, `expired_count smallint not null default 0`, `client_approved_at`, `mh_live_at`, `mh_verified_by uuid null references users`, `consent_at`, `consent_hash text`, `consent_version text`, `consent_snapshot jsonb`, `consent_ip text`, `consent_user_agent text`, `consent_valid bool not null default false`, `consent_document_id uuid null references documents`, `ev_filed_at`, `ev_filed_by uuid null references users`, `checklist jsonb not null default '{}'` (`{ "<item>": { "at": ISO, "by": userId } }`), `staff_note text`, `closed_at`, `closed_by uuid null references users`, `closed_reason text null` (CHECK `ASSIST_CLOSE_REASONS`), `close_note text`, `created_at`, `updated_at`. Indexes: unique (`client_id`, `kind`) WHERE status IN the open statuses; (`status`, `status_changed_at`); (`assigned_user_id`, `status`); (`approval_expires_at`) WHERE status = 'meghatalmazas_bekuldve'.
   - Grants for `kezjegy_app` like the other tables (`deploy/db-roles.sh` pattern).
3. Drizzle schema mirrors it; journal/snapshots with drizzle-kit (no hand-edited journal).
4. Before the deploy the integrator takes `pg_dump` into `/srv/kezjegy/_regi/` (encrypted like `up.sh` does) and snapshots `alex@` / `tulaj@` (`deploy/tulaj-fiokok-allapot.sh`); after it the snapshot must be identical (only new rows elsewhere).

#### 27.7.2 Rename / deprecation
Nothing is renamed or dropped. `withdraw_reason` values unchanged. The milestone API stays. `REGISTRATION_STEP_STATUS` unchanged.

#### 27.7.3 One-time data step `system_state['data.tulaj1119']` (worker start, idempotent, never touches `onboarding_steps`, `users`, consents, subscriptions)
1. **Legacy assisted meghatalmazás → assist rows.** For every client whose step `meghatalmazas` has `data.method = 'onya_konyvelo'` and status `konyvelore_var` or `ugyfelre_var` and no open assist of kind `meghatalmazas`: insert an assist (`created_by_role 'system'`, no callback): `konyvelore_var` without `clientApprovedAt` → `egyeztetve` (`agreed_at` = `submittedAt`); `ugyfelre_var` → `meghatalmazas_bekuldve` with `ujegyke_filed_at` = the step's `updated_at`, due/expiry computed (already expired → `meghatalmazas_lejart`, no client notification from the data step); with `clientApprovedAt` → `meghatalmazas_jovahagyva`. The owner's accounts are handled like any other (a new row, their step rows unchanged).
2. **FAQ**: for every item of `kod/jogi/app_szovegek.json` `gyik` that carries `elozo_kerdes` / `elozo_valasz` (B4 adds them to the changed items), update the live `faq_items` row only if its question AND answer are still exactly those old texts; insert items whose question does not exist yet; never touch an admin-edited row (log it instead).
3. **Content overrides**: for every content key whose default changed in §27 (list `backend/src/content/tulaj1119_regi.ts` = key → old default text, B1 builds it from `kod/_regi/shared_src_elotte_tulaj1119/` and the old content files), update a `content_texts` row only if it equals the old default word for word.
4. Nothing else. Re-running is a no-op.

#### 27.7.4 Demo data addition `seed:tulaj1119` (live DB and local harness, idempotent, refuses `APP_ENV=production`, never touches existing rows; passwords only appended to `/srv/kezjegy/demo_belepesek.txt`, never printed; same rules as §26.13)
1. **Kiss Marika** (`marika.kiss@demo.kezjegy.test`, login, accountant Bence, `bekotes_alatt`, `business_status 'inditas'`, registration `utmutato` `mode 'segitett'`, activities "Takarítás" (main, no ÖVTJ code yet → `activityPending`), seat `lakcim` "3530 Miskolc, Próba utca 12." (fictional), `workKind 'fofoglalkozas'`; steps `fiok`/`adatok`/`szerzodes` `kesz`; callback `teljesitve` (yesterday, Anna, summary "Megbeszéltük: Bence beküldi a meghatalmazást, te jóváhagyod az ONYA-ban."); assist `vallalkozas_bejelentes` `meghatalmazas_bekuldve`, filed 1 day ago (due in 2 days), `hivas` + `ujegyke` checklists ticked) → line `ugyfel;marika.kiss@…;<pw>` → harness `?ki=marika`.
2. **Molnár Dávid** (`david.molnar@demo.kezjegy.test`, login, `van`, profile complete with a formally valid fake adószám, previous accountant "Minta Könyvelő Kft.", `szerzodes` `kesz`; assist `meghatalmazas` `egyeztetve` (ball on Bence)) → `?ki=david`.
3. **Balogh Ilona** (`ilona.balogh@demo.kezjegy.test`, no login): `inditas`, assist `vallalkozas_bejelentes` `visszahivas_kerve` + callback `uj` topic `vallalkozas_bejelentes_helyettem`, source `helyettunk_vallalkozas`, note "Nem értek a számítógéphez, intézzék helyettem."
4. In-app notifications as the code would create them. `kod/deploy/seed-tulaj1119.sh` (B1) mirrors `seed-tulaj1118.sh`; `kod/app/scripts/helyi-proba.mjs` (B2) calls `seedTulaj1119` after `seedTulaj1118` when present.

### 27.8 Notifications and jobs (B1; texts = `content_texts` defaults `notif.<kind>.title|body`, `email.<kind>.subject|body`; push never contains amounts, phone numbers or tax ids)
| Kind | To | In-app | Push | E-mail | Title | Body |
|---|---|---|---|---|---|---|
| `assist_started` | client | ✓ | ✓ | ✓ | "Beszéltünk – így haladunk" | "{firstName} hamarosan beküldi a meghatalmazást. Utána értesítést kapsz, és 4 napod lesz jóváhagyni." |
| `assist_mh_filed` | client | ✓ | ✓ | ✓ | "Hagyd jóvá a meghatalmazást {hatarido}" | "{firstName} beküldte a NAV-nak. Lépj be az ONYA-ba, és hagyd jóvá. Kb. 3 perc, megmutatjuk, hogyan." |
| `assist_mh_reminder` · `elso` | client | ✓ | ✓ | ✓ | "Még nem hagytad jóvá a meghatalmazást" | "{hatarido} van időd. Kb. 3 perc az ONYA-ban." |
| ↳ `utolso_nap` | client | ✓ | ✓ | ✓ | "Ma van az utolsó nap" | "Hagyd jóvá ma a meghatalmazást az ONYA-ban, különben a NAV törli." |
| `assist_mh_expired` | client | ✓ | ✓ | ✓ | "Lejárt a 4 nap" | "A NAV törölte a jóvá nem hagyott meghatalmazást. {firstName} újra beküldi, és szólunk." |
| `assist_consent_needed` | client | ✓ | ✓ | ✓ | "Él a meghatalmazás – nézd át az adataidat" | "Ha rendben vannak, engedélyezd a bejelentést. Kb. 2 perc." |
| ↳ `ujra` | client | ✓ | ✓ | – | "Engedélyezd újra a bejelentést" | "Módosult a kérdőív, ezért nézd át újra." |
| `assist_ev_filed` | client | ✓ | ✓ | ✓ | "Bejelentettük a vállalkozásodat!" | "Elment a NAV-hoz. Rögzítjük az adószámodat, és szólunk." |
| `kamara_reminder` | client | ✓ | ✓ | ✓ | "Ne felejtsd el: kamarai regisztráció" | "{hatarido} regisztrálj a kamaránál. Kb. 10 perc." |
| `assist_task` · `ujegyke` | the client's accountant | ✓ | – | ✓ | "Küldd be a meghatalmazást: {clientName}" | "Egyeztettünk vele. UJEGYKE meghatalmazottként: {ugycsoportok}." |
| ↳ `ellenorzes` | accountant | ✓ | – | ✓ | "Jóváhagyta: {clientName}" | "Nézd meg az ONYA-ban, hogy él-e a meghatalmazás." |
| ↳ `bejelentes` | accountant | ✓ | – | ✓ | "Beküldheted: {clientName} bejelentése" | "Engedélyezte a bejelentést. Küldd be a Vállalkozói Ügysegédben, meghatalmazottként." |
| ↳ `ujra` | accountant | ✓ | – | ✓ | "Lejárt a 4 nap: {clientName}" | "Küldd be újra a meghatalmazást." |
| ↳ `atnezes` | csapat, admin | ✓ (badge) | – | digest | "Nézd át: {clientName} bejelentése" | "{firstName} beküldte. Ellenőrizd az értesítést, és rögzítsd az adószámot." |
| `assist_approval_overdue` | assignee (or csapat) + accountant | ✓ | – | ✓ (once) | "Ma jár le a jóváhagyás: {clientName}" | "Még nem hagyta jóvá. Hívd fel." |
| `client_path_changed` | csapat, admin, accountant | ✓ (badge) | – | digest | "{clientName} módosította a válaszát" | "{fromLabel} → {toLabel}" |
Also: `callback_received` body gets ", és nem lépünk be helyetted" after "…a kódjaidat" (§27.3.7); `registration_done` body "Rögzítettük az adószámodat. Jöhet a következő lépés." (+ "Ne felejtsd el a kamarai regisztrációt: {hatarido}."). Client notification settings: the new client kinds under "Intézzük helyetted" and "Vállalkozás bejelentése" (push/e-mail toggles; `assist_mh_*` push default on).
Jobs (`src/jobs-tulaj1119.ts`): every 15 min `assist_approvals` (§27.3.5: reminders, staff alert, auto-expiry; quiet hours for push); daily 10:00 `kamara_reminders` (2 working days before the due date and on the due date, max 2, not after "Megcsináltam"); the staff digest (§26.11) adds "Intézzük helyette: N vár rád". `chamber_due_on` = `registered_on` (or `filed_on`) + 5 working days, set when the registration reaches `kesz`.

### 27.9 API and content keys (B1; `/api/v1`; DTOs from `kod/shared/src/api.ts`)

#### 27.9.1 Endpoints
Roles: `C` client, `T` csapat, `AD` admin, `A` accountant (own clients only; others 404). Errors: §3.5 + §26.10 + `path_change_needs_callback` 409, `path_required` 409, `assist_already_open` 409 (`{ error, assist }`), `assist_wrong_status` 409, `assist_checklist_incomplete` 400 (`fields` = missing items), `assist_consent_stale` 409, `assist_disabled` 409.
| Method path | Auth | Request → Response |
|---|---|---|
| `GET /client/onboarding` | C | → **OnboardingState** + `journey`, `pathChange`, `assists`, `registrationMode`; `todoCount` = `journey.todoCount` |
| `PUT /client/onboarding/business-status` | C | **BusinessStatusInput** → **OnboardingState** (§27.2) |
| `PUT /client/profile` | C | 409 `path_required` (§27.2.2) |
| `POST /client/business-registration/withdraw` | C | only `kitoltes`/`utmutato` (§27.2.2) |
| `POST /client/business-registration/filed` | C | `channel` ∈ `CLIENT_FILING_CHANNELS`; 409 `assist_wrong_status` while an EV assist is open ("A bejelentést {firstName} küldi be. Ha mégis magad küldted be, előbb mondd le a kérést.") |
| `POST /client/business-registration/chamber` | C | **ChamberDoneInput** → **BusinessRegistrationView** (only `kesz`) |
| `GET /client/assist` | C | → `{ items: AssistView[] }` |
| `POST /client/assist` | C | **AssistCreateInput** → 201 **AssistCreateResult** (§27.3.2) |
| `POST /client/assist/:id/approved` | C | → **AssistView** (`meghatalmazas_bekuldve`/`_lejart` → `_jovahagyva`) |
| `GET /client/assist/:id/consent` | C | → **AssistConsentSummary** (EV only) |
| `POST /client/assist/:id/consent` | C | **AssistConsentInput** → **AssistView** |
| `POST /client/assist/:id/cancel` | C | **AssistCancelInput** → **AssistView** |
| `GET /client/guides/meghatalmazas_jovahagyas` | C | → **Guide** (`video: null`, `approvalDue`) – 409 `step_locked` otherwise |
| `POST /client/onboarding/meghatalmazas` | C | `onya_konyvelo` = assist create / approved (§27.3.2 compatibility) |
| `GET /team/summary` | T, AD, A | + `assists` |
| `GET /team/assists?filter=nyitott\|nalam\|ugyfelre_var\|lejart\|kesz\|mind&kind&q&cursor` | T, AD, A | → `Page<TeamAssistRow>` |
| `GET /team/assists/:id` | T, AD, A | → **TeamAssistDetail** |
| `POST /team/clients/:clientId/assists` | T, AD, A | `{ kind, note?, agreed?: AssistAgreedInput }` → 201 **TeamAssistDetail** (links the open callback if any) |
| `POST /team/assists/:id/agreed` | T, AD, A | **AssistAgreedInput** |
| `POST /team/assists/:id/ujegyke-filed` | A, AD | **AssistUjegykeFiledInput** |
| `POST /team/assists/:id/expired` | T, AD, A | `{}` |
| `POST /team/assists/:id/mh-live` | A, AD | `{}` |
| `POST /team/assists/:id/ev-filed` | A, AD | multipart `file` + **AssistEvFiledInput** fields → registration `beadva`, channel `meghatalmazott`, document `ev_bejelentes` (source `konyvelo`, visibility `kozos`) |
| `POST /team/assists/:id/close` | T, AD, A | **AssistCloseInput** |
| `POST /team/assists/:id/assign` | T, AD | **CallbackAssignInput** |
| `PATCH /team/assists/:id` | T, AD, A | **AssistStaffPatch** |
| `POST /team/clients/:clientId/path` | T, AD | `{ businessStatus, note, clearAdoszam? }` → **TeamClientCard** |
| `POST /team/registrations/:id/check` | T, AD | 403 for the user who filed it via `ev-filed` |
| `GET /admin/dashboard` | AD | + `service.assists` |
| `POST /admin/clients/:id/disable` · `/enable` | AD | `{ reason }` → 204 (security finding 9) |
Every assist response is built from one function (`assistView()` / `teamAssistDetail()`), `allowedActions` from `ASSIST_ACTION_ROLES` + status. Audit: `assist.created|linked|upgraded|converted|agreed|ujegyke_filed|client_approved|expired|mh_live|consent_given|consent_invalidated|ev_filed|done|cancelled|closed|assigned|check_ticked|data_viewed`, `business_status.changed`, `team.path_changed`, `registration.chamber_done|chamber_undone`, `client.disabled|enabled`. `details` never hold note texts, phone numbers, addresses or the adóazonosító jel.

#### 27.9.2 Content keys (defaults generated by `backend/src/content/tulaj1119.ts` from the shared constants; editable in `/admin/szovegek`)
| Group | Keys | From |
|---|---|---|
| Journey | `bekotes.ut.<JOURNEY_TEXTS key>`, `bekotes.ut.lepes.<step>.cim\|ido\|gomb` | `JOURNEY_TEXTS`, `JOURNEY_STEP_TEXTS` |
| Waiting | `bekotes.varakozas.<key>.felso\|cim\|szoveg`, `bekotes.varakozas.eszkalacio`, `.addig` | `WAITING_TEXTS`, `WAITING_*` |
| Branch | `bekotes.ut.valtas.<key>`, `bekotes.ut.zarolt.<blocker>`, `bekotes.ut.mod.<key>` | `PATH_CHANGE_TEXTS`, `PATH_CHANGE_BLOCKER_TEXT`, `START_MODE_TEXTS` |
| Assisted | `helyettunk.<key>`, `helyettunk.allapot.<status>` (+ `.mh`), `helyettunk.lepesek.<kind>.<i>` | `ASSIST_TEXTS`, `ASSIST_STATUS_CLIENT_TEXT(_MH)`, `ASSIST_STEP_LIST` |
| Invoices | `szamlak.<key>` | `INVOICE_WORDING` |
| New business | `vallalkozas.kamara.<key>`, `vallalkozas.kerdoiv.<key>`, `vallalkozas.kozpont.<key>`, `vallalkozas.utmutato.rajz_megjegyzes` | `KAMARA_TEXTS`, `KERDOIV_TEXTS`, `HUB_TEXTS`, `GUIDE_DRAWN_NOTE` |
| Locks | `bekotes.zarolt.elofizetes_szerzodes_utan` = "Előbb fogadd el a szerződést. Utána megadhatod a kártyádat." | `STEP_LOCK_DEFAULT_TEXTS` (key `LOCK_ELOFIZETES_SZERZODES_UTAN`) |
| Explainers | `bekotes.magyarazat.<12 new keys>.cim\|mi\|miert\|hol` | `ONBOARDING_EXPLAINERS` |
| Notifications | `notif.<kind>.title\|body`, `email.<kind>.subject\|body` (§27.8) | B1 |
`/admin/szovegek` shows them in groups "Bekötés – út", "Várakozás", "Intézzük helyetted", "Kiállított számlák" with the placeholder check.

### 27.10 Legal texts (B4; `kod/jogi`; "TERVEZET – jogász ellenőrzi"; `requiresReconsent: false` in this round, [JOGI] decides before go-live)
- **`aszf.md`** – the §26.12 sentence "we do not file the bejelentés and do not act as representative" is replaced by a section **"Intézzük helyetted (segített ügyintézés)"**: on request and after a call (a) the accountant files the UJEGYKE meghatalmazás as the client's meghatalmazott and the client approves it in ONYA within 4 calendar days; (b) on the client's written instruction in the app (§27.3.3) the accountant files the EV bejelentés in the Vállalkozói Ügysegéd as the client's registered meghatalmazott, with exactly the data the client approved; the client is responsible for the truth of his data and makes the declarations (kizáró okok) himself; the bejelentés cannot be withdrawn and the business starts on the filing day; we never ask for, store or use the client's Ügyfélkapu+/DÁP login and never act in his name otherwise; part of the service, no separate fee [OWNER]; the EV part is available until the register moves to the chamber (2026-12-31) [OWNER/JOGI]; [JOGI] Üttv. 2. §, 4. §, Btk. 286. § question for the non-tax EV-register part. Self-service stays the default. Public wording: "segítünk", "a könyvelőd meghatalmazottként beküldi"; never "jogi képviselet", "ügyintézési díj", "bejegyeztetjük".
- **`megbizasi_szerzodes.md`** – clause: on request the accountant acts as the client's permanent meghatalmazott in tax matters, and – on a separate written instruction given in the app – in the EV-register matter of starting the business; the instruction and the NAV értesítés are kept in the dossier.
- **`adatkezeles.md`** – new section "Intézzük helyetted": the request (kind, status, times), the call notes (as callbacks), the consent (text version, hash, frozen copy of the approved data, time, IP, user agent), the instruction PDF, the UJEGYKE / EV filing facts (date, jogcím, ügycsoportok, who filed; never any NAV login data); purpose: carrying out the client's request; basis: contract (GDPR 6. cikk (1) b)) [JOGI]; retention like the contract documents [JOGI/OWNER]. Wording: line 13 and 132 "anyád nevét" → "anyja születési nevét" (legal register; the in-app copy says "anyukád"), invoice lines 60, 68, 154 per §27.5.2.
- **`nav_meghatalmazas.md`** – method 2 in full: who files (the accountant, own profile, role Meghatalmazott, jogcím [KÖNYVELŐ/JOGI 9 or 60]), ügycsoportok (ADÓÜGYEK + the EV-register group when he also files the bejelentés), the client's approval in ONYA within 4 calendar days (red dot, "Jóváhagyásra vár", Megtekintés, Jóváhagyás + confirm; live ~20 minutes later), what happens if not approved (NAV deletes it, we re-file, no sanction). Keeps the §26.12 [JOGI] flag.
- **`pmt_nyilatkozatok.md:25`** "anyád születési neve" → "anyja születési neve"; `sablonok/pmt_adatlap.md`, `src/helyorzok.ts:77` keep "anyja".
- **NEW `ev_bejelentes_utasitas.md`** (template, version `2026-11-19.1`, rendered by the backend into the PDF of §27.3.3): "Utasítás a vállalkozásom bejelentésére" – client name, adóazonosító jel (masked), accountant name + nyilvántartási szám, the approved data blocks, the declaration, the instruction text (`ASSIST_TEXTS.consentInstruction`), date and time, "Az alkalmazásban elektronikusan elfogadva", hash. [JOGI: is this enough as the meghatalmazó's instruction; Ákr. 14. §].
- **`app_szovegek.json`** (+ `.md`): FAQ – replace "Miért nem ti jelentitek be a vállalkozásomat?" by **"Bejelentitek helyettem a vállalkozásomat?"** – "Igen, ha kéred. Koppints az „Intézzétek helyettem” gombra: felhívunk, átnézzük veled az adataidat, a könyvelőd pedig meghatalmazottként, a saját belépésével bejelenti. Neked csak a NAV oldalán kell jóváhagynod a meghatalmazást, és itt engedélyezned a bejelentést. A jelszavadat vagy a kódjaidat soha nem kérjük el. Ha inkább magad csinálod, lépésről lépésre megmutatjuk, kb. 10–15 perc."; new **"Mit jelent, hogy jóvá kell hagynom a meghatalmazást?"** – "Ha a könyvelőd küldi be a meghatalmazást, a NAV megkérdezi tőled, hogy rendben van-e. Az ONYA-ban hagyod jóvá, Ügyfélkapu+-szal vagy DÁP-pal, 4 napon belül. Az alkalmazásban lépésről lépésre megmutatjuk, és emlékeztetünk."; update "Még nincs vállalkozásom. Mit tegyek?" (both options), "Mi az a meghatalmazás, és visszavonhatom?" (+ "vagy kérd, hogy a könyvelőd küldje be, és te csak jóváhagyod"), "Mennyibe kerül…" (§27.5.2 sentence). Changed items carry `elozo_kerdes` / `elozo_valasz` = the exact old texts (for the data step §27.7.3). `uj_vallalkozas.nem_taroljuk` "édesanyád nevét" → "anyukád nevét". FAQ count 12 → 13: update the checker; `npm run minden` passes; regenerate `pdf_minta/`.
- Strip internal notes `[JOGI: …]`, `[TULAJ: …]`, `[KÖNYVELŐ: …]` from everything a client sees or receives (round-2 owner finding 12): jogi PDF generator (B4) and the backend legal render (B1); keep them in the sources.

### 27.11 Open round-2 findings (`_munka/k5/k3_kor2_nyitott.json`) → who fixes them
"Integrátor" = after the four builders (deploy and server actions); "Tulaj" = needs the owner. Each builder writes one line per finding into §24 ("fixed / changed contract / not done because …").
| # | Finding (short) | Builder | What exactly |
|---|---|---|---|
| S1 | TOTP step blocked by the password lock (staff lock-out) | B1 | the TOTP step honours the same known-address exemption, or separate counters; regression test |
| S2 | reset code guessable across many addresses | B1 | per-account guess budget across all addresses (e.g. 10 / 24 h) + code invalidated after it; test |
| S3 | JSON endpoints accept any content type (login CSRF) | B1 | `readJson` requires `application/json` (415), refresh needs JSON or a custom header, Origin check on auth routes |
| S4 | contract acceptable without verified e-mail / data | B1 | `/me/consents` needs a verified e-mail and `adatok` done (409 `step_locked`) |
| S5 | upload slots blockable | B1 | slots per user id, body idle deadline; Caddy timeout note for the integrator |
| S6 | no storage quota | B1 | per-client byte quota (stricter before activation) + free-disk guard |
| S7 | 2FA on an unverified e-mail | B1 | verified e-mail required; first reset clears TOTP |
| S8 | accountant capacity eaten by unverified sign-ups | B1 | assign / count only verified clients |
| S9 | no way to block a client | B1 + B3 | admin disable/enable (§27.9.1) + `megszunt` read-only; panel buttons |
| S10 | four old plain dumps | Integrátor | encrypt with `.backup_pass`, verify `pg_restore -l`; shredding only with the owner's OK |
| S11 | nightly backup not scheduled | Integrátor | install the cron line from `deploy/README.md`, run `restore-proba.sh` once |
| S12 | local DEMO_BELEPESEK.txt | Tulaj | move to `_regi/` only with his OK |
| S13 | Android `allowBackup` | B2 | `android.allowBackup: false` in `app.config.ts` |
| S14 | payment result spoofable from the URL | B2 | success only when the subscription query says active |
| S15 | containers run as the deploy uid | B1 → Integrátor | compose with a dedicated uid + `pids_limit` (B1 writes it, the integrator applies) |
| S16 | sign-up tells if an address exists | B1 | uniform answer + "már van fiókod" e-mail |
| T1 | **BLOCKER** revenue moved into an approved quarter disappears | B4 | `ado-motor` year computation uses the approved quarters' bases as fixed priors and carries any later revenue change of a closed quarter into the next open quarter's year-to-date base; backend `tax.ts` passes approved sums and flags the change to the accountant ("Lezárt negyedév bevétele változott – nézd át"); tests reproduce Réka and Kata [KÖNYVELŐ] |
| T2 | photographers get 45 % | shared (done) | `foto` → `lista80`; the demo Levente keeps his stored profile (the demo accountant can change it) |
| T3 | false "lejárt" deadlines before the business started | B4 | `tax.ts` `ensurePeriods` + `flags.ts` `clientDeadlines` skip periods that end before `atalany_from` / `ev_since` |
| T4 | tax profile created for the wrong year at the year boundary | B1 | `registration.ts` `finishRegistration`: profile for the year of `registered_on` (and the current year if later) |
| T5 | prorated ÁFA limit not shown to starters | shared (done) + B2 | explainers fixed; kérdőív page 5 shows `hints.afaLimitHuf` / `atalanyCapHuf` (S9) |
| T6 | limit alerts only once at 80 % ÁFA | B4 | limit job + `flags.ts`: `notifyOnce` per code and year for `afa_over`, `afa_projected_over`, `atalany_cap_80`, `atalany_cap_over`; flag texts differ before / after crossing |
| T7 | minimum contribution ignores garantált bérminimum | B1 + B2 | backend hint shows both amounts when `kepesitesKellhet`; app offline copy the same |
| T8 | 2027 form number 2758, `jobNewYear` | B4 | form from the year; `jobNewYear` passes status and copies allowances |
| T9 | 2026-12-12 working Saturday | B4 | change only after confirming on njt.jog.gov.hu; calendar test |
| T10 | panel meter sentences in mixed person | B4 | `accMeters`: Unicode-aware patterns or an accountant variant from the engine |
| T11 | unnatural Hungarian (hero title, button voice, nyugdíj sentence, "egyben utalod", "kb." with exact forint, hard-coded price) | B2 (+ shared done) | §27.4.1 rules; price from `brand.json` |
| T12 | inconsistent terms (köztartozás-mentes, adókártya, anyád/édesanyád, retry promise) | B2, B3, B4 | one form each: "köztartozásmentességi igazolás", "adóigazolvány (régi nevén adókártya)" once then "adóigazolvány", "anyukád", one retry sentence |
| T13 | HIPA title always "éves bevallás" | B4 | `flags.ts` uses the engine's title for `savos` |
| O1 | APK without the blue palette and 11-19 fixes | B2 → Integrátor | B2 bumps to 1.0.5 / versionCode 6 at the very end; the integrator builds and checks the bundle |
| O2 | wordmark in the onboarding video and poster | B4 | visual re-render with the existing audio (after the video job, §27.0.5) |
| O3 | video says "Mi nem tároljuk" on the anyja neve row | B4 | "A bejelentéshez nem kérjük el" on that row (visual re-render) + the "anyukád" re-voice (§27.5.3 / §27.4) |
| O4 | panel session label hard-codes the name | B3 | from `brand.json` |
| O5 | name baked into PDF metadata, ICS, SimplePay SDK string, fixed article | B1 | from `brand.json` + `huArticle()` |
| O6 | client PDFs plain black | B4 | port the jogi typesetter (band, blue titles, TERVEZET label) into `backend/src/lib/pdf.ts`; regenerate `pdf_minta/` |
| O7 | Geist missing on the DEMO pay page / 2FA secret | B1 (pay page), B2 (app), B3 (panel) | embed Geist / tabular figures |
| O8 | "Hol tartunk" says "bejelenti magát" for self-given meghatalmazás | B1 | method-aware milestone texts (also used by the panel) |
| O9 | no explainer on Fiók and the ID fields | shared (done) + B2 | wire `fiok` and the four ID explainers |
| O10 | "Elakadtál?" missing in waiting states | B2 | every state of S14 and S18 |
| O11 | band / badge / locked-sheet numbers disagree | B1 + B2 | `journey.todoCount` everywhere (§27.4.2) |
| O12 | internal [JOGI…] notes shown to clients | B1 + B4 | strip at render (§27.10) |
| O13 | guide says a label the picture does not show | shared (done) + B4 | template = film wording; B4 re-checks every caption and re-annotates |
| O14 | EV guide pictures still drawn | Tulaj (kit §27.1.4) | 7 real today; the rest by `sajat_kepek.py` |
| O15 | ID card back side still required | Tulaj | question only (§27.13) |
| O16 | STATUS.md out of date | Integrátor | rewrite at the end |
| O17 | DEMO_BELEPESEK.txt | Tulaj | as S12 |

### 27.12 Acceptance tests (backend vitest on PGlite; app + panel on the local harnesses with the demo seed incl. §27.7.4; live checks only with curl, never typing passwords on the live host)
**K1 – real screenshots (order 1)**
- K1.1 `kepek.json` exists for the three guide kinds; every file exists; `kind` matches `index.json` `tipus`; every `kepernyokep` has `source`; `missing[]` exact.
- K1.2 App: real pictures show "NAV-képernyő · Forrás: …", drawn ones "Rajzolt vázlat – a valódi képernyő kicsit eltérhet"; the drawn-picture note appears only while a drawn picture exists (test by switching one item's kind in a copy of `kepek.json`).
- K1.3 The EV guide matches the film facts: Személyi adatok has no Lakcím / TAJ rows, Nyilatkozatok has 4 rows, step 2 names "Egyéni vállalkozói tevékenység elkezdése (vállalkozói bejelentkezés)", the last NAV step is "Bejelentéseim, kérelmeim – Megtekintés"; every step text agrees with its picture caption (B4 list in §24).
- K1.4 `python utmutato_kepek/_eszkoz/sajat_kepek_proba.py` still passes (B4).

**K2 – changeable branch (order 2)**
- K2.1 API: NULL → van → inditas → van → inditas: all 200; the SAME registration row is reopened (one row in total, answers and guide progress kept); `adatok` status as §27.2.2; audit rows `business_status.changed` with from/to.
- K2.2 van with an adószám → inditas: 409 `path_change_needs_callback` with the `adoszam_megadva` text; inditas `beadva` → van: 409 `bejelentes_bekuldve`; `withdraw` in `beadva`: 409; full van profile while NULL: 409 `path_required`; staff `POST /team/clients/:id/path` with `clearAdoszam` works and is audited; csapat cannot use it on an `aktiv` client.
- K2.3 App (P3 "Peti" journey on the harness, 390×844 and 360×780): wrong answer → corrected in 2 taps from the Főoldal row; from Rólad; from Adataid 2 ("Még nincs adószámom"); from the kérdőív gate; toast + "Visszavonom" restores; blocked case shows the callback sheet. Screenshots `kod/app/_kepek/k27_ut_*.png`, LOOKED at.
- K2.4 Panel: the client card and the pipeline card show the path history / "Útvonalat váltott"; `client_path_changed` badge appears.

**K3 – Intézzük helyetted (order 3)**
- K3.1 EV happy path (fake clock): `POST /client/assist` creates the assist + callback with topic `vallalkozas_bejelentes_helyettem` (or links an open callback); csapat `agreed` with a missing item → 400, with all → `egyeztetve`; `ujegyke-filed` by csapat → 403, by the accountant before the contract → 409, after → `meghatalmazas_bekuldve`, due = filing date + 3, step `meghatalmazas` `ugyfelre_var`.
- K3.2 Reminders: +24 h `assist_mh_reminder elso`, due day 09:00 `utolso_nap`, 12:00 staff `assist_approval_overdue` once, push not before 8:00; filing + 4 days + 2 h without approval → `meghatalmazas_lejart` + client and accountant notified; re-filing starts a new window; `expired_count` 1.
- K3.3 Client "Jóváhagytam" → `_jovahagyva`; accountant `mh-live` → `meghatalmazas_el`, step `kesz`.
- K3.4 Consent: summary hash; consent with a wrong hash → 409 stale; while `activityPending` → 409; valid consent → `ugyfel_engedelyezte` + instruction PDF in `DossierView.contracts`; a later questionnaire edit (client or team ÖVTJ code) invalidates it and notifies `assist_consent_needed ujra`.
- K3.5 `ev-filed` (PDF + date) → registration `beadva`, channel `meghatalmazott`, document `ev_bejelentes`; the same accountant's `check` → 403; csapat check + adószám → registration `kesz` → assist `kesz`, chamber due date set.
- K3.6 Meghatalmazás-only on the `van` path (Dávid): card at the top of S14, confirm sheet, statuses, approval guide reachable only while waiting for approval; old app call `POST /client/onboarding/meghatalmazas {method:'onya_konyvelo'}` creates the same assist.
- K3.7 Cancel before the UJEGYKE → `visszavonva`, mode back to `onallo`, self-service rows return; cancel after the UJEGYKE → converted to kind `meghatalmazas`; inditas → van with an open EV assist follows §27.2.2.
- K3.8 Role isolation: another accountant gets 404 on the assist; csapat gets the masked adóazonosító jel only; `assist.data_viewed` audited for the accountant; `ASSIST_EV_ENABLED=false` → EV card shows the disabled text and `POST /client/assist {kind:'vallalkozas_bejelentes'}` → 409 `assist_disabled`.
- K3.9 Never-credentials: the text is on the confirm sheet, the approval guide, the callback promise, the FAQ, ÁSZF; a grep of `kod/backend/src`, `kod/app/src`, `kod/panel/src` finds no input field, column or log for a client's KAÜ username / password / code (`ugyfelkapu.*(jelszo|password)`, `dap.*(pin|kod)` in request schemas: 0 hits).
- K3.10 App screenshots of every assisted state (Marika, Dávid on the harness; Ilona in the panel), LOOKED at; the highlighted cards are visible without scrolling on S3, S8 and S14 at 390×844.

**K4 – the flow (order 4)**
- K4.1 For P1 (self), P2 (van), P3 (switcher) and Marika (assisted), in every state: band number = tab badge = locked-sheet "a tiéd" = `journey.todoCount`; exactly one "Most ez jön" card or one waiting card; no "Hol tartunk" / "A lépések" list in the app; no "Kitöltöm" card before the branch answer.
- K4.2 Every waiting state of §27.4.3 shows who, how long and the escalation date; every onboarding sub-screen has "Vissza" and "Elakadtál? Kérj visszahívást" in every state.
- K4.3 Előfizetés is locked until the contract on both paths (API 409 `step_locked` + row `kesobb`).
- K4.4 Wording: no "anyád" / "édesanyád" anywhere client-facing (app, backend content + notify, jogi client texts, VTT); "Anyja" only in the panel, jogi templates and the guide row that shows NAV's label; no "Jelentsd be Bencét", no "Készítsd elő" button, no "adatlap" in client copy; all buttons first person.
- K4.5 Before/after table of §27.4.5 re-counted on the harness and written to §24.

**K5 – invoice wording (order 5)**
- K5.1 `INVOICE_WORDING_FORBIDDEN_PATTERNS` → 0 hits in the places of §27.5.4 (script `kod/app/scripts/k27-szamla-szoveg.mjs`, B2 writes it in its own folder; it scans every folder of §27.5.4 read-only; every builder runs it before handing over).
- K5.2 Dosszié: section "Kiállított számlák", header row = `INVOICE_WORDING.short` + "Mi ez?" → explainer `kiallitott_szamlak`; panel tab "Kiállított számlák"; the bekotes video caption and narration say the new sentence (B4, after the video job).

**KS – safety**: §26.14 S1 and S2 unchanged (pg_dump, Gardoko health 200 before/after, `alex@`/`tulaj@` snapshot identical, demo addition idempotent); the data step §27.7.3 changes no `onboarding_steps` row (row count + checksum before/after).

### 27.13 Waits (additions to §23 / §26.15)
| # | Item | Who | Until then |
|---|---|---|---|
| 22 | Public name of the assisted path ("Intézzük helyetted" / "Intézzétek helyettem"), no separate fee, EV part on by default | OWNER | as written; `ASSIST_EV_ENABLED=true` |
| 23 | Lawyer: may our accountant file the EV start (EV-register group, "kivéve adóügyek") as part of the paid service (Üttv. 2. § (2) b), 4. §, Btk. 286. §); is the in-app instruction (§27.3.3, `ev_bejelentes_utasitas`) enough; consent retention; use of NAV film stills (Szjt. 1. § (4) / 34. §) | JOGI | drafts; kill switch `ASSIST_EV_ENABLED` |
| 24 | Bence's UJEGYKE jogcím: 9 (könyvelő, with his NGM number) or 60 | KÖNYVELŐ / JOGI | `ASSIST_UJEGYKE_JOGCIM=9` |
| 25 | NAV 1819 (or Bence opening the Képviseletválasztó for a consenting test client WITHOUT submitting): does the Vállalkozói Ügysegéd offer "Egyéni vállalkozás indítása" to a meghatalmazott for a not-yet-EV client, with Személyi adatok prefilled? (The tax advisers' chamber says yes; no NAV sentence says it.) | OWNER / KÖNYVELŐ | the team's first real case is done on a call with the client, ready to switch to self-service |
| 26 | 2027-01-01 the EV register moves to the chamber: new filing surface and representation rules | OWNER / KÖNYVELŐ | `ASSIST_EV_VALID_UNTIL=2026-12-31` (the EV card then shows the disabled text); re-check in December |
| 27 | Own screenshots of the 7 drawn EV screens and of the ONYA JÓVÁHAGYÁS button + pop-up | OWNER (or Bence at the first real approval) | "Rajzolt vázlat" |
| 28 | The ID card back side (round-2 owner finding 15) – keep it required? | OWNER / JOGI | required as today |
| 29 | "Könyvelőt váltasz?" text (who files the old quarters, when to revoke the old meghatalmazás) | KÖNYVELŐ | the text in `konyvelovaltas` |

### 27.14 Sources (research of 2026-11-19)
- NAV UJEGYKE GYIK (2026.05.04) q.1–4, 6, 18, 25: https://nav.gov.hu/pfile/file?path=/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/UJEGYKE/ujegyke----gyik-2023-02-06 · UJEGYKE Kitöltési útmutató (2026.01.01) pp. 4, 13–17, 22, 36: https://nav.gov.hu/pfile/file?path=/nyomtatvanyok/letoltesek/nyomtatvanykitolto_programok/nyomtatvanykitolto_programok_nav/UJEGYKE/ujegyke-kitoltesi-utmutato · Segédlet a 15-ös és 18-as jogcímű szervezetek ONYA-s képviseleti bejelentéséhez (2025.03.11) pp. 8–10: https://nav.gov.hu/pfile/file?path=%2Fugyfeliranytu%2Feljarasi-kerdesek%2Fsegedlet_15_18_ujegyke_onya_honlapra · ONYA általános bemutató (2026.01.23): https://nav.gov.hu/pfile/file?path=/nyomtatvanyok/letoltesek_egyeb/onya-segedletek/online-nyomtatvanykitolto-alkalmazas--altalanos-bemutato · NAV Állandó meghatalmazás GYIK: https://nav.gov.hu/ugyfeliranytu/valaszol-a-nav/allando-meghatalmazas
- A Vállalkozói Ügysegéd útmutatója (2026.03.19) pp. 7–16 · NAV kisfilm "Megújul az Ügysegéd" (2026-02-19): https://youtu.be/DQnbjo2lrv8 · Adótanácsadók és Adószakértők Kamarája, Tájékoztató Vállalkozói ügysegédről: https://www.adokamara.hu/uploads/segedanyagok/vallalkozoi-ugyseged-adokamara.pdf
- DÁP – Tájékoztató könyvelőknek és adószakértőknek az Ügyfélkapu kivezetéséről, p.3 (using someone else's login is unlawful): https://platform.dap.gov.hu/tajekoztatok/tajekoztato-konyveloknek-es-adoszakertoknek-az-ugyfelkapu-kivezeteserol.pdf
- Air. 15. §, 17. §, 36. §: https://net.jogtar.hu/jogszabaly?docid=a1700151.tv · Szt. 151. § (1): https://net.jogtar.hu/jogszabaly?docid=a0000100.tv · Evectv. 3., 6., 7., 12. §: https://net.jogtar.hu/jogszabaly?docid=a0900115.tv · Ákr. 13–14. §: https://net.jogtar.hu/jogszabaly?docid=a1600150.tv · Üttv. 2., 4. §: https://net.jogtar.hu/jogszabaly?docid=a1700078.tv · Btk. 286. §: https://net.jogtar.hu/jogszabaly?docid=a1200100.tv
- MKIK 2027 egyablakos ügyintézés: https://mkik.hu/hirek/2027-tol-egyablakos-ugyintezessel-tamogatja-a-vallalkozokat-a-kamara · MINKE 2026-09-09: https://mti.hu/nemzeti-kozlemenytar/2026/09/09/minke-azt-keri-maradjon-nav-nal-az-egyeni-vallalkozok
- Inputs of this section: `_munka/k5/flow_jelenlegi.md` + `_munka/k5/felmeres/` (walkthrough 11-19), `_munka/k5/k3_kor2_nyitott.json`, `_munka/k5/k3_eredmenyek.json`, `utmutato_kepek/hianyzik.md`, `utmutato_kepek/SAJAT_KEPEK.md`.

### 27.15 11-19 javító kör (fixer of the owner orders 2–5 + round-2 findings) – what changed, contract for later rounds
- **Branch change keeps data (order 2).** `PUT /client/profile/draft` (any subset of the profile; invalid values are dropped, the adószám is NEVER stored by a draft – it would block the switch, §27.2.1; no step change; only during onboarding; audit `client.profile_draft_saved`). The app saves each page of the van form on "Tovább", on "Vissza a Főoldalra" and before "Még nincs adószámom". `applyPathChange(→inditas)`: when name, phone, adóazonosító jel and lakcím are stored (`roladComplete`), `adatok` becomes/stays `kesz` (+ `afterProfileSubmitted`). After the Rólad save (`?utana=vallalkozas`) the app goes to `journey.currentKey`'s route (kérdőív / útmutató / értesítés / engedély), else the Főoldal.
- **Undo = only the toast.** `BusinessStatusInput.undo: true` (sent only by "Visszavonom") within 30 s; a fast change through the sheet is a real change. An undo that reverses a notified change sends one correcting `client_path_changed` (final state). Toast after undo: `PATH_CHANGE_TEXTS.undoneVan|undoneInditas`. While a bottom sheet is open the toast sits at the top of the screen (`JelzesReteg fent`).
- **Times (order 4).** `WAITING_TEXTS[*].time` (content `bekotes.varakozas.<key>.ido`): a `var` row shows the waiting time, not the client's estimate; `WaitingCardView.timeText` feeds "Közben: {title} · {time}". `WaitingCardView.escalateKind`: `uzenet` while a callback is open (`eszkalacio_hivas` "… sem hívtunk, írj nekünk az Üzenetekben" on the call's own card, `eszkalacio_uzenet` on other waits; the link opens /uzenetek). `helyettunk_hivas.szoveg` no longer says "Addig kitöltheted a kérdőívet" (the card's own "Addig: {title}" line says it per path). `vegso_jovahagyas` while the ÖVTJ line is pending: actor `te`, state `kesobb`, `bekotes.ut.zarolt_vegso_tevekenyseg`; its wait still feeds the waiting card. Journey row "Adataid" has its own explainer `adataid`. Approval after the shown due day: `AssistView.approval.afterDue`, `helyettunk.approve_after_due`, status `{hatarido}` = "még ma"; reminder body "Még {hatarido} van időd".
- **Assisted path (order 3).** `TeamAssistDetail.readyForUjegyke` + `notReadyReasons` (contract, name, adóazonosító jel); while not ready `ujegyke_bekuldve` is not allowed, ball = `ugyfel`, `nextDue` = "Ügyfélre vár: szerződés / adatok" (never overdue); client text `helyettunk.allapot.egyeztetve` is conditional, `.egyeztetve.kesz` when ready; `notif.assist_started` likewise. No dead end after a mistaken "Jóváhagytam": `lejart` allowed from `meghatalmazas_jovahagyva` ("Nem él – a NAV törölte"), `POST /client/assist/:id/not-approved` ("Mégsem hagytam még jóvá" → back to `meghatalmazas_bekuldve`, or `lejart` after NAV's deadline), the worker alerts the accountant once (`assist_task` variant `ellenorzes_kesik`, audit `assist.verify_overdue`) when NAV's 4 days + 2 h passed without "Él" – deliberately NO automatic expiry from `_jovahagyva` (the client may really have approved; an auto-expiry would cause a second UJEGYKE). `agreed()` closes the linked callback (`teljesitve`, attempt `beszeltunk`); `kesz` / team close (except `utvaltas`) / registration done close a still-open linked callback (`lezarva`, `egyeb`). `assist_ev_filed` gets `{firstName}` (jogi wording kept). ÖVTJ line written for a `segitett` registration → `registration_reminder` variant `tevekenyseg_segitett` → /bekotes/vallalkozas/engedely; `registration_checked` variant `segitett`. /bekotes/vallalkozas/utmutato shows "Ezt {firstName} küldi be helyetted" instead of the self-filing guide while an EV assist is open or mode is `segitett`. The old `onya_konyvelo approved` fallback needs the step open (contract lock tolerated) and `data.method = onya_konyvelo`. Callback/assist notes with a password, a code ("kód: …") or a 10-digit 8… number → 400 on `note` (`helyettunk.note_refused`); the app shows `ASSIST_TEXTS.noteHint` under every note field. Highlight: `SegitsegCsik` (2 pt brand border, 3D icon, "Ezt kérem") at the top of the EV and the self-service meghatalmazás guide intro and on every step under the primary button; `KiemeltSor` on the Főoldal = the same mini card (no "★"). Printable guide (ÁSZF 4/C.9): web, "Mutasd egyben" → "Kinyomtatom az útmutatót".
- **Panel.** Accountant client list: `AccClientRow.onboardingJourney` (done/total of required journey rows, next row or "most: {row} ({actor})"). HelyettunkReszlet: "Előbb az ügyfélnek: …" above the UJEGYKE checklist, the button reason before the checklist count, "–" + "Még nem adta meg" for a missing adóazonosító jel, "Nem él – a NAV törölte" in `_jovahagyva`.
- **Pictures / videos.** Approval guide: 04 = ONYA Főoldal (bemutató dia 7) + Értesítések (dia 11 right half), 05 = "Jóváhagyásra vár" card (UJEGYKE-segédlet p.10, all names/ids blurred before use), 06 = drawn JÓVÁHAGYÁS + confirm pop-up ("Rajzolt vázlat"); only the in-app step has no picture. New-business drawings now carry the real form title "Egyéni vállalkozói tevékenység elkezdése", the 1–6 step bar, "Mentés / Tovább", "Új főtevékenység / Új tevékenység hozzáadása". The owner's own NAV captures are NOT used (owner 11-19 11:50: wait; he already has an EV since 2026-08-01, so the start form cannot be photographed in his account) – `utmutato_kepek/SAJAT_KEPEK.md`. EV video: b04 "Anyukád születési nevét a NAV tölti ki: csak nézd át" (TAJ only on the list, "ha a képernyő kéri"), b36 + app card "Feltöltöm az értesítést" / "NAV-os értesítés", end card ≥ 2.3 s fully visible with a near cut (`render.py VEG 3.4, ZARO_KEP 2.4`). Meghatalmazás video: m26 retaken without the "megnyugtato" mood. Open (owner's yes needed): the intro video's order + "NAV-os igazolás" line (§27.4.1).

### 27.16 11-19 javító kör 2 (round-2 findings of the owner-order checks) – what changed
- **Van form keeps what was typed (blocker).** `bekotes/adatok.tsx`: the profile refetch after each draft fills ONLY empty fields the client has not touched on this screen; it never overwrites a typed adószám / jogállás with `''`/`null`. One "Mentés" on page 3 saves (checked on the harness: drafts 200 ×3, `PUT /client/profile` 200 once, no false "nem stimmel").
- **Journey rows say who works on WHAT.** A `var` row's status = its waiting card title (`bekotes.varakozas.<key>.cim`). Self-service filing while the ÖVTJ line is pending: actor `te`, state `var`, status `bekotes.ut.bejelentes_var_status` ("Előbb megírjuk a tevékenység-sorodat (Csapatunk)"), action "Útmutató" → the guide (a `var` row of actor `te` may carry an action; the app shows it as a link). Waiting for the adószám: row title `bekotes.ut.atnezes_adoszam_cim` ("Adószámod"), status `bekotes.ut.atnezes_adoszam_status`, actor NAV. `RawRow.titleKey` overrides a row title. The finished EV request (`kesz`, `JourneyInput.evDone`) keeps the "Visszahívás" row `kesz`.
- **Hub while pending:** `vallalkozas.allapot.utmutato_varakozik` ("Már átnézheted az útmutatót …") instead of "Kész a személyre szabott útmutatód"; the card title says the same, the amber box once.
- **Late on our side.** Past the escalation day the waiting card has no date: `bekotes.varakozas.kesunk[_uzenet|_hivas|_nav|_nav_uzenet]` (`WAITING_LATE_TEXTS`, `{ki}` = accountant's first name / "A kollégáink"). Job `assist_overdue` (working days from 09:00): one `assist_task` variant `kesik` per row and day (audit `assist.overdue_reminder` with `details.day`) to the client's accountant + the assignee (else the active team) for open assists with ball `konyvelo` and an overdue `nextDue` (client-not-ready rows never count). Staff digest: "Intézzük helyette – a könyvelőnél késik: N".
- **Filing roles.** `ASSIST_ACTION_ROLES.ujegyke_bekuldve | meghatalmazas_el | bejelentes_bekuldve = ['konyvelo']`; an admin is `konyvelo` only when he is THIS client's accountant (`assistForStaff`). 403 texts name the accountant.
- **Claims are linked.** `assignAssist` also takes the linked open callback (unless a colleague holds it); claiming a callback takes its unassigned open assist (audits `callback.assigned` / `assist.assigned` with `via`).
- **Undo leaves no ghost.** An undo (`undo: true`) that reverses "Még nincs" leaves the EMPTY questionnaire with `withdraw_note = 'visszavonta'` (`WITHDRAW_NOTE_UNDO`); `/team/registrations` hides such rows, the team card shows no registration. `TeamClientCard.registration.pathChanged` → "Útvonalat váltott", never "Elállt". `TeamClientCard.journeyNext` (`title`, `actorLabel`, `waiting`) = the client's own "Most ez jön"; the panel shows "most ez jön nála: …" everywhere it showed the milestone noun (card, registration, callback drawer, messages).
- **Staff same path.** `POST /team/clients/:id/path` with the current path: 409 "Már ezen az úton van.", except an `inditas` client who still has an adószám + `clearAdoszam: true` → cleared, audit `team.path_changed` (`clearedAdoszam`, note `csak_adoszam_torles`).
- **App.** Preview under the unanswered question ends with `JOURNEY_TEXTS.previewInditas` (+5 steps when starting). Short band whenever the window is < 720 pt high. `KiemeltSor` stacks the pill under the text below 400 pt. First ONYA mention on the mode sheet, the EV card and the meghatalmazás card: "(a NAV online nyomtatványkitöltője)". Főoldal meghatalmazás button: "Megnézem a két lehetőséget" (neutral; the next screen offers both). `SegitsegAllapot` shows the linked callback's `statusText` after a failed attempt (+ "Másik számot adok meg" / "Megadom a jó számot"). Guide steps (stepwise): only the first picture inline ("Mutasd a másik képet"), "Hagyd üresen" / "Ne jelöld be" rows compact with "Miért?", no duplicate "8/14" in the band. `SegitsegCsik` also on the locked EV guide and at the top of both "Mutasd egyben" views. Assist request without a saved phone: the phone field and "Kérem a visszahívást" are in the top card. Only one toast layer while a sheet is open. Zoom viewer fits at 320 pt. "Nem feltétlenül a könyvelőd hív elsőként" (lower case placeholder mid-sentence, app + `visszahivas.igeret`).
- **Pictures / videos.** `sajat_kepek.py`: one-word anchors match whole words (same first letter, ±1 letter; multi-word anchors also same first letter), the NAV form chrome (title + 1–6 step bar, `urlap_kroma`) is excluded from anchors and unions, a marker above the step bar is warned; `tevekenysegek` 1 ends at the block's last own line (`bent`), 2 falls back to "Új tevékenység hozzáadása". Regression: `python _eszkoz/sajat_kepek_proba.py --csak-horgony` (real NAV chrome from the film frame 21.6 s + sketch content, 05/06/12; also part of the full test). Sketches 05/06/12: no tegező helper sentences (moved to captions); 06 alt fixed; step 9 quotes the NAV label "A megadott ingatlanok megfelelnek a feltételeknek." Approval guide 05: marker 2 frames only the "Meghatalmazott" label, caption says the accountant's name stands there. EV video b32: the button marker at the start of the line (+ button-row view); meghatalmazás video m11: closer view of the button row. Re-rendered with the existing voice (0 USD).

---

## 28. Öt új funkció 11-19 (owner order of 2026-11-19 12:25, "Ez mind az 5 kell") – contract

Written 2026-11-19 by the SPEC author for parallel builders (draft `_munka/k6/SPEC28.md`); merged into `kod/SPEC.md` on 2026-11-19 ~20:00 together with **§28.K** (the afternoon/evening orders A–N, prices and fees). **§28 wins over every older section where they differ; §28.K wins over §28** – the places it changes are marked "→ §28.K". It explicitly changes: §26.11 / §27.8 "push never contains amounts" (one exception, §28.2.5), §27.3 assist kinds (5 new change kinds, §28.5.5), §27.4 journey (one optional row, §28.3.4), the fixed 8–20 h push window of `notify.ts` (now a per-user setting, §28.2.3). Everything else stays.

Inputs read for this contract: the current code (`ado-motor/src/engine/year.ts`, `rules/2026.ts`, `types.ts`; backend `services/tax.ts`, `services/navsync.ts`, `notify/notify.ts`, `jobs.ts`, `jobs-tulaj1119.ts`, `routes/client.ts`, `routes/acc.ts`, `routes/me.ts`, `db/schema.ts`; app `app/index.tsx`, `dosszie/[honap]/szamlak.tsx`, `szamla/[id].tsx`, `fiok/index.tsx`, `fiok/ertesitesek.tsx`, `keresek/uj.tsx`, `kepernyok/Utmutato.tsx`; panel `pages/acc/UgyfelAdatlap.tsx` + `ugyfel/*`), SPEC §7, §15–§17, §26, §27, the research `C:/Users/UpgradePC/konyvelo_app/_munka/k6/kedvezmenyek_2026.md` (cited below as **[K]**, with its sources), the owner's raw NAV captures `utmutato_kepek/sajat/vallalkozas_bejelentes/_nyers/` (+ `OLVASS_EL.md`), and engine runs on `kod/ado-motor/dist` (scratch scripts, values quoted in the tests below).

### 28.0 Orders → sections, principles, builders

#### 28.0.1 Orders
| # | Owner's words (11-19, translated) | Where |
|---|---|---|
| 1 | "Ennyit tegyél félre": for every issued invoice and on the home screen, how much to put aside, in one line ("120 000 Ft-os számla – ebből kb. 22 000 Ft-ot tegyél félre"); honest about the minimum bases and the adómentes rész; running "félretenni javasolt" total vs what is already due. | §28.1 |
| 2 | New-invoice notification after the daily NAV sync: push + in-app ("Új kiállított számlád: 120 000 Ft – Bodza Kiadó Kft. Tegyél félre kb. 22 000 Ft-ot."), batched, settings, quiet hours. | §28.2 |
| 3 | 2026 personal allowances of an átalányadós EV: questionnaire (onboarding + Fiók), accountant review in the panel, engine applies them (with tests), client sees the effect. | §28.3 |
| 4 | "Mennyit kerestem?": net income after taxes by month, YTD and a year-end projection, one plain line of explanation. | §28.4 |
| 5 | "Változás-útmutatók": székhely, tevékenység (ÖVTJ), telephely, szüneteltetés (Vállalkozói Ügysegéd, 4-step "adatváltozás" form), tax-data changes via ONYA (T101E); each with "Kérj visszahívást / Intézzük helyetted"; the owner's own NAV screenshots, blurred. | §28.5 |

The owner's "kb. 22 000 Ft" was an illustration. The real 2026 values for a 120 000 Ft invoice at 45 % are 0, about 10 000 or about 31 000 Ft, depending on where the client is in the year (§28.1.1). Every text and test uses the engine's value, never 22 000.

#### 28.0.2 Principles (in addition to §26.0 and §27.0.2)
1. **Every number is an estimate the accountant can stand behind.** It is computed by the same engine and profile that produce the quarterly amounts. Allowances count only after the accountant approved them. Rounding always goes in the client's favour: we round up what to put aside, so it is never too little.
2. **One rule, explained in one line.** The client never sees a rate table. Every amount has a one-liner, and "Miért ennyi?" opens the plain explanation.
3. **The accountant decides the tax.** The client declares, the accountant approves (allowances), files (changes) or approves (quarterly amounts). The app never files anything and never logs in to the NAV.
4. **Data minimisation.** For allowances we ask no child names, birth dates, TAJ or tax IDs. For the client we ask only the birth year and month. Health facts are yes/no flags with explicit consent. Tax IDs are handled by the accountant (§28.3.2).
5. **Tegező, short, plain.** Client copy uses "kiállított számláid" (never "a NAV-tól jött számla", §27.5), "anyukád" when referring to the client's mother, and never mentions AI. Panel copy is staff wording.
6. **Real NAV screenshots only after blurring** every personal value (§28.5.4). No personal value of the owner is ever written into any text file, prompt, report, log, test or commit.
7. **Live data:** never wipe or reseed. Migrations are additive. pg_dump goes to `/srv/kezjegy/_regi/` before any migration. `alex@`, `tulaj@`, `bence.kovacs@` (panel) and `david@demo.kezjegy.test` ("Fendrik Dávid") keep working with their data. The new seed only adds new demo clients (§28.11).
8. **Restricted mode (§26.5):** reserves and earnings are tax data, so they stay locked before activation. The allowance questionnaire and the change guides are open.

#### 28.0.3 State the builders start from (2026-11-19)
- Migrations up to `0013_tulaj1119_tiltas.sql` exist. §28 uses the **next two free numbers** at build time (today `0014`, `0015`); §28.K adds its enum values to the same `0014` file and its tables in `0016` (§28.K.16).
- **§27.11 T1 is still open** (approved quarters are not fixed priors in the engine; `backend/test/seed.test.ts` holds it as `it.fails`). The reserve rule of §28.1 is exact only once T1 lands. B4 does T1 first (§28.0.5).
- The engine has **no allowance logic**: `profile.allowances` only raises the `kedvezmeny_nem_modellezett` warning (`year.ts`), and `szjaCum = 15 % × taxableYTD`. There is no marginal or "félretenni" API, no monthly SZJA and no tax projection ([K] §8).
- The NAV sync (`services/navsync.ts`) runs daily at `NAV_SYNC_HOUR`:30 (default 05:30). It stores invoices and revenue items, then runs `recalcYear` and the flags. It notifies nobody.
- Push quiet hours: a fixed 8–20 h window, only for the `assist_*` and `kamara_reminder` kinds (`notify.ts QUIET_PUSH_KINDS`). There is no user setting.
- Change requests today: `keresek/uj` free-text types `adatvaltozas` / `tevekenysegvaltozas` (reached from Üzenetek and Adataim). There is no guide and no assisted path.

#### 28.0.4 Shared contract (`kod/shared`) – written by the orchestrator (B0) before the builders start
Builders never edit `kod/shared` (§27 rule). B0 adds one block "SPEC §28" at the end of each file, exactly as named in this section and in §28.1–§28.9, runs `npx tsc -p kod/shared/tsconfig.json --noEmit`, and moves the old files to `kod/_regi/shared_src_elotte_ot1119/`. Each builder then runs `node ../shared/scripts/sync-shared.mjs src/_shared`. **Done 2026-11-19 ~20:00–21:00 together with the §28.K block (§28.K.24); copies of the old files are in `kod/_regi/shared_src_elotte_ot1119/`.**
- **`enums.ts`**:
  - Additions: `NOTIFICATION_KINDS` + `invoice_new`, `allowance_submitted`, `allowance_decided`, `allowance_check`, `assist_change_done` (§28.8); `CLIENT_FEATURES` + `felretesz`, `kereset`, `kedvezmenyek`, `valtozas` (+ rules, §28.6.3); `CALLBACK_TOPICS` + `valtozas`, `valtozas_helyettem`; `CALLBACK_SOURCES` + `valtozas_utmutato`, `helyettunk_valtozas`, `kedvezmenyek`, `felretesz`, `kereset`; `ASSIST_KINDS` + the 5 `CHANGE_KINDS` (§28.5.5); `ASSIST_ACTIONS` + `adatok_rendben`, `valtozas_kesz`; `ASSIST_CHECK_ITEMS` + phases `valtozas_adatok`, `valtozas_bejelentes`; `GUIDE_KINDS` + the 5 change kinds (+ `GUIDE_STEP_KEYS`, `GUIDE_VIDEO` = null); `JOURNEY_STEP_KEYS` + `kedvezmenyek`.
  - New constants: `RESERVE_ZONES`, `RESERVE_ESTIMATE_REASONS`, `EARNINGS_BASES`, `ALLOWANCE_KINDS`, `ALLOWANCE_STATUSES`, `ALLOWANCE_GATES`, `ANYAK_JOGCIMEK`, `ALLOWANCE_REJECT_REASONS`, `CHANGE_KINDS`, `CHANGE_TAX_ITEMS`, `CHANGE_UGYSEGED_KINDS`, `CHANGE_UGYSEGED_VALID_UNTIL_DEFAULT = '2026-12-31'`, `QUIET_HOURS_DEFAULT = { enabled: true, from: 20, to: 8 }`, `INVOICE_NOTIFY_RULES` (§28.2), `JOURNEY_NOT_COUNTED = ['kedvezmenyek']`.
- **`bekotes.ts`**: text blocks `RESERVE_TEXTS`, `RESERVE_ZONE_STAFF_LABELS`, `NOTIFY_INVOICE_TEXTS`, `ALLOWANCE_TEXTS`, `ALLOWANCE_LABELS`, `ALLOWANCE_CLIENT_LINES`, `ALLOWANCE_QUESTION_TEXTS`, `ALLOWANCE_REJECT_REASON_LABELS`, `EARNINGS_TEXTS`, `CHANGE_TEXTS`, `CHANGE_FACTS`, `CHANGE_STEP_LIST`, `CHANGE_STATUS_CLIENT_TEXT`, `CHANGE_CONSENT_TEXTS`, `CHANGE_HANDBOOK` (panel), `ASSIST_KIND_LABELS` + `ASSIST_CHECK_LABELS` for the new kinds and items, and the change guide templates (§28.5.3; delivered as `CHANGE_GUIDE_TEMPLATES` + `ALL_GUIDE_TEMPLATES` + `personaliseChangeGuide()`, §28.K.24). New explainers: `felretesz_miert`, `kereset_miert`, `kedvezmenyek`, `csaladi_jarulekkedvezmeny`, `valtozas_hub`, `ugyseged_valtozas`, `onya_t101e`. Every text is the final copy of this section; the content keys are listed in §28.9.
- **Env (B1 `config.ts`, documented in §13 when merged)**: `CHANGE_UGYSEGED_VALID_UNTIL` (default `2026-12-31`), `CHANGE_DONE_BY_FILER_ALLOWED` (default `false`), `INVOICE_NOTIFY_MAX_AGE_DAYS` (default 10), `INVOICE_NOTIFY_MAX_PUSH_PER_DAY` (default 2).
- **`api.ts`**: the DTOs of §28.1.4, §28.2.4, §28.3.2, §28.4.4, §28.5.5 and §28.9, plus optional new fields on existing DTOs: `ClientHome.reserve/earnings/allowancesHint`, `NavInvoiceListItem.reserve`, `Me.notificationSettings`, `AssistCreateInput.change/callback`, `AssistView.change`, `TeamAssistDetail.change/followups`, `AccClientDetail.allowancesPending/reserve/earnings`.
- Expected compile breaks after `sync-shared` (each builder fixes its own): every `Record<NotificationKind|CallbackTopic|CallbackSource|AssistKind|GuideKind|ClientFeature|JourneyStepKey, …>` (backend `KIND_DEFAULTS`, `GUIDE_TITLES`, route→feature map; app `api/minta/*`; panel `lib/labels.ts`).

#### 28.0.5 Builders, file ownership, parallel rules
| Builder | Owns (may edit) | Must not edit |
|---|---|---|
| **B0 orchestrator** | `kod/shared/**` (the §28 blocks only, before the others start), merging this file into `kod/SPEC.md` §28 | code of the packages |
| **B1 backend** | `kod/backend/**` except B4's files below; new files `src/services/felretesz.ts`, `src/services/kereset.ts`, `src/services/kedvezmeny.ts`, `src/services/szamla-ertesites.ts`, `src/services/valtozas.ts`, `src/routes/client-ot1119.ts`, `src/routes/acc-ot1119.ts`, `src/jobs-ot1119.ts`, `src/content/ot1119.ts`, `src/seed/ot1119.ts`; edits in `navsync.ts` (hook), `notify/notify.ts` (quiet hours, push text override, kinds), `routes/me.ts` (settings), `services/assist.ts` + `routes/team-helyettunk.ts` (change kinds), `services/journey.ts` (row `kedvezmenyek`), `db/schema.ts` + migrations; `kod/deploy/seed-ot1119.sh` | `kod/shared`, `kod/ado-motor`, `kod/jogi`, B4's backend files |
| **B2 app** | `kod/app/**` (screens, MINTA server, tests, `scripts/helyi-proba.mjs` seed call) | everything else |
| **B3 panel** | `kod/panel/**` (incl. mock) | everything else |
| **B4 engine + content** | `kod/ado-motor/**` (T1 first, then §28.1.3, §28.3.7, §28.4.3); in the backend ONLY `src/services/tax.ts` (engine input mapping, §28.3.7 e) and `src/services/flags.ts`; `kod/jogi/**` (§28.10); `C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/**` (§28.5.4: blur, annotate, `index.json` per change kind) and `kod/media/utmutato/valtozas_*/**` (only by running B2's normaliser) | `kod/shared`, app/panel source, B1's files |
- Shared files with two owners: `kod/backend/src/services/tax.ts` (B4) calls B1's `allowancesForEngine()` (signature §28.3.7 e). Until B1 delivers it, B4 uses a local stub with the same signature. Re-read before every edit, change only your own region, never reformat.
- **Order inside B4:** (1) T1 of §27.11 with its tests green; (2) the allowance engine (§28.3.7–§28.3.8); (3) `reserveSeries` (§28.1.3); (4) `earningsByMonth` / `projectYear` (§28.4.3); (5) `ENGINE_VERSION` 1.1.0, `npm run check`. B1 builds against the types of §28.1.3 / §28.3.7 / §28.4.3 from the start, using engine stubs until (3)–(4) land.
- Local ports: B1 8851–8859, B2 8831–8839, B3 8841–8849, B4 8861–8869. Logged-in journeys run only on the local harnesses (`npm run build` in backend, `npm run export:web`, `node scripts/helyi-proba.mjs` → `http://127.0.0.1:8791`, `/__helyi/belep?ki=<seed user>`; panel `npm run dev` or `dev:mock`). Never type a password on the live host. Look at every screenshot (headless Chrome, unique `--user-data-dir` per shot).
- **Nobody deploys.** After the builders, the integrator does the following, with the Gardoko health check (`https://45-94-65-74.sslip.io/api/v1/health`) before and after, and shared Caddy files copied to `/srv/appok/_regi/` before any Caddy change: pg_dump → `feltolt.sh` → `up.sh` (the two new migrations) → data step `data.ot1119` → `seed-ot1119.sh` → `feltolt.sh --media` (the change-guide pictures).

---

### 28.1 Order 1 – "Ennyit tegyél félre"

#### 28.1.1 Facts the rule rests on (2026, no allowance; [K] §10, engine runs)
Income share s = 100 % − költséghányad: 0.55 / 0.20 / 0.10 for 45 / 80 / 90 %. SZJA 15 %, TB 18.5 %, szocho 13 %.
| Where the client is in the year | főfoglalkozású | mellékállású | nyugdíjas |
|---|---|---|---|
| A – YTD átalány income ≤ 1 936 800 Ft (adómentes rész) | 0 per extra Ft (but the fixed minimum: 101 682 Ft/month, with garantált bérminimum 117 558 Ft/month, 1 220 184 Ft/year) | 0 | 0 |
| B – above the adómentes rész, quarter base still under the minimum | SZJA only: 15 % × s = 8.25 / 3 / 1.5 % | – | – |
| C – above the adómentes rész and above the minimum (mellékállás: no minimum) | 46.5 % × s = 25.575 / 9.3 / 4.65 % | same | SZJA only: 8.25 / 3 / 1.5 % |
A 120 000 Ft invoice at 45 % (engine): 0 (A); 9 900 → **kb. 10 000** (B, or nyugdíjas); 30 690 = 9 900 SZJA + 12 210 TB + 8 580 szocho → **kb. 31 000** (C). Thresholds with even revenue: the adómentes rész is used up at 3 521 455 / 9 684 000 / 19 368 000 Ft of yearly revenue. A főfoglalkozású's base goes above the minimum at 10 564 364 / 29 052 000 / 58 104 000 Ft (garantált: 11 664 000 / 32 076 000 / 64 152 000 Ft). Front-loading costs more: 8 976 000 Ft received in February costs 2 310 138 Ft, the same amount spread evenly costs 1 670 184 Ft (Tbj. 40. § (2): later quarters subtract the bases actually used, including the minimum). HIPA (sávos) and the 20 M Ft ÁFA limit are steps, not per-forint rates. They are shown as separate lines and are never put on an invoice.

#### 28.1.2 The rule (binding)
1. **L(S)** = the engine's whole-year SZJA + TB + szocho of the invoice's tax year: the sum of `totalHuf` of Q1–Q4 from `calculateYear` with `asOf = YYYY-12-31`, the client's current profile (status, ratio, guaranteedMinimum, insurance breaks, priorOverrides, **approved** allowances, and once T1 has landed the approved quarters as fixed priors), and only the revenue items in the set S. Csjk (§28.3.7) is already netted out of TB.
2. **Order** = the receipt date of the revenue items of that tax year (`received_on`), then their arrival (`revenue_items.created_at`), then `id`. The tax year is the year of `received_on` (pénzforgalmi). An invoice issued in December and paid in January belongs to next year. *(k6c3, 2026-11-20: was arrival order only. A month typed in by hand later then pushed an earlier-dated invoice out of the adómentes rész it really fell into – Réka's September invoice said "még az adómentes részben jársz" while her Főoldal said "júliusban elérted". The order now follows the money, as the engine does; a later, earlier-dated item may change the reserves of the items after it – rule 9.)*
3. **Raw reserve** of item i = L(items ≤ i) − L(items < i). Telescoping: Σ raw + L(∅) = L(all), checked by the engine test (§28.1.3). L(∅) is the fixed minimum (1 220 184 Ft for a full-year főfoglalkozású; 0 for mellékállású and nyugdíjas).
4. **Estimated receipt** (`received_on_estimated`, i.e. the payment deadline): we also compute the raw value with `receivedOn` moved to the first day of the next quarter when that is still in the same year, and **take the larger one** (conservative). The sum may then exceed L(all) – allowed, never less.
5. **Rounding:** raw > 0 → **up** to the next 1 000 Ft; raw < 0 (storno, modification) → **towards zero** to 1 000 Ft (we give back less than computed); raw = 0 → 0.
6. **Parts** (for the chips and "Miért ennyi?"): ΔSZJA, ΔTB (after csjk), Δszocho of the same difference (unrounded).
7. **Zone** (`RESERVE_ZONES`):
   - `adomentes` – raw = 0 and YTD income after this item ≤ 1 936 800.
   - `nem_novel` – raw = 0 for another reason, e.g. a mother's SZJA exemption plus the főfoglalkozású minimum.
   - `csak_szja` – SZJA > 0, TB = szocho = 0.
   - `teljes` – SZJA > 0 and TB or szocho > 0.
   - `kedvezmeny` – SZJA = 0, TB or szocho > 0 (an approved allowance covers the SZJA).
   - `sztorno` – raw < 0.
   - `nincs_adat` – no profile or no rules for the year.
   - Flag `crossesTaxFree` = the YTD income passes 1 936 800 with this item.
8. The fixed minimum (L(∅)) and HIPA are **never** put on an invoice. They are home-card lines (§28.1.6).
9. Recomputed whenever the inputs change (new revenue, edited `received_on`, profile change, allowance decision, T1 approval). A reserve already sent in a notification is not "corrected" by a message. The invoice screens always show the current value.

#### 28.1.3 Engine API (B4, `kod/ado-motor/src/engine/reserve.ts`, exported from `index.ts`)
```ts
export type ReserveZone = 'adomentes' | 'nem_novel' | 'csak_szja' | 'teljes' | 'kedvezmeny' | 'sztorno' | 'nincs_adat';
export interface ReserveItemInput extends RevenueItemInput { id: string; /** sortable arrival key: ISO created_at + id */ arrivalKey: string }
export interface ReserveLine {
  id: string; seq: number;            // 1-based arrival position in the year
  rawHuf: number; reserveHuf: number; // §28.1.2 rule 5
  szjaHuf: number; tbHuf: number; szochoHuf: number;
  zone: ReserveZone; crossesTaxFree: boolean; estimated: boolean;
}
export interface ReserveSeries {
  year: number; baseHuf: number /* L(∅) */; totalHuf: number /* L(all) */;
  /** Per month 1..12 of the empty-year run: TB + szocho of the fixed minimum (0 when none). */
  fixedByMonthHuf: number[];
  lines: ReserveLine[];
  warnings: EngineWarning[];
}
/** items: the year's revenue items (receivedOn in `profile.year`); the order of `lines` = arrival order. Pure; n + 1 (+ estimated) calculateYear runs. */
export function reserveSeries(profile: TaxProfileInput, items: ReserveItemInput[]): ReserveSeries;
```
Tests (B4, `test/felretesz.test.ts`, values from engine runs on 11-19):
| # | Case (2026, 45 %) | Expected |
|---|---|---|
| R1 | főfogl., no other revenue, 120 000 received 01-15 | raw 0, zone `adomentes`, base 1 220 184 |
| R2 | nyugdíjas, 1 000 000 on the 10th of Jan–Nov, + 120 000 on 12-15 | raw 9 900 (SZJA 9 900), reserve 10 000, `csak_szja` |
| R3 | mellékállású (and főfogl.), 1 000 000 every month Jan–Dec, + 120 000 on 12-15 | raw 30 690 = 9 900 + 12 210 + 8 580, reserve 31 000, `teljes` |
| R4 | főfogl., 500 000 every month, + 120 000 on 12-15 | raw 9 900, `csak_szja` (zone B) |
| R5 | főfogl., one item 8 976 000 on 02-10 | raw 1 089 954 (= 2 310 138 − 1 220 184), reserve 1 090 000 |
| R6 | telescoping, items 01-20 300 000 · 02-05 1 200 000 · 03-30 800 000 · 05-12 2 500 000 · 07-01 400 000 · 09-15 3 000 000 · 11-02 120 000 | főfogl. raws 0,0,0,105 480,33 000,247 500,9 900 (Σ + 1 220 184 = 1 616 064 = L(all)); mellékállású 0,0,0,326 988,102 300,767 250,30 690 (Σ = 1 227 228); nyugdíjas = főfogl. raws (Σ = 395 880); item 4 has `crossesTaxFree` |
| R7 | mellékállású, even year + storno −120 000 on 12-15 | raw −30 690, reserve −30 000, `sztorno` |
| R8 | R3 with the item marked `estimated` and receivedOn 12-15 | same (no next quarter in the year); an item on 03-20 estimated → max(Q1, Q2-shifted) |
| R9 | `csaladi` 2/2 approved (as T15 of §28.3.8: the year's frame 6 399 840 > taxable 4 663 200), mellékállású, even year + 120 000 in December | SZJA part 0 → zone `kedvezmeny`, raw = TB + szocho = 12 210 + 8 580 = 20 790, reserve 21 000 |
| R10 | property test: for random series, Σ raw (estimated off) + base = total | always |

#### 28.1.4 Backend (B1, `services/felretesz.ts`)
- **Cache:** table `revenue_reserves` (one row per revenue item) and `reserve_years` (per client and year: `inputs_hash`, base, total, `fixed_by_month`), §28.7. `inputs_hash` = sha256 of the canonical engine input (profile incl. approved allowances, the revenue items with their arrival keys) plus the engine version. **Lazy:** every read (`home`, invoice list or detail, `/client/reserve`, panel) calls `ensureReserves(db, clientId, year)`. It compares the hash and recomputes only when needed (n + 1 engine runs, ≤ 50 ms for 300 items), in one transaction (delete + insert of that client-year). No trigger and no edit in B4's files.
- `reserveView(line, ctx)` renders the one-liner from content (§28.1.5). `reserveCard(db, clientId, today)` builds the home card (§28.1.6).
- DTOs (`api.ts`):
```ts
export interface InvoiceReserveView {
  year: number; reserveHuf: number; rawHuf: number;
  parts: { szjaHuf: number; tbHuf: number; szochoHuf: number };
  zone: ReserveZone; crossesTaxFree: boolean; estimated: boolean; nextYear: boolean;
  line: string;              // "120 000 Ft-os számla – ebből kb. 31 000 Ft-ot tegyél félre."
  partsText: string | null;  // "SZJA, TB-járulék, szocho"
  thresholdText: string | null; // crossesTaxFree sentence
}
export type ReserveEstimateReason = 'fizetesi_hatarido' | 'profil_nincs_megerositve' | 'kedvezmeny_jovahagyasra_var' | 'szabalyok_tervezet' | 'elozo_konyvelo';
export interface ReserveCard {
  year: number;
  keepNowHuf: number;     // max(0, A − B), rounded up to 1 000
  accruedHuf: number;     // A
  invoicesHuf: number;    // Σ reserveHuf of items received ≤ today
  fixedHuf: number;       // Σ fixedByMonth of months ≤ current month
  fixedMonthlyHuf: number;// the current month's fixed amount (0 = not shown)
  hipaHuf: number;        // HIPA elapsed share
  hipaAnnualHuf: number | null;
  dueOrPaidHuf: number;   // B
  nextDue: { dueDate: ISODate; label: string } | null;
  estimateReasons: { code: ReserveEstimateReason; text: string }[];
  sentence: string; detail: string; footnote: string;
}
export interface ReserveListItem { revenueItemId: string; navInvoiceId: string | null; title: string; sub: string; receivedOn: ISODate; amountHuf: number; reserve: InvoiceReserveView }
export interface ReserveView { card: ReserveCard; months: { month: number; label: string; items: ReserveListItem[] }[] }
```
- Endpoints: `GET /client/home` → `reserve: ReserveCard | null` (null while restricted or without profile). `GET /client/nav-invoices?month=` → each item + `reserve?`. `GET /client/nav-invoices/:id` → `reserve`. `GET /client/reserve?year=` → **ReserveView**. `GET /acc/clients/:id/reserve?year=` → ReserveView, which also lists manual (`kezi`) items. The client's restricted mode returns 403 `locked_until_active` (feature `felretesz`).

#### 28.1.5 Per invoice – what the client sees (B2; texts `RESERVE_TEXTS`, content `felretesz.*`)
- **Invoice list** (`dosszie/[honap]/szamlak`): each row keeps "{invoiceNumber} · {date}" and gets a second sub-line in secondary text: `listLine`. Keys and texts:
  - `reserveHuf > 0`: "Tegyél félre kb. {felre} Ft-ot"
  - `adomentes`: "Ebből most nem kell félretenned"
  - `nem_novel`: "Nem növeli az adódat"
  - `sztorno`: "Kb. {felre} Ft-tal kevesebbet kell félretenned"
  - `nincs_adat`: nothing.
  The header sub-line adds `monthSum` after `INVOICE_WORDING.monthSub`: "Ebből kb. {felre} Ft-ot tegyél félre."
- **Invoice detail** (`szamla/[id]`): a new first block above "Összeg". It is a white sheet, Szakasz "Ennyit tegyél félre", with the 3D `szamlaszam` 36 pt icon on the left (no circle behind it). The one-liner is 17 pt / 600:
  - `teljes`, `csak_szja`, `kedvezmeny`: "{osszeg} Ft-os számla – ebből kb. {felre} Ft-ot tegyél félre."
  - `adomentes`: "{osszeg} Ft-os számla – ebből most nem kell félretenned: még az adómentes részben jársz."
  - `nem_novel`: "{osszeg} Ft-os számla – ez nem növeli az idei adódat."
  - `sztorno`: "Sztornó: {osszeg} Ft. Kb. {felre} Ft-tal kevesebbet kell félretenned."
  - `nextYear` (any zone): append " Ha jövőre fizetik ki, a jövő évi adódba számít."
  - `nincs_adat`: "Ehhez a számlához még nem tudjuk kiszámolni, mennyit tegyél félre."
  Under it come the parts chips (`partsText`): `csak_szja` → "SZJA"; `teljes` → "SZJA, TB-járulék, szocho"; `kedvezmeny` → "TB-járulék, szocho – SZJA-t a kedvezményed miatt nem fizetsz". When `crossesTaxFree`, the amber line `thresholdText` follows: "Ezzel a számlával elfogyott az adómentes részed. Innentől minden számládból félre kell tenned." For a főfoglalkozású in `adomentes`, a second secondary line: "A havi fix járulékot ({havi} Ft) ettől függetlenül fizeted." Estimated: the 13 pt line "Becslés: a fizetési határidővel számoltunk. Ha később fizetnek, változhat." Link **"Miért ennyi?"** opens the sheet below.
- **"Miért ennyi?" sheet** (explainer `felretesz_miert`, the same visual language as "Hogyan jött ki?"): rows "SZJA kb. {szja} Ft", "TB-járulék kb. {tb} Ft", "Szocho kb. {szocho} Ft", "Összesen, felfelé kerekítve: kb. {felre} Ft". Then the plain text (content `felretesz.miert.szoveg`, final):
  > Annyit mutatunk, amennyivel ez a számla megnöveli az idei adódat. Ezért nem mindig ugyanannyi:
  > • Az első 1 936 800 Ft jövedelmed adómentes. Amíg ebben jársz, a számláidból nem kell félretenned.
  > • Utána a számla {jovedelemArany}%-a számít jövedelemnek, ennek 15%-a SZJA.
  > • Ha a jövedelmed már a havi minimum fölött van, TB-járulék (18,5%) és szocho (13%) is jár rá.
  > • A járulékot negyedévente számoljuk, ezért az év elején egy nagy számla többe kerülhet, mint ugyanannyi bevétel elosztva.
  > • Főállásban a havi fix járulékot akkor is fizeted, ha nincs bevételed. Ezt a Főoldalon külön mutatjuk.
  > Felfelé kerekítünk ezresre, hogy inkább maradjon pénzed, mint hogy hiányozzon. A befizetendő összeget negyedévente {firstName} hagyja jóvá.

  The estimate reasons follow as amber lines (§28.1.7).

#### 28.1.6 Home card "Félretenni" (B2 renders, B1 computes)
- Position on the Főoldal: after "{firstName} kéri", before "Idei kereteid". It is not on the first screen; that screen still ends with the quick actions (TERV §5).
- Formulas (year = the current year; "today" in Budapest):
  - **A** = `invoicesHuf` + `fixedHuf` + `hipaHuf`. `hipaHuf` = this year's HIPA estimate (`YearResult.hipa.annualHuf`, or the approved HIPA amount if the accountant set one) × elapsed active days / active days. It is 0 when HIPA is `nincs`. With `altalanos` the HIPA line shows "{firstName} számolja" and adds 0.
  - **B** = Σ over the year's quarters that ended before today: the approved total if approved, otherwise the engine estimate. Plus the HIPA periods with `dueDate ≤ today`: the approved amount, or the prior-year advance if known.
  - **keepNow** = max(0, A − B), rounded up to 1 000. If A − B ≤ 0 → the "minden megvan" state.
- Card (white sheet, Szakasz "Félretenni" + "Mi ez?" → explainer `felretesz_miert`):
  - Big line (22 pt / 700, tabular figures): `sentence` = "Most kb. {keepNow} Ft legyen félretéve az adódra." In the zero state: "Most nincs mit félretenned."
  - `detail` (15 pt secondary) = "Az idei számláid, a havi járulék és az iparűzési adó után eddig kb. {A} Ft adóval kell számolnod. Ebből {B} Ft a lezárt negyedévekre esik: azt már befizetted, vagy most kell befizetned." In the zero state: "Ami eddig összegyűlt, az a lezárt negyedévekre esik, és azt már befizetted, vagy most kell befizetned."
  - Rows (`Sor`, no icons, amounts right):
    - "Az idei számláid után" kb. {invoicesHuf}
    - only when `fixedMonthlyHuf > 0`: "Havi fix járulék eddig" {fixedHuf}, sub "{fixedMonthlyHuf} Ft havonta, bevételtől függetlenül"
    - only when HIPA: "Iparűzési adó eddig" kb. {hipaHuf}, sub "évente kb. {hipaAnnualHuf} Ft"
    - "Lezárt negyedévek" {B}, sub "befizetted, vagy most fizeted"
  - Link row: "Számlánként megnézem" → `/felretesz`.
  - Footnote (13 pt): "Becslés. A befizetendőt negyedévente {firstName} hagyja jóvá." Below it the estimate reasons.
- **`/felretesz` screen** (new route): blue band with the same big line and detail. Then one white sheet per month, newest first: rows = customer name (or "Magánszemély") · invoice number; right = invoice amount; sub = the `listLine`. A manual item shows "Kézi tétel: {description}". Tapping opens `/szamla/:id` (manual items have no detail). At the bottom: "Elakadtál? Kérj visszahívást" (source `felretesz`, topic `ado_befizetes`).
- Empty year: "Idén még nincs kiállított számlád. Ha lesz, itt látod, mennyit tegyél félre."

#### 28.1.7 When it is only an estimate (always "kb.", plus these reasons; `RESERVE_ESTIMATE_REASONS`)
| Code | When | Client text |
|---|---|---|
| `fizetesi_hatarido` | any item of the year has `received_on_estimated` (and on that invoice) | "A fizetési határidővel számoltunk. Ha később fizetnek, változhat." |
| `profil_nincs_megerositve` | `cost_ratio_source = 'ugyfel_javaslat'` | "{firstName} még nem erősítette meg az adózási adataidat." |
| `kedvezmeny_jovahagyasra_var` | an allowance in `javasolt` or `kerdes` | "A kedvezményeidet {firstName} még nem hagyta jóvá, ezért ez még nem számol velük." |
| `szabalyok_tervezet` | rules `draft` (2027) | "A jövő évi szabályok még nem véglegesek." |
| `elozo_konyvelo` | `priorOverrides` set | "Az év elejét az előző könyvelőd számolta. Ezzel együtt becsüljük." |

#### 28.1.8 Relation to the accountant-approved amounts (text for the FAQ and the panel help)
- What the client must pay is always the **approved quarterly amount** (hero, letter, payment items). The reserve is a saving guide, never a payment order. Wording: never "fizetendő", always "tegyél félre".
- The reserves use the same engine and profile as the quarterly estimate. When the accountant approves a quarter unchanged, the reserves of that quarter's invoices are inside it. When he overrides a quarter, B uses his amount and A stays the engine's. `keepNow` therefore absorbs the difference by itself.
- The accountant never edits a single reserve. If a reserve looks wrong, the profile or the revenue item is wrong, and he fixes that.

#### 28.1.9 Panel (B3)
- The Kiállított számlák and Bevételek tabs get a column **"Félretenni"** (`reserveHuf`, "—" for `nincs_adat`). The tooltip shows the parts and the zone in staff words (`RESERVE_ZONE_STAFF_LABELS`: "adómentes részben", "nem növeli", "csak SZJA", "SZJA + járulék", "kedvezmény fedi az SZJA-t", "sztornó", "nincs adat").
- The Áttekintés tab gets a small sheet **"Ezt látja az ügyfél"**: "Félretenni most: kb. {keepNow} Ft" and "Idén eddig maradt neki: kb. {ytdNet} Ft" (§28.4). It links to the client view of `/acc/clients/:id/reserve` (a read-only table by month).

---

### 28.2 Order 2 – new-invoice notification

#### 28.2.1 Trigger, eligibility, dedupe (B1, `services/szamla-ertesites.ts`, called from `navsync.ts`)
- `storeInvoice` returns the new `nav_invoices.id` (or null) instead of a boolean. `syncClient` collects the ids of the run. After the successful run (`recalcYear` + `computeFlags`), it calls `notifyNewInvoices(deps, clientId, ids)`. A failed run with `added > 0` calls it too, for the invoices stored.
- An invoice is notified only if **all** hold. Otherwise `nav_invoices.notify_state` is set to the reason and nothing is sent:
  1. `operation = 'CREATE'` (else `kihagyva_modositas`; MODIFY/STORNO change the reserves silently).
  2. The client's `lifecycle = 'aktiv'` (else `kihagyva_zarolt`; tax data are locked before activation).
  3. It is not the client's first successful sync (`nav_credentials.last_sync_status` was null before the run; else `kihagyva_elso_szinkron`, the backfill).
  4. `issue_date ≥ today − INVOICE_NOTIFY_RULES.maxAgeDays` (10) and `created_at ≥ system_state['ot1119.invoice_notify_from']` (else `kihagyva_regi`).
- **Dedupe:** claim with `UPDATE nav_invoices SET notify_state = 'kuldve', notified_at = now() WHERE id = ANY($ids) AND notify_state IS NULL RETURNING id`. Only claimed ids are notified, so a re-run or a parallel manual sync never double-sends.
- The reserve of each claimed invoice comes from `ensureReserves` (§28.1.4) after the recalc.

#### 28.2.2 Batching (one message per run, at most `INVOICE_NOTIFY_RULES.maxPushPerDay` = 2 pushes per client per Budapest day)
- 1 invoice → one notification (variant by zone). 2+ invoices of the same run → **one** notification (variant `tobb`) with `data.items = [{ navInvoiceId, amountHuf, reserveHuf }]`.
- **Fold-in:** suppose an `invoice_new` row of the user exists from the last 20 h whose push has not gone out yet (`pushSentAt IS NULL` and `wantPush`, e.g. waiting for quiet hours) and is unread. Then the new invoices are added to that row: the title, body, `data.items` and counts are re-rendered, `readAt` becomes null, and still only one push goes out. This mirrors `document_processed`.
- After 2 pushes on a Budapest day, further rows are created with `noPush` (in-app only, the e-mail rule unchanged).
- Link: single → `/szamla/{navInvoiceId}`; several → `/felretesz`.

#### 28.2.3 Settings and quiet hours (B1 backend, B2 app)
- New table `user_notification_settings` (§28.7) with `quiet_enabled` (default true), `quiet_from` (default 20), `quiet_to` (default 8), `push_show_amounts` (default true). If the row is missing, the defaults apply.
- `pushNotBefore(now, settings)` replaces the fixed window: if quiet hours are enabled and now (Budapest) is inside [from, to) (wrapping midnight when from > to), push waits until the next `to`:00. **It applies to every client push kind except `callback_calling`.** It replaces `QUIET_PUSH_KINDS`. Staff never get push. In-app rows and e-mails are never delayed.
- The 05:30 sync therefore pushes at 08:00 by default. The in-app row exists at once.
- The per-kind toggles stay (`notification_prefs`): `invoice_new` has the default push on, e-mail off. `PATCH /me` accepts `notificationSettings: { quietEnabled, quietFrom (0–23), quietTo (0–23), pushShowAmounts }`. `GET /me` returns `notificationSettings`. The `notificationPrefs` max array length goes from 40 to 80.
- **App, Fiók → Értesítések** (B2):
  - A new first block "Csendes idő": a toggle "Éjjel ne szóljon a telefon" with sub "{from}:00 és {to}:00 között nem küldünk telefonos értesítést. Az appban ilyenkor is megjelenik." and two hour pickers "Ettől" / "Eddig" (shown when on).
  - A new group "SZÁMLÁK" with the row `invoice_new`: "Új kiállított számla", sub "Amikor letöltöttük a NAV rendszeréből, és megmutatjuk, mennyit tegyél félre."
  - Under it the toggle "Összeg és vevő a telefonos értesítésben", sub "Ha kikapcsolod, a zárolt képernyőn csak annyi látszik: új kiállított számlád érkezett."
  - Groups "KEDVEZMÉNYEK" (`allowance_decided`, `allowance_check`) and, under "Intézzük helyetted", `assist_change_done` (texts in §28.8).

#### 28.2.4 Texts (content `notif.invoice_new.<variant>.title|body`, `email.invoice_new.subject|body`; placeholders `{osszeg}` formatted "120 000", `{vevo}`, `{felre}`, `{n}`)
| Variant | When | Title | Body |
|---|---|---|---|
| (default) | 1 invoice, `reserveHuf > 0` | "Új kiállított számlád: {osszeg} Ft" | "{vevo}. Tegyél félre kb. {felre} Ft-ot." |
| `kuszob` | 1 invoice, `crossesTaxFree` | "Új kiállított számlád: {osszeg} Ft" | "{vevo}. Tegyél félre kb. {felre} Ft-ot. Elfogyott az adómentes részed." |
| `adomentes` | 1 invoice, zone `adomentes` / `nem_novel` | "Új kiállított számlád: {osszeg} Ft" | "{vevo}. Ebből most nem kell félretenned." |
| `tobb` | n ≥ 2, Σ reserve > 0 | "{n} új kiállított számlád: összesen {osszeg} Ft" | "Tegyél félre kb. {felre} Ft-ot. Megnézem, melyik mennyi." |
| `tobb_adomentes` | n ≥ 2, Σ reserve = 0 | "{n} új kiállított számlád: összesen {osszeg} Ft" | "Ezekből most nem kell félretenned." |
| `rejtett` (push only) | `push_show_amounts = false` | "Új kiállított számlád érkezett" / "{n} új kiállított számlád érkezett" | "Nézd meg, mennyit tegyél félre." |
- `{vevo}` = `customer_name` trimmed to 40 characters. If the customer is a private person (no customer tax number, or the customer VAT status is PRIVATE_PERSON) or the name is empty → "Magánszemély". **A private person's name is never put in a push.**
- E-mail (off by default): subject = the title, body = the in-app body + "Az összes számlád és a félreteendő összeg az alkalmazásban: {appUrl}/felretesz".
- B1 adds `NotifyInput.pushVariant?: string`. The dispatcher sends `data.pushTitle/pushBody` when present (rendered from that variant). Otherwise it sends the row's title/body.

#### 28.2.5 Privacy exception to §26.11 / §27.8 [OWNER decided by the order; JOGI note]
`invoice_new` is the only kind whose push may contain amounts. These are the client's own business data, shown on his own phone, as the owner ordered. Push never contains a private person's name, phone numbers or tax ids. The client can switch amounts off (`push_show_amounts`), and quiet hours apply. The default is ON (owner's order) – wait item 30 (§28.13).

---

### 28.3 Order 3 – personal allowances 2026

#### 28.3.1 Facts the product relies on (2026; sources [K] §1–§4)
| Allowance (`ALLOWANCE_KINDS`) | Who (2026) | Amount | Months | Reduces |
|---|---|---|---|---|
| `anya30` 30 év alatti anyák | a woman born **1996-01-01 or later**, entitled to családi kedvezmény for her own or adopted child or a fetus (from day 91) | **no cap**: the whole taxable átalány income of eligible months | months with that családi kedvezmény entitlement | SZJA only |
| `anyak` 2 / 3 / 4+ gyermekes anyák (`ANYAK_JOGCIMEK` `ket`, `harom`, `negyplusz`) | own or adopted children for whom she gets családi pótlék, or got it for ≥ 12 years, or it ended with the child's death. `ket`: born **1986 or later** in 2026 (1977 in 2027, 1968 in 2028, everyone from 2029). `harom`: any age (since 2025-10-01). `negyplusz`: any age | **no cap** | from the 1st of the month she qualifies until the last month she qualifies in full (29/D. § (4)) | SZJA only |
| `fiatal25` 25 év alattiak | every month before the 25th birthday, the last being the birthday month; EGT or neighbouring citizen | **715 765 Ft per month** (107 365 Ft tax), unused months do not carry over | eligible months | SZJA only |
| `szemelyi` személyi | súlyosan fogyatékos (335/2009. Korm. r.), rokkantsági járadék or fogyatékossági támogatás | **107 600 Ft/month** (16 140 Ft tax) | months with ≥ 1 day of the condition | SZJA only |
| `elso_hazasok` első házasok | a couple where at least one marries for the first time | **33 335 Ft/month** for the couple, split as they decide | from the month after the wedding, max 24 months (both under 25: from the month after one turns 25) | SZJA only |
| `csaladi` családi | entitled to családi pótlék (+ non-entitled spouse in the household), fetus from day 91, etc. | per kedvezményezett eltartott per month: **133 340** (1 eltartott), **266 660** (2), **440 000** (3+); **+133 340** per tartósan beteg / súlyosan fogyatékos child; a felváltva gondozott child counts at **50 %** | months of entitlement | SZJA, then the unused part × 15 % from TB (csjk) |
| `csed_gyed` (info item) | táppénz, CSED, GYED (or another benefit the accountant classifies) | – | the benefit months | no SZJA effect; the accountant records it as **kieső idő** (insurance break `kieso`): no minimum járulék |
Common rules: the **adómentes rész comes first**, and allowances reduce only the taxable átalány income ([K] §2.1). The **order** is anya30 → anyak → (CSED/GYED, not an EV item) → fiatal25 → személyi → első házasok → családi ([K] §2.2). Frames **accumulate within the year** for the advance (Szja tv. 49. § (1)). **No allowance reduces szocho.** Only családi reduces TB, through csjk = 15 % of the unused frame, capped by TB. Under the átalányadó-specific rules, csjk is capped by the TB on the minimum base `min(minimum, that month's income)` in a minimum month, and is 0 in a month with no income ([K] §3.10). A nyugdíjas EV gets no csjk. In-year csjk requires the SZJA advance to be declared in the 2658 too (49. § (6)). Over-claiming above 10 000 Ft → 12 % különbözeti bírság, which is why only approved allowances count.

#### 28.3.2 Data model, approval, GDPR
- **`allowance_answers`** (one row per client and tax year): `gate` (`ALLOWANCE_GATES`: `lehet`, `nem_jar`, `kesobb`), `answers` jsonb (**AllowanceAnswers**, below), `version` (+1 on every submit), `submitted_at`, `health_consent_at` + `health_consent_version`.
- **`client_allowances`** (one row per client, year and kind): the server's **proposal** plus the accountant's **decision**.
  - `status` (`ALLOWANCE_STATUSES`): `javasolt`, `kerdes`, `jovahagyva`, `elutasitva`, `visszavonva`.
  - Other columns: `months` smallint[] (1–12), `params` jsonb (**AllowanceParams**), `in_year` (applied in the quarterly advance; default true; false = only in the 26SZJA return), `proposal` jsonb (snapshot of what the answers implied), `answers_version`, `decided_by/at`, `reject_reason` (`ALLOWANCE_REJECT_REASONS`: `kor`, `nem_jogosult`, `mas_veszi_igenybe`, `nincs_jovedelem`, `igazolas_hianyzik`, `egyeb`), `client_text` (≤ 500, shown to the client), `staff_note` (≤ 1000, never shown).
  - **Only `jovahagyva` + `in_year` rows reach the engine.**
  - **Effective dates** are the approved months of that year. Year-end rollover: §28.3.9.
- On every submit the server recomputes the proposal (§28.3.3):
  - kinds no longer implied → status `visszavonva`;
  - new kinds → `javasolt`;
  - an approved kind whose proposal changed (months or params) → back to `javasolt` with the old decision kept in `params_prev`. It is applied until the accountant decides again.
  - Notification `allowance_submitted` to the accountant.
- **Minimisation (binding):** **no** names of children or the spouse, **no** birth dates of children, **no** TAJ, **no** tax IDs in the app or the questionnaire. Children are anonymous cards ("1. gyermek"). The client gives only **birth year + month** (enough for every 2026 age rule). The tax IDs of children and spouse are required by law in the 26SZJA return (29/B. § (2), 29/C. § (6), 29/D. § (6)). The accountant collects them **later, outside the questionnaire**, with an ordinary request ("Kérés: a gyermekeid adóazonosító jele – töltsd fel az adóigazolványuk képét", document category `igazolas`, visibility `csak_konyvelo`). They are never stored as structured fields.
- **Health data** (tartósan beteg child, own személyi kedvezmény) is GDPR Art. 9 data. We store only yes/no and the months, never a diagnosis. Health answers are saved **only with the explicit consent box** (§28.3.4 K8); without it they are dropped and the client sees why. Consent is withdrawn by answering "nem" (the server clears the health flags and sets `health_consent_at = null`). Legal basis [JOGI]: GDPR 6. cikk (1) b) (the contract), and for health facts 9. cikk (2) a) explicit consent. Retention: like the tax documents of the year [JOGI/OWNER]. Medical documents are **not uploaded** in the app (the law says keep, not attach); the client keeps them.
- **Access:** the client himself, his accountant, admin. **The csapat role gets 404** (tax data, §26.4). Audit actions: `allowance.answers_submitted` (details: version, kinds, hash – never answers), `allowance.decided` (kind, status, months count), `allowance.health_consent` (given / withdrawn).
- DTOs (`api.ts`):
```ts
export type AllowanceKind = 'anya30' | 'anyak' | 'fiatal25' | 'szemelyi' | 'elso_hazasok' | 'csaladi' | 'csed_gyed';
export type AllowanceStatus = 'javasolt' | 'kerdes' | 'jovahagyva' | 'elutasitva' | 'visszavonva';
export interface AllowanceChildAnswer {
  potlek: 'most' | 'tizenket_ev' | 'elhunyt' | 'nem'; // családi pótlék now / ≥ 12 years in the past / ended by the child's death / no
  sajat: boolean;          // own or adopted (mothers' allowances)
  tartosBeteg: boolean;    // health flag (needs healthConsent)
  felvaltva: boolean;      // alternating care (50 %)
  potlekKezdeteHo: string | null; // 'YYYY-MM' if it started this year (birth, adoption)
  potlekVegeHo: string | null;    // 'YYYY-MM' if it ends this year (school finished)
}
export interface AllowanceAnswers {
  birthMonth: string | null;                 // 'YYYY-MM'
  children: AllowanceChildAnswer[];          // 0..12
  otherDependants: number;                   // eltartott but not kedvezményezett, 0..9
  pregnancy: { dueMonth: string } | null;    // expected birth 'YYYY-MM'
  mother: boolean | null;
  csaladiWho: 'en' | 'par' | 'kozosen' | null;
  csaladiSharePct: number | null;            // 10..90 when 'kozosen'
  csjkWish: 'igen' | 'konyvelo_donti' | null;
  marriage: { month: string; first: boolean; who: 'en' | 'par' | 'kozosen' } | null;
  disability: { fromMonth: string | null; basis: 'orvosi_igazolas' | 'rokkantsagi_jaradek' | 'fogyatekossagi_tamogatas' } | null;
  benefit: { fromMonth: string; toMonth: string | null } | null; // táppénz / CSED / GYED
  healthConsent: boolean;
  note: string | null;                       // ≤ 500, for the accountant
}
export interface CsaladiMonthParam { month: number; eltartott: number; children: { felvaltva: boolean; tartosBeteg: boolean }[]; sharePct: number }
export interface AllowanceParams { anyakJogcim?: 'ket' | 'harom' | 'negyplusz'; elsoHazasokMonthlyHuf?: number; csaladi?: CsaladiMonthParam[]; csjkInYear?: boolean }
export interface AllowanceItemView {
  kind: AllowanceKind; label: string; line: string; status: AllowanceStatus; statusText: string;
  months: number[]; monthsText: string;          // "január–december", "július–december"
  inYear: boolean; effectYearHuf: number | null; // approved only: SZJA + csjk saved this year (estimate)
  question: string | null; rejectText: string | null;
}
export interface AllowanceState {
  year: number; gate: 'lehet' | 'nem_jar' | 'kesobb' | null; answers: AllowanceAnswers | null; version: number;
  submittedAt: ISODateTime | null; items: AllowanceItemView[]; pendingCount: number;
  savedYtdHuf: number | null; savedYearHuf: number | null; documentsToKeep: string[]; canEdit: boolean;
}
export interface AllowanceAnswersInput { year: number; answers: AllowanceAnswers; submit: boolean }
export interface AllowanceGateInput { year: number; gate: 'lehet' | 'nem_jar' | 'kesobb' }
// staff
export interface AccAllowanceItem extends AllowanceItemView {
  params: AllowanceParams; paramsPrev: AllowanceParams | null;
  proposal: { months: number[]; params: AllowanceParams; reasons: string[] };
  decidedBy: string | null; decidedAt: ISODateTime | null; staffNote: string | null; warnings: string[];
  documents: { label: string; keep: boolean }[];
}
export interface AccAllowanceView { year: number; answers: AllowanceAnswers | null; version: number; submittedAt: ISODateTime | null; healthConsentAt: ISODateTime | null; legacy: { kind: string; note?: string }[]; items: AccAllowanceItem[] }
export interface AllowanceDecisionInput { status: 'jovahagyva' | 'kerdes' | 'elutasitva'; months?: number[]; params?: AllowanceParams; inYear?: boolean; reason?: AllowanceRejectReason; clientText?: string; staffNote?: string }
export interface AllowancePreviewInput { year: number; decisions: { kind: AllowanceKind; months: number[]; params?: AllowanceParams; inYear: boolean }[] }
export interface AllowancePreview { without: { szjaHuf: number; tbHuf: number; szochoHuf: number }; with: { szjaHuf: number; tbHuf: number; szochoHuf: number }; savedHuf: number; byKind: { kind: AllowanceKind; szjaSavedHuf: number; csjkHuf: number }[]; csaladiUnusedHuf: number; annualCsjkPotentialHuf: number; warnings: string[] }
```

#### 28.3.3 Server proposal rules (B1, `services/kedvezmeny.ts`, pure function `proposeAllowances(answers, year, status, rules)`; unit tests per bullet)
- `fiatal25`: by = birth year, bm = birth month. If by + 25 > year → months 1–12. If by + 25 = year → months 1–bm. Else none.
- `anya30`: `mother` and (a child with `potlek = 'most'` and `sajat`, or `pregnancy`) and by ≥ year − 30.
  - Months: for children, 1–12 adjusted by `potlekKezdeteHo` / `potlekVegeHo` (the union over children).
  - For a pregnancy: from the month of day 91 = month of (dueMonth-15 − 189 days) [KÖNYVELŐ: confirm with the orvosi igazolás] until the birth month (then the child's months take over).
- `anyak`: `mother` and n = number of `sajat` children with `potlek ∈ {most, tizenket_ev, elhunyt}`.
  - n ≥ 4 → `negyplusz`; n = 3 → `harom`; n = 2 → `ket`, only if by ≥ `rules.allowances.ketgyermekesMinBirthYear`.
  - Months 1–12; from `potlekKezdeteHo` if the n-th child arrived this year.
  - If `anya30` also applies, it is still proposed with the reason "a 30 év alattiak kedvezménye után ehhez nem marad alap" (the engine order makes it harmless).
- `csaladi`: only if `csaladiWho ∈ {en, kozosen}`. Per month m:
  - kedvezményezett = children with `potlek = 'most'` in m, + 1 if the pregnancy's day 91 ≤ m < birth month;
  - eltartott = kedvezményezett + `otherDependants` (+ children with `potlek = 'nem'` are not counted);
  - children params from the answers;
  - sharePct = 100 (`en`) or `csaladiSharePct`.
  - `csjkInYear` proposal: `true` if status ≠ nyugdíjas and `csjkWish = 'igen'`; otherwise false, and the accountant decides.
  - `csaladiWho = 'par'` → no item; the reason "A párod veszi igénybe" is shown to the accountant in the answers column.
- `elso_hazasok`: `marriage.first` → months from the month after `marriage.month`, until min(+24, December).
  - `monthlyHuf` = 33 335 (`en`), 16 668 (`kozosen`, the accountant may change it), none (`par`).
  - "Both under 25" is not asked: the accountant checks it (warning in the proposal when by + 25 > year).
- `szemelyi`: `disability` + `healthConsent` → months from `fromMonth` (or 1) to 12.
- `csed_gyed`: `benefit` → months between from and to (info item; the accountant converts it to a `kieso` insurance break in the tax profile, button in §28.3.6).

#### 28.3.4 Client questionnaire – screens and final copy (B2; `ALLOWANCE_QUESTION_TEXTS`, content `kedvezmeny.kerdoiv.*`)
Entry points:
1. **Onboarding**: the journey gets the optional row `kedvezmenyek` after `adatok` in every variant except `nincs`.
   - Row text: "Adókedvezmények", sub "Te · kb. 3 perc · ha jár".
   - Row states: `nyitva` until the gate is answered or the questionnaire is submitted, then `kesz`.
   - The row is never `most`, is **not counted** in `todoCount` (`JOURNEY_NOT_COUNTED`) and never blocks activation (`JOURNEY_NOT_REQUIRED_FOR_ACTIVATION` + `kedvezmenyek`).
   - Right after the client saves "Adataid" (both paths), the gate sheet opens once.
2. **Fiók** → new section "Adózás" → row "Adókedvezményeid" (icon `igazolas`), sub = status ("Nem töltötted ki" / "{firstName} átnézi" / "{n} jóváhagyva" / "Nem jár").
3. **Főoldal** hint (`ClientHome.allowancesHint`): only when gate = `kesobb` or null and the client is active. A light card under "Idei kereteid": "Jár neked adókedvezmény? Nézd meg, kb. 3 perc." with the button "Megnézem". The client can close it ("Most nem"); it comes back once in January.
4. The gate sheet itself (white bottom sheet, 3D `igazolas` 44 pt, no circle):
   - Title "Jár neked adókedvezmény?"
   - Body "Például gyerekek után, 25 év alatt, édesanyáknak, friss házasoknak vagy súlyos betegség miatt. Ha jár, kevesebb adót fizetsz."
   - Primary "Megnézem (kb. 3 perc)" → `/kedvezmenyek/kerdoiv`; light capsule "Nem jár" → gate `nem_jar`, toast "Rendben. Ha változik valami, a Fiókban bármikor megadhatod."; text link "Később" → gate `kesobb`.

The questionnaire `/kedvezmenyek/kerdoiv` follows §27.0.3 B: one question per screen, progress "3/9", "Vissza" keeps the data, "Tovább" is the only filled button. Each page: a 3D icon 44 pt directly on the sheet, the question (22 pt / 700), a one-line "Miért kérdezzük?" in secondary text, and the answer chips or pickers. Pages appear only when relevant; the progress counts the shown pages. Final copy:
| # | Icon | Question | Answers / fields | Why line |
|---|---|---|---|---|
| K0 | `igazolas` | "Adókedvezményeid" | text: "Pár igen–nem kérdés. Neveket, TAJ-számot nem kérünk. A válaszaidat {firstName} nézi át, és ő dönti el, mi jár neked. Amit jóváhagy, azt beszámoljuk az adódba." button "Kezdjük" | – |
| K1 | `tepnaptar` | "Mikor születtél?" | year picker (1940–2010), month picker (január–december) | "A 25 és 30 év alattiak és a két gyermekes anyák kedvezménye az életkortól függ. A napot nem kérjük." |
| K2 | `fiok` | "Van gyermeked, akire családi pótlékot kapsz, vagy legalább 12 évig kaptál?" | Igen / Nem | "Gyerekek után jár a legtöbb kedvezmény." |
| K3 | `fiok` | "Mesélj a gyerekeidről" | stepper "Hány gyermekről van szó?" 1–12; per child a card "{n}. gyermek": chips "Most is kapok rá családi pótlékot" / "Már nem, de legalább 12 évig kaptam" / "Már nem kapok rá" (this third chip shows the checkbox "A családi pótlék a gyermekem halála miatt szűnt meg"); for "most" two optional month pickers "Idén kezdtem kapni (pl. idén született)" / "Idén megszűnik (pl. befejezi az iskolát)"; yes/no rows "Saját vagy örökbe fogadott gyermekem" (default igen), "Tartósan beteg vagy súlyosan fogyatékos", "Felváltva gondozzuk a másik szülővel" | "Nevet nem kérünk, elég, ha sorban végigmész rajtuk." |
| K4 | `fiok` | "Van más eltartottad is?" | stepper 0–9 | "Például nappali tagozatos egyetemista gyermeked, akit a családi pótléknál beszámítanak. Ettől nő a gyerekenkénti kedvezmény." |
| K5 | `tepnaptar` | "Babát vártok?" | Igen / Nem; if Igen: "Mikorra várjátok?" year + month | "Ha te vagy a feleséged várandós, a 91. naptól már jár a családi kedvezmény. Az orvosi igazolást tartsd meg." |
| K6 | `fiok` | "Te vagy a gyerekek anyukája?" (only with K2 Igen or K5 Igen) | Igen / Nem | "Az anyák 2026-ban sokszor egyáltalán nem fizetnek SZJA-t a vállalkozásuk után." |
| K7 | `szamolo` | "Ki veszi igénybe a családi kedvezményt?" (only with children or pregnancy) | Én / A házastársam vagy élettársam / Megosztjuk (+ slider "Kb. mennyit te?" 10–90 %, step 10); then, if the client is not nyugdíjas and chose Én or Megosztjuk: "Ha az SZJA-dból nem fogy el, csökkentse év közben a TB-járulékodat is?" Igen / Döntse el {firstName} | "Egy hónapra a kedvezmény egyszer jár. Ha a párodnak munkabére van, lehet, hogy nála éri meg jobban – {firstName} megmondja." |
| K8 | `igazolas` | "Az elmúlt két évben házasodtál, és legalább egyikőtöknek ez az első házassága?" | Igen / Nem; if Igen: "Mikor volt az esküvő?" year + month; "Ki veszi igénybe?" Én / A párom / Megosztjuk | "Havonta 5 000 Ft-tal kevesebb SZJA, 24 hónapig, kettőtöknek együtt." |
| K9 | `irat` | "Súlyosan fogyatékos vagy, vagy rokkantsági járadékot, fogyatékossági támogatást kapsz?" | Igen / Nem; if Igen: "Mióta?" year + month or "Régebb óta"; "Mi alapján?" Orvosi igazolás / Rokkantsági járadék / Fogyatékossági támogatás | "Ilyenkor havonta 16 140 Ft-tal kevesebb SZJA jár. Az orvosi igazolást tartsd meg, nem kell feltöltened." |
| K10 | `ora` | "Kapsz idén táppénzt, CSED-et vagy GYED-et?" | Igen / Nem; if Igen: from / to month ("Még kapom") | "Ezekre a hónapokra nem kell a havi minimum járulékot fizetned." |
| K11 | `lakat` 36 pt | (only if any health answer is yes) "Egészségügyi adat" | checkbox "Hozzájárulok, hogy ezt az egészségügyi adatot a kedvezményem kiszámításához kezeljétek. Csak {firstName} látja, és bármikor visszavonhatom." | if unchecked, the amber line "Ha nem jelölöd be, ezt nem mentjük el, és most nem tudjuk beszámolni. Az éves bevallásban akkor is érvényesítheted." |
| K12 | `igazolas` + accountant avatar 40 pt | "Ezek járhatnak neked" | one row per proposed item: label + `line` + "kb. {x} Ft-tal kevesebb adó idén" (preview estimate, rounded to 1 000; "Év végén számoljuk el" when only the annual return applies); "Megjegyzés {firstName} számára (nem kötelező)" text field ≤ 500; primary **"Elküldöm"**; sub "{firstName} a lehető leggyorsabban átnézi." (→ §28.K.15: no answer-time promise) Then the list "Ezeket tartsd meg, {firstName} elkérheti:" (only relevant: "a családi pótlékról szóló határozat", "a házassági anyakönyvi kivonat", "az orvosi igazolás", "a felváltva gondozásról szóló bírósági döntés vagy megállapodás"). | – |
- Nothing applies at K12: title "Most úgy tűnik, nem jár kedvezmény", body "Ha változik valami (például babát vártok), itt bármikor megadhatod.", primary "Rendben" (saves submitted answers with no items; the gate becomes `nem_jar`).
- After "Elküldöm": toast "Elküldtük. {firstName} átnézi, és szól." → `/kedvezmenyek`.
- Validation messages: "Válaszd ki az évet és a hónapot." · "Add meg, hány gyermekről van szó." · "Mikorra várjátok? Válassz hónapot." · "Az esküvő hónapja nem lehet a jövőben." · "A megosztás 10 és 90% között lehet."

#### 28.3.5 Client status screen `/kedvezmenyek` (B2)
- Blue band: title "Adókedvezményeid". Sub-line:
  - with an approved item: "Idén eddig kb. {savedYtd} Ft-tal kevesebb adót fizetsz";
  - pending: "{firstName} átnézi a válaszaidat.";
  - none: "Nézd meg, jár-e neked.", with the button "Megnézem".
- One white sheet, one row per item (`AllowanceItemView`). Row = label (16 pt / 600), `line` (secondary), and the status line (`statusText`):
  - `javasolt`: "{firstName} átnézi"
  - `kerdes`: "{firstName} kérdezett: {question}" + the light capsule "Válaszolok" → `/uzenetek`
  - `jovahagyva`: "Jár · {monthsText} · idén kb. {effectYear} Ft-tal kevesebb adó". If `inYear` = false: "Jár · az éves bevallásban számoljuk el".
  - `elutasitva`: "Nem jár: {rejectText}"
- Light capsule "Valami változott – módosítom": the questionnaire opens prefilled. Resubmitting follows §28.3.2.
- Footer (13 pt): "A jóváhagyott kedvezményt a negyedéves adóelőlegedben számoljuk el. Ha év közben valami nem stimmel, az éves bevallásban rendezzük."
- `ALLOWANCE_CLIENT_LINES` (the `line` per kind):
  - anya30: "30 éves korodig nem fizetsz SZJA-t a vállalkozásod jövedelme után."
  - anyak `ket`: "Nem fizetsz SZJA-t a vállalkozásod jövedelme után, egész életedben."
  - anyak `harom` / `negyplusz`: the same text.
  - fiatal25: "25 éves korodig havonta kb. 716 000 Ft jövedelemig nem fizetsz SZJA-t."
  - szemelyi: "Havonta 16 140 Ft-tal kevesebb SZJA."
  - elso_hazasok: "Havonta 5 000 Ft-tal kevesebb SZJA, 24 hónapig, kettőtöknek együtt."
  - csaladi: "Gyerekenként havonta 20 001–66 000 Ft-tal kevesebb SZJA. Ha nem fogy el, a TB-járulékodból is."
  - csed_gyed: "Ezekre a hónapokra nem kell minimum járulékot fizetned."
- `ALLOWANCE_LABELS`:
  - anya30 "30 év alatti anyák kedvezménye"
  - anyak `ket` / `harom` / `negyplusz`: "Két gyermeket nevelő anyák kedvezménye" / "Három gyermeket nevelő anyák kedvezménye" / "Négy vagy több gyermeket nevelő anyák kedvezménye"
  - fiatal25 "25 év alattiak kedvezménye"
  - szemelyi "Személyi kedvezmény"
  - elso_hazasok "Első házasok kedvezménye"
  - csaladi "Családi kedvezmény"
  - csed_gyed "Kieső idő (táppénz, CSED, GYED)"
- **Effect elsewhere:** the "Hogyan jött ki?" sheet shows the allowance lines (§28.3.7 f). The reserve and earnings include approved allowances. The warning `kedvezmeny_jovahagyasra_var` shows where §28.1.7 says.

#### 28.3.6 Panel review UI (B3; client page tab **"Kedvezmények"**, between Adó and Üzenetek, badge = `allowancesPending`)
Layout: two columns ≥ 1280 px, stacked below.
- **Left – "Az ügyfél válaszai"**:
  - Read-only: the answers in staff wording, the version and send date, the health consent time ("Egészségügyi adathoz hozzájárult: …" or "nincs").
  - The client's note.
  - The legacy `client_tax_profiles.allowances` (old one-line flags), shown as "Régi jelzés".
  - Line "A gyermekek és a házastárs adóazonosító jele kell a bevalláshoz" with the button **"Kérés küldése"**. It creates an accountant request from the template "Kérlek, töltsd fel a gyermekeid (és ha megosztjátok, a párod) adóigazolványának képét. A bevalláshoz kell." (type `dokumentum`, category `igazolas`).
- **Right – one card per item:**
  - Card header: title (`ALLOWANCE_LABELS`), status chip, the proposal reasons (secondary), engine warnings (amber; e.g. "A születési év alapján 2026-ban nem jár").
  - Editable fields:
    - 12 month toggles (Jan–Dec), prefilled from the proposal;
    - anyák: the jogcím select;
    - első házasok: Ft/month (0–33 335);
    - családi: a table per month (eltartott, kedvezményezett, tartósan beteg count, felváltva count, share %) with "Mind a 12 hónapra";
    - toggles "Év közben, az előlegben" (`in_year`, default on) and, for családi, "Családi járulékkedvezmény év közben" (`csjkInYear`, with the hint "Ilyenkor az SZJA-előleget is a 2658-ban kell bevallani.");
    - documents to keep (checklist, informational).
  - **Effect preview** (calls `POST …/allowances/preview` on every change, debounced 400 ms): "Idei hatás (becslés): SZJA −{x} Ft · TB −{y} Ft (családi járulékkedvezmény) · Szocho változatlan." Also "Fel nem használt családi kedvezmény: {u} Ft → az éves bevallásban kb. {c} Ft térülhet."
  - Buttons:
    - **"Jóváhagyom"** (primary);
    - **"Kérdezek"**: dialog with the text to the client (≤ 500). It sends an Üzenetek message as the accountant, sets status `kerdes` and notifies `allowance_decided` variant `kerdes`;
    - **"Nem jár"**: reason select `ALLOWANCE_REJECT_REASON_LABELS` + the text to the client + an optional staff note.
  - `csed_gyed` card: instead of approval, the button **"Kieső időként felveszem"**. It opens the Áttekintés tax-profile editor with a prefilled `kieso` insurance break (from / to from the months), then marks the item `jovahagyva`.
- Client list: a filter chip **"Kedvezmény vár ({n})"** for the accountant. Admin sees the same; **csapat never sees this tab** (API 404).
- `ALLOWANCE_REJECT_REASON_LABELS`: kor "Az életkora alapján nem jár", nem_jogosult "Nem jogosult", mas_veszi_igenybe "A párja veszi igénybe", nincs_jovedelem "Nincs olyan jövedelme, amire jár", igazolas_hianyzik "Hiányzik az igazolás", egyeb "Egyéb".

#### 28.3.7 Engine changes (B4)
**a) Types (`types.ts`, additive):**
```ts
export type AllowanceKind = 'anya30' | 'anyak' | 'fiatal25' | 'szemelyi' | 'elso_hazasok' | 'csaladi';
export interface CsaladiMonthInput { month: number; eltartott: number; children: { felvaltva?: boolean; tartosBeteg?: boolean }[]; sharePct?: number /* default 100 */ }
export interface AllowancesInput {
  /** 'YYYY-MM'; required for anya30, anyak 'ket', fiatal25 (warning + ignored when missing). */
  birthMonth?: string;
  anya30?: { months: number[] };
  anyak?: { jogcim: 'ket' | 'harom' | 'negyplusz'; months: number[] };
  fiatal25?: { months?: number[] };            // default: computed from birthMonth
  szemelyi?: { months: number[] };
  elsoHazasok?: { months: number[]; monthlyHuf: number }; // 0..rules.allowances.elsoHazasokMonthlyHuf
  csaladi?: { months: CsaladiMonthInput[]; csjkInYear: boolean };
}
// TaxProfileInput (+) kedvezmenyek?: AllowancesInput   – APPROVED, in-year allowances only. Legacy `allowances` unchanged.
// MonthLine (+) taxableHuf?: number; exemptHuf?: number; csjkHuf?: number   (tbHuf stays GROSS)
// QuarterResult: tbHuf becomes TB − Σ csjk of the quarter (payments use it); (+) csjkHuf?: number; (+) allowanceUsedYtdHuf?: Partial<Record<AllowanceKind, number>>
export interface AllowanceSummary {
  usedHuf: Partial<Record<AllowanceKind, number>>; // base reduction against SZJA over the returned quarters
  szjaSavedHuf: number; csjkHuf: number; savedHuf: number;
  csaladiUnusedHuf: number;          // pool left after the last returned month
  annualCsjkPotentialHuf: number;    // min(15 % × unused, TB of the year − csjk) – for the accountant
}
// YearResult (+) allowances?: AllowanceSummary
```
**b) Rules (`rules/types.ts` + `2026.ts` + `2027.ts`):** `TaxRules.allowances = { csaladiPerChildHuf: { one: 133_340, two: 266_660, threePlus: 440_000 }, csaladiTartosBetegExtraHuf: 133_340, felvaltvaPct: 50, fiatal25MonthlyCapHuf: 715_765, fiatal25AgeYears: 25, anya30AgeYears: 30, ketgyermekesMinBirthYear: 1986 | null, haromgyermekesFrom: '2025-10-01', szemelyiMonthlyHuf: 107_600, elsoHazasokMonthlyHuf: 33_335, elsoHazasokMaxMonths: 24, csjkPermille: 150, nyugdijasAnyaSzochoLimitHuf: 34_356_720 }`, each with its source id. Sources: `szja-tv` 29/A–29/H, `tv-2025-13/14/15`, `nav-73` (2026.03.19), `ksh-atlagkereset` (Hivatalos Értesítő 52/2025). The 2027 draft uses `ketgyermekesMinBirthYear: 1977` and keeps the 2026 cap and személyi values (draft warning; the 2027 KSH July average and the 2027 minimum wage are not known).
**c) Algorithm** (`engine/allowances.ts`; `calculateYear` first computes every quarter's month lines (they do not depend on SZJA), then this pass, then SZJA per quarter). There are two kinds of allowance:
- **Income-bound** (mothers, fiatal25): they exempt the income of the eligible **months** (month-local).
- **Frame** (személyi, első házasok, családi): they reduce the **year-to-date** base of the quarterly advance (Szja tv. 49. § (1): "korábban még nem érvényesített kedvezmény"). A frame of a later month may therefore offset the income of an earlier month inside the same YTD.

Steps:
1. Monthly taxable part: C[m] = Σ_{k≤m} I[k]; T[m] = max(0, C[m] − TF) − max(0, C[m−1] − TF). It may be negative after a storno. The month-bound exemptions only act on positive values.
2. Validation of eligibility (warnings `audience: 'konyvelo'`, the item is then ignored):
   - `anya30_kor`: birth year < year − 30;
   - `anyak_kor`: `ket` and birth year < `ketgyermekesMinBirthYear`;
   - `fiatal25_kor`: months after the birthday month;
   - `kedvezmeny_szuletes_hianyzik`: no `birthMonth` where it is needed.
   - With `priorOverrides`, months ≤ 3 × throughQuarter are skipped and their frames are not counted (`kedvezmeny_elozo_konyvelo`) [KÖNYVELŐ].
3. Month-bound pass, m = 1..12 (only m ≥ start month):
   - b = T[m].
   - Mothers: if m ∈ anya30 ∪ anyak months and b > 0 → exA[m] = b (attributed to anya30 first, then anyak), b = 0.
   - fiatal25: if m is eligible → exF[m] = min(max(b, 0), cap); b −= exF[m].
   - B2[m] = b (the month's base after the month-bound exemptions).
4. Frames per month:
   - F_sz[m] = szemelyi(m);
   - F_hz[m] = elsoHazasok(m);
   - F_cs[m] = Σ_children (base(eltartott) + (tartosBeteg ? extra : 0)) × (felvaltva ? 50 % : 100 %) × sharePct / 100, with `roundDiv` at each multiplication. base = one / two / threePlus for eltartott 1 / 2 / ≥ 3.
5. **Csjk (only csjkInYear, status ≠ nyugdíjas, the month insured)** – month-local, Tbj. 80. § (2): the month's családi frame minus that month's SZJA base after the earlier allowances.
   - b3 = max(0, B2[m] − F_sz[m] − F_hz[m]);
   - rest = max(0, F_cs[m] − b3);
   - capBase = `line.minimumApplied` ? min(line.minimumHuf, max(I[m], 0)) : line.baseHuf (0 income in a minimum month → 0);
   - capTB = min(permilleOf(capBase, tbPermille), line.tbHuf);
   - csjk[m] = min(permilleOf(rest, csjkPermille), capTB);
   - conv[m] = min(rest, roundDiv(csjk[m] × 1000, csjkPermille)) – the part of the családi frame turned into csjk (Szja tv. 29/B. § (6)).
6. SZJA, quarter q, with M = 3q:
   - Base = max(0, Σ_{m≤M} B2[m]);
   - Frames = Σ_{m≤M} (F_sz + F_hz + F_cs − conv);
   - szjaCum = permilleOf(max(0, Base − Frames), szjaPermille).
   - Attribution in the 29/H order: used.szemelyi = min(ΣF_sz, Base); used.elso_hazasok = min(ΣF_hz, Base − used.szemelyi); used.csaladi = min(ΣF_cs − Σconv, the rest).
   - The advance and the clamp work as today. TB_q = Σ line.tbHuf − Σ csjk[m ∈ q]. `payments()` uses the net TB.
   - Store per month line: `taxableHuf` = T[m], `exemptHuf` = exA[m] + exF[m], `csjkHuf`.
7. With no allowances the pass reproduces today's numbers exactly (Σ B2 = taxable YTD). **Regression:** every existing test stays green unchanged.
8. Year summary `allowances` (a), over the returned quarters:
   - `csaladiUnusedHuf` = (ΣF_cs − Σconv) − used.csaladi;
   - `annualCsjkPotentialHuf` = min(permilleOf(csaladiUnusedHuf, 150), Σ TB of the returned quarters − Σ csjk).
9. The nyugdíjas anya szocho rule (34 356 720 Ft) cannot be reached by an átalányadózó. It is a guard warning only, `nyugdijas_anya_szocho`.

**d) Warnings:**
- `kedvezmeny_nem_modellezett` stays for the legacy field only.
- New: `csjk_2658` (konyvelo): "Év közbeni családi járulékkedvezménynél az SZJA-előleget is a 2658-ban kell bevallani (Szja tv. 49. § (6))."
- New: `csjk_nyugdijas` (konyvelo): "Nyugdíjas egyéni vállalkozó nem fizet TB-járulékot, ezért családi járulékkedvezmény nem jár."
- New: `kedvezmeny_ev_vegen` (ugyfel, when `csaladiUnusedHuf > 0`): "A fel nem használt családi kedvezményedet az éves bevallásban számolja el a könyvelőd."

**e) Backend mapping:** B1 writes `export async function allowancesForEngine(db: DbOrTx, clientId: string, year: number): Promise<AllowancesInput | undefined>` in `services/kedvezmeny.ts`. It reads `jovahagyva` + `in_year` rows; `birthMonth` comes from the answers; the családi months come from `params.csaladi`. B4 calls it in `tax.ts engineInput()` and sets `profile.kedvezmenyek`. B4 stops passing the legacy `allowances` once an `allowance_answers` row exists for that year.

**f) Explanation** (`explanation.ts`, Hungarian, tegező), after the "adóköteles jövedelem" rows:
- heading `cim` "Kedvezményeid", side "jóváhagyott";
- rows `sor` op '−':
  - "30 év alatti anyák kedvezménye – ez a jövedelem SZJA-mentes"
  - "{2/3/4+} gyermekes anyák kedvezménye – ez a jövedelem SZJA-mentes"
  - "25 év alattiak kedvezménye"
  - "Személyi kedvezmény"
  - "Első házasok kedvezménye"
  - "Családi kedvezmény ({n} gyermek)"
  (amount = used YTD);
- row `ado` "Családi járulékkedvezmény – ennyivel kevesebb a TB-járulék" op '−' (csjk of the quarter);
- `megjegyzes` for the unused családi frame (the text of `kedvezmeny_ev_vegen`).

#### 28.3.8 Engine test cases (B4, `test/kedvezmenyek.test.ts`; hand-computed; 2026, 45 %; "even year" = 1 000 000 Ft received on the 10th of every month → monthly income 550 000; the adómentes rész is used up in April, which has a taxable part of 263 200; YTD taxable 0 / 1 363 200 / 3 013 200 / 4 663 200; baseline SZJA advances 0 / 204 480 / 247 500 / 247 500 = 699 480; baseline TB főfogl. 179 154 / 179 154 / 199 134 / 305 250 = 862 692, mellékállású 0 / 252 192 / 305 250 / 305 250 = 862 692; szocho 606 216 – checked against `dist` on 11-19)
| # | Profile + approved allowances | Expected |
|---|---|---|
| T1 | mellékállású, even year, `fiatal25` (birth 2002-05: all months) | SZJA 0 / 0 / 0 / 0; TB, szocho = baseline; used.fiatal25 = 4 663 200 |
| T2 | mellékállású, even year, `fiatal25` (birth 2001-06: months 1–6) | SZJA 0 / 0 / 247 500 / 247 500 (year 495 000) |
| T3 | mellékállású, only 6 000 000 on 04-10, `fiatal25` (birth 2003-01) | April taxable 1 363 200 − cap 715 765 = 647 435 → SZJA Q2 97 115, Q3 0, Q4 0; TB Q2 252 192 (unchanged) |
| T4 | főfogl., even year, `anya30` (birth 1997-03, months 1–12) | SZJA 0 all; TB 862 692; szocho 606 216 (unchanged) |
| T5 | mellékállású, even year, `anyak ket` birth **1986-01** / **1985-12** | 0 SZJA / baseline 699 480 + warning `anyak_kor` |
| T6 | nyugdíjas, even year, `anya30` birth **1996-01** / **1995-12** | 0 / baseline + `anya30_kor` |
| T7 | nyugdíjas, even year, `anyak harom` months 7–12 | SZJA 0 / 204 480 / 0 / 0 (year 204 480) |
| T8 | nyugdíjas, even year, `szemelyi` 1–12 | 0 / 107 640 / 199 080 / 199 080 (year 505 800 = 699 480 − 193 680) |
| T9 | nyugdíjas, even year, `elsoHazasok` months 1–12, 33 335 | 0 / 174 479 / 232 499 / 232 499 (year 639 477) |
| T10 | nyugdíjas, even year, `elsoHazasok` months 6–12 (wedding 2026-05) | year SZJA 664 478 (base 4 429 855) |
| T11 | mellékállású, even year, `csaladi` 1 eltartott / 1 child, 100 %, csjk off | 0 / 84 474 / 187 497 / 187 497 (year 459 468) |
| T12 | as T11, the child `tartosBeteg` | 0 / 0 / 91 962 / 127 494 (year 219 456) |
| T13 | as T11, the child `felvaltva` | 0 / 144 477 / 217 499 / 217 498 (year 579 474) |
| T14 | mellékállású, even year, 2 eltartott / 2 children, sharePct 50 | 0 / 0 / 91 989 / 127 503 (year 219 492) |
| T15 | mellékállású, even year, 2/2, 100 %, csjk **off** | SZJA 0 all; TB baseline; `csaladiUnusedHuf` 1 736 640; `annualCsjkPotentialHuf` 260 496 |
| T16 | mellékállású, even year, 2/2, csjk **on** | SZJA 0; csjk only in April 40 518 (Q1 cap 0 because g = 0; May–Dec the base exceeds the frame); TB Q2 211 674, Q3 305 250, Q4 305 250; unused 1 466 520; potential 219 978 (40 518 + 219 978 = 260 496) |
| T17 | **főfogl.**, even year, 2/2, csjk on | csjk Jan, Feb, Mar 59 718 each (minimum month, cap base min(322 800, 550 000)), April 40 518, then 0 → TB 0 / 138 636 / 199 134 / 305 250 = 643 020; szocho 606 216; SZJA 0; unused 272 160; potential 40 824 (219 672 + 40 824 = 260 496) |
| T18 | főfogl., revenue only from April (Jan–Mar 0), 2/2, csjk on | csjk Jan–Mar 0 (no income in a minimum month) → Q1 TB 179 154 unchanged; April csjk 59 718 (the April income is still tax-free but counts for the cap) |
| T19 | mellékállású, even year, `fiatal25` (birth 2003-01) + `csaladi` 1/1 csjk on | SZJA 0; csjk 20 001 in each of Apr–Dec (Q1 cap 0) = 180 009; TB year 682 683 |
| T20 | no `kedvezmenyek` | every existing test unchanged (regression) |
| T21 | validation | months outside 1–12, sharePct outside 0–100, monthlyHuf > 33 335, bad `birthMonth` → `AdoMotorInputError` with a Hungarian message |
| T22 | NAV 100 6.1 csjk table (B4 rebuilds the example: főfogl., minimálbér, kieső and szünetel months) | csjk bases cumulative 968 400 / 1 491 200 / 1 814 000 / 2 459 600 |

#### 28.3.9 Notifications and the yearly check (B1, `jobs-ot1119.ts`)
- `allowance_submitted` → the accountant (badge + staff digest line "Kedvezmény vár: N ügyfél").
- `allowance_decided` → the client, variants:
  - `jovahagyva`: "Jóváhagyta a kedvezményedet: {label}" / "Már az adóelőlegedben számolunk vele."
  - `reszben`: "{firstName} átnézte a kedvezményeidet" / "Nézd meg, mi jár."
  - `kerdes`: "{firstName} kérdezett a kedvezményedről" / "Válaszolj neki az Üzenetekben."
  - `elutasitva`: "{firstName} átnézte a kedvezményeidet" / "Egy kedvezmény most nem jár. Megnézem, miért."
  - Link `/kedvezmenyek`.
- Job **`allowances_new_year`** (1 January 00:20, after `new_year`): for every client with approved items of the old year, insert next year's `client_allowances` as `javasolt`, with recomputed age-based months and copied családi params. Then `allowance_check` variant `ev_eleje` (5 January 09:00): "Új év: nézd át a kedvezményeidet" / "Változott valami a családodban? Kb. 1 perc."
- Monthly 1st 09:00 `allowance_check` variant `lejar`, sent to the client and the accountant when an approved item ends this month (fiatal25 birthday month, last anya30 year, első házasok 24th month): "Ebben a hónapban véget ér: {label}" / "Utána több SZJA-val számolunk. {firstName} tud róla."

---

### 28.4 Order 4 – "Mennyit kerestem?"

#### 28.4.1 Definition (binding)
**Net income of a month = revenue received in the month − (SZJA + TB after csjk + szocho + HIPA) attributed to the month.** Each tax part is taken in this order of preference: **paid** (the quarter's payment items marked paid) → **approved** (the quarter is approved) → **estimated** (engine). Each month carries `basis` = the weakest of its parts (`becsles` < `jovahagyva` < `befizetve`). The átalány költséghányad is not deducted: it is a tax rule, not a cost. The client's real costs are unknown to us, and the text says so.

#### 28.4.2 Monthly attribution (B4 engine `earningsByMonth`, B1 fills approved and paid amounts)
- Revenue = R[m] (receipt month, `countsForAtalany`).
- TB, szocho = the month lines (TB − csjk).
- SZJA: the quarter advance is spread over its months in proportion to B2[m] (§28.3.7 c, the month's base after the month-bound exemptions), with cumulative rounding: cum_m = roundDiv(advance × Σ_{k≤m in q} B2[k], Σ_{q} B2). The months then sum exactly to the advance. If Σ_q B2 ≤ 0 and the advance > 0, it is spread evenly over the quarter's active months. A clamped quarter gives 0.
- Approved quarter with overrides: each tax part is spread in the engine's proportions with cumulative rounding. If the engine part is 0 and the approved part is not, it is spread evenly over the insured months.
- HIPA: the year amount (approved HIPA if set, else the engine estimate, 0 for `nincs` / `altalanos` without amount) spread over the **active months** (≥ 1 active day) by cumulative rounding: month share = roundDiv(annual × k, n) − roundDiv(annual × (k − 1), n), where k = the month's position among the n active months. (The home reserve card uses days for its "eddig" share, §28.1.6, because it is computed for today.)
- A month with no revenue can be negative (főfogl. fixed minimum). It is shown as negative with the note "Nem volt bevételed, a havi fix járulékot ettől még fizeted."
```ts
export interface EarningsMonthEngine { month: number; revenueHuf: number; szjaHuf: number; tbHuf: number; szochoHuf: number; csjkHuf: number; hipaHuf: number; netHuf: number; future: boolean }
export function earningsByMonth(year: YearResult, o: { hipaAnnualHuf: number | null; approved?: Record<string /* periodKey */, { tbHuf: number; szochoHuf: number; szjaHuf: number }> }): EarningsMonthEngine[];
export function projectYear(input: YearInput): { reliable: boolean; revenueHuf: number; taxesHuf: number; hipaHuf: number; netHuf: number };
```

#### 28.4.3 Projection (engine `projectYear`)
- **Reliable** only when elapsed active days ≥ `projectionMinDays` (60), the same rule as the meters.
- **Projected revenue** = the meters' linear projection (`atalanyCap.projectedHuf`).
- The remainder (projected − used) is spread over the remaining active days. The current month gets the days after `asOf`; each later month gets its days. There is one synthetic revenue item per month on the 15th, or on `asOf` + 1 for the current month.
- **Projected taxes** = L(actual + synthetic items) of §28.1.2 (whole year, `asOf` = 31 Dec) + HIPA from the same run (its band follows the projected revenue, so the 12 M / 18 M steps are included).
- *(k6c3, 2026-11-20)* An **approved quarter counts at its approved parts** (TB after csjk, szocho, SZJA – `projectYear(input, { approved })`, the same map as `earningsByMonth`), and the refund is the approved + open SZJA advances − the year's SZJA. An allowance approved after Q1–Q3 is never assumed to have lowered them (Kata: the old projection said "kb. 560 000 Ft adóval" while Jan–Nov already carried 1 097 174 Ft; correct: kb. 1 090 000 Ft). The same rule holds for the allowance effects (§28.3, "idén eddig kb. … Ft-tal kevesebb adó"): the SZJA saving is the year's (the overpaid advances come back), the családi járulékkedvezmény counts only where it was really taken – open quarters, or an approval that included it.
- **Net** = projected revenue − projected taxes.
- Display rounding: to the nearest 10 000 Ft with "kb.".
- Not reliable → no numbers; the text is "Az év végi előrejelzést 2 hónap után mutatjuk."
- Test E3 (below) shows the band jump.

#### 28.4.4 Screens and copy (B2; `EARNINGS_TEXTS`, content `kereset.*`)
- **Főoldal**: a new section after "Idei bevételed": Szakasz **"Mennyit kerestem?"**. A white sheet with the 3D `kivonat` 36 pt icon (no circle):
  - big line "Idén eddig kb. {ytdNet} Ft maradt neked";
  - sub "{ytdRevenue} Ft bevételből, {ytdTaxes} Ft adó és járulék után.";
  - projection line (when reliable): "Ha így folytatod, év végéig kb. {projNet} Ft marad.";
  - row link "Havonta megnézem" → `/kereset`.
- **`/kereset`**:
  - Blue band: title "Mennyit kerestem?", big number = YTD net, sub "{year}. január–{hónap}, adók és járulékok után".
  - Then the one-line explanation (`EARNINGS_TEXTS.line`, final): "Ennyi marad a bevételedből, miután levontuk az SZJA-t, a TB-járulékot, a szochót és az iparűzési adót. A költségeidet (anyag, telefon, autó) ebből fizeted – ezeket nem látjuk."
  - White sheet with one row per month, newest first. Row = month name; right "{net} Ft"; sub "bevétel {rev} · adó {taxes}" + basis word ("becslés" / "jóváhagyva" / "befizetve", text with ✓ for befizetve, no pills). Tapping a row opens a small sheet with the four parts.
  - Projection sheet "Év végéig várhatóan": "kb. {projNet} Ft", sub "Ha így folytatod: kb. {projRev} Ft bevételből, kb. {projTaxes} Ft adóval." Note: "Ez csak előrejelzés: az eddigi bevételed tempójával számol."
  - "Hogyan számoljuk?" opens explainer `kereset_miert`: "A bevételed a pénz megérkezésének hónapjában számít. Az adót és a járulékot ahhoz a hónaphoz írjuk, amelyikben a bevétel keletkezett; az iparűzési adót egyenletesen osztjuk el az évre. Ahol {firstName} már jóváhagyta vagy befizetted, azt az összeget használjuk, máshol becslést."
  - Footer: "Becslés. A végleges adót {firstName} hagyja jóvá."
- DTOs:
```ts
export type EarningsBasis = 'becsles' | 'jovahagyva' | 'befizetve';
export interface EarningsMonthView { month: number; label: string; revenueHuf: number; taxesHuf: number; parts: { szjaHuf: number; tbHuf: number; szochoHuf: number; hipaHuf: number }; netHuf: number; basis: EarningsBasis; note: string | null }
export interface EarningsView { year: number; months: EarningsMonthView[] /* 1..current month */; ytd: { revenueHuf: number; taxesHuf: number; netHuf: number }; projection: { reliable: boolean; revenueHuf: number | null; taxesHuf: number | null; netHuf: number | null; text: string }; line: string; disclaimer: string }
export interface EarningsCard { ytdNetHuf: number; ytdRevenueHuf: number; ytdTaxesHuf: number; sentence: string; sub: string; projectionText: string | null }
```
- Endpoints: `GET /client/home` + `earnings: EarningsCard | null`; `GET /client/earnings?year=` → **EarningsView** (403 `locked_until_active`, feature `kereset`); `GET /acc/clients/:id/earnings?year=` (the panel Áttekintés mini card, §28.1.9).
- Tests (B4 `test/kereset.test.ts`; B1 integration test for the bases):
  - **E1**: mellékállású even year, HIPA sávos 2 %, `asOf` 2026-12-31 (12 000 000 → band a, 50 000 Ft). Jan net 995 833 (HIPA 4 167); Apr net 813 217 (SZJA 39 480, TB 84 064, szocho 59 072, HIPA 4 167); May SZJA 82 500; months 1–6: revenue 6 000 000, taxes 658 888, net 5 341 112. HIPA months sum to 50 000.
  - **E2**: főfogl., 1 000 000 on the 10th of Feb–Dec only, HIPA sávos 2 % (band a), `asOf` 2026-12-31 → January net −105 849 (TB 59 718 + szocho 41 964 + HIPA 4 167), with the note.
  - **E3**: mellékállású even year, `asOf` 2026-06-30. Projected revenue = roundDiv(6 000 000 × 365, 181) = 12 099 448 → HIPA band b (6 000 000 × 2 % = 120 000). B4 writes the exact expected taxes from the defined method into the test.
  - **E4**: an approved Q3 with an override (TB +10 000) → the months of Q3 sum to the approved total; basis `jovahagyva`; after "Már befizettem", `befizetve`.

---

### 28.5 Order 5 – change guides ("Változás-útmutatók")

#### 28.5.1 Which changes, where they are filed, validity
| Kind (`CHANGE_KINDS`) | Where (NAV) | Self-service guide | Assisted ("Intézzük helyetted") needs |
|---|---|---|---|
| `valtozas_szekhely` | Vállalkozói Ügysegéd → "Új bejelentés, kérelem benyújtása" → **"Egyéni vállalkozással kapcsolatos adatváltozás bejelentése"** → 4 steps: 1 Személyi adatok · 2 Vállalkozói címadatok · 3 Tevékenységek · 4 Ellenőrzés | yes (real pictures) | the meghatalmazás covering "Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)" (UJEGYKE-5) |
| `valtozas_tevekenyseg` | same form, step 3 (ÖVTJ search, "Adatváltozás ideje") | yes (real) | same |
| `valtozas_telephely` | same form, step 2 "Telephely(ek)" → "Új telephely hozzáadása" | yes (real) | same |
| `valtozas_szuneteltetes` | Vállalkozói Ügysegéd → "Új bejelentés, kérelem benyújtása" → the szüneteltetés card [ELLENŐRIZENDŐ: exact card name; it is below the cut-off of the owner's capture] | yes (drawn steps after the tab) | same |
| `valtozas_adoadat` | **ONYA → "Egyéni vállalkozó bejelentése" (T101E)**, never in the Ügysegéd (§24 `REGISTRATION_FIX_CHANNEL_TEXT`, NAV Ügysegéd-útmutató 2026.03.19 pp. 4–5, 12, 18) | yes (ONYA real start, drawn form) | "ADÓÜGYEK" – our accountant already has it |
- Validity: the Ügysegéd kinds carry `validUntil` = env `CHANGE_UGYSEGED_VALID_UNTIL` (default `2026-12-31`, the EV register moves to the chamber, §27.13 #26). After that date the guide is `outdated` with the text "2027-től a vállalkozói nyilvántartást a kamara vezeti. Ezt az útmutatót frissítjük; addig kérj visszahívást, és segítünk." The assisted card then shows the callback only. `valtozas_adoadat` gets `validUntil` 2027-12-31.
- Facts every text must keep (`CHANGE_FACTS`; B4 verifies each [ELLENŐRIZENDŐ] on njt.hu or NAV before the text goes live and drops any sentence it cannot confirm):
  1. A filed bejelentés **cannot be withdrawn**. The NAV notice on the owner's Megtekintés screen says so, and that later changes must be filed with increased care.
  2. The **szüneteltetés start date** can be today at the earliest. It **cannot be modified later**; only a newer, earlier date can be reported (same NAV notice).
  3. Szüneteltetés lasts at least 1 month and at most 2 years. The resumption has to be reported; without it the register deletes the EV after 2 years [ELLENŐRIZENDŐ Evectv. 18.–19. §].
  4. During szüneteltetés there is no activity, no invoices and no járulék (not insured; engine `szunetel` break). The ÁFA limit is not reduced (engine rule).
  5. Changes are due within **15 days** [ELLENŐRIZENDŐ: Evectv. / Art. – the deadline sentence stays out of the app until confirmed].
  6. The new seat address is **public** (§26.1.3 amber line).
  7. A move to **another municipality** moves the HIPA, and a telephely in another municipality may add HIPA there [KÖNYVELŐ: the closing and opening returns].
  8. A different activity may mean a different **költséghányad** (45 / 80 / 90 %) [KÖNYVELŐ].
  9. Képesítéshez kötött activities only with the qualification (NAV text on the Tevékenységek screen).
  10. The "Születési ország" field is mandatory on step 1 of the change form (owner's capture 11-19).

#### 28.5.2 Where they live in the app (B2)
- **Hub `/valtozas`** – "Változás a vállalkozásodban". Band sub: "Költözöl, új munkába kezdesz vagy szünetet tartasz? Megmutatjuk, mit kell bejelentened – vagy intézzük helyetted." One white sheet, 5 rows (3D icon 36 pt, title, one line):
  - `fooldal`: "Költözik a székhelyed" – "Új cím a NAV-nál. Kb. 10 perc."
  - `irat`: "Új vagy más tevékenység" – "Új munka, új ÖVTJ-kód. Kb. 10 perc."
  - `boritek`: "Új telephely" – "Üzlet, műhely, iroda másik címen. Kb. 10 perc."
  - `tepnaptar`: "Szüneteltetés" – "Szünetet tartasz a vállalkozásodban. Kb. 10 perc."
  - `bevallas`: "Adózási adat változik" – "Például munkaviszonyt kezdesz vagy befejezel. Ezt a könyvelőd intézi."
  - Then "Más változott (lakcím, telefonszám, bankszámla)?" → the old free-text request `keresek/uj?tipus=adatvaltozas`.
  - "Elakadtál? Kérj visszahívást" (topic `valtozas`, source `valtozas_utmutato`).
  - An open change assist shows its status row on top ("Folyamatban: Költözik a székhelyed – {statusText}").
- Entry points to the hub:
  - Fiók → section "Adózás" → row "Változás a vállalkozásodban" (icon `irat`);
  - `keresek/uj`: a new first tile "Változás a vállalkozásodban" → hub; the tile `tevekenysegvaltozas` → `/valtozas/valtozas_tevekenyseg`;
  - Üzenetek request tile "Megváltozott egy adatom" → hub;
  - Adataim button "Megváltozott egy adatom" → hub;
  - GYIK.
- **Info page `/valtozas/[fajta]`**, in this order:
  - band title;
  - "Mit jelent?" (1–2 sentences);
  - "Mire figyelj?" (bullets);
  - **the assisted card at the top of the actions**: highlighted exactly like §27.3.1 (white sheet, 2 pt brand-blue border, capsule badge in `gombMAlap`, 3D icon 44 pt, never a pastel circle); badge "Ha nem boldogulsz vele" (adóadat: "Ajánlott"); title "Bejelentjük helyetted"; body "Megadod az új adatokat, {firstName} meghatalmazottként beküldi. Te csak jóváhagyod az appban."; button "Ezt kérem";
  - light capsule **"Megmutatod, hogyan csinálom magam?"** → `/valtozas/[fajta]/utmutato` (the existing `Utmutato` component, generalised to every `GuideKind`, no video card);
  - "Elakadtál? Kérj visszahívást" (topic `valtozas`, source `valtozas_utmutato`).
- Texts per kind (`CHANGE_TEXTS[kind]`, final unless marked):
  - **Székhely.** Mit jelent: "A székhelyed az a cím, ami a nyilvántartásban és a számláidon szerepel. Ha költözöl, ezt be kell jelentened." Mire figyelj: "Az új cím nyilvános lesz: bárki megnézheti a nyilvántartásban." · "Kell hozzá jogcím: a lakás a tiéd, bérled, a tulajdonos hozzájárult, vagy székhelyszolgáltatóval szerződtél." · "Ha másik településre költözöl, az iparűzési adód is oda kerül. Ezt {firstName} intézi." · "Utána írd át a címedet a számlázóprogramodban is."
  - **Tevékenység.** Mit jelent: "Ha új munkába kezdesz, vagy más lesz a fő munkád, a tevékenységeidet a hivatalos ÖVTJ-listából kell bejelentened." Mire figyelj: "Csak olyan tevékenységet jelents be, aminek a feltételeit teljesíted. Ha képesítés kell hozzá, legyen meg." · "Ha nem tudod, melyik sor a jó, megírjuk." · "Más tevékenységnél más költséghányad járhat. Szólj, és {firstName} átállítja."
  - **Telephely.** Mit jelent: "Telephely az üzlet, műhely vagy iroda, ahol rendszeresen dolgozol, és nem a székhelyed." Mire figyelj: "Kell hozzá jogcím, mint a székhelynél." · "Ha másik településen van, ott is iparűzési adót fizethetsz. {firstName} megnézi."
  - **Szüneteltetés.** Mit jelent: "Ha egy ideig nem dolgozol a vállalkozásodban, szüneteltetheted. Ezalatt nem kell járulékot fizetned." Mire figyelj: "Szünetelés alatt nem dolgozhatsz a vállalkozásodban, és nem állíthatsz ki számlát." · "A kezdőnapot nem adhatod meg visszamenőleg, és később nem módosíthatod. Jól gondold meg." · "Ha újra kezdenéd, azt is be kell jelentened. Szólj nekünk előtte." · [ELLENŐRIZENDŐ] "Legalább egy hónapig, legfeljebb két évig tarthat."
  - **Adóadat.** Mit jelent: "Ilyen például, ha munkaviszonyt kezdesz vagy befejezel (főállás vagy mellékállás), vagy közösségi adószámot kérsz." Mire figyelj: "Ezt nem a Vállalkozói Ügysegédben, hanem az ONYA-ban, a T101E nyomtatványon kell bejelenteni." · "Általában {firstName} intézi meghatalmazottként, neked csak szólnod kell." · "Ha kilépnél az átalányadózásból vagy az ÁFA-mentességből, előtte beszéljünk: erre most nem terjed ki a szolgáltatásunk."
- The guide pages show the honest picture label of §27.1.2 ("NAV-képernyő · Forrás: saját képernyőkép, 2026. november 19." / "Rajzolt vázlat – a valódi képernyő kicsit eltérhet"). When a drawn picture exists, the `GUIDE_DRAWN_NOTE` line appears.

#### 28.5.3 Guide templates (`CHANGE_GUIDE_TEMPLATES` for the change kinds – 6 with §28.K.6 –, B0 wrote them in `bekotes.ts`; the backend `GET /client/guides/:kind` personalises them with `personaliseChangeGuide()`)
Placeholders come from the client's latest open change assist (`change_data`); without it the `value` falls back to a generic text ("az új címed irányítószáma").
- New address placeholders: `{uIrsz}`, `{uTelepules}`, `{uKozterNev}`, `{uKozterJelleg}`, `{uHazszam}`, `{uTobbi}`.
- `{valtozasNapja}` ("2026. december 1."); `{aKereso}`, `{aSor}`, `{aKod}` (from the activity choice; `holdWhenActivityPending` as §26); `{szunetelKezdet}`, `{szunetelVege}`.
- Step keys (`GUIDE_STEP_KEYS`) = image keys.

Common steps (texts per kind where marked):
| Key | screenTitle | text | fields (label · action · value · why) | Picture |
|---|---|---|---|---|
| `belepes` | "Belépés" | "Gépen nyisd meg a Vállalkozói Ügysegédet, és lépj be Ügyfélkapu+-szal vagy DÁP-pal." (link "Vállalkozói Ügysegéd megnyitása" → `UGYSEGED_URL`) | Belépés · kattints · – · "A saját belépéseddel. A jelszavadat senkinek ne add meg, nekünk se." | copy of `vallalkozas_bejelentes/01_belepes` (real, film) |
| `ugyseged_fooldal` | "Bejelentéseim, kérelmeim" | "Ez az Ügysegéd kezdőlapja, itt látod a korábbi bejelentéseidet. Kattints a középső fülre." | Új bejelentés, kérelem benyújtása · kattints | owner 02 (real) |
| `valtozas_inditas` | "Új bejelentés, kérelem benyújtása" | "Fent a mostani adataidat látod. Görgess le az „Egyéni vállalkozással kapcsolatos adatváltozás bejelentése” részhez." | Bejelentés kitöltése · kattints · – · "Ezzel indul a változásbejelentés, 4 lépésből áll." | owner 03 (real) |
| `valtozas_szemelyi` | "1. Személyi adatok" | "Ezt a NAV kitölti a nyilvántartásból. Csak a születési országot kell kiválasztanod." | Születési ország · valaszd · "ahol születtél (például Magyarország)" · "Kötelező, nélküle nem enged tovább." / Tovább · kattints. Warning: "Ha valamelyik adatod nem stimmel, itt nem tudod javítani. Kérj visszahívást, megmondjuk, hol kell." | owner 04 (real, `_kitoltve`) |
| `valtozas_cimadatok` | "2. Vállalkozói címadatok" | székhely: "Itt látod az aktuális székhelyedet. Kattints az „Új székhely” gombra." · telephely: "Lent, a „Telephely(ek)” résznél kattints az „Új telephely hozzáadása” gombra." · tevékenység, szüneteltetés: "A címeiden nem változtatsz. Kattints a „Tovább” gombra." | Új székhely / Új telephely hozzáadása / Tovább · kattints | owner 05 `valtozas_cimadatok` (real) |
| `valtozas_uj_szekhely` | "Az új székhely címe" | "Írd be az új címet mezőnként. A dátum a költözés napja." | Ország · valaszd · Magyarország / Irányítószám · valaszd · {uIrsz} (copy) / Település · valaszd · {uTelepules} / Kerület · hagyd · "Budapesten magától kitöltődik" / Közterület neve · ird_be · {uKozterNev} (copy) / Közterület jellege · valaszd · {uKozterJelleg} / Házszám/Helyrajzi szám · ird_be · {uHazszam} (copy) / Épület, Lépcsőház, Szint, Ajtó · ird_be · {uTobbi} · "csak ha van" / Változás napja · ird_be · {valtozasNapja} · "Ettől a naptól érvényes az új cím." Warning: "Az új székhely címe nyilvános lesz." | owner 05 `szekhely_mezok_1` (real) |
| `valtozas_szekhely_mentes` | "Mentés" | "Ha minden mezőt kitöltöttél, mentsd el az új címet, utána lépj tovább." | Új székhely adatainak mentése · kattints / Tovább · kattints | owner 05 `szekhely_mezok_2_telephely` (real) |
| `valtozas_uj_telephely` | "Az új telephely címe" | "Ugyanúgy, mint a székhelynél: mezőnként írd be a címet és a napot, amikortól ott dolgozol." | the same address rows as `valtozas_uj_szekhely` with `{t…}` placeholders / the save button at the bottom of the form · kattints [ELLENŐRIZENDŐ: its exact label is below the capture] | owner 05 `telephely_mezok` (real) |
| `valtozas_tevekenysegek` | "3. Tevékenységek" | tevékenység: "Ha a fő munkád változik: „Új főtevékenység”. Ha csak egy újat kezdesz a mostani mellett: lent „Új tevékenység hozzáadása”." · others: "A tevékenységeiden nem változtatsz. Kattints a „Tovább” gombra." | Új főtevékenység (when `uj_fo`) / Új tevékenység hozzáadása (when `uj_mellek`) / Tovább · kattints. Warning (tevékenység): "Csak olyan tevékenységet jelents be, aminek a feltételeit teljesíted." | owner 06 `tevekenysegek` (real) |
| `valtozas_ovtj_kereso` | "A tevékenység keresése" | "Írj be egy szót vagy a kódot, és válaszd ki a sort a listából. Alá azt a napot írd, amikortól végzed." | Kereső · ird_be · {aKereso} (copy, e.g. the code) / A találat · valaszd · {aSor} / Adatváltozás ideje · ird_be · {valtozasNapja}; `holdWhenActivityPending` | owner 06 `ovtj_kereso` (real) |
| `valtozas_ellenorzes` | "4. Ellenőrzés" | "Nézd át, hogy minden úgy szerepel-e, ahogy szeretnéd. Ha igen, küldd be. A beküldött bejelentést nem lehet visszavonni." | Az új adatok · ellenorizd / the send button at the bottom of the page · kattints [ELLENŐRIZENDŐ label] | **drawn** until the owner's capture (§28.5.4) |
| `valtozas_megtekintes` | "Bejelentéseim, kérelmeim" | "A beküldött bejelentésed itt jelenik meg. Nyisd meg, és töltsd le az értesítést." | Megtekintés · kattints / Letöltés · kattints | owner 12 `megtekintes_3` crop around "Letöltés" (real) |
| `app_feltoltes` (ownApp) | "Töltsd fel nálunk" | "Az értesítést töltsd fel ide, hogy {firstName} lássa, és nálunk is átvezesse." | Feltöltöm az értesítést · kattints | none (own app) |
| `szunetel_inditas` | "Új bejelentés, kérelem benyújtása" | "Görgess le a szüneteltetésről szóló részhez, és indítsd el a bejelentést." | the szüneteltetés card's button · kattints [ELLENŐRIZENDŐ] | owner 03 (real; the card is below its cut-off – caption says so) |
| `szunetel_datum` | "A szünetelés kezdete" | "Add meg, melyik naptól szünetelteted a vállalkozásodat." | A szüneteltetés kezdő napja · ird_be · {szunetelKezdet}. Warning: "A bejelentett napot utólag nem lehet módosítani, és visszamenőleg sem adhatod meg." | drawn |
| `szunetel_ellenorzes` | "Ellenőrzés és beküldés" | "Nézd át, és küldd be. A beküldött bejelentést nem lehet visszavonni." | the send button · kattints | drawn |
| `onya_belepes` | "ONYA – belépés" | "Nyisd meg az ONYA-t (onya.nav.gov.hu), és lépj be Ügyfélkapu+-szal vagy DÁP-pal." | Belépés · kattints | copy of `meghatalmazas/01_onya_nyitooldal` (real) |
| `onya_profil` | "Profilválasztás" | "Válaszd a saját, magánszemély profilodat." | the own profile · valaszd | copy of `meghatalmazas/03_onya_profil` (real) |
| `t101e_kereses` | "Új nyomtatvány" | "Az „Új nyomtatvány” résznél írd a keresőbe: T101E. Válaszd: „Egyéni vállalkozó bejelentése”." | Kereső · ird_be · T101E (copy) / Egyéni vállalkozó bejelentése · valaszd | copy of `meghatalmazas/onya_uj_nyomtatvany` (real; caption: "Ugyanígy keresd, csak T101E-t írj be.") |
| `t101e_blokk` | "Csak a változó rész" | "Csak azt a részt töltsd ki, ami változik (például a munkavégzés jellegét). A többit hagyd üresen." Warning: "Ha bizonytalan vagy, ne küldd be: kérd, hogy {firstName} intézze." | the changed block · ird_be / every other block · hagyd | drawn |
| `t101e_bekuldes` | "Ellenőrzés és beküldés" | "Ellenőrizd, küldd be, és töltsd le a visszaigazolást." | Ellenőrzés · kattints / Beküldés · kattints | drawn |
Step lists:
- `valtozas_szekhely`: belepes, ugyseged_fooldal, valtozas_inditas, valtozas_szemelyi, valtozas_cimadatok, valtozas_uj_szekhely, valtozas_szekhely_mentes, valtozas_tevekenysegek, valtozas_ellenorzes, valtozas_megtekintes, app_feltoltes.
- `valtozas_telephely`: belepes, ugyseged_fooldal, valtozas_inditas, valtozas_szemelyi, valtozas_cimadatok, valtozas_uj_telephely, valtozas_tevekenysegek, valtozas_ellenorzes, valtozas_megtekintes, app_feltoltes.
- `valtozas_tevekenyseg`: belepes, ugyseged_fooldal, valtozas_inditas, valtozas_szemelyi, valtozas_cimadatok, valtozas_tevekenysegek, valtozas_ovtj_kereso, valtozas_ellenorzes, valtozas_megtekintes, app_feltoltes.
- `valtozas_szuneteltetes`: belepes, ugyseged_fooldal, szunetel_inditas, szunetel_datum, szunetel_ellenorzes, valtozas_megtekintes, app_feltoltes.
- `valtozas_adoadat`: onya_belepes, onya_profil, t101e_kereses, t101e_blokk, t101e_bekuldes, app_feltoltes.
Titles: "Így jelented be a költözést" / "Így jelentesz be új tevékenységet" / "Így jelentesz be telephelyet" / "Így szünetelteted a vállalkozásodat" / "Így jelented be az adózási adatod változását". Outro: "Kész. Ha a NAV elfogadta, töltsd fel az értesítést, és {firstName} nálunk is átvezeti." `GUIDE_VERSION` "2026-11-19.ot".

#### 28.5.4 Real screenshots – list, blur, annotation (B4; folder `C:/Users/UpgradePC/konyvelo_app/utmutato_kepek/`)
Source: `utmutato_kepek/sajat/vallalkozas_bejelentes/_nyers/` (captured 2026-11-19 11:30–11:45 in the built-in browser while the owner himself was logged in; read `OLVASS_EL.md` there). **Every file contains the owner's personal data.** Rules (binding):
- Raw files never leave `_nyers/`, are never copied to `kod/`, `kod/media/`, the server, a prompt, a test fixture or a report, and are never shown to anyone but the owner. Only blurred outputs go further.
- **No personal value is ever typed.** No `sajat/nevek.txt` with his name or address, no OCR text written to disk or logs, no values in `index.json`, captions, alt texts, commit-like notes or this SPEC. Blurring works by **region**: the OCR of `sajat_kepek.py` may locate text boxes in memory. Every page of these guides counts as a data page (`SZIGORU` for every new slug), so every word that is not a known NAV UI word is blurred. **Fixed manual rectangles** (`kezi.homalyos`, coordinates only) cover the regions below. The temporary work files are emptied (`munkafajl_urit`).
- Must be blurred where visible: the logged-in user's name (top right, every screen); viselt név, születési név, anyja születési neve, születési idő, születési hely, születési ország value, állampolgárság value, adóazonosító jel; nyilvántartási szám, adószám, statisztikai számjel, the register date; every address (aktuális székhely box, seat line on 03 and 12); the case ids (Azonosító / Ügyazonosító) and the submission timestamp; the "Aktuális főtevékenység" value box (conservative). Not blurred: field labels, buttons, the step bar, NAV's own explanatory texts, the ÖVTJ search example list entry (a public code list), the capture day in the "Változás napja" field.
- Annotation: brand-blue markers with numbers, as `annotate.py` does today. Every picture gets the caption from the step's `screenTitle` and the label line "NAV-képernyő · Forrás: saját képernyőkép, 2026. november 19." The alt text: "Képernyőkép: {screenTitle}. A személyes adatok elmosva. Kiemelve – {markers}."
- Mapping (`index.json` per kind; one picture can serve several kinds by copy):
| Raw file | Step key(s) | Markers | Extra blur |
|---|---|---|---|
| `02_fooldal_teljes.jpg` | `ugyseged_fooldal` | tab "Új bejelentés, kérelem benyújtása" | the request card's Azonosító and Benyújtás ideje values |
| `03_uj_bejelentes_meglevo_ev.jpg` | `valtozas_inditas`, `szunetel_inditas` | "Bejelentés kitöltése" | the whole right-hand value column of Személyi adatok, Vállalkozó adatai, Vállalkozói címadatok, Tevékenységek |
| `04_valtozas_szemelyi_adatok_kitoltve.jpg` | `valtozas_szemelyi` | "Születési ország", "Tovább" | the whole value column (`04_valtozas_szemelyi_adatok.jpg` is the fallback: it shows no values but is less true to life) |
| `05_valtozas_cimadatok.jpg` | `valtozas_cimadatok` | "Új székhely", "Új telephely hozzáadása", "Tovább" | the Aktuális székhely box |
| `05_szekhely_mezok_1.jpg` | `valtozas_uj_szekhely` | the field group, "Változás napja" | the Aktuális székhely box |
| `05_szekhely_mezok_2_telephely.jpg` | `valtozas_szekhely_mentes` | "Új székhely adatainak mentése", "Tovább" | – (check) |
| `05_telephely_mezok.jpg` | `valtozas_uj_telephely` | the Telephely(ek) field group | the Aktuális székhely box |
| `06_tevekenysegek.jpg` | `valtozas_tevekenysegek` | "Új főtevékenység", "Új tevékenység hozzáadása", "Tovább" | the Aktuális főtevékenység box |
| `06_ovtj_kereso.jpg` | `valtozas_ovtj_kereso` | the search box, the result line, "Adatváltozás ideje" | the Aktuális főtevékenység box |
| `12_megtekintes_3.jpg` | `valtozas_megtekintes` (crop: the bottom with "Letöltés") | "Letöltés" | every value above the Adózási adatok block |
| `12_megtekintes_1/2/3.jpg` | optional for the §27 start guide (Adózási adatok in checked state, pairing in `OLVASS_EL.md`) – B4 may use them there under the same rules | – | everything personal, the Ügyazonosító |
- **Missing real screens** (drawn "Rajzolt vázlat" until captured): `valtozas_ellenorzes`, `szunetel_datum`, `szunetel_ellenorzes`, `t101e_blokk`, `t101e_bekuldes`. B4 extends `SAJAT_KEPEK.md` with a short section "Változásbejelentés" for the owner. He captures step 4 "Ellenőrzés" of the change form and the szüneteltetés pages **without ever pressing the final button and without saving**. For the szüneteltetés the instruction is in bold: "Soha ne küldd be – azzal a saját vállalkozásodat szüneteltetnéd." For T101E he captures only up to the form's first page.
- QA (B4): `python utmutato_kepek/_eszkoz/sajat_kepek_proba.py` is extended so that every output picture is OCR'd again in memory. It asserts that no text is readable inside the blurred regions and that the top-right user area is blurred, and prints only counts. Review sheets `utmutato_kepek/_elonezet/sajat_ellenorzes_valtozas_*.jpg` (blurred) are for the owner to look at. B4 looks at every output picture before the normaliser runs.
- Note for the owner (§28.13 #37): the NAV created an empty draft change form ("Kitöltés alatt") in his account during the capture. Only he may delete it in the Ügysegéd ("Bejelentéseim, kérelmeim") – we never touch his account.

#### 28.5.5 Assisted path for changes (B1 backend, B2 app, B3 panel; extends §27.3)
- **Kinds:** `ASSIST_KINDS` + the 5 `CHANGE_KINDS`. `ASSIST_KIND_LABELS`: "Székhelyváltozás", "Tevékenységváltozás", "Új telephely", "Szüneteltetés", "Adózási adat változása". `ASSIST_CALLBACK_TOPIC` = `valtozas_helyettem` for all five ("Intézzétek helyettem: változás bejelentése"). `CALLBACK_ASSIST_TOPIC.valtozas_helyettem` is absent: choosing it in the generic callback form opens the hub. One open assist per kind and client (the existing unique index).
- **→ §28.K.1 / §28.K.2: an assisted change is paid in advance** (`valtozas_egyszeru` 4 999 Ft or `valtozas_jogallas` 7 999 Ft, DEMO until the owner confirms; new status `dijra_var` before `egyeztetve`); the self-service guide stays free; a 6th kind `valtozas_folytatas` exists (§28.K.6).
- **Request** (`/helyettunk?fajta=<changeKind>&forras=helyettunk_valtozas`, the §27.3.2 sheet, titled "Bejelentjük helyetted: {kindLabel}"):
  - On top the step list `CHANGE_STEP_LIST`: "1 · Te · Megadod az új adatokat · kb. 3 perc"; "2 · {firstName} · Átnézi, és ha kell, kiegészíti · általában 1 munkanap"; "3 · Te · Jóváhagyod az appban · kb. 1 perc"; "4 · {firstName} · Meghatalmazottként beküldi · általában 1 munkanap"; "5 · NAV · Elfogadja, és szólunk".
  - Then the never-credentials box (§27.3.7) and the **change data form** per kind (§28.5.6).
  - Then the toggle **"Hívjatok fel előtte"** (default off; forced on and not changeable for `adoadat` items `atalany_kilepes` / `afa_kilepes` with the line "Erről előbb beszéljünk.") with the §26.2.2 callback fields when on.
  - Primary **"Elküldöm"**. Toast "Megkaptuk. {firstName} átnézi, és szól."
- `POST /client/assist` with `{ kind: <changeKind>, source, change: ChangeData, callback?: boolean, phone?, window?, note? }`:
  - with callback → status `visszahivas_kerve` + callback (topic `valtozas_helyettem`);
  - without → status **`egyeztetve`** (the data is in). Notification `assist_task` variant `valtozas_adatok` to the accountant.
  - Requirements: the client's `szerzodes` step is `kesz`; otherwise 409 `step_locked` "Előbb fogadd el a szerződést.".
  - For Ügysegéd kinds after `CHANGE_UGYSEGED_VALID_UNTIL` → 409 `assist_disabled`.
  - Validation errors are field-level (§28.5.6).
- **State machine for change kinds** (reuses `ASSIST_STATUSES`):
```
visszahivas_kerve ──call + 'hivas' checklist (agreed)──► egyeztetve
egyeztetve ──accountant: 'valtozas_adatok' checklist + coverage OK (change-ready)──► meghatalmazas_el   ("Nézd át, mit jelentünk be")
egyeztetve ──coverage missing → UJEGYKE extension filed (ujegyke-filed)──► meghatalmazas_bekuldve → … §27.3.4 … → meghatalmazas_el
meghatalmazas_el ──client consent (valid hash)──► ugyfel_engedelyezte
ugyfel_engedelyezte ──accountant files + NAV PDF + 'valtozas_bejelentes' checklist (ev-filed)──► bejelentes_bekuldve
bejelentes_bekuldve ──csapat or admin, never the filer (change-done) + follow-ups──► kesz
any open before bejelentes_bekuldve ──client "Mégsem kérem"──► visszavonva ; staff "Lezárom" ──► lezarva
```
- New actions:
  - `adatok_rendben` → `POST /team/assists/:id/change-ready` (konyvelo, admin; the phase `valtozas_adatok` must be complete);
  - `valtozas_kesz` → `POST /team/assists/:id/change-done` (csapat, admin; the accountant only when the env `CHANGE_DONE_BY_FILER_ALLOWED=true` [OWNER], default false = four eyes).
  - `ev-filed` is reused for changes. The document category is `nav_visszaigazolas`, title "Változásbejelentés – NAV-értesítés ({date})", source `konyvelo`, visibility `kozos`.
- Checklists (`ASSIST_CHECK_ITEMS` + phases; `ASSIST_PHASES[changeKind]` = `['hivas', 'valtozas_adatok', 'valtozas_bejelentes']`; `hivas` only when a callback was requested):
  - `valtozas_adatok`: `adatok_teljesek` "Az új adatok teljesek, mezőnként a NAV szerint", `jogcim_rendben` "A jogcím rendben (székhely, telephely)", `ovtj_rendben` "Az ÖVTJ-sor kiválasztva (tevékenység)", `meghatalmazas_lefedi` "A meghatalmazás kiterjed az „Egyéni vállalkozói nyilvántartással kapcsolatos ügyek” csoportra (adóadatnál: ADÓÜGYEK)", `datum_rendben` "A változás napja rendben (szüneteltetésnél: nem múltbeli)".
  - `valtozas_bejelentes`: `kepviseletvalaszto` (existing), `adatok_egyeznek` (existing), `valtozas_bekuldve` "Beküldve, a NAV visszaigazolta", `ertesites_letoltve` (existing).
- **Consent** (`/valtozas/engedely?assist=<id>`, the §27.3.3 S17 pattern): blocks from `change_data` (each with "Módosítom" → the change form). Texts:
  - checkbox 1 (`CHANGE_CONSENT_TEXTS.declaration`): "Kijelentem, hogy az adatok igazak, és a változás {valtozasNapja} napjától érvényes.";
  - checkbox 2 (`instruction`): "Megbízom {konyveloNev} könyvelőt, hogy ezt a változást a nevemben, meghatalmazottként bejelentse a NAV-nál, pontosan ezekkel az adatokkal.";
  - button **"Engedélyezem a bejelentést"**.
  - `GET/POST /client/assist/:id/consent` as today (hash, stale 409).
  - Any edit of `change_data` invalidates the consent (§27.3.3 rule).
  - The instruction PDF uses the jogi template `valtozas_utasitas` (§28.10).
- **Client status texts** (`CHANGE_STATUS_CLIENT_TEXT`):
  - visszahivas_kerve "Visszahívást kértél. Kollégánk 24–48 órán belül hív."
  - egyeztetve "Megkaptuk. {firstName} átnézi az adataidat."
  - meghatalmazas_bekuldve: the §27 text
  - meghatalmazas_el "Nézd át, mit jelentünk be, és engedélyezd."
  - ugyfel_engedelyezte "Engedélyezted. {firstName} általában 1 munkanapon belül beküldi."
  - bejelentes_bekuldve "Beküldtük. Amint a NAV elfogadta, szólunk."
  - kesz "Kész: a NAV elfogadta. Az értesítést a dossziédban találod."
  - visszavonva / lezarva: as §27.
- **Notifications** (variants of existing kinds + `assist_change_done`):
  - `assist_consent_needed` · `valtozas`: "Nézd át, mit jelentünk be" / "Ha rendben van, engedélyezd. Kb. 1 perc."
  - `assist_ev_filed` · `valtozas`: "Beküldtük a változásbejelentésedet" / "Amint a NAV elfogadta, szólunk."
  - `assist_change_done`: "Kész: {kindLabel}" / "A NAV elfogadta. Az értesítést a dossziédban találod." + for the seat: " Írd át a címedet a számlázóprogramodban is."
  - `assist_task` · `valtozas_adatok`: "Nézd át: {clientName} – {kindLabel}" / "Az ügyfél megadta az új adatokat."
  - `assist_task` · `valtozas_bekuldes`: "Beküldheted: {clientName} – {kindLabel}" / "Engedélyezte. Küldd be meghatalmazottként."
  - `assist_task` · `valtozas_atnezes` (csapat): "Nézd át: {clientName} változásbejelentése" / "{firstName} beküldte. Nézd meg az értesítést, és zárd le."
- **Panel** `/helyettunk` (B3):
  - kind filter + "Változások" chip;
  - detail column 1 = `change_data` with a copy button per NAV field (irányítószám, település, közterület neve, jellege, házszám…, the ÖVTJ line, dates);
  - column 2 = the phases above with the buttons **"Adatok rendben – engedélyt kérek"** (`change-ready`), **"Beküldtem a változásbejelentést"** (`ev-filed`), **"A NAV elfogadta – lezárom"** (`change-done`);
  - the collapsible handbook `CHANGE_HANDBOOK`:
    - Ügysegéd kinds: "Ügyfélportál → Vállalkozói Ügysegéd → Képviseletválasztó „Más ügyében járok el” → az ügyfél → „Új bejelentés, kérelem benyújtása” → „Egyéni vállalkozással kapcsolatos adatváltozás bejelentése” → „Bejelentés kitöltése” → 1 Személyi adatok (Születési ország kötelező) → 2 Vállalkozói címadatok → 3 Tevékenységek → 4 Ellenőrzés → beküldés → Bejelentéseim, kérelmeim → Megtekintés → Letöltés → töltsd fel itt."
    - T101E: "onya.nav.gov.hu → a saját belépéseddel → a képviselt ügyfél kiválasztása → Új nyomtatvány → T101E „Egyéni vállalkozó bejelentése” → csak a változó blokk → Ellenőrzés → Beküldés → a visszaigazolás PDF-je → töltsd fel itt."
  - The never-credentials rule stays at the top, always visible.
- **Follow-ups on `change-done`** (`followups` jsonb; the panel shows them as a checklist with one-click actions; each is audited):
  - székhely: set `clients.hq_municipality`; review the HIPA rate and municipality in the tax profile; the client reminder about the invoicing software;
  - tevékenység: update `activity_text` / `activity_code`; re-confirm the költséghányad;
  - telephely: HIPA check for the other municipality;
  - szüneteltetés: add the `szunetel` insurance break from {from} (to {to}); resumption reminder date;
  - adóadat: update the tax-profile status (fő / mellék / nyugdíjas) from {date}.
  - The server never changes the tax profile by itself; the accountant clicks.

#### 28.5.6 Change data (`ChangeData`, `api.ts`) and the in-app change form (B2; one field group per screen, §27.0.3 B)
```ts
export interface NavAddress { zip: string; city: string; district?: string | null; streetName: string; streetType: string; houseNumber: string; building?: string | null; staircase?: string | null; floor?: string | null; door?: string | null }
export type ChangeTaxItem = 'munkavegzes' | 'kozossegi_adoszam' | 'atalany_kilepes' | 'afa_kilepes' | 'egyeb';
export type ChangeData =
  | { kind: 'valtozas_szekhely'; address: NavAddress; effectiveOn: ISODate; right: SeatRight; provider?: { name: string; adoszam: string } | null; alsoHomeAddress: boolean }
  | { kind: 'valtozas_telephely'; address: NavAddress; effectiveOn: ISODate; right: SeatRight; label?: string | null }
  | { kind: 'valtozas_tevekenyseg'; mode: 'uj_fo' | 'uj_mellek' | 'torles'; activities: BusinessActivityChoice[]; ownWords?: string | null; keepOldMain: boolean; effectiveOn: ISODate }
  | { kind: 'valtozas_szuneteltetes'; from: ISODate; to: ISODate | null }
  | { kind: 'valtozas_adoadat'; items: ChangeTaxItem[]; workKind?: WorkKind | null; effectiveOn: ISODate; note?: string | null };
// AssistCreateInput (+) change?: ChangeData; callback?: boolean   · AssistView (+) change?: ChangeData | null; activityPending?: boolean
```
- Screens and copy:
  - Address: "Hol lesz az új székhelyed?" / "Hol van az új telephely?" with fields Irányítószám, Település, Közterület neve, Közterület jellege (a select: utca, út, tér, köz, sor, körút, sétány, …), Házszám, Épület, Lépcsőház, Emelet, Ajtó.
  - Date: "Mikortól?" with the hint "A költözés napja" / "Ettől a naptól dolgozol ott".
  - Jogcím: "Milyen jogon használod?" with the `SEAT_RIGHT_LABELS` chips (+ provider name and adószám).
  - Tevékenység: "Mi változik?" with the chips "Más lesz a fő munkám" / "Egy újat kezdek a mostani mellett" / "Befejezek egyet". Then the activity picker of §26.1.3 (list + "Írd le a saját szavaiddal"). For a free-text activity the team writes the ÖVTJ line (`activityPending`, §26 rule; "általában 1 munkanapon belül").
  - Szüneteltetés: "Melyik naptól szünetelteted?" (≥ today, ≤ today + 60 days) and "Meddig? (nem kötelező)" (≤ from + 2 years).
  - Adóadat: "Mi változik?" with multi-chips "Munkaviszonyt kezdek vagy befejezek" / "Közösségi adószámot kérek" / "Kilépnék az átalányadózásból" / "Kilépnék az ÁFA-mentességből" / "Más" (+ the `WORK_KIND_LABELS` question when `munkavegzes`), "Mikortól?", note.
- Validation messages: "Négyjegyű irányítószám kell (például 1136)." · "Írd be a települést." · "Írd be a közterület nevét." · "Válaszd ki a közterület jellegét." · "Írd be a házszámot vagy a helyrajzi számot." · "A szüneteltetés nem kezdődhet a múltban." · "Legfeljebb két évig tarthat." · "Válassz legalább egy tevékenységet, vagy írd le a saját szavaiddal." · "Válaszd ki, mi változik."

---

### 28.6 Client app (B2) and panel (B3) – summary of screen changes

#### 28.6.1 App routes (new / changed)
| Route | What |
|---|---|
| `index` (Főoldal) | + "Félretenni" card (§28.1.6), + "Mennyit kerestem?" card (§28.4.4), + the allowances hint (§28.3.4) |
| `felretesz` | new, §28.1.6 |
| `dosszie/[honap]/szamlak`, `szamla/[id]` | + reserve lines and block, "Miért ennyi?" (§28.1.5) |
| `kereset` | new, §28.4.4 |
| `kedvezmenyek`, `kedvezmenyek/kerdoiv` | new, §28.3.4–§28.3.5; gate sheet after Adataid; journey row |
| `valtozas`, `valtozas/[fajta]`, `valtozas/[fajta]/utmutato`, `valtozas/engedely` | new, §28.5 |
| `helyettunk` | + the change kinds with the change form and the "Hívjatok fel előtte" toggle |
| `fiok/index` | + section "Adózás": "Adókedvezményeid" (`igazolas`), "Mennyit kerestem?" (`kivonat`; locked before activation), "Változás a vállalkozásodban" (`irat`) |
| `fiok/ertesitesek` | + "Csendes idő", "SZÁMLÁK" group, amounts toggle, "KEDVEZMÉNYEK" group (§28.2.3) |
| `keresek/uj`, `uzenetek`, `fiok/adataim` | change entries → hub (§28.5.2) |
| MINTA server | every new endpoint with fake data (the seed personas of §28.11) |
Design: the layout of `dizajn/C2_modern/app_v2/*.png` + `TERV.md`, colours `PALETTA.md` (brand #1428DB), Geist with tabular figures for amounts, only the approved realistic 3D icons (`fooldal`, `irat`, `boritek`, `tepnaptar`, `bevallas`, `szamlaszam`, `kivonat`, `igazolas`, `fiok`, `szamolo`, `ora`, `lakat`), the accountant avatar where he is named. No line icons, no pastel circles, no new pictures.

#### 28.6.2 Panel (B3)
- Client page: new tab **"Kedvezmények"** (§28.3.6).
- "Félretenni" columns (§28.1.9).
- Áttekintés "Ezt látja az ügyfél" mini card (reserve + earnings).
- Client list chip "Kedvezmény vár".
- `/helyettunk` change kinds (§28.5.5).
- The `/admin/szovegek` groups "Félretenni", "Új számla értesítés", "Kedvezmények", "Mennyit kerestem", "Változás-útmutatók".
- Labels for the new topics, sources, kinds and statuses.
- Mock: the seed personas.

#### 28.6.3 Restricted mode additions (`CLIENT_FEATURE_RULES`)
| Feature | Before activation | Reason (content `korlatozott.<feature>`) |
|---|---|---|
| `felretesz` | `zarva` | "A bekötés után nyílik meg. Akkor minden számládnál látod, mennyit tegyél félre." |
| `kereset` | `zarva` | "A bekötés után nyílik meg. Akkor látod, mennyi marad a bevételedből az adók után." |
| `kedvezmenyek` | `nyitva` | – |
| `valtozas` | `nyitva` (the assisted request needs the contract) | – |

---

### 28.7 Data model and migrations (B1; additive only; pg_dump to `/srv/kezjegy/_regi/` before)

#### 28.7.1 Files (`kod/backend/drizzle/`, the next two free numbers)
1. **`00NN_ot1119_enumok.sql`**: only `ALTER TYPE notification_kind ADD VALUE IF NOT EXISTS` for `invoice_new`, `allowance_submitted`, `allowance_decided`, `allowance_check`, `assist_change_done` (the order of `NOTIFICATION_KINDS`). No other statement; no later statement of the run uses them (§26.9.1 rule).
2. **`00NN+1_ot1119.sql`**:
   - `user_notification_settings` (`user_id uuid pk references users`, `quiet_enabled bool not null default true`, `quiet_from smallint not null default 20 check (quiet_from between 0 and 23)`, `quiet_to smallint not null default 8 check (quiet_to between 0 and 23)`, `push_show_amounts bool not null default true`, `updated_at timestamptz not null default now()`).
   - `nav_invoices` + `notify_state text null` (CHECK in `kuldve`, `osszevonva`, `kihagyva_elso_szinkron`, `kihagyva_regi`, `kihagyva_modositas`, `kihagyva_zarolt`), `notified_at timestamptz null`, `notification_id uuid null references notifications`. Partial index `(client_id) where notify_state is null`.
   - `reserve_years` (`client_id uuid references clients`, `year int`, pk (client_id, year), `inputs_hash text not null`, `base_huf bigint not null`, `total_huf bigint not null`, `fixed_by_month jsonb not null`, `engine_version text not null`, `computed_at timestamptz not null default now()`).
   - `revenue_reserves` (`revenue_item_id uuid pk references revenue_items`, `client_id uuid not null references clients`, `year int not null`, `seq int not null`, `raw_huf bigint not null`, `reserve_huf bigint not null`, `szja_huf bigint not null`, `tb_huf bigint not null`, `szocho_huf bigint not null`, `zone text not null` (CHECK `RESERVE_ZONES`), `crosses_tax_free bool not null default false`, `estimated bool not null default false`, `computed_at timestamptz not null default now()`). Index `(client_id, year, seq)`.
   - `allowance_answers` (`id uuid pk`, `client_id uuid not null references clients`, `year int not null`, `gate text null` (CHECK `ALLOWANCE_GATES`), `answers jsonb null`, `version int not null default 0`, `submitted_at timestamptz null`, `health_consent_at timestamptz null`, `health_consent_version text null`, `created_at`, `updated_at`; unique (client_id, year)).
   - `client_allowances` (`id uuid pk`, `client_id uuid not null references clients`, `year int not null`, `kind text not null` (CHECK `ALLOWANCE_KINDS`), `status text not null default 'javasolt'` (CHECK `ALLOWANCE_STATUSES`), `months smallint[] not null default '{}'`, `params jsonb not null default '{}'`, `params_prev jsonb null`, `in_year bool not null default true`, `proposal jsonb null`, `answers_version int not null default 0`, `decided_by uuid null references users`, `decided_at timestamptz null`, `reject_reason text null` (CHECK `ALLOWANCE_REJECT_REASONS`), `client_text text null`, `staff_note text null`, `created_at`, `updated_at`; unique (client_id, year, kind); index (status) where status in ('javasolt', 'kerdes')).
   - `assist_requests` + `change_data jsonb null`, `change_effective_on date null`, `change_ready_at timestamptz null`, `change_ready_by uuid null references users`, `change_done_at timestamptz null`, `change_done_by uuid null references users`, `followups jsonb not null default '{}'`. Widen the CHECK on `kind` (drop + re-add: the old values + the 5 change kinds).
   - Widen the CHECKs: `callback_requests.topic` + `valtozas`, `valtozas_helyettem`; `callback_requests.source` + `valtozas_utmutato`, `helyettunk_valtozas`, `kedvezmenyek`, `felretesz`, `kereset`.
   - Grants for `kezjegy_app` like the other tables (`deploy/db-roles.sh` pattern).
3. The Drizzle schema mirrors it; journal and snapshots via drizzle-kit (no hand-edited journal). Nothing is renamed or dropped. `client_tax_profiles.allowances` stays (legacy, read-only from now on in the client API; the panel shows it as "Régi jelzés").

#### 28.7.2 One-time data step `system_state['data.ot1119']` (worker start, idempotent; never touches `onboarding_steps`, `users`, consents, subscriptions, invoices or revenue rows)
1. Set `system_state['ot1119.invoice_notify_from']` = now() if absent. Invoices stored before it are never notified (`kihagyva_regi` lazily).
2. For every `client_tax_profiles` row of the current year with non-empty legacy `allowances` and no `allowance_answers` row: insert `allowance_answers { gate: 'lehet', version 0 }`. The client sees "Töltsd ki", the accountant sees "Régi jelzés". No note text is copied.
3. Nothing else. Re-running is a no-op. Afterwards the `alex@` / `tulaj@` snapshot (`deploy/tulaj-fiokok-allapot.sh`) must be identical, except for derived cache rows (`reserve_years`, `revenue_reserves`).

---

### 28.8 Notifications and jobs (B1; texts = `content_texts` defaults `notif.<kind>[.<variant>].title|body`, `email.<kind>.subject|body`)
| Kind | To | In-app | Push | E-mail | Texts |
|---|---|---|---|---|---|
| `invoice_new` (variants §28.2.4) | client | ✓ | ✓ (amounts allowed, §28.2.5) | – (default off) | §28.2.4 |
| `allowance_submitted` | the client's accountant (+ admin) | ✓ badge | – | digest | "{clientName} kitöltötte a kedvezmény-kérdőívet" / "Nézd át: {n} kedvezmény vár döntésre." |
| `allowance_decided` (`jovahagyva`, `reszben`, `kerdes`, `elutasitva`) | client | ✓ | ✓ | ✓ | §28.3.9 |
| `allowance_check` (`ev_eleje`, `lejar`) | client (+ accountant for `lejar`) | ✓ | ✓ | ✓ | §28.3.9 |
| `assist_change_done` | client | ✓ | ✓ | ✓ | §28.5.5 |
| variants `assist_consent_needed.valtozas`, `assist_ev_filed.valtozas`, `assist_task.valtozas_adatok/valtozas_bekuldes/valtozas_atnezes` | as §27.8 | | | | §28.5.5 |
- Push quiet hours per user for every client kind except `callback_calling` (§28.2.3).
- Jobs (`src/jobs-ot1119.ts`, one registration line in `jobDefs`):
  - `allowances_new_year` 1 January 00:20;
  - `allowance_check_yearly` 5 January 09:00;
  - `allowance_check_monthly` on the 1st at 09:00;
  - the staff digest line "Kedvezmény vár: N" and "Változásbejelentés vár rád: N".
  - The NAV-sync hook is not a job: it is the call at the end of `syncClient` (§28.2.1).

---

### 28.9 API and content keys (B1; `/api/v1`; DTOs from `kod/shared/src/api.ts`)
Roles: `C` client, `A` accountant (own clients only, others 404), `AD` admin, `T` csapat. Errors: §3.5 + §26.10 + §27.9.1, plus `allowance_locked` 409 (an answers edit while a decision is being saved, retry), `locked_until_active` 403 (features `felretesz`, `kereset`).
| Method path | Auth | Request → Response |
|---|---|---|
| `GET /client/home` | C | + `reserve: ReserveCard \| null`, `earnings: EarningsCard \| null`, `allowancesHint: { show: boolean } \| null` |
| `GET /client/nav-invoices[?month]` · `/:id` | C | + `reserve?: InvoiceReserveView` per item / on the detail |
| `GET /client/reserve?year=` | C | → **ReserveView** |
| `GET /client/earnings?year=` | C | → **EarningsView** |
| `GET /client/allowances?year=` | C | → **AllowanceState** |
| `PUT /client/allowances/answers` | C | **AllowanceAnswersInput** → **AllowanceState** (`submit: false` = draft, `true` = submit + proposal + notify) |
| `POST /client/allowances/gate` | C | **AllowanceGateInput** → **AllowanceState** |
| `POST /client/allowances/preview` | C | `{ year, answers }` → `{ items: { kind, label, effectYearHuf, onlyAnnual: boolean }[] }` (K12 estimate; never stored) |
| `GET /client/change-guides` | C | → `{ items: { kind, title, line, icon, outdated, openAssist: AssistView \| null }[] }` |
| `GET /client/guides/:kind` | C | + the 5 change kinds (`video: null`, personalised from the open change assist) |
| `POST /client/assist` | C | + change kinds with `change`, `callback` (§28.5.5) |
| `PUT /client/assist/:id/change` | C | `{ change: ChangeData }` → **AssistView** (allowed until `bejelentes_bekuldve`; invalidates the consent) |
| `GET/POST /client/assist/:id/consent` | C | + change kinds (blocks from `change_data`) |
| `GET /me` · `PATCH /me` | all | + `notificationSettings` (§28.2.3) |
| `GET /acc/clients/:id/reserve?year=` | A, AD | → **ReserveView** (incl. manual items) |
| `GET /acc/clients/:id/earnings?year=` | A, AD | → **EarningsView** |
| `GET /acc/clients/:id/allowances?year=` | A, AD | → **AccAllowanceView** (T → 404) |
| `POST /acc/clients/:id/allowances/:kind/decision` | A, AD | **AllowanceDecisionInput** → **AccAllowanceView** |
| `POST /acc/clients/:id/allowances/preview` | A, AD | **AllowancePreviewInput** → **AllowancePreview** |
| `GET /acc/clients` | A, AD | + `allowancesPending` per row; query `?kedvezmeny=var` |
| `GET /acc/clients/:id` | A, AD | **AccClientDetail** + `allowancesPending`, `reserve: ReserveCard \| null`, `earnings: EarningsCard \| null` |
| `POST /team/assists/:id/change-ready` | A, AD | `{}` → **TeamAssistDetail** |
| `POST /team/assists/:id/change-done` | T, AD (A only with `CHANGE_DONE_BY_FILER_ALLOWED`) | `{ followups?: string[] }` → **TeamAssistDetail** |
| `PATCH /team/assists/:id/followups` | A, AD | `{ key, done: boolean }` → **TeamAssistDetail** |
Audit:
- `reserve.recomputed` (no details beyond counts);
- `invoice.notified` (ids count, variant);
- `allowance.answers_submitted|decided|health_consent|gate`;
- `assist.change_ready|change_done|change_updated|followup`;
- `me.notification_settings`.
- `details` never hold answers, note texts, addresses or tax ids.
Content keys (defaults generated by `backend/src/content/ot1119.ts` from the shared constants; editable in `/admin/szovegek`, placeholder check as §27.9.2):
| Group | Keys | From |
|---|---|---|
| Félretenni | `felretesz.sor.<zone>`, `felretesz.lista.<key>`, `felretesz.kartya.<key>`, `felretesz.miert.szoveg`, `felretesz.becsles.<reason>` | `RESERVE_TEXTS` |
| Új számla értesítés | `notif.invoice_new.<variant>.title\|body`, `email.invoice_new.*` | `NOTIFY_INVOICE_TEXTS` |
| Kedvezmények | `kedvezmeny.kerdoiv.<page>.<key>`, `kedvezmeny.allapot.<status>`, `kedvezmeny.sor.<kind>`, `kedvezmeny.cimke.<kind>`, `kedvezmeny.kapu.<key>` | `ALLOWANCE_*` |
| Mennyit kerestem | `kereset.<key>` | `EARNINGS_TEXTS` |
| Változás-útmutatók | `valtozas.<kind>.<key>`, `valtozas.allapot.<status>`, `valtozas.engedely.<key>`, `valtozas.kezikonyv.<key>` | `CHANGE_*` |
| Restricted | `korlatozott.felretesz`, `korlatozott.kereset` | §28.6.3 |

---

### 28.10 Legal texts (B4; `kod/jogi`; drafts "TERVEZET – jogász ellenőrzi"; `requiresReconsent: false` in this round, [JOGI] decides before go-live)
- **`adatkezeles.md`** – two new sections:
  - "Adókedvezmények":
    - the data: birth year and month, anonymous child data (családi pótlék yes/no, tartósan beteg, felváltva gondozott), pregnancy month, marriage month, disability months and basis, the benefit months, the accountant's decisions;
    - **no** names, birth dates of children, TAJ or tax IDs in the questionnaire (the tax IDs come later with a document request, only for the return);
    - purpose: the tax advance and the return;
    - basis: contract (6. cikk (1) b)), and for the health flags explicit consent (9. cikk (2) a)), which can be withdrawn by changing the answer;
    - who sees it: the client's accountant and admin, not the service team;
    - retention: like the year's tax documents [JOGI/OWNER].
  - "Változás bejelentése helyetted": the change data, consent (text version, hash, frozen copy, time, IP code, user agent), the instruction PDF, the NAV értesítés.
  - Also "Értesítések": the new invoice notification may show the amount and customer on the phone; the client can switch this off; quiet hours.
- **`aszf.md`** – the §27.10 "Intézzük helyetted" section is extended to changes (székhely, telephely, tevékenység, szüneteltetés in the Vállalkozói Ügysegéd as registered meghatalmazott; tax data in ONYA). ~~Part of the service, no separate fee~~ → §28.K.1: prepaid fee for assisted changes (self-service with the guide: 0 Ft). The Ügysegéd part runs until the register moves (2026-12-31) [OWNER/JOGI]. The "Félretenni" and "Mennyit kerestem?" numbers are estimates, not tax advice or a payment order; the binding amount is the approved quarterly amount.
- **NEW `sablonok/valtozas_utasitas.md`** (version `2026-11-19`): "Utasítás a változás bejelentésére" – client name, masked adóazonosító jel, accountant name + nyilvántartási szám, the change blocks, the declaration and instruction texts exactly as shown, date and time, "Az alkalmazásban elektronikusan elfogadva", hash. Placeholders like `ev_bejelentes_utasitas` (§24 B4 note), values sanitised with `biztonsagosErtek()`.
- **`app_szovegek.json`** (+ `.md`) – FAQ 13 → 17 (update the checker; `npm run minden` passes; regenerate `pdf_minta/`):
  - "Mennyit tegyek félre az adóra?" – "Minden kiállított számládnál megmutatjuk, kb. mennyivel nő miatta az idei adód. A Főoldalon azt is látod, most mennyi legyen félretéve. Ez becslés: a befizetendő összeget negyedévente a könyvelőd hagyja jóvá."
  - "Miért nem mindig ugyanannyi a félreteendő?" – "Mert az első 1 936 800 Ft jövedelmed adómentes, és főállásban havonta egy minimum járulékot mindenképp fizetsz. Ezért az év elején kevesebb, később több jut egy számlára. Felfelé kerekítünk, hogy ne maradj kevesebbel."
  - "Milyen adókedvezmény jár nekem?" – "Gyerekek után, 25 év alatt, édesanyáknak, friss házasoknak vagy súlyos betegség miatt járhat. A Fiókban egy rövid kérdőívvel megnézheted. Neveket nem kérünk, a könyvelőd átnézi, és amit jóváhagy, azt beszámoljuk az adódba."
  - "Hogyan jelentem be, ha költözik a vállalkozásom?" – "A Fiókban, a „Változás a vállalkozásodban” résznél lépésről lépésre megmutatjuk. Ha nem boldogulsz vele, kérd, hogy a könyvelőd meghatalmazottként bejelentse helyetted – neked csak jóvá kell hagynod."
- Strip `[JOGI…]` / `[TULAJ…]` / `[KÖNYVELŐ…]` from every client text (§27.10 rule).

---

### 28.11 Demo data `seed:ot1119` (local harness + live demo DB; idempotent; refuses `APP_ENV=production`; never touches existing rows – especially `alex@`, `tulaj@`, `bence.kovacs@`, `david@` / Fendrik Dávid; passwords only appended to `/srv/kezjegy/demo_belepesek.txt`, never printed; fake data only)
1. **Szabó Eszter** (`eszter.szabo@demo.kezjegy.test`, login, `aktiv`, accountant Bence, 45 %, mellékállású):
   - 2026 fake invoices about 600 000 Ft/month, customers "Bodza Kiadó Kft.", "Csipke Műhely Bt.", "Magánszemély";
   - allowance answers submitted: birth 1990-04, 2 own children with `potlek 'most'`, mother, `csaladiWho 'kozosen'` 50 %;
   - proposal: `anyak ket` + `csaladi` (2/2, 50 %) as `javasolt` → Bence approves in the panel demo. Harness `?ki=eszter`.
2. **Tóth Bálint** (`balint.toth@demo.kezjegy.test`, login, `aktiv`, főfoglalkozású, 45 %):
   - birth 2002-03 → `fiatal25` **approved**;
   - invoices, the last two created today: one `invoice_new` in-app row (single) and one `tobb` row with 2 items.
   - Harness `?ki=balint`.
3. **Kovács Ádám** (`adam.kovacs@demo.kezjegy.test`, login, `aktiv`): an open assist `valtozas_szekhely` in `meghatalmazas_el` with fake `change_data` ("1117 Budapest, Próba utca 3.", from 2026-12-01) → the consent screen. Harness `?ki=adam`.
4. **Varga Réka-Demo** (`reka.varga2@demo.kezjegy.test`, no login): an assist `valtozas_szuneteltetes` in `bejelentes_bekuldve` (with a fake NAV PDF from `pdf_minta`) for the csapat's change-done demo.
5. In-app notifications as the code would create them. `kod/deploy/seed-ot1119.sh` (B1) mirrors `seed-tulaj1119.sh`. `kod/app/scripts/helyi-proba.mjs` (B2) calls `seedOt1119` after `seedTulaj1119` when present.
6. Fendrik Dávid gets **no new rows**. His reserve and earnings cards appear because they are computed views (the cache rows are derived).

---

### 28.12 Acceptance tests (backend vitest on PGlite; app + panel on the local harnesses with the seed; live checks only with curl, never typing passwords on the live host)
**K1 – Félretenni (order 1)**
- K1.1 Engine R1–R10 green (B4). Every existing engine test unchanged.
- K1.2 Backend:
  - `GET /client/nav-invoices/:id` for the seed returns `reserve` with the engine's raw value and the rounding rule;
  - the cache recomputes after a new revenue item, a `received_on` edit and an allowance approval (hash changes), and not otherwise (call-count spy);
  - restricted client → 403;
  - the home card: A, B and keepNow match a hand fixture (Bálint: B = the approved Q1–Q3; keepNow = A − B rounded up).
- K1.3 App (390×844 and 360×780): the list line, the detail block, "Miért ennyi?", the home card and `/felretesz` for Eszter and Bálint, with screenshots `kod/app/_kepek/k28_felretesz_*.png` LOOKED at. There is no "fizetendő" wording in the reserve texts, and the number wraps but never truncates at 320 px.
- K1.4 Panel: the "Félretenni" column equals the API; the tooltip parts are correct.

**K2 – notification (order 2)**
- K2.1 A sync with 1 new invoice for an active client → 1 `invoice_new` row, push at 08:00 when the sync runs at 05:30 (fake clock), text with the amount, customer and reserve.
- K2.2 3 new invoices → 1 `tobb` row; a second manual sync before 08:00 folds into it (one push); a third push on the same day → in-app only.
- K2.3 None for: STORNO / MODIFY, the first sync, `bekotes_alatt`, an issue date older than 10 days, invoices stored before `invoice_notify_from`. A re-run never double-sends (dedupe).
- K2.4 `push_show_amounts=false` → the push title "Új kiállított számlád érkezett", the in-app row full. A private-person customer → "Magánszemély" in every channel.
- K2.5 Quiet hours 22–6 → the push waits until 06:00; disabled → immediate. `callback_calling` is never delayed.
- K2.6 App settings screen: toggles and hour pickers save and reload; screenshot LOOKED at.

**K3 – allowances (order 3)**
- K3.1 Engine T1–T22 green (B4).
- K3.2 `proposeAllowances` unit tests: one per bullet of §28.3.3, incl. the 1985/1986 and 1995/1996 boundaries, the 25th-birthday month, a wedding in May (June–December), the pregnancy day-91 month, felváltva, tartósan beteg, `par`.
- K3.3 API:
  - submit → items `javasolt`, notification to the accountant;
  - approve → the engine numbers change (the Eszter Q4 estimate drops); `kerdes` → message + notification;
  - resubmit with a changed child → the approved item goes back to `javasolt` with `params_prev`;
  - csapat → 404;
  - health answers without consent → dropped and the 400 field message; with consent → saved, audited.
- K3.4 Minimisation grep: no child name, child birth date, TAJ or tax id field in `AllowanceAnswers`, the questionnaire components or the DB columns (a script asserts the zod schema keys).
- K3.5 App: the questionnaire pages K0–K12 for Eszter (mother of two), Bálint (under 25) and a "nothing applies" persona; the gate sheet after Adataid on the harness; the journey row is not counted in `todoCount` (badge unchanged); `/kedvezmenyek` in every status. Screenshots `k28_kedvezmeny_*.png` LOOKED at.
- K3.6 Panel: the tab, the preview updating on month toggles, approve / ask / reject, the "Kieső időként felveszem" flow, the client list chip.

**K4 – Mennyit kerestem? (order 4)**
- K4.1 Engine E1–E4 green.
- K4.2 API: months sum to the YTD; the basis changes `becsles` → `jovahagyva` → `befizetve` after approve and "Már befizettem"; projection `reliable=false` before day 60 of activity.
- K4.3 App: the home card + `/kereset` for Bálint (a negative month shown with the note when the seed has one), screenshots LOOKED at.

**K5 – change guides (order 5)**
- K5.1 Pictures:
  - `kepek.json` exists for the 5 kinds, every file exists, `kind` matches;
  - every real picture has `source` "saját képernyőkép, 2026-11-19";
  - the drawn ones carry the drawn label;
  - `sajat_kepek_proba.py` passes (no readable text in the blurred regions, the user name area blurred);
  - B4 LOOKED at every output.
  - **Grep guard:** no file under `kod/`, `utmutato_kepek/` (outside `_nyers/`) or `_munka/` contains any OCR text dump (search for the `elmosott_szoveg`-style keys: none exist).
- K5.2 Guides: `GET /client/guides/valtozas_szekhely` personalised from Ádám's change data (address split per field, copy values); without a change assist the generic values appear; after `CHANGE_UGYSEGED_VALID_UNTIL` (fake clock 2027-01-02) → `outdated` with the text; `valtozas_adoadat` is still valid.
- K5.3 Assisted path:
  - without a callback → `egyeztetve` + `assist_task valtozas_adatok`;
  - with a callback → `visszahivas_kerve`;
  - `adatok_teljesek` missing → 400; `change-ready` → `meghatalmazas_el` + `assist_consent_needed valtozas`;
  - consent with the hash → `ugyfel_engedelyezte` + instruction PDF; editing the change data → consent invalid;
  - `ev-filed` with a PDF → `bejelentes_bekuldve` + a `nav_visszaigazolas` document;
  - `change-done` by the filer → 403; by csapat → `kesz` + `assist_change_done` + follow-ups listed.
- K5.4 Never-credentials text present on the change request sheet; the grep of §27 K3.9 still 0 hits.
- K5.5 App: the hub, every info page, the szekhely guide steps with real pictures, the change form validation, the consent screen (Ádám), screenshots `k28_valtozas_*.png` LOOKED at; the assisted card visible without scrolling on every info page at 390×844.
- K5.6 Panel: `/helyettunk` with a change kind; copy buttons; follow-up actions open the tax-profile editor prefilled (szüneteltetés → `szunetel` break).

**KS – safety:**
- §26.14 S1/S2 unchanged (pg_dump, Gardoko health 200 before and after, the `alex@` / `tulaj@` snapshot identical, the seed idempotent);
- the data step changes no `onboarding_steps`, `nav_invoices` amount or `revenue_items` row (row count + checksum before and after);
- Fendrik Dávid's and Bence's data unchanged except for the derived cache rows;
- the §27 K5.1 invoice-wording script over all new texts → 0 hits;
- no "AI" in public texts.

---

### 28.13 Waits (additions to §23 / §26.15 / §27.13)
| # | Item | Who | Until then |
|---|---|---|---|
| 30 | Push of `invoice_new` shows the amount and customer by default (owner's order); keep the default ON? | OWNER / JOGI | ON, with the toggle (§28.2.5) |
| 31 | Partial-year mothers' and under-25 allocation: by the month of receipt (our default) or pro rata by months (Szja tv. 49. § (7)–(8)) | KÖNYVELŐ | by month of receipt |
| 32 | Csjk with garantált bérminimum (Tbj. 34. § (6) says "minimálbér") | KÖNYVELŐ | the applied monthly minimum |
| 33 | Default for in-year csjk (2658 SZJA declaration needed) and the advice on the családi split with an employee spouse | KÖNYVELŐ | off unless the client asks and the accountant approves |
| 34 | Allowances and `priorOverrides` (months of the previous accountant are skipped) | KÖNYVELŐ | skipped |
| 35 | Exact NAV wording: the change form's final button, the telephely save button, the szüneteltetés card; the 15-day deadline; szüneteltetés min / max and resumption (Evectv. 18.–19. §) | B4 research → OWNER capture | the sentences stay out of the app until confirmed; drawn pictures |
| 36 | Owner capture of the change form's "Ellenőrzés" and the szüneteltetés pages, **never pressing the final button** | OWNER | "Rajzolt vázlat" |
| 37 | The empty draft change form the NAV created in the owner's account on 11-19 – delete or leave | OWNER (only he) | left as it is |
| 38 | ~~Change assists: part of the subscription (no fee)~~ → §28.K.1 (prepaid fees); four eyes on `change-done` (`CHANGE_DONE_BY_FILER_ALLOWED=false`) | OWNER | fees as §28.K.1; four eyes as written |
| 39 | ~~Subscription during the client's szüneteltetés~~ → §28.K.6: availability fee 2 999 Ft/month (DEMO) | OWNER | §28.K.6 |
| 40 | Lawyer: health data consent wording and retention, the change-instruction PDF as the meghatalmazó's instruction, push content on the lock screen | JOGI | drafts |
| 41 | 2027 values: the under-25 cap (KSH July 2026), the 2027 minimum wage (személyi, adómentes), 2027 HIPA bands; the EV register at the chamber from 2027 (change guides) | B4 when published / OWNER | 2027 draft + `CHANGE_UGYSEGED_VALID_UNTIL` |
| 42 | Status changes during the year (mellékállás ↔ főfoglalkozás) are not dated in the engine: the reserve and earnings use the year's status | B4 later | documented in "Miért ennyi?" via the accountant |

### 28.14 Sources
- Research of 11-19 `C:/Users/UpgradePC/konyvelo_app/_munka/k6/kedvezmenyek_2026.md` and its sources:
  - Szja tv. (njt.hu, state 2026.10.01) 29. §, 29/A–29/H. §, 46. § (9), 49. § (1), (1a), (4), (6)–(8), 1. sz. melléklet 4.48: https://njt.hu/jogszabaly/1995-117-00-00
  - 2025. évi XIII., XIV., XV., XVI. tv.: https://njt.hu/jogszabaly/2025-13-00-00 · …/2025-14-00-00 · …/2025-15-00-00 · …/2025-16-00-00
  - Tbj. 34–36. §, 40. § (2)–(3), 80–81. §: https://njt.hu/jogszabaly/2019-122-00-00
  - Szocho tv. 5. § (1a): https://njt.hu/jogszabaly/2018-52-00-00
  - NAV 73. füzet (2026.03.19): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/73.-Szja-adoalap-kedvezmenyek-2026.-03.19
  - NAV 100. füzet (2026.02.20): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/100.-Az-egyeni-vallalkozok-atalanyadozasanak-alapveto-szabalyai-2026.-02.-20
  - NAV 3. füzet (2026.08.31): https://nav.gov.hu/pfile/file?path=/ugyfeliranytu/nezzen-utana/inf_fuz/2026/03.-Az-egyeni-vallalkozok-szja--es-jarulekkotelezettsege-2026.-08.-31.
  - NAV "Így adózunk idén" (2026.01.05): https://nav.gov.hu/sajtoszoba/hirek/Igy_adozunk_iden
- Engine runs on `kod/ado-motor/dist` (2026-11-19): the baselines, R1–R7 and the telescoping check quoted in §28.1.3 and §28.3.8.
- NAV Vállalkozói Ügysegéd útmutató (2026.03.19) pp. 4–5, 12, 18 (the change channels, §24 `REGISTRATION_FIX_CHANNEL_TEXT`).
- The owner's own captures of 2026-11-19 (`utmutato_kepek/sajat/vallalkozas_bejelentes/_nyers/`, not distributed): the 4-step change form, the fields of Vállalkozói címadatok and Tevékenységek, the mandatory "Születési ország", the Megtekintés notice about the szüneteltetés date and that filings cannot be withdrawn.
- §27.13 #26 and §27.14 (MKIK 2027, MINKE) for the 2027 register move.

---

### 28.K Kiegészítés 11-19 délután–este (owner orders A–N, prices, change fees) – contract

Written 2026-11-19 ~20:00 by the SPEC author (B0) after reading the subscription/payment (`services/subscription.ts`, `payments/*`, `§9`), notification (`notify/notify.ts`, `jobs.ts`, `jobs-tulaj1119.ts`), onboarding (`services/onboarding.ts`, `journey.ts`, `access.ts`) and request (`services/requests.ts`) code, the research `_munka/k6/kata_2026.md` (cited **[KATA]**), `_munka/accountable_2026-11-19.json`, the owner-approved mockups `dizajn/C4_atlathato/valasztott/` (variant C, 20:10) + `C_elvalaszto/` (the separator, 20:20) + `VALASZTAS.md` (`B_kisebb/` for content patterns only), the real NAV captures' label file `_privat/nav_bogi_1119/adozasi_adatok_oldal_szovege.md` (NAV UI words only) and `_munka/k6/k5_nyitott.json`. **§28.K wins over §28 and every older section where they differ.** The shared contract for §28 and §28.K is already in `kod/shared` (§28.K.24); builders never edit `kod/shared`.

#### 28.K.0 Orders → sections, precedence, principles, builders

| # | Owner's words (11-19, translated / quoted) | Where |
|---|---|---|
| A | Monthly check-in "Változott valami?": still főállású / mellékállású (36-hour threshold), moved, new activity, new child / allowance, pension; "Nem változott" ends; any "Igen" → follow-ups, plain explanation, the fee, **paid in advance**, a task for the team | §28.K.2 |
| B | Annual closing fee (SZJA return + HIPA return) besides the monthly fee; in-app annual questionnaire (other incomes, allowances = feature 3, HIPA data, anything the accountant needs), deadline reminders | §28.K.3 |
| C | Automatic reminders: document upload and tax payment exactly when relevant (settings + quiet hours), nudges after 3 and 7 days for open requests | §28.K.4 |
| D | Unpaid subscription / closing fee (after the existing retry schedule) → profile LOCKED for accounting service (no approvals, letters, filings, new requests; the panel shows it) until payment; paying, GDPR download and writing to customer service keep working; clear wording | §28.K.5 |
| E | While the business is suspended: a small monthly availability fee instead of the full fee | §28.K.6 |
| F | No payroll now: ask "Van alkalmazottad vagy egyszerűsített foglalkoztatottad (EFO)?" (onboarding + monthly check); if yes the app says it plainly and the accountant decides (individual offer or decline) | §28.K.7 |
| G | Public tax calculator (15:25 "mehet nyugodtan") on the client web origin, embeddable later on adozz.hu | §28.K.8 |
| H | Auto-fill by adószám (Billingo-like) through NAV queryTaxpayer with OUR technical user; type-ahead card "Ez a te vállalkozásod?"; "Hol találom?"; "Most nem tudom" → manual form (15:45, 15:50) | §28.K.9 |
| I | App-wide clarity + size pass (16:55 "Úgy minden túl nagy…", 17:10 "Sokkal jobb így, egész appot megcsinálod ilyen stílusra!", 20:10 "a C sokkal jobb", 20:20 "nem így gondoltam, előző jobb volt, csak valami elválasztó köztük"): variant C (`valasztott/`) + an 8 px light band between sections (`C_elvalaszto/`) is the standard; `C_retegek/` (stacked sheets, shadows, darkening) is rejected | §28.K.10 |
| J | KATA clients end to end (17:20 "a katásokat is … csináljuk"; 17:25 price "Ugyanannyi lesz") | §28.K.11 |
| K | Patterns from Accountable (19:05): two big numbers, payment card, put-aside ring, deadlines by quarter, photo capture + status tabs, personal forwarding e-mail, suggested questions, no paywall surprises | §28.K.12 |
| L | Real new-business screens (his sister's capture, with consent) replace the drawn pictures; KATA variant; real labels; video re-render; strict privacy | §28.K.13 |
| M | The 29 open k5 findings | §28.K.14 |
| N | 19:30 "a munkanapon 4 órán belül és nincs buta kérdés nem kell, ne írj időt, csak olyan gyorsan, ahogy lehet" | §28.K.15 |
| P | PRICES: monthly fee **19 999 Ft** gross everywhere; annual closing, change and suspension fees admin-editable, DEMO mark until confirmed. CHANGE FEES (~15:00 "Ez jó lesz"): self-filed with our guide **0 Ft**; assisted simple change **4 999 Ft**; change of legal status **7 999 Ft**; paid in advance | §28.K.1 |

**Precedence – what §28.K changes in §28 and older sections:**
- §1, §9.2, §9.3, `brand.json` and every text/test/fixture: the monthly fee is **19 999 Ft** (was 20 000). `brand.json.priceHufMonthlyGross` = 19 999 (done in shared); `PLAN_PRICE_HUF` default follows; the admin fee setting of §28.K.1 overrides it at runtime.
- §28.5.5 / §28.10 / §28.13 #38: assisted changes are **not free any more**: the fee of §28.K.1 is paid before the team acts (new assist status `dijra_var`). The self-service guides stay free. The EV registration assist and the meghatalmazás assist of §27.3 stay free (`ASSIST_TEXTS.free` stays for them only).
- §28.13 #39: during szüneteltetés the client pays the availability fee (§28.K.6).
- §28.3 allowances do not reduce a KATA client's tax (§28.K.11); the questionnaire says so.
- §28.1 / §28.2 / §28.4 get a KATA view (§28.K.11).
- §27.4 journey: new rows `alkalmazottak` (§28.K.7) and `kedvezmenyek` (§28.3.4).
- §26.5 restricted mode: plus the service lock of §28.K.5 (a second, independent lock).
- `WORK_KINDS` + `rovid_munkaviszony_mellett` (the real NAV option [3], §28.K.13).
- §28.3.4 K12 and every answer-time promise (§28.K.15).
- Every screen description of §26–§28 ("white sheet", 3D icons 36/44 pt, questions 22 pt, 56 pt buttons, blue section titles) is restyled by §28.K.10: variant C with the 10 px `#D3DAFC` band between sections (C_VEGLEGES, owner 11-19 20:40); no shadows, stacked sheets or darkening layers.

**Principles (in addition to §26.0, §27.0.2, §28.0.2):**
1. **No surprise fees.** Every fee is shown before the client chooses (amount, what it covers, when it is charged). Extra fees exist only for: the annual closing, an assisted change, the suspension availability fee. Everything else is in the monthly plan (Accountable lesson: paywall anger).
2. **Pay first, then we act.** A fee-bearing action starts only after SimplePay `FINISHED`. A failed or abandoned payment changes nothing.
3. **Fees are settings, not code.** Amounts live in `fee_settings` (admin-editable, history kept); an unconfirmed amount carries the amber "DEMO" mark next to the price on every client and panel screen and in e-mails.
4. **The law decides the KATA words.** In 2026 a business customer does not cause "40 % tax": a payment from a kifizető **ends the KATA** the day before it arrives ([KATA] §3). The owner's "40 % risk" wording is replaced by the legally correct warning; 40 % különadó applies only above the 18 M Ft (prorated) keret. 50 000 Ft/month in 2026; 75 000 Ft only in the 2027 draft (T/928, not law) – shown nowhere as a 2026 amount.
5. **One look.** Every new or touched screen uses the C look and scale with the 8 px separator band (§28.K.10). Real 3D icons only, Geist, brand #1428DB, no line icons, no pastel circles.
6. **Live data safety** exactly as §28.0.2 (7): additive migrations, pg_dump first, the four protected accounts unchanged except derived rows, Gardoko health before/after.
7. **Privacy.** The calculator stores nothing; the taxpayer lookup is called only with the client's own adószám at his request; the forwarding mailbox accepts only the client's own senders; the sister's NAV captures are blurred before anything leaves `_privat/` (§28.K.13).

**Builders (same rules as §28.0.5; ports, harnesses, "nobody deploys"):**
| Builder | Owns for §28.K (in addition to §28.0.5) |
|---|---|
| B1 backend | `src/services/{dijak,havi-ellenorzes,eves-zaras,emlekezteto,zarolas,szuneteltetes,alkalmazott,adoszam-kereso,kata,postafiok}.ts`, `src/routes/{client-k28,acc-k28,admin-k28,public-k28,inbound-k28}.ts`, `src/jobs-k28.ts` (one registration line in `jobDefs`), `src/content/k28.ts`, `src/seed/k28.ts`, `kod/deploy/seed-k28.sh`; edits in `services/subscription.ts` (charge amount, lock hooks, one-time payments), `services/assist.ts` + `routes/team-helyettunk.ts` (`dijra_var`), `services/access.ts` (service lock), `notify/notify.ts` (kinds), `services/navsync.ts` (`customer_vat_status`, KATA hook), `db/schema.ts` + migrations, `routes/acc.ts` settings validation (§28.K.15) |
| B2 app | all client screens of §28.K incl. the restyle (§28.K.10) and the public `/kalkulator` page; MINTA server for every new endpoint |
| B3 panel | the panel parts of §28.K (fees admin, check-in queue, annual closing tab, lock chip, EFO decision, KATA chip/columns, mailbox log, typography pass) |
| B4 engine + content + media | `kod/ado-motor` (KATA regime, `calculatorEstimate`, kata deadlines), backend `services/tax.ts` + `services/flags.ts` mapping for KATA, `kod/jogi/**` (§28.K.20), `utmutato_kepek/**` + `_privat/nav_bogi_1119` → blurred outputs only (§28.K.13), `video/vallalkozas_bejelentes/**` re-render, `kod/media/**` via the normaliser |
| B0 (done) | `kod/shared/**`, this section |
If the orchestrator splits the restyle off, a builder **B5 stílus** owns only `kod/app/src/ui/**` (tokens, `Szakasz`, `Sor`, `Dokk`, `Fulsor` …) and `kod/panel/src/styles/**`; B2 keeps the screens and must not reformat B5's files.

---

#### 28.K.1 Prices and fees

**Fee table (`FEE_KINDS`, defaults `FEE_DEFAULTS`; admin-editable in `fee_settings`):**
| Kind | Default | Confirmed by the owner? | When it is charged | Client label |
|---|---|---|---|---|
| `havidij` | **19 999 Ft / hó** | yes (11-19 19:30) | monthly, SimplePay recurring (§9) | "Havidíj" |
| `havidij_kata` | **19 999 Ft / hó** | yes (11-19 17:25 "Ugyanannyi lesz") | monthly (plan `havi_kata`) | "Havidíj (kata)" |
| `eves_zaras` | 14 999 Ft / év | **no → DEMO** | when the client sends the annual questionnaire (§28.K.3) | "Éves zárás" |
| `valtozas_egyszeru` | 4 999 Ft / alkalom | **no → DEMO** (values: owner ~15:00 "Ez jó lesz"; one click to confirm) | before the team files an assisted simple change | "Változás bejelentése helyetted" |
| `valtozas_jogallas` | 7 999 Ft / alkalom | **no → DEMO** (as above) | before the team files a legal-status change | "Jogállás-változás bejelentése helyetted" |
| `szuneteltetesi_dij` | 2 999 Ft / hó | **no → DEMO** | monthly instead of the plan fee while szünetel (§28.K.6) | "Rendelkezésre állási díj" |
- A change the client files **himself** with our guide = **0 Ft** (we only update our side). Not a setting: a rule (`CHANGE_FEE_RULES.selfService = 0`).
- Which change pays which fee (`changeFeeKind(kind, items)` in `enums.ts`): `valtozas_szekhely`, `valtozas_tevekenyseg`, `valtozas_telephely`, `valtozas_szuneteltetes`, `valtozas_folytatas` → `valtozas_egyszeru`; `valtozas_adoadat` with any item in `munkavegzes`, `nyugdijba_vonulas`, `kata_belepes`, `kata_kilepes` → `valtozas_jogallas`; `valtozas_adoadat` with only `kozossegi_adoszam` / `egyeb` → `valtozas_egyszeru` [OWNER confirms]; `atalany_kilepes`, `afa_kilepes` → no fee and no filing until the callback agrees (out of our service, §28.5.6).
- **DEMO mark:** while `confirmed_at` is null the price is shown with the amber "DEMO" chip (`.demo` of `valasztott/kozos.css`), e-mails add "(DEMO ár)", the fee invoice says "DEMO DÍJBEKÉRŐ – NEM SZÁMLA" as today in demo mode. In `APP_ENV=production` an unconfirmed fee **cannot be charged**: the action shows "Ezt most nem tudjuk elindítani: a díj még nincs véglegesítve. Kérj visszahívást." and the panel task goes to the owner (admin) [OWNER].
- **Admin screen `/admin/dijak`** (B3): one row per kind (amount, unit, status "Megerősítve · {date} · {admin}" or DEMO, "Módosítom", "Megerősítem"); history list. A change of `havidij`/`havidij_kata` applies to **new** subscriptions at once and to running ones from `effective_from` (required, ≥ today + 30 days when the amount rises [JOGI: ÁSZF change notice]; a decrease may apply from the next charge). The amount may never exceed the stored card registrations' `max_amount_huf` for running subscriptions (the screen shows how many would need a new card). Audit `fee.setting_changed`, `fee.setting_confirmed`.
- **The 20 000 → 19 999 sweep** (each owner in his folder; QA grep `\b20[  .]?000 Ft|\b20000\b` over client/panel/legal texts must find only non-price numbers such as the ÁFA limit "20 millió"; the `\b` keeps "120 000 Ft" out): `brand.json` (done), `PLAN_PRICE_HUF` default, `plans.price_huf` (`ensurePlan` upserts it), SimplePay `total`/`maxAmount` (new registrations: `max(priceHuf)` of the plans, so 19 999), app texts (`regisztracio`, `elofizetes`, `fiok` referral text, `szovegek.ts`, MINTA `priceHufMonthlyGross`), panel mock, jogi (`sablon.ts` reads brand; ÁSZF / adatkezelés / FAQ / `app_szovegek` text literals, `pdf_minta/` regenerated, tests that hard-code 20 000), e-mail templates, FUNKCIOK.md (B0 after the build), demo seed rows that show a price (fee invoices keep their historical amounts – they are records). Existing card registrations (max 20 000) stay valid for 19 999.

**Fee charges (one-off fees; `fee_charges`, §28.K.16):**
- Created by the server when a fee-bearing action is requested: `{ kind, amountHuf (snapshot), purpose: { type: 'valtozas', assistId } | { type: 'eves_zaras', annualId }, dueOn, status 'nyitott' }`.
- **Payment:** `POST /client/fees/:id/pay` → a **one-time** SimplePay `/start` (no `recurring` block, `methods ["CARD"]`, `total = amountHuf`, the same back URL and IPN) with `simplepay_transactions.kind = 'egyszeri'`; DEMO mode uses the demo pay page exactly like §9.7. [OWNER/JOGI] We do **not** charge the stored recurring token for one-off fees (the recurring statement covers the monthly fee only).
- IPN `FINISHED` → charge `fizetve`, fee invoice (§11.5, line "{label}"), audit `fee.paid`, then the purpose action (assist `dijra_var` → `egyeztetve`; annual `dijra_var` → `konyvelonel`) and the accountant's task notification. Failure → stays `nyitott`, the client sees "Nem sikerült a fizetés. Próbáld újra, vagy válassz másik kártyát."
- A charge whose purpose is cancelled or closed **before payment** → `visszavonva` (nothing to refund).
- Refund: a charge whose work never started (assist cancelled or closed by us before any `valtozas_adatok` item was ticked; annual closing cancelled before `konyvelonel`) → `visszaterites_kell` + admin task; the admin refunds in the SimplePay merchant admin (§9.6 [NEM MA] for the API) and marks `visszaterites_megtortent`. Work started → no refund [OWNER/JOGI]. The admin may waive (`elengedve`, reason required, audit).
- Client screen **Fiók → "Díjak és számlák"** (renames "Díjszámlák"): the fee table ("Mi van a havidíjban?" one line: "Minden, amit az app tud: könyvelés, negyedéves adó, kiállított számláid letöltése, határidők, üzenetek. Külön díjas csak az éves zárás és az, ha a változást mi jelentjük be helyetted."), open charges with "Fizetek", paid ones, the fee invoices.

---

#### 28.K.2 A – monthly check-in "Változott valami?"

**When and who:** every active client (`lifecycle = 'aktiv'`, not service-locked, active ≥ `CHECKIN_RULES.minActiveDays` = 20 days) gets one check-in per month, opened on the **first working day of the month at 09:00** (Budapest; push respects quiet hours). Period = the previous month ("október óta"). Due: the 10th; nudges +3 and +7 days (§28.K.4); unanswered at month end → `lejart` (no penalty; the accountant sees "nem válaszolt").

**Screen `/valtozott` (B2; copy `CHECKIN_TEXTS`, content `havi.*`):**
- Header: 3D `kerdezek` 28 + title "Változott valami {honap} óta?" + one line "Pár igen–nem kérdés, kb. 1 perc. Ha semmi nem változott, egy koppintás."
- Rows (only the relevant ones; each row = question + "Igen" capsule on the right; no box in a box):
  - `munkaviszony` – főállású now: "Kezdtél munkaviszonyt?"; mellékállású now: "Megszűnt vagy változott a munkaviszonyod?"
  - `nyugdij` – not shown for nyugdíjas: "Nyugdíjas lettél?"
  - `koltozes` – "Költözik a vállalkozásod, vagy új helyen is dolgozol?"
  - `tevekenyseg` – "Új munkába kezdesz, vagy más lesz a fő munkád?"
  - `csalad` – átalány only: "Született gyermeked, babát vártok, vagy házasodtál?"
  - `alkalmazott` – "Lett alkalmazottad vagy egyszerűsített foglalkoztatottad (EFO)?"
  - `szuneteltetes` – not suspended: "Szünetet tartanál a vállalkozásodban?"; suspended: `folytatas` "Újrakezdenéd a vállalkozásodat?"
  - `kata_ceges` – KATA only: "Számlázol, vagy fogsz számlázni cégnek vagy egyéni vállalkozónak?"
  - `egyeb` – "Más is változott?" (free text ≤ 500, optional)
- Fixed main button (dock): **"Nem változott semmi"** → `POST /client/checkins/:id { result: 'nem_valtozott' }` → toast "Köszönjük! Jövő hónapban újra rákérdezünk." Once any row is "Igen", the main button becomes **"Tovább"**.
- Follow-ups (one per screen, §27.0.3 B, progress "2/4"):
  - `munkaviszony`: "Mióta?" (date) · "Heti hány órában?" chips "36 óra vagy több" / "Kevesebb, mint 36 óra" (+ "Mi ez?" i: explainer `heti_36_ora`). Result line by case (`CHECKIN_RESULT_TEXTS`):
    - főállás → ≥ 36 h: "Akkor a vállalkozásod mellékállású lesz: nem kell a havi minimum járulékot fizetned, csak a valódi jövedelmed után. Ezt be kell jelenteni a NAV-nak, és nálunk is átállítjuk az adódat."
    - főállás → < 36 h: "Heti 36 óra alatt a vállalkozásod főállású marad, a havi minimum járulék is marad. A munkavégzés jellegét be kell jelenteni a NAV-nak." [KÖNYVELŐ: confirm the T101E duty for [1]→[3]]
    - mellékállás → ended: "Ha megszűnt a munkaviszonyod, a vállalkozásod főállású lesz: havonta legalább kb. 101 682 Ft járulékot kell fizetned (2026). Ezt be kell jelenteni a NAV-nak, és nálunk is átállítjuk."
    - KATA → ≥ 36 h: "Figyelem: ha egy teljes hónapig heti 36 órás munkaviszonyod van, megszűnik a katád, és 15 napon belül be kell jelenteni. {firstName} segít átállni átalányadózásra."
  - `nyugdij`: "Mióta kapod?" (date) → "Nyugdíjasként a vállalkozásod után nem fizetsz TB-járulékot és szochót, csak SZJA-t. Ezt be kell jelenteni a NAV-nak, és nálunk is átállítjuk." KATA: "Nyugdíjasként nem maradhatsz katás: {firstName} segít átállni átalányadózásra."
  - `koltozes` → chips "A székhelyem költözik" / "Új telephelyem lesz" → the §28.5.6 change form for that kind (prefilled date).
  - `tevekenyseg` → the §28.5.6 activity form.
  - `csalad` → "Ezt az adókedvezmény-kérdőívben adod meg, kb. 3 perc." button "Megnyitom" → `/kedvezmenyek/kerdoiv` (prefilled; no fee).
  - `alkalmazott` → §28.K.7 question and text.
  - `szuneteltetes` / `folytatas` → the change form (§28.5.6 / §28.K.6) + the fee line of §28.K.6.
  - `kata_ceges` → "Ha egy cég vagy egyéni vállalkozó fizet neked, a katád a fizetés előtti nappal megszűnik. Előbb beszélj {firstName}val: lehet, hogy jobb, ha előtte átállsz átalányadózásra." → callback (topic `adozasi_mod`, source `havi_ellenorzes`) or the `kata_kilepes` change.
  - `egyeb` → sent to the accountant as a message (Üzenetek, sender the client, prefix "Havi ellenőrzés:").
- **Choice screen for every NAV-filed change** ("Hogyan intézzük?", the §27.3.1 highlighted-card pattern): card A (highlighted) "Bejelentjük helyetted" – "Megadod az adatokat, {firstName} meghatalmazottként beküldi. Díja: {dij} Ft, előre fizetve." button "Ezt kérem (+ fizetés)"; capsule B "Magam jelentem be (ingyenes)" → the change guide (§28.5.3) and, after filing, the upload of the NAV értesítés; text link "Előbb beszéljük meg" → callback. The plain admin line under both: "Mi változik nálad: {CHECKIN_ADMIN_TEXTS[item]}".
- **After "Ezt kérem":** the change form → summary → **"Fizetek ({dij} Ft)"** → SimplePay → back in the app: "Kifizetted. {firstName} nekilát, és szól, ha jóvá kell hagynod valamit." The assist is created at once in status `dijra_var` and moves to `egyeztetve` on payment (§28.K.1). With a 0 Ft fee (admin set 0) it starts at `egyeztetve`.
- **Team task:** every "Igen" item becomes a `checkin_items` row; the accountant gets `checkin_change` (badge + digest "Havi változás: N ügyfél"). Panel queue **"Havi változások"** (accountant: own clients; admin: all; csapat: only items with an assist) with columns ügyfél · mi változott · hogyan (helyettünk / magától / kérdés) · díj (fizetve / vár) · kinél a labda · since. Item statuses (`CHECKIN_ITEM_STATUSES`): `uj` → `dijra_var` → `csapatnal` (linked assist) | `ugyfel_intezi` (self-service; waits for the NAV értesítés upload) → `kesz`; or `nem_kell` (accountant: no action needed, with a one-line reason shown to the client).
- Effects the accountant applies with one click from the item (never automatic): the tax-profile status (fő / mellék / nyugdíjas) with the date, `szunetel` insurance breaks, allowance re-check, EFO decision.

---

#### 28.K.3 B – annual closing fee + annual questionnaire

**What it covers:** átalány: the annual SZJA return of the EV (the 26SZJA with the átalányadó sheets, due **2027-05-20**) and the HIPA return (due **2027-05-31**); KATA: the **'26KATA** declaration (due **2027-02-25**) and the HIPA return. The fee `eves_zaras` (§28.K.1) is charged when the client sends the questionnaire; a client whose service ended before 31 December still gets it if he asks (the closing of his last year) [OWNER].
**Statuses (`ANNUAL_STATUSES`):** `nem_indult` → `kerdoiv` (open, client fills) → `dijra_var` (sent, fee unpaid) → `konyvelonel` (paid; the accountant works) → `jovahagyasra_var` (the accountant uploaded the draft; the client approves in the app) → `beadva` (filed by the accountant as meghatalmazott; NAV confirmation uploaded) → `kesz` (HIPA filed too). The app never files.
**Dates (`ANNUAL_RULES`):** opens **5 January 09:00**; questionnaire due **15 March** (átalány) / **5 February** (KATA) [KÖNYVELŐ]; reminders 14, 3 and 1 day before the questionnaire due date and before each legal deadline while it is still on the client; nudges +3/+7 (§28.K.4).
**Questionnaire `/eves-zaras/kerdoiv` (one question per screen; copy `ANNUAL_TEXTS`, content `eves.*`):**
- E0 intro: title "Éves zárás {ev}", text "Pár kérdés az évedről, kb. 5 perc. Ebből készíti el {firstName} az SZJA-bevallásodat és az iparűzési adó bevallását. Díja: {dij} Ft, a végén fizeted." (KATA: "…a kata-nyilatkozatodat és az iparűzési adó bevallását.")
- E1 `masJovedelem` "Volt idén más jövedelmed is a vállalkozásodon kívül?" multi-chips (`OTHER_INCOME_KINDS`): "Munkabér" · "Nyugdíj" · "Lakás vagy más ingatlan kiadása" · "Ingatlant vagy autót adtam el" · "Értékpapír, megtakarítás" · "Külföldről" · "Más" · "Nem volt". Why: "A bevallásban minden jövedelmed szerepel. A munkabéredet és a nyugdíjadat a NAV már ismeri." Follow-up for each kind except munkabér/nyugdíj: "{firstName} megnézi, mit kell vele tenni. Lehet, hogy ehhez külön segítség kell – ezt előre megmondja." [OWNER: scope + price of non-EV incomes]
- E2 `kedvezmenyek` (átalány): the approved items of §28.3 as rows + "Rendben, ez így jó" / "Valami változott – módosítom" (→ `/kedvezmenyek/kerdoiv`). KATA: the line "A katádra a kedvezmények nem hatnak. Ha munkabéred is volt, arra igen: {firstName} megnézi." and no allowance pages.
- E3 `hipa` "Hol dolgoztál idén?" chips "Csak a székhelyemen" / "Más településen is" (→ "Melyik településen? Kb. hány napot?" list) · "Kaptál levelet vagy határozatot az önkormányzattól az iparűzési adóról?" Igen → upload (category `nav_level` → document title "Önkormányzati levél – iparűzési adó").
- E4 `egyszazalek` (optional) "Rendelkezel az SZJA 1+1%-áról?" Igen → "Melyik civil szervezetnek? (adószám)" and "Melyik egyháznak? (technikai szám)" – both optional; "Nem, most nem" skips. (Not for KATA without other income.)
- E5 `visszaterites` "Ha adó jár vissza, melyik bankszámládra kéred?" (account number, stored encrypted, masked in every view) – optional.
- E6 `iratok` "Van még iratod {ev}-ből, amit nem töltöttél fel? (például a decemberi bankszámlakivonat)" Igen → the upload chooser for the year; Nem.
- E7 `uzenet` "Üzenet {firstName} számára (nem kötelező)" ≤ 1000.
- E8 summary + fee: rows of the answers + "Éves zárás díja: {dij} Ft" (+ DEMO chip) → main button **"Elküldöm és fizetek"** → SimplePay → status `konyvelonel`, toast "Köszönjük! {firstName} nekilát. Szól, ha kérdése van, vagy ha jóvá kell hagynod a bevallást."
**Client status card** (Főoldal from 5 January to `kesz`, and `/eves-zaras`): title "Éves zárás {ev}", status line from `ANNUAL_STATUS_CLIENT_TEXT`, the next date ("A kérdőívet {hatarido} töltsd ki."), the button of the client's next action (Kitöltöm / Fizetek / Átnézem és jóváhagyom).
**Approval:** in `jovahagyasra_var` the client opens the draft PDF (`bevallas` category, visibility `kozos`) and taps **"Jóváhagyom a bevallást"** (consent row: version, hash of the PDF, time, IP code, UA) or "Kérdésem van" (Üzenetek). Without approval the accountant files only after a callback agreement recorded in the panel [JOGI].
**Panel tab "Éves zárás"** (B3; accountant + admin; csapat sees status only): the answers, documents, a checklist (`ANNUAL_CHECK_ITEMS`: `kerdoiv_atnezve`, `jovedelmek_rendben`, `kedvezmenyek_rendben`, `hipa_adatok_rendben`, `tervezet_feltoltve`, `ugyfel_jovahagyta`, `szja_beadva` / `kata_beadva`, `hipa_beadva`, `visszaigazolas_feltoltve`), buttons "Tervezet feltöltése" (→ `jovahagyasra_var`), "Beadtam az SZJA-bevallást" (upload, → `beadva`), "Beadtam a HIPA-bevallást" (→ `kesz` when both). Client list chip "Éves zárás: N vár rád".

---

#### 28.K.4 C – automatic reminders and nudges

**Principle:** a reminder goes out only when the client can act and it matters now; every reminder kind has its own toggle in Fiók → Értesítések; push follows the quiet hours of §28.2.3; at most **one nudge push per client per day** (several items → one push "{n} dolog vár rád", in-app rows per item).
| Reminder | When | Kind (variant) |
|---|---|---|
| Tax payment (átalány) | 7, 3, 1 days before an approved, unpaid quarter (exists) + **on the due day 08:00** + **1 day after** if not marked paid | `tax_due_soon` (+ `ma`, `lejart`) |
| KATA monthly tax | the 8th and the 12th (or the next working day) for the previous month's 50 000 Ft, if not marked paid | `tax_due_soon` (`kata`, `kata_ma`) |
| HIPA advance | 7 and 1 days before 16 March / 15 September when an advance is due | `tax_due_soon` (`hipa`) |
| Bank statement | the 5th, when the accountant's `monthly_statement_request` is on and no `bankszamlakivonat` exists for last month | `upload_reminder` (`kivonat`) |
| Receipts / cash register | the 3rd, when the client had manual (`kezi`) revenue or a `nyugta` / `penztargep_osszesito` document in any of the last 3 months and none yet for last month | `upload_reminder` (`nyugta`) |
| Open accountant request | **3 and 7 days after it was sent** (new), plus the existing due-1 / due+1 / due+4 | `request_reminder` (`nap3`, `nap7`) |
| Waiting on the client (check-in, allowance question, annual questionnaire, unpaid fee charge, change consent, annual approval) | 3 and 7 days after the item started waiting | `nudge` (one row per item; one push per day) |
| Annual deadlines | §28.K.3 | `annual_due` |
- Dedupe: `notifyOnce` key `rem:<kind>:<item id>:<step>`; no reminder for service-locked clients except payment and lock texts; none before activation except onboarding ones (§26/§27).
- Staff: overdue items appear in the staff digest ("Ügyfélre vár 7 napja: N").
- Settings screen gets the group **"EMLÉKEZTETŐK"**: "Befizetési határidők", "Feltöltési emlékeztetők", "Ha valami rád vár" (the nudges); copy in `REMINDER_TEXTS`.

---

#### 28.K.5 D – unpaid fee lock ("zárolás")

**When:** `serviceLock(client)` = locked if (a) the subscription is `suspended` (the existing schedule: retries +1/+3/+7 days, 14 days grace, then `suspended` and lifecycle `felfuggesztve`, §9.3), or (b) an `eves_zaras` charge is unpaid 14 days after the annual questionnaire was sent (`ANNUAL_RULES.lockAfterDays`). The reasons are stored in `clients.service_lock` (jsonb `{ reasons: ('havidij'|'eves_zaras')[], since, amountHuf }`, null = open) and recomputed on every payment event and by the daily billing job.
**Unlock:** at once on the IPN `FINISHED` of the missing payment (existing `applyFinished` reactivates `felfuggesztve` → `aktiv`; a fee charge payment clears its reason). Notification `service_unlocked`: "Újra minden működik" / "Köszönjük a fizetést. {firstName} folytatja a munkát."
**What stays open (`SERVICE_LOCK_RULES`; 'olvasas' = read-only):** paying (subscription start, card update, fee charges, `elofizetes`, `dijszamlak`, `dijak`), Fiók, notification settings, GYIK/legal, **own data download (GDPR export, documents of the dossier, fee invoices)**, account deletion, **writing to customer service** (Üzenetek go to the team thread, sender shown "Ügyfélszolgálat"; callback with topic `elofizetes`, source `zarolas`). Read-only: Főoldal, dossier, issued invoices, deadlines, reserve and earnings (the last approved numbers + banner). Uploads stay allowed (stored, processed after unlock).
**What is locked (API 403 `service_locked` with the reason text):** for the client – new requests (certificates, changes), assists, check-in follow-ups, allowance submissions, annual questionnaire send, "Jóváhagyom" actions; for staff – approving quarters, letters, filings (`ev-filed`, `change-done`, annual `beadva`), new requests to the client, allowance decisions, certificate requests. The panel shows a red chip "Zárolva: díj elmaradt ({since} óta, {amount} Ft)" on the client list and page; locked buttons are disabled with the hover text "Zárolva: a díj nincs kifizetve. A fizetés után újra működik." Reading stays.
**Client wording (`LOCK_TEXTS`):**
- Banner (every main screen, under the header, one line + button): "Szünetel a könyvelésed, mert nincs kifizetve a {mit} ({osszeg} Ft). Fizess, és {firstName} folytatja." Button **"Fizetek"**; text link "Írok az ügyfélszolgálatnak".
- "Mi ez?" sheet: "Amíg nincs kifizetve a díj, nem hagyunk jóvá adót, nem írunk levelet és nem adunk be semmit helyetted. Amit eddig csináltunk, megmarad, és bármikor letöltheted az adataidat. A NAV-os határidők ettől nem állnak meg: ha sürgős, fizess most, vagy írj nekünk."
- `service_locked` notification: "Szünetel a könyvelésed" / "Nincs kifizetve a {mit}. Fizess, és {firstName} folytatja."
- Tax deadline within 14 days while locked → one extra notice "Közeleg egy határidő: {date}. Amíg a díj nincs rendezve, ezt nem tudjuk intézni helyetted." [JOGI: ÁSZF clause on suspension of the service for non-payment; the NAV meghatalmazás stays].
- Staff notification `client_locked` (the accountant + admin) and the digest line.

---

#### 28.K.6 E – suspension availability fee (+ resumption)

- **Pause record** `subscription_pauses (client_id, from, to null, fee_kind 'szuneteltetesi_dij', source 'valtozas'|'konyvelo', created_by)`: created by the `change-done` follow-up of `valtozas_szuneteltetes` (§28.5.5, with the `szunetel` insurance break) or by the accountant; closed by the `valtozas_folytatas` change (or the accountant).
- **Charge rule** (`chargeAmountHuf(sub, periodStart)`): if `periodStart` falls inside a pause → `szuneteltetesi_dij` amount, else the plan amount. SimplePay recurring `dorecurring` with the lower amount (≤ the token's `maxAmount`, allowed). No proration. Fee invoice line "Rendelkezésre állási díj ({honap})".
- What the client gets meanwhile (copy `PAUSE_TEXTS`): "Szünetel a vállalkozásod, ezért {from}-tól havi {dij} Ft rendelkezésre állási díjat fizetsz a {havidij} helyett. Ezért megőrizzük az irataidat, figyeljük a határidőidet, és segítünk újraindulni." The Főoldal card "Szünetel a vállalkozásod" with the button "Újrakezdeném" (→ the `valtozas_folytatas` hub page).
- **New change kind `valtozas_folytatas`** ("A szüneteltetés befejezése"; `CHANGE_KINDS` has 6 values): Ügysegéd → the szüneteltetés card → "befejezés" [ELLENŐRIZENDŐ: exact NAV labels; drawn pictures until captured]; change data `{ kind: 'valtozas_folytatas'; from: ISODate }` (≥ today, ≤ today + 60 days); fee `valtozas_egyszeru` when assisted; guide steps `belepes`, `ugyseged_fooldal`, `folytatas_inditas`, `folytatas_datum`, `folytatas_ellenorzes`, `valtozas_megtekintes`, `app_feltoltes`; follow-up on `change-done`: close the pause and the `szunetel` break, re-check HIPA.
- Two years without resumption → the EV is deleted by law [ELLENŐRIZENDŐ Evectv.]; reminders 60 and 30 days before the 2-year mark (`upload_reminder` no; kind `nudge` variant `szunetel_ket_ev`).

---

#### 28.K.7 F – employees / EFO

- **Question** (onboarding `adatok` path 'van', one screen after the tax status; and in the monthly check `alkalmazott`): "Van alkalmazottad vagy egyszerűsített foglalkoztatottad (EFO)?" chips (`EMPLOYER_ANSWERS`): "Nincs" · "Van alkalmazottam" · "Van EFO-s foglalkoztatottam" · "Mindkettő" · "Lesz hamarosan". "Mi ez?" (explainer `alkalmazott_efo`): "Alkalmazott az, akinek munkabért fizetsz. EFO: alkalmi munka vagy idénymunka, napi bejelentéssel. Mindkettőhöz bérszámfejtés és havi bevallás kell."
- **Any answer except "Nincs":** the plain line (copy `EMPLOYER_TEXTS.yes`): "Bérszámfejtést most nem vállalunk. {firstName} megnézi a helyzetedet, és megírja, mit tudunk ajánlani: lehet, hogy egyedi ajánlatot küld, vagy azt javasolja, hogy a béreket más számfejtse, és mi a vállalkozásod többi részét intézzük." The journey gets the row **`alkalmazottak`** ("Alkalmazottak", actor `konyvelo`, state `var`, time none); **Előfizetés stays locked** until the accountant decides (lock text "Előbb {firstName} megnézi, mit tudunk vállalni az alkalmazottaid miatt.") – no card is charged before the decision.
- **Panel** (client page, Áttekintés card "Alkalmazottak"; staff notification `employer_reported`): decision (`EMPLOYER_DECISIONS`) + the text to the client (≤ 500, required except `nincs_teendo`):
  - `nincs_teendo` – "Mégsem kell vele foglalkoznunk" (row `kesz`);
  - `berszamfejtes_mashol` – client text default "Rendben: a béreket a bérszámfejtőd intézi, mi a vállalkozásod többi részét." (row `kesz`);
  - `egyedi_ajanlat` – the offer text (+ optional amount shown as text, not charged in the app this round [OWNER]) → client sees it with "Megbeszélem {firstName}val" (callback, source `alkalmazott`); row `most` for the client;
  - `egyedi_elfogadva` – the accountant records the agreement (row `kesz`);
  - `nem_vallaljuk` – client text required; onboarding stops with that text + "Kérj visszahívást"; the account can be deleted in Fiók; nothing was charged. For an already active client the accountant opens the termination outside the app [JOGI].
- Notification `employer_decided` to the client. Activation needs a decision in {`nincs_teendo`, `berszamfejtes_mashol`, `egyedi_elfogadva`} when the answer is not "Nincs".

---

#### 28.K.8 G – public tax calculator `/kalkulator`

- **Where:** the client web origin (`https://app.…/kalkulator`), an Expo Router route outside the auth guard; static export with its own `<head>`: title **"Mennyi adót fizetnél egyéni vállalkozóként? – adókalkulátor 2026"**, description "Írd be, mennyi bevételre számítasz, és megmutatjuk, mennyi SZJA, TB-járulék, szocho és iparűzési adó jön ki egy évre és negyedévre, és mennyit tegyél félre havonta.", canonical, Open Graph; no AI wording anywhere. Embedded mode `/kalkulator?beagyazva=1`: no header/footer, `postMessage({ type: 'kalkulator:magassag', h })` for the parent; Caddy sends `Content-Security-Policy: frame-ancestors 'self' <CALCULATOR_FRAME_ANCESTORS>` **only** on `/kalkulator*` (env, default empty = self only; the future adozz.hu origin is added when it exists). Every other route keeps `frame-ancestors 'none'`. Caddy is shared with Gardoko: copy the files to `/srv/appok/_regi/` before the change, health check before/after.
- **Computation:** in the browser, by the same engine: `@kezjegy/ado-motor` exports `calculatorEstimate(input: CalculatorInput): CalculatorResult` (B4; it builds a synthetic year from the inputs and calls `calculateYear` / the KATA branch – no rule is duplicated in the page). The app bundles the engine for this route only (code-split, lazy). **Nothing is sent to our server, nothing is stored, no analytics on the inputs.** (If the bundle is too heavy for a phone – target ≤ 150 kB gzip for the route – B2 may call `POST /public/calculator` instead, which runs the same function, is rate-limited 30/min/IP and logs nothing but counts.)
- **Inputs (one screen, defaults filled, results update live, debounced 300 ms; copy `CALCULATOR_TEXTS`):**
  1. "Mennyi bevételre számítasz egy évben?" (Ft, default 6 000 000; slider + field).
  2. "Mivel foglalkozol?" – the activity search of `BUSINESS_ACTIVITIES` → the cost class (45 / 80 / 90 %; the 40 % ratio is not a 2026 ratio [B4 confirms from the engine]); "Nem találom" → 45 % with the line "Az általános költséghányaddal számoltunk."
  3. "Mellette…" chips: "Csak ezt csinálom" (főfoglalkozású) · "Heti 36 órás munkahelyem is van" (mellékállású) · "Nyugdíjas vagyok" (nyugdíjas) · "Kevesebb órás munkahelyem van" (főfoglalkozású).
  4. "Mikor indulsz?" – "Már működöm" / "Idén, {honap}-ban" (proration of the year + the ÁFA note for starters).
  5. Optional "Kedvezmények" (collapsed, light form of §28.3): "25 évesnél fiatalabb vagy" · "Anya vagy 2 vagy több gyermekkel" (+ "30 évesnél fiatalabb vagy") · "Gyermekeid száma, akikre családi pótlékot kapsz" (0–5) – mapped to the engine allowances with full-year months.
  6. "Kata is érdekel" toggle → a second column with the KATA result (50 000 Ft/hó, the 18 M keret, "csak ha kizárólag magánszemélyeknek számlázol").
- **Outputs:** per year and per quarter: SZJA, TB-járulék, szocho, iparűzési adó (sávos estimate at 2 %, line "A települési kulcs 0–2 %, mi 2 %-kal számoltunk."), together, **"Ennyi marad neked"** (net, before your real costs), **"Ennyit tegyél félre havonta"** = ⌈yearly taxes ÷ active months⌉ rounded up to 1 000 Ft. One plain line under each number (`CALCULATOR_TEXTS.lines`). The ÁFA note: "Évi 20 millió forint bevételig nem kell ÁFÁ-t felszámolnod (alanyi adómentesség)." + for starters the engine's rule text. Honest footer: "Becslés a 2026-os szabályokkal. Nem adótanácsadás: a pontos összeget a könyvelőd számolja ki."
- **CTAs (fixed dock):** main **"Regisztrálok"** → `/regisztracio?forras=kalkulator&<utm_*>`; capsule **"Kérek visszahívást"** → `/regisztracio?cel=visszahivas&forras=kalkulator&<utm_*>` (after the account exists the callback sheet opens with source `kalkulator`; the calculator itself never collects a phone number). All incoming `utm_*` parameters are kept and passed on (existing `RegisterInput.utm`).
- Tests: the page shows the same numbers as `calculatorEstimate` for 3 fixtures (B4 writes them: 6 M főfogl. 45 %; 12 M mellék. 80 %; 3 M nyugdíjas 90 %); Lighthouse mobile performance ≥ 85; no network request with the inputs (Playwright request log).

---

#### 28.K.9 H – auto-fill by adószám

**Flow on the 'van' path, `adatok` (one question per screen, big "Tovább", back arrow; layout = the approved `valasztott/urlap.html`):**
1. **"Add meg az adószámodat"** – sub "Ebből kikeressük a vállalkozásod adatait, neked csak rá kell bólintanod." Field "Adószám" (mask `12345678-1-23`), the round i "Hol találom?" capsule and the one text link **"Most nem tudom"**.
2. **Type-ahead:** as soon as the **8th digit** is typed, the app calls `POST /client/onboarding/taxpayer-lookup { torzsszam }` (debounce 250 ms; one call per distinct törzsszám). A card pops up under the field (§`.megerosit` of urlap.html): **"Ez a te vállalkozásod?"** – name + székhely (+ "DEMO" chip when `demo`) – buttons **"Igen, ez az enyém"** (primary) / "Nem, ez nem az enyém". The two remaining digit groups are filled from the result (ÁFA code + county code).
3. **Checks on the result (`TAXPAYER_LOOKUP_TEXTS`):**
   - not found / invalid: "Ilyen adószámot nem találtunk. Nézd meg még egyszer, vagy add meg kézzel."
   - `incorporation ≠ SELF_EMPLOYED`: "Ez nem egyéni vállalkozás adószáma. Mi most egyéni vállalkozókat könyvelünk." (no prefill)
   - ÁFA code ≠ 1 (§27 rule): amber "Ez az adószám nem ÁFA-mentes vállalkozásé. Nézd meg még egyszer, vagy írj nekünk." – the client may still continue; the accountant gets the flag.
   - NAV not reachable / not configured in production: "Most nem érjük el a NAV-ot. Add meg kézzel, vagy próbáld újra később." → the manual form.
4. **"Igen, ez az enyém"** → the prefilled confirm screens (one per screen, each "Rendben" / "Javítom"): vállalkozás neve, székhely (NavAddress), egyéni vállalkozó (shown, not editable), ÁFA (alanyi mentes igen/nem from the code), then the questions the NAV does not know: tevékenység (§26.1.3 picker), egyéni vállalkozó mióta (month), adózási mód (§28.K.11), jogállás (§26), alkalmazottak (§28.K.7). `POST /client/onboarding/business-identity { source: 'nav', … }`.
- **"Hol találom?"** sheet (explainer `adoszam`, `where` rewritten): "1. Bármelyik számlád tetején, amit kiállítottál: az eladó (te) adószáma.\n2. A számlázóprogramod beállításaiban (például Billingo, Számlázz.hu).\n3. A NAV leveleiben.\n4. A NAV Ügyfélportálon belépés után, a „Saját adatok” dobozban.\n5. Az egyéni vállalkozói nyilvántartásba vételről kapott értesítésen."
- **"Most nem tudom"** → the manual form, every field the lookup would have filled, one per screen with the same explainers: vállalkozás neve ("Ha nem tudod pontosan, írd a saját neved – {firstName} javítja.") · székhely (address) · tevékenység · egyéni vállalkozó mióta · "Alanyi ÁFA-mentes vagy?" Igen / Nem / Nem tudom. `POST /client/onboarding/business-identity { source: 'kezi', adoszam: null }`. **Onboarding is never blocked on the adószám** (`ClientProfile.adoszamPending = true`); the accountant fills it later from ONYA once the meghatalmazás is active: panel task `onboarding_task` variant `adoszam` on the client page "Adószám hiányzik – töltsd ki az ONYA-ból" (field + check digit + the ÁFA code warning). Until then the NAV invoice connection (`nav_bekotes`) waits with the row text "{firstName} kitölti az adószámodat a NAV-nál".
- **Backend (B1, `services/adoszam-kereso.ts`):** nav-kliens `queryTaxpayer(torzsszam)` with **our own technical user** (Somosi Kft.): env `NAV_LOOKUP_TAX_NUMBER`, `NAV_LOOKUP_LOGIN`, `NAV_LOOKUP_PASSWORD`, `NAV_LOOKUP_SIGN_KEY`, `NAV_LOOKUP_EXCHANGE_KEY` (secrets only in `.env`, never logged). Not configured → `APP_ENV=demo`: the nav-kliens mock (fictional taxpayers; the card shows "DEMO – kitalált adatok"); production: `lookup_not_configured` → manual form. The shared nav-kliens queue keeps ≥ 1 000 ms between NAV calls (§8.1); per client ≤ 10 lookups/hour and 30/day (`TAXPAYER_LOOKUP_RULES`, 429 `lookup_rate_limited` "Túl sokszor próbáltad. Add meg kézzel, vagy próbáld újra egy óra múlva."). **Results are not stored** anywhere except the fields the client confirms into his own profile; no cache table, no log of names or addresses (audit `onboarding.taxpayer_lookup` with `found` and `demo` only). [JOGI] purpose note in adatkezelés (§28.K.20).

---

#### 28.K.10 I – app-wide clarity + size pass (variant C + the 8 px separator band is the standard)

**Reference (owner-approved, binding):**
- **Variant C** = `dizajn/C4_atlathato/valasztott/` (`fooldal.html`, `urlap.html`, `kozos.css`; pictures `valasztott_fooldal.png`, `valasztott_urlap.png`; owner 11-19 20:10 "a C sokkal jobb"). C keeps B_kisebb's calm small scale, its structure and the flat 5-tab bar (owner 16:55–17:10), and brings back the blue header band (#1428DB + guilloche rosette) with three things only: who (the accountant's face + "{Név}, a könyvelőd"), where (the step number + one continuous thin bar), and the screen's one main message (3D icon + title + one sentence).
- **The separator** = `dizajn/C4_atlathato/C_VEGLEGES/` (`fooldal.html`, `kozos.css`, `fooldal.png`): owner 11-19 20:20 "nem így gondoltam, előző jobb volt, csak valami elválasztó köztük" (the stacked sheets of `C_retegek` rejected → back to plain C with a separator, first 8 px `#EEF1F8` in `C_elvalaszto`); the owner's **final** choice at 20:40: between two white sections a **10 px light-blue band `#D3DAFC`** across the full width (`.szak + .szak { border-top: 10px solid #D3DAFC }`). Nothing else changes. Rejected: stacked sheets, black/blue fading lines, cards, grey backgrounds. (Corrected 11-20 by the k6c fix round: this paragraph, the table row below, B3's panel line, acceptance I and `UI_SCALE` said 8 px `#EEF1F8`.)
- **Rejected:** `C_retegek/` – no stacked sheets, no card shadows, no darkening layers or overlays to separate sections.
- C's exact CSS is the standard: `C_elvalaszto/kozos.css` + the page `<style>` of `valasztott/fooldal.html` and `valasztott/urlap.html`, colour tokens from `dizajn/C3_zold/kek.css`. Where an older number in this SPEC (§26–§28: "white sheet", icons 36/44 pt, questions 22 pt, button 56) differs, this section wins. `B_kisebb/` (`aktiv_fooldal`, `dosszie`, `uzenetek`, `fotozas`, `b_kozos.css`) only shows content patterns; those screens are brought to the C look. `VALASZTAS.md` lists the rules in Hungarian.

**Scale (`UI_SCALE` in `enums.ts`; pt = CSS px at 390 width; C's exact values win over the owner's approximate numbers):**
| Token | Value |
|---|---|
| screen title (h1; in the blue band, or under the form header) | 26 / 700 / line 1.15 / letter-spacing −0.022 em |
| section title (h2) | 18 / 650 / 1.3 / −0.012 em, **dark ink `--tinta` #10152B** (C's rule: blue only for the band, the main button, the text link and the active tab – this replaces the "blue title" of the 16:55 order) |
| body | 16 / 400 / 1.45; never below 15; grows with the OS text size |
| secondary text | 15 / 1.4, `--halvany` #505873 (7:1 on white, ≥ 4.5:1 required) |
| row (`lsor`) | title 16 / 600 / 1.35 · sub 15 / 1.4 secondary · min-height 52 · 1 px hairline `--hajszal` #E2E6F1 between rows of the same section |
| band – who | avatar 30 with a 1.5 px white ring · "**{Név}**, a könyvelőd" 15 (name 650 white, rest `--fejlec-halvany` #C9D2FF) · DEMO chip 24 high on the right |
| band – where | "2 / 12" 18 / 750 + "lépés kész" 15 · one continuous 6 px bar (white on 26 % white), never segments |
| band – what now | 3D icon 30 + h1 26 · one sentence 16 `--fejlec-halvany`, indented 38 · band bottom padding 20 |
| big number (money) | 22 / 700, tabular figures; one card, one big number (VALASZTAS rule 6) |
| icons | section 28 · band 30 · row 28 · tab 26 · round "i" 26 with a 44 pt tap area |
| main button (dock) | 52 high, 17 / 650, full width, 16 side margin, fixed above the tab bar; above the keyboard while it is open |
| secondary capsule | 40 visible / 44 tap, 15.5 / 650, `--gomb-m-alap` #DFE4FD, text `--tintakek-szoveg` #1226B8 |
| text link | 16 / 550, underlined (offset 4 px), min-height 44 – at most one per screen |
| input | 56 high, radius 12, 2 px brand border when focused, value 22 / 600 tabular; a correct value shows a check inside the field |
| form header | the band narrowed: "Vissza" capsule (36 high, white outline, 44 tap) · the section name 16 / 650 centred · DEMO; under it "1. kérdés a 3-ból" 15 secondary + the question as h1 26 + one why line 16 secondary |
| tab bar | flat, full width, 52 high, top hairline, 5 tabs (Főoldal, Dosszié, Fotózás, Üzenetek, Fiók), label 12.5 / 550 `--halvany`, active `--neon` 750 |
| section | padding 16; the content is indented 38 (starts on the title's line, after the icon); **two sections are separated by the 10 px `#D3DAFC` band** (C_VEGLEGES); rows inside a section by a 1 px hairline |
| spacing | 4 / 8 / 12 / 16 / 24 only |

**Rules (every client screen):** the blue band on top (who · where · what now; on forms only "Vissza" + the section name); one main button in the fixed dock, always in the same place; the same section header everywhere (3D icon 28 + dark title 18 + one sentence + at most one capsule on the right); two text levels (+ one big number where money matters); at most one text link per screen ("Mi ez?" → the small round i); **no box inside a box, no card shadows, no stacked sheets, no darkening layers** – the only separators are the 8 px band between sections and hairlines between rows (the one approved raised element is the type-ahead confirm card "Ez a te vállalkozásod?" of `urlap.html`, which points at the field); only "now" + "next" visible, the rest collapsed ("Még N lépés · Mutasd", N counted right); every message once; tap targets ≥ 44 pt; large text: at 200 % OS text size nothing is cut (wrap, never ellipsis on amounts and buttons; the dock button may grow to 2 lines); secondary text contrast ≥ 4.5:1 in both themes; keep colours, Geist, the 3D icons and the avatar.
**Screens (B2 or B5; before/after screenshots at 390×844 and 320×640, LOOKED at, `kod/app/_kepek/k28i_<kepernyo>_elotte|utana_<w>.png`):** Főoldal (onboarding, active, KATA, locked), Dosszié + month, invoice list + detail, Fotózás + upload, Üzenetek, Fiók + all sub-screens, Értesítések, Előfizetés, Díjak, Határidők, Számlaszámok, Hogyan jött ki, all §28/§28.K screens, guides, Helyettünk, Visszahívás, auth screens, `/kalkulator`. The squint test of `VALASZTAS.md` (blur 6: two strong spots that say the same thing – the band on top, the main button below) on every screen; a side-by-side of the new Főoldal with `C_elvalaszto/fooldal.png` is part of the report.
**Panel (B3):** the same type scale where oversized: page title 24, section title 18 (dark ink), table text 14.5–15, row height ≥ 40, buttons 36–40; stacked sections separated by the same 10 px `#D3DAFC` band instead of shadows; no other layout change; screenshots of the client list, client page tabs, `/helyettunk`, `/havi-valtozasok`, `/admin/dijak` at 1440 and 1280.

---

#### 28.K.11 J – KATA clients

**Facts (2026, [KATA]):** only főfoglalkozású EV; **50 000 Ft per started month**, due by the **12th of the next month** (next working day), no return; NAV account **10032000-01076349** (IBAN HU27100320000107634900000000, adónem 288); keret **18 000 000 Ft/year, prorated by liable months × 1 500 000 Ft**, 40 % különadó above it (return + payment by 25 February, or 30 days after the end); a payment from a **kifizető** (company, other EV, organisation, foreign organisation; not a private person) **ends the KATA the day before it arrives** (exception: taxi), notice within 15 days, no re-entry for the rest of the year + 12 months; whole months on táppénz/CSED/GYED/szünetelés are tax-free and reduce the keret; ellátási alap 108 000 Ft (≈ 122 days of service time a year – tell the client once); allowances do not reduce KATA; HIPA sávos applies (bands as átalány); the 20 M ÁFA limit is separate.
**Data (B1, additive):** `client_tax_profiles` + `regime text not null default 'atalany'` (CHECK `TAX_REGIMES`), `kata_from date null`, `kata_to date null` (cost ratio stays stored for a later switch; the engine ignores it for KATA); `nav_invoices` + `customer_vat_status text null` (backfilled from `data` in the data step); `revenue_items` + `payer_kind text null` (CHECK `PAYER_KINDS`: `maganszemely`, `kifizeto`, `kulfoldi_kifizeto`, `ismeretlen`; set from `customer_vat_status`: PRIVATE_PERSON → maganszemely, DOMESTIC → kifizeto, OTHER → kulfoldi_kifizeto (a foreign customer; the accountant checks whether it is an organisation – a foreign private person is no kifizető, [KATA] §3), missing → ismeretlen; `PAYER_KIND_BY_VAT_STATUS`); plan row `havi_kata` (price from `fee_settings.havidij_kata`).
**Engine (B4, per [KATA] §16–§17):** `TaxProfileInput.regime`, rules block `kata` (values of `KATA_RULES` + sources), `kataMonths()` (liable months, 30-day rule, revenue in an exempt month), `kataLimitMeter()` (months × 1.5 M, projection, különadó estimate), warnings `kata_kifizeto` (with end date = receipt − 1 day and notice deadline = receipt + 15 days; pre-warning on issue), `kata_nem_fofoglalkozasu`, deadlines (12th monthly, '26KATA 2027-02-25, HIPA), payment items `kata_teteles` / `kata_kulonado` (`PAYMENT_ITEM_KINDS`), explanation lines, `calculatorEstimate` KATA branch. 2027: draft only (T/928 not law).
**Client app (B2; copy `KATA_TEXTS`):**
- Onboarding `adatok` ('van'): "Hogyan adózol most?" chips "Átalányadó" · "Kata (havi 50 000 Ft)" · "Nem tudom" (+ i). "Nem tudom" → "Semmi gond: {firstName} megnézi a NAV-nál, amint él a meghatalmazás. Addig átalányadóként mutatjuk az adódat." + panel task `onboarding_task` variant `adozasi_mod`. New business (kérdőív): "Hogyan szeretnél adózni?" "Átalányadó (ha cégeknek is számlázol)" · "Kata (csak ha kizárólag magánszemélyeknek számlázol)" · "Nem tudom – segítsetek" (callback topic `adozasi_mod`, source `kata`); KATA also requires főfoglalkozás (other work kinds → "Mellette dolgozol, ezért nem lehetsz katás.").
- Főoldal KATA view: two big numbers **"Idei bevétel"** and **the keret meter** "{bevetel} / {keret} Ft" with the line "Idén eddig a kereted {pct}%-át használtad." (amber ≥ 80 %, red over); the payment card "Utalj 50 000 Ft-ot {hatarido}" (account, közlemény = adószám, copy buttons, "Elutaltam"); "Félretenni": "Havonta 50 000 Ft a kata. Ha a kereted fölé mennél, a fölötti rész 40%-át is félre kell tenned." + HIPA line; per invoice: "Ez a számla belefér a havi 50 000 Ft-ba, nem kell külön félretenned." / over keret: "Ez a számla a kereted fölött van: tegyél félre kb. {felre} Ft-ot (40%)."
- **Business customer warning** (invoice with `payer_kind` kifizeto or kulfoldi_kifizeto, or `ismeretlen` → "ellenőrizd"): red line on the invoice and a Főoldal card, the push `kata_business_invoice`: title "Cégnek számláztál – vigyázz a katádra", body "{vevo}, {osszeg} Ft. Ha kifizeti, megszűnik a katád. Beszélj {firstName}val, mielőtt fizet." The accountant gets the same (staff variant) with the dates. The new-invoice notification of §28.2 is replaced by this one for such invoices.
- Számlaszámok: the KATA account row. "Mennyit kerestem?": revenue − 50 000 × liable months − különadó estimate − HIPA; line "A kata mindent fedez: nincs külön SZJA, TB és szocho." The once-only info card: "Katásként a nyugdíjad és a táppénzed alapja havi 108 000 Ft. Egy katás év kb. 122 nap szolgálati időt ér." (button "Értem").
- Allowances (§28.3): the gate sheet for KATA says "A katádra az adókedvezmények nem hatnak. Ha munkabéred is van, arra igen: azt a munkáltatód vagy az éves bevallásod rendezi." and no questionnaire. Check-in: `kata_ceges` row; `munkaviszony`/`nyugdij` texts of §28.K.2.
- Switching (both directions) only through the change kinds: `valtozas_adoadat` items `kata_belepes` (from the 1st day of the month after the notice) / `kata_kilepes` (KATA ends on the last day of the month of the notice; átalány on the same T101E); rules shown: "Kilépés után az év végéig és még 12 hónapig nem lehetsz újra katás." Fee `valtozas_jogallas` (assisted) / 0 (self). The guide `valtozas_adoadat` gets the step text for these items.
- **Panel:** regime chip "Kata" on the client list + filter; client page: the keret meter, liable months, the business-customer flags; the annual task '26KATA in "Éves zárás"; a KATA client cannot get §28.3 allowance proposals (tab hidden, note).
- **Price:** plan `havi_kata` = 19 999 Ft (same; admin-editable).
- Legal/FAQ: §28.K.20. Demo: §28.K.21 ("Lakatos Gréta").

---

#### 28.K.12 K – patterns from Accountable (borrow the pattern only, in the C look of §28.K.10; never their purple, pastel colour coding, mascot, tiny type, hamburger menu or "+" FAB)

1. **Two big numbers** on the active Főoldal right under the header: **"Idei bevételed"** (`limits` YTD revenue) and **"Eddigi adód"** (= `EarningsCard.ytdTaxesHuf`, §28.4), each 22 / 700 with one secondary line ("ebből {n} számla" / "SZJA, járulék, iparűzési adó"); KATA: "Idei bevétel" + the keret meter (§28.K.11).
2. **Payment card** (replaces the pay sheet entry on the Főoldal when an approved amount is due): "**Utalj {osszeg} Ft-ot {hatarido}**" – one row per NAV account (name, account number + copy, közlemény + copy, amount + copy); main dock button **"Elutaltam"** (= the existing "Már befizettem", renamed everywhere; the undo stays "Mégsem utaltam el").
3. **Put-aside ring** in the "Félretenni" card (§28.1.6): ring = `markedHuf / keepNowHuf`; centre "Még {X} Ft"; line "Még {X} Ft-ot tegyél félre." The client may record what he already put aside ("Félretettem…" → amount; stored `reserve_marks`, self-reported, never a bank link); after "Elutaltam" the paid amount is subtracted from the mark (floor 0) with the toast "A félretett pénzedből levontuk a befizetett {osszeg} Ft-ot." Without a mark the ring is empty and the sentence of §28.1.6 stays.
4. **Deadlines by quarter** (`/hataridok`): one collapsed row per quarter "{ev}. {q}. negyedév · {osszeg} Ft · {hatarido}" (paid → "Befizetve ✓"), expand → the items; KATA: one row per month; annual items (SZJA return, HIPA, '26KATA) as their own rows.
5. **Photo capture**: after the photo, the amount and the date fields are pre-filled when the on-device text recognition finds them (ML Kit / Vision through a config plugin; nothing sent to a third party; web: no suggestion, date = today), the client confirms or corrects; the line under the button "{firstName} ellenőrzi." **Status tabs with counts** in document lists: "Feltöltve {n}" · "{firstName} látta {n}" · "Kész {n}" (`DOCUMENT_STATUS_TABS`; Kész = feldolgozva + beadva).
6. **Personal forwarding e-mail** for receipts and bank statements (B1 `services/postafiok.ts`; copy `MAILBOX_TEXTS`):
   - Address per client: `<kod>@<MAILBOX_DOMAIN>` (`kod` = 8 random base32 chars, unique, rotatable by the client "Új címet kérek"); shown in Fiók → "Továbbító e-mail-cím" and on the upload screen with copy; DEMO chip while `MAILBOX_PROVIDER` is not set.
   - Inbound: provider webhook `POST /api/v1/inbound/mail` (signature-verified, `MAILBOX_WEBHOOK_SECRET`); DEMO: the panel/MINTA button "Levél szimulálása" and a harness endpoint (never in production).
   - Accept only when the sender is the client's login e-mail or one of ≤ 3 extra senders he added ("Ezekről a címekről fogadjuk a leveleidet"), and the provider's DMARC/SPF verdict passes; otherwise reject, store nothing but a log row (sender masked), notify `mailbox_rejected` ("Egy levelet nem fogadtunk el, mert nem a te címedről jött: {maszkolt}. Ha a tiéd, add hozzá a Fiókban.").
   - Limits (`MAILBOX_RULES`): ≤ 10 attachments, ≤ 15 MB each, ≤ 25 MB per mail, types PDF, JPEG, PNG, HEIC, XML (magic-byte check as for uploads); the body text is not stored.
   - Each attachment → a document (`source 'ugyfel'`, title = file name, category guessed: `bankszamlakivonat` when the name or first page says "kivonat"/"statement", else `nyugta` for images, else `egyeb`) in the dossier of the **received month**, except a statement received on day 1–10 → the previous month; `mailbox_received` ("Megkaptuk a leveledet: {n} csatolmány a {honap} dossziéban.").
   - Restricted mode: the address exists only after activation; service-locked: still accepted.
7. **Suggested questions** in Üzenetek (empty thread and above the input, 3–4 chips, `SUGGESTED_QUESTIONS`): "Mennyit kell befizetnem, és mikorra?" · "Mit töltsek fel ebben a hónapban?" · "Mennyit tegyek félre?" · "Hogyan kérek jövedelemigazolást?" – a tap fills the input (the client sends it; the accountant answers; no automatic answer).
8. **No paywall surprises:** every feature of the app is in the one plan; the Előfizetés and "Díjak" screens list the only extra fees (§28.K.1) before the card is asked.

---

#### 28.K.13 L – real new-business screens (B4; privacy is binding)

- Source: `C:/Users/UpgradePC/konyvelo_app/_privat/nav_bogi_1119/` (read `OLVASS_EL.md`; label words in `adozasi_adatok_oldal_szovege.md`). **Every image shows personal data of the owner's sister in the header (logged-in name) and on 03/04 (name, mother's name, birth date/place, adóazonosító jel).** These values are fully blurred on every output **before it leaves `_privat/`**; they are never written into any file, prompt, report, log, alt text, `index.json`, test or commit; OCR runs only in memory; outputs are verified at 200 % and with OCR (no readable personal value, the header user area blurred), and only counts are printed. The raw folder stays where it is.
- Replace the drawn "Illusztráció" pictures of `utmutato_kepek/vallalkozas_bejelentes/` with the blurred, annotated real ones: `ugyseged_inditas` (02 + 03), `szemelyi_adatok` (04), `cimadatok` (05 kitöltve – the fake sample address only), `tevekenysegek` (06 kereső / kiválasztva – the public ÖVTJ line), `adozas_munkavegzes` (07, all 7 rows), `adozas_kata_atalany` (08 átalány) **+ the KATA variant image key `adozas_kata_atalany__kata`** (08 KATA ticked + the TAJ field; the field is empty or blurred), `adozas_afa` (09 + 10), `nyilatkozatok` (11 1–2). Keep the NAV film images for `ellenorzes` / `bekuldes` (12/13). Source line "Forrás: saját képernyőkép, 2026. november 19." (label `kepernyokep`).
- Guide texts corrected in `kod/shared` (done, §28.K.24): 6 steps "(1/6)…(6/6)"; Személyi adatok has **Születési ország** (mandatory) and no TAJ; the **7 munkavégzés options** with their NAV numbers ([1] Főfoglalkozásként · [2] Heti 36 órát elérő munkaviszony mellett · [3] Heti 36 órát el nem érő munkaviszony mellett · [4] Nyugdíj mellett · [5] Nappali tagozaton folytatott tanulmányok mellett · [8] Társas vállalkozási tagság mellett · [0] EGT-ben biztosított / belföldön nem biztosított – the last two: "kérj visszahívást"); the KATA line "Bejelentkezem a kisadózó vállalkozók tételes adója alá." + "Társadalombiztosítási azonosító jel" (TAJ); the átalány line "Egyéni vállalkozói tevékenységemre az átalányadózást választom."; the conditions `adozas_atalany` / `adozas_kata` from the new kérdőív answer `taxRegime`; `WORK_KINDS` + `rovid_munkaviszony_mellett` (→ [3], tax status főfoglalkozású).
- Re-render the guide video `vallalkozas_bejelentes` with the new images (the hand-tuned camera views must survive: fix k5 finding 21 first – `video_ujra.py` must re-use the view by step key, not by image hash). No new voice cost unless a line must change (e.g. the TAJ / KATA sentence); then re-take only that line with the Umbriel voice, **max 0.10 USD** total; captions re-timed (k5 finding 27).
- QA: `sajat_kepek_proba.py` extended to the new slug; review sheets `utmutato_kepek/_elonezet/bogi_ellenorzes_*.jpg` (blurred) for the owner; B4 LOOKS at every output.

---

#### 28.K.14 M – the 29 open k5 findings (`_munka/k6/k5_nyitott.json`) → owners

| # | Sev. | Area | Owner | Note |
|---|---|---|---|---|
| 1 | major | app + backend `pathchange.ts` | B2 + B1 | undo after leaving the assisted path must reopen the closed assist |
| 2 | major | app new-business screens | B2 | route guard by path on every new-business screen |
| 3, 4, 17, 18 | minor | app, 320 px cut-offs / cramped rows | B2 | **likely obsolete after §28.K.10** – re-check at 320×640 after the restyle; fix if still present |
| 5, 12 | minor | panel wording ("elállt", "lehívás") | B3 | |
| 6, 7, 8, 9, 10, 14, 19, 26 | minor | app copy / journey texts | B2 (texts from `kod/shared` stay; app-side rendering) | 8 and 19 (the same 24–48 h line twice) partly obsolete with "every message once" (§28.K.10) |
| 13, 15, 16, 20 | 1 major + 3 minor | backend assist / journey | B1 | 13: kill switch and cut-off must also stop OPEN EV assists before filing |
| 11, 21, 22, 23, 24, 25, 27, 28, 29 | 1 major + 8 minor | media / guide pictures / videos | B4 | 21 (camera views) before the §28.K.13 re-render; 25 and 29 largely solved by the real pictures of §28.K.13 |
Each builder reports per number: fixed / obsolete (why) / still open.

---

#### 28.K.15 N – no response-time promise

- Remove every promise of **how fast we answer a message or question**, and the line "nincs buta kérdés", everywhere: app, panel, content defaults, seed, MINTA/mock data, FAQ, e-mails, legal drafts, video captions. Replacement (when a line is needed): **"{firstName} a lehető leggyorsabban válaszol."** (`RESPONSE_TIME_DEFAULT_TEXT`, content `uzenetek.valaszido`).
- `accountants.response_time_text`: default becomes "A lehető leggyorsabban válaszol" (migration `SET DEFAULT`); the data step replaces rows matching `RESPONSE_TIME_FORBIDDEN_PATTERNS` (e.g. "Munkanapokon 4 órán belül válaszol"); `PATCH /acc/settings` rejects texts matching them with "Ide ne írj időt: a lehető leggyorsabban válaszolunk." (panel field hint the same). Live `content_texts` overrides matching the patterns are reset to the new default by the data step (audit).
- **Stays:** the callback promise "24–48 órán belül" (owner's own decision); the client's own effort ("kb. 3 perc"); legal and NAV deadlines; the §26/§27 process lines "általában 1 munkanap" (the owner approved them in B_kisebb at 17:10; [OWNER] wait #50 asks whether they go too). New §28/§28.K texts promise no answer time (§28.3.4 K12 changed accordingly).
- QA grep (`RESPONSE_TIME_FORBIDDEN_PATTERNS`, case-insensitive) over `kod/app/src`, `kod/panel/src`, `kod/backend/src` (content + seed), `kod/jogi`, `kod/media/*.vtt`, `kod/shared/src` → 0 hits.

---

#### 28.K.16 Data model and migrations (B1; additive; pg_dump first)

Files: **`0014_ot1119_enumok.sql`** gets the `notification_kind` ADD VALUEs of §28 **and** §28.K (order of `NOTIFICATION_KINDS`); **`0015_ot1119.sql`** = §28.7.1 (2); **`0016_ot1119_k.sql`** =
- `fee_settings (kind text pk CHECK FEE_KINDS, amount_huf int not null CHECK ≥ 0, unit text not null, confirmed_at timestamptz null, confirmed_by uuid null → users, effective_from date null, updated_by uuid null, updated_at)`; `fee_setting_history (id, kind, amount_huf, confirmed bool, changed_by, changed_at, note)`; seeded from `FEE_DEFAULTS` by the data step (`havidij`, `havidij_kata` confirmed with the owner's timestamps as `note`, the others unconfirmed).
- `fee_charges (id, client_id → clients, kind text CHECK, amount_huf int, purpose jsonb not null, status text CHECK FEE_CHARGE_STATUSES default 'nyitott', due_on date null, simplepay_transaction_id uuid null, fee_invoice_id uuid null, demo bool, waived_by/at/reason null, refund_note null, created_by uuid null, created_at, paid_at null)`; index (client_id, status).
- `assist_requests` + `fee_charge_id uuid null → fee_charges`; widen the `status` CHECK (+ `dijra_var`) and the `kind` CHECK (+ `valtozas_folytatas`); `CHANGE_TAX_ITEMS` widened in the JSON validation (no column).
- `monthly_checkins (id, client_id, period text 'YYYY-MM', status text CHECK `CHECKIN_STATUSES`, answers jsonb null, opened_at, answered_at null, reminded jsonb default '{}'; unique (client_id, period))`; `checkin_items (id, checkin_id, client_id, item text CHECK CHECKIN_ITEMS, status text CHECK CHECKIN_ITEM_STATUSES, details jsonb, assist_id null, fee_charge_id null, staff_note null, client_text null, decided_by/at null, created_at, updated_at)`.
- `annual_closings (id, client_id, tax_year int, regime text, status text CHECK ANNUAL_STATUSES, answers jsonb null, refund_account_enc text null, fee_charge_id null, questionnaire_due date, submitted_at, approved_at, approval_hash, filed_szja_at, filed_hipa_at, checklist jsonb default '{}', created_at, updated_at; unique (client_id, tax_year))`.
- `clients` + `service_lock jsonb null`, `adoszam_pending bool not null default false`, `tax_regime_answer text null` (CHECK `TAX_REGIME_ANSWERS`), `mailbox_code text unique null`, `mailbox_senders text[] not null default '{}'`.
- `client_employer_status (client_id pk, answer text CHECK, answered_at, source text, decision text null CHECK, client_text text null, staff_note null, decided_by/at null)`.
- `subscription_pauses (id, client_id, from date, to date null, fee_kind text, source text, created_by, created_at)`.
- `reserve_marks (client_id, year, marked_huf bigint, updated_at; pk (client_id, year))`.
- `mailbox_log (id, client_id null, received_at, sender_masked text, status text, reason text null, attachments int, document_ids uuid[])` – no bodies, no full addresses.
- `client_tax_profiles` + `regime`, `kata_from`, `kata_to`; `nav_invoices` + `customer_vat_status`; `revenue_items` + `payer_kind`; `business_registrations` work-kind CHECK widened (+ `rovid_munkaviszony_mellett`) and + `tax_regime text null`.
- `accountants.response_time_text` SET DEFAULT 'A lehető leggyorsabban válaszol'.
- `callback_requests` topic/source CHECKs widened (§28.K.18 lists); `simplepay_transactions.kind` + `egyszeri` (app-level type; add a CHECK only if one exists).
- `plans` row `havi_kata` (data step).
**Data step `system_state['data.k28']`** (idempotent; never touches `onboarding_steps`, users, consents, invoices' amounts or revenue amounts): seed `fee_settings`; `plans` prices; backfill `nav_invoices.customer_vat_status` and `revenue_items.payer_kind` from stored data; replace the response-time texts (§28.K.15); generate `mailbox_code` lazily (not here). The `alex@` / `tulaj@` snapshot stays identical except derived/cached rows and the backfilled columns.

---

#### 28.K.17 Notifications and jobs (B1; texts `K28_NOTIFICATION_TEXTS` → content `notif.<kind>[.<variant>].title|body`)

New kinds (`NOTIFICATION_KINDS`, all ADD VALUE in 0014): client – `checkin_due`, `fee_due`, `annual_due`, `annual_status`, `service_locked`, `service_unlocked`, `nudge`, `upload_reminder`, `kata_business_invoice`, `mailbox_received`, `mailbox_rejected`, `employer_decided`, `subscription_paused`; staff – `checkin_change`, `annual_submitted`, `client_locked`, `employer_reported`, `onboarding_task`.
| Kind | Push | E-mail | Default toggle group |
|---|---|---|---|
| `checkin_due` | ✓ | – | EMLÉKEZTETŐK |
| `fee_due`, `service_locked` | ✓ | ✓ | always on (cannot be switched off: payment/lock) |
| `service_unlocked`, `annual_status`, `employer_decided`, `subscription_paused` | ✓ | ✓ | |
| `annual_due`, `nudge`, `upload_reminder` | ✓ | – | EMLÉKEZTETŐK |
| `kata_business_invoice` | ✓ (amounts allowed as §28.2.5) | ✓ | SZÁMLÁK |
| `mailbox_received` | – | – | in-app only |
| `mailbox_rejected` | ✓ | ✓ | |
| staff kinds | – | digest | panel badge |
Jobs (`src/jobs-k28.ts`): `checkin_open` (1st working day 09:00), `reminders_k28` (daily 08:00: KATA, HIPA, upload, nudges, request +3/+7), `annual_open` (5 January 09:00), `annual_reminders` (daily 09:00), `service_lock_check` (daily 06:20, after billing), `pause_reminders` (daily 09:30), staff digest lines ("Havi változás: N", "Éves zárás vár rád: N", "Zárolt ügyfél: N", "Ügyfélre vár 7 napja: N"). Billing (§9.3) uses `chargeAmountHuf()` (§28.K.6).

---

#### 28.K.18 API (`/api/v1`; DTOs in `kod/shared/src/api.ts`, block "SPEC §28.K")

| Method path | Auth | Request → Response |
|---|---|---|
| `GET /client/fees` | C | → **FeesView** (fee table + charges + invoices) |
| `POST /client/fees/:id/pay` | C | `{ platform }` → **FeePayStart** |
| `GET /client/checkins/current` | C | → **CheckinView \| null** |
| `POST /client/checkins/:id` | C | **CheckinAnswerInput** → **CheckinView** (`nem_valtozott` or the answers; creates `checkin_items`) |
| `GET /client/annual?year=` · `PUT /client/annual/:id/answers` · `POST /client/annual/:id/submit` · `POST /client/annual/:id/approve` | C | **AnnualView** / **AnnualAnswersInput** / → **AnnualView** (+ fee charge) / `{ hash }` |
| `POST /client/assist` | C | + change kinds return `feeCharge` when a fee applies (§28.K.1); assist in `dijra_var` |
| `POST /client/onboarding/taxpayer-lookup` | C | **TaxpayerLookupInput** → **TaxpayerLookupResult** |
| `POST /client/onboarding/business-identity` | C | **BusinessIdentityInput** → `OnboardingState` |
| `PUT /client/onboarding/employer` | C | **EmployerAnswerInput** → `OnboardingState` |
| `GET/PUT /client/reserve/mark` | C | **ReserveMarkInput** → **ReserveCard** |
| `GET /client/mailbox` · `POST /client/mailbox/rotate` · `PUT /client/mailbox/senders` | C | → **MailboxView** |
| `GET /client/home` | C | + `twoNumbers`, `paymentCard`, `checkin`, `annual`, `lock`, `pause`, `kata` (all optional, §28.K.12) |
| `GET /me` | all | + `client.taxRegime`, `serviceLock` |
| `POST /public/calculator` | none | **CalculatorInput** → **CalculatorResult** (only if B2 chooses the server path; 30/min/IP; logs counts only) |
| `POST /inbound/mail` | provider signature | provider JSON → 200 (never echoes data) |
| `GET /acc/checkin-items?status=` · `POST /acc/checkin-items/:id` | A, AD (T: only items with an assist) | → **TeamCheckinItem[]** / **CheckinItemDecisionInput** |
| `GET /acc/clients/:id/annual?year=` · `POST /acc/clients/:id/annual/:aid/{draft,filed-szja,filed-hipa,check}` | A, AD | **AccAnnualView** (multipart for uploads) |
| `POST /acc/clients/:id/employer` | A, AD | **EmployerDecisionInput** → `AccClientDetail` part |
| `POST /acc/clients/:id/adoszam` | A, AD | `{ adoszam }` (check digit + ÁFA code warning) |
| `POST /acc/clients/:id/tax-regime` | A, AD | `{ regime, kataFrom?, kataTo? }` |
| `GET/PUT /admin/fees` · `POST /admin/fees/:kind/confirm` · `POST /admin/fee-charges/:id/{waive,refunded}` | AD | **FeeSettingView[]** |
| `POST /team/assists/:id/*` | | 409 `fee_unpaid` while `dijra_var` |
Errors: + `service_locked` 403 (with `reason`), `fee_unpaid` 409, `fee_not_payable` 409 (DEMO fee in production), `lookup_not_configured` 503, `lookup_unavailable` 503, `lookup_rate_limited` 429, `checkin_closed` 409, `annual_wrong_status` 409.
Callback topics + `eves_zaras`, `adozasi_mod`; sources + `havi_ellenorzes`, `eves_zaras`, `kalkulator`, `zarolas`, `alkalmazott`, `adoszam_kereso`, `kata`.
Audit: `fee.*`, `checkin.answered|item_decided`, `annual.*`, `lock.on|off`, `pause.on|off`, `employer.*`, `onboarding.taxpayer_lookup` (found/demo only), `mailbox.accepted|rejected` (counts, masked sender), `tax_regime.set`, `reserve.mark`.

#### 28.K.19 Content keys (defaults from the shared constants by `backend/src/content/k28.ts`; `/admin/szovegek` groups)
"Díjak" `dij.*` (`FEE_TEXTS`) · "Havi ellenőrzés" `havi.*` (`CHECKIN_TEXTS`, `CHECKIN_RESULT_TEXTS`, `CHECKIN_ADMIN_TEXTS`) · "Éves zárás" `eves.*` (`ANNUAL_TEXTS`, `ANNUAL_STATUS_CLIENT_TEXT`) · "Emlékeztetők" `emlekezteto.*` (`REMINDER_TEXTS`) · "Zárolás" `zarolas.*` (`LOCK_TEXTS`) · "Szüneteltetés" `szunetel.*` (`PAUSE_TEXTS`) · "Alkalmazottak" `alkalmazott.*` (`EMPLOYER_TEXTS`) · "Kalkulátor" `kalkulator.*` (`CALCULATOR_TEXTS`) · "Adószám-kereső" `adoszam.*` (`TAXPAYER_LOOKUP_TEXTS`, `BUSINESS_MANUAL_TEXTS`) · "Kata" `kata.*` (`KATA_TEXTS`) · "Főoldal" `fooldal.*` (`HOME_K_TEXTS`) · "Postafiók" `postafiok.*` (`MAILBOX_TEXTS`) · "Üzenetek" `uzenetek.javaslat.*` (`SUGGESTED_QUESTIONS`), `uzenetek.valaszido` · notifications `notif.<kind>.*` (`K28_NOTIFICATION_TEXTS`) · explainers (new keys in `EXPLAINER_KEYS`). Placeholders as §27/§28 plus `{dij}` ("4 999"), `{mit}`, `{honap}`, `{ev}`, `{keret}`, `{pct}`.

#### 28.K.20 Legal texts (B4; drafts "TERVEZET – jogász ellenőrzi"; `requiresReconsent` decided by [JOGI] – the price drop and new fees change the ÁSZF)
- **ÁSZF:** price 19 999 Ft; the fee list (§28.K.1) with "DEMO" values marked for the owner; prepayment of assisted changes and the annual closing; refund rule; the monthly check-in (the client's duty to tell changes; what happens if he does not); suspension of the service for non-payment (§28.K.5) with the GDPR/payment/support exceptions; the availability fee during szüneteltetés; payroll not included (EFO/employees: individual offer); KATA service scope (the client must tell us before invoicing a business); the calculator is not tax advice; the forwarding mailbox terms.
- **Adatkezelés:** the taxpayer lookup (our technical user, purpose, no storage beyond the confirmed fields); the forwarding mailbox (senders, retention like documents, rejected mail log without bodies); annual questionnaire data (other incomes, refund bank account – encrypted); employer status; reserve marks; no tracking in the calculator.
- **FAQ 17 → 23:** "Mennyibe kerül?" (19 999 Ft/hó; extra only: éves zárás, ha mi intézzük a változást, szüneteltetés alatt a kisebb díj), "Mi az a havi ellenőrzés?", "Mi történik, ha nem tudok fizetni?", "Katás vagyok – nálatok jó helyen vagyok?", "Mi az a továbbító e-mail-cím?", "Van alkalmazottam – mit tudtok vállalni?". No response-time promise (§28.K.15). `npm run minden` passes; `pdf_minta/` regenerated.

#### 28.K.21 Demo data `seed:k28` (local harness + live demo DB; same rules as §28.11; fake data only; never touches `alex@`, `tulaj@`, `bence.kovacs@`, `david@`)
1. **Lakatos Gréta** (`greta.lakatos@demo.kezjegy.test`, login, `aktiv`, KATA from 2026-01-01, accountant Bence): 2026 invoices to `PRIVATE_PERSON` customers ~900 000 Ft/month + **one `DOMESTIC` invoice** ("Bodza Kiadó Kft.", unpaid) → the red warning; keret meter ~70 %. Harness `?ki=greta`.
2. **Kiss Norbert** (`norbert.kiss@demo.kezjegy.test`, login, `aktiv`, átalány főfogl.): an open November check-in with `munkaviszony` = ≥ 36 h answered and an assisted `valtozas_adoadat` in `dijra_var` with an open 7 999 Ft (DEMO) charge → pay flow on the demo page. Harness `?ki=norbert`.
3. **Fazekas Ilona** (`ilona.fazekas@demo.kezjegy.test`, login): subscription `suspended` → service locked (banner, read-only, pay). Harness `?ki=ilona`.
4. **Bárány Tamás** (`tamas.barany@demo.kezjegy.test`, login, `bekotes_alatt`, path 'van'): answered "Most nem tudom" for the adószám + "Van EFO-s foglalkoztatottam" → panel tasks `adoszam` and the employer decision. Harness `?ki=tamas`.
5. **Molnár Csilla** (`csilla.molnar@demo.kezjegy.test`, login, `aktiv`): a pause (szünetel since 2026-10-01) → availability fee lines; annual closing 2025 `kesz` as a history example.
6. Bálint (§28.11) gets a 2026 annual-closing row in `nem_indult` (opens on 5 January); the fee table seeded; one mailbox log row (accepted) for Eszter.
Passwords only appended to `/srv/kezjegy/demo_belepesek.txt`, never printed. `kod/deploy/seed-k28.sh` mirrors `seed-ot1119.sh`; `helyi-proba.mjs` calls `seedK28` after `seedOt1119`.

#### 28.K.22 Acceptance tests
- **P (prices/fees):** grep sweep 20 000 → 0 price hits; `fee_settings` edit + confirm + history; DEMO chip visible until confirmed; production refuses an unconfirmed fee; one-time payment demo FINISHED → charge `fizetve` → assist `egyeztetve` + fee invoice; failed payment → nothing starts; refund marking.
- **A:** the job opens one check-in per active client on the 1st working day (fake clock), none for locked / new (< 20 days) clients; "Nem változott semmi" in one tap; each item's follow-up and result text (fő→mellék ≥ 36 h, < 36 h, mellék→fő, nyugdíj, KATA cases); assisted path pays 4 999 / 7 999 (DEMO) before `egyeztetve`; self path 0 Ft; `checkin_items` in the panel queue; screenshots `k28k_havi_*.png` LOOKED at.
- **B:** opens 5 January; questionnaire pages; KATA variant; fee on submit; approval with hash; panel checklist → `beadva` → `kesz`; reminders on the defined days.
- **C:** each reminder fires once on its day (dedupe), respects toggles and quiet hours; one nudge push per day with several items; request +3/+7.
- **D:** suspended subscription → `service_locked` on the listed client and staff endpoints; payment/GDPR export/messages to the team/callback `elofizetes` still 200; unlock on FINISHED; panel chip and disabled buttons; screenshots.
- **E:** pause → the next charge is 2 999 (DEMO) and the fee invoice line; `valtozas_folytatas` change-done closes the pause.
- **F:** onboarding answer ≠ Nincs → journey row + Előfizetés locked; each decision's client text; `nem_vallaljuk` stops onboarding without any charge.
- **G:** §28.K.8 tests; no request carries the inputs; SEO tags in the exported HTML; embedded mode posts its height; frame-ancestors only on `/kalkulator*`.
- **H:** lookup fires at the 8th digit once; card; not found / not EV / ÁFA code 2 / NAV down / rate limit texts; "Most nem tudom" manual path completes onboarding with `adoszamPending`; the accountant fills the adószám; no lookup result stored beyond the confirmed fields (DB grep).
- **I:** before/after screenshots of every listed screen at 390×844 and 320×640, LOOKED at; token values match `UI_SCALE` (a script reads computed styles on web); adjacent sections are separated by the 10 px `#D3DAFC` band and no section or card has a box-shadow (same script; the only exception is the type-ahead confirm card); side-by-side of the Főoldal with `C_VEGLEGES/fooldal.png`; 200 % text size: no cut text; contrast check.
- **J:** engine KATA tests (B4, [KATA] §17.2 examples: táppénz 01.19–03.24 → Jan liable, Feb + Mar exempt; 03-01 start 17 M → 800 000 Ft különadó; full year 20 M → 800 000; DOMESTIC invoice → end date receipt − 1, notice + 15); Gréta's home, invoice warning, push, panel chip; allowance gate text for KATA.
- **K:** two numbers = API values; payment card copy buttons; ring with and without a mark, subtraction after "Elutaltam"; quarter-grouped deadlines; status tab counts; mailbox: accepted own sender → document in the right month, foreign sender rejected + notification, oversize/type rejected; suggested questions fill the input.
- **L:** OCR and 200 % checks pass, no personal value in any output or file (grep with the known label words only); KATA image shown for a KATA kérdőív; video re-render keeps the camera views; voice cost ≤ 0.10 USD.
- **M:** each of the 29 findings reported fixed / obsolete / open.
- **N:** the grep of §28.K.15 → 0 hits; the settings validation.
- **Safety:** §28.12 KS unchanged.

#### 28.K.23 Waits (additions)
| # | Item | Who | Until then |
|---|---|---|---|
| 43 | Confirm the DEMO fees (éves zárás 14 999, változás 4 999 / 7 999, szüneteltetési díj 2 999) in `/admin/dijak` | OWNER | DEMO chip; not chargeable in production |
| 44 | Fee class of `valtozas_adoadat` items `kozossegi_adoszam` / `egyeb` | OWNER | `valtozas_egyszeru` |
| 45 | One-off fees: card entry each time vs charging the stored token | OWNER / JOGI | card entry each time |
| 46 | Scope and price of non-EV incomes in the annual closing (rental, sale, securities, foreign) | OWNER / KÖNYVELŐ | "{firstName} megnézi" |
| 47 | ÁSZF: suspension of the service for non-payment, refund rule, price change notice | JOGI | drafts |
| 48 | Annual questionnaire due dates (15 March / 5 February) | KÖNYVELŐ | as written |
| 49 | T101E duty for [1]→[3] (főállás with < 36 h employment); the 2-year szüneteltetés rule and the resumption labels | KÖNYVELŐ / B4 research | sentences marked [ELLENŐRIZENDŐ] stay out |
| 50 | Should the §26/§27 process lines "általában 1 munkanap" go too (order N said "ne írj időt")? | OWNER | they stay; only answer-time promises are removed |
| 51 | Mail provider + domain for the forwarding addresses (`MAILBOX_PROVIDER`, `MAILBOX_DOMAIN`, webhook secret) | OWNER | DEMO mailbox |
| 52 | Our NAV technical user for the lookup (Somosi Kft.; `NAV_LOOKUP_*`) | OWNER | DEMO mock / manual form in production |
| 53 | KATA business-customer rule (DOMESTIC/OTHER = kifizető), the kata→átalány path after a forced end, the 2026-11-30 old-KATA question | KÖNYVELŐ | as [KATA] §17 |
| 54 | Individual payroll offers (price, contract) | OWNER | text offer + callback, nothing charged in the app |
| 55 | adozz.hu embedding origin | OWNER | self only |
| 56 | KATA in the assisted EV registration: the NAV form asks the client's TAJ number – how our accountant receives it (in the call or a one-off document request; never a stored structured field) | OWNER / JOGI | the accountant asks for it in the call |
| 57 | Section titles: the 16:55 order said "blue title", the approved C mockup (20:10) uses dark ink with blue only for the band, button, link and active tab | OWNER | C's dark titles (§28.K.10) |

#### 28.K.24 What changed in `kod/shared` (B0, 2026-11-19 ~20:00–21:00; old files in `kod/_regi/shared_src_elotte_ot1119/`, the half-done state of the interrupted first run in `kod/_regi/shared_src_elotte_k28_folytatas_2030/`)
Checked with `tsc --noEmit` under TypeScript 5.9.3 (backend, panel, jogi, nav-kliens) and 6.0.3 (app), and under NodeNext for `enums.ts` + `bekotes.ts` (jogi / nav-kliens copy them); a scratch script ran the guide personalisation, `changeFeeKind`, `checkinItemsFor` and the response-time patterns (all green; no "20 000 Ft", no answer-time promise, no AI wording in any shared text).
- `brand.json`: `priceHufMonthlyGross` 19 999, subline "Egyéni vállalkozóknak, havi 19 999 Ft."
- `enums.ts` – changed in place: `NOTIFICATION_KINDS` (+5 §28, +18 §28.K), `CLIENT_FEATURES` + rules (`felretesz`, `kereset`, `kedvezmenyek`, `valtozas`, `havi_ellenorzes`, `eves_zaras`, `dijak`, `tovabbito_email`), `CALLBACK_TOPICS` (+`valtozas`, `valtozas_helyettem`, `eves_zaras`, `adozasi_mod`) and `CALLBACK_SOURCES` (+§28 +§28.K), `ASSIST_KINDS` (+6 change kinds) with labels / callback topic / phases, `ASSIST_STATUSES` (+`dijra_var`, ball `ugyfel`), `ASSIST_ACTIONS` (+`adatok_rendben`, `valtozas_kesz`, `dij_fizetve`), `ASSIST_CHECK_ITEMS` (+phases `valtozas_adatok`, `valtozas_bejelentes`), `GUIDE_KINDS` (+6) + `GUIDE_STEP_KEYS` + `GUIDE_VIDEO` (null), `JOURNEY_STEP_KEYS` (+`kedvezmenyek`, `alkalmazottak`) + `JOURNEY_ORDER`, `JOURNEY_NOT_REQUIRED_FOR_ACTIVATION` (+`kedvezmenyek`), new `JOURNEY_NOT_COUNTED`, `WORK_KINDS` (+`rovid_munkaviszony_mellett` → főfoglalkozású), `PAYMENT_ITEM_KINDS` (+`kata_teteles`, `kata_kulonado`), `CLIENT_FLAGS` (+`zarolva`, `kata_figyelem`).
- `enums.ts` – new block "SPEC §28": `RESERVE_ZONES`, `RESERVE_ESTIMATE_REASONS`, `RESERVE_ROUND_HUF`, `INVOICE_NOTIFY_RULES`, `INVOICE_NOTIFY_STATES`, `INVOICE_NOTIFY_VARIANTS`, `QUIET_HOURS_DEFAULT`, `QUIET_HOURS_EXEMPT_KINDS`, `PUSH_AMOUNT_KINDS`, `NOTIFICATION_PREFS_MAX` (80), `ALLOWANCE_KINDS` / `ALLOWANCE_ENGINE_ORDER` / `ALLOWANCE_STATUSES` / `ALLOWANCE_PENDING_STATUSES` / `ALLOWANCE_GATES` / `ANYAK_JOGCIMEK` / `ALLOWANCE_REJECT_REASONS` / `ALLOWANCE_LIMITS` / `ALLOWANCE_DECIDED_VARIANTS` / `ALLOWANCE_CHECK_VARIANTS`, `EARNINGS_BASES`, `EARNINGS_RULES`, `CHANGE_KINDS` (6), `CHANGE_UGYSEGED_KINDS`, `CHANGE_UGYSEGED_VALID_UNTIL_DEFAULT`, `CHANGE_ADOADAT_VALID_UNTIL`, `CHANGE_DONE_BY_FILER_ALLOWED_DEFAULT`, `CHANGE_KIND_ICON`, `CHANGE_TAX_ITEMS` (+`nyugdijba_vonulas`, `kata_belepes`, `kata_kilepes`), `CHANGE_TAX_ITEMS_CALL_FIRST`, `CHANGE_TAX_ITEMS_JOGALLAS`, `CHANGE_ACTIVITY_MODES`, `STREET_TYPES`, `CHANGE_RULES`, `CHANGE_FOLLOWUP_KEYS`.
- `enums.ts` – new block "SPEC §28.K": `FEE_KINDS`, `FEE_UNITS`, `FEE_DEFAULTS`, `PLAN_CODES` + `PLAN_FEE_KIND` (`havi`, `havi_kata`), `ONE_OFF_FEE_KINDS`, `CHANGE_FEE_RULES`, `changeFeeKind()`, `FEE_CHARGE_STATUSES` (+`visszavonva` = cancelled before payment), `FEE_PURPOSE_TYPES`, `FEE_RULES`, `FEE_ERROR_CODES`; `CHECKIN_STATUSES` (`nyitott`, `nem_valtozott`, `valtozott`, `lejart`), `CHECKIN_ITEMS`, `CHECKIN_ITEM_STATUSES`, `CHECKIN_HOW`, `CHECKIN_WEEKLY_HOURS`, `EMPLOYMENT_THRESHOLD_HOURS`, `CHECKIN_RULES`, `checkinItemsFor()`; `ANNUAL_STATUSES`, `ANNUAL_BALL`, `ANNUAL_RULES`, `ANNUAL_CHECK_ITEMS`, `OTHER_INCOME_KINDS`, `OTHER_INCOME_KNOWN_TO_NAV`, `ANNUAL_HIPA_PLACES`, `ANNUAL_ERROR_CODES`; `REMINDER_RULES`, `REMINDER_GROUPS` + `REMINDER_GROUP_KINDS`, `ALWAYS_ON_KINDS`, `REMINDER_VARIANTS`, `NUDGE_SUBJECTS`; `SERVICE_LOCK_REASONS`, `SERVICE_LOCK_ERROR_CODE`, `SERVICE_LOCK_RULES`; `PAUSE_SOURCES`, `PAUSE_RULES`; `EMPLOYER_ANSWERS`, `EMPLOYER_DECISIONS`, `EMPLOYER_DECISIONS_ALLOW_ACTIVATION`, `EMPLOYER_SOURCES`, `EMPLOYER_RULES`; `CALCULATOR_SIDE_OPTIONS`, `CALCULATOR_SIDE_TAX_STATUS`, `CALCULATOR_RULES`; `TAXPAYER_LOOKUP_RULES`, `TAXPAYER_LOOKUP_STATUSES`, `TAXPAYER_LOOKUP_ERROR_CODES`, `BUSINESS_IDENTITY_SOURCES`, `YES_NO_DONTKNOW`, `ALANYI_MENTES_VAT_CODE`; `TAX_REGIMES`, `TAX_REGIME_ANSWERS`, `KATA_RULES_2026`, `PAYER_KINDS`, `PAYER_KIND_BY_VAT_STATUS`, `KATA_WARNING_PAYER_KINDS`; `DOCUMENT_STATUS_TABS` + `DOCUMENT_STATUS_TAB_OF`, `MAILBOX_RULES`, `MAILBOX_STATUSES`, `MAILBOX_REJECT_REASONS`; `RESPONSE_TIME_FORBIDDEN_PATTERNS`, `ACCOUNTANT_RESPONSE_TIME_DEFAULT`; **`UI_SCALE` = variant C + the separator band (§28.K.10; 10 px `#D3DAFC` since the k6c fix round)**.
- `bekotes.ts` – changed in place: `EXPLAINER_KEYS` (+7 §28, +8 §28.K; their texts in the new `EXPLAINERS_28` – the backend content generator reads `ONBOARDING_EXPLAINERS` **and** `EXPLAINERS_28`); explainer `adoszam.where` = the five places of §28.K.9; `WORK_KIND_GUIDE_VALUE` = the real NAV rows "[1]…[5]" (+`rovid_munkaviszony_mellett`) and the new `NAV_WORK_KIND_OPTIONS` (all 7 rows; [8] and [0] → "kérj visszahívást"); `GuideCondition` + `adozas_atalany`, `adozas_kata`, `tevekenyseg_uj_fo|uj_mellek|torles`; `GuideTemplateStep` + `imageWhen`, `when`; `GuideAnswersInput.taxRegime`; new `guideImageKey()`; `personaliseGuide` uses both; the new-business template: Személyi adatok with **Születési ország** (no TAJ line), the munkavégzés step with the 7-row note, the kata/átalány step in two variants (KATA: "Bejelentkezem a kisadózó vállalkozók tételes adója alá." + "Társadalombiztosítási azonosító jel"; picture `adozas_kata_atalany__kata`), Ellenőrzés by regime; `JOURNEY_STEP_TEXTS` + `kedvezmenyek`, `alkalmazottak`; `ASSIST_STATUS_CLIENT_TEXT` + `dijra_var`; `ASSIST_TEXTS.consentAdozasKata`; `{havidij}` = "19 999 Ft".
- `bekotes.ts` – new block "SPEC §28": `RESERVE_TEXTS`, `RESERVE_ZONE_STAFF_LABELS`, `RESERVE_PANEL_TEXTS`, `NOTIFY_INVOICE_TEXTS`, `NOTIFY_SETTINGS_TEXTS`, `ALLOWANCE_LABELS`, `ANYAK_LABELS`, `ALLOWANCE_CLIENT_LINES`, `ALLOWANCE_REJECT_REASON_LABELS`, `ALLOWANCE_DOCUMENTS_TO_KEEP`, `ALLOWANCE_TEXTS`, `ALLOWANCE_QUESTION_TEXTS` (K0–K12), `ALLOWANCE_NOTIFICATION_TEXTS`, `ALLOWANCE_PANEL_TEXTS`, `EARNINGS_TEXTS`, `CHANGE_TEXTS` (hub, rows, info pages, assisted card), `CHANGE_FACTS` (`verified` flag), `CHANGE_STEP_LIST` (with the prepaid-fee row), `CHANGE_STATUS_CLIENT_TEXT`, `CHANGE_CONSENT_TEXTS`, `CHANGE_HANDBOOK`, `CHANGE_FOLLOWUP_LABELS`, `CHANGE_FORM_TEXTS`, `CHANGE_NOTIFICATION_TEXTS`, **`CHANGE_GUIDE_TEMPLATES`** (6 kinds; step lists = `GUIDE_STEP_KEYS`), **`ALL_GUIDE_TEMPLATES`** (= `GUIDE_TEMPLATES` + the change templates; `GUIDE_TEMPLATES` itself keeps its 3 keys), `CHANGE_GUIDE_VERSION` "2026-11-19.ot", `huLongDate()`, `ChangeGuideData`, **`personaliseChangeGuide()`**, `EXPLAINERS_28`.
- `bekotes.ts` – new block "SPEC §28.K": `FEE_KIND_LABELS`, `FEE_UNIT_LABELS`, `FEE_CHARGE_STATUS_LABELS`, `FEE_TEXTS`, `CHECKIN_TEXTS`, `CHECKIN_ITEM_TEXTS`, `CHECKIN_FOLLOWUP_TEXTS`, `CHECKIN_RESULT_TEXTS`, `CHECKIN_ADMIN_TEXTS`, `CHECKIN_PANEL_TEXTS`, `ANNUAL_TEXTS` (E0–E8, card, approval, panel), `OTHER_INCOME_LABELS`, `ANNUAL_STATUS_CLIENT_TEXT`, `ANNUAL_CHECK_LABELS`, `REMINDER_TEXTS`, `LOCK_TEXTS`, `PAUSE_TEXTS`, `EMPLOYER_ANSWER_LABELS`, `EMPLOYER_DECISION_LABELS`, `EMPLOYER_DECISION_CLIENT_TEXTS`, `EMPLOYER_TEXTS`, `CALCULATOR_TEXTS`, `TAXPAYER_LOOKUP_TEXTS`, `BUSINESS_MANUAL_TEXTS`, `KATA_TEXTS`, `HOME_K_TEXTS`, `DOCUMENT_STATUS_TAB_LABELS`, `MAILBOX_TEXTS`, `SUGGESTED_QUESTIONS`, `RESPONSE_TIME_DEFAULT_TEXT`, `RESPONSE_TIME_SETTINGS_ERROR`, `K28_NOTIFICATION_TEXTS`.
- `api.ts` – optional fields on existing DTOs: `RegisterInput.entry`; `ClientSummary.taxRegime/serviceLock`; `Me.notificationSettings`; `OnboardingState.employer/businessIdentity/taxRegimeAnswer`; `ClientProfileInput.adoszamPending`; `ClientProfile.taxRegime`; `Deadline.group`; `NavInvoiceListItem.reserve/payerKind/kataWarning`; `ClientHome.reserve/earnings/allowancesHint/twoNumbers/paymentCard/checkin/annual/lock/pause/kata`; `SubscriptionView.planCode/nextChargeAmountHuf/pause/priceDemo`; `FeeInvoiceItem.feeKind/label`; `AccClientRow.allowancesPending/taxRegime/serviceLocked/annualWaiting/checkinOpenItems/adoszamPending`; `AssistView.change/activityPending/feeCharge`; `AssistCreateInput.change/callback`; `AssistCreateResult.feeCharge` and **`callback: CallbackView | null`** (a change request without a call has none); `TeamAssistDetail.change/followups/feeCharge/serviceLocked`; `BusinessRegistrationInput.taxRegime` + `BusinessRegistrationAnswers.taxRegime`.
- `api.ts` – new block "SPEC §28": `InvoiceReserveView` (+`listLine`), `ReserveCard` (+ the §28.K.12 `markedHuf`, `ring`), `ReserveListItem`, `ReserveView`, `NotificationSettings`, `NotificationSettingsPatch`, the allowance DTOs of §28.3.2 (+`AllowanceClientPreviewInput/AllowanceClientPreview`, `AllowanceState.notForRegime`), the earnings DTOs of §28.4.4, `NavAddress`, `ChangeData` (+`valtozas_folytatas`), `ChangeGuidesView`, `AssistChangeUpdateInput`, `ChangeDoneInput`, `ChangeFollowupPatch`, `ChangeFollowupView`, **`AccClientDetailK28`** (the panel's own `AccClientDetail` extends it).
- `api.ts` – new block "SPEC §28.K": `FeeChargeView`, `FeesView`, `FeePayInput`, `FeePayStart`, `FeeSettingView`, `FeeSettingUpdateInput`, `FeeWaiveInput`, `CheckinItemView`, `CheckinView`, `CheckinItemAnswer`, `CheckinAnswerInput`, `CheckinItemDecisionInput`, `TeamCheckinItem`, `AnnualAnswers`, `AnnualView`, `AnnualAnswersInput`, `AnnualApproveInput`, `AccAnnualView`, `AnnualCheckInput`, `ServiceLockView`, `PauseView`, `EmployerStatusView`, `EmployerAnswerInput`, `EmployerDecisionInput`, `CalculatorInput`, `CalculatorTaxes`, `CalculatorResult`, `TaxpayerLookupInput`, `TaxpayerLookupResult`, `BusinessIdentityInput`, `AdoszamStaffInput`, `TaxRegimeInput`, `KataHomeView`, `TwoNumbersView`, `PaymentCardView`, `ReserveMarkInput`, `DocumentStatusTabCount`, `MailboxView`, `MailboxSendersInput`, `MailboxLogRow`.
- **Expected compile breaks after `sync-shared`** (each builder fixes his own): every `Record<NotificationKind | ClientFeature | CallbackTopic | CallbackSource | AssistKind | AssistStatus | AssistAction | GuideKind | JourneyStepKey | WorkKind | PaymentItemKind | ClientFlag, …>` (backend `KIND_DEFAULTS`, `GUIDE_TITLES`, the route→feature map, `ClientFilter` counts; app `api/minta/*`, labels; panel `lib/labels.ts`, mock); code that reads `AssistCreateResult.callback` without a null check; code that indexes `GUIDE_TEMPLATES` with a change kind (use `ALL_GUIDE_TEMPLATES` / `personaliseChangeGuide`); `ClientProfileInput.adoszam` may now be `''` with `adoszamPending`; tests that match "20 000", the old guide texts ("Csak nézd át.", the TAJ sentence, "főfoglalkozású egyéni vállalkozó", "A katával kapcsolatos nyilatkozat") or the old `adoszam.where` (app `tests/*`, jogi `jogi.test.ts`, backend guide tests).

#### 28.K.25 Builder notes – backend + tax engine (B1 + B4, 2026-11-19 night; append-only)
Old files: `kod/backend/_regi/elotte_k28_1119/` (src, drizzle, test, package.json) and `kod/ado-motor/_regi/elotte_k28_1119/`. Nothing deployed.
- **Engine (`@kezjegy/ado-motor`, `ENGINE_VERSION` 1.2.0):** allowances of §28.3.7 (`engine/allowances.ts`, `TaxRules.allowances` in 2026 + 2027 draft with `ketgyermekesMinBirthYear` 1977; validation T21), `reserveSeries` / `roundReserve` / `earningsByMonth` / `projectYear` / `splitByWeights` (`engine/reserve.ts`). Tests `test/kedvezmenyek.test.ts` (T1–T21 green, **T22 `it.todo`**: the NAV 100 6.1 "Csjk alapja" column 968 400 / 1 491 200 / 1 814 000 / 2 459 600 could not be rebuilt from the research notes – it needs the full NAV example; it also suggests the cap base of a short-minimum month is the FULL minimálbér, while §28.3.7 c step 5 uses the prorated `line.minimumHuf` → [KÖNYVELŐ] wait #32), `felretesz.test.ts` (R1–R10), `kereset.test.ts` (E1–E4; E3 taxes 2 313 818 incl. HIPA 120 000 from the defined method). Every older test unchanged.
- Engine contract additions (all optional): `YearResult.activeMonths / activeDays / elapsedActiveDays` (§28.4.2 HIPA spread, §28.4.3 reliability); `reserveSeries(profile, items, { approvedQuarters? })` – the third argument carries the T1 approved quarters. SZJA monthly attribution uses `max(0, B2[m])` as weights (a storno month never gets negative SZJA). `QuarterResult.tbHuf` is the TB **after** csjk; `MonthLine.tbHuf` stays gross; the explanation shows "TB-járulék most".
- **Migrations:** `0014_ot1119_enumok.sql` (23 notification kinds), `0015_ot1119.sql` (§28.7.1), `0016_ot1119_k.sql` (§28.K.16), journal entries added by hand like 0010 (no drizzle snapshot for 0014–0016: the next `drizzle-kit generate` must start from the schema, not from snapshot 0013 – check its output before using it). The open-assist unique index now includes `dijra_var`. Data steps `data.ot1119` + `data.k28` (`services/datastep-k28.ts`, worker start): content overrides that promise an answer time are **reset to the default text in place** (row kept), never deleted.
- **Backend services:** `felretesz.ts` (lazy cache by inputs hash), `szamla-ertesites.ts` (claim → fold-in → max 2 pushes/day → `rejtett`; `{vevo}` loses a trailing period so "Kft.." never appears), `kedvezmeny.ts`, `kereset.ts`, `valtozas.ts`, `dijak.ts` (fee settings + one-off SimplePay `egyszeri`; `payments/simplepay.ts` `recurring` is now optional), `zarolas.ts`, `szuneteltetes.ts` (`chargeAmountHuf` used by `chargeSubscription`), `alkalmazott.ts`, `havi-ellenorzes.ts`, `eves-zaras.ts`, `emlekezteto.ts`; routes `client-k28.ts` (registered before the §26/§27 client routes: change kinds of `/guides/:kind`, `/assist`, `/assist/:id/{consent,cancel}` are answered there, everything else falls through) and `acc-k28.ts` (acc + admin + team parts); jobs `jobs-k28.ts` (one line in `jobDefs`).
- Deviations: (1) csapat on `/acc/clients/:id/allowances` gets **403** from the /acc role guard (not 404); non-admins get 404 on `/admin/fees`. (2) `CHANGE_UGYSEGED_VALID_UNTIL` / `CHANGE_DONE_BY_FILER_ALLOWED` are read from `process.env` in `valtozas.ts` (not yet in `config.ts`/§13). (3) Change-guide progress is kept in `system_state['valtozas_utmutato:<client>:<kind>']` (no new column); the PUT body is `{ doneStepKeys }` like the onboarding guides. (4) The annual draft approval hash = sha256(`<document id>:`) of the newest shared `bevallas` document. (5) Push quiet hours now apply to EVERY client push except `callback_calling` (old fixed 8–20 h list removed); in-app and e-mail never wait. (6) `PLAN_PRICE_HUF` default is the brand price 19 999; `startRegistration` and the recurring charge read the admin fee setting (`fee_settings.havidij`, a rise only from `effective_from`).
- **Not built here (other builders or later):** KATA engine branch / `kataLimitMeter` / KATA home and reminders, `calculatorEstimate` + `POST /public/calculator`, adószám lookup (`/client/onboarding/taxpayer-lookup`, `business-identity`), the forwarding mailbox (`postafiok.ts`, `/inbound/mail`), `paymentCard` in the home, quarter-grouped deadlines, document status tabs, the `kata_business_invoice` push, the HIPA-advance and receipts reminders, `/acc/clients/:id/adoszam`. `helyi-proba.mjs` (B2) should call `seedOt1119` then `seedK28` (dist/seed/ot1119.js, dist/seed/k28.js) after `seedTulaj1119`.
- k5 findings: **13 fixed** (kill switch / cut-off also stop open EV requests at consent and filing), **15 fixed** (nav_bekotes row stays "Később" on the new-business path until the registration is 'kesz'), **16 fixed** (filedOn ≥ the consent / live-meghatalmazás day), **20 open** (the "Ma még … 17 óráig" hour text), **1 open** (undo of a switch away from the assisted path – backend part in `pathchange.ts` not touched).
- Tests: backend 26 + 2 new files (`test/ot1119-k28.test.ts` 27 tests, `test/seed-ot1119-k28.test.ts` 6 tests); existing tests updated only where the contract changed (19 999 Ft, the `kedvezmenyek` journey row, the real NAV guide labels of §28.K.13, the new feature reason wording).

#### 28.K.26 Fix round k6c (2026-11-20; append-only)
Old files: `kod/backend/_regi/elotte_k6c_fix/`, `kod/app/_regi/elotte_k6c_fix/`, `kod/_regi/shared_src_elotte_k6c_fix/`, `kod/_regi/SPEC_elotte_k6c_fix.md`, `kod/ado-motor/_regi/dist_elotte_k6c_fix_*`, guide pictures `kod/media/_regi/k6c_elotte*/`. Not deployed (the upload needs the owner's go-ahead).
- **Engine 1.3.0:** 25 év alattiak = ANNUAL frame (eligible months × 715 765, Szja tv. 29/F. § (2)) applied cumulatively in the advances (`monthBoundPass`); `earningsByMonth` puts TB/szocho in the month whose own income caused it (the fixed minimum stays per month), HIPA by active days (`YearResult.activeDaysByMonth`, `hipaByMonth`); `yearEndSettlement` (overpaid SZJA advances + year-end csjk) – earnings YTD and `projectYear` count the year's real tax (`refundHuf`). Tests T3 (now 0), C5, C5b (401 103), C18, R4, C17, E5.
- **One "eddig":** the Félretenni card's A = the earnings months so far (`kereset.ts earningsBasis`); rows rounded "kb."; `heroNote` on the Főoldal only; upcoming (estimated-date) items marked and left out of the month sums (`ReserveListItem.upcoming`).
- Seeded invoice notifications from the engine reserves (`invoiceItems` / `invoiceNotificationContent`); data step `data.k6c` (pauses → `szunetel` insurance breaks; demo invoice notifications re-rendered every worker start).
- Annual questionnaire accepts/ignores `refundAccountMasked`; no stale previous-year row (`defaultAnnualYear`). Lock lifts on FINISHED (`applyFinished` → `computeServiceLock`); `GET /me` returns `client.serviceLock` + `taxRegime`. Pause writes the insurance break; "október 1-jétől" (`huDayMonthTol`).
- KATA (until the KATA view): no reserve, earnings, adómentes line or estimate letter; "{firstName} számolja". `{firstNameWith}` everywhere (`hunWith`). One formatter groups 4 digits. Allowance texts (annual 25 frame, no "kb. 0 Ft-tal", quarterly fallback), check-in result (only "igen" items, paid → "nekilát", change-specific assist texts with `{dij}`), first-married split 16 667, invoice detail buyer label, typeable year, "Még kb. N kérdés", Hungarian date input, hub single link, /helyettunk → /valtozas for active clients.
- Separator: the owner's final band is 10 px `#D3DAFC` (C_VEGLEGES) – §28.K.10, `UI_SCALE` and the panel comments corrected.
