import { NOW, getActivityById, getBookingsByDeparture, getDeparturesInRange, getStorefrontAvailability } from '@/lib/demo'
import { addDays, toDateKey } from '@/lib/utils'
import { hasItems, itemsInBooking, rentalItemsOf, rentalSpan, shortestRentalMs } from '@/lib/rental-items'
import { timeOf, type PackagePartView } from '@/lib/packages'
import type { Activity } from '@/types'
import type { AvailabilityDay, AvailabilitySlot } from '@/components/storefront/booking-widget'

/* ==========================================================================
   Storefront availability — an activity's departures flattened into a day
   strip. Used by the activity page
   and by the guest's reschedule on the manage-booking page. Server-only.
   ========================================================================== */

export const STRIP_DAYS = 21

/**
 * Rentals with items: every booking that holds units, with when it goes out
 * and when it is ready again. A start time is free of an item only when no
 * hold overlaps the shortest rental from that time.
 */
function rentalHolds(activity: Activity, days: number) {
  const departures = getDeparturesInRange(activity.tenantId, addDays(NOW, -8), addDays(NOW, days + 1)).filter(
    (departure) => departure.activityId === activity.id && departure.status !== 'cancelled',
  )
  return departures.flatMap((departure) =>
    getBookingsByDeparture(departure.id)
      .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'refunded')
      .map((booking) => {
        const span = rentalSpan(activity, booking.id, departure.startsAt)
        return { from: span.startMs, to: span.readyMs, items: itemsInBooking(activity, booking) }
      }),
  )
}

export function rentalItemsLeftAt(activity: Activity, holds: ReturnType<typeof rentalHolds>, startsAt: string): Record<string, number> {
  const window = shortestRentalMs(activity, startsAt)
  const taken: Record<string, number> = {}
  for (const hold of holds) {
    if (hold.from >= window.endMs || hold.to <= window.startMs) continue
    for (const [tierId, qty] of Object.entries(hold.items)) taken[tierId] = (taken[tierId] ?? 0) + qty
  }
  return Object.fromEntries(rentalItemsOf(activity).map((item) => [item.tierId, Math.max(0, item.rentable - (taken[item.tierId] ?? 0))]))
}

export function buildDays(activity: Activity, STRIP_DAYS = 21): AvailabilityDay[] {
  const byDay = new Map<string, AvailabilitySlot[]>()
  const holds = hasItems(activity) ? rentalHolds(activity, STRIP_DAYS + 14) : null

  // Online booking closes this long before the start.
  const notice = activity.noticeHours ?? activity.charter?.noticeHours ?? 0
  const closesBefore = NOW.getTime() + notice * 3_600_000
  for (const event of getStorefrontAvailability(activity.id, STRIP_DAYS + 14)) {
    const { departure } = event
    if (notice > 0 && new Date(departure.startsAt).getTime() < closesBefore) continue
    const key = departure.startsAt.slice(0, 10)
    const multiplier = departure.priceMultiplier ?? 1
    // Rentals with items: each item has its own count; the slot total is what is left across them.
    const left = holds ? rentalItemsLeftAt(activity, holds, departure.startsAt) : undefined
    const seatsLeft = left ? Math.min(event.seatsLeft, Object.values(left).reduce((sum, value) => sum + value, 0)) : event.seatsLeft
    // A package on its own schedule can cap how many bookings one run takes.
    const bookingCap = activity.kind === 'package' && activity.package?.timing === 'own' ? activity.package.maxBookingsPerRun ?? 0 : 0
    const capReached =
      bookingCap > 0 && getBookingsByDeparture(departure.id).filter((booking) => booking.status !== 'cancelled' && booking.status !== 'refunded').length >= bookingCap
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
      ...(left ? { itemsLeft: left } : {}),
      soldOut: capReached || seatsLeft <= 0 || departure.status === 'sold_out',
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

/**
 * A package's parts with their own availability, kept to the times the
 * package allows. Each part's seats are that activity's seats, so booking
 * the package and booking the activity alone draw on the same count.
 */
export function buildPackageParts(activity: Activity, days = STRIP_DAYS): PackagePartView[] {
  return (activity.package?.parts ?? []).flatMap((part) => {
    const inner = getActivityById(part.activityId)
    if (!inner) return []
    const allowed = new Set(part.times)
    const site = part.locationId ? inner.locations.find((entry) => entry.locationId === part.locationId) : undefined
    return [
      {
        activityId: inner.id,
        slug: inner.slug,
        name: inner.name,
        label: part.label?.trim() || inner.name,
        durationMinutes: inner.durationMinutes,
        meetingPoint: site?.meetingPoint ?? inner.meetingPoint,
        basePrice: inner.basePrice,
        times: part.times,
        days: buildDays(inner, days + (activity.package?.sameDay === false ? activity.package.withinDays : 0)).map((day) => {
          const slots = day.slots.filter(
            (slot) => (allowed.size === 0 || allowed.has(timeOf(slot.startsAt))) && (!part.locationId || (slot.locationId ?? inner.locations[0]?.locationId) === part.locationId),
          )
          const open = slots.filter((slot) => !slot.soldOut)
          return { ...day, slots, seatsLeft: open.reduce((sum, slot) => sum + slot.seatsLeft, 0), soldOut: slots.length > 0 && open.length === 0 }
        }),
      },
    ]
  })
}
