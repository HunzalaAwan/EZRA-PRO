import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getAnalytics } from '@/lib/demo'
import { AnalyticsShell } from '@/components/dashboard/analytics/analytics-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analytics',
  description:
    'Revenue, channel economics, capacity utilisation, conversion and retention — with the specific changes worth making next.',
}

export default async function AnalyticsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/analytics')
  return <AnalyticsShell initialSnapshot={getAnalytics(tenant.id, '30d')} />
}
