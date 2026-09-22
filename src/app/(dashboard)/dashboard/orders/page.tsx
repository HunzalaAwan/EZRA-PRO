import type { Metadata } from 'next'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { PageHeader } from '@/components/dashboard/page-header'
import { OrdersBoard } from '@/components/dashboard/hospitality/orders-board'
import { TAX_RATE, TODAY_KEY, getCustomersByTenant } from '@/lib/demo'
import { getDining, getLiveOrders } from '@/lib/hospitality'
import { formatNumber } from '@/lib/utils'
import { requireWorkspaceRoute } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Orders',
  description: 'Pickup, delivery and room-service orders on one pass, with the last two weeks underneath.',
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { tenant } = await requireWorkspaceRoute('/dashboard/orders')
  const params = await searchParams
  const dining = getDining(tenant)
  const live = getLiveOrders(tenant)
  const late = live.filter((o) => o.late).length
  const scheduled = live.filter((o) => o.scheduledFor).length
  const nextNumber = dining.orders.reduce((max, o) => Math.max(max, Number(o.number.slice(1)) || 0), 1000) + 1
  const recentGuests = getCustomersByTenant(tenant.id)
    .filter((c) => c.totalBookings > 0)
    .sort((a, b) => (b.lastBookingAt ?? '').localeCompare(a.lastBookingAt ?? ''))
    .slice(0, 300)
  const { pickup, delivery, roomService } = dining.settings.ordering

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${formatNumber(live.length)} live${scheduled ? `, ${scheduled} scheduled for later` : ''}${late ? `, ${late} running late` : ''}. ${roomService.enabled ? `Room service ${roomService.startTime} to ${roomService.endTime}, ` : ''}pickup ${pickup.startTime} to ${pickup.endTime}, delivery ${delivery.startTime} to ${delivery.endTime}. Phone orders go on the pass from the New order button.`}
      />
      <OrdersBoard
        orders={dining.orders}
        menu={dining.menu}
        ordering={dining.settings.ordering}
        taxRate={TAX_RATE[tenant.id] ?? 0}
        nextNumber={nextNumber}
        recentGuests={recentGuests}
        currency={tenant.currency}
        todayKey={TODAY_KEY}
        nowIso={NOW_ISO}
        openNew={params.new === '1'}
      />
    </>
  )
}
