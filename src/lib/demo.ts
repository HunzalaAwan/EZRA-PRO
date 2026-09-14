/**
 * EZRA PRO — THE DEMO DATA SEAM
 * =============================================================================
 * Every app screen (operator dashboard + public storefront) reads its data from
 * this module and nothing else. It is:
 *
 *   • SELF-CONTAINED — imports only from '@/types' and '@/lib/utils'
 *   • DETERMINISTIC  — seeded RNG only; no Math.random, no Date.now, no argless
 *                      `new Date()`. Server and client render byte-identical output.
 *   • RECONCILED     — bookings sum to departure.booked, analytics are COMPUTED
 *                      from the generated bookings, KPI deltas are real.
 *   • FAST           — generated once at module scope, every lookup is a Map hit.
 *
 * All datetimes are LOCAL ISO strings ("YYYY-MM-DDTHH:mm:ss", no Z) so that
 * `new Date(iso)` and `toDateKey()` agree on both sides of the render boundary.
 * All money is minor units (cents) — format with formatCurrency().
 * =============================================================================
 */


import type {
  Activity,
  ActivityFeedItem,
  ActivityMedia,
  ActivityPerformance,
  ActivityStatus,
  AddOn,
  AnalyticsSnapshot,
  Booking,
  BookingChannel,
  BookingLineItem,
  BookingStatus,
  ChannelBreakdown,
  CohortRow,
  CurrencyCode,
  Customer,
  Departure,
  DepartureStatus,
  DifficultyLevel,
  FunnelStage,
  GeoSource,
  HeatmapCell,
  Insight,
  KpiMetric,
  NotificationItem,
  Participant,
  Payment,
  PaymentStatus,
  PlanTier,
  PriceTier,
  PricingModel,
  RangePreset,
  Resource,
  Session,
  Tenant,
  TenantFeatures,
  TimeSeriesPoint,
  TrendDirection,
  User,
  WeatherSnapshot,
} from '@/types'

import {
  addDays,
  average,
  bookingReference,
  clamp,
  createRng,
  fillRate,
  formatCurrency,
  formatNumber,
  hashSeed,
  percentChange,
  rngInt,
  rngPick,
  rngWeighted,
  seatsRemaining,
  startOfDay,
  startOfMonth,
  sum,
  toDateKey,
} from '@/lib/utils'

/**
 * The cheap, instantly-computed slice (tenants, users, resources, the
 * activity catalog) lives in `./demo-core` so a 'use client' component that
 * only needs e.g. `CURRENT_TENANT` never bundles — or re-runs in the
 * browser — the thousands-of-records generation below. Re-exported in full,
 * so every existing `from '@/lib/demo'` import keeps working unchanged.
 */
import {
  ACTIVITIES,
  CHANNEL_LABELS,
  CURRENT_TENANT,
  DAY_MS,
  NOW,
  NOW_MS,
  SPEC_BY_TENANT,
  TAX_RATE,
  TENANTS,
  activitiesByTenant,
  activityById,
  atTime,
  av,
  bookableByTenant,
  isoLocal,
  mondayIndex,
  pad2,
  resourcesByTenant,
  round,
  tenantById,
  tenantBySlug,
  userById,
  usersByTenant,
} from './demo-core'
export * from './demo-core'

/* ==========================================================================
   CUSTOMERS
   ========================================================================== */

const FIRST_NAMES = [
  'Ava', 'Noah', 'Mia', 'Liam', 'Sofia', 'Ethan', 'Isla', 'Kai', 'Chloe', 'Mateo',
  'Yuki', 'Hiroshi', 'Ingrid', 'Lars', 'Priya', 'Arjun', 'Leila', 'Omar', 'Elena', 'Tomas',
  'Grace', 'Declan', 'Nina', 'Felix', 'Aroha', 'Tane', 'Camille', 'Hugo', 'Anya', 'Dmitri',
  'Beatriz', 'Rafael', 'Ji-woo', 'Min-jun', 'Amara', 'Kwame', 'Lucia', 'Santiago', 'Freya', 'Bjorn',
  'Maya', 'Idris', 'Clara', 'Antoine', 'Sienna', 'Jasper', 'Rina', 'Haruto', 'Zoe', 'Callum',
  'Noor', 'Yusuf', 'Talia', 'Ezra', 'Marta', 'Pieter', 'Anika', 'Rohan', 'Esme', 'Oskar',
  'Leilani', 'Makoa', 'Daniela', 'Marco',
]

const LAST_NAMES = [
  'Whitaker', 'Fernandez', 'Okafor', 'Lindqvist', 'Tanaka', 'Moreau', 'Kaminski', 'Silva',
  'Abbott', 'Nakamura', 'Rossi', 'Delgado', 'Haugen', 'Byrne', 'Novak', 'Sharma',
  'Ellison', 'Petrov', 'Mendoza', 'Van Dijk', 'Kirby', 'Baptiste', 'Oyelaran', 'Halvorsen',
  'Castillo', 'Winters', 'Aoki', 'Duarte', 'Kowalczyk', 'Nasser', 'Brennan', 'Larsen',
  'Mbeki', 'Fontaine', 'Goldstein', 'Park', 'Reyes', 'Sorensen', 'Bianchi', 'Ferreira',
  'Holloway', 'Iversen', 'Jarrah', 'Kapoor', 'Lombardi', 'Marchetti', 'Novotny', 'Ogilvie',
  'Pereira', 'Quinn', 'Rahman', 'Steinberg', 'Tremblay', 'Ueda', 'Vasquez', 'Wallace',
  'Yamamoto', 'Zhao', 'Ashford', 'Bergstrom', 'Colombo', 'Dalgaard', 'Espinoza', 'Fitzgerald',
  'Gallagher', 'Hollis', 'Ivanov', 'Jansen', 'Kealoha', 'Laurent', 'Mahoney', 'Ndiaye',
]

const COUNTRY_POOLS: Record<string, [string, string, number][]> = {
  tnt_bluehorizon: [
    ['United States', 'US', 52],
    ['Canada', 'CA', 12],
    ['Japan', 'JP', 8],
    ['Australia', 'AU', 6],
    ['Germany', 'DE', 5],
    ['United Kingdom', 'GB', 5],
    ['South Korea', 'KR', 4],
    ['Brazil', 'BR', 2],
    ['France', 'FR', 2],
    ['Mexico', 'MX', 2],
    ['Netherlands', 'NL', 1],
    ['Singapore', 'SG', 1],
  ],
  tnt_coralcay: [
    ['Australia', 'AU', 44],
    ['United Kingdom', 'GB', 12],
    ['United States', 'US', 10],
    ['China', 'CN', 8],
    ['Germany', 'DE', 7],
    ['New Zealand', 'NZ', 6],
    ['Japan', 'JP', 4],
    ['France', 'FR', 3],
    ['Italy', 'IT', 3],
    ['India', 'IN', 3],
  ],
  tnt_saltline: [
    ['United States', 'US', 24],
    ['United Kingdom', 'GB', 16],
    ['Germany', 'DE', 12],
    ['France', 'FR', 10],
    ['Italy', 'IT', 8],
    ['Greece', 'GR', 8],
    ['Netherlands', 'NL', 6],
    ['Australia', 'AU', 5],
    ['Sweden', 'SE', 4],
    ['Spain', 'ES', 4],
    ['Canada', 'CA', 3],
  ],
  tnt_ridgeline: [
    ['New Zealand', 'NZ', 28],
    ['Australia', 'AU', 24],
    ['United States', 'US', 14],
    ['United Kingdom', 'GB', 10],
    ['Germany', 'DE', 7],
    ['Singapore', 'SG', 5],
    ['China', 'CN', 4],
    ['Japan', 'JP', 4],
    ['Canada', 'CA', 4],
  ],
}

const PHONE_PREFIX: Record<string, string> = {
  US: '+1', CA: '+1', AU: '+61', NZ: '+64', GB: '+44', DE: '+49', FR: '+33', IT: '+39',
  ES: '+34', NL: '+31', SE: '+46', GR: '+30', JP: '+81', KR: '+82', CN: '+86', IN: '+91',
  BR: '+55', MX: '+52', SG: '+65',
}

const EMAIL_DOMAINS = ['gmail.com', 'outlook.com', 'icloud.com', 'proton.me', 'hey.com', 'fastmail.com']

const CUSTOMER_TAGS = [
  'Repeat guest', 'Honeymoon', 'Concierge referral', 'Group leader', 'Photographer',
  'Dive certified', 'Newsletter', 'Cruise passenger', 'Local resident', 'Corporate',
  'Anniversary', 'Family travel',
]

const CUSTOMER_NOTES = [
  'Prefers the 09:30 departure — gets seasick on the dawn run.',
  'Travels with two children under 10, always needs flotation vests.',
  'Corporate account — invoice to the front office, not the card on file.',
  'Vegetarian, no shellfish. Flag to the galley on every booking.',
  'Books the same week every year. Send the early-bird list in February.',
  'Photographer — asks for the port rail seat on sunset sailings.',
  'Requested the same guide as last visit.',
  'Cruise passenger, hard 15:30 back-on-board time.',
  'Certified diver, card on file, expires 2028.',
  'Allergic to latex — no rubber wetsuit tops.',
]

const TENANT_SHORT: Record<string, string> = {
  tnt_bluehorizon: 'bh',
  tnt_coralcay: 'cc',
  tnt_saltline: 'sl',
  tnt_ridgeline: 'rl',
}

/** Weighted pick over [name, code, weight] triples. */
function pickCountry(rng: () => number, entries: [string, string, number][]): [string, string] {
  let total = 0
  for (const e of entries) total += e[2]
  let r = rng() * total
  for (const e of entries) {
    r -= e[2]
    if (r <= 0) return [e[0], e[1]]
  }
  const last = entries[entries.length - 1]
  return [last[0], last[1]]
}

/** ISO country code -> display name, populated as customers are generated. */
const COUNTRY_NAME_BY_CODE = new Map<string, string>()

/**
 * Guests are created on demand as bookings are generated, with preferential
 * attachment: most bookings come from a brand-new guest, the rest reuse an
 * existing one weighted by how often they have already booked. That produces a
 * realistic long tail — thousands of one-time visitors, a small core of
 * regulars — and makes the repeat-guest rate a real number, not an artefact.
 */
interface CustomerRegistry {
  customers: Customer[]
  /** Lottery tickets: one index per prior booking, so regulars come back more. */
  pool: number[]
  rng: () => number
}

/** Every generated guest email is unique across the whole dataset. */
const emailRegistry = new Set<string>()

const allCustomers: Customer[] = []
const registryByTenant = new Map<string, CustomerRegistry>()
for (const t of TENANTS) {
  registryByTenant.set(t.id, {
    customers: [],
    pool: [],
    rng: createRng(hashSeed(`customers:${t.id}`)),
  })
}

function createCustomer(tenant: Tenant): Customer {
  const reg = registryByTenant.get(tenant.id)!
  const rng = reg.rng
  const i = reg.customers.length
  const first = FIRST_NAMES[(i * 17 + rngInt(rng, 0, 5)) % FIRST_NAMES.length]
  const last = LAST_NAMES[(i * 29 + rngInt(rng, 0, 7)) % LAST_NAMES.length]
  const [countryName, countryCode] = pickCountry(rng, COUNTRY_POOLS[tenant.id])
  COUNTRY_NAME_BY_CODE.set(countryCode, countryName)
  const handle = `${first}.${last}`.toLowerCase().replace(/[^a-z0-9.]/g, '')
  let email = `${handle}@${rngPick(rng, EMAIL_DOMAINS)}`
  let suffix = 1
  while (emailRegistry.has(email)) {
    email = `${handle}${suffix}@${EMAIL_DOMAINS[suffix % EMAIL_DOMAINS.length]}`
    suffix++
  }
  emailRegistry.add(email)
  const tagCount = rngInt(rng, 0, 2)
  const tags: string[] = []
  for (let t = 0; t < tagCount; t++) {
    const tag = rngPick(rng, CUSTOMER_TAGS)
    if (!tags.includes(tag)) tags.push(tag)
  }
  return {
    id: `cus_${TENANT_SHORT[tenant.id]}_${String(i).padStart(5, '0')}`,
    tenantId: tenant.id,
    firstName: first,
    lastName: last,
    email,
    phone: `${PHONE_PREFIX[countryCode] ?? '+1'} ${rngInt(rng, 200, 989)} ${rngInt(rng, 100, 999)} ${rngInt(rng, 1000, 9999)}`,
    country: countryCode,
    avatarUrl: rng() < 0.32 ? av(rngInt(rng, 1, 70)) : undefined,
    createdAt: isoLocal(NOW),
    totalBookings: 0,
    lifetimeValue: 0,
    lastBookingAt: null,
    tags,
    marketingOptIn: rng() < 0.62,
    notes: rng() < 0.12 ? rngPick(rng, CUSTOMER_NOTES) : undefined,
    segment: 'new',
  }
}

/** Share of bookings placed by a guest who has never booked before. */
const NEW_CUSTOMER_RATE = 0.75

function pickCustomer(tenantId: string, rng: () => number): Customer {
  const reg = registryByTenant.get(tenantId)!
  if (reg.pool.length === 0 || rng() < NEW_CUSTOMER_RATE) {
    const customer = createCustomer(tenantById.get(tenantId)!)
    const idx = reg.customers.length
    reg.customers.push(customer)
    allCustomers.push(customer)
    reg.pool.push(idx, idx)
    return customer
  }
  const idx = reg.pool[Math.floor(rng() * reg.pool.length)]
  reg.pool.push(idx)
  return reg.customers[idx]
}

/* ==========================================================================
   DEPARTURE + BOOKING GENERATION
   ========================================================================== */

/** Mon..Sun demand uplift — drives the occupancy heatmap. */
const WEEKDAY_UPLIFT = [0.9, 0.82, 0.9, 0.99, 1.12, 1.28, 1.16]
/** Jan..Dec seasonality — the demo window (Jun–Nov) rides an autumn upswing. */
const MONTH_FACTOR = [0.9, 0.92, 0.98, 1.02, 1.0, 0.96, 1.02, 1.06, 1.12, 1.16, 1.08, 1.12]

function trendFactor(off: number) {
  return clamp(1 + off * 0.0022, 0.74, 1.24)
}

function todFactor(hour: number) {
  if (hour < 8) return 0.94
  if (hour < 11) return 1.07
  if (hour < 14) return 0.96
  if (hour < 17) return 1.12
  if (hour < 20) return 1.05
  return 0.9
}

function paceFactor(off: number) {
  return off <= 0 ? 1 : clamp(1 - off * 0.0155, 0.22, 1)
}

/** A five-day tropical storm sat on the islands 38–34 days ago. */
const STORM_FROM = -38
const STORM_TO = -34
function stormFactor(off: number) {
  return off <= STORM_TO && off >= STORM_FROM ? 0.42 : 1
}

const CHANNEL_WEIGHTS: [BookingChannel, number][] = [
  ['website_widget', 34],
  ['direct', 18],
  ['ota', 16],
  ['phone', 10],
  ['walk_in', 8],
  ['reseller', 6],
  ['concierge', 5],
  ['google', 3],
]


const OTA_SOURCES = ['Viator', 'GetYourGuide', 'Expedia Local Expert', 'TripAdvisor Experiences', 'Klook']
const RESELLER_SOURCES = ['Island Activity Desk', 'Barefoot Tours', 'Sunshine Booking Co.']
const CONCIERGE_SOURCES = ['Grand Resort concierge', 'Four Winds concierge', 'Harbourview concierge']

const PARTY_WEIGHTS: [number, number][] = [
  [1, 12], [2, 38], [3, 14], [4, 18], [5, 7], [6, 6], [8, 3], [10, 2],
]

const LEAD_WEIGHTS: [number, number][] = [
  [0, 4], [1, 5], [2, 5], [3, 6], [5, 8], [7, 10], [10, 9], [14, 9],
  [21, 7], [30, 6], [45, 4], [60, 3], [90, 2],
]

const PROMO_CODES: [string, number][] = [
  ['ALOHA10', 10], ['EARLYBIRD15', 15], ['KAMAAINA20', 20], ['REPEAT10', 10], ['SHOULDER12', 12],
]

const CANCEL_REASONS = [
  'Guest illness',
  'Flight delay — missed check-in',
  'Weather cancellation by operator',
  'Schedule conflict',
  'Found a different time',
  'Travel plans changed',
  'Operator cancelled — vessel maintenance',
]

const REVIEWS_5 = [
  'Best thing we did on the whole trip. The crew made it.',
  'Genuinely flawless from check-in to the last drink. Book it.',
  'Our guide spotted things we would have swum straight past. Incredible.',
  'Worth every cent. We rebooked for the day before we fly home.',
  'Small group, real attention, no feeling of being processed. Perfect.',
  'The photos do not do it justice. Do this one first, not last.',
  'Crew remembered our kids names all day. That is why we came back.',
]
const REVIEWS_4 = [
  'Really good trip, only wish it had run thirty minutes longer.',
  'Great guides and great conditions. Parking was a bit of a scramble.',
  'Loved it. Gear was showing its age but everything worked.',
  'Excellent value and a genuinely knowledgeable crew.',
  'Would happily do it again — slightly crowded at the second stop.',
]
const REVIEWS_3 = [
  'Fine trip, but the conditions were not what we hoped for.',
  'Enjoyable, though it felt rushed at the second stop.',
  'Good crew, average visibility on the day. Luck of the draw.',
]
const REVIEWS_LOW = [
  'Cancelled on us twice before it ran. Communication could be better.',
  'The water was too rough for our group and nobody warned us.',
]

const DEPARTURE_NOTES = [
  'Private group booking attached — brief the crew on the surprise.',
  'Two guests with mobility needs, boarding assistance arranged.',
  'Photographer aboard for the marketing shoot.',
  'Running one crew short — cover confirmed.',
  'Birthday cake stowed in the galley fridge.',
  'Swell forecast building through the afternoon, monitor conditions.',
  'Fuel top-up scheduled before this run.',
]

const WEATHER_CONDITIONS: [WeatherSnapshot['condition'], number][] = [
  ['clear', 58], ['cloudy', 22], ['wind', 11], ['rain', 7], ['storm', 2],
]

const TAX_LABEL: Record<string, string> = {
  tnt_bluehorizon: 'Hawaii GET (4.712%)',
  tnt_coralcay: 'GST (10%)',
  tnt_saltline: 'VAT (13%)',
  tnt_ridgeline: 'GST (15%)',
}

const GUEST_NOTES = [
  'Celebrating our anniversary — no big fuss, just happy to be here.',
  'One of our party is a nervous swimmer, please keep an eye out.',
  'We would love to sit together if that is possible.',
  'Travelling with a 6-year-old, is there a smaller wetsuit?',
  'Arriving straight from the airport, may be five minutes late.',
  'Vegetarian meal for one guest please.',
  'Is there anywhere secure to leave a camera bag?',
]

const INTERNAL_NOTES = [
  'Repeat guest — comp a round at the bar.',
  'OTA booking, commission already deducted at source.',
  'Guest called to confirm pickup time, reconfirmed by SMS.',
  'Flagged for follow-up review request after the trip.',
  'Card declined once, retried successfully.',
  'Concierge asked for a handwritten welcome note.',
]

const PAYMENT_METHODS: [Payment['method'], number][] = [
  ['card', 60], ['apple_pay', 15], ['google_pay', 7], ['cash', 8], ['bank_transfer', 5], ['gift_card', 5],
]
const CARD_BRANDS = ['Visa', 'Mastercard', 'Amex', 'Discover']

const RATING_WEIGHTS: [number, number][] = [[5, 66], [4, 24], [3, 7], [2, 2], [1, 1]]

const allDepartures: Departure[] = []
const allBookings: Booking[] = []
const allPayments: Payment[] = []

let bookingSeq = 0
let paymentSeq = 0
let departureSeq = 0

for (const [tenantId, specs] of SPEC_BY_TENANT) {
  const tenant = tenantById.get(tenantId)!
  const currency: CurrencyCode = tenant.currency
  const taxRate = TAX_RATE[tenantId] ?? 0
  const taxLabel = TAX_LABEL[tenantId] ?? 'Tax'
  const isPrimary = tenantId === CURRENT_TENANT.id
  const back = isPrimary ? 60 : 45
  const fwd = isPrimary ? 60 : 45
  const staff = bookableByTenant.get(tenantId) ?? []
  const websiteHost = tenant.contact.website.replace(/^https?:\/\//, '')

  for (const spec of specs) {
    const activity = activityById.get(`act_${spec.slug}`)!
    if (activity.status !== 'live') continue

    const rng = createRng(hashSeed(`gen:${activity.id}`))
    const adultTier = activity.priceTiers[0]
    const childTier = activity.priceTiers.find((t) => /child|youth|kid/i.test(t.label) && t.price > 0)
    const isGroupPriced = activity.pricingModel === 'per_group'
    const crewSize = activity.maxCapacity >= 30 ? 3 : activity.maxCapacity >= 14 ? 2 : 1

    for (let off = -back; off <= fwd; off++) {
      const day = startOfDay(addDays(NOW, off))
      if (spec.weekdays && !spec.weekdays.includes(day.getDay())) continue
      const wd = mondayIndex(day)
      const inStorm = off <= STORM_TO && off >= STORM_FROM

      for (const time of spec.times) {
        const startsAt = atTime(day, time)
        const startMs = startsAt.getTime()
        const endsAt = new Date(startMs + activity.durationMinutes * 60_000)
        const hour = startsAt.getHours()
        const isPast = startMs < NOW_MS

        let capacity = activity.maxCapacity
        if (rng() < 0.08) {
          capacity = Math.max(activity.minParticipants + 1, round(capacity * (0.7 + rng() * 0.2)))
        }

        const demand =
          spec.popularity *
          trendFactor(off) *
          MONTH_FACTOR[day.getMonth()] *
          WEEKDAY_UPLIFT[wd] *
          todFactor(hour) *
          paceFactor(off) *
          stormFactor(off) *
          (0.8 + rng() * 0.36)

        const booked = clamp(round(capacity * clamp(demand, 0, 1.05)), 0, capacity)

        const cancelRoll = rng()
        const departureCancelled = inStorm
          ? cancelRoll < 0.58
          : isPast
            ? cancelRoll < 0.028
            : cancelRoll < 0.01
        const holdRoll = rng()
        const weatherHold =
          !departureCancelled && !isPast && off <= 10 && (off === 4 ? holdRoll < 0.4 : holdRoll < 0.028)

        const held =
          !isPast && !departureCancelled && rng() < 0.18
            ? Math.min(rngInt(rng, 1, 3), Math.max(0, capacity - booked))
            : 0

        let status: DepartureStatus
        if (departureCancelled) status = 'cancelled'
        else if (isPast) status = 'completed'
        else if (weatherHold) status = 'weather_hold'
        else if (capacity - booked - held <= 0) status = 'sold_out'
        else if (off <= 3) status = 'confirmed'
        else status = 'scheduled'

        const assignedStaffIds: string[] = []
        if (staff.length > 0) {
          const startIdx = rngInt(rng, 0, staff.length - 1)
          const n = Math.min(crewSize, staff.length)
          for (let s = 0; s < n; s++) assignedStaffIds.push(staff[(startIdx + s) % staff.length].id)
        }

        let weather: WeatherSnapshot | undefined
        if (off >= -10 && off <= 10) {
          const condition = inStorm ? 'storm' : rngWeighted(rng, WEATHER_CONDITIONS)
          const goConfidence =
            condition === 'clear'
              ? rngInt(rng, 95, 99)
              : condition === 'cloudy'
                ? rngInt(rng, 86, 96)
                : condition === 'wind'
                  ? rngInt(rng, 58, 82)
                  : condition === 'rain'
                    ? rngInt(rng, 52, 78)
                    : rngInt(rng, 6, 26)
          weather = {
            condition,
            tempC: rngInt(rng, 22, 31),
            windKts: condition === 'storm' ? rngInt(rng, 28, 42) : condition === 'wind' ? rngInt(rng, 16, 26) : rngInt(rng, 4, 15),
            swellM: Math.round((condition === 'storm' ? 2.4 + rng() * 1.8 : 0.4 + rng() * 1.4) * 10) / 10,
            goConfidence,
          }
        }

        const departureId = `dep_${(departureSeq++).toString(36).padStart(5, '0')}`
        const fill = capacity === 0 ? 0 : booked / capacity
        const departure: Departure = {
          id: departureId,
          tenantId,
          activityId: activity.id,
          startsAt: isoLocal(startsAt),
          endsAt: isoLocal(endsAt),
          capacity,
          booked,
          held,
          status,
          assignedStaffIds,
          assignedResourceIds: activity.requiredResourceIds,
          weather,
          notes: rng() < 0.1 ? rngPick(rng, DEPARTURE_NOTES) : undefined,
          priceMultiplier:
            tenant.features.dynamicPricing && fill > 0.85 && !isPast
              ? 1 + rngInt(rng, 1, 3) / 20
              : undefined,
        }
        allDepartures.push(departure)

        if (booked === 0) continue

        /* ---- parties that add up to exactly `booked` ---- */
        const parties: number[] = []
        if (isGroupPriced) {
          parties.push(booked)
        } else {
          let left = booked
          while (left > 0) {
            let size = rngWeighted(rng, PARTY_WEIGHTS)
            if (size > left) size = left
            parties.push(size)
            left -= size
          }
        }

        for (const size of parties) {
          const bookingId = `bkg_${(bookingSeq++).toString(36).padStart(5, '0')}`
          const customer = pickCustomer(tenantId, rng)
          const channel = rngWeighted(rng, CHANNEL_WEIGHTS)
          const leadDays = rngWeighted(rng, LEAD_WEIGHTS)
          let createdMs = startMs - leadDays * DAY_MS - rngInt(rng, 0, 900) * 60_000
          if (createdMs > NOW_MS) createdMs = NOW_MS - rngInt(rng, 5, 5760) * 60_000
          const createdAt = new Date(createdMs)

          const lineItems: BookingLineItem[] = []
          let li = 0
          let subtotal = 0

          let children = 0
          if (!isGroupPriced && childTier && size >= 3 && rng() < 0.45) {
            children = rngInt(rng, 1, Math.min(2, size - 1))
          }
          const adults = size - children

          if (isGroupPriced) {
            lineItems.push({
              id: `li_${bookingId}_${++li}`,
              label: adultTier.label,
              kind: 'ticket',
              quantity: 1,
              unitPrice: adultTier.price,
              total: adultTier.price,
            })
            subtotal += adultTier.price
          } else {
            const adultTotal = adults * adultTier.price
            lineItems.push({
              id: `li_${bookingId}_${++li}`,
              label: adultTier.label,
              kind: 'ticket',
              quantity: adults,
              unitPrice: adultTier.price,
              total: adultTotal,
            })
            subtotal += adultTotal
            if (children > 0 && childTier) {
              const childTotal = children * childTier.price
              lineItems.push({
                id: `li_${bookingId}_${++li}`,
                label: childTier.label,
                kind: 'ticket',
                quantity: children,
                unitPrice: childTier.price,
                total: childTotal,
              })
              subtotal += childTotal
            }
          }

          let addonPicks = 0
          for (const ad of activity.addOns) {
            if (addonPicks >= 2) break
            if (rng() < 0.19) {
              const cap = ad.maxPerBooking ?? 4
              const qty = clamp(rngInt(rng, 1, Math.min(cap, Math.max(1, size))), 1, cap)
              const totalLine = qty * ad.price
              lineItems.push({
                id: `li_${bookingId}_${++li}`,
                label: ad.label,
                kind: 'addon',
                quantity: qty,
                unitPrice: ad.price,
                total: totalLine,
              })
              subtotal += totalLine
              addonPicks++
            }
          }

          let discountTotal = 0
          let promoCode: string | undefined
          if (rng() < 0.12) {
            const [code, pct] = rngPick(rng, PROMO_CODES)
            promoCode = code
            discountTotal = round(subtotal * (pct / 100))
            lineItems.push({
              id: `li_${bookingId}_${++li}`,
              label: `Promo ${code} (-${pct}%)`,
              kind: 'discount',
              quantity: 1,
              unitPrice: -discountTotal,
              total: -discountTotal,
            })
          }

          const net = subtotal - discountTotal
          const feeTotal = channel === 'walk_in' ? 0 : round(net * 0.06)
          if (feeTotal > 0) {
            lineItems.push({
              id: `li_${bookingId}_${++li}`,
              label: 'Booking & harbour fee',
              kind: 'fee',
              quantity: 1,
              unitPrice: feeTotal,
              total: feeTotal,
            })
          }
          const taxTotal = round(net * taxRate)
          if (taxTotal > 0) {
            lineItems.push({
              id: `li_${bookingId}_${++li}`,
              label: taxLabel,
              kind: 'tax',
              quantity: 1,
              unitPrice: taxTotal,
              total: taxTotal,
            })
          }
          const total = net + feeTotal + taxTotal

          /* ---- status ---- */
          let bookingStatus: BookingStatus
          const roll = rng()
          if (status === 'cancelled') {
            bookingStatus = 'cancelled'
          } else if (isPast) {
            bookingStatus = roll < 0.04 ? 'no_show' : roll < 0.075 ? 'cancelled' : 'completed'
          } else {
            if (roll < 0.045) bookingStatus = 'cancelled'
            else if (roll < 0.085) bookingStatus = 'pending'
            else if (off === 0 && rng() < 0.45) bookingStatus = 'checked_in'
            else bookingStatus = 'confirmed'
          }
          if (bookingStatus === 'completed' && rng() < 0.014) bookingStatus = 'refunded'

          let chargeAmount = 0
          let refundAmount: number | undefined
          let paymentStatus: PaymentStatus
          if (bookingStatus === 'pending') {
            paymentStatus = 'unpaid'
          } else if (bookingStatus === 'cancelled') {
            chargeAmount = total
            refundAmount = rng() < 0.78 ? total : round(total * 0.5)
            paymentStatus = refundAmount >= total ? 'refunded' : 'partially_refunded'
          } else if (bookingStatus === 'refunded') {
            chargeAmount = total
            refundAmount = total
            paymentStatus = 'refunded'
          } else {
            const pr = rng()
            if (pr < 0.9) {
              chargeAmount = total
              paymentStatus = 'paid'
            } else if (pr < 0.97) {
              chargeAmount = round(total * 0.3)
              paymentStatus = 'deposit_paid'
            } else {
              paymentStatus = 'unpaid'
            }
          }
          const amountPaid = chargeAmount - (refundAmount ?? 0)

          let cancelledAt: string | undefined
          let cancellationReason: string | undefined
          if (bookingStatus === 'cancelled' || bookingStatus === 'refunded') {
            const upper = Math.min(NOW_MS, startMs)
            const span = Math.max(60_000, upper - createdMs)
            cancelledAt = isoLocal(new Date(createdMs + Math.floor(rng() * span)))
            cancellationReason =
              status === 'cancelled'
                ? inStorm
                  ? 'Operator cancelled — tropical storm, unsafe sea state'
                  : 'Operator cancelled — conditions'
                : rngPick(rng, CANCEL_REASONS)
          }

          /* ---- participants ---- */
          const participants: Participant[] = []
          for (let pi = 0; pi < size; pi++) {
            const isChild = pi >= adults && childTier !== undefined
            const first = pi === 0 ? customer.firstName : rngPick(rng, FIRST_NAMES)
            const last = pi === 0 || rng() < 0.68 ? customer.lastName : rngPick(rng, LAST_NAMES)
            participants.push({
              id: `par_${bookingId}_${pi + 1}`,
              firstName: first,
              lastName: last,
              age: isChild ? rngInt(rng, 5, 12) : rng() < 0.62 ? rngInt(rng, 21, 44) : rngInt(rng, 45, 71),
              notes:
                rng() < 0.08
                  ? rngPick(rng, [
                      'Nervous swimmer — keep close',
                      'Vegetarian',
                      'Shellfish allergy',
                      'Wears contact lenses',
                      'Previous shoulder injury',
                    ])
                  : undefined,
              waiverSigned: isPast ? rng() < 0.97 : rng() < 0.72,
              tierLabel: isChild && childTier ? childTier.label : adultTier.label,
            })
          }

          let rating: number | undefined
          let reviewText: string | undefined
          if (bookingStatus === 'completed' && rng() < 0.35) {
            rating = rngWeighted(rng, RATING_WEIGHTS)
            if (rng() < 0.5) {
              reviewText =
                rating === 5
                  ? rngPick(rng, REVIEWS_5)
                  : rating === 4
                    ? rngPick(rng, REVIEWS_4)
                    : rating === 3
                      ? rngPick(rng, REVIEWS_3)
                      : rngPick(rng, REVIEWS_LOW)
            }
          }

          const source =
            channel === 'ota'
              ? rngPick(rng, OTA_SOURCES)
              : channel === 'reseller'
                ? rngPick(rng, RESELLER_SOURCES)
                : channel === 'concierge'
                  ? rngPick(rng, CONCIERGE_SOURCES)
                  : channel === 'website_widget'
                    ? websiteHost
                    : channel === 'google'
                      ? 'Google Things to do'
                      : channel === 'phone'
                        ? 'Inbound call'
                        : channel === 'walk_in'
                          ? 'Harbour desk'
                          : 'Direct'

          const updatedMs = cancelledAt
            ? new Date(cancelledAt).getTime()
            : Math.min(NOW_MS, createdMs + rngInt(rng, 5, 2880) * 60_000)

          allBookings.push({
            id: bookingId,
            tenantId,
            reference: bookingReference(bookingId),
            activityId: activity.id,
            departureId,
            customerId: customer.id,
            status: bookingStatus,
            paymentStatus,
            channel,
            partySize: size,
            lineItems,
            subtotal,
            discountTotal,
            taxTotal,
            feeTotal,
            total,
            amountPaid,
            currency,
            participants,
            createdAt: isoLocal(createdAt),
            updatedAt: isoLocal(new Date(updatedMs)),
            departureAt: departure.startsAt,
            notes: rng() < 0.1 ? rngPick(rng, GUEST_NOTES) : undefined,
            internalNotes: rng() < 0.08 ? rngPick(rng, INTERNAL_NOTES) : undefined,
            source,
            promoCode,
            cancelledAt,
            cancellationReason,
            refundAmount,
            rating,
            reviewText,
          })

          /* ---- payments ---- */
          if (chargeAmount > 0) {
            const method = rngWeighted(rng, PAYMENT_METHODS)
            const isCard = method === 'card' || method === 'apple_pay' || method === 'google_pay'
            const processorFee = method === 'cash' || method === 'gift_card' ? 0 : round(chargeAmount * 0.029) + 30
            allPayments.push({
              id: `pay_${(paymentSeq++).toString(36).padStart(5, '0')}`,
              tenantId,
              bookingId,
              amount: chargeAmount,
              currency,
              method,
              status: 'succeeded',
              processorFee,
              netAmount: chargeAmount - processorFee,
              createdAt: isoLocal(createdAt),
              last4: isCard ? String(rngInt(rng, 1000, 9999)) : undefined,
              brand: isCard ? rngPick(rng, CARD_BRANDS) : undefined,
            })
            if (refundAmount && refundAmount > 0) {
              allPayments.push({
                id: `pay_${(paymentSeq++).toString(36).padStart(5, '0')}`,
                tenantId,
                bookingId,
                amount: -refundAmount,
                currency,
                method,
                status: 'refunded',
                processorFee: 0,
                netAmount: -refundAmount,
                createdAt: cancelledAt ?? isoLocal(createdAt),
              })
            }
          }
        }
      }
    }
  }
}

/* ==========================================================================
   AGGREGATES + INDEXES
   ========================================================================== */

allDepartures.sort((a, b) => (a.startsAt < b.startsAt ? -1 : a.startsAt > b.startsAt ? 1 : 0))

export const DEPARTURES: Departure[] = allDepartures
export const BOOKINGS: Booking[] = allBookings
export const PAYMENTS: Payment[] = allPayments

const departureById = new Map<string, Departure>()
const departuresByTenant = new Map<string, Departure[]>()
const departuresByDayKey = new Map<string, Departure[]>()
for (const d of allDepartures) {
  departureById.set(d.id, d)
  const t = departuresByTenant.get(d.tenantId)
  if (t) t.push(d)
  else departuresByTenant.set(d.tenantId, [d])
  const key = `${d.tenantId}::${d.startsAt.slice(0, 10)}`
  const k = departuresByDayKey.get(key)
  if (k) k.push(d)
  else departuresByDayKey.set(key, [d])
}

const bookingById = new Map<string, Booking>()
const bookingsByDeparture = new Map<string, Booking[]>()
const bookingsByCustomer = new Map<string, Booking[]>()
const bookingsByTenant = new Map<string, Booking[]>()
const bookingsByActivity = new Map<string, Booking[]>()
for (const b of allBookings) {
  bookingById.set(b.id, b)
  const d = bookingsByDeparture.get(b.departureId)
  if (d) d.push(b)
  else bookingsByDeparture.set(b.departureId, [b])
  const c = bookingsByCustomer.get(b.customerId)
  if (c) c.push(b)
  else bookingsByCustomer.set(b.customerId, [b])
  const t = bookingsByTenant.get(b.tenantId)
  if (t) t.push(b)
  else bookingsByTenant.set(b.tenantId, [b])
  const a = bookingsByActivity.get(b.activityId)
  if (a) a.push(b)
  else bookingsByActivity.set(b.activityId, [b])
}

const paymentsByBooking = new Map<string, Payment[]>()
for (const p of allPayments) {
  const list = paymentsByBooking.get(p.bookingId)
  if (list) list.push(p)
  else paymentsByBooking.set(p.bookingId, [p])
}

/** Earliest generated departure per tenant — bounds how far a comparison can reach. */
const dataStartByTenant = new Map<string, number>()
for (const [tid, list] of departuresByTenant) {
  if (list.length > 0) dataStartByTenant.set(tid, startOfDay(new Date(list[0].startsAt)).getTime())
}

/** Tenant bookings sorted by departure date — the spine of every analytics range query. */
const bookingsByTenantByDeparture = new Map<string, Booking[]>()
for (const [tid, list] of bookingsByTenant) {
  bookingsByTenantByDeparture.set(
    tid,
    [...list].sort((a, b) => (a.departureAt < b.departureAt ? -1 : a.departureAt > b.departureAt ? 1 : 0)),
  )
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

/* ---- customer roll-up: totalBookings / lifetimeValue / segment ---- */
for (const c of allCustomers) {
  const list = bookingsByCustomer.get(c.id)
  if (!list || list.length === 0) continue
  let count = 0
  let ltv = 0
  let lastCreated = ''
  for (const b of list) {
    if (b.status !== 'cancelled' && b.status !== 'refunded') {
      count++
      ltv += b.total
    }
    if (b.createdAt > lastCreated) lastCreated = b.createdAt
  }
  c.totalBookings = count
  c.lifetimeValue = ltv
  c.lastBookingAt = lastCreated || null
  let earliest = lastCreated
  for (const b of list) if (b.createdAt < earliest) earliest = b.createdAt
  const signupRng = createRng(hashSeed(`signup:${c.id}`))
  c.createdAt = isoLocal(addDays(new Date(earliest), -rngInt(signupRng, 0, 210)))
  const daysSince = lastCreated ? (NOW_MS - new Date(lastCreated).getTime()) / DAY_MS : 999
  c.segment =
    count >= 3 || ltv >= 200000
      ? 'vip'
      : daysSince > 120
        ? 'lapsed'
        : count >= 2
          ? 'returning'
          : 'new'
  if (c.segment === 'vip' && !c.tags.includes('Repeat guest')) c.tags = [...c.tags, 'Repeat guest']
}

/** Every generated guest has at least one booking on file. */
export const CUSTOMERS: Customer[] = allCustomers

const customerById = new Map(CUSTOMERS.map((c) => [c.id, c]))
const customersByTenant = new Map<string, Customer[]>()
for (const c of CUSTOMERS) {
  const list = customersByTenant.get(c.tenantId)
  if (list) list.push(c)
  else customersByTenant.set(c.tenantId, [c])
}

/* ---- activity roll-up ---- */
for (const a of ACTIVITIES) {
  const list = bookingsByActivity.get(a.id)
  const generated = list ? list.filter((b) => b.status !== 'cancelled').length : 0
  a.totalBookings = generated + round(a.reviewCount * 4.2)
}

/* ---- tenant stats roll-up (trailing 30 days by departure date) ---- */
const THIRTY_AGO = isoLocal(addDays(NOW, -30))
const NOW_ISO = isoLocal(NOW)
for (const t of TENANTS) {
  const list = bookingsByTenantByDeparture.get(t.id) ?? []
  let mBookings = 0
  let mRevenue = 0
  for (const b of list) {
    if (b.departureAt < THIRTY_AGO || b.departureAt > NOW_ISO) continue
    if (b.status === 'cancelled') continue
    mBookings++
    mRevenue += b.total
  }
  const acts = activitiesByTenant.get(t.id) ?? []
  const live = acts.filter((a) => a.status === 'live')
  t.stats.monthlyBookings = mBookings
  t.stats.monthlyRevenue = mRevenue
  t.stats.activeActivities = live.length
  t.stats.teamSize = (usersByTenant.get(t.id) ?? []).length
  t.stats.reviewCount = sum(acts.map((a) => a.reviewCount))
  t.stats.avgRating =
    acts.length === 0
      ? 0
      : Math.round((sum(acts.map((a) => a.rating * a.reviewCount)) / Math.max(1, t.stats.reviewCount)) * 10) / 10
}

/* ==========================================================================
   CORE LOOKUPS
   ========================================================================== */

export function getCustomerById(id: string): Customer | undefined {
  return customerById.get(id)
}

export function getDepartureById(id: string): Departure | undefined {
  return departureById.get(id)
}

export function getBookingById(id: string): Booking | undefined {
  return bookingById.get(id)
}

export function getBookingsByDeparture(departureId: string): Booking[] {
  return bookingsByDeparture.get(departureId) ?? []
}

export function getBookingsByCustomer(customerId: string): Booking[] {
  return bookingsByCustomer.get(customerId) ?? []
}

export function getCustomersByTenant(tenantId: string): Customer[] {
  return customersByTenant.get(tenantId) ?? []
}

export function getPaymentsByBooking(bookingId: string): Payment[] {
  return paymentsByBooking.get(bookingId) ?? []
}

export function getDeparturesInRange(tenantId: string, from: Date, to: Date): Departure[] {
  const list = departuresByTenant.get(tenantId) ?? []
  const fromKey = isoLocal(startOfDay(from))
  const toKey = isoLocal(new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59))
  const out: Departure[] = []
  for (const d of list) {
    if (d.startsAt < fromKey) continue
    if (d.startsAt > toKey) break
    out.push(d)
  }
  return out
}

export function getDeparturesForDay(tenantId: string, day: Date): Departure[] {
  return departuresByDayKey.get(`${tenantId}::${toDateKey(day)}`) ?? []
}

export function getUpcomingDepartures(tenantId: string, limit = 8): Departure[] {
  const list = departuresByTenant.get(tenantId) ?? []
  const nowIso = isoLocal(NOW)
  const out: Departure[] = []
  for (const d of list) {
    if (d.startsAt < nowIso) continue
    if (d.status === 'cancelled') continue
    out.push(d)
    if (out.length >= limit) break
  }
  return out
}

export function getRecentBookings(tenantId: string, limit = 10): Booking[] {
  const list = bookingsByTenant.get(tenantId) ?? []
  return list.slice(0, limit)
}

/* ==========================================================================
   JOINED VIEWS — manifest, calendar, booking rows
   ========================================================================== */

export interface ManifestRow {
  departure: Departure
  activity: Activity
  bookings: Booking[]
  customers: Customer[]
  staff: User[]
  /** Derived: booked / capacity as a percent. */
  fillRate: number
}

export function getManifest(tenantId: string, day: Date = NOW): ManifestRow[] {
  return getDeparturesForDay(tenantId, day).map((departure) => {
    const bookings = getBookingsByDeparture(departure.id)
    const seen = new Set<string>()
    const customers: Customer[] = []
    for (const b of bookings) {
      if (seen.has(b.customerId)) continue
      seen.add(b.customerId)
      const c = customerById.get(b.customerId)
      if (c) customers.push(c)
    }
    const staff: User[] = []
    for (const id of departure.assignedStaffIds) {
      const u = userById.get(id)
      if (u) staff.push(u)
    }
    return {
      departure,
      activity: activityById.get(departure.activityId)!,
      bookings,
      customers,
      staff,
      fillRate: fillRate(departure.booked, departure.capacity),
    }
  })
}

export interface CalendarEvent {
  departure: Departure
  activity: Activity
  seatsLeft: number
  fillRate: number
  /** Gross booked value, excluding cancelled and refunded rows. Minor units. */
  revenue: number
  /** Cash actually collected, excluding cancelled rows. Minor units. */
  paid: number
}

function toCalendarEvent(departure: Departure): CalendarEvent {
  // Money is folded in here, server-side, so calendar views never need the
  // bookings index (and therefore never need this module) in the browser.
  let revenue = 0
  let paid = 0
  for (const booking of bookingsByDeparture.get(departure.id) ?? []) {
    if (booking.status !== 'cancelled') paid += booking.amountPaid
    if (booking.status === 'cancelled' || booking.status === 'refunded') continue
    revenue += booking.total
  }
  return {
    departure,
    activity: activityById.get(departure.activityId)!,
    seatsLeft: seatsRemaining(departure.capacity, departure.booked, departure.held),
    fillRate: fillRate(departure.booked, departure.capacity),
    revenue,
    paid,
  }
}

export function getCalendarEvents(tenantId: string, from: Date, to: Date): CalendarEvent[] {
  return getDeparturesInRange(tenantId, from, to).map(toCalendarEvent)
}

export function getCalendarEventsByDay(
  tenantId: string,
  from: Date,
  to: Date,
): Record<string, CalendarEvent[]> {
  const out: Record<string, CalendarEvent[]> = {}
  for (const d of getDeparturesInRange(tenantId, from, to)) {
    const key = d.startsAt.slice(0, 10)
    ;(out[key] ||= []).push(toCalendarEvent(d))
  }
  return out
}

export interface BookingRow {
  booking: Booking
  activity: Activity
  customer: Customer
  departure: Departure
}

const bookingRowCache = new Map<string, BookingRow[]>()

function toBookingRow(booking: Booking): BookingRow | undefined {
  const activity = activityById.get(booking.activityId)
  const customer = customerById.get(booking.customerId)
  const departure = departureById.get(booking.departureId)
  if (!activity || !customer || !departure) return undefined
  return { booking, activity, customer, departure }
}

/** All bookings for a tenant as joined rows, newest booking first. Memoised. */
export function getBookingRows(tenantId: string, limit?: number): BookingRow[] {
  const cached = bookingRowCache.get(tenantId)
  if (cached) return limit ? cached.slice(0, limit) : cached
  const rows: BookingRow[] = []
  for (const b of bookingsByTenant.get(tenantId) ?? []) {
    const row = toBookingRow(b)
    if (row) rows.push(row)
  }
  bookingRowCache.set(tenantId, rows)
  return limit ? rows.slice(0, limit) : rows
}

export function getBookingDetail(
  bookingId: string,
): (BookingRow & { payments: Payment[] }) | undefined {
  const booking = bookingById.get(bookingId)
  if (!booking) return undefined
  const row = toBookingRow(booking)
  if (!row) return undefined
  return { ...row, payments: paymentsByBooking.get(bookingId) ?? [] }
}

/* ==========================================================================
   ANALYTICS
   ========================================================================== */

interface DayAgg {
  date: string
  revenue: number
  bookings: number
  guests: number
  cancellations: number
  capacity: number
  booked: number
  ratingSum: number
  ratingCount: number
  leadSum: number
  leadCount: number
  repeatBookings: number
}

function emptyDay(date: string): DayAgg {
  return {
    date,
    revenue: 0,
    bookings: 0,
    guests: 0,
    cancellations: 0,
    capacity: 0,
    booked: 0,
    ratingSum: 0,
    ratingCount: 0,
    leadSum: 0,
    leadCount: 0,
    repeatBookings: 0,
  }
}

function lowerBoundBookings(arr: Booking[], iso: string): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].departureAt < iso) lo = mid + 1
    else hi = mid
  }
  return lo
}

function lowerBoundDepartures(arr: Departure[], iso: string): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (arr[mid].startsAt < iso) lo = mid + 1
    else hi = mid
  }
  return lo
}

/** Bookings whose DEPARTURE falls inside [from, to]. */
function bookingsInRange(tenantId: string, from: Date, to: Date): Booking[] {
  const arr = bookingsByTenantByDeparture.get(tenantId) ?? []
  const lo = lowerBoundBookings(arr, isoLocal(startOfDay(from)))
  const hiIso = `${toDateKey(to)}T23:59:59`
  const out: Booking[] = []
  for (let i = lo; i < arr.length; i++) {
    if (arr[i].departureAt > hiIso) break
    out.push(arr[i])
  }
  return out
}

function departuresInRangeFast(tenantId: string, from: Date, to: Date): Departure[] {
  const arr = departuresByTenant.get(tenantId) ?? []
  const lo = lowerBoundDepartures(arr, isoLocal(startOfDay(from)))
  const hiIso = `${toDateKey(to)}T23:59:59`
  const out: Departure[] = []
  for (let i = lo; i < arr.length; i++) {
    if (arr[i].startsAt > hiIso) break
    out.push(arr[i])
  }
  return out
}

/** Day-by-day aggregate over an inclusive date window. */
function collectDays(tenantId: string, from: Date, to: Date): DayAgg[] {
  const days: DayAgg[] = []
  const index = new Map<string, DayAgg>()
  const start = startOfDay(from)
  const end = startOfDay(to)
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    const key = toDateKey(d)
    const agg = emptyDay(key)
    days.push(agg)
    index.set(key, agg)
  }

  for (const b of bookingsInRange(tenantId, from, to)) {
    const agg = index.get(b.departureAt.slice(0, 10))
    if (!agg) continue
    const refund = b.refundAmount ?? 0
    agg.revenue += b.total - refund
    if (b.status === 'cancelled' || b.status === 'refunded') {
      agg.cancellations += 1
    } else {
      agg.bookings += 1
      agg.guests += b.partySize
      const customer = customerById.get(b.customerId)
      if (customer && customer.totalBookings > 1) agg.repeatBookings += 1
      const lead = (new Date(b.departureAt).getTime() - new Date(b.createdAt).getTime()) / DAY_MS
      if (lead >= 0) {
        agg.leadSum += lead
        agg.leadCount += 1
      }
    }
    if (b.rating !== undefined) {
      agg.ratingSum += b.rating
      agg.ratingCount += 1
    }
  }

  for (const dep of departuresInRangeFast(tenantId, from, to)) {
    if (dep.status === 'cancelled') continue
    const agg = index.get(dep.startsAt.slice(0, 10))
    if (!agg) continue
    agg.capacity += dep.capacity
    agg.booked += dep.booked
  }

  return days
}

interface Totals {
  revenue: number
  bookings: number
  guests: number
  cancellations: number
  capacity: number
  booked: number
  aov: number
  occupancy: number
  cancelRate: number
  repeatRate: number
  rating: number
  leadDays: number
}

function totalsOf(days: DayAgg[]): Totals {
  let revenue = 0
  let bookings = 0
  let guests = 0
  let cancellations = 0
  let capacity = 0
  let booked = 0
  let ratingSum = 0
  let ratingCount = 0
  let leadSum = 0
  let leadCount = 0
  let repeat = 0
  for (const d of days) {
    revenue += d.revenue
    bookings += d.bookings
    guests += d.guests
    cancellations += d.cancellations
    capacity += d.capacity
    booked += d.booked
    ratingSum += d.ratingSum
    ratingCount += d.ratingCount
    leadSum += d.leadSum
    leadCount += d.leadCount
    repeat += d.repeatBookings
  }
  return {
    revenue,
    bookings,
    guests,
    cancellations,
    capacity,
    booked,
    aov: bookings === 0 ? 0 : Math.round(revenue / bookings),
    occupancy: capacity === 0 ? 0 : (booked / capacity) * 100,
    cancelRate: bookings + cancellations === 0 ? 0 : (cancellations / (bookings + cancellations)) * 100,
    repeatRate: bookings === 0 ? 0 : (repeat / bookings) * 100,
    rating: ratingCount === 0 ? 0 : ratingSum / ratingCount,
    leadDays: leadCount === 0 ? 0 : leadSum / leadCount,
  }
}

const PRESET_DAYS: Record<RangePreset, number> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  mtd: 0,
  qtd: 0,
  ytd: 0,
  custom: 30,
}

const PRESET_LABELS: Record<RangePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  mtd: 'Month to date',
  qtd: 'Quarter to date',
  ytd: 'Year to date',
  custom: 'Custom range',
}

function rangeFor(preset: RangePreset): { from: Date; to: Date; days: number } {
  const to = startOfDay(NOW)
  let from: Date
  if (preset === 'mtd') from = startOfMonth(NOW)
  else if (preset === 'qtd') from = new Date(NOW.getFullYear(), Math.floor(NOW.getMonth() / 3) * 3, 1)
  else if (preset === 'ytd') from = new Date(NOW.getFullYear(), 0, 1)
  else from = startOfDay(addDays(NOW, -(PRESET_DAYS[preset] - 1)))
  const days = Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1
  return { from, to, days }
}

function resample(values: number[], target: number): number[] {
  if (values.length <= target) return values.map((v) => Math.round(v * 100) / 100)
  const out: number[] = []
  const bucket = values.length / target
  for (let i = 0; i < target; i++) {
    const s = Math.floor(i * bucket)
    const e = Math.max(s + 1, Math.floor((i + 1) * bucket))
    out.push(Math.round(average(values.slice(s, e)) * 100) / 100)
  }
  return out
}

function directionOf(delta: number, higherIsBetter: boolean): TrendDirection {
  if (Math.abs(delta) < 0.35) return 'flat'
  const up = delta > 0
  return higherIsBetter ? (up ? 'up' : 'down') : up ? 'up' : 'down'
}

const analyticsCache = new Map<string, AnalyticsSnapshot>()

export function getAnalytics(tenantId: string, preset: RangePreset = '30d'): AnalyticsSnapshot {
  const cacheKey = `${tenantId}::${preset}`
  const hit = analyticsCache.get(cacheKey)
  if (hit) return hit
  const snapshot = buildAnalytics(tenantId, preset)
  analyticsCache.set(cacheKey, snapshot)
  return snapshot
}

export function getKpis(tenantId: string, preset: RangePreset = '30d'): KpiMetric[] {
  return getAnalytics(tenantId, preset).kpis
}

function buildAnalytics(tenantId: string, preset: RangePreset): AnalyticsSnapshot {
  const tenant = tenantById.get(tenantId) ?? CURRENT_TENANT
  const currency = tenant.currency
  const raw = rangeFor(preset)
  const horizonStart = dataStartByTenant.get(tenantId)
  const from =
    horizonStart !== undefined && startOfDay(raw.from).getTime() < horizonStart
      ? new Date(horizonStart)
      : raw.from
  const to = raw.to
  const rangeDays = Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS) + 1
  const prevTo = addDays(from, -1)
  const prevFrom = addDays(prevTo, -(rangeDays - 1))

  const days = collectDays(tenantId, from, to)
  const prevDays = collectDays(tenantId, prevFrom, prevTo)
  const cur = totalsOf(days)
  const prevRaw = totalsOf(prevDays)

  /*
   * The comparison window can reach past the generated horizon (a year-to-date
   * range has no prior year behind it). Measure how much of it actually holds
   * data: fully covered windows compare directly, partly covered ones are
   * scaled up to a full period, and a window with almost nothing behind it is
   * reported honestly as having no comparison rather than a fake delta.
   */
  const dataStart = dataStartByTenant.get(tenantId) ?? startOfDay(from).getTime()
  const coveredMs = startOfDay(prevTo).getTime() - Math.max(startOfDay(prevFrom).getTime(), dataStart)
  const coveredDays = clamp(Math.floor(coveredMs / DAY_MS) + 1, 0, rangeDays)
  const coverage = rangeDays === 0 ? 1 : coveredDays / rangeDays
  const comparable = coverage >= 0.45
  const scale = comparable && coverage < 1 ? 1 / coverage : 1
  const prev: Totals = {
    ...prevRaw,
    revenue: Math.round(prevRaw.revenue * scale),
    bookings: Math.round(prevRaw.bookings * scale),
    guests: Math.round(prevRaw.guests * scale),
    cancellations: Math.round(prevRaw.cancellations * scale),
  }

  /* ---- sparkline window: always at least 24 buckets of context ---- */
  const sparkDays = Math.max(rangeDays, 24)
  const sparkSeries =
    sparkDays === rangeDays ? days : collectDays(tenantId, addDays(to, -(sparkDays - 1)), to)
  const spark = {
    revenue: resample(sparkSeries.map((d) => Math.round(d.revenue / 100)), 24),
    bookings: resample(sparkSeries.map((d) => d.bookings), 24),
    guests: resample(sparkSeries.map((d) => d.guests), 24),
    aov: resample(sparkSeries.map((d) => (d.bookings === 0 ? 0 : d.revenue / d.bookings / 100)), 24),
    occupancy: resample(
      sparkSeries.map((d) => (d.capacity === 0 ? 0 : (d.booked / d.capacity) * 100)),
      24,
    ),
    cancelRate: resample(
      sparkSeries.map((d) =>
        d.bookings + d.cancellations === 0 ? 0 : (d.cancellations / (d.bookings + d.cancellations)) * 100,
      ),
      24,
    ),
    repeatRate: resample(
      sparkSeries.map((d) => (d.bookings === 0 ? 0 : (d.repeatBookings / d.bookings) * 100)),
      24,
    ),
    rating: resample(
      sparkSeries.map((d) => (d.ratingCount === 0 ? 0 : d.ratingSum / d.ratingCount)),
      24,
    ),
    lead: resample(
      sparkSeries.map((d) => (d.leadCount === 0 ? 0 : d.leadSum / d.leadCount)),
      24,
    ),
  }

  const comparisonLabel = !comparable
    ? 'no comparable prior period'
    : preset === 'today'
      ? 'vs yesterday'
      : scale > 1
        ? `vs previous ${rangeDays} days (part-period)`
        : `vs previous ${rangeDays} ${rangeDays === 1 ? 'day' : 'days'}`

  const kpi = (
    key: string,
    label: string,
    value: number,
    prevValue: number,
    format: KpiMetric['format'],
    sparkline: number[],
    higherIsBetter: boolean,
    hint: string,
  ): KpiMetric => {
    const deltaPercent = comparable ? Math.round(percentChange(value, prevValue) * 10) / 10 : 0
    return {
      key,
      label,
      value,
      format,
      deltaPercent,
      direction: comparable ? directionOf(deltaPercent, higherIsBetter) : 'flat',
      higherIsBetter,
      comparisonLabel,
      sparkline,
      currency: format === 'currency' ? currency : undefined,
      hint,
    }
  }

  const kpis: KpiMetric[] = [
    kpi('net_revenue', 'Net Revenue', cur.revenue, prev.revenue, 'currency', spark.revenue, true,
      'Ticket, add-on, fee and tax revenue net of refunds, attributed to the departure date.'),
    kpi('bookings', 'Bookings', cur.bookings, prev.bookings, 'number', spark.bookings, true,
      'Confirmed, checked-in and completed bookings departing in this range.'),
    kpi('guests', 'Guests', cur.guests, prev.guests, 'number', spark.guests, true,
      'Total seats sold across all departures in this range.'),
    kpi('aov', 'Average Order Value', cur.aov, prev.aov, 'currency', spark.aov, true,
      'Net revenue divided by booking count.'),
    kpi('occupancy', 'Capacity Utilisation', Math.round(cur.occupancy * 10) / 10,
      Math.round(prev.occupancy * 10) / 10, 'percent', spark.occupancy, true,
      'Seats sold as a share of seats offered on departures that ran.'),
    kpi('cancellation_rate', 'Cancellation Rate', Math.round(cur.cancelRate * 10) / 10,
      Math.round(prev.cancelRate * 10) / 10, 'percent', spark.cancelRate, false,
      'Cancelled and refunded bookings as a share of all bookings.'),
    kpi('repeat_rate', 'Repeat Guest Rate', Math.round(cur.repeatRate * 10) / 10,
      Math.round(prev.repeatRate * 10) / 10, 'percent', spark.repeatRate, true,
      'Share of bookings placed by guests with more than one booking on file.'),
    kpi('avg_rating', 'Average Rating', Math.round(cur.rating * 100) / 100,
      Math.round(prev.rating * 100) / 100, 'rating', spark.rating, true,
      'Mean guest rating left against departures in this range.'),
    kpi('lead_time', 'Average Lead Time', Math.round(cur.leadDays * 10) / 10,
      Math.round(prev.leadDays * 10) / 10, 'number', spark.lead, true,
      'Days between a booking being placed and the departure it is for.'),
  ]

  /* ---- timeseries ---- */
  const timeseries: TimeSeriesPoint[] = days.map((d, i) => ({
    date: d.date,
    revenue: d.revenue,
    bookings: d.bookings,
    guests: d.guests,
    occupancy: d.capacity === 0 ? 0 : Math.round((d.booked / d.capacity) * 1000) / 10,
    prevRevenue: prevDays[i]?.revenue ?? 0,
    cancellations: d.cancellations,
    avgOrderValue: d.bookings === 0 ? 0 : Math.round(d.revenue / d.bookings),
  }))

  /* ---- channels ---- */
  const rangeBookings = bookingsInRange(tenantId, from, to)
  const prevBookings = bookingsInRange(tenantId, prevFrom, prevTo)
  const chanCur = new Map<BookingChannel, { bookings: number; revenue: number }>()
  const chanPrev = new Map<BookingChannel, number>()
  for (const b of rangeBookings) {
    if (b.status === 'cancelled' || b.status === 'refunded') continue
    const e = chanCur.get(b.channel) ?? { bookings: 0, revenue: 0 }
    e.bookings += 1
    e.revenue += b.total - (b.refundAmount ?? 0)
    chanCur.set(b.channel, e)
  }
  for (const b of prevBookings) {
    if (b.status === 'cancelled' || b.status === 'refunded') continue
    chanPrev.set(b.channel, (chanPrev.get(b.channel) ?? 0) + (b.total - (b.refundAmount ?? 0)))
  }
  const channelRevenueTotal = sum([...chanCur.values()].map((e) => e.revenue)) || 1
  const channels: ChannelBreakdown[] = [...chanCur.entries()]
    .map(([channel, e]) => ({
      channel,
      label: CHANNEL_LABELS[channel],
      bookings: e.bookings,
      revenue: e.revenue,
      share: Math.round((e.revenue / channelRevenueTotal) * 1000) / 10,
      deltaPercent: Math.round(percentChange(e.revenue, chanPrev.get(channel) ?? 0) * 10) / 10,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  /* ---- activity performance ---- */
  const actCur = new Map<string, { bookings: number; revenue: number; ratingSum: number; ratingCount: number }>()
  const actPrev = new Map<string, number>()
  for (const b of rangeBookings) {
    if (b.status === 'cancelled' || b.status === 'refunded') continue
    const e = actCur.get(b.activityId) ?? { bookings: 0, revenue: 0, ratingSum: 0, ratingCount: 0 }
    e.bookings += 1
    e.revenue += b.total - (b.refundAmount ?? 0)
    if (b.rating !== undefined) {
      e.ratingSum += b.rating
      e.ratingCount += 1
    }
    actCur.set(b.activityId, e)
  }
  for (const b of prevBookings) {
    if (b.status === 'cancelled' || b.status === 'refunded') continue
    actPrev.set(b.activityId, (actPrev.get(b.activityId) ?? 0) + (b.total - (b.refundAmount ?? 0)))
  }
  const occByActivity = new Map<string, { booked: number; capacity: number; soldOut: number; total: number }>()
  for (const dep of departuresInRangeFast(tenantId, from, to)) {
    if (dep.status === 'cancelled') continue
    const e = occByActivity.get(dep.activityId) ?? { booked: 0, capacity: 0, soldOut: 0, total: 0 }
    e.booked += dep.booked
    e.capacity += dep.capacity
    e.total += 1
    if (dep.status === 'sold_out' || dep.booked >= dep.capacity) e.soldOut += 1
    occByActivity.set(dep.activityId, e)
  }
  const topActivities: ActivityPerformance[] = [...actCur.entries()]
    .map(([activityId, e]) => {
      const activity = activityById.get(activityId)!
      const occ = occByActivity.get(activityId)
      return {
        activityId,
        name: activity.name,
        bookings: e.bookings,
        revenue: e.revenue,
        occupancy: occ && occ.capacity > 0 ? Math.round((occ.booked / occ.capacity) * 1000) / 10 : 0,
        rating: e.ratingCount === 0 ? activity.rating : Math.round((e.ratingSum / e.ratingCount) * 100) / 100,
        deltaPercent: Math.round(percentChange(e.revenue, actPrev.get(activityId) ?? 0) * 10) / 10,
        colorKey: activity.colorKey,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)

  /* ---- funnel (anchored on real completed bookings) ---- */
  const completed = cur.bookings
  const paymentStep = Math.round(completed / 0.78)
  const checkoutStep = Math.round(paymentStep / 0.64)
  const activityViews = Math.round(checkoutStep / 0.21)
  const storefrontViews = Math.round(activityViews / 0.58)
  const rawFunnel: [string, string, number][] = [
    ['storefront', 'Storefront visits', storefrontViews],
    ['activity', 'Activity page views', activityViews],
    ['checkout', 'Checkout started', checkoutStep],
    ['payment', 'Payment details entered', paymentStep],
    ['booked', 'Bookings completed', completed],
  ]
  const funnel: FunnelStage[] = rawFunnel.map(([key, label, value], i) => ({
    key,
    label,
    value,
    conversionRate:
      i === 0 ? 100 : Math.round((value / Math.max(1, rawFunnel[i - 1][2])) * 1000) / 10,
  }))

  /* ---- heatmap: trailing 90 days of real departures ---- */
  const heatFrom = addDays(startOfDay(NOW), -89)
  const heatCells = new Map<string, HeatmapCell>()
  for (let w = 0; w < 7; w++) {
    for (let h = 6; h <= 21; h++) {
      heatCells.set(`${w}:${h}`, { weekday: w, hour: h, occupancy: 0, bookings: 0, revenue: 0 })
    }
  }
  const heatAcc = new Map<string, { booked: number; capacity: number }>()
  for (const dep of departuresInRangeFast(tenantId, heatFrom, startOfDay(NOW))) {
    if (dep.status === 'cancelled') continue
    const start = new Date(dep.startsAt)
    const w = mondayIndex(start)
    const h = clamp(start.getHours(), 6, 21)
    const key = `${w}:${h}`
    const cell = heatCells.get(key)
    if (!cell) continue
    const acc = heatAcc.get(key) ?? { booked: 0, capacity: 0 }
    acc.booked += dep.booked
    acc.capacity += dep.capacity
    heatAcc.set(key, acc)
    for (const b of bookingsByDeparture.get(dep.id) ?? []) {
      if (b.status === 'cancelled' || b.status === 'refunded') continue
      cell.bookings += 1
      cell.revenue += b.total - (b.refundAmount ?? 0)
    }
  }
  for (const [key, acc] of heatAcc) {
    const cell = heatCells.get(key)!
    cell.occupancy = acc.capacity === 0 ? 0 : Math.round((acc.booked / acc.capacity) * 1000) / 10
  }
  const heatmap: HeatmapCell[] = [...heatCells.values()]

  /* ---- geo ---- */
  const geoAcc = new Map<string, { bookings: number; revenue: number }>()
  for (const b of rangeBookings) {
    if (b.status === 'cancelled' || b.status === 'refunded') continue
    const c = customerById.get(b.customerId)
    if (!c) continue
    const e = geoAcc.get(c.country) ?? { bookings: 0, revenue: 0 }
    e.bookings += 1
    e.revenue += b.total - (b.refundAmount ?? 0)
    geoAcc.set(c.country, e)
  }
  const geoTotal = sum([...geoAcc.values()].map((e) => e.bookings)) || 1
  const geo: GeoSource[] = [...geoAcc.entries()]
    .map(([countryCode, e]) => ({
      country: COUNTRY_NAME_BY_CODE.get(countryCode) ?? countryCode,
      countryCode,
      bookings: e.bookings,
      revenue: e.revenue,
      share: Math.round((e.bookings / geoTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 10)

  /* ---- cohorts: first-booking month, retention by month offset ---- */
  const cohortMonths: string[] = []
  for (let i = 5; i >= 0; i--) {
    const m = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
    cohortMonths.push(`${m.getFullYear()}-${pad2(m.getMonth() + 1)}`)
  }
  const firstMonthByCustomer = new Map<string, string>()
  const monthsByCustomer = new Map<string, Set<string>>()
  for (const b of bookingsByTenant.get(tenantId) ?? []) {
    if (b.status === 'cancelled') continue
    const month = b.createdAt.slice(0, 7)
    const prevFirst = firstMonthByCustomer.get(b.customerId)
    if (!prevFirst || month < prevFirst) firstMonthByCustomer.set(b.customerId, month)
    const set = monthsByCustomer.get(b.customerId) ?? new Set<string>()
    set.add(month)
    monthsByCustomer.set(b.customerId, set)
  }
  const cohorts: CohortRow[] = cohortMonths.map((month, mi) => {
    const members: string[] = []
    for (const [cid, first] of firstMonthByCustomer) if (first === month) members.push(cid)
    const depth = cohortMonths.length - mi
    const retention: number[] = []
    for (let k = 0; k < depth; k++) {
      const target = cohortMonths[mi + k]
      let count = 0
      for (const cid of members) if (monthsByCustomer.get(cid)?.has(target)) count += 1
      retention.push(members.length === 0 ? 0 : Math.round((count / members.length) * 1000) / 10)
    }
    return { cohort: month, size: members.length, retention }
  })

  const insights = buildInsights({
    tenant,
    preset,
    cur,
    prev,
    rangeDays,
    channels,
    topActivities,
    heatmap,
    occByActivity,
    currency,
  })

  const snapshot: AnalyticsSnapshot = {
    tenantId,
    rangeLabel: PRESET_LABELS[preset],
    kpis,
    timeseries,
    channels,
    topActivities,
    funnel,
    heatmap,
    geo,
    cohorts,
    insights,
  }
  return snapshot
}

/* ==========================================================================
   INSIGHTS — computed from the numbers above, never invented
   ========================================================================== */

const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function hourLabel(h: number) {
  const suffix = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  return `${hh}${suffix}`
}

function buildInsights(ctx: {
  tenant: Tenant
  preset: RangePreset
  cur: Totals
  prev: Totals
  rangeDays: number
  channels: ChannelBreakdown[]
  topActivities: ActivityPerformance[]
  heatmap: HeatmapCell[]
  occByActivity: Map<string, { booked: number; capacity: number; soldOut: number; total: number }>
  currency: CurrencyCode
}): Insight[] {
  const { tenant, cur, prev, channels, topActivities, heatmap, occByActivity, currency } = ctx
  const out: Insight[] = []

  /* 1 — the slot-gap play */
  const busyCells = heatmap.filter((c) => c.bookings >= 8)
  if (busyCells.length >= 4) {
    const best = busyCells.reduce((a, b) => (b.occupancy > a.occupancy ? b : a))
    const worst = busyCells.reduce((a, b) => (b.occupancy < a.occupancy ? b : a))
    const gap = best.occupancy - worst.occupancy
    if (gap > 15) {
      const seatValue = worst.bookings > 0 ? worst.revenue / Math.max(1, worst.bookings) : cur.aov
      const monthlyUplift = Math.round((gap / 100) * 6 * 4.3 * seatValue)
      out.push({
        id: 'ins_slot_gap',
        severity: 'positive',
        title: `${WEEKDAY_NAMES[best.weekday]} ${hourLabel(best.hour)} runs at ${best.occupancy.toFixed(0)}% while ${WEEKDAY_NAMES[worst.weekday]} ${hourLabel(worst.hour)} sits at ${worst.occupancy.toFixed(0)}%`,
        body: `Across the last 90 days the ${WEEKDAY_NAMES[best.weekday]} ${hourLabel(best.hour)} slot filled ${gap.toFixed(0)} points higher than ${WEEKDAY_NAMES[worst.weekday]} ${hourLabel(worst.hour)}. Moving one ${WEEKDAY_NAMES[worst.weekday]} departure into the ${WEEKDAY_NAMES[best.weekday]} window would recover roughly ${formatCurrency(monthlyUplift, currency)} a month at your current average seat value.`,
        metric: `+${formatCurrency(monthlyUplift, currency, { compact: true })}/mo`,
        href: '/dashboard/calendar',
        actionLabel: 'Open the calendar',
      })
    }
  }

  /* 2 — sell-out pressure: where capacity is the binding constraint */
  let pressure: { id: string; soldOut: number; total: number; occ: number } | undefined
  for (const [activityId, e] of occByActivity) {
    if (e.total < 6 || e.capacity === 0) continue
    const occ = (e.booked / e.capacity) * 100
    if (!pressure || e.soldOut > pressure.soldOut) pressure = { id: activityId, soldOut: e.soldOut, total: e.total, occ }
  }
  if (pressure && pressure.soldOut >= 3) {
    const activity = activityById.get(pressure.id)!
    const turnaways = Math.round(pressure.soldOut * activity.maxCapacity * 0.18)
    const value = turnaways * activity.basePrice
    out.push({
      id: 'ins_sellout',
      severity: 'warning',
      title: `${activity.name} sold out ${pressure.soldOut} of ${pressure.total} departures`,
      body: `It has been running at ${pressure.occ.toFixed(0)}% of capacity. At a conservative 18% turn-away rate that is about ${turnaways} guests you could not seat — roughly ${formatCurrency(value, currency)} of demand. Adding a second daily departure or a larger vessel on peak days is the fastest revenue available to you.`,
      metric: `${formatCurrency(value, currency, { compact: true })} unmet`,
      href: `/dashboard/activities/${activity.slug}`,
      actionLabel: 'Adjust capacity',
    })
  }

  /* 3 — top performer */
  if (topActivities.length > 0) {
    const top = topActivities[0]
    const share = cur.revenue === 0 ? 0 : (top.revenue / cur.revenue) * 100
    out.push({
      id: 'ins_top_activity',
      severity: top.deltaPercent >= 0 ? 'positive' : 'neutral',
      title: `${top.name} is ${share.toFixed(0)}% of net revenue`,
      body: `${formatCurrency(top.revenue, currency)} across ${formatNumber(top.bookings)} bookings at ${top.occupancy.toFixed(0)}% occupancy, ${top.deltaPercent >= 0 ? 'up' : 'down'} ${Math.abs(top.deltaPercent).toFixed(1)}% on the previous period. Concentration this high is a risk as much as a strength — the second-placed product is ${topActivities[1] ? `${topActivities[1].name} at ${formatCurrency(topActivities[1].revenue, currency, { compact: true })}` : 'a long way behind'}.`,
      metric: `${share.toFixed(0)}% of revenue`,
      href: '/dashboard/analytics',
      actionLabel: 'See the breakdown',
    })
  }

  /* 4 — channel movement */
  const movers = channels.filter((c) => c.bookings >= 5)
  if (movers.length > 1) {
    const best = movers.reduce((a, b) => (b.deltaPercent > a.deltaPercent ? b : a))
    const worst = movers.reduce((a, b) => (b.deltaPercent < a.deltaPercent ? b : a))
    out.push({
      id: 'ins_channel',
      severity: best.deltaPercent > 0 ? 'positive' : 'warning',
      title: `${best.label} revenue moved ${best.deltaPercent >= 0 ? 'up' : 'down'} ${Math.abs(best.deltaPercent).toFixed(1)}%`,
      body: `${best.label} now carries ${best.share.toFixed(0)}% of net revenue (${formatCurrency(best.revenue, currency)} from ${best.bookings} bookings), while ${worst.label} moved ${worst.deltaPercent.toFixed(1)}%. Shifting spend toward the channel with the lower effective commission is worth modelling before the next peak.`,
      metric: `${best.share.toFixed(0)}% share`,
      href: '/dashboard/analytics',
      actionLabel: 'Compare channels',
    })
  }

  /* 5 — cancellations */
  const cancelDelta = cur.cancelRate - prev.cancelRate
  out.push({
    id: 'ins_cancellations',
    severity: cur.cancelRate > 9 ? 'critical' : cancelDelta > 1 ? 'warning' : 'positive',
    title: `Cancellation rate is ${cur.cancelRate.toFixed(1)}%, ${cancelDelta >= 0 ? 'up' : 'down'} ${Math.abs(cancelDelta).toFixed(1)} points`,
    body: `${formatNumber(cur.cancellations)} of ${formatNumber(cur.bookings + cur.cancellations)} bookings were cancelled or refunded, against ${prev.cancelRate.toFixed(1)}% in the previous period. Weather-driven operator cancellations are the largest single cause — tightening the go/no-go call to 18 hours out would let guests rebook instead of refunding.`,
    metric: `${formatNumber(cur.cancellations)} cancelled`,
    href: '/dashboard/bookings?status=cancelled',
    actionLabel: 'Review cancellations',
  })

  /* 6 — lead time / early-bird */
  out.push({
    id: 'ins_leadtime',
    severity: 'neutral',
    title: `Guests book ${cur.leadDays.toFixed(1)} days ahead on average`,
    body: `Average lead time moved from ${prev.leadDays.toFixed(1)} to ${cur.leadDays.toFixed(1)} days. With ${tenant.stats.activeActivities} live products and an average order of ${formatCurrency(cur.aov, currency)}, an early-bird price released ${Math.max(14, Math.round(cur.leadDays * 2))} days out would pull demand forward into the slots that currently fill last.`,
    metric: `${cur.leadDays.toFixed(1)} days`,
    href: '/dashboard/analytics',
    actionLabel: 'Model the offer',
  })

  return out
}

/* ==========================================================================
   PLATFORM CHROME — notifications, activity feed, search
   ========================================================================== */

const feedCache = new Map<string, ActivityFeedItem[]>()

export function getActivityFeed(tenantId: string, limit = 14): ActivityFeedItem[] {
  const cached = feedCache.get(tenantId)
  if (cached) return cached.slice(0, limit)

  const source = (bookingsByTenant.get(tenantId) ?? []).slice(0, 90)
  const items: ActivityFeedItem[] = []
  for (const b of source) {
    const customer = customerById.get(b.customerId)
    const activity = activityById.get(b.activityId)
    if (!customer || !activity) continue
    const actor = `${customer.firstName} ${customer.lastName}`
    if (b.status === 'cancelled') {
      items.push({
        id: `feed_${b.id}_c`,
        tenantId,
        actor,
        actorAvatar: customer.avatarUrl,
        verb: 'cancelled a booking for',
        target: activity.name,
        createdAt: b.cancelledAt ?? b.updatedAt,
        kind: 'cancellation',
        amount: b.refundAmount,
        currency: b.currency,
      })
    } else if (b.rating !== undefined) {
      items.push({
        id: `feed_${b.id}_r`,
        tenantId,
        actor,
        actorAvatar: customer.avatarUrl,
        verb: `left a ${b.rating}-star review for`,
        target: activity.name,
        createdAt: b.updatedAt,
        kind: 'review',
      })
    } else {
      items.push({
        id: `feed_${b.id}_b`,
        tenantId,
        actor,
        actorAvatar: customer.avatarUrl,
        verb: b.partySize > 1 ? `booked ${b.partySize} seats on` : 'booked a seat on',
        target: activity.name,
        createdAt: b.createdAt,
        kind: b.paymentStatus === 'paid' ? 'payment' : 'booking',
        amount: b.total,
        currency: b.currency,
      })
    }
  }
  items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  feedCache.set(tenantId, items)
  return items.slice(0, limit)
}

const notificationCache = new Map<string, NotificationItem[]>()

export function getNotifications(tenantId: string): NotificationItem[] {
  const cached = notificationCache.get(tenantId)
  if (cached) return cached

  const tenant = tenantById.get(tenantId) ?? CURRENT_TENANT
  const recent = (bookingsByTenant.get(tenantId) ?? []).slice(0, 140)
  const out: NotificationItem[] = []

  const bigBooking = recent.find((b) => b.partySize >= 4 && b.status !== 'cancelled')
  if (bigBooking) {
    const c = customerById.get(bigBooking.customerId)
    const a = activityById.get(bigBooking.activityId)
    out.push({
      id: `ntf_${bigBooking.id}`,
      tenantId,
      kind: 'booking',
      title: `New booking — ${formatCurrency(bigBooking.total, bigBooking.currency)}`,
      body: `${c ? `${c.firstName} ${c.lastName}` : 'A guest'} booked ${bigBooking.partySize} seats on ${a?.name ?? 'an activity'} (${bigBooking.reference}).`,
      createdAt: bigBooking.createdAt,
      read: false,
      href: `/dashboard/bookings/${bigBooking.id}`,
      severity: 'success',
    })
  }

  const review = recent.find((b) => b.rating !== undefined && b.reviewText)
  if (review) {
    const c = customerById.get(review.customerId)
    const a = activityById.get(review.activityId)
    out.push({
      id: `ntf_${review.id}_r`,
      tenantId,
      kind: 'review',
      title: `${review.rating}-star review for ${a?.name ?? 'your activity'}`,
      body: `${c?.firstName ?? 'A guest'} wrote: “${review.reviewText}”`,
      createdAt: review.updatedAt,
      read: false,
      href: `/dashboard/bookings/${review.id}`,
      severity: review.rating !== undefined && review.rating >= 4 ? 'success' : 'warning',
    })
  }

  const upcoming = getUpcomingDepartures(tenantId, 40)
  const soldOut = upcoming.find((d) => d.status === 'sold_out')
  if (soldOut) {
    const a = activityById.get(soldOut.activityId)
    out.push({
      id: `ntf_${soldOut.id}_so`,
      tenantId,
      kind: 'capacity',
      title: `${a?.name ?? 'Departure'} is sold out`,
      body: `${soldOut.startsAt.slice(11, 16)} on ${soldOut.startsAt.slice(0, 10)} is full at ${soldOut.capacity} seats. ${tenant.features.waitlists ? 'The waitlist is open and already collecting names.' : 'Turn on waitlists to capture the overflow.'}`,
      createdAt: isoLocal(addDays(NOW, -1)),
      read: false,
      href: '/dashboard/calendar',
      severity: 'info',
    })
  }

  const hold = upcoming.find((d) => d.status === 'weather_hold')
  if (hold) {
    const a = activityById.get(hold.activityId)
    out.push({
      id: `ntf_${hold.id}_wx`,
      tenantId,
      kind: 'system',
      title: `Weather hold on ${a?.name ?? 'a departure'}`,
      body: `${hold.startsAt.slice(0, 10)} ${hold.startsAt.slice(11, 16)} is on hold — ${hold.weather ? `${hold.weather.windKts} kt wind, go-confidence ${hold.weather.goConfidence}%` : 'conditions under review'}. ${hold.booked} guests are booked and need a decision by 16:00 today.`,
      createdAt: isoLocal(addDays(NOW, -1)),
      read: false,
      href: '/dashboard/calendar',
      severity: 'warning',
    })
  }

  const cancelled = recent.find((b) => b.status === 'cancelled' && b.refundAmount)
  if (cancelled) {
    const c = customerById.get(cancelled.customerId)
    out.push({
      id: `ntf_${cancelled.id}_x`,
      tenantId,
      kind: 'cancellation',
      title: `Refund issued — ${formatCurrency(cancelled.refundAmount ?? 0, cancelled.currency)}`,
      body: `${c ? `${c.firstName} ${c.lastName}` : 'A guest'} cancelled ${cancelled.reference}. Reason: ${cancelled.cancellationReason ?? 'not given'}.`,
      createdAt: cancelled.cancelledAt ?? cancelled.updatedAt,
      read: true,
      href: `/dashboard/bookings/${cancelled.id}`,
      severity: 'danger',
    })
  }

  const unpaid = recent.find((b) => b.paymentStatus === 'unpaid' && b.status === 'confirmed')
  if (unpaid) {
    out.push({
      id: `ntf_${unpaid.id}_p`,
      tenantId,
      kind: 'payment',
      title: 'Payment outstanding',
      body: `${unpaid.reference} is confirmed but unpaid — ${formatCurrency(unpaid.total, unpaid.currency)} due before departure on ${unpaid.departureAt.slice(0, 10)}.`,
      createdAt: unpaid.updatedAt,
      read: true,
      href: `/dashboard/bookings/${unpaid.id}`,
      severity: 'warning',
    })
  }

  const deposit = recent.find((b) => b.paymentStatus === 'deposit_paid')
  if (deposit) {
    out.push({
      id: `ntf_${deposit.id}_d`,
      tenantId,
      kind: 'payment',
      title: `Deposit received — ${formatCurrency(deposit.amountPaid, deposit.currency)}`,
      body: `Balance of ${formatCurrency(deposit.total - deposit.amountPaid, deposit.currency)} on ${deposit.reference} is collected automatically 48 hours before departure.`,
      createdAt: deposit.createdAt,
      read: true,
      href: `/dashboard/bookings/${deposit.id}`,
      severity: 'info',
    })
  }

  const maintenance = (resourcesByTenant.get(tenantId) ?? []).find((r) => r.status === 'maintenance')
  if (maintenance) {
    out.push({
      id: `ntf_${maintenance.id}_m`,
      tenantId,
      kind: 'system',
      title: `${maintenance.name} is out of service`,
      body: maintenance.notes ?? 'Scheduled maintenance — departures using this resource need reassigning.',
      createdAt: isoLocal(addDays(NOW, -3)),
      read: true,
      href: '/dashboard/resources',
      severity: 'warning',
    })
  }

  out.push({
    id: 'ntf_system_payouts',
    tenantId,
    kind: 'system',
    title: 'Payout scheduled',
    body: `${formatCurrency(Math.round(tenant.stats.monthlyRevenue * 0.23), tenant.currency)} lands in your account on ${toDateKey(addDays(NOW, 2))}. Processor fees for the period are itemised in the payouts report.`,
    createdAt: isoLocal(addDays(NOW, -2)),
    read: true,
    href: '/dashboard/payments',
    severity: 'info',
  })

  out.push({
    id: 'ntf_system_plan',
    tenantId,
    kind: 'system',
    title: `You are on the ${tenant.plan} plan`,
    body: tenant.features.dynamicPricing
      ? 'Dynamic pricing is active on departures above 85% capacity.'
      : 'Dynamic pricing and the channel manager unlock on Scale — most operators see a 6-9% lift in average order value.',
    createdAt: isoLocal(addDays(NOW, -6)),
    read: true,
    href: '/dashboard/settings/billing',
    severity: 'info',
  })

  out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  notificationCache.set(tenantId, out)
  return out
}

export interface SearchResults {
  activities: Activity[]
  bookings: BookingRow[]
  customers: Customer[]
}

export function searchEverything(tenantId: string, query: string): SearchResults {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return { activities: [], bookings: [], customers: [] }

  const activities = (activitiesByTenant.get(tenantId) ?? [])
    .filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        a.slug.includes(q) ||
        a.category.includes(q),
    )
    .slice(0, 6)

  const customers = (customersByTenant.get(tenantId) ?? [])
    .filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.replace(/\s/g, '').includes(q.replace(/\s/g, '')),
    )
    .slice(0, 6)

  const bookings: BookingRow[] = []
  for (const row of getBookingRows(tenantId)) {
    if (bookings.length >= 6) break
    const { booking, customer, activity } = row
    if (
      booking.reference.toLowerCase().includes(q) ||
      `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(q) ||
      customer.email.toLowerCase().includes(q) ||
      activity.name.toLowerCase().includes(q)
    ) {
      bookings.push(row)
    }
  }

  return { activities, bookings, customers }
}

/* ==========================================================================
   DASHBOARD HOME
   ========================================================================== */

export interface DashboardOverview {
  kpis: KpiMetric[]
  timeseries: TimeSeriesPoint[]
  todayDepartures: CalendarEvent[]
  recentBookings: BookingRow[]
  upcomingDepartures: CalendarEvent[]
  insights: Insight[]
  feed: ActivityFeedItem[]
  channels: ChannelBreakdown[]
  topActivities: ActivityPerformance[]
}

const overviewCache = new Map<string, DashboardOverview>()

export function getDashboardOverview(tenantId: string): DashboardOverview {
  const cached = overviewCache.get(tenantId)
  if (cached) return cached
  const analytics = getAnalytics(tenantId, '30d')
  const overview: DashboardOverview = {
    kpis: analytics.kpis,
    timeseries: analytics.timeseries,
    todayDepartures: getDeparturesForDay(tenantId, NOW).map(toCalendarEvent),
    recentBookings: getBookingRows(tenantId).slice(0, 8),
    upcomingDepartures: getUpcomingDepartures(tenantId, 6).map(toCalendarEvent),
    insights: analytics.insights,
    feed: getActivityFeed(tenantId, 14),
    channels: analytics.channels,
    topActivities: analytics.topActivities.slice(0, 6),
  }
  overviewCache.set(tenantId, overview)
  return overview
}

/* ==========================================================================
   PUBLIC STOREFRONT
   ========================================================================== */

export interface Storefront {
  tenant: Tenant
  activities: Activity[]
  featured: Activity[]
}

export function getStorefront(slug: string): Storefront | undefined {
  const tenant = tenantBySlug.get(slug)
  if (!tenant) return undefined
  const activities = (activitiesByTenant.get(tenant.id) ?? []).filter((a) => a.status === 'live')
  const featured = activities.filter((a) => a.featured)
  return {
    tenant,
    activities,
    featured: featured.length > 0 ? featured : activities.slice(0, 3),
  }
}

/** Live departures for one storefront activity, from today forward. */
export function getStorefrontAvailability(activityId: string, days = 45): CalendarEvent[] {
  const activity = activityById.get(activityId)
  if (!activity) return []
  const out: CalendarEvent[] = []
  const nowIso = isoLocal(NOW)
  const limitIso = `${toDateKey(addDays(NOW, days))}T23:59:59`
  for (const d of departuresByTenant.get(activity.tenantId) ?? []) {
    if (d.activityId !== activityId) continue
    if (d.startsAt < nowIso) continue
    if (d.startsAt > limitIso) break
    if (d.status === 'cancelled') continue
    out.push(toCalendarEvent(d))
  }
  return out
}
