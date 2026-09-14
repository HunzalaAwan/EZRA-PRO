'use client'

import * as React from 'react'
import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Hover cards are previews, not decisions — they rise a little further than a
 * popover so the lift reads as "peek" rather than "opened".
 */
const HOVER_CARD_MOTION_CSS = `
@keyframes ezra-hovercard-in{from{opacity:0;transform:scale(0.96) translate3d(0,4px,0)}to{opacity:1;transform:scale(1) translate3d(0,0,0)}}
@keyframes ezra-hovercard-out{from{opacity:1;transform:scale(1) translate3d(0,0,0)}to{opacity:0;transform:scale(0.98) translate3d(0,2px,0)}}
`

function HoverCardMotionStyles() {
  return (
    <style href="ezra-motion-hovercard" precedence="medium">
      {HOVER_CARD_MOTION_CSS}
    </style>
  )
}

/** Emits the keyframes up-front — see the note in dialog.tsx. */
function HoverCard({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Root>) {
  return (
    <HoverCardPrimitive.Root {...props}>
      <HoverCardMotionStyles />
      {children}
    </HoverCardPrimitive.Root>
  )
}

const HoverCardTrigger = HoverCardPrimitive.Trigger
const HoverCardPortal = HoverCardPrimitive.Portal

export const hoverCardContentVariants = cva(
  [
    'z-50 rounded-xl border border-line bg-surface-raised text-foreground shadow-xl outline-none',
    'max-h-[var(--radix-hover-card-content-available-height)] overflow-y-auto overflow-x-hidden',
    'origin-[var(--radix-hover-card-content-transform-origin)]',
    'data-[state=open]:animate-[ezra-hovercard-in_200ms_var(--ease-out-expo)]',
    'data-[state=closed]:animate-[ezra-hovercard-out_140ms_var(--ease-in-out-quart)]',
  ],
  {
    variants: {
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
      },
      width: {
        auto: '',
        sm: 'w-56',
        md: 'w-72',
        lg: 'w-88',
      },
    },
    defaultVariants: { padding: 'md', width: 'md' },
  },
)

export type HoverCardContentVariants = VariantProps<typeof hoverCardContentVariants>

export interface HoverCardContentProps
  extends React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>,
    HoverCardContentVariants {
  container?: React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Portal>['container']
}

const HoverCardContent = React.forwardRef<
  React.ComponentRef<typeof HoverCardPrimitive.Content>,
  HoverCardContentProps
>(function HoverCardContent(
  {
    className,
    align = 'center',
    sideOffset = 8,
    collisionPadding = 12,
    padding,
    width,
    container,
    ...props
  },
  ref,
) {
  return (
    <>
      <HoverCardMotionStyles />
      <HoverCardPrimitive.Portal container={container}>
        <HoverCardPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(hoverCardContentVariants({ padding, width }), className)}
          {...props}
        />
      </HoverCardPrimitive.Portal>
    </>
  )
})

const HoverCardArrow = React.forwardRef<
  React.ComponentRef<typeof HoverCardPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Arrow>
>(function HoverCardArrow({ className, width = 12, height = 6, ...props }, ref) {
  return (
    <HoverCardPrimitive.Arrow
      ref={ref}
      width={width}
      height={height}
      className={cn('fill-surface-raised stroke-line', className)}
      {...props}
    />
  )
})

export { HoverCard, HoverCardTrigger, HoverCardPortal, HoverCardContent, HoverCardArrow }
