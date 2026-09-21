import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { StaysClient } from '@/components/dashboard/hospitality/stays-client'
import { NOW, TODAY_KEY, getCustomersByTenant } from '@/lib/demo'
import { getLodging, getLodgingCounts } from '@/lib/hospitality'
import { addDays, formatNumber, toDateKey } from '@/lib/utils'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reservations',
  description: 'Every stay on the books, as a list or on the room chart.',
}

export default async function StaysPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/stays')
  const params = await searchParams
  const lodging = getLodging(tenant)
  const counts = getLodgingCounts(tenant)

  const from = toDateKey(addDays(NOW, -10))
  const to = toDateKey(addDays(NOW, 35))
  const stays = lodging.stays.filter((s) => s.checkOut >= from && s.checkIn <= to)
  const ahead = stays.filter((s) => s.checkIn >= TODAY_KEY && (s.status === 'booked' || s.status === 'arriving')).length
  const recentGuests = getCustomersByTenant(tenant.id)
    .filter((c) => c.totalBookings > 0)
    .sort((a, b) => (b.lastBookingAt ?? '').localeCompare(a.lastBookingAt ?? ''))
    .slice(0, 400)

  return (
    <>
      <PageHeader title="Reservations" description={`${formatNumber(ahead)} stays booked ahead, ${counts.occupancyTonight}% occupied tonight. Check-in from ${lodging.settings.checkInFrom}, check-out by ${lodging.settings.checkOutBy}.`} />
      <StaysClient stays={stays} rooms={lodging.rooms} roomTypes={lodging.roomTypes} settings={lodging.settings} currency={tenant.currency} todayKey={TODAY_KEY} recentGuests={recentGuests} openNew={params.new === '1'} />
    </>
  )
}
