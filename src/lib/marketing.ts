import type { CurrencyCode, Customer } from '@/types'
import type { PromoCode } from '@/lib/pricing'
import type { EmailDesign } from '@/lib/email-design'
import type { EmailSetup } from '@/lib/channels'
import { formatCurrency } from '@/lib/utils'
import { evaluate, guestFactsFromContact } from '@/lib/flows/conditions'
import { describeGroup } from '@/lib/flows/describe'
import type { Condition, ConditionGroup } from '@/lib/flows/types'

/* ==========================================================================
   Marketing — audiences, campaigns, sign-up forms and the rules every
   marketing message follows. Browser-safe plain data: the stores live in
   use-marketing, automations are flows (src/lib/flows), and the campaign
   numbers here are worked out from the guest list.
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
  /** Start of their next trip, local ISO, if one is booked. Campaigns skip guests travelling soon. */
  nextTripAt?: string | null
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
  /**
   * Rule-builder audiences keep a copy of their rules here too, so anything
   * that matches on `audience.filter` sees the same guests. When set, the
   * fixed fields above are ignored; consent still applies.
   */
  rules?: ConditionGroup
  /** The business's country when the rules were saved, for "Lives locally". */
  homeCountry?: string
}

export interface Audience {
  id: string
  name: string
  description: string
  filter: AudienceFilter
  /** Guest rules from the rule builder (guest fields only). When set they replace the fixed filter; consent still applies. */
  rules?: ConditionGroup
  builtIn?: boolean
}

/** What audience helpers accept: a whole audience, or just its filter. */
export type AudienceTarget = Audience | AudienceFilter

const filterOf = (target: AudienceTarget): AudienceFilter => ('filter' in target ? target.filter : target)
const rulesOf = (target: AudienceTarget): ConditionGroup | undefined => ('filter' in target ? (target.rules ?? target.filter.rules) : target.rules)

/** Does this audience use the rule builder? */
export const hasAudienceRules = (target: AudienceTarget) => rulesOf(target) !== undefined

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

export interface AudienceOptions {
  /** The business's country, for "Lives locally". Falls back to the one saved with the rules. */
  homeCountry?: string
}

/**
 * Is this guest in the audience? Consent comes first, always. Rule-builder
 * audiences then check their rules with the same facts automations use;
 * older ones (and the ready-made ones) use the fixed filter.
 */
export function matchesAudience(contact: MarketingContact, target: AudienceTarget, nowIso: string, options: AudienceOptions = {}): boolean {
  const filter = filterOf(target)
  if (filter.consent === 'email' && !contact.emailOptIn) return false
  if (filter.consent === 'sms' && !contact.smsOptIn) return false
  if (filter.consent === 'either' && !contact.emailOptIn && !contact.smsOptIn) return false
  const rules = rulesOf(target)
  if (rules) {
    const hasUpcomingTrip = Boolean(contact.nextTripAt) && new Date(contact.nextTripAt!).getTime() > new Date(nowIso).getTime()
    const guest = guestFactsFromContact(contact, nowIso, { homeCountry: options.homeCountry || filter.homeCountry, hasUpcomingTrip })
    return evaluate(rules, { guest })
  }
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

export function audienceSize(contacts: MarketingContact[], target: AudienceTarget, nowIso: string, options: AudienceOptions = {}) {
  const members = contacts.filter((contact) => matchesAudience(contact, target, nowIso, options))
  return {
    members,
    count: members.length,
    email: members.filter((contact) => contact.emailOptIn).length,
    sms: members.filter((contact) => contact.smsOptIn).length,
  }
}

/**
 * An older fixed filter as builder rules, so an audience made before the
 * rule builder (or a copy of a ready-made one) opens with the same checks.
 */
export function filterToRules(filter: AudienceFilter): ConditionGroup {
  if (filter.rules) return filter.rules
  const conditions: Condition[] = []
  const add = (condition: Omit<Condition, 'id'>) => conditions.push({ ...condition, id: `cond_f${conditions.length + 1}` })
  if (filter.segments.length > 0) add({ field: 'guest.segment', op: 'any_of', value: [...filter.segments] })
  if (filter.activitySlugs.length > 0) add({ field: 'guest.bookedActivity', op: 'any_of', value: [...filter.activitySlugs] })
  if (filter.lastTrip) add({ field: 'guest.daysSinceLastTrip', op: filter.lastTrip.op === 'within' ? 'at_most' : 'at_least', value: filter.lastTrip.days })
  if (filter.minBookings) add({ field: 'guest.bookings', op: 'at_least', value: filter.minBookings })
  // Contacts keep spend in major units; rules use cents like the rest of flows.
  if (filter.minSpend) add({ field: 'guest.spend', op: 'at_least', value: Math.round(filter.minSpend * 100) })
  if (filter.countries.length > 0) add({ field: 'guest.country', op: 'any_of', value: [...filter.countries] })
  if (filter.tags.length > 0) add({ field: 'guest.tags', op: 'any_of', value: [...filter.tags] })
  return { match: 'all', conditions }
}

export const CONSENT_LABEL: Record<AudienceFilter['consent'], string> = { either: 'Email or text', email: 'Email only', sms: 'Text only' }

/** A plain-English line for the rules, for lists and previews. Money shows in `currency` when given. */
export function describeFilter(filter: AudienceFilter, activityName: (slug: string) => string, currency?: CurrencyCode): string {
  const parts: string[] = []
  if (filter.segments.length > 0) parts.push(filter.segments.map((segment) => SEGMENT_LABEL[segment]).join(' or '))
  if (filter.activitySlugs.length > 0) parts.push(`booked ${filter.activitySlugs.map(activityName).join(' or ')}`)
  if (filter.lastTrip) parts.push(filter.lastTrip.op === 'within' ? `last trip in the past ${filter.lastTrip.days} days` : `no trip in ${filter.lastTrip.days} days`)
  if (filter.minBookings) parts.push(`${filter.minBookings}+ bookings`)
  if (filter.minSpend) parts.push(`spent ${currency ? formatCurrency(filter.minSpend * 100, currency) : filter.minSpend}+`)
  if (filter.countries.length > 0) parts.push(`from ${filter.countries.join(', ')}`)
  if (filter.tags.length > 0) parts.push(`tagged ${filter.tags.join(', ')}`)
  if (filter.consent !== 'either') parts.push(filter.consent === 'email' ? 'email subscribers' : 'text subscribers')
  return parts.length > 0 ? parts.join(' · ') : 'Every subscribed guest'
}

/**
 * The audience's rules in one plain sentence: "They’ve booked 2 times and
 * they live in Australia". Rule-builder audiences read their rules; older
 * ones their filter. Consent is left to the caller to show.
 */
export function describeAudienceRules(target: AudienceTarget, lookups: { activities?: { slug: string; name: string }[]; currency?: CurrencyCode } = {}): string {
  const rules = rulesOf(target)
  if (rules) return describeGroup(rules, lookups, 'Every subscribed guest')
  const filter = filterOf(target)
  const activityName = (slug: string) => lookups.activities?.find((activity) => activity.slug === slug)?.name ?? slug
  return describeFilter({ ...filter, consent: 'either' }, activityName, lookups.currency)
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

/** The days a code works for when it goes out at `fromIso`: from that day, for `validDays` days. */
export function offerWindow(offer: Pick<MarketingOffer, 'validDays'>, fromIso: string): { startsOn: string; endsOn: string } {
  const start = new Date(fromIso)
  const end = new Date(start)
  end.setDate(end.getDate() + Math.max(1, Math.round(offer.validDays)) - 1)
  return { startsOn: dayKey(start), endsOn: dayKey(end) }
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

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
  /** A second subject line: half the list gets each, and bookings decide which one did better. */
  abTest: { enabled: boolean; subjectB: string }
  /** The designed email. Without one, the body goes as a simple letter. */
  design?: EmailDesign
  /**
   * draft and scheduled are stored as such. A scheduled campaign whose time has
   * passed is read back as sent (useMarketing derives it), unless marketing is paused.
   */
  status: CampaignStatus
  sendAt?: string
  sentAt?: string
  stats?: CampaignStats
  createdAt: string
}

/** The personal details a campaign can carry, shown by label; the token goes into the text behind the scenes. */
export const CAMPAIGN_DETAILS: { token: string; label: string; sample: string; needsOffer?: boolean }[] = [
  { token: '{first_name}', label: 'First name', sample: 'Maya' },
  { token: '{business}', label: 'Business name', sample: 'your business name' },
  { token: '{book_link}', label: 'Booking page link', sample: 'a link to your booking page' },
  { token: '{offer_code}', label: 'Discount code', sample: 'SPRING15', needsOffer: true },
  { token: '{offer_percent}', label: 'Discount %', sample: '15%', needsOffer: true },
]

/** The note on a campaign's code in Promo codes; it is how the campaign knows the code is its own. */
export function campaignPromoNote(campaign: Pick<Campaign, 'name'>): string {
  return `From the “${campaign.name}” campaign`
}

/** The tokens alone, for older callers. */
export const CAMPAIGN_PLACEHOLDERS = CAMPAIGN_DETAILS.map((detail) => detail.token)

/** Older campaigns wrote the booking link as {link}; today it is {book_link}, the same token the designer and automations use. */
export function normalizeCampaignTokens(text: string): string {
  return text.replace(/\{link\}/g, '{book_link}')
}

/** "Hi {first_name}" → "Hi [First name]", for the text boxes. Unknown tokens stay as typed. */
export function campaignTextForDisplay(text: string): string {
  return normalizeCampaignTokens(text).replace(/\{([a-z_]+)\}/g, (match) => {
    const detail = CAMPAIGN_DETAILS.find((entry) => entry.token === match)
    return detail ? `[${detail.label}]` : match
  })
}

/** The other way: "[First name]" typed or inserted in a text box becomes {first_name} again. */
export function campaignTextFromDisplay(text: string): string {
  return text.replace(/\[([^\]\n]{2,30})\]/g, (match, label: string) => {
    const detail = CAMPAIGN_DETAILS.find((entry) => entry.label.toLowerCase() === label.trim().toLowerCase())
    return detail ? detail.token : match
  })
}

/** Tokens a text uses that a campaign cannot fill (a typo, or a booking detail). */
export function unknownCampaignTokens(text: string): string[] {
  const known = new Set(CAMPAIGN_DETAILS.map((detail) => detail.token))
  return [...new Set([...normalizeCampaignTokens(text).matchAll(/\{([a-z_]+)\}/g)].map((match) => match[0]))].filter((token) => !known.has(token))
}

/* ---------- before it goes: who actually gets it ---------- */

/** A campaign sent earlier, by who it reached, for the weekly limit. */
export interface EarlierSend {
  sentAt: string
  /** Ids of the guests it went to. */
  to: Set<string>
}

export interface SendBreakdown {
  /** Everyone the audience matches. */
  inAudience: number
  /** Matched, but never said yes to this channel. */
  noConsent: number
  /** Booked on a trip starting within the skip window (Settings → Skip guests with a trip coming up). */
  tripSoon: number
  /** Already had the weekly limit of marketing messages from campaigns. */
  weeklyLimit: number
  /** Who it goes to. */
  recipients: number
  members: MarketingContact[]
}

/**
 * The pre-send count, following the marketing rules in order: consent for the
 * channel, a trip coming up, then the weekly limit. Each guest is counted
 * under the first rule that holds them back.
 */
export function campaignBreakdown({
  audienceMembers,
  channel,
  sendAt,
  settings,
  earlier,
}: {
  audienceMembers: MarketingContact[]
  channel: Campaign['channel']
  sendAt: string
  settings: Pick<MarketingSettings, 'frequencyCap' | 'skipUpcoming'>
  earlier: EarlierSend[]
}): SendBreakdown {
  const at = new Date(sendAt).getTime()
  const weekAgo = at - 7 * 86_400_000
  const recent = earlier.filter((send) => {
    const sent = new Date(send.sentAt).getTime()
    return sent >= weekAgo && sent < at
  })
  const tripWindow = settings.skipUpcoming.days * 86_400_000
  let noConsent = 0
  let tripSoon = 0
  let weeklyLimit = 0
  const members: MarketingContact[] = []
  for (const contact of audienceMembers) {
    if (channel === 'email' ? !contact.emailOptIn : !contact.smsOptIn) {
      noConsent += 1
      continue
    }
    if (settings.skipUpcoming.enabled && contact.nextTripAt) {
      const trip = new Date(contact.nextTripAt).getTime()
      if (trip >= at && trip - at <= tripWindow) {
        tripSoon += 1
        continue
      }
    }
    if (settings.frequencyCap.enabled && recent.length >= settings.frequencyCap.perWeek) {
      const had = recent.reduce((count, send) => count + (send.to.has(contact.id) ? 1 : 0), 0)
      if (had >= settings.frequencyCap.perWeek) {
        weeklyLimit += 1
        continue
      }
    }
    members.push(contact)
  }
  return { inAudience: audienceMembers.length, noConsent, tripSoon, weeklyLimit, recipients: members.length, members }
}

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
   Rules every marketing message follows
   -------------------------------------------------------------------------- */

export interface MarketingSettings {
  /** Stops every marketing email and text. Booking messages still go. */
  paused: boolean
  /**
   * Kept for businesses that set it here before. The sender now lives in
   * Settings → Domains & numbers; read it with marketingSender().
   */
  senderName: string
  /** As senderName. */
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

/**
 * Who marketing comes from. One place: Domains & numbers. A name or reply-to
 * typed on the old marketing Settings card still counts while Domains &
 * numbers is left on the business's defaults, so nothing changes under anyone.
 */
export function marketingSender(
  settings: Pick<MarketingSettings, 'senderName' | 'replyTo'>,
  channel: Pick<EmailSetup, 'senderName' | 'replyTo'>,
  defaults: { name: string; email: string },
): { name: string; replyTo: string; legacy: { name: boolean; replyTo: boolean } } {
  const legacyName = channel.senderName === defaults.name && Boolean(settings.senderName.trim()) && settings.senderName !== defaults.name
  const legacyReply = channel.replyTo === defaults.email && Boolean(settings.replyTo.trim()) && settings.replyTo !== defaults.email
  return {
    name: legacyName ? settings.senderName : channel.senderName || defaults.name,
    replyTo: legacyReply ? settings.replyTo : channel.replyTo || defaults.email,
    legacy: { name: legacyName, replyTo: legacyReply },
  }
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * When a marketing message sent at `at` really goes under quiet hours: null if
 * it is outside them, or the moment they end (the same or the next day).
 */
export function quietHoursRelease(at: Date, quiet: MarketingSettings['quietHours']): Date | null {
  if (!quiet.enabled || quiet.from === quiet.to) return null
  const from = minutesOf(quiet.from)
  const to = minutesOf(quiet.to)
  const now = at.getHours() * 60 + at.getMinutes()
  const inside = from < to ? now >= from && now < to : now >= from || now < to
  if (!inside) return null
  const release = new Date(at)
  release.setHours(Math.floor(to / 60), to % 60, 0, 0)
  if (release.getTime() <= at.getTime()) release.setDate(release.getDate() + 1)
  return release
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
  review_thanks: 0.012,
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

/**
 * An estimate of how the two subject lines did: each side's opens worked out
 * on its own, so either can come out ahead. Labelled as an estimate on screen.
 */
export function abTestEstimate(id: string, stats: CampaignStats): { a: number; b: number; winner: 'a' | 'b' | 'tie' } {
  const half = Math.max(1, stats.delivered / 2)
  const a = Math.round(half * (0.32 + steady(`${id}:subject-a`) * 0.24))
  const b = Math.round(half * (0.32 + steady(`${id}:subject-b`) * 0.24))
  const rateA = a / half
  const rateB = b / half
  return { a: rateA, b: rateB, winner: Math.abs(rateA - rateB) < 0.01 ? 'tie' : rateA > rateB ? 'a' : 'b' }
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

/**
 * The promo list with this offer's code added or brought up to date.
 *
 * `from`: when the message goes. The code then starts that day and stops
 * after `validDays` (a scheduled campaign's code does not work early). Leave
 * it out for codes that run on, like the sign-up pop-up's.
 *
 * A code another source owns (its note differs) is never taken over: the
 * list comes back unchanged. `formerNote` is this source's note before a
 * rename. Limits the owner set in Promo codes (activities, a minimum, a fixed
 * amount) stay.
 */
export function upsertOfferPromo(
  promos: PromoCode[],
  offer: MarketingOffer,
  note: string,
  activitySlugs: string[] = [],
  from?: string,
  formerNote?: string,
): PromoCode[] {
  const code = cleanCode(offer.code)
  if (!offer.enabled || !code) return promos
  const existing = promos.find((promo) => promo.code === code)
  if (existing && existing.note !== note && (formerNote === undefined || existing.note !== formerNote)) return promos
  const window = from ? offerWindow(offer, from) : null
  const percent = Math.min(100, Math.max(1, Math.round(offer.percent)))
  const next: PromoCode = {
    code,
    kind: existing?.kind ?? 'percent',
    value: existing && existing.kind !== 'percent' ? existing.value : percent,
    activitySlugs: activitySlugs.length > 0 ? activitySlugs : (existing?.activitySlugs ?? []),
    minSubtotal: existing?.minSubtotal ?? 0,
    startsOn: window ? window.startsOn : existing?.startsOn,
    endsOn: window ? window.endsOn : existing?.endsOn,
    maxUses: existing?.maxUses ?? 100000,
    used: existing?.used ?? 0,
    active: true,
    note,
  }
  return existing ? promos.map((promo) => (promo.code === code ? next : promo)) : [next, ...promos]
}

/**
 * Switch off a code this source made, once it moves to a new code or stops
 * offering one, so old codes don't linger at checkout. Codes another source
 * owns are left alone. The row stays in Promo codes with its uses.
 */
export function retireOfferPromo(promos: PromoCode[], code: string, note: string): PromoCode[] {
  const clean = cleanCode(code)
  if (!clean) return promos
  return promos.map((promo) => (promo.code === clean && promo.note === note ? { ...promo, active: false } : promo))
}

/** Another source already owns this code; saving would change its discount. */
export function offerCodeClash(promos: PromoCode[], code: string, note: string): PromoCode | undefined {
  const clean = cleanCode(code)
  return clean ? promos.find((promo) => promo.code === clean && promo.note !== note) : undefined
}
