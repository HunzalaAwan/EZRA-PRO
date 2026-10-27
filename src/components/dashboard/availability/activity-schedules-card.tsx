'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

import { EVENT_SOLID, eventVar } from '@/components/dashboard/calendar/departure-chip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import { applyActivityOverride } from '@/lib/activity-overrides'
import { WEEKDAY_KEYS, clockTime, describeSchedules, expandSchedules, scheduleContextOf, schedulesOf, shiftDayKey, shortDay, sortTimes, timesForWeekday } from '@/lib/activity-schedule'
import { cn, formatNumber, pluralize } from '@/lib/utils'
import type { Activity, ScheduleChange } from '@/types'

/* ==========================================================================
   Activity schedules — each live activity's schedule in one line, the
   number of time slots it has over the next 30 days, its next change, and
   a link to its Schedule step. Saved edits and the business's closed days
   are laid over the seeded activity here, after hydration.
   ========================================================================== */

const DAYS_AHEAD = 30

/** A change in a few words: "Closed", "9:00 cancelled", "Extra time 17:30", "Different times", "Spots changed". */
function changeWords(change: ScheduleChange): string {
  const times = sortTimes(change.times ?? []).map(clockTime)
  switch (change.action) {
    case 'closed':
      if (times.length === 0) return 'Closed'
      return `${times.join(', ')} ${isCancel(change) ? 'cancelled' : 'closed'}`
    case 'add':
      return times.length === 1 ? `Extra time ${times[0]}` : 'Extra times'
    case 'times':
      return 'Different times'
    case 'spots':
      return change.spots !== undefined ? `${change.spots} ${pluralize(change.spots, 'spot')}` : 'Spots changed'
  }
}

/** A time slot cancelled from the calendar: its reason is already in the words. */
const isCancel = (change: ScheduleChange) => change.action === 'closed' && change.reason?.trim() === 'Cancelled'

/**
 * The schedule line without the booking window when the activity follows the
 * business's (Settings → Booking flow), so it isn't repeated on every row.
 */
function summaryOf(activity: Activity, maxAdvanceDays: number, todayKey: string): string {
  const parts = describeSchedules(activity, { maxAdvanceDays, todayKey }).split(' · ')
  return (activity.bookingWindow?.monthsAhead ? parts : parts.filter((part) => !part.startsWith('books up to'))).join(' · ')
}

const WEEKDAY_WORD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * A transfer's schedule in its own words: "Rides 6:00 AM–11:30 PM, every day"
 * (private, by the hour) or "Runs 7:00 AM, 9:00 AM… every day" (a shuttle).
 * Undefined when it has seasons or days that differ: the usual line says those.
 */
function transferSummary(activity: Activity): string | undefined {
  if (activity.kind !== 'transfer') return undefined
  const seasons = schedulesOf(activity)
  if (seasons.length !== 1) return undefined
  const season = seasons[0]
  const open = WEEKDAY_KEYS.filter((key) => (season.mode === 'hours' ? Boolean(season.hours?.[key]) : timesForWeekday(season, key).length > 0))
  if (open.length === 0) return undefined
  const days = open.length === 7 ? 'every day' : open.map((key) => WEEKDAY_WORD[Number(key)]).join(', ')
  if (season.mode === 'hours') {
    const first = season.hours?.[open[0]]
    if (!first || open.some((key) => season.hours?.[key]?.open !== first.open || season.hours?.[key]?.close !== first.close)) return undefined
    return `Rides ${clockTime(first.open)}–${clockTime(first.close)}, ${days}`
  }
  const times = timesForWeekday(season, open[0])
  if (open.some((key) => timesForWeekday(season, key).join() !== times.join())) return undefined
  return `Runs ${times.map(clockTime).join(', ')}, ${days}`
}

/** The next thing that changes on the schedule from today: a change on a day, or a season starting. */
function nextChange(activity: Activity, todayKey: string): string | null {
  let best: { key: string; text: string } | null = null
  for (const change of activity.scheduleChanges ?? []) {
    const key = (change.dates ?? []).filter((date) => date >= todayKey).sort()[0]
    if (!key || (best && key >= best.key)) continue
    const reason = isCancel(change) ? '' : change.reason?.trim()
    best = { key, text: `${shortDay(key)} · ${changeWords(change)}${reason ? ` · ${reason}` : ''}` }
  }
  const seasons = schedulesOf(activity)
  for (const season of seasons) {
    const name = season.name.trim() || 'Season'
    if (season.from && season.from > todayKey && (!best || season.from < best.key)) {
      best = { key: season.from, text: `${shortDay(season.from)} · ${name} starts` }
    }
    // Its last day, unless another season takes over the next day (that one's start says it).
    if (season.to && season.to >= todayKey && (!best || season.to < best.key)) {
      const next = shiftDayKey(season.to, 1)
      if (!seasons.some((other) => other !== season && other.from === next && (other.locationId ?? '') === (season.locationId ?? ''))) {
        best = { key: season.to, text: `${shortDay(season.to)} · ${name} ends` }
      }
    }
  }
  return best?.text ?? null
}

interface Row {
  activity: Activity
  summary: string
  /** Time slots over the next 30 days; null for a package (it uses its activities' times). */
  count: number | null
  next: string | null
}

export interface ActivitySchedulesCardProps {
  tenantSlug: string
  activities: Activity[]
  todayKey: string
  nowIso: string
}

export function ActivitySchedulesCard({ tenantSlug, activities, todayKey, nowIso }: ActivitySchedulesCardProps) {
  const overrides = useActivityOverrides()
  const { defaults } = useBookingDefaults(tenantSlug)

  const rows = React.useMemo<Row[]>(() => {
    const ctx = scheduleContextOf(defaults)
    const lastKey = shiftDayKey(todayKey, DAYS_AHEAD - 1)
    const nowTime = nowIso.slice(11, 16)
    return activities.map((seeded) => {
      const activity = applyActivityOverride(seeded, overrides[seeded.id])
      if (activity.kind === 'package') return { activity, summary: 'Uses the times of the activities in it', count: null, next: null }
      try {
        const count = expandSchedules(activity, todayKey, lastKey, ctx).filter((slot) => slot.dateKey > todayKey || slot.time >= nowTime).length
        return {
          activity,
          summary: transferSummary(activity) ?? summaryOf(activity, defaults.maxAdvanceDays, todayKey),
          count,
          next: nextChange(activity, todayKey),
        }
      } catch {
        // A broken saved edit never takes the page down.
        return { activity, summary: 'Schedule could not be read', count: null, next: null }
      }
    })
  }, [activities, overrides, defaults, todayKey, nowIso])

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            Activity schedules
          </CardTitle>
          <CardDescription>Set on each activity’s Schedule step.</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-subtle">
            No live activities.{' '}
            <Link href="/dashboard/activities" className="font-medium text-primary hover:underline">
              Go to activities
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
            {rows.map(({ activity, summary, count, next }) => (
              <li key={activity.id} className="flex flex-col gap-3 bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span aria-hidden="true" className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', eventVar(activity.colorKey), EVENT_SOLID)} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <span className="truncate">{activity.name}</span>
                      {activity.runsOnClosures ? (
                        <Badge variant="neutral" size="sm">
                          Runs on closed days
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">{summary}</p>
                    {next ? <p className="mt-0.5 text-xs text-subtle">Next change: {next}</p> : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 pl-5.5 sm:justify-end sm:pl-0">
                  {count !== null ? (
                    <p className="text-xs text-muted tabular sm:text-right">
                      <span className="text-sm font-semibold text-foreground">{formatNumber(count)}</span> {pluralize(count, 'time slot')}
                      <span className="block text-subtle">next {DAYS_AHEAD} days</span>
                    </p>
                  ) : (
                    <span />
                  )}
                  {activity.kind !== 'package' ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/activities/${activity.id}/edit?step=schedule`}>Edit schedule</Link>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
