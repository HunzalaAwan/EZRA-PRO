'use client'

import type { ReactNode } from 'react'
import { motion, useMotionTemplate, useSpring, useTransform } from 'motion/react'
import { useIsFinePointer } from '@/hooks/use-media-query'
import { useMousePosition } from '@/hooks/use-mouse-position'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { DURATION, EASE_OUT_QUINT, SPRING_SOFT } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface TiltCardProps {
  children: ReactNode
  /** Maximum rotation in degrees on each axis. */
  maxTilt?: number
  /** Scale while hovered. Set to 1 to disable. */
  hoverScale?: number
  /** Perspective depth in px — lower is more dramatic. */
  perspective?: number
  /** Render the moving specular highlight. */
  glare?: boolean
  /** Peak opacity of the glare, 0…1. */
  glareOpacity?: number
  /** Class for the outer perspective box (layout, sizing). */
  className?: string
  /** Class for the tilting surface (background, border, radius). */
  innerClassName?: string
}

/**
 * A card that leans with the pointer in 3D, with an optional glare sweep.
 *
 * Rotation is spring-smoothed rather than tracking the pointer 1:1 — raw
 * values feel twitchy and cheap. Everything is transform/opacity, so the
 * card composites on the GPU.
 */
export function TiltCard({
  children,
  maxTilt = 9,
  hoverScale = 1.015,
  perspective = 1000,
  glare = true,
  glareOpacity = 0.22,
  className,
  innerClassName,
}: TiltCardProps) {
  const reducedMotion = useReducedMotionSafe()
  const isFinePointer = useIsFinePointer()
  const enabled = isFinePointer && !reducedMotion

  const { ref, xPercent, yPercent, xRatio, yRatio, isHovered } = useMousePosition<HTMLDivElement>({
    enabled,
  })

  // Pointer below centre lifts the bottom edge toward the viewer, and vice
  // versa — the surface tilts *with* the cursor rather than away from it.
  const rotateX = useSpring(useTransform(yPercent, [-0.5, 0.5], [-maxTilt, maxTilt]), SPRING_SOFT)
  const rotateY = useSpring(useTransform(xPercent, [-0.5, 0.5], [maxTilt, -maxTilt]), SPRING_SOFT)

  // The glare is a static gradient that is *translated*, never repainted.
  const glareOffsetX = useSpring(useTransform(xRatio, [0, 1], [-32, 32]), SPRING_SOFT)
  const glareOffsetY = useSpring(useTransform(yRatio, [0, 1], [-32, 32]), SPRING_SOFT)
  const glareX = useMotionTemplate`${glareOffsetX}%`
  const glareY = useMotionTemplate`${glareOffsetY}%`

  if (!enabled) {
    return (
      <div className={className}>
        <div className={innerClassName}>{children}</div>
      </div>
    )
  }

  return (
    <div ref={ref} className={cn('gpu', className)} style={{ perspective: `${perspective}px` }}>
      <motion.div
        className={cn('relative h-full preserve-3d', innerClassName)}
        style={{ rotateX, rotateY }}
        whileHover={{ scale: hoverScale }}
        transition={{ duration: DURATION.quick, ease: EASE_OUT_QUINT }}
      >
        {children}

        {glare ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
          >
            <motion.div
              className="absolute -inset-1/3"
              style={{
                x: glareX,
                y: glareY,
                background:
                  'radial-gradient(circle at center, color-mix(in oklab, var(--color-lagoon-100) 70%, transparent) 0%, transparent 62%)',
              }}
              animate={{ opacity: isHovered ? glareOpacity : 0 }}
              transition={{ duration: DURATION.quick, ease: EASE_OUT_QUINT }}
            />
          </div>
        ) : null}
      </motion.div>
    </div>
  )
}
