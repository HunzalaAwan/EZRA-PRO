'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'

const BRAND_BAR =
  'linear-gradient(90deg, var(--color-lagoon-400) 0%, var(--color-coral-400) 70%, var(--color-sunset-400) 100%)'

export interface PageTransitionProps {
  children: ReactNode
  className?: string
}

/**
 * Fades route content in on every navigation.
 *
 * The pathname is used as a key, so each route mounts fresh and replays the
 * entrance. Deliberately enter-only: App Router swaps the tree as soon as the
 * new segment commits, and a wait-for-exit would only delay the paint.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname()
  const reducedMotion = useReducedMotionSafe()

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      key={pathname}
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT_EXPO }}
    >
      {children}
    </motion.div>
  )
}

export interface RouteLoadingBarProps {
  /** Bar thickness in px. */
  height?: number
  /** Any CSS background value — defaults to the brand ramp. */
  background?: string
  className?: string
}

/**
 * Thin progress bar that runs whenever the route changes.
 *
 * It creeps to ~70% while the new segment settles, snaps to full, then fades —
 * the familiar pattern that makes a navigation feel answered instantly.
 */
export function RouteLoadingBar({
  height = 2,
  background = BRAND_BAR,
  className,
}: RouteLoadingBarProps) {
  const pathname = usePathname()
  const reducedMotion = useReducedMotionSafe()
  const [phase, setPhase] = useState<'idle' | 'loading' | 'complete'>('idle')
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Never flash the bar for the initial page load.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setPhase('loading')
    const toComplete = window.setTimeout(() => setPhase('complete'), 360)
    const toIdle = window.setTimeout(() => setPhase('idle'), 900)
    return () => {
      window.clearTimeout(toComplete)
      window.clearTimeout(toIdle)
    }
  }, [pathname])

  const positionClasses = cn('pointer-events-none fixed inset-x-0 top-0 z-[60] origin-left', className)

  if (reducedMotion) {
    return phase === 'idle' ? null : (
      <div aria-hidden="true" className={positionClasses} style={{ height, background }} />
    )
  }

  return (
    <AnimatePresence>
      {phase !== 'idle' ? (
        <motion.div
          key="route-loading-bar"
          aria-hidden="true"
          className={positionClasses}
          style={{ height, background }}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: phase === 'complete' ? 1 : 0.7, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: phase === 'complete' ? DURATION.fast : DURATION.slower,
            ease: EASE_OUT_EXPO,
          }}
        />
      ) : null}
    </AnimatePresence>
  )
}
