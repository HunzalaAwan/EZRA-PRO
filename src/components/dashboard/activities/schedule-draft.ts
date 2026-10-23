import type { Activity, ActivityKind, ActivityLocation, ActivitySchedule, ScheduleChange, WeekdayKey } from '@/types'
import { ACTIVITY_KIND_META } from '@/lib/activity-kinds'
import {
  WEEKDAY_KEYS,
  addMonthsKey,
  clockTime,
  closingGapOf,
  emptyWeek,
  normalizeTime,
  schedulesOf,
  shiftDayKey,
  shortDay,
  sortTimes,
  syncLegacyLocations,
  timesForWeekday,
  type ScheduleSource,
} from '@/lib/activity-schedule'

/* ==========================================================================
   Schedule draft — the Schedule step's part of the activity editor: the
   seasons, the day-by-day changes, the booking window and the cut-off.
   Also the helpers that turn a click on the year calendar into a schedule
   change, and the plain words each change reads as. Pure; browser- and
   server-safe.
   ========================================================================== */

/** How guests pick a time: "Specific times" (set start times), "All day" (opening hours), or "Specific dates" (only the dates listed). */
export type PickMode = 'times' | 'hours' | 'dates'

/** The fields the Schedule step edits. The activity editor's draft carries them under the same names. */
export interface ScheduleDraft {
  scheduleMode: PickMode
  /**
   * Seasons in priority order (a later one wins where they overlap). The first
   * at each location is its regular times, shown without a name; the rest are
   * the seasons. Kept while "Specific dates" is on, saved empty.
   */
  schedules: ActivitySchedule[]
  scheduleChanges: ScheduleChange[]
  /** Months guests can book ahead. 0: the business default. */
  bookingWindowMonths: number
  /** Runs on the business's closed days and public holidays. */
  runsOnClosures: boolean
  /** Online booking closes this many hours before the start. 0: until it starts. */
  noticeHours: number
}

/** Monday-first, as the calendar reads. */
export const MON_FIRST: WeekdayKey[] = ['1', '2', '3', '4', '5', '6', '0']
export const DAY_SHORT: Record<WeekdayKey, string> = { '0': 'Sun', '1': 'Mon', '2': 'Tue', '3': 'Wed', '4': 'Thu', '5': 'Fri', '6': 'Sat' }

/** Flat tints per season, in list order; the calendar and the season cards share them. */
export const SEASON_TINTS = [
  { cell: 'bg-lagoon-100 dark:bg-lagoon-900/50', dot: 'bg-lagoon-500' },
  { cell: 'bg-sunset-100 dark:bg-sunset-900/50', dot: 'bg-sunset-500' },
  { cell: 'bg-reef-100 dark:bg-reef-900/50', dot: 'bg-reef-500' },
  { cell: 'bg-coral-100 dark:bg-coral-900/50', dot: 'bg-coral-500' },
  { cell: 'bg-ink-200 dark:bg-ink-700/60', dot: 'bg-ink-500' },
] as const
export const tintOf = (index: number) => SEASON_TINTS[((index % SEASON_TINTS.length) + SEASON_TINTS.length) % SEASON_TINTS.length]

const pad = (n: number) => String(n).padStart(2, '0')
export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
export const fromMinutes = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`
const LAST_MINUTE = 23 * 60 + 59

let sequence = 0
/** A fresh id for a season or a change. Only called from event handlers, never while rendering. */
export function freshId(prefix: 'season' | 'chg'): string {
  sequence += 1
  return `${prefix}_${Date.now().toString(36)}${sequence.toString(36)}`
}

/** The same start times on every day. */
export function sameEveryDay(times: string[]): Record<WeekdayKey, string[]> {
  const days = emptyWeek()
  for (const key of WEEKDAY_KEYS) days[key] = sortTimes(times)
  return days
}

/**
 * A new activity's first season: all year, every day, two start times (or
 * open 9:00–17:00 with a start time every 30 minutes). Fixed id so the
 * server and the browser agree.
 */
export function allYearSeason(mode: 'times' | 'hours' = 'times'): ActivitySchedule {
  const season: ActivitySchedule = { id: 'season_all', name: 'All year', from: null, to: null, mode: 'times', days: sameEveryDay(['09:00', '13:30']) }
  if (mode === 'times') return season
  const hours = Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, { open: '09:00', close: '17:00' }])) as Record<WeekdayKey, { open: string; close: string } | null>
  return { ...season, mode: 'hours', hours, every: 30, days: emptyWeek() }
}

/** The way a kind usually sells: opening hours for open-entry kinds (rentals, passes, activities), start times otherwise. */
export function modeForKind(kind: ActivityKind): 'times' | 'hours' {
  return ACTIVITY_KIND_META[kind]?.defaultFormat === 'open' ? 'hours' : 'times'
}

/** The schedule fields of a new activity. */
export function defaultScheduleDraft(kind: ActivityKind = 'trip'): Omit<ScheduleDraft, 'noticeHours'> {
  const mode = modeForKind(kind)
  return { scheduleMode: mode, schedules: [allYearSeason(mode)], scheduleChanges: [], bookingWindowMonths: 0, runsOnClosures: false }
}

/** The gap every list of times shares, when they are evenly spaced; undefined when they aren't. */
function evenGap(lists: string[][]): number | undefined {
  let gap: number | undefined
  for (const times of lists) {
    for (let index = 1; index < times.length; index++) {
      const step = toMinutes(times[index]) - toMinutes(times[index - 1])
      if (gap === undefined) gap = step
      else if (step !== gap) return undefined
    }
  }
  return gap
}

const TIDY_GAPS = [10, 15, 20, 30, 45, 60, 90, 120]

/**
 * A season changed to start times or to opening hours. Start times → hours
 * keeps the same start times when they are evenly spaced; hours → start
 * times writes out every start time the hours gave. `lengthMinutes` is the
 * activity's `closingGapOf`: the hours close late enough for the last start
 * time to finish, and give back the start times the engine sells.
 */
export function convertSeason(season: ActivitySchedule, to: 'times' | 'hours', fallbackEvery = 30, lengthMinutes = 0): ActivitySchedule {
  if (season.mode === to) return season
  if (to === 'times') {
    const days = emptyWeek()
    for (const key of WEEKDAY_KEYS) days[key] = timesForWeekday(season, key, lengthMinutes)
    const { hours: _hours, every: _every, ...rest } = season
    return { ...rest, mode: 'times', days }
  }
  const lists = WEEKDAY_KEYS.map((key) => timesForWeekday(season, key))
  const gap = evenGap(lists)
  const every = gap && TIDY_GAPS.includes(gap) ? gap : Math.max(5, fallbackEvery)
  const tail = Math.max(every, Math.floor(lengthMinutes || 0))
  const hours = {} as Record<WeekdayKey, { open: string; close: string } | null>
  WEEKDAY_KEYS.forEach((key, index) => {
    const times = lists[index]
    if (times.length === 0) hours[key] = null
    else hours[key] = { open: times[0], close: fromMinutes(Math.min(LAST_MINUTE, toMinutes(times[times.length - 1]) + tail)) }
  })
  return { ...season, mode: 'hours', hours, every, days: emptyWeek() }
}

/** An older open-entry schedule (a start time every half hour) read as opening hours, when that gives exactly the same start times. */
function asHoursWhenEven(season: ActivitySchedule, lengthMinutes = 0): ActivitySchedule {
  if (season.mode !== 'times') return season
  const lists = WEEKDAY_KEYS.map((key) => timesForWeekday(season, key))
  if (!lists.some((times) => times.length >= 3)) return season
  const gap = evenGap(lists)
  if (!gap || !TIDY_GAPS.includes(gap)) return season
  const converted = convertSeason(season, 'hours', gap, lengthMinutes)
  // Only when nothing moves: the hours give back exactly these start times.
  const same = WEEKDAY_KEYS.every((key, index) => timesForWeekday(converted, key, lengthMinutes).join() === lists[index].join())
  return same ? converted : season
}

const cloneSeason = (season: ActivitySchedule): ActivitySchedule => ({
  ...season,
  days: Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, [...(season.days?.[key] ?? [])]])) as Record<WeekdayKey, string[]>,
  ...(season.hours ? { hours: Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, season.hours?.[key] ? { ...season.hours[key]! } : null])) as Record<WeekdayKey, { open: string; close: string } | null> } : {}),
})

/** The editor's schedule fields, from an activity (seeded, or with its saved edit laid over it). */
export function scheduleDraftOf(activity: Activity): Omit<ScheduleDraft, 'noticeHours'> {
  const kind = activity.kind ?? 'trip'
  const gap = closingGapOf(activity)
  const dates = Array.isArray(activity.schedules) && activity.schedules.length === 0
  let seasons = schedulesOf(activity).map(cloneSeason)
  // Only the older per-location times are read as opening hours; seasons saved as start times stay start times.
  if (activity.format === 'open' && activity.schedules === undefined) seasons = seasons.map((season) => (season.id.startsWith('legacy_') ? asHoursWhenEven(season, gap) : season))
  const mode: PickMode = dates ? 'dates' : seasons.length > 0 && seasons.every((season) => season.mode === 'hours') ? 'hours' : 'times'
  if (mode === 'times') seasons = seasons.map((season) => convertSeason(season, 'times', 30, gap))
  return {
    scheduleMode: mode,
    schedules: seasons.length > 0 || dates ? seasons : [allYearSeason(modeForKind(kind))],
    scheduleChanges: (activity.scheduleChanges ?? []).map((change) => ({ ...change, dates: [...change.dates], ...(change.times ? { times: [...change.times] } : {}) })),
    bookingWindowMonths: activity.bookingWindow?.monthsAhead ?? 0,
    runsOnClosures: Boolean(activity.runsOnClosures),
  }
}

/** Key order left out, so a season read back from storage compares equal. */
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical((value as Record<string, unknown>)[key])]))
      : value

/** The first season a new activity starts with, not yet changed. */
const isUntouchedStart = (schedules: ActivitySchedule[]) =>
  schedules.length === 1 && schedules[0].id === 'season_all' && JSON.stringify(canonical(schedules[0])) === JSON.stringify(canonical(allYearSeason(schedules[0].mode)))

/**
 * Every season switched to start times or opening hours. A new activity's
 * untouched first season becomes the other mode's own start.
 * `lengthMinutes`: the activity's `closingGapOf` (see `convertSeason`).
 */
export function withMode(fields: Pick<ScheduleDraft, 'schedules'>, mode: PickMode, fallbackEvery = 30, lengthMinutes = 0): Pick<ScheduleDraft, 'scheduleMode' | 'schedules'> {
  if (mode === 'dates') return { scheduleMode: 'dates', schedules: fields.schedules }
  if (fields.schedules.length === 0 || isUntouchedStart(fields.schedules)) return { scheduleMode: mode, schedules: [allYearSeason(mode)] }
  return { scheduleMode: mode, schedules: fields.schedules.map((season) => convertSeason(season, mode, fallbackEvery, lengthMinutes)) }
}

/** What the engine reads for a draft: the activity's own facts plus the edited schedule. */
export function scheduleSourceOf(
  fields: ScheduleDraft,
  base: Omit<ScheduleSource, 'schedules' | 'scheduleChanges' | 'runsOnClosures' | 'bookingWindow' | 'noticeHours'>,
): ScheduleSource {
  return {
    ...base,
    schedules: fields.scheduleMode === 'dates' ? [] : fields.schedules,
    scheduleChanges: fields.scheduleChanges,
    runsOnClosures: fields.runsOnClosures,
    bookingWindow: fields.bookingWindowMonths > 0 ? { monthsAhead: fields.bookingWindowMonths } : undefined,
    noticeHours: fields.noticeHours,
  }
}

/**
 * A season as saved: times cleaned, nothing half-set. `regular`: the
 * location's regular times, whose name the step doesn't show when it has no
 * dates, so it goes back to "All year".
 */
function cleanSeason(season: ActivitySchedule, regular = false): ActivitySchedule {
  const days = emptyWeek()
  for (const key of WEEKDAY_KEYS) days[key] = sortTimes(season.days?.[key] ?? [])
  const dated = Boolean(season.from || season.to)
  const out: ActivitySchedule = {
    id: season.id,
    name: regular && !dated ? 'All year' : season.name.trim() || (dated ? 'Season' : 'All year'),
    from: season.from || null,
    to: season.to || null,
    mode: season.mode,
    days: season.mode === 'hours' ? emptyWeek() : days,
  }
  if (season.mode === 'hours') {
    out.hours = Object.fromEntries(
      WEEKDAY_KEYS.map((key) => {
        const entry = season.hours?.[key]
        const open = entry ? normalizeTime(entry.open) : undefined
        const close = entry ? normalizeTime(entry.close) : undefined
        return [key, open && close ? { open, close } : null]
      }),
    ) as Record<WeekdayKey, { open: string; close: string } | null>
    out.every = Math.max(5, Math.floor(season.every ?? 30))
  }
  // Seasons don't set their own spots any more: every season uses the number in Basics.
  if (season.locationId) out.locationId = season.locationId
  return out
}

/**
 * The schedule part of a save: explicit values throughout ([] / null / false
 * clear), and the older per-location times kept in step with the first season
 * (`lengthMinutes`: the activity's `closingGapOf`, so they match the engine).
 */
export function scheduleSaveOf(fields: ScheduleDraft, sites: ActivityLocation[], lengthMinutes = 0) {
  // The step shows each location's seasons when there are several, all of them otherwise.
  const regular = regularSeasonIds(fields.schedules, sites.length > 1 ? sites.map((site) => site.locationId) : [undefined])
  const schedules = fields.scheduleMode === 'dates' ? [] : fields.schedules.map((season) => cleanSeason(season, regular.has(season.id)))
  const scheduleChanges = fields.scheduleChanges
    .map((change) => ({ ...change, dates: [...new Set(change.dates)].sort(), ...(change.times ? { times: sortTimes(change.times) } : {}) }))
    // An extra time with no time left, or spots with no number, does nothing.
    .filter((change) => change.dates.length > 0 && !(change.action === 'add' && (change.times?.length ?? 0) === 0) && !(change.action === 'spots' && change.spots === undefined))
  return {
    schedules,
    scheduleChanges,
    bookingWindow: fields.bookingWindowMonths > 0 ? { monthsAhead: Math.floor(fields.bookingWindowMonths) } : null,
    runsOnClosures: Boolean(fields.runsOnClosures),
    locations: syncLegacyLocations(sites, schedules, lengthMinutes),
  }
}

/** Seasons that apply at a location: its own, or every season when there is only one location. */
export function seasonsAt(schedules: ActivitySchedule[], locationId: string | undefined): ActivitySchedule[] {
  return locationId === undefined ? schedules : schedules.filter((season) => !season.locationId || season.locationId === locationId)
}

/**
 * The seasons that are a location's regular times: first wherever they apply
 * (`locationIds`: the locations shown, or `[undefined]` for one). A season
 * shared by every location that comes later somewhere is a season there, so
 * it isn't one of these.
 */
export function regularSeasonIds(schedules: ActivitySchedule[], locationIds: (string | undefined)[] = [undefined]): Set<string> {
  const first = new Set<string>()
  const later = new Set<string>()
  for (const locationId of locationIds) seasonsAt(schedules, locationId).forEach((season, index) => (index === 0 ? first : later).add(season.id))
  return new Set([...first].filter((id) => !later.has(id)))
}

const hasTimes = (season: ActivitySchedule) => WEEKDAY_KEYS.some((key) => timesForWeekday(season, key).length > 0)

/** What has to be right before the Schedule step lets the owner on. Keys match the fields that show them. */
export function validateScheduleDraft(
  fields: ScheduleDraft,
  ctx: { pickedLocationIds: string[]; requireLocation: boolean; unscheduled: boolean; todayKey: string },
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (ctx.requireLocation && ctx.pickedLocationIds.length === 0) errors.locations = 'Pick where it runs from'
  if (fields.bookingWindowMonths < 0 || fields.bookingWindowMonths > 36) errors.bookingWindow = 'Between 1 and 36 months'
  if (ctx.unscheduled) return errors
  if (fields.scheduleMode === 'dates') {
    const upcoming = fields.scheduleChanges.some(
      (change) => (change.action === 'add' || change.action === 'times') && (change.times?.length ?? 0) > 0 && change.dates.some((dateKey) => dateKey >= ctx.todayKey),
    )
    if (!upcoming) errors.dates = 'Add at least one date: click a day on the calendar'
    return errors
  }
  for (const season of fields.schedules) {
    if (season.from && season.to && season.to < season.from) errors[`season.${season.id}.to`] = 'It ends before it starts'
    if (season.mode === 'hours') {
      for (const key of WEEKDAY_KEYS) {
        const entry = season.hours?.[key]
        if (!entry) continue
        const open = normalizeTime(entry.open)
        const close = normalizeTime(entry.close)
        if (!open || !close) errors[`season.${season.id}.hours`] = 'Pick an opening and a closing time'
        else if (toMinutes(close) <= toMinutes(open)) errors[`season.${season.id}.hours`] = 'Closing must come after opening'
      }
    }
  }
  const multi = ctx.pickedLocationIds.length > 1
  // With several locations, one can run only on dates added on the calendar (the way of picking a time is the whole activity's).
  const datesAt = (locationId: string) =>
    fields.scheduleChanges.some(
      (change) =>
        (change.action === 'add' || change.action === 'times') &&
        (change.times?.length ?? 0) > 0 &&
        (!change.locationId || change.locationId === locationId) &&
        change.dates.some((dateKey) => dateKey >= ctx.todayKey),
    )
  for (const locationId of multi ? ctx.pickedLocationIds : [undefined]) {
    if (!seasonsAt(fields.schedules, locationId).some(hasTimes) && !(locationId && datesAt(locationId))) {
      errors[locationId ? `times.${locationId}` : 'times'] = multi ? 'Add a start time at every location' : 'Add at least one start time'
    }
  }
  return errors
}

/* ---------- seasons from a template ---------- */

export type SeasonTemplate = 'summer' | 'winter' | 'weekends' | 'holidays' | 'blank'

const lastOfFeb = (year: number) => (new Date(year, 2, 0).getDate() === 29 ? 29 : 28)

/** The next time a yearly range (MM-DD to MM-DD, maybe across New Year) is on or ahead of today. */
function nextRange(todayKey: string, from: string, to: string): { from: string; to: string } {
  const year = Number(todayKey.slice(0, 4))
  const wraps = to < from
  const build = (start: number) => {
    const end = wraps ? start + 1 : start
    const toDay = to === '02-29' ? `02-${lastOfFeb(end)}` : to
    return { from: `${start}-${from}`, to: `${end}-${toDay}` }
  }
  // Still running or yet to come this year (or the one that started last year and runs past New Year).
  for (const start of [year - 1, year, year + 1]) {
    const range = build(start)
    if (range.to >= todayKey) return range
  }
  return build(year + 1)
}

export const SEASON_TEMPLATES: { value: SeasonTemplate; label: string; hint: (southern: boolean) => string }[] = [
  { value: 'summer', label: 'Summer', hint: (southern) => (southern ? 'Dec – Feb' : 'Jun – Aug') },
  { value: 'winter', label: 'Winter', hint: (southern) => (southern ? 'Jun – Aug' : 'Dec – Feb') },
  { value: 'weekends', label: 'Weekends only', hint: (southern) => (southern ? 'May – Sep' : 'Nov – Mar') },
  { value: 'holidays', label: 'School holidays', hint: () => 'Dec 20 – Jan 4' },
  { value: 'blank', label: 'Other dates', hint: () => 'Next month' },
]

/** A new season from a template, with the start times of the season it is based on. */
export function seasonFromTemplate(template: SeasonTemplate, base: ActivitySchedule | undefined, todayKey: string, southern: boolean, locationId?: string): ActivitySchedule {
  const source = base ?? allYearSeason()
  const copy = cloneSeason(source)
  const range =
    template === 'summer'
      ? nextRange(todayKey, southern ? '12-01' : '06-01', southern ? '02-29' : '08-31')
      : template === 'winter'
        ? nextRange(todayKey, southern ? '06-01' : '12-01', southern ? '08-31' : '02-29')
        : template === 'weekends'
          ? nextRange(todayKey, southern ? '05-01' : '11-01', southern ? '09-30' : '03-31')
          : template === 'holidays'
            ? nextRange(todayKey, '12-20', '01-04')
            : (() => {
                const first = `${addMonthsKey(todayKey, 1).slice(0, 7)}-01`
                return { from: first, to: shiftDayKey(addMonthsKey(first, 1), -1) }
              })()
  const season: ActivitySchedule = {
    ...copy,
    id: freshId('season'),
    name: SEASON_TEMPLATES.find((entry) => entry.value === template)?.label ?? 'Season',
    from: range.from,
    to: range.to,
  }
  if (template === 'blank') season.name = 'New season'
  if (template === 'weekends') {
    if (season.mode === 'hours') {
      season.hours = Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, key === '0' || key === '6' ? (copy.hours?.[key] ?? Object.values(copy.hours ?? {}).find(Boolean) ?? { open: '09:00', close: '17:00' }) : null])) as Record<WeekdayKey, { open: string; close: string } | null>
    } else {
      const usual = WEEKDAY_KEYS.map((key) => copy.days[key]).find((times) => times.length > 0) ?? ['09:00']
      season.days = Object.fromEntries(WEEKDAY_KEYS.map((key) => [key, key === '0' || key === '6' ? [...(copy.days[key].length > 0 ? copy.days[key] : usual)] : []])) as Record<WeekdayKey, string[]>
    }
  }
  if (locationId) season.locationId = locationId
  else delete season.locationId
  return season
}

/**
 * One short line when seasons overlap or leave days without a season; null
 * when all is well. `seasons[0]` is the regular times, the rest the seasons.
 */
export function seasonsWarning(seasons: ActivitySchedule[], todayKey: string): string | null {
  const dated = seasons.filter((season) => season.from || season.to)
  const base = seasons.some((season) => !season.from && !season.to)
  // A season with no dates wins over everything above it, the regular times too, so those never run.
  const lastAllYear = seasons.reduce((found, season, index) => (!season.from && !season.to ? index : found), -1)
  if (lastAllYear > 0) {
    const name = seasons[lastAllYear].name.trim() || 'A season'
    return `${name} has no dates, so it runs every day instead of the times above it. Give it dates or remove it.`
  }
  for (let a = 0; a < dated.length; a++) {
    for (let b = a + 1; b < dated.length; b++) {
      const first = dated[a]
      const second = dated[b]
      const overlap = (first.from ?? '') <= (second.to ?? '9999') && (second.from ?? '') <= (first.to ?? '9999')
      if (overlap) return `${second.name || 'A season'} and ${first.name || 'another season'} overlap: ${second.name || 'the later one'} wins on those days.`
    }
  }
  if (!base && dated.length > 0) {
    // The first day in the next year no season covers.
    const end = addMonthsKey(todayKey, 12)
    for (let key = todayKey; key <= end; key = shiftDayKey(key, 1)) {
      const covered = dated.some((season) => (season.from == null || season.from <= key) && (season.to == null || key <= season.to))
      if (!covered) {
        let last = key
        while (last < end) {
          const next = shiftDayKey(last, 1)
          if (dated.some((season) => (season.from == null || season.from <= next) && (season.to == null || next <= season.to))) break
          last = next
        }
        return last === key ? `No season covers ${shortDay(key)}: it doesn't run that day.` : `No season covers ${shortDay(key)} – ${shortDay(last)}: it doesn't run then.`
      }
    }
  }
  return null
}

/* ---------- day-by-day changes from the calendar ---------- */

/**
 * Whether an edit made while looking at a location may change this change.
 * With one location every change belongs to it; with several, only the ones
 * scoped to that location (a change for every location stays as it is).
 */
const owned = (change: ScheduleChange, locationId: string | undefined) => locationId === undefined || change.locationId === locationId
const scoped = (locationId: string | undefined) => (locationId ? { locationId } : {})
const onlyOn = (change: ScheduleChange, dateKey: string) => change.dates.length === 1 && change.dates[0] === dateKey
const fullClose = (change: ScheduleChange) => change.action === 'closed' && !(change.times?.length)

/**
 * A time slot called off from the calendar (`cancelChangeId`: closed_<day>_<HHMM>_<location>).
 * Its guests were told and refunded, so edits here never fold it away.
 */
export const isCalendarCancel = (change: ScheduleChange) => change.action === 'closed' && /^closed_\d{4}-\d{2}-\d{2}_\d{4}_/.test(change.id)

/** Two changes the same, whatever the key order. */
const sameChange = (a: ScheduleChange, b: ScheduleChange) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/**
 * The draft's changes with what another screen saved since the draft began
 * (a time slot cancelled on the calendar, spots or an extra time from the
 * Schedule tab). `base` is what the draft started from, `saved` what is
 * saved now, `draft` the owner's list. The owner's own edits win; changes
 * only the other screen touched are taken from it.
 */
export function mergeScheduleChanges(base: ScheduleChange[], saved: ScheduleChange[], draft: ScheduleChange[]): ScheduleChange[] {
  const before = new Map(base.map((change) => [change.id, change]))
  const now = new Map(saved.map((change) => [change.id, change]))
  const mine = new Set(draft.map((change) => change.id))
  const out: ScheduleChange[] = []
  for (const change of draft) {
    const was = before.get(change.id)
    const theirs = now.get(change.id)
    // Left alone here: removed or changed elsewhere follows the other screen.
    if (was && sameChange(was, change)) {
      if (!theirs) continue
      out.push(theirs)
    } else out.push(change)
  }
  // New elsewhere (not in the draft's start, not in the draft): added at the end, so a cancellation still wins.
  for (const change of saved) if (!before.has(change.id) && !mine.has(change.id)) out.push(change)
  return out
}

/** A change with one day taken out of it (or gone, when that was its only day). */
function withoutDay(changes: ScheduleChange[], target: ScheduleChange, dateKey: string): ScheduleChange[] {
  const dates = target.dates.filter((key) => key !== dateKey)
  return dates.length === 0 ? changes.filter((change) => change !== target) : changes.map((change) => (change === target ? { ...change, dates } : change))
}

/**
 * A start time added on one day, or on several. Only a single day can be
 * opened this way: across several days, closed ones are left out. `closedDays`
 * are the days closed as the calendar shows them (this activity's closed
 * days, the business's closed days and holidays); without it, the days this
 * activity closed.
 */
export function addTimeOn(changes: ScheduleChange[], dateKeys: string[], time: string, locationId?: string, closedDays?: ReadonlySet<string>): ScheduleChange[] {
  const clean = normalizeTime(time)
  if (!clean || dateKeys.length === 0) return changes
  let days = dateKeys
  if (days.length > 1) {
    const isClosed = (key: string) =>
      closedDays ? closedDays.has(key) : changes.some((change) => (!change.locationId || locationId === undefined || change.locationId === locationId) && fullClose(change) && change.dates.includes(key))
    const open = [...new Set(days)].filter((key) => !isClosed(key)).sort()
    if (open.length === 0) return changes
    if (open.length > 1) return [...changes, { id: freshId('chg'), dates: open, action: 'add', times: [clean], ...scoped(locationId) }]
    days = open
  }
  const dateKey = days[0]
  // A time removed from this day comes back.
  const removed = changes.find((change) => owned(change, locationId) && change.action === 'closed' && change.dates.includes(dateKey) && (change.times ?? []).map(normalizeTime).includes(clean))
  if (removed) {
    const rest = (removed.times ?? []).filter((entry) => normalizeTime(entry) !== clean)
    if (onlyOn(removed, dateKey)) return rest.length > 0 ? changes.map((change) => (change === removed ? { ...change, times: rest } : change)) : changes.filter((change) => change !== removed)
    const next = withoutDay(changes, removed, dateKey)
    return rest.length > 0 ? [...next, { ...removed, id: freshId('chg'), dates: [dateKey], times: rest }] : next
  }
  // A day this activity closed: open it with only this time.
  const closer = changes.find((change) => owned(change, locationId) && fullClose(change) && change.dates.includes(dateKey))
  if (closer) {
    let next = changes
    for (const change of changes) if (owned(change, locationId) && fullClose(change) && change.dates.includes(dateKey)) next = withoutDay(next, change, dateKey)
    return [...next, { id: freshId('chg'), dates: [dateKey], action: 'times', times: [clean], ...(closer.reason ? { reason: closer.reason } : {}), ...scoped(locationId) }]
  }
  // Already changed this day only: add to that.
  const same = changes.find((change) => owned(change, locationId) && (change.action === 'add' || change.action === 'times') && onlyOn(change, dateKey))
  if (same) return changes.map((change) => (change === same ? { ...change, times: sortTimes([...(change.times ?? []), clean]) } : change))
  return [...changes, { id: freshId('chg'), dates: [dateKey], action: 'add', times: [clean], ...scoped(locationId) }]
}

/** A start time taken off one day. `fromChange` is the change that put it there, if one did. */
export function removeTimeOn(changes: ScheduleChange[], dateKey: string, time: string, fromChange: string | undefined, locationId?: string): ScheduleChange[] {
  const clean = normalizeTime(time)
  if (!clean) return changes
  const source = fromChange ? changes.find((change) => change.id === fromChange) : undefined
  if (source && (source.action === 'add' || source.action === 'times') && owned(source, locationId)) {
    const rest = (source.times ?? []).filter((entry) => normalizeTime(entry) !== clean)
    const closedDay: ScheduleChange = { id: freshId('chg'), dates: [dateKey], action: 'closed', ...(source.reason ? { reason: source.reason } : {}), ...scoped(source.locationId) }
    if (onlyOn(source, dateKey)) {
      if (rest.length > 0) return changes.map((change) => (change === source ? { ...change, times: rest } : change))
      // "Only these times" with none left closes the day; an extra time with none left just goes.
      return source.action === 'times' ? changes.map((change) => (change === source ? { ...closedDay, id: change.id } : change)) : changes.filter((change) => change !== source)
    }
    const next = withoutDay(changes, source, dateKey)
    if (rest.length > 0) return [...next, { ...source, id: freshId('chg'), dates: [dateKey], times: rest }]
    return source.action === 'times' ? [...next, closedDay] : next
  }
  // A time from the season: off on this day only.
  // (Not onto a calendar cancellation: that one stays exactly as the calendar saved it.)
  const partial = changes.find((change) => owned(change, locationId) && change.action === 'closed' && (change.times?.length ?? 0) > 0 && onlyOn(change, dateKey) && !isCalendarCancel(change))
  if (partial) return changes.map((change) => (change === partial ? { ...change, times: sortTimes([...(change.times ?? []), clean]) } : change))
  return [...changes, { id: freshId('chg'), dates: [dateKey], action: 'closed', times: [clean], ...scoped(locationId) }]
}

/**
 * One or more days closed. Closing one day folds that day's own time changes
 * into the closure; a time slot cancelled on the calendar stays, so opening
 * the day again doesn't put it back on sale.
 */
export function closeDays(changes: ScheduleChange[], dateKeys: string[], reason: string, locationId?: string): ScheduleChange[] {
  if (dateKeys.length === 0) return changes
  let next = changes
  if (dateKeys.length === 1) next = next.filter((change) => !(owned(change, locationId) && onlyOn(change, dateKeys[0]) && change.action !== 'spots' && !isCalendarCancel(change)))
  const note = reason.trim()
  return [...next, { id: freshId('chg'), dates: [...new Set(dateKeys)].sort(), action: 'closed', ...(note ? { reason: note } : {}), ...scoped(locationId) }]
}

/** A day this activity closed, open again. */
export function openDay(changes: ScheduleChange[], dateKey: string, locationId?: string): ScheduleChange[] {
  let next = changes
  for (const change of changes) if (owned(change, locationId) && fullClose(change) && change.dates.includes(dateKey)) next = withoutDay(next, change, dateKey)
  return next
}

/** A business closed day or public holiday this activity runs on anyway, at the season's times. */
export function runAnyway(changes: ScheduleChange[], dateKey: string, times: string[], locationId?: string): ScheduleChange[] {
  if (times.length === 0) return changes
  return [...changes, { id: freshId('chg'), dates: [dateKey], action: 'add', times: sortTimes(times), reason: 'Runs on this closed day', ...scoped(locationId) }]
}

/**
 * Spots for every time slot on some days, as one change; undefined goes back
 * to each day's usual number (`usualOn`: its weekday's or the activity's).
 * Days already given spots this way lose them first, and days whose usual
 * number is already that many get no change.
 */
export function setSpotsOn(
  changes: ScheduleChange[],
  dateKeys: string[],
  spots: number | undefined,
  usualOn: (dateKey: string) => number,
  locationId?: string,
): ScheduleChange[] {
  const days = new Set(dateKeys)
  if (days.size === 0) return changes
  const daySpots = (change: ScheduleChange) => owned(change, locationId) && change.action === 'spots' && !(change.times?.length)
  // One day that already has its own spots: that change is updated (or removed), keeping its id.
  const only = days.size === 1 ? [...days][0] : undefined
  const own = only ? changes.find((change) => daySpots(change) && onlyOn(change, only)) : undefined
  if (only && own) {
    const value = spots === undefined ? undefined : Math.max(1, Math.floor(spots))
    const keep = value !== undefined && usualOn(only) !== value
    return changes.flatMap((change) => {
      if (change === own) return keep ? [{ ...own, spots: value }] : []
      if (!daySpots(change) || !change.dates.includes(only)) return [change]
      const dates = change.dates.filter((key) => key !== only)
      return dates.length > 0 ? [{ ...change, dates }] : []
    })
  }
  let touched = false
  const next = changes.flatMap((change) => {
    if (!daySpots(change)) return [change]
    const dates = change.dates.filter((key) => !days.has(key))
    if (dates.length === change.dates.length) return [change]
    touched = true
    return dates.length > 0 ? [{ ...change, dates }] : []
  })
  if (spots === undefined) return touched ? next : changes
  const value = Math.max(1, Math.floor(spots))
  const differ = [...days].filter((key) => usualOn(key) !== value).sort()
  if (differ.length === 0) return touched ? next : changes
  return [...next, { id: freshId('chg'), dates: differ, action: 'spots', spots: value, ...scoped(locationId) }]
}

/** The reason on this day's own changes. */
export function setDayReason(changes: ScheduleChange[], dateKey: string, reason: string, locationId?: string): ScheduleChange[] {
  const note = reason.trim()
  return changes.map((change) => {
    if (!owned(change, locationId) || !onlyOn(change, dateKey)) return change
    if (note) return { ...change, reason: note }
    const { reason: _reason, ...rest } = change
    return rest
  })
}

/** The reason already written on this day's changes, if any. */
export function dayReason(changes: ScheduleChange[], dateKey: string, locationId?: string): string {
  return changes.find((change) => owned(change, locationId) && change.dates.includes(dateKey) && change.reason)?.reason ?? ''
}

/** Every day from one day key to another, inclusive. */
export function daysBetween(fromKey: string, toKey: string): string[] {
  const [start, end] = fromKey <= toKey ? [fromKey, toKey] : [toKey, fromKey]
  const out: string[] = []
  for (let key = start; key <= end && out.length < 400; key = shiftDayKey(key, 1)) out.push(key)
  return out
}

/* ---------- plain words ---------- */

const listTimes = (times: string[]) => sortTimes(times).map(clockTime).join(', ')

/** "Dec 24", "Dec 20 – Jan 4", "Dec 24, Dec 31 and Jan 1", "6 days from Dec 24". */
export function describeDates(dates: string[]): string {
  const sorted = [...new Set(dates)].sort()
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return shortDay(sorted[0])
  const contiguous = sorted.every((key, index) => index === 0 || shiftDayKey(sorted[index - 1], 1) === key)
  if (contiguous) return `${shortDay(sorted[0])} – ${shortDay(sorted[sorted.length - 1])}`
  if (sorted.length <= 3) return `${sorted.slice(0, -1).map(shortDay).join(', ')} and ${shortDay(sorted[sorted.length - 1])}`
  return `${sorted.length} days from ${shortDay(sorted[0])}`
}

/** What a change does, in a few words: "Closed", "13:30 off", "Only 9:00, 15:00", "Extra time 17:30", "12 spots". */
export function describeChange(change: ScheduleChange, mode: PickMode, spotWord = 'spots'): string {
  const times = change.times ?? []
  if (change.action === 'closed') return times.length === 0 ? 'Closed' : `${listTimes(times)} off`
  if (change.action === 'times') return times.length === 0 ? 'Closed' : `Only ${listTimes(times)}`
  if (change.action === 'add') return mode === 'dates' ? `At ${listTimes(times)}` : `Extra ${times.length === 1 ? 'time' : 'times'} ${listTimes(times)}`
  return `${change.spots ?? 0} ${spotWord}${times.length > 0 ? ` at ${listTimes(times)}` : ''}`
}
