'use client'

import * as React from 'react'

import type { WaiverTemplate } from '@/types'

/* ==========================================================================
   useWaivers — the business's waiver templates, live. Edits are kept in the
   browser (the demo has no backend) and laid over the seeded templates.
   Saving a change bumps the version, so signatures say which text a guest
   agreed to.
   ========================================================================== */

export const WAIVERS_EVENT = 'ezra:waivers'
const keyFor = (tenantId: string) => `ezra:waivers:${tenantId}`

interface WaiverEdits {
  added: WaiverTemplate[]
  updated: Record<string, Partial<WaiverTemplate>>
}

const EMPTY: WaiverEdits = { added: [], updated: {} }

function read(tenantId: string): string {
  try {
    return window.localStorage.getItem(keyFor(tenantId)) ?? ''
  } catch {
    return ''
  }
}

function parse(raw: string): WaiverEdits {
  if (!raw) return EMPTY
  try {
    const parsed = JSON.parse(raw) as Partial<WaiverEdits>
    return { added: Array.isArray(parsed.added) ? parsed.added : [], updated: parsed.updated ?? {} }
  } catch {
    return EMPTY
  }
}

function write(tenantId: string, edits: WaiverEdits | null) {
  try {
    if (edits) window.localStorage.setItem(keyFor(tenantId), JSON.stringify(edits))
    else window.localStorage.removeItem(keyFor(tenantId))
  } catch {
    /* blocked storage: the edit lives for this page only */
  }
  window.dispatchEvent(new Event(WAIVERS_EVENT))
}

export type WaiverInput = Pick<WaiverTemplate, 'title' | 'body' | 'minorsNeedGuardian' | 'minorAge'>

export function useWaivers(tenantId: string, seeded: WaiverTemplate[]) {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(WAIVERS_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(WAIVERS_EVENT, onChange)
    }
  }, [])
  const raw = React.useSyncExternalStore(subscribe, () => read(tenantId), () => '')
  const edits = React.useMemo(() => parse(raw), [raw])

  const waivers = React.useMemo(
    () => [...seeded, ...edits.added].map((waiver) => ({ ...waiver, ...edits.updated[waiver.id] })),
    [seeded, edits],
  )

  const save = React.useCallback(
    (id: string, input: WaiverInput) => {
      const current = waivers.find((waiver) => waiver.id === id)
      if (!current) return
      write(tenantId, {
        ...edits,
        updated: {
          ...edits.updated,
          [id]: { ...input, version: current.version + 1, updatedAt: new Date().toISOString().slice(0, 19) },
        },
      })
    },
    [edits, tenantId, waivers],
  )

  const add = React.useCallback(
    (input: WaiverInput): WaiverTemplate => {
      const waiver: WaiverTemplate = {
        id: `wvr_new_${Date.now().toString(36)}`,
        tenantId,
        version: 1,
        updatedAt: new Date().toISOString().slice(0, 19),
        ...input,
      }
      write(tenantId, { ...edits, added: [...edits.added, waiver] })
      return waiver
    },
    [edits, tenantId],
  )

  const reset = React.useCallback(() => write(tenantId, null), [tenantId])

  return { waivers, save, add, reset, hasEdits: raw !== '' }
}
