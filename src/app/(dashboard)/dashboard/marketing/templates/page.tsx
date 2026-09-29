import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { TemplatesClient } from '@/components/dashboard/marketing/templates-client'
import { getMarketingData } from '@/lib/data/guest-marketing'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Email templates',
  description: 'Your email designs and the ready-made ones to start from.',
}

export default async function EmailTemplatesPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing/templates')
  return <TemplatesClient tenant={tenant} nowIso={NOW_ISO} data={getMarketingData(tenant)} />
}
