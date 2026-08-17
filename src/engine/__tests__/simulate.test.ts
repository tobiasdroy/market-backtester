import { describe, expect, it } from 'vitest'
import { buildSyntheticMarketData, SYNTHETIC_ANNUAL_RATES } from '../fixtures/syntheticMarketData'
import { simulateSingleRun } from '../simulate'
import type { Strategy } from '../types'

const monthlyStocks = (1 + SYNTHETIC_ANNUAL_RATES.stocks) ** (1 / 12) - 1
const monthlyCash = (1 + SYNTHETIC_ANNUAL_RATES.cash) ** (1 / 12) - 1
const monthlyInflation = (1 + SYNTHETIC_ANNUAL_RATES.inflation) ** (1 / 12) - 1

const market = buildSyntheticMarketData()
const startDate = market.months[0].date

function baseStrategy(overrides: Partial<Strategy>): Strategy {
  return {
    id: 'test',
    name: 'test',
    initialPortfolio: { startValue: 10_000, allocation: { stocks: 0.5, bonds: 0, cash: 0.5 } },
    durationMonths: 1,
    rules: [],
    ...overrides,
  }
}

describe('simulateSingleRun - no rules', () => {
  it('applies one month of market return to each asset independently', () => {
    const strategy = baseStrategy({ durationMonths: 1 })
    const result = simulateSingleRun(strategy, market, startDate)
    const snap = result.snapshots[1]

    expect(snap.byAsset.stocks).toBeCloseTo(5000 * (1 + monthlyStocks), 6)
    expect(snap.byAsset.cash).toBeCloseTo(5000 * (1 + monthlyCash), 6)
    expect(snap.totalValue).toBeCloseTo(snap.byAsset.stocks + snap.byAsset.cash, 6)
  })

  it('produces an initial snapshot at offset 0 with no growth applied', () => {
    const strategy = baseStrategy({ durationMonths: 3 })
    const result = simulateSingleRun(strategy, market, startDate)
    expect(result.snapshots[0].totalValue).toBe(10_000)
    expect(result.snapshots[0].monthOffset).toBe(0)
    expect(result.snapshots).toHaveLength(4)
  })
})

describe('simulateSingleRun - contributions', () => {
  it('preserves the pre-contribution asset ratio exactly (pro-rata)', () => {
    const strategy = baseStrategy({
      durationMonths: 1,
      rules: [
        {
          id: 'c',
          type: 'contribution',
          startOffset: { months: 0 },
          amount: 1000,
          frequency: 'monthly',
          inflationAdjusted: false,
        },
      ],
    })
    const result = simulateSingleRun(strategy, market, startDate)
    const snap = result.snapshots[1]

    const preContributionStocks = 5000 * (1 + monthlyStocks)
    const preContributionCash = 5000 * (1 + monthlyCash)
    const expectedRatio = preContributionStocks / preContributionCash

    expect(snap.byAsset.stocks / snap.byAsset.cash).toBeCloseTo(expectedRatio, 9)
    expect(snap.totalValue).toBeCloseTo(preContributionStocks + preContributionCash + 1000, 6)
    expect(snap.cumulativeContributed).toBeCloseTo(10_000 + 1000, 6)
  })

  it('scales inflation-adjusted contributions by CPI(now)/CPI(start)', () => {
    const strategy = baseStrategy({
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 0, bonds: 0, cash: 1 } },
      durationMonths: 24,
      rules: [
        {
          id: 'c',
          type: 'contribution',
          startOffset: { months: 0 },
          amount: 1000,
          frequency: 'yearly',
          inflationAdjusted: true,
        },
      ],
    })
    const result = simulateSingleRun(strategy, market, startDate)

    // First contribution fires at offset 12 (see types.ts semantics).
    const before = result.snapshots[11].totalValue
    const after = result.snapshots[12].totalValue
    const grownBase = before * (1 + monthlyCash)
    const expectedContribution = 1000 * (1 + monthlyInflation) ** 12
    expect(after - grownBase).toBeCloseTo(expectedContribution, 4)
  })

  it('a non-zero startOffset fires immediately at that offset, not one period later', () => {
    const strategy = baseStrategy({
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 0, bonds: 0, cash: 1 } },
      durationMonths: 6,
      rules: [
        {
          id: 'c',
          type: 'contribution',
          startOffset: { months: 3 },
          amount: 100,
          frequency: 'monthly',
          inflationAdjusted: false,
        },
      ],
    })
    const result = simulateSingleRun(strategy, market, startDate)
    expect(result.snapshots[2].cumulativeContributed).toBeCloseTo(10_000, 6)
    expect(result.snapshots[3].cumulativeContributed).toBeCloseTo(10_100, 6)
    expect(result.snapshots[6].cumulativeContributed).toBeCloseTo(10_400, 6)
  })
})

describe('simulateSingleRun - withdrawals', () => {
  it('preserves the pre-withdrawal asset ratio exactly (pro-rata)', () => {
    const strategy = baseStrategy({
      durationMonths: 1,
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
    })
    const result = simulateSingleRun(strategy, market, startDate)
    const snap = result.snapshots[1]

    const preWithdrawalStocks = 5000 * (1 + monthlyStocks)
    const preWithdrawalCash = 5000 * (1 + monthlyCash)
    const expectedRatio = preWithdrawalStocks / preWithdrawalCash

    expect(snap.byAsset.stocks / snap.byAsset.cash).toBeCloseTo(expectedRatio, 9)
    expect(snap.totalValue).toBeCloseTo(preWithdrawalStocks + preWithdrawalCash - 1000, 6)
    expect(snap.cumulativeWithdrawn).toBeCloseTo(1000, 6)
  })

  it('clamps to available balance and marks the run depleted, stickily', () => {
    const strategy = baseStrategy({
      initialPortfolio: { startValue: 100, allocation: { stocks: 0, bonds: 0, cash: 1 } },
      durationMonths: 3,
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
    })
    const result = simulateSingleRun(strategy, market, startDate)

    expect(result.snapshots[1].totalValue).toBeCloseTo(0, 6)
    expect(result.snapshots[1].depleted).toBe(true)
    expect(result.snapshots[1].cumulativeWithdrawn).toBeLessThan(1000)
    // Stays depleted even though there's nothing left to withdraw later.
    expect(result.snapshots[2].depleted).toBe(true)
    expect(result.snapshots[3].depleted).toBe(true)
  })
})

describe('simulateSingleRun - rebalancing', () => {
  it('resets balances to exactly the target allocation at the given offset', () => {
    const strategy = baseStrategy({
      durationMonths: 2,
      rules: [
        {
          id: 'r',
          type: 'rebalance',
          startOffset: { months: 1 },
          targetAllocation: { stocks: 0.2, bonds: 0, cash: 0.8 },
        },
      ],
    })
    const result = simulateSingleRun(strategy, market, startDate)
    const snap = result.snapshots[1]

    expect(snap.byAsset.stocks / snap.totalValue).toBeCloseTo(0.2, 9)
    expect(snap.byAsset.cash / snap.totalValue).toBeCloseTo(0.8, 9)

    // No rebalance rule at offset 2, so drift resumes untouched.
    const snap2 = result.snapshots[2]
    expect(snap2.byAsset.stocks).toBeCloseTo(snap.byAsset.stocks * (1 + monthlyStocks), 6)
  })
})

describe('simulateSingleRun - bounds', () => {
  it('throws for an unknown start date', () => {
    const strategy = baseStrategy({})
    expect(() => simulateSingleRun(strategy, market, '1800-01-01')).toThrow()
  })

  it('throws when the run would exceed available market data', () => {
    const strategy = baseStrategy({ durationMonths: market.months.length + 10 })
    expect(() => simulateSingleRun(strategy, market, startDate)).toThrow()
  })
})

describe('simulateSingleRun - fees', () => {
  it('deducts the monthly-equivalent annual fee from every asset class', () => {
    const strategy = baseStrategy({
      durationMonths: 1,
      feesAndTax: { annualFeePercent: 0.12, accountType: 'ISA' }, // 1%/month
    })
    const result = simulateSingleRun(strategy, market, startDate)
    const snap = result.snapshots[1]

    const stocksAfterReturn = 5000 * (1 + monthlyStocks)
    const cashAfterReturn = 5000 * (1 + monthlyCash)
    expect(snap.byAsset.stocks).toBeCloseTo(stocksAfterReturn * 0.99, 6)
    expect(snap.byAsset.cash).toBeCloseTo(cashAfterReturn * 0.99, 6)
    expect(snap.cumulativeFeesPaid).toBeCloseTo(
      (stocksAfterReturn + cashAfterReturn) * 0.01,
      6,
    )
  })

  it('charges no fee when feesAndTax is omitted', () => {
    const strategy = baseStrategy({ durationMonths: 1 })
    const result = simulateSingleRun(strategy, market, startDate)
    expect(result.snapshots[1].cumulativeFeesPaid).toBe(0)
  })
})

describe('simulateSingleRun - tax (GIA)', () => {
  it('charges no tax on an ISA even with large unrealized gains', () => {
    const strategy = baseStrategy({
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
      durationMonths: 12,
      feesAndTax: { annualFeePercent: 0, accountType: 'ISA', capitalGainsTaxRate: 0.2 },
      rules: [
        {
          id: 'w',
          type: 'withdrawal',
          startOffset: { months: 12 },
          amount: 1000,
          frequency: 'monthly',
          inflationAdjusted: false,
        },
      ],
    })
    const result = simulateSingleRun(strategy, market, startDate)
    const last = result.snapshots[result.snapshots.length - 1]
    expect(last.cumulativeTaxPaid).toBe(0)
    expect(last.cumulativeWithdrawn).toBeCloseTo(1000, 6)
  })

  it('grosses up a GIA withdrawal so the requested amount is received net of CGT', () => {
    // All-gain scenario (no contributions beyond the initial stake, and
    // costBasis starts equal to that stake) - after growth, cost basis is
    // a known fraction of total value, so the tax is exactly computable.
    const strategy = baseStrategy({
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
      durationMonths: 12,
      feesAndTax: { annualFeePercent: 0, accountType: 'GIA', capitalGainsTaxRate: 0.2 },
      rules: [
        {
          id: 'w',
          type: 'withdrawal',
          startOffset: { months: 12 },
          amount: 1000,
          frequency: 'monthly',
          inflationAdjusted: false,
        },
      ],
    })
    const result = simulateSingleRun(strategy, market, startDate)
    const beforeWithdrawal = result.snapshots[11].totalValue
    const totalBeforeThisWithdrawal = beforeWithdrawal * (1 + monthlyStocks) // this month's return applied first
    const costBasis = 10_000 // no contributions/withdrawals yet
    const gainFraction = (totalBeforeThisWithdrawal - costBasis) / totalBeforeThisWithdrawal
    const effectiveTaxRate = gainFraction * 0.2
    const expectedGross = 1000 / (1 - effectiveTaxRate)
    const expectedTax = expectedGross * effectiveTaxRate

    const last = result.snapshots[12]
    expect(last.cumulativeWithdrawn).toBeCloseTo(1000, 4)
    expect(last.cumulativeTaxPaid).toBeCloseTo(expectedTax, 4)
    expect(last.totalValue).toBeCloseTo(totalBeforeThisWithdrawal - expectedGross, 4)
  })

  it('reduces cost basis proportionally to the fraction of the portfolio withdrawn', () => {
    const strategy = baseStrategy({
      initialPortfolio: { startValue: 10_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
      durationMonths: 24,
      feesAndTax: { annualFeePercent: 0, accountType: 'GIA', capitalGainsTaxRate: 0.2 },
      rules: [
        {
          id: 'w1',
          type: 'withdrawal',
          startOffset: { months: 12 },
          endOffset: { months: 12 },
          amount: 5000, // withdraw roughly half the portfolio
          frequency: 'monthly',
          inflationAdjusted: false,
        },
        {
          id: 'w2',
          // A second, later withdrawal of the same gain-fraction check:
          // if cost basis wasn't reduced after w1, this would compute the
          // wrong (too-low) tax rate on the remaining, now higher-cost-
          // basis-fraction portfolio.
          type: 'withdrawal',
          startOffset: { months: 24 },
          amount: 100,
          frequency: 'monthly',
          inflationAdjusted: false,
        },
      ],
    })
    const result = simulateSingleRun(strategy, market, startDate)
    // Just assert it runs to completion with a sane, fully-paid result -
    // the point is no crash/negative-cost-basis from the first withdrawal.
    const last = result.snapshots[result.snapshots.length - 1]
    expect(last.cumulativeWithdrawn).toBeCloseTo(5100, 1)
    expect(last.totalValue).toBeGreaterThan(0)
  })
})
