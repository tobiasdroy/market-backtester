import { describe, expect, it } from 'vitest'
import { buildSyntheticMarketData, SYNTHETIC_ANNUAL_RATES } from '../fixtures/syntheticMarketData'
import { simulateSingleRun } from '../simulate'
import { computeDrawdownSeries, computeStats, toRealSnapshots } from '../stats'
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

describe('computeDrawdownSeries', () => {
  it('is zero while the portfolio only ever rises', () => {
    const strategy: Strategy = {
      id: 't',
      name: 't',
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
      durationMonths: 24,
      rules: [],
    }
    const result = simulateSingleRun(strategy, market, startDate)
    const series = computeDrawdownSeries(result.snapshots)
    expect(series.every((p) => p.drawdown === 0)).toBe(true)
  })

  it('tracks decline from the running peak, then recovers to zero once a new peak is set', () => {
    // Two down months then a big up month, using a hand-built snapshot list
    // rather than the engine, to pin down the drawdown formula itself.
    const snapshots = [
      { totalValue: 100 },
      { totalValue: 90 }, // -10% from peak 100
      { totalValue: 80 }, // -20% from peak 100
      { totalValue: 120 }, // new peak -> 0
    ].map((s, i) => ({
      date: `2000-0${i + 1}-01`,
      monthOffset: i,
      totalValue: s.totalValue,
      byAsset: { stocks: s.totalValue, bonds: 0, cash: 0 },
      cumulativeContributed: 100,
      cumulativeWithdrawn: 0,
      cumulativeFeesPaid: 0,
      cumulativeTaxPaid: 0,
      cpiIndex: 100,
      depleted: false,
    }))
    const series = computeDrawdownSeries(snapshots)
    const expected = [0, -0.1, -0.2, 0]
    series.forEach((p, i) => expect(p.drawdown).toBeCloseTo(expected[i], 9))
  })
})

describe('toRealSnapshots', () => {
  it('leaves the first snapshot unchanged and deflates later ones by CPI growth', () => {
    const strategy: Strategy = {
      id: 't',
      name: 't',
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
      durationMonths: 24,
      rules: [],
    }
    const result = simulateSingleRun(strategy, market, startDate)
    const real = toRealSnapshots(result.snapshots)

    expect(real[0].totalValue).toBeCloseTo(result.snapshots[0].totalValue, 6)

    const last = result.snapshots[result.snapshots.length - 1]
    const lastReal = real[real.length - 1]
    const expectedDeflator = result.snapshots[0].cpiIndex / last.cpiIndex
    expect(lastReal.totalValue).toBeCloseTo(last.totalValue * expectedDeflator, 6)
    expect(lastReal.byAsset.stocks).toBeCloseTo(last.byAsset.stocks * expectedDeflator, 6)
    expect(lastReal.cumulativeContributed).toBeCloseTo(
      last.cumulativeContributed * expectedDeflator,
      6,
    )
  })

  it('matches endingValueReal from computeStats at the final snapshot', () => {
    const strategy: Strategy = {
      id: 't',
      name: 't',
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 0.6, bonds: 0.4, cash: 0 } },
      durationMonths: 36,
      rules: [
        {
          id: 'c',
          type: 'contribution',
          startOffset: { months: 0 },
          amount: 500,
          frequency: 'monthly',
          inflationAdjusted: true,
        },
      ],
    }
    const result = simulateSingleRun(strategy, market, startDate)
    const stats = computeStats(result)
    const real = toRealSnapshots(result.snapshots)
    expect(real[real.length - 1].totalValue).toBeCloseTo(stats.endingValueReal, 6)
  })
})
