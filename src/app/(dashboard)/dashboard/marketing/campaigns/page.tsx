import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { CampaignsClient } from '@/components/dashboard/marketing/campaigns-client'
import { getMarketingData } from '@/lib/data/guest-marketing'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Campaigns',
  description: 'One-off emails and texts to an audience, with what each one earned.',
}

export default async function CampaignsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing/campaigns')
  return <CampaignsClient tenant={tenant} nowIso={NOW_ISO} data={getMarketingData(tenant)} />
}
