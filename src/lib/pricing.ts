/* ==========================================================================
   Pricing — rules that move the price (season, weekday, early bird, last
   minute, group size), promo codes, and gift cards. Browser-safe: plain data
   and arithmetic, so the storefront widget, checkout and the walk-in sale
   screen all price the same way. Money is in minor units.
   ========================================================================== */

export type RuleKind = 'season' | 'weekday' | 'early_bird' | 'last_minute' | 'group'

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
  hoursWithin?: number
  minGuests?: number
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
  early_bird: 'Early bird',
  last_minute: 'Last minute',
  group: 'Group size',
}

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
}

const mmdd = (iso: string) => iso.slice(5, 10)

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
    default:
      return false
  }
}

/** Every matching rule, applied one after another. Never below half price. */
export function applyRules(rules: PricingRule[], context: PriceContext): { multiplier: number; applied: PricingRule[] } {
  const applied = rules.filter((rule) => ruleMatches(rule, context))
  const multiplier = applied.reduce((product, rule) => product * (1 + rule.percent / 100), 1)
  return { multiplier: Math.max(0.5, Math.round(multiplier * 1000) / 1000), applied }
}

export function ruleSummary(rule: PricingRule): string {
  const sign = rule.percent > 0 ? `+${rule.percent}%` : `${rule.percent}%`
  switch (rule.kind) {
    case 'season':
      return `${sign} from ${rule.from} to ${rule.to}`
    case 'weekday':
      return `${sign} on ${(rule.weekdays ?? []).map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}`
    case 'early_bird':
      return `${sign} when booked ${rule.daysAhead} days ahead`
    case 'last_minute':
      return `${sign} within ${rule.hoursWithin} hours of the start`
    case 'group':
      return `${sign} for ${rule.minGuests} guests or more`
  }
}

/* --------------------------------------------------------------------------
   Promo codes and gift cards
   -------------------------------------------------------------------------- */

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
