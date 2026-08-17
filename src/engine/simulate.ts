import type {
  AllocationTarget,
  AssetClass,
  CashFlowRule,
  MarketData,
  PortfolioSnapshot,
  RebalanceRule,
  SimulationResult,
  Strategy,
} from './types'

export const ASSET_CLASSES: AssetClass[] = ['stocks', 'bonds', 'cash']

type Balances = Record<AssetClass, number>

function totalOf(balances: Balances): number {
  return balances.stocks + balances.bonds + balances.cash
}

function weightsOf(balances: Balances): AllocationTarget {
  const total = totalOf(balances)
  if (total <= 0) {
    return { stocks: 1 / 3, bonds: 1 / 3, cash: 1 / 3 }
  }
  return {
    stocks: balances.stocks / total,
    bonds: balances.bonds / total,
    cash: balances.cash / total,
  }
}

function applyRebalance(balances: Balances, target: AllocationTarget): Balances {
  const total = totalOf(balances)
  return {
    stocks: total * target.stocks,
    bonds: total * target.bonds,
    cash: total * target.cash,
  }
}

function distributeContribution(
  balances: Balances,
  amount: number,
  weights: AllocationTarget,
): void {
  balances.stocks += amount * weights.stocks
  balances.bonds += amount * weights.bonds
  balances.cash += amount * weights.cash
}

/** Withdraws pro-rata across current balances, clamped to what's
 * available. Returns the amount actually paid out. */
function distributeWithdrawal(balances: Balances, amount: number): number {
  const total = totalOf(balances)
  if (total <= 0) return 0
  const paid = Math.min(amount, total)
  const weights = weightsOf(balances)
  balances.stocks = Math.max(0, balances.stocks - paid * weights.stocks)
  balances.bonds = Math.max(0, balances.bonds - paid * weights.bonds)
  balances.cash = Math.max(0, balances.cash - paid * weights.cash)
  return paid
}

/** Is `rule` due at this month offset? Offset 0 is reserved for the
 * initial snapshot, so a rule's first firing is at
 * `max(startOffset.months, period)` when startOffset is 0, or at
 * `startOffset.months` directly otherwise (see types.ts for the
 * "add £X/year" reading this produces). */
function isRuleDue(rule: CashFlowRule, offset: number): boolean {
  if (offset < 1) return false
  if (rule.endOffset && offset > rule.endOffset.months) return false
  const period = rule.frequency === 'monthly' ? 1 : 12
  const base = rule.startOffset.months === 0 ? period : rule.startOffset.months
  return offset >= base && (offset - base) % period === 0
}

function inflationAdjustedAmount(
  rule: CashFlowRule,
  currentCpi: number,
  startCpi: number,
): number {
  return rule.inflationAdjusted ? rule.amount * (currentCpi / startCpi) : rule.amount
}

export function simulateSingleRun(
  strategy: Strategy,
  marketData: MarketData,
  startDate: string,
): SimulationResult {
  const startIndex = marketData.indexByDate.get(startDate)
  if (startIndex === undefined) {
    throw new Error(`startDate ${startDate} not found in market data`)
  }
  const endIndex = startIndex + strategy.durationMonths
  if (endIndex >= marketData.months.length) {
    throw new Error(
      `not enough market data for a ${strategy.durationMonths}-month run starting ${startDate}`,
    )
  }

  const { allocation, startValue } = strategy.initialPortfolio
  const balances: Balances = {
    stocks: startValue * allocation.stocks,
    bonds: startValue * allocation.bonds,
    cash: startValue * allocation.cash,
  }

  const startCpi = marketData.months[startIndex].cpiIndex
  let cumulativeContributed = startValue
  let cumulativeWithdrawn = 0
  let everDepleted = false
  let lastRebalanceAllocation: AllocationTarget = allocation
  const contributionMode = strategy.contributionAllocation ?? 'proRata'

  const snapshots: PortfolioSnapshot[] = [
    {
      date: marketData.months[startIndex].date,
      monthOffset: 0,
      totalValue: startValue,
      byAsset: { ...balances },
      cumulativeContributed,
      cumulativeWithdrawn,
      cpiIndex: startCpi,
      depleted: false,
    },
  ]

  for (let offset = 1; offset <= strategy.durationMonths; offset++) {
    const month = marketData.months[startIndex + offset]

    for (const asset of ASSET_CLASSES) {
      balances[asset] *= 1 + month.monthlyReturn[asset]
    }

    for (const rule of strategy.rules) {
      if (rule.type === 'rebalance') {
        const rebalanceRule = rule as RebalanceRule
        if (offset === rebalanceRule.startOffset.months) {
          const rebalanced = applyRebalance(balances, rebalanceRule.targetAllocation)
          balances.stocks = rebalanced.stocks
          balances.bonds = rebalanced.bonds
          balances.cash = rebalanced.cash
          lastRebalanceAllocation = rebalanceRule.targetAllocation
        }
        continue
      }

      if (!isRuleDue(rule, offset)) continue
      const amount = inflationAdjustedAmount(rule, month.cpiIndex, startCpi)

      if (rule.type === 'contribution') {
        const weights =
          contributionMode === 'lastTarget' ? lastRebalanceAllocation : weightsOf(balances)
        distributeContribution(balances, amount, weights)
        cumulativeContributed += amount
      } else {
        const paid = distributeWithdrawal(balances, amount)
        cumulativeWithdrawn += paid
        if (paid < amount - 1e-6) everDepleted = true
      }
    }

    snapshots.push({
      date: month.date,
      monthOffset: offset,
      totalValue: totalOf(balances),
      byAsset: { ...balances },
      cumulativeContributed,
      cumulativeWithdrawn,
      cpiIndex: month.cpiIndex,
      depleted: everDepleted,
    })
  }

  return {
    strategyId: strategy.id,
    startDate,
    endDate: snapshots[snapshots.length - 1].date,
    snapshots,
  }
}
