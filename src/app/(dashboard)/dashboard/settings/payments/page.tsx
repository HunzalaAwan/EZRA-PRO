import type { Metadata } from 'next'

import { CURRENT_TENANT, NOW, getKpis } from '@/lib/demo'
import { PaymentSettingsClient } from '@/components/dashboard/settings/payment-settings-client'

export const metadata: Metadata = {
  title: 'Payments',
  description: 'Payouts, tax and how booking fees are charged.',
}

export default function PaymentSettingsPage() {
  return <PaymentSettingsClient tenant={CURRENT_TENANT} now={NOW} kpis={getKpis(CURRENT_TENANT.id, '30d')} />
}
