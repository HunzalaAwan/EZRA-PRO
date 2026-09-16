/**
 * Payouts — settlement, batches and the balance row.
 *
 * Card volume for an experience business is released against *delivery*, not
 * against the moment the card was charged, which is also how the rest of EZRA
 * attributes revenue. So a charge settles on the day its trip runs, and money
 * for a trip that has not happened yet is neither spendable nor payable.
 *
 * Shared by the Payments page and the overview's payout card so both read the
 * same numbers. No `'use client'`: the 20k-row dataset stays on the server.
 */

import type { PayoutBalance, RevenueFeePoint } from '@/components/dashboard/payments/payout-summary'
import type { PaymentRow, PayoutBatch } from '@/components/dashboard/payments/payments-table'
import { NOW, PAYMENTS, getActivityById, getBookingById, getCustomerById } from '@/lib/demo'
import {
  addDays,
  createRng,
  hashSeed,
  percentChange,
  rngInt,
  startOfDay,
  startOfWeek,
  toDateKey,
} from '@/lib/utils'
import type { Booking, CurrencyCode, Payment } from '@/types'

/** Complete days of volume plotted on the revenue-vs-fees chart. */
export const CHART_DAYS = 42
/** Weekly settlement batches listed on the Payouts tab. */
export const PAYOUT_WEEKS = 14

const DAY_MS = 86_400_000
const REF_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Local-midnight ISO, matching the datetime format the rest of the dataset uses. */
function localIso(date: Date) {
  return `${toDateKey(date)}T00:00:00`
}

const BANK_BY_CURRENCY: Record<CurrencyCode, string> = {
  USD: 'First Hawaiian Bank',
  AUD: 'Commonwealth Bank',
  EUR: 'Piraeus Bank',
  NZD: 'ANZ New Zealand',
  GBP: 'Lloyds Bank',
  CAD: 'RBC Royal Bank',
}

/* --------------------------------------------------------------------------
   Deterministic identifiers — no Math.random, no Date.now.
   -------------------------------------------------------------------------- */

function payoutReference(key: string) {
  const rng = createRng(hashSeed(`payout:${key}`))
  const body = Array.from({ length: 12 }, () => REF_ALPHABET[Math.floor(rng() * REF_ALPHABET.length)])
  return `po_${body.join('')}`
}

export function bankLabel(tenantId: string, currency: CurrencyCode) {
  const rng = createRng(hashSeed(`bank:${tenantId}`))
  return `${BANK_BY_CURRENCY[currency]} ···· ${rngInt(rng, 1000, 9999)}`
}

/* --------------------------------------------------------------------------
   Settlement
   -------------------------------------------------------------------------- */

export interface SettledPayment {
  payment: Payment
  booking: Booking
  /** ISO datetime the funds settled — the departure. */
  settledAt: string
  settledMs: number
}

interface Bucket {
  gross: number
  fee: number
  refunds: number
  net: number
  count: number
}

function emptyBucket(): Bucket {
  return { gross: 0, fee: 0, refunds: 0, net: 0, count: 0 }
}

function addToBucket(bucket: Bucket, payment: Payment) {
  if (payment.amount >= 0) bucket.gross += payment.amount
  else bucket.refunds += -payment.amount
  bucket.fee += payment.processorFee
  bucket.net += payment.netAmount
  bucket.count += 1
}

const settledCache = new Map<string, SettledPayment[]>()

/** Every charge for the tenant whose trip has already run, newest first. */
export function buildSettled(tenantId: string): SettledPayment[] {
  const cached = settledCache.get(tenantId)
  if (cached) return cached

  const nowMs = NOW.getTime()
  const out: SettledPayment[] = []

  for (const payment of PAYMENTS) {
    if (payment.tenantId !== tenantId) continue
    const booking = getBookingById(payment.bookingId)
    if (!booking) continue
    const settledMs = new Date(booking.departureAt).getTime()
    if (settledMs > nowMs) continue
    out.push({ payment, booking, settledAt: booking.departureAt, settledMs })
  }

  out.sort((a, b) => b.settledMs - a.settledMs)
  settledCache.set(tenantId, out)
  return out
}

/** The last `CHART_DAYS` complete days — today is still in progress. */
export function buildDailyPoints(settled: SettledPayment[]): RevenueFeePoint[] {
  const lastDay = addDays(startOfDay(NOW), -1)
  const start = addDays(lastDay, -(CHART_DAYS - 1))
  const startMs = start.getTime()

  const buckets = Array.from({ length: CHART_DAYS }, (_, index) => ({
    date: toDateKey(addDays(start, index)),
    bucket: emptyBucket(),
  }))

  for (const entry of settled) {
    const index = Math.round((startOfDay(new Date(entry.settledMs)).getTime() - startMs) / DAY_MS)
    if (index < 0 || index >= CHART_DAYS) continue
    addToBucket(buckets[index].bucket, entry.payment)
  }

  return buckets.map(({ date, bucket }) => ({
    date,
    gross: bucket.gross,
    fee: bucket.fee,
    net: bucket.net,
    refunds: bucket.refunds,
    count: bucket.count,
  }))
}

export function buildPayouts(settled: SettledPayment[], destination: string): PayoutBatch[] {
  // Week 0 is the oldest listed week; the current, still-accumulating week is last.
  const firstWeekStart = addDays(startOfWeek(NOW), -7 * (PAYOUT_WEEKS - 1))
  const firstMs = firstWeekStart.getTime()
  const todayKey = toDateKey(NOW)

  const weeks = Array.from({ length: PAYOUT_WEEKS }, (_, index) => ({
    periodStart: addDays(firstWeekStart, index * 7),
    bucket: emptyBucket(),
  }))

  for (const entry of settled) {
    const days = Math.round((startOfDay(new Date(entry.settledMs)).getTime() - firstMs) / DAY_MS)
    if (days < 0) continue
    const week = Math.floor(days / 7)
    if (week >= PAYOUT_WEEKS) continue
    addToBucket(weeks[week].bucket, entry.payment)
  }

  return weeks
    .map(({ periodStart, bucket }) => {
      const periodEnd = addDays(periodStart, 6)
      // Each trip week settles on the Friday of the week that follows it.
      const paidAt = addDays(periodStart, 11)
      const paidKey = toDateKey(paidAt)
      const status: PayoutBatch['status'] =
        paidKey < todayKey ? 'paid' : paidKey === todayKey ? 'in_transit' : 'scheduled'

      return {
        id: toDateKey(periodStart),
        reference: payoutReference(toDateKey(periodStart)),
        paidAt: localIso(paidAt),
        periodStart: localIso(periodStart),
        periodEnd: localIso(periodEnd),
        transactions: bucket.count,
        gross: bucket.gross,
        fees: bucket.fee,
        refunds: bucket.refunds,
        net: bucket.net,
        status,
        destination,
      }
    })
    .filter((batch) => batch.transactions > 0)
    .reverse()
}

export function toPaymentRow(entry: SettledPayment): PaymentRow {
  const { payment, booking } = entry
  const customer = getCustomerById(booking.customerId)
  const activity = getActivityById(booking.activityId)

  return {
    id: payment.id,
    createdAt: payment.createdAt,
    settledAt: entry.settledAt,
    bookingId: booking.id,
    reference: booking.reference,
    guestId: customer?.id ?? '',
    guestName: customer ? `${customer.firstName} ${customer.lastName}` : 'Unknown guest',
    guestAvatar: customer?.avatarUrl,
    activityName: activity?.name ?? 'Removed activity',
    method: payment.method,
    brand: payment.brand,
    last4: payment.last4,
    amount: payment.amount,
    processorFee: payment.processorFee,
    netAmount: payment.netAmount,
    status: payment.status,
  }
}

/* --------------------------------------------------------------------------
   The balance row: what is spendable, what is on its way, what it cost.
   -------------------------------------------------------------------------- */

export function buildBalance(settled: SettledPayment[], payouts: PayoutBatch[], destination: string): PayoutBalance {
  const nowMs = NOW.getTime()
  const cut30 = nowMs - 30 * DAY_MS
  const cut60 = nowMs - 60 * DAY_MS

  const last30 = emptyBucket()
  const prior30 = emptyBucket()
  for (const entry of settled) {
    if (entry.settledMs >= cut30) addToBucket(last30, entry.payment)
    else if (entry.settledMs >= cut60) addToBucket(prior30, entry.payment)
  }

  const scheduled = payouts.find((batch) => batch.status === 'scheduled')
  const inTransit = payouts.find((batch) => batch.status === 'in_transit')
  const monthPrefix = toDateKey(NOW).slice(0, 7)
  const paidThisMonth = payouts.filter((batch) => batch.status === 'paid' && batch.paidAt.startsWith(monthPrefix))

  return {
    available: scheduled?.net ?? 0,
    inTransit: inTransit?.net ?? 0,
    inTransitTransactions: inTransit?.transactions ?? 0,
    paidOutThisMonth: paidThisMonth.reduce((acc, batch) => acc + batch.net, 0),
    paidOutBatches: paidThisMonth.length,
    processingFees: last30.fee,
    feeRate: last30.gross === 0 ? 0 : (last30.fee / last30.gross) * 100,
    grossLast30: last30.gross,
    grossDelta: percentChange(last30.gross, prior30.gross),
    feeDelta: percentChange(last30.fee, prior30.fee),
    nextPayoutAt: scheduled?.paidAt ?? localIso(addDays(NOW, 7)),
    nextPayoutAmount: scheduled?.net ?? 0,
    destination,
  }
}

/** Everything the Payments page and the overview card need, computed once. */
export function getPayoutBalance(tenantId: string, currency: CurrencyCode): PayoutBalance {
  const settled = buildSettled(tenantId)
  const destination = bankLabel(tenantId, currency)
  return buildBalance(settled, buildPayouts(settled, destination), destination)
}
