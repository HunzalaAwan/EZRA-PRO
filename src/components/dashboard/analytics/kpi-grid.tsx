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

import { StatCard, StatGrid, type StatAccent, type StatProps } from '@/components/ui/stat'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { CurrencyCode, KpiMetric } from '@/types'

/* ==========================================================================
   KpiGrid — the nine numbers an operator steers on.

   Two rows on purpose. The first four are the money line and get the large
   type; the remaining five are rate metrics that read better small and dense.
   Delta colour comes from `direction` + `higherIsBetter`, so a falling
   cancellation rate is green while falling revenue is red.
   ========================================================================== */

type ComparisonMode = 'previous' | 'year'

interface KpiPresentation {
  icon: LucideIcon
  accent: StatAccent
  /** Overrides the label when the unit needs to live in it. */
  label?: string
}

const PRESENTATION: Record<string, KpiPresentation> = {
  net_revenue: { icon: Wallet, accent: 'lagoon' },
  bookings: { icon: Ticket, accent: 'lagoon' },
  guests: { icon: Users, accent: 'reef' },
  aov: { icon: Receipt, accent: 'sunset' },
  occupancy: { icon: Gauge, accent: 'lagoon' },
  cancellation_rate: { icon: CircleSlash2, accent: 'coral' },
  repeat_rate: { icon: Repeat2, accent: 'reef' },
  avg_rating: { icon: Star, accent: 'sunset' },
  // The value is in DAYS and the format is `number` — the unit lives in the
  // label so the big figure never reads as a bare, unitless count.
  lead_time: { icon: CalendarClock, accent: 'coral', label: 'Avg. Lead Time (days)' },
}

const FALLBACK: KpiPresentation = { icon: TrendingUp, accent: 'lagoon' }

const PRIMARY_KEYS = ['net_revenue', 'bookings', 'guests', 'aov']

/** A comparison window that does not exist in the data — never faked as 0%. */
const NO_PRIOR_PERIOD = 'no comparable prior period'

function decimalsFor(metric: KpiMetric): number {
  if (metric.format === 'percent') return 1
  if (metric.key === 'lead_time') return 1
  return 0
}

function toStat(metric: KpiMetric, currency: CurrencyCode, comparison: ComparisonMode): Omit<StatProps, 'size'> {
  const presentation = PRESENTATION[metric.key] ?? FALLBACK
  const missingPrior = metric.comparisonLabel === NO_PRIOR_PERIOD
  const yearOverYear = comparison === 'year'
  // Year-over-year needs twelve months of history behind the range; this
  // workspace has five. Report that honestly rather than inventing a delta.
  const suppressed = yearOverYear || missingPrior

  return {
    label: presentation.label ?? metric.label,
    value: metric.value,
    format: metric.format,
    currency: metric.currency ?? currency,
    deltaPercent: suppressed ? undefined : metric.deltaPercent,
    direction: suppressed ? 'flat' : metric.direction,
    higherIsBetter: metric.higherIsBetter,
    comparisonLabel: suppressed
      ? yearOverYear
        ? '— no comparable prior year'
        : `— ${NO_PRIOR_PERIOD}`
      : metric.comparisonLabel,
    sparkline: metric.sparkline,
    hint: metric.hint,
    decimals: decimalsFor(metric),
  }
}

/* --------------------------------------------------------------------------
   Loading
   -------------------------------------------------------------------------- */

function KpiSkeleton({ size }: { size: 'sm' | 'md' }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-xs',
        size === 'md' ? 'p-5' : 'p-4',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <Skeleton shape="line" className="h-3 w-24" />
        <Skeleton shape="block" className="size-8 rounded-lg" />
      </div>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton shape="block" className={cn('rounded-lg', size === 'md' ? 'h-8 w-32' : 'h-6 w-20')} />
          <Skeleton shape="line" className="mt-3 h-2.5 w-28" />
        </div>
        <Skeleton shape="block" className={cn('rounded-lg', size === 'md' ? 'h-9 w-24' : 'h-7 w-16')} />
      </div>
    </div>
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
      <div className={cn('space-y-3', className)} role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading key metrics</span>
        <StatGrid columns={4}>
          {[0, 1, 2, 3].map((i) => (
            <KpiSkeleton key={i} size="md" />
          ))}
        </StatGrid>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <KpiSkeleton key={i} size="sm" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)}>
      <StatGrid columns={4}>
        {primary.map((metric) => {
          const presentation = PRESENTATION[metric.key] ?? FALLBACK
          return (
            <StatCard
              key={metric.key}
              size="md"
              icon={presentation.icon}
              accent={presentation.accent}
              stat={toStat(metric, currency, comparison)}
            />
          )
        })}
      </StatGrid>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {secondary.map((metric) => {
          const presentation = PRESENTATION[metric.key] ?? FALLBACK
          return (
            <StatCard
              key={metric.key}
              size="sm"
              icon={presentation.icon}
              accent={presentation.accent}
              stat={toStat(metric, currency, comparison)}
            />
          )
        })}
      </div>
    </div>
  )
}
