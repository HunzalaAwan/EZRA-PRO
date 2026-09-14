'use client'

/**
 * Which experiences actually earn. Ranked by revenue and tinted by each
 * activity's calendar colour, so a row here and a block on the schedule read as
 * the same product. Occupancy rides along as an inline meter — revenue alone
 * hides the "sells out but is underpriced" case.
 */

import { useMemo, useRef, type ReactNode } from 'react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { clamp, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { ActivityPerformance, CurrencyCode } from '@/types'
import { ACTIVITY_COLOR_VAR, ChartContainer, ChartDeltaChip } from './chart-container'

/** `--ease-out-expo`, in the tuple shape motion expects. */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

const ROW_CLASS =
  'relative block w-full overflow-hidden rounded-lg bg-surface-sunken px-2.5 py-2 text-left transition-colors'

export interface ActivityPerformanceChartProps {
  items: ActivityPerformance[]
  currency?: CurrencyCode
  /** Maximum rows rendered. */
  limit?: number
  height?: number
  title?: string
  description?: string
  toolbar?: ReactNode
  loading?: boolean
  className?: string
  /** Called when a row is activated — wire to the activity detail page. */
  onSelect?: (activityId: string) => void
}

export function ActivityPerformanceChart({
  items,
  currency = 'USD',
  limit = 6,
  height,
  title = 'Top activities by revenue',
  description,
  toolbar,
  loading = false,
  className,
  onSelect,
}: ActivityPerformanceChartProps) {
  const reduced = useReducedMotion()
  const listRef = useRef<HTMLOListElement>(null)
  const inView = useInView(listRef, { once: true, margin: '-40px' })

  const ranked = useMemo(() => [...items].sort((a, b) => b.revenue - a.revenue).slice(0, limit), [items, limit])
  const max = ranked.reduce((peak, item) => Math.max(peak, item.revenue), 0)

  const summary = useMemo(() => {
    if (ranked.length === 0) return ''
    const lead = ranked[0]
    return `Top ${ranked.length} activities by revenue. ${lead.name} leads with ${formatCurrency(
      lead.revenue,
      currency,
    )} across ${formatNumber(lead.bookings)} bookings at ${formatPercent(lead.occupancy)} occupancy.`
  }, [ranked, currency])

  const resolvedHeight = height ?? Math.max(180, ranked.length * 56)

  return (
    <ChartContainer
      title={title}
      description={description}
      ariaLabel={summary}
      height={resolvedHeight}
      toolbar={toolbar}
      loading={loading}
      empty={ranked.length === 0}
      emptyMessage="No activity revenue recorded for this period."
      semantic
      className={className}
      bodyClassName="px-4 pb-4"
    >
      <ol ref={listRef} className="no-scrollbar flex h-full flex-col gap-1.5 overflow-y-auto">
        {ranked.map((item, index) => {
          const width = max > 0 ? clamp((item.revenue / max) * 100, 3, 100) : 0
          const tint = ACTIVITY_COLOR_VAR[item.colorKey]

          const row = (
            <>
              {/* The revenue bar is the row background. */}
              <motion.span
                aria-hidden="true"
                className="absolute inset-y-0 left-0"
                style={{ background: `color-mix(in oklab, ${tint} 24%, transparent)` }}
                initial={reduced ? false : { width: '0%' }}
                animate={{ width: reduced || inView ? `${width}%` : '0%' }}
                transition={reduced ? { duration: 0 } : { duration: 0.7, delay: index * 0.06, ease: EASE_OUT_EXPO }}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-1 left-0 w-[3px] rounded-full"
                style={{ background: tint }}
              />

              <span className="relative flex items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{item.name}</span>
                  <span className="mt-1 flex items-center gap-1.5">
                    {/* Secondary measure: occupancy, as a meter plus its number. */}
                    <span aria-hidden="true" className="h-1 w-12 overflow-hidden rounded-full bg-line sm:w-16">
                      <span
                        className="block h-full rounded-full"
                        style={{ width: `${clamp(item.occupancy, 0, 100)}%`, background: tint }}
                      />
                    </span>
                    <span className="tabular text-[10px] text-subtle">{formatPercent(item.occupancy)} full</span>
                    <span className="text-[10px] text-faint" aria-hidden="true">
                      ·
                    </span>
                    <span className="tabular text-[10px] text-subtle">{formatNumber(item.bookings)} bookings</span>
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular text-xs font-semibold text-foreground">
                    {formatCurrency(item.revenue, currency)}
                  </span>
                  <ChartDeltaChip value={item.deltaPercent} bare />
                </span>
              </span>
            </>
          )

          return (
            <li key={item.activityId} className="shrink-0">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(item.activityId)}
                  className={`${ROW_CLASS} hover:bg-surface-raised`}
                >
                  {row}
                </button>
              ) : (
                <div className={ROW_CLASS}>{row}</div>
              )}
            </li>
          )
        })}
      </ol>
    </ChartContainer>
  )
}
