import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../randomSource'

describe('mulberry32', () => {
  it('produces values in [0, 1)', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic for a given seed', () => {
    const a = mulberry32(123)
    const b = mulberry32(123)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    const seqA = Array.from({ length: 20 }, () => a())
    const seqB = Array.from({ length: 20 }, () => b())
    expect(seqA).not.toEqual(seqB)
  })
})
