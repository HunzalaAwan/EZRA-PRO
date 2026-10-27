import type { Activity, BookingStatus, TransferBookingDetails, TransferDirection, TransferFlight } from '@/types'
import { transferOf, zoneById } from '@/lib/transfers'

/* ==========================================================================
   Transfer rides — the day-of list: one row per leg of a transfer booking
   (a round trip is two rides, each on its own day), and who drives it, in
   what, and how far along it is. Assignments are kept in the browser
   (`ezra:transfer-rides:<slug>`), like the ledger. Browser- and server-safe;
   only the store functions touch localStorage.
   ========================================================================== */

/** One ride on the board: a leg of a booking. */
export interface TransferRide {
  /** `${reference}:${legIndex}`. */
  id: string
  reference: string
  bookingId?: string
  activityId: string
  activityName: string
  legIndex: number
  direction: TransferDirection
  /** Local ISO. */
  pickupAt: string
  flight?: TransferFlight
  from: string
  to: string
  /** "Playa del Carmen"; hotel to hotel: "Puerto Juarez to Playa del Carmen"; by the hour: "". */
  zoneName: string
  passengers: number
  bags: number
  vehicles: { tierId: string; name: string; qty: number; resourceId?: string }[]
  guestName: string
  phone: string
  /** "Child seat × 2". */
  extras: string[]
  note?: string
  status: BookingStatus
}

/** The rides of one booking, one per leg, in leg order. */
export function ridesOf(args: {
  activity: Activity
  reference: string
  bookingId?: string
  details: TransferBookingDetails
  guestName: string
  phone: string
  status: BookingStatus
  extras?: { label: string; qty: number }[]
}): TransferRide[] {
  const { activity, details } = args
  const config = transferOf(activity)
  const zone = zoneById(config, details.zoneId)?.name ?? ''
  const toZone = zoneById(config, details.toZoneId)?.name ?? ''
  const zoneName = details.trip === 'between' ? (zone && toZone ? `${zone} to ${toZone}` : zone || toZone) : details.trip === 'hourly' ? '' : zone
  const vehicles = details.vehicles
    .filter((line) => line.qty > 0)
    .map((line) => {
      const tier = activity.priceTiers.find((entry) => entry.id === line.tierId)
      const resourceId = config?.vehicles?.find((entry) => entry.tierId === line.tierId)?.resourceId
      return { tierId: line.tierId, name: tier?.label ?? 'Vehicle', qty: line.qty, ...(resourceId ? { resourceId } : {}) }
    })
  const extras = (args.extras ?? []).filter((extra) => extra.qty > 0).map((extra) => `${extra.label} × ${extra.qty}`)
  return details.legs.map((leg, legIndex) => ({
    id: `${args.reference}:${legIndex}`,
    reference: args.reference,
    ...(args.bookingId ? { bookingId: args.bookingId } : {}),
    activityId: activity.id,
    activityName: activity.name,
    legIndex,
    direction: leg.direction,
    pickupAt: leg.pickupAt,
    ...(leg.flight ? { flight: leg.flight } : {}),
    from: leg.from,
    to: leg.to,
    zoneName,
    passengers: details.passengers,
    bags: details.bags,
    vehicles,
    guestName: args.guestName,
    phone: args.phone,
    extras,
    ...(details.note ? { note: details.note } : {}),
    status: args.status,
  }))
}

/** Each vehicle of a ride by name, one per vehicle: "Private car", "Private van". */
export function vehicleUnitsOf(ride: Pick<TransferRide, 'vehicles'>): string[] {
  return ride.vehicles.flatMap((line) => Array.from({ length: Math.max(0, line.qty) }, () => line.name))
}

/** The drivers a ride still needs: one per vehicle (at least one). */
export function driversMissing(ride: Pick<TransferRide, 'vehicles'>, assignment: Pick<RideAssignment, 'driverId' | 'more'>): number {
  const count = Math.max(1, vehicleUnitsOf(ride).length)
  const ids = [assignment.driverId, ...(assignment.more ?? []).slice(0, count - 1).map((entry) => entry.driverId)]
  return Array.from({ length: count }, (_, index) => ids[index]).filter((id) => !id).length
}

/* ---------- how far along a ride is ---------- */

export type RideStage = 'todo' | 'on_way' | 'picked_up' | 'done' | 'no_show'

export const RIDE_STAGE_LABEL: Record<RideStage, string> = {
  todo: 'To do',
  on_way: 'On the way',
  picked_up: 'Picked up',
  done: 'Done',
  no_show: 'No-show',
}

/** The next step a ride's one button moves it to: to do → on the way → picked up → done. Null when there is none. */
export function nextStage(stage: RideStage): RideStage | null {
  switch (stage) {
    case 'todo':
      return 'on_way'
    case 'on_way':
      return 'picked_up'
    case 'picked_up':
      return 'done'
    default:
      return null
  }
}

/** Who drives a ride, in what, and how far along it is. */
export interface RideAssignment {
  /** A team member's user id. */
  driverId?: string
  /** A unit of the vehicle's resource ("Hiace 2"), or free text. */
  vehicle?: string
  /** A group in two or more vehicles: who drives each one after the first, and in which. */
  more?: { driverId?: string; vehicle?: string }[]
  stage: RideStage
  /** Running late by this many minutes. */
  lateMinutes?: number
  note?: string
}

/* ---------- the assignment store ---------- */

export const RIDES_EVENT = 'ezra:transfer-rides' as const

export function ridesKey(slug: string): string {
  return `ezra:transfer-rides:${slug}`
}

const STAGES = new Set<RideStage>(['todo', 'on_way', 'picked_up', 'done', 'no_show'])

/** This browser's assignments by ride id. Empty on the server or when storage is blocked. */
export function readRideAssignments(slug: string): Record<string, RideAssignment> {
  try {
    const raw = window.localStorage.getItem(ridesKey(slug))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, Partial<RideAssignment>>
    if (!parsed || typeof parsed !== 'object') return {}
    const out: Record<string, RideAssignment> = {}
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== 'object') continue
      out[id] = { ...entry, stage: entry.stage && STAGES.has(entry.stage) ? entry.stage : 'todo' }
    }
    return out
  } catch {
    return {}
  }
}

/** Saves part of a ride's assignment (a driver, a vehicle, the next stage) and tells every open screen. */
export function saveRideAssignment(slug: string, rideId: string, patch: Partial<RideAssignment>): void {
  const all = readRideAssignments(slug)
  const current: RideAssignment = all[rideId] ?? { stage: 'todo' }
  all[rideId] = { ...current, ...patch, stage: patch.stage ?? current.stage }
  try {
    window.localStorage.setItem(ridesKey(slug), JSON.stringify(all))
  } catch {
    /* storage blocked: the change shows until the page reloads */
  }
  window.dispatchEvent(new Event(RIDES_EVENT))
}
