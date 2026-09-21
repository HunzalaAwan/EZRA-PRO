import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, getActivitiesByTenant, getDeparturesInRange, getResourcesByTenant } from '@/lib/demo'
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

export default async function ResourcesPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/resources')
  const activities = getActivitiesByTenant(tenant.id)
  const upcomingDepartures = getDeparturesInRange(tenant.id, NOW, addDays(NOW, 13))
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
      tenant={tenant}
      initialResources={getResourcesByTenant(tenant.id)}
      dependents={dependents}
      upcomingUse={deriveUpcomingResourceUse(upcomingDepartures)}
      upcomingRuns={deriveUpcomingResourceRuns(upcomingDepartures, activities)}
      imageFallbacks={imageFallbacks}
    />
  )
}
