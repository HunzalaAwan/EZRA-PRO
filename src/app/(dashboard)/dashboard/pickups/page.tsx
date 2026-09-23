import type { Metadata } from 'next'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getPickupRunSheet } from '@/lib/operations'
import { PageHeader } from '@/components/dashboard/page-header'
import { PickupRunSheet } from '@/components/dashboard/operations/pickup-run-sheet'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pickups',
  description: "Today's hotel pickups in collection order: the driver's run sheet.",
}

export default async function PickupsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/pickups')
  return (
    <div className="flex flex-col gap-5 pb-16 print:gap-3">
      <PageHeader
        className="mb-0"
        title="Pickups"
        description="Today's hotel pickups in the order the shuttle collects them. Tick each party on board."
        actions={
          <Button asChild variant="secondary" leftIcon={<Settings2 />}>
            <Link href="/dashboard/settings/pickup">Pickup zones</Link>
          </Button>
        }
      />
      <PickupRunSheet sheet={getPickupRunSheet(tenant.id)} />
    </div>
  )
}
