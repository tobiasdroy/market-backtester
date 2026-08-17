import type { Strategy } from '../types'

/** The example strategy from the product brief:
 * - Start with £20,000, 100% stocks.
 * - Add £5,000/year, inflation-adjusted, for 30 years (years 1-30).
 * - After 20 years, rebalance to 30% bonds / 70% stocks (applied after
 *   that year's contribution).
 * - After 30 years of contributing, stop, and from year 31 start
 *   withdrawing £50,000/year, inflation-adjusted, for the rest of a
 *   40-year horizon.
 *
 * Rule order matters here: the engine applies rules in array order, so
 * listing the contribution before the rebalance means year 20's
 * contribution lands before that year's rebalance resets the mix.
 */
export function buildScenario20_70_50k(): Strategy {
  return {
    id: 'scenario-20-70-50k',
    name: '20yr all-stock -> 30% bonds, contribute 30yr then withdraw',
    initialPortfolio: {
      startValue: 20_000,
      allocation: { stocks: 1, bonds: 0, cash: 0 },
    },
    durationMonths: 40 * 12,
    rules: [
      {
        id: 'annual-contribution',
        type: 'contribution',
        startOffset: { months: 0 },
        endOffset: { months: 30 * 12 },
        amount: 5_000,
        frequency: 'yearly',
        inflationAdjusted: true,
      },
      {
        id: 'rebalance-year-20',
        type: 'rebalance',
        startOffset: { months: 20 * 12 },
        targetAllocation: { stocks: 0.7, bonds: 0.3, cash: 0 },
      },
      {
        id: 'annual-withdrawal',
        type: 'withdrawal',
        startOffset: { months: 31 * 12 },
        amount: 50_000,
        frequency: 'yearly',
        inflationAdjusted: true,
      },
    ],
  }
}
