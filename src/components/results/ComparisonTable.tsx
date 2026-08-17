import type { ComparisonEntry } from '@/engine/comparison'

interface ComparisonTableProps {
  entries: ComparisonEntry[]
  onRemove: (id: string) => void
}

const MODE_LABEL: Record<ComparisonEntry['mode'], string> = {
  single: 'Single run',
  rolling: 'Rolling (historical)',
  monteCarlo: 'Monte Carlo',
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

export function ComparisonTable({ entries, onRemove }: ComparisonTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-text-secondary">
          <tr>
            <th className="py-1 pr-2 font-normal">Strategy</th>
            <th className="py-1 pr-2 font-normal">Mode</th>
            <th className="py-1 pr-2 font-normal">Ending value</th>
            <th className="py-1 pr-2 font-normal">Ending value (today&rsquo;s money)</th>
            <th className="py-1 pr-2 font-normal">Annualized return (real)</th>
            <th className="py-1 pr-2 font-normal">Max drawdown</th>
            <th className="py-1 pr-2 font-normal">Success rate</th>
            <th className="py-1 font-normal" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => (
            <tr key={e.id} className="border-t border-border">
              <td className="py-1.5 pr-2 text-text-primary">
                <span
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ background: `var(--series-${(i % 8) + 1})` }}
                  aria-hidden
                />
                {e.name}
              </td>
              <td className="py-1.5 pr-2 text-text-secondary">{MODE_LABEL[e.mode]}</td>
              <td className="py-1.5 pr-2 text-text-secondary">{formatGBP(e.summary.endingValueNominal)}</td>
              <td className="py-1.5 pr-2 text-text-secondary">{formatGBP(e.summary.endingValueReal)}</td>
              <td className="py-1.5 pr-2 text-text-secondary">
                {e.summary.cagrReal !== undefined ? formatPercent(e.summary.cagrReal) : '–'}
              </td>
              <td className="py-1.5 pr-2 text-text-secondary">
                {e.summary.maxDrawdown !== undefined ? formatPercent(e.summary.maxDrawdown) : '–'}
              </td>
              <td className="py-1.5 pr-2 text-text-secondary">
                {e.summary.successRate !== undefined ? formatPercent(e.summary.successRate) : '–'}
              </td>
              <td className="py-1.5">
                <button
                  type="button"
                  onClick={() => onRemove(e.id)}
                  className="text-xs text-text-secondary underline-offset-2 hover:underline"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
