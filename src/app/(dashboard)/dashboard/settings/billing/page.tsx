import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, getActivitiesByTenant, getKpis, getUsersByTenant } from '@/lib/demo'
import { BillingSettingsClient } from '@/components/dashboard/settings/billing-settings-client'

export const metadata: Metadata = {
  title: 'Billing',
  description: 'Your plan, usage and invoice history.',
}

export default async function BillingSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  const activitiesUsed = getActivitiesByTenant(tenant.id).filter(
    (a) => a.status !== 'archived',
  ).length

  return (
    <BillingSettingsClient
      tenant={tenant}
      now={NOW}
      kpis={getKpis(tenant.id, '30d')}
      seatsUsed={getUsersByTenant(tenant.id).length}
      activitiesUsed={activitiesUsed}
    />
  )
}
