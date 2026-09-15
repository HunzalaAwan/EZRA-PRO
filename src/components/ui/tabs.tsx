'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'

const TABS_MOTION_CSS = `
@keyframes ezra-tab-panel-in{from{opacity:0;transform:translate3d(0,6px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
`

function TabsMotionStyles() {
  return (
    <style href="ezra-motion-tabs" precedence="medium">
      {TABS_MOTION_CSS}
    </style>
  )
}

export type TabsVariant = 'underline' | 'pill'
type TabsOrientation = 'horizontal' | 'vertical'

interface TabsContextValue {
  variant: TabsVariant
  orientation: TabsOrientation
  /** Mirrors Radix's value so triggers know which one owns the indicator. */
  activeValue: string | undefined
  indicatorId: string
  reduceMotion: boolean
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabsContext(part: string) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error(`<${part}> must be rendered inside <Tabs>`)
  return ctx
}

/* ==========================================================================
   ROOT
   The value is mirrored into local state (rather than read from Radix, which
   does not expose it) so the sliding indicator knows its target on the very
   first server render — no post-hydration jump.
   ========================================================================== */

export interface TabsProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  variant?: TabsVariant
}

const Tabs = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.Root>, TabsProps>(
  function Tabs(
    {
      className,
      variant = 'underline',
      value,
      defaultValue,
      onValueChange,
      orientation = 'horizontal',
      ...props
    },
    ref,
  ) {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue)
    const activeValue = value ?? uncontrolledValue
    const reactId = React.useId()
    // Only feeds motion props, never markup — safe for hydration.
    const reduceMotion = useReducedMotionSafe()

    const handleValueChange = React.useCallback(
      (next: string) => {
        setUncontrolledValue(next)
        onValueChange?.(next)
      },
      [onValueChange],
    )

    const ctx = React.useMemo<TabsContextValue>(
      () => ({
        variant,
        orientation,
        activeValue,
        indicatorId: `ezra-tabs-indicator-${reactId}`,
        reduceMotion,
      }),
      [variant, orientation, activeValue, reactId, reduceMotion],
    )

    return (
      <TabsContext.Provider value={ctx}>
        <TabsMotionStyles />
        <TabsPrimitive.Root
          ref={ref}
          value={value}
          defaultValue={defaultValue}
          onValueChange={handleValueChange}
          orientation={orientation}
          className={cn(
            'flex gap-4',
            orientation === 'vertical' ? 'flex-row' : 'flex-col',
            className,
          )}
          {...props}
        />
      </TabsContext.Provider>
    )
  },
)

/* ==========================================================================
   LIST
   ========================================================================== */

export const tabsListVariants = cva('relative flex', {
  variants: {
    variant: {
      underline: 'gap-1',
      pill: 'gap-1 rounded-xl border border-line-subtle bg-surface-sunken p-1',
    },
    orientation: {
      horizontal: 'items-center',
      vertical: 'flex-col items-stretch',
    },
  },
  compoundVariants: [
    { variant: 'underline', orientation: 'horizontal', class: 'border-b border-line' },
    { variant: 'underline', orientation: 'vertical', class: 'border-l border-line' },
    { variant: 'pill', orientation: 'horizontal', class: 'w-fit' },
  ],
  defaultVariants: { variant: 'underline', orientation: 'horizontal' },
})

export type TabsListVariants = VariantProps<typeof tabsListVariants>

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(function TabsList({ className, ...props }, ref) {
  const { variant, orientation } = useTabsContext('TabsList')
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        tabsListVariants({ variant, orientation }),
        // Long tab rows scroll rather than wrap — the manifest and analytics
        // screens both ship more tabs than fit a phone.
        orientation === 'horizontal' && 'no-scrollbar overflow-x-auto',
        className,
      )}
      {...props}
    />
  )
})

/* ==========================================================================
   TRIGGER
   ========================================================================== */

export const tabsTriggerVariants = cva(
  [
    'group relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
    'text-sm font-medium text-muted transition-colors duration-200 ease-[var(--ease-out-expo)]',
    'hover:text-foreground data-[state=active]:text-foreground',
    'disabled:pointer-events-none disabled:opacity-45',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        underline: 'rounded-t-md px-3 py-2.5',
        pill: 'rounded-lg px-3.5 py-1.5',
      },
    },
    defaultVariants: { variant: 'underline' },
  },
)

export type TabsTriggerVariants = VariantProps<typeof tabsTriggerVariants>

/** Geometry of the sliding indicator, per variant and axis. */
const INDICATOR_CLASS: Record<TabsVariant, Record<TabsOrientation, string>> = {
  underline: {
    horizontal: 'absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary',
    vertical: 'absolute inset-y-0 -left-px w-0.5 rounded-full bg-primary',
  },
  pill: {
    horizontal: 'absolute inset-0 rounded-lg bg-surface-raised shadow-sm ring-1 ring-line-subtle',
    vertical: 'absolute inset-0 rounded-lg bg-surface-raised shadow-sm ring-1 ring-line-subtle',
  },
}

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(function TabsTrigger({ className, children, value, ...props }, ref) {
  const { variant, orientation, activeValue, indicatorId, reduceMotion } =
    useTabsContext('TabsTrigger')
  const isActive = activeValue === value

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    >
      {isActive ? (
        <motion.span
          aria-hidden="true"
          layoutId={indicatorId}
          className={INDICATOR_CLASS[variant][orientation]}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 480, damping: 38, mass: 0.7 }
          }
        />
      ) : null}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </TabsPrimitive.Trigger>
  )
})

/* ==========================================================================
   CONTENT
   ========================================================================== */

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(function TabsContent({ className, ...props }, ref) {
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        'min-w-0 flex-1 outline-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'data-[state=active]:animate-[ezra-tab-panel-in_260ms_var(--ease-out-expo)]',
        className,
      )}
      {...props}
    />
  )
})

export { Tabs, TabsList, TabsTrigger, TabsContent }
