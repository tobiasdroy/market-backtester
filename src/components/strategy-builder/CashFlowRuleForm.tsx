import { useState } from 'react'
import { nanoid } from 'nanoid'
import type { CashFlowRule } from '@/engine/types'

interface CashFlowRuleFormProps {
  type: 'contribution' | 'withdrawal'
  initial?: CashFlowRule
  onSave: (rule: CashFlowRule) => void
  onCancel: () => void
}

/** Shared field set behind ContributionForm and WithdrawalForm - the two
 * rule types only differ in `type` and copy, not in shape. */
export function CashFlowRuleForm({ type, initial, onSave, onCancel }: CashFlowRuleFormProps) {
  const [startYear, setStartYear] = useState(
    initial ? initial.startOffset.months / 12 : 0,
  )
  const [hasEnd, setHasEnd] = useState(initial?.endOffset !== undefined)
  const [endYear, setEndYear] = useState(
    initial?.endOffset ? initial.endOffset.months / 12 : startYear + 10,
  )
  const [amount, setAmount] = useState(initial?.amount ?? (type === 'contribution' ? 5000 : 20000))
  const [frequency, setFrequency] = useState<'monthly' | 'yearly'>(initial?.frequency ?? 'yearly')
  const [inflationAdjusted, setInflationAdjusted] = useState(initial?.inflationAdjusted ?? true)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSave({
      id: initial?.id ?? nanoid(),
      type,
      startOffset: { months: Math.round(startYear * 12) },
      endOffset: hasEnd ? { months: Math.round(endYear * 12) } : undefined,
      amount,
      frequency,
      inflationAdjusted,
    })
  }

  const verb = type === 'contribution' ? 'Contribute' : 'Withdraw'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">{verb} (£)</span>
          <input
            type="number"
            min={0}
            step={100}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-32 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">Frequency</span>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as 'monthly' | 'yearly')}
            className="rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          >
            <option value="yearly">per year</option>
            <option value="monthly">per month</option>
          </select>
        </label>
      </div>

      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">Starting in year</span>
          <input
            type="number"
            min={0}
            step={1}
            value={startYear}
            onChange={(e) => setStartYear(Number(e.target.value))}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={hasEnd}
            onChange={(e) => setHasEnd(e.target.checked)}
          />
          Ends in year
        </label>
        {hasEnd && (
          <input
            type="number"
            min={startYear}
            step={1}
            value={endYear}
            onChange={(e) => setEndYear(Number(e.target.value))}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          />
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={inflationAdjusted}
          onChange={(e) => setInflationAdjusted(e.target.checked)}
        />
        Adjust amount for inflation over time
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-stocks px-3 py-1.5 text-sm font-medium text-white"
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
