import { downloadFile, toCsv } from '@/lib/csvExport'
import type { PercentileBand } from '@/engine/percentiles'
import type { RollingBacktestResult } from '@/engine/rollingBacktest'
import type { PortfolioSnapshot } from '@/engine/types'

interface ExportCsvButtonProps {
  snapshots?: PortfolioSnapshot[]
  rollingResult?: RollingBacktestResult
  /** Monte Carlo has no per-scenario array to export granularly (only
   * aggregated bands), so it exports those instead - one row per year
   * with each percentile's value. */
  bands?: PercentileBand[]
}

function exportSnapshots(snapshots: PortfolioSnapshot[]) {
  const rows = snapshots.map((s) => ({
    date: s.date,
    stocks: s.byAsset.stocks.toFixed(2),
    bonds: s.byAsset.bonds.toFixed(2),
    cash: s.byAsset.cash.toFixed(2),
    total: s.totalValue.toFixed(2),
    cumulativeContributed: s.cumulativeContributed.toFixed(2),
    cumulativeWithdrawn: s.cumulativeWithdrawn.toFixed(2),
    cumulativeFeesPaid: s.cumulativeFeesPaid.toFixed(2),
    cumulativeTaxPaid: s.cumulativeTaxPaid.toFixed(2),
    depleted: s.depleted,
  }))
  downloadFile(toCsv(rows), 'backtest-results.csv')
}

function exportRollingRuns(result: RollingBacktestResult) {
  const rows = result.runs.map((r) => ({
    startDate: r.startDate,
    endingValueNominal: r.endingValueNominal.toFixed(2),
    endingValueReal: r.endingValueReal.toFixed(2),
    succeeded: r.succeeded,
  }))
  downloadFile(toCsv(rows), 'backtest-rolling-runs.csv')
}

function exportBands(bands: PercentileBand[]) {
  const rows = bands
    .filter((b) => b.monthOffset % 12 === 0)
    .map((b) => ({
      year: b.monthOffset / 12,
      ...Object.fromEntries(
        Object.entries(b.values).map(([p, v]) => [`p${p}`, v.toFixed(2)]),
      ),
    }))
  downloadFile(toCsv(rows), 'backtest-percentile-bands.csv')
}

/** Downloads the current results as CSV: monthly snapshots for a single
 * run, one row per historical start date for a rolling backtest, or
 * yearly percentile bands for Monte Carlo. */
export function ExportCsvButton({ snapshots, rollingResult, bands }: ExportCsvButtonProps) {
  function handleClick() {
    if (snapshots) exportSnapshots(snapshots)
    else if (rollingResult) exportRollingRuns(rollingResult)
    else if (bands) exportBands(bands)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-page"
    >
      Export CSV
    </button>
  )
}
