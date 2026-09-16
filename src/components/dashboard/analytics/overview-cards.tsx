'use client'

import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Gauge, Minus, Wallet } from 'lucide-react'

import { RadialGauge } from '@/components/charts/radial-gauge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, formatDelta, formatNumber, formatPercent, percentChange, sum } from '@/lib/utils'
import type { BookingChannel, ChannelBreakdown, CurrencyCode, TimeSeriesPoint } from '@/types'

/* ==========================================================================
   The three cards that open the analytics overview: what you took, how full
   the boats were, and where the bookings came from. Each answers in one
   glance and points at the tab that has the rest.
   ========================================================================== */

/** One tone per channel, shared by every channel visual on the page. */
export const CHANNEL_TONE: Record<BookingChannel, string> = {
  website_widget: 'var(--primary)',
  direct: 'var(--chart-2)',
  ota: 'var(--chart-6)',
  phone: 'var(--fg-subtle)',
  walk_in: 'var(--chart-4)',
  reseller: 'var(--chart-5)',
  concierge: 'var(--chart-3)',
  google: 'var(--chart-7)',
}

/* --------------------------------------------------------------------------
   Small parts
   -------------------------------------------------------------------------- */

export function DeltaPill({
  value,
  goodWhenUp = true,
  className,
}: {
  value: number
  goodWhenUp?: boolean
  className?: string
}) {
  const up = value > 0.5
  const down = value < -0.5
  const good = up ? goodWhenUp : down ? !goodWhenUp : null
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums',
        good === null ? 'bg-surface-sunken text-subtle' : good ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" strokeWidth={2.5} />
      {formatDelta(value)}
    </span>
  )
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const w = 120
  const h = 36
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)] as const)
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-[7.5rem] shrink-0 overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={color} />
    </svg>
  )
}

function CardTop({ title, hint, icon: Icon }: { title: string; hint: string; icon: typeof Wallet }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-subtle">{hint}</p>
      </div>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
      </span>
    </div>
  )
}

function CardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton shape="line" className="h-3.5 w-28" />
      <Skeleton shape="block" className="mt-5 h-9 w-40 rounded-lg" />
      <Skeleton shape="line" className="mt-4 h-2.5 w-full" />
      <Skeleton shape="line" className="mt-2 h-2.5 w-2/3" />
    </Card>
  )
}

/* --------------------------------------------------------------------------
   1. Revenue
   -------------------------------------------------------------------------- */

export function RevenueSummaryCard({
  points,
  currency,
  comparison,
  loading = false,
  className,
}: {
  points: TimeSeriesPoint[]
  currency: CurrencyCode
  comparison: 'previous' | 'year'
  loading?: boolean
  className?: string
}) {
  if (loading) return <CardSkeleton />
  const current = sum(points.map((p) => p.revenue))
  const previous = sum(points.map((p) => p.prevRevenue))
  const delta = percentChange(current, previous)
  const daily = points.length > 0 ? current / points.length : 0
  const bookings = sum(points.map((p) => p.bookings))

  return (
    <Card className={cn('flex flex-col p-5', className)}>
      <CardTop title="Net revenue" hint="After refunds, by departure date" icon={Wallet} />

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-[2rem] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums">
            {formatCurrency(current, currency)}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-subtle">
            <DeltaPill value={delta} />
            {comparison === 'previous' ? 'vs previous period' : 'vs last year'}
          </p>
        </div>
        <Spark values={points.map((p) => p.revenue)} color="var(--series-revenue)" />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line-subtle pt-4">
        <div>
          <dt className="text-[0.6875rem] text-subtle">Previous period</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{formatCurrency(previous, currency)}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-subtle">Daily average</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(Math.round(daily), currency)}
            <span className="ml-1 text-[0.6875rem] font-normal text-subtle">· {formatNumber(bookings)} bookings</span>
          </dd>
        </div>
      </dl>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   2. Occupancy
   -------------------------------------------------------------------------- */

export function OccupancyGaugeCard({
  occupancy,
  points,
  loading = false,
  className,
}: {
  occupancy: number
  points: TimeSeriesPoint[]
  loading?: boolean
  className?: string
}) {
  if (loading) return <CardSkeleton />
  const booked = sum(points.map((p) => p.bookings))
  const cancelled = sum(points.map((p) => p.cancellations))
  const cancelRate = booked + cancelled > 0 ? (cancelled / (booked + cancelled)) * 100 : 0
  const empty = Math.max(0, 100 - occupancy)

  const legend = [
    { label: 'Seats sold', value: formatPercent(occupancy, 1), color: 'var(--series-occupancy)' },
    { label: 'Left empty', value: formatPercent(empty, 1), color: 'var(--border-strong)' },
    { label: 'Cancelled', value: formatPercent(cancelRate, 1), color: 'var(--series-cancellations)' },
  ]

  return (
    <Card className={cn('flex flex-col p-5', className)}>
      <CardTop title="Capacity" hint="Seats sold across every departure" icon={Gauge} />

      <div className="mt-2 flex items-center justify-between gap-4">
        <RadialGauge value={occupancy} size={136} thickness={11} label="sold" showTicks={false} ariaLabel="Seats sold" />
        <ul className="flex flex-1 flex-col gap-2.5">
          {legend.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5">
              <span aria-hidden="true" className="h-3.5 w-1 shrink-0 rounded-full" style={{ background: item.color }} />
              <span className="text-[0.8125rem] font-semibold text-foreground tabular-nums">{item.value}</span>
              <span className="text-xs text-subtle">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   3. Top channels
   -------------------------------------------------------------------------- */

export function TopChannelsCard({
  channels,
  loading = false,
  onSeeAll,
  className,
}: {
  channels: ChannelBreakdown[]
  loading?: boolean
  onSeeAll?: () => void
  className?: string
}) {
  if (loading) return <CardSkeleton />
  const top = [...channels].sort((a, b) => b.share - a.share).slice(0, 3)

  return (
    <Card className={cn('flex flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">Top channels</h3>
          <p className="mt-0.5 text-xs text-subtle">Share of net revenue</p>
        </div>
        <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-semibold text-muted tabular-nums">
          Top 3 of {channels.length}
        </span>
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-3.5">
        {top.map((channel) => (
          <li key={channel.channel}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] font-medium text-foreground">
                <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: CHANNEL_TONE[channel.channel] }} />
                <span className="truncate">{channel.label}</span>
              </span>
              <span className="text-[0.8125rem] font-semibold text-foreground tabular-nums">{formatPercent(channel.share, 1)}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-well">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]"
                style={{ width: `${Math.max(2, Math.min(100, channel.share))}%`, background: CHANNEL_TONE[channel.channel] }}
              />
            </div>
          </li>
        ))}
      </ul>

      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          All channels
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </Card>
  )
}
