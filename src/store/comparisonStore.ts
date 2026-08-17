import { create } from 'zustand'
import type { ComparisonEntry } from '@/engine/comparison'

const MAX_ENTRIES = 8

interface ComparisonStore {
  entries: ComparisonEntry[]
  addEntry: (entry: ComparisonEntry) => void
  removeEntry: (id: string) => void
  clear: () => void
}

export const useComparisonStore = create<ComparisonStore>((set) => ({
  entries: [],

  addEntry: (entry) =>
    set((s) => ({ entries: [...s.entries, entry].slice(-MAX_ENTRIES) })),

  removeEntry: (id) => set((s) => ({ entries: s.entries.filter((e) => e.id !== id) })),

  clear: () => set({ entries: [] }),
}))

export { MAX_ENTRIES }
