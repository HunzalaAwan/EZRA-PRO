import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import {
  NOW,
  getActivitiesByTenant,
  getCalendarEventsByDay,
  getDeparturesInRange,
} from '@/lib/demo'
import { addDays } from '@/lib/utils'
import { AvailabilityPageClient } from '@/components/dashboard/availability/availability-page-client'
import { deriveObservedHours, deriveScheduleTemplates } from '@/components/dashboard/availability/derive'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Availability',
  description: 'The recurring rhythm behind your calendar, and what the next fortnight looks like.',
}

export default async function AvailabilityPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/availability')
  const windowDepartures = getDeparturesInRange(tenant.id, addDays(NOW, -56), addDays(NOW, 56))
  const observedDepartures = getDeparturesInRange(tenant.id, addDays(NOW, -90), addDays(NOW, -1))
  const activityById = new Map(getActivitiesByTenant(tenant.id).map((a) => [a.id, a]))

  return (
    <AvailabilityPageClient
      tenant={tenant}
      now={NOW}
      templates={deriveScheduleTemplates(windowDepartures, activityById)}
      previewByDay={getCalendarEventsByDay(tenant.id, NOW, addDays(NOW, 13))}
      observedHours={deriveObservedHours(observedDepartures)}
    />
  )
}
