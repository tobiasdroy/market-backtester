import type { PortfolioSnapshot, SimulationResult } from './types'

export interface SimulationStats {
  endingValueNominal: number
  endingValueReal: number
  totalContributed: number
  totalWithdrawn: number
  totalFeesPaid: number
  totalTaxPaid: number
  /** Annualized time-weighted return (the portfolio's own investment
   * performance, independent of cash-flow timing/size). Fee drag is
   * folded in (it's a genuine performance cost); tax on withdrawals is
   * excluded (it's a cash outflow, not a market-return effect). */
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
 * end value. Since simulate.ts applies returns (and fee drag) before
 * flows each month, `snapshot.totalValue - netFlow` is exactly that
 * pre-flow value. Tax paid counts as an outflow here alongside
 * withdrawals (money leaving the account to HMRC, not a market-return
 * effect), while fee drag is deliberately left out of netFlow so it
 * stays folded into the return itself. */
function monthlyTimeWeightedReturns(snapshots: PortfolioSnapshot[]): number[] {
  const returns: number[] = []
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1]
    const cur = snapshots[i]
    const netFlow =
      cur.cumulativeContributed -
      prev.cumulativeContributed -
      (cur.cumulativeWithdrawn - prev.cumulativeWithdrawn) -
      (cur.cumulativeTaxPaid - prev.cumulativeTaxPaid)
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

/** Deflates every monetary field in a snapshot series to the purchasing
 * power of the simulation's start date ("today's money"), using each
 * snapshot's own CPI relative to the first snapshot's. Chart components
 * take either this or the raw snapshots depending on a nominal/real
 * toggle - `date`/`monthOffset`/`cpiIndex`/`depleted` pass through
 * unchanged since they aren't monetary. */
export function toRealSnapshots(snapshots: PortfolioSnapshot[]): PortfolioSnapshot[] {
  const startCpi = snapshots[0]?.cpiIndex ?? 1
  return snapshots.map((s) => {
    const deflator = startCpi / s.cpiIndex
    return {
      ...s,
      totalValue: s.totalValue * deflator,
      byAsset: {
        stocks: s.byAsset.stocks * deflator,
        bonds: s.byAsset.bonds * deflator,
        cash: s.byAsset.cash * deflator,
      },
      cumulativeContributed: s.cumulativeContributed * deflator,
      cumulativeWithdrawn: s.cumulativeWithdrawn * deflator,
      cumulativeFeesPaid: s.cumulativeFeesPaid * deflator,
      cumulativeTaxPaid: s.cumulativeTaxPaid * deflator,
    }
  })
}

export interface DrawdownPoint {
  date: string
  monthOffset: number
  drawdown: number
}

/** Portfolio value's decline from its running peak at each month, as a
 * fraction (0 to -1). Note this is computed on raw totalValue, so a large
 * withdrawal reads as part of the drawdown alongside genuine market
 * declines - a known simplification, documented for the results view. */
export function computeDrawdownSeries(snapshots: PortfolioSnapshot[]): DrawdownPoint[] {
  let peak = snapshots[0]?.totalValue ?? 0
  return snapshots.map((s) => {
    if (s.totalValue > peak) peak = s.totalValue
    const drawdown = peak > 0 ? Math.min(0, s.totalValue / peak - 1) : 0
    return { date: s.date, monthOffset: s.monthOffset, drawdown }
  })
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
    totalFeesPaid: last.cumulativeFeesPaid,
    totalTaxPaid: last.cumulativeTaxPaid,
    cagrNominal,
    cagrReal,
    volatility,
    maxDrawdown: Math.min(0, ...computeDrawdownSeries(snapshots).map((p) => p.drawdown)),
    succeeded: !last.depleted,
  }
}
