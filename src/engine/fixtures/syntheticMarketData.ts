import { alignMarketData } from '../dataLoader'
import type { MarketData, MarketDataRaw } from '../types'

export const SYNTHETIC_ANNUAL_RATES = {
  stocks: 0.05,
  bonds: 0.03,
  cash: 0.01,
  inflation: 0.02,
}

/** A market with the same return every month, so any run's expected
 * ending value is exactly computable by hand with compound-interest
 * formulas - used to assert the engine's arithmetic exactly. */
export function buildSyntheticMarketData(
  months = 500,
  startDate = '1900-01-01',
): MarketData {
  const monthlyStocks = (1 + SYNTHETIC_ANNUAL_RATES.stocks) ** (1 / 12) - 1
  const monthlyBonds = (1 + SYNTHETIC_ANNUAL_RATES.bonds) ** (1 / 12) - 1
  const monthlyCash = (1 + SYNTHETIC_ANNUAL_RATES.cash) ** (1 / 12) - 1
  const monthlyInflation = (1 + SYNTHETIC_ANNUAL_RATES.inflation) ** (1 / 12) - 1

  const start = new Date(startDate + 'T00:00:00Z')
  let cpi = 100

  const stocks = []
  const bonds = []
  const cash = []
  const inflation = []

  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1))
    const date = d.toISOString().slice(0, 7) + '-01'

    stocks.push({
      date,
      totalReturnIndex: (1 + monthlyStocks) ** i * 100,
      monthlyReturn: monthlyStocks,
      source: 'SYNTHETIC',
      isInterpolated: false,
    })
    bonds.push({
      date,
      totalReturnIndex: (1 + monthlyBonds) ** i * 100,
      monthlyReturn: monthlyBonds,
      source: 'SYNTHETIC',
      isInterpolated: false,
    })
    cash.push({
      date,
      totalReturnIndex: (1 + monthlyCash) ** i * 100,
      monthlyReturn: monthlyCash,
      source: 'SYNTHETIC',
      isInterpolated: false,
    })
    inflation.push({
      date,
      cpiIndex: cpi,
      source: 'SYNTHETIC',
      isInterpolated: false,
    })
    cpi *= 1 + monthlyInflation
  }

  const raw: MarketDataRaw = { stocks, bonds, cash, inflation }
  return alignMarketData(raw)
}
