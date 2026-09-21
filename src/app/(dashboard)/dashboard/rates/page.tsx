import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { RatesClient, type OccupancyCell } from '@/components/dashboard/hospitality/rates-client'
import { NOW, TODAY_KEY } from '@/lib/demo'
import { getLodging, nightKeys } from '@/lib/hospitality'
import { addDays, toDateKey } from '@/lib/utils'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Rates & availability',
  description: 'Nightly rates by room type, season and plan, with the rooms left each night.',
}

export default async function RatesPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/rates')
  const lodging = getLodging(tenant)
  const end = toDateKey(addDays(NOW, 14))

  const roomCounts: Record<string, number> = {}
  for (const t of lodging.roomTypes) roomCounts[t.id] = lodging.rooms.filter((r) => r.typeId === t.id && r.housekeeping !== 'out_of_order').length

  const cells = new Map<string, OccupancyCell>()
  for (const s of lodging.stays) {
    if (s.status === 'cancelled' || s.status === 'no_show' || s.checkOut < TODAY_KEY || s.checkIn > end) continue
    for (const night of nightKeys(s.checkIn, s.checkOut)) {
      if (night < TODAY_KEY || night > end) continue
      const key = `${s.roomTypeId}:${night}`
      const cell = cells.get(key) ?? { roomTypeId: s.roomTypeId, night, booked: 0 }
      cell.booked += 1
      cells.set(key, cell)
    }
  }

  return (
    <>
      <PageHeader title="Rates & availability" description={`Base rate per room type, then season, plan and the weekend premium on top. The grid shows what a guest would pay for the next fourteen nights and how many rooms are left.`} />
      <RatesClient roomTypes={lodging.roomTypes} roomCounts={roomCounts} settings={lodging.settings} occupancy={[...cells.values()]} currency={tenant.currency} todayKey={TODAY_KEY} />
    </>
  )
}
