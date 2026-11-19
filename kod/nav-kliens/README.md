# @kezjegy/nav-kliens

Read-only TypeScript client for **NAV Online Számla API v3.0**, plus a local **DEMO mock** that speaks the same XML.
Contract: `kod/SPEC.md` §8 (additions are listed in SPEC §24, "nav-kliens" notes).

**Röviden (magyarul):** ez a csomag olvassa ki az ügyfél NAV-hoz beküldött számláit a technikai felhasználóval.
Semmit nem küld be a NAV-nak, ilyen művelet nincs is benne. Kulcsok nélkül DEMO módban fut: kitalált MINTA számlákat ad,
és mindegyiken `source: 'DEMO'` áll.

## What it does

| Operation | Use |
|---|---|
| `queryInvoiceDigest` | list invoices by issue date or by NAV processing time (`insDate`), max 35 days per call, paged by 100 |
| `queryInvoiceData` | one full invoice: base64 → gunzip if compressed → `InvoiceData` XML → `NormalizedInvoice` |
| `queryTaxpayer` | "Kapcsolat ellenőrzése" (credential check) and taxpayer lookup |
| `queryInvoiceChainDigest` | an invoice and its MODIFY/STORNO documents (optional) |

Only these four exist (`READ_OPERATIONS`). A test fails if any data-reporting, annulment or token operation name appears in `src/`.
The HTTP transport refuses any other operation as well.

- Signing exactly per the interface spec: `passwordHash` = UPPER(SHA-512(password)), `requestSignature` = UPPER(SHA3-512(requestId + yyyyMMddHHmmss + signingKey)), with SHA3 from `js-sha3`. Unit tests use the 4 signatures printed in NAV's own sample requests, plus vectors from Python `hashlib`.
- A new `requestId` (`KJ` + 26 base36) and a new UTC timestamp for **every attempt**.
- The process uses one serial queue with ≥ 1000 ms between calls (NAV allows 1 call/s per IP). The timeout is 60 s. Up to 3 retries at 2, 4 and 8 s on network errors, timeouts, 5xx, `OPERATION_FAILED` and maintenance. `REQUEST_ID_NOT_UNIQUE` is retried at once. Auth, permission, schema and clock errors are **never** retried.
- Every error is a `NavError { code, kind, retryable, httpStatus?, messageHu }`. `messageHu` is the plain Hungarian panel text from SPEC §8.4. Unknown codes keep the raw `code`. `NavError.message` and `toJSON()` never contain NAV's free text, credentials or request values.
- Money is integer forint, rounded half away from zero **on the decimal string** (`"196404.79"` → 196405).
- Every XML this package writes (requests, mock responses, mock invoice documents) validates against NAV's official XSDs. On 2026-11-18, 245 out of 245 documents passed (see "XSD check").

## Commands

```bash
npm ci                # .npmrc sets legacy-peer-deps (npm 10.9 bug with vitest 5 peers)
npm test              # sync-shared + vitest (105 tests)
npm run typecheck
npm run build         # → dist/ (ESM + .d.ts) + dist/_shared (brand.json, demo fixtures)
npm run mock          # local mock server, default http://127.0.0.1:8099/invoiceService/v3
node dist/mock/cli.js --port 8099 --today 2026-11-17 --page-size 100
```

`npm test` and `npm run build` first copy `kod/shared` into `src/_shared` (generated; do not edit). The build then copies the JSON files to `dist/_shared`.

## Backend usage

```ts
import { createNavClientFromEnv, NavError, demoCredentialsFor } from '@kezjegy/nav-kliens';

// creds = decrypted nav_credentials.secret_enc (NAV_CRED_KEY) + tax_number
const nav = createNavClientFromEnv({ login, password, signatureKey, exchangeKey, taxNumber });

// POST /acc/clients/:id/nav-credentials/test
const { ok, messageHu, code } = await nav.checkConnection();   // never throws NavError
// ok → status 'rendben'; !ok → 'hibas', last_test_error = code

// worker, daily 05:30 (serial over clients)
const runStartedAt = new Date().toISOString();
for await (const { digest, data } of nav.syncOutbound({ since: cursorOrNull, asOf: todayBudapest })) {
  if (await alreadyStored(digest)) continue;          // unique key: invoiceNumber + modificationIndex + operation
  const { invoice, rawXml } = await data();             // one rate-limited call
  // store invoice (nav_invoices.data = invoice), rawXml as an encrypted file (kind 'nav_xml'),
  // revenue item: amount = invoice.grossAmountHuf (negative for STORNO / negative MODIFY)
}
// new cursor: runStartedAt (later runs re-read from cursor − 1 day, so nothing is lost)
```

- `createNavClientFromEnv` throws `NavError('NOT_CONFIGURED')` when `NAV_MODE=test|prod` lacks `NAV_SOFTWARE_ID` / `NAV_DEV_NAME` / `NAV_DEV_CONTACT`, or when prod still uses the demo software id. It never falls back to demo in production. `navConfigFromEnv()` returns `{ environment, configured, problems[], label }` for `/health` and `/admin/system`.
- If you call `queryInvoiceData` directly, the data XML cannot tell STORNO from MODIFY, and `operation` comes out as `MODIFY` whenever `invoiceReference` is present. `syncOutbound().data()` merges the digest, so `operation`, `insDate`, `transactionId` and `source` are exact there.
- In `demo` the client also stamps `source = 'DEMO'` on every digest and invoice. The UI shows the "MINTA" label from that.
- Seed: `demoCredentialsFor('68801234')` returns the fictional technical user that the mock checks strictly (password hash and signature are recomputed). Use it for Kata, Réka and Péter.

### Integration notes (Docker / file: dependency)

`"@kezjegy/nav-kliens": "file:../nav-kliens"` is a symlink, so its own `node_modules` (fast-xml-parser, js-sha3) must exist. In the Docker build stage run `cd nav-kliens && npm ci && npm run build` before installing the backend, or install the backend with `npm install --install-links`. Runtime needs `dist/` including `dist/_shared/`.

## Environment

| Var | Meaning |
|---|---|
| `NAV_MODE` | `demo` (default; in-process mock, nothing leaves the machine) · `test` (api-test.onlineszamla.nav.gov.hu) · `prod` |
| `NAV_SOFTWARE_ID` | `[0-9A-Z-]{18}`. Demo default `HU00000000KEZJEGY1` [OWNER: "HU" + Somosi Kft. törzsszám + 8 chars] |
| `NAV_SOFTWARE_VERSION` | default `1.0` |
| `NAV_DEV_NAME`, `NAV_DEV_CONTACT`, `NAV_DEV_TAX_NUMBER` | software developer data sent in every request. Defaults come from `brand.json` → `provider` when they are not placeholders |
| `NAV_BASE_URL` | only in `test`, or in `demo` with a local http URL: point at the mock server. Ignored in `prod` |
| `NAV_SYNC_HOUR` | returned in the config (default 5) for the worker |

The software name is `brand.json` → `name` (SPEC §3.4).

## The DEMO mock

`createDemoTransport()` (in-process) and `startMockServer({ port })` (HTTP, binds 127.0.0.1) run the same handler:

- It validates the request like NAV: root element and namespaces, XSD element order, requestId pattern and uniqueness per tax number, timestamp within ±1 day, requestVersion 3.0, headerVersion 1.0, cryptoType SHA-512 / SHA3-512, 128-hex hashes, 35-day window, from ≤ to, and no supplier filter on OUTBOUND. Each failure gets NAV's error code and HTTP status. Broken XML gets a `GeneralExceptionResponse` (common namespace).
- **Data:** the three demo clients' invoices come from `kod/shared/demo/fixtures.json` (insDate = issueDate + `T10:00:00Z`). Only invoices with issueDate ≤ the mock's today exist. Note: `KSZ-2026-032` is dated 2026-11-18, so on 2026-11-17 Kata has 32 invoices, not 33.
- **Any other valid tax number** gets deterministic invoices seeded by the tax number: 2–4 per month, 80 000–450 000 Ft, fictional customers (15 % private persons), AAM exemption, and one STORNO per year with an `invoiceReference`. Every taxpayer also gets one INBOUND purchase invoice per month with 27 % VAT from fictional suppliers.
- **Credentials:** the fixture users (`demoCredentialsFor`) are checked strictly. Any other well-formed login is accepted, except these trigger logins for the panel's error states: `hibas…` → INVALID_SECURITY_USER, `rosszkulcs…` → INVALID_REQUEST_SIGNATURE, `nincsjog…` → FORBIDDEN, `nemvalid…` → NOT_REGISTERED_CUSTOMER, `karbantart…` → bare HTTP 503 (maintenance).
- Deliberate deviation: `source` is `DEMO`, which is outside NAV's SourceType enum. `queryInvoiceData` compression alternates per invoice (`compression: 'mixed'`), so both decode paths run.

## XSD check (developer tool)

```bash
python tools/xsd_check.py <dir with invoiceApi.xsd, invoiceData.xsd, invoiceBase.xsd, common.xsd> file1.xml …
```
Get the XSDs from github.com/nav-gov-hu/Online-Invoice (`src/schemas/nav/gov/hu/OSA`) and github.com/nav-gov-hu/Common (branch `release/common-1.0.x`, `…/NTCA/1.0/common/common.xsd`; the RC3 tag lacks `ResponsePageType`). Needs `lxml`.

## Limits / known gaps

- The limiter works per process. If the API process (connection test) and the worker (sync) call NAV in the same second, NAV only delays the second call by 4 s; it does not return an error. Sending connection tests through the worker would remove this.
- No real NAV call has been made: there is no technical user or test registration yet ([OWNER/KÖNYVELŐ], SPEC §23 #6). The contract is checked against the official XSDs, the spec PDF (2026-02-12) and NAV's sample signatures.
- Simplified invoices: VAT is computed from `vatContent` × gross per rate, rounded per rate.
- `additionalQueryParams` / `relationalQueryParams` are not used. The sync always reads everything in the window.
