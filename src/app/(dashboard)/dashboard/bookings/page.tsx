import type { Metadata } from 'next'

import { CURRENT_TENANT, NOW, TODAY_KEY, getActivitiesByTenant, getBookingRows } from '@/lib/demo'
import { BookingsPageClient } from '@/components/dashboard/bookings/bookings-page-client'

export const metadata: Metadata = {
  title: 'Bookings',
  description: 'Every reservation — search, filter and manage in one place.',
}

/**
 * Server Component: computes the (large) dataset once per request on the
 * server and hands it to the client view as plain props. Keeping the
 * `@/lib/demo` value-imports here — never in a 'use client' file — is what
 * stops the entire synthetic dataset and its generation code from being
 * bundled into client-side JavaScript.
 */
export default function BookingsPage() {
  const tenant = CURRENT_TENANT
  const allRows = getBookingRows(tenant.id)
  const activities = getActivitiesByTenant(tenant.id)

  return (
    <BookingsPageClient
      tenant={tenant}
      allRows={allRows}
      activities={activities}
      now={NOW}
      todayKey={TODAY_KEY}
    />
  )
}
