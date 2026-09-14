'use client'

import { useEffect, useRef } from 'react'
import { animate, motion, useInView, useMotionValue, useTransform, type UseInViewOptions } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import {
  formatCompactCurrency,
  formatCurrency,
  formatNumber,
  formatPercent,
} from '@/lib/utils'
import type { CurrencyCode } from '@/types'

export type CountUpFormat = 'number' | 'compact' | 'currency' | 'currency-compact' | 'percent'

export interface CountUpProps {
  /**
   * Target value. For the currency formats this is **minor units** (cents),
   * exactly as it is stored everywhere else in EZRA.
   */
  value: number
  /** Starting value. Defaults to 0. */
  from?: number
  /** Seconds the count takes. */
  duration?: number
  /** Seconds to wait after the element enters the viewport. */
  delay?: number
  /** Decimal places for the `number` and `percent` formats. */
  decimals?: number
  prefix?: string
  suffix?: string
  format?: CountUpFormat
  currency?: CurrencyCode
  /** Count again every time the element re-enters the viewport. */
  once?: boolean
  margin?: UseInViewOptions['margin']
  className?: string
}

/**
 * Counts a number up when it scrolls into view.
 *
 * The running value lives in a motion value and is rendered as a motion child,
 * so the DOM text updates on the animation frame loop without re-rendering
 * React — a dashboard can show dozens of these without dropping frames.
 *
 * The accessible copy is the final value: assistive tech announces the number
 * the operator actually cares about, not a partial tick.
 */
export function CountUp({
  value,
  from = 0,
  duration = DURATION.slowest,
  delay = 0,
  decimals = 0,
  prefix = '',
  suffix = '',
  format = 'number',
  currency = 'USD',
  once = true,
  margin = '-60px',
  className,
}: CountUpProps) {
  const reducedMotion = useReducedMotionSafe()
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once, margin })
  const count = useMotionValue(from)

  const formatValue = (latest: number) => {
    switch (format) {
      case 'currency':
        return formatCurrency(Math.round(latest), currency, { decimals: decimals > 0 })
      case 'currency-compact':
        return formatCompactCurrency(Math.round(latest), currency)
      case 'compact':
        return formatNumber(latest, { compact: true })
      case 'percent':
        return formatPercent(latest, decimals)
      default:
        return formatNumber(latest, { decimals })
    }
  }

  const display = useTransform(count, (latest) => `${prefix}${formatValue(latest)}${suffix}`)
  const finalValue = `${prefix}${formatValue(value)}${suffix}`

  useEffect(() => {
    // Reduced motion: land on the answer immediately, viewport or not.
    if (reducedMotion) {
      count.set(value)
      return
    }
    if (!isInView) return
    const controls = animate(count, value, { duration, delay, ease: EASE_OUT_EXPO })
    return () => controls.stop()
  }, [count, delay, duration, isInView, reducedMotion, value])

  return (
    <span className={className}>
      <motion.span ref={ref} aria-hidden="true" className="tabular">
        {display}
      </motion.span>
      <span className="sr-only">{finalValue}</span>
    </span>
  )
}
