'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { cva, type VariantProps } from 'class-variance-authority'
import { Check, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

export const checkboxVariants = cva(
  [
    'group/checkbox peer relative inline-flex shrink-0 items-center justify-center',
    'rounded-[0.3rem] border border-line-strong bg-surface shadow-xs',
    'transition-all duration-200 ease-[var(--ease-out-expo)]',
    'hover:border-primary/60',
    'focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/30',
    'active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100',
    'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-on-primary',
    'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-on-primary',
    'data-[state=checked]:shadow-[0_2px_8px_-2px_color-mix(in_oklab,var(--primary)_55%,transparent)]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
    'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/30',
  ],
  {
    variants: {
      size: {
        sm: 'size-4 [&_svg]:size-3',
        md: 'size-[1.125rem] [&_svg]:size-3.5',
        lg: 'size-5 [&_svg]:size-4',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type CheckboxSize = NonNullable<VariantProps<typeof checkboxVariants>['size']>

export interface CheckboxProps
  extends React.ComponentProps<typeof CheckboxPrimitive.Root>,
    VariantProps<typeof checkboxVariants> {}

export function Checkbox({ className, size, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(checkboxVariants({ size }), className)}
      {...props}
    >
      {/*
        forceMount keeps the glyph in the tree so it can scale in and out instead of
        popping. The indeterminate/checked swap is pure CSS off the root's data-state.
      */}
      <CheckboxPrimitive.Indicator
        forceMount
        className={cn(
          'pointer-events-none flex items-center justify-center text-current',
          'transition-all duration-200 ease-[var(--ease-spring)]',
          'group-data-[state=unchecked]/checkbox:scale-50 group-data-[state=unchecked]/checkbox:opacity-0',
        )}
      >
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="group-data-[state=indeterminate]/checkbox:hidden"
        />
        <Minus
          aria-hidden="true"
          strokeWidth={3}
          className="hidden group-data-[state=indeterminate]/checkbox:block"
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
