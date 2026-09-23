import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getActivitiesByTenant, getPickupZonesByTenant } from '@/lib/demo'
import { PickupSettingsClient } from '@/components/dashboard/settings/pickup-settings-client'

export const metadata: Metadata = {
  title: 'Pickup zones',
  description: 'Hotel pickup: the zones the shuttle covers, how early it collects and what it costs.',
}

export default async function PickupSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  const usage: Record<string, string[]> = {}
  for (const activity of getActivitiesByTenant(tenant.id)) {
    for (const id of activity.pickup?.zoneIds ?? []) (usage[id] ??= []).push(activity.name)
  }
  return <PickupSettingsClient tenant={tenant} seeded={getPickupZonesByTenant(tenant.id)} usage={usage} />
}
