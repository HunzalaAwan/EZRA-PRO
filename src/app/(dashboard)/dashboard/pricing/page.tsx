import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { NOW, getActivitiesByTenant, getDeparturesInRange } from '@/lib/demo'
import { PageHeader } from '@/components/dashboard/page-header'
import { PricingClient, type SlotFill } from '@/components/dashboard/pricing/pricing-client'
import { addDays } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Price rules, promo codes and gift cards.',
}

export default async function PricingPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/pricing')
  const seeded = getActivitiesByTenant(tenant.id).filter((activity) => activity.status !== 'archived')
  const activities = seeded.map((activity) => ({ slug: activity.slug, name: activity.name, basePrice: activity.basePrice }))
  // Time slots with peak or off-peak pricing, so the price check prices them as the storefront does.
  const slugById = new Map(seeded.map((activity) => [activity.id, activity.slug]))
  const peaks: Record<string, number> = {}
  // How full each time slot is, so filling-up and quiet-time changes price as on the storefront (real bookings, not carts in progress).
  const fills: Record<string, SlotFill> = {}
  for (const departure of getDeparturesInRange(tenant.id, NOW, addDays(NOW, 366))) {
    const slug = slugById.get(departure.activityId)
    if (!slug || departure.status === 'cancelled') continue
    const key = `${slug}|${departure.startsAt.slice(0, 16)}`
    fills[key] ??= { departureId: departure.id, capacity: departure.capacity, booked: departure.booked }
    if (!departure.priceMultiplier || departure.priceMultiplier === 1) continue
    peaks[key] = departure.priceMultiplier
  }
  return (
    <div className="flex flex-col gap-5 pb-16">
      <PageHeader
        className="mb-0"
        title="Pricing"
        description="Rules that move the price, promo codes and gift cards. The storefront, checkout and the walk-in screen use them straight away."
      />
      <PricingClient tenantSlug={tenant.slug} currency={tenant.currency} activities={activities} nowIso={NOW_ISO} peaks={peaks} fills={fills} />
    </div>
  )
}
