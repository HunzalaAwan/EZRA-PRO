'use client'

import * as React from 'react'
import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'

import { CountUp } from '@/components/motion/count-up'
import { CardAurora } from '@/components/dashboard/overview/card-aurora'
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

   The `hero` variant is the one card in the row allowed a gradient: the
   headline number sits on the deep aubergine ground with slow aurora
   weather behind a frosted well, the same family as the payout card.
   ========================================================================== */

/** Aubergine into violet and magenta, the revenue card's own sky. */
const HERO_GROUND =
  'linear-gradient(135deg, var(--navy-deep) 0%, color-mix(in oklab, var(--navy-deep) 66%, var(--hero-violet)) 55%, color-mix(in oklab, var(--navy-deep) 52%, var(--hero-magenta)) 100%)'
const HERO_FIELDS = ['var(--hero-violet)', 'var(--hero-magenta)', 'var(--accent)']

export type MiniTrendKind = 'area' | 'bars'

interface MiniTrendProps {
  values: number[]
  kind: MiniTrendKind
  color: string
  width?: number
  height?: number
  /** On the dark hero card: brighter fill, a dark dot ring and a pulse on the last point. */
  hero?: boolean
}

/** Twelve points of context, drawn once on arrival. */
function MiniTrend({ values, kind, color, width = 92, height = 40, hero = false }: MiniTrendProps) {
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
        animate={{ opacity: hero ? 0.22 : 0.12 }}
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
      {hero && !reduce ? (
        <motion.circle
          cx={width - pad}
          cy={lastY}
          fill={color}
          initial={{ r: 3, opacity: 0.55 }}
          animate={{ r: [3, 10, 10], opacity: [0.55, 0, 0] }}
          transition={{ duration: 2.4, times: [0, 0.7, 1], repeat: Infinity, ease: 'easeOut', delay: 1.2 }}
        />
      ) : null}
      <circle
        cx={width - pad}
        cy={lastY}
        r={3}
        fill={color}
        stroke={hero ? 'var(--navy-deep)' : 'var(--surface)'}
        strokeWidth={2}
      />
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
  /** The headline card: dark ground, aurora weather, gold trend line. */
  hero?: boolean
  className?: string
}

export function KpiCard({
  metric,
  currency,
  icon: Icon,
  trend = 'area',
  showDelta = true,
  hero = false,
  className,
}: KpiCardProps) {
  const series = seriesForKpi(metric.key)
  const color = hero ? 'var(--accent)' : kpiAccent(series)
  const good = metric.direction === 'flat' ? null : (metric.direction === 'up') === metric.higherIsBetter
  const DeltaIcon = metric.deltaPercent >= 0 ? TrendingUp : TrendingDown

  const format = metric.format === 'currency' ? 'currency' : metric.format === 'percent' ? 'percent' : 'number'

  /* Good/bad ink stays semantic on the dark card, just lifted enough to read on aubergine. */
  const deltaInk =
    good === null
      ? undefined
      : hero
        ? `color-mix(in oklab, ${good ? 'var(--success)' : 'var(--danger)'} 55%, white)`
        : undefined

  return (
    <Card
      className={cn(
        'flex flex-col p-4',
        hero && 'relative isolate overflow-hidden border-transparent bg-navy-deep text-white shadow-md',
        className,
      )}
    >
      {hero ? <CardAurora tone="dark" fields={3} ring={false} colors={HERO_FIELDS} ground={HERO_GROUND} /> : null}

      <div className="flex items-center gap-2.5">
        <span
          className={cn('grid size-7 shrink-0 place-items-center rounded-lg', hero && 'bg-white/14 text-white')}
          style={hero ? undefined : { background: `color-mix(in oklab, ${color} 13%, transparent)`, color }}
        >
          <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
        </span>
        <span className={cn('truncate text-[0.8125rem] font-medium', hero ? 'text-white/75' : 'text-muted')}>
          {metric.label}
        </span>
      </div>

      <div
        className={cn(
          'mt-3 flex flex-1 flex-col rounded-xl px-4 pt-3.5 pb-3',
          hero ? 'bg-white/[0.09] ring-1 ring-inset ring-white/12 backdrop-blur-[3px]' : 'bg-well',
        )}
      >
        <CountUp
          value={metric.value}
          format={format}
          currency={metric.currency ?? currency}
          decimals={metric.format === 'percent' ? 1 : 0}
          duration={1.1}
          className={cn(
            'block font-display text-[1.625rem] leading-none font-semibold tracking-[-0.03em]',
            hero ? 'text-white' : 'text-foreground',
          )}
        />
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className={cn('flex min-w-0 items-center gap-1 pb-0.5 text-[0.6875rem]', hero ? 'text-white/60' : 'text-subtle')}>
            {showDelta ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-0.5 font-semibold tabular-nums',
                  good === null ? (hero ? 'text-white/70' : 'text-subtle') : hero ? '' : good ? 'text-success' : 'text-danger',
                )}
                style={deltaInk ? { color: deltaInk } : undefined}
              >
                <DeltaIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
                {formatDelta(metric.deltaPercent)}
              </span>
            ) : null}
            <span className="truncate">{metric.comparisonLabel.replace('previous', 'prev.')}</span>
          </p>
          <MiniTrend values={metric.sparkline.slice(-12)} kind={trend} color={color} width={84} height={30} hero={hero} />
        </div>
      </div>
    </Card>
  )
}
