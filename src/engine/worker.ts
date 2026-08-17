import * as Comlink from 'comlink'
import { loadMarketData } from './dataLoader'
import { simulateRolling, type RollingBacktestOptions } from './rollingBacktest'
import { simulateSingleRun } from './simulate'
import type { MarketData, Strategy } from './types'

let cachedMarketData: MarketData | null = null

async function getMarketData(): Promise<MarketData> {
  if (!cachedMarketData) {
    cachedMarketData = await loadMarketData()
  }
  return cachedMarketData
}

const api = {
  async runSingle(strategy: Strategy, startDate: string) {
    const marketData = await getMarketData()
    return simulateSingleRun(strategy, marketData, startDate)
  },

  async runRolling(
    strategy: Strategy,
    options: Omit<RollingBacktestOptions, 'onProgress'> = {},
    onProgress?: (done: number, total: number) => void,
  ) {
    const marketData = await getMarketData()
    return simulateRolling(strategy, marketData, { ...options, onProgress })
  },
}

export type WorkerApi = typeof api

Comlink.expose(api)
