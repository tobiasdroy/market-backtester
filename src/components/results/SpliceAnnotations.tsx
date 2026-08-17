import { useState } from 'react'
import type { MarketMetadata } from '@/hooks/useMarketMetadata'

interface SpliceAnnotationsProps {
  metadata: MarketMetadata | null
}

const SERIES_LABEL: Record<keyof MarketMetadata['series'], string> = {
  stocks: 'Stocks',
  bonds: 'Bonds',
  cash: 'Cash',
  inflation: 'Inflation (CPI)',
}

/** Collapsible documentation of exactly which real-world data source backs
 * each stretch of the chart above, so a splice in the underlying data is
 * never silently invisible to the reader. */
export function SpliceAnnotations({ metadata }: SpliceAnnotationsProps) {
  const [expanded, setExpanded] = useState(false)
  if (!metadata) return null

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-sm text-text-secondary"
      >
        <span>Where this data comes from</span>
        <span aria-hidden>{expanded ? '−' : '+'}</span>
      </button>
      {expanded && (
        <div className="mt-3 flex flex-col gap-4">
          {(Object.keys(metadata.series) as (keyof MarketMetadata['series'])[]).map((key) => (
            <div key={key}>
              <h4 className="mb-1 text-sm font-medium text-text-primary">{SERIES_LABEL[key]}</h4>
              <ul className="flex flex-col gap-1.5">
                {metadata.series[key].splices.map((splice) => (
                  <li key={`${key}-${splice.from}`} className="text-xs text-text-secondary">
                    <span className="text-text-primary">
                      {splice.from} - {splice.to}:
                    </span>{' '}
                    <a
                      href={splice.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-2 hover:underline"
                    >
                      {splice.source}
                    </a>
                    {' - '}
                    {splice.note}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
