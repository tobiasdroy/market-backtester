import type { FeesAndTax } from '@/engine/types'
import { useStrategyStore } from '@/store/strategyStore'

const DEFAULT_FEE_PERCENT = 0.5 // annual %, e.g. a typical platform + fund OCF
const DEFAULT_CGT_RATE = 20 // %, UK higher-rate CGT on shares

/** Fees drag every asset class regardless of wrapper; account type
 * controls whether withdrawals owe capital gains tax (see simulate.ts -
 * a cost-basis approximation, not full HMRC rules). Omitted entirely
 * (feesAndTax: undefined) is the default - no fees, no tax, exactly the
 * old behavior. */
export function AccountSettingsForm() {
  const feesAndTax = useStrategyStore((s) => s.strategy.feesAndTax)
  const setFeesAndTax = useStrategyStore((s) => s.setFeesAndTax)

  const enabled = feesAndTax !== undefined
  const feePercent = feesAndTax ? feesAndTax.annualFeePercent * 100 : DEFAULT_FEE_PERCENT
  const accountType = feesAndTax?.accountType ?? 'ISA'
  const cgtRate = feesAndTax?.capitalGainsTaxRate
    ? feesAndTax.capitalGainsTaxRate * 100
    : DEFAULT_CGT_RATE

  function update(partial: Partial<FeesAndTax>) {
    setFeesAndTax({
      annualFeePercent: feePercent / 100,
      accountType,
      capitalGainsTaxRate: cgtRate / 100,
      ...partial,
    })
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
      <label className="flex items-center gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) =>
            setFeesAndTax(
              e.target.checked
                ? {
                    annualFeePercent: DEFAULT_FEE_PERCENT / 100,
                    accountType: 'ISA',
                    capitalGainsTaxRate: DEFAULT_CGT_RATE / 100,
                  }
                : undefined,
            )
          }
        />
        Model fees &amp; tax
      </label>

      {enabled && (
        <div className="ml-6 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-text-secondary">Annual platform/fund fee (%)</span>
            <input
              type="number"
              min={0}
              max={5}
              step={0.05}
              value={feePercent}
              onChange={(e) => update({ annualFeePercent: Number(e.target.value) / 100 })}
              className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
            />
          </label>

          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm text-text-secondary">Account type</legend>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                checked={accountType === 'ISA'}
                onChange={() => update({ accountType: 'ISA' })}
              />
              ISA (tax-free)
            </label>
            <label className="flex items-center gap-2 text-sm text-text-primary">
              <input
                type="radio"
                checked={accountType === 'GIA'}
                onChange={() => update({ accountType: 'GIA' })}
              />
              General Investment Account (taxable)
            </label>
          </fieldset>

          {accountType === 'GIA' && (
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">
                Capital gains tax rate on withdrawals (%)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                value={cgtRate}
                onChange={(e) => update({ capitalGainsTaxRate: Number(e.target.value) / 100 })}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
              />
              <span className="text-xs text-text-muted">
                Approximation: taxes the estimated gain portion of each withdrawal at this
                flat rate. Doesn&rsquo;t model the annual CGT allowance or dividend tax.
              </span>
            </label>
          )}
        </div>
      )}
    </section>
  )
}
