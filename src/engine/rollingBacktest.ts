import { bandsOf, percentilesOf, type PercentileBand } from './percentiles'
import { simulateSingleRun } from './simulate'
import { computeStats, toRealSnapshots } from './stats'
import type { MarketData, Strategy } from './types'

export type { PercentileBand }

export interface RollingRunSummary {
  startDate: string
  endingValueNominal: number
  endingValueReal: number
  succeeded: boolean
}

export interface RollingBacktestResult {
  strategyId: string
  runs: RollingRunSummary[]
  successRate: number
  endingValuePercentiles: Record<number, number>
  bands: PercentileBand[]
  /** Same as `endingValuePercentiles`/`bands`, but each run deflated to
   * that run's own starting purchasing power first - "today's money"
   * from the perspective of whenever that run started. */
  endingValuePercentilesReal: Record<number, number>
  bandsReal: PercentileBand[]
}

export interface RollingBacktestOptions {
  /** Gap in months between successive rolling start dates. */
  stepMonths?: number
  /** Percentiles (0-100) to report, both for ending value and bands. */
  percentiles?: number[]
  onProgress?: (done: number, total: number) => void
}

const DEFAULT_PERCENTILES = [10, 25, 50, 75, 90]

export function simulateRolling(
  strategy: Strategy,
  marketData: MarketData,
  options: RollingBacktestOptions = {},
): RollingBacktestResult {
  const stepMonths = options.stepMonths ?? 12
  const percentiles = options.percentiles ?? DEFAULT_PERCENTILES

  const lastValidStart = marketData.months.length - 1 - strategy.durationMonths
  const startIndices: number[] = []
  for (let i = 0; i <= lastValidStart; i += stepMonths) {
    startIndices.push(i)
  }

  const runs: RollingRunSummary[] = []
  // valuesByOffset[offset] collects totalValue across every run, for
  // per-offset percentile bands. The *Real variant collects each run's
  // own snapshots deflated to that run's own starting purchasing power
  // first, so "year 20" always means "20 years into whichever run", not
  // a shared calendar CPI base across runs with different start dates.
  const valuesByOffset: number[][] = Array.from(
    { length: strategy.durationMonths + 1 },
    () => [],
  )
  const valuesByOffsetReal: number[][] = Array.from(
    { length: strategy.durationMonths + 1 },
    () => [],
  )

  startIndices.forEach((startIndex, i) => {
    const startDate = marketData.months[startIndex].date
    const result = simulateSingleRun(strategy, marketData, startDate)
    const stats = computeStats(result)
    runs.push({
      startDate,
      endingValueNominal: stats.endingValueNominal,
      endingValueReal: stats.endingValueReal,
      succeeded: stats.succeeded,
    })
    result.snapshots.forEach((snap) => {
      valuesByOffset[snap.monthOffset].push(snap.totalValue)
    })
    toRealSnapshots(result.snapshots).forEach((snap) => {
      valuesByOffsetReal[snap.monthOffset].push(snap.totalValue)
    })
    options.onProgress?.(i + 1, startIndices.length)
  })

  const successRate = runs.length ? runs.filter((r) => r.succeeded).length / runs.length : 0

  return {
    strategyId: strategy.id,
    runs,
    successRate,
    endingValuePercentiles: percentilesOf(runs.map((r) => r.endingValueNominal), percentiles),
    bands: bandsOf(valuesByOffset, percentiles),
    endingValuePercentilesReal: percentilesOf(runs.map((r) => r.endingValueReal), percentiles),
    bandsReal: bandsOf(valuesByOffsetReal, percentiles),
  }
}
