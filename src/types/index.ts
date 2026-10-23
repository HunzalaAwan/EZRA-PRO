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
  /**
   * The most sold on a weekday (0=Sun … 6=Sat) across every departure that
   * day. Optional: a weekday without a number has no daily limit.
   */
  dayCapacity?: Record<number, number>
  /** What the daily limit counts: tickets (guests or units) or bookings. */
  dayLimitUnit?: 'tickets' | 'bookings'
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
  /** Places one ticket takes: 2 for a tandem or a couple, 4 for a family ticket. Absent: 1. */
  seats?: number
  /** Optional age range shown with the name: "Child · 4–12". */
  ageMin?: number
  ageMax?: number
}

/* ---------- pricing: how an activity charges and how its prices change ---------- */

/** How the price is counted. Absent: worked out from the kind (per person, a charter per group, a rental per item). */
export type ChargeBy = 'person' | 'group' | 'item' | 'duration'

/** Per group: one price for the group. Guests in extra spots each add the extra-spot price (`Activity.extraSpots`). */
export interface GroupPrice {
  /** Minor units: the whole group, in the usual spots. */
  price: number
  /** Saves from before extra spots only: the guests the price covered. Read as the spots (see `@/lib/extra-spots`). */
  includedGuests?: number
  /** Saves from before extra spots only: each guest over that, minor units. Read as the extra-spot price. */
  extraGuest?: number
  /** Saves from before extra spots only: what it covered plus the extra guests allowed. */
  maxGuests?: number
  /** Optional, shown to guests next to the group price: "Up to 6 guests, gear included". */
  note?: string
}

/**
 * Extra spots: sold once a time slot's usual spots are full (a private group:
 * guests over its most guests), each at its own price. Both set, or none are
 * sold and nothing extra is charged.
 */
export interface ExtraSpots {
  /** How many. 0: none. */
  count: number
  /** Each one, minor units. */
  price: number
}

/** "From 6 guests, 10% off": the best rung the booking reaches applies to its tickets. */
export interface GroupDiscount {
  fromGuests: number
  percentOff: number
}

export type PriceChangeKind = 'season' | 'weekdays' | 'time_of_day' | 'dates' | 'early_bird' | 'last_minute' | 'filling_up' | 'slow_time'

/** One of the activity's own price changes, read as a sentence in the editor. */
export interface PriceChange {
  id: string
  /** Optional name: "Summer", "Christmas week". */
  name?: string
  kind: PriceChangeKind
  /** season: day keys (YYYY-MM-DD), inclusive. */
  from?: string
  to?: string
  /** weekdays: 0=Sun … 6=Sat. */
  weekdays?: number[]
  /** time_of_day: the start times it applies to (HH:MM). */
  times?: string[]
  /** dates: day keys. */
  dates?: string[]
  /** early_bird: booked at least this many days ahead. */
  daysAhead?: number
  /** last_minute / slow_time: within this many hours of the start. */
  hoursBefore?: number
  /** filling_up: at least this % booked. slow_time: under this % booked. */
  soldPercent?: number
  /** percent: +/- (−10 = 10% off). amount: +/- minor units per ticket. set: this price (minor units). */
  effect: { type: 'percent' | 'amount' | 'set'; value: number }
  /** Only these price tiers. Empty or absent: all of them. */
  tierIds?: string[]
  active: boolean
}

/* ---------- scheduling: seasons, changes and the booking window ---------- */

/** Weekday keys for schedules: '0' = Sunday … '6' = Saturday. */
export type WeekdayKey = '0' | '1' | '2' | '3' | '4' | '5' | '6'

/** One season (or the whole year) of an activity's schedule. Later seasons win where they overlap. */
export interface ActivitySchedule {
  id: string
  /** "All year", "Summer", "Winter". */
  name: string
  /** Day key it starts on. null: from today. */
  from: string | null
  /** Day key it ends on (inclusive). null: no end date. */
  to: string | null
  /** times: set start times. hours: opening hours, a start time every `every` minutes. */
  mode: 'times' | 'hours'
  /** times: the start times on each weekday (HH:MM). An empty list: closed that day. */
  days: Record<WeekdayKey, string[]>
  /** hours: open and close on each weekday. null: closed that day. */
  hours?: Record<WeekdayKey, { open: string; close: string } | null>
  /** hours: minutes between start times. */
  every?: number
  /** Spots per time slot in this season. Absent: the activity's own number. */
  capacity?: number
  /** For activities that run from more than one location. Absent: every location / the only one. */
  locationId?: string
}

/** A change to the schedule on given days: closed, different times, an extra time, or different spots. */
export interface ScheduleChange {
  id: string
  /** Day keys (YYYY-MM-DD) it applies to. */
  dates: string[]
  /** closed: no time slots. times: these times instead. add: these times as well. spots: this many spots. */
  action: 'closed' | 'times' | 'add' | 'spots'
  /** times / add: start times. closed with times: only those times close (absent: the whole day). */
  times?: string[]
  spots?: number
  /** "Public holiday", "Boat maintenance". */
  reason?: string
  locationId?: string
}

/** A business-wide closed day (Settings / Availability). */
export interface BusinessClosure {
  id: string
  dates: string[]
  reason: string
}

/** Book a whole time for one group: a private tour, a private lesson. */
export interface PrivateOption {
  enabled: boolean
  /** The price for the group, minor units. */
  price: number
  /** Guests the price covers. */
  includedGuests: number
  /** Each guest above that, minor units. 0: the group cannot be bigger. */
  extraGuest: number
}

export interface AddOn {
  id: string
  label: string
  price: number
  description: string
  /** Charged once for each guest, or once for the whole booking. Absent: per guest. */
  per?: 'guest' | 'booking'
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
  /** Which standard policy this is; custom when the numbers are the business's own. */
  preset?: 'flexible' | 'moderate' | 'strict' | 'none' | 'custom'
  /** With a deposit: the deposit is never refunded, even inside the free window. */
  keepDeposit?: boolean
  /** Follows the business default in Settings → Booking flow instead of numbers of its own. */
  useDefault?: boolean
}

/** How guests pay: all now, part now and the rest before the day, or on the day. */
export interface PaymentTerms {
  collect: 'full' | 'deposit' | 'later'
  /** A percent of the total, or a set amount per guest or per booking. */
  depositType: 'percent' | 'per_guest' | 'per_booking'
  /** Percent, or minor units for the set amounts. */
  depositValue: number
  /** The rest is charged this many days before the start, to the saved card. 0: on the day. */
  balanceDueDays: number
  /** Guests can pay everything now instead. */
  allowPayInFull: boolean
  /** Follows the business default in Settings → Booking flow instead of terms of its own. */
  useDefault?: boolean
}

/** What guests can change themselves from their booking page. */
export interface ChangeRules {
  /** Guests can move to another time. */
  reschedule: boolean
  /** Until this many hours before the start. */
  rescheduleHours: number
  /** How many times one booking can be moved. 0: no limit. */
  maxReschedules: number
  /** Charged per move, minor units. 0: free. */
  rescheduleFee: number
  /** Guests can add people while there is room. */
  addGuests: boolean
  /** Guests can cancel online; off, they call or message the business. */
  cancelOnline: boolean
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

/** A detail asked of every guest when an activity collects guest details. */
export type GuestFieldKey = 'name' | 'email' | 'phone' | 'dateOfBirth' | 'country'

/**
 * Whether checkout asks for each guest in the booking, and what. Off: only
 * the person booking gives their details. On: every guest fills a card with
 * these fields plus the activity's per-guest questions.
 */
export interface GuestDetailsConfig {
  enabled: boolean
  fields: { key: GuestFieldKey; required: boolean }[]
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
/**
 * How guests book an activity. Instant: pick a time and pay. Request: send
 * the time and group they want; the business confirms with a payment link.
 * Call: nothing is sold online; the listing shows a number and a message form.
 */
export interface BookingSettings {
  method: 'instant' | 'request'
  /** False: no set schedule, every booking is arranged with the guest (request and call only). */
  scheduled: boolean
  /** Instant booking: groups bigger than this send a request instead. 0: off. */
  groupLimit: number
  /** Rentals: the limit counts what is rented (bikes, boats) or the people using it. Absent: what is rented. Other kinds count people. */
  groupCountBy?: 'units' | 'people'
  /** Guests can ask for a day or time that is not on the schedule. */
  otherDates: boolean
  /** Guests can ask for a custom quote: a private version, a special occasion. */
  customQuote: boolean
  /** Shown to call. Empty: the business number. */
  phone: string
  /** "Mon–Sat, 8am–6pm". Optional. */
  callHours: string
  /** How soon the business replies to a request, in hours. */
  replyHours: number
}

/** Why a guest sent a request. */
export type RequestReason = 'booking' | 'group' | 'date' | 'sooner' | 'quote' | 'message'

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
  /** Why the guest asked. */
  reason?: RequestReason
  /** A preferred time of day when no exact time was picked: "Morning". */
  when?: string
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
 * zipline, a flight), a private charter, a rental, a lesson, a pass, or a
 * package of the business's own activities sold together.
 */
export type ActivityKind = 'trip' | 'activity' | 'charter' | 'rental' | 'lesson' | 'pass' | 'package'

/** One activity inside a package, and the start times guests can pick for it. */
export interface PackagePart {
  activityId: string
  /** "HH:mm" times guests can pick. Empty: any time it runs. */
  times: string[]
  /** What guests see instead of the activity's name: "Beach ride". */
  label?: string
  /** Where this part runs, when the activity runs from more than one place. Absent: anywhere it runs. */
  locationId?: string
}

/**
 * A package: two or more activities sold as one booking. Guests pick a time
 * for each part; every part takes its seats from that activity's own time,
 * so the activity on its own can never be oversold.
 */
export interface PackageConfig {
  parts: PackagePart[]
  /** Least minutes between one part ending and the next starting: travel, changing, lunch. */
  gapMinutes: number
  /** Every part on the same day. Off: guests spread the parts over `withinDays` days. */
  sameDay: boolean
  withinDays: number
}

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
export type RentalCategory = 'watercraft' | 'vehicle' | 'bike' | 'gear' | 'space'

/**
 * One kind of thing a rental lends out — "Single kayak", "Double kayak",
 * "Large locker" — with its own stock, size and deposit. Its name, photo
 * line and prices live on the price tier with the same id.
 */
export interface RentalItem {
  tierId: string
  /** How many of it the business owns. */
  stock: number
  /** How many people one fits. */
  holds: number
  /** Refundable deposit held per item at pick-up, minor units. 0 = none. */
  deposit: number
  /** Not rentable right now: in repair, being cleaned, lost. */
  outOfService?: number
  /** The most one of it costs for a whole rental, however long, minor units. Hourly and daily prices stop here. */
  cap?: number
  /** Why some are out of service. */
  serviceNote?: string
}

/** A length sold at one price. */
export interface RentalLength {
  id: string
  /** What guests see: "Up to 4 hours", "Half day". */
  label: string
  /** How long it can be out. */
  hours: number
}

export interface RentalConfig {
  /**
   * The things guests choose from under one booking link, each counted
   * separately. When absent, every price tier shares `units`.
   */
  items?: RentalItem[]
  /** Charged per hour a rental comes back late, minor units. 0 = none. */
  lateFee?: number
  /** Watercraft, vehicle, bike or gear. Defaults to gear. */
  category?: RentalCategory
  /**
   * How it is sold: by the hour, by the day, or both. When set, each price
   * tier is something to rent (a model or type) with its own rates.
   */
  modes?: ('hour' | 'day' | 'length')[]
  /**
   * Set lengths sold at a set price, whatever the hours inside them:
   * "Up to 4 hours", "Up to 8 hours", "Full day". Used with the length mode.
   */
  lengths?: RentalLength[]
  /** Hourly rentals: the fewest and most hours one booking can run. */
  minHours?: number
  maxHours?: number
  /** What each tier costs per hour and per day, minor units. */
  rates?: { tierId: string; hour?: number; day?: number; /** Price per length id. */ lengths?: Record<string, number> }[]
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
  /** Most guests one charter carries, before any extra spots (`Activity.extraSpots`). */
  maxGuests: number
  /** Saves from before extra spots only: the guests the price covered. Read as the most guests (see `@/lib/extra-spots`). */
  includedGuests?: number
  /** Saves from before extra spots only: each guest above that, minor units. Read as the extra-spot price. */
  extraGuestPrice?: number
  /** Saves from before extra spots only: guests allowed over `includedGuests`. Absent: up to `maxGuests`. */
  maxExtraGuests?: number
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
  /** Packages: the activities inside it. */
  package?: PackageConfig
  ride?: RideConfig
  /** Distance or track, when the trip or activity has one. */
  route?: RouteInfo
  /** Asked at checkout; answers show on the booking, the manifest and the gear list. */
  guestQuestions?: GuestQuestion[]
  /** The waiver every guest signs at checkout. */
  waiverId?: string
  /** Who signs the waiver: the booker for everyone, or each guest. Defaults to the booker. */
  waiverSigning?: 'booker' | 'each'
  /** Details asked of each guest at checkout. Absent: worked out from the questions. */
  guestDetails?: GuestDetailsConfig
  /** Hotel pickup: the zones served, and whether it is the only way to join. */
  pickup?: ActivityPickup
  /** Languages the guide or instructor speaks. */
  languages?: string[]
  /** Guests can ask for a custom quote from the activity page and at checkout. */
  customRequests?: boolean
  /**
   * The most one booking pays for its tickets or items, minor units: a family
   * of six never pays more than the cap. Add-ons are charged on top.
   */
  priceCap?: number
  /** Bookings close this many hours before the start. 0 or absent: book until it starts. */
  noticeHours?: number
  /** How the price is counted. Absent: from the kind. */
  chargeBy?: ChargeBy
  /** chargeBy 'group': the group price. */
  groupPrice?: GroupPrice
  /** Group-size discounts on per-person tickets. */
  groupDiscounts?: GroupDiscount[]
  /** A booking pays at least this for its tickets, minor units. */
  minimumCharge?: number
  /** The activity's own price changes: seasons, weekends, times of day, dates, book early, last minute, filling up, quiet times. */
  priceChanges?: PriceChange[]
  /** Seasons of the schedule. Absent: one all-year schedule worked out from `locations`. */
  schedules?: ActivitySchedule[]
  /** Closed days, different times, extra times and spot changes on given days. */
  scheduleChanges?: ScheduleChange[]
  /** How far ahead guests can book. Absent: the business default (Settings → Booking flow). */
  bookingWindow?: { monthsAhead: number }
  /** Runs even on the business's closed days and public holidays. */
  runsOnClosures?: boolean
  /** How guests book. Absent: instant booking. */
  booking?: Partial<BookingSettings>
  /** Checkout offers a tip for the crew: 5–25% or an amount of the guest's own. */
  tips?: boolean
  /** The storefront category; guessed from the activity when absent. */
  theme?: ActivityTheme
  /** A category the business made itself; shown instead of the theme when set. */
  customCategory?: string
  /** Accessibility and suitability facts on older activities; new ones list them in Requirements. */
  accessibility?: string[]
  /** What guests should bring; a sensible list is shown when empty. */
  bring?: string[]
  /** A note added to this activity's confirmation and reminder: parking, what to wear, where to check in. */
  guestNote?: string
  difficulty: DifficultyLevel
  /** Minutes. */
  durationMinutes: number
  minAge: number
  /** Spots per time slot (a private group: its most guests), before any extra spots. */
  maxCapacity: number
  /**
   * Spots on some weekdays instead of `maxCapacity` ('0' = Sunday … '6' =
   * Saturday), each at least 1: "10 spots, 20 on Saturdays and Sundays". A day
   * left out has the usual number. A date's own spots (a 'spots' change) win.
   * Shared activities, lessons and passes only. Absent: the same every day.
   */
  spotsByWeekday?: Partial<Record<WeekdayKey, number>>
  /** Extra spots, sold once the usual spots are full, each at its own price. Absent: none. */
  extraSpots?: ExtraSpots
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
  /** How guests pay. Absent: in full at checkout. */
  payment?: Partial<PaymentTerms>
  /** Trips, activities and lessons: guests can book a whole time for their group. */
  privateOption?: PrivateOption
  /** What guests can change themselves. Absent: the standard rules. */
  changes?: Partial<ChangeRules>
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
  /** The price tier it was for; rentals count stock per item with it. */
  tierId?: string
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
