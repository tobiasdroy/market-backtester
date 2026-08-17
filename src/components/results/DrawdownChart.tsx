import { useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { DrawdownPoint } from '@/engine/stats'

interface DrawdownChartProps {
  drawdown: DrawdownPoint[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', { year: 'numeric', month: 'short' })
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-surface p-3 shadow-lg">
      <p className="text-sm text-text-secondary">{formatDate(label ?? '')}</p>
      <p className="text-sm font-medium text-text-primary">
        Drawdown: {formatPercent(payload[0].value)}
      </p>
    </div>
  )
}

/** Collapsible chart of the portfolio's decline from its running peak
 * over time. Single series -> sequential (one hue), no legend needed. */
export function DrawdownChart({ drawdown }: DrawdownChartProps) {
  const [expanded, setExpanded] = useState(false)
  const data = drawdown.map((p) => ({ date: p.date, drawdown: p.drawdown }))

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-sm text-text-secondary"
      >
        <span>Drawdown over time</span>
        <span aria-hidden>{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <ResponsiveContainer width="100%" height={200} className="mt-3">
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
              tickFormatter={formatPercent}
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              width={48}
            />
            <ReferenceLine y={0} stroke="var(--baseline)" />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="drawdown"
              stroke="var(--color-stocks)"
              fill="var(--color-stocks)"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
