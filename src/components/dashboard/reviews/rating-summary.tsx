'use client'

/**
 * Reputation header: the headline score, the 5→1 distribution, and the trend of
 * the score itself over the last quarter. Three tiles that share the chart
 * card's chrome so the row reads as one instrument panel.
 */

import * as React from 'react'
import { MessageSquareWarning, Star } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { cn, formatNumber, formatPercent } from '@/lib/utils'
import { CHART_INK, ChartContainer, ChartDeltaChip } from '@/components/charts/chart-container'
import { CHART_CURSOR_LINE, ChartTooltip } from '@/components/charts/chart-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/* ==========================================================================
   STARS — shared by the review cards and the guest profile
   ========================================================================== */

const STAR_SIZE = {
  xs: 'size-3',
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-6',
} as const

export interface StarRatingProps {
  /** 0–5. Halves are rendered as a clipped overlay, not rounded away. */
  value: number
  size?: keyof typeof STAR_SIZE
  /** Hides the numeric readout that follows the stars. */
  hideValue?: boolean
  className?: string
}

export function StarRating({ value, size = 'sm', hideValue = true, className }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value))

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <span className="relative inline-flex" aria-hidden="true">
        <span className="inline-flex w-max gap-0.5 text-line-strong">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star key={i} className={cn(STAR_SIZE[size], 'shrink-0 fill-current')} />
          ))}
        </span>
        {/* Partial fill: the gold row is clipped to the score, so 4.5 reads as 4.5. */}
        <span
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${(clamped / 5) * 100}%` }}
        >
          <span className="inline-flex w-max gap-0.5 text-warning">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className={cn(STAR_SIZE[size], 'shrink-0 fill-current')} />
            ))}
          </span>
        </span>
      </span>
      {hideValue ? null : (
        <span className="tabular text-xs font-medium text-muted">{clamped.toFixed(1)}</span>
      )}
      <span className="sr-only">{clamped.toFixed(1)} out of 5 stars</span>
    </span>
  )
}

/* ==========================================================================
   SUMMARY
   ========================================================================== */

export interface RatingDistributionBucket {
  rating: number
  count: number
  /** 0-100. */
  share: number
}

export interface RatingTrendPoint {
  key: string
  label: string
  /** Mean stars for the bucket. */
  average: number
  count: number
}

export interface RatingSummaryProps {
  average: number
  total: number
  withComments: number
  /** Ordered 5 → 1. */
  distribution: RatingDistributionBucket[]
  trend: RatingTrendPoint[]
  deltaPercent: number
  comparisonLabel: string
  /** Low ratings still waiting on a reply. */
  needsAttention: number
  /** Share of completed trips that left a rating, 0-100. */
  reviewRate: number
  className?: string
}

const BAR_TONE: Record<number, string> = {
  5: 'bg-success',
  4: 'bg-primary',
  3: 'bg-warning',
  2: 'bg-accent',
  1: 'bg-danger',
}

export function RatingSummary({
  average,
  total,
  withComments,
  distribution,
  trend,
  deltaPercent,
  comparisonLabel,
  needsAttention,
  reviewRate,
  className,
}: RatingSummaryProps) {
  const reduceMotion = useReducedMotion()
  const gradientId = `ezra-rating-${React.useId().replace(/:/g, '')}`

  const trendAverage = React.useMemo(() => {
    if (trend.length === 0) return average
    const weighted = trend.reduce((acc, point) => acc + point.average * Math.max(point.count, 1), 0)
    const weight = trend.reduce((acc, point) => acc + Math.max(point.count, 1), 0)
    return weight === 0 ? average : weighted / weight
  }, [trend, average])

  const domain = React.useMemo<[number, number]>(() => {
    const lows = trend.map((point) => point.average).filter((v) => v > 0)
    const min = lows.length === 0 ? 3.5 : Math.min(...lows)
    return [Math.max(1, Math.floor((min - 0.25) * 4) / 4), 5]
  }, [trend])

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {/* ---- headline score ---- */}
      <Card variant="gradient" className="justify-between">
        <CardContent className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-subtle uppercase">
              Average rating
            </p>
            <ChartDeltaChip value={deltaPercent} size="xs" />
          </div>

          <div className="mt-4 flex items-end gap-2">
            <span className="tabular font-display text-5xl leading-none font-semibold tracking-tight text-foreground">
              {average.toFixed(2)}
            </span>
            <span className="pb-1 text-sm text-subtle">/ 5</span>
          </div>

          <StarRating value={average} size="lg" className="mt-3" />

          <p className="mt-3 text-xs text-muted">
            <span className="tabular font-medium text-foreground">{formatNumber(total)}</span>{' '}
            ratings on file
          </p>
          <p className="mt-1 text-[0.6875rem] text-subtle">{comparisonLabel}</p>

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3">
            <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted">
              {formatPercent(reviewRate, 0)} of trips reviewed
            </span>
            {needsAttention > 0 ? (
              <span className="tabular inline-flex items-center gap-1 rounded-md bg-warning-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-warning">
                <MessageSquareWarning className="size-3" aria-hidden="true" />
                {needsAttention} need a reply
              </span>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {/* ---- distribution ---- */}
      <Card>
        <CardHeader className="pb-3">
          <div className="min-w-0">
            <CardTitle>Distribution</CardTitle>
            <p className="mt-1 text-xs text-muted">
              {formatNumber(withComments)} left a written review
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {distribution.map((bucket) => (
              <li key={bucket.rating} className="flex items-center gap-2.5">
                <span className="tabular flex w-7 shrink-0 items-center gap-0.5 text-xs font-medium text-muted">
                  {bucket.rating}
                  <Star className="size-3 fill-current text-warning" aria-hidden="true" />
                </span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className={cn(
                      'block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]',
                      'motion-reduce:transition-none',
                      BAR_TONE[bucket.rating],
                    )}
                    style={{ width: `${Math.max(bucket.share, bucket.count > 0 ? 1.5 : 0)}%` }}
                  />
                </span>
                <span className="tabular w-14 shrink-0 text-right text-xs text-subtle">
                  {formatNumber(bucket.count)}
                </span>
                <span className="tabular hidden w-10 shrink-0 text-right text-xs text-faint sm:block">
                  {bucket.share.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ---- trend ---- */}
      <ChartContainer
        className="sm:col-span-2"
        title="Rating trend"
        description="Weekly mean stars, attributed to the departure date"
        ariaLabel={`Average rating by week over the last ${trend.length} weeks. Period mean ${trendAverage.toFixed(2)} stars.`}
        height={196}
        empty={trend.length === 0}
        emptyMessage="No rated departures in this window yet."
        footer={
          <p className="text-xs text-subtle">
            Period mean{' '}
            <span className="tabular font-medium text-foreground">{trendAverage.toFixed(2)}</span>{' '}
            stars across {formatNumber(trend.reduce((acc, point) => acc + point.count, 0))} rated
            trips.
          </p>
        }
        dataTable={
          <table>
            <caption>Average rating by week</caption>
            <thead>
              <tr>
                <th scope="col">Week</th>
                <th scope="col">Average rating</th>
                <th scope="col">Ratings</th>
              </tr>
            </thead>
            <tbody>
              {trend.map((point) => (
                <tr key={point.key}>
                  <th scope="row">{point.label}</th>
                  <td>{point.average.toFixed(2)}</td>
                  <td>{point.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        }
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-4)" stopOpacity={0.38} />
                <stop offset="100%" stopColor="var(--chart-4)" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke={CHART_INK.grid} strokeWidth={1} />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={24}
              tick={{ fill: CHART_INK.tick, fontSize: 11 }}
            />
            <YAxis
              width={34}
              domain={domain}
              tickCount={4}
              tickFormatter={(value: number) => value.toFixed(1)}
              tickLine={false}
              axisLine={false}
              tickMargin={6}
              tick={{ fill: CHART_INK.tick, fontSize: 11 }}
            />

            <ReferenceLine
              y={trendAverage}
              stroke={CHART_INK.reference}
              strokeDasharray="4 4"
              strokeWidth={1}
            />

            <Tooltip
              cursor={CHART_CURSOR_LINE}
              isAnimationActive={false}
              content={
                <ChartTooltip
                  formatValue={(value) => `${value.toFixed(2)} ★`}
                  formatName={() => 'Average rating'}
                  footer={(datum) => `${formatNumber(Number(datum.count ?? 0))} ratings this week`}
                />
              }
            />

            <Area
              type="monotone"
              dataKey="average"
              stroke="var(--chart-4)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
              isAnimationActive={!reduceMotion}
              animationDuration={700}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartContainer>
    </div>
  )
}
