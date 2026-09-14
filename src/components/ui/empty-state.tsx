import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CloudOff, Inbox, SearchX, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   EmptyState — the "nothing here" surface used by tables, lists, calendars
   and the storefront. Illustration-grade: a gradient medallion floating on a
   masked dot field, so an empty screen still feels designed rather than broken.
   ========================================================================== */

const emptyStateVariants = cva(
  'relative isolate flex w-full flex-col items-center justify-center overflow-hidden text-center',
  {
    variants: {
      size: {
        sm: 'gap-3 px-5 py-8',
        md: 'gap-4 px-6 py-14',
        lg: 'gap-5 px-8 py-20',
      },
      surface: {
        none: '',
        card: 'rounded-2xl border border-line bg-surface shadow-xs',
        dashed: 'rounded-2xl border border-dashed border-line-strong bg-surface/40',
      },
    },
    defaultVariants: { size: 'md', surface: 'none' },
  },
)

export type EmptyStateVariants = VariantProps<typeof emptyStateVariants>

export type EmptyStateTone = 'no-data' | 'no-results' | 'error'

/**
 * Per-tone medallion treatment. Decorative gradients intentionally reach for
 * the raw brand ramps (rather than semantic tokens) because they are pure
 * ornament and read correctly on both themes at these opacities.
 */
const TONE: Record<
  EmptyStateTone,
  { icon: LucideIcon; glow: string; plate: string; ring: string; mark: string }
> = {
  'no-data': {
    icon: Inbox,
    glow: 'bg-[radial-gradient(circle_at_50%_40%,var(--color-lagoon-400),transparent_68%)]',
    plate: 'from-lagoon-400/22 via-lagoon-300/10 to-reef-400/14',
    ring: 'ring-lagoon-400/25',
    mark: 'text-primary',
  },
  'no-results': {
    icon: SearchX,
    glow: 'bg-[radial-gradient(circle_at_50%_40%,var(--color-reef-400),transparent_68%)]',
    plate: 'from-lagoon-400/16 to-lagoon-300/6',
    ring: 'ring-reef-400/25',
    mark: 'text-info',
  },
  error: {
    icon: CloudOff,
    glow: 'bg-[radial-gradient(circle_at_50%_40%,var(--color-coral-500),transparent_68%)]',
    plate: 'from-coral-500/16 to-coral-400/6',
    ring: 'ring-coral-400/28',
    mark: 'text-danger',
  },
}

const MEDALLION_SIZE = {
  sm: { box: 'size-12 rounded-xl', icon: 'size-5' },
  md: { box: 'size-16 rounded-2xl', icon: 'size-7' },
  lg: { box: 'size-20 rounded-3xl', icon: 'size-9' },
} as const

export interface EmptyStateProps extends Omit<React.ComponentProps<'div'>, 'title'>, EmptyStateVariants {
  /** Chooses the default icon + medallion tint. */
  variant?: EmptyStateTone
  /** Overrides the tone's default icon. */
  icon?: LucideIcon
  title: React.ReactNode
  description?: React.ReactNode
  /** Primary call to action — pass a <Button>. */
  action?: React.ReactNode
  /** Quieter escape hatch, rendered beside the primary action. */
  secondaryAction?: React.ReactNode
  /** Hide the medallion entirely for very tight surfaces. */
  hideMedallion?: boolean
}

function EmptyState({
  className,
  variant = 'no-data',
  size = 'md',
  surface,
  icon,
  title,
  description,
  action,
  secondaryAction,
  hideMedallion = false,
  children,
  ...props
}: EmptyStateProps) {
  const tone = TONE[variant]
  const Icon = icon ?? tone.icon
  const medallion = MEDALLION_SIZE[size ?? 'md']

  return (
    <div
      data-slot="empty-state"
      data-variant={variant}
      className={cn(emptyStateVariants({ size, surface }), className)}
      {...props}
    >
      {/* Masked texture field — keeps large empty areas from reading as a blank canvas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-dots mask-radial opacity-50"
      />

      {!hideMedallion && (
        <div className="relative mb-1 grid place-items-center">
          <div
            aria-hidden="true"
            className={cn(
              'absolute size-24 rounded-full opacity-25 blur-2xl',
              size === 'lg' && 'size-32',
              size === 'sm' && 'size-16',
              tone.glow,
            )}
          />
          <div
            aria-hidden="true"
            className={cn(
              'relative grid place-items-center bg-gradient-to-br ring-1 ring-inset',
              'border border-line-subtle shadow-sm backdrop-blur-sm',
              medallion.box,
              tone.plate,
              tone.ring,
            )}
          >
            <Icon className={cn(medallion.icon, tone.mark)} strokeWidth={1.6} />
          </div>
        </div>
      )}

      <div className="flex max-w-md flex-col gap-1.5">
        <h3
          className={cn(
            'font-display font-semibold text-foreground',
            size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base',
          )}
        >
          {title}
        </h3>
        {description ? (
          <p className={cn('text-balance text-muted', size === 'sm' ? 'text-xs' : 'text-sm')}>
            {description}
          </p>
        ) : null}
      </div>

      {children}

      {(action || secondaryAction) && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}

export { EmptyState, emptyStateVariants }
