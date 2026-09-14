'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarPlus, ClipboardList, MapPin, Sun } from 'lucide-react'

import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { AvatarGroup, type AvatarGroupItem } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardToolbar } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { CapacityBar } from '@/components/ui/progress'
import {
  cn,
  formatDuration,
  formatNumber,
  formatTime,
  minutesSinceMidnight,
  pluralize,
} from '@/lib/utils'
import type { CalendarEvent } from '@/lib/demo'
import type { Activity } from '@/types'

/* ==========================================================================
   TodaysDepartures — the run sheet.

   A single continuous rail with one dot per departure, tinted by the
   activity's `colorKey`, and a live "now" marker spliced in at the boundary
   between what has sailed and what has not. The marker is placed by comparing
   minutes-since-midnight, so it lands in the right place without depending on
   a fixed-height time axis (which would break on narrow screens).
   ========================================================================== */

interface ColorLook {
  dot: string
  text: string
}

const COLOR: Record<Activity['colorKey'], ColorLook> = {
  lagoon: {
    dot: 'bg-lagoon-500',
    text: 'text-lagoon-700 dark:text-lagoon-300',
  },
  coral: {
    dot: 'bg-coral-500',
    text: 'text-coral-700 dark:text-coral-300',
  },
  sunset: {
    dot: 'bg-sunset-500',
    text: 'text-sunset-700 dark:text-sunset-300',
  },
  reef: {
    dot: 'bg-reef-500',
    text: 'text-reef-700 dark:text-reef-300',
  },
  info: { dot: 'bg-info', text: 'text-info' },
  success: { dot: 'bg-success', text: 'text-success' },
}

export interface StaffLite {
  name: string
  avatarUrl: string
}

export interface TodaysDeparturesProps {
  events: CalendarEvent[]
  /** userId → display fields, for the assigned-crew stack. */
  staff: Record<string, StaffLite>
  /** Local ISO "now", e.g. "2026-09-11T09:00:00". Never `new Date()`. */
  nowIso: string
  className?: string
}

export function TodaysDepartures({ events, staff, nowIso, className }: TodaysDeparturesProps) {
  const nowMinutes = React.useMemo(() => minutesSinceMidnight(new Date(nowIso)), [nowIso])
  const nowLabel = React.useMemo(() => formatTime(new Date(nowIso)), [nowIso])

  const totals = React.useMemo(() => {
    const guests = events.reduce((acc, e) => acc + e.departure.booked, 0)
    const seats = events.reduce((acc, e) => acc + e.departure.capacity, 0)
    const remaining = events.filter(
      (e) => minutesSinceMidnight(new Date(e.departure.startsAt)) >= nowMinutes,
    ).length
    return { guests, seats, remaining }
  }, [events, nowMinutes])

  /** Index of the first departure that has not started yet. */
  const markerIndex = React.useMemo(() => {
    const index = events.findIndex(
      (e) => minutesSinceMidnight(new Date(e.departure.startsAt)) >= nowMinutes,
    )
    return index === -1 ? events.length : index
  }, [events, nowMinutes])

  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CardHeader flush={events.length > 0}>
        <div className="min-w-0">
          <CardTitle>Today&rsquo;s schedule</CardTitle>
          <CardDescription>
            {events.length === 0
              ? 'Nothing on the water today.'
              : `${formatNumber(events.length)} ${pluralize(events.length, 'departure')} · ${formatNumber(
                  totals.guests,
                )} of ${formatNumber(totals.seats)} seats sold · ${formatNumber(
                  totals.remaining,
                )} still to run`}
          </CardDescription>
        </div>
        <CardToolbar>
          <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
            <Link href="/dashboard/calendar">Calendar</Link>
          </Button>
        </CardToolbar>
      </CardHeader>

      {events.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 pb-6">
          <EmptyState
            variant="no-data"
            icon={Sun}
            title="No departures scheduled"
            description="Today is clear. Add a departure or open the calendar to publish availability for the week."
            action={
              <Button asChild size="sm" leftIcon={<CalendarPlus />}>
                <Link href="/dashboard/availability">Add a departure</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <StaggerGroup
          as="ol"
          stagger={0.045}
          className="min-h-0 flex-1 overflow-y-auto pt-2 pb-3 no-scrollbar"
        >
          {events.map((event, index) => {
            const { departure, activity, seatsLeft } = event
            const look = COLOR[activity.colorKey]
            const crew: AvatarGroupItem[] = departure.assignedStaffIds.flatMap((id) => {
              const person = staff[id]
              return person ? [{ id, name: person.name, src: person.avatarUrl }] : []
            })

            return (
              <React.Fragment key={departure.id}>
                {index === markerIndex ? <NowMarker label={nowLabel} /> : null}

                <StaggerItem as="li" distance={12} className="flex gap-3 px-5 sm:gap-4">
                  {/* time column */}
                  <div className="w-14 shrink-0 py-3 text-right">
                    <p className="font-display text-[0.8125rem] leading-tight font-semibold text-foreground tabular-nums">
                      {formatTime(departure.startsAt)}
                    </p>
                    <p className="mt-0.5 text-[0.6875rem] text-faint tabular-nums">
                      {formatDuration(activity.durationMinutes)}
                    </p>
                  </div>

                  {/* rail */}
                  <div className="relative flex w-2.5 shrink-0 justify-center">
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 w-px bg-line-subtle"
                    />
                    <span
                      aria-hidden="true"
                      className={cn(
                        'relative mt-4 size-2.5 rounded-full ring-4 ring-surface',
                        look.dot,
                      )}
                    />
                  </div>

                  {/* body */}
                  <div className="min-w-0 flex-1 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <p
                        className={cn(
                          'min-w-0 truncate text-[0.8125rem] font-semibold',
                          look.text,
                        )}
                      >
                        {activity.name}
                      </p>
                      <StatusBadge
                        kind="departure"
                        status={departure.status}
                        size="sm"
                        className="shrink-0"
                      />
                    </div>

                    <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] text-subtle">
                      <MapPin aria-hidden="true" className="size-3 shrink-0" />
                      <span className="truncate">{activity.meetingPoint}</span>
                    </p>

                    <div className="mt-2.5 flex items-center gap-3">
                      <CapacityBar
                        booked={departure.booked}
                        capacity={departure.capacity}
                        held={departure.held}
                        size="sm"
                        showLabel={false}
                        className="min-w-0 flex-1"
                      />
                      <span className="shrink-0 text-[0.6875rem] font-semibold text-muted tabular-nums">
                        {departure.booked}/{departure.capacity} booked
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {crew.length > 0 ? (
                          <AvatarGroup
                            avatars={crew}
                            max={3}
                            size="xs"
                            ringClassName="ring-surface"
                            label={`Crew on ${activity.name}`}
                          />
                        ) : (
                          <span className="text-[0.6875rem] text-faint">Unassigned</span>
                        )}
                        <span className="truncate text-[0.6875rem] text-faint">
                          {seatsLeft === 0
                            ? 'Sold out'
                            : `${seatsLeft} ${pluralize(seatsLeft, 'seat')} left`}
                        </span>
                      </div>

                      <Link
                        href={`/dashboard/manifest?departure=${departure.id}`}
                        className={cn(
                          'group inline-flex shrink-0 items-center gap-1 rounded-md text-[0.6875rem] font-semibold text-primary',
                          'transition-colors duration-200 hover:text-primary-hover',
                          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                        )}
                      >
                        <ClipboardList aria-hidden="true" className="size-3" />
                        View manifest
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
                        />
                      </Link>
                    </div>
                  </div>
                </StaggerItem>
              </React.Fragment>
            )
          })}

          {markerIndex === events.length ? <NowMarker label={nowLabel} trailing /> : null}
        </StaggerGroup>
      )}
    </Card>
  )
}

/* --------------------------------------------------------------------------
   The live "now" line.
   -------------------------------------------------------------------------- */

function NowMarker({ label, trailing = false }: { label: string; trailing?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-5 sm:gap-4" aria-label={`Current time ${label}`}>
      <div className="w-14 shrink-0 py-1.5 text-right">
        <span className="font-display text-[0.6875rem] font-bold tracking-[0.06em] text-accent uppercase tabular-nums">
          {label}
        </span>
      </div>

      <div className="relative flex w-2.5 shrink-0 justify-center self-stretch">
        <span
          aria-hidden="true"
          className={cn('absolute w-px bg-line-subtle', trailing ? 'top-0 h-1/2' : 'inset-y-0')}
        />
        <span
          aria-hidden="true"
          className="relative my-auto size-2.5 rounded-full bg-accent ring-4 ring-surface motion-safe:animate-pulse-ring"
        />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 py-1.5">
        <span className="h-px flex-1 bg-[linear-gradient(to_right,var(--accent),transparent)] opacity-60" />
        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.08em] text-accent uppercase">
          Now
        </span>
      </div>
    </li>
  )
}
