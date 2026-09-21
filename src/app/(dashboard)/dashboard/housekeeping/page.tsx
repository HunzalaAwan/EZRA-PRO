import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { HousekeepingBoard } from '@/components/dashboard/hospitality/housekeeping-board'
import { NOW, TODAY_KEY, getUsersByTenant } from '@/lib/demo'
import { getLodging, getLodgingCounts } from '@/lib/hospitality'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Housekeeping',
  description: 'The rooms to clean this morning, by attendant, rush turnovers first.',
}

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

export default async function HousekeepingPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/housekeeping')
  const lodging = getLodging(tenant)
  const counts = getLodgingCounts(tenant)
  const attendants = getUsersByTenant(tenant.id)
    .filter((u) => /attendant|housekeep/i.test(u.title))
    .map((u) => ({ id: u.id, name: u.name, avatarUrl: u.avatarUrl }))
  const stays = lodging.stays.filter((s) => s.status === 'in_house' || s.status === 'departing' || (s.checkIn === TODAY_KEY && (s.status === 'arriving' || s.status === 'booked')))
  const rush = lodging.housekeeping.filter((t) => t.priority === 'rush' && t.status !== 'done').length

  return (
    <>
      <PageHeader title="Housekeeping" description={`${counts.roomsToClean} rooms to clean, ${rush} of them rush turnovers with a guest arriving early. Check-in opens at ${lodging.settings.checkInFrom}.`} />
      <HousekeepingBoard tasks={lodging.housekeeping} rooms={lodging.rooms} roomTypes={lodging.roomTypes} attendants={attendants} stays={stays} nowTime={NOW_TIME} />
    </>
  )
}
