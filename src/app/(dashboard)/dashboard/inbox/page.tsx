import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { getUsersByTenant } from '@/lib/demo'
import { getSeedThreads } from '@/lib/inbox'
import { PageHeader } from '@/components/dashboard/page-header'
import { InboxView } from '@/components/dashboard/operations/inbox-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Inbox',
  description: 'Two-way conversations with guests by text, email and WhatsApp, each tied to its booking.',
}

export default async function InboxPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/inbox')
  const me = getUsersByTenant(tenant.id).find((user) => !user.isBookable) ?? getUsersByTenant(tenant.id)[0]
  return (
    <div className="flex flex-col gap-5 pb-10">
      <PageHeader
        className="mb-0"
        title="Inbox"
        description="Guest conversations by text, email and WhatsApp, each tied to its booking. Messages from the guest's booking page land here."
      />
      <InboxView tenantSlug={tenant.slug} seeded={getSeedThreads(tenant.id)} nowIso={NOW_ISO} staffName={me?.name.split(' ')[0] ?? 'You'} />
    </div>
  )
}
