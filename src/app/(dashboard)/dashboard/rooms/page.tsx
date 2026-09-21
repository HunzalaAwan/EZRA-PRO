import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { RoomsClient } from '@/components/dashboard/hospitality/rooms-client'
import { TODAY_KEY } from '@/lib/demo'
import { getLodging } from '@/lib/hospitality'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Rooms',
  description: 'Room types and every room in the house, with who is in it and whether it is clean.',
}

export default async function RoomsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/rooms')
  const lodging = getLodging(tenant)
  const relevant = lodging.stays.filter((s) => s.status === 'in_house' || s.status === 'departing' || s.status === 'arriving' || (s.status === 'booked' && s.checkIn === TODAY_KEY))
  const sellable = lodging.rooms.filter((r) => r.housekeeping !== 'out_of_order').length

  return (
    <>
      <PageHeader title="Rooms" description={`${lodging.roomTypes.length} room types, ${sellable} rooms in sale of ${lodging.rooms.length}. Tap a room to change its state or take it out of sale.`} />
      <RoomsClient roomTypes={lodging.roomTypes} rooms={lodging.rooms} stays={relevant} currency={tenant.currency} todayKey={TODAY_KEY} />
    </>
  )
}
