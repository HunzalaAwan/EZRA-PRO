'use client'

/**
 * Inline trend line. Deliberately Recharts-free: KPI rows render dozens of these
 * at once, and a single memoised <svg> with two paths is an order of magnitude
 * cheaper than a chart instance per tile.
 */

import { memo, useId, useMemo } from 'react'
import { cn, sparklinePath } from '@/lib/utils'

export interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  /** Any CSS colour — pass a `var(--chart-N)` token. */
  color?: string
  /** Adds a soft gradient area under the line. */
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
  color = 'var(--chart-1)',
  fill = false,
  showLastDot = false,
  strokeWidth = 1.5,
  className,
  ariaLabel,
}: SparklineProps) {
  const gradientId = `ezra-spark-${useId().replace(/:/g, '')}`

  const geometry = useMemo(() => {
    if (values.length === 0) return null

    // Inset by the stroke width so the line never clips at the edges.
    const pad = strokeWidth
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
      {fill ? (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
      ) : null}

      {fill && !geometry.single ? <path d={geometry.area} fill={`url(#${gradientId})`} /> : null}

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
        <circle cx={geometry.lastX} cy={geometry.lastY} r={strokeWidth + 0.6} fill={color} />
      ) : null}
    </svg>
  )
})
