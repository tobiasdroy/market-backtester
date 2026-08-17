import { StrategyBuilderPage } from '@/app/StrategyBuilderPage'
import { ShareLinkButton } from '@/components/strategy-builder/ShareLinkButton'
import { useUrlSync } from '@/hooks/useUrlSync'

function App() {
  useUrlSync()

  return (
    <div className="min-h-svh bg-page">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4">
          <h1 className="text-xl">Market Backtester</h1>
          <p className="text-sm text-text-muted">
            Real historical UK stock, bond, cash &amp; inflation data
          </p>
          <ShareLinkButton />
        </div>
      </header>
      <StrategyBuilderPage />
    </div>
  )
}

export default App
