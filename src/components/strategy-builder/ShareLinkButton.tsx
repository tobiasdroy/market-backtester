import { useState } from 'react'
import { copyShareLink } from '@/hooks/useUrlSync'
import { useStrategyStore } from '@/store/strategyStore'

export function ShareLinkButton() {
  const strategy = useStrategyStore((s) => s.strategy)
  const [copied, setCopied] = useState(false)

  async function handleClick() {
    await copyShareLink(strategy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="ml-auto shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary hover:bg-page"
    >
      {copied ? 'Link copied!' : 'Share strategy'}
    </button>
  )
}
