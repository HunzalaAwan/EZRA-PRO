'use client'

import * as React from 'react'
import { Copy, Plus, Trash2, X } from 'lucide-react'

import type { ActivitySchedule, WeekdayKey } from '@/types'
import { WEEKDAY_KEYS, clockTime, sortTimes, timesForWeekday } from '@/lib/activity-schedule'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { DAY_SHORT, MON_FIRST, fromMinutes, tintOf, toMinutes } from './schedule-draft'

/* ==========================================================================
   SEASON CARD — one season of the schedule: its name, optional start and
   end dates, and the start times (or opening hours) on each weekday.
   "Same times every day" folds the week into one row. Spots come from Basics.
   ========================================================================== */

const LAST = 23 * 60 + 59
/** The start time after this one: an hour on, or the activity's length on. */
export const nextTime = (time: string | undefined, step = 60) => (time ? fromMinutes(Math.min(LAST, toMinutes(time) + Math.max(15, step))) : '09:00')

/** A start time as a removable chip. */
export function TimeChip({ time, onRemove, note }: { time: string; onRemove?: () => void; note?: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface pr-1 pl-2.5 text-[0.8125rem] font-medium tabular">
      {clockTime(time)}
      {note ? <span className="text-xs font-normal text-subtle">· {note}</span> : null}
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${clockTime(time)}`}
          onClick={onRemove}
          className="grid size-5 place-items-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      ) : (
        <span className="w-1.5" aria-hidden="true" />
      )}
    </span>
  )
}

/**
 * A whole number that can be cleared and retyped: the field keeps what is
 * typed and only passes on a number within range; leaving it puts the last
 * good number back.
 */
export function WholeNumberField({
  value,
  onValue,
  min,
  max,
  ...rest
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type' | 'min' | 'max'> & { value: number; onValue: (value: number) => void; min: number; max: number }) {
  const [text, setText] = React.useState(String(value))
  const [focused, setFocused] = React.useState(false)
  React.useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])
  return (
    <Input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      onFocus={(event) => {
        setFocused(true)
        rest.onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        setText(String(value))
        rest.onBlur?.(event)
      }}
      onChange={(event) => {
        setText(event.target.value)
        const next = Math.floor(Number(event.target.value))
        if (event.target.value !== '' && Number.isFinite(next) && next >= min) onValue(Math.min(max, next))
      }}
    />
  )
}

/** "+ Add": a small popover with a time field. Stays open to add several. */
export function TimeAdder({ onAdd, suggest, ariaLabel = 'Add a start time' }: { onAdd: (time: string) => void; suggest: string; ariaLabel?: string }) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(suggest)
  const add = () => {
    if (!/^\d{2}:\d{2}$/.test(value)) return
    onAdd(value)
    setValue(nextTime(value))
  }
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setValue(suggest)
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="xs" leftIcon={<Plus />} aria-label={ariaLabel}>
          Add
        </Button>
      </PopoverTrigger>
      <PopoverContent width="auto" padding="sm" align="start">
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <Input type="time" size="sm" className="w-32" value={value} aria-label="Start time" autoFocus onChange={(event) => setValue(event.target.value)} />
          <Button type="submit" size="sm">
            Add
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}

/** Seven day buttons, Monday first. */
function DayToggles({ isOn, onToggle, label }: { isOn: (key: WeekdayKey) => boolean; onToggle: (key: WeekdayKey) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1">
      {MON_FIRST.map((key) => {
        const on = isOn(key)
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(key)}
            className={cn(
              'h-8 min-w-11 rounded-lg border px-2 text-xs font-medium transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              on ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
            )}
          >
            {DAY_SHORT[key]}
          </button>
        )
      })}
    </div>
  )
}


export interface SeasonCardProps {
  season: ActivitySchedule
  /** Its place in the list: picks the tint it shares with the calendar. */
  tint: number
  onChange: (next: ActivitySchedule) => void
  onRemove?: () => void
  todayKey: string
  /** Rentals: opening hours read as when rentals can start. */
  rental?: boolean
  errors?: Record<string, string>
  /** Minutes between suggested start times. */
  stepMinutes: number
  /** Shown when the season applies at every location. */
  sharedNote?: string
  /** Opening hours: how long before closing the last start time is (the activity's `closingGapOf`). */
  closingGap?: number
}

export function SeasonCard({ season, tint, onChange, onRemove, todayKey, rental, errors = {}, stepMinutes, sharedNote, closingGap = 0 }: SeasonCardProps) {
  const lists = React.useMemo(() => Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, timesForWeekday(season, key, closingGap)])) as Record<WeekdayKey, string[]>, [season, closingGap])
  const hours = season.mode === 'hours'
  const openKeys = MON_FIRST.filter((key) => (hours ? Boolean(season.hours?.[key]) : lists[key].length > 0))
  const uniform = hours
    ? openKeys.every((key) => season.hours?.[key]?.open === season.hours?.[openKeys[0]]?.open && season.hours?.[key]?.close === season.hours?.[openKeys[0]]?.close)
    : openKeys.every((key) => lists[key].join() === lists[openKeys[0]].join())
  const [splitChosen, setSplit] = React.useState(!uniform)
  // Days that differ always show one row each, so an edit never hides them (a saved edit can arrive after the card is shown).
  const split = splitChosen || !uniform
  // Once shown day by day, it stays that way while the owner edits (it doesn't fold the moment the days match).
  React.useEffect(() => {
    if (!uniform) setSplit(true)
  }, [uniform])
  const ended = Boolean(season.to && season.to < todayKey)
  const dateError = errors[`season.${season.id}.to`]
  const hoursError = errors[`season.${season.id}.hours`]
  const id = React.useId()

  /* ---- start times ---- */
  const setDays = (days: Record<WeekdayKey, string[]>) => onChange({ ...season, days })
  const shared = openKeys.length > 0 ? lists[openKeys[0]] : []
  const withDays = (fn: (key: WeekdayKey, times: string[]) => string[]) =>
    Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, fn(key, lists[key])])) as Record<WeekdayKey, string[]>
  const addShared = (time: string) =>
    setDays(openKeys.length === 0 ? withDays(() => [time]) : withDays((_key, times) => (times.length > 0 ? sortTimes([...times, time]) : times)))
  const removeShared = (time: string) => setDays(withDays((_key, times) => times.filter((entry) => entry !== time)))
  const toggleDay = (key: WeekdayKey) =>
    setDays(withDays((day, times) => (day !== key ? times : times.length > 0 ? [] : shared.length > 0 ? [...shared] : ['09:00'])))
  const copyToOpen = (from: WeekdayKey) => setDays(withDays((_key, times) => (times.length > 0 ? [...lists[from]] : times)))

  /* ---- opening hours ---- */
  const firstHours = openKeys.map((key) => season.hours?.[key]).find(Boolean) ?? { open: '09:00', close: '17:00' }
  const setHours = (next: Record<WeekdayKey, { open: string; close: string } | null>) => onChange({ ...season, hours: next })
  const mapHours = (fn: (key: WeekdayKey, entry: { open: string; close: string } | null) => { open: string; close: string } | null) =>
    Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, fn(key, season.hours?.[key] ?? null)])) as Record<WeekdayKey, { open: string; close: string } | null>
  const every = Math.max(5, Math.floor(season.every ?? 30))
  const sample = openKeys.length > 0 ? lists[openKeys[0]] : []

  return (
    <div className={cn('flex flex-col gap-4 rounded-xl border bg-surface p-4', dateError || hoursError ? 'border-danger/50' : 'border-line')}>
      {/* ---- name and dates ---- */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className={cn('size-2.5 shrink-0 rounded-full', tintOf(tint).dot)} aria-hidden="true" />
          <Input
            size="sm"
            className="w-44"
            value={season.name}
            placeholder={!season.from && !season.to ? 'All year' : 'Season name'}
            aria-label="Season name"
            onChange={(event) => onChange({ ...season, name: event.target.value.slice(0, 40) })}
          />
          {ended ? <Badge size="sm" variant="neutral">Ended</Badge> : null}
          {sharedNote ? <span className="text-xs text-subtle">{sharedNote}</span> : null}
          <div className="ml-auto flex items-center gap-1.5">
            {onRemove ? (
              <IconButton type="button" size="xs" variant="ghost" aria-label={`Remove ${season.name || 'this season'}`} className="text-faint hover:bg-danger-soft hover:text-danger" onClick={onRemove}>
                <Trash2 />
              </IconButton>
            ) : null}
          </div>
        </div>
        {/* Both optional: no start date runs from today, no end date keeps going. */}
        <div className="flex flex-wrap items-end gap-3 pl-5">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              Start date <span className="text-faint">Optional</span>
            </span>
            <Input type="date" size="sm" className="w-40" value={season.from ?? ''} onChange={(event) => onChange({ ...season, from: event.target.value || null })} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted">
              End date <span className="text-faint">Optional</span>
            </span>
            <Input type="date" size="sm" className="w-40" value={season.to ?? ''} min={season.from ?? undefined} error={Boolean(dateError)} onChange={(event) => onChange({ ...season, to: event.target.value || null })} />
          </label>
          {dateError ? <span className="pb-2 text-xs font-medium text-danger">{dateError}</span> : null}
        </div>
      </div>

      {/* ---- the week ---- */}
      <div className="flex flex-col gap-2.5 border-t border-line-subtle pt-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.8125rem] font-medium">{hours ? (rental ? 'Rentals start between' : 'Opening hours') : 'Start times'}</p>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-muted">
            {hours ? 'Same hours every day' : 'Same times every day'}
            <Switch
              size="sm"
              checked={!split}
              onCheckedChange={(same) => {
                setSplit(!same)
                if (!same) return
                // Folding the week: every open day takes the first open day's times or hours.
                if (hours) setHours(mapHours((_key, entry) => (entry ? { ...firstHours } : null)))
                else setDays(withDays((_key, times) => (times.length > 0 ? [...shared] : [])))
              }}
              aria-label={hours ? 'Same hours every day' : 'Same times every day'}
            />
          </label>
        </div>

        {!hours && !split ? (
          <div className="flex flex-col gap-2.5">
            <DayToggles label="Days it runs" isOn={(key) => lists[key].length > 0} onToggle={toggleDay} />
            <div className="flex flex-wrap items-center gap-1.5">
              {shared.length === 0 ? <span className="text-xs text-faint">No start times yet</span> : shared.map((time) => <TimeChip key={time} time={time} onRemove={() => removeShared(time)} />)}
              <TimeAdder onAdd={addShared} suggest={nextTime(shared[shared.length - 1], stepMinutes)} />
            </div>
          </div>
        ) : null}

        {!hours && split ? (
          <ul className="flex list-none flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle p-0">
            {MON_FIRST.map((key) => {
              const times = lists[key]
              return (
                <li key={key} className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                  <span className="w-10 shrink-0 text-xs font-semibold text-muted">{DAY_SHORT[key]}</span>
                  {times.length === 0 ? <span className="text-xs text-faint">Closed</span> : null}
                  {times.map((time) => (
                    <TimeChip key={time} time={time} onRemove={() => setDays({ ...withDays((_day, list) => list), [key]: times.filter((entry) => entry !== time) })} />
                  ))}
                  <TimeAdder
                    ariaLabel={`Add a start time on ${DAY_SHORT[key]}`}
                    onAdd={(time) => setDays({ ...withDays((_day, list) => list), [key]: sortTimes([...times, time]) })}
                    suggest={nextTime(times[times.length - 1], stepMinutes)}
                  />
                  {times.length > 0 && openKeys.length > 1 ? (
                    <IconButton
                      type="button"
                      size="xs"
                      variant="ghost"
                      className="ml-auto text-faint"
                      aria-label={`Use ${DAY_SHORT[key]}'s times on every open day`}
                      title={`Use ${DAY_SHORT[key]}'s times on every open day`}
                      onClick={() => copyToOpen(key)}
                    >
                      <Copy />
                    </IconButton>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}

        {hours && !split ? (
          <div className="flex flex-col gap-2.5">
            <DayToggles
              label="Days it opens"
              isOn={(key) => Boolean(season.hours?.[key])}
              onToggle={(key) => setHours(mapHours((day, entry) => (day !== key ? entry : entry ? null : { ...firstHours })))}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Input type="time" size="sm" className="w-32" value={firstHours.open} aria-label={rental ? 'From' : 'Opens'} error={Boolean(hoursError)} onChange={(event) => setHours(mapHours((_key, entry) => (entry ? { ...entry, open: event.target.value } : null)))} />
              <span className="text-xs text-subtle">to</span>
              <Input type="time" size="sm" className="w-32" value={firstHours.close} aria-label={rental ? 'Until' : 'Closes'} error={Boolean(hoursError)} onChange={(event) => setHours(mapHours((_key, entry) => (entry ? { ...entry, close: event.target.value } : null)))} />
            </div>
          </div>
        ) : null}

        {hours && split ? (
          <ul className="flex list-none flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle p-0">
            {MON_FIRST.map((key) => {
              const entry = season.hours?.[key] ?? null
              return (
                <li key={key} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className="w-10 shrink-0 text-xs font-semibold text-muted">{DAY_SHORT[key]}</span>
                  <Switch size="sm" checked={Boolean(entry)} aria-label={`Open on ${DAY_SHORT[key]}`} onCheckedChange={(on) => setHours(mapHours((day, current) => (day !== key ? current : on ? { ...firstHours } : null)))} />
                  {entry ? (
                    <>
                      <Input type="time" size="sm" className="w-28" value={entry.open} aria-label={`Opens on ${DAY_SHORT[key]}`} onChange={(event) => setHours(mapHours((day, current) => (day === key && current ? { ...current, open: event.target.value } : current)))} />
                      <span className="text-xs text-subtle">to</span>
                      <Input type="time" size="sm" className="w-28" value={entry.close} aria-label={`Closes on ${DAY_SHORT[key]}`} onChange={(event) => setHours(mapHours((day, current) => (day === key && current ? { ...current, close: event.target.value } : current)))} />
                    </>
                  ) : (
                    <span className="text-xs text-faint">Closed</span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}

        {hours ? (
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={`${id}-every`} className="text-xs text-muted">
              A start time every
            </label>
            <WholeNumberField id={`${id}-every`} size="sm" min={5} max={240} step={5} className="w-24" suffix="min" value={every} onValue={(next) => onChange({ ...season, every: next })} />
            <span className="text-xs text-subtle">
              {sample.length === 0 ? 'No start times yet' : `${sample.length} a day, ${clockTime(sample[0])} to ${clockTime(sample[sample.length - 1])}`}
            </span>
          </div>
        ) : null}
        {hoursError ? <p className="text-xs font-medium text-danger">{hoursError}</p> : null}
      </div>

    </div>
  )
}
