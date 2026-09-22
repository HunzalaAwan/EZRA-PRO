'use client'

/**
 * Storefront funnel. Bars are proportional to the top of the funnel (not to the
 * previous stage) so the shape itself carries the story, and every drop-off is
 * spelled out between the bars — the number an operator actually acts on.
 */

import { useMemo, useRef, type ReactNode } from 'react'
import { motion, useInView } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { ChevronDown } from 'lucide-react'
import { clamp, formatNumber, formatPercent } from '@/lib/utils'
import type { FunnelStage } from '@/types'
import { ChartContainer } from './chart-container'

/** `--ease-out-expo`, in the tuple shape motion expects. */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Stages fade toward the background as the funnel narrows. */
function stageTint(index: number, total: number): string {
  const weight = total <= 1 ? 92 : 92 - (index / (total - 1)) * 34
  return `color-mix(in oklab, var(--chart-1) ${weight.toFixed(1)}%, var(--surface-sunken))`
}

export interface ConversionFunnelProps {
  stages: FunnelStage[]
  height?: number
  title?: string
  description?: string
  toolbar?: ReactNode
  loading?: boolean
  className?: string
}

export function ConversionFunnel({
  stages,
  height,
  title = 'Booking funnel',
  description,
  toolbar,
  loading = false,
  className,
}: ConversionFunnelProps) {
  const reduced = useReducedMotionSafe()
  const viewRef = useRef<HTMLOListElement>(null)
  const inView = useInView(viewRef, { once: true, margin: '-48px' })

  const top = stages[0]?.value ?? 0
  const bottom = stages[stages.length - 1]?.value ?? 0
  const overall = top > 0 ? (bottom / top) * 100 : 0

  const summary = useMemo(() => {
    if (stages.length === 0) return ''
    const worst = stages
      .slice(1)
      .reduce<FunnelStage | null>((lowest, stage) => (!lowest || stage.conversionRate < lowest.conversionRate ? stage : lowest), null)
    const worstPart = worst
      ? ` The biggest drop-off is into ${worst.label} at ${formatPercent(worst.conversionRate, 1)} conversion.`
      : ''
    return `Conversion funnel over ${stages.length} stages, from ${formatNumber(top)} ${
      stages[0]?.label ?? ''
    } to ${formatNumber(bottom)} ${stages[stages.length - 1]?.label ?? ''}, an overall conversion of ${formatPercent(
      overall,
      1,
    )}.${worstPart}`
  }, [stages, top, bottom, overall])

  const resolvedHeight = height ?? Math.max(180, stages.length * 82)

  return (
    <ChartContainer
      title={title}
      description={description}
      ariaLabel={summary}
      height={resolvedHeight}
      toolbar={toolbar}
      loading={loading}
      empty={stages.length === 0}
      className={className}
      footer={
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="text-subtle">End-to-end conversion</span>
          <span className="tabular font-semibold text-foreground">{formatPercent(overall, 1)}</span>
        </div>
      }
      dataTable={
        <table>
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">Visitors</th>
              <th scope="col">Conversion from previous stage</th>
              <th scope="col">Share of top of funnel</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage) => (
              <tr key={stage.key}>
                <th scope="row">{stage.label}</th>
                <td>{formatNumber(stage.value)}</td>
                <td>{formatPercent(stage.conversionRate, 1)}</td>
                <td>{formatPercent(top > 0 ? (stage.value / top) * 100 : 0, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ol ref={viewRef} className="flex h-full flex-col justify-between px-3.5">
        {stages.map((stage, index) => {
          const share = top > 0 ? clamp((stage.value / top) * 100, 0, 100) : 0
          const next = stages[index + 1]
          const lost = next ? stage.value - next.value : 0

          return (
            <li key={stage.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-xs font-medium text-foreground">{stage.label}</span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tabular text-xs font-semibold text-foreground">{formatNumber(stage.value)}</span>
                  {index > 0 ? (
                    <span className="tabular text-xs text-subtle">{formatPercent(stage.conversionRate, 1)}</span>
                  ) : null}
                </span>
              </div>

              <div className="mt-1.5 h-8 w-full overflow-hidden rounded-lg bg-surface-sunken">
                <motion.div
                  className="h-full rounded-lg"
                  style={{ background: stageTint(index, stages.length) }}
                  initial={reduced ? false : { width: '0%' }}
                  // Widths grow only once the funnel is actually on screen.
                  animate={{ width: reduced || inView ? `${share}%` : '0%' }}
                  transition={reduced ? { duration: 0 } : { duration: 0.7, delay: index * 0.08, ease: EASE_OUT_EXPO }}
                />
              </div>

              {next ? (
                <div className="flex items-center gap-1.5 pl-1 pt-1 text-xs text-subtle">
                  <ChevronDown className="size-3 shrink-0" aria-hidden="true" />
                  <span className="tabular font-medium text-muted">{formatNumber(lost)}</span>
                  <span>lost</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular">{formatPercent(100 - next.conversionRate, 1)} drop</span>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </ChartContainer>
  )
}
