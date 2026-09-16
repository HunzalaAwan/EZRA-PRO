'use client'

import * as React from 'react'
import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'

import { CountUp } from '@/components/motion/count-up'
import { Card } from '@/components/ui/card'
import { kpiAccent, seriesForKpi } from '@/lib/metric-colors'
import { cn, formatDelta, sparklinePath } from '@/lib/utils'
import type { CurrencyCode, KpiMetric } from '@/types'

/* ==========================================================================
   KpiCard — label on the card, the number in a well.

   The figure and its little chart sit together in a sunken panel inside the
   card, so the card reads as "a labelled instrument" rather than a box of
   text. The mini chart is the metric's own series colour; the delta line
   under the figure is the only place good/bad colour appears.
   ========================================================================== */

export type MiniTrendKind = 'area' | 'bars'

interface MiniTrendProps {
  values: number[]
  kind: MiniTrendKind
  color: string
  width?: number
  height?: number
}

/** Twelve points of context, drawn once on arrival. */
function MiniTrend({ values, kind, color, width = 92, height = 40 }: MiniTrendProps) {
  const reduce = useReducedMotionSafe()
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  if (kind === 'bars') {
    const gap = 3
    const bw = (width - gap * (values.length - 1)) / values.length
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0 overflow-visible">
        {values.map((v, i) => {
          const h = Math.max(4, ((v - min) / span) * (height - 6) + 4)
          const last = i === values.length - 1
          return (
            <motion.rect
              key={i}
              x={i * (bw + gap)}
              y={height - h}
              width={bw}
              height={h}
              rx={bw / 2}
              fill={color}
              fillOpacity={last ? 1 : 0.35}
              initial={reduce ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              style={{ transformOrigin: `${i * (bw + gap) + bw / 2}px ${height}px` }}
              transition={{ delay: 0.15 + i * 0.04, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          )
        })}
      </svg>
    )
  }

  const pad = 3
  const line = sparklinePath(values, width, height, pad)
  const area = `${line} L${(width - pad).toFixed(2)},${height} L${pad.toFixed(2)},${height} Z`
  const lastY = pad + (height - pad * 2) * (1 - (values[values.length - 1] - min) / span)

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true" className="shrink-0 overflow-visible">
      <motion.path
        d={area}
        fill={color}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.12 }}
        transition={{ duration: 0.6, delay: reduce ? 0 : 0.5 }}
      />
      <motion.path
        d={line}
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.5 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={reduce ? { duration: 0 } : { duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      <circle cx={width - pad} cy={lastY} r={3} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  )
}

export interface KpiCardProps {
  metric: KpiMetric
  currency: CurrencyCode
  icon: LucideIcon
  trend?: MiniTrendKind
  /** Hide the delta when no honest comparison window exists. */
  showDelta?: boolean
  className?: string
}

export function KpiCard({ metric, currency, icon: Icon, trend = 'area', showDelta = true, className }: KpiCardProps) {
  const series = seriesForKpi(metric.key)
  const color = kpiAccent(series)
  const good = metric.direction === 'flat' ? null : (metric.direction === 'up') === metric.higherIsBetter
  const DeltaIcon = metric.deltaPercent >= 0 ? TrendingUp : TrendingDown

  const format = metric.format === 'currency' ? 'currency' : metric.format === 'percent' ? 'percent' : 'number'

  return (
    <Card className={cn('flex flex-col p-4', className)}>
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-lg"
          style={{ background: `color-mix(in oklab, ${color} 13%, transparent)`, color }}
        >
          <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
        </span>
        <span className="truncate text-[0.8125rem] font-medium text-muted">{metric.label}</span>
      </div>

      <div className="mt-3 flex flex-1 flex-col rounded-xl bg-well px-4 pt-3.5 pb-3">
        <CountUp
          value={metric.value}
          format={format}
          currency={metric.currency ?? currency}
          decimals={metric.format === 'percent' ? 1 : 0}
          duration={1.1}
          className="block font-display text-[1.625rem] leading-none font-semibold tracking-[-0.03em] text-foreground"
        />
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1 pb-0.5 text-[0.6875rem] text-subtle">
            {showDelta ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-0.5 font-semibold tabular-nums',
                  good === null ? 'text-subtle' : good ? 'text-success' : 'text-danger',
                )}
              >
                <DeltaIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
                {formatDelta(metric.deltaPercent)}
              </span>
            ) : null}
            <span className="truncate">{metric.comparisonLabel.replace('previous', 'prev.')}</span>
          </p>
          <MiniTrend values={metric.sparkline.slice(-12)} kind={trend} color={color} width={84} height={30} />
        </div>
      </div>
    </Card>
  )
}
