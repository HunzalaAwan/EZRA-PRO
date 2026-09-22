'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { animate, motion, useIsomorphicLayoutEffect } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Info, Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'

import { seriesVar, type SeriesKey } from '@/lib/metric-colors'
import {
  cn,
  formatCurrency,
  formatDelta,
  formatDuration,
  formatNumber,
  formatPercent,
  sparklinePath,
} from '@/lib/utils'
import type { CurrencyCode, KpiMetric, TrendDirection } from '@/types'

/* ==========================================================================
   Stat — the KPI tile.

   Three ideas hold this together:
   1. Every tile wears ONE colour — the metric's own series colour — on its
      icon and sparkline, so revenue looks the same here as it does on the
      trend chart. Good/bad is carried only by the delta chip, so the tile is
      not shouting red and green at the same time.
   2. The value counts up by mutating textContent from a motion animation
      rather than by setting React state 60x a second — the tile re-renders
      exactly once no matter how long the count runs.
   3. Server HTML always contains the final, formatted number. The count-up is
      seeded in a layout effect, so there is no flash and no hydration drift.
   ========================================================================== */

export type StatTone = 'good' | 'bad' | 'neutral'

/** A series key, or one of the legacy brand names older callers still pass. */
export type StatAccent = SeriesKey | 'lagoon' | 'coral' | 'sunset' | 'reef'

const LEGACY_ACCENT: Record<'lagoon' | 'coral' | 'sunset' | 'reef', SeriesKey> = {
  lagoon: 'revenue',
  coral: 'cancellations',
  sunset: 'aov',
  reef: 'guests',
}

export function accentColor(accent: StatAccent): string {
  const key = (LEGACY_ACCENT as Record<string, SeriesKey>)[accent] ?? (accent as SeriesKey)
  return seriesVar(key)
}

const TONE_CHIP: Record<StatTone, string> = {
  good: 'bg-success-soft/70 text-success',
  bad: 'bg-danger-soft/70 text-danger',
  neutral: 'bg-surface-sunken text-subtle',
}

const TONE_ICON: Record<TrendDirection, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

/**
 * Green when the metric moved the way the operator wants it to, regardless of
 * which direction that is. Flat is always neutral.
 */
export function statTone(direction: TrendDirection, higherIsBetter: boolean): StatTone {
  if (direction === 'flat') return 'neutral'
  return (direction === 'up') === higherIsBetter ? 'good' : 'bad'
}

export function formatStatValue(
  value: number,
  format: KpiMetric['format'],
  options: { currency?: CurrencyCode; compact?: boolean; decimals?: number } = {},
): string {
  const { currency = 'USD', compact = false, decimals = 0 } = options
  switch (format) {
    case 'currency':
      return formatCurrency(Math.round(value), currency, { compact })
    case 'percent':
      return formatPercent(value, decimals)
    case 'rating':
      return value.toFixed(1)
    case 'duration':
      return formatDuration(Math.max(0, Math.round(value)))
    case 'number':
    default:
      return formatNumber(value, { compact, decimals })
  }
}

/* --------------------------------------------------------------------------
   Sparkline
   -------------------------------------------------------------------------- */

export interface StatSparklineProps extends Omit<React.ComponentProps<'svg'>, 'values'> {
  values: number[]
  width?: number
  height?: number
  /** Any CSS colour. Defaults to the tile's `--stat-color`. */
  color?: string
  /** Draws the line on mount. Ignored under reduced motion. */
  animateIn?: boolean
}

function StatSparkline({
  values,
  width = 112,
  height = 36,
  color = 'var(--stat-color, var(--series-revenue))',
  animateIn = true,
  className,
  ...props
}: StatSparklineProps) {
  const reduceMotion = useReducedMotionSafe()

  if (values.length < 2) return null

  const pad = 4
  const line = sparklinePath(values, width, height, pad)
  // Close the line down to the baseline to get a fillable area.
  const area = `${line} L${(width - pad).toFixed(2)},${height} L${pad.toFixed(2)},${height} Z`

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const last = values[values.length - 1]
  const lastY = pad + (height - pad * 2) * (1 - (last - min) / span)

  const shouldDraw = animateIn && !reduceMotion

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      role="presentation"
      aria-hidden="true"
      className={cn('overflow-visible', className)}
      style={{ color }}
      {...props}
    >
      {/* Flat wash under the line — one tone, never a gradient. */}
      <motion.path
        d={area}
        fill="currentColor"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.12 }}
        transition={shouldDraw ? { duration: 0.6, delay: 0.5 } : { duration: 0 }}
      />
      <motion.path
        d={line}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        // Kept unconditional so SSR and client hydrate the same inline style —
        // `useReducedMotionSafe()` disagrees across that boundary. Opting out zeroes
        // the duration instead, which paints the finished line on frame one.
        initial={{ pathLength: 0, opacity: 0.45 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={shouldDraw ? { duration: 0.9, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
      />
      {/* End marker with a surface ring so it reads where the line doubles back. */}
      <circle cx={width - pad} cy={lastY} r={3} fill="currentColor" stroke="var(--surface)" strokeWidth={2} />
    </svg>
  )
}

/* --------------------------------------------------------------------------
   Animated value
   -------------------------------------------------------------------------- */

interface StatValueProps {
  value: number
  format: KpiMetric['format']
  currency?: CurrencyCode
  compact?: boolean
  decimals?: number
  countUp?: boolean
  className?: string
}

function StatValue({
  value,
  format,
  currency,
  compact,
  decimals = 0,
  countUp = true,
  className,
}: StatValueProps) {
  const reduceMotion = useReducedMotionSafe()
  const nodeRef = React.useRef<HTMLSpanElement>(null)
  // Where the next animation starts from — 0 on mount, the live figure after.
  const fromRef = React.useRef(0)

  const formatted = formatStatValue(value, format, { currency, compact, decimals })
  const shouldCount = countUp && !reduceMotion

  useIsomorphicLayoutEffect(() => {
    const node = nodeRef.current
    if (!node) return

    if (!shouldCount) {
      fromRef.current = value
      return
    }

    const from = fromRef.current
    // Runs before paint, so the final number committed by React is replaced by
    // the starting number without ever reaching the screen.
    node.textContent = formatStatValue(from, format, { currency, compact, decimals })

    const controls = animate(from, value, {
      duration: 1.05,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        fromRef.current = v
        node.textContent = formatStatValue(v, format, { currency, compact, decimals })
      },
      onComplete: () => {
        fromRef.current = value
        node.textContent = formatted
      },
    })

    return () => controls.stop()
  }, [value, format, currency, compact, decimals, shouldCount, formatted])

  return (
    <span
      ref={nodeRef}
      // Locks column width so the tile does not jitter as digits change.
      className={cn('tabular-nums', className)}
    >
      {formatted}
    </span>
  )
}

/* --------------------------------------------------------------------------
   Stat — content block (no chrome)
   -------------------------------------------------------------------------- */

const statVariants = cva('flex flex-col', {
  variants: {
    size: {
      sm: 'gap-1.5 [--stat-value:1.5rem]',
      md: 'gap-2 [--stat-value:1.875rem]',
      lg: 'gap-2.5 [--stat-value:2.375rem]',
    },
  },
  defaultVariants: { size: 'md' },
})

export type StatVariants = VariantProps<typeof statVariants>

export interface StatProps extends Omit<React.ComponentProps<'div'>, 'children'>, StatVariants {
  label: React.ReactNode
  value: number
  format?: KpiMetric['format']
  currency?: CurrencyCode
  /** Percent change vs the comparison period. Omit to hide the delta chip. */
  deltaPercent?: number
  direction?: TrendDirection
  /** Decides whether an increase is good. Defaults to `true`. */
  higherIsBetter?: boolean
  comparisonLabel?: React.ReactNode
  sparkline?: number[]
  /** Explanatory footnote, surfaced on an info affordance. */
  hint?: string
  /**
   * Accepts a component reference (`icon={Radio}`) for client-rendered
   * callers, or a pre-rendered element (`icon={<Radio />}`) for a Server
   * Component passing this across the RSC boundary — a bare function
   * reference isn't serializable there, but an element descriptor is.
   */
  icon?: LucideIcon | React.ReactElement
  /** The metric's series colour; icon chip and sparkline both wear it. */
  accent?: StatAccent
  /** Abbreviates large values ("$128.4K"). */
  compact?: boolean
  /** Decimal places for `percent` / `number` formats. */
  decimals?: number
  countUp?: boolean
}

function Stat({
  className,
  style,
  size = 'md',
  label,
  value,
  format = 'number',
  currency,
  deltaPercent,
  direction = 'flat',
  higherIsBetter = true,
  comparisonLabel,
  sparkline,
  hint,
  icon,
  accent = 'revenue',
  compact = false,
  decimals = 0,
  countUp = true,
  ...props
}: StatProps) {
  const iconNode = React.isValidElement(icon)
    ? icon
    : icon
      ? React.createElement(icon, { 'aria-hidden': true, className: 'size-4', strokeWidth: 1.9 })
      : null
  const tone = statTone(direction, higherIsBetter)
  const DeltaIcon = TONE_ICON[direction]
  const showDelta = typeof deltaPercent === 'number'

  return (
    <div
      data-slot="stat"
      className={cn(statVariants({ size }), className)}
      style={{ ...style, ['--stat-color' as string]: accentColor(accent) }}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[0.8125rem] font-medium text-muted">{label}</span>
          {hint ? (
            <span
              tabIndex={0}
              role="note"
              aria-label={hint}
              title={hint}
              className="inline-flex rounded-full text-faint transition-colors duration-200 hover:text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <Info aria-hidden="true" className="size-3.5" />
            </span>
          ) : null}
        </div>

        {iconNode ? (
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-lg',
              'bg-[color-mix(in_oklab,var(--stat-color)_13%,transparent)] text-(--stat-color)',
            )}
          >
            {iconNode}
          </span>
        ) : null}
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <StatValue
            value={value}
            format={format}
            currency={currency}
            compact={compact}
            decimals={decimals}
            countUp={countUp}
            className="block font-display text-[length:var(--stat-value)] font-semibold leading-none tracking-[-0.03em] text-foreground"
          />

          {(showDelta || comparisonLabel) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              {showDelta ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
                    TONE_CHIP[tone],
                  )}
                >
                  <DeltaIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
                  {formatDelta(deltaPercent)}
                </span>
              ) : null}
              {comparisonLabel ? (
                <span className="truncate text-xs text-subtle">{comparisonLabel}</span>
              ) : null}
            </div>
          )}
        </div>

        {sparkline && sparkline.length > 1 ? (
          <StatSparkline
            values={sparkline}
            width={size === 'sm' ? 84 : 112}
            height={size === 'sm' ? 28 : 36}
            className="shrink-0"
          />
        ) : null}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   StatCard — card chrome + KpiMetric adapter
   -------------------------------------------------------------------------- */

const statCardVariants = cva(
  [
    'group relative isolate overflow-hidden rounded-2xl border border-line bg-surface',
    'shadow-xs transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
    'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
    'motion-reduce:transform-none motion-reduce:transition-none',
  ],
  {
    variants: {
      size: {
        sm: 'p-4',
        md: 'p-5',
        lg: 'p-6',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type StatCardVariants = VariantProps<typeof statCardVariants>

export interface StatCardProps
  extends Omit<React.ComponentProps<'div'>, 'children'>,
    StatCardVariants {
  /** Preferred API — everything the tile needs in one object. */
  metric?: KpiMetric
  /** Escape hatch for tiles not backed by a KpiMetric. One of the two is required. */
  stat?: Omit<StatProps, 'size'>
  icon?: LucideIcon | React.ReactElement
  accent?: StatAccent
  compact?: boolean
  countUp?: boolean
  /** Renders below the stat — a link, a mini legend, a secondary figure. */
  footer?: React.ReactNode
}

function StatCard({
  className,
  size = 'md',
  metric,
  stat,
  icon,
  accent = 'revenue',
  compact = false,
  countUp = true,
  footer,
  ...props
}: StatCardProps) {
  const resolved: Omit<StatProps, 'size'> | undefined = metric
    ? {
        label: metric.label,
        value: metric.value,
        format: metric.format,
        currency: metric.currency,
        deltaPercent: metric.deltaPercent,
        direction: metric.direction,
        higherIsBetter: metric.higherIsBetter,
        comparisonLabel: metric.comparisonLabel,
        sparkline: metric.sparkline,
        hint: metric.hint,
        // Rates read better with one decimal; counts and money do not.
        decimals: metric.format === 'percent' ? 1 : 0,
      }
    : stat

  if (!resolved) return null

  return (
    <div
      data-slot="stat-card"
      className={cn(statCardVariants({ size }), className)}
      {...props}
    >
      <Stat
        {...resolved}
        size={size}
        icon={icon}
        accent={accent}
        compact={compact}
        countUp={countUp}
      />

      {footer ? (
        <div className="mt-4 border-t border-line-subtle pt-3 text-xs text-subtle">{footer}</div>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------------------
   StatGrid — the KPI row
   -------------------------------------------------------------------------- */

const statGridVariants = cva('grid gap-4', {
  variants: {
    columns: {
      2: 'grid-cols-1 sm:grid-cols-2',
      3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
    },
  },
  defaultVariants: { columns: 4 },
})

export type StatGridVariants = VariantProps<typeof statGridVariants>

export interface StatGridProps extends React.ComponentProps<'div'>, StatGridVariants {}

function StatGrid({ className, columns, ...props }: StatGridProps) {
  return (
    <div
      data-slot="stat-grid"
      className={cn(statGridVariants({ columns }), className)}
      {...props}
    />
  )
}

export {
  Stat,
  StatCard,
  StatGrid,
  StatSparkline,
  StatValue,
  statVariants,
  statCardVariants,
  statGridVariants,
}
