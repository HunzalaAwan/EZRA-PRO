import type { Metadata } from 'next'

import { CURRENT_TENANT, getBookingDetail, getRecentBookings } from '@/lib/demo'
import { BookingFlowSettingsClient } from '@/components/dashboard/settings/booking-flow-settings-client'

export const metadata: Metadata = {
  title: 'Booking flow',
  description: 'Cancellation policy, deposits, waitlists, waivers and abandoned-cart recovery.',
}

export default function BookingFlowSettingsPage() {
  const recent = getRecentBookings(CURRENT_TENANT.id, 1)[0]
  const sampleBooking = recent ? getBookingDetail(recent.id) : undefined

  return <BookingFlowSettingsClient tenant={CURRENT_TENANT} sampleBooking={sampleBooking} />
}
