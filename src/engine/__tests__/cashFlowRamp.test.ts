import { describe, expect, it } from 'vitest'
import { buildSyntheticMarketData } from '../fixtures/syntheticMarketData'
import { simulateSingleRun } from '../simulate'
import type { CashFlowRule, Strategy } from '../types'

const market = buildSyntheticMarketData()
const startDate = market.months[0].date

function baseStrategy(rules: CashFlowRule[], durationMonths = 240): Strategy {
  return {
    id: 'test',
    name: 'test',
    initialPortfolio: { startValue: 100_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
    durationMonths,
    rules,
  }
}

describe('ramping contribution/withdrawal amounts', () => {
  it('fires exactly the linear midpoint amount halfway through the ramp', () => {
    // cumulativeContributed tracks the fired amount directly (independent
    // of market returns), so its deltas read off the ramp exactly.
    const monthly: CashFlowRule = {
      id: 'c2',
      type: 'contribution',
      startOffset: { months: 0 },
      amount: 1000,
      endAmount: 2000,
      rampEndOffset: { months: 100 },
      frequency: 'monthly',
      inflationAdjusted: false,
    }
    const result = simulateSingleRun(baseStrategy([monthly]), market, startDate)
    const contributedAt = (offset: number) => result.snapshots[offset].cumulativeContributed

    // Amount fired at offset 1 (first monthly firing): progress 1/100, so 1010.
    expect(contributedAt(1) - contributedAt(0)).toBeCloseTo(1010, 6)
    // Amount fired at offset 50 (progress 0.5) should be the midpoint, 1500.
    expect(contributedAt(50) - contributedAt(49)).toBeCloseTo(1500, 6)
    // Amount fired at offset 100 (progress 1) should be exactly 2000.
    expect(contributedAt(100) - contributedAt(99)).toBeCloseTo(2000, 6)
  })

  it('holds at endAmount for firings after rampEndOffset', () => {
    const monthly: CashFlowRule = {
      id: 'c3',
      type: 'contribution',
      startOffset: { months: 0 },
      amount: 1000,
      endAmount: 2000,
      rampEndOffset: { months: 50 },
      frequency: 'monthly',
      inflationAdjusted: false,
    }
    const result = simulateSingleRun(baseStrategy([monthly], 120), market, startDate)
    const contributedAt = (offset: number) => result.snapshots[offset].cumulativeContributed
    expect(contributedAt(80) - contributedAt(79)).toBeCloseTo(2000, 6)
    expect(contributedAt(120) - contributedAt(119)).toBeCloseTo(2000, 6)
  })

  it('composes with inflationAdjusted: ramps in real terms, then scales by CPI', () => {
    const monthly: CashFlowRule = {
      id: 'c4',
      type: 'contribution',
      startOffset: { months: 0 },
      amount: 1000,
      endAmount: 1000,
      rampEndOffset: { months: 12 },
      frequency: 'monthly',
      inflationAdjusted: true,
    }
    const result = simulateSingleRun(baseStrategy([monthly]), market, startDate)
    const contributedAt = (offset: number) => result.snapshots[offset].cumulativeContributed
    const firstMonth = contributedAt(1) - contributedAt(0)
    const laterMonth = contributedAt(24) - contributedAt(23)
    // Flat ramp (amount === endAmount) still grows nominally due to
    // inflation, confirming the two effects compose rather than one
    // overriding the other.
    expect(laterMonth).toBeGreaterThan(firstMonth)
  })

  it('falls back to the flat amount when endAmount/rampEndOffset are unset', () => {
    const flat: CashFlowRule = {
      id: 'c5',
      type: 'contribution',
      startOffset: { months: 0 },
      amount: 1000,
      frequency: 'monthly',
      inflationAdjusted: false,
    }
    const result = simulateSingleRun(baseStrategy([flat]), market, startDate)
    const contributedAt = (offset: number) => result.snapshots[offset].cumulativeContributed
    expect(contributedAt(1) - contributedAt(0)).toBeCloseTo(1000, 6)
    expect(contributedAt(50) - contributedAt(49)).toBeCloseTo(1000, 6)
  })
})
