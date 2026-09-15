import type { Metadata } from 'next'

import { ChannelDonutChart } from '@/components/charts/channel-donut-chart'
import { PageHeader } from '@/components/dashboard/page-header'
import { InsightsPanel } from '@/components/dashboard/overview/insights-panel'
import { KpiRow } from '@/components/dashboard/overview/kpi-row'
import { PayoutCard } from '@/components/dashboard/overview/payout-card'
import { OverviewHeaderActions } from '@/components/dashboard/overview/quick-actions'
import { RecentBookings } from '@/components/dashboard/overview/recent-bookings'
import { RevenueBars } from '@/components/dashboard/overview/revenue-bars'
import { Reveal } from '@/components/motion/reveal'
import {
  CHANNEL_LABELS,
  CURRENT_TENANT,
  CURRENT_USER,
  NOW,
  TODAY_KEY,
  getDashboardOverview,
} from '@/lib/demo'
import { addDays, formatDateLong, formatNumber, pluralize, sum } from '@/lib/utils'

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

/** Takings settle on the next business day; weekends roll to Monday. */
function nextBusinessDay(from: Date): Date {
  let next = addDays(from, 1)
  while (next.getDay() === 0 || next.getDay() === 6) next = addDays(next, 1)
  return next
}

/* ==========================================================================
   LAYOUT

   Row 1 — four instruments: the figure and its mini chart in a well.
   Row 2 — the revenue comparison, wide, beside the money on its way to the
           bank — the one dark card on the page.
   Row 3 — the bookings that just came in, full width, filterable by status.
   Row 4 — what to do next beside where the bookings come from.
   ========================================================================== */

export default function DashboardOverviewPage() {
  const tenant = CURRENT_TENANT
  const overview = getDashboardOverview(tenant.id)

  const firstName = CURRENT_USER.name.split(' ')[0]
  const todayGuests = overview.todayDepartures.reduce((acc, e) => acc + e.departure.booked, 0)

  const headline =
    overview.todayDepartures.length === 0
      ? `${formatDateLong(NOW)} · nothing scheduled today`
      : `${formatDateLong(NOW)} · ${formatNumber(overview.todayDepartures.length)} ${pluralize(
          overview.todayDepartures.length,
          'departure',
        )} and ${formatNumber(todayGuests)} ${pluralize(todayGuests, 'guest')} on the books`

  // Payouts: today's takings settle next business day; the trailing month is
  // what has already landed.
  const series = overview.timeseries
  const today = series[series.length - 1]
  const nextPayout = today?.revenue ?? 0
  const paidOut = sum(series.slice(-31, -1).map((p) => p.revenue))
  const arrivesOn = nextBusinessDay(NOW).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={`${greeting(NOW.getHours())}, ${firstName}`}
        description={headline}
        actions={<OverviewHeaderActions nowIso={NOW_ISO} />}
        className="mb-0"
      />

      {/* ---- row 1: four instruments ------------------------------------- */}
      <KpiRow kpis={overview.kpis} currency={tenant.currency} />

      {/* ---- row 2: the comparison, and the money on its way -------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-8" delay={0.1} distance={16}>
          <RevenueBars points={series} currency={tenant.currency} className="h-full" />
        </Reveal>
        <Reveal className="min-w-0 xl:col-span-4" delay={0.16} distance={16}>
          <PayoutCard
            nextPayout={nextPayout}
            arrivesOn={arrivesOn}
            paidOut={paidOut}
            paidOutLabel="Paid out · last 30 days"
            account="Bank of Hawaii ···· 4421"
            currency={tenant.currency}
            className="h-full"
          />
        </Reveal>
      </div>

      {/* ---- row 3: what just came in ------------------------------------- */}
      <Reveal distance={16}>
        <RecentBookings rows={overview.recentBookings} nowIso={NOW_ISO} channelLabels={CHANNEL_LABELS} />
      </Reveal>

      {/* ---- row 4: what to do, and where it comes from --------------------- */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Reveal className="min-w-0 xl:col-span-5" distance={16}>
          <InsightsPanel insights={overview.insights} limit={3} className="h-full" />
        </Reveal>
        <Reveal className="min-w-0 xl:col-span-7" delay={0.06} distance={16}>
          <ChannelDonutChart
            channels={overview.channels}
            currency={tenant.currency}
            height={220}
            title="Where bookings come from"
            description="Net revenue by channel, last 30 days"
            className="h-full"
          />
        </Reveal>
      </div>
    </div>
  )
}
