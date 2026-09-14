'use client'

import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Radix measures the panel and publishes `--radix-accordion-content-height` on
 * the content element, but it ships no keyframes — and tailwindcss-animate is
 * not part of this stack. So the height animation is authored here and applied
 * through Tailwind's arbitrary `animate-[…]` syntax, which emits the shorthand
 * but expects you to supply the @keyframes (exactly this).
 *
 * A CSS *animation* rather than a transition is also load-bearing: Radix's
 * Presence only defers unmount for elements that report a running animation, so
 * a transition-only approach would make the panel disappear instantly on close.
 */
const ACCORDION_MOTION_CSS = `
@keyframes ezra-accordion-down{
  from{height:0;opacity:0}
  to{height:var(--radix-accordion-content-height);opacity:1}
}
@keyframes ezra-accordion-up{
  from{height:var(--radix-accordion-content-height);opacity:1}
  to{height:0;opacity:0}
}
`

function AccordionMotionStyles() {
  return (
    <style href="ezra-motion-accordion" precedence="medium">
      {ACCORDION_MOTION_CSS}
    </style>
  )
}

export type AccordionVariant = 'default' | 'card' | 'plain'

const AccordionContext = React.createContext<AccordionVariant>('default')

/* ==========================================================================
   ROOT
   ========================================================================== */

export const accordionRootVariants = cva('w-full', {
  variants: {
    variant: {
      default: 'divide-y divide-line-subtle border-y border-line-subtle',
      card: 'flex flex-col gap-3',
      plain: 'flex flex-col',
    },
  },
  defaultVariants: { variant: 'default' },
})

export type AccordionRootVariants = VariantProps<typeof accordionRootVariants>

type AccordionPrimitiveRootProps = React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>

export type AccordionProps = AccordionPrimitiveRootProps & { variant?: AccordionVariant }

const Accordion = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Root>,
  AccordionProps
>(function Accordion(props, ref) {
  const { variant = 'default', className, ...rest } = props
  // Destructuring a discriminated union widens `type` to 'single' | 'multiple',
  // so the remainder is re-asserted (not re-declared) before it is forwarded.
  const rootProps = rest as AccordionPrimitiveRootProps

  return (
    <AccordionContext.Provider value={variant}>
      <AccordionMotionStyles />
      <AccordionPrimitive.Root
        ref={ref}
        className={cn(accordionRootVariants({ variant }), className)}
        {...rootProps}
      />
    </AccordionContext.Provider>
  )
})

/* ==========================================================================
   ITEM
   ========================================================================== */

export const accordionItemVariants = cva('', {
  variants: {
    variant: {
      default: 'border-0',
      card: [
        'overflow-hidden rounded-xl border border-line bg-surface px-4',
        'transition-shadow duration-300 ease-[var(--ease-out-expo)]',
        'data-[state=open]:border-line-strong data-[state=open]:shadow-md',
      ],
      plain: 'border-b border-line-subtle last:border-b-0',
    },
  },
  defaultVariants: { variant: 'default' },
})

export type AccordionItemVariants = VariantProps<typeof accordionItemVariants>

const AccordionItem = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(function AccordionItem({ className, ...props }, ref) {
  const variant = React.useContext(AccordionContext)
  return (
    <AccordionPrimitive.Item
      ref={ref}
      className={cn(accordionItemVariants({ variant }), className)}
      {...props}
    />
  )
})

/* ==========================================================================
   TRIGGER
   ========================================================================== */

export interface AccordionTriggerProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger> {
  /** Optional leading slot — an icon, count chip or avatar. */
  leading?: React.ReactNode
  /** Replace the default chevron. */
  indicator?: React.ReactNode
}

const AccordionTrigger = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Trigger>,
  AccordionTriggerProps
>(function AccordionTrigger({ className, children, leading, indicator, ...props }, ref) {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          'group flex flex-1 items-center gap-3 py-4 text-left text-sm font-medium text-foreground',
          'transition-colors duration-200 ease-[var(--ease-out-expo)]',
          'hover:text-primary data-[state=open]:text-foreground',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          'disabled:pointer-events-none disabled:opacity-45',
          className,
        )}
        {...props}
      >
        {leading ? <span className="shrink-0 text-subtle">{leading}</span> : null}
        <span className="min-w-0 flex-1">{children}</span>
        {indicator ?? (
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 shrink-0 text-subtle',
              'transition-transform duration-300 ease-[var(--ease-out-expo)]',
              'group-hover:text-primary group-data-[state=open]:rotate-180',
            )}
          />
        )}
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
})

/* ==========================================================================
   CONTENT
   Padding lives on an inner element: the animated element's own box is what
   Radix measures, so padding on it would fight the height keyframes.
   ========================================================================== */

export interface AccordionContentProps
  extends React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content> {
  /**
   * Class for the animated element itself. `className` targets the inner
   * padding wrapper, which is what call sites almost always want to adjust.
   */
  contentClassName?: string
}

const AccordionContent = React.forwardRef<
  React.ComponentRef<typeof AccordionPrimitive.Content>,
  AccordionContentProps
>(function AccordionContent({ className, contentClassName, children, ...props }, ref) {
  return (
    <AccordionPrimitive.Content
      ref={ref}
      className={cn(
        'overflow-hidden text-sm leading-relaxed text-muted',
        'data-[state=open]:animate-[ezra-accordion-down_300ms_var(--ease-out-expo)]',
        'data-[state=closed]:animate-[ezra-accordion-up_220ms_var(--ease-in-out-quart)]',
        contentClassName,
      )}
      {...props}
    >
      <div className={cn('pb-4 pt-0', className)}>{children}</div>
    </AccordionPrimitive.Content>
  )
})

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
