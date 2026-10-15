'use client'

import * as React from 'react'

import { toast } from '@/components/ui/toaster'

/* ==========================================================================
   useRentalService — items taken out of service from the Rentals page (in
   repair, being cleaned, lost), per rental and item. Kept in the browser
   over the activity's own numbers; the storefront reads it too, so an item
   in the shop cannot be booked.
   ========================================================================== */

export const RENTAL_SERVICE_EVENT = 'ezra:rental-service'
const keyFor = (slug: string) => `ezra:rental-service:${slug}`

export interface ServiceState {
  count: number
  note: string
}

type Store = Record<string, Record<string, ServiceState>>

function read(slug: string) {
  try {
    return window.localStorage.getItem(keyFor(slug)) ?? ''
  } catch {
    return ''
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener(RENTAL_SERVICE_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(RENTAL_SERVICE_EVENT, onChange)
  }
}

export function useRentalService(slug: string) {
  const raw = React.useSyncExternalStore(subscribe, () => read(slug), () => '')
  const store = React.useMemo<Store>(() => {
    try {
      return raw ? (JSON.parse(raw) as Store) : {}
    } catch {
      return {}
    }
  }, [raw])

  return {
    /** The saved state, or the activity's own number when nothing was changed here. */
    get: (activityId: string, tierId: string, seeded: ServiceState): ServiceState => store[activityId]?.[tierId] ?? seeded,
    set: (activityId: string, tierId: string, state: ServiceState) => {
      const next: Store = { ...store, [activityId]: { ...store[activityId], [tierId]: state } }
      try {
        window.localStorage.setItem(keyFor(slug), JSON.stringify(next))
      } catch {
        toast.error('Could not save', { description: 'The browser storage is blocked.' })
      }
      window.dispatchEvent(new Event(RENTAL_SERVICE_EVENT))
    },
  }
}
