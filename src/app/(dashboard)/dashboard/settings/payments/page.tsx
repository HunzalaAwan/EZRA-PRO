import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, getKpis } from '@/lib/demo'
import { PaymentSettingsClient } from '@/components/dashboard/settings/payment-settings-client'

export const metadata: Metadata = {
  title: 'Payments',
  description: 'Payouts, tax and how booking fees are charged.',
}

export default async function PaymentSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  return <PaymentSettingsClient tenant={tenant} now={NOW} kpis={getKpis(tenant.id, '30d')} />
}
