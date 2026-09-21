import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { HoursCapacity } from '@/components/dashboard/hospitality/hours-capacity'
import { TODAY_KEY } from '@/lib/demo'
import { getDining } from '@/lib/hospitality'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hours & capacity',
  description: 'Service hours, turn times, online booking rules, pickup and delivery windows.',
}

export default async function HoursPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/hours')
  const dining = getDining(tenant)
  const seats = dining.tables.reduce((s, t) => s + t.seats, 0)
  const names = dining.settings.periods.map((p) => p.name.toLowerCase()).join(', ')

  return (
    <>
      <PageHeader title="Hours & capacity" description={`${dining.settings.periods.length} services a day (${names}), ${seats} seats in the room. Everything the online book and the order windows run on.`} />
      <HoursCapacity settings={dining.settings} currency={tenant.currency} todayKey={TODAY_KEY} seats={seats} />
    </>
  )
}
