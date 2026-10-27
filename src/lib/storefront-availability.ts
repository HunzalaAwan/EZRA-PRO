import { NOW, getActivityById, getBookingsByDeparture, getDeparturesInRange, getStorefrontAvailability } from '@/lib/demo'
import { addDays, toDateKey } from '@/lib/utils'
import { hasItems, itemsInBooking, rentalItemsOf, rentalSpan, shortestRentalMs } from '@/lib/rental-items'
import { timeOf, type PackagePartView } from '@/lib/packages'
import type { Activity } from '@/types'
import { slotLeadPrice } from '@/lib/price-engine'
import { holdsOfDetails, type TransferHold } from '@/lib/transfers'
import type { AvailabilityDay, AvailabilitySlot } from '@/components/storefront/booking-widget'

/* ==========================================================================
   Storefront availability — an activity's departures flattened into a day
   strip. Used by the activity page
   and by the guest's reschedule on the manage-booking page. Server-only.
   ========================================================================== */

export const STRIP_DAYS = 21

const pad2 = (n: number) => String(n).padStart(2, '0')
/** The demo clock as a local ISO, like every startsAt. */
const localIso = (date: Date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:00`

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

/**
 * Rentals with items: what is free of each item at a start time the seeded
 * strip doesn't have (a time slot from a saved schedule), so checkout never
 * lets out an item an overlapping rental already holds. Undefined without items.
 */
export function rentalItemsLeftFor(activity: Activity, startsAt: string): Record<string, number> | undefined {
  if (!hasItems(activity)) return undefined
  // Every seeded time slot ahead (the demo seeds about 60 days).
  return rentalItemsLeftAt(activity, rentalHolds(activity, 62), startsAt)
}

/** A transfer's seeded rides as vehicle holds, for the widget, checkout and the manage page to count free vehicles. */
export interface TransferAvailability {
  holds: TransferHold[]
}

/**
 * Every seeded ride of a transfer that still holds its vehicles, one hold per
 * leg per vehicle size: rides whose first pickup is from two weeks back (a
 * round trip's return can still be ahead) to the end of the seeded days.
 * Cancelled and refunded bookings hold nothing. Server-only.
 */
export function buildTransferAvailability(activity: Activity): TransferAvailability {
  if (activity.kind !== 'transfer' || !activity.transfer) return { holds: [] }
  const departures = getDeparturesInRange(activity.tenantId, addDays(NOW, -14), addDays(NOW, 62)).filter((departure) => departure.activityId === activity.id)
  const seen = new Set<string>()
  const holds: TransferHold[] = []
  for (const departure of departures) {
    for (const booking of getBookingsByDeparture(departure.id)) {
      if (seen.has(booking.id) || !booking.transfer || booking.status === 'cancelled' || booking.status === 'refunded') continue
      seen.add(booking.id)
      holds.push(...holdsOfDetails(activity, booking.transfer, booking.reference))
    }
  }
  return { holds }
}

export function buildDays(activity: Activity, STRIP_DAYS = 21): AvailabilityDay[] {
  const byDay = new Map<string, AvailabilitySlot[]>()
  const holds = hasItems(activity) ? rentalHolds(activity, STRIP_DAYS + 14) : null

  // Online booking closes this long before the start.
  const notice = activity.noticeHours ?? activity.charter?.noticeHours ?? 0
  const closesBefore = NOW.getTime() + notice * 3_600_000
  const nowLocal = localIso(NOW)
  for (const event of getStorefrontAvailability(activity.id, STRIP_DAYS + 14)) {
    const { departure } = event
    if (notice > 0 && new Date(departure.startsAt).getTime() < closesBefore) continue
    const key = departure.startsAt.slice(0, 10)
    const multiplier = departure.priceMultiplier ?? 1
    // Rentals with items: each item has its own count; the slot total is what is left across them.
    const left = holds ? rentalItemsLeftAt(activity, holds, departure.startsAt) : undefined
    const seatsLeft = left ? Math.min(event.seatsLeft, Object.values(left).reduce((sum, value) => sum + value, 0)) : event.seatsLeft
    const slot: AvailabilitySlot = {
      departureId: departure.id,
      startsAt: departure.startsAt,
      endsAt: departure.endsAt,
      capacity: departure.capacity,
      seatsLeft,
      booked: departure.booked,
      status: departure.status,
      priceMultiplier: multiplier,
      // The engine's lead price. A seeded priceOverride already carries the multiplier, so it is never multiplied again.
      leadPrice: slotLeadPrice(activity, departure, { startsAt: departure.startsAt, nowIso: nowLocal, capacity: departure.capacity, booked: departure.booked }),
      locationId: departure.locationId,
      ...(left ? { itemsLeft: left } : {}),
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
 * departure; in bookings, a day that has taken its number is closed. A
 * pass's tickets are a day's too, shared by its time slots.
 */
export function applyDayLimit(activity: Activity, dateKey: string, slots: AvailabilitySlot[]): AvailabilitySlot[] {
  const weekday = new Date(`${dateKey}T12:00:00`).getDay()
  const passLimit = (activity.kind ?? 'trip') === 'pass' && activity.maxCapacity > 0 ? activity.maxCapacity : 0
  const siteOf = (slot: AvailabilitySlot) => activity.locations.find((site) => site.locationId === slot.locationId) ?? activity.locations[0]
  const bySite = new Map<string, AvailabilitySlot[]>()
  for (const slot of slots) {
    const key = siteOf(slot)?.locationId ?? ''
    bySite.set(key, [...(bySite.get(key) ?? []), slot])
  }
  const limited = new Map<string, AvailabilitySlot>()
  for (const [key, list] of bySite) {
    const site = activity.locations.find((entry) => entry.locationId === key) ?? activity.locations[0]
    const dayLimit = site?.dayCapacity?.[weekday]
    const byBookings = Boolean(dayLimit && dayLimit > 0 && site?.dayLimitUnit === 'bookings')
    if (byBookings) {
      const taken = list.reduce((sum, slot) => sum + getBookingsByDeparture(slot.departureId).filter((booking) => booking.status !== 'cancelled' && booking.status !== 'refunded').length, 0)
      if (taken >= dayLimit!) {
        for (const slot of list) limited.set(slot.departureId, { ...slot, seatsLeft: 0, soldOut: true })
        continue
      }
    }
    const tickets = [!byBookings && dayLimit && dayLimit > 0 ? dayLimit : 0, passLimit].filter((value) => value > 0)
    if (tickets.length === 0) continue
    const limit = Math.min(...tickets)
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
        // Booked alone, per person: the part's standard ticket, compared like for like with the package's own first ticket.
        basePrice: inner.priceTiers[0]?.price ?? inner.basePrice,
        times: part.times,
        source: inner,
        ...(part.locationId ? { locationId: part.locationId } : {}),
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
