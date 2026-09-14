'use client'

/**
 * CalendarShell — the only stateful piece of the calendar.
 *
 * It owns the cursor date, the active view and the filter set, derives the
 * visible range from those three, and hands each view a pre-filtered event
 * list. Views stay pure and cheap to reason about; navigation, shortcuts and
 * the create/detail surfaces all live here.
 */

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
} from 'lucide-react'

import {
  cn,
  addDays,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateKey,
  isSameDay,
  formatCurrency,
  formatNumber,
  fillRate,
} from '@/lib/utils'
import { CURRENT_TENANT, NOW } from '@/lib/demo-core'
import type { CalendarEvent } from '@/lib/demo'
import { fetchCalendarEvents } from '@/lib/actions/dashboard'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { Kbd } from '@/components/ui/kbd'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import {
  ActiveFilterPills,
  CalendarFilters,
  DEFAULT_CALENDAR_FILTERS,
  filterEvents,
  type CalendarFilterState,
} from '@/components/dashboard/calendar/calendar-filters'
import { MonthView } from '@/components/dashboard/calendar/month-view'
import { WeekView } from '@/components/dashboard/calendar/week-view'
import { DayView } from '@/components/dashboard/calendar/day-view'
import { AgendaView } from '@/components/dashboard/calendar/agenda-view'
import { DepartureDetailSheet } from '@/components/dashboard/calendar/departure-detail-sheet'
import { NewDepartureDialog } from '@/components/dashboard/calendar/new-departure-dialog'

type ViewKey = 'month' | 'week' | 'day' | 'agenda'

const AGENDA_DAYS = 14
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

const VIEW_OPTIONS: SegmentedOption<ViewKey>[] = [
  { value: 'month', label: 'Month', icon: CalendarDays },
  { value: 'week', label: 'Week', icon: CalendarRange },
  { value: 'day', label: 'Day', icon: CalendarClock },
  { value: 'agenda', label: 'Agenda', icon: List },
]

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
const DAY_FULL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
})

function rangeFor(view: ViewKey, cursor: Date): { from: Date; to: Date } {
  if (view === 'month') {
    const from = startOfWeek(startOfMonth(cursor))
    return { from, to: addDays(from, 41) }
  }
  if (view === 'week') {
    const from = startOfWeek(cursor)
    return { from, to: addDays(from, 6) }
  }
  if (view === 'day') {
    const from = startOfDay(cursor)
    return { from, to: from }
  }
  const from = startOfDay(cursor)
  return { from, to: addDays(from, AGENDA_DAYS - 1) }
}

function labelFor(view: ViewKey, cursor: Date, range: { from: Date; to: Date }): string {
  if (view === 'month') return MONTH_YEAR.format(cursor)
  if (view === 'day') return DAY_FULL.format(cursor)
  const { from, to } = range
  const sameYear = from.getFullYear() === to.getFullYear()
  return `${MONTH_DAY.format(from)} – ${MONTH_DAY.format(to)}${sameYear ? `, ${to.getFullYear()}` : ''}`
}

function shift(view: ViewKey, cursor: Date, direction: 1 | -1): Date {
  if (view === 'month') {
    return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1)
  }
  if (view === 'week') return addDays(cursor, 7 * direction)
  if (view === 'day') return addDays(cursor, direction)
  return addDays(cursor, AGENDA_DAYS * direction)
}

export interface CalendarShellProps {
  tenantId?: string
  /**
   * Events for a window around today, computed on the server. Navigating
   * outside it loads a wider window through a Server Action; the dataset
   * module itself is never imported here.
   */
  initialWindow: { from: Date; to: Date }
  initialEvents: CalendarEvent[]
  className?: string
}

/** How far past the visible range each fetched window extends, so paging stays local. */
const WINDOW_PAD_DAYS = 21

export function CalendarShell({
  tenantId = CURRENT_TENANT.id,
  initialWindow,
  initialEvents,
  className,
}: CalendarShellProps) {
  const reduceMotion = useReducedMotionSafe()
  const currency = CURRENT_TENANT.currency

  const [view, setView] = React.useState<ViewKey>('week')
  const [cursor, setCursor] = React.useState<Date>(() => startOfDay(NOW))
  const [direction, setDirection] = React.useState<1 | -1>(1)
  const [filters, setFilters] = React.useState<CalendarFilterState>(DEFAULT_CALENDAR_FILTERS)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [createSeed, setCreateSeed] = React.useState<{ date: Date; time: string | null }>({
    date: startOfDay(NOW),
    time: null,
  })

  const range = React.useMemo(() => rangeFor(view, cursor), [view, cursor])
  const label = React.useMemo(() => labelFor(view, cursor, range), [view, cursor, range])

  const [cache, setCache] = React.useState<{ fromKey: string; toKey: string; events: CalendarEvent[] }>(
    () => ({ fromKey: toDateKey(initialWindow.from), toKey: toDateKey(initialWindow.to), events: initialEvents }),
  )
  const rangeFromKey = toDateKey(range.from)
  const rangeToKey = toDateKey(range.to)
  const covered = rangeFromKey >= cache.fromKey && rangeToKey <= cache.toKey

  React.useEffect(() => {
    if (covered) return
    let cancelled = false
    const from = addDays(range.from, -WINDOW_PAD_DAYS)
    const to = addDays(range.to, WINDOW_PAD_DAYS)
    fetchCalendarEvents(tenantId, from, to).then((next) => {
      if (!cancelled) setCache({ fromKey: toDateKey(from), toKey: toDateKey(to), events: next })
    })
    return () => {
      cancelled = true
    }
  }, [covered, tenantId, range.from, range.to])

  const events = React.useMemo(() => {
    // Same inclusive day-bound semantics as getDeparturesInRange.
    const inRange = cache.events.filter((event) => {
      const key = event.departure.startsAt.slice(0, 10)
      return key >= rangeFromKey && key <= rangeToKey
    })
    return filterEvents(inRange, filters)
  }, [cache.events, rangeFromKey, rangeToKey, filters])

  const eventsByDay = React.useMemo(() => {
    const out: Record<string, CalendarEvent[]> = {}
    if (view !== 'month') return out
    for (const event of events) {
      const key = event.departure.startsAt.slice(0, 10)
      const bucket = out[key]
      if (bucket) bucket.push(event)
      else out[key] = [event]
    }
    return out
  }, [events, view])

  const stats = React.useMemo(() => {
    let booked = 0
    let capacity = 0
    let revenue = 0
    let running = 0
    for (const event of events) {
      const { departure } = event
      if (departure.status === 'cancelled') continue
      running += 1
      booked += departure.booked
      capacity += departure.capacity
      revenue += event.revenue
    }
    return { booked, capacity, revenue, running, utilisation: fillRate(booked, capacity) }
  }, [events])

  /* ------------------------------------------------------------ actions -- */

  const goto = React.useCallback(
    (nextDirection: 1 | -1) => {
      setDirection(nextDirection)
      setCursor((current) => shift(view, current, nextDirection))
    },
    [view],
  )

  const goToday = React.useCallback(() => {
    const target = startOfDay(NOW)
    setDirection(target.getTime() >= cursor.getTime() ? 1 : -1)
    setCursor(target)
  }, [cursor])

  const changeView = React.useCallback((next: ViewKey) => {
    setDirection(1)
    setView(next)
  }, [])

  const openDay = React.useCallback((date: Date) => {
    setDirection(1)
    setCursor(startOfDay(date))
    setView('day')
  }, [])

  const openCreate = React.useCallback((date: Date, time?: string | null) => {
    setCreateSeed({ date: startOfDay(date), time: time ?? null })
    setCreateOpen(true)
  }, [])

  const createFromSlot = React.useCallback(
    (slot: Date) => {
      openCreate(slot, `${String(slot.getHours()).padStart(2, '0')}:00`)
    },
    [openCreate],
  )

  /* -------------------------------------------------------- keyboard ----- */

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')
      ) {
        return
      }

      switch (event.key.toLowerCase()) {
        case 't':
          event.preventDefault()
          goToday()
          break
        case 'm':
          event.preventDefault()
          changeView('month')
          break
        case 'w':
          event.preventDefault()
          changeView('week')
          break
        case 'd':
          event.preventDefault()
          changeView('day')
          break
        case 'a':
          event.preventDefault()
          changeView('agenda')
          break
        case 'arrowleft':
          event.preventDefault()
          goto(-1)
          break
        case 'arrowright':
          event.preventDefault()
          goto(1)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goto, goToday, changeView])

  /* ------------------------------------------------------------- render -- */

  const isOnToday =
    view === 'month'
      ? cursor.getFullYear() === NOW.getFullYear() && cursor.getMonth() === NOW.getMonth()
      : view === 'day'
        ? isSameDay(cursor, NOW)
        : NOW >= range.from && NOW <= addDays(range.to, 1)

  const transition = reduceMotion
    ? { duration: 0.12 }
    : { duration: 0.24, ease: EASE_OUT_EXPO }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* --------------------------------------------------------- toolbar -- */}
      <div className="rounded-2xl border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5">
          <div className="flex items-center gap-1">
            <IconButton
              aria-label="Previous period"
              size="sm"
              variant="ghost"
              onClick={() => goto(-1)}
            >
              <ChevronLeft aria-hidden="true" />
            </IconButton>
            <IconButton
              aria-label="Next period"
              size="sm"
              variant="ghost"
              onClick={() => goto(1)}
            >
              <ChevronRight aria-hidden="true" />
            </IconButton>
            <Button
              size="sm"
              variant={isOnToday ? 'secondary' : 'outline'}
              onClick={goToday}
              className="ml-0.5"
            >
              Today
            </Button>
          </div>

          <h2
            aria-live="polite"
            className="font-display min-w-0 truncate text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground sm:text-base"
          >
            {label}
          </h2>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <Segmented
              label="Calendar view"
              size="sm"
              options={VIEW_OPTIONS}
              value={view}
              onValueChange={changeView}
              hideLabelsOnMobile
            />
            <CalendarFilters tenantId={tenantId} filters={filters} onChange={setFilters} />
            <Button
              size="sm"
              leftIcon={<Plus aria-hidden="true" />}
              onClick={() => openCreate(cursor)}
            >
              <span className="hidden sm:inline">New departure</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Period summary + shortcut legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line-subtle px-3.5 py-2">
          <dl className="tabular flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem]">
            <div className="flex items-baseline gap-1.5">
              <dt className="text-subtle">Departures</dt>
              <dd className="font-semibold text-foreground">{formatNumber(stats.running)}</dd>
            </div>
            <Separator orientation="vertical" className="hidden h-3.5 sm:block" />
            <div className="flex items-baseline gap-1.5">
              <dt className="text-subtle">Guests</dt>
              <dd className="font-semibold text-foreground">{formatNumber(stats.booked)}</dd>
            </div>
            <Separator orientation="vertical" className="hidden h-3.5 sm:block" />
            <div className="flex items-baseline gap-1.5">
              <dt className="text-subtle">Capacity sold</dt>
              <dd
                className={cn(
                  'font-semibold',
                  stats.utilisation >= 85
                    ? 'text-success'
                    : stats.utilisation >= 60
                      ? 'text-foreground'
                      : 'text-warning',
                )}
              >
                {Math.round(stats.utilisation)}%
              </dd>
            </div>
            <Separator orientation="vertical" className="hidden h-3.5 sm:block" />
            <div className="flex items-baseline gap-1.5">
              <dt className="text-subtle">Booked value</dt>
              <dd className="font-semibold text-foreground">
                {formatCurrency(stats.revenue, currency, { compact: true })}
              </dd>
            </div>
          </dl>

          <div className="ml-auto hidden items-center gap-1.5 text-[0.6875rem] text-faint lg:flex">
            <SimpleTooltip label="Jump to today">
              <span className="inline-flex items-center gap-1">
                <Kbd size="sm">T</Kbd>
              </span>
            </SimpleTooltip>
            <SimpleTooltip label="Switch view">
              <span className="inline-flex items-center gap-1">
                <Kbd size="sm">M</Kbd>
                <Kbd size="sm">W</Kbd>
                <Kbd size="sm">D</Kbd>
                <Kbd size="sm">A</Kbd>
              </span>
            </SimpleTooltip>
            <SimpleTooltip label="Previous / next period">
              <span className="inline-flex items-center gap-1">
                <Kbd size="sm">←</Kbd>
                <Kbd size="sm">→</Kbd>
              </span>
            </SimpleTooltip>
          </div>
        </div>
      </div>

      <ActiveFilterPills tenantId={tenantId} filters={filters} onChange={setFilters} />

      {/* ------------------------------------------------------------ views -- */}
      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${view}:${toDateKey(range.from)}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -20 }}
            transition={transition}
            className="gpu"
          >
            {view === 'month' ? (
              <MonthView
                month={cursor}
                eventsByDay={eventsByDay}
                onSelectEvent={setSelectedId}
                onCreate={(date) => openCreate(date)}
                onOpenDay={openDay}
              />
            ) : null}

            {view === 'week' ? (
              <WeekView
                weekStart={range.from}
                events={events}
                onSelectEvent={setSelectedId}
                onCreate={createFromSlot}
                onOpenDay={openDay}
              />
            ) : null}

            {view === 'day' ? (
              <DayView
                day={cursor}
                events={events}
                tenantId={tenantId}
                currency={currency}
                onSelectEvent={setSelectedId}
                onCreate={createFromSlot}
              />
            ) : null}

            {view === 'agenda' ? (
              <AgendaView
                from={range.from}
                days={AGENDA_DAYS}
                events={events}
                tenantId={tenantId}
                currency={currency}
                onSelectEvent={setSelectedId}
                onCreate={(date) => openCreate(date)}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ------------------------------------------------------- surfaces -- */}
      <DepartureDetailSheet
        departureId={selectedId}
        onOpenChange={(next) => {
          if (!next) setSelectedId(null)
        }}
        currency={currency}
        onDuplicate={(id) => {
          setSelectedId(null)
          const seed = events.find((event) => event.departure.id === id)
          openCreate(
            seed ? new Date(seed.departure.startsAt) : cursor,
            seed ? seed.departure.startsAt.slice(11, 16) : null,
          )
        }}
      />

      <NewDepartureDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        tenantId={tenantId}
        currency={currency}
        initialDate={createSeed.date}
        initialTime={createSeed.time}
      />
    </div>
  )
}
