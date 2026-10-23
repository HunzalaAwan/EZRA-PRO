'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarRange, Check, Plus, TriangleAlert } from 'lucide-react'

import type { ActivityKind, ActivitySchedule, Location, WeekdayKey } from '@/types'
import {
  addMonthsKey,
  bookingWindowEnd,
  bookingWindowMonths,
  clockTime,
  closingGapOf,
  defaultSpots,
  describeSchedules,
  expandDays,
  expandSchedules,
  scheduleContextOf,
  scheduleImpact,
  shiftDayKey,
  timesForWeekday,
  weekdaySpotsOf,
  type ScheduleSource,
  type ScheduledDay,
} from '@/lib/activity-schedule'
import { holidayCountryOf, holidaysBetween, HOLIDAY_COUNTRIES } from '@/lib/holidays'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { cn, formatNumber, fromDateKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { BeforeInput } from './changes-policy-editor'
import { SeasonCard, WholeNumberField } from './season-card'
import { YearCalendar, type CalendarAction, type DayNumbers } from './year-calendar'
import { ScheduleChangesList } from './schedule-changes-list'
import {
  addTimeOn,
  allYearSeason,
  closeDays,
  dayReason,
  freshId,
  isCalendarCancel,
  openDay,
  removeTimeOn,
  runAnyway,
  scheduleSourceOf,
  seasonFromTemplate,
  seasonsAt,
  seasonsWarning,
  setCapacityOn,
  setDayReason,
  withMode,
  type PickMode,
  type ScheduleDraft,
} from './schedule-draft'

/* ==========================================================================
   SCHEDULE STEP — when an activity runs, for the whole year. Top to bottom:
   a one-line summary, where it runs from, how guests pick a time, the
   regular times (the first season, shown without a name), the capacity
   (how many each time slot takes, and on which weekdays that differs), the
   seasons that change the times for part of the year, the year calendar
   (day-by-day changes, spots and extra spots included),
   the list of closed days and changes with public holidays, and the booking
   window and cut-off. Booked time slots an edit drops are never removed;
   one line says so.
   ========================================================================== */

/** A time slot that already has bookings: kept whatever the schedule says. */
export interface BookedSlot {
  id: string
  startsAt: string
  booked: number
  locationId?: string
  status?: string
}

/** What the engine needs about the activity itself, beside the schedule fields. */
export type ScheduleBase = Omit<ScheduleSource, 'schedules' | 'scheduleChanges' | 'runsOnClosures' | 'bookingWindow' | 'noticeHours'>

export interface ScheduleStepProps {
  value: ScheduleDraft
  onChange: (patch: Partial<ScheduleDraft>) => void
  /** Ticking a location: the new list, with the seasons and changes that go with it. */
  onLocations: (locationIds: string[], patch: Partial<ScheduleDraft>) => void
  base: ScheduleBase
  kind: ActivityKind
  /** The business's locations. */
  locations: Location[]
  pickedLocationIds: string[]
  /** The demo clock, local ISO. */
  nowIso: string
  tenantSlug: string
  /** The schedule as it was when the editor opened, and its booked time slots. */
  baseline?: ScheduleSource
  bookedSlots?: BookedSlot[]
  errors: Record<string, string>
  /** Request or call with no set schedule: only where it runs from is asked. */
  unscheduled?: boolean
  onBookingStep?: () => void
  /** Day rentals: when they go out and come back. */
  rentalDay?: { pickup: string; ret: string; onChange: (pickup: string, ret: string) => void }
  /** Southern hemisphere: summer is December. Only the season templates read it, and a new season now always starts next month. */
  southern?: boolean
  /**
   * The capacity: its box (shown after the regular times) and how the
   * calendar reads a day's numbers. Absent: the calendar shows the spots the
   * schedule gives, with no extra spots.
   */
  capacity?: ScheduleCapacity
}

/** How many each time slot takes, as the Booking step shows and changes it. */
export interface ScheduleCapacity {
  /** The capacity box: the usual numbers and the weekdays that differ. */
  box: React.ReactNode
  /** "Spots", "Group size", "Items out", "Tickets". */
  label: string
  /** A day's usual numbers before a change for that date: its weekday's own, or the usual ones. */
  usualOn: (dateKey: string) => DayNumbers
  /** The usual numbers, before any weekday's own: days with other numbers get a corner mark. */
  plain: DayNumbers
  /** Extra spots can be set per day: the kind sells them. */
  showExtra: boolean
  /** A private activity: a day's spots are its group's size. */
  privateGroup?: boolean
  /** The most a day's spots can be (a rental: its stock). */
  most?: number
}

/** Words only (they fit a phone without icons); the line under the control says what the picked one does. */
const MODE_OPTIONS: { value: PickMode; label: string }[] = [
  { value: 'times', label: 'Specific times' },
  { value: 'hours', label: 'All day' },
  { value: 'dates', label: 'Specific dates' },
]
const MODE_HINT: Record<PickMode, string> = {
  times: 'Guests pick one of your start times.',
  hours: 'Guests pick any start time while you are open.',
  dates: 'It runs only on the days you add on the calendar.',
}

const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export function ScheduleStep({
  value,
  onChange,
  onLocations,
  base,
  kind,
  locations,
  pickedLocationIds,
  nowIso,
  tenantSlug,
  baseline,
  bookedSlots = [],
  errors,
  unscheduled = false,
  onBookingStep,
  rentalDay,
  southern = false,
  capacity,
}: ScheduleStepProps) {
  const todayKey = nowIso.slice(0, 10)
  const fieldId = React.useId()
  const { defaults } = useBookingDefaults(tenantSlug)
  const ctx = React.useMemo(() => scheduleContextOf(defaults), [defaults])
  const multi = pickedLocationIds.length > 1
  const [chosen, setChosen] = React.useState<string | undefined>(pickedLocationIds[0])
  const active = multi ? (chosen && pickedLocationIds.includes(chosen) ? chosen : pickedLocationIds[0]) : undefined
  const primary = base.locations[0]?.locationId

  const source = React.useMemo(() => scheduleSourceOf(value, base), [value, base])
  const yearEnd = shiftDayKey(addMonthsKey(todayKey, 12), -1)
  const monthStart = `${todayKey.slice(0, 7)}-01`
  const calendarEnd = shiftDayKey(addMonthsKey(monthStart, 12), -1)
  const windowEnd = bookingWindowEnd(source, todayKey, defaults.maxAdvanceDays)
  const defaultMonths = bookingWindowMonths({}, defaults.maxAdvanceDays)
  const defaultDays = Math.max(0, Math.floor(defaults.maxAdvanceDays))
  const defaultWindow = `${formatNumber(defaultDays)} ${defaultDays === 1 ? 'day' : 'days'}`

  const summary = React.useMemo(() => describeSchedules(source, { maxAdvanceDays: defaults.maxAdvanceDays, todayKey }), [source, defaults.maxAdvanceDays, todayKey])
  // Every time slot the schedule gives in the next 12 months (still to start today onwards), whatever the booking window.
  const slotCount = React.useMemo(() => {
    if (unscheduled) return 0
    const clock = nowIso.slice(11, 16)
    return expandSchedules(source, todayKey, yearEnd, ctx).filter((slot) => slot.dateKey > todayKey || slot.time >= clock).length
  }, [source, todayKey, yearEnd, ctx, nowIso, unscheduled])
  const days = React.useMemo(() => expandDays(source, monthStart, calendarEnd, { ...ctx, locationId: active }), [source, monthStart, calendarEnd, ctx, active])
  const dayMap = React.useMemo(() => new Map(days.map((day) => [day.dateKey, day])), [days])
  const impacted = React.useMemo(() => (baseline && bookedSlots.length > 0 ? scheduleImpact(baseline, source, bookedSlots, ctx) : []), [baseline, source, bookedSlots, ctx])

  const booked = React.useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const slot of bookedSlots) {
      if (slot.booked <= 0 || slot.status === 'cancelled') continue
      if (multi && (slot.locationId ?? primary) !== active) continue
      const dateKey = slot.startsAt.slice(0, 10)
      const time = slot.startsAt.slice(11, 16)
      const row = map.get(dateKey) ?? new Map<string, number>()
      row.set(time, (row.get(time) ?? 0) + slot.booked)
      map.set(dateKey, row)
    }
    return map
  }, [bookedSlots, multi, active, primary])

  const shownSeasons = seasonsAt(value.schedules, active)
  const warning = value.scheduleMode === 'dates' ? null : seasonsWarning(shownSeasons, todayKey)
  const basicsSpots = defaultSpots(source)
  const privateGroup = Boolean(capacity?.privateGroup)
  const showSpots = Boolean(capacity) || kind !== 'charter'
  const showExtra = Boolean(capacity?.showExtra)
  const closingGap = closingGapOf(base)
  const stepMinutes = Math.max(30, Math.min(240, base.durationMinutes || 60))
  const firstTime = shownSeasons.map((season) => (['1', '2', '3', '4', '5', '6', '0'] as WeekdayKey[]).map((key) => timesForWeekday(season, key, closingGap)).find((times) => times.length > 0)?.[0]).find(Boolean)

  /* ---- calendar edits ---- */
  const seasonOf = (day: ScheduledDay | undefined) => (day?.scheduleId ? value.schedules.find((season) => season.id === day.scheduleId) : undefined)
  const seasonTimesFor = (day: ScheduledDay | undefined) => {
    const season = seasonOf(day)
    return season && day ? timesForWeekday(season, String(fromDateKey(day.dateKey).getDay()) as WeekdayKey, closingGap) : []
  }
  /**
   * A day's usual numbers, before a change for that date: its weekday's own,
   * a season's spots (older saves), or the usual ones. A private group's size
   * has no season of its own.
   */
  const usualOn = (dateKey: string): DayNumbers => {
    const usual = capacity?.usualOn(dateKey) ?? { spots: basicsSpots, extra: 0 }
    if (privateGroup || weekdaySpotsOf(source, fromDateKey(dateKey).getDay()) !== undefined) return usual
    return { spots: seasonOf(dayMap.get(dateKey))?.capacity ?? usual.spots, extra: usual.extra }
  }
  /** A time slot's numbers: its spots (a private group: its size) and its extra spots, its own or the day's usual ones. */
  const numbersOfSlot = (slot: ScheduledDay['slots'][number]): DayNumbers => {
    const usual = usualOn(slot.dateKey)
    return { spots: privateGroup ? (slot.groupSize ?? usual.spots) : slot.capacity, extra: showExtra ? (slot.extraSpots ?? usual.extra) : 0 }
  }
  const numbersFor = (day: ScheduledDay | undefined, dateKey: string): DayNumbers => (day?.slots[0] ? numbersOfSlot(day.slots[0]) : usualOn(dateKey))
  const plain = capacity?.plain ?? { spots: basicsSpots, extra: 0 }
  /** Days whose time slots have other numbers than the usual ones (a weekday's own or a date's). */
  const differs = (day: ScheduledDay) =>
    plain.spots > 0 &&
    day.slots.some((slot) => {
      const numbers = numbersOfSlot(slot)
      return numbers.spots !== plain.spots || (showExtra && numbers.extra !== plain.extra)
    })
  const spotsKey = privateGroup ? 'groupSize' : 'spots'
  const act = (action: CalendarAction) => {
    const changes = value.scheduleChanges
    let next = changes
    if (action.type === 'add') {
      // Across several days, closed ones stay closed; one day on its own can be opened.
      next = addTimeOn(changes, action.dates, action.time, active, new Set(action.dates.filter((dateKey) => dayMap.get(dateKey)?.closed)))
      // A reason typed in the panel first goes on the change the edit made.
      if (action.reason && next !== changes) {
        if (action.dates.length === 1) next = setDayReason(next, action.dates[0], action.reason, active)
        else if (next.length > changes.length) next = [...next.slice(0, -1), { ...next[next.length - 1], reason: action.reason.trim() }]
      }
    } else if (action.type === 'remove') next = removeTimeOn(changes, action.dateKey, action.time, action.changeId, active)
    else if (action.type === 'close') next = closeDays(changes, action.dates, action.reason, active)
    else if (action.type === 'open') next = openDay(changes, action.dateKey, active)
    else if (action.type === 'run') {
      next = runAnyway(changes, action.dateKey, seasonTimesFor(dayMap.get(action.dateKey)), active)
      if (action.reason && next !== changes) next = setDayReason(next, action.dateKey, action.reason, active)
    } else if (action.type === 'capacity') {
      // Only the number given changes; the other stays as each day has it.
      next = setCapacityOn(changes, action.dates, (_dateKey, now) => ({ spots: action.spots ?? now.spots, extra: action.extra ?? now.extra }), usualOn, active, spotsKey)
      if (action.reason && next !== changes && action.dates.length === 1) next = setDayReason(next, action.dates[0], action.reason, active)
    } else if (action.type === 'capacity-usual') next = setCapacityOn(changes, action.dates, () => ({}), usualOn, active, spotsKey)
    else if (action.type === 'reason') next = setDayReason(changes, action.dateKey, action.reason, active)
    if (next !== changes) onChange({ scheduleChanges: next })
  }

  /* ---- how guests pick a time ---- */
  // Switching and straight back gives the seasons back as they were, not converted twice.
  const lastSwitch = React.useRef<{ from: PickMode; before: ActivitySchedule[]; after: ActivitySchedule[] } | null>(null)
  const switchMode = (mode: PickMode) => {
    if (mode === value.scheduleMode) return
    const undo = lastSwitch.current
    if (undo && undo.from === mode && undo.after === value.schedules) {
      lastSwitch.current = null
      onChange({ scheduleMode: mode, schedules: undo.before })
      return
    }
    const next = withMode(value, mode, kind === 'activity' ? 30 : 60, closingGapOf(base))
    lastSwitch.current = { from: value.scheduleMode, before: value.schedules, after: next.schedules }
    onChange(next)
  }

  /* ---- regular times and seasons ---- */
  // The first season here is the regular times; the ones after it are seasons, and a later one wins where they overlap.
  const regular = shownSeasons[0]
  const extraSeasons = shownSeasons.slice(1)
  const updateSeason = (id: string, next: ScheduleDraft['schedules'][number]) => onChange({ schedules: value.schedules.map((season) => (season.id === id ? next : season)) })
  const removeSeason = (id: string) => onChange({ schedules: value.schedules.filter((season) => season.id !== id) })
  // A new season starts next month with the regular times, ready to change.
  const addSeason = () => onChange({ schedules: [...value.schedules, seasonFromTemplate('blank', regular, todayKey, southern, active)] })
  // A location with no times of its own yet gets regular times to fill in.
  const addRegular = () =>
    onChange({ schedules: [...value.schedules, { ...allYearSeason(value.scheduleMode === 'hours' ? 'hours' : 'times'), id: freshId('season'), ...(active ? { locationId: active } : {}) }] })

  /* ---- locations ---- */
  const toggleLocation = (locationId: string) => {
    const on = pickedLocationIds.includes(locationId)
    const order = locations.map((site) => site.id)
    const next = on ? pickedLocationIds.filter((id) => id !== locationId) : [...pickedLocationIds, locationId].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    let schedules = value.schedules
    let scheduleChanges = value.scheduleChanges
    if (!on && pickedLocationIds.length === 1) {
      // One location to two: the seasons and changes so far are the first location's; the new one starts with a copy of each.
      const first = pickedLocationIds[0]
      const own = schedules.map((season) => ({ ...season, locationId: season.locationId ?? first }))
      schedules = [...own, ...own.filter((season) => season.locationId === first).map((season) => ({ ...season, id: freshId('season'), locationId }))]
      const ownChanges = scheduleChanges.map((change) => (change.locationId ? change : { ...change, locationId: first }))
      // A time slot cancelled on the calendar ran from the first location only.
      scheduleChanges = [...ownChanges, ...ownChanges.filter((change) => change.locationId === first && !isCalendarCancel(change)).map((change) => ({ ...change, id: freshId('chg'), locationId }))]
    } else if (!on && pickedLocationIds.length > 1) {
      const from = active ?? pickedLocationIds[0]
      schedules = [...schedules, ...schedules.filter((season) => season.locationId === from).map((season) => ({ ...season, id: freshId('season'), locationId }))]
      scheduleChanges = [...scheduleChanges, ...scheduleChanges.filter((change) => change.locationId === from && !isCalendarCancel(change)).map((change) => ({ ...change, id: freshId('chg'), locationId }))]
    } else if (on) {
      schedules = schedules.filter((season) => season.locationId !== locationId)
      // That location's own changes go with it (the others have their copies); a time slot cancelled on the calendar stays cancelled.
      scheduleChanges = scheduleChanges.filter((change) => change.locationId !== locationId || isCalendarCancel(change))
      if (next.length === 1) {
        // Back to one location: nothing needs a location any more, but a cancellation from elsewhere keeps its own.
        schedules = schedules.map(({ locationId: _drop, ...season }) => season)
        scheduleChanges = scheduleChanges.map((change) => {
          if (isCalendarCancel(change) && change.locationId && change.locationId !== next[0]) return change
          const { locationId: _drop, ...rest } = change
          return rest
        })
      }
      if (next.length === 0) {
        schedules = value.schedules
        scheduleChanges = value.scheduleChanges
      }
    }
    if (!on) setChosen(locationId)
    onLocations(next, { schedules, scheduleChanges })
  }

  /* ---- closed days and holidays ---- */
  const holidayCountry = defaults.holidays?.enabled ? holidayCountryOf(defaults.holidays.country) : undefined
  const holidays = React.useMemo(
    () =>
      holidayCountry
        ? { country: HOLIDAY_COUNTRIES.find((entry) => entry.code === holidayCountry)?.name ?? holidayCountry, days: [...holidaysBetween(holidayCountry, todayKey, yearEnd)].map(([dateKey, name]) => ({ dateKey, name })) }
        : null,
    [holidayCountry, todayKey, yearEnd],
  )
  const closures = React.useMemo(
    () => (defaults.closures ?? []).flatMap((closure) => closure.dates.filter((dateKey) => dateKey >= todayKey && dateKey <= yearEnd).map((dateKey) => ({ dateKey, reason: closure.reason }))),
    [defaults.closures, todayKey, yearEnd],
  )
  const locationName = (locationId: string | undefined) => (multi ? (locationId ? (locations.find((site) => site.id === locationId)?.name ?? null) : 'Every location') : null)

  // With several locations, name every one still missing a start time (the others may be on another tab).
  const missingAt = multi ? pickedLocationIds.filter((id) => errors[`times.${id}`]) : []
  const timesError =
    errors.times ??
    (missingAt.length > 0 ? `Add a start time at ${missingAt.map((id) => locations.find((site) => site.id === id)?.name ?? 'every location').join(' and ')}` : undefined)
  const pickable = locations.length > 1 || (locations.length > 0 && pickedLocationIds.length === 0)

  return (
    <div className="flex flex-col gap-7">
      {/* ---- 1. summary ---- */}
      <div className="rounded-xl border border-line bg-surface-sunken/50 px-4 py-3">
        <p className="flex items-start gap-2 text-sm font-medium text-foreground">
          <CalendarRange className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {unscheduled ? 'No set schedule: each booking is arranged with the guest.' : summary}
        </p>
        {unscheduled ? (
          onBookingStep ? (
            <button type="button" onClick={onBookingStep} className="mt-1 pl-6 text-xs font-medium text-primary hover:underline">
              Change on the Booking step
            </button>
          ) : null
        ) : (
          <p className="mt-1 pl-6 text-xs text-subtle">
            {formatNumber(slotCount)} {slotCount === 1 ? 'time slot' : 'time slots'} in the next 12 months
          </p>
        )}
        {impacted.length > 0 ? <BookedWarning slots={impacted} /> : null}
      </div>

      {/* ---- where it runs from ---- */}
      {pickable ? (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[0.8125rem] font-medium">Runs from</p>
            <Link href="/dashboard/settings/locations" className="text-xs font-medium text-primary hover:underline">
              Manage locations
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {locations.map((site) => {
              const on = pickedLocationIds.includes(site.id)
              return (
                <button
                  key={site.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleLocation(site.id)}
                  className={cn(
                    'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[0.8125rem] font-medium transition-colors duration-150',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    on ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
                  )}
                >
                  {on ? <Check className="size-3.5" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
                  {site.name}
                </button>
              )
            })}
          </div>
          {errors.locations ? <p className="text-xs font-medium text-danger">{errors.locations}</p> : null}
        </div>
      ) : errors.locations ? (
        // No locations to pick from yet: say where to add one.
        <p className="text-xs font-medium text-danger">
          Add the place it runs from first.{' '}
          <Link href="/dashboard/settings/locations" className="text-primary hover:underline">
            Add a location
          </Link>
        </p>
      ) : null}

      {unscheduled && capacity ? capacity.box : null}

      {unscheduled ? null : (
        <>
          {/* ---- 2. how guests pick a time ---- */}
          <div className="flex flex-col gap-2">
            <p className="text-[0.8125rem] font-medium">How guests pick a time</p>
            <Segmented label="How guests pick a time" className="max-w-full self-start overflow-x-auto" value={value.scheduleMode} onValueChange={switchMode} options={MODE_OPTIONS} />
            <p className="text-xs text-subtle">{MODE_HINT[value.scheduleMode]}</p>
            {rentalDay ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted">Day rentals go out after</span>
                <Input type="time" size="sm" className="w-32" value={rentalDay.pickup} aria-label="Pick up after" onChange={(event) => rentalDay.onChange(event.target.value, rentalDay.ret)} />
                <span className="text-xs text-muted">and come back before</span>
                <Input type="time" size="sm" className="w-32" value={rentalDay.ret} aria-label="Return before" onChange={(event) => rentalDay.onChange(rentalDay.pickup, event.target.value)} />
              </div>
            ) : null}
          </div>

          {/* ---- 3. regular times, then the seasons ---- */}
          {value.scheduleMode === 'dates' ? null : (
            <section className="flex flex-col gap-3">
              {multi ? (
                <Segmented
                  label="Location"
                  className="max-w-full self-start overflow-x-auto"
                  value={active ?? pickedLocationIds[0]}
                  onValueChange={setChosen}
                  options={pickedLocationIds.map((id) => ({ value: id, label: locations.find((site) => site.id === id)?.name ?? 'Location' }))}
                />
              ) : null}
              {regular ? (
                <SeasonCard
                  key={regular.id}
                  season={regular}
                  regular
                  tint={0}
                  onChange={(next) => updateSeason(regular.id, next)}
                  todayKey={todayKey}
                  rental={kind === 'rental'}
                  errors={errors}
                  stepMinutes={stepMinutes}
                  closingGap={closingGap}
                  sharedNote={multi && !regular.locationId ? 'Every location' : undefined}
                />
              ) : (
                <button type="button" onClick={addRegular} className="rounded-xl border border-dashed border-line px-4 py-3 text-left text-sm text-muted hover:border-line-strong">
                  {value.scheduleMode === 'hours' ? 'No hours here yet. Add them.' : 'No start times here yet. Add them.'}
                </button>
              )}
              {timesError ? <p className="text-xs font-medium text-danger">{timesError}</p> : null}

              {/* ---- how many each time slot takes ---- */}
              {capacity ? <div className="mt-3">{capacity.box}</div> : null}

              <div className="mt-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Seasons</h3>
                    <p className="mt-0.5 text-xs text-muted">{value.scheduleMode === 'hours' ? 'Different hours' : 'Different times'} for part of the year, like summer.</p>
                  </div>
                  <Button type="button" variant="secondary" size="xs" leftIcon={<Plus />} onClick={addSeason}>
                    Add a season
                  </Button>
                </div>
                {warning ? (
                  <p className="flex items-start gap-1.5 text-xs text-muted">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
                    {warning}
                  </p>
                ) : null}
                {extraSeasons.map((season, index) => (
                  <SeasonCard
                    key={season.id}
                    season={season}
                    tint={index + 1}
                    onChange={(next) => updateSeason(season.id, next)}
                    onRemove={() => removeSeason(season.id)}
                    todayKey={todayKey}
                    rental={kind === 'rental'}
                    errors={errors}
                    stepMinutes={stepMinutes}
                    closingGap={closingGap}
                    sharedNote={multi && !season.locationId ? 'Every location' : undefined}
                  />
                ))}
              </div>
            </section>
          )}

          {/* With specific dates there are no regular times: the capacity comes before the year. */}
          {value.scheduleMode === 'dates' && capacity ? capacity.box : null}

          {/* ---- 4. the year ---- */}
          <section className="flex flex-col gap-3">
            {multi && value.scheduleMode === 'dates' ? (
              <Segmented
                label="Location"
                className="max-w-full self-start overflow-x-auto"
                value={active ?? pickedLocationIds[0]}
                onValueChange={setChosen}
                options={pickedLocationIds.map((id) => ({ value: id, label: locations.find((site) => site.id === id)?.name ?? 'Location' }))}
              />
            ) : null}
            <div>
              <h3 className="text-sm font-semibold">Your year</h3>
              <p className="mt-0.5 text-xs text-muted">
                {value.scheduleMode === 'dates' ? 'Click a day to add a start time.' : 'Click a day to change just that day.'}
                {/* Shift-click needs a keyboard; on a phone, "Add closed days" below picks a run of days. */}
                <span className="hidden sm:inline"> Shift-click to pick a run of days.</span>
              </p>
            </div>
            <div className="rounded-xl border border-line bg-surface p-4">
              <YearCalendar
                days={days}
                seasons={shownSeasons}
                mode={value.scheduleMode}
                todayKey={todayKey}
                windowEndKey={windowEnd}
                booked={booked}
                numbersFor={numbersFor}
                usualFor={usualOn}
                differs={differs}
                showExtra={showExtra}
                wholeDay={kind === 'pass'}
                floor={!privateGroup}
                mostSpots={capacity?.most}
                showSpots={showSpots}
                spotsLabel={capacity?.label ?? (kind === 'rental' ? 'Items' : kind === 'pass' ? 'Tickets' : 'Spots')}
                reasonFor={(dateKey) => dayReason(value.scheduleChanges, dateKey, active)}
                seasonTimesFor={seasonTimesFor}
                onAction={act}
                suggestTime={firstTime ?? '10:00'}
              />
            </div>
          </section>

          {/* ---- 5. closed days and changes ---- */}
          <ScheduleChangesList
            changes={value.scheduleChanges.filter((change) => !active || !change.locationId || change.locationId === active)}
            mode={value.scheduleMode}
            todayKey={todayKey}
            spotWord={kind === 'rental' ? 'items' : kind === 'pass' ? 'tickets' : 'spots'}
            locationName={locationName}
            onRemove={(id) => onChange({ scheduleChanges: value.scheduleChanges.filter((change) => change.id !== id) })}
            onAddClosed={(dates, reason) => onChange({ scheduleChanges: closeDays(value.scheduleChanges, dates, reason, active) })}
            holidays={holidays}
            closures={closures}
            runsOnClosures={value.runsOnClosures}
            onRunsOnClosures={(runsOnClosures) => onChange({ runsOnClosures })}
            error={errors.dates}
          />

          {/* ---- 6. booking window ---- */}
          <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <h3 className="text-sm font-semibold">Booking window</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={`${fieldId}-window`} className="text-muted">
                Guests can book up to
              </label>
              <WholeNumberField
                id={`${fieldId}-window`}
                className="w-20"
                min={1}
                max={36}
                value={value.bookingWindowMonths > 0 ? value.bookingWindowMonths : defaultMonths}
                error={Boolean(errors.bookingWindow)}
                onValue={(months) => onChange({ bookingWindowMonths: months === defaultMonths ? 0 : months })}
              />
              <span className="text-muted">months ahead</span>
              {/* The default is set in days (Settings → Booking flow), so it is shown in days. */}
              {value.bookingWindowMonths > 0 ? (
                <button type="button" onClick={() => onChange({ bookingWindowMonths: 0 })} className="text-xs font-medium text-primary hover:underline">
                  Use your default ({defaultWindow})
                </button>
              ) : (
                <span className="text-xs text-subtle">Your default ({defaultWindow})</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor={`${fieldId}-notice`} className="text-muted">
                Close online booking
              </label>
              <BeforeInput id={`${fieldId}-notice`} hours={value.noticeHours} onHours={(noticeHours) => onChange({ noticeHours: Math.max(0, noticeHours) })} className="w-56" />
              <span className="text-muted">before the start</span>
            </div>
            {errors.bookingWindow ? <p className="text-xs font-medium text-danger">{errors.bookingWindow}</p> : null}
          </section>
        </>
      )}
    </div>
  )
}

/** "3 booked time slots stay as they are", with the list behind "See them". */
function BookedWarning({ slots }: { slots: BookedSlot[] }) {
  const [open, setOpen] = React.useState(false)
  const count = slots.length
  return (
    <div className="mt-3 rounded-lg bg-warning-soft px-3 py-2">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground">
        <TriangleAlert className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
        <span className="font-medium">
          {count} booked {count === 1 ? 'time slot stays as it is' : 'time slots stay as they are'}
        </span>
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="font-medium text-primary hover:underline">
          {open ? 'Hide' : 'See them'}
        </button>
      </p>
      {open ? (
        <ul className="mt-2 flex list-none flex-col gap-1 p-0 pl-5.5 text-xs text-muted">
          {slots.slice(0, 20).map((slot) => (
            <li key={slot.id} className="tabular">
              {dayName.format(fromDateKey(slot.startsAt.slice(0, 10)))} · {clockTime(slot.startsAt.slice(11, 16))} · {slot.booked} booked
            </li>
          ))}
          {count > 20 ? <li>and {count - 20} more</li> : null}
        </ul>
      ) : null}
    </div>
  )
}
