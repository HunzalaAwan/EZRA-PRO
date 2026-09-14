import type { Metadata } from 'next'

import { ActivityPerformanceChart } from '@/components/charts/activity-performance-chart'
import { ChannelDonutChart } from '@/components/charts/channel-donut-chart'
import { PageHeader } from '@/components/dashboard/page-header'
import { ActivityFeed } from '@/components/dashboard/overview/activity-feed'
import { InsightsPanel } from '@/components/dashboard/overview/insights-panel'
import { KpiRow } from '@/components/dashboard/overview/kpi-row'
import { QuickActions, OverviewHeaderActions } from '@/components/dashboard/overview/quick-actions'
import { RecentBookings } from '@/components/dashboard/overview/recent-bookings'
import { RevenuePanel } from '@/components/dashboard/overview/revenue-panel'
import { TodaysDepartures, type StaffLite } from '@/components/dashboard/overview/todays-departures'
import { Reveal } from '@/components/motion/reveal'
import {
  CHANNEL_LABELS,
  CURRENT_TENANT,
  CURRENT_USER,
  NOW,
  TODAY_KEY,
  getDashboardOverview,
  getUsersByTenant,
} from '@/lib/demo'
import { formatDateLong, formatNumber, pluralize } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Overview',
  description: 'Revenue, today’s departures and what needs your attention — at a glance.',
}

/**
 * "Now" as a LOCAL ISO string, matching every datetime in the seam. Built from
 * the frozen clock rather than `toISOString()`, which would shift into UTC and
 * disagree with `toDateKey()` on the client.
 */
const NOW_ISO = `${TODAY_KEY}T${String(NOW.getHours()).padStart(2, '0')}:${String(
  NOW.getMinutes(),
).padStart(2, '0')}:00`

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardOverviewPage() {
  const tenant = CURRENT_TENANT
  const overview = getDashboardOverview(tenant.id)

  const staff: Record<string, StaffLite> = Object.fromEntries(
    getUsersByTenant(tenant.id).map((user) => [
      user.id,
      { name: user.name, avatarUrl: user.avatarUrl },
    ]),
  )

  const firstName = CURRENT_USER.name.split(' ')[0]
  const todayGuests = overview.todayDepartures.reduce((acc, e) => acc + e.departure.booked, 0)

  const headline =
    overview.todayDepartures.length === 0
      ? `${formatDateLong(NOW)} · nothing scheduled today`
      : `${formatDateLong(NOW)} · ${formatNumber(overview.todayDepartures.length)} ${pluralize(
          overview.todayDepartures.length,
          'departure',
        )} and ${formatNumber(todayGuests)} ${pluralize(todayGuests, 'guest')} on the books`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting(NOW.getHours())}, ${firstName}`}
        description={headline}
        actions={<OverviewHeaderActions nowIso={NOW_ISO} />}
        className="mb-0"
      />

      {/* ---- headline numbers --------------------------------------------- */}
      <KpiRow kpis={overview.kpis} />

      {/* ---- hero chart + intelligence ------------------------------------ */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-8" delay={0.04} distance={18}>
          <RevenuePanel points={overview.timeseries} currency={tenant.currency} />
        </Reveal>
        <Reveal className="min-w-0 xl:col-span-4" delay={0.12} distance={18}>
          <InsightsPanel insights={overview.insights} className="xl:max-h-[38rem]" />
        </Reveal>
      </div>

      {/* ---- jump-off points ----------------------------------------------- */}
      <QuickActions />

      {/* ---- operations ---------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-7" distance={18}>
          <TodaysDepartures
            events={overview.todayDepartures}
            staff={staff}
            nowIso={NOW_ISO}
            className="xl:max-h-[44rem]"
          />
        </Reveal>
        <Reveal className="min-w-0 xl:col-span-5" delay={0.08} distance={18}>
          <ActivityFeed items={overview.feed} nowIso={NOW_ISO} className="xl:max-h-[44rem]" />
        </Reveal>
      </div>

      {/* ---- the money ------------------------------------------------------ */}
      <Reveal distance={18}>
        <RecentBookings
          rows={overview.recentBookings}
          nowIso={NOW_ISO}
          channelLabels={CHANNEL_LABELS}
        />
      </Reveal>

      {/* ---- where it comes from -------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-5" distance={18}>
          <ChannelDonutChart
            channels={overview.channels}
            currency={tenant.currency}
            height={272}
            title="Where bookings come from"
            description="Net revenue by channel over the last 30 days."
            className="h-full"
          />
        </Reveal>
        <Reveal className="min-w-0 xl:col-span-7" delay={0.08} distance={18}>
          <ActivityPerformanceChart
            items={overview.topActivities}
            currency={tenant.currency}
            limit={6}
            title="Top activities by revenue"
            description="Ranked over the last 30 days, with occupancy and guest rating."
            className="h-full"
          />
        </Reveal>
      </div>
    </div>
  )
}
