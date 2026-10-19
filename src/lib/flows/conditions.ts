import type { MarketingContact } from '@/lib/marketing'
import type { Customer } from '@/types'
import type { Condition, ConditionField, ConditionGroup } from './types'

/* ==========================================================================
   Conditions — "who can enter", the questions a branch asks, and audience
   rules all read the same facts about a guest, their booking, the departure
   and what they did inside the automation. Browser- and server-safe.

   The facts are loose on purpose: a field can be a yes/no, a number, a word
   or a list, and every operator does the sensible thing with each, so the
   builder can offer "is", "is any of" or "is at least" without the engine
   caring which control produced the value.
   ========================================================================== */

export interface GuestFacts {
  tags: string[]
  /** Bookings that still stand (not cancelled or refunded). */
  bookings: number
  /** Minor units, lifetime. */
  spend: number
  /** Country name, as the guest list shows it. */
  country: string
  segment: Customer['segment']
  /** Days since they last booked. Infinity when they never have. */
  daysSinceLastTrip: number
  /** Activity slugs they have booked. */
  bookedActivity: string[]
  emailOptIn: boolean
  smsOptIn: boolean
  hasUpcomingTrip: boolean
  /** Lives in the business's own country. */
  local: boolean
}

export interface BookingFacts {
  /** Activity slug. */
  activity: string
  /** Activity kind: trip, rental, lesson… */
  kind: string
  partySize: number
  /** Minor units. */
  total: number
  channel: string
  /** Minor units still owed. */
  balanceDue: number
  /** Add-on ids and labels on the booking. */
  hasAddOn: string[]
  /** The promo code used, or null. */
  usedCode: string | null
  hasChildren: boolean
  /** Guests on the booking without a signed waiver. */
  waiversMissing: number
  /** Days from now until the start; negative once it has started. */
  daysUntilStart: number
  /** Location id, or null for the default. */
  location: string | null
  /** Star rating, or null when they have not left one. */
  rating: number | null
  /** Their first booking with the business. */
  firstBooking: boolean
}

export interface DepartureFacts {
  /** Percent full, 0–100. */
  fill: number
  /** The forecast condition plus 'hold' (on weather hold) and 'risky' (low go-confidence). */
  weather: string[]
}

export interface FlowFacts {
  opened: boolean
  clicked: boolean
  booked: boolean
  replied: boolean
}

export interface Facts {
  guest?: GuestFacts
  booking?: BookingFacts
  departure?: DepartureFacts
  flow?: FlowFacts
}

type FactValue = string | number | boolean | string[] | null | undefined

/** The fact a condition reads, or undefined when that part is not known here. */
export function factFor(field: ConditionField, facts: Facts): FactValue {
  const dot = field.indexOf('.')
  const scope = field.slice(0, dot) as keyof Facts
  const key = field.slice(dot + 1)
  const section = facts[scope] as Record<string, FactValue> | undefined
  return section ? section[key] : undefined
}

const norm = (value: unknown) => String(value).trim().toLowerCase()

function asList(value: Condition['value']): string[] {
  if (value === undefined || value === null) return []
  if (Array.isArray(value)) return (value as (string | number)[]).map(norm)
  return [norm(value)]
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isNaN(value) ? null : value
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isNaN(n) ? null : n
  }
  return null
}

function truthy(value: FactValue): boolean {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'number') return value > 0
  if (typeof value === 'string') return value !== ''
  return Boolean(value)
}

/** A fact as a number for at least / at most / between. Lists count their items. */
function numeric(value: FactValue): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  if (Array.isArray(value)) return value.length
  return asNumber(value)
}

function anyOf(fact: FactValue, wanted: string[]): boolean {
  if (wanted.length === 0) return true
  if (fact === undefined || fact === null) return false
  if (Array.isArray(fact)) return fact.some((item) => wanted.includes(norm(item)))
  if (typeof fact === 'boolean') return wanted.includes(fact ? 'yes' : 'no') || wanted.includes(String(fact))
  return wanted.includes(norm(fact))
}

function equals(fact: FactValue, value: Condition['value']): boolean {
  if (Array.isArray(value)) return anyOf(fact, asList(value))
  if (fact === undefined || fact === null) return value === undefined || value === null || value === ''
  if (typeof fact === 'boolean') {
    if (value === undefined) return fact
    const v = norm(value)
    return fact === (v === 'true' || v === 'yes' || v === '1')
  }
  if (typeof fact === 'number') {
    const n = asNumber(value)
    return n !== null && fact === n
  }
  if (Array.isArray(fact)) return value !== undefined && fact.some((item) => norm(item) === norm(value))
  return value !== undefined && norm(fact) === norm(value)
}

export function evaluateCondition(condition: Condition, facts: Facts): boolean {
  const fact = factFor(condition.field, facts)
  const { value } = condition
  switch (condition.op) {
    case 'yes':
      return truthy(fact)
    case 'no':
      return !truthy(fact)
    case 'is':
      return equals(fact, value)
    case 'is_not':
      return !equals(fact, value)
    case 'any_of':
      return anyOf(fact, asList(value))
    case 'none_of': {
      const wanted = asList(value)
      return wanted.length === 0 || !anyOf(fact, wanted)
    }
    case 'at_least': {
      const n = numeric(fact)
      const min = asNumber(Array.isArray(value) ? value[0] : value)
      return n !== null && min !== null && n >= min
    }
    case 'at_most': {
      const n = numeric(fact)
      const max = asNumber(Array.isArray(value) ? value[value.length - 1] : value)
      return n !== null && max !== null && n <= max
    }
    case 'between': {
      const n = numeric(fact)
      if (n === null || !Array.isArray(value) || value.length < 2) return false
      const a = asNumber(value[0])
      const b = asNumber(value[1])
      if (a === null || b === null) return false
      return n >= Math.min(a, b) && n <= Math.max(a, b)
    }
    default:
      return false
  }
}

/** An empty group always holds: no conditions means everyone. */
export function evaluate(group: ConditionGroup | undefined, facts: Facts): boolean {
  if (!group || group.conditions.length === 0) return true
  return group.match === 'any'
    ? group.conditions.some((condition) => evaluateCondition(condition, facts))
    : group.conditions.every((condition) => evaluateCondition(condition, facts))
}

/** The first condition that keeps a guest out, for "why didn't they enter?". */
export function firstFailing(group: ConditionGroup | undefined, facts: Facts): Condition | undefined {
  if (!group || group.conditions.length === 0) return undefined
  if (group.match === 'any') return group.conditions.some((condition) => evaluateCondition(condition, facts)) ? undefined : group.conditions[0]
  return group.conditions.find((condition) => !evaluateCondition(condition, facts))
}

/** Same segment rule the demo guest list uses, worked out at any moment. */
export function segmentFor(bookings: number, spend: number, daysSinceLastTrip: number): Customer['segment'] {
  if (bookings >= 3 || spend >= 200000) return 'vip'
  if (daysSinceLastTrip > 120) return 'lapsed'
  if (bookings >= 2) return 'returning'
  return 'new'
}

/**
 * Guest facts from a guest-list row, so audiences can share the rule builder.
 * Contacts carry spend in major units; facts use minor units like the rest of flows.
 */
export function guestFactsFromContact(
  contact: MarketingContact,
  nowIso: string,
  extra: { homeCountry?: string; hasUpcomingTrip?: boolean } = {},
): GuestFacts {
  const days = contact.lastBookingAt ? (new Date(nowIso).getTime() - new Date(contact.lastBookingAt).getTime()) / 86_400_000 : Infinity
  return {
    tags: contact.tags,
    bookings: contact.totalBookings,
    spend: Math.round(contact.spend * 100),
    country: contact.country,
    segment: contact.segment,
    daysSinceLastTrip: days,
    bookedActivity: contact.activitySlugs,
    emailOptIn: contact.emailOptIn,
    smsOptIn: contact.smsOptIn,
    hasUpcomingTrip: extra.hasUpcomingTrip ?? false,
    local: extra.homeCountry ? norm(contact.country) === norm(extra.homeCountry) : false,
  }
}
