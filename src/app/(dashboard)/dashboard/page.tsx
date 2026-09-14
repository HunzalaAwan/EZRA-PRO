import type { Metadata } from 'next'

import { ActivityPerformanceChart } from '@/components/charts/activity-performance-chart'
import { BookingsFlowChart } from '@/components/charts/bookings-flow-chart'
import { ChannelDonutChart } from '@/components/charts/channel-donut-chart'
import { PageHeader } from '@/components/dashboard/page-header'
import { CapacityHealth } from '@/components/dashboard/overview/capacity-health'
import { HeroCard } from '@/components/dashboard/overview/hero-card'
import { InsightsPanel } from '@/components/dashboard/overview/insights-panel'
import { OverviewHeaderActions } from '@/components/dashboard/overview/quick-actions'
import { RecentBookings } from '@/components/dashboard/overview/recent-bookings'
import { RevenuePanel } from '@/components/dashboard/overview/revenue-panel'
import { StatTiles } from '@/components/dashboard/overview/stat-tiles'
import { Reveal } from '@/components/motion/reveal'
import {
  CHANNEL_LABELS,
  CURRENT_TENANT,
  CURRENT_USER,
  NOW,
  TODAY_KEY,
  getDashboardOverview,
} from '@/lib/demo'
import { formatDateLong, formatNumber, pluralize } from '@/lib/utils'
import type { KpiMetric } from '@/types'

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

/* ==========================================================================
   LAYOUT

   Row 1 — the wallet row: revenue hero (with its actions inside), the three
           numbers that produced it, and a capacity score.
   Row 2 — the trend, beside the panel that says what to do about it.
   Row 3 — flow (bookings in / cancellations out) beside the channel mix.
   Row 4 — the money, and where it comes from.

   Every row's cards share a top edge; heavy elements (hero, chart) sit left,
   where the eye lands first, and the read gets lighter to the right.
   ========================================================================== */

export default function DashboardOverviewPage() {
  const tenant = CURRENT_TENANT
  const overview = getDashboardOverview(tenant.id)
  const kpi = new Map<string, KpiMetric>(overview.kpis.map((k) => [k.key, k]))

  const firstName = CURRENT_USER.name.split(' ')[0]
  const todayGuests = overview.todayDepartures.reduce((acc, e) => acc + e.departure.booked, 0)

  const headline =
    overview.todayDepartures.length === 0
      ? `${formatDateLong(NOW)} · nothing scheduled today`
      : `${formatDateLong(NOW)} · ${formatNumber(overview.todayDepartures.length)} ${pluralize(
          overview.todayDepartures.length,
          'departure',
        )} and ${formatNumber(todayGuests)} ${pluralize(todayGuests, 'guest')} on the books`

  const revenue = kpi.get('net_revenue') ?? overview.kpis[0]
  const occupancy = kpi.get('occupancy')
  const supportingRates = ['repeat_rate', 'cancellation_rate']
    .map((key) => kpi.get(key))
    .filter((m): m is KpiMetric => Boolean(m))

  // The flow chart reads best over a fortnight — long enough for a pattern,
  // short enough that every bar still has room.
  const flowPoints = overview.timeseries.slice(-14)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${greeting(NOW.getHours())}, ${firstName}`}
        description={headline}
        actions={<OverviewHeaderActions nowIso={NOW_ISO} />}
        className="mb-0"
      />

      {/* ---- row 1: the wallet row ------------------------------------------ */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-4" distance={18}>
          {revenue ? (
            <HeroCard metric={revenue} currency={tenant.currency} periodLabel="Last 30 days" />
          ) : null}
        </Reveal>
        <Reveal className="min-w-0 lg:col-span-5" delay={0.06} distance={18}>
          <StatTiles kpis={overview.kpis} currency={tenant.currency} className="h-full" />
        </Reveal>
        <Reveal className="min-w-0 lg:col-span-3" delay={0.12} distance={18}>
          {occupancy ? (
            <CapacityHealth metric={occupancy} supporting={supportingRates} className="h-full" />
          ) : null}
        </Reveal>
      </div>

      {/* ---- row 2: the trend and what to do about it ----------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-8" delay={0.04} distance={18}>
          <RevenuePanel points={overview.timeseries} currency={tenant.currency} />
        </Reveal>
        <Reveal className="min-w-0 xl:col-span-4" delay={0.12} distance={18}>
          <InsightsPanel insights={overview.insights} className="xl:max-h-[46rem]" />
        </Reveal>
      </div>

      {/* ---- row 3: flow and mix -------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-7" distance={18}>
          <BookingsFlowChart points={flowPoints} height={250} className="h-full" />
        </Reveal>
        <Reveal className="min-w-0 xl:col-span-5" delay={0.08} distance={18}>
          <ChannelDonutChart
            channels={overview.channels}
            currency={tenant.currency}
            height={250}
            title="Where bookings come from"
            description="Net revenue by channel over the last 30 days."
            className="h-full"
          />
        </Reveal>
      </div>

      {/* ---- row 4: the money, and what earns it ---------------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-7" distance={18}>
          <RecentBookings
            rows={overview.recentBookings}
            nowIso={NOW_ISO}
            channelLabels={CHANNEL_LABELS}
            className="h-full"
          />
        </Reveal>
        <Reveal className="min-w-0 xl:col-span-5" delay={0.08} distance={18}>
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
