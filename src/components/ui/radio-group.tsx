'use client'

import * as React from 'react'
import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export const radioGroupVariants = cva('grid', {
  variants: {
    orientation: {
      vertical: 'grid-flow-row auto-rows-min',
      horizontal: 'grid-flow-col auto-cols-max items-center',
    },
    gap: {
      sm: 'gap-2',
      md: 'gap-3',
      lg: 'gap-4',
    },
  },
  defaultVariants: { orientation: 'vertical', gap: 'md' },
})

export interface RadioGroupProps
  extends Omit<React.ComponentProps<typeof RadioGroupPrimitive.Root>, 'orientation'>,
    VariantProps<typeof radioGroupVariants> {}

export function RadioGroup({ className, orientation, gap, ...props }: RadioGroupProps) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      orientation={orientation === 'horizontal' ? 'horizontal' : 'vertical'}
      className={cn(radioGroupVariants({ orientation, gap }), className)}
      {...props}
    />
  )
}

export const radioItemVariants = cva(
  [
    'group/radio relative inline-flex shrink-0 items-center justify-center rounded-full',
    'border border-line-strong bg-surface shadow-xs',
    'transition-all duration-200 ease-[var(--ease-out-expo)]',
    'hover:border-primary/60',
    'focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/30',
    'active:scale-90 motion-reduce:transition-none motion-reduce:active:scale-100',
    'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
    'data-[state=checked]:shadow-[0_2px_8px_-2px_color-mix(in_oklab,var(--primary)_55%,transparent)]',
    'disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
    'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/30',
  ],
  {
    variants: {
      size: {
        sm: 'size-4',
        md: 'size-[1.125rem]',
        lg: 'size-5',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

/** Dot diameter per control size — the checked state's only visual payload. */
const radioDotSizes: Record<RadioSize, string> = {
  sm: 'size-1.5',
  md: 'size-[0.4375rem]',
  lg: 'size-2',
}

export type RadioSize = NonNullable<VariantProps<typeof radioItemVariants>['size']>

export interface RadioGroupItemProps
  extends React.ComponentProps<typeof RadioGroupPrimitive.Item>,
    VariantProps<typeof radioItemVariants> {}

export function RadioGroupItem({ className, size = 'md', ...props }: RadioGroupItemProps) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(radioItemVariants({ size }), className)}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        forceMount
        className={cn(
          'pointer-events-none block rounded-full bg-on-primary',
          'transition-all duration-200 ease-[var(--ease-spring)]',
          'group-data-[state=unchecked]/radio:scale-0 group-data-[state=unchecked]/radio:opacity-0',
          radioDotSizes[size ?? 'md'],
        )}
      />
    </RadioGroupPrimitive.Item>
  )
}

export interface RadioGroupCardProps
  extends Omit<React.ComponentProps<typeof RadioGroupPrimitive.Item>, 'children'> {
  label: React.ReactNode
  description?: React.ReactNode
  /** Leading glyph or illustration, rendered in a tinted tile. */
  icon?: React.ReactNode
  /** Right-aligned slot — price, seat count, badge. */
  trailing?: React.ReactNode
  children?: React.ReactNode
}

/**
 * Selectable card — the pattern the storefront uses for ticket tiers, time slots
 * and payment options, where a bare dot is too small a hit target to be premium.
 */
export function RadioGroupCard({
  className,
  label,
  description,
  icon,
  trailing,
  children,
  ...props
}: RadioGroupCardProps) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-card"
      className={cn(
        'group/radio-card relative flex w-full items-start gap-3 rounded-xl border border-line',
        'bg-surface p-4 text-left shadow-xs',
        'transition-all duration-200 ease-[var(--ease-out-expo)]',
        'hover:border-line-strong hover:shadow-md motion-reduce:transition-none',
        'focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/25',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary-soft/40',
        'data-[state=checked]:shadow-[0_10px_28px_-14px_color-mix(in_oklab,var(--primary)_75%,transparent)]',
        'disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-[1.125rem] shrink-0 items-center justify-center rounded-full',
          'border border-line-strong bg-surface transition-colors duration-200',
          'group-data-[state=checked]/radio-card:border-primary group-data-[state=checked]/radio-card:bg-primary',
        )}
      >
        <RadioGroupPrimitive.Indicator
          forceMount
          className={cn(
            'block size-[0.4375rem] rounded-full bg-on-primary',
            'transition-all duration-200 ease-[var(--ease-spring)]',
            'group-data-[state=unchecked]/radio-card:scale-0 group-data-[state=unchecked]/radio-card:opacity-0',
          )}
        />
      </span>

      {icon ? (
        <span
          aria-hidden="true"
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            'bg-surface-sunken text-subtle transition-colors duration-200',
            'group-data-[state=checked]/radio-card:bg-primary-soft group-data-[state=checked]/radio-card:text-primary',
            '[&_svg]:size-4.5 [&_svg]:shrink-0',
          )}
        >
          {icon}
        </span>
      ) : null}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="text-xs leading-relaxed text-muted">{description}</span>
        ) : null}
        {children}
      </span>

      {trailing ? (
        <span className="ml-auto shrink-0 pl-2 text-sm font-semibold text-foreground tabular">
          {trailing}
        </span>
      ) : null}
    </RadioGroupPrimitive.Item>
  )
}
