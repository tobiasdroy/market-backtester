import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SensitivityResult } from '@/engine/sensitivity'

interface SensitivityChartProps {
  result: SensitivityResult
  /** How to format/label the swept parameter's values on the x-axis. */
  paramFormat: (value: number) => string
}

const LINE_COLOR = 'var(--series-1)'

function formatGBPCompact(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
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

function CustomTooltip({
  active,
  payload,
  label,
  paramFormat,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: number
  paramFormat: (value: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-surface p-3 shadow-lg">
      <p className="mb-1 text-sm text-text-secondary">{paramFormat(label ?? 0)}</p>
      <p className="text-sm text-text-primary">
        Median ending value: <span className="font-medium">{formatGBPCompact(payload[0].value)}</span>
      </p>
    </div>
  )
}

/** Single-axis line chart of median ending value (today's money, across a
 * rolling backtest) vs the swept parameter - success rate isn't plotted
 * alongside it (two differently-scaled measures on one chart is the #1
 * chart mistake per the dataviz skill), it's only in the table view. */
export function SensitivityChart({ result, paramFormat }: SensitivityChartProps) {
  const [showTable, setShowTable] = useState(false)

  const data = result.points.map((p) => ({
    paramValue: p.paramValue,
    endingValueMedianReal: p.endingValueMedianReal,
  }))

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm text-text-secondary">
          Median ending value (today&rsquo;s money) vs parameter
        </h3>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs text-text-secondary underline-offset-2 hover:underline"
        >
          {showTable ? 'Show chart' : 'View as table'}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead className="text-text-secondary">
              <tr>
                <th className="py-1 pr-2 font-normal">Parameter</th>
                <th className="py-1 pr-2 font-normal">Median ending value</th>
                <th className="py-1 pr-2 font-normal">Median ending value (today&rsquo;s money)</th>
                <th className="py-1 font-normal">Success rate</th>
              </tr>
            </thead>
            <tbody>
              {result.points.map((p) => (
                <tr key={p.paramValue} className="border-t border-border">
                  <td className="py-1 pr-2 text-text-primary">{paramFormat(p.paramValue)}</td>
                  <td className="py-1 pr-2 text-text-secondary">
                    {formatGBP(p.endingValueMedianNominal)}
                  </td>
                  <td className="py-1 pr-2 text-text-secondary">
                    {formatGBP(p.endingValueMedianReal)}
                  </td>
                  <td className="py-1 text-text-secondary">{formatPercent(p.successRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="paramValue"
              tickFormatter={paramFormat}
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
            <YAxis
              tickFormatter={formatGBPCompact}
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              width={64}
            />
            <Tooltip content={<CustomTooltip paramFormat={paramFormat} />} />
            <Line
              dataKey="endingValueMedianReal"
              stroke={LINE_COLOR}
              strokeWidth={2}
              dot={{ r: 4, fill: LINE_COLOR }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
