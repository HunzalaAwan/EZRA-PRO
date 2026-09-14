'use client'

import * as React from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  Minus,
  Sigma,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

import { RevenueAreaChart, type RevenueMetric } from '@/components/charts/revenue-area-chart'
import { BookingsBarChart } from '@/components/charts/bookings-bar-chart'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import {
  average,
  cn,
  formatCurrency,
  formatDateLong,
  formatDelta,
  formatNumber,
  fromDateKey,
  percentChange,
  sum,
} from '@/lib/utils'
import type { CurrencyCode, TimeSeriesPoint } from '@/types'

/* ==========================================================================
   RevenueSection

   The headline series with its prior-period shadow, a metric switcher, and a
   second chart that puts cancellations on the same axis as bookings — the
   comparison FareHarbor makes you export two reports to see.
   ========================================================================== */

type ComparisonMode = 'previous' | 'year'

const METRIC_OPTIONS: { value: RevenueMetric; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'bookings', label: 'Bookings' },
  { value: 'guests', label: 'Guests' },
  { value: 'occupancy', label: 'Occupancy' },
]

interface Callout {
  key: string
  icon: LucideIcon
  label: string
  value: string
  detail: string
  tone: 'good' | 'bad' | 'neutral'
}

const TONE_CHIP: Record<Callout['tone'], string> = {
  good: 'bg-success-soft text-success',
  bad: 'bg-danger-soft text-danger',
  neutral: 'bg-surface-sunken text-subtle',
}

export interface RevenueSectionProps {
  points: TimeSeriesPoint[]
  currency: CurrencyCode
  comparison: ComparisonMode
  rangeLabel: string
  loading?: boolean
  className?: string
}

export function RevenueSection({
  points,
  currency,
  comparison,
  rangeLabel,
  loading = false,
  className,
}: RevenueSectionProps) {
  const [metric, setMetric] = React.useState<RevenueMetric>('revenue')

  const callouts = React.useMemo<Callout[]>(() => {
    if (points.length < 2) return []

    const revenues = points.map((p) => p.revenue)
    const dailyAverage = average(revenues)
    const best = points.reduce((a, b) => (b.revenue > a.revenue ? b : a))
    const worst = points.reduce((a, b) => (b.revenue < a.revenue ? b : a))

    // First half vs second half is a more honest read of direction on a noisy
    // daily series than a first-to-last comparison, which any single storm day
    // would otherwise dominate.
    const half = Math.floor(points.length / 2)
    const firstHalf = average(points.slice(0, half).map((p) => p.revenue))
    const secondHalf = average(points.slice(half).map((p) => p.revenue))
    const trend = percentChange(secondHalf, firstHalf)

    const total = sum(revenues)
    const totalBookings = sum(points.map((p) => p.bookings))

    const aboveAverage =
      dailyAverage === 0 ? 0 : ((best.revenue - dailyAverage) / dailyAverage) * 100
    const belowAverage =
      dailyAverage === 0 ? 0 : ((dailyAverage - worst.revenue) / dailyAverage) * 100

    return [
      {
        key: 'best',
        icon: ArrowUpRight,
        label: 'Best day',
        value: formatCurrency(best.revenue, currency),
        detail: `${formatDateLong(fromDateKey(best.date))} · ${formatNumber(
          best.bookings,
        )} bookings, ${aboveAverage.toFixed(0)}% above the daily average`,
        tone: 'good',
      },
      {
        key: 'worst',
        icon: ArrowDownRight,
        label: 'Softest day',
        value: formatCurrency(worst.revenue, currency),
        detail: `${formatDateLong(fromDateKey(worst.date))} · ${formatNumber(
          worst.bookings,
        )} bookings, ${belowAverage.toFixed(0)}% below the daily average`,
        tone: 'bad',
      },
      {
        key: 'average',
        icon: Sigma,
        label: 'Daily average',
        value: formatCurrency(Math.round(dailyAverage), currency),
        detail: `${formatCurrency(total, currency, { compact: true })} across ${formatNumber(
          points.length,
        )} days and ${formatNumber(totalBookings)} bookings`,
        tone: 'neutral',
      },
      {
        key: 'trend',
        icon: trend > 1 ? TrendingUp : trend < -1 ? TrendingDown : Minus,
        label: 'Within-range trend',
        value: formatDelta(trend),
        detail:
          Math.abs(trend) < 1
            ? 'Second half of the range is flat against the first — demand is holding steady'
            : `Second half of the range ${trend > 0 ? 'ran ahead of' : 'fell behind'} the first half, day for day`,
        tone: trend > 1 ? 'good' : trend < -1 ? 'bad' : 'neutral',
      },
    ]
  }, [points, currency])

  const metricSwitcher = (
    <Segmented
      size="sm"
      label="Metric"
      value={metric}
      onValueChange={(next) => setMetric(next)}
      options={METRIC_OPTIONS}
    />
  )

  return (
    <section className={cn('space-y-4', className)} aria-label="Revenue performance">
      <RevenueAreaChart
        points={points}
        metric={metric}
        currency={currency}
        showComparison={comparison === 'previous'}
        showAverage
        height={340}
        loading={loading}
        title={METRIC_OPTIONS.find((o) => o.value === metric)?.label ?? 'Revenue'}
        description={
          comparison === 'previous'
            ? `${rangeLabel}, with the previous period shadowed behind it`
            : `${rangeLabel} — year-over-year needs twelve months of history, so no comparison series is drawn`
        }
        toolbar={metricSwitcher}
      />

      {/* ---------- best / worst / average / trend ---------- */}
      {loading ? (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line-subtle sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-surface p-4">
              <Skeleton shape="line" className="h-3 w-20" />
              <Skeleton shape="block" className="mt-3 h-6 w-28 rounded-lg" />
              <Skeleton shape="line" className="mt-3 h-2.5 w-full" />
            </div>
          ))}
        </div>
      ) : callouts.length > 0 ? (
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-line bg-line-subtle sm:grid-cols-2 lg:grid-cols-4">
          {callouts.map((callout) => (
            <div key={callout.key} className="group bg-surface p-4 transition-colors hover:bg-background-subtle">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-md',
                    TONE_CHIP[callout.tone],
                  )}
                >
                  <callout.icon aria-hidden="true" className="size-3.5" strokeWidth={2.2} />
                </span>
                <span className="truncate text-[0.8125rem] font-medium text-muted">{callout.label}</span>
              </div>
              <p className="mt-2.5 font-display text-xl font-semibold tracking-[-0.02em] tabular-nums text-foreground">
                {callout.value}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-subtle">{callout.detail}</p>
            </div>
          ))}
        </div>
      ) : null}

      {/* ---------- bookings vs cancellations ---------- */}
      <BookingsBarChart
        points={points}
        currency={currency}
        height={280}
        loading={loading}
        title="Bookings and cancellations per day"
        description="Cancellations are stacked against the bookings they came from, so a bad weather window is visible as a shape rather than a footnote."
        toolbar={
          <span className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[0.6875rem] font-medium text-subtle sm:inline-flex">
            <CalendarRange aria-hidden="true" className="size-3.5" />
            {rangeLabel}
          </span>
        }
      />
    </section>
  )
}
