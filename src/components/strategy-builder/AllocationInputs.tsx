import type { AllocationTarget, AssetClass } from '@/engine/types'

const ASSET_LABELS: Record<AssetClass, string> = {
  stocks: 'Stocks',
  bonds: 'Bonds',
  cash: 'Cash',
}

const ASSET_COLOR_VAR: Record<AssetClass, string> = {
  stocks: 'var(--series-stocks)',
  bonds: 'var(--series-bonds)',
  cash: 'var(--series-cash)',
}

interface AllocationInputsProps {
  value: AllocationTarget
  onChange: (allocation: AllocationTarget) => void
}

const ASSET_ORDER: AssetClass[] = ['stocks', 'bonds', 'cash']

/** Three percentage inputs for stocks/bonds/cash that must sum to 100%.
 * Editing one field proportionally rescales the other two so the total
 * always stays at 100 - avoids a separate "normalize" step. */
export function AllocationInputs({ value, onChange }: AllocationInputsProps) {
  const total = value.stocks + value.bonds + value.cash
  const isValid = Math.abs(total - 1) < 1e-6

  function handleChange(asset: AssetClass, percent: number) {
    const newValue = Math.max(0, Math.min(100, percent)) / 100
    const others = ASSET_ORDER.filter((a) => a !== asset)
    const othersTotal = others.reduce((sum, a) => sum + value[a], 0)
    const remaining = 1 - newValue

    const next: AllocationTarget = { ...value, [asset]: newValue }
    if (othersTotal > 1e-9) {
      for (const a of others) {
        next[a] = (value[a] / othersTotal) * remaining
      }
    } else {
      for (const a of others) {
        next[a] = remaining / others.length
      }
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-4">
        {ASSET_ORDER.map((asset) => (
          <label key={asset} className="flex flex-1 flex-col gap-1">
            <span className="flex items-center gap-1.5 text-sm text-text-secondary">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: ASSET_COLOR_VAR[asset] }}
                aria-hidden
              />
              {ASSET_LABELS[asset]}
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={Math.round(value[asset] * 1000) / 10}
                onChange={(e) => handleChange(asset, Number(e.target.value))}
                className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
              />
              <span className="text-text-muted">%</span>
            </div>
          </label>
        ))}
      </div>
      {!isValid && (
        <p className="text-sm text-status-critical">
          Allocation must sum to 100% (currently {Math.round(total * 1000) / 10}%).
        </p>
      )}
    </div>
  )
}
