import type {
  AllocationTarget,
  AssetClass,
  CashFlowRule,
  FeesAndTax,
  GlidePathRule,
  MarketData,
  MarketMonth,
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

/** Deducts the monthly-equivalent of an annual fee drag from every asset
 * class. Uses the simple linear approximation (annualRate / 12) - the
 * standard convention platforms quote an "ongoing charges figure" by,
 * and close enough to geometric compounding at typical fee sizes. */
function applyFeeDrag(balances: Balances, annualFeePercent: number): number {
  const totalBefore = totalOf(balances)
  const monthlyRate = annualFeePercent / 12
  for (const asset of ASSET_CLASSES) {
    balances[asset] *= 1 - monthlyRate
  }
  return totalBefore - totalOf(balances)
}

interface WithdrawalOutcome {
  netPaid: number
  taxPaid: number
  newCostBasis: number
}

/** Withdraws `requestedNetAmount` pro-rata, grossed up so that amount is
 * what's actually received net of capital gains tax on a GIA (ISA: no
 * tax, netPaid === requested unless the portfolio can't cover it).
 *
 * Approximation: the gain fraction of the withdrawal is `(total -
 * costBasis) / total`, using the portfolio's *total* unrealized gain
 * ratio as a stand-in for the gain ratio of the specific units sold
 * (Section-104-pool-style average cost, not FIFO/specific-identification,
 * and ignoring the UK's annual CGT exempt amount). `costBasis` is
 * reduced proportionally to the fraction of the portfolio withdrawn. */
function withdrawWithTax(
  balances: Balances,
  requestedNetAmount: number,
  costBasis: number,
  feesAndTax: FeesAndTax | undefined,
): WithdrawalOutcome {
  const total = totalOf(balances)
  if (total <= 0) return { netPaid: 0, taxPaid: 0, newCostBasis: costBasis }

  const isGIA = feesAndTax?.accountType === 'GIA'
  const taxRate = feesAndTax?.capitalGainsTaxRate ?? 0
  const gainFraction = isGIA ? Math.max(0, (total - costBasis) / total) : 0
  const effectiveTaxRate = gainFraction * taxRate

  const desiredGross =
    effectiveTaxRate < 1 ? requestedNetAmount / (1 - effectiveTaxRate) : total
  const grossWithdrawn = distributeWithdrawal(balances, desiredGross)
  const taxPaid = grossWithdrawn * effectiveTaxRate
  const newCostBasis = Math.max(0, costBasis - costBasis * (grossWithdrawn / total))

  return { netPaid: grossWithdrawn - taxPaid, taxPaid, newCostBasis }
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

/** Linearly interpolates between a glide path's start/end allocation at
 * `offset`, clamped to [0, 1] progress. A zero-length range (start ==
 * end offset) jumps straight to the end allocation, like a rebalance. */
function glidePathAllocationAt(rule: GlidePathRule, offset: number): AllocationTarget {
  const span = rule.endOffset.months - rule.startOffset.months
  const progress = span <= 0 ? 1 : (offset - rule.startOffset.months) / span
  const clamped = Math.max(0, Math.min(1, progress))
  return {
    stocks: rule.startAllocation.stocks + (rule.endAllocation.stocks - rule.startAllocation.stocks) * clamped,
    bonds: rule.startAllocation.bonds + (rule.endAllocation.bonds - rule.startAllocation.bonds) * clamped,
    cash: rule.startAllocation.cash + (rule.endAllocation.cash - rule.startAllocation.cash) * clamped,
  }
}

/** The rule's base (pre-inflation) amount at `offset`, linearly ramped
 * from `amount` toward `endAmount` if both `endAmount` and
 * `rampEndOffset` are set, holding at `endAmount` past `rampEndOffset`.
 * Falls back to the flat `amount` otherwise. */
function rampedAmount(rule: CashFlowRule, offset: number): number {
  if (rule.endAmount === undefined || !rule.rampEndOffset) return rule.amount
  const span = rule.rampEndOffset.months - rule.startOffset.months
  const progress = span <= 0 ? 1 : (offset - rule.startOffset.months) / span
  const clamped = Math.max(0, Math.min(1, progress))
  return rule.amount + (rule.endAmount - rule.amount) * clamped
}

function inflationAdjustedAmount(
  rule: CashFlowRule,
  offset: number,
  currentCpi: number,
  startCpi: number,
): number {
  const base = rampedAmount(rule, offset)
  return rule.inflationAdjusted ? base * (currentCpi / startCpi) : base
}

/** Core stepping loop, decoupled from real calendar lookups: runs
 * `strategy` over exactly `strategy.durationMonths + 1` months of
 * `months[0..]` (months[0] is the "month 0" starting point; returns are
 * applied starting from months[1]). Shared by `simulateSingleRun` (a
 * real historical slice) and Monte Carlo (a bootstrap-resampled
 * synthetic path) - see monteCarlo.ts. */
export function runStrategyOverMonths(
  strategy: Strategy,
  months: MarketMonth[],
  strategyId: string,
): SimulationResult {
  if (months.length < strategy.durationMonths + 1) {
    throw new Error(
      `need ${strategy.durationMonths + 1} months of data, got ${months.length}`,
    )
  }

  const { allocation, startValue } = strategy.initialPortfolio
  const balances: Balances = {
    stocks: startValue * allocation.stocks,
    bonds: startValue * allocation.bonds,
    cash: startValue * allocation.cash,
  }

  const startCpi = months[0].cpiIndex
  let cumulativeContributed = startValue
  let cumulativeWithdrawn = 0
  let cumulativeFeesPaid = 0
  let cumulativeTaxPaid = 0
  let costBasis = startValue
  let everDepleted = false
  let lastRebalanceAllocation: AllocationTarget = allocation
  const contributionMode = strategy.contributionAllocation ?? 'proRata'
  const { feesAndTax } = strategy

  const snapshots: PortfolioSnapshot[] = [
    {
      date: months[0].date,
      monthOffset: 0,
      totalValue: startValue,
      byAsset: { ...balances },
      cumulativeContributed,
      cumulativeWithdrawn,
      cumulativeFeesPaid,
      cumulativeTaxPaid,
      cpiIndex: startCpi,
      depleted: false,
    },
  ]

  for (let offset = 1; offset <= strategy.durationMonths; offset++) {
    const month = months[offset]

    for (const asset of ASSET_CLASSES) {
      balances[asset] *= 1 + month.monthlyReturn[asset]
    }

    if (feesAndTax && feesAndTax.annualFeePercent > 0) {
      cumulativeFeesPaid += applyFeeDrag(balances, feesAndTax.annualFeePercent)
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

      if (rule.type === 'glidePath') {
        const glideRule = rule as GlidePathRule
        if (offset >= glideRule.startOffset.months && offset <= glideRule.endOffset.months) {
          const target = glidePathAllocationAt(glideRule, offset)
          const rebalanced = applyRebalance(balances, target)
          balances.stocks = rebalanced.stocks
          balances.bonds = rebalanced.bonds
          balances.cash = rebalanced.cash
          lastRebalanceAllocation = target
        }
        continue
      }

      if (!isRuleDue(rule, offset)) continue
      const amount = inflationAdjustedAmount(rule, offset, month.cpiIndex, startCpi)

      if (rule.type === 'contribution') {
        const weights =
          contributionMode === 'lastTarget' ? lastRebalanceAllocation : weightsOf(balances)
        distributeContribution(balances, amount, weights)
        cumulativeContributed += amount
        costBasis += amount
      } else {
        const { netPaid, taxPaid, newCostBasis } = withdrawWithTax(
          balances,
          amount,
          costBasis,
          feesAndTax,
        )
        cumulativeWithdrawn += netPaid
        cumulativeTaxPaid += taxPaid
        costBasis = newCostBasis
        if (netPaid < amount - 1e-6) everDepleted = true
      }
    }

    snapshots.push({
      date: month.date,
      monthOffset: offset,
      totalValue: totalOf(balances),
      byAsset: { ...balances },
      cumulativeContributed,
      cumulativeWithdrawn,
      cumulativeFeesPaid,
      cumulativeTaxPaid,
      cpiIndex: month.cpiIndex,
      depleted: everDepleted,
    })
  }

  return {
    strategyId,
    startDate: months[0].date,
    endDate: snapshots[snapshots.length - 1].date,
    snapshots,
  }
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

  const months = marketData.months.slice(startIndex, endIndex + 1)
  return runStrategyOverMonths(strategy, months, strategy.id)
}
