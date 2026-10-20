import type { Activity, ActivityKind, ChargeBy, CurrencyCode, PriceChange, PriceChangeKind } from '@/types'
import { applyRules, type PricingRule } from '@/lib/pricing'
import { rateFor, rentalModes, type RentalMode } from '@/lib/activity-kinds'
import { peopleOf, placesOf } from '@/lib/places'
import { formatCurrency } from '@/lib/utils'

/* ==========================================================================
   Price engine — what a guest pays for an activity's tickets on a date, in
   one place, so the booking widget, checkout, the walk-in desk and the
   wizard's price check all agree. Browser- and server-safe: plain data and
   arithmetic. Money in minor units.

   Each ticket, in order:
     1. the price tier's base price (a rental: its rate for how it is rented)
     2. the date: one change for the day (specific dates > season > weekdays),
        then a start-time change on top of it
     3. per group / private: one price for the group in place of tickets
     4. the group discount ladder: the best rung the booking reaches
     5. at most one demand change (book early, last minute, filling up, quiet
        time): the one that is best for the guest
     6. the time slot's dynamic multiplier, then the business's price rules
        (Pricing → Price rules, `applyRules`, never below half price)
     7. rounded to whole minor units
   Then on the booking: rental item caps, the booking's price cap and the
   minimum charge. Extras, fees and tax are added by `buildQuote`.
   Extra guests (private, per group, a charter's guests over what it covers)
   move only with the activity's own percentage changes: dynamic pricing and
   business rules leave them as set, as they always have.
   ========================================================================== */

/** The parts of an activity the engine reads. A full `Activity` fits. */
export type PricedActivity = Pick<Activity, 'slug' | 'kind' | 'currency' | 'priceTiers'> &
  Partial<
    Pick<
      Activity,
      'basePrice' | 'chargeBy' | 'groupPrice' | 'groupDiscounts' | 'minimumCharge' | 'priceChanges' | 'priceCap' | 'privateOption' | 'charter' | 'rental'
    >
  >

/** Rentals with rates: how it is rented. */
export interface RentalPricing {
  mode?: RentalMode
  /** Hourly rentals: how many hours. */
  hours?: number
  /** Day rentals: how many days. Also the span of an older per-day rental. */
  days?: number
  /** Length rentals: the length picked. */
  lengthId?: string
}

export interface PriceContext {
  /** The time slot's start, local ISO "YYYY-MM-DDTHH:mm:ss". Without it, date and demand changes are skipped. */
  startsAt?: string
  /** When the booking is made (the demo clock). Without it, book early / last minute are skipped. */
  nowIso?: string
  /** Spots at the time slot, and how many are already taken before this booking. */
  capacity?: number
  booked?: number
  /** The time slot's seeded dynamic pricing; 1 when none. */
  priceMultiplier?: number
  /** The business's price rules (Pricing → Price rules). They apply after the activity's own changes. */
  businessRules?: PricingRule[]
  /** People on the booking, for group discounts and group rules (a charter: its party). */
  guests?: number
  rental?: RentalPricing
}

export interface AppliedChange {
  id: string
  /** "Summer", "Book early", "Groups of 6+", or the business rule's name. */
  name: string
  kind: PriceChangeKind | 'group_discount' | 'business' | 'dynamic'
  /** The activity's own change, a business price rule, or the time slot's dynamic pricing. */
  source: 'activity' | 'business' | 'dynamic'
  effect: PriceChange['effect']
  /** "Summer +15%", "Weekends +$10", "Christmas $199". */
  label: string
}

export interface PricedLine {
  id: string
  label: string
  /** The price tier it is for; absent on group, private and extra-guest lines. */
  tierId?: string
  quantity: number
  /** After every change, the span (hours or days) and any item cap. */
  unitPrice: number
  total: number
  /** Before any change, for the same span: what a struck-through "Was" compares with. */
  baseUnitPrice: number
  applied: AppliedChange[]
}

export interface PriceAdjustment {
  id: 'cap' | 'minimum'
  label: string
  /** Minor units: negative for the price cap, positive for the minimum charge. */
  amount: number
}

export interface PriceBookingInput extends Omit<PriceContext, 'guests'> {
  activity: PricedActivity
  lines: { tierId: string; qty: number }[]
  /** The private option: one price for the group, the whole time to themselves. */
  private?: boolean
  /** Charters: the group size. */
  party?: number
}

export interface PriceBookingResult {
  ticketLines: PricedLine[]
  adjustments: PriceAdjustment[]
  /** Ticket lines plus adjustments. */
  subtotalTickets: number
  /** Every change that moved a price, once each, in the order they apply. */
  appliedChanges: AppliedChange[]
  /** People counted for group discounts and group rules: the headcount, or a charter's party. */
  guests: number
  /** Tickets that take a spot. */
  seats: number
  /** Every ticket, in people. */
  headcount: number
  /** What item caps and the price cap took off. */
  capped: number
}

/* --------------------------------------------------------------------------
   How it charges
   -------------------------------------------------------------------------- */

/** How an activity of this kind is priced when nothing is set: per person, a charter per group, a rental per item. */
export function defaultChargeBy(kind: ActivityKind | undefined): ChargeBy {
  switch (kind ?? 'trip') {
    case 'charter':
      return 'group'
    case 'rental':
      return 'item'
    default:
      return 'person'
  }
}

export const chargeByOf = (activity: Pick<Activity, 'kind'> & Partial<Pick<Activity, 'chargeBy'>>): ChargeBy => activity.chargeBy ?? defaultChargeBy(activity.kind)

/** A per-group price on an activity that sells places (a charter's options are its own group prices). */
const groupPriced = (activity: PricedActivity) =>
  chargeByOf(activity) === 'group' && (activity.kind ?? 'trip') !== 'charter' && Boolean(activity.groupPrice)

const isRated = (activity: PricedActivity, mode?: RentalMode) =>
  (activity.kind ?? 'trip') === 'rental' && Boolean(mode) && (activity.rental?.rates?.length ?? 0) > 0

/* --------------------------------------------------------------------------
   Matching
   -------------------------------------------------------------------------- */

const DAY_KINDS: Record<string, number> = { dates: 3, season: 2, weekdays: 1 }
const DEMAND_KINDS = new Set<PriceChangeKind>(['early_bird', 'last_minute', 'filling_up', 'slow_time'])

/** A day key inside from–to, inclusive. "MM-DD" ends repeat every year and may wrap past New Year. */
function inSpan(key: string, from?: string, to?: string): boolean {
  if (!from && !to) return false
  const yearly = (from ?? to ?? '').length === 5
  const day = yearly ? key.slice(5) : key
  let a = from ? (yearly ? from.slice(-5) : from) : undefined
  let b = to ? (yearly ? to.slice(-5) : to) : undefined
  if (a && b) {
    if (yearly && a > b) return day >= a || day <= b
    if (a > b) [a, b] = [b, a]
    return day >= a && day <= b
  }
  return a ? day >= a : day <= (b as string)
}

const weekdayOf = (key: string) => new Date(`${key}T12:00:00`).getDay()

interface Moment {
  key?: string
  time?: string
  weekday?: number
  hoursAhead?: number
  soldPercent?: number
}

function momentOf(ctx: PriceContext): Moment {
  if (!ctx.startsAt) return {}
  const key = ctx.startsAt.slice(0, 10)
  const time = ctx.startsAt.length >= 16 ? ctx.startsAt.slice(11, 16) : undefined
  const hoursAhead = ctx.nowIso ? (new Date(ctx.startsAt).getTime() - new Date(ctx.nowIso).getTime()) / 3_600_000 : undefined
  const soldPercent = ctx.capacity && ctx.capacity > 0 && ctx.booked !== undefined ? (Math.max(0, ctx.booked) / ctx.capacity) * 100 : undefined
  return { key, time, weekday: weekdayOf(key), hoursAhead, soldPercent }
}

/** Does the change hold at this moment? Targeting is checked separately. */
export function changeMatches(change: PriceChange, moment: Moment): boolean {
  if (!change.active) return false
  switch (change.kind) {
    case 'season':
      return Boolean(moment.key) && inSpan(moment.key!, change.from, change.to)
    case 'dates':
      return Boolean(moment.key) && (change.dates ?? []).some((date) => (date.length === 5 ? date === moment.key!.slice(5) : date === moment.key))
    case 'weekdays':
      return moment.weekday !== undefined && (change.weekdays ?? []).includes(moment.weekday)
    case 'time_of_day':
      return Boolean(moment.time) && (change.times ?? []).some((time) => clock(time) === moment.time)
    case 'early_bird':
      return moment.hoursAhead !== undefined && moment.hoursAhead >= Math.max(0, change.daysAhead ?? 30) * 24
    case 'last_minute':
      return moment.hoursAhead !== undefined && moment.hoursAhead >= 0 && moment.hoursAhead <= Math.max(0, change.hoursBefore ?? 24)
    case 'filling_up':
      return moment.soldPercent !== undefined && moment.soldPercent >= (change.soldPercent ?? 80)
    case 'slow_time': {
      if (moment.soldPercent === undefined || moment.soldPercent >= (change.soldPercent ?? 50)) return false
      if (change.hoursBefore === undefined || change.hoursBefore <= 0) return true
      return moment.hoursAhead !== undefined && moment.hoursAhead >= 0 && moment.hoursAhead <= change.hoursBefore
    }
    default:
      return false
  }
}

type Scope = { kind: 'tier'; tierId: string; base: number } | { kind: 'group' } | { kind: 'private' }

/** Is the change for this price? A tier list targets tiers only; group and private prices take untargeted changes. */
function targets(change: PriceChange, scope: Scope): boolean {
  const listed = (change.tierIds ?? []).length > 0
  if (scope.kind !== 'tier') {
    if (listed) return false
    // Private is a per-person activity's group price: only a percentage moves it.
    return scope.kind === 'group' || change.effect.type === 'percent'
  }
  if (listed) return change.tierIds!.includes(scope.tierId)
  // A free ticket stays free unless a change names it: no added amount, no set price.
  return !(scope.base === 0 && change.effect.type !== 'percent')
}

/** "9:00" and "09:00" are the same start time. */
const clock = (time: string) => {
  const [h, m] = time.trim().split(':')
  return `${(h ?? '').padStart(2, '0')}:${(m ?? '00').padStart(2, '0').slice(0, 2)}`
}

/* --------------------------------------------------------------------------
   Words
   -------------------------------------------------------------------------- */

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Jun 1", from a day key or "MM-DD". */
export function shortDay(key: string): string {
  const [month, day] = (key.length === 5 ? key : key.slice(5)).split('-').map(Number)
  return `${MONTH[(month || 1) - 1]} ${day || 1}`
}

const weekdayWords = (days: number[]) => {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  if (sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6) return 'Weekends'
  if (sorted.length === 5 && sorted.every((day, index) => day === index + 1)) return 'Weekdays'
  if (sorted.length === 7) return 'Every day'
  return sorted.map((day) => WEEKDAY[day]).join(', ')
}

/** The name a change goes by when it has none of its own. */
export function priceChangeName(change: PriceChange): string {
  if (change.name?.trim()) return change.name.trim()
  switch (change.kind) {
    case 'season':
      return change.from && change.to ? `${shortDay(change.from)} – ${shortDay(change.to)}` : 'Season'
    case 'weekdays':
      return weekdayWords(change.weekdays ?? [])
    case 'time_of_day':
      return (change.times ?? []).length === 1 ? `${change.times![0]} start` : 'Start times'
    case 'dates':
      return (change.dates ?? []).length === 1 ? shortDay(change.dates![0]) : 'Special dates'
    case 'early_bird':
      return 'Book early'
    case 'last_minute':
      return 'Last minute'
    case 'filling_up':
      return 'Filling up'
    case 'slow_time':
      return 'Quiet time'
  }
}

/** "+15%", "−10%", "+$10", "$199". */
export function effectLabel(effect: PriceChange['effect'], currency: CurrencyCode = 'USD'): string {
  const money = (value: number) => formatCurrency(value, currency, { decimals: value % 100 !== 0 })
  switch (effect.type) {
    case 'percent':
      return effect.value >= 0 ? `+${effect.value}%` : `−${Math.abs(effect.value)}%`
    case 'amount':
      return effect.value >= 0 ? `+${money(effect.value)}` : `−${money(Math.abs(effect.value))}`
    case 'set':
      return money(effect.value)
  }
}

const percentEffect = (percent: number): PriceChange['effect'] => ({ type: 'percent', value: Math.round(percent * 10) / 10 })

/* --------------------------------------------------------------------------
   One price through the steps
   -------------------------------------------------------------------------- */

interface UnitResult {
  price: number
  /**
   * What the activity's own percentage steps multiplied by, for extra-guest
   * prices that follow the group price. The time slot's dynamic pricing and
   * the business's rules never move an extra guest's price.
   */
  factor: number
  applied: AppliedChange[]
}

function applyEffect(price: number, effect: PriceChange['effect']): number {
  switch (effect.type) {
    case 'percent':
      return price * (1 + effect.value / 100)
    case 'amount':
      return price + effect.value
    case 'set':
      return effect.value
  }
}

function runSteps(activity: PricedActivity, scope: Scope, base: number, ctx: PriceContext, ladder: boolean): UnitResult {
  const currency = activity.currency ?? 'USD'
  const moment = momentOf(ctx)
  const changes = (activity.priceChanges ?? []).filter((change) => change.active && targets(change, scope))
  const applied: AppliedChange[] = []
  let price = base
  let factor = 1
  const take = (change: PriceChange) => {
    price = applyEffect(price, change.effect)
    if (change.effect.type === 'percent') factor *= 1 + change.effect.value / 100
    else if (change.effect.type === 'set') factor = 1
    const name = priceChangeName(change)
    applied.push({ id: change.id, name, kind: change.kind, source: 'activity', effect: change.effect, label: `${name} ${effectLabel(change.effect, currency)}` })
  }

  // 2. The date: one change for the day, the most specific; a later one wins a tie. Then the start time.
  if (moment.key) {
    let day: { change: PriceChange; rank: number } | undefined
    for (const change of changes) {
      const rank = DAY_KINDS[change.kind]
      if (!rank || !changeMatches(change, moment)) continue
      if (!day || rank >= day.rank) day = { change, rank }
    }
    if (day) take(day.change)
    const time = [...changes].reverse().find((change) => change.kind === 'time_of_day' && changeMatches(change, moment))
    if (time) take(time)
  }

  // 4. Group discounts: of the rungs the booking reaches, the one that saves the most.
  const guests = ctx.guests ?? 0
  if (ladder && guests > 0) {
    const rung = (activity.groupDiscounts ?? [])
      .filter((entry) => entry.fromGuests > 0 && entry.percentOff > 0 && guests >= entry.fromGuests)
      .sort((a, b) => b.percentOff - a.percentOff || b.fromGuests - a.fromGuests)[0]
    if (rung) {
      const off = Math.min(100, rung.percentOff)
      price *= 1 - off / 100
      factor *= 1 - off / 100
      const effect = percentEffect(-off)
      applied.push({ id: `group_${rung.fromGuests}`, name: `Groups of ${rung.fromGuests}+`, kind: 'group_discount', source: 'activity', effect, label: `Groups of ${rung.fromGuests}+ ${effectLabel(effect)}` })
    }
  }

  // 5. Demand: at most one, the best for the guest.
  if (moment.key) {
    let best: { change: PriceChange; result: number } | undefined
    for (const change of changes) {
      if (!DEMAND_KINDS.has(change.kind) || !changeMatches(change, moment)) continue
      const result = applyEffect(price, change.effect)
      if (!best || result < best.result) best = { change, result }
    }
    if (best) take(best.change)
  }

  // 6. The time slot's dynamic pricing, then the business's rules: one combined multiplier,
  //    multiplied in once, so the rounding is exactly what it always was.
  let scale = 1
  const multiplier = ctx.priceMultiplier ?? 1
  if (multiplier > 0 && multiplier !== 1) {
    scale = multiplier
    const effect = percentEffect((multiplier - 1) * 100)
    const name = multiplier > 1 ? 'Peak time' : 'Off-peak'
    applied.push({ id: 'dynamic', name, kind: 'dynamic', source: 'dynamic', effect, label: `${name} ${effectLabel(effect)}` })
  }
  const rules = ctx.businessRules ?? []
  if (rules.length > 0 && ctx.startsAt) {
    const result = applyRules(rules, { activitySlug: activity.slug, startsAt: ctx.startsAt, nowIso: ctx.nowIso ?? ctx.startsAt, guests: Math.max(1, guests) })
    if (result.applied.length > 0) {
      scale *= result.multiplier
      for (const rule of result.applied) {
        const effect = percentEffect(rule.percent)
        applied.push({ id: rule.id, name: rule.name, kind: 'business', source: 'business', effect, label: `${rule.name} ${effectLabel(effect)}` })
      }
    }
  }
  if (scale !== 1) price *= scale

  // 7. Whole minor units, never below nothing.
  return { price: Math.max(0, Math.round(price)), factor, applied }
}

/** A tier's base: its price, or a rental's rate for how it is rented. */
function baseOf(activity: PricedActivity, tierId: string, rental?: RentalPricing): number | undefined {
  const tier = activity.priceTiers.find((entry) => entry.id === tierId)
  if (!tier) return undefined
  // A rated rental item with no rate in this mode isn't sold that way: no price to fall back on.
  if (isRated(activity, rental?.mode)) return rateFor(activity, tierId, rental!.mode!, rental?.lengthId)
  return tier.price
}

/** An extra guest's price: the set price moved by the activity's own percentage changes only. */
const extraPrice = (price: number, factor: number) => Math.max(0, Math.round(price * factor))

export interface UnitPriceDetail {
  /** After the changes, before any span (a rental's per hour, per day or per length). */
  price: number
  /** Before any change. */
  base: number
  applied: AppliedChange[]
  /** 'group' and 'private': each guest over what the price covers, after the activity's own changes. */
  extraGuest?: number
}

/**
 * One price on a date, for showing: a price tier's ticket, or 'group' / 'private'
 * for the group and private prices. Rentals give the rate for `ctx.rental.mode`.
 * Pass `ctx.guests` to include group discounts and group rules.
 */
export function unitPriceDetail(activity: PricedActivity, tierId: string, ctx: PriceContext = {}): UnitPriceDetail {
  if (tierId === 'private') {
    const priv = activity.privateOption
    const base = priv?.price ?? 0
    const result = runSteps(activity, { kind: 'private' }, base, ctx, false)
    return { price: result.price, base, applied: result.applied, extraGuest: extraPrice(priv?.extraGuest ?? 0, result.factor) }
  }
  if (tierId === 'group') {
    const base = activity.groupPrice?.price ?? 0
    const result = runSteps(activity, { kind: 'group' }, base, ctx, false)
    return { price: result.price, base, applied: result.applied, extraGuest: extraPrice(activity.groupPrice?.extraGuest ?? 0, result.factor) }
  }
  const base = baseOf(activity, tierId, ctx.rental) ?? 0
  const result = runSteps(activity, { kind: 'tier', tierId, base }, base, ctx, chargeByOf(activity) === 'person')
  return { price: result.price, base, applied: result.applied }
}

/** A price tier's price on a date, minor units. See `unitPriceDetail`. */
export function unitPrice(activity: PricedActivity, tierId: string, ctx: PriceContext = {}): number {
  return unitPriceDetail(activity, tierId, ctx).price
}

/* --------------------------------------------------------------------------
   The lead ("from") price
   -------------------------------------------------------------------------- */

/** Every way the lead price can be counted: each sellable tier, or each rental rate in the modes asked for. */
function leadCandidates(activity: PricedActivity, rental?: RentalPricing): { tierId: string; rental?: RentalPricing }[] {
  if (groupPriced(activity)) return [{ tierId: 'group' }]
  const modes = (activity.kind ?? 'trip') === 'rental' && (activity.rental?.rates?.length ?? 0) > 0 ? (rental?.mode ? [rental.mode] : rentalModes(activity)) : []
  if (modes.length > 0) {
    const out: { tierId: string; rental?: RentalPricing }[] = []
    for (const tier of activity.priceTiers) {
      for (const mode of modes) {
        const lengthIds = mode === 'length' ? (rental?.lengthId ? [rental.lengthId] : (activity.rental?.lengths ?? []).map((length) => length.id)) : [undefined]
        for (const lengthId of lengthIds) {
          const rate = rateFor(activity, tier.id, mode, lengthId)
          if (rate !== undefined && rate > 0) out.push({ tierId: tier.id, rental: { mode, lengthId } })
        }
      }
    }
    if (out.length > 0) return out
  }
  const paid = activity.priceTiers.filter((tier) => tier.price > 0)
  // A charter's options are picked one of, like rental items: the cheapest one leads.
  if ((activity.kind ?? 'trip') === 'charter') return paid.map((tier) => ({ tierId: tier.id }))
  // The lead price: the first paid ticket that takes a spot (the "Lead price" row in the editor, usually Adult),
  // as booking sites show it. A child, add-on swing, ride-along or support seat is never the "from" price.
  const lead = paid.find((tier) => tier.countsTowardCapacity) ?? paid[0]
  return lead ? [{ tierId: lead.id }] : []
}

/**
 * The price a guest books at, for this context: the lead ticket
 * (the first paid ticket that takes a spot; free and ride-along
 * tickets are left out), a charter's cheapest option, a rental's cheapest
 * item rate, or the group price. 0 when everything is free.
 */
export function leadPrice(activity: PricedActivity, ctx: PriceContext = {}): number {
  const candidates = leadCandidates(activity, ctx.rental)
  if (candidates.length === 0) return 0
  return Math.min(...candidates.map((candidate) => unitPrice(activity, candidate.tierId, { ...ctx, rental: candidate.rental ?? ctx.rental })))
}

/**
 * The "from" price, one rule everywhere: the base price of the lead
 * tier, a charter's cheapest option, a rental's lowest item rate (in `mode`
 * when given), or the group price. No date, demand or business changes.
 */
export function fromPrice(activity: PricedActivity, mode?: RentalMode): number {
  return leadPrice({ ...activity, priceChanges: [], groupDiscounts: [] }, mode ? { rental: { mode } } : {})
}

/**
 * A time slot's lead price on the storefront strip. A seeded `priceOverride`
 * already carries the slot's multiplier, so it is used as is, never multiplied
 * again; without one, the engine prices the slot.
 */
export function slotLeadPrice(activity: PricedActivity, slot: { priceOverride?: number; priceMultiplier?: number }, ctx: Omit<PriceContext, 'priceMultiplier'> = {}): number {
  const changes = (activity.priceChanges ?? []).some((change) => change.active) || (ctx.businessRules ?? []).some((rule) => rule.active)
  if (slot.priceOverride !== undefined && !slot.priceMultiplier && !changes) return slot.priceOverride
  return leadPrice(activity, { ...ctx, priceMultiplier: slot.priceMultiplier })
}

/* --------------------------------------------------------------------------
   A booking
   -------------------------------------------------------------------------- */

export function priceBooking(input: PriceBookingInput): PriceBookingResult {
  const { activity } = input
  const kind = activity.kind ?? 'trip'
  const rental = input.rental ?? {}
  const days = Math.max(1, Math.floor(rental.days ?? 1))
  const hours = Math.max(1, Math.floor(rental.hours ?? 1))
  const rated = isRated(activity, rental.mode)
  const byLength = rated && rental.mode === 'length'
  // A rated rental item with no rate in the mode can't be booked that way, so it is left off.
  const sellable = (tierId: string) => !rated || rateFor(activity, tierId, rental.mode!, rental.lengthId) !== undefined
  const qtyOf = (tierId: string) => (sellable(tierId) ? input.lines.reduce((sum, line) => (line.tierId === tierId ? sum + Math.max(0, Math.floor(line.qty)) : sum), 0) : 0)

  let headcount = 0
  let seats = 0
  for (const tier of activity.priceTiers) {
    const qty = qtyOf(tier.id)
    if (qty <= 0) continue
    headcount += qty * peopleOf(tier)
    seats += qty * placesOf(tier)
  }
  const guests = kind === 'charter' ? Math.max(1, input.party ?? headcount) : headcount
  const ctx: PriceContext = {
    startsAt: input.startsAt,
    nowIso: input.nowIso,
    capacity: input.capacity,
    booked: input.booked,
    priceMultiplier: input.priceMultiplier,
    businessRules: input.businessRules,
    rental,
    guests,
  }

  const priv = activity.privateOption
  const goPrivate = Boolean(input.private && priv?.enabled && headcount > 0)
  const group = !goPrivate && groupPriced(activity) && headcount > 0 ? activity.groupPrice : undefined
  const ladder = chargeByOf(activity) === 'person' && !goPrivate && !group

  const lines: PricedLine[] = []
  let capped = 0
  /** The first ticket's percentage factor: extra guests on a charter follow it. */
  let leadFactor = 1

  // Extra guests follow the activity's own percentage changes only, never dynamic pricing or business rules.
  const extraLine = (id: string, label: string, count: number, price: number, factor: number, applied: AppliedChange[]) => {
    if (count <= 0 || price <= 0) return
    const unit = extraPrice(price, factor)
    lines.push({ id, label, quantity: count, unitPrice: unit, total: unit * count, baseUnitPrice: price, applied: factor === 1 ? [] : applied.filter((change) => change.source === 'activity') })
  }

  if (goPrivate && priv) {
    // Private: one price for the group in place of the tickets, plus anyone over what it covers.
    const unit = runSteps(activity, { kind: 'private' }, priv.price, ctx, false)
    lines.push({ id: 'private', label: `Private · up to ${priv.includedGuests}`, quantity: 1, unitPrice: unit.price, total: unit.price, baseUnitPrice: priv.price, applied: unit.applied })
    extraLine('private-extra', 'Extra guests', Math.max(0, headcount - priv.includedGuests), priv.extraGuest, unit.factor, unit.applied)
  } else if (group) {
    // Per group: one price up to so many guests, then each extra guest.
    const unit = runSteps(activity, { kind: 'group' }, group.price, ctx, false)
    lines.push({ id: 'group', label: `Group · up to ${group.includedGuests}`, quantity: 1, unitPrice: unit.price, total: unit.price, baseUnitPrice: group.price, applied: unit.applied })
    extraLine('group-extra', 'Extra guests', Math.max(0, headcount - group.includedGuests), group.extraGuest, unit.factor, unit.applied)
  } else {
    for (const tier of activity.priceTiers) {
      const qty = qtyOf(tier.id)
      if (qty <= 0) continue
      const base = baseOf(activity, tier.id, rental) ?? tier.price
      const span = byLength ? 1 : rated && rental.mode === 'hour' ? hours : days
      const unit = runSteps(activity, { kind: 'tier', tierId: tier.id, base }, base, ctx, ladder)
      if (lines.length === 0) leadFactor = unit.factor
      const full = unit.price * span
      // A rental item's cap: an hourly or daily price stops at the most one item costs for the whole rental.
      const itemCap = kind === 'rental' && !byLength ? activity.rental?.items?.find((item) => item.tierId === tier.id)?.cap : undefined
      const unitPrice = itemCap && itemCap > 0 ? Math.min(full, itemCap) : full
      if (unitPrice < full) capped += (full - unitPrice) * qty
      lines.push({
        id: tier.id,
        tierId: tier.id,
        label: byLength
          ? `${tier.label} · ${activity.rental?.lengths?.find((length) => length.id === rental.lengthId)?.label ?? 'set length'}`
          : rated && rental.mode === 'hour'
            ? `${tier.label} · ${hours} ${hours === 1 ? 'hour' : 'hours'}${unitPrice < full ? ' · capped' : ''}`
            : days > 1
              ? `${tier.label} · ${days} days${unitPrice < full ? ' · capped' : ''}`
              : tier.label,
        quantity: qty,
        unitPrice,
        total: unitPrice * qty,
        baseUnitPrice: base * span,
        applied: unit.applied,
      })
    }

    // Charters: the price covers so many guests; each one over pays a set amount.
    if (kind === 'charter' && lines.length > 0) {
      const included = activity.groupPrice?.includedGuests ?? activity.charter?.includedGuests ?? 0
      const extraPrice = activity.groupPrice?.extraGuest ?? activity.charter?.extraGuestPrice ?? 0
      if (included > 0 && extraPrice > 0 && guests > included) {
        extraLine('charter-extra', `Extra guests over ${included}`, guests - included, extraPrice, leadFactor, lines[0].applied)
      }
    }
  }

  const adjustments: PriceAdjustment[] = []
  let ticketTotal = lines.reduce((sum, line) => sum + line.total, 0)
  // The booking's cap: tickets or items never come to more than this.
  if (activity.priceCap && activity.priceCap > 0 && ticketTotal > activity.priceCap) {
    const off = ticketTotal - activity.priceCap
    adjustments.push({ id: 'cap', label: 'Price cap', amount: -off })
    ticketTotal -= off
    capped += off
  }
  // The minimum charge: a booking pays at least this for its tickets.
  if (activity.minimumCharge && activity.minimumCharge > 0 && lines.length > 0 && ticketTotal < activity.minimumCharge) {
    adjustments.push({ id: 'minimum', label: 'Minimum charge', amount: activity.minimumCharge - ticketTotal })
    ticketTotal = activity.minimumCharge
  }

  const appliedChanges: AppliedChange[] = []
  for (const line of lines) for (const change of line.applied) if (!appliedChanges.some((entry) => entry.id === change.id)) appliedChanges.push(change)

  return { ticketLines: lines, adjustments, subtotalTickets: ticketTotal, appliedChanges, guests, seats, headcount, capped }
}

/* --------------------------------------------------------------------------
   The price calendar
   -------------------------------------------------------------------------- */

export interface PriceCalendarDay {
  dateKey: string
  /** The lowest price that day, minor units. */
  leadPrice: number
  /** Against the plain "from" price: lower, the same, or higher. */
  level: 'low' | 'base' | 'high'
  /** What moved the price that day: "Summer +15%". */
  changes: string[]
}

export interface PriceCalendarOptions {
  /** Business rules; only season and weekday rules apply unless `withDemand` is on. */
  businessRules?: PricingRule[]
  /** Start times to price each day at; the lowest wins. Without them, start-time changes are left out. */
  times?: string[]
  /**
   * The start times a given day actually has, in place of `times`: each day is
   * priced only at its own. A day with none is priced on its date alone.
   */
  timesOn?: (dateKey: string) => string[]
  /** Also apply book early / last minute as if booked at `nowIso`. Off: the calendar shows dates only. */
  withDemand?: boolean
  nowIso?: string
  rental?: RentalPricing
}

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * Whole months of prices, starting with the month of `fromKey`: each day's
 * lowest price and whether it sits below, at or above the plain "from" price.
 */
export function priceCalendar(activity: PricedActivity, fromKey: string, months = 12, options: PriceCalendarOptions = {}): PriceCalendarDay[] {
  // The plain price for the same rental mode and length the days are priced in.
  const base = options.rental ? leadPrice({ ...activity, priceChanges: [], groupDiscounts: [] }, { rental: options.rental }) : fromPrice(activity)
  const rules = (options.businessRules ?? []).filter((rule) => options.withDemand || rule.kind === 'season' || rule.kind === 'weekday')
  const kept = (activity.priceChanges ?? []).filter((change) => options.withDemand || !DEMAND_KINDS.has(change.kind))
  const allTimes = options.times && options.times.length > 0 ? options.times : ['']
  // Without start times, a start-time change has nothing to match.
  const dateOnly: PricedActivity = { ...activity, priceChanges: kept.filter((change) => change.kind !== 'time_of_day') }
  const timed: PricedActivity = { ...activity, priceChanges: kept }
  const candidates = leadCandidates(dateOnly, options.rental)
  const [year, month] = fromKey.split('-').map(Number)
  const cursor = new Date(year, (month || 1) - 1, 1, 12)
  const end = new Date(year, (month || 1) - 1 + Math.max(1, months), 1, 12)
  const out: PriceCalendarDay[] = []
  while (cursor < end) {
    const dateKey = keyOf(cursor)
    const own = options.timesOn ? options.timesOn(dateKey) : undefined
    const times = own ? (own.length > 0 ? own : ['']) : allTimes
    const priced = times[0] ? timed : dateOnly
    let best: { price: number; changes: string[] } | undefined
    for (const time of times) {
      const startsAt = `${dateKey}T${time || '00:00'}:00`
      const ctx: PriceContext = { startsAt, nowIso: options.withDemand ? options.nowIso : undefined, businessRules: rules, rental: options.rental }
      for (const candidate of candidates) {
        const detail = unitPriceDetail(priced, candidate.tierId, { ...ctx, rental: candidate.rental ?? ctx.rental })
        if (!best || detail.price < best.price) best = { price: detail.price, changes: detail.applied.map((change) => change.label) }
      }
    }
    const leadPriceOfDay = best?.price ?? 0
    out.push({ dateKey, leadPrice: leadPriceOfDay, level: leadPriceOfDay < base ? 'low' : leadPriceOfDay > base ? 'high' : 'base', changes: best?.changes ?? [] })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/* --------------------------------------------------------------------------
   Sentences
   -------------------------------------------------------------------------- */

/**
 * Each step of a price, in a few words, for previews and the price check:
 * ["Summer +15%", "Book early −10%", "Minimum charge +$50"].
 */
export function explainPrice(result: Pick<PriceBookingResult, 'appliedChanges'> & Partial<Pick<PriceBookingResult, 'adjustments'>>, currency: CurrencyCode = 'USD'): string[] {
  const money = (value: number) => formatCurrency(value, currency, { decimals: value % 100 !== 0 })
  return [
    ...result.appliedChanges.map((change) => change.label),
    ...(result.adjustments ?? []).map((entry) => (entry.id === 'cap' ? `Price cap −${money(Math.abs(entry.amount))}` : `Minimum charge +${money(entry.amount)}`)),
  ]
}

/**
 * A change as one plain sentence, for the list on the Pricing step:
 * "Jun 1 – Aug 31: prices go up 15%", "Weekends: add $10",
 * "Booked 30 days ahead: 10% off", "When 80% booked: up 10%".
 */
export function describePriceChange(change: PriceChange, currency: CurrencyCode = 'USD', tierLabels?: Record<string, string>): string {
  const money = (value: number) => formatCurrency(value, currency, { decimals: value % 100 !== 0 })
  const { type, value } = change.effect
  const what =
    type === 'set'
      ? `price ${money(value)}`
      : type === 'percent'
        ? value >= 0
          ? `prices go up ${value}%`
          : `${Math.abs(value)}% off`
        : value >= 0
          ? `add ${money(value)}`
          : `take ${money(Math.abs(value))} off`
  const when = (() => {
    switch (change.kind) {
      case 'season':
        return change.from && change.to ? `${shortDay(change.from)} – ${shortDay(change.to)}${change.from.length === 5 ? ' every year' : ''}` : change.from ? `From ${shortDay(change.from)}` : change.to ? `Until ${shortDay(change.to)}` : 'Season'
      case 'weekdays': {
        const words = weekdayWords(change.weekdays ?? [])
        return words === 'Every day' ? words : words === 'Weekends' || words === 'Weekdays' ? `On ${words.toLowerCase()}` : `On ${words || 'set days'}`
      }
      case 'time_of_day':
        return `At ${(change.times ?? []).join(', ') || 'set'} start times`
      case 'dates': {
        const dates = change.dates ?? []
        return dates.length <= 3 ? `On ${dates.map(shortDay).join(', ') || 'set dates'}` : `On ${dates.length} dates`
      }
      case 'early_bird':
        return `Booked ${change.daysAhead ?? 30} days ahead`
      case 'last_minute':
        return `Within ${change.hoursBefore ?? 24} hours of the start`
      case 'filling_up':
        return `When ${change.soldPercent ?? 80}% booked`
      case 'slow_time':
        return change.hoursBefore ? `Within ${change.hoursBefore} hours, if under ${change.soldPercent ?? 50}% booked` : `When under ${change.soldPercent ?? 50}% booked`
    }
  })()
  const only = (change.tierIds ?? []).length > 0 && tierLabels ? ` · ${change.tierIds!.map((id) => tierLabels[id] ?? id).join(', ')} only` : ''
  return `${when}: ${what}${only}`
}
