'use client'

import * as React from 'react'
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Radix hands us `--radix-dropdown-menu-content-transform-origin`, which already
 * encodes the resolved side and alignment. Scaling from that origin gives the
 * menu a directional "grow out of the trigger" feel with a single keyframe pair
 * instead of eight side-specific ones.
 */
const MENU_MOTION_CSS = `
@keyframes ezra-menu-in{from{opacity:0;transform:scale(0.94)}to{opacity:1;transform:scale(1)}}
@keyframes ezra-menu-out{from{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(0.96)}}
`

function MenuMotionStyles() {
  return (
    <style href="ezra-motion-menu" precedence="medium">
      {MENU_MOTION_CSS}
    </style>
  )
}

/** Emits the keyframes up-front — see the note in dialog.tsx. */
function DropdownMenu({
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>) {
  return (
    <DropdownMenuPrimitive.Root {...props}>
      <MenuMotionStyles />
      {children}
    </DropdownMenuPrimitive.Root>
  )
}

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
const DropdownMenuGroup = DropdownMenuPrimitive.Group
const DropdownMenuPortal = DropdownMenuPrimitive.Portal
const DropdownMenuSub = DropdownMenuPrimitive.Sub
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

/* ==========================================================================
   SHARED SURFACE + ITEM RECIPES
   ========================================================================== */

const menuSurface = [
  'z-50 min-w-[10rem] rounded-xl border border-line bg-surface-raised p-1.5 text-foreground shadow-xl',
  'max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto overflow-x-hidden',
  'origin-[var(--radix-dropdown-menu-content-transform-origin)]',
  'data-[state=open]:animate-[ezra-menu-in_170ms_var(--ease-out-expo)]',
  'data-[state=closed]:animate-[ezra-menu-out_120ms_var(--ease-in-out-quart)]',
]

export const dropdownMenuItemVariants = cva(
  [
    'relative flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2',
    'text-sm outline-none transition-colors duration-150',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      tone: {
        default: 'text-foreground focus:bg-surface-sunken [&_svg]:text-subtle focus:[&_svg]:text-foreground',
        primary: 'text-primary focus:bg-primary-soft [&_svg]:text-primary',
        danger: 'text-danger focus:bg-danger-soft [&_svg]:text-danger',
      },
      inset: {
        true: 'pl-9',
        false: '',
      },
    },
    defaultVariants: { tone: 'default', inset: false },
  },
)

export type DropdownMenuItemVariants = VariantProps<typeof dropdownMenuItemVariants>

/* ==========================================================================
   CONTENT
   ========================================================================== */

const DropdownMenuContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(function DropdownMenuContent({ className, sideOffset = 6, collisionPadding = 12, ...props }, ref) {
  return (
    <>
      <MenuMotionStyles />
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={ref}
          sideOffset={sideOffset}
          collisionPadding={collisionPadding}
          className={cn(menuSurface, className)}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    </>
  )
})

const DropdownMenuSubContent = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(function DropdownMenuSubContent({ className, ...props }, ref) {
  return (
    <>
      <MenuMotionStyles />
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.SubContent
          ref={ref}
          className={cn(menuSurface, 'shadow-lg', className)}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    </>
  )
})

const DropdownMenuSubTrigger = React.forwardRef<
  React.ComponentRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> &
    Pick<DropdownMenuItemVariants, 'inset'>
>(function DropdownMenuSubTrigger({ className, inset, children, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
          dropdownMenuItemVariants({ inset }),
          'data-[state=open]:bg-surface-sunken',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronRight className="ml-auto size-4 text-faint" aria-hidden="true" />
      </DropdownMenuPrimitive.SubTrigger>
    )
  })
  
  /* ==========================================================================
     ITEMS
     ========================================================================== */
  
  const DropdownMenuItem = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & DropdownMenuItemVariants
  >(function DropdownMenuItem({ className, tone, inset, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.Item
        ref={ref}
        className={cn(dropdownMenuItemVariants({ tone, inset }), className)}
        {...props}
      />
    )
  })
  
  const DropdownMenuCheckboxItem = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.CheckboxItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
  >(function DropdownMenuCheckboxItem({ className, children, checked, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.CheckboxItem
        ref={ref}
        checked={checked}
        className={cn(dropdownMenuItemVariants({ inset: true }), className)}
        {...props}
      >
        <span className="absolute left-2.5 flex size-4 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <Check className="size-4 text-primary" aria-hidden="true" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.CheckboxItem>
    )
  })
  
  const DropdownMenuRadioItem = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.RadioItem>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
  >(function DropdownMenuRadioItem({ className, children, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.RadioItem
        ref={ref}
        className={cn(dropdownMenuItemVariants({ inset: true }), className)}
        {...props}
      >
        <span className="absolute left-2.5 flex size-4 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <Circle className="size-2 fill-primary text-primary" aria-hidden="true" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.RadioItem>
    )
  })
  
  /* ==========================================================================
     DECORATION
     ========================================================================== */
  
  const DropdownMenuLabel = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.Label>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> &
      Pick<DropdownMenuItemVariants, 'inset'>
  >(function DropdownMenuLabel({ className, inset, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.Label
        ref={ref}
        className={cn(
          'px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-faint',
          inset && 'pl-9',
          className,
        )}
        {...props}
      />
    )
  })
  
  const DropdownMenuSeparator = React.forwardRef<
    React.ComponentRef<typeof DropdownMenuPrimitive.Separator>,
    React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
  >(function DropdownMenuSeparator({ className, ...props }, ref) {
    return (
      <DropdownMenuPrimitive.Separator
        ref={ref}
        className={cn('-mx-1.5 my-1.5 h-px bg-line-subtle', className)}
        {...props}
      />
    )
  })
  
  function DropdownMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
    return (
      <span
        className={cn('ml-auto pl-4 font-mono text-xs tracking-widest text-faint', className)}
        {...props}
      />
    )
  }
  
  export {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuGroup,
    DropdownMenuPortal,
    DropdownMenuSub,
    DropdownMenuRadioGroup,
    DropdownMenuContent,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
  }
