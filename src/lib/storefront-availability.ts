import { NOW, getStorefrontAvailability } from '@/lib/demo'
import { addDays, toDateKey } from '@/lib/utils'
import type { Activity } from '@/types'
import type { AvailabilityDay, AvailabilitySlot } from '@/components/storefront/booking-widget'

/* ==========================================================================
   Storefront availability — an activity's departures flattened into a day
   strip. Used by the activity page
   and by the guest's reschedule on the manage-booking page. Server-only.
   ========================================================================== */

export const STRIP_DAYS = 21

export function buildDays(activity: Activity, STRIP_DAYS = 21): AvailabilityDay[] {
  const byDay = new Map<string, AvailabilitySlot[]>()

  for (const event of getStorefrontAvailability(activity.id, STRIP_DAYS + 14)) {
    const { departure } = event
    const key = departure.startsAt.slice(0, 10)
    const multiplier = departure.priceMultiplier ?? 1
    const seatsLeft = event.seatsLeft
    const slot: AvailabilitySlot = {
      departureId: departure.id,
      startsAt: departure.startsAt,
      endsAt: departure.endsAt,
      capacity: departure.capacity,
      seatsLeft,
      status: departure.status,
      priceMultiplier: multiplier,
      leadPrice: Math.round((departure.priceOverride ?? activity.basePrice) * multiplier),
      locationId: departure.locationId,
      soldOut: seatsLeft <= 0 || departure.status === 'sold_out',
    }
    const list = byDay.get(key)
    if (list) list.push(slot)
    else byDay.set(key, [slot])
  }

  return Array.from({ length: STRIP_DAYS }, (_, index) => {
    const dateKey = toDateKey(addDays(NOW, index))
    const slots = (byDay.get(dateKey) ?? []).sort((a, b) =>
      a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0,
    )
    const open = slots.filter((slot) => !slot.soldOut)
    return {
      dateKey,
      slots,
      fromPrice: open.length > 0 ? Math.min(...open.map((slot) => slot.leadPrice)) : 0,
      seatsLeft: open.reduce((total, slot) => total + slot.seatsLeft, 0),
      soldOut: slots.length > 0 && open.length === 0,
    }
  })
}
