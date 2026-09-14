'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useSpring } from 'motion/react'
import { useIsFinePointer } from '@/hooks/use-media-query'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { SPRING_SNAPPY } from '@/lib/motion'
import { clamp, cn } from '@/lib/utils'

export interface MagneticProps {
  children: ReactNode
  /** How hard the element is pulled, 0…1. */
  strength?: number
  /** Radius in px beyond the element's own box where the pull begins. */
  radius?: number
  /** Hard cap on travel, in px — keeps buttons from drifting off their row. */
  maxDisplacement?: number
  className?: string
}

/**
 * Pulls its child toward the cursor as the cursor approaches, then springs it
 * home. Used on primary CTAs and nav affordances.
 *
 * Only runs for fine pointers with motion enabled; on touch (and under
 * `prefers-reduced-motion`) it renders an ordinary wrapper with no listeners.
 */
export function Magnetic({
  children,
  strength = 0.35,
  radius = 90,
  maxDisplacement = 26,
  className,
}: MagneticProps) {
  const reducedMotion = useReducedMotionSafe()
  const isFinePointer = useIsFinePointer()
  const enabled = isFinePointer && !reducedMotion

  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springX = useSpring(x, SPRING_SNAPPY)
  const springY = useSpring(y, SPRING_SNAPPY)

  useEffect(() => {
    const element = ref.current
    if (!enabled || !element) return

    // The pull field is global (it must react before the pointer arrives), so
    // the box is cached and only re-measured on scroll/resize — never per frame.
    let rect = element.getBoundingClientRect()
    let frame = 0
    let pointerX = 0
    let pointerY = 0

    const measure = () => {
      rect = element.getBoundingClientRect()
    }

    const release = () => {
      x.set(0)
      y.set(0)
    }

    const update = () => {
      frame = 0
      if (rect.width === 0 && rect.height === 0) return
      const centreX = rect.left + rect.width / 2
      const centreY = rect.top + rect.height / 2
      const deltaX = pointerX - centreX
      const deltaY = pointerY - centreY
      const reach = radius + Math.max(rect.width, rect.height) / 2
      const distance = Math.hypot(deltaX, deltaY)

      if (distance > reach) {
        release()
        return
      }

      // Linear falloff: full strength at the centre, nothing at the edge of
      // the field, so the element never snaps as the cursor crosses in.
      const falloff = 1 - distance / reach
      const pull = strength * falloff
      x.set(clamp(deltaX * pull, -maxDisplacement, maxDisplacement))
      y.set(clamp(deltaY * pull, -maxDisplacement, maxDisplacement))
    }

    const handleMove = (event: PointerEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      if (frame === 0) frame = window.requestAnimationFrame(update)
    }

    window.addEventListener('pointermove', handleMove, { passive: true })
    window.addEventListener('scroll', measure, { passive: true, capture: true })
    window.addEventListener('resize', measure)
    window.addEventListener('blur', release)

    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
      window.removeEventListener('blur', release)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      release()
    }
  }, [enabled, maxDisplacement, radius, strength, x, y])

  if (!enabled) {
    return <div className={cn('inline-block', className)}>{children}</div>
  }

  return (
    <motion.div ref={ref} className={cn('inline-block', className)} style={{ x: springX, y: springY }}>
      {children}
    </motion.div>
  )
}
