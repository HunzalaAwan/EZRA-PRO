import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { getActivityById, getDeparturesInRange, getLocationsByTenant, getWaiversByTenant, getPickupZonesByTenant } from '@/lib/demo'
import { getUsersByTenant } from '@/lib/demo'
import { NOW } from '@/lib/data/constants'
import { addDays } from '@/lib/utils'
import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { ActivityWizard } from '@/components/dashboard/activities/activity-wizard'
import { packageOptionsFor } from '@/components/dashboard/activities/activity-data'

interface EditActivityPageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ step?: string | string[] }>
}

export async function generateMetadata({ params }: EditActivityPageProps): Promise<Metadata> {
  const { id } = await params
  const activity = getActivityById(id)
  if (!activity) return { title: 'Activity not found' }
  return { title: `Edit ${activity.name}`, description: activity.tagline }
}

/* ==========================================================================
   /dashboard/activities/[id]/edit — the same steps as a new activity,
   filled in from the one that exists, with the live preview beside them.
   `?step=schedule` (or photos, pricing, booking…) opens straight on a step.
   ========================================================================== */

export default async function EditActivityPage({ params, searchParams }: EditActivityPageProps) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/activities')
  const { id } = await params
  const { step } = await searchParams
  const activity = getActivityById(id)
  if (!activity) notFound()

  const crew = getUsersByTenant(tenant.id)
    .filter((user) => user.isBookable)
    .map((user) => ({ id: user.id, name: user.name, title: user.title, avatarUrl: user.avatarUrl }))

  // Upcoming time slots that already have bookings: a schedule edit that drops one is flagged, and they stay.
  const bookedSlots = getDeparturesInRange(tenant.id, NOW, addDays(NOW, 400))
    .filter((departure) => departure.activityId === activity.id && departure.booked > 0 && departure.status !== 'cancelled' && departure.startsAt >= NOW_ISO)
    .map((departure) => ({
      id: departure.id,
      startsAt: departure.startsAt,
      booked: departure.booked,
      status: departure.status,
      ...(departure.locationId ? { locationId: departure.locationId } : {}),
    }))

  return (
    <div className="flex flex-col">
      <PageHeader
        breadcrumb={[
          { label: 'Activities', href: '/dashboard/activities' },
          { label: activity.name, href: `/dashboard/activities/${activity.id}` },
          { label: 'Edit' },
        ]}
        title={`Edit ${activity.name}`}
        description="Change anything about this activity. The preview on the right shows how it will read on the storefront, and nothing changes for guests until you save."
        actions={
          <Button variant="ghost" asChild>
            <Link href={`/dashboard/activities/${activity.id}`}>Back to activity</Link>
          </Button>
        }
      />

      <ActivityWizard
        mode="edit"
        activityId={activity.id}
        activity={activity}
        crew={crew}
        locations={getLocationsByTenant(tenant.id)}
        waivers={getWaiversByTenant(tenant.id).map((waiver) => ({ id: waiver.id, title: waiver.title }))}
        packageOptions={packageOptionsFor(tenant.id)}
        tenantId={tenant.id}
        pickupZones={getPickupZonesByTenant(tenant.id).map((zone) => ({ id: zone.id, name: zone.name, detail: `${zone.offsetMinutes} min before · ${zone.stops.length} stops`, fee: zone.fee }))}
        currency={tenant.currency}
        tenantName={tenant.name}
        businessPhone={tenant.contact.phone}
        tenantSlug={tenant.slug}
        defaultCategory={activity.category}
        nowIso={NOW_ISO}
        bookedSlots={bookedSlots}
        initialStep={typeof step === 'string' ? step : undefined}
      />
    </div>
  )
}
