import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/* ==========================================================================
   Kbd — keyboard hints for the command palette, search fields and shortcuts
   cheatsheet. Rendered as a real <kbd> so assistive tech announces it as a
   key, with a pressed-cap inset shadow that survives both themes.
   ========================================================================== */

const kbdVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-0.5 font-mono font-medium',
    'border border-line-strong bg-surface-raised text-subtle',
    'shadow-[inset_0_-1px_0_0_color-mix(in_oklab,var(--border-strong)_70%,transparent)]',
    'transition-colors duration-150',
  ],
  {
    variants: {
      size: {
        sm: 'h-4.5 min-w-4.5 rounded-[0.25rem] px-1 text-xs',
        md: 'h-5.5 min-w-5.5 rounded-[0.3125rem] px-1.5 text-xs',
        lg: 'h-7 min-w-7 rounded-md px-2 text-xs',
      },
      variant: {
        default: '',
        /** For dark decorative surfaces (hero, command palette footer). */
        ghost: 'border-line-subtle bg-surface/60 shadow-none',
      },
    },
    defaultVariants: { size: 'md', variant: 'default' },
  },
)

export type KbdVariants = VariantProps<typeof kbdVariants>

export interface KbdProps extends React.ComponentProps<'kbd'>, KbdVariants {}

function Kbd({ className, size, variant, ...props }: KbdProps) {
  return (
    <kbd data-slot="kbd" className={cn(kbdVariants({ size, variant }), className)} {...props} />
  )
}

export interface KbdGroupProps extends Omit<React.ComponentProps<'span'>, 'children'>, KbdVariants {
  /** Keys rendered left to right, e.g. `['⌘', 'K']` or `['Ctrl', 'Shift', 'P']`. */
  keys: string[]
  /** Rendered between keys. Use `'+'` for chords, `''` for adjacent caps. */
  separator?: React.ReactNode
}

function KbdGroup({ className, keys, separator, size, variant, ...props }: KbdGroupProps) {
  return (
    <span
      data-slot="kbd-group"
      className={cn('inline-flex items-center gap-1', className)}
      {...props}
    >
      {keys.map((key, i) => (
        <React.Fragment key={`${key}-${i}`}>
          {i > 0 && separator ? (
            <span aria-hidden="true" className="text-xs text-faint">
              {separator}
            </span>
          ) : null}
          <Kbd size={size} variant={variant}>
            {key}
          </Kbd>
        </React.Fragment>
      ))}
    </span>
  )
}

export { Kbd, KbdGroup, kbdVariants }
