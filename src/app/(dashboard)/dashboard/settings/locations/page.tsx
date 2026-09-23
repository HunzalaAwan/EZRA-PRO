import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getActivitiesByTenant, getLocationsByTenant } from '@/lib/demo'
import {
  LocationsSettingsClient,
  type LocationUsage,
} from '@/components/dashboard/settings/locations-settings-client'

export const metadata: Metadata = {
  title: 'Locations',
  description: 'The bases your business runs from: addresses, time zones and which activities leave from each.',
}

export default async function LocationsSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  const seeded = getLocationsByTenant(tenant.id)

  const usage: Record<string, LocationUsage> = {}
  for (const activity of getActivitiesByTenant(tenant.id)) {
    if (activity.status === 'archived') continue
    for (const site of activity.locations) {
      const entry = usage[site.locationId] ?? (usage[site.locationId] = { count: 0, names: [] })
      entry.count += 1
      if (entry.names.length < 3) entry.names.push(activity.name)
    }
  }

  return <LocationsSettingsClient tenant={tenant} seeded={seeded} usage={usage} />
}
