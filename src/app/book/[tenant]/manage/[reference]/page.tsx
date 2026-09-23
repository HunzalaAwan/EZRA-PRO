import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BOOKINGS, NOW, getBookingDetail, getLocationById, getStorefront, getWaiverById } from '@/lib/demo'
import { getSeedThreads } from '@/lib/inbox'
import { buildDays } from '@/lib/storefront-availability'
import { ManageBooking } from '@/components/storefront/manage-booking'

export const metadata: Metadata = {
  title: 'Your booking',
  robots: { index: false },
}

const pad = (n: number) => String(n).padStart(2, '0')

export default async function ManageBookingPage({ params }: { params: Promise<{ tenant: string; reference: string }> }) {
  const { tenant: slug, reference } = await params
  const storefront = getStorefront(slug)
  if (!storefront) notFound()
  const { tenant } = storefront
  const booking = BOOKINGS.find((entry) => entry.tenantId === tenant.id && entry.reference === reference.toUpperCase())
  const detail = booking ? getBookingDetail(booking.id) : undefined

  if (!detail) {
    return <ManageBooking notFoundReference={reference} tenant={{ slug: tenant.slug, name: tenant.name, phone: tenant.contact.phone, currency: tenant.currency }} />
  }

  const { activity, departure, customer } = detail
  const site = departure.locationId ? getLocationById(departure.locationId) : undefined
  const siteMeeting = activity.locations.find((entry) => entry.locationId === departure.locationId)?.meetingPoint
  const thread = getSeedThreads(tenant.id).find((entry) => entry.reference === detail.booking.reference)
  const nowIso = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}T${pad(NOW.getHours())}:${pad(NOW.getMinutes())}:00`

  return (
    <ManageBooking
      tenant={{ slug: tenant.slug, name: tenant.name, phone: tenant.contact.phone, currency: tenant.currency }}
      booking={{
        id: detail.booking.id,
        reference: detail.booking.reference,
        status: detail.booking.status,
        partySize: detail.booking.partySize,
        total: detail.booking.total,
        amountPaid: detail.booking.amountPaid,
        answers: detail.booking.answers ?? {},
        pickup: detail.booking.pickup,
        participants: detail.booking.participants.map((participant) => ({
          id: participant.id,
          firstName: participant.firstName,
          lastName: participant.lastName,
          waiverSigned: participant.waiverSigned,
          answers: participant.answers ?? {},
        })),
      }}
      guest={{ firstName: customer.firstName, lastName: customer.lastName, email: customer.email, phone: customer.phone, avatarUrl: customer.avatarUrl }}
      activity={{
        slug: activity.slug,
        name: activity.name,
        image: activity.media.find((media) => media.isPrimary)?.url ?? activity.media[0]?.url ?? '',
        meetingPoint: siteMeeting ?? activity.meetingPoint,
        locationName: site?.name,
        freeCancellationHours: activity.cancellationPolicy.freeCancellationHours,
        lateRefundPercent: activity.cancellationPolicy.lateRefundPercent,
        pricePerGuest: activity.priceTiers[0]?.price ?? 0,
        guestQuestions: activity.guestQuestions ?? [],
        kind: activity.kind ?? 'trip',
      }}
      departure={{ id: departure.id, startsAt: departure.startsAt, endsAt: departure.endsAt, seatsLeft: Math.max(0, departure.capacity - departure.booked - departure.held) }}
      waiver={getWaiverById(activity.waiverId)}
      days={buildDays(activity, 30)}
      thread={thread}
      nowIso={nowIso}
    />
  )
}
