import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { MarketingSettingsClient } from '@/components/dashboard/marketing/marketing-settings-client'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Marketing settings',
  description: 'Pause, sender, quiet hours, weekly limit, consent and link tracking.',
}

export default async function MarketingSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing/settings')
  return <MarketingSettingsClient tenant={tenant} nowIso={NOW_ISO} />
}
