'use client'

/**
 * The one tooltip. Recharts' default is never used anywhere in EZRA — every
 * chart passes `content={<ChartTooltip … />}`, and the hand-built charts
 * (heatmap, funnel, cohort, geo) reuse `ChartTooltipShell` directly so the
 * hover experience is identical across the whole analytics surface.
 */

import type { ReactNode } from 'react'
import type { TooltipContentProps, TooltipPayload, TooltipPayloadEntry, TooltipValueType } from 'recharts'
import { cn, clamp, formatNumber } from '@/lib/utils'
import { ChartDeltaChip } from './chart-container'

/* ==========================================================================
   CURSORS — shared crosshair styling
   ========================================================================== */

/** Vertical crosshair for line/area charts. */
export const CHART_CURSOR_LINE = {
  stroke: 'var(--border-strong)',
  strokeWidth: 1,
  strokeDasharray: '4 4',
} as const

/** Soft column wash for bar charts — a dashed rule reads as noise behind bars. */
export const CHART_CURSOR_BAND = {
  fill: 'var(--fg)',
  fillOpacity: 0.045,
} as const

/* ==========================================================================
   SHELL — the visual tooltip, independent of Recharts
   ========================================================================== */

export interface ChartTooltipShellProps {
  /** Bold heading — usually the hovered date or category. */
  label?: ReactNode
  /** Small line under the heading. */
  sublabel?: ReactNode
  /** Right-aligned chip beside the heading. */
  badge?: ReactNode
  footer?: ReactNode
  className?: string
  children?: ReactNode
}

export function ChartTooltipShell({ label, sublabel, badge, footer, className, children }: ChartTooltipShellProps) {
  return (
    <div
      className={cn(
        'glass-strong pointer-events-none min-w-[11rem] max-w-[16rem] rounded-xl px-3 py-2.5 shadow-lg',
        className,
      )}
    >
      {label || badge ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {badge}
        </div>
      ) : null}
      {sublabel ? <div className="mt-0.5 text-xs text-subtle">{sublabel}</div> : null}
      {children ? <div className={cn(label || sublabel ? 'mt-2' : '', 'space-y-1.5')}>{children}</div> : null}
      {footer ? (
        <div className="mt-2 border-t border-line-subtle pt-1.5 text-xs text-subtle">{footer}</div>
      ) : null}
    </div>
  )
}

export interface ChartTooltipRowProps {
  /** CSS colour for the series swatch. */
  color?: string
  name: ReactNode
  value: ReactNode
  /** Renders the swatch as a dashed rule — matches comparison series. */
  dashed?: boolean
  muted?: boolean
}

export function ChartTooltipRow({ color, name, value, dashed = false, muted = false }: ChartTooltipRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="flex min-w-0 items-center gap-2">
        {color ? (
          dashed ? (
            <span
              aria-hidden="true"
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ backgroundImage: `repeating-linear-gradient(to right, ${color} 0 3px, transparent 3px 6px)` }}
            />
          ) : (
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: color }} />
          )
        ) : null}
        <span className={cn('truncate', muted ? 'text-subtle' : 'text-muted')}>{name}</span>
      </span>
      <span className={cn('tabular shrink-0 font-semibold', muted ? 'text-muted' : 'text-foreground')}>{value}</span>
    </div>
  )
}

/**
 * Absolutely-positioned wrapper for the hand-built charts. Place inside a
 * `relative` container and pass pointer coordinates relative to that container.
 */
export interface ChartHoverTooltipProps {
  x: number
  y: number
  /** Container width, used to keep the tooltip inside the card. */
  width?: number
  /** Half-width reserved when clamping. */
  inset?: number
  children: ReactNode
}

export function ChartHoverTooltip({ x, y, width, inset = 96, children }: ChartHoverTooltipProps) {
  const left = width && width > inset * 2 ? clamp(x, inset, width - inset) : x
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  )
}

/* ==========================================================================
   RECHARTS ADAPTER
   ========================================================================== */

/** Only the slice of props Recharts injects when it clones the content element. */
type InjectedTooltipProps = Partial<Pick<TooltipContentProps, 'active' | 'payload' | 'label' | 'coordinate'>>

export interface TooltipDelta {
  value: number
  label: string
  higherIsBetter?: boolean
}

export interface ChartTooltipProps extends InjectedTooltipProps {
  /** Formats the heading (the hovered axis value). */
  formatLabel?: (label: string | number | undefined) => ReactNode
  /** Formats each series value. Defaults to a plain number. */
  formatValue?: (value: number, entry: TooltipPayloadEntry) => ReactNode
  /** Overrides the series name. Defaults to `name` then `dataKey`. */
  formatName?: (entry: TooltipPayloadEntry) => ReactNode
  /** dataKeys to drop from the rows — e.g. a comparison series shown as a delta. */
  hideKeys?: string[]
  /** dataKeys rendered with a dashed swatch. */
  dashedKeys?: string[]
  /** Derives a change chip from the hovered datum. */
  delta?: (datum: Record<string, unknown>) => TooltipDelta | null
  /** Small line under the heading. Falls back to the delta's own caption. */
  sublabel?: (datum: Record<string, unknown>) => ReactNode
  /** Extra content under the rows (scale keys, secondary stats). */
  footer?: (datum: Record<string, unknown>) => ReactNode
  /** Appends a summed total row — for stacked charts. */
  showTotal?: boolean
  totalLabel?: string
  className?: string
}

function toNumber(value: TooltipValueType | undefined): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (Array.isArray(value)) return toNumber(value[value.length - 1])
  return 0
}

/** Picks the most representative colour Recharts hands us for a series. */
function entryColor(entry: TooltipPayloadEntry): string | undefined {
  const stroke = typeof entry.stroke === 'string' ? entry.stroke : undefined
  if (stroke && stroke !== 'none') return stroke
  if (entry.color) return entry.color
  const fill = typeof entry.fill === 'string' ? entry.fill : undefined
  // Area fills are `url(#gradient)` references — useless as a swatch colour.
  return fill && !fill.startsWith('url(') ? fill : undefined
}

/**
 * Custom Recharts tooltip. Pass as an element so Recharts can clone it with the
 * live hover payload: `<Tooltip content={<ChartTooltip formatValue={…} />} />`.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  formatValue,
  formatName,
  hideKeys,
  dashedKeys,
  delta,
  sublabel,
  footer,
  showTotal = false,
  totalLabel = 'Total',
  className,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const rows = (payload as TooltipPayload).filter(
    (entry) => entry.hide !== true && !hideKeys?.includes(String(entry.dataKey)),
  )
  if (rows.length === 0) return null

  const datum = (rows[0]?.payload ?? {}) as Record<string, unknown>
  const change = delta?.(datum) ?? null
  const total = rows.reduce((acc, entry) => acc + toNumber(entry.value), 0)

  return (
    <ChartTooltipShell
      className={className}
      label={formatLabel ? formatLabel(label) : label}
      badge={
        change ? (
          <ChartDeltaChip value={change.value} higherIsBetter={change.higherIsBetter ?? true} />
        ) : undefined
      }
      sublabel={sublabel ? sublabel(datum) : change?.label}
      footer={footer?.(datum)}
    >
      {rows.map((entry, index) => {
        const value = toNumber(entry.value)
        return (
          <ChartTooltipRow
            key={`${String(entry.dataKey)}-${index}`}
            color={entryColor(entry)}
            dashed={dashedKeys?.includes(String(entry.dataKey))}
            name={formatName ? formatName(entry) : (entry.name ?? String(entry.dataKey ?? ''))}
            value={formatValue ? formatValue(value, entry) : formatNumber(value)}
          />
        )
      })}
      {showTotal && rows.length > 1 ? (
        <div className="mt-1.5 border-t border-line-subtle pt-1.5">
          <ChartTooltipRow name={totalLabel} value={formatValue ? formatValue(total, rows[0]) : formatNumber(total)} />
        </div>
      ) : null}
    </ChartTooltipShell>
  )
}
