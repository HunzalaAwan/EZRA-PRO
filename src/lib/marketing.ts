import type { Customer } from '@/types'
import type { PromoCode } from '@/lib/pricing'

/* ==========================================================================
   Marketing — audiences, campaigns, sign-up forms, referrals and the rules
   every marketing message follows. Browser-safe plain data: the stores live
   in use-marketing, the automations themselves are message templates in
   messaging.ts, and the numbers here are worked out from the guest list.
   ========================================================================== */

/* --------------------------------------------------------------------------
   The guest list as marketing sees it
   -------------------------------------------------------------------------- */

export interface MarketingContact {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  totalBookings: number
  /** Major units. */
  spend: number
  lastBookingAt: string | null
  tags: string[]
  emailOptIn: boolean
  smsOptIn: boolean
  segment: Customer['segment']
  /** Activities they have booked. */
  activitySlugs: string[]
}

/* --------------------------------------------------------------------------
   Audiences
   -------------------------------------------------------------------------- */

export interface AudienceFilter {
  /** Empty: any. */
  segments: Customer['segment'][]
  /** Booked any of these. Empty: any. */
  activitySlugs: string[]
  /** Their last trip was within, or more than, this many days ago. */
  lastTrip?: { op: 'within' | 'over'; days: number }
  minBookings?: number
  /** Major units, lifetime. */
  minSpend?: number
  countries: string[]
  tags: string[]
  /** Only guests who agreed to hear from you on this channel. */
  consent: 'email' | 'sms' | 'either'
}

export interface Audience {
  id: string
  name: string
  description: string
  filter: AudienceFilter
  builtIn?: boolean
}

export const EMPTY_FILTER: AudienceFilter = { segments: [], activitySlugs: [], countries: [], tags: [], consent: 'either' }

export function defaultAudiences(homeCountry: string): Audience[] {
  return [
    { id: 'aud_all', name: 'Everyone subscribed', description: 'Every guest who said yes to email or texts.', filter: EMPTY_FILTER, builtIn: true },
    { id: 'aud_new', name: 'First-timers', description: 'Booked once. The best time to win a second trip.', filter: { ...EMPTY_FILTER, segments: ['new'] }, builtIn: true },
    { id: 'aud_repeat', name: 'Repeat guests', description: 'Two trips or more.', filter: { ...EMPTY_FILTER, minBookings: 2 }, builtIn: true },
    { id: 'aud_vip', name: 'VIPs', description: 'Your biggest spenders.', filter: { ...EMPTY_FILTER, segments: ['vip'] }, builtIn: true },
    {
      id: 'aud_lapsed',
      name: 'Not back in 4 months',
      description: 'Their last booking was more than 120 days ago.',
      filter: { ...EMPTY_FILTER, lastTrip: { op: 'over', days: 120 } },
      builtIn: true,
    },
    { id: 'aud_local', name: 'Locals', description: `Guests who live in ${homeCountry}.`, filter: { ...EMPTY_FILTER, countries: [homeCountry] }, builtIn: true },
  ]
}

export function matchesAudience(contact: MarketingContact, filter: AudienceFilter, nowIso: string): boolean {
  if (filter.consent === 'email' && !contact.emailOptIn) return false
  if (filter.consent === 'sms' && !contact.smsOptIn) return false
  if (filter.consent === 'either' && !contact.emailOptIn && !contact.smsOptIn) return false
  if (filter.segments.length > 0 && !filter.segments.includes(contact.segment)) return false
  if (filter.activitySlugs.length > 0 && !filter.activitySlugs.some((slug) => contact.activitySlugs.includes(slug))) return false
  if (filter.countries.length > 0 && !filter.countries.includes(contact.country)) return false
  if (filter.tags.length > 0 && !filter.tags.some((tag) => contact.tags.includes(tag))) return false
  if (filter.minBookings && contact.totalBookings < filter.minBookings) return false
  if (filter.minSpend && contact.spend < filter.minSpend) return false
  if (filter.lastTrip) {
    if (!contact.lastBookingAt) return filter.lastTrip.op === 'over'
    const days = (new Date(nowIso).getTime() - new Date(contact.lastBookingAt).getTime()) / 86_400_000
    if (filter.lastTrip.op === 'within' ? days > filter.lastTrip.days : days <= filter.lastTrip.days) return false
  }
  return true
}

export function audienceSize(contacts: MarketingContact[], filter: AudienceFilter, nowIso: string) {
  const members = contacts.filter((contact) => matchesAudience(contact, filter, nowIso))
  return {
    members,
    count: members.length,
    email: members.filter((contact) => contact.emailOptIn).length,
    sms: members.filter((contact) => contact.smsOptIn).length,
  }
}

/** A plain-English line for the rules, for lists and previews. */
export function describeFilter(filter: AudienceFilter, activityName: (slug: string) => string): string {
  const parts: string[] = []
  if (filter.segments.length > 0) parts.push(filter.segments.map((segment) => SEGMENT_LABEL[segment]).join(' or '))
  if (filter.activitySlugs.length > 0) parts.push(`booked ${filter.activitySlugs.map(activityName).join(' or ')}`)
  if (filter.lastTrip) parts.push(filter.lastTrip.op === 'within' ? `last trip in the past ${filter.lastTrip.days} days` : `no trip in ${filter.lastTrip.days} days`)
  if (filter.minBookings) parts.push(`${filter.minBookings}+ bookings`)
  if (filter.minSpend) parts.push(`spent ${filter.minSpend}+`)
  if (filter.countries.length > 0) parts.push(`from ${filter.countries.join(', ')}`)
  if (filter.tags.length > 0) parts.push(`tagged ${filter.tags.join(', ')}`)
  if (filter.consent !== 'either') parts.push(filter.consent === 'email' ? 'email subscribers' : 'text subscribers')
  return parts.length > 0 ? parts.join(' · ') : 'Every subscribed guest'
}

export const SEGMENT_LABEL: Record<Customer['segment'], string> = { new: 'First-timers', returning: 'Returning', vip: 'VIP', lapsed: 'Lapsed' }

/* --------------------------------------------------------------------------
   Offers — a code a message carries. Saved as a real promo code, so it works
   at checkout the moment the message goes.
   -------------------------------------------------------------------------- */

export interface MarketingOffer {
  enabled: boolean
  percent: number
  /** Days the code stays good after the message goes. */
  validDays: number
  code: string
}

export const NO_OFFER: MarketingOffer = { enabled: false, percent: 10, validDays: 14, code: '' }

/* --------------------------------------------------------------------------
   Campaigns — one-off emails and texts to an audience
   -------------------------------------------------------------------------- */

export type CampaignStatus = 'draft' | 'scheduled' | 'sent'

export interface CampaignStats {
  recipients: number
  delivered: number
  opened: number
  clicked: number
  bookings: number
  /** Major units. */
  revenue: number
  unsubscribed: number
}

export interface Campaign {
  id: string
  name: string
  channel: 'email' | 'sms'
  audienceId: string
  subject: string
  /** The grey line after the subject in most inboxes. */
  preheader: string
  body: string
  /** Optional button in the email, to an activity or the storefront. */
  button: { enabled: boolean; label: string; activitySlug: string }
  offer: MarketingOffer
  /** A second subject line sent to half the list; the winner goes to the rest. */
  abTest: { enabled: boolean; subjectB: string }
  status: CampaignStatus
  sendAt?: string
  sentAt?: string
  stats?: CampaignStats
  createdAt: string
}

export const CAMPAIGN_PLACEHOLDERS = ['{first_name}', '{business}', '{offer_code}', '{offer_percent}', '{link}']

/* --------------------------------------------------------------------------
   Sign-up forms
   -------------------------------------------------------------------------- */

export interface SignupForms {
  popup: {
    enabled: boolean
    headline: string
    text: string
    button: string
    /** When it opens. */
    trigger: 'delay' | 'exit' | 'scroll'
    delaySeconds: number
    scrollPercent: number
    /** Days before it shows again to someone who closed it. */
    againAfterDays: number
    collectPhone: boolean
    offer: MarketingOffer
  }
  footer: { enabled: boolean; headline: string; text: string }
  checkout: { enabled: boolean; label: string; preChecked: boolean; sms: boolean; smsLabel: string }
}

export function defaultForms(slug: string): SignupForms {
  const prefix = slug.replace(/[^a-z]/gi, '').slice(0, 5).toUpperCase() || 'HELLO'
  return {
    popup: {
      enabled: true,
      headline: 'Get 10% off your first trip',
      text: 'Join the list for first dibs on new trips, last-minute seats and the odd locals-only deal. No spam, unsubscribe any time.',
      button: 'Send my code',
      trigger: 'delay',
      delaySeconds: 12,
      scrollPercent: 50,
      againAfterDays: 14,
      collectPhone: false,
      offer: { enabled: true, percent: 10, validDays: 30, code: `${prefix}10` },
    },
    footer: { enabled: true, headline: 'Trip news and last-minute seats', text: 'One email a month, at most.' },
    checkout: {
      enabled: true,
      label: 'Send me new trips and offers. Unsubscribe any time.',
      preChecked: false,
      sms: true,
      smsLabel: 'Text me last-minute seats. Msg & data rates may apply. Reply STOP to opt out.',
    },
  }
}

/* --------------------------------------------------------------------------
   Referrals and rewards
   -------------------------------------------------------------------------- */

export interface Rewards {
  referral: {
    enabled: boolean
    /** What the friend gets on their first booking. */
    friendPercent: number
    /** Credit for the guest who sent them, in major units. */
    referrerCredit: number
    /** The friend's booking has to reach this, in major units. */
    minSpend: number
    message: string
    showAfterBooking: boolean
    inReviewEmail: boolean
  }
  loyalty: {
    enabled: boolean
    /** Points for every 1 spent. */
    pointsPerUnit: number
    /** Points needed for one reward. */
    rewardAt: number
    /** The reward, in major units off a booking. */
    rewardValue: number
    /** Points earned for a review. */
    reviewBonus: number
  }
}

export const DEFAULT_REWARDS: Rewards = {
  referral: {
    enabled: true,
    friendPercent: 10,
    referrerCredit: 20,
    minSpend: 50,
    message: 'I just booked with {business} and loved it. Here is {friend_percent} off your first trip:',
    showAfterBooking: true,
    inReviewEmail: true,
  },
  loyalty: { enabled: false, pointsPerUnit: 1, rewardAt: 500, rewardValue: 25, reviewBonus: 50 },
}

/* --------------------------------------------------------------------------
   Rules every marketing message follows
   -------------------------------------------------------------------------- */

export interface MarketingSettings {
  /** Stops every marketing email and text. Booking messages still go. */
  paused: boolean
  senderName: string
  replyTo: string
  quietHours: { enabled: boolean; from: string; to: string }
  /** At most this many marketing messages per guest per week. */
  frequencyCap: { enabled: boolean; perWeek: number }
  /** Don't send marketing to someone with a trip in the next few days. */
  skipUpcoming: { enabled: boolean; days: number }
  footer: string
  doubleOptIn: boolean
  utm: { enabled: boolean; source: string; medium: string }
  smsConsent: string
}

export function defaultSettings(business: string, email: string): MarketingSettings {
  return {
    paused: false,
    senderName: business,
    replyTo: email,
    quietHours: { enabled: true, from: '21:00', to: '08:00' },
    frequencyCap: { enabled: true, perWeek: 2 },
    skipUpcoming: { enabled: true, days: 3 },
    footer: `You get this because you booked with ${business} or joined our list.`,
    doubleOptIn: false,
    utm: { enabled: true, source: 'ezra', medium: 'email' },
    smsConsent: 'Msg & data rates may apply. Reply STOP to opt out, HELP for help.',
  }
}

/* --------------------------------------------------------------------------
   Numbers — steady demo figures, worked out from the message and the list
   -------------------------------------------------------------------------- */

function hash(text: string): number {
  let value = 2166136261
  for (let i = 0; i < text.length; i += 1) value = Math.imul(value ^ text.charCodeAt(i), 16777619)
  return Math.abs(value)
}

/** A steady 0–1 number per key. */
export function steady(key: string): number {
  return (hash(key) % 1000) / 1000
}

export interface AutomationStats {
  sent: number
  openRate: number
  clickRate: number
  bookings: number
  revenue: number
}

/** Share of the list each automation reaches in a month: a welcome goes to new sign-ups, a waitlist text to a handful. */
const MONTHLY_REACH: Record<string, number> = {
  welcome: 0.02,
  browse_abandon: 0.035,
  next_trip: 0.03,
  win_back: 0.025,
  anniversary: 0.015,
  referral_ask: 0.012,
  gift_expiry: 0.003,
  birthday: 0.018,
  waitlist: 0.004,
}

/** Last 30 days for one automation. Off automations sent nothing. */
export function automationStats(key: string, enabled: boolean, listSize: number, avgOrder: number, growth: boolean): AutomationStats {
  if (!enabled) return { sent: 0, openRate: 0, clickRate: 0, bookings: 0, revenue: 0 }
  const r = steady(key)
  const sent = Math.max(3, Math.round(listSize * (growth ? (MONTHLY_REACH[key] ?? 0.02) * (0.8 + r * 0.4) : 0.3 + r * 0.3)))
  const openRate = growth ? 0.36 + r * 0.2 : 0.62 + r * 0.25
  const clickRate = openRate * (growth ? 0.12 + r * 0.1 : 0.08 + r * 0.1)
  const bookings = growth ? Math.round(sent * clickRate * (0.08 + r * 0.08)) : 0
  return { sent, openRate, clickRate, bookings, revenue: Math.round(bookings * avgOrder) }
}

export function campaignStatsFor(id: string, recipients: number, avgOrder: number, channel: Campaign['channel']): CampaignStats {
  const r = steady(id)
  const delivered = Math.round(recipients * (0.97 + r * 0.025))
  const opened = channel === 'sms' ? delivered : Math.round(delivered * (0.34 + r * 0.24))
  const clicked = Math.round(opened * (channel === 'sms' ? 0.09 + r * 0.08 : 0.12 + r * 0.1))
  const bookings = Math.round(clicked * (0.05 + r * 0.06))
  return { recipients, delivered, opened, clicked, bookings, revenue: Math.round(bookings * avgOrder), unsubscribed: Math.round(delivered * (0.002 + r * 0.004)) }
}

export function percent(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`
}

/* --------------------------------------------------------------------------
   Offer codes land in Pricing → Promo codes, so checkout accepts them.
   -------------------------------------------------------------------------- */

export function cleanCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20)
}

/** The promo list with this offer's code added or brought up to date. */
export function upsertOfferPromo(promos: PromoCode[], offer: MarketingOffer, note: string, activitySlugs: string[] = []): PromoCode[] {
  const code = cleanCode(offer.code)
  if (!offer.enabled || !code) return promos
  const existing = promos.find((promo) => promo.code === code)
  const next: PromoCode = {
    code,
    kind: 'percent',
    value: Math.min(100, Math.max(1, Math.round(offer.percent))),
    activitySlugs,
    minSubtotal: existing?.minSubtotal ?? 0,
    maxUses: existing?.maxUses ?? 100000,
    used: existing?.used ?? 0,
    active: true,
    note,
  }
  return existing ? promos.map((promo) => (promo.code === code ? next : promo)) : [next, ...promos]
}
