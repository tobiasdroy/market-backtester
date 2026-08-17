import { useEffect } from 'react'
import { buildShareUrl, readStrategyFromLocation } from '@/lib/urlState'
import { useStrategyStore } from '@/store/strategyStore'

/** On mount, loads a strategy encoded in the URL (a shared link) into the
 * store, if present and valid. */
export function useUrlSync() {
  const replaceStrategy = useStrategyStore((s) => s.replaceStrategy)

  useEffect(() => {
    const shared = readStrategyFromLocation()
    if (shared) replaceStrategy(shared)
    // Only ever consult the URL on first load - once running, the store
    // is the source of truth and edits shouldn't be clobbered by a stale
    // query param sitting in the address bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/** Builds a shareable link for the current strategy, copies it to the
 * clipboard, and reflects it in the address bar (so refreshing/bookmarking
 * the current tab also keeps it). */
export async function copyShareLink(strategy: Parameters<typeof buildShareUrl>[0]) {
  const url = buildShareUrl(strategy)
  window.history.replaceState(null, '', url)
  await navigator.clipboard.writeText(url)
  return url
}
