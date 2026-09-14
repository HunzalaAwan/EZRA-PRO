'use client'

import { useEffect, useState } from 'react'
import { useReducedMotion } from 'motion/react'

/** True once the client has hydrated. Always false during SSR. */
export function useIsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}

/**
 * `useReducedMotion()` resolves to `null` on the server but to a real boolean
 * on the client's very first render — branching on it directly therefore
 * produces different markup on each side and React complains.
 *
 * This wrapper reports "motion is fine" until hydration has completed, then
 * tells the truth. Every EZRA motion component reads the preference through
 * here so the answer is consistent across the tree.
 *
 * @returns true when the user has asked for reduced motion.
 */
export function useReducedMotionSafe(): boolean {
  const prefersReduced = useReducedMotion()
  const hydrated = useIsHydrated()
  return hydrated && prefersReduced === true
}
