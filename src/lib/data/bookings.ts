/**
 * EZRA PRO — bookings.
 *
 * Every departure's `booked` count is partitioned into real parties, so for any
 * departure:
 *
 *     sum(bookings.partySize) === departure.booked
 *
 * That invariant is the whole point. It is what lets the analytics layer derive
 * occupancy, revenue per seat, channel mix and activity performance from the
 * same rows the manifest screen renders, instead of two datasets that quietly
 * disagree with each other.
 *
 * Money is arithmetic, not decoration: line items add up to `subtotal`, and
 * `total === subtotal - discountTotal + taxTotal + feeTotal` for every row.
 *
 * Two deliberate modelling decisions worth knowing before you build on this:
 *
 *  1. `departure.booked` is *gross* seats sold. A booking that was later
 *     cancelled still counts against it, exactly as it would in a real system
 *     where the seat was held and then released. Net attendance is the sum of
 *     party sizes whose status is not 'cancelled'.
 *  2. Infant tiers (price 0, `countsTowardCapacity: false`) are never sold
 *     here. They exist for the storefront widget; including them would make
 *     `participants.length` and `partySize` disagree.
 */

import type {
  Activity,
  Booking,
  BookingChannel,
  BookingLineItem,
  BookingStatus,
  Customer,
  Departure,
  Participant,
  PaymentStatus,
  PriceTier,
  VerticalKey,
} from '@/types'
import {
  bookingReference,
  clamp,
  createRng,
  hashSeed,
  rngInt,
  rngPick,
  rngWeighted,
} from '@/lib/utils'
import { NOW, seedKey } from './constants'
import { getActivityById } from './activities'
import { getDeparturesByTenant } from './departures'
import { getCustomersByTenant, pickLocalName } from './customers'
import { TENANTS } from './tenants'

const NOW_MS = NOW.getTime()
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/* ==========================================================================
   COMMERCIAL SETTINGS
   ========================================================================== */

/** Sales tax the operator adds at checkout, by tenant. */
const TAX: Record<string, { rate: number; label: string }> = {
  tnt_bluehorizon: { rate: 0.04712, label: 'Hawai‘i GET & county surcharge' },
  tnt_coralcay: { rate: 0.1, label: 'GST' },
  tnt_saltline: { rate: 0.13, label: 'VAT' },
  tnt_ridgeline: { rate: 0.15, label: 'GST' },
}

/** Booking fee percentage on channels the operator pays to process. */
const SERVICE_FEE_RATE = 0.045

/** Channels that carry a booking fee — a walk-up at the kiosk does not. */
const FEE_CHANNELS = new Set<BookingChannel>([
  'website_widget',
  'direct',
  'google',
  'concierge',
  'reseller',
])

const CHANNEL_MIX: [BookingChannel, number][] = [
  ['website_widget', 34],
  ['direct', 18],
  ['ota', 16],
  ['phone', 10],
  ['walk_in', 8],
  ['reseller', 6],
  ['concierge', 5],
  ['google', 3],
]

const SOURCES: Record<BookingChannel, string[]> = {
  website_widget: ['Storefront booking widget', 'Activity page widget', 'Embedded checkout'],
  direct: ['Direct — returning guest link', 'Email quote accepted', 'Gift card redemption'],
  ota: ['Viator', 'GetYourGuide', 'Expedia Local Expert', 'TripAdvisor Experiences', 'Klook'],
  phone: ['Inbound call', 'Callback from enquiry form', 'Reservations line'],
  walk_in: ['Harbour kiosk', 'Front desk', 'Dock walk-up'],
  reseller: ['Hotel activity desk', 'Cruise shore excursions', 'Travel agent — retail'],
  concierge: ['Resort concierge desk', 'Villa host', 'Luxury travel concierge'],
  google: ['Google Things to do', 'Google Business Profile'],
}

const PROMOS: Record<string, { code: string; percent: number }[]> = {
  tnt_bluehorizon: [
    { code: 'ALOHA10', percent: 10 },
    { code: 'KAMAAINA15', percent: 15 },
    { code: 'EARLYBIRD12', percent: 12 },
    { code: 'SUNSET20', percent: 20 },
    { code: 'OHANA10', percent: 10 },
  ],
  tnt_coralcay: [
    { code: 'REEF15', percent: 15 },
    { code: 'DRYSEASON10', percent: 10 },
    { code: 'LOCALQLD20', percent: 20 },
    { code: 'DIVEMORE12', percent: 12 },
  ],
  tnt_saltline: [
    { code: 'MEZE10', percent: 10 },
    { code: 'CALDERA15', percent: 15 },
    { code: 'SHOULDER20', percent: 20 },
  ],
  tnt_ridgeline: [
    { code: 'SOUTHERN10', percent: 10 },
    { code: 'KIWI15', percent: 15 },
    { code: 'ALPINE20', percent: 20 },
    { code: 'SHOULDER12', percent: 12 },
  ],
}

/* ==========================================================================
   PARTY SHAPE
   ========================================================================== */

type PartyProfile = 'small' | 'medium' | 'large'

/** [party size, weight] — a 49-seat catamaran attracts bigger groups than a jet ski. */
const PARTY_MIX: Record<PartyProfile, [number, number][]> = {
  small: [
    [1, 10],
    [2, 46],
    [3, 16],
    [4, 18],
    [5, 5],
    [6, 5],
  ],
  medium: [
    [1, 7],
    [2, 34],
    [3, 15],
    [4, 22],
    [5, 9],
    [6, 8],
    [8, 3],
    [10, 2],
  ],
  large: [
    [2, 24],
    [3, 14],
    [4, 26],
    [5, 10],
    [6, 12],
    [8, 8],
    [10, 4],
    [12, 2],
  ],
}

function partyProfile(activity: Activity): PartyProfile {
  if (activity.category === 'restaurants') return activity.maxCapacity >= 30 ? 'medium' : 'small'
  if (activity.maxCapacity <= 12) return 'small'
  if (activity.maxCapacity <= 28) return 'medium'
  return 'large'
}

/* ==========================================================================
   TIER SEAT MATHS
   A price tier is not always one seat: "Family Pass (2 Adults + 2 Children)"
   consumes four, "Whole Raft (up to 8)" consumes eight. Seat counts are read
   out of the authored labels so the catalogue stays the single source of truth.
   ========================================================================== */

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  eight: 8,
  ten: 10,
  twelve: 12,
}

/** The two labels that carry their party size in prose rather than digits. */
const TIER_SEAT_OVERRIDES: Record<string, number> = {
  tier_ben_lomond_summit_trek_private_guide: 4,
  tier_milford_heli_glacier_couples_private_flight: 2,
}

function tierSeats(activity: Activity, tier: PriceTier): number {
  if (!tier.countsTowardCapacity) return 0
  const override = TIER_SEAT_OVERRIDES[tier.id]
  if (override) return override

  const label = tier.label
  if (/per (guest|seat|person)/i.test(label)) return 1

  const upTo = /up to (\d+)/i.exec(label)
  if (upTo) return Number(upTo[1])

  const family = /\((\d+) adults? \+ (\d+) child/i.exec(label)
  if (family) return Number(family[1]) + Number(family[2])

  const unit = /(\d+)\s+(?:riders?|students?|divers?|guests?|walkers?|climbers?|paddlers?)\b/i.exec(
    label,
  )
  if (unit) return Number(unit[1])

  const ratio = /\(1:(\d+)\)/.exec(label)
  if (ratio) return Number(ratio[1])

  const word = /(?:of|for) (one|two|three|four|five|six|eight|ten|twelve)\b/i.exec(label)
  if (word) return WORD_NUMBERS[word[1].toLowerCase()]

  // A whole-unit product whose label carries no number takes the entire departure.
  if (activity.pricingModel === 'per_group') return activity.maxCapacity
  return 1
}

/** Products sold as one indivisible unit — the boat, the room, the aircraft. */
function isExclusive(activity: Activity): boolean {
  return activity.pricingModel === 'per_group'
}

function isChildTier(tier: PriceTier): boolean {
  return /child|keiki|youth|junior|kid/i.test(tier.label)
}

interface TierLine {
  tier: PriceTier
  quantity: number
}

function allocateShared(rng: () => number, activity: Activity, partySize: number): TierLine[] {
  const tiers = activity.priceTiers.filter((tier) => tier.countsTowardCapacity)
  const seats = new Map(tiers.map((tier) => [tier.id, tierSeats(activity, tier)]))
  const singles = tiers.filter((tier) => seats.get(tier.id) === 1)
  const packages = tiers.filter((tier) => {
    const s = seats.get(tier.id) ?? 1
    return s > 1 && s <= partySize
  })

  // A family pass or a whole-raft rate, when the party happens to fit it exactly.
  if (packages.length > 0 && rng() < 0.18) {
    const exact = packages.filter((tier) => seats.get(tier.id) === partySize)
    if (exact.length > 0) return [{ tier: rngPick(rng, exact), quantity: 1 }]
  }

  if (singles.length === 0) {
    const fit = packages.length > 0 ? packages[packages.length - 1] : tiers[0]
    const size = Math.max(1, seats.get(fit.id) ?? 1)
    return [{ tier: fit, quantity: Math.max(1, Math.round(partySize / size)) }]
  }

  // priceTiers[0] is the standard adult seat by the catalogue's own convention.
  const base = singles[0]
  const child = singles.find(isChildTier)
  const alternates = singles.filter((tier) => tier !== base && tier !== child)

  const lines: TierLine[] = []
  let remaining = partySize

  if (child && partySize >= 3 && rng() < 0.55) {
    const kids = rngInt(rng, 1, Math.min(3, remaining - 1))
    lines.push({ tier: child, quantity: kids })
    remaining -= kids
  }
  if (alternates.length > 0 && remaining > 0 && rng() < 0.24) {
    const alt = rngPick(rng, alternates)
    const n = rngInt(rng, 1, remaining)
    lines.push({ tier: alt, quantity: n })
    remaining -= n
  }
  if (remaining > 0) lines.unshift({ tier: base, quantity: remaining })

  return lines
}

function allocateExclusive(rng: () => number, activity: Activity, partySize: number): TierLine[] {
  const tiers = activity.priceTiers.filter((tier) => tier.countsTowardCapacity)
  const whole = tiers.filter((tier) => {
    const s = tierSeats(activity, tier)
    return s > 1 && s >= partySize
  })
  const perGuest = tiers.filter((tier) => tierSeats(activity, tier) === 1)

  if (whole.length > 0 && (perGuest.length === 0 || rng() < 0.7)) {
    return [{ tier: rngPick(rng, whole), quantity: 1 }]
  }
  if (perGuest.length > 0) return [{ tier: rngPick(rng, perGuest), quantity: partySize }]
  return [{ tier: tiers[0], quantity: 1 }]
}

/* ==========================================================================
   PEOPLE
   ========================================================================== */

const PARTICIPANT_NOTES = [
  'Vegetarian meal requested',
  'Shellfish allergy — kitchen notified',
  'Non-swimmer, needs a flotation vest',
  'Wears a prescription mask',
  'Prone to seasickness — forward seat',
  'Celebrating a birthday',
  'First time in the water',
  'Certified rescue diver',
  'Knee injury — no jumping entries',
  'Photographer, carrying a housing',
]

function ageForTier(rng: () => number, tierLabel: string, minAge: number): number {
  const range = /\((\d+)\s*[-–]\s*(\d+)\)/.exec(tierLabel)
  if (range) return rngInt(rng, Number(range[1]), Number(range[2]))
  if (/child|keiki|kid/i.test(tierLabel)) return rngInt(rng, 5, 12)
  if (/youth|junior/i.test(tierLabel)) return rngInt(rng, 13, 17)
  if (/student|backpacker/i.test(tierLabel)) return rngInt(rng, 18, 27)
  return rngInt(rng, Math.max(minAge, 22), 64)
}

function buildParticipants(
  rng: () => number,
  bookingNumber: string,
  activity: Activity,
  customer: Customer,
  seatLabels: string[],
  waiverRate: number,
): Participant[] {
  // Two people with the same given name on one manifest reads as a bug even
  // though it happens; a couple of redraws is cheaper than the doubt.
  const usedFirstNames = new Set<string>([customer.firstName])

  return seatLabels.map((tierLabel, index) => {
    // The lead guest is the account holder; everyone else is drawn from the same
    // market, sharing the surname when they are travelling as a family.
    let companion = index === 0 ? null : pickLocalName(rng, customer.country)
    for (let retry = 0; companion && usedFirstNames.has(companion.firstName) && retry < 3; retry++) {
      companion = pickLocalName(rng, customer.country)
    }
    const firstName = companion ? companion.firstName : customer.firstName
    usedFirstNames.add(firstName)
    const lastName = !companion
      ? customer.lastName
      : rng() < 0.68
        ? customer.lastName
        : companion.lastName

    return {
      id: `par_${bookingNumber}_${index + 1}`,
      firstName,
      lastName,
      age: ageForTier(rng, tierLabel, activity.minAge),
      ...(rng() < 0.12 ? { notes: rngPick(rng, PARTICIPANT_NOTES) } : {}),
      waiverSigned: rng() < waiverRate,
      tierLabel,
    }
  })
}

/* ==========================================================================
   COPY
   ========================================================================== */

const REVIEWS: Record<VerticalKey, string[]> = {
  watersports: [
    'The crew read the water perfectly and put us right on the reef while it was still glassy.',
    'Three turtles in the first ten minutes and a guide who actually knew their names.',
    'Gear was immaculate, briefing was clear, nobody was rushed. Exactly what you want.',
    'We had two nervous swimmers in our group and the team never made them feel like a problem.',
    'Sailed home with the engines off and the sun going down. Still thinking about it.',
    'Booked on a whim the night before and it turned into the best day of the trip.',
    'Small group, no cattle-boat feeling, and the snacks were genuinely good.',
    'Our guide spotted a manta from a hundred metres out. That is experience you cannot fake.',
  ],
  tours: [
    'Paced beautifully — we never felt herded and still saw everything we came for.',
    'Our guide told the kind of stories you cannot get from a plaque.',
    'Pickup was on time to the minute and the vehicle was spotless.',
    'Worth every cent for the local knowledge alone.',
    'Great balance of structure and free time. We would book again tomorrow.',
    'They rerouted around the crowds without making a fuss about it.',
  ],
  restaurants: [
    'The Assyrtiko pairing alone was worth the trip up the hill.',
    'Every course landed at exactly the right moment and the terrace at sunset is unreal.',
    'Booked the counter and watched the whole kitchen work. Brilliant evening.',
    'They handled a shellfish allergy without a hint of drama and the substitutes were better.',
    'Simple, seasonal, perfectly judged. No theatre, just very good cooking.',
    'We arrived late off a delayed ferry and they still made the full menu work.',
  ],
  adventure: [
    'The guides were calm, funny and clearly very good at their job.',
    'Harder than I expected and I am glad nobody softened the briefing.',
    'They turned us around below the summit for wind and it was absolutely the right call.',
    'Kit was in great condition and everything fitted properly first time.',
    'Adrenaline and safety in the right order. Would send my family with them.',
    'Best four hours of the whole South Island trip.',
  ],
  island: [
    'Three moorings, three completely different reefs, and no crowding at any of them.',
    'The marine biologist on board made the whole day make sense.',
    'Boat was fast, comfortable and the crew hustled so we got maximum water time.',
    'Kids were looked after brilliantly while we dived.',
    'Water clarity was extraordinary and the guides knew exactly where to take us.',
    'Well run from the moment we checked in to the moment we stepped off.',
  ],
  wellness: [
    'Sunrise on the water with nobody else around. Rare and worth the early alarm.',
    'The instructor adapted every pose for the board without losing the flow.',
    'Calm, unhurried and genuinely restorative.',
    'Fell in twice and laughed both times. Perfect way to start a day.',
    'Small class, warm teacher, beautiful spot.',
  ],
}

const MIXED_REVIEWS = [
  'Good trip overall, though the departure ran about forty minutes late.',
  'Enjoyable, but the boat was fuller than we expected for the price.',
  'The guiding was excellent; the catering was forgettable.',
  'Solid experience — just wish the briefing had been a little clearer.',
  'Great conditions and a friendly crew, but the pickup arrangements were confusing.',
]

const NEGATIVE_REVIEWS = [
  'Cancelled on us at short notice and the rebooking process was painful.',
  'Felt rushed from start to finish and the gear had seen better days.',
  'Oversold for what it is. The photos promise more than the day delivers.',
  'Communication before the trip was poor and nobody answered the phone.',
]

/** Middle sentences that work for any vertical — they multiply the pool out. */
const REVIEW_DETAILS = [
  'Booking took three clicks and the confirmation landed instantly.',
  'They messaged the night before with the weather call, which we appreciated.',
  'Worth paying a little more than the cheaper operators down the dock.',
  'Everything ran exactly to the times on the confirmation.',
  'Our kids are still talking about it a week later.',
  'The photos they sent afterwards were a genuinely nice touch.',
  'Check-in took two minutes and nobody was left standing around.',
  'We were a group of nine and they handled it without breaking stride.',
]

const REVIEW_TAILS = [
  'Would book again without hesitation.',
  'Already recommended them to two other families at our hotel.',
  'Do it early in your trip so you can go back a second time.',
  'Bring a hat and more sunscreen than you think you need.',
  'Ask for the same crew if you can.',
]

const GUEST_NOTES = [
  'Celebrating our anniversary — no fuss needed, just wanted you to know.',
  'One vegetarian in the party.',
  'Our flight lands at 10am so we may be five minutes behind.',
  'Two nervous swimmers with us, please keep an eye out.',
  'Travelling with a toddler — happy to sit wherever is easiest.',
  'We will have a hire car, is parking straightforward?',
  'Honeymoon trip, would love a quiet spot on the boat if possible.',
]

const INTERNAL_NOTES = [
  'Called to confirm the pickup point; guest has the harbour, not the hotel.',
  'Comp upgrade approved — repeat guest.',
  'Balance settled at the desk on arrival.',
  'OTA rate, commission 20% — do not discount further.',
  'Concierge invoice; do not charge the card on file.',
  'Flag for the loyalty list after this trip.',
  'Third booking this season. Worth a handwritten note.',
]

const OPERATOR_CANCEL_REASONS = [
  'Departure cancelled by the operator — weather',
  'Departure cancelled by the operator — did not reach minimum numbers',
  'Departure cancelled by the operator — vessel unavailable',
  'Departure cancelled by the operator — crew illness',
]

const GUEST_CANCEL_REASONS = [
  'Guest cancelled — change of travel plans',
  'Guest cancelled — flight delay',
  'Guest cancelled — illness in the party',
  'Guest cancelled — booked a different date',
  'Guest cancelled — weather concerns',
]

/* ==========================================================================
   CUSTOMER ASSIGNMENT
   Guests are drawn from a per-tenant queue with a booking budget that respects
   their segment, so a "new" guest never turns up with nine reservations and a
   "lapsed" one never appears inside the window at all. Repeat guests are held
   back and reissued a few dozen bookings later, which clusters their trips into
   the same holiday week the way real itineraries do.
   ========================================================================== */

interface QueueEntry {
  customer: Customer
  budget: number
}

interface PendingGuest {
  customer: Customer
  remaining: number
  readyAt: number
}

function windowBudget(rng: () => number, customer: Customer): number {
  if (customer.totalBookings === 0) return 0
  switch (customer.segment) {
    case 'lapsed':
      // Lapsed means nothing for at least nine months — the window has nothing.
      return 0
    case 'new':
      return 1
    case 'returning':
      return Math.min(customer.totalBookings, rngInt(rng, 2, 4))
    case 'vip':
      return Math.min(customer.totalBookings, rngInt(rng, 4, 10))
  }
}

function createGuestPicker(tenantId: string) {
  const rng = createRng(hashSeed(seedKey('guest-queue', tenantId)))
  const customers = getCustomersByTenant(tenantId)

  const queue: QueueEntry[] = []
  for (const customer of customers) {
    const budget = windowBudget(rng, customer)
    if (budget > 0) queue.push({ customer, budget })
  }
  // Fisher-Yates with the seeded RNG so the order is stable across renders.
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[queue[i], queue[j]] = [queue[j], queue[i]]
  }

  const repeaters = queue.filter((entry) => entry.customer.segment !== 'new')
  const pending: PendingGuest[] = []
  let cursor = 0
  let ordinal = 0
  let recycle = 0

  function takeFromQueue(departureMs: number): Customer {
    for (let attempt = 0; attempt < 64; attempt++) {
      if (cursor >= queue.length) {
        // Everyone has been introduced. Spend the budget still held back before
        // anyone gets reissued, so no guest ends up with more bookings inside
        // the window than their record says they have made in total.
        while (pending.length > 0) {
          const held = pending.shift() as PendingGuest
          if (Date.parse(held.customer.createdAt) > departureMs - HOUR_MS) continue
          if (held.remaining > 1) {
            pending.push({
              customer: held.customer,
              remaining: held.remaining - 1,
              readyAt: ordinal,
            })
          }
          return held.customer
        }
        // Genuinely out of guests: reissue repeat visitors one at a time.
        if (repeaters.length === 0) break
        const entry = repeaters[recycle % repeaters.length]
        recycle++
        return entry.customer
      }
      const entry = queue[cursor++]
      // A guest cannot book a trip that departed before they had an account.
      if (Date.parse(entry.customer.createdAt) <= departureMs - HOUR_MS) {
        if (entry.budget > 1) {
          pending.push({
            customer: entry.customer,
            remaining: entry.budget - 1,
            readyAt: ordinal + rngInt(rng, 30, 500),
          })
        }
        return entry.customer
      }
      // Too recent for this departure — send them to the back for a later one.
      queue.push(entry)
    }
    return queue.length > 0 ? queue[queue.length - 1].customer : customers[0]
  }

  return function pickGuest(departureMs: number, usedOnDeparture: Set<string>): Customer {
    ordinal++
    const head = pending[0]
    if (
      head &&
      head.readyAt <= ordinal &&
      !usedOnDeparture.has(head.customer.id) &&
      Date.parse(head.customer.createdAt) <= departureMs - HOUR_MS
    ) {
      pending.shift()
      if (head.remaining > 1) {
        pending.push({
          customer: head.customer,
          remaining: head.remaining - 1,
          readyAt: ordinal + rngInt(rng, 30, 500),
        })
      }
      return head.customer
    }

    let candidate = takeFromQueue(departureMs)
    let guard = 0
    while (usedOnDeparture.has(candidate.id) && guard < 8) {
      candidate = takeFromQueue(departureMs)
      guard++
    }
    return candidate
  }
}

/* ==========================================================================
   GENERATION
   ========================================================================== */

function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`
}

function splitParty(rng: () => number, activity: Activity, booked: number): number[] {
  const mix = PARTY_MIX[partyProfile(activity)]
  const maxParty = Math.min(activity.maxCapacity, 12)
  const parties: number[] = []
  let remaining = booked

  while (remaining > 0) {
    let size = Math.min(rngWeighted(rng, mix), remaining, maxParty)
    // Never strand a single seat behind a party that could have absorbed it.
    if (remaining - size === 1 && size > 1 && remaining <= maxParty) size = remaining
    parties.push(size)
    remaining -= size
  }
  return parties
}

/** Seat-by-seat tier labels, so participants always line up with what was sold. */
function seatLabelsFor(activity: Activity, lines: TierLine[], partySize: number): string[] {
  const labels: string[] = []
  for (const line of lines) {
    const seats = tierSeats(activity, line.tier)
    const count = seats <= 1 ? line.quantity : line.quantity * seats
    for (let i = 0; i < count && labels.length < partySize; i++) labels.push(line.tier.label)
  }
  while (labels.length < partySize) labels.push(lines[0].tier.label)
  return labels
}

interface Totals {
  lineItems: BookingLineItem[]
  subtotal: number
  discountTotal: number
  taxTotal: number
  feeTotal: number
  total: number
  promoCode?: string
}

function priceBooking(
  rng: () => number,
  tenantId: string,
  activity: Activity,
  departure: Departure,
  lines: TierLine[],
  partySize: number,
  channel: BookingChannel,
  bookingNumber: string,
): Totals {
  const items: BookingLineItem[] = []
  let seq = 0
  const multiplier = departure.priceMultiplier ?? 1

  for (const line of lines) {
    const unitPrice = Math.round(line.tier.price * multiplier)
    items.push({
      id: `li_${bookingNumber}_${++seq}`,
      label: line.tier.label,
      kind: 'ticket',
      quantity: line.quantity,
      unitPrice,
      total: unitPrice * line.quantity,
    })
  }

  const required = activity.addOns.filter((addOn) => addOn.required)
  const optional = activity.addOns.filter((addOn) => !addOn.required)
  const chosen = [...required]
  const extras = rngWeighted(rng, [
    [0, 42],
    [1, 38],
    [2, 20],
  ])
  for (let i = 0; i < extras && optional.length > 0; i++) {
    const addOn = rngPick(rng, optional)
    if (!chosen.includes(addOn)) chosen.push(addOn)
  }

  for (const addOn of chosen) {
    const cap = addOn.maxPerBooking === null ? partySize : Math.min(addOn.maxPerBooking, partySize)
    const quantity = cap <= 1 ? 1 : rng() < 0.6 ? cap : rngInt(rng, 1, cap)
    items.push({
      id: `li_${bookingNumber}_${++seq}`,
      label: addOn.label,
      kind: 'addon',
      quantity,
      unitPrice: addOn.price,
      total: addOn.price * quantity,
    })
  }

  const subtotal = items.reduce((acc, item) => acc + item.total, 0)

  let discountTotal = 0
  let promoCode: string | undefined
  const promos = PROMOS[tenantId]
  if (promos && rng() < 0.17) {
    const promo = rngPick(rng, promos)
    discountTotal = Math.round((subtotal * promo.percent) / 100)
    promoCode = promo.code
    items.push({
      id: `li_${bookingNumber}_${++seq}`,
      label: `Promo ${promo.code} (−${promo.percent}%)`,
      kind: 'discount',
      quantity: 1,
      unitPrice: -discountTotal,
      total: -discountTotal,
    })
  }

  const net = subtotal - discountTotal
  const feeTotal = FEE_CHANNELS.has(channel) ? Math.round(net * SERVICE_FEE_RATE) : 0
  if (feeTotal > 0) {
    items.push({
      id: `li_${bookingNumber}_${++seq}`,
      label: 'Booking & service fee',
      kind: 'fee',
      quantity: 1,
      unitPrice: feeTotal,
      total: feeTotal,
    })
  }

  const tax = TAX[tenantId] ?? { rate: 0, label: 'Tax' }
  const taxTotal = Math.round(net * tax.rate)
  if (taxTotal > 0) {
    items.push({
      id: `li_${bookingNumber}_${++seq}`,
      label: tax.label,
      kind: 'tax',
      quantity: 1,
      unitPrice: taxTotal,
      total: taxTotal,
    })
  }

  return {
    lineItems: items,
    subtotal,
    discountTotal,
    taxTotal,
    feeTotal,
    total: subtotal - discountTotal + taxTotal + feeTotal,
    ...(promoCode ? { promoCode } : {}),
  }
}

/** When the guest actually clicked "book" — lead time skews short but has a tail. */
function bookedAt(rng: () => number, departureMs: number, customer: Customer): Date {
  const aheadDays = Math.max(0, (departureMs - NOW_MS) / DAY_MS)
  const extra = rngWeighted(rng, [
    [1, 10],
    [3, 16],
    [7, 20],
    [14, 18],
    [30, 18],
    [60, 12],
    [110, 6],
  ])
  const leadDays = aheadDays + extra * (0.4 + rng() * 0.8)
  const created = new Date(departureMs - leadDays * DAY_MS)
  created.setHours(rngInt(rng, 7, 23), rngInt(rng, 0, 59), rngInt(rng, 0, 59), 0)

  const floor = Date.parse(customer.createdAt) + HOUR_MS
  const ceiling = Math.min(NOW_MS - 60_000, departureMs - 30 * 60_000)
  return new Date(clamp(created.getTime(), Math.min(floor, ceiling), ceiling))
}

function buildReview(rng: () => number, category: VerticalKey, rating: number): string {
  if (rating <= 2) return rngPick(rng, NEGATIVE_REVIEWS)
  if (rating === 3) return rngPick(rng, MIXED_REVIEWS)
  // Opener, optional detail, optional sign-off — a few hundred combinations per
  // vertical, so a reviews list does not read like the same sentence on repeat.
  const parts = [rngPick(rng, REVIEWS[category] ?? REVIEWS.tours)]
  if (rng() < 0.5) parts.push(rngPick(rng, REVIEW_DETAILS))
  if (rng() < 0.45) parts.push(rngPick(rng, REVIEW_TAILS))
  return parts.join(' ')
}

function buildBookings(): Booking[] {
  const out: Booking[] = []
  let sequence = 0

  for (const tenant of TENANTS) {
    // Fail loudly rather than silently zero-rating an entire operator's revenue.
    if (!TAX[tenant.id]) throw new Error(`bookings.ts has no tax table for tenant "${tenant.id}"`)
    const pickGuest = createGuestPicker(tenant.id)

    for (const departure of getDeparturesByTenant(tenant.id)) {
      if (departure.booked <= 0) continue

      const activity = getActivityById(departure.activityId)
      if (!activity) continue

      const departureMs = Date.parse(departure.startsAt)
      const past = departureMs < NOW_MS
      const hoursAway = (departureMs - NOW_MS) / HOUR_MS
      const exclusive = isExclusive(activity)
      const splitRng = createRng(hashSeed(seedKey('party', departure.id)))
      const parties = exclusive ? [departure.booked] : splitParty(splitRng, activity, departure.booked)
      const usedOnDeparture = new Set<string>()

      for (const partySize of parties) {
        const bookingNumber = String(++sequence).padStart(6, '0')
        const id = `bkg_${bookingNumber}`
        const rng = createRng(hashSeed(seedKey('booking', id)))

        const customer = pickGuest(departureMs, usedOnDeparture)
        usedOnDeparture.add(customer.id)

        const lines = exclusive
          ? allocateExclusive(rng, activity, partySize)
          : allocateShared(rng, activity, partySize)

        const channel = rngWeighted(rng, CHANNEL_MIX)
        const totals = priceBooking(
          rng,
          tenant.id,
          activity,
          departure,
          lines,
          partySize,
          channel,
          bookingNumber,
        )

        const createdAt = bookedAt(rng, departureMs, customer)
        const createdMs = createdAt.getTime()

        /* ---- lifecycle ---- */
        let status: BookingStatus
        let paymentStatus: PaymentStatus
        let amountPaid = 0
        let cancelledAt: string | undefined
        let cancellationReason: string | undefined
        let refundAmount: number | undefined
        let rating: number | undefined
        let reviewText: string | undefined

        const guestCancelled = departure.status !== 'sold_out' && rng() < 0.05

        if (departure.status === 'cancelled') {
          status = 'cancelled'
          paymentStatus = 'refunded'
          amountPaid = totals.total
          refundAmount = totals.total
          cancellationReason = rngPick(rng, OPERATOR_CANCEL_REASONS)
          cancelledAt = localIso(
            new Date(clamp(departureMs - rngInt(rng, 4, 72) * HOUR_MS, createdMs + HOUR_MS, departureMs)),
          )
        } else if (guestCancelled) {
          const cancelMs = clamp(
            createdMs + (departureMs - createdMs) * (0.3 + rng() * 0.65),
            createdMs + HOUR_MS,
            departureMs - HOUR_MS,
          )
          const hoursBefore = (departureMs - cancelMs) / HOUR_MS
          const inPolicy = hoursBefore >= activity.cancellationPolicy.freeCancellationHours
          status = 'cancelled'
          amountPaid = totals.total
          if (inPolicy) {
            paymentStatus = 'refunded'
            refundAmount = totals.total
          } else {
            paymentStatus = 'partially_refunded'
            refundAmount = Math.round(
              (totals.total * activity.cancellationPolicy.lateRefundPercent) / 100,
            )
          }
          cancellationReason = rngPick(rng, GUEST_CANCEL_REASONS)
          cancelledAt = localIso(new Date(cancelMs))
        } else if (past) {
          amountPaid = totals.total
          const roll = rng()
          if (roll < 0.03) {
            status = 'no_show'
            paymentStatus = 'paid'
          } else if (roll < 0.04) {
            // Goodwill: the trip ran, something went wrong, half came back.
            status = 'refunded'
            paymentStatus = 'partially_refunded'
            refundAmount = Math.round(totals.total * 0.5)
          } else {
            status = 'completed'
            paymentStatus = 'paid'
          }
          if (status === 'completed' && rng() < 0.35) {
            rating = rngWeighted(rng, [
              [5, 62],
              [4, 24],
              [3, 8],
              [2, 4],
              [1, 2],
            ])
            if (rng() < 0.5) reviewText = buildReview(rng, activity.category, rating)
          }
        } else if (hoursAway <= 3) {
          // Today's next departures — the ops board wants people already checked in.
          status = rng() < 0.62 ? 'checked_in' : 'confirmed'
          paymentStatus = 'paid'
          amountPaid = totals.total
        } else {
          const roll = rng()
          if (roll < 0.008) {
            status = 'pending'
            paymentStatus = 'failed'
          } else if (roll < 0.12) {
            status = 'pending'
            paymentStatus = 'unpaid'
          } else {
            status = 'confirmed'
            // Big-ticket trips booked well ahead go out on a deposit.
            if (totals.total >= 150_000 && hoursAway > 336 && rng() < 0.45) {
              paymentStatus = 'deposit_paid'
              amountPaid = Math.round(totals.total * 0.3)
            } else {
              paymentStatus = 'paid'
              amountPaid = totals.total
            }
          }
        }

        const waiverRate = past ? 0.94 : status === 'pending' ? 0.25 : 0.62
        const participants = buildParticipants(
          rng,
          bookingNumber,
          activity,
          customer,
          seatLabelsFor(activity, lines, partySize),
          waiverRate,
        )

        const updatedAt =
          cancelledAt ??
          localIso(new Date(Math.min(createdMs + rngInt(rng, 0, 240) * 60_000, NOW_MS - 1000)))

        out.push({
          id,
          tenantId: tenant.id,
          reference: bookingReference(id),
          activityId: activity.id,
          departureId: departure.id,
          customerId: customer.id,
          status,
          paymentStatus,
          channel,
          partySize,
          lineItems: totals.lineItems,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          feeTotal: totals.feeTotal,
          total: totals.total,
          amountPaid,
          currency: activity.currency,
          participants,
          createdAt: localIso(createdAt),
          updatedAt,
          departureAt: departure.startsAt,
          ...(rng() < 0.15 ? { notes: rngPick(rng, GUEST_NOTES) } : {}),
          ...(rng() < 0.12 ? { internalNotes: rngPick(rng, INTERNAL_NOTES) } : {}),
          source: rngPick(rng, SOURCES[channel]),
          ...(totals.promoCode ? { promoCode: totals.promoCode } : {}),
          ...(cancelledAt ? { cancelledAt } : {}),
          ...(cancellationReason ? { cancellationReason } : {}),
          ...(refundAmount !== undefined ? { refundAmount } : {}),
          ...(rating !== undefined ? { rating } : {}),
          ...(reviewText ? { reviewText } : {}),
        })
      }
    }
  }

  return out
}

/* ==========================================================================
   EXPORTS
   ========================================================================== */

export const BOOKINGS: Booking[] = buildBookings()

const BOOKINGS_BY_TENANT: Record<string, Booking[]> = {}
const BOOKINGS_BY_ID = new Map<string, Booking>()
const BOOKINGS_BY_DEPARTURE = new Map<string, Booking[]>()
const BOOKINGS_BY_CUSTOMER = new Map<string, Booking[]>()
const BOOKINGS_BY_ACTIVITY = new Map<string, Booking[]>()

function pushInto<T>(map: Map<string, T[]>, key: string, value: T): void {
  const bucket = map.get(key)
  if (bucket) bucket.push(value)
  else map.set(key, [value])
}

for (const booking of BOOKINGS) {
  ;(BOOKINGS_BY_TENANT[booking.tenantId] ||= []).push(booking)
  BOOKINGS_BY_ID.set(booking.id, booking)
  pushInto(BOOKINGS_BY_DEPARTURE, booking.departureId, booking)
  pushInto(BOOKINGS_BY_CUSTOMER, booking.customerId, booking)
  pushInto(BOOKINGS_BY_ACTIVITY, booking.activityId, booking)
}

/**
 * Departure timestamps per tenant, already ascending because bookings are
 * emitted in departure order. Range queries binary-search these.
 */
const DEPARTURE_TIMES_BY_TENANT: Record<string, number[]> = {}
/** Same rows re-sorted newest-created-first for the activity feed. */
const RECENT_BY_TENANT: Record<string, Booking[]> = {}

for (const [tenantId, rows] of Object.entries(BOOKINGS_BY_TENANT)) {
  DEPARTURE_TIMES_BY_TENANT[tenantId] = rows.map((row) => Date.parse(row.departureAt))
  RECENT_BY_TENANT[tenantId] = [...rows].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  )
}

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

export function getBookingsByTenant(tenantId: string): Booking[] {
  return BOOKINGS_BY_TENANT[tenantId] ?? []
}

export function getBookingById(id: string): Booking | undefined {
  return BOOKINGS_BY_ID.get(id)
}

export function getBookingsByDeparture(departureId: string): Booking[] {
  return BOOKINGS_BY_DEPARTURE.get(departureId) ?? []
}

export function getBookingsByCustomer(customerId: string): Booking[] {
  return BOOKINGS_BY_CUSTOMER.get(customerId) ?? []
}

export function getBookingsByActivity(activityId: string): Booking[] {
  return BOOKINGS_BY_ACTIVITY.get(activityId) ?? []
}

/**
 * Bookings whose **departure** falls inside [from, to], both bounds inclusive.
 * For sales-date analysis read `createdAt` off the rows instead — that axis is
 * deliberately not the one this filters on.
 */
export function getBookingsInRange(tenantId: string, from: Date, to: Date): Booking[] {
  const rows = BOOKINGS_BY_TENANT[tenantId]
  const times = DEPARTURE_TIMES_BY_TENANT[tenantId]
  if (!rows || !times) return []

  const toMs = to.getTime()
  const out: Booking[] = []
  for (let i = lowerBound(times, from.getTime()); i < times.length && times[i] <= toMs; i++) {
    out.push(rows[i])
  }
  return out
}

/** Most recently created first — this is the "new bookings" feed. */
export function getRecentBookings(tenantId: string, limit = 10): Booking[] {
  return (RECENT_BY_TENANT[tenantId] ?? []).slice(0, Math.max(0, limit))
}
