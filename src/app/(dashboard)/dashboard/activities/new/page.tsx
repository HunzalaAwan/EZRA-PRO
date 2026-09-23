import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'
import Link from 'next/link'

import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'

import { getUsersByTenant, getLocationsByTenant, getWaiversByTenant } from '@/lib/demo'
import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { ActivityWizard } from '@/components/dashboard/activities/activity-wizard'

export const metadata: Metadata = {
  title: 'New activity',
  description: 'Create a bookable experience — pricing, media, schedule and storefront copy.',
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
        description={`Six steps to a bookable listing on the ${tenant.name} storefront. Your progress is kept if you step away.`}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard/activities">Back to catalog</Link>
          </Button>
        }
      />

      <ActivityWizard
        currency={tenant.currency}
        tenantName={tenant.name}
        tenantSlug={tenant.slug}
        defaultCategory={tenant.vertical}
        nowIso={NOW_ISO}
        crew={crew}
        locations={getLocationsByTenant(tenant.id)}
        waivers={getWaiversByTenant(tenant.id).map((waiver) => ({ id: waiver.id, title: waiver.title }))}
      />
    </div>
  )
}
