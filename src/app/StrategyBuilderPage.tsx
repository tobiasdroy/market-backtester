import { lazy, Suspense, useState } from 'react'
import { AccountSettingsForm } from '@/components/strategy-builder/AccountSettingsForm'
import { ContributionForm } from '@/components/strategy-builder/ContributionForm'
import { InitialPortfolioForm } from '@/components/strategy-builder/InitialPortfolioForm'
import { RebalanceForm } from '@/components/strategy-builder/RebalanceForm'
import { RuleCard } from '@/components/strategy-builder/RuleCard'
import { RuleTimeline } from '@/components/strategy-builder/RuleTimeline'
import { SimulationControls } from '@/components/strategy-builder/SimulationControls'
import { WithdrawalForm } from '@/components/strategy-builder/WithdrawalForm'
import { SpliceAnnotations } from '@/components/results/SpliceAnnotations'
import { SummaryStatsPanel } from '@/components/results/SummaryStatsPanel'
import { computeDrawdownSeries, toRealSnapshots } from '@/engine/stats'
import type { CashFlowRule, RebalanceRule, StrategyRule } from '@/engine/types'
import { useMarketMetadata } from '@/hooks/useMarketMetadata'
import { useResultsStore } from '@/store/resultsStore'
import { useStrategyStore } from '@/store/strategyStore'

// Recharts (and everything that imports it) is the bulk of the JS bundle,
// so it's only worth loading once a backtest has actually been run.
const PortfolioValueChart = lazy(() =>
  import('@/components/results/PortfolioValueChart').then((m) => ({
    default: m.PortfolioValueChart,
  })),
)
const DrawdownChart = lazy(() =>
  import('@/components/results/DrawdownChart').then((m) => ({ default: m.DrawdownChart })),
)
const RollingOutcomesChart = lazy(() =>
  import('@/components/results/RollingOutcomesChart').then((m) => ({
    default: m.RollingOutcomesChart,
  })),
)

type RuleType = StrategyRule['type']

export function StrategyBuilderPage() {
  const strategy = useStrategyStore((s) => s.strategy)
  const addRule = useStrategyStore((s) => s.addRule)
  const updateRule = useStrategyStore((s) => s.updateRule)
  const removeRule = useStrategyStore((s) => s.removeRule)

  const singleResult = useResultsStore((s) => s.singleResult)
  const rollingResult = useResultsStore((s) => s.rollingResult)
  const runError = useResultsStore((s) => s.error)
  const progress = useResultsStore((s) => s.progress)
  const { metadata } = useMarketMetadata()

  const [addingType, setAddingType] = useState<RuleType | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  // Defaults to "today's money" - easier to reason about what a given
  // withdrawal amount actually buys decades from now than nominal pounds.
  const [valueMode, setValueMode] = useState<'nominal' | 'real'>('real')

  const editingRule = strategy.rules.find((r) => r.id === editingRuleId) ?? null

  function closeForm() {
    setAddingType(null)
    setEditingRuleId(null)
  }

  function handleSelectFromTimeline(id: string) {
    setAddingType(null)
    setEditingRuleId(id)
  }

  function handleSaveRule(rule: StrategyRule) {
    if (editingRuleId) {
      updateRule(rule.id, rule)
    } else {
      addRule(rule)
    }
    closeForm()
  }

  const activeType = editingRule?.type ?? addingType

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
      <InitialPortfolioForm />
      <AccountSettingsForm />

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">Rules</h2>

        <RuleTimeline
          rules={strategy.rules}
          durationMonths={strategy.durationMonths}
          onSelectRule={handleSelectFromTimeline}
        />

        {strategy.rules.length > 0 && (
          <ul className="flex flex-col gap-2">
            {strategy.rules.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onEdit={() => {
                  setAddingType(null)
                  setEditingRuleId(rule.id)
                }}
                onDelete={() => removeRule(rule.id)}
              />
            ))}
          </ul>
        )}

        {activeType === 'contribution' && (
          <ContributionForm
            initial={editingRule?.type === 'contribution' ? (editingRule as CashFlowRule) : undefined}
            onSave={handleSaveRule}
            onCancel={closeForm}
          />
        )}
        {activeType === 'withdrawal' && (
          <WithdrawalForm
            initial={editingRule?.type === 'withdrawal' ? (editingRule as CashFlowRule) : undefined}
            onSave={handleSaveRule}
            onCancel={closeForm}
          />
        )}
        {activeType === 'rebalance' && (
          <RebalanceForm
            initial={editingRule?.type === 'rebalance' ? (editingRule as RebalanceRule) : undefined}
            onSave={handleSaveRule}
            onCancel={closeForm}
          />
        )}

        {!activeType && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAddingType('contribution')}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-page"
            >
              + Contribution
            </button>
            <button
              type="button"
              onClick={() => setAddingType('withdrawal')}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-page"
            >
              + Withdrawal
            </button>
            <button
              type="button"
              onClick={() => setAddingType('rebalance')}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-page"
            >
              + Rebalance
            </button>
          </div>
        )}
      </section>

      <SimulationControls />

      {progress && (
        <p className="text-sm text-text-secondary">
          Running {progress.done} / {progress.total}…
        </p>
      )}
      {runError && <p className="text-sm text-status-critical">{runError}</p>}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">Results</h2>
          {(singleResult || rollingResult) && (
            <div className="flex rounded-md border border-border text-sm">
              <button
                type="button"
                onClick={() => setValueMode('real')}
                className={`rounded-l-md px-3 py-1 ${valueMode === 'real' ? 'bg-stocks text-white' : 'text-text-secondary hover:bg-page'}`}
              >
                Today&rsquo;s money
              </button>
              <button
                type="button"
                onClick={() => setValueMode('nominal')}
                className={`rounded-r-md px-3 py-1 ${valueMode === 'nominal' ? 'bg-stocks text-white' : 'text-text-secondary hover:bg-page'}`}
              >
                Nominal
              </button>
            </div>
          )}
        </div>
        <SummaryStatsPanel singleResult={singleResult} rollingResult={rollingResult} />

        {(singleResult || rollingResult) && (
          <Suspense fallback={<p className="text-sm text-text-muted">Loading charts…</p>}>
            {singleResult &&
              (() => {
                const snapshots =
                  valueMode === 'real' ? toRealSnapshots(singleResult.snapshots) : singleResult.snapshots
                return (
                  <>
                    <PortfolioValueChart
                      snapshots={snapshots}
                      splices={metadata?.series.stocks.splices}
                    />
                    <DrawdownChart drawdown={computeDrawdownSeries(snapshots)} />
                  </>
                )
              })()}
            {rollingResult && (
              <RollingOutcomesChart
                bands={valueMode === 'real' ? rollingResult.bandsReal : rollingResult.bands}
              />
            )}
          </Suspense>
        )}

        {(singleResult || rollingResult) && <SpliceAnnotations metadata={metadata} />}
      </section>
    </div>
  )
}
