import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { ReservationsClient } from '@/components/dashboard/hospitality/reservations-client'
import { NOW, TODAY_KEY, getCustomersByTenant } from '@/lib/demo'
import { getDining, getDiningCounts } from '@/lib/hospitality'
import { addDays, formatNumber, toDateKey } from '@/lib/utils'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Reservations',
  description: 'The book for the day: every table, every seating, every guest.',
}

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { tenant, profile } = await requireWorkspaceRoute('/dashboard/reservations')
  const params = await searchParams
  const dining = getDining(tenant)
  const counts = getDiningCounts(tenant)

  const from = toDateKey(addDays(NOW, -3))
  const to = toDateKey(addDays(NOW, 14))
  const reservations = dining.reservations.filter((r) => r.date >= from && r.date <= to)
  const recentGuests = getCustomersByTenant(tenant.id)
    .filter((c) => c.totalBookings > 0)
    .sort((a, b) => (b.lastBookingAt ?? '').localeCompare(a.lastBookingAt ?? ''))
    .slice(0, 400)

  const hotel = profile.modules.lodging
  const tonight = dining.settings.periods[dining.settings.periods.length - 1]

  return (
    <>
      <PageHeader
        title={hotel ? 'Table reservations' : 'Reservations'}
        description={`${formatNumber(counts.coversToday)} covers still to come today across ${formatNumber(counts.reservationsToday)} reservations. ${tonight.name} runs ${tonight.startTime} to ${tonight.endTime}, last seating ${tonight.lastSeating}.`}
      />
      <ReservationsClient
        reservations={reservations}
        tables={dining.tables}
        zones={dining.zones}
        settings={dining.settings}
        currency={tenant.currency}
        todayKey={TODAY_KEY}
        nowTime={NOW_TIME}
        recentGuests={recentGuests}
        openNew={params.new === '1'}
        hotel={hotel}
      />
    </>
  )
}
