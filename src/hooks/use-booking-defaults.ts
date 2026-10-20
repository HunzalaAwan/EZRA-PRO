'use client'

import * as React from 'react'

import { toast } from '@/components/ui/toaster'
import { normalizeDefaults, withBookingDefaults, type BookingDefaults } from '@/lib/booking-defaults'
import type { Activity } from '@/types'

/* ==========================================================================
   useBookingDefaults — Settings → Booking flow, kept in the browser (the
   demo has no backend) and read live by the activity editor, the
   storefront, checkout and the bookings screens.
   ========================================================================== */

const EVENT = 'ezra:booking-defaults'
const keyFor = (slug: string) => `ezra:booking-defaults:${slug}`

function read(slug: string) {
  try {
    return window.localStorage.getItem(keyFor(slug)) ?? ''
  } catch {
    return ''
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(EVENT, onChange)
  }
}

export function useBookingDefaults(slug: string) {
  const raw = React.useSyncExternalStore(subscribe, () => read(slug), () => '')
  const defaults = React.useMemo<BookingDefaults>(() => {
    if (!raw) return normalizeDefaults(null)
    try {
      return normalizeDefaults(JSON.parse(raw))
    } catch {
      return normalizeDefaults(null)
    }
  }, [raw])

  const save = React.useCallback(
    (next: BookingDefaults): boolean => {
      try {
        window.localStorage.setItem(keyFor(slug), JSON.stringify(next))
        window.dispatchEvent(new Event(EVENT))
        return true
      } catch {
        toast.error('Could not save', { description: 'This browser’s storage is full or blocked.' })
        return false
      }
    },
    [slug],
  )

  return { defaults, save, saved: raw !== '' }
}

/** The activity with the business's booking defaults applied where it follows them. */
export function useActivityWithDefaults<T extends Activity>(activity: T, slug: string): T {
  const { defaults } = useBookingDefaults(slug)
  return React.useMemo(() => withBookingDefaults(activity, defaults), [activity, defaults])
}
