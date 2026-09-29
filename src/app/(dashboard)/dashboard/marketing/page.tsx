import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { MarketingOverviewClient } from '@/components/dashboard/marketing/overview-client'
import { getMarketingData } from '@/lib/data/guest-marketing'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Marketing',
  description: 'What marketing earned, every tool with its switch, and what to try next.',
}

export default async function MarketingPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing')
  return <MarketingOverviewClient tenant={tenant} nowIso={NOW_ISO} data={getMarketingData(tenant)} />
}
