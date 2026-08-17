import type { PortfolioSnapshot, SimulationResult } from './types'

export interface SimulationStats {
  endingValueNominal: number
  endingValueReal: number
  totalContributed: number
  totalWithdrawn: number
  /** Annualized time-weighted return (the portfolio's own investment
   * performance, independent of cash-flow timing/size). */
  cagrNominal: number
  cagrReal: number
  /** Annualized standard deviation of monthly time-weighted returns. */
  volatility: number
  maxDrawdown: number
  /** False if any withdrawal in the run could not be fully paid. */
  succeeded: boolean
}

/** Per-month time-weighted return, backed out from snapshot deltas:
 * the value just before this month's cash flow, divided by last month's
 * end value. Since simulate.ts applies returns before flows each month,
 * `snapshot.totalValue - netFlow` is exactly that pre-flow value. */
function monthlyTimeWeightedReturns(snapshots: PortfolioSnapshot[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const cur = snapshots[i]
    const netFlow =
      cur.cumulativeContributed -
      prev.cumulativeContributed -
      (cur.cumulativeWithdrawn - prev.cumulativeWithdrawn)
    const valueBeforeFlow = cur.totalValue - netFlow
    const denominator = prev.totalValue
    returns.push(denominator > 0 ? valueBeforeFlow / denominator - 1 : 0)
  }
  return returns
}

function annualize(totalReturn: number, months: number): number {
  if (months <= 0) return 0
  return (1 + totalReturn) ** (12 / months) - 1
}

function maxDrawdown(values: number[]): number {
  let peak = values[0] ?? 0
  let worst = 0
  for (const v of values) {
    if (v > peak) peak = v
    if (peak > 0) worst = Math.min(worst, v / peak - 1)
  }
  return worst
}

export function computeStats(result: SimulationResult): SimulationStats {
  const { snapshots } = result
  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]
  const months = last.monthOffset - first.monthOffset

  const monthlyReturns = monthlyTimeWeightedReturns(snapshots)
  const twrTotal = monthlyReturns.reduce((acc, r) => acc * (1 + r), 1) - 1
  const cagrNominal = annualize(twrTotal, months)

  const inflationTotal = last.cpiIndex / first.cpiIndex - 1
  const cagrInflation = annualize(inflationTotal, months)
  const cagrReal = (1 + cagrNominal) / (1 + cagrInflation) - 1

  const mean = monthlyReturns.reduce((a, b) => a + b, 0) / (monthlyReturns.length || 1)
  const variance =
    monthlyReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / (monthlyReturns.length || 1)
  const volatility = Math.sqrt(variance) * Math.sqrt(12)

  return {
    endingValueNominal: last.totalValue,
    endingValueReal: last.totalValue * (first.cpiIndex / last.cpiIndex),
    totalContributed: last.cumulativeContributed,
    totalWithdrawn: last.cumulativeWithdrawn,
    cagrNominal,
    cagrReal,
    volatility,
    maxDrawdown: maxDrawdown(snapshots.map((s) => s.totalValue)),
    succeeded: !last.depleted,
  }
}
