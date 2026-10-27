import { clamp } from '@/lib/utils'
import { addOnUnits, peopleOf, placesOf } from '@/lib/places'
import { defaultSpots, expandSchedules, isGeneratedSlotId, slotExtraOf, slotNumbersOf, spotsAfterEdit, usualOn, usualSpotsOn, weekdayExtraOf, weekdaySpotsOf, type ScheduledSlot } from '@/lib/activity-schedule'
import { slotExtraSpotsOf } from '@/lib/extra-spots'
import { rentalModes, type RentalMode } from '@/lib/activity-kinds'
import { groupPriced, groupTierOf, guestLimitOf, privatePerPerson } from '@/lib/price-engine'
import type { Activity } from '@/types'
import type { AvailabilitySlot, QuoteSelection } from '@/components/storefront/booking-widget'
import type { CheckoutLeg } from '@/components/storefront/checkout-flow'
import {
  directionLabel,
  planFits,
  planVehicles,
  pricingOf,
  transferOf,
  transferRateFor,
  zoneById,
  type PlannedLeg,
  type TransferRequest,
} from '@/lib/transfers'
import { rideHeadline } from '@/lib/transfer-changes'

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
 * them (what is sold stays sold). With its start, a day's own numbers count
 * too: a change for that date, else its weekday's (spots, extra spots, a
 * private group's size), and come back with it. Undefined when the edit
 * changes nothing. `seeded` is the activity as the server has it, `edited`
 * with its saved edit.
 */
export function spotsBeyondStrip(
  seeded: Activity,
  edited: Activity,
  slot: { capacity: number; seatsLeft: number; startsAt?: string; locationId?: string },
): ({ capacity: number; seatsLeft: number } & Pick<ScheduledSlot, 'extraSpots' | 'groupSize'>) | undefined {
  const entry = daySpotsEntry(edited, slot) ?? { capacity: defaultSpots(edited) }
  const capacity = spotsAfterEdit(slot.capacity, entry, defaultSpots(edited) !== defaultSpots(seeded), slotExtraSpotsOf(seeded), slotExtraOf(edited, entry))
  const numbers = slotNumbersOf(entry)
  if (capacity === slot.capacity && numbers.extraSpots === undefined && numbers.groupSize === undefined) return undefined
  const sold = Math.max(0, slot.capacity - slot.seatsLeft)
  return { capacity: Math.max(capacity, sold), seatsLeft: Math.max(0, capacity - sold), ...numbers }
}

/**
 * A day's own numbers for a time slot: the schedule's when a change for the
 * date or the weekday set them, else the weekday's; undefined when neither
 * applies (the usual numbers).
 */
function daySpotsEntry(edited: Activity, slot: { startsAt?: string; locationId?: string }): Pick<ScheduledSlot, 'capacity' | 'capacitySet' | 'extraSpots' | 'groupSize'> | undefined {
  const dateKey = slot.startsAt?.slice(0, 10)
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return undefined
  const time = slot.startsAt!.slice(11, 16)
  const primary = edited.locations[0]?.locationId
  const day = new Date(`${dateKey}T12:00:00`).getDay()
  // A private time slot sells once: its weekday's number is the group's size, carried as its own number.
  const charter = (edited.kind ?? 'trip') === 'charter'
  const weekday = !charter && weekdaySpotsOf(edited, day) !== undefined ? usualSpotsOn(edited, dateKey) : undefined
  const found = expandSchedules(edited, dateKey, dateKey).find((entry) => entry.time === time && (entry.locationId ?? primary) === (slot.locationId ?? primary))
  const spotsSet = Boolean(found?.capacitySet && (found.change || weekday !== undefined))
  if (found && (spotsSet || found.extraSpots !== undefined || found.groupSize !== undefined)) {
    return spotsSet ? found : { capacity: weekday ?? defaultSpots(edited), ...(weekday !== undefined ? { capacitySet: true } : {}), ...slotNumbersOf(found) }
  }
  // Not on the schedule that day: its weekday's numbers.
  const extra = weekdayExtraOf(edited, day) !== undefined ? usualOn(edited, dateKey).extra : undefined
  const group = charter && weekdaySpotsOf(edited, day) !== undefined ? usualOn(edited, dateKey).spots : undefined
  if (weekday === undefined && extra === undefined && group === undefined) return undefined
  return {
    capacity: weekday ?? defaultSpots(edited),
    ...(weekday !== undefined ? { capacitySet: true } : {}),
    ...(extra !== undefined ? { extraSpots: extra } : {}),
    ...(group !== undefined ? { groupSize: group } : {}),
  }
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

/* ==========================================================================
   Transfers — the vehicles (a shared shuttle: the tickets) and extras of a
   ride read back from the link and checked against the group and what is
   free, and the ride's legs as checkout lists them.
   ========================================================================== */

/**
 * A ride's selection from the link. Private and hourly: the link's vehicles
 * when they still carry the passengers and suitcases, are sold for this trip
 * and destination and (with `left`) are free; else the cheapest set that fits.
 * Shared: the link's tickets within each ticket's limits (the passengers on
 * the lead ticket when there are none). Extras: 'each' keeps how many were
 * picked (up to its most), the others one per passenger or one per booking.
 */
export function resolveTransferSelection(
  activity: Activity,
  rawTiers: string | string[] | undefined,
  rawAddOns: string | string[] | undefined,
  request: TransferRequest,
  left?: Record<string, number>,
): QuoteSelection {
  const askedTiers = parsePairs(rawTiers)
  const askedAddOns = parsePairs(rawAddOns)
  const config = transferOf(activity)
  const pricing = pricingOf(request)
  const passengers = Math.max(1, Math.floor(request.passengers || 1))
  const need = { passengers, bags: Math.max(0, Math.floor(request.bags || 0)) }

  let tiers: QuoteSelection['tiers']
  if (config?.service === 'shared') {
    tiers = activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: clamp(Math.max(askedTiers.get(tier.id) ?? 0, tier.minQuantity), 0, tier.maxQuantity) }))
    if (tiers.length > 0 && tiers.every((tier) => tier.qty === 0)) {
      const lead = activity.priceTiers.find((tier) => tier.countsTowardCapacity && transferRateFor(config, tier.id, pricing) !== undefined) ?? activity.priceTiers[0]
      tiers = tiers.map((tier) => (tier.tierId === lead.id ? { ...tier, qty: clamp(passengers, 1, Math.max(1, lead.maxQuantity)) } : tier))
    }
  } else {
    const asked = activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: askedTiers.get(tier.id) ?? 0 })).filter((line) => line.qty > 0)
    const keep =
      asked.length > 0 &&
      asked.every((line) => transferRateFor(config, line.tierId, pricing) !== undefined && (!left || line.qty <= (left[line.tierId] ?? 0))) &&
      planFits(activity, asked, need)
    const lines = keep ? asked : (planVehicles(activity, need, pricing, left).best?.lines ?? [])
    tiers = activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: lines.find((line) => line.tierId === tier.id)?.qty ?? 0 }))
  }

  const addOns = activity.addOns.map((addOn) => {
    const asked = askedAddOns.get(addOn.id) ?? 0
    if (addOn.per === 'each') return { addOnId: addOn.id, qty: addOnUnits(addOn, passengers, addOn.required ? Math.max(1, asked) : asked) }
    return { addOnId: addOn.id, qty: asked > 0 || addOn.required ? addOnUnits(addOn, passengers) : 0 }
  })
  return { tiers, addOns }
}

/**
 * A ride's legs as checkout lists them: "Arrival · Playa del Carmen", the
 * pickup to the end of the vehicle's busy time, and where to meet (an
 * arrival: the hub's meeting note; otherwise the hotel the driver collects
 * from). `departureIds`: each leg's time slot, in leg order.
 */
export function transferCheckoutLegs(activity: Activity, request: TransferRequest, legs: PlannedLeg[], departureIds: string[]): CheckoutLeg[] {
  const config = transferOf(activity)
  const zone = zoneById(config, request.zoneId)?.name
  return legs.map((leg, index) => {
    const label =
      leg.direction === 'from_hub' || leg.direction === 'to_hub'
        ? `${directionLabel(leg.direction, config?.hub)}${zone ? ` · ${zone}` : ''}`
        : rideHeadline(activity, request)
    const meetingPoint = leg.direction === 'from_hub' ? config?.hub?.meetingNote?.trim() || activity.meetingPoint : leg.from ? `We collect you at ${leg.from}` : activity.meetingPoint
    return {
      departureId: departureIds[index] ?? '',
      activitySlug: activity.slug,
      activityName: activity.name,
      label,
      startsAt: leg.pickupAt,
      endsAt: plusMinutes(leg.pickupAt, leg.busyMinutes),
      meetingPoint,
    }
  })
}
