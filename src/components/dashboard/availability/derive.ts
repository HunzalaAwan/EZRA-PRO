import type { Activity, Departure } from '@/types'

/**
 * Plain module — no 'use client'. A function exported from a client file
 * becomes a client reference at the RSC boundary and can't be called from a
 * Server Component; this derivation needs to run in `page.tsx` (server), so
 * it lives here instead.
 */

export interface DerivedTemplate {
  activity: Activity
  startTimes: string[]
  weekdays: number[]
  capacity: number
  departures: number
}

export function deriveScheduleTemplates(
  windowDepartures: Departure[],
  activityById: Map<string, Activity>,
): DerivedTemplate[] {
  const buckets = new Map<
    string,
    { times: Set<string>; weekdays: Set<number>; capacity: number; count: number }
  >()

  for (const departure of windowDepartures) {
    if (departure.status === 'cancelled') continue
    const bucket = buckets.get(departure.activityId) ?? {
      times: new Set<string>(),
      weekdays: new Set<number>(),
      capacity: 0,
      count: 0,
    }
    bucket.times.add(departure.startsAt.slice(11, 16))
    bucket.weekdays.add(new Date(departure.startsAt).getDay())
    bucket.capacity = Math.max(bucket.capacity, departure.capacity)
    bucket.count += 1
    buckets.set(departure.activityId, bucket)
  }

  const rows: DerivedTemplate[] = []
  for (const [activityId, bucket] of buckets) {
    const activity = activityById.get(activityId)
    if (!activity) continue
    rows.push({
      activity,
      startTimes: [...bucket.times].sort(),
      weekdays: [...bucket.weekdays].sort((a, b) => a - b),
      capacity: bucket.capacity,
      departures: bucket.count,
    })
  }
  return rows.sort((a, b) => b.departures - a.departures)
}

export type ObservedHours = Record<number, { first: number; last: number }>

/** First and last operating minute per weekday, from departures that actually ran. */
export function deriveObservedHours(departures: Departure[]): ObservedHours {
  const map: ObservedHours = {}
  for (const departure of departures) {
    const start = new Date(departure.startsAt)
    const end = new Date(departure.endsAt)
    const weekday = start.getDay()
    const startMin = start.getHours() * 60 + start.getMinutes()
    const endMin = end.getHours() * 60 + end.getMinutes()
    const current = map[weekday]
    if (!current) map[weekday] = { first: startMin, last: Math.max(endMin, startMin) }
    else {
      current.first = Math.min(current.first, startMin)
      current.last = Math.max(current.last, endMin)
    }
  }
  return map
}
