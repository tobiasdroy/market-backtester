import { describe, expect, it } from 'vitest'
import { toCsv } from '../csvExport'

describe('toCsv', () => {
  it('returns an empty string for no rows', () => {
    expect(toCsv([])).toBe('')
  })

  it('writes a header row from the first record\'s keys, then one row per record', () => {
    const csv = toCsv([
      { date: '2000-01-01', value: 100 },
      { date: '2000-02-01', value: 105.5 },
    ])
    expect(csv).toBe('date,value\n2000-01-01,100\n2000-02-01,105.5')
  })

  it('quotes and escapes cells containing commas, quotes, or newlines', () => {
    const csv = toCsv([{ note: 'has, a comma' }, { note: 'has "quotes"' }, { note: 'line\nbreak' }])
    expect(csv).toBe('note\n"has, a comma"\n"has ""quotes"""\n"line\nbreak"')
  })

  it('stringifies booleans', () => {
    expect(toCsv([{ ok: true }, { ok: false }])).toBe('ok\ntrue\nfalse')
  })
})
