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
  | 'hotels'

/** The verticals the marketing site has a solutions page for. Hotels sell through the restaurants page. */
export type MarketingVerticalKey = Exclude<VerticalKey, 'hotels'>

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

/* ==========================================================================
   LOCATIONS (the places a business runs from)
   ========================================================================== */

export interface Location {
  id: string
  tenantId: string
  /** URL-safe and unique within the business, e.g. "lahaina". */
  slug: string
  name: string
  addressLine: string
  city: string
  /** IANA zone; the business timezone applies when omitted. */
  timezone?: string
  phone?: string
  /** Shown to guests under the address: parking, the check-in desk, what to look for. */
  notes?: string
  /** Where activities run from unless they say otherwise. */
  isDefault: boolean
  status: 'active' | 'paused'
}

/** One place an activity runs from, with the times it runs there. */
export interface ActivityLocation {
  locationId: string
  /** "HH:mm" start times (or arrival slots) at this place; empty means the activity's usual times. */
  times: string[]
  /** JS weekday numbers (0=Sun … 6=Sat); omit to run on the activity's usual days. */
  weekdays?: number[]
  /** Where to meet at this place; the activity's own meeting point applies when omitted. */
  meetingPoint?: string
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

/**
 * How an experience runs: as group departures at set times (a boat, a
 * tour), as open entry where guests arrive any time within the hours and
 * capacity is per arrival slot (a park, a rental, a spa), or only on the
 * fixed dates listed (an event, a workshop).
 */
export type ActivityFormat = 'departures' | 'open' | 'dates'

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

/* ==========================================================================
   GUEST REQUIREMENTS (questions, waivers)
   ========================================================================== */

export type GuestQuestionKind = 'text' | 'number' | 'choice' | 'yesno' | 'size' | 'date'

/** Something an activity needs to know from each guest, or once per booking. */
export interface GuestQuestion {
  id: string
  label: string
  kind: GuestQuestionKind
  scope: 'guest' | 'booking'
  required: boolean
  /** For choice and size. */
  options?: string[]
  unit?: string
  min?: number
  max?: number
  /** Answers outside this list stop the booking (a licence, a certification). */
  allowed?: string[]
  /** Shown when an answer falls outside min/max or allowed. */
  limitMessage?: string
  help?: string
  /** Counted on the gear prep list. */
  gear?: boolean
  /** Text answers on one line: a licence or passport number. */
  short?: boolean
  /** Library preset this came from. */
  preset?: string
}

export interface WaiverTemplate {
  id: string
  tenantId: string
  title: string
  /** Plain text, paragraphs split by blank lines. */
  body: string
  version: number
  minorsNeedGuardian: boolean
  /** Guests under this age are minors. */
  minorAge: number
  updatedAt: string
}

/* ==========================================================================
   PICKUP ZONES and CHARTER REQUESTS
   ========================================================================== */

/** An area the shuttle collects guests from, with its own lead time and fee. */
export interface PickupZone {
  id: string
  tenantId: string
  name: string
  /** The location whose activities it serves; any when omitted. */
  locationId?: string
  /** Hotels and stops in the zone, shown to guests. */
  stops: string[]
  /** Minutes before the start time the shuttle collects. */
  offsetMinutes: number
  /** Per guest, minor units. 0 = included. */
  fee: number
  /** How the fee is counted. Guest unless an activity says per booking. */
  feePer?: 'guest' | 'booking'
  active: boolean
}

/** What pickup from one zone costs on one activity. fee 0 = free. */
export interface PickupPrice {
  fee: number
  per: 'guest' | 'booking'
}

export interface ActivityPickup {
  zoneIds: string[]
  /** Every guest is collected; there is no meet-there option. */
  required: boolean
  /** Price per zone for this activity; a zone without one uses its own fee per guest. */
  prices?: Record<string, PickupPrice>
}

export type CharterRequestStatus = 'new' | 'quoted' | 'paid' | 'declined'

/** A private charter enquiry from the storefront, and the quote that answers it. */
export interface CharterRequest {
  id: string
  tenantId: string
  activitySlug: string
  departureId?: string
  startsAt: string
  tierId?: string
  party: number
  name: string
  email: string
  message: string
  createdAt: string
  status: CharterRequestStatus
  /** A request a guest sent, or an invoice the business made for anyone. */
  source?: 'request' | 'invoice'
  phone?: string
  /** Invoices: "INV-1004". */
  number?: string
  /** Invoices: what is charged, line by line. Unit prices in minor units. */
  lines?: { label: string; qty: number; unit: number }[]
  quote?: {
    /** Minor units, for the whole charter. */
    amount: number
    depositPercent: number
    note: string
    validUntil: string
    sentAt: string
  }
  paidAt?: string
}

/**
 * What is being sold: seats on a trip, a slot on an activity (a ride, a
 * zipline, a flight), a private charter, a rental, a lesson or a pass.
 */
export type ActivityKind = 'trip' | 'activity' | 'charter' | 'rental' | 'lesson' | 'pass'

/** What the experience is about, as guests search for it. */
export type ActivityTheme =
  | 'water'
  | 'boat'
  | 'wildlife'
  | 'sightseeing'
  | 'food'
  | 'adventure'
  | 'cycling'
  | 'offroad'
  | 'air'
  | 'horse'
  | 'snow'
  | 'attractions'
  | 'transfers'

/** Activities: guests book a time slot, no departure. Limits are checked per rider. */
export interface RideConfig {
  /** Riders shorter than this cannot ride. 0 or absent = no limit. */
  minHeightCm?: number
  /** Riders heavier than this cannot ride. 0 or absent = no limit. */
  maxWeightKg?: number
}

/** The distance or track a trip or activity covers. Optional. */
export interface RouteInfo {
  distance: number
  unit: 'km' | 'mi'
  /** "Kaanapali coast to Black Rock", "Red trail loop". */
  track?: string
  /** Metres climbed, for hikes and rides. */
  elevationM?: number
}

/** What is rented: decides the requirements a rental asks for. */
export type RentalCategory = 'watercraft' | 'vehicle' | 'bike' | 'gear'

export interface RentalConfig {
  /** Watercraft, vehicle, bike or gear. Defaults to gear. */
  category?: RentalCategory
  /**
   * How it is sold: by the hour, by the day, or both. When set, each price
   * tier is something to rent (a model or type) with its own rates.
   */
  modes?: ('hour' | 'day')[]
  /** Hourly rentals: the fewest and most hours one booking can run. */
  minHours?: number
  maxHours?: number
  /** What each tier costs per hour and per day, minor units. */
  rates?: { tierId: string; hour?: number; day?: number }[]
  /**
   * How it is charged. length: each price tier is a length (1 hour, half day).
   * day: guests pick a pick-up day and how many days; each tier is a model priced per day.
   */
  billing?: 'length' | 'day'
  /** Day rentals: the fewest and most days one booking can run. */
  minDays?: number
  maxDays?: number
  /** Day rentals: "HH:mm" pick-up and return times. */
  pickupTime?: string
  returnTime?: string
  /** People one unit carries (two riders on a jet ski, five seats in a car). */
  seatsPerUnit?: number
  /** Licence the renter shows at pick-up. */
  licence?: 'none' | 'driver' | 'boat'
  /** Watercraft and vehicles. */
  fuel?: 'included' | 'full_to_full' | 'charged'
  /** Vehicles: kilometres included per day; 0 or absent = unlimited. */
  kmPerDay?: number
  /** Units available at once (jet skis, kayaks, bikes). Each departure sells up to this many. */
  units: number
  /** Minutes between rentals for cleaning, fuel or a hand-over. */
  bufferMinutes: number
  /** Refundable hold per unit, minor units. 0 = none. */
  damageDeposit: number
  /** Each price tier is a rental length. */
  durations: { tierId: string; minutes: number }[]
}

export interface CharterConfig {
  /** What is chartered; 'other' uses vesselLabel. */
  vessel?: 'boat' | 'yacht' | 'vehicle' | 'guide' | 'aircraft' | 'other'
  /** The business's own name for it: "Glass-bottom boat", "Vintage bus". */
  vesselLabel?: string
  /** Who comes with it, for a custom vessel: "Skipper", "Driver and host". */
  crewLabel?: string
  /** A captain, driver or guide comes with it. False is a bare-boat or self-drive hire. */
  crewed?: boolean
  /** Each price tier is a charter option; this is how long each one runs. */
  durations?: { tierId: string; minutes: number }[]
  /** Most guests one charter carries. */
  maxGuests: number
  /** Guests send a request and get a quote instead of paying on the spot. */
  requestToBook: boolean
  /** Hours of notice needed before a charter can start. */
  noticeHours: number
}

export interface LessonConfig {
  level: 'all' | 'beginner' | 'intermediate' | 'advanced'
  /** Sessions in the course; 1 for a single lesson. Sessions run on consecutive days. */
  sessions: number
  /** Students per instructor. */
  ratio: number
  /** Certificate the course leads to, if any. */
  certification?: string
  /** Board, wetsuit or gear is part of the price. */
  equipmentIncluded?: boolean
}

export interface PassConfig {
  /** Days the ticket is valid from the chosen date. */
  validDays: number
  /** Guests can leave and come back on the same day. */
  reentry: boolean
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
  /** Where it runs from, with the times at each place. A single-site business has one entry. */
  locations: ActivityLocation[]
  category: VerticalKey
  status: ActivityStatus
  /** Group departures, open entry or fixed dates. */
  format: ActivityFormat
  /** What is being sold; decides the setup fields and the storefront widget. */
  kind: ActivityKind
  rental?: RentalConfig
  charter?: CharterConfig
  lesson?: LessonConfig
  pass?: PassConfig
  ride?: RideConfig
  /** Distance or track, when the trip or activity has one. */
  route?: RouteInfo
  /** Asked at checkout; answers show on the booking, the manifest and the gear list. */
  guestQuestions?: GuestQuestion[]
  /** The waiver every guest signs at checkout. */
  waiverId?: string
  /** Hotel pickup: the zones served, and whether it is the only way to join. */
  pickup?: ActivityPickup
  /** Languages the guide or instructor speaks. */
  languages?: string[]
  /** The storefront category; guessed from the activity when absent. */
  theme?: ActivityTheme
  /** A category the business made itself; shown instead of the theme when set. */
  customCategory?: string
  /** Accessibility and suitability facts, from ACCESSIBILITY_OPTIONS. */
  accessibility?: string[]
  /** What guests should bring; a sensible list is shown when empty. */
  bring?: string[]
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
  /** The place this run leaves from; undefined means the business's default location. */
  locationId?: string
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
  /** Answers to the activity's guest questions, keyed by question id. */
  answers?: Record<string, string>
}

export interface Booking {
  id: string
  tenantId: string
  /** Human-facing confirmation code, e.g. "EZR-8KQ2M". */
  reference: string
  activityId: string
  /** Answers to booking-level guest questions, keyed by question id. */
  answers?: Record<string, string>
  /** Where the shuttle collects the party. */
  pickup?: { zoneId: string; stop: string; time: string }
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
