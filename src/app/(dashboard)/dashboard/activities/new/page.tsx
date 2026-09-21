import type { Metadata } from 'next'
import Link from 'next/link'

import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { CURRENT_TENANT } from '@/lib/demo'
import { getUsersByTenant } from '@/lib/demo'
import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { ActivityWizard } from '@/components/dashboard/activities/activity-wizard'

export const metadata: Metadata = {
  title: 'New activity',
  description: 'Create a bookable experience — pricing, media, schedule and storefront copy.',
}

export default function NewActivityPage() {
  const crew = getUsersByTenant(CURRENT_TENANT.id)
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
        description={`Six steps to a bookable listing on the ${CURRENT_TENANT.name} storefront. Your progress is kept if you step away.`}
        actions={
          <Button variant="ghost" asChild>
            <Link href="/dashboard/activities">Back to catalog</Link>
          </Button>
        }
      />

      <ActivityWizard
        currency={CURRENT_TENANT.currency}
        tenantName={CURRENT_TENANT.name}
        tenantSlug={CURRENT_TENANT.slug}
        defaultCategory={CURRENT_TENANT.vertical}
        nowIso={NOW_ISO}
        crew={crew}
      />
    </div>
  )
}
