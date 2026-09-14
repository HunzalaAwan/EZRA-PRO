'use client'

import * as React from 'react'
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'

import { cn } from '@/lib/utils'

/**
 * Same mechanic as accordion.tsx: Radix publishes the measured height as
 * `--radix-collapsible-content-height` but ships no keyframes, and Presence
 * needs a real CSS animation to hold the element through the close.
 */
const COLLAPSIBLE_MOTION_CSS = `
@keyframes ezra-collapsible-down{
  from{height:0;opacity:0}
  to{height:var(--radix-collapsible-content-height);opacity:1}
}
@keyframes ezra-collapsible-up{
  from{height:var(--radix-collapsible-content-height);opacity:1}
  to{height:0;opacity:0}
}
`

function CollapsibleMotionStyles() {
  return (
    <style href="ezra-motion-collapsible" precedence="medium">
      {COLLAPSIBLE_MOTION_CSS}
    </style>
  )
}

const Collapsible = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Root>
>(function Collapsible({ className, children, ...props }, ref) {
  return (
    <CollapsiblePrimitive.Root ref={ref} className={className} {...props}>
      <CollapsibleMotionStyles />
      {children}
    </CollapsiblePrimitive.Root>
  )
})

const CollapsibleTrigger = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Trigger>
>(function CollapsibleTrigger({ className, ...props }, ref) {
  return (
    <CollapsiblePrimitive.Trigger
      ref={ref}
      className={cn(
        'group inline-flex items-center gap-1.5 text-sm font-medium text-muted',
        'transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-foreground',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:pointer-events-none disabled:opacity-45',
        className,
      )}
      {...props}
    />
  )
})

export interface CollapsibleContentProps
  extends React.ComponentPropsWithoutRef<typeof CollapsiblePrimitive.Content> {
  /**
   * Class for the animated element itself. Mirrors AccordionContent: the
   * animated box is measured by Radix, so spacing belongs on the inner wrapper
   * that `className` targets.
   */
  contentClassName?: string
}

const CollapsibleContent = React.forwardRef<
  React.ComponentRef<typeof CollapsiblePrimitive.Content>,
  CollapsibleContentProps
>(function CollapsibleContent({ className, contentClassName, children, ...props }, ref) {
  return (
    <CollapsiblePrimitive.Content
      ref={ref}
      className={cn(
        'overflow-hidden',
        'data-[state=open]:animate-[ezra-collapsible-down_280ms_var(--ease-out-expo)]',
        'data-[state=closed]:animate-[ezra-collapsible-up_200ms_var(--ease-in-out-quart)]',
        contentClassName,
      )}
      {...props}
    >
      <div className={className}>{children}</div>
    </CollapsiblePrimitive.Content>
  )
})

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
