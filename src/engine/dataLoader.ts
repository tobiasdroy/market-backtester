import type { AssetClass, MarketData, MarketDataRaw, MarketMonth } from './types'

/** Aligns the four raw series to their shared (intersection) date range.
 * Pure/sync so it's trivially testable without fetch. */
export function alignMarketData(raw: MarketDataRaw): MarketData {
  const byDate: Record<AssetClass | 'inflation', Map<string, number>> = {
    stocks: new Map(raw.stocks.map((p) => [p.date, p.monthlyReturn])),
    bonds: new Map(raw.bonds.map((p) => [p.date, p.monthlyReturn])),
    cash: new Map(raw.cash.map((p) => [p.date, p.monthlyReturn])),
    inflation: new Map(raw.inflation.map((p) => [p.date, p.cpiIndex])),
  }

  const sharedDates = raw.stocks
    .map((p) => p.date)
    .filter(
      (date) =>
        byDate.bonds.has(date) && byDate.cash.has(date) && byDate.inflation.has(date),
    )
    .sort()

  const months: MarketMonth[] = sharedDates.map((date) => ({
    date,
    monthlyReturn: {
      stocks: byDate.stocks.get(date)!,
      bonds: byDate.bonds.get(date)!,
      cash: byDate.cash.get(date)!,
    },
    cpiIndex: byDate.inflation.get(date)!,
  }))

  const indexByDate = new Map(months.map((m, i) => [m.date, i]))

  return { months, indexByDate }
}

const DATA_FILES: Record<keyof MarketDataRaw, string> = {
  stocks: 'stocks.json',
  bonds: 'bonds.json',
  cash: 'cash.json',
  inflation: 'inflation.json',
}

/** Fetches public/data/*.json and aligns them. Base path defaults to the
 * app's static data directory; overridable for tests/tools. */
export async function loadMarketData(baseUrl = '/data'): Promise<MarketData> {
  const entries = Object.entries(DATA_FILES) as [keyof MarketDataRaw, string][]
  const results = await Promise.all(
    entries.map(async ([, file]) => {
      const res = await fetch(`${baseUrl}/${file}`)
      if (!res.ok) {
        throw new Error(`failed to load ${file}: ${res.status}`)
      }
      return res.json()
    }),
  )
  const raw = Object.fromEntries(
    entries.map(([key], i) => [key, results[i]]),
  ) as unknown as MarketDataRaw
  return alignMarketData(raw)
}
