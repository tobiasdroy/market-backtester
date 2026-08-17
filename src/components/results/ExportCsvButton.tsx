import { downloadFile, toCsv } from '@/lib/csvExport'
import type { RollingBacktestResult } from '@/engine/rollingBacktest'
import type { PortfolioSnapshot } from '@/engine/types'

interface ExportCsvButtonProps {
  snapshots?: PortfolioSnapshot[]
  rollingResult?: RollingBacktestResult
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

/** Downloads the current results as CSV: monthly snapshots for a single
 * run, or one row per historical start date for a rolling backtest. */
export function ExportCsvButton({ snapshots, rollingResult }: ExportCsvButtonProps) {
  function handleClick() {
    if (snapshots) exportSnapshots(snapshots)
    else if (rollingResult) exportRollingRuns(rollingResult)
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
