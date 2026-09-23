'use client'

import * as React from 'react'

import {
  LOCATIONS_EVENT,
  mergeLocations,
  newLocationId,
  parseLocationEdits,
  readLocationEditsRaw,
  slugifyLocation,
  writeLocationEdits,
  type LocationEdits,
} from '@/lib/locations'
import type { Location } from '@/types'

/* ==========================================================================
   useLocations — the business's bases, live.

   The server renders the seeded bases; after hydration the client lays the
   operator's edits over them, and a change made in another tab arrives
   through the `storage` event.
   ========================================================================== */

export type LocationInput = Pick<Location, 'name' | 'addressLine' | 'city'> &
  Partial<Pick<Location, 'timezone' | 'phone' | 'notes' | 'isDefault' | 'status'>>

export function useLocations(tenantId: string, seeded: Location[]) {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(LOCATIONS_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(LOCATIONS_EVENT, onChange)
    }
  }, [])

  const raw = React.useSyncExternalStore(subscribe, () => readLocationEditsRaw(tenantId), () => '')
  const edits = React.useMemo(() => parseLocationEdits(raw), [raw])
  const locations = React.useMemo(() => mergeLocations(seeded, edits), [seeded, edits])

  const commit = React.useCallback((next: LocationEdits | null) => writeLocationEdits(tenantId, next), [tenantId])

  const add = React.useCallback(
    (input: LocationInput): Location => {
      const id = newLocationId()
      const location: Location = {
        id,
        tenantId,
        slug: slugifyLocation(input.name) || id,
        name: input.name.trim(),
        addressLine: input.addressLine.trim(),
        city: input.city.trim(),
        timezone: input.timezone,
        phone: input.phone?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        isDefault: Boolean(input.isDefault),
        status: input.status ?? 'active',
      }
      commit({
        ...edits,
        added: [...edits.added, location],
        defaultId: input.isDefault ? id : edits.defaultId,
      })
      return location
    },
    [commit, edits, tenantId],
  )

  const update = React.useCallback(
    (id: string, patch: Partial<Location>) => {
      const { isDefault, ...rest } = patch
      const next: LocationEdits = {
        ...edits,
        updated: { ...edits.updated, [id]: { ...edits.updated[id], ...rest } },
        defaultId: isDefault ? id : edits.defaultId,
      }
      commit(next)
    },
    [commit, edits],
  )

  const remove = React.useCallback(
    (id: string) => {
      const updated = { ...edits.updated }
      delete updated[id]
      commit({
        added: edits.added.filter((site) => site.id !== id),
        updated,
        removed: edits.added.some((site) => site.id === id) ? edits.removed : [...edits.removed, id],
        defaultId: edits.defaultId === id ? undefined : edits.defaultId,
      })
    },
    [commit, edits],
  )

  const makeDefault = React.useCallback((id: string) => commit({ ...edits, defaultId: id }), [commit, edits])

  const reset = React.useCallback(() => commit(null), [commit])

  return { locations, add, update, remove, makeDefault, reset, hasEdits: raw !== '' }
}
