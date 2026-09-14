'use client'

import * as React from 'react'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/* ==========================================================================
   ToggleGroup — multi- or single-select chip row (status filters, weekday
   pickers on a schedule template, text-align style toolbars).

   Unlike <Segmented>, this supports `type="multiple"` and has no travelling
   indicator; pressed items are styled in place via `data-[state=on]`.

   Size/variant are shared through context so consumers set them once on the
   root instead of repeating themselves on every item.
   ========================================================================== */

const toggleGroupVariants = cva('flex items-center', {
  variants: {
    variant: {
      // Chips float independently.
      default: 'gap-1',
      // Items fuse into a single control with shared borders.
      joined:
        'gap-0 rounded-xl border border-line bg-surface [&>*]:rounded-none [&>*]:border-0 [&>*+*]:border-l [&>*+*]:border-line [&>*:first-child]:rounded-l-[0.6875rem] [&>*:last-child]:rounded-r-[0.6875rem]',
    },
    fullWidth: {
      true: 'w-full [&>*]:flex-1',
      false: '',
    },
  },
  defaultVariants: { variant: 'default', fullWidth: false },
})

const toggleGroupItemVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium',
    'transition-all duration-200 ease-[var(--ease-out-quint)] active:scale-[0.97]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary focus-visible:z-10',
    'disabled:pointer-events-none disabled:opacity-40',
    'data-[state=on]:font-semibold',
  ],
  {
    variants: {
      variant: {
        default: [
          'rounded-lg border border-line bg-surface text-muted',
          'hover:border-line-strong hover:bg-surface-sunken hover:text-foreground',
          'data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:text-primary',
        ],
        joined: [
          'bg-transparent text-muted hover:bg-surface-sunken hover:text-foreground',
          'data-[state=on]:bg-primary-soft data-[state=on]:text-primary',
        ],
      },
      size: {
        sm: 'h-7 px-2 text-xs [&_svg]:size-3.5',
        md: 'h-8 px-3 text-[0.8125rem] [&_svg]:size-4',
        lg: 'h-10 px-4 text-sm [&_svg]:size-4',
      },
      /** Square footprint for icon-only items. */
      iconOnly: {
        true: 'aspect-square px-0',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', size: 'md', iconOnly: false },
  },
)

export type ToggleGroupVariants = VariantProps<typeof toggleGroupVariants>
export type ToggleGroupItemVariants = VariantProps<typeof toggleGroupItemVariants>

interface ToggleGroupContextValue {
  variant: NonNullable<ToggleGroupItemVariants['variant']>
  size: NonNullable<ToggleGroupItemVariants['size']>
}

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  variant: 'default',
  size: 'md',
})

export type ToggleGroupProps = React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  ToggleGroupVariants & {
    size?: NonNullable<ToggleGroupItemVariants['size']>
  }

function ToggleGroup({
  className,
  variant = 'default',
  size = 'md',
  fullWidth,
  children,
  ...props
}: ToggleGroupProps) {
  const contextValue = React.useMemo(
    () => ({ variant: variant ?? 'default', size: size ?? 'md' }),
    [variant, size],
  )

  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      className={cn(toggleGroupVariants({ variant, fullWidth }), className)}
      {...props}
    >
      <ToggleGroupContext.Provider value={contextValue}>{children}</ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
}

export type ToggleGroupItemProps = React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  Pick<ToggleGroupItemVariants, 'iconOnly'> & {
    variant?: NonNullable<ToggleGroupItemVariants['variant']>
    size?: NonNullable<ToggleGroupItemVariants['size']>
  }

function ToggleGroupItem({
  className,
  variant,
  size,
  iconOnly,
  children,
  ...props
}: ToggleGroupItemProps) {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        toggleGroupItemVariants({
          variant: variant ?? context.variant,
          size: size ?? context.size,
          iconOnly,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem, toggleGroupVariants, toggleGroupItemVariants }
