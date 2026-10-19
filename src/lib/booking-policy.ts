import type { Activity, CancellationPolicy, ChangeRules, PaymentTerms } from '@/types'

/* ==========================================================================
   Booking policy — how guests pay, what they get back when they cancel, and
   what they can change themselves. Set on each activity (Pricing step for
   payment, Booking step for cancellations and changes) and read by
   checkout, the guest's manage page and the dashboard. Browser-safe.
   ========================================================================== */

export const DEFAULT_PAYMENT: PaymentTerms = {
  collect: 'full',
  depositType: 'percent',
  depositValue: 25,
  balanceDueDays: 2,
  allowPayInFull: true,
}

export const DEFAULT_CHANGES: ChangeRules = {
  reschedule: true,
  rescheduleHours: 24,
  maxReschedules: 2,
  rescheduleFee: 0,
  addGuests: true,
  cancelOnline: true,
}

export type CancelPreset = NonNullable<CancellationPolicy['preset']>

/** The standard policies most booking sites use, plus your own. */
export const CANCEL_PRESETS: { value: CancelPreset; label: string; text: string; freeHours: number; lateRefund: number }[] = [
  { value: 'flexible', label: 'Flexible', text: 'Full refund up to 24 hours before.', freeHours: 24, lateRefund: 0 },
  { value: 'moderate', label: 'Moderate', text: 'Full refund up to 3 days before, half after that.', freeHours: 72, lateRefund: 50 },
  { value: 'strict', label: 'Strict', text: 'Full refund up to 7 days before, nothing after.', freeHours: 168, lateRefund: 0 },
  { value: 'none', label: 'Non-refundable', text: 'No refunds once booked. Moving to another time can still be allowed.', freeHours: 0, lateRefund: 0 },
  { value: 'custom', label: 'Your own', text: 'Set the hours and the refund yourself.', freeHours: 48, lateRefund: 25 },
]

export const paymentOf = (activity: Pick<Activity, 'payment'>): PaymentTerms => ({ ...DEFAULT_PAYMENT, ...activity.payment })

export const changesOf = (activity: Pick<Activity, 'changes'>): ChangeRules => ({ ...DEFAULT_CHANGES, ...activity.changes })

/** Which preset a policy matches, for older policies saved without one. */
export function presetOf(policy: Pick<CancellationPolicy, 'preset' | 'freeCancellationHours' | 'lateRefundPercent'>): CancelPreset {
  if (policy.preset) return policy.preset
  const match = CANCEL_PRESETS.find((entry) => entry.value !== 'custom' && entry.freeHours === policy.freeCancellationHours && entry.lateRefund === policy.lateRefundPercent)
  return match?.value ?? 'custom'
}

/** "24 hours", "3 days", "1 week". */
export function hoursLabel(hours: number) {
  if (hours <= 0) return 'any time'
  if (hours >= 24 && hours % 24 === 0) return hours === 24 ? '1 day' : `${hours / 24} days`
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

/** The sentence guests read, built from the numbers. */
export function policySummary(policy: Pick<CancellationPolicy, 'freeCancellationHours' | 'lateRefundPercent' | 'keepDeposit'>, payment?: PaymentTerms): string {
  const deposit = payment?.collect === 'deposit' && policy.keepDeposit ? ' The deposit is not refunded.' : ''
  if (policy.freeCancellationHours <= 0 && policy.lateRefundPercent <= 0) return `Non-refundable once booked.${deposit}`
  const after = policy.lateRefundPercent > 0 ? `After that, ${policy.lateRefundPercent}% is refunded.` : 'No refund after that.'
  return `Full refund if you cancel at least ${hoursLabel(policy.freeCancellationHours)} before the start. ${after}${deposit}`
}

/** What guests can change themselves, in one line. */
export function changesSummary(rules: ChangeRules, formatMoney: (minor: number) => string): string {
  if (!rules.reschedule) return 'Times cannot be changed online; call us and we will help.'
  const limit = rules.maxReschedules === 1 ? ', once' : rules.maxReschedules > 1 ? `, up to ${rules.maxReschedules} times` : ''
  const fee = rules.rescheduleFee > 0 ? ` for ${formatMoney(rules.rescheduleFee)}` : ' for free'
  return rules.rescheduleHours > 0 ? `Move to another time${fee}${limit}, until ${hoursLabel(rules.rescheduleHours)} before the start.` : `Move to another time${fee}${limit}, right up to the start.`
}

/** What is charged at checkout and what is left for later. */
export function splitPayment(terms: PaymentTerms, total: number, party: number, payInFull = false): { now: number; later: number } {
  if (total <= 0) return { now: 0, later: 0 }
  if (terms.collect === 'later' && !payInFull) return { now: 0, later: total }
  if (terms.collect !== 'deposit' || payInFull) return { now: total, later: 0 }
  const deposit =
    terms.depositType === 'percent'
      ? Math.round((total * Math.min(100, Math.max(0, terms.depositValue))) / 100)
      : terms.depositType === 'per_guest'
        ? terms.depositValue * Math.max(1, party)
        : terms.depositValue
  const now = Math.min(total, Math.max(0, deposit))
  return { now, later: total - now }
}

/** "25%", "$50 per guest", "$100 per booking". */
export function depositLabel(terms: PaymentTerms, formatMoney: (minor: number) => string) {
  if (terms.depositType === 'percent') return `${terms.depositValue}%`
  return `${formatMoney(terms.depositValue)} ${terms.depositType === 'per_guest' ? 'per guest' : 'per booking'}`
}

/**
 * What a guest gets back when they cancel: everything inside the free
 * window, the late percentage after it; a kept deposit never comes back.
 */
export function refundFor(policy: Pick<CancellationPolicy, 'freeCancellationHours' | 'lateRefundPercent' | 'keepDeposit'>, paid: number, hoursToGo: number, deposit = 0): number {
  const kept = policy.keepDeposit ? Math.min(paid, deposit) : 0
  const refundable = Math.max(0, paid - kept)
  const free = policy.freeCancellationHours > 0 && hoursToGo >= policy.freeCancellationHours
  return Math.round(free ? refundable : (refundable * policy.lateRefundPercent) / 100)
}
