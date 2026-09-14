'use client'

import { motion, useReducedMotion } from 'motion/react'
import { Info } from 'lucide-react'

import { ChartDeltaChip } from '@/components/charts/chart-container'
import { CountUp } from '@/components/motion/count-up'
import { Card } from '@/components/ui/card'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { KpiMetric } from '@/types'

/* ==========================================================================
   CapacityHealth — a "score" read of how well the fleet is being sold.

   Utilisation is the one rate that decides whether an operator adds a
   departure or cuts one, so it gets the score-card treatment: the figure,
   a one-word verdict, and a segmented bar that fills in segment by segment
   on entry. Two supporting rates underneath give the verdict its context.
   ========================================================================== */

const SEGMENTS = 12

function verdict(value: number): { word: string; tone: 'success' | 'primary' | 'warning' | 'danger' } {
  if (value >= 85) return { word: 'Excellent', tone: 'success' }
  if (value >= 70) return { word: 'Strong', tone: 'primary' }
  if (value >= 50) return { word: 'Steady', tone: 'warning' }
  return { word: 'Soft', tone: 'danger' }
}

const TONE_TEXT = {
  success: 'text-success',
  primary: 'text-primary',
  warning: 'text-warning',
  danger: 'text-danger',
} as const

const TONE_FILL = {
  success: 'bg-success',
  primary: 'bg-primary',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const

export interface CapacityHealthProps {
  /** The utilisation KPI (0–100). */
  metric: KpiMetric
  /** Rates shown beneath the bar, e.g. repeat guests and cancellations. */
  supporting?: KpiMetric[]
  className?: string
}

export function CapacityHealth({ metric, supporting = [], className }: CapacityHealthProps) {
  const reduce = useReducedMotion()
  const filled = Math.round((Math.max(0, Math.min(100, metric.value)) / 100) * SEGMENTS)
  const { word, tone } = verdict(metric.value)

  return (
    <Card className={cn('flex h-full flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">
            Capacity health
          </h2>
          <p className="mt-0.5 text-[0.6875rem] text-subtle">{metric.comparisonLabel}</p>
        </div>
        {metric.hint ? (
          <SimpleTooltip label={metric.hint} side="left">
            <span
              tabIndex={0}
              role="note"
              aria-label={metric.hint}
              className="grid size-6 shrink-0 place-items-center rounded-full text-faint transition-colors hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Info aria-hidden="true" className="size-3.5" />
            </span>
          </SimpleTooltip>
        ) : null}
      </div>

      {/* ---- verdict + figure ---------------------------------------------- */}
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className={cn('font-display text-lg font-semibold tracking-[-0.02em]', TONE_TEXT[tone])}>
          {word}
        </span>
        <span className="flex items-baseline gap-0.5">
          <CountUp
            value={metric.value}
            format="number"
            decimals={1}
            duration={1.2}
            className="font-display text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums"
          />
          <span className="text-sm font-semibold text-muted">%</span>
        </span>
      </div>

      {/* ---- segmented bar, filling on entry ------------------------------- */}
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(metric.value)}
        aria-label={`${metric.label} ${metric.value.toFixed(1)} percent, ${word.toLowerCase()}`}
        className="mt-3 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${SEGMENTS}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const on = i < filled
          return (
            <motion.span
              key={i}
              aria-hidden="true"
              initial={reduce ? false : { scaleY: 0.35, opacity: 0.4 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ delay: 0.25 + i * 0.045, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'block h-2.5 origin-bottom rounded-[3px]',
                on ? TONE_FILL[tone] : 'bg-surface-sunken ring-1 ring-line-subtle ring-inset',
              )}
            />
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[0.6875rem]">
        <span className="text-subtle">
          {filled} of {SEGMENTS} seats sold, on average
        </span>
        <ChartDeltaChip value={metric.deltaPercent} higherIsBetter={metric.higherIsBetter} size="xs" bare />
      </div>

      {/* ---- the rates that explain the verdict ---------------------------- */}
      {supporting.length > 0 ? (
        <dl className="mt-auto grid grid-cols-2 gap-3 border-t border-line-subtle pt-4">
          {supporting.map((rate) => (
            <div key={rate.key} className="min-w-0">
              <dt className="truncate text-[0.6875rem] text-subtle">{rate.label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-base font-semibold tracking-[-0.02em] text-foreground tabular-nums">
                  {rate.value.toFixed(1)}%
                </span>
                <ChartDeltaChip
                  value={rate.deltaPercent}
                  higherIsBetter={rate.higherIsBetter}
                  size="xs"
                  bare
                />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Card>
  )
}
