import { humanizeTokens, newId, triggerMeta } from '@/lib/flows/catalog'
import { describeGroup, describeTrigger, describeWait, durationLabel, type DescribeLookups } from '@/lib/flows/describe'
import type { ActionStep, BranchStep, Condition, ConditionGroup, Flow, FlowAction, FlowStep, FlowStepType, FlowTrigger, TriggerType } from '@/lib/flows/types'

/* ==========================================================================
   The builder's words: short names for triggers, steps and conditions,
   the way standard automation tools name them. One job per step.
   ========================================================================== */

/* ---------- triggers ---------- */

export interface TriggerChoice {
  type: TriggerType
  /** In the picker. */
  label: string
  group: 'Bookings' | 'Guests' | 'Other'
  /** Words after the amount on the card: "3 hours after the booking ends". */
  after?: string
}

export const TRIGGER_CHOICES: TriggerChoice[] = [
  { type: 'booking_made', label: 'Booking made', group: 'Bookings' },
  { type: 'before_start', label: 'Before the booking starts', group: 'Bookings', after: 'before the booking starts' },
  { type: 'after_end', label: 'After the booking ends', group: 'Bookings', after: 'after the booking ends' },
  { type: 'booking_cancelled', label: 'Booking cancelled', group: 'Bookings' },
  { type: 'no_show', label: 'Guest didn’t show up', group: 'Bookings' },
  { type: 'joined_list', label: 'Joined your email list', group: 'Guests' },
  { type: 'checkout_abandoned', label: 'Left checkout without booking', group: 'Guests', after: 'after leaving checkout' },
  { type: 'lapsed', label: 'Hasn’t booked in a while', group: 'Guests', after: 'since their last booking' },
  { type: 'review_left', label: 'Left a good review', group: 'Guests' },
  { type: 'became_vip', label: 'Became a regular (3rd booking)', group: 'Guests' },
  { type: 'trip_anniversary', label: 'One year since their booking', group: 'Guests' },
  { type: 'gift_card_expiring', label: 'Gift card about to expire', group: 'Other', after: 'before it expires' },
  { type: 'low_fill', label: 'Spots still open', group: 'Other', after: 'before it starts' },
]

export const TRIGGER_GROUPS: TriggerChoice['group'][] = ['Bookings', 'Guests', 'Other']

export function triggerChoice(type: TriggerType): TriggerChoice | undefined {
  return TRIGGER_CHOICES.find((choice) => choice.type === type)
}

/** The trigger card's title: "3 hours after the booking ends", "Booking made". */
export function triggerTitle(trigger: FlowTrigger, lookups?: DescribeLookups): string {
  const choice = triggerChoice(trigger.type)
  if (!choice) return describeTrigger(trigger, lookups)
  if (choice.after && trigger.offset) {
    if (trigger.offset.amount === 0) return choice.label
    const base = `${durationLabel(trigger.offset)} ${choice.after}`
    return trigger.type === 'low_fill' ? `${base}, if under ${trigger.fillBelow ?? 50}% booked` : base
  }
  return choice.label
}

export const aboutBooking = (trigger: FlowTrigger) => triggerMeta(trigger.type).subject === 'booking'

/* ---------- steps ---------- */

export type StepKind = 'email' | 'sms' | 'wait' | 'branch' | 'split' | 'code' | 'notify' | 'tag' | 'untag' | 'task' | 'note' | 'unsubscribe' | 'end'

export const STEP_LABEL: Record<StepKind, string> = {
  email: 'Email',
  sms: 'Text message',
  wait: 'Wait',
  branch: 'Condition',
  split: 'A/B split',
  code: 'Discount code',
  notify: 'Notify team',
  tag: 'Add tag',
  untag: 'Remove tag',
  task: 'Create to-do',
  note: 'Add note',
  unsubscribe: 'Unsubscribe',
  end: 'End',
}

const ACTION_KIND: Record<FlowAction, StepKind> = {
  give_code: 'code',
  notify_team: 'notify',
  add_tag: 'tag',
  remove_tag: 'untag',
  create_task: 'task',
  add_note: 'note',
  unsubscribe: 'unsubscribe',
}

export function kindOf(step: FlowStep): StepKind {
  return step.type === 'action' ? ACTION_KIND[step.action] : (step.type as StepKind)
}

/** What "+" offers: the everyday steps first, the rest under More. */
export const MAIN_STEPS: { kind: StepKind; type: FlowStepType; action?: FlowAction }[] = [
  { kind: 'email', type: 'email' },
  { kind: 'sms', type: 'sms' },
  { kind: 'wait', type: 'wait' },
  { kind: 'branch', type: 'branch' },
  { kind: 'code', type: 'action', action: 'give_code' },
  { kind: 'notify', type: 'action', action: 'notify_team' },
]

export const MORE_STEPS: { kind: StepKind; type: FlowStepType; action?: FlowAction }[] = [
  { kind: 'tag', type: 'action', action: 'add_tag' },
  { kind: 'untag', type: 'action', action: 'remove_tag' },
  { kind: 'task', type: 'action', action: 'create_task' },
  { kind: 'split', type: 'split' },
]

/* ---------- conditions ---------- */

export interface ConditionPreset {
  id: string
  label: string
  /** Asked on the card. */
  question: string
  bookingOnly?: boolean
  /** Has a value to fill in (a number, an activity, a tag). */
  input?: 'number' | 'activity' | 'tag'
  build: (value?: string | number) => Pick<Condition, 'field' | 'op' | 'value'>
  matches: (condition: Condition) => boolean
}

export const CONDITION_PRESETS: ConditionPreset[] = [
  { id: 'booked', label: 'Made a new booking', question: 'Booked again?', build: () => ({ field: 'flow.booked', op: 'yes' }), matches: (c) => c.field === 'flow.booked' },
  { id: 'opened', label: 'Opened the last email', question: 'Opened the email?', build: () => ({ field: 'flow.opened', op: 'yes' }), matches: (c) => c.field === 'flow.opened' },
  { id: 'clicked', label: 'Clicked a link in the last email', question: 'Clicked a link?', build: () => ({ field: 'flow.clicked', op: 'yes' }), matches: (c) => c.field === 'flow.clicked' },
  { id: 'waivers', label: 'Signed all waivers', question: 'Waivers signed?', bookingOnly: true, build: () => ({ field: 'booking.waiversMissing', op: 'no' }), matches: (c) => c.field === 'booking.waiversMissing' },
  { id: 'paid', label: 'Paid in full', question: 'Paid in full?', bookingOnly: true, build: () => ({ field: 'booking.balanceDue', op: 'at_most', value: 0 }), matches: (c) => c.field === 'booking.balanceDue' },
  {
    id: 'group',
    label: 'Group size is at least',
    question: 'Big group?',
    bookingOnly: true,
    input: 'number',
    build: (value) => ({ field: 'booking.partySize', op: 'at_least', value: Number(value) || 6 }),
    matches: (c) => c.field === 'booking.partySize' && c.op === 'at_least',
  },
  {
    id: 'activity',
    label: 'Booked a certain activity',
    question: 'Booked this activity?',
    input: 'activity',
    build: (value) => ({ field: 'guest.bookedActivity', op: 'any_of', value: value ? [String(value)] : [] }),
    matches: (c) => (c.field === 'guest.bookedActivity' || c.field === 'booking.activity') && c.op === 'any_of',
  },
  {
    id: 'tag',
    label: 'Has a tag',
    question: 'Has this tag?',
    input: 'tag',
    build: (value) => ({ field: 'guest.tags', op: 'any_of', value: value ? [String(value)] : [] }),
    matches: (c) => c.field === 'guest.tags' && c.op === 'any_of',
  },
]

/** The preset a condition step uses, and the value filled in, or null when it was built some other way. */
export function presetOf(step: BranchStep): { preset: ConditionPreset; value?: string | number; flipped: boolean } | null {
  if (step.when.conditions.length !== 1) return null
  const condition = step.when.conditions[0]
  const preset = CONDITION_PRESETS.find((entry) => entry.matches(condition))
  if (!preset) return null
  const value = Array.isArray(condition.value) ? (condition.value[0] as string | undefined) : (condition.value as number | undefined)
  // "Didn't book" (op no) is the same question with the paths swapped.
  const expected = preset.build(value).op
  return { preset, value, flipped: condition.op !== expected }
}

export function presetGroup(preset: ConditionPreset, value?: string | number): ConditionGroup {
  return { match: 'all', conditions: [{ id: newId('cond'), ...preset.build(value) }] }
}

/** The question on a condition card. */
export function conditionQuestion(step: BranchStep, lookups?: DescribeLookups): string {
  const found = presetOf(step)
  if (found && !found.flipped) {
    if (found.preset.id === 'group') return `Group of ${found.value ?? 6} or more?`
    if (found.preset.id === 'activity') {
      const name = lookups?.activities?.find((activity) => activity.slug === found.value)?.name
      return name ? `Booked ${name}?` : found.preset.question
    }
    if (found.preset.id === 'tag') return found.value ? `Tagged “${found.value}”?` : found.preset.question
    return found.preset.question
  }
  return step.label?.trim() || `${describeGroup(step.when, lookups)}?`
}

/**
 * Every condition the positive way round ("Waivers signed?", "Booked
 * again?"), with its Yes and No paths swapped to match, so the card, the
 * panel and the paths always say the same thing.
 */
export function normalizeConditions(steps: FlowStep[]): FlowStep[] {
  return steps.map((step) => {
    if (step.type === 'split') return { ...step, a: normalizeConditions(step.a), b: normalizeConditions(step.b) }
    if (step.type !== 'branch') return step
    const yes = normalizeConditions(step.yes)
    const no = normalizeConditions(step.no)
    const found = presetOf(step)
    if (!found || !found.flipped) return { ...step, yes, no }
    return { ...step, label: undefined, when: presetGroup(found.preset, found.value), yes: no, no: yes }
  })
}

/* ---------- card titles ---------- */

export function stepTitle(step: FlowStep, lookups?: DescribeLookups): string {
  switch (step.type) {
    case 'email':
      return humanizeTokens(step.subject.trim()) || 'No subject yet'
    case 'sms': {
      const text = humanizeTokens(step.body.trim())
      return text ? text.slice(0, 70) + (text.length > 70 ? '…' : '') : 'No message yet'
    }
    case 'wait':
      return step.mode === 'for' && step.duration ? durationLabel(step.duration) : describeWait(step).replace(/^Wait /, '')
    case 'branch':
      return conditionQuestion(step, lookups)
    case 'split':
      return `${step.percentA}% / ${100 - step.percentA}%`
    case 'end':
      return 'Stop here'
    case 'action':
      return actionTitle(step)
  }
}

function actionTitle(step: ActionStep): string {
  switch (step.action) {
    case 'give_code':
      return step.code ? `${step.code.percent}% off, valid ${step.code.validDays} days` : 'Discount code'
    case 'add_tag':
      return step.tag ? `Tag “${step.tag}”` : 'Pick a tag'
    case 'remove_tag':
      return step.tag ? `Remove “${step.tag}”` : 'Pick a tag'
    case 'notify_team':
    case 'create_task':
    case 'add_note':
      return step.message?.trim() ? humanizeTokens(step.message.trim()).slice(0, 70) : 'Write the message'
    case 'unsubscribe':
      return 'Stop marketing to this guest'
  }
}

/** Steps a flow still needs filled in, by id: shown as a red mark on the card. */
export function emptySteps(flow: Flow): Set<string> {
  const out = new Set<string>()
  const walk = (steps: FlowStep[]) => {
    for (const step of steps) {
      if (step.type === 'email' && (!step.subject.trim() || !step.body.trim())) out.add(step.id)
      if (step.type === 'sms' && !step.body.trim()) out.add(step.id)
      if (step.type === 'action' && (step.action === 'add_tag' || step.action === 'remove_tag') && !step.tag?.trim()) out.add(step.id)
      if (step.type === 'branch') {
        walk(step.yes)
        walk(step.no)
      }
      if (step.type === 'split') {
        walk(step.a)
        walk(step.b)
      }
    }
  }
  walk(flow.steps)
  return out
}
