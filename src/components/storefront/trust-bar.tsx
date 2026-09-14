import { BadgeCheck, CalendarCheck, ShieldCheck, Star, Zap } from 'lucide-react'

import { cn, formatNumber, pluralize } from '@/lib/utils'

/* ==========================================================================
   <TrustBar>

   The four reassurances that move conversion on an experience checkout, said
   once and reused: payment safety, confirmation speed, cancellation terms and
   social proof. Rendered as a full-width band under the hero and as a compact
   inline strip inside the booking widget and the checkout summary.

   Deliberately server-renderable — no hooks — so it can sit in either tree.
   ========================================================================== */

export interface TrustBarProps extends React.ComponentProps<'div'> {
  rating: number
  reviewCount: number
  /** From the activity's cancellation policy; defaults to the common 24h term. */
  freeCancellationHours?: number
  variant?: 'band' | 'inline'
  className?: string
}

export function TrustBar({
  rating,
  reviewCount,
  freeCancellationHours = 24,
  variant = 'band',
  className,
  ...props
}: TrustBarProps) {
  const cancellation =
    freeCancellationHours >= 48
      ? `Free cancellation up to ${Math.round(freeCancellationHours / 24)} days before`
      : `Free cancellation up to ${freeCancellationHours} hours before`

  const items = [
    {
      icon: ShieldCheck,
      label: 'Secure checkout',
      detail: 'Card details never touch our servers',
      tone: 'text-success',
    },
    {
      icon: Zap,
      label: 'Instant confirmation',
      detail: 'Tickets in your inbox in seconds',
      tone: 'text-primary',
    },
    {
      icon: CalendarCheck,
      label: cancellation,
      detail: 'Plans change. We get it.',
      tone: 'text-info',
    },
    {
      icon: Star,
      label: `${rating.toFixed(1)} from ${formatNumber(reviewCount)} ${pluralize(reviewCount, 'review')}`,
      detail: 'Verified guests only',
      tone: 'text-warning',
    },
  ] as const

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted',
          className,
        )}
        {...props}
      >
        {items.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5">
            <item.icon className={cn('size-3.5 shrink-0', item.tone)} aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'border-y border-line-subtle bg-surface-sunken/60 backdrop-blur-sm',
        className,
      )}
      {...props}
    >
      <div className="mx-auto grid w-full max-w-[88rem] grid-cols-1 gap-px overflow-hidden px-4 py-1 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-10">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-start gap-3 px-1 py-4 lg:px-4"
          >
            <span
              aria-hidden="true"
              className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg border border-line-subtle bg-surface shadow-xs"
            >
              <item.icon className={cn('size-4', item.tone)} />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[0.8125rem] font-semibold leading-snug tracking-tight text-foreground">
                {item.label}
              </span>
              <span className="mt-0.5 truncate text-xs text-subtle">{item.detail}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ==========================================================================
   <TrustSeal>
   A single compact reassurance used under primary buttons.
   ========================================================================== */

export interface TrustSealProps extends React.ComponentProps<'p'> {
  freeCancellationHours?: number
}

export function TrustSeal({ freeCancellationHours = 24, className, ...props }: TrustSealProps) {
  return (
    <p
      className={cn(
        'flex items-center justify-center gap-1.5 text-center text-[0.6875rem] leading-relaxed text-subtle',
        className,
      )}
      {...props}
    >
      <BadgeCheck className="size-3.5 shrink-0 text-success" aria-hidden="true" />
      Free cancellation up to {freeCancellationHours}h before · instant confirmation · secure
      payment
    </p>
  )
}
