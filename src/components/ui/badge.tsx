import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import {
  Archive,
  BadgeCheck,
  Ban,
  Check,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  Clock,
  CloudRain,
  Hourglass,
  Pause,
  PencilLine,
  Radio,
  RotateCcw,
  UserX,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { cn, titleCase } from '@/lib/utils'
import type { ActivityStatus, BookingStatus, DepartureStatus, PaymentStatus } from '@/types'

export const badgeVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center whitespace-nowrap align-middle',
    'rounded-full border font-medium tracking-[-0.005em]',
    'transition-colors duration-200 ease-[var(--ease-out-expo)]',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        neutral: 'border-line bg-surface-sunken text-muted',
        primary:
          'border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft text-primary',
        accent:
          'border-[color-mix(in_oklab,var(--accent)_30%,transparent)] bg-accent-soft text-accent',
        success:
          'border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-success-soft text-success',
        warning:
          'border-[color-mix(in_oklab,var(--warning)_32%,transparent)] bg-warning-soft text-warning',
        danger:
          'border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft text-danger',
        info: 'border-[color-mix(in_oklab,var(--info)_30%,transparent)] bg-info-soft text-info',
        outline: 'border-line-strong bg-transparent text-muted',
      },
      size: {
        sm: 'h-5 gap-1 px-2 text-[0.6875rem] [&_svg]:size-3',
        md: 'h-6 gap-1.5 px-2.5 text-xs [&_svg]:size-3.5',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  },
)

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>['variant']>
export type BadgeSize = NonNullable<VariantProps<typeof badgeVariants>['size']>

export interface BadgeProps
  extends React.ComponentProps<'span'>,
    VariantProps<typeof badgeVariants> {
  /** Renders a small leading status dot tinted with the badge's own colour. */
  dot?: boolean
  asChild?: boolean
}

export function Badge({
  className,
  variant,
  size,
  dot = false,
  asChild = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : 'span'

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, size }), className)}
      {...(props as React.ComponentProps<'span'>)}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            'rounded-full bg-current opacity-80',
            size === 'sm' ? 'size-1.5' : 'size-[0.4375rem]',
          )}
        />
      ) : null}
      {children}
    </Comp>
  )
}

/* ==========================================================================
   STATUS BADGES
   One exhaustive mapping per domain union. Colour is never the only signal:
   every state also carries a glyph and a human label.
   ========================================================================== */

export interface StatusMeta {
  label: string
  variant: BadgeVariant
  icon: LucideIcon
}

export const bookingStatusMeta: Record<BookingStatus, StatusMeta> = {
  pending: { label: 'Pending', variant: 'warning', icon: Hourglass },
  confirmed: { label: 'Confirmed', variant: 'success', icon: CircleCheck },
  checked_in: { label: 'Checked in', variant: 'info', icon: BadgeCheck },
  completed: { label: 'Completed', variant: 'neutral', icon: Check },
  cancelled: { label: 'Cancelled', variant: 'danger', icon: CircleX },
  no_show: { label: 'No-show', variant: 'warning', icon: UserX },
  refunded: { label: 'Refunded', variant: 'outline', icon: RotateCcw },
}

export const departureStatusMeta: Record<DepartureStatus, StatusMeta> = {
  scheduled: { label: 'Scheduled', variant: 'neutral', icon: Clock },
  confirmed: { label: 'Confirmed', variant: 'success', icon: CircleCheck },
  sold_out: { label: 'Sold out', variant: 'accent', icon: Users },
  cancelled: { label: 'Cancelled', variant: 'danger', icon: CircleX },
  completed: { label: 'Completed', variant: 'outline', icon: Check },
  weather_hold: { label: 'Weather hold', variant: 'warning', icon: CloudRain },
}

export const paymentStatusMeta: Record<PaymentStatus, StatusMeta> = {
  unpaid: { label: 'Unpaid', variant: 'neutral', icon: CircleDashed },
  deposit_paid: { label: 'Deposit paid', variant: 'info', icon: Wallet },
  paid: { label: 'Paid', variant: 'success', icon: CircleCheck },
  partially_refunded: { label: 'Part refunded', variant: 'warning', icon: CircleMinus },
  refunded: { label: 'Refunded', variant: 'outline', icon: RotateCcw },
  failed: { label: 'Payment failed', variant: 'danger', icon: CircleAlert },
}

export const activityStatusMeta: Record<ActivityStatus, StatusMeta> = {
  draft: { label: 'Draft', variant: 'neutral', icon: PencilLine },
  live: { label: 'Live', variant: 'success', icon: Radio },
  paused: { label: 'Paused', variant: 'warning', icon: Pause },
  archived: { label: 'Archived', variant: 'outline', icon: Archive },
}

export type StatusKind = 'booking' | 'departure' | 'payment' | 'activity'

/** Widened for lookup; the prop union below is what keeps call sites exhaustive. */
const statusMetaByKind: Record<StatusKind, Record<string, StatusMeta>> = {
  booking: bookingStatusMeta,
  departure: departureStatusMeta,
  payment: paymentStatusMeta,
  activity: activityStatusMeta,
}

/** Resolves a domain status to its label/variant/icon, degrading gracefully. */
export function statusMeta(kind: StatusKind, status: string): StatusMeta {
  return (
    statusMetaByKind[kind][status] ?? {
      label: titleCase(status),
      variant: 'neutral',
      icon: Ban,
    }
  )
}

type StatusBadgeBaseProps = Omit<BadgeProps, 'variant' | 'children' | 'asChild'> & {
  /** Hide the glyph when the badge sits in a dense table cell. */
  showIcon?: boolean
  /** Override the generated label (e.g. to append a count). */
  label?: React.ReactNode
}

export type StatusBadgeProps =
  | ({ kind: 'booking'; status: BookingStatus } & StatusBadgeBaseProps)
  | ({ kind: 'departure'; status: DepartureStatus } & StatusBadgeBaseProps)
  | ({ kind: 'payment'; status: PaymentStatus } & StatusBadgeBaseProps)
  | ({ kind: 'activity'; status: ActivityStatus } & StatusBadgeBaseProps)

/**
 * `<StatusBadge kind="booking" status={booking.status} />` — the component every
 * table, drawer and manifest uses to render domain state.
 */
export function StatusBadge({
  kind,
  status,
  showIcon = true,
  dot = false,
  label,
  className,
  ...props
}: StatusBadgeProps) {
  const meta = statusMeta(kind, status)
  const Icon = meta.icon

  return (
    <Badge
      data-slot="status-badge"
      data-status={status}
      variant={meta.variant}
      dot={dot}
      className={className}
      {...props}
    >
      {showIcon && !dot ? <Icon aria-hidden="true" /> : null}
      {label ?? meta.label}
    </Badge>
  )
}
