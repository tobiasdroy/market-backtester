# Market Backtester — Implementation Plan

## Context

The user wants a personal tool to backtest investment strategies against **real** historical UK-relevant market data: a portfolio of Cash (GBP), globally diversified bonds, and globally diversified stocks. Strategies need to express things like "start with £20,000 in stocks, contribute £5,000/year inflation-adjusted for 30 years, rebalance to 30% bonds after 20 years, then stop contributing and withdraw £50,000/year inflation-adjusted from year 30" and see what actually would have happened, year by year, using real market history.

Decisions already confirmed with the user:
- **React + TypeScript web app**, not Streamlit/Python — the user wants it to look professional and be publishable under their own branding.
- **All computation runs client-side in the browser.** No backend compute server, so hosting stays free/cheap even if published.
- **Data**: fine to download/process once locally for now, but the architecture must also work if published — so data is prepared **offline** into static JSON files that ship as static assets (works on GitHub Pages/Vercel/Netlify/Cloudflare Pages, no database or API server).
- **Historical depth**: blend long-run US/UK proxy data for older eras with true global index data for modern eras, rather than restricting to the ~1990s-present window where clean "global" index data is freely available. Every splice point must be documented and visible in the app.

Greenfield project — the working directory is currently empty, not yet a git repo.

---

## 1. Tech stack

- **Vite + React + TypeScript**, strict tsconfig. Single-app repo (no monorepo needed).
- **Charting**: Recharts for standard charts (stacked area, line, drawdown); consult the `dataviz` skill before building any chart, and before designing the custom rule-timeline component and any percentile/fan chart.
- **State**: Zustand (`strategyStore`, `resultsStore`) — serializes cleanly for URL-based strategy sharing.
- **Forms/validation**: React Hook Form + Zod. Zod schemas double as the validator for strategies decoded from a shared URL.
- **Compute isolation**: simulation engine runs in a **Web Worker** (via `comlink`) so rolling backtests (many simulated runs) never block the UI.
- **Styling**: Tailwind CSS (+ shadcn/ui primitives) — supports the "professional, custom-branded" requirement, no Streamlit-style default look.
- **Testing**: Vitest + React Testing Library.
- **Deployment** (when the user chooses to publish): static hosting (Cloudflare Pages, Vercel, or GitHub Pages) via a GitHub Actions build+deploy workflow. No server anywhere.

Repo layout:
```
package.json, vite.config.ts, tsconfig.json, index.html
src/
  app/            app shell, layout, branding/theme
  engine/         framework-agnostic simulation core (see §3)
  components/
    strategy-builder/
    results/
  store/          Zustand slices
  hooks/  lib/
public/
  data/           stocks.json, bonds.json, cash.json, inflation.json, metadata.json
data-pipeline/    offline Python data pipeline (see §2)
.github/workflows/
```

---

## 2. Offline data pipeline (`data-pipeline/`, Python)

Python is the right tool for this one-off data wrangling (pandas, yfinance, spreadsheet parsing); its only contract with the app is the static JSON files it writes into `public/data/`.

**Sources and splice plan per series** (each splice point recorded in `metadata.json` with source/URL/date):

- **Global stocks** (GBP, unhedged — spot FX converted each month, documented assumption):
  - 1871–~1969: Shiller's monthly S&P 500 + CPI dataset (Yale, free) as the long-run developed-market proxy.
  - ~1969–2008: MSCI World Total Return Index (USD), free via MSCI's data portal (may need a semi-manual cached download if the portal resists scripting). Fallback if unreliable: drop to a simpler 2-way splice (Shiller pre-2008 → ETF post-2008).
  - 2008–present: total-return (dividends reinvested) of a global equity ETF (e.g. ACWI/VT) via yfinance/stooq.
  - FX: FRED `DEXUSUK` (GBP/USD, from 1971) for modern period; documented historical peg for the pre-1971 Bretton Woods era.

- **Global bonds** (GBP-hedged — deliberate simplification, documented):
  - Pre-2009: derived from UK gilt/consol yield history (Bank of England "A Millennium of Macroeconomic Data" spreadsheet, free, centuries of data) and/or FRED `GS10`, using the standard yield→total-return approximation.
  - 2009–present: `IGLO.L` (iShares Global Government Bond UCITS ETF, GBP-hedged) via yfinance — already GBP-denominated.

- **UK inflation** (3-way splice): BoE Millennium dataset (pre-1947, annual) → ONS RPI (1947–1988) → ONS CPI (1988–present), via ONS's free bulk CSV/API.

- **Cash (GBP)**: Bank of England Official Bank Rate (`IUMABEDR`), free back to 1694.

**Unified schema**, monthly resolution, written to `public/data/*.json`:
```ts
interface MonthlyReturnPoint {
  date: string;              // "YYYY-MM-01"
  totalReturnIndex: number;  // nominal GBP total-return index, rebased to 100 at series start
  monthlyReturn: number;
  source: string;            // e.g. "SHILLER_SP500", "MSCI_WORLD_TR", "ETF_ACWI"
  isInterpolated: boolean;   // true if derived from a lower-resolution (annual) source
  isSpliceStart?: boolean;
}
// inflation.json: { date, cpiIndex, source, isInterpolated, isSpliceStart? }
// metadata.json: generatedAt, pipelineVersion, per-series splice list (from/to/source/url/note),
//   earliestAvailable, currencyAssumption (unhedged/hedged)
```
Real return is *not* pre-stored — always derived engine-side as `(1+nominal)/(1+inflation)-1` to avoid a second source of truth.

**Annual→monthly interpolation**: convert an annual return to a flat compounded monthly rate `(1+r)^(1/12)-1` (not a single lump month) to avoid fabricating artificial volatility spikes; mark those months `isInterpolated: true`.

**Validation** (`data-pipeline/validate.py`): monotonic dates, no gaps, and sanity checks against known published long-run benchmarks (e.g. long-run real S&P 500 CAGR ≈ 6–7%/yr) to catch splice/rebasing bugs.

Layout:
```
data-pipeline/
  fetch/    fetch_shiller.py  fetch_msci.py  fetch_yfinance_etfs.py
            fetch_fred.py  fetch_ons.py  fetch_boe_millennium.py
  process/  splice_stocks.py  splice_bonds.py  splice_inflation.py
            build_cash.py  fx_convert.py
  build.py       orchestrates fetch → process → validate → write to ../public/data/
  validate.py
  requirements.txt
  raw/            gitignored cache of downloaded raw files
```
`python build.py` is a rerunnable command the user can use to refresh data later.

---

## 3. Simulation / backtest engine (`src/engine/`)

Framework-agnostic TypeScript, fully unit-testable independent of React.

**Key design decision**: strategy rules are scheduled by **offset from simulation start** (months-since-start), not absolute calendar dates — this is what lets the same strategy be replayed starting from any historical year (rolling backtest).

```ts
type AssetClass = 'stocks' | 'bonds' | 'cash';
interface AllocationTarget { stocks: number; bonds: number; cash: number; } // sums to 1
interface InitialPortfolio { startValue: number; allocation: AllocationTarget; }
type TimeOffset = { months: number };

interface CashFlowRule {
  id: string; type: 'contribution' | 'withdrawal';
  startOffset: TimeOffset; endOffset?: TimeOffset;
  amount: number;               // in start-of-simulation GBP terms
  frequency: 'monthly' | 'yearly';
  inflationAdjusted: boolean;
}
interface RebalanceRule {
  id: string; type: 'rebalance';
  startOffset: TimeOffset;
  targetAllocation: AllocationTarget;
}
type StrategyRule = CashFlowRule | RebalanceRule;

interface Strategy {
  id: string; name: string;
  initialPortfolio: InitialPortfolio;
  rules: StrategyRule[];
  durationMonths: number;
  contributionAllocation?: 'proRata' | 'lastTarget'; // default 'proRata'
}
```

**Stepping loop** (`simulate.ts`), monthly, for `durationMonths` from a given start date:
1. Apply that month's real market return per asset class to current balances.
2. Apply any rules due this month: cash flows distributed pro-rata across current (drifted) balances by default; a `RebalanceRule` discretely resets allocation to target.
3. Inflation-adjust cash-flow amounts using CPI ratio from simulation start to current month.
4. Record a monthly snapshot: `{ date, totalValue, byAsset, cumulativeContributed, cumulativeWithdrawn, cpiIndex }`.

**API surface**:
- `simulateSingleRun(strategy, marketData, startDate)` — one deterministic run for a chosen historical start date.
- `simulateRolling(strategy, marketData, { stepMonths })` — runs the strategy from every valid historical start date (bounded so `startDate + durationMonths` stays in range), producing percentile bands, ending-value distribution, and a success rate (portfolio never depletes — relevant once withdrawals are involved).
- `stats.ts`: CAGR (nominal/real), max drawdown, ending value (nominal/real), total contributed/withdrawn, volatility, success rate.
- `worker.ts`: exposes both entry points over a Web Worker via comlink, with a progress callback for rolling scans.

**First-class test case**: implement the exact example scenario from the request as a reusable fixture — £20,000 100% stocks at yr0; £5,000/yr inflation-adjusted contributions yr0–30; rebalance to 30% bonds/70% stocks at yr20; contributions stop and £50,000/yr inflation-adjusted withdrawals begin at yr30. Test against:
- A synthetic fixture with simple constant returns (e.g. flat 5%/3%/1% stocks/bonds/cash, 2% inflation) so exact balances can be hand-computed and asserted.
- Real historical data from a known start year, asserting plausible output shape/ranges.

```
src/engine/
  types.ts  schema.ts (Zod)  dataLoader.ts  simulate.ts  rollingBacktest.ts  stats.ts  worker.ts
  fixtures/  scenario-20-70-50k.ts  syntheticMarketData.ts
  __tests__/
```

---

## 4. UI

**Strategy builder**: initial-portfolio card (value + allocation sliders summing to 100%); an ordered rule list with a custom timeline visualization (marker per rule at its year offset — run past `dataviz` skill, it's bespoke); click-to-edit forms per rule type (React Hook Form + Zod); simulation horizon control; start-date mode — single date picker, rolling-across-history, or curated presets (1970s stagflation, 2008 crash, dot-com bust); Run button dispatches to the Web Worker with a progress indicator for rolling mode.

**Results view**: stacked-area chart of portfolio value by asset class (single-run), or a percentile fan chart / ending-value distribution + success rate (rolling mode) — both via `dataviz` skill guidance; summary stats panel (CAGR nominal/real, max drawdown, ending value nominal/real, total contributed/withdrawn, success rate); collapsible drawdown chart; splice annotations from `metadata.json` overlaid on the timeline so users can see exactly where the underlying data source changes.

**State**: `strategyStore` + `resultsStore` (Zustand), plus a `useUrlSync` hook that (de)serializes `Strategy` to/from the URL (compressed JSON in a query param, Zod-validated on decode) for shareable links.

```
src/components/strategy-builder/  InitialPortfolioForm.tsx  RuleTimeline.tsx  RuleCard.tsx
                                   ContributionForm.tsx  WithdrawalForm.tsx  RebalanceForm.tsx
                                   SimulationControls.tsx
src/components/results/           PortfolioValueChart.tsx  AssetBreakdownChart.tsx
                                   DrawdownChart.tsx  RollingOutcomesChart.tsx
                                   SummaryStatsPanel.tsx  SpliceAnnotations.tsx
src/store/  strategyStore.ts  resultsStore.ts
src/hooks/  useUrlSync.ts  useMarketData.ts
```

---

## 5. Suggested additional features

- **Monte Carlo simulation** alongside historical backtesting — bootstrap-resample historical monthly returns (or fit a parametric distribution) and reuse the same stepping loop via a `simulateMonteCarlo` mode.
- **Fees/tax modeling** — annual expense-ratio %, and a UK-relevant ISA-wrapper toggle vs. taxable-account capital-gains/dividend approximation on withdrawals.
- **Side-by-side strategy comparison** — multiple named results, comparison table + overlay chart.
- **CSV/PNG export** of results.
- **Scenario presets** jumping to curated historical start dates (already in §4).
- **Sensitivity analysis** — vary one parameter (e.g. contribution amount ±20%) and plot outcome vs. parameter, pure orchestration over the existing engine.
- **Shareable strategy via URL** (already in §4).
- **Glide-path allocation** — gradually shift allocation over a date range rather than only discrete rebalance events (moderate engine extension: interpolated target allocation each month).

---

## 6. Build order

| Phase | Scope |
|---|---|
| 0 — Setup | `git init`, Vite+React+TS scaffold, ESLint/Prettier/Vitest, Tailwind, empty `data-pipeline/` |
| 1 — Data pipeline | fetch → splice/process → validate → commit generated JSON into `public/data/`, documented refresh process |
| 2 — Simulation engine + tests | types/schema → `simulateSingleRun` (TDD against synthetic fixtures) → canonical 20/70/50k scenario test → `rollingBacktest` + `stats.ts` → Web Worker wrapper. Engine correct and tested before any UI consumes it. |
| 3 — UI strategy builder | app shell/branding, Zustand store, builder forms, rule timeline, wire Run to worker |
| 4 — Charts/results/stats | consult `dataviz` skill; build all result charts + splice annotations |
| 5 — Polish/deploy | URL-state sharing, responsive pass, CI build+deploy workflow, then highest-value stretch features (Monte Carlo + CSV export first) |

The data pipeline and the engine are the highest-risk/highest-value items (flaky external sources; correctness underpins everything else) — front-load their validation and test coverage before UI polish.

## Critical files
- `data-pipeline/build.py` — orchestrates the whole offline pipeline; most important file for getting real, documented historical data into shape.
- `src/engine/simulate.ts` — core month-by-month stepping logic; correctness underpins every other feature.
- `src/engine/types.ts` — the `Strategy`/rule data model shared by builder UI and engine.
- `src/engine/rollingBacktest.ts` — rolling-across-history + success-rate/percentile aggregation.
- `public/data/metadata.json` (+ its generator) — encodes splice points/source documentation the product requires to be visible to users.

## Verification
- Engine: `npm run test` (Vitest) — synthetic-fixture exact-value assertions for the canonical 20/70/50k scenario, plus real-data integration sanity checks.
- Data pipeline: `python data-pipeline/validate.py` after each `build.py` run — checks continuity and known-benchmark plausibility.
- End-to-end: `npm run dev`, manually build the 20/70/50k example scenario in the UI, confirm the year-by-year output/chart matches the engine's own test fixture, and spot-check a couple of real historical start years against publicly known market outcomes (e.g. a strategy starting in 2008 should show a visible mid-simulation drawdown).
