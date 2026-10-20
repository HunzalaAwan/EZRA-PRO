import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, TODAY_KEY, getActivitiesByTenant, getDeparturesInRange } from '@/lib/demo'
import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { AvailabilityPageClient } from '@/components/dashboard/availability/availability-page-client'
import { addDays } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Availability',
  description: 'Closed days for the whole business, and each activity’s schedule.',
}

interface AvailabilityPageProps {
  /** `?block=1` (Overview → Close a day) opens the closed-days form. */
  searchParams: Promise<{ block?: string }>
}

export default async function AvailabilityPage({ searchParams }: AvailabilityPageProps) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/availability')
  const { block } = await searchParams
  const activities = getActivitiesByTenant(tenant.id)
    .filter((activity) => activity.status === 'live')
    .sort((a, b) => a.name.localeCompare(b.name))

  // Booked time slots per day for the next year, so closing a day can say which still run.
  const bookedByDay: Record<string, number> = {}
  for (const departure of getDeparturesInRange(tenant.id, NOW, addDays(NOW, 366))) {
    if (departure.booked <= 0 || departure.status === 'cancelled' || departure.startsAt < NOW_ISO) continue
    const dateKey = departure.startsAt.slice(0, 10)
    bookedByDay[dateKey] = (bookedByDay[dateKey] ?? 0) + 1
  }

  return (
    <AvailabilityPageClient
      tenant={tenant}
      activities={activities}
      todayKey={TODAY_KEY}
      nowIso={NOW_ISO}
      bookedByDay={bookedByDay}
      openAdd={block === '1'}
    />
  )
}
