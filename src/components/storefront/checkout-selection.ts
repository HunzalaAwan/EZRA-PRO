import { clamp } from '@/lib/utils'
import { addOnUnits, peopleOf, placesOf } from '@/lib/places'
import { isGeneratedSlotId } from '@/lib/activity-schedule'
import { rentalModes, type RentalMode } from '@/lib/activity-kinds'
import type { Activity } from '@/types'
import type { AvailabilitySlot, QuoteSelection } from '@/components/storefront/booking-widget'

/* ==========================================================================
   Checkout selection — the widget's `t=tierId:qty|…` and `a=addOnId:qty|…`
   read back and checked against the activity and the spots left, so a
   hand-edited URL can never produce a quote the business would not honour.
   Pure: the checkout page runs it on the server, CheckoutFlow again in the
   browser against the time slot rebuilt from the saved schedule.
   ========================================================================== */

export function parsePairs(raw: string | string[] | undefined): Map<string, number> {
  const out = new Map<string, number>()
  if (typeof raw !== 'string') return out
  for (const chunk of raw.split('|')) {
    const [id, value] = chunk.split(':')
    const qty = Number(value)
    if (!id || !Number.isFinite(qty) || qty <= 0) continue
    out.set(id, Math.floor(qty))
  }
  return out
}

export function resolveSelection(
  activity: Activity,
  rawTiers: string | string[] | undefined,
  rawAddOns: string | string[] | undefined,
  seatsLeft: number,
  /** Rentals with items: what is left of each. */
  itemsLeft?: Record<string, number>,
  /** Charters: the group size, which per-guest extras are charged on. */
  party?: number,
): QuoteSelection {
  const requestedTiers = parsePairs(rawTiers)
  const requestedAddOns = parsePairs(rawAddOns)

  let seatsUsed = 0
  const perPerson = (activity.kind ?? 'trip') !== 'charter' && (activity.kind ?? 'trip') !== 'rental'
  const tiers = activity.priceTiers.map((tier) => {
    // The minimum per booking is required; a link without it gets it added.
    const wanted = Math.max(requestedTiers.get(tier.id) ?? 0, perPerson ? tier.minQuantity : 0)
    const places = placesOf(tier)
    const room = places > 0 ? Math.floor(Math.max(0, seatsLeft - seatsUsed) / places) : tier.maxQuantity
    // Each rental item is capped by its own count, not just the total.
    const itemRoom = itemsLeft ? (itemsLeft[tier.id] ?? 0) : Number.POSITIVE_INFINITY
    const qty = clamp(wanted, 0, Math.min(tier.maxQuantity, room, itemRoom))
    seatsUsed += qty * places
    return { tierId: tier.id, qty }
  })

  // A bare /checkout link still has to render a complete, sensible order.
  if (tiers.length > 0 && tiers.every((tier) => tier.qty === 0)) {
    const lead = (itemsLeft ? activity.priceTiers.find((tier) => (itemsLeft[tier.id] ?? 0) > 0) : undefined) ?? activity.priceTiers[0]
    const fallback = clamp(
      Math.max(lead.minQuantity, Math.min((activity.kind ?? 'trip') === 'rental' ? 1 : 2, activity.maxCapacity)),
      1,
      Math.max(1, Math.min(lead.maxQuantity, seatsLeft)),
    )
    const index = activity.priceTiers.indexOf(lead)
    tiers[index >= 0 ? index : 0] = { tierId: lead.id, qty: fallback }
  }

  const headcount = party ?? tiers.reduce((total, tier) => total + tier.qty * peopleOf(activity.priceTiers.find((entry) => entry.id === tier.tierId) ?? {}), 0)
  // An extra the guest picked: one for each guest, or one for the booking.
  const addOns = activity.addOns.map((addOn) => ({
    addOnId: addOn.id,
    qty: (requestedAddOns.get(addOn.id) ?? 0) > 0 || addOn.required ? addOnUnits(addOn, headcount) : 0,
  }))

  return { tiers, addOns }
}

/**
 * Spots really booked on a time slot, for filling-up and quiet-time prices:
 * the server's bookings plus this browser's (the ledger), never "spots minus
 * seats left", which also counts carts in progress and the daily limit.
 * A generated time slot has nothing booked on the server.
 */
export function bookedOn(slot: Pick<AvailabilitySlot, 'departureId' | 'capacity' | 'seatsLeft' | 'booked'>, delta: Record<string, number> = {}): number {
  const server = slot.booked ?? (isGeneratedSlotId(slot.departureId) ? 0 : Math.max(0, slot.capacity - slot.seatsLeft))
  return Math.max(0, server + (delta[slot.departureId] ?? 0))
}

/** The link's rental values (`m`, `h`, `n`, `l`), not yet checked. */
export interface RentalRequest {
  mode?: string
  hours?: string
  days?: string
  length?: string
}

export interface ResolvedRental {
  mode?: RentalMode
  /** Day rentals: days each unit is out (1 otherwise). */
  days: number
  /** By the hour: the hours; by length: the length's hours. */
  hours?: number
  lengthId?: string
  /** Pick-up for day rentals, else the time slot's start. */
  startsAt: string
  /** Return for day rentals, else the end of the hours or length (the time slot's end without either). */
  endsAt: string
  /** Day rentals: when the units come back. */
  returnsAt?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** A local ISO plus some minutes, still local. */
function plusMinutes(iso: string, minutes: number) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() + minutes)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/**
 * How a rental is charged on this booking, from the link checked against the
 * activity: the mode it offers, hours and days within its limits, the length,
 * and the pick-up and return times. The checkout page runs it on the seeded
 * activity, CheckoutFlow again on the activity with its saved edit.
 */
export function resolveRental(activity: Activity, request: RentalRequest, slot: { startsAt: string; endsAt: string }): ResolvedRental {
  const modes = rentalModes(activity)
  const mode = modes.length > 0 ? (modes.includes(request.mode as RentalMode) ? (request.mode as RentalMode) : modes[0]) : undefined
  const dayRental = (activity.kind ?? 'trip') === 'rental' && (mode ? mode === 'day' : activity.rental?.billing === 'day')
  const minHours = Math.max(1, activity.rental?.minHours ?? 1)
  const lengths = activity.rental?.lengths ?? []
  const length = mode === 'length' ? (lengths.find((entry) => entry.id === request.length) ?? lengths[0]) : undefined
  const hours =
    mode === 'hour'
      ? clamp(Math.floor(Number(request.hours) || minHours), minHours, Math.max(minHours, activity.rental?.maxHours || 12))
      : length
        ? length.hours
        : undefined
  const minDays = Math.max(1, activity.rental?.minDays ?? 1)
  const maxDays = Math.max(minDays, activity.rental?.maxDays || 30)
  const days = dayRental ? clamp(Math.floor(Number(request.days) || minDays), minDays, maxDays) : 1
  const dayKey = slot.startsAt.slice(0, 10)
  if (dayRental) {
    const back = new Date(`${dayKey}T12:00:00`)
    back.setDate(back.getDate() + days)
    const returnsAt = `${back.getFullYear()}-${pad(back.getMonth() + 1)}-${pad(back.getDate())}T${activity.rental?.returnTime ?? '17:00'}:00`
    return { mode, days, hours, lengthId: length?.id, startsAt: `${dayKey}T${activity.rental?.pickupTime ?? '09:00'}:00`, endsAt: returnsAt, returnsAt }
  }
  return { mode, days, hours, lengthId: length?.id, startsAt: slot.startsAt, endsAt: hours ? plusMinutes(slot.startsAt, hours * 60) : slot.endsAt }
}
