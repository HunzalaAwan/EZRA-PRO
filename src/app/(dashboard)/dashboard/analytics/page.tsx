import type { Metadata } from 'next'

import { CURRENT_TENANT, getAnalytics } from '@/lib/demo'
import { AnalyticsShell } from '@/components/dashboard/analytics/analytics-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Analytics',
  description:
    'Revenue, channel economics, capacity utilisation, conversion and retention — with the specific changes worth making next.',
}

export default function AnalyticsPage() {
  return <AnalyticsShell initialSnapshot={getAnalytics(CURRENT_TENANT.id, '30d')} />
}
