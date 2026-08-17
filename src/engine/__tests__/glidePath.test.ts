import { describe, expect, it } from 'vitest'
import { buildSyntheticMarketData } from '../fixtures/syntheticMarketData'
import { simulateSingleRun } from '../simulate'
import type { GlidePathRule, Strategy } from '../types'

const market = buildSyntheticMarketData()
const startDate = market.months[0].date

function ratio(snap: { byAsset: { stocks: number; bonds: number }; totalValue: number }) {
  return { stocks: snap.byAsset.stocks / snap.totalValue, bonds: snap.byAsset.bonds / snap.totalValue }
}

describe('glide path rule', () => {
  const glideRule: GlidePathRule = {
    id: 'g1',
    type: 'glidePath',
    startOffset: { months: 60 },
    endOffset: { months: 180 },
    startAllocation: { stocks: 0.5, bonds: 0.5, cash: 0 },
    endAllocation: { stocks: 0.2, bonds: 0.8, cash: 0 },
  }

  function baseStrategy(overrides: Partial<Strategy> = {}): Strategy {
    return {
      id: 'test',
      name: 'test',
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 0.5, bonds: 0.5, cash: 0 } },
      durationMonths: 180,
      rules: [glideRule],
      ...overrides,
    }
  }

  it('is at exactly the start allocation the month the range begins', () => {
    const result = simulateSingleRun(baseStrategy(), market, startDate)
    const r = ratio(result.snapshots[60])
    expect(r.stocks).toBeCloseTo(0.5, 6)
    expect(r.bonds).toBeCloseTo(0.5, 6)
  })

  it('is at exactly the end allocation the month the range ends', () => {
    const result = simulateSingleRun(baseStrategy(), market, startDate)
    const last = result.snapshots[result.snapshots.length - 1]
    expect(last.monthOffset).toBe(180)
    const r = ratio(last)
    expect(r.stocks).toBeCloseTo(0.2, 6)
    expect(r.bonds).toBeCloseTo(0.8, 6)
  })

  it('is exactly the linear midpoint halfway through the range', () => {
    const result = simulateSingleRun(baseStrategy(), market, startDate)
    const r = ratio(result.snapshots[120])
    expect(r.stocks).toBeCloseTo(0.35, 6)
    expect(r.bonds).toBeCloseTo(0.65, 6)
  })

  it('does not force the allocation before the range starts (returns drift it away from 50/50)', () => {
    const result = simulateSingleRun(baseStrategy(), market, startDate)
    const r = ratio(result.snapshots[59])
    // Stocks (5%/yr) outgrow bonds (3%/yr) in this synthetic market, so
    // 59 months of undisturbed drift should have pulled the stock weight
    // measurably above the untouched 50%.
    expect(r.stocks).toBeGreaterThan(0.51)
  })

  it('stops forcing the allocation after the range ends (drifts away from the end mix again)', () => {
    const result = simulateSingleRun(baseStrategy({ durationMonths: 200 }), market, startDate)
    const atEnd = ratio(result.snapshots[180])
    const after = ratio(result.snapshots[200])
    expect(atEnd.stocks).toBeCloseTo(0.2, 6)
    expect(after.stocks).toBeGreaterThan(atEnd.stocks)
  })

  it('a zero-length range jumps straight to the end allocation, like a one-off rebalance', () => {
    const instant: GlidePathRule = {
      ...glideRule,
      startOffset: { months: 60 },
      endOffset: { months: 60 },
    }
    const result = simulateSingleRun(baseStrategy({ rules: [instant] }), market, startDate)
    const r = ratio(result.snapshots[60])
    expect(r.stocks).toBeCloseTo(0.2, 6)
    expect(r.bonds).toBeCloseTo(0.8, 6)
  })
})
