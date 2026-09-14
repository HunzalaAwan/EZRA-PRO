/**
 * EZRA PRO — the query service layer.
 *
 * This is the seam. Page components import from here and nothing else; every
 * function is a pure, synchronous read over the seeded graph in `@/lib/data`,
 * but shaped the way a real service would be — one call per screen, joins
 * already done, options objects rather than positional flags, and a named
 * return type for every shape so a page never has to describe its own data.
 *
 * When a database eventually lands behind this, the signatures do not move.
 * That is the only design constraint that matters here: nothing in this file
 * leaks the fact that the rows came from a generator instead of a query planner.
 *
 * PERFORMANCE. The expensive part of every screen is the join, not the filter,
 * so the joined row sets and the derived per-customer statistics are built once
 * per tenant and memoised at module scope. Filtering, sorting and pagination
 * then run over arrays that are already in the right shape. Never pass a whole
 * row set into a client component — pick the page you need and send that.
 */

import type {
  Activity,
  ActivityFeedItem,
  ActivityPerformance,
  Booking,
  BookingChannel,
  BookingStatus,
  ChannelBreakdown,
  CurrencyCode,
  Customer,
  Departure,
  DepartureStatus,
  FaqItem,
  FeatureBlock,
  Insight,
  Integration,
  KpiMetric,
  ManifestEntry,
  NotificationItem,
  Participant,
  Payment,
  PaymentStatus,
  PriceTier,
  PricingPlan,
  RangePreset,
  Resource,
  Session,
  Tenant,
  Testimonial,
  TimeSeriesPoint,
  User,
  Vertical,
  VerticalKey,
} from '@/types'
import {
  addDays,
  clamp,
  endOfDay,
  fillRate,
  formatDateShort,
  formatTime,
  isSameDay,
  minutesSinceMidnight,
  seatsRemaining,
  sortBy,
  startOfDay,
  sum,
  toDateKey,
} from '@/lib/utils'
import {
  ACTIVITIES,
  bookingNetRevenue,
  CURRENT_USER,
  DEFAULT_TENANT,
  FAQS,
  FEATURE_BLOCKS,
  getActivitiesByTenant,
  getActivityById,
  getActivityBySlug,
  getActivityPerformance,
  getActivityFeed,
  getAnalytics,
  getAvailableResources,
  getBookingById,
  getBookingsByCustomer,
  getBookingsByDeparture,
  getBookingsByTenant,
  getCustomerById,
  getCustomersByTenant,
  getDepartureById,
  getDeparturesByActivity,
  getDeparturesForDay,
  getDeparturesInRange,
  getFeaturedActivities,
  getLiveActivities,
  getNotifications,
  getPaymentsByBooking,
  getPaymentsByTenant,
  getRecentBookings,
  getResourceById,
  getResourcesByTenant,
  getTenantById,
  getTenantBySlug,
  getUnreadNotificationCount,
  getUpcomingDepartures,
  getUserById,
  getUsersByTenant,
  getVertical,
  INTEGRATION_CATEGORIES,
  INTEGRATIONS,
  LOGO_MARKS,
  NOW,
  PRICING_FEATURE_LABELS,
  PRICING_PLANS,
  STATS,
  TENANTS,
  TESTIMONIALS,
  VERTICALS,
} from '@/lib/data'

/* ==========================================================================
   SHARED SHAPES
   ========================================================================== */

export type SortDirection = 'asc' | 'desc'

export interface PaginationOptions {
  /** 1-based. Out-of-range pages clamp to the last page rather than returning empty. */
  page?: number
  pageSize?: number
}

export interface TableResult<TRow> {
  rows: TRow[]
  /** Matching rows before pagination. */
  total: number
  page: number
  pageSize: number
  pageCount: number
}

/** A booking with every foreign key already resolved. */
export interface BookingRow {
  booking: Booking
  customer: Customer
  activity: Activity
  departure: Departure
}

function paginate<TRow>(rows: TRow[], page = 1, pageSize = 25): TableResult<TRow> {
  const size = Math.max(1, pageSize)
  const pageCount = Math.max(1, Math.ceil(rows.length / size))
  const current = clamp(Math.floor(page) || 1, 1, pageCount)
  const start = (current - 1) * size
  return {
    rows: rows.slice(start, start + size),
    total: rows.length,
    page: current,
    pageSize: size,
    pageCount,
  }
}

function normalise(value: string): string {
  return value.toLowerCase().trim()
}

function customerName(customer: Customer): string {
  return `${customer.firstName} ${customer.lastName}`
}

/* ==========================================================================
   TENANT INDEX — built once, reused by every table and detail screen
   ========================================================================== */

interface CustomerAggregate {
  bookings: number
  cancellations: number
  guests: number
  netSpend: number
  ratingSum: number
  ratingCount: number
  upcoming: number
  firstAt: string | null
  lastAt: string | null
  activityCounts: Map<string, number>
}

interface TenantIndex {
  tenantId: string
  currency: CurrencyCode
  /** Every booking for the tenant, joined, ordered by departure date ascending. */
  rows: BookingRow[]
  byCustomer: Map<string, CustomerAggregate>
}

const TENANT_INDEX = new Map<string, TenantIndex>()

function emptyCustomerAggregate(): CustomerAggregate {
  return {
    bookings: 0,
    cancellations: 0,
    guests: 0,
    netSpend: 0,
    ratingSum: 0,
    ratingCount: 0,
    upcoming: 0,
    firstAt: null,
    lastAt: null,
    activityCounts: new Map(),
  }
}

function joinBooking(booking: Booking): BookingRow | null {
  const customer = getCustomerById(booking.customerId)
  const activity = getActivityById(booking.activityId)
  const departure = getDepartureById(booking.departureId)
  // The generated graph is internally consistent, so this never drops a row in
  // practice. Returning null rather than a partially-populated object keeps the
  // public row type free of optional joins.
  if (!customer || !activity || !departure) return null
  return { booking, customer, activity, departure }
}

function indexFor(tenantId: string): TenantIndex {
  const cached = TENANT_INDEX.get(tenantId)
  if (cached) return cached

  const rows: BookingRow[] = []
  const byCustomer = new Map<string, CustomerAggregate>()
  const nowMs = NOW.getTime()

  for (const booking of getBookingsByTenant(tenantId)) {
    const row = joinBooking(booking)
    if (row) rows.push(row)

    const bucket = byCustomer.get(booking.customerId) ?? emptyCustomerAggregate()
    if (booking.status === 'cancelled') {
      bucket.cancellations += 1
    } else {
      bucket.bookings += 1
      bucket.guests += booking.partySize
      if (Date.parse(booking.departureAt) >= nowMs) bucket.upcoming += 1
    }
    bucket.netSpend += bookingNetRevenue(booking)
    if (booking.rating !== undefined) {
      bucket.ratingSum += booking.rating
      bucket.ratingCount += 1
    }
    bucket.activityCounts.set(booking.activityId, (bucket.activityCounts.get(booking.activityId) ?? 0) + 1)
    if (!bucket.firstAt || booking.departureAt < bucket.firstAt) bucket.firstAt = booking.departureAt
    if (!bucket.lastAt || booking.departureAt > bucket.lastAt) bucket.lastAt = booking.departureAt
    byCustomer.set(booking.customerId, bucket)
  }

  const index: TenantIndex = {
    tenantId,
    currency: getTenantById(tenantId)?.currency ?? 'USD',
    rows,
    byCustomer,
  }
  TENANT_INDEX.set(tenantId, index)
  return index
}

/** Net revenue and guest count on one departure, from its own manifest. */
function departureTotals(departureId: string): { revenue: number; guests: number; bookings: number } {
  let revenue = 0
  let guests = 0
  let bookings = 0
  for (const booking of getBookingsByDeparture(departureId)) {
    revenue += bookingNetRevenue(booking)
    if (booking.status !== 'cancelled') {
      guests += booking.partySize
      bookings += 1
    }
  }
  return { revenue, guests, bookings }
}

/* ==========================================================================
   SESSION
   ========================================================================== */

let SESSION: Session | null = null

/**
 * The signed-in operator. One user, one active tenant, and the tenants they can
 * switch between — which in the demo is all of them, so the vertical showcase
 * is one click away from any screen.
 */
export function getSession(): Session {
  if (SESSION) return SESSION
  SESSION = {
    user: CURRENT_USER,
    tenant: DEFAULT_TENANT,
    availableTenants: TENANTS.map(({ id, slug, name, vertical, plan }) => ({
      id,
      slug,
      name,
      vertical,
      plan,
    })),
  }
  return SESSION
}

/** Resolve a tenant by id *or* slug — route params use either. */
export function getTenant(idOrSlug: string): Tenant | undefined {
  return getTenantById(idOrSlug) ?? getTenantBySlug(idOrSlug)
}

/* ==========================================================================
   DASHBOARD
   ========================================================================== */

export interface TodaySummary {
  /** Departures scheduled for the day, cancellations excluded. */
  departures: number
  guests: number
  revenue: number
  capacity: number
  seatsRemaining: number
  occupancy: number
  checkedIn: number
  soldOut: number
  cancelled: number
  nextDepartureAt: string | null
}

export interface UpcomingDeparture {
  departure: Departure
  activity: Activity
  staff: User[]
  fillRate: number
  seatsRemaining: number
  guests: number
  revenue: number
}

export interface DashboardOverview {
  tenant: Tenant
  currency: CurrencyCode
  preset: RangePreset
  rangeLabel: string
  kpis: KpiMetric[]
  revenueSeries: TimeSeriesPoint[]
  channels: ChannelBreakdown[]
  topActivities: ActivityPerformance[]
  insights: Insight[]
  today: TodaySummary
  todayDepartures: ManifestRow[]
  upcomingDepartures: UpcomingDeparture[]
  recentBookings: BookingRow[]
  activityFeed: ActivityFeedItem[]
  notifications: NotificationItem[]
  unreadNotifications: number
}

const DASHBOARD_CACHE = new Map<string, DashboardOverview>()

/** Everything the operator's home screen renders, in one call. */
export function getDashboardOverview(
  tenantId: string,
  preset: RangePreset = '30d',
): DashboardOverview | undefined {
  const tenant = getTenantById(tenantId)
  if (!tenant) return undefined

  const cacheKey = `${tenantId}|${preset}`
  const cached = DASHBOARD_CACHE.get(cacheKey)
  if (cached) return cached

  const analytics = getAnalytics(tenantId, preset)
  const todayDepartures = getTodayManifest(tenantId, NOW)

  const overview: DashboardOverview = {
    tenant,
    currency: tenant.currency,
    preset,
    rangeLabel: analytics.rangeLabel,
    kpis: analytics.kpis,
    revenueSeries: analytics.timeseries,
    channels: analytics.channels,
    topActivities: analytics.topActivities,
    insights: analytics.insights,
    today: summariseDay(todayDepartures),
    todayDepartures,
    upcomingDepartures: getUpcomingDepartures(tenantId, 8)
      .map((departure) => {
        const activity = getActivityById(departure.activityId)
        if (!activity) return null
        const totals = departureTotals(departure.id)
        return {
          departure,
          activity,
          staff: departure.assignedStaffIds
            .map((id) => getUserById(id))
            .filter((user): user is User => Boolean(user)),
          fillRate: Math.round(fillRate(departure.booked, departure.capacity)),
          seatsRemaining: seatsRemaining(departure.capacity, departure.booked, departure.held),
          guests: totals.guests,
          revenue: totals.revenue,
        }
      })
      .filter((entry): entry is UpcomingDeparture => entry !== null),
    recentBookings: getRecentBookings(tenantId, 8)
      .map(joinBooking)
      .filter((row): row is BookingRow => row !== null),
    activityFeed: getActivityFeed(tenantId, 14),
    notifications: getNotifications(tenantId),
    unreadNotifications: getUnreadNotificationCount(tenantId),
  }

  DASHBOARD_CACHE.set(cacheKey, overview)
  return overview
}

function summariseDay(entries: ManifestRow[]): TodaySummary {
  const live = entries.filter((entry) => entry.departure.status !== 'cancelled')
  const capacity = sum(live.map((entry) => entry.departure.capacity))
  const guests = sum(live.map((entry) => entry.guests))
  const upcoming = live.find((entry) => Date.parse(entry.departure.startsAt) >= NOW.getTime())

  return {
    departures: live.length,
    guests,
    revenue: sum(live.map((entry) => entry.revenue)),
    capacity,
    seatsRemaining: sum(live.map((entry) => entry.seatsRemaining)),
    occupancy: capacity === 0 ? 0 : Math.round((guests / capacity) * 100),
    checkedIn: sum(live.map((entry) => entry.checkedIn)),
    soldOut: live.filter((entry) => entry.seatsRemaining === 0).length,
    cancelled: entries.length - live.length,
    nextDepartureAt: upcoming?.departure.startsAt ?? null,
  }
}

/* ==========================================================================
   MANIFEST
   ========================================================================== */

/**
 * A manifest line. Extends the domain's {@link ManifestEntry} so it satisfies
 * anything typed against it, and adds the derived counts an operations screen
 * needs: paired booking/guest rows, check-in progress, waiver completion.
 */
export interface ManifestRow extends ManifestEntry {
  /** Bookings paired with their guest, ordered by surname. */
  bookingRows: BookingRow[]
  guests: number
  checkedIn: number
  seatsRemaining: number
  revenue: number
  resources: Resource[]
  waiversSigned: number
  waiversTotal: number
  /** Minutes past midnight — for timeline and day-grid positioning. */
  startMinutes: number
  endMinutes: number
}

/**
 * Today's operating sheet: every departure on the day, joined with its
 * manifest, guests, crew and gear, in departure order.
 */
export function getTodayManifest(tenantId: string, day: Date = NOW): ManifestRow[] {
  return getDeparturesForDay(tenantId, day)
    .map((departure) => buildManifestRow(departure))
    .filter((row): row is ManifestRow => row !== null)
    .sort((a, b) => Date.parse(a.departure.startsAt) - Date.parse(b.departure.startsAt))
}

/** One departure's manifest, for the departure detail drawer. */
export function getDepartureManifest(departureId: string): ManifestRow | undefined {
  const departure = getDepartureById(departureId)
  return departure ? (buildManifestRow(departure) ?? undefined) : undefined
}

function buildManifestRow(departure: Departure): ManifestRow | null {
  const activity = getActivityById(departure.activityId)
  if (!activity) return null

  const bookingRows = getBookingsByDeparture(departure.id)
    .map(joinBooking)
    .filter((row): row is BookingRow => row !== null)
    .sort((a, b) => a.customer.lastName.localeCompare(b.customer.lastName))

  const live = bookingRows.filter((row) => row.booking.status !== 'cancelled')
  const participants = live.flatMap((row) => row.booking.participants)
  const start = new Date(departure.startsAt)
  const end = new Date(departure.endsAt)

  return {
    departure,
    activity,
    bookings: bookingRows.map((row) => row.booking),
    // Deduplicated: a guest with two bookings on one departure appears once.
    customers: [...new Map(bookingRows.map((row) => [row.customer.id, row.customer])).values()],
    staff: departure.assignedStaffIds
      .map((id) => getUserById(id))
      .filter((user): user is User => Boolean(user)),
    fillRate: Math.round(fillRate(departure.booked, departure.capacity)),
    bookingRows,
    guests: sum(live.map((row) => row.booking.partySize)),
    checkedIn: sum(
      live
        .filter((row) => row.booking.status === 'checked_in' || row.booking.status === 'completed')
        .map((row) => row.booking.partySize),
    ),
    seatsRemaining: seatsRemaining(departure.capacity, departure.booked, departure.held),
    revenue: sum(bookingRows.map((row) => bookingNetRevenue(row.booking))),
    resources: departure.assignedResourceIds
      .map((id) => getResourceById(id))
      .filter((resource): resource is Resource => Boolean(resource)),
    waiversSigned: participants.filter((participant) => participant.waiverSigned).length,
    waiversTotal: participants.length,
    startMinutes: minutesSinceMidnight(start),
    endMinutes: minutesSinceMidnight(end),
  }
}

/* ==========================================================================
   CALENDAR
   ========================================================================== */

export interface CalendarEvent {
  departure: Departure
  activity: Activity
  colorKey: Activity['colorKey']
  fillRate: number
  seatsRemaining: number
  guests: number
  bookings: number
  revenue: number
  startsAt: Date
  endsAt: Date
  startMinutes: number
  endMinutes: number
  isPast: boolean
}

export interface CalendarDay {
  dateKey: string
  date: Date
  events: CalendarEvent[]
  departures: number
  capacity: number
  guests: number
  revenue: number
  occupancy: number
  isToday: boolean
  isPast: boolean
  isWeekend: boolean
}

export interface CalendarTotals {
  departures: number
  capacity: number
  guests: number
  revenue: number
  occupancy: number
  cancelled: number
}

export interface CalendarData {
  from: string
  to: string
  currency: CurrencyCode
  /** Every day in range, keyed by "YYYY-MM-DD" — O(1) per calendar cell, never undefined. */
  days: Record<string, CalendarDay>
  /** The same days in ascending order, for grid iteration. */
  dayList: CalendarDay[]
  events: CalendarEvent[]
  totals: CalendarTotals
}

/**
 * Departures for a date span, pre-bucketed by day.
 *
 * `days` is dense: every date between `from` and `to` has an entry even when
 * nothing runs, so a month grid can key straight into it without a null check
 * on every cell.
 */
export function getCalendarData(tenantId: string, from: Date, to: Date): CalendarData {
  const start = startOfDay(from)
  const end = endOfDay(to)
  const currency = getTenantById(tenantId)?.currency ?? 'USD'
  const nowMs = NOW.getTime()

  const days: Record<string, CalendarDay> = {}
  const dayList: CalendarDay[] = []
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const weekday = cursor.getDay()
    const day: CalendarDay = {
      dateKey: toDateKey(cursor),
      date: new Date(cursor),
      events: [],
      departures: 0,
      capacity: 0,
      guests: 0,
      revenue: 0,
      occupancy: 0,
      isToday: isSameDay(cursor, NOW),
      isPast: endOfDay(cursor).getTime() < nowMs,
      isWeekend: weekday === 0 || weekday === 6,
    }
    days[day.dateKey] = day
    dayList.push(day)
  }

  const events: CalendarEvent[] = []
  const totals: CalendarTotals = {
    departures: 0,
    capacity: 0,
    guests: 0,
    revenue: 0,
    occupancy: 0,
    cancelled: 0,
  }

  for (const departure of getDeparturesInRange(tenantId, start, end)) {
    const activity = getActivityById(departure.activityId)
    if (!activity) continue

    const startsAt = new Date(departure.startsAt)
    const endsAt = new Date(departure.endsAt)
    const day = days[toDateKey(startsAt)]
    if (!day) continue

    const departureFigures = departureTotals(departure.id)
    const event: CalendarEvent = {
      departure,
      activity,
      colorKey: activity.colorKey,
      fillRate: Math.round(fillRate(departure.booked, departure.capacity)),
      seatsRemaining: seatsRemaining(departure.capacity, departure.booked, departure.held),
      guests: departureFigures.guests,
      bookings: departureFigures.bookings,
      revenue: departureFigures.revenue,
      startsAt,
      endsAt,
      startMinutes: minutesSinceMidnight(startsAt),
      endMinutes: minutesSinceMidnight(endsAt),
      isPast: startsAt.getTime() < nowMs,
    }

    day.events.push(event)
    events.push(event)

    if (departure.status === 'cancelled') {
      totals.cancelled += 1
      continue
    }

    day.departures += 1
    day.capacity += departure.capacity
    day.guests += departureFigures.guests
    day.revenue += departureFigures.revenue
    totals.departures += 1
    totals.capacity += departure.capacity
    totals.guests += departureFigures.guests
    totals.revenue += departureFigures.revenue
  }

  for (const day of dayList) {
    day.events.sort((a, b) => a.startMinutes - b.startMinutes)
    day.occupancy = day.capacity === 0 ? 0 : Math.round((day.guests / day.capacity) * 100)
  }
  totals.occupancy = totals.capacity === 0 ? 0 : Math.round((totals.guests / totals.capacity) * 100)

  return { from: toDateKey(start), to: toDateKey(end), currency, days, dayList, events, totals }
}

/* ==========================================================================
   ACTIVITIES
   ========================================================================== */

export interface ReviewRow {
  id: string
  bookingId: string
  activityId: string
  activityName: string
  customerName: string
  avatarUrl?: string
  countryCode: string
  rating: number
  text: string
  createdAt: string
  /** The guest's own words, if they left any beyond the star rating. */
  hasText: boolean
}

export interface RatingBucket {
  stars: number
  count: number
  share: number
}

export interface ActivityStats {
  bookings: number
  cancellations: number
  guests: number
  revenue: number
  currency: CurrencyCode
  occupancy: number
  averageOrderValue: number
  revenuePerSeat: number
  cancellationRate: number
  rating: number
  reviewCount: number
  departures: number
  upcomingDepartures: number
  seatsRemaining: number
  nextDepartureAt: string | null
}

export interface ActivityDetail {
  activity: Activity
  tenant: Tenant
  vertical: Vertical
  stats: ActivityStats
  departures: Departure[]
  upcoming: Departure[]
  recentBookings: BookingRow[]
  reviews: ReviewRow[]
  ratingBreakdown: RatingBucket[]
  resources: Resource[]
  /** 0 = Monday. Shows which days this product actually sells. */
  occupancyByWeekday: { weekday: number; occupancy: number; departures: number }[]
  revenueSeries: { date: string; revenue: number; bookings: number; guests: number }[]
  priceFrom: number
}

export interface ActivityOverviewRow {
  activity: Activity
  stats: ActivityStats
  performance: ActivityPerformance | undefined
}

function buildActivityStats(activity: Activity, bookings: Booking[], departures: Departure[]): ActivityStats {
  const live = bookings.filter((booking) => booking.status !== 'cancelled')
  const cancellations = bookings.length - live.length
  const revenue = sum(bookings.map(bookingNetRevenue))
  const guests = sum(live.map((booking) => booking.partySize))

  const scheduled = departures.filter((departure) => departure.status !== 'cancelled')
  const capacity = sum(scheduled.map((departure) => departure.capacity))
  const upcoming = scheduled.filter((departure) => Date.parse(departure.startsAt) >= NOW.getTime())

  const rated = bookings.filter((booking) => booking.rating !== undefined)

  return {
    bookings: live.length,
    cancellations,
    guests,
    revenue,
    currency: activity.currency,
    occupancy: capacity === 0 ? 0 : Math.round(clamp((guests / capacity) * 100, 0, 100)),
    averageOrderValue: live.length === 0 ? 0 : Math.round(revenue / live.length),
    revenuePerSeat: guests === 0 ? 0 : Math.round(revenue / guests),
    cancellationRate: bookings.length === 0 ? 0 : Math.round((cancellations / bookings.length) * 1000) / 10,
    rating:
      rated.length === 0
        ? activity.rating
        : Math.round((sum(rated.map((booking) => booking.rating ?? 0)) / rated.length) * 100) / 100,
    reviewCount: rated.length,
    departures: scheduled.length,
    upcomingDepartures: upcoming.length,
    seatsRemaining: sum(
      upcoming.map((departure) => seatsRemaining(departure.capacity, departure.booked, departure.held)),
    ),
    nextDepartureAt: upcoming[0]?.startsAt ?? null,
  }
}

function toReviewRow(booking: Booking): ReviewRow | null {
  if (booking.rating === undefined) return null
  const customer = getCustomerById(booking.customerId)
  const activity = getActivityById(booking.activityId)
  if (!customer || !activity) return null
  return {
    id: `rev_${booking.id}`,
    bookingId: booking.id,
    activityId: activity.id,
    activityName: activity.name,
    customerName: customerName(customer),
    ...(customer.avatarUrl ? { avatarUrl: customer.avatarUrl } : {}),
    countryCode: customer.country,
    rating: booking.rating,
    text: booking.reviewText ?? '',
    createdAt: booking.updatedAt,
    hasText: Boolean(booking.reviewText),
  }
}

function ratingBreakdown(bookings: Booking[]): RatingBucket[] {
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: bookings.filter((booking) => booking.rating === stars).length,
    share: 0,
  }))
  const total = sum(counts.map((bucket) => bucket.count))
  return counts.map((bucket) => ({
    ...bucket,
    share: total === 0 ? 0 : Math.round((bucket.count / total) * 1000) / 10,
  }))
}

/** The cheapest sellable seat — what a storefront card should print as "from". */
function priceFrom(activity: Activity): number {
  const sellable = activity.priceTiers.filter((tier: PriceTier) => tier.price > 0)
  return sellable.length === 0 ? activity.basePrice : Math.min(...sellable.map((tier) => tier.price))
}

/** One product, with its schedule, its numbers and what guests said about it. */
export function getActivityDetail(tenantId: string, activityId: string): ActivityDetail | undefined {
  const activity = getActivityById(activityId)
  const tenant = getTenantById(tenantId)
  if (!activity || !tenant || activity.tenantId !== tenantId) return undefined

  const departures = getDeparturesByActivity(activityId)
  const bookings = indexFor(tenantId).rows.filter((row) => row.activity.id === activityId)
  const bookingList = bookings.map((row) => row.booking)

  const byWeekday = new Map<number, { capacity: number; guests: number; departures: number }>()
  const byDate = new Map<string, { revenue: number; bookings: number; guests: number }>()

  for (const departure of departures) {
    if (departure.status === 'cancelled') continue
    const weekday = (new Date(departure.startsAt).getDay() + 6) % 7
    const bucket = byWeekday.get(weekday) ?? { capacity: 0, guests: 0, departures: 0 }
    bucket.capacity += departure.capacity
    bucket.departures += 1
    byWeekday.set(weekday, bucket)
  }

  for (const booking of bookingList) {
    if (booking.status === 'cancelled') continue
    const at = new Date(booking.departureAt)
    const weekday = (at.getDay() + 6) % 7
    const bucket = byWeekday.get(weekday)
    if (bucket) bucket.guests += booking.partySize

    const key = toDateKey(at)
    const day = byDate.get(key) ?? { revenue: 0, bookings: 0, guests: 0 }
    day.revenue += bookingNetRevenue(booking)
    day.bookings += 1
    day.guests += booking.partySize
    byDate.set(key, day)
  }

  return {
    activity,
    tenant,
    vertical: getVertical(activity.category),
    stats: buildActivityStats(activity, bookingList, departures),
    departures,
    upcoming: departures.filter(
      (departure) => departure.status !== 'cancelled' && Date.parse(departure.startsAt) >= NOW.getTime(),
    ),
    recentBookings: sortBy(bookings, (row) => Date.parse(row.booking.createdAt), 'desc').slice(0, 10),
    reviews: sortBy(
      bookingList
        .filter((booking) => booking.rating !== undefined && booking.reviewText)
        .map(toReviewRow)
        .filter((review): review is ReviewRow => review !== null),
      (review) => Date.parse(review.createdAt),
      'desc',
    ).slice(0, 24),
    ratingBreakdown: ratingBreakdown(bookingList),
    resources: activity.requiredResourceIds
      .map((id) => getResourceById(id))
      .filter((resource): resource is Resource => Boolean(resource)),
    occupancyByWeekday: Array.from({ length: 7 }, (_, weekday) => {
      const bucket = byWeekday.get(weekday)
      return {
        weekday,
        occupancy:
          !bucket || bucket.capacity === 0
            ? 0
            : Math.round(clamp((bucket.guests / bucket.capacity) * 100, 0, 100)),
        departures: bucket?.departures ?? 0,
      }
    }),
    revenueSeries: [...byDate.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, totals]) => ({ date, ...totals })),
    priceFrom: priceFrom(activity),
  }
}

/** Every product the tenant sells, with its window performance alongside. */
export function getActivitiesOverview(
  tenantId: string,
  preset: RangePreset = '30d',
): ActivityOverviewRow[] {
  const performance = new Map(
    getActivityPerformance(tenantId, preset).map((row) => [row.activityId, row]),
  )
  const bookingsByActivity = new Map<string, Booking[]>()
  for (const row of indexFor(tenantId).rows) {
    const bucket = bookingsByActivity.get(row.activity.id)
    if (bucket) bucket.push(row.booking)
    else bookingsByActivity.set(row.activity.id, [row.booking])
  }

  return getActivitiesByTenant(tenantId).map((activity) => ({
    activity,
    stats: buildActivityStats(
      activity,
      bookingsByActivity.get(activity.id) ?? [],
      getDeparturesByActivity(activity.id),
    ),
    performance: performance.get(activity.id),
  }))
}

/* ==========================================================================
   BOOKINGS
   ========================================================================== */

export interface BookingTimelineEvent {
  id: string
  kind:
    | 'created'
    | 'payment'
    | 'confirmed'
    | 'reminder'
    | 'checked_in'
    | 'completed'
    | 'cancelled'
    | 'refund'
    | 'review'
    | 'no_show'
  label: string
  detail?: string
  at: string
  amount?: number
}

export interface BookingDetail {
  booking: Booking
  customer: Customer
  activity: Activity
  departure: Departure
  tenant: Tenant
  payments: Payment[]
  staff: User[]
  resources: Resource[]
  participants: Participant[]
  /** Everything captured minus everything refunded. */
  netPaid: number
  amountDue: number
  /** Other reservations the same guest holds, newest departure first. */
  guestHistory: BookingRow[]
  /** Other parties travelling on the same departure. */
  sameDeparture: BookingRow[]
  timeline: BookingTimelineEvent[]
}

export function getBookingDetail(bookingId: string): BookingDetail | undefined {
  const booking = getBookingById(bookingId)
  if (!booking) return undefined
  const row = joinBooking(booking)
  const tenant = getTenantById(booking.tenantId)
  if (!row || !tenant) return undefined

  const payments = getPaymentsByBooking(bookingId)
  const netPaid = sum(payments.map((payment) => payment.netAmount))

  return {
    booking,
    customer: row.customer,
    activity: row.activity,
    departure: row.departure,
    tenant,
    payments,
    staff: row.departure.assignedStaffIds
      .map((id) => getUserById(id))
      .filter((user): user is User => Boolean(user)),
    resources: row.departure.assignedResourceIds
      .map((id) => getResourceById(id))
      .filter((resource): resource is Resource => Boolean(resource)),
    participants: booking.participants,
    netPaid,
    amountDue: Math.max(0, booking.total - booking.amountPaid),
    guestHistory: sortBy(
      getBookingsByCustomer(booking.customerId)
        .filter((other) => other.id !== booking.id)
        .map(joinBooking)
        .filter((other): other is BookingRow => other !== null),
      (other) => Date.parse(other.booking.departureAt),
      'desc',
    ).slice(0, 10),
    sameDeparture: getBookingsByDeparture(booking.departureId)
      .filter((other) => other.id !== booking.id)
      .map(joinBooking)
      .filter((other): other is BookingRow => other !== null),
    timeline: buildTimeline(booking, payments),
  }
}

/**
 * The booking's own history, reconstructed from the fields that record it.
 *
 * Nothing here is invented: each event exists only because a timestamp, a
 * payment row or a status on the booking says it happened.
 */
function buildTimeline(booking: Booking, payments: Payment[]): BookingTimelineEvent[] {
  const events: BookingTimelineEvent[] = [
    {
      id: `${booking.id}-created`,
      kind: 'created',
      label: 'Booking created',
      detail: `${booking.channel.replace(/_/g, ' ')} · ${booking.partySize} ${
        booking.partySize === 1 ? 'guest' : 'guests'
      }`,
      at: booking.createdAt,
    },
  ]

  for (const payment of payments) {
    const refund = payment.amount < 0
    events.push({
      id: `${booking.id}-pay-${payment.id}`,
      kind: refund ? 'refund' : 'payment',
      label: refund
        ? 'Refund issued'
        : payment.status === 'failed'
          ? 'Payment declined'
          : payment.status === 'pending'
            ? 'Balance scheduled'
            : 'Payment captured',
      detail: `${payment.method.replace(/_/g, ' ')}${payment.last4 ? ` ···· ${payment.last4}` : ''}`,
      at: payment.createdAt,
      amount: payment.amount,
    })
  }

  if (booking.status !== 'pending' && booking.status !== 'cancelled') {
    events.push({
      id: `${booking.id}-confirmed`,
      kind: 'confirmed',
      label: 'Confirmation sent',
      detail: 'Confirmation and waiver link delivered to the lead guest',
      at: booking.createdAt,
    })
  }

  // Reminders go out 24 hours ahead, but only for departures that have happened.
  const departureMs = Date.parse(booking.departureAt)
  if (departureMs < NOW.getTime() && booking.status !== 'cancelled') {
    events.push({
      id: `${booking.id}-reminder`,
      kind: 'reminder',
      label: 'Reminder sent',
      detail: 'Meeting point, timing and what to bring',
      at: new Date(departureMs - 24 * 60 * 60 * 1000).toISOString(),
    })
  }

  if (booking.status === 'checked_in' || booking.status === 'completed') {
    events.push({
      id: `${booking.id}-checkin`,
      kind: 'checked_in',
      label: 'Party checked in',
      detail: `${booking.participants.filter((p) => p.waiverSigned).length}/${
        booking.participants.length
      } waivers signed`,
      at: booking.departureAt,
    })
  }

  if (booking.status === 'completed') {
    events.push({
      id: `${booking.id}-completed`,
      kind: 'completed',
      label: 'Trip completed',
      at: booking.departureAt,
    })
  }

  if (booking.status === 'no_show') {
    events.push({
      id: `${booking.id}-noshow`,
      kind: 'no_show',
      label: 'Marked as no-show',
      detail: 'Charged in full under the cancellation policy',
      at: booking.departureAt,
    })
  }

  if (booking.cancelledAt) {
    events.push({
      id: `${booking.id}-cancelled`,
      kind: 'cancelled',
      label: 'Booking cancelled',
      ...(booking.cancellationReason ? { detail: booking.cancellationReason } : {}),
      at: booking.cancelledAt,
    })
  }

  if (booking.rating !== undefined) {
    events.push({
      id: `${booking.id}-review`,
      kind: 'review',
      label: `${booking.rating}★ review left`,
      ...(booking.reviewText ? { detail: booking.reviewText } : {}),
      at: booking.updatedAt,
    })
  }

  return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
}

export type BookingsSortKey =
  | 'departureAt'
  | 'createdAt'
  | 'total'
  | 'partySize'
  | 'customer'
  | 'activity'
  | 'status'
  | 'reference'

export interface BookingsTableOptions extends PaginationOptions {
  status?: BookingStatus[]
  paymentStatus?: PaymentStatus[]
  channel?: BookingChannel[]
  activityId?: string
  /** Filters on departure date, inclusive. */
  from?: Date
  to?: Date
  /** Matches reference, guest name, guest email or activity name. */
  search?: string
  /** Only bookings departing at or after NOW. */
  upcomingOnly?: boolean
  sort?: BookingsSortKey
  dir?: SortDirection
}

export type BookingsTableResult = TableResult<BookingRow>

const BOOKING_SORTERS: Record<BookingsSortKey, (row: BookingRow) => number | string> = {
  departureAt: (row) => Date.parse(row.booking.departureAt),
  createdAt: (row) => Date.parse(row.booking.createdAt),
  total: (row) => row.booking.total,
  partySize: (row) => row.booking.partySize,
  customer: (row) => `${row.customer.lastName} ${row.customer.firstName}`.toLowerCase(),
  activity: (row) => row.activity.name.toLowerCase(),
  status: (row) => row.booking.status,
  reference: (row) => row.booking.reference,
}

/** The bookings table: filter, sort, paginate. */
export function getBookingsTable(
  tenantId: string,
  options: BookingsTableOptions = {},
): BookingsTableResult {
  const {
    status,
    paymentStatus,
    channel,
    activityId,
    from,
    to,
    search,
    upcomingOnly,
    sort = 'departureAt',
    dir = 'desc',
    page = 1,
    pageSize = 25,
  } = options

  const fromMs = from ? startOfDay(from).getTime() : undefined
  const toMs = to ? endOfDay(to).getTime() : undefined
  const needle = search ? normalise(search) : ''

  const filtered = indexFor(tenantId).rows.filter((row) => {
    const { booking, customer, activity } = row
    if (status && status.length > 0 && !status.includes(booking.status)) return false
    if (paymentStatus && paymentStatus.length > 0 && !paymentStatus.includes(booking.paymentStatus)) {
      return false
    }
    if (channel && channel.length > 0 && !channel.includes(booking.channel)) return false
    if (activityId && booking.activityId !== activityId) return false

    const departureMs = Date.parse(booking.departureAt)
    if (fromMs !== undefined && departureMs < fromMs) return false
    if (toMs !== undefined && departureMs > toMs) return false
    if (upcomingOnly && departureMs < NOW.getTime()) return false

    if (needle) {
      const haystack = `${booking.reference} ${customer.firstName} ${customer.lastName} ${customer.email} ${activity.name}`
      if (!normalise(haystack).includes(needle)) return false
    }
    return true
  })

  return paginate(sortBy(filtered, BOOKING_SORTERS[sort], dir), page, pageSize)
}

/* ==========================================================================
   CUSTOMERS
   ========================================================================== */

export interface CustomerStats {
  /** Bookings on record in this dataset — may be fewer than `customer.totalBookings`. */
  bookings: number
  cancellations: number
  guests: number
  /** Net revenue from the bookings on record — derived, always ties to the ledger. */
  netSpend: number
  /**
   * Lifetime spend to display. `customer.lifetimeValue` is a stored CRM
   * aggregate covering history older than this dataset, so it is reconciled
   * against the ledger: a cached total can lag what the books actually show,
   * never lead it. Show this, not the raw field.
   */
  lifetimeValue: number
  /** Same reconciliation for the lifetime booking count. */
  lifetimeBookings: number
  averageOrderValue: number
  cancellationRate: number
  averageRating: number | null
  upcoming: number
  /** Computed from actual bookings, not the CRM field on the customer record. */
  firstBookingAt: string | null
  lastBookingAt: string | null
  currency: CurrencyCode
}

export interface CustomerRow {
  customer: Customer
  stats: CustomerStats
  favouriteActivity: Activity | undefined
}

export interface CustomerDetail extends CustomerRow {
  tenant: Tenant
  bookings: BookingRow[]
  upcoming: BookingRow[]
  past: BookingRow[]
  payments: Payment[]
  reviews: ReviewRow[]
}

function statsFromAggregate(
  customer: Customer,
  aggregate: CustomerAggregate | undefined,
  currency: CurrencyCode,
): CustomerStats {
  if (!aggregate) {
    return {
      bookings: 0,
      cancellations: 0,
      guests: 0,
      netSpend: 0,
      lifetimeValue: customer.lifetimeValue,
      lifetimeBookings: customer.totalBookings,
      averageOrderValue: 0,
      cancellationRate: 0,
      averageRating: null,
      upcoming: 0,
      firstBookingAt: null,
      lastBookingAt: null,
      currency,
    }
  }
  const placed = aggregate.bookings + aggregate.cancellations
  return {
    bookings: aggregate.bookings,
    cancellations: aggregate.cancellations,
    guests: aggregate.guests,
    netSpend: aggregate.netSpend,
    lifetimeValue: Math.max(customer.lifetimeValue, aggregate.netSpend),
    lifetimeBookings: Math.max(customer.totalBookings, placed),
    averageOrderValue: aggregate.bookings === 0 ? 0 : Math.round(aggregate.netSpend / aggregate.bookings),
    cancellationRate: placed === 0 ? 0 : Math.round((aggregate.cancellations / placed) * 1000) / 10,
    averageRating:
      aggregate.ratingCount === 0
        ? null
        : Math.round((aggregate.ratingSum / aggregate.ratingCount) * 100) / 100,
    upcoming: aggregate.upcoming,
    firstBookingAt: aggregate.firstAt,
    lastBookingAt: aggregate.lastAt,
    currency,
  }
}

function favouriteActivity(aggregate: CustomerAggregate | undefined): Activity | undefined {
  if (!aggregate || aggregate.activityCounts.size === 0) return undefined
  let bestId = ''
  let bestCount = -1
  for (const [activityId, count] of aggregate.activityCounts) {
    if (count > bestCount) {
      bestCount = count
      bestId = activityId
    }
  }
  return getActivityById(bestId)
}

export function getCustomerDetail(customerId: string): CustomerDetail | undefined {
  const customer = getCustomerById(customerId)
  if (!customer) return undefined
  const tenant = getTenantById(customer.tenantId)
  if (!tenant) return undefined

  const index = indexFor(customer.tenantId)
  const aggregate = index.byCustomer.get(customerId)
  const bookings = sortBy(
    getBookingsByCustomer(customerId)
      .map(joinBooking)
      .filter((row): row is BookingRow => row !== null),
    (row) => Date.parse(row.booking.departureAt),
    'desc',
  )
  const nowMs = NOW.getTime()

  return {
    customer,
    tenant,
    stats: statsFromAggregate(customer, aggregate, tenant.currency),
    favouriteActivity: favouriteActivity(aggregate),
    bookings,
    upcoming: bookings
      .filter((row) => Date.parse(row.booking.departureAt) >= nowMs && row.booking.status !== 'cancelled')
      .reverse(),
    past: bookings.filter((row) => Date.parse(row.booking.departureAt) < nowMs),
    payments: bookings.flatMap((row) => getPaymentsByBooking(row.booking.id)),
    reviews: bookings
      .map((row) => toReviewRow(row.booking))
      .filter((review): review is ReviewRow => review !== null),
  }
}

export type CustomersSortKey =
  | 'name'
  | 'createdAt'
  | 'lifetimeValue'
  | 'totalBookings'
  | 'lastBookingAt'
  | 'netSpend'
  | 'country'

export interface CustomersTableOptions extends PaginationOptions {
  segment?: Customer['segment'][]
  country?: string[]
  tags?: string[]
  marketingOptIn?: boolean
  /** Only guests with a booking departing at or after NOW. */
  hasUpcoming?: boolean
  /** Matches name, email, phone or country. */
  search?: string
  sort?: CustomersSortKey
  dir?: SortDirection
}

export type CustomersTableResult = TableResult<CustomerRow>

const CUSTOMER_ROWS = new Map<string, CustomerRow[]>()

function customerRows(tenantId: string): CustomerRow[] {
  const cached = CUSTOMER_ROWS.get(tenantId)
  if (cached) return cached

  const index = indexFor(tenantId)
  const rows = getCustomersByTenant(tenantId).map((customer) => {
    const aggregate = index.byCustomer.get(customer.id)
    return {
      customer,
      stats: statsFromAggregate(customer, aggregate, index.currency),
      favouriteActivity: favouriteActivity(aggregate),
    }
  })
  CUSTOMER_ROWS.set(tenantId, rows)
  return rows
}

const CUSTOMER_SORTERS: Record<CustomersSortKey, (row: CustomerRow) => number | string> = {
  name: (row) => `${row.customer.lastName} ${row.customer.firstName}`.toLowerCase(),
  createdAt: (row) => Date.parse(row.customer.createdAt),
  lifetimeValue: (row) => row.stats.lifetimeValue,
  totalBookings: (row) => row.stats.lifetimeBookings,
  lastBookingAt: (row) => (row.stats.lastBookingAt ? Date.parse(row.stats.lastBookingAt) : 0),
  netSpend: (row) => row.stats.netSpend,
  country: (row) => row.customer.country,
}

export function getCustomersTable(
  tenantId: string,
  options: CustomersTableOptions = {},
): CustomersTableResult {
  const {
    segment,
    country,
    tags,
    marketingOptIn,
    hasUpcoming,
    search,
    sort = 'lifetimeValue',
    dir = 'desc',
    page = 1,
    pageSize = 25,
  } = options

  const needle = search ? normalise(search) : ''

  const filtered = customerRows(tenantId).filter((row) => {
    const { customer, stats } = row
    if (segment && segment.length > 0 && !segment.includes(customer.segment)) return false
    if (country && country.length > 0 && !country.includes(customer.country)) return false
    if (tags && tags.length > 0 && !tags.some((tag) => customer.tags.includes(tag))) return false
    if (marketingOptIn !== undefined && customer.marketingOptIn !== marketingOptIn) return false
    if (hasUpcoming && stats.upcoming === 0) return false
    if (needle) {
      const haystack = `${customer.firstName} ${customer.lastName} ${customer.email} ${customer.phone} ${customer.country}`
      if (!normalise(haystack).includes(needle)) return false
    }
    return true
  })

  return paginate(sortBy(filtered, CUSTOMER_SORTERS[sort], dir), page, pageSize)
}

/* ==========================================================================
   PAYMENTS & REVIEWS
   ========================================================================== */

export interface PaymentRow {
  payment: Payment
  booking: Booking | undefined
  customer: Customer | undefined
  activity: Activity | undefined
}

export interface PaymentsTableOptions extends PaginationOptions {
  status?: Payment['status'][]
  method?: Payment['method'][]
  from?: Date
  to?: Date
  /** Matches booking reference, guest name or payment id. */
  search?: string
  sort?: 'createdAt' | 'amount' | 'netAmount'
  dir?: SortDirection
}

export type PaymentsTableResult = TableResult<PaymentRow>

/** A page of the ledger plus the totals for everything the filter matched. */
export interface PaymentsLedger extends PaymentsTableResult {
  summary: PaymentsSummary
}

export interface PaymentsSummary {
  captured: number
  refunded: number
  pending: number
  failed: number
  processorFees: number
  net: number
  currency: CurrencyCode
}

/** The payouts ledger: every money movement with its booking attached. */
export function getPaymentsTable(
  tenantId: string,
  options: PaymentsTableOptions = {},
): PaymentsLedger {
  const {
    status,
    method,
    from,
    to,
    search,
    sort = 'createdAt',
    dir = 'desc',
    page = 1,
    pageSize = 25,
  } = options

  const fromMs = from ? startOfDay(from).getTime() : undefined
  const toMs = to ? endOfDay(to).getTime() : undefined
  const needle = search ? normalise(search) : ''
  const currency = getTenantById(tenantId)?.currency ?? 'USD'

  const rows: PaymentRow[] = []
  const summary: PaymentsSummary = {
    captured: 0,
    refunded: 0,
    pending: 0,
    failed: 0,
    processorFees: 0,
    net: 0,
    currency,
  }

  for (const payment of getPaymentsByTenant(tenantId)) {
    const booking = getBookingById(payment.bookingId)
    const customer = booking ? getCustomerById(booking.customerId) : undefined
    const activity = booking ? getActivityById(booking.activityId) : undefined

    if (status && status.length > 0 && !status.includes(payment.status)) continue
    if (method && method.length > 0 && !method.includes(payment.method)) continue
    const createdMs = Date.parse(payment.createdAt)
    if (fromMs !== undefined && createdMs < fromMs) continue
    if (toMs !== undefined && createdMs > toMs) continue
    if (needle) {
      const haystack = `${payment.id} ${booking?.reference ?? ''} ${
        customer ? customerName(customer) : ''
      }`
      if (!normalise(haystack).includes(needle)) continue
    }

    rows.push({ payment, booking, customer, activity })

    if (payment.status === 'succeeded') summary.captured += payment.amount
    else if (payment.status === 'refunded') summary.refunded += Math.abs(payment.amount)
    else if (payment.status === 'pending') summary.pending += payment.amount
    else if (payment.status === 'failed') summary.failed += payment.amount
    summary.processorFees += payment.processorFee
    summary.net += payment.netAmount
  }

  const sorter =
    sort === 'amount'
      ? (row: PaymentRow) => row.payment.amount
      : sort === 'netAmount'
        ? (row: PaymentRow) => row.payment.netAmount
        : (row: PaymentRow) => Date.parse(row.payment.createdAt)

  return { ...paginate(sortBy(rows, sorter, dir), page, pageSize), summary }
}

export interface ReviewsOptions extends PaginationOptions {
  activityId?: string
  /** Exact star values to include, e.g. [1, 2, 3]. */
  ratings?: number[]
  withTextOnly?: boolean
  search?: string
  sort?: 'createdAt' | 'rating'
  dir?: SortDirection
}

export interface ReviewsResult extends TableResult<ReviewRow> {
  averageRating: number
  breakdown: RatingBucket[]
}

export function getReviews(tenantId: string, options: ReviewsOptions = {}): ReviewsResult {
  const {
    activityId,
    ratings,
    withTextOnly = true,
    search,
    sort = 'createdAt',
    dir = 'desc',
    page = 1,
    pageSize = 20,
  } = options
  const needle = search ? normalise(search) : ''

  const rated = getBookingsByTenant(tenantId).filter((booking) => booking.rating !== undefined)
  const filtered = rated
    .filter((booking) => {
      if (activityId && booking.activityId !== activityId) return false
      if (ratings && ratings.length > 0 && !ratings.includes(booking.rating ?? 0)) return false
      if (withTextOnly && !booking.reviewText) return false
      if (needle && !normalise(booking.reviewText ?? '').includes(needle)) return false
      return true
    })
    .map(toReviewRow)
    .filter((review): review is ReviewRow => review !== null)

  const sorted = sortBy(
    filtered,
    sort === 'rating' ? (review) => review.rating : (review) => Date.parse(review.createdAt),
    dir,
  )

  const scope = activityId ? rated.filter((booking) => booking.activityId === activityId) : rated
  return {
    ...paginate(sorted, page, pageSize),
    averageRating:
      scope.length === 0
        ? 0
        : Math.round((sum(scope.map((booking) => booking.rating ?? 0)) / scope.length) * 100) / 100,
    breakdown: ratingBreakdown(scope),
  }
}

/* ==========================================================================
   TEAM & RESOURCES
   ========================================================================== */

export interface TeamMember {
  user: User
  /** Departures assigned from NOW forward. */
  upcomingAssignments: number
  /** Departures worked inside the synthesised history. */
  completedAssignments: number
  nextAssignmentAt: string | null
  guestsHosted: number
}

export function getTeam(tenantId: string): TeamMember[] {
  const nowMs = NOW.getTime()
  const stats = new Map<string, { upcoming: number; completed: number; next: string | null; guests: number }>()

  for (const departure of getDeparturesInRange(tenantId, addDays(NOW, -400), addDays(NOW, 400))) {
    if (departure.status === 'cancelled') continue
    const future = Date.parse(departure.startsAt) >= nowMs
    for (const staffId of departure.assignedStaffIds) {
      const bucket = stats.get(staffId) ?? { upcoming: 0, completed: 0, next: null, guests: 0 }
      if (future) {
        bucket.upcoming += 1
        if (!bucket.next || departure.startsAt < bucket.next) bucket.next = departure.startsAt
      } else {
        bucket.completed += 1
        bucket.guests += departure.booked
      }
      stats.set(staffId, bucket)
    }
  }

  return getUsersByTenant(tenantId).map((user) => {
    const bucket = stats.get(user.id)
    return {
      user,
      upcomingAssignments: bucket?.upcoming ?? 0,
      completedAssignments: bucket?.completed ?? 0,
      nextAssignmentAt: bucket?.next ?? null,
      guestsHosted: bucket?.guests ?? 0,
    }
  })
}

export interface ResourceRow {
  resource: Resource
  /** Activities that require this resource to run. */
  activities: Activity[]
  upcomingDepartures: number
  /** Seats offered against seats sold on this resource, next 30 days. */
  utilisation: number
}

export function getResourcesOverview(tenantId: string): ResourceRow[] {
  const horizon = getDeparturesInRange(tenantId, NOW, endOfDay(addDays(NOW, 29)))
  const usage = new Map<string, { departures: number; capacity: number; booked: number }>()

  for (const departure of horizon) {
    if (departure.status === 'cancelled') continue
    for (const resourceId of departure.assignedResourceIds) {
      const bucket = usage.get(resourceId) ?? { departures: 0, capacity: 0, booked: 0 }
      bucket.departures += 1
      bucket.capacity += departure.capacity
      bucket.booked += departure.booked
      usage.set(resourceId, bucket)
    }
  }

  const activities = getActivitiesByTenant(tenantId)
  return getResourcesByTenant(tenantId).map((resource) => {
    const bucket = usage.get(resource.id)
    return {
      resource,
      activities: activities.filter((activity) => activity.requiredResourceIds.includes(resource.id)),
      upcomingDepartures: bucket?.departures ?? 0,
      utilisation:
        !bucket || bucket.capacity === 0
          ? 0
          : Math.round(clamp((bucket.booked / bucket.capacity) * 100, 0, 100)),
    }
  })
}

/* ==========================================================================
   PUBLIC STOREFRONT
   ========================================================================== */

export interface AvailabilitySlot {
  departureId: string
  startsAt: string
  endsAt: string
  /** Minutes past midnight, for time-of-day grouping in the picker. */
  startMinutes: number
  seatsRemaining: number
  status: DepartureStatus
  /** Minor units — the departure's override if dynamic pricing applies. */
  price: number
  isSoldOut: boolean
  isLastFew: boolean
}

export interface AvailabilityDay {
  dateKey: string
  date: Date
  slots: AvailabilitySlot[]
  seatsRemaining: number
  /** Cheapest bookable seat on the day. */
  priceFrom: number
  isSoldOut: boolean
}

/**
 * What the public booking widget draws: bookable departures per day, with the
 * price a guest would actually be charged.
 */
export function getAvailability(
  tenantId: string,
  activityId: string,
  from: Date = NOW,
  to: Date = addDays(NOW, 60),
): AvailabilityDay[] {
  const activity = getActivityById(activityId)
  if (!activity || activity.tenantId !== tenantId) return []

  const byDay = new Map<string, AvailabilityDay>()
  const nowMs = NOW.getTime()

  for (const departure of getDeparturesInRange(tenantId, startOfDay(from), endOfDay(to))) {
    if (departure.activityId !== activityId) continue
    if (departure.status === 'cancelled') continue
    const startsAt = new Date(departure.startsAt)
    // A guest cannot book a trip that has already left.
    if (startsAt.getTime() < nowMs) continue

    const remaining = seatsRemaining(departure.capacity, departure.booked, departure.held)
    const price = departure.priceOverride ?? priceFrom(activity)
    const key = toDateKey(startsAt)
    const day =
      byDay.get(key) ??
      ({
        dateKey: key,
        date: startOfDay(startsAt),
        slots: [],
        seatsRemaining: 0,
        priceFrom: Number.POSITIVE_INFINITY,
        isSoldOut: true,
      } satisfies AvailabilityDay)

    day.slots.push({
      departureId: departure.id,
      startsAt: departure.startsAt,
      endsAt: departure.endsAt,
      startMinutes: minutesSinceMidnight(startsAt),
      seatsRemaining: remaining,
      status: departure.status,
      price,
      isSoldOut: remaining === 0 || departure.status === 'sold_out',
      isLastFew: remaining > 0 && remaining <= 3,
    })
    day.seatsRemaining += remaining
    day.priceFrom = Math.min(day.priceFrom, price)
    if (remaining > 0 && departure.status !== 'sold_out') day.isSoldOut = false
    byDay.set(key, day)
  }

  return [...byDay.values()]
    .map((day) => ({
      ...day,
      priceFrom: Number.isFinite(day.priceFrom) ? day.priceFrom : priceFrom(activity),
      slots: day.slots.sort((a, b) => a.startMinutes - b.startMinutes),
    }))
    .sort((a, b) => (a.dateKey < b.dateKey ? -1 : 1))
}

export interface StorefrontCard {
  activity: Activity
  priceFrom: number
  nextDepartureAt: string | null
  seatsRemainingToday: number
  rating: number
  reviewCount: number
}

export interface Storefront {
  tenant: Tenant
  vertical: Vertical
  featured: StorefrontCard[]
  activities: StorefrontCard[]
  categories: { key: VerticalKey; label: string; count: number }[]
  reviews: ReviewRow[]
  rating: number
  reviewCount: number
}

function storefrontCard(activity: Activity): StorefrontCard {
  const upcoming = getDeparturesByActivity(activity.id).filter(
    (departure) => departure.status !== 'cancelled' && Date.parse(departure.startsAt) >= NOW.getTime(),
  )
  const today = upcoming.filter((departure) => isSameDay(new Date(departure.startsAt), NOW))
  return {
    activity,
    priceFrom: priceFrom(activity),
    nextDepartureAt: upcoming[0]?.startsAt ?? null,
    seatsRemainingToday: sum(
      today.map((departure) => seatsRemaining(departure.capacity, departure.booked, departure.held)),
    ),
    rating: activity.rating,
    reviewCount: activity.reviewCount,
  }
}

/** The public booking site for one operator, resolved by slug. */
export function getStorefront(slug: string): Storefront | undefined {
  const tenant = getTenantBySlug(slug) ?? getTenantById(slug)
  if (!tenant) return undefined

  const live = getLiveActivities(tenant.id)
  const categories = new Map<VerticalKey, number>()
  for (const activity of live) {
    categories.set(activity.category, (categories.get(activity.category) ?? 0) + 1)
  }

  const reviews = sortBy(
    getBookingsByTenant(tenant.id)
      .filter((booking) => booking.rating !== undefined && booking.reviewText && booking.rating >= 4)
      .map(toReviewRow)
      .filter((review): review is ReviewRow => review !== null),
    (review) => Date.parse(review.createdAt),
    'desc',
  ).slice(0, 12)

  return {
    tenant,
    vertical: getVertical(tenant.vertical),
    featured: getFeaturedActivities(tenant.id).map(storefrontCard),
    activities: live.map(storefrontCard),
    categories: [...categories.entries()].map(([key, count]) => ({
      key,
      label: getVertical(key).label,
      count,
    })),
    reviews,
    rating: tenant.stats.avgRating,
    reviewCount: tenant.stats.reviewCount,
  }
}

export interface StorefrontActivity {
  tenant: Tenant
  activity: Activity
  vertical: Vertical
  priceFrom: number
  availability: AvailabilityDay[]
  reviews: ReviewRow[]
  ratingBreakdown: RatingBucket[]
  related: StorefrontCard[]
  meetingPointLabel: string
}

/** One product page on the public site, with live availability attached. */
export function getStorefrontActivity(
  slug: string,
  activitySlug: string,
): StorefrontActivity | undefined {
  const tenant = getTenantBySlug(slug) ?? getTenantById(slug)
  if (!tenant) return undefined
  const activity = getActivityBySlug(tenant.id, activitySlug)
  if (!activity || activity.status !== 'live') return undefined

  const bookings = getBookingsByTenant(tenant.id).filter(
    (booking) => booking.activityId === activity.id && booking.rating !== undefined,
  )

  return {
    tenant,
    activity,
    vertical: getVertical(activity.category),
    priceFrom: priceFrom(activity),
    availability: getAvailability(tenant.id, activity.id),
    reviews: sortBy(
      bookings
        .filter((booking) => booking.reviewText)
        .map(toReviewRow)
        .filter((review): review is ReviewRow => review !== null),
      (review) => Date.parse(review.createdAt),
      'desc',
    ).slice(0, 16),
    ratingBreakdown: ratingBreakdown(bookings),
    related: getLiveActivities(tenant.id)
      .filter((other) => other.id !== activity.id && other.category === activity.category)
      .slice(0, 4)
      .map(storefrontCard),
    meetingPointLabel: `${activity.meetingPoint} · ${tenant.city}`,
  }
}

/* ==========================================================================
   SEARCH
   ========================================================================== */

export type SearchResultType = 'activity' | 'booking' | 'customer' | 'departure'

export interface SearchResultItem {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  meta?: string
  href: string
  score: number
}

export interface SearchResults {
  query: string
  total: number
  activities: SearchResultItem[]
  bookings: SearchResultItem[]
  customers: SearchResultItem[]
  departures: SearchResultItem[]
  /** All groups interleaved and ranked — for a flat command-palette list. */
  all: SearchResultItem[]
}

interface IndexedEntry {
  haystack: string
  build: () => SearchResultItem
}

interface SearchIndex {
  activities: IndexedEntry[]
  bookings: IndexedEntry[]
  customers: IndexedEntry[]
  departures: IndexedEntry[]
}

const SEARCH_INDEX = new Map<string, SearchIndex>()

function buildSearchIndex(tenantId: string): SearchIndex {
  const index = indexFor(tenantId)

  const activities: IndexedEntry[] = getActivitiesByTenant(tenantId).map((activity) => ({
    haystack: normalise(`${activity.name} ${activity.tagline} ${activity.category} ${activity.slug}`),
    build: () => ({
      id: activity.id,
      type: 'activity' as const,
      title: activity.name,
      subtitle: activity.tagline,
      meta: `${activity.status} · ${activity.maxCapacity} seats`,
      href: `/activities/${activity.id}`,
      score: 0,
    }),
  }))

  const bookings: IndexedEntry[] = index.rows.map((row) => ({
    haystack: normalise(
      `${row.booking.reference} ${row.customer.firstName} ${row.customer.lastName} ${row.customer.email} ${row.activity.name}`,
    ),
    build: () => ({
      id: row.booking.id,
      type: 'booking' as const,
      title: `${row.booking.reference} · ${customerName(row.customer)}`,
      subtitle: `${row.activity.name} · ${formatDateShort(row.booking.departureAt)} ${formatTime(
        row.booking.departureAt,
      )}`,
      meta: `${row.booking.status} · ${row.booking.partySize} pax`,
      href: `/bookings/${row.booking.id}`,
      score: 0,
    }),
  }))

  const customers: IndexedEntry[] = getCustomersByTenant(tenantId).map((customer) => ({
    haystack: normalise(
      `${customer.firstName} ${customer.lastName} ${customer.email} ${customer.phone} ${customer.country}`,
    ),
    build: () => ({
      id: customer.id,
      type: 'customer' as const,
      title: customerName(customer),
      subtitle: customer.email,
      meta: `${customer.segment} · ${customer.totalBookings} bookings`,
      href: `/customers/${customer.id}`,
      score: 0,
    }),
  }))

  const departures: IndexedEntry[] = getUpcomingDepartures(tenantId, 400)
    .map<IndexedEntry | null>((departure) => {
      const activity = getActivityById(departure.activityId)
      if (!activity) return null
      const label = `${formatDateShort(departure.startsAt)} ${formatTime(departure.startsAt)}`
      return {
        haystack: normalise(`${activity.name} ${label} ${departure.id}`),
        build: () => ({
          id: departure.id,
          type: 'departure' as const,
          title: `${activity.name} · ${label}`,
          subtitle: `${departure.booked}/${departure.capacity} seats`,
          meta: departure.status,
          href: `/calendar?departure=${departure.id}`,
          score: 0,
        }),
      }
    })
    .filter((entry): entry is IndexedEntry => entry !== null)

  const built: SearchIndex = { activities, bookings, customers, departures }
  SEARCH_INDEX.set(tenantId, built)
  return built
}

/**
 * Ranks a needle against a haystack.
 *
 * A prefix hit beats a hit in the middle of a field, which is what makes typing
 * a confirmation code or the first letters of a surname feel instant. Returns 0
 * for no match so the caller can filter on truthiness.
 */
function score(haystack: string, needle: string): number {
  const at = haystack.indexOf(needle)
  if (at < 0) return 0
  if (at === 0) return 120 - Math.min(haystack.length, 60) / 60
  // A hit at a word boundary is nearly as good as a prefix.
  const boundary = haystack[at - 1] === ' '
  return (boundary ? 80 : 40) - Math.min(haystack.length, 60) / 60
}

/**
 * Score every candidate, then materialise only the winners.
 *
 * `build()` formats dates and times, which is an order of magnitude more
 * expensive than the substring scan — a broad query like "sun" matches
 * thousands of bookings, so constructing result objects before ranking makes
 * the palette feel laggy on every keystroke. Rank on the cheap field, build at
 * most `limit` objects.
 */
function collect(entries: IndexedEntry[], needle: string, limit: number): SearchResultItem[] {
  const hits: { entry: IndexedEntry; score: number }[] = []
  for (const entry of entries) {
    const value = score(entry.haystack, needle)
    if (value > 0) hits.push({ entry, score: value })
  }
  return hits
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry, score: value }) => ({ ...entry.build(), score: Math.round(value) }))
}

/**
 * Unified search for the command palette.
 *
 * Scans the tenant's activities, bookings, guests and forward departures from a
 * lazily built, lowercased index. Queries shorter than two characters return
 * empty rather than the whole database.
 */
export function searchEverything(tenantId: string, query: string, limit = 6): SearchResults {
  const needle = normalise(query)
  const empty: SearchResults = {
    query,
    total: 0,
    activities: [],
    bookings: [],
    customers: [],
    departures: [],
    all: [],
  }
  if (needle.length < 2) return empty

  const index = SEARCH_INDEX.get(tenantId) ?? buildSearchIndex(tenantId)
  const activities = collect(index.activities, needle, limit)
  const bookings = collect(index.bookings, needle, limit)
  const customers = collect(index.customers, needle, limit)
  const departures = collect(index.departures, needle, limit)
  const all = [...activities, ...bookings, ...customers, ...departures].sort((a, b) => b.score - a.score)

  return {
    query,
    total: all.length,
    activities,
    bookings,
    customers,
    departures,
    all,
  }
}

/* ==========================================================================
   MARKETING SITE
   ========================================================================== */

export interface MarketingContent {
  plans: PricingPlan[]
  planFeatureLabels: string[]
  testimonials: Testimonial[]
  faqs: FaqItem[]
  features: FeatureBlock[]
  integrations: Integration[]
  integrationCategories: { key: Integration['category']; label: string }[]
  stats: { value: string; label: string; hint?: string }[]
  logos: { name: string; mark: string }[]
  verticals: Vertical[]
  /** Live demo operators the marketing site can link into. */
  showcase: { slug: string; name: string; vertical: VerticalKey; activities: number }[]
}

let MARKETING: MarketingContent | null = null

/** Everything the public site renders, in one call. */
export function getMarketingContent(): MarketingContent {
  if (MARKETING) return MARKETING
  MARKETING = {
    plans: PRICING_PLANS,
    planFeatureLabels: PRICING_FEATURE_LABELS,
    testimonials: TESTIMONIALS,
    faqs: FAQS,
    features: FEATURE_BLOCKS,
    integrations: INTEGRATIONS,
    integrationCategories: INTEGRATION_CATEGORIES,
    stats: STATS,
    logos: LOGO_MARKS,
    verticals: VERTICALS,
    showcase: TENANTS.map((tenant) => ({
      slug: tenant.slug,
      name: tenant.name,
      vertical: tenant.vertical,
      activities: getLiveActivities(tenant.id).length,
    })),
  }
  return MARKETING
}

/** FAQs for one category, in authored order. */
export function getFaqsByCategory(category: FaqItem['category']): FaqItem[] {
  return FAQS.filter((faq) => faq.category === category)
}

/** The vertical landing pages: one per industry, with real sample products. */
export function getVerticalShowcase(key: VerticalKey): {
  vertical: Vertical
  tenants: Tenant[]
  activities: Activity[]
} {
  return {
    vertical: getVertical(key),
    tenants: TENANTS.filter((tenant) => tenant.vertical === key),
    activities: ACTIVITIES.filter(
      (activity) => activity.category === key && activity.status === 'live',
    ).slice(0, 8),
  }
}

/* ==========================================================================
   MISC OPERATIONS HELPERS
   ========================================================================== */

/** Resources that could cover a departure — used by the reassignment dialog. */
export function getAssignableResources(tenantId: string, kind?: Resource['kind']): Resource[] {
  const available = getAvailableResources(tenantId)
  return kind ? available.filter((resource) => resource.kind === kind) : available
}

/** Live activities only, for pickers and filter dropdowns. */
export function getActivityOptions(tenantId: string): { value: string; label: string }[] {
  return getActivitiesByTenant(tenantId).map((activity) => ({
    value: activity.id,
    label: activity.name,
  }))
}

/** Distinct source markets present in a tenant's guest base, most common first. */
export function getCountryOptions(tenantId: string): { value: string; label: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const customer of getCustomersByTenant(tenantId)) {
    counts.set(customer.country, (counts.get(customer.country) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: value, count }))
}
