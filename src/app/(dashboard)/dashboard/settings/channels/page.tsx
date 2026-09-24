import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { ChannelsSettingsClient } from '@/components/dashboard/settings/channels-settings-client'

export const metadata: Metadata = {
  title: 'Domains & numbers',
  description: 'Send email from your own domain, put the storefront on your own web address, and text and take calls on a business number.',
}

export default async function ChannelsSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  return <ChannelsSettingsClient tenant={tenant} />
}
