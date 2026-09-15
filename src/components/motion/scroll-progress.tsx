'use client'

import { motion, useScroll, useSpring } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { SPRING_GLIDE } from '@/lib/motion'
import { cn } from '@/lib/utils'

const BRAND_BAR = 'var(--primary)'

export interface ScrollProgressProps {
  /** Bar thickness in px. */
  height?: number
  position?: 'top' | 'bottom'
  /** Any CSS background value — defaults to the brand ramp. */
  background?: string
  className?: string
}

/**
 * Page-reading progress, pinned to the viewport edge.
 *
 * Driven by `scaleX` on a spring so it glides instead of stuttering with the
 * scroll wheel. With reduced motion it tracks the scroll position exactly —
 * still informative, but with no easing of its own.
 */
export function ScrollProgress({
  height = 2,
  position = 'top',
  background = BRAND_BAR,
  className,
}: ScrollProgressProps) {
  const reducedMotion = useReducedMotionSafe()
  const { scrollYProgress } = useScroll()
  const smoothed = useSpring(scrollYProgress, SPRING_GLIDE)

  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-50 origin-left',
        position === 'top' ? 'top-0' : 'bottom-0',
        className,
      )}
      style={{
        height,
        background,
        scaleX: reducedMotion ? scrollYProgress : smoothed,
      }}
    />
  )
}
