import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { getActivitiesByTenant } from '@/lib/demo'
import { buildDays } from '@/lib/storefront-availability'
import { PageHeader } from '@/components/dashboard/page-header'
import { WalkInSale, type WalkInActivity } from '@/components/dashboard/operations/walk-in-sale'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Walk-in sale',
  description: 'Sell a trip, rental or pass at the desk: pick the time, the guests, take cash or card, print the ticket.',
}

export default async function WalkInPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/walk-in')
  const activities: WalkInActivity[] = getActivitiesByTenant(tenant.id)
    .filter((activity) => activity.status === 'live' && activity.category !== 'restaurants')
    .map((activity) => ({
      slug: activity.slug,
      name: activity.name,
      kind: activity.kind ?? 'trip',
      image: activity.media.find((media) => media.isPrimary)?.url ?? activity.media[0]?.url ?? '',
      tiers: activity.priceTiers.map((tier) => ({ id: tier.id, label: tier.label, price: tier.price, max: tier.maxQuantity, seat: tier.countsTowardCapacity })),
      addOns: activity.addOns.map((addOn) => ({ id: addOn.id, label: addOn.label, price: addOn.price })),
      slots: buildDays(activity, 2).flatMap((day) =>
        day.slots
          .filter((slot) => slot.startsAt >= NOW_ISO.slice(0, 13) && !slot.soldOut)
          .map((slot) => ({ id: slot.departureId, startsAt: slot.startsAt, seatsLeft: slot.seatsLeft })),
      ),
    }))
    .filter((activity) => activity.slots.length > 0)
  return (
    <div className="flex flex-col gap-5 pb-16 print:gap-2">
      <PageHeader
        className="mb-0 print:hidden"
        title="Walk-in sale"
        description="For guests at the desk: pick the activity and time, the guests and extras, take cash or card and print the ticket."
      />
      <WalkInSale tenantSlug={tenant.slug} tenantName={tenant.name} currency={tenant.currency} activities={activities} nowIso={NOW_ISO} />
    </div>
  )
}
