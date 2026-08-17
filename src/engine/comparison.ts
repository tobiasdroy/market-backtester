import type { PercentileBand } from './percentiles'
import { computeStats, toRealSnapshots } from './stats'
import type { SimulationResult } from './types'

export type ComparisonMode = 'single' | 'rolling' | 'monteCarlo'

export interface ComparisonSeriesPoint {
  monthOffset: number
  nominal: number
  real: number
}

export interface ComparisonSummary {
  endingValueNominal: number
  endingValueReal: number
  /** Single-run only. */
  cagrReal?: number
  maxDrawdown?: number
  /** Rolling/Monte Carlo only - fraction of runs that never depleted. */
  successRate?: number
}

export interface ComparisonEntry {
  id: string
  name: string
  mode: ComparisonMode
  summary: ComparisonSummary
  /** Median (aggregate modes) or actual (single mode) portfolio value by
   * month offset, in both nominal and "today's money" terms - what the
   * overlay chart plots. */
  series: ComparisonSeriesPoint[]
}

/** Rolling and Monte Carlo results share this shape (see
 * rollingBacktest.ts / monteCarlo.ts) - a comparison entry only needs the
 * aggregate fields, not the full per-run breakdown. */
export interface AggregateResultLike {
  successRate: number
  endingValuePercentiles: Record<number, number>
  endingValuePercentilesReal: Record<number, number>
  bands: PercentileBand[]
  bandsReal: PercentileBand[]
}

export function comparisonEntryFromSingle(
  id: string,
  name: string,
  result: SimulationResult,
): ComparisonEntry {
  const stats = computeStats(result)
  const realSnapshots = toRealSnapshots(result.snapshots)
  return {
    id,
    name,
    mode: 'single',
    summary: {
      endingValueNominal: stats.endingValueNominal,
      endingValueReal: stats.endingValueReal,
      cagrReal: stats.cagrReal,
      maxDrawdown: stats.maxDrawdown,
    },
    series: result.snapshots.map((s, i) => ({
      monthOffset: s.monthOffset,
      nominal: s.totalValue,
      real: realSnapshots[i].totalValue,
    })),
  }
}

export function comparisonEntryFromAggregate(
  id: string,
  name: string,
  mode: 'rolling' | 'monteCarlo',
  aggregate: AggregateResultLike,
): ComparisonEntry {
  return {
    id,
    name,
    mode,
    summary: {
      endingValueNominal: aggregate.endingValuePercentiles[50] ?? 0,
      endingValueReal: aggregate.endingValuePercentilesReal[50] ?? 0,
      successRate: aggregate.successRate,
    },
    series: aggregate.bands.map((band, i) => ({
      monthOffset: band.monthOffset,
      nominal: band.values[50] ?? 0,
      real: aggregate.bandsReal[i]?.values[50] ?? 0,
    })),
  }
}
