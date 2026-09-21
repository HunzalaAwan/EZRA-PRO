import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, TODAY_KEY, getActivitiesByTenant, getBookingRows } from '@/lib/demo'
import { BookingsPageClient } from '@/components/dashboard/bookings/bookings-page-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Bookings',
  description: 'Every reservation — search, filter and manage in one place.',
}

/**
 * Server Component: computes the dataset on the server and hands it to the
 * client view as plain props. Passing a stratified working set of ~800 rows
 * keeps the payload lightweight (~250 KB) while preserving all filtering,
 * pagination, and interactive capabilities without browser latency.
 */
export default async function BookingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/bookings')
  const allRows = getBookingRows(tenant.id, 800)
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
