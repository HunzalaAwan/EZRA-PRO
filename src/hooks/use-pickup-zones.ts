'use client'

import * as React from 'react'

import type { PickupZone } from '@/types'

/* ==========================================================================
   usePickupZones — the business's pickup zones, live. Edits are kept in the
   browser (the demo has no backend) and laid over the seeded zones.
   ========================================================================== */

export const PICKUP_EVENT = 'ezra:pickup-zones'
const keyFor = (tenantId: string) => `ezra:pickup-zones:${tenantId}`

interface ZoneEdits {
  added: PickupZone[]
  updated: Record<string, Partial<PickupZone>>
  removed: string[]
}

const EMPTY: ZoneEdits = { added: [], updated: {}, removed: [] }

function read(tenantId: string) {
  try {
    return window.localStorage.getItem(keyFor(tenantId)) ?? ''
  } catch {
    return ''
  }
}

function parse(raw: string): ZoneEdits {
  if (!raw) return EMPTY
  try {
    const value = JSON.parse(raw) as Partial<ZoneEdits>
    return { added: value.added ?? [], updated: value.updated ?? {}, removed: value.removed ?? [] }
  } catch {
    return EMPTY
  }
}

export type ZoneInput = Omit<PickupZone, 'id' | 'tenantId'>

export function usePickupZones(tenantId: string, seeded: PickupZone[]) {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(PICKUP_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(PICKUP_EVENT, onChange)
    }
  }, [])
  const raw = React.useSyncExternalStore(subscribe, () => read(tenantId), () => '')
  const edits = React.useMemo(() => parse(raw), [raw])

  const zones = React.useMemo(() => {
    const removed = new Set(edits.removed)
    return [...seeded, ...edits.added]
      .filter((zone) => !removed.has(zone.id))
      .map((zone) => ({ ...zone, ...edits.updated[zone.id] }))
  }, [seeded, edits])

  const commit = React.useCallback(
    (next: ZoneEdits | null) => {
      try {
        if (next) window.localStorage.setItem(keyFor(tenantId), JSON.stringify(next))
        else window.localStorage.removeItem(keyFor(tenantId))
      } catch {
        /* storage blocked */
      }
      window.dispatchEvent(new Event(PICKUP_EVENT))
    },
    [tenantId],
  )

  return {
    zones,
    add: (input: ZoneInput) => {
      const zone: PickupZone = { ...input, id: `pz_new_${Date.now().toString(36)}`, tenantId }
      commit({ ...edits, added: [...edits.added, zone] })
      return zone
    },
    update: (id: string, patch: Partial<PickupZone>) =>
      commit({ ...edits, updated: { ...edits.updated, [id]: { ...edits.updated[id], ...patch } } }),
    remove: (id: string) =>
      commit({
        ...edits,
        added: edits.added.filter((zone) => zone.id !== id),
        removed: edits.added.some((zone) => zone.id === id) ? edits.removed : [...edits.removed, id],
      }),
    reset: () => commit(null),
    hasEdits: raw !== '',
  }
}
