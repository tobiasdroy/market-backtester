import { useEffect, useState } from 'react'

export interface SeriesSplice {
  from: string
  to: string
  source: string
  url: string
  note: string
}

export interface MarketMetadata {
  generatedAt: string
  pipelineVersion: string
  series: Record<
    'stocks' | 'bonds' | 'cash' | 'inflation',
    {
      splices: SeriesSplice[]
      earliestAvailable: string
      latestAvailable: string
      currencyAssumption: string
    }
  >
}

/** Loads public/data/metadata.json - used to constrain date pickers and
 * to surface splice/source documentation to users. */
export function useMarketMetadata() {
  const [metadata, setMetadata] = useState<MarketMetadata | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/data/metadata.json')
      .then((res) => {
        if (!res.ok) throw new Error(`failed to load metadata.json: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) setMetadata(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { metadata, error }
}
