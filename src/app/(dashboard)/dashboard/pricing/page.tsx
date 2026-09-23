import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { getActivitiesByTenant } from '@/lib/demo'
import { PageHeader } from '@/components/dashboard/page-header'
import { PricingClient } from '@/components/dashboard/pricing/pricing-client'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Price rules, promo codes and gift cards.',
}

export default async function PricingPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/pricing')
  const activities = getActivitiesByTenant(tenant.id)
    .filter((activity) => activity.status !== 'archived')
    .map((activity) => ({ slug: activity.slug, name: activity.name, basePrice: activity.basePrice }))
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Pricing"
        description="Rules that move the price, promo codes and gift cards. The storefront, checkout and the walk-in screen use them straight away."
      />
      <PricingClient tenantSlug={tenant.slug} currency={tenant.currency} activities={activities} nowIso={NOW_ISO} />
    </div>
  )
}
