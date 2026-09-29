import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { AutomationsClient } from '@/components/dashboard/marketing/automations-client'
import { getMarketingData, getMessageSample } from '@/lib/data/guest-marketing'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Automations',
  description: 'Emails and texts that go on their own: booking messages and the ones that bring guests back.',
}

export default async function AutomationsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing/automations')
  return <AutomationsClient tenant={tenant} nowIso={NOW_ISO} data={getMarketingData(tenant)} sample={getMessageSample(tenant)} />
}
