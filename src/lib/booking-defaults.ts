import { DEFAULT_PAYMENT, policySummary } from '@/lib/booking-policy'
import type { Activity, CancellationPolicy, GuestQuestion, PaymentTerms } from '@/types'

/* ==========================================================================
   Booking defaults — the business-wide rules set in Settings → Booking flow:
   the calendar window, waitlists, what checkout asks for, the business's
   own checkout questions, and the default payment and cancellation terms.
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
    payment: { ...base.payment, ...stored.payment },
    cancellation: { ...base.cancellation, ...stored.cancellation },
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
  return {
    ...activity,
    payment: effectivePayment(activity, defaults),
    cancellationPolicy: effectiveCancellation(activity, defaults),
    guestQuestions: extra.length > 0 ? [...own, ...extra] : activity.guestQuestions,
  }
}
