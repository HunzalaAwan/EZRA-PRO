'use client'

import Link from 'next/link'
import { ChevronRight, CircleOff } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { CurrencyCode, LossBreakdown } from '@/types'
import { DeltaPill } from './overview-cards'

/* ==========================================================================
   LossesCard — what did not travel: cancellations, no-shows and the money
   that went back. Rates lead; the reasons and the cost sit underneath.
   ========================================================================== */

const TONE = {
  kept: 'var(--series-occupancy)',
  cancelled: 'var(--series-cancellations)',
  noShow: 'var(--chart-6)',
} as const

export interface LossesCardProps {
  losses: LossBreakdown
  currency: CurrencyCode
  loading?: boolean
  className?: string
}

const points = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)} pts`

export function LossesCard({ losses, currency, loading = false, className }: LossesCardProps) {
  if (loading) {
    return (
      <Card className={cn('p-5', className)}>
        <Skeleton shape="line" className="h-3.5 w-40" />
        <Skeleton shape="block" className="mt-5 h-10 w-full rounded-lg" />
        <Skeleton shape="line" className="mt-5 h-2.5 w-full" />
        <Skeleton shape="line" className="mt-2 h-2.5 w-5/6" />
        <Skeleton shape="line" className="mt-2 h-2.5 w-2/3" />
      </Card>
    )
  }

  const kept = Math.max(0, losses.total - losses.cancelled - losses.noShows)
  const share = (n: number) => (losses.total > 0 ? (n / losses.total) * 100 : 0)
  const reasonMax = Math.max(1, ...losses.reasons.map((r) => r.count))

  return (
    <Card className={cn('flex flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">
            Cancellations and no-shows
          </h3>
          <p className="mt-0.5 text-xs text-subtle">What did not travel, and what it cost</p>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-danger-soft text-danger">
          <CircleOff aria-hidden="true" className="size-4" strokeWidth={2} />
        </span>
      </div>

      {/* ---------- headline rates ---------- */}
      <dl className="mt-4 grid grid-cols-3 gap-3">
        <div className="min-w-0">
          <dt className="text-[0.6875rem] text-subtle">Cancelled</dt>
          <dd className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
            {formatPercent(losses.cancellationRate, 1)}
          </dd>
          <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-subtle tabular-nums">
            {formatNumber(losses.cancelled)} bookings
            <DeltaPill value={losses.cancellationRateDelta} goodWhenUp={false} label={points(losses.cancellationRateDelta)} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6875rem] text-subtle">No-shows</dt>
          <dd className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
            {formatPercent(losses.noShowRate, 1)}
          </dd>
          <dd className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-subtle tabular-nums">
            {formatNumber(losses.noShows)} parties
            <DeltaPill value={losses.noShowRateDelta} goodWhenUp={false} label={points(losses.noShowRateDelta)} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[0.6875rem] text-subtle">Refunded</dt>
          <dd className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
            {formatCurrency(losses.refundAmount, currency, { compact: true })}
          </dd>
          <dd className="mt-1 text-[0.6875rem] text-subtle tabular-nums">
            {formatNumber(losses.refunded)} {losses.refunded === 1 ? 'refund' : 'refunds'}
          </dd>
        </div>
      </dl>

      {/* ---------- every booking in the range, as one strip ---------- */}
      <div className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Bookings that travelled, cancelled and no-showed">
        <span className="h-full rounded-full" style={{ width: `${share(kept)}%`, background: TONE.kept }} title={`Travelled · ${formatNumber(kept)}`} />
        <span className="h-full rounded-full" style={{ width: `${Math.max(share(losses.cancelled), losses.cancelled > 0 ? 1 : 0)}%`, background: TONE.cancelled }} title={`Cancelled · ${formatNumber(losses.cancelled)}`} />
        <span className="h-full rounded-full" style={{ width: `${Math.max(share(losses.noShows), losses.noShows > 0 ? 1 : 0)}%`, background: TONE.noShow }} title={`No-show · ${formatNumber(losses.noShows)}`} />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.6875rem] text-subtle">
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: TONE.kept }} />
          Travelled <span className="font-semibold text-foreground tabular-nums">{formatNumber(kept)}</span>
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: TONE.cancelled }} />
          Cancelled <span className="font-semibold text-foreground tabular-nums">{formatNumber(losses.cancelled)}</span>
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-full" style={{ background: TONE.noShow }} />
          No-show <span className="font-semibold text-foreground tabular-nums">{formatNumber(losses.noShows)}</span>
        </li>
      </ul>

      {/* ---------- why ---------- */}
      {losses.reasons.length > 0 ? (
        <div className="mt-4 border-t border-line-subtle pt-3">
          <p className="text-[0.6875rem] font-medium text-subtle">Top reasons</p>
          <ul className="mt-2 flex flex-col gap-2">
            {losses.reasons.map((r) => (
              <li key={r.reason}>
                <div className="flex items-center justify-between gap-3 text-[0.8125rem]">
                  <span className="truncate text-foreground">{r.reason}</span>
                  <span className="shrink-0 font-semibold text-foreground tabular-nums">{formatNumber(r.count)}</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-well">
                  <div className="h-full rounded-full" style={{ width: `${(r.count / reasonMax) * 100}%`, background: TONE.cancelled, opacity: 0.8 }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---------- the cost ---------- */}
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line-subtle pt-3">
        <div>
          <dt className="text-[0.6875rem] text-subtle">Lost revenue</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{formatCurrency(losses.lostRevenue, currency, { compact: true })}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-subtle">Fees kept</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{formatCurrency(losses.feesKept, currency, { compact: true })}</dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-subtle">Inside 24h</dt>
          <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
            {formatNumber(losses.lateCancellations)}
            <span className="ml-1 text-[0.6875rem] font-normal text-subtle">of {formatNumber(losses.cancelled)}</span>
          </dd>
        </div>
      </dl>

      <Link
        href="/dashboard/bookings"
        className="mt-auto inline-flex w-fit items-center gap-1 pt-4 text-xs font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Cancelled reservations
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </Link>
    </Card>
  )
}
