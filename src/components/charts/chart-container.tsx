'use client'

/**
 * Chart chrome — the card shell, legend and palette plumbing every EZRA chart shares.
 *
 * Recharts cannot read Tailwind classes, so series colours are passed as raw
 * `var(--chart-N)` references, which the SVG resolves live and therefore flip
 * with the theme for free. `useChartColors()` exists for the rarer case where a
 * *computed* colour string is needed — colour maths or a non-CSS consumer.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { ChartNoAxesColumn, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn, formatDelta } from '@/lib/utils'
import type { Activity } from '@/types'

/* ==========================================================================
   PALETTE
   ========================================================================== */

/** Ordered series palette. Always consume in order so colours stay stable. */
export const CHART_COLOR_VARS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const

/** Wraps around for series lists longer than the ramp. */
export function chartColorVar(index: number): string {
  const len = CHART_COLOR_VARS.length
  return CHART_COLOR_VARS[((index % len) + len) % len]
}

/**
 * Activity tint -> data-viz ramp. Mapping through the chart tokens (rather than
 * the raw brand ramps) keeps activity colours legible in both themes.
 */
export const ACTIVITY_COLOR_VAR: Record<Activity['colorKey'], string> = {
  lagoon: 'var(--chart-1)', // teal
  coral: 'var(--chart-3)', // coral
  reef: 'var(--chart-4)', // violet
  sunset: 'var(--chart-7)', // amber
  info: 'var(--chart-6)', // blue
  success: 'var(--chart-5)', // green
}

/** Shared axis/grid ink — hairline grid, muted ticks, no axis rules. */
export const CHART_INK = {
  grid: 'var(--border-subtle)',
  tick: 'var(--fg-subtle)',
  reference: 'var(--fg-faint)',
  cursor: 'var(--border-strong)',
} as const

export interface ChartPalette {
  /** Resolved `--chart-1 … --chart-8`. */
  series: string[]
  grid: string
  tick: string
  foreground: string
  muted: string
  surface: string
  primary: string
  success: string
  warning: string
  danger: string
}

const SERIES_VARS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
  '--chart-7',
  '--chart-8',
]

/**
 * SSR-safe seed: `var()` references render correctly before hydration, so the
 * first client paint matches the server exactly and the effect can upgrade them
 * to computed values without a flash.
 */
const FALLBACK_PALETTE: ChartPalette = {
  series: [...CHART_COLOR_VARS],
  grid: CHART_INK.grid,
  tick: CHART_INK.tick,
  foreground: 'var(--fg)',
  muted: 'var(--fg-muted)',
  surface: 'var(--surface)',
  primary: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
}

/**
 * Resolved chart palette that re-reads whenever the theme changes — both the
 * explicit `.dark` class toggle and the OS-level preference.
 */
export function useChartColors(): ChartPalette {
  const [palette, setPalette] = useState<ChartPalette>(FALLBACK_PALETTE)

  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement)
      const token = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback
      setPalette({
        series: SERIES_VARS.map((name, i) => token(name, CHART_COLOR_VARS[i])),
        grid: token('--border-subtle', CHART_INK.grid),
        tick: token('--fg-subtle', CHART_INK.tick),
        foreground: token('--fg', 'var(--fg)'),
        muted: token('--fg-muted', 'var(--fg-muted)'),
        surface: token('--surface', 'var(--surface)'),
        primary: token('--primary', 'var(--primary)'),
        success: token('--success', 'var(--success)'),
        warning: token('--warning', 'var(--warning)'),
        danger: token('--danger', 'var(--danger)'),
      })
    }

    read()

    // `.dark` is toggled on <html>; watch the attribute rather than polling.
    const observer = new MutationObserver(read)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme'],
    })

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', read)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', read)
    }
  }, [])

  return palette
}

/* ==========================================================================
   DELTA CHIP
   ========================================================================== */

export interface ChartDeltaChipProps {
  /** Percent change. */
  value: number
  /** Flips the good/bad semantics (for cancellations, down is good). */
  higherIsBetter?: boolean
  size?: 'xs' | 'sm'
  /** Renders without a background fill. */
  bare?: boolean
  className?: string
}

/** Signed change pill. Direction is carried by the arrow icon, not colour alone. */
export function ChartDeltaChip({
  value,
  higherIsBetter = true,
  size = 'xs',
  bare = false,
  className,
}: ChartDeltaChipProps) {
  const flat = Math.abs(value) < 0.05
  const good = flat ? null : value > 0 === higherIsBetter
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md font-medium tabular',
        size === 'xs' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs',
        good === null && (bare ? 'text-subtle' : 'bg-surface-sunken text-subtle'),
        good === true && (bare ? 'text-success' : 'bg-success-soft text-success'),
        good === false && (bare ? 'text-danger' : 'bg-danger-soft text-danger'),
        className,
      )}
    >
      <Icon className={size === 'xs' ? 'size-3' : 'size-3.5'} aria-hidden="true" />
      {formatDelta(value)}
    </span>
  )
}

/* ==========================================================================
   LEGEND
   ========================================================================== */

export type ChartLegendShape = 'dot' | 'square' | 'line' | 'dashed'

export interface ChartLegendItem {
  key: string
  label: string
  /** A CSS colour — pass `var(--chart-N)`. */
  color: string
  /** Optional formatted value shown after the label. */
  value?: string
  shape?: ChartLegendShape
}

export interface ChartLegendProps {
  items: ChartLegendItem[]
  /** Controlled hidden keys. Omit for self-managed toggling. */
  hidden?: string[]
  onToggle?: (key: string, nextHidden: string[]) => void
  align?: 'start' | 'between' | 'end'
  className?: string
}

function LegendSwatch({ color, shape = 'dot' }: { color: string; shape?: ChartLegendShape }) {
  if (shape === 'line' || shape === 'dashed') {
    return (
      <span
        aria-hidden="true"
        className="h-0.5 w-3.5 shrink-0 rounded-full"
        style={
          shape === 'line'
            ? { background: color }
            : {
                backgroundImage: `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 7px)`,
              }
        }
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cn('size-2.5 shrink-0', shape === 'square' ? 'rounded-[3px]' : 'rounded-full')}
      style={{ background: color }}
    />
  )
}

/** Interactive legend — clicking a series toggles it. */
export function ChartLegend({ items, hidden, onToggle, align = 'start', className }: ChartLegendProps) {
  const [internalHidden, setInternalHidden] = useState<string[]>([])
  const isControlled = hidden !== undefined
  const hiddenKeys = isControlled ? hidden : internalHidden

  const toggle = useCallback(
    (key: string) => {
      const next = hiddenKeys.includes(key) ? hiddenKeys.filter((k) => k !== key) : [...hiddenKeys, key]
      if (!isControlled) setInternalHidden(next)
      onToggle?.(key, next)
    },
    [hiddenKeys, isControlled, onToggle],
  )

  return (
    <ul
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2',
        align === 'between' && 'justify-between',
        align === 'end' && 'justify-end',
        className,
      )}
    >
      {items.map((item) => {
        const isHidden = hiddenKeys.includes(item.key)
        return (
          <li key={item.key}>
            <button
              type="button"
              onClick={() => toggle(item.key)}
              aria-pressed={!isHidden}
              className={cn(
                'group flex items-center gap-2 rounded-md px-1 py-0.5 text-xs transition-colors',
                'hover:bg-surface-sunken focus-visible:bg-surface-sunken',
                isHidden ? 'text-faint' : 'text-muted',
              )}
            >
              <span className={cn('flex items-center transition-opacity', isHidden && 'opacity-40')}>
                <LegendSwatch color={item.color} shape={item.shape} />
              </span>
              <span className={cn('font-medium', isHidden && 'line-through')}>{item.label}</span>
              {item.value ? <span className="tabular text-subtle">{item.value}</span> : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ==========================================================================
   STATES
   ========================================================================== */

/** Deterministic bar heights — no RNG, so SSR and client agree. */
const SKELETON_HEIGHTS = [42, 68, 55, 81, 63, 92, 74, 58, 86, 70, 95, 66]

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="flex w-full items-end gap-2 px-4 pb-6" style={{ height }} aria-hidden="true">
      {SKELETON_HEIGHTS.map((h, i) => (
        <div key={i} className="shimmer flex-1 rounded-t-md bg-surface-sunken" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

function ChartEmpty({ height, message, icon }: { height: number; message: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ height }}>
      <span className="flex size-11 items-center justify-center rounded-xl bg-surface-sunken text-faint">
        {icon ?? <ChartNoAxesColumn className="size-5" aria-hidden="true" />}
      </span>
      <p className="max-w-[28ch] text-xs text-subtle">{message}</p>
    </div>
  )
}

/* ==========================================================================
   CONTAINER
   ========================================================================== */

export interface ChartContainerProps {
  title: string
  /** Short subtitle rendered under the title. */
  description?: string
  /**
   * Screen-reader summary of what the chart shows. Falls back to
   * "<title>. <description>" — always write something data-bearing here.
   */
  ariaLabel?: string
  /** Plot area height in px. */
  height?: number
  /** Right-aligned controls: range switchers, metric toggles, menus. */
  toolbar?: ReactNode
  /** Legend row, rendered between the header and the plot. */
  legend?: ReactNode
  /** Rendered under the plot — annotations, totals, scale keys. */
  footer?: ReactNode
  /** Visually hidden `<table>` fallback for assistive tech. */
  dataTable?: ReactNode
  /**
   * Set when the chart body is already semantic HTML (a real table or list).
   * Skips the `role="img"` wrapper, which would otherwise hide that structure
   * from assistive tech, and exposes the summary as visually hidden prose.
   */
  semantic?: boolean
  loading?: boolean
  empty?: boolean
  emptyMessage?: string
  emptyIcon?: ReactNode
  /** Drops the card border/background — for charts embedded in another card. */
  bare?: boolean
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * Card shell for every chart: title, subtitle, toolbar, legend, fixed-height
 * plot area, loading skeleton and empty state.
 */
export function ChartContainer({
  title,
  description,
  ariaLabel,
  height = 300,
  toolbar,
  legend,
  footer,
  dataTable,
  semantic = false,
  loading = false,
  empty = false,
  emptyMessage = 'No data for this period yet.',
  emptyIcon,
  bare = false,
  className,
  bodyClassName,
  children,
}: ChartContainerProps) {
  const summary = ariaLabel ?? [title, description].filter(Boolean).join('. ')

  return (
    <section
      className={cn('flex flex-col', !bare && 'rounded-2xl border border-line bg-surface shadow-sm', className)}
    >
      <header className={cn('flex items-start justify-between gap-3', bare ? 'pb-3' : 'px-5 pb-3 pt-5')}>
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
        </div>
        {toolbar ? <div className="flex shrink-0 items-center gap-1.5">{toolbar}</div> : null}
      </header>

      {legend ? <div className={cn('pb-3', !bare && 'px-5')}>{legend}</div> : null}

      <div className={cn(!bare && 'px-1.5 pb-3', bodyClassName)}>
        {loading ? (
          <ChartSkeleton height={height} />
        ) : empty ? (
          <ChartEmpty height={height} message={emptyMessage} icon={emptyIcon} />
        ) : semantic ? (
          <>
            <p className="sr-only">{summary}</p>
            <div style={{ height }} className="w-full">
              {children}
            </div>
          </>
        ) : (
          <div role="img" aria-label={summary} style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </div>

      {dataTable && !semantic && !loading && !empty ? <div className="sr-only">{dataTable}</div> : null}

      {footer ? (
        <div className={cn('border-t border-line-subtle pt-3', bare ? 'mt-1' : 'mx-5 mb-4')}>{footer}</div>
      ) : null}
    </section>
  )
}
