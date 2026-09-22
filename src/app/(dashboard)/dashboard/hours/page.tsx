import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { HoursCapacity } from '@/components/dashboard/hospitality/hours-capacity'
import { NOW, TODAY_KEY } from '@/lib/demo'
import { getDiningSettings } from '@/lib/hospitality'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Hours',
  description: 'Service hours, pickup and delivery windows, room service and closed days.',
}

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

export default async function HoursPage() {
  const { tenant, profile } = await requireWorkspaceRoute('/dashboard/hours')
  const settings = getDiningSettings(tenant.id)
  const names = settings.periods.map((p) => p.name.toLowerCase()).join(', ')

  return (
    <>
      <PageHeader title="Hours" description={`${settings.periods.length} services a day (${names}). What the storefront shows, and when ${profile.modules.lodging ? 'room service, pickup and delivery' : 'pickup and delivery'} run. Tables are booked by phone.`} />
      <HoursCapacity settings={settings} currency={tenant.currency} todayKey={TODAY_KEY} nowTime={NOW_TIME} phone={tenant.contact.phone} lodging={profile.modules.lodging} />
    </>
  )
}
