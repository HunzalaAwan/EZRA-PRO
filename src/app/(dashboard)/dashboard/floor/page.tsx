import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import { FloorPlan } from '@/components/dashboard/hospitality/floor-plan'
import { NOW, TODAY_KEY } from '@/lib/demo'
import { getDining, getLiveOrders } from '@/lib/hospitality'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Floor plan',
  description: 'Every table in the room, who is on it and who is due next.',
}

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

export default async function FloorPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/floor')
  const dining = getDining(tenant)
  const today = dining.reservations.filter((r) => r.date === TODAY_KEY)
  const seated = dining.tables.filter((t) => t.status === 'seated' || t.status === 'ordered' || t.status === 'bill').length

  return (
    <>
      <PageHeader
        title="Floor plan"
        description={`${seated} of ${dining.tables.length} tables seated at ${NOW_TIME}. Tap a table to seat a walk-in, ask for the bill or clear it.`}
      />
      <FloorPlan
        zones={dining.zones}
        tables={dining.tables}
        reservations={today}
        orders={getLiveOrders(tenant).filter((o) => o.type === 'dine_in')}
        periods={dining.settings.periods}
        currency={tenant.currency}
        todayKey={TODAY_KEY}
        nowTime={NOW_TIME}
      />
    </>
  )
}
