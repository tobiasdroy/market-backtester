import { describe, expect, it } from 'vitest'
import { buildScenario20_70_50k } from '../fixtures/scenario-20-70-50k'
import { buildSyntheticMarketData, SYNTHETIC_ANNUAL_RATES } from '../fixtures/syntheticMarketData'
import { simulateSingleRun } from '../simulate'
import type { AssetClass } from '../types'

/** Independent re-implementation of the scenario's month-by-month
 * arithmetic, deliberately not sharing any code with simulate.ts, to
 * cross-check the engine's output for the canonical example scenario
 * from the product brief.
 */
function referenceRun(totalMonths: number) {
  const monthlyStocks = (1 + SYNTHETIC_ANNUAL_RATES.stocks) ** (1 / 12) - 1
  const monthlyBonds = (1 + SYNTHETIC_ANNUAL_RATES.bonds) ** (1 / 12) - 1
  const monthlyInflation = (1 + SYNTHETIC_ANNUAL_RATES.inflation) ** (1 / 12) - 1

  let stocks = 20_000
  let bonds = 0
  const values: number[] = [20_000]

  for (let offset = 1; offset <= totalMonths; offset++) {
    stocks *= 1 + monthlyStocks
    bonds *= 1 + monthlyBonds

    // Annual contribution: fires at offsets 12, 24, ..., 360.
    if (offset <= 30 * 12 && offset % 12 === 0) {
      const contribution = 5_000 * (1 + monthlyInflation) ** offset
      const total = stocks + bonds
      const weightStocks = total > 0 ? stocks / total : 1
      const weightBonds = total > 0 ? bonds / total : 0
      stocks += contribution * weightStocks
      bonds += contribution * weightBonds
    }

    // One-off rebalance to 70/30 at year 20, after that year's contribution.
    if (offset === 20 * 12) {
      const total = stocks + bonds
      stocks = total * 0.7
      bonds = total * 0.3
    }

    // Annual withdrawal from year 31 onward.
    if (offset >= 31 * 12 && (offset - 31 * 12) % 12 === 0) {
      const amount = 50_000 * (1 + monthlyInflation) ** offset
      const total = stocks + bonds
      const paid = Math.min(amount, total)
      if (total > 0) {
        const weightStocks = stocks / total
        const weightBonds = bonds / total
        stocks = Math.max(0, stocks - paid * weightStocks)
        bonds = Math.max(0, bonds - paid * weightBonds)
      }
    }

    values.push(stocks + bonds)
  }

  return values
}

describe('canonical scenario (20yr all-stock -> 30% bonds -> withdraw from yr31)', () => {
  const market = buildSyntheticMarketData(500)
  const strategy = buildScenario20_70_50k()
  const result = simulateSingleRun(strategy, market, market.months[0].date)
  const expected = referenceRun(strategy.durationMonths)

  it('matches an independent reference implementation at every month', () => {
    expect(result.snapshots).toHaveLength(expected.length)
    result.snapshots.forEach((snap, i) => {
      // Tolerance widens slightly over the 40-year horizon from compounding
      // floating-point drift between the two independent implementations.
      expect(snap.totalValue).toBeCloseTo(expected[i], 2)
    })
  })

  it('is exactly 70/30 stocks/bonds immediately after the year-20 rebalance', () => {
    const snap = result.snapshots[20 * 12]
    const asset = (a: AssetClass) => snap.byAsset[a] / snap.totalValue
    expect(asset('stocks')).toBeCloseTo(0.7, 6)
    expect(asset('bonds')).toBeCloseTo(0.3, 6)
  })

  it('stops receiving contributions after year 30 and never contributes again', () => {
    const beforeLastContribution = result.snapshots[30 * 12 - 1].cumulativeContributed
    const afterLastContribution = result.snapshots[30 * 12].cumulativeContributed
    const atEnd = result.snapshots[result.snapshots.length - 1].cumulativeContributed
    expect(afterLastContribution).toBeGreaterThan(beforeLastContribution)
    expect(atEnd).toBeCloseTo(afterLastContribution, 6)
  })

  it('makes its first withdrawal at year 31, not year 30', () => {
    expect(result.snapshots[30 * 12].cumulativeWithdrawn).toBe(0)
    expect(result.snapshots[31 * 12].cumulativeWithdrawn).toBeGreaterThan(0)
  })

  it('depletes under these constant-growth assumptions (matches the reference)', () => {
    // £50k/yr inflation-adjusted withdrawals from year 31 outpace this
    // portfolio's ~4-5% blended nominal growth once it's shrinking, so
    // depletion here is an expected result of the parameters, not a bug -
    // cross-checked against the independent reference implementation above.
    const last = result.snapshots[result.snapshots.length - 1]
    const referenceLast = expected[expected.length - 1]
    expect(last.totalValue).toBeCloseTo(0, 2)
    expect(referenceLast).toBeCloseTo(0, 2)
    expect(last.depleted).toBe(true)
  })
})
