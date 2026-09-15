'use client'

/**
 * Inline trend line. Deliberately Recharts-free: KPI rows render dozens of these
 * at once, and a single memoised <svg> with two paths is an order of magnitude
 * cheaper than a chart instance per tile.
 *
 * The area under the line is a flat wash of the series colour (no gradient),
 * and the end marker carries a surface-coloured ring so it stays legible where
 * the line doubles back on itself.
 */

import { memo, useMemo } from 'react'
import { cn, sparklinePath } from '@/lib/utils'

export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  /** Any CSS colour — pass a `var(--series-*)` or `var(--chart-N)` token. */
  color?: string
  /** Adds a flat wash under the line. */
  fill?: boolean
  /** Marks the most recent value with a dot. */
  showLastDot?: boolean
  strokeWidth?: number
  className?: string
  /**
   * Screen-reader label. Omit when the sparkline merely repeats an adjacent
   * number, and it is marked decorative instead.
   */
  ariaLabel?: string
}

export const Sparkline = memo(function Sparkline({
  values,
  width = 96,
  height = 28,
  color = 'var(--series-revenue)',
  fill = false,
  showLastDot = false,
  strokeWidth = 1.5,
  className,
  ariaLabel,
}: SparklineProps) {
  const geometry = useMemo(() => {
    if (values.length === 0) return null

    // Inset by the stroke width so the line never clips at the edges.
    const pad = strokeWidth + 2
    const line = sparklinePath(values, width, height, pad)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const span = max - min || 1
    const stepX = (width - pad * 2) / Math.max(values.length - 1, 1)
    const lastX = pad + (values.length - 1) * stepX
    const lastY = pad + (height - pad * 2) * (1 - (values[values.length - 1] - min) / span)

    return {
      line,
      area: `${line} L${lastX.toFixed(2)},${height} L${pad.toFixed(2)},${height} Z`,
      lastX,
      lastY,
      single: values.length < 2,
    }
  }, [values, width, height, strokeWidth])

  if (!geometry) return null

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={cn('overflow-visible', className)}
      {...(ariaLabel ? { role: 'img', 'aria-label': ariaLabel } : { 'aria-hidden': true })}
    >
      {fill && !geometry.single ? <path d={geometry.area} fill={color} fillOpacity={0.12} /> : null}

      {!geometry.single ? (
        <path
          d={geometry.line}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {showLastDot || geometry.single ? (
        <circle
          cx={geometry.lastX}
          cy={geometry.lastY}
          r={strokeWidth + 1.5}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={2}
        />
      ) : null}
    </svg>
  )
})
