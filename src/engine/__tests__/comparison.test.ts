import { describe, expect, it } from 'vitest'
import { comparisonEntryFromAggregate, comparisonEntryFromSingle } from '../comparison'
import { buildSyntheticMarketData } from '../fixtures/syntheticMarketData'
import { simulateRolling } from '../rollingBacktest'
import { simulateSingleRun } from '../simulate'
import { computeStats } from '../stats'
import type { Strategy } from '../types'

const market = buildSyntheticMarketData()
const startDate = market.months[0].date

function baseStrategy(overrides: Partial<Strategy>): Strategy {
  return {
    id: 'test',
    name: 'test',
    initialPortfolio: { startValue: 10_000, allocation: { stocks: 0.5, bonds: 0, cash: 0.5 } },
    durationMonths: 24,
    rules: [],
    ...overrides,
  }
}

describe('comparisonEntryFromSingle', () => {
  it('carries the given name and mode', () => {
    const strategy = baseStrategy({})
    const result = simulateSingleRun(strategy, market, startDate)
    const entry = comparisonEntryFromSingle('id-1', 'My strategy', result)
    expect(entry.id).toBe('id-1')
    expect(entry.name).toBe('My strategy')
    expect(entry.mode).toBe('single')
  })

  it('summary matches computeStats for the same result', () => {
    const strategy = baseStrategy({})
    const result = simulateSingleRun(strategy, market, startDate)
    const stats = computeStats(result)
    const entry = comparisonEntryFromSingle('id-1', 'x', result)
    expect(entry.summary.endingValueNominal).toBeCloseTo(stats.endingValueNominal, 6)
    expect(entry.summary.endingValueReal).toBeCloseTo(stats.endingValueReal, 6)
    expect(entry.summary.cagrReal).toBeCloseTo(stats.cagrReal, 6)
    expect(entry.summary.maxDrawdown).toBeCloseTo(stats.maxDrawdown, 6)
    expect(entry.summary.successRate).toBeUndefined()
  })

  it('produces one series point per snapshot, tracking totalValue', () => {
    const strategy = baseStrategy({ durationMonths: 6 })
    const result = simulateSingleRun(strategy, market, startDate)
    const entry = comparisonEntryFromSingle('id-1', 'x', result)
    expect(entry.series).toHaveLength(result.snapshots.length)
    expect(entry.series[0].monthOffset).toBe(0)
    expect(entry.series[0].nominal).toBeCloseTo(10_000, 6)
    const last = entry.series[entry.series.length - 1]
    expect(last.nominal).toBeCloseTo(result.snapshots[result.snapshots.length - 1].totalValue, 6)
  })
})

describe('comparisonEntryFromAggregate', () => {
  it('carries the given name/mode and pulls median + success rate', () => {
    const strategy = baseStrategy({})
    const rolling = simulateRolling(strategy, market, { stepMonths: 6 })
    const entry = comparisonEntryFromAggregate('id-2', 'Rolling test', 'rolling', rolling)

    expect(entry.mode).toBe('rolling')
    expect(entry.summary.successRate).toBe(rolling.successRate)
    expect(entry.summary.endingValueNominal).toBe(rolling.endingValuePercentiles[50])
    expect(entry.summary.endingValueReal).toBe(rolling.endingValuePercentilesReal[50])
    expect(entry.summary.cagrReal).toBeUndefined()
    expect(entry.summary.maxDrawdown).toBeUndefined()
  })

  it('produces one series point per band, tracking the median value', () => {
    const strategy = baseStrategy({})
    const rolling = simulateRolling(strategy, market, { stepMonths: 6 })
    const entry = comparisonEntryFromAggregate('id-2', 'x', 'rolling', rolling)

    expect(entry.series).toHaveLength(rolling.bands.length)
    entry.series.forEach((point, i) => {
      expect(point.monthOffset).toBe(rolling.bands[i].monthOffset)
      expect(point.nominal).toBe(rolling.bands[i].values[50])
      expect(point.real).toBe(rolling.bandsReal[i].values[50])
    })
  })
})
