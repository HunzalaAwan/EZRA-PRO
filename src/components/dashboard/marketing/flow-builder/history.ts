'use client'

import * as React from 'react'

/* ==========================================================================
   Undo and redo for the builder. Every change is a step back, except quick
   edits to the same field (typing a subject), which merge into one so a
   single undo takes back the whole word rather than a letter.
   ========================================================================== */

interface State<T> {
  past: T[]
  present: T
  future: T[]
  key: string | null
  at: number
}

const MAX = 100
const MERGE_MS = 900

export function useHistory<T>(initial: T) {
  const [state, setState] = React.useState<State<T>>({ past: [], present: initial, future: [], key: null, at: 0 })

  const set = React.useCallback((next: T, key?: string) => {
    setState((s) => {
      if (Object.is(next, s.present)) return s
      const now = Date.now()
      if (key && s.key === key && now - s.at < MERGE_MS) return { ...s, present: next, future: [], at: now }
      return { past: [...s.past, s.present].slice(-MAX), present: next, future: [], key: key ?? null, at: now }
    })
  }, [])

  const undo = React.useCallback(() => {
    setState((s) => {
      if (s.past.length === 0) return s
      const previous = s.past[s.past.length - 1]
      return { past: s.past.slice(0, -1), present: previous, future: [s.present, ...s.future], key: null, at: 0 }
    })
  }, [])

  const redo = React.useCallback(() => {
    setState((s) => {
      if (s.future.length === 0) return s
      const [next, ...rest] = s.future
      return { past: [...s.past, s.present].slice(-MAX), present: next, future: rest, key: null, at: 0 }
    })
  }, [])

  /**
   * Replace the present without making an undo step, and carry `patch` into
   * every past and future entry. Used after a save: undo should take back
   * edits, not quietly flip a live automation back to a draft.
   */
  const rebase = React.useCallback((present: T, patch: (entry: T) => T) => {
    setState((s) => ({ past: s.past.map(patch), present, future: s.future.map(patch), key: null, at: 0 }))
  }, [])

  return {
    present: state.present,
    set,
    undo,
    redo,
    rebase,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
