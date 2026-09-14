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
