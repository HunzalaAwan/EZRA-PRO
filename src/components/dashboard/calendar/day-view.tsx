'use client'

/**
 * DayView — one day at operational resolution: a wide time grid on the left and
 * a standing brief on the right. This is the screen a dock manager keeps open.
 */

import * as React from 'react'
import { Anchor, CalendarClock, CloudRain, TriangleAlert, Users, Wallet } from 'lucide-react'

import { cn, formatCurrency, formatNumber, formatTime, isSameDay, fillRate } from '@/lib/utils'
import { NOW, getUsersByTenant } from '@/lib/demo-core'
import type { CalendarEvent } from '@/lib/demo'
import type { CurrencyCode } from '@/types'
import { Avatar } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { EmptyState } from '@/components/ui/empty-state'
import { Button } from '@/components/ui/button'
import { RadialGauge } from '@/components/charts/radial-gauge'
import {
  EventLayer,
  HOUR_HEIGHT,
  HourLines,
  NowLine,
  TimeAxis,
  gridBounds,
} from '@/components/dashboard/calendar/week-view'

export interface DayViewProps {
  day: Date
  events: CalendarEvent[]
  tenantId: string
  currency: CurrencyCode
  onSelectEvent: (departureId: string) => void
  onCreate: (date: Date) => void
}

function RailStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-line-subtle bg-surface-sunken/50 px-3 py-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface text-subtle shadow-xs">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-medium tracking-wide text-faint uppercase">{label}</p>
        <p className="tabular font-display text-lg leading-tight font-semibold text-foreground">
          {value}
        </p>
        {hint ? <p className="truncate text-[0.6875rem] text-subtle">{hint}</p> : null}
      </div>
    </div>
  )
}

export function DayView({
  day,
  events,
  tenantId,
  currency,
  onSelectEvent,
  onCreate,
}: DayViewProps) {
  const { startHour, endHour } = React.useMemo(() => gridBounds(events), [events])
  const totalHeight = (endHour - startHour) * HOUR_HEIGHT
  const isToday = isSameDay(day, NOW)

  const summary = React.useMemo(() => {
    let booked = 0
    let capacity = 0
    let revenue = 0
    let cancelled = 0
    let holds = 0
    let soldOut = 0
    const staffIds = new Set<string>()

    for (const event of events) {
      const { departure } = event
      if (departure.status === 'cancelled') {
        cancelled += 1
        continue
      }
      if (departure.status === 'weather_hold') holds += 1
      if (departure.status === 'sold_out' || departure.booked >= departure.capacity) soldOut += 1
      booked += departure.booked
      capacity += departure.capacity
      revenue += event.revenue
      for (const id of departure.assignedStaffIds) staffIds.add(id)
    }

    return {
      booked,
      capacity,
      revenue,
      cancelled,
      holds,
      soldOut,
      staffIds,
      running: events.length - cancelled,
      utilisation: fillRate(booked, capacity),
    }
  }, [events])

  const crew = React.useMemo(
    () => getUsersByTenant(tenantId).filter((user) => summary.staffIds.has(user.id)),
    [tenantId, summary.staffIds],
  )

  const attention = React.useMemo(
    () =>
      events.filter(
        ({ departure }) =>
          departure.status === 'weather_hold' ||
          departure.status === 'cancelled' ||
          departure.booked === 0,
      ),
    [events],
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_21rem]">
      {/* ------------------------------------------------------------ grid -- */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        {events.length === 0 ? (
          <EmptyState
            variant="no-data"
            icon={CalendarClock}
            title="Nothing on the water today"
            description="No departures are scheduled for this day. Schedule one and it will appear on every view instantly."
            action={
              <Button size="sm" onClick={() => onCreate(day)}>
                Add availability
              </Button>
            }
            className="py-16"
          />
        ) : (
          <div className="max-h-[calc(100dvh-17rem)] min-h-[30rem] overflow-auto">
            <div className="grid grid-cols-[3.5rem_minmax(0,1fr)] pt-3 pb-6">
              <TimeAxis startHour={startHour} endHour={endHour} showNow={isToday} />
              <div className="relative" style={{ height: totalHeight }}>
                <HourLines
                  startHour={startHour}
                  endHour={endHour}
                  day={day}
                  onCreate={onCreate}
                />
                <EventLayer
                  events={events}
                  startHour={startHour}
                  endHour={endHour}
                  onSelectEvent={onSelectEvent}
                  gutter={4}
                />
                {isToday ? <NowLine startHour={startHour} /> : null}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------ rail -- */}
      <aside className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-foreground">Day summary</h3>
            {isToday ? (
              <Badge size="sm" variant="primary" dot>
                Live
              </Badge>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-1 pb-2">
            <RadialGauge
              value={summary.utilisation}
              size={148}
              label="Capacity sold"
              sublabel={`${formatNumber(summary.booked)} of ${formatNumber(summary.capacity)} seats`}
              ariaLabel={`Capacity utilisation ${Math.round(summary.utilisation)} percent`}
            />
          </div>

          <div className="mt-2 grid gap-2">
            <RailStat
              icon={CalendarClock}
              label="Departures"
              value={formatNumber(summary.running)}
              hint={
                summary.cancelled > 0
                  ? `${summary.cancelled} cancelled · ${summary.soldOut} sold out`
                  : `${summary.soldOut} sold out`
              }
            />
            <RailStat
              icon={Users}
              label="Guests"
              value={formatNumber(summary.booked)}
              hint={`${formatNumber(Math.max(summary.capacity - summary.booked, 0))} seats still sellable`}
            />
            <RailStat
              icon={Wallet}
              label="Booked value"
              value={formatCurrency(summary.revenue, currency)}
              hint={
                summary.booked > 0
                  ? `${formatCurrency(Math.round(summary.revenue / summary.booked), currency)} per guest`
                  : 'No guests booked'
              }
            />
          </div>
        </div>

        {/* Crew */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-foreground">On duty</h3>
            <Badge size="sm" variant="neutral">
              {crew.length}
            </Badge>
          </div>

          {crew.length === 0 ? (
            <p className="text-[0.8125rem] text-subtle">No crew assigned for this day yet.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {crew.map((user) => (
                <li key={user.id} className="flex items-center gap-2.5">
                  <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium text-foreground">
                      {user.name}
                    </p>
                    <p className="truncate text-[0.6875rem] text-subtle">{user.title}</p>
                  </div>
                  {user.certifications && user.certifications.length > 0 ? (
                    <Badge size="sm" variant="outline" className="shrink-0">
                      {user.certifications.length} certs
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Needs attention */}
        {attention.length > 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <TriangleAlert aria-hidden="true" className="size-4 text-warning" />
              <h3 className="font-display text-sm font-semibold text-foreground">
                Needs attention
              </h3>
            </div>
            <ul className="flex flex-col">
              {attention.map(({ departure, activity }, index) => (
                <li key={departure.id}>
                  {index > 0 ? <Separator className="my-2" /> : null}
                  <button
                    type="button"
                    onClick={() => onSelectEvent(departure.id)}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left',
                      'transition-colors duration-150 hover:bg-surface-sunken',
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-subtle">
                      {departure.status === 'weather_hold' ? (
                        <CloudRain aria-hidden="true" className="size-3.5" />
                      ) : (
                        <Anchor aria-hidden="true" className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-1.5">
                        <span className="tabular text-[0.6875rem] font-semibold text-muted">
                          {formatTime(departure.startsAt)}
                        </span>
                        <span className="truncate text-[0.8125rem] font-medium text-foreground">
                          {activity.name}
                        </span>
                      </span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <StatusBadge kind="departure" status={departure.status} size="sm" />
                        {departure.booked === 0 && departure.status !== 'cancelled' ? (
                          <span className="text-[0.6875rem] text-subtle">no bookings</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </aside>
    </div>
  )
}
