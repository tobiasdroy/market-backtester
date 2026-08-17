import { bandsOf, percentilesOf, type PercentileBand } from './percentiles'
import { mulberry32 } from './randomSource'
import { runStrategyOverMonths } from './simulate'
import { computeStats, toRealSnapshots } from './stats'
import type { AssetClass, MarketData, MarketMonth, Strategy } from './types'

export interface MonteCarloResult {
  strategyId: string
  runs: number
  successRate: number
  endingValuePercentiles: Record<number, number>
  bands: PercentileBand[]
  endingValuePercentilesReal: Record<number, number>
  bandsReal: PercentileBand[]
}

export interface MonteCarloOptions {
  /** Number of synthetic paths to simulate. */
  runs?: number
  /** Length (months) of each contiguous historical block resampled with
   * replacement to build a synthetic path. Longer blocks preserve more
   * real serial correlation/momentum at the cost of path diversity;
   * shorter blocks (down to 1) approach an IID monthly bootstrap. */
  blockSizeMonths?: number
  /** Seed for reproducible runs. Omit for a fresh random seed each call. */
  seed?: number
  percentiles?: number[]
  onProgress?: (done: number, total: number) => void
}

const DEFAULT_PERCENTILES = [10, 25, 50, 75, 90]
const DEFAULT_RUNS = 500
const DEFAULT_BLOCK_SIZE_MONTHS = 24

/** Builds one synthetic `durationMonths`-long path by concatenating
 * randomly-chosen contiguous historical blocks (with replacement). Each
 * block's asset returns AND that same period's inflation rate are taken
 * from the same source months together, preserving the real cross-asset
 * correlation within a block (a historical crash still hits stocks/bonds
 * together, inflation still co-moves with the era it came from) - a
 * pure independent-monthly bootstrap would destroy that.
 *
 * CPI needs special handling: source months store an absolute cpiIndex
 * *level*, but stitching levels from different eras together directly
 * would create nonsense inflation jumps at block boundaries. Instead the
 * month-to-month inflation *rate* is resampled (like returns already
 * are) and a fresh synthetic index is compounded forward from 100. */
function buildBootstrapPath(
  marketData: MarketData,
  durationMonths: number,
  blockSizeMonths: number,
  rng: () => number,
): MarketMonth[] {
  const source = marketData.months
  const maxBlockStart = source.length - 1 - blockSizeMonths
  if (maxBlockStart < 0) {
    throw new Error('not enough market data for the requested block size')
  }

  const resampledReturns: Record<AssetClass, number>[] = []
  const resampledInflationRates: number[] = []

  while (resampledReturns.length < durationMonths) {
    const blockStart = Math.floor(rng() * (maxBlockStart + 1))
    for (let k = 1; k <= blockSizeMonths && resampledReturns.length < durationMonths; k++) {
      const idx = blockStart + k
      resampledReturns.push(source[idx].monthlyReturn)
      resampledInflationRates.push(source[idx].cpiIndex / source[idx - 1].cpiIndex - 1)
    }
  }

  let cpi = 100
  const path: MarketMonth[] = [
    { date: 'synthetic-0000-00', monthlyReturn: { stocks: 0, bonds: 0, cash: 0 }, cpiIndex: cpi },
  ]
  for (let i = 0; i < durationMonths; i++) {
    cpi *= 1 + resampledInflationRates[i]
    path.push({
      date: `synthetic-${String(i + 1).padStart(6, '0')}`,
      monthlyReturn: resampledReturns[i],
      cpiIndex: cpi,
    })
  }
  return path
}

export function simulateMonteCarlo(
  strategy: Strategy,
  marketData: MarketData,
  options: MonteCarloOptions = {},
): MonteCarloResult {
  const runs = options.runs ?? DEFAULT_RUNS
  const blockSizeMonths = options.blockSizeMonths ?? DEFAULT_BLOCK_SIZE_MONTHS
  const percentiles = options.percentiles ?? DEFAULT_PERCENTILES
  const rng = mulberry32(options.seed ?? Date.now())

  const valuesByOffset: number[][] = Array.from(
    { length: strategy.durationMonths + 1 },
    () => [],
  )
  const valuesByOffsetReal: number[][] = Array.from(
    { length: strategy.durationMonths + 1 },
    () => [],
  )
  const endingValuesNominal: number[] = []
  const endingValuesReal: number[] = []
  let successes = 0

  for (let i = 0; i < runs; i++) {
    const path = buildBootstrapPath(marketData, strategy.durationMonths, blockSizeMonths, rng)
    const result = runStrategyOverMonths(strategy, path, strategy.id)
    const stats = computeStats(result)

    endingValuesNominal.push(stats.endingValueNominal)
    endingValuesReal.push(stats.endingValueReal)
    if (stats.succeeded) successes++

    result.snapshots.forEach((snap) => {
      valuesByOffset[snap.monthOffset].push(snap.totalValue)
    })
    toRealSnapshots(result.snapshots).forEach((snap) => {
      valuesByOffsetReal[snap.monthOffset].push(snap.totalValue)
    })

    options.onProgress?.(i + 1, runs)
  }

  return {
    strategyId: strategy.id,
    runs,
    successRate: runs > 0 ? successes / runs : 0,
    endingValuePercentiles: percentilesOf(endingValuesNominal, percentiles),
    bands: bandsOf(valuesByOffset, percentiles),
    endingValuePercentilesReal: percentilesOf(endingValuesReal, percentiles),
    bandsReal: bandsOf(valuesByOffsetReal, percentiles),
  }
}
