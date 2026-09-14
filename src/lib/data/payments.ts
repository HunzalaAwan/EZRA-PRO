/**
 * EZRA PRO — payments.
 *
 * One ledger row per money movement, derived from the bookings that produced
 * them. Four shapes exist:
 *
 *   succeeded  the guest paid (in full, or the deposit on a big-ticket trip)
 *   pending    the outstanding balance on a deposit booking, not yet taken
 *   failed     the card was declined — the booking is still sitting unpaid
 *   refunded   money going back out, recorded as a **negative** amount
 *
 * `netAmount` is what actually settled, so it is safe to sum without filtering:
 * captured rows carry `amount - processorFee`, and anything not captured
 * (pending, failed) carries zero. Refunds are negative on purpose, so a period
 * sum of `netAmount` is exactly what landed in the bank. Summing `amount`
 * instead means filtering on `status` yourself.
 *
 * Processor economics follow the card-industry default of 2.9% + 30c, with the
 * methods that do not touch a card network priced accordingly — a cash sale at
 * the harbour kiosk costs nothing to accept.
 */

import type { Booking, Payment } from '@/types'
import { createRng, hashSeed, rngInt, rngWeighted } from '@/lib/utils'
import { seedKey } from './constants'
import { BOOKINGS } from './bookings'

type Method = Payment['method']

/* ==========================================================================
   PROCESSOR ECONOMICS
   ========================================================================== */

interface FeeModel {
  /** Share of the transaction, e.g. 0.029 for 2.9%. */
  percent: number
  /** Flat component in minor units. */
  fixed: number
}

const FEES: Record<Method, FeeModel> = {
  card: { percent: 0.029, fixed: 30 },
  apple_pay: { percent: 0.029, fixed: 30 },
  google_pay: { percent: 0.029, fixed: 30 },
  // Bank transfers settle cheaply; cash and gift cards cost nothing to accept.
  bank_transfer: { percent: 0.008, fixed: 0 },
  cash: { percent: 0, fixed: 0 },
  gift_card: { percent: 0, fixed: 0 },
}

/** How the money arrives, by the channel that sold the booking. */
const METHOD_MIX: Record<Booking['channel'], [Method, number][]> = {
  website_widget: [
    ['card', 52],
    ['apple_pay', 24],
    ['google_pay', 11],
    ['gift_card', 7],
    ['bank_transfer', 6],
  ],
  direct: [
    ['card', 56],
    ['apple_pay', 18],
    ['google_pay', 8],
    ['gift_card', 10],
    ['bank_transfer', 8],
  ],
  google: [
    ['card', 58],
    ['apple_pay', 24],
    ['google_pay', 18],
  ],
  phone: [
    ['card', 70],
    ['bank_transfer', 16],
    ['apple_pay', 9],
    ['gift_card', 5],
  ],
  walk_in: [
    ['cash', 52],
    ['card', 30],
    ['apple_pay', 12],
    ['google_pay', 6],
  ],
  // Partner channels settle on account rather than at the point of sale.
  ota: [
    ['bank_transfer', 66],
    ['card', 34],
  ],
  reseller: [
    ['bank_transfer', 62],
    ['card', 38],
  ],
  concierge: [
    ['bank_transfer', 48],
    ['card', 44],
    ['cash', 8],
  ],
}

const CARD_BRANDS: [string, number][] = [
  ['Visa', 48],
  ['Mastercard', 32],
  ['Amex', 14],
  ['Discover', 6],
]

/** Methods that ride a card network and therefore carry a brand and last four. */
const CARD_LIKE = new Set<Method>(['card', 'apple_pay', 'google_pay'])

/* ==========================================================================
   GENERATION
   ========================================================================== */

function localIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`
}

function processorFeeFor(method: Method, amount: number): number {
  if (amount <= 0) return 0
  const model = FEES[method]
  return Math.round(amount * model.percent) + model.fixed
}

interface CardIdentity {
  brand: string
  last4: string
}

function cardIdentity(rng: () => number): CardIdentity {
  return {
    brand: rngWeighted(rng, CARD_BRANDS),
    last4: String(rngInt(rng, 0, 9999)).padStart(4, '0'),
  }
}

function buildPayments(): Payment[] {
  const rows: Payment[] = []
  let sequence = 0

  for (const booking of BOOKINGS) {
    const rng = createRng(hashSeed(seedKey('payment', booking.id)))
    const method = rngWeighted(rng, METHOD_MIX[booking.channel])
    const card = CARD_LIKE.has(method) ? cardIdentity(rng) : undefined
    const createdMs = Date.parse(booking.createdAt)

    /** Shared shape for every row this booking produces. */
    const base = {
      tenantId: booking.tenantId,
      bookingId: booking.id,
      currency: booking.currency,
      method,
      ...(card ? { last4: card.last4, brand: card.brand } : {}),
    }

    if (booking.paymentStatus === 'failed') {
      // A declined attempt still belongs in the ledger — it is what the operator
      // chases. Nothing was captured, so nothing was netted.
      rows.push({
        id: `pay_${String(++sequence).padStart(6, '0')}`,
        ...base,
        amount: booking.total,
        status: 'failed',
        processorFee: 0,
        netAmount: 0,
        createdAt: localIso(new Date(createdMs + rngInt(rng, 20, 400) * 1000)),
      })
      continue
    }

    if (booking.amountPaid > 0) {
      const fee = processorFeeFor(method, booking.amountPaid)
      rows.push({
        id: `pay_${String(++sequence).padStart(6, '0')}`,
        ...base,
        amount: booking.amountPaid,
        status: 'succeeded',
        processorFee: fee,
        netAmount: booking.amountPaid - fee,
        createdAt: localIso(new Date(createdMs + rngInt(rng, 15, 240) * 1000)),
      })
    }

    // The balance on a deposit booking is raised the day after and sits open
    // until the trip gets close.
    if (booking.paymentStatus === 'deposit_paid') {
      const balance = booking.total - booking.amountPaid
      if (balance > 0) {
        rows.push({
          id: `pay_${String(++sequence).padStart(6, '0')}`,
          ...base,
          amount: balance,
          status: 'pending',
          // Nothing has been captured yet, so nothing has settled.
          processorFee: 0,
          netAmount: 0,
          createdAt: localIso(new Date(createdMs + 86_400_000 + rngInt(rng, 0, 7200) * 1000)),
        })
      }
    }

    // Money going back out. Negative so revenue maths needs no special case.
    if (booking.refundAmount && booking.refundAmount > 0) {
      const refundedAt = booking.cancelledAt ? Date.parse(booking.cancelledAt) : createdMs + 86_400_000
      rows.push({
        id: `pay_${String(++sequence).padStart(6, '0')}`,
        ...base,
        amount: -booking.refundAmount,
        status: 'refunded',
        // Processors keep their cut on a refund; nothing comes back on the fee.
        processorFee: 0,
        netAmount: -booking.refundAmount,
        createdAt: localIso(new Date(refundedAt + rngInt(rng, 60, 5400) * 1000)),
      })
    }
  }

  return rows
}

/* ==========================================================================
   EXPORTS
   ========================================================================== */

export const PAYMENTS: Payment[] = buildPayments()

const PAYMENTS_BY_TENANT: Record<string, Payment[]> = {}
const PAYMENTS_BY_BOOKING = new Map<string, Payment[]>()
const PAYMENTS_BY_ID = new Map<string, Payment>()

for (const payment of PAYMENTS) {
  ;(PAYMENTS_BY_TENANT[payment.tenantId] ||= []).push(payment)
  const bucket = PAYMENTS_BY_BOOKING.get(payment.bookingId)
  if (bucket) bucket.push(payment)
  else PAYMENTS_BY_BOOKING.set(payment.bookingId, [payment])
  PAYMENTS_BY_ID.set(payment.id, payment)
}

export function getPaymentsByTenant(tenantId: string): Payment[] {
  return PAYMENTS_BY_TENANT[tenantId] ?? []
}

export function getPaymentsByBooking(bookingId: string): Payment[] {
  return PAYMENTS_BY_BOOKING.get(bookingId) ?? []
}

export function getPaymentById(id: string): Payment | undefined {
  return PAYMENTS_BY_ID.get(id)
}
