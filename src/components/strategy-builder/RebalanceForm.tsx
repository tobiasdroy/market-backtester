import { useState } from 'react'
import { nanoid } from 'nanoid'
import { NumberInput } from '@/components/ui/NumberInput'
import type { AllocationTarget, RebalanceRule } from '@/engine/types'
import { AllocationInputs } from './AllocationInputs'

interface RebalanceFormProps {
  initial?: RebalanceRule
  onSave: (rule: RebalanceRule) => void
  onCancel: () => void
}

export function RebalanceForm({ initial, onSave, onCancel }: RebalanceFormProps) {
  const [year, setYear] = useState(initial ? initial.startOffset.months / 12 : 10)
  const [allocation, setAllocation] = useState<AllocationTarget>(
    initial?.targetAllocation ?? { stocks: 0.7, bonds: 0.3, cash: 0 },
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      id: initial?.id ?? nanoid(),
      type: 'rebalance',
      startOffset: { months: Math.round(year * 12) },
      targetAllocation: allocation,
    })
  }

  const isValidAllocation = Math.abs(allocation.stocks + allocation.bonds + allocation.cash - 1) < 1e-6

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-secondary">Rebalance in year</span>
        <NumberInput
          min={0}
          step={1}
          value={year}
          onChange={setYear}
          className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
        />
      </label>

      <div>
        <span className="mb-1 block text-sm text-text-secondary">New target allocation</span>
        <AllocationInputs value={allocation} onChange={setAllocation} />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!isValidAllocation}
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
