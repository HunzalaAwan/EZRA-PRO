'use client'

// Client by design: `<Field>` clones its child to inject id/aria wiring, which
// only works if the control reaches it as an unrendered client element.
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export const textareaVariants = cva(
  [
    'w-full rounded-lg border border-line bg-surface text-foreground shadow-xs',
    'transition-all duration-200 ease-[var(--ease-out-expo)]',
    'placeholder:text-faint',
    'hover:border-line-strong',
    'focus-visible:border-primary focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/25',
    'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60 disabled:shadow-none',
    'aria-invalid:border-danger aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-danger/25',
  ],
  {
    variants: {
      size: {
        sm: 'min-h-20 rounded-md px-2.5 py-2 text-[0.8125rem] leading-relaxed',
        md: 'min-h-24 px-3 py-2.5 text-sm leading-relaxed',
        lg: 'min-h-32 rounded-xl px-3.5 py-3 text-[0.9375rem] leading-relaxed',
      },
      resize: {
        none: 'resize-none',
        vertical: 'resize-y',
        both: 'resize',
      },
    },
    defaultVariants: {
      size: 'md',
      resize: 'vertical',
    },
  },
)

export type TextareaSize = NonNullable<VariantProps<typeof textareaVariants>['size']>
export type TextareaResize = NonNullable<VariantProps<typeof textareaVariants>['resize']>

export interface TextareaProps
  extends Omit<React.ComponentProps<'textarea'>, 'size'>,
    VariantProps<typeof textareaVariants> {
  /** `true` or a message string both mark the field invalid; `<Field>` renders the message. */
  error?: boolean | string
}

export function Textarea({
  className,
  size,
  resize,
  error,
  'aria-invalid': ariaInvalid,
  ...props
}: TextareaProps) {
  const invalid =
    error !== undefined && error !== false
      ? true
      : ariaInvalid === true || ariaInvalid === 'true'

  return (
    <textarea
      data-slot="textarea"
      aria-invalid={invalid || undefined}
      className={cn(textareaVariants({ size, resize }), className)}
      {...props}
    />
  )
}
