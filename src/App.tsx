import { StrategyBuilderPage } from '@/app/StrategyBuilderPage'

function App() {
  return (
    <div className="min-h-svh bg-page">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-4">
          <h1 className="text-xl">Market Backtester</h1>
          <p className="text-sm text-text-muted">
            Real historical UK stock, bond, cash &amp; inflation data
          </p>
        </div>
      </header>
      <StrategyBuilderPage />
    </div>
  )
}

export default App
