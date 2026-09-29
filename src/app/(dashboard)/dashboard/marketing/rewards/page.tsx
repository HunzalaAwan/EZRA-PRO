import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { RewardsClient } from '@/components/dashboard/marketing/rewards-client'
import { getMarketingData } from '@/lib/data/guest-marketing'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Referrals & rewards',
  description: 'Refer-a-friend credit and loyalty points.',
}

export default async function RewardsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing/rewards')
  return <RewardsClient tenant={tenant} nowIso={NOW_ISO} data={getMarketingData(tenant)} />
}
