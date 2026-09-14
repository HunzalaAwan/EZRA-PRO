import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarClock, Gauge, Plus, Radio, Store, Ticket } from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { StatCard, StatGrid } from '@/components/ui/stat'
import { CURRENT_TENANT } from '@/lib/demo'
import { formatNumber, pluralize } from '@/lib/utils'
import {
  getActivitySummaries,
  getCatalogTotals,
} from '@/components/dashboard/activities/activity-data'
import { ActivityCatalog } from '@/components/dashboard/activities/activity-grid'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Activities',
  description: 'Every experience you sell — pricing, availability and performance in one catalog.',
}

export default function ActivitiesPage() {
  const summaries = getActivitySummaries(CURRENT_TENANT.id)
  const totals = getCatalogTotals(summaries)
  const upcoming = summaries.reduce((acc, s) => acc + s.upcomingCount, 0)

  return (
    <div className="flex flex-col">
      <PageHeader
        breadcrumb={[{ label: 'Catalog' }, { label: 'Activities' }]}
        title="Activities"
        description={`${totals.live} live · ${totals.draft} ${pluralize(totals.draft, 'draft')} · ${totals.paused} paused across ${CURRENT_TENANT.name}.`}
        actions={
          <>
            <Button variant="secondary" asChild leftIcon={<Store />}>
              <Link href={`/book/${CURRENT_TENANT.slug}`} target="_blank" rel="noopener">
                View storefront
              </Link>
            </Button>
            <Button variant="primary" asChild leftIcon={<Plus />}>
              <Link href="/dashboard/activities/new">New activity</Link>
            </Button>
          </>
        }
      />

      <StatGrid columns={4} className="mb-6">
        <StatCard
          icon={<Radio />}
          accent="lagoon"
          stat={{
            label: 'Live activities',
            value: totals.live,
            format: 'number',
            hint: `${totals.total} experiences in the catalog, including drafts and archives.`,
          }}
          footer={`${formatNumber(upcoming)} scheduled ${pluralize(upcoming, 'departure')} ahead`}
        />
        <StatCard
          icon={<Ticket />}
          accent="coral"
          stat={{
            label: 'Bookings · 30 days',
            value: totals.bookings30d,
            format: 'number',
            deltaPercent: totals.bookingsDeltaPercent,
            direction: totals.bookingsDeltaPercent >= 0 ? 'up' : 'down',
            comparisonLabel: 'vs previous 30 days',
          }}
          footer="Across every activity in this workspace"
        />
        <StatCard
          icon={<CalendarClock />}
          accent="sunset"
          compact
          stat={{
            label: 'Revenue · 30 days',
            value: totals.revenue30d,
            format: 'currency',
            currency: CURRENT_TENANT.currency,
            deltaPercent: totals.revenueDeltaPercent,
            direction: totals.revenueDeltaPercent >= 0 ? 'up' : 'down',
            comparisonLabel: 'vs previous 30 days',
          }}
          footer="Attributed to the departure date"
        />
        <StatCard
          icon={<Gauge />}
          accent="reef"
          stat={{
            label: 'Average occupancy',
            value: totals.occupancy30d,
            format: 'percent',
            decimals: 1,
            hint: 'Seats sold against seats offered on every departure in the last 30 days.',
          }}
          footer={`Catalog rating ${totals.avgRating.toFixed(2)} / 5`}
        />
      </StatGrid>

      <ActivityCatalog summaries={summaries} tenantSlug={CURRENT_TENANT.slug} />
    </div>
  )
}
