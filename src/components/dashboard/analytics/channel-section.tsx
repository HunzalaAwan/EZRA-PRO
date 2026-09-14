'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Info, Scale } from 'lucide-react'

import { ChannelDonutChart, type ChannelMetric } from '@/components/charts/channel-donut-chart'
import { ChartDeltaChip, chartColorVar } from '@/components/charts/chart-container'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn, formatCurrency, formatNumber, formatPercent, sum } from '@/lib/utils'
import type { BookingChannel, ChannelBreakdown, CurrencyCode } from '@/types'

/* ==========================================================================
   ChannelSection

   Gross revenue by channel is the number every booking platform shows. It is
   also the one that flatters OTAs, because it stops before the commission is
   handed back. This section carries the take rate all the way through to net
   and net-per-booking, which is the number that decides where the next
   marketing dollar goes.
   ========================================================================== */

/**
 * Effective take rate per channel — marketplace commission plus payment
 * processing, as a percent of gross. Operators tune these in
 * Settings → Channels; these are the platform defaults.
 */
const TAKE_RATE: Record<BookingChannel, number> = {
  direct: 2.6,
  website_widget: 2.6,
  google: 2.6,
  phone: 2.6,
  walk_in: 1.4,
  concierge: 12.6,
  reseller: 17.6,
  ota: 24.6,
}

const METRIC_OPTIONS: { value: ChannelMetric; label: string }[] = [
  { value: 'revenue', label: 'Revenue' },
  { value: 'bookings', label: 'Bookings' },
]

const ROW_GRID = 'lg:grid-cols-[minmax(0,1fr)_4.75rem_7rem_5.75rem_5.25rem_7rem_6.5rem]'

interface ChannelRow extends ChannelBreakdown {
  take: number
  net: number
  commission: number
  netPerBooking: number
  color: string
}

function Cell({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 lg:text-right', className)}>
      <span className="block text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-faint lg:hidden">
        {label}
      </span>
      <span className="mt-0.5 block text-[0.8125rem] tabular-nums lg:mt-0">{children}</span>
    </div>
  )
}

export interface ChannelSectionProps {
  channels: ChannelBreakdown[]
  currency: CurrencyCode
  rangeLabel: string
  loading?: boolean
  className?: string
}

export function ChannelSection({
  channels,
  currency,
  rangeLabel,
  loading = false,
  className,
}: ChannelSectionProps) {
  const [metric, setMetric] = React.useState<ChannelMetric>('revenue')

  const rows = React.useMemo<ChannelRow[]>(
    () =>
      channels.map((channel, index) => {
        const take = TAKE_RATE[channel.channel] ?? 0
        const net = Math.round(channel.revenue * (1 - take / 100))
        return {
          ...channel,
          take,
          net,
          commission: channel.revenue - net,
          netPerBooking: channel.bookings === 0 ? 0 : Math.round(net / channel.bookings),
          color: chartColorVar(index),
        }
      }),
    [channels],
  )

  const totals = React.useMemo(() => {
    const gross = sum(rows.map((r) => r.revenue))
    const net = sum(rows.map((r) => r.net))
    const bookings = sum(rows.map((r) => r.bookings))
    return {
      gross,
      net,
      bookings,
      commission: gross - net,
      blendedTake: gross === 0 ? 0 : ((gross - net) / gross) * 100,
    }
  }, [rows])

  const takeaway = React.useMemo(() => {
    if (rows.length < 2) return null
    const leader = rows.reduce((a, b) => (b.net > a.net ? b : a))
    const candidates = rows.filter((r) => r.channel !== leader.channel)
    const drag = (candidates.length > 0 ? candidates : rows).reduce((a, b) =>
      b.commission > a.commission ? b : a,
    )
    // Volume can only realistically be moved to the channel already doing the
    // work, so the leader is the destination — not whichever row happens to
    // carry the lowest take rate.
    return {
      leader,
      drag,
      shift: Math.round(drag.revenue * 0.1 * (Math.max(0, drag.take - leader.take) / 100)),
    }
  }, [rows])

  const maxShare = React.useMemo(() => Math.max(1, ...rows.map((r) => r.share)), [rows])

  return (
    <section className={cn('space-y-4', className)} aria-label="Booking channels">
      <div className="grid gap-4 xl:grid-cols-5">
        {/* ---------- donut ---------- */}
        <div className="xl:col-span-2 xl:self-start">
          <ChannelDonutChart
            channels={channels}
            metric={metric}
            currency={currency}
            height={300}
            loading={loading}
            title="Channel mix"
            description={`Gross ${metric === 'revenue' ? 'revenue' : 'bookings'} share, ${rangeLabel.toLowerCase()}`}
            toolbar={
              <Segmented
                size="sm"
                label="Channel metric"
                value={metric}
                onValueChange={(next) => setMetric(next)}
                options={METRIC_OPTIONS}
              />
            }
          />
        </div>

        {/* ---------- ranked economics table ---------- */}
        <Card className="xl:col-span-3">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Channel economics</CardTitle>
              <CardDescription>
                Gross carried through commission and processing to what actually lands in the
                account.
              </CardDescription>
            </div>
            <CardToolbar>
              <SimpleTooltip
                label="Take rate = marketplace commission plus payment processing. These are the platform defaults; edit them in Settings → Channels."
                side="left"
              >
                <span
                  tabIndex={0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[0.6875rem] font-medium text-subtle transition-colors hover:text-foreground"
                >
                  <Scale aria-hidden="true" className="size-3.5" />
                  Blended take {formatPercent(totals.blendedTake, 1)}
                </span>
              </SimpleTooltip>
            </CardToolbar>
          </CardHeader>

          <CardContent bleed className="px-3.5 sm:px-4">
            {loading ? (
              <div className="space-y-2 pb-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} shape="block" className="h-12 rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {/* header — desktop only; the mobile rows carry their own labels */}
                <div
                  className={cn(
                    'hidden gap-x-4 border-b border-line-subtle pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-faint lg:grid',
                    ROW_GRID,
                  )}
                >
                  <span>Channel</span>
                  <span className="text-right">Bookings</span>
                  <span className="text-right">Gross</span>
                  <span className="text-right">Δ vs prev</span>
                  <span className="text-right">Take</span>
                  <span className="text-right">Net</span>
                  <span className="text-right">Net / booking</span>
                </div>

                <ul className="divide-y divide-line-subtle">
                  {rows.map((row) => (
                    <li
                      key={row.channel}
                      className={cn(
                        '-mx-1.5 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-lg px-1.5 py-3 transition-colors hover:bg-surface-sunken/70 lg:items-center lg:gap-y-0',
                        ROW_GRID,
                      )}
                    >
                      <div className="col-span-2 min-w-0 lg:col-span-1">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-[3px]"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="truncate text-[0.8125rem] font-medium text-foreground">
                            {row.label}
                          </span>
                          <span className="shrink-0 text-[0.6875rem] tabular-nums text-faint">
                            {formatPercent(row.share, 1)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1 w-full max-w-44 overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(3, (row.share / maxShare) * 100)}%`,
                              backgroundColor: row.color,
                            }}
                          />
                        </div>
                      </div>

                      <Cell label="Bookings">{formatNumber(row.bookings)}</Cell>
                      <Cell label="Gross">
                        {formatCurrency(row.revenue, currency, { compact: true })}
                      </Cell>
                      <div className="min-w-0 lg:text-right">
                        <span className="block text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-faint lg:hidden">
                          Δ vs prev
                        </span>
                        <ChartDeltaChip value={row.deltaPercent} className="mt-0.5 lg:mt-0" />
                      </div>
                      <Cell label="Take" className="text-muted">
                        {formatPercent(row.take, 1)}
                      </Cell>
                      <Cell label="Net" className="font-semibold text-foreground">
                        {formatCurrency(row.net, currency, { compact: true })}
                      </Cell>
                      <Cell label="Net / booking" className="text-muted">
                        {formatCurrency(row.netPerBooking, currency)}
                      </Cell>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>

          <CardFooter separated className="flex-wrap justify-between gap-x-6 gap-y-1.5 text-xs text-subtle">
            <span>
              <span className="font-medium text-foreground">
                {formatCurrency(totals.gross, currency)}
              </span>{' '}
              gross · {formatNumber(totals.bookings)} bookings
            </span>
            <span>
              <span className="font-medium text-danger">
                −{formatCurrency(totals.commission, currency)}
              </span>{' '}
              commission &amp; processing
            </span>
            <span>
              <span className="font-medium text-success">
                {formatCurrency(totals.net, currency)}
              </span>{' '}
              net
            </span>
          </CardFooter>
        </Card>
      </div>

      {/* ---------- written takeaway ---------- */}
      {loading ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <Skeleton shape="line" className="h-3 w-40" />
          <Skeleton shape="line" className="mt-3 h-2.5 w-full" />
          <Skeleton shape="line" className="mt-2 h-2.5 w-4/5" />
        </div>
      ) : takeaway ? (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-primary via-accent to-transparent"
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary-soft px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-primary">
              <Info aria-hidden="true" className="size-3" />
              What this says
            </span>
            <span className="text-[0.6875rem] text-faint">{rangeLabel}</span>
          </div>

          <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted">
            <span className="font-semibold text-foreground">{takeaway.leader.label}</span> is your
            strongest channel on the only measure that matters:{' '}
            <span className="font-medium text-foreground">
              {formatCurrency(takeaway.leader.net, currency)}
            </span>{' '}
            net from {formatNumber(takeaway.leader.bookings)} bookings at a{' '}
            {formatPercent(takeaway.leader.take, 1)} take rate —{' '}
            {formatCurrency(takeaway.leader.netPerBooking, currency)} landing per booking.{' '}
            <span className="font-semibold text-foreground">{takeaway.drag.label}</span> looks
            healthy at {formatCurrency(takeaway.drag.revenue, currency)} gross, but{' '}
            <span className="font-medium text-danger">
              {formatCurrency(takeaway.drag.commission, currency)}
            </span>{' '}
            of it never reaches you, leaving{' '}
            {formatCurrency(takeaway.drag.netPerBooking, currency)} per booking. Moving just 10% of{' '}
            {takeaway.drag.label.toLowerCase()} volume onto {takeaway.leader.label.toLowerCase()} is
            worth roughly{' '}
            <span className="font-medium text-success">
              {formatCurrency(takeaway.shift, currency)}
            </span>{' '}
            over this range alone.
          </p>

          <Link
            href="/dashboard/storefront"
            className="mt-3.5 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-primary transition-colors hover:text-primary-hover"
          >
            Tune your direct storefront
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </section>
  )
}
