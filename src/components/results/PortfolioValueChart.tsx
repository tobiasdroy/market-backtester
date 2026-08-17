import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SeriesSplice } from '@/hooks/useMarketMetadata'
import type { AssetClass, PortfolioSnapshot } from '@/engine/types'

interface PortfolioValueChartProps {
  snapshots: PortfolioSnapshot[]
  splices?: SeriesSplice[]
}

const ASSET_ORDER: AssetClass[] = ['stocks', 'bonds', 'cash']
const ASSET_LABEL: Record<AssetClass, string> = { stocks: 'Stocks', bonds: 'Bonds', cash: 'Cash' }
const ASSET_COLOR: Record<AssetClass, string> = {
  stocks: 'var(--series-stocks)',
  bonds: 'var(--series-bonds)',
  cash: 'var(--series-cash)',
}

function formatGBPCompact(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey: AssetClass; value: number; color: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((sum, p) => sum + p.value, 0)
  return (
    <div className="rounded-md border border-border bg-surface p-3 shadow-lg">
      <p className="mb-1 text-sm text-text-secondary">{formatDate(label ?? '')}</p>
      {payload
        .slice()
        .reverse()
        .map((p) => (
          <p key={p.dataKey} className="flex items-center gap-2 text-sm">
            <span className="inline-block h-0.5 w-3" style={{ background: p.color }} aria-hidden />
            <span className="text-text-secondary">{ASSET_LABEL[p.dataKey]}</span>
            <span className="ml-auto font-medium text-text-primary">{formatGBPCompact(p.value)}</span>
          </p>
        ))}
      <p className="mt-1 border-t border-border pt-1 text-sm font-medium text-text-primary">
        Total: {formatGBPCompact(total)}
      </p>
    </div>
  )
}

/** Stacked area chart of portfolio value by asset class over time, with
 * optional reference lines marking where the underlying market data
 * switches source (see SpliceAnnotations / metadata.json). */
export function PortfolioValueChart({ snapshots, splices }: PortfolioValueChartProps) {
  const [showTable, setShowTable] = useState(false)

  const data = snapshots.map((s) => ({
    date: s.date,
    stocks: s.byAsset.stocks,
    bonds: s.byAsset.bonds,
    cash: s.byAsset.cash,
  }))

  const chartStart = snapshots[0]?.date
  const chartEnd = snapshots[snapshots.length - 1]?.date
  const visibleSplices = (splices ?? []).filter((s) => {
    const from = `${s.from}-01`
    return chartStart && chartEnd && from >= chartStart && from <= chartEnd && s.from !== chartStart.slice(0, 7)
  })

  // One row per year (final month), so the table stays readable across
  // multi-decade runs while every value stays reachable per the dataviz
  // skill's "a table view exists" accessibility requirement.
  const yearlyRows = snapshots.filter(
    (s, i) => s.monthOffset % 12 === 0 || i === snapshots.length - 1,
  )

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm text-text-secondary">Portfolio value over time</h3>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs text-text-secondary underline-offset-2 hover:underline"
        >
          {showTable ? 'Show chart' : 'View as table'}
        </button>
      </div>

      {showTable ? (
        <div className="max-h-80 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="sticky top-0 bg-surface text-text-secondary">
              <tr>
                <th className="py-1 pr-2 font-normal">Year</th>
                <th className="py-1 pr-2 font-normal">Stocks</th>
                <th className="py-1 pr-2 font-normal">Bonds</th>
                <th className="py-1 pr-2 font-normal">Cash</th>
                <th className="py-1 font-normal">Total</th>
              </tr>
            </thead>
            <tbody>
              {yearlyRows.map((s) => (
                <tr key={s.date} className="border-t border-border">
                  <td className="py-1 pr-2 text-text-primary">{formatDate(s.date)}</td>
                  <td className="py-1 pr-2 text-text-secondary">{formatGBPCompact(s.byAsset.stocks)}</td>
                  <td className="py-1 pr-2 text-text-secondary">{formatGBPCompact(s.byAsset.bonds)}</td>
                  <td className="py-1 pr-2 text-text-secondary">{formatGBPCompact(s.byAsset.cash)}</td>
                  <td className="py-1 font-medium text-text-primary">{formatGBPCompact(s.totalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            minTickGap={40}
          />
          <YAxis
            tickFormatter={formatGBPCompact}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => (
              <span style={{ color: 'var(--text-secondary)' }}>{ASSET_LABEL[value as AssetClass]}</span>
            )}
          />
          {visibleSplices.map((s) => (
            <ReferenceLine
              key={s.from}
              x={`${s.from}-01`}
              stroke="var(--text-muted)"
              strokeDasharray="4 4"
              label={{
                value: 'data source change',
                position: 'insideTopLeft',
                fill: 'var(--text-muted)',
                fontSize: 10,
              }}
            />
          ))}
          {ASSET_ORDER.map((asset) => (
            <Area
              key={asset}
              type="monotone"
              dataKey={asset}
              stackId="portfolio"
              stroke={ASSET_COLOR[asset]}
              fill={ASSET_COLOR[asset]}
              fillOpacity={0.5}
              strokeWidth={2}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      )}
    </div>
  )
}
