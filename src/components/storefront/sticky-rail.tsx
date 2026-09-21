'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   <StickyRail> — a sidebar that stays useful whatever its height.

   A plain `sticky top-24` panel taller than the viewport pins its top edge
   and hides its bottom, so the button that matters (Reserve) is out of reach
   until the main column runs out. This measures the panel and the window:
   when the panel fits, it pins at `offset` from the top like any sticky
   card; when it is taller, it pins its *bottom* edge to the viewport bottom
   instead, so the total and the call to action are always in view and the
   header scrolls away first. Re-measured on resize and whenever the panel
   changes height (a picked date adds a row of times, and so on).
   ========================================================================== */

export function StickyRail({
  offset = 96,
  gap = 16,
  className,
  children,
}: {
  /** Distance from the viewport top when the panel fits, in px. */
  offset?: number
  /** Breathing room below the panel when it is bottom-pinned, in px. */
  gap?: number
  className?: string
  children: React.ReactNode
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [top, setTop] = React.useState(offset)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return

    const measure = () => {
      const height = node.offsetHeight
      const viewport = window.innerHeight
      const fits = height + offset + gap <= viewport
      setTop(fits ? offset : viewport - height - gap)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [offset, gap])

  return (
    <div ref={ref} className={cn('sticky', className)} style={{ top }}>
      {children}
    </div>
  )
}
