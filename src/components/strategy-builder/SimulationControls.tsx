import { useState } from 'react'
import { useBacktestWorker } from '@/hooks/useBacktestWorker'
import { useMarketMetadata } from '@/hooks/useMarketMetadata'
import { useResultsStore } from '@/store/resultsStore'
import { useStrategyStore } from '@/store/strategyStore'

type StartMode = 'single' | 'rolling' | 'monteCarlo'

const PRESETS = [
  { label: '1970s stagflation', date: '1970-01-01' },
  { label: '2008 crash', date: '2007-06-01' },
  { label: 'Dot-com bust', date: '2000-01-01' },
]

export function SimulationControls() {
  const strategy = useStrategyStore((s) => s.strategy)
  const setDurationYears = useStrategyStore((s) => s.setDurationYears)
  const { metadata } = useMarketMetadata()
  const { runSingle, runRolling, runMonteCarlo } = useBacktestWorker()
  const setRunning = useResultsStore((s) => s.setRunning)
  const setProgress = useResultsStore((s) => s.setProgress)
  const setSingleResult = useResultsStore((s) => s.setSingleResult)
  const setRollingResult = useResultsStore((s) => s.setRollingResult)
  const setMonteCarloResult = useResultsStore((s) => s.setMonteCarloResult)
  const setError = useResultsStore((s) => s.setError)
  const isRunning = useResultsStore((s) => s.isRunning)

  const [startMode, setStartMode] = useState<StartMode>('single')
  const [startDate, setStartDate] = useState('1990-01-01')
  const [stepYears, setStepYears] = useState(1)
  const [monteCarloRuns, setMonteCarloRuns] = useState(500)
  const [blockYears, setBlockYears] = useState(2)

  async function handleRun() {
    try {
      if (startMode === 'single') {
        setRunning('single')
        const result = await runSingle(strategy, startDate)
        setSingleResult(result)
      } else if (startMode === 'rolling') {
        setRunning('rolling')
        const result = await runRolling(strategy, { stepMonths: Math.round(stepYears * 12) }, (done, total) =>
          setProgress(done, total),
        )
        setRollingResult(result)
      } else {
        setRunning('monteCarlo')
        const result = await runMonteCarlo(
          strategy,
          { runs: monteCarloRuns, blockSizeMonths: Math.round(blockYears * 12) },
          (done, total) => setProgress(done, total),
        )
        setMonteCarloResult(result)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const minDate = metadata?.series.stocks.earliestAvailable.slice(0, 7)
  const maxDate = metadata?.series.stocks.latestAvailable.slice(0, 7)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="text-lg">Run backtest</h2>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-text-secondary">Simulation length (years)</span>
        <input
          type="number"
          min={1}
          max={100}
          value={strategy.durationMonths / 12}
          onChange={(e) => setDurationYears(Number(e.target.value))}
          className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm text-text-secondary">How to test it</legend>
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="radio"
            checked={startMode === 'single'}
            onChange={() => setStartMode('single')}
          />
          A specific historical start date
        </label>
        {startMode === 'single' && (
          <div className="ml-6 flex flex-col gap-2">
            <input
              type="month"
              value={startDate.slice(0, 7)}
              min={minDate}
              max={maxDate}
              onChange={(e) => setStartDate(`${e.target.value}-01`)}
              className="w-40 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
            />
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setStartDate(preset.date)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-text-secondary hover:bg-page"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="radio"
            checked={startMode === 'rolling'}
            onChange={() => setStartMode('rolling')}
          />
          Every possible historical start date (rolling)
        </label>
        {startMode === 'rolling' && (
          <label className="ml-6 flex flex-col gap-1">
            <span className="text-sm text-text-secondary">Step between start dates (years)</span>
            <input
              type="number"
              min={1}
              max={10}
              value={stepYears}
              onChange={(e) => setStepYears(Number(e.target.value))}
              className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="radio"
            checked={startMode === 'monteCarlo'}
            onChange={() => setStartMode('monteCarlo')}
          />
          Randomized future scenarios (Monte Carlo)
        </label>
        {startMode === 'monteCarlo' && (
          <div className="ml-6 flex flex-wrap gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">Number of scenarios</span>
              <input
                type="number"
                min={10}
                max={5000}
                step={10}
                value={monteCarloRuns}
                onChange={(e) => setMonteCarloRuns(Number(e.target.value))}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm text-text-secondary">Historical block size (years)</span>
              <input
                type="number"
                min={1}
                max={10}
                value={blockYears}
                onChange={(e) => setBlockYears(Number(e.target.value))}
                className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-text-primary"
              />
            </label>
            <p className="w-full text-xs text-text-muted">
              Builds each scenario from randomly-chosen {blockYears}-year chunks of real
              history stitched together, rather than replaying one actual sequence -
              explores hypothetical futures history didn&rsquo;t happen to produce.
            </p>
          </div>
        )}
      </fieldset>

      <button
        type="button"
        onClick={handleRun}
        disabled={isRunning}
        className="self-start rounded-md bg-stocks px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isRunning ? 'Running…' : 'Run backtest'}
      </button>
    </section>
  )
}
