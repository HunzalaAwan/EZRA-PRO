import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW } from '@/lib/demo'
import { GeneralSettingsClient } from '@/components/dashboard/settings/general-settings-client'

export const metadata: Metadata = {
  title: 'General',
  description: 'Business profile, contact details and workspace basics.',
}

export default async function GeneralSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  return <GeneralSettingsClient tenant={tenant} now={NOW} />
}
