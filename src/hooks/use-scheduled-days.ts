'use client'

import * as React from 'react'

import { NOW } from '@/lib/data/constants'
import {
  ACTIVITY_OVERRIDES_EVENT,
  applyActivityOverride,
  parseActivityOverrides,
  readActivityOverridesRaw,
  type ActivityOverride,
} from '@/lib/activity-overrides'
import { bookedGeneratedSlots, rebuildAvailabilityDays, rebuildScheduleRows, scheduleContextOf, shiftDayKey, type ScheduledRow } from '@/lib/activity-schedule'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import type { AvailabilityDay } from '@/components/storefront/booking-widget'
import type { DepartureRowLite } from '@/components/dashboard/activities/activity-data'
import type { Activity } from '@/types'

/* ==========================================================================
   useScheduledDays — the storefront's day strip and the dashboard's time
   slot list, rebuilt in the browser from the schedule the owner saved (and
   the business's closed days), because the server only has the seeded
   time slots. Seeded slots keep their ids and bookings; new times get
   generated ids the checkout understands, and the storefront strip runs
   on past the seeded days up to the booking window. Until anything is
   saved (or a generated time slot is booked here), the seeded list comes
   back untouched, so the first render matches the server.
   ========================================================================== */

const pad = (n: number) => String(n).padStart(2, '0')
const LOCAL_NOW = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}T${pad(NOW.getHours())}:${pad(NOW.getMinutes())}:00`

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(ACTIVITY_OVERRIDES_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(ACTIVITY_OVERRIDES_EVENT, onChange)
  }
}

/** The saved edit for one activity, live. */
function useSavedEdit(activityId: string | undefined): ActivityOverride | undefined {
  const raw = React.useSyncExternalStore(subscribe, readActivityOverridesRaw, () => '')
  return React.useMemo(() => (activityId && raw ? parseActivityOverrides(raw)[activityId] : undefined), [raw, activityId])
}

const hasClosures = (ctx: ReturnType<typeof scheduleContextOf>, activity: Activity) =>
  !activity.runsOnClosures && ((ctx.closures?.length ?? 0) > 0 || Boolean(ctx.holidays?.enabled))

/** This browser booked a generated time slot of the activity: it stays listed even with nothing saved any more. */
const hasBookedGenerated = (activity: Activity, delta: Record<string, number> | undefined) =>
  bookedGeneratedSlots(activity.id, delta, '0000-01-01', '9999-12-31').length > 0

export interface ScheduledDaysOptions {
  tenantSlug: string
  /** The demo clock, local ISO. Default: the demo's NOW. */
  nowIso?: string
  /** Seats this browser's bookings take per time slot (the ledger), so a booked time slot the schedule dropped is kept. */
  delta?: Record<string, number>
}

/**
 * The storefront strip for an activity. Pass the seeded activity (as the
 * server sent it) and its seeded days; the saved edit is read here.
 */
export function useScheduledDays(activity: Activity, seededDays: AvailabilityDay[], opts: ScheduledDaysOptions): AvailabilityDay[] {
  const saved = useSavedEdit(activity.id)
  const { defaults } = useBookingDefaults(opts.tenantSlug)
  const nowIso = (opts.nowIso ?? LOCAL_NOW).slice(0, 19)
  const delta = opts.delta
  return React.useMemo(() => {
    const ctx = scheduleContextOf(defaults)
    if (!saved && !activity.schedules && !activity.scheduleChanges && !hasClosures(ctx, activity) && !hasBookedGenerated(activity, delta)) return seededDays
    try {
      const edited = applyActivityOverride(activity, saved)
      return rebuildAvailabilityDays(activity, edited, seededDays, { ...ctx, nowIso, maxAdvanceDays: defaults.maxAdvanceDays, delta })
    } catch {
      // A broken saved edit never takes the storefront down: the seeded times still sell.
      return seededDays
    }
  }, [activity, saved, defaults, seededDays, nowIso, delta])
}

export interface ScheduledRowsOptions {
  tenantSlug: string
  /** "YYYY-MM-DD": the first day rebuilt. */
  todayKey: string
  /** Days from today rebuilt. */
  days: number
  /** The demo clock, local ISO: generated times before it are left out. */
  nowIso?: string
}

/**
 * The dashboard's time slot rows for an activity, rebuilt from its saved
 * schedule. Generated time slots booked in this browser (the ledger) stay
 * even when the schedule drops their time. Without an activity, or before
 * anything is saved or booked, the rows come back as they are.
 */
export function useScheduledRows(activity: Activity | undefined, rows: DepartureRowLite[], opts: ScheduledRowsOptions): ScheduledRow[] {
  const saved = useSavedEdit(activity?.id)
  const { defaults } = useBookingDefaults(opts.tenantSlug)
  // Empty on the server and during hydration, like the saved edit.
  const { delta } = useBookingLedger(opts.tenantSlug)
  return React.useMemo(() => {
    if (!activity) return rows
    const ctx = scheduleContextOf(defaults)
    if (!saved && !activity.schedules && !activity.scheduleChanges && !hasClosures(ctx, activity) && !hasBookedGenerated(activity, delta)) return rows
    try {
      const edited = applyActivityOverride(activity, saved)
      return rebuildScheduleRows(activity, edited, rows, { ...ctx, fromKey: opts.todayKey, toKey: shiftDayKey(opts.todayKey, Math.max(0, opts.days - 1)), nowIso: opts.nowIso, delta })
    } catch {
      return rows
    }
  }, [activity, saved, defaults, delta, rows, opts.todayKey, opts.days, opts.nowIso])
}
