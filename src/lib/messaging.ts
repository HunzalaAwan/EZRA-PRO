import type { Activity, Booking, Customer, Departure } from '@/types'

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

export interface MessageTemplate {
  key: TemplateKey
  name: string
  /** One line for the list. */
  purpose: string
  channel: MessageChannel
  subject: string
  body: string
  /** When it goes: at booking, N hours before the start, N hours after the end, or when staff trigger it. */
  timing: { when: 'on_booking' | 'before' | 'after' | 'manual'; hours: number }
  enabled: boolean
}

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
]

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
}

export function renderTemplate(text: string, context: Partial<MessageContext>): string {
  return text.replace(/\{([a-z_]+)\}/g, (match, key: keyof MessageContext) => context[key] ?? match)
}

export function timingLabel(timing: MessageTemplate['timing']): string {
  if (timing.when === 'on_booking') return 'At booking'
  if (timing.when === 'manual') return 'Sent by staff'
  const span = timing.hours >= 48 && timing.hours % 24 === 0 ? `${timing.hours / 24} days` : `${timing.hours} ${timing.hours === 1 ? 'hour' : 'hours'}`
  return timing.when === 'before' ? `${span} before the start` : `${span} after the end`
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
    if (!template.enabled || template.timing.when === 'manual' || template.key === 'cart_recovery') continue
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
        preview: renderTemplate(channel === 'email' ? template.subject : template.body, context).slice(0, 140),
      })
      seq += 1
    }
  }
  return out.sort((a, b) => (a.sentAt < b.sentAt ? -1 : 1))
}
