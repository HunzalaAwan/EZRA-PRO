'use client'

/**
 * Where guests are travelling from. Ranked bars where the bar *is* the row —
 * the fill doubles as the row background, which keeps a dense top-10 list
 * readable at 360px without a separate chart column.
 */

import { useMemo, useRef, type ReactNode } from 'react'
import { motion, useInView } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { clamp, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { CurrencyCode, GeoSource } from '@/types'
import { ChartContainer } from './chart-container'

/** `--ease-out-expo`, in the tuple shape motion expects. */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

const REGIONAL_INDICATOR_A = 0x1f1e6
const LATIN_A = 'A'.charCodeAt(0)

/**
 * ISO 3166-1 alpha-2 -> flag emoji, by mapping each letter to its regional
 * indicator symbol. Falls back to a neutral flag for anything unexpected.
 */
export function countryFlag(countryCode: string): string {
  const code = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '🏳️'
  return String.fromCodePoint(
    ...Array.from(code, (letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - LATIN_A),
  )
}

export type GeoMetric = 'bookings' | 'revenue'

export interface GeoBarsProps {
  sources: GeoSource[]
  /** Which measure ranks and sizes the bars. Defaults to bookings. */
  metric?: GeoMetric
  currency?: CurrencyCode
  /** Maximum rows rendered. */
  limit?: number
  height?: number
  title?: string
  description?: string
  toolbar?: ReactNode
  loading?: boolean
  className?: string
}

export function GeoBars({
  sources,
  metric = 'bookings',
  currency = 'USD',
  limit = 8,
  height,
  title = 'Top guest markets',
  description,
  toolbar,
  loading = false,
  className,
}: GeoBarsProps) {
  const reduced = useReducedMotionSafe()
  const listRef = useRef<HTMLOListElement>(null)
  const inView = useInView(listRef, { once: true, margin: '-40px' })

  const ranked = useMemo(
    () => [...sources].sort((a, b) => b[metric] - a[metric]).slice(0, limit),
    [sources, metric, limit],
  )

  const max = ranked.reduce((peak, source) => Math.max(peak, source[metric]), 0)

  const summary = useMemo(() => {
    if (ranked.length === 0) return ''
    const lead = ranked[0]
    return `Top ${ranked.length} guest markets by ${metric}. ${lead.country} leads with ${formatNumber(
      lead.bookings,
    )} bookings, ${formatPercent(lead.share, 1)} of the total.`
  }, [ranked, metric])

  const resolvedHeight = height ?? Math.max(140, ranked.length * 40)

  return (
    <ChartContainer
      title={title}
      description={description}
      ariaLabel={summary}
      height={resolvedHeight}
      toolbar={toolbar}
      loading={loading}
      empty={ranked.length === 0}
      emptyMessage="No guest locations recorded for this period."
      semantic
      className={className}
      bodyClassName="px-4 pb-4"
    >
      <ol ref={listRef} className="no-scrollbar flex h-full flex-col gap-1 overflow-y-auto">
        {ranked.map((source, index) => {
          const width = max > 0 ? clamp((source[metric] / max) * 100, 2, 100) : 0
          return (
            <li
              key={source.countryCode}
              className="relative flex h-9 shrink-0 items-center overflow-hidden rounded-lg bg-surface-sunken"
            >
              <motion.span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 rounded-lg"
                style={{ background: 'color-mix(in oklab, var(--chart-4) 30%, transparent)' }}
                initial={reduced ? false : { width: '0%' }}
                animate={{ width: reduced || inView ? `${width}%` : '0%' }}
                transition={reduced ? { duration: 0 } : { duration: 0.66, delay: index * 0.05, ease: EASE_OUT_EXPO }}
              />

              <div className="relative flex w-full items-center gap-2.5 px-2.5">
                <span className="w-4 shrink-0 text-center text-base leading-none" aria-hidden="true">
                  {countryFlag(source.countryCode)}
                </span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {source.country}
                  <span className="sr-only">
                    {`, ${formatNumber(source.bookings)} bookings, ${formatCurrency(
                      source.revenue,
                      currency,
                    )}, ${formatPercent(source.share, 1)} share`}
                  </span>
                </span>
                <span className="tabular hidden shrink-0 text-xs text-subtle sm:inline" aria-hidden="true">
                  {formatCurrency(source.revenue, currency)}
                </span>
                <span className="tabular shrink-0 text-xs font-medium text-muted" aria-hidden="true">
                  {formatNumber(source.bookings)}
                </span>
                <span className="tabular w-11 shrink-0 text-right text-xs text-subtle" aria-hidden="true">
                  {formatPercent(source.share, 1)}
                </span>
              </div>
            </li>
          )
        })}
      </ol>
    </ChartContainer>
  )
}
