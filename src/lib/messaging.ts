import type { Activity, Booking, Customer, Departure } from '@/types'
import { NO_OFFER, type MarketingOffer } from '@/lib/marketing'

/* ==========================================================================
   Messaging — the emails and texts a booking sends on its own: when each
   one goes, on which channel, and what it says. Browser-safe: templates are
   plain data, rendering is string replacement, and the per-booking log is
   derived from the templates and the booking's own dates.
   ========================================================================== */

export type MessageChannel = 'email' | 'sms' | 'both'

export type TemplateKey =
  | 'confirmation'
  | 'reminder'
  | 'what_to_bring'
  | 'balance_due'
  | 'weather'
  | 'review_request'
  | 'upsell'
  | 'cart_recovery'
  | 'welcome'
  | 'browse_abandon'
  | 'next_trip'
  | 'win_back'
  | 'anniversary'
  | 'referral_ask'
  | 'gift_expiry'
  | 'birthday'
  | 'waitlist'

export interface MessageTemplate {
  key: TemplateKey
  name: string
  /** One line for the list. */
  purpose: string
  channel: MessageChannel
  subject: string
  body: string
  /** When it goes. Hours count from the moment named by `when`. */
  timing: { when: TriggerWhen; hours: number }
  enabled: boolean
  /** Booking messages go with every booking; growth messages are marketing and follow the marketing rules. */
  group?: 'booking' | 'growth'
  /** Only for guests in this audience (growth). */
  audienceId?: string
  /** Only for these activities. Empty: all. */
  activitySlugs?: string[]
  /** A code carried by the message. */
  offer?: MarketingOffer
  /** A second subject line for half the guests. */
  abTest?: { enabled: boolean; subjectB: string }
  /** Growth: stop once the guest books again. */
  stopIfBooked?: boolean
}

export type TriggerWhen =
  | 'on_booking'
  | 'before'
  | 'after'
  | 'manual'
  | 'signup'
  | 'browse'
  | 'since_last'
  | 'anniversary'
  | 'review'
  | 'gift_expiry'
  | 'birthday'
  | 'waitlist'

/** The moments a message can be tied to, for the editor. */
export const TRIGGER_OPTIONS: { value: TriggerWhen; label: string; hours: 'before' | 'after' | 'none'; unit: 'hours' | 'days' }[] = [
  { value: 'on_booking', label: 'When they book', hours: 'none', unit: 'hours' },
  { value: 'before', label: 'Before the trip', hours: 'before', unit: 'hours' },
  { value: 'after', label: 'After the trip', hours: 'after', unit: 'hours' },
  { value: 'signup', label: 'After they join the list', hours: 'after', unit: 'hours' },
  { value: 'browse', label: 'After viewing without booking', hours: 'after', unit: 'hours' },
  { value: 'since_last', label: 'Days since their last trip', hours: 'after', unit: 'days' },
  { value: 'anniversary', label: 'On the trip’s anniversary', hours: 'none', unit: 'days' },
  { value: 'review', label: 'After a 4 or 5 star review', hours: 'after', unit: 'hours' },
  { value: 'gift_expiry', label: 'Before a gift card runs out', hours: 'before', unit: 'days' },
  { value: 'birthday', label: 'Before their birthday', hours: 'before', unit: 'days' },
  { value: 'waitlist', label: 'When a waitlisted seat opens', hours: 'none', unit: 'hours' },
  { value: 'manual', label: 'Only when staff send it', hours: 'none', unit: 'hours' },
]

export const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: '{first_name}', label: 'First name' },
  { token: '{activity}', label: 'Activity' },
  { token: '{date}', label: 'Date' },
  { token: '{time}', label: 'Time' },
  { token: '{meeting_point}', label: 'Meeting point' },
  { token: '{party}', label: 'Guests' },
  { token: '{reference}', label: 'Code' },
  { token: '{balance}', label: 'Balance' },
  { token: '{manage_link}', label: 'Manage link' },
  { token: '{business}', label: 'Business' },
  { token: '{offer_code}', label: 'Offer code' },
  { token: '{offer_percent}', label: 'Offer %' },
  { token: '{book_link}', label: 'Booking link' },
]

export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  {
    key: 'confirmation',
    name: 'Booking confirmation',
    purpose: 'Sent the moment a booking is paid.',
    channel: 'both',
    subject: 'You are booked: {activity} on {date}',
    body: 'Hi {first_name}, you are all set for {activity} on {date} at {time} for {party}. Meet at {meeting_point}. Your code is {reference}. Change guests, sign waivers or reschedule here: {manage_link}\n\nSee you soon,\n{business}',
    timing: { when: 'on_booking', hours: 0 },
    enabled: true,
  },
  {
    key: 'reminder',
    name: 'Day-before reminder',
    purpose: 'The meeting point and time, the day before.',
    channel: 'sms',
    subject: 'Tomorrow: {activity} at {time}',
    body: 'Hi {first_name}, see you tomorrow at {time} for {activity}. Meet at {meeting_point}. Waivers and details: {manage_link}',
    timing: { when: 'before', hours: 24 },
    enabled: true,
  },
  {
    key: 'what_to_bring',
    name: 'What to bring',
    purpose: 'Packing list and arrival tips, three days out.',
    channel: 'email',
    subject: 'Getting ready for {activity}',
    body: 'Hi {first_name}, a few things for {date}: swimwear under your clothes, reef-safe sunscreen, a towel and a dry layer for the ride home. Please arrive 20 minutes early. Anything we should know? Reply to this email.\n\n{business}',
    timing: { when: 'before', hours: 72 },
    enabled: true,
  },
  {
    key: 'balance_due',
    name: 'Balance due',
    purpose: 'For deposit bookings, when the balance is due.',
    channel: 'email',
    subject: 'Balance of {balance} for {activity}',
    body: 'Hi {first_name}, the balance of {balance} for {activity} on {date} is due now. Pay it in a few taps here: {manage_link}',
    timing: { when: 'before', hours: 48 },
    enabled: true,
  },
  {
    key: 'weather',
    name: 'Weather update',
    purpose: 'Sent from the Weather page when a trip is held, moved or cancelled.',
    channel: 'both',
    subject: 'Update on your {activity}',
    body: 'Hi {first_name}, an update on {activity} on {date}: the forecast is uncertain and we are watching it closely. We will confirm by two hours before. Your options: {manage_link}',
    timing: { when: 'manual', hours: 0 },
    enabled: true,
  },
  {
    key: 'review_request',
    name: 'Review request',
    purpose: 'A thank-you and a review link, the evening after.',
    channel: 'email',
    subject: 'How was {activity}?',
    body: 'Hi {first_name}, thank you for coming out with us today. If you have a minute, a review helps a small crew more than anything. Photos from the day are in your booking: {manage_link}\n\nMahalo,\n{business}',
    timing: { when: 'after', hours: 4 },
    enabled: true,
  },
  {
    key: 'upsell',
    name: 'Add-on offer',
    purpose: 'Photos, gear or an upgrade, a week before.',
    channel: 'email',
    subject: 'Make {activity} even better',
    body: 'Hi {first_name}, want the photos from your {activity}? Add the photo pack or a GoPro before the day and save 15%: {manage_link}',
    timing: { when: 'before', hours: 168 },
    enabled: false,
  },
  {
    key: 'cart_recovery',
    name: 'Abandoned cart',
    purpose: 'For guests who started checkout and left, one hour later.',
    channel: 'email',
    subject: 'Your seats on {activity} are still open',
    body: 'Hi {first_name}, you were a step away from booking {activity} on {date}. Seats are still open. Pick up where you left off: {manage_link}',
    timing: { when: 'after', hours: 1 },
    enabled: true,
  },
  /* ---------- growth: marketing that brings guests back ---------- */
  {
    key: 'welcome',
    group: 'growth',
    name: 'Welcome and first-trip code',
    purpose: 'Thanks new subscribers and sends the sign-up code.',
    channel: 'email',
    subject: 'Welcome to {business}: here is {offer_percent} off',
    body: 'Hi {first_name}, thanks for joining us. Here is {offer_percent} off your first trip with code {offer_code}. Pick a date: {book_link}\n\nSee you on the water,\n{business}',
    timing: { when: 'signup', hours: 0 },
    enabled: true,
    audienceId: 'aud_all',
    offer: { enabled: true, percent: 10, validDays: 30, code: 'WELCOME10' },
    stopIfBooked: true,
  },
  {
    key: 'browse_abandon',
    group: 'growth',
    name: 'Viewed but did not book',
    purpose: 'A nudge to subscribers who looked at a trip and left.',
    channel: 'email',
    subject: 'Still thinking about {activity}?',
    body: 'Hi {first_name}, {activity} still has seats this week. Questions? Just reply. Book in a minute: {book_link}',
    timing: { when: 'browse', hours: 3 },
    enabled: false,
    audienceId: 'aud_all',
    stopIfBooked: true,
  },
  {
    key: 'next_trip',
    group: 'growth',
    name: 'Next-trip offer',
    purpose: 'Two weeks after a trip, a code for the next one.',
    channel: 'email',
    subject: '{first_name}, your next trip is {offer_percent} off',
    body: 'Hi {first_name}, thanks again for coming out. Ready for the next one? Use {offer_code} for {offer_percent} off any trip in the next month: {book_link}',
    timing: { when: 'after', hours: 336 },
    enabled: true,
    audienceId: 'aud_all',
    offer: { enabled: true, percent: 15, validDays: 30, code: 'NEXTTRIP15' },
    stopIfBooked: true,
  },
  {
    key: 'win_back',
    group: 'growth',
    name: 'We miss you',
    purpose: 'Guests who have not been back in four months.',
    channel: 'email',
    subject: 'It has been a while, {first_name}',
    body: 'Hi {first_name}, it has been a while since your last trip with us. Here is {offer_percent} off to come back: {offer_code}. New this season: {book_link}',
    timing: { when: 'since_last', hours: 120 * 24 },
    enabled: true,
    audienceId: 'aud_lapsed',
    offer: { enabled: true, percent: 20, validDays: 21, code: 'COMEBACK20' },
    stopIfBooked: true,
  },
  {
    key: 'anniversary',
    group: 'growth',
    name: 'A year since your trip',
    purpose: 'On the anniversary of their trip, a memory and an invite back.',
    channel: 'email',
    subject: 'One year ago today: {activity}',
    body: 'Hi {first_name}, a year ago today you were out with us on {activity}. Fancy doing it again, or trying something new? {book_link}',
    timing: { when: 'anniversary', hours: 0 },
    enabled: false,
    audienceId: 'aud_all',
  },
  {
    key: 'referral_ask',
    group: 'growth',
    name: 'Refer a friend',
    purpose: 'After a great review, the guest’s own referral link.',
    channel: 'email',
    subject: 'Share {business} and get a trip credit',
    body: 'Hi {first_name}, thank you for the lovely review. Know someone who would love it too? Your friends get {offer_percent} off and you get credit on your next trip: {book_link}',
    timing: { when: 'review', hours: 24 },
    enabled: true,
    audienceId: 'aud_all',
  },
  {
    key: 'gift_expiry',
    group: 'growth',
    name: 'Gift card running out',
    purpose: 'Reminds the holder before a gift card expires.',
    channel: 'email',
    subject: 'Your {business} gift card runs out soon',
    body: 'Hi {first_name}, your gift card still has credit on it and runs out soon. Book a trip and use it at checkout: {book_link}',
    timing: { when: 'gift_expiry', hours: 30 * 24 },
    enabled: true,
  },
  {
    key: 'birthday',
    group: 'growth',
    name: 'Birthday treat',
    purpose: 'For guests who gave a date of birth, a week before the day.',
    channel: 'email',
    subject: 'Happy birthday from {business}',
    body: 'Hi {first_name}, happy early birthday! Celebrate with us: {offer_percent} off any trip this month with {offer_code}. {book_link}',
    timing: { when: 'birthday', hours: 7 * 24 },
    enabled: false,
    audienceId: 'aud_all',
    offer: { enabled: true, percent: 15, validDays: 30, code: 'BIRTHDAY15' },
  },
  {
    key: 'waitlist',
    group: 'growth',
    name: 'A seat opened up',
    purpose: 'Tells guests on the waitlist the moment a seat frees up.',
    channel: 'sms',
    subject: 'A seat opened on {activity}',
    body: 'Hi {first_name}, a seat just opened on {activity} on {date} at {time}. First to book gets it: {book_link}',
    timing: { when: 'waitlist', hours: 0 },
    enabled: true,
  },
]

/** The offer on a template, or none. */
export function offerOf(template: Pick<MessageTemplate, 'offer'>): MarketingOffer {
  return template.offer ?? NO_OFFER
}

export const groupOf = (template: Pick<MessageTemplate, 'group'>) => template.group ?? 'booking'

export interface MessageContext {
  first_name: string
  activity: string
  date: string
  time: string
  meeting_point: string
  party: string
  reference: string
  balance: string
  manage_link: string
  business: string
  offer_code?: string
  offer_percent?: string
  book_link?: string
}

export function renderTemplate(text: string, context: Partial<MessageContext>): string {
  return text.replace(/\{([a-z_]+)\}/g, (match, key: keyof MessageContext) => context[key] ?? match)
}

export function timingLabel(timing: MessageTemplate['timing']): string {
  const span = timing.hours >= 48 && timing.hours % 24 === 0 ? `${timing.hours / 24} days` : `${timing.hours} ${timing.hours === 1 ? 'hour' : 'hours'}`
  const soon = timing.hours === 0 ? 'Straight away' : span
  switch (timing.when) {
    case 'on_booking':
      return 'At booking'
    case 'manual':
      return 'Sent by staff'
    case 'before':
      return `${span} before the start`
    case 'after':
      return `${span} after the end`
    case 'signup':
      return timing.hours === 0 ? 'When they join the list' : `${span} after they join`
    case 'browse':
      return `${soon} after viewing a trip`
    case 'since_last':
      return `${span} after their last trip`
    case 'anniversary':
      return 'On the trip’s anniversary'
    case 'review':
      return `${soon} after a 4–5 star review`
    case 'gift_expiry':
      return `${span} before a gift card runs out`
    case 'birthday':
      return `${span} before their birthday`
    case 'waitlist':
      return 'When a seat opens'
  }
}

export const CHANNEL_LABEL: Record<MessageChannel, string> = { email: 'Email', sms: 'Text', both: 'Email and text' }

export function manageLink(tenantSlug: string, reference: string) {
  return `/book/${tenantSlug}/manage/${reference}`
}

/* --------------------------------------------------------------------------
   The log a booking would have by now: each enabled template whose moment
   has passed, sent on its channels, with plausible delivery states.
   -------------------------------------------------------------------------- */

export interface LoggedMessage {
  id: string
  key: TemplateKey
  name: string
  channel: 'email' | 'sms'
  sentAt: string
  status: 'delivered' | 'opened' | 'clicked' | 'scheduled'
  preview: string
}

const stamp = (ms: number) => {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

export function buildMessageLog({
  booking,
  activity,
  customer,
  departure,
  templates,
  nowIso,
  tenantSlug,
  business,
  currency = 'USD',
}: {
  booking: Booking
  activity: Activity
  customer: Customer
  departure: Pick<Departure, 'startsAt' | 'endsAt'>
  templates: MessageTemplate[]
  nowIso: string
  tenantSlug: string
  business: string
  currency?: string
}): LoggedMessage[] {
  const now = new Date(nowIso).getTime()
  const start = new Date(departure.startsAt).getTime()
  const end = new Date(departure.endsAt).getTime()
  const created = new Date(booking.createdAt).getTime()
  const balance = Math.max(0, booking.total - booking.amountPaid)
  const context: MessageContext = {
    first_name: customer.firstName,
    activity: activity.name,
    date: new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(departure.startsAt)),
    time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(departure.startsAt)),
    meeting_point: activity.meetingPoint.split(' — ')[0],
    party: `${booking.partySize} ${booking.partySize === 1 ? 'guest' : 'guests'}`,
    reference: booking.reference,
    balance: new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(balance / 100),
    manage_link: manageLink(tenantSlug, booking.reference),
    business,
  }
  const cancelled = booking.status === 'cancelled' || booking.status === 'refunded'
  const out: LoggedMessage[] = []
  let seq = 0
  for (const template of templates) {
    if (!template.enabled || template.key === 'cart_recovery') continue
    // Only the messages tied to this booking's own dates show on its record.
    if (template.timing.when !== 'on_booking' && template.timing.when !== 'before' && template.timing.when !== 'after') continue
    if (template.activitySlugs && template.activitySlugs.length > 0 && !template.activitySlugs.includes(activity.slug)) continue
    if (groupOf(template) === 'growth' && !customer.marketingOptIn) continue
    if (template.key === 'balance_due' && balance <= 0) continue
    if (template.key === 'review_request' && (cancelled || booking.status === 'no_show')) continue
    const at =
      template.timing.when === 'on_booking'
        ? created
        : template.timing.when === 'before'
          ? start - template.timing.hours * 3_600_000
          : end + template.timing.hours * 3_600_000
    if (template.timing.when === 'before' && at < created) continue
    if (cancelled && at > created + 60_000 && template.key !== 'confirmation') continue
    const channels: ('email' | 'sms')[] = template.channel === 'both' ? ['email', 'sms'] : [template.channel]
    for (const channel of channels) {
      const opened = (booking.reference.charCodeAt(4 + (seq % 4)) + seq) % 5
      out.push({
        id: `${booking.id}-${template.key}-${channel}`,
        key: template.key,
        name: template.name,
        channel,
        sentAt: stamp(at),
        status: at > now ? 'scheduled' : channel === 'sms' ? 'delivered' : opened === 0 ? 'clicked' : opened < 3 ? 'opened' : 'delivered',
        preview: renderTemplate(channel === 'email' ? template.subject : template.body, {
          ...context,
          offer_code: offerOf(template).code,
          offer_percent: `${offerOf(template).percent}%`,
          book_link: `/book/${tenantSlug}`,
        }).slice(0, 140),
      })
      seq += 1
    }
  }
  return out.sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1))
}
