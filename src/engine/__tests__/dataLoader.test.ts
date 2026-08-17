import { describe, expect, it } from 'vitest'
import { alignMarketData } from '../dataLoader'
import type { MarketDataRaw } from '../types'

function point(date: string, value: number) {
  return { date, totalReturnIndex: value, monthlyReturn: 0.01, source: 'TEST', isInterpolated: false }
}

describe('alignMarketData', () => {
  it('keeps only dates present in all four series, sorted', () => {
    const raw: MarketDataRaw = {
      stocks: [point('2000-01-01', 1), point('2000-02-01', 1), point('2000-03-01', 1)],
      bonds: [point('2000-01-01', 1), point('2000-02-01', 1)],
      cash: [point('2000-01-01', 1), point('2000-02-01', 1), point('2000-03-01', 1)],
      inflation: [
        { date: '2000-01-01', cpiIndex: 100, source: 'T', isInterpolated: false },
        { date: '2000-02-01', cpiIndex: 101, source: 'T', isInterpolated: false },
        { date: '2000-03-01', cpiIndex: 102, source: 'T', isInterpolated: false },
      ],
    }
    const aligned = alignMarketData(raw)
    // March is dropped because bonds has no March data point.
    expect(aligned.months.map((m) => m.date)).toEqual(['2000-01-01', '2000-02-01'])
    expect(aligned.indexByDate.get('2000-02-01')).toBe(1)
    expect(aligned.indexByDate.has('2000-03-01')).toBe(false)
  })

  it('carries through each asset class monthly return and the CPI index', () => {
    const raw: MarketDataRaw = {
      stocks: [{ ...point('2000-01-01', 1), monthlyReturn: 0.05 }],
      bonds: [{ ...point('2000-01-01', 1), monthlyReturn: 0.02 }],
      cash: [{ ...point('2000-01-01', 1), monthlyReturn: 0.01 }],
      inflation: [{ date: '2000-01-01', cpiIndex: 123.4, source: 'T', isInterpolated: false }],
    }
    const aligned = alignMarketData(raw)
    expect(aligned.months[0].monthlyReturn).toEqual({ stocks: 0.05, bonds: 0.02, cash: 0.01 })
    expect(aligned.months[0].cpiIndex).toBe(123.4)
  })
})
