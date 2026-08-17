import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { alignMarketData } from '../dataLoader'
import { buildScenario20_70_50k } from '../fixtures/scenario-20-70-50k'
import { simulateSingleRun } from '../simulate'
import { computeStats } from '../stats'
import type { MarketDataRaw } from '../types'

function loadRealMarketData() {
  const dataDir = resolve(__dirname, '../../../public/data')
  const read = (file: string) => JSON.parse(readFileSync(resolve(dataDir, file), 'utf-8'))
  const raw: MarketDataRaw = {
    stocks: read('stocks.json'),
    bonds: read('bonds.json'),
    cash: read('cash.json'),
    inflation: read('inflation.json'),
  }
  return alignMarketData(raw)
}

describe('engine against real historical data (public/data/*.json)', () => {
  const market = loadRealMarketData()

  it('loads and aligns a large, gap-free monthly dataset', () => {
    expect(market.months.length).toBeGreaterThan(1000)
    for (let i = 1; i < market.months.length; i++) {
      const prev = new Date(market.months[i - 1].date)
      const cur = new Date(market.months[i].date)
      const monthsApart =
        (cur.getUTCFullYear() - prev.getUTCFullYear()) * 12 +
        (cur.getUTCMonth() - prev.getUTCMonth())
      expect(monthsApart).toBe(1)
    }
  })

  it('runs the canonical scenario from a known historical start year (1990) with plausible output', () => {
    const strategy = buildScenario20_70_50k()
    // Real data runs through the present, so cap the horizon to fit
    // (durationMonths would otherwise need data through ~2030).
    strategy.durationMonths = 30 * 12
    const result = simulateSingleRun(strategy, market, '1990-01-01')
    const stats = computeStats(result)

    expect(result.snapshots).toHaveLength(strategy.durationMonths + 1)
    expect(stats.endingValueNominal).toBeGreaterThan(0)
    expect(stats.totalContributed).toBeGreaterThan(20_000)
    // Long-run nominal equity/bond blend shouldn't produce an absurd CAGR.
    expect(stats.cagrNominal).toBeGreaterThan(-0.2)
    expect(stats.cagrNominal).toBeLessThan(0.3)
  })

  it('shows a visible mid-run drawdown for a strategy spanning the 2008 crash', () => {
    const strategy = buildScenario20_70_50k()
    strategy.durationMonths = 5 * 12
    strategy.rules = []
    const result = simulateSingleRun(strategy, market, '2006-01-01')
    const stats = computeStats(result)
    expect(stats.maxDrawdown).toBeLessThan(-0.2)
  })
})
