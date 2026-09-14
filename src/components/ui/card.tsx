import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export const cardVariants = cva(
  [
    'relative flex min-w-0 flex-col rounded-2xl',
    'transition-[transform,box-shadow,border-color,background-color] duration-300 ease-[var(--ease-out-expo)]',
    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
  ],
  {
    variants: {
      variant: {
        default: 'border border-line bg-surface shadow-sm',
        raised: 'border border-line-subtle bg-surface-raised shadow-lg',
        glass: 'glass shadow-lg',
        outline: 'border border-line bg-transparent',
        /**
         * Brand-washed panel for hero stats and upsell blocks. The wash is built
         * from the semantic tokens so it re-tints itself in dark mode.
         */
        gradient: [
          'border border-[color-mix(in_oklab,var(--primary)_22%,var(--border))]',
          'bg-[linear-gradient(145deg,color-mix(in_oklab,var(--primary)_12%,var(--surface))_0%,var(--surface)_46%,color-mix(in_oklab,var(--accent)_10%,var(--surface))_100%)]',
          'shadow-md',
        ],
      },
      interactive: {
        true: [
          'cursor-pointer',
          'hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-xl',
          'active:translate-y-0 active:shadow-md',
          'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
          'focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        ],
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
      interactive: false,
    },
  },
)

export type CardVariant = NonNullable<VariantProps<typeof cardVariants>['variant']>

export interface CardProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof cardVariants> {
  /** Render as the child element — e.g. wrap a `<Link>` to make the whole card a target. */
  asChild?: boolean
}

/** The dashboard's primary container. Everything else composes into it. */
export function Card({
  className,
  variant,
  interactive,
  asChild = false,
  ...props
}: CardProps) {
  const Comp = asChild ? Slot : 'div'

  return (
    <Comp
      data-slot="card"
      className={cn(cardVariants({ variant, interactive }), className)}
      {...(props as React.ComponentProps<'div'>)}
    />
  )
}

export interface CardHeaderProps extends React.ComponentProps<'div'> {
  /** Removes the bottom padding when the header sits directly on top of a chart. */
  flush?: boolean
}

/**
 * Title block on the left, optional `<CardToolbar>` on the right. Items align to
 * the top so a two-line title never drags the action buttons down with it.
 */
export function CardHeader({ className, flush = false, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'flex items-start justify-between gap-3 px-5 pt-5 sm:px-6 sm:pt-6',
        flush ? 'pb-0' : 'pb-4',
        className,
      )}
      {...props}
    />
  )
}

export interface CardTitleProps extends React.ComponentProps<'h3'> {
  asChild?: boolean
}

export function CardTitle({ className, asChild = false, ...props }: CardTitleProps) {
  const Comp = asChild ? Slot : 'h3'

  return (
    <Comp
      data-slot="card-title"
      className={cn(
        'font-display text-[0.9375rem] leading-tight font-semibold tracking-[-0.015em] text-foreground',
        className,
      )}
      {...(props as React.ComponentProps<'h3'>)}
    />
  )
}

export function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('mt-1 text-xs leading-relaxed text-muted', className)}
      {...props}
    />
  )
}

/** Right-hand action rail inside a `<CardHeader>` — filters, menus, range pickers. */
export function CardToolbar({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-toolbar"
      className={cn('flex shrink-0 items-center gap-1.5', className)}
      {...props}
    />
  )
}

export interface CardContentProps extends React.ComponentProps<'div'> {
  /** Drop the horizontal padding for edge-to-edge tables, charts and media. */
  bleed?: boolean
}

export function CardContent({ className, bleed = false, ...props }: CardContentProps) {
  return (
    <div
      data-slot="card-content"
      className={cn(
        'min-w-0 flex-1',
        bleed ? 'px-0' : 'px-5 sm:px-6',
        // A card with no header needs its own top padding.
        'first:pt-5 sm:first:pt-6 last:pb-5 sm:last:pb-6',
        className,
      )}
      {...props}
    />
  )
}

export interface CardFooterProps extends React.ComponentProps<'div'> {
  /** Adds a hairline rule and a sunken wash — use for action bars and totals. */
  separated?: boolean
}

export function CardFooter({ className, separated = false, ...props }: CardFooterProps) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'mt-auto flex items-center gap-3 px-5 pt-4 pb-5 sm:px-6 sm:pb-6',
        separated && 'mt-4 border-t border-line bg-surface-sunken/60 pt-4 rounded-b-2xl',
        className,
      )}
      {...props}
    />
  )
}
