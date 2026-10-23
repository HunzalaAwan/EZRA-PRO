'use server'

import { getStorefront } from '@/lib/demo'
import { buildDays } from '@/lib/storefront-availability'
import { SUGGEST_WINDOW_DAYS } from '@/lib/sold-out'
import type { Activity } from '@/types'
import type { AvailabilityDay } from '@/components/storefront/booking-widget'

/** The most activities one fully booked day asks about. */
const MOST = 6

/**
 * The other activities a fully booked day suggests, each with its seeded
 * days for the next two weeks. Asked for only when such a day is shown, so
 * the activity page never carries every other activity's time slots.
 */
export async function suggestedActivityDays(tenantSlug: string, ids: string[]): Promise<{ activity: Activity; days: AvailabilityDay[] }[]> {
  const storefront = getStorefront(tenantSlug)
  if (!storefront || !Array.isArray(ids)) return []
  const wanted = [...new Set(ids.filter((id) => typeof id === 'string'))].slice(0, MOST)
  return wanted
    .map((id) => storefront.activities.find((activity) => activity.id === id))
    .filter((activity): activity is Activity => Boolean(activity) && activity!.kind !== 'package' && activity!.category !== 'restaurants')
    .map((activity) => ({ activity, days: buildDays(activity, SUGGEST_WINDOW_DAYS) }))
}
