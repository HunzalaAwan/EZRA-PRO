import { NOW, getBookingsByDeparture, getStorefrontAvailability } from '@/lib/demo'
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
    const slots = applyDayLimit(
      activity,
      dateKey,
      (byDay.get(dateKey) ?? []).sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0)),
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

/**
 * The optional daily limit: the most sold on a weekday across all of a
 * location's departures. In tickets, what is left of the day caps every
 * departure; in bookings, a day that has taken its number is closed.
 */
export function applyDayLimit(activity: Activity, dateKey: string, slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const weekday = new Date(`${dateKey}T12:00:00`).getDay()
  const siteOf = (slot: AvailabilitySlot) => activity.locations.find((site) => site.locationId === slot.locationId) ?? activity.locations[0]
  const bySite = new Map<string, AvailabilitySlot[]>()
  for (const slot of slots) {
    const key = siteOf(slot)?.locationId ?? ''
    bySite.set(key, [...(bySite.get(key) ?? []), slot])
  }
  const limited = new Map<string, AvailabilitySlot>()
  for (const [key, list] of bySite) {
    const site = activity.locations.find((entry) => entry.locationId === key) ?? activity.locations[0]
    const limit = site?.dayCapacity?.[weekday]
    if (!limit || limit <= 0) continue
    if (site?.dayLimitUnit === 'bookings') {
      const taken = list.reduce((sum, slot) => sum + getBookingsByDeparture(slot.departureId).filter((booking) => booking.status !== 'cancelled' && booking.status !== 'refunded').length, 0)
      if (taken >= limit) for (const slot of list) limited.set(slot.departureId, { ...slot, seatsLeft: 0, soldOut: true })
      continue
    }
    const used = list.reduce((sum, slot) => sum + Math.max(0, slot.capacity - slot.seatsLeft), 0)
    const room = Math.max(0, limit - used)
    for (const slot of list) {
      const seatsLeft = Math.min(slot.seatsLeft, room)
      limited.set(slot.departureId, { ...slot, seatsLeft, soldOut: slot.soldOut || seatsLeft <= 0 })
    }
  }
  return slots.map((slot) => limited.get(slot.departureId) ?? slot)
}
