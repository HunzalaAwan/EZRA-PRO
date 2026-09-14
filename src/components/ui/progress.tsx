'use client'

import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn, clamp, fillRate, pluralize, seatsRemaining } from '@/lib/utils'

const PROGRESS_MOTION_CSS = `
@keyframes ezra-progress-indeterminate{
  0%{transform:translateX(-110%)}
  100%{transform:translateX(440%)}
}
`

function ProgressMotionStyles() {
  return (
    <style href="ezra-motion-progress" precedence="medium">
      {PROGRESS_MOTION_CSS}
    </style>
  )
}

export type ProgressTone = 'primary' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

const TONE_FILL: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

const TONE_TEXT: Record<ProgressTone, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-info',
}

/** Held/pending segment — same hue, dialled back so it reads as "not yours yet". */
const TONE_HELD: Record<ProgressTone, string> = {
  primary: 'bg-primary/30',
  accent: 'bg-accent/30',
  success: 'bg-success/30',
  warning: 'bg-warning/30',
  danger: 'bg-danger/30',
  info: 'bg-info/30',
}

export const progressVariants = cva('relative w-full overflow-hidden rounded-full bg-surface-sunken', {
  variants: {
    size: {
      xs: 'h-1',
      sm: 'h-1.5',
      md: 'h-2.5',
      lg: 'h-3.5',
    },
  },
  defaultVariants: { size: 'md' },
})

export type ProgressVariants = VariantProps<typeof progressVariants>
export type ProgressSize = NonNullable<ProgressVariants['size']>

/* ==========================================================================
   PROGRESS
   ========================================================================== */

export interface ProgressProps
  extends Omit<React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, 'value'>,
    ProgressVariants {
  /** 0..max. Pass `null` together with `indeterminate` for unknown duration. */
  value?: number | null
  tone?: ProgressTone
  /** Runs a looping sweep instead of a fill. */
  indeterminate?: boolean
}

const Progress = React.forwardRef<
  React.ComponentRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(function Progress(
  { className, value = 0, max = 100, size, tone = 'primary', indeterminate = false, ...props },
  ref,
) {
  const percent = indeterminate || value == null ? 0 : clamp((value / (max || 1)) * 100, 0, 100)

  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={indeterminate ? null : value}
      max={max}
      className={cn(progressVariants({ size }), className)}
      {...props}
    >
      {indeterminate ? <ProgressMotionStyles /> : null}
      <ProgressPrimitive.Indicator
        className={cn(
          'h-full rounded-full',
          TONE_FILL[tone],
          indeterminate
            ? 'w-1/4 animate-[ezra-progress-indeterminate_1.4s_var(--ease-in-out-quart)_infinite]'
            : 'transition-[width] duration-700 ease-[var(--ease-out-expo)]',
        )}
        style={indeterminate ? undefined : { width: `${percent}%` }}
      />
    </ProgressPrimitive.Root>
  )
})

/* ==========================================================================
   CAPACITY BAR
   Seat capacity appears on the calendar, the manifest and every departure card,
   so the colour ramp is centralised here and exported for reuse by chips,
   calendar cells and charts.
   ========================================================================== */

/** Low fill is healthy, 70-89% is a nudge, 90%+ needs attention. */
export function capacityTone(percent: number): Extract<ProgressTone, 'success' | 'warning' | 'danger'> {
  if (percent >= 90) return 'danger'
  if (percent >= 70) return 'warning'
  return 'success'
}

/** Plain-language status so colour is never the only signal. */
export function capacityStatusLabel(percent: number, remaining: number) {
  if (remaining <= 0) return 'Sold out'
  if (percent >= 90) return 'Almost full'
  if (percent >= 70) return 'Filling fast'
  return 'Seats available'
}

export interface CapacityBarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  booked: number
  capacity: number
  /** Seats locked by in-progress carts — shown as a lighter leading segment. */
  held?: number
  size?: ProgressSize
  /** Render the "12 / 20 seats · Filling fast" caption above the bar. */
  showLabel?: boolean
  /** Noun used in the caption and the accessible value text. */
  unit?: string
}

const CapacityBar = React.forwardRef<HTMLDivElement, CapacityBarProps>(function CapacityBar(
  {
    className,
    booked,
    capacity,
    held = 0,
    size = 'md',
    showLabel = true,
    unit = 'seat',
    ...props
  },
  ref,
) {
  const bookedPercent = fillRate(booked, capacity)
  const heldPercent = clamp(fillRate(booked + held, capacity), 0, 100)
  const remaining = seatsRemaining(capacity, booked, held)
  const tone = capacityTone(heldPercent)
  const status = capacityStatusLabel(heldPercent, remaining)

  return (
    <div ref={ref} className={cn('flex w-full flex-col gap-1.5', className)} {...props}>
      {showLabel ? (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="tabular font-medium text-foreground">
            {booked} / {capacity} {pluralize(capacity, unit)}
          </span>
          <span className={cn('font-medium', TONE_TEXT[tone])}>{status}</span>
        </div>
      ) : null}

      <ProgressPrimitive.Root
        value={booked}
        max={Math.max(capacity, 1)}
        getValueLabel={(current, total) =>
          `${current} of ${total} ${pluralize(total, unit)} booked — ${status}`
        }
        className={progressVariants({ size })}
      >
        {held > 0 ? (
          <div
            aria-hidden="true"
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              TONE_HELD[tone],
              'transition-[width] duration-700 ease-[var(--ease-out-expo)]',
            )}
            style={{ width: `${heldPercent}%` }}
          />
        ) : null}
        <ProgressPrimitive.Indicator
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            TONE_FILL[tone],
            'transition-[width] duration-700 ease-[var(--ease-out-expo)]',
          )}
          style={{ width: `${bookedPercent}%` }}
        />
      </ProgressPrimitive.Root>
    </div>
  )
})

export { Progress, CapacityBar }
