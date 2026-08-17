import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { strategySchema } from '@/engine/schema'
import type { Strategy } from '@/engine/types'

export const STRATEGY_QUERY_PARAM = 's'

export function encodeStrategy(strategy: Strategy): string {
  return compressToEncodedURIComponent(JSON.stringify(strategy))
}

/** Decodes and validates a strategy from a URL param value. Returns null
 * for anything malformed, truncated, or failing schema validation - a
 * shared link is untrusted input, never assumed well-formed. */
export function decodeStrategy(encoded: string): Strategy | null {
  try {
    const json = decompressFromEncodedURIComponent(encoded)
    if (!json) return null
    const parsed = JSON.parse(json)
    const result = strategySchema.safeParse(parsed)
    return result.success ? (result.data as Strategy) : null
  } catch {
    return null
  }
}

export function buildShareUrl(strategy: Strategy): string {
  const url = new URL(window.location.href)
  url.searchParams.set(STRATEGY_QUERY_PARAM, encodeStrategy(strategy))
  return url.toString()
}

export function readStrategyFromLocation(): Strategy | null {
  const param = new URLSearchParams(window.location.search).get(STRATEGY_QUERY_PARAM)
  return param ? decodeStrategy(param) : null
}
