/**
 * EZRA PRO — the calendar engine.
 *
 * Every live activity is expanded into concrete, bookable departures across a
 * window of NOW − 120 days to NOW + 90 days. This is the dataset the month,
 * week, day, agenda and timeline calendars all render, so it has to be dense
 * enough to look like a real operation and coherent enough to survive an
 * operator staring at it.
 *
 * Three things drive how full a departure is:
 *   1. a per-activity base demand (a sunset sail outsells a wing-foil lesson),
 *   2. a weekly cycle (weekends for activities, Fri/Sat for dining) and a
 *      per-tenant seasonal curve (Maui peaks in July, Santorini dies in winter,
 *      Queenstown peaks in the southern summer),
 *   3. a booking lead curve — a departure three months out has barely started
 *      filling, which is what makes the forward calendar look believable.
 *
 * Start times are built with local calendar constructors rather than epoch
 * arithmetic so an "06:00 dawn patrol" is still 06:00 across a DST boundary in
 * whatever timezone the runtime happens to be in. Nothing here reads the wall
 * clock: every value derives from NOW and a seeded RNG.
 */

import type { Activity, Departure, DepartureStatus, WeatherSnapshot } from '@/types'
import {
  addDays,
  addMinutes,
  clamp,
  createRng,
  endOfDay,
  hashSeed,
  rngInt,
  rngPick,
  rngWeighted,
  startOfDay,
  toDateKey,
} from '@/lib/utils'
import { FUTURE_DAYS, NOW, seedKey } from './constants'
import { ACTIVITIES } from './activities'
import { TENANTS } from './tenants'
import { getBookableStaff } from './users'

/* ==========================================================================
   WINDOW
   ========================================================================== */

/** Days of operating history the calendar can page back through. */
export const CALENDAR_PAST_DAYS = 120

/** First and last calendar day that carries departures (local midnight bounds). */
export const CALENDAR_START = startOfDay(addDays(NOW, -CALENDAR_PAST_DAYS))
export const CALENDAR_END = endOfDay(addDays(NOW, FUTURE_DAYS))

const NOW_MS = NOW.getTime()
const DAY_MS = 86_400_000

/* ==========================================================================
   SCHEDULES
   The operating rhythm of each product. `days` is 0=Sun … 6=Sat; omitted means
   every day. `months` is 0=Jan … 11=Dec; omitted means year round.
   ========================================================================== */

interface Slot {
  /** "HH:mm" local to the tenant. */
  at: string
  /** Weekdays this particular slot runs, if narrower than the plan. */
  days?: number[]
}

interface SchedulePlan {
  slots: Slot[]
  /** Weekdays the product runs at all. */
  days?: number[]
  /** Months the product operates at all — closed seasons live here. */
  months?: number[]
  /** Average share of capacity sold at neutral season, weekday and lead time. */
  demand: number
}

/** Santorini shuts for the winter; the terrace opens in April and closes in November. */
const AEGEAN_SEASON = [3, 4, 5, 6, 7, 8, 9]

/**
 * Vessel-level conflicts were designed out of these times, not left to chance:
 * Nalu runs Lana'i (Mon/Wed/Fri/Sat mornings), charters (Tue/Thu/Sun midday) and
 * the sunset sail every evening; Kai Wa'a runs the two-tank dive at dawn, the
 * discover-scuba block after lunch and the manta dive at night. A scheduling
 * board built on this data will not open with a wall of double-booked boats.
 */
const SCHEDULES: Record<string, SchedulePlan> = {
  /* ---- Blue Horizon Watersports, Maui ---- */
  act_sunset_catamaran_sail: { slots: [{ at: '16:30' }], demand: 0.8 },
  act_molokini_dawn_patrol: { slots: [{ at: '06:00' }], demand: 0.82 },
  act_turtle_town_kayak: {
    slots: [{ at: '07:00' }, { at: '09:45', days: [0, 1, 5, 6] }],
    demand: 0.68,
  },
  act_private_sportfishing_charter: { slots: [{ at: '06:00' }], days: [0, 3, 5, 6], demand: 0.55 },
  act_jet_ski_safari: {
    slots: [{ at: '09:00' }, { at: '11:00' }, { at: '13:30', days: [0, 6] }],
    demand: 0.62,
  },
  act_beginner_surf_lesson: {
    slots: [{ at: '08:00' }, { at: '10:30', days: [0, 4, 5, 6] }],
    demand: 0.7,
  },
  act_night_manta_ray_dive: { slots: [{ at: '18:45' }], days: [2, 4, 5, 6], demand: 0.74 },
  act_lanai_coast_snorkel_sail: { slots: [{ at: '07:30' }], days: [1, 3, 5, 6], demand: 0.68 },
  act_discover_scuba_first_breath: { slots: [{ at: '12:30' }], demand: 0.66 },
  act_sunrise_paddleboard_ocean_yoga: {
    slots: [{ at: '06:15' }],
    days: [0, 1, 3, 5, 6],
    demand: 0.62,
  },
  act_two_tank_certified_reef_dive: { slots: [{ at: '07:15' }], demand: 0.7 },
  act_west_maui_snorkel_raft: { slots: [{ at: '13:00' }], days: [0, 2, 3, 4, 6], demand: 0.62 },
  act_private_catamaran_charter: { slots: [{ at: '12:00' }], days: [0, 2, 4], demand: 0.42 },

  /* ---- Coral Cay Expeditions, Port Douglas ---- */
  act_outer_reef_triple_dive: { slots: [{ at: '08:00' }], demand: 0.68 },
  act_agincourt_snorkel_sail: { slots: [{ at: '08:30' }], demand: 0.66 },
  act_coral_sea_liveaboard: { slots: [{ at: '17:00' }], days: [5], demand: 0.72 },
  act_seawalker_reef_walk: {
    slots: [{ at: '10:30' }, { at: '12:00' }, { at: '13:30', days: [0, 6] }],
    demand: 0.58,
  },
  act_low_isles_marine_biology: { slots: [{ at: '09:00' }], demand: 0.64 },
  act_reef_scenic_flight_day: { slots: [{ at: '08:00' }], days: [1, 3, 5, 6], demand: 0.58 },

  /* ---- Saltline, Santorini ---- */
  act_caldera_sunset_tasting: {
    slots: [{ at: '19:00' }, { at: '21:15', days: [0, 4, 5, 6] }],
    months: AEGEAN_SEASON,
    demand: 0.78,
  },
  act_chefs_counter_eight_course: {
    slots: [{ at: '19:30' }],
    days: [2, 3, 4, 5, 6],
    months: AEGEAN_SEASON,
    demand: 0.86,
  },
  act_assyrtiko_cellar_flight: {
    slots: [{ at: '17:00' }, { at: '19:00', days: [0, 4, 5, 6] }],
    months: AEGEAN_SEASON,
    demand: 0.58,
  },
  act_aegean_long_lunch: { slots: [{ at: '13:00' }], months: AEGEAN_SEASON, demand: 0.66 },
  act_sundown_meze_hour: {
    slots: [{ at: '17:30' }, { at: '19:45' }],
    months: AEGEAN_SEASON,
    demand: 0.62,
  },
  act_private_cave_room_dinner: {
    slots: [{ at: '20:00' }],
    days: [4, 5, 6],
    months: AEGEAN_SEASON,
    demand: 0.48,
  },

  /* ---- Ridgeline Adventure Co., Queenstown ---- */
  act_milford_heli_glacier: {
    slots: [{ at: '09:00' }, { at: '13:00', days: [0, 1, 5, 6] }],
    demand: 0.56,
  },
  act_remarkables_alpine_climb: { slots: [{ at: '05:30' }], days: [0, 3, 6], demand: 0.5 },
  act_shotover_canyon_jetboat: {
    slots: [{ at: '09:30' }, { at: '11:30' }, { at: '14:00' }, { at: '15:30', days: [0, 6] }],
    demand: 0.72,
  },
  act_kawarau_raft_expedition: {
    slots: [{ at: '09:30' }, { at: '13:30', days: [0, 6] }],
    demand: 0.64,
  },
  act_moke_lake_ebike_picnic: { slots: [{ at: '10:00' }], days: [1, 2, 4, 5], demand: 0.58 },
  act_ben_lomond_summit_trek: { slots: [{ at: '07:00' }], days: [1, 4, 5], demand: 0.52 },
}

/* ==========================================================================
   DEMAND SHAPE
   ========================================================================== */

/** Seasonal multiplier by month index, per tenant. */
const SEASON: Record<string, number[]> = {
  tnt_bluehorizon: [1.12, 1.05, 1.1, 0.98, 0.92, 1.12, 1.24, 1.18, 0.94, 0.9, 0.98, 1.14],
  tnt_coralcay: [0.8, 0.78, 0.88, 1.02, 1.12, 1.2, 1.24, 1.22, 1.16, 1.08, 0.94, 0.86],
  tnt_saltline: [0.55, 0.58, 0.74, 0.92, 1.1, 1.2, 1.26, 1.28, 1.14, 0.94, 0.62, 0.58],
  tnt_ridgeline: [1.22, 1.2, 1.02, 0.92, 0.84, 0.88, 0.96, 0.94, 0.92, 1.02, 1.1, 1.2],
}

/** Weekday multiplier, index 0=Sun … 6=Sat. */
const WEEKDAY_ACTIVITY = [1.16, 0.84, 0.86, 0.9, 0.96, 1.08, 1.22]
const WEEKDAY_DINING = [1.02, 0.78, 0.82, 0.9, 1.04, 1.24, 1.3]

/**
 * How full a departure is by the time it sails, as a function of how far out it
 * still is. Three months ahead only the keenest 20% have committed.
 */
function leadCurve(daysAhead: number): number {
  return 0.18 + 0.9 * Math.exp(-daysAhead / 26)
}

/* ==========================================================================
   WEATHER
   ========================================================================== */

type Condition = WeatherSnapshot['condition']

const CONDITIONS: Record<string, [Condition, number][]> = {
  tnt_bluehorizon: [
    ['clear', 46],
    ['cloudy', 30],
    ['wind', 14],
    ['rain', 8],
    ['storm', 2],
  ],
  tnt_coralcay: [
    ['clear', 50],
    ['cloudy', 26],
    ['wind', 12],
    ['rain', 10],
    ['storm', 2],
  ],
  tnt_saltline: [
    ['clear', 58],
    ['cloudy', 18],
    ['wind', 18],
    ['rain', 5],
    ['storm', 1],
  ],
  tnt_ridgeline: [
    ['clear', 28],
    ['cloudy', 30],
    ['wind', 16],
    ['rain', 21],
    ['storm', 5],
  ],
}

/** Monthly daytime high, degrees C, per tenant. */
const TEMPS: Record<string, number[]> = {
  tnt_bluehorizon: [23, 23, 24, 25, 26, 27, 28, 29, 29, 28, 26, 24],
  tnt_coralcay: [31, 30, 29, 28, 26, 24, 23, 24, 26, 28, 30, 31],
  tnt_saltline: [12, 12, 14, 17, 21, 25, 28, 28, 25, 21, 17, 14],
  tnt_ridgeline: [22, 21, 19, 15, 11, 8, 7, 9, 12, 15, 18, 21],
}

const WIND_RANGE: Record<Condition, [number, number]> = {
  clear: [4, 12],
  cloudy: [6, 15],
  wind: [17, 28],
  rain: [9, 19],
  storm: [26, 42],
}

const CONFIDENCE_RANGE: Record<Condition, [number, number]> = {
  clear: [92, 99],
  cloudy: [84, 95],
  wind: [62, 82],
  rain: [58, 80],
  storm: [12, 38],
}

function buildWeather(
  rng: () => number,
  tenantId: string,
  month: number,
  onWater: boolean,
  forceRough: boolean,
): WeatherSnapshot {
  const condition: Condition = forceRough
    ? rngWeighted(rng, [
        ['storm', 3],
        ['wind', 5],
      ] as [Condition, number][])
    : rngWeighted(rng, CONDITIONS[tenantId] ?? CONDITIONS.tnt_bluehorizon)

  const [windLo, windHi] = WIND_RANGE[condition]
  const windKts = rngInt(rng, windLo, windHi)
  const base = (TEMPS[tenantId] ?? TEMPS.tnt_bluehorizon)[month]
  const tempC = base + rngInt(rng, -2, 2) - (condition === 'rain' || condition === 'storm' ? 3 : 0)
  const [confLo, confHi] = CONFIDENCE_RANGE[condition]

  return {
    condition,
    tempC,
    windKts,
    // Swell only means something to a boat operator; a wine cellar ignores it.
    ...(onWater ? { swellM: Math.round((0.3 + windKts * 0.055) * 10) / 10 } : {}),
    goConfidence: rngInt(rng, confLo, confHi),
  }
}

/* ==========================================================================
   RESOURCE OUTAGES
   Real operators lose a boat for a week and substitute another. Modelling it
   here gives the dispatch board a genuine conflict state to render.
   ========================================================================== */

interface ResourceOutage {
  resourceId: string
  /** Inclusive "YYYY-MM-DD" bounds. */
  from: string
  to: string
  substituteId: string
  note: string
}

const RESOURCE_OUTAGES: ResourceOutage[] = [
  {
    resourceId: 'res_rib_manta',
    from: '2026-09-11',
    to: '2026-09-18',
    substituteId: 'res_catamaran_hokulani',
    note: 'Manta is out for port lower-unit service until 18 Sep — running on Hoku Lani.',
  },
]

/* ==========================================================================
   COPY POOLS
   ========================================================================== */

const OPS_NOTES = [
  'Two guests have flagged limited mobility — brief the crew on the boarding ladder.',
  'Concierge hold for the resort; confirm the pickup list the night before.',
  'Photographer aboard for the marketing shoot.',
  'Birthday party on the manifest — cake is in the galley fridge.',
  'Swap to the backup radio; the primary handset is still in for service.',
  'Extra fuel stop booked — the afternoon tide is against us.',
  'Trainee guide shadowing this departure.',
  'One guest is a certified instructor and has asked to buddy independently.',
]

const CANCELLED_PAST_NOTES = [
  'Cancelled — small craft advisory, all guests moved to the next available trip.',
  'Cancelled — did not reach the minimum numbers.',
  'Cancelled — crew illness, guests rebooked or refunded in full.',
  'Cancelled — harbour closed for the afternoon.',
]

const WEATHER_HOLD_NOTES = [
  'On weather hold — call is at 05:30 the morning of.',
  'On weather hold — swell forecast is borderline, guests notified.',
  'On weather hold — waiting on the afternoon wind model.',
]

/* ==========================================================================
   GENERATION
   ========================================================================== */

function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`
}

/** "20260911" — the date half of a departure id. */
function dateStamp(d: Date): string {
  return toDateKey(d).replace(/-/g, '')
}

/** Products sold as a whole unit — one party takes the boat, the room or the aircraft. */
function isExclusive(activity: Activity): boolean {
  return activity.pricingModel === 'per_group'
}

function outageFor(resourceIds: string[], key: string): ResourceOutage | undefined {
  return RESOURCE_OUTAGES.find(
    (outage) => resourceIds.includes(outage.resourceId) && key >= outage.from && key <= outage.to,
  )
}

const ON_WATER_CATEGORIES = new Set(['watersports', 'island'])

function buildDepartures(): Departure[] {
  const all: Departure[] = []

  for (const tenant of TENANTS) {
    const tenantDepartures: Departure[] = []
    const season = SEASON[tenant.id] ?? SEASON.tnt_bluehorizon
    const dynamicPricing = tenant.features.dynamicPricing

    const liveActivities = ACTIVITIES.filter(
      (activity) => activity.tenantId === tenant.id && activity.status === 'live',
    )

    for (const activity of liveActivities) {
      const plan = SCHEDULES[activity.id]
      // Loud failure beats a silently empty calendar if the catalogue drifts.
      if (!plan) throw new Error(`departures.ts has no schedule for activity "${activity.id}"`)

      const weekday = activity.category === 'restaurants' ? WEEKDAY_DINING : WEEKDAY_ACTIVITY
      const onWater = ON_WATER_CATEGORIES.has(activity.category)
      const exclusive = isExclusive(activity)
      const totalDays = CALENDAR_PAST_DAYS + FUTURE_DAYS

      for (let dayIndex = 0; dayIndex <= totalDays; dayIndex++) {
        const day = addDays(CALENDAR_START, dayIndex)
        const dow = day.getDay()
        const month = day.getMonth()

        if (plan.days && !plan.days.includes(dow)) continue
        if (plan.months && !plan.months.includes(month)) continue

        for (const slot of plan.slots) {
          if (slot.days && !slot.days.includes(dow)) continue

          const [hh, mm] = slot.at.split(':').map(Number)
          // Local calendar construction — DST-safe, unlike epoch arithmetic.
          const startsAt = new Date(day.getFullYear(), month, day.getDate(), hh, mm, 0, 0)
          const endsAt = addMinutes(startsAt, activity.durationMinutes)
          const id = `dep_${activity.id.slice(4)}_${dateStamp(startsAt)}_${slot.at.replace(':', '')}`
          const rng = createRng(hashSeed(seedKey('departure', id)))

          const startMs = startsAt.getTime()
          const past = startMs < NOW_MS
          const daysAhead = Math.max(0, (startMs - NOW_MS) / DAY_MS)

          /* ---- capacity ---- */
          let capacity = activity.maxCapacity
          let note: string | undefined
          if (rng() < 0.03) {
            capacity = Math.max(activity.minParticipants + 1, Math.round(capacity * 0.7))
            note = `Reduced capacity today — ${capacity} seats released.`
          }

          /* ---- how full ---- */
          const trend = 1 + 0.0004 * dayIndex
          const lead = past ? 1 : leadCurve(daysAhead)
          const noise = 0.8 + rng() * 0.42
          const raw = plan.demand * season[month] * weekday[dow] * trend * lead * noise

          let booked: number
          if (exclusive) {
            // The whole unit either goes out for one party or it does not go out.
            booked =
              rng() < clamp(raw, 0.05, 0.95)
                ? clamp(
                    Math.round(capacity * (0.35 + rng() * 0.6)),
                    Math.max(activity.minParticipants, 2),
                    capacity,
                  )
                : 0
          } else {
            booked = clamp(Math.round(capacity * clamp(raw, 0, 1.12)), 0, capacity)
          }

          /* ---- resources, with substitutions during an outage ---- */
          const key = toDateKey(startsAt)
          const outage = outageFor(activity.requiredResourceIds, key)
          const assignedResourceIds = outage
            ? activity.requiredResourceIds.map((rid) =>
                rid === outage.resourceId ? outage.substituteId : rid,
              )
            : [...activity.requiredResourceIds]
          if (outage) note = outage.note

          /* ---- status ---- */
          let status: DepartureStatus
          if (past) {
            if (booked === 0) {
              status = 'cancelled'
              note = note ?? 'Cancelled — no bookings taken.'
            } else if (rng() < 0.035) {
              status = 'cancelled'
              note = note ?? rngPick(rng, CANCELLED_PAST_NOTES)
            } else {
              status = 'completed'
            }
          } else if (rng() < 0.012) {
            status = 'cancelled'
            note = note ?? rngPick(rng, CANCELLED_PAST_NOTES)
          } else if (daysAhead <= 14 && rng() < 0.028) {
            status = 'weather_hold'
            note = note ?? rngPick(rng, WEATHER_HOLD_NOTES)
          } else if (booked >= capacity || (exclusive && booked > 0)) {
            status = 'sold_out'
            if (exclusive && !note) note = 'Private booking — the whole departure is committed.'
          } else if (daysAhead <= 3 && booked >= activity.minParticipants) {
            status = 'confirmed'
          } else {
            status = 'scheduled'
          }

          /* ---- carts in progress ---- */
          let held = 0
          if (!past && daysAhead <= 14 && status !== 'cancelled' && status !== 'sold_out') {
            held = rngWeighted(rng, [
              [0, 70],
              [1, 16],
              [2, 9],
              [3, 5],
            ])
            held = Math.min(held, Math.max(0, capacity - booked))
          }

          if (!note && rng() < 0.06) note = rngPick(rng, OPS_NOTES)

          /* ---- dynamic pricing ---- */
          let priceMultiplier: number | undefined
          if (dynamicPricing && !past && status !== 'cancelled') {
            const fill = capacity === 0 ? 0 : booked / capacity
            // Rounded to two places — a raw float reaches the UI as "1.2000000000000002".
            if (fill >= 0.7) priceMultiplier = Math.round((1.1 + rngInt(rng, 0, 2) / 20) * 100) / 100
            else if (fill <= 0.35 && daysAhead <= 30) {
              priceMultiplier = Math.round((0.86 + rngInt(rng, 0, 2) / 25) * 100) / 100
            }
          }

          /* ---- weather, only where an operator would actually have a forecast ---- */
          const withinForecast = Math.abs(startMs - NOW_MS) <= 10 * DAY_MS
          const weather = withinForecast
            ? buildWeather(rng, tenant.id, month, onWater, status === 'weather_hold')
            : undefined

          tenantDepartures.push({
            id,
            tenantId: tenant.id,
            activityId: activity.id,
            startsAt: localIso(startsAt),
            endsAt: localIso(endsAt),
            capacity,
            booked,
            held,
            status,
            // Filled by the roster pass below, once the tenant's day is known.
            assignedStaffIds: [],
            assignedResourceIds,
            ...(note ? { notes: note } : {}),
            ...(priceMultiplier
              ? {
                  priceMultiplier,
                  priceOverride: Math.round(activity.basePrice * priceMultiplier),
                }
              : {}),
            ...(weather ? { weather } : {}),
          })
        }
      }
    }

    tenantDepartures.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    assignStaff(tenant.id, tenantDepartures)
    all.push(...tenantDepartures)
  }

  return all
}

/**
 * Rosters guides onto departures in start-time order, preferring anyone who is
 * genuinely free (their last trip plus a turnaround). Small teams — Saltline
 * runs one bookable chef — fall through to the second pass and double up rather
 * than leaving a departure unstaffed.
 */
function assignStaff(tenantId: string, departures: Departure[]): void {
  const staff = getBookableStaff(tenantId)
  if (staff.length === 0) return

  const TURNAROUND_MS = 30 * 60_000
  const freeAt = new Array<number>(staff.length).fill(0)
  let rotation = 0

  for (const departure of departures) {
    const startMs = Date.parse(departure.startsAt)
    const releaseMs = Date.parse(departure.endsAt) + TURNAROUND_MS
    const need = clamp(1 + Math.floor(departure.capacity / 18), 1, Math.min(staff.length, 4))
    const chosen: string[] = []

    for (let i = 0; i < staff.length && chosen.length < need; i++) {
      const idx = (rotation + i) % staff.length
      if (freeAt[idx] <= startMs) {
        chosen.push(staff[idx].id)
        freeAt[idx] = releaseMs
      }
    }
    for (let i = 0; i < staff.length && chosen.length < need; i++) {
      const idx = (rotation + i) % staff.length
      if (!chosen.includes(staff[idx].id)) {
        chosen.push(staff[idx].id)
        freeAt[idx] = Math.max(freeAt[idx], releaseMs)
      }
    }

    rotation = (rotation + 1) % staff.length
    departure.assignedStaffIds = chosen
  }
}

/* ==========================================================================
   EXPORTS
   ========================================================================== */

export const DEPARTURES: Departure[] = buildDepartures()

const DEPARTURES_BY_TENANT: Record<string, Departure[]> = {}
const DEPARTURES_BY_ACTIVITY = new Map<string, Departure[]>()
const DEPARTURES_BY_ID = new Map<string, Departure>()

for (const departure of DEPARTURES) {
  ;(DEPARTURES_BY_TENANT[departure.tenantId] ||= []).push(departure)
  const byActivity = DEPARTURES_BY_ACTIVITY.get(departure.activityId)
  if (byActivity) byActivity.push(departure)
  else DEPARTURES_BY_ACTIVITY.set(departure.activityId, [departure])
  DEPARTURES_BY_ID.set(departure.id, departure)
}

/**
 * Parallel arrays of start timestamps, one per tenant, in the same order as
 * `DEPARTURES_BY_TENANT`. Range queries binary-search these instead of scanning
 * several thousand rows — the calendar re-queries on every navigation.
 */
const START_TIMES_BY_TENANT: Record<string, number[]> = {}
for (const [tenantId, rows] of Object.entries(DEPARTURES_BY_TENANT)) {
  START_TIMES_BY_TENANT[tenantId] = rows.map((row) => Date.parse(row.startsAt))
}

/** Index of the first entry not less than `value`. */
function lowerBound(values: number[], value: number): number {
  let lo = 0
  let hi = values.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (values[mid] < value) lo = mid + 1
    else hi = mid
  }
  return lo
}

export function getDeparturesByTenant(tenantId: string): Departure[] {
  return DEPARTURES_BY_TENANT[tenantId] ?? []
}

/** Departures starting inside [from, to], both bounds inclusive. */
export function getDeparturesInRange(tenantId: string, from: Date, to: Date): Departure[] {
  const rows = DEPARTURES_BY_TENANT[tenantId]
  const times = START_TIMES_BY_TENANT[tenantId]
  if (!rows || !times) return []

  const fromMs = from.getTime()
  const toMs = to.getTime()
  const out: Departure[] = []
  for (let i = lowerBound(times, fromMs); i < times.length && times[i] <= toMs; i++) {
    out.push(rows[i])
  }
  return out
}

export function getDeparturesForDay(tenantId: string, day: Date): Departure[] {
  return getDeparturesInRange(tenantId, startOfDay(day), endOfDay(day))
}

export function getDeparturesByActivity(activityId: string): Departure[] {
  return DEPARTURES_BY_ACTIVITY.get(activityId) ?? []
}

export function getDepartureById(id: string): Departure | undefined {
  return DEPARTURES_BY_ID.get(id)
}

/**
 * The next departures an operator would actually act on — anything still to
 * come that has not been called off, nearest first.
 */
export function getUpcomingDepartures(tenantId: string, limit = 10): Departure[] {
  const rows = DEPARTURES_BY_TENANT[tenantId]
  const times = START_TIMES_BY_TENANT[tenantId]
  if (!rows || !times) return []

  const out: Departure[] = []
  for (let i = lowerBound(times, NOW_MS); i < rows.length && out.length < limit; i++) {
    if (rows[i].status !== 'cancelled') out.push(rows[i])
  }
  return out
}
