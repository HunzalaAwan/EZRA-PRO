import type { Metadata } from 'next'

import { CURRENT_TENANT, NOW, getActivitiesByTenant, getDeparturesInRange, getResourcesByTenant } from '@/lib/demo'
import { addDays } from '@/lib/utils'
import { ResourcesPageClient, type ResourceImage } from '@/components/dashboard/resources/resources-page-client'
import {
  deriveResourceDependents,
  deriveUpcomingResourceRuns,
  deriveUpcomingResourceUse,
} from '@/components/dashboard/resources/derive'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Resources',
  description: 'Your inventory: vessels, vehicles, kit and rooms — what is in service, what is down, and what runs on each.',
}

export default function ResourcesPage() {
  const activities = getActivitiesByTenant(CURRENT_TENANT.id)
  const upcomingDepartures = getDeparturesInRange(CURRENT_TENANT.id, NOW, addDays(NOW, 13))
  const dependents = deriveResourceDependents(activities)

  // Until an operator uploads a photo of the boat itself, the card shows the
  // experience that runs on it — the lead image of the first activity that
  // requires the resource.
  const imageFallbacks: Record<string, ResourceImage> = {}
  for (const [resourceId, dependentActivities] of Object.entries(dependents)) {
    const media =
      dependentActivities.flatMap((a) => a.media).find((m) => m.isPrimary && m.type === 'image') ??
      dependentActivities[0]?.media.find((m) => m.type === 'image')
    if (media) imageFallbacks[resourceId] = { url: media.url, alt: media.alt }
  }

  return (
    <ResourcesPageClient
      tenant={CURRENT_TENANT}
      initialResources={getResourcesByTenant(CURRENT_TENANT.id)}
      dependents={dependents}
      upcomingUse={deriveUpcomingResourceUse(upcomingDepartures)}
      upcomingRuns={deriveUpcomingResourceRuns(upcomingDepartures, activities)}
      imageFallbacks={imageFallbacks}
    />
  )
}
