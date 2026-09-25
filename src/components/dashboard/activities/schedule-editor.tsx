'use client'

import * as React from 'react'
import Link from 'next/link'
import type { Location } from '@/types'
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Clock,
  DoorOpen,
  Infinity as InfinityIcon,
  Plus,
  Users,
  X,
} from 'lucide-react'

import { addDays, cn, fromDateKey, toDateKey } from '@/lib/utils'
import { locationAddress } from '@/lib/locations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Segmented } from '@/components/ui/segmented'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'

/* ==========================================================================
   TYPES

   Three ways an activity can be on sale:
   - times   departures at fixed start times on chosen weekdays (a boat, a tour)
   - hours   open all day between opening and closing on chosen weekdays; guests
             pick a date and turn up, or pick an arrival slot (a park, a rental,
             a self-guided ride)
   - dates   only on the dates listed, each with a time (an event, a workshop,
             a special dinner)
   Capacity 0 means no seat limit.
   ========================================================================== */

export type ScheduleMode = 'times' | 'hours' | 'dates'

export interface ScheduleDate {
  dateKey: string
  time: string
}

/** One of the business's locations this runs from, with its own schedule. */
export interface DraftLocation {
  locationId: string
  /**
   * The rule at this location: days, times, seats and season. Read only when
   * the activity runs from more than one location; with one, the activity's
   * own schedule is the rule. Its `locations` is always empty.
   */
  schedule: DraftSchedule
}

export interface DraftSchedule {
  mode: ScheduleMode
  /** 0=Sun … 6=Sat, matching RecurrenceRule in the domain model. */
  weekdays: number[]
  /** "HH:mm", local to the operator's timezone. Used by `times`. */
  startTimes: string[]
  /** Seats per departure, per day or per date. 0 = no limit. */
  capacity: number
  /** Optional most sold on a weekday (0=Sun … 6=Sat) across all its departures. */
  dayCapacity?: Record<number, number>
  /** What the daily limit counts. */
  dayLimitUnit?: 'tickets' | 'bookings'
  seasonStart: string
  seasonEnd: string
  /** `hours` only. */
  opensAt: string
  closesAt: string
  /** `hours` only: last entry this many minutes before closing. */
  lastEntryMinutes: number
  /** `hours` only: 0 = arrive any time, otherwise arrival slots every N minutes. */
  entryInterval: number
  /** `dates` only. */
  dates: ScheduleDate[]
  /** The locations this runs from, in the business's order. */
  locations: DraftLocation[]
}

/** Mon-first display order — the calendar grid starts on Monday. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
export const WEEKDAY_LABEL: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

export const SCHEDULE_MODES: { value: ScheduleMode; label: string; description: string; icon: typeof Clock }[] = [
  { value: 'times', label: 'Set start times', description: 'Departures at fixed times, each with its own manifest. Boats, tours, classes.', icon: Clock },
  { value: 'hours', label: 'Open hours', description: 'Guests come any time you are open. Parks, rentals, self-guided rides, walk-ins.', icon: DoorOpen },
  { value: 'dates', label: 'Specific dates', description: 'Runs only on the dates you list. Events, workshops, one-off dinners.', icon: CalendarDays },
]

export function defaultSchedule(nowIso: string): DraftSchedule {
  void nowIso
  return {
    mode: 'times',
    weekdays: [1, 2, 3, 4, 5, 6, 0],
    startTimes: ['09:00', '13:30'],
    locations: [],
    capacity: 16,
    seasonStart: '',
    seasonEnd: '',
    opensAt: '09:00',
    closesAt: '17:00',
    lastEntryMinutes: 60,
    entryInterval: 0,
    dates: [],
  }
}

export function formatClock(hhmm: string) {
  const [hours, minutes] = hhmm.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return hhmm
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, hours, minutes),
  )
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}
const fromMinutes = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

/** Arrival slots for an open-hours day: every `interval` minutes up to the last entry. */
export function entrySlots(schedule: DraftSchedule): string[] {
  if (schedule.entryInterval <= 0) return []
  const open = toMinutes(schedule.opensAt)
  const last = toMinutes(schedule.closesAt) - schedule.lastEntryMinutes
  const out: string[] = []
  for (let t = open; t <= last && out.length < 64; t += schedule.entryInterval) out.push(fromMinutes(t))
  return out
}

export interface GeneratedDeparture {
  dateKey: string
  weekday: number
  /** Start times, or arrival slots for an open day (one entry, the opening time, when arrival is free). */
  times: string[]
  /** Seats that day. 0 = no limit. */
  seats: number
  /** Set for open-hours days. */
  open?: { from: string; to: string }
}

/** Exactly what the rule would put on the calendar for the next `days` days. Listed dates ignore the window. */
/** Seats a weekday offers: every departure's seats, capped by the day's limit in tickets if there is one. */
export function seatsOnDay(schedule: Pick<DraftSchedule, 'capacity' | 'dayCapacity' | 'dayLimitUnit'>, weekday: number, departures: number): number {
  const total = schedule.capacity * departures
  const limit = schedule.dayCapacity?.[weekday]
  if (!limit || limit <= 0 || schedule.dayLimitUnit === 'bookings') return total
  return schedule.capacity > 0 ? Math.min(total, limit) : limit
}

export function previewDepartures(
  schedule: DraftSchedule,
  nowIso: string,
  days = 14,
): GeneratedDeparture[] {
  const start = new Date(nowIso)
  const todayKey = toDateKey(start)
  const out: GeneratedDeparture[] = []

  if (schedule.mode === 'dates') {
    const byDate = new Map<string, string[]>()
    for (const entry of schedule.dates) {
      if (!entry.dateKey || entry.dateKey < todayKey) continue
      const list = byDate.get(entry.dateKey) ?? []
      if (!list.includes(entry.time)) list.push(entry.time)
      byDate.set(entry.dateKey, list)
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([dateKey, times]) => ({
        dateKey,
        weekday: fromDateKey(dateKey).getDay(),
        times: [...times].sort(),
        seats: schedule.capacity * times.length,
      }))
  }

  const times = schedule.mode === 'times' ? [...schedule.startTimes].sort() : entrySlots(schedule)

  for (let i = 0; i < days; i++) {
    const day = addDays(start, i)
    const key = toDateKey(day)
    if (schedule.seasonStart && key < schedule.seasonStart) continue
    if (schedule.seasonEnd && key > schedule.seasonEnd) continue
    if (!schedule.weekdays.includes(day.getDay())) continue

    if (schedule.mode === 'hours') {
      out.push({
        dateKey: key,
        weekday: day.getDay(),
        times: times.length > 0 ? times : [schedule.opensAt],
        seats: seatsOnDay(schedule, day.getDay(), 1),
        open: { from: schedule.opensAt, to: schedule.closesAt },
      })
      continue
    }

    if (times.length === 0) continue
    out.push({ dateKey: key, weekday: day.getDay(), times, seats: seatsOnDay(schedule, day.getDay(), times.length) })
  }
  return out
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * What each departure, day or date sells, when the activity already set it
 * (seats on a trip, units on a rental, one group on a charter). The editor
 * shows it and links back instead of asking again.
 */
export interface ScheduleSeats {
  capacity: number
  one: string
  many: string
  /** "18 seats per departure", "6 vehicles at a time". */
  summary: string
  onEdit?: () => void
  /** Allow a different number on some weekdays. Off for charters and rentals, whose number is fixed. */
  varies?: boolean
}

/** One line for the review step. */
export function describeSchedule(schedule: DraftSchedule, nouns?: Pick<ScheduleSeats, 'one' | 'many'>): string {
  const many = nouns?.many ?? 'seats'
  const one = nouns?.one ?? 'seat'
  const limits = Object.entries(schedule.dayCapacity ?? {}).filter(([day, value]) => value > 0 && schedule.weekdays.includes(Number(day)))
  const base = schedule.capacity > 0 ? `${schedule.capacity} ${schedule.capacity === 1 ? one : many}` : `no ${one} limit`
  const unit = schedule.dayLimitUnit === 'bookings' ? 'bookings' : many
  // Group the days that share a number: "daily max 40 seats Mon, Wed".
  const groups = new Map<number, string[]>()
  for (const [day, value] of limits) groups.set(value, [...(groups.get(value) ?? []), WEEKDAY_LABEL[Number(day)]])
  const seats = limits.length > 0 ? `${base} (daily max ${[...groups].map(([value, names]) => `${value} ${unit} ${names.join(', ')}`).join('; ')})` : base
  if (schedule.mode === 'hours') {
    const arrival = schedule.entryInterval > 0 ? `arrival slots every ${schedule.entryInterval} min` : 'arrive any time'
    return `Open ${formatClock(schedule.opensAt)}–${formatClock(schedule.closesAt)} on ${plural(schedule.weekdays.length, 'day')} a week · ${arrival} · ${seats} a day`
  }
  if (schedule.mode === 'dates') {
    return `${plural(schedule.dates.length, 'date')} · ${seats} each`
  }
  return `${plural(schedule.startTimes.length, 'time')} on ${plural(schedule.weekdays.length, 'day')} · ${seats} each`
}

/* ==========================================================================
   EDITOR
   ========================================================================== */

export interface ScheduleEditorProps {
  schedule: DraftSchedule
  onChange: (schedule: DraftSchedule) => void
  /** The frozen demo clock, serialised from the server. */
  nowIso: string
  errors?: Record<string, string>
  /** Hide "How it goes on sale" when a parent shows it once for several locations. */
  showMode?: boolean
  /** Set by the activity's own settings; the editor shows it instead of a slider. */
  seats?: ScheduleSeats
  /** A rental: opening hours read as pick-up and return, start times only for hourly. */
  rental?: { hourly: boolean; daily: boolean }
  className?: string
}

/** "How it goes on sale": start times, open hours or specific dates. */
export function ModePicker({
  value,
  onChange,
  hint = 'Pick the one that matches how the day actually works. You can change it later.',
}: {
  value: ScheduleMode
  onChange: (mode: ScheduleMode) => void
  hint?: string
}) {
  return (
      <fieldset>
        <legend className="text-[0.8125rem] font-medium">How it goes on sale</legend>
        <p className="mt-0.5 mb-2.5 text-xs text-muted">
          {hint}
        </p>
        <RadioGroup
          value={value}
          onValueChange={(next) => onChange(next as ScheduleMode)}
          className="grid gap-2.5 lg:grid-cols-3"
        >
          {SCHEDULE_MODES.map((option) => (
            <RadioGroupCard
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              icon={<option.icon aria-hidden="true" />}
            />
          ))}
        </RadioGroup>
      </fieldset>
  )
}

export function ScheduleEditor({ schedule: given, onChange, nowIso, errors, showMode = true, seats, rental, className }: ScheduleEditorProps) {
  const schedule = seats ? { ...given, capacity: seats.capacity } : given
  const set = (patch: Partial<DraftSchedule>) => onChange({ ...schedule, ...patch })
  const unlimited = schedule.capacity === 0
  const many = seats?.many ?? 'seats'

  const preview = React.useMemo(() => previewDepartures(schedule, nowIso), [schedule, nowIso])
  const totalDepartures = preview.reduce((acc, day) => acc + (day.open ? 1 : day.times.length), 0)
  const totalSeats = preview.reduce((acc, day) => acc + day.seats, 0)

  const countLabel =
    schedule.mode === 'hours' ? 'open days' : schedule.mode === 'dates' ? 'dates' : 'departures'

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {showMode ? <ModePicker value={schedule.mode} onChange={(mode) => set({ mode })} /> : null}

      {schedule.mode !== 'dates' ? (
        <WeekdayPicker
          title={schedule.mode === 'hours' ? 'Open on' : 'Runs on'}
          hint={
            schedule.mode === 'hours'
              ? 'Guests can book any of these days, between the start and end dates if you set them.'
              : 'Departures are generated for every selected day, between the start and end dates if you set them.'
          }
          schedule={schedule}
          onChange={onChange}
          error={errors?.weekdays}
        />
      ) : null}

      {schedule.mode === 'times' ? <StartTimes schedule={schedule} onChange={onChange} error={errors?.startTimes} /> : null}
      {schedule.mode === 'hours' ? <OpenHours schedule={schedule} set={set} errors={errors} rental={rental} /> : null}
      {schedule.mode === 'dates' ? <DateList schedule={schedule} set={set} error={errors?.dates} /> : null}

      {/* ---------- capacity + season ---------- */}
      <div className="grid gap-5 sm:grid-cols-2">
        {seats ? (
          <div className="flex items-start justify-between gap-3 self-start rounded-xl border border-line bg-surface-sunken/50 px-3.5 py-3">
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-foreground">
                <Users className="size-3.5 text-faint" aria-hidden="true" />
                {seats.summary}
              </span>
              <span className="mt-0.5 block text-xs text-subtle">Set once in Basics, used at every time and location.</span>
            </span>
            {seats.onEdit ? (
              <Button type="button" variant="ghost" size="xs" onClick={seats.onEdit}>
                Change
              </Button>
            ) : null}
          </div>
        ) : (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.8125rem] font-medium">
              {schedule.mode === 'hours' ? 'Seats per day' : schedule.mode === 'dates' ? 'Seats per date' : 'Seats per departure'}
            </p>
            <span className="font-display text-sm font-semibold tabular">
              {unlimited ? 'No limit' : schedule.capacity}
            </span>
          </div>
          <Slider
            className={cn('mt-3', unlimited && 'pointer-events-none opacity-40')}
            min={1}
            max={schedule.mode === 'hours' ? 500 : 60}
            step={1}
            value={[unlimited ? 16 : schedule.capacity]}
            thumbLabels={['Seats']}
            onValueChange={([capacity]) => set({ capacity })}
            aria-disabled={unlimited}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {(schedule.mode === 'hours' ? [20, 50, 100, 200] : [8, 12, 16, 24, 40]).map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => set({ capacity: preset })}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200',
                  !unlimited && schedule.capacity === preset
                    ? 'border-primary/50 bg-primary-soft text-primary'
                    : 'border-line bg-surface text-muted hover:text-foreground',
                )}
              >
                {preset}
              </button>
            ))}
            <label className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-muted">
              <Switch
                size="sm"
                checked={unlimited}
                onCheckedChange={(value) => set({ capacity: value ? 0 : 16 })}
                aria-label="No seat limit"
              />
              <InfinityIcon className="size-3.5" aria-hidden="true" />
              No seat limit
            </label>
          </div>
          {errors?.capacity ? <p className="mt-1.5 text-xs font-medium text-danger">{errors.capacity}</p> : null}
        </div>
        )}

        {schedule.mode !== 'dates' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" labelSize="sm" error={errors?.seasonStart} description="Optional">
              <Input
                type="date"
                size="sm"
                value={schedule.seasonStart}
                onChange={(event) => set({ seasonStart: event.target.value })}
              />
            </Field>
            <Field label="End date" labelSize="sm" error={errors?.seasonEnd} description="Optional">
              <Input
                type="date"
                size="sm"
                value={schedule.seasonEnd}
                onChange={(event) => set({ seasonEnd: event.target.value })}
              />
            </Field>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line p-4 text-xs leading-relaxed text-muted">
            Listed dates need no start or end date. Each one sells until it starts, or until the {many} run out.
          </div>
        )}
      </div>

      {seats && schedule.mode !== 'dates' ? (
        <DayCapacity schedule={schedule} set={set} one={seats.one} many={seats.many} />
      ) : null}

      {/* ---------- preview ---------- */}
      <div className="rounded-xl border border-line bg-surface-sunken/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
            <CalendarRange className="size-3.5" aria-hidden="true" />
            {schedule.mode === 'dates' ? 'Every listed date' : 'Next two weeks'}
          </p>
          <div className="flex items-center gap-2">
            <Badge size="sm" variant="neutral">
              <CalendarClock className="size-3" aria-hidden="true" />
              {totalDepartures} {countLabel}
            </Badge>
            <Badge size="sm" variant="primary">
              <Users className="size-3" aria-hidden="true" />
              {unlimited ? `No ${seats?.one ?? 'seat'} limit` : `${totalSeats} ${many}`}
            </Badge>
          </div>
        </div>

        {preview.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            {schedule.mode === 'dates'
              ? 'No dates yet — add the first one above.'
              : schedule.mode === 'hours'
                ? 'Nothing open yet — pick at least one day.'
                : 'This rule generates nothing yet — pick at least one weekday and one start time.'}
          </p>
        ) : (
          <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
            {preview.map((day) => (
              <li
                key={day.dateKey}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-surface px-3 py-2"
              >
                <span className="w-28 shrink-0 text-[0.8125rem] font-medium">
                  {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(
                    fromDateKey(day.dateKey),
                  )}
                </span>
                {day.open ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-medium text-primary tabular">
                      Open {formatClock(day.open.from)} – {formatClock(day.open.to)}
                    </span>
                    {schedule.entryInterval > 0 ? (
                      <span className="text-xs text-faint">
                        {day.times.length} arrival {day.times.length === 1 ? 'slot' : 'slots'}
                      </span>
                    ) : (
                      <span className="text-xs text-faint">arrive any time</span>
                    )}
                  </span>
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    {day.times.map((time) => (
                      <span
                        key={time}
                        className="rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-medium text-primary tabular"
                      >
                        {formatClock(time)}
                      </span>
                    ))}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-xs text-faint tabular">
                  {day.seats > 0 ? `${day.seats} ${day.seats === 1 ? (seats?.one ?? 'seat') : many}` : 'no limit'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ==========================================================================
   PIECES
   ========================================================================== */

function WeekdayPicker({
  title,
  hint,
  schedule,
  onChange,
  error,
}: {
  title: string
  hint: string
  schedule: DraftSchedule
  onChange: (schedule: DraftSchedule) => void
  error?: string
}) {
  const toggle = (weekday: number) => {
    const next = schedule.weekdays.includes(weekday)
      ? schedule.weekdays.filter((day) => day !== weekday)
      : [...schedule.weekdays, weekday]
    onChange({ ...schedule, weekdays: next })
  }
  return (
    <div>
      <p className="text-[0.8125rem] font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {WEEKDAY_ORDER.map((weekday) => {
          const active = schedule.weekdays.includes(weekday)
          return (
            <button
              key={weekday}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(weekday)}
              className={cn(
                'h-10 min-w-14 rounded-lg border px-3 text-[0.8125rem] font-medium',
                'transition-all duration-200 ease-[var(--ease-out-expo)] active:scale-[0.97]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active
                  ? 'border-primary bg-primary text-on-primary shadow-sm'
                  : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
              )}
            >
              {WEEKDAY_LABEL[weekday]}
            </button>
          )
        })}
      </div>
      {error ? <p className="mt-1.5 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  )
}

function StartTimes({
  schedule,
  onChange,
  error,
}: {
  schedule: DraftSchedule
  onChange: (schedule: DraftSchedule) => void
  error?: string
}) {
  const [timeDraft, setTimeDraft] = React.useState('11:00')

  const addTime = () => {
    if (!/^\d{2}:\d{2}$/.test(timeDraft)) {
      toast.error('Pick a valid start time')
      return
    }
    if (schedule.startTimes.includes(timeDraft)) {
      toast('That time is already on the rule')
      return
    }
    onChange({ ...schedule, startTimes: [...schedule.startTimes, timeDraft].sort() })
  }

  return (
    <div>
      <p className="text-[0.8125rem] font-medium">Start times</p>
      <p className="mt-0.5 text-xs text-muted">Each time becomes its own departure with its own manifest.</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {schedule.startTimes.map((time) => (
          <span
            key={time}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-2.5 text-[0.8125rem] font-medium"
          >
            <Clock className="size-3.5 text-faint" aria-hidden="true" />
            {formatClock(time)}
            <button
              type="button"
              aria-label={`Remove the ${formatClock(time)} departure`}
              onClick={() => onChange({ ...schedule, startTimes: schedule.startTimes.filter((value) => value !== time) })}
              className="grid size-5 place-items-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}

        <span className="flex items-center gap-1.5">
          <Input
            type="time"
            size="sm"
            className="w-32"
            value={timeDraft}
            aria-label="New start time"
            onChange={(event) => setTimeDraft(event.target.value)}
          />
          <Button type="button" variant="secondary" size="sm" leftIcon={<Plus />} onClick={addTime}>
            Add time
          </Button>
        </span>
      </div>
      {error ? <p className="mt-1.5 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  )
}

const LAST_ENTRY_OPTIONS = [
  { value: '0', label: 'Closing' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
]

const ENTRY_OPTIONS = [
  { value: '0', label: 'Any time' },
  { value: '30', label: 'Every 30 min' },
  { value: '60', label: 'Every hour' },
  { value: '120', label: 'Every 2 hours' },
]

function OpenHours({
  schedule,
  set,
  errors,
  rental,
}: {
  schedule: DraftSchedule
  set: (patch: Partial<DraftSchedule>) => void
  errors?: Record<string, string>
  rental?: { hourly: boolean; daily: boolean }
}) {
  const slots = entrySlots(schedule)
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label={rental ? 'Pick up after' : 'Opens'} labelSize="sm" error={errors?.opensAt} description={rental ? 'The first rental can go out.' : undefined}>
          <Input type="time" size="sm" value={schedule.opensAt} onChange={(event) => set({ opensAt: event.target.value })} />
        </Field>
        <Field label={rental ? 'Return before' : 'Closes'} labelSize="sm" error={errors?.closesAt} description={rental ? 'Everything is back by.' : undefined}>
          <Input type="time" size="sm" value={schedule.closesAt} onChange={(event) => set({ closesAt: event.target.value })} />
        </Field>
        {rental ? null : (
        <div className="col-span-2">
          <p className="text-[0.8125rem] font-medium">Last entry before closing</p>
          <Segmented
            className="mt-2"
            size="sm"
            label="Last entry"
            value={String(schedule.lastEntryMinutes)}
            onValueChange={(value: string) => set({ lastEntryMinutes: Number(value) })}
            options={LAST_ENTRY_OPTIONS}
          />
        </div>
        )}
      </div>
      {rental && !rental.hourly ? (
        <p className="self-center rounded-xl bg-surface-sunken/60 px-3.5 py-3 text-xs text-muted">
          Day rentals go out any time after pick-up opens and come back before the return time on the last day.
        </p>
      ) : (
      <div>
        <p className="text-[0.8125rem] font-medium">{rental ? 'Hourly start times' : 'Arrival'}</p>
        <p className="mt-0.5 text-xs text-muted">
          {rental ? 'When an hourly rental can start. The last start leaves time for the fewest hours before the return time.' : 'Any time suits a park or a rental. Slots suit anything with a briefing or a queue.'}
        </p>
        <Segmented
          className="mt-2"
          size="sm"
          label="Arrival"
          value={String(schedule.entryInterval)}
          onValueChange={(value: string) => set({ entryInterval: Number(value) })}
          options={ENTRY_OPTIONS}
        />
        {schedule.entryInterval > 0 ? (
          <p className="mt-2 text-xs text-muted">
            {slots.length} {rental ? 'start' : 'arrival'} {slots.length === 1 ? (rental ? 'time' : 'slot') : rental ? 'times' : 'slots'} a day
            {slots.length > 0 ? `, ${formatClock(slots[0])} to ${formatClock(slots[slots.length - 1])}` : ''}.
          </p>
        ) : null}
      </div>
      )}
    </div>
  )
}

function DateList({
  schedule,
  set,
  error,
}: {
  schedule: DraftSchedule
  set: (patch: Partial<DraftSchedule>) => void
  error?: string
}) {
  const [dateDraft, setDateDraft] = React.useState('')
  const [timeDraft, setTimeDraft] = React.useState('10:00')

  const add = () => {
    if (!dateDraft) {
      toast.error('Pick a date')
      return
    }
    if (!/^\d{2}:\d{2}$/.test(timeDraft)) {
      toast.error('Pick a valid time')
      return
    }
    if (schedule.dates.some((entry) => entry.dateKey === dateDraft && entry.time === timeDraft)) {
      toast('That date and time is already listed')
      return
    }
    const dates = [...schedule.dates, { dateKey: dateDraft, time: timeDraft }].sort((a, b) =>
      a.dateKey === b.dateKey ? a.time.localeCompare(b.time) : a.dateKey.localeCompare(b.dateKey),
    )
    set({ dates })
  }

  return (
    <div>
      <p className="text-[0.8125rem] font-medium">Dates</p>
      <p className="mt-0.5 text-xs text-muted">Add each date and its start time. Add the same date twice for two sessions.</p>

      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <Input type="date" size="sm" className="w-40" value={dateDraft} aria-label="Date" onChange={(event) => setDateDraft(event.target.value)} />
        <Input type="time" size="sm" className="w-32" value={timeDraft} aria-label="Start time" onChange={(event) => setTimeDraft(event.target.value)} />
        <Button type="button" variant="secondary" size="sm" leftIcon={<Plus />} onClick={add}>
          Add date
        </Button>
      </div>

      {schedule.dates.length > 0 ? (
        <ul className="mt-3 flex list-none flex-wrap gap-2 p-0">
          {schedule.dates.map((entry) => (
            <li
              key={`${entry.dateKey}-${entry.time}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pr-1 pl-2.5 text-[0.8125rem] font-medium"
            >
              <CalendarDays className="size-3.5 text-faint" aria-hidden="true" />
              {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(fromDateKey(entry.dateKey))}
              <span className="text-muted">· {formatClock(entry.time)}</span>
              <button
                type="button"
                aria-label={`Remove ${entry.dateKey} at ${formatClock(entry.time)}`}
                onClick={() => set({ dates: schedule.dates.filter((d) => !(d.dateKey === entry.dateKey && d.time === entry.time)) })}
                className="grid size-5 place-items-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="mt-1.5 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  )
}

/* ==========================================================================
   LOCATIONS — which of the business's locations this runs from. With more
   than one, each location opens into its own schedule: days, start times,
   seats and season. How it goes on sale is shared.
   ========================================================================== */

export interface LocationsEditorProps {
  schedule: DraftSchedule
  onChange: (schedule: DraftSchedule) => void
  locations: Location[]
  /** The frozen demo clock, serialised from the server. */
  nowIso: string
  errors?: Record<string, string>
  /** Passed to every location's schedule; seats are the activity's, not the location's. */
  seats?: ScheduleSeats
  rental?: { hourly: boolean; daily: boolean }
  className?: string
}

const ownRule = (schedule: DraftSchedule): DraftSchedule => ({ ...schedule, locations: [] })

export function LocationsEditor({ schedule, onChange, locations, nowIso, errors, seats, rental, className }: LocationsEditorProps) {
  const picked = schedule.locations
  const multi = picked.length > 1
  const [openIds, setOpenIds] = React.useState<string[]>(() => (picked[0] ? [picked[0].locationId] : []))

  const errorsFor = React.useCallback(
    (locationId: string) => {
      const prefix = `location.${locationId}.`
      const out: Record<string, string> = {}
      for (const [key, message] of Object.entries(errors ?? {})) {
        if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message
      }
      return out
    },
    [errors],
  )

  // A location with a problem opens so the operator sees why Continue refused.
  React.useEffect(() => {
    const broken = picked.filter((site) => Object.keys(errorsFor(site.locationId)).length > 0).map((site) => site.locationId)
    if (broken.length > 0) setOpenIds((ids) => Array.from(new Set([...ids, ...broken])))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors])

  const order = new Map(locations.map((site, index) => [site.id, index]))
  const sorted = (list: DraftLocation[]) =>
    [...list].sort((a, b) => (order.get(a.locationId) ?? 0) - (order.get(b.locationId) ?? 0))

  const toggle = (locationId: string, on: boolean) => {
    if (on) {
      // Going from one location to two: the shared rule becomes the first location's own.
      const current = picked.length === 1 ? [{ ...picked[0], schedule: ownRule(schedule) }] : picked
      const seed = picked.length >= 2 ? ownRule(picked[0].schedule) : ownRule(schedule)
      onChange({ ...schedule, locations: sorted([...current, { locationId, schedule: seed }]) })
      setOpenIds((ids) => [...ids, locationId])
      return
    }
    const next = picked.filter((site) => site.locationId !== locationId)
    if (next.length === 1 && picked.length > 1) {
      // Back to one location: its rule becomes the activity's schedule again.
      onChange({ ...next[0].schedule, mode: schedule.mode, locations: next })
    } else {
      onChange({ ...schedule, locations: next })
    }
  }

  const setMode = (mode: ScheduleMode) =>
    onChange({
      ...schedule,
      mode,
      locations: picked.map((site) => ({ ...site, schedule: { ...site.schedule, mode } })),
    })

  const patchSite = (locationId: string, next: DraftSchedule) =>
    onChange({
      ...schedule,
      locations: picked.map((site) =>
        site.locationId === locationId ? { ...site, schedule: { ...next, mode: schedule.mode, locations: [] } } : site,
      ),
    })

  const toggleOpen = (locationId: string) =>
    setOpenIds((ids) => (ids.includes(locationId) ? ids.filter((id) => id !== locationId) : [...ids, locationId]))

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div>
            <p className="text-[0.8125rem] font-medium">Where it runs from</p>
            <p className="mt-0.5 text-xs text-muted">
              Tick every location this runs from. With more than one, open each location to set its own days and times.
              Guests choose a location at checkout and only see its dates and times.
            </p>
          </div>
          <Link href="/dashboard/settings/locations" className="text-xs font-medium text-primary hover:underline">
            Manage locations
          </Link>
        </div>

        {multi ? (
          <div className="mt-4">
            <ModePicker value={schedule.mode} onChange={setMode} hint="Applies at every location." />
          </div>
        ) : null}

        <ul className="mt-4 flex list-none flex-col gap-2 p-0">
          {locations.map((site) => {
            const entry = picked.find((item) => item.locationId === site.id)
            const on = Boolean(entry)
            const expanded = Boolean(entry) && multi && openIds.includes(site.id)
            const siteErrors = errorsFor(site.id)
            const hasErrors = Object.keys(siteErrors).length > 0
            return (
              <li
                key={site.id}
                className={cn(
                  'rounded-xl border transition-colors',
                  hasErrors ? 'border-danger/50' : on ? 'border-primary/40 bg-primary-soft/15' : 'border-line',
                )}
              >
                <div className="flex items-start gap-3 p-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(checked) => toggle(site.id, checked === true)}
                      className="mt-0.5"
                      aria-label={site.name}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                        {site.name}
                        {site.isDefault ? (
                          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted">Default</span>
                        ) : null}
                      </span>
                      <span className="block text-xs text-subtle">{locationAddress(site)}</span>
                      {entry && multi ? (
                        <span className={cn('mt-1 block text-xs', hasErrors ? 'font-medium text-danger' : 'text-muted')}>
                          {hasErrors ? 'Needs attention' : describeSchedule(entry.schedule, seats)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  {entry && multi ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-expanded={expanded}
                      aria-controls={`schedule-${site.id}`}
                      onClick={() => toggleOpen(site.id)}
                      rightIcon={<ChevronDown className={cn('transition-transform duration-200', expanded && 'rotate-180')} />}
                    >
                      {expanded ? 'Hide schedule' : 'Set schedule'}
                    </Button>
                  ) : null}
                </div>

                {entry && expanded ? (
                  <div id={`schedule-${site.id}`} className="border-t border-line-subtle px-3 pt-4 pb-4 sm:px-4">
                    <ScheduleEditor
                      schedule={entry.schedule}
                      onChange={(next) => patchSite(site.id, next)}
                      nowIso={nowIso}
                      errors={siteErrors}
                      showMode={false}
                      seats={seats}
                      rental={rental}
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        {errors?.locations ? <p className="mt-1.5 text-xs font-medium text-danger">{errors.locations}</p> : null}
      </div>
    </div>
  )
}

/* ==========================================================================
   DAILY LIMIT — optional. The most an activity sells on a weekday across
   all its departures, in tickets (guests or units) or in bookings. A day
   left empty has no limit beyond each departure's own seats.
   ========================================================================== */

function DayCapacity({
  schedule,
  set,
  one,
  many,
}: {
  schedule: DraftSchedule
  set: (patch: Partial<DraftSchedule>) => void
  one: string
  many: string
}) {
  const overrides = schedule.dayCapacity ?? {}
  const on = schedule.dayCapacity !== undefined
  const days = WEEKDAY_ORDER.filter((day) => schedule.weekdays.includes(day))
  const unit = schedule.dayLimitUnit ?? 'tickets'
  const word = unit === 'bookings' ? 'bookings' : many
  const [every, setEvery] = React.useState('')

  const setDay = (day: number, value: number) => {
    const next = { ...overrides }
    if (value > 0) next[day] = value
    else delete next[day]
    set({ dayCapacity: next })
  }

  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.8125rem] font-medium">
            Daily limit <span className="font-normal text-subtle">Optional</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {on
              ? `The most ${word} sold on a day, across every departure. Leave a day empty for no limit.`
              : `Each departure sells up to ${one === 'charter' ? 'one group' : `its ${many}`}. Add a cap for the whole day, for example when only one crew is on.`}
          </p>
        </div>
        <Switch
          checked={on}
          onCheckedChange={(checked) => set(checked ? { dayCapacity: {}, dayLimitUnit: unit } : { dayCapacity: undefined })}
          aria-label="Daily limit"
        />
      </div>
      {on ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Segmented
              size="sm"
              label="Count"
              value={unit}
              onValueChange={(value: 'tickets' | 'bookings') => set({ dayLimitUnit: value })}
              options={[
                { value: 'tickets', label: many.charAt(0).toUpperCase() + many.slice(1) },
                { value: 'bookings', label: 'Bookings' },
              ]}
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                size="sm"
                min={1}
                className="w-28"
                value={every}
                placeholder="Every day"
                aria-label="Same limit every day"
                onChange={(event) => setEvery(event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={!(Number(every) > 0)}
                onClick={() => set({ dayCapacity: Object.fromEntries(days.map((day) => [day, Math.floor(Number(every))])) })}
              >
                Apply to all days
              </Button>
              <Button type="button" variant="ghost" size="xs" onClick={() => set({ dayCapacity: {} })}>
                Clear
              </Button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {days.map((day) => {
              const value = overrides[day]
              return (
                <label key={day} className={cn('flex flex-col gap-1 rounded-lg border px-2.5 py-2', value ? 'border-primary/40 bg-primary-soft/20' : 'border-line')}>
                  <span className={cn('text-xs font-semibold', value ? 'text-primary' : 'text-muted')}>{WEEKDAY_LABEL[day]}</span>
                  <Input
                    type="number"
                    size="sm"
                    min={1}
                    value={value || ''}
                    placeholder="None"
                    aria-label={`Most ${word} on ${WEEKDAY_LABEL[day]}`}
                    onChange={(event) => setDay(day, Number.parseInt(event.target.value, 10) || 0)}
                  />
                </label>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
