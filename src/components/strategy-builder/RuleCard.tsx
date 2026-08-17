import type { StrategyRule } from '@/engine/types'

interface RuleCardProps {
  rule: StrategyRule
  onEdit: () => void
  onDelete: () => void
}

function describeRule(rule: StrategyRule): { label: string; color: string } {
  const startYear = rule.startOffset.months / 12
  if (rule.type === 'rebalance') {
    const a = rule.targetAllocation
    return {
      label: `Rebalance to ${Math.round(a.stocks * 100)}% stocks / ${Math.round(
        a.bonds * 100,
      )}% bonds / ${Math.round(a.cash * 100)}% cash in year ${startYear}`,
      color: 'var(--series-bonds)',
    }
  }
  const verb = rule.type === 'contribution' ? 'Contribute' : 'Withdraw'
  const freq = rule.frequency === 'yearly' ? '/year' : '/month'
  const endYear = rule.endOffset ? rule.endOffset.months / 12 : undefined
  const range = endYear !== undefined ? `years ${startYear}-${endYear}` : `from year ${startYear}`
  const inflation = rule.inflationAdjusted ? ', inflation-adjusted' : ''
  return {
    label: `${verb} £${rule.amount.toLocaleString()}${freq}, ${range}${inflation}`,
    color: rule.type === 'contribution' ? 'var(--series-stocks)' : 'var(--series-cash)',
  }
}

export function RuleCard({ rule, onEdit, onDelete }: RuleCardProps) {
  const { label, color } = describeRule(rule)
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <span className="text-sm text-text-primary">{label}</span>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="text-sm text-text-secondary underline-offset-2 hover:underline"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="text-sm text-status-critical underline-offset-2 hover:underline"
        >
          Remove
        </button>
      </div>
    </li>
  )
}
