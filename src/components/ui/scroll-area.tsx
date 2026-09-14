'use client'

import * as React from 'react'
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'

import { cn } from '@/lib/utils'

const ScrollBar = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(function ScrollBar({ className, orientation = 'vertical', ...props }, ref) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      ref={ref}
      orientation={orientation}
      className={cn(
        'flex touch-none select-none p-0.5 transition-colors duration-200',
        'data-[state=hidden]:opacity-0 data-[state=visible]:opacity-100',
        orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent',
        orientation === 'horizontal' && 'w-full flex-col h-2.5 border-t border-t-transparent',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        className={cn(
          'relative flex-1 rounded-full bg-line-strong',
          'transition-colors duration-200 hover:bg-faint',
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
})

export interface ScrollAreaProps
  extends React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> {
  /** Which scrollbars to mount. */
  orientation?: 'vertical' | 'horizontal' | 'both'
  /** Escape hatch for programmatic scrolling (sticky calendars, chat panes). */
  viewportRef?: React.Ref<HTMLDivElement>
  viewportClassName?: string
  /** Soften the scroll edges so clipped content reads as continuing. */
  fade?: boolean
}

const ScrollArea = React.forwardRef<
  React.ComponentRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(function ScrollArea(
  {
    className,
    children,
    orientation = 'vertical',
    viewportRef,
    viewportClassName,
    fade = false,
    type = 'hover',
    scrollHideDelay = 500,
    ...props
  },
  ref,
) {
  return (
    <ScrollAreaPrimitive.Root
      ref={ref}
      type={type}
      scrollHideDelay={scrollHideDelay}
      className={cn('relative overflow-hidden', className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        // A scroll container must be reachable by keyboard (WCAG 2.1.1) —
        // Radix does not make the viewport focusable on its own.
        tabIndex={0}
        className={cn(
          'size-full rounded-[inherit]',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          fade && (orientation === 'horizontal' ? 'mask-fade-x' : 'mask-fade-y'),
          viewportClassName,
        )}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      {orientation !== 'horizontal' ? <ScrollBar orientation="vertical" /> : null}
      {orientation !== 'vertical' ? <ScrollBar orientation="horizontal" /> : null}
      <ScrollAreaPrimitive.Corner className="bg-transparent" />
    </ScrollAreaPrimitive.Root>
  )
})

export { ScrollArea, ScrollBar }
