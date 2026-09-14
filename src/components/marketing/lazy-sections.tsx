'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'

/**
 * Below-the-fold landing sections, loaded only when the reader gets near them.
 *
 * `ProductShowcase` (~1,100 lines of scroll-driven motion) and
 * `AnalyticsShowcase` (which pulls in Recharts) together outweigh the rest of
 * the landing page's JavaScript. Both sit several screens down, so they are:
 *
 *   1. split into their own chunks with `next/dynamic` (`ssr: false`, so the
 *      chunk isn't on the hydration critical path either), and
 *   2. gated behind an IntersectionObserver with a generous root margin, so
 *      the chunk is requested ~2 screens before it scrolls into view — in
 *      practice it has arrived by the time the section is visible.
 *
 * The placeholders reserve roughly the section's height so nothing above the
 * fold ever shifts; they are well below the initial viewport, so any residual
 * difference never registers as layout shift for the reader.
 */

import { ProductShowcase } from './product-showcase'
import { AnalyticsShowcase } from './analytics-showcase'

function useNearViewport<T extends Element>(rootMargin: string) {
  const ref = React.useRef<T>(null)
  const [near, setNear] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node || near) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [near, rootMargin])

  return { ref, near }
}

export function LazyProductShowcase({ className }: { className?: string }) {
  return <ProductShowcase className={className} />
}

export function LazyAnalyticsShowcase({ className }: { className?: string }) {
  return <AnalyticsShowcase className={className} />
}
