import {
  NOW,
  getActivityById,
  getBookingsByDeparture,
  getDeparturesForDay,
  getResourcesByTenant,
} from '@/lib/demo'
import { addDays, toDateKey } from '@/lib/utils'
import type { Activity, Departure, Resource } from '@/types'

/* ==========================================================================
   Shared capacity.

   Two rules, the ones operators actually run by:
   - Fleets (jet skis, kayaks, boards) are pools. Every activity that uses a
     fleet draws units from the same pool, so a rental and a guided safari
     cannot both promise the same ski. A guest on a tour uses one unit per
     unit-capacity (two riders per tandem ski); a rental uses one per unit.
   - Boats take one group at a time when the group is a private charter: a
     booked charter blocks every other departure on that boat while it is
     out, and a charter cannot be sold over a trip that already has guests.

   Maintenance blocks take units out of a pool (or a boat out of service)
   for a window. Server-only; pages hand results to clients as props.
   ========================================================================== */

export interface MaintenanceBlock {
  id: string
  resourceId: string
  /** Units out of service; a boat is always 1. */
  units: number
  from: string
  to: string
  reason: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const isoAt = (day: Date, hh: number, mm = 0) =>
  `${toDateKey(day)}T${pad(hh)}:${pad(mm)}:00`

/** Seeded blocks: two skis in for service tomorrow morning, a kayak repair today. */
export function getMaintenanceBlocks(tenantId: string): MaintenanceBlock[] {
  if (tenantId !== 'tnt_bluehorizon') return []
  const tomorrow = addDays(NOW, 1)
  return [
    { id: 'blk_1', resourceId: 'res_bh_jetski_fleet', units: 2, from: isoAt(tomorrow, 8), to: isoAt(tomorrow, 13), reason: 'Impeller service' },
    { id: 'blk_2', resourceId: 'res_bh_kayak_fleet', units: 1, from: isoAt(NOW, 7), to: isoAt(NOW, 18), reason: 'Hull crack, awaiting repair' },
  ]
}

export const isPool = (resource: Resource) => resource.quantity > 1 && resource.kind !== 'vessel'
export const isVessel = (resource: Resource) => resource.kind === 'vessel' || resource.quantity === 1

/** Units of a pool one booking needs. */
export function unitsFor(activity: Activity, resource: Resource, guests: number): number {
  if (activity.kind === 'rental') return guests
  return Math.ceil(guests / Math.max(1, resource.capacity))
}

/** Minutes a departure keeps its resources, including a rental's gap. */
function holdEnd(activity: Activity, departure: Departure): number {
  const end = new Date(departure.endsAt).getTime()
  return end + (activity.kind === 'rental' ? (activity.rental?.bufferMinutes ?? 0) * 60_000 : 0)
}

interface Use {
  departureId: string
  activityId: string
  activityName: string
  kind: Activity['kind']
  start: number
  end: number
  /** Units of the resource this departure's guests use. */
  units: number
  booked: number
}

export interface DayCapacity {
  dayKey: string
  resources: Resource[]
  uses: Map<string, Use[]>
  blocks: MaintenanceBlock[]
}

/** Every resource use on a day, from departures that have guests. */
export function getDayCapacity(tenantId: string, day: Date): DayCapacity {
  const resources = getResourcesByTenant(tenantId)
  const byId = new Map(resources.map((resource) => [resource.id, resource]))
  const uses = new Map<string, Use[]>()
  for (const departure of getDeparturesForDay(tenantId, day)) {
    if (departure.status === 'cancelled') continue
    const activity = getActivityById(departure.activityId)
    if (!activity) continue
    const guests = getBookingsByDeparture(departure.id)
      .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'refunded')
      .reduce((sum, booking) => sum + booking.partySize, 0)
    for (const resourceId of activity.requiredResourceIds) {
      const resource = byId.get(resourceId)
      if (!resource) continue
      const list = uses.get(resourceId) ?? []
      list.push({
        departureId: departure.id,
        activityId: activity.id,
        activityName: activity.name,
        kind: activity.kind,
        start: new Date(departure.startsAt).getTime(),
        end: holdEnd(activity, departure),
        units: isPool(resource) ? unitsFor(activity, resource, guests) : guests > 0 ? 1 : 0,
        booked: guests,
      })
      uses.set(resourceId, list)
    }
  }
  const dayKey = toDateKey(day)
  const blocks = getMaintenanceBlocks(tenantId).filter((block) => block.from.slice(0, 10) <= dayKey && block.to.slice(0, 10) >= dayKey)
  return { dayKey, resources, uses, blocks }
}

const overlaps = (a0: number, a1: number, b0: number, b1: number) => a0 < b1 && b0 < a1

/** Most units of a pool in use at once inside a window, from other departures and blocks. */
function peakUse(capacity: DayCapacity, resourceId: string, start: number, end: number, exceptDepartureId?: string): number {
  const events: [number, number][] = []
  for (const use of capacity.uses.get(resourceId) ?? []) {
    if (use.departureId === exceptDepartureId || use.units === 0) continue
    if (!overlaps(use.start, use.end, start, end)) continue
    events.push([Math.max(use.start, start), use.units], [Math.min(use.end, end), -use.units])
  }
  for (const block of capacity.blocks) {
    if (block.resourceId !== resourceId) continue
    const b0 = new Date(block.from).getTime()
    const b1 = new Date(block.to).getTime()
    if (!overlaps(b0, b1, start, end)) continue
    events.push([Math.max(b0, start), block.units], [Math.min(b1, end), -block.units])
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let current = 0
  let peak = 0
  for (const [, delta] of events) {
    current += delta
    peak = Math.max(peak, current)
  }
  return peak
}

/**
 * Seats a departure can still sell once shared resources are counted:
 * the lower of its own seats left and what its fleets and boat allow.
 * Returns the departure's own number when nothing shared limits it.
 */
export function sharedSeatsLeft(capacity: DayCapacity, activity: Activity, departure: Departure, ownSeatsLeft: number): number {
  const start = new Date(departure.startsAt).getTime()
  const end = holdEnd(activity, departure)
  let seats = ownSeatsLeft
  const ownUse = (resourceId: string) => capacity.uses.get(resourceId)?.find((use) => use.departureId === departure.id)
  for (const resourceId of activity.requiredResourceIds) {
    const resource = capacity.resources.find((entry) => entry.id === resourceId)
    if (!resource || resource.status === 'retired') continue
    if (isPool(resource)) {
      const freeUnits = Math.max(0, resource.quantity - peakUse(capacity, resourceId, start, end, departure.id) - (ownUse(resourceId)?.units ?? 0))
      const perUnit = activity.kind === 'rental' ? 1 : Math.max(1, resource.capacity)
      seats = Math.min(seats, freeUnits * perUnit)
    } else {
      // A boat: a booked charter elsewhere takes it; a charter cannot go over a trip with guests.
      const clash = (capacity.uses.get(resourceId) ?? []).some(
        (use) =>
          use.departureId !== departure.id &&
          use.booked > 0 &&
          overlaps(use.start, use.end, start, end) &&
          (use.kind === 'charter' || activity.kind === 'charter'),
      )
      const blocked = capacity.blocks.some(
        (block) => block.resourceId === resourceId && overlaps(new Date(block.from).getTime(), new Date(block.to).getTime(), start, end),
      )
      if (clash || blocked) seats = 0
    }
  }
  return Math.max(0, seats)
}

/* --------------------------------------------------------------------------
   Capacity board: pools by the hour, boats by departure, and conflicts.
   -------------------------------------------------------------------------- */

export interface PoolHour {
  hour: number
  used: number
  blocked: number
}

export interface CapacityBoard {
  dayKey: string
  pools: {
    id: string
    name: string
    quantity: number
    location?: string
    consumers: string[]
    hours: PoolHour[]
    peak: number
  }[]
  vessels: {
    id: string
    name: string
    status: Resource['status']
    runs: { departureId: string; activityName: string; kind: Activity['kind']; start: string; end: string; booked: number; clash: boolean }[]
  }[]
  conflicts: { id: string; resource: string; when: string; detail: string }[]
  blocks: (MaintenanceBlock & { resourceName: string })[]
}

const localIso = (ms: number) => {
  const d = new Date(ms)
  return `${toDateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

export function getCapacityBoard(tenantId: string, day: Date = NOW): CapacityBoard {
  const capacity = getDayCapacity(tenantId, day)
  const dayStart = new Date(`${capacity.dayKey}T00:00:00`).getTime()
  const conflicts: CapacityBoard['conflicts'] = []

  const pools = capacity.resources.filter(isPool).map((resource) => {
    const list = capacity.uses.get(resource.id) ?? []
    const hours: PoolHour[] = Array.from({ length: 13 }, (_, index) => {
      const hour = 6 + index
      const h0 = dayStart + hour * 3_600_000
      const h1 = h0 + 3_600_000
      const used = list.filter((use) => overlaps(use.start, use.end, h0, h1)).reduce((sum, use) => sum + use.units, 0)
      const blocked = capacity.blocks
        .filter((block) => block.resourceId === resource.id && overlaps(new Date(block.from).getTime(), new Date(block.to).getTime(), h0, h1))
        .reduce((sum, block) => sum + block.units, 0)
      if (used + blocked > resource.quantity) {
        conflicts.push({
          id: `${resource.id}-${hour}`,
          resource: resource.name,
          when: localIso(h0),
          detail: `${used + blocked} of ${resource.quantity} units needed around ${hour}:00 (${list.filter((use) => overlaps(use.start, use.end, h0, h1)).map((use) => use.activityName).filter((v, i, a) => a.indexOf(v) === i).join(', ')}${blocked ? `, ${blocked} in maintenance` : ''}).`,
        })
      }
      return { hour, used, blocked }
    })
    return {
      id: resource.id,
      name: resource.name,
      quantity: resource.quantity,
      location: resource.location,
      consumers: Array.from(new Set(list.map((use) => use.activityName))),
      hours,
      peak: Math.max(0, ...hours.map((entry) => entry.used + entry.blocked)),
    }
  })

  const vessels = capacity.resources
    .filter((resource) => !isPool(resource))
    .map((resource) => {
      const list = (capacity.uses.get(resource.id) ?? []).sort((a, b) => a.start - b.start)
      const runs = list.map((use) => {
        const clash = list.some(
          (other) =>
            other.departureId !== use.departureId &&
            other.booked > 0 &&
            use.booked > 0 &&
            overlaps(other.start, other.end, use.start, use.end) &&
            (other.kind === 'charter' || use.kind === 'charter'),
        )
        return { departureId: use.departureId, activityName: use.activityName, kind: use.kind, start: localIso(use.start), end: localIso(use.end), booked: use.booked, clash }
      })
      for (const run of runs.filter((entry) => entry.clash && entry.kind === 'charter')) {
        conflicts.push({ id: `${resource.id}-${run.departureId}`, resource: resource.name, when: run.start, detail: `A private charter overlaps another trip with guests on ${resource.name.split(' (')[0]}.` })
      }
      return { id: resource.id, name: resource.name, status: resource.status, runs }
    })
    .filter((vessel) => vessel.runs.length > 0 || vessel.status === 'maintenance')

  const names = new Map(capacity.resources.map((resource) => [resource.id, resource.name]))
  return {
    dayKey: capacity.dayKey,
    pools,
    vessels,
    conflicts: conflicts.sort((a, b) => (a.when < b.when ? -1 : 1)),
    blocks: capacity.blocks.map((block) => ({ ...block, resourceName: names.get(block.resourceId) ?? block.resourceId })),
  }
}
