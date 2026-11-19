import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getActivitiesByTenant } from '@/lib/demo'
import { FormsSettingsClient } from '@/components/dashboard/settings/forms-settings-client'

export const metadata: Metadata = {
  title: 'Forms',
  description: 'Checkout, request forms and your own forms: the fields guests fill in.',
}

export default async function FormsSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  const activities = getActivitiesByTenant(tenant.id)
    .filter((activity) => activity.status !== 'archived')
    .map((activity) => ({ slug: activity.slug, name: activity.name }))

  return <FormsSettingsClient tenant={tenant} activities={activities} />
}
