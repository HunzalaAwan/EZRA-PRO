import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { getActivityById } from '@/lib/demo'
import { getUsersByTenant } from '@/lib/demo'
import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { ActivityWizard } from '@/components/dashboard/activities/activity-wizard'

interface EditActivityPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EditActivityPageProps): Promise<Metadata> {
  const { id } = await params
  const activity = getActivityById(id)
  if (!activity) return { title: 'Activity not found' }
  return { title: `Edit ${activity.name}`, description: activity.tagline }
}

/* ==========================================================================
   /dashboard/activities/[id]/edit — the same six steps as a new activity,
   filled in from the one that exists, with the live preview beside them.
   ========================================================================== */

export default async function EditActivityPage({ params }: EditActivityPageProps) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/activities')
  const { id } = await params
  const activity = getActivityById(id)
  if (!activity) notFound()

  const crew = getUsersByTenant(tenant.id)
    .filter((user) => user.isBookable)
    .map((user) => ({ id: user.id, name: user.name, title: user.title, avatarUrl: user.avatarUrl }))

  return (
    <div className="flex flex-col">
      <PageHeader
        breadcrumb={[
          { label: 'Activities', href: '/dashboard/activities' },
          { label: activity.name, href: `/dashboard/activities/${activity.id}` },
          { label: 'Edit' },
        ]}
        title={`Edit ${activity.name}`}
        description="Change anything about the listing. The preview on the right shows how it will read on the storefront, and nothing changes for guests until you save."
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
        currency={tenant.currency}
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        defaultCategory={activity.category}
        nowIso={NOW_ISO}
      />
    </div>
  )
}
