'use client'

import * as React from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'

import { useIsFinePointer } from '@/hooks/use-media-query'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { SPRING_SOFT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   LeanCard — a surface that leans toward the pointer, and nothing else.

   A lighter cousin of TiltCard: no glare, no inner wrapper, so it can be the
   card itself. It rotates a few degrees in three dimensions as the pointer
   crosses it and settles back on leave. Children that should sit above the
   surface can lift with `[transform:translateZ(…)]`; the card keeps
   `preserve-3d` so the lift is real. Touch and reduced motion get a still card.
   ========================================================================== */

export interface LeanCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  children: React.ReactNode
  /** Maximum lean in degrees. */
  max?: number
  /** Scale while the pointer is over the card. */
  lift?: number
  className?: string
}

export function LeanCard({ children, max = 7, lift = 1.012, className, ...rest }: LeanCardProps) {
  const reduce = useReducedMotionSafe()
  const finePointer = useIsFinePointer()
  const active = finePointer && !reduce

  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const hover = useMotionValue(0)
  const sx = useSpring(px, SPRING_SOFT)
  const sy = useSpring(py, SPRING_SOFT)
  const sh = useSpring(hover, SPRING_SOFT)

  const rotateY = useTransform(sx, (v) => v * max * 2)
  const rotateX = useTransform(sy, (v) => v * -max * 2)
  const scale = useTransform(sh, (v) => 1 + (lift - 1) * v)

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return
    const rect = event.currentTarget.getBoundingClientRect()
    px.set((event.clientX - rect.left) / rect.width - 0.5)
    py.set((event.clientY - rect.top) / rect.height - 0.5)
    hover.set(1)
  }
  const onPointerLeave = () => {
    px.set(0)
    py.set(0)
    hover.set(0)
  }

  return (
    <motion.div
      {...(rest as React.ComponentProps<typeof motion.div>)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{ rotateX, rotateY, scale, transformPerspective: 1100, transformStyle: 'preserve-3d' }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  )
}
