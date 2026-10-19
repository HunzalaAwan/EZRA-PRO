import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { MarketingOverviewClient } from '@/components/dashboard/marketing/overview-client'
import { getMarketingData } from '@/lib/data/guest-marketing'
import { getMarketingOpportunities } from '@/lib/data/marketing-opportunities'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Marketing',
  description: 'What marketing brought in, what to do about the seats, guests and reviews you have right now, and every tool in one place.',
}

export default async function MarketingPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing')
  return <MarketingOverviewClient tenant={tenant} nowIso={NOW_ISO} data={getMarketingData(tenant)} opportunities={getMarketingOpportunities(tenant, NOW_ISO)} />
}
