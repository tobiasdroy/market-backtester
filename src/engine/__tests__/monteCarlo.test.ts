import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { alignMarketData } from '../dataLoader'
import { buildSyntheticMarketData, SYNTHETIC_ANNUAL_RATES } from '../fixtures/syntheticMarketData'
import { simulateMonteCarlo } from '../monteCarlo'
import type { MarketDataRaw, Strategy } from '../types'

const market = buildSyntheticMarketData(600)

const strategy: Strategy = {
  id: 't',
  name: 't',
  initialPortfolio: { startValue: 10_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
  durationMonths: 120,
  rules: [],
}

describe('simulateMonteCarlo', () => {
  it('every path has an identical ending value under constant synthetic returns', () => {
    // With zero variance in the underlying data, resampling can't
    // introduce any spread - a strong correctness check independent of
    // the randomness itself.
    const result = simulateMonteCarlo(strategy, market, { runs: 20, seed: 1 })
    const expected = 10_000 * (1 + SYNTHETIC_ANNUAL_RATES.stocks) ** 10
    expect(result.endingValuePercentiles[10]).toBeCloseTo(expected, 2)
    expect(result.endingValuePercentiles[90]).toBeCloseTo(expected, 2)
  })

  it('is deterministic for a given seed', () => {
    const a = simulateMonteCarlo(strategy, market, { runs: 30, seed: 42 })
    const b = simulateMonteCarlo(strategy, market, { runs: 30, seed: 42 })
    expect(a.endingValuePercentiles).toEqual(b.endingValuePercentiles)
    expect(a.bands).toEqual(b.bands)
  })

  it('reports the requested run count and one band per month offset', () => {
    const result = simulateMonteCarlo(strategy, market, { runs: 15, seed: 1 })
    expect(result.runs).toBe(15)
    expect(result.bands).toHaveLength(strategy.durationMonths + 1)
    expect(result.bands[0].monthOffset).toBe(0)
    expect(result.bands[result.bands.length - 1].monthOffset).toBe(strategy.durationMonths)
  })

  it('reports 100% success when no withdrawal can ever deplete the portfolio', () => {
    const result = simulateMonteCarlo(strategy, market, { runs: 20, seed: 1 })
    expect(result.successRate).toBe(1)
  })

  it('reports 0% success for a guaranteed-depleting withdrawal strategy', () => {
    const depleting: Strategy = {
      ...strategy,
      durationMonths: 24,
      rules: [
        {
          id: 'w',
          type: 'withdrawal',
          startOffset: { months: 0 },
          amount: 100_000,
          frequency: 'monthly',
          inflationAdjusted: false,
        },
      ],
    }
    const result = simulateMonteCarlo(depleting, market, { runs: 20, seed: 1 })
    expect(result.successRate).toBe(0)
  })

  it('reports onProgress callbacks totalling the requested run count', () => {
    const calls: [number, number][] = []
    simulateMonteCarlo(strategy, market, {
      runs: 10,
      seed: 1,
      onProgress: (done, total) => calls.push([done, total]),
    })
    expect(calls).toHaveLength(10)
    expect(calls[calls.length - 1]).toEqual([10, 10])
  })

  it('throws when the block size exceeds the available market data', () => {
    expect(() =>
      simulateMonteCarlo(strategy, market, { blockSizeMonths: market.months.length + 10 }),
    ).toThrow()
  })
})

describe('simulateMonteCarlo against real historical data', () => {
  it('produces genuine spread across paths (bootstrap resampling is actually resampling)', () => {
    const dataDir = resolve(__dirname, '../../../public/data')
    const read = (file: string) => JSON.parse(readFileSync(resolve(dataDir, file), 'utf-8'))
    const raw: MarketDataRaw = {
      stocks: read('stocks.json'),
      bonds: read('bonds.json'),
      cash: read('cash.json'),
      inflation: read('inflation.json'),
    }
    const realMarket = alignMarketData(raw)
    const result = simulateMonteCarlo(strategy, realMarket, { runs: 200, seed: 7 })

    // Real returns have genuine variance, so 200 resampled 10-year paths
    // should not all land on the same ending value.
    expect(result.endingValuePercentiles[90]).toBeGreaterThan(
      result.endingValuePercentiles[10] * 1.2,
    )
    // Every band's percentiles should be non-decreasing (10th <= 50th <= 90th).
    for (const band of result.bands) {
      expect(band.values[10]).toBeLessThanOrEqual(band.values[50])
      expect(band.values[50]).toBeLessThanOrEqual(band.values[90])
    }
  })
})
