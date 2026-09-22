'use client'

/**
 * AgendaView — a fortnight of departures as a scannable run-list.
 *
 * Sticky date headers let an operator thumb through two weeks without losing
 * their place, and every row carries the four numbers that decide the day:
 * time, seats, crew and money.
 */

import * as React from 'react'
import { CalendarRange, MapPin, Plus } from 'lucide-react'

import {
  cn,
  addDays,
  toDateKey,
  formatCurrency,
  formatDuration,
  formatNumber,
  formatTime,
  isSameDay,
} from '@/lib/utils'
import { NOW, getUsersByTenant } from '@/lib/demo-core'
import type { CalendarEvent } from '@/lib/demo'
import type { CurrencyCode } from '@/types'
import { AvatarGroup } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CapacityBar } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { EVENT_SOLID, eventVar } from '@/components/dashboard/calendar/departure-chip'

export interface AgendaViewProps {
  from: Date
  days: number
  events: CalendarEvent[]
  tenantId: string
  currency: CurrencyCode
  onSelectEvent: (departureId: string) => void
  onCreate: (date: Date) => void
}

interface AgendaGroup {
  key: string
  date: Date
  events: CalendarEvent[]
  guests: number
  revenue: number
}

export function AgendaView({
  from,
  days,
  events,
  tenantId,
  currency,
  onSelectEvent,
  onCreate,
}: AgendaViewProps) {
  const staffById = React.useMemo(() => {
    const map = new Map<string, { name: string; src: string }>()
    for (const user of getUsersByTenant(tenantId)) {
      map.set(user.id, { name: user.name, src: user.avatarUrl })
    }
    return map
  }, [tenantId])

  const groups = React.useMemo<AgendaGroup[]>(() => {
    const buckets = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = event.departure.startsAt.slice(0, 10)
      const bucket = buckets.get(key)
      if (bucket) bucket.push(event)
      else buckets.set(key, [event])
    }

    const result: AgendaGroup[] = []
    for (let i = 0; i < days; i += 1) {
      const date = addDays(from, i)
      const key = toDateKey(date)
      const dayEvents = buckets.get(key)
      if (!dayEvents || dayEvents.length === 0) continue

      let guests = 0
      let revenue = 0
      for (const event of dayEvents) {
        const { departure } = event
        if (departure.status === 'cancelled') continue
        guests += departure.booked
        revenue += event.revenue
      }
      result.push({ key, date, events: dayEvents, guests, revenue })
    }
    return result
  }, [events, from, days])

  if (groups.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <EmptyState
          variant="no-results"
          icon={CalendarRange}
          title="No departures in this window"
          description="Nothing matches the current filters over the next two weeks. Widen the filters or schedule something new."
          action={
            <Button size="sm" onClick={() => onCreate(from)}>
              Add availability
            </Button>
          }
          className="py-16"
        />
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div className="max-h-[calc(100dvh-17rem)] min-h-[30rem] overflow-y-auto">
        {groups.map((group) => {
          const today = isSameDay(group.date, NOW)

          return (
            <section key={group.key} className="border-t border-line-subtle first:border-t-0">
              {/* Sticky date header */}
              <header
                className={cn(
                  'sticky top-0 z-10 flex items-center gap-3 border-b border-line-subtle px-4 py-2',
                  'bg-surface-sunken/85 backdrop-blur-md',
                )}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      'tabular font-display text-base font-semibold',
                      today ? 'text-info' : 'text-foreground',
                    )}
                  >
                    {new Intl.DateTimeFormat('en-US', {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    }).format(group.date)}
                  </span>
                  {today ? (
                    <Badge size="sm" variant="primary">
                      Today
                    </Badge>
                  ) : null}
                </div>

                <span className="tabular ml-auto flex items-center gap-3 text-xs text-subtle">
                  <span>
                    {group.events.length} {group.events.length === 1 ? 'run' : 'runs'}
                  </span>
                  <span className="hidden sm:inline">{formatNumber(group.guests)} guests</span>
                  <span className="font-semibold text-muted">
                    {formatCurrency(group.revenue, currency, { compact: true })}
                  </span>
                </span>

                <IconButton
                  aria-label={`Add availability on ${toDateKey(group.date)}`}
                  size="xs"
                  variant="ghost"
                  onClick={() => onCreate(group.date)}
                >
                  <Plus aria-hidden="true" />
                </IconButton>
              </header>

              <ul>
                {group.events.map(({ departure, activity, seatsLeft, revenue }) => {
                  const cancelled = departure.status === 'cancelled'
                  const crew = departure.assignedStaffIds
                    .map((id) => staffById.get(id))
                    .filter((person): person is { name: string; src: string } => Boolean(person))

                  return (
                    <li key={departure.id} className="border-b border-line-subtle last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onSelectEvent(departure.id)}
                        className={cn(
                          'grid w-full grid-cols-1 items-start gap-x-4 gap-y-2 px-4 py-3 text-left',
                          'transition-colors duration-150 hover:bg-surface-sunken/60',
                          'focus-visible:bg-surface-sunken/60',
                          'sm:grid-cols-[5rem_minmax(0,1fr)_11rem_9.5rem] sm:items-center',
                        )}
                      >
                        {/* Time */}
                        <div className="flex items-baseline gap-2 sm:block">
                          <p
                            className={cn(
                              'tabular text-sm font-semibold',
                              cancelled ? 'text-faint line-through' : 'text-foreground',
                            )}
                          >
                            {formatTime(departure.startsAt)}
                          </p>
                          <p className="tabular text-xs text-faint">
                            {formatDuration(activity.durationMinutes)}
                          </p>
                        </div>

                        {/* Activity */}
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span
                            aria-hidden="true"
                            className={cn(
                              'mt-1 h-8 w-[3px] shrink-0 rounded-full',
                              eventVar(activity.colorKey),
                              cancelled ? 'bg-line-strong' : EVENT_SOLID,
                            )}
                          />
                          <div className="min-w-0">
                            <p
                              className={cn(
                                'truncate text-[0.875rem] font-semibold tracking-[-0.01em]',
                                cancelled ? 'text-faint line-through' : 'text-foreground',
                              )}
                            >
                              {activity.name}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-subtle">
                              <MapPin aria-hidden="true" className="size-3 shrink-0" />
                              <span className="truncate">{activity.meetingPoint}</span>
                            </p>
                          </div>
                        </div>

                        {/* Seats */}
                        <div className="min-w-0">
                          <CapacityBar
                            booked={departure.booked}
                            capacity={departure.capacity}
                            held={departure.held}
                            size="sm"
                            showLabel={false}
                          />
                          <p className="tabular mt-1 text-xs text-subtle">
                            <span className="font-semibold text-muted">
                              {departure.booked}/{departure.capacity}
                            </span>{' '}
                            seats · {seatsLeft === 0 ? 'sold out' : `${seatsLeft} left`}
                          </p>
                        </div>

                        {/* Crew + status + money */}
                        <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                          <div className="flex items-center gap-2">
                            {crew.length > 0 ? (
                              <AvatarGroup
                                avatars={crew}
                                max={3}
                                size="xs"
                                ringClassName="ring-surface"
                                label="Crew assigned"
                              />
                            ) : null}
                            <StatusBadge
                              kind="departure"
                              status={departure.status}
                              size="sm"
                              showIcon={false}
                            />
                          </div>
                          <p
                            className={cn(
                              'tabular text-sm font-semibold',
                              cancelled ? 'text-faint' : 'text-foreground',
                            )}
                          >
                            {formatCurrency(revenue, currency)}
                          </p>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
