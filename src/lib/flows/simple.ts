import { blankFlow, newId, triggerMeta } from '@/lib/flows/catalog'
import type { BranchStep, Condition, ConditionField, Duration, EmailStep, Flow, FlowStep, FlowTrigger, SmsStep, TriggerType } from '@/lib/flows/types'
import type { EmailDesign } from '@/lib/email-design'

/* ==========================================================================
   The simple shape of an automation — what the everyday editor shows:
   when it starts, a short list of messages (each with a wait and an
   optional "only if"), an optional discount code and the activities it is
   for. Most automations are exactly this. One with anything more (a Yes/No
   with steps on both sides, an A/B test, tags) opens in the full builder
   instead. Browser- and server-safe.
   ========================================================================== */

export type SimpleOnlyIf = 'always' | 'not_booked' | 'not_opened' | 'not_clicked' | 'waivers_missing' | 'balance_due'

export interface SimpleMessage {
  /** The message step's id, kept so its numbers follow it. */
  id: string
  channel: 'email' | 'sms'
  subject: string
  body: string
  design?: EmailDesign
  preheader?: string
  /** How long after the one before (or after the start, for the first). 0: straight away. */
  wait: Duration
  onlyIf: SimpleOnlyIf
}

export interface SimpleAutomation {
  trigger: FlowTrigger
  /** Only for these activities. Empty: all of them. */
  activities: string[]
  discount: { on: boolean; percent: number; validDays: number; prefix: string }
  messages: SimpleMessage[]
  /** Messages wait for this time of day (HH:MM). Empty: they go when due. */
  sendAt: string
}

/* ---------- what the editor offers ---------- */

/** The moments the simple editor lists, in plain words, in the order owners look for them. */
export const SIMPLE_TRIGGERS: { type: TriggerType; label: string; offsetWords?: string }[] = [
  { type: 'booking_made', label: 'Someone books' },
  { type: 'before_start', label: 'Before the trip or visit', offsetWords: 'before it starts' },
  { type: 'after_end', label: 'After the trip or visit', offsetWords: 'after it ends' },
  { type: 'booking_cancelled', label: 'A booking is cancelled' },
  { type: 'no_show', label: 'A guest doesn’t turn up' },
  { type: 'joined_list', label: 'Someone joins your list' },
  { type: 'checkout_abandoned', label: 'Someone leaves without booking', offsetWords: 'after they leave' },
  { type: 'review_left', label: 'A guest leaves a good review' },
  { type: 'lapsed', label: 'A guest hasn’t been back', offsetWords: 'since their last trip' },
  { type: 'became_vip', label: 'A guest becomes a regular' },
  { type: 'trip_anniversary', label: 'A year after their trip' },
  { type: 'gift_card_expiring', label: 'A gift card is running out', offsetWords: 'before it runs out' },
  { type: 'low_fill', label: 'A trip or visit has empty seats', offsetWords: 'before it starts' },
]

export const ONLY_IF_LABEL: Record<SimpleOnlyIf, string> = {
  always: 'Always',
  not_booked: 'They haven’t booked yet',
  not_opened: 'They didn’t open the last one',
  not_clicked: 'They didn’t click the last one',
  waivers_missing: 'Waivers are still unsigned',
  balance_due: 'They still owe money',
}

/** "Only if" choices that need a booking to look at. */
const BOOKING_ONLY_IF: SimpleOnlyIf[] = ['waivers_missing', 'balance_due']

export function onlyIfChoices(trigger: FlowTrigger, first: boolean): SimpleOnlyIf[] {
  const booking = triggerMeta(trigger.type).subject === 'booking'
  const out: SimpleOnlyIf[] = ['always']
  if (!first) out.push('not_booked', 'not_opened', 'not_clicked')
  if (booking) out.push(...BOOKING_ONLY_IF)
  return out
}

/* ---------- conditions behind each "only if" ---------- */

function conditionFor(onlyIf: Exclude<SimpleOnlyIf, 'always'>): Pick<Condition, 'field' | 'op' | 'value'> {
  switch (onlyIf) {
    case 'not_booked':
      return { field: 'flow.booked', op: 'no' }
    case 'not_opened':
      return { field: 'flow.opened', op: 'no' }
    case 'not_clicked':
      return { field: 'flow.clicked', op: 'no' }
    case 'waivers_missing':
      return { field: 'booking.waiversMissing', op: 'yes' }
    case 'balance_due':
      return { field: 'booking.balanceDue', op: 'at_least', value: 1 }
  }
}

function onlyIfOf(condition: Condition): SimpleOnlyIf | null {
  const { field, op } = condition
  if (field === 'flow.booked' && op === 'no') return 'not_booked'
  if (field === 'flow.opened' && op === 'no') return 'not_opened'
  if (field === 'flow.clicked' && op === 'no') return 'not_clicked'
  if (field === 'booking.waiversMissing' && op === 'yes') return 'waivers_missing'
  if (field === 'booking.balanceDue' && op === 'at_least') return 'balance_due'
  return null
}

const QUESTION: Record<Exclude<SimpleOnlyIf, 'always'>, string> = {
  not_booked: 'Still not booked?',
  not_opened: 'Didn’t open it?',
  not_clicked: 'Didn’t click it?',
  waivers_missing: 'Waivers still unsigned?',
  balance_due: 'Still owe money?',
}

const ACTIVITY_FIELDS: ConditionField[] = ['booking.activity', 'guest.bookedActivity']

/* ---------- flow → simple ---------- */

const NO_WAIT: Duration = { amount: 0, unit: 'days' }

/** Waits in one unit when they share it; otherwise in hours. */
function addWait(a: Duration, b: Duration): Duration {
  if (a.amount === 0) return b
  if (b.amount === 0) return a
  if (a.unit === b.unit) return { amount: a.amount + b.amount, unit: a.unit }
  const hours = (d: Duration) => (d.unit === 'days' ? d.amount * 24 : d.unit === 'hours' ? d.amount : d.amount / 60)
  return { amount: Math.round(hours(a) + hours(b)), unit: 'hours' }
}

/**
 * The simple shape of a flow, or null when it does more than the simple
 * editor shows (then it opens in the full builder, and nothing is lost).
 */
export function toSimple(flow: Flow): SimpleAutomation | null {
  const messages: SimpleMessage[] = []
  let discount: SimpleAutomation['discount'] = { on: false, percent: 10, validDays: 14, prefix: 'THANKS' }
  let pending: Duration = NO_WAIT
  let sendAt = ''

  const take = (step: FlowStep, onlyIf: SimpleOnlyIf): boolean => {
    if (step.type === 'email' || step.type === 'sms') {
      // A second subject line for half the guests is an A/B test: the full builder's job.
      if (step.type === 'email' && step.subjectB) return false
      messages.push({
        id: step.id,
        channel: step.type,
        subject: step.type === 'email' ? step.subject : '',
        body: step.body,
        design: step.type === 'email' ? step.design : undefined,
        preheader: step.type === 'email' ? step.preheader : undefined,
        wait: pending,
        onlyIf,
      })
      pending = NO_WAIT
      return true
    }
    if (step.type === 'wait' && step.mode === 'until_time' && step.time) {
      if (sendAt && sendAt !== step.time) return false
      if (step.days && step.days.length > 0) return false
      sendAt = step.time
      return true
    }
    return false
  }

  for (const step of flow.steps) {
    if (step.type === 'wait' && step.mode === 'for' && step.duration) {
      pending = addWait(pending, step.duration)
      continue
    }
    if (step.type === 'action' && step.action === 'give_code' && step.code && messages.length === 0 && !discount.on) {
      discount = { on: true, percent: step.code.percent, validDays: step.code.validDays, prefix: step.code.prefix }
      continue
    }
    if (step.type === 'branch') {
      // "Only if" is a question with messages on the Yes side and nothing on the No side.
      if (step.no.length > 0 || step.when.conditions.length !== 1) return null
      const onlyIf = onlyIfOf(step.when.conditions[0])
      if (!onlyIf) return null
      const waitBefore = pending
      let first = true
      for (const inner of step.yes) {
        if (!take(inner, onlyIf)) return null
        // Both messages of an email-and-text pair share the wait.
        if (inner.type === 'email' || inner.type === 'sms') {
          if (first) messages[messages.length - 1].wait = waitBefore
          first = false
        }
      }
      continue
    }
    if (!take(step, 'always')) return null
  }
  if (messages.length === 0 && flow.steps.length > 0) return null

  // Only an activity list is shown; any other "who can enter" stays as it is, untouched.
  const activityCondition = flow.who.conditions.find((condition) => ACTIVITY_FIELDS.includes(condition.field) && condition.op === 'any_of')
  const activities = Array.isArray(activityCondition?.value) ? (activityCondition.value as string[]) : []

  return { trigger: flow.trigger, activities, discount, messages, sendAt }
}

/* ---------- simple → flow ---------- */

/** The flow with the simple editor's changes written into it. */
export function applySimple(flow: Flow, simple: SimpleAutomation): Flow {
  const steps: FlowStep[] = []
  if (simple.discount.on) {
    steps.push({
      id: flow.steps.find((step) => step.type === 'action' && step.action === 'give_code')?.id ?? newId('step'),
      type: 'action',
      action: 'give_code',
      code: { percent: simple.discount.percent, validDays: simple.discount.validDays, prefix: simple.discount.prefix || 'THANKS' },
    })
  }
  for (const message of simple.messages) {
    if (message.wait.amount > 0) steps.push({ id: newId('step'), type: 'wait', mode: 'for', duration: { ...message.wait } })
    const send: FlowStep[] = []
    if (simple.sendAt) send.push({ id: newId('step'), type: 'wait', mode: 'until_time', time: simple.sendAt, days: [] })
    send.push(
      message.channel === 'email'
        ? ({ id: message.id, type: 'email', subject: message.subject, body: message.body, ...(message.design ? { design: message.design } : {}), ...(message.preheader ? { preheader: message.preheader } : {}) } satisfies EmailStep)
        : ({ id: message.id, type: 'sms', body: message.body } satisfies SmsStep),
    )
    if (message.onlyIf === 'always') steps.push(...send)
    else {
      const branch: BranchStep = {
        id: newId('step'),
        type: 'branch',
        label: QUESTION[message.onlyIf],
        when: { match: 'all', conditions: [{ id: newId('cond'), ...conditionFor(message.onlyIf) }] },
        yes: send,
        no: [],
      }
      steps.push(branch)
    }
  }

  const booking = triggerMeta(simple.trigger.type).subject === 'booking'
  const others = flow.who.conditions.filter((condition) => !(ACTIVITY_FIELDS.includes(condition.field) && condition.op === 'any_of'))
  const conditions =
    simple.activities.length > 0 ? [...others, { id: newId('cond'), field: (booking ? 'booking.activity' : 'guest.bookedActivity') as ConditionField, op: 'any_of' as const, value: [...simple.activities] }] : others

  return { ...flow, trigger: simple.trigger, steps, who: { ...flow.who, conditions } }
}

/* ---------- making new ones ---------- */

export function newSimpleMessage(channel: 'email' | 'sms', wait: Duration = NO_WAIT, onlyIf: SimpleOnlyIf = 'always'): SimpleMessage {
  return {
    id: newId('step'),
    channel,
    subject: channel === 'email' ? 'A note from {business}' : '',
    body: channel === 'email' ? 'Hi {first_name},\n\n\n\nSee you soon,\n{business}' : 'Hi {first_name}, ',
    wait,
    onlyIf,
  }
}

/** A blank automation with one email, as a flow the simple editor can open. */
export function blankSimpleFlow(nowIso: string): Flow {
  const flow = blankFlow({ trigger: 'after_end', nowIso, name: 'New automation' })
  return applySimple(flow, { trigger: flow.trigger, activities: [], discount: { on: false, percent: 10, validDays: 14, prefix: 'THANKS' }, messages: [newSimpleMessage('email')], sendAt: '' })
}
