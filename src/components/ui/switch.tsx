'use client'

import * as React from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export const switchVariants = cva(
  [
    'group/switch peer inline-flex shrink-0 cursor-pointer items-center rounded-full p-0.5',
    'border border-transparent transition-colors duration-200 ease-[var(--ease-out-expo)]',
    'bg-line-strong',
    'focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/30',
    'data-[state=checked]:bg-primary',
    'data-[state=checked]:shadow-[inset_0_1px_2px_0_color-mix(in_oklab,black_18%,transparent)]',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ],
  {
    variants: {
      size: {
        sm: 'h-4.5 w-8',
        md: 'h-5.5 w-10',
        lg: 'h-7 w-12',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Thumb travel is root width minus padding minus thumb width — keep these in sync. */
const switchThumbSizes: Record<SwitchSize, string> = {
  sm: 'size-3.5 data-[state=checked]:translate-x-3.5',
  md: 'size-4.5 data-[state=checked]:translate-x-4.5',
  lg: 'size-6 data-[state=checked]:translate-x-5',
}

export type SwitchSize = NonNullable<VariantProps<typeof switchVariants>['size']>

export interface SwitchProps
  extends React.ComponentProps<typeof SwitchPrimitive.Root>,
    VariantProps<typeof switchVariants> {}

export function Switch({ className, size = 'md', ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(switchVariants({ size }), className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full bg-background shadow-sm ring-0',
          'transition-transform duration-200 ease-[var(--ease-out-expo)]',
          'data-[state=unchecked]:translate-x-0',
          switchThumbSizes[size ?? 'md'],
        )}
      />
    </SwitchPrimitive.Root>
  )
}
