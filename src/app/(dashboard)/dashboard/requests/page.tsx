import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { getActivitiesByTenant } from '@/lib/demo'
import { getSeedCharterRequests } from '@/lib/operations'
import { PageHeader } from '@/components/dashboard/page-header'
import { RequestsInbox } from '@/components/dashboard/operations/requests-inbox'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Custom requests',
  description: 'Quote requests from guests and custom invoices you send to anyone, for any activity.',
}

export default async function RequestsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/requests')
  const activities = getActivitiesByTenant(tenant.id)
    .filter((activity) => activity.status !== 'archived')
    .map((activity) => ({
      slug: activity.slug,
      name: activity.name,
      kind: activity.kind ?? 'trip',
      perGroup: activity.kind === 'charter',
      maxGuests: activity.charter?.maxGuests ?? activity.maxCapacity,
      tiers: activity.priceTiers.map((tier) => ({ id: tier.id, label: tier.label, price: tier.price })),
    }))
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Custom requests"
        description="Quote requests from guests, and custom invoices you send to anyone for any activity. Each one gets a payment link."
      />
      <RequestsInbox
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        seeded={getSeedCharterRequests(tenant.id)}
        activities={activities}
        currency={tenant.currency}
        nowIso={NOW_ISO}
      />
    </div>
  )
}
