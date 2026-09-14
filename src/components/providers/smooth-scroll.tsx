'use client'

import * as React from 'react'
import { ReactLenis } from 'lenis/react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'

/**
 * Lenis smooth scrolling for the marketing site.
 *
 * Lenis drives the *native* window scroll (it interpolates scrollTop on a
 * RAF), so `position: sticky`, Motion's `useScroll`, anchors and the browser's
 * own back/forward restoration all keep working. It is skipped entirely under
 * `prefers-reduced-motion`: the page then scrolls exactly as the OS says it
 * should.
 *
 * Elements that scroll on their own (code blocks, horizontal strips) opt out
 * with `data-lenis-prevent`.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reduceMotion = useReducedMotionSafe()

  if (reduceMotion) return <>{children}</>

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.09,
        duration: 1.25,
        smoothWheel: true,
        wheelMultiplier: 0.95,
        touchMultiplier: 1.4,
        anchors: { offset: -108 },
      }}
    >
      {children}
    </ReactLenis>
  )
}
