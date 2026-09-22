import type { ActivityFormat } from '@/types'

/* ==========================================================================
   How an experience runs. Three answers, and the whole dashboard reads
   from them: departures leave as a group at set times and get a manifest;
   open entry lets guests arrive any time in the hours, with capacity per
   arrival slot; fixed dates run only on the dates listed. Browser safe.
   ========================================================================== */

export const ACTIVITY_FORMATS: ActivityFormat[] = ['departures', 'open', 'dates']

export const ACTIVITY_FORMAT_META: Record<ActivityFormat, { label: string; hint: string; unit: string; units: string }> = {
  departures: { label: 'Departures', hint: 'Leaves as a group at set times. Every departure has a manifest.', unit: 'departure', units: 'departures' },
  open: { label: 'Open entry', hint: 'Guests arrive any time within the hours. Capacity is per arrival slot.', unit: 'arrival slot', units: 'arrival slots' },
  dates: { label: 'Fixed dates', hint: 'Runs only on the dates listed, each with its own time.', unit: 'date', units: 'dates' },
}

/** Departures and fixed dates both leave as a group; open entry does not. */
export function leavesAsGroup(format: ActivityFormat) {
  return format !== 'open'
}
