'use client'

/**
 * MonthView — the 6x7 planning grid.
 *
 * Density strategy: three chips per cell is the most a 120px cell can carry
 * legibly, so the overflow collapses into a "+N more" popover rather than
 * shrinking type. Below `md` the chips are replaced by colour dots, which keeps
 * the month scannable on a phone instead of unreadable.
 */

import * as React from 'react'
import { Plus } from 'lucide-react'

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
const MAX_CHIPS = 3

const TONE_BAR: Record<'success' | 'warning' | 'danger', string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
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
}

function summarise(events: CalendarEvent[]): DaySummary {
  let booked = 0
  let capacity = 0
  let live = 0
  for (const { departure } of events) {
    if (departure.status === 'cancelled') continue
    live += 1
    booked += departure.booked
    capacity += departure.capacity
  }
  return {
    booked,
    capacity,
    live,
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
          const visible = events.slice(0, MAX_CHIPS)
          const overflow = events.length - visible.length
          const tone = capacityTone(summary.fill)

          return (
            <div
              key={key}
              className={cn(
                'group/cell relative flex min-h-[5.5rem] flex-col gap-1 border-r border-b border-line-subtle p-1.5 md:min-h-[7.75rem]',
                '[&:nth-child(7n)]:border-r-0',
                'transition-colors duration-200',
                isWeekend && !outside && 'bg-surface-sunken/35',
                outside && 'bg-background-subtle/50',
                isToday && 'bg-primary-soft/30',
              )}
            >
              {/* Day number + create affordance */}
              <div className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`Open ${formatDateLong(day)}`}
                  className={cn(
                    'tabular inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold',
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

                <div className="flex items-center gap-1">
                  {summary.live > 0 ? (
                    <span
                      className={cn(
                        'tabular hidden text-[0.625rem] font-medium text-faint sm:inline',
                        'transition-opacity duration-150 group-hover/cell:opacity-0',
                      )}
                    >
                      {summary.fill}%
                    </span>
                  ) : null}
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
                </div>
              </div>

              {/* Chips — md and up */}
              <div className="hidden min-h-0 flex-col gap-1 md:flex">
                {visible.map((event) => (
                  <DepartureChip
                    key={event.departure.id}
                    event={event}
                    variant="chip"
                    onSelect={onSelectEvent}
                    hideSeats
                  />
                ))}

                {overflow > 0 ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-left text-[0.6875rem] font-semibold text-muted',
                          'transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground',
                        )}
                      >
                        +{overflow} more
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" padding="none" width="auto" className="w-72">
                      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {formatDateLong(day)}
                          </p>
                          <p className="text-[0.6875rem] text-subtle">
                            {events.length} departures · {formatNumber(summary.booked)} guests
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
                ) : null}
              </div>

              {/* Dots — below md */}
              {events.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onOpenDay(day)}
                  aria-label={`${events.length} departures on ${formatDateLong(day)}`}
                  className="mt-auto flex flex-wrap items-center gap-1 rounded-md py-1 md:hidden"
                >
                  {events.slice(0, 4).map((event) => (
                    <span
                      key={event.departure.id}
                      aria-hidden="true"
                      className={cn(
                        'size-1.5 rounded-full',
                        eventVar(event.activity.colorKey),
                        event.departure.status === 'cancelled' ? 'bg-line-strong' : EVENT_SOLID,
                      )}
                    />
                  ))}
                  {events.length > 4 ? (
                    <span className="tabular text-[0.625rem] font-medium text-faint">
                      +{events.length - 4}
                    </span>
                  ) : null}
                </button>
              ) : null}

              {/* Aggregate fill bar */}
              {summary.live > 0 ? (
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-[3px] bg-[color:color-mix(in_oklab,var(--fg)_5%,transparent)]"
                >
                  <div
                    className={cn('h-full rounded-r-full opacity-70', TONE_BAR[tone])}
                    style={{ width: `${summary.fill}%` }}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
