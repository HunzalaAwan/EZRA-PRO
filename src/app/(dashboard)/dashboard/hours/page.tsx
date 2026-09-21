import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { HoursCapacity } from '@/components/dashboard/hospitality/hours-capacity'
import { NOW, TODAY_KEY } from '@/lib/demo'
import { getDining } from '@/lib/hospitality'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hours',
  description: 'Service hours, pickup and delivery windows, and closed days.',
}

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

export default async function HoursPage() {
  const { tenant, profile } = await requireWorkspaceRoute('/dashboard/hours')
  const dining = getDining(tenant)
  const seats = dining.tables.reduce((s, t) => s + t.seats, 0)
  const names = dining.settings.periods.map((p) => p.name.toLowerCase()).join(', ')
  const full = profile.modules.reservations

  return (
    <>
      <PageHeader
        title={full ? 'Hours & capacity' : 'Hours'}
        description={
          full
            ? `${dining.settings.periods.length} services a day (${names}), ${seats} seats in the room. Everything the online book and the order windows run on.`
            : `${dining.settings.periods.length} services a day (${names}). What the storefront shows, and when pickup and delivery run. Tables are booked by phone.`
        }
      />
      <HoursCapacity settings={dining.settings} currency={tenant.currency} todayKey={TODAY_KEY} nowTime={NOW_TIME} seats={seats} mode={full ? 'full' : 'hours'} phone={tenant.contact.phone} />
    </>
  )
}
