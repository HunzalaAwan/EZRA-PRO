import type { Metadata } from 'next'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, getUsersByTenant } from '@/lib/demo'
import { getPickupRunSheet } from '@/lib/operations'
import { addDays } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { PickupRunSheet } from '@/components/dashboard/operations/pickup-run-sheet'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pickups',
  description: 'Hotel pickups for today and the week ahead, by shuttle run: who to collect, where, when, and who is driving.',
}

const DAYS = 7

export default async function PickupsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/pickups')
  const sheets = Array.from({ length: DAYS }, (_, index) => getPickupRunSheet(tenant.id, addDays(NOW, index)))
  const drivers = getUsersByTenant(tenant.id).map((user) => user.name)
  return (
    <div className="flex flex-col gap-5 pb-16 print:gap-3">
      <PageHeader
        className="mb-0 print:hidden"
        title="Pickups"
        description="Every hotel pickup for today and the week ahead, grouped by shuttle run. Assign a driver, text the guests, tick each party on board."
        actions={
          <Button asChild variant="secondary" leftIcon={<Settings2 />}>
            <Link href="/dashboard/settings/pickup">Pickup zones</Link>
          </Button>
        }
      />
      <PickupRunSheet sheets={sheets} drivers={drivers} tenantSlug={tenant.slug} />
    </div>
  )
}
