import { useMemo } from 'react'
import { computeStats } from '@/engine/stats'
import type { SimulationResult } from '@/engine/types'
import type { RollingBacktestResult } from '@/engine/rollingBacktest'

interface SummaryStatsPanelProps {
  singleResult: SimulationResult | null
  rollingResult: RollingBacktestResult | null
}

function formatGBP(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-2xl text-text-primary">{value}</span>
    </div>
  )
}

export function SummaryStatsPanel({ singleResult, rollingResult }: SummaryStatsPanelProps) {
  const stats = useMemo(() => (singleResult ? computeStats(singleResult) : null), [singleResult])

  if (!singleResult && !rollingResult) {
    return (
      <p className="text-text-muted">Run a backtest to see results here.</p>
    )
  }

  if (rollingResult) {
    const p = rollingResult.endingValuePercentiles
    const pReal = rollingResult.endingValuePercentilesReal
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Success rate" value={formatPercent(rollingResult.successRate)} />
          <StatTile label="Runs" value={String(rollingResult.runs.length)} />
          <StatTile label="Median ending value" value={formatGBP(p[50] ?? 0)} />
          <StatTile
            label="Median ending value (today's money)"
            value={formatGBP(pReal[50] ?? 0)}
          />
          <StatTile
            label="10th-90th percentile"
            value={`${formatGBP(p[10] ?? 0)} - ${formatGBP(p[90] ?? 0)}`}
          />
          <StatTile
            label="10th-90th percentile (today's money)"
            value={`${formatGBP(pReal[10] ?? 0)} - ${formatGBP(pReal[90] ?? 0)}`}
          />
        </div>
      </div>
    )
  }

  if (!stats) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Ending value" value={formatGBP(stats.endingValueNominal)} />
      <StatTile label="Ending value (today's money)" value={formatGBP(stats.endingValueReal)} />
      <StatTile label="Annualized return" value={formatPercent(stats.cagrNominal)} />
      <StatTile label="Annualized return (today's money)" value={formatPercent(stats.cagrReal)} />
      <StatTile label="Max drawdown" value={formatPercent(stats.maxDrawdown)} />
      <StatTile label="Volatility" value={formatPercent(stats.volatility)} />
      <StatTile label="Total contributed" value={formatGBP(stats.totalContributed)} />
      <StatTile label="Total withdrawn" value={formatGBP(stats.totalWithdrawn)} />
      {stats.totalFeesPaid > 0 && (
        <StatTile label="Total fees paid" value={formatGBP(stats.totalFeesPaid)} />
      )}
      {stats.totalTaxPaid > 0 && (
        <StatTile label="Total tax paid" value={formatGBP(stats.totalTaxPaid)} />
      )}
    </div>
  )
}
