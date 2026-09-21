import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getBookingDetail, getRecentBookings } from '@/lib/demo'
import { BookingFlowSettingsClient } from '@/components/dashboard/settings/booking-flow-settings-client'

export const metadata: Metadata = {
  title: 'Booking flow',
  description: 'Cancellation policy, deposits, waitlists, waivers and abandoned-cart recovery.',
}

export default async function BookingFlowSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  const recent = getRecentBookings(tenant.id, 1)[0]
  const sampleBooking = recent ? getBookingDetail(recent.id) : undefined

  return <BookingFlowSettingsClient tenant={tenant} sampleBooking={sampleBooking} />
}
