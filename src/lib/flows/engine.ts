import { defaultAudiences, matchesAudience, type Audience, type MarketingContact, type MarketingSettings } from '@/lib/marketing'
import { PLACEHOLDERS, renderTemplate, type MessageContext } from '@/lib/messaging'
import { formatCurrency, toDateKey } from '@/lib/utils'
import type { CurrencyCode, Customer } from '@/types'

import { evaluate, segmentFor, type BookingFacts, type DepartureFacts, type Facts, type FlowFacts, type GuestFacts } from './conditions'
import { codePrefix } from './promos'
import type {
  ActionStep,
  ConditionGroup,
  Duration,
  EmailStep,
  Flow,
  FlowRun,
  FlowStep,
  FlowTrigger,
  GuestJourney,
  JourneyEvent,
  JourneyEventKind,
  SmsStep,
  StepStats,
  TriggerType,
  WaitStep,
} from './types'

/* ==========================================================================
   The simulator — replays the business's real bookings through a flow, so
   the numbers on every card are what would have happened, not made up.

   The server builds a FlowWorld once per business from the demo (bookings,
   guests, departures, gift cards, abandoned carts) and adds what only the
   browser knows (sign-ups, marketing settings, audiences). `simulate` then:

     1. finds every moment the trigger fired in the window,
     2. checks who may enter, consent, re-entry and the holdout,
     3. walks the steps on a clock: waits move it, messages follow quiet
        hours and send days, exits are checked as time passes,
     4. stops each guest at "now" — what is left is waiting, and messages
        due in the next week are counted ahead.

   Opens and clicks are estimates (a steady hash per guest and step);
   bookings are real: a booking that guest actually made within the
   conversion window after a message. Pure and browser-safe.
   ========================================================================== */

/* ---------- time ---------- */

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

const UNIT_MS: Record<Duration['unit'], number> = { minutes: MINUTE, hours: HOUR, days: DAY }

export function durationMs(duration: Duration | undefined): number {
  if (!duration || !Number.isFinite(duration.amount)) return 0
  return Math.max(0, duration.amount) * UNIT_MS[duration.unit]
}

function durationText(duration: Duration): string {
  const unit = duration.amount === 1 ? duration.unit.slice(0, -1) : duration.unit
  return `${duration.amount} ${unit}`
}

/** Where each trigger's offset starts when the flow does not set one. */
const DEFAULT_OFFSET: Partial<Record<TriggerType, Duration>> = {
  before_start: { amount: 1, unit: 'days' },
  after_end: { amount: 1, unit: 'days' },
  balance_due: { amount: 3, unit: 'days' },
  gift_card_expiring: { amount: 30, unit: 'days' },
  lapsed: { amount: 120, unit: 'days' },
  low_fill: { amount: 3, unit: 'days' },
  checkout_abandoned: { amount: 1, unit: 'hours' },
  trip_anniversary: { amount: 0, unit: 'days' },
  weather_alert: { amount: 1, unit: 'days' },
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

/** Local ISO without a zone, the way the demo stores every datetime. */
function iso(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function parseMs(value: string | null | undefined): number | null {
  if (!value) return null
  // A bare date ("2026-09-01") would parse as UTC midnight: read it as local mid-morning.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return new Date(y, m - 1, d, 10, 0, 0).getTime()
  }
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? null : ms
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function clockText(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours()
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
}

function dayText(ms: number): string {
  const d = new Date(ms)
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`
}

/** FNV-1a of a key: hash it once, then draw several numbers from it with `mixed`. */
function hashOf(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return h >>> 0
}

/** A steady, well-mixed 0–1 number from a hash and a salt (murmur finish), so related draws never move together. */
function mixed(hash: number, salt: number): number {
  let h = hash ^ Math.imul(salt + 1, 0x9e3779b9)
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

function chance(key: string): number {
  return mixed(hashOf(key), 0)
}

function minutesOf(hhmm: string | undefined): number | null {
  if (!hhmm) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!match) return null
  return Math.min(23, Number(match[1])) * 60 + Math.min(59, Number(match[2]))
}

function atMinutes(ms: number, minutes: number, addDays = 0): number {
  const d = new Date(ms)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + addDays, Math.floor(minutes / 60), minutes % 60, 0).getTime()
}

/** The next HH:MM at or after `ms`, on one of `days` (0=Sun) when given. */
function nextTimeOfDay(ms: number, minutes: number, days: number[] | undefined): number {
  for (let add = 0; add < 9; add++) {
    const candidate = atMinutes(ms, minutes, add)
    if (candidate < ms) continue
    if (days && days.length > 0 && !days.includes(new Date(candidate).getDay())) continue
    return candidate
  }
  return atMinutes(ms, minutes, 1)
}

function oneYearLater(ms: number): number {
  const d = new Date(ms)
  return new Date(d.getFullYear() + 1, d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()).getTime()
}

/* ---------- the world ---------- */

export type JoinSource = 'popup' | 'footer' | 'checkout' | 'walk_in'

/** A booking, slimmed to what flows read. Datetimes are local ISO strings. */
export interface WorldBooking {
  id: string
  reference: string
  customerId: string
  activitySlug: string
  activityName: string
  /** Activity kind: trip, rental, lesson… */
  kind: string
  departureId: string
  locationId: string | null
  departureAt: string
  endsAt: string
  createdAt: string
  status: string
  paymentStatus: string
  partySize: number
  /** Minor units. */
  total: number
  amountPaid: number
  channel: string
  promoCode: string | null
  /** Add-on ids and labels. */
  addOns: string[]
  ages: number[]
  waiversMissing: number
  hasChildren: boolean
  rating: number | null
  cancelledAt: string | null
  /** A cart that came back and paid: counts as a booking, never starts booking automations. */
  recoveredCart?: boolean
}

export interface WorldGuest {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  /** Country name. */
  country: string
  tags: string[]
  segment: Customer['segment']
  emailOptIn: boolean
  smsOptIn: boolean
  totalBookings: number
  /** Minor units. */
  lifetimeValue: number
  lastBookingAt: string | null
  createdAt: string
  /** How they joined the list, when they did. */
  joinSource?: JoinSource
  /** Not on the guest list: a sign-up, gift card buyer or someone who asked. */
  pseudo?: boolean
}

export interface WorldDeparture {
  id: string
  activitySlug: string
  activityName: string
  startsAt: string
  endsAt: string
  capacity: number
  booked: number
  status: string
  weather: { condition: string; goConfidence: number } | null
  locationId: string | null
}

export interface WorldGiftCard {
  code: string
  purchaser: string
  recipient: string
  recipientEmail: string
  /** Minor units. */
  initial: number
  balance: number
  issuedAt: string
  expiresAt: string
  status: string
}

export interface WorldAbandoned {
  id: string
  customerId: string
  activitySlug: string
  activityName: string
  departureId: string
  partySize: number
  total: number
  abandonedAt: string
  status: string
  recoveredAt: string | null
}

/** Plain data the server gathers from the demo, once per business. */
export interface FlowWorldData {
  tenantId: string
  slug: string
  business: string
  currency: CurrencyCode
  /** Country name, for "lives locally". */
  homeCountry: string
  nowIso: string
  bookings: WorldBooking[]
  guests: WorldGuest[]
  departures: WorldDeparture[]
  giftCards: WorldGiftCard[]
  abandoned: WorldAbandoned[]
}

export interface FlowSignup {
  email: string
  name?: string
  phone?: string
  source: string
  at: string
}

export interface FlowRequest {
  id: string
  customerId?: string
  name: string
  email?: string
  phone?: string
  at: string
  activitySlug?: string
}

/** What only the browser knows: sign-ups, the marketing rules and saved audiences. */
export interface FlowExtras {
  signups?: FlowSignup[]
  settings?: Partial<Pick<MarketingSettings, 'paused' | 'quietHours' | 'frequencyCap' | 'skipUpcoming'>>
  audiences?: Audience[]
  /** request_received: requests and quotes, when the page has them. */
  requests?: FlowRequest[]
  /** The demo clock as local ISO. Defaults to the demo's now. */
  nowIso?: string
}

interface IBooking extends WorldBooking {
  createdMs: number
  startMs: number
  endMs: number
  cancelledMs: number | null
  /** Their first booking that stood. */
  first: boolean
}

interface IDeparture extends WorldDeparture {
  startMs: number
}

interface IGuest extends WorldGuest {
  createdMs: number
  name: string
  /** Can get an email at all (booking messages). */
  canEmail: boolean
  canText: boolean
}

export interface FlowWorld {
  data: FlowWorldData
  nowMs: number
  bookings: IBooking[]
  departures: IDeparture[]
  guests: Map<string, IGuest>
  guestByEmail: Map<string, IGuest>
  guestByName: Map<string, IGuest>
  /** Per guest, oldest booking first. */
  bookingsByGuest: Map<string, IBooking[]>
  bookingsByDeparture: Map<string, IBooking[]>
  departureById: Map<string, IDeparture>
  /** Per activity: guests who have been, most recent trip first, with their first trip. */
  pastGuestsByActivity: Map<string, { guestId: string; firstStartMs: number; lastStartMs: number }[]>
  contacts: Map<string, MarketingContact>
  extras: Required<Pick<FlowExtras, 'signups' | 'audiences' | 'requests'>> & {
    settings: Pick<MarketingSettings, 'paused' | 'quietHours' | 'frequencyCap' | 'skipUpcoming'>
  }
}

const standing = (status: string) => status !== 'cancelled' && status !== 'refunded'

/** Index the plain data once. Cache the result per business. */
export function createWorld(data: FlowWorldData): FlowWorld {
  const nowMs = parseMs(data.nowIso) ?? 0
  const guests = new Map<string, IGuest>()
  const guestByEmail = new Map<string, IGuest>()
  const guestByName = new Map<string, IGuest>()
  for (const g of data.guests) {
    const guest: IGuest = {
      ...g,
      createdMs: parseMs(g.createdAt) ?? nowMs,
      name: `${g.firstName} ${g.lastName}`.trim(),
      canEmail: Boolean(g.email),
      canText: Boolean(g.phone),
    }
    guests.set(g.id, guest)
    if (g.email) guestByEmail.set(g.email.toLowerCase(), guest)
    guestByName.set(guest.name.toLowerCase(), guest)
  }

  const bookings: IBooking[] = []
  const bookingsByGuest = new Map<string, IBooking[]>()
  const bookingsByDeparture = new Map<string, IBooking[]>()
  for (const b of data.bookings) {
    const booking: IBooking = {
      ...b,
      createdMs: parseMs(b.createdAt) ?? nowMs,
      startMs: parseMs(b.departureAt) ?? nowMs,
      endMs: parseMs(b.endsAt) ?? parseMs(b.departureAt) ?? nowMs,
      cancelledMs: parseMs(b.cancelledAt),
      first: false,
    }
    bookings.push(booking)
    const own = bookingsByGuest.get(b.customerId)
    if (own) own.push(booking)
    else bookingsByGuest.set(b.customerId, [booking])
    if (b.recoveredCart) continue
    const dep = bookingsByDeparture.get(b.departureId)
    if (dep) dep.push(booking)
    else bookingsByDeparture.set(b.departureId, [booking])
  }
  bookings.sort((a, b) => a.createdMs - b.createdMs)
  for (const list of bookingsByGuest.values()) {
    list.sort((a, b) => a.createdMs - b.createdMs)
    const first = list.find((b) => standing(b.status) && !b.recoveredCart)
    if (first) first.first = true
  }

  // Oldest first: seat offers walk departures in time order.
  const departures: IDeparture[] = data.departures.map((d) => ({ ...d, startMs: parseMs(d.startsAt) ?? nowMs })).sort((a, b) => a.startMs - b.startMs)
  const departureById = new Map(departures.map((d) => [d.id, d]))

  const past = new Map<string, Map<string, { guestId: string; firstStartMs: number; lastStartMs: number }>>()
  for (const b of bookings) {
    if (!standing(b.status) || b.recoveredCart || b.status === 'no_show') continue
    let byGuest = past.get(b.activitySlug)
    if (!byGuest) past.set(b.activitySlug, (byGuest = new Map()))
    const seen = byGuest.get(b.customerId)
    if (seen) {
      seen.firstStartMs = Math.min(seen.firstStartMs, b.startMs)
      seen.lastStartMs = Math.max(seen.lastStartMs, b.startMs)
    } else byGuest.set(b.customerId, { guestId: b.customerId, firstStartMs: b.startMs, lastStartMs: b.startMs })
  }
  const pastGuestsByActivity = new Map<string, { guestId: string; firstStartMs: number; lastStartMs: number }[]>()
  for (const [slug, byGuest] of past) pastGuestsByActivity.set(slug, [...byGuest.values()].sort((a, b) => b.lastStartMs - a.lastStartMs))

  const contacts = new Map<string, MarketingContact>()
  for (const g of guests.values()) {
    const own = bookingsByGuest.get(g.id) ?? []
    // The same rule as the marketing guest list: their next confirmed or pending trip after now.
    let nextTripMs = Infinity
    let nextTripAt: string | null = null
    for (const b of own) {
      if ((b.status === 'confirmed' || b.status === 'pending') && !b.recoveredCart && b.startMs > nowMs && b.startMs < nextTripMs) {
        nextTripMs = b.startMs
        nextTripAt = b.departureAt
      }
    }
    contacts.set(g.id, {
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      email: g.email,
      phone: g.phone,
      country: g.country,
      totalBookings: g.totalBookings,
      spend: Math.round(g.lifetimeValue / 100),
      lastBookingAt: g.lastBookingAt,
      tags: g.tags,
      emailOptIn: g.emailOptIn,
      smsOptIn: g.smsOptIn,
      segment: g.segment,
      activitySlugs: [...new Set(own.map((b) => b.activitySlug))],
      nextTripAt,
    })
  }

  return {
    data,
    nowMs,
    bookings,
    departures,
    guests,
    guestByEmail,
    guestByName,
    bookingsByGuest,
    bookingsByDeparture,
    departureById,
    pastGuestsByActivity,
    contacts,
    extras: {
      signups: [],
      audiences: [],
      requests: [],
      settings: {
        paused: false,
        quietHours: { enabled: true, from: '21:00', to: '08:00' },
        frequencyCap: { enabled: true, perWeek: 2 },
        skipUpcoming: { enabled: true, days: 3 },
      },
    },
  }
}

/** The indexed world with the browser's extras laid over it. Cheap: no re-indexing. */
export function withExtras(world: FlowWorld, extras: FlowExtras | undefined): FlowWorld {
  if (!extras) return world
  const base = world.extras.settings
  return {
    ...world,
    extras: {
      signups: extras.signups ?? [],
      audiences: extras.audiences ?? [],
      requests: extras.requests ?? [],
      settings: {
        paused: extras.settings?.paused ?? base.paused,
        quietHours: { ...base.quietHours, ...extras.settings?.quietHours },
        frequencyCap: { ...base.frequencyCap, ...extras.settings?.frequencyCap },
        skipUpcoming: { ...base.skipUpcoming, ...extras.settings?.skipUpcoming },
      },
    },
  }
}

/* ---------- facts at a moment ---------- */

function guestFactsAt(world: FlowWorld, guest: IGuest, at: number, tags?: string[]): GuestFacts {
  const own = world.bookingsByGuest.get(guest.id)
  let count = 0
  let spend = 0
  let lastMade = -Infinity
  // Their latest trip that stood, by its date. A trip still to come counts as now: they haven't lapsed.
  let lastTrip = -Infinity
  let upcoming = false
  const slugs: string[] = []
  if (own) {
    for (const b of own) {
      if (b.createdMs > at) break
      if (b.createdMs > lastMade) lastMade = b.createdMs
      if (!slugs.includes(b.activitySlug)) slugs.push(b.activitySlug)
      const cancelled = !standing(b.status) && (b.cancelledMs ?? b.createdMs) <= at
      if (cancelled) continue
      count++
      spend += b.total
      if (b.startMs > at) upcoming = true
      lastTrip = Math.max(lastTrip, Math.min(b.startMs, at))
    }
  }
  // Only cancelled bookings: fall back to when they last booked.
  const last = lastTrip === -Infinity ? lastMade : lastTrip
  const days = last === -Infinity ? Infinity : (at - last) / DAY
  return {
    tags: tags ?? guest.tags,
    bookings: count,
    spend,
    country: guest.country,
    segment: guest.pseudo ? guest.segment : segmentFor(count, spend, days),
    daysSinceLastTrip: days,
    bookedActivity: slugs,
    emailOptIn: guest.emailOptIn,
    smsOptIn: guest.smsOptIn,
    hasUpcomingTrip: upcoming,
    local: Boolean(guest.country) && guest.country.toLowerCase() === world.data.homeCountry.toLowerCase(),
  }
}

function bookingFactsAt(b: IBooking, at: number): BookingFacts {
  return {
    activity: b.activitySlug,
    kind: b.kind,
    partySize: b.partySize,
    total: b.total,
    channel: b.channel,
    balanceDue: Math.max(0, b.total - b.amountPaid),
    hasAddOn: b.addOns,
    usedCode: b.promoCode,
    hasChildren: b.hasChildren,
    waiversMissing: b.waiversMissing,
    daysUntilStart: Math.round(((b.startMs - at) / DAY) * 10) / 10,
    location: b.locationId,
    rating: b.rating,
    firstBooking: b.first,
  }
}

function seatsAt(world: FlowWorld, d: IDeparture, at: number): number {
  if (at >= world.nowMs) return d.booked
  let seats = 0
  for (const b of world.bookingsByDeparture.get(d.id) ?? []) {
    if (b.createdMs > at) continue
    if (!standing(b.status) && (b.cancelledMs ?? 0) <= at) continue
    seats += b.partySize
  }
  return seats
}

function departureFactsAt(world: FlowWorld, d: IDeparture, at: number): DepartureFacts {
  const weather: string[] = []
  if (d.weather) weather.push(d.weather.condition)
  if (d.status === 'weather_hold') weather.push('hold')
  if (d.status === 'weather_hold' || (d.weather && d.weather.goConfidence < 50)) weather.push('risky')
  return { fill: d.capacity > 0 ? Math.round((seatsAt(world, d, at) / d.capacity) * 100) : 100, weather }
}

/* ---------- trigger moments ---------- */

interface Entry {
  at: number
  guest: IGuest
  /** The booking it is about: booking facts and placeholders. */
  booking?: IBooking
  departure?: IDeparture
  /** Shown on the journey only (e.g. their last trip for "lapsed"). */
  about?: { activityName: string }
  /** What started it, in words. A function when it costs something to word. */
  text: string | (() => string)
  /** Re-entry key for per_booking. */
  key: string
  preview?: boolean
  /** "Who" was already checked at `at` while collecting. */
  whoChecked?: boolean
}

/** Most past guests or audience members one under-filled departure reaches. */
const REACH_CAP = 150

const SOURCE_TEXT: Record<string, string> = { popup: 'from the pop-up', footer: 'from the website footer', checkout: 'at checkout', walk_in: 'in person' }

/** When a booking starts a booking-led trigger, or null when it does not. */
function bookingMoment(trigger: FlowTrigger, b: IBooking, offset: number): number | null {
  if (b.recoveredCart) return null
  const alive = (ms: number) => b.cancelledMs === null || b.cancelledMs > ms
  switch (trigger.type) {
    case 'booking_made':
      return b.createdMs
    case 'booking_cancelled':
      return !standing(b.status) ? b.cancelledMs : null
    case 'before_start':
    case 'balance_due': {
      if (trigger.type === 'balance_due' && b.total <= b.amountPaid) return null
      if (b.status === 'no_show' && trigger.type === 'balance_due') return null
      let ms = b.startMs - offset
      // Booked inside the window: it goes as soon as they book.
      if (b.createdMs > ms) ms = b.createdMs < b.startMs ? b.createdMs : NaN
      return Number.isNaN(ms) || !alive(ms) ? null : ms
    }
    case 'after_end':
      return standing(b.status) && b.status !== 'no_show' ? b.endMs + offset : null
    case 'checked_in':
      return b.status === 'checked_in' || b.status === 'completed' ? b.startMs : null
    case 'no_show':
      return b.status === 'no_show' ? b.startMs + 30 * MINUTE : null
    case 'payment_failed':
      // The demo keeps no card declines; a confirmed booking with nothing collected is the closest thing.
      return b.paymentStatus === 'unpaid' && b.status !== 'pending' && standing(b.status) ? b.createdMs + 5 * MINUTE : null
    case 'review_left': {
      if (b.rating === null) return null
      if (trigger.ratings && trigger.ratings.length > 0 && !trigger.ratings.includes(b.rating)) return null
      return b.endMs + DAY
    }
    case 'trip_anniversary':
      return b.status === 'completed' ? oneYearLater(b.startMs) - offset : null
    default:
      return null
  }
}

const BOOKING_TRIGGERS = new Set<TriggerType>([
  'booking_made',
  'booking_cancelled',
  'before_start',
  'after_end',
  'checked_in',
  'no_show',
  'balance_due',
  'payment_failed',
  'review_left',
  'trip_anniversary',
])

function bookingEntryText(trigger: FlowTrigger, b: IBooking, offset: Duration | undefined, currency: CurrencyCode): string {
  const name = b.activityName
  switch (trigger.type) {
    case 'booking_made':
      return `Booked ${name}`
    case 'booking_cancelled':
      return `Cancelled ${name}`
    case 'before_start':
      return offset && offset.amount > 0 ? `${durationText(offset)} before ${name}` : `${name} is about to start`
    case 'after_end':
      return offset && offset.amount > 0 ? `${durationText(offset)} after ${name} ended` : `${name} ended`
    case 'checked_in':
      return `Checked in for ${name}`
    case 'no_show':
      return `Didn't show up for ${name}`
    case 'balance_due':
      return `${formatCurrency(Math.max(0, b.total - b.amountPaid), currency)} still to pay for ${name}`
    case 'payment_failed':
      return `A payment for ${name} didn't go through`
    case 'review_left':
      return `Left a ${b.rating}-star review for ${name}`
    case 'trip_anniversary':
      return `A year since ${name}`
    default:
      return `Started with ${name}`
  }
}

interface Collected {
  entries: Entry[]
  /** Guests made up for this run: sign-ups, gift card buyers, requests. */
  pseudo: Map<string, IGuest>
}

function pseudoGuest(id: string, name: string, email: string, phone: string, at: number, optIn: boolean, source?: JoinSource): IGuest {
  const [firstName, ...rest] = name.trim().split(/\s+/)
  return {
    id,
    firstName: firstName || 'Guest',
    lastName: rest.join(' '),
    name: name.trim() || 'Guest',
    email,
    phone,
    country: '',
    tags: [],
    segment: 'new',
    emailOptIn: optIn,
    smsOptIn: optIn && Boolean(phone),
    totalBookings: 0,
    lifetimeValue: 0,
    lastBookingAt: null,
    createdAt: iso(at),
    createdMs: at,
    joinSource: source,
    pseudo: true,
    canEmail: Boolean(email),
    canText: Boolean(phone),
  }
}

function collectEntries(flow: Flow, world: FlowWorld, fromMs: number, toMs: number, isMarketing: boolean): Collected {
  const trigger = flow.trigger
  const offsetDuration = trigger.offset ?? DEFAULT_OFFSET[trigger.type]
  const offset = durationMs(offsetDuration)
  const inWindow = (ms: number | null): ms is number => ms !== null && ms >= fromMs && ms <= toMs
  const entries: Entry[] = []
  const pseudo = new Map<string, IGuest>()
  const currency = world.data.currency

  if (BOOKING_TRIGGERS.has(trigger.type)) {
    for (const b of world.bookings) {
      const at = bookingMoment(trigger, b, offset)
      if (!inWindow(at)) continue
      const guest = world.guests.get(b.customerId)
      if (!guest) continue
      entries.push({ at, guest, booking: b, departure: world.departureById.get(b.departureId), text: () => bookingEntryText(trigger, b, offsetDuration, currency), key: b.id })
    }
    return { entries, pseudo }
  }

  switch (trigger.type) {
    case 'joined_list': {
      const sources = trigger.sources ?? []
      const wants = (source: string) => sources.length === 0 || (sources as string[]).includes(source)
      for (const guest of world.guests.values()) {
        if (!guest.emailOptIn) continue
        const source = guest.joinSource ?? 'checkout'
        if (!wants(source) || !inWindow(guest.createdMs)) continue
        entries.push({ at: guest.createdMs, guest, text: `Joined your list ${SOURCE_TEXT[source] ?? ''}`.trim(), key: guest.id })
      }
      for (const signup of world.extras.signups) {
        const at = parseMs(signup.at)
        if (!inWindow(at) || !wants(signup.source) || !signup.email) continue
        const email = signup.email.toLowerCase()
        let guest = world.guestByEmail.get(email) ?? pseudo.get(`signup:${email}`)
        if (!guest) {
          guest = pseudoGuest(`signup:${email}`, signup.name ?? signup.email.split('@')[0], signup.email, signup.phone ?? '', at, true, signup.source as JoinSource)
          pseudo.set(guest.id, guest)
        }
        entries.push({ at, guest, text: `Joined your list ${SOURCE_TEXT[signup.source] ?? ''}`.trim(), key: guest.id })
      }
      break
    }
    case 'checkout_abandoned': {
      for (const cart of world.data.abandoned) {
        const left = parseMs(cart.abandonedAt)
        if (left === null) continue
        const at = left + offset
        const guest = world.guests.get(cart.customerId)
        if (!guest || !inWindow(at)) continue
        // Came back and paid before the nudge was due: nothing to rescue.
        const recovered = parseMs(cart.recoveredAt)
        if (recovered !== null && recovered <= at) continue
        entries.push({ at, guest, departure: world.departureById.get(cart.departureId), about: { activityName: cart.activityName }, text: `Left the checkout for ${cart.activityName}`, key: cart.id })
      }
      break
    }
    case 'lapsed': {
      for (const [guestId, own] of world.bookingsByGuest) {
        const guest = world.guests.get(guestId)
        if (!guest) continue
        // The clock runs from their latest trip that stood (or the booking, when that is later),
        // so a guest who booked far ahead lapses after the trip, not before it.
        let lastTripMs = -Infinity
        for (let i = 0; i < own.length; i++) {
          if (standing(own[i].status) && !own[i].recoveredCart) lastTripMs = Math.max(lastTripMs, own[i].endMs)
          const at = Math.max(own[i].createdMs, lastTripMs) + offset
          const next = own[i + 1]
          if (next && next.createdMs <= at) continue
          if (!inWindow(at)) continue
          // Not lapsed while a trip they booked is still to come.
          let tripAhead = false
          for (let k = 0; k <= i && !tripAhead; k++) {
            const b = own[k]
            tripAhead = b.startMs > at && (standing(b.status) || (b.cancelledMs !== null && b.cancelledMs > at))
          }
          if (tripAhead) continue
          entries.push({ at, guest, about: { activityName: own[i].activityName }, text: `No booking for ${offsetDuration ? durationText(offsetDuration) : 'a while'}`, key: `${guestId}:${own[i].id}` })
        }
      }
      break
    }
    case 'became_vip': {
      for (const [guestId, own] of world.bookingsByGuest) {
        const guest = world.guests.get(guestId)
        if (!guest) continue
        let count = 0
        for (const b of own) {
          if (!standing(b.status)) continue
          count++
          if (count === 3) {
            if (inWindow(b.createdMs)) entries.push({ at: b.createdMs, guest, about: { activityName: b.activityName }, text: 'Made their third booking', key: guestId })
            break
          }
        }
      }
      break
    }
    case 'request_received': {
      for (const request of world.extras.requests) {
        const at = parseMs(request.at)
        if (!inWindow(at)) continue
        let guest = request.customerId ? world.guests.get(request.customerId) : undefined
        if (!guest && request.email) guest = world.guestByEmail.get(request.email.toLowerCase())
        if (!guest) {
          guest = pseudoGuest(`request:${request.id}`, request.name, request.email ?? '', request.phone ?? '', at, false)
          pseudo.set(guest.id, guest)
        }
        entries.push({ at, guest, text: 'Sent a request', key: request.id })
      }
      break
    }
    case 'gift_card_bought':
    case 'gift_card_expiring': {
      const bought = trigger.type === 'gift_card_bought'
      for (const card of world.data.giftCards) {
        if (card.status === 'void') continue
        const issued = parseMs(card.issuedAt)
        const expires = parseMs(card.expiresAt)
        const at = bought ? issued : card.status === 'active' && card.balance > 0 && expires !== null ? expires - offset : null
        if (!inWindow(at)) continue
        const person = bought ? card.purchaser : card.recipient
        const email = bought ? '' : card.recipientEmail
        let guest = (email ? world.guestByEmail.get(email.toLowerCase()) : undefined) ?? world.guestByName.get(person.toLowerCase())
        if (!guest) {
          // Not on the guest list: buying or getting a gift card is not a yes to marketing.
          guest = pseudoGuest(`gift:${card.code}:${bought ? 'buyer' : 'recipient'}`, person, email, '', at, false)
          pseudo.set(guest.id, guest)
        }
        entries.push({
          at,
          guest,
          text: () => bought ? `Bought a ${formatCurrency(card.initial, currency)} gift card` : `Gift card with ${formatCurrency(card.balance, currency)} left ends in ${offsetDuration ? durationText(offsetDuration) : 'a few days'}`,
          key: card.code,
        })
      }
      break
    }
    case 'low_fill':
    case 'weather_alert': {
      const low = trigger.type === 'low_fill'
      const reach = trigger.reach ?? (low ? 'past_guests_of_activity' : 'booked_guests')
      const fillBelow = trigger.fillBelow ?? 50
      const hasWho = flow.who.conditions.length > 0
      const lastOffer = new Map<string, number>()
      const offeredIn = new Map<string, string>()
      const consent = (guest: IGuest | undefined): guest is IGuest => guest !== undefined && (!isMarketing || guest.emailOptIn || guest.smsOptIn)
      const pools = new Map<string, { queue: IGuest[]; head: number; firstStart?: Map<string, number> }>()
      const poolFor = (key: string) => {
        let pool = pools.get(key)
        if (pool) return pool
        if (key === 'audience') pool = { queue: (audienceMembers ?? []).filter(consent), head: 0 }
        else {
          const past = world.pastGuestsByActivity.get(key) ?? []
          pool = { queue: past.map((entry) => world.guests.get(entry.guestId)).filter(consent), head: 0, firstStart: new Map(past.map((entry) => [entry.guestId, entry.firstStartMs])) }
        }
        pools.set(key, pool)
        return pool
      }
      const reentry = flow.settings.reentry
      const offerSpacing = reentry === 'once' ? Infinity : reentry === 'every' ? Math.max(1, flow.settings.reentryDays || 1) * DAY : DAY
      let audienceMembers: IGuest[] | null = null
      if (reach === 'audience') {
        // The built-in lists (Locals, VIPs…) are there even when the page sent no audiences.
        const audience =
          world.extras.audiences.find((entry) => entry.id === trigger.audienceId) ??
          defaultAudiences(world.data.homeCountry).find((entry) => entry.id === trigger.audienceId)
        audienceMembers = []
        if (audience) {
          for (const guest of world.guests.values()) {
            const contact = world.contacts.get(guest.id)
            if (contact && matchesAudience(contact, audience.filter, world.data.nowIso, { homeCountry: world.data.homeCountry })) audienceMembers.push(guest)
          }
        }
      }
      for (const d of world.departures) {
        // Past departures read 'completed' today; what counts is how full they were back then.
        if (d.status === 'cancelled') continue
        const at = d.startMs - offset
        if (!inWindow(at)) continue
        let fill = 0
        if (low) {
          if (d.capacity <= 0 || (at >= world.nowMs && d.status === 'sold_out')) continue
          fill = (seatsAt(world, d, at) / d.capacity) * 100
          if (fill >= fillBelow) continue
        } else if (!(d.status === 'weather_hold' || (d.weather && d.weather.goConfidence < 50))) continue
        const date = `${dayText(d.startMs)}, ${clockText(d.startMs)}`
        const text = low ? `${d.activityName} on ${date} is ${Math.round(fill)}% full` : `Weather may affect ${d.activityName} on ${date}`
        const booked = (world.bookingsByDeparture.get(d.id) ?? []).filter((b) => b.createdMs <= at && (b.cancelledMs === null || b.cancelledMs > at))
        if (reach === 'booked_guests') {
          for (const b of booked) {
            const guest = world.guests.get(b.customerId)
            if (guest) entries.push({ at, guest, booking: b, departure: d, text, key: `${b.id}:${d.id}` })
          }
          continue
        }
        const bookedHere = new Set(booked.map((b) => b.customerId))
        let departureFacts: DepartureFacts | undefined
        const poolKey = reach === 'audience' ? 'audience' : d.activitySlug
        const pool = poolFor(poolKey)
        const back: IGuest[] = []
        let added = 0
        const end = pool.queue.length
        // Free seats go to guests who match "who", and each guest hears about them at most once per
        // re-entry spacing (once a day for "every time"), so 30 quiet departures in a day reach
        // different people instead of the same people 30 times. Lists rotate: whoever heard last
        // goes to the back, so the scan stays short however many departures there are.
        while (added < REACH_CAP && pool.head < end) {
          const guest = pool.queue[pool.head++]
          const last = lastOffer.get(guest.id)
          if (last !== undefined && at - last < offerSpacing) {
            if (offerSpacing === Infinity) continue
            // Everyone behind them on this list heard even more recently.
            if (offeredIn.get(guest.id) === poolKey) {
              pool.head--
              break
            }
            back.push(guest)
            continue
          }
          const first = pool.firstStart?.get(guest.id)
          let fits = !bookedHere.has(guest.id) && (first === undefined || first < at)
          if (fits && hasWho) {
            departureFacts ??= departureFactsAt(world, d, at)
            fits = evaluate(flow.who, { guest: guestFactsAt(world, guest, at), departure: departureFacts })
          }
          if (!fits) {
            back.push(guest)
            continue
          }
          lastOffer.set(guest.id, at)
          offeredIn.set(guest.id, poolKey)
          entries.push({ at, guest, departure: d, text, key: `${guest.id}:${d.id}`, whoChecked: true })
          added++
          if (offerSpacing !== Infinity) back.push(guest)
        }
        for (const guest of back) pool.queue.push(guest)
        if (pool.head > 1024 && pool.head * 2 > pool.queue.length) {
          pool.queue = pool.queue.slice(pool.head)
          pool.head = 0
        }
      }
      break
    }
    default:
      break
  }
  return { entries, pseudo }
}

/** When nothing could start it, say why in plain words. */
function emptyNote(trigger: FlowTrigger, days: number): string {
  switch (trigger.type) {
    case 'manual':
      return 'Your team starts this one by hand from a booking or a guest, so there is nothing to replay.'
    case 'booking_changed':
      return 'Changed bookings are not kept in this demo yet, so there is nothing to replay.'
    case 'request_received':
      return `No requests came in over the last ${days} days.`
    case 'gift_card_bought':
    case 'gift_card_expiring':
      return `No gift cards were bought or are ending in this time.`
    case 'payment_failed':
      return `No payments failed over the last ${days} days.`
    case 'trip_anniversary':
      return 'Your bookings don’t go back a full year yet, so no trip anniversaries fell in this time.'
    default:
      return `Nothing started this over the last ${days} days.`
  }
}

/* ---------- the run ---------- */

export interface SimulateOptions {
  /** Days replayed behind now. Default 60. */
  days?: number
  /** Days ahead counted into `upcoming`. Default 7. */
  aheadDays?: number
  /** Journeys returned. Default 60. */
  journeys?: number
  /** Always return this guest's journeys; when nothing started it for them, preview one from their latest booking. */
  focusGuestId?: string
  /** Set false to skip the made-up preview journey for the focus guest. */
  previewIfAbsent?: boolean
  /** Replay only this guest (much faster; same result for them). */
  onlyGuestId?: string
}

interface Send {
  ms: number
  stepId: string
}

interface Journey {
  entry: Entry
  guest: IGuest
  enteredMs: number
  clock: number
  events: JourneyEvent[] | null
  opens: number[]
  clicks: number[]
  replies: number[]
  sends: Send[]
  /** Every send time this journey added to the guest's list (sent or scheduled), for smart sending. */
  pushed: number[]
  tags: string[] | null
  unsubscribed: boolean
  code: { code: string; percent: number } | null
  /** The step they are at when the clock passes now. */
  waitingAt: string | null
  exited: { at: number; reason: string } | null
  ended: boolean
  /** Counts towards the numbers (not a preview, not a future entry). */
  counts: boolean
  /** Counts towards messages due ahead (anything but a preview). */
  projects: boolean
  /** Message-level skip reasons already counted for this guest, so `skipped` counts guests, not messages. */
  skipReasons: string[] | null
}

const EVENT_RANK: Partial<Record<JourneyEventKind, number>> = { entered: 0, booked: 1, exited: 2, finished: 3 }

function blankStats(step: FlowStep): StepStats {
  const stats: StepStats = { reached: 0, waiting: 0, sent: 0, opened: 0, clicked: 0, bookings: 0, revenue: 0 }
  if (step.type === 'branch' || step.type === 'split') {
    stats.yes = 0
    stats.no = 0
  }
  return stats
}

function eachStep(steps: FlowStep[], fn: (step: FlowStep) => void) {
  for (const step of steps) {
    fn(step)
    if (step.type === 'branch') {
      eachStep(step.yes, fn)
      eachStep(step.no, fn)
    } else if (step.type === 'split') {
      eachStep(step.a, fn)
      eachStep(step.b, fn)
    }
  }
}

/** Unfilled details read as their friendly label in journeys, never as a raw {token}. */
const PLACEHOLDER_LABEL = new Map([...PLACEHOLDERS.map((p) => [p.token.slice(1, -1), p.label] as const), ['seats_left', 'Seats left'] as const])

/** Phrases for a branch's outcome when it asks one plain question. */
const FLOW_PHRASE: Record<string, [string, string]> = {
  'flow.booked': ['had booked', 'hadn’t booked'],
  'flow.opened': ['had opened it', 'hadn’t opened it'],
  'flow.clicked': ['had clicked', 'hadn’t clicked'],
  'flow.replied': ['had replied', 'hadn’t replied'],
}

const ACTION_DONE: Record<ActionStep['action'], string> = {
  add_tag: 'Tagged',
  remove_tag: 'Took off the tag',
  give_code: 'Got a code',
  notify_team: 'Told your team',
  create_task: 'Added a to-do for your team',
  add_note: 'Added a note to the guest',
  unsubscribe: 'Stopped marketing to them',
}

/**
 * Replays the flow over the demo and returns its numbers and journeys.
 * `world` comes from createWorld (+ withExtras); `world.data.nowIso` is the clock.
 */
export function simulate(flow: Flow, world: FlowWorld, opts: SimulateOptions = {}): FlowRun {
  const days = opts.days ?? 60
  const aheadDays = opts.aheadDays ?? 7
  const journeyCap = opts.journeys ?? 60
  const nowMs = world.nowMs
  const fromMs = nowMs - days * DAY
  const toMs = nowMs + aheadDays * DAY
  const { settings: marketing } = world.extras
  const currency = world.data.currency
  const isMarketing = flow.purpose === 'marketing'
  const conversionMs = Math.max(1, flow.settings.conversionDays || 5) * DAY

  const perStep: Record<string, StepStats> = {}
  const channels = new Set<'email' | 'sms'>()
  eachStep(flow.steps, (step) => {
    perStep[step.id] = blankStats(step)
    if (step.type === 'email' || step.type === 'sms') channels.add(step.type)
  })

  const run: FlowRun = {
    flowId: flow.id,
    from: iso(fromMs),
    to: iso(toMs),
    entered: 0,
    active: 0,
    finished: 0,
    exited: 0,
    skipped: [],
    holdout: 0,
    messages: 0,
    bookings: 0,
    revenue: 0,
    lift: null,
    perStep,
    upcoming: {},
    daily: {},
    journeys: [],
    credits: [],
  }
  const credits = run.credits!

  const skipped = new Map<string, number>()
  const skip = (reason: string, counts: boolean) => {
    if (counts) skipped.set(reason, (skipped.get(reason) ?? 0) + 1)
  }
  /** A message skipped inside the flow: counted once per guest and reason. */
  const skipMessage = (j: Journey, reason: string) => {
    if (!j.counts) return
    if (j.skipReasons?.includes(reason)) return
    if (!j.skipReasons) j.skipReasons = []
    j.skipReasons.push(reason)
    skip(reason, true)
  }

  const collected = collectEntries(flow, world, fromMs, toMs, isMarketing)
  const { pseudo } = collected
  const entries = opts.onlyGuestId ? collected.entries.filter((entry) => entry.guest.id === opts.onlyGuestId) : collected.entries
  entries.sort((a, b) => a.at - b.at || (a.guest.id < b.guest.id ? -1 : a.guest.id > b.guest.id ? 1 : 0))

  // Only the newest journeys, and the focus guest's, keep their events.
  const focusId = opts.focusGuestId
  let pastCount = 0
  for (const entry of entries) if (entry.at <= nowMs) pastCount++
  const keepFrom = Math.max(0, pastCount - journeyCap)
  // Before any preview is added: the note explains a flow nothing really started.
  const nothingStarted = collected.entries.length === 0

  if (focusId && opts.previewIfAbsent !== false && !entries.some((entry) => entry.guest.id === focusId)) {
    const preview = previewEntry(flow, world, focusId, pseudo)
    if (preview) entries.push(preview)
  }

  const attributed = new Set<string>()
  const previewAttributed = new Set<string>()
  const sendsByGuest = new Map<string, number[]>()
  const lastEntry = new Map<string, number>()
  const seenKeys = new Set<string>()
  /** When a guest was taken off marketing by "Stop marketing to them": it holds for every later journey too. */
  const unsubscribedAt = new Map<string, number>()
  const stoppedBy = (guestId: string, at: number) => (unsubscribedAt.get(guestId) ?? Infinity) <= at
  const lift = { inGuests: 0, inBookings: 0, outGuests: 0, outBookings: 0 }
  /** Lift counts each guest once, from their first entry, so frequent guests don't count many times. */
  const liftSeen = new Set<string>()
  const kept: GuestJourney[] = []

  /* ---- helpers that read the journey ---- */

  const ownBookings = (guestId: string) => world.bookingsByGuest.get(guestId) ?? []

  /** First booking they made in (from, to], not the one the flow is about. */
  const bookingBetween = (j: Journey, from: number, to: number): IBooking | undefined => {
    const limit = Math.min(to, nowMs)
    for (const b of ownBookings(j.guest.id)) {
      if (b.createdMs <= from) continue
      if (b.createdMs > limit) break
      if (b.id === j.entry.booking?.id || !standing(b.status)) continue
      return b
    }
    return undefined
  }

  const flowFactsAt = (j: Journey, at: number): FlowFacts => {
    const limit = Math.min(at, nowMs)
    return {
      opened: j.opens.some((ms) => ms <= limit),
      clicked: j.clicks.some((ms) => ms <= limit),
      replied: j.replies.some((ms) => ms <= limit),
      booked: Boolean(bookingBetween(j, j.enteredMs, limit)),
    }
  }

  const hasWho = flow.who.conditions.length > 0

  /** Which parts of the facts a group reads, so only those are worked out. */
  const scopes = new Map<ConditionGroup, Set<string>>()
  const scopesOf = (group: ConditionGroup) => {
    let found = scopes.get(group)
    if (!found) scopes.set(group, (found = new Set(group.conditions.map((condition) => condition.field.slice(0, condition.field.indexOf('.'))))))
    return found
  }

  const factsAt = (entry: Entry, group: ConditionGroup, at: number, tags?: string[] | null, j?: Journey): Facts => {
    const needs = scopesOf(group)
    const facts: Facts = {}
    if (needs.has('guest')) facts.guest = guestFactsAt(world, entry.guest, at, tags ?? undefined)
    if (needs.has('booking') && entry.booking) facts.booking = bookingFactsAt(entry.booking, at)
    if (needs.has('departure') && entry.departure) facts.departure = departureFactsAt(world, entry.departure, at)
    if (needs.has('flow') && j) facts.flow = flowFactsAt(j, at)
    return facts
  }

  /** Text can be a function: it is only worked out for journeys that keep their events. */
  const record = (j: Journey, at: number, kind: JourneyEventKind, text: string | (() => string), stepId?: string, value?: number) => {
    if (!j.events) return
    const event: JourneyEvent = { at: iso(at), kind, text: typeof text === 'function' ? text() : text }
    if (stepId) event.stepId = stepId
    if (value !== undefined) event.value = value
    j.events.push(event)
  }

  /** Exit rules that fire as time passes: a new booking, or the booking cancelled. */
  const exitBetween = (j: Journey, from: number, to: number): { at: number; reason: string } | null => {
    let best: { at: number; reason: string } | null = null
    if (flow.exit.onBooked) {
      const b = bookingBetween(j, Math.max(from, j.enteredMs), to)
      if (b) best = { at: b.createdMs, reason: 'booked again' }
    }
    const subject = j.entry.booking
    if (flow.exit.onCancelled && subject && subject.cancelledMs !== null && subject.cancelledMs > from && subject.cancelledMs <= Math.min(to, nowMs)) {
      if (!best || subject.cancelledMs < best.at) best = { at: subject.cancelledMs, reason: 'the booking was cancelled' }
    }
    return best
  }

  const leave = (j: Journey, exit: { at: number; reason: string }) => {
    j.exited = exit
    j.ended = true
    j.clock = exit.at
    record(j, exit.at, 'exited', `Left: ${exit.reason}`)
  }

  /** Move the clock forward, leaving on the way if an exit rule fires. */
  const advance = (j: Journey, to: number): boolean => {
    if (to <= j.clock) return true
    const exit = exitBetween(j, j.clock, to)
    if (exit) {
      leave(j, exit)
      return false
    }
    j.clock = to
    return true
  }

  const markWaiting = (j: Journey, stepId: string) => {
    if (j.waitingAt !== null) return
    j.waitingAt = stepId
    if (j.counts) perStep[stepId].waiting++
  }

  const messageContext = (j: Journey): Partial<MessageContext> => {
    const b = j.entry.booking
    const d = j.entry.departure
    const startMs = b?.startMs ?? d?.startMs
    return {
      first_name: j.guest.firstName,
      business: world.data.business,
      activity: b?.activityName ?? d?.activityName ?? j.entry.about?.activityName,
      date: startMs !== undefined ? dayText(startMs) : undefined,
      time: startMs !== undefined ? clockText(startMs) : undefined,
      party: b ? `${b.partySize} ${b.partySize === 1 ? 'guest' : 'guests'}` : undefined,
      reference: b?.reference,
      balance: b ? formatCurrency(Math.max(0, b.total - b.amountPaid), currency) : undefined,
      offer_code: j.code?.code,
      offer_percent: j.code ? `${j.code.percent}%` : undefined,
    }
  }

  const fill = (text: string, j: Journey) => {
    const d = j.entry.departure
    // Seats left is only known for a departure, at the moment the message goes.
    const withSeats =
      d && text.includes('{seats_left}') ? text.replace(/\{seats_left\}/g, String(Math.max(0, d.capacity - seatsAt(world, d, Math.min(j.clock, nowMs))))) : text
    return renderTemplate(withSeats, messageContext(j)).replace(/\{([a-z_]+)\}/g, (_, key: string) => PLACEHOLDER_LABEL.get(key) ?? key.replace(/_/g, ' '))
  }

  const short = (text: string, max = 60) => {
    const one = text.replace(/\s+/g, ' ').trim()
    return one.length > max ? `${one.slice(0, max - 1).trimEnd()}…` : one
  }

  /** Quiet hours and send days: the first moment at or after `ms` a message may go. */
  const quietFrom = minutesOf(marketing.quietHours.from)
  const quietTo = minutesOf(marketing.quietHours.to)
  const quiet = flow.settings.quietHours && marketing.quietHours.enabled && quietFrom !== null && quietTo !== null && quietFrom !== quietTo
  const sendDays = flow.settings.sendDays
  const sendTime = (ms: number): { at: number; why: string | null } => {
    let at = ms
    let why: string | null = null
    const from = quietFrom ?? 0
    const to = quietTo ?? 0
    for (let pass = 0; pass < 4; pass++) {
      let moved = false
      const date = new Date(at)
      if (sendDays.length > 0 && !sendDays.includes(date.getDay())) {
        at = nextTimeOfDay(atMinutes(at, 0, 1), 9 * 60, sendDays)
        why = 'sends only on chosen days'
        moved = true
      }
      if (quiet) {
        const d = moved ? new Date(at) : date
        const m = d.getHours() * 60 + d.getMinutes()
        const wraps = from > to
        const inQuiet = wraps ? m >= from || m < to : m >= from && m < to
        if (inQuiet) {
          at = wraps && m >= from ? atMinutes(at, to, 1) : atMinutes(at, to)
          why = 'quiet hours'
          moved = true
        }
      }
      if (!moved) break
    }
    return { at, why }
  }

  /** The channel a message goes on for this guest, or why it cannot go. */
  const channelFor = (j: Journey, wanted: 'email' | 'sms'): { channel: 'email' | 'sms' } | { reason: string } => {
    const stopped = isMarketing && (j.unsubscribed || stoppedBy(j.guest.id, j.clock))
    const can = (channel: 'email' | 'sms') => {
      if (isMarketing) {
        if (stopped) return false
        return channel === 'email' ? j.guest.emailOptIn && j.guest.canEmail : j.guest.smsOptIn && j.guest.canText
      }
      return channel === 'email' ? j.guest.canEmail : j.guest.canText
    }
    if (can(wanted)) return { channel: wanted }
    const other = wanted === 'email' ? 'sms' : 'email'
    if (flow.settings.channelFallback && can(other)) return { channel: other }
    if (stopped) return { reason: 'Stopped marketing to them' }
    if (isMarketing) return { reason: 'No marketing consent' }
    return { reason: wanted === 'email' ? 'No email address' : 'No mobile number' }
  }

  /* ---- steps ---- */

  /** Each message's own open, click and reply rates: steady per flow and step. */
  const rates = new Map<string, { open: number; openB: number; click: number; tap: number; reply: number }>()
  const ratesFor = (stepId: string) => {
    let found = rates.get(stepId)
    if (!found) {
      const h = hashOf(`${flow.id}|${stepId}|rates`)
      found = { open: 0.38 + mixed(h, 1) * 0.17, openB: 0.38 + mixed(h, 2) * 0.17, click: 0.09 + mixed(h, 3) * 0.09, tap: 0.1 + mixed(h, 4) * 0.1, reply: 0.03 + mixed(h, 5) * 0.03 }
      rates.set(stepId, found)
    }
    return found
  }

  const sendMessage = (j: Journey, step: EmailStep | SmsStep) => {
    const stats = perStep[step.id]
    // At the moment they entered, with no tags changed, the answer is the one they entered with.
    const sameAsEntry = j.clock === j.enteredMs && j.tags === null
    if (flow.exit.whenNoLongerMatching && hasWho && !sameAsEntry && j.clock <= nowMs && !evaluate(flow.who, factsAt(j.entry, flow.who, j.clock, j.tags))) {
      leave(j, { at: j.clock, reason: 'no longer matches who can enter' })
      return
    }
    const timing = sendTime(j.clock)
    if (timing.at > j.clock) {
      if (timing.at <= nowMs) record(j, timing.at, 'held', () => `Held until ${dayText(timing.at) === dayText(j.clock) ? '' : `${dayText(timing.at)} `}${clockText(timing.at)} (${timing.why})`, step.id)
      if (!advance(j, timing.at)) return
    }
    const past = j.clock <= nowMs
    if (past && j.counts) stats.reached++

    const pick = channelFor(j, step.type)
    // Estimated engagement: steady per guest and step, so numbers never jump.
    const seed = hashOf(`${flow.id}|${j.guest.id}|${step.id}`)
    const useB = step.type === 'email' && Boolean(step.subjectB) && mixed(seed, 7) < 0.5
    const label = () => (step.type === 'email' ? `the email “${short(fill(useB ? step.subjectB ?? step.subject : step.subject, j))}”` : `the text “${short(fill(step.body, j))}”`)
    if ('reason' in pick) {
      if (past) {
        record(j, j.clock, 'skipped', () => `Didn't get ${label()}: ${pick.reason.charAt(0).toLowerCase()}${pick.reason.slice(1)}`, step.id)
        skipMessage(j, pick.reason)
      }
      return
    }
    const sentAs = pick.channel
    const sentLabel = () => (sentAs === step.type ? label() : sentAs === 'sms' ? `a text instead of ${label()}` : `an email instead of ${label()}`)

    if (isMarketing && flow.settings.smartSending) {
      const sends = sendsByGuest.get(j.guest.id) ?? []
      // This journey's own messages at the same moment (an email and a text sent together) are one message, not two.
      const together = j.pushed.filter((ms) => Math.abs(ms - j.clock) < 5 * MINUTE).length
      if (sends.filter((ms) => Math.abs(ms - j.clock) < 16 * HOUR).length > together) {
        if (past) {
          record(j, j.clock, 'skipped', () => `Skipped ${label()}: got another message within 16 hours`, step.id)
          skipMessage(j, 'Got another message within 16 hours')
        }
        return
      }
      if (marketing.frequencyCap.enabled && sends.filter((ms) => ms <= j.clock && ms > j.clock - 7 * DAY).length - together >= marketing.frequencyCap.perWeek) {
        if (past) {
          record(j, j.clock, 'skipped', () => `Skipped ${label()}: already had ${marketing.frequencyCap.perWeek} this week`, step.id)
          skipMessage(j, 'Hit the weekly limit')
        }
        return
      }
    }

    // Marketing's "don't send just before a trip": only for flows not about a booking (a pre-trip upsell is meant to land then).
    if (isMarketing && !j.entry.booking && marketing.skipUpcoming.enabled && tripSoon(j.guest.id, j.clock, marketing.skipUpcoming.days)) {
      if (past) {
        record(j, j.clock, 'skipped', () => `Skipped ${label()}: they have a trip in the next ${marketing.skipUpcoming.days} ${marketing.skipUpcoming.days === 1 ? 'day' : 'days'}`, step.id)
        skipMessage(j, 'Has a trip coming up')
      }
      return
    }

    if (!past) {
      markWaiting(j, step.id)
      record(j, j.clock, 'scheduled', () => `Will get ${sentLabel()}`, step.id)
      if (j.projects && j.clock <= toMs) {
        const key = toDateKey(new Date(j.clock))
        run.upcoming[key] = (run.upcoming[key] ?? 0) + 1
      }
      if (isMarketing) pushSend(j, j.clock)
      return
    }

    record(j, j.clock, 'sent', () => `Got ${sentLabel()}`, step.id)
    j.sends.push({ ms: j.clock, stepId: step.id })
    if (isMarketing) pushSend(j, j.clock)
    if (j.counts) {
      stats.sent++
      run.messages++
      const key = toDateKey(new Date(j.clock))
      run.daily[key] = (run.daily[key] ?? 0) + 1
    }

    const rate = ratesFor(step.id)
    if (sentAs === 'email') {
      if (mixed(seed, 1) < (useB ? rate.openB : rate.open)) {
        const openAt = j.clock + (15 + Math.round(mixed(seed, 2) * 345)) * MINUTE
        if (openAt <= nowMs) {
          j.opens.push(openAt)
          record(j, openAt, 'opened', 'Opened the email', step.id)
          if (j.counts) stats.opened++
          if (mixed(seed, 3) < rate.click) {
            const clickAt = openAt + (2 + Math.round(mixed(seed, 4) * 28)) * MINUTE
            if (clickAt <= nowMs) {
              j.clicks.push(clickAt)
              record(j, clickAt, 'clicked', 'Clicked a link in the email', step.id)
              if (j.counts) stats.clicked++
            }
          }
        }
      }
    } else {
      if (mixed(seed, 3) < rate.tap) {
        const clickAt = j.clock + (5 + Math.round(mixed(seed, 4) * 85)) * MINUTE
        if (clickAt <= nowMs) {
          j.clicks.push(clickAt)
          record(j, clickAt, 'clicked', 'Tapped the link in the text', step.id)
          if (j.counts) stats.clicked++
        }
      }
      if (mixed(seed, 5) < rate.reply) {
        const replyAt = j.clock + (10 + Math.round(mixed(seed, 6) * 110)) * MINUTE
        if (replyAt <= nowMs) {
          j.replies.push(replyAt)
          record(j, replyAt, 'action', 'Replied to the text', step.id)
        }
      }
    }
  }

  const pushSend = (j: Journey, ms: number) => {
    j.pushed.push(ms)
    const list = sendsByGuest.get(j.guest.id)
    if (list) list.push(ms)
    else sendsByGuest.set(j.guest.id, [ms])
  }

  const waitStep = (j: Journey, step: WaitStep) => {
    const stats = perStep[step.id]
    if (j.clock <= nowMs && j.counts) stats.reached++
    const start = j.clock
    let until = start
    let text = ''
    switch (step.mode) {
      case 'for': {
        until = start + durationMs(step.duration)
        text = step.duration ? `Waited ${durationText(step.duration)}` : 'Moved straight on'
        break
      }
      case 'until_time': {
        const minutes = minutesOf(step.time) ?? 9 * 60
        until = nextTimeOfDay(start, minutes, step.days)
        text = `Waited until ${dayText(until) === dayText(start) ? '' : `${dayText(until)} `}${clockText(until)}`
        break
      }
      case 'until_before_start': {
        const startMs = j.entry.booking?.startMs ?? j.entry.departure?.startMs
        if (startMs === undefined) {
          text = 'No start time to wait for: moved on'
          break
        }
        const target = startMs - durationMs(step.duration)
        if (target <= start) {
          if (start <= nowMs) record(j, start, 'waited', 'Already that close to the start: moved on', step.id)
          return
        }
        until = target
        text = `Waited until ${step.duration ? durationText(step.duration) : 'just'} before the start`
        break
      }
      case 'until_event': {
        const limit = start + durationMs(step.timeout ?? { amount: 3, unit: 'days' })
        let hit: number | null = null
        const firstAfter = (list: number[]) => {
          let best: number | null = null
          for (const ms of list) if (ms <= limit && (best === null || ms < best)) best = ms
          return best === null ? null : Math.max(best, start)
        }
        const b = j.entry.booking
        switch (step.event) {
          case 'booked': {
            const found = bookingBetween(j, j.enteredMs, limit)
            hit = found ? Math.max(found.createdMs, start) : null
            break
          }
          case 'opened':
            hit = firstAfter(j.opens)
            break
          case 'clicked':
            hit = firstAfter(j.clicks)
            break
          case 'replied':
            hit = firstAfter(j.replies)
            break
          case 'paid':
            hit = b && b.amountPaid >= b.total ? start : null
            break
          case 'waivers_signed':
            hit = b && b.waiversMissing === 0 ? start : null
            break
          default:
            hit = null
        }
        const what = { booked: 'booked', opened: 'opened it', clicked: 'clicked', replied: 'replied', paid: 'paid', waivers_signed: 'signed their waivers' }[step.event ?? 'booked']
        if (hit !== null && hit <= nowMs) {
          until = hit
          text = hit === start ? `Had already ${what}: moved on` : `Waited until they ${what}`
        } else {
          until = limit
          text = `Waited ${step.timeout ? durationText(step.timeout) : '3 days'}: they hadn't ${what}`
        }
        break
      }
    }
    if (!advance(j, until)) return
    if (until > nowMs) markWaiting(j, step.id)
    else record(j, until, 'waited', text, step.id)
  }

  const actionStep = (j: Journey, step: ActionStep) => {
    const stats = perStep[step.id]
    const past = j.clock <= nowMs
    if (past && j.counts) stats.reached++
    let text = ACTION_DONE[step.action]
    switch (step.action) {
      case 'add_tag':
      case 'remove_tag': {
        const tag = step.tag?.trim()
        if (!tag) break
        text = `${text} “${tag}”`
        const tags = j.tags ?? [...j.guest.tags]
        j.tags = step.action === 'add_tag' ? (tags.includes(tag) ? tags : [...tags, tag]) : tags.filter((entry) => entry !== tag)
        break
      }
      case 'give_code': {
        const code = step.code ?? { percent: 10, validDays: 14, prefix: 'THANKS' }
        const suffix = Math.floor(chance(`${flow.id}|${j.guest.id}|${step.id}|code`) * 1_000_000)
          .toString(36)
          .toUpperCase()
          .padStart(4, 'X')
        // The same prefix Promo codes knows the family by, so checkout takes the guest's code.
        j.code = { code: `${codePrefix(code.prefix)}-${suffix}`, percent: code.percent }
        text = `Got a ${code.percent}% code, ${j.code.code}, good for ${code.validDays} ${code.validDays === 1 ? 'day' : 'days'}`
        break
      }
      case 'notify_team':
      case 'create_task':
      case 'add_note':
        if (j.events && step.message?.trim()) text = `${text}: “${short(fill(step.message, j), 70)}”`
        break
      case 'unsubscribe':
        j.unsubscribed = true
        if (!stoppedBy(j.guest.id, j.clock)) unsubscribedAt.set(j.guest.id, j.clock)
        break
    }
    if (past) record(j, j.clock, 'action', text, step.id)
    else {
      markWaiting(j, step.id)
      record(j, j.clock, 'scheduled', text, step.id)
    }
  }

  const walk = (j: Journey, steps: FlowStep[]) => {
    for (const step of steps) {
      if (j.ended) return
      switch (step.type) {
        case 'email':
        case 'sms':
          sendMessage(j, step)
          break
        case 'wait':
          waitStep(j, step)
          break
        case 'action':
          actionStep(j, step)
          break
        case 'branch': {
          const stats = perStep[step.id]
          const past = j.clock <= nowMs
          const yes = step.when.conditions.length === 0 || evaluate(step.when, factsAt(j.entry, step.when, j.clock, j.tags, j))
          if (past && j.counts) {
            stats.reached++
            if (yes) stats.yes = (stats.yes ?? 0) + 1
            else stats.no = (stats.no ?? 0) + 1
          }
          if (past) {
            const only = step.when.conditions.length === 1 ? step.when.conditions[0] : undefined
            const phrase = only && FLOW_PHRASE[only.field]
            const positive = only ? (only.op === 'no' ? !yes : yes) : yes
            const question = step.label?.trim()
            const path = `Took the ‘${yes ? 'Yes' : 'No'}’ path`
            record(j, j.clock, 'branched', phrase ? `${path}: ${phrase[positive ? 0 : 1]}` : question ? `${path} (${question})` : path, step.id)
          }
          walk(j, yes ? step.yes : step.no)
          break
        }
        case 'split': {
          const stats = perStep[step.id]
          const past = j.clock <= nowMs
          const a = chance(`${flow.id}|${j.guest.id}|${step.id}|split`) * 100 < step.percentA
          if (past && j.counts) {
            stats.reached++
            if (a) stats.yes = (stats.yes ?? 0) + 1
            else stats.no = (stats.no ?? 0) + 1
          }
          if (past) record(j, j.clock, 'split', `Went down path ${a ? 'A' : 'B'} (${a ? step.percentA : 100 - step.percentA}%)`, step.id)
          walk(j, a ? step.a : step.b)
          break
        }
        case 'end': {
          if (j.clock <= nowMs && j.counts) perStep[step.id].reached++
          j.ended = true
          return
        }
      }
    }
  }

  /** Real bookings after a message, credited to the latest message before each. */
  const attribute = (j: Journey) => {
    if (j.sends.length === 0) return
    const used = j.counts ? attributed : previewAttributed
    const until = j.exited && j.exited.reason !== 'booked again' ? j.exited.at : nowMs
    for (const b of ownBookings(j.guest.id)) {
      if (b.createdMs <= j.enteredMs || b.createdMs > until) continue
      if (b.id === j.entry.booking?.id || !standing(b.status) || used.has(b.id)) continue
      let credit: Send | undefined
      for (const send of j.sends) if (send.ms < b.createdMs && b.createdMs - send.ms <= conversionMs) credit = send
      if (!credit) continue
      used.add(b.id)
      record(j, b.createdMs, 'booked', () => `Booked ${b.activityName} · ${formatCurrency(b.total, currency)}`, credit.stepId, b.total)
      if (j.events) j.events[j.events.length - 1].bookingId = b.id
      if (j.counts) {
        perStep[credit.stepId].bookings++
        perStep[credit.stepId].revenue += b.total
        run.bookings++
        run.revenue += b.total
        // Only marketing is credited with bookings in totals, so only marketing sends its list.
        if (isMarketing) credits.push({ bookingId: b.id, sentAt: iso(credit.ms), at: b.createdAt, value: b.total })
      }
    }
  }

  /** A trip they already know about starts within `days` of `at`. */
  function tripSoon(guestId: string, at: number, days: number): boolean {
    const until = at + Math.max(0, days) * DAY
    for (const b of ownBookings(guestId)) {
      if (b.createdMs > at) break
      if (b.startMs <= at || b.startMs > until) continue
      if (standing(b.status) || (b.cancelledMs !== null && b.cancelledMs > at)) return true
    }
    return false
  }

  /** Bookings within the conversion window after `fromMs`, not the one the entry is about. */
  const bookingsAfter = (guestId: string, fromMs: number, excludeId?: string) => {
    const until = Math.min(nowMs, fromMs + conversionMs)
    let count = 0
    for (const b of ownBookings(guestId)) if (b.createdMs > fromMs && b.createdMs <= until && b.id !== excludeId && standing(b.status)) count++
    return count
  }

  const consentNeeded = isMarketing && channels.size > 0
  const reachable = (guest: IGuest, at: number) => {
    if (stoppedBy(guest.id, at)) return false
    for (const channel of channels) {
      if (channel === 'email' && guest.emailOptIn && guest.canEmail) return true
      if (channel === 'sms' && guest.smsOptIn && guest.canText) return true
      if (flow.settings.channelFallback && ((guest.emailOptIn && guest.canEmail) || (guest.smsOptIn && guest.canText))) return true
    }
    return false
  }

  const journeyOf = (j: Journey, state: GuestJourney['state'], reason?: string): GuestJourney => {
    const events = (j.events ?? []).slice()
    events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : (EVENT_RANK[a.kind] ?? 1.5) - (EVENT_RANK[b.kind] ?? 1.5)))
    const journey: GuestJourney = {
      guestId: j.guest.id,
      guestName: j.guest.name,
      enteredAt: iso(j.enteredMs),
      state,
      events,
    }
    const reference = j.entry.booking?.reference
    const activityName = j.entry.booking?.activityName ?? j.entry.departure?.activityName ?? j.entry.about?.activityName
    if (reference) journey.reference = reference
    if (activityName) journey.activityName = activityName
    if (state === 'waiting' && j.waitingAt) journey.stepId = j.waitingAt
    if (reason) journey.reason = reason
    // Their own details, so "Preview as a guest" fills messages with this booking, not a sample one.
    const vars: Record<string, string> = {}
    for (const [key, value] of Object.entries(messageContext(j))) if (typeof value === 'string' && value) vars[key] = value
    journey.vars = vars
    return journey
  }

  entries.forEach((entry, index) => {
    const future = entry.at > nowMs
    const counts = !future && !entry.preview
    const keep = entry.preview || entry.guest.id === focusId || (!future && index >= keepFrom)
    const j: Journey = {
      entry,
      guest: entry.guest,
      enteredMs: entry.at,
      clock: entry.at,
      events: keep ? [] : null,
      opens: [],
      clicks: [],
      replies: [],
      sends: [],
      pushed: [],
      tags: null,
      unsubscribed: false,
      code: null,
      waitingAt: null,
      exited: null,
      ended: false,
      counts,
      projects: !entry.preview,
      skipReasons: null,
    }
    const keepOut = (reason: string) => {
      skip(reason, counts)
      if (!keep) return
      record(j, entry.at, 'skipped', reason)
      kept.push(journeyOf(j, 'skipped', reason))
    }

    if (hasWho && !entry.whoChecked && !evaluate(flow.who, factsAt(entry, flow.who, entry.at))) return keepOut("Didn't match who can enter")
    if (isMarketing && marketing.paused) return keepOut('Marketing is paused')
    if (consentNeeded && stoppedBy(entry.guest.id, entry.at)) return keepOut('Stopped marketing to them')
    if (consentNeeded && !reachable(entry.guest, entry.at)) return keepOut('No marketing consent')

    if (!entry.preview) {
      const reentry = flow.settings.reentry
      const guestKey = entry.guest.id
      if (reentry === 'once' && lastEntry.has(guestKey)) return keepOut('Already went through it')
      if (reentry === 'per_booking' && seenKeys.has(`${guestKey}|${entry.key}`)) return keepOut('Already went through it')
      if (reentry === 'every') {
        const last = lastEntry.get(guestKey)
        if (last !== undefined && entry.at - last < Math.max(1, flow.settings.reentryDays || 1) * DAY) return keepOut('Already went through it')
      }
      lastEntry.set(guestKey, entry.at)
      seenKeys.add(`${guestKey}|${entry.key}`)
    }

    if (flow.settings.holdoutPercent > 0 && chance(`${flow.id}|${entry.guest.id}|holdout`) * 100 < flow.settings.holdoutPercent) {
      if (counts) {
        run.holdout++
        if (!liftSeen.has(entry.guest.id)) {
          liftSeen.add(entry.guest.id)
          lift.outGuests++
          lift.outBookings += bookingsAfter(entry.guest.id, entry.at, entry.booking?.id)
        }
      }
      if (keep) {
        record(j, entry.at, 'skipped', 'Kept out to measure what the automation adds')
        kept.push(journeyOf(j, 'holdout', 'One of the guests kept out so you can see what it adds'))
      }
      return
    }

    record(j, entry.at, future ? 'scheduled' : 'entered', () => {
      const text = typeof entry.text === 'function' ? entry.text() : entry.text
      return future ? `Will start: ${text}` : text
    })
    if (counts) {
      run.entered++
      if (!liftSeen.has(entry.guest.id)) {
        liftSeen.add(entry.guest.id)
        lift.inGuests++
        lift.inBookings += bookingsAfter(entry.guest.id, entry.at, entry.booking?.id)
      }
    }
    walk(j, flow.steps)
    attribute(j)

    let state: GuestJourney['state']
    let reason: string | undefined
    if (j.exited) {
      state = 'exited'
      reason = `Left: ${j.exited.reason}`
      if (counts) run.exited++
    } else if (j.waitingAt !== null || future || j.clock > nowMs) {
      state = 'waiting'
      if (counts) run.active++
    } else {
      state = 'finished'
      record(j, j.clock, 'finished', 'Finished')
      if (counts) run.finished++
    }
    if (keep) kept.push(journeyOf(j, state, future ? 'Has not started yet' : reason))
  })

  if (focusId && !kept.some((journey) => journey.guestId === focusId)) {
    const guest = world.guests.get(focusId)
    if (guest) {
      kept.push({
        guestId: guest.id,
        guestName: `${guest.firstName} ${guest.lastName}`.trim(),
        enteredAt: iso(nowMs),
        state: 'skipped',
        reason: 'Nothing in their bookings would start this automation',
        events: [],
      })
    }
  }

  run.skipped = [...skipped.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)
  if (flow.settings.holdoutPercent > 0) {
    const per100 = (bookings: number, guests: number) => (guests > 0 ? Math.round((bookings / guests) * 1000) / 10 : 0)
    run.lift = { inFlow: per100(lift.inBookings, lift.inGuests), heldOut: per100(lift.outBookings, lift.outGuests) }
  }

  kept.sort((a, b) => (a.guestId === focusId ? -1 : 0) - (b.guestId === focusId ? -1 : 0) || (a.enteredAt < b.enteredAt ? 1 : a.enteredAt > b.enteredAt ? -1 : 0))
  const focused = kept.filter((journey) => journey.guestId === focusId)
  const others = kept.filter((journey) => journey.guestId !== focusId).slice(0, Math.max(0, journeyCap - focused.length))
  run.journeys = [...focused, ...others]

  if (nothingStarted) run.note = emptyNote(flow.trigger, days)
  return run
}

/** A made-up entry for "preview as a guest" when nothing started it for them in the window. */
function previewEntry(flow: Flow, world: FlowWorld, guestId: string, pseudo: Map<string, IGuest>): Entry | null {
  const guest = world.guests.get(guestId) ?? pseudo.get(guestId)
  if (!guest) return null
  const own = world.bookingsByGuest.get(guestId) ?? []
  const trigger = flow.trigger
  const offsetDuration = trigger.offset ?? DEFAULT_OFFSET[trigger.type]
  const offset = durationMs(offsetDuration)
  const latest = own.filter((b) => !b.recoveredCart).slice().reverse()
  if (BOOKING_TRIGGERS.has(trigger.type)) {
    for (const b of latest) {
      const at = bookingMoment(trigger, b, offset)
      if (at === null) continue
      return { at, guest, booking: b, departure: world.departureById.get(b.departureId), text: () => bookingEntryText(trigger, b, offsetDuration, world.data.currency), key: b.id, preview: true }
    }
    return null
  }
  if (trigger.type === 'low_fill' || trigger.type === 'weather_alert') {
    const b = latest[0]
    const d = b ? world.departureById.get(b.departureId) : undefined
    if (!b || !d) return null
    const booked = trigger.reach === 'booked_guests' || (trigger.type === 'weather_alert' && !trigger.reach)
    return { at: world.nowMs, guest, booking: booked ? b : undefined, departure: d, text: trigger.type === 'low_fill' ? `Seats are free on ${d.activityName}` : `Weather may affect ${d.activityName}`, key: d.id, preview: true }
  }
  if (trigger.type === 'manual') return { at: world.nowMs, guest, booking: latest[0], about: latest[0] ? { activityName: latest[0].activityName } : undefined, text: 'Your team started it', key: guestId, preview: true }
  return { at: world.nowMs, guest, about: latest[0] ? { activityName: latest[0].activityName } : undefined, text: 'Started now, as a preview', key: guestId, preview: true }
}
