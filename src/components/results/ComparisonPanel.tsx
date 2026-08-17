import { lazy, Suspense } from 'react'
import { ComparisonTable } from '@/components/results/ComparisonTable'
import { useComparisonStore } from '@/store/comparisonStore'

const ComparisonChart = lazy(() =>
  import('@/components/results/ComparisonChart').then((m) => ({ default: m.ComparisonChart })),
)

interface ComparisonPanelProps {
  valueMode: 'nominal' | 'real'
  currentAge: number | null
}

/** Table + overlay chart of every strategy result the user has saved for
 * comparison. Renders nothing once the list is empty. */
export function ComparisonPanel({ valueMode, currentAge }: ComparisonPanelProps) {
  const entries = useComparisonStore((s) => s.entries)
  const removeEntry = useComparisonStore((s) => s.removeEntry)
  const clear = useComparisonStore((s) => s.clear)

  if (entries.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg">Compare strategies</h2>
        <button
          type="button"
          onClick={clear}
          className="text-xs text-text-secondary underline-offset-2 hover:underline"
        >
          Clear all
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <ComparisonTable entries={entries} onRemove={removeEntry} />
      </div>

      {entries.length > 1 && (
        <Suspense fallback={<p className="text-sm text-text-muted">Loading chart…</p>}>
          <ComparisonChart entries={entries} valueMode={valueMode} currentAge={currentAge} />
        </Suspense>
      )}
    </section>
  )
}
