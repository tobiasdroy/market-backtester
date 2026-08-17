import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { AllocationTarget, GlidePathRule } from '@/engine/types'
import { AllocationInputs } from './AllocationInputs'

interface GlidePathFormProps {
  initial?: GlidePathRule
  onSave: (rule: GlidePathRule) => void
  onCancel: () => void
}

/** Gradually shifts allocation from one mix to another across a year
 * range (e.g. de-risking into retirement), rather than jumping
 * instantly like a one-off rebalance. */
export function GlidePathForm({ initial, onSave, onCancel }: GlidePathFormProps) {
  const [startYear, setStartYear] = useState(initial ? initial.startOffset.months / 12 : 20)
  const [endYear, setEndYear] = useState(initial ? initial.endOffset.months / 12 : 30)
  const [startAllocation, setStartAllocation] = useState<AllocationTarget>(
    initial?.startAllocation ?? { stocks: 0.8, bonds: 0.2, cash: 0 },
  )
  const [endAllocation, setEndAllocation] = useState<AllocationTarget>(
    initial?.endAllocation ?? { stocks: 0.5, bonds: 0.5, cash: 0 },
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      id: initial?.id ?? nanoid(),
      type: 'glidePath',
      startOffset: { months: Math.round(startYear * 12) },
      endOffset: { months: Math.round(Math.max(startYear, endYear) * 12) },
      startAllocation,
      endAllocation,
    })
  }

  const isValid =
    Math.abs(startAllocation.stocks + startAllocation.bonds + startAllocation.cash - 1) < 1e-6 &&
    Math.abs(endAllocation.stocks + endAllocation.bonds + endAllocation.cash - 1) < 1e-6 &&
    endYear >= startYear

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">From year</span>
          <input
            type="number"
            min={0}
            step={1}
            value={startYear}
            onChange={(e) => setStartYear(Number(e.target.value))}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">To year</span>
          <input
            type="number"
            min={0}
            step={1}
            value={endYear}
            onChange={(e) => setEndYear(Number(e.target.value))}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          />
        </label>
      </div>
      {endYear < startYear && (
        <p className="text-sm text-status-critical">End year must be on or after the start year.</p>
      )}

      <div>
        <span className="mb-1 block text-sm text-text-secondary">Starting allocation</span>
        <AllocationInputs value={startAllocation} onChange={setStartAllocation} />
      </div>

      <div>
        <span className="mb-1 block text-sm text-text-secondary">Ending allocation</span>
        <AllocationInputs value={endAllocation} onChange={setEndAllocation} />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!isValid}
          className="rounded-md bg-bonds px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {initial ? 'Save' : 'Add rule'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
