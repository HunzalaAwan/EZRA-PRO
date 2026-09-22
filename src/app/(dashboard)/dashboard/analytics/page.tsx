import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getAnalytics } from '@/lib/demo'
import { getKitchenAnalytics } from '@/lib/hospitality/analytics'
import { AnalyticsShell } from '@/components/dashboard/analytics/analytics-shell'
import { KitchenAnalytics } from '@/components/dashboard/hospitality/kitchen-analytics'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analytics',
  description:
    'Revenue, channel economics, capacity utilisation, conversion and retention — with the specific changes worth making next.',
}

export default async function AnalyticsPage() {
  const { tenant, profile } = await requireWorkspaceRoute('/dashboard/analytics')
  if (profile.family === 'hospitality') return <KitchenAnalytics initialSnapshot={getKitchenAnalytics(tenant.id, '30d')} />
  return <AnalyticsShell initialSnapshot={getAnalytics(tenant.id, '30d')} />
}
