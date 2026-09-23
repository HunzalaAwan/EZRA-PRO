import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { getGuideDays } from '@/lib/operations'
import { PageHeader } from '@/components/dashboard/page-header'
import { MyDay } from '@/components/dashboard/operations/my-day'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'My day',
  description: 'A guide’s departures today with meeting points, guests, gear, notes and certifications.',
}

export default async function MyDayPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/my-day')
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="My day"
        description="Everything a guide needs for today, in order: where to meet, who is coming, what gear to pull and what to watch for."
      />
      <MyDay guides={getGuideDays(tenant.id)} nowIso={NOW_ISO} />
    </div>
  )
}
