'use client'

import type { ReactNode } from 'react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'

export interface MarqueeProps {
  children: ReactNode
  /** Seconds for one complete loop — higher is slower. */
  speed?: number
  direction?: 'left' | 'right'
  /** Freeze the belt while the pointer is over it. */
  pauseOnHover?: boolean
  /** Soften both edges with the `mask-fade-x` utility. */
  fade?: boolean
  /** Space between items, in px. Also the seam between the two copies. */
  gap?: number
  className?: string
}

/**
 * Seamless infinite belt — logos, testimonials, activity chips.
 *
 * The children are rendered twice inside a single track. Each copy carries a
 * trailing gap equal to the inner gap, which makes the copy width exactly half
 * the track; the shared `marquee` keyframe (0 → -50%) therefore loops with no
 * visible seam, whatever the content measures.
 *
 * Under reduced motion the belt becomes a plain scrollable row: same content,
 * no perpetual movement.
 */
export function Marquee({
  children,
  speed = 32,
  direction = 'left',
  pauseOnHover = true,
  fade = true,
  gap = 40,
  className,
}: MarqueeProps) {
  const reducedMotion = useReducedMotionSafe()

  const copyStyle = { gap: `${gap}px`, paddingInlineEnd: `${gap}px` }

  if (reducedMotion) {
    return (
      <div className={cn('no-scrollbar w-full overflow-x-auto', fade && 'mask-fade-x', className)}>
        <div className="flex w-max items-center" style={copyStyle}>
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('group relative flex w-full overflow-hidden', fade && 'mask-fade-x', className)}>
      <div
        className={cn(
          'flex w-max gpu',
          direction === 'left' ? 'animate-marquee' : 'animate-marquee-reverse',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{ animationDuration: `${speed}s` }}
      >
        <div className="flex shrink-0 items-center" style={copyStyle}>
          {children}
        </div>
        {/* Duplicate for the seamless loop — hidden from assistive tech so the
            content is not announced twice. */}
        <div aria-hidden="true" className="flex shrink-0 items-center" style={copyStyle}>
          {children}
        </div>
      </div>
    </div>
  )
}
