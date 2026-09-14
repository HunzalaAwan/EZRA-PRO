'use client'

import * as React from 'react'
import { CalendarClock, CalendarRange, Clock, Plus, Users, X } from 'lucide-react'

import { addDays, cn, fromDateKey, toDateKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toaster'

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface DraftSchedule {
  /** 0=Sun … 6=Sat, matching RecurrenceRule in the domain model. */
  weekdays: number[]
  /** "HH:mm", local to the operator's timezone. */
  startTimes: string[]
  capacity: number
  seasonStart: string
  seasonEnd: string
}

/** Mon-first display order — the calendar grid starts on Monday. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY_LABEL: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
}

export function defaultSchedule(nowIso: string): DraftSchedule {
  const today = new Date(nowIso)
  return {
    weekdays: [1, 2, 3, 4, 5, 6, 0],
    startTimes: ['09:00', '13:30'],
    capacity: 16,
    seasonStart: toDateKey(today),
    seasonEnd: toDateKey(addDays(today, 180)),
  }
}

export function formatClock(hhmm: string) {
  const [hours, minutes] = hhmm.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return hhmm
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(
    new Date(2000, 0, 1, hours, minutes),
  )
}

export interface GeneratedDeparture {
  dateKey: string
  weekday: number
  times: string[]
  seats: number
}

/** Exactly what the recurrence rule would put on the calendar. */
export function previewDepartures(
  schedule: DraftSchedule,
  nowIso: string,
  days = 14,
): GeneratedDeparture[] {
  const start = new Date(nowIso)
  const out: GeneratedDeparture[] = []
  const times = [...schedule.startTimes].sort()

  for (let i = 0; i < days; i++) {
    const day = addDays(start, i)
    const key = toDateKey(day)
    if (schedule.seasonStart && key < schedule.seasonStart) continue
    if (schedule.seasonEnd && key > schedule.seasonEnd) continue
    if (!schedule.weekdays.includes(day.getDay())) continue
    if (times.length === 0) continue
    out.push({
      dateKey: key,
      weekday: day.getDay(),
      times,
      seats: times.length * schedule.capacity,
    })
  }
  return out
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

export function ScheduleEditor({
  schedule,
  onChange,
  nowIso,
  errors,
  className,
}: ScheduleEditorProps) {
  const [timeDraft, setTimeDraft] = React.useState('11:00')

  const toggleWeekday = (weekday: number) => {
    const next = schedule.weekdays.includes(weekday)
      ? schedule.weekdays.filter((day) => day !== weekday)
      : [...schedule.weekdays, weekday]
    onChange({ ...schedule, weekdays: next })
  }

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

  const preview = React.useMemo(
    () => previewDepartures(schedule, nowIso),
    [schedule, nowIso],
  )
  const totalDepartures = preview.reduce((acc, day) => acc + day.times.length, 0)
  const totalSeats = preview.reduce((acc, day) => acc + day.seats, 0)

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* ---------- weekdays ---------- */}
      <div>
        <p className="text-[0.8125rem] font-medium">Runs on</p>
        <p className="mt-0.5 text-xs text-muted">
          Departures are generated for every selected day inside the season.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {WEEKDAY_ORDER.map((weekday) => {
            const active = schedule.weekdays.includes(weekday)
            return (
              <button
                key={weekday}
                type="button"
                aria-pressed={active}
                onClick={() => toggleWeekday(weekday)}
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
        {errors?.weekdays ? (
          <p className="mt-1.5 text-xs font-medium text-danger">{errors.weekdays}</p>
        ) : null}
      </div>

      {/* ---------- start times ---------- */}
      <div>
        <p className="text-[0.8125rem] font-medium">Start times</p>
        <p className="mt-0.5 text-xs text-muted">
          Each time becomes its own departure with its own manifest.
        </p>

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
                onClick={() =>
                  onChange({
                    ...schedule,
                    startTimes: schedule.startTimes.filter((value) => value !== time),
                  })
                }
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
        {errors?.startTimes ? (
          <p className="mt-1.5 text-xs font-medium text-danger">{errors.startTimes}</p>
        ) : null}
      </div>

      {/* ---------- capacity + season ---------- */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.8125rem] font-medium">Seats per departure</p>
            <span className="font-display text-sm font-semibold tabular">{schedule.capacity}</span>
          </div>
          <Slider
            className="mt-3"
            min={1}
            max={60}
            step={1}
            value={[schedule.capacity]}
            thumbLabels={['Seats per departure']}
            onValueChange={([capacity]) => onChange({ ...schedule, capacity })}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[8, 12, 16, 24, 40].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChange({ ...schedule, capacity: preset })}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200',
                  schedule.capacity === preset
                    ? 'border-primary/50 bg-primary-soft text-primary'
                    : 'border-line bg-surface text-muted hover:text-foreground',
                )}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Season starts" labelSize="sm" error={errors?.seasonStart}>
            <Input
              type="date"
              size="sm"
              value={schedule.seasonStart}
              onChange={(event) => onChange({ ...schedule, seasonStart: event.target.value })}
            />
          </Field>
          <Field label="Season ends" labelSize="sm" error={errors?.seasonEnd}>
            <Input
              type="date"
              size="sm"
              value={schedule.seasonEnd}
              onChange={(event) => onChange({ ...schedule, seasonEnd: event.target.value })}
            />
          </Field>
        </div>
      </div>

      {/* ---------- preview ---------- */}
      <div className="rounded-xl border border-line bg-surface-sunken/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
            <CalendarRange className="size-3.5" aria-hidden="true" />
            Next two weeks
          </p>
          <div className="flex items-center gap-2">
            <Badge size="sm" variant="neutral">
              <CalendarClock className="size-3" aria-hidden="true" />
              {totalDepartures} departures
            </Badge>
            <Badge size="sm" variant="primary">
              <Users className="size-3" aria-hidden="true" />
              {totalSeats} seats
            </Badge>
          </div>
        </div>

        {preview.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            This rule generates nothing yet — pick at least one weekday and one start time inside
            the season.
          </p>
        ) : (
          <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
            {preview.map((day) => (
              <li
                key={day.dateKey}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-surface px-3 py-2"
              >
                <span className="w-28 shrink-0 text-[0.8125rem] font-medium">
                  {new Intl.DateTimeFormat('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  }).format(fromDateKey(day.dateKey))}
                </span>
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
                <span className="ml-auto shrink-0 text-xs text-faint tabular">
                  {day.seats} seats
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
