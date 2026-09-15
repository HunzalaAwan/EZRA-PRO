'use client'

import * as React from 'react'
import {
  CalendarClock,
  CircleSlash2,
  Gauge,
  Receipt,
  Repeat2,
  Star,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { ChartDeltaChip } from '@/components/charts/chart-container'
import { KpiCard, type MiniTrendKind } from '@/components/dashboard/overview/kpi-card'
import { formatStatValue } from '@/components/ui/stat'
import { Skeleton } from '@/components/ui/skeleton'
import { seriesForKpi, seriesVar } from '@/lib/metric-colors'
import { cn } from '@/lib/utils'
import type { CurrencyCode, KpiMetric } from '@/types'

/* ==========================================================================
   KpiGrid — the nine numbers an operator steers on, without nine cards.

   The four money-line metrics get the same instrument card as the overview
   (figure and mini chart in a well, each in its own series colour). The five
   rate metrics are a single strip: label, figure, change.
   ========================================================================== */

type ComparisonMode = 'previous' | 'year'

interface KpiPresentation {
  icon: LucideIcon
  trend: MiniTrendKind
  /** Overrides the label when the unit needs to live in it. */
  label?: string
}

const PRESENTATION: Record<string, KpiPresentation> = {
  net_revenue: { icon: Wallet, trend: 'area' },
  bookings: { icon: Ticket, trend: 'bars' },
  guests: { icon: Users, trend: 'area' },
  aov: { icon: Receipt, trend: 'bars' },
  occupancy: { icon: Gauge, trend: 'bars' },
  cancellation_rate: { icon: CircleSlash2, trend: 'bars' },
  repeat_rate: { icon: Repeat2, trend: 'area' },
  avg_rating: { icon: Star, trend: 'area' },
  // The value is in DAYS and the format is `number` — the unit lives in the
  // label so the figure never reads as a bare, unitless count.
  lead_time: { icon: CalendarClock, trend: 'area', label: 'Avg. lead time (days)' },
}

const FALLBACK: KpiPresentation = { icon: TrendingUp, trend: 'area' }

const PRIMARY_KEYS = ['net_revenue', 'bookings', 'guests', 'aov']

/** A comparison window that does not exist in the data — never faked as 0%. */
const NO_PRIOR_PERIOD = 'no comparable prior period'

function decimalsFor(metric: KpiMetric): number {
  if (metric.format === 'percent') return 1
  if (metric.key === 'lead_time') return 1
  return 0
}

/** The metric as it should be shown under the current comparison basis. */
function present(metric: KpiMetric, currency: CurrencyCode, comparison: ComparisonMode) {
  const presentation = PRESENTATION[metric.key] ?? FALLBACK
  const missingPrior = metric.comparisonLabel === NO_PRIOR_PERIOD
  const yearOverYear = comparison === 'year'
  // Year-over-year needs twelve months of history behind the range; this
  // workspace has five. Report that honestly rather than inventing a delta.
  const suppressed = yearOverYear || missingPrior

  const shown: KpiMetric = {
    ...metric,
    label: presentation.label ?? metric.label,
    currency: metric.currency ?? currency,
    direction: suppressed ? 'flat' : metric.direction,
    comparisonLabel: suppressed
      ? yearOverYear
        ? 'no comparable prior year'
        : NO_PRIOR_PERIOD
      : metric.comparisonLabel,
  }
  return { shown, suppressed, presentation }
}

/* --------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
      <div className="flex items-center gap-2.5">
        <Skeleton shape="block" className="size-7 rounded-lg" />
        <Skeleton shape="line" className="h-3 w-24" />
      </div>
      <Skeleton shape="block" className="mt-3 h-[5.25rem] w-full rounded-xl" />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Rates strip
   -------------------------------------------------------------------------- */

function RatesStrip({
  metrics,
  currency,
  comparison,
}: {
  metrics: KpiMetric[]
  currency: CurrencyCode
  comparison: ComparisonMode
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line-subtle shadow-xs',
        'sm:grid-cols-3 xl:grid-cols-5',
      )}
    >
      {metrics.map((metric) => {
        const { shown, suppressed } = present(metric, currency, comparison)
        return (
          <div key={metric.key} className="min-w-0 bg-surface px-4 py-3.5">
            <dt className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-subtle">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={{ background: seriesVar(seriesForKpi(metric.key)) }}
              />
              <span className="truncate">{shown.label}</span>
            </dt>
            <dd className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-display text-lg leading-none font-semibold tracking-[-0.02em] text-foreground">
                {formatStatValue(metric.value, metric.format, {
                  currency: shown.currency,
                  decimals: decimalsFor(metric),
                })}
              </span>
              {suppressed ? (
                <span className="text-[0.6875rem] text-faint">no prior period</span>
              ) : (
                <ChartDeltaChip
                  value={metric.deltaPercent}
                  higherIsBetter={metric.higherIsBetter}
                  size="xs"
                  bare
                />
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/* --------------------------------------------------------------------------
   Grid
   -------------------------------------------------------------------------- */

export interface KpiGridProps {
  kpis: KpiMetric[]
  currency: CurrencyCode
  comparison: ComparisonMode
  loading?: boolean
  className?: string
}

export function KpiGrid({ kpis, currency, comparison, loading = false, className }: KpiGridProps) {
  const { primary, secondary } = React.useMemo(() => {
    const byKey = new Map(kpis.map((k) => [k.key, k]))
    const lead = PRIMARY_KEYS.map((key) => byKey.get(key)).filter((k): k is KpiMetric => Boolean(k))
    const rest = kpis.filter((k) => !PRIMARY_KEYS.includes(k.key))
    return { primary: lead.length > 0 ? lead : kpis.slice(0, 4), secondary: rest }
  }, [kpis])

  if (loading) {
    return (
      <div className={cn('space-y-4', className)} role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading key metrics</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
        <Skeleton shape="block" className="h-16 w-full rounded-2xl" />
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {primary.map((metric) => {
          const { shown, suppressed, presentation } = present(metric, currency, comparison)
          return (
            <KpiCard
              key={metric.key}
              metric={shown}
              currency={currency}
              icon={presentation.icon}
              trend={presentation.trend}
              showDelta={!suppressed}
            />
          )
        })}
      </div>

      {secondary.length > 0 ? (
        <RatesStrip metrics={secondary} currency={currency} comparison={comparison} />
      ) : null}
    </div>
  )
}
