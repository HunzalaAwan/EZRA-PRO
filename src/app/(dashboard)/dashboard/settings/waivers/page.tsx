import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getActivitiesByTenant, getWaiversByTenant } from '@/lib/demo'
import { WaiversSettingsClient } from '@/components/dashboard/settings/waivers-settings-client'

export const metadata: Metadata = {
  title: 'Waivers & forms',
  description: 'The waivers guests sign at checkout and the questions each activity asks.',
}

export default async function WaiversSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  const activities = getActivitiesByTenant(tenant.id).filter((activity) => activity.status !== 'archived')

  const usage: Record<string, string[]> = {}
  for (const activity of activities) {
    if (!activity.waiverId) continue
    ;(usage[activity.waiverId] ??= []).push(activity.name)
  }

  return <WaiversSettingsClient tenant={tenant} seeded={getWaiversByTenant(tenant.id)} usage={usage} />
}
