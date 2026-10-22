import type { Activity, ActivityLocation, ActivitySchedule, BusinessClosure, Departure, ScheduleChange, WeekdayKey } from '@/types'
import type { AvailabilityDay, AvailabilitySlot } from '@/components/storefront/booking-widget'
import type { DepartureRowLite } from '@/components/dashboard/activities/activity-data'
import { TODAY_KEY } from '@/lib/data/constants'
import { holidaysBetween } from '@/lib/holidays'
import { hasItems, rentalItemsOf, shortestRentalMs } from '@/lib/rental-items'
import { slotExtraSpotsOf } from '@/lib/extra-spots'

/* ==========================================================================
   Activity schedule — seasons, changes and closed days turned into time
   slots. Every activity reads as a list of seasons (`schedulesOf`, which
   converts the older per-location times), and `expandSchedules` lays the
   seasons, the activity's changes, the business's closed days and public
   holidays over a range of days. Time slots that aren't seeded get a
   stable id (`gen_…`) the server can turn back into a time slot.
   Browser- and server-safe.
   ========================================================================== */

export const WEEKDAY_KEYS: WeekdayKey[] = ['0', '1', '2', '3', '4', '5', '6']

/** What the engine reads from an activity. A wizard draft can pass the same shape. */
export type ScheduleSource = Pick<Activity, 'id' | 'locations' | 'maxCapacity'> &
  Partial<
    Pick<
      Activity,
      | 'kind'
      | 'rental'
      | 'priceTiers'
      | 'schedules'
      | 'scheduleChanges'
      | 'runsOnClosures'
      | 'bookingWindow'
      | 'noticeHours'
      | 'charter'
      | 'durationMinutes'
      | 'extraSpots'
      | 'chargeBy'
      | 'groupPrice'
    >
  >

export interface ScheduleContext {
  /** The business's closed days (Settings / Availability). */
  closures?: BusinessClosure[]
  /** Public holidays for the business's country, when switched on. */
  holidays?: { country: string; enabled: boolean } | null
  /** Only what guests can book: from now plus the notice, up to the booking window. */
  bookable?: { nowIso: string; maxAdvanceDays?: number }
  /** One location only. Absent: every location the activity runs from. */
  locationId?: string
}

export interface ScheduledSlot {
  dateKey: string
  /** "HH:MM". */
  time: string
  /** Spots in this time slot. */
  capacity: number
  /** A season or a change set the spots (otherwise they are the activity's own). */
  capacitySet?: boolean
  locationId?: string
  /** The season the day belongs to; null when no season covers it (a time only a change adds). */
  scheduleId: string | null
  /** The change that shaped this time slot, if any. */
  change?: { id: string; action: ScheduleChange['action']; reason?: string }
}

export interface ScheduledDay {
  dateKey: string
  locationId?: string
  /** The season covering the day; null when none does. */
  scheduleId: string | null
  slots: ScheduledSlot[]
  /** Why nothing runs, when the day was closed: by a change, a business closed day or a public holiday. */
  closed?: { by: 'change' | 'closure' | 'holiday'; reason: string }
  /** A change touched this day: different times, an extra time, spots, or some times closed. */
  changed: boolean
  /** Passes: the tickets the day sells, shared by its time slots. */
  dayLimit?: number
}

/* ---------- small helpers ---------- */

const pad = (n: number) => String(n).padStart(2, '0')
const KEY_RE = /^\d{4}-\d{2}-\d{2}$/
export const isDayKey = (value: unknown): value is string => typeof value === 'string' && KEY_RE.test(value)

/** "9:00" → "09:00"; anything that isn't a time → undefined. */
export function normalizeTime(value: string): string | undefined {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return undefined
  return `${pad(hours)}:${match[2]}`
}

/** Start times cleaned, without repeats, in clock order. */
export function sortTimes(times: readonly string[]): string[] {
  const set = new Set<string>()
  for (const time of times) {
    const clean = normalizeTime(time)
    if (clean) set.add(clean)
  }
  return [...set].sort()
}

const dateOf = (dateKey: string) => {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
const keyOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** A day key moved by some days. */
export function shiftDayKey(dateKey: string, days: number): string {
  const date = dateOf(dateKey)
  date.setDate(date.getDate() + days)
  return keyOf(date)
}

/** A day key moved by some months (Jan 31 + 1 month lands on the last day of February). */
export function addMonthsKey(dateKey: string, months: number): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const end = new Date(y, m - 1 + months + 1, 0, 12).getDate()
  return keyOf(new Date(y, m - 1 + months, Math.min(d, end), 12))
}

/** A local ISO ("YYYY-MM-DDTHH:mm:ss") plus some minutes, still local. */
function plusMinutes(iso: string, minutes: number) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() + minutes)
  return `${keyOf(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
const fromMinutes = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

/** An empty week: no start times on any day. */
export function emptyWeek(): Record<WeekdayKey, string[]> {
  return { '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [] }
}

/**
 * The start times a season has on a weekday. Opening hours give one every
 * `every` minutes from opening, the last one leaving `lengthMinutes` to
 * finish by closing (see `closingGapOf`); the opening time always counts.
 */
export function timesForWeekday(schedule: ActivitySchedule, weekday: WeekdayKey, lengthMinutes = 0): string[] {
  if (schedule.mode === 'hours') {
    const hours = schedule.hours?.[weekday]
    const open = hours ? normalizeTime(hours.open) : undefined
    const close = hours ? normalizeTime(hours.close) : undefined
    if (!open || !close) return []
    const every = Math.max(5, Math.floor(schedule.every ?? 30))
    const start = toMinutes(open)
    const end = toMinutes(close)
    const lastStart = Math.max(start, end - Math.max(0, Math.floor(lengthMinutes || 0)))
    const out: string[] = []
    for (let at = start; at < end && at <= lastStart; at += every) out.push(fromMinutes(at))
    return out
  }
  return sortTimes(schedule.days?.[weekday] ?? [])
}

/**
 * How long before closing the last start time in opening hours is: the
 * activity's length, so nothing runs past closing. None for rentals, whose
 * hours are when a rental can start.
 */
export function closingGapOf(activity: Pick<ScheduleSource, 'kind' | 'durationMinutes'>): number {
  if ((activity.kind ?? 'trip') === 'rental') return 0
  const minutes = Math.floor(activity.durationMinutes ?? 0)
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0
}

/* ---------- the shape every activity reads as ---------- */

/**
 * The activity's seasons. An activity saved before seasons existed reads as
 * one "All year" season per location, from its weekly days and times, so
 * it expands to exactly the time slots it was seeded with.
 */
export function schedulesOf(activity: ScheduleSource): ActivitySchedule[] {
  if (activity.schedules) return activity.schedules
  if ((activity.kind ?? 'trip') === 'package') return []
  const sites = activity.locations ?? []
  const usual = sites.find((site) => site.times.length > 0)?.times ?? []
  return sites.map((site, index) => {
    const times = sortTimes(site.times.length > 0 ? site.times : usual)
    const days = emptyWeek()
    for (const key of WEEKDAY_KEYS) if (!site.weekdays || site.weekdays.includes(Number(key))) days[key] = [...times]
    const schedule: ActivitySchedule = { id: `legacy_${site.locationId || index}`, name: 'All year', from: null, to: null, mode: 'times', days }
    if (sites.length > 1 && site.locationId) schedule.locationId = site.locationId
    return schedule
  })
}

/**
 * The older per-location times kept in step with the seasons, for readers
 * that still use them: each location gets the start times of the first
 * season that applies to it, and the weekdays that have any. Pass the
 * activity's `closingGapOf` so opening hours give the engine's start times.
 */
export function syncLegacyLocations(locations: ActivityLocation[], schedules: ActivitySchedule[], lengthMinutes = 0): ActivityLocation[] {
  return locations.map((site) => {
    const season = schedules.find((entry) => !entry.locationId || entry.locationId === site.locationId)
    if (!season) return site
    const weekdays = WEEKDAY_KEYS.filter((key) => timesForWeekday(season, key, lengthMinutes).length > 0).map(Number)
    const times = sortTimes(WEEKDAY_KEYS.flatMap((key) => timesForWeekday(season, key, lengthMinutes)))
    const next: ActivityLocation = { ...site, times }
    if (weekdays.length === 7 || weekdays.length === 0) delete next.weekdays
    else next.weekdays = weekdays
    return next
  })
}

/**
 * Spots in a time slot when nothing says otherwise: a charter sells once, a
 * rental its stock, everything else the activity's spots. Extra spots are not
 * in it: seasons, changes and the Schedule step count the usual spots, and a
 * time slot on sale adds the extra ones (`sellableSpots`).
 */
export function defaultSpots(activity: ScheduleSource): number {
  const kind = activity.kind ?? 'trip'
  if (kind === 'charter') return 1
  if (kind === 'rental') {
    if (activity.rental?.items?.length && activity.priceTiers) {
      return rentalItemsOf({ rental: activity.rental, priceTiers: activity.priceTiers, maxCapacity: activity.maxCapacity }).reduce((sum, item) => sum + item.rentable, 0)
    }
    return activity.rental?.units ?? activity.maxCapacity
  }
  return activity.maxCapacity
}

/** A time slot's spots on sale: its usual spots and, when it has any, the activity's extra spots. */
export const plusExtraSpots = (usual: number, extra: number) => (usual > 0 ? usual + Math.max(0, extra) : usual)

/** Spots a time slot sells when nothing says otherwise: the usual spots (`defaultSpots`) plus the extra spots. */
export const sellableSpots = (activity: ScheduleSource) => plusExtraSpots(defaultSpots(activity), slotExtraSpotsOf(activity))

/**
 * A seeded time slot's spots on sale after an edit: its own usual spots (the
 * server's, less the extra spots it was seeded with), or the edited
 * schedule's when the edit set them (a season, a change, new spots in Basics),
 * plus the edit's extra spots.
 */
export function spotsAfterEdit(serverCapacity: number, entry: Pick<ScheduledSlot, 'capacity' | 'capacitySet'>, spotsChanged: boolean, extraWas: number, extraNow: number): number {
  const was = Math.max(0, serverCapacity - extraWas)
  const usual = was === entry.capacity || !(entry.capacitySet || spotsChanged) ? was : entry.capacity
  return plusExtraSpots(usual, extraNow)
}

function spotsFor(activity: ScheduleSource, base: number, explicit: number | undefined): number {
  const kind = activity.kind ?? 'trip'
  if (kind === 'charter') return 1
  if (explicit === undefined || !Number.isFinite(explicit)) return base
  const spots = Math.max(0, Math.floor(explicit))
  // A rental can't sell more than it owns.
  return kind === 'rental' ? Math.min(spots, base) : spots
}

/** The location ids the activity runs from; [undefined] when it has none. */
function locationIdsOf(activity: ScheduleSource): (string | undefined)[] {
  const ids = [...new Set((activity.locations ?? []).map((site) => site.locationId).filter(Boolean))]
  return ids.length > 0 ? ids : [undefined]
}

/** The business's closed days and public holidays in a range, unless the activity runs on them. */
export function closedDaysBetween(
  fromKey: string,
  toKey: string,
  ctx: Pick<ScheduleContext, 'closures' | 'holidays'>,
  runsOnClosures?: boolean,
): Map<string, { by: 'closure' | 'holiday'; reason: string }> {
  const out = new Map<string, { by: 'closure' | 'holiday'; reason: string }>()
  if (runsOnClosures) return out
  for (const closure of ctx.closures ?? []) {
    for (const dateKey of closure.dates ?? []) {
      if (dateKey >= fromKey && dateKey <= toKey && !out.has(dateKey)) out.set(dateKey, { by: 'closure', reason: closure.reason?.trim() || 'Closed' })
    }
  }
  if (ctx.holidays?.enabled && ctx.holidays.country) {
    for (const [dateKey, name] of holidaysBetween(ctx.holidays.country, fromKey, toKey)) {
      if (!out.has(dateKey)) out.set(dateKey, { by: 'holiday', reason: name })
    }
  }
  return out
}

/** The last day guests can book: the activity's own window, or the business default in days. */
export function bookingWindowEnd(activity: Pick<ScheduleSource, 'bookingWindow'>, todayKey: string, maxAdvanceDays = 365): string {
  const months = activity.bookingWindow?.monthsAhead
  if (months && months > 0) return addMonthsKey(todayKey, Math.floor(months))
  return shiftDayKey(todayKey, Math.max(0, Math.floor(maxAdvanceDays)))
}

/** The booking window in months, for showing: the activity's own, or the business default rounded. */
export function bookingWindowMonths(activity: Pick<ScheduleSource, 'bookingWindow'>, maxAdvanceDays = 365): number {
  const months = activity.bookingWindow?.monthsAhead
  if (months && months > 0) return Math.floor(months)
  return Math.max(1, Math.round(maxAdvanceDays / 30.42))
}

/* ---------- expansion ---------- */

/**
 * Every day in a range with its time slots, per location. Seasons apply in
 * list order (a later one wins where they overlap); business closed days
 * and public holidays close the day unless the activity runs on them; the
 * activity's own changes then apply in their order. An extra time (or
 * different times) on a closed day runs only when the change is for that
 * day alone; one over several days skips the closed ones. An extra time
 * the day already has stays as it was. Deterministic.
 */
export function expandDays(activity: ScheduleSource, fromKey: string, toKey: string, ctx: ScheduleContext = {}): ScheduledDay[] {
  if (!isDayKey(fromKey) || !isDayKey(toKey) || fromKey > toKey) return []
  const schedules = schedulesOf(activity)
  const changes = activity.scheduleChanges ?? []

  // What guests can book: from now plus the notice, up to the booking window.
  let minStart = ''
  let lastKey = toKey
  let firstKey = fromKey
  if (ctx.bookable) {
    const now = ctx.bookable.nowIso.slice(0, 19)
    const notice = activity.noticeHours ?? activity.charter?.noticeHours ?? 0
    minStart = notice > 0 ? plusMinutes(now, notice * 60) : now.length === 16 ? `${now}:00` : now
    const todayKey = now.slice(0, 10)
    if (todayKey > firstKey) firstKey = todayKey
    const windowEnd = bookingWindowEnd(activity, todayKey, ctx.bookable.maxAdvanceDays)
    if (windowEnd < lastKey) lastKey = windowEnd
    if (firstKey > lastKey) return []
  }

  const closedBy = closedDaysBetween(firstKey, lastKey, ctx, activity.runsOnClosures)
  const changesByDay = new Map<string, ScheduleChange[]>()
  for (const change of changes) {
    for (const dateKey of change.dates ?? []) {
      if (dateKey < firstKey || dateKey > lastKey) continue
      const list = changesByDay.get(dateKey)
      if (list) {
        if (!list.includes(change)) list.push(change)
      } else changesByDay.set(dateKey, [change])
    }
  }

  const base = defaultSpots(activity)
  const pass = (activity.kind ?? 'trip') === 'pass'
  const length = closingGapOf(activity)
  const locations = ctx.locationId !== undefined ? [ctx.locationId] : locationIdsOf(activity)
  const perLocation = locations.map((locationId) => ({
    locationId,
    seasons: schedules.filter((season) => !season.locationId || locationId === undefined || season.locationId === locationId),
  }))
  // Start times per season and weekday, worked out once.
  const weekly = new Map<ActivitySchedule, string[][]>()
  const timesOf = (season: ActivitySchedule, weekday: number) => {
    let week = weekly.get(season)
    if (!week) {
      week = WEEKDAY_KEYS.map((key) => timesForWeekday(season, key, length))
      weekly.set(season, week)
    }
    return week[weekday]
  }

  const out: ScheduledDay[] = []
  const cursor = dateOf(firstKey)
  for (let dateKey = firstKey; dateKey <= lastKey; cursor.setDate(cursor.getDate() + 1), dateKey = keyOf(cursor)) {
    const weekday = cursor.getDay()
    const businessClosed = closedBy.get(dateKey)
    const dayChanges = changesByDay.get(dateKey)

    for (const { locationId, seasons } of perLocation) {
      let season: ActivitySchedule | undefined
      for (let index = seasons.length - 1; index >= 0; index--) {
        const entry = seasons[index]
        if ((entry.from == null || entry.from <= dateKey) && (entry.to == null || dateKey <= entry.to)) {
          season = entry
          break
        }
      }

      /** time → its own spots and the change that set it. */
      const times = new Map<string, { spots?: number; change?: ScheduleChange }>()
      let closed: ScheduledDay['closed'] = businessClosed ? { ...businessClosed } : undefined
      if (season && !closed) for (const time of timesOf(season, weekday)) times.set(time, {})

      let changed = false
      let daySpots: { spots: number; change: ScheduleChange } | undefined
      const timeSpots = new Map<string, ScheduleChange>()
      for (const change of dayChanges ?? []) {
        if (change.locationId && locationId !== undefined && change.locationId !== locationId) continue
        const listed = sortTimes(change.times ?? [])
        if (change.action === 'closed') {
          if (listed.length === 0) {
            times.clear()
            closed = { by: 'change', reason: change.reason?.trim() || 'Closed' }
          } else {
            for (const time of listed) times.delete(time)
            changed = true
          }
        } else if (change.action === 'times' || change.action === 'add') {
          // Over several days, a closed one stays closed; a change for that day alone opens it.
          if (closed && new Set(change.dates).size !== 1) continue
          if (change.action === 'times') {
            times.clear()
            changed = true
          }
          for (const time of listed) {
            // A time the day already has keeps its own spots and stays the season's (or the change's that gave it).
            if (change.action === 'add' && times.has(time)) continue
            times.set(time, { spots: change.spots, change })
            changed = true
          }
          if (listed.length > 0) closed = undefined
        } else if (change.action === 'spots' && change.spots !== undefined) {
          if (listed.length === 0) daySpots = { spots: change.spots, change }
          else for (const time of listed) timeSpots.set(time, change)
          changed = true
        }
      }
      if (times.size > 0) closed = undefined

      const slots: ScheduledSlot[] = []
      for (const time of [...times.keys()].sort()) {
        if (minStart && `${dateKey}T${time}:00` < minStart) continue
        const own = times.get(time)!
        const byTime = timeSpots.get(time)
        const explicit = byTime?.spots ?? own.spots ?? daySpots?.spots ?? season?.capacity
        const source = byTime ?? own.change ?? daySpots?.change
        const slot: ScheduledSlot = {
          dateKey,
          time,
          capacity: spotsFor(activity, base, explicit),
          scheduleId: season?.id ?? null,
        }
        if (explicit !== undefined) slot.capacitySet = true
        if (locationId !== undefined) slot.locationId = locationId
        if (source) slot.change = { id: source.id, action: source.action, ...(source.reason ? { reason: source.reason } : {}) }
        slots.push(slot)
      }
      const day: ScheduledDay = { dateKey, scheduleId: season?.id ?? null, slots, changed }
      if (locationId !== undefined) day.locationId = locationId
      if (closed) day.closed = closed
      if (pass && slots.length > 0) day.dayLimit = spotsFor(activity, base, daySpots?.spots ?? season?.capacity)
      out.push(day)
    }
  }
  return out
}

/** Every time slot in a range (inclusive day keys), in date and time order per location. */
export function expandSchedules(activity: ScheduleSource, fromKey: string, toKey: string, ctx: ScheduleContext = {}): ScheduledSlot[] {
  return expandDays(activity, fromKey, toKey, ctx).flatMap((day) => day.slots)
}

/** The schedule context from Settings → Booking flow. */
export function scheduleContextOf(defaults: { closures?: BusinessClosure[]; holidays?: { country: string; enabled: boolean } }): Pick<ScheduleContext, 'closures' | 'holidays'> {
  return { closures: defaults.closures ?? [], holidays: defaults.holidays ?? null }
}

/* ---------- ids for time slots that aren't seeded ---------- */

/** `gen_<activityId>_<YYYYMMDD>_<HHMM>[_<locationId>]`. */
export function slotId(activityId: string, dateKey: string, time: string, locationId?: string): string {
  return `gen_${activityId}_${dateKey.replace(/-/g, '')}_${time.replace(':', '')}${locationId ? `_${locationId}` : ''}`
}

export const isGeneratedSlotId = (id: string | undefined | null): id is string => typeof id === 'string' && id.startsWith('gen_')

/** The id of the `closed` change the calendar's "Cancel" saves: one per day, start time and location. */
export function cancelChangeId(dateKey: string, time: string, locationId?: string): string {
  return `closed_${dateKey}_${time.replace(':', '')}_${locationId ?? ''}`
}

/** The time slot was called off from the calendar (not just closed on the Schedule step). */
export function isCancelledSlot(activity: Pick<ScheduleSource, 'scheduleChanges'>, startsAt: string, locationId?: string): boolean {
  const id = cancelChangeId(startsAt.slice(0, 10), startsAt.slice(11, 16), locationId)
  return (activity.scheduleChanges ?? []).some((change) => change.id === id && change.action === 'closed')
}

/** A generated time slot this browser has bookings on. */
export interface BookedGeneratedSlot {
  id: string
  dateKey: string
  /** "HH:MM". */
  time: string
  locationId?: string
  /** Spots this browser's bookings take on it. */
  booked: number
}

/**
 * The generated time slots of one activity that this browser's bookings
 * (the ledger's seats per time slot) still hold, in a range of days, in
 * date and time order. They run for their guests even when the schedule no
 * longer has their time.
 */
export function bookedGeneratedSlots(activityId: string, delta: Record<string, number> | undefined, fromKey: string, toKey: string): BookedGeneratedSlot[] {
  const out: BookedGeneratedSlot[] = []
  for (const [id, seats] of Object.entries(delta ?? {})) {
    if (!(seats > 0) || !isGeneratedSlotId(id)) continue
    const parsed = parseSlotId(id)
    if (!parsed || parsed.activityId !== activityId || parsed.dateKey < fromKey || parsed.dateKey > toKey) continue
    out.push({ id, dateKey: parsed.dateKey, time: parsed.time, ...(parsed.locationId ? { locationId: parsed.locationId } : {}), booked: seats })
  }
  return out.sort((a, b) => (a.dateKey !== b.dateKey ? (a.dateKey < b.dateKey ? -1 : 1) : a.time < b.time ? -1 : a.time > b.time ? 1 : 0))
}

/** The parts of a generated id, or null when it isn't one. */
export function parseSlotId(id: string): { activityId: string; dateKey: string; time: string; locationId?: string } | null {
  const match = /^gen_(.+?)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(?:_(.+))?$/.exec(id)
  if (!match) return null
  const [, activityId, y, m, d, hh, mm, locationId] = match
  const time = normalizeTime(`${hh}:${mm}`)
  const dateKey = `${y}-${m}-${d}`
  // A real calendar day: month 1–12 and a day that month has (no 2026-13-10 or Feb 30).
  const date = dateOf(dateKey)
  if (!time || date.getMonth() + 1 !== Number(m) || date.getDate() !== Number(d)) return null
  return locationId ? { activityId, dateKey, time, locationId } : { activityId, dateKey, time }
}

/**
 * A time slot built from a generated id, for the server (checkout, the
 * manage page): the activity's default spots, nothing booked yet.
 */
export function departureFromSlotId(
  activity: Pick<Activity, 'id' | 'tenantId' | 'durationMinutes' | 'requiredResourceIds' | 'locations' | 'maxCapacity'> &
    Partial<Pick<Activity, 'kind' | 'rental' | 'priceTiers' | 'extraSpots' | 'chargeBy' | 'groupPrice' | 'charter'>>,
  id: string,
): Departure | undefined {
  const parsed = parseSlotId(id)
  if (!parsed || parsed.activityId !== activity.id) return undefined
  const startsAt = `${parsed.dateKey}T${parsed.time}:00`
  return {
    id,
    tenantId: activity.tenantId,
    activityId: activity.id,
    locationId: parsed.locationId ?? activity.locations[0]?.locationId,
    startsAt,
    endsAt: plusMinutes(startsAt, Math.max(0, activity.durationMinutes || 0)),
    capacity: sellableSpots(activity),
    booked: 0,
    held: 0,
    status: 'scheduled',
    assignedStaffIds: [],
    assignedResourceIds: activity.requiredResourceIds ?? [],
  }
}

/** A storefront time slot for a departure the seeded strip doesn't have (a generated one). */
export function slotFromDeparture(
  activity: Pick<Activity, 'basePrice' | 'kind' | 'rental' | 'priceTiers' | 'maxCapacity'>,
  departure: Pick<Departure, 'id' | 'startsAt' | 'endsAt' | 'capacity' | 'booked' | 'held' | 'status' | 'locationId' | 'priceMultiplier'>,
): AvailabilitySlot {
  const seatsLeft = Math.max(0, departure.capacity - departure.booked - departure.held)
  const multiplier = departure.priceMultiplier ?? 1
  const itemsLeft = hasItems(activity) ? Object.fromEntries(rentalItemsOf(activity).map((item) => [item.tierId, Math.min(item.rentable, seatsLeft)])) : undefined
  return {
    departureId: departure.id,
    startsAt: departure.startsAt,
    endsAt: departure.endsAt,
    capacity: departure.capacity,
    seatsLeft,
    status: departure.status,
    priceMultiplier: multiplier,
    leadPrice: Math.round(activity.basePrice * multiplier),
    ...(departure.locationId ? { locationId: departure.locationId } : {}),
    ...(itemsLeft ? { itemsLeft } : {}),
    soldOut: seatsLeft <= 0 || departure.status === 'sold_out',
  }
}

/* ---------- what an edit does to booked time slots ---------- */

const matchKey = (dateKey: string, time: string, locationId: string | undefined) => `${dateKey}|${time}|${locationId ?? ''}`

/**
 * The booked time slots an edit would take off the schedule: on it before,
 * not after. They stay as they are; this is for the warning.
 */
export function scheduleImpact<T extends { startsAt: string; booked: number; locationId?: string; status?: string }>(
  before: ScheduleSource,
  after: ScheduleSource,
  bookedSlots: T[],
  ctx: Pick<ScheduleContext, 'closures' | 'holidays'> = {},
): T[] {
  const live = bookedSlots.filter((slot) => slot.booked > 0 && slot.status !== 'cancelled')
  if (live.length === 0) return []
  let fromKey = live[0].startsAt.slice(0, 10)
  let toKey = fromKey
  for (const slot of live) {
    const key = slot.startsAt.slice(0, 10)
    if (key < fromKey) fromKey = key
    if (key > toKey) toKey = key
  }
  const index = (source: ScheduleSource) => {
    const primary = source.locations?.[0]?.locationId
    return new Set(expandSchedules(source, fromKey, toKey, ctx).map((slot) => matchKey(slot.dateKey, slot.time, slot.locationId ?? primary)))
  }
  const had = index(before)
  const has = index(after)
  const primary = after.locations?.[0]?.locationId ?? before.locations?.[0]?.locationId
  return live.filter((slot) => {
    const key = matchKey(slot.startsAt.slice(0, 10), slot.startsAt.slice(11, 16), slot.locationId ?? primary)
    return had.has(key) && !has.has(key)
  })
}

/* ---------- one-line summary ---------- */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** "May 1". */
export const shortDay = (dateKey: string) => `${MONTHS[Number(dateKey.slice(5, 7)) - 1]} ${Number(dateKey.slice(8, 10))}`
/** "9:00", "13:30". */
export const clockTime = (time: string) => `${Number(time.slice(0, 2))}:${time.slice(3, 5)}`

const listWords = (items: string[]) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/** "daily", "weekdays", "weekends", "Tue–Sun", "Mon, Wed and Fri". */
export function weekdaysPhrase(weekdays: number[]): string {
  const set = new Set(weekdays)
  if (set.size === 7) return 'daily'
  if (set.size === 0) return 'on no days'
  if (set.size === 5 && [1, 2, 3, 4, 5].every((day) => set.has(day))) return 'weekdays'
  if (set.size === 2 && set.has(0) && set.has(6)) return 'weekends'
  // A run in Monday-first order: Tue–Sun, Fri–Mon.
  const order = [1, 2, 3, 4, 5, 6, 0]
  const on = order.map((day) => set.has(day))
  for (let start = 0; start < 7; start++) {
    if (!on[start] || on[(start + 6) % 7]) continue
    let length = 0
    while (length < 7 && on[(start + length) % 7]) length++
    if (length === set.size && length >= 3) return `${DAY_SHORT[order[start]]}–${DAY_SHORT[order[(start + length - 1) % 7]]}`
  }
  return listWords(order.filter((day) => set.has(day)).map((day) => DAY_SHORT[day]))
}

function seasonPhrase(season: ActivitySchedule): string {
  const open = WEEKDAY_KEYS.filter((key) => timesForWeekday(season, key).length > 0)
  if (open.length === 0) return 'No times set'
  const days = weekdaysPhrase(open.map(Number))
  let what: string
  if (season.mode === 'hours') {
    const hours = open.map((key) => season.hours?.[key]).filter((entry): entry is { open: string; close: string } => Boolean(entry))
    const same = hours.every((entry) => entry.open === hours[0].open && entry.close === hours[0].close)
    const every = Math.max(5, Math.floor(season.every ?? 30))
    what = same
      ? `Open ${days} ${clockTime(normalizeTime(hours[0].open) ?? hours[0].open)}–${clockTime(normalizeTime(hours[0].close) ?? hours[0].close)}, a start time every ${every} min`
      : `Open ${days}, hours vary by day, a start time every ${every} min`
  } else {
    const lists = open.map((key) => timesForWeekday(season, key).join(','))
    const same = lists.every((entry) => entry === lists[0])
    const times = timesForWeekday(season, open[0])
    what = !same
      ? `Runs ${days}, times vary by day`
      : times.length > 4
        ? `Runs ${days}, ${times.length} times a day from ${clockTime(times[0])}`
        : `Runs ${days} at ${listWords(times.map(clockTime))}`
  }
  const range = season.from && season.to ? `${shortDay(season.from)} – ${shortDay(season.to)}` : season.from ? `from ${shortDay(season.from)}` : season.to ? `until ${shortDay(season.to)}` : ''
  return range ? `${what}, ${range}` : what
}

/**
 * One line for the schedule: "Runs Tue–Sun at 9:00 and 13:30, May 1 – Oct 31
 * · 2 closed days · books up to 12 months ahead".
 */
export function describeSchedules(
  activity: ScheduleSource,
  options: { maxAdvanceDays?: number; todayKey?: string; locationId?: string } = {},
): string {
  const todayKey = options.todayKey ?? TODAY_KEY
  const all = schedulesOf(activity)
  const seasons = options.locationId ? all.filter((season) => !season.locationId || season.locationId === options.locationId) : all
  // Seasons that are over don't count.
  const current = seasons.filter((season) => season.to == null || season.to >= todayKey)
  const parts: string[] = []
  const shown = current.length > 0 ? current : seasons
  const phraseOf = (list: ActivitySchedule[]) =>
    list.length === 1 ? seasonPhrase(list[0]) : `${list.length} seasons: ${listWords([...new Set(list.map((season) => season.name.trim() || 'All year'))])}`
  if (shown.length === 0) {
    const extra = (activity.scheduleChanges ?? []).filter((change) => change.action === 'add' || change.action === 'times')
    const dates = new Set(extra.flatMap((change) => change.dates.filter((dateKey) => dateKey >= todayKey)))
    parts.push(dates.size > 0 ? `Runs on ${dates.size} ${dates.size === 1 ? 'date' : 'dates'}` : 'No times set')
  } else {
    // More than one location, each with its own seasons: the first one, and how many differ.
    const scoped = [...new Set(shown.map((season) => season.locationId).filter((id): id is string => Boolean(id)))]
    if (!options.locationId && scoped.length > 1) {
      const phrases = scoped.map((id) => phraseOf(shown.filter((season) => !season.locationId || season.locationId === id)))
      const others = phrases.slice(1).filter((phrase) => phrase !== phrases[0]).length
      parts.push(others > 0 ? `${phrases[0]} · other times at ${others} more ${others === 1 ? 'location' : 'locations'}` : phrases[0])
    } else {
      parts.push(phraseOf(shown))
    }
  }

  const changes = (activity.scheduleChanges ?? []).filter((change) => !options.locationId || !change.locationId || change.locationId === options.locationId)
  const closedDays = new Set<string>()
  const changedDays = new Set<string>()
  for (const change of changes) {
    for (const dateKey of change.dates ?? []) {
      if (dateKey < todayKey) continue
      if (change.action === 'closed' && !(change.times?.length)) closedDays.add(dateKey)
      else changedDays.add(dateKey)
    }
  }
  for (const dateKey of closedDays) changedDays.delete(dateKey)
  if (closedDays.size > 0) parts.push(`${closedDays.size} closed ${closedDays.size === 1 ? 'day' : 'days'}`)
  if (changedDays.size > 0) parts.push(`${changedDays.size} changed ${changedDays.size === 1 ? 'day' : 'days'}`)

  // The business's booking window (Settings → Booking flow) is in days; an activity's own is in months.
  const months = bookingWindowMonths(activity, options.maxAdvanceDays)
  const days = activity.bookingWindow?.monthsAhead ? undefined : Math.max(0, Math.floor(options.maxAdvanceDays ?? 365))
  parts.push(days !== undefined ? `books up to ${days} ${days === 1 ? 'day' : 'days'} ahead` : `books up to ${months} ${months === 1 ? 'month' : 'months'} ahead`)
  return parts.join(' · ')
}

/* ---------- rebuilding a seeded day strip from the schedule ---------- */

export interface RebuildContext extends Pick<ScheduleContext, 'closures' | 'holidays'> {
  /** The demo clock, local ISO. */
  nowIso: string
  /** Settings → Booking flow: how far ahead guests can book, in days. */
  maxAdvanceDays?: number
  /** Seats this browser's bookings take per time slot, so a booked slot the schedule dropped is kept. */
  delta?: Record<string, number>
}

/** A storefront slot; `outsideSchedule` marks one the schedule dropped that already has bookings. */
export type ScheduledAvailabilitySlot = AvailabilitySlot

/** The most days ahead the storefront lists, from today, when the booking window reaches past the seeded strip. */
export const STOREFRONT_HORIZON_DAYS = 90

const slotTime = (startsAt: string) => startsAt.slice(11, 16)

/** An edit saved without spots (older saves) keeps the seeded activity's, so it never reads as "no spots". */
function withSeededSpots<T extends Pick<Activity, 'maxCapacity'>>(seeded: Pick<Activity, 'maxCapacity'>, edited: T): T {
  return edited.maxCapacity > 0 || !(seeded.maxCapacity > 0) ? edited : { ...edited, maxCapacity: seeded.maxCapacity }
}

/**
 * The storefront's day strip rebuilt from the edited schedule. Seeded time
 * slots the schedule still has keep their id and bookings; new ones are
 * generated; seeded ones it dropped, and generated ones this browser booked
 * (`delta`), stay only when they have bookings (full, marked outside the
 * schedule). The seeded days come first, then the days after them up to the
 * booking window (at most `STOREFRONT_HORIZON_DAYS` from today), made from
 * the schedule alone. The notice, the booking window, the daily limit and a
 * pass's tickets per day apply like `buildDays`.
 */
export function rebuildAvailabilityDays(seeded: Activity, editedActivity: Activity, seededDays: AvailabilityDay[], ctx: RebuildContext): AvailabilityDay[] {
  if (seededDays.length === 0 || (editedActivity.kind ?? 'trip') === 'package') return seededDays
  const edited = withSeededSpots(seeded, editedActivity)
  const fromKey = seededDays[0].dateKey
  const stripEnd = seededDays[seededDays.length - 1].dateKey
  const now = ctx.nowIso.slice(0, 19).length === 16 ? `${ctx.nowIso.slice(0, 16)}:00` : ctx.nowIso.slice(0, 19)
  const todayKey = now.slice(0, 10)
  const windowEnd = bookingWindowEnd(edited, todayKey, ctx.maxAdvanceDays)
  // After the seeded strip: the booking window, never past the horizon.
  const horizonEnd = shiftDayKey(todayKey, STOREFRONT_HORIZON_DAYS - 1)
  const lastExtra = windowEnd < horizonEnd ? windowEnd : horizonEnd
  const toKey = lastExtra > stripEnd ? lastExtra : stripEnd
  const primary = edited.locations[0]?.locationId ?? seeded.locations[0]?.locationId
  const closures = { closures: ctx.closures, holidays: ctx.holidays }
  const delta = ctx.delta ?? {}
  const siteKey = (dateKey: string, locationId: string | undefined) => `${dateKey}|${locationId ?? primary ?? ''}`

  const plan = new Map<string, ScheduledSlot[]>()
  // Passes: the tickets each day sells, per location.
  const passLimits = new Map<string, number>()
  for (const day of expandDays(edited, fromKey, toKey, { ...closures, bookable: { nowIso: ctx.nowIso, maxAdvanceDays: ctx.maxAdvanceDays } })) {
    if (day.slots.length === 0) continue
    const list = plan.get(day.dateKey)
    if (list) list.push(...day.slots)
    else plan.set(day.dateKey, [...day.slots])
    if (day.dayLimit !== undefined) passLimits.set(siteKey(day.dateKey, day.locationId), day.dayLimit)
  }
  // What the seeded strip was made from: a time it had but doesn't show is cancelled or past its notice, not new.
  const legacy = new Set(expandSchedules(seeded, fromKey, stripEnd).map((slot) => matchKey(slot.dateKey, slot.time, slot.locationId ?? primary)))
  // Generated time slots this browser has bookings on, by day.
  const bookedGenerated = new Map<string, BookedGeneratedSlot[]>()
  for (const entry of bookedGeneratedSlots(edited.id, delta, fromKey, toKey)) bookedGenerated.set(entry.dateKey, [...(bookedGenerated.get(entry.dateKey) ?? []), entry])

  const notice = edited.noticeHours ?? edited.charter?.noticeHours ?? 0
  const minStart = notice > 0 ? plusMinutes(now, notice * 60) : ''
  // Spots changed in Basics: seeded time slots take the new number too. Extra spots go on top of each one's spots.
  const spotsChanged = defaultSpots(edited) !== defaultSpots(seeded)
  const extraWas = slotExtraSpotsOf(seeded)
  const extraNow = slotExtraSpotsOf(edited)
  const extraDays: AvailabilityDay[] = []
  for (let dateKey = shiftDayKey(stripEnd, 1); dateKey <= lastExtra; dateKey = shiftDayKey(dateKey, 1)) extraDays.push({ dateKey, slots: [], fromPrice: 0, seatsLeft: 0, soldOut: false })
  // Rentals with items: a day after the strip lends out no more than the seeded time slots it overlaps have left.
  const allSeeded = extraDays.length > 0 && hasItems(edited) ? seededDays.flatMap((day) => day.slots) : []

  return [...seededDays, ...extraDays].map((day) => {
    // Past the booking window nothing is on sale.
    if (day.dateKey > windowEnd) return { dateKey: day.dateKey, slots: [], fromPrice: 0, seatsLeft: 0, soldOut: false }
    const extra = day.dateKey > stripEnd
    const seededSlots = day.slots
    const byKey = new Map(seededSlots.map((slot) => [matchKey(day.dateKey, slotTime(slot.startsAt), slot.locationId ?? primary), slot]))
    const used = new Set<string>()
    const slots: ScheduledAvailabilitySlot[] = []
    const fresh: ScheduledAvailabilitySlot[] = []
    for (const entry of plan.get(day.dateKey) ?? []) {
      const key = matchKey(entry.dateKey, entry.time, entry.locationId ?? primary)
      const match = byKey.get(key)
      if (match) {
        used.add(match.departureId)
        const capacity = spotsAfterEdit(match.capacity, entry, spotsChanged, extraWas, extraNow)
        if (capacity === match.capacity) {
          slots.push(match)
        } else {
          // Different spots: what is sold stays sold.
          const sold = Math.max(0, match.capacity - match.seatsLeft)
          const seatsLeft = Math.max(0, capacity - sold)
          const status = match.status === 'sold_out' && seatsLeft > 0 ? 'scheduled' : match.status
          slots.push({ ...match, capacity: Math.max(capacity, sold), seatsLeft, status, soldOut: seatsLeft <= 0 || status === 'sold_out' })
        }
        continue
      }
      if (legacy.has(key)) continue
      const startsAt = `${entry.dateKey}T${entry.time}:00`
      const generated = slotFromDeparture(edited, {
        id: slotId(edited.id, entry.dateKey, entry.time, entry.locationId),
        startsAt,
        endsAt: plusMinutes(startsAt, Math.max(0, edited.durationMinutes || 0)),
        capacity: plusExtraSpots(entry.capacity, extraNow),
        booked: 0,
        held: 0,
        status: 'scheduled',
        locationId: entry.locationId ?? primary,
      })
      const slot = capRentalItems(edited, generated, extra ? allSeeded : seededSlots)
      slots.push(slot)
      fresh.push(slot)
    }
    // Booked time slots the schedule dropped still run for their guests, but take no new bookings.
    for (const slot of seededSlots) {
      if (used.has(slot.departureId)) continue
      // Called off from the calendar: its guests were cancelled and refunded, so it leaves the strip.
      if (isCancelledSlot(edited, slot.startsAt, slot.locationId)) continue
      // Real bookings only (with this browser's bookings and cancellations): spots held by carts or a daily limit don't keep it.
      const sold = (slot.booked ?? Math.max(0, slot.capacity - slot.seatsLeft)) + (delta[slot.departureId] ?? 0)
      if (sold <= 0) continue
      if (minStart && slot.startsAt < minStart) continue
      slots.push({ ...slot, seatsLeft: 0, soldOut: true, outsideSchedule: true })
    }
    // The same for generated time slots this browser booked: never dropped while they have guests.
    const shown = new Set(slots.map((slot) => slot.departureId))
    for (const entry of bookedGenerated.get(day.dateKey) ?? []) {
      if (shown.has(entry.id)) continue
      const locationId = entry.locationId ?? primary
      // A seeded time slot already holds that time.
      if (byKey.has(matchKey(entry.dateKey, entry.time, locationId))) continue
      const startsAt = `${entry.dateKey}T${entry.time}:00`
      if (startsAt < now || (minStart && startsAt < minStart) || isCancelledSlot(edited, startsAt, locationId)) continue
      const generated = slotFromDeparture(edited, {
        id: entry.id,
        startsAt,
        endsAt: plusMinutes(startsAt, Math.max(0, edited.durationMinutes || 0)),
        capacity: Math.max(sellableSpots(edited), entry.booked),
        booked: 0,
        held: 0,
        status: 'scheduled',
        locationId,
      })
      slots.push({ ...generated, seatsLeft: 0, soldOut: true, outsideSchedule: true })
      shown.add(entry.id)
    }
    const sorted = slots.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0))
    const freshIds = new Set(fresh.map((slot) => slot.departureId))
    const limited = applyDayLimitToNew(edited, day.dateKey, sorted, freshIds)
    const passed = applyPassLimit(limited, (locationId) => passLimits.get(siteKey(day.dateKey, locationId)), primary, delta, freshIds)
    const open = passed.slots.filter((slot) => !slot.soldOut)
    const left = open.reduce((total, slot) => total + slot.seatsLeft, 0)
    return {
      dateKey: day.dateKey,
      slots: passed.slots,
      fromPrice: open.length > 0 ? Math.min(...open.map((slot) => slot.leadPrice)) : 0,
      seatsLeft: passed.room === undefined ? left : Math.min(left, passed.room),
      soldOut: passed.slots.length > 0 && open.length === 0,
    }
  })
}

/**
 * Passes: a day's tickets are shared by its time slots. Every slot's sales
 * count, this browser's bookings included; the ledger takes a slot's own
 * bookings off afterwards (`withLedger`), so each slot's room adds those
 * back. `room` is what the day has left.
 */
function applyPassLimit(
  slots: ScheduledAvailabilitySlot[],
  limitAt: (locationId: string | undefined) => number | undefined,
  primary: string | undefined,
  delta: Record<string, number>,
  fresh: Set<string>,
): { slots: ScheduledAvailabilitySlot[]; room?: number } {
  const bySite = new Map<string, ScheduledAvailabilitySlot[]>()
  for (const slot of slots) {
    const key = slot.locationId ?? primary ?? ''
    bySite.set(key, [...(bySite.get(key) ?? []), slot])
  }
  const out = new Map<string, ScheduledAvailabilitySlot>()
  let room: number | undefined
  for (const [key, list] of bySite) {
    const limit = limitAt(key || undefined)
    if (limit === undefined) continue
    // Sold on the server (generated slots have nothing there), then this browser's bookings and cancellations.
    const taken = list.reduce((sum, slot) => {
      const server = slot.booked ?? (fresh.has(slot.departureId) || isGeneratedSlotId(slot.departureId) ? 0 : Math.max(0, slot.capacity - slot.seatsLeft))
      return sum + server + (delta[slot.departureId] ?? 0)
    }, 0)
    const left = Math.max(0, limit - taken)
    room = (room ?? 0) + left
    for (const slot of list) {
      if (slot.outsideSchedule) continue
      const seatsLeft = Math.max(0, Math.min(slot.seatsLeft, left + (delta[slot.departureId] ?? 0)))
      if (seatsLeft !== slot.seatsLeft) out.set(slot.departureId, { ...slot, seatsLeft, soldOut: slot.soldOut || seatsLeft <= 0 })
    }
  }
  return { slots: out.size === 0 ? slots : slots.map((slot) => out.get(slot.departureId) ?? slot), room }
}

/**
 * Rentals with items: a generated time slot can't lend out what the seeded
 * time slots it overlaps already have out (the browser doesn't see the
 * bookings themselves). Errs towards lending less. Checkout counts the real
 * holds on the server.
 */
function capRentalItems(activity: Activity, slot: AvailabilitySlot, seededSlots: AvailabilitySlot[]): AvailabilitySlot {
  if (!slot.itemsLeft) return slot
  const window = shortestRentalMs(activity, slot.startsAt)
  const itemsLeft = { ...slot.itemsLeft }
  let capped = false
  for (const other of seededSlots) {
    if (!other.itemsLeft) continue
    const span = shortestRentalMs(activity, other.startsAt)
    if (span.startMs >= window.endMs || span.endMs <= window.startMs) continue
    for (const [tierId, left] of Object.entries(other.itemsLeft)) {
      if (tierId in itemsLeft && left < itemsLeft[tierId]) {
        itemsLeft[tierId] = Math.max(0, left)
        capped = true
      }
    }
  }
  if (!capped) return slot
  const seatsLeft = Math.min(slot.seatsLeft, Object.values(itemsLeft).reduce((sum, value) => sum + value, 0))
  return { ...slot, itemsLeft, seatsLeft, soldOut: slot.soldOut || seatsLeft <= 0 }
}

/**
 * The daily limit on generated time slots. Seeded ones already had it
 * applied on the server, so they only count towards what the day has sold.
 * In bookings, a day whose seeded slots are all sold out stays sold out.
 */
function applyDayLimitToNew(activity: Activity, dateKey: string, slots: ScheduledAvailabilitySlot[], fresh: Set<string>): ScheduledAvailabilitySlot[] {
  if (fresh.size === 0) return slots
  const weekday = dateOf(dateKey).getDay()
  const siteOf = (slot: AvailabilitySlot) => activity.locations.find((site) => site.locationId === slot.locationId) ?? activity.locations[0]
  const out = new Map<string, ScheduledAvailabilitySlot>()
  const bySite = new Map<string, ScheduledAvailabilitySlot[]>()
  for (const slot of slots) {
    const key = siteOf(slot)?.locationId ?? ''
    bySite.set(key, [...(bySite.get(key) ?? []), slot])
  }
  for (const [key, list] of bySite) {
    const site = activity.locations.find((entry) => entry.locationId === key) ?? activity.locations[0]
    const limit = site?.dayCapacity?.[weekday]
    if (!limit || limit <= 0) continue
    const seededList = list.filter((slot) => !fresh.has(slot.departureId))
    if (site?.dayLimitUnit === 'bookings') {
      if (seededList.length > 0 && seededList.every((slot) => slot.soldOut)) {
        for (const slot of list) if (fresh.has(slot.departureId)) out.set(slot.departureId, { ...slot, seatsLeft: 0, soldOut: true })
      }
      continue
    }
    const sold = seededList.reduce((sum, slot) => sum + Math.max(0, slot.capacity - slot.seatsLeft), 0)
    const room = Math.max(0, limit - sold)
    for (const slot of list) {
      if (!fresh.has(slot.departureId)) continue
      const seatsLeft = Math.min(slot.seatsLeft, room)
      out.set(slot.departureId, { ...slot, seatsLeft, soldOut: slot.soldOut || seatsLeft <= 0 })
    }
  }
  return out.size === 0 ? slots : slots.map((slot) => out.get(slot.departureId) ?? slot)
}

/* ---------- the dashboard's time slot list ---------- */

/** A dashboard row marked when it was generated from the schedule, or is booked but no longer on it. */
export type ScheduledRow = DepartureRowLite & { generated?: boolean; outsideSchedule?: boolean }

/**
 * The activity's Schedule tab rows rebuilt from the edited schedule: seeded
 * rows the schedule still has keep everything (team, weather, status);
 * new times appear as open time slots; dropped rows stay only when booked,
 * generated ones this browser booked (`delta`) included. A generated row's
 * bookings are this browser's, as the server has none.
 */
export function rebuildScheduleRows(
  seeded: Activity,
  editedActivity: Activity,
  rows: DepartureRowLite[],
  ctx: Pick<ScheduleContext, 'closures' | 'holidays'> & {
    fromKey: string
    toKey: string
    /** Generated times before this (local ISO) are left out, unless booked. */
    nowIso?: string
    /** Seats this browser's bookings take per time slot (the ledger). */
    delta?: Record<string, number>
  },
): ScheduledRow[] {
  if ((editedActivity.kind ?? 'trip') === 'package' || ctx.fromKey > ctx.toKey) return rows
  const edited = withSeededSpots(seeded, editedActivity)
  const delta = ctx.delta ?? {}
  const primary = edited.locations[0]?.locationId ?? seeded.locations[0]?.locationId
  const closures = { closures: ctx.closures, holidays: ctx.holidays }
  const plan = expandSchedules(edited, ctx.fromKey, ctx.toKey, closures)
  const legacy = new Set(expandSchedules(seeded, ctx.fromKey, ctx.toKey).map((slot) => matchKey(slot.dateKey, slot.time, slot.locationId ?? primary)))
  const byKey = new Map<string, DepartureRowLite>()
  for (const row of rows) {
    const key = matchKey(row.startsAt.slice(0, 10), slotTime(row.startsAt), row.locationId ?? primary)
    if (!byKey.has(key)) byKey.set(key, row)
  }
  const used = new Set<string>()
  const out: ScheduledRow[] = []
  const spotsChanged = defaultSpots(edited) !== defaultSpots(seeded)
  const extraWas = slotExtraSpotsOf(seeded)
  const extraNow = slotExtraSpotsOf(edited)
  for (const entry of plan) {
    const key = matchKey(entry.dateKey, entry.time, entry.locationId ?? primary)
    const match = byKey.get(key)
    if (match) {
      used.add(match.id)
      const spots = spotsAfterEdit(match.capacity, entry, spotsChanged, extraWas, extraNow)
      if (spots === match.capacity || match.status === 'cancelled' || match.status === 'completed') {
        out.push(match)
      } else {
        const capacity = Math.max(spots, match.booked)
        const status = match.status === 'sold_out' && capacity > match.booked ? 'scheduled' : match.status === 'scheduled' && match.booked >= capacity ? 'sold_out' : match.status
        out.push({ ...match, capacity, status })
      }
      continue
    }
    if (legacy.has(key)) continue
    const startsAt = `${entry.dateKey}T${entry.time}:00`
    const id = slotId(edited.id, entry.dateKey, entry.time, entry.locationId)
    const booked = Math.max(0, delta[id] ?? 0)
    if (ctx.nowIso && startsAt < ctx.nowIso.slice(0, 19) && booked <= 0) continue
    out.push(generatedRow(edited, id, startsAt, plusExtraSpots(entry.capacity, extraNow), booked, entry.locationId ?? primary))
  }
  for (const row of rows) {
    if (used.has(row.id)) continue
    const key = row.startsAt.slice(0, 10)
    // Outside the rebuilt range: untouched.
    if (key < ctx.fromKey || key > ctx.toKey) {
      out.push(row)
      continue
    }
    // Called off from the calendar: shown as cancelled, like on the calendar.
    if (row.status !== 'completed' && isCancelledSlot(edited, row.startsAt, row.locationId)) {
      out.push({ ...row, status: 'cancelled' })
      continue
    }
    if (row.booked + (delta[row.id] ?? 0) > 0) out.push({ ...row, outsideSchedule: true })
  }
  // Generated time slots this browser booked that the schedule no longer has: they still run for their guests.
  const shown = new Set(out.map((row) => row.id))
  for (const entry of bookedGeneratedSlots(edited.id, delta, ctx.fromKey, ctx.toKey)) {
    const locationId = entry.locationId ?? primary
    if (shown.has(entry.id) || byKey.has(matchKey(entry.dateKey, entry.time, locationId))) continue
    const startsAt = `${entry.dateKey}T${entry.time}:00`
    const row = generatedRow(edited, entry.id, startsAt, Math.max(sellableSpots(edited), entry.booked), entry.booked, locationId)
    out.push(isCancelledSlot(edited, startsAt, locationId) ? { ...row, status: 'cancelled' } : { ...row, outsideSchedule: true })
    shown.add(entry.id)
  }
  return out.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0))
}

/** A Schedule tab row for a generated time slot. */
function generatedRow(activity: Activity, id: string, startsAt: string, capacity: number, booked: number, locationId: string | undefined): ScheduledRow {
  return {
    id,
    startsAt,
    endsAt: plusMinutes(startsAt, Math.max(0, activity.durationMinutes || 0)),
    capacity,
    booked,
    held: 0,
    status: booked > 0 && booked >= capacity ? 'sold_out' : 'scheduled',
    staff: [],
    resources: activity.requiredResourceIds ?? [],
    locationId,
    weather: null,
    generated: true,
  }
}
