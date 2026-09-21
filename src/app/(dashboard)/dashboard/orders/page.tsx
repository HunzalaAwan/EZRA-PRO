import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { PageHeader } from '@/components/dashboard/page-header'
import { OrdersBoard } from '@/components/dashboard/hospitality/orders-board'
import { TODAY_KEY } from '@/lib/demo'
import { getDining, getLiveOrders } from '@/lib/hospitality'
import { formatNumber } from '@/lib/utils'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Orders',
  description: 'Dine-in, pickup and delivery orders on one pass, with the last two weeks underneath.',
}

export default async function OrdersPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/orders')
  const dining = getDining(tenant)
  const live = getLiveOrders(tenant)
  const late = live.filter((o) => o.late).length
  const scheduled = live.filter((o) => o.scheduledFor).length

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${formatNumber(live.length)} live${scheduled ? `, ${scheduled} scheduled for later` : ''}${late ? `, ${late} running late` : ''}. Pickup opens ${dining.settings.ordering.pickup.startTime}, delivery ${dining.settings.ordering.delivery.startTime} to ${dining.settings.ordering.delivery.endTime}.`}
      />
      <OrdersBoard orders={dining.orders} tables={dining.tables} currency={tenant.currency} todayKey={TODAY_KEY} nowIso={NOW_ISO} />
    </>
  )
}
