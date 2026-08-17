import { create } from 'zustand'
import type { MonteCarloResult } from '@/engine/monteCarlo'
import type { RollingBacktestResult } from '@/engine/rollingBacktest'
import type { SimulationResult } from '@/engine/types'

export type RunMode = 'single' | 'rolling' | 'monteCarlo'

interface ResultsStore {
  mode: RunMode | null
  singleResult: SimulationResult | null
  rollingResult: RollingBacktestResult | null
  monteCarloResult: MonteCarloResult | null
  isRunning: boolean
  progress: { done: number; total: number } | null
  error: string | null
  setRunning: (mode: RunMode) => void
  setProgress: (done: number, total: number) => void
  setSingleResult: (result: SimulationResult) => void
  setRollingResult: (result: RollingBacktestResult) => void
  setMonteCarloResult: (result: MonteCarloResult) => void
  setError: (message: string) => void
}

export const useResultsStore = create<ResultsStore>((set) => ({
  mode: null,
  singleResult: null,
  rollingResult: null,
  monteCarloResult: null,
  isRunning: false,
  progress: null,
  error: null,

  setRunning: (mode) => set({ mode, isRunning: true, error: null, progress: null }),
  setProgress: (done, total) => set({ progress: { done, total } }),
  setSingleResult: (result) =>
    set({
      singleResult: result,
      rollingResult: null,
      monteCarloResult: null,
      isRunning: false,
      progress: null,
    }),
  setRollingResult: (result) =>
    set({
      rollingResult: result,
      singleResult: null,
      monteCarloResult: null,
      isRunning: false,
      progress: null,
    }),
  setMonteCarloResult: (result) =>
    set({
      monteCarloResult: result,
      singleResult: null,
      rollingResult: null,
      isRunning: false,
      progress: null,
    }),
  setError: (message) => set({ error: message, isRunning: false, progress: null }),
}))
