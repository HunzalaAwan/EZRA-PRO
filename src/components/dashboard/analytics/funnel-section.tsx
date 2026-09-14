'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Droplet, Gauge, TrendingDown, TrendingUp } from 'lucide-react'

import { ConversionFunnel } from '@/components/charts/conversion-funnel'
import { ChartDeltaChip } from '@/components/charts/chart-container'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { CurrencyCode, FunnelStage } from '@/types'

/* ==========================================================================
   FunnelSection

   Peek and FareHarbor stop at "bookings". This puts the four steps in front
   of the booking on the same page, prices each one at your own average order
   value, and says which step is losing you the most money.
   ========================================================================== */

/**
 * Median step conversion across the EZRA network for watersports and tour
 * operators over the trailing twelve months. Context, not a target.
 */
const CATEGORY_MEDIAN: Record<string, number> = {
  activity: 52,
  checkout: 19,
  payment: 61,
  booked: 81,
}

const ROW_GRID = 'lg:grid-cols-[minmax(0,1fr)_6rem_6rem_6.5rem_6rem_6.5rem_5.5rem]'

interface Transition {
  key: string
  label: string
  fromLabel: string
  entering: number
  continuing: number
  dropped: number
  dropRate: number
  conversion: number
  benchmark?: number
  delta?: number
  /** Product of every conversion rate after this step, as a fraction. */
  downstream: number
}

function buildTransitions(stages: FunnelStage[]): Transition[] {
  return stages.slice(1).map((stage, i) => {
    const from = stages[i]
    const dropped = Math.max(0, from.value - stage.value)
    const benchmark = CATEGORY_MEDIAN[stage.key]
    const downstream = stages
      .slice(i + 2)
      .reduce((product, later) => product * (later.conversionRate / 100), 1)
    return {
      key: stage.key,
      label: stage.label,
      fromLabel: from.label,
      entering: from.value,
      continuing: stage.value,
      dropped,
      dropRate: from.value === 0 ? 0 : (dropped / from.value) * 100,
      conversion: stage.conversionRate,
      benchmark,
      delta: benchmark === undefined ? undefined : stage.conversionRate - benchmark,
      downstream,
    }
  })
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

export interface FunnelSectionProps {
  stages: FunnelStage[]
  /** Average order value in minor units — prices every point of conversion. */
  aov: number
  currency: CurrencyCode
  rangeLabel: string
  loading?: boolean
  className?: string
}

export function FunnelSection({
  stages,
  aov,
  currency,
  rangeLabel,
  loading = false,
  className,
}: FunnelSectionProps) {
  const transitions = React.useMemo(() => buildTransitions(stages), [stages])

  const analysis = React.useMemo(() => {
    if (transitions.length === 0) return null

    const leak = transitions.reduce((a, b) => (b.conversion < a.conversion ? b : a))
    const withBenchmark = transitions.filter((t) => typeof t.delta === 'number')
    const laggard =
      withBenchmark.length > 0
        ? withBenchmark.reduce((a, b) => ((b.delta ?? 0) < (a.delta ?? 0) ? b : a))
        : undefined

    // What one extra point of conversion at the leak is worth, carried through
    // every step that follows it and priced at the period's average order value.
    const perPoint = Math.round(leak.entering * 0.01 * leak.downstream * aov)

    const behind = laggard && (laggard.delta ?? 0) < 0 ? laggard : undefined
    const recover = behind
      ? Math.round(
          behind.entering * (Math.abs(behind.delta ?? 0) / 100) * behind.downstream * aov,
        )
      : 0

    const ahead = withBenchmark.filter((t) => (t.delta ?? 0) >= 0).length
    const overall =
      stages.length > 0 && stages[0].value > 0
        ? (stages[stages.length - 1].value / stages[0].value) * 100
        : 0

    return { leak, laggard, behind, perPoint, recover, ahead, benchmarked: withBenchmark.length, overall }
  }, [transitions, stages, aov])

  return (
    <section className={cn('space-y-4', className)} aria-label="Booking conversion funnel">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ConversionFunnel
            stages={stages}
            loading={loading}
            title="Booking funnel"
            description={`Storefront through to a paid booking, ${rangeLabel.toLowerCase()}.`}
          />
        </div>

        {/* ---------- biggest leak ---------- */}
        <div className="relative isolate overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--accent)_28%,var(--border))] bg-[linear-gradient(160deg,color-mix(in_oklab,var(--accent)_12%,var(--surface))_0%,var(--surface)_58%)] p-5 shadow-md">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-14 -top-16 -z-10 size-48 rounded-full bg-[radial-gradient(circle,var(--color-coral-500),transparent_68%)] opacity-20 blur-2xl"
          />

          {loading || !analysis ? (
            <div className="space-y-3">
              <Skeleton shape="line" className="h-3 w-28" />
              <Skeleton shape="block" className="h-8 w-40 rounded-lg" />
              <Skeleton shape="line" className="h-2.5 w-full" />
              <Skeleton shape="line" className="h-2.5 w-4/5" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-accent text-on-accent shadow-sm">
                  <Droplet aria-hidden="true" className="size-4" strokeWidth={2} />
                </span>
                <h3 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
                  Biggest leak
                </h3>
              </div>

              <p className="mt-4 font-display text-3xl font-semibold tracking-[-0.03em] tabular-nums text-accent">
                {formatPercent(analysis.leak.dropRate, 0)}
              </p>
              <p className="mt-1 text-[0.8125rem] font-medium text-foreground">
                leave between {analysis.leak.fromLabel.toLowerCase()} and{' '}
                {analysis.leak.label.toLowerCase()}
              </p>

              <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
                {formatNumber(analysis.leak.dropped)} of {formatNumber(analysis.leak.entering)}{' '}
                sessions stop here. At{' '}
                <span className="font-medium text-foreground">
                  {formatCurrency(aov, currency)}
                </span>{' '}
                average order value, every single point you claw back is worth{' '}
                <span className="font-semibold text-success">
                  {formatCurrency(analysis.perPoint, currency)}
                </span>{' '}
                over this range.
              </p>

              <div className="mt-4 space-y-2 rounded-xl border border-line-subtle bg-surface/80 p-3 backdrop-blur-sm">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted">End-to-end conversion</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatPercent(analysis.overall, 2)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted">Steps ahead of the category median</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {analysis.ahead} of {analysis.benchmarked}
                  </span>
                </div>
                {analysis.behind ? (
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted">Worst against median</span>
                    <span className="flex items-center gap-1.5 font-semibold tabular-nums text-foreground">
                      {analysis.behind.label}
                      <ChartDeltaChip value={analysis.behind.delta ?? 0} />
                    </span>
                  </div>
                ) : null}
              </div>

              {analysis.behind ? (
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
                  Pulling <span className="font-medium text-foreground">{analysis.behind.label.toLowerCase()}</span> back
                  to the {formatPercent(analysis.behind.benchmark ?? 0, 0)} median would add about{' '}
                  <span className="font-semibold text-success">
                    {formatCurrency(analysis.recover, currency)}
                  </span>{' '}
                  without a single extra visitor.
                </p>
              ) : (
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
                  Every benchmarked step is at or above the category median — the remaining upside
                  is in traffic, not in the checkout.
                </p>
              )}

              <Link
                href="/dashboard/settings/booking"
                className="mt-4 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Review the checkout flow
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ---------- stage-by-stage ---------- */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>Stage-by-stage drop-off</CardTitle>
            <CardDescription>
              Every step, what it loses, and how it compares with the operators you are benchmarked
              against.
            </CardDescription>
          </div>
          <CardToolbar>
            <span className="hidden items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-[0.6875rem] font-medium text-subtle sm:inline-flex">
              <Gauge aria-hidden="true" className="size-3.5" />
              Category median context
            </span>
          </CardToolbar>
        </CardHeader>

        <CardContent bleed className="px-3.5 sm:px-4">
          {loading ? (
            <div className="space-y-2 pb-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} shape="block" className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <>
              <div
                className={cn(
                  'hidden gap-x-4 border-b border-line-subtle pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-faint lg:grid',
                  ROW_GRID,
                )}
              >
                <span>Step</span>
                <span className="text-right">Entering</span>
                <span className="text-right">Continuing</span>
                <span className="text-right">Drop-off</span>
                <span className="text-right">Conversion</span>
                <span className="text-right">Median</span>
                <span className="text-right">Δ</span>
              </div>

              <ul className="divide-y divide-line-subtle">
                {transitions.map((t) => {
                  const isLeak = analysis?.leak.key === t.key
                  return (
                    <li
                      key={t.key}
                      className={cn(
                        'grid grid-cols-2 gap-x-4 gap-y-2.5 py-3 transition-colors hover:bg-surface-sunken/60 lg:items-center lg:gap-y-0',
                        ROW_GRID,
                      )}
                    >
                      <div className="col-span-2 min-w-0 lg:col-span-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[0.8125rem] font-medium text-foreground">
                            {t.fromLabel} → {t.label}
                          </span>
                          {isLeak ? (
                            <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.05em] text-accent">
                              Leak
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1.5 h-1 w-full max-w-52 overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              isLeak ? 'bg-accent' : 'bg-primary',
                            )}
                            style={{ width: `${Math.max(3, Math.min(100, t.conversion))}%` }}
                          />
                        </div>
                      </div>

                      <Cell label="Entering" className="text-muted">
                        {formatNumber(t.entering)}
                      </Cell>
                      <Cell label="Continuing" className="text-muted">
                        {formatNumber(t.continuing)}
                      </Cell>
                      <Cell label="Drop-off" className="text-danger">
                        −{formatNumber(t.dropped)}
                      </Cell>
                      <Cell label="Conversion" className="font-semibold text-foreground">
                        {formatPercent(t.conversion, 1)}
                      </Cell>
                      <Cell label="Median" className="text-subtle">
                        {t.benchmark === undefined ? '—' : formatPercent(t.benchmark, 0)}
                      </Cell>
                      <div className="min-w-0 lg:text-right">
                        <span className="block text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-faint lg:hidden">
                          Δ
                        </span>
                        {t.delta === undefined ? (
                          <span className="text-[0.8125rem] text-faint">—</span>
                        ) : (
                          <span
                            className={cn(
                              'mt-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums lg:mt-0',
                              t.delta >= 0 ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
                            )}
                          >
                            {t.delta >= 0 ? (
                              <TrendingUp aria-hidden="true" className="size-3" strokeWidth={2.5} />
                            ) : (
                              <TrendingDown aria-hidden="true" className="size-3" strokeWidth={2.5} />
                            )}
                            {t.delta >= 0 ? '+' : ''}
                            {t.delta.toFixed(1)} pts
                          </span>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </CardContent>

        <CardFooter separated>
          <p className="text-[0.6875rem] leading-relaxed text-faint">
            Category medians are the EZRA network median for watersports and tour operators over the
            trailing twelve months. They are context for judging a number, not a target to hit.
          </p>
        </CardFooter>
      </Card>
    </section>
  )
}
