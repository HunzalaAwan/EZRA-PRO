import type { Booking, BookingChannel, LossBreakdown } from '@/types'

/* ==========================================================================
   LOSSES — cancellations, no-shows and refunds for a set of bookings.

   Shared by both analytics builders so the numbers on the overview card and
   in the reporting layer never disagree. Everything is computed from the
   bookings that depart inside the range, whatever their status.
   ========================================================================== */

const MS_DAY = 86_400_000

const CHANNEL_NAMES: Record<BookingChannel, string> = {
  website_widget: 'Website widget',
  direct: 'Direct',
  ota: 'OTA marketplace',
  phone: 'Phone',
  walk_in: 'Walk-in',
  reseller: 'Reseller',
  concierge: 'Hotel concierge',
  google: 'Google Things to do',
}

/** What the operator kept from a booking after any refund. */
function kept(booking: Booking): number {
  const refund = booking.refundAmount ?? 0
  return booking.status === 'cancelled' ? Math.max(0, booking.amountPaid - refund) : booking.total - refund
}

function rates(rows: Booking[]) {
  const total = rows.length
  const cancelled = rows.filter((b) => b.status === 'cancelled').length
  const noShows = rows.filter((b) => b.status === 'no_show').length
  const expected = total - cancelled
  return {
    total,
    cancelled,
    noShows,
    cancellationRate: total > 0 ? (cancelled / total) * 100 : 0,
    noShowRate: expected > 0 ? (noShows / expected) * 100 : 0,
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function buildLosses(currentRows: Booking[], priorRows: Booking[]): LossBreakdown {
  const now = rates(currentRows)
  const before = rates(priorRows)

  const gone = currentRows.filter((b) => b.status === 'cancelled' || b.status === 'no_show')
  const refundedRows = currentRows.filter((b) => (b.refundAmount ?? 0) > 0)
  const refundAmount = refundedRows.reduce((acc, b) => acc + (b.refundAmount ?? 0), 0)
  const lostRevenue = gone.reduce((acc, b) => acc + Math.max(0, b.total - kept(b)), 0)
  const feesKept = currentRows.filter((b) => b.status === 'cancelled').reduce((acc, b) => acc + kept(b), 0)
  const lateCancellations = currentRows.filter(
    (b) =>
      b.status === 'cancelled' &&
      b.cancelledAt !== undefined &&
      Date.parse(b.departureAt) - Date.parse(b.cancelledAt) <= MS_DAY,
  ).length

  const reasonCounts = new Map<string, number>()
  for (const b of gone) {
    const reason = b.status === 'no_show' ? 'Did not show up' : (b.cancellationReason ?? 'No reason given')
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
  }
  const reasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 4)

  const perChannel = new Map<BookingChannel, { total: number; gone: number }>()
  for (const b of currentRows) {
    const bucket = perChannel.get(b.channel) ?? { total: 0, gone: 0 }
    bucket.total += 1
    if (b.status === 'cancelled' || b.status === 'no_show') bucket.gone += 1
    perChannel.set(b.channel, bucket)
  }
  const byChannel = [...perChannel.entries()]
    .filter(([, v]) => v.total >= 5)
    .map(([channel, v]) => ({ channel, label: CHANNEL_NAMES[channel], rate: round1((v.gone / v.total) * 100), count: v.gone }))
    .sort((x, y) => y.rate - x.rate)
    .slice(0, 4)

  return {
    total: now.total,
    cancelled: now.cancelled,
    noShows: now.noShows,
    refunded: refundedRows.length,
    refundAmount,
    lostRevenue,
    feesKept,
    cancellationRate: round1(now.cancellationRate),
    noShowRate: round1(now.noShowRate),
    cancellationRateDelta: round1(now.cancellationRate - before.cancellationRate),
    noShowRateDelta: round1(now.noShowRate - before.noShowRate),
    lateCancellations,
    reasons,
    byChannel,
  }
}
