'use client'

import * as React from 'react'
import * as SliderPrimitive from '@radix-ui/react-slider'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export const sliderVariants = cva(
  [
    'relative flex w-full touch-none select-none items-center',
    'data-[orientation=vertical]:h-48 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  ],
  {
    variants: {
      // Vertical padding is the touch target — the visible track stays slim.
      size: {
        sm: 'py-2 data-[orientation=vertical]:px-2 data-[orientation=vertical]:py-0',
        md: 'py-2.5 data-[orientation=vertical]:px-2.5 data-[orientation=vertical]:py-0',
        lg: 'py-3 data-[orientation=vertical]:px-3 data-[orientation=vertical]:py-0',
      },
    },
    defaultVariants: { size: 'md' },
  },
)

export type SliderSize = NonNullable<VariantProps<typeof sliderVariants>['size']>

/** Track thickness and thumb diameter, kept proportional at every size. */
const sliderTrackSizes: Record<SliderSize, string> = {
  sm: 'h-1 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1',
  md: 'h-1.5 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5',
  lg: 'h-2 data-[orientation=vertical]:h-full data-[orientation=vertical]:w-2',
}

const sliderThumbSizes: Record<SliderSize, string> = {
  sm: 'size-3.5 border-2',
  md: 'size-4.5 border-2',
  lg: 'size-5 border-[3px]',
}

export interface SliderProps
  extends React.ComponentProps<typeof SliderPrimitive.Root>,
    VariantProps<typeof sliderVariants> {
  /**
   * Accessible name per thumb, in value order. Range sliders are meaningless to a
   * screen reader without these ("Minimum price" / "Maximum price").
   */
  thumbLabels?: string[]
}

export function Slider({
  className,
  size = 'md',
  value,
  defaultValue,
  thumbLabels,
  ...props
}: SliderProps) {
  // Radix renders one thumb per value, so the thumb count is derived, never guessed.
  const thumbCount = Math.max(value?.length ?? defaultValue?.length ?? 1, 1)

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      value={value}
      defaultValue={defaultValue}
      className={cn(sliderVariants({ size }), className)}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className={cn(
          'relative grow overflow-hidden rounded-full bg-surface-sunken',
          'shadow-[inset_0_1px_2px_0_color-mix(in_oklab,black_10%,transparent)]',
          sliderTrackSizes[size ?? 'md'],
        )}
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className={cn(
            'absolute h-full rounded-full',
            'bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_78%,var(--accent)),var(--primary))]',
            'data-[orientation=vertical]:h-auto data-[orientation=vertical]:w-full',
          )}
        />
      </SliderPrimitive.Track>

      {Array.from({ length: thumbCount }, (_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          data-slot="slider-thumb"
          aria-label={thumbLabels?.[index]}
          className={cn(
            'block shrink-0 rounded-full border-primary bg-background shadow-md',
            'transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
            'hover:scale-110 hover:shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_16%,transparent)]',
            'focus-visible:scale-110 focus-visible:outline-hidden',
            'focus-visible:shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_28%,transparent)]',
            'active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
            'disabled:pointer-events-none',
            sliderThumbSizes[size ?? 'md'],
          )}
        />
      ))}
    </SliderPrimitive.Root>
  )
}
