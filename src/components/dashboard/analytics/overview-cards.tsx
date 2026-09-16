'use client'

import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronRight, Gauge, Minus, Wallet } from 'lucide-react'

import { RadialGauge } from '@/components/charts/radial-gauge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  cn,
  formatCurrency,
  formatDateShort,
  formatDelta,
  formatNumber,
  formatPercent,
  fromDateKey,
  percentChange,
  sum,
} from '@/lib/utils'
import type { BookingChannel, ChannelBreakdown, CurrencyCode, TimeSeriesPoint } from '@/types'
import { TAKE_RATE } from './channel-section'

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

/** Card processing alone; anything above it is a partner's cut. */
const PROCESSING_RATE = 2.6
const DIRECT_CHANNELS = new Set<BookingChannel>(['website_widget', 'direct', 'phone', 'walk_in'])

/* --------------------------------------------------------------------------
   Small parts
   -------------------------------------------------------------------------- */

export function DeltaPill({
  value,
  goodWhenUp = true,
  label,
  className,
}: {
  value: number
  goodWhenUp?: boolean
  /** Replaces the formatted percentage, e.g. for point changes. */
  label?: string
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
      {label ?? formatDelta(value)}
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

const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const WEEKDAY_NAMES = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays']

/** Average of `pick` per weekday, Monday first. Days with no data read as null. */
function weekdayProfile(points: TimeSeriesPoint[], pick: (p: TimeSeriesPoint) => number) {
  const totals = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }))
  for (const point of points) {
    const day = (fromDateKey(point.date).getDay() + 6) % 7
    totals[day].sum += pick(point)
    totals[day].n += 1
  }
  return totals.map((t) => (t.n > 0 ? t.sum / t.n : null))
}

function WeekdayBars({
  title,
  values,
  color,
  format,
}: {
  title: string
  values: (number | null)[]
  color: string
  format: (value: number) => string
}) {
  const known = values.filter((v): v is number => v !== null)
  if (known.length === 0) return null
  const max = Math.max(...known)
  const peak = values.indexOf(max)
  const low = values.indexOf(Math.min(...known))

  return (
    <div className="border-t border-line-subtle pt-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[0.6875rem] font-medium text-subtle">{title}</span>
        <span className="truncate text-[0.6875rem] text-subtle">
          <span className="font-semibold text-foreground">{WEEKDAY_NAMES[peak]}</span> peak at{' '}
          <span className="font-semibold text-foreground tabular-nums">{format(max)}</span>
        </span>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1.5" role="img" aria-label={`${title} by weekday`}>
        {values.map((value, i) => (
          <div key={WEEKDAY_NAMES[i]} className="flex flex-col items-center gap-1">
            <div className="flex h-12 w-full items-end rounded-md bg-well">
              <div
                title={value === null ? 'No departures' : `${WEEKDAY_NAMES[i]} · ${format(value)}`}
                className="w-full rounded-md transition-[height] duration-700 ease-[var(--ease-out-expo)]"
                style={{
                  height: value === null ? '0%' : `${Math.max(8, (value / (max || 1)) * 100)}%`,
                  background: color,
                  opacity: i === peak ? 1 : i === low ? 0.4 : 0.6,
                }}
              />
            </div>
            <span className={cn('text-[0.625rem] tabular-nums', i === peak ? 'font-semibold text-foreground' : 'text-faint')}>
              {WEEKDAY_LETTERS[i]}
            </span>
          </div>
        ))}
      </div>
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
  const best = points.reduce<TimeSeriesPoint | null>((top, p) => (!top || p.revenue > top.revenue ? p : top), null)
  const soft = points.reduce<TimeSeriesPoint | null>((low, p) => (!low || p.revenue < low.revenue ? p : low), null)
  const aov = bookings > 0 ? current / bookings : 0

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
        <div>
          <dt className="text-[0.6875rem] text-subtle">Average order</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{formatCurrency(Math.round(aov), currency)}</dd>
        </div>
        {best ? (
          <div>
            <dt className="text-[0.6875rem] text-subtle">Best day</dt>
            <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
              {formatCurrency(best.revenue, currency, { compact: true })}
              <span className="ml-1 text-[0.6875rem] font-normal text-subtle">{formatDateShort(fromDateKey(best.date))}</span>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-4">
        <WeekdayBars
          title="Revenue by weekday"
          values={weekdayProfile(points, (p) => p.revenue)}
          color="var(--series-revenue)"
          format={(v) => formatCurrency(Math.round(v), currency, { compact: true })}
        />
      </div>

      {best && soft ? (
        <p className="mt-auto border-t border-line-subtle pt-3 text-[0.6875rem] leading-relaxed text-subtle">
          The softest day, {formatDateShort(fromDateKey(soft.date))}, took{' '}
          <span className="font-medium text-foreground tabular-nums">{formatCurrency(soft.revenue, currency, { compact: true })}</span>;
          the best took {best.revenue > 0 && soft.revenue > 0 ? (best.revenue / soft.revenue).toFixed(1) : '—'}× that.
        </p>
      ) : null}
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
  const bestDay = points.reduce<TimeSeriesPoint | null>((top, p) => (!top || p.occupancy > top.occupancy ? p : top), null)
  const softDay = points.reduce<TimeSeriesPoint | null>((low, p) => (!low || p.occupancy < low.occupancy ? p : low), null)
  const fullDays = points.filter((p) => p.occupancy >= 95).length

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

      {/* ---------- every day in the range, as a strip ---------- */}
      {points.length > 1 ? (
        <div className="mt-3">
          <div className="flex h-8 items-end gap-px" role="img" aria-label="Occupancy by day">
            {points.map((p) => (
              <span
                key={p.date}
                title={`${formatDateShort(fromDateKey(p.date))} · ${formatPercent(p.occupancy, 0)}`}
                className="flex-1 rounded-t-[2px]"
                style={{
                  height: `${Math.max(6, p.occupancy)}%`,
                  background: 'var(--series-occupancy)',
                  opacity: 0.35 + (Math.max(0, Math.min(100, p.occupancy)) / 100) * 0.65,
                }}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[0.625rem] text-faint tabular-nums">
            <span>{formatDateShort(fromDateKey(points[0].date))}</span>
            <span>{formatDateShort(fromDateKey(points[points.length - 1].date))}</span>
          </div>
        </div>
      ) : null}

      <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-line-subtle pt-3">
        <div>
          <dt className="text-[0.6875rem] text-subtle">Fullest day</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {bestDay ? formatPercent(bestDay.occupancy, 0) : '—'}
            {bestDay ? <span className="ml-1 text-[0.6875rem] font-normal text-subtle">{formatDateShort(fromDateKey(bestDay.date))}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-subtle">Softest day</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {softDay ? formatPercent(softDay.occupancy, 0) : '—'}
            {softDay ? <span className="ml-1 text-[0.6875rem] font-normal text-subtle">{formatDateShort(fromDateKey(softDay.date))}</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-subtle">Sold-out days</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {formatNumber(fullDays)}
            <span className="ml-1 text-[0.6875rem] font-normal text-subtle">of {formatNumber(points.length)}</span>
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <WeekdayBars
          title="Occupancy by weekday"
          values={weekdayProfile(points, (p) => p.occupancy)}
          color="var(--series-occupancy)"
          format={(v) => formatPercent(v, 0)}
        />
      </div>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   3. Top channels
   -------------------------------------------------------------------------- */

export function TopChannelsCard({
  channels,
  currency,
  loading = false,
  onSeeAll,
  className,
}: {
  channels: ChannelBreakdown[]
  currency: CurrencyCode
  loading?: boolean
  onSeeAll?: () => void
  className?: string
}) {
  if (loading) return <CardSkeleton />
  const ordered = [...channels].sort((a, b) => b.share - a.share)
  const top = ordered.slice(0, 3)
  const totalRevenue = sum(ordered.map((c) => c.revenue))

  // Website, direct, phone and walk-in pay only card processing; the rest pay a partner too.
  const direct = ordered.filter((c) => DIRECT_CHANNELS.has(c.channel))
  const directShare = totalRevenue > 0 ? (sum(direct.map((c) => c.revenue)) / totalRevenue) * 100 : 0
  const commission = sum(
    ordered.map((c) => c.revenue * (Math.max(0, TAKE_RATE[c.channel] - PROCESSING_RATE) / 100)),
  )
  const fastest = ordered.reduce<ChannelBreakdown | null>(
    (best, c) => (!best || c.deltaPercent > best.deltaPercent ? c : best),
    null,
  )
  const richest = ordered
    .filter((c) => c.bookings > 0)
    .map((c) => ({ channel: c, aov: c.revenue / c.bookings }))
    .sort((a, b) => b.aov - a.aov)[0]

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

      <ul className="mt-4 flex flex-col gap-3">
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
            <p className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] text-subtle tabular-nums">
              <span>{formatCurrency(channel.revenue, currency, { compact: true })}</span>
              <span aria-hidden="true">·</span>
              <span>{formatNumber(channel.bookings)} bookings</span>
              <span aria-hidden="true">·</span>
              <span>
                {channel.bookings > 0 ? formatCurrency(Math.round(channel.revenue / channel.bookings), currency) : '—'} avg
              </span>
              <DeltaPill value={channel.deltaPercent} className="ml-auto" />
            </p>
          </li>
        ))}
      </ul>

      {/* ---------- the economics behind the mix ---------- */}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line-subtle pt-4">
        <div>
          <dt className="text-[0.6875rem] text-subtle">Direct share</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {formatPercent(directShare, 0)}
            <span className="ml-1 text-[0.6875rem] font-normal text-subtle">no commission</span>
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-subtle">Commission paid</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(Math.round(commission), currency, { compact: true })}
            <span className="ml-1 text-[0.6875rem] font-normal text-subtle">to OTAs and partners</span>
          </dd>
        </div>
        {fastest ? (
          <div className="min-w-0">
            <dt className="text-[0.6875rem] text-subtle">Fastest growing</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{fastest.label}</span>
              <DeltaPill value={fastest.deltaPercent} />
            </dd>
          </div>
        ) : null}
        {richest ? (
          <div className="min-w-0">
            <dt className="text-[0.6875rem] text-subtle">Highest avg order</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-foreground tabular-nums">
              <span className="truncate">{richest.channel.label}</span>
              <span className="text-muted">{formatCurrency(Math.round(richest.aov), currency)}</span>
            </dd>
          </div>
        ) : null}
      </dl>

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
