import { nanoid } from 'nanoid'
import { create } from 'zustand'
import type { AllocationTarget, Strategy, StrategyRule } from '@/engine/types'

function defaultStrategy(): Strategy {
  return {
    id: nanoid(),
    name: 'My strategy',
    initialPortfolio: {
      startValue: 20_000,
      allocation: { stocks: 1, bonds: 0, cash: 0 },
    },
    durationMonths: 30 * 12,
    rules: [],
    contributionAllocation: 'proRata',
  }
}

interface StrategyStore {
  strategy: Strategy
  setName: (name: string) => void
  setInitialPortfolio: (startValue: number, allocation: AllocationTarget) => void
  setDurationYears: (years: number) => void
  setContributionAllocation: (mode: 'proRata' | 'lastTarget') => void
  addRule: (rule: StrategyRule) => void
  updateRule: (id: string, rule: StrategyRule) => void
  removeRule: (id: string) => void
  replaceStrategy: (strategy: Strategy) => void
  reset: () => void
}

export const useStrategyStore = create<StrategyStore>((set) => ({
  strategy: defaultStrategy(),

  setName: (name) => set((s) => ({ strategy: { ...s.strategy, name } })),

  setInitialPortfolio: (startValue, allocation) =>
    set((s) => ({
      strategy: { ...s.strategy, initialPortfolio: { startValue, allocation } },
    })),

  setDurationYears: (years) =>
    set((s) => ({ strategy: { ...s.strategy, durationMonths: Math.round(years * 12) } })),

  setContributionAllocation: (mode) =>
    set((s) => ({ strategy: { ...s.strategy, contributionAllocation: mode } })),

  addRule: (rule) => set((s) => ({ strategy: { ...s.strategy, rules: [...s.strategy.rules, rule] } })),

  updateRule: (id, rule) =>
    set((s) => ({
      strategy: {
        ...s.strategy,
        rules: s.strategy.rules.map((r) => (r.id === id ? rule : r)),
      },
    })),

  removeRule: (id) =>
    set((s) => ({
      strategy: { ...s.strategy, rules: s.strategy.rules.filter((r) => r.id !== id) },
    })),

  replaceStrategy: (strategy) => set({ strategy }),

  reset: () => set({ strategy: defaultStrategy() }),
}))
