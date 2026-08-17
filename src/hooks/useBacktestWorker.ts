import * as Comlink from 'comlink'
import { useEffect, useRef } from 'react'
import type { RollingBacktestOptions } from '@/engine/rollingBacktest'
import type { WorkerApi } from '@/engine/worker'

let sharedWorker: Comlink.Remote<WorkerApi> | null = null

function getWorker(): Comlink.Remote<WorkerApi> {
  if (!sharedWorker) {
    const worker = new Worker(new URL('../engine/worker.ts', import.meta.url), {
      type: 'module',
    })
    sharedWorker = Comlink.wrap<WorkerApi>(worker)
  }
  return sharedWorker
}

/** Runs simulations off the main thread via a shared Web Worker. */
export function useBacktestWorker() {
  const workerRef = useRef(getWorker())

  useEffect(() => {
    workerRef.current = getWorker()
  }, [])

  return {
    runSingle: (strategy: Parameters<WorkerApi['runSingle']>[0], startDate: string) =>
      workerRef.current.runSingle(strategy, startDate),
    runRolling: (
      strategy: Parameters<WorkerApi['runRolling']>[0],
      options: Omit<RollingBacktestOptions, 'onProgress'>,
      onProgress?: (done: number, total: number) => void,
    ) =>
      workerRef.current.runRolling(
        strategy,
        options,
        onProgress ? Comlink.proxy(onProgress) : undefined,
      ),
  }
}
