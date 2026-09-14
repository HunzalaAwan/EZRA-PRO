'use client'

import * as React from 'react'
import * as SeparatorPrimitive from '@radix-ui/react-separator'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

export const separatorVariants = cva('shrink-0', {
  variants: {
    orientation: {
      horizontal: 'h-px w-full',
      vertical: 'h-full w-px',
    },
    tone: {
      /** Hairline used between rows and cards. */
      default: 'bg-line',
      subtle: 'bg-line-subtle',
      strong: 'bg-line-strong',
      /** Fades out at both ends — for section breaks on marketing surfaces. */
      gradient: 'bg-transparent',
    },
  },
  compoundVariants: [
    {
      orientation: 'horizontal',
      tone: 'gradient',
      class: 'bg-gradient-to-r from-transparent via-line-strong to-transparent',
    },
    {
      orientation: 'vertical',
      tone: 'gradient',
      class: 'bg-gradient-to-b from-transparent via-line-strong to-transparent',
    },
  ],
  defaultVariants: { orientation: 'horizontal', tone: 'default' },
})

export type SeparatorVariants = VariantProps<typeof separatorVariants>

export interface SeparatorProps
  extends Omit<React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>, 'orientation'>,
    SeparatorVariants {}

const Separator = React.forwardRef<
  React.ComponentRef<typeof SeparatorPrimitive.Root>,
  SeparatorProps
>(function Separator(
  { className, orientation = 'horizontal', tone, decorative = true, ...props },
  ref,
) {
  return (
    <SeparatorPrimitive.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation ?? 'horizontal'}
      className={cn(separatorVariants({ orientation, tone }), className)}
      {...props}
    />
  )
})

export interface SeparatorWithLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Centred caption, e.g. "or continue with". */
  label: React.ReactNode
  tone?: SeparatorVariants['tone']
}

/**
 * Horizontal rule broken by a caption. The rules are decorative — the label
 * itself carries the meaning, so screen readers hear the text once.
 */
function SeparatorWithLabel({
  className,
  label,
  tone = 'default',
  ...props
}: SeparatorWithLabelProps) {
  return (
    <div className={cn('flex items-center gap-3', className)} {...props}>
      <Separator tone={tone} className="flex-1" />
      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-faint">
        {label}
      </span>
      <Separator tone={tone} className="flex-1" />
    </div>
  )
}

export { Separator, SeparatorWithLabel }
