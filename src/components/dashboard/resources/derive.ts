import type { Activity, Departure } from '@/types'

/**
 * Plain module — no 'use client'. A function exported from a client file
 * becomes a client reference at the RSC boundary and can't be called from a
 * Server Component; these derivations run in `page.tsx` (server), so they
 * live here instead.
 */

export function deriveResourceDependents(activities: Activity[]): Record<string, Activity[]> {
  const map: Record<string, Activity[]> = {}
  for (const activity of activities) {
    for (const resourceId of activity.requiredResourceIds) {
      ;(map[resourceId] ||= []).push(activity)
    }
  }
  return map
}

export function deriveUpcomingResourceUse(upcomingDepartures: Departure[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const departure of upcomingDepartures) {
    if (departure.status === 'cancelled') continue
    for (const resourceId of departure.assignedResourceIds) {
      map[resourceId] = (map[resourceId] ?? 0) + 1
    }
  }
  return map
}

/** One upcoming run of a resource, trimmed to what the detail panel shows. */
export interface ResourceRun {
  departureId: string
  startsAt: string
  activityName: string
  booked: number
  capacity: number
}

/**
 * The next few departures each resource is assigned to, soonest first, so the
 * detail panel can answer "when does this boat go out next?" without the
 * client ever seeing the departures table.
 */
export function deriveUpcomingResourceRuns(
  upcomingDepartures: Departure[],
  activities: Activity[],
  limit = 6,
): Record<string, ResourceRun[]> {
  const names = new Map(activities.map((activity) => [activity.id, activity.name]))
  const map: Record<string, ResourceRun[]> = {}
  const sorted = [...upcomingDepartures]
    .filter((departure) => departure.status !== 'cancelled')
    .sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0))

  for (const departure of sorted) {
    for (const resourceId of departure.assignedResourceIds) {
      const list = (map[resourceId] ||= [])
      if (list.length >= limit) continue
      list.push({
        departureId: departure.id,
        startsAt: departure.startsAt,
        activityName: names.get(departure.activityId) ?? 'Departure',
        booked: departure.booked,
        capacity: departure.capacity,
      })
    }
  }
  return map
}
