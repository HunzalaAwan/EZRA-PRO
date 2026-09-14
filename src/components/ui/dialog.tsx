'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Keyframes live in the component rather than globals.css so this primitive is
 * self-contained. React 19 hoists `<style href>` into <head> and de-dupes by
 * href, so rendering fifty dialogs still produces exactly one stylesheet.
 * The `prefers-reduced-motion` override in globals.css already collapses these
 * to ~0ms, so there is no per-component motion guard to write here.
 */
const DIALOG_MOTION_CSS = `
@keyframes ezra-dialog-scrim-in{from{opacity:0}to{opacity:1}}
@keyframes ezra-dialog-scrim-out{from{opacity:1}to{opacity:0}}
@keyframes ezra-dialog-in{
  0%{opacity:0;transform:translate3d(-50%,-42%,0) scale(0.94)}
  60%{opacity:1}
  100%{opacity:1;transform:translate3d(-50%,-50%,0) scale(1)}
}
@keyframes ezra-dialog-out{
  from{opacity:1;transform:translate3d(-50%,-50%,0) scale(1)}
  to{opacity:0;transform:translate3d(-50%,-47%,0) scale(0.97)}
}
`

function DialogMotionStyles() {
  return (
    <style href="ezra-motion-dialog" precedence="medium">
      {DIALOG_MOTION_CSS}
    </style>
  )
}

/* ==========================================================================
   ROOT PARTS
   ========================================================================== */

/**
 * Root also emits the stylesheet so the keyframes are already in <head> before
 * the first open — the content itself re-emits them for portals mounted without
 * a Root in the same tree.
 */
function Dialog({ children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogMotionStyles />
      {children}
    </DialogPrimitive.Root>
  )
}

const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

/* ==========================================================================
   OVERLAY
   ========================================================================== */

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(function DialogOverlay({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Overlay
      ref={ref}
      className={cn(
        'fixed inset-0 z-50 bg-overlay backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-md',
        'data-[state=open]:animate-[ezra-dialog-scrim-in_220ms_var(--ease-out-quint)]',
        'data-[state=closed]:animate-[ezra-dialog-scrim-out_160ms_var(--ease-in-out-quart)]',
        className,
      )}
      {...props}
    />
  )
})

/* ==========================================================================
   CONTENT
   ========================================================================== */

export const dialogContentVariants = cva(
  [
    'fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col',
    'w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] overflow-hidden',
    'rounded-2xl border border-line bg-surface-raised text-foreground shadow-2xl',
    'outline-none focus-visible:outline-none',
    'data-[state=open]:animate-[ezra-dialog-in_280ms_var(--ease-out-expo)]',
    'data-[state=closed]:animate-[ezra-dialog-out_170ms_var(--ease-in-out-quart)]',
  ],
  {
    variants: {
      size: {
        sm: 'sm:w-full sm:max-w-sm',
        md: 'sm:w-full sm:max-w-lg',
        lg: 'sm:w-full sm:max-w-2xl',
        xl: 'sm:w-full sm:max-w-4xl',
        full: 'h-[calc(100dvh-2rem)] sm:w-full sm:max-w-[min(80rem,calc(100vw-3rem))]',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type DialogContentVariants = VariantProps<typeof dialogContentVariants>

export interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
    DialogContentVariants {
  /** Render the built-in top-right close affordance. */
  showCloseButton?: boolean
  /** Escape hatch for tinting or removing the scrim. */
  overlayClassName?: string
  /** Portal target — useful inside fullscreen or shadow-root embeds. */
  container?: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>['container']
}

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(function DialogContent(
  { className, children, size, showCloseButton = true, overlayClassName, container, ...props },
  ref,
) {
  return (
    <DialogPortal container={container}>
      <DialogMotionStyles />
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(dialogContentVariants({ size }), className)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className={cn(
              'absolute right-3.5 top-3.5 z-10 inline-flex size-8 items-center justify-center rounded-lg',
              'text-subtle transition-all duration-200 ease-[var(--ease-out-expo)]',
              'hover:bg-surface-sunken hover:text-foreground active:scale-[0.92]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              'disabled:pointer-events-none',
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})

/* ==========================================================================
   LAYOUT SLOTS
   `DialogBody` owns the scroll so header and footer stay pinned on tall content.
   ========================================================================== */

interface DialogSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Draw a hairline against the scrolling body. */
  divider?: boolean
}

function DialogHeader({ className, divider = false, ...props }: DialogSectionProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col gap-1.5 px-6 pb-4 pt-6 pr-14 text-left',
        divider && 'border-b border-line-subtle',
        className,
      )}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto px-6 py-1', className)} {...props} />
}

function DialogFooter({ className, divider = false, ...props }: DialogSectionProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 flex-col-reverse gap-2 px-6 pb-6 pt-4 sm:flex-row sm:justify-end',
        divider && 'border-t border-line-subtle',
        className,
      )}
      {...props}
    />
  )
}

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(function DialogTitle({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('font-display text-lg font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  )
})

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(function DialogDescription({ className, ...props }, ref) {
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm leading-relaxed text-muted', className)}
      {...props}
    />
  )
})

export {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
