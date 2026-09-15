'use client'

/**
 * Segment cards — the four-up header of the guest CRM.
 *
 * Each card is a real filter control: it reports the segment's size, its share
 * of the book, the average lifetime value of the guests inside it, and how many
 * guests have sat in that segment week by week over the last six months.
 * Selecting a card filters the table beneath it; selecting it again clears it.
 */

import * as React from 'react'
import { Clock8, Crown, Repeat2, Sparkles, type LucideIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn, formatCurrency, formatDelta, formatNumber, formatPercent } from '@/lib/utils'
import { Sparkline } from '@/components/charts/sparkline'
import type { CurrencyCode, Customer } from '@/types'

export type CustomerSegment = Customer['segment']
export type SegmentFilter = CustomerSegment | 'all'

export interface SegmentSummary {
  segment: CustomerSegment
  count: number
  /** Share of the tenant's whole guest book, 0-100. */
  share: number
  /** Minor units. */
  avgLifetimeValue: number
  /** Minor units. */
  totalLifetimeValue: number
  /** How many guests sat in this segment at each weekly mark, oldest first. */
  trend: number[]
  /** Change in segment size over the last four weeks. */
  deltaPercent: number
}

export interface SegmentCardsProps {
  segments: SegmentSummary[]
  currency: CurrencyCode
  value: SegmentFilter
  onValueChange: (value: SegmentFilter) => void
  className?: string
}

interface SegmentMeta {
  label: string
  blurb: string
  icon: LucideIcon
  /** A growing Lapsed pool is bad news; every other segment growing is good. */
  growthIsGood: boolean
  /** Semantic token classes — no hardcoded colour anywhere. */
  text: string
  soft: string
  border: string
  wash: string
  chart: string
}

/** Ordered so the read runs acquisition -> retention -> value -> risk. */
export const SEGMENT_ORDER: CustomerSegment[] = ['new', 'returning', 'vip', 'lapsed']

export const SEGMENT_META: Record<CustomerSegment, SegmentMeta> = {
  new: {
    label: 'New',
    blurb: 'First booking on file',
    icon: Sparkles,
    growthIsGood: true,
    text: 'text-info',
    soft: 'bg-info-soft',
    border: 'border-info/40',
    wash: 'from-info/12',
    chart: 'var(--chart-5)',
  },
  returning: {
    label: 'Returning',
    blurb: 'Two or more trips',
    icon: Repeat2,
    growthIsGood: true,
    text: 'text-primary',
    soft: 'bg-primary-soft',
    border: 'border-primary/45',
    wash: 'from-primary/14',
    chart: 'var(--chart-1)',
  },
  vip: {
    label: 'VIP',
    blurb: '3+ trips or $2k lifetime',
    icon: Crown,
    growthIsGood: true,
    text: 'text-warning',
    soft: 'bg-warning-soft',
    border: 'border-warning/45',
    wash: 'from-warning/14',
    chart: 'var(--chart-4)',
  },
  lapsed: {
    label: 'Lapsed',
    blurb: 'Quiet for over 120 days',
    icon: Clock8,
    growthIsGood: false,
    text: 'text-accent',
    soft: 'bg-accent-soft',
    border: 'border-accent/45',
    wash: 'from-accent/14',
    chart: 'var(--chart-2)',
  },
}

export function SegmentCards({
  segments,
  currency,
  value,
  onValueChange,
  className,
}: SegmentCardsProps) {
  const reduceMotion = useReducedMotionSafe()
  const layoutId = React.useId()

  const ordered = React.useMemo(
    () =>
      SEGMENT_ORDER.map((key) => segments.find((s) => s.segment === key)).filter(
        (s): s is SegmentSummary => Boolean(s),
      ),
    [segments],
  )

  return (
    <div
      role="group"
      aria-label="Filter guests by segment"
      className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
    >
      {ordered.map((summary) => {
        const meta = SEGMENT_META[summary.segment]
        const Icon = meta.icon
        const active = value === summary.segment

        return (
          <button
            key={summary.segment}
            type="button"
            aria-pressed={active}
            onClick={() => onValueChange(active ? 'all' : summary.segment)}
            className={cn(
              'group relative isolate flex min-w-0 flex-col overflow-hidden rounded-2xl border p-4 text-left',
              'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
              active
                ? cn('bg-surface-raised shadow-lg', meta.border)
                : 'border-line bg-surface shadow-sm hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
            )}
          >
            {/* Brand wash — permanent on the active card, a hover bloom otherwise. */}
            <span
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute inset-x-0 -top-12 -z-10 h-28 bg-gradient-to-b to-transparent blur-2xl',
                'transition-opacity duration-500 ease-[var(--ease-out-expo)]',
                meta.wash,
                active ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
              )}
            />

            {active ? (
              <motion.span
                aria-hidden="true"
                layoutId={`segment-rail-${layoutId}`}
                className={cn('absolute inset-y-3 left-0 w-0.5 rounded-full', meta.text, 'bg-current')}
                transition={
                  reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
                }
              />
            ) : null}

            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    'grid size-8 shrink-0 place-items-center rounded-lg transition-transform duration-300',
                    'ease-[var(--ease-out-expo)] group-hover:scale-105 motion-reduce:group-hover:scale-100',
                    meta.soft,
                    meta.text,
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[0.8125rem] font-semibold text-foreground">
                    {meta.label}
                  </span>
                  <span className="block truncate text-[0.6875rem] text-subtle">{meta.blurb}</span>
                </span>
              </div>

              <span
                className={cn(
                  'tabular shrink-0 rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium',
                  active ? cn(meta.soft, meta.text) : 'bg-surface-sunken text-subtle',
                )}
              >
                {formatPercent(summary.share, 0)}
              </span>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="tabular font-display text-2xl leading-none font-semibold tracking-tight text-foreground">
                  {formatNumber(summary.count)}
                </p>
                <p className="mt-1.5 truncate text-xs text-muted">
                  <span className="tabular font-medium text-foreground">
                    {formatCurrency(summary.avgLifetimeValue, currency, { compact: true })}
                  </span>{' '}
                  avg lifetime
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1">
                <Sparkline
                  values={summary.trend}
                  width={72}
                  height={26}
                  color={meta.chart}
                  fill
                  showLastDot
                  ariaLabel={`${meta.label} segment size over the last ${summary.trend.length} weeks`}
                />
                <span className="flex items-center gap-1">
                  <span
                    className={cn(
                      'tabular text-[0.6875rem] font-medium',
                      Math.abs(summary.deltaPercent) < 0.5
                        ? 'text-faint'
                        : summary.deltaPercent > 0 === meta.growthIsGood
                          ? 'text-success'
                          : 'text-danger',
                    )}
                  >
                    {formatDelta(summary.deltaPercent)}
                  </span>
                  <span className="text-[0.625rem] text-faint">4w</span>
                </span>
              </div>
            </div>

            <span className="sr-only">
              {active ? 'Selected. Activate to clear this filter.' : 'Activate to filter the table.'}
            </span>
          </button>
        )
      })}
    </div>
  )
}
