'use client'

import * as React from 'react'

import { RIDES_EVENT, readRideAssignments, ridesKey, saveRideAssignment, type RideAssignment } from '@/lib/transfer-rides'

/* ==========================================================================
   useRideAssignments — who drives each ride, in what, and how far along it
   is, live across every open screen (the Rides board, the booking's Ride
   card). Kept in the browser (`ezra:transfer-rides:<slug>`); empty on the
   server and on the first render, so both sides render the same thing.
   ========================================================================== */

export function useRideAssignments(slug: string): {
  assignments: Record<string, RideAssignment>
  save: (rideId: string, patch: Partial<RideAssignment>) => void
} {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(RIDES_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(RIDES_EVENT, onChange)
    }
  }, [])
  const raw = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(ridesKey(slug)) ?? ''
      } catch {
        return ''
      }
    },
    () => '',
  )
  // Parsed from the raw string so it only changes when the store does.
  const assignments = React.useMemo(() => (raw ? readRideAssignments(slug) : {}), [raw, slug])
  const save = React.useCallback((rideId: string, patch: Partial<RideAssignment>) => saveRideAssignment(slug, rideId, patch), [slug])
  return { assignments, save }
}
