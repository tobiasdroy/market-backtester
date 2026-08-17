import { useState } from 'react'
import { useBacktestWorker } from '@/hooks/useBacktestWorker'
import { useMarketMetadata } from '@/hooks/useMarketMetadata'
import { useResultsStore } from '@/store/resultsStore'
import { useStrategyStore } from '@/store/strategyStore'

type StartMode = 'single' | 'rolling'

const PRESETS = [
  { label: '1970s stagflation', date: '1970-01-01' },
  { label: '2008 crash', date: '2007-06-01' },
  { label: 'Dot-com bust', date: '2000-01-01' },
]

export function SimulationControls() {
  const strategy = useStrategyStore((s) => s.strategy)
  const setDurationYears = useStrategyStore((s) => s.setDurationYears)
  const { metadata } = useMarketMetadata()
  const { runSingle, runRolling } = useBacktestWorker()
  const setRunning = useResultsStore((s) => s.setRunning)
  const setProgress = useResultsStore((s) => s.setProgress)
  const setSingleResult = useResultsStore((s) => s.setSingleResult)
  const setRollingResult = useResultsStore((s) => s.setRollingResult)
  const setError = useResultsStore((s) => s.setError)
  const isRunning = useResultsStore((s) => s.isRunning)

  const [startMode, setStartMode] = useState<StartMode>('single')
  const [startDate, setStartDate] = useState('1990-01-01')
  const [stepYears, setStepYears] = useState(1)

  async function handleRun() {
    try {
      if (startMode === 'single') {
        setRunning('single')
        const result = await runSingle(strategy, startDate)
        setSingleResult(result)
      } else {
        setRunning('rolling')
        const result = await runRolling(strategy, { stepMonths: Math.round(stepYears * 12) }, (done, total) =>
          setProgress(done, total),
        )
        setRollingResult(result)
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
        <legend className="mb-1 text-sm text-text-secondary">Historical start date</legend>
        <label className="flex items-center gap-2 text-sm text-text-primary">
          <input
            type="radio"
            checked={startMode === 'single'}
            onChange={() => setStartMode('single')}
          />
          A specific start date
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
          Every possible start date (rolling)
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
