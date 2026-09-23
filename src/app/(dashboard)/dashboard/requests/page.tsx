import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { getActivitiesByTenant } from '@/lib/demo'
import { getSeedCharterRequests } from '@/lib/operations'
import { PageHeader } from '@/components/dashboard/page-header'
import { RequestsInbox } from '@/components/dashboard/operations/requests-inbox'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Charter requests',
  description: 'Private charter enquiries: quote them, send a payment link, see the deposit land.',
}

export default async function RequestsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/requests')
  const activities = getActivitiesByTenant(tenant.id)
    .filter((activity) => activity.kind === 'charter')
    .map((activity) => ({
      slug: activity.slug,
      name: activity.name,
      maxGuests: activity.charter?.maxGuests ?? activity.maxCapacity,
      tiers: activity.priceTiers.map((tier) => ({ id: tier.id, label: tier.label, price: tier.price })),
    }))
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Charter requests"
        description="Guests send their plan from a request-to-book charter. Quote it, send the payment link, and the deposit confirms it."
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
