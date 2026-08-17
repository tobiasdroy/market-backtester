import { useState } from 'react'
import type { ComparisonEntry } from '@/engine/comparison'
import { MAX_ENTRIES, useComparisonStore } from '@/store/comparisonStore'

interface SaveToComparisonButtonProps {
  /** Builds the entry to save, using whatever name the user types. Only
   * called on save, so it's cheap to recompute from current results. */
  buildEntry: (name: string) => ComparisonEntry
  defaultName: string
}

/** A button that expands into an inline name field, so saving a result to
 * the comparison list doesn't need a modal for a single text input. */
export function SaveToComparisonButton({ buildEntry, defaultName }: SaveToComparisonButtonProps) {
  const entryCount = useComparisonStore((s) => s.entries.length)
  const addEntry = useComparisonStore((s) => s.addEntry)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(defaultName)

  function save() {
    addEntry(buildEntry(name.trim() || defaultName))
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setName(defaultName)
          setEditing(true)
        }}
        className="rounded-md border border-border px-3 py-1 text-sm text-text-secondary hover:bg-page"
      >
        + Add to comparison
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save()
          if (e.key === 'Escape') setEditing(false)
        }}
        autoFocus
        className="w-40 rounded-md border border-border bg-surface px-2 py-1 text-sm text-text-primary"
      />
      <button
        type="button"
        onClick={save}
        disabled={entryCount >= MAX_ENTRIES}
        title={entryCount >= MAX_ENTRIES ? `Comparison is limited to ${MAX_ENTRIES} strategies` : undefined}
        className="rounded-md bg-stocks px-3 py-1 text-sm text-white disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-sm text-text-secondary hover:underline"
      >
        Cancel
      </button>
    </div>
  )
}
