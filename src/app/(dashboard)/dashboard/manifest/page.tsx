import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, getManifest } from '@/lib/demo'
import { PageHeader } from '@/components/dashboard/page-header'
import { ManifestView } from '@/components/dashboard/bookings/manifest-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Guest list',
  description:
    'Every time slot, team member, resource and guest for the day, with one-tap check-in.',
}

export default async function ManifestPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/manifest')
  return (
    <div className="flex flex-col gap-5 pb-16 print:gap-3 print:pb-0">
      <div className="print:hidden">
        <PageHeader
          className="mb-0"
          title="Guest list"
          description="Pick a time slot on the left, check guests in on the right."
        />
      </div>

      <ManifestView initialManifest={getManifest(tenant.id, NOW)} />
    </div>
  )
}
