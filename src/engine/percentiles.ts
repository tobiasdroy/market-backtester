/** Percentile values of some quantity at each month offset - the data a
 * fan chart needs. Shared shape between rollingBacktest.ts (percentiles
 * across historical start dates) and monteCarlo.ts (percentiles across
 * bootstrap-resampled paths). */
export interface PercentileBand {
  monthOffset: number
  values: Record<number, number>
}

export function percentileOf(sortedValues: number[], p: number): number {
  const idx = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
  )
  return sortedValues[idx]
}

export function percentilesOf(values: number[], percentiles: number[]): Record<number, number> {
  const sorted = [...values].sort((a, b) => a - b)
  return Object.fromEntries(percentiles.map((p) => [p, percentileOf(sorted, p)]))
}

export function bandsOf(byOffset: number[][], percentiles: number[]): PercentileBand[] {
  return byOffset.map((values, monthOffset) => ({
    monthOffset,
    values: percentilesOf(values, percentiles),
  }))
}
