import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleAlert, CircleCheck, Info, Sparkles, TriangleAlert, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   Alert — inline, non-transient messaging (form errors, policy notices,
   capacity warnings). Transient feedback belongs in the Toaster instead.

   Every tone pairs colour with a distinct icon so meaning survives greyscale
   and colour-vision deficiency.
   ========================================================================== */

const alertVariants = cva(
  'relative flex w-full gap-3 rounded-xl border px-4 py-3.5 text-sm transition-colors duration-200',
  {
    variants: {
      variant: {
        neutral: 'border-line bg-surface-sunken/70 text-foreground',
        info: 'border-info/25 bg-info-soft/60 text-foreground',
        success: 'border-success/25 bg-success-soft/60 text-foreground',
        warning: 'border-warning/30 bg-warning-soft/60 text-foreground',
        danger: 'border-danger/30 bg-danger-soft/60 text-foreground',
        brand: 'border-primary/25 bg-primary-soft/50 text-foreground',
      },
      /** `bare` drops the fill for dense surfaces that already have a card. */
      emphasis: {
        soft: '',
        bare: 'border-transparent bg-transparent px-0 py-0',
      },
    },
    defaultVariants: { variant: 'neutral', emphasis: 'soft' },
  },
)

export type AlertVariants = VariantProps<typeof alertVariants>

export type AlertTone = NonNullable<AlertVariants['variant']>

const TONE_ICON: Record<AlertTone, LucideIcon> = {
  neutral: Info,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  brand: Sparkles,
}

const TONE_MARK: Record<AlertTone, string> = {
  neutral: 'text-subtle',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  brand: 'text-primary',
}

export interface AlertProps extends React.ComponentProps<'div'>, AlertVariants {
  /** Custom icon, or `false` to suppress the leading mark entirely. */
  icon?: LucideIcon | false
  /** Trailing slot — a link, a dismiss button, a retry action. */
  action?: React.ReactNode
}

function Alert({
  className,
  variant = 'neutral',
  emphasis,
  icon,
  action,
  children,
  ...props
}: AlertProps) {
  const tone: AlertTone = variant ?? 'neutral'
  const Icon = icon === false ? null : (icon ?? TONE_ICON[tone])

  return (
    <div
      data-slot="alert"
      data-variant={tone}
      // `status` (polite) rather than `alert` (assertive): these render with the
      // page, so interrupting the screen reader would be hostile.
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant, emphasis }), className)}
      {...props}
    >
      {Icon ? (
        <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', TONE_MARK[tone])} />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
      {action ? <div className="ml-auto flex shrink-0 items-start gap-2">{action}</div> : null}
    </div>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="alert-title"
      className={cn('font-display text-sm font-semibold leading-tight text-foreground', className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        'text-sm leading-relaxed text-muted [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        className,
      )}
      {...props}
    />
  )
}

function AlertActions({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-actions"
      className={cn('mt-1.5 flex flex-wrap items-center gap-2', className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, AlertActions, alertVariants }
