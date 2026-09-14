import type { Metadata } from 'next'

import { CURRENT_TENANT, NOW, getActivitiesByTenant, getKpis, getUsersByTenant } from '@/lib/demo'
import { BillingSettingsClient } from '@/components/dashboard/settings/billing-settings-client'

export const metadata: Metadata = {
  title: 'Billing',
  description: 'Your plan, usage and invoice history.',
}

export default function BillingSettingsPage() {
  const activitiesUsed = getActivitiesByTenant(CURRENT_TENANT.id).filter(
    (a) => a.status !== 'archived',
  ).length

  return (
    <BillingSettingsClient
      tenant={CURRENT_TENANT}
      now={NOW}
      kpis={getKpis(CURRENT_TENANT.id, '30d')}
      seatsUsed={getUsersByTenant(CURRENT_TENANT.id).length}
      activitiesUsed={activitiesUsed}
    />
  )
}
