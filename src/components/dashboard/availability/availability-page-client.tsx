'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  CalendarClock,
  CalendarDays,
  Layers,
  Plus,
  Repeat,
  Save,
  Ship,
  Users,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { AvailabilityEditor } from '@/components/dashboard/availability/availability-editor'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { CapacityBar } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import {
  addDays,
  cn,
  formatDateShort,
  formatNumber,
  formatTime,
  pluralize,
  toDateKey,
} from '@/lib/utils'
import type { CalendarEvent } from '@/lib/demo'
import type { Activity, Tenant } from '@/types'
import type { DerivedTemplate, ObservedHours } from '@/components/dashboard/availability/derive'

/* ==========================================================================
   SCHEDULE TEMPLATES — reverse-engineered from the departures we actually
   generated, so the timetable on screen matches the calendar exactly.
   ========================================================================== */

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const COLOR_DOT: Record<Activity['colorKey'], string> = {
  lagoon: 'bg-chart-1',
  coral: 'bg-chart-2',
  reef: 'bg-chart-3',
  sunset: 'bg-chart-4',
  info: 'bg-chart-5',
  success: 'bg-chart-6',
}


function recurrenceLabel(weekdays: number[]) {
  if (weekdays.length >= 7) return 'Every day'
  if (weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => weekdays.includes(d))) {
    return 'Weekdays'
  }
  if (weekdays.length === 2 && weekdays.includes(0) && weekdays.includes(6)) return 'Weekends'
  // Reorder Sunday to the end so the chip reads Mon → Sun.
  const ordered = [...weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  return ordered.map((d) => WEEKDAY_SHORT[d]).join(', ')
}

/* ==========================================================================
   FORTNIGHT PREVIEW
   ========================================================================== */

function derivePreviewTotals(previewDays: Date[], previewByDay: Record<string, CalendarEvent[]>) {
  return previewDays.reduce(
    (acc, day) => {
      const events = previewByDay[toDateKey(day)] ?? []
      for (const event of events) {
        acc.departures += 1
        acc.seats += event.departure.capacity
        acc.booked += event.departure.booked
      }
      return acc
    },
    { departures: 0, seats: 0, booked: 0 },
  )
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export interface AvailabilityPageClientProps {
  tenant: Tenant
  now: Date
  templates: DerivedTemplate[]
  previewByDay: Record<string, CalendarEvent[]>
  observedHours: ObservedHours
}

/**
 * All derived data (`templates`, the fortnight preview) is computed
 * server-side — this file never imports `@/lib/demo` itself.
 */
export function AvailabilityPageClient({
  tenant: CURRENT_TENANT,
  now: NOW,
  templates: TEMPLATES,
  previewByDay: PREVIEW_BY_DAY,
  observedHours,
}: AvailabilityPageClientProps) {
  const PREVIEW_DAYS = React.useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(NOW, i)), [NOW])
  const PREVIEW_TOTALS = React.useMemo(
    () => derivePreviewTotals(PREVIEW_DAYS, PREVIEW_BY_DAY),
    [PREVIEW_DAYS, PREVIEW_BY_DAY],
  )
  const [paused, setPaused] = React.useState<Set<string>>(new Set())

  function toggleTemplate(template: DerivedTemplate) {
    setPaused((prev) => {
      const next = new Set(prev)
      if (next.has(template.activity.id)) {
        next.delete(template.activity.id)
        toast.success(`${template.activity.name} resumed`, {
          description: 'Future departures will generate again from tomorrow.',
        })
      } else {
        next.add(template.activity.id)
        toast(`${template.activity.name} paused`, {
          description: 'No new departures will be generated. Existing ones still run.',
        })
      }
      return next
    })
  }

  const fillRate =
    PREVIEW_TOTALS.seats === 0
      ? 0
      : Math.round((PREVIEW_TOTALS.booked / PREVIEW_TOTALS.seats) * 100)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        className="mb-0"
        title="Availability"
        description="Operating hours, blackout dates and the schedule templates that generate every departure on your calendar."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/calendar">Open calendar</Link>
            </Button>
            <Button
              size="sm"
              leftIcon={<Save />}
              onClick={() =>
                toast.success('Availability published', {
                  description: 'Departures for the next 12 months have been regenerated.',
                })
              }
            >
              Publish changes
            </Button>
          </div>
        }
      />

      {/* ---------------- Summary ---------------- */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryTile
          icon={<CalendarClock className="size-4" />}
          value={formatNumber(PREVIEW_TOTALS.departures)}
          label="Departures, next 14 days"
        />
        <SummaryTile
          icon={<Users className="size-4" />}
          value={formatNumber(PREVIEW_TOTALS.seats)}
          label="Seats opened"
        />
        <SummaryTile
          icon={<Layers className="size-4" />}
          value={`${fillRate}%`}
          label="Already sold"
        />
        <SummaryTile
          icon={<Repeat className="size-4" />}
          value={formatNumber(TEMPLATES.length)}
          label="Active templates"
        />
      </div>

      {/* ---------------- Operating rules ---------------- */}
      <AvailabilityEditor observedHours={observedHours} />

      {/* ---------------- Schedule templates ---------------- */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Repeat className="size-4 text-primary" aria-hidden="true" />
              Schedule templates
            </CardTitle>
            <CardDescription>
              One template per activity. Each generates departures inside the operating hours
              above, skipping blackout dates.
            </CardDescription>
          </div>
          <CardToolbar>
            <Button variant="outline" size="sm" leftIcon={<Plus />}>
              New template
            </Button>
          </CardToolbar>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 pt-0">
          {TEMPLATES.map((template) => {
            const isPaused = paused.has(template.activity.id)
            const switchId = `template-${template.activity.id}`
            return (
              <div
                key={template.activity.id}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border p-4 lg:flex-row lg:items-center',
                  'transition-colors duration-200',
                  isPaused ? 'border-line-subtle bg-surface-sunken/60' : 'border-line bg-surface',
                )}
              >
                {/* Identity */}
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1 size-2.5 shrink-0 rounded-full',
                      COLOR_DOT[template.activity.colorKey],
                      isPaused && 'opacity-40',
                    )}
                  />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                      <span className="truncate">{template.activity.name}</span>
                      <StatusBadge
                        kind="activity"
                        status={template.activity.status}
                        size="sm"
                        showIcon={false}
                      />
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="size-3.5" aria-hidden="true" />
                        {recurrenceLabel(template.weekdays)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Ship className="size-3.5" aria-hidden="true" />
                        {template.capacity} {pluralize(template.capacity, 'seat')} per departure
                      </span>
                      <span className="tabular">
                        {formatNumber(template.departures)} generated in the 16-week window
                      </span>
                    </p>
                  </div>
                </div>

                {/* Start times */}
                <div className="flex min-w-0 flex-wrap items-center gap-1 lg:max-w-80 lg:justify-end">
                  {template.startTimes.slice(0, 6).map((time) => (
                    <Badge
                      key={time}
                      variant={isPaused ? 'outline' : 'neutral'}
                      size="sm"
                      className="tabular"
                    >
                      {formatTime(`2026-01-01T${time}:00`)}
                    </Badge>
                  ))}
                  {template.startTimes.length > 6 ? (
                    <Badge variant="outline" size="sm">
                      +{template.startTimes.length - 6}
                    </Badge>
                  ) : null}
                </div>

                {/* Toggle */}
                <div className="flex shrink-0 items-center gap-2 lg:w-28 lg:justify-end">
                  <label htmlFor={switchId} className="text-xs text-muted lg:sr-only">
                    {isPaused ? 'Paused' : 'Generating'}
                  </label>
                  <Switch
                    id={switchId}
                    size="sm"
                    checked={!isPaused}
                    onCheckedChange={() => toggleTemplate(template)}
                    aria-label={`${isPaused ? 'Resume' : 'Pause'} ${template.activity.name} schedule`}
                  />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ---------------- Fortnight preview ---------------- */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden="true" />
              Generated departures — next fortnight
            </CardTitle>
            <CardDescription>
              Exactly what these rules produce, day by day. Blackout dates would appear here as
              closed columns.
            </CardDescription>
          </div>
          <CardToolbar>
            <Badge variant="primary" size="sm">
              {formatNumber(PREVIEW_TOTALS.departures)} departures
            </Badge>
          </CardToolbar>
        </CardHeader>

        <CardContent bleed className="pt-0">
          <div className="no-scrollbar overflow-x-auto px-5 pb-1 sm:px-6">
            <ul className="flex w-max gap-2.5">
              {PREVIEW_DAYS.map((day) => {
                const key = toDateKey(day)
                const events = PREVIEW_BY_DAY[key] ?? []
                const booked = events.reduce((s, e) => s + e.departure.booked, 0)
                const capacity = events.reduce((s, e) => s + e.departure.capacity, 0)
                const isToday = key === toDateKey(NOW)
                const isWeekend = day.getDay() === 0 || day.getDay() === 6

                return (
                  <li
                    key={key}
                    className={cn(
                      'flex w-44 shrink-0 flex-col gap-3 rounded-xl border p-3',
                      'transition-all duration-300 ease-[var(--ease-out-expo)]',
                      isToday
                        ? 'border-primary/50 bg-primary-soft/25 shadow-sm'
                        : 'border-line bg-surface hover:border-line-strong hover:shadow-md',
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <p
                          className={cn(
                            'text-xs font-semibold tracking-[0.08em] uppercase',
                            isWeekend ? 'text-accent' : 'text-subtle',
                          )}
                        >
                          {WEEKDAY_SHORT[day.getDay()]}
                        </p>
                        <p className="font-display text-sm font-semibold text-foreground">
                          {formatDateShort(day)}
                        </p>
                      </div>
                      {isToday ? (
                        <Badge variant="primary" size="sm">
                          Today
                        </Badge>
                      ) : null}
                    </div>

                    {events.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-line-strong px-2 py-3 text-center text-xs text-faint">
                        No departures
                      </p>
                    ) : (
                      <>
                        <CapacityBar
                          booked={booked}
                          capacity={capacity}
                          size="sm"
                          showLabel={false}
                        />
                        <p className="text-xs text-muted tabular">
                          {events.length} {pluralize(events.length, 'departure')} ·{' '}
                          {formatNumber(booked)}/{formatNumber(capacity)} seats
                        </p>

                        <ul className="flex flex-col gap-1">
                          {events.slice(0, 3).map((event) => (
                            <li
                              key={event.departure.id}
                              className="flex items-center gap-1.5 text-xs"
                            >
                              <span
                                aria-hidden="true"
                                className={cn(
                                  'size-1.5 shrink-0 rounded-full',
                                  COLOR_DOT[event.activity.colorKey],
                                )}
                              />
                              <span className="shrink-0 font-medium text-foreground tabular">
                                {formatTime(event.departure.startsAt)}
                              </span>
                              <span className="truncate text-subtle">{event.activity.name}</span>
                            </li>
                          ))}
                          {events.length > 3 ? (
                            <li className="text-xs text-faint">
                              +{events.length - 3} more
                            </li>
                          ) : null}
                        </ul>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================== */

function SummaryTile({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: string
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4">
      <span
        aria-hidden="true"
        className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-display text-xl font-semibold tracking-tight text-foreground tabular">
          {value}
        </p>
        <p className="truncate text-xs text-muted">{label}</p>
      </div>
    </div>
  )
}
