import { useStrategyStore } from '@/store/strategyStore'
import { AllocationInputs } from './AllocationInputs'

export function InitialPortfolioForm() {
  const { initialPortfolio } = useStrategyStore((s) => s.strategy)
  const setInitialPortfolio = useStrategyStore((s) => s.setInitialPortfolio)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg">Starting portfolio</h2>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-secondary">Starting value (£)</span>
        <input
          type="number"
          min={0}
          step={1000}
          value={initialPortfolio.startValue}
          onChange={(e) =>
            setInitialPortfolio(Number(e.target.value), initialPortfolio.allocation)
          }
          className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
        />
      </label>

      <div>
        <span className="mb-1 block text-sm text-text-secondary">Initial allocation</span>
        <AllocationInputs
          value={initialPortfolio.allocation}
          onChange={(allocation) => setInitialPortfolio(initialPortfolio.startValue, allocation)}
        />
      </div>
    </section>
  )
}
