import { useState } from 'react'
import { ContributionForm } from '@/components/strategy-builder/ContributionForm'
import { InitialPortfolioForm } from '@/components/strategy-builder/InitialPortfolioForm'
import { RebalanceForm } from '@/components/strategy-builder/RebalanceForm'
import { RuleCard } from '@/components/strategy-builder/RuleCard'
import { RuleTimeline } from '@/components/strategy-builder/RuleTimeline'
import { SimulationControls } from '@/components/strategy-builder/SimulationControls'
import { WithdrawalForm } from '@/components/strategy-builder/WithdrawalForm'
import { SummaryStatsPanel } from '@/components/results/SummaryStatsPanel'
import type { CashFlowRule, RebalanceRule, StrategyRule } from '@/engine/types'
import { useResultsStore } from '@/store/resultsStore'
import { useStrategyStore } from '@/store/strategyStore'

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

  const [addingType, setAddingType] = useState<RuleType | null>(null)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)

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
          <div className="flex gap-2">
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
        <h2 className="text-lg">Results</h2>
        <SummaryStatsPanel singleResult={singleResult} rollingResult={rollingResult} />
      </section>
    </div>
  )
}
