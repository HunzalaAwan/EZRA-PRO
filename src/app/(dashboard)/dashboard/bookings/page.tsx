import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, TODAY_KEY, getActivitiesByTenant, getDeskRows, getLocationsByTenant } from '@/lib/demo'
import { BookingsPageClient } from '@/components/dashboard/bookings/bookings-page-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Bookings',
  description: 'Find, filter and manage every booking.',
}

/**
 * Server Component: computes the dataset on the server and hands it to the
 * client view as plain props. Passing this week and the newest bookings
 * keeps the payload lightweight (~250 KB) while preserving all filtering,
 * pagination, and interactive capabilities without browser latency.
 */
export default async function BookingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/bookings')
  const { rows: allRows, loaded } = getDeskRows(tenant.id, NOW)
  const activities = getActivitiesByTenant(tenant.id)

  return (
    <BookingsPageClient
      tenant={tenant}
      allRows={allRows}
      loaded={loaded}
      activities={activities}
      locations={getLocationsByTenant(tenant.id)}
      now={NOW}
      todayKey={TODAY_KEY}
    />
  )
}
