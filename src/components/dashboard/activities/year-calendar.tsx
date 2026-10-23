'use client'

import * as React from 'react'
import Link from 'next/link'
import { Ban, CalendarCheck, Plus, RotateCcw } from 'lucide-react'

import type { ActivitySchedule } from '@/types'
import { addMonthsKey, clockTime, shiftDayKey, type ScheduledDay } from '@/lib/activity-schedule'
import { cn, fromDateKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { TimeChip, nextTime } from './season-card'
import { daysBetween, describeDates, tintOf, type PickMode } from './schedule-draft'

/* ==========================================================================
   YEAR CALENDAR — twelve small months from this one. Each day is tinted by
   the season it runs in, closed days are grey and struck through, changed
   days carry a dot, days with other spots (or extra spots) than usual a
   corner mark. A click opens that day: its times, add a time, close it,
   change its spots and extra spots. Shift-click picks a run of days to close
   or give other spots at once.
   Edits here are changes for those days only; a season card changes all
   of its days.
   ========================================================================== */

/** An edit from the calendar. `reason` rides along so a reason typed before the edit is kept on it. */
export type CalendarAction =
  | { type: 'add'; dates: string[]; time: string; reason?: string }
  | { type: 'remove'; dateKey: string; time: string; changeId?: string }
  | { type: 'close'; dates: string[]; reason: string }
  | { type: 'open'; dateKey: string }
  | { type: 'run'; dateKey: string; reason?: string }
  /** New spots and/or extra spots on these days; one left out stays as the day has it. */
  | { type: 'capacity'; dates: string[]; spots?: number; extra?: number; reason?: string }
  /** Back to each day's usual spots and extra spots. */
  | { type: 'capacity-usual'; dates: string[] }
  | { type: 'reason'; dateKey: string; reason: string }

/** A day's spots (a private group's size, a rental's items out, a pass's tickets) and its extra spots. */
export interface DayNumbers {
  spots: number
  extra: number
}

export interface YearCalendarProps {
  /** One entry per day for the location shown, from the first of this month, twelve months on. */
  days: ScheduledDay[]
  /** The seasons shown, in order, for the tints. The first is the regular times. */
  seasons: ActivitySchedule[]
  mode: PickMode
  todayKey: string
  /** The last day guests can book. */
  windowEndKey: string
  /** Booked per day and start time. */
  booked: Map<string, Map<string, number>>
  /** A day's numbers now (its first time slot's). */
  numbersFor: (day: ScheduledDay | undefined, dateKey: string) => DayNumbers
  /** A day's usual numbers, before a change for that date (its weekday's own, or the usual ones). */
  usualFor: (dateKey: string) => DayNumbers
  /** The day has other numbers than the usual ones every day: it gets a corner mark. */
  differs?: (day: ScheduledDay) => boolean
  /** Extra spots can be set here: the kind sells them. */
  showExtra?: boolean
  /** A pass: its tickets are the day's, shared by its time slots, so they go down to the day's bookings. */
  wholeDay?: boolean
  /** Spots (with extra spots on top) can't go below what is booked. Not for a private group: it books the time slot once. */
  floor?: boolean
  /** The most a day's spots can be (a rental: its stock). Absent: no limit here. */
  mostSpots?: number
  showSpots: boolean
  /** The day panel's label for spots: "Spots", "Items out", "Group size". */
  spotsLabel?: string
  /** The reason already written on a day's changes. */
  reasonFor: (dateKey: string) => string
  /** The season's start times that weekday, for running on a closed day anyway. */
  seasonTimesFor: (day: ScheduledDay | undefined) => string[]
  onAction: (action: CalendarAction) => void
  /** The time the "Add a time" field starts at. */
  suggestTime: string
}

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })
const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const pad = (n: number) => String(n).padStart(2, '0')

/** A closed day's own reason; the engine's stand-in "Closed" isn't one. */
const reasonOf = (closed: ScheduledDay['closed']) => {
  const reason = closed?.reason?.trim() ?? ''
  return reason.toLowerCase() === 'closed' ? '' : reason
}


/**
 * The fewest spots some days can have: what their busiest time slot already
 * has booked, less the extra spots sold on top, with that time slot's day,
 * start and bookings. Null when nothing is booked.
 */
export function spotsFloor(dates: string[], booked: Map<string, Map<string, number>>, extra: number, wholeDay = false): { floor: number; count: number; dateKey: string; time: string } | null {
  let worst: { count: number; dateKey: string; time: string } | null = null
  for (const dateKey of dates) {
    const row = [...(booked.get(dateKey) ?? [])].filter(([, count]) => count > 0)
    // A pass's tickets are shared by the day's time slots: the floor is the whole day's bookings.
    const counts: [string, number][] = wholeDay && row.length > 0 ? [['', row.reduce((sum, [, count]) => sum + count, 0)]] : row
    for (const [time, count] of counts) if (!worst || count > worst.count) worst = { count, dateKey, time }
  }
  if (!worst) return null
  return { ...worst, floor: Math.max(1, worst.count - Math.max(0, extra)) }
}

/** "12 already booked at 9:00. Spots can go down to 12." */
export function floorMessage(found: { floor: number; count: number; dateKey: string; time: string }, extra: number, label: string, several: boolean) {
  const at = found.time ? ` at ${clockTime(found.time)}` : ''
  const where = several ? ` on ${dayName.format(fromDateKey(found.dateKey))}${at}` : at
  const plus = extra > 0 && found.floor < found.count ? ` (${extra} extra on top)` : ''
  return `${found.count} already booked${where}. ${label} can go down to ${found.floor}${plus}.`
}

/** "12 already booked at 9:00. Extra spots can go down to 2." */
function extraFloorMessage(found: { count: number; dateKey: string; time: string }, spots: number, several: boolean) {
  const at = found.time ? ` at ${clockTime(found.time)}` : ''
  const where = several ? ` on ${dayName.format(fromDateKey(found.dateKey))}${at}` : at
  return `${found.count} already booked${where}. Extra spots can go down to ${Math.max(0, found.count - spots)}.`
}

/**
 * What is wrong with some days' new numbers: a message when, on one of them,
 * spots plus extra spots would be fewer than are already booked. `editing`
 * says which number changed, for the words.
 */
export function capacityProblem(
  dates: string[],
  numbersOf: (dateKey: string) => DayNumbers,
  booked: Map<string, Map<string, number>>,
  opts: { wholeDay?: boolean; label: string; editing: 'spots' | 'extra' },
): string | null {
  for (const dateKey of dates) {
    const { spots, extra } = numbersOf(dateKey)
    const found = spotsFloor([dateKey], booked, extra, opts.wholeDay)
    if (!found || spots + extra >= found.count) continue
    const several = dates.length > 1
    return opts.editing === 'extra' ? extraFloorMessage(found, spots, several) : floorMessage(found, extra, opts.label, several)
  }
  return null
}
/** ", 20 spots", ", groups up to 12": a marked day's number, for its label. */
const markWords = (spots: number, label: string) => (label === 'Group size' ? `, groups up to ${spots}` : `, ${spots} ${label.toLowerCase()}`)

/** The day an arrow, Page or Home/End key moves to (weeks start on Monday); undefined for any other key. */
function dayForKey(key: string, dateKey: string): string | undefined {
  const weekday = (fromDateKey(dateKey).getDay() + 6) % 7
  switch (key) {
    case 'ArrowLeft':
      return shiftDayKey(dateKey, -1)
    case 'ArrowRight':
      return shiftDayKey(dateKey, 1)
    case 'ArrowUp':
      return shiftDayKey(dateKey, -7)
    case 'ArrowDown':
      return shiftDayKey(dateKey, 7)
    case 'PageUp':
      return addMonthsKey(dateKey, -1)
    case 'PageDown':
      return addMonthsKey(dateKey, 1)
    case 'Home':
      return shiftDayKey(dateKey, -weekday)
    case 'End':
      return shiftDayKey(dateKey, 6 - weekday)
    default:
      return undefined
  }
}

export function YearCalendar(props: YearCalendarProps) {
  const { days, seasons, mode, todayKey, windowEndKey } = props
  const byKey = React.useMemo(() => new Map(days.map((day) => [day.dateKey, day])), [days])
  const tintIndex = React.useMemo(() => new Map(seasons.map((season, index) => [season.id, index])), [seasons])
  const [selection, setSelection] = React.useState<{ start: string; end: string } | null>(null)
  const anchorRef = React.useRef<HTMLButtonElement | null>(null)
  const gridRef = React.useRef<HTMLDivElement | null>(null)
  // One tab stop for the whole calendar; arrow keys move between days.
  const [focusKey, setFocusKey] = React.useState(todayKey)

  const months = React.useMemo(() => {
    const first = `${todayKey.slice(0, 7)}-01`
    return Array.from({ length: 12 }, (_, index) => {
      const key = addMonthsKey(first, index)
      const year = Number(key.slice(0, 4))
      const month = Number(key.slice(5, 7))
      const length = new Date(year, month, 0).getDate()
      const offset = (new Date(year, month - 1, 1).getDay() + 6) % 7
      return { key, label: monthName.format(new Date(year, month - 1, 1)), offset, keys: Array.from({ length }, (_, day) => `${key.slice(0, 7)}-${pad(day + 1)}`) }
    })
  }, [todayKey])
  const lastMonth = months[months.length - 1]
  const lastKey = lastMonth.keys[lastMonth.keys.length - 1]

  const selectedDay = selection ? byKey.get(selection.start) : undefined
  const range = selection && selection.start !== selection.end ? daysBetween(selection.start, selection.end).filter((key) => key >= todayKey) : null
  const inSelection = (key: string) => {
    if (!selection) return false
    const [a, b] = selection.start <= selection.end ? [selection.start, selection.end] : [selection.end, selection.start]
    return key >= a && key <= b
  }

  /** The last day picked: a shift-pick runs from it, even after its panel was closed (Escape, then arrows, then Shift+Enter). */
  const pickedRef = React.useRef<string | null>(null)
  const select = (key: string, shift: boolean, element: HTMLButtonElement) => {
    anchorRef.current = element
    const start = shift ? (selection?.start ?? pickedRef.current) : null
    const next = start && start >= todayKey ? { start, end: key } : { start: key, end: key }
    pickedRef.current = next.start
    setSelection(next)
  }

  // Days before today can't be picked, so the tab stop never sits on one.
  const tabKey = focusKey < todayKey || focusKey > lastKey ? todayKey : focusKey
  const onDayKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, key: string) => {
    if (event.key === 'Enter') {
      // Enter opens the day; Shift+Enter picks a run of days, like Shift-click.
      event.preventDefault()
      select(key, event.shiftKey, event.currentTarget)
      return
    }
    const next = dayForKey(event.key, key)
    if (!next) return
    event.preventDefault()
    const target = next < todayKey ? todayKey : next > lastKey ? lastKey : next
    setFocusKey(target)
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus()
  }

  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-subtle">
        {mode === 'dates' ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-primary-soft" aria-hidden="true" />
            Runs
          </span>
        ) : seasons.length === 1 ? (
          // Only the regular times: nothing to tell apart, and they have no name on screen.
          <span className="inline-flex items-center gap-1.5">
            <span className={cn('size-3 rounded-sm', tintOf(0).cell)} aria-hidden="true" />
            Runs
          </span>
        ) : (
          seasons.map((season, index) => (
            <span key={season.id} className="inline-flex items-center gap-1.5">
              <span className={cn('size-3 rounded-sm', tintOf(index).cell)} aria-hidden="true" />
              {season.name || 'Season'}
            </span>
          ))
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-surface-sunken ring-1 ring-line ring-inset" aria-hidden="true" />
          Closed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          Changed
        </span>
        {props.showSpots && props.differs && days.some((day) => day.dateKey >= todayKey && day.slots.length > 0 && props.differs!(day)) ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-0 border-t-[6px] border-l-[6px] border-t-foreground/70 border-l-transparent" aria-hidden="true" />
            Different {(props.spotsLabel ?? 'Spots').toLowerCase()}
          </span>
        ) : null}
        {windowEndKey < lastKey ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-primary-soft opacity-50" aria-hidden="true" />
            Not open for booking yet
          </span>
        ) : null}
      </div>

      <Popover
        open={selection !== null}
        onOpenChange={(open) => {
          if (!open) setSelection(null)
        }}
      >
        <PopoverAnchor virtualRef={anchorRef} />
        {/* Columns follow the calendar's own width, so the wizard's narrow column keeps readable days. */}
        <div ref={gridRef} className="grid gap-x-5 gap-y-5 @md:grid-cols-2 @2xl:grid-cols-3">
          {months.map((month) => (
            <div key={month.key} className="min-w-0">
              <p className="mb-1.5 text-xs font-semibold text-foreground">{month.label}</p>
              <div className="grid grid-cols-7 gap-0.5">
                {WEEK_LETTERS.map((letter, index) => (
                  <span key={index} className="text-center text-xs text-faint" aria-hidden="true">
                    {letter}
                  </span>
                ))}
                {Array.from({ length: month.offset }, (_, index) => (
                  <span key={`blank-${index}`} aria-hidden="true" />
                ))}
                {month.keys.map((key) => {
                  const day = byKey.get(key)
                  const past = key < todayKey
                  const closed = Boolean(day?.closed)
                  const runs = (day?.slots.length ?? 0) > 0
                  const index = day?.scheduleId ? tintIndex.get(day.scheduleId) : undefined
                  const tint = runs ? (mode === 'dates' || index === undefined ? 'bg-primary-soft' : tintOf(index).cell) : ''
                  const reason = reasonOf(day?.closed)
                  const status = closed ? (reason ? `closed, ${reason}` : 'closed') : runs ? `${day!.slots.length} ${day!.slots.length === 1 ? 'time slot' : 'time slots'}` : 'no time slots'
                  const spotsMark = !past && runs && props.showSpots && Boolean(props.differs?.(day!))
                  return (
                    <button
                      key={key}
                      type="button"
                      data-day={key}
                      disabled={past}
                      tabIndex={key === tabKey ? 0 : -1}
                      aria-pressed={inSelection(key)}
                      aria-label={`${dayName.format(fromDateKey(key))}: ${status}${spotsMark ? markWords(props.numbersFor(day, key).spots, props.spotsLabel ?? 'Spots') : ''}${day?.changed ? ', changed' : ''}`}
                      onClick={(event) => select(key, event.shiftKey, event.currentTarget)}
                      onKeyDown={(event) => onDayKeyDown(event, key)}
                      onFocus={() => setFocusKey(key)}
                      className={cn(
                        'relative grid h-7 min-w-0 place-items-center rounded-md text-xs tabular transition-shadow duration-150',
                        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                        past ? 'cursor-default text-faint/70' : 'cursor-pointer text-foreground hover:ring-1 hover:ring-line-strong',
                        !past && tint,
                        !past && !runs && !closed && 'text-subtle',
                        !past && closed && 'bg-surface-sunken text-faint line-through',
                        !past && key > windowEndKey && 'opacity-50',
                        key === todayKey && 'ring-1 ring-foreground/50',
                        inSelection(key) && 'ring-2 ring-primary',
                      )}
                    >
                      {Number(key.slice(8, 10))}
                      {!past && day?.changed ? <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary" aria-hidden="true" /> : null}
                      {spotsMark ? <span className="absolute top-0.5 right-0.5 size-0 border-t-[5px] border-l-[5px] border-t-foreground/70 border-l-transparent" aria-hidden="true" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
        <PopoverContent
          width="md"
          padding="none"
          onInteractOutside={(event) => {
            // Another day: the panel moves to it instead of closing.
            const target = event.target as HTMLElement | null
            if (target?.closest?.('[data-day]')) event.preventDefault()
          }}
          onOpenAutoFocus={(event) => {
            // Into the panel, but not onto its first button (a time's remove).
            event.preventDefault()
            ;(event.currentTarget as HTMLElement | null)?.focus?.()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            anchorRef.current?.focus()
          }}
        >
          {selection && range && range.length > 1 ? (
            <RangePanel key={`${selection.start}-${selection.end}`} dates={range} {...props} onDone={() => setSelection(null)} />
          ) : selection ? (
            <DayPanel key={selection.start} dateKey={selection.start} day={selectedDay} tint={selectedDay?.scheduleId ? tintIndex.get(selectedDay.scheduleId) : undefined} {...props} />
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function DayPanel({
  dateKey,
  day,
  tint,
  mode,
  seasons,
  booked,
  numbersFor,
  usualFor,
  showExtra = false,
  wholeDay = false,
  floor = true,
  mostSpots,
  showSpots,
  spotsLabel = 'Spots',
  reasonFor,
  seasonTimesFor,
  onAction,
  suggestTime,
}: YearCalendarProps & { dateKey: string; day: ScheduledDay | undefined; tint: number | undefined }) {
  const [time, setTime] = React.useState(suggestTime)
  const [reason, setReason] = React.useState(() => reasonFor(dateKey))
  const season = seasons.find((entry) => entry.id === day?.scheduleId)
  const slots = day?.slots ?? []
  const closed = day?.closed
  const bookedToday = booked.get(dateKey)
  const runTimes = seasonTimesFor(day)
  const closedReason = reasonOf(closed)
  // Booked times the day no longer lists (taken off, or the day closed) still run for their guests.
  const listed = new Set(slots.map((slot) => slot.time))
  const staying = [...(bookedToday ?? [])].filter(([at, count]) => count > 0 && !listed.has(at)).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  const anyBooked = staying.length > 0 || slots.some((slot) => (bookedToday?.get(slot.time) ?? 0) > 0)

  const commitReason = () => {
    if (reason.trim() !== reasonFor(dateKey).trim()) onAction({ type: 'reason', dateKey, reason })
  }
  const current = numbersFor(day, dateKey)
  const usual = usualFor(dateKey)
  const note = reason.trim() ? reason : undefined

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-4 py-3">
        <p className="text-sm font-semibold">{dayName.format(fromDateKey(dateKey))}</p>
        {season && seasons.length > 1 ? (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-subtle">
            <span className={cn('size-2 shrink-0 rounded-full', tintOf(tint ?? 0).dot)} aria-hidden="true" />
            <span className="truncate">{season.name || 'Season'}</span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        {closed ? (
          <p className="text-xs text-muted">
            Closed{closedReason ? ` · ${closedReason}` : ''}
            {closed.by === 'holiday' ? ' (public holiday)' : closed.by === 'closure' ? ' (business closed day)' : ''}
          </p>
        ) : null}
        {slots.length > 0 || staying.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot) => {
              const count = bookedToday?.get(slot.time) ?? 0
              // A booked time can't be taken off here: its guests would be left without word.
              return (
                <TimeChip
                  key={slot.time}
                  time={slot.time}
                  note={count > 0 ? `${count} booked` : undefined}
                  onRemove={count > 0 ? undefined : () => onAction({ type: 'remove', dateKey, time: slot.time, changeId: slot.change?.id })}
                />
              )
            })}
            {staying.map(([at, count]) => (
              <TimeChip key={at} time={at} note={`${count} booked · stays`} />
            ))}
          </div>
        ) : closed ? null : (
          <p className="text-xs text-faint">No time slots this day</p>
        )}
        {anyBooked ? (
          <p className="text-xs text-subtle">
            Cancel a booked time slot from the{' '}
            <Link href="/dashboard/calendar" className="font-medium text-primary underline-offset-2 hover:underline">
              calendar
            </Link>
            .
          </p>
        ) : null}

        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!/^\d{2}:\d{2}$/.test(time)) return
            onAction({ type: 'add', dates: [dateKey], time, reason: note })
            setTime(nextTime(time))
          }}
        >
          <Input type="time" size="sm" className="w-32" value={time} aria-label="Start time to add" onChange={(event) => setTime(event.target.value)} />
          <Button type="submit" size="sm" variant="secondary" leftIcon={<Plus />}>
            Add a time
          </Button>
        </form>

        {showSpots && slots.length > 0 ? (
          <DayCapacityFields
            key={`${current.spots}|${current.extra}`}
            current={current}
            usual={usual}
            showExtra={showExtra}
            label={spotsLabel}
            most={mostSpots}
            check={(next, editing) => (floor ? capacityProblem([dateKey], () => next, booked, { wholeDay, label: spotsLabel, editing }) : null)}
            onCommit={(next) => onAction({ type: 'capacity', dates: [dateKey], ...next, reason: note })}
            onUsual={() => onAction({ type: 'capacity-usual', dates: [dateKey] })}
          />
        ) : null}
        {/* A reason explains a change to the usual schedule; with specific dates there is no usual one. */}
        {mode === 'dates' && !closed ? null : (
          <label className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-subtle">Reason</span>
            <Input size="sm" className="min-w-0 flex-1" value={reason} placeholder="Optional" maxLength={60} onChange={(event) => setReason(event.target.value)} onBlur={commitReason} />
          </label>
        )}
      </div>

      {/* Nothing to close on a day with no time slots. */}
      {closed || slots.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-4 py-3">
          {closed?.by === 'change' ? (
            <Button type="button" size="xs" variant="secondary" leftIcon={<RotateCcw />} onClick={() => onAction({ type: 'open', dateKey })}>
              Open this day
            </Button>
          ) : closed ? (
            <Button type="button" size="xs" variant="secondary" leftIcon={<CalendarCheck />} disabled={runTimes.length === 0} onClick={() => onAction({ type: 'run', dateKey, reason: note })}>
              Run this day anyway
            </Button>
          ) : (
            <Button type="button" size="xs" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" leftIcon={<Ban />} onClick={() => onAction({ type: 'close', dates: [dateKey], reason })}>
              Close this day
            </Button>
          )}
          {runTimes.length > 0 && !closed ? <span className="ml-auto text-xs text-faint">Usually {runTimes.map(clockTime).join(', ')}</span> : null}
        </div>
      ) : null}
    </div>
  )
}

function RangePanel({
  dates,
  days,
  mode,
  onAction,
  suggestTime,
  onDone,
  showSpots,
  spotsLabel = 'Spots',
  booked,
  numbersFor,
  usualFor,
  showExtra = false,
  wholeDay = false,
  floor = true,
  mostSpots,
}: YearCalendarProps & { dates: string[]; onDone: () => void }) {
  const [reason, setReason] = React.useState('')
  const [time, setTime] = React.useState(suggestTime)
  const [spots, setSpots] = React.useState('')
  const [extra, setExtra] = React.useState('')
  const [spotsError, setSpotsError] = React.useState('')
  // Spots only matter on the days that run.
  const byKey = React.useMemo(() => new Map(days.map((day) => [day.dateKey, day])), [days])
  const running = dates.filter((key) => (byKey.get(key)?.slots.length ?? 0) > 0)
  const changed = running.some((key) => {
    const now = numbersFor(byKey.get(key), key)
    const usual = usualFor(key)
    return now.spots !== usual.spots || (showExtra && now.extra !== usual.extra)
  })
  /** New numbers on every day that runs (one left empty stays as each day has it); never below what is booked. */
  const changeNumbers = (next: { spots?: number; extra?: number }) => {
    const numbersOn = (key: string) => {
      const now = numbersFor(byKey.get(key), key)
      return { spots: next.spots ?? now.spots, extra: next.extra ?? now.extra }
    }
    const problem = floor ? capacityProblem(running, numbersOn, booked, { wholeDay, label: spotsLabel, editing: next.spots === undefined ? 'extra' : 'spots' }) : null
    if (problem) return setSpotsError(problem)
    onAction({ type: 'capacity', dates: running, ...next })
    onDone()
  }
  /** Each day back to its usual numbers; never below what is booked. */
  const backToUsual = () => {
    const problem = floor ? capacityProblem(running, usualFor, booked, { wholeDay, label: spotsLabel, editing: 'spots' }) : null
    if (problem) return setSpotsError(problem)
    onAction({ type: 'capacity-usual', dates: running })
    onDone()
  }
  return (
    <div className="flex flex-col">
      <div className="border-b border-line-subtle px-4 py-3">
        <p className="text-sm font-semibold">{describeDates(dates)}</p>
        <p className="text-xs text-subtle">{dates.length} days</p>
      </div>
      <div className="flex flex-col gap-3 px-4 py-3">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!/^\d{2}:\d{2}$/.test(time)) return
            onAction({ type: 'add', dates, time, reason: reason.trim() ? reason : undefined })
            onDone()
          }}
        >
          <Input type="time" size="sm" className="w-32" value={time} aria-label="Start time to add on these days" onChange={(event) => setTime(event.target.value)} />
          <Button type="submit" size="sm" variant="secondary" leftIcon={<Plus />}>
            {mode === 'dates' ? 'Run at this time' : 'Add to each day'}
          </Button>
        </form>
        <label className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-subtle">Reason</span>
          <Input size="sm" className="min-w-0 flex-1" value={reason} placeholder="Optional" maxLength={60} onChange={(event) => setReason(event.target.value)} />
        </label>
        {showSpots && running.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const value = Math.min(mostSpots ?? Number.POSITIVE_INFINITY, Math.floor(Number(spots)))
                const more = Math.floor(Number(extra))
                const spotsSet = spots.trim() !== '' && Number.isFinite(value) && value >= 1
                const extraSet = showExtra && extra.trim() !== '' && Number.isFinite(more) && more >= 0
                if (!spotsSet && !extraSet) return setSpotsError(showExtra ? `Type the ${spotsLabel.toLowerCase()} or extra spots for these days` : `Type the ${spotsLabel.toLowerCase()} for these days`)
                changeNumbers({ ...(spotsSet ? { spots: value } : {}), ...(extraSet ? { extra: more } : {}) })
              }}
            >
              {/* Labelled like the day panel; one left empty stays as each day has it. */}
              <label className="flex items-center gap-2">
                <span className="shrink-0 text-xs text-subtle">{spotsLabel}</span>
                <Input
                  type="number"
                  size="sm"
                  min={1}
                  max={mostSpots}
                  className="w-20"
                  value={spots}
                  aria-label={`${spotsLabel} on these days`}
                  error={spotsError ? true : undefined}
                  onChange={(event) => {
                    setSpots(event.target.value)
                    setSpotsError('')
                  }}
                />
              </label>
              {showExtra ? (
                <label className="flex items-center gap-2">
                  <span className="shrink-0 text-xs text-subtle">Extra spots</span>
                  <Input
                    type="number"
                    size="sm"
                    min={0}
                    className="w-20"
                    value={extra}
                    aria-label="Extra spots on these days"
                    onChange={(event) => {
                      setExtra(event.target.value)
                      setSpotsError('')
                    }}
                  />
                </label>
              ) : null}
              <Button type="submit" size="sm" variant="secondary">
                Change
              </Button>
              {changed ? (
                <button type="button" onClick={backToUsual} className="text-xs font-medium text-primary hover:underline">
                  Back to usual
                </button>
              ) : null}
            </form>
            {spotsError ? (
              <p role="alert" className="text-xs font-medium text-danger">
                {spotsError}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-line-subtle px-4 py-3">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          className="text-danger hover:bg-danger-soft hover:text-danger"
          leftIcon={<Ban />}
          onClick={() => {
            onAction({ type: 'close', dates, reason })
            onDone()
          }}
        >
          Close these days
        </Button>
      </div>
    </div>
  )
}

/**
 * One day's spots and extra spots, each saved when it is left (or on Enter):
 * up to any number, down to what is already booked. "Back to usual" puts
 * both back to the day's usual numbers.
 */
function DayCapacityFields({
  current,
  usual,
  showExtra,
  label,
  most,
  check,
  onCommit,
  onUsual,
}: {
  current: DayNumbers
  usual: DayNumbers
  showExtra: boolean
  label: string
  /** The most the spots can be (a rental: its stock). */
  most?: number
  /** A message when the new numbers go below what is booked. */
  check: (next: DayNumbers, editing: 'spots' | 'extra') => string | null
  onCommit: (next: { spots?: number; extra?: number }) => void
  onUsual: () => void
}) {
  // Every time slot sells at least one spot; an older save with none shows the field empty.
  const [spots, setSpots] = React.useState(current.spots >= 1 ? String(current.spots) : '')
  const [extra, setExtra] = React.useState(String(current.extra))
  const [error, setError] = React.useState('')
  const commit = (editing: 'spots' | 'extra', raw: string) => {
    const typed = Math.floor(Number(raw))
    // A rental can't lend out more than it owns: a bigger number is its stock.
    const value = editing === 'spots' && most !== undefined ? Math.min(most, typed) : typed
    if (value !== typed && Number.isFinite(value)) setSpots(String(value))
    const least = editing === 'spots' ? 1 : 0
    if (raw.trim() === '' || !Number.isFinite(value) || value < least) {
      setError('')
      return editing === 'spots' ? setSpots(current.spots >= 1 ? String(current.spots) : '') : setExtra(String(current.extra))
    }
    if (value === current[editing === 'spots' ? 'spots' : 'extra']) return setError('')
    const next = editing === 'spots' ? { spots: value, extra: current.extra } : { spots: current.spots, extra: value }
    const problem = check(next, editing)
    if (problem) return setError(problem)
    setError('')
    onCommit(editing === 'spots' ? { spots: value } : { extra: value })
  }
  const differs = current.spots !== usual.spots || (showExtra && current.extra !== usual.extra)
  const usualWords = showExtra && usual.extra > 0 ? `${usual.spots} + ${usual.extra} extra` : String(usual.spots)
  const field = (editing: 'spots' | 'extra', text: string, setText: (value: string) => void, aria: string) => (
    <Input
      type="number"
      size="sm"
      min={editing === 'spots' ? 1 : 0}
      className="w-20"
      value={text}
      aria-label={aria}
      error={error ? true : undefined}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => commit(editing, text)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          commit(editing, text)
        }
      }}
    />
  )
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-subtle">{label}</span>
          {field('spots', spots, setSpots, `${label} this day`)}
        </label>
        {showExtra ? (
          <label className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-subtle">Extra spots</span>
            {field('extra', extra, setExtra, 'Extra spots this day')}
          </label>
        ) : null}
      </div>
      {differs ? (
        <button
          type="button"
          onClick={() => {
            // Back to usual can't go below what is booked either.
            const problem = check(usual, 'spots')
            if (problem) return setError(problem)
            setError('')
            onUsual()
          }}
          className="self-start text-xs font-medium text-primary hover:underline"
        >
          Back to usual ({usualWords})
        </button>
      ) : (
        <span className="text-xs text-faint">Usually {usualWords}</span>
      )}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}
