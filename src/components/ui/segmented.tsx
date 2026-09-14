'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, useReducedMotion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'

import { cn, formatNumber } from '@/lib/utils'

/* ==========================================================================
   Segmented — the calendar view switcher (Month / Week / Day / Agenda) and
   any other small, mutually-exclusive choice.

   Modelled as a radiogroup rather than a tablist: it changes the shape of one
   view instead of swapping panels, and radiogroup does not oblige us to own a
   tabpanel. Arrow keys move *and* select, which is the radio convention.

   The travelling pill is a shared-layout element (`layoutId`), so switching
   views slides rather than blinks.
   ========================================================================== */

const segmentedVariants = cva(
  'relative inline-flex items-center rounded-xl border border-line bg-surface-sunken p-1',
  {
    variants: {
      size: {
        sm: 'gap-0.5 text-xs',
        md: 'gap-1 text-[0.8125rem]',
        lg: 'gap-1 text-sm',
      },
      fullWidth: {
        true: 'flex w-full',
        false: '',
      },
    },
    defaultVariants: { size: 'md', fullWidth: false },
  },
)

const segmentVariants = cva(
  [
    'relative isolate inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap',
    'transition-colors duration-200 ease-[var(--ease-out-quint)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-40',
  ],
  {
    variants: {
      size: {
        sm: 'h-7 px-2.5',
        md: 'h-8 px-3',
        lg: 'h-9 px-3.5',
      },
      active: {
        true: 'text-foreground',
        false: 'text-muted hover:text-foreground',
      },
      fullWidth: {
        true: 'flex-1',
        false: '',
      },
    },
    defaultVariants: { size: 'md', active: false, fullWidth: false },
  },
)

export type SegmentedVariants = VariantProps<typeof segmentedVariants>

export interface SegmentedOption<V extends string = string> {
  value: V
  label: React.ReactNode
  icon?: LucideIcon
  /** Trailing count badge, e.g. the number of departures in that view. */
  count?: number
  disabled?: boolean
  /** Required when `label` is omitted or purely decorative. */
  ariaLabel?: string
}

export interface SegmentedProps<V extends string = string>
  extends Omit<React.ComponentProps<'div'>, 'onChange' | 'defaultValue'>,
    SegmentedVariants {
  options: SegmentedOption<V>[]
  value: V
  onValueChange: (value: V) => void
  /** Accessible name for the group — required for screen readers. */
  label: string
  /** Renders labels only at `sm` and up; icons stay visible. */
  hideLabelsOnMobile?: boolean
}

function Segmented<V extends string = string>({
  className,
  options,
  value,
  onValueChange,
  label,
  size = 'md',
  fullWidth = false,
  hideLabelsOnMobile = false,
  ...props
}: SegmentedProps<V>) {
  const reduceMotion = useReducedMotion()
  // Scoped so two Segmented controls on one screen never share an indicator.
  const layoutId = `segmented-indicator-${React.useId()}`
  const itemRefs = React.useRef<Array<HTMLButtonElement | null>>([])

  const enabledIndexes = options.reduce<number[]>((acc, option, index) => {
    if (!option.disabled) acc.push(index)
    return acc
  }, [])

  const move = (fromIndex: number, delta: number) => {
    if (enabledIndexes.length === 0) return
    const position = enabledIndexes.indexOf(fromIndex)
    const nextPosition =
      position === -1
        ? 0
        : (position + delta + enabledIndexes.length) % enabledIndexes.length
    const nextIndex = enabledIndexes[nextPosition]
    itemRefs.current[nextIndex]?.focus()
    onValueChange(options[nextIndex].value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        move(index, 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        move(index, -1)
        break
      case 'Home':
        event.preventDefault()
        if (enabledIndexes.length > 0) move(enabledIndexes[0], 0)
        break
      case 'End':
        event.preventDefault()
        if (enabledIndexes.length > 0) move(enabledIndexes[enabledIndexes.length - 1], 0)
        break
      default:
        break
    }
  }

  return (
    <div
      data-slot="segmented"
      role="radiogroup"
      aria-label={label}
      className={cn(segmentedVariants({ size, fullWidth }), className)}
      {...props}
    >
      {options.map((option, index) => {
        const isActive = option.value === value
        const Icon = option.icon

        return (
          <button
            key={option.value}
            ref={(node) => {
              itemRefs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.ariaLabel}
            disabled={option.disabled}
            // Roving tabindex: one stop for the whole group.
            tabIndex={isActive ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(segmentVariants({ size, active: isActive, fullWidth }))}
          >
            {isActive ? (
              <motion.span
                aria-hidden="true"
                layoutId={layoutId}
                className="absolute inset-0 -z-10 rounded-lg border border-line-subtle bg-surface shadow-sm"
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 460, damping: 38, mass: 0.7 }
                }
              />
            ) : null}

            {Icon ? <Icon aria-hidden="true" className="size-3.5 shrink-0" /> : null}
            <span className={cn(hideLabelsOnMobile && Icon && 'sr-only sm:not-sr-only')}>
              {option.label}
            </span>
            {typeof option.count === 'number' ? (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-px text-[0.625rem] font-semibold tabular-nums',
                  isActive ? 'bg-primary-soft text-primary' : 'bg-surface text-subtle',
                )}
              >
                {formatNumber(option.count, { compact: option.count >= 10_000 })}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export { Segmented, segmentedVariants, segmentVariants }
