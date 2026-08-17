import { describe, expect, it } from 'vitest'
import { simulateSingleRun } from '../simulate'
import type { CashFlowRule, MarketData, Strategy } from '../types'

/** A market with the same annual return every month for every asset
 * class and flat (no) inflation - lets guardrail/percentage-withdrawal
 * scenarios be hand-computed exactly, including scenarios needing a
 * shrinking (0% growth, or negative) portfolio that the shared synthetic
 * fixture (fixed positive 5/3/1% rates) can't produce. */
function buildFlatMarket(annualReturn: number, months = 60): MarketData {
  const monthlyReturn = (1 + annualReturn) ** (1 / 12) - 1
  const marketMonths = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(1990, i, 1))
    return {
      date: d.toISOString().slice(0, 7) + '-01',
      monthlyReturn: { stocks: monthlyReturn, bonds: monthlyReturn, cash: monthlyReturn },
      cpiIndex: 100,
    }
  })
  return { months: marketMonths, indexByDate: new Map(marketMonths.map((m, i) => [m.date, i])) }
}

function baseStrategy(rule: CashFlowRule, durationMonths = 24): Strategy {
  return {
    id: 'test',
    name: 'test',
    initialPortfolio: { startValue: 100_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
    durationMonths,
    rules: [rule],
  }
}

function withdrawnEachYear(result: ReturnType<typeof simulateSingleRun>): number[] {
  const yearly: number[] = []
  for (let offset = 12; offset < result.snapshots.length; offset += 12) {
    yearly.push(result.snapshots[offset].cumulativeWithdrawn - result.snapshots[offset - 12].cumulativeWithdrawn)
  }
  return yearly
}

describe('percentOfPortfolio withdrawals', () => {
  it('withdraws exactly percent * the portfolio value at the moment of firing', () => {
    const market = buildFlatMarket(0.2)
    const rule: CashFlowRule = {
      id: 'w1',
      type: 'withdrawal',
      startOffset: { months: 0 },
      amount: 0,
      frequency: 'yearly',
      inflationAdjusted: false,
      withdrawalStyle: { kind: 'percentOfPortfolio', percent: 0.04 },
    }
    const result = simulateSingleRun(baseStrategy(rule, 12), market, market.months[0].date)
    // One year of 20% growth: 100,000 -> 120,000, then withdraw 4% of that.
    expect(withdrawnEachYear(result)[0]).toBeCloseTo(4800, 6)
  })

  it('recomputes fresh from the current value each firing, rather than compounding a fixed amount', () => {
    const market = buildFlatMarket(0.2)
    const rule: CashFlowRule = {
      id: 'w1',
      type: 'withdrawal',
      startOffset: { months: 0 },
      amount: 0,
      frequency: 'yearly',
      inflationAdjusted: false,
      withdrawalStyle: { kind: 'percentOfPortfolio', percent: 0.04 },
    }
    const result = simulateSingleRun(baseStrategy(rule), market, market.months[0].date)
    const [year1, year2] = withdrawnEachYear(result)
    expect(year1).toBeCloseTo(4800, 6) // 4% of 120,000
    // Balance after year 1: 120,000 - 4,800 = 115,200; grows 20% -> 138,240.
    expect(year2).toBeCloseTo(0.04 * 138_240, 6)
  })
})

describe('Guyton-Klinger guardrails withdrawals', () => {
  function guardrailRule(overrides: Partial<Extract<CashFlowRule['withdrawalStyle'], { kind: 'guardrails' }>>): CashFlowRule {
    return {
      id: 'w1',
      type: 'withdrawal',
      startOffset: { months: 0 },
      amount: 0,
      frequency: 'yearly',
      inflationAdjusted: false,
      withdrawalStyle: {
        kind: 'guardrails',
        initialPercent: 0.04,
        upperGuardrailPercent: 1,
        lowerGuardrailPercent: 1,
        adjustmentPercent: 0.1,
        ...overrides,
      },
    }
  }

  it('the first firing withdraws exactly initialPercent of the portfolio value', () => {
    const market = buildFlatMarket(0.2)
    const result = simulateSingleRun(baseStrategy(guardrailRule({}), 12), market, market.months[0].date)
    expect(withdrawnEachYear(result)[0]).toBeCloseTo(4800, 6) // 4% of 120,000
  })

  it('raises spending when strong growth pushes the withdrawal rate below the lower guardrail', () => {
    // 20%/yr growth: year 1 withdraws 4% of 120,000 = 4,800, leaving
    // 115,200 -> grows to 138,240 by year 2. Rate at year 2 = 4,800 /
    // 138,240 = 3.4722%, which is more than 10% below the 4% initial
    // rate (threshold 3.6%), so the prosperity rule should raise it by
    // the 10% adjustment: 4,800 * 1.10 = 5,280.
    const market = buildFlatMarket(0.2)
    const rule = guardrailRule({ lowerGuardrailPercent: 0.1 })
    const result = simulateSingleRun(baseStrategy(rule), market, market.months[0].date)
    const [year1, year2] = withdrawnEachYear(result)
    expect(year1).toBeCloseTo(4800, 6)
    expect(year2).toBeCloseTo(5280, 6)
  })

  it('cuts spending when a flat market shrinks the balance and pushes the rate above the upper guardrail', () => {
    // 0%/yr growth: year 1 withdraws 4% of 100,000 = 4,000, leaving
    // 96,000 (still 96,000 by year 2, no growth). Rate at year 2 =
    // 4,000 / 96,000 = 4.1667%, more than 2% above the 4% initial rate
    // (threshold 4.08%), so the capital preservation rule should cut it
    // by the 10% adjustment: 4,000 * 0.90 = 3,600.
    const market = buildFlatMarket(0)
    const rule = guardrailRule({ upperGuardrailPercent: 0.02 })
    const result = simulateSingleRun(baseStrategy(rule), market, market.months[0].date)
    const [year1, year2] = withdrawnEachYear(result)
    expect(year1).toBeCloseTo(4000, 6)
    expect(year2).toBeCloseTo(3600, 6)
  })

  it('holds spending steady while the rate stays within both guardrails', () => {
    // Same flat 0%/yr scenario as the cut test (rate drifts to 4.1667%),
    // but with a wide enough upper guardrail (threshold 4.4%) that it
    // doesn't breach - spending should stay exactly unchanged.
    const market = buildFlatMarket(0)
    const rule = guardrailRule({ upperGuardrailPercent: 0.1, lowerGuardrailPercent: 0.1 })
    const result = simulateSingleRun(baseStrategy(rule), market, market.months[0].date)
    const [year1, year2] = withdrawnEachYear(result)
    expect(year1).toBeCloseTo(4000, 6)
    expect(year2).toBeCloseTo(4000, 6)
  })
})
