'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/** Scales from Radix's resolved transform origin — see dropdown-menu.tsx. */
const POPOVER_MOTION_CSS = `
@keyframes ezra-popover-in{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
@keyframes ezra-popover-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.97)}}
`

function PopoverMotionStyles() {
  return (
    <style href="ezra-motion-popover" precedence="medium">
      {POPOVER_MOTION_CSS}
    </style>
  )
}

/** Emits the keyframes up-front — see the note in dialog.tsx. */
function Popover({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Root>) {
  return (
    <PopoverPrimitive.Root {...props}>
      <PopoverMotionStyles />
      {children}
    </PopoverPrimitive.Root>
  )
}

const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverAnchor = PopoverPrimitive.Anchor
const PopoverPortal = PopoverPrimitive.Portal
const PopoverClose = PopoverPrimitive.Close

export const popoverContentVariants = cva(
  [
    'z-50 rounded-xl border border-line bg-surface-raised text-foreground shadow-xl outline-none',
    'max-h-[var(--radix-popover-content-available-height)] overflow-y-auto overflow-x-hidden',
    'origin-[var(--radix-popover-content-transform-origin)]',
    'data-[state=open]:animate-[ezra-popover-in_190ms_var(--ease-out-expo)]',
    'data-[state=closed]:animate-[ezra-popover-out_130ms_var(--ease-in-out-quart)]',
  ],
  {
    variants: {
      /** `none` is for popovers that host their own padded sections (pickers, menus). */
      padding: {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5',
      },
      width: {
        auto: '',
        trigger: 'w-[var(--radix-popover-trigger-width)]',
        sm: 'w-60',
        md: 'w-72',
        lg: 'w-96',
      },
    },
    defaultVariants: { padding: 'md', width: 'md' },
  },
)

export type PopoverContentVariants = VariantProps<typeof popoverContentVariants>

export interface PopoverContentProps
  extends React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>,
    PopoverContentVariants {
  container?: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Portal>['container']
}

const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(function PopoverContent(
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
      <PopoverMotionStyles />
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content
          ref={ref}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(popoverContentVariants({ padding, width }), className)}
          {...props}
        />
      </PopoverPrimitive.Portal>
    </>
  )
})

const PopoverArrow = React.forwardRef<
  React.ComponentRef<typeof PopoverPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Arrow>
>(function PopoverArrow({ className, width = 12, height = 6, ...props }, ref) {
  return (
    <PopoverPrimitive.Arrow
      ref={ref}
      width={width}
      height={height}
      className={cn('fill-surface-raised stroke-line', className)}
      {...props}
    />
  )
})

export {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverPortal,
  PopoverClose,
  PopoverContent,
  PopoverArrow,
}
