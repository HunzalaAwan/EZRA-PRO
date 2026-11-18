import type { Activity, RentalConfig, RentalDistance, RentalOperator, RentalProtectionPlan } from '@/types'

/* ==========================================================================
   Rental terms — the parts of a rental that every rental business has,
   whatever it rents (a kayak, a Lamborghini, a 26 ft box truck):

     the rate        hour, day, week, month: the cheapest way wins
     who drives      the renter, your driver in the price, or a paid option
     distance        unlimited, or so many a day and a price for each over
     drivers         a young-driver fee, extra drivers
     cover           protection plans per day, with what the guest still pays
     handover        pick-up, delivery and collection, a one-way return
     coming back     grace minutes, late hours, a full day after so long late

   Pure and integer-only: minor units in, minor units out. The guest's
   choices travel to checkout in one URL parameter (`ro`).
   ========================================================================== */

type RentalSource = Pick<Activity, 'kind' | 'rental' | 'minAge'>

const whole = (value: number | undefined) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0)

/* ---------- the rate: hours, days, weeks, months ---------- */

export interface SpanRates {
  day?: number
  week?: number
  month?: number
}

/**
 * The price of `days` days at a day, week and month rate, the cheapest way:
 * whole months, then whole weeks, then days, where a part-week never costs
 * more than a week and a part-month never more than a month. With only a day
 * rate, days × day.
 */
export function spanPrice(rates: SpanRates, days: number): number | undefined {
  const n = Math.max(1, Math.floor(days))
  const day = rates.day && rates.day > 0 ? rates.day : undefined
  const week = rates.week && rates.week > 0 ? rates.week : undefined
  const month = rates.month && rates.month > 0 ? rates.month : undefined
  if (!day && !week && !month) return undefined
  const daysOnly = (count: number) => (day ? count * day : Number.POSITIVE_INFINITY)
  const weeksAndDays = (count: number): number => {
    if (count <= 0) return 0
    if (!week) return daysOnly(count)
    const whole = Math.floor(count / 7)
    const rest = count % 7
    return whole * week + Math.min(daysOnly(rest), rest > 0 ? week : 0)
  }
  const best = (count: number): number => {
    if (!month) return weeksAndDays(count)
    const whole = Math.floor(count / 30)
    const rest = count % 30
    return whole * month + Math.min(weeksAndDays(rest), rest > 0 ? month : 0)
  }
  const price = best(n)
  return Number.isFinite(price) ? Math.round(price) : undefined
}

/** Rental days for per-day charges: the days, or the hours rounded up to days. */
export function rentalDaysOf(span: { mode?: 'hour' | 'day' | 'length'; days?: number; hours?: number }): number {
  if (span.mode === 'day' || !span.mode) return Math.max(1, Math.floor(span.days ?? 1))
  return Math.max(1, Math.ceil(Math.max(1, span.hours ?? 1) / 24))
}

/* ---------- what the guest chose ---------- */

export interface RentalChoice {
  /** Optional driver, captain or operator added. */
  driver?: boolean
  /** Protection plan id; absent = no extra cover (when allowed). */
  plan?: string
  /** The main driver is under the young-driver age. */
  young?: boolean
  /** Extra drivers. */
  extraDrivers?: number
  /** Delivered and collected instead of picked up. */
  delivery?: boolean
  /** Returned at this other location id. */
  returnTo?: string
}

const KEYS: Record<string, keyof RentalChoice> = { d: 'driver', p: 'plan', y: 'young', x: 'extraDrivers', v: 'delivery', r: 'returnTo' }

/** "d:1~p:full~x:2": the choice as one URL parameter. Empty when nothing was chosen. */
export function encodeRentalChoice(choice: RentalChoice): string {
  const parts: string[] = []
  if (choice.driver) parts.push('d:1')
  if (choice.plan) parts.push(`p:${choice.plan}`)
  if (choice.young) parts.push('y:1')
  if (choice.extraDrivers && choice.extraDrivers > 0) parts.push(`x:${Math.floor(choice.extraDrivers)}`)
  if (choice.delivery) parts.push('v:1')
  if (choice.returnTo) parts.push(`r:${choice.returnTo}`)
  return parts.join('~')
}

export function decodeRentalChoice(value: string | string[] | undefined): RentalChoice {
  const raw = Array.isArray(value) ? value[0] : value
  const choice: RentalChoice = {}
  if (!raw) return choice
  for (const part of raw.split('~')) {
    const [key, ...rest] = part.split(':')
    const field = KEYS[key]
    const v = rest.join(':')
    if (!field || !v) continue
    if (field === 'plan' || field === 'returnTo') {
      if (/^[\w-]{1,40}$/.test(v)) choice[field] = v
    } else if (field === 'extraDrivers') {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) choice.extraDrivers = Math.min(9, Math.floor(n))
    } else if (v === '1') {
      choice[field] = true
    }
  }
  return choice
}

/** The choice with anything the rental doesn't offer taken out, and a required plan filled in. */
export function cleanRentalChoice(config: RentalConfig | undefined, choice: RentalChoice, minAge?: number): RentalChoice {
  if (!config) return {}
  const out: RentalChoice = {}
  if (choice.driver && config.operator?.mode === 'optional') out.driver = true
  const plans = config.protection?.plans ?? []
  const plan = plans.find((entry) => entry.id === choice.plan)
  if (plan) out.plan = plan.id
  else if (config.protection?.required && plans.length > 0) out.plan = plans[0].id
  const selfDriven = !(config.operator?.mode === 'included' || out.driver)
  if (selfDriven && choice.young && youngOffered(config, minAge)) out.young = true
  const extraMax = extraDriversMax(config)
  if (selfDriven && choice.extraDrivers && extraMax > 0) out.extraDrivers = Math.min(extraMax, Math.floor(choice.extraDrivers))
  if (choice.delivery && config.handover?.delivery) out.delivery = true
  if (choice.returnTo && config.handover?.oneWay) out.returnTo = choice.returnTo
  return out
}

/** A young-driver fee is offered when there is an age under which it applies, above the minimum age. */
export const youngOffered = (config: RentalConfig, minAge?: number) =>
  Boolean(config.renters?.youngUnder && config.renters.youngFee && config.renters.youngFee > 0 && config.renters.youngUnder > (minAge ?? 0))

export const extraDriversMax = (config: RentalConfig) => (config.renters && typeof config.renters.extraDriverFee === 'number' ? Math.max(0, config.renters.maxExtraDrivers ?? 2) : 0)

/** Guests need a licence and an age check: they drive it themselves (no driver included or added). */
export const selfDriven = (config: RentalConfig | undefined, choice: RentalChoice = {}) => !(config?.operator?.mode === 'included' || (config?.operator?.mode === 'optional' && choice.driver))

/* ---------- pricing the choice ---------- */

export interface RentalChoiceLine {
  id: string
  label: string
  quantity: number
  unitPrice: number
  total: number
}

export interface RentalChoiceInput {
  config: RentalConfig
  choice: RentalChoice
  /** What the booking rents: how many items (cars, boats) in all. */
  units: number
  mode?: 'hour' | 'day' | 'length'
  days?: number
  /** Hours for hourly and set-length rentals. */
  hours?: number
  /** Location names by id, for a one-way return's line. */
  locationName?: (id: string) => string | undefined
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`

/** The lines the guest's choices add to a rental: driver, cover, young and extra drivers, delivery, one-way. */
export function rentalChoiceLines(input: RentalChoiceInput): RentalChoiceLine[] {
  const { config, choice } = input
  const units = Math.max(1, Math.floor(input.units))
  const days = rentalDaysOf({ mode: input.mode, days: input.days, hours: input.hours })
  const hours = input.mode === 'day' || !input.mode ? days * 24 : Math.max(1, Math.floor(input.hours ?? 1))
  const lines: RentalChoiceLine[] = []
  const push = (id: string, label: string, quantity: number, unitPrice: number) => {
    if (quantity <= 0 || unitPrice <= 0) return
    lines.push({ id, label, quantity, unitPrice, total: quantity * unitPrice })
  }

  const operator = config.operator
  if (operator?.mode === 'optional' && choice.driver && whole(operator.price) > 0) {
    const per = operator.per ?? 'hour'
    // A driver by the day works the rental's days; by the hour, its hours (a day rental: 8 hours a day).
    const count = per === 'rental' ? 1 : per === 'day' ? days : input.mode === 'day' || !input.mode ? days * 8 : hours
    const span = per === 'rental' ? '' : per === 'day' ? ` · ${plural(days, 'day')}` : ` · ${plural(count, 'hour')}`
    push('rental-driver', `${operator.label || 'Driver'}${units > 1 ? ` × ${units}` : ''}${span}`, count * units, whole(operator.price))
  }

  const plan = config.protection?.plans.find((entry) => entry.id === choice.plan)
  if (plan) push('rental-cover', `${plan.name} · ${plural(days, 'day')}`, days * units, whole(plan.perDay))

  if (choice.young && config.renters?.youngUnder && whole(config.renters.youngFee) > 0) {
    push('rental-young', `Driver under ${config.renters.youngUnder} · ${plural(days, 'day')}`, days, whole(config.renters.youngFee))
  }
  if (choice.extraDrivers && choice.extraDrivers > 0 && typeof config.renters?.extraDriverFee === 'number') {
    push('rental-extra-drivers', `${plural(choice.extraDrivers, 'extra driver')} · ${plural(days, 'day')}`, days * choice.extraDrivers, whole(config.renters.extraDriverFee))
  }

  const delivery = config.handover?.delivery
  if (choice.delivery && delivery) {
    const ways = delivery.per === 'each_way' ? 2 : 1
    push('rental-delivery', delivery.per === 'each_way' ? 'Delivery and collection' : 'Delivery', ways, whole(delivery.fee))
  }
  const oneWay = config.handover?.oneWay
  if (choice.returnTo && oneWay) {
    const name = input.locationName?.(choice.returnTo)
    push('rental-one-way', name ? `Return to ${name}` : 'Return to another location', 1, whole(oneWay.fee))
  }
  return lines
}

/* ---------- the terms, in words ---------- */

export const DISTANCE_WORD: Record<RentalDistance['unit'], { one: string; many: string }> = {
  mi: { one: 'mile', many: 'miles' },
  km: { one: 'km', many: 'km' },
  hours: { one: 'engine hour', many: 'engine hours' },
}

/** "150 miles a day included, then $0.45 a mile", "$0.79 a mile", "Unlimited miles". */
export function distanceLine(distance: RentalDistance | undefined, money: (minor: number) => string): string | undefined {
  if (!distance) return undefined
  const word = DISTANCE_WORD[distance.unit]
  if (distance.unlimited) return `Unlimited ${word.many}`
  if (!distance.perDay) return distance.extra > 0 ? `${money(distance.extra)} a ${word.one}` : `Unlimited ${word.many}`
  const extra = distance.extra > 0 ? `, then ${money(distance.extra)} a ${word.one}` : ''
  return `${distance.perDay} ${word.many} a day included${extra}`
}

/** "Chauffeur included", "Add a captain: $95 an hour", undefined when the renter drives. */
export function operatorLine(operator: RentalOperator | undefined, money: (minor: number) => string): string | undefined {
  if (!operator || operator.mode === 'renter') return undefined
  const label = operator.label || 'Driver'
  if (operator.mode === 'included') return `${label} included`
  const per = operator.per ?? 'hour'
  const price = whole(operator.price)
  return price > 0 ? `${label} available: ${money(price)} ${per === 'rental' ? 'per rental' : `a${per === 'hour' ? 'n hour' : ' day'}`}` : `${label} available`
}

/** "Basic cover · $25 a day · you pay up to $1,500". */
export function planLine(plan: RentalProtectionPlan, money: (minor: number) => string): string {
  const paid = plan.deductible > 0 ? `you pay up to ${money(plan.deductible)}` : 'nothing more to pay'
  return `${plan.name} · ${money(plan.perDay)} a day · ${paid}`
}

/** "Late after 29 minutes: $25 an hour, a full day after 3 hours". */
export function lateLine(config: RentalConfig, money: (minor: number) => string): string | undefined {
  const fee = whole(config.lateFee)
  if (!fee && !config.lateDayAfterHours) return undefined
  const grace = config.graceMinutes ? `Late after ${config.graceMinutes} minutes: ` : 'Late returns: '
  const hourly = fee ? `${money(fee)} an hour` : ''
  const day = config.lateDayAfterHours ? `${hourly ? ', ' : ''}a full day after ${plural(config.lateDayAfterHours, 'hour')}` : ''
  return `${grace}${hourly}${day}`
}

/* ---------- coming back: what is charged at the counter ---------- */

export interface ReturnInput {
  config: RentalConfig
  /** Days the rental ran (for the allowance). */
  days: number
  /** Distance driven, or engine hours run, in the rental's unit. */
  used?: number
  /** Minutes after the agreed return time it came back. */
  lateMinutes?: number
  /** The item's day rate, for a full extra day. */
  dayRate?: number
  units?: number
}

/** What a return adds: distance over the allowance, then late hours or a full extra day. */
export function returnCharges(input: ReturnInput): RentalChoiceLine[] {
  const { config } = input
  const units = Math.max(1, Math.floor(input.units ?? 1))
  const lines: RentalChoiceLine[] = []
  const distance = config.distance
  if (distance && !distance.unlimited && distance.extra > 0 && input.used !== undefined) {
    const allowed = distance.perDay * Math.max(1, Math.floor(input.days)) * units
    const over = Math.max(0, Math.ceil(input.used - allowed))
    const word = DISTANCE_WORD[distance.unit]
    const label = allowed > 0 ? `${over} ${over === 1 ? word.one : word.many} over the allowance` : `${over} ${over === 1 ? word.one : word.many}`
    if (over > 0) lines.push({ id: 'return-distance', label, quantity: over, unitPrice: distance.extra, total: over * distance.extra })
  }
  const late = Math.max(0, Math.floor(input.lateMinutes ?? 0) - Math.max(0, config.graceMinutes ?? 0))
  if (late > 0) {
    const lateHours = Math.ceil(late / 60)
    const dayRate = whole(input.dayRate)
    if (config.lateDayAfterHours && lateHours > config.lateDayAfterHours && dayRate > 0) {
      lines.push({ id: 'return-late-day', label: 'Late: an extra day', quantity: units, unitPrice: dayRate, total: units * dayRate })
    } else if (whole(config.lateFee) > 0) {
      lines.push({ id: 'return-late', label: `Late: ${plural(lateHours, 'hour')}`, quantity: lateHours * units, unitPrice: whole(config.lateFee), total: lateHours * units * whole(config.lateFee) })
    }
  }
  return lines
}

/** Whether a rental asks the guest for anything beyond items and times. */
export function hasRentalChoices(activity: RentalSource): boolean {
  const config = activity.rental
  if ((activity.kind ?? 'trip') !== 'rental' || !config) return false
  return Boolean(
    config.operator?.mode === 'optional' ||
      (config.protection?.plans.length ?? 0) > 0 ||
      youngOffered(config, activity.minAge) ||
      extraDriversMax(config) > 0 ||
      config.handover?.delivery ||
      config.handover?.oneWay,
  )
}
