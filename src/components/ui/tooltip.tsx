'use client'

import * as React from 'react'
import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * Tooltips are the fastest surface in the system — they appear on the way to
 * something else, so the entrance is short and travels only a few pixels.
 */
const TOOLTIP_MOTION_CSS = `
@keyframes ezra-tooltip-in{from{opacity:0;transform:scale(0.96) translate3d(0,3px,0)}to{opacity:1;transform:scale(1) translate3d(0,0,0)}}
@keyframes ezra-tooltip-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.98)}}
`

function TooltipMotionStyles() {
  return (
    <style href="ezra-motion-tooltip" precedence="medium">
      {TOOLTIP_MOTION_CSS}
    </style>
  )
}

const TooltipProvider = TooltipPrimitive.Provider

/** Emits the keyframes up-front — see the note in dialog.tsx. */
function Tooltip({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipPrimitive.Root {...props}>
      <TooltipMotionStyles />
      {children}
    </TooltipPrimitive.Root>
  )
}

const TooltipTrigger = TooltipPrimitive.Trigger
const TooltipPortal = TooltipPrimitive.Portal

export const tooltipContentVariants = cva(
  [
    'z-50 max-w-64 rounded-lg px-2.5 py-1.5 text-xs font-medium leading-snug shadow-lg',
    'origin-[var(--radix-tooltip-content-transform-origin)]',
    'data-[state=delayed-open]:animate-[ezra-tooltip-in_150ms_var(--ease-out-expo)]',
    'data-[state=instant-open]:animate-[ezra-tooltip-in_100ms_var(--ease-out-expo)]',
    'data-[state=closed]:animate-[ezra-tooltip-out_110ms_var(--ease-in-out-quart)]',
  ],
  {
    variants: {
      tone: {
        /** Default chip: inverts against the page in both themes. */
        inverse: 'bg-foreground text-background',
        surface: 'border border-line bg-surface-raised text-foreground',
        primary: 'bg-primary text-on-primary',
        danger: 'bg-danger text-background',
      },
    },
    defaultVariants: { tone: 'inverse' },
  },
)

export type TooltipContentVariants = VariantProps<typeof tooltipContentVariants>

/** The arrow is a separate SVG, so its fill has to track the bubble tone. */
const TOOLTIP_ARROW_FILL: Record<NonNullable<TooltipContentVariants['tone']>, string> = {
  inverse: 'fill-foreground',
  surface: 'fill-surface-raised stroke-line',
  primary: 'fill-primary',
  danger: 'fill-danger',
}

export interface TooltipContentProps
  extends React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>,
    TooltipContentVariants {
  /** Render the pointer triangle. Off by default — most chips read cleaner without it. */
  showArrow?: boolean
  container?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Portal>['container']
}

const TooltipContent = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(function TooltipContent(
  {
    className,
    children,
    sideOffset = 6,
    collisionPadding = 10,
    tone = 'inverse',
    showArrow = false,
    container,
    ...props
  },
  ref,
) {
  return (
    <>
      <TooltipMotionStyles />
      <TooltipPrimitive.Portal container={container}>
        <TooltipPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(tooltipContentVariants({ tone }), className)}
          {...props}
        >
          {children}
          {showArrow ? (
            <TooltipPrimitive.Arrow
              width={11}
              height={5}
              className={TOOLTIP_ARROW_FILL[tone ?? 'inverse']}
            />
          ) : null}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </>
  )
})

const TooltipArrow = React.forwardRef<
  React.ComponentRef<typeof TooltipPrimitive.Arrow>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Arrow>
>(function TooltipArrow({ className, width = 11, height = 5, ...props }, ref) {
  return (
    <TooltipPrimitive.Arrow
      ref={ref}
      width={width}
      height={height}
      className={cn('fill-foreground', className)}
      {...props}
    />
  )
})

export interface SimpleTooltipProps extends TooltipContentVariants {
  /** Tooltip body. Falsy content renders the trigger untouched. */
  label: React.ReactNode
  children: React.ReactNode
  side?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['side']
  align?: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>['align']
  sideOffset?: number
  delayDuration?: number
  showArrow?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  contentClassName?: string
  /**
   * Mount a local `TooltipProvider`. Leave on unless the tree already has a
   * global provider and you want tooltips to share its skip-delay group.
   */
  provider?: boolean
}

/**
 * One-liner tooltip for the 90% case: `<SimpleTooltip label="Refund"><IconButton/></SimpleTooltip>`.
 * The trigger is `asChild`, so the child keeps its own semantics and focus ring.
 */
function SimpleTooltip({
  label,
  children,
  side = 'top',
  align = 'center',
  sideOffset,
  delayDuration = 250,
  showArrow,
  tone,
  open,
  onOpenChange,
  contentClassName,
  provider = true,
}: SimpleTooltipProps) {
  if (!label) return <>{children}</>

  const tooltip = (
    <Tooltip open={open} onOpenChange={onOpenChange} delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        tone={tone}
        showArrow={showArrow}
        className={contentClassName}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )

  return provider ? (
    <TooltipProvider delayDuration={delayDuration}>{tooltip}</TooltipProvider>
  ) : (
    tooltip
  )
}

export {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipPortal,
  TooltipContent,
  TooltipArrow,
  SimpleTooltip,
}
