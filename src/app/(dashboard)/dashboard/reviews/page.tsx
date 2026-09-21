import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { PageHeader } from '@/components/dashboard/page-header'
import {
  RatingSummary,
  type RatingDistributionBucket,
  type RatingTrendPoint,
} from '@/components/dashboard/reviews/rating-summary'
import {
  ReviewsList,
  ReviewsPageActions,
  type ReviewActivityOption,
  type ReviewItem,
} from '@/components/dashboard/reviews/reviews-list'
import { CHANNEL_LABELS, CURRENT_USER, NOW, getBookingRows } from '@/lib/demo'
import { addDays, average, formatDateShort, startOfWeek, toDateKey } from '@/lib/utils'
import type { BookingRow } from '@/lib/demo'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reviews',
  description:
    'Every rating your guests have left, the trend behind the score, and the low ratings still waiting on a reply.',
}

/** How many reviews travel to the browser. The summary is computed over all of them. */
const WORKING_SET = 500
const TREND_WEEKS = 16
const DAY_MS = 86_400_000

function buildTrend(rated: BookingRow[]): RatingTrendPoint[] {
  const firstWeekStart = addDays(startOfWeek(NOW), -7 * (TREND_WEEKS - 1))
  const firstMs = firstWeekStart.getTime()

  const buckets = Array.from({ length: TREND_WEEKS }, (_, index) => {
    const start = addDays(firstWeekStart, index * 7)
    return { key: toDateKey(start), label: formatDateShort(start), sum: 0, count: 0 }
  })

  for (const row of rated) {
    const rating = row.booking.rating
    if (typeof rating !== 'number') continue
    const days = Math.round((new Date(row.booking.departureAt).getTime() - firstMs) / DAY_MS)
    if (days < 0) continue
    const week = Math.floor(days / 7)
    if (week >= TREND_WEEKS) continue
    buckets[week].sum += rating
    buckets[week].count += 1
  }

  return buckets
    .filter((bucket) => bucket.count > 0)
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      average: bucket.sum / bucket.count,
      count: bucket.count,
    }))
}

function buildActivityOptions(rated: BookingRow[]): ReviewActivityOption[] {
  const byActivity = new Map<string, { name: string; count: number; sum: number }>()

  for (const row of rated) {
    const rating = row.booking.rating
    if (typeof rating !== 'number') continue
    const entry = byActivity.get(row.activity.id)
    if (entry) {
      entry.count += 1
      entry.sum += rating
    } else {
      byActivity.set(row.activity.id, { name: row.activity.name, count: 1, sum: rating })
    }
  }

  return Array.from(byActivity.entries())
    .map(([id, entry]) => ({
      id,
      name: entry.name,
      count: entry.count,
      average: entry.sum / entry.count,
    }))
    .sort((a, b) => b.count - a.count)
}

function toReviewItem(row: BookingRow): ReviewItem {
  const { booking, activity, customer } = row
  return {
    id: booking.id,
    reference: booking.reference,
    guestId: customer.id,
    guestName: `${customer.firstName} ${customer.lastName}`,
    guestAvatar: customer.avatarUrl,
    countryCode: customer.country,
    rating: booking.rating ?? 0,
    text: booking.reviewText,
    activityId: activity.id,
    activityName: activity.name,
    colorKey: activity.colorKey,
    departureAt: booking.departureAt,
    channelLabel: CHANNEL_LABELS[booking.channel],
    partySize: booking.partySize,
    total: booking.total,
  }
}

export default async function ReviewsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/reviews')
  const rows = getBookingRows(tenant.id)

  const rated = rows
    .filter((row) => typeof row.booking.rating === 'number')
    .sort((a, b) => b.booking.departureAt.localeCompare(a.booking.departureAt))

  const ratings = rated.map((row) => row.booking.rating as number)
  const total = ratings.length
  const mean = average(ratings)

  const distribution: RatingDistributionBucket[] = [5, 4, 3, 2, 1].map((star) => {
    const count = ratings.filter((value) => value === star).length
    return { rating: star, count, share: total === 0 ? 0 : (count / total) * 100 }
  })

  /* ---- 30 days vs the 30 before, attributed to the departure date ---- */
  const nowMs = NOW.getTime()
  const cut30 = nowMs - 30 * DAY_MS
  const cut60 = nowMs - 60 * DAY_MS

  const recent: number[] = []
  const previous: number[] = []
  for (const row of rated) {
    const at = new Date(row.booking.departureAt).getTime()
    const rating = row.booking.rating as number
    if (at >= cut30) recent.push(rating)
    else if (at >= cut60) previous.push(rating)
  }

  const recentMean = average(recent)
  const previousMean = average(previous)
  const deltaPercent =
    previousMean === 0 ? 0 : ((recentMean - previousMean) / previousMean) * 100

  const completed = rows.filter((row) => row.booking.status === 'completed').length
  const reviewRate = completed === 0 ? 0 : (total / completed) * 100
  const withComments = rated.filter((row) => Boolean(row.booking.reviewText)).length

  const workingSet = rated.slice(0, WORKING_SET)
  const needsAttention = workingSet.filter((row) => (row.booking.rating as number) <= 3).length

  /* ---- guests who travelled recently and have not rated yet ---- */
  const cut14 = nowMs - 14 * DAY_MS
  const pendingRequests = rows.filter((row) => {
    if (row.booking.status !== 'completed') return false
    if (typeof row.booking.rating === 'number') return false
    return new Date(row.booking.departureAt).getTime() >= cut14
  }).length

  return (
    <>
      <PageHeader
        title="Reviews"
        description={`${mean.toFixed(2)} stars across ${total.toLocaleString('en-US')} rated trips. ${needsAttention} recent low ratings are still waiting on a reply.`}
        actions={<ReviewsPageActions pendingCount={pendingRequests} />}
      />

      <div className="space-y-5">
        <RatingSummary
          average={mean}
          total={total}
          withComments={withComments}
          distribution={distribution}
          trend={buildTrend(rated)}
          deltaPercent={deltaPercent}
          comparisonLabel="Score change vs the previous 30 days"
          needsAttention={needsAttention}
          reviewRate={reviewRate}
        />

        <ReviewsList
          reviews={workingSet.map(toReviewItem)}
          totalCount={total}
          activities={buildActivityOptions(rated)}
          currency={tenant.currency}
          operator={{
            name: CURRENT_USER.name,
            title: CURRENT_USER.title,
            avatarUrl: CURRENT_USER.avatarUrl,
          }}
        />
      </div>
    </>
  )
}
