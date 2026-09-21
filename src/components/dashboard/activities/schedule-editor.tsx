'use client'

import * as React from 'react'
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Clock,
  DoorOpen,
  Infinity as InfinityIcon,
  Plus,
  Users,
  X,
} from 'lucide-react'

import { addDays, cn, fromDateKey, toDateKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Segmented } from '@/components/ui/segmented'
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

export interface DraftSchedule {
  mode: ScheduleMode
  /** 0=Sun … 6=Sat, matching RecurrenceRule in the domain model. */
  weekdays: number[]
  /** "HH:mm", local to the operator's timezone. Used by `times`. */
  startTimes: string[]
  /** Seats per departure, per day or per date. 0 = no limit. */
  capacity: number
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
        seats: schedule.capacity,
        open: { from: schedule.opensAt, to: schedule.closesAt },
      })
      continue
    }

    if (times.length === 0) continue
    out.push({ dateKey: key, weekday: day.getDay(), times, seats: times.length * schedule.capacity })
  }
  return out
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** One line for the review step. */
export function describeSchedule(schedule: DraftSchedule): string {
  const seats = schedule.capacity > 0 ? `${schedule.capacity} seats` : 'no seat limit'
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
  className?: string
}

export function ScheduleEditor({ schedule, onChange, nowIso, errors, className }: ScheduleEditorProps) {
  const set = (patch: Partial<DraftSchedule>) => onChange({ ...schedule, ...patch })
  const unlimited = schedule.capacity === 0

  const preview = React.useMemo(() => previewDepartures(schedule, nowIso), [schedule, nowIso])
  const totalDepartures = preview.reduce((acc, day) => acc + (day.open ? 1 : day.times.length), 0)
  const totalSeats = preview.reduce((acc, day) => acc + day.seats, 0)

  const countLabel =
    schedule.mode === 'hours' ? 'open days' : schedule.mode === 'dates' ? 'dates' : 'departures'

  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {/* ---------- mode ---------- */}
      <fieldset>
        <legend className="text-[0.8125rem] font-medium">How it goes on sale</legend>
        <p className="mt-0.5 mb-2.5 text-xs text-muted">
          Pick the one that matches how the day actually works. You can change it later.
        </p>
        <RadioGroup
          value={schedule.mode}
          onValueChange={(value) => set({ mode: value as ScheduleMode })}
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
      {schedule.mode === 'hours' ? <OpenHours schedule={schedule} set={set} errors={errors} /> : null}
      {schedule.mode === 'dates' ? <DateList schedule={schedule} set={set} error={errors?.dates} /> : null}

      {/* ---------- capacity + season ---------- */}
      <div className="grid gap-5 sm:grid-cols-2">
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
            Listed dates need no start or end date. Each one sells until it starts, or until the seats run out.
          </div>
        )}
      </div>

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
              {unlimited ? 'No seat limit' : `${totalSeats} seats`}
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
                    <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-primary tabular">
                      Open {formatClock(day.open.from)} – {formatClock(day.open.to)}
                    </span>
                    {schedule.entryInterval > 0 ? (
                      <span className="text-[0.6875rem] text-faint">
                        {day.times.length} arrival {day.times.length === 1 ? 'slot' : 'slots'}
                      </span>
                    ) : (
                      <span className="text-[0.6875rem] text-faint">arrive any time</span>
                    )}
                  </span>
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    {day.times.map((time) => (
                      <span
                        key={time}
                        className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-primary tabular"
                      >
                        {formatClock(time)}
                      </span>
                    ))}
                  </span>
                )}
                <span className="ml-auto shrink-0 text-xs text-faint tabular">
                  {day.seats > 0 ? `${day.seats} seats` : 'no limit'}
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
}: {
  schedule: DraftSchedule
  set: (patch: Partial<DraftSchedule>) => void
  errors?: Record<string, string>
}) {
  const slots = entrySlots(schedule)
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Opens" labelSize="sm" error={errors?.opensAt}>
          <Input type="time" size="sm" value={schedule.opensAt} onChange={(event) => set({ opensAt: event.target.value })} />
        </Field>
        <Field label="Closes" labelSize="sm" error={errors?.closesAt}>
          <Input type="time" size="sm" value={schedule.closesAt} onChange={(event) => set({ closesAt: event.target.value })} />
        </Field>
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
      </div>
      <div>
        <p className="text-[0.8125rem] font-medium">Arrival</p>
        <p className="mt-0.5 text-xs text-muted">
          Any time suits a park or a rental. Slots suit anything with a briefing or a queue.
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
            {slots.length} arrival {slots.length === 1 ? 'slot' : 'slots'} a day
            {slots.length > 0 ? `, ${formatClock(slots[0])} to ${formatClock(slots[slots.length - 1])}` : ''}.
          </p>
        ) : null}
      </div>
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
