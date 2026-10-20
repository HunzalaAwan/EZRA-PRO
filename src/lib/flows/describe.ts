import type { CurrencyCode } from '@/types'
import { formatCurrency } from '@/lib/utils'
import {
  ACTIVITY_KIND_LOWER,
  ASSIGNEE_LABEL,
  STATIC_OPTIONS,
  WAIT_EVENT_LABEL,
  WEATHER_OPTIONS,
  WEEKDAY_NAMES,
  canWaitUntilStart,
  humanizeTokens,
  knowsBooking,
} from './catalog'
import type { BranchStep, Condition, ConditionGroup, Duration, Flow, FlowStep, FlowTrigger, WaitStep } from './types'

/* ==========================================================================
   Describe — every automation, step and rule as a plain sentence an owner
   can read at a glance: "When a guest books Sunset Cruise, wait until 2
   days before the start, then send the email “Your trip is coming up”."
   No tokens, no field names: details show as their labels, activities and
   audiences by their names, money in the business's currency.
   ========================================================================== */

export interface DescribeLookups {
  activities?: { slug: string; name: string }[]
  audiences?: { id: string; name: string }[]
  locations?: { id: string; name: string }[]
  currency?: CurrencyCode
}

export interface StepDescription {
  title: string
  detail: string
}

/* ---------- small words ---------- */

const UNIT_WORD: Record<Duration['unit'], [string, string]> = {
  minutes: ['minute', 'minutes'],
  hours: ['hour', 'hours'],
  days: ['day', 'days'],
}

/** "2 days", "1 hour", "30 minutes". */
export function durationLabel(d: Duration | undefined): string {
  if (!d) return '0 minutes'
  const amount = Number.isFinite(d.amount) ? d.amount : 0
  const [one, many] = UNIT_WORD[d.unit] ?? UNIT_WORD.days
  return `${amount} ${amount === 1 ? one : many}`
}

/** "09:00" → "9:00 AM". */
export function timeLabel(hhmm: string | undefined): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? '')
  if (!match) return 'a set time'
  const hours = Number(match[1])
  if (hours > 23 || Number(match[2]) > 59) return 'a set time'
  const suffix = hours >= 12 ? 'PM' : 'AM'
  const twelve = hours % 12 === 0 ? 12 : hours % 12
  return `${twelve}:${match[2]} ${suffix}`
}

/** "on a weekday", "at the weekend", "on a Monday", "on Monday, Wednesday or Friday". Empty when any day goes. */
export function weekdaysLabel(days: number[] | undefined): string {
  const set = [...new Set((days ?? []).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b)
  if (set.length === 0 || set.length === 7) return ''
  if (set.join() === '1,2,3,4,5') return 'on a weekday'
  if (set.join() === '0,6') return 'at the weekend'
  if (set.length === 1) return `on a ${WEEKDAY_NAMES[set[0]]}`
  return `on ${joinWords(set.map((day) => WEEKDAY_NAMES[day]), 'or')}`
}

/** "a", "a or b", "a, b or c", "a, b, c or 2 more". */
export function joinWords(words: string[], conj: 'and' | 'or' = 'or'): string {
  const list = words.filter(Boolean)
  if (list.length === 0) return ''
  if (list.length === 1) return list[0]
  if (list.length > 4) return `${list.slice(0, 3).join(', ')} ${conj} ${list.length - 3} more`
  return `${list.slice(0, -1).join(', ')} ${conj} ${list[list.length - 1]}`
}

const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text)
const lowerFirst = (text: string) => (text && !/^[A-Z]{2}/.test(text) ? text[0].toLowerCase() + text.slice(1) : text)

/** Shorten for a card line, at a word where possible. */
function short(text: string, max = 56): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:]$/, '')}…`
}

const quote = (text: string) => `“${text}”`

/* ---------- triggers ---------- */

const JOIN_SOURCE_PHRASE: Record<NonNullable<FlowTrigger['sources']>[number], string> = {
  popup: 'the pop-up on your website',
  footer: 'the form in your website footer',
  checkout: 'checkout',
  walk_in: 'the desk',
}

function ratingPhrase(ratings: number[] | undefined): string {
  const set = [...new Set((ratings ?? []).filter((r) => r >= 1 && r <= 5))].sort((a, b) => a - b)
  if (set.length === 0 || set.length === 5) return ''
  if (set.length === 1) return `${set[0]} star`
  const contiguous = set.every((r, i) => i === 0 || r === set[i - 1] + 1)
  if (contiguous && set.length > 2) return `${set[0]} to ${set[set.length - 1]} star`
  return `${joinWords(set.map(String), 'or')} star`
}

/** The moment it starts, as a sentence: "2 days before the start", "A guest hasn’t booked for 120 days". */
export function describeTrigger(trigger: FlowTrigger, lookups: DescribeLookups = {}): string {
  void lookups
  return triggerText(trigger, '')
}

function triggerText(trigger: FlowTrigger, activity: string): string {
  const d = trigger.offset
  const none = !d || d.amount <= 0
  const span = durationLabel(d)
  const of = activity ? ` (${activity})` : ''
  switch (trigger.type) {
    case 'booking_made':
      return activity ? `A guest books ${activity}` : 'A guest books'
    case 'booking_changed':
      return `A booking is changed${of}`
    case 'booking_cancelled':
      return `A booking is cancelled${of}`
    case 'before_start':
      if (activity) return none ? `${activity} starts` : `${span} before ${activity} starts`
      return none ? 'A booking starts' : `${span} before the start`
    case 'after_end':
      if (activity) return none ? `${activity} ends` : `${span} after ${activity} ends`
      return none ? 'A booking ends' : `${span} after it ends`
    case 'checked_in':
      return `A guest checks in${of}`
    case 'no_show':
      return `A guest doesn’t show up${of}`
    case 'balance_due':
      return none ? `A balance is still owed at the start${of}` : `A balance is still owed ${span} before the start${of}`
    case 'payment_failed':
      return `A payment fails${of}`
    case 'joined_list': {
      const sources = (trigger.sources ?? []).map((source) => JOIN_SOURCE_PHRASE[source])
      return sources.length > 0 && sources.length < 4 ? `Someone joins your list from ${joinWords(sources, 'or')}` : 'Someone joins your list'
    }
    case 'checkout_abandoned':
      return none ? 'Someone leaves checkout without booking' : `${span} after someone leaves checkout without booking`
    case 'lapsed':
      return `A guest hasn’t booked for ${none ? 'a while' : span}`
    case 'became_vip':
      return 'A guest makes their third booking'
    case 'trip_anniversary':
      return none ? `It’s a year since a booking${of}` : `${span} before a booking’s one-year anniversary${of}`
    case 'review_left': {
      const stars = ratingPhrase(trigger.ratings)
      return `A guest leaves a ${stars ? `${stars} ` : ''}review${of}`
    }
    case 'gift_card_bought':
      return 'Someone buys a gift card'
    case 'gift_card_expiring':
      return none ? 'A gift card runs out' : `${span} before a gift card runs out`
    case 'request_received':
      return 'A guest sends a request'
    case 'low_fill': {
      const fill = Math.round(trigger.fillBelow ?? 50)
      const what = activity || 'a time slot'
      return capitalize(none ? `${what} is under ${fill}% full as it starts` : `${what} is under ${fill}% full ${span} before it starts`)
    }
    case 'weather_alert':
      return `The weather puts ${activity || 'a time slot'} at risk`
    case 'manual':
      return 'Your team adds a guest'
  }
}

/** Who a seats or weather automation goes to: "It goes to past guests of that activity." Empty for other triggers. */
export function describeReach(trigger: FlowTrigger, lookups: DescribeLookups = {}): string {
  if (trigger.type !== 'low_fill' && trigger.type !== 'weather_alert') return ''
  switch (trigger.reach) {
    case 'audience': {
      const name = lookups.audiences?.find((audience) => audience.id === trigger.audienceId)?.name
      return name ? `It goes to the guests in ${quote(name)}.` : 'It goes to an audience you choose.'
    }
    case 'booked_guests':
      return 'It goes to the guests booked on it.'
    case 'past_guests_of_activity':
      return 'It goes to past guests of that activity.'
    default:
      return trigger.type === 'weather_alert' ? 'It goes to the guests booked on it.' : 'It goes to past guests of that activity.'
  }
}

/* ---------- conditions ---------- */

interface Phrase {
  statement: string
  question: string
}

const SEGMENT_PHRASE: Record<string, string> = { new: 'a first-timer', returning: 'a returning guest', vip: 'a VIP', lapsed: 'a lapsed guest' }

const CHANNEL_PHRASE: Record<string, string> = {
  direct: 'your booking page',
  website_widget: 'the widget on your website',
  phone: 'the phone',
  walk_in: 'the desk',
  ota: 'an online travel site',
  reseller: 'a reseller or agent',
  concierge: 'a hotel concierge',
  google: 'Google',
}

function listOf(value: Condition['value']): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string' && value) return [value]
  return []
}

function numberOf(value: Condition['value']): number {
  if (typeof value === 'number') return value
  if (Array.isArray(value) && typeof value[0] === 'number') return value[0]
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function rangeOf(value: Condition['value']): [number, number] {
  if (Array.isArray(value) && value.length >= 2) {
    const a = Number(value[0])
    const b = Number(value[1])
    return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0]
  }
  const n = numberOf(value)
  return [n, n]
}

/** "at least 3", "between 2 and 5", "exactly 1", formatted by `format`. */
function amountText(c: Condition, format: (n: number) => string): string {
  switch (c.op) {
    case 'at_least':
      return `at least ${format(numberOf(c.value))}`
    case 'at_most':
      return `at most ${format(numberOf(c.value))}`
    case 'between': {
      const [a, b] = rangeOf(c.value)
      return `between ${format(Math.min(a, b))} and ${format(Math.max(a, b))}`
    }
    default:
      return `exactly ${format(numberOf(c.value))}`
  }
}

/** The number a phrase should agree with: "1 time" or "3 times". */
function countFor(c: Condition): number {
  return c.op === 'between' ? 2 : numberOf(c.value)
}

function phraseOf(c: Condition, lookups: DescribeLookups): Phrase {
  const currency = lookups.currency ?? 'USD'
  const money = (n: number) => formatCurrency(Math.round(n), currency)
  const plain = (n: number) => String(n)
  const negative = c.op === 'none_of' || c.op === 'no'
  const names = (labels: string[]) => joinWords(labels, 'or') || '…'
  const values = listOf(c.value)
  const activities = () => names(values.map((slug) => lookups.activities?.find((a) => a.slug === slug)?.name ?? slug))

  switch (c.field) {
    /* ----- the guest ----- */
    case 'guest.tags': {
      const tags = names(values.map(quote))
      return negative
        ? { statement: `they’re not tagged ${tags}`, question: `Are they not tagged ${tags}?` }
        : { statement: `they’re tagged ${tags}`, question: `Are they tagged ${tags}?` }
    }
    case 'guest.bookings': {
      const n = numberOf(c.value)
      if ((c.op === 'is' || c.op === 'at_most') && n <= 0) return { statement: 'they’ve never booked', question: 'Have they never booked?' }
      if (c.op === 'at_least' && n === 1) return { statement: 'they’ve booked before', question: 'Have they booked before?' }
      const times = `${amountText(c, plain)} ${countFor(c) === 1 ? 'time' : 'times'}`
      return { statement: `they’ve booked ${times}`, question: `Have they booked ${times}?` }
    }
    case 'guest.spend': {
      const amount = amountText(c, money)
      return { statement: `they’ve spent ${amount} in total`, question: `Have they spent ${amount} in total?` }
    }
    case 'guest.country': {
      const countries = names(values)
      return negative
        ? { statement: `they don’t live in ${countries}`, question: `Do they live outside ${countries}?` }
        : { statement: `they live in ${countries}`, question: `Do they live in ${countries}?` }
    }
    case 'guest.segment': {
      const kinds = names(values.map((value) => SEGMENT_PHRASE[value] ?? value))
      return negative
        ? { statement: `they’re not ${kinds}`, question: `Are they not ${kinds}?` }
        : { statement: `they’re ${kinds}`, question: `Are they ${kinds}?` }
    }
    case 'guest.daysSinceLastTrip': {
      const days = `${amountText(c, plain)} ${countFor(c) === 1 ? 'day' : 'days'} ago`
      return { statement: `their last booking was ${days}`, question: `Was their last booking ${days}?` }
    }
    case 'guest.bookedActivity': {
      const list = activities()
      return negative
        ? { statement: `they’ve never booked ${list}`, question: `Have they never booked ${list}?` }
        : { statement: `they’ve booked ${list} before`, question: `Have they booked ${list} before?` }
    }
    case 'guest.emailOptIn':
      return negative
        ? { statement: 'they haven’t agreed to marketing emails', question: 'Have they not agreed to marketing emails?' }
        : { statement: 'they agreed to marketing emails', question: 'Did they agree to marketing emails?' }
    case 'guest.smsOptIn':
      return negative
        ? { statement: 'they haven’t agreed to marketing texts', question: 'Have they not agreed to marketing texts?' }
        : { statement: 'they agreed to marketing texts', question: 'Did they agree to marketing texts?' }
    case 'guest.hasUpcomingTrip':
      return negative
        ? { statement: 'they have no booking coming up', question: 'Do they have no booking coming up?' }
        : { statement: 'they have a booking coming up', question: 'Do they have a booking coming up?' }
    case 'guest.local':
      return negative
        ? { statement: 'they don’t live locally', question: 'Are they from out of town?' }
        : { statement: 'they live locally', question: 'Do they live locally?' }

    /* ----- the booking ----- */
    case 'booking.activity': {
      const list = activities()
      return negative
        ? { statement: `the booking isn’t for ${list}`, question: `Is the booking for something other than ${list}?` }
        : { statement: `the booking is for ${list}`, question: `Is the booking for ${list}?` }
    }
    case 'booking.kind': {
      const kinds = names(values.map((kind) => ACTIVITY_KIND_LOWER[kind] ?? kind))
      return negative
        ? { statement: `it’s not ${kinds}`, question: `Is it something other than ${kinds}?` }
        : { statement: `it’s ${kinds}`, question: `Is it ${kinds}?` }
    }
    case 'booking.partySize': {
      const size = amountText(c, plain)
      return { statement: `group size is ${size}`, question: `Is the group size ${size}?` }
    }
    case 'booking.total': {
      const amount = amountText(c, money)
      return { statement: `the booking total is ${amount}`, question: `Is the booking total ${amount}?` }
    }
    case 'booking.channel': {
      const where = names(values.map((channel) => CHANNEL_PHRASE[channel] ?? channel))
      return negative
        ? { statement: `it wasn’t booked through ${where}`, question: `Was it booked somewhere other than ${where}?` }
        : { statement: `it was booked through ${where}`, question: `Was it booked through ${where}?` }
    }
    case 'booking.balanceDue': {
      const n = numberOf(c.value)
      if (c.op === 'at_least' && n <= 1) return { statement: 'they haven’t paid in full', question: 'Do they still owe money?' }
      if (c.op === 'at_most' && n <= 0) return { statement: 'they’ve paid in full', question: 'Have they paid in full?' }
      const amount = amountText(c, money)
      return { statement: `the balance owed is ${amount}`, question: `Is the balance owed ${amount}?` }
    }
    case 'booking.hasAddOn': {
      const extras = names(values.map(quote))
      return negative
        ? { statement: `they didn’t add ${extras}`, question: `Did they skip ${extras}?` }
        : { statement: `they added ${extras}`, question: `Did they add ${extras}?` }
    }
    case 'booking.usedCode':
      return negative
        ? { statement: 'they used no code', question: 'Did they book without a code?' }
        : { statement: 'they used a code', question: 'Did they use a code?' }
    case 'booking.hasChildren':
      return negative
        ? { statement: 'there are no children in the group', question: 'Is it adults only?' }
        : { statement: 'there are children in the group', question: 'Are there children in the group?' }
    case 'booking.waiversMissing':
      return negative
        ? { statement: 'every waiver is signed', question: 'Is every waiver signed?' }
        : { statement: 'waivers are still unsigned', question: 'Are waivers still unsigned?' }
    case 'booking.daysUntilStart': {
      const days = `${amountText(c, plain)} ${countFor(c) === 1 ? 'day' : 'days'} away`
      return { statement: `the start is ${days}`, question: `Is the start ${days}?` }
    }
    case 'booking.location': {
      const where = names(values.map((id) => lookups.locations?.find((site) => site.id === id)?.name ?? id))
      return negative
        ? { statement: `it doesn’t run from ${where}`, question: `Does it run from somewhere other than ${where}?` }
        : { statement: `it runs from ${where}`, question: `Does it run from ${where}?` }
    }
    case 'booking.rating': {
      const stars = `${amountText(c, plain)} ${countFor(c) === 1 ? 'star' : 'stars'}`
      return { statement: `they gave ${stars}`, question: `Did they give ${stars}?` }
    }
    case 'booking.firstBooking':
      return negative
        ? { statement: 'they’ve booked before', question: 'Have they booked before?' }
        : { statement: 'it’s their first booking', question: 'Is this their first booking?' }

    /* ----- the departure ----- */
    case 'departure.fill': {
      const fill = amountText(c, (n) => `${n}%`)
      return { statement: `it’s ${fill} full`, question: `Is it ${fill} full?` }
    }
    case 'departure.weather': {
      const forecast = names(values.map((value) => (WEATHER_OPTIONS.find((option) => option.value === value)?.label ?? value).toLowerCase()))
      return negative
        ? { statement: `the forecast isn’t ${forecast}`, question: `Is the forecast anything but ${forecast}?` }
        : { statement: `the forecast is ${forecast}`, question: `Is the forecast ${forecast}?` }
    }

    /* ----- what they did in this automation ----- */
    case 'flow.opened':
      return negative
        ? { statement: 'they haven’t opened a message', question: 'Still not opened?' }
        : { statement: 'they opened a message', question: 'Did they open it?' }
    case 'flow.clicked':
      return negative
        ? { statement: 'they haven’t clicked a link', question: 'Still no click?' }
        : { statement: 'they clicked a link', question: 'Did they click a link?' }
    case 'flow.booked':
      return negative
        ? { statement: 'they haven’t booked', question: 'Still not booked?' }
        : { statement: 'they booked', question: 'Did they book?' }
    case 'flow.replied':
      return negative
        ? { statement: 'they haven’t replied', question: 'Still no reply?' }
        : { statement: 'they replied', question: 'Did they reply?' }
  }
}

/** One rule as a sentence: "Group size is at least 6". */
export function describeCondition(c: Condition, lookups: DescribeLookups = {}): string {
  return capitalize(phraseOf(c, lookups).statement)
}

/** A rule as a yes-or-no question: "Did they book?". */
export function conditionQuestion(c: Condition, lookups: DescribeLookups = {}): string {
  return phraseOf(c, lookups).question
}

/** Rules joined into one sentence: "Group size is at least 6 and they used no code". */
export function describeGroup(group: ConditionGroup, lookups: DescribeLookups = {}, empty = 'Everyone'): string {
  return capitalize(groupClause(group, lookups)) || empty
}

function groupClause(group: ConditionGroup, lookups: DescribeLookups): string {
  const parts = group.conditions.map((c) => phraseOf(c, lookups).statement)
  return joinWords(parts, group.match === 'any' ? 'or' : 'and')
}

/** Who can enter, in words. Marketing adds the consent it needs. */
export function describeWho(flow: Pick<Flow, 'who' | 'purpose'>, lookups: DescribeLookups = {}): string {
  const base = flow.who.conditions.length > 0 ? describeGroup(flow.who, lookups) : 'Everyone it applies to'
  return flow.purpose === 'marketing' ? `${base}, if they agreed to hear from you` : base
}

/* ---------- waits and steps ---------- */

/** "Wait 2 days", "Wait until 9:00 AM on a weekday", "Wait until 1 day before the start", "Wait up to 3 days for them to book". */
export function describeWait(step: WaitStep): string {
  switch (step.mode) {
    case 'for':
      return `Wait ${durationLabel(step.duration)}`
    case 'until_time': {
      const days = weekdaysLabel(step.days)
      return `Wait until ${timeLabel(step.time)}${days ? ` ${days}` : ''}`
    }
    case 'until_before_start':
      return !step.duration || step.duration.amount <= 0 ? 'Wait until the start' : `Wait until ${durationLabel(step.duration)} before the start`
    case 'until_event': {
      const verb = WAIT_EVENT_LABEL[step.event ?? 'booked']
      return step.timeout && step.timeout.amount > 0 ? `Wait up to ${durationLabel(step.timeout)} for them ${verb}` : `Wait for them ${verb}`
    }
  }
}

/** The question a branch asks: its own label, or one made from what it checks. */
export function branchQuestion(step: BranchStep, lookups: DescribeLookups = {}): string {
  const label = step.label?.trim()
  if (label) return label
  const conditions = step.when.conditions
  if (conditions.length === 0) return 'Nothing to check yet'
  if (conditions.length === 1) return conditionQuestion(conditions[0], lookups)
  return `${describeGroup(step.when, lookups)}?`
}

function stepCount(n: number) {
  return `${n} ${n === 1 ? 'step' : 'steps'}`
}

/** A card's title and its one-line detail. */
export function describeStep(step: FlowStep, lookups: DescribeLookups = {}): StepDescription {
  switch (step.type) {
    case 'email': {
      const subject = humanizeTokens(step.subject).trim()
      const b = step.subjectB ? humanizeTokens(step.subjectB).trim() : ''
      if (!subject) return { title: 'Send an email', detail: 'No subject line yet' }
      return { title: 'Send an email', detail: b ? `${quote(short(subject, 40))} or ${quote(short(b, 40))}, half each` : quote(short(subject, 72)) }
    }
    case 'sms': {
      const body = humanizeTokens(step.body).trim()
      return { title: 'Send a text', detail: body ? quote(short(body, 72)) : 'Nothing written yet' }
    }
    case 'wait': {
      const title = describeWait(step)
      if (step.mode === 'until_event') {
        const verb = WAIT_EVENT_LABEL[step.event ?? 'booked'].replace(/^to /, '')
        const limit = step.timeout && step.timeout.amount > 0 ? `, or after ${durationLabel(step.timeout)} if they don’t` : ''
        return { title, detail: `Moves on as soon as they ${verb}${limit}` }
      }
      if (step.mode === 'until_before_start') return { title, detail: 'Moves straight on if that time has already passed' }
      if (step.mode === 'until_time') return { title, detail: 'Lands at a good time to read it' }
      return { title, detail: 'Then the next step runs' }
    }
    case 'branch': {
      const title = branchQuestion(step, lookups)
      if (step.when.conditions.length === 0) return { title, detail: 'Add something to check' }
      const paths = `${stepCount(step.yes.length)} if yes, ${stepCount(step.no.length)} if no`
      return { title, detail: step.label?.trim() ? `Yes when ${groupClause(step.when, lookups)} · ${paths}` : capitalize(paths) }
    }
    case 'split': {
      const a = clampPercent(step.percentA)
      return { title: 'A/B test', detail: `${a}% take path A, ${100 - a}% take path B` }
    }
    case 'action':
      return describeAction(step)
    case 'end':
      return { title: 'End here', detail: 'They leave the automation at this point' }
  }
}

function clampPercent(value: number): number {
  return Math.min(99, Math.max(1, Math.round(Number.isFinite(value) ? value : 50)))
}

function describeAction(step: Extract<FlowStep, { type: 'action' }>): StepDescription {
  const tag = step.tag?.trim()
  const message = step.message ? short(humanizeTokens(step.message), 60) : ''
  const who = ASSIGNEE_LABEL[step.assignee ?? 'managers']
  switch (step.action) {
    case 'add_tag':
      return tag ? { title: `Add the tag ${quote(tag)}`, detail: 'Shows on their guest record' } : { title: 'Add a tag', detail: 'Choose a tag' }
    case 'remove_tag':
      return tag ? { title: `Remove the tag ${quote(tag)}`, detail: 'Taken off their guest record' } : { title: 'Remove a tag', detail: 'Choose a tag' }
    case 'give_code': {
      const code = step.code
      if (!code || !(code.percent > 0)) return { title: 'Give a discount code', detail: 'Choose how much it takes off' }
      const prefix = code.prefix?.trim() ? `, starting ${code.prefix.trim().toUpperCase()}` : ''
      return { title: `Give a ${code.percent}% discount code`, detail: `Their own code, good for ${code.validDays} ${code.validDays === 1 ? 'day' : 'days'}${prefix}` }
    }
    case 'notify_team':
      return { title: 'Tell your team', detail: message ? `To ${who}: ${quote(message)}` : `To ${who}` }
    case 'create_task': {
      const due = step.due && step.due.amount > 0 ? `, due within ${durationLabel(step.due)}` : ''
      return { title: 'Add a to-do', detail: message ? `For ${who}${due}: ${quote(message)}` : `For ${who}${due}` }
    }
    case 'add_note':
      return { title: 'Add a note to the guest', detail: message ? quote(message) : 'Nothing written yet' }
    case 'unsubscribe':
      return { title: 'Stop marketing to them', detail: 'No more marketing emails or texts. Booking messages still go' }
  }
}

/* ---------- the whole flow ---------- */

/** One step as a clause in the summary: "send the email “…”", "wait 2 days". */
function stepClause(step: FlowStep, lookups: DescribeLookups): string {
  switch (step.type) {
    case 'email': {
      const subject = humanizeTokens(step.subject).trim()
      return subject ? `send the email ${quote(short(subject, 48))}` : 'send an email'
    }
    case 'sms':
      return 'send a text'
    case 'wait':
      return lowerFirst(describeWait(step))
    case 'branch':
      return branchClause(step, lookups)
    case 'split': {
      const a = clampPercent(step.percentA)
      return `split guests ${a}/${100 - a} (A: ${pathClause(step.a, lookups) || 'nothing more'}; B: ${pathClause(step.b, lookups) || 'nothing more'})`
    }
    case 'action':
      switch (step.action) {
        case 'add_tag':
          return step.tag?.trim() ? `tag them ${quote(step.tag.trim())}` : 'add a tag'
        case 'remove_tag':
          return step.tag?.trim() ? `remove the tag ${quote(step.tag.trim())}` : 'remove a tag'
        case 'give_code':
          return step.code && step.code.percent > 0 ? `give them their own ${step.code.percent}% code` : 'give them a discount code'
        case 'notify_team':
          return 'tell your team'
        case 'create_task':
          return `add a to-do for ${ASSIGNEE_LABEL[step.assignee ?? 'owner']}`
        case 'add_note':
          return 'add a note to their record'
        case 'unsubscribe':
          return 'stop marketing to them'
      }
    case 'end':
      return 'stop there'
  }
}

/** A list of steps as one run of clauses, stopping at "End here". */
function pathClause(steps: FlowStep[], lookups: DescribeLookups): string {
  const clauses: string[] = []
  for (const step of steps) {
    clauses.push(stepClause(step, lookups))
    if (step.type === 'end') break
  }
  return clauses.filter(Boolean).join(', then ')
}

function branchClause(step: BranchStep, lookups: DescribeLookups): string {
  const yes = pathClause(step.yes, lookups)
  const no = pathClause(step.no, lookups)
  const cond = step.when.conditions.length > 0 ? groupClause(step.when, lookups) : ''
  if (!cond) return `ask ${quote(branchQuestion(step, lookups))}`
  if (yes && no) return `if ${cond}, ${yes}; if not, ${no}`
  if (yes) return `if ${cond}, ${yes}`
  if (no) return `unless ${cond}, ${no}`
  return `check whether ${cond}`
}

/** The activity filter "who" carries, pulled into the opening line: "When a guest books Sunset Cruise". */
function activityFilter(flow: Flow, lookups: DescribeLookups): { names: string; rest: ConditionGroup } {
  const none = { names: '', rest: flow.who }
  if (!knowsBooking(flow.trigger) || flow.who.match !== 'all') return none
  const index = flow.who.conditions.findIndex((c) => c.field === 'booking.activity' && c.op === 'any_of' && listOf(c.value).length > 0)
  if (index < 0) return none
  const slugs = listOf(flow.who.conditions[index].value)
  const names = joinWords(slugs.map((slug) => lookups.activities?.find((a) => a.slug === slug)?.name ?? slug), 'or')
  return { names, rest: { ...flow.who, conditions: flow.who.conditions.filter((_, i) => i !== index) } }
}

/** What ends it early, as a sentence, or empty. */
export function describeExit(flow: Pick<Flow, 'exit' | 'who' | 'trigger'>): string {
  const parts: string[] = []
  if (flow.exit.onBooked) parts.push('they make a new booking')
  // Only a booking that is still ahead can be cancelled: not after the trip, a review or a cancellation.
  if (flow.exit.onCancelled && knowsBooking(flow.trigger) && canWaitUntilStart(flow.trigger.type)) parts.push('the booking is cancelled')
  if (flow.exit.whenNoLongerMatching && flow.who.conditions.length > 0) parts.push('they no longer match who can enter')
  return parts.length > 0 ? `Stops when ${joinWords(parts, 'or')}.` : ''
}

/**
 * The plain summary at the top of the builder, as sentences:
 * "When a guest books Sunset Cruise, wait until 2 days before the start,
 * then send the email “Your trip is coming up”." · "If they haven’t paid
 * in full, send a text." · "Stops when the booking is cancelled."
 */
export function describeFlow(flow: Flow, lookups: DescribeLookups = {}): string[] {
  const { names, rest } = activityFilter(flow, lookups)
  const moment = triggerText(flow.trigger, names)
  // "2 days before the start, …" reads on its own; "A guest books" needs a "When".
  const timed = /^\d/.test(moment)
  const filter = rest.conditions.length > 0 ? groupClause(rest, lookups) : ''
  // Keep an activity's own capitals when the moment opens with its name: "When Sunset Cruise starts".
  const lead = names && moment.startsWith(names) ? moment : lowerFirst(moment)
  const opening = timed ? `${moment}${filter ? `, if ${filter}` : ''}` : `When ${lead}${filter ? ` and ${filter}` : ''}`

  const sentences: string[] = []
  let chunk: string[] = []
  let opened = false
  const flush = () => {
    if (chunk.length === 0) return
    const text = chunk.join(', then ')
    sentences.push(opened ? `Then ${text}.` : `${opening}, ${text}.`)
    opened = true
    chunk = []
  }

  for (const step of flow.steps) {
    if (step.type === 'branch' || step.type === 'split') {
      flush()
      const clause = stepClause(step, lookups)
      sentences.push(opened ? `${capitalize(clause)}.` : `${opening}, ${clause}.`)
      opened = true
      continue
    }
    chunk.push(stepClause(step, lookups))
    if (step.type === 'end') break
  }
  flush()
  if (!opened) sentences.push(`${opening}, nothing happens yet. Add a step to get started.`)

  const reach = describeReach(flow.trigger, lookups)
  if (reach) sentences.splice(1, 0, reach)
  const exit = describeExit(flow)
  if (exit) sentences.push(exit)
  return sentences
}

/** Labels for the fixed choices, for chips and lists. */
export function optionLabel(source: 'channels' | 'segments' | 'kinds', value: string): string {
  return STATIC_OPTIONS[source].find((option) => option.value === value)?.label ?? value
}
