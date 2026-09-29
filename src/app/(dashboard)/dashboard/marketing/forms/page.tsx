import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { FormsClient } from '@/components/dashboard/marketing/forms-client'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const metadata: Metadata = {
  title: 'Sign-up forms',
  description: 'The storefront pop-up, footer sign-up and checkout opt-in.',
}

export default async function FormsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/marketing/forms')
  return <FormsClient tenant={tenant} nowIso={NOW_ISO} />
}
