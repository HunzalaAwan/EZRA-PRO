import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { NOW, getBookingRows, getStorefront, getLocationsByTenant } from '@/lib/demo'
import { buildDays } from '@/lib/storefront-availability'
import { addDays, clamp, toDateKey } from '@/lib/utils'
import {
  ActivityDetailView,
  type RatingBucket,
  type StorefrontReview,
} from '@/components/storefront/activity-detail-view'

/** Window used for the "booked recently" social-proof line. */
const RECENT_WINDOW_DAYS = 90

interface RouteParams {
  tenant: string
  activity: string
}

export function generateStaticParams({ params }: { params: { tenant: string } }) {
  const storefront = getStorefront(params.tenant)
  return (storefront?.activities ?? []).map((activity) => ({ activity: activity.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>
}): Promise<Metadata> {
  const { tenant: tenantSlug, activity: activitySlug } = await params
  const storefront = getStorefront(tenantSlug)
  const activity = storefront?.activities.find((item) => item.slug === activitySlug)

  if (!storefront || !activity) {
    return { title: { absolute: 'Experience not found' } }
  }

  const image = activity.media.find((m) => m.isPrimary) ?? activity.media[0]

  return {
    title: { absolute: activity.seoTitle ?? `${activity.name} · ${storefront.tenant.name}` },
    description: activity.seoDescription ?? activity.tagline,
    openGraph: {
      type: 'article',
      title: activity.name,
      description: activity.seoDescription ?? activity.tagline,
      siteName: storefront.tenant.name,
      images: image ? [{ url: image.url, alt: image.alt }] : undefined,
    },
    alternates: { canonical: `/book/${storefront.tenant.slug}/${activity.slug}` },
  }
}

/* ==========================================================================
   AVAILABILITY — CalendarEvent[] flattened into a contiguous day strip
   ========================================================================== */


/* ==========================================================================
   REVIEWS
   ========================================================================== */

function partyLabel(size: number) {
  if (size <= 1) return 'Solo traveller'
  if (size === 2) return 'Couple · 2 guests'
  if (size <= 4) return `Family · ${size} guests`
  return `Group of ${size}`
}

interface ReviewPayload {
  reviews: StorefrontReview[]
  buckets: RatingBucket[]
  recentBookings: number
}

function buildReviews(tenantId: string, activityId: string, limit: number): ReviewPayload {
  const rows = getBookingRows(tenantId)
  const counts = new Map<number, number>([
    [5, 0],
    [4, 0],
    [3, 0],
    [2, 0],
    [1, 0],
  ])
  const recentCutoff = toDateKey(addDays(NOW, -RECENT_WINDOW_DAYS))
  let recentBookings = 0

  const candidates: typeof rows = []

  for (const row of rows) {
    if (row.booking.activityId !== activityId) continue
    if (row.booking.createdAt.slice(0, 10) >= recentCutoff && row.booking.status !== 'cancelled') {
      recentBookings += 1
    }
    const rating = row.booking.rating
    if (!rating) continue
    counts.set(rating, (counts.get(rating) ?? 0) + 1)
    if (row.booking.reviewText && row.booking.reviewText.length >= 50) candidates.push(row)
  }

  candidates.sort((a, b) =>
    a.booking.departureAt < b.booking.departureAt
      ? 1
      : a.booking.departureAt > b.booking.departureAt
        ? -1
        : 0,
  )

  const reviews: StorefrontReview[] = candidates.slice(0, limit).map((row) => ({
    id: row.booking.id,
    name: `${row.customer.firstName} ${row.customer.lastName.charAt(0)}.`,
    country: row.customer.country,
    rating: row.booking.rating ?? 5,
    text: row.booking.reviewText ?? '',
    dateLabel: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
      new Date(row.booking.departureAt),
    ),
    partyLabel: partyLabel(row.booking.partySize),
  }))

  return {
    reviews,
    buckets: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: counts.get(stars) ?? 0 })),
    recentBookings,
  }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<RouteParams>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tenant: tenantSlug, activity: activitySlug } = await params
  const query = await searchParams

  const storefront = getStorefront(tenantSlug)
  if (!storefront) notFound()

  const { tenant, activities } = storefront
  const activity = activities.find((item) => item.slug === activitySlug)
  if (!activity) notFound()

  const base = `/book/${tenant.slug}`
  const days = buildDays(activity)
  const { reviews, buckets, recentBookings } = buildReviews(tenant.id, activity.id, 6)

  /* ---------- deep-link state from the hero search bar ---------- */

  const rawDate = typeof query.date === 'string' ? query.date : undefined
  const initialDateKey =
    rawDate && days.some((day) => day.dateKey === rawDate) ? rawDate : undefined

  const rawGuests = typeof query.guests === 'string' ? Number(query.guests) : NaN
  const leadTier = activity.priceTiers[0]
  const initialGuests = Number.isFinite(rawGuests)
    ? clamp(rawGuests, Math.max(leadTier.minQuantity, 1), leadTier.maxQuantity)
    : undefined

  /* ---------- related ---------- */

  const related = activities
    .filter((item) => item.id !== activity.id)
    .sort(
      (a, b) =>
        Number(b.difficulty === activity.difficulty) - Number(a.difficulty === activity.difficulty) ||
        b.rating - a.rating,
    )
    .slice(0, 3)

  return (
    <ActivityDetailView
      tenant={tenant}
      activity={activity}
      days={days}
      locations={getLocationsByTenant(tenant.id)}
      reviews={reviews}
      ratingBuckets={buckets}
      related={related}
      basePath={base}
      checkoutPath={`${base}/checkout`}
      initialDateKey={initialDateKey}
      initialGuests={initialGuests}
      recentBookings={recentBookings}
      nowIso={`${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}T${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}:00`}
    />
  )
}
