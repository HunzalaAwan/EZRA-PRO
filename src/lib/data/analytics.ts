/**
 * EZRA PRO — the analytics engine.
 *
 * Nothing in this file invents a number. Every KPI, series, breakdown and
 * insight is folded out of the same booking and departure rows the manifest,
 * the calendar and the bookings table render, so a figure on a chart can always
 * be traced back to rows a user can click into. That reconciliation is the
 * whole point: it is what separates this from a dashboard of decorative
 * sparklines.
 *
 * TWO MODELLING DECISIONS WORTH KNOWING
 *
 * 1. THE DEPARTURE AXIS. Everything is bucketed by *when the trip runs*
 *    (`departureAt`), not when it was sold. That keeps revenue, occupancy and
 *    cancellations on one timeline that agrees with the calendar. The sales
 *    axis still exists — lead time and the cohort table read `createdAt` — but
 *    it is never mixed into the same series.
 *
 * 2. THE BACK-CAST. `departures.ts` only synthesises NOW-120d .. NOW+90d, which
 *    is plenty for the operating screens but leaves prior-period and
 *    year-to-date comparisons with nothing to compare against. So every tenant
 *    gets a daily fact table stretching back {@link HISTORY_DAYS}; days inside
 *    the real window are measured, days before it are *back-cast* by mirroring a
 *    real 16-week block (112 days — a whole number of weeks, so weekday shape
 *    survives) and discounting it by a seeded annual growth rate. Back-cast days
 *    are flagged `synthetic`, are deterministic, and respect each tenant's
 *    observed closed season, so Saltline's winter stays empty instead of
 *    inventing revenue it never earned.
 *
 *    Row-level breakdowns (channel, geo, activity, heatmap) are computed from
 *    real rows and then uplifted by a single factor when the window reaches
 *    behind the real data. Because the back-cast re-samples real days, the mix
 *    is preserved and the parts still sum to the whole.
 */

import type {
  ActivityPerformance,
  AnalyticsSnapshot,
  Booking,
  BookingChannel,
  ChannelBreakdown,
  CohortRow,
  CurrencyCode,
  FunnelStage,
  GeoSource,
  HeatmapCell,
  Insight,
  KpiMetric,
  RangePreset,
  TimeSeriesPoint,
  TrendDirection,
} from '@/types'
import {
  addDays,
  clamp,
  createRng,
  endOfDay,
  formatCompactCurrency,
  formatCurrency,
  formatDateShort,
  formatNumber,
  hashSeed,
  percentChange,
  pluralize,
  startOfDay,
  startOfMonth,
  toDateKey,
} from '@/lib/utils'
import { HISTORY_DAYS, NOW, seedKey } from './constants'
import { getActivitiesByTenant, getActivityById } from './activities'
import { getBookingsByTenant, getBookingsInRange } from './bookings'
import { CALENDAR_END, CALENDAR_START, getDeparturesByTenant, getDeparturesInRange } from './departures'
import { getCountryName, getCustomerById } from './customers'
import { getTenantById } from './tenants'

const MS_DAY = 86_400_000

/** Mirror stride for the back-cast: 16 weeks, so weekday shape is preserved. */
const MIRROR_DAYS = 112

/** Channels an operator counts as "theirs" — no marketplace commission attached. */
const DIRECT_CHANNELS: ReadonlySet<BookingChannel> = new Set<BookingChannel>([
  'website_widget',
  'direct',
  'google',
])

/** Channels that can plausibly have produced a web session before converting. */
const ONLINE_CHANNELS: ReadonlySet<BookingChannel> = new Set<BookingChannel>([
  'website_widget',
  'direct',
  'google',
])

const CHANNEL_LABELS: Record<BookingChannel, string> = {
  website_widget: 'Website widget',
  direct: 'Direct',
  ota: 'OTA marketplace',
  phone: 'Phone',
  walk_in: 'Walk-in',
  reseller: 'Reseller',
  concierge: 'Concierge',
  google: 'Google Things to do',
}

/** 0 = Monday, matching the calendar grid and {@link HeatmapCell.weekday}. */
const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** Heatmap rows. Pre-dawn departures (05:00) fold into the 06:00 band. */
const HEATMAP_START_HOUR = 6
const HEATMAP_END_HOUR = 21

/* ==========================================================================
   RANGES
   ========================================================================== */

export const RANGE_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  mtd: 'Month to date',
  qtd: 'Quarter to date',
  ytd: 'Year to date',
  custom: 'Custom range',
}

/** Presets in the order a range picker should render them. */
export const RANGE_PRESETS: { value: RangePreset; label: string }[] = (
  ['today', '7d', '30d', '90d', 'mtd', 'qtd', 'ytd'] as RangePreset[]
).map((value) => ({ value, label: RANGE_LABELS[value] }))

/**
 * Bounds for a preset, always ending at {@link NOW}. `custom` has no stored
 * definition at this layer, so it resolves to the 30-day default; pass explicit
 * dates to the query layer instead.
 */
export function getRangeBounds(preset: RangePreset = '30d'): { from: Date; to: Date } {
  const to = endOfDay(NOW)
  switch (preset) {
    case 'today':
      return { from: startOfDay(NOW), to }
    case '7d':
      return { from: startOfDay(addDays(NOW, -6)), to }
    case '90d':
      return { from: startOfDay(addDays(NOW, -89)), to }
    case 'mtd':
      return { from: startOfMonth(NOW), to }
    case 'qtd':
      return { from: new Date(NOW.getFullYear(), Math.floor(NOW.getMonth() / 3) * 3, 1), to }
    case 'ytd':
      return { from: new Date(NOW.getFullYear(), 0, 1), to }
    case '30d':
    case 'custom':
    default:
      return { from: startOfDay(addDays(NOW, -29)), to }
  }
}

/** Inclusive day count spanned by a range. */
export function rangeDayCount(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_DAY) + 1
}

/** The equal-length window sitting immediately before `from`. */
export function getPreviousRangeBounds(from: Date, to: Date): { from: Date; to: Date } {
  const days = rangeDayCount(from, to)
  return { from: startOfDay(addDays(from, -days)), to: endOfDay(addDays(from, -1)) }
}

/* ==========================================================================
   MONEY SEMANTICS
   ========================================================================== */

/**
 * What the operator actually keeps from a booking.
 *
 * A cancelled booking is not worth its face value — it is worth whatever the
 * guest paid minus whatever went back, which is exactly the late-cancellation
 * fee the activity's policy allowed. Everything else is booked value net of any
 * partial refund.
 */
export function bookingNetRevenue(booking: Booking): number {
  const refund = booking.refundAmount ?? 0
  return booking.status === 'cancelled'
    ? Math.max(0, booking.amountPaid - refund)
    : booking.total - refund
}

/* ==========================================================================
   DAILY FACT TABLE
   ========================================================================== */

interface DayFact {
  key: string
  time: number
  /** 0 = Monday. */
  weekday: number
  synthetic: boolean
  revenue: number
  gross: number
  refunds: number
  bookings: number
  cancellations: number
  guests: number
  repeatBookings: number
  directBookings: number
  directRevenue: number
  capacity: number
  ratingSum: number
  ratingCount: number
  leadSum: number
  leadCount: number
  departures: number
}

interface TenantFacts {
  tenantId: string
  currency: CurrencyCode
  start: number
  days: DayFact[]
  /** Booking ids whose guest had already booked at least once before. */
  repeatBookingIds: ReadonlySet<string>
}

function emptyDay(time: number, synthetic: boolean): DayFact {
  const date = new Date(time)
  return {
    key: toDateKey(date),
    time,
    weekday: (date.getDay() + 6) % 7,
    synthetic,
    revenue: 0,
    gross: 0,
    refunds: 0,
    bookings: 0,
    cancellations: 0,
    guests: 0,
    repeatBookings: 0,
    directBookings: 0,
    directRevenue: 0,
    capacity: 0,
    ratingSum: 0,
    ratingCount: 0,
    leadSum: 0,
    leadCount: 0,
    departures: 0,
  }
}

/**
 * Which calendar months this tenant actually trades in.
 *
 * A month the real window covers but that carries no departures is a closed
 * season (Saltline shuts from November). When a tenant has one, months the
 * window never reached are treated as closed too — better to under-report a
 * back-cast than to invent winter revenue for a summer-only operator.
 */
function openMonthMask(tenantId: string): boolean[] {
  const seen = new Array<boolean>(12).fill(false)
  for (const departure of getDeparturesByTenant(tenantId)) {
    seen[new Date(departure.startsAt).getMonth()] = true
  }

  const covered = new Array<boolean>(12).fill(false)
  for (let t = CALENDAR_START.getTime(); t <= CALENDAR_END.getTime(); t += MS_DAY) {
    covered[new Date(t).getMonth()] = true
  }

  const hasClosedSeason = covered.some((isCovered, month) => isCovered && !seen[month])
  return seen.map((wasSeen, month) => (covered[month] ? wasSeen : !hasClosedSeason))
}

/** Bookings whose guest had an earlier booking on record — the repeat numerator. */
function buildRepeatSet(tenantId: string): Set<string> {
  const byCustomer = new Map<string, Booking[]>()
  for (const booking of getBookingsByTenant(tenantId)) {
    const bucket = byCustomer.get(booking.customerId)
    if (bucket) bucket.push(booking)
    else byCustomer.set(booking.customerId, [booking])
  }

  const repeat = new Set<string>()
  for (const rows of byCustomer.values()) {
    if (rows.length < 2) continue
    const ordered = [...rows].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    for (let i = 1; i < ordered.length; i++) repeat.add(ordered[i].id)
  }
  return repeat
}

/**
 * How far back the fact table reaches.
 *
 * {@link HISTORY_DAYS} is the floor stage 1 asked for, but year-to-date needs
 * its own length again behind it or the comparison period lands on empty air and
 * every YoY delta reads as a doubling. Take whichever is longer.
 */
const FACT_DAYS = Math.max(HISTORY_DAYS, 2 * rangeDayCount(getRangeBounds('ytd').from, endOfDay(NOW)))

function buildFacts(tenantId: string): TenantFacts {
  const tenant = getTenantById(tenantId)
  const factStart = startOfDay(addDays(NOW, -FACT_DAYS))
  const factEnd = endOfDay(NOW)
  const start = factStart.getTime()
  const total = rangeDayCount(factStart, factEnd)

  const days: DayFact[] = new Array(total)
  for (let i = 0; i < total; i++) {
    const time = startOfDay(addDays(factStart, i)).getTime()
    days[i] = emptyDay(time, time < CALENDAR_START.getTime())
  }

  const indexOf = (time: number) => Math.round((startOfDay(new Date(time)).getTime() - start) / MS_DAY)

  // ---- measured days -----------------------------------------------------
  for (const departure of getDeparturesInRange(tenantId, CALENDAR_START, factEnd)) {
    if (departure.status === 'cancelled') continue
    const day = days[indexOf(Date.parse(departure.startsAt))]
    if (!day) continue
    day.capacity += departure.capacity
    day.departures += 1
  }

  const repeatBookingIds = buildRepeatSet(tenantId)

  for (const booking of getBookingsInRange(tenantId, CALENDAR_START, factEnd)) {
    const day = days[indexOf(Date.parse(booking.departureAt))]
    if (!day) continue

    const net = bookingNetRevenue(booking)
    day.revenue += net
    day.refunds += booking.refundAmount ?? 0

    if (booking.status === 'cancelled') {
      day.cancellations += 1
    } else {
      day.gross += booking.total
      day.bookings += 1
      day.guests += booking.partySize
      if (repeatBookingIds.has(booking.id)) day.repeatBookings += 1
      if (DIRECT_CHANNELS.has(booking.channel)) {
        day.directBookings += 1
        day.directRevenue += net
      }
      const leadDays = (Date.parse(booking.departureAt) - Date.parse(booking.createdAt)) / MS_DAY
      if (leadDays >= 0) {
        day.leadSum += leadDays
        day.leadCount += 1
      }
    }

    if (booking.rating !== undefined) {
      day.ratingSum += booking.rating
      day.ratingCount += 1
    }
  }

  // ---- back-cast ---------------------------------------------------------
  const open = openMonthMask(tenantId)
  const trendRng = createRng(hashSeed(seedKey('analytics', 'growth', tenantId)))
  // Annual growth the business is assumed to have had. Higher growth means a
  // thinner, more obviously improving past.
  const growth = 0.16 + trendRng() * 0.18
  const calendarStartMs = CALENDAR_START.getTime()

  for (const day of days) {
    if (!day.synthetic) continue
    if (!open[new Date(day.time).getMonth()]) continue

    const offset = Math.round((calendarStartMs - day.time) / MS_DAY)
    const sourceIndex = indexOf(calendarStartMs) + ((MIRROR_DAYS - (offset % MIRROR_DAYS)) % MIRROR_DAYS)
    const source = days[sourceIndex]
    if (!source || source.synthetic) continue

    const yearsBack = (NOW.getTime() - day.time) / (365 * MS_DAY)
    const jitter = createRng(hashSeed(seedKey('analytics', 'backcast', tenantId, day.key)))
    const volume = (1 / Math.pow(1 + growth, yearsBack)) * (0.9 + jitter() * 0.2)
    // Occupancy improved more slowly than volume — capacity grew alongside it.
    const occupancyDecay = 1 / Math.pow(1.07, yearsBack)

    day.revenue = Math.round(source.revenue * volume)
    day.gross = Math.round(source.gross * volume)
    day.refunds = Math.round(source.refunds * volume)
    day.bookings = Math.round(source.bookings * volume)
    day.cancellations = Math.round(source.cancellations * volume)
    day.guests = Math.round(source.guests * volume)
    day.departures = Math.round(source.departures * volume)
    // Retention and direct-booking share were both weaker before the operator
    // had the tooling — scale them down a touch further than raw volume.
    day.repeatBookings = Math.round(source.repeatBookings * volume * 0.85)
    day.directBookings = Math.round(source.directBookings * volume * 0.9)
    day.directRevenue = Math.round(source.directRevenue * volume * 0.9)

    const sourceOccupancy = source.capacity > 0 ? source.guests / source.capacity : 0
    day.capacity =
      sourceOccupancy > 0
        ? Math.max(day.guests, Math.round(day.guests / clamp(sourceOccupancy * occupancyDecay, 0.05, 1)))
        : Math.round(source.capacity * volume)

    day.ratingCount = Math.round(source.ratingCount * volume)
    const sourceRating = source.ratingCount > 0 ? source.ratingSum / source.ratingCount : 0
    day.ratingSum = day.ratingCount * clamp(sourceRating - 0.04 * yearsBack, 1, 5)

    day.leadCount = day.bookings
    const sourceLead = source.leadCount > 0 ? source.leadSum / source.leadCount : 0
    day.leadSum = day.leadCount * Math.max(1, sourceLead * (1 - 0.05 * yearsBack))
  }

  return {
    tenantId,
    currency: tenant?.currency ?? 'USD',
    start,
    days,
    repeatBookingIds,
  }
}

const FACTS_CACHE = new Map<string, TenantFacts>()

function factsFor(tenantId: string): TenantFacts {
  const cached = FACTS_CACHE.get(tenantId)
  if (cached) return cached
  const built = buildFacts(tenantId)
  FACTS_CACHE.set(tenantId, built)
  return built
}

function factsBetween(facts: TenantFacts, from: Date, to: Date): DayFact[] {
  const first = Math.round((startOfDay(from).getTime() - facts.start) / MS_DAY)
  const last = Math.round((startOfDay(to).getTime() - facts.start) / MS_DAY)
  return facts.days.slice(Math.max(0, first), Math.min(facts.days.length, last + 1))
}

/* ==========================================================================
   AGGREGATION
   ========================================================================== */

interface Aggregate {
  days: number
  revenue: number
  gross: number
  refunds: number
  bookings: number
  cancellations: number
  guests: number
  repeatBookings: number
  directBookings: number
  directRevenue: number
  capacity: number
  ratingSum: number
  ratingCount: number
  leadSum: number
  leadCount: number
  departures: number
}

function emptyAggregate(): Aggregate {
  return {
    days: 0,
    revenue: 0,
    gross: 0,
    refunds: 0,
    bookings: 0,
    cancellations: 0,
    guests: 0,
    repeatBookings: 0,
    directBookings: 0,
    directRevenue: 0,
    capacity: 0,
    ratingSum: 0,
    ratingCount: 0,
    leadSum: 0,
    leadCount: 0,
    departures: 0,
  }
}

function addDay(target: Aggregate, day: DayFact): void {
  target.days += 1
  target.revenue += day.revenue
  target.gross += day.gross
  target.refunds += day.refunds
  target.bookings += day.bookings
  target.cancellations += day.cancellations
  target.guests += day.guests
  target.repeatBookings += day.repeatBookings
  target.directBookings += day.directBookings
  target.directRevenue += day.directRevenue
  target.capacity += day.capacity
  target.ratingSum += day.ratingSum
  target.ratingCount += day.ratingCount
  target.leadSum += day.leadSum
  target.leadCount += day.leadCount
  target.departures += day.departures
}

function aggregate(slice: DayFact[]): Aggregate {
  const out = emptyAggregate()
  for (const day of slice) addDay(out, day)
  return out
}

const metricAov = (a: Aggregate) => (a.bookings === 0 ? 0 : Math.round(a.revenue / a.bookings))
const metricOccupancy = (a: Aggregate) =>
  a.capacity === 0 ? 0 : clamp((a.guests / a.capacity) * 100, 0, 100)
const metricCancelRate = (a: Aggregate) => {
  const placed = a.bookings + a.cancellations
  return placed === 0 ? 0 : (a.cancellations / placed) * 100
}
const metricRepeatRate = (a: Aggregate) =>
  a.bookings === 0 ? 0 : (a.repeatBookings / a.bookings) * 100
const metricRating = (a: Aggregate) => (a.ratingCount === 0 ? 0 : a.ratingSum / a.ratingCount)
const metricLeadDays = (a: Aggregate) => (a.leadCount === 0 ? 0 : a.leadSum / a.leadCount)
const metricRevPerSeat = (a: Aggregate) => (a.guests === 0 ? 0 : Math.round(a.revenue / a.guests))
const metricDirectShare = (a: Aggregate) =>
  a.revenue === 0 ? 0 : clamp((a.directRevenue / a.revenue) * 100, 0, 100)

/* ==========================================================================
   SMALL NUMERIC HELPERS
   ========================================================================== */

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/**
 * Largest-remainder apportionment so a set of shares sums to exactly 100 at the
 * requested precision — charts that label their own slices should never add up
 * to 99.9.
 */
function allocateShares(values: number[], decimals = 1): number[] {
  const factor = 10 ** decimals
  const target = 100 * factor
  const total = values.reduce((acc, value) => acc + value, 0)
  if (total <= 0) return values.map(() => 0)

  const exact = values.map((value) => (value / total) * target)
  const floored = exact.map((value) => Math.floor(value))
  let remainder = target - floored.reduce((acc, value) => acc + value, 0)

  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac)

  for (let i = 0; remainder > 0 && i < order.length; i++, remainder--) {
    floored[order[i].index] += 1
  }
  return floored.map((value) => value / factor)
}

/**
 * Which way the number moved — sentiment is deliberately not encoded here. The
 * UI pairs `direction` with `higherIsBetter` to decide whether up is green.
 */
function direction(deltaPercent: number): TrendDirection {
  if (Math.abs(deltaPercent) < 0.25) return 'flat'
  return deltaPercent > 0 ? 'up' : 'down'
}

function bucketSeries(slice: DayFact[], pick: (a: Aggregate) => number, buckets: number): number[] {
  if (slice.length === 0) return []
  const count = Math.min(buckets, slice.length)
  const out: number[] = []
  for (let i = 0; i < count; i++) {
    const from = Math.floor((i * slice.length) / count)
    const to = Math.max(Math.floor(((i + 1) * slice.length) / count), from + 1)
    out.push(round(pick(aggregate(slice.slice(from, to))), 2))
  }
  return out
}

function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'am' : 'pm'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${twelve}${suffix}`
}

/* ==========================================================================
   KPIs
   ========================================================================== */

interface KpiSpec {
  key: string
  label: string
  format: KpiMetric['format']
  pick: (a: Aggregate) => number
  higherIsBetter: boolean
  hint: string
  currency?: boolean
  decimals?: number
}

const KPI_SPECS: KpiSpec[] = [
  {
    key: 'revenue',
    label: 'Net revenue',
    format: 'currency',
    pick: (a) => a.revenue,
    higherIsBetter: true,
    hint: 'Booked value minus refunds, before processor fees.',
    currency: true,
  },
  {
    key: 'bookings',
    label: 'Bookings',
    format: 'number',
    pick: (a) => a.bookings,
    higherIsBetter: true,
    hint: 'Reservations that survived to departure day.',
  },
  {
    key: 'guests',
    label: 'Guests',
    format: 'number',
    pick: (a) => a.guests,
    higherIsBetter: true,
    hint: 'Seats actually filled across every departure.',
  },
  {
    key: 'aov',
    label: 'Average order value',
    format: 'currency',
    pick: metricAov,
    higherIsBetter: true,
    hint: 'Net revenue per reservation, add-ons included.',
    currency: true,
  },
  {
    key: 'occupancy',
    label: 'Capacity utilisation',
    format: 'percent',
    pick: metricOccupancy,
    higherIsBetter: true,
    hint: 'Seats sold as a share of seats offered.',
    decimals: 1,
  },
  {
    key: 'revPerSeat',
    label: 'Revenue per seat',
    format: 'currency',
    pick: metricRevPerSeat,
    higherIsBetter: true,
    hint: 'Yield per filled seat — price and mix in one number.',
    currency: true,
  },
  {
    key: 'cancellationRate',
    label: 'Cancellation rate',
    format: 'percent',
    pick: metricCancelRate,
    higherIsBetter: false,
    hint: 'Share of reservations cancelled before departure.',
    decimals: 1,
  },
  {
    key: 'repeatRate',
    label: 'Repeat guest rate',
    format: 'percent',
    pick: metricRepeatRate,
    higherIsBetter: true,
    hint: 'Bookings from guests who had booked with you before.',
    decimals: 1,
  },
  {
    key: 'directShare',
    label: 'Direct revenue share',
    format: 'percent',
    pick: metricDirectShare,
    higherIsBetter: true,
    hint: 'Revenue booked on your own channels rather than a marketplace.',
    decimals: 1,
  },
  {
    key: 'rating',
    label: 'Average rating',
    format: 'rating',
    pick: metricRating,
    higherIsBetter: true,
    hint: 'Mean guest rating left on trips in this window.',
    decimals: 2,
  },
  {
    key: 'leadTime',
    label: 'Avg lead time',
    format: 'number',
    pick: metricLeadDays,
    higherIsBetter: true,
    hint: 'Days between a guest booking and their departure.',
    decimals: 1,
  },
]

function buildKpis(
  facts: TenantFacts,
  bounds: { from: Date; to: Date },
  previous: { from: Date; to: Date },
): KpiMetric[] {
  const currentSlice = factsBetween(facts, bounds.from, bounds.to)
  const current = aggregate(currentSlice)
  const prior = aggregate(factsBetween(facts, previous.from, previous.to))

  const days = rangeDayCount(bounds.from, bounds.to)
  const comparisonLabel = `vs prior ${days} ${pluralize(days, 'day')}`
  // Short windows would otherwise produce a two-point sparkline; widen the
  // trailing view so the shape still reads.
  const sparkSlice = factsBetween(facts, startOfDay(addDays(bounds.to, -(Math.max(days, 14) - 1))), bounds.to)

  return KPI_SPECS.map((spec) => {
    const value = round(spec.pick(current), spec.decimals ?? 0)
    const previousValue = spec.pick(prior)
    const deltaPercent = round(percentChange(spec.pick(current), previousValue), 1)

    return {
      key: spec.key,
      label: spec.label,
      value,
      format: spec.format,
      deltaPercent,
      direction: direction(deltaPercent),
      higherIsBetter: spec.higherIsBetter,
      comparisonLabel,
      sparkline: bucketSeries(sparkSlice, spec.pick, 24),
      hint: spec.hint,
      ...(spec.currency ? { currency: facts.currency } : {}),
    }
  })
}

/* ==========================================================================
   TIME SERIES
   ========================================================================== */

function buildTimeseries(
  facts: TenantFacts,
  bounds: { from: Date; to: Date },
  previous: { from: Date; to: Date },
): TimeSeriesPoint[] {
  const current = factsBetween(facts, bounds.from, bounds.to)
  const prior = factsBetween(facts, previous.from, previous.to)
  // Align by position, not by date, so the comparison line tracks "day 1 vs
  // day 1" even when the two windows have different month lengths.
  const offset = prior.length - current.length

  return current.map((day, index) => {
    const priorDay = prior[index + offset]
    return {
      date: day.key,
      revenue: day.revenue,
      bookings: day.bookings,
      guests: day.guests,
      occupancy: round(day.capacity === 0 ? 0 : clamp((day.guests / day.capacity) * 100, 0, 100), 1),
      prevRevenue: priorDay?.revenue ?? 0,
      cancellations: day.cancellations,
      avgOrderValue: day.bookings === 0 ? 0 : Math.round(day.revenue / day.bookings),
    }
  })
}

/* ==========================================================================
   ROW-DERIVED BREAKDOWNS
   ========================================================================== */

interface RowTotals {
  bookings: number
  revenue: number
  guests: number
  cancellations: number
  ratingSum: number
  ratingCount: number
}

function emptyRowTotals(): RowTotals {
  return { bookings: 0, revenue: 0, guests: 0, cancellations: 0, ratingSum: 0, ratingCount: 0 }
}

function accumulate(target: RowTotals, booking: Booking): void {
  if (booking.status === 'cancelled') {
    target.cancellations += 1
  } else {
    target.bookings += 1
    target.guests += booking.partySize
  }
  target.revenue += bookingNetRevenue(booking)
  if (booking.rating !== undefined) {
    target.ratingSum += booking.rating
    target.ratingCount += 1
  }
}

function buildChannels(
  current: Booking[],
  prior: Booking[],
  uplift: number,
  priorUplift: number,
): ChannelBreakdown[] {
  const now = new Map<BookingChannel, RowTotals>()
  const before = new Map<BookingChannel, number>()

  for (const booking of current) {
    const bucket = now.get(booking.channel) ?? emptyRowTotals()
    accumulate(bucket, booking)
    now.set(booking.channel, bucket)
  }
  for (const booking of prior) {
    before.set(booking.channel, (before.get(booking.channel) ?? 0) + bookingNetRevenue(booking))
  }

  const rows = [...now.entries()].sort((a, b) => b[1].revenue - a[1].revenue)
  const shares = allocateShares(rows.map(([, totals]) => totals.revenue))

  return rows.map(([channel, totals], index) => ({
    channel,
    label: CHANNEL_LABELS[channel],
    bookings: Math.round(totals.bookings * uplift),
    revenue: Math.round(totals.revenue * uplift),
    share: shares[index],
    deltaPercent: round(
      percentChange(totals.revenue * uplift, (before.get(channel) ?? 0) * priorUplift),
      1,
    ),
  }))
}

function buildTopActivities(
  tenantId: string,
  current: Booking[],
  prior: Booking[],
  bounds: { from: Date; to: Date },
  uplift: number,
  priorUplift: number,
  limit = 8,
): ActivityPerformance[] {
  const now = new Map<string, RowTotals>()
  const before = new Map<string, number>()

  for (const booking of current) {
    const bucket = now.get(booking.activityId) ?? emptyRowTotals()
    accumulate(bucket, booking)
    now.set(booking.activityId, bucket)
  }
  for (const booking of prior) {
    before.set(booking.activityId, (before.get(booking.activityId) ?? 0) + bookingNetRevenue(booking))
  }

  const capacityByActivity = new Map<string, number>()
  for (const departure of getDeparturesInRange(tenantId, bounds.from, bounds.to)) {
    if (departure.status === 'cancelled') continue
    capacityByActivity.set(
      departure.activityId,
      (capacityByActivity.get(departure.activityId) ?? 0) + departure.capacity,
    )
  }

  return [...now.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limit)
    .map(([activityId, totals]) => {
      const activity = getActivityById(activityId)
      const capacity = capacityByActivity.get(activityId) ?? 0
      return {
        activityId,
        name: activity?.name ?? activityId,
        bookings: Math.round(totals.bookings * uplift),
        revenue: Math.round(totals.revenue * uplift),
        occupancy: round(capacity === 0 ? 0 : clamp((totals.guests / capacity) * 100, 0, 100), 1),
        rating: round(
          totals.ratingCount > 0 ? totals.ratingSum / totals.ratingCount : (activity?.rating ?? 0),
          2,
        ),
        deltaPercent: round(
          percentChange(totals.revenue * uplift, (before.get(activityId) ?? 0) * priorUplift),
          1,
        ),
        colorKey: activity?.colorKey ?? 'lagoon',
      }
    })
}

/**
 * The online booking funnel.
 *
 * The bottom stage is real — reservations that actually closed on the operator's
 * own web channels. Everything above it is reconstructed from that floor using
 * per-tenant step rates drawn from a seeded generator inside ranges the tours
 * and activities category genuinely sees (a 6-9% session-to-booking rate
 * end-to-end). Walk-ins, phone and marketplace bookings are excluded: they never
 * touched a session, and folding them in would flatter the conversion rate.
 */
function buildFunnel(tenantId: string, current: Booking[]): FunnelStage[] {
  const confirmed = current.filter(
    (booking) => booking.status !== 'cancelled' && ONLINE_CHANNELS.has(booking.channel),
  ).length

  const rng = createRng(hashSeed(seedKey('analytics', 'funnel', tenantId)))
  const paymentToConfirmed = 0.88 + rng() * 0.05
  const checkoutToPayment = 0.62 + rng() * 0.08
  const availabilityToCheckout = 0.28 + rng() * 0.07
  const viewToAvailability = 0.34 + rng() * 0.08

  const paymentStarted = Math.round(confirmed / paymentToConfirmed)
  const checkoutStarted = Math.round(paymentStarted / checkoutToPayment)
  const availabilityChecked = Math.round(checkoutStarted / availabilityToCheckout)
  const pageViews = Math.round(availabilityChecked / viewToAvailability)

  const stages: { key: string; label: string; value: number }[] = [
    { key: 'page_views', label: 'Page views', value: pageViews },
    { key: 'availability', label: 'Availability checked', value: availabilityChecked },
    { key: 'checkout', label: 'Checkout started', value: checkoutStarted },
    { key: 'payment', label: 'Payment started', value: paymentStarted },
    { key: 'confirmed', label: 'Booking confirmed', value: confirmed },
  ]

  return stages.map((stage, index) => {
    const previous = index === 0 ? stage.value : stages[index - 1].value
    return {
      ...stage,
      conversionRate: previous === 0 ? 0 : round((stage.value / previous) * 100, 1),
    }
  })
}

function buildHeatmap(
  tenantId: string,
  current: Booking[],
  bounds: { from: Date; to: Date },
  uplift: number,
): HeatmapCell[] {
  const cells = new Map<string, { capacity: number; guests: number; bookings: number; revenue: number }>()
  const cellKey = (weekday: number, hour: number) => `${weekday}:${hour}`
  const bucketHour = (hour: number) => clamp(hour, HEATMAP_START_HOUR, HEATMAP_END_HOUR)

  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = HEATMAP_START_HOUR; hour <= HEATMAP_END_HOUR; hour++) {
      cells.set(cellKey(weekday, hour), { capacity: 0, guests: 0, bookings: 0, revenue: 0 })
    }
  }

  for (const departure of getDeparturesInRange(tenantId, bounds.from, bounds.to)) {
    if (departure.status === 'cancelled') continue
    const at = new Date(departure.startsAt)
    const cell = cells.get(cellKey((at.getDay() + 6) % 7, bucketHour(at.getHours())))
    if (cell) cell.capacity += departure.capacity
  }

  for (const booking of current) {
    if (booking.status === 'cancelled') continue
    const at = new Date(booking.departureAt)
    const cell = cells.get(cellKey((at.getDay() + 6) % 7, bucketHour(at.getHours())))
    if (!cell) continue
    cell.guests += booking.partySize
    cell.bookings += 1
    cell.revenue += bookingNetRevenue(booking)
  }

  const out: HeatmapCell[] = []
  for (let weekday = 0; weekday < 7; weekday++) {
    for (let hour = HEATMAP_START_HOUR; hour <= HEATMAP_END_HOUR; hour++) {
      const cell = cells.get(cellKey(weekday, hour))
      if (!cell) continue
      out.push({
        weekday,
        hour,
        occupancy: round(cell.capacity === 0 ? 0 : clamp((cell.guests / cell.capacity) * 100, 0, 100), 1),
        bookings: Math.round(cell.bookings * uplift),
        revenue: Math.round(cell.revenue * uplift),
      })
    }
  }
  return out
}

/** Top source markets plus an explicit remainder row, so shares total 100. */
function buildGeo(current: Booking[], uplift: number, limit = 8): GeoSource[] {
  const byCountry = new Map<string, { bookings: number; revenue: number }>()
  for (const booking of current) {
    if (booking.status === 'cancelled') continue
    const customer = getCustomerById(booking.customerId)
    if (!customer) continue
    const bucket = byCountry.get(customer.country) ?? { bookings: 0, revenue: 0 }
    bucket.bookings += 1
    bucket.revenue += bookingNetRevenue(booking)
    byCountry.set(customer.country, bucket)
  }

  const ranked = [...byCountry.entries()].sort((a, b) => b[1].bookings - a[1].bookings)
  const head = ranked.slice(0, limit)
  const tail = ranked.slice(limit)

  const rows = head.map(([code, totals]) => ({
    country: getCountryName(code),
    countryCode: code,
    bookings: totals.bookings,
    revenue: totals.revenue,
  }))

  if (tail.length > 0) {
    rows.push({
      country: `${tail.length} other ${pluralize(tail.length, 'market')}`,
      countryCode: 'ZZ',
      bookings: tail.reduce((acc, [, totals]) => acc + totals.bookings, 0),
      revenue: tail.reduce((acc, [, totals]) => acc + totals.revenue, 0),
    })
  }

  const shares = allocateShares(rows.map((row) => row.bookings))
  return rows.map((row, index) => ({
    ...row,
    bookings: Math.round(row.bookings * uplift),
    revenue: Math.round(row.revenue * uplift),
    share: shares[index],
  }))
}

/* ==========================================================================
   COHORTS
   ========================================================================== */

const COHORT_CACHE = new Map<string, CohortRow[]>()

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

/**
 * Acquisition cohorts on the *sales* axis.
 *
 * A guest joins the cohort of the month they first booked; retention at offset
 * k is the share of that cohort who placed another booking k months later.
 * Rows are ragged by design — a cohort three months old cannot have a twelfth
 * month yet — which is exactly how a cohort grid should render.
 */
function buildCohorts(tenantId: string, limit = 12): CohortRow[] {
  const cached = COHORT_CACHE.get(tenantId)
  if (cached) return cached

  const activityByCustomer = new Map<string, Set<number>>()
  for (const booking of getBookingsByTenant(tenantId)) {
    if (booking.status === 'cancelled') continue
    const month = monthIndex(new Date(booking.createdAt))
    const months = activityByCustomer.get(booking.customerId)
    if (months) months.add(month)
    else activityByCustomer.set(booking.customerId, new Set([month]))
  }

  const cohorts = new Map<number, Set<number>[]>()
  for (const months of activityByCustomer.values()) {
    const ordered = [...months].sort((a, b) => a - b)
    const first = ordered[0]
    const bucket = cohorts.get(first)
    if (bucket) bucket.push(months)
    else cohorts.set(first, [months])
  }

  const currentMonth = monthIndex(NOW)
  const rows = [...cohorts.entries()]
    .filter(([month]) => month <= currentMonth)
    .sort((a, b) => a[0] - b[0])
    .slice(-limit)
    .map(([month, members]) => {
      const size = members.length
      const span = currentMonth - month
      const retention: number[] = []
      for (let offset = 0; offset <= span; offset++) {
        const active = members.reduce((acc, months) => acc + (months.has(month + offset) ? 1 : 0), 0)
        retention.push(round((active / size) * 100, 1))
      }
      return {
        cohort: new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(
          new Date(Math.floor(month / 12), month % 12, 1),
        ),
        size,
        retention,
      }
    })

  COHORT_CACHE.set(tenantId, rows)
  return rows
}

/* ==========================================================================
   INSIGHTS
   ========================================================================== */

interface ScoredInsight {
  insight: Insight
  weight: number
}

const SEVERITY_WEIGHT: Record<Insight['severity'], number> = {
  critical: 400,
  warning: 300,
  positive: 200,
  neutral: 100,
}

function buildInsights(
  tenantId: string,
  currency: CurrencyCode,
  current: Booking[],
  prior: Booking[],
  heatmap: HeatmapCell[],
  channels: ChannelBreakdown[],
  facts: Aggregate,
  bounds: { from: Date; to: Date },
): Insight[] {
  const candidates: ScoredInsight[] = []
  const money = (amount: number) => formatCurrency(amount, currency)
  const revenuePerSeat = metricRevPerSeat(facts)
  const windowDays = rangeDayCount(bounds.from, bounds.to)

  /* --- slot arbitrage: the best and worst recurring timeslot ------------- */
  const scheduled = heatmap.filter((cell) => cell.bookings >= 6)
  if (scheduled.length >= 4) {
    const hottest = scheduled.reduce((best, cell) => (cell.occupancy > best.occupancy ? cell : best))
    const coldest = scheduled.reduce((worst, cell) => (cell.occupancy < worst.occupancy ? cell : worst))
    const gap = hottest.occupancy - coldest.occupancy

    if (gap >= 12) {
      // One weekly departure moved across, valued at the gap in seats it would
      // pick up, over a 4.3-week month.
      const seatsPerDeparture = facts.departures === 0 ? 0 : facts.capacity / facts.departures
      const monthlyUpside = Math.round(seatsPerDeparture * (gap / 100) * 4.3 * revenuePerSeat)
      candidates.push({
        weight: SEVERITY_WEIGHT.neutral + gap * 2,
        insight: {
          id: 'slot-arbitrage',
          severity: 'neutral',
          title: `${WEEKDAY_NAMES[hottest.weekday]} ${formatHour(hottest.hour)} is your strongest slot`,
          body: `${WEEKDAY_NAMES[hottest.weekday]} ${formatHour(hottest.hour)} departures run at ${formatNumber(
            hottest.occupancy,
            { decimals: 0 },
          )}% of capacity while ${WEEKDAY_NAMES[coldest.weekday]} ${formatHour(
            coldest.hour,
          )} sits at ${formatNumber(coldest.occupancy, {
            decimals: 0,
          })}%. Moving one weekly ${WEEKDAY_NAMES[coldest.weekday]} departure into the ${
            WEEKDAY_NAMES[hottest.weekday]
          } slot is worth roughly ${money(monthlyUpside)} a month at your current yield.`,
          metric: `${formatNumber(gap, { decimals: 0 })} pt gap`,
          href: '/analytics',
          actionLabel: 'Open the occupancy heatmap',
        },
      })
    }
  }

  /* --- cancellation outlier --------------------------------------------- */
  const perActivity = new Map<string, RowTotals>()
  for (const booking of current) {
    const bucket = perActivity.get(booking.activityId) ?? emptyRowTotals()
    accumulate(bucket, booking)
    perActivity.set(booking.activityId, bucket)
  }
  const tenantCancelRate = metricCancelRate(facts)
  let worstCancel: { id: string; rate: number; placed: number } | null = null
  for (const [activityId, totals] of perActivity) {
    const placed = totals.bookings + totals.cancellations
    if (placed < 20) continue
    const rate = (totals.cancellations / placed) * 100
    if (!worstCancel || rate > worstCancel.rate) worstCancel = { id: activityId, rate, placed }
  }
  if (worstCancel && tenantCancelRate > 0 && worstCancel.rate >= tenantCancelRate * 1.35) {
    const activity = getActivityById(worstCancel.id)
    const excess = Math.round(
      ((worstCancel.rate - tenantCancelRate) / 100) * worstCancel.placed * metricAov(facts),
    )
    candidates.push({
      weight: SEVERITY_WEIGHT.warning + (worstCancel.rate - tenantCancelRate),
      insight: {
        id: `cancellations-${worstCancel.id}`,
        severity: worstCancel.rate >= tenantCancelRate * 1.8 ? 'critical' : 'warning',
        title: `${activity?.name ?? 'One activity'} cancels at ${formatNumber(worstCancel.rate, {
          decimals: 1,
        })}%`,
        body: `That is ${formatNumber(worstCancel.rate / Math.max(tenantCancelRate, 0.1), {
          decimals: 1,
        })}× your ${formatNumber(tenantCancelRate, {
          decimals: 1,
        })}% average across ${formatNumber(worstCancel.placed)} reservations — about ${money(
          excess,
        )} of avoidable churn in this window. Tightening the free-cancellation window or confirming weather earlier usually closes most of the gap.`,
        metric: formatNumber(worstCancel.rate, { decimals: 1 }) + '%',
        href: `/activities/${worstCancel.id}`,
        actionLabel: 'Review the policy',
      },
    })
  }

  /* --- forward book risk ------------------------------------------------- */
  const horizon = 14
  const forward = getDeparturesInRange(tenantId, NOW, endOfDay(addDays(NOW, horizon - 1)))
  let softSeats = 0
  let softDepartures = 0
  for (const departure of forward) {
    if (departure.status === 'cancelled' || departure.capacity === 0) continue
    if (departure.booked / departure.capacity < 0.5) {
      softDepartures += 1
      softSeats += Math.max(0, departure.capacity - departure.booked - departure.held)
    }
  }
  if (softDepartures >= 5 && revenuePerSeat > 0) {
    const atRisk = softSeats * revenuePerSeat
    candidates.push({
      weight: SEVERITY_WEIGHT.warning + softDepartures,
      insight: {
        id: 'forward-book-soft',
        severity: 'warning',
        title: `${formatNumber(softSeats)} seats are still unsold in the next ${horizon} days`,
        body: `${formatNumber(softDepartures)} departures are running under half full, leaving ${money(
          atRisk,
        )} of perishable inventory on the table. A same-week offer to your ${formatNumber(
          Math.round(facts.repeatBookings),
        )} repeat guests clears this kind of gap faster than discounting on a marketplace.`,
        metric: money(atRisk),
        href: '/calendar',
        actionLabel: 'Open the calendar',
      },
    })
  }

  /* --- channel momentum --------------------------------------------------- */
  // Materiality gate: a 25% swing on a channel carrying 2% of revenue is noise,
  // and surfacing it above a real problem is how dashboards lose trust.
  const meaningful = channels.filter((channel) => channel.bookings >= 25 && channel.share >= 5)
  if (meaningful.length > 0) {
    const mover = meaningful.reduce((best, channel) =>
      Math.abs(channel.deltaPercent) * channel.share > Math.abs(best.deltaPercent) * best.share ? channel : best,
    )
    if (Math.abs(mover.deltaPercent) >= 8) {
      const rising = mover.deltaPercent > 0
      candidates.push({
        weight:
          (rising ? SEVERITY_WEIGHT.positive : SEVERITY_WEIGHT.warning) +
          Math.abs(mover.deltaPercent) * (mover.share / 20),
        insight: {
          id: `channel-${mover.channel}`,
          severity: rising ? 'positive' : 'warning',
          title: `${mover.label} revenue is ${rising ? 'up' : 'down'} ${formatNumber(
            Math.abs(mover.deltaPercent),
            { decimals: 1 },
          )}%`,
          body: `${mover.label} brought in ${money(mover.revenue)} across ${formatNumber(
            mover.bookings,
          )} bookings this window — ${formatNumber(mover.share, { decimals: 1 })}% of revenue and ${
            rising ? 'your fastest-growing' : 'your softest'
          } channel versus the prior ${windowDays} days. ${
            rising
              ? 'Worth pushing more inventory and promo codes through it while it compounds.'
              : 'Check pricing parity and availability sync before the trend sets.'
          }`,
          metric: `${mover.deltaPercent > 0 ? '+' : ''}${formatNumber(mover.deltaPercent, { decimals: 1 })}%`,
          href: '/analytics',
          actionLabel: 'Break down channels',
        },
      })
    }
  }

  /* --- marketplace commission leakage ------------------------------------- */
  const ota = channels.find((channel) => channel.channel === 'ota')
  const reseller = channels.find((channel) => channel.channel === 'reseller')
  const marketplaceRevenue = (ota?.revenue ?? 0) + (reseller?.revenue ?? 0)
  if (marketplaceRevenue > 0 && facts.revenue > 0) {
    const share = (marketplaceRevenue / facts.revenue) * 100
    // 20% is the standard OTA take rate; resellers sit nearer 15%.
    const commission = Math.round((ota?.revenue ?? 0) * 0.2 + (reseller?.revenue ?? 0) * 0.15)
    if (share >= 12) {
      const shiftValue = Math.round(commission * 0.25)
      candidates.push({
        weight: SEVERITY_WEIGHT.neutral + share,
        insight: {
          id: 'marketplace-dependency',
          severity: share >= 28 ? 'warning' : 'neutral',
          title: `Marketplaces take ${money(commission)} of this window's revenue`,
          body: `${formatNumber(share, { decimals: 1 })}% of net revenue (${money(
            marketplaceRevenue,
          )}) came through OTAs and resellers, costing roughly ${money(
            commission,
          )} in commission. Converting a quarter of those guests to your own widget on their next trip is worth ${money(
            shiftValue,
          )} a window — the post-trip rebooking email is the cheapest lever you have.`,
          metric: `${formatNumber(share, { decimals: 1 })}%`,
          href: '/bookings',
          actionLabel: 'See marketplace bookings',
        },
      })
    }
  }

  /* --- repeat guest economics --------------------------------------------- */
  const repeatSet = factsFor(tenantId).repeatBookingIds
  let repeatRevenue = 0
  let repeatCount = 0
  let firstRevenue = 0
  let firstCount = 0
  for (const booking of current) {
    if (booking.status === 'cancelled') continue
    if (repeatSet.has(booking.id)) {
      repeatRevenue += bookingNetRevenue(booking)
      repeatCount += 1
    } else {
      firstRevenue += bookingNetRevenue(booking)
      firstCount += 1
    }
  }
  if (repeatCount >= 20 && firstCount >= 20) {
    const repeatAov = repeatRevenue / repeatCount
    const firstAov = firstRevenue / firstCount
    const lift = percentChange(repeatAov, firstAov)
    if (Math.abs(lift) >= 4) {
      const better = lift > 0
      candidates.push({
        weight: SEVERITY_WEIGHT.positive + Math.abs(lift),
        insight: {
          id: 'repeat-guest-value',
          severity: better ? 'positive' : 'neutral',
          title: `Repeat guests spend ${formatNumber(Math.abs(lift), { decimals: 0 })}% ${
            better ? 'more' : 'less'
          } per booking`,
          body: `Returning guests average ${money(Math.round(repeatAov))} a booking against ${money(
            Math.round(firstAov),
          )} for first-timers, across ${formatNumber(repeatCount)} repeat reservations. They are ${formatNumber(
            metricRepeatRate(facts),
            { decimals: 0 },
          )}% of your volume — a rebooking offer attached to the post-trip review request compounds directly on this.`,
          metric: money(Math.round(repeatAov)),
          href: '/customers',
          actionLabel: 'Open the guest directory',
        },
      })
    }
  }

  /* --- dynamic pricing yield ---------------------------------------------- */
  const tenant = getTenantById(tenantId)
  if (tenant?.features.dynamicPricing) {
    const priced = getDeparturesInRange(tenantId, NOW, CALENDAR_END).filter(
      (departure) => departure.priceMultiplier !== undefined && departure.status !== 'cancelled',
    )
    const surge = priced.filter((departure) => (departure.priceMultiplier ?? 1) > 1)
    if (priced.length >= 20 && surge.length >= 5) {
      const averageMultiplier =
        surge.reduce((acc, departure) => acc + (departure.priceMultiplier ?? 1), 0) / surge.length
      const upliftValue = Math.round(
        surge.reduce(
          (acc, departure) => acc + departure.booked * revenuePerSeat * ((departure.priceMultiplier ?? 1) - 1),
          0,
        ),
      )
      candidates.push({
        weight: SEVERITY_WEIGHT.positive + 20,
        insight: {
          id: 'dynamic-pricing-yield',
          severity: 'positive',
          title: `Dynamic pricing is holding ${formatNumber(averageMultiplier, { decimals: 2 })}× on ${formatNumber(
            priced.length,
          )} departures`,
          body: `${formatNumber(
            surge.length,
          )} forward departures are priced above list and are still taking bookings, worth about ${money(
            upliftValue,
          )} of extra yield on seats already sold. Only ${formatNumber(
            priced.length,
          )} of your forward slots carry a pricing rule at all — extending it to high-occupancy weekends is the obvious next step.`,
          metric: `${formatNumber(averageMultiplier, { decimals: 2 })}×`,
          href: '/activities',
          actionLabel: 'Tune pricing rules',
        },
      })
    }
  }

  /* --- rating watch -------------------------------------------------------- */
  const tenantRating = metricRating(facts)
  let weakest: { id: string; rating: number; count: number } | null = null
  for (const [activityId, totals] of perActivity) {
    if (totals.ratingCount < 12) continue
    const rating = totals.ratingSum / totals.ratingCount
    if (!weakest || rating < weakest.rating) weakest = { id: activityId, rating, count: totals.ratingCount }
  }
  if (weakest && tenantRating > 0 && tenantRating - weakest.rating >= 0.35) {
    const activity = getActivityById(weakest.id)
    candidates.push({
      weight: SEVERITY_WEIGHT.warning + (tenantRating - weakest.rating) * 20,
      insight: {
        id: `rating-${weakest.id}`,
        severity: 'warning',
        title: `${activity?.name ?? 'One activity'} is rating ${formatNumber(tenantRating - weakest.rating, {
          decimals: 2,
        })} below your average`,
        body: `${formatNumber(weakest.count)} guests rated it ${formatNumber(weakest.rating, {
          decimals: 2,
        })} against your ${formatNumber(tenantRating, {
          decimals: 2,
        })} house average. On marketplaces that difference moves you down a full page of results, which shows up in bookings four to six weeks later.`,
        metric: formatNumber(weakest.rating, { decimals: 2 }),
        href: '/reviews',
        actionLabel: 'Read the reviews',
      },
    })
  }

  /* --- lead time shift ----------------------------------------------------- */
  if (prior.length >= 50 && current.length >= 50) {
    const leadOf = (rows: Booking[]) => {
      const live = rows.filter((booking) => booking.status !== 'cancelled')
      if (live.length === 0) return 0
      return (
        live.reduce(
          (acc, booking) => acc + (Date.parse(booking.departureAt) - Date.parse(booking.createdAt)) / MS_DAY,
          0,
        ) / live.length
      )
    }
    const currentLead = leadOf(current)
    const priorLead = leadOf(prior)
    const shift = currentLead - priorLead
    if (Math.abs(shift) >= 1.5) {
      const shortening = shift < 0
      candidates.push({
        weight: SEVERITY_WEIGHT.neutral + Math.abs(shift) * 5,
        insight: {
          id: 'lead-time-shift',
          severity: shortening ? 'warning' : 'positive',
          title: `Guests are booking ${formatNumber(Math.abs(shift), { decimals: 1 })} days ${
            shortening ? 'later' : 'earlier'
          }`,
          body: `Average lead time moved from ${formatNumber(priorLead, {
            decimals: 1,
          })} to ${formatNumber(currentLead, { decimals: 1 })} days versus the prior ${windowDays} days. ${
            shortening
              ? 'A shorter book-ahead window means your forward book will look thinner than the season actually is — hold your nerve on price and shift spend to last-minute intent.'
              : 'A longer book-ahead window is the best possible time to raise prices on peak dates: demand is committing before it can compare.'
          }`,
          metric: `${formatNumber(currentLead, { decimals: 1 })} days`,
          href: '/analytics',
          actionLabel: 'See booking pace',
        },
      })
    }
  }

  /* --- baseline callouts ---------------------------------------------------
     Everything above is situational: it only fires when the data says
     something. On a one-day window that can leave the rail with two cards, so
     these three are always computable and carry a low weight — they fill the
     rail from the bottom and are pushed out the moment a real signal appears.
     A very thin window reads the trailing 30 days instead and says so.        */
  const thin = current.length < 40
  const basis = thin
    ? getBookingsInRange(tenantId, startOfDay(addDays(NOW, -29)), endOfDay(NOW))
    : current
  const basisLabel = thin ? 'over the last 30 days' : 'in this window'

  let basisRevenue = 0
  let basisGuests = 0
  const basisByActivity = new Map<string, number>()
  const basisByCountry = new Map<string, number>()
  for (const booking of basis) {
    const net = bookingNetRevenue(booking)
    basisRevenue += net
    basisByActivity.set(booking.activityId, (basisByActivity.get(booking.activityId) ?? 0) + net)
    if (booking.status === 'cancelled') continue
    basisGuests += booking.partySize
    const guest = getCustomerById(booking.customerId)
    if (guest) basisByCountry.set(guest.country, (basisByCountry.get(guest.country) ?? 0) + 1)
  }
  // Fall back to the basis yield when the selected window is too small to have
  // a meaningful per-seat number of its own.
  const seatYield = revenuePerSeat > 0 ? revenuePerSeat : basisGuests > 0 ? basisRevenue / basisGuests : 0

  const forwardWindow = getDeparturesInRange(tenantId, NOW, endOfDay(addDays(NOW, 29)))
  let forwardCapacity = 0
  let forwardBooked = 0
  let forwardUnsold = 0
  for (const departure of forwardWindow) {
    if (departure.status === 'cancelled') continue
    forwardCapacity += departure.capacity
    forwardBooked += departure.booked
    forwardUnsold += Math.max(0, departure.capacity - departure.booked - departure.held)
  }
  if (forwardCapacity > 0) {
    const forwardFill = (forwardBooked / forwardCapacity) * 100
    candidates.push({
      weight: 60,
      insight: {
        id: 'forward-book-30',
        severity: forwardFill < 45 ? 'warning' : 'neutral',
        title: `Next 30 days are ${formatNumber(forwardFill, { decimals: 0 })}% sold`,
        body: `${formatNumber(
          forwardWindow.length,
        )} departures are on the board with ${formatNumber(
          forwardUnsold,
        )} seats still to sell — ${money(
          Math.round(forwardUnsold * seatYield),
        )} of inventory that expires on the day it sails. Forward fill always reads lower than completed weeks because the late-booking curve has not arrived yet; the number to watch is the direction, not the level.`,
        metric: `${formatNumber(forwardFill, { decimals: 0 })}% sold`,
        href: '/calendar',
        actionLabel: 'Review the forward book',
      },
    })
  }

  if (basisByActivity.size >= 2 && basisRevenue > 0) {
    const [topActivityId, topRevenue] = [...basisByActivity.entries()].sort((a, b) => b[1] - a[1])[0]
    const topActivity = getActivityById(topActivityId)
    const share = (topRevenue / basisRevenue) * 100
    candidates.push({
      weight: 50,
      insight: {
        id: 'revenue-concentration',
        severity: share >= 35 ? 'warning' : 'neutral',
        title: `${topActivity?.name ?? 'One product'} carries ${formatNumber(share, {
          decimals: 0,
        })}% of revenue`,
        body: `It earned ${money(topRevenue)} of ${money(
          basisRevenue,
        )} ${basisLabel}, across ${formatNumber(basisByActivity.size)} products on sale. ${
          share >= 35
            ? 'A fortnight of weather on that one product would take a third of your income with it — the hedge is a second product that runs in the conditions this one cannot.'
            : 'That is a healthy spread; the products behind it are doing real work rather than padding the catalogue.'
        }`,
        metric: `${formatNumber(share, { decimals: 0 })}%`,
        href: '/activities',
        actionLabel: 'Compare products',
      },
    })
  }

  if (basisByCountry.size >= 2) {
    const ranked = [...basisByCountry.entries()].sort((a, b) => b[1] - a[1])
    const totalGuests = ranked.reduce((acc, [, count]) => acc + count, 0)
    const [topCode, topCount] = ranked[0]
    const share = (topCount / totalGuests) * 100
    const second = ranked[1]
    candidates.push({
      weight: 45,
      insight: {
        id: 'source-market-concentration',
        severity: share >= 55 ? 'warning' : 'neutral',
        title: `${getCountryName(topCode)} is ${formatNumber(share, {
          decimals: 0,
        })}% of your source market`,
        body: `${formatNumber(topCount)} of ${formatNumber(
          totalGuests,
        )} bookings ${basisLabel} came from ${getCountryName(topCode)}; ${getCountryName(
          second[0],
        )} is next at ${formatNumber((second[1] / totalGuests) * 100, {
          decimals: 0,
        })}%. ${
          share >= 55
            ? 'One currency move or one airline route change swings most of your book at once — worth putting paid spend behind the second and third markets before you need them.'
            : 'A spread that wide is unusual for an operator your size and makes the season much harder to knock over.'
        }`,
        metric: getCountryName(topCode),
        href: '/analytics',
        actionLabel: 'See source markets',
      },
    })
  }

  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 6)
    .map((candidate) => candidate.insight)
}

/* ==========================================================================
   SNAPSHOT
   ========================================================================== */

const SNAPSHOT_CACHE = new Map<string, AnalyticsSnapshot>()

/**
 * The complete analytics payload for one tenant and one window.
 *
 * Memoised per (tenant, preset) — dashboard, analytics and report surfaces all
 * ask for the same snapshot within a single render pass.
 */
export function getAnalytics(tenantId: string, preset: RangePreset = '30d'): AnalyticsSnapshot {
  const cacheKey = `${tenantId}|${preset}`
  const cached = SNAPSHOT_CACHE.get(cacheKey)
  if (cached) return cached

  const facts = factsFor(tenantId)
  const bounds = getRangeBounds(preset)
  const previous = getPreviousRangeBounds(bounds.from, bounds.to)

  const currentAggregate = aggregate(factsBetween(facts, bounds.from, bounds.to))
  const currentRows = getBookingsInRange(tenantId, bounds.from, bounds.to)
  const priorRows = getBookingsInRange(tenantId, previous.from, previous.to)

  // Rows only exist inside the synthesised departure window. When the selected
  // range reaches behind it, scale the row-derived breakdowns so their parts
  // still sum to the back-cast whole. Exactly 1 for every window that sits
  // inside the real data, which is every preset except year-to-date.
  const realRevenue = currentRows.reduce((acc, booking) => acc + bookingNetRevenue(booking), 0)
  const uplift = realRevenue > 0 ? currentAggregate.revenue / realRevenue : 1

  // The comparison period needs its own factor, or a 90-day window whose prior
  // period only half-overlaps the real data reports a channel as having tripled
  // when the KPI beside it says it grew nine percent.
  const priorAggregate = aggregate(factsBetween(facts, previous.from, previous.to))
  const priorRealRevenue = priorRows.reduce((acc, booking) => acc + bookingNetRevenue(booking), 0)
  const priorUplift = priorRealRevenue > 0 ? priorAggregate.revenue / priorRealRevenue : 1

  const channels = buildChannels(currentRows, priorRows, uplift, priorUplift)
  const heatmap = buildHeatmap(tenantId, currentRows, bounds, uplift)

  const snapshot: AnalyticsSnapshot = {
    tenantId,
    rangeLabel: `${RANGE_LABELS[preset]} · ${formatDateShort(bounds.from)} – ${formatDateShort(bounds.to)}`,
    kpis: buildKpis(facts, bounds, previous),
    timeseries: buildTimeseries(facts, bounds, previous),
    channels,
    topActivities: buildTopActivities(tenantId, currentRows, priorRows, bounds, uplift, priorUplift),
    funnel: buildFunnel(tenantId, currentRows),
    heatmap,
    geo: buildGeo(currentRows, uplift),
    cohorts: buildCohorts(tenantId),
    insights: buildInsights(
      tenantId,
      facts.currency,
      currentRows,
      priorRows,
      heatmap,
      channels,
      currentAggregate,
      bounds,
    ),
  }

  SNAPSHOT_CACHE.set(cacheKey, snapshot)
  return snapshot
}

/** One KPI by key — for tiles that render a single metric without the snapshot. */
export function getKpiById(
  tenantId: string,
  key: string,
  preset: RangePreset = '30d',
): KpiMetric | undefined {
  return getAnalytics(tenantId, preset).kpis.find((kpi) => kpi.key === key)
}

/** Just the callouts, for the dashboard's insight rail. */
export function getInsights(tenantId: string, preset: RangePreset = '30d'): Insight[] {
  return getAnalytics(tenantId, preset).insights
}

/**
 * Headline totals for a window without paying for the full snapshot — used by
 * comparison strips and the tenant switcher.
 */
export function getRangeTotals(
  tenantId: string,
  preset: RangePreset = '30d',
): {
  revenue: number
  bookings: number
  guests: number
  occupancy: number
  currency: CurrencyCode
  label: string
} {
  const facts = factsFor(tenantId)
  const bounds = getRangeBounds(preset)
  const totals = aggregate(factsBetween(facts, bounds.from, bounds.to))
  return {
    revenue: totals.revenue,
    bookings: totals.bookings,
    guests: totals.guests,
    occupancy: round(metricOccupancy(totals), 1),
    currency: facts.currency,
    label: RANGE_LABELS[preset],
  }
}

/** Compact currency helper re-exported for KPI tiles that render their own axis. */
export function formatKpiValue(metric: KpiMetric): string {
  switch (metric.format) {
    case 'currency':
      return metric.value >= 1_000_000
        ? formatCompactCurrency(metric.value, metric.currency ?? 'USD')
        : formatCurrency(metric.value, metric.currency ?? 'USD')
    case 'percent':
      return `${formatNumber(metric.value, { decimals: 1 })}%`
    case 'rating':
      return formatNumber(metric.value, { decimals: 2 })
    case 'duration':
      return `${formatNumber(metric.value, { decimals: 1 })} days`
    case 'number':
    default:
      return formatNumber(metric.value, { decimals: metric.key === 'leadTime' ? 1 : 0 })
  }
}

/** Only the days a tenant actually traded — exposed for export/report surfaces. */
export function getTradingDays(tenantId: string, preset: RangePreset = '30d'): number {
  const facts = factsFor(tenantId)
  const bounds = getRangeBounds(preset)
  return factsBetween(facts, bounds.from, bounds.to).filter((day) => day.departures > 0).length
}

/** Every activity's window performance, not just the top slice. */
export function getActivityPerformance(
  tenantId: string,
  preset: RangePreset = '30d',
): ActivityPerformance[] {
  const bounds = getRangeBounds(preset)
  const previous = getPreviousRangeBounds(bounds.from, bounds.to)
  return buildTopActivities(
    tenantId,
    getBookingsInRange(tenantId, bounds.from, bounds.to),
    getBookingsInRange(tenantId, previous.from, previous.to),
    bounds,
    1,
    1,
    getActivitiesByTenant(tenantId).length,
  )
}
