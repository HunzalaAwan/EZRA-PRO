import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'
import Link from 'next/link'

import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'

import { getUsersByTenant, getLocationsByTenant, getWaiversByTenant, getPickupZonesByTenant } from '@/lib/demo'
import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { ActivityWizard } from '@/components/dashboard/activities/activity-wizard'
import { packageOptionsFor, suggestOptionsFor } from '@/components/dashboard/activities/activity-data'

export const metadata: Metadata = {
  title: 'New activity',
  description: 'Create a bookable activity — pricing, media, schedule and storefront copy.',
}

export default async function NewActivityPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/activities')
  const crew = getUsersByTenant(tenant.id)
    .filter((user) => user.isBookable)
    .map((user) => ({ id: user.id, name: user.name, title: user.title, avatarUrl: user.avatarUrl }))
  return (
    <div className="flex flex-col">
      <PageHeader
        breadcrumb={[
          { label: 'Activities', href: '/dashboard/activities' },
          { label: 'New activity' },
        ]}
        title="New activity"
        description={`A few short steps to a bookable activity on the ${tenant.name} storefront. Your progress is kept if you step away.`}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard/activities">Back to activities</Link>
          </Button>
        }
      />

      <ActivityWizard
        currency={tenant.currency}
        tenantName={tenant.name}
        businessPhone={tenant.contact.phone}
        tenantSlug={tenant.slug}
        defaultCategory={tenant.vertical}
        nowIso={NOW_ISO}
        crew={crew}
        locations={getLocationsByTenant(tenant.id)}
        waivers={getWaiversByTenant(tenant.id).map((waiver) => ({ id: waiver.id, title: waiver.title }))}
        packageOptions={packageOptionsFor(tenant.id)}
        suggestOptions={suggestOptionsFor(tenant.id)}
        tenantId={tenant.id}
        pickupZones={getPickupZonesByTenant(tenant.id).map((zone) => ({ id: zone.id, name: zone.name, detail: `${zone.offsetMinutes} min before · ${zone.stops.length} stops`, fee: zone.fee }))}
      />
    </div>
  )
}
