import { useState } from 'react'
import { nanoid } from 'nanoid'
import { NumberInput } from '@/components/ui/NumberInput'
import type { CashFlowRule, WithdrawalStyle } from '@/engine/types'

interface CashFlowRuleFormProps {
  type: 'contribution' | 'withdrawal'
  initial?: CashFlowRule
  onSave: (rule: CashFlowRule) => void
  onCancel: () => void
}

type WithdrawalStyleKind = WithdrawalStyle['kind']

/** Shared field set behind ContributionForm and WithdrawalForm - the two
 * rule types only differ in `type` and copy, not in shape. Withdrawals
 * additionally get a choice of how the amount is computed each firing
 * (see WithdrawalStyle in types.ts); contributions are always
 * `fixedAmount`. */
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
  const [hasRamp, setHasRamp] = useState(
    initial?.endAmount !== undefined && initial?.rampEndOffset !== undefined,
  )
  const [endAmount, setEndAmount] = useState(initial?.endAmount ?? amount)
  const [rampEndYear, setRampEndYear] = useState(
    initial?.rampEndOffset ? initial.rampEndOffset.months / 12 : startYear + 10,
  )

  const [styleKind, setStyleKind] = useState<WithdrawalStyleKind>(initial?.withdrawalStyle?.kind ?? 'fixedAmount')
  const [percentOfPortfolio, setPercentOfPortfolio] = useState(
    initial?.withdrawalStyle?.kind === 'percentOfPortfolio' ? initial.withdrawalStyle.percent * 100 : 4,
  )
  const [guardrailInitialPercent, setGuardrailInitialPercent] = useState(
    initial?.withdrawalStyle?.kind === 'guardrails' ? initial.withdrawalStyle.initialPercent * 100 : 4,
  )
  const [guardrailUpper, setGuardrailUpper] = useState(
    initial?.withdrawalStyle?.kind === 'guardrails' ? initial.withdrawalStyle.upperGuardrailPercent * 100 : 20,
  )
  const [guardrailLower, setGuardrailLower] = useState(
    initial?.withdrawalStyle?.kind === 'guardrails' ? initial.withdrawalStyle.lowerGuardrailPercent * 100 : 20,
  )
  const [guardrailAdjustment, setGuardrailAdjustment] = useState(
    initial?.withdrawalStyle?.kind === 'guardrails' ? initial.withdrawalStyle.adjustmentPercent * 100 : 10,
  )

  function handleRampToggle(checked: boolean) {
    setHasRamp(checked)
    // A ramp needs a target offset to interpolate toward, distinct from
    // (and independent of) "ends in year" - default it to something
    // sensible rather than leaving it unset.
    if (checked && rampEndYear <= startYear) setRampEndYear(startYear + 10)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const isFixedAmount = type === 'contribution' || styleKind === 'fixedAmount'

    const withdrawalStyle: WithdrawalStyle | undefined =
      type !== 'withdrawal' || styleKind === 'fixedAmount'
        ? undefined
        : styleKind === 'percentOfPortfolio'
          ? { kind: 'percentOfPortfolio', percent: percentOfPortfolio / 100 }
          : {
              kind: 'guardrails',
              initialPercent: guardrailInitialPercent / 100,
              upperGuardrailPercent: guardrailUpper / 100,
              lowerGuardrailPercent: guardrailLower / 100,
              adjustmentPercent: guardrailAdjustment / 100,
            }

    onSave({
      id: initial?.id ?? nanoid(),
      type,
      startOffset: { months: Math.round(startYear * 12) },
      endOffset: hasEnd ? { months: Math.round(endYear * 12) } : undefined,
      amount: isFixedAmount ? amount : 0,
      // Percent-of-portfolio styles read as an annual rate, so they only
      // make sense fired once a year.
      frequency: isFixedAmount ? frequency : 'yearly',
      inflationAdjusted: isFixedAmount ? inflationAdjusted : false,
      endAmount: isFixedAmount && hasRamp ? endAmount : undefined,
      rampEndOffset: isFixedAmount && hasRamp ? { months: Math.round(rampEndYear * 12) } : undefined,
      withdrawalStyle,
    })
  }

  const verb = type === 'contribution' ? 'Contribute' : 'Withdraw'
  const isFixedAmount = type === 'contribution' || styleKind === 'fixedAmount'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      {type === 'withdrawal' && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">Withdrawal style</span>
          <select
            value={styleKind}
            onChange={(e) => setStyleKind(e.target.value as WithdrawalStyleKind)}
            className="w-full max-w-sm rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          >
            <option value="fixedAmount">Fixed amount</option>
            <option value="percentOfPortfolio">Percentage of portfolio (e.g. the 4% rule)</option>
            <option value="guardrails">Guyton-Klinger guardrails</option>
          </select>
        </label>
      )}

      {isFixedAmount && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-text-secondary">{verb} (£)</span>
            <NumberInput
              min={0}
              step={100}
              value={amount}
              onChange={setAmount}
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
      )}

      {type === 'withdrawal' && styleKind === 'percentOfPortfolio' && (
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">Withdraw % of portfolio per year</span>
          <div className="flex items-center gap-1">
            <NumberInput
              min={0}
              max={100}
              step={0.5}
              value={percentOfPortfolio}
              onChange={setPercentOfPortfolio}
              className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
            />
            <span className="text-text-muted">%</span>
          </div>
          <p className="text-xs text-text-muted">
            Recalculated from the current portfolio value every year - rises and falls with markets,
            rather than a fixed £ amount.
          </p>
        </label>
      )}

      {type === 'withdrawal' && styleKind === 'guardrails' && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">Initial withdrawal rate (%)</span>
              <NumberInput
                min={0}
                max={100}
                step={0.5}
                value={guardrailInitialPercent}
                onChange={setGuardrailInitialPercent}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">Adjustment (%)</span>
              <NumberInput
                min={0}
                max={100}
                step={0.5}
                value={guardrailAdjustment}
                onChange={setGuardrailAdjustment}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">Upper guardrail (%)</span>
              <NumberInput
                min={0}
                max={100}
                step={1}
                value={guardrailUpper}
                onChange={setGuardrailUpper}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">Lower guardrail (%)</span>
              <NumberInput
                min={0}
                max={100}
                step={1}
                value={guardrailLower}
                onChange={setGuardrailLower}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
              />
            </label>
          </div>
          <p className="text-xs text-text-muted">
            Starts by withdrawing {guardrailInitialPercent}% of the portfolio. If the withdrawal rate
            later rises more than {guardrailUpper}% above that, spending is cut by{' '}
            {guardrailAdjustment}%; if it falls more than {guardrailLower}% below it, spending is
            raised by {guardrailAdjustment}%.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">Starting in year</span>
          <NumberInput
            min={0}
            step={1}
            value={startYear}
            onChange={setStartYear}
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
          <NumberInput
            min={startYear}
            step={1}
            value={endYear}
            onChange={setEndYear}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          />
        )}
      </div>

      {isFixedAmount && (
        <>
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={inflationAdjusted}
              onChange={(e) => setInflationAdjusted(e.target.checked)}
            />
            Adjust amount for inflation over time
          </label>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={hasRamp}
                onChange={(e) => handleRampToggle(e.target.checked)}
              />
              Change the amount over time (e.g. salary growth, tapering withdrawals)
            </label>
            {hasRamp && (
              <div className="ml-6 flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-text-secondary">Reaching (£)</span>
                  <NumberInput
                    min={0}
                    step={100}
                    value={endAmount}
                    onChange={setEndAmount}
                    className="w-32 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-text-secondary">by year</span>
                  <NumberInput
                    min={startYear}
                    step={1}
                    value={rampEndYear}
                    onChange={setRampEndYear}
                    className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
                  />
                </label>
              </div>
            )}
            {hasRamp && rampEndYear < startYear && (
              <p className="text-sm text-status-critical">The ramp&rsquo;s target year can&rsquo;t be before the start year.</p>
            )}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isFixedAmount && hasRamp && rampEndYear < startYear}
          className="rounded-md bg-stocks px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
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
