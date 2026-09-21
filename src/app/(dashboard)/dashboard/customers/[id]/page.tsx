import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/dashboard/page-header'
import {
  CustomerDetail,
  type CustomerBookingEntry,
  type CustomerPaymentMethod,
  type CustomerStats,
} from '@/components/dashboard/customers/customer-detail'
import {
  CHANNEL_LABELS,
  CURRENT_USER,
  getActivityById,
  getBookingsByCustomer,
  getCustomerById,
  getPaymentsByBooking,
} from '@/lib/demo'
import { average, sum } from '@/lib/utils'
import type { Booking, Payment } from '@/types'

const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  JP: 'Japan',
  AU: 'Australia',
  DE: 'Germany',
  GB: 'United Kingdom',
  KR: 'South Korea',
  BR: 'Brazil',
  FR: 'France',
  MX: 'Mexico',
  NL: 'Netherlands',
  SG: 'Singapore',
  NZ: 'New Zealand',
  CN: 'China',
  IT: 'Italy',
  IN: 'India',
  GR: 'Greece',
  SE: 'Sweden',
  ES: 'Spain',
}

/** Offered in the tag field — the vocabulary the rest of the book already uses. */
const TAG_SUGGESTIONS = [
  'Repeat guest',
  'Honeymoon',
  'Concierge referral',
  'Group leader',
  'Photographer',
  'Dive certified',
  'Newsletter',
  'Cruise passenger',
  'Local resident',
  'Corporate',
  'Anniversary',
  'Family travel',
]

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1502680390469-be75c86b636f?auto=format&fit=crop&w=320&q=70'

interface RouteProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { id } = await params
  const customer = getCustomerById(id)
  if (!customer) return { title: 'Guest not found' }
  const name = `${customer.firstName} ${customer.lastName}`
  return {
    title: name,
    description: `Trip history, lifetime value and reviews for ${name}.`,
  }
}

function toEntry(booking: Booking): CustomerBookingEntry {
  const activity = getActivityById(booking.activityId)
  const media = activity?.media.find((item) => item.isPrimary) ?? activity?.media[0]

  return {
    id: booking.id,
    reference: booking.reference,
    activityId: booking.activityId,
    activityName: activity?.name ?? 'Removed activity',
    activityImage: media?.url ?? FALLBACK_IMAGE,
    activityAlt: media?.alt ?? activity?.name ?? 'Activity photograph',
    colorKey: activity?.colorKey ?? 'lagoon',
    departureAt: booking.departureAt,
    createdAt: booking.createdAt,
    partySize: booking.partySize,
    total: booking.total,
    amountPaid: booking.amountPaid,
    refunded: booking.refundAmount ?? 0,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    channel: booking.channel,
    channelLabel: CHANNEL_LABELS[booking.channel],
    rating: booking.rating,
    reviewText: booking.reviewText,
  }
}

/** One row per real instrument the guest has actually paid with. */
function toMethods(payments: Payment[]): CustomerPaymentMethod[] {
  const byKey = new Map<string, CustomerPaymentMethod>()

  for (const payment of payments) {
    if (payment.status !== 'succeeded' || payment.amount <= 0) continue
    const key = `${payment.method}:${payment.brand ?? 'none'}:${payment.last4 ?? 'none'}`
    const existing = byKey.get(key)

    if (existing) {
      existing.charges += 1
      existing.total += payment.amount
      if (payment.createdAt > existing.lastUsedAt) existing.lastUsedAt = payment.createdAt
      continue
    }

    byKey.set(key, {
      id: key,
      method: payment.method,
      brand: payment.brand,
      last4: payment.last4,
      lastUsedAt: payment.createdAt,
      charges: 1,
      total: payment.amount,
    })
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    // A guest who paid with a different card every trip does not need nine rows.
    .slice(0, 5)
}

export default async function CustomerDetailPage({ params }: RouteProps) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/customers')
  const { id } = await params
  const customer = getCustomerById(id)
  if (!customer || customer.tenantId !== tenant.id) notFound()

  const bookings = [...getBookingsByCustomer(customer.id)].sort((a, b) =>
    b.departureAt.localeCompare(a.departureAt),
  )

  const payments = bookings.flatMap((booking) => getPaymentsByBooking(booking.id))

  const billable = bookings.filter(
    (booking) => booking.status !== 'cancelled' && booking.status !== 'refunded',
  )
  const ratings = bookings
    .map((booking) => booking.rating)
    .filter((rating): rating is number => typeof rating === 'number')

  const createdDates = bookings.map((booking) => booking.createdAt).sort()

  const stats: CustomerStats = {
    totalBookings: customer.totalBookings,
    lifetimeValue: customer.lifetimeValue,
    avgOrderValue:
      billable.length === 0 ? 0 : Math.round(customer.lifetimeValue / billable.length),
    firstSeenAt: createdDates[0] ?? null,
    lastSeenAt: customer.lastBookingAt,
    avgRating: average(ratings),
    ratingCount: ratings.length,
    guestsHosted: sum(billable.map((booking) => booking.partySize)),
    cancellations: bookings.length - billable.length,
  }

  const fullName = `${customer.firstName} ${customer.lastName}`

  return (
    <>
      <PageHeader
        title={fullName}
        description={`${customer.totalBookings} ${customer.totalBookings === 1 ? 'trip' : 'trips'} with ${tenant.name}, ${stats.guestsHosted} ${stats.guestsHosted === 1 ? 'guest' : 'guests'} hosted.`}
        breadcrumb={[
          { label: 'Guests', href: '/dashboard/customers' },
          { label: fullName },
        ]}
      />

      <CustomerDetail
        customer={customer}
        countryName={COUNTRY_NAMES[customer.country] ?? customer.country}
        bookings={bookings.map(toEntry)}
        methods={toMethods(payments)}
        stats={stats}
        currency={tenant.currency}
        tagSuggestions={TAG_SUGGESTIONS}
        operator={{
          name: CURRENT_USER.name,
          title: CURRENT_USER.title,
          avatarUrl: CURRENT_USER.avatarUrl,
        }}
      />
    </>
  )
}
