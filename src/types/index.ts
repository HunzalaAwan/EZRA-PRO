/**
 * EZRA PRO — Domain model
 *
 * Every entity below is tenant-scoped via `tenantId` (except Tenant itself).
 * This file is the single source of truth for the shape of data across the
 * marketing site, the operator dashboard, and the public booking storefront.
 */

/* ==========================================================================
   TENANCY & IDENTITY
   ========================================================================== */

export type PlanTier = 'starter' | 'growth' | 'scale' | 'enterprise'

export type VerticalKey =
  | 'watersports'
  | 'tours'
  | 'restaurants'
  | 'adventure'
  | 'island'
  | 'wellness'

export interface Vertical {
  key: VerticalKey
  label: string
  /** Short marketing line used on the landing page vertical switcher. */
  tagline: string
  /** lucide-react icon name, resolved at render time. */
  icon: string
  /** Representative activity names for demo/marketing surfaces. */
  sampleActivities: string[]
  accent: 'lagoon' | 'coral' | 'sunset' | 'reef'
}

export interface TenantBranding {
  primaryColor: string
  logoText: string
  /** Optional hero image for the public storefront. */
  coverImage?: string
  /** Public-facing booking flow accent. */
  accentColor: string
}

export interface Tenant {
  id: string
  /** URL-safe identifier used for subdomain + path routing. */
  slug: string
  name: string
  legalName: string
  vertical: VerticalKey
  plan: PlanTier
  status: 'active' | 'trialing' | 'past_due' | 'paused'
  currency: CurrencyCode
  timezone: string
  locale: string
  country: string
  city: string
  createdAt: string
  branding: TenantBranding
  /** Feature flags resolved from plan + overrides. */
  features: TenantFeatures
  stats: TenantStats
  contact: {
    email: string
    phone: string
    website: string
    addressLine: string
  }
}

export interface TenantFeatures {
  advancedAnalytics: boolean
  resourceScheduling: boolean
  multiLocation: boolean
  apiAccess: boolean
  customBranding: boolean
  waitlists: boolean
  dynamicPricing: boolean
  channelManager: boolean
  giftCards: boolean
  memberships: boolean
}

export interface TenantStats {
  monthlyBookings: number
  monthlyRevenue: number
  activeActivities: number
  teamSize: number
  avgRating: number
  reviewCount: number
}

export type Role = 'owner' | 'admin' | 'manager' | 'staff' | 'guide' | 'viewer'

export interface User {
  id: string
  tenantId: string
  name: string
  email: string
  role: Role
  avatarUrl: string
  title: string
  phone?: string
  status: 'active' | 'invited' | 'suspended'
  lastActiveAt: string
  /** Staff who can be assigned to departures. */
  isBookable: boolean
  certifications?: string[]
}

/* ==========================================================================
   MONEY
   ========================================================================== */

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'AUD' | 'NZD' | 'CAD'

/** Money is always stored in minor units (cents) to avoid float drift. */
export interface Money {
  amount: number
  currency: CurrencyCode
}

/* ==========================================================================
   ACTIVITIES (the sellable product)
   ========================================================================== */

export type ActivityStatus = 'draft' | 'live' | 'paused' | 'archived'

export type PricingModel = 'per_person' | 'per_group' | 'per_unit' | 'tiered'

export type DifficultyLevel = 'easy' | 'moderate' | 'challenging' | 'extreme'

export interface PriceTier {
  id: string
  /** e.g. "Adult", "Child (4-12)", "Senior", "Private charter" */
  label: string
  /** Minor units. */
  price: number
  /** Optional strike-through price for promo display. */
  compareAtPrice?: number
  minQuantity: number
  maxQuantity: number
  description?: string
  /** Counts against the activity capacity. Comp tickets may not. */
  countsTowardCapacity: boolean
}

export interface AddOn {
  id: string
  label: string
  price: number
  description: string
  /** Limit per booking; null = unlimited. */
  maxPerBooking: number | null
  required: boolean
  icon?: string
}

export interface ActivityMedia {
  id: string
  url: string
  alt: string
  type: 'image' | 'video'
  isPrimary: boolean
}

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly' | 'none'

export interface RecurrenceRule {
  freq: RecurrenceFreq
  /** 0=Sun … 6=Sat. Used when freq === 'weekly'. */
  weekdays: number[]
  interval: number
  /** ISO date; null = open-ended. */
  until: string | null
}

/** A repeating template that generates Departures. */
export interface ScheduleTemplate {
  id: string
  activityId: string
  label: string
  /** "HH:mm" local to tenant timezone. */
  startTimes: string[]
  recurrence: RecurrenceRule
  capacity: number
  seasonStart: string
  seasonEnd: string
  active: boolean
}

export interface CancellationPolicy {
  /** Full refund if cancelled at least N hours before start. */
  freeCancellationHours: number
  /** Percent refunded inside the window (0-100). */
  lateRefundPercent: number
  summary: string
}

export interface Activity {
  id: string
  tenantId: string
  slug: string
  name: string
  tagline: string
  description: string
  /** Bullet list rendered on the storefront. */
  highlights: string[]
  included: string[]
  excluded: string[]
  requirements: string[]
  meetingPoint: string
  category: VerticalKey
  status: ActivityStatus
  difficulty: DifficultyLevel
  /** Minutes. */
  durationMinutes: number
  minAge: number
  maxCapacity: number
  minParticipants: number
  pricingModel: PricingModel
  basePrice: number
  currency: CurrencyCode
  priceTiers: PriceTier[]
  addOns: AddOn[]
  media: ActivityMedia[]
  /** Colour key used to tint this activity on the calendar. */
  colorKey: 'lagoon' | 'coral' | 'sunset' | 'reef' | 'info' | 'success'
  cancellationPolicy: CancellationPolicy
  /** Resources (boats, kayaks, tables, guides) each departure consumes. */
  requiredResourceIds: string[]
  rating: number
  reviewCount: number
  totalBookings: number
  createdAt: string
  updatedAt: string
  /** SEO + storefront */
  seoTitle?: string
  seoDescription?: string
  featured: boolean
}

/* ==========================================================================
   DEPARTURES (a concrete, bookable instance on the calendar)
   ========================================================================== */

export type DepartureStatus =
  | 'scheduled'
  | 'confirmed'
  | 'sold_out'
  | 'cancelled'
  | 'completed'
  | 'weather_hold'

export interface Departure {
  id: string
  tenantId: string
  activityId: string
  /** Full ISO datetime in tenant timezone. */
  startsAt: string
  endsAt: string
  capacity: number
  booked: number
  /** Seats held by carts in progress. */
  held: number
  status: DepartureStatus
  assignedStaffIds: string[]
  assignedResourceIds: string[]
  notes?: string
  /** Override price for this departure only (minor units). */
  priceOverride?: number
  /** Optional surge/discount multiplier applied by dynamic pricing. */
  priceMultiplier?: number
  weather?: WeatherSnapshot
}

export interface WeatherSnapshot {
  condition: 'clear' | 'cloudy' | 'rain' | 'storm' | 'wind'
  tempC: number
  windKts: number
  swellM?: number
  /** 0-100 — operator-facing confidence the departure runs. */
  goConfidence: number
}

/* ==========================================================================
   RESOURCES (boats, kayaks, tables, vehicles, equipment)
   ========================================================================== */

export type ResourceKind =
  | 'vessel'
  | 'vehicle'
  | 'equipment'
  | 'table'
  | 'room'
  | 'guide'

export interface Resource {
  id: string
  tenantId: string
  name: string
  kind: ResourceKind
  capacity: number
  /** Units available of this resource type. */
  quantity: number
  status: 'available' | 'maintenance' | 'retired'
  location?: string
  notes?: string
  /** Photo of the vessel, vehicle or kit — an absolute URL or an object URL. */
  imageUrl?: string
}

/* ==========================================================================
   CUSTOMERS
   ========================================================================== */

export interface Customer {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  avatarUrl?: string
  createdAt: string
  totalBookings: number
  /** Minor units, lifetime. */
  lifetimeValue: number
  lastBookingAt: string | null
  tags: string[]
  marketingOptIn: boolean
  notes?: string
  /** Repeat guests are a headline retention metric. */
  segment: 'new' | 'returning' | 'vip' | 'lapsed'
}

/* ==========================================================================
   BOOKINGS
   ========================================================================== */

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'refunded'

export type PaymentStatus =
  | 'unpaid'
  | 'deposit_paid'
  | 'paid'
  | 'partially_refunded'
  | 'refunded'
  | 'failed'

export type BookingChannel =
  | 'direct'
  | 'website_widget'
  | 'phone'
  | 'walk_in'
  | 'ota'
  | 'reseller'
  | 'concierge'
  | 'google'

export interface BookingLineItem {
  id: string
  /** Matches a PriceTier.label or AddOn.label. */
  label: string
  kind: 'ticket' | 'addon' | 'fee' | 'discount' | 'tax'
  quantity: number
  /** Minor units, per unit. */
  unitPrice: number
  /** Minor units, quantity * unitPrice (negative for discounts). */
  total: number
}

export interface Participant {
  id: string
  firstName: string
  lastName: string
  age?: number
  /** Free-form waiver / dietary / medical notes. */
  notes?: string
  waiverSigned: boolean
  tierLabel: string
}

export interface Booking {
  id: string
  tenantId: string
  /** Human-facing confirmation code, e.g. "EZR-8KQ2M". */
  reference: string
  activityId: string
  departureId: string
  customerId: string
  status: BookingStatus
  paymentStatus: PaymentStatus
  channel: BookingChannel
  /** Denormalised for fast list rendering. */
  partySize: number
  lineItems: BookingLineItem[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  feeTotal: number
  total: number
  amountPaid: number
  currency: CurrencyCode
  participants: Participant[]
  createdAt: string
  updatedAt: string
  /** ISO datetime of the departure, denormalised for sorting. */
  departureAt: string
  notes?: string
  internalNotes?: string
  source?: string
  promoCode?: string
  /** Set when status === 'cancelled'. */
  cancelledAt?: string
  cancellationReason?: string
  refundAmount?: number
  rating?: number
  reviewText?: string
}

/* ==========================================================================
   PAYMENTS
   ========================================================================== */

export interface Payment {
  id: string
  tenantId: string
  bookingId: string
  amount: number
  currency: CurrencyCode
  method: 'card' | 'apple_pay' | 'google_pay' | 'cash' | 'bank_transfer' | 'gift_card'
  status: 'succeeded' | 'pending' | 'failed' | 'refunded'
  processorFee: number
  netAmount: number
  createdAt: string
  last4?: string
  brand?: string
}

/* ==========================================================================
   ANALYTICS
   ========================================================================== */

export type TrendDirection = 'up' | 'down' | 'flat'

export interface KpiMetric {
  key: string
  label: string
  value: number
  /** Formatting hint for the UI. */
  format: 'currency' | 'number' | 'percent' | 'rating' | 'duration'
  /** Percent change vs the comparison period. */
  deltaPercent: number
  direction: TrendDirection
  /** Whether an increase is good. Drives colour semantics. */
  higherIsBetter: boolean
  comparisonLabel: string
  /** Small inline trend series. */
  sparkline: number[]
  currency?: CurrencyCode
  hint?: string
}

export interface TimeSeriesPoint {
  /** ISO date, "YYYY-MM-DD". */
  date: string
  revenue: number
  bookings: number
  guests: number
  /** Percent of capacity sold, 0-100. */
  occupancy: number
  /** Prior-period comparison value for revenue. */
  prevRevenue: number
  cancellations: number
  avgOrderValue: number
}

export interface ChannelBreakdown {
  channel: BookingChannel
  label: string
  bookings: number
  revenue: number
  share: number
  deltaPercent: number
}

export interface ActivityPerformance {
  activityId: string
  name: string
  bookings: number
  revenue: number
  occupancy: number
  rating: number
  deltaPercent: number
  colorKey: Activity['colorKey']
}

export interface FunnelStage {
  key: string
  label: string
  value: number
  /** Conversion from the previous stage, 0-100. */
  conversionRate: number
}

/** One cell of the occupancy heatmap: weekday x hour. */
export interface HeatmapCell {
  /** 0=Mon … 6=Sun to match the calendar. */
  weekday: number
  hour: number
  /** 0-100 */
  occupancy: number
  bookings: number
  revenue: number
}

export interface GeoSource {
  country: string
  countryCode: string
  bookings: number
  revenue: number
  share: number
}

export interface CohortRow {
  cohort: string
  size: number
  /** Retention percent by month offset, index 0 = month 0. */
  retention: number[]
}

/** What did not travel in the range, and what it cost. */
export interface LossBreakdown {
  /** Every booking departing in the range, whatever its status. */
  total: number
  cancelled: number
  noShows: number
  /** Bookings with any money returned. */
  refunded: number
  /** Minor units returned to guests. */
  refundAmount: number
  /** Minor units of booked value that never materialised, after fees kept. */
  lostRevenue: number
  /** Minor units retained from cancellations under policy. */
  feesKept: number
  /** Percent of all bookings. */
  cancellationRate: number
  /** Percent of bookings expected to travel. */
  noShowRate: number
  /** Points of change against the comparison period. */
  cancellationRateDelta: number
  noShowRateDelta: number
  /** Cancellations inside 24 hours of departure. */
  lateCancellations: number
  reasons: { reason: string; count: number }[]
  byChannel: { channel: BookingChannel; label: string; rate: number; count: number }[]
}

export interface AnalyticsSnapshot {
  tenantId: string
  rangeLabel: string
  kpis: KpiMetric[]
  timeseries: TimeSeriesPoint[]
  channels: ChannelBreakdown[]
  topActivities: ActivityPerformance[]
  funnel: FunnelStage[]
  heatmap: HeatmapCell[]
  geo: GeoSource[]
  cohorts: CohortRow[]
  /** Leading-indicator callouts surfaced as "insights". */
  insights: Insight[]
  losses: LossBreakdown
}

/**
 * The one number an insight is really about, pulled out of the prose so the
 * panel can lead with it.
 */
export interface InsightImpact {
  /** Pre-formatted headline figure, e.g. "$5.4K" or "96%". */
  value: string
  /** Unit that trails the figure at smaller size, e.g. "/mo" or "of capacity". */
  unit?: string
  /** What the figure means, e.g. "recoverable a month". */
  caption: string
  /** Tints the figure. Omit where the number is neither good nor bad. */
  direction?: TrendDirection
}

/**
 * A small chart the insight row draws instead of describing in words.
 * Every variant is normalised to percentages so the panel needs no scale logic.
 */
export type InsightVisual =
  /** Two slots, products or channels side by side — the gap IS the point. */
  | {
      kind: 'comparison'
      a: { label: string; value: number }
      b: { label: string; value: number }
      /** Appended to both values, e.g. "%". */
      unit?: string
    }
  /** A single fill against capacity, with an optional target marker. */
  | {
      kind: 'meter'
      label: string
      /** 0-100. */
      value: number
      /** 0-100. Draws a tick where the value ought to sit. */
      target?: number
      unit?: string
    }
  /** One slice of a whole, with the runner-up for context. */
  | {
      kind: 'share'
      label: string
      /** 0-100. */
      value: number
      runnerUp?: { label: string; value: number }
    }
  /** Movement between two readings of the same measure. */
  | {
      kind: 'trend'
      label: string
      from: number
      to: number
      unit?: string
      /** Whether a rise is good. Drives the colour. */
      higherIsBetter?: boolean
    }

export interface Insight {
  id: string
  severity: 'positive' | 'neutral' | 'warning' | 'critical'
  title: string
  body: string
  metric?: string
  /** Headline figure, surfaced above the prose. */
  impact?: InsightImpact
  /** Rendered as a small inline chart in place of describing the numbers. */
  visual?: InsightVisual
  /** Optional deep link into the dashboard. */
  href?: string
  actionLabel?: string
}

/* ==========================================================================
   OPERATIONS
   ========================================================================== */

export interface ManifestEntry {
  departure: Departure
  activity: Activity
  bookings: Booking[]
  customers: Customer[]
  staff: User[]
  /** Derived: booked / capacity as a percent. */
  fillRate: number
}

export interface NotificationItem {
  id: string
  tenantId: string
  kind: 'booking' | 'cancellation' | 'payment' | 'review' | 'system' | 'capacity'
  title: string
  body: string
  createdAt: string
  read: boolean
  href?: string
  severity: 'info' | 'success' | 'warning' | 'danger'
}

export interface ActivityFeedItem {
  id: string
  tenantId: string
  actor: string
  actorAvatar?: string
  verb: string
  target: string
  createdAt: string
  kind: NotificationItem['kind']
  amount?: number
  currency?: CurrencyCode
}

/* ==========================================================================
   MARKETING / PUBLIC SITE
   ========================================================================== */

export interface PricingPlan {
  id: PlanTier
  name: string
  /** Per-booking commission percent, the model most booking platforms use. */
  commissionPercent: number
  /** Optional monthly platform fee in minor units; 0 = commission only. */
  monthlyPrice: number
  annualPrice: number
  blurb: string
  highlights: string[]
  features: { label: string; included: boolean; hint?: string }[]
  cta: string
  popular: boolean
  badge?: string
}

export interface Testimonial {
  id: string
  quote: string
  author: string
  role: string
  company: string
  avatarUrl: string
  vertical: VerticalKey
  /** Headline metric the operator achieved. */
  metric?: { value: string; label: string }
  rating: number
}

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: 'pricing' | 'product' | 'migration' | 'payments' | 'support'
}

export interface FeatureBlock {
  /** One short line, for the compact cards on solutions pages. */
  line: string
  id: string
  eyebrow: string
  title: string
  description: string
  icon: string
  bullets: string[]
  accent: 'lagoon' | 'coral' | 'sunset' | 'reef'
}

export interface Integration {
  id: string
  name: string
  category: 'payments' | 'ota' | 'marketing' | 'ops' | 'accounting' | 'comms'
  description: string
  /** Short mark used in the logo grid. */
  mark: string
}

/* ==========================================================================
   SESSION
   ========================================================================== */

export interface Session {
  user: User
  tenant: Tenant
  /** All tenants the user can switch between. */
  availableTenants: Pick<Tenant, 'id' | 'slug' | 'name' | 'vertical' | 'plan'>[]
}

/* ==========================================================================
   UI HELPERS
   ========================================================================== */

export type CalendarView = 'month' | 'week' | 'day' | 'agenda' | 'timeline'

export interface DateRange {
  from: string
  to: string
}

export type RangePreset =
  | 'today'
  | '7d'
  | '30d'
  | '90d'
  | 'mtd'
  | 'qtd'
  | 'ytd'
  | 'custom'
