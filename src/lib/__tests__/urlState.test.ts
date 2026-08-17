import { describe, expect, it } from 'vitest'
import { decodeStrategy, encodeStrategy } from '../urlState'
import type { Strategy } from '@/engine/types'

const strategy: Strategy = {
  id: 'abc',
  name: 'Test strategy',
  initialPortfolio: { startValue: 20_000, allocation: { stocks: 1, bonds: 0, cash: 0 } },
  durationMonths: 360,
  rules: [
    {
      id: 'r1',
      type: 'contribution',
      startOffset: { months: 0 },
      endOffset: { months: 360 },
      amount: 5000,
      frequency: 'yearly',
      inflationAdjusted: true,
    },
    {
      id: 'r2',
      type: 'rebalance',
      startOffset: { months: 240 },
      targetAllocation: { stocks: 0.7, bonds: 0.3, cash: 0 },
    },
  ],
  contributionAllocation: 'proRata',
}

describe('encodeStrategy / decodeStrategy', () => {
  it('round-trips a strategy exactly', () => {
    const encoded = encodeStrategy(strategy)
    const decoded = decodeStrategy(encoded)
    expect(decoded).toEqual(strategy)
  })

  it('produces a URL-safe string', () => {
    const encoded = encodeStrategy(strategy)
    expect(encoded).toMatch(/^[A-Za-z0-9+/=_-]*$/)
  })

  it('rejects garbage input rather than throwing', () => {
    expect(decodeStrategy('not-valid-compressed-data')).toBeNull()
    expect(decodeStrategy('')).toBeNull()
  })

  it('rejects a well-formed but schema-invalid strategy (untrusted link)', () => {
    const badStrategy = { ...strategy, initialPortfolio: { startValue: -100, allocation: strategy.initialPortfolio.allocation } }
    const encoded = encodeStrategy(badStrategy as Strategy)
    expect(decodeStrategy(encoded)).toBeNull()
  })

  it('rejects an allocation that does not sum to 1', () => {
    const badStrategy: Strategy = {
      ...strategy,
      initialPortfolio: { startValue: 1000, allocation: { stocks: 0.5, bonds: 0.5, cash: 0.5 } },
    }
    const encoded = encodeStrategy(badStrategy)
    expect(decodeStrategy(encoded)).toBeNull()
  })
})
