import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PercentileBand } from '@/engine/rollingBacktest'

interface RollingOutcomesChartProps {
  bands: PercentileBand[]
}

// Sequential blue ramp (light -> dark), per the dataviz skill's palette:
// outer band lightest, inner band mid, median line darkest/most legible.
const BAND_OUTER = '#b7d3f6'
const BAND_INNER = '#6da7ec'
const MEDIAN_LINE = '#1c5cab'

function formatGBPCompact(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number | number[] }[]
  label?: number
}) {
  if (!active || !payload?.length) return null
  const byKey = Object.fromEntries(payload.map((p) => [p.dataKey, p.value]))
  return (
    <div className="rounded-md border border-border bg-surface p-3 shadow-lg">
      <p className="mb-1 text-sm text-text-secondary">Year {label}</p>
      <p className="text-sm text-text-primary">
        Median: <span className="font-medium">{formatGBPCompact(byKey.median as number)}</span>
      </p>
      {Array.isArray(byKey.p25_p75) && (
        <p className="text-sm text-text-secondary">
          25th-75th percentile: {formatGBPCompact(byKey.p25_p75[0])} - {formatGBPCompact(byKey.p25_p75[1])}
        </p>
      )}
      {Array.isArray(byKey.p10_p90) && (
        <p className="text-sm text-text-secondary">
          10th-90th percentile: {formatGBPCompact(byKey.p10_p90[0])} - {formatGBPCompact(byKey.p10_p90[1])}
        </p>
      )}
    </div>
  )
}

/** Fan chart of portfolio value percentile bands across every historical
 * start date, by year into the simulation (not calendar date, since many
 * different start dates are overlaid). */
export function RollingOutcomesChart({ bands }: RollingOutcomesChartProps) {
  const data = bands
    .filter((b) => b.monthOffset % 12 === 0)
    .map((b) => ({
      year: b.monthOffset / 12,
      p10_p90: [b.values[10], b.values[90]] as [number, number],
      p25_p75: [b.values[25], b.values[75]] as [number, number],
      median: b.values[50],
    }))

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h3 className="mb-2 text-sm text-text-secondary">
        Outcomes across every historical start date
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="year"
            tickFormatter={(y: number) => `yr ${y}`}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          />
          <YAxis
            tickFormatter={formatGBPCompact}
            stroke="var(--baseline)"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            width={64}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area dataKey="p10_p90" stroke="none" fill={BAND_OUTER} fillOpacity={1} isAnimationActive={false} />
          <Area dataKey="p25_p75" stroke="none" fill={BAND_INNER} fillOpacity={1} isAnimationActive={false} />
          <Line
            dataKey="median"
            stroke={MEDIAN_LINE}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        <LegendSwatch color={MEDIAN_LINE} label="Median" />
        <LegendSwatch color={BAND_INNER} label="25th-75th percentile" />
        <LegendSwatch color={BAND_OUTER} label="10th-90th percentile" />
      </div>
    </div>
  )
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}
