/**
 * Activities — server-side data preparation.
 *
 * The catalog, the detail record and the performance charts all need the same
 * derived numbers (30-day bookings, revenue, occupancy, rating mix, upcoming
 * departures). Deriving them here — in a module with no `'use client'` — keeps
 * the whole 20k-row demo dataset out of the client bundle: the screens receive
 * plain, serialisable summaries as props.
 *
 * Every figure is computed from the generated bookings in `@/lib/demo`, keyed to
 * the frozen clock `NOW`, so server and client always agree.
 */

import type {
  Activity,
  BookingChannel,
  DepartureStatus,
  HeatmapCell,
  KpiMetric,
  Resource,
  TimeSeriesPoint,
  WeatherSnapshot,
} from '@/types'
import {
  CHANNEL_LABELS,
  DEPARTURES,
  NOW,
  getActivitiesByTenant,
  getActivityById,
  getAnalytics,
  getBookingsByDeparture,
  getCustomerById,
  getResourcesByTenant,
  getUsersByTenant,
} from '@/lib/demo'
import { addDays, average, clamp, fillRate, percentChange, startOfDay, toDateKey } from '@/lib/utils'

/* ==========================================================================
   INDEXES
   ========================================================================== */

const departuresByActivity = new Map<string, typeof DEPARTURES>()
for (const departure of DEPARTURES) {
  const list = departuresByActivity.get(departure.activityId)
  if (list) list.push(departure)
  else departuresByActivity.set(departure.activityId, [departure])
}

function departuresFor(activityId: string) {
  return departuresByActivity.get(activityId) ?? []
}

/**
 * `NOW` as the same local ISO string shape every departure carries. Exported so
 * client screens can be handed the frozen clock without importing the dataset.
 */
export const NOW_ISO = `${toDateKey(NOW)}T${String(NOW.getHours()).padStart(2, '0')}:${String(
  NOW.getMinutes(),
).padStart(2, '0')}:00`

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface ActivitySummary {
  activity: Activity
  /** Cheapest tier that can actually be bought on its own. */
  fromPrice: number
  compareAtPrice: number | null
  bookings30d: number
  guests30d: number
  revenue30d: number
  departures30d: number
  /** Percent of seats sold across the trailing 30 days. */
  occupancy30d: number
  /** 30 daily booking counts, oldest first. */
  sparkline: number[]
  upcomingCount: number
  nextDepartureAt: string | null
  nextSeatsLeft: number | null
  deltaBookingsPercent: number
  deltaRevenuePercent: number
  /** Same window, shifted back 30 days — lets callers roll up a real delta. */
  prevBookings30d: number
  prevRevenue30d: number
}

export interface DepartureRowLite {
  id: string
  startsAt: string
  endsAt: string
  capacity: number
  booked: number
  held: number
  status: DepartureStatus
  staff: { id: string; name: string; avatarUrl: string }[]
  resources: string[]
  weather: WeatherSnapshot | null
}

export interface ReviewItem {
  id: string
  reference: string
  rating: number
  text: string | null
  guestName: string
  guestAvatar: string | null
  guestCountry: string
  departureAt: string
  partySize: number
}

export interface ActivityDetailData {
  activity: Activity
  summary: ActivitySummary
  /** Performance tab KPI row — trailing 90 days vs the 90 days before it. */
  kpis: KpiMetric[]
  timeseries: TimeSeriesPoint[]
  heatmap: HeatmapCell[]
  upcoming: DepartureRowLite[]
  reviews: ReviewItem[]
  ratingDistribution: { stars: number; count: number; percent: number }[]
  ratedCount: number
  lifetime: {
    bookings: number
    guests: number
    revenue: number
    avgPartySize: number
    occupancy: number
    cancellationRate: number
    repeatRate: number
    conversion: number
    departures: number
    upcomingDepartures: number
  }
  channels: { channel: BookingChannel; label: string; bookings: number; share: number; revenue: number }[]
  resources: Resource[]
  team: { id: string; name: string; avatarUrl: string; title: string; departures: number }[]
}

/* ==========================================================================
   WINDOWED AGGREGATION
   ========================================================================== */

interface DailyBucket {
  date: string
  revenue: number
  bookings: number
  guests: number
  cancellations: number
  capacity: number
  booked: number
}

interface WindowStats {
  days: DailyBucket[]
  bookings: number
  guests: number
  revenue: number
  cancellations: number
  departures: number
  capacity: number
  booked: number
  occupancy: number
  aov: number
}

function dayKeys(from: Date, to: Date): string[] {
  const out: string[] = []
  const end = startOfDay(to).getTime()
  let cursor = startOfDay(from)
  while (cursor.getTime() <= end) {
    out.push(toDateKey(cursor))
    cursor = addDays(cursor, 1)
  }
  return out
}

/** Revenue-bearing bookings: cancelled and fully refunded rows never count. */
function isRevenue(status: string) {
  return status !== 'cancelled' && status !== 'refunded'
}

function windowStats(activityId: string, from: Date, to: Date): WindowStats {
  const keys = dayKeys(from, to)
  const index = new Map(keys.map((key, i) => [key, i]))
  const days: DailyBucket[] = keys.map((date) => ({
    date,
    revenue: 0,
    bookings: 0,
    guests: 0,
    cancellations: 0,
    capacity: 0,
    booked: 0,
  }))

  const fromKey = keys[0]
  const toKey = keys[keys.length - 1]

  let departures = 0
  let capacity = 0
  let booked = 0

  for (const departure of departuresFor(activityId)) {
    const key = departure.startsAt.slice(0, 10)
    if (key < fromKey) continue
    if (key > toKey) break
    const bucket = days[index.get(key)!]
    departures += 1

    if (departure.status !== 'cancelled') {
      capacity += departure.capacity
      booked += departure.booked
      bucket.capacity += departure.capacity
      bucket.booked += departure.booked
    }

    for (const booking of getBookingsByDeparture(departure.id)) {
      if (booking.status === 'cancelled') {
        bucket.cancellations += 1
        continue
      }
      if (!isRevenue(booking.status)) continue
      bucket.bookings += 1
      bucket.guests += booking.partySize
      bucket.revenue += booking.total
    }
  }

  let bookings = 0
  let guests = 0
  let revenue = 0
  let cancellations = 0
  for (const day of days) {
    bookings += day.bookings
    guests += day.guests
    revenue += day.revenue
    cancellations += day.cancellations
  }

  return {
    days,
    bookings,
    guests,
    revenue,
    cancellations,
    departures,
    capacity,
    booked,
    occupancy: capacity === 0 ? 0 : clamp((booked / capacity) * 100, 0, 100),
    aov: bookings === 0 ? 0 : Math.round(revenue / bookings),
  }
}

/** Cheapest sellable tier — comp/infant tiers with a 0 minimum are ignored. */
function priceFloor(activity: Activity) {
  const sellable = activity.priceTiers.filter((tier) => tier.price > 0)
  if (sellable.length === 0) return activity.basePrice
  return sellable.reduce((min, tier) => Math.min(min, tier.price), sellable[0].price)
}

function compareAtFloor(activity: Activity) {
  const promo = activity.priceTiers.find((tier) => typeof tier.compareAtPrice === 'number')
  return promo?.compareAtPrice ?? null
}

/* ==========================================================================
   SUMMARIES — the catalog
   ========================================================================== */

const summaryCache = new Map<string, ActivitySummary>()

export function getActivitySummary(activityId: string): ActivitySummary | undefined {
  const cached = summaryCache.get(activityId)
  if (cached) return cached

  const activity = getActivityById(activityId)
  if (!activity) return undefined

  const current = windowStats(activityId, addDays(NOW, -29), NOW)
  const previous = windowStats(activityId, addDays(NOW, -59), addDays(NOW, -30))

  const upcoming = departuresFor(activityId).filter(
    (d) => d.startsAt >= NOW_ISO && d.status !== 'cancelled',
  )
  const next = upcoming[0] ?? null

  const summary: ActivitySummary = {
    activity,
    fromPrice: priceFloor(activity),
    compareAtPrice: compareAtFloor(activity),
    bookings30d: current.bookings,
    guests30d: current.guests,
    revenue30d: current.revenue,
    departures30d: current.departures,
    occupancy30d: current.occupancy,
    sparkline: current.days.map((d) => d.bookings),
    upcomingCount: upcoming.length,
    nextDepartureAt: next?.startsAt ?? null,
    nextSeatsLeft: next ? Math.max(0, next.capacity - next.booked - next.held) : null,
    deltaBookingsPercent: percentChange(current.bookings, previous.bookings),
    deltaRevenuePercent: percentChange(current.revenue, previous.revenue),
    prevBookings30d: previous.bookings,
    prevRevenue30d: previous.revenue,
  }

  summaryCache.set(activityId, summary)
  return summary
}

/** Every activity in the tenant catalog, drafts and archives included. */
export function getActivitySummaries(tenantId: string): ActivitySummary[] {
  return getActivitiesByTenant(tenantId)
    .map((activity) => getActivitySummary(activity.id))
    .filter((summary): summary is ActivitySummary => Boolean(summary))
}

export interface CatalogTotals {
  total: number
  live: number
  draft: number
  paused: number
  archived: number
  revenue30d: number
  bookings30d: number
  occupancy30d: number
  avgRating: number
  revenueDeltaPercent: number
  bookingsDeltaPercent: number
}

export function getCatalogTotals(summaries: ActivitySummary[]): CatalogTotals {
  const rated = summaries.filter((s) => s.activity.reviewCount > 0)
  const weighted = rated.reduce((acc, s) => acc + s.activity.rating * s.activity.reviewCount, 0)
  const reviews = rated.reduce((acc, s) => acc + s.activity.reviewCount, 0)

  const revenue30d = summaries.reduce((acc, s) => acc + s.revenue30d, 0)
  const bookings30d = summaries.reduce((acc, s) => acc + s.bookings30d, 0)
  const prevRevenue = summaries.reduce((acc, s) => acc + s.prevRevenue30d, 0)
  const prevBookings = summaries.reduce((acc, s) => acc + s.prevBookings30d, 0)

  return {
    total: summaries.length,
    live: summaries.filter((s) => s.activity.status === 'live').length,
    draft: summaries.filter((s) => s.activity.status === 'draft').length,
    paused: summaries.filter((s) => s.activity.status === 'paused').length,
    archived: summaries.filter((s) => s.activity.status === 'archived').length,
    revenue30d,
    bookings30d,
    occupancy30d: average(summaries.filter((s) => s.departures30d > 0).map((s) => s.occupancy30d)),
    avgRating: reviews === 0 ? 0 : weighted / reviews,
    revenueDeltaPercent: percentChange(revenue30d, prevRevenue),
    bookingsDeltaPercent: percentChange(bookings30d, prevBookings),
  }
}

/* ==========================================================================
   DETAIL
   ========================================================================== */

/** Down-samples a daily series to a sparkline-sized run of points. */
function resample(values: number[], target = 24): number[] {
  if (values.length <= target) return values
  const out: number[] = []
  const bucket = values.length / target
  for (let i = 0; i < target; i++) {
    const start = Math.floor(i * bucket)
    const end = Math.max(start + 1, Math.floor((i + 1) * bucket))
    out.push(Math.round(average(values.slice(start, end)) * 100) / 100)
  }
  return out
}

function direction(delta: number, higherIsBetter: boolean): KpiMetric['direction'] {
  if (Math.abs(delta) < 0.35) return 'flat'
  return higherIsBetter ? (delta > 0 ? 'up' : 'down') : delta > 0 ? 'up' : 'down'
}

const detailCache = new Map<string, ActivityDetailData>()

export function getActivityDetail(activityId: string): ActivityDetailData | undefined {
  const cached = detailCache.get(activityId)
  if (cached) return cached

  const activity = getActivityById(activityId)
  const summary = getActivitySummary(activityId)
  if (!activity || !summary) return undefined

  const current = windowStats(activityId, addDays(NOW, -89), NOW)
  const previous = windowStats(activityId, addDays(NOW, -179), addDays(NOW, -90))

  /* ---- revenue timeseries (90 days, with the prior period underneath) ---- */
  const timeseries: TimeSeriesPoint[] = current.days.map((day, i) => ({
    date: day.date,
    revenue: day.revenue,
    bookings: day.bookings,
    guests: day.guests,
    occupancy: day.capacity === 0 ? 0 : clamp((day.booked / day.capacity) * 100, 0, 100),
    prevRevenue: previous.days[i]?.revenue ?? 0,
    cancellations: day.cancellations,
    avgOrderValue: day.bookings === 0 ? 0 : Math.round(day.revenue / day.bookings),
  }))

  /* ---- heatmap: weekday (0=Mon) x hour, trailing 90 days of real runs ---- */
  const fromKey = toDateKey(addDays(NOW, -89))
  const toKey = toDateKey(NOW)
  const cellMap = new Map<string, HeatmapCell>()
  for (const departure of departuresFor(activityId)) {
    const key = departure.startsAt.slice(0, 10)
    if (key < fromKey) continue
    if (key > toKey) break
    if (departure.status === 'cancelled') continue
    const at = new Date(departure.startsAt)
    const weekday = (at.getDay() + 6) % 7
    const hour = at.getHours()
    const cellKey = `${weekday}:${hour}`
    const cell = cellMap.get(cellKey) ?? { weekday, hour, occupancy: 0, bookings: 0, revenue: 0 }
    // Occupancy accumulates as seats, then normalises below.
    cell.occupancy += departure.capacity
    cell.bookings += departure.booked
    for (const booking of getBookingsByDeparture(departure.id)) {
      if (isRevenue(booking.status)) cell.revenue += booking.total
    }
    cellMap.set(cellKey, cell)
  }
  const heatmap: HeatmapCell[] = Array.from(cellMap.values()).map((cell) => ({
    weekday: cell.weekday,
    hour: cell.hour,
    occupancy: cell.occupancy === 0 ? 0 : clamp((cell.bookings / cell.occupancy) * 100, 0, 100),
    bookings: cell.bookings,
    revenue: cell.revenue,
  }))

  /* ---- lifetime totals, reviews and channel mix in one pass ---- */
  const users = new Map(getUsersByTenant(activity.tenantId).map((u) => [u.id, u]))
  const staffLoad = new Map<string, number>()
  const channelTally = new Map<BookingChannel, { bookings: number; revenue: number }>()
  const ratingCounts = [0, 0, 0, 0, 0]
  const reviews: ReviewItem[] = []

  let lifetimeBookings = 0
  let lifetimeGuests = 0
  let lifetimeRevenue = 0
  let lifetimeCancelled = 0
  let lifetimeAll = 0
  let repeatBookings = 0
  let lifetimeCapacity = 0
  let lifetimeBooked = 0
  let ratedCount = 0

  const allDepartures = departuresFor(activityId)
  for (const departure of allDepartures) {
    if (departure.status !== 'cancelled') {
      lifetimeCapacity += departure.capacity
      lifetimeBooked += departure.booked
    }
    for (const staffId of departure.assignedStaffIds) {
      staffLoad.set(staffId, (staffLoad.get(staffId) ?? 0) + 1)
    }

    for (const booking of getBookingsByDeparture(departure.id)) {
      lifetimeAll += 1
      if (booking.status === 'cancelled') {
        lifetimeCancelled += 1
        continue
      }
      if (!isRevenue(booking.status)) continue

      lifetimeBookings += 1
      lifetimeGuests += booking.partySize
      lifetimeRevenue += booking.total

      const customer = getCustomerById(booking.customerId)
      if (customer && customer.totalBookings > 1) repeatBookings += 1

      const tally = channelTally.get(booking.channel) ?? { bookings: 0, revenue: 0 }
      tally.bookings += 1
      tally.revenue += booking.total
      channelTally.set(booking.channel, tally)

      if (typeof booking.rating === 'number') {
        ratedCount += 1
        ratingCounts[clamp(Math.round(booking.rating), 1, 5) - 1] += 1
        if (booking.reviewText && reviews.length < 240) {
          reviews.push({
            id: booking.id,
            reference: booking.reference,
            rating: booking.rating,
            text: booking.reviewText,
            guestName: customer ? `${customer.firstName} ${customer.lastName}` : 'Guest',
            guestAvatar: customer?.avatarUrl ?? null,
            guestCountry: customer?.country ?? '',
            departureAt: booking.departureAt,
            partySize: booking.partySize,
          })
        }
      }
    }
  }

  reviews.sort((a, b) => (a.departureAt < b.departureAt ? 1 : a.departureAt > b.departureAt ? -1 : 0))

  const ratingTotal = ratingCounts.reduce((a, b) => a + b, 0)
  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => {
    const count = ratingCounts[stars - 1]
    return { stars, count, percent: ratingTotal === 0 ? 0 : (count / ratingTotal) * 100 }
  })

  const channelTotal = Array.from(channelTally.values()).reduce((acc, c) => acc + c.bookings, 0)
  const channels = Array.from(channelTally.entries())
    .map(([channel, tally]) => ({
      channel,
      label: CHANNEL_LABELS[channel],
      bookings: tally.bookings,
      revenue: tally.revenue,
      share: channelTotal === 0 ? 0 : (tally.bookings / channelTotal) * 100,
    }))
    .sort((a, b) => b.bookings - a.bookings)

  /* ---- upcoming run sheet ---- */
  const upcoming: DepartureRowLite[] = allDepartures
    .filter((d) => d.startsAt >= NOW_ISO)
    .slice(0, 10)
    .map((d) => ({
      id: d.id,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      capacity: d.capacity,
      booked: d.booked,
      held: d.held,
      status: d.status,
      staff: d.assignedStaffIds
        .map((id) => users.get(id))
        .filter((u): u is NonNullable<typeof u> => Boolean(u))
        .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl })),
      resources: d.assignedResourceIds,
      weather: d.weather ?? null,
    }))

  const team = Array.from(staffLoad.entries())
    .map(([id, departures]) => {
      const user = users.get(id)
      return user
        ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl, title: user.title, departures }
        : null
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((a, b) => b.departures - a.departures)
    .slice(0, 5)

  /* ---- estimated storefront conversion -------------------------------------
     The demo seam models funnel stages per tenant, not per activity. We index
     the tenant's own view→book rate by how this activity fills relative to the
     tenant average, which keeps the number deterministic and directionally
     honest rather than invented.                                            */
  const snapshot = getAnalytics(activity.tenantId, '90d')
  const funnelTop = snapshot.funnel[0]?.value ?? 0
  const funnelEnd = snapshot.funnel[snapshot.funnel.length - 1]?.value ?? 0
  const tenantConversion = funnelTop === 0 ? 0 : (funnelEnd / funnelTop) * 100
  const tenantOccupancy = snapshot.kpis.find((k) => k.key === 'occupancy')?.value ?? 0
  const occupancyIndex =
    tenantOccupancy === 0 ? 1 : clamp(current.occupancy / tenantOccupancy, 0.6, 1.6)

  const resources = getResourcesByTenant(activity.tenantId).filter((r) =>
    activity.requiredResourceIds.includes(r.id),
  )

  /* ---- KPI row (trailing 90 days vs the 90 before) ---- */
  const revenueDelta = percentChange(current.revenue, previous.revenue)
  const bookingsDelta = percentChange(current.bookings, previous.bookings)
  const guestsDelta = percentChange(current.guests, previous.guests)
  const occupancyDelta = percentChange(current.occupancy, previous.occupancy)
  const aovDelta = percentChange(current.aov, previous.aov)
  const comparisonLabel = 'vs previous 90 days'

  const kpis: KpiMetric[] = [
    {
      key: 'revenue',
      label: 'Revenue',
      value: current.revenue,
      format: 'currency',
      currency: activity.currency,
      deltaPercent: revenueDelta,
      direction: direction(revenueDelta, true),
      higherIsBetter: true,
      comparisonLabel,
      sparkline: resample(current.days.map((d) => d.revenue)),
    },
    {
      key: 'bookings',
      label: 'Bookings',
      value: current.bookings,
      format: 'number',
      deltaPercent: bookingsDelta,
      direction: direction(bookingsDelta, true),
      higherIsBetter: true,
      comparisonLabel,
      sparkline: resample(current.days.map((d) => d.bookings)),
    },
    {
      key: 'guests',
      label: 'Guests carried',
      value: current.guests,
      format: 'number',
      deltaPercent: guestsDelta,
      direction: direction(guestsDelta, true),
      higherIsBetter: true,
      comparisonLabel,
      sparkline: resample(current.days.map((d) => d.guests)),
    },
    {
      key: 'occupancy',
      label: 'Seat occupancy',
      value: current.occupancy,
      format: 'percent',
      deltaPercent: occupancyDelta,
      direction: direction(occupancyDelta, true),
      higherIsBetter: true,
      comparisonLabel,
      sparkline: resample(
        current.days.map((d) => (d.capacity === 0 ? 0 : (d.booked / d.capacity) * 100)),
      ),
    },
    {
      key: 'aov',
      label: 'Average booking',
      value: current.aov,
      format: 'currency',
      currency: activity.currency,
      deltaPercent: aovDelta,
      direction: direction(aovDelta, true),
      higherIsBetter: true,
      comparisonLabel,
      sparkline: resample(
        current.days.map((d) => (d.bookings === 0 ? 0 : Math.round(d.revenue / d.bookings))),
      ),
    },
    {
      key: 'rating',
      label: 'Guest rating',
      value: activity.rating,
      format: 'rating',
      deltaPercent: 0,
      direction: 'flat',
      higherIsBetter: true,
      comparisonLabel: `${activity.reviewCount.toLocaleString('en-US')} reviews`,
      sparkline: resample(current.days.map((d) => (d.bookings === 0 ? 0 : d.guests / d.bookings))),
      hint: 'Lifetime average across every rated booking on this activity.',
    },
  ]

  const detail: ActivityDetailData = {
    activity,
    summary,
    kpis,
    timeseries,
    heatmap,
    upcoming,
    reviews: reviews.slice(0, 24),
    ratingDistribution,
    ratedCount,
    lifetime: {
      bookings: lifetimeBookings,
      guests: lifetimeGuests,
      revenue: lifetimeRevenue,
      avgPartySize: lifetimeBookings === 0 ? 0 : lifetimeGuests / lifetimeBookings,
      occupancy: fillRate(lifetimeBooked, lifetimeCapacity),
      cancellationRate: lifetimeAll === 0 ? 0 : (lifetimeCancelled / lifetimeAll) * 100,
      repeatRate: lifetimeBookings === 0 ? 0 : (repeatBookings / lifetimeBookings) * 100,
      conversion: tenantConversion * occupancyIndex,
      departures: allDepartures.length,
      upcomingDepartures: summary.upcomingCount,
    },
    channels,
    resources,
    team,
  }

  detailCache.set(activityId, detail)
  return detail
}
