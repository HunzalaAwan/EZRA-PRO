'use client'

/**
 * MonthView — the 6x7 planning grid.
 *
 * WHAT A MONTH IS FOR: spotting shape and outliers across ~560 departures —
 * which days are full, which are soft, which need attention. Nobody reads
 * individual departures in a 120px cell.
 *
 * The previous cell listed the first three departures as text chips. Because
 * this operator runs the same core schedule daily, that rendered the identical
 * three truncated names ("6:00 AM Molokini Crater Dawn …") on all 30 days —
 * noise carrying no information — while "+9 more" hid the part that actually
 * varies.
 *
 * So the cell now answers the three questions a month is asked:
 *   how full is that day   → the fill figure and bar, the loudest thing in the cell
 *   how much is on         → runs and guests
 *   is anything wrong      → exception badges, and nothing when all is well
 *
 * Individual departures are still one click away: the counts row opens a
 * popover listing them, and the date opens the day view.
 */

import * as React from 'react'
import { CloudRain, Lock, Plus, Ban } from 'lucide-react'

import { cn, buildMonthGrid, toDateKey, formatDateLong, isSameDay, formatNumber } from '@/lib/utils'
import { NOW } from '@/lib/demo-core'
import type { CalendarEvent } from '@/lib/demo'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { capacityTone } from '@/components/ui/progress'
import {
  DepartureChip,
  EVENT_SOLID,
  eventVar,
} from '@/components/dashboard/calendar/departure-chip'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
/** Distinct activity colours shown per cell before collapsing to a count. */
const MAX_DOTS = 6

const TONE_BAR: Record<'success' | 'warning' | 'danger', string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
}

const TONE_TEXT: Record<'success' | 'warning' | 'danger', string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

export interface MonthViewProps {
  month: Date
  eventsByDay: Record<string, CalendarEvent[]>
  onSelectEvent: (departureId: string) => void
  onCreate: (date: Date) => void
  onOpenDay: (date: Date) => void
}

interface DaySummary {
  booked: number
  capacity: number
  fill: number
  live: number
  soldOut: number
  weather: number
  cancelled: number
  /** Distinct activity colour keys, in first-departure order. */
  colours: string[]
}

function summarise(events: CalendarEvent[]): DaySummary {
  let booked = 0
  let capacity = 0
  let live = 0
  let soldOut = 0
  let weather = 0
  let cancelled = 0
  const colours: string[] = []

  for (const event of events) {
    const { departure, activity, seatsLeft } = event
    if (!colours.includes(activity.colorKey)) colours.push(activity.colorKey)

    if (departure.status === 'cancelled') {
      cancelled += 1
      continue
    }
    live += 1
    booked += departure.booked
    capacity += departure.capacity
    if (departure.status === 'weather_hold') weather += 1
    else if (seatsLeft === 0) soldOut += 1
  }

  return {
    booked,
    capacity,
    live,
    soldOut,
    weather,
    cancelled,
    colours,
    fill: capacity === 0 ? 0 : Math.round((booked / capacity) * 100),
  }
}

export function MonthView({
  month,
  eventsByDay,
  onSelectEvent,
  onCreate,
  onOpenDay,
}: MonthViewProps) {
  const cells = React.useMemo(() => buildMonthGrid(month), [month])
  const currentMonth = month.getMonth()

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-line bg-surface-sunken/60">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={cn(
              'px-2 py-2 text-center text-[0.6875rem] font-semibold tracking-wider uppercase',
              index >= 5 ? 'text-subtle' : 'text-faint',
            )}
          >
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">{label[0]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, index) => {
          const key = toDateKey(day)
          const events = eventsByDay[key] ?? []
          const summary = summarise(events)
          const outside = day.getMonth() !== currentMonth
          const isToday = isSameDay(day, NOW)
          const isWeekend = index % 7 >= 5
          const tone = capacityTone(summary.fill)
          const hasExceptions = summary.soldOut > 0 || summary.weather > 0 || summary.cancelled > 0

          return (
            <div
              key={key}
              className={cn(
                'group/cell relative flex min-h-[5.5rem] flex-col gap-1.5 border-r border-b border-line-subtle p-2 md:min-h-[7.75rem]',
                '[&:nth-child(7n)]:border-r-0',
                'transition-colors duration-200',
                isWeekend && !outside && 'bg-surface-sunken/35',
                outside && 'bg-background-subtle/50',
                isToday && 'bg-info-soft/35',
              )}
            >
              {/* ---- date + the day's headline number ---------------------- */}
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`Open ${formatDateLong(day)}`}
                  className={cn(
                    'inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                    'transition-colors duration-150',
                    isToday
                      ? 'bg-primary text-on-primary shadow-[0_2px_8px_-2px_color-mix(in_oklab,var(--primary)_55%,transparent)]'
                      : outside
                        ? 'text-faint hover:bg-surface-sunken hover:text-muted'
                        : 'text-foreground hover:bg-surface-sunken',
                  )}
                >
                  {day.getDate()}
                </button>

                {summary.live > 0 ? (
                  <span
                    className={cn(
                      'text-[0.8125rem] leading-none font-bold tabular-nums',
                      outside ? 'text-faint' : TONE_TEXT[tone],
                    )}
                  >
                    {summary.fill}
                    <span className="text-[0.625rem] font-semibold opacity-70">%</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onCreate(day)}
                    aria-label={`New departure on ${formatDateLong(day)}`}
                    className={cn(
                      'inline-flex size-5 items-center justify-center rounded-md text-faint',
                      'opacity-0 transition-all duration-150',
                      'hover:bg-primary-soft hover:text-primary',
                      'group-hover/cell:opacity-100 focus-visible:opacity-100',
                    )}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                  </button>
                )}
              </div>

              {summary.live > 0 ? (
                <>
                  {/* ---- how full, at full width ------------------------- */}
                  <span
                    aria-hidden="true"
                    className="block h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_oklab,var(--fg)_7%,transparent)]"
                  >
                    <span
                      className={cn('block h-full rounded-full', TONE_BAR[tone], outside && 'opacity-45')}
                      style={{ width: `${Math.max(3, summary.fill)}%` }}
                    />
                  </span>

                  {/* ---- what is on — opens the full list ---------------- */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          '-mx-1 rounded-md px-1 py-0.5 text-left text-[0.6875rem] leading-tight font-medium tabular-nums',
                          'transition-colors duration-150 hover:bg-surface-sunken',
                          outside ? 'text-faint' : 'text-muted',
                        )}
                      >
                        {summary.live} {summary.live === 1 ? 'run' : 'runs'} ·{' '}
                        {formatNumber(summary.booked)}g
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" padding="none" width="auto" className="w-72">
                      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatDateLong(day)}
                          </p>
                          <p className="text-[0.6875rem] text-subtle tabular-nums">
                            {events.length} departures · {formatNumber(summary.booked)} of{' '}
                            {formatNumber(summary.capacity)} seats
                          </p>
                        </div>
                        <Button size="xs" variant="ghost" onClick={() => onOpenDay(day)}>
                          Open day
                        </Button>
                      </div>
                      <div className="flex max-h-72 flex-col gap-1 overflow-y-auto p-2">
                        {events.map((event) => (
                          <DepartureChip
                            key={event.departure.id}
                            event={event}
                            variant="chip"
                            onSelect={onSelectEvent}
                          />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* ---- the mix, without unreadable text ---------------- */}
                  <div className="flex flex-wrap items-center gap-1">
                    {summary.colours.slice(0, MAX_DOTS).map((colorKey) => (
                      <span
                        key={colorKey}
                        aria-hidden="true"
                        className={cn(
                          'size-1.5 rounded-full',
                          eventVar(colorKey as Parameters<typeof eventVar>[0]),
                          EVENT_SOLID,
                          outside && 'opacity-50',
                        )}
                      />
                    ))}
                    {summary.colours.length > MAX_DOTS ? (
                      <span className="text-[0.5625rem] font-medium text-faint tabular-nums">
                        +{summary.colours.length - MAX_DOTS}
                      </span>
                    ) : null}
                  </div>

                  {/* ---- only what needs attention ---------------------- */}
                  {hasExceptions ? (
                    <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.5625rem] font-semibold tabular-nums">
                      {summary.soldOut > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-accent">
                          <Lock aria-hidden="true" className="size-2.5" />
                          {summary.soldOut} full
                        </span>
                      ) : null}
                      {summary.weather > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-warning">
                          <CloudRain aria-hidden="true" className="size-2.5" />
                          {summary.weather}
                        </span>
                      ) : null}
                      {summary.cancelled > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-faint">
                          <Ban aria-hidden="true" className="size-2.5" />
                          {summary.cancelled}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
