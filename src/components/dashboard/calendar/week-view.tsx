'use client'

/**
 * WeekView — the workhorse. A seven-column time grid with real overlap
 * resolution.
 *
 * The lane algorithm is the classic two-pass sweep: group departures into
 * clusters of transitively-overlapping blocks, greedily assign each block the
 * first lane that has freed up, then give every block in the cluster the same
 * lane count so widths line up. It is O(n log n) and handles the 08:00 / 08:00
 * double-run that Blue Horizon actually schedules.
 */

import * as React from 'react'
import { Plus } from 'lucide-react'

import {
  cn,
  addDays,
  toDateKey,
  isSameDay,
  clamp,
  minutesSinceMidnight,
  formatDateLong,
} from '@/lib/utils'
import { NOW } from '@/lib/demo-core'
import type { CalendarEvent } from '@/lib/demo'
import { DepartureChip } from '@/components/dashboard/calendar/departure-chip'

/* ==========================================================================
   GEOMETRY
   ========================================================================== */

export const HOUR_HEIGHT = 60
const DEFAULT_START_HOUR = 6
const DEFAULT_END_HOUR = 21

export interface LaneItem {
  event: CalendarEvent
  startMin: number
  endMin: number
  lane: number
  lanes: number
}

/** Greedy lane packing within clusters of overlapping departures. */
export function layoutLanes(events: CalendarEvent[]): LaneItem[] {
  const items: LaneItem[] = events
    .map((event) => {
      const start = new Date(event.departure.startsAt)
      const end = new Date(event.departure.endsAt)
      const startMin = minutesSinceMidnight(start)
      const rawEnd = minutesSinceMidnight(end)
      // A departure that ends past midnight reads as running to the day's edge.
      const endMin = rawEnd > startMin ? Math.max(rawEnd, startMin + 30) : 24 * 60
      return { event, startMin, endMin, lane: 0, lanes: 1 }
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin)

  let cluster: LaneItem[] = []
  let clusterEnd = -1
  const laneEnds: number[] = []

  const flush = () => {
    if (cluster.length === 0) return
    const lanes = cluster.reduce((max, item) => Math.max(max, item.lane), 0) + 1
    for (const item of cluster) item.lanes = lanes
    cluster = []
  }

  for (const item of items) {
    if (item.startMin >= clusterEnd) {
      flush()
      laneEnds.length = 0
      clusterEnd = -1
    }

    let lane = laneEnds.findIndex((end) => end <= item.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.endMin)
    } else {
      laneEnds[lane] = item.endMin
    }

    item.lane = lane
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  flush()

  return items
}

/** The visible window: the 06:00–21:00 default, widened to fit real departures. */
export function gridBounds(events: CalendarEvent[]) {
  let startHour = DEFAULT_START_HOUR
  let endHour = DEFAULT_END_HOUR

  for (const { departure } of events) {
    const start = new Date(departure.startsAt)
    const end = new Date(departure.endsAt)
    const startMin = minutesSinceMidnight(start)
    const endMin = minutesSinceMidnight(end)
    startHour = Math.min(startHour, Math.floor(startMin / 60))
    if (endMin > startMin) endHour = Math.max(endHour, Math.ceil(endMin / 60))
  }

  return { startHour: clamp(startHour, 0, 23), endHour: clamp(endHour, 1, 24) }
}

export function hourLabel(hour: number) {
  const normalised = hour % 24
  const suffix = normalised < 12 ? 'AM' : 'PM'
  const display = normalised % 12 === 0 ? 12 : normalised % 12
  return `${display} ${suffix}`
}

export function nowOffsetPx(startHour: number) {
  return (minutesSinceMidnight(NOW) - startHour * 60) * (HOUR_HEIGHT / 60)
}

/* ==========================================================================
   SHARED PARTS — also used by DayView
   ========================================================================== */

export function TimeAxis({
  startHour,
  endHour,
  showNow,
}: {
  startHour: number
  endHour: number
  showNow: boolean
}) {
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i)

  return (
    <div
      className="relative shrink-0 border-r border-line-subtle"
      style={{ height: (endHour - startHour) * HOUR_HEIGHT }}
      aria-hidden="true"
    >
      {hours.map((hour) => (
        <div
          key={hour}
          className="absolute right-2 -translate-y-1/2 text-[0.625rem] font-medium tracking-wide text-faint tabular"
          style={{ top: (hour - startHour) * HOUR_HEIGHT }}
        >
          {hourLabel(hour)}
        </div>
      ))}

      {showNow ? (
        <div
          className="absolute right-1 -translate-y-1/2 rounded-md bg-danger px-1 py-px text-[0.5625rem] font-bold text-on-accent tabular"
          style={{ top: nowOffsetPx(startHour) }}
        >
          {NOW.getHours() % 12 === 0 ? 12 : NOW.getHours() % 12}:
          {String(NOW.getMinutes()).padStart(2, '0')}
        </div>
      ) : null}
    </div>
  )
}

export function HourLines({
  startHour,
  endHour,
  day,
  onCreate,
}: {
  startHour: number
  endHour: number
  day: Date
  onCreate?: (date: Date) => void
}) {
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i)

  return (
    <>
      {hours.map((hour) => {
        const slot = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0, 0)
        return (
          <div
            key={hour}
            className="group/slot absolute inset-x-0 border-t border-line-subtle"
            style={{ top: (hour - startHour) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          >
            {onCreate ? (
              <button
                type="button"
                onClick={() => onCreate(slot)}
                aria-label={`New departure at ${hourLabel(hour)} on ${formatDateLong(day)}`}
                className={cn(
                  'flex size-full items-start justify-center pt-1 opacity-0 transition-opacity duration-150',
                  'hover:bg-primary-soft/40 hover:opacity-100 focus-visible:opacity-100',
                )}
              >
                <Plus aria-hidden="true" className="size-3.5 text-primary" />
              </button>
            ) : null}
          </div>
        )
      })}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 border-t border-line-subtle"
        style={{ top: (endHour - startHour) * HOUR_HEIGHT }}
      />
    </>
  )
}

export function NowLine({ startHour }: { startHour: number }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 z-30"
      style={{ top: nowOffsetPx(startHour) }}
    >
      <div className="relative h-px bg-danger">
        <span className="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-danger shadow-[0_0_0_3px_color-mix(in_oklab,var(--danger)_22%,transparent)]" />
      </div>
    </div>
  )
}

export function EventLayer({
  events,
  startHour,
  endHour,
  onSelectEvent,
  gutter = 3,
}: {
  events: CalendarEvent[]
  startHour: number
  endHour: number
  onSelectEvent: (departureId: string) => void
  gutter?: number
}) {
  const laid = React.useMemo(() => layoutLanes(events), [events])
  const total = (endHour - startHour) * HOUR_HEIGHT

  return (
    <>
      {laid.map((item) => {
        const rawTop = (item.startMin - startHour * 60) * (HOUR_HEIGHT / 60)
        const top = clamp(rawTop, 0, Math.max(total - 20, 0))
        const rawHeight = (item.endMin - item.startMin) * (HOUR_HEIGHT / 60)
        const height = clamp(rawHeight, 21, Math.max(total - top, 21))
        const widthPct = 100 / item.lanes
        const leftPct = item.lane * widthPct

        return (
          <DepartureChip
            key={item.event.departure.id}
            event={item.event}
            variant="block"
            heightPx={height}
            onSelect={onSelectEvent}
            style={{
              top,
              height,
              left: `calc(${leftPct}% + ${gutter}px)`,
              width: `calc(${widthPct}% - ${gutter * 2}px)`,
              zIndex: 10 + item.lane,
            }}
          />
        )
      })}
    </>
  )
}

/* ==========================================================================
   WEEK VIEW
   ========================================================================== */

export interface WeekViewProps {
  weekStart: Date
  events: CalendarEvent[]
  onSelectEvent: (departureId: string) => void
  onCreate: (date: Date) => void
  onOpenDay: (date: Date) => void
}

export function WeekView({
  weekStart,
  events,
  onSelectEvent,
  onCreate,
  onOpenDay,
}: WeekViewProps) {
  const days = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const byDay = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = event.departure.startsAt.slice(0, 10)
      const bucket = map.get(key)
      if (bucket) bucket.push(event)
      else map.set(key, [event])
    }
    return map
  }, [events])

  const { startHour, endHour } = React.useMemo(() => gridBounds(events), [events])
  const totalHeight = (endHour - startHour) * HOUR_HEIGHT
  const todayIndex = days.findIndex((day) => isSameDay(day, NOW))

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="max-h-[calc(100dvh-17rem)] min-h-[30rem] overflow-auto">
        <div className="min-w-[54rem]">
          {/* Sticky day header */}
          <div className="sticky top-0 z-40 grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-line bg-surface/92 backdrop-blur-md">
            <div className="border-r border-line-subtle" />
            {days.map((day) => {
              const dayEvents = byDay.get(toDateKey(day)) ?? []
              const isToday = isSameDay(day, NOW)
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              const guests = dayEvents.reduce(
                (sum, e) => (e.departure.status === 'cancelled' ? sum : sum + e.departure.booked),
                0,
              )

              return (
                <button
                  key={toDateKey(day)}
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`Open ${formatDateLong(day)}`}
                  className={cn(
                    'flex flex-col items-center gap-0.5 border-l border-line-subtle px-2 py-2.5',
                    'transition-colors duration-150 hover:bg-surface-sunken',
                    isWeekend && 'bg-surface-sunken/40',
                    isToday && 'bg-primary-soft/40',
                  )}
                >
                  <span className="text-[0.625rem] font-semibold tracking-wider text-faint uppercase">
                    {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day)}
                  </span>
                  <span
                    className={cn(
                      'tabular inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold',
                      isToday ? 'bg-primary text-on-primary' : 'text-foreground',
                    )}
                  >
                    {day.getDate()}
                  </span>
                  <span className="tabular text-[0.625rem] text-subtle">
                    {dayEvents.length === 0 ? '—' : `${dayEvents.length} · ${guests}g`}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Time grid */}
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] pt-3 pb-6">
            <TimeAxis startHour={startHour} endHour={endHour} showNow={todayIndex >= 0} />

            {days.map((day) => {
              const dayEvents = byDay.get(toDateKey(day)) ?? []
              const isToday = isSameDay(day, NOW)
              const isWeekend = day.getDay() === 0 || day.getDay() === 6

              return (
                <div
                  key={toDateKey(day)}
                  className={cn(
                    'relative border-l border-line-subtle',
                    isWeekend && 'bg-surface-sunken/30',
                    isToday && 'bg-primary-soft/15',
                  )}
                  style={{ height: totalHeight }}
                >
                  <HourLines
                    startHour={startHour}
                    endHour={endHour}
                    day={day}
                    onCreate={onCreate}
                  />
                  <EventLayer
                    events={dayEvents}
                    startHour={startHour}
                    endHour={endHour}
                    onSelectEvent={onSelectEvent}
                  />
                  {isToday ? <NowLine startHour={startHour} /> : null}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
