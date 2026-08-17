import { describe, expect, it } from 'vitest'
import { buildSyntheticMarketData } from '../fixtures/syntheticMarketData'
import { applySensitivityValue, buildSweepValues, runSensitivity } from '../sensitivity'
import type { CashFlowRule, Strategy } from '../types'

const market = buildSyntheticMarketData()

const contributionRule: CashFlowRule = {
  id: 'c1',
  type: 'contribution',
  startOffset: { months: 0 },
  amount: 1000,
  frequency: 'yearly',
  inflationAdjusted: false,
}

function baseStrategy(overrides: Partial<Strategy> = {}): Strategy {
  return {
    id: 'test',
    name: 'test',
    initialPortfolio: { startValue: 10_000, allocation: { stocks: 0.5, bonds: 0, cash: 0.5 } },
    durationMonths: 24,
    rules: [contributionRule],
    ...overrides,
  }
}

describe('buildSweepValues', () => {
  it('spans min to max, evenly spaced', () => {
    const values = buildSweepValues(700, 1300, 5)
    expect(values).toEqual([700, 850, 1000, 1150, 1300])
  })

  it('returns just the min value for a single step', () => {
    expect(buildSweepValues(1000, 2000, 1)).toEqual([1000])
  })

  it('handles a min of 0 without degenerating (e.g. sweeping a fee from 0%)', () => {
    expect(buildSweepValues(0, 0.02, 3)).toEqual([0, 0.01, 0.02])
  })
})

describe('applySensitivityValue', () => {
  it('overrides startValue without touching anything else', () => {
    const strategy = baseStrategy()
    const variant = applySensitivityValue(strategy, { kind: 'startValue' }, 25_000)
    expect(variant.initialPortfolio.startValue).toBe(25_000)
    expect(variant.initialPortfolio.allocation).toEqual(strategy.initialPortfolio.allocation)
    expect(variant.rules).toBe(strategy.rules)
  })

  it('sets annualFeePercent, defaulting accountType to ISA when none exists', () => {
    const strategy = baseStrategy()
    const variant = applySensitivityValue(strategy, { kind: 'annualFeePercent' }, 0.01)
    expect(variant.feesAndTax).toEqual({ accountType: 'ISA', annualFeePercent: 0.01 })
  })

  it('preserves existing feesAndTax fields when overriding annualFeePercent', () => {
    const strategy = baseStrategy({
      feesAndTax: { accountType: 'GIA', annualFeePercent: 0.005, capitalGainsTaxRate: 0.2 },
    })
    const variant = applySensitivityValue(strategy, { kind: 'annualFeePercent' }, 0.02)
    expect(variant.feesAndTax).toEqual({
      accountType: 'GIA',
      annualFeePercent: 0.02,
      capitalGainsTaxRate: 0.2,
    })
  })

  it('overrides only the matching rule amount, leaving other rules untouched', () => {
    const otherRule: CashFlowRule = { ...contributionRule, id: 'c2', amount: 500 }
    const strategy = baseStrategy({ rules: [contributionRule, otherRule] })
    const variant = applySensitivityValue(strategy, { kind: 'ruleAmount', ruleId: 'c1' }, 2000)
    const varied = variant.rules.find((r) => r.id === 'c1') as CashFlowRule
    const untouched = variant.rules.find((r) => r.id === 'c2') as CashFlowRule
    expect(varied.amount).toBe(2000)
    expect(untouched.amount).toBe(500)
  })
})

describe('runSensitivity', () => {
  it('returns one point per input value, tracking the target', () => {
    const strategy = baseStrategy()
    const values = buildSweepValues(5000, 15_000, 3)
    const result = runSensitivity(strategy, market, { kind: 'startValue' }, values, {
      stepMonths: 12,
    })
    expect(result.target).toEqual({ kind: 'startValue' })
    expect(result.points).toHaveLength(3)
    expect(result.points.map((p) => p.paramValue)).toEqual(values)
  })

  it('a larger starting value produces a larger median ending value, all else equal', () => {
    const strategy = baseStrategy()
    const result = runSensitivity(
      strategy,
      market,
      { kind: 'startValue' },
      [5000, 10_000, 20_000],
      { stepMonths: 12 },
    )
    const endingValues = result.points.map((p) => p.endingValueMedianNominal)
    expect(endingValues[0]).toBeLessThan(endingValues[1])
    expect(endingValues[1]).toBeLessThan(endingValues[2])
  })

  it('reports progress for each value simulated', () => {
    const strategy = baseStrategy()
    const calls: [number, number][] = []
    runSensitivity(strategy, market, { kind: 'startValue' }, [1000, 2000], {
      stepMonths: 12,
      onProgress: (done, total) => calls.push([done, total]),
    })
    expect(calls).toEqual([
      [1, 2],
      [2, 2],
    ])
  })
})
