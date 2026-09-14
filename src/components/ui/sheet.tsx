'use client'

import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Directional slide keyframes. Kept local to the file (see dialog.tsx for the
 * rationale) and namespaced `ezra-sheet-*` so nothing can collide with the
 * other overlay primitives.
 */
const SHEET_MOTION_CSS = `
@keyframes ezra-sheet-scrim-in{from{opacity:0}to{opacity:1}}
@keyframes ezra-sheet-scrim-out{from{opacity:1}to{opacity:0}}
@keyframes ezra-sheet-in-right{from{opacity:.5;transform:translate3d(100%,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes ezra-sheet-out-right{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:0;transform:translate3d(100%,0,0)}}
@keyframes ezra-sheet-in-left{from{opacity:.5;transform:translate3d(-100%,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes ezra-sheet-out-left{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:0;transform:translate3d(-100%,0,0)}}
@keyframes ezra-sheet-in-top{from{opacity:.5;transform:translate3d(0,-100%,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes ezra-sheet-out-top{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:0;transform:translate3d(0,-100%,0)}}
@keyframes ezra-sheet-in-bottom{from{opacity:.5;transform:translate3d(0,100%,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes ezra-sheet-out-bottom{from{opacity:1;transform:translate3d(0,0,0)}to{opacity:0;transform:translate3d(0,100%,0)}}
`

function SheetMotionStyles() {
  return (
    <style href="ezra-motion-sheet" precedence="medium">
      {SHEET_MOTION_CSS}
    </style>
  )
}

/* ==========================================================================
   ROOT PARTS
   ========================================================================== */

/** Emits the keyframes up-front — see the note in dialog.tsx. */
function Sheet({ children, ...props }: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Root>) {
  return (
    <SheetPrimitive.Root {...props}>
      <SheetMotionStyles />
      {children}
    </SheetPrimitive.Root>
  )
}

const SheetTrigger = SheetPrimitive.Trigger
const SheetPortal = SheetPrimitive.Portal
const SheetClose = SheetPrimitive.Close

const SheetOverlay = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(function SheetOverlay({ className, ...props }, ref) {
  return (
    <SheetPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-overlay backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-md',
        'data-[state=open]:animate-[ezra-sheet-scrim-in_240ms_var(--ease-out-quint)]',
        'data-[state=closed]:animate-[ezra-sheet-scrim-out_180ms_var(--ease-in-out-quart)]',
        className,
      )}
      {...props}
    />
  )
})

/* ==========================================================================
   CONTENT
   `size` means width on left/right panels and height on top/bottom panels,
   which is why the dimensions live in compoundVariants.
   ========================================================================== */

export const sheetContentVariants = cva(
  [
    'fixed z-50 flex flex-col bg-surface-raised text-foreground shadow-2xl',
    'outline-none focus-visible:outline-none',
  ],
  {
    variants: {
      side: {
        right: [
          'inset-y-0 right-0 h-dvh w-full border-l border-line rounded-l-2xl',
          'data-[state=open]:animate-[ezra-sheet-in-right_380ms_var(--ease-out-expo)]',
          'data-[state=closed]:animate-[ezra-sheet-out-right_240ms_var(--ease-in-out-quart)]',
        ],
        left: [
          'inset-y-0 left-0 h-dvh w-full border-r border-line rounded-r-2xl',
          'data-[state=open]:animate-[ezra-sheet-in-left_380ms_var(--ease-out-expo)]',
          'data-[state=closed]:animate-[ezra-sheet-out-left_240ms_var(--ease-in-out-quart)]',
        ],
        top: [
          'inset-x-0 top-0 w-full border-b border-line rounded-b-2xl',
          'data-[state=open]:animate-[ezra-sheet-in-top_360ms_var(--ease-out-expo)]',
          'data-[state=closed]:animate-[ezra-sheet-out-top_230ms_var(--ease-in-out-quart)]',
        ],
        bottom: [
          'inset-x-0 bottom-0 w-full border-t border-line rounded-t-2xl',
          'data-[state=open]:animate-[ezra-sheet-in-bottom_360ms_var(--ease-out-expo)]',
          'data-[state=closed]:animate-[ezra-sheet-out-bottom_230ms_var(--ease-in-out-quart)]',
        ],
      },
      size: {
        sm: '',
        md: '',
        lg: '',
        xl: '',
        full: '',
      },
    },
    compoundVariants: [
      { side: ['left', 'right'], size: 'sm', class: 'sm:max-w-sm' },
      { side: ['left', 'right'], size: 'md', class: 'sm:max-w-md' },
      { side: ['left', 'right'], size: 'lg', class: 'sm:max-w-xl' },
      { side: ['left', 'right'], size: 'xl', class: 'sm:max-w-3xl' },
      { side: ['left', 'right'], size: 'full', class: 'sm:max-w-none rounded-none' },
      { side: ['top', 'bottom'], size: 'sm', class: 'max-h-[32dvh]' },
      { side: ['top', 'bottom'], size: 'md', class: 'max-h-[52dvh]' },
      { side: ['top', 'bottom'], size: 'lg', class: 'max-h-[72dvh]' },
      { side: ['top', 'bottom'], size: 'xl', class: 'max-h-[88dvh]' },
      { side: ['top', 'bottom'], size: 'full', class: 'h-dvh max-h-none rounded-none' },
    ],
    defaultVariants: { side: 'right', size: 'md' },
  },
)

export type SheetContentVariants = VariantProps<typeof sheetContentVariants>

export interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    SheetContentVariants {
  showCloseButton?: boolean
  overlayClassName?: string
  container?: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Portal>['container']
}

const SheetContent = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(function SheetContent(
  {
    className,
    children,
    side = 'right',
    size,
    showCloseButton = true,
    overlayClassName,
    container,
    ...props
  },
  ref,
) {
  return (
    <SheetPortal container={container}>
      <SheetMotionStyles />
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        ref={ref}
        className={cn(sheetContentVariants({ side, size }), className)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close
            aria-label="Close panel"
            className={cn(
              'absolute right-3.5 top-3.5 z-20 inline-flex size-8 items-center justify-center rounded-lg',
              'text-subtle transition-all duration-200 ease-[var(--ease-out-expo)]',
              'hover:bg-surface-sunken hover:text-foreground active:scale-[0.92]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})

/* ==========================================================================
   LAYOUT SLOTS
   The booking-detail and filter panels are long, so the header/footer are both
   flex-pinned *and* `sticky` — the latter keeps them in place if a consumer
   nests them inside their own scroll container instead of using SheetBody.
   ========================================================================== */

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex shrink-0 flex-col gap-1 border-b border-line-subtle',
        'bg-surface-raised/85 px-6 py-4 pr-14 backdrop-blur-md',
        className,
      )}
      {...props}
    />
  )
}

function SheetBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-5', className)} {...props} />
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 flex shrink-0 flex-col-reverse gap-2 border-t border-line-subtle',
        'bg-surface-raised/85 px-6 py-4 backdrop-blur-md sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}

const SheetTitle = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(function SheetTitle({ className, ...props }, ref) {
  return (
    <SheetPrimitive.Title
      ref={ref}
      className={cn('font-display text-base font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  )
})

const SheetDescription = React.forwardRef<
  React.ComponentRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(function SheetDescription({ className, ...props }, ref) {
  return (
    <SheetPrimitive.Description
      ref={ref}
      className={cn('text-sm leading-relaxed text-muted', className)}
      {...props}
    />
  )
})

export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetClose,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
