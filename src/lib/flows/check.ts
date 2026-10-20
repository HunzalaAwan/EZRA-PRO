import { formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import {
  ALL_PLACEHOLDERS,
  BOOKING_ONLY_TOKENS,
  BOOKING_WAIT_EVENTS,
  WAIT_EVENT_LABEL,
  canWaitUntilStart,
  fieldFits,
  fieldMeta,
  mustBeMarketing,
  newId,
  newStep,
  placeholderByToken,
  placeholdersForFlow,
  exitFor,
  subjectOf,
  subjectsOf,
  tokensIn,
  triggerMeta,
} from './catalog'
import { branchQuestion, describeStep, describeWait, durationLabel } from './describe'
import { childPaths, insertStep, isParent, locateStep, messageSteps, removeStep, updateStep, walkSteps } from './tree'
import type { ActionStep, Condition, EmailStep, Flow, FlowIssue, FlowStep, SmsStep, TriggerSubject } from './types'

/* ==========================================================================
   Health check — what stands between an automation and going live, in
   plain words. Blockers stop "Turn on" (something would break or go to the
   wrong people), warnings are worth a look, tips make it work better. Each
   issue points at its step and, where the answer is obvious, carries a
   one-click fix the builder applies.
   ========================================================================== */

export interface CheckContext {
  audiences: { id: string; name: string }[]
  activities: { slug: string; name: string }[]
  /** The business's own texting number is set up in Settings → Domains & numbers. Without it texts still go, from the shared number. */
  hasSmsNumber: boolean
  /** Marketing is paused in Marketing settings. */
  marketingPaused: boolean
  /** The business's currency, for money in the wording. */
  currency: CurrencyCode
}

/* --------------------------------------------------------------------------
   Text length — how many parts a text is sent as
   -------------------------------------------------------------------------- */

const GSM_BASIC =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM_EXTENDED = '^{}\\[~]|€\f'
const GSM_BASIC_SET = new Set(GSM_BASIC)
const GSM_EXTENDED_SET = new Set(GSM_EXTENDED)

export interface SmsLength {
  /** gsm: plain characters, 160 to a part. unicode: emoji, curly quotes or accents outside the plain set, 70 to a part. */
  encoding: 'gsm' | 'unicode'
  /** Characters as the carrier counts them. */
  chars: number
  segments: number
  /** Characters a part holds at this length. */
  perSegment: number
}

/** How a carrier counts a text: plain characters, or the shorter Unicode parts once one special character is in. */
export function smsLength(text: string): SmsLength {
  let gsm = true
  let units = 0
  for (const char of text) {
    if (GSM_BASIC_SET.has(char)) units += 1
    else if (GSM_EXTENDED_SET.has(char)) units += 2
    else {
      gsm = false
      break
    }
  }
  if (gsm) {
    const segments = units <= 160 ? 1 : Math.ceil(units / 153)
    return { encoding: 'gsm', chars: units, segments: units === 0 ? 0 : segments, perSegment: units <= 160 ? 160 : 153 }
  }
  const chars = text.length
  const segments = chars <= 70 ? 1 : Math.ceil(chars / 67)
  return { encoding: 'unicode', chars, segments, perSegment: chars <= 70 ? 70 : 67 }
}

/** Roughly how long each detail is once filled in, for counting text length. */
const FILLED_LENGTH: Record<string, string> = {
  '{book_link}': 'https://ezra.link/b/abc123',
  '{manage_link}': 'https://ezra.link/m/abc123',
}

/** A text as it would go out: details filled with typical values, plus the opt-out line marketing texts carry. */
export function smsAsSent(body: string, marketing: boolean): string {
  const filled = body.replace(/\{([a-z_]+)\}/g, (match) => FILLED_LENGTH[match] ?? placeholderByToken(match)?.sample ?? match)
  return marketing ? `${filled} Reply STOP to opt out.` : filled
}

/* --------------------------------------------------------------------------
   Naming steps in sentences
   -------------------------------------------------------------------------- */

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
const quote = (text: string) => `“${text}”`
const capitalize = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text)

function short(text: string, max = 40): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`
}

function nameSteps(steps: FlowStep[]): Map<string, string> {
  const names = new Map<string, string>()
  let emails = 0
  let texts = 0
  walkSteps(steps, (step) => {
    if (step.type === 'email') {
      const subject = step.subject.replace(/\{([a-z_]+)\}/g, (match) => {
        const item = placeholderByToken(match)
        return item ? `[${item.label}]` : match
      })
      names.set(step.id, subject.trim() ? `the email ${quote(short(subject))}` : `the ${ORDINAL[emails] ?? 'next'} email`)
      emails += 1
    } else if (step.type === 'sms') {
      names.set(step.id, `the ${ORDINAL[texts] ?? 'next'} text`)
      texts += 1
    } else if (step.type === 'branch') {
      names.set(step.id, `the question ${quote(branchQuestion(step))}`)
    } else if (step.type === 'split') {
      names.set(step.id, 'the A/B test')
    } else if (step.type === 'wait') {
      names.set(step.id, `the step ${quote(describeWait(step))}`)
    } else {
      names.set(step.id, `the step ${quote(describeStep(step).title)}`)
    }
  })
  return names
}

/* --------------------------------------------------------------------------
   Fix helpers — each returns a new flow
   -------------------------------------------------------------------------- */

const withSteps = (flow: Flow, steps: FlowStep[]): Flow => ({ ...flow, steps })

/** Add steps at the end of the main path, before a closing "End here" so they still run. */
function appendSteps(flow: Flow, added: FlowStep[]): Flow {
  const steps = flow.steps
  const last = steps[steps.length - 1]
  if (last?.type === 'end') return withSteps(flow, [...steps.slice(0, -1), ...added, last])
  return withSteps(flow, [...steps, ...added])
}

/** A real HH:MM time of day. */
function isClock(value: string | undefined): boolean {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '')
  return match !== null && Number(match[1]) <= 23 && Number(match[2]) <= 59
}

function patchStep(id: string, change: Partial<FlowStep> | ((step: FlowStep) => FlowStep)) {
  return (flow: Flow) => withSteps(flow, updateStep(flow.steps, id, change))
}

/** Put a step right before another one, in the same list. */
function insertBefore(id: string, make: () => FlowStep) {
  return (flow: Flow) => {
    const at = locateStep(flow.steps, id)
    return at ? withSteps(flow, insertStep(flow.steps, at, make())) : flow
  }
}

function removeCondition(conditionId: string, branchId?: string) {
  return (flow: Flow): Flow => {
    if (!branchId) return { ...flow, who: { ...flow.who, conditions: flow.who.conditions.filter((c) => c.id !== conditionId) } }
    return withSteps(
      flow,
      updateStep(flow.steps, branchId, (step) =>
        step.type === 'branch' ? { ...step, when: { ...step.when, conditions: step.when.conditions.filter((c) => c.id !== conditionId) } } : step,
      ),
    )
  }
}

function changeCondition(conditionId: string, branchId: string | undefined, change: (c: Condition) => Condition) {
  return (flow: Flow): Flow => {
    if (!branchId) return { ...flow, who: { ...flow.who, conditions: flow.who.conditions.map((c) => (c.id === conditionId ? change(c) : c)) } }
    return withSteps(
      flow,
      updateStep(flow.steps, branchId, (step) =>
        step.type === 'branch' ? { ...step, when: { ...step.when, conditions: step.when.conditions.map((c) => (c.id === conditionId ? change(c) : c)) } } : step,
      ),
    )
  }
}

/** Take the given details out of a step's texts. */
function stripTokens(id: string, tokens: string[]) {
  const strip = (text: string | undefined) =>
    text === undefined
      ? text
      : tokens
          .reduce((acc, token) => acc.split(token).join(''), text)
          .replace(/[ \t]{2,}/g, ' ')
          .replace(/ ([,.!?:;])/g, '$1')
          .trim()
  return patchStep(id, (step) => {
    if (step.type === 'email') return { ...step, subject: strip(step.subject) ?? '', preheader: strip(step.preheader), body: strip(step.body) ?? '', subjectB: strip(step.subjectB) }
    if (step.type === 'sms') return { ...step, body: strip(step.body) ?? '' }
    if (step.type === 'action') return { ...step, message: strip(step.message) }
    return step
  })
}

const CODE_LINE = 'Here is {offer_percent} off your next booking with your own code {offer_code}.'

/** Add the code line to a message so the code actually reaches the guest. */
function addCodeLine(id: string) {
  return patchStep(id, (step) => {
    if (step.type === 'email') return { ...step, body: insertBeforeSignOff(step.body, CODE_LINE) }
    if (step.type === 'sms') return { ...step, body: `${step.body.trim()} Code {offer_code} for {offer_percent} off.` }
    return step
  })
}

/** Put a line before the sign-off of a letter ("See you soon,\n{business}"), or at the end. */
function insertBeforeSignOff(body: string, line: string): string {
  const paragraphs = body.trim().split(/\n{2,}/)
  if (paragraphs.length >= 2 && paragraphs[paragraphs.length - 1].length < 60) {
    return [...paragraphs.slice(0, -1), line, paragraphs[paragraphs.length - 1]].join('\n\n')
  }
  return `${body.trim()}\n\n${line}`
}

function switchToMarketing(flow: Flow): Flow {
  return { ...flow, purpose: 'marketing', exit: { ...exitFor('marketing'), ...flow.exit, onBooked: true }, settings: { ...flow.settings, smartSending: true, reentry: flow.settings.reentry === 'per_booking' ? 'once' : flow.settings.reentry } }
}

/* --------------------------------------------------------------------------
   The check
   -------------------------------------------------------------------------- */

const TOKEN_FIELDS = (step: FlowStep): string[] => {
  if (step.type === 'email') return [step.subject, step.preheader ?? '', step.body, step.subjectB ?? '']
  if (step.type === 'sms') return [step.body]
  if (step.type === 'action' && (step.action === 'notify_team' || step.action === 'create_task' || step.action === 'add_note')) return [step.message ?? '']
  return []
}

/** Details a subject cannot fill: a guest flow has no booking, only a departure flow knows the seats left. */
function unavailableTokens(subjects: TriggerSubject[], allowed: Set<string>): (token: string) => boolean {
  return (token) => {
    if (allowed.has(token)) return false
    if (token === '{offer_code}' || token === '{offer_percent}') return false
    if (BOOKING_ONLY_TOKENS.includes(token)) return !subjects.includes('booking')
    return Boolean(placeholderByToken(token))
  }
}

const SUBJECT_WORD: Record<TriggerSubject, string> = {
  guest: 'a guest rather than a booking',
  booking: 'a booking',
  departure: 'a time slot rather than one booking',
}

const isMessage = (step: FlowStep): step is EmailStep | SmsStep => step.type === 'email' || step.type === 'sms'

/** Days in a duration, for comparing lengths. */
function daysOf(d: { amount: number; unit: 'minutes' | 'hours' | 'days' } | undefined): number {
  if (!d) return 0
  return d.unit === 'days' ? d.amount : d.unit === 'hours' ? d.amount / 24 : d.amount / 1440
}

/**
 * Everything worth knowing before an automation goes live, blockers first.
 * Pass what the business has (audiences, activities, a texting number,
 * whether marketing is paused) to check against it; anything left out is
 * not checked.
 */
export function checkFlow(flow: Flow, ctx: Partial<CheckContext> = {}): FlowIssue[] {
  const issues: FlowIssue[] = []
  const add = (issue: Omit<FlowIssue, 'id'> & { code: string }) => {
    const { code, ...rest } = issue
    const id = `${code}:${issue.stepId ?? 'flow'}`
    if (!issues.some((existing) => existing.id === id)) issues.push({ id, ...rest })
  }

  const meta = triggerMeta(flow.trigger.type)
  const subject = subjectOf(flow.trigger)
  const subjects = subjectsOf(flow.trigger)
  const marketing = flow.purpose === 'marketing'
  const names = nameSteps(flow.steps)
  const nameOf = (id: string) => names.get(id) ?? 'this step'
  const messages = messageSteps(flow.steps)
  const allSteps: FlowStep[] = []
  walkSteps(flow.steps, (step) => {
    allSteps.push(step)
  })
  const hasAction = allSteps.some((step) => step.type === 'action')
  const hasCodeStep = allSteps.some((step) => step.type === 'action' && step.action === 'give_code')
  const allowed = new Set(placeholdersForFlow(flow).map((item) => item.token))
  const cannotFill = unavailableTokens(subjects, allowed)
  const knownTokens = new Set(ALL_PLACEHOLDERS.map((item) => item.token))
  const activitySlugs = ctx.activities ? new Set(ctx.activities.map((activity) => activity.slug)) : null

  /* ---------- the trigger ---------- */

  if (meta.offset) {
    const offset = flow.trigger.offset
    // "Hasn't booked for 0 days" would start straight after every trip.
    const least = flow.trigger.type === 'lapsed' ? 1 : 0
    if (!offset || !Number.isFinite(offset.amount) || offset.amount < least) {
      add({
        code: 'trigger-offset',
        severity: 'blocker',
        text: `Set how long ${meta.offset.label} it starts.`,
        fix: { label: `Use ${durationLabel(meta.offset.default)}`, apply: (f) => ({ ...f, trigger: { ...f.trigger, offset: { ...meta.offset!.default } } }) },
      })
    }
  }

  if (flow.trigger.type === 'low_fill') {
    const fill = flow.trigger.fillBelow
    if (fill === undefined || !Number.isFinite(fill) || fill <= 0 || fill > 100) {
      add({
        code: 'trigger-fill',
        severity: 'blocker',
        text: 'Choose how empty a time slot has to be before this starts, for example under 50% full.',
        fix: { label: 'Use under 50% full', apply: (f) => ({ ...f, trigger: { ...f.trigger, fillBelow: 50 } }) },
      })
    }
  }

  if (flow.trigger.reach === 'audience' && subject === 'departure') {
    const audience = ctx.audiences?.find((entry) => entry.id === flow.trigger.audienceId)
    if (!flow.trigger.audienceId || (ctx.audiences && !audience)) {
      add({
        code: 'trigger-audience',
        severity: 'blocker',
        text: flow.trigger.audienceId
          ? 'The audience this goes to no longer exists. Pick another one.'
          : 'Pick the audience this goes to.',
        fix: {
          label: flow.trigger.type === 'weather_alert' ? 'Send to guests booked on it' : 'Send to past guests of that activity',
          apply: (f) => ({ ...f, trigger: { ...f.trigger, reach: f.trigger.type === 'weather_alert' ? 'booked_guests' : 'past_guests_of_activity', audienceId: undefined } }),
        },
      })
    }
  }

  // An older automation's own audience that could not be carried over: the engine only reads an
  // audience on seat and weather starts, so anywhere else it would quietly reach everyone.
  if (flow.trigger.audienceId && subject !== 'departure') {
    const audience = ctx.audiences?.find((entry) => entry.id === flow.trigger.audienceId)
    add({
      code: 'trigger-audience-lost',
      severity: 'blocker',
      text: `This was for ${audience ? `the “${audience.name}” audience` : 'an audience that no longer exists'}, which can’t be used with this start, so it would reach everyone. Set who can enter instead, then let the old audience go.`,
      fix: { label: 'I’ve set who can enter: let it go', apply: (f) => ({ ...f, trigger: { ...f.trigger, audienceId: undefined } }) },
    })
  }

  if (mustBeMarketing(flow.trigger) && !marketing) {
    add({
      code: 'purpose-marketing',
      severity: 'blocker',
      text: 'This reaches guests about something they haven’t booked, so it counts as marketing. Switch it to Marketing so only guests who agreed to hear from you get it.',
      fix: { label: 'Switch to Marketing', apply: switchToMarketing },
    })
  }

  if (meta.volume === 'none') {
    add({
      code: 'trigger-volume',
      severity: 'warning',
      text: 'This only starts when someone on your team adds a guest, so it won’t run on its own and the numbers here will stay at zero.',
    })
  } else if (meta.volume === 'low') {
    add({
      code: 'trigger-volume',
      severity: 'warning',
      text: `“${meta.short}” doesn’t happen often, so expect only a handful of guests and small numbers here.`,
    })
  }

  if (marketing && ctx.marketingPaused) {
    add({
      code: 'marketing-paused',
      severity: 'warning',
      text: 'Marketing is paused in Marketing settings, so nothing from this automation will go until you resume it.',
    })
  }

  /* ---------- who can enter ---------- */

  const checkConditions = (conditions: Condition[], branchId?: string) => {
    const where = branchId ? 'branch' : 'who'
    for (const c of conditions) {
      const field = fieldMeta(c.field)
      const stepId = branchId
      const place = branchId ? `${capitalize(nameOf(branchId))} checks` : 'Who can enter checks'
      if (!field.subjects.some((one) => subjects.includes(one))) {
        add({
          code: `condition-subject-${c.id}`,
          severity: 'blocker',
          stepId,
          text: `${place} “${field.label}”, but this automation starts from ${SUBJECT_WORD[subject]}, so there is nothing to check it against.`,
          fix: { label: 'Remove that check', apply: removeCondition(c.id, branchId) },
        })
        continue
      }
      if (!fieldFits(c.field, subject, where)) {
        add({
          code: `condition-flow-${c.id}`,
          severity: 'blocker',
          text: `“${field.label}” is about what guests do once they are in the automation, so it can only be asked in an If / else step, not in who can enter.`,
          fix: { label: 'Remove that check', apply: removeCondition(c.id) },
        })
        continue
      }
      if (field.kind === 'list' || field.kind === 'enum') {
        const values = Array.isArray(c.value) ? c.value.map(String) : typeof c.value === 'string' && c.value ? [c.value] : []
        if (values.length === 0) {
          add({
            code: `condition-empty-${c.id}`,
            severity: 'blocker',
            stepId,
            text: `${place} “${field.label}” but nothing is picked yet. Pick at least one, or remove the check.`,
            fix: { label: 'Remove that check', apply: removeCondition(c.id, branchId) },
          })
        } else if (activitySlugs && field.options === 'activities') {
          const gone = values.filter((slug) => !activitySlugs.has(slug))
          if (gone.length > 0) {
            add({
              code: `condition-activity-${c.id}`,
              severity: 'warning',
              stepId,
              text: `${place} for ${gone.length === 1 ? 'an activity' : `${gone.length} activities`} you no longer have.`,
              fix: {
                label: 'Take them out',
                apply: changeCondition(c.id, branchId, (cond) => ({ ...cond, value: values.filter((slug) => activitySlugs.has(slug)) })),
              },
            })
          }
        }
      } else if (field.kind !== 'bool') {
        if (c.op === 'between') {
          const range = Array.isArray(c.value) ? c.value.map(Number) : []
          if (range.length < 2 || range.some((n) => !Number.isFinite(n))) {
            add({
              code: `condition-range-${c.id}`,
              severity: 'blocker',
              stepId,
              text: `${place} “${field.label}” between two numbers, but one of them is missing.`,
              fix: { label: 'Remove that check', apply: removeCondition(c.id, branchId) },
            })
          } else if (range[0] > range[1]) {
            // Money is stored in cents: say it the way the condition rows do.
            const shown = (n: number) => (field.kind === 'money' ? (ctx.currency ? formatCurrency(n, ctx.currency) : (n / 100).toLocaleString('en-US')) : n.toLocaleString('en-US'))
            add({
              code: `condition-range-${c.id}`,
              severity: 'warning',
              stepId,
              text: `${place} “${field.label}” between ${shown(range[0])} and ${shown(range[1])}: the smaller ${field.kind === 'money' ? 'amount' : 'number'} should come first.`,
              fix: { label: 'Swap them', apply: changeCondition(c.id, branchId, (cond) => ({ ...cond, value: [range[1], range[0]] as [number, number] })) },
            })
          }
        } else if (typeof c.value !== 'number' || !Number.isFinite(c.value)) {
          add({
            code: `condition-number-${c.id}`,
            severity: 'blocker',
            stepId,
            text: `${place} “${field.label}” but no number is set.`,
            fix: { label: 'Remove that check', apply: removeCondition(c.id, branchId) },
          })
        }
      }
    }
  }

  checkConditions(flow.who.conditions)

  /* ---------- the steps ---------- */

  if (flow.steps.length === 0) {
    add({
      code: 'no-steps',
      severity: 'blocker',
      text: 'There are no steps yet. Add an email, a text or an action for it to do.',
      fix: { label: 'Add an email', apply: (f) => appendSteps(f, [newStep('email', undefined, f.trigger)]) },
    })
  } else if (messages.length === 0 && !hasAction) {
    add({
      code: 'nothing-happens',
      severity: 'blocker',
      text: 'Nothing gets sent or done yet: there is no message and no action. Add an email, a text or an action.',
      fix: { label: 'Add an email at the end', apply: (f) => appendSteps(f, [newStep('email', undefined, f.trigger)]) },
    })
  }

  if (ctx.hasSmsNumber === false && messages.some((step) => step.type === 'sms')) {
    add({
      code: 'sms-number',
      // Never a blocker: until the business's own number is approved, texts go from the shared one.
      severity: 'tip',
      text: 'Texts go from EZRA’s shared number until your own texting number is set up in Settings → Domains & numbers.',
    })
  }

  allSteps.forEach((step, stepIndex) => {
    const name = nameOf(step.id)
    const Name = capitalize(name)

    // Details the message can't fill, or doesn't know.
    const texts = TOKEN_FIELDS(step)
    if (texts.length > 0) {
      const tokens = [...new Set(texts.flatMap(tokensIn))]
      const unknown = tokens.filter((token) => !knownTokens.has(token) && token !== '{refund_line}')
      if (unknown.length > 0) {
        add({
          code: 'unknown-detail',
          severity: 'warning',
          stepId: step.id,
          text: `${Name} has ${unknown.map(quote).join(', ')} in it, which isn’t a detail we can fill in. Guests would see it exactly as typed.`,
          fix: { label: 'Take it out', apply: stripTokens(step.id, unknown) },
        })
      }
      const unfillable = tokens.filter(cannotFill)
      if (unfillable.length > 0) {
        const labels = unfillable.map((token) => placeholderByToken(token)?.label ?? token)
        add({
          code: 'detail-subject',
          severity: 'blocker',
          stepId: step.id,
          text: `${Name} uses ${labels.join(', ')}, but this automation starts from ${SUBJECT_WORD[subject]}, so that detail would be blank.`,
          fix: { label: 'Take it out', apply: stripTokens(step.id, unfillable) },
        })
      }
      const codeBefore = allSteps.slice(0, stepIndex).some((s) => s.type === 'action' && s.action === 'give_code')
      if (!codeBefore && tokens.some((token) => token === '{offer_code}' || token === '{offer_percent}')) {
        add({
          code: 'code-missing',
          severity: 'warning',
          stepId: step.id,
          text: hasCodeStep
            ? `${Name} mentions a discount code, but the code is only made after it, so it would be blank.`
            : `${Name} mentions a discount code, but no step before it gives one, so the code would be blank.`,
          fix: { label: 'Give a 10% code before it', apply: insertBefore(step.id, () => newStep('action', 'give_code')) },
        })
      }
    }

    switch (step.type) {
      case 'email': {
        if (!step.subject.trim()) {
          add({
            code: 'email-subject',
            severity: 'blocker',
            stepId: step.id,
            text: `${Name} has no subject line. Guests decide whether to open it from the subject, so it needs one.`,
            fix: { label: 'Use a starter subject', apply: patchStep(step.id, { subject: newStep('email', undefined, flow.trigger).subject }) },
          })
        }
        if (!step.body.trim() && !step.design) {
          add({
            code: 'email-body',
            severity: 'blocker',
            stepId: step.id,
            text: `${Name} is empty. Write a few lines or design it.`,
            fix: { label: 'Use a starter letter', apply: patchStep(step.id, { body: newStep('email', undefined, flow.trigger).body }) },
          })
        } else if (!step.body.trim() && step.design) {
          add({
            code: 'email-plain',
            severity: 'tip',
            stepId: step.id,
            text: `${Name} has a design but no plain version. Add a few lines for email apps that only show plain text.`,
          })
        }
        if (step.subjectB !== undefined && step.subjectB.trim() === step.subject.trim() && step.subject.trim()) {
          add({
            code: 'email-ab-same',
            severity: 'warning',
            stepId: step.id,
            text: `${Name} tests two subject lines, but they are the same. Change the second one, or turn the test off.`,
            fix: { label: 'Turn the test off', apply: patchStep(step.id, { subjectB: undefined }) },
          })
        }
        break
      }
      case 'sms': {
        if (!step.body.trim()) {
          add({
            code: 'sms-empty',
            severity: 'blocker',
            stepId: step.id,
            text: `${Name} is empty. Write what it should say.`,
            fix: { label: 'Use a starter text', apply: patchStep(step.id, { body: newStep('sms', undefined, flow.trigger).body }) },
          })
          break
        }
        const length = smsLength(smsAsSent(step.body, marketing))
        if (length.segments > 3) {
          add({
            code: 'sms-long',
            severity: 'warning',
            stepId: step.id,
            text: `${Name} goes out as about ${length.segments} parts${length.encoding === 'unicode' ? ', because emoji or special characters make each part shorter' : ''}. Each part is charged, and long texts get cut up on some phones. Aim for 3 or fewer.`,
          })
        }
        if (marketing && !step.body.includes('{business}')) {
          add({
            code: 'sms-sender',
            severity: 'tip',
            stepId: step.id,
            text: `Start ${name} with your business name so guests know straight away who it’s from.`,
            fix: { label: 'Add your business name', apply: patchStep(step.id, { body: `{business}: ${step.body.trim()}` }) },
          })
        }
        break
      }
      case 'wait': {
        if (step.mode === 'for') {
          if (!step.duration || !(step.duration.amount > 0)) {
            add({
              code: 'wait-zero',
              severity: 'warning',
              stepId: step.id,
              text: `${Name} is set to zero, so it doesn’t wait at all.`,
              fix: { label: 'Wait 1 day', apply: patchStep(step.id, { duration: { amount: 1, unit: 'days' } }) },
            })
          } else if (daysOf(step.duration) > 60) {
            add({
              code: 'wait-long',
              severity: 'warning',
              stepId: step.id,
              text: `${Name} is over two months. Plans change in that time, so the next message may no longer fit.`,
            })
          }
        }
        if (step.mode === 'until_time' && !isClock(step.time)) {
          add({
            code: 'wait-time',
            severity: 'blocker',
            stepId: step.id,
            text: 'Choose the time of day this waits until.',
            fix: { label: 'Wait until 9:00 AM', apply: patchStep(step.id, { time: '09:00' }) },
          })
        }
        if (step.mode === 'until_before_start' && !canWaitUntilStart(flow.trigger.type)) {
          add({
            code: 'wait-start',
            severity: 'blocker',
            stepId: step.id,
            text: `${Name} waits until before the start, but when “${meta.short}” happens there is no upcoming start to count back from.`,
            fix: { label: 'Wait a set time instead', apply: patchStep(step.id, { mode: 'for', duration: step.duration && step.duration.amount > 0 ? step.duration : { amount: 1, unit: 'days' } }) },
          })
        }
        if (step.mode === 'until_event') {
          const event = step.event ?? 'booked'
          if (BOOKING_WAIT_EVENTS.includes(event) && !subjects.includes('booking')) {
            add({
              code: 'wait-event-subject',
              severity: 'blocker',
              stepId: step.id,
              text: `${Name} waits for them ${WAIT_EVENT_LABEL[event]}, but this automation starts from ${SUBJECT_WORD[subject]}, so there is nothing to watch.`,
              fix: { label: 'Wait for them to book instead', apply: patchStep(step.id, { event: 'booked' }) },
            })
          }
          if (!step.timeout || !(step.timeout.amount > 0)) {
            add({
              code: 'wait-forever',
              severity: 'warning',
              stepId: step.id,
              text: `${Name} has no limit, so guests who never do it stay stuck here for good.`,
              fix: { label: 'Give up after 3 days', apply: patchStep(step.id, { timeout: { amount: 3, unit: 'days' } }) },
            })
          } else if (daysOf(step.timeout) > 60) {
            add({
              code: 'wait-long',
              severity: 'warning',
              stepId: step.id,
              text: `${Name} waits up to more than two months. A shorter limit keeps the next message timely.`,
            })
          }
        }
        break
      }
      case 'branch': {
        if (step.when.conditions.length === 0) {
          add({
            code: 'branch-empty',
            severity: 'blocker',
            stepId: step.id,
            text: 'This If / else step has nothing to check yet, so no guest knows which way to go. Add something to check, or remove it.',
            fix: {
              label: 'Ask “Did they book?”',
              apply: patchStep(step.id, (s) => (s.type === 'branch' ? { ...s, when: { match: 'all', conditions: [{ id: newId('cond'), field: 'flow.booked', op: 'yes' }] } } : s)),
            },
          })
        } else {
          checkConditions(step.when.conditions, step.id)
        }
        if (step.yes.length === 0 && step.no.length === 0) {
          add({
            code: 'branch-paths',
            severity: 'warning',
            stepId: step.id,
            text: `${Name} has nothing on either answer, so it doesn’t change anything. Add steps under Yes or No, or remove it.`,
            fix: { label: 'Remove the question', apply: (f) => withSteps(f, removeStep(f.steps, step.id)) },
          })
        }
        break
      }
      case 'split': {
        if (step.a.length === 0 && step.b.length === 0) {
          add({
            code: 'split-empty',
            severity: 'blocker',
            stepId: step.id,
            text: 'This A/B test has nothing on either path, so there is nothing to compare. Add a version to each path, or remove the test.',
            fix: { label: 'Remove the empty test', apply: (f) => withSteps(f, removeStep(f.steps, step.id)) },
          })
        } else if (step.a.length === 0 || step.b.length === 0) {
          add({
            code: 'split-one-side',
            severity: 'warning',
            stepId: step.id,
            text: `One path of ${name} is empty. That works as a test of “something versus nothing”; if you meant to compare two versions, add the second one.`,
          })
        }
        if (!(step.percentA >= 1 && step.percentA <= 99)) {
          add({
            code: 'split-percent',
            severity: 'blocker',
            stepId: step.id,
            text: 'Set how many guests take path A, between 1% and 99%.',
            fix: { label: 'Split 50/50', apply: patchStep(step.id, { percentA: 50 }) },
          })
        }
        break
      }
      case 'action':
        checkAction(step, Name, subject, add)
        break
      case 'end':
        break
    }
  })

  /* ---------- order: back-to-back messages, codes, steps after the end ---------- */

  /*
   * Walk each path in order. prev: the last thing that happened was a
   * message, with no wait since. waited: some wait has passed since they
   * entered, so what they did (opened, clicked, booked) can be true.
   */
  const scan = (list: FlowStep[], afterMessage: boolean, waitedBefore: boolean): { prev: boolean; waited: boolean } => {
    let prev = afterMessage
    let waited = waitedBefore
    for (let index = 0; index < list.length; index += 1) {
      const step = list[index]
      if (step.type === 'branch' && step.when.conditions.some((c) => c.field.startsWith('flow.')) && (prev || !waited)) {
        add({
          code: 'branch-too-soon',
          severity: 'warning',
          stepId: step.id,
          text: prev
            ? `${capitalize(nameOf(step.id))} is asked straight after a message, before guests have had a chance to open it, click or book, so nearly everyone takes the No path. Add a wait before it.`
            : `${capitalize(nameOf(step.id))} is asked before any wait, so guests haven’t had time to do anything yet and everyone takes the No path. Add a wait before it.`,
          fix: { label: 'Add a 2 day wait before it', apply: insertBefore(step.id, () => newStep('wait')) },
        })
      }
      if (step.type === 'end') {
        const after = list.slice(index + 1)
        if (after.length > 0) {
          add({
            code: 'after-end',
            severity: 'warning',
            stepId: after[0].id,
            text: `${after.length === 1 ? 'A step comes' : `${after.length} steps come`} after “End here”, so ${after.length === 1 ? 'it never runs' : 'they never run'}.`,
            fix: { label: 'Remove them', apply: (f) => withSteps(f, after.reduce((steps, s) => removeStep(steps, s.id), f.steps)) },
          })
        }
        return { prev: false, waited }
      }
      if (isMessage(step)) {
        if (prev) {
          add({
            code: 'back-to-back',
            severity: 'warning',
            stepId: step.id,
            text: `${capitalize(nameOf(step.id))} goes straight after another message. Two at once feels pushy; add a wait between them.`,
            fix: { label: 'Add a 1 day wait', apply: insertBefore(step.id, () => ({ ...newStep('wait'), duration: { amount: 1, unit: 'days' } })) },
          })
        }
        prev = true
      } else if (step.type === 'wait') {
        prev = false
        waited = true
      } else if (isParent(step)) {
        const ends = childPaths(step).map(([, path]) => scan(path, prev, waited))
        prev = ends.some((end) => end.prev)
        waited = ends.some((end) => end.waited)
      }
    }
    return { prev, waited }
  }
  scan(flow.steps, false, false)

  // A code that is made but never sent.
  allSteps.forEach((step, index) => {
    if (step.type !== 'action' || step.action !== 'give_code') return
    const later = allSteps.slice(index + 1).filter(isMessage)
    const sent = later.some((m) => TOKEN_FIELDS(m).some((text) => text.includes('{offer_code}')))
    if (sent) return
    const next = later[0]
    add({
      code: 'code-unsent',
      severity: 'warning',
      stepId: step.id,
      text: next
        ? `The discount code is made, but no message after it shares it. Add the code to ${nameOf(next.id)}.`
        : 'The discount code is made, but no message after it shares it, so the guest never sees it.',
      fix: next ? { label: `Add it to ${nameOf(next.id)}`, apply: addCodeLine(next.id) } : undefined,
    })
  })

  /* ---------- marketing rules ---------- */

  if (marketing && !flow.exit.onBooked) {
    add({
      code: 'exit-booked',
      severity: 'warning',
      text: 'Guests keep getting offers from this even after they book. Most businesses stop marketing as soon as the guest books.',
      fix: { label: 'Turn on “stop when they book”', apply: (f) => ({ ...f, exit: { ...f.exit, onBooked: true } }) },
    })
  }

  if (marketing && messages[0]?.type === 'sms') {
    add({
      code: 'sms-first',
      severity: 'warning',
      stepId: messages[0].id,
      text: flow.settings.channelFallback
        ? 'The first message is a text. Only guests who agreed to marketing texts get it; the rest get the email version if they agreed to email.'
        : 'The first message is a text, and only guests who agreed to marketing texts can get it. Everyone else skips it.',
      fix: flow.settings.channelFallback
        ? undefined
        : { label: 'Send an email to the rest', apply: (f) => ({ ...f, settings: { ...f.settings, channelFallback: true } }) },
    })
  }

  if (flow.settings.holdoutPercent > 30) {
    add({
      code: 'holdout-high',
      severity: 'warning',
      text: `${flow.settings.holdoutPercent}% of guests are kept out to measure it. That’s a lot of guests missing out; 10% is usually enough to tell.`,
      fix: { label: 'Keep 10% out', apply: (f) => ({ ...f, settings: { ...f.settings, holdoutPercent: 10 } }) },
    })
  }

  if (flow.settings.reentry === 'every' && !(flow.settings.reentryDays >= 1)) {
    add({
      code: 'reentry-days',
      severity: 'blocker',
      text: 'Choose how many days must pass before a guest can go through this again.',
      fix: { label: 'At most every 30 days', apply: (f) => ({ ...f, settings: { ...f.settings, reentryDays: 30 } }) },
    })
  } else if (marketing && flow.settings.reentry === 'every' && flow.settings.reentryDays < 7) {
    add({
      code: 'reentry-often',
      severity: 'warning',
      text: `A guest can go through this again every ${flow.settings.reentryDays} ${flow.settings.reentryDays === 1 ? 'day' : 'days'}. For marketing, once a month at most keeps it welcome.`,
      fix: { label: 'At most every 30 days', apply: (f) => ({ ...f, settings: { ...f.settings, reentryDays: 30 } }) },
    })
  }

  if (!(flow.settings.conversionDays >= 1)) {
    add({
      code: 'conversion-days',
      severity: 'warning',
      text: 'Bookings aren’t counted towards this automation at all. Count bookings made within a few days of a message.',
      fix: { label: 'Count bookings within 5 days', apply: (f) => ({ ...f, settings: { ...f.settings, conversionDays: 5 } }) },
    })
  }

  /* ---------- tips ---------- */

  if (marketing && messages.length === 1 && !allSteps.some((step) => step.type === 'branch')) {
    add({
      code: 'tip-follow-up',
      severity: 'tip',
      text: 'Many bookings come from a second nudge. Add a follow-up for guests who didn’t click the first time.',
      fix: {
        label: 'Add a follow-up',
        apply: (f) =>
          appendSteps(f, [
            { ...newStep('wait'), duration: { amount: 3, unit: 'days' } },
            {
              ...newStep('branch'),
              when: { match: 'all', conditions: [{ id: newId('cond'), field: 'flow.clicked', op: 'no' }] },
              yes: [
                {
                  ...newStep('email', undefined, f.trigger),
                  subject: 'In case you missed it',
                  body: 'Hi {first_name},\n\nIn case our last note got lost in your inbox, here it is again. Pick a date that suits you: {book_link}\n\nSee you soon,\n{business}',
                },
              ],
              no: [],
            },
          ]),
      },
    })
  }

  const usesCode = hasCodeStep || messages.some((m) => TOKEN_FIELDS(m).some((text) => text.includes('{offer_code}')))
  if ((flow.goal === 'come_back' || flow.trigger.type === 'lapsed') && !usesCode && messages.length > 0) {
    const first = messages[0]
    add({
      code: 'tip-winback-code',
      severity: 'tip',
      text: 'A small discount brings noticeably more guests back. Give them their own code in the first message.',
      fix: {
        label: 'Add a 15% code',
        apply: (f) => {
          const withCode = insertBefore(first.id, () => ({ ...newStep('action', 'give_code'), code: { percent: 15, validDays: 21, prefix: 'COMEBACK' } }))(f)
          return addCodeLine(first.id)(withCode)
        },
      },
    })
  }

  if (marketing && !flow.settings.smartSending && messages.length > 0) {
    add({
      code: 'tip-smart-sending',
      severity: 'tip',
      text: 'Turn on smart sending so a guest who just heard from you doesn’t get this too, and your weekly limit is kept.',
      fix: { label: 'Turn on smart sending', apply: (f) => ({ ...f, settings: { ...f.settings, smartSending: true } }) },
    })
  }

  if (!flow.settings.quietHours && messages.length > 0) {
    add({
      code: 'tip-quiet-hours',
      severity: 'tip',
      text: 'Quiet hours are off, so a message can arrive in the middle of the night. Turn them on to hold messages until morning.',
      fix: { label: 'Turn on quiet hours', apply: (f) => ({ ...f, settings: { ...f.settings, quietHours: true } }) },
    })
  }

  if (marketing && flow.settings.holdoutPercent === 0 && messages.length > 0) {
    add({
      code: 'tip-holdout',
      severity: 'tip',
      text: 'Want to know what this really adds? Keep 10% of guests out and compare how many of them book anyway.',
      fix: { label: 'Keep 10% out', apply: (f) => ({ ...f, settings: { ...f.settings, holdoutPercent: 10 } }) },
    })
  }

  const order = { blocker: 0, warning: 1, tip: 2 }
  return issues.map((issue, index) => ({ issue, index })).sort((a, b) => order[a.issue.severity] - order[b.issue.severity] || a.index - b.index).map(({ issue }) => issue)
}

function checkAction(step: ActionStep, Name: string, subject: TriggerSubject, add: (issue: Omit<FlowIssue, 'id'> & { code: string }) => void) {
  switch (step.action) {
    case 'add_tag':
    case 'remove_tag':
      if (!step.tag?.trim()) {
        add({ code: 'action-tag', severity: 'blocker', stepId: step.id, text: `Choose the tag to ${step.action === 'add_tag' ? 'add' : 'remove'}.` })
      }
      break
    case 'give_code': {
      const code = step.code
      if (!code || !(code.percent > 0) || code.percent > 100) {
        add({
          code: 'code-percent',
          severity: 'blocker',
          stepId: step.id,
          text: 'Choose how much the discount code takes off, between 1% and 100%.',
          fix: { label: 'Make it 10% off', apply: (f) => withSteps(f, updateStep(f.steps, step.id, { code: { prefix: 'THANKS', validDays: 14, ...code, percent: 10 } })) },
        })
      }
      if (code && !(code.validDays > 0)) {
        add({
          code: 'code-days',
          severity: 'blocker',
          stepId: step.id,
          text: 'Choose how many days the code stays good for.',
          fix: { label: 'Good for 14 days', apply: (f) => withSteps(f, updateStep(f.steps, step.id, { code: { ...code, validDays: 14 } })) },
        })
      }
      break
    }
    case 'notify_team':
    case 'create_task':
    case 'add_note':
      if (!step.message?.trim()) {
        const starter = newStep('action', step.action, subject).message ?? ''
        add({
          code: 'action-message',
          severity: 'blocker',
          stepId: step.id,
          text: `${Name} has nothing written. Say what your team should know or do.`,
          fix: starter ? { label: 'Use a starter line', apply: (f) => withSteps(f, updateStep(f.steps, step.id, { message: starter })) } : undefined,
        })
      }
      break
    case 'unsubscribe':
      break
  }
}

/** True when nothing blocks turning it on. */
export function canGoLive(issues: FlowIssue[]): boolean {
  return !issues.some((issue) => issue.severity === 'blocker')
}

/** Counts per severity, for the "Check" button. */
export function issueCounts(issues: FlowIssue[]): Record<FlowIssue['severity'], number> {
  return {
    blocker: issues.filter((issue) => issue.severity === 'blocker').length,
    warning: issues.filter((issue) => issue.severity === 'warning').length,
    tip: issues.filter((issue) => issue.severity === 'tip').length,
  }
}
