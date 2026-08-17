import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ComparisonEntry } from '@/engine/comparison'

interface ComparisonChartProps {
  entries: ComparisonEntry[]
  valueMode: 'nominal' | 'real'
  currentAge?: number | null
}

// Fixed-order categorical ramp (see index.css --series-1..8, sourced from
// the dataviz skill's validated 8-slot palette) - one hue per saved
// strategy, assigned by save order and never reassigned as entries are
// added/removed.
const LINE_COLORS = [
  'var(--series-1)',
  'var(--series-2)',
  'var(--series-3)',
  'var(--series-4)',
  'var(--series-5)',
  'var(--series-6)',
  'var(--series-7)',
  'var(--series-8)',
]

function formatGBPCompact(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function yearLabel(year: number, currentAge?: number | null): string {
  return currentAge != null ? `Age ${currentAge + year}` : `Year ${year}`
}

function CustomTooltip({
  active,
  payload,
  label,
  entries,
  currentAge,
}: {
  active?: boolean
  payload?: { dataKey: string; value: number; color: string }[]
  label?: number
  entries: ComparisonEntry[]
  currentAge?: number | null
}) {
  if (!active || !payload?.length) return null
  const nameById = Object.fromEntries(entries.map((e) => [e.id, e.name]))
  return (
    <div className="rounded-md border border-border bg-surface p-3 shadow-lg">
      <p className="mb-1 text-sm text-text-secondary">{yearLabel(label ?? 0, currentAge)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-sm">
          <span className="inline-block h-0.5 w-3" style={{ background: p.color }} aria-hidden />
          <span className="text-text-secondary">{nameById[p.dataKey] ?? p.dataKey}</span>
          <span className="ml-auto font-medium text-text-primary">{formatGBPCompact(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

/** Overlays each saved comparison entry's median (aggregate modes) or
 * actual (single mode) portfolio value as one line per strategy, at
 * yearly resolution. Entries of different durations simply stop drawing
 * once they run out of data. */
export function ComparisonChart({ entries, valueMode, currentAge }: ComparisonChartProps) {
  const [showTable, setShowTable] = useState(false)

  const seriesMaps = entries.map(
    (e) => new Map(e.series.map((p) => [p.monthOffset, valueMode === 'real' ? p.real : p.nominal])),
  )
  const maxOffset = Math.max(0, ...entries.map((e) => e.series[e.series.length - 1]?.monthOffset ?? 0))

  const data: Record<string, number>[] = []
  for (let m = 0; m <= maxOffset; m += 12) {
    const row: Record<string, number> = { year: m / 12 }
    entries.forEach((e, i) => {
      const v = seriesMaps[i].get(m)
      if (v !== undefined) row[e.id] = v
    })
    data.push(row)
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm text-text-secondary">Portfolio value comparison</h3>
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
                <th className="py-1 pr-2 font-normal">{currentAge != null ? 'Age' : 'Year'}</th>
                {entries.map((e) => (
                  <th key={e.id} className="py-1 pr-2 font-normal">
                    {e.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.year} className="border-t border-border">
                  <td className="py-1 pr-2 text-text-primary">
                    {currentAge != null ? currentAge + row.year : row.year}
                  </td>
                  {entries.map((e) => (
                    <td key={e.id} className="py-1 pr-2 text-text-secondary">
                      {row[e.id] !== undefined ? formatGBPCompact(row[e.id]) : '–'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={(y: number) => (currentAge != null ? `${currentAge + y}` : `yr ${y}`)}
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatGBPCompact}
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              width={64}
            />
            <Tooltip content={<CustomTooltip entries={entries} currentAge={currentAge} />} />
            {entries.map((e, i) => (
              <Line
                key={e.id}
                dataKey={e.id}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
        {entries.map((e, i) => (
          <span key={e.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: LINE_COLORS[i % LINE_COLORS.length] }}
              aria-hidden
            />
            {e.name}
          </span>
        ))}
      </div>
    </div>
  )
}
