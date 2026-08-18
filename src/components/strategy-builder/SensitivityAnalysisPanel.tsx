import { lazy, Suspense, useState } from 'react'
import { NumberInput } from '@/components/ui/NumberInput'
import { buildSweepValues, type SensitivityResult, type SensitivityTarget } from '@/engine/sensitivity'
import type { CashFlowRule } from '@/engine/types'
import { useBacktestWorker } from '@/hooks/useBacktestWorker'
import { useStrategyStore } from '@/store/strategyStore'

const SensitivityChart = lazy(() =>
  import('@/components/results/SensitivityChart').then((m) => ({ default: m.SensitivityChart })),
)

type TargetOption =
  | { kind: 'startValue' }
  | { kind: 'annualFeePercent' }
  | { kind: 'ruleAmount'; ruleId: string; rule: CashFlowRule }

function targetKey(target: TargetOption): string {
  return target.kind === 'ruleAmount' ? `rule:${target.ruleId}` : target.kind
}

function targetLabel(target: TargetOption): string {
  if (target.kind === 'startValue') return 'Starting portfolio value'
  if (target.kind === 'annualFeePercent') return 'Annual fee (%)'
  const verb = target.rule.type === 'contribution' ? 'Contribution' : 'Withdrawal'
  return `${verb} amount (£${target.rule.amount.toLocaleString()}/${target.rule.frequency === 'yearly' ? 'yr' : 'mo'})`
}

/** The current value of a target, in the unit its range inputs use
 * (whole pounds for money, percentage points for the fee). */
function currentValue(target: TargetOption, startValue: number, feePercent: number): number {
  if (target.kind === 'startValue') return startValue
  if (target.kind === 'annualFeePercent') return feePercent * 100
  return target.rule.amount
}

function toSensitivityTarget(target: TargetOption): SensitivityTarget {
  if (target.kind === 'ruleAmount') return { kind: 'ruleAmount', ruleId: target.ruleId }
  return target
}

/** Explores "if I change X, how does the robust historical outcome
 * change?" by re-running a rolling backtest once per value in an
 * evenly-spaced sweep of one numeric strategy field, then plotting median
 * ending value against that field. */
export function SensitivityAnalysisPanel() {
  const strategy = useStrategyStore((s) => s.strategy)
  const { runSensitivity } = useBacktestWorker()

  const targets: TargetOption[] = [
    { kind: 'startValue' },
    { kind: 'annualFeePercent' },
    ...strategy.rules
      .filter((r): r is CashFlowRule => r.type === 'contribution' || r.type === 'withdrawal')
      .map((rule): TargetOption => ({ kind: 'ruleAmount', ruleId: rule.id, rule })),
  ]

  const [selectedKey, setSelectedKey] = useState(targetKey(targets[0]))
  const selected = targets.find((t) => targetKey(t) === selectedKey) ?? targets[0]

  const base = currentValue(selected, strategy.initialPortfolio.startValue, strategy.feesAndTax?.annualFeePercent ?? 0)
  const [from, setFrom] = useState(base * 0.7)
  const [to, setTo] = useState(base * 1.3 || 1)
  const [steps, setSteps] = useState(5)

  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<SensitivityResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSelect(key: string) {
    setSelectedKey(key)
    const target = targets.find((t) => targetKey(t) === key) ?? targets[0]
    const newBase = currentValue(
      target,
      strategy.initialPortfolio.startValue,
      strategy.feesAndTax?.annualFeePercent ?? 0,
    )
    setFrom(newBase * 0.7)
    setTo(newBase * 1.3 || 1)
    setResult(null)
  }

  async function handleRun() {
    setError(null)
    setResult(null)
    setIsRunning(true)
    setProgress(null)
    try {
      // Fee % is edited in whole percentage points but the engine wants a
      // fraction, so scale the sweep back down just for that target.
      const scale = selected.kind === 'annualFeePercent' ? 0.01 : 1
      const values = buildSweepValues(from * scale, to * scale, steps)
      const sensitivityResult = await runSensitivity(
        strategy,
        toSensitivityTarget(selected),
        values,
        {},
        (done, total) => setProgress({ done, total }),
      )
      setResult(sensitivityResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsRunning(false)
      setProgress(null)
    }
  }

  const isPercent = selected.kind === 'annualFeePercent'
  const paramFormat = (value: number) =>
    isPercent
      ? `${value.toFixed(2)}%`
      : new Intl.NumberFormat('en-GB', {
          style: 'currency',
          currency: 'GBP',
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(value)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg">Sensitivity analysis</h2>
      <p className="text-sm text-text-muted">
        See how the robust (rolling, across every historical start date) outcome moves as you vary
        one number in the strategy.
      </p>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-secondary">Parameter to vary</span>
        <select
          value={selectedKey}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full max-w-sm rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
        >
          {targets.map((t) => (
            <option key={targetKey(t)} value={targetKey(t)}>
              {targetLabel(t)}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">From{isPercent ? ' (%)' : ' (£)'}</span>
          <NumberInput
            value={from}
            onChange={setFrom}
            className="w-32 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">To{isPercent ? ' (%)' : ' (£)'}</span>
          <NumberInput
            value={to}
            onChange={setTo}
            className="w-32 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-text-secondary">Steps</span>
          <NumberInput
            min={2}
            max={15}
            value={steps}
            onChange={setSteps}
            className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning}
        className="self-start rounded-md bg-stocks px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isRunning ? 'Running…' : 'Run sensitivity sweep'}
      </button>

      {progress && (
        <p className="text-sm text-text-secondary">
          Running {progress.done} / {progress.total}…
        </p>
      )}
      {error && <p className="text-sm text-status-critical">{error}</p>}

      {result && (
        <Suspense fallback={<p className="text-sm text-text-muted">Loading chart…</p>}>
          <SensitivityChart result={result} paramFormat={paramFormat} />
        </Suspense>
      )}
    </section>
  )
}
