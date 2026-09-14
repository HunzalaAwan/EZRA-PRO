'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  type SheetContentProps,
} from '@/components/ui/sheet'

/**
 * The mobile drawer is the bottom-anchored specialisation of Sheet: same Radix
 * Dialog machinery and the same slide keyframes, plus a grab handle and a
 * rounded lip. Kept as its own module because call sites read far better as
 * `<Drawer>` than `<Sheet side="bottom">`, and because the handle needs to be
 * a real close affordance for keyboard and screen-reader users.
 */

const Drawer = Sheet
const DrawerTrigger = SheetTrigger
const DrawerPortal = SheetPortal
const DrawerClose = SheetClose
const DrawerOverlay = SheetOverlay
const DrawerBody = SheetBody
const DrawerFooter = SheetFooter
const DrawerTitle = SheetTitle
const DrawerDescription = SheetDescription

/**
 * Same as SheetHeader minus the right gutter — a drawer closes via its handle,
 * so there is no corner button for the title to dodge.
 */
function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <SheetHeader className={cn('pr-6 text-center sm:text-left', className)} {...props} />
  )
}

/**
 * The drag affordance. It is a button rather than a decorative bar so the
 * gesture has a keyboard equivalent — on touch the whole strip is a generous
 * 44px tap target.
 */
function DrawerHandle({ className, ...props }: React.ComponentPropsWithoutRef<typeof SheetClose>) {
  return (
    <SheetClose
      aria-label="Close drawer"
      className={cn(
        'group mx-auto flex min-h-11 w-full shrink-0 cursor-grab items-center justify-center',
        'touch-none select-none active:cursor-grabbing',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-1.5 w-11 rounded-full bg-line-strong',
          'transition-all duration-200 ease-[var(--ease-out-expo)]',
          'group-hover:w-14 group-hover:bg-faint group-active:w-10',
        )}
      />
    </SheetClose>
  )
}

export interface DrawerContentProps extends Omit<SheetContentProps, 'side'> {
  /** Render the grab handle strip above the content. */
  showHandle?: boolean
}

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof SheetContent>,
  DrawerContentProps
>(function DrawerContent(
  { className, children, size = 'lg', showHandle = true, showCloseButton = false, ...props },
  ref,
) {
  return (
    <SheetContent
      ref={ref}
      side="bottom"
      size={size}
      showCloseButton={showCloseButton}
      className={cn('rounded-t-3xl', className)}
      {...props}
    >
      {showHandle ? <DrawerHandle /> : null}
      {children}
    </SheetContent>
  )
})

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerClose,
  DrawerOverlay,
  DrawerContent,
  DrawerHandle,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
}
