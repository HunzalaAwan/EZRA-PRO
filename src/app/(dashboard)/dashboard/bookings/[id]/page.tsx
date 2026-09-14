import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getBookingDetail } from '@/lib/demo'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/dashboard/page-header'
import { BookingDetail } from '@/components/dashboard/bookings/booking-detail'

interface BookingPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: BookingPageProps): Promise<Metadata> {
  const { id } = await params
  const detail = getBookingDetail(id)
  if (!detail) return { title: 'Reservation not found · EZRA Pro' }
  return {
    title: `${detail.booking.reference} · ${detail.customer.firstName} ${detail.customer.lastName} · EZRA Pro`,
    description: `${detail.activity.name} · ${detail.booking.partySize} guests`,
  }
}

export default async function BookingDetailPage({ params }: BookingPageProps) {
  const { id } = await params
  const detail = getBookingDetail(id)
  if (!detail) notFound()

  const guestName = `${detail.customer.firstName} ${detail.customer.lastName}`

  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title={guestName}
        description={`${detail.activity.name} · ${detail.booking.partySize} ${
          detail.booking.partySize === 1 ? 'guest' : 'guests'
        } · booked via ${detail.booking.channel.replace(/_/g, ' ')}`}
        actions={
          <Button asChild variant="secondary" leftIcon={<ArrowLeft />}>
            <Link href="/dashboard/bookings">All reservations</Link>
          </Button>
        }
      />

      <BookingDetail detail={detail} />
    </div>
  )
}
