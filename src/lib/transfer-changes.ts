import type { Activity, TransferBookingDetails, TransferDirection, TransferFlight, TransferLeg } from '@/types'
import {
  bookingDetailsOf,
  busyMinutesFor,
  directionLabel,
  normalizeFlight,
  transferOf,
  transferSlotId,
  vehiclesLeftAt,
  zoneById,
  type TransferHold,
  type TransferRequest,
  type TransferSource,
} from '@/lib/transfers'

/* ==========================================================================
   Transfer changes — a booked ride changed after the fact (a new flight, a
   new time, another hotel), by the guest on the manage page or by staff on
   the booking. The ride is worked out again from the request it came from:
   new pickups, new time slots, and whether the vehicles are free then.
   Plus the short words every screen uses for a ride. Pure; browser- and
   server-safe.
   ========================================================================== */

const pad = (n: number) => String(n).padStart(2, '0')
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

function dateOf(iso: string | undefined): Date | undefined {
  const match = iso ? ISO_RE.exec(iso) : null
  if (!match) return undefined
  const [, y, m, d, hh, mm] = match.map(Number)
  return new Date(y, m - 1, d, hh, mm, 0, 0)
}
const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
const plusMinutes = (iso: string, minutes: number) => {
  const date = dateOf(iso)
  if (!date) return iso
  date.setMinutes(date.getMinutes() + minutes)
  return isoOf(date)
}

/** "14:35" from a local ISO. */
export const hhmm = (iso: string | undefined) => (iso && iso.length >= 16 ? iso.slice(11, 16) : '')

/** Hub legs carry a flight (or sailing, or train) time; hotel to hotel and hourly legs only a pickup. */
export const isHubLeg = (direction: TransferDirection) => direction === 'from_hub' || direction === 'to_hub'

/**
 * The time a leg was asked for: an arrival's landing, a departure's take-off
 * (the flight's when it has one, else worked back from the pickup), or the
 * pickup itself (hotel to hotel, hourly).
 */
export function askedTimeOf(activity: TransferSource, details: TransferBookingDetails, leg: TransferLeg): string {
  if (leg.flight?.at) return leg.flight.at
  const config = transferOf(activity)
  if (leg.direction === 'to_hub' && config) {
    const drive = zoneById(config, details.zoneId)?.driveMinutes ?? 0
    // A shared run is the run's time at the hub; a private ride adds the time at the hub before the flight.
    const back = config.service === 'shared' ? drive : config.checkInMinutes + drive
    return plusMinutes(leg.pickupAt, back)
  }
  return leg.pickupAt
}

/** The request a booked ride came from, so it can be worked out again with new times or places. */
export function requestOfDetails(activity: TransferSource, details: TransferBookingDetails): TransferRequest {
  const [first, second] = details.legs
  return {
    trip: details.trip,
    ...(details.zoneId ? { zoneId: details.zoneId } : {}),
    ...(details.toZoneId ? { toZoneId: details.toZoneId } : {}),
    passengers: details.passengers,
    bags: details.bags,
    at: first ? askedTimeOf(activity, details, first) : '',
    ...(details.trip === 'round_trip' && second ? { returnAt: askedTimeOf(activity, details, second) } : {}),
    ...(details.hours !== undefined ? { hours: details.hours } : {}),
    ...(details.place ? { place: details.place } : {}),
    ...(details.dropOff ? { dropOff: details.dropOff } : {}),
  }
}

/** What can change on one leg: the flight number and airline, and the time asked for (local ISO). */
export interface LegEdit {
  flightNumber?: string
  airline?: string
  /** Hub legs: when the flight lands or takes off. Others: the pickup. */
  at?: string
}

export interface RideEdit {
  /** One per leg, in leg order. A missing entry keeps the leg as it was. */
  legs: (LegEdit | undefined)[]
  place?: string
  dropOff?: string
  note?: string
}

/**
 * The ride with the changes made: pickups worked out again from the new
 * times, each leg on the time slot its new pickup falls in (the old slot id
 * kept when the slot is the same), flights as typed.
 */
export function applyRideEdit(activity: TransferSource, details: TransferBookingDetails, edit: RideEdit): TransferBookingDetails {
  const base = requestOfDetails(activity, details)
  const firstAt = edit.legs[0]?.at || base.at
  const secondAt = details.trip === 'round_trip' ? edit.legs[1]?.at || base.returnAt : undefined
  const place = (edit.place ?? details.place).trim() || details.place
  const dropOff = (edit.dropOff ?? details.dropOff ?? '').trim() || details.dropOff
  const request: TransferRequest = { ...base, at: firstAt, ...(secondAt ? { returnAt: secondAt } : {}), place, ...(dropOff ? { dropOff } : {}) }
  // Worked out once to learn the new slots, then kept on the old slot ids where the slot is the same.
  const draft = bookingDetailsOf(activity, request, { vehicles: details.vehicles, departureIds: [], place, dropOff })
  const flights: (TransferFlight | undefined)[] = draft.legs.map((leg, index) => {
    const before = details.legs[index]
    const change = edit.legs[index]
    const number = (change?.flightNumber ?? before?.flight?.number ?? '').trim()
    if (!number || !isHubLeg(leg.direction)) return undefined
    const airline = (change?.airline ?? before?.flight?.airline ?? '').trim()
    const at = (index === 0 ? firstAt : secondAt) ?? leg.pickupAt
    return { number: normalizeFlight(number), ...(airline ? { airline } : {}), at }
  })
  const departureIds = draft.legs.map((leg, index) => {
    const before = details.legs[index]
    const slot = transferSlotId(activity, slotOfPickup(activity, leg, details.zoneId))
    if (!before) return slot
    return slotOfPickup(activity, before, details.zoneId) === slotOfPickup(activity, leg, details.zoneId) && before.departureId ? before.departureId : slot
  })
  return bookingDetailsOf(activity, request, {
    vehicles: details.vehicles,
    departureIds,
    flights,
    place,
    dropOff,
    note: edit.note ?? details.note,
  })
}

/** The start of the time slot a leg sits in: the half hour of its pickup (a shared run: the run at the hub, a drive after a departure's pickup). */
function slotOfPickup(activity: TransferSource, leg: Pick<TransferLeg, 'direction' | 'pickupAt'>, zoneId?: string): string {
  const config = transferOf(activity)
  if (config?.service === 'shared') return leg.direction === 'to_hub' ? plusMinutes(leg.pickupAt, zoneById(config, zoneId)?.driveMinutes ?? 0) : leg.pickupAt.slice(0, 16) + ':00'
  const date = dateOf(leg.pickupAt)
  if (!date) return leg.pickupAt
  date.setMinutes(date.getMinutes() - (date.getMinutes() % 30))
  return isoOf(date)
}

/**
 * Whether the ride's vehicles are free for every leg, leaving the booking's
 * own holds out (`reference`). A shared shuttle holds seats, not vehicles: true.
 */
export function rideFits(activity: TransferSource, holds: TransferHold[], details: TransferBookingDetails, reference: string): boolean {
  const config = transferOf(activity)
  if (!config || config.service === 'shared') return true
  return details.legs.every((leg) => {
    const busy = busyMinutesFor(config, details.zoneId, leg.direction, details.hours, details.toZoneId)
    const left = vehiclesLeftAt(activity, holds, leg.pickupAt, busy, reference)
    return details.vehicles.every((line) => (left[line.tierId] ?? 0) >= line.qty)
  })
}

/**
 * The ids one time slot goes by for rides: its own, and for a seeded slot the
 * `gen_…` id a ride moved onto that time carries (the server reads that id
 * back as the seeded slot). Other kinds: its own id.
 */
export function slotIdsOf(activity: Pick<Activity, 'id' | 'kind' | 'locations'>, departure: { id: string; startsAt: string }): string[] {
  if (activity.kind !== 'transfer') return [departure.id]
  const gen = transferSlotId(activity, departure.startsAt)
  return gen === departure.id ? [departure.id] : [departure.id, gen]
}

/**
 * The ledger's seat changes with rides booked on a `gen_…` id folded onto the
 * seeded time slot at that time, so the calendar counts them there.
 */
export function foldRideDeltas(delta: Record<string, number>, events: { departure: { id: string; startsAt: string }; activity: Pick<Activity, 'id' | 'kind' | 'locations'> }[]): Record<string, number> {
  let out: Record<string, number> | null = null
  for (const { departure, activity } of events) {
    const [, gen] = slotIdsOf(activity, departure)
    if (!gen || !delta[gen]) continue
    out ??= { ...delta }
    if (out[gen] === undefined) continue
    out[departure.id] = (out[departure.id] ?? 0) + out[gen]
    delete out[gen]
  }
  return out ?? delta
}

/** A round trip whose return pickup comes before the arrival has reached the stay (landing, then the drive). */
export function returnTooSoon(activity: TransferSource, details: Pick<TransferBookingDetails, 'trip' | 'zoneId' | 'legs'>): boolean {
  if (details.trip !== 'round_trip') return false
  const arrival = details.legs.find((leg) => leg.direction === 'from_hub')
  const back = details.legs.find((leg) => leg.direction === 'to_hub')
  if (!arrival || !back) return false
  const drive = Math.max(0, zoneById(transferOf(activity), details.zoneId)?.driveMinutes ?? 0)
  return back.pickupAt < plusMinutes(arrival.pickupAt, drive)
}

/** The first leg's new slot, for `BookingChange.movedTo`, when it moved. */
export function movedToOf(before: TransferBookingDetails, after: TransferBookingDetails): { departureId: string; startsAt: string } | undefined {
  const a = before.legs[0]
  const b = after.legs[0]
  if (!b || (a && a.departureId === b.departureId)) return undefined
  return { departureId: b.departureId, startsAt: b.pickupAt }
}

/* ---------- words ---------- */

/** "AA 1234 lands 14:35", "DL 512 takes off 10:30"; ports and stations "arrives" / "leaves". Empty without a flight. */
export function flightLine(leg: Pick<TransferLeg, 'direction' | 'flight'>, hubKind?: string): string {
  if (!leg.flight) return ''
  const airport = !hubKind || hubKind === 'airport'
  const verb = leg.direction === 'to_hub' ? (airport ? 'takes off' : 'leaves') : airport ? 'lands' : 'arrives'
  return `${leg.flight.number} ${verb} ${hhmm(leg.flight.at)}`
}

/** "Arrival · Playa del Carmen", "Round trip · Cancun Hotel Zone", "Hotel to hotel · Puerto Juarez to Playa del Carmen", "By the hour · 5 hours". */
export function rideHeadline(activity: TransferSource, details: Pick<TransferBookingDetails, 'trip' | 'zoneId' | 'toZoneId' | 'hours'>): string {
  const config = transferOf(activity)
  const zone = zoneById(config, details.zoneId)?.name ?? ''
  switch (details.trip) {
    case 'round_trip':
      return zone ? `Round trip · ${zone}` : 'Round trip'
    case 'between': {
      const to = zoneById(config, details.toZoneId)?.name ?? ''
      return zone && to ? `Hotel to hotel · ${zone} to ${to}` : 'Hotel to hotel'
    }
    case 'hourly':
      return details.hours ? `By the hour · ${details.hours} ${details.hours === 1 ? 'hour' : 'hours'}` : 'By the hour'
    default: {
      const word = directionLabel(details.trip, config?.hub)
      return zone ? `${word} · ${zone}` : word
    }
  }
}

/** "4 passengers · 4 suitcases". */
export function partyLine(details: Pick<TransferBookingDetails, 'passengers' | 'bags'>): string {
  const people = `${details.passengers} ${details.passengers === 1 ? 'passenger' : 'passengers'}`
  return details.bags > 0 ? `${people} · ${details.bags} ${details.bags === 1 ? 'suitcase' : 'suitcases'}` : people
}
