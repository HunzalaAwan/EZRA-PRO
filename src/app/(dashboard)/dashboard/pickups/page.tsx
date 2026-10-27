import type { Metadata } from 'next'
import Link from 'next/link'
import { Settings2 } from 'lucide-react'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW, getActivitiesByTenant, getPickupZonesByTenant, getResourcesByTenant, getUsersByTenant } from '@/lib/demo'
import { getPickupRunSheet, getTransferRideWeek } from '@/lib/operations'
import { addDays, toDateKey } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-header'
import { PickupRunSheet } from '@/components/dashboard/operations/pickup-run-sheet'
import { PickupsTabs, TransferRidesBoard } from '@/components/dashboard/operations/transfer-rides-board'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pickups',
  description: 'Pickups and drop-offs for today and the week ahead, by shuttle run: who to collect, where, when, and who is driving.',
}

const DAYS = 7

/** "Toyota Hiace", 4 → "Hiace 1" … "Hiace 4": the units a vehicle can be picked from. */
function unitsOf(name: string, quantity: number): string[] {
  const short = name.trim().split(/\s+/).pop() || name
  return Array.from({ length: Math.max(0, quantity) }, (_, index) => `${short} ${index + 1}`)
}

export default async function PickupsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/pickups')
  const users = getUsersByTenant(tenant.id)
  const drivers = users.map((user) => user.name)
  const transfers = getActivitiesByTenant(tenant.id).filter((activity) => activity.kind === 'transfer')
  const hasRides = transfers.length > 0
  const hasRuns = !hasRides || getPickupZonesByTenant(tenant.id).length > 0
  const runSheet = hasRuns ? (
    <PickupRunSheet sheets={Array.from({ length: DAYS }, (_, index) => getPickupRunSheet(tenant.id, addDays(NOW, index)))} drivers={drivers} tenantSlug={tenant.slug} />
  ) : undefined
  const units = Object.fromEntries(
    getResourcesByTenant(tenant.id)
      .filter((resource) => resource.kind === 'vehicle' && resource.status !== 'retired')
      .map((resource) => [resource.id, unitsOf(resource.name, resource.quantity)]),
  )
  return (
    <div className="flex flex-col gap-5 pb-16 print:gap-3">
      <PageHeader
        className="mb-0 print:hidden"
        title="Pickups"
        description={
          hasRides
            ? 'Every ride, pickup and drop-off for today and the week ahead.'
            : 'Every pickup and drop-off for today and the week ahead, grouped by shuttle run. Assign a driver, text the guests, tick each party on board.'
        }
        actions={
          hasRuns ? (
            <Button asChild variant="secondary" leftIcon={<Settings2 />}>
              <Link href="/dashboard/settings/pickup">Pickup zones</Link>
            </Button>
          ) : undefined
        }
      />
      {hasRides ? (
        <PickupsTabs
          rides={
            <TransferRidesBoard
              sheets={getTransferRideWeek(tenant.id, toDateKey(NOW), DAYS)}
              activities={transfers}
              drivers={users.filter((user) => user.isBookable).map((user) => ({ id: user.id, name: user.name }))}
              units={units}
              tenantSlug={tenant.slug}
              todayKey={toDateKey(NOW)}
            />
          }
          runs={hasRuns ? runSheet : undefined}
        />
      ) : (
        runSheet
      )}
    </div>
  )
}
