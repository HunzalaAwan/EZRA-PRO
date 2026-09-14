'use client'

import * as React from 'react'
import { Gauge, Ticket, Users, Wallet } from 'lucide-react'

import { ChartDeltaChip } from '@/components/charts/chart-container'
import { RevenueAreaChart, type RevenueMetric } from '@/components/charts/revenue-area-chart'
import { Card } from '@/components/ui/card'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import {
  average,
  cn,
  formatCurrency,
  formatDateShort,
  formatNumber,
  formatPercent,
  fromDateKey,
  percentChange,
  pluralize,
  sum,
} from '@/lib/utils'
import type { CurrencyCode, TimeSeriesPoint } from '@/types'

/* ==========================================================================
   RevenuePanel — the hero.

   One summary strip (headline figure, honest delta, three supporting reads)
   sitting on top of `<RevenueAreaChart>`, which brings its own ChartContainer
   chrome. The container's border/background are neutralised so the two read as
   a single card rather than a card inside a card.

   Deltas are only shown when a real comparison window exists:
   • revenue carries `prevRevenue` per point, so every window can compare;
   • the other metrics compare against the preceding slice of the same series,
     which only exists while the window is at most half the series.
   ========================================================================== */

const METRIC_OPTIONS: SegmentedOption<RevenueMetric>[] = [
  { value: 'revenue', label: 'Revenue', icon: Wallet },
  { value: 'bookings', label: 'Bookings', icon: Ticket },
  { value: 'guests', label: 'Guests', icon: Users },
  { value: 'occupancy', label: 'Occupancy', icon: Gauge },
]

type WindowSize = '7' | '14' | '30'

const WINDOW_OPTIONS: SegmentedOption<WindowSize>[] = [
  { value: '7', label: '7D', ariaLabel: 'Last 7 days' },
  { value: '14', label: '14D', ariaLabel: 'Last 14 days' },
  { value: '30', label: '30D', ariaLabel: 'Last 30 days' },
]

const METRIC_LABEL: Record<RevenueMetric, string> = {
  revenue: 'Net revenue',
  bookings: 'Bookings',
  guests: 'Guests',
  occupancy: 'Capacity utilisation',
}

/** Occupancy is a rate, so it averages; everything else accumulates. */
const IS_RATE: Record<RevenueMetric, boolean> = {
  revenue: false,
  bookings: false,
  guests: false,
  occupancy: true,
}

export interface RevenuePanelProps {
  points: TimeSeriesPoint[]
  currency: CurrencyCode
  className?: string
}

export function RevenuePanel({ points, currency, className }: RevenuePanelProps) {
  const [metric, setMetric] = React.useState<RevenueMetric>('revenue')
  const [windowSize, setWindowSize] = React.useState<WindowSize>('30')

  const days = Number(windowSize)

  const view = React.useMemo(() => {
    const current = points.slice(-days)
    const prior = points.slice(-days * 2, -days)
    const values = current.map((p) => p[metric])

    const headlineValue = IS_RATE[metric] ? average(values) : sum(values)

    // Revenue always has a true prior-period series attached to each point.
    const priorValue =
      metric === 'revenue'
        ? sum(current.map((p) => p.prevRevenue))
        : prior.length === current.length && prior.length > 0
          ? IS_RATE[metric]
            ? average(prior.map((p) => p[metric]))
            : sum(prior.map((p) => p[metric]))
          : null

    const peak = current.reduce<TimeSeriesPoint | null>(
      (best, point) => (best === null || point[metric] > best[metric] ? point : best),
      null,
    )

    return {
      current,
      headlineValue,
      priorValue,
      dailyAverage: average(values),
      peak,
      bookings: sum(current.map((p) => p.bookings)),
      guests: sum(current.map((p) => p.guests)),
    }
  }, [points, days, metric])

  const formatValue = React.useCallback(
    (value: number) => {
      switch (metric) {
        case 'revenue':
          return formatCurrency(Math.round(value), currency)
        case 'occupancy':
          return formatPercent(value, 1)
        default:
          return formatNumber(Math.round(value))
      }
    },
    [metric, currency],
  )

  const rangeLabel =
    view.current.length > 0
      ? `${formatDateShort(fromDateKey(view.current[0].date))} – ${formatDateShort(
          fromDateKey(view.current[view.current.length - 1].date),
        )}`
      : 'No data'

  const deltaPercent =
    view.priorValue !== null ? percentChange(view.headlineValue, view.priorValue) : null

  const supporting = [
    {
      label: 'Daily average',
      value: formatValue(view.dailyAverage),
    },
    {
      label: 'Best day',
      value: view.peak ? formatValue(view.peak[metric]) : '—',
      meta: view.peak ? formatDateShort(fromDateKey(view.peak.date)) : undefined,
    },
    // The headline already carries one of these, so show the other one.
    metric === 'guests'
      ? {
          label: 'Bookings taken',
          value: formatNumber(view.bookings),
          meta: `${formatNumber(view.guests)} guests`,
        }
      : {
          label: 'Guests booked',
          value: formatNumber(view.guests),
          meta: `${formatNumber(view.bookings)} ${pluralize(view.bookings, 'booking')}`,
        },
  ]

  return (
    <Card className={cn('overflow-hidden', className)}>
      {/* ---- summary strip ---------------------------------------------- */}
      <div className="flex flex-col gap-4 px-5 pt-5 sm:px-6 sm:pt-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-subtle uppercase">
            {METRIC_LABEL[metric]} · last {days} days
          </p>

          <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-2">
            <span className="font-display text-display-sm leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums">
              {formatValue(view.headlineValue)}
            </span>
            {deltaPercent === null ? (
              <span className="pb-1 text-xs text-faint">no comparable prior window</span>
            ) : (
              <ChartDeltaChip value={deltaPercent} size="sm" className="mb-1" />
            )}
          </div>

          <p className="mt-2 text-xs text-muted">
            {rangeLabel}
            {deltaPercent === null ? null : (
              <>
                {' · '}
                <span className="text-subtle">
                  {view.priorValue !== null ? formatValue(view.priorValue) : ''} in the previous{' '}
                  {days} days
                </span>
              </>
            )}
          </p>
        </div>

        <div className="-mx-1 shrink-0 overflow-x-auto px-1 pb-1 no-scrollbar lg:overflow-visible lg:pb-0">
          <Segmented
            size="sm"
            label="Metric"
            options={METRIC_OPTIONS}
            value={metric}
            onValueChange={setMetric}
          />
        </div>
      </div>

      {/* ---- supporting reads ------------------------------------------- */}
      <dl className="mt-5 grid grid-cols-3 divide-x divide-line-subtle border-y border-line-subtle bg-surface-sunken/50">
        {supporting.map((item) => (
          <div key={item.label} className="min-w-0 px-4 py-3 sm:px-5">
            <dt className="truncate text-[0.6875rem] font-medium text-subtle">{item.label}</dt>
            <dd className="mt-1 truncate font-display text-sm font-semibold tracking-[-0.01em] text-foreground tabular-nums">
              {item.value}
            </dd>
            {item.meta ? (
              <p className="mt-0.5 truncate text-[0.6875rem] text-faint">{item.meta}</p>
            ) : null}
          </div>
        ))}
      </dl>

      {/* ---- the plot ---------------------------------------------------- */}
      <RevenueAreaChart
        points={view.current}
        metric={metric}
        currency={currency}
        height={296}
        title="Daily trend"
        description={`${METRIC_LABEL[metric]} by day · ${rangeLabel}`}
        toolbar={
          <Segmented
            size="sm"
            label="Date window"
            options={WINDOW_OPTIONS}
            value={windowSize}
            onValueChange={setWindowSize}
          />
        }
        className="rounded-none border-0 bg-transparent shadow-none"
      />
    </Card>
  )
}
