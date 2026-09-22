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
  fillRate,
  formatTime,
  minutesSinceMidnight,
  formatDateLong,
} from '@/lib/utils'
import { NOW } from '@/lib/demo-core'
import type { CalendarEvent } from '@/lib/demo'
import {
  DepartureChip,
  EVENT_BORDER,
  EVENT_SOLID,
  EVENT_TINT,
  eventVar,
} from '@/components/dashboard/calendar/departure-chip'

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
          className="absolute right-2 -translate-y-1/2 text-xs font-medium tracking-wide text-faint tabular"
          style={{ top: (hour - startHour) * HOUR_HEIGHT }}
        >
          {hourLabel(hour)}
        </div>
      ))}

      {showNow ? (
        <div
          className="absolute right-1 -translate-y-1/2 rounded-md bg-danger px-1 py-px text-xs font-bold text-on-accent tabular"
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
                aria-label={`Add availability at ${hourLabel(hour)} on ${formatDateLong(day)}`}
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

   A proportional time grid is the wrong instrument here. At 90+ departures a
   week this operator runs 12-16 concurrent blocks per day, and a time grid
   divides the column between them — every block lands about 8px wide, so
   every label truncates to "6:0 M C." and the colour coding carries all the
   meaning on its own.

   So the week drops proportional positioning and stacks instead: each
   departure gets the FULL column width, in time order, inside a time-of-day
   band. You lose "this block is twice as tall because it runs twice as long"
   and gain being able to read the activity name, the time and the seat count
   — which is what an operator actually scans a week for.

   Day view keeps the real time grid (one day across the full width has room
   for it), and every export above is still what it uses.
   ========================================================================== */

interface Band {
  key: string
  label: string
  /** Inclusive start hour, exclusive end. */
  from: number
  to: number
}

/** Bands chosen to match how the day actually runs, not even clock divisions. */
const BANDS: Band[] = [
  { key: 'early', label: 'Early', from: 0, to: 9 },
  { key: 'morning', label: 'Morning', from: 9, to: 12 },
  { key: 'afternoon', label: 'Afternoon', from: 12, to: 17 },
  { key: 'evening', label: 'Evening', from: 17, to: 24 },
]

function bandFor(event: CalendarEvent): Band {
  const hour = new Date(event.departure.startsAt).getHours()
  return BANDS.find((b) => hour >= b.from && hour < b.to) ?? BANDS[BANDS.length - 1]
}

/**
 * One departure, full column width. Everything an operator scans for is on
 * three lines: when, what, and how full.
 */
function DepartureCard({
  event,
  onSelect,
}: {
  event: CalendarEvent
  onSelect: (departureId: string) => void
}) {
  const { departure, activity, seatsLeft } = event
  const cancelled = departure.status === 'cancelled'
  const weather = departure.status === 'weather_hold'
  const soldOut = !cancelled && seatsLeft === 0
  const fill = fillRate(departure.booked, departure.capacity)

  return (
    <button
      type="button"
      onClick={() => onSelect(departure.id)}
      aria-label={`${formatTime(departure.startsAt)} ${activity.name}, ${departure.booked} of ${departure.capacity} seats booked${
        cancelled ? ', cancelled' : soldOut ? ', sold out' : weather ? ', weather hold' : ''
      }`}
      className={cn(
        'group/card relative block w-full overflow-hidden rounded-lg border py-1.5 pr-1.5 pl-2 text-left',
        eventVar(activity.colorKey),
        'transition-all duration-150 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-px hover:shadow-sm',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        cancelled
          ? 'border-line-subtle bg-surface-sunken/60 opacity-65'
          : weather
            ? 'border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-warning-soft/45'
            : cn(EVENT_BORDER, EVENT_TINT),
        soldOut && !cancelled && 'ring-1 ring-[color-mix(in_oklab,var(--evt)_40%,transparent)] ring-inset',
      )}
    >
      {/* Activity identity rail — the one place colour still does work. */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1 left-0 w-[3px] rounded-full',
          cancelled ? 'bg-line-strong' : weather ? 'bg-warning' : EVENT_SOLID,
        )}
      />

      {/* when · how full */}
      <div className="flex items-baseline justify-between gap-1.5">
        <span
          className={cn(
            'text-xs leading-none font-bold tabular-nums',
            cancelled ? 'text-faint line-through' : 'text-foreground',
          )}
        >
          {formatTime(departure.startsAt)}
        </span>
        <span
          className={cn(
            'shrink-0 text-xs leading-none font-semibold tabular-nums',
            cancelled ? 'text-faint' : soldOut ? 'text-accent' : 'text-muted',
          )}
        >
          {cancelled ? 'Cancelled' : `${departure.booked}/${departure.capacity}`}
        </span>
      </div>

      {/* what */}
      <p
        className={cn(
          'mt-1 line-clamp-2 text-xs leading-tight font-medium',
          cancelled ? 'text-faint line-through' : 'text-foreground',
        )}
      >
        {activity.name}
      </p>

      {/* how full, at a glance */}
      {!cancelled ? (
        <span
          aria-hidden="true"
          className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-sunken"
        >
          <span
            className={cn('block h-full rounded-full', weather ? 'bg-warning' : EVENT_SOLID)}
            style={{ width: `${Math.max(3, fill)}%` }}
          />
        </span>
      ) : null}

      {/* Only the states that change what you'd do get a word. */}
      {soldOut && !cancelled ? (
        <span className="mt-1 block text-xs leading-none font-bold tracking-wide text-accent uppercase">
          Sold out
        </span>
      ) : weather ? (
        <span className="mt-1 block text-xs leading-none font-bold tracking-wide text-warning uppercase">
          Weather hold
        </span>
      ) : seatsLeft <= 3 ? (
        <span className="mt-1 block text-xs leading-none font-semibold text-subtle tabular-nums">
          {seatsLeft} left
        </span>
      ) : null}
    </button>
  )
}

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

  /** day key -> band key -> departures, each list already in time order. */
  const byDayBand = React.useMemo(() => {
    const map = new Map<string, Map<string, CalendarEvent[]>>()
    const sorted = [...events].sort((a, b) =>
      a.departure.startsAt.localeCompare(b.departure.startsAt),
    )
    for (const event of sorted) {
      const dayKey = event.departure.startsAt.slice(0, 10)
      const bandKey = bandFor(event).key
      let bands = map.get(dayKey)
      if (!bands) {
        bands = new Map()
        map.set(dayKey, bands)
      }
      const bucket = bands.get(bandKey)
      if (bucket) bucket.push(event)
      else bands.set(bandKey, [event])
    }
    return map
  }, [events])

  /** Only render bands that any day in the week actually uses. */
  const activeBands = React.useMemo(
    () =>
      BANDS.filter((band) =>
        days.some((day) => (byDayBand.get(toDateKey(day))?.get(band.key)?.length ?? 0) > 0),
      ),
    [days, byDayBand],
  )

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="max-h-[calc(100dvh-17rem)] min-h-[30rem] overflow-auto">
        <div className="min-w-[56rem]">
          {/* ---- sticky day header ---------------------------------------- */}
          <div className="sticky top-0 z-40 grid grid-cols-7 border-b border-line bg-surface/92 backdrop-blur-md">
            {days.map((day) => {
              const bands = byDayBand.get(toDateKey(day))
              const dayEvents = bands ? [...bands.values()].flat() : []
              const isToday = isSameDay(day, NOW)
              const isWeekend = day.getDay() === 0 || day.getDay() === 6
              const live = dayEvents.filter((e) => e.departure.status !== 'cancelled')
              const guests = live.reduce((sum, e) => sum + e.departure.booked, 0)
              const seats = live.reduce((sum, e) => sum + e.departure.capacity, 0)
              const sold = fillRate(guests, seats)

              return (
                <button
                  key={toDateKey(day)}
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`Open ${formatDateLong(day)}`}
                  className={cn(
                    'flex flex-col items-center gap-1 border-l border-line-subtle px-2 py-2.5 first:border-l-0',
                    'transition-colors duration-150 hover:bg-surface-sunken',
                    isWeekend && 'bg-surface-sunken/40',
                    isToday && 'bg-info-soft/45',
                  )}
                >
                  <span className="text-xs font-semibold tracking-wider text-faint uppercase">
                    {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(day)}
                  </span>
                  <span
                    className={cn(
                      'inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                      isToday ? 'bg-info text-white' : 'text-foreground',
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {dayEvents.length === 0 ? (
                    <span className="text-xs text-faint">—</span>
                  ) : (
                    <>
                      <span className="text-xs text-subtle tabular-nums">
                        {live.length} runs · {guests}g
                      </span>
                      {/* One bar per day makes the week's shape readable at a glance. */}
                      <span
                        aria-hidden="true"
                        className="mt-0.5 block h-1 w-full max-w-[4.5rem] overflow-hidden rounded-full bg-surface-sunken"
                      >
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            sold >= 90 ? 'bg-accent' : sold >= 60 ? 'bg-primary' : 'bg-line-strong',
                          )}
                          style={{ width: `${Math.max(3, sold)}%` }}
                        />
                      </span>
                    </>
                  )}
                </button>
              )
            })}
          </div>

          {/* ---- banded, stacked departures -------------------------------- */}
          {activeBands.map((band) => (
            <section key={band.key} className="border-b border-line last:border-b-0">
              <h3 className="sticky top-[5.25rem] z-30 flex items-center gap-2 bg-surface-sunken/85 px-3 py-1 text-xs font-bold tracking-[0.12em] text-subtle uppercase backdrop-blur-sm">
                {band.label}
                <span className="font-medium tracking-normal text-faint normal-case">
                  {hourLabel(band.from)} – {hourLabel(band.to === 24 ? 23 : band.to)}
                </span>
              </h3>

              <div className="grid grid-cols-7">
                {days.map((day) => {
                  const dayEvents = byDayBand.get(toDateKey(day))?.get(band.key) ?? []
                  const isToday = isSameDay(day, NOW)
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6

                  return (
                    <div
                      key={toDateKey(day)}
                      className={cn(
                        'flex flex-col gap-1.5 border-l border-line-subtle p-1.5 first:border-l-0',
                        isWeekend && 'bg-surface-sunken/25',
                        isToday && 'bg-info-soft/15',
                      )}
                    >
                      {dayEvents.map((event) => (
                        <DepartureCard
                          key={event.departure.id}
                          event={event}
                          onSelect={onSelectEvent}
                        />
                      ))}

                      {/* Quiet affordance — never competes with the cards. */}
                      <button
                        type="button"
                        onClick={() =>
                          onCreate(
                            new Date(
                              day.getFullYear(),
                              day.getMonth(),
                              day.getDate(),
                              band.from === 0 ? 7 : band.from,
                              0,
                            ),
                          )
                        }
                        aria-label={`New ${band.label.toLowerCase()} departure on ${formatDateLong(day)}`}
                        className={cn(
                          'flex min-h-6 items-center justify-center rounded-md border border-dashed border-line-subtle',
                          'opacity-0 transition-opacity duration-150',
                          'hover:border-primary hover:bg-primary-soft/40 hover:opacity-100 focus-visible:opacity-100',
                          dayEvents.length === 0 && 'opacity-40',
                        )}
                      >
                        <Plus aria-hidden="true" className="size-3 text-primary" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}

          {activeBands.length === 0 ? (
            <p className="px-4 py-16 text-center text-sm text-subtle">
              No departures scheduled this week.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
