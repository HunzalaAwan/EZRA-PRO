import * as React from 'react'
import { Slot, Slottable } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Variant order matters: `size` is declared before `variant` so that variant
 * classes land later in the class string. That lets `link` neutralise the
 * height/padding a size would otherwise impose, via tailwind-merge precedence.
 */
export const buttonVariants = cva(
  [
    'group/button relative inline-flex select-none items-center justify-center whitespace-nowrap',
    'font-medium tracking-[-0.01em] transition-all duration-200 ease-[var(--ease-out-expo)]',
    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
    'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none',
    'aria-disabled:pointer-events-none aria-disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
    // One place to neutralise every variant's lift/press transform.
    'motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100',
  ],
  {
    variants: {
      size: {
        xs: 'h-7 gap-1.5 rounded-md px-2.5 text-xs [&_svg]:size-3.5',
        sm: 'h-9 gap-1.5 rounded-lg px-3.5 text-[0.8125rem] [&_svg]:size-4',
        md: 'h-10 gap-2 rounded-lg px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 gap-2 rounded-xl px-5 text-[0.9375rem] [&_svg]:size-[1.125rem]',
        xl: 'h-13 gap-2.5 rounded-xl px-7 text-base [&_svg]:size-5',
      },
      variant: {
        /**
         * Hero CTA. Solid fill + inset specular highlight so it reads as a
         * physical key, a brand-tinted lift on hover and a real press state.
         * White/black here are pure light/shade overlays, not palette colours.
         */
        primary: [
          'bg-primary text-on-primary',
          'shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_28%,transparent),0_1px_2px_0_color-mix(in_oklab,var(--primary)_40%,transparent)]',
          'hover:bg-primary-hover',
          'hover:-translate-y-px hover:shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_34%,transparent),0_10px_26px_-8px_color-mix(in_oklab,var(--primary)_70%,transparent)]',
          'active:translate-y-0 active:scale-[0.98] active:shadow-[inset_0_2px_5px_0_color-mix(in_oklab,black_22%,transparent)]',
        ],
        accent: [
          'bg-accent text-on-accent',
          'shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_28%,transparent),0_1px_2px_0_color-mix(in_oklab,var(--accent)_40%,transparent)]',
          'hover:bg-accent-hover',
          'hover:-translate-y-px hover:shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_34%,transparent),0_10px_26px_-8px_color-mix(in_oklab,var(--accent)_70%,transparent)]',
          'active:translate-y-0 active:scale-[0.98] active:shadow-[inset_0_2px_5px_0_color-mix(in_oklab,black_22%,transparent)]',
        ],
        secondary: [
          'border border-line bg-surface-raised text-foreground shadow-xs',
          'hover:border-line-strong hover:bg-background-subtle hover:shadow-sm',
          'active:scale-[0.98] active:bg-surface-sunken active:shadow-none',
        ],
        outline: [
          'border border-line-strong bg-transparent text-foreground',
          'hover:border-primary/55 hover:bg-primary-soft/45 hover:text-primary',
          'active:scale-[0.98]',
        ],
        ghost: [
          'bg-transparent text-muted',
          'hover:bg-surface-sunken hover:text-foreground',
          'active:scale-[0.98] active:bg-surface-sunken',
        ],
        link: [
          'h-auto p-0 text-primary underline-offset-4 decoration-primary/40',
          'hover:text-primary-hover hover:underline',
          'focus-visible:ring-offset-0',
        ],
        danger: [
          'bg-danger text-background',
          'hover:bg-[color-mix(in_oklab,var(--danger)_88%,black)]',
          'shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_26%,transparent),0_1px_2px_0_color-mix(in_oklab,var(--danger)_40%,transparent)]',
          'hover:-translate-y-px hover:shadow-[inset_0_1px_0_0_color-mix(in_oklab,white_32%,transparent),0_10px_26px_-8px_color-mix(in_oklab,var(--danger)_65%,transparent)]',
          'active:translate-y-0 active:scale-[0.98] active:shadow-[inset_0_2px_5px_0_color-mix(in_oklab,black_22%,transparent)]',
        ],
        glass: [
          'glass text-foreground shadow-sm backdrop-saturate-150',
          'hover:bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] hover:shadow-md',
          'active:scale-[0.98]',
        ],
      },
      fullWidth: {
        true: 'w-full',
        false: '',
      },
    },
    defaultVariants: {
      size: 'md',
      variant: 'primary',
      fullWidth: false,
    },
  },
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>
export type ButtonSize = NonNullable<VariantProps<typeof buttonVariants>['size']>

export interface ButtonProps
  extends React.ComponentProps<'button'>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element instead of a `<button>` (e.g. a Next `<Link>`). */
  asChild?: boolean
  /** Swaps the leading slot for a spinner, disables the button and sets aria-busy. */
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

/**
 * The single action primitive for the whole product — marketing CTAs, dashboard
 * toolbars and the storefront checkout all render this.
 */
export function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, fullWidth }), className)
  const leading = loading ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : leftIcon

  // `asChild` renders an arbitrary element (usually a link), which cannot take the
  // native `disabled` attribute — so the disabled state is expressed via ARIA there,
  // and `Slottable` keeps the icon slots as siblings of the slotted child's content.
  if (asChild) {
    return (
      <Slot
        data-slot="button"
        data-loading={loading || undefined}
        className={classes}
        aria-disabled={disabled || loading || undefined}
        aria-busy={loading || undefined}
        {...(props as React.ComponentProps<typeof Slot>)}
      >
        {leading}
        <Slottable>{children}</Slottable>
        {!loading && rightIcon}
      </Slot>
    )
  }

  return (
    <button
      data-slot="button"
      data-loading={loading || undefined}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {leading}
      {children}
      {!loading && rightIcon}
    </button>
  )
}
