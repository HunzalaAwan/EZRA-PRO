/* ==========================================================================
   Pricing — rules that move the price (season, weekday, start time, set
   dates, early bird, last minute, group size, filling up, quiet times), promo
   codes, and gift cards. Browser-safe: plain data and arithmetic, so the
   storefront widget, checkout and the walk-in sale screen all price the same
   way. Money is in minor units.
   ========================================================================== */

export type RuleKind = 'season' | 'weekday' | 'time_of_day' | 'dates' | 'early_bird' | 'last_minute' | 'group' | 'filling_up' | 'slow_time'

export interface PricingRule {
  id: string
  name: string
  kind: RuleKind
  /** Percent change: -10 is ten percent off, 15 is fifteen percent up. */
  percent: number
  /** Activity slugs it applies to; empty means every activity. */
  activitySlugs: string[]
  /** season: from/to "MM-DD"; weekday: 0..6; early_bird: days ahead; last_minute: hours within; group: guests at least. */
  from?: string
  to?: string
  weekdays?: number[]
  daysAhead?: number
  /** last_minute: within this many hours of the start. slow_time: the same, optional (absent or 0: any time). */
  hoursWithin?: number
  minGuests?: number
  /** time_of_day: start times from–to, "HH:MM", both included. A window past midnight wraps. */
  fromTime?: string
  toTime?: string
  /** dates: day keys "YYYY-MM-DD", or "MM-DD" for the same day every year. */
  dates?: string[]
  /** filling_up: at least this percent of the time slot's spots booked. slow_time: under this percent. */
  soldPercent?: number
  active: boolean
}

export interface PromoCode {
  code: string
  kind: 'percent' | 'fixed'
  /** Percent, or minor units for fixed. */
  value: number
  activitySlugs: string[]
  minSubtotal: number
  startsOn?: string
  endsOn?: string
  maxUses: number
  used: number
  active: boolean
  note?: string
  /**
   * A family of codes made one per guest: checkout also takes CODE-XXXX (an automation gives each
   * guest WELCOME10-7QK2, so a code can't be passed around as one).
   */
  perGuest?: boolean
  /** The automation that made it, when one did. */
  flowId?: string
}

export interface GiftCard {
  code: string
  initial: number
  balance: number
  purchaser: string
  recipient: string
  recipientEmail: string
  message?: string
  issuedAt: string
  expiresAt: string
  status: 'active' | 'redeemed' | 'void'
}

export const RULE_KIND_LABEL: Record<RuleKind, string> = {
  season: 'Season',
  weekday: 'Day of the week',
  time_of_day: 'Time of day',
  dates: 'Set dates',
  early_bird: 'Early bird',
  last_minute: 'Last minute',
  filling_up: 'Filling up',
  slow_time: 'Quiet times',
  group: 'Group size',
}

/**
 * Demand rules: a booking gets at most one of these, the best for the guest,
 * so a book-early discount and a quiet-time discount never stack.
 */
export const DEMAND_RULE_KINDS: readonly RuleKind[] = ['early_bird', 'last_minute', 'filling_up', 'slow_time']

const BH_BOATS = [
  'sunset-catamaran-sail-snorkel',
  'molokini-crater-dawn-patrol',
  'family-reef-snorkel',
  'whale-watch-eco-cruise',
  'lanai-coast-snorkel-sail',
]

export function defaultRules(slug: string): PricingRule[] {
  const common: PricingRule[] = [
    { id: 'rule_early', name: 'Early bird', kind: 'early_bird', percent: -10, activitySlugs: [], daysAhead: 30, active: true },
    { id: 'rule_group', name: 'Groups of 8 or more', kind: 'group', percent: -12, activitySlugs: [], minGuests: 8, active: true },
  ]
  if (slug !== 'blue-horizon') return common
  return [
    { id: 'rule_peak', name: 'Holiday peak', kind: 'season', percent: 15, activitySlugs: [], from: '12-18', to: '01-04', active: true },
    { id: 'rule_whale', name: 'Whale season', kind: 'season', percent: 10, activitySlugs: ['whale-watch-eco-cruise'], from: '12-15', to: '04-15', active: true },
    { id: 'rule_weekend', name: 'Weekend boats', kind: 'weekday', percent: 8, activitySlugs: BH_BOATS, weekdays: [0, 6], active: true },
    { id: 'rule_last', name: 'Last-minute rentals', kind: 'last_minute', percent: -15, activitySlugs: ['jet-ski-rental', 'kayak-sup-rental'], hoursWithin: 3, active: true },
    ...common,
  ]
}

export function defaultPromos(slug: string): PromoCode[] {
  const base: PromoCode[] = [
    { code: 'ALOHA10', kind: 'percent', value: 10, activitySlugs: [], minSubtotal: 0, maxUses: 500, used: 212, active: true, note: 'Newsletter' },
    { code: 'LOCALS15', kind: 'percent', value: 15, activitySlugs: [], minSubtotal: 0, maxUses: 300, used: 143, active: true, note: 'Kamaaina, show ID' },
    { code: 'SUMMER24', kind: 'percent', value: 20, activitySlugs: [], minSubtotal: 0, endsOn: '2024-09-01', maxUses: 1000, used: 988, active: true, note: 'Expired campaign' },
  ]
  if (slug !== 'blue-horizon') return base
  return [
    { code: 'SUNSET25', kind: 'fixed', value: 2500, activitySlugs: ['sunset-catamaran-sail-snorkel'], minSubtotal: 15000, maxUses: 200, used: 61, active: true, note: 'Hotel concierge partners' },
    ...base,
  ]
}

export function defaultGiftCards(slug: string): GiftCard[] {
  if (slug !== 'blue-horizon') return []
  return [
    { code: 'GIFT-7H2K-9QPL', initial: 20000, balance: 20000, purchaser: 'Maria Okafor', recipient: 'Tomas Okafor', recipientEmail: 'tomas.okafor@gmail.com', message: 'Happy 40th! Go see the turtles.', issuedAt: '2026-08-02', expiresAt: '2029-08-02', status: 'active' },
    { code: 'GIFT-3MV8-2XRA', initial: 15000, balance: 4100, purchaser: 'Sam Lindqvist', recipient: 'Ana Lindqvist', recipientEmail: 'ana.l@proton.me', issuedAt: '2026-05-19', expiresAt: '2029-05-19', status: 'active' },
    { code: 'GIFT-PQ4N-7TD2', initial: 10000, balance: 0, purchaser: 'Kai Nakamura', recipient: 'Leilani Nakamura', recipientEmail: 'leilani.n@icloud.com', issuedAt: '2026-01-11', expiresAt: '2029-01-11', status: 'redeemed' },
    { code: 'GIFT-8WZC-5LME', initial: 25000, balance: 25000, purchaser: 'Blue Horizon', recipient: 'Charity auction winner', recipientEmail: 'events@mauifoundation.org', message: 'Thank you for supporting reef restoration.', issuedAt: '2026-09-01', expiresAt: '2029-09-01', status: 'active' },
  ]
}

/* --------------------------------------------------------------------------
   Rules
   -------------------------------------------------------------------------- */

export interface PriceContext {
  activitySlug: string
  startsAt: string
  nowIso: string
  guests: number
  /** The time slot's spots, and how many are booked before this booking: for filling-up and quiet-time rules. */
  capacity?: number
  booked?: number
}

const mmdd = (iso: string) => iso.slice(5, 10)

/** "9:00" and "09:00" are the same start time. */
function clock(time: string): string {
  const [h, m] = time.trim().split(':')
  return `${(h ?? '').padStart(2, '0')}:${(m ?? '00').padStart(2, '0').slice(0, 2)}`
}

/** How full the time slot is, 0–100; undefined without its spots and bookings. */
function soldPercentOf(context: PriceContext): number | undefined {
  if (!context.capacity || context.capacity <= 0 || context.booked === undefined) return undefined
  return (Math.max(0, context.booked) / context.capacity) * 100
}

export function ruleMatches(rule: PricingRule, context: PriceContext): boolean {
  if (!rule.active) return false
  if (rule.activitySlugs.length > 0 && !rule.activitySlugs.includes(context.activitySlug)) return false
  const start = new Date(context.startsAt)
  const hoursAhead = (start.getTime() - new Date(context.nowIso).getTime()) / 3_600_000
  switch (rule.kind) {
    case 'season': {
      if (!rule.from || !rule.to) return false
      const day = mmdd(context.startsAt)
      return rule.from <= rule.to ? day >= rule.from && day <= rule.to : day >= rule.from || day <= rule.to
    }
    case 'weekday':
      return (rule.weekdays ?? []).includes(start.getDay())
    case 'early_bird':
      return hoursAhead >= (rule.daysAhead ?? 30) * 24
    case 'last_minute':
      return hoursAhead >= 0 && hoursAhead <= (rule.hoursWithin ?? 24)
    case 'group':
      return context.guests >= (rule.minGuests ?? 8)
    case 'time_of_day': {
      if (!rule.fromTime || !rule.toTime || context.startsAt.length < 16) return false
      const time = clock(context.startsAt.slice(11, 16))
      const from = clock(rule.fromTime)
      const to = clock(rule.toTime)
      return from <= to ? time >= from && time <= to : time >= from || time <= to
    }
    case 'dates': {
      const key = context.startsAt.slice(0, 10)
      return (rule.dates ?? []).some((date) => (date.length === 5 ? date === key.slice(5) : date === key))
    }
    case 'filling_up': {
      const sold = soldPercentOf(context)
      return sold !== undefined && sold >= (rule.soldPercent ?? 80)
    }
    case 'slow_time': {
      const sold = soldPercentOf(context)
      if (sold === undefined || sold >= (rule.soldPercent ?? 50)) return false
      if (!rule.hoursWithin || rule.hoursWithin <= 0) return true
      return hoursAhead >= 0 && hoursAhead <= rule.hoursWithin
    }
    default:
      return false
  }
}

/** The rule best for the guest: the lowest percent; the first listed on a tie. */
function bestOf(rules: PricingRule[]): PricingRule | undefined {
  return rules.reduce<PricingRule | undefined>((best, rule) => (!best || rule.percent < best.percent ? rule : best), undefined)
}

/**
 * Of the group sizes a booking reaches, the biggest step: 6+ save 10% and 10+
 * save 15% gives a group of 12 the 15%; 13+ add 10% and 20+ add 20% gives a
 * group of 25 the 20%. Two rules on the same size: the best for the guest.
 */
function biggestStep(rules: PricingRule[]): PricingRule | undefined {
  return rules.reduce<PricingRule | undefined>((top, rule) => {
    if (!top) return rule
    const size = rule.minGuests ?? 8
    const topSize = top.minGuests ?? 8
    return size > topSize || (size === topSize && rule.percent < top.percent) ? rule : top
  }, undefined)
}

/**
 * Every matching rule, applied one after another. Never below half price.
 * Two kinds don't stack, so steps work as steps: of the group sizes a booking
 * reaches only the biggest step applies, and of the demand rules (early bird,
 * last minute, filling up, quiet times) only the best one for the guest.
 */
export function applyRules(rules: PricingRule[], context: PriceContext): { multiplier: number; applied: PricingRule[] } {
  const matched = rules.filter((rule) => ruleMatches(rule, context))
  const group = biggestStep(matched.filter((rule) => rule.kind === 'group'))
  const demand = bestOf(matched.filter((rule) => DEMAND_RULE_KINDS.includes(rule.kind)))
  const applied = matched.filter((rule) => (rule.kind === 'group' ? rule === group : DEMAND_RULE_KINDS.includes(rule.kind) ? rule === demand : true))
  const multiplier = applied.reduce((product, rule) => product * (1 + rule.percent / 100), 1)
  return { multiplier: Math.max(0.5, Math.round(multiplier * 1000) / 1000), applied }
}

export function ruleSummary(rule: PricingRule): string {
  const sign = rule.percent > 0 ? `+${rule.percent}%` : `${rule.percent}%`
  switch (rule.kind) {
    case 'season': {
      // "MM-DD" ends read as "Dec 18"; anything else as typed.
      const day = (value?: string) => (value && /^\d{2}-\d{2}$/.test(value) ? dayLabel(value) : (value ?? '…'))
      return `${sign} from ${day(rule.from)} to ${day(rule.to)}`
    }
    case 'weekday':
      return `${sign} on ${(rule.weekdays ?? []).map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}`
    case 'early_bird':
      return `${sign} when booked ${rule.daysAhead} days ahead`
    case 'last_minute':
      return `${sign} within ${rule.hoursWithin} hours of the start`
    case 'group':
      return `${sign} for ${rule.minGuests} guests or more`
    case 'time_of_day':
      return `${sign} for start times from ${rule.fromTime ?? '…'} to ${rule.toTime ?? '…'}`
    case 'dates': {
      const dates = [...(rule.dates ?? [])].sort()
      if (dates.length === 0) return `${sign} on set dates`
      const yearly = dates.every((date) => date.length === 5) ? ' every year' : ''
      return dates.length <= 3 ? `${sign} on ${dates.map(dayLabel).join(', ')}${yearly}` : `${sign} on ${dates.length} dates${yearly}`
    }
    case 'filling_up':
      return `${sign} when ${rule.soldPercent ?? 80}% of spots are booked`
    case 'slow_time':
      return rule.hoursWithin && rule.hoursWithin > 0
        ? `${sign} when under ${rule.soldPercent ?? 50}% booked within ${rule.hoursWithin} hours of the start`
        : `${sign} when under ${rule.soldPercent ?? 50}% booked`
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Dec 31", from a day key or "MM-DD". */
export function dayLabel(key: string): string {
  const [month, day] = (key.length === 5 ? key : key.slice(5)).split('-').map(Number)
  return `${MONTHS[(month || 1) - 1]} ${day || 1}`
}

/* --------------------------------------------------------------------------
   Promo codes and gift cards
   -------------------------------------------------------------------------- */

/** The promo a typed code is: the code itself, or a guest's own CODE-XXXX from a per-guest family. */
export function findPromo(promos: PromoCode[], typed: string | null | undefined): PromoCode | undefined {
  if (!typed) return undefined
  const code = typed.trim().toUpperCase()
  const exact = promos.find((promo) => promo.code === code)
  if (exact) return exact
  const match = /^([A-Z0-9]+)-[A-Z0-9]{4,}$/.exec(code)
  return match ? promos.find((promo) => promo.perGuest && promo.code === match[1]) : undefined
}

export function promoProblem(promo: PromoCode | undefined, context: { activitySlug: string; subtotal: number; todayKey: string }): string | null {
  if (!promo || !promo.active) return 'That code is not valid'
  if (promo.endsOn && context.todayKey > promo.endsOn) return 'That code has expired'
  if (promo.startsOn && context.todayKey < promo.startsOn) return 'That code is not active yet'
  if (promo.used >= promo.maxUses) return 'That code has been used up'
  if (promo.activitySlugs.length > 0 && !promo.activitySlugs.includes(context.activitySlug)) return 'That code does not apply to this activity'
  if (context.subtotal < promo.minSubtotal) return `That code needs a subtotal of at least ${(promo.minSubtotal / 100).toFixed(0)}`
  return null
}

export function promoDiscount(promo: PromoCode, subtotal: number): number {
  return promo.kind === 'percent' ? Math.round((subtotal * promo.value) / 100) : Math.min(subtotal, promo.value)
}

export function giftProblem(card: GiftCard | undefined, todayKey: string): string | null {
  if (!card || card.status === 'void') return 'That gift card code is not valid'
  if (card.balance <= 0 || card.status === 'redeemed') return 'That gift card has been used up'
  if (todayKey > card.expiresAt) return 'That gift card has expired'
  return null
}

export function newGiftCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const block = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `GIFT-${block()}-${block()}`
}
