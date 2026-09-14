import type { Metadata } from 'next'

import { CURRENT_TENANT, NOW, getActivitiesByTenant, getDeparturesInRange, getResourcesByTenant } from '@/lib/demo'
import { addDays } from '@/lib/utils'
import { ResourcesPageClient } from '@/components/dashboard/resources/resources-page-client'
import { deriveResourceDependents, deriveUpcomingResourceUse } from '@/components/dashboard/resources/derive'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Vessels, vehicles and equipment — what you have and what depends on it.',
}

export default function ResourcesPage() {
  const activities = getActivitiesByTenant(CURRENT_TENANT.id)
  const upcomingDepartures = getDeparturesInRange(CURRENT_TENANT.id, NOW, addDays(NOW, 13))

  return (
    <ResourcesPageClient
      tenant={CURRENT_TENANT}
      initialResources={getResourcesByTenant(CURRENT_TENANT.id)}
      dependents={deriveResourceDependents(activities)}
      upcomingUse={deriveUpcomingResourceUse(upcomingDepartures)}
    />
  )
}
