# Market Backtester

A web app for backtesting investment strategies against real historical
stock, bond, cash and UK inflation data. Define a strategy as a timeline of
contributions, withdrawals and rebalances, then see how it would actually
have performed starting from any point in market history.

All computation runs client-side in the browser — there is no backend
server. Historical data is prepared offline (see `data-pipeline/`) into
static JSON files served alongside the app.

See `PLAN.md` for the full design/build plan.

## Project structure

```
src/
  app/            app shell, layout, branding/theme
  engine/         framework-agnostic simulation core
  components/     strategy-builder/ and results/ UI
  store/          Zustand state
  hooks/  lib/
public/data/      generated historical market data (stocks/bonds/cash/inflation)
data-pipeline/    offline Python pipeline that produces public/data/*.json
```

## Development

```bash
npm install
npm run dev        # start dev server
npm run test        # run engine/unit tests (Vitest)
npm run lint         # oxlint
npm run format        # prettier
npm run build          # production build (dist/)
```

## Data pipeline

See `data-pipeline/README.md`. Re-run `python build.py` inside
`data-pipeline/` to refresh the historical data bundled into `public/data/`.

## Status

Project scaffolding complete (Vite + React + TypeScript + Tailwind +
Zustand + Recharts + Vitest). Data pipeline, simulation engine and UI are
in progress — see `PLAN.md`.
