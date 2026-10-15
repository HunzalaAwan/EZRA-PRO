import { addDays, hashSeed } from '@/lib/utils'
import type { Activity, Booking, PriceTier, RentalItem } from '@/types'

/* ==========================================================================
   Rental items — what a rental lends out, each with its own stock. One
   booking link sells every item: a guest takes two singles and a double,
   and each is counted against its own shelf. Browser-safe.
   ========================================================================== */

export interface RentalItemView extends RentalItem {
  name: string
  /** One line for guests, from the price tier. */
  description: string
  /** Most one booking can take. */
  maxPerBooking: number
  /** Stock minus what is out of service. */
  rentable: number
}

/** True when the rental counts stock per item rather than one shared pool. */
export const hasItems = (activity: Pick<Activity, 'kind' | 'rental'>) => (activity.kind ?? 'trip') === 'rental' && (activity.rental?.items?.length ?? 0) > 0

/** The items of a rental, joined with their names. Older rentals without items read as one shared pool per tier. */
export function rentalItemsOf(activity: Pick<Activity, 'rental' | 'priceTiers' | 'maxCapacity'>): RentalItemView[] {
  const items = activity.rental?.items
  const view = (tier: PriceTier, item: RentalItem): RentalItemView => ({
    ...item,
    name: tier.label,
    description: tier.description ?? '',
    maxPerBooking: tier.maxQuantity,
    rentable: Math.max(0, item.stock - (item.outOfService ?? 0)),
  })
  if (items && items.length > 0) {
    return activity.priceTiers.flatMap((tier) => {
      const item = items.find((entry) => entry.tierId === tier.id)
      return item ? [view(tier, item)] : []
    })
  }
  const units = activity.rental?.units ?? activity.maxCapacity
  return activity.priceTiers.map((tier) => view(tier, { tierId: tier.id, stock: units, holds: activity.rental?.seatsPerUnit ?? 1, deposit: activity.rental?.damageDeposit ?? 0 }))
}

/** How many of each item a booking took, from its line items. */
export function itemsInBooking(activity: Pick<Activity, 'priceTiers'>, booking: Pick<Booking, 'lineItems' | 'partySize'>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const line of booking.lineItems) {
    if (line.kind !== 'ticket') continue
    const tier = activity.priceTiers.find((entry) => entry.id === line.tierId) ?? activity.priceTiers.find((entry) => entry.label === line.label)
    if (tier) out[tier.id] = (out[tier.id] ?? 0) + line.quantity
  }
  return out
}

/** What is still free of each item, given the bookings that hold it. Out of service is taken off. */
export function itemsLeft(activity: Pick<Activity, 'rental' | 'priceTiers' | 'maxCapacity'>, bookings: Pick<Booking, 'lineItems' | 'partySize' | 'status'>[], outOfService?: Record<string, number>): Record<string, number> {
  const taken: Record<string, number> = {}
  for (const booking of bookings) {
    if (booking.status === 'cancelled' || booking.status === 'refunded') continue
    for (const [tierId, qty] of Object.entries(itemsInBooking(activity, booking))) taken[tierId] = (taken[tierId] ?? 0) + qty
  }
  return Object.fromEntries(
    rentalItemsOf(activity).map((item) => {
      const off = outOfService?.[item.tierId] ?? item.outOfService ?? 0
      return [item.tierId, Math.max(0, item.stock - off - (taken[item.tierId] ?? 0))]
    }),
  )
}

/** "2 single kayaks, 1 double kayak" */
export function itemsSentence(items: { name: string; qty: number }[]): string {
  return items
    .filter((item) => item.qty > 0)
    .map((item) => `${item.qty} × ${item.name}`)
    .join(', ')
}

/** Total stock across items: the most a rental can have out at once. */
export const totalStock = (activity: Pick<Activity, 'rental' | 'priceTiers' | 'maxCapacity'>) => rentalItemsOf(activity).reduce((sum, item) => sum + item.stock, 0)

/* --------------------------------------------------------------------------
   How long a rental is out. Bookings do not store their hours or days in the
   demo data, so a steady value is worked out from the booking id; the
   generator, the availability and the Rentals board all use this one rule,
   so they always agree on what is out when.
   -------------------------------------------------------------------------- */

export interface RentalSpan {
  startMs: number
  /** When it is back, before the gap between rentals. */
  endMs: number
  /** Back and ready for the next guest. */
  readyMs: number
  days: number
  hours: number
  /** Minutes for a fixed-length option. */
  minutes: number
}

const byTheDay = (rental: Activity['rental']) => (rental?.modes ? rental.modes.length === 1 && rental.modes[0] === 'day' : rental?.billing === 'day')

export function rentalSpan(activity: Pick<Activity, 'rental' | 'priceTiers' | 'durationMinutes'>, bookingId: string, startsAt: string): RentalSpan {
  const rental = activity.rental
  const buffer = (rental?.bufferMinutes ?? 0) * 60_000
  if (byTheDay(rental)) {
    const least = Math.max(1, rental?.minDays ?? 1)
    const most = Math.max(least, Math.min(rental?.maxDays || 5, 5))
    const days = least + (hashSeed(`days:${bookingId}`) % (most - least + 1))
    const dayKey = startsAt.slice(0, 10)
    const start = new Date(`${dayKey}T${rental?.pickupTime ?? '08:00'}:00`)
    const end = addDays(new Date(`${dayKey}T${rental?.returnTime ?? '17:00'}:00`), days)
    return { startMs: start.getTime(), endMs: end.getTime(), readyMs: end.getTime() + buffer, days, hours: 0, minutes: days * 1440 }
  }
  const start = new Date(startsAt).getTime()
  const rated = (rental?.rates?.length ?? 0) > 0 && (rental?.modes ?? []).includes('hour')
  if (rated) {
    const least = Math.max(1, rental?.minHours ?? 1)
    const hours = least + (hashSeed(`hours:${bookingId}`) % (Math.max(least, rental?.maxHours || least + 3) - least + 1))
    return { startMs: start, endMs: start + hours * 3_600_000, readyMs: start + hours * 3_600_000 + buffer, days: 1, hours, minutes: hours * 60 }
  }
  const lengths = rental?.durations?.length ? rental.durations : [{ tierId: activity.priceTiers[0]?.id ?? '', minutes: activity.durationMinutes }]
  const minutes = lengths[hashSeed(`len:${bookingId}`) % lengths.length].minutes
  return { startMs: start, endMs: start + minutes * 60_000, readyMs: start + minutes * 60_000 + buffer, days: 1, hours: 0, minutes }
}

/** The shortest a rental can run: the window a start time has to be free for. */
export function shortestRentalMs(activity: Pick<Activity, 'rental' | 'durationMinutes'>, startsAt: string): { startMs: number; endMs: number } {
  const rental = activity.rental
  if (byTheDay(rental)) {
    const dayKey = startsAt.slice(0, 10)
    const least = Math.max(1, rental?.minDays ?? 1)
    return {
      startMs: new Date(`${dayKey}T${rental?.pickupTime ?? '08:00'}:00`).getTime(),
      endMs: addDays(new Date(`${dayKey}T${rental?.returnTime ?? '17:00'}:00`), least).getTime(),
    }
  }
  const start = new Date(startsAt).getTime()
  const minutes = (rental?.modes ?? []).includes('hour') ? Math.max(1, rental?.minHours ?? 1) * 60 : Math.max(15, activity.durationMinutes)
  return { startMs: start, endMs: start + minutes * 60_000 }
}
