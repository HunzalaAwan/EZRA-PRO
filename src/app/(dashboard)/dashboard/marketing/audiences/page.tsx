import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { AudiencesClient } from '@/components/dashboard/marketing/audiences-client'
import { getMarketingData } from '@/lib/data/guest-marketing'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Audiences',
  description: 'Groups of subscribed guests for campaigns and automations.',
}

export default async function AudiencesPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing/audiences')
  return <AudiencesClient tenant={tenant} nowIso={NOW_ISO} data={getMarketingData(tenant)} />
}
