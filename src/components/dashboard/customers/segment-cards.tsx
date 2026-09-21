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
import { cn, formatCurrency, formatDelta, formatNumber, formatPercent } from '@/lib/utils'
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
              'group relative flex min-w-0 flex-col rounded-2xl border p-4 text-left',
              'transition-[border-color,background-color] duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              active ? 'border-primary/50 bg-primary-soft/40' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <div className="flex items-center gap-2 text-[0.8125rem] text-muted">
              <Icon className={cn('size-4', meta.text)} aria-hidden="true" />
              <span className="truncate font-medium text-foreground">{meta.label}</span>
              <span className="truncate text-subtle">· {meta.blurb}</span>
            </div>

            <p className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight text-foreground tabular-nums">
              {formatNumber(summary.count)}
            </p>
            <p className="mt-2 text-xs text-muted tabular-nums">
              {formatPercent(summary.share, 0)} of guests · {formatCurrency(summary.avgLifetimeValue, currency, { compact: true })} average lifetime
            </p>
          </button>
        )
      })}
    </div>
  )
}
