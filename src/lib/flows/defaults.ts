import { NOW_ISO } from '@/lib/data/constants'
import { cleanCode, type Audience } from '@/lib/marketing'
import { DEFAULT_TEMPLATES, rulesOf, type AutomationStep, type MessageTemplate, type TriggerWhen } from '@/lib/messaging'

import { blankFlow } from './catalog'
import type { Condition, ConditionField, ConditionGroup, ConditionOp, Duration, Flow, FlowGoal, FlowStep, FlowTrigger, WaitStep } from './types'

/* ==========================================================================
   Built-in flows — the automations every business starts with, carried over
   from the growth messages (same names, wording and codes), and the bridge
   that turns a business's own older automations into flows.

   Everything here is deterministic: ids come from the template key, so the
   server render, the browser and the simulator all agree on step ids before
   anything is saved.
   ========================================================================== */

/** The growth messages that become built-in flows, in list order. */
const BUILT_IN_KEYS = ['welcome', 'next_trip', 'win_back', 'review_thanks', 'gift_expiry', 'anniversary'] as const

const BUILT_IN_GOAL: Record<(typeof BUILT_IN_KEYS)[number], FlowGoal> = {
  welcome: 'welcome',
  next_trip: 'come_back',
  win_back: 'come_back',
  review_thanks: 'reviews',
  gift_expiry: 'gift_cards',
  anniversary: 'come_back',
}

type FlowActivity = { slug: string; name: string }

export interface FlowFromTemplateOptions {
  nowIso?: string
  /** The business's audiences, so an own audience can become plain conditions. */
  audiences?: Audience[]
  /** Known activities: slugs that no longer exist are dropped. */
  activities?: FlowActivity[]
}

/** The built-in flows, from the growth messages as they stand (pass the edited templates to keep the owner's changes). */
export function defaultFlows(nowIso: string, activities: FlowActivity[], templates: MessageTemplate[] = DEFAULT_TEMPLATES): Flow[] {
  return BUILT_IN_KEYS.map((key) => {
    const template = templates.find((entry) => entry.key === key) ?? DEFAULT_TEMPLATES.find((entry) => entry.key === key)!
    const flow = flowFromTemplate(template, { nowIso, activities })
    return { ...flow, goal: BUILT_IN_GOAL[key], builtIn: true, history: [] }
  })
}

/* --------------------------------------------------------------------------
   One older automation → one flow
   -------------------------------------------------------------------------- */

/** Ids made from the flow id and a counter, so the same template always gives the same flow. */
function idsFor(flowId: string) {
  let step = 0
  let condition = 0
  return { step: () => `${flowId}_s${++step}`, condition: () => `${flowId}_c${++condition}` }
}

function hoursAsDuration(hours: number): Duration {
  return hours >= 24 && hours % 24 === 0 ? { amount: hours / 24, unit: 'days' } : { amount: hours, unit: 'hours' }
}

/** For triggers that only count in days (time since the last trip, gift card expiry): whole days, at least one. */
function hoursAsDays(hours: number): Duration {
  return { amount: Math.max(1, Math.round(hours / 24)), unit: 'days' }
}

/** Moments that are about a booking: booking conditions apply there. */
const BOOKING_MOMENTS: TriggerWhen[] = ['on_booking', 'before', 'after', 'review']

/** The old moment as a trigger, plus a wait before the first message where the trigger itself has no offset. */
function triggerFor(timing: MessageTemplate['timing']): { trigger: FlowTrigger; leadWait?: Duration } {
  const offset = hoursAsDuration(Math.max(0, timing.hours))
  const lead = timing.hours > 0 ? offset : undefined
  switch (timing.when) {
    case 'on_booking':
      return { trigger: { type: 'booking_made' }, leadWait: lead }
    case 'before':
      return { trigger: { type: 'before_start', offset } }
    case 'after':
      return { trigger: { type: 'after_end', offset } }
    case 'signup':
      return { trigger: { type: 'joined_list' }, leadWait: lead }
    // Viewing without booking is closest to leaving checkout.
    case 'browse':
      return { trigger: { type: 'checkout_abandoned', offset } }
    case 'since_last':
      return { trigger: { type: 'lapsed', offset: hoursAsDays(timing.hours) } }
    case 'anniversary':
      return { trigger: { type: 'trip_anniversary', offset: { amount: 0, unit: 'days' } } }
    case 'review':
      return { trigger: { type: 'review_left', ratings: [4, 5] }, leadWait: lead }
    case 'gift_expiry':
      return { trigger: { type: 'gift_card_expiring', offset: hoursAsDays(timing.hours) } }
    // No matching moment (birthdays, waitlists): started by your team.
    case 'birthday':
    case 'waitlist':
    case 'manual':
      return { trigger: { type: 'manual' } }
  }
}

function goalFor(template: MessageTemplate): FlowGoal {
  const growth = (template.group ?? 'booking') === 'growth'
  switch (template.timing.when) {
    case 'signup':
      return 'welcome'
    case 'review':
      return 'reviews'
    case 'gift_expiry':
      return 'gift_cards'
    case 'browse':
      return 'recover'
    case 'waitlist':
      return 'fill_seats'
    case 'before':
      return growth ? 'sell_more' : 'prepare_guests'
    case 'on_booking':
      return growth ? 'sell_more' : 'prepare_guests'
    // A booking message after the trip is the review ask.
    case 'after':
      return growth ? 'come_back' : 'reviews'
    default:
      return 'come_back'
  }
}

/** The built-in audiences, as plain conditions. */
function builtInAudience(id: string, make: (field: ConditionField, op: ConditionOp, value?: Condition['value']) => Condition): Condition[] | null {
  switch (id) {
    case 'aud_all':
      return []
    case 'aud_new':
      return [make('guest.segment', 'any_of', ['new'])]
    case 'aud_repeat':
      return [make('guest.bookings', 'at_least', 2)]
    case 'aud_vip':
      return [make('guest.segment', 'any_of', ['vip'])]
    case 'aud_lapsed':
      return [make('guest.daysSinceLastTrip', 'at_least', 120)]
    case 'aud_local':
      return [make('guest.local', 'yes')]
    default:
      return null
  }
}

/** An own audience's filter (or its rules, once audiences have them), as plain conditions. */
function audienceConditions(audience: Audience, make: (field: ConditionField, op: ConditionOp, value?: Condition['value']) => Condition): Condition[] {
  const rules = (audience as Audience & { rules?: ConditionGroup }).rules
  if (rules && rules.match === 'all') return rules.conditions.map((entry) => make(entry.field, entry.op, entry.value))
  const { filter } = audience
  const out: Condition[] = []
  if (filter.segments.length > 0) out.push(make('guest.segment', 'any_of', [...filter.segments]))
  if (filter.activitySlugs.length > 0) out.push(make('guest.bookedActivity', 'any_of', [...filter.activitySlugs]))
  if (filter.lastTrip) out.push(make('guest.daysSinceLastTrip', filter.lastTrip.op === 'over' ? 'at_least' : 'at_most', filter.lastTrip.days))
  if (filter.minBookings) out.push(make('guest.bookings', 'at_least', filter.minBookings))
  // Audiences keep spend in major units; flows use minor units.
  if (filter.minSpend) out.push(make('guest.spend', 'at_least', Math.round(filter.minSpend * 100)))
  if (filter.countries.length > 0) out.push(make('guest.country', 'any_of', [...filter.countries]))
  if (filter.tags.length > 0) out.push(make('guest.tags', 'any_of', [...filter.tags]))
  if (filter.consent === 'email') out.push(make('guest.emailOptIn', 'yes'))
  if (filter.consent === 'sms') out.push(make('guest.smsOptIn', 'yes'))
  return out
}

/**
 * Turns a stored message automation (a growth message, or one of the
 * business's own custom_… automations with follow-ups and rules) into a flow:
 * the moment becomes the trigger, follow-ups become waits and "only if"
 * questions, the offer becomes a code, and the rules become who can enter
 * and the settings.
 */
export function flowFromTemplate(template: MessageTemplate, options: FlowFromTemplateOptions = {}): Flow {
  const nowIso = options.nowIso ?? NOW_ISO
  const flowId = `flow_${template.key}`
  const ids = idsFor(flowId)
  const make = (field: ConditionField, op: ConditionOp, value?: Condition['value']): Condition => ({ id: ids.condition(), field, op, value })

  const growth = (template.group ?? 'booking') === 'growth'
  const purpose = growth ? 'marketing' : 'booking'
  const rules = rulesOf(template)
  const { trigger, leadWait } = triggerFor(template.timing)
  const aboutBooking = BOOKING_MOMENTS.includes(template.timing.when)
  const known = options.activities && options.activities.length > 0 ? new Set(options.activities.map((activity) => activity.slug)) : null
  const keep = (slugs: string[] | undefined) => (slugs ?? []).filter((slug) => !known || known.has(slug))

  /* ---- who can enter ---- */
  const who: Condition[] = []
  let lostAudience = false
  if (template.audienceId) {
    const own = options.audiences?.find((audience) => audience.id === template.audienceId)
    const builtIn = builtInAudience(template.audienceId, make)
    // "Not back in 4 months" says the same as a lapsed trigger; do not say it twice.
    if (builtIn && !(template.audienceId === 'aud_lapsed' && trigger.type === 'lapsed')) who.push(...builtIn)
    else if (!builtIn && own) who.push(...audienceConditions(own, make))
    else if (!builtIn) {
      // An audience we cannot read here stays on the trigger, and the flow waits to be checked: without it, it would reach everyone.
      trigger.audienceId = template.audienceId
      lostAudience = true
    }
  }
  // Activities that no longer exist are dropped, but never so far that "only these" turns into "all of them".
  const wanted = keep(template.activitySlugs)
  const only = wanted.length > 0 ? wanted : [...(template.activitySlugs ?? [])]
  const skip = keep(template.excludeSlugs)
  const activityField: ConditionField = aboutBooking ? 'booking.activity' : 'guest.bookedActivity'
  if (only.length > 0) who.push(make(activityField, 'any_of', only))
  if (skip.length > 0) who.push(make(activityField, 'none_of', skip))
  if (rules.excludeTags.length > 0) who.push(make('guest.tags', 'none_of', [...rules.excludeTags]))
  // "Skip guests who booked recently" is closest to "already has a trip coming up".
  if (rules.skipBookedWithinDays > 0) who.push(make('guest.hasUpcomingTrip', 'no'))
  if (rules.minPartySize > 0 && aboutBooking) who.push(make('booking.partySize', 'at_least', rules.minPartySize))
  if (rules.countries.length > 0) who.push(make('guest.country', 'any_of', [...rules.countries]))

  /* ---- steps ---- */
  const holdUntil = (): WaitStep[] => (rules.sendAt ? [{ id: ids.step(), type: 'wait', mode: 'until_time', time: rules.sendAt, days: [...rules.days] }] : [])
  const message = (channel: MessageTemplate['channel'], subject: string, body: string, extra: { design?: MessageTemplate['design']; subjectB?: string } = {}): FlowStep[] => {
    const out: FlowStep[] = []
    if (channel !== 'sms') out.push({ id: ids.step(), type: 'email', subject, body, ...(extra.design ? { design: extra.design } : {}), ...(extra.subjectB ? { subjectB: extra.subjectB } : {}) })
    if (channel !== 'email') out.push({ id: ids.step(), type: 'sms', body })
    return out
  }

  const steps: FlowStep[] = []
  if (leadWait) steps.push({ id: ids.step(), type: 'wait', mode: 'for', duration: leadWait })
  const offer = template.offer
  if (offer?.enabled && cleanCode(offer.code)) {
    // Stored offers can carry odd numbers from older versions: keep them to a usable code.
    const percent = Number.isFinite(offer.percent) ? Math.min(100, Math.max(1, Math.round(offer.percent))) : 10
    const validDays = Number.isFinite(offer.validDays) && offer.validDays > 0 ? Math.round(offer.validDays) : 14
    steps.push({ id: ids.step(), type: 'action', action: 'give_code', code: { percent, validDays, prefix: cleanCode(offer.code) } })
  }
  steps.push(
    ...holdUntil(),
    ...message(template.channel, template.subject, template.body, {
      design: template.design,
      subjectB: template.abTest?.enabled && template.abTest.subjectB.trim() ? template.abTest.subjectB : undefined,
    }),
  )

  const ONLY_IF: Record<Exclude<AutomationStep['onlyIf'], 'always'>, { field: ConditionField; label: string }> = {
    not_opened: { field: 'flow.opened', label: 'Still not opened?' },
    not_clicked: { field: 'flow.clicked', label: 'Still not clicked?' },
    not_booked: { field: 'flow.booked', label: 'Still not booked?' },
  }
  for (const follow of template.steps ?? []) {
    if (follow.waitDays > 0) steps.push({ id: ids.step(), type: 'wait', mode: 'for', duration: { amount: follow.waitDays, unit: 'days' } })
    const send = [...holdUntil(), ...message(follow.channel, follow.subject, follow.body, { design: follow.design })]
    const checks: Condition[] = []
    let label = ''
    if (follow.onlyIf !== 'always') {
      checks.push(make(ONLY_IF[follow.onlyIf].field, 'no'))
      label = ONLY_IF[follow.onlyIf].label
    }
    // "Ends when they click" used to stop the whole sequence: every later message now asks first.
    if (rules.exitOn === 'clicked' && follow.onlyIf !== 'not_clicked') {
      checks.push(make('flow.clicked', 'no'))
      label ||= 'Still not clicked?'
    }
    if (checks.length > 0) steps.push({ id: ids.step(), type: 'branch', label, when: { match: 'all', conditions: checks }, yes: send, no: [] })
    else steps.push(...send)
  }

  /* ---- exit and settings ---- */
  const base = blankFlow({ trigger, purpose, name: template.name, nowIso })
  const reentry: Flow['settings']['reentry'] = rules.repeat === 'once' ? 'once' : rules.repeat === 'every' && aboutBooking ? 'per_booking' : 'every'
  const cooldown = Number.isFinite(rules.cooldownDays) ? Math.round(rules.cooldownDays) : base.settings.reentryDays
  const reentryDays = rules.repeat === 'cooldown' ? Math.max(1, cooldown) : rules.repeat === 'every' ? 1 : base.settings.reentryDays
  const history: Flow['history'] = [{ at: nowIso, what: 'Moved over from your earlier automations' }]
  if (lostAudience && template.enabled) history.unshift({ at: nowIso, what: 'Paused: the audience it was for could not be found' })

  return {
    ...base,
    id: flowId,
    name: template.name,
    description: template.purpose,
    goal: goalFor(template),
    purpose,
    status: template.enabled && !lostAudience ? 'live' : 'paused',
    trigger,
    who: { match: 'all', conditions: who },
    steps,
    exit: { ...base.exit, onBooked: rules.exitOn === 'booked' },
    settings: { ...base.settings, reentry, reentryDays, sendDays: [...rules.days], channelFallback: rules.fallback },
    builtIn: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    history,
  }
}

/** The business's own growth automations (custom_…), ready to move over. */
export function customGrowthTemplates(templates: MessageTemplate[]): MessageTemplate[] {
  return templates.filter((template) => template.key.startsWith('custom_') && (template.group ?? 'booking') === 'growth' && Boolean(template.name))
}
