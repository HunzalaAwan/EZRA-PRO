import { DEFAULT_PAYMENT, policySummary } from '@/lib/booking-policy'
import { DEFAULT_FEE_PAYER, cleanFeePayer, type FeePayer } from '@/lib/fees'
import type { Activity, BusinessClosure, CancellationPolicy, GuestQuestion, PaymentTerms, RequestReason } from '@/types'

/* ==========================================================================
   Booking defaults — the business-wide rules set in Settings → Booking flow:
   the calendar window, waitlists, what checkout asks for, the business's
   own checkout questions, the default payment and cancellation terms, and
   who pays EZRA Pro's 4% (set on Settings → Payments).
   An activity that sets its own payment or cancellation terms keeps them;
   one that follows the default reads these. Browser- and server-safe.
   ========================================================================== */

/** How a standard checkout field is asked. */
export type FieldMode = 'required' | 'optional' | 'off'

export interface CheckoutFields {
  phone: FieldMode
  country: FieldMode
  /** "Anything we should know?" */
  requests: FieldMode
}

/**
 * A request form (request to book, another date, a big group, a custom
 * quote...): name and email are always asked; the mobile number and the
 * message can be required, optional or off; the business adds its own fields.
 */
export interface RequestFormSettings {
  phone: FieldMode
  message: FieldMode
  /** The message box's hint. Empty: the built-in one for the reason. */
  messagePrompt?: string
  /** A line at the top of the form. */
  intro?: string
  fields: GuestQuestion[]
}

/** A form the business made: a titled section at checkout, on every activity or chosen ones. */
export interface CustomForm {
  id: string
  name: string
  /** A line under the title. */
  intro?: string
  fields: GuestQuestion[]
  /** Every activity, or these activity slugs. */
  appliesTo: 'all' | string[]
  enabled: boolean
}

export const REQUEST_FORM_KEYS: RequestReason[] = ['booking', 'date', 'group', 'sooner', 'quote', 'message']

export const DEFAULT_REQUEST_FORM: RequestFormSettings = { phone: 'optional', message: 'optional', fields: [] }

export interface DefaultCancellation {
  freeCancellationHours: number
  lateRefundPercent: number
  keepDeposit: boolean
}

export interface BookingDefaults {
  /** How far ahead guests can book. */
  maxAdvanceDays: number
  waitlists: boolean
  waitlistAutoPromote: boolean
  checkout: CheckoutFields
  /** The business's own checkout questions, asked once per booking on every activity. */
  questions: GuestQuestion[]
  payment: PaymentTerms
  cancellation: DefaultCancellation
  /** The business's closed days (Availability). Activities that run on closed days ignore them. */
  closures?: BusinessClosure[]
  /** Public holidays of a country close the business too, when switched on. */
  holidays?: { country: string; enabled: boolean }
  /** Who pays EZRA Pro's 4%: the business (guests pay the listed price) or the guest (a booking fee line at checkout). */
  feePayer: FeePayer
  /** The request forms, by why the guest asks. Missing: the default form. */
  requestForms: Partial<Record<RequestReason, RequestFormSettings>>
  /** The business's own checkout forms. */
  customForms: CustomForm[]
}

export const DEFAULT_CHECKOUT_FIELDS: CheckoutFields = { phone: 'required', country: 'required', requests: 'optional' }

export const DEFAULT_BOOKING_DEFAULTS: BookingDefaults = {
  maxAdvanceDays: 365,
  waitlists: true,
  waitlistAutoPromote: true,
  checkout: DEFAULT_CHECKOUT_FIELDS,
  questions: [],
  payment: DEFAULT_PAYMENT,
  cancellation: { freeCancellationHours: 24, lateRefundPercent: 0, keepDeposit: false },
  closures: [],
  feePayer: DEFAULT_FEE_PAYER,
  requestForms: {},
  customForms: [],
}

/** Closed days as saved, without broken entries or dates that aren't day keys. */
function cleanClosures(value: unknown): BusinessClosure[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return []
    const raw = entry as Partial<BusinessClosure>
    const dates = Array.isArray(raw.dates) ? raw.dates.filter((date): date is string => typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) : []
    if (dates.length === 0) return []
    return [{ id: typeof raw.id === 'string' && raw.id ? raw.id : `closure_${index}`, dates: [...new Set(dates)].sort(), reason: typeof raw.reason === 'string' ? raw.reason : '' }]
  })
}

const MODE_VALUES: FieldMode[] = ['required', 'optional', 'off']
const modeOf = (value: unknown, fallback: FieldMode): FieldMode => (MODE_VALUES.includes(value as FieldMode) ? (value as FieldMode) : fallback)
const fieldsOf = (value: unknown): GuestQuestion[] =>
  Array.isArray(value) ? value.filter((field): field is GuestQuestion => Boolean(field && typeof field === 'object' && typeof (field as GuestQuestion).id === 'string' && typeof (field as GuestQuestion).label === 'string')) : []

function cleanRequestForms(value: unknown): Partial<Record<RequestReason, RequestFormSettings>> {
  if (!value || typeof value !== 'object') return {}
  const out: Partial<Record<RequestReason, RequestFormSettings>> = {}
  for (const key of REQUEST_FORM_KEYS) {
    const raw = (value as Record<string, Partial<RequestFormSettings> | undefined>)[key]
    if (!raw || typeof raw !== 'object') continue
    out[key] = {
      phone: modeOf(raw.phone, DEFAULT_REQUEST_FORM.phone),
      message: modeOf(raw.message, DEFAULT_REQUEST_FORM.message),
      ...(typeof raw.messagePrompt === 'string' && raw.messagePrompt.trim() ? { messagePrompt: raw.messagePrompt } : {}),
      ...(typeof raw.intro === 'string' && raw.intro.trim() ? { intro: raw.intro } : {}),
      fields: fieldsOf(raw.fields),
    }
  }
  return out
}

function cleanCustomForms(value: unknown): CustomForm[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string') return []
    const form = raw as Partial<CustomForm>
    const appliesTo = Array.isArray(form.appliesTo) ? form.appliesTo.filter((slug): slug is string => typeof slug === 'string') : 'all'
    return [{ id: form.id!, name: typeof form.name === 'string' ? form.name : '', ...(typeof form.intro === 'string' && form.intro.trim() ? { intro: form.intro } : {}), fields: fieldsOf(form.fields), appliesTo, enabled: form.enabled !== false }]
  })
}

/** A request form as the business set it, or the default one. */
export function requestFormOf(defaults: BookingDefaults, reason: RequestReason): RequestFormSettings {
  return defaults.requestForms[reason] ?? DEFAULT_REQUEST_FORM
}

/** The business's own forms an activity asks at checkout: switched on, named, with fields, and for it. */
export function customFormsFor(defaults: BookingDefaults, activitySlug: string): CustomForm[] {
  return defaults.customForms.filter(
    (form) => form.enabled && form.name.trim() && form.fields.some((field) => field.label.trim()) && (form.appliesTo === 'all' || form.appliesTo.includes(activitySlug)),
  )
}

/** Stored settings over the defaults, so an older save missing a part still reads whole. */
export function normalizeDefaults(stored: Partial<BookingDefaults> | null | undefined): BookingDefaults {
  const base = DEFAULT_BOOKING_DEFAULTS
  if (!stored) return base
  return {
    ...base,
    ...stored,
    checkout: { ...base.checkout, ...stored.checkout },
    questions: Array.isArray(stored.questions) ? stored.questions : [],
    requestForms: cleanRequestForms(stored.requestForms),
    customForms: cleanCustomForms(stored.customForms),
    payment: { ...base.payment, ...stored.payment },
    cancellation: { ...base.cancellation, ...stored.cancellation },
    closures: cleanClosures(stored.closures),
    feePayer: cleanFeePayer(stored.feePayer),
    holidays:
      stored.holidays && typeof stored.holidays === 'object' && typeof stored.holidays.country === 'string' && stored.holidays.country
        ? { country: stored.holidays.country, enabled: Boolean(stored.holidays.enabled) }
        : undefined,
  }
}

/** The payment terms an activity uses: its own, or the business default. */
export function effectivePayment(activity: Pick<Activity, 'payment'>, defaults: BookingDefaults): PaymentTerms {
  if (!activity.payment || activity.payment.useDefault) return { ...defaults.payment, useDefault: true }
  return { ...DEFAULT_PAYMENT, ...activity.payment }
}

/** The cancellation policy an activity uses: its own, or the business default. */
export function effectiveCancellation(activity: Pick<Activity, 'cancellationPolicy' | 'payment'>, defaults: BookingDefaults): CancellationPolicy {
  const own = activity.cancellationPolicy
  if (!own.useDefault) return own
  const payment = effectivePayment(activity, defaults)
  const policy = { ...defaults.cancellation, preset: 'custom' as const, useDefault: true }
  return { ...policy, summary: policySummary(policy, payment) }
}

/** A policy and payment passed on their own (the guest's manage page): the defaults where they follow them. */
export function resolveTerms<P extends Pick<CancellationPolicy, 'freeCancellationHours' | 'lateRefundPercent' | 'keepDeposit' | 'summary' | 'useDefault'>>(
  terms: { policy: P; payment: PaymentTerms },
  defaults: BookingDefaults,
): { policy: P; payment: PaymentTerms } {
  const payment = terms.payment.useDefault ? { ...defaults.payment, useDefault: true } : terms.payment
  if (!terms.policy.useDefault) return { policy: terms.policy, payment }
  const policy = { ...terms.policy, ...defaults.cancellation }
  return { policy: { ...policy, summary: policySummary(policy, payment) }, payment }
}

/**
 * The activity with the business defaults filled in where it follows them,
 * and the business's own checkout questions added after its own.
 */
export function withBookingDefaults<T extends Activity>(activity: T, defaults: BookingDefaults): T {
  const own = activity.guestQuestions ?? []
  const ids = new Set(own.map((question) => question.id))
  const extra = defaults.questions.filter((question) => !ids.has(question.id)).map((question) => ({ ...question, scope: 'booking' as const }))
  // The business's own forms: each field once per booking, under the form's title.
  for (const form of customFormsFor(defaults, activity.slug)) {
    for (const field of form.fields) {
      if (!field.label.trim()) continue
      extra.push({ ...field, id: `form_${form.id}_${field.id}`, scope: 'booking' as const, section: form.name.trim(), ...(form.intro?.trim() ? { sectionNote: form.intro.trim() } : {}) })
    }
  }
  return {
    ...activity,
    payment: effectivePayment(activity, defaults),
    cancellationPolicy: effectiveCancellation(activity, defaults),
    guestQuestions: extra.length > 0 ? [...own, ...extra] : activity.guestQuestions,
  }
}
