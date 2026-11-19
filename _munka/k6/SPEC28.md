## 28. Öt új funkció 11-19 (owner order of 2026-11-19 12:25, "Ez mind az 5 kell") – contract

Written 2026-11-19 by the SPEC author for parallel builders. It becomes §28 of `kod/SPEC.md` when the build starts (this file is not merged yet; another job edits SPEC.md). **§28 wins over every older section where they differ.** It explicitly changes: §26.11 / §27.8 "push never contains amounts" (one exception, §28.2.5), §27.3 assist kinds (5 new change kinds, §28.5.5), §27.4 journey (one optional row, §28.3.4), the fixed 8–20 h push window of `notify.ts` (now a per-user setting, §28.2.3). Everything else stays.

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
- Migrations up to `0013_tulaj1119_tiltas.sql` exist. §28 uses the **next two free numbers** at build time (today `0014`, `0015`).
- **§27.11 T1 is still open** (approved quarters are not fixed priors in the engine; `backend/test/seed.test.ts` holds it as `it.fails`). The reserve rule of §28.1 is exact only once T1 lands. B4 does T1 first (§28.0.5).
- The engine has **no allowance logic**: `profile.allowances` only raises the `kedvezmeny_nem_modellezett` warning (`year.ts`), and `szjaCum = 15 % × taxableYTD`. There is no marginal or "félretenni" API, no monthly SZJA and no tax projection ([K] §8).
- The NAV sync (`services/navsync.ts`) runs daily at `NAV_SYNC_HOUR`:30 (default 05:30). It stores invoices and revenue items, then runs `recalcYear` and the flags. It notifies nobody.
- Push quiet hours: a fixed 8–20 h window, only for the `assist_*` and `kamara_reminder` kinds (`notify.ts QUIET_PUSH_KINDS`). There is no user setting.
- Change requests today: `keresek/uj` free-text types `adatvaltozas` / `tevekenysegvaltozas` (reached from Üzenetek and Adataim). There is no guide and no assisted path.

#### 28.0.4 Shared contract (`kod/shared`) – written by the orchestrator (B0) before the builders start
Builders never edit `kod/shared` (§27 rule). B0 adds one block "SPEC §28" at the end of each file, exactly as named in this section and in §28.1–§28.9, runs `npx tsc -p kod/shared/tsconfig.json --noEmit`, and moves the old files to `kod/_regi/shared_src_elotte_ot1119/`. Each builder then runs `node ../shared/scripts/sync-shared.mjs src/_shared`.
- **`enums.ts`**:
  - Additions: `NOTIFICATION_KINDS` + `invoice_new`, `allowance_submitted`, `allowance_decided`, `allowance_check`, `assist_change_done` (§28.8); `CLIENT_FEATURES` + `felretesz`, `kereset`, `kedvezmenyek`, `valtozas` (+ rules, §28.6.3); `CALLBACK_TOPICS` + `valtozas`, `valtozas_helyettem`; `CALLBACK_SOURCES` + `valtozas_utmutato`, `helyettunk_valtozas`, `kedvezmenyek`, `felretesz`, `kereset`; `ASSIST_KINDS` + the 5 `CHANGE_KINDS` (§28.5.5); `ASSIST_ACTIONS` + `adatok_rendben`, `valtozas_kesz`; `ASSIST_CHECK_ITEMS` + phases `valtozas_adatok`, `valtozas_bejelentes`; `GUIDE_KINDS` + the 5 change kinds (+ `GUIDE_STEP_KEYS`, `GUIDE_VIDEO` = null); `JOURNEY_STEP_KEYS` + `kedvezmenyek`.
  - New constants: `RESERVE_ZONES`, `RESERVE_ESTIMATE_REASONS`, `EARNINGS_BASES`, `ALLOWANCE_KINDS`, `ALLOWANCE_STATUSES`, `ALLOWANCE_GATES`, `ANYAK_JOGCIMEK`, `ALLOWANCE_REJECT_REASONS`, `CHANGE_KINDS`, `CHANGE_TAX_ITEMS`, `CHANGE_UGYSEGED_KINDS`, `CHANGE_UGYSEGED_VALID_UNTIL_DEFAULT = '2026-12-31'`, `QUIET_HOURS_DEFAULT = { enabled: true, from: 20, to: 8 }`, `INVOICE_NOTIFY_RULES` (§28.2), `JOURNEY_NOT_COUNTED = ['kedvezmenyek']`.
- **`bekotes.ts`**: text blocks `RESERVE_TEXTS`, `RESERVE_ZONE_STAFF_LABELS`, `NOTIFY_INVOICE_TEXTS`, `ALLOWANCE_TEXTS`, `ALLOWANCE_LABELS`, `ALLOWANCE_CLIENT_LINES`, `ALLOWANCE_QUESTION_TEXTS`, `ALLOWANCE_REJECT_REASON_LABELS`, `EARNINGS_TEXTS`, `CHANGE_TEXTS`, `CHANGE_FACTS`, `CHANGE_STEP_LIST`, `CHANGE_STATUS_CLIENT_TEXT`, `CHANGE_CONSENT_TEXTS`, `CHANGE_HANDBOOK` (panel), `ASSIST_KIND_LABELS` + `ASSIST_CHECK_LABELS` for the new kinds and items, and `GUIDE_TEMPLATES` for the 5 change kinds (§28.5.3). New explainers: `felretesz_miert`, `kereset_miert`, `kedvezmenyek`, `csaladi_jarulekkedvezmeny`, `valtozas_hub`, `ugyseged_valtozas`, `onya_t101e`. Every text is the final copy of this section; the content keys are listed in §28.9.
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
2. **Order** = arrival order of the revenue items of that tax year: `revenue_items.created_at`, then `id`. The tax year is the year of `received_on` (pénzforgalmi). An invoice issued in December and paid in January belongs to next year.
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
| K12 | `igazolas` + accountant avatar 40 pt | "Ezek járhatnak neked" | one row per proposed item: label + `line` + "kb. {x} Ft-tal kevesebb adó idén" (preview estimate, rounded to 1 000; "Év végén számoljuk el" when only the annual return applies); "Megjegyzés {firstName} számára (nem kötelező)" text field ≤ 500; primary **"Elküldöm"**; sub "{firstName} általában 2 munkanapon belül átnézi." Then the list "Ezeket tartsd meg, {firstName} elkérheti:" (only relevant: "a családi pótlékról szóló határozat", "a házassági anyakönyvi kivonat", "az orvosi igazolás", "a felváltva gondozásról szóló bírósági döntés vagy megállapodás"). | – |
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

#### 28.5.3 Guide templates (`GUIDE_TEMPLATES` for the 5 kinds, B0 writes them in `bekotes.ts`; the backend `GET /client/guides/:kind` personalises them)
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
- **`aszf.md`** – the §27.10 "Intézzük helyetted" section is extended to changes (székhely, telephely, tevékenység, szüneteltetés in the Vállalkozói Ügysegéd as registered meghatalmazott; tax data in ONYA). Part of the service, no separate fee [OWNER]. The Ügysegéd part runs until the register moves (2026-12-31) [OWNER/JOGI]. The "Félretenni" and "Mennyit kerestem?" numbers are estimates, not tax advice or a payment order; the binding amount is the approved quarterly amount.
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
| 38 | Change assists: part of the subscription (no fee); four eyes on `change-done` (`CHANGE_DONE_BY_FILER_ALLOWED=false`) | OWNER | as written |
| 39 | Subscription during the client's szüneteltetés | OWNER | unchanged (charged) |
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
