import { clamp } from '@/lib/utils'
import { addOnUnits, peopleOf, placesOf } from '@/lib/places'
import { defaultSpots, expandSchedules, isGeneratedSlotId, spotsAfterEdit, weekdaySpotsOf, type ScheduledSlot } from '@/lib/activity-schedule'
import { slotExtraSpotsOf } from '@/lib/extra-spots'
import { rentalModes, type RentalMode } from '@/lib/activity-kinds'
import { groupPriced, groupTierOf, guestLimitOf, privatePerPerson } from '@/lib/price-engine'
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

/**
 * A private group's size from the link's `g`, checked against the activity:
 * at least its fewest guests, at most its most guests plus its extra spots.
 * Undefined for anything that is not a private group. The checkout page runs
 * it on the seeded activity, CheckoutFlow again on the activity with its
 * saved edit.
 */
export function checkoutParty(activity: Activity, wanted: string | string[] | number | undefined): number | undefined {
  if ((activity.kind ?? 'trip') !== 'charter') return undefined
  const most = Math.max(1, guestLimitOf(activity))
  const asked = Math.floor(Number(Array.isArray(wanted) ? wanted[0] : wanted) || 2)
  return clamp(asked, Math.min(most, Math.max(1, activity.minParticipants)), most)
}

export function resolveSelection(
  activity: Activity,
  rawTiers: string | string[] | undefined,
  rawAddOns: string | string[] | undefined,
  seatsLeft: number,
  /** Rentals with items: what is left of each. */
  itemsLeft?: Record<string, number>,
  /** A private group priced per group: its size, which per-guest extras are charged on. Per person, its tickets count it. */
  party?: number,
): QuoteSelection {
  const requestedTiers = parsePairs(rawTiers)
  const requestedAddOns = parsePairs(rawAddOns)

  // Per group: one count of guests, all on the group's tier, up to the spots left (extra spots included).
  const groupTier = groupPriced(activity) && activity.groupPrice ? groupTierOf(activity) : undefined
  if (groupTier && activity.groupPrice) {
    const people = activity.priceTiers.reduce((sum, tier) => sum + (requestedTiers.get(tier.id) ?? 0) * peopleOf(tier), 0)
    const places = placesOf(groupTier)
    const room = places > 0 ? Math.floor(Math.max(0, seatsLeft) / places) : groupTier.maxQuantity
    const most = Math.max(1, Math.min(groupTier.maxQuantity, room, guestLimitOf(activity)))
    // A bare /checkout link still renders a sensible order: two guests, or one.
    const qty = clamp(people > 0 ? people : Math.min(2, activity.maxCapacity || 2), 1, most)
    const tiers = activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: tier.id === groupTier.id ? qty : 0 }))
    const headcount = party ?? qty * peopleOf(groupTier)
    const addOns = activity.addOns.map((addOn) => ({
      addOnId: addOn.id,
      qty: (requestedAddOns.get(addOn.id) ?? 0) > 0 || addOn.required ? addOnUnits(addOn, headcount) : 0,
    }))
    return { tiers, addOns }
  }

  // A private group priced per person: a ticket each, up to its most guests plus its extra spots, counted in people.
  // The group has the time slot to itself, so the spots left don't count the tickets.
  if (privatePerPerson(activity)) {
    const most = Math.max(1, guestLimitOf(activity))
    let people = 0
    const tiers = activity.priceTiers.map((tier) => {
      const each = peopleOf(tier)
      const wanted = Math.max(requestedTiers.get(tier.id) ?? 0, tier.minQuantity)
      const qty = clamp(wanted, 0, Math.min(tier.maxQuantity, Math.floor(Math.max(0, most - people) / each)))
      people += qty * each
      return { tierId: tier.id, qty }
    })
    // A bare /checkout link still renders a sensible order: two guests on the lead ticket, or one.
    if (tiers.length > 0 && people === 0) {
      const lead = activity.priceTiers.find((tier) => tier.price > 0 && tier.countsTowardCapacity) ?? activity.priceTiers[0]
      const qty = clamp(Math.max(lead.minQuantity, 2), 1, Math.max(1, Math.min(lead.maxQuantity, Math.floor(most / peopleOf(lead)))))
      const index = activity.priceTiers.indexOf(lead)
      tiers[index >= 0 ? index : 0] = { tierId: lead.id, qty }
      people = qty * peopleOf(lead)
    }
    const addOns = activity.addOns.map((addOn) => ({
      addOnId: addOn.id,
      qty: (requestedAddOns.get(addOn.id) ?? 0) > 0 || addOn.required ? addOnUnits(addOn, people) : 0,
    }))
    return { tiers, addOns }
  }

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

/**
 * A time slot further out than the rebuilt strip, as the server has it, with
 * a saved edit's spots and extra spots laid over it the way the strip lays
 * them (what is sold stays sold). With its start, a day's own spots count
 * too: a change for that date, else its weekday's. Undefined when the edit
 * changes nothing. `seeded` is the activity as the server has it, `edited`
 * with its saved edit.
 */
export function spotsBeyondStrip(
  seeded: Activity,
  edited: Activity,
  slot: { capacity: number; seatsLeft: number; startsAt?: string; locationId?: string },
): { capacity: number; seatsLeft: number } | undefined {
  const entry = daySpotsEntry(edited, slot) ?? { capacity: defaultSpots(edited) }
  const capacity = spotsAfterEdit(slot.capacity, entry, defaultSpots(edited) !== defaultSpots(seeded), slotExtraSpotsOf(seeded), slotExtraSpotsOf(edited))
  if (capacity === slot.capacity) return undefined
  const sold = Math.max(0, slot.capacity - slot.seatsLeft)
  return { capacity: Math.max(capacity, sold), seatsLeft: Math.max(0, capacity - sold) }
}

/**
 * A day's own spots for a time slot: the schedule's when a change for the
 * date or the weekday set them, else the weekday's number; undefined when
 * neither applies (the usual number).
 */
function daySpotsEntry(edited: Activity, slot: { startsAt?: string; locationId?: string }): Pick<ScheduledSlot, 'capacity' | 'capacitySet'> | undefined {
  const dateKey = slot.startsAt?.slice(0, 10)
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return undefined
  const time = slot.startsAt!.slice(11, 16)
  const primary = edited.locations[0]?.locationId
  const weekday = weekdaySpotsOf(edited, new Date(`${dateKey}T12:00:00`).getDay())
  const found = expandSchedules(edited, dateKey, dateKey).find((entry) => entry.time === time && (entry.locationId ?? primary) === (slot.locationId ?? primary))
  if (found?.capacitySet && (found.change || weekday !== undefined)) return found
  return weekday !== undefined ? { capacity: weekday, capacitySet: true } : undefined
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
