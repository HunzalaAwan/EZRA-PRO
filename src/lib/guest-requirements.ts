import type { Activity, Booking, GuestDetailsConfig, GuestFieldKey, GuestQuestion, GuestQuestionKind } from '@/types'

/* ==========================================================================
   Guest requirements — the questions an activity asks each guest (or once
   per booking), the checks that stop a booking that would not be safe, and
   the gear tally the crew preps from. Browser-safe.
   ========================================================================== */

export type QuestionPresetKey =
  | 'weight'
  | 'height'
  | 'wetsuit'
  | 'fins'
  | 'shoe'
  | 'helmet'
  | 'swim'
  | 'certification'
  | 'licence'
  | 'experience'
  | 'dietary'
  | 'medical'
  | 'dob'

export const QUESTION_PRESETS: Record<QuestionPresetKey, Omit<GuestQuestion, 'id' | 'preset'>> = {
  weight: {
    label: 'Weight',
    kind: 'number',
    scope: 'guest',
    required: true,
    unit: 'kg',
    min: 20,
    max: 130,
    help: 'For harness sizing, boat trim and board choice.',
    limitMessage: 'For safety each guest has to be between 20 and 130 kg.',
  },
  height: { label: 'Height', kind: 'number', scope: 'guest', required: true, unit: 'cm', min: 90, max: 220 },
  wetsuit: { label: 'Wetsuit size', kind: 'size', scope: 'guest', required: true, options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], gear: true },
  fins: {
    label: 'Fin size',
    kind: 'size',
    scope: 'guest',
    required: true,
    options: ['XS (EU 34–36)', 'S (EU 37–39)', 'M (EU 40–42)', 'L (EU 43–45)', 'XL (EU 46–48)'],
    gear: true,
  },
  shoe: {
    label: 'Shoe size (EU)',
    kind: 'size',
    scope: 'guest',
    required: true,
    options: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
    gear: true,
  },
  helmet: { label: 'Helmet size', kind: 'size', scope: 'guest', required: true, options: ['S', 'M', 'L', 'XL'], gear: true },
  swim: {
    label: 'Swimming ability',
    kind: 'choice',
    scope: 'guest',
    required: true,
    options: ['Confident swimmer', 'Can swim', 'Not a swimmer'],
  },
  certification: {
    label: 'Dive certification',
    kind: 'choice',
    scope: 'guest',
    required: true,
    options: ['None', 'Open Water', 'Advanced Open Water', 'Rescue Diver', 'Divemaster or higher'],
  },
  licence: {
    label: 'The driver has a boat licence or state boater card',
    kind: 'yesno',
    scope: 'booking',
    required: true,
    allowed: ['Yes'],
    limitMessage: 'A licensed driver is required. Bring the card; we check it at the beach.',
  },
  experience: {
    label: 'Experience level',
    kind: 'choice',
    scope: 'guest',
    required: true,
    options: ['First time', 'Some experience', 'Experienced'],
  },
  dietary: { label: 'Dietary needs or allergies', kind: 'text', scope: 'booking', required: false },
  medical: {
    label: 'Medical conditions we should know about',
    kind: 'text',
    scope: 'guest',
    required: false,
    help: 'Asthma, heart conditions, recent surgery, pregnancy.',
  },
  dob: { label: 'Date of birth', kind: 'date', scope: 'guest', required: true },
}

export const PRESET_ORDER: QuestionPresetKey[] = [
  'swim',
  'wetsuit',
  'fins',
  'shoe',
  'helmet',
  'weight',
  'height',
  'certification',
  'licence',
  'experience',
  'dietary',
  'medical',
  'dob',
]

export const QUESTION_KIND_LABEL: Record<GuestQuestionKind, string> = {
  text: 'Text',
  number: 'Number',
  choice: 'Choice',
  yesno: 'Yes / no',
  size: 'Size',
  date: 'Date',
}

/** A preset as a question on an activity. */
export function presetQuestion(key: QuestionPresetKey, overrides: Partial<GuestQuestion> = {}): GuestQuestion {
  return { id: `q_${key}`, preset: key, ...QUESTION_PRESETS[key], ...overrides }
}

/** Why an answer cannot be accepted, or null when it is fine. */
export function answerProblem(question: GuestQuestion, raw: string | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return question.required ? 'Required' : null
  if (question.kind === 'number') {
    const number = Number(value)
    if (!Number.isFinite(number)) return 'Enter a number'
    const tooLow = question.min !== undefined && number < question.min
    const tooHigh = question.max !== undefined && number > question.max
    if (tooLow || tooHigh) {
      return question.limitMessage ?? `Between ${question.min ?? '…'} and ${question.max ?? '…'}${question.unit ? ` ${question.unit}` : ''}`
    }
  }
  if (question.allowed && question.allowed.length > 0 && !question.allowed.includes(value)) {
    return question.limitMessage ?? 'This answer means the activity is not a fit'
  }
  return null
}

/** "M", "72 kg", "Yes". */
export function formatAnswer(question: GuestQuestion, value: string | undefined): string {
  if (!value) return ''
  return question.kind === 'number' && question.unit ? `${value} ${question.unit}` : value
}

export interface GearLine {
  questionId: string
  label: string
  counts: { option: string; count: number }[]
  total: number
}

/** Sizes to prep, per gear question, in the question's own option order. */
export function gearTally(questions: GuestQuestion[] | undefined, bookings: Pick<Booking, 'participants' | 'status'>[]): GearLine[] {
  const gear = (questions ?? []).filter((question) => question.gear)
  return gear
    .map((question) => {
      const counts = new Map<string, number>()
      for (const booking of bookings) {
        if (booking.status === 'cancelled' || booking.status === 'refunded') continue
        for (const participant of booking.participants) {
          const value = participant.answers?.[question.id]
          if (value) counts.set(value, (counts.get(value) ?? 0) + 1)
        }
      }
      const order = question.options ?? []
      const list = Array.from(counts.entries())
        .map(([option, count]) => ({ option, count }))
        .sort((a, b) => {
          const ia = order.indexOf(a.option)
          const ib = order.indexOf(b.option)
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
        })
      return { questionId: question.id, label: question.label, counts: list, total: list.reduce((sum, entry) => sum + entry.count, 0) }
    })
    .filter((line) => line.total > 0)
}

/** "S" from "S (EU 37–39)", so gear chips stay short. */
export function shortOption(option: string): string {
  return option.split(' (')[0]
}

/* --------------------------------------------------------------------------
   Guest details — what checkout asks of each guest, when the activity asks
   -------------------------------------------------------------------------- */

export const GUEST_FIELD_ORDER: GuestFieldKey[] = ['name', 'email', 'phone', 'dateOfBirth', 'country']

export const GUEST_FIELDS: Record<GuestFieldKey, { label: string; hint: string }> = {
  name: { label: 'Full name', hint: 'First and last name, for the manifest and check-in.' },
  email: { label: 'Email', hint: 'Each guest gets their own ticket and reminders.' },
  phone: { label: 'Mobile', hint: 'For day-of updates and emergencies.' },
  dateOfBirth: { label: 'Date of birth', hint: 'Works out who is under age for the waiver.' },
  country: { label: 'Country', hint: 'For park fees, permits and insurance.' },
}

export const DEFAULT_GUEST_FIELDS: GuestDetailsConfig['fields'] = [{ key: 'name', required: true }]

/** An activity with a height or weight limit has to ask every rider. */
export function riderLimited(activity: Pick<Activity, 'kind' | 'ride'>): boolean {
  return (activity.kind ?? 'trip') === 'activity' && Boolean(activity.ride?.minHeightCm || activity.ride?.maxWeightKg)
}

/**
 * The activity's guest details. Older activities without a setting ask each
 * guest when they have per-guest questions; a rider limit always does.
 */
export function guestDetailsOf(activity: Pick<Activity, 'guestDetails' | 'guestQuestions' | 'kind' | 'ride'>): GuestDetailsConfig {
  const forced = riderLimited(activity)
  if (activity.guestDetails) {
    const fields = activity.guestDetails.fields.length > 0 ? activity.guestDetails.fields : DEFAULT_GUEST_FIELDS
    return { enabled: activity.guestDetails.enabled || forced, fields }
  }
  const perGuest = (activity.guestQuestions ?? []).some((question) => question.scope === 'guest')
  return { enabled: perGuest || forced, fields: DEFAULT_GUEST_FIELDS }
}
