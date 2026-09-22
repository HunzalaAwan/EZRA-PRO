'use client'

/**
 * Capacity gauge. A 270-degree arc swept with stroke-dashoffset, coloured by
 * threshold — with the threshold also spelled out in words underneath, because
 * colour on its own is not an accessible signal. The unfilled track is a
 * lighter step of the same hue, so state reads across the whole arc.
 */

import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn, clamp, formatPercent } from '@/lib/utils'

/** `--ease-out-expo`, in the tuple shape motion expects. */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

const START_ANGLE = 135
const SWEEP = 270

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + radius * Math.cos(radians), y: cy + radius * Math.sin(radians) }
}

function arcPath(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarPoint(cx, cy, radius, startAngle)
  const end = polarPoint(cx, cy, radius, endAngle)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x.toFixed(
    2,
  )} ${end.y.toFixed(2)}`
}

export interface GaugeThresholds {
  /** At or above this, the gauge reads as "steady". */
  warning: number
  /** At or above this, the gauge reads as "strong". */
  good: number
}

const DEFAULT_THRESHOLDS: GaugeThresholds = { warning: 55, good: 78 }

type GaugeStatus = 'soft' | 'steady' | 'strong'

const STATUS_COLOR: Record<GaugeStatus, string> = {
  soft: 'var(--danger)',
  steady: 'var(--warning)',
  strong: 'var(--success)',
}

const STATUS_LABEL: Record<GaugeStatus, string> = {
  soft: 'Under-filled',
  steady: 'Healthy',
  strong: 'Near capacity',
}

export interface RadialGaugeProps {
  /** 0-100. Values outside the range are clamped. */
  value: number
  size?: number
  thickness?: number
  /** Caption under the number. Defaults to the threshold status. */
  label?: string
  /** Smaller line under the label. */
  sublabel?: string
  thresholds?: GaugeThresholds
  /** Tick marks at 0, 25, 50, 75 and 100. */
  showTicks?: boolean
  /** Suffix after the value. */
  unit?: string
  className?: string
  ariaLabel?: string
}

export function RadialGauge({
  value,
  size = 152,
  thickness = 11,
  label,
  sublabel,
  thresholds = DEFAULT_THRESHOLDS,
  showTicks = true,
  unit = '%',
  className,
  ariaLabel,
}: RadialGaugeProps) {
  const reduced = useReducedMotionSafe()

  const pct = clamp(value, 0, 100)
  const status: GaugeStatus = pct >= thresholds.good ? 'strong' : pct >= thresholds.warning ? 'steady' : 'soft'
  const color = STATUS_COLOR[status]
  const statusLabel = label ?? STATUS_LABEL[status]

  const center = size / 2
  const radius = center - thickness / 2 - 2
  const track = arcPath(center, center, radius, START_ANGLE, START_ANGLE + SWEEP)
  // Dash the full arc length, then reveal it by pulling the offset back to zero.
  const arcLength = 2 * Math.PI * radius * (SWEEP / 360)
  const offset = arcLength * (1 - pct / 100)

  return (
    <div
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? `${statusLabel}: ${formatPercent(pct)} of capacity`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" aria-hidden="true">
        {/* Track: a light step of the fill hue, so the whole arc reads as one meter. */}
        <path
          d={track}
          stroke={color}
          strokeOpacity={0.16}
          strokeWidth={thickness}
          strokeLinecap="round"
        />

        {showTicks
          ? [0, 25, 50, 75, 100].map((tick) => {
              const angle = START_ANGLE + (tick / 100) * SWEEP
              const inner = polarPoint(center, center, radius - thickness / 2 - 5, angle)
              const outer = polarPoint(center, center, radius - thickness / 2 - 1.5, angle)
              return (
                <line
                  key={tick}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="var(--border-strong)"
                  strokeWidth={1}
                  strokeLinecap="round"
                />
              )
            })
          : null}

        <motion.path
          d={track}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={arcLength}
          initial={reduced ? false : { strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: offset }}
          transition={reduced ? { duration: 0 } : { duration: 1.05, ease: EASE_OUT_EXPO }}
        />
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-semibold leading-none text-foreground">
          {Math.round(pct)}
          <span className="text-base font-medium text-subtle">{unit}</span>
        </span>
        <span className="mt-1.5 max-w-[70%] truncate text-xs font-medium" style={{ color }}>
          {statusLabel}
        </span>
        {sublabel ? <span className="mt-0.5 max-w-[80%] truncate text-xs text-subtle">{sublabel}</span> : null}
      </div>
    </div>
  )
}
