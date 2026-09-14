import type { Metadata } from 'next'

import {
  CURRENT_TENANT,
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

export default function AvailabilityPage() {
  const windowDepartures = getDeparturesInRange(CURRENT_TENANT.id, addDays(NOW, -56), addDays(NOW, 56))
  const observedDepartures = getDeparturesInRange(CURRENT_TENANT.id, addDays(NOW, -90), addDays(NOW, -1))
  const activityById = new Map(getActivitiesByTenant(CURRENT_TENANT.id).map((a) => [a.id, a]))

  return (
    <AvailabilityPageClient
      tenant={CURRENT_TENANT}
      now={NOW}
      templates={deriveScheduleTemplates(windowDepartures, activityById)}
      previewByDay={getCalendarEventsByDay(CURRENT_TENANT.id, NOW, addDays(NOW, 13))}
      observedHours={deriveObservedHours(observedDepartures)}
    />
  )
}
