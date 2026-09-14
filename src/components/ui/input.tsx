'use client'

// Client by design: `<Field>` clones its child to inject id/aria wiring, which
// only works if the control reaches it as an unrendered client element.
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/**
 * The bordered "shell" is the visual control; the `<input>` inside is chrome-free.
 * Framing it this way lets a suffix of any width (currency code, unit, action)
 * sit flush against the field without hand-tuned padding.
 */
export const inputShellVariants = cva(
  [
    'group/input relative flex w-full items-center rounded-lg border border-line bg-surface',
    'text-foreground shadow-xs transition-all duration-200 ease-[var(--ease-out-expo)]',
    'hover:border-line-strong',
    'focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/25 focus-within:hover:border-primary',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      size: {
        sm: 'h-9 gap-1.5 rounded-md px-2.5 text-[0.8125rem] [&_svg]:size-3.5',
        md: 'h-10 gap-2 px-3 text-sm [&_svg]:size-4',
        lg: 'h-11 gap-2.5 rounded-xl px-3.5 text-[0.9375rem] [&_svg]:size-[1.125rem]',
      },
      invalid: {
        true: 'border-danger hover:border-danger focus-within:border-danger focus-within:ring-danger/25 focus-within:hover:border-danger',
        false: '',
      },
      disabled: {
        true: 'cursor-not-allowed border-line bg-surface-sunken opacity-60 shadow-none hover:border-line',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      invalid: false,
      disabled: false,
    },
  },
)

export type InputSize = NonNullable<VariantProps<typeof inputShellVariants>['size']>

export interface InputProps extends Omit<React.ComponentProps<'input'>, 'size'> {
  size?: InputSize
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  /** Trailing unit or context chip, e.g. "USD", "%", "guests". Any width. */
  suffix?: React.ReactNode
  /**
   * `true` or a message string both mark the field invalid. The message itself is
   * rendered by `<Field>`, which also wires `aria-describedby`.
   */
  error?: boolean | string
  /** Escape hatch for styling the inner `<input>`; `className` targets the shell. */
  inputClassName?: string
}

export function Input({
  className,
  inputClassName,
  size = 'md',
  leftIcon,
  rightIcon,
  suffix,
  error,
  disabled,
  'aria-invalid': ariaInvalid,
  ...props
}: InputProps) {
  // `<Field>` injects aria-invalid, so honour it as an equal source of truth.
  const invalid =
    error !== undefined && error !== false
      ? true
      : ariaInvalid === true || ariaInvalid === 'true'

  return (
    <div
      data-slot="input"
      data-invalid={invalid || undefined}
      className={cn(inputShellVariants({ size, invalid, disabled: Boolean(disabled) }), className)}
    >
      {leftIcon ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex items-center transition-colors duration-200',
            invalid ? 'text-danger' : 'text-faint group-focus-within/input:text-primary',
          )}
        >
          {leftIcon}
        </span>
      ) : null}

      <input
        data-slot="input-control"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'peer h-full w-full min-w-0 bg-transparent text-inherit outline-hidden',
          'placeholder:text-faint disabled:cursor-not-allowed',
          // Native date/time/number affordances need to pick up the theme.
          '[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100',
          inputClassName,
        )}
        {...props}
      />

      {rightIcon ? (
        <span aria-hidden="true" className="flex items-center text-faint">
          {rightIcon}
        </span>
      ) : null}

      {suffix ? (
        <span className="flex shrink-0 items-center gap-1 border-l border-line pl-2 text-xs font-medium text-subtle tabular">
          {suffix}
        </span>
      ) : null}
    </div>
  )
}
