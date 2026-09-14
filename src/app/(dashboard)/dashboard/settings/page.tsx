import type { Metadata } from 'next'

import { CURRENT_TENANT, NOW } from '@/lib/demo'
import { GeneralSettingsClient } from '@/components/dashboard/settings/general-settings-client'

export const metadata: Metadata = {
  title: 'General',
  description: 'Business profile, contact details and workspace basics.',
}

export default function GeneralSettingsPage() {
  return <GeneralSettingsClient tenant={CURRENT_TENANT} now={NOW} />
}
