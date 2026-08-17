import { describe, expect, it } from 'vitest'
import { buildSyntheticMarketData, SYNTHETIC_ANNUAL_RATES } from '../fixtures/syntheticMarketData'
import { simulateSingleRun } from '../simulate'
import { computeStats } from '../stats'
import type { Strategy } from '../types'

const market = buildSyntheticMarketData(200)
const startDate = market.months[0].date

describe('computeStats', () => {
  it('recovers the exact annual growth rate for a no-flow, single-asset run', () => {
    const strategy: Strategy = {
      id: 't',
      name: 't',
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
      durationMonths: 60,
      rules: [],
    }
    const result = simulateSingleRun(strategy, market, startDate)
    const stats = computeStats(result)

    expect(stats.cagrNominal).toBeCloseTo(SYNTHETIC_ANNUAL_RATES.stocks, 6)
    expect(stats.cagrReal).toBeCloseTo(
      (1 + SYNTHETIC_ANNUAL_RATES.stocks) / (1 + SYNTHETIC_ANNUAL_RATES.inflation) - 1,
      6,
    )
    expect(stats.endingValueNominal).toBeCloseTo(
      10_000 * (1 + SYNTHETIC_ANNUAL_RATES.stocks) ** 5,
      2,
    )
    expect(stats.volatility).toBeCloseTo(0, 9) // constant returns -> zero volatility
    expect(stats.maxDrawdown).toBeCloseTo(0, 9) // monotonically growing -> no drawdown
    expect(stats.succeeded).toBe(true)
  })

  it('time-weighted CAGR ignores contribution timing/size (unlike a naive value ratio)', () => {
    const noContrib: Strategy = {
      id: 'a',
      name: 'a',
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
      durationMonths: 24,
      rules: [],
    }
    const withContrib: Strategy = {
      ...noContrib,
      id: 'b',
      rules: [
        {
          id: 'c',
          type: 'contribution',
          startOffset: { months: 0 },
          amount: 50_000,
          frequency: 'monthly',
          inflationAdjusted: false,
        },
      ],
    }
    const statsA = computeStats(simulateSingleRun(noContrib, market, startDate))
    const statsB = computeStats(simulateSingleRun(withContrib, market, startDate))

    // Ending values differ hugely (contributions dwarf the initial stake)...
    expect(statsB.endingValueNominal).toBeGreaterThan(statsA.endingValueNominal * 10)
    // ...but the underlying investment performance (TWR) is identical.
    expect(statsB.cagrNominal).toBeCloseTo(statsA.cagrNominal, 6)
  })

  it('reports succeeded=false when a run depletes', () => {
    const strategy: Strategy = {
      id: 't',
      name: 't',
      initialPortfolio: { startValue: 100, allocation: { stocks: 1, bonds: 0, cash: 0 } },
      durationMonths: 12,
      rules: [
        {
          id: 'w',
          type: 'withdrawal',
          startOffset: { months: 0 },
          amount: 1000,
          frequency: 'monthly',
          inflationAdjusted: false,
        },
      ],
    }
    const stats = computeStats(simulateSingleRun(strategy, market, startDate))
    expect(stats.succeeded).toBe(false)
  })
})
