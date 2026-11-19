# @kezjegy/ado-motor

Pure TypeScript tax engine for **2026 átalányadós, alanyi ÁFA-mentes egyéni vállalkozók**
(SPEC §7). No I/O, no runtime dependencies, deterministic, integer forints only.

**Every result is an estimate that the accountant approves.** Each `YearResult` and
`QuarterResult` carries `estimate: true` and
`disclaimer: "Becslés. A végleges összeget a könyvelőd hagyja jóvá."`. The engine never files
anything to NAV.

## Run

```bash
npm install          # uses .npmrc legacy-peer-deps (npm 10.9 crashes on vitest 5's optional peers)
npm test             # vitest: 122 tests (NAV worked examples, demo clients, edge cases, properties, contract)
npm run typecheck    # tsc over src + test, incl. the SPEC §7.5 contract check
npm run build        # → dist/ (ESM + .d.ts), imported by the backend as "file:../ado-motor"
npm run check        # all three
```

Debug dump of the three demo clients: `ADO_DEBUG=1 npx vitest run test/_debug.test.ts --silent=false`.

Node ≥ 22 (vitest 5 officially wants 22.12+/24; it also runs on the local 23.11 with an engine warning).

## API (SPEC §7.5, plus optional additive fields)

```ts
import { calculateYear, deadlinesFor, costRatioForActivity, RULES_2026, ENGINE_VERSION } from '@kezjegy/ado-motor';

const year = calculateYear({
  profile: { year: 2026, costRatio: 45, status: 'fofoglalkozasu', guaranteedMinimum: false,
             hipa: { method: 'savos', ratePct: 2 } },
  revenue: [{ receivedOn: '2026-07-10', deliveryDate: '2026-07-02', amountHuf: 240_000,
              countsForAtalany: true, countsForAfaLimit: true, estimated: true }],
  asOf: '2026-11-17',
});
year.quarters;          // QuarterResult[]: TB, szocho, SZJA-előleg, monthly bases, payments, explanation
year.meters;            // afa (20 M), atalanyCap (38 736 000 / retail 193 680 000), adomentes (1 936 800)
year.hipa;              // sávos HIPA estimate or null
deadlinesFor(2026);     // NAV + HIPA dates with the next-working-day rule
```

- `calculateYear` throws `AdoMotorInputError` (`code: 'validation_failed'`, `fields: { path: message }`,
  Hungarian messages) for bad input – map it to HTTP 400.
- Quarters returned: those that started on or before `asOf` and end on or after the start of
  átalányadózás. A running quarter is computed for the whole quarter with no further revenue
  (`complete: false`, future months `future: true`).
- Revenue: `receivedOn` decides the átalányadó year/month (pénzforgalmi), `deliveryDate` the
  ÁFA limit. Items received after `asOf` are ignored ("várható"). Negative amounts (storno) are allowed.
- `costRatio: 40` (pre-2026 general ratio) is accepted at runtime, computed with 45 % and
  flagged `cost_ratio_2026_changed`.
- Warnings carry `audience: 'ugyfel' | 'konyvelo'`; client screens show only `ugyfel`.

Additive fields beyond SPEC §7.5 (all optional, documented in `src/types.ts` and SPEC §24):
explanation line `kind` (`cim` heading / `sor` row / `ado` highlighted tax row / `megjegyzes`) and
`side` (heading's right-hand text, e.g. "július–szeptember"); meter `detail` and `remainingHuf`
(design 03 second line); month `insuredDays`, `minimumDays`, `minimumApplied`, `future`; quarter
`priorActualBaseSumHuf`, `priorSzjaAdvanceSumHuf`, `szjaCumulativeHuf`, `insuredMonths`,
`coveredByPriorOverride`, `estimate`, `disclaimer`; HIPA `band`, `annualisedRevenueHuf`,
`annualDueDate`; profile `allowances` (not modelled → warning); payment `accountShortName`;
`deadlinesFor(year, { hipaMethod })`.

## Rules

All numbers live in `src/rules/2026.ts` (`RULES_2026`, `rulesVersion: '2026-01-01'`) with source
ids and URLs; `src/rules/2027.ts` is a marked draft (50 %, 22 M ÁFA limit; 2027 minimum wage not
yet known → 2026 values + `rules_draft` warning). Holidays: `src/rules/holidays.ts` (statutory
days computed incl. Easter; NGM bridge days for 2026).

| Item | 2026 |
|---|---|
| Minimálbér / garantált bérminimum | 322 800 / 373 200 Ft |
| Költséghányad | 45 % general, 80 % listed, 90 % retail |
| Adómentes rész | 1 936 800 Ft / year (not prorated) |
| SZJA / TB / szocho | 15 % / 18.5 % / 13 % |
| Járulékalap | quarterly cumulative (göngyölítés); főfoglalkozású min. = minimálbér or garantált (100 %, prorated 1/30 per day); mellékállás no minimum; nyugdíjas none |
| Payment + 2658 return | 12th of the month after the quarter (next working day) |
| Átalány revenue cap | 38 736 000 Ft (retail 193 680 000), prorated by days for a mid-year start |
| Alanyi ÁFA-mentesség | 20 000 000 Ft by delivery date, warning at 80 % |
| HIPA (sávos, Htv. 39/A) | base 2.5 M (≤ 12 M revenue) / 6 M (≤ 18 M) / 8.5 M (≤ 25 M; retail ≤ 120 M) × local rate; one advance by 31 May (= previous year's tax), tax/return by 31 May next year |

### The algorithm (per quarter q, as of `asOf`)

1. Monthly income `I[m] = round(R[m] × (100 − ratio) / 100)`; `incomeYTD`, `taxableYTD = max(0, incomeYTD − 1 936 800)`.
2. Insured months = months with ≥ 1 insured day (before the start or suspended = not insured; kieső days stay insured).
3. `g = max(0, taxableYTD − actual bases of earlier quarters) / insured months`.
4. Monthly base: főfoglalkozású `max(g, minimum)` (minimum prorated to the days the minimum applies to), mellékállás `g`, nyugdíjas none.
5. TB / szocho = Σ round(base × 18.5 % / 13 %); SZJA-előleg = round(taxableYTD × 15 %) − earlier advances (never negative).

Verified against NAV booklet 100's worked example (cumulative bases 677 880 / 1 646 280 /
2 291 880 / 3 217 240) and its SZJA examples (18 855; 371 250; 286 980), and against the three
demo clients of `kod/shared/demo/fixtures.json` (e.g. Kata Q3 = 510 471 Ft).

## Not modelled (accountant decides)

Családi kedvezmény, 25 év alattiak / anyák SZJA-mentessége (`allowances` → warning only),
anyák kedvezménye for nyugdíjas, general-method HIPA (`altalanos` → null + warning), several
HIPA municipalities (one assumed), 2027 final values, KATA / tételes költségelszámolás, the
consequences after exceeding the átalány cap (warning only).

**One jogállás per year.** `TaxProfileInput.status` holds for the whole year. A change during the year (e.g. the
client leaves a 36-hour job in September and becomes főfoglalkozású) is NOT modelled with dated periods: switching
the status recalculates every open quarter as if it had applied since January (wrong earlier bases in the
göngyölítés, a minimum for months before the change). Workaround until dated status periods exist: keep the status
of the LATER part of the year and enter the months before the change as a `kieso` period (no minimum for them), or
give the already filed quarters as `priorOverrides`. The backend writes an internal note for the accountant when the
status of a year that already has an approved quarter is changed.

**Alanyi ÁFA-mentesség in the starting year.** The limit is time-proportional for a business registered during the
year (Áfa tv. 189. §): `afaLimitHuf × days(start … 31 Dec) / days of the year`; a szünetelés does not reduce it.
`meters.afa.limitHuf` carries the prorated value. [KÖNYVELŐ] confirms the day count.

**Projection.** "Ilyen tempóban év végéig …", `projectedHuf` and the HIPA band use the linear projection only after
`projectionMinDays` (60) active days; before that the actual revenue is used.
