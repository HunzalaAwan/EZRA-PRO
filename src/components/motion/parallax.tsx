'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useScroll, useSpring, useTransform, type UseScrollOptions } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { SPRING_SOFT } from '@/lib/motion'
import { cn } from '@/lib/utils'

const DEFAULT_PARALLAX_OFFSET: UseScrollOptions['offset'] = ['start end', 'end start']

export interface ParallaxProps {
  children: ReactNode
  /**
   * Travel factor. Positive drifts against the scroll (the layer appears
   * further away), negative drifts with it. Roughly -1…1.
   */
  speed?: number
  /** Total travel in px at |speed| = 1. */
  distance?: number
  axis?: 'y' | 'x'
  /** Scroll window the movement is mapped across. */
  offset?: UseScrollOptions['offset']
  /** Smooth the scroll-linked value. Turn off for a 1:1 lock to the scrollbar. */
  smooth?: boolean
  className?: string
}

/**
 * Moves a layer as it passes through the viewport. Stack two or three at
 * different speeds behind a hero for depth.
 *
 * The element must have room to travel (a parent with `overflow-hidden` and
 * some slack) or the movement will show as clipping.
 */
export function Parallax({
  children,
  speed = 0.3,
  distance = 160,
  axis = 'y',
  offset = DEFAULT_PARALLAX_OFFSET,
  smooth = true,
  className,
}: ParallaxProps) {
  const reducedMotion = useReducedMotionSafe()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset })

  const travel = distance * speed
  const raw = useTransform(scrollYProgress, [0, 1], [travel, -travel])
  const smoothed = useSpring(raw, SPRING_SOFT)
  const value = smooth ? smoothed : raw

  if (reducedMotion) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      ref={ref}
      className={cn('gpu', className)}
      style={axis === 'y' ? { y: value } : { x: value }}
    >
      {children}
    </motion.div>
  )
}
