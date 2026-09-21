import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { FrontDesk } from '@/components/dashboard/hospitality/front-desk'
import { NOW, TODAY_KEY } from '@/lib/demo'
import { getLodging, getLodgingCounts } from '@/lib/hospitality'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Front desk',
  description: 'Today’s arrivals, departures and everyone in the house.',
}

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

export default async function FrontDeskPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/front-desk')
  const lodging = getLodging(tenant)
  const counts = getLodgingCounts(tenant)
  const relevant = lodging.stays.filter((s) => s.checkIn === TODAY_KEY || s.checkOut === TODAY_KEY || s.status === 'in_house' || s.status === 'departing')

  return (
    <>
      <PageHeader
        title="Front desk"
        description={`${counts.arrivalsToday} arriving, ${counts.departuresToday} leaving, ${counts.inHouse} in the house. ${counts.occupancyTonight}% occupied tonight.`}
      />
      <FrontDesk stays={relevant} rooms={lodging.rooms} roomTypes={lodging.roomTypes} settings={lodging.settings} currency={tenant.currency} todayKey={TODAY_KEY} nowTime={NOW_TIME} />
    </>
  )
}
