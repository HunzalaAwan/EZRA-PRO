import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getBookingDetail, getRecentBookings } from '@/lib/demo'
import { BookingFlowSettingsClient } from '@/components/dashboard/settings/booking-flow-settings-client'

export const metadata: Metadata = {
  title: 'Booking flow',
  description: 'Checkout fields, default payment and cancellation terms, and the calendar window.',
}

export default async function BookingFlowSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  const recent = getRecentBookings(tenant.id, 1)[0]
  const sampleBooking = recent ? getBookingDetail(recent.id) : undefined

  return <BookingFlowSettingsClient tenant={tenant} sampleBooking={sampleBooking} />
}
