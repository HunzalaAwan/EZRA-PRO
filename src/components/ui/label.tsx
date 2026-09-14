'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export const labelVariants = cva(
  [
    'inline-flex select-none items-center gap-1.5 font-medium text-foreground',
    'leading-none tracking-[-0.005em]',
    // Dim in step with the control the label is attached to.
    'peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
    'group-data-[disabled=true]/field:cursor-not-allowed group-data-[disabled=true]/field:opacity-60',
  ],
  {
    variants: {
      size: {
        sm: 'text-xs',
        md: 'text-[0.8125rem]',
        lg: 'text-sm',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
)

export type LabelSize = NonNullable<VariantProps<typeof labelVariants>['size']>

export interface LabelProps
  extends React.ComponentProps<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  /** Shows a required marker. The asterisk is decorative; screen readers get real text. */
  required?: boolean
  /** Shows a quiet "Optional" affordance — use it instead of marking everything required. */
  optional?: boolean
}

export function Label({
  className,
  size,
  required = false,
  optional = false,
  children,
  ...props
}: LabelProps) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(labelVariants({ size }), className)}
      {...props}
    >
      {children}
      {required ? (
        <>
          <span aria-hidden="true" className="text-danger">
            *
          </span>
          <span className="sr-only">(required)</span>
        </>
      ) : null}
      {optional && !required ? (
        <span className="text-xs font-normal text-faint">Optional</span>
      ) : null}
    </LabelPrimitive.Root>
  )
}
